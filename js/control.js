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
    tabs: [['tab_year', 'Last Year'], ['tab_quarter', 'Last Quarter'], ['tab_month', 'Last Month'], ['tab_lab', 'Culture Overview']],
    analytics: [['sec_prevalence', 'Clinical Prevalence & AST Profile'], ['sec_patho', 'Bacteria / Fungi Susceptibility Profile'], ['sec_abx', 'Antimicrobial Efficacy Profile'], ['sec_heatmap', 'Advanced Cross-Search (Heatmaps)'], ['sec_mdr_panel', 'MDR / XDR / PDR Analysis']],
    content: [['show_amr', 'Critical Resistance Markers'], ['sec_pies', 'Blood and Urine prevalence'], ['sec_top5', 'Top 5 Specimens'], ['sec_mdr', 'MDR / XDR / PDR card'], ['sec_profiles', 'Resistance profiles (2 antibiotics)']]
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
        mobile_dash_fullyear: parseInt(s.mobile_dash_fullyear) || now.getFullYear() - 1,
        mobile_dash_quarter: /^Q[1-4]$/.test(s.mobile_dash_quarter) ? s.mobile_dash_quarter : lq.q,
        mobile_dash_year: parseInt(s.mobile_dash_year) || lq.y,
        mobile_dash_month: /^\d{4}-\d{2}$/.test(s.mobile_dash_month || '') ? s.mobile_dash_month : now.toISOString().slice(0, 7),
        dash_show_scope: s.dash_show_scope !== false,
        dash_default_scope: ['all', 'icu', 'nonicu'].includes(s.dash_default_scope) ? s.dash_default_scope : 'all',
        dash_default_period: ['month', 'quarter', 'year', 'all'].includes(s.dash_default_period) ? s.dash_default_period : 'month',
        dash_icu_wards: Array.isArray(s.dash_icu_wards) && s.dash_icu_wards.length ? s.dash_icu_wards.slice() : ['ICU'],
        profile1_abx: s.profile1_abx || 'Meropenem',
        profile2_abx: s.profile2_abx || 'Ceftriaxone',
        watchlist_bug: s.watchlist_bug || ''
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

function render() {
    const abx = (typeof abxList !== 'undefined' ? abxList : []).slice().sort();
    const orgs = (typeof bacteriaLibrary !== 'undefined' ? bacteriaLibrary.map(b => b.name) : []).slice().sort();
    const wards = [...new Set([...wardOptions, ...cur.dash_icu_wards])].sort();
    const open = $$('.card.open').map(c => c.dataset.card);

    const periods = `
        <div class="field"><label>Last Year tab</label>
            <div class="stepper"><button type="button" data-step="mobile_dash_fullyear" data-d="-1" aria-label="Previous year">&minus;</button>
            <input type="number" inputmode="numeric" data-k="mobile_dash_fullyear" value="${cur.mobile_dash_fullyear}"><button type="button" data-step="mobile_dash_fullyear" data-d="1" aria-label="Next year">+</button></div>
            <p class="hint">A full calendar year: the reference period for CLSI M39 and WHO GLASS reporting.</p></div>
        <div class="field"><label>Last Quarter tab</label>
            <div class="seg" id="qSeg">${['Q1', 'Q2', 'Q3', 'Q4'].map(q => `<button type="button" data-q="${q}" class="${cur.mobile_dash_quarter === q ? 'on' : ''}">${q}</button>`).join('')}</div>
            <div class="stepper" style="margin-top:8px"><button type="button" data-step="mobile_dash_year" data-d="-1" aria-label="Previous year">&minus;</button>
            <input type="number" inputmode="numeric" data-k="mobile_dash_year" value="${cur.mobile_dash_year}"><button type="button" data-step="mobile_dash_year" data-d="1" aria-label="Next year">+</button></div></div>
        <div class="field"><label>Last Month tab</label>
            <input type="month" class="input" data-k="mobile_dash_month" value="${cur.mobile_dash_month}"></div>`;

    const scope = `
        <div class="row" style="margin-top:4px"><span>Show the All / ICU / Non-ICU switch</span><label class="sw"><input type="checkbox" data-k="dash_show_scope" ${cur.dash_show_scope ? 'checked' : ''}><i></i></label></div>
        <div class="field"><label>Scope when the dashboard opens</label>
            <div class="seg" id="scopeSeg">${[['all', 'All units'], ['icu', 'ICU'], ['nonicu', 'Non-ICU']].map(([v, t]) => `<button type="button" data-scope="${v}" class="${cur.dash_default_scope === v ? 'on' : ''}">${t}</button>`).join('')}</div></div>
        <div class="field"><label>Default period for MDR and Culture Overview</label>
            <select class="select" data-k="dash_default_period">${[['month', 'Latest month'], ['quarter', 'Latest complete quarter'], ['year', 'Latest year'], ['all', 'All data']].map(([v, t]) => `<option value="${v}" ${cur.dash_default_period === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="field"><label>Wards counted as ICU</label>
            <div class="chips" id="wardChips">${wards.map(w => `<button type="button" class="wchip ${cur.dash_icu_wards.includes(w) ? 'on' : ''}" data-ward="${esc(w)}">${esc(w)}</button>`).join('')}</div>
            <p class="hint">Neonatal ICU is a separate unit. Leave it unselected to keep it out of the ICU view.</p></div>`;

    const profiles = `
        <div class="field"><label>Resistance profile 1</label><select class="select" data-k="profile1_abx">${optionList(abx, cur.profile1_abx)}</select></div>
        <div class="field"><label>Resistance profile 2</label><select class="select" data-k="profile2_abx">${optionList(abx, cur.profile2_abx)}</select></div>
        <div class="field"><label>Threat watchlist organism</label><select class="select" data-k="watchlist_bug">${optionList(orgs, cur.watchlist_bug, 'None (watchlist off)')}</select>
            <p class="hint">When this organism is detected in the selected period, the dashboard shows an alert card with its resistance profile.</p></div>`;

    $('#sections').innerHTML =
        card('periods', 'calendar', 'Reporting periods', periods) +
        card('tabs', 'tabs', 'Tabs', `<div>${toggleRows(TOGGLES.tabs)}</div>`) +
        card('analytics', 'chart', 'Analytics sections', `<div>${toggleRows(TOGGLES.analytics)}</div>`) +
        card('content', 'layers', 'Period tab content', `<div>${toggleRows(TOGGLES.content)}</div><p class="hint" style="margin-top:8px">Applies to the Last Year, Last Quarter and Last Month tabs.</p>`) +
        card('scope', 'building', 'Unit scope', scope) +
        card('profiles', 'flask', 'Profiles and watchlist', profiles);
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
    set('periods', `${cur.mobile_dash_fullyear}  ·  ${cur.mobile_dash_quarter} ${cur.mobile_dash_year}  ·  ${monthName(cur.mobile_dash_month)}`);
    set('tabs', count(TOGGLES.tabs));
    set('analytics', count(TOGGLES.analytics));
    set('content', count(TOGGLES.content));
    const sc = { all: 'All units', icu: 'ICU', nonicu: 'Non-ICU' }[cur.dash_default_scope];
    set('scope', (cur.dash_show_scope ? 'Switch visible' : 'Switch hidden') + `  ·  opens on ${sc}`);
    set('profiles', `${cur.profile1_abx}, ${cur.profile2_abx}` + (cur.watchlist_bug ? `  ·  ${cur.watchlist_bug}` : '  ·  watchlist off'));
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
    const q = e.target.closest('[data-q]');
    if (q) { cur.mobile_dash_quarter = q.dataset.q; $$('#qSeg button').forEach(b => b.classList.toggle('on', b === q)); refreshState(); return; }
    const sc = e.target.closest('[data-scope]');
    if (sc) { cur.dash_default_scope = sc.dataset.scope; $$('#scopeSeg button').forEach(b => b.classList.toggle('on', b === sc)); refreshState(); return; }
    const w = e.target.closest('[data-ward]');
    if (w) {
        const name = w.dataset.ward, list = cur.dash_icu_wards.slice(), i = list.indexOf(name);
        if (i >= 0) { if (list.length === 1) { toast('At least one ICU ward is required.'); return; } list.splice(i, 1); } else list.push(name);
        cur.dash_icu_wards = list; w.classList.toggle('on', i < 0); refreshState();
    }
});
document.addEventListener('change', e => {
    const el = e.target.closest('[data-k]');
    if (!el) return;
    const k = el.dataset.k;
    if (el.type === 'checkbox') setVal(k, el.checked);
    else if (k === 'mobile_dash_fullyear' || k === 'mobile_dash_year') {
        const v = parseInt(el.value);
        if (!v || v < 2000 || v > 2100) { el.value = cur[k]; toast('Enter a valid year (2000-2100).'); return; }
        setVal(k, v);
    } else if (k === 'mobile_dash_month') {
        if (!/^\d{4}-\d{2}$/.test(el.value)) { el.value = cur[k]; return; }
        setVal(k, el.value);
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
        const stamp = firebase.firestore.FieldValue.serverTimestamp();
        const batch = db.batch();
        batch.set(db.collection('amr_sync').doc('hospital_main'), { settings: merged, settings_updated: stamp }, { merge: true });
        batch.set(db.collection('amr_public').doc('dashboard'), { settings: merged, settings_updated: stamp }, { merge: true });
        await batch.commit();
        rawSettings = merged; base = JSON.parse(JSON.stringify(cur));
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
        wardOptions = (pub.exists && Array.isArray(pub.data().wards) && pub.data().wards.length ? pub.data().wards : (typeof defaultWards !== 'undefined' ? defaultWards : [])).slice();
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
