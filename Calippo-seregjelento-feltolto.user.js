// ==UserScript==
// @name         Calippo Seregjelentő Feltöltő
// @namespace    calippo.grepolis
// @version      1.1.2
// @description  Különálló, kizárólag kézi seregjelentés-feltöltő a Calippo központi adatbázisához.
// @author       Arti
// @match        https://*.grepolis.com/game/*
// @run-at       document-idle
// @grant        unsafeWindow
// @connect      calippo-license.szutyi0906.workers.dev
// @downloadURL  https://raw.githubusercontent.com/PeterKiss-cyber/calippo-seregjelento/main/Calippo-seregjelento-feltolto.user.js
// @updateURL    https://raw.githubusercontent.com/PeterKiss-cyber/calippo-seregjelento/main/Calippo-seregjelento-feltolto.user.js
// ==/UserScript==

(() => {
    'use strict';

    const uw = typeof unsafeWindow === 'undefined' ? window : unsafeWindow;
    const ENDPOINT = 'https://calippo-license.szutyi0906.workers.dev';
    const BUTTON_ID = 'calippo_army_uploader_button';
    const PANEL_ID = 'calippo_army_uploader_panel';
    const UPLOAD_TIME_PREFIX = 'calippo_army_uploader_last_';
    const REGISTERED_PREFIX = 'calippo_army_uploader_registered_';
    let mounted = false;

    const unitIds = () => Object.keys(uw.GameData?.units || {})
        .filter(id => id !== 'militia' && uw.GameData.units[id] && typeof uw.GameData.units[id] === 'object');

    const towns = () => {
        const value = uw.ITowns?.getTowns?.() || uw.ITowns?.towns || {};
        return Array.isArray(value) ? value : Object.values(value);
    };

    function addUnits(target, source) {
        Object.entries(source || {}).forEach(([unit, amount]) => {
            const count = Math.max(0, Math.floor(Number(amount) || 0));
            if (count) target[unit] = (target[unit] || 0) + count;
        });
    }

    function collect(includeOuter) {
        const result = {};
        towns().forEach(town => {
            try { addUnits(result, typeof town.units === 'function' ? town.units() : town.units); } catch (_) {}
            if (includeOuter) {
                try { addUnits(result, typeof town.unitsOuter === 'function' ? town.unitsOuter() : town.unitsOuter); } catch (_) {}
            }
        });
        return result;
    }

    function identity() {
        return {
            world: String(uw.Game?.world_id || location.hostname.split('.')[0] || '').toLowerCase(),
            playerId: String(uw.Game?.player_id || ''),
            playerName: String(uw.Game?.player_name || '')
        };
    }

    function status(text, error = false) {
        const target = document.querySelector(`#${PANEL_ID} .calippo-army-upload-status`);
        if (target) {
            target.textContent = text;
            target.style.color = error ? '#a40000' : '#254f13';
        }
        try {
            if (uw.HumanMessage) (error ? uw.HumanMessage.error : uw.HumanMessage.success)(text);
        } catch (_) {}
    }

    function fill() {
        const panel = document.getElementById(PANEL_ID);
        if (!panel) return;
        const includeOuter = panel.querySelector('.calippo-army-upload-outer')?.checked === true;
        const units = collect(includeOuter);
        panel.querySelectorAll('[data-unit]').forEach(input => {
            input.value = String(units[input.dataset.unit] || 0);
        });
        status('Az aktuális egységadatok betöltve. A feltöltéshez nyomd meg a Feltöltés gombot.');
    }

    function inputUnits() {
        const result = {};
        document.querySelectorAll(`#${PANEL_ID} [data-unit]`).forEach(input => {
            result[input.dataset.unit] = Math.max(0, Math.floor(Number(input.value) || 0));
        });
        return result;
    }

    async function registerWithInvite(id) {
        const inviteCode = window.prompt('Add meg a Calippo Seregjelentő meghívókódját:');
        if (inviteCode === null) throw new Error('A regisztráció megszakítva.');
        const code = inviteCode.trim();
        if (!code) throw new Error('Nem adtál meg meghívókódot.');
        const response = await fetch(`${ENDPOINT}/army/register?world=${encodeURIComponent(id.world)}&player_id=${encodeURIComponent(id.playerId)}`, {
            method: 'POST', mode: 'cors', cache: 'no-store', credentials: 'omit',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify({invite_code: code, name: id.playerName})
        });
        const data = await response.json().catch(() => ({}));
        const reasons = {
            invalid_invite: 'A meghívókód hibás vagy le van tiltva.',
            invite_expired: 'A meghívókód lejárt.',
            wrong_world: 'Ez a meghívókód nem használható ezen a világon.',
            invalid_registration: 'A regisztrációs adatok hibásak.'
        };
        if (!response.ok || data.ok !== true) throw new Error(reasons[data.reason] || data.reason || `HTTP ${response.status}`);
        localStorage.setItem(REGISTERED_PREFIX + id.world + '_' + id.playerId, '1');
        return true;
    }

    async function upload(suppliedUnits = null, showMessage = true, allowRegistration = true) {
        const id = identity();
        if (!id.world || !/^\d+$/.test(id.playerId)) {
            if (showMessage) status('A játékosazonosító még nem érhető el. Próbáld újra néhány másodperc múlva.', true);
            return;
        }
        const button = document.querySelector(`#${PANEL_ID} .calippo-army-upload-send`);
        if (button) button.disabled = true;
        if (showMessage) status('Feltöltés folyamatban…');
        try {
            const response = await fetch(`${ENDPOINT}/army/report?world=${encodeURIComponent(id.world)}&player_id=${encodeURIComponent(id.playerId)}`, {
                method: 'POST', mode: 'cors', cache: 'no-store', credentials: 'omit',
                headers: {'content-type': 'application/json'},
                body: JSON.stringify({units: suppliedUnits || inputUnits()})
            });
            const data = await response.json().catch(() => ({}));
            if (response.status === 403 && data.reason === 'not_authorized' && allowRegistration && showMessage) {
                await registerWithInvite(id);
                return upload(suppliedUnits, showMessage, false);
            }
            if (!response.ok || data.ok !== true) {
                const reasons = {
                    not_authorized: 'Ehhez a játékoshoz nincs seregjelentő-feltöltési jogosultság.',
                    invalid_units: 'Az egységadatok formátuma hibás.'
                };
                throw new Error(reasons[data.reason] || data.reason || `HTTP ${response.status}`);
            }
            localStorage.setItem(UPLOAD_TIME_PREFIX + id.world + '_' + id.playerId, String(Date.now()));
            if (showMessage) status(`Sikeres feltöltés: ${new Date(data.updated_at || Date.now()).toLocaleString('hu-HU')}`);
            return true;
        } catch (error) {
            if (showMessage) status(`A feltöltés sikertelen: ${error.message}`, true);
            console.warn('[Calippo Seregjelentő] Feltöltési hiba:', error);
            return false;
        } finally {
            if (button) button.disabled = false;
        }
    }

    function createPanel() {
        if (document.getElementById(PANEL_ID)) return;
        const id = identity();
        const panel = document.createElement('section');
        panel.id = PANEL_ID;
        panel.innerHTML = `
            <div class="calippo-army-upload-header">
                <strong>Calippo Seregjelentő</strong>
                <button type="button" class="calippo-army-upload-close" title="Bezárás">×</button>
            </div>
            <div class="calippo-army-upload-body">
                <div class="calippo-army-upload-player">Játékos: <b></b></div>
                <label><input type="checkbox" class="calippo-army-upload-outer"> A városon kívüli saját egységek beleszámítása</label>
                <div class="calippo-army-upload-actions">
                    <button type="button" class="calippo-army-upload-refresh">Egységek frissítése</button>
                    <button type="button" class="calippo-army-upload-send">Feltöltés</button>
                </div>
                <div class="calippo-army-upload-grid"></div>
                <div class="calippo-army-upload-status">Betöltés…</div>
                <small>Adat csak a Feltöltés gomb megnyomásakor kerül elküldésre.</small>
            </div>`;
        panel.querySelector('.calippo-army-upload-player b').textContent = id.playerName || `ID: ${id.playerId}`;
        const grid = panel.querySelector('.calippo-army-upload-grid');
        unitIds().forEach(unit => {
            const definition = uw.GameData.units[unit] || {};
            const row = document.createElement('label');
            row.className = 'calippo-army-upload-unit';
            row.innerHTML = `<span class="unit_icon25x25 ${unit}"></span><span></span><input type="number" min="0" step="1" value="0" data-unit="${unit}" readonly>`;
            row.querySelector('span:nth-child(2)').textContent = definition.name_plural || definition.name || unit;
            grid.appendChild(row);
        });
        panel.querySelector('.calippo-army-upload-close').addEventListener('click', () => panel.remove());
        panel.querySelector('.calippo-army-upload-refresh').addEventListener('click', fill);
        panel.querySelector('.calippo-army-upload-send').addEventListener('click', () => upload(null, true));
        panel.querySelector('.calippo-army-upload-outer').addEventListener('change', fill);
        document.body.appendChild(panel);
        fill();
    }

    function addStyles() {
        if (document.getElementById('calippo_army_uploader_style')) return;
        const style = document.createElement('style');
        style.id = 'calippo_army_uploader_style';
        style.textContent = `
            #${BUTTON_ID}{position:fixed;left:12px;bottom:242px;z-index:10000;padding:8px 12px;border:2px solid #6b421c;border-radius:7px;background:linear-gradient(#f4d889,#b88939);color:#2f1905;font:bold 14px Arial;cursor:pointer;box-shadow:0 2px 7px #0008}
            #${PANEL_ID}{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:10001;width:min(820px,calc(100vw - 40px));max-height:calc(100vh - 50px);border:4px ridge #9b763e;border-radius:7px;background:#ead39c;color:#2f1905;box-shadow:0 7px 25px #000b;font:14px Arial;box-sizing:border-box}
            #${PANEL_ID} .calippo-army-upload-header{display:flex;justify-content:space-between;align-items:center;padding:9px 13px;background:#422d18;color:#f4d889;font-size:20px}
            #${PANEL_ID} .calippo-army-upload-close{border:0;background:transparent;color:#f4d889;font-size:28px;line-height:22px;cursor:pointer}
            #${PANEL_ID} .calippo-army-upload-body{padding:12px;overflow:auto;max-height:calc(100vh - 115px);box-sizing:border-box}
            #${PANEL_ID} .calippo-army-upload-player{font-size:16px;margin-bottom:8px}
            #${PANEL_ID} .calippo-army-upload-actions{display:flex;gap:8px;margin:10px 0}
            #${PANEL_ID} .calippo-army-upload-actions button{padding:6px 18px;font-weight:bold;cursor:pointer}
            #${PANEL_ID} .calippo-army-upload-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px 12px;padding:8px;border:1px solid #9b763e;background:#fff5d999}
            #${PANEL_ID} .calippo-army-upload-unit{display:grid;grid-template-columns:28px 1fr 75px;align-items:center;gap:5px;min-width:0}
            #${PANEL_ID} .calippo-army-upload-unit span:nth-child(2){white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
            #${PANEL_ID} .calippo-army-upload-unit input{width:72px;box-sizing:border-box}
            #${PANEL_ID} .calippo-army-upload-status{font-weight:bold;margin:9px 0 4px}
            @media(max-width:720px){#${PANEL_ID} .calippo-army-upload-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
        `;
        document.head.appendChild(style);
    }

    function mount(attempt = 0) {
        if (mounted || document.getElementById(BUTTON_ID)) return;
        if (!uw.Game?.player_id || !uw.GameData?.units || !uw.ITowns) {
            if (attempt < 120) setTimeout(() => mount(attempt + 1), 500);
            return;
        }
        mounted = true;
        addStyles();
        const button = document.createElement('button');
        button.id = BUTTON_ID;
        button.type = 'button';
        button.textContent = 'Seregjelentő';
        button.addEventListener('click', createPanel);
        document.body.appendChild(button);
        startBackgroundUpload();
    }

    /* A felülettől független, legfeljebb hatóránkénti teljes seregfrissítés. */
    function backgroundUpload() {
        const id = identity();
        if (!id.world || !/^\d+$/.test(id.playerId) || !uw.ITowns) return;
        const key = UPLOAD_TIME_PREFIX + id.world + '_' + id.playerId;
        const lastUpload = Number(localStorage.getItem(key) || 0);
        if (Date.now() - lastUpload < 6 * 60 * 60 * 1000) return;
        upload(collect(true), false);
    }

    function startBackgroundUpload() {
        setTimeout(backgroundUpload, 30000);
        setInterval(backgroundUpload, 30 * 60 * 1000);
    }

    mount();
})();
