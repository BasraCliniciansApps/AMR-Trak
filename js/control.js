// Dashboard Control: standalone mobile page that edits the settings of the public mobile dashboard.
// It only writes the "settings" field of the two cloud meta documents; records are never touched.

const firebaseConfig = {
    apiKey: "AIzaSyCyWcTzvYXwsYQEgs_iNh_Co68H9_2kYU4",
    authDomain: "antibiogramtrak.firebaseapp.com",
    projectId: "antibiogramtrak",
    storageBucket: "antibiogramtrak.firebasestorage.app",
    messagingSenderId: "679667156703",
    appId: "1:679667156703:web:ca37e1544e3d20e922cb6a"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------------------------------------------------------- configuration
const TOGGLES = {
    tabs: [['tab_year', 'Annual Report'], ['tab_month', 'Monthly Alerts'], ['tab_lab', 'Culture Overview']],
    analytics: [['sec_prevalence', 'Clinical Prevalence & AST Profile'], ['sec_patho', 'Bacteria / Fungi Susceptibility Profile'], ['sec_abx', 'Antimicrobial In Vitro Activity Profile'], ['sec_heatmap', 'Advanced Cross-Search (Heatmaps)'], ['sec_mdr_panel', 'MDR / XDR / PDR Analysis']],
    content: [['sec_mdr', 'MDR / XDR / PDR card']]
};
const ALL_TOGGLE_KEYS = [].concat(TOGGLES.tabs, TOGGLES.analytics, TOGGLES.content).map(x => x[0]);

const ICONS = {
    calendar: '<path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>',
    tabs: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v6"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15v3M12 9v9M17 5v13"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7l10-5z"/><path d="m2 12 10 5 10-5"/><path d="m2 17 10 5 10-5"/>',
    building: '<path d="M3 21h18M5 21V7l7-4 7 4v14"/><path d="M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01"/>',
    flask: '<path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9V3"/><path d="M7.5 15h9"/>',
    chev: '<path d="m6 9 6 6 6-6"/>'
};
const svg = (n, cls) => `<svg ${cls ? `class="${cls}"` : ''} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[n]}</svg>`;

// ---------------------------------------------------------------- state
let rawSettings = {};            // everything stored in the cloud (unknown keys are preserved on save)
let base = null;                 // normalised settings as last saved
let cur = null;                  // normalised settings being edited
let wardOptions = [];
let loaded = false;

function lastCompleteQuarter() {
    const d = new Date(), m = d.getMonth();            // 0-11
    let q = Math.floor(m / 3), y = d.getFullYear();    // current quarter 0-3
    q -= 1; if (q < 0) { q = 3; y -= 1; }
    return { q: 'Q' + (q + 1), y };
}
function normalise(s) {
    s = s || {};
    const now = new Date(), lq = lastCompleteQuarter();
    const o = {
        mobile_dash_lastmonth: /^\d{4}-\d{2}$/.test(s.mobile_dash_lastmonth || '') ? s.mobile_dash_lastmonth : '',
        mobile_dash_nocontam: s.mobile_dash_nocontam === true,
        dash_an_period: ['year', 'all', 'calyear', 'quarter', 'month'].includes(s.dash_an_period) ? s.dash_an_period : 'year',
        dash_ya_mode: s.dash_ya_mode === 'rolling' ? 'rolling' : 'calendar',
        dash_dedup_mode: s.dash_dedup_mode === 'calyear' ? 'calyear' : 'block',
        dash_show_notes: s.dash_show_notes !== false,
        dash_show_scope: s.dash_show_scope !== false,
        dash_default_scope: ['all', 'icu', 'nonicuip', 'outpatient', 'nonicu'].includes(s.dash_default_scope) ? (s.dash_default_scope === 'nonicu' ? 'nonicuip' : s.dash_default_scope) : 'all',
        dash_default_period: ['month', 'quarter', 'year', 'all'].includes(s.dash_default_period) ? s.dash_default_period : 'month',
        dash_icu_wards: Array.isArray(s.dash_icu_wards) && s.dash_icu_wards.length ? s.dash_icu_wards.slice() : ['ICU'],
        profile1_abx: s.profile1_abx || 'Meropenem',
        profile2_abx: s.profile2_abx || 'Ceftriaxone'
    };
    ALL_TOGGLE_KEYS.forEach(k => { o[k] = s[k] !== false; });
    return o;
}
const same = (a, b) => JSON.stringify(a, Object.keys(a).sort()) === JSON.stringify(b, Object.keys(b).sort());
const isDirty = () => loaded && !same(cur, base);

// ---------------------------------------------------------------- rendering
function toggleRows(list) {
    return list.map(([k, label]) => `<div class="row"><span>${esc(label)}</span><label class="sw"><input type="checkbox" data-k="${k}" ${cur[k] ? 'checked' : ''}><i></i></label></div>`).join('');
}
function optionList(values, selected, emptyLabel) {
    const set = new Set(values);
    if (selected && !set.has(selected)) values = [selected].concat(values);
    return (emptyLabel !== undefined ? `<option value="">${esc(emptyLabel)}</option>` : '') +
        values.map(v => `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>${esc(v)}</option>`).join('');
}
function card(id, icon, title, body) {
    return `<section class="card" id="card_${id}" data-card="${id}">
        <button type="button" class="card-head" data-toggle="${id}">
            <span class="tile">${svg(icon)}</span>
            <span style="flex:1;min-width:0"><div class="card-title">${esc(title)}</div><div class="card-sum" id="sum_${id}"></div></span>
            ${svg('chev', 'chev')}
        </button>
        <div class="card-body">${body}</div>
    </section>`;
}

function wardSummary(l) { return !l.length ? 'No ward selected' : l.length <= 2 ? l.join(', ') : l.length + ' wards selected'; }
function render() {
    const abx = (typeof abxList !== 'undefined' ? abxList : []).slice().sort();
    const orgs = (typeof bacteriaLibrary !== 'undefined' ? bacteriaLibrary.map(b => b.name) : []).slice().sort();
    const wards = [...new Set([...wardOptions, ...cur.dash_icu_wards])].sort();
    const open = $$('.card.open').map(c => c.dataset.card);

    const periods = `
        <div class="field"><label>Report period</label><p class="hint">Every period in the dashboard ends automatically at the latest month that has data.</p></div>
        <div class="field"><label>Analysis period (Analytics tab)</label>
            <select class="select" data-k="dash_an_period">${[['year', 'Last 12 Months'], ['all', 'All Times (complete years)'], ['calyear', 'Last complete calendar year'], ['quarter', 'Last 3 Months'], ['month', 'Last Month']].map(([v, t]) => `<option value="${v}" ${cur.dash_an_period === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
            <p class="hint">Default for every user. A user can change it for their own device from the gear button.</p></div>
        <div class="field"><label>Annual Report tab period</label>
            <select class="select" data-k="dash_ya_mode">${[['calendar', 'Calendar year'], ['rolling', 'Last 12 months']].map(([v, t]) => `<option value="${v}" ${cur.dash_ya_mode === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="field"><label>Repeat patient in a period that crosses New Year</label>
            <select class="select" data-k="dash_dedup_mode">${[['block', 'Count once (first isolate only)'], ['calyear', 'Count once in each calendar year']].map(([v, t]) => `<option value="${v}" ${cur.dash_dedup_mode === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
            <p class="hint">Applies to periods that cross New Year (Last 12 Months, All Times, a specific period) for patients linked across years in the importer. Each user can change it for their own device from the gear button, where the (i) button explains both options.</p></div>
        <div class="row"><span>Exclude possible skin-flora contaminants</span><label class="sw"><input type="checkbox" data-k="mobile_dash_nocontam" ${cur.mobile_dash_nocontam ? 'checked' : ''}><i></i></label></div>
        <div class="row"><span>Show explanation notes under charts</span><label class="sw"><input type="checkbox" data-k="dash_show_notes" ${cur.dash_show_notes ? 'checked' : ''}><i></i></label></div>
        <p class="hint">These are the defaults for all users. Each user can change them for their own device only, from the gear button.</p>`;

    const scope = `
        <div class="row" style="margin-top:4px"><span>Show the All / ICU / Non-ICU switch</span><label class="sw"><input type="checkbox" data-k="dash_show_scope" ${cur.dash_show_scope ? 'checked' : ''}><i></i></label></div>
        <div class="field"><label>Scope when the dashboard opens</label>
            <div class="seg" id="scopeSeg">${[['all', 'ALL'], ['icu', 'ICU'], ['nonicuip', 'Non-ICU IP'], ['outpatient', 'Outpatient']].map(([v, t]) => `<button type="button" data-scope="${v}" class="${cur.dash_default_scope === v ? 'on' : ''}">${t}</button>`).join('')}</div></div>
        <div class="field"><label>Default period for MDR and Culture Overview</label>
            <select class="select" data-k="dash_default_period">${[['month', 'Latest month'], ['quarter', 'Latest 3 months'], ['year', 'Latest year'], ['all', 'All data']].map(([v, t]) => `<option value="${v}" ${cur.dash_default_period === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="field"><label>Wards counted as ICU</label>
            <button type="button" class="wd-btn" id="wardBtn" aria-expanded="false"><span id="wardSummary">${esc(wardSummary(cur.dash_icu_wards))}</span><span aria-hidden="true">&#9662;</span></button>
            <div class="wd-list" id="wardList">${wards.map(w => `<label class="wd-row"><input type="checkbox" data-ward="${esc(w)}" ${cur.dash_icu_wards.includes(w) ? 'checked' : ''}><span>${esc(w)}</span></label>`).join('')}</div>
            <p class="hint">Neonatal ICU is a separate unit. Leave it unselected to keep it out of the ICU view.</p></div>`;

    $('#sections').innerHTML =
        card('periods', 'calendar', 'Reporting periods', periods) +
        card('tabs', 'tabs', 'Tabs', `<div>${toggleRows(TOGGLES.tabs)}</div>`) +
        card('analytics', 'chart', 'Analytics sections', `<div>${toggleRows(TOGGLES.analytics)}</div>`) +
        card('content', 'layers', 'Period tab content', `<div>${toggleRows(TOGGLES.content)}</div><p class="hint" style="margin-top:8px">Applies to the Annual Report tab.</p>`) +
        card('scope', 'building', 'Unit scope', scope);
    open.forEach(id => $('#card_' + id) && $('#card_' + id).classList.add('open'));
    summaries();
}

function monthName(ym) {
    const [y, m] = ym.split('-').map(Number);
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1] + ' ' + y;
}
function count(list) { const on = list.filter(([k]) => cur[k]).length; return `${on} of ${list.length} shown`; }
function summaries() {
    if (!cur) return;
    const set = (id, t) => { const el = $('#sum_' + id); if (el) el.textContent = t; };
    set('periods', 'Latest month with data');
    set('tabs', count(TOGGLES.tabs));
    set('analytics', count(TOGGLES.analytics));
    set('content', count(TOGGLES.content));
    const sc = { all: 'All units', icu: 'ICU', nonicu: 'Non-ICU' }[cur.dash_default_scope];
    set('scope', (cur.dash_show_scope ? 'Switch visible' : 'Switch hidden') + `  ·  opens on ${sc}`);
}

function refreshState() {
    const chip = $('#stateChip'), txt = $('#stateText');
    const dirty = isDirty();
    chip.className = 'chip ' + (!loaded ? '' : dirty ? 'dirty' : 'ok');
    txt.textContent = !loaded ? 'Loading' : dirty ? 'Unsaved changes' : 'Saved';
    $('#saveBtn').disabled = !dirty;
    $('#discardBtn').disabled = !dirty;
    summaries();
}

// ---------------------------------------------------------------- events
function setVal(k, v) { cur[k] = v; refreshState(); }

document.addEventListener('click', e => {
    const head = e.target.closest('[data-toggle]');
    if (head) { $('#card_' + head.dataset.toggle).classList.toggle('open'); return; }
    const step = e.target.closest('[data-step]');
    if (step) {
        const k = step.dataset.step, v = Math.min(2100, Math.max(2000, (parseInt(cur[k]) || new Date().getFullYear()) + parseInt(step.dataset.d)));
        cur[k] = v; $(`input[data-k="${k}"]`).value = v; refreshState(); return;
    }
    if (e.target.id === 'clearLastMonth') { setVal('mobile_dash_lastmonth', ''); const inp = $('input[data-k="mobile_dash_lastmonth"]'); if (inp) inp.value = ''; return; }

    const sc = e.target.closest('[data-scope]');
    if (sc) { cur.dash_default_scope = sc.dataset.scope; $$('#scopeSeg button').forEach(b => b.classList.toggle('on', b === sc)); refreshState(); return; }
    if (e.target.closest('#wardBtn')) { const l = $('#wardList'), o = l.classList.toggle('open'); $('#wardBtn').setAttribute('aria-expanded', o); return; }
});
document.addEventListener('change', e => {
    const wc = e.target.closest('input[data-ward]');
    if (wc) {
        const name = wc.dataset.ward, list = cur.dash_icu_wards.filter(x => x !== name);
        if (wc.checked) list.push(name);
        else if (!list.length) { wc.checked = true; toast('At least one ICU ward is required.'); return; }
        cur.dash_icu_wards = list; $('#wardSummary').textContent = wardSummary(list); refreshState(); return;
    }
    const el = e.target.closest('[data-k]');
    if (!el) return;
    const k = el.dataset.k;
    if (el.type === 'checkbox') setVal(k, el.checked);
    else if (k === 'mobile_dash_lastmonth') {
        if (el.value && !/^\d{4}-\d{2}$/.test(el.value)) { el.value = cur[k]; return; }
        setVal(k, el.value || '');
    } else setVal(k, el.value);
});

// ---------------------------------------------------------------- save / discard
function busy(on) { $('#progress').classList.toggle('on', on); $('#saveBtn').textContent = on ? 'Publishing...' : 'Save and publish'; if (on) $('#saveBtn').disabled = true; }
let toastTimer = null;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600); }

$('#saveBtn').addEventListener('click', async () => {
    if (!isDirty()) return;
    if (!navigator.onLine) { toast('You are offline. Connect to the internet and try again.'); return; }
    busy(true);
    try {
        const merged = Object.assign({}, rawSettings, cur);
        merged._ts = Date.now();   // last change wins: the data-entry app keeps whichever copy has the newer stamp
        const stamp = firebase.firestore.FieldValue.serverTimestamp();
        const batch = db.batch();
        batch.set(db.collection('amr_sync').doc('hospital_main'), { settings: merged, settings_updated: stamp }, { merge: true });
        batch.set(db.collection('amr_public').doc('dashboard'), { settings: merged, settings_updated: stamp }, { merge: true });
        await batch.commit();
        rawSettings = merged; base = JSON.parse(JSON.stringify(cur));
        try { localStorage.setItem('amr_live_settings', JSON.stringify(merged)); } catch (e) {}   // same-device copy (dashboard, data-entry app)
        try { if (window.parent !== window) window.parent.postMessage({ type: 'amr-settings', settings: merged }, location.origin); } catch (e) {}
        toast('Published. The dashboard updates automatically.');
    } catch (err) {
        console.error(err);
        const denied = /permission/i.test(String(err && (err.code || err.message)));
        Swal.fire({ icon: 'error', title: 'Could not publish', text: denied ? 'This account is not allowed to change the dashboard settings.' : 'Please check your connection and try again.', confirmButtonColor: '#0f766e' });
    } finally { busy(false); refreshState(); }
});

$('#discardBtn').addEventListener('click', async () => {
    if (!isDirty()) return;
    const r = await Swal.fire({ title: 'Discard changes?', text: 'Your edits will be reset to the last saved settings.', icon: 'question', showCancelButton: true, confirmButtonText: 'Discard', cancelButtonText: 'Keep editing', confirmButtonColor: '#dc2626' });
    if (r.isConfirmed) { cur = JSON.parse(JSON.stringify(base)); render(); refreshState(); }
});

$('#signOutBtn').addEventListener('click', async () => {
    if (isDirty()) {
        const r = await Swal.fire({ title: 'Sign out?', text: 'You have unsaved changes that will be lost.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sign out', cancelButtonText: 'Stay', confirmButtonColor: '#dc2626' });
        if (!r.isConfirmed) return;
    }
    auth.signOut();
});
window.addEventListener('beforeunload', e => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });

// ---------------------------------------------------------------- sign in and load
$('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('#loginError'); err.classList.add('hidden');
    $('#progress').classList.add('on');
    try { await auth.signInWithEmailAndPassword($('#loginEmail').value.trim(), $('#loginPass').value); }
    catch (ex) { err.textContent = 'Incorrect email or password.'; err.classList.remove('hidden'); }
    finally { $('#progress').classList.remove('on'); }
});

async function loadSettings() {
    loaded = false; refreshState();
    $('#loadingBox').classList.remove('hidden'); $('#errorBox').classList.add('hidden'); $('#sections').classList.add('hidden');
    $('#progress').classList.add('on');
    try {
        const [priv, pub] = await Promise.all([db.collection('amr_sync').doc('hospital_main').get(), db.collection('amr_public').doc('dashboard').get()]);
        rawSettings = (priv.exists && priv.data().settings) || (pub.exists && pub.data().settings) || {};
        const ws = new Set((pub.exists && Array.isArray(pub.data().wards) ? pub.data().wards : []).concat(typeof defaultWards !== 'undefined' ? defaultWards : []));
        try {   // wards actually present in the published data, so no Publish is needed for new ward names
            const snap = await db.collection('amr_public').get();
            snap.forEach(d => { if (/^r_/.test(d.id)) (d.data().records || []).forEach(r => { if (r && r.Ward && r.Ward !== '-') ws.add(String(r.Ward).trim()); }); });
        } catch (e) { console.warn('ward scan', e); }
        wardOptions = Array.from(ws).filter(Boolean);
        base = normalise(rawSettings); cur = JSON.parse(JSON.stringify(base));
        loaded = true;
        $('#loadingBox').classList.add('hidden'); $('#sections').classList.remove('hidden');
        render(); refreshState();
    } catch (ex) {
        console.error(ex);
        const denied = /permission/i.test(String(ex && (ex.code || ex.message)));
        const box = $('#errorBox'); box.classList.remove('hidden'); $('#loadingBox').classList.add('hidden');
        box.textContent = denied ? 'This account is not allowed to open the dashboard settings.' : 'The settings could not be loaded. Check your connection and reload the page.';
    } finally { $('#progress').classList.remove('on'); }
}

auth.onAuthStateChanged(user => {
    $('#loginView').classList.toggle('hidden', !!user);
    $('#appView').classList.toggle('hidden', !user);
    if (user) loadSettings(); else { loaded = false; }
});

if (/[?&]embedded=1/.test(location.search)) { document.body.classList.add('embedded'); const so = document.getElementById('signOutBtn'); if (so) so.style.display = 'none'; }
