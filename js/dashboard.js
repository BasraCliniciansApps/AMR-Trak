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
function applyWardFilter(records, filterValue) {
    if (filterValue === 'inpatient') {
        return records.filter(r => {
            let w = (r.Ward || "").toLowerCase().trim();
            return w !== 'outpatient' && w !== 'out-patient' && w !== 'opd'; 
        });
    } else if (filterValue === 'outpatient') {
        return records.filter(r => {
            let w = (r.Ward || "").toLowerCase().trim();
            return w === 'outpatient' || w === 'out-patient' || w === 'opd';
        });
    }
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
function filterByPeriod(records, periodType) {
    if (!periodType || periodType === 'all') return records;

    let validRecords = records.filter(r => r.Date);
    if (validRecords.length === 0) return records;

    if (periodType === 'year') {
        let lastYear = (new Date().getFullYear() - 1).toString();
        return validRecords.filter(r => r.Date.startsWith(lastYear));
    }

    // Identify the latest month in the dataset to calculate Month/Quarter
    let allDates = validRecords.map(r => r.Date).sort();
    let latestDateStr = allDates[allDates.length - 1]; 
    let targetMonthPrefix = latestDateStr.substring(0, 7);

    if (periodType === 'month') {
        return validRecords.filter(r => r.Date.startsWith(targetMonthPrefix));
    }

    if (periodType === 'quarter') {
        let [lYear, lMonth] = targetMonthPrefix.split('-').map(Number);
        let qYear = lYear, qMonths = [];

        // Jump to next quarter only when its 3rd month is reached
        if (lMonth < 3) { qYear -= 1; qMonths = ["10","11","12"]; }
        else if (lMonth < 6) { qMonths = ["01","02","03"]; }
        else if (lMonth < 9) { qMonths = ["04","05","06"]; }
        else if (lMonth < 12) { qMonths = ["07","08","09"]; }
        else { qMonths = ["10","11","12"]; }

        return validRecords.filter(r => {
            let parts = r.Date.split('-');
            return parseInt(parts[0]) === qYear && qMonths.includes(parts[1]);
        });
    }

    return records;
}

// Visual updates for period toggles
$(document).on('change', 'input[name="guided_period"]', function() { loadAnalyticsFilters(); });
$(document).on('change', 'input[name="patho_period"]', function() { updatePathoDropdowns(); });
$(document).on('change', 'input[name="abx_period"]', function() { updateAbxDropdowns(); });


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
    CLSI_M100: { t: 'Clinical and Laboratory Standards Institute (CLSI). M100: Performance Standards for Antimicrobial Susceptibility Testing (current edition).', u: 'https://clsi.org/standards/products/microbiology/documents/m100/' },
    CLSI_M39: { t: 'CLSI. M39: Analysis and Presentation of Cumulative Antimicrobial Susceptibility Test Data (5th ed., 2022).', u: 'https://clsi.org/standards/products/microbiology/documents/m39/' },
    CLSI_M47: { t: 'CLSI. M47: Principles and Procedures for Blood Cultures (current edition).', u: 'https://clsi.org/standards/products/microbiology/documents/m47/' },
    ASM_BCC: { t: 'American Society for Microbiology. Evidence-based laboratory medicine practice guidelines to reduce blood culture contamination rates: a systematic review and meta-analysis.', u: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11629619/' },
    WHO_GLASS: { t: 'World Health Organization. GLASS manual for antimicrobial resistance surveillance in common bacteria causing human infection. Geneva: WHO; 2023.', u: 'https://www.who.int/publications/i/item/9789240076600' },
    WHO_AWARE: { t: 'World Health Organization. AWaRe classification of antibiotics for evaluation and monitoring of use, 2023.', u: 'https://www.who.int/publications/i/item/WHO-MHP-HPS-EML-2023.04' },
    WHO_BPPL: { t: 'World Health Organization. WHO Bacterial Priority Pathogens List, 2024.', u: 'https://www.who.int/publications/i/item/9789240093461' },
    WHONET: { t: 'WHONET software. WHO Collaborating Centre for Surveillance of Antimicrobial Resistance.', u: 'https://whonet.org/' }
};
// Which sources support which (i) popup
function refsFor(key) {
    const k = String(key || '');
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
function setInfo(key, title, html, refs) { INFO_STORE[key] = { title: title, html: html, refs: refs || refsFor(key) }; }
window.showInfo = function(key) {
    const i = INFO_STORE[key];
    if (!i) return;
    Swal.fire({
        title: i.title,
        html: '<div class="info-body">' + i.html + '</div>' + refsHtml(i.refs, true),
        showConfirmButton: true, confirmButtonText: 'Close', width: 'min(92vw, 440px)',
        customClass: { popup: 'info-popup', title: 'info-title', htmlContainer: 'info-container', confirmButton: 'info-close' },
        buttonsStyling: false
    });
};
// Information now lives in the section toolbar (see dashboard_panels.js); per-chart buttons are no longer drawn.
function attachInfo() {}
function mdrInfoHtml(px, pp) {
    return `<p>Resistance categories follow <b>Magiorakos et al., Clin Microbiol Infect 2012;18:268-281</b>, an international proposal by ECDC and CDC. Susceptibility results (S / I / R) are interpreted with <b>CLSI M100</b> breakpoints.</p>
    <ul style="margin:6px 0 0 16px;list-style:disc">
    <li><b>MDR (multidrug-resistant):</b> non-susceptible to at least one agent in three or more antimicrobial categories.</li>
    <li><b>XDR (extensively drug-resistant):</b> non-susceptible to at least one agent in all but two or fewer categories.</li>
    <li><b>PDR (pandrug-resistant):</b> non-susceptible to all agents in all categories.</li></ul>
    <p style="margin-top:8px"><b>Method:</b> applied to first isolates (CLSI M39: one per patient, organism and year) of Enterobacterales, <i>P. aeruginosa</i>, <i>Acinetobacter</i> spp. and <i>S. aureus</i>. Intrinsic resistance is not counted. A category that was not tested is treated as unknown, not as resistant. Each isolate is assigned to its highest class.</p>
    <p style="margin-top:8px"><b>Possible XDR / PDR:</b> isolates tested against too few categories to confirm the class are not counted in the charts. This period has <b>${px}</b> possible XDR and <b>${pp}</b> possible PDR isolate(s).</p>`;
}
const AWARE_NAMES = { A: 'Access', W: 'Watch', R: 'Reserve' };

// Antibiotic chart details: how to read the chart, selective testing, AWaRe, contaminants
function renderChartNotes(containerSel, selectiveNotes, contaminantCount, shownAbx) {
    const key = 'abx_' + containerSel.replace('#', '');
    let html = '<p><b>*</b> fewer than 30 isolates tested: interpret with caution (grey bars).</p>';
    if (selectiveNotes.length) html += `<p style="margin-top:8px"><b>†</b> Selectively tested (tested / isolates): ${selectiveNotes.join(', ')}.<br>Only part of the isolates were tested, so the resistance rate may be overestimated.</p>`;
    const groups = { A: [], W: [], R: [] };
    (shownAbx || []).forEach(a => { if (AWARE_CLASS[a]) groups[AWARE_CLASS[a]].push(a); });
    if (groups.A.length || groups.W.length || groups.R.length) {
        html += '<p style="margin-top:8px"><b>WHO AWaRe</b></p><ul style="margin-left:16px;list-style:disc">';
        ['A', 'W', 'R'].forEach(k => { if (groups[k].length) html += `<li><b>${AWARE_NAMES[k]}:</b> ${groups[k].join(', ')}</li>`; });
        html += '</ul>';
    }
    if (contaminantCount > 0) html += `<p style="margin-top:8px"><b>${contaminantCount}</b> blood isolate(s) of this organism are possible skin-flora contaminants. Review clinically.</p>`;
    setInfo(key, 'About this chart', html);
    attachInfo($(containerSel).parent().parent(), key);
}

function setDashStatus(kind, text) {
    const el = document.getElementById('dashStatus');
    if (!el) return;
    el.textContent = text;
    el.className = 'text-[10px] font-bold rounded-lg px-3 py-1.5 mb-3 border ' + (kind === 'ok' ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : kind === 'warn' ? 'text-amber-800 bg-amber-50 border-amber-200' : 'text-red-700 bg-red-50 border-red-200');
}

function fetchCloudData() {
    if (!db) {
        refreshAll();
        return;
    }
    
    Swal.fire({ title: 'Connecting to Cloud...', text: 'Establishing live connection...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    
    // The dashboard reads ONLY the pseudonymised public copy (no names, hashed patient ids).
    // The private document (amr_sync) requires sign-in and is used by the data-entry app.
    db.collection("amr_public").onSnapshot((snap) => {
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
                    Swal.close();
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
            Swal.close();
            let when = '';
            try { when = data.last_updated && data.last_updated.toDate ? data.last_updated.toDate().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : ''; } catch (e) {}
            setDashStatus(cloudRecords.length ? 'ok' : 'warn', `${cloudRecords.length} isolates${when ? ' - published ' + when : ''}`);
        } else {
            Swal.close();
            setDashStatus('warn', 'No published data found in the cloud.');
            Swal.fire({ icon: 'info', title: 'No data yet', text: 'The public dashboard data has not been published. Open the data-entry app and sign in once to publish it.' });
        }
    }, (error) => {
        console.error("Firebase Error:", error);
        Swal.close();
        setDashStatus('err', `Could not read the cloud (${error && error.code ? error.code : 'error'}). Showing the last saved data on this phone.`);
        Swal.fire({ icon: 'warning', title: 'Offline Mode', text: 'Could not connect to cloud.', timer: 2000, showConfirmButton: false });
        refreshAll();
    });
}
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
        liveCharts.forEach(c => c.destroy());
        liveCharts = [];
        return;
    }

    // Apply strict manual overrides mapped from Mobile Dash Settings
    let targetMonthPrefix = settings.mobile_dash_month || new Date().toISOString().slice(0, 7);
    let qLabel = settings.mobile_dash_quarter || "Q1";
    let qYear = parseInt(settings.mobile_dash_year) || new Date().getFullYear();
    let qMonths = [];

    if (qLabel === "Q1") qMonths = ["01","02","03"];
    else if (qLabel === "Q2") qMonths = ["04","05","06"];
    else if (qLabel === "Q3") qMonths = ["07","08","09"];
    else if (qLabel === "Q4") qMonths = ["10","11","12"];

    let monthRecords = cleanRecords.filter(r => r.Date && r.Date.startsWith(targetMonthPrefix));
    let quarterRecords = cleanRecords.filter(r => {
        if(!r.Date) return false;
        let parts = r.Date.split('-');
        return parseInt(parts[0]) === qYear && qMonths.includes(parts[1]);
    });

    $('#live_month_title').text(`Surveillance Overview (${targetMonthPrefix})`);
    $('#live_q_title').text(`Surveillance Overview (${qLabel} ${qYear})`);

    liveCharts.forEach(c => c.destroy());
    liveCharts = [];

    buildMobileLiveSection(monthRecords, 'm', settings, targetMonthPrefix);
    buildMobileLiveSection(quarterRecords, 'q', settings, `${qLabel} ${qYear}`);
}

function buildMobileLiveSection(records, prefix, settings, timeLabel) {
    $(`#live_${prefix}_total`).text(records.length);
    if(records.length === 0) {
        $(`#live_${prefix}_bug`).text("-");
        $(`#live_${prefix}_spec`).text("-");
        $(`#live_${prefix}_top3_container, #live_${prefix}_profiles_wrapper, #live_${prefix}_watchlist_container`).addClass('hidden');
        
        $(`#live_${prefix}_amr_title`).text(`Critical Resistance Markers (${timeLabel})`);
        $(`#live_${prefix}_blood_subtitle`).text(timeLabel);
        $(`#live_${prefix}_urine_subtitle`).text(timeLabel);
        $(`#live_${prefix}_bar_title`).text(`Top 5 Specimens (${timeLabel})`);
        return;
    }

    $(`#live_${prefix}_profiles_wrapper`).removeClass('hidden');

    $(`#live_${prefix}_amr_title`).text(`Critical Resistance Markers (${timeLabel})`);
    const markerHtml = '<ul style="margin-left:16px;list-style:disc">' + CRITICAL_MARKERS.map(m => `<li style="margin-bottom:4px"><b>${m.label}</b>: ${m.info || ''}</li>`).join('') + '</ul><p style="margin-top:8px">Counted on first isolates only. Grey bars: fewer than 30 isolates tested.</p>';
    setInfo('markers_' + prefix, 'Critical resistance markers', markerHtml);
    attachInfo(`#live_${prefix}_amr_wrapper`, 'markers_' + prefix);
    $(`#live_${prefix}_blood_subtitle`).text(timeLabel);
    $(`#live_${prefix}_urine_subtitle`).text(timeLabel);
    $(`#live_${prefix}_bar_title`).text(`Top 5 Specimens (${timeLabel})`);

    // --- CLSI M39 DEDUPLICATION (First isolate per patient per organism per year) ---
    records = applyDeduplication(records);
    const surveillanceRecords = records;
    $(`#live_${prefix}_total`).text(records.length);

    // Overview details (i): method + possible contaminants (flagged, not removed)
    const contamN = records.filter(isPossibleContaminant).length;
    let overviewHtml = `<p><b>${records.length}</b> first isolates (one per patient, per organism, per year - CLSI M39). Screening cultures are excluded.</p>`;
    if (contamN > 0) overviewHtml += `<p style="margin-top:8px"><b>${contamN}</b> blood isolate(s) are possible skin-flora contaminants (CoNS, Corynebacterium, Micrococcus, viridans streptococci...). They are counted, not removed: review clinically.</p>`;
    setInfo('overview_' + prefix, 'Surveillance overview', overviewHtml);
    attachInfo($(`#live_${prefix}_total`).closest('.grid').prev(), 'overview_' + prefix);

    let orgCounts = {}, specCounts = {};

    // --- CRITICAL MARKERS (WHO GLASS / WHO priority pathogens / CLSI M100): defined once in data.js ---
    let amrStats = evaluateCriticalMarkers(surveillanceRecords);

    // Prevalence is tallied on first isolates only
    records.forEach(r => {
        let org = r['Selective organism'] || "", spec = r['Sample'];
        orgCounts[org] = (orgCounts[org] || 0) + 1;
        if (spec && spec !== "-") specCounts[spec] = (specCounts[spec] || 0) + 1;
    });

    $(`#live_${prefix}_bug`).text(formatOrgName(Object.keys(orgCounts).sort((a, b) => orgCounts[b] - orgCounts[a])[0]) || "-");
    $(`#live_${prefix}_spec`).text(Object.keys(specCounts).sort((a, b) => specCounts[b] - specCounts[a])[0] || "-");

    let labels = [], data = [], bgColors = [], ciData = [], nDataArr = [];
    amrStats.forEach((stat, index) => {
        let markerLabel = stat.label.split('\n');
        if (stat.candidates) markerLabel.push(stat.candidates + ' unconfirmed');
        labels.push(markerLabel);
        let palette = extendedPalette[index % extendedPalette.length]; 
        
        if (stat.tested === 0) { 
            data.push(0); 
            bgColors.push(palette.faded); 
            ciData.push({ lower: 0, upper: 0 }); 
            nDataArr.push(0);
        } else {
            data.push(Math.round((stat.resistant / stat.tested) * 100));
            // Gray out bar if sample size is below CLSI statistical threshold (n < 30)
            bgColors.push(stat.tested >= 30 ? palette.bg : '#94a3b8'); 
            ciData.push(wilsonScoreCI(stat.resistant, stat.tested));
            nDataArr.push(stat.tested);
        }
    });
if (settings.show_amr === false) {
        $(`#live_${prefix}_amr_wrapper`).addClass('hidden');
    } else {
        $(`#live_${prefix}_amr_wrapper`).removeClass('hidden');
    }
    liveCharts.push(new Chart(document.getElementById(`chart_${prefix}_amr`), {
        type: 'bar',
        data: { 
            labels, 
            datasets: [{ 
                label: 'Pathogen', 
                data, 
                backgroundColor: bgColors, 
                ciData, 
                nData: nDataArr, 
                borderRadius: 4, 
                maxBarThickness: 30 
            }] 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { display: false } }, 
            scales: { y: { max: 100, beginAtZero: true }, x: { afterFit: function(scale) { scale.height = 92; }, ticks: { maxRotation: 90, minRotation: 90, autoSkip: false, color: 'rgba(0,0,0,0)', font: { size: 10, weight: 'bold' }, callback: function(v) { return wrapAbxLabel(this.getLabelForValue(v)); } } } } 
        },
        plugins: [errorBarsPlugin, centredAbxLabels]
    }));
    
    let bloodRecords = records.filter(r => r.Sample && r.Sample.toLowerCase() === 'blood');
    let urineRecords = records.filter(r => r.Sample && r.Sample.toLowerCase() === 'urine');
    
    let bloodCounts = {};
    bloodRecords.forEach(r => { let o = r['Selective organism']; if(o) bloodCounts[o] = (bloodCounts[o] || 0) + 1; });
    let urineCounts = {};
    urineRecords.forEach(r => { let o = r['Selective organism']; if(o) urineCounts[o] = (urineCounts[o] || 0) + 1; });
    
    let sortedBlood = Object.keys(bloodCounts).sort((a,b)=>bloodCounts[b]-bloodCounts[a]).slice(0, 5);
    let sortedUrine = Object.keys(urineCounts).sort((a,b)=>urineCounts[b]-urineCounts[a]).slice(0, 5);
    
    let bloodData = sortedBlood.length ? sortedBlood.map(o=>bloodCounts[o]) : [1];
    let bloodLabels = sortedBlood.length ? sortedBlood.map(o => formatOrgName(o)) : ['No Blood Samples'];
    let bloodColors = sortedBlood.length ? ['#ef4444','#dc2626','#f87171','#fca5a5','#fef2f2'] : ['#e2e8f0'];

    liveCharts.push(new Chart(document.getElementById(`chart_${prefix}_blood`), {
        type: 'doughnut', 
        data: { labels: bloodLabels, datasets: [{ data: bloodData, backgroundColor: bloodColors }] },
        options: { 
            responsive: true, maintainAspectRatio: false, 
            plugins: { 
                legend: { display: false },
                tooltip: { enabled: sortedBlood.length > 0 }
            } 
        }
    }));
    
    let urineData = sortedUrine.length ? sortedUrine.map(o=>urineCounts[o]) : [1];
    let urineLabels = sortedUrine.length ? sortedUrine.map(o => formatOrgName(o)) : ['No Urine Samples'];
    let urineColors = sortedUrine.length ? ['#eab308','#ca8a04','#fde047','#fef08a','#fefce8'] : ['#e2e8f0'];

    liveCharts.push(new Chart(document.getElementById(`chart_${prefix}_urine`), {
        type: 'doughnut', 
        data: { labels: urineLabels, datasets: [{ data: urineData, backgroundColor: urineColors }] },
        options: { 
            responsive: true, maintainAspectRatio: false, 
            plugins: { 
                legend: { display: false },
                tooltip: { enabled: sortedUrine.length > 0 }
            } 
        }
    }));

    let sortedSpecs = Object.keys(specCounts).sort((a,b)=>specCounts[b]-specCounts[a]);
    let top5Specs = sortedSpecs.slice(0, 5);

    liveCharts.push(new Chart(document.getElementById(`chart_${prefix}_bar`), {
        type: 'bar', 
        data: { 
            labels: top5Specs, 
            datasets: [{ 
                data: top5Specs.map(s => specCounts[s]), 
                backgroundColor: '#2cb4a4', 
                borderRadius: 4 
            }] 
        },
        options: { 
            indexAxis: 'y', 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { display: false } }, 
            scales: { 
                x: { 
                    ticks: { stepSize: 1, maxRotation: 45, minRotation: 45 } 
                },
                y: { grid: { display: false } }
            } 
        }
    }));

    let top3Specs = sortedSpecs.slice(0, 3);
    let htmlTop3 = `<h4 class="text-xs font-bold text-slate-700 mt-2 mb-2 border-b pb-1">Top 3 Specimens Breakdown (${timeLabel})</h4>`;
    
    top3Specs.forEach(spec => {
        let specRecords = records.filter(r => r.Sample === spec);
        let bCounts = {};
        specRecords.forEach(r => { let o = r['Selective organism']; if(o) bCounts[o] = (bCounts[o]||0)+1; });
        let topBugSpec = formatOrgName(Object.keys(bCounts).sort((a,b)=>bCounts[b]-bCounts[a])[0]) || "-";

        let abxS = {}, abxT = {};
        specRecords.forEach(r => {
            if(typeof abxList !== 'undefined') {
                abxList.forEach(a => {
                    if(r[a] && r[a] !== '-') {
                        abxT[a] = (abxT[a]||0)+1;
                        if(r[a] === 'S') abxS[a] = (abxS[a]||0)+1;
                    }
                });
            }
        });
        
        let bestAbx = "-", bestP = -1;
        Object.keys(abxT).forEach(a => { if(abxT[a] >= 5) { let p = (abxS[a]||0)/abxT[a]; if(p > bestP) { bestP=p; bestAbx=a; } } });
        if(bestP === -1) { Object.keys(abxT).forEach(a => { let p = (abxS[a]||0)/abxT[a]; if(p > bestP) { bestP=p; bestAbx=a; } }); }

        let fmtAbx = "N/A";
        if (bestAbx !== "-") {
            let ci = wilsonScoreCI(abxS[bestAbx]||0, abxT[bestAbx]);
            fmtAbx = `<span class="block">${bestAbx} <span class="text-emerald-600 font-bold">(${Math.round(bestP*100)}% S)</span></span><span class="text-[9px] text-slate-400 bg-slate-100 px-1 rounded block mt-0.5">CI: ${ci.lower}%-${ci.upper}%</span>`;
        }

        htmlTop3 += `
        <div class="bg-slate-50 border border-slate-100 p-2 rounded flex flex-col gap-1 text-[10px]">
            <div class="font-bold text-blue-800 bg-blue-100 px-1.5 rounded self-start">${spec}</div>
            <div class="text-slate-600">Top Bug: <span class="font-bold text-rose-600">${topBugSpec}</span></div>
            <div class="text-slate-600 mt-1 pt-1 border-t border-slate-200">Most Susceptible:<br>${fmtAbx}</div>
        </div>`;
    });
    if (settings.show_top3 !== false && top3Specs.length > 0) {
        $(`#live_${prefix}_top3_container`).html(htmlTop3).removeClass('hidden');
    } else {
        $(`#live_${prefix}_top3_container`).addClass('hidden');
    }

    let p1 = settings.profile1_abx || 'Meropenem';
    let p2 = settings.profile2_abx || 'Ceftriaxone';
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
    $(`#live_${prefix}_profile1_title`).text(`${p1} Resistance (% R)`);
    $(`#live_${prefix}_profile2_title`).text(`${p2} Resistance (% R)`);

    buildMobileAbxProfileChart(p1, `chart_${prefix}_mero`, `live_${prefix}_mero_count`, records, prefix === 'm' ? '#2563eb' : '#059669');
    buildMobileAbxProfileChart(p2, `chart_${prefix}_cro`, `live_${prefix}_cro_count`, records, '#0d9488');
    // 🚨 Global Threat Watchlist Logic (Graphical & Detailed Edition)
    let watchBug = settings.watchlist_bug;
    if (watchBug && watchBug !== "") {
        let normalizedWatchBug = watchBug.split('(')[0].trim().toLowerCase();
        let watchRecords = records.filter(r => {
            let org = (r['Selective organism'] || "").split('(')[0].trim().toLowerCase();
            return org === normalizedWatchBug;
        });
        
        let wWard = {}, wSpec = {}, wAbxT = {}, wAbxR = {};
        let allPossibleAbxs = [...(typeof abxList !== 'undefined' ? abxList : []), ...getCustomAntibiotics().map(a => a.name)];

        watchRecords.forEach(r => {
            if(r.Ward && r.Ward !== "-") wWard[r.Ward] = (wWard[r.Ward] || 0) + 1;
            if(r.Sample && r.Sample !== "-") wSpec[r.Sample] = (wSpec[r.Sample] || 0) + 1;
            
            allPossibleAbxs.forEach(a => {
                if(r[a] && r[a] !== '-' && r[a] !== '') {
                    wAbxT[a] = (wAbxT[a] || 0) + 1;
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
                abxLabels.push(t >= 30 ? a : `${a} *`);
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
                        tooltip: {
                            callbacks: {
                                label: function(ctx) {
                                    let idx = ctx.dataIndex;
                                    return `Resistance: ${ctx.raw}% (Tested n=${abxN[idx]})`;
                                }
                            }
                        }
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
            plugins: { legend: { display: false } },
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
    if (isUpdatingFilters) return;
    isUpdatingFilters = true;

    let period = $('input[name="guided_period"]:checked').val() || 'all';
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

    let period = $('input[name="guided_period"]:checked').val() || 'all';
    let allRecords = getDashRecords();
    let records = filterByPeriod(allRecords, period);

    if (targetSample !== "all") { 
        records = records.filter(r => r.Sample === targetSample); 
    }
    
    records = applyWardFilter(records, $('input[name="guided_ward"]:checked').val() || 'total');
    
    // تطبيق دالة منع التكرار (Deduplication)
    records = applyDeduplication(records);
        
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
    let period = $('input[name="guided_period"]:checked').val() || 'all';

    let allRecords = getDashRecords();
    let records = filterByPeriod(allRecords, period);
    records = records.filter(r => r['Selective organism'] === currentGuidedBug);
    
    if (targetSample && targetSample !== "all") {
        records = records.filter(r => r.Sample === targetSample);
    }
    
    records = applyWardFilter(records, $('input[name="guided_ward"]:checked').val() || 'total');
    
    // تطبيق دالة منع التكرار (Deduplication)
    records = applyDeduplication(records);
    
    let allPossibleAbxs = [...abxList, ...getCustomAntibiotics().map(a=>a.name)];
    let abxStats = {};

    records.forEach(r => {
        allPossibleAbxs.forEach(abx => {
            let res = r[abx];
            if (res && res !== '-' && res !== '') {
                if (!abxStats[abx]) abxStats[abx] = { tested: 0, r: 0, s: 0, ns: 0 }; // إضافة ns
                abxStats[abx].tested += 1;
                if (res === 'R') abxStats[abx].r += 1;
                if (res === 'S') abxStats[abx].s += 1;
                if (res === 'R' || res === 'I' || res === 'SDD') abxStats[abx].ns += 1; // حساب الـ Non-Susceptible
            }
        });
    });

    let testedAbxs = Object.keys(abxStats).sort();
    let selectiveNotes = [];
    let labels = [], data = [], bgColors = [], ciData = [], nDataArr = [];
    let baseColor = currentGuidedMetric === 'S' ? 'rgba(16, 185, 129, 0.9)' : 'rgba(225, 29, 72, 0.9)'; 
    let hideLowN = $('#guided_hide_low').is(':checked');

    testedAbxs.forEach(abx => {
        let s = abxStats[abx];
        let isReliable = s.tested >= 30;

        if (hideLowN && !isReliable) return;

        let targetVal = currentGuidedMetric === 'R' ? s.r : (currentGuidedMetric === 'NS' ? s.ns : s.s);
        let p = Math.round((targetVal / s.tested) * 100);

        const selective = isSelectivelyTested(s.tested, records.length);
        if (selective) selectiveNotes.push(`${abx} (${s.tested}/${records.length})`);
        labels.push(abx + (selective ? ' †' : '') + (isReliable ? '' : ' *'));
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

    renderChartNotes('#guidedAmrContainer', selectiveNotes, records.filter(isPossibleContaminant).length, testedAbxs);
    let chartWidth = labels.length > 5 ? (labels.length * 45) + 'px' : '100%';
    $('#guidedAmrContainer').css('width', chartWidth);

    chartGuidedAMR_instance = new Chart(document.getElementById('chartGuidedAMR'), {
        type: 'bar',
        data: { labels, datasets: [{ data, backgroundColor: bgColors, ciData, nData: nDataArr, borderRadius: 4 }] },
        options: { 
            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, 
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
    let period = $('input[name="patho_period"]:checked').val() || 'all';

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

function renderPathoChart() {
    const bug = $('#patho_bug').val();
    if(!bug) {
        if (chartPathoAMR_instance) chartPathoAMR_instance.destroy();
        $('#pathoAmrContainer').html('<canvas id="chartPathoAMR"></canvas>');
        return;
    }

    let period = $('input[name="patho_period"]:checked').val() || 'all';
    let records = getDashRecords();
    records = filterByPeriod(records, period);
    records = records.filter(r => r['Selective organism'] === bug);
    records = applyWardFilter(records, $('input[name="patho_ward"]:checked').val() || 'total');

    // تطبيق دالة منع التكرار (Deduplication)
    records = applyDeduplication(records);

    let allPossibleAbxs = [...abxList, ...getCustomAntibiotics().map(a=>a.name)];
    let abxStats = {};

    records.forEach(r => {
        allPossibleAbxs.forEach(abx => {
            let res = r[abx];
            if (res && res !== '-' && res !== '') {
                if (!abxStats[abx]) abxStats[abx] = { tested: 0, r: 0, s: 0, ns: 0 };
                abxStats[abx].tested += 1;
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
    let baseColor = currentPathoMetric === 'S' ? 'rgba(16, 185, 129, 0.9)' : 'rgba(225, 29, 72, 0.9)'; 
    let hideLowN = $('#patho_hide_low').is(':checked');

    testedAbxs.forEach(abx => {
        let s = abxStats[abx];
        let isReliable = s.tested >= 30;

        if (hideLowN && !isReliable) return;

        let targetVal = currentPathoMetric === 'R' ? s.r : s.s;
        let p = Math.round((targetVal / s.tested) * 100);

        const selective = isSelectivelyTested(s.tested, records.length);
        if (selective) selectiveNotes.push(`${abx} (${s.tested}/${records.length})`);
        labels.push(abx + (selective ? ' †' : '') + (isReliable ? '' : ' *'));
        data.push(p);
        bgColors.push(isReliable ? baseColor : 'rgba(148, 163, 184, 0.5)'); 
        ciData.push(wilsonScoreCI(targetVal, s.tested));
        nDataArr.push(s.tested);
    });

    renderChartNotes('#pathoAmrContainer', selectiveNotes, records.filter(isPossibleContaminant).length, testedAbxs);
    let chartWidth = labels.length > 5 ? (labels.length * 45) + 'px' : '100%';
    $('#pathoAmrContainer').css('width', chartWidth);

    chartPathoAMR_instance = new Chart(document.getElementById('chartPathoAMR'), {
        type: 'bar',
        data: { labels, datasets: [{ data, backgroundColor: bgColors, ciData, nData: nDataArr, borderRadius: 4 }] },
        options: { 
            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, 
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
    let period = $('input[name="abx_period"]:checked').val() || 'all';

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

    let period = $('input[name="abx_period"]:checked').val() || 'all';
    let records = getDashRecords();
    records = filterByPeriod(records, period);
    records = applyWardFilter(records, $('input[name="abx_ward"]:checked').val() || 'total');

    // تطبيق دالة منع التكرار (Deduplication)
    records = applyDeduplication(records);

    let orgStats = {};
    records.forEach(r => {
        let org = r['Selective organism'];
        let res = r[drug];
        if (org && res && res !== '-' && res !== '') {
            if (!orgStats[org]) orgStats[org] = { tested: 0, r: 0, s: 0, ns: 0 };
            orgStats[org].tested += 1;
            if (res === 'R') orgStats[org].r += 1;
            if (res === 'S') orgStats[org].s += 1;
            if (res === 'R' || res === 'I' || res === 'SDD') orgStats[org].ns += 1;
        }
    });

    let testedOrgs = Object.keys(orgStats).sort();
    
    if (chartAbxAMR_instance) chartAbxAMR_instance.destroy();

    if (testedOrgs.length === 0) {
        $('#abxAmrContainer').html('<div class="flex items-center justify-center h-[200px] w-full text-slate-400 font-bold text-sm">No Data Available</div>');
        return;
    }
    
    $('#abxAmrContainer').html('<canvas id="chartAbxAMR"></canvas>');

    let labels = [], data = [], bgColors = [], ciData = [], nDataArr = [];
    let baseColor = currentAbxMetric === 'S' ? 'rgba(16, 185, 129, 0.9)' : 'rgba(225, 29, 72, 0.9)'; 
    let hideLowN = $('#abx_hide_low').is(':checked');

    testedOrgs.forEach(org => {
        let s = orgStats[org];
        let isReliable = s.tested >= 30;

        if (hideLowN && !isReliable) return;

        let targetVal = currentAbxMetric === 'R' ? s.r : (currentAbxMetric === 'NS' ? s.ns : s.s);
        let p = Math.round((targetVal / s.tested) * 100);

        let formattedOrg = formatScientificName(org);
        labels.push(isReliable ? formattedOrg : `${formattedOrg} *`);
        data.push(p);
        bgColors.push(isReliable ? baseColor : 'rgba(148, 163, 184, 0.5)'); 
        ciData.push(wilsonScoreCI(targetVal, s.tested));
        nDataArr.push(s.tested);
    });

    let chartWidth = labels.length > 5 ? (labels.length * 45) + 'px' : '100%';
    $('#abxAmrContainer').css('width', chartWidth);

    chartAbxAMR_instance = new Chart(document.getElementById('chartAbxAMR'), {
        type: 'bar',
        data: { labels, datasets: [{ data, backgroundColor: bgColors, ciData, nData: nDataArr, borderRadius: 4 }] },
        options: { 
            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, 
            scales: { y: { max: 100, beginAtZero: true }, x: vAxisX(112) } 
        },
        plugins: [errorBarsPlugin, centredAbxLabels]
    });
}
window.generateAdvancedAnalytics = function() {
    const startDate = $('#adv_start').val();
    const endDate = $('#adv_end').val();
    const targetSample = $('#adv_sample').val();
    let targetOrgs = $('#adv_organism').val() || [];
    let targetAbxs = $('#adv_antibiotic').val() || [];
    const metric = $('#adv_metric').val() || 'R'; 

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

    // Filter ONLY if the user selected a sample
    if (targetSample) { 
        records = records.filter(r => r.Sample === targetSample); 
    }

    // Apply Ward Filter (All / Inpatient / Outpatient)
    records = applyWardFilter(records, $('input[name="adv_ward"]:checked').val() || 'total');

    // تطبيق دالة منع التكرار (Deduplication)
    records = applyDeduplication(records);

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
                   if (!heatmapStats[org][abx]) heatmapStats[org][abx] = { t: 0, r: 0, s: 0, ns: 0 };
                    heatmapStats[org][abx].t += 1;
                    if (res === 'R') heatmapStats[org][abx].r += 1;
                    if (res === 'S') heatmapStats[org][abx].s += 1;
                    if (res === 'R' || res === 'I' || res === 'SDD') heatmapStats[org][abx].ns += 1;
                }
            });
        }
    });

    let hmOrgs = Object.keys(heatmapStats).sort();
    let hmAbxs = targetAbxs.sort();

    let hasData = hmOrgs.some(o => hmAbxs.some(a => heatmapStats[o][a] && heatmapStats[o][a].t > 0));

    if (!hasData) {
        $('#heatmapWrapper').html('<div class="flex items-center justify-center h-[100px] w-full text-slate-400 font-bold text-sm">No Data Available</div>');
        return;
    }

    let hmHtml = '<table class="heatmap-table"><thead><tr><th>Org (n)</th>';
    hmAbxs.forEach(a => { hmHtml += `<th><div class="w-16 truncate text-[10px]" title="${a}">${a}</div></th>`; });
    hmHtml += '</tr></thead><tbody>';

    hmOrgs.forEach(o => {
        let rowHasData = hmAbxs.some(a => heatmapStats[o][a] && heatmapStats[o][a].t > 0);
        if(!rowHasData) return;

        hmHtml += `<tr><th class="text-[10px] text-left leading-tight">${formatScientificName(o)} <br><span class="text-[9px] font-normal text-slate-400">(${orgCounts[o]||0})</span></th>`;
        hmAbxs.forEach(a => {
            let cell = heatmapStats[o][a];
            if (!cell || cell.t === 0) { hmHtml += '<td class="bg-slate-50 text-slate-300">-</td>'; } 
            else {
                let targetVal = metric === 'R' ? cell.r : (metric === 'NS' ? cell.ns : cell.s);
                let p = Math.round((targetVal / cell.t) * 100);
                let isLow = cell.t < 30;
                let dangerScore = (metric === 'R' || metric === 'NS') ? p : (100 - p);
                let ci = wilsonScoreCI(targetVal, cell.t); // Calculate the confidence interval
                
                let bgClass = 'bg-white', textClass = 'text-slate-700';
                if (dangerScore <= 20) { bgClass = 'bg-emerald-100'; textClass = 'text-emerald-800'; }
                else if (dangerScore <= 40) { bgClass = 'bg-yellow-100'; textClass = 'text-yellow-800'; }
                else if (dangerScore <= 60) { bgClass = 'bg-orange-200'; textClass = 'text-orange-900'; }
                else if (dangerScore <= 80) { bgClass = 'bg-red-400'; textClass = 'text-white font-bold'; }
                else { bgClass = 'bg-red-600'; textClass = 'text-white font-bold'; }

                if (isLow) textClass += dangerScore > 60 ? ' text-red-100' : ' opacity-70';
                
                hmHtml += `<td class="${bgClass} ${textClass} align-middle">
                    <div class="leading-none">${p}% ${isLow ? '<span class="text-black font-bold">*</span>' : ''}</div>
                    <div class="text-[7.5px] font-medium opacity-80 tracking-tighter mt-1 whitespace-nowrap">95% CI (${ci.lower}% - ${ci.upper}%)</div>
                </td>`;
            }
        });
        hmHtml += '</tr>';
    });
    hmHtml += '</tbody></table>';
    $('#heatmapWrapper').html(hmHtml);
};
// --- Modal: About App ---
function showAboutModal() {
    Swal.fire({
        html: `
            <div class="text-sm text-slate-600 leading-relaxed text-center space-y-4">
                <!-- تم تحديث هذا القسم: إزالة الخلفية والحدود لضمان الشفافية، وزيادة الحجم -->
                <div class="mx-auto w-24 h-24 mb-4 flex items-center justify-center overflow-hidden">
                    <img src="icon.png" alt="AMR Icon" class="w-full h-full object-contain filter drop-shadow-md">
                </div>
                
                <h3 class="text-xl font-bold text-slate-800">AMR Tracker Dashboard</h3>
                <p class="font-medium text-teal-700">Antimicrobial Resistance Surveillance System</p>
                
                <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center text-sm leading-loose mt-4">
                    This platform was designed and developed by a member of the Antibiotic Committee, <b>Clinical Pharmacist Saad Nabeel Al-Hamadi</b>,
                    in collaboration with the <b>AMR Unit</b> and the <b>Microbiology Laboratory</b> staff at <b>Al-Mawani Teaching Hospital</b>.
                </div>
                
                <p class="text-[11px] text-slate-500 mt-4 leading-relaxed bg-amber-50 p-3 rounded-lg border border-amber-100 text-center">
                    <b>Legal notice:</b> This tool supports epidemiological surveillance and the generation of accurate clinical statistics. All intellectual and software rights reserved &copy; 2026.
                </p>
            </div>
        `,
        showConfirmButton: true,
        confirmButtonText: 'Close',
        confirmButtonColor: '#0d9488',
        width: '90%'
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

