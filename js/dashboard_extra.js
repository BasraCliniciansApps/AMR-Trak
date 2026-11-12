/* AMR Trak dashboard: two additions.
   1) MDR tab: "Key resistance indicators" bar chart. It uses exactly the first isolates and the period of the MDR tab.
   2) Analytics tab: "Cumulative Antibiogram" card (collapsed, below the heatmap). It uses the Analytics period.
   Both reuse the existing definitions (CRITICAL_MARKERS, evaluateCriticalMarkers, applyDeduplication, intrinsic resistance rules);
   nothing is redefined here. */
(function () {
    'use strict';

    // ---------------------------------------------------------------- shared: on/off switch style (used by every "Hide n < 30")
    const st = document.createElement('style');
    st.textContent = '.amr-sw{position:relative;display:inline-block;width:34px;height:19px;flex:none;margin:0}'
        + '.amr-sw input{position:absolute;opacity:0;width:100%;height:100%;margin:0;cursor:pointer;z-index:1}'
        + '.amr-sw .amr-sl{position:absolute;inset:0;background:#cbd5e1;border-radius:19px;transition:.2s;pointer-events:none}'
        + '.amr-sw .amr-sl:before{content:"";position:absolute;height:13px;width:13px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s}'
        + '.amr-sw input:checked+.amr-sl{background:#059669}'
        + '.amr-sw input:checked+.amr-sl:before{transform:translateX(15px)}'
        + '.amr-sw input:focus-visible+.amr-sl{outline:2px solid #0d9488;outline-offset:2px}'
        + '.amr-seg{display:inline-flex;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;background:#fff}'
        + '.amr-seg button{padding:5px 10px;font-size:10px;font-weight:700;color:#475569;background:#fff;border:0;border-right:1px solid #e2e8f0}'
        + '.amr-seg button:last-child{border-right:0}.amr-seg button.on{background:#0f766e;color:#fff}';
    document.head.appendChild(st);
    const sw = (id, on) => '<label class="amr-sw"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '><span class="amr-sl"></span></label>';

    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const infoFrom = (key, from, title, fallback) => {
        const o = (typeof INFO_STORE !== 'undefined' && INFO_STORE[from]) || null;
        if (typeof setInfo === 'function') setInfo(key, title, o ? o.html : fallback, o ? o.refs : undefined);
    };

    // ---------------------------------------------------------------- 1. MDR tab: key resistance indicators (bar chart)
    let kriChart = null;
    window.renderMdrKri = function (recs) {
        window._kriRecs = recs || [];
        const cv = document.getElementById('chart_mdr_kri');
        if (!cv || !window.Chart) return;
        if (kriChart) { try { kriChart.destroy(); } catch (e) {} kriChart = null; }
        infoFrom('mdr_kri', 'ya_ind', 'Key resistance indicators', '<p>Resistance proportions for the priority indicators (carbapenem, third-generation cephalosporin, methicillin and vancomycin resistance), among first isolates of the selected period.</p>');
        try { if (typeof attachInfo === 'function') attachInfo('#mdr_kri_title', 'mdr_kri'); } catch (e) {}
        const hide = $('#kri_hide_low').is(':checked');
        const all = evaluateCriticalMarkers(window._kriRecs).filter(s => s.tested > 0);
        const rows = all.filter(s => !(hide && s.tested < minN()));
        const box = $('#mdr_kri_box');
        if (!rows.length) {
            box.hide();
            $('#mdr_kri_empty').removeClass('hidden').text(all.length ? 'All indicators have fewer than ' + minN() + ' tested isolates. Switch off "Hide n < ' + minN() + '" to see them.' : 'No indicator could be evaluated for this period.');
            setNote('#mdr_kri_note', []);
            return;
        }
        $('#mdr_kri_empty').addClass('hidden');
        box.show().css('height', Math.max(150, rows.length * 38 + 50) + 'px');
        const pct = s => Math.round((s.resistant / s.tested) * 1000) / 10;
        const labels = rows.map(s => s.label + ' (n=' + s.tested + (s.tested < minN() ? '*' : '') + ')');
        const ci = rows.map(s => wilsonScoreCI(s.resistant, s.tested));
        const valueLabels = { id: 'kriValues', afterDatasetsDraw(ch) {
            const c = ch.ctx, m = ch.getDatasetMeta(0);
            c.save(); c.font = 'bold 10px sans-serif'; c.fillStyle = '#334155'; c.textBaseline = 'middle';
            m.data.forEach((bar, i) => { const s = rows[i]; c.fillText(Math.round(pct(s)) + '% (' + s.resistant + '/' + s.tested + ')', ch.chartArea.right + 8, bar.y); });
            c.restore();
        } };
        kriChart = new Chart(cv, {
            type: 'bar',
            data: { labels: labels, datasets: [{ label: '% Resistant', data: rows.map(pct), nData: rows.map(s => s.tested), ciData: ci,
                backgroundColor: rows.map(s => s.tested < minN() ? '#94a3b8' : '#e11d48'), borderRadius: 3 }] },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, layout: { padding: { right: 84 } },
                plugins: { legend: { display: false }, tooltip: { callbacks: {
                    label: c => { const s = rows[c.dataIndex], k = ci[c.dataIndex]; return s.label + ': ' + c.raw + '% resistant (' + s.resistant + ' of ' + s.tested + ' tested)'; },
                    afterLabel: c => '95% CI ' + ci[c.dataIndex].lower + '-' + ci[c.dataIndex].upper + '%' + (rows[c.dataIndex].tested < minN() ? ' | fewer than ' + minN() + ' tested: indicative only' : '') } } },
                scales: { x: { min: 0, max: 100, ticks: { callback: v => v + '%', font: { size: 9 } }, grid: { color: '#f1f5f9' } },
                    y: { ticks: { font: { size: 9, weight: 'bold' } }, grid: { display: false } } } },
            plugins: [valueLabels]
        });
        const names = (typeof YA_MARKER_NAMES !== 'undefined') ? YA_MARKER_NAMES : {};
        const low = rows.some(s => s.tested < minN());
        const cand = rows.filter(s => s.candidates).map(s => '<b>' + esc(s.label) + ':</b> ' + s.candidates + ' unconfirmed (MIC &ge; 16), not counted as resistant.');
        setNote('#mdr_kri_note', [
            'Indicators: ' + rows.map(s => '<b>' + esc(s.label) + '</b> = ' + (names[s.label] || '')).join('; ') + '.',
            'Each bar is the percentage of tested first isolates that are resistant. The 95% CI (Wilson) is in the tooltip and in the printed table.',
            low ? '<b>*</b> (grey bar) = fewer than ' + minN() + ' isolates tested (CLSI M39): the percentage is indicative only.' : ''
        ].concat(cand));
    };
    $(document).on('change', '#kri_hide_low', function () { window.renderMdrKri(window._kriRecs); });

    // ---------------------------------------------------------------- 2. Analytics tab: cumulative antibiogram (own card, collapsed)
    let cumMetric = 'S';
    window.toggleAnCum = function () {
        $('#an_cum_content').toggleClass('hidden');
        $('#an_cum_icon').toggleClass('rotate-180');
        if (!$('#an_cum_content').hasClass('hidden')) { try { refreshSpecimenSelects(); } catch (e) {} window.anCumRender(); }
    };
    window.anCumSetMetric = function (m) {
        cumMetric = m;
        $('#an_cum_seg button').each(function () { $(this).toggleClass('on', $(this).data('v') === m); });
        window.anCumRender();
    };
    $(document).on('change', '#an_cum_hide', function () { window.anCumRender(); });

    window.anCumRender = function () {
        const host = document.getElementById('an_cum_table');
        if (!host) return;
        let recs;
        try {
            recs = filterByPeriod(getDashRecords(), anPeriod());
            recs = specimenFilter(recs, anSpec.cum);
            recs = applyDeduplication(recs);
        } catch (e) { console.error(e); recs = []; }
        infoFrom('an_cum', 'ya_cum', 'Cumulative antibiogram', '<p>Percentage of first isolates susceptible, resistant or non-susceptible to each antibiotic, by organism, over the analysis period (CLSI M39).</p>');
        const hide = $('#an_cum_hide').is(':checked');
        const min = minN();
        const byOrg = {};
        recs.forEach(r => { const o = r['Selective organism']; if (o) (byOrg[o] = byOrg[o] || []).push(r); });
        const big = Object.keys(byOrg).filter(o => byOrg[o].length >= min).sort((a, b) => byOrg[b].length - byOrg[a].length).slice(0, 15);
        const small = Object.keys(byOrg).filter(o => byOrg[o].length < min).sort((a, b) => byOrg[b].length - byOrg[a].length);
        const orgs = hide ? big : big.concat(small.slice(0, 15));
        if (!orgs.length) {
            host.innerHTML = '<div class="ya-empty">' + (recs.length ? 'No organism reached ' + min + ' first isolates in this period. Switch off "Hide n &lt; ' + min + '" to list them.' : 'No data for this period and specimen.') + '</div>';
            setNote('#an_cum_note', [small.length && hide ? 'Organisms below ' + min + ' isolates (hidden): ' + small.slice(0, 8).map(o => esc(formatOrgName(o)) + ' (' + byOrg[o].length + ')').join(', ') + '.' : '']);
            return;
        }
        const stats = {}, colTot = {};
        orgs.forEach(o => {
            stats[o] = {};
            abxList.forEach(a => {
                let t = 0, s = 0, r = 0, ns = 0, nu = 0;
                byOrg[o].forEach(x => {
                    const v = String(x[a] || '').trim().toUpperCase();
                    if (!yaIsSIR(v)) return;
                    t++; if (v === 'S') s++; if (v === 'R') r++; if (v !== 'S') ns++;
                    if (isNonUrineUrineOnly(x, a)) nu++;
                });
                if (t > 0 && !(hide && t < min)) { stats[o][a] = { t, s, r, ns, nu }; colTot[a] = (colTot[a] || 0) + t; }
            });
        });
        const cols = abxList.filter(a => colTot[a]).slice(0, 30);
        const showCI = true;   // the 95% CI is always shown
        const ciOf = c => { const k = wilsonScoreCI(val(c), c.t); return k.lower + '\u2013' + k.upper; };
        const ciDiv = c => showCI ? '<div style="font-size:8px;font-weight:500;opacity:.75;line-height:1.1">' + ciOf(c) + '</div>' : '';
        const val = c => cumMetric === 'R' ? c.r : cumMetric === 'NS' ? c.ns : c.s;
        // Same three bands as the heatmap and the annual antibiogram (an application convention, not a CLSI or WHO category)
        const color = d => d <= 20 ? 'background:#d1fae5;color:#065f46' : d <= 50 ? 'background:#fed7aa;color:#9a3412' : 'background:#fecaca;color:#991b1b';
        let nIR = 0, nSel = 0, nLow = 0, nNu = 0;
        // Same look as the Advanced Heatmap: heatmap-table, organism (n) in the sticky first column, % and 95% CI in every cell
        const body = orgs.map(o => {
            const n = byOrg[o].length, isSmall = n < min;
            const cells = cols.map(a => {
                const c = stats[o][a];
                if (!c) return '<td class="bg-slate-50 text-slate-300">-</td>';
                const p = Math.round((val(c) / c.t) * 100), ttl = esc(a) + ': ' + val(c) + '/' + c.t;
                const ciTxt = '<div class="text-[7.5px] font-medium opacity-80 tracking-tighter mt-1 whitespace-nowrap">95% CI (' + wilsonScoreCI(val(c), c.t).lower + '% - ' + wilsonScoreCI(val(c), c.t).upper + '%)</div>';
                const grey = 'bg-slate-200 text-slate-500 align-middle';
                if (c.t < min || isSmall) { nLow++; return '<td class="' + grey + '" title="' + ttl + '. Fewer than ' + min + ' isolates: indicative only"><div class="leading-none">' + p + '% <span class="text-black font-bold">*</span></div>' + ciTxt + '</td>'; }
                if (isIntrinsicResistance(o, a)) { nIR++; return '<td class="' + grey + '" title="' + esc(a) + ': intrinsic resistance (not reported as acquired)"><div class="leading-none font-bold">&Dagger;</div></td>'; }
                if (isSelectivelyTested(c.t, n)) { nSel++; return '<td class="bg-slate-100 text-slate-500 align-middle" title="' + ttl + '. Selectively tested; not reported (CLSI M39 Section 6.5.3)"><div class="leading-none font-bold">&dagger;</div></td>'; }
                if (c.nu) nNu++;
                const d = cumMetric === 'S' ? 100 - p : p;
                const cls = d <= 20 ? 'bg-emerald-100 text-emerald-800' : d <= 50 ? 'bg-orange-200 text-orange-900' : 'bg-red-200 text-red-800';
                return '<td class="' + cls + ' align-middle" title="' + ttl + (c.nu ? '; includes ' + c.nu + ' non-urine isolates of a urine-only agent' : '') + '"><div class="leading-none">' + p + '%' + (c.nu ? ' <span class="font-bold text-blue-700">&sect;</span>' : '') + '</div>' + ciTxt + '</td>';
            }).join('');
            return '<tr><th class="text-[10px] text-left leading-tight">' + esc(formatOrgName(o)) + (isSmall ? ' *' : '') + ' <br><span class="text-[9px] font-normal text-slate-400">(' + n + ')</span></th>' + cells + '</tr>';
        }).join('');
        const headH = abxHeadHeight(cols);
        host.innerHTML = '<table class="heatmap-table"><thead><tr><th>Org (n)</th>' + cols.map(a => '<th style="vertical-align:bottom;padding:6px 2px">' + abxHeadSpan(a, headH) + '</th>').join('') + '</tr></thead><tbody>' + body + '</tbody></table>';
        const metricName = { S: 'susceptible (% S)', R: 'resistant (% R)', NS: 'non-susceptible (% NS: SDD, I or R)' }[cumMetric];
        let note = [];
        try { note = hmPeriodNote(recs); } catch (e) {}
        setNote('#an_cum_note', [
            'Each cell is the percentage ' + metricName + ' among first isolates (one per patient and species) with a result for that antibiotic.',
            '<b>Colour bands</b> (same as the heatmap): green = 80% or more susceptible (20% or less resistant), amber = 50-79% susceptible, red = below 50% susceptible. A visual aid only, not a treatment guide.',
            showCI ? '<b>95% CI</b> (Wilson score) is shown under each percentage and in the tooltip (CLSI M39 Section 10.1 recommends confidence intervals). It is calculated for the percentage displayed.' : '',
            nLow ? '<b>*</b> (grey) = fewer than ' + min + ' isolates (CLSI M39): indicative only.' : '',
            nIR ? '<b>&Dagger;</b> = intrinsic resistance (CLSI M100 Appendix B, Magiorakos 2012), not acquired resistance.' : '',
            nSel ? '<b>&dagger;</b> = selective test: the agent was tested on fewer than 90% of the organism\'s isolates, so it is not reported (CLSI M39 Section 6.5.3; the 90% threshold is from ACSQHC, Section 3.2).' : '',
            nNu ? '<b>&sect;</b> = urine-only agent (CLSI M100-Ed36) that also includes non-urine isolates; interpret with clinical judgement.' : '',
            hide && small.length ? 'Organisms below ' + min + ' isolates (hidden): ' + small.slice(0, 8).map(o => esc(formatOrgName(o)) + ' (' + byOrg[o].length + ')').join(', ') + '.' : '',
            'Cells are in vitro results.'
        ].concat(note));
    };
    // first draw once the dashboard data is ready; every refresh that redraws the heatmap also calls anCumRender
    document.addEventListener('DOMContentLoaded', function () {
        const seg = document.getElementById('an_cum_seg');
        if (seg) seg.innerHTML = [['S', '% S'], ['R', '% R'], ['NS', '% NS']].map(m => '<button type="button" data-v="' + m[0] + '" class="' + (m[0] === cumMetric ? 'on' : '') + '" onclick="anCumSetMetric(\'' + m[0] + '\')">' + m[1] + '</button>').join('');
    });
})();
