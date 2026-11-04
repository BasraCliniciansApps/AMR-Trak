// Annual AMR surveillance report: the content of the "Last Year" tab (a full calendar year).
// Reference methods: CLSI M39 (first isolate per patient, organism and year; n >= 30), CLSI M100 (interpretation),
// WHO GLASS (priority indicators, specimen-specific reporting), Magiorakos 2012 (MDR / XDR / PDR).

const YA = { spec: 'all', cumSpec: 'all', trend: null };
const YA_EXCLUDED_ORGS = ['xxx', 'con', 'no growth', 'contaminated', 'normal flora', 'mixed flora', 'no significant growth'];
const YA_MARKER_NAMES = {
    '3GC-R': 'Third-generation cephalosporin-resistant <i>E. coli</i> / <i>K. pneumoniae</i>',
    'ESBL': 'ESBL-producing <i>E. coli</i> / <i>K. pneumoniae</i> (laboratory flag)',
    'CRE': 'Carbapenem-resistant Enterobacterales',
    'CPE': 'Carbapenemase-producing Enterobacterales (laboratory flag)',
    'CRAB': 'Carbapenem-resistant <i>A. baumannii</i>',
    'CRPA': 'Carbapenem-resistant <i>P. aeruginosa</i>',
    'MRSA': 'Methicillin-resistant <i>S. aureus</i>',
    'VRE': 'Vancomycin-resistant <i>Enterococcus</i>',
    'VRSA': 'Vancomycin-resistant <i>S. aureus</i> (confirmed)'
};
const YA_TREND_MARKERS = ['3GC-R', 'CRE', 'CRAB', 'CRPA', 'MRSA', 'VRE'];
const YA_TREND_COLORS = { '3GC-R': '#2563eb', 'CRE': '#e11d48', 'CRAB': '#7c3aed', 'CRPA': '#f59e0b', 'MRSA': '#0d9488', 'VRE': '#475569' };

const yaIsBlood = r => /blood/i.test(String(r.Sample || ''));
const yaIsUrine = r => /urine/i.test(String(r.Sample || ''));
const yaIsSIR = v => v === 'S' || v === 'I' || v === 'R' || v === 'SDD';

function yaYear() { const s = getDashSettings(); return parseInt(s.mobile_dash_fullyear) || (new Date().getFullYear() - 1); }
function yaRaw(year) {
    return getDashRecords().filter(r => {
        if (!r.Date || !String(r.Date).startsWith(year + '-')) return false;
        const o = String(r['Selective organism'] || '').trim().toLowerCase();
        return o && !YA_EXCLUDED_ORGS.some(b => o.includes(b));
    });
}
// First isolates of a year, optionally restricted to one specimen type BEFORE de-duplication (specimen-specific reporting)
function yaFirst(year, spec) {
    let raw = yaRaw(year);
    if (spec === 'blood') raw = raw.filter(yaIsBlood); else if (spec === 'urine') raw = raw.filter(yaIsUrine);
    return applyDeduplication(raw);
}
function yaZ(r1, n1, r2, n2) {
    if (!n1 || !n2) return 0;
    const p = (r1 + r2) / (n1 + n2), se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
    return se ? Math.abs(r1 / n1 - r2 / n2) / se : 0;
}
const yaPct = (r, n) => n ? Math.round((r / n) * 1000) / 10 : null;
const yaFmt = v => v === null || v === undefined ? '-' : (Math.round(v * 10) / 10).toString();

// ---------------------------------------------------------------- skeleton (built once)
const YA_CARDS = [
    ['ind', 'Key resistance indicators', true],
    ['cum', 'Cumulative antibiogram (% susceptible)', false],
    ['trend', 'Quarterly trend', false],
    ['mdr', 'MDR / XDR / PDR by organism group', false],
    ['cult', 'Culture burden', false],
    ['qual', 'Data quality', false]
];
const YA_CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
function yaSeg(id, opts, cur, fn) {
    return `<div class="ya-seg" id="${id}">${opts.map(([v, t]) => `<button type="button" data-v="${v}" class="${v === cur ? 'on' : ''}" onclick="${fn}('${v}')">${t}</button>`).join('')}</div>`;
}
function yaBuild() {
    const host = document.getElementById('ya_report');
    if (!host || host.dataset.built) return;
    host.dataset.built = '1';
    const bodies = {
        ind: yaSeg('ya_spec_seg', [['all', 'All specimens'], ['blood', 'Blood only']], YA.spec, 'yaSetSpec') + '<div id="ya_ind_table" class="ya-scroll"></div><p class="ya-note" id="ya_ind_note"></p>',
        cum: yaSeg('ya_cum_seg', [['all', 'All specimens'], ['blood', 'Blood'], ['urine', 'Urine']], YA.cumSpec, 'yaSetCumSpec') + '<div id="ya_cum_table" class="ya-scroll"></div><p class="ya-note" id="ya_cum_note"></p>',
        trend: '<div class="ya-chart"><canvas id="chart_y_trend"></canvas></div><div id="ya_trend_table" class="ya-scroll"></div><p class="ya-note" id="ya_trend_note"></p>',
        mdr: '<div id="ya_mdr_table" class="ya-scroll"></div><p class="ya-note" id="ya_mdr_note"></p>',
        cult: '<div id="ya_cult_table" class="ya-scroll"></div><p class="ya-note" id="ya_cult_note"></p>',
        qual: '<div id="ya_q_table" class="ya-scroll"></div><p class="ya-note" id="ya_q_note"></p>'
    };
    host.innerHTML = YA_CARDS.map(([id, title, open]) => `
        <div class="ya-card" id="ya_card_${id}">
            <div class="sec-head ya-head">
                <button type="button" class="sec-main ya-title" onclick="toggleYa('${id}')">${title}</button>
                <div class="sec-tools"><button type="button" class="sec-tool" onclick="showInfo('ya_${id}')" title="Information" aria-label="Information about this section">${ICON_INFO}</button></div>
                <button type="button" class="sec-chev" onclick="toggleYa('${id}')" aria-label="Expand or collapse"><span class="ya-chev ${open ? 'rot' : ''}" id="ya_icon_${id}">${YA_CHEV}</span></button>
            </div>
            <div id="ya_body_${id}" class="ya-body ${open ? '' : 'hidden'}">${bodies[id]}</div>
        </div>`).join('');
}
window.toggleYa = function (id) {
    $('#ya_body_' + id).toggleClass('hidden');
    $('#ya_icon_' + id).toggleClass('rot');
    if (!$('#ya_body_' + id).hasClass('hidden')) { try { window.dispatchEvent(new Event('resize')); } catch (e) {} }
};
window.yaSetSpec = function (v) { YA.spec = v; $('#ya_spec_seg button').each(function () { $(this).toggleClass('on', $(this).data('v') === v); }); yaIndicators(); yaTrend(); };
window.yaSetCumSpec = function (v) { YA.cumSpec = v; $('#ya_cum_seg button').each(function () { $(this).toggleClass('on', $(this).data('v') === v); }); yaCumulative(); };

// ---------------------------------------------------------------- 1. key resistance indicators (+ year on year)
function yaIndicators() {
    const y = yaYear(), cur = yaFirst(y, YA.spec), prev = yaFirst(y - 1, YA.spec);
    const a = evaluateCriticalMarkers(cur), b = evaluateCriticalMarkers(prev);
    const rows = a.map((s, i) => {
        const p = b[i];
        if (!s.tested && !p.tested) return '';
        const pc = yaPct(s.resistant, s.tested), pp = yaPct(p.resistant, p.tested);
        const ci = s.tested ? wilsonScoreCI(s.resistant, s.tested) : null;
        const low = s.tested < 30;
        let chg = '<span class="ya-mute">-</span>';
        if (s.tested && p.tested) {
            const d = Math.round((pc - pp) * 10) / 10, sig = yaZ(s.resistant, s.tested, p.resistant, p.tested) >= 1.96 && s.tested >= 30 && p.tested >= 30;
            const col = !sig ? '#64748b' : d > 0 ? '#dc2626' : '#059669';
            chg = `<span style="color:${col};font-weight:${sig ? 700 : 500}">${d > 0 ? '+' : ''}${yaFmt(d)} pp ${d > 0 ? '&#9650;' : d < 0 ? '&#9660;' : ''}</span>${sig ? '' : ' <span class="ya-mute">ns</span>'}`;
        }
        const cand = s.candidates ? `<div class="ya-mute">${s.candidates} unconfirmed (MIC &ge; 16)</div>` : '';
        return `<tr><td class="ya-l"><b>${s.label}</b><div class="ya-mute">${YA_MARKER_NAMES[s.label] || ''}</div>${cand}</td>
            <td>${s.resistant}/${s.tested}${low && s.tested ? '*' : ''}</td>
            <td style="${low ? 'color:#94a3b8' : ''}"><b>${s.tested ? yaFmt(pc) + '%' : '-'}</b>${ci ? `<div class="ya-mute">${ci.lower}-${ci.upper}</div>` : ''}</td>
            <td>${p.tested ? yaFmt(pp) + '%' : '-'}${p.tested ? `<div class="ya-mute">n=${p.tested}</div>` : ''}</td><td>${chg}</td></tr>`;
    }).join('');
    $('#ya_ind_table').html(rows
        ? `<table class="ya-table"><thead><tr><th class="ya-l">Indicator</th><th>R / tested</th><th>% R (95% CI)</th><th>${y - 1}</th><th>Change</th></tr></thead><tbody>${rows}</tbody></table>`
        : '<div class="ya-empty">No indicator data for this year and selection.</div>');
    $('#ya_ind_note').html(`${y}: ${cur.length} first isolates${YA.spec === 'blood' ? ' from blood' : ''}; ${y - 1}: ${prev.length}. * fewer than 30 tested: interpret with caution. Change is shown in percentage points; <b>ns</b> = not statistically significant (two-proportion z-test, p &ge; 0.05, both years n &ge; 30).`);
}

// ---------------------------------------------------------------- 2. cumulative antibiogram (CLSI M39)
function yaCumulative() {
    const y = yaYear(), recs = yaFirst(y, YA.cumSpec);
    const byOrg = {};
    recs.forEach(r => { const o = r['Selective organism']; (byOrg[o] = byOrg[o] || []).push(r); });
    const orgs = Object.keys(byOrg).filter(o => byOrg[o].length >= 30).sort((a, b) => byOrg[b].length - byOrg[a].length).slice(0, 15);
    const small = Object.keys(byOrg).filter(o => byOrg[o].length < 30).sort((a, b) => byOrg[b].length - byOrg[a].length);
    if (!orgs.length) {
        $('#ya_cum_table').html('<div class="ya-empty">No organism reached 30 first isolates in ' + y + (YA.cumSpec !== 'all' ? ' for this specimen' : '') + '.</div>');
        $('#ya_cum_note').html(small.length ? `Organisms below 30 isolates (not shown): ${small.slice(0, 8).map(o => `${escHtml(formatOrgName(o))} (n=${byOrg[o].length})`).join('; ')}.` : '');
        return;
    }
    const stats = {}; const colTotals = {};
    orgs.forEach(o => {
        stats[o] = {};
        abxList.forEach(a => {
            let t = 0, s = 0;
            byOrg[o].forEach(r => { const v = String(r[a] || '').trim().toUpperCase(); if (yaIsSIR(v)) { t++; if (v === 'S') s++; } });
            if (t >= 30) { stats[o][a] = { t, s }; colTotals[a] = (colTotals[a] || 0) + t; }
        });
    });
    const cols = abxList.filter(a => colTotals[a]).sort((a, b) => abxList.indexOf(a) - abxList.indexOf(b)).slice(0, 30);
    const color = p => p >= 90 ? 'background:#d1fae5;color:#065f46' : p >= 70 ? 'background:#fef9c3;color:#854d0e' : p >= 50 ? 'background:#fed7aa;color:#9a3412' : 'background:#fecaca;color:#991b1b';
    let dagger = false;
    const body = orgs.map(o => {
        const n = byOrg[o].length;
        const cells = cols.map(a => {
            const c = stats[o][a];
            if (!c) return '<td class="ya-mute">-</td>';
            const p = Math.round((c.s / c.t) * 100), sel = isSelectivelyTested(c.t, n);
            if (sel) dagger = true;
            return `<td style="${color(p)}" title="${escHtml(a)}: ${c.s}/${c.t} susceptible">${p}${sel ? '&dagger;' : ''}</td>`;
        }).join('');
        return `<tr><td class="ya-l"><b>${escHtml(formatOrgName(o))}</b><div class="ya-mute">n=${n}</div></td>${cells}</tr>`;
    }).join('');
    const head = cols.map(a => `<th class="ya-v"><span style="writing-mode:vertical-rl;transform:rotate(180deg);display:inline-block;height:96px;white-space:nowrap;font-size:10px">${escHtml(a)}</span></th>`).join('');
    $('#ya_cum_table').html(`<table class="ya-table ya-cum"><thead><tr><th class="ya-l">Organism</th>${head}</tr></thead><tbody>${body}</tbody></table>`);
    $('#ya_cum_note').html(`${y}, first isolate per patient and organism (CLSI M39). Values are % susceptible (S only; I and SDD are not counted as susceptible). A cell is shown only when at least 30 isolates were tested; organisms with fewer than 30 isolates are not shown${small.length ? `: ${small.slice(0, 6).map(o => `${escHtml(formatOrgName(o))} (n=${byOrg[o].length})`).join('; ')}${small.length > 6 ? '...' : ''}` : ''}.` + (dagger ? ' &dagger; Tested on only part of the isolates (selective testing); the percentage may be biased.' : ''));
}

// ---------------------------------------------------------------- 3. quarterly trend
function yaTrend() {
    const y = yaYear(), cur = yaFirst(y, YA.spec);
    const quarters = [['Q1', ['01', '02', '03']], ['Q2', ['04', '05', '06']], ['Q3', ['07', '08', '09']], ['Q4', ['10', '11', '12']]];
    const per = quarters.map(([q, ms]) => evaluateCriticalMarkers(cur.filter(r => ms.includes(String(r.Date).slice(5, 7)))));
    const idx = {}; evaluateCriticalMarkers([]).forEach((s, i) => { idx[s.label] = i; });
    const markers = YA_TREND_MARKERS.filter(m => per.some(p => p[idx[m]].tested > 0));
    if (YA.trend) { try { YA.trend.destroy(); } catch (e) {} YA.trend = null; }
    const cv = document.getElementById('chart_y_trend');
    if (!markers.length) {
        $('#ya_trend_table').html('<div class="ya-empty">No indicator data to trend for this year and selection.</div>');
        $('#ya_trend_note').text('');
        return;
    }
    if (cv && window.Chart) {
        YA.trend = new Chart(cv, {
            type: 'line',
            data: { labels: quarters.map(q => q[0]), datasets: markers.map(m => ({
                label: m, data: per.map(p => p[idx[m]].tested ? yaPct(p[idx[m]].resistant, p[idx[m]].tested) : null),
                borderColor: YA_TREND_COLORS[m], backgroundColor: YA_TREND_COLORS[m], tension: .25, pointRadius: 4, borderWidth: 2, spanGaps: false,
                ns: per.map(p => p[idx[m]].tested)
            })) },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10, weight: 'bold' } } },
                    tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.raw}% (tested n=${c.dataset.ns[c.dataIndex]})` } } },
                scales: { y: { min: 0, max: 100, ticks: { callback: v => v + '%' }, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } }
            }
        });
    }
    const rows = markers.map(m => `<tr><td class="ya-l"><b>${m}</b></td>` + per.map(p => {
        const s = p[idx[m]];
        return s.tested ? `<td style="${s.tested < 30 ? 'color:#94a3b8' : ''}">${yaFmt(yaPct(s.resistant, s.tested))}%<div class="ya-mute">n=${s.tested}${s.tested < 30 ? '*' : ''}</div></td>` : '<td class="ya-mute">-</td>';
    }).join('') + '</tr>').join('');
    $('#ya_trend_table').html(`<table class="ya-table"><thead><tr><th class="ya-l">Indicator (% R)</th>${quarters.map(q => `<th>${q[0]}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`);
    $('#ya_trend_note').html(`${y}, each isolate counted once (first of the year) in the quarter in which it appeared, so the quarters add up to the annual figure. * fewer than 30 tested: the trend is indicative only.`);
}

// ---------------------------------------------------------------- 4. MDR / XDR / PDR by organism group
function yaMdr() {
    const y = yaYear(), cur = yaFirst(y, 'all');
    const g = {};
    cur.forEach(r => {
        const c = classifyMDR(r); if (!c) return;
        const x = (g[c.group] = g[c.group] || { n: 0, 'Non-MDR': 0, MDR: 0, XDR: 0, PDR: 0, pXDR: 0 });
        x.n++; x[c.cls]++; if (c.possibleXDR) x.pXDR++;
    });
    const names = Object.keys(g).sort((a, b) => g[b].n - g[a].n);
    if (!names.length) { $('#ya_mdr_table').html('<div class="ya-empty">No classifiable isolates for this year.</div>'); $('#ya_mdr_note').text(''); return; }
    let T = { n: 0, any: 0 };
    const rows = names.map(k => {
        const x = g[k], any = x.MDR + x.XDR + x.PDR, ci = wilsonScoreCI(any, x.n);
        T.n += x.n; T.any += any;
        return `<tr><td class="ya-l"><b>${escHtml(k)}</b><div class="ya-mute">n=${x.n}${x.n < 30 ? '*' : ''}</div></td><td>${yaFmt(yaPct(x.MDR, x.n))}%</td><td>${yaFmt(yaPct(x.XDR, x.n))}%${x.pXDR ? `<div class="ya-mute">+${x.pXDR} possible</div>` : ''}</td><td>${yaFmt(yaPct(x.PDR, x.n))}%</td><td><b>${yaFmt(yaPct(any, x.n))}%</b><div class="ya-mute">${ci.lower}-${ci.upper}</div></td></tr>`;
    }).join('');
    $('#ya_mdr_table').html(`<table class="ya-table"><thead><tr><th class="ya-l">Group</th><th>MDR</th><th>XDR</th><th>PDR</th><th>Any (95% CI)</th></tr></thead><tbody>${rows}</tbody></table>`);
    $('#ya_mdr_note').html(`${y}, first isolates. Each isolate is assigned to its highest class (MDR, XDR or PDR); "Any" = MDR + XDR + PDR (Magiorakos 2012). Untested categories are unknown, not susceptible, so XDR and PDR are conservative; "possible" marks isolates that look XDR on the tested categories but had too narrow a panel to confirm. * fewer than 30 isolates.`);
}

// ---------------------------------------------------------------- 5. culture burden
function yaCultures() {
    const y = yaYear(), lab = getLabData(), scope = getUnitScope();
    const per = {}; for (let m = 1; m <= 12; m++) per[m] = { g: 0, ng: 0, con: 0, bT: 0, bC: 0 };
    Object.keys(lab.months || {}).forEach(ym => {
        if (!ym.startsWith(y + '-')) return;
        const m = parseInt(ym.slice(5, 7), 10);
        Object.keys(lab.months[ym]).forEach(k => {
            const idx = k.indexOf('|'), ward = k.slice(0, idx), sample = k.slice(idx + 1);
            if (!wardInScope(ward, scope)) return;
            const [g, ng, con] = lab.months[ym][k];
            per[m].g += g; per[m].ng += ng; per[m].con += con;
            if (/blood/i.test(sample)) { per[m].bT += g + ng + con; per[m].bC += con; }
        });
    });
    const tot = { g: 0, ng: 0, con: 0, bT: 0, bC: 0 };
    Object.values(per).forEach(p => { Object.keys(tot).forEach(k => { tot[k] += p[k]; }); });
    const T = tot.g + tot.ng + tot.con;
    if (!T) { $('#ya_cult_table').html('<div class="ya-empty">No culture counts for ' + y + '. Counts are collected from the monthly WHONET files.</div>'); $('#ya_cult_note').text(''); return; }
    const row = (label, p, bold) => {
        const t = p.g + p.ng + p.con;
        if (!t) return `<tr><td class="ya-l">${label}</td><td class="ya-mute" colspan="5">-</td></tr>`;
        const bc = p.bT ? yaPct(p.bC, p.bT) : null;
        return `<tr style="${bold ? 'font-weight:700;background:#f8fafc' : ''}"><td class="ya-l">${label}</td><td>${t}</td><td>${yaFmt(yaPct(p.g, t))}%</td><td>${yaFmt(yaPct(p.ng, t))}%</td><td>${yaFmt(yaPct(p.con, t))}%</td><td ${bc !== null && bc > 3 ? 'style="color:#b45309"' : ''}>${bc === null ? '-' : yaFmt(bc) + '%'}${p.bT ? `<div class="ya-mute">of ${p.bT}</div>` : ''}</td></tr>`;
    };
    const rows = MONTH_NAMES.map((n, i) => row(n, per[i + 1])).join('') + row('Year', tot, true);
    $('#ya_cult_table').html(`<table class="ya-table"><thead><tr><th class="ya-l">Month</th><th>Cultures</th><th>Positive</th><th>No growth</th><th>Contam.</th><th>Blood contam.</th></tr></thead><tbody>${rows}</tbody></table>`);
    $('#ya_cult_note').html(`${y}, ${scopeLabel()}. Blood culture contamination is the share of blood cultures reported as contaminated; the benchmark is 3% or less (CLSI M47). Months far below the others usually point to an incomplete file rather than a real drop.`);
}

// ---------------------------------------------------------------- 6. data quality
function yaQuality() {
    const y = yaYear(), raw = yaRaw(y);
    if (!raw.length) { $('#ya_q_table').html('<div class="ya-empty">No records for this year.</div>'); $('#ya_q_note').text(''); return; }
    const screening = raw.filter(isScreeningSpecimen).length;
    const clinical = raw.filter(r => !isScreeningSpecimen(r));
    const first = applyDeduplication(raw);
    const n = raw.length;
    const share = f => `${yaFmt(yaPct(raw.filter(f).length, n))}%`;
    const hasAst = r => abxList.some(a => yaIsSIR(String(r[a] || '').trim().toUpperCase()));
    const tested = (grp, agents) => {
        const g = first.filter(r => getMdrGroup(String(r['Selective organism'] || '').toLowerCase()) === grp || (grp === 'Enterococcus' && /enterococcus/i.test(r['Selective organism'] || '')));
        const t = g.filter(r => agents.some(a => yaIsSIR(String(r[a] || '').trim().toUpperCase()))).length;
        return g.length ? `${yaFmt(yaPct(t, g.length))}% <span class="ya-mute">(${t}/${g.length})</span>` : '-';
    };
    const rows = [
        ['Records in the year', n, ''],
        ['Screening cultures excluded', screening, ''],
        ['Repeat isolates removed (CLSI M39)', clinical.length - first.length, ''],
        ['First isolates analysed', first.length, ''],
        ['With patient identifier', share(r => !!getDedupPatientId(r)), 'Needed for de-duplication'],
        ['With ward', share(r => !!r.Ward && r.Ward !== '-'), 'Needed for unit scope'],
        ['With specimen type', share(r => !!r.Sample && r.Sample !== '-'), 'Needed for specimen reports'],
        ['With at least one AST result', share(hasAst), ''],
        ['Enterobacterales tested for a carbapenem', tested('Enterobacterales', ['Meropenem', 'Imipenem', 'Ertapenem', 'Doripenem']), 'CRE indicator'],
        ['Enterobacterales tested for a 3rd-gen. cephalosporin', tested('Enterobacterales', ['Ceftriaxone', 'Cefotaxime', 'Ceftazidime']), '3GC-R indicator'],
        ['<i>S. aureus</i> tested for cefoxitin or oxacillin', tested('Staphylococcus aureus', ['Cefoxitin', 'Oxacillin', 'Cefoxitin screen']), 'MRSA indicator'],
        ['<i>Enterococcus</i> tested for vancomycin', tested('Enterococcus', ['Vancomycin']), 'VRE indicator']
    ].map(([l, v, h]) => `<tr><td class="ya-l">${l}${h ? `<div class="ya-mute">${h}</div>` : ''}</td><td>${v}</td></tr>`).join('');
    $('#ya_q_table').html(`<table class="ya-table"><thead><tr><th class="ya-l">Measure</th><th>${y}</th></tr></thead><tbody>${rows}</tbody></table>`);
    $('#ya_q_note').text('Low completeness limits what can be reported: indicators are only as reliable as the share of isolates tested for the agents they depend on.');
}

// ---------------------------------------------------------------- information texts
function yaSetInfo() {
    const P = '<p>', E = '</p>';
    setInfo('ya_ind', 'Key resistance indicators', P + 'Resistance proportions for the priority indicators used by WHO GLASS and the WHO Bacterial Priority Pathogens List, for the selected calendar year, with the previous year alongside.' + E +
        P + '<b>Method:</b> first isolate per patient and organism in the year (CLSI M39); intrinsic and untested results are not counted as resistant. Proportions carry a 95% Wilson confidence interval. "Blood only" restricts the analysis to blood isolates, as GLASS reports bloodstream infections separately.' + E +
        P + '<b>Change</b> is in percentage points. It is called significant only when both years have at least 30 tested isolates and a two-proportion z-test gives p &lt; 0.05.' + E, ['WHO_GLASS', 'WHO_BPPL', 'CLSI_M39', 'CLSI_M100']);
    setInfo('ya_cum', 'Cumulative antibiogram', P + 'The percentage of first isolates susceptible to each antibiotic, by organism, for one calendar year. This is the cumulative antibiogram described in CLSI M39.' + E +
        P + '<b>Rules applied:</b> one isolate per patient and organism per year; screening cultures excluded; only susceptible (S) counts as susceptible; a cell is reported only when at least 30 isolates were tested; organisms with fewer than 30 isolates are not shown. Specimen types are analysed separately (all, blood, urine) because the first-isolate rule is applied within each specimen type.' + E +
        P + '<b>&dagger;</b> marks agents tested on only part of the isolates, where the percentage may be biased.' + E, ['CLSI_M39', 'CLSI_M100']);
    setInfo('ya_trend', 'Quarterly trend', P + 'Resistance of the priority indicators across the four quarters of the selected year.' + E +
        P + 'Each first isolate of the year is counted once, in the quarter in which it appeared, so the quarters add up to the annual figure. Quarters with fewer than 30 tested isolates are marked and should be read as indicative only.' + E, ['CLSI_M39', 'WHO_GLASS']);
    setInfo('ya_mdr', 'MDR / XDR / PDR by organism group', P + 'Multidrug-resistant (MDR), extensively drug-resistant (XDR) and pandrug-resistant (PDR) isolates among Enterobacterales, <i>P. aeruginosa</i>, <i>Acinetobacter</i> spp. and <i>S. aureus</i>, using the standard definitions of Magiorakos et al. (2012).' + E +
        P + 'Intrinsic resistance is excluded. A category that was not tested is treated as unknown, not as susceptible, so XDR and PDR are conservative; isolates that look XDR on the tested categories but had too narrow a panel are shown as "possible".' + E, ['MAGIORAKOS', 'CLSI_M100', 'CLSI_M39']);
    setInfo('ya_cult', 'Culture burden', P + 'Monthly number of cultures received, the share with growth, without growth and reported as contaminated, and the contamination rate of blood cultures.' + E +
        P + 'The blood culture contamination benchmark is 3% or less (CLSI M47). These counts are aggregate laboratory counts collected from the monthly WHONET files; no patient data are involved.' + E, ['CLSI_M47', 'ASM_BCC', 'WHO_GLASS']);
    setInfo('ya_qual', 'Data quality', P + 'How complete the data behind this report are: identifiers needed for de-duplication, ward and specimen fields, and the share of isolates tested for the agents each indicator depends on.' + E +
        P + 'WHO GLASS and CLSI M39 both stress that surveillance estimates are only as reliable as the completeness and representativeness of the underlying data.' + E, ['WHO_GLASS', 'CLSI_M39']);
}

// ---------------------------------------------------------------- entry point
function renderAnnualReport() {
    if (!document.getElementById('ya_report')) return;
    yaBuild();
    yaSetInfo();
    const y = yaYear();
    [yaIndicators, yaCumulative, yaTrend, yaMdr, yaCultures, yaQuality].forEach(f => { try { f(); } catch (e) { console.error('annual report:', f.name, e); } });
    $('#ya_year_label').text(String(y));
}

// print: the Last Year tab prints as an annual report
(function registerYearPrint() {
    if (typeof SECTIONS === 'undefined' || !SECTIONS.year) return;
    const own = [
        { title: 'Key resistance indicators', el: '#ya_ind_table', kind: 'table' },
        { title: 'Cumulative antibiogram (% susceptible)', el: '#ya_cum_table', kind: 'table', landscape: true },
        { title: 'Quarterly trend', el: '#chart_y_trend' },
        { title: 'Quarterly values', el: '#ya_trend_table', kind: 'table' },
        { title: 'MDR / XDR / PDR by organism group', el: '#ya_mdr_table', kind: 'table' },
        { title: 'Culture burden', el: '#ya_cult_table', kind: 'table' },
        { title: 'Data quality', el: '#ya_q_table', kind: 'table' }
    ];
    SECTIONS.year.charts = own.concat(SECTIONS.year.charts);
    SECTIONS.year.infos = [['Key resistance indicators', 'ya_ind'], ['Cumulative antibiogram', 'ya_cum'], ['Quarterly trend', 'ya_trend'], ['MDR / XDR / PDR by organism group', 'ya_mdr'], ['Culture burden', 'ya_cult'], ['Data quality', 'ya_qual']].concat(SECTIONS.year.infos);
    SECTIONS.year.title = () => 'Annual AMR Surveillance Report (' + yaYear() + ')';
})();
