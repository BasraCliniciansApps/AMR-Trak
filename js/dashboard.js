// Firebase Initialization (Read-Only Cloud Connection)
const firebaseConfig = {
    apiKey: "AIzaSyCyWcTzvYXwsYQEgs_iNh_Co68H9_2kYU4",
    authDomain: "antibiogramtrak.firebaseapp.com",
    projectId: "antibiogramtrak",
    storageBucket: "antibiogramtrak.firebasestorage.app",
    messagingSenderId: "679667156703",
    appId: "1:679667156703:web:ca37e1544e3d20e922cb6a"
};

let db = null;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
} catch(e) { console.warn("Firebase offline"); }

let liveCharts = [];
let chartAMR_instance = null;
let chartOrg_instance = null;
let chartSpec_instance = null;
let chartGen_instance = null;
let isUpdatingFilters = false;

// --- New Guided Analytics Variables ---
let chartGuidedPie_instance = null;
let chartGuidedAMR_instance = null;
let currentGuidedOrgs = [];
let currentGuidedBug = "";
let currentGuidedMetric = 'S';
// New Profile Variables
let chartPathoAMR_instance = null;
let currentPathoMetric = 'S';
let chartAbxAMR_instance = null;
let currentAbxMetric = 'S';

// (applyDeduplication is defined once in data.js)

// --- WARD FILTER LOGIC (Inpatient / Outpatient) ---
// Ward classification. Outpatient = outpatient / OPD / clinic wards and the emergency department (patients not admitted).
// Inpatient = an admitted ward. Records without a ward cannot be assigned, so they appear only under "Total".
function wardClass(ward) {
    const w = String(ward || '').toLowerCase().trim();
    if (!w || w === 'unknown') return 'unassigned';
    if (/^(outpatient|out-patient|opd)$|clinic|ambulatory|out patient|emergency|casualty|\ber\b|\bed\b|accident/.test(w)) return 'outpatient';
    return 'inpatient';
}
function applyWardFilter(records, filterValue) {
    if (filterValue === 'inpatient' || filterValue === 'outpatient') return records.filter(r => wardClass(r.Ward) === filterValue);
    return records; // 'total'
}

// Visual updates and re-renders for the segmented toggles
$(document).on('change', 'input[name="guided_ward"]', function() {
    let selectedVal = $(this).val();
    
    // Reset all guided ward buttons (both top and bottom)
    $('.guided-ward-btn').removeClass('bg-white text-indigo-700 shadow-sm').addClass('text-slate-500');
    
    // Visually select BOTH toggles that match the clicked value
    $('input[name="guided_ward"][value="' + selectedVal + '"]').prop('checked', true)
        .parent().removeClass('text-slate-500').addClass('bg-white text-indigo-700 shadow-sm');
        
    loadAnalyticsFilters();
});
$(document).on('change', 'input[name="patho_ward"]', function() {
    $('.patho-ward-btn').removeClass('bg-white text-emerald-700 shadow-sm').addClass('text-slate-500');
    $(this).parent().removeClass('text-slate-500').addClass('bg-white text-emerald-700 shadow-sm');
    updatePathoDropdowns();
});

$(document).on('change', 'input[name="abx_ward"]', function() {
    $('.abx-ward-btn').removeClass('bg-white text-blue-700 shadow-sm').addClass('text-slate-500');
    $(this).parent().removeClass('text-slate-500').addClass('bg-white text-blue-700 shadow-sm');
    updateAbxDropdowns();
});

$(document).on('change', 'input[name="adv_ward"]', function() {
    $('.adv-ward-btn').removeClass('bg-white text-slate-800 shadow-sm').addClass('text-slate-500');
    $(this).parent().removeClass('text-slate-500').addClass('bg-white text-slate-800 shadow-sm');
    // Note: We don't auto-refresh here because the user must click "Generate Heatmap"
});
// --- TIME PERIOD FILTER LOGIC ---
// One line for the urine-only note: % with all results versus % with urine specimens only
function uoLine(name, s, metric, p) {
    const u = s.ua, pu = u && u.t ? Math.round(((metric === 'R' ? u.r : (metric === 'NS' ? u.ns : u.s)) / u.t) * 100) : null;
    return `<div><b>${name}</b>: ${s.nu} of ${s.tested} results are non-urine. % ${metric}: <b>${p}%</b> with all results; <b>${pu === null ? 'no urine results' : pu + '% with urine only (n=' + u.t + ')'}</b></div>`;
}
// Period definitions (anchored to the latest month of data, so they do not depend on the device clock):
//  year    = the latest 12 months with data (rolling), e.g. Oct 2025 - Sep 2026 (CLSI M39: analysis period, eg one year)
//  quarter = the latest 3 months (rolling), e.g. Jul - Sep 2026
//  month   = the latest month
//  The latest month is the "Report data up to" setting, or else the latest month with data.
//  all     = only calendar years with data in all 12 months (older incomplete years are left out)
const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function ymShift(ym, n) { let y = parseInt(ym.slice(0, 4), 10), m = parseInt(ym.slice(5, 7), 10) - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + '-' + String(m + 1).padStart(2, '0'); }
function ymLabel(ym) { return MON3[parseInt(ym.slice(5, 7), 10) - 1] + ' ' + ym.slice(0, 4); }
// Calendar years in which every one of the 12 months has at least one record
function completeYearsInfo(records) {
    const months = {};
    records.forEach(r => { const d = String(r.Date || ''); if (/^\d{4}-\d{2}/.test(d)) months[d.slice(0, 7)] = 1; });
    const years = {};
    Object.keys(months).forEach(m => { const y = m.slice(0, 4); years[y] = (years[y] || 0) + 1; });
    const ys = Object.keys(years).sort();
    return { complete: ys.filter(y => years[y] === 12), omitted: ys.filter(y => years[y] < 12).map(y => ({ year: y, months: years[y] })) };
}
function periodWindow(records, periodType) {
    const latest = dashAnchor(records);
    if (!latest) return null;
    const lYear = parseInt(latest.slice(0, 4), 10), lMonth = parseInt(latest.slice(5, 7), 10);
    const pad = n => String(n).padStart(2, '0');
    if (periodType === 'year') {
        const from = ymShift(latest, -11);
        return { from: from, to: latest, label: ymLabel(from) + ' \u2013 ' + ymLabel(latest) };
    }
    if (periodType === 'quarter') {
        const from = ymShift(latest, -2);
        return { from: from, to: latest, label: ymLabel(from) + ' \u2013 ' + ymLabel(latest) };
    }
    if (periodType === 'month') return { from: latest, to: latest, label: ymLabel(latest) };
    return null;
}
function filterByPeriod(records, periodType) {
    if (!periodType) return records;
    if (periodType === 'all') {
        const cap = dashAnchor(records);
        const upTo = records.filter(r => !r.Date || String(r.Date).slice(0, 7) <= cap);
        const info = completeYearsInfo(upTo);
        if (!info.complete.length) return upTo;
        return upTo.filter(r => info.complete.indexOf(String(r.Date || '').slice(0, 4)) !== -1);
    }
    const valid = records.filter(r => r.Date);
    if (!valid.length) return records;
    const w = periodWindow(valid, periodType);
    if (!w) return records;
    return valid.filter(r => { const m = r.Date.substring(0, 7); return m >= w.from && m <= w.to; });
}
// Shows what each period button resolves to, and warns when "All Times" is selected.
function refreshPeriodHints() {
    let recs = [];
    try { recs = getDashRecords(); } catch (e) {}
    ['an'].forEach(g => {
        const el = document.getElementById('an_period_hint');
        if (!el) return;
        const t = anPeriod();
        if (t === 'all') {
            const cap = dashAnchor(recs);
            const info = completeYearsInfo(recs.filter(r => String(r.Date || '').slice(0, 7) <= cap));
            el.className = 'period-hint text-[10px] mt-1.5 rounded-md px-2 py-1.5 bg-amber-50 text-amber-800 border border-amber-200';
            let h = '<b>Exploratory view: several years combined.</b> CLSI M39 (Section 6.4): when several years are combined, the first isolate per patient per calendar year is used and a footnote should alert readers that the data are combined. For the routine report use Last 12 Months (M39 recommends analysing cumulative data at least annually, Section 6.3).';
            if (info.complete.length) h += ' <b>Years included (data in all 12 months): ' + info.complete.join(', ') + '.</b>';
            if (info.omitted.length) h += ' <b>Left out because the year is incomplete: ' + info.omitted.map(o => o.year + ' (' + o.months + ' of 12 months)').join(', ') + '.</b> An incomplete year over-represents some seasons and does not meet the CLSI M39 recommendation of an analysis period of one year (Sections 6.3 and 6.4).';
            el.innerHTML = h; return;
        }
        const w = periodWindow(recs, t);
        el.className = 'period-hint text-[10px] mt-1.5 rounded-md px-2 py-1.5 bg-slate-50 text-slate-600 border border-slate-200';
        el.innerHTML = w ? (t === 'year' ? '12 months ending at the report month: <b>' + w.label + '</b>. CLSI M39 recommends analysing cumulative data at least annually (Section 6.3); the analysis period is typically one year (Section 6.4). The window moves forward when the "Report data up to" month changes.' : (t === 'quarter' ? 'Latest 3 months: <b>' + w.label + '</b>. ' : 'Latest month: <b>' + w.label + '</b>. ') + 'This is shorter than one year. CLSI M39 (Section 6.3): presenting data more often may be complicated by seasonal variation in resistance rates and imprecise estimates when isolate numbers are small. Use as an indication only.') : 'No data.';
    });
}

// Visual updates for period toggles
// One Analytics period for every chart (see anPeriod)
function anPeriod() { return $('input[name="an_period"]:checked').val() || 'year'; }
$(document).on('change', 'input[name="an_period"]', function() { refreshPeriodHints(); loadAnalyticsFilters(); updatePathoDropdowns(); updateAbxDropdowns(); if (!$('#advContainer').hasClass('hidden')) generateAdvancedAnalytics(); });


function formatOrgName(org) {
    if (!org || typeof org !== 'string' || org.startsWith('No ')) return org || "-";
    let name = org.replace(/\(E\.coli\)/gi, "").trim(); 
    let parts = name.split(' ');
    if (parts.length >= 2 && parts[0].length > 3) {
        return parts[0].charAt(0).toUpperCase() + '. ' + parts.slice(1).join(' ');
    }
    return name;
}

// --- 1. COLOR PALETTE & CUSTOM PLUGINS ---
const extendedPalette = [
    { bg: 'rgba(13, 148, 136, 0.9)', faded: 'rgba(13, 148, 136, 0.25)' }, // Teal
    { bg: 'rgba(14, 165, 233, 0.9)', faded: 'rgba(14, 165, 233, 0.25)' }, // Light Blue
    { bg: 'rgba(59, 130, 246, 0.9)', faded: 'rgba(59, 130, 246, 0.25)' }, // Blue
    { bg: 'rgba(139, 92, 246, 0.9)', faded: 'rgba(139, 92, 246, 0.25)' }, // Violet
    { bg: 'rgba(217, 70, 239, 0.9)', faded: 'rgba(217, 70, 239, 0.25)' }, // Fuchsia
    { bg: 'rgba(244, 63, 94, 0.9)', faded: 'rgba(244, 63, 94, 0.25)' }, // Rose
    { bg: 'rgba(249, 115, 22, 0.9)', faded: 'rgba(249, 115, 22, 0.25)' }, // Orange
    { bg: 'rgba(234, 179, 8, 0.9)', faded: 'rgba(234, 179, 8, 0.25)' }, // Yellow
    { bg: 'rgba(132, 204, 22, 0.9)', faded: 'rgba(132, 204, 22, 0.25)' }, // Lime
    { bg: 'rgba(220, 38, 38, 0.9)', faded: 'rgba(220, 38, 38, 0.25)' }   // Red
];




// إضافة مخصصة لرسم خطوط فترة الثقة (Confidence Intervals) مؤمنة بالكامل
const errorBarsPlugin = {
    id: 'errorBars',
    afterDatasetsDraw(chart) {
        const ctx = chart.ctx;
        if (!chart.scales || !chart.scales.y) return;
        chart.data.datasets.forEach((dataset, i) => {
            const meta = chart.getDatasetMeta(i);
            if (!meta.hidden && dataset.ciData) {
                meta.data.forEach((element, index) => {
                    // حماية المخطط من التوقف إذا كانت البيانات فارغة
                    if (!element || element.x === undefined) return; 
                    
                    const ci = dataset.ciData[index];
                    if (!ci || (ci.lower === 0 && ci.upper === 0 && (dataset.data[index] === 0 || dataset.data[index] === null))) return;
                    
                    const yLower = chart.scales.y.getPixelForValue(ci.lower);
                    const yUpper = chart.scales.y.getPixelForValue(ci.upper);
                    let x = element.x;
                    
                    ctx.save();
                    ctx.beginPath();
                    ctx.lineWidth = 1; ctx.strokeStyle = '#334155';
                    ctx.moveTo(x, yLower); ctx.lineTo(x, yUpper);
                    ctx.moveTo(x - 3, yUpper); ctx.lineTo(x + 3, yUpper);
                    ctx.moveTo(x - 3, yLower); ctx.lineTo(x + 3, yLower);
                    ctx.stroke(); ctx.restore();
                });
            }
        });
    }
};
// Shared bar tooltip: percentage, number tested (n) and 95% Wilson CI
function ciTooltip(metricName) {
    return {
        callbacks: {
            title: items => items.length ? String(items[0].label).replace(/\s*[*\u2020]+$/, '') : '',
            label: ctx => {
                const ds = ctx.dataset, i = ctx.dataIndex;
                const m = typeof metricName === 'function' ? metricName() : metricName;
                const n = ds.nData ? ds.nData[i] : null, ci = ds.ciData ? ds.ciData[i] : null;
                const out = [m + ': ' + ctx.raw + '%'];
                if (n !== null && n !== undefined) out.push('n = ' + n + ' tested' + (n < 30 ? ' (n<30, interpret with caution)' : ''));
                if (ci && n) out.push('95% CI: ' + ci.lower + '\u2013' + ci.upper + '%');
                return out;
            }
        }
    };
}

// Wide bar charts scroll sideways: keep the value axis (and its title) visible on the left while scrolling.
// A copy of the axis area is drawn on a sticky overlay canvas; it adds nothing to the layout and is ignored by printing.
const stickyYAxis = {
    id: 'stickyYAxis',
    afterRender(chart) {
        const cv = chart.canvas, wrap = cv && cv.parentElement, sc = wrap && wrap.parentElement;
        const old = sc && sc.querySelector(':scope > canvas.y-sticky');
        const scrolls = sc && /overflow-x-auto/.test(sc.className) && wrap.offsetWidth > sc.clientWidth + 4 && chart.chartArea && chart.config.type === 'bar';
        if (!scrolls) { if (old && old._owner === chart) old.remove(); return; }
        const ca = chart.chartArea, dpr = chart.currentDevicePixelRatio || window.devicePixelRatio || 1;
        const w = Math.ceil(ca.left), h = cv.clientHeight, bottom = Math.ceil(ca.bottom + 6);
        const ov = old || document.createElement('canvas');
        if (!old) { ov.className = 'y-sticky'; sc.insertBefore(ov, wrap); }
        ov._owner = chart;
        ov.width = Math.round(w * dpr); ov.height = Math.round(h * dpr);
        ov.style.cssText = 'position:sticky;left:0;display:block;z-index:5;pointer-events:none;width:' + w + 'px;height:' + h + 'px;margin-bottom:-' + h + 'px;';
        const c2 = ov.getContext('2d');
        // opaque strip over the whole height: bars AND their labels disappear at the axis line instead of sliding under the numbers
        let bg = '#ffffff';
        for (let el = sc; el; el = el.parentElement) { const col = getComputedStyle(el).backgroundColor; if (col && col !== 'transparent' && !/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(col)) { bg = col; break; } }
        c2.fillStyle = bg; c2.fillRect(0, 0, ov.width, ov.height);
        c2.drawImage(cv, 0, 0, ov.width, Math.round(bottom * dpr), 0, 0, ov.width, Math.round(bottom * dpr));
    },
    beforeDestroy(chart) {
        const wrap = chart.canvas && chart.canvas.parentElement, sc = wrap && wrap.parentElement;
        const old = sc && sc.querySelector(':scope > canvas.y-sticky');
        if (old && old._owner === chart) old.remove();
    }
};
try { if (window.Chart && Chart.register) Chart.register(stickyYAxis); } catch (e) { console.warn('stickyYAxis', e); }
// تم حذف barLabelsPlugin نهائياً لمنع أي كتابة فوق الأعمدة

function getCustomAntibiotics() { 
    return JSON.parse(localStorage.getItem('amr_custom_abx_v2')) || []; 
}
// دالة ذكية للاختصار العلمي للبكتيريا (تحول Staphylococcus aureus إلى S. aureus)
function formatScientificName(name) {
    if (!name || typeof name !== 'string') return name;
    let cleanName = name.replace(/\(E\.coli\)/gi, "").trim(); // إزالة الزوائد
    let isAntibiotic = cleanName.includes('/') || cleanName.toLowerCase().includes('acid'); // حماية المضادات الحيوية
    let parts = cleanName.split(' ');
    if (!isAntibiotic && parts.length >= 2 && parts[0].length > 3) {
        return parts[0].charAt(0).toUpperCase() + '. ' + parts.slice(1).join(' ');
    }
    return cleanName;
}
function wilsonScoreCI(r, n) {
    if (n === 0) return { lower: 0, upper: 0 };
    const p = r / n, z2 = 3.8416;
    const denominator = 1 + z2 / n;
    const center = p + z2 / (2 * n);
    const spread = 1.96 * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
    return { lower: Math.max(0, Math.round(((center - spread) / denominator) * 100)), upper: Math.min(100, Math.round(((center + spread) / denominator) * 100)) };
}

// دالة جلب البيانات من السحابة وتحديثها في الوقت الفعلي (Real-time)
// ---- Info (i) system: details live in a popup instead of cluttering the screen ----
const INFO_STORE = {};
// Official sources used to support the definitions shown in the (i) popups and on printed charts
const REFS = {
    MAGIORAKOS: { t: 'Magiorakos AP, Srinivasan A, Carey RB, et al. Multidrug-resistant, extensively drug-resistant and pandrug-resistant bacteria: an international expert proposal for interim standard definitions for acquired resistance. Clin Microbiol Infect. 2012;18(3):268-281.', u: 'https://doi.org/10.1111/j.1469-0691.2011.03570.x' },
    CLSI_M100: { t: 'Clinical and Laboratory Standards Institute (CLSI). M100: Performance Standards for Antimicrobial Susceptibility Testing (M100-Ed36, 36th ed., 2026).', u: 'https://clsi.org/standards/products/microbiology/documents/m100/' },
    CLSI_M39: { t: 'Hindler JA, Barton M, Erdman SM, et al. CLSI M39-A4: Analysis and Presentation of Cumulative Antimicrobial Susceptibility Test Data; Approved Guideline, 4th ed. Vol. 34, No. 2. Wayne, PA: CLSI; 2014.', u: 'https://clsi.org/standards/products/microbiology/documents/m39/' },
    CLSI_M47: { t: 'CLSI. M47: Principles and Procedures for Blood Cultures (current edition).', u: 'https://clsi.org/standards/products/microbiology/documents/m47/' },
    ASM_BCC: { t: 'American Society for Microbiology. Evidence-based laboratory medicine practice guidelines to reduce blood culture contamination rates: a systematic review and meta-analysis.', u: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11629619/' },
    WHO_GLASS: { t: 'World Health Organization. GLASS manual for antimicrobial resistance surveillance in common bacteria causing human infection. Geneva: WHO; 2023.', u: 'https://www.who.int/publications/i/item/9789240076600' },
    WHO_AWARE: { t: 'World Health Organization. The selection and use of essential medicines 2025: AWaRe classification of antibiotics for evaluation and monitoring of use. Geneva: WHO; 2025.', u: 'https://www.who.int/publications/i/item/B09489' },
    WHO_BPPL: { t: 'World Health Organization. WHO Bacterial Priority Pathogens List, 2024.', u: 'https://www.who.int/publications/i/item/9789240093461' },
    ACSQHC: { t: 'Australian Commission on Safety and Quality in Health Care. Specification for a Hospital Cumulative Antibiogram. Sydney: ACSQHC; December 2019.', u: 'https://www.safetyandquality.gov.au/' },
    BROWN_WILSON: { t: 'Brown LD, Cai TT, DasGupta A. Interval estimation for a binomial proportion. Statistical Science. 2001;16(2):101-133.', u: 'https://doi.org/10.1214/ss/1009213286' },
    WHONET: { t: 'WHONET software. WHO Collaborating Centre for Surveillance of Antimicrobial Resistance.', u: 'https://whonet.org/' }
};
// Which sources support which (i) popup
function refsFor(key) {
    const k = String(key || '');
    if (/^ya_/.test(k)) return ['CLSI_M39', 'WHO_GLASS', 'CLSI_M100'];
    if (/^mdr/.test(k)) return ['MAGIORAKOS', 'CLSI_M100', 'CLSI_M39'];
    if (/^markers/.test(k)) return ['WHO_BPPL', 'WHO_GLASS', 'CLSI_M100'];
    if (k === 'lab_blood') return ['CLSI_M47', 'ASM_BCC'];
    if (k === 'lab_def') return ['WHONET', 'WHO_GLASS'];
    if (/^lab_/.test(k)) return ['WHO_GLASS', 'CLSI_M39'];
    if (/^abx_/.test(k)) return ['CLSI_M39', 'CLSI_M100', 'WHO_AWARE'];
    if (k === 'scope') return ['CLSI_M39', 'WHO_GLASS'];
    return ['CLSI_M39', 'CLSI_M100', 'WHO_GLASS'];
}
function refsHtml(keys, asLinks) {
    const items = keys.map(k => REFS[k]).filter(Boolean).map(r => asLinks
        ? `<li>${r.t} <a href="${r.u}" target="_blank" rel="noopener noreferrer">${r.u.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a></li>`
        : `<li>${r.t} ${r.u}</li>`).join('');
    return items ? `<div class="info-refs"><div class="info-refs-title">References</div><ol>${items}</ol></div>` : '';
}
function setInfo(key, title, html, refs) {
    const o = (typeof INFO_OVERRIDE !== 'undefined') ? INFO_OVERRIDE[key] : null;   // reviewed texts (info_texts.js) replace the inline drafts
    if (o) { title = o.title || title; html = o.html; refs = o.refs || refs; }
    INFO_STORE[key] = { title: title, html: html, refs: refs || refsFor(key) };
}
// Notes under a chart or table: one point per line, never a run-on paragraph
// Splits one text into single sentences so that every hint is shown on its own line
function splitHints(t) {
    const s = String(t || '');
    const out = []; let last = 0;
    const re = /[.!?](\s+)(?=[A-Z]|<b>|<i>[A-Z])/g; let m;
    while ((m = re.exec(s))) {
        const before = s.slice(last, m.index).replace(/<[^>]*>/g, '');
        if (/(^|[\s(])([A-Za-z]|spp|vs|no|e\.g|i\.e|approx|cf|al)$/i.test(before)) continue;   // initials and abbreviations: do not split
        out.push(s.slice(last, m.index + 1)); last = m.index + m[0].length;
    }
    out.push(s.slice(last));
    return out.filter(x => x.trim());
}
// Notes under a chart or table: one point per line, never a run-on paragraph
function hintsHtml(items, style) {
    const list = [].concat.apply([], (items || []).filter(Boolean).map(splitHints));
    return list.length ? '<ul class="note-list"' + (style ? ' style="' + style + '"' : '') + '>' + list.map(t => '<li>' + t + '</li>').join('') + '</ul>' : '';
}
// Paragraphs of a text block: a paragraph with several sentences becomes one line per sentence
function paraHints(html) {
    return String(html || '').replace(/<p>([\s\S]*?)<\/p>/g, (m, t) => splitHints(t).length > 1 ? hintsHtml([t]) : m);
}
// A line that explains the low-number mark (*, grey, hollow point) is shown only when the table next to it has such a mark
function setNote(sel, items) {
    const tbl = String(sel).replace(/_note$/, '_table');
    let list = items || [];
    if (tbl !== sel && $(tbl).length) {
        const html = $(tbl).html() || '';
        if (!/color:#94a3b8|\d\*</.test(html)) list = [].concat.apply([], list.filter(Boolean).map(splitHints)).filter(t => !/^<b>\*<\/b>|^<b>Hollow point/.test(t));
    }
    $(sel).html(hintsHtml(list));
}
window.showInfo = function(key) {
    const i = INFO_STORE[key];
    if (!i) return;
    Swal.fire({
        title: i.title,
        html: '<div class="info-body">' + paraHints(i.html) + '</div>' + refsHtml(i.refs, true),
        showConfirmButton: true, confirmButtonText: 'Close', width: 'min(92vw, 440px)',
        customClass: { popup: 'info-popup', title: 'info-title', htmlContainer: 'info-container', confirmButton: 'info-close' },
        buttonsStyling: false
    });
};
// Information now lives in the section toolbar (see dashboard_panels.js); per-chart buttons are no longer drawn.
function attachInfo() {}
function mdrInfoHtml(px, pp) {
    return `<h5>What it shows</h5>
    <p>How many first isolates are multidrug-resistant (MDR), extensively drug-resistant (XDR) or pandrug-resistant (PDR), and where they occur.</p>
    <h5>Definitions (Magiorakos et al., 2012)</h5>
    <ul>
    <li><b>MDR:</b> non-susceptible to at least one agent in three or more antimicrobial categories.</li>
    <li><b>XDR:</b> non-susceptible to at least one agent in all but two or fewer categories.</li>
    <li><b>PDR:</b> non-susceptible to all agents in all categories.</li></ul>
    <h5>Method</h5>
    <ul>
    <li>Applied to first isolates (CLSI M39) of Enterobacterales, <i>P. aeruginosa</i>, <i>Acinetobacter</i> spp. and <i>S. aureus</i>.</li>
    <li>Susceptibility results are interpreted with CLSI M100 breakpoints.</li>
    <li>Intrinsic resistance is not counted.</li>
    <li>A category that was not tested is treated as unknown, not as resistant.</li>
    <li>Each isolate is placed in its highest class.</li></ul>
    <h5>Possible XDR / PDR</h5>
    <p>Isolates tested against too few categories to confirm their class are not counted in the charts. This period has <b>${px}</b> possible XDR and <b>${pp}</b> possible PDR isolate(s).</p>
    <p>Validity condition (Magiorakos 2012): the XDR and PDR definitions are valid only when isolates were tested against all or nearly all agents of each category and selective reporting or suppression of results was avoided. With incomplete testing an isolate can only be called possible XDR or possible PDR, and such results should not be compared with confirmed XDR or PDR from other studies.</p>`;
}
const AWARE_NAMES = { A: 'Access', W: 'Watch', R: 'Reserve' };

// Antibiotic chart details: how to read the chart, selective testing, AWaRe, contaminants
// Chart-specific notes under the chart key: selective tests, WHO AWaRe groups and possible contaminants
function chartNoteBlocks(selectiveNotes, groups, contaminantCount, opts) {
    opts = opts || {};
    const H = t => `<div style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#64748b;margin:14px 0 6px">${t}</div>`;
    let out = '';
    if (selectiveNotes.length) {
        const rows = selectiveNotes.map(n => {
            const m = String(n).match(/^(.*?)\s*\((\d+\s*\/\s*\d+)\)\s*$/);
            const name = m ? m[1] : n, cnt = m ? m[2].replace(/\s+/g, '') : '';
            return `<div style="display:flex;justify-content:space-between;gap:12px;padding:3px 0;border-bottom:1px solid #f1f5f9"><span style="color:#334155">${name}</span><span style="color:#64748b;font-variant-numeric:tabular-nums;white-space:nowrap">${cnt}</span></div>`;
        }).join('');
        out += H('&dagger; Selective tests <span style="text-transform:none;letter-spacing:0;font-weight:500">(tested / isolates)</span>') + `<div style="font-size:11px;line-height:1.4">${rows}</div>`;
    }
    const col = { A: ['#d1fae5', '#065f46'], W: ['#fef3c7', '#92400e'], R: ['#fee2e2', '#991b1b'] };
    const keys = ['A', 'W', 'R'].filter(k => groups[k].length);
    if (keys.length) {
        out += H('WHO AWaRe groups') + `<div style="font-size:11px;line-height:1.45;color:#475569;margin-bottom:8px">Purpose: AWaRe ranks antibiotics by their potential to drive resistance, to guide stewardship. Use <b>Access</b> first, restrict <b>Watch</b>, keep <b>Reserve</b> as last resort. It shows use priority, not laboratory susceptibility (WHO 2025).</div>` + keys.map(k => `<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:8px">
            <span style="flex:none;width:64px;text-align:center;font-size:10px;font-weight:700;padding:3px 0;border-radius:6px;background:${col[k][0]};color:${col[k][1]}">${AWARE_NAMES[k]}</span>
            <span style="flex:1;line-height:1.9">${groups[k].map(a => `<span style="display:inline-block;font-size:11px;padding:0 8px;margin:0 4px 0 0;border-radius:999px;background:#f1f5f9;color:#334155;line-height:1.7">${a}</span>`).join('')}</span></div>`).join('');
    }
    if (opts.route && opts.route.length) out += `<div style="font-size:11px;line-height:1.45;color:#475569;margin:6px 0 8px"><b>Not classified (route not recorded):</b> ${opts.route.map(a => a === 'Fosfomycin' ? 'Fosfomycin is Watch when given orally and Reserve when given intravenously' : 'Minocycline is Watch when given orally and Reserve when given intravenously').join('; ')}.</div>`;
    if (opts.ir && opts.ir.length) out += H('&Dagger; Intrinsic resistance') + `<div style="font-size:11px;line-height:1.45;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;color:#334155"><b>${opts.ir.length}</b> antibiotic${opts.ir.length === 1 ? '' : 's'} shown ${opts.ir.length === 1 ? 'is' : 'are'} intrinsically resistant in <i>${opts.irOrg || 'this organism'}</i> (CLSI M100-Ed36, Appendix B): <b>${opts.ir.join(', ')}</b>. Resistance to ${opts.ir.length === 1 ? 'it' : 'them'} is expected and is not acquired resistance. The laboratory tested ${opts.ir.length === 1 ? 'it' : 'them'} and the results are shown as reported.</div>`;
    if (opts.uo && opts.uo.length) out += H('&sect; Urine-only agents') + `<div style="font-size:11px;line-height:1.45;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:8px 10px;color:#1e40af">CLSI M100-Ed36 designates these agents as urine only (reported only on isolates from the urinary tract; nitrofurantoin because it is effective in uncomplicated urinary tract infections only). The laboratory also tested them on non-urine specimens, and those results are <b>included</b> in the bars. The percentage with urine specimens only is given for comparison; use clinical judgement.<div style="margin-top:6px">${opts.uo.join('')}</div></div>`;
    if (contaminantCount > 0) out += H('Possible contaminants') + `<div style="font-size:11px;line-height:1.45;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:8px 10px;color:#92400e"><b>${contaminantCount}</b> blood isolate(s) of this organism are possible skin-flora contaminants. Review them clinically.</div>`;
    return out;
}

function renderChartNotes(containerSel, selectiveNotes, contaminantCount, shownAbx, opts) {
    const key = 'abx_' + containerSel.replace('#', '');
    const o = opts || {};
    const hasLow = !!o.low, hasIr = !!(o.ir && o.ir.length), hasSel = !!(selectiveNotes && selectiveNotes.length);
    let html = '<h5>How to read the bars</h5><ul>' +
        '<li><b>Solid bar:</b> 30 or more isolates were tested. The result is considered reliable.</li>' +
        (hasLow ? '<li><b>Faded grey bar, name ending with *:</b> fewer than 30 isolates were tested. Interpret with caution (CLSI M39).</li>' : '') +
        (hasIr ? '<li><b>Name ending with &Dagger;:</b> intrinsic resistance (expected for this organism, not acquired).</li>' : '') +
        (hasSel ? '<li><b>Name ending with &dagger;:</b> selective test. The antibiotic was tested on fewer than 90% of the isolates, so the percentage may be biased.</li>' : '') +
        '<li>Tap a bar: shows n (number of isolates tested) and the 95% CI. The bar height is always the selected percentage.</li></ul>';
    const groups = { A: [], W: [], R: [] };
    (shownAbx || []).forEach(a => { if (AWARE_CLASS[a]) groups[AWARE_CLASS[a]].push(a); });
    // organised blocks (inline styles so they look the same on screen and in the printed report)
    const route = (shownAbx || []).filter(a => a === 'Fosfomycin' || a === 'Minocycline');
    const blocks = chartNoteBlocks(selectiveNotes, groups, contaminantCount, Object.assign({ route }, opts || {}));
    html += blocks;
    setInfo(key, 'About this chart', html);
    // the details that matter for this particular chart are shown under the chart key
    const extra = blocks;
    $('#extra_' + containerSel.replace('#', '')).html(scopeBanner() + extra);
}

function setDashStatus(kind, text) {
    const el = document.getElementById('dashStatus');
    if (!el) return;
    el.textContent = text;
    el.className = 'text-[10px] font-bold rounded-lg px-3 py-1.5 mb-3 border ' + (kind === 'ok' ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : kind === 'warn' ? 'text-amber-800 bg-amber-50 border-amber-200' : 'text-red-700 bg-red-50 border-red-200');
}

// Branded loading screen (replaces the plain dialog): logo, progress bar and a pointer to the Guide
function showLoading(text) {
    let el = document.getElementById('loadView');
    if (!el) {
        el = document.createElement('div'); el.id = 'loadView';
        el.innerHTML = `<div class="ld-card">
            <div class="ld-logo"><img src="icon.png" alt=""></div>
            <div class="ld-name">AMR Tracker</div>
            <div class="ld-sub">Antimicrobial Resistance Surveillance</div>
            <div class="ld-bar" role="progressbar" aria-label="Loading"><i></i></div>
            <div class="ld-status" id="ldStatus"></div>
            <div class="ld-tip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></svg>
            <div><b>New here?</b> Open the <b>Guide</b> (the book icon at the top of the screen). It explains every chart, how to read it, and the standards behind it. We recommend reading it once.</div></div>
        </div>`;
        document.body.appendChild(el);
    }
    el.classList.remove('out');
    const st = document.getElementById('ldStatus'); if (st) st.textContent = text || '';
}
function hideLoading() {
    const el = document.getElementById('loadView');
    if (!el) return;
    el.classList.add('out');
    setTimeout(() => { if (el.classList.contains('out') && el.parentNode) el.parentNode.removeChild(el); }, 450);
}

function fetchCloudData() {
    if (!db) {
        refreshAll();
        return;
    }
    
    showLoading('Connecting to the surveillance cloud...');
    setTimeout(hideLoading, 15000);   // never block the app: fall back to the data saved on this phone
    
    // The dashboard reads ONLY the pseudonymised public copy (no names, hashed patient ids).
    // The private document (amr_sync) requires sign-in and is used by the data-entry app.
    db.collection("amr_public").onSnapshot(applyCloudSnap, cloudError);
}

// Processes a snapshot of the public collection (used by the live listener and by pull-to-refresh)
function applyCloudSnap(snap) {
        const docsById = {};
        snap.forEach(d => { docsById[d.id] = d.data(); });
        const data = docsById['dashboard'];
        if (data) {
            // Records live in year chunks (r_<year>_<n>); the meta document lists them.
            let cloudRecords;
            if (Array.isArray(data.records)) cloudRecords = data.records;            // old single-document copy
            else {
                cloudRecords = [];
                const ids = Object.keys(data.chunks || {}).sort();
                const have = ids.filter(id => docsById[id]).length;
                if (have < ids.length) {                                             // a part is still arriving or missing
                    hideLoading();
                    setDashStatus('warn', `Data is incomplete in the cloud (${have} of ${ids.length} parts). Open the data-entry app and use "Publish now".`);
                    refreshAll();
                    return;
                }
                ids.forEach(id => { cloudRecords = cloudRecords.concat(docsById[id].records || []); });
            }
            normalizeOrganismNames(cloudRecords);   // show current taxonomy names even if the cloud copy is older
            const cloudSettings = data.settings || { profile1_abx: 'Meropenem', profile2_abx: 'Ceftriaxone' };
            try {
                localStorage.setItem('amr_dash_records', JSON.stringify(cloudRecords));
                localStorage.setItem('amr_live_settings', JSON.stringify(cloudSettings));
                localStorage.setItem('amr_dash_lab', JSON.stringify(data.labQuality || {}));
            } catch (e) { console.warn('Local cache full', e); }

            refreshAll();
            hideLoading();
            let when = '';
            try { when = data.last_updated && data.last_updated.toDate ? data.last_updated.toDate().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : ''; } catch (e) {}
            setDashStatus(cloudRecords.length ? 'ok' : 'warn', `${cloudRecords.length} isolates${when ? ' - published ' + when : ''}`);
        } else {
            hideLoading();
            setDashStatus('warn', 'No published data found in the cloud.');
            Swal.fire({ icon: 'info', title: 'No data yet', text: 'The public dashboard data has not been published. Open the data-entry app and sign in once to publish it.' });
        }
}
function cloudError(error) {
        console.error("Firebase Error:", error);
        hideLoading();
        setDashStatus('err', `Could not read the cloud (${error && error.code ? error.code : 'error'}). Showing the last saved data on this phone.`);
        Swal.fire({ icon: 'warning', title: 'Offline Mode', text: 'Could not connect to cloud.', timer: 2000, showConfirmButton: false });
        refreshAll();
}

// Pull-to-refresh: one fresh read from the server, no loading screen
window.pullRefresh = function () {
    if (!db) { refreshAll(); return Promise.resolve(true); }
    return db.collection("amr_public").get({ source: 'server' })
        .then(snap => { applyCloudSnap(snap); return true; })
        .catch(() => false);
};
$(document).ready(function() {
    $('.select2-mobile').select2({ width: '100%' });
    $('.select2-multiple').select2({ width: '100%', allowClear: true });
    // (أضف هذا داخل document.ready)
    
    // التحقق إذا كان التطبيق مفتوح كـ App مستقل أم داخل متصفح
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    
    // إظهار نافذة التثبيت للمرة الأولى فقط إذا لم يكن مثبتاً
    if (!isStandalone && !localStorage.getItem('amr_dashboard_install_prompted')) {
        setTimeout(() => {
            showInstallGuide();
            localStorage.setItem('amr_dashboard_install_prompted', 'true');
        }, 2000); // تأخير ثانيتين لضمان تحميل الصفحة بالكامل
    }
    let currentYear = new Date().getFullYear();
    $('#ana_start').val(`${currentYear}-01-01`);
    $('#ana_end').val(`${currentYear}-12-31`);

    $('#ana_start, #ana_end, #ana_sample').on('change', function() {
        if(!isUpdatingFilters) loadAnalyticsFilters();
    });

    switchTab('analytics');
    
    // بدء جلب البيانات وتحديث الواجهة
    fetchCloudData();
});

function generateLiveSurveillance() {
    let allRecords = getDashRecords();
    let settings = JSON.parse(localStorage.getItem('amr_live_settings')) || {};
    
    const blacklist = ["xxx", "con", "no growth", "contaminated", "normal flora", "mixed flora", "no significant growth"];
    let cleanRecords = allRecords.filter(r => {
        let org = (r['Selective organism'] || "").toLowerCase();
        return org !== "" && !blacklist.some(b => org.includes(b));
    });

    if (cleanRecords.length === 0) {
        $('#live_month_title').text('Target Month (No Data)');
        $('#live_q_title').text('Target Quarter (No Data)');
        $('#live_y_title').text('Target Year (No Data)');
        liveCharts.forEach(c => c.destroy());
        liveCharts = [];
        return;
    }

    // All windows end at the "Report data up to" month (or the latest month with data)
    const anchor = dashAnchor(cleanRecords);
    const targetMonthPrefix = anchor;
    const q3from = ymShift(anchor, -2);
    const qLabel = ymLabel(q3from) + ' \u2013 ' + ymLabel(anchor);
    let monthRecords = cleanRecords.filter(r => r.Date && String(r.Date).slice(0, 7) === targetMonthPrefix);
    let quarterRecords = cleanRecords.filter(r => { const m = String(r.Date || '').slice(0, 7); return m >= q3from && m <= anchor; });

    // Last Year tab: rolling 12 months by default (see dashboard_year.js)
    const fullYear = (typeof yaLabel === 'function' && typeof yaYear === 'function') ? yaLabel(yaYear()) : dashCalendarYear(cleanRecords);

    $('#live_y_title').text(`Surveillance Overview (${fullYear})`);
    $('#live_month_title').text(`Surveillance Overview (${ymLabel(targetMonthPrefix)})`);
    $('#live_q_title').text(`Surveillance Overview (${qLabel})`);

    liveCharts.forEach(c => c.destroy());
    liveCharts = [];

    buildMobileLiveSection(monthRecords, 'm', settings, targetMonthPrefix);
    buildMobileLiveSection(quarterRecords, 'q', settings, qLabel);
}

function buildMobileLiveSection(records, prefix, settings, timeLabel) {
    const inScope = scopeRecs(records);   // raw count in the selected unit filter, before the first isolate is chosen
    $(`#live_${prefix}_total`).text(inScope.length);
    if(inScope.length === 0) {
        $(`#live_${prefix}_bug`).text("-");
        $(`#live_${prefix}_spec`).text("-");
        $(`#live_${prefix}_watchlist_container`).addClass('hidden');
        return;
    }


    // --- CLSI M39 DEDUPLICATION (First isolate per patient per organism per year) ---
    records = applyDeduplication(records);
    const surveillanceRecords = records;
    $(`#live_${prefix}_total`).text(records.length);

    // Overview details (i): method + possible contaminants (flagged, not removed)
    const contamN = records.filter(isPossibleContaminant).length;
    let overviewHtml = `<h5>What it shows</h5><p>The period contains <b>${records.length}</b> first isolates, with the most frequent organism and specimen.</p>` +
        '<h5>How the numbers are counted</h5><ul><li>Only the first isolate per patient and organism within the reported period is counted (CLSI M39).</li><li>Screening cultures (for example rectal or nasal swabs) are excluded.</li></ul>';
    if (contamN > 0) overviewHtml += `<h5>Possible contaminants</h5><p><b>${contamN}</b> blood isolate(s) are possible skin-flora contaminants (coagulase-negative staphylococci, <i>Corynebacterium</i>, <i>Micrococcus</i>, viridans streptococci and similar). They are counted, not removed, and should be reviewed clinically.</p>`;
    setInfo('overview_' + prefix, 'Surveillance overview', overviewHtml);
    attachInfo($(`#live_${prefix}_total`).closest('.grid').prev(), 'overview_' + prefix);

    let orgCounts = {}, specCounts = {};


    // Prevalence is tallied on first isolates only
    records.forEach(r => {
        let org = r['Selective organism'] || "", spec = r['Sample'];
        orgCounts[org] = (orgCounts[org] || 0) + 1;
        if (spec && spec !== "-") specCounts[spec] = (specCounts[spec] || 0) + 1;
    });

    $(`#live_${prefix}_bug`).text(formatOrgName(Object.keys(orgCounts).sort((a, b) => orgCounts[b] - orgCounts[a])[0]) || "-");
    $(`#live_${prefix}_spec`).text(Object.keys(specCounts).sort((a, b) => specCounts[b] - specCounts[a])[0] || "-");

// --- 🚨 MDR / XDR Classification Algorithm ---
    let mdrStats = { 'Non-MDR': 0, 'MDR': 0, 'XDR': 0, 'PDR': 0 };
    let possibleXdrCount = 0, possiblePdrCount = 0;
    let wardMdrStats = {};

    // MDR/XDR is evaluated on first isolates only (deduplicated), classifiable organisms only
    surveillanceRecords.forEach(r => {
        let ward = r['Ward'] || "Unknown";
        let res = classifyMDR(r);
        if (!res) return; // organism outside the Magiorakos category lists (or contaminant)

        let classification = res.cls;
        if (res.possibleXDR) possibleXdrCount++;
        if (res.possiblePDR) possiblePdrCount++;
        mdrStats[classification]++;

        // حساب التوزيع حسب الردهات
        if (!wardMdrStats[ward]) {
            wardMdrStats[ward] = { 'Non-MDR': 0, 'MDR': 0, 'XDR': 0, 'PDR': 0, total: 0 };
        }
        wardMdrStats[ward][classification]++;
        wardMdrStats[ward].total++;
    });

    // 1. بناء مخطط الدونات (MDR/XDR Overall Burden)
    let mdrData = [mdrStats['Non-MDR'], mdrStats['MDR'], mdrStats['XDR'], mdrStats['PDR']];
    let mdrLabels = ['Non-MDR', 'MDR', 'XDR', 'PDR'];
    let mdrColors = ['#10b981', '#f59e0b', '#e11d48', '#7f1d1d'];

    if (mdrData.reduce((a, b) => a + b, 0) === 0) {
        mdrData = [1]; mdrLabels = ['No Valid Data']; mdrColors = ['#e2e8f0'];
    }

    liveCharts.push(new Chart(document.getElementById(`chart_${prefix}_mdr_pie`), {
        type: 'doughnut',
        data: { labels: mdrLabels, datasets: [{ data: mdrData, backgroundColor: mdrColors, borderWidth: 2 }] },
        options: { 
            responsive: true, maintainAspectRatio: false, 
            cutout: '65%',
            plugins: { 
                legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9, weight: 'bold' } } },
                title: { display: true, text: ['Resistance Classification', `n=${mdrData.reduce((x, y) => x + y, 0)}`], font: { size: 10, weight: 'bold' }, padding: { bottom: 10 } }
            } 
        }
    }));

    setInfo('mdr_' + prefix, 'MDR / XDR / PDR classification', mdrInfoHtml(possibleXdrCount, possiblePdrCount));
    attachInfo($(`#chart_${prefix}_mdr_pie`).parent().parent(), 'mdr_' + prefix);

    // 2. بناء مخطط الأعمدة المتراكمة (Top Wards by MDR/XDR)
    // فرز الردهات حسب عدد حالات (MDR + XDR) التراكمي
    let sortedWards = Object.keys(wardMdrStats)
        .sort((a, b) => (wardMdrStats[b]['MDR'] + wardMdrStats[b]['XDR'] + wardMdrStats[b]['PDR']) - (wardMdrStats[a]['MDR'] + wardMdrStats[a]['XDR'] + wardMdrStats[a]['PDR']))
        .slice(0, 5); // أخذ أخطر 5 ردهات فقط

    let stackLabels = sortedWards.map(w => w.length > 12 ? w.slice(0, 10) + '..' : w);
    let stackNonMDR = sortedWards.map(w => wardMdrStats[w]['Non-MDR']);
    let stackMDR = sortedWards.map(w => wardMdrStats[w]['MDR']);
    let stackXDR = sortedWards.map(w => wardMdrStats[w]['XDR']);
    let stackPDR = sortedWards.map(w => wardMdrStats[w]['PDR']);

    liveCharts.push(new Chart(document.getElementById(`chart_${prefix}_mdr_bar`), {
        type: 'bar',
        data: {
            labels: stackLabels,
            datasets: [
                { label: 'Non-MDR', data: stackNonMDR, backgroundColor: '#10b981', borderRadius: 2 },
                { label: 'MDR', data: stackMDR, backgroundColor: '#f59e0b', borderRadius: 2 },
                { label: 'XDR', data: stackXDR, backgroundColor: '#e11d48', borderRadius: 2 },
                { label: 'PDR', data: stackPDR, backgroundColor: '#7f1d1d', borderRadius: 2 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { 
                legend: { display: false }, // أخفينا اللجند لأن الدونات يوضحه
                title: { display: true, text: 'Hotspots (Top 5 Wards)', font: { size: 10, weight: 'bold' }, padding: { bottom: 10 } }
            },
            scales: {
                x: vAxisX(84, { stacked: true, grid: { display: false } }),
                y: { stacked: true, beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { stepSize: 1 } }
            }
        },
        plugins: [centredAbxLabels]
    }));
    // 🚨 Global Threat Watchlist Logic (Graphical & Detailed Edition)
    let watchBug = settings.watchlist_bug;
    if (watchBug && watchBug !== "") {
        let normalizedWatchBug = watchBug.split('(')[0].trim().toLowerCase();
        let watchRecords = records.filter(r => {
            let org = (r['Selective organism'] || "").split('(')[0].trim().toLowerCase();
            return org === normalizedWatchBug;
        });
        
        if (watchRecords.length === 0) {
            const nm = typeof formatScientificName === 'function' ? formatScientificName(watchBug) : watchBug;
            $(`#live_${prefix}_watchlist_container`).html(`<div class="flex items-center gap-2 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2"><svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg><span>Watchlist: <i>${nm}</i> - none detected (${timeLabel})</span></div>`).removeClass('hidden');
            return;
        }
        let wWard = {}, wSpec = {}, wAbxT = {}, wAbxR = {}, wAbxOrgs = {};
        let allPossibleAbxs = [...(typeof abxList !== 'undefined' ? abxList : []), ...getCustomAntibiotics().map(a => a.name)];

        watchRecords.forEach(r => {
            if(r.Ward && r.Ward !== "-") wWard[r.Ward] = (wWard[r.Ward] || 0) + 1;
            if(r.Sample && r.Sample !== "-") wSpec[r.Sample] = (wSpec[r.Sample] || 0) + 1;
            
            allPossibleAbxs.forEach(a => {
                if(r[a] && r[a] !== '-' && r[a] !== '') {
                    wAbxT[a] = (wAbxT[a] || 0) + 1;
                    (wAbxOrgs[a] = wAbxOrgs[a] || new Set()).add(r['Selective organism'] || '');
                    if(r[a] === 'R') wAbxR[a] = (wAbxR[a] || 0) + 1;
                }
            });
        });
        
        let sortedWards = Object.keys(wWard).sort((a,b) => wWard[b] - wWard[a]);
        let sortedSpecs = Object.keys(wSpec).sort((a,b) => wSpec[b] - wSpec[a]);
        let topW = sortedWards[0] || "None Yet";
        let topS = sortedSpecs[0] || "None Yet";

        // بناء أشرطة التقدم للردهات (Ward Distribution Bars)
        let wardBarsHtml = sortedWards.slice(0, 4).map(w => {
            let cnt = wWard[w];
            let pct = watchRecords.length > 0 ? Math.round((cnt / watchRecords.length) * 100) : 0;
            return `
                <div class="mb-2 last:mb-0">
                    <div class="flex justify-between text-[10px] font-bold text-slate-700 mb-0.5">
                        <span class="truncate pr-2">${w}</span>
                        <span class="text-rose-700 shrink-0">${cnt} (${pct}%)</span>
                    </div>
                    <div class="w-full bg-rose-100 rounded-full h-1.5 overflow-hidden">
                        <div class="bg-rose-600 h-1.5 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
                    </div>
                </div>`;
        }).join('') || '<div class="text-[10px] text-slate-400 text-center py-3">No ward data recorded</div>';

        // بناء أشرطة التقدم للعينات (Specimen Distribution Bars)
        let specBarsHtml = sortedSpecs.slice(0, 4).map(s => {
            let cnt = wSpec[s];
            let pct = watchRecords.length > 0 ? Math.round((cnt / watchRecords.length) * 100) : 0;
            return `
                <div class="mb-2 last:mb-0">
                    <div class="flex justify-between text-[10px] font-bold text-slate-700 mb-0.5">
                        <span class="truncate pr-2">${s}</span>
                        <span class="text-amber-700 shrink-0">${cnt} (${pct}%)</span>
                    </div>
                    <div class="w-full bg-amber-100 rounded-full h-1.5 overflow-hidden">
                        <div class="bg-amber-500 h-1.5 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
                    </div>
                </div>`;
        }).join('') || '<div class="text-[10px] text-slate-400 text-center py-3">No specimen data recorded</div>';

        let displayBugName = typeof formatScientificName === 'function' ? formatScientificName(watchBug) : watchBug;
        let testedAbxs = Object.keys(wAbxT).sort((a,b) => ((wAbxR[b]||0)/wAbxT[b]) - ((wAbxR[a]||0)/wAbxT[a]));
        let chartMinWidth = testedAbxs.length > 5 ? (testedAbxs.length * 42) + 'px' : '100%';

        let htmlWatch = `
        <div class="bg-rose-50 border border-rose-200 rounded-xl p-4 shadow-sm mt-4">
            <!-- Header -->
            <h4 class="text-xs font-bold text-rose-900 mb-3 flex items-center justify-between">
                <span class="flex items-center gap-1.5">
                    <svg class="w-4 h-4 text-rose-600 animate-pulse shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    <span>Watchlist Threat: <span class="italic font-black">${displayBugName}</span></span>
                </span>
                <span class="text-[9px] bg-rose-200/80 text-rose-900 px-2.5 py-0.5 rounded-full font-extrabold shrink-0">${timeLabel}</span>
            </h4>

            <!-- Top 3 Summary KPIs -->
            <div class="grid grid-cols-3 gap-2 text-center text-[10px] mb-3">
                <div class="bg-white p-2.5 rounded-lg border border-rose-100 shadow-sm">
                    <span class="block text-slate-500 mb-0.5">Total Cases</span>
                    <span class="font-black text-rose-700 text-base">${watchRecords.length}</span>
                </div>
                <div class="bg-white p-2.5 rounded-lg border border-rose-100 shadow-sm">
                    <span class="block text-slate-500 mb-0.5">Hotspot Ward</span>
                    <span class="font-bold text-rose-700 truncate block" title="${topW}">${topW}</span>
                </div>
                <div class="bg-white p-2.5 rounded-lg border border-rose-100 shadow-sm">
                    <span class="block text-slate-500 mb-0.5">Top Specimen</span>
                    <span class="font-bold text-rose-700 truncate block" title="${topS}">${topS}</span>
                </div>
            </div>

            <!-- Visual Breakdown: Wards & Specimens Progress Bars -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div class="bg-white p-3 rounded-lg border border-rose-100 shadow-sm">
                    <h5 class="text-[10px] font-bold text-slate-700 mb-2 border-b border-slate-100 pb-1 flex justify-between">
                        <span>🏥 Spread by Ward</span>
                        <span class="text-slate-400 font-normal">Count (%)</span>
                    </h5>
                    ${wardBarsHtml}
                </div>
                <div class="bg-white p-3 rounded-lg border border-rose-100 shadow-sm">
                    <h5 class="text-[10px] font-bold text-slate-700 mb-2 border-b border-slate-100 pb-1 flex justify-between">
                        <span>🧪 Spread by Specimen</span>
                        <span class="text-slate-400 font-normal">Count (%)</span>
                    </h5>
                    ${specBarsHtml}
                </div>
            </div>

            <!-- Graphical Antibiogram Chart for Watchlist Bug -->
            <div class="bg-white p-3 rounded-lg border border-rose-100 shadow-sm">
                <div class="flex justify-between items-center mb-2">
                    <h5 class="text-[10px] font-bold text-slate-700">📊 Resistance Profile (% R)</h5>
                    <span class="text-[9px] text-slate-400">${testedAbxs.length} Antibiotics Tested</span>
                </div>
                ${testedAbxs.length > 0 ? `
                <div class="w-full overflow-x-auto custom-scroll">
                    <div class="relative" style="height:250px; min-width: ${chartMinWidth};">
                        <canvas id="chart_${prefix}_watch_abx"></canvas>
                    </div>
                </div>` : `<div class="text-[10px] text-slate-400 text-center py-6">No susceptibility testing data available for this period</div>`}
            </div>
        </div>`;

        $(`#live_${prefix}_watchlist_container`).html(htmlWatch).removeClass('hidden');

        // رسم المخطط البياني للمضادات الحيوية الخاصة ببكتيريا الـ Watchlist
        if (testedAbxs.length > 0) {
            let abxLabels = [], abxData = [], abxColors = [], abxCI = [], abxN = [];
            testedAbxs.forEach(a => {
                let t = wAbxT[a];
                let r = wAbxR[a] || 0;
                let p = Math.round((r / t) * 100);
                const wOrgs = [...(wAbxOrgs[a] || [])].filter(Boolean);
                const wIntr = wOrgs.length > 0 && wOrgs.every(o => isIntrinsicResistance(o, a));   // intrinsic only when every organism tested for it is intrinsically resistant
                const wSel = isSelectivelyTested(t, watchRecords.length);
                abxLabels.push(a + (wIntr ? ' ‡' : '') + (wSel ? ' †' : '') + (t >= 30 ? '' : ' *'));
                abxData.push(p);
                // تلوين ذكي حسب شدة المقاومة (أحمر للمقاومة العالية، برتقالي للمتوسطة، أخضر للمنخفضة)
                if (p >= 60) abxColors.push('rgba(225, 29, 72, 0.85)');
                else if (p >= 30) abxColors.push('rgba(245, 158, 11, 0.85)');
                else abxColors.push('rgba(16, 185, 129, 0.85)');
                
                abxCI.push(wilsonScoreCI(r, t));
                abxN.push(t);
            });

            let watchChart = new Chart(document.getElementById(`chart_${prefix}_watch_abx`), {
                type: 'bar',
                data: {
                    labels: abxLabels,
                    datasets: [{
                        label: '% Resistance',
                        data: abxData,
                        backgroundColor: abxColors,
                        ciData: abxCI,
                        nData: abxN,
                        borderRadius: 4,
                        maxBarThickness: 28
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: ciTooltip('% Resistance')
                    },
                    scales: {
                        y: { beginAtZero: true, max: 100, ticks: { font: { size: 9 } } },
                        x: vAxisX(100, { grid: { display: false } })
                    }
                },
                plugins: [errorBarsPlugin, centredAbxLabels]
            });
            liveCharts.push(watchChart);
        }
    } else {
        $(`#live_${prefix}_watchlist_container`).addClass('hidden');
    }
}
function buildMobileAbxProfileChart(abxName, canvasId, countElId, records, primaryColor) {
    let canvas = document.getElementById(canvasId);
    if (!canvas) return;

    let orgMap = {};
    records.forEach(r => {
        let org = r['Selective organism'];
        if (!org || org === '-') return;
        let val = r[abxName];
        if (val && val !== '-' && val !== '') {
            if (!orgMap[org]) orgMap[org] = { tested: 0, resistant: 0 };
            orgMap[org].tested++;
            if (val === 'R') orgMap[org].resistant++;
        }
    });

    let sortedOrgs = Object.keys(orgMap).sort((a, b) => orgMap[b].tested - orgMap[a].tested).slice(0, 5);
    let totalTestedAbx = Object.values(orgMap).reduce((sum, item) => sum + item.tested, 0);
    if (countElId) $(`#${countElId}`).text(`(n=${totalTestedAbx})`);

    let labels = [], data = [], bgColors = [], ciData = [], nDataArr = [];
    sortedOrgs.forEach((org, index) => {
        let item = orgMap[org];
        let p = Math.round((item.resistant / item.tested) * 100);
        let palette = extendedPalette[index % extendedPalette.length];
        
        labels.push(org);
        data.push(p);
        bgColors.push(item.tested >= 30 ? palette.bg : '#94a3b8');
        ciData.push(wilsonScoreCI(item.resistant, item.tested));
        nDataArr.push(item.tested);
    });

    if (sortedOrgs.length === 0) { labels = ['No Data']; data = [0]; bgColors = ['#e2e8f0']; ciData = [{ lower: 0, upper: 0 }]; nDataArr = [0]; }

    let chart = new Chart(canvas, {
        type: 'bar',
        data: {
            // استخدام دالة الاختصار للأسماء وتطبيقها على تسميات المحور السيني (X-Axis)
            labels: labels.map(lbl => formatScientificName(lbl)),
            datasets: [{
                label: abxName,
                data: data,
                backgroundColor: bgColors, // الألوان الباهتة سيتم تطبيقها هنا تلقائياً
                ciData: ciData,
                nData: nDataArr,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: ciTooltip('% Resistance') },
            scales: { 
                y: { beginAtZero: true, max: 100 }, 
                x: vAxisX(84)
            }
        },
        plugins: [errorBarsPlugin, centredAbxLabels]
    });
    
    liveCharts.push(chart);
}

window.toggleAdvancedSearch = function() {
    $('#adv_content').toggleClass('hidden');
    $('#adv_icon').toggleClass('rotate-180');
    syncResultsCollapse('#adv_content', ['#advContainer']);
    
    // Populate the all specimens dropdown when opened
    if(!$('#adv_content').hasClass('hidden')) {
        let allRecords = getDashRecords();
        let allSamples = new Set(allRecords.map(r => r.Sample).filter(Boolean));
        let currentAdvSample = $('#adv_sample').val();
        $('#adv_sample').empty().append(new Option("All Specimens", ""));
        Array.from(allSamples).sort().forEach(s => $('#adv_sample').append(new Option(s, s)));
        if(currentAdvSample) $('#adv_sample').val(currentAdvSample);
    }
};

function loadAnalyticsFilters() {
    refreshPeriodHints();
    if (isUpdatingFilters) return;
    isUpdatingFilters = true;

    let period = anPeriod();
    let allRecords = getDashRecords();
    
    // 1. الفلترة حسب الوقت فقط للقوائم المنسدلة (لا تتأثر بالـ Inpatient/Outpatient)
    let dateRecords = filterByPeriod(allRecords, period); 
    
    // تطبيق التنقيح لمنع تكرار المرضى
    dateRecords = applyDeduplication(dateRecords);
    
    let uniqueSamples = new Set(dateRecords.map(r => r.Sample).filter(Boolean));
    let currentSample = $('#guided_sample').val();
    
    $('#guided_sample').empty();
    $('#guided_sample').append(new Option("Select a specimen...", "none", true, true));
    $('#guided_sample').append(new Option("All Specimens", "all"));
    
    Array.from(uniqueSamples).sort().forEach(s => {
        $('#guided_sample').append(new Option(s, s));
    });
    
    // الاحتفاظ بالاختيار حتى لو كانت نتيجته صفر بسبب الردهة
    if (currentSample && currentSample !== "none") {
        if (currentSample !== "all" && !uniqueSamples.has(currentSample)) {
            $('#guided_sample').append(new Option(currentSample, currentSample));
        }
        $('#guided_sample').val(currentSample);
    } else {
        $('#guided_sample').val("none");
    }

    let orgs = new Set(), abxs = new Set();
    let allPossibleAbxs = [...abxList, ...getCustomAntibiotics().map(a=>a.name)];
    
    dateRecords.forEach(r => {
        if(r['Selective organism']) orgs.add(r['Selective organism']);
        allPossibleAbxs.forEach(a => { if (r[a] && r[a] !== '-' && r[a] !== '') abxs.add(a); });
    });

    let currentAdvOrgs = $('#adv_organism').val() || [];
    $('#adv_organism').empty();
    Array.from(orgs).sort().forEach(o => {
        let isSelected = currentAdvOrgs.includes(o);
        $('#adv_organism').append(new Option(o, o, isSelected, isSelected));
    });
    currentAdvOrgs.forEach(o => {
        if (!orgs.has(o)) $('#adv_organism').append(new Option(o, o, true, true));
    });

    let currentAdvAbxs = $('#adv_antibiotic').val() || [];
    $('#adv_antibiotic').empty();
    Array.from(abxs).sort().forEach(a => {
        let isSelected = currentAdvAbxs.includes(a);
        $('#adv_antibiotic').append(new Option(a, a, isSelected, isSelected));
    });
    currentAdvAbxs.forEach(a => {
        if (!abxs.has(a)) $('#adv_antibiotic').append(new Option(a, a, true, true));
    });

    $('#guided_sample, #adv_organism, #adv_antibiotic').trigger('change.select2');
    isUpdatingFilters = false;
    
    generateGuidedAnalytics();
}
// Shared x-axis for charts whose categories are names: vertical, never skipped, fixed label area (names drawn by centredAbxLabels)
function vAxisX(h, extra) {
    return Object.assign({
        afterFit: function(s) { s.height = h; },
        ticks: { maxRotation: 90, minRotation: 90, autoSkip: false, color: 'rgba(0,0,0,0)', font: { size: 10, weight: 'bold' }, callback: function(v) { return wrapAbxLabel(this.getLabelForValue(v)); } }
    }, extra || {});
}

// Draws the rotated antibiotic names so every label (one or two lines) is centred on its bar
const centredAbxLabels = {
    id: 'centredAbxLabels',
    afterDraw(chart) {
        const sc = chart.scales.x; if (!sc) return;
        const ctx = chart.ctx, lh = 12, labels = chart.data.labels || [];
        ctx.save();
        ctx.fillStyle = '#475569'; ctx.font = "bold 10px Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        labels.forEach((l, i) => {
            const t = wrapAbxLabel(l), lines = Array.isArray(t) ? t : [t]; // marker labels already arrive as arrays
            const x = sc.getPixelForTick(i), y = sc.top + 8;
            ctx.save(); ctx.translate(x, y); ctx.rotate(-Math.PI / 2);
            // rotated: text runs bottom-to-top, so the first line sits on the left
            const maxLen = Math.max(30, sc.height - 14);
            lines.forEach((ln, k) => { while (ln.length > 3 && ctx.measureText(ln).width > maxLen) ln = ln.slice(0, -2) + '\u2026'; ctx.fillText(ln, 0, (k - (lines.length - 1) / 2) * lh); });
            ctx.restore();
        });
        ctx.restore();
    }
};

// Long combination names (e.g. Trimethoprim/Sulfamethoxazole) are split into two lines at "/" so they fit under the bars
function wrapAbxLabel(l) {
    if (Array.isArray(l)) return l;
    l = String(l == null ? '' : l);
    const i = l.indexOf('/');
    if (i < 0 || l.length < 16) return l;
    return [l.slice(0, i + 1), l.slice(i + 1)];
}

window.toggleMdrPanel = function() {
    $('#mdr_content').toggleClass('hidden');
    $('#mdr_icon').toggleClass('rotate-180');
    if (!$('#mdr_content').hasClass('hidden')) { try { window.dispatchEvent(new Event('resize')); } catch (e) {} }
};

// Result blocks that live outside their collapsible card follow the card's open/closed state
function syncResultsCollapse(contentSel, resultSels) {
    const closed = $(contentSel).hasClass('hidden');
    resultSels.forEach(s => $(s).toggleClass('res-collapsed', closed));
}
$(function() {
    syncResultsCollapse('#guided_content', ['#guidedContainer', '#guidedPlaceholder']);
    syncResultsCollapse('#adv_content', ['#advContainer']);
});

window.toggleGuidedSearch = function() {
    $('#guided_content').toggleClass('hidden');
    $('#guided_icon').toggleClass('rotate-180');
    syncResultsCollapse('#guided_content', ['#guidedContainer', '#guidedPlaceholder']);
};

// Add listener to trigger search when a specimen is selected
$(document).on('change', '#guided_sample', function() {
    generateGuidedAnalytics();
});

$(document).on('change', 'input[name="guided_metric"]', function() {
    $('.guided-metric-btn').removeClass('bg-white text-emerald-600 text-rose-600 text-amber-600 shadow-sm').addClass('text-slate-500');
    let val = $(this).val();
    currentGuidedMetric = val;
    let activeClass = val === 'S' ? 'text-emerald-600' : (val === 'R' ? 'text-rose-600' : 'text-amber-600');
    $(this).parent().removeClass('text-slate-500').addClass(`bg-white ${activeClass} shadow-sm`);
    renderGuidedAST(); 
});

$(document).on('change', '#guided_bug_select', function() {
    currentGuidedBug = $(this).val();
    renderGuidedAST();
});

function generateGuidedAnalytics() {
    const targetSample = $('#guided_sample').val();

    if (!targetSample || targetSample === "none") {
        $('#guidedContainer').addClass('hidden');
        $('#guidedPlaceholder').addClass('hidden');
        return;
    }

    let period = anPeriod();
    let allRecords = getDashRecords();
    let records = filterByPeriod(allRecords, period);

    if (targetSample !== "all") { 
        records = records.filter(r => r.Sample === targetSample); 
    }
    
    // CLSI M39: the first isolate per patient is chosen across all wards; the ward filter is applied afterwards
    records = applyDeduplication(records);
    records = applyWardFilter(records, $('input[name="guided_ward"]:checked').val() || 'total');
        
        // الإبقاء على الحاوية ظاهرة دائماً لكي لا تختفي أزرار الفلاتر (Inpatient/Outpatient)
        $('#guidedPlaceholder').addClass('hidden');
        $('#guidedContainer').removeClass('hidden');

        let orgCounts = {};
    records.forEach(r => {
        let org = r['Selective organism'];
        if(org) orgCounts[org] = (orgCounts[org] || 0) + 1;
    });

    currentGuidedOrgs = Object.keys(orgCounts).sort((a,b)=>orgCounts[b]-orgCounts[a]);
        
        if(chartGuidedPie_instance) chartGuidedPie_instance.destroy();
        
        // تنظيف عبارة No Data إن وجدت واسترجاع الـ Canvas
        if ($('#pie_nodata').length) $('#pie_nodata').replaceWith('<canvas id="chartGuidedPie"></canvas>');
        
        // في حال عدم وجود بيانات، نظهر No Data تتوسط الدائرة
        if (currentGuidedOrgs.length === 0) {
            $('#chartGuidedPie').replaceWith('<div id="pie_nodata" class="flex items-center justify-center h-full w-full text-slate-400 font-bold text-sm absolute inset-0">No Data Available</div>');
            $('#guided_bug_select').empty().append(new Option("No Data Available", ""));
            currentGuidedBug = ""; // تفريغ البكتيريا الحالية
            renderGuidedAST(); 
            return;
        }
        
        let pieLabels = currentGuidedOrgs.map(o => formatScientificName(o));
    let pieData = currentGuidedOrgs.map(o => orgCounts[o]);
    let vibrantColors = ['#0ea5e9', '#ec4899', '#8b5cf6', '#14b8a6', '#f59e0b', '#ef4444', '#84cc16', '#06b6d4', '#d946ef', '#10b981'];

    chartGuidedPie_instance = new Chart(document.getElementById('chartGuidedPie'), {
        type: 'doughnut', 
        data: { labels: pieLabels, datasets: [{ data: pieData, backgroundColor: vibrantColors }] },
        options: { 
            responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: {boxWidth: 10, font:{size: 9}} } },
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    currentGuidedBug = currentGuidedOrgs[index]; 
                    $('#guided_bug_select').val(currentGuidedBug); 
                    renderGuidedAST(); 
                }
            }
        }
    });

    let bugSelect = $('#guided_bug_select');
    bugSelect.empty();
    currentGuidedOrgs.forEach(org => {
        bugSelect.append(new Option(`${formatScientificName(org)} (n=${orgCounts[org]})`, org));
    });

    currentGuidedBug = currentGuidedOrgs[0];
    bugSelect.val(currentGuidedBug);
    renderGuidedAST();
}

$(document).on('change', '#guided_hide_low', function() { renderGuidedAST(); });

function renderGuidedAST() {
    if (chartGuidedAMR_instance) chartGuidedAMR_instance.destroy();
    
    // إذا لم تكن هناك بكتيريا متاحة، نعرض No Data تتوسط الشاشة
    if (!currentGuidedBug || currentGuidedBug === "") {
        $('#guidedAmrContainer').html('<div class="flex items-center justify-center h-full w-full text-slate-400 font-bold text-sm absolute inset-0">No Data Available</div>');
        $('#guidedAmrContainer').css('width', '100%');
        return;
    }
    
    // استرجاع الكانفاس لمخطط المضادات الحيوية في حال وجود بيانات
    $('#guidedAmrContainer').html('<canvas id="chartGuidedAMR"></canvas>');

    const targetSample = $('#guided_sample').val();
    let period = anPeriod();

    let allRecords = getDashRecords();
    let records = filterByPeriod(allRecords, period);
    records = records.filter(r => r['Selective organism'] === currentGuidedBug);
    
    if (targetSample && targetSample !== "all") {
        records = records.filter(r => r.Sample === targetSample);
    }
    
    // CLSI M39: the first isolate per patient is chosen across all wards; the ward filter is applied afterwards
    records = applyDeduplication(records);
    records = applyWardFilter(records, $('input[name="guided_ward"]:checked').val() || 'total');
    
    let allPossibleAbxs = [...abxList, ...getCustomAntibiotics().map(a=>a.name)];
    let abxStats = {};

    records.forEach(r => {
        allPossibleAbxs.forEach(abx => {
            let res = r[abx];
            if (res && res !== '-' && res !== '') {
                if (!abxStats[abx]) abxStats[abx] = { tested: 0, r: 0, s: 0, ns: 0, nu: 0, ua: { t: 0, r: 0, s: 0, ns: 0 } };
                abxStats[abx].tested += 1;
                if (isNonUrineUrineOnly(r, abx)) abxStats[abx].nu += 1;
                else { const u = abxStats[abx].ua; u.t++; if (res === 'R') u.r++; if (res === 'S') u.s++; if (res === 'R' || res === 'I' || res === 'SDD') u.ns++; }
                if (res === 'R') abxStats[abx].r += 1;
                if (res === 'S') abxStats[abx].s += 1;
                if (res === 'R' || res === 'I' || res === 'SDD') abxStats[abx].ns += 1; // حساب الـ Non-Susceptible
            }
        });
    });

    let testedAbxs = Object.keys(abxStats).sort();
    let selectiveNotes = [];
    let labels = [], data = [], bgColors = [], ciData = [], nDataArr = [];
    let baseColor = currentGuidedMetric === 'S' ? 'rgba(16, 185, 129, 0.9)' : (currentGuidedMetric === 'NS' ? 'rgba(245, 158, 11, 0.9)' : 'rgba(225, 29, 72, 0.9)');
    let irList = [], uoList = [];
    let hideLowN = $('#guided_hide_low').is(':checked');

    testedAbxs.forEach(abx => {
        let s = abxStats[abx];
        let isReliable = s.tested >= 30;

        if (hideLowN && !isReliable) return;

        let targetVal = currentGuidedMetric === 'R' ? s.r : (currentGuidedMetric === 'NS' ? s.ns : s.s);
        let p = Math.round((targetVal / s.tested) * 100);

        const selective = isSelectivelyTested(s.tested, records.length);
        const intr = isIntrinsicResistance(currentGuidedBug, abx);
        if (intr) irList.push(abx);
        if (s.nu) uoList.push(uoLine(abx, s, currentGuidedMetric, p));
        if (selective) selectiveNotes.push(`${abx} (${s.tested}/${records.length})`);
        labels.push(abx + (selective ? ' †' : '') + (intr ? ' ‡' : '') + (s.nu ? ' §' : '') + (isReliable ? '' : ' *'));
        data.push(p);
        bgColors.push(isReliable ? baseColor : 'rgba(148, 163, 184, 0.5)'); 
        ciData.push(wilsonScoreCI(targetVal, s.tested));
        nDataArr.push(s.tested);
    });

    if (labels.length === 0) {
        $('#guidedAmrContainer').html('<div class="flex items-center justify-center h-full w-full text-slate-400 font-bold text-sm absolute inset-0">No Data Available</div>');
        $('#guidedAmrContainer').css('width', '100%');
        return;
    }

    renderChartNotes('#guidedAmrContainer', selectiveNotes, records.filter(isPossibleContaminant).length, testedAbxs, { ir: irList, irOrg: formatScientificName(currentGuidedBug), uo: uoList, low: labels.some(l => / \*$/.test(l)) });
    let chartWidth = labels.length > 5 ? (labels.length * 45) + 'px' : '100%';
    $('#guidedAmrContainer').css('width', chartWidth);

    chartGuidedAMR_instance = new Chart(document.getElementById('chartGuidedAMR'), {
        type: 'bar',
        data: { labels, datasets: [{ data, backgroundColor: bgColors, ciData, nData: nDataArr, borderRadius: 4 }] },
        options: { 
            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: ciTooltip(()=>'% '+currentGuidedMetric) }, 
            scales: { y: { max: 100, beginAtZero: true }, x: vAxisX(112) } 
        },
        plugins: [errorBarsPlugin, centredAbxLabels]
    });
}
// -------------------------------------------------------------
// PATHOGEN AST PROFILE LOGIC
// -------------------------------------------------------------
window.togglePathoSearch = function() {
    $('#patho_content').toggleClass('hidden');
    $('#patho_icon').toggleClass('rotate-180');
    if(!$('#patho_content').hasClass('hidden')) updatePathoDropdowns();
};


$(document).on('change', '#patho_bug', function() { renderPathoChart(); });
$(document).on('change', 'input[name="patho_metric"]', function() {
    $('.patho-metric-btn').removeClass('bg-white text-emerald-600 text-rose-600 text-amber-600 shadow-sm').addClass('text-slate-500');
    let val = $(this).val();
    currentPathoMetric = val;
    let activeClass = val === 'S' ? 'text-emerald-600' : (val === 'R' ? 'text-rose-600' : 'text-amber-600');
    $(this).parent().removeClass('text-slate-500').addClass(`bg-white ${activeClass} shadow-sm`);
    renderPathoChart(); 
});

function updatePathoDropdowns() {
    refreshPeriodHints();
    let period = anPeriod();

    let records = getDashRecords();
    records = filterByPeriod(records, period);
    // فصلنا فلتر الردهة عن القائمة المنسدلة لتبقى ثابتة

    let orgs = new Set();
    records.forEach(r => { if(r['Selective organism']) orgs.add(r['Selective organism']); });

    let bugSelect = $('#patho_bug');
    let currentVal = bugSelect.val();
    
    if (currentVal && !orgs.has(currentVal)) {
        orgs.add(currentVal);
    }

    bugSelect.empty().append(new Option("Select a bacteria...", ""));
    Array.from(orgs).sort().forEach(o => bugSelect.append(new Option(formatScientificName(o), o)));
    
    if(currentVal) bugSelect.val(currentVal);
    bugSelect.trigger('change.select2');
    renderPathoChart();
}

$(document).on('change', '#patho_hide_low', function() { renderPathoChart(); });
$(document).on('change', '#adv_hide_low', function() { if (!$('#advContainer').hasClass('hidden')) generateAdvancedAnalytics(); });

function renderPathoChart() {
    const bug = $('#patho_bug').val();
    if(!bug) {
        if (chartPathoAMR_instance) chartPathoAMR_instance.destroy();
        $('#pathoAmrContainer').html('<canvas id="chartPathoAMR"></canvas>');
        return;
    }

    let period = anPeriod();
    let records = getDashRecords();
    records = filterByPeriod(records, period);
    records = records.filter(r => r['Selective organism'] === bug);
    // CLSI M39: the first isolate per patient is chosen across all wards; the ward filter is applied afterwards
    records = applyDeduplication(records);
    records = applyWardFilter(records, $('input[name="patho_ward"]:checked').val() || 'total');

    let allPossibleAbxs = [...abxList, ...getCustomAntibiotics().map(a=>a.name)];
    let abxStats = {};

    records.forEach(r => {
        allPossibleAbxs.forEach(abx => {
            let res = r[abx];
            if (res && res !== '-' && res !== '') {
                if (!abxStats[abx]) abxStats[abx] = { tested: 0, r: 0, s: 0, ns: 0, nu: 0, ua: { t: 0, r: 0, s: 0, ns: 0 } };
                abxStats[abx].tested += 1;
                if (isNonUrineUrineOnly(r, abx)) abxStats[abx].nu += 1;
                else { const u = abxStats[abx].ua; u.t++; if (res === 'R') u.r++; if (res === 'S') u.s++; if (res === 'R' || res === 'I' || res === 'SDD') u.ns++; }
                if (res === 'R') abxStats[abx].r += 1;
                if (res === 'S') abxStats[abx].s += 1;
                if (res === 'R' || res === 'I' || res === 'SDD') abxStats[abx].ns += 1;
            }
        });
    });

    let testedAbxs = Object.keys(abxStats).sort();
    
    if (chartPathoAMR_instance) chartPathoAMR_instance.destroy();
    
    if (testedAbxs.length === 0) {
        $('#pathoAmrContainer').html('<div class="flex items-center justify-center h-[200px] w-full text-slate-400 font-bold text-sm">No Data Available</div>');
        return;
    }
    
    $('#pathoAmrContainer').html('<canvas id="chartPathoAMR"></canvas>');

    let selectiveNotes = [];
    let labels = [], data = [], bgColors = [], ciData = [], nDataArr = [];
    let baseColor = currentPathoMetric === 'S' ? 'rgba(16, 185, 129, 0.9)' : (currentPathoMetric === 'NS' ? 'rgba(245, 158, 11, 0.9)' : 'rgba(225, 29, 72, 0.9)');
    let irList = [], uoList = [];
    let hideLowN = $('#patho_hide_low').is(':checked');

    testedAbxs.forEach(abx => {
        let s = abxStats[abx];
        let isReliable = s.tested >= 30;

        if (hideLowN && !isReliable) return;

        let targetVal = currentPathoMetric === 'R' ? s.r : (currentPathoMetric === 'NS' ? s.ns : s.s);
        let p = Math.round((targetVal / s.tested) * 100);

        const selective = isSelectivelyTested(s.tested, records.length);
        const intr = isIntrinsicResistance(bug, abx);
        if (intr) irList.push(abx);
        if (s.nu) uoList.push(uoLine(abx, s, currentPathoMetric, p));
        if (selective) selectiveNotes.push(`${abx} (${s.tested}/${records.length})`);
        labels.push(abx + (selective ? ' †' : '') + (intr ? ' ‡' : '') + (s.nu ? ' §' : '') + (isReliable ? '' : ' *'));
        data.push(p);
        bgColors.push(isReliable ? baseColor : 'rgba(148, 163, 184, 0.5)'); 
        ciData.push(wilsonScoreCI(targetVal, s.tested));
        nDataArr.push(s.tested);
    });

    renderChartNotes('#pathoAmrContainer', selectiveNotes, records.filter(isPossibleContaminant).length, testedAbxs, { ir: irList, irOrg: formatScientificName(bug), uo: uoList, low: labels.some(l => / \*$/.test(l)) });
    let chartWidth = labels.length > 5 ? (labels.length * 45) + 'px' : '100%';
    $('#pathoAmrContainer').css('width', chartWidth);

    chartPathoAMR_instance = new Chart(document.getElementById('chartPathoAMR'), {
        type: 'bar',
        data: { labels, datasets: [{ data, backgroundColor: bgColors, ciData, nData: nDataArr, borderRadius: 4 }] },
        options: { 
            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: ciTooltip(()=>'% '+currentPathoMetric) }, 
            scales: { y: { max: 100, beginAtZero: true }, x: vAxisX(112) } 
        },
        plugins: [errorBarsPlugin, centredAbxLabels]
    });
}
// -------------------------------------------------------------
// ANTIMICROBIAL EFFICACY PROFILE LOGIC
// -------------------------------------------------------------
window.toggleAbxSearch = function() {
    $('#abx_content').toggleClass('hidden');
    $('#abx_icon').toggleClass('rotate-180');
    if(!$('#abx_content').hasClass('hidden')) updateAbxDropdowns();
};

$(document).on('change', '#abx_drug', function() { renderAbxChart(); });
$(document).on('change', 'input[name="abx_metric"]', function() {
    $('.abx-metric-btn').removeClass('bg-white text-emerald-600 text-rose-600 text-amber-600 shadow-sm').addClass('text-slate-500');
    let val = $(this).val();
    currentAbxMetric = val;
    let activeClass = val === 'S' ? 'text-emerald-600' : (val === 'R' ? 'text-rose-600' : 'text-amber-600');
    $(this).parent().removeClass('text-slate-500').addClass(`bg-white ${activeClass} shadow-sm`);
    renderAbxChart(); 
});

function updateAbxDropdowns() {
    refreshPeriodHints();
    let period = anPeriod();

    let records = getDashRecords();
    records = filterByPeriod(records, period);
    // تم فصل فلتر الردهة للحفاظ على قائمة المضادات

    let abxs = new Set();
    let allPossibleAbxs = [...abxList, ...getCustomAntibiotics().map(a=>a.name)];
    records.forEach(r => {
        allPossibleAbxs.forEach(a => { if (r[a] && r[a] !== '-' && r[a] !== '') abxs.add(a); });
    });

    let drugSelect = $('#abx_drug');
    let currentVal = drugSelect.val();
    
    if (currentVal && !abxs.has(currentVal)) {
        abxs.add(currentVal);
    }

    drugSelect.empty().append(new Option("Select an antimicrobial...", ""));
    Array.from(abxs).sort().forEach(a => drugSelect.append(new Option(a, a)));
    
    if(currentVal) drugSelect.val(currentVal);
    drugSelect.trigger('change.select2');
    renderAbxChart();
}

$(document).on('change', '#abx_hide_low', function() { renderAbxChart(); });

function renderAbxChart() {
    const drug = $('#abx_drug').val();
    if(!drug) {
        if (chartAbxAMR_instance) chartAbxAMR_instance.destroy();
        $('#abxAmrContainer').html('<canvas id="chartAbxAMR"></canvas>');
        return;
    }

    let period = anPeriod();
    let records = getDashRecords();
    records = filterByPeriod(records, period);
    // CLSI M39: the first isolate per patient is chosen across all wards; the ward filter is applied afterwards
    records = applyDeduplication(records);
    records = applyWardFilter(records, $('input[name="abx_ward"]:checked').val() || 'total');

    let orgStats = {};
    records.forEach(r => {
        let org = r['Selective organism'];
        let res = r[drug];
        if (org && res && res !== '-' && res !== '') {
            if (!orgStats[org]) orgStats[org] = { tested: 0, r: 0, s: 0, ns: 0, nu: 0, ua: { t: 0, r: 0, s: 0, ns: 0 } };
            orgStats[org].tested += 1;
            if (res === 'R') orgStats[org].r += 1;
            if (res === 'S') orgStats[org].s += 1;
            if (res === 'R' || res === 'I' || res === 'SDD') orgStats[org].ns += 1;
            if (isNonUrineUrineOnly(r, drug)) orgStats[org].nu += 1;
            else { const u = orgStats[org].ua; u.t++; if (res === 'R') u.r++; if (res === 'S') u.s++; if (res === 'R' || res === 'I' || res === 'SDD') u.ns++; }
        }
    });

    let testedOrgs = Object.keys(orgStats).sort();
    const orgAllN = {};
    records.forEach(r => { const o = r['Selective organism']; if (o) orgAllN[o] = (orgAllN[o] || 0) + 1; });
    
    if (chartAbxAMR_instance) chartAbxAMR_instance.destroy();

    if (testedOrgs.length === 0) {
        $('#abxAmrContainer').html('<div class="flex items-center justify-center h-[200px] w-full text-slate-400 font-bold text-sm">No Data Available</div>');
        return;
    }
    
    $('#abxAmrContainer').html('<canvas id="chartAbxAMR"></canvas>');

    let labels = [], data = [], bgColors = [], ciData = [], nDataArr = [];
    let baseColor = currentAbxMetric === 'S' ? 'rgba(16, 185, 129, 0.9)' : (currentAbxMetric === 'NS' ? 'rgba(245, 158, 11, 0.9)' : 'rgba(225, 29, 72, 0.9)');
    let irOrgs = [], nuTot = 0, allTot = 0, uoOrgLines = [], selOrgs = [];
    let hideLowN = $('#abx_hide_low').is(':checked');

    testedOrgs.forEach(org => {
        let s = orgStats[org];
        let isReliable = s.tested >= 30;

        if (hideLowN && !isReliable) return;

        let targetVal = currentAbxMetric === 'R' ? s.r : (currentAbxMetric === 'NS' ? s.ns : s.s);
        let p = Math.round((targetVal / s.tested) * 100);

        let formattedOrg = formatScientificName(org);
        const intr = isIntrinsicResistance(org, drug);
        nuTot += s.nu || 0; allTot += s.tested;
        if (s.nu) uoOrgLines.push(uoLine(formattedOrg, s, currentAbxMetric, p));
        if (intr) irOrgs.push(formattedOrg);
        const sel = isSelectivelyTested(s.tested, orgAllN[org] || 0);
        if (sel) selOrgs.push(formattedOrg + ' (' + s.tested + '/' + orgAllN[org] + ')');
        labels.push(formattedOrg + (intr ? ' ‡' : '') + (sel ? ' †' : '') + (isReliable ? '' : ' *'));
        data.push(p);
        bgColors.push(isReliable ? baseColor : 'rgba(148, 163, 184, 0.5)'); 
        ciData.push(wilsonScoreCI(targetVal, s.tested));
        nDataArr.push(s.tested);
    });

    let abxExtra = '';
    if (selOrgs.length) abxExtra += `<div style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#64748b;margin:14px 0 6px">&dagger; Selective tests (tested / isolates)</div>` + `<div style="font-size:11px;line-height:1.45;color:#334155">${selOrgs.join('<br>')}</div>`;
    const NH = t => `<div style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#64748b;margin:14px 0 6px">${t}</div>`;
    if (irOrgs.length) abxExtra += NH('&Dagger; Intrinsic resistance') + `<div style="font-size:11px;line-height:1.45;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;color:#334155">${drug} is intrinsically resistant in <b>${irOrgs.length}</b> organism${irOrgs.length === 1 ? '' : 's'} shown (CLSI M100-Ed36, Appendix B): <b>${irOrgs.join(', ')}</b>. Resistance is expected there and is not acquired resistance. The laboratory tested it and the results are shown as reported.</div>`;
    if (nuTot > 0) abxExtra += NH('&sect; Urine-only agent') + `<div style="font-size:11px;line-height:1.45;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:8px 10px;color:#1e40af"><b>${drug}</b>: CLSI M100-Ed36 designates this agent as urine only (reported only on isolates from the urinary tract). <b>${nuTot}</b> of ${allTot} results shown come from non-urine specimens and are <b>included</b> in the bars. The percentage with urine specimens only is given for comparison; use clinical judgement.<div style=\"margin-top:6px\">${uoOrgLines.join('')}</div></div>`;
    $('#extra_abxAmrContainer').html(scopeBanner() + abxExtra);
    let chartWidth = labels.length > 5 ? (labels.length * 45) + 'px' : '100%';
    $('#abxAmrContainer').css('width', chartWidth);

    chartAbxAMR_instance = new Chart(document.getElementById('chartAbxAMR'), {
        type: 'bar',
        data: { labels, datasets: [{ data, backgroundColor: bgColors, ciData, nData: nDataArr, borderRadius: 4 }] },
        options: { 
            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: ciTooltip(()=>'% '+currentAbxMetric) }, 
            scales: { y: { max: 100, beginAtZero: true }, x: vAxisX(112) } 
        },
        plugins: [errorBarsPlugin, centredAbxLabels]
    });
}
// Period sentence for the heatmap note, based on the dates actually covered by the records
function hmPeriodNote(records) {
    const ds = records.map(r => r.Date).filter(Boolean).sort();
    const base = ['CLSI M39 recommends analysing cumulative data at least annually (Section 6.3).', 'The analysis period is typically one year (Section 6.4).'];
    if (!ds.length) return base;
    const days = (new Date(ds[ds.length - 1]) - new Date(ds[0])) / 86400000 + 1;
    const span = ds[0] + ' to ' + ds[ds.length - 1];
    if (days < 360) return ['<b>Period shown: ' + span + ' (about ' + Math.round(days) + ' days), shorter than one year.</b>'].concat(base, ['Presenting data more often may be complicated by seasonal variation in resistance rates.', 'Estimates are imprecise when isolate numbers are small.', 'Read this map as an indication only.']);
    if (days > 372) return ['<b>Period shown: ' + span + ', more than one year (years combined).</b>'].concat(base, ['When several years are combined, M39 (Section 6.4) uses the first isolate per patient per calendar year.', 'M39 advises a footnote alerting readers that the data are combined.']);
    return ['Period shown: ' + span + '.'].concat(base);
}
window.generateAdvancedAnalytics = function() {
    const startDate = $('#adv_start').val();
    const endDate = $('#adv_end').val();
    const targetSample = $('#adv_sample').val();
    let targetOrgs = $('#adv_organism').val() || [];
    let targetAbxs = $('#adv_antibiotic').val() || [];
    const metric = $('#adv_metric').val() || 'R'; 

    if (startDate && endDate && startDate > endDate) {
        $('#heatmapWrapper').html('<div class="flex items-center justify-center h-[100px] w-full text-amber-700 font-bold text-sm text-center px-4">The From month is after the To month. Please correct the dates.</div>');
        $('#heatmapNote').html('');
        Swal.fire('Check the dates', 'The From month is after the To month.', 'warning');
        return;
    }

    let allRecords = getDashRecords();
    let records = allRecords; // Start with entire database

    // Filter ONLY if the user selected a date
    if (startDate && endDate) {
        records = records.filter(r => r.Date >= startDate && r.Date <= endDate);
    } else if (startDate) {
        records = records.filter(r => r.Date >= startDate);
    } else if (endDate) {
        records = records.filter(r => r.Date <= endDate);
    }
    // No From/To: the Analytics period applies
    if (!startDate && !endDate) records = filterByPeriod(records, anPeriod());

    // Filter ONLY if the user selected a sample
    if (targetSample) { 
        records = records.filter(r => r.Sample === targetSample); 
    }

    // Apply Ward Filter (All / Inpatient / Outpatient)
    // CLSI M39: the first isolate per patient is chosen across all wards; the ward filter is applied afterwards
    records = applyDeduplication(records);
    records = applyWardFilter(records, $('input[name="adv_ward"]:checked').val() || 'total');

    // --- NEW LOGIC: If left blank, automatically grab ALL available options ---
    if (targetOrgs.length === 0) {
        targetOrgs = Array.from(document.getElementById('adv_organism').options).map(o => o.value);
    }
    if (targetAbxs.length === 0) {
        targetAbxs = Array.from(document.getElementById('adv_antibiotic').options).map(o => o.value);
    }

    // If there is literally zero data in the database matching the criteria
    if (targetOrgs.length === 0 || targetAbxs.length === 0) {
        Swal.fire('No Data', 'No records match your selected criteria.', 'info');
        return;
    }

    $('#advContainer').removeClass('hidden');
    let hmLegend = (metric === 'R' || metric === 'NS') ? 
        `<span class="px-1 bg-emerald-100 text-emerald-800 rounded">0-20%</span><span class="px-1 bg-yellow-100 text-yellow-800 rounded">21-40%</span><span class="px-1 bg-orange-200 text-orange-900 rounded">41-60%</span><span class="px-1 bg-red-400 text-white rounded">61-80%</span><span class="px-1 bg-red-600 text-white rounded">81-100%</span>` :
        `<span class="px-1 bg-red-600 text-white rounded">0-20%</span><span class="px-1 bg-red-400 text-white rounded">21-40%</span><span class="px-1 bg-orange-200 text-orange-900 rounded">41-60%</span><span class="px-1 bg-yellow-100 text-yellow-800 rounded">61-80%</span><span class="px-1 bg-emerald-100 text-emerald-800 rounded">81-100%</span>`;
    // the grey chip is added after the table is built, when it is known whether any cell is grey
    $('#heatmapLegend').html(hmLegend);

    let heatmapStats = {}, orgCounts = {};
    targetOrgs.forEach(org => heatmapStats[org] = {});

    records.forEach(r => {
        let org = r['Selective organism'];
        if(targetOrgs.includes(org)) {
            orgCounts[org] = (orgCounts[org] || 0) + 1;
            targetAbxs.forEach(abx => {
                let res = r[abx];
                if (res && res !== '-' && res !== '') {
                   if (!heatmapStats[org][abx]) heatmapStats[org][abx] = { t: 0, r: 0, s: 0, ns: 0, nu: 0, ua: { t: 0, r: 0, s: 0, ns: 0 } };
                    heatmapStats[org][abx].t += 1;
                    if (isNonUrineUrineOnly(r, abx)) heatmapStats[org][abx].nu += 1;
                    else { const u = heatmapStats[org][abx].ua; u.t++; if (res === 'R') u.r++; if (res === 'S') u.s++; if (res === 'R' || res === 'I' || res === 'SDD') u.ns++; }
                    if (res === 'R') heatmapStats[org][abx].r += 1;
                    if (res === 'S') heatmapStats[org][abx].s += 1;
                    if (res === 'R' || res === 'I' || res === 'SDD') heatmapStats[org][abx].ns += 1;
                }
            });
        }
    });

    const hmHideLow = $('#adv_hide_low').is(':checked');
    if (hmHideLow) Object.keys(heatmapStats).forEach(o => Object.keys(heatmapStats[o]).forEach(a => { if (heatmapStats[o][a].t < 30) delete heatmapStats[o][a]; }));
    let hmOrgs = Object.keys(heatmapStats).sort();
    let hmAbxs = targetAbxs.sort();

    let hasData = hmOrgs.some(o => hmAbxs.some(a => heatmapStats[o][a] && heatmapStats[o][a].t > 0));

    if (!hasData) {
        $('#heatmapWrapper').html('<div class="flex items-center justify-center h-[100px] w-full text-slate-400 font-bold text-sm">No Data Available</div>');
        return;
    }

    let irCells = 0, lowCells = 0, nuCells = 0, daggerCells = 0;
    let hmHtml = '<table class="heatmap-table"><thead><tr><th>Org (n)</th>';
    hmAbxs.forEach(a => { hmHtml += `<th><div class="w-16 truncate text-[10px]" title="${a}">${a}</div></th>`; });
    hmHtml += '</tr></thead><tbody>';

    hmOrgs.forEach(o => {
        let rowHasData = hmAbxs.some(a => heatmapStats[o][a] && heatmapStats[o][a].t > 0);
        if(!rowHasData) return;

        hmHtml += `<tr><th class="text-[10px] text-left leading-tight">${formatScientificName(o)} <br><span class="text-[9px] font-normal text-slate-400">(${orgCounts[o]||0})</span></th>`;
        hmAbxs.forEach(a => {
            let cell = heatmapStats[o][a];
            if (!cell || cell.t === 0 || (hmHideLow && cell.t < 30)) { hmHtml += '<td class="bg-slate-50 text-slate-300">-</td>'; } 
            else {
                let targetVal = metric === 'R' ? cell.r : (metric === 'NS' ? cell.ns : cell.s);
                let p = Math.round((targetVal / cell.t) * 100);
                let isLow = cell.t < 30;
                let dangerScore = (metric === 'R' || metric === 'NS') ? p : (100 - p);
                let ci = wilsonScoreCI(targetVal, cell.t); // Calculate the confidence interval
                const sel = isSelectivelyTested(cell.t, orgCounts[o] || 0); // tested on fewer than 90% of the organism's isolates
                if (sel) daggerCells++;
                
                let bgClass = 'bg-white', textClass = 'text-slate-700';
                if (dangerScore <= 20) { bgClass = 'bg-emerald-100'; textClass = 'text-emerald-800'; }
                else if (dangerScore <= 40) { bgClass = 'bg-yellow-100'; textClass = 'text-yellow-800'; }
                else if (dangerScore <= 60) { bgClass = 'bg-orange-200'; textClass = 'text-orange-900'; }
                else if (dangerScore <= 80) { bgClass = 'bg-red-400'; textClass = 'text-white font-bold'; }
                else { bgClass = 'bg-red-600'; textClass = 'text-white font-bold'; }

                const intr = isIntrinsicResistance(o, a);
                if (intr) irCells++;
                if (isLow) lowCells++;
                if (cell.nu) nuCells++;
                // grey = not interpretable as a real susceptibility result (fewer than 30 isolates, or intrinsic resistance)
                if (isLow || intr) { bgClass = 'bg-slate-200'; textClass = 'text-slate-500'; }

                hmHtml += `<td class="${bgClass} ${textClass} align-middle">
                    <div class="leading-none">${p}% ${isLow ? '<span class="text-black font-bold">*</span>' : ''}${intr ? '<span class="font-bold">&Dagger;</span>' : ''}${sel ? '<span class="font-bold">&dagger;</span>' : ''}${cell.nu ? '<span class="font-bold text-blue-700" title="' + cell.nu + ' non-urine results">&sect;</span>' : ''}</div>
                    ${cell.nu ? '<div class="text-[7.5px] font-bold text-blue-700 tracking-tighter whitespace-nowrap">urine only: ' + (cell.ua.t ? Math.round(((metric === 'R' ? cell.ua.r : (metric === 'NS' ? cell.ua.ns : cell.ua.s)) / cell.ua.t) * 100) + '% (n=' + cell.ua.t + ')' : 'no data') + '</div>' : ''}
                    <div class="text-[7.5px] font-medium opacity-80 tracking-tighter mt-1 whitespace-nowrap">95% CI (${ci.lower}% - ${ci.upper}%)</div>
                </td>`;
            }
        });
        hmHtml += '</tr>';
    });
    hmHtml += '</tbody></table>';
    $('#heatmapWrapper').html(hmHtml + scopeBanner());
    if (lowCells || irCells) $('#heatmapLegend').append('<span class="px-1 bg-slate-200 text-slate-500 rounded">Grey: ' + (lowCells && irCells ? 'n&lt;30 or &Dagger;' : (lowCells ? 'n&lt;30' : '&Dagger;')) + '</span>');
    setNote('#heatmapNote', [
        (lowCells || irCells) ? '<b>Grey cell:</b> the value is not a reliable susceptibility result.' : '',
        lowCells ? '<b>*</b> = fewer than 30 isolates tested (CLSI M39): ' + lowCells + ' cell' + (lowCells === 1 ? '' : 's') + '.' : '',
        daggerCells ? '<b>&dagger;</b> = selective test: the agent was tested on fewer than 90% of the organism\'s isolates, so the percentage may be biased: ' + daggerCells + ' cell' + (daggerCells === 1 ? '' : 's') + '.' : '',
        irCells ? '<b>&Dagger;</b> = intrinsic resistance (expected for the organism, CLSI M100 Appendix B), not acquired resistance: ' + irCells + ' cell' + (irCells === 1 ? '' : 's') + '.' : '',
        '<b>Colour bands</b> in steps of 20% are a visual aid only. They are not CLSI or WHO categories, and WHO does not provide a reference for these colours.',
        'The colours are not a treatment guide or an indicator for therapy; follow the hospital antibiotic policy.',
        'Cells are in vitro results.',
        nuCells ? '<b>&sect;</b> = urine-only agent (CLSI M100-Ed36: ' + URINE_ONLY_ABX.join(', ') + '; amikacin for <i>P. aeruginosa</i>) that also includes non-urine specimens (' + nuCells + ' cell' + (nuCells === 1 ? '' : 's') + ').' : '',
        nuCells ? 'Those results are included; interpret with clinical judgement.' : ''
    ].concat(hmPeriodNote(records)));
};
// --- Modal: About App ---
function showAboutModal() {
    Swal.fire({
        html: '<div class="gd-about-wrap">' + (window.aboutHtml ? window.aboutHtml() : '') + '</div>',
        showConfirmButton: true, confirmButtonText: 'Close', confirmButtonColor: '#0d9488', width: 'min(92vw, 420px)'
    });
}
// --- Modal: Install Guide ---
function showInstallGuide() {
    Swal.fire({
        title: '📲 Install the App',
        html: `
            <div class="text-sm text-slate-600 leading-relaxed space-y-5 text-left mt-3">
                <p class="font-medium text-slate-700">For the best experience and fastest access, install the dashboard as an app on your phone:</p>
                
                <div class="bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <h4 class="font-bold text-blue-800 mb-2 flex items-center gap-2"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg> iPhone devices (iOS)</h4>
                    <ol class="list-decimal list-inside space-y-1 text-xs">
                        <li>Open this link in <b>Safari</b> only.</li>
                        <li>Tap the Share button <span class="inline-block border border-slate-300 rounded px-1 bg-white">⍗</span> at the bottom of the screen.</li>
                        <li>Choose <b>"Add to Home Screen"</b>.</li>
                    </ol>
                </div>

                <div class="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                    <h4 class="font-bold text-emerald-800 mb-2 flex items-center gap-2"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg> Android devices</h4>
                    <ol class="list-decimal list-inside space-y-1 text-xs">
                        <li>Open this link in <b>Chrome</b>.</li>
                        <li>Tap the menu <span class="inline-block border border-slate-300 rounded px-1 bg-white">⋮</span> at the top of the screen.</li>
                        <li>Choose <b>"Install app"</b> or <b>"Add to Home screen"</b>.</li>
                    </ol>
                </div>
            </div>
        `,
        showConfirmButton: true,
        confirmButtonText: 'Got it',
        confirmButtonColor: '#0d9488',
        width: '90%'
    });
}

