// =====================================================================
// Dashboard panels: display settings, ICU / non-ICU scope, period pickers,
// MDR / XDR / PDR analysis panel and the Lab Quality tab.
// Loaded after dashboard.js (shares its globals).
// =====================================================================

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
        $('#headerTitle').text('Lab Quality');
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

    setInfo('mdr_panel', 'MDR / XDR / PDR classification', mdrInfoHtml(possibleX, possibleP) +
        '<p style="margin-top:8px">Counts use first isolates only (one per patient, organism and year, CLSI M39). Percentages are of classified isolates; organisms outside the Magiorakos category lists are not classified.</p>');
    attachInfo('#mdrPanel .mdr-title', 'mdr_panel');

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

// ---------- Lab Quality tab ----------
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
            <div><div class="text-[9px] font-bold text-slate-500">Contamination</div><div class="text-sm font-black text-${tone}-700">${lo === hi ? lo + '%' : lo + ' - ' + hi + '%'}</div></div>
          </div>
          <p class="text-[9px] text-slate-500 mt-2 leading-snug">Lab-flagged: ${blood.con} culture(s). Possible skin-flora growth (CoNS, Corynebacterium, Micrococcus...): ${possKeys.size}. Benchmark: 3% or less.</p>
        </div>` : '<p class="text-xs text-slate-400 text-center">No blood cultures in this period.</p>');
    setInfo('lab_blood', 'Blood culture contamination', `<p>Contamination = blood cultures where growth does not reflect true bacteraemia. The commonly used benchmark is <b>3% or less</b> of blood cultures (ASM / CAP Q-Probes / CLSI M47).</p>
        <p style="margin-top:8px"><b>Lab-flagged</b> (certain): cultures the laboratory reported as contaminated.</p>
        <p style="margin-top:8px"><b>Possible</b> (not certain): blood isolates of usual skin flora (CoNS, Corynebacterium, Micrococcus, viridans streptococci...). One positive set cannot be proven a contaminant from this data, because the number of sets drawn and the clinical picture are not recorded. They are counted as <i>possible</i> and shown as the upper end of the range.</p>
        <p style="margin-top:8px">A range such as "2.1 - 5.4%" means the true rate lies between the two values. Reduce the range by recording the number of positive sets in the future.</p>`);
    attachInfo('#lab_blood_title', 'lab_blood');

    setInfo('lab_def', 'How these numbers are made', `<p>Counts come from the monthly WHONET export. One <b>culture</b> = one patient + date + specimen type (several organisms from the same specimen count once).</p>
        <ul style="margin:6px 0 0 16px;list-style:disc"><li><b>Positive:</b> an organism was reported.</li><li><b>No growth:</b> no organism (xxx / no growth).</li><li><b>Contaminated:</b> reported as contaminated by the lab.</li></ul>
        <p style="margin-top:8px">Only counts are stored, never patient rows. Screening cultures are included here (they are only excluded from resistance statistics).</p>`);
    attachInfo('#lab_title', 'lab_def');

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

    // Volume alert: a month far below the others usually means an incomplete file, not a real drop
    const vols = ml.map(m => perMonth[m].g + perMonth[m].ng + perMonth[m].con);
    const alerts = [];
    if (ml.length >= 3) {
        const mean = vols.reduce((a, b) => a + b, 0) / vols.length;
        ml.forEach((m, i) => {
            if (vols[i] < mean * 0.5) alerts.push(`${monthLabel(m)}: only ${vols[i]} cultures (average ${Math.round(mean)}). The file may be incomplete.`);
            else if (vols[i] > mean * 1.6) alerts.push(`${monthLabel(m)}: ${vols[i]} cultures (average ${Math.round(mean)}). Unusually high volume; check for an outbreak work-up or screening campaign.`);
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
    $('#lab_sample_table').html(`<table class="w-full text-[10px]"><thead><tr class="text-slate-500"><th class="text-left pb-1">Specimen</th><th>n</th><th>Positive</th><th>No growth</th><th>Contam.</th></tr></thead><tbody>${srows}</tbody></table><p class="text-[9px] text-slate-400 mt-1">Grey ward bars: fewer than 30 cultures.</p>`);
}
function escapeHtmlDash(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
