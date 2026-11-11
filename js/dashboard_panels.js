// =====================================================================
// Dashboard panels: display settings, ICU / non-ICU scope, period pickers,
// MDR / XDR / PDR analysis panel and the Culture Overview tab.
// Loaded after dashboard.js (shares its globals).
// =====================================================================

setInfo('scope', 'Unit scope', `<p>The buttons at the top filter every chart on the dashboard by the ward where the specimen was collected.</p>
<ul><li><b>All units:</b> every ward, including outpatients.</li><li><b>ICU:</b> only the wards counted as intensive care units. The list is set by the surveillance programme; neonatal and paediatric ICUs are included only if they are selected.</li><li><b>Non-ICU:</b> all other wards, including outpatients and neonatal units.</li></ul>
<p><b>Why separate ICU?</b> Antimicrobial exposure, invasive device use and patient risk differ between intensive care and other wards, so pooled results can hide ICU-specific resistance. CLSI M39 supports stratifying cumulative susceptibility data by patient location.</p>
<p>First-isolate de-duplication is applied within the selected scope.</p>`);

// ---------- settings (written by the data-entry app, delivered in the public document) ----------
function getDashSettings() {
    try { return JSON.parse(localStorage.getItem('amr_live_settings')) || {}; } catch (e) { return {}; }
}
// The month all period windows end at: the latest month with data (automatic)
function dashAnchor(records) {
    let latest = '';
    (records || getDashRecords()).forEach(r => { const d = String(r.Date || '').slice(0, 7); if (/^\d{4}-\d{2}$/.test(d) && d > latest) latest = d; });
    return latest;
}
// Last complete calendar year at or before the anchor month
function dashCalendarYear(records) {
    const a = dashAnchor(records);
    if (!a) return String(new Date().getFullYear() - 1);
    return String(a.slice(5, 7) === '12' ? parseInt(a.slice(0, 4), 10) : parseInt(a.slice(0, 4), 10) - 1);
}
function dashFlag(key) { return getDashSettings()[key] !== false; }
function icuWardList() {
    const w = getDashSettings().dash_icu_wards;
    return (Array.isArray(w) && w.length) ? w : ['ICU'];
}

// ---------- unit scope: All units / ICU only / Non-ICU ----------
let _unitScope = null;
function getUnitScope() { const s = _unitScope || getUserPrefs().scope || getDashSettings().dash_default_scope || 'all'; return s === 'nonicu' ? 'nonicuip' : s; }
// Unit filter values:
//   all        : every ward
//   icu        : ICU wards only
//   nonicuip   : Non-ICU inpatient wards (IP). Emergency is not inpatient.
//   outpatient : everything that is not inpatient (outpatient clinics, emergency, unassigned)
//   nonicu     : every non-ICU ward, used only for the ICU vs non-ICU comparison tables
function wardInScope(ward, scope) {
    // Records without a ward cannot be placed in any unit: they are excluded from every unit view and counted only in Data quality (CLSI M39 Section 11.1: predetermined patient types)
    if (wardClass(ward) === 'unassigned') return false;
    if (scope === 'all') return true;
    const isIcu = icuWardList().some(w => String(w).toLowerCase() === String(ward || '').toLowerCase());
    if (scope === 'icu') return isIcu;
    if (scope === 'nonicu') return !isIcu;
    const inpatient = isIcu || wardClass(ward) === 'inpatient';
    if (scope === 'nonicuip') return !isIcu && wardClass(ward) === 'inpatient';
    if (scope === 'outpatient') return !inpatient && wardClass(ward) !== 'unclassified';
    return true;
}
// Applies the unit filter to records that are already de-duplicated (see applyDeduplication)
function scopeRecs(recs) { const s = getUnitScope(); return s === 'all' ? recs : recs.filter(r => wardInScope(r.Ward, s)); }
// Warning under every Analytics chart: the results follow the single unit filter at the top of the dashboard
function periodText() {
    const t = (typeof anPeriod === 'function') ? anPeriod() : 'year', u = getUserPrefs();
    let w = null; try { w = periodWindow(getDashRecords(), t); } catch (e) {}
    const lab = w ? ' (' + w.label + ')' : '';
    if (t === 'calyear') return 'calendar year ' + (w ? w.label : (u.pyear || ''));
    if (t === 'range') return 'from ' + (w ? w.label : '');
    if (t === 'all') return 'all completed years combined (consecutive years)';
    if (t === 'alltimes') return 'all available data combined (may include incomplete years)';
    return ({ year: 'last 12 months', quarter: 'last 3 months', month: 'last month' })[t] + lab;
}
function scopeShort() { const s = getUnitScope(); return s === 'icu' ? 'ICU' : s === 'nonicuip' ? 'Non-ICU inpatients' : s === 'outpatient' ? 'Outpatient (with emergency)' : 'All units'; }
// custom = period text when a chart has its own dates (the Heatmap From/To)
// Footnote required by CLSI M39 Section 6.4 when several years are analysed together
function combinedYearsNote() {
    try {
        const t = anPeriod(), recs = getDashRecords();
        let ys = 0;
        if (t === 'all') ys = completeYearsInfo(recs.filter(r => !r.Date || String(r.Date).slice(0, 7) <= dashAnchor(recs))).complete.length;
        else if (t === 'alltimes') { const yy = recs.map(r => String(r.Date || '').slice(0, 4)).filter(y => /^\d{4}$/.test(y)).sort(); ys = yy.length ? parseInt(yy[yy.length - 1], 10) - parseInt(yy[0], 10) + 1 : 0; }
        else if (t === 'range') { const w = periodWindow(recs, t); if (w) { const m = (parseInt(w.to.slice(0, 4), 10) - parseInt(w.from.slice(0, 4), 10)) * 12 + parseInt(w.to.slice(5, 7), 10) - parseInt(w.from.slice(5, 7), 10) + 1; ys = m > 12 ? Math.ceil(m / 12) : 0; } }
        return ys > 1 ? 'Combined data: ' + ys + ' years analysed together (first isolate per patient per 12-month block; CLSI M39 &sect;6.4). Interpret trends and changes over time with caution.' : '';
    } catch (e) { return ''; }
}
function scopeBanner(custom) {
    const lines = ['<b>Showing: ' + scopeShort() + ' &middot; ' + (custom || periodText()) + '</b>',
        'Unit: change it with the buttons at the top of the page.',
        custom ? 'Period: set by the From and To dates of this search.' : 'Period: change it in Settings (gear button).',
        'Records without a ward, or from a ward without a unit rule, are excluded from the unit views and counted in Data quality.'];
    const cn = custom ? '' : combinedYearsNote(); if (cn) lines.push('<b>' + cn + '</b>');
    return '<div class="scope-note" style="font-size:11px;line-height:1.45;background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;padding:8px 10px;color:#3730a3;margin-top:10px"><ul class="note-list keep" style="margin:0">' + lines.map(t => '<li>' + t + '</li>').join('') + '</ul></div>';
}
function scopeLabel() { const s = getUnitScope(); return s === 'icu' ? 'ICU' : s === 'nonicuip' ? 'Non-ICU IP (inpatient, excluding emergency)' : s === 'outpatient' ? 'Outpatient (including emergency)' : 'ALL'; }
// Every chart reads records through this function so the scope applies everywhere.
// Returns every record (no unit filter). Isolate analyses apply the unit filter inside applyDeduplication, after the first isolate is chosen.
function getDashRecords() {
    let all = [];
    try { all = JSON.parse(localStorage.getItem('amr_dash_records')) || []; } catch (e) {}
    return all;
}
function getAllDashRecordsUnscoped() {
    try { return (JSON.parse(localStorage.getItem('amr_dash_records')) || []); } catch (e) { return []; }
}
window.setUnitScope = function (v) {
    _unitScope = v;
    refreshAll();
};
function updateScopeBar() {
    const scope = getUnitScope();
    $('.scope-btn').each(function () {
        const on = $(this).data('scope') === scope;
        $(this).toggleClass('bg-white text-teal-700 shadow-sm', on).toggleClass('text-slate-500', !on);
    });
}

function applyDashboardSettings() {
    const s = getDashSettings();
    $('[data-sec]').each(function () {
        $(this).toggleClass('sec-off', s['sec_' + $(this).data('sec')] === false);
    });
    [['year', 'LastYear'], ['month', 'LastMonth'], ['lab', 'Lab']].forEach(([t, id]) => {
        $('#btnNav' + id).toggleClass('sec-off', s['tab_' + t] === false);
    });
    $('#ya_card_mdr').toggleClass('sec-off', s.sec_mdr === false);          // the annual MDR card follows the same switch
    $('#scopeBar').toggleClass('sec-off', s.dash_show_scope === false);
    updateScopeBar();
    // leave a tab that was switched off
    const cur = window._currentTab || 'analytics';
    if ((cur === 'last_year' && s.tab_year === false) || (cur === 'last_month' && s.tab_month === false) || (cur === 'lab' && s.tab_lab === false)) switchTab('analytics');
}

function refreshAll() {
    applyDashboardSettings();
    try { loadAnalyticsFilters(); } catch (e) { console.error(e); }
    // The unit scope applies to every Analytics chart, so the open ones are redrawn with the new scope
    try { updatePathoDropdowns(); } catch (e) { console.error(e); }
    try { updateAbxDropdowns(); } catch (e) { console.error(e); }
    try { if (!$('#advContainer').hasClass('hidden') && $('#advContainer').children().length) generateAdvancedAnalytics(); } catch (e) { console.error(e); }
    try { if (!$('#an_cum_content').hasClass('hidden')) refreshSpecimenSelects(); } catch (e) {}
    try { if (typeof anCumRender === 'function') anCumRender(); } catch (e) { console.error(e); }
    try { generateLiveSurveillance(); } catch (e) { console.error(e); }
    try { renderMdrPanel(); } catch (e) { console.error(e); }
    try { renderLabQuality(); } catch (e) { console.error(e); }
    try { renderAnnualReport(); } catch (e) { console.error(e); }
    try { renderPeriodPanels(); } catch (e) { console.error(e); }
    try { updatePeriodTags(); } catch (e) { console.error(e); }
}

// ---------- tabs ----------
window.switchTab = function (tab) {
    window._currentTab = tab;
    $('#viewAnalytics, #viewLastYear, #viewLastMonth, #viewMdr, #viewLab').addClass('hidden');
    $('#btnNavAnalytics, #btnNavLastYear, #btnNavLastMonth, #btnNavMdr, #btnNavLab').removeClass('active');
    if (tab === 'analytics') {
        $('#viewAnalytics').removeClass('hidden'); $('#btnNavAnalytics').addClass('active');
        $('#headerTitle').text('Surveillance Analytics');
        if (!isUpdatingFilters) loadAnalyticsFilters();
    } else if (tab === 'last_year') {
        $('#viewLastYear').removeClass('hidden'); $('#btnNavLastYear').addClass('active');
        $('#headerTitle').text('Annual Report');
    } else if (tab === 'last_month') {
        $('#viewLastMonth').removeClass('hidden'); $('#btnNavLastMonth').addClass('active');
        $('#headerTitle').text('Monthly Alerts');
    } else if (tab === 'mdr') {
        $('#viewMdr').removeClass('hidden'); $('#btnNavMdr').addClass('active');
        $('#headerTitle').text('MDR / XDR / PDR');
        try { renderMdrPanel(); } catch (e) { console.error(e); }
        try { window.dispatchEvent(new Event('resize')); } catch (e) {}
    } else if (tab === 'lab') {
        $('#viewLab').removeClass('hidden'); $('#btnNavLab').addClass('active');
        $('#headerTitle').text('Culture Overview');
        renderLabQuality();
    }
    const btn = document.querySelector('.nav-btn.active');
    if (btn && btn.scrollIntoView) btn.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
};

// ---------- period picker (month / quarter / year / custom range / all) ----------
const PERIOD_STATE = {};
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function availableMonths() {
    const set = new Set();
    getAllDashRecordsUnscoped().forEach(r => { if (r.Date && /^\d{4}-\d{2}/.test(r.Date)) set.add(r.Date.slice(0, 7)); });
    try { Object.keys(getLabData().months || {}).forEach(m => set.add(m)); } catch (e) {}
    return [...set].sort();
}
function monthLabel(m) { return MONTH_NAMES[parseInt(m.slice(5, 7), 10) - 1] + ' ' + m.slice(0, 4); }
function completeQuarterOf(latest) {
    let y = parseInt(latest.slice(0, 4), 10), mo = parseInt(latest.slice(5, 7), 10);
    let q = Math.ceil(mo / 3);
    if (mo % 3 !== 0) { q -= 1; if (q === 0) { q = 4; y -= 1; } }
    return { y, q };
}
function initPeriodState(id, months) {
    const defNow = getDashSettings().dash_default_period || '';
    if (PERIOD_STATE[id] && PERIOD_STATE[id]._def === defNow) return PERIOD_STATE[id];   // a changed default (from the Control page) applies without a reload
    const latest = months[months.length - 1] || new Date().toISOString().slice(0, 7);
    const cq = completeQuarterOf(latest);
    const def = getDashSettings().dash_default_period;
    PERIOD_STATE[id] = {
        type: ['month', 'quarter', 'year', 'range', 'all'].includes(def) ? def : 'month',
        month: latest, qYear: cq.y, q: cq.q, year: latest.slice(0, 4),
        from: months[Math.max(0, months.length - 6)] || latest, to: latest, _def: defNow
    };
    return PERIOD_STATE[id];
}
function periodRange(st, months) {
    const first = months[0] || st.month, last = months[months.length - 1] || st.month;
    if (st.type === 'month') return { from: st.month, to: st.month, label: monthLabel(st.month) };
    if (st.type === 'quarter') {
        const m1 = String((st.q - 1) * 3 + 1).padStart(2, '0'), m3 = String(st.q * 3).padStart(2, '0');
        return { from: `${st.qYear}-${m1}`, to: `${st.qYear}-${m3}`, label: `Q${st.q} ${st.qYear}` };
    }
    if (st.type === 'year') return { from: `${st.year}-01`, to: `${st.year}-12`, label: String(st.year) };
    if (st.type === 'range') { const a = st.from <= st.to ? st.from : st.to, b = st.from <= st.to ? st.to : st.from; return { from: a, to: b, label: `${monthLabel(a)} - ${monthLabel(b)}` }; }
    return { from: first, to: last, label: 'All data' };
}
function monthsBetween(a, b) {
    const out = [];
    let y = parseInt(a.slice(0, 4), 10), m = parseInt(a.slice(5, 7), 10);
    const ey = parseInt(b.slice(0, 4), 10), em = parseInt(b.slice(5, 7), 10);
    while ((y < ey || (y === ey && m <= em)) && out.length < 120) {
        out.push(`${y}-${String(m).padStart(2, '0')}`);
        m++; if (m > 12) { m = 1; y++; }
    }
    return out;
}
function renderPeriodPicker(id, onChange) {
    const months = availableMonths();
    const st = initPeriodState(id, months);
    const years = [...new Set(months.map(m => m.slice(0, 4)))];
    if (!years.length) years.push(String(new Date().getFullYear()));
    const sel = (cls, opts, cur) => `<select class="${cls} w-full border border-slate-300 rounded-lg p-2 text-xs bg-white">${opts.map(o => `<option value="${o[0]}" ${String(o[0]) === String(cur) ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>`;
    const monthOpts = [...months].reverse().map(m => [m, monthLabel(m)]);
    const yearOpts = years.slice().reverse().map(y => [y, y]);
    let pickers = '';
    if (st.type === 'month') pickers = sel('pp-month', monthOpts, st.month);
    else if (st.type === 'quarter') pickers = `<div class="flex gap-2"><div class="w-1/2">${sel('pp-qyear', yearOpts, st.qYear)}</div><div class="w-1/2">${sel('pp-q', [[1, 'Q1 (Jan-Mar)'], [2, 'Q2 (Apr-Jun)'], [3, 'Q3 (Jul-Sep)'], [4, 'Q4 (Oct-Dec)']], st.q)}</div></div>`;
    else if (st.type === 'year') pickers = sel('pp-year', yearOpts, st.year);
    else if (st.type === 'range') pickers = `<div class="flex gap-2"><div class="w-1/2">${sel('pp-from', monthOpts.slice().reverse(), st.from)}</div><div class="w-1/2">${sel('pp-to', monthOpts.slice().reverse(), st.to)}</div></div>`;
    const types = [['month', 'Month'], ['quarter', 'Quarter'], ['year', 'Year'], ['range', 'Range'], ['all', 'All']];
    const bar = types.map(t => `<button type="button" data-pt="${t[0]}" class="pp-type flex-1 text-[10px] font-bold py-1.5 rounded-md transition-all ${st.type === t[0] ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'}">${t[1]}</button>`).join('');
    const $c = $('#' + id + '_picker');
    $c.html(`<div class="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 shadow-inner w-full mb-2">${bar}</div>${pickers}`);
    $c.find('.pp-type').on('click', function () { st.type = $(this).data('pt'); renderPeriodPicker(id, onChange); onChange(); });
    $c.find('.pp-month').on('change', function () { st.month = this.value; onChange(); });
    $c.find('.pp-qyear').on('change', function () { st.qYear = parseInt(this.value, 10); onChange(); });
    $c.find('.pp-q').on('change', function () { st.q = parseInt(this.value, 10); onChange(); });
    $c.find('.pp-year').on('change', function () { st.year = this.value; onChange(); });
    $c.find('.pp-from').on('change', function () { st.from = this.value; onChange(); });
    $c.find('.pp-to').on('change', function () { st.to = this.value; onChange(); });
    return periodRange(st, months);
}
function currentRange(id) {
    const months = availableMonths();
    return periodRange(initPeriodState(id, months), months);
}

// ---------- shared chart helpers ----------
let panelCharts = { mdr: [], lab: [] };
function destroyPanelCharts(k) { panelCharts[k].forEach(c => c.destroy()); panelCharts[k] = []; }
const MDR_COLORS = { 'Non-MDR': '#10b981', 'MDR': '#f59e0b', 'XDR': '#e11d48', 'PDR': '#7f1d1d' };
function pct(n, d) { return d ? Math.round((n / d) * 1000) / 10 : 0; }

// ---------- MDR / XDR / PDR analysis panel (first tab) ----------
function ciSub(r, n, noPct) {
    if (!n) return '';
    const c = wilsonScoreCI(r, n);
    return `<div class="text-[8px] font-normal text-slate-400">95% CI ${c.lower}-${c.upper}%</div>`;
}
function renderMdrPanel() {
    if (!document.getElementById('mdrPanel')) return;
    const range = renderPeriodPickerOnce('mdr', renderMdrPanel);
    destroyPanelCharts('mdr');
    const all = getDashRecords().filter(r => r.Date && r.Date.slice(0, 7) >= range.from && r.Date.slice(0, 7) <= range.to);
    const recs = applyDeduplication(all);
    $('#mdr_range_label').text(`${range.label} - ${scopeLabel()}`);

    const counts = { 'Non-MDR': 0, 'MDR': 0, 'XDR': 0, 'PDR': 0 };
    MDR_DRILL = {};
    const byWard = {}, byMonth = {}, byGroup = {}, byOrg = {};
    let possibleX = 0, possibleP = 0, n = 0;
    let nmN = 0, nmFew = 0, nmStep = 0;   // Non-MDR isolates: all, fewer than 3 categories tested, non-susceptible in exactly 2 categories with categories untested
    recs.forEach(r => {
        const res = classifyMDR(r);
        if (!res) return;
        n++; counts[res.cls]++;
        if (res.cls === 'Non-MDR') { nmN++; if (res.tested < 3) nmFew++; if (res.ns === 2 && res.tested < res.total) nmStep++; }
        if (res.possibleXDR) possibleX++;
        if (res.possiblePDR) possibleP++;
        const on = r['Selective organism'] || 'Unknown';
        (byOrg[on] = byOrg[on] || { total: 0, mdr: 0 }).total++; if (res.cls !== 'Non-MDR') byOrg[on].mdr++;
        const w = r.Ward || 'Unknown';
        (byWard[w] = byWard[w] || { 'Non-MDR': 0, 'MDR': 0, 'XDR': 0, 'PDR': 0, total: 0 })[res.cls]++; byWard[w].total++;
        const m = r.Date.slice(0, 7);
        (byMonth[m] = byMonth[m] || { 'Non-MDR': 0, 'MDR': 0, 'XDR': 0, 'PDR': 0, total: 0 })[res.cls]++; byMonth[m].total++;
        const g = res.group;
        if (res.cls !== 'Non-MDR') (MDR_DRILL[g] = MDR_DRILL[g] || []).push({ r, res });
        (byGroup[g] = byGroup[g] || { 'Non-MDR': 0, 'MDR': 0, 'XDR': 0, 'PDR': 0, total: 0, px: 0, pp: 0 })[res.cls]++; byGroup[g].total++;
        if (res.possibleXDR) byGroup[g].px++;
        if (res.possiblePDR) byGroup[g].pp++;
    });

    const worse = counts.MDR + counts.XDR + counts.PDR;
    $('#mdr_tiles').html([
        ['Classified isolates', n + (n && n < minN() ? '*' : ''), 'text-slate-800'],
        ['MDR or worse', n ? `${worse} (${pct(worse, n)}%)${ciSub(worse, n)}` : '-', 'text-amber-600'],
        ['XDR or worse', n ? `${counts.XDR + counts.PDR} (${pct(counts.XDR + counts.PDR, n)}%)${ciSub(counts.XDR + counts.PDR, n)}` : '-', 'text-rose-600'],
        ['MDR only', n ? `${counts.MDR} (${pct(counts.MDR, n)}%)` : '-', 'text-amber-700'],
        ['XDR only', n ? `${counts.XDR} (${pct(counts.XDR, n)}%)` : '-', 'text-rose-700'],
        ['PDR', n ? `${counts.PDR} (${pct(counts.PDR, n)}%)` : '-', 'text-red-900']
    ].map(t => `<div class="bg-slate-50 border border-slate-100 rounded-lg p-2 text-center"><div class="text-[9px] font-bold text-slate-500">${t[0]}</div><div class="text-sm font-black ${t[2]}">${t[1]}</div></div>`).join(''));

    // How many isolates of the period could be classified, and which organisms could not (no Magiorakos category table)
    {
        const tot = recs.length, un = tot - n, unOrg = {};
        recs.forEach(r => { if (!classifyMDR(r)) { const o = formatOrgName(r['Selective organism'] || 'Unknown'); unOrg[o] = (unOrg[o] || 0) + 1; } });
        const names = Object.keys(unOrg).sort((a, b) => unOrg[b] - unOrg[a] || a.localeCompare(b)).map(o => o + ' (' + unOrg[o] + ')').join(', ');
        const lines = !tot ? [] : [
            '<b>Classified:</b> ' + n + ' of ' + tot + ' isolates (organisms with a Magiorakos category table).',
            un ? '<b>Not classified:</b> ' + un + ' of ' + tot + ' isolates (organisms with no Magiorakos category table).' : '',
            un ? 'Not classified organisms: ' + escHtml(names) + '.' : ''
        ].filter(Boolean);
        $('#mdr_cls_note').html(lines.length ? '<div class="text-[10px] text-slate-500 sym-note">' + hintsHtml(lines) + '</div>' : '');
    }
    setInfo('mdr_panel', 'MDR / XDR / PDR analysis', mdrInfoHtml(possibleX, possibleP));
    attachInfo('#mdrPanel .mdr-title', 'mdr_panel');
    setInfo('mdr_tiles', 'Summary figures', '<p><b>Classified isolates:</b> first isolates that could be assigned a class (Enterobacterales, <i>P. aeruginosa</i>, <i>Acinetobacter</i> spp., <i>S. aureus</i> and <i>Enterococcus</i> spp.).</p><p style="margin-top:8px"><b>MDR or worse:</b> MDR, XDR and PDR combined. <b>XDR or worse:</b> XDR and PDR combined. Percentages are of classified isolates in the selected period and unit scope.</p>');
    attachInfo('#mdr_tiles_title', 'mdr_tiles');
    setInfo('mdr_trend', 'Monthly trend', '<p>Share of classified isolates in each class per month (MDR, XDR, PDR stacked). Months with few isolates vary widely; read the trend over several months rather than a single bar.</p>');
    attachInfo('#mdr_trend_title', 'mdr_trend');
    setInfo('mdr_wards', 'Distribution by ward', '<p>Classified first isolates per ward, split by class. The number in brackets is the total classified isolates for that ward. Wards are ordered by the number of MDR or worse isolates. Isolates are de-duplicated across the whole selected period, so a patient moving between wards is counted once, in the ward of the first isolate.</p>');
    attachInfo('#mdr_wards_title', 'mdr_wards');
    setInfo('mdr_group', 'By organism group', '<p>Cumulative: MDR+ = MDR, XDR or PDR; XDR+ = XDR or PDR. Single class: MDR only, XDR only, PDR. The list under the table gives the percentage MDR+ next to each organism name, as in CLSI M39 Section 12.1, and the definition used is stated below it.</p><p>MDR+ = MDR, XDR or PDR. Groups with fewer than 30 isolates are marked with * and should be interpreted with caution (CLSI M39). "Poss." figures are possible XDR / PDR isolates: MDR, with fewer than 3 susceptible categories found, so the untested categories could still make them XDR (or PDR). They are counted as MDR, shown for information, and not included in the XDR+ or PDR columns.</p>');
    attachInfo('#mdr_group_title', 'mdr_group');

    const ctxOpts = { responsive: true, maintainAspectRatio: false };
    const pieEl = document.getElementById('chart_mdr_panel_pie');
    const pieData = n ? ['Non-MDR', 'MDR', 'XDR', 'PDR'].map(k => counts[k]) : [1];
    panelCharts.mdr.push(new Chart(pieEl, {
        type: 'doughnut',
        data: { labels: n ? ['Non-MDR', 'MDR', 'XDR', 'PDR'] : ['No data'], datasets: [{ data: pieData, backgroundColor: n ? ['Non-MDR', 'MDR', 'XDR', 'PDR'].map(k => MDR_COLORS[k]) : ['#e2e8f0'], borderWidth: 2 }] },
        options: Object.assign({}, ctxOpts, { cutout: '62%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9, weight: 'bold' } } }, title: { display: true, text: `n=${n}`, font: { size: 10, weight: 'bold' } } } })
    }));

    // Trend over the selected period (only when it spans more than one month)
    const monthList = monthsBetween(range.from, range.to).filter(m => byMonth[m]);
    $('#mdr_trend_wrap').toggleClass('hidden', monthList.length < 2);
    if (monthList.length >= 2) {
        const ds = ['MDR', 'XDR', 'PDR'].map(k => ({ label: k, data: monthList.map(m => pct(byMonth[m][k], byMonth[m].total)), backgroundColor: MDR_COLORS[k], borderRadius: 2 }));
        panelCharts.mdr.push(new Chart(document.getElementById('chart_mdr_panel_trend'), {
            type: 'bar',
            data: { labels: monthList.map(m => MONTH_NAMES[parseInt(m.slice(5, 7), 10) - 1] + " '" + m.slice(2, 4) + (byMonth[m].total < minN() ? '*' : '')), datasets: ds },
            options: Object.assign({}, ctxOpts, {
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9, weight: 'bold' } } }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.raw}%`, footer: it => { const t = byMonth[monthList[it[0].dataIndex]].total; return `n=${t}${t < minN() ? ' (below 30: wide uncertainty)' : ''}`; } } } },
                scales: { x: { stacked: true, ticks: { font: { size: 9 } }, grid: { display: false } }, y: { stacked: true, beginAtZero: true, ticks: { callback: v => v + '%' }, grid: { color: '#f1f5f9' } } }
            })
        }));
    }

    // All wards (stacked, horizontal)
    const wards = Object.keys(byWard).sort((a, b) => (byWard[b].total - byWard[b]['Non-MDR']) - (byWard[a].total - byWard[a]['Non-MDR']) || byWard[b].total - byWard[a].total);
    $('#mdr_wards_box').css('height', Math.max(160, wards.length * 30 + 60) + 'px');
    panelCharts.mdr.push(new Chart(document.getElementById('chart_mdr_panel_wards'), {
        type: 'bar',
        data: {
            labels: wards.map(w => (w.length > 22 ? w.slice(0, 20) + '..' : w) + ` (${byWard[w].total}${byWard[w].total < minN() ? '*' : ''})`),
            datasets: ['Non-MDR', 'MDR', 'XDR', 'PDR'].map(k => ({ label: k, data: wards.map(w => byWard[w][k]), backgroundColor: MDR_COLORS[k], borderRadius: 2 }))
        },
        options: Object.assign({}, ctxOpts, {
            indexAxis: 'y',
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9, weight: 'bold' } } } },
            scales: { x: { stacked: true, beginAtZero: true, ticks: { stepSize: 1, font: { size: 9 } }, grid: { color: '#f1f5f9' } }, y: { stacked: true, ticks: { font: { size: 9, weight: 'bold' } }, grid: { display: false } } }
        })
    }));

    // By organism group
    const gnames = { enterobacterales: 'Enterobacterales', pseudomonas: 'P. aeruginosa', acinetobacter: 'Acinetobacter', staph: 'S. aureus' };
    const lowN = (n && n < minN()) || Object.values(byGroup).some(x => x.total < minN()) || wards.some(w => byWard[w].total < minN()) || monthList.some(m => byMonth[m].total < minN());
    const mdrNNote = `<ul class="note-list text-[9px] text-slate-400 mt-1 sym-note"><li>Cumulative: MDR+ = MDR, XDR or PDR; XDR+ = XDR or PDR. Single class: MDR only, XDR only, PDR (each isolate is in one class).</li><li>The 95% CI (Wilson) shows how precise each cumulative percentage is.</li>${lowN ? '<li><b>*</b> fewer than 30 isolates (CLSI M39 &sect;7.2.2): the percentage is imprecise, see the wide CI. Read it as an indication, not a stable rate.</li>' : ''}<li>Classification is per isolate (Magiorakos 2012), so small n does not change an isolate\'s class; it only makes the percentage less certain.</li></ul>`;
    // CLSI M39 Section 12.1 style: the percentage MDR next to each organism name, with the definition used stated below
    const orgRows = Object.keys(byOrg).filter(o => byOrg[o].total > 0).sort((a, b) => byOrg[b].total - byOrg[a].total);
    const mdrOrgList = orgRows.length ? `<div class="mt-3"><div class="text-[10px] font-bold text-slate-600 mb-1">Percentage MDR+ by organism</div><ul class="text-[10px] text-slate-600 space-y-0.5">${orgRows.map(o => { const x = byOrg[o], small = x.total < minN(); return `<li class="${small ? 'text-slate-400' : ''}"><b>${escHtml(formatOrgName ? formatOrgName(o) : o)}</b> (${pct(x.mdr, x.total)}% MDR+, n=${x.total}${small ? '*' : ''})</li>`; }).join('')}</ul></div>` : '';
    // Non-MDR is not a confirmation: routine panels never cover every category (Magiorakos 2012 validity condition, pp. 268 and 278)
    const mdrCovNote = nmN ? `<ul class="note-list text-[9px] text-slate-400 mt-2 sym-note"><li><b>Non-MDR isolates: ${nmN}.</b> MDR and XDR percentages are minimum estimates, because categories that were not tested could still show non-susceptibility.</li><li><b>${nmFew} (${pct(nmFew, nmN)}%)</b> had fewer than 3 categories tested. MDR needs 3 or more non-susceptible categories, so these isolates could not have been confirmed as MDR whatever their results.</li><li><b>${nmStep} (${pct(nmStep, nmN)}%)</b> were non-susceptible in 2 categories and had other categories untested: one more non-susceptible category would make them MDR.</li></ul>` : '';
    const mdrDefNote = `<ul class="note-list text-[9px] text-slate-400 mt-2 sym-note"><li>Definitions (Magiorakos et al. 2012): MDR = non-susceptible to at least one agent in three or more antimicrobial categories.</li><li>XDR = non-susceptible to at least one agent in all but two or fewer categories. PDR = non-susceptible to all agents in all categories.</li><li>Non-susceptible = I, SDD or R. Intrinsic resistance is not counted. Only the categories listed for the organism group are used (CLSI M39 Section 12 asks the facility to state its definition).</li></ul>`;
    const rows = Object.keys(byGroup).sort((a, b) => byGroup[b].total - byGroup[a].total).map(g => {
        const x = byGroup[g], w = x.MDR + x.XDR + x.PDR;
        const poss = (x.px || x.pp) ? ` <span class="text-slate-400">(+${x.px} poss. XDR${x.pp ? ', +' + x.pp + ' poss. PDR' : ''})</span>` : '';
        return `<tr class="border-t border-slate-100"><td class="py-1.5 pr-2 font-bold text-slate-700">${MDR_DRILL[g] && MDR_DRILL[g].length ? `<a href="#" class="mdr-drill" data-g="${escHtml(g)}" style="color:#0f766e;text-decoration:underline dotted">${gnames[g] || g}</a>` : (gnames[g] || g)}</td><td class="text-center">${x.total}${x.total < minN() ? '*' : ''}</td><td class="text-center text-amber-600 font-bold">${pct(w, x.total)}%${ciSub(w, x.total)}</td><td class="text-center text-rose-600 font-bold">${x.XDR + x.PDR}${ciSub(x.XDR + x.PDR, x.total, true)}${poss}</td><td class="text-center text-amber-700">${x.MDR} <span class="text-slate-400">(${pct(x.MDR, x.total)}%)</span></td><td class="text-center text-rose-700">${x.XDR} <span class="text-slate-400">(${pct(x.XDR, x.total)}%)</span></td><td class="text-center text-red-900 font-bold">${x.PDR} <span class="text-slate-400 font-normal">(${pct(x.PDR, x.total)}%)</span></td></tr>`;
    }).join('');
    $('#mdr_group_table').html(rows ? `<table class="w-full text-[10px]"><thead><tr class="text-slate-500"><th class="text-left pb-1">Group</th><th>n</th><th>MDR+</th><th>XDR+</th><th>MDR only</th><th>XDR only</th><th>PDR</th></tr></thead><tbody>${rows}</tbody></table>${mdrOrgList}${mdrNNote}${mdrCovNote}${mdrDefNote}` : '<p class="text-xs text-slate-400 text-center">No classifiable isolates in this period.</p>');
    try { if (typeof renderMdrKri === 'function') renderMdrKri(recs); } catch (e) { console.error(e); }
}
const _pickerRendered = {};
function renderPeriodPickerOnce(id, cb) {
    const months = availableMonths();
    const sig = months.join(',') + '|' + (PERIOD_STATE[id] ? PERIOD_STATE[id].type : '');
    if (_pickerRendered[id] !== sig || !$('#' + id + '_picker').children().length) {
        const r = renderPeriodPicker(id, cb);
        _pickerRendered[id] = months.join(',') + '|' + PERIOD_STATE[id].type;
        return r;
    }
    return currentRange(id);
}

// ---------- Culture Overview tab ----------
function getLabData() { try { return pruneFutureLab(JSON.parse(localStorage.getItem('amr_dash_lab'))) || {}; } catch (e) { return {}; } }

function renderLabQuality() {
    if (!document.getElementById('viewLab')) return;
    const range = renderPeriodPickerOnce('lab', renderLabQuality);
    destroyPanelCharts('lab');
    const lab = getLabData();
    const scope = getUnitScope();
    $('#lab_range_label').text(`${range.label} - ${scopeLabel()}`);

    const monthsInRange = monthsBetween(range.from, range.to);
    const tot = { g: 0, ng: 0, con: 0 }, blood = { g: 0, ng: 0, con: 0 };
    const perMonth = {}, perWard = {}, perSample = {};
    Object.keys(lab.months || {}).forEach(m => {
        if (m < range.from || m > range.to) return;
        Object.keys(lab.months[m]).forEach(k => {
            const idx = k.indexOf('|'), ward = k.slice(0, idx), sample = k.slice(idx + 1);
            if (!wardInScope(ward, scope)) return;
            const [g, ng, con] = lab.months[m][k];
            tot.g += g; tot.ng += ng; tot.con += con;
            if (/blood/i.test(sample)) { blood.g += g; blood.ng += ng; blood.con += con; }
            const pm = (perMonth[m] = perMonth[m] || { g: 0, ng: 0, con: 0 }); pm.g += g; pm.ng += ng; pm.con += con;
            const pw = (perWard[ward] = perWard[ward] || { g: 0, ng: 0, con: 0 }); pw.g += g; pw.ng += ng; pw.con += con;
            const ps = (perSample[sample] = perSample[sample] || { g: 0, ng: 0, con: 0 }); ps.g += g; ps.ng += ng; ps.con += con;
        });
    });
    const T = tot.g + tot.ng + tot.con, B = blood.g + blood.ng + blood.con;

    if (!T) {
        $('#lab_tiles, #lab_blood_box').html('');
        $('#lab_empty').removeClass('hidden');
        $('#lab_content').addClass('hidden');
        return;
    }
    $('#lab_empty').addClass('hidden');
    $('#lab_content').removeClass('hidden');

    $('#lab_tiles').html([
        ['Cultures', T, 'text-slate-800'],
        ['Positive', `${pct(tot.g, T)}%`, 'text-rose-600'],
        ['No growth', `${pct(tot.ng, T)}%`, 'text-emerald-600'],
        ['Contaminated', `${pct(tot.con, T)}%`, 'text-amber-600']
    ].map(t => `<div class="bg-slate-50 border border-slate-100 rounded-lg p-2 text-center"><div class="text-[9px] font-bold text-slate-500">${t[0]}</div><div class="text-sm font-black ${t[2]}">${t[1]}</div></div>`).join(''));

    // Blood culture contamination: certain (lab flagged) vs possible (skin flora in blood, cannot be confirmed from this data)
    const bloodRecs = scopeRecs(getDashRecords()).filter(r => r.Date && r.Date.slice(0, 7) >= range.from && r.Date.slice(0, 7) <= range.to && isPossibleContaminant(r));
    const possKeys = new Set(bloodRecs.map(r => [r['Patient ID'], r['Specimen Date'] || r.Date].join('|')));
    const lo = pct(blood.con, B), hi = pct(blood.con + possKeys.size, B);
    const tone = !B ? 'slate' : (hi <= 3 ? 'emerald' : (lo <= 3 ? 'amber' : 'rose'));
    $('#lab_blood_box').html(B ? `
        <div class="bg-${tone}-50 border border-${tone}-200 rounded-lg p-3">
          <div class="grid grid-cols-3 gap-2 text-center">
            <div><div class="text-[9px] font-bold text-slate-500">Blood cultures</div><div class="text-sm font-black text-slate-800">${B}</div></div>
            <div><div class="text-[9px] font-bold text-slate-500">Positive</div><div class="text-sm font-black text-rose-600">${pct(blood.g, B)}%</div></div>
            <div><div class="text-[9px] font-bold text-slate-500">Reported as contaminated</div><div class="text-sm font-black text-slate-800">${lo}%</div></div>
          </div>
          <div class="mt-2 pt-2 border-t border-${tone}-200 text-[10px] text-slate-600 leading-snug">
            <b>Possible</b> skin-flora growth (CoNS, <i>Corynebacterium</i>, <i>Micrococcus</i>...): ${possKeys.size} culture(s), not confirmed.
            <br><b>Possible contamination, upper estimate:</b> ${hi}%
          </div>
          <p class="text-[9px] text-slate-400 mt-1">Reference value: 3% or less.</p>
        </div>` : '<p class="text-xs text-slate-400 text-center">No blood cultures in this period.</p>');
    setInfo('lab_blood', 'Blood cultures: contamination indicators', `<p>Contamination means growth that does not represent true bloodstream infection. The commonly used benchmark is <b>3% or less</b> of blood cultures (see CLSI M47 and the ASM practice guideline below).</p>
        <p style="margin-top:8px"><b>Reported as contaminated:</b> cultures the laboratory itself recorded as contaminated. This figure is certain.</p>
        <p style="margin-top:8px"><b>Possible skin-flora growth:</b> blood cultures that grew organisms that are usually skin flora (coagulase-negative staphylococci, <i>Corynebacterium</i>, <i>Micrococcus</i>, viridans streptococci...). These organisms can also cause genuine infection, and a single result cannot be classified without knowing how many blood-culture sets were positive and the clinical picture, which are not recorded. They are therefore labelled <i>possible</i> and are not counted as contaminated.</p>
        <p style="margin-top:8px"><b>Possible contamination, upper estimate:</b> reported contaminated plus possible skin-flora growth, divided by all blood cultures. The true rate lies between the reported figure and this estimate.</p>`);
    attachInfo('#lab_blood_title', 'lab_blood');

    setInfo('lab_def', 'About the Culture Overview', `<p>Counts come from the monthly WHONET export and describe culture activity, not individual patients. A <b>culture</b> is one patient, one date and one specimen type; several organisms from the same specimen count once.</p>
        <ul style="margin:6px 0 0 16px;list-style:disc"><li><b>Positive:</b> an organism was reported.</li><li><b>No growth:</b> no organism was reported.</li><li><b>Contaminated:</b> reported as contaminated by the laboratory.</li></ul>
        <p style="margin-top:8px">Only aggregate counts are stored; no patient rows. Screening cultures are included here (they are excluded only from resistance statistics).</p>`);
    attachInfo('#lab_title', 'lab_def');
    setInfo('lab_tiles', 'Cultures received', '<p><b>Cultures</b> = all cultures in the period and unit scope. <b>Positive</b>, <b>No growth</b> and <b>Contaminated</b> are shares of that total and add up to 100%.</p><p style="margin-top:8px">Positivity depends on specimen mix and sampling practice (for example, many screening or follow-up cultures lower it), so compare like with like: the same ward or specimen type over time.</p>');
    attachInfo('#lab_tiles_title', 'lab_tiles');
    setInfo('lab_volume', 'Culture volume per month', '<p>Number of cultures received each month, split by result. Volume reflects workload and sampling practice.</p><p style="margin-top:8px"><b>Volume notes:</b> a note appears when a month is less than half, or more than 1.6 times, the average of the selected months. A low month usually means an incomplete data file; a high month may reflect an outbreak work-up or a screening campaign. Notes are prompts to check, not conclusions.</p>');
    attachInfo('#lab_volume_title', 'lab_volume');
    setInfo('lab_wards', 'Positivity by ward', '<p>Share of cultures with growth in each ward; the number in brackets is the ward total. Grey bars have fewer than 30 cultures and should be interpreted with caution. Differences between wards partly reflect case mix and how often cultures are taken.</p>');
    attachInfo('#lab_wards_title', 'lab_wards');
    setInfo('lab_sample', 'By specimen type', '<p>Number of cultures and the share that were positive, had no growth, or were reported as contaminated, for each specimen type in the selected period and unit scope.</p>');
    attachInfo('#lab_sample_title', 'lab_sample');

    const opt = { responsive: true, maintainAspectRatio: false };
    const ml = monthsInRange.filter(m => perMonth[m]);
    panelCharts.lab.push(new Chart(document.getElementById('chart_lab_volume'), {
        type: 'bar',
        data: {
            labels: ml.map(m => MONTH_NAMES[parseInt(m.slice(5, 7), 10) - 1] + " '" + m.slice(2, 4)),
            datasets: [
                { label: 'Positive', data: ml.map(m => perMonth[m].g), backgroundColor: '#e11d48', borderRadius: 2 },
                { label: 'No growth', data: ml.map(m => perMonth[m].ng), backgroundColor: '#10b981', borderRadius: 2 },
                { label: 'Contaminated', data: ml.map(m => perMonth[m].con), backgroundColor: '#f59e0b', borderRadius: 2 }
            ]
        },
        options: Object.assign({}, opt, {
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9, weight: 'bold' } } } },
            scales: { x: { stacked: true, ticks: { font: { size: 9 } }, grid: { display: false } }, y: { stacked: true, beginAtZero: true, grid: { color: '#f1f5f9' } } }
        })
    }));

    // Volume notes: a month far below the others usually means an incomplete file, not a real drop
    const vols = ml.map(m => perMonth[m].g + perMonth[m].ng + perMonth[m].con);
    const alerts = [];
    if (ml.length >= 3) {
        const mean = vols.reduce((a, b) => a + b, 0) / vols.length;
        ml.forEach((m, i) => {
            if (vols[i] < mean * 0.5) alerts.push(`${monthLabel(m)}: ${vols[i]} cultures (average ${Math.round(mean)}). Lower than usual; the data file may be incomplete.`);
            else if (vols[i] > mean * 1.6) alerts.push(`${monthLabel(m)}: ${vols[i]} cultures (average ${Math.round(mean)}). Higher than usual; this may reflect an outbreak work-up or a screening campaign.`);
        });
    }
    $('#lab_alerts').html(alerts.length ? alerts.map(a => `<div class="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 mb-1">${a}</div>`).join('') : '');

    const wards = Object.keys(perWard).sort((a, b) => (perWard[b].g + perWard[b].ng + perWard[b].con) - (perWard[a].g + perWard[a].ng + perWard[a].con));
    const wt = w => perWard[w].g + perWard[w].ng + perWard[w].con;
    $('#lab_wards_box').css('height', Math.max(150, wards.length * 28 + 50) + 'px');
    panelCharts.lab.push(new Chart(document.getElementById('chart_lab_wards'), {
        type: 'bar',
        data: {
            labels: wards.map(w => (w.length > 22 ? w.slice(0, 20) + '..' : w) + ` (${wt(w)})`),
            datasets: [{ label: 'Positivity %', data: wards.map(w => pct(perWard[w].g, wt(w))), backgroundColor: wards.map(w => wt(w) >= minN() ? '#0d9488' : '#94a3b8'), borderRadius: 3 }]
        },
        options: Object.assign({}, opt, {
            indexAxis: 'y',
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.raw}% positive` } } },
            scales: { x: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%', font: { size: 9 } }, grid: { color: '#f1f5f9' } }, y: { ticks: { font: { size: 9, weight: 'bold' } }, grid: { display: false } } }
        })
    }));

    const srows = Object.keys(perSample).sort((a, b) => (perSample[b].g + perSample[b].ng + perSample[b].con) - (perSample[a].g + perSample[a].ng + perSample[a].con)).map(sname => {
        const x = perSample[sname], t = x.g + x.ng + x.con;
        return `<tr class="border-t border-slate-100"><td class="py-1.5 pr-2 font-bold text-slate-700">${escapeHtmlDash(sname)}</td><td class="text-center">${t}</td><td class="text-center text-rose-600 font-bold">${pct(x.g, t)}%</td><td class="text-center">${pct(x.ng, t)}%</td><td class="text-center text-amber-600">${pct(x.con, t)}%</td></tr>`;
    }).join('');
    $('#lab_sample_table').html(`<table class="w-full text-[10px]"><thead><tr class="text-slate-500"><th class="text-left pb-1">Specimen</th><th>n</th><th>Positive</th><th>No growth</th><th>Contaminated</th></tr></thead><tbody>${srows}</tbody></table><p class="text-[9px] text-slate-400 mt-1">Grey ward bars: fewer than 30 cultures.</p>`);
}
// ---------- MDR drill-down: browse the MDR / XDR / PDR isolates of one organism group (no patient information is shown) ----------
let MDR_DRILL = {};
const MDR_DEF_TEXT = {
    MDR: 'MDR: non-susceptible to at least one agent in three or more antimicrobial categories.',
    XDR: 'XDR: non-susceptible to at least one agent in all but two or fewer categories.',
    PDR: 'PDR: non-susceptible to all agents in all categories.'
};
function mdrDrillHtml(items, i) {
    const it = items[i], r = it.r, res = it.res, ex = explainMDR(r);
    const col = { MDR: '#b45309', XDR: '#be123c', PDR: '#7f1d1d' }[res.cls] || '#334155';
    const li = t => '<li style="margin:2px 0">' + t + '</li>';
    const ul = a => a.length ? '<ul style="list-style:none;padding:0;margin:0;font-size:12px">' + a.map(li).join('') + '</ul>' : '<div style="font-size:12px;color:#94a3b8">None</div>';
    const head = t => '<div style="font-weight:700;font-size:12px;color:#334155;margin:10px 0 3px">' + t + '</div>';
    const resTxt = a => a.results.map(x => escHtml(x[0]) + ' <b>' + x[1] + '</b>').join(', ');
    let h = '<div style="text-align:left">';
    h += '<div style="font-weight:800;font-size:15px;color:#0f172a">' + escHtml(formatOrgName ? formatOrgName(r['Selective organism']) : r['Selective organism']) + '</div>';
    h += '<div style="margin:4px 0"><span style="background:' + col + ';color:#fff;border-radius:6px;padding:2px 8px;font-size:12px;font-weight:800">' + res.cls + '</span>' + (res.possibleXDR ? ' <span style="font-size:11px;color:#64748b">possible XDR (not all categories tested)</span>' : '') + (res.possiblePDR ? ' <span style="font-size:11px;color:#64748b">possible PDR (not all categories tested)</span>' : '') + '</div>';
    h += '<div style="font-size:12px;color:#475569">' + MDR_DEF_TEXT[res.cls] + '</div>';
    h += '<div style="font-size:12px;color:#475569;margin-top:4px">Non-susceptible in <b>' + res.ns + '</b> of <b>' + res.total + '</b> categories that apply to this organism (' + res.tested + ' tested).</div>';
    if (ex) {
        const chip = v => { const c = { S: '#047857', I: '#b45309', SDD: '#b45309', R: '#be123c' }[v] || '#334155'; return '<span style="font-weight:800;color:' + c + '">' + v + '</span>'; };
        const partial = {}; (ex.irPartial || []).forEach(x => { partial[x.cat] = x.agents; });
        const agentsTxt = a => a.results.map(x => escHtml(x[0]) + ' ' + chip(x[1])).join('<br>') + (partial[a.cat] ? '<br><span style="color:#64748b">' + partial[a.cat].map(escHtml).join(', ') + ': intrinsic resistance, not counted</span>' : '');
        const pill = (t, bg) => '<span style="display:inline-block;background:' + bg + ';color:#fff;border-radius:5px;padding:1px 6px;font-size:10px;font-weight:700;white-space:nowrap">' + t + '</span>';
        const td = 'style="border:1px solid #e2e8f0;padding:4px 6px;vertical-align:top;font-size:11px;line-height:1.35"';
        const rows = [];
        ex.ns.forEach(a => rows.push([escHtml(a.cat), agentsTxt(a), pill('Non-susceptible', '#be123c'), '#fff1f2']));
        ex.s.forEach(a => rows.push([escHtml(a.cat), agentsTxt(a), pill('Susceptible', '#047857'), '#f0fdf4']));
        ex.untested.forEach(a => rows.push([escHtml(a.cat), '<span style="color:#64748b">' + a.agents.filter(g => !(partial[a.cat] || []).includes(g)).map(escHtml).join(', ') + (partial[a.cat] ? '<br>' + partial[a.cat].map(escHtml).join(', ') + ': intrinsic resistance, not counted' : '') + '</span>', pill('Not tested', '#64748b'), '#f8fafc']));
        (ex.na || []).forEach(a => rows.push([escHtml(a.cat), '<span style="color:#64748b">' + a.agents.map(escHtml).join(', ') + ': approved only for E. coli, K. pneumoniae and K. oxytoca (Magiorakos 2012, Table 3)</span>', pill('Not applicable', '#94a3b8'), '#f8fafc']));
        (ex.irDetail || []).forEach(a => rows.push([escHtml(a.cat), '<span style="color:#64748b">' + a.agents.map(g => '<b>' + escHtml(g) + '</b>').join(', ') + ': intrinsic resistance, category not counted</span>', pill('Intrinsic', '#94a3b8'), '#f8fafc']));
        h += '<table style="width:100%;border-collapse:collapse;margin-top:10px"><thead><tr style="background:#f1f5f9"><th ' + td + '>Category</th><th ' + td + '>Agents tested and result</th><th ' + td + '>Status</th></tr></thead><tbody>' +
            rows.map(r => '<tr style="background:' + r[3] + '"><td ' + td + '><b>' + r[0] + '</b></td><td ' + td + '>' + r[1] + '</td><td ' + td + '>' + r[2] + '</td></tr>').join('') + '</tbody></table>';
        h += '<div style="font-size:10px;color:#64748b;margin-top:6px">Non-susceptible = I, SDD or R. Not tested = no result for any agent of the category (unknown, not counted as susceptible). Not applicable = category does not apply to this species. Intrinsic = category removed because the organism is intrinsically resistant to every agent in it (CLSI M100 Appendix B / Magiorakos 2012), so it is not counted.</div>';
        if (ex.mrsa) h += '<div style="font-size:11px;color:#475569;margin-top:6px">MRSA is classified as MDR by definition (Magiorakos 2012, Table 6 footnote).</div>';
    }
    return h + '</div>';
}
function openMdrGroup(g) {
    const rank = { PDR: 0, XDR: 1, MDR: 2 };
    const items = (MDR_DRILL[g] || []).slice().sort((a, b) => rank[a.res.cls] - rank[b.res.cls] || String(a.r['Selective organism']).localeCompare(String(b.r['Selective organism'])));
    if (!items.length) return;
    let i = 0;
    const nav = () => '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><button type="button" id="mdr_prev" style="font-size:20px;padding:2px 14px;border:1px solid #cbd5e1;border-radius:8px;background:#fff">&#8249;</button><span style="font-size:12px;color:#64748b;font-weight:700">' + (i + 1) + ' / ' + items.length + '</span><button type="button" id="mdr_next" style="font-size:20px;padding:2px 14px;border:1px solid #cbd5e1;border-radius:8px;background:#fff">&#8250;</button></div>';
    const paint = () => { const c = Swal.getHtmlContainer(); if (!c) return; c.innerHTML = nav() + '<div id="mdr_body">' + mdrDrillHtml(items, i) + '</div>'; bind(); };
    const step = d => { i = (i + d + items.length) % items.length; paint(); };
    const bind = () => { const p = document.getElementById('mdr_prev'), n = document.getElementById('mdr_next'); if (p) p.onclick = () => step(-1); if (n) n.onclick = () => step(1); };
    const key = e => { if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'ArrowRight') step(1); };
    Swal.fire({
        title: (typeof MDR_GROUP_NAMES !== 'undefined' && MDR_GROUP_NAMES[g]) || g, html: nav() + '<div id="mdr_body">' + mdrDrillHtml(items, 0) + '</div>',
        showConfirmButton: true, confirmButtonText: 'Close', buttonsStyling: false, width: 'min(94vw, 460px)',
        customClass: { popup: 'info-popup', title: 'info-title', htmlContainer: 'info-container', confirmButton: 'info-close' },
        didOpen: () => { bind(); document.addEventListener('keydown', key); let sx = null; const c = Swal.getHtmlContainer(); c.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true }); c.addEventListener('touchend', e => { if (sx === null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1); sx = null; }, { passive: true }); },
        willClose: () => document.removeEventListener('keydown', key)
    });
}
$(document).on('click', 'a.mdr-drill', function (e) { e.preventDefault(); openMdrGroup($(this).data('g')); });

function escapeHtmlDash(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }


// =====================================================================
// SECTION TOOLBARS: one information (i) button and one print button per main section.
//  - (i): popup with one collapsible entry per chart, plus the supporting references.
//  - printer: popup to choose which charts to print (or all) and the page options;
//    the result opens the browser print dialog (save as PDF).
// Icons: Lucide (ISC licence), inlined so they work offline.
// =====================================================================
const ICON_PRINTER = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>';
const ICON_INFO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';

// Static explanations for charts that have no dynamic note
setInfo('sec_prevalence', 'Organism prevalence', '<p>Share of first isolates by organism for the selected period, specimen and unit filter. Isolates are de-duplicated (CLSI M39: first isolate per patient and organism within the selected period) and screening cultures are excluded. Select a slice to open that organism\'s susceptibility profile.</p>');
setInfo('sec_patho', 'Susceptibility profile of one organism', '<p>For the selected organism, each bar shows the percentage of tested isolates that are susceptible (S), intermediate (I) or resistant (R) to an antibiotic. Results are interpreted with CLSI M100 breakpoints; %S does not include I or SDD results. Bars based on fewer than 30 isolates are faded (CLSI M39).</p>');
setInfo('sec_abx', 'Activity of one antibiotic', '<p>For the selected antibiotic, each bar shows the percentage of isolates of an organism that are susceptible (S), intermediate (I) or resistant (R). Interpretation follows CLSI M100. Organisms with fewer than 30 tested isolates are faded and should be interpreted with caution (CLSI M39).</p>');
setInfo('sec_heatmap', 'Organism by antibiotic heatmap', '<p>Each cell is the percentage of the chosen category (S, I or R) for one organism and antibiotic among tested isolates. An asterisk marks cells with fewer than 30 tested isolates. Isolates are de-duplicated (CLSI M39) and interpreted with CLSI M100.</p>');

// Printed subtitle: what the chart on the page is showing (selection, metric, specimen, ward), so the paper stands alone
const PRINT_METRIC = { S: '% Susceptible', R: '% Resistant', NS: '% NS (all non-susceptible: SDD, I, R)', I: '% Intermediate' };
const PRINT_WARD = { total: 'All wards', inpatient: 'Inpatient', outpatient: 'Outpatient' };
function printSub(card) {
    const t = sel => ($(sel + ' option:selected').text() || '').replace(/\s+/g, ' ').trim();
    const spec = k => (typeof anSpec !== 'undefined' && typeof specimenLabel === 'function') ? specimenLabel(anSpec[k]) : '';
    const ward = n => PRINT_WARD[$('input[name="' + n + '"]:checked').val() || 'total'] || '';
    const low = id => $('#' + id).is(':checked') ? 'organisms/antibiotics with n < 30 hidden' : '';
    let parts = [];
    if (card === 'patho') parts = [t('#patho_bug'), PRINT_METRIC[currentPathoMetric], 'Specimen: ' + spec('patho'), ward('patho_ward'), low('patho_hide_low')];
    else if (card === 'abx') parts = [t('#abx_drug'), PRINT_METRIC[currentAbxMetric], 'Specimen: ' + spec('abx'), ward('abx_ward'), low('abx_hide_low')];
    else if (card === 'guided') parts = [t('#guided_bug_select'), PRINT_METRIC[currentGuidedMetric], low('guided_hide_low')];
    else if (card === 'cum') parts = [PRINT_METRIC[(document.querySelector('#an_cum_seg .on') || {}).dataset ? document.querySelector('#an_cum_seg .on').dataset.v : 'S'] || '', 'Specimen: ' + spec('cum'), low('an_cum_hide')];
    else if (card === 'heatmap') parts = [PRINT_METRIC[$('#adv_metric').val()] || '', 'Specimen: ' + spec('adv'), ward('adv_ward')];
    return parts.filter(Boolean).join('  |  ');
}
function chartTitleOf(selOrFn) { return typeof selOrFn === 'function' ? selOrFn() : selOrFn; }
const profTitle = (p, n) => () => $('#live_' + p + '_profile' + n + '_title').text() || ('Resistance profile ' + n);

function monthSection(p, label) {
    return {
        id: 'sec_' + label, title: () => $('#live_month_title').text() || 'Monthly Alerts',
        infos: [],
        charts: []
    };
}
const SECTIONS = {
    prevalence: { id: 'prevalence', title: 'Clinical Prevalence & AST Profile', infos: [['Organism prevalence', 'sec_prevalence'], ['AST profile of the selected organism', 'abx_guidedAmrContainer']],
        charts: [{ title: 'Organism Prevalence', el: '#chartGuidedPie', hint: 'Choose a specimen in this section first.' }, { title: 'AST Profile of the selected organism', el: '#chartGuidedAMR', key: 'guided', sub: () => printSub('guided'), hint: 'Choose a specimen in this section first.' }] },
    patho: { id: 'patho', title: 'Bacteria/Fungi Susceptibility Profile', infos: [['How to read this chart', 'sec_patho'], ['Sample size and AWaRe', 'abx_pathoAmrContainer']],
        charts: [{ title: 'Bacteria/Fungi Susceptibility Profile', el: '#chartPathoAMR', key: 'patho', sub: () => printSub('patho'), hint: 'Choose a bacteria in this section first.' }] },
    abx: { id: 'abx', title: 'Antimicrobial In Vitro Activity Profile', infos: [['How to read this chart', 'sec_abx']],
        charts: [{ title: 'Antimicrobial In Vitro Activity Profile', el: '#chartAbxAMR', key: 'abx', sub: () => printSub('abx') }] },
    heatmap: { id: 'heatmap', title: 'Advanced Cross-Search (Heatmap)', infos: [['How to read the heatmap', 'sec_heatmap']],
        charts: [{ title: 'Advanced Heatmap', el: '#heatmapWrapper', kind: 'table', landscape: true, sub: () => printSub('heatmap'), noteSel: '#heatmapNote', legendSel: '#heatmapLegend', hint: 'Run the search in this section first.' }] },
    mdr: { id: 'mdr', title: 'MDR / XDR / PDR Analysis', labelSel: '#mdr_range_label',
        infos: [['Definitions and method', 'mdr_panel'], ['Summary figures', 'mdr_tiles'], ['Monthly trend', 'mdr_trend'], ['Distribution by ward', 'mdr_wards'], ['By organism group', 'mdr_group'], ['Key resistance indicators', 'mdr_kri']],
        charts: [{ title: 'Summary', el: '#mdr_tiles', kind: 'tiles', noteSel: '#mdr_cls_note' }, { title: 'Resistance classification', el: '#chart_mdr_panel_pie' }, { title: 'Monthly trend (% of classified isolates)', el: '#chart_mdr_panel_trend' }, { title: 'All wards', el: '#chart_mdr_panel_wards' }, { title: 'By organism group', el: '#mdr_group_table', kind: 'table' }] },
    cum: { id: 'cum', title: 'Cumulative Antibiogram', infos: [['How to read the antibiogram', 'an_cum']],
        charts: [{ title: 'Cumulative Antibiogram', el: '#an_cum_table', kind: 'table', landscape: true, sub: () => printSub('cum'), noteSel: '#an_cum_note', hint: 'Open this section first.' }, { title: 'Key resistance indicators (% resistant)', el: '#chart_mdr_kri', noteSel: '#mdr_kri_note' }] },
    year: { id: 'sec_year', title: () => $('#live_y_title').text() || 'Annual Report', infos: [], charts: [] },
    month: monthSection('m', 'month'),
    lab: { id: 'lab', title: 'Culture Overview', labelSel: '#lab_range_label',
        infos: [['About the Culture Overview', 'lab_def'], ['Cultures received', 'lab_tiles'], ['Blood cultures: contamination indicators', 'lab_blood'], ['Culture volume per month', 'lab_volume'], ['Positivity by ward', 'lab_wards'], ['By specimen type', 'lab_sample']],
        charts: [{ title: 'Cultures received', el: '#lab_tiles', kind: 'tiles' }, { title: 'Blood cultures: contamination indicators', el: '#lab_blood_box', kind: 'tiles' }, { title: 'Culture volume per month', el: '#chart_lab_volume' }, { title: 'Positivity by ward', el: '#chart_lab_wards' }, { title: 'By specimen type', el: '#lab_sample_table', kind: 'table' }] }
};

function sectionTitle(sec) { return chartTitleOf(sec.title); }
function chartElement(c) {
    const el = document.querySelector(c.alt || c.el);
    if (!el) return null;
    // collapsed cards are still printable: only switched-off sections and tabs that are not open are skipped
    if (el.closest('.sec-off')) return null;
    const view = el.closest('#viewAnalytics, #viewLastYear, #viewLastMonth, #viewMdr, #viewLab');
    if (view && view.classList.contains('hidden')) return null;
    if (el.tagName === 'CANVAS') {
        let chart = null, canAsk = false; try { canAsk = !!(window.Chart && Chart.getChart); chart = canAsk && Chart.getChart(el); } catch (e) {}
        if (canAsk ? !chart : !el.width) return null;       // an empty canvas (nothing selected yet) is not printable
    }
    if (c.kind === 'table' && !el.querySelector('table')) return null;
    if (c.kind === 'tiles' && !el.children.length) return null;
    return el;
}

// ---------- information popup ----------
window.showSectionInfo = function (secId) {
    const sec = SECTIONS[secId]; if (!sec) return;
    const used = [];
    const items = sec.infos.map(([title, key]) => {
        const inf = INFO_STORE[key]; if (!inf) return '';
        (inf.refs || []).forEach(r => { if (!used.includes(r)) used.push(r); });
        return `<details class="info-acc"><summary>${escHtml(title)}</summary><div class="info-body">${inf.html}</div></details>`;
    }).join('');
    Swal.fire({
        title: sectionTitle(sec),
        html: `<div class="info-acc-wrap">${items || '<p class="info-body">Information will appear once data is loaded.</p>'}</div>${refsHtml(used, true)}`,
        confirmButtonText: 'Close', width: 'min(92vw, 460px)', buttonsStyling: false,
        customClass: { popup: 'info-popup', title: 'info-title', htmlContainer: 'info-container', confirmButton: 'info-close' }
    });
};

// ---------- print popup ----------
function escHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function chartDataTable(canvas) {
    try {
        const ch = (typeof Chart !== 'undefined' && Chart.getChart) ? Chart.getChart(canvas) : null;
        if (!ch) return '';
        const labels = (ch.data.labels || []).map(l => Array.isArray(l) ? l.join(' ') : String(l));
        const ds = ch.data.datasets.filter(d => Array.isArray(d.data));
        if (!labels.length || !ds.length) return '';
        // one-series bar charts show the selected metric (S / R / NS) instead of a generic "Value"
        const mk = { chartGuidedAMR: typeof currentGuidedMetric !== 'undefined' && currentGuidedMetric, chartPathoAMR: typeof currentPathoMetric !== 'undefined' && currentPathoMetric, chartAbxAMR: typeof currentAbxMetric !== 'undefined' && currentAbxMetric }[canvas.id];
        const mName = { S: '% Susceptible', R: '% Resistant', NS: '% NS (all non-susceptible: SDD, I, R)' }[mk] || (/^(pie|doughnut)$/.test(ch.config.type) ? 'Isolates (n)' : ((((ch.options || {}).scales || {}).y || {}).title || {}).text || 'n');
        // bar charts with isolate counts: add n tested and the 95% CI, which the screen only shows on tap
        const d0 = ds[0], withN = ds.length === 1 && Array.isArray(d0.nData);
        const ciTxt = i => { const c = d0.ciData && d0.ciData[i]; return c && typeof c.lower === 'number' ? Math.round(c.lower) + ' to ' + Math.round(c.upper) : ''; };
        const head = '<tr><th></th>' + ds.slice(0, 12).map(d => `<th>${escHtml(d.label || mName)}</th>`).join('') + (withN ? '<th>n tested</th>' + (Array.isArray(d0.ciData) ? '<th>95% CI</th>' : '') : '') + '</tr>';
        const rows = labels.slice(0, 60).map((l, i) => `<tr><th>${escHtml(l)}</th>` + ds.slice(0, 12).map(d => `<td>${d.data[i] === undefined || d.data[i] === null ? '' : escHtml(typeof d.data[i] === 'object' ? JSON.stringify(d.data[i]) : d.data[i])}</td>`).join('') + (withN ? `<td>${escHtml(d0.nData[i] === undefined ? '' : d0.nData[i])}</td>` + (Array.isArray(d0.ciData) ? `<td>${escHtml(ciTxt(i))}</td>` : '') : '') + '</tr>').join('');
        return `<table class="vals"><thead>${head}</thead><tbody>${rows}</tbody></table>`;
    } catch (e) { return ''; }
}
// Paper has no taps, buttons or Settings screen: drop the screen-only instructions from printed notes
function printClean(html) {
    return String(html)
        .replace(/<(li|p)(?:\s[^>]*)?>(?:(?!<\/\1>)[\s\S])*?(?:\bTap (?:a|any|the|on)\b|\bPress\b|buttons? above|\bChoose (?:the|a|an) )(?:(?!<\/\1>)[\s\S])*?<\/\1>/gi, '')
        .replace(/;? ?\(?(?:not shown; )?to show them, turn on the option in Settings\)?/gi, '')
        .replace(/<(ul|ol)(?:\s[^>]*)?>\s*<\/\1>/gi, '');
}
function tilesToHtml(el) {
    const tiles = [...el.querySelectorAll('.grid > div')].filter(d => d.children.length >= 2);
    const items = (tiles.length ? tiles : [...el.children].filter(d => d.children.length >= 2)).map(d => { const ln = (d.children[1].innerText || d.children[1].textContent || '').split(/\n+/).map(x => x.trim()).filter(Boolean); return `<div class="tile"><div class="tl">${escHtml(d.children[0].textContent.trim())}</div><div class="tv">${escHtml(ln[0] || '')}</div>${ln.length > 1 ? `<div class="ts">${escHtml(ln.slice(1).join(' | '))}</div>` : ''}</div>`; }).join('');
    const notes = [...el.querySelectorAll(':scope > div > div.mt-2, :scope > div > p, :scope > p')].map(n => `<p class="tn">${escHtml(n.textContent.replace(/\s+/g, ' ').trim())}</p>`).join('');
    return `<div class="tiles">${items}</div>${notes}`;
}

const TAB_SECTIONS = { analytics: ['prevalence', 'patho', 'abx', 'heatmap', 'cum'], last_year: ['year'], last_month: ['month'], mdr: ['mdr'], lab: ['lab'] };

function printGroups(withWaiting) {
    const tab = window._currentTab || 'analytics';
    return (TAB_SECTIONS[tab] || []).map(id => SECTIONS[id]).filter(Boolean)
        .map(sec => {
            const off = !!document.querySelector('[data-sec="' + (sec.id === 'mdr' ? 'mdr_panel' : sec.id) + '"].sec-off');
            const items = off ? [] : sec.charts.map(c => ({ sec, c, el: chartElement(c), hint: c.hint || 'Nothing to show yet.' }))
                .filter(x => x.el || (withWaiting && document.querySelector(x.c.alt || x.c.el)));
            return { sec, items };
        }).filter(g => g.items.length);
}

// Printer button (top bar): choose exactly what to print from the open tab, then preview before printing
window.openPrintDialog = function () {
    const groups = printGroups(true);
    if (!groups.some(g => g.items.some(x => x.el))) { Swal.fire({ icon: 'info', title: 'Nothing to print yet', text: 'There are no charts on screen in this tab. Wait for the results to load.', confirmButtonText: 'OK', buttonsStyling: false, customClass: { popup: 'info-popup', title: 'info-title', htmlContainer: 'info-container', confirmButton: 'info-close' } }); return; }
    const flat = [];
    const saved = (() => { try { return JSON.parse(localStorage.getItem('amr_print_opts')) || {}; } catch (e) { return {}; } })();
    const rows = groups.map(g => `<div class="pd-h">${escHtml(sectionTitle(g.sec))}</div>` + g.items.map(x => {
        if (!x.el) return `<label class="pd-row pd-off"><input type="checkbox" disabled><span>${escHtml(chartTitleOf(x.c.title))}<small>${escHtml(x.hint)}</small></span></label>`;
        const i = flat.push(x) - 1; return `<label class="pd-row"><input type="checkbox" class="pd-chart" value="${i}" checked><span>${escHtml(chartTitleOf(x.c.title))}</span></label>`;
    }).join('')).join('');
    const sel = (id, opts, cur) => `<select id="${id}" class="pd-sel">${opts.map(o => `<option value="${o[0]}" ${o[0] === cur ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>`;
    const chk = (id, label, on) => `<label class="pd-row"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span>${label}</span></label>`;
    Swal.fire({
        title: 'Print or save as PDF',
        html: `<div class="pd">
            <div class="pd-h" style="margin-top:0">What to print from this screen</div>
            <label class="pd-row pd-all"><input type="checkbox" id="pd_all" checked><span>Select everything</span></label>
            <div class="pd-list">${rows}</div>
            <div class="pd-h">Page</div>
            <div class="pd-grid"><span>Paper</span>${sel('pd_paper', [['A4', 'A4'], ['Letter', 'US Letter']], saved.paper || 'A4')}
            <span>Orientation</span>${sel('pd_orient', [['auto', 'Automatic'], ['portrait', 'Portrait'], ['landscape', 'Landscape']], saved.orient || 'auto')}
            <span>Layout</span>${sel('pd_layout', [['compact', 'Compact (several per page)'], ['single', 'One chart per page']], saved.layout || 'compact')}</div>
            <div class="pd-h">Content</div>
            ${chk('pd_notes', 'Notes and definitions', saved.notes !== false)}
            ${chk('pd_refs', 'References', saved.refs !== false)}
            ${chk('pd_values', 'Data values table under each chart (with n and 95% CI)', saved.values !== false)}
            <div class="pd-h">Report title (optional)</div>
            <input id="pd_title" class="pd-input" type="text" maxlength="80" placeholder="e.g. hospital or department name" value="${escHtml(saved.title || '')}">
        </div>`,
        showCancelButton: true, confirmButtonText: 'Preview', cancelButtonText: 'Cancel', width: 'min(92vw, 440px)', buttonsStyling: false,
        customClass: { popup: 'info-popup', title: 'info-title', htmlContainer: 'info-container', confirmButton: 'info-close', cancelButton: 'info-cancel', actions: 'info-actions' },
        didOpen: () => {
            const all = document.getElementById('pd_all');
            all.addEventListener('change', () => document.querySelectorAll('.pd-chart').forEach(c => { c.checked = all.checked; }));
            document.querySelectorAll('.pd-chart').forEach(c => c.addEventListener('change', () => { all.checked = [...document.querySelectorAll('.pd-chart')].every(x => x.checked); }));
        },
        preConfirm: () => {
            const picked = [...document.querySelectorAll('.pd-chart')].filter(c => c.checked).map(c => parseInt(c.value, 10));
            if (!picked.length) { Swal.showValidationMessage('Select at least one item'); return false; }
            return { picked, paper: document.getElementById('pd_paper').value, orient: document.getElementById('pd_orient').value, layout: document.getElementById('pd_layout').value,
                notes: document.getElementById('pd_notes').checked, refs: document.getElementById('pd_refs').checked, values: document.getElementById('pd_values').checked, title: document.getElementById('pd_title').value.trim() };
        }
    }).then(r => {
        if (!r.isConfirmed || !r.value) return;
        const o = r.value;
        try { localStorage.setItem('amr_print_opts', JSON.stringify({ paper: o.paper, orient: o.orient, layout: o.layout, notes: o.notes, refs: o.refs, values: o.values, title: o.title })); } catch (e) {}
        const items = o.picked.map(i => flat[i]);
        const doc = withOpened(items, () => buildPrintDoc(items, o));
        showPrintPreview(doc);
    });
};

// collapsed cards hold zero-size canvases: open them briefly so charts render at full size, then restore
function withOpened(items, fn) {
    const reopened = [];
    const restore = [];   // [element, class] pairs removed temporarily (collapsed cards and collapsed result areas)
    items.forEach(({ el }) => { let p = el; while (p) { if (p.classList) ['hidden', 'res-collapsed'].forEach(k => { if (p.classList.contains(k) && !restore.some(r => r[0] === p && r[1] === k)) { p.classList.remove(k); restore.push([p, k]); } }); p = p.parentElement; } });
    void document.body.offsetWidth;   // force layout after the cards were opened
    items.forEach(({ el }) => { try { const ch = el.tagName === 'CANVAS' && window.Chart && Chart.getChart(el); if (ch) { const an = ch.options.animation; ch.options.animation = false; ch.resize(); ch.update('none'); ch.draw && ch.draw(); ch.options.animation = an; } } catch (e) {} });
    try { return fn(); } finally { restore.forEach(([p, k]) => p.classList.add(k)); }
}

// The print document has no Tailwind: copy the colours the screen shows into inline styles
function inlineColors(srcRoot) {
    const clone = srcRoot.cloneNode(true);
    const a = [srcRoot, ...srcRoot.querySelectorAll('*')], b = [clone, ...clone.querySelectorAll('*')];
    a.forEach((n, i) => {
        if (!b[i] || !b[i].style) return;
        const cs = getComputedStyle(n);
        if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') b[i].style.backgroundColor = cs.backgroundColor;
        b[i].style.color = cs.color; b[i].style.fontSize = cs.fontSize;
        if (cs.fontWeight && cs.fontWeight !== '400') b[i].style.fontWeight = cs.fontWeight;
        if (/^(TD|TH)$/.test(n.tagName)) b[i].style.textAlign = cs.textAlign;
    });
    return clone;
}
function buildPrintDoc(items, o) {
    const tabTitle = ($('#headerTitle').text() || 'AMR Trak').trim();
    const secs = []; items.forEach(x => { if (!secs.includes(x.sec)) secs.push(x.sec); });
    const labels = secs.map(s => s.labelSel ? ((document.querySelector(s.labelSel) || {}).textContent || '').replace(' - ' + scopeLabel(), '') : '').filter(Boolean);
    const context = [secs.length === 1 ? sectionTitle(secs[0]) : '', labels[0] || ''].filter(Boolean).join('  |  ');
    const landscape = o.orient === 'landscape';   // Automatic: portrait pages, and only the wide tables get landscape pages
    const autoWide = o.orient === 'auto';
    const hideNotes = document.body.classList.contains('no-sym-notes');
    const small = (c, el) => {
        if (c.kind === 'tiles' || c.landscape) return false;
        // two small tables share a row; the screen width of the phone says nothing about the page, so the size is judged by rows x columns
        if (c.kind === 'table') { const t = el.querySelector('table'); if (!t) return false; const rows = t.querySelectorAll('tbody tr').length, cols = Math.max.apply(null, [...t.querySelectorAll('tr')].map(r => r.children.length).concat([1])); return rows <= 12 && cols <= 5 && rows * cols <= 40; }
        return (el.clientWidth || el.width || 0) <= 520;
    };
    const keyHtml = (c, el) => {
        if (!o.notes || hideNotes) return '';
        let h = '';
        if (c.key) { const ul = document.getElementById('keylist_' + c.key); if (ul && ul.innerHTML.trim()) h += '<ul class="ck">' + ul.innerHTML + '</ul>'; }
        const nid = c.noteSel ? c.noteSel.slice(1) : (el.id && /_table$/.test(el.id) ? el.id.replace(/_table$/, '_note') : '');
        const nel = nid ? document.getElementById(nid) : null;
        if (nel && nel.innerHTML.trim()) h += '<div class="cn">' + nel.innerHTML + '</div>';
        if (c.legendSel) { const lg = document.querySelector(c.legendSel); if (lg && lg.textContent.trim()) h += '<div class="lg">' + inlineColors(lg).innerHTML + '</div>'; }
        // screen-only hints (tap / press) mean nothing on paper
        h = printClean(h);
        return h;
    };
    const blocks = secs.map(sec => {
        const mine = items.filter(x => x.sec === sec);
        const head = secs.length > 1 ? `<h3 class="secname">${escHtml(sectionTitle(sec))}</h3>` : '';
        return head + '<div class="grid">' + mine.map(({ c, el }) => {
            let media = '', vals = '';
            if (el.tagName === 'CANVAS') {
                const cv = document.createElement('canvas'); cv.width = el.width; cv.height = el.height;
                const g = cv.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(el, 0, 0);
                // a chart that drew nothing (for example it was created while hidden) is never printed as a blank box: its values are listed instead
                let blank = !el.width || !el.height; try { if (!blank) { const d = el.getContext('2d').getImageData(0, 0, el.width, el.height).data; blank = true; for (let i = 3; i < d.length; i += 4 * 17) { if (d[i]) { blank = false; break; } } } } catch (e) {}
                if (blank) { media = ''; vals = chartDataTable(el); } else {
                    media = `<img class="chart" src="${cv.toDataURL('image/png')}" alt="">`;
                    if (o.values) vals = chartDataTable(el);
                }
            } else if (c.kind === 'table') media = '<div class="tbl' + (c.landscape ? ' wide' : '') + '">' + inlineColors(el).innerHTML + '</div>';
            else media = tilesToHtml(el);
            const cls = (o.layout !== 'single' && small(c, el)) ? 'half' : 'full';
            const subTxt = typeof c.sub === 'function' ? c.sub() : '';
            return `<section class="blk ${cls}${autoWide && c.landscape ? ' pg-land' : ''}${c.kind === 'table' && cls === 'full' ? ' splittable' : ''}"><div class="keep"><h2>${escHtml(chartTitleOf(c.title))}</h2>${subTxt ? `<div class="sub">${escHtml(subTxt)}</div>` : ''}${c.kind === 'table' ? '' : media}</div>${c.kind === 'table' ? media : ''}${keyHtml(c, el)}${vals}</section>`;
        }).join('') + '</div>';
    }).join('');
    // filters in force, so the printed page states exactly what it shows
    const tab = window._currentTab || 'analytics', fl = [];
    fl.push(['Unit', scopeLabel()]);
    if (tab === 'analytics') {
        fl.push(['Analysis period', periodText()]);
        { const cn = combinedYearsNote(); if (cn) fl.push(['Combined years', cn.replace(/&sect;/g, '\u00a7')]); }
        const hs = items.some(x => x.sec.id === 'heatmap') ? ((document.getElementById('adv_start') || {}).value || '') + '|' + ((document.getElementById('adv_end') || {}).value || '') : '|';
        if (hs !== '|') fl.push(['Heatmap dates', (hs.split('|')[0] || 'first data') + ' to ' + (hs.split('|')[1] || 'latest data') + ' (replace the analysis period)']);
    }
    if (tab !== 'analytics' && tab !== 'lab' && labels[0]) fl.push(['Analysis period', labels[0]]);
    // Skin-flora contaminants concern blood isolates only: stated only when the printed data can contain blood, with the number found
    {
        let n = null, relevant = tab !== 'lab';
        try {
            if (tab === 'analytics') {
                const specs = items.map(x => x.sec.id === 'patho' ? anSpec.patho : x.sec.id === 'abx' ? anSpec.abx : x.sec.id === 'heatmap' ? anSpec.adv : x.sec.id === 'cum' ? anSpec.cum : 'all');
                relevant = specs.some(v => v === 'all' || v === 'blood' || v === 'nonurine' || (v && v.indexOf('sp:') === 0 && /blood/.test(v)));
                if (relevant) n = filterByPeriod(getDashRecords(), anPeriod()).filter(isPossibleContaminant).length;
            } else if (tab === 'last_year' && typeof yaRaw === 'function' && typeof yaYear === 'function') n = yaRaw(yaYear()).filter(isPossibleContaminant).length;
        } catch (e) { n = null; }
        if (relevant) {
            const ex = contamExcluded();
            const v = n === null ? (ex ? 'excluded from blood isolates' : 'not excluded')
                : n === 0 ? (ex ? 'excluded (none in this period)' : 'none in this period')
                : (ex ? 'excluded (' + n + ' isolate' + (n === 1 ? '' : 's') + ' removed)' : 'not excluded (' + n + ' isolate' + (n === 1 ? '' : 's') + ' in this period)');
            fl.push(['Skin-flora contaminants (blood)', v]);
        }
    }
    fl.push(['Minimum isolates for a reliable result', String(minN())]);
    const dstat = (document.getElementById('dashStatus') || {}).textContent;
    if (dstat) fl.push(['Data', dstat.trim()]);
    const filtersHtml = '<div class="flt">' + fl.map(([k, v]) => `<div><span>${escHtml(k)}</span><b>${escHtml(v)}</b></div>`).join('') + '</div>';
    let logo = ''; try { const im = document.querySelector('#brand img'); if (im && im.naturalWidth) { const lc = document.createElement('canvas'); lc.width = im.naturalWidth; lc.height = im.naturalHeight; lc.getContext('2d').drawImage(im, 0, 0); logo = lc.toDataURL('image/png'); } } catch (e) {}
    const used = [];
    // Notes only for the charts that are printed (plus the section's general notes); the same text is never printed twice
    const INFO_FOR = {
        'Organism Prevalence': 'sec_prevalence', 'AST Profile of the selected organism': 'abx_guidedAmrContainer',
        'Bacteria/Fungi Susceptibility Profile': ['sec_patho', 'abx_pathoAmrContainer'], 'Antimicrobial In Vitro Activity Profile': 'sec_abx', 'Advanced Heatmap': 'sec_heatmap', 'Cumulative Antibiogram': 'an_cum', 'Key resistance indicators (% resistant)': 'mdr_kri',
        'Summary': 'mdr_tiles', 'Resistance classification': 'mdr_panel', 'Monthly trend (% of classified isolates)': 'mdr_trend', 'All wards': 'mdr_wards', 'By organism group': 'mdr_group',
        'Priority alerts': 'op_m_alerts',
        'Key resistance indicators': 'ya_ind', 'ICU compared with non-ICU': 'ya_icu', 'ICU compared with non-ICU: susceptibility by organism': 'ya_icu',
        'Cumulative antibiogram (% susceptible)': 'ya_cum', 'Quarterly trend': 'ya_trend', 'Quarterly values': 'ya_trend', 'Antibiotic trend': 'ya_abx', 'Antibiotic trend values': 'ya_abx',
        'MDR / XDR / PDR by organism group': 'ya_mdr', 'Culture burden': 'ya_cult', 'Data quality': 'ya_qual',
        'Cultures received': 'lab_tiles', 'Blood cultures: contamination indicators': 'lab_blood', 'Culture volume per month': 'lab_volume', 'Positivity by ward': 'lab_wards', 'By specimen type': 'lab_sample'
    };
    const keysOf = c => [].concat(INFO_FOR[chartTitleOf(c.title)] || []);
    const seenHtml = {};
    const notes = secs.map(sec => {
        const claimed = new Set(); sec.charts.forEach(c => keysOf(c).forEach(k => claimed.add(k)));
        const want = new Set(); items.filter(x => x.sec === sec).forEach(x => keysOf(x.c).forEach(k => want.add(k)));
        return sec.infos.filter(([t, k]) => want.has(k) || !claimed.has(k)).map(([t, k]) => {
        const inf = INFO_STORE[k]; if (!inf) return '';
        const sig = printClean(inf.html); if (seenHtml[sig]) return ''; seenHtml[sig] = 1;
        (inf.refs || []).forEach(r => { if (!used.includes(r)) used.push(r); });
        return `<div class="note"><h3>${escHtml(t)}</h3>${sig}</div>`;
    }).join(''); }).join('');
    const refs = used.map(k => REFS[k]).filter(Boolean).map(r => `<li>${escHtml(r.t)} ${escHtml(r.u)}</li>`).join('');
    const when = new Date().toLocaleString([], { dateStyle: 'long', timeStyle: 'short' });
    return `<!doctype html><html><head><meta charset="utf-8"><title>${escHtml(tabTitle)}</title><style>

        @page { size: ${o.paper === 'Letter' ? 'Letter' : 'A4'} ${landscape ? 'landscape' : 'portrait'}; margin: 14mm; } @page land { size: ${o.paper === 'Letter' ? 'Letter' : 'A4'} landscape; margin: 14mm; } .pg-land { page: land; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #0f172a; margin: 0; }
        .brand { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: #64748b; font-weight: 700; }
        h1 { font-size: 20px; margin: 4px 0 4px; letter-spacing: -0.01em; }
        .ctx { font-size: 11px; color: #475569; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #cbd5e1; }
        .grid { display: block; text-align: center; }
        .blk { margin-bottom: 14px; text-align: center; ${o.layout === 'single' ? 'page-break-after: always; break-after: page;' : 'break-inside: auto; page-break-inside: auto;'} } .keep { break-inside: avoid; page-break-inside: avoid; } .blk.half { break-inside: avoid; page-break-inside: avoid; } table.vals tr { break-inside: avoid; page-break-inside: avoid; } table.vals thead { display: table-header-group; }
        .blk.splittable { break-inside: auto; page-break-inside: auto; } .splittable tr { break-inside: avoid; page-break-inside: avoid; } .splittable thead { display: table-header-group; } .blk.full { display: block; width: 100%; } .blk.half { display: inline-block; width: 49%; margin-left: .4%; margin-right: .4%; vertical-align: top; }
        .tbl table.ya-cum { table-layout: fixed; width: 100%; } .tbl table.ya-cum th:first-child, .tbl table.ya-cum td:first-child { width: 74px; text-align: left; } .tbl table.ya-cum td, .tbl table.ya-cum th { padding: 3px 0; overflow: hidden; } .tbl table.ya-cum * { font-size: 7px !important; }
        .tbl.wide { display: block; } .tbl.wide table { width: 100%; } .tbl.wide table.ya-cum { width: 100%; } .tbl.wide td, .tbl.wide th { word-break: break-word; padding: 2px 1px; } .tbl.wide table:not(.ya-cum) * { font-size: 7px !important; }
        .head { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; } .head img { height: 34px; width: auto; }
        .flt { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 18px; font-size: 10.5px; margin: 0 0 14px; padding: 8px 10px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px; } .flt div { display: flex; gap: 6px; } .flt span { color: #64748b; } .flt span:after { content: ':'; } .flt b { color: #0f172a; font-weight: 600; }
        .ck { list-style: none; margin: 6px auto 0; padding: 0; font-size: 9px; color: #475569; text-align: left; display: inline-block; max-width: 100%; } .ck li { margin: 0 0 2px; } .cn, .lg { font-size: 9px; color: #475569; text-align: left; margin-top: 6px; } .cn ul { margin: 0; padding-left: 14px; } .lg span { display: inline-block; padding: 1px 6px; margin: 0 4px 2px 0; border-radius: 3px; font-weight: 600; } .cn .note-list { margin: 0; }
        .blk:last-of-type { page-break-after: auto; break-after: auto; }
        h2 { font-size: 13px; margin: 0 0 4px; color: #0f172a; text-align: center; } .sub { font-size: 10px; color: #0f766e; font-weight: 600; margin: 0 0 6px; text-align: center; }
        .chart { display: block; max-width: 100%; ${o.layout === 'single' ? 'max-height: 620px;' : 'max-height: 380px;'} margin: 0 auto; object-fit: contain; }
        .tbl { display: flex; flex-direction: column; align-items: center; } .tbl > * { max-width: 100%; } .tbl a { text-decoration: none; color: inherit; } .tbl ul, .tbl ol { margin: 4px 0 0; padding-left: 14px; font-size: 9px !important; color: #475569; text-align: left; } .tbl li, .tbl li * { font-size: 9px !important; font-weight: 400; } .tbl li b, .tbl li b * { font-weight: 700; } .tbl table, table.vals { border-collapse: collapse; font-size: 9px; margin: 6px auto 0; } .tbl td, .tbl th, .vals td, .vals th { border: 1px solid #cbd5e1; padding: 3px 6px; text-align: center; } .vals th:first-child { text-align: left; }
        .tiles { display: flex; flex-wrap: wrap; gap: 8px; } .tile { border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 12px; min-width: 110px; } .tl { font-size: 9px; color: #64748b; font-weight: 600; } .tv { font-size: 15px; font-weight: 700; } .ts { font-size: 9px; color: #64748b; margin-top: 1px; } .tn { font-size: 10px; color: #475569; margin: 6px 0 0; }
        h4.sect { break-after: avoid; page-break-after: avoid; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #64748b; margin: 18px 0 6px; }
        .note { font-size: 10.5px; line-height: 1.55; color: #334155; margin-bottom: 8px; break-inside: avoid; } .note h3 { font-size: 11px; margin: 0 0 2px; color: #0f172a; } .note p { margin: 0 0 4px; } .note ul { margin: 2px 0 4px 16px; padding: 0; }
        ol { margin: 0; padding-left: 16px; font-size: 9.5px; line-height: 1.5; color: #475569; } li { margin-bottom: 3px; word-break: break-word; }
        .foot { margin-top: 16px; padding-top: 8px; border-top: 1px solid #cbd5e1; font-size: 9px; color: #94a3b8; }
        .secname { break-after: avoid; page-break-after: avoid; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: #0f766e; margin: 16px 0 6px; }
        .note h5 { font-size: 9.5px; text-transform: uppercase; letter-spacing: .06em; color: #0f766e; margin: 6px 0 2px; }
        @media screen { body { padding: 14px; max-width: 860px; margin: 0 auto; background: #fff; } .tbl { overflow-x: auto; } }
    </style></head><body>
        <div class="head">${logo ? `<img src="${logo}" alt="">` : ''}<div><div class="brand">${escHtml(o.title || 'AMR Trak')} &middot; Antimicrobial Resistance Surveillance</div><h1>${escHtml(tabTitle)}</h1></div></div>
        <div class="ctx">${escHtml(context)}</div>
        ${filtersHtml}
        ${blocks}
        ${o.notes && notes ? `<h4 class="sect">Notes and definitions</h4>${notes}` : ''}
        ${o.refs && refs ? `<h4 class="sect">References</h4><ol>${refs}</ol>` : ''}
        <div class="foot">Generated ${escHtml(when)}. De-identified surveillance data: first isolate per patient, organism and period (CLSI M39); screening cultures excluded; interpretation per CLSI M100.</div>
    </body></html>`;
}

// Preview before printing: the exact document is shown first; nothing is sent to the printer until the user confirms
// Scroll lock is released whenever no full-screen panel (guide or print preview) is open, however the panel was closed
window.unlockScrollIfIdle = function () {
    const gd = document.getElementById('guideView');
    if (!document.getElementById('printPreview') && !(gd && gd.classList.contains('open'))) document.body.classList.remove('gd-lock');
};
window.closePrintPreview = function () {
    const el = document.getElementById('printPreview'); if (el) el.remove();
    window.unlockScrollIfIdle();
};
function showPrintPreview(doc) {
    const old = document.getElementById('printPreview'); if (old) old.remove();
    const el = document.createElement('div'); el.id = 'printPreview';
    el.innerHTML = `<div class="pv-bar"><button type="button" id="pvBack">&lsaquo; Options</button><div class="pv-t">Print preview</div><button type="button" id="pvGo" class="pv-go">Print / Save PDF</button></div><iframe id="pvFrame" title="Print preview"></iframe>`;
    document.body.appendChild(el); document.body.classList.add('gd-lock');
    const f = el.querySelector('#pvFrame'); f.srcdoc = doc;
    const close = () => window.closePrintPreview();
    el.querySelector('#pvBack').onclick = () => { close(); openPrintDialog(); };
    el.querySelector('#pvGo').onclick = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { console.error(e); } };
}

// ---------- mount the toolbar in each section header ----------
function toolbarHtml() { return ''; }
function mountSectionToolbars() {
    // Collapsible card headers: [ title .......... print info  chevron ]
    [['prevalence', 'toggleGuidedSearch()'], ['patho', 'togglePathoSearch()'], ['abx', 'toggleAbxSearch()'], ['heatmap', 'toggleAdvancedSearch()'], ['cum', 'toggleAnCum()'], ['mdr', 'toggleMdrPanel()']].forEach(([id, fn]) => {
        const btn = document.querySelector(`button[onclick="${fn}"]`);
        if (!btn || btn.parentElement.classList.contains('sec-head')) return;
        const cls = btn.className.split(/\s+/);
        const wrap = document.createElement('div');
        wrap.className = 'sec-head ' + cls.filter(c => /^(bg-|border-b$|border-[a-z]+-\d+$)/.test(c)).join(' ');
        btn.parentNode.insertBefore(wrap, btn); wrap.appendChild(btn);
        btn.classList.add('sec-main');
        const chev = btn.querySelector(':scope > svg');
        const cb = document.createElement('button'); cb.className = 'sec-chev'; cb.setAttribute('aria-label', 'Expand or collapse');
        cb.setAttribute('onclick', fn); if (chev) cb.appendChild(chev); wrap.appendChild(cb);
    });
}
document.addEventListener('DOMContentLoaded', mountSectionToolbars);


// ---------- user settings (gear button): kept on this device only ----------
// Effective value of a setting: this device's choice, else the published default (Control app), else the built-in default
function effPref(k, shared, hard) {
    const u = getUserPrefs(); if (u[k] !== undefined && u[k] !== null && u[k] !== '') return u[k];
    const v = getDashSettings()[shared]; return (v !== undefined && v !== null && v !== '') ? v : hard;
}
function getUserPrefs() { try { return JSON.parse(localStorage.getItem('amr_user_prefs')) || {}; } catch (e) { return {}; } }
function setUserPref(k, v) { const u = getUserPrefs(); u[k] = v; try { localStorage.setItem('amr_user_prefs', JSON.stringify(u)); } catch (e) {} }
function usYears() { const set = {}; (getUserPrefs && getAllDashRecordsUnscoped()).forEach(r => { const y = String(r.Date || '').slice(0, 4); if (/^\d{4}$/.test(y)) set[y] = 1; }); const ys = Object.keys(set).sort().reverse(); return ys.length ? ys : [String(new Date().getFullYear())]; }
// Pop-up explanation for the two ways of counting a patient seen in two calendar years inside one 12-month period
function showDedupInfo() {
    if (document.getElementById('ddInfoOv')) return;
    const ov = document.createElement('div'); ov.id = 'ddInfoOv';
    ov.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:16px';
    const li = a => '<ul style="list-style:disc;padding-left:18px;margin:4px 0 10px;font-size:12px;color:#334155;line-height:1.5">' + a.map(x => '<li>' + x + '</li>').join('') + '</ul>';
    ov.innerHTML = '<div style="background:#fff;border-radius:16px;max-width:420px;width:100%;max-height:85vh;overflow:auto;padding:16px;text-align:left">'
        + '<div style="font-weight:700;font-size:14px;margin-bottom:6px">Repeat patient in a period that crosses New Year</div>'
        + li(['When it applies: only a period that crosses New Year, for example Last 12 Months (Oct 2025 to Sep 2026), All Times, a specific period, or Last 3 Months from Nov to Jan. A calendar-year view such as 2025 is not affected.', 'Example: the same patient has the same organism in Dec 2025 and again in Jan 2026, both inside the period.', 'It applies to patients confirmed as the same person across years. Unlinked patients are always identified by laboratory number and calendar year, because the number restarts every year.'])
        + '<div style="font-weight:700;font-size:13px">Count once (first isolate only)</div>'
        + li(['Only the first isolate (Dec 2025) is counted for the 12-month period, even though the period crosses New Year.', 'Longer periods are split into 12-month blocks that start at the first month with data, and the patient is counted once in each block.', 'This is the CLSI M39 rule: first isolate per patient per analysis period (Section 6.4).', 'It avoids counting the same infection twice.'])
        + '<div style="font-weight:700;font-size:13px">Count once in each calendar year</div>'
        + li(['Both isolates are counted: Dec 2025 as the 2025 isolate and Jan 2026 as the 2026 isolate (two isolates).', 'M39 suggests the calendar year only when several years are combined.', 'It is simpler, but it counts the same patient twice when a period crosses New Year.'])
        + '<button type="button" id="ddInfoClose" style="width:100%;margin-top:4px;padding:9px;border-radius:10px;background:#0d9488;color:#fff;font-weight:700;font-size:13px">Close</button></div>';
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    ov.querySelector('#ddInfoClose').addEventListener('click', close);
}
window.showUserSettings = function () {
    const u = getUserPrefs();
    const tg = (id, on) => `<label style="display:inline-block;position:relative;width:40px;height:22px;flex:none"><input type="checkbox" id="${id}" ${on ? 'checked' : ''} style="opacity:0;width:0;height:0"><span class="us-sl"></span></label>`;
    const row = (title, desc, ctl) => `<div style="display:flex;gap:10px;align-items:flex-start;justify-content:space-between;margin-bottom:14px"><div><b>${title}</b><div style="font-size:10.5px;color:#64748b;margin-top:2px">${desc}</div></div>${ctl}</div>`;
    const sel = (id, opts, cur) => `<select id="${id}" style="width:100%;margin-top:6px;border:1px solid #cbd5e1;border-radius:8px;padding:8px;font-size:12px;background:#fff">${opts.map(o => `<option value="${o[0]}" ${o[0] === cur ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>`;
    const blk = (title, desc, ctl) => `<div style="margin-bottom:14px"><b>${title}</b>${ctl}<div style="font-size:10.5px;color:#64748b;margin-top:4px">${desc}</div></div>`;
    const html = `<style>.us-sl{position:absolute;inset:0;background:#cbd5e1;border-radius:22px;transition:.2s}.us-sl:before{content:"";position:absolute;height:16px;width:16px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s}input:checked+.us-sl{background:#059669}input:checked+.us-sl:before{transform:translateX(18px)}</style>
    <div style="text-align:left;font-size:12px;color:#334155;max-height:62vh;overflow-y:auto;padding-right:4px">
      ${row('Exclude possible skin-flora contaminants', 'Removes blood isolates of skin-flora organisms (for example coagulase-negative staphylococci) before the first isolate is chosen. Applies to every tab and chart.', tg('us_contam', contamExcluded()))}
      ${blk('Default unit filter', 'The unit filter selected when the dashboard opens.', sel('us_scope', [['all', 'ALL'], ['icu', 'ICU'], ['nonicuip', 'Non-ICU IP'], ['outpatient', 'Outpatient']], getUnitScope()))}
      ${blk('Analysis period (Analytics tab)', 'One period for every Analytics chart. All completed years combines consecutive complete calendar years only. All times combines every month available, including incomplete years. The Heatmap From/To fields, when filled, override it.', sel('us_period', [['year', 'Last 12 Months'], ['all', 'All completed years'], ['alltimes', 'All times'], ['calyear', 'Calendar year'], ['quarter', 'Last 3 Months'], ['month', 'Last Month'], ['range', 'Specific period']], anPeriod()) + `<div id="us_all_warn" style="display:none;margin-top:6px;font-size:11px;line-height:1.45;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:6px 8px;color:#92400e;text-align:left"><ul style="margin:0;padding-left:16px;list-style:disc"><li>Several years are combined into one percentage.</li><li>CLSI M39 Section 6.4: combine years only when the number of isolates per year is small and the percent susceptible has not changed significantly.</li><li>If resistance is rising or falling, the combined figure hides the change and does not describe the present situation.</li><li>Check the trend first: Annual Report tab, Quarterly trend and Antibiotic trend.</li><li id="us_all_extra">All times also includes incomplete years, which over-represent some seasons, so results may be less accurate and not comparable between years.</li></ul></div><div id="us_short_warn" style="display:none;margin-top:6px;font-size:11px;line-height:1.45;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:6px 8px;color:#92400e;text-align:left"><ul style="margin:0;padding-left:16px;list-style:disc"><li>A period shorter than one year may be affected by seasonal variation in resistance rates.</li><li>Short periods hold few isolates, so the percentages are imprecise.</li><li>CLSI M39 Section 6.3 recommends analysing cumulative data at least once a year.</li></ul></div><div id="us_cal" style="display:none;margin-top:6px">${sel('us_pyear', usYears().map(y => [y, y]), String(u.pyear || usYears()[0]))}</div><div id="us_rng" style="display:none;margin-top:6px;gap:6px"><input type="month" id="us_pfrom" value="${u.pfrom || ''}" style="flex:1;border:1px solid #cbd5e1;border-radius:8px;padding:7px;font-size:12px"><input type="month" id="us_pto" value="${u.pto || ''}" style="flex:1;border:1px solid #cbd5e1;border-radius:8px;padding:7px;font-size:12px"></div>`)}
      ${blk('Annual Report tab period', 'Calendar year (default) is the last complete calendar year (CLSI M39, Section 6.4). Last 12 months moves forward with the data.', sel('us_yamode', [['calendar', 'Calendar year'], ['rolling', 'Last 12 months']], (typeof yaMode === 'function') ? yaMode() : 'calendar'))}
      <div style="margin-bottom:14px"><b>Repeat patient in a period that crosses New Year</b> <button type="button" id="us_dd_i" aria-label="Explain" style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;border:1px solid #94a3b8;color:#475569;font-size:11px;font-weight:700;margin-left:4px">i</button>
        ${sel('us_dedup', [['block', 'Count once (first isolate only)'], ['calyear', 'Count once in each calendar year']], dedupMode())}
        <div style="font-size:10.5px;color:#64748b;margin-top:4px">Applies to any period that crosses New Year (Last 12 Months, All Times, a specific period, Last 3 Months in Dec to Feb), for patients confirmed as the same person across years. Calendar-year views are not affected. Tap (i) for what each option does.</div></div>
      ${row('Show organisms with fewer than 30 isolates', 'Annual Report tab antibiogram. Off by default: organisms below 30 isolates are listed in a note only. When on, they appear as grey rows marked * (indicative only, CLSI M39 Section 7.2.2).', tg('us_small', u.showsmall === true))}
      ${row('Show explanation notes under charts', 'Notes about symbols, colours and sample size. Warnings about incomplete periods and the unit banner always stay.', tg('us_notes', effNotes()))}
      <div style="font-size:10.5px;color:#64748b">These settings are saved on this device only.</div>
    </div>`;
    Swal.fire({ title: 'Settings', html, didOpen: () => { const di = document.getElementById('us_dd_i'); if (di) di.addEventListener('click', showDedupInfo); const f = () => { const v = document.getElementById('us_period').value; document.getElementById('us_cal').style.display = v === 'calyear' ? '' : 'none'; document.getElementById('us_rng').style.display = v === 'range' ? 'flex' : 'none'; document.getElementById('us_all_warn').style.display = (v === 'alltimes' || v === 'all') ? '' : 'none'; document.getElementById('us_all_extra').style.display = v === 'alltimes' ? '' : 'none'; document.getElementById('us_short_warn').style.display = (v === 'quarter' || v === 'month') ? '' : 'none'; }; document.getElementById('us_period').addEventListener('change', f); f(); }, confirmButtonText: 'Save', showCancelButton: true, showDenyButton: true, denyButtonText: 'Reset to defaults', buttonsStyling: false, width: 'min(92vw, 440px)', customClass: { popup: 'info-popup teal-frame', title: 'info-title', htmlContainer: 'info-container', confirmButton: 'info-close', denyButton: 'info-deny', cancelButton: 'info-cancel', actions: 'info-actions' }, focusConfirm: false,
        preConfirm: () => ({ nocontam: document.getElementById('us_contam').checked, period: document.getElementById('us_period').value, pyear: document.getElementById('us_pyear').value, pfrom: document.getElementById('us_pfrom').value, pto: document.getElementById('us_pto').value, scope: document.getElementById('us_scope').value,
            yamode: document.getElementById('us_yamode').value, dedup: document.getElementById('us_dedup').value, showsmall: document.getElementById('us_small').checked, notes: document.getElementById('us_notes').checked }) })
    .then(r => {
        if (r.isDenied) { try { localStorage.removeItem('amr_user_prefs'); localStorage.removeItem('amr_ya_mode'); } catch (e) {} _unitScope = null; applyUserPrefsUI(true); try { refreshAll(); loadAnalyticsFilters(); } catch (e) {} return; }
        if (!r.isConfirmed) return;
        const v = r.value;
        // only choices that differ from the published defaults are kept on this device, so later changes of the defaults still reach this user
        const sh = getDashSettings(), def = { nocontam: sh.mobile_dash_nocontam === true, period: sh.dash_an_period || 'year', scope: sh.dash_default_scope === 'nonicu' ? 'nonicuip' : (sh.dash_default_scope || 'all'), notes: sh.dash_show_notes !== false };
        const uu = getUserPrefs();
        ['nocontam', 'period', 'scope', 'notes'].forEach(k => { if (v[k] === def[k]) delete uu[k]; else uu[k] = v[k]; });
        if (v.showsmall) uu.showsmall = true; else delete uu.showsmall;
        if (v.dedup === (sh.dash_dedup_mode === 'calyear' ? 'calyear' : 'block')) delete uu.dedup; else uu.dedup = v.dedup;
        ['pyear', 'pfrom', 'pto'].forEach(k => { if (uu.period === 'calyear' || uu.period === 'range') uu[k] = v[k]; else delete uu[k]; });
        try { localStorage.setItem('amr_user_prefs', JSON.stringify(uu)); } catch (e) {}
        try { if (v.yamode === (sh.dash_ya_mode === 'rolling' ? 'rolling' : 'calendar')) localStorage.removeItem('amr_ya_mode'); else localStorage.setItem('amr_ya_mode', v.yamode); } catch (e) {}
        applyUserPrefsUI(true);
        _unitScope = v.scope;
        try { refreshAll(); } catch (e) { console.error(e); }
        try { loadAnalyticsFilters(); refreshPeriodHints(); } catch (e) {}
    });
};
// Applies the saved device settings to the page
function effNotes() { const u = getUserPrefs(); return typeof u.notes === 'boolean' ? u.notes : getDashSettings().dash_show_notes !== false; }
function applyUserPrefsUI(fire) {
    const u = getUserPrefs();
    document.body.classList.toggle('no-sym-notes', !effNotes());
}
$(function () {
    applyUserPrefsUI(false);
});

// Long tables (more than 8 rows): the header row stays visible while scrolling; the first column is already sticky
(function () {
    let pend = false;
    function mark() {
        pend = false;
        document.querySelectorAll('.ya-scroll').forEach(el => {
            const rows = el.querySelectorAll('tbody tr').length;
            el.classList.toggle('ya-tall', rows > 8);
        });
    }
    function sched() { if (!pend) { pend = true; requestAnimationFrame(mark); } }
    function start() { new MutationObserver(sched).observe(document.body, { childList: true, subtree: true }); sched(); }
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
