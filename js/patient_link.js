// =====================================================================
// Repeat-patient linking
// The laboratory patient number restarts every year, so the same person gets a different number each year.
// This tool finds probable repeat patients by name (names never leave this device), the user confirms each one,
// and every confirmed person gets ONE random code ("Patient Key") that is stored in the records and published.
// The dashboard then uses the code to count a patient once per 12-month block (CLSI M39 Section 6.4).
// =====================================================================
const PL_STORE = 'amr_patient_links';

function plNormName(n) {
    let s = String(n || '').toLowerCase();
    s = s.replace(/[ً-ٰٟـ]/g, '')            // Arabic diacritics and tatweel
        .replace(/[أإآ]/g, 'ا')               // alef variants
        .replace(/ى/g, 'ي').replace(/ة/g, 'ه') // ya, ta marbuta
        .replace(/[^a-zء-ي\s]/g, ' ').replace(/\s+/g, ' ').trim();
    return s;
}
function plSex(r) { const s = String(r['Sex'] || '').trim().toUpperCase(); return s.startsWith('M') ? 'M' : s.startsWith('F') ? 'F' : ''; }
function plDate(r) { return String(r['Specimen Date'] || r['Date'] || ''); }
function plYear(r) { const y = parseInt(plDate(r).slice(0, 4), 10); return isFinite(y) ? y : null; }
function plBirth(r) {
    const y = plYear(r); if (y === null) return null;
    const unit = String(r['Age Unit'] || '').trim().toLowerCase();
    const a = parseFloat(r['Age']); if (!isFinite(a)) return null;
    return y - ((unit === '' || unit.startsWith('y')) ? Math.round(a) : 0);
}
function plLoad() { try { return JSON.parse(localStorage.getItem(PL_STORE)) || { decisions: {} }; } catch (e) { return { decisions: {} }; } }
function plSave(d) { try { localStorage.setItem(PL_STORE, JSON.stringify(d)); } catch (e) {} }
function plNewKey() {
    const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', b = new Uint8Array(6);
    (window.crypto || window.msCrypto).getRandomValues(b);
    return 'P-' + Array.from(b).map(x => A[x % A.length]).join('');
}
function plEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// Records that belong to a stored decision (same name and sex, birth year within one year)
function plMatchDecision(store, r) {
    const nn = plNormName(r['Name']); if (!nn) return null;
    const list = store.decisions[nn + '|' + plSex(r)] || [];
    const b = plBirth(r);
    return list.find(d => b === null || d.by === null || Math.abs(d.by - b) <= 1) || null;
}

// A patient number inside one year is one person: records with that number and year (even without a name) share the code
function plPropagate(records) {
    const m = {};
    records.forEach(r => { if (r['Patient Key'] && r['Patient ID']) m[r['Patient ID'] + '|' + plYear(r)] = r['Patient Key']; });
    let n = 0;
    records.forEach(r => { if (!r['Patient Key'] && r['Patient ID']) { const k = m[r['Patient ID'] + '|' + plYear(r)]; if (k) { r['Patient Key'] = k; n++; } } });
    return n;
}

// Give the saved code to new records of people already confirmed; returns how many records were linked
function plAutoLink(records) {
    const store = plLoad(); let n = 0;
    records.forEach(r => {
        if (r['Patient Key']) return;
        const d = plMatchDecision(store, r);
        if (d && d.status === 'same' && d.key) { r['Patient Key'] = d.key; n++; }
    });
    n += plPropagate(records);
    return n;
}

// Probable repeat patients that have not been decided yet
function plFindCandidates(records) {
    const store = plLoad(), byName = {};
    records.forEach(r => {
        const nn = plNormName(r['Name']);
        if (!nn || nn.indexOf(' ') < 0 || nn === 'unknown patient' || plYear(r) === null) return;   // a single word is too ambiguous
        (byName[nn + '|' + plSex(r)] = byName[nn + '|' + plSex(r)] || []).push(r);
    });
    const out = [];
    Object.keys(byName).forEach(k => {
        const rows = byName[k].filter(r => !plMatchDecision(store, r)).sort((a, b) => (plBirth(a) || 0) - (plBirth(b) || 0));
        // A patient number inside one year is already one person, so records are grouped by (number, year) first and the groups are split by birth year
        const insts = {};
        rows.forEach(r => { const ik = String(r['Patient ID'] || '') + '|' + plYear(r); (insts[ik] = insts[ik] || { by: null, rows: [] }).rows.push(r); if (insts[ik].by === null) insts[ik].by = plBirth(r); });
        const people = [];
        Object.values(insts).sort((x, y) => (x.by === null ? 9e3 : x.by) - (y.by === null ? 9e3 : y.by)).forEach(g => {
            const last = people[people.length - 1];
            if (last && (g.by === null || last.by === null || Math.abs(g.by - last.by) <= 1)) { last.rows = last.rows.concat(g.rows); if (last.by === null) last.by = g.by; }
            else people.push({ by: g.by, rows: g.rows.slice() });
        });
        people.forEach(p => {
            const inst = new Set(p.rows.map(r => String(r['Patient ID'] || '') + '|' + plYear(r)));
            const keys = new Set(p.rows.map(r => r['Patient Key'] || ''));
            if (inst.size < 2) return;                                    // one number in one year is already one person
            if (keys.size === 1 && !keys.has('')) return;                  // already linked
            out.push({ id: k + '|' + p.by, nn: k.split('|')[0], sex: k.split('|')[1], by: p.by, rows: p.rows.sort((a, b) => plDate(a).localeCompare(plDate(b))) });
        });
    });
    return out.sort((a, b) => b.rows.length - a.rows.length);
}

function plApply(candidates, choices) {
    const recs = JSON.parse(localStorage.getItem('amr_records')) || [];
    const byUid = {}; recs.forEach(r => { if (r['_uid']) byUid[r['_uid']] = r; });
    const store = plLoad(); let same = 0, diff = 0;
    candidates.forEach(c => {
        const ch = choices[c.id]; if (!ch) return;
        const dk = c.nn + '|' + c.sex; store.decisions[dk] = store.decisions[dk] || [];
        if (ch === 'same') {
            const key = (c.rows.find(r => r['Patient Key']) || {})['Patient Key'] || plNewKey();
            c.rows.forEach(r => { const t = byUid[r['_uid']]; if (t) t['Patient Key'] = key; });
            store.decisions[dk].push({ status: 'same', key, by: c.by }); same++;
        } else if (ch === 'different') { store.decisions[dk].push({ status: 'different', by: c.by }); diff++; }
    });
    plPropagate(recs); plAutoLink(recs);
    localStorage.setItem('amr_records', JSON.stringify(recs));
    plSave(store);
    return { same, diff };
}

function plCardHtml(c, i) {
    const rows = c.rows.map(r => `<tr><td>${plEsc(r['Patient ID'])}</td><td>${plEsc(plDate(r).slice(0, 10))}</td><td>${plEsc(r['Ward'] || '')}</td><td>${plEsc(r['Selective organism'] || '')}</td><td>${plEsc(r['Age'] != null ? r['Age'] + ' ' + (r['Age Unit'] || '') : '')}</td></tr>`).join('');
    return `<div class="pl-card" data-i="${i}" style="border:1px solid #e2e8f0;border-radius:10px;padding:8px;margin:8px 0;text-align:left">
        <div style="font-weight:700;font-size:13px">${plEsc(c.nn)} <span style="font-weight:400;color:#64748b">(${plEsc(c.sex || 'sex not recorded')})</span></div>
        <table style="width:100%;font-size:11px;margin:4px 0;border-collapse:collapse"><thead><tr style="color:#64748b;text-align:left"><th>Patient ID</th><th>Date</th><th>Ward</th><th>Organism</th><th>Age</th></tr></thead><tbody>${rows}</tbody></table>
        <div style="display:flex;gap:6px"><button type="button" class="pl-btn" data-v="same" style="flex:1;border:1px solid #cbd5e1;border-radius:8px;padding:6px;font-size:12px;font-weight:700">Same person</button>
        <button type="button" class="pl-btn" data-v="different" style="flex:1;border:1px solid #cbd5e1;border-radius:8px;padding:6px;font-size:12px;font-weight:700">Different people</button></div></div>`;
}

async function openPatientLink(opts) {
    opts = opts || {};
    const recs = JSON.parse(localStorage.getItem('amr_records')) || [];
    const auto = plAutoLink(recs);
    if (auto) localStorage.setItem('amr_records', JSON.stringify(recs));
    const cands = plFindCandidates(recs);
    if (!cands.length) {
        if (!opts.silent) await Swal.fire({ icon: 'info', title: 'Repeat patients', html: (auto ? auto + ' record(s) were linked automatically to people you confirmed before.<br>' : '') + 'No new possible repeat patients were found.' });
        if (auto && typeof syncLocalToCloud === 'function' && navigator.onLine) syncLocalToCloud({ auto: true });
        return;
    }
    const choices = {};
    const res = await Swal.fire({
        title: 'Possible repeat patients',
        width: 640, showCancelButton: true, confirmButtonText: 'Save choices', cancelButtonText: opts.silent ? 'Later' : 'Cancel',
        showDenyButton: true, denyButtonText: 'Mark all as same person',
        html: `<div style="font-size:12px;text-align:left;color:#475569"><ul style="list-style:disc;padding-left:18px;margin:0 0 6px">
            <li>The laboratory number restarts every year, so these people have different numbers in different years.</li>
            <li>They were matched by name, sex and a similar age. Confirm only the ones that are the same person.</li>
            <li>A confirmed person gets one random code that is published instead of the name. Names stay on this device.</li>
            <li>${cands.length} possible repeat patient(s) to review. Anything you skip stays unlinked and is asked again next time.</li></ul>
            <div style="max-height:52vh;overflow:auto">${cands.map(plCardHtml).join('')}</div></div>`,
        didOpen: (el) => {
            const paint = () => el.querySelectorAll('.pl-card').forEach(card => {
                const ch = choices[cands[card.dataset.i].id];
                card.querySelectorAll('.pl-btn').forEach(b => { const on = b.dataset.v === ch; b.style.background = on ? (ch === 'same' ? '#0f766e' : '#64748b') : '#fff'; b.style.color = on ? '#fff' : '#334155'; });
            });
            el.addEventListener('click', (e) => {
                const b = e.target.closest('.pl-btn'); if (!b) return;
                const c = cands[b.closest('.pl-card').dataset.i];
                choices[c.id] = choices[c.id] === b.dataset.v ? undefined : b.dataset.v; paint();
            });
            const deny = Swal.getDenyButton(); if (deny) deny.addEventListener('click', () => { cands.forEach(c => { choices[c.id] = 'same'; }); paint(); }, true);
        },
        preDeny: () => false
    });
    if (!res.isConfirmed) return;
    const out = plApply(cands, choices);
    if (typeof syncLocalToCloud === 'function' && navigator.onLine) syncLocalToCloud({ auto: true });
    if (typeof initDataTable === 'function') try { initDataTable(); } catch (e) {}
    Swal.fire({ icon: 'success', title: 'Saved', text: out.same + ' person(s) linked, ' + out.diff + ' marked as different people.', timer: 2500, showConfirmButton: false });
}
