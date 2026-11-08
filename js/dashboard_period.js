// =====================================================================
// Monthly Alerts tab: priority alerts for the latest month.
// Evidence for every alert type is listed in the (i) text of the card.
//   - Alerts are looked for in ALL isolates of the month, not only the first isolate, because a first-isolate
//     summary can miss new resistance patterns (CLSI M39 Section 9.4).
//   - Phenotypes: CLSI M100 Appendix A (results to confirm and notify); WHO emerging AMR reporting framework 2018
//     (Annex 1 critical phenotypes, PDR, XDR); WHO fungal priority pathogens list 2022 (C. auris).
// The helper functions below (opCell, opDiff, opMdrCount...) are also used by the Annual Report tab.
// =====================================================================
const OP_EXCL = ['xxx', 'con', 'no growth', 'contaminated', 'normal flora', 'mixed flora', 'no significant growth'];
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
    const low = n < minN();
    const ci = wilsonScoreCI(r, n);
    return `<td style="${low ? 'color:#94a3b8' : ''}"><b>${r}/${n}${low ? '*' : ''}</b><div class="ya-mute">${opFmt(opPct(r, n))}%</div><div class="ya-mute">95% CI ${ci.lower}-${ci.upper}</div>${extra || ''}</td>`;
}

// Difference cell (first group minus second, in percentage points). Always shown; called significant only when both n >= 30 and z >= 1.96.
function opDiff(r1, n1, r2, n2) {
    if (!n1 || !n2) return '<td class="ya-mute">-</td>';
    const d = Math.round((r1 / n1 - r2 / n2) * 1000) / 10, txt = (d > 0 ? '+' : '') + d + ' pp';
    if (n1 < minN() || n2 < minN()) return `<td style="color:#94a3b8">${txt}<div class="ya-mute">n&lt;${minN()}: descriptive only</div></td>`;
    if (opZ(r1, n1, r2, n2) >= 1.96) return `<td><b style="color:#dc2626">${txt}</b><div style="color:#dc2626;font-size:10px;font-weight:700">differs *</div></td>`;
    return `<td>${txt}<div class="ya-mute">no clear difference</div></td>`;
}

// ---------------------------------------------------------------- skeleton
const OP_CARDS = { m: [['alerts', 'Priority alerts', true]] };
function opBody(p, id) {
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
};

// ---------------------------------------------------------------- per-isolate flags
const OP_ALERT_LABELS = ['CRE', 'CRAB', 'CRPA', 'VRE', 'VRSA'];
const OP_NS_SET = new Set(['I', 'R', 'SDD']);
const opRes = (r, a) => String(r[a] || '').trim().toUpperCase();
// agents with the given result, intrinsic resistance never counted (CLSI M100 Appendix B)
function opAgents(r, org, agents, onlyR) {
    return agents.filter(a => !isIntrinsicResistance(org, a) && (onlyR ? opRes(r, a) === 'R' : OP_NS_SET.has(opRes(r, a))));
}
// WHO emerging AMR reporting framework (2018), Annex 1: critical resistance phenotypes
function opAnnex1(r, org, group, cls) {
    const out = [];
    const NEW_GLYCO = ['Telavancin', 'Dalbavancin', 'Oritavancin'];
    if (group === 'Enterobacterales' || group === 'Pseudomonas aeruginosa' || group === 'Acinetobacter spp.') {
        if ((cls === 'XDR' || cls === 'PDR') && opAgents(r, org, ['Colistin', 'Polymyxin B'], true).length) out.push('XDR + colistin-R');
    } else if (group === 'Enterococcus spp.') {
        if (opRes(r, 'Vancomycin') === 'R') {
            if (opAgents(r, org, ['Linezolid'], true).length) out.push('VRE + linezolid-R');
            if (opAgents(r, org, ['Daptomycin']).length) out.push('VRE + daptomycin-NS');
            if (opAgents(r, org, NEW_GLYCO).length) out.push('VRE + telavancin/dalbavancin/oritavancin-NS');
        }
    } else if (group === 'Staphylococcus aureus') {
        if (opAgents(r, org, ['Linezolid'], true).length) out.push('Linezolid-R');
        if (opAgents(r, org, ['Daptomycin']).length) out.push('Daptomycin-NS');
        if (opAgents(r, org, ['Tigecycline']).length) out.push('Tigecycline-NS');
        if (opAgents(r, org, NEW_GLYCO).length) out.push('Telavancin/dalbavancin/oritavancin-NS');
    }
    return out;
}
function opFlags(r) {
    const org = String(r['Selective organism'] || '').trim().toLowerCase();
    const st = evaluateCriticalMarkers([r]);
    const tags = [];
    st.forEach(s => { if (s.resistant > 0) tags.push(s.label); });
    const cand = st.some(s => s.label === 'VRSA' && s.candidates > 0);
    const c = classifyMDR(r);
    const mic = parseMicValue(r['Vancomycin MIC']);
    const visa = org.includes('staphylococcus aureus') && mic && mic.valid && interpretStaphVancomycinMic(true, mic) === 'I';
    return {
        tags, cand, visa,
        mdr: c ? c.cls : null,
        annex: c ? opAnnex1(r, org, c.group, c.cls) : [],
        auris: /candida auris/i.test(String(r['Selective organism'] || '')),
        screening: isScreeningSpecimen(r)
    };
}
function opChip(t, bg, fg) { return `<span style="display:inline-block;margin:1px 2px 1px 0;padding:1px 6px;border-radius:999px;font-size:10px;font-weight:700;background:${bg};color:${fg}">${t}</span>`; }

// ---------------------------------------------------------------- alerts (all isolates of the month)
function opAlerts(isolates) {
    const rows = [];
    isolates.slice().sort((a, b) => String(a.Date).localeCompare(String(b.Date))).forEach(r => {
        const f = opFlags(r);
        const chips = [], sig = [];
        const add = (t, bg, fg) => { chips.push(opChip(t, bg, fg)); sig.push(t); };
        f.tags.filter(t => OP_ALERT_LABELS.includes(t)).forEach(t => add(t, '#fee2e2', '#991b1b'));
        if (f.cand) add('VRSA candidate', '#ffedd5', '#9a3412');
        if (f.visa) add('Vancomycin I (VISA)', '#ffedd5', '#9a3412');
        if (f.auris) add('C. auris', '#fee2e2', '#991b1b');
        if (f.mdr === 'PDR') add('PDR', '#7f1d1d', '#fff');
        else if (f.mdr === 'XDR') add('XDR', '#fecaca', '#7f1d1d');
        f.annex.forEach(t => add(t, '#ede9fe', '#5b21b6'));
        if (!chips.length) return;
        const org = String(r['Selective organism'] || '').trim().toLowerCase();
        const pid = String(r['Patient Key'] || '').trim() || getDedupPatientId(r);
        const key = pid ? pid + '|' + org + '|' + sig.join(',') : '';
        const w = (f.tags.includes('VRSA') || f.auris || f.mdr === 'PDR' || f.annex.length) ? 0 : (f.tags.length || f.cand || f.visa) ? 1 : 2;
        rows.push({ w, r, key, chips: chips.join(''), screening: f.screening, pid });
    });
    const seen = new Set();
    rows.forEach(x => { x.repeat = !!x.key && seen.has(x.key); if (x.key) seen.add(x.key); });
    rows.sort((a, b) => a.w - b.w || String(a.r.Date).localeCompare(String(b.r.Date)));
    if (!rows.length) {
        $('#op_m_alerts_table').html('<div class="ya-empty" style="color:#047857">No priority alerts in this month.</div>');
        setNote('#op_m_alerts_note', [`${isolates.length} isolates were checked.`]);
        return;
    }
    const shown = rows.slice(0, 30);
    const body = shown.map(x => `<tr><td class="ya-l">${escHtml(String(x.r.Date || '').slice(5))}</td><td class="ya-l">${escHtml(x.r.Ward || '-')}</td><td class="ya-l"><i>${escHtml(formatOrgName(x.r['Selective organism']))}</i><div class="ya-mute">${escHtml(x.r.Sample || '')}</div></td><td class="ya-l">${x.chips}${x.repeat ? opChip('repeat', '#e2e8f0', '#475569') : ''}${x.screening ? opChip('screening', '#e2e8f0', '#475569') : ''}</td></tr>`).join('');
    $('#op_m_alerts_table').html(`<table class="ya-table"><thead><tr><th class="ya-l">Date</th><th class="ya-l">Ward</th><th class="ya-l">Organism</th><th class="ya-l">Flag</th></tr></thead><tbody>${body}</tbody></table>`);
    const pats = new Set(rows.filter(x => x.pid).map(x => x.pid)).size;
    setNote('#op_m_alerts_note', [
        `<b>${rows.length}</b> alert isolate${rows.length === 1 ? '' : 's'}${pats ? ' from ' + pats + ' patient' + (pats === 1 ? '' : 's') : ''} among ${isolates.length} isolates of the month${rows.length > shown.length ? ' (first ' + shown.length + ' shown)' : ''}.`,
        'All isolates are checked, not only the first per patient, so that a new resistance pattern is not missed (CLSI M39 Section 9.4). A later isolate with the same flags from the same patient is marked <b>repeat</b>.',
        'Confirm the result before reporting it (CLSI M100 Appendix A; WHO emerging AMR reporting framework).',
        'VRSA candidates need confirmation by a reference laboratory before they are counted as VRSA.']);
}

function opSetInfo() {
    // the reviewed text for this card is in info_texts.js (op_m_alerts)
    setInfo('op_m_alerts', 'Priority alerts', '<p>Isolates of the month with a result that needs confirmation or reporting.</p>', ['CLSI_M100', 'CLSI_M39', 'WHO_EAR', 'WHO_FUNGAL']);
}

// ---------------------------------------------------------------- entry point
function renderPeriodPanels() {
    if (typeof setInfo !== 'function') return;
    opSetInfo();
    opBuild('m');
    try {
        const month = dashAnchor();
        const isolates = month ? scopeRecs(opInRange(opClean(getDashRecords()), month, month)) : [];
        opAlerts(isolates);
    } catch (e) { console.error('period panel:', e); }
}

// print registration
(function registerPeriodPrint() {
    if (typeof SECTIONS === 'undefined' || !SECTIONS.month) return;
    SECTIONS.month.charts = [{ title: 'Priority alerts', el: '#op_m_alerts_table', kind: 'table' }].concat(SECTIONS.month.charts);
    SECTIONS.month.infos = [['Priority alerts', 'op_m_alerts']].concat(SECTIONS.month.infos);
})();
