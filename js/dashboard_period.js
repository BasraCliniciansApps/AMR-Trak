// =====================================================================
// Last Month and Last 3 Months panels (operational and analytical views)
//   Month   : priority alerts, possible clusters, comparison with the previous month and the same month last year
//   Quarter : run chart of the last 8 quarters, ICU vs non-ICU, ward ranking
// All figures use first isolates per patient and organism within the reported period (CLSI M39).
// =====================================================================
const OP = { chart: null };
const OP_EXCL = ['xxx', 'con', 'no growth', 'contaminated', 'normal flora', 'mixed flora', 'no significant growth'];
const OP_COLORS = { '3GC-R': '#2563eb', 'CRE': '#e11d48', 'CRAB': '#7c3aed', 'CRPA': '#f59e0b', 'MRSA': '#0d9488', 'VRE': '#475569', 'VRSA': '#b91c1c' };
const OP_CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';

function opClean(records) {
    return records.filter(r => {
        const o = String(r['Selective organism'] || '').trim().toLowerCase();
        return o && !OP_EXCL.some(b => o.includes(b));
    });
}
const opYM = r => String(r.Date || '').slice(0, 7);
function opInRange(records, from, to) { return records.filter(r => { const m = opYM(r); return m >= from && m <= to; }); }
function opShiftMonth(ym, d) { let [y, m] = ym.split('-').map(Number); m += d; while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; } return y + '-' + String(m).padStart(2, '0'); }
function opQuarterRange(y, q) { const a = (q - 1) * 3 + 1; return [y + '-' + String(a).padStart(2, '0'), y + '-' + String(a + 2).padStart(2, '0')]; }
function opSettingsPeriods() {
    const s = getDashSettings();
    const month = dashAnchor();
    return { month, q: [month ? opShiftMonth(month, -2) : '', month], qy: 0 };
}
// first isolates inside [from, to] (months); de-duplication is applied within the reported period
function opFirst(records, from, to) { return applyDeduplication(opInRange(opClean(records), from, to)); }

function opMarkerStats(records) { return evaluateCriticalMarkers(records); }
function opIsMdrPlus(r) { const c = classifyMDR(r); return c ? c.cls !== 'Non-MDR' : null; }
function opMdrCount(records) {
    let n = 0, plus = 0, xp = 0;
    records.forEach(r => { const c = classifyMDR(r); if (!c) return; n++; if (c.cls !== 'Non-MDR') plus++; if (c.cls === 'XDR' || c.cls === 'PDR') xp++; });
    return { n, plus, xp };
}
function opZ(r1, n1, r2, n2) {
    if (!n1 || !n2) return 0;
    const p = (r1 + r2) / (n1 + n2), se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
    return se ? Math.abs(r1 / n1 - r2 / n2) / se : 0;
}
const opPct = (r, n) => n ? Math.round((r / n) * 1000) / 10 : null;
// Percentages are whole numbers (as in CLSI M39 antibiogram tables).
const opFmt = v => v === null || v === undefined ? '-' : String(Math.round(v));
function opCell(r, n, extra) {
    if (!n) return '<td class="ya-mute">-</td>';
    const low = n < 30;
    const ci = wilsonScoreCI(r, n);
    return `<td style="${low ? 'color:#94a3b8' : ''}"><b>${r}/${n}${low ? '*' : ''}</b><div class="ya-mute">${opFmt(opPct(r, n))}%</div><div class="ya-mute">95% CI ${ci.lower}-${ci.upper}</div>${extra || ''}</td>`;
}

// Difference cell (first group minus second, in percentage points). Always shown; called significant only when both n >= 30 and z >= 1.96.
function opDiff(r1, n1, r2, n2) {
    if (!n1 || !n2) return '<td class="ya-mute">-</td>';
    const d = Math.round((r1 / n1 - r2 / n2) * 1000) / 10, txt = (d > 0 ? '+' : '') + d + ' pp';
    if (n1 < 30 || n2 < 30) return `<td style="color:#94a3b8">${txt}<div class="ya-mute">n&lt;30: descriptive only</div></td>`;
    if (opZ(r1, n1, r2, n2) >= 1.96) return `<td><b style="color:#dc2626">${txt}</b><div style="color:#dc2626;font-size:10px;font-weight:700">differs *</div></td>`;
    return `<td>${txt}<div class="ya-mute">no clear difference</div></td>`;
}

// ---------------------------------------------------------------- skeleton
const OP_CARDS = {
    m: [['alerts', 'Priority alerts', true], ['clusters', 'Possible clusters (14 days)', true], ['compare', 'Comparison with earlier periods', true], ['bloodq', 'Blood isolates: possible contaminants', false]],
    q: [['run', 'Trend over the last 8 three-month periods', true], ['icu', 'ICU compared with non-ICU', true], ['wards', 'Ward ranking by MDR / XDR / PDR', true]]
};
function opBody(p, id) {
    if (id === 'run') return '<div class="ya-chart"><canvas id="chart_q_run"></canvas></div><div id="op_q_run_table" class="ya-scroll"></div><p class="ya-note" id="op_q_run_note"></p>';
    return `<div id="op_${p}_${id}_table" class="ya-scroll"></div><p class="ya-note" id="op_${p}_${id}_note"></p>`;
}
function opBuild(p) {
    const host = document.getElementById('op_' + p + '_root');
    if (!host || host.dataset.built) return;
    host.dataset.built = '1';
    host.innerHTML = OP_CARDS[p].map(([id, title, open]) => `
        <div class="ya-card">
            <div class="sec-head ya-head">
                <button type="button" class="sec-main ya-title" onclick="toggleOp('${p}','${id}')">${title}</button>
                <button type="button" class="sec-chev" onclick="toggleOp('${p}','${id}')" aria-label="Expand or collapse"><span class="ya-chev ${open ? 'rot' : ''}" id="op_icon_${p}_${id}">${OP_CHEV}</span></button>
            </div>
            <div id="op_body_${p}_${id}" class="ya-body ${open ? '' : 'hidden'}">${opBody(p, id)}</div>
        </div>`).join('');
}
window.toggleOp = function (p, id) {
    $('#op_body_' + p + '_' + id).toggleClass('hidden');
    $('#op_icon_' + p + '_' + id).toggleClass('rot');
    if (!$('#op_body_' + p + '_' + id).hasClass('hidden')) { try { window.dispatchEvent(new Event('resize')); } catch (e) {} }
};

// ---------------------------------------------------------------- per-isolate flags
const OP_ALERT_LABELS = ['CRE', 'CRAB', 'CRPA', 'VRE', 'VRSA'];
function opFlags(r) {
    const st = evaluateCriticalMarkers([r]);
    const tags = [];
    st.forEach(s => { if (s.resistant > 0) tags.push(s.label); });
    const cand = st.some(s => s.label === 'VRSA' && s.candidates > 0);
    const c = classifyMDR(r);
    const mdr = c ? c.cls : null;
    return { tags, cand, mdr, auris: /candida auris/i.test(String(r['Selective organism'] || '')) };
}
function opChip(t, bg, fg) { return `<span style="display:inline-block;margin:1px 2px 1px 0;padding:1px 6px;border-radius:999px;font-size:10px;font-weight:700;background:${bg};color:${fg}">${t}</span>`; }

// ---------------------------------------------------------------- MONTH: alerts
function opAlerts(first, month) {
    const rows = [];
    first.forEach(r => {
        const f = opFlags(r);
        const chips = [];
        f.tags.filter(t => OP_ALERT_LABELS.includes(t)).forEach(t => chips.push(opChip(t, '#fee2e2', '#991b1b')));
        if (f.cand) chips.push(opChip('VRSA candidate', '#ffedd5', '#9a3412'));
        if (f.auris) chips.push(opChip('C. auris', '#fee2e2', '#991b1b'));
        if (f.mdr === 'PDR') chips.push(opChip('PDR', '#7f1d1d', '#fff'));
        else if (f.mdr === 'XDR') chips.push(opChip('XDR', '#fecaca', '#7f1d1d'));
        if (!chips.length) return;
        const w = (f.tags.includes('VRSA') || f.auris || f.mdr === 'PDR') ? 0 : (f.tags.length || f.cand) ? 1 : 2;
        rows.push({ w, r, chips: chips.join('') });
    });
    rows.sort((a, b) => a.w - b.w || String(a.r.Date).localeCompare(String(b.r.Date)));
    if (!rows.length) {
        $('#op_m_alerts_table').html('<div class="ya-empty" style="color:#047857">No priority alerts in this month: no CRE, CRAB, CRPA, VRE, VRSA, C. auris, XDR or PDR isolates.</div>');
        setNote('#op_m_alerts_note', []);
        return;
    }
    const shown = rows.slice(0, 30);
    const body = shown.map(x => `<tr><td class="ya-l">${escHtml(String(x.r.Date || '').slice(5))}</td><td class="ya-l">${escHtml(x.r.Ward || '-')}</td><td class="ya-l"><i>${escHtml(formatOrgName(x.r['Selective organism']))}</i><div class="ya-mute">${escHtml(x.r.Sample || '')}</div></td><td class="ya-l">${x.chips}</td></tr>`).join('');
    $('#op_m_alerts_table').html(`<table class="ya-table"><thead><tr><th class="ya-l">Date</th><th class="ya-l">Ward</th><th class="ya-l">Organism</th><th class="ya-l">Flag</th></tr></thead><tbody>${body}</tbody></table>`);
    setNote('#op_m_alerts_note', [`<b>${rows.length}</b> alert isolate${rows.length === 1 ? '' : 's'} among ${first.length} first isolates${rows.length > shown.length ? ' (first ' + shown.length + ' shown)' : ''}.`, 'Each alert should be reported to the infection control team.', 'VRSA candidates need confirmation by a reference laboratory before they are counted as VRSA.']);
}

// ---------------------------------------------------------------- MONTH: clusters
function opClusters(month) {
    const start = month + '-01';
    const d0 = new Date(start + 'T00:00:00Z'); d0.setUTCDate(d0.getUTCDate() - 14);
    const winFrom = d0.toISOString().slice(0, 10);
    const endDay = opShiftMonth(month, 1) + '-01';
    const years = [...new Set([winFrom.slice(0, 4), month.slice(0, 4)])];
    const pool = opClean(getDashRecords()).filter(r => years.includes(String(r.Date || '').slice(0, 4)));
    const first = applyDeduplication(pool).filter(r => r.Date && r.Date >= winFrom && r.Date < endDay);
    const groups = {};
    first.forEach(r => {
        if (!r.Ward || r.Ward === '-') return;
        const f = opFlags(r);
        const tags = f.tags.filter(t => ['CRE', 'CRAB', 'CRPA', 'MRSA', 'VRE', 'VRSA'].includes(t));
        if (f.mdr === 'XDR' || f.mdr === 'PDR') tags.push('XDR/PDR');
        tags.forEach(t => { const k = r.Ward + '|' + String(r['Selective organism']).toLowerCase() + '|' + t; (groups[k] = groups[k] || []).push(r); });
    });
    const out = [];
    Object.keys(groups).forEach(k => {
        const g = groups[k].slice().sort((a, b) => String(a.Date).localeCompare(String(b.Date)));
        let best = null;
        for (let i = 0; i < g.length; i++) {
            const t0 = new Date(g[i].Date + 'T00:00:00Z').getTime();
            const win = g.filter(x => { const t = new Date(x.Date + 'T00:00:00Z').getTime(); return t >= t0 && t - t0 <= 14 * 86400000; });
            if (win.length >= 3 && (!best || win.length > best.length)) best = win;
        }
        if (best && best[best.length - 1].Date.slice(0, 7) === month) { const [ward, org, tag] = k.split('|'); out.push({ ward, org: best[0]['Selective organism'], tag, n: best.length, from: best[0].Date, to: best[best.length - 1].Date }); }
    });
    out.sort((a, b) => b.n - a.n);
    if (!out.length) {
        $('#op_m_clusters_table').html('<div class="ya-empty" style="color:#047857">No ward cluster signal: no ward had 3 or more patients with the same organism and the same resistance type within 14 days.</div>');
        setNote('#op_m_clusters_note', []);
        return;
    }
    const body = out.slice(0, 15).map(c => `<tr><td class="ya-l"><b>${escHtml(c.ward)}</b></td><td class="ya-l"><i>${escHtml(formatOrgName(c.org))}</i></td><td class="ya-l">${opChip(escHtml(c.tag), '#fee2e2', '#991b1b')}</td><td><b>${c.n}</b></td><td class="ya-l">${escHtml(c.from.slice(5))} to ${escHtml(c.to.slice(5))}</td></tr>`).join('');
    $('#op_m_clusters_table').html(`<table class="ya-table"><thead><tr><th class="ya-l">Ward</th><th class="ya-l">Organism</th><th class="ya-l">Type</th><th>Patients</th><th class="ya-l">Dates</th></tr></thead><tbody>${body}</tbody></table>`);
    setNote('#op_m_clusters_note', ['This is a signal only, not a confirmed outbreak.', 'Confirm with the infection control team: same unit, timing of admission, and typing where available.']);
}

// ---------------------------------------------------------------- MONTH: comparison
function opCompare(month) {
    const src = getDashRecords();
    const cols = [[month, 'This month'], [opShiftMonth(month, -1), 'Previous month'], [opShiftMonth(month, -12), 'Same month last year']]
        .map(([m, t]) => { const f = opFirst(src, m, m); return { m, t, f, st: opMarkerStats(f), mdr: opMdrCount(f) }; });
    const head = cols.map(c => `<th>${escHtml(c.t)}<div class="ya-mute">${escHtml(c.m)}</div></th>`).join('');
    const rows = [`<tr><td class="ya-l"><b>First isolates</b></td>${cols.map(c => `<td><b>${c.f.length}</b></td>`).join('')}</tr>`];
    CRITICAL_MARKERS.forEach((m, i) => {
        if (!cols.some(c => c.st[i].tested)) return;
        rows.push(`<tr><td class="ya-l"><b>${m.label}</b></td>${cols.map(c => opCell(c.st[i].resistant, c.st[i].tested)).join('')}</tr>`);
    });
    rows.push(`<tr><td class="ya-l"><b>MDR / XDR / PDR</b></td>${cols.map(c => opCell(c.mdr.plus, c.mdr.n)).join('')}</tr>`);
    rows.push(`<tr><td class="ya-l"><b>XDR / PDR</b></td>${cols.map(c => opCell(c.mdr.xp, c.mdr.n)).join('')}</tr>`);
    $('#op_m_compare_table').html(`<table class="ya-table"><thead><tr><th class="ya-l">Indicator</th>${head}</tr></thead><tbody>${rows.join('')}</tbody></table>`);
    setNote('#op_m_compare_note', ['Each cell shows resistant / tested, with the percentage below it.', '<b>*</b> (grey) = fewer than 30 isolates tested. A single month is a count to watch, not a trend: small numbers change a lot by chance.', 'Use the Last 3 Months and Last Year tabs to judge trends.']);
}

// ---------------------------------------------------------------- MONTH: blood contaminants
function opBloodQuality(first) {
    const blood = first.filter(r => /blood/i.test(String(r.Sample || '')));
    const c = blood.filter(isPossibleContaminant);
    if (!blood.length) { $('#op_m_bloodq_table').html('<div class="ya-empty">No blood isolates in this month.</div>'); setNote('#op_m_bloodq_note', []); return; }
    const p = opPct(c.length, blood.length);
    $('#op_m_bloodq_table').html(`<div style="font-size:13px;color:#334155"><b>${c.length}</b> of <b>${blood.length}</b> blood isolates are possible skin-flora contaminants (<b style="color:${p > 3 ? '#dc2626' : '#059669'}">${opFmt(p)}%</b>).</div>`);
    setNote('#op_m_bloodq_note', ['This is the share of blood <i>isolates</i>, so it is only a proxy.', 'The CLSI M47 benchmark (3% or less) applies to blood <i>cultures collected</i>; see the Cultures tab for that rate.']);
}

// ---------------------------------------------------------------- QUARTER: run chart
function opRun(q, qy) {
    const src = getDashRecords();
    const per = [];
    for (let i = 7; i >= 0; i--) {
        const b = opShiftMonth(q[1], -3 * i), a = opShiftMonth(b, -2);
        const f = opFirst(src, a, b);
        per.push({ label: ymLabel(a).slice(0, 3) + '\u2013' + ymLabel(b).slice(0, 3) + ' ' + b.slice(2, 4), f, st: opMarkerStats(f) });
    }
    if (OP.chart) { try { OP.chart.destroy(); } catch (e) {} OP.chart = null; }
    const labels = CRITICAL_MARKERS.map(m => m.label);
    const use = labels.filter((l, i) => ['3GC-R', 'CRE', 'CRAB', 'CRPA', 'MRSA', 'VRE'].includes(l) && per.filter(p => p.st[i].tested > 0).length >= 1);
    const cv = document.getElementById('chart_q_run');
    if (!use.length || !per.some(p => p.f.length)) { $('#op_q_run_table').html('<div class="ya-empty">Not enough data for a trend.</div>'); setNote('#op_q_run_note', []); return; }
    if (cv && typeof Chart !== 'undefined') {
        OP.chart = new Chart(cv.getContext('2d'), {
            type: 'line',
            data: { labels: per.map(p => p.label), datasets: use.map(l => {
                const i = labels.indexOf(l), col = OP_COLORS[l] || '#64748b', cells = per.map(p => p.st[i]);
                return { label: l, data: cells.map(c => c.tested ? opPct(c.resistant, c.tested) : null), borderColor: col, backgroundColor: col, spanGaps: true, tension: 0.2, borderWidth: 2,
                    pointRadius: 4, pointBackgroundColor: cells.map(c => c.tested >= 30 ? col : '#fff'), pointBorderColor: col, pointBorderWidth: 2,
                    segment: { borderDash: ctx => (cells[ctx.p0DataIndex].tested < 30 || cells[ctx.p1DataIndex].tested < 30) ? [5, 4] : undefined }, _cells: cells };
            }) },
            options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'nearest', intersect: true },
                scales: { y: { min: 0, max: 100, title: { display: true, text: '% resistant' } } },
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } },
                    tooltip: { callbacks: { label: c => { const k = c.dataset._cells[c.dataIndex]; const ci = wilsonScoreCI(k.resistant, k.tested); return `${c.dataset.label}: ${c.parsed.y}% (${k.resistant}/${k.tested}, 95% CI ${ci.lower}-${ci.upper})${k.tested < 30 ? ' n<30' : ''}`; } } } } }
        });
    }
    const head = per.map(p => `<th>${escHtml(p.label)}</th>`).join('');
    const rows = use.map(l => { const i = labels.indexOf(l); return `<tr><td class="ya-l"><b>${l}</b></td>${per.map(p => opCell(p.st[i].resistant, p.st[i].tested)).join('')}</tr>`; }).join('');
    $('#op_q_run_table').html(`<table class="ya-table"><thead><tr><th class="ya-l">Indicator</th>${head}</tr></thead><tbody>${rows}</tbody></table>`);
    setNote('#op_q_run_note', ['Each 3-month block uses its own first isolates (CLSI M39).', '<b>Hollow point and dashed line</b> = fewer than 30 isolates tested: indicative only.', 'Tap a point to see the counts and the 95% confidence interval.', 'A change deserves attention when it persists over several quarters and the intervals do not overlap.']);
}

// ---------------------------------------------------------------- QUARTER: ICU vs non-ICU
function opIcu(q, qy) {
    const [a, b] = q;
    const all = opFirst(getAllDashRecordsUnscoped(), a, b);       // first isolate chosen across all wards, then split by unit
    const icu = all.filter(r => wardInScope(r.Ward, 'icu')), non = all.filter(r => wardInScope(r.Ward, 'nonicu'));
    const si = opMarkerStats(icu), sn = opMarkerStats(non);
    const mi = opMdrCount(icu), mn = opMdrCount(non);
    const sig = (r1, n1, r2, n2) => n1 >= 30 && n2 >= 30 && opZ(r1, n1, r2, n2) >= 1.96 ? ' <b style="color:#dc2626">*</b>' : '';
    const rows = [`<tr><td class="ya-l"><b>First isolates</b></td><td><b>${icu.length}</b></td><td><b>${non.length}</b></td><td></td></tr>`];
    CRITICAL_MARKERS.forEach((m, i) => {
        if (!si[i].tested && !sn[i].tested) return;
        rows.push(`<tr><td class="ya-l"><b>${m.label}</b></td>${opCell(si[i].resistant, si[i].tested)}${opCell(sn[i].resistant, sn[i].tested)}${opDiff(si[i].resistant, si[i].tested, sn[i].resistant, sn[i].tested)}</tr>`);
    });
    rows.push(`<tr><td class="ya-l"><b>MDR / XDR / PDR</b></td>${opCell(mi.plus, mi.n)}${opCell(mn.plus, mn.n)}${opDiff(mi.plus, mi.n, mn.plus, mn.n)}</tr>`);
    $('#op_q_icu_table').html(`<table class="ya-table"><thead><tr><th class="ya-l">Indicator</th><th>ICU</th><th>Non-ICU</th><th>Difference (ICU &minus; non-ICU)</th></tr></thead><tbody>${rows.join('')}</tbody></table>`);
    setNote('#op_q_icu_note', ['Each cell shows resistant / tested, with the percentage below it. <b>*</b> (grey) = fewer than 30 tested.', 'Both units are always shown, whatever unit filter is selected at the top.', 'The first isolate per patient and organism is chosen across all wards before the split.', '<b>Difference</b> = ICU minus non-ICU, in percentage points (pp). <b style="color:#dc2626">differs *</b> = statistically significant (p &lt; 0.05); tested only when both groups have 30 or more isolates tested, otherwise it is shown as descriptive (n&lt;30).', `Wards counted as ICU: ${escHtml(icuWardList().join(', '))}.`]);
}

// ---------------------------------------------------------------- QUARTER: ward ranking
function opWards(q, qy) {
    const [a, b] = q;
    const first = opFirst(getDashRecords(), a, b);
    const by = {};
    first.forEach(r => {
        const c = classifyMDR(r); if (!c) return;
        const w = r.Ward && r.Ward !== '-' ? r.Ward : 'Unknown';
        const o = (by[w] = by[w] || { n: 0, mdr: 0, xp: 0 });
        o.n++; if (c.cls !== 'Non-MDR') o.mdr++; if (c.cls === 'XDR' || c.cls === 'PDR') o.xp++;
    });
    const list = Object.keys(by).map(w => ({ w, ...by[w] })).sort((x, y) => y.mdr - x.mdr || y.n - x.n).slice(0, 10);
    if (!list.length) { $('#op_q_wards_table').html('<div class="ya-empty">No classifiable isolates in this quarter.</div>'); setNote('#op_q_wards_note', []); return; }
    const body = list.map(x => `<tr><td class="ya-l"><b>${escHtml(x.w)}</b></td><td>${x.n}</td><td><b>${x.mdr}</b></td><td>${x.n < 10 ? '<span class="ya-mute">' + opFmt(opPct(x.mdr, x.n)) + '%*</span>' : '<b>' + opFmt(opPct(x.mdr, x.n)) + '%</b>'}</td><td>${x.xp}</td></tr>`).join('');
    $('#op_q_wards_table').html(`<table class="ya-table"><thead><tr><th class="ya-l">Ward</th><th>Classified</th><th>MDR+</th><th>% MDR+</th><th>XDR / PDR</th></tr></thead><tbody>${body}</tbody></table>`);
    setNote('#op_q_wards_note', ['Top 10 wards by the number of MDR, XDR or PDR first isolates (Magiorakos 2012). MDR+ = MDR, XDR or PDR.', '<b>*</b> (grey) = fewer than 10 classified isolates: do not compare percentages.', 'Counts reflect how many cultures a ward sends as well as its true resistance.']);
}

// ---------------------------------------------------------------- information texts
function opSetInfo() {
    const P = '<p>', E = '</p>';
    setInfo('op_m_alerts', 'Priority alerts', P + 'Lists first isolates of the month that need immediate attention: carbapenem-resistant Enterobacterales, <i>A. baumannii</i> and <i>P. aeruginosa</i> (CRE, CRAB, CRPA), vancomycin-resistant enterococci and <i>S. aureus</i> (VRE, VRSA and unconfirmed candidates), <i>Candida auris</i>, and XDR or PDR isolates.' + E +
        P + 'These are the WHO priority resistance types and the organisms most associated with outbreaks. Each one should trigger a check of infection-control measures and, for VRSA, confirmation by a reference laboratory.' + E, ['WHO_BPPL', 'CLSI_M100']);
    setInfo('op_m_clusters', 'Possible clusters', P + 'Flags a ward where 3 or more different patients had the same organism with the same resistance type (CRE, CRAB, CRPA, MRSA, VRE, VRSA or XDR/PDR) within 14 days.' + E +
        P + 'This is a screening signal built from first isolates; it cannot prove transmission. Review the cases with the infection control team, and use typing if available.' + E, ['WHO_GLASS']);
    setInfo('op_m_compare', 'Comparison with earlier periods', P + 'Shows the same indicators for this month, the previous month, and the same month last year, so seasonal effects are visible.' + E +
        P + 'A single month rarely has 30 tested isolates, so the numbers are shown as counts with the percentage below; no trend is claimed from one month. Use the Last 3 Months and Last Year tabs for trends.' + E, ['CLSI_M39', 'WHO_GLASS']);
    setInfo('op_m_bloodq', 'Possible blood contaminants', P + 'Share of blood isolates that are organisms usually found on skin (coagulase-negative staphylococci, <i>Corynebacterium</i>, <i>Micrococcus</i>, and similar). A high share suggests sampling or collection problems.' + E +
        P + 'The CLSI M47 benchmark (3% or less) is defined per blood cultures collected, not per isolates; the Culture Overview tab gives the proper rate.' + E, ['CLSI_M47']);
    setInfo('op_q_run', 'Trend over the last 8 three-month periods', P + 'The percentage of resistant first isolates for the priority indicators over the eight consecutive three-month periods ending at the latest month.' + E +
        P + 'Quarters with fewer than 30 tested isolates are drawn hollow and dashed. The tooltip shows the counts and the 95% Wilson confidence interval. Follow a change over several quarters rather than one point.' + E, ['WHO_GLASS', 'CLSI_M39']);
    setInfo('op_q_icu', 'ICU compared with non-ICU', P + 'Intensive care units usually have higher resistance. This table compares the priority indicators between ICU and all other wards for the quarter.' + E +
        P + 'The first isolate per patient and organism is chosen across the whole hospital before the split, as CLSI M39 requires. Which wards count as ICU is set on the Dashboard Control page.' + E, ['CLSI_M39']);
    setInfo('op_q_wards', 'Ward ranking', P + 'Wards ranked by the number of first isolates classified as MDR, XDR or PDR (Magiorakos 2012). It shows where the resistant burden sits, to focus stewardship and infection control.' + E +
        P + 'Counts depend on how many cultures each ward sends, so percentages from fewer than 10 isolates are not compared.' + E, ['WHO_GLASS']);
}

// ---------------------------------------------------------------- entry point
function renderPeriodPanels() {
    if (typeof setInfo !== 'function') return;
    opSetInfo();
    const { month, q, qy } = opSettingsPeriods();
    opBuild('m'); opBuild('q');
    const m = () => {
        const first = opFirst(getDashRecords(), month, month);
        opAlerts(first, month);
        opClusters(month);
        opCompare(month);
        opBloodQuality(first);
    };
    [m, () => opRun(q, qy), () => opIcu(q, qy), () => opWards(q, qy)].forEach(f => { try { f(); } catch (e) { console.error('period panel:', e); } });
}

// print registration
(function registerPeriodPrint() {
    if (typeof SECTIONS === 'undefined') return;
    SECTIONS.month.charts = [
        { title: 'Priority alerts', el: '#op_m_alerts_table', kind: 'table' },
        { title: 'Possible clusters', el: '#op_m_clusters_table', kind: 'table' },
        { title: 'Comparison with earlier periods', el: '#op_m_compare_table', kind: 'table' }
    ].concat(SECTIONS.month.charts);
    SECTIONS.month.infos = [['Priority alerts', 'op_m_alerts'], ['Possible clusters', 'op_m_clusters'], ['Comparison', 'op_m_compare'], ['Blood contaminants', 'op_m_bloodq']].concat(SECTIONS.month.infos);
    SECTIONS.quarter.charts = [
        { title: 'Trend over the last 8 three-month periods', el: '#chart_q_run' },
        { title: 'Trend values', el: '#op_q_run_table', kind: 'table' },
        { title: 'ICU compared with non-ICU', el: '#op_q_icu_table', kind: 'table' },
        { title: 'Ward ranking by MDR / XDR / PDR', el: '#op_q_wards_table', kind: 'table' }
    ].concat(SECTIONS.quarter.charts);
    SECTIONS.quarter.infos = [['Trend', 'op_q_run'], ['ICU compared with non-ICU', 'op_q_icu'], ['Ward ranking', 'op_q_wards']].concat(SECTIONS.quarter.infos);
})();
