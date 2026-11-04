// =====================================================================
// Dashboard panels: display settings, ICU / non-ICU scope, period pickers,
// MDR / XDR / PDR analysis panel and the Culture Overview tab.
// Loaded after dashboard.js (shares its globals).
// =====================================================================

setInfo('scope', 'Unit scope', `<p>The switch filters every chart on the dashboard by the ward where the specimen was collected.</p>
<ul><li><b>All units:</b> every ward, including outpatients.</li><li><b>ICU:</b> only the wards counted as intensive care units. The list is set in the data-entry app; neonatal and paediatric ICUs are included only if they are selected there.</li><li><b>Non-ICU:</b> all other wards, including outpatients and neonatal units.</li></ul>
<p><b>Why separate ICU?</b> Antimicrobial exposure, invasive device use and patient risk differ between intensive care and other wards, so pooled results can hide ICU-specific resistance. CLSI M39 supports stratifying cumulative susceptibility data by patient location.</p>
<p>First-isolate de-duplication is applied within the selected scope.</p>`);

// ---------- settings (written by the data-entry app, delivered in the public document) ----------
function getDashSettings() {
    try { return JSON.parse(localStorage.getItem('amr_live_settings')) || {}; } catch (e) { return {}; }
}
function dashFlag(key) { return getDashSettings()[key] !== false; }
function icuWardList() {
    const w = getDashSettings().dash_icu_wards;
    return (Array.isArray(w) && w.length) ? w : ['ICU'];
}

// ---------- unit scope: All units / ICU only / Non-ICU ----------
let _unitScope = null;
function getUnitScope() { return _unitScope || getDashSettings().dash_default_scope || 'all'; }
function wardInScope(ward, scope) {
    if (scope === 'all') return true;
    const isIcu = icuWardList().some(w => String(w).toLowerCase() === String(ward || '').toLowerCase());
    return scope === 'icu' ? isIcu : !isIcu;
}
function scopeLabel() { const s = getUnitScope(); return s === 'icu' ? 'ICU only' : s === 'nonicu' ? 'Non-ICU units' : 'All units'; }
// Every chart reads records through this function so the scope applies everywhere.
function getDashRecords() {
    let all = [];
    try { all = JSON.parse(localStorage.getItem('amr_dash_records')) || []; } catch (e) {}
    const scope = getUnitScope();
    return scope === 'all' ? all : all.filter(r => wardInScope(r.Ward, scope));
}
function getAllDashRecordsUnscoped() {
    try { return JSON.parse(localStorage.getItem('amr_dash_records')) || []; } catch (e) { return []; }
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
    [['month', 'LastMonth'], ['quarter', 'LastQuarter'], ['lab', 'Lab']].forEach(([t, id]) => {
        $('#btnNav' + id).toggleClass('sec-off', s['tab_' + t] === false);
    });
    $('#scopeBar').toggleClass('sec-off', s.dash_show_scope === false);
    updateScopeBar();
    // leave a tab that was switched off
    const cur = window._currentTab || 'analytics';
    if ((cur === 'last_month' && s.tab_month === false) || (cur === 'last_quarter' && s.tab_quarter === false) || (cur === 'lab' && s.tab_lab === false)) switchTab('analytics');
}

function refreshAll() {
    applyDashboardSettings();
    try { loadAnalyticsFilters(); } catch (e) { console.error(e); }
    try { generateLiveSurveillance(); } catch (e) { console.error(e); }
    try { renderMdrPanel(); } catch (e) { console.error(e); }
    try { renderLabQuality(); } catch (e) { console.error(e); }
}

// ---------- tabs ----------
window.switchTab = function (tab) {
    window._currentTab = tab;
    $('#viewAnalytics, #viewLastMonth, #viewLastQuarter, #viewLab').addClass('hidden');
    $('#btnNavAnalytics, #btnNavLastMonth, #btnNavLastQuarter, #btnNavLab').removeClass('active');
    if (tab === 'analytics') {
        $('#viewAnalytics').removeClass('hidden'); $('#btnNavAnalytics').addClass('active');
        $('#headerTitle').text('Surveillance Analytics');
        if (!isUpdatingFilters) loadAnalyticsFilters();
    } else if (tab === 'last_month') {
        $('#viewLastMonth').removeClass('hidden'); $('#btnNavLastMonth').addClass('active');
        $('#headerTitle').text('Last Month Surveillance');
    } else if (tab === 'last_quarter') {
        $('#viewLastQuarter').removeClass('hidden'); $('#btnNavLastQuarter').addClass('active');
        $('#headerTitle').text('Last Quarter Surveillance');
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
    try { Object.keys((JSON.parse(localStorage.getItem('amr_dash_lab')) || {}).months || {}).forEach(m => set.add(m)); } catch (e) {}
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
    if (PERIOD_STATE[id]) return PERIOD_STATE[id];
    const latest = months[months.length - 1] || new Date().toISOString().slice(0, 7);
    const cq = completeQuarterOf(latest);
    const def = getDashSettings().dash_default_period;
    PERIOD_STATE[id] = {
        type: ['month', 'quarter', 'year', 'range', 'all'].includes(def) ? def : 'month',
        month: latest, qYear: cq.y, q: cq.q, year: latest.slice(0, 4),
        from: months[Math.max(0, months.length - 6)] || latest, to: latest
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
function renderMdrPanel() {
    if (!document.getElementById('mdrPanel')) return;
    const range = renderPeriodPickerOnce('mdr', renderMdrPanel);
    destroyPanelCharts('mdr');
    const all = getDashRecords().filter(r => r.Date && r.Date.slice(0, 7) >= range.from && r.Date.slice(0, 7) <= range.to);
    const recs = applyDeduplication(all);
    $('#mdr_range_label').text(`${range.label} - ${scopeLabel()}`);

    const counts = { 'Non-MDR': 0, 'MDR': 0, 'XDR': 0, 'PDR': 0 };
    const byWard = {}, byMonth = {}, byGroup = {};
    let possibleX = 0, possibleP = 0, n = 0;
    recs.forEach(r => {
        const res = classifyMDR(r);
        if (!res) return;
        n++; counts[res.cls]++;
        if (res.possibleXDR) possibleX++;
        if (res.possiblePDR) possibleP++;
        const w = r.Ward || 'Unknown';
        (byWard[w] = byWard[w] || { 'Non-MDR': 0, 'MDR': 0, 'XDR': 0, 'PDR': 0, total: 0 })[res.cls]++; byWard[w].total++;
        const m = r.Date.slice(0, 7);
        (byMonth[m] = byMonth[m] || { 'Non-MDR': 0, 'MDR': 0, 'XDR': 0, 'PDR': 0, total: 0 })[res.cls]++; byMonth[m].total++;
        const g = res.group;
        (byGroup[g] = byGroup[g] || { 'Non-MDR': 0, 'MDR': 0, 'XDR': 0, 'PDR': 0, total: 0, px: 0, pp: 0 })[res.cls]++; byGroup[g].total++;
        if (res.possibleXDR) byGroup[g].px++;
        if (res.possiblePDR) byGroup[g].pp++;
    });

    const worse = counts.MDR + counts.XDR + counts.PDR;
    $('#mdr_tiles').html([
        ['Classified isolates', n, 'text-slate-800'],
        ['MDR or worse', n ? `${worse} (${pct(worse, n)}%)` : '-', 'text-amber-600'],
        ['XDR or worse', n ? `${counts.XDR + counts.PDR} (${pct(counts.XDR + counts.PDR, n)}%)` : '-', 'text-rose-600'],
        ['PDR', n ? counts.PDR : '-', 'text-red-900']
    ].map(t => `<div class="bg-slate-50 border border-slate-100 rounded-lg p-2 text-center"><div class="text-[9px] font-bold text-slate-500">${t[0]}</div><div class="text-sm font-black ${t[2]}">${t[1]}</div></div>`).join(''));

    setInfo('mdr_panel', 'MDR / XDR / PDR analysis', mdrInfoHtml(possibleX, possibleP));
    attachInfo('#mdrPanel .mdr-title', 'mdr_panel');
    setInfo('mdr_tiles', 'Summary figures', '<p><b>Classified isolates:</b> first isolates that could be assigned a class (Enterobacterales, <i>P. aeruginosa</i>, <i>Acinetobacter</i> spp., <i>S. aureus</i>).</p><p style="margin-top:8px"><b>MDR or worse:</b> MDR, XDR and PDR combined. <b>XDR or worse:</b> XDR and PDR combined. Percentages are of classified isolates in the selected period and unit scope.</p>');
    attachInfo('#mdr_tiles_title', 'mdr_tiles');
    setInfo('mdr_trend', 'Monthly trend', '<p>Share of classified isolates in each class per month (MDR, XDR, PDR stacked). Months with few isolates vary widely; read the trend over several months rather than a single bar.</p>');
    attachInfo('#mdr_trend_title', 'mdr_trend');
    setInfo('mdr_wards', 'Distribution by ward', '<p>Classified first isolates per ward, split by class. The number in brackets is the total classified isolates for that ward. Wards are ordered by the number of MDR or worse isolates. Isolates are de-duplicated across the whole selected period, so a patient moving between wards is counted once, in the ward of the first isolate.</p>');
    attachInfo('#mdr_wards_title', 'mdr_wards');
    setInfo('mdr_group', 'By organism group', '<p>MDR+ = MDR, XDR or PDR. Groups with fewer than 30 isolates are marked with * and should be interpreted with caution (CLSI M39). "Poss." figures are isolates tested against too few categories to confirm XDR or PDR; they are shown for information and are not included in the XDR+ or PDR columns.</p>');
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
            data: { labels: monthList.map(m => MONTH_NAMES[parseInt(m.slice(5, 7), 10) - 1] + " '" + m.slice(2, 4)), datasets: ds },
            options: Object.assign({}, ctxOpts, {
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9, weight: 'bold' } } }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.raw}%` } } },
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
            labels: wards.map(w => (w.length > 22 ? w.slice(0, 20) + '..' : w) + ` (${byWard[w].total})`),
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
    const rows = Object.keys(byGroup).sort((a, b) => byGroup[b].total - byGroup[a].total).map(g => {
        const x = byGroup[g], w = x.MDR + x.XDR + x.PDR;
        const poss = (x.px || x.pp) ? ` <span class="text-slate-400">(+${x.px} poss. XDR${x.pp ? ', +' + x.pp + ' poss. PDR' : ''})</span>` : '';
        return `<tr class="border-t border-slate-100"><td class="py-1.5 pr-2 font-bold text-slate-700">${gnames[g] || g}</td><td class="text-center">${x.total}${x.total < 30 ? '*' : ''}</td><td class="text-center text-amber-600 font-bold">${pct(w, x.total)}%</td><td class="text-center text-rose-600 font-bold">${x.XDR + x.PDR}${poss}</td><td class="text-center text-red-900 font-bold">${x.PDR}</td></tr>`;
    }).join('');
    $('#mdr_group_table').html(rows ? `<table class="w-full text-[10px]"><thead><tr class="text-slate-500"><th class="text-left pb-1">Group</th><th>n</th><th>MDR+</th><th>XDR+</th><th>PDR</th></tr></thead><tbody>${rows}</tbody></table><p class="text-[9px] text-slate-400 mt-1">* fewer than 30 isolates: interpret with caution. MDR+ = MDR, XDR or PDR.</p>` : '<p class="text-xs text-slate-400 text-center">No classifiable isolates in this period.</p>');
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
function getLabData() { try { return JSON.parse(localStorage.getItem('amr_dash_lab')) || {}; } catch (e) { return {}; } }

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
    const bloodRecs = getDashRecords().filter(r => r.Date && r.Date.slice(0, 7) >= range.from && r.Date.slice(0, 7) <= range.to && isPossibleContaminant(r));
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
            datasets: [{ label: 'Positivity %', data: wards.map(w => pct(perWard[w].g, wt(w))), backgroundColor: wards.map(w => wt(w) >= 30 ? '#0d9488' : '#94a3b8'), borderRadius: 3 }]
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
function escapeHtmlDash(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }


// =====================================================================
// Printing: every chart gets a small printer button (Lucide "printer" icon, monochrome).
// The result is a one-page, print-ready sheet (save as PDF from the print dialog).
// =====================================================================
const PRINTER_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>';

function headingBefore(el) {
    const nodes = document.querySelectorAll('h3, h4, canvas, #heatmapWrapper');
    let last = '';
    for (const n of nodes) {
        if (n === el) break;
        if (n.tagName === 'H3' || n.tagName === 'H4') {
            const c = n.cloneNode(true);
            c.querySelectorAll('.info-btn, .print-btn').forEach(x => x.remove());
            const t = c.textContent.replace(/\s+/g, ' ').trim();
            if (t) last = t;
        }
    }
    return last;
}
function infoKeyFor(el) {
    if (el.closest('[data-sec="mdr"], #mdrPanel')) return 'mdr_panel';
    let p = el.parentElement;
    while (p && p !== document.body) {
        const b = p.querySelector(':scope > .info-btn');
        if (b) return b.dataset.key;
        p = p.parentElement;
    }
    return null;
}
function escHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

window.printChart = function (el) {
    const isTable = el.id === 'heatmapWrapper';
    const title = isTable ? 'Advanced Heatmap' : (headingBefore(el) || 'Chart');
    const card = el.closest('.mobile-card') || document.body;
    const labelEl = card.querySelector('#mdr_range_label, #lab_range_label, #live_month_title, #live_q_title');
    const context = [document.getElementById('headerTitle').textContent, labelEl ? labelEl.textContent : '', 'Unit scope: ' + scopeLabel()].filter(Boolean).join('  |  ');
    const key = infoKeyFor(el);
    const info = key && INFO_STORE[key] ? INFO_STORE[key] : null;
    let body;
    if (isTable) body = '<div class="tbl">' + el.innerHTML + '</div>';
    else {
        const c = document.createElement('canvas');
        c.width = el.width; c.height = el.height;
        const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(el, 0, 0);
        body = `<img class="chart" src="${c.toDataURL('image/png')}" alt="${escHtml(title)}">`;
    }
    const refKeys = info ? info.refs : refsFor(key);
    const when = new Date().toLocaleString([], { dateStyle: 'long', timeStyle: 'short' });
    const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${escHtml(title)}</title><style>
        @page { size: ${isTable ? 'A4 landscape' : 'A4 portrait'}; margin: 14mm; }
        * { box-sizing: border-box; }
        body { font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #0f172a; margin: 0; }
        .brand { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: #64748b; font-weight: 700; }
        h1 { font-size: 20px; margin: 4px 0 4px; letter-spacing: -0.01em; }
        .ctx { font-size: 11px; color: #475569; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid #cbd5e1; }
        .chart { display: block; max-width: 100%; max-height: 520px; margin: 0 auto 14px; object-fit: contain; }
        .tbl table { border-collapse: collapse; font-size: 9px; } .tbl td, .tbl th { border: 1px solid #cbd5e1; padding: 3px 5px; text-align: center; }
        h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #64748b; margin: 16px 0 6px; }
        .notes { font-size: 11px; line-height: 1.6; color: #334155; } .notes p { margin: 0 0 6px; } .notes ul { margin: 4px 0 6px 16px; padding: 0; }
        ol { margin: 0; padding-left: 16px; font-size: 9.5px; line-height: 1.5; color: #475569; } li { margin-bottom: 3px; word-break: break-word; }
        .foot { margin-top: 18px; padding-top: 8px; border-top: 1px solid #cbd5e1; font-size: 9px; color: #94a3b8; }
    </style></head><body>
        <div class="brand">AMR Trak &middot; Antimicrobial Resistance Surveillance</div>
        <h1>${escHtml(title)}</h1>
        <div class="ctx">${escHtml(context)}</div>
        ${body}
        ${info ? `<h2>Notes and definitions</h2><div class="notes">${info.html}</div>` : ''}
        <h2>References</h2><ol>${refKeys.map(k => REFS[k]).filter(Boolean).map(r => `<li>${escHtml(r.t)} ${escHtml(r.u)}</li>`).join('')}</ol>
        <div class="foot">Generated ${escHtml(when)}. De-identified surveillance data: first isolate per patient, organism and year (CLSI M39); screening cultures excluded. Interpretation: CLSI M100.</div>
    </body></html>`;
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(f);
    f.contentDocument.open(); f.contentDocument.write(doc); f.contentDocument.close();
    setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { console.error(e); } }, 350);
    setTimeout(() => f.remove(), 120000);
};

function attachPrintButtons() {
    const targets = [...document.querySelectorAll('canvas')].map(cv => ({ el: cv, host: cv.parentElement }));
    const hm = document.getElementById('heatmapWrapper');
    if (hm && hm.querySelector('table')) targets.push({ el: hm, host: hm.parentElement });
    targets.forEach(t => {
        if (!t.host || t.host.querySelector(':scope > .print-btn')) return;
        if (getComputedStyle(t.host).position === 'static') t.host.style.position = 'relative';
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'print-btn'; b.title = 'Print / save as PDF'; b.setAttribute('aria-label', 'Print this chart');
        b.innerHTML = PRINTER_SVG;
        b.addEventListener('click', () => printChart(t.el));
        t.host.appendChild(b);
    });
}
(function () {
    let timer = null;
    const run = () => { clearTimeout(timer); timer = setTimeout(attachPrintButtons, 200); };
    if (document.body) new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', run);
})();
