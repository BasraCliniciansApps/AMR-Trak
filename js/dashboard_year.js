// Annual AMR surveillance report: the content of the "Last Year" tab (a full calendar year).
// Reference methods: CLSI M39 (first isolate per patient, organism and year; n >= 30), CLSI M100 (interpretation),
// WHO GLASS (priority indicators, specimen-specific reporting), Magiorakos 2012 (MDR / XDR / PDR).

const YA = { icuOrg: '', spec: 'all', cumSpec: 'all', noContam: contamExcluded(), trend: null, abxChart: null, abx: { abx: 'Meropenem', org: 'top', mode: 'year', metric: 'R' } };
try { const sv = JSON.parse(localStorage.getItem('amr_trend_sel') || 'null'); if (sv && typeof sv === 'object') Object.assign(YA.abx, sv); } catch (e) {}
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

// ---- Analysis window. A key is either 'YYYY' (calendar year) or 'YYYY-MM..YYYY-MM' (12 months).
// Rolling mode (default): the latest 12 months with data. Calendar mode: the year set by the surveillance team.
function yaMode() { try { const v = localStorage.getItem('amr_ya_mode'); if (v === 'calendar' || v === 'rolling') return v; } catch (e) {} try { if (getDashSettings().dash_ya_mode === 'calendar') return 'calendar'; } catch (e) {} return 'rolling'; }
window.yaSetMode = function (m) { try { localStorage.setItem('amr_ya_mode', m); } catch (e) {} renderAnnualReport(); };
function yaLatestMonth() { return dashAnchor(); }
function yaYear() {
    if (yaMode() === 'calendar') return dashCalendarYear();
    const l = yaLatestMonth();
    return l ? ymShift(l, -11) + '..' + l : String(new Date().getFullYear() - 1);
}
function yaWin(key) { key = String(key); return key.indexOf('..') > 0 ? { from: key.split('..')[0], to: key.split('..')[1] } : { from: key + '-01', to: key + '-12' }; }
function yaPrev(key) { const w = yaWin(key); return String(key).indexOf('..') > 0 ? ymShift(w.from, -12) + '..' + ymShift(w.to, -12) : String(parseInt(key, 10) - 1); }
function yaLabel(key) { const w = yaWin(key); return String(key).indexOf('..') > 0 ? ymLabel(w.from) + ' \u2013 ' + ymLabel(w.to) : String(key); }
function yaInWin(date, key) { const m = String(date || '').slice(0, 7), w = yaWin(key); return /^\d{4}-\d{2}$/.test(m) && m >= w.from && m <= w.to; }
function yaMonths(key) { const w = yaWin(key), out = []; for (let m = w.from; m <= w.to; m = ymShift(m, 1)) out.push(m); return out; }
// quarters of the window: calendar quarters for a calendar year, consecutive 3-month blocks for a rolling window
function yaQuarters(key) {
    const ms = yaMonths(key);
    return [0, 1, 2, 3].map(i => { const b = ms.slice(i * 3, i * 3 + 3); return [String(key).indexOf('..') > 0 ? ymLabel(b[0]).replace(' ', '\u00a0') + '\u2013' + MON3[parseInt(b[2].slice(5, 7), 10) - 1] : 'Q' + (i + 1), b]; });
}
// A window is complete when every month in it has data
function yaIsComplete(key) {
    const have = {}; getDashRecords().forEach(r => { const d = String(r.Date || '').slice(0, 7); if (d) have[d] = 1; });
    return yaMonths(key).every(m => have[m]);
}
function yaMissingMonths(key) {
    const have = {}; getDashRecords().forEach(r => { const d = String(r.Date || '').slice(0, 7); if (d) have[d] = 1; });
    return yaMonths(key).filter(m => !have[m]);
}
function yaRaw(year) {
    return getDashRecords().filter(r => {
        if (!r.Date || !yaInWin(r.Date, year)) return false;
        const o = String(r['Selective organism'] || '').trim().toLowerCase();
        return o && !YA_EXCLUDED_ORGS.some(b => o.includes(b));
    });
}
// First isolates of a year, optionally restricted to one specimen type BEFORE de-duplication (specimen-specific reporting)
function yaMatchSpec(r, spec) {
    if (!spec || spec === 'all') return true;
    const s = String(r.Sample || '');
    if (spec === 'blood') return /blood/i.test(s);
    if (spec === 'urine') return /urine/i.test(s);
    return s.toLowerCase() === String(spec).toLowerCase();
}
function yaFirst(year, spec, noContam) {
    let raw = yaRaw(year).filter(r => yaMatchSpec(r, spec));
    if (noContam) raw = raw.filter(r => !isPossibleContaminant(r));
    return applyDeduplication(raw);
}
function yaZ(r1, n1, r2, n2) {
    if (!n1 || !n2) return 0;
    const p = (r1 + r2) / (n1 + n2), se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
    return se ? Math.abs(r1 / n1 - r2 / n2) / se : 0;
}
const yaPct = (r, n) => n ? Math.round((r / n) * 1000) / 10 : null;
// Percentages are whole numbers (as in CLSI M39 antibiogram tables). Differences in percentage points keep one decimal.
const yaFmt = v => v === null || v === undefined ? '-' : String(Math.round(v));
const yaPp = v => v === null || v === undefined ? '-' : (Math.round(v * 10) / 10).toString();

// ---------------------------------------------------------------- skeleton (built once)
const YA_CARDS = [
    ['ind', 'Key resistance indicators', true],
    ['icu', 'ICU compared with non-ICU', true],
    ['cum', 'Cumulative antibiogram (% susceptible)', false],
    ['trend', 'Quarterly trend', false],
    ['abx', 'Antibiotic trend', false],
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
    host.insertAdjacentHTML('beforebegin', '<div id="ya_window_ctl" class="mb-3"></div>');
    const bodies = {
        ind: yaSeg('ya_spec_seg', [['all', 'All specimens'], ['blood', 'Blood only']], YA.spec, 'yaSetSpec') + '<div id="ya_ind_table" class="ya-scroll"></div><p class="ya-note" id="ya_ind_note"></p>',
        cum: '<div id="ya_cum_seg" class="ya-seg ya-seg-wrap"></div><div id="ya_cum_table" class="ya-scroll"></div><p class="ya-note" id="ya_cum_note"></p>',
        trend: '<div class="ya-chart"><canvas id="chart_y_trend"></canvas></div><div id="ya_trend_table" class="ya-scroll"></div><p class="ya-note" id="ya_trend_note"></p>',
        abx: '<div id="ya_abx_ctl"></div><div class="ya-chart"><canvas id="chart_y_abxtrend"></canvas></div><div id="ya_abx_table" class="ya-scroll"></div><p class="ya-note" id="ya_abx_note"></p>',
        icu: '<div id="ya_icu_table" class="ya-scroll"></div><p class="ya-note" id="ya_icu_note"></p><div class="ya-sub">Susceptibility (% S) by organism</div><div id="ya_icu_seg" class="ya-seg ya-seg-wrap"></div><div id="ya_icu_abx" class="ya-scroll"></div><p class="ya-note" id="ya_icu_abx_note"></p>',
        mdr: '<div id="ya_mdr_table" class="ya-scroll"></div><p class="ya-note" id="ya_mdr_note"></p>',
        cult: '<div id="ya_cult_table" class="ya-scroll"></div><p class="ya-note" id="ya_cult_note"></p>',
        qual: '<div id="ya_q_table" class="ya-scroll"></div><p class="ya-note" id="ya_q_note"></p>'
    };
    host.innerHTML = YA_CARDS.map(([id, title, open]) => `
        <div class="ya-card" id="ya_card_${id}">
            <div class="sec-head ya-head">
                <button type="button" class="sec-main ya-title" onclick="toggleYa('${id}')">${title}</button>
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
window.yaSetCumSpec = function (v) { YA.cumSpec = v; yaCumulative(); };
// specimen types that reach 30 first isolates in the year (CLSI M39: a specimen is reported separately only when numbers allow)
function yaSpecOptions(year) {
    const names = {};
    yaRaw(year).forEach(r => { const s = String(r.Sample || '').trim(); if (s) names[s.toLowerCase()] = s; });
    return Object.keys(names).map(k => ({ key: k, label: names[k], n: yaFirst(year, k, false).length }))
        .filter(o => o.n >= minN()).sort((a, b) => b.n - a.n).slice(0, 8);
}


// ---------------------------------------------------------------- 1b. ICU compared with non-ICU (whole year)
// First isolate per patient, organism and year is chosen across ALL wards, then split by unit.
function yaIcuSplit(year) {
    const raw = getAllDashRecordsUnscoped().filter(r => {
        if (!r.Date || !yaInWin(r.Date, year)) return false;
        const o = String(r['Selective organism'] || '').trim().toLowerCase();
        return o && !YA_EXCLUDED_ORGS.some(b => o.includes(b));
    });
    const all = applyDeduplication(raw, { noScope: true });
    return { all, icu: all.filter(r => wardInScope(r.Ward, 'icu')), non: all.filter(r => wardInScope(r.Ward, 'nonicu')) };
}
window.yaSetIcuOrg = function (v) { YA.icuOrg = v; yaIcu(); };
function yaIcu() {
    const y = yaYear(), { all, icu, non } = yaIcuSplit(y);
    if (!all.length) { $('#ya_icu_table').html('<div class="ya-empty">No isolates for ' + yaLabel(y) + '.</div>'); $('#ya_icu_seg,#ya_icu_abx').html(''); setNote('#ya_icu_note', []); setNote('#ya_icu_abx_note', []); return; }
    const si = evaluateCriticalMarkers(icu), sn = evaluateCriticalMarkers(non), mi = opMdrCount(icu), mn = opMdrCount(non);
    const rows = [`<tr><td class="ya-l"><b>First isolates</b></td><td><b>${icu.length}</b></td><td><b>${non.length}</b></td><td></td></tr>`];
    CRITICAL_MARKERS.forEach((m, i) => {
        if (!si[i].tested && !sn[i].tested) return;
        rows.push(`<tr><td class="ya-l"><b>${m.label}</b></td>${opCell(si[i].resistant, si[i].tested)}${opCell(sn[i].resistant, sn[i].tested)}${opDiff(si[i].resistant, si[i].tested, sn[i].resistant, sn[i].tested)}</tr>`);
    });
    rows.push(`<tr><td class="ya-l"><b>MDR / XDR / PDR</b></td>${opCell(mi.plus, mi.n)}${opCell(mn.plus, mn.n)}${opDiff(mi.plus, mi.n, mn.plus, mn.n)}</tr>`);
    $('#ya_icu_table').html(`<table class="ya-table"><thead><tr><th class="ya-l">Indicator</th><th>ICU</th><th>Non-ICU</th><th>Difference (ICU &minus; non-ICU)</th></tr></thead><tbody>${rows.join('')}</tbody></table>`);
    setNote('#ya_icu_note', [
        `${yaLabel(y)}: first isolate per patient and organism, chosen across all wards before the split (CLSI M39).`,
        'Each cell shows resistant / tested, with the percentage below it. <b>*</b> (grey) = fewer than 30 tested.',
        '<b>Difference</b> = ICU minus non-ICU in percentage points (pp). <b style="color:#dc2626">differs *</b> = statistically significant (two-proportion z-test, p &lt; 0.05), calculated only when both groups have 30 or more tested; otherwise it is descriptive only.',
        'Both units are always shown, whatever unit filter is selected at the top.',
        `Wards counted as ICU: ${escHtml(icuWardList().join(', '))}.`]);

    // susceptibility by organism
    const byOrg = {};
    all.forEach(r => { const o = r['Selective organism']; (byOrg[o] = byOrg[o] || []).push(r); });
    const orgs = Object.keys(byOrg).filter(o => byOrg[o].length >= minN()).sort((a, b) => byOrg[b].length - byOrg[a].length).slice(0, 8);
    if (!orgs.length) { $('#ya_icu_seg').html(''); $('#ya_icu_abx').html('<div class="ya-empty">No organism reached 30 first isolates in ' + yaLabel(y) + '.</div>'); setNote('#ya_icu_abx_note', []); return; }
    if (!orgs.includes(YA.icuOrg)) YA.icuOrg = orgs[0];
    $('#ya_icu_seg').html(orgs.map(o => `<button type="button" data-v="${escHtml(o)}" class="${o === YA.icuOrg ? 'on' : ''}" onclick="yaSetIcuOrg(this.getAttribute('data-v'))">${escHtml(formatOrgName(o))} <span class="ya-mute">(${byOrg[o].length})</span></button>`).join(''));
    const gi = byOrg[YA.icuOrg].filter(r => wardInScope(r.Ward, 'icu')), gn = byOrg[YA.icuOrg].filter(r => wardInScope(r.Ward, 'nonicu'));
    const cnt = (g, a) => { let t = 0, sc = 0; g.forEach(r => { const v = String(r[a] || '').trim().toUpperCase(); if (yaIsSIR(v)) { t++; if (v === 'S') sc++; } }); return { t, s: sc }; };
    const body = [];
    abxList.forEach(a => {
        const ci = cnt(gi, a), cn = cnt(gn, a);
        if (ci.t + cn.t < minN()) return;
        body.push(`<tr><td class="ya-l"><b>${escHtml(a)}</b></td>${opCell(ci.s, ci.t)}${opCell(cn.s, cn.t)}${opDiff(ci.s, ci.t, cn.s, cn.t)}</tr>`);
    });
    $('#ya_icu_abx').html(body.length
        ? `<table class="ya-table"><thead><tr><th class="ya-l">Antibiotic</th><th>ICU<div class="ya-mute">n=${gi.length}</div></th><th>Non-ICU<div class="ya-mute">n=${gn.length}</div></th><th>Difference (pp)</th></tr></thead><tbody>${body.join('')}</tbody></table>`
        : '<div class="ya-empty">No antibiotic has enough results for this organism.</div>');
    setNote('#ya_icu_abx_note', [
        'Values are <b>susceptible</b> / tested, with % S below. Only S counts as susceptible (CLSI M100).',
        'Antibiotics with fewer than 30 results in total for this organism are not listed.',
        'A <b>negative</b> difference means the ICU has lower susceptibility than the other wards.',
        'Reading advice: when the ICU group has fewer than 30 isolates, treat the ICU figures as a signal to watch, not as a conclusion.']);
}

// ---------------------------------------------------------------- 1. key resistance indicators (+ year on year)
function yaIndicators() {
    const y = yaYear(), cur = yaFirst(y, YA.spec), prev = yaFirst(yaPrev(y), YA.spec);
    const a = evaluateCriticalMarkers(cur), b = evaluateCriticalMarkers(prev);
    const rows = a.map((s, i) => {
        const p = b[i];
        if (!s.tested && !p.tested) return '';
        const pc = yaPct(s.resistant, s.tested), pp = yaPct(p.resistant, p.tested);
        const ci = s.tested ? wilsonScoreCI(s.resistant, s.tested) : null;
        const low = s.tested < minN();
        let chg = '<span class="ya-mute">-</span>';
        if (s.tested && p.tested) {
            const d = Math.round((pc - pp) * 10) / 10, sig = yaZ(s.resistant, s.tested, p.resistant, p.tested) >= 1.96 && s.tested >= minN() && p.tested >= minN();
            const col = !sig ? '#64748b' : d > 0 ? '#dc2626' : '#059669';
            chg = `<span style="color:${col};font-weight:${sig ? 700 : 500}">${d > 0 ? '+' : ''}${yaPp(d)} pp ${d > 0 ? '&#9650;' : d < 0 ? '&#9660;' : ''}</span>${sig ? '' : ' <span class="ya-mute">ns</span>'}`;
        }
        const cand = s.candidates ? `<div class="ya-mute">${s.candidates} unconfirmed (MIC &ge; 16)</div>` : '';
        return `<tr><td class="ya-l"><b>${s.label}</b><div class="ya-mute">${YA_MARKER_NAMES[s.label] || ''}</div>${cand}</td>
            <td>${s.resistant}/${s.tested}${low && s.tested ? '*' : ''}</td>
            <td style="${low ? 'color:#94a3b8' : ''}"><b>${s.tested ? yaFmt(pc) + '%' : '-'}</b>${ci ? `<div class="ya-mute">${ci.lower}-${ci.upper}</div>` : ''}</td>
            <td>${p.tested ? yaFmt(pp) + '%' : '-'}${p.tested ? `<div class="ya-mute">n=${p.tested}</div>` : ''}</td><td>${chg}</td></tr>`;
    }).join('');
    $('#ya_ind_table').html(rows
        ? `<table class="ya-table"><thead><tr><th class="ya-l">Indicator</th><th>R / tested</th><th>% R (95% CI)</th><th>${yaLabel(yaPrev(y))}</th><th>Change</th></tr></thead><tbody>${rows}</tbody></table>`
        : '<div class="ya-empty">No indicator data for this year and selection.</div>');
    setNote('#ya_ind_note', [`${yaLabel(y)}: ${cur.length} first isolates${YA.spec === 'blood' ? ' from blood' : ''}. ${yaLabel(yaPrev(y))}: ${prev.length} first isolates.`, '<b>*</b> (grey) = fewer than 30 isolates tested: interpret with caution.', 'Change is in percentage points (pp). <b>ns</b> = not statistically significant (two-proportion z-test, p &ge; 0.05, or fewer than 30 tested in either period).', 'Candidates: isolates with a vancomycin MIC of 16 or more that are still waiting for reference-laboratory confirmation.']);
}

// ---------------------------------------------------------------- 2. cumulative antibiogram (CLSI M39)
function yaCumulative() {
    const y = yaYear();
    const specs = yaSpecOptions(y);
    if (YA.cumSpec !== 'all' && !specs.some(s => s.key === YA.cumSpec)) YA.cumSpec = 'all';
    $('#ya_cum_seg').html([{ key: 'all', label: 'All specimens' }].concat(specs).map(s => `<button type="button" data-v="${escHtml(s.key)}" class="${s.key === YA.cumSpec ? 'on' : ''}" onclick="yaSetCumSpec(this.getAttribute('data-v'))">${escHtml(s.label)}</button>`).join(''));
    YA.noContam = contamExcluded();
    const recs = yaFirst(y, YA.cumSpec, YA.noContam);
    const exclN = yaRaw(y).filter(r => yaMatchSpec(r, YA.cumSpec) && isPossibleContaminant(r)).length;
    const byOrg = {};
    recs.forEach(r => { const o = r['Selective organism']; (byOrg[o] = byOrg[o] || []).push(r); });
    const orgs = Object.keys(byOrg).filter(o => byOrg[o].length >= minN()).sort((a, b) => byOrg[b].length - byOrg[a].length).slice(0, 15);
    const small = Object.keys(byOrg).filter(o => byOrg[o].length < minN()).sort((a, b) => byOrg[b].length - byOrg[a].length);
    if (!orgs.length) {
        $('#ya_cum_table').html('<div class="ya-empty">No organism reached 30 first isolates in ' + yaLabel(y) + (YA.cumSpec !== 'all' ? ' for this specimen' : '') + '.</div>');
        setNote('#ya_cum_note', [YA.noContam && exclN ? `${exclN} possible contaminant isolate(s) excluded.` : '', small.length ? `Organisms below 30 isolates (not shown): ${small.slice(0, 8).map(o => `${escHtml(formatOrgName(o))} (n=${byOrg[o].length})`).join('; ')}.` : '']);
        return;
    }
    const stats = {}; const colTotals = {};
    orgs.forEach(o => {
        stats[o] = {};
        abxList.forEach(a => {
            let t = 0, s = 0, nu = 0, ut = 0, us = 0;
            byOrg[o].forEach(r => { const v = String(r[a] || '').trim().toUpperCase(); if (yaIsSIR(v)) { t++; if (v === 'S') s++; if (isNonUrineUrineOnly(r, a)) nu++; else { ut++; if (v === 'S') us++; } } });
            if (t >= minN()) { stats[o][a] = { t, s, nu, ut, us }; colTotals[a] = (colTotals[a] || 0) + t; }
        });
    });
    const cols = abxList.filter(a => colTotals[a]).sort((a, b) => abxList.indexOf(a) - abxList.indexOf(b)).slice(0, 30);
    // Three colour bands, an application convention (see Guide, For reviewer, section 5). Not a WHO reference or a treatment guide.
    const color = p => p >= 80 ? 'background:#d1fae5;color:#065f46' : p >= 50 ? 'background:#fed7aa;color:#9a3412' : 'background:#fecaca;color:#991b1b';
    let dagger = false, irCol = false, usym = false;
    const body = orgs.map(o => {
        const n = byOrg[o].length;
        const cells = cols.map(a => {
            const c = stats[o][a];
            if (!c) return '<td class="ya-mute">-</td>';
            if (isIntrinsicResistance(o, a)) { irCol = true; return `<td class="ya-mute" style="background:#e2e8f0" title="${escHtml(a)}: intrinsic resistance (not reported as acquired)">&Dagger;</td>`; }
            const p = Math.round((c.s / c.t) * 100), sel = isSelectivelyTested(c.t, n);
            if (sel) { dagger = true; return `<td class="ya-mute" style="background:#f1f5f9" title="${escHtml(a)}: selectively tested (${c.t} of ${n} isolates). Not reported (CLSI M39 Section 6.5.3)">&dagger;</td>`; }
            if (c.nu) usym = true;
            return `<td style="${color(p)}" title="${escHtml(a)}: ${c.s}/${c.t} susceptible${c.nu ? '; ' + c.nu + ' from non-urine specimens; urine only: ' + (c.ut ? Math.round((c.us / c.ut) * 100) + '% susceptible (n=' + c.ut + ')' : 'no urine results') : ''}">${p}${c.nu ? '&sect;' : ''}</td>`;
        }).join('');
        return `<tr><td class="ya-l"><b>${escHtml(formatOrgName(o))}</b><div class="ya-mute">n=${n}</div></td>${cells}</tr>`;
    }).join('');
    const headH = Math.max(96, Math.max.apply(null, cols.map(a => String(a).length)) * 6.4 + 14);
    const head = cols.map(a => `<th class="ya-v"><span style="writing-mode:vertical-rl;transform:rotate(180deg);display:inline-block;height:${headH}px;white-space:nowrap;font-size:10px">${escHtml(a)}</span></th>`).join('');
    $('#ya_cum_table').html(`<table class="ya-table ya-cum"><thead><tr><th class="ya-l">Organism</th>${head}</tr></thead><tbody>${body}</tbody></table>`);
    setNote('#ya_cum_note', [YA.noContam && exclN ? `<b>${exclN} possible skin-flora contaminant isolate${exclN === 1 ? '' : 's'}</b> (for example coagulase-negative staphylococci in blood) excluded.` : '', `${yaLabel(y)}: first isolate per patient and organism within each calendar year of the period (the laboratory patient number restarts every year; CLSI M39, Section 6.4). A patient with isolates in two calendar years of a 12-month window that crosses New Year can therefore be counted twice.`, 'Values are % <b>susceptible</b>. Only S counts; I and SDD are not counted as susceptible.', 'A cell is shown only when 30 or more isolates were tested. Colours are an application convention, not a WHO reference and not a treatment guide: green 80% or more, amber 50-79%, red below 50%. The 80% level reflects common practice for empirical use in non-severe infection; a higher local threshold applies to severe infection.', small.length ? `Organisms with fewer than 30 isolates (not shown): ${small.slice(0, 6).map(o => `${escHtml(formatOrgName(o))} (n=${byOrg[o].length})`).join('; ')}${small.length > 6 ? '...' : ''}.` : '', usym ? '<b>&sect;</b> = urine-only agent (CLSI M100-Ed36) that also includes non-urine specimens. Those results are included; tap a cell to see the percentage with urine specimens only. Interpret with clinical judgement.' : '', irCol ? '<b>&Dagger;</b> = intrinsic resistance (CLSI M100-Ed36 Appendix B): expected for the organism, so no susceptibility percentage is reported.' : '', dagger ? '<b>&dagger;</b> = selective test: the agent was tested on fewer than 90% of the isolates, so no percentage is shown. CLSI M39 (Section 6.5.3) says agents tested selectively should not be included in the routine cumulative report because they are biased toward lower susceptibility. M39 gives no percentage cut-off; 90% follows the ACSQHC cumulative antibiogram specification.' : '']);
}

// ---------------------------------------------------------------- 3. quarterly trend
function yaTrend() {
    const y = yaYear(), cur = yaFirst(y, YA.spec);
    const quarters = yaQuarters(y);
    const per = quarters.map(([q, ms]) => evaluateCriticalMarkers(cur.filter(r => ms.includes(String(r.Date).slice(0, 7)))));
    const idx = {}; evaluateCriticalMarkers([]).forEach((s, i) => { idx[s.label] = i; });
    const markers = YA_TREND_MARKERS.filter(m => per.some(p => p[idx[m]].tested > 0));
    if (YA.trend) { try { YA.trend.destroy(); } catch (e) {} YA.trend = null; }
    const cv = document.getElementById('chart_y_trend');
    if (!markers.length) {
        $('#ya_trend_table').html('<div class="ya-empty">No indicator data to trend for this year and selection.</div>');
        setNote('#ya_trend_note', []);
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
        return s.tested ? `<td style="${s.tested < minN() ? 'color:#94a3b8' : ''}">${yaFmt(yaPct(s.resistant, s.tested))}%<div class="ya-mute">n=${s.tested}${s.tested < minN() ? '*' : ''}</div></td>` : '<td class="ya-mute">-</td>';
    }).join('') + '</tr>').join('');
    $('#ya_trend_table').html(`<table class="ya-table"><thead><tr><th class="ya-l">Indicator (% R)</th>${quarters.map(q => `<th>${q[0]}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`);
    setNote('#ya_trend_note', [`${yaLabel(y)}: each isolate is counted once (the first of the period), in the quarter in which it appeared, so the quarters add up to the annual figure.`, '<b>*</b> (grey) = fewer than 30 tested: the trend is indicative only.', 'Hollow points and dashed lines on the chart carry the same meaning.']);
}


// ---------------------------------------------------------------- 3b. antibiotic trend (any agent over years or quarters)
const YA_ORG_COLORS = ['#2563eb', '#e11d48', '#0d9488', '#f59e0b', '#7c3aed', '#475569'];
window.yaAbxSet = function (k, v) { YA.abx[k] = v; try { localStorage.setItem('amr_trend_sel', JSON.stringify(YA.abx)); } catch (e) {} yaAbxTrend(); };
function yaAbxTrend() {
    const y = yaYear(), S = YA.abx;
    if (!abxList.includes(S.abx)) S.abx = abxList.includes('Meropenem') ? 'Meropenem' : abxList[0];
    // periods
    let periods = [], skippedOlder = false;
    if (S.mode === 'quarter') {
        const recs = yaFirst(y, 'all', false);
        yaQuarters(y).forEach(([q, ms]) => periods.push({ label: q + (String(y).indexOf('..') > 0 ? '' : ' ' + y), recs: recs.filter(r => ms.includes(String(r.Date).slice(0, 7))) }));
    } else {
        // successive complete 12-month periods ending with the current one (older incomplete periods are left out)
        let k = y, n = 0; const keys = [];
        while (n < 10 && (k === y || yaIsComplete(k)) && yaRaw(k).length) { keys.unshift(k); k = yaPrev(k); n++; }
        skippedOlder = n < 10 && k !== y && yaRaw(k).length > 0 && !yaIsComplete(k);
        keys.forEach(kk => periods.push({ label: yaLabel(kk), recs: yaFirst(kk, 'all', false) }));
    }
    // organisms: per period tested counts for this antibiotic
    const tally = (recs, org) => { let t = 0, r = 0, s = 0; recs.forEach(x => { if (org && x['Selective organism'] !== org) return; const v = String(x[S.abx] || '').trim().toUpperCase(); if (!yaIsSIR(v)) return; t++; if (v === 'R') r++; if (v === 'S') s++; }); return { t, r, s }; };
    const totalByOrg = {};
    periods.forEach(pd => pd.recs.forEach(x => { const v = String(x[S.abx] || '').trim().toUpperCase(); if (yaIsSIR(v)) totalByOrg[x['Selective organism']] = (totalByOrg[x['Selective organism']] || 0) + 1; }));
    const orgOpts = Object.keys(totalByOrg).filter(o => totalByOrg[o] >= minN()).sort((a, b) => totalByOrg[b] - totalByOrg[a]);
    if (S.org !== 'top' && S.org !== 'all' && !orgOpts.includes(S.org)) S.org = 'top';
    const series = S.org === 'all' ? [{ name: 'All organisms', org: null }]
        : S.org === 'top' ? orgOpts.slice(0, 4).map(o => ({ name: formatOrgName(o), org: o }))
        : [{ name: formatOrgName(S.org), org: S.org }];
    const sel = (k, opts, cur) => `<select class="ya-sel" onchange="yaAbxSet('${k}', this.value)">${opts.map(([v, t]) => `<option value="${escHtml(v)}" ${v === cur ? 'selected' : ''}>${escHtml(t)}</option>`).join('')}</select>`;
    $('#ya_abx_ctl').html(`<div class="ya-ctl">
        ${sel('abx', abxList.map(a => [a, a]), S.abx)}
        ${sel('org', [['top', 'Top organisms'], ['all', 'All organisms']].concat(orgOpts.map(o => [o, formatOrgName(o)])), S.org)}
        ${sel('mode', [['year', 'By year'], ['quarter', 'By quarter of ' + yaLabel(y)]], S.mode)}
        ${sel('metric', [['R', '% Resistant'], ['S', '% Susceptible']], S.metric)}</div>`);
    const pctOf = c => c.t ? Math.round(((S.metric === 'S' ? c.s : c.r) / c.t) * 1000) / 10 : null;
    const data = series.map(se => ({ se, cells: periods.map(pd => tally(pd.recs, se.org)) }));
    if (YA.abxChart) { try { YA.abxChart.destroy(); } catch (e) {} YA.abxChart = null; }
    const cv = document.getElementById('chart_y_abxtrend');
    const has = data.some(d => d.cells.some(c => c.t > 0));
    if (!has) {
        $('#ya_abx_table').html('<div class="ya-empty">No susceptibility results for ' + escHtml(S.abx) + ' in this selection.</div>');
        setNote('#ya_abx_note', []);
        return;
    }
    if (cv && typeof Chart !== 'undefined') {
        YA.abxChart = new Chart(cv.getContext('2d'), {
            type: 'line',
            data: { labels: periods.map(p => p.label), datasets: data.map((d, i) => {
                const col = YA_ORG_COLORS[i % YA_ORG_COLORS.length];
                return { label: d.se.name, data: d.cells.map(c => c.t ? pctOf(c) : null), borderColor: col, backgroundColor: col, spanGaps: true, tension: 0.2, borderWidth: 2,
                    pointRadius: 4, pointBackgroundColor: d.cells.map(c => c.t >= minN() ? col : '#fff'), pointBorderColor: col, pointBorderWidth: 2,
                    segment: { borderDash: ctx => (d.cells[ctx.p0DataIndex].t < minN() || d.cells[ctx.p1DataIndex].t < minN()) ? [5, 4] : undefined }, _cells: d.cells };
            }) },
            options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'nearest', intersect: true },
                scales: { y: { min: 0, max: 100, title: { display: true, text: S.metric === 'S' ? '% susceptible' : '% resistant' } } },
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } },
                    tooltip: { callbacks: { label: c => { const k = c.dataset._cells[c.dataIndex]; const ci = wilsonScoreCI(S.metric === 'S' ? k.s : k.r, k.t); return `${c.dataset.label}: ${c.parsed.y}% (n=${k.t}, 95% CI ${ci.lower}-${ci.upper})${k.t < minN() ? ' n<' + minN() : ''}`; } } } } }
        });
    }
    const head = periods.map(p => `<th>${escHtml(p.label)}</th>`).join('');
    const rows = data.map(d => `<tr><td class="ya-l"><b>${escHtml(d.se.name)}</b></td>${d.cells.map(c => c.t ? `<td style="${c.t < minN() ? 'color:#94a3b8' : ''}"><b>${yaFmt(pctOf(c))}%</b><div class="ya-mute">n=${c.t}</div></td>` : '<td class="ya-mute">-</td>').join('')}</tr>`).join('');
    $('#ya_abx_table').html(`<table class="ya-table"><thead><tr><th class="ya-l">Organism</th>${head}</tr></thead><tbody>${rows}</tbody></table>`);
    setNote('#ya_abx_note', [`${escHtml(S.abx)}: first isolate per patient and organism in each period (CLSI M39).`, '<b>Hollow point and dashed line</b> = fewer than 30 isolates tested: indicative only.', 'Only organisms with 30 or more results over the whole period are listed.', skippedOlder ? 'Earlier periods with months missing are not shown: an incomplete period does not meet the one-year analysis period recommended by CLSI M39 (Sections 6.3 and 6.4).' : '', 'Tap a point to see n and the 95% confidence interval.']);
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
    if (!names.length) { $('#ya_mdr_table').html('<div class="ya-empty">No classifiable isolates for this year.</div>'); setNote('#ya_mdr_note', []); return; }
    let T = { n: 0, any: 0 };
    const rows = names.map(k => {
        const x = g[k], any = x.MDR + x.XDR + x.PDR, ci = wilsonScoreCI(any, x.n);
        T.n += x.n; T.any += any;
        return `<tr><td class="ya-l"><b>${escHtml(k)}</b><div class="ya-mute">n=${x.n}${x.n < minN() ? '*' : ''}</div></td><td>${yaFmt(yaPct(x.MDR, x.n))}%</td><td>${yaFmt(yaPct(x.XDR, x.n))}%${x.pXDR ? `<div class="ya-mute">+${x.pXDR} possible</div>` : ''}</td><td>${yaFmt(yaPct(x.PDR, x.n))}%</td><td><b>${yaFmt(yaPct(any, x.n))}%</b><div class="ya-mute">${ci.lower}-${ci.upper}</div></td></tr>`;
    }).join('');
    $('#ya_mdr_table').html(`<table class="ya-table"><thead><tr><th class="ya-l">Group</th><th>MDR</th><th>XDR</th><th>PDR</th><th>Any (95% CI)</th></tr></thead><tbody>${rows}</tbody></table>`);
    setNote('#ya_mdr_note', [`${yaLabel(y)}: first isolates. Each isolate is placed in its highest class (MDR, XDR or PDR).`, '"Any" = MDR + XDR + PDR (Magiorakos 2012).', 'Categories that were not tested are treated as unknown, not susceptible, so XDR and PDR counts are conservative.', '"Possible" marks isolates that look XDR on the tested categories but had too narrow a panel to confirm.', '<b>*</b> (grey) = fewer than 30 isolates.', 'Validity condition (Magiorakos 2012): the XDR and PDR definitions are valid only when isolates were tested against all or nearly all agents of each category and selective reporting or suppression of results was avoided. With incomplete testing an isolate can only be called possible XDR or possible PDR, and such results should not be compared with confirmed XDR or PDR from other studies.']);
}

// ---------------------------------------------------------------- 5. culture burden
function yaCultures() {
    const y = yaYear(), lab = getLabData(), scope = getUnitScope();
    const per = {}; yaMonths(y).forEach(m => { per[m] = { g: 0, ng: 0, con: 0, bT: 0, bC: 0 }; });
    Object.keys(lab.months || {}).forEach(ym => {
        if (!yaInWin(ym + '-01', y)) return;
        const m = ym;
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
    if (!T) { $('#ya_cult_table').html('<div class="ya-empty">No culture counts for ' + yaLabel(y) + '. Counts are collected from the monthly WHONET files.</div>'); setNote('#ya_cult_note', []); return; }
    const row = (label, p, bold) => {
        const t = p.g + p.ng + p.con;
        if (!t) return `<tr><td class="ya-l">${label}</td><td class="ya-mute" colspan="5">-</td></tr>`;
        const bc = p.bT ? yaPct(p.bC, p.bT) : null;
        return `<tr style="${bold ? 'font-weight:700;background:#f8fafc' : ''}"><td class="ya-l">${label}</td><td>${t}</td><td>${yaFmt(yaPct(p.g, t))}%</td><td>${yaFmt(yaPct(p.ng, t))}%</td><td>${yaFmt(yaPct(p.con, t))}%</td><td ${bc !== null && bc > 3 ? 'style="color:#b45309"' : ''}>${bc === null ? '-' : yaFmt(bc) + '%'}${p.bT ? `<div class="ya-mute">of ${p.bT}</div>` : ''}</td></tr>`;
    };
    const rows = yaMonths(y).map(m => row(ymLabel(m), per[m])).join('') + row('Total', tot, true);
    $('#ya_cult_table').html(`<table class="ya-table"><thead><tr><th class="ya-l">Month</th><th>Cultures</th><th>Positive</th><th>No growth</th><th>Contam.</th><th>Blood contam.</th></tr></thead><tbody>${rows}</tbody></table>`);
    setNote('#ya_cult_note', [`${yaLabel(y)}, ${scopeLabel()}.`, 'Blood culture contamination = share of blood cultures reported as contaminated. Benchmark: 3% or less (CLSI M47).', 'A month far below the others usually means an incomplete file rather than a real drop.']);
}

// ---------------------------------------------------------------- 6. data quality
function yaQuality() {
    const y = yaYear(), raw = yaRaw(y);
    if (!raw.length) { $('#ya_q_table').html('<div class="ya-empty">No records for this year.</div>'); setNote('#ya_q_note', []); return; }
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
    $('#ya_q_table').html(`<table class="ya-table"><thead><tr><th class="ya-l">Measure</th><th>${yaLabel(y)}</th></tr></thead><tbody>${rows}</tbody></table>`);
    setNote('#ya_q_note', ['Indicators are only as reliable as the share of isolates tested for the agents they depend on.', 'Low completeness limits what can be reported.']);
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
    setInfo('ya_abx', 'Antibiotic trend', P + 'Follows the resistance (or susceptibility) of one chosen antibiotic over the years, or across the quarters of the selected year, for all organisms together or for individual organisms.' + E +
        P + 'Each period uses first isolates per patient and organism (CLSI M39). Hollow points and dashed segments mark periods with fewer than 30 tested isolates; the tooltip shows n and the 95% Wilson confidence interval. Overlapping intervals mean a change may be chance.' + E, ['CLSI_M39', 'WHO_GLASS']);
    setInfo('ya_mdr', 'MDR / XDR / PDR by organism group', P + 'Multidrug-resistant (MDR), extensively drug-resistant (XDR) and pandrug-resistant (PDR) isolates among Enterobacterales, <i>P. aeruginosa</i>, <i>Acinetobacter</i> spp. and <i>S. aureus</i>, using the standard definitions of Magiorakos et al. (2012).' + E +
        P + 'Intrinsic resistance is excluded. A category that was not tested is treated as unknown, not as susceptible, so XDR and PDR are conservative; isolates that look XDR on the tested categories but had too narrow a panel are shown as "possible". Validity condition (Magiorakos 2012): the XDR and PDR definitions are valid only when isolates were tested against all or nearly all agents of each category and selective reporting or suppression of results was avoided. With incomplete testing an isolate can only be called possible XDR or possible PDR, and such results should not be compared with confirmed XDR or PDR from other studies.' + E, ['MAGIORAKOS', 'CLSI_M100', 'CLSI_M39']);
    setInfo('ya_cult', 'Culture burden', P + 'Monthly number of cultures received, the share with growth, without growth and reported as contaminated, and the contamination rate of blood cultures.' + E +
        P + 'The blood culture contamination benchmark is 3% or less (CLSI M47). These counts are aggregate laboratory counts collected from the monthly WHONET files; no patient data are involved.' + E, ['CLSI_M47', 'ASM_BCC', 'WHO_GLASS']);
    setInfo('ya_qual', 'Data quality', P + 'How complete the data behind this report are: identifiers needed for de-duplication, ward and specimen fields, and the share of isolates tested for the agents each indicator depends on.' + E +
        P + 'WHO GLASS and CLSI M39 both stress that surveillance estimates are only as reliable as the completeness and representativeness of the underlying data.' + E, ['WHO_GLASS', 'CLSI_M39']);
}

// ---------------------------------------------------------------- entry point
// Window selector: latest 12 months (default) or the calendar year set by the surveillance team
function yaWindowCtl(y) {
    const host = document.getElementById('ya_window_ctl'); if (!host) return;
    const mode = yaMode(), l = yaLatestMonth();
    const rollKey = l ? ymShift(l, -11) + '..' + l : '';
    const calKey = dashCalendarYear();
    const missing = yaMissingMonths(y);
    let h = '';
    try { h += '<div class="ya-mute" style="font-size:10px;margin-bottom:6px">Period: ' + yaLabel(y) + ' (' + (mode === 'rolling' ? 'last 12 months' : 'calendar year') + '; change in Settings)</div>'; } catch (e) {}
    if (missing.length) h += hintsHtml(['<b>Incomplete period:</b> no data for ' + missing.map(ymLabel).join(', ') + '.', 'Percentages may be biased by seasonality.', 'The period does not meet the one-year analysis period recommended by CLSI M39 (Sections 6.3 and 6.4).'], 'color:#b45309');
    host.innerHTML = h;
}
function renderAnnualReport() {
    if (!document.getElementById('ya_report')) return;
    yaBuild();
    yaSetInfo();
    const y = yaYear();
    [yaIndicators, yaIcu, yaCumulative, yaTrend, yaAbxTrend, yaMdr, yaCultures, yaQuality].forEach(f => { try { f(); } catch (e) { console.error('annual report:', f.name, e); } });
    $('#ya_year_label').text(yaLabel(y));
    $('#live_y_title').text('Surveillance Overview (' + yaLabel(y) + ')');
    yaWindowCtl(y);
}

// print: the Last Year tab prints as an annual report
(function registerYearPrint() {
    if (typeof SECTIONS === 'undefined' || !SECTIONS.year) return;
    const own = [
        { title: 'Key resistance indicators', el: '#ya_ind_table', kind: 'table' },
        { title: 'ICU compared with non-ICU', el: '#ya_icu_table', kind: 'table' },
        { title: 'ICU compared with non-ICU: susceptibility by organism', el: '#ya_icu_abx', kind: 'table' },
        { title: 'Cumulative antibiogram (% susceptible)', el: '#ya_cum_table', kind: 'table', landscape: true },
        { title: 'Quarterly trend', el: '#chart_y_trend' },
        { title: 'Quarterly values', el: '#ya_trend_table', kind: 'table' },
        { title: 'Antibiotic trend', el: '#chart_y_abxtrend' },
        { title: 'Antibiotic trend values', el: '#ya_abx_table', kind: 'table' },
        { title: 'MDR / XDR / PDR by organism group', el: '#ya_mdr_table', kind: 'table' },
        { title: 'Culture burden', el: '#ya_cult_table', kind: 'table' },
        { title: 'Data quality', el: '#ya_q_table', kind: 'table' }
    ];
    SECTIONS.year.charts = own.concat(SECTIONS.year.charts);
    SECTIONS.year.infos = [['Key resistance indicators', 'ya_ind'], ['ICU compared with non-ICU', 'ya_icu'], ['Cumulative antibiogram', 'ya_cum'], ['Quarterly trend', 'ya_trend'], ['Antibiotic trend', 'ya_abx'], ['MDR / XDR / PDR by organism group', 'ya_mdr'], ['Culture burden', 'ya_cult'], ['Data quality', 'ya_qual']].concat(SECTIONS.year.infos);
    SECTIONS.year.title = () => 'Annual AMR Surveillance Report (' + yaLabel(yaYear()) + ')';
})();
