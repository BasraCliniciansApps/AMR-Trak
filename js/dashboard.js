const firebaseConfig = {
    apiKey: "AIzaSyCyWcTzvYXwsYQEgs_iNh_Co68H9_2kYU4",
    authDomain: "antibiogramtrak.firebaseapp.com",
    projectId: "antibiogramtrak",
    storageBucket: "antibiogramtrak.firebasestorage.app",
    messagingSenderId: "679667156703",
    appId: "1:679667156703:web:ca37e1544e3d20e922cb6a"
};

let db = null;
try { firebase.initializeApp(firebaseConfig); db = firebase.firestore(); } catch(e) { console.warn("Firebase offline"); }

let liveCharts = [];
let chartAMR_instance = null; let chartOrg_instance = null; let chartSpec_instance = null; let chartGen_instance = null;
let isUpdatingFilters = false;

let chartGuidedPie_instance = null; let chartGuidedAMR_instance = null;
let currentGuidedOrgs = []; let currentGuidedBug = ""; let currentGuidedMetric = 'S';

let chartPathoAMR_instance = null; let currentPathoMetric = 'S';
let chartAbxAMR_instance = null; let currentAbxMetric = 'S';

function applyDeduplication(records) {
    const seenPatientOrg = new Set();
    return records.filter(r => {
        const patientIdentifier = (r['Patient ID'] || r['Name'] || '').trim().toLowerCase();
        const orgName = (r['Selective organism'] || '').trim().toLowerCase();
        if (!patientIdentifier || patientIdentifier === 'unknown' || patientIdentifier === 'unknown patient') return true;
        const key = `${patientIdentifier}_${orgName}`;
        if (seenPatientOrg.has(key)) return false;
        seenPatientOrg.add(key);
        return true;
    });
}

function applyWardFilter(records, filterValue) {
    if (filterValue === 'inpatient') return records.filter(r => { let w = (r.Ward || "").toLowerCase().trim(); return w !== 'outpatient' && w !== 'out-patient' && w !== 'opd'; });
    if (filterValue === 'outpatient') return records.filter(r => { let w = (r.Ward || "").toLowerCase().trim(); return w === 'outpatient' || w === 'out-patient' || w === 'opd'; });
    return records;
}

$(document).on('change', 'input[name="guided_ward"]', function() {
    let selectedVal = $(this).val();
    $('.guided-ward-btn').removeClass('bg-white text-indigo-700 shadow-sm').addClass('text-slate-500');
    $('input[name="guided_ward"][value="' + selectedVal + '"]').prop('checked', true).parent().removeClass('text-slate-500').addClass('bg-white text-indigo-700 shadow-sm');
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
});

function filterByPeriod(records, periodType) {
    if (!periodType || periodType === 'all') return records;
    let validRecords = records.filter(r => r.Date);
    if (validRecords.length === 0) return records;
    if (periodType === 'year') {
        let lastYear = (new Date().getFullYear() - 1).toString();
        return validRecords.filter(r => r.Date.startsWith(lastYear));
    }
    let allDates = validRecords.map(r => r.Date).sort();
    let latestDateStr = allDates[allDates.length - 1]; 
    let targetMonthPrefix = latestDateStr.substring(0, 7);
    if (periodType === 'month') return validRecords.filter(r => r.Date.startsWith(targetMonthPrefix));
    if (periodType === 'quarter') {
        let [lYear, lMonth] = targetMonthPrefix.split('-').map(Number);
        let qYear = lYear, qMonths = [];
        if (lMonth <= 3) { qYear -= 1; qMonths = ["10","11","12"]; }
        else if (lMonth <= 6) { qMonths = ["01","02","03"]; }
        else if (lMonth <= 9) { qMonths = ["04","05","06"]; }
        else { qMonths = ["07","08","09"]; }
        return validRecords.filter(r => {
            let parts = r.Date.split('-');
            return parseInt(parts[0]) === qYear && qMonths.includes(parts[1]);
        });
    }
    return records;
}

$(document).on('change', 'input[name="guided_period"]', function() { loadAnalyticsFilters(); });
$(document).on('change', 'input[name="patho_period"]', function() { updatePathoDropdowns(); });
$(document).on('change', 'input[name="abx_period"]', function() { updateAbxDropdowns(); });

function formatScientificName(name) {
    if (!name || typeof name !== 'string') return name;
    let cleanName = name.replace(/\(E\.coli\)/gi, "").trim(); 
    let isAntibiotic = cleanName.includes('/') || cleanName.toLowerCase().includes('acid'); 
    let parts = cleanName.split(' ');
    if (!isAntibiotic && parts.length >= 2 && parts[0].length > 3) {
        return parts[0].charAt(0).toUpperCase() + '. ' + parts.slice(1).join(' ');
    }
    return cleanName;
}

const extendedPalette = [
    { bg: 'rgba(13, 148, 136, 0.9)', faded: 'rgba(13, 148, 136, 0.25)' }, 
    { bg: 'rgba(14, 165, 233, 0.9)', faded: 'rgba(14, 165, 233, 0.25)' }, 
    { bg: 'rgba(59, 130, 246, 0.9)', faded: 'rgba(59, 130, 246, 0.25)' }, 
    { bg: 'rgba(139, 92, 246, 0.9)', faded: 'rgba(139, 92, 246, 0.25)' }, 
    { bg: 'rgba(217, 70, 239, 0.9)', faded: 'rgba(217, 70, 239, 0.25)' }, 
    { bg: 'rgba(244, 63, 94, 0.9)', faded: 'rgba(244, 63, 94, 0.25)' }, 
    { bg: 'rgba(249, 115, 22, 0.9)', faded: 'rgba(249, 115, 22, 0.25)' }, 
    { bg: 'rgba(234, 179, 8, 0.9)', faded: 'rgba(234, 179, 8, 0.25)' }, 
    { bg: 'rgba(132, 204, 22, 0.9)', faded: 'rgba(132, 204, 22, 0.25)' }, 
    { bg: 'rgba(220, 38, 38, 0.9)', faded: 'rgba(220, 38, 38, 0.25)' }   
];

const errorBarsPlugin = {
    id: 'errorBars',
    afterDatasetsDraw(chart) {
        const ctx = chart.ctx;
        if (!chart.scales || !chart.scales.y) return;
        chart.data.datasets.forEach((dataset, i) => {
            const meta = chart.getDatasetMeta(i);
            if (!meta.hidden && dataset.ciData) {
                meta.data.forEach((element, index) => {
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

function getCustomAntibiotics() { return JSON.parse(localStorage.getItem('amr_custom_abx_v2')) || []; }
function wilsonScoreCI(r, n) {
    if (n === 0) return { lower: 0, upper: 0 };
    const p = r / n, z2 = 3.8416;
    const denominator = 1 + z2 / n;
    const center = p + z2 / (2 * n);
    const spread = 1.96 * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
    return { lower: Math.max(0, Math.round(((center - spread) / denominator) * 100)), upper: Math.min(100, Math.round(((center + spread) / denominator) * 100)) };
}

function fetchCloudData() {
    if (!db) {
        loadAnalyticsFilters();
        generateLiveSurveillance();
        return;
    }
    
    Swal.fire({ title: 'Connecting to Cloud...', text: 'Establishing live connection...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    
    let fallbackTimer = setTimeout(() => {
        Swal.close();
        console.warn("Firebase connection timeout. Loading locally...");
        loadAnalyticsFilters();
        generateLiveSurveillance();
    }, 5000);

    db.collection("amr_sync").doc("hospital_main").onSnapshot((doc) => {
        clearTimeout(fallbackTimer);
        try {
            if (doc.exists) {
                const data = doc.data();
                const cloudRecords = data.records || [];
                const cloudSettings = data.settings || { profile1_abx: 'Meropenem', profile2_abx: 'Ceftriaxone' };
                localStorage.setItem('amr_records', JSON.stringify(cloudRecords));
                localStorage.setItem('amr_live_settings', JSON.stringify(cloudSettings));
                loadAnalyticsFilters();
                generateLiveSurveillance();
            }
        } catch (err) {
            console.error("Data Processing Error:", err);
        } finally {
            Swal.close();
        }
    }, (error) => {
        clearTimeout(fallbackTimer);
        console.error("Firebase Error:", error);
        Swal.close();
        Swal.fire({ icon: 'warning', title: 'Offline Mode', text: 'Could not connect to cloud.', timer: 2000, showConfirmButton: false });
        loadAnalyticsFilters();
        generateLiveSurveillance();
    });
}

$(document).ready(function() {
    $('.select2-mobile').select2({ width: '100%' });
    $('.select2-multiple').select2({ width: '100%', allowClear: true });
    
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (!isStandalone && !localStorage.getItem('amr_dashboard_install_prompted')) {
        setTimeout(() => { showInstallGuide(); localStorage.setItem('amr_dashboard_install_prompted', 'true'); }, 2000);
    }
    
    let currentYear = new Date().getFullYear();
    $('#adv_start').val(`${currentYear}-01`);
    $('#adv_end').val(`${currentYear}-12`);

    switchTab('analytics');
    fetchCloudData();
});

window.switchTab = function(tab) {
    $('#viewAnalytics, #viewLastMonth, #viewLastQuarter').addClass('hidden');
    $('#btnNavAnalytics, #btnNavLastMonth, #btnNavLastQuarter').removeClass('active');
    
    if(tab === 'analytics') {
        $('#viewAnalytics').removeClass('hidden');
        $('#btnNavAnalytics').addClass('active');
        $('#headerTitle').text('Surveillance Analytics');
        if(!isUpdatingFilters) loadAnalyticsFilters();
    } else if(tab === 'last_month') {
        $('#viewLastMonth').removeClass('hidden');
        $('#btnNavLastMonth').addClass('active');
        $('#headerTitle').text('Last Month Surveillance');
    } else if(tab === 'last_quarter') {
        $('#viewLastQuarter').removeClass('hidden');
        $('#btnNavLastQuarter').addClass('active');
        $('#headerTitle').text('Last Quarter Surveillance');
    }
};

window.toggleGuidedSearch = function() {
    $('#guided_content').toggleClass('hidden');
    $('#guided_icon').toggleClass('rotate-180');
};

$(document).on('change', '#guided_sample', function() { generateGuidedAnalytics(); });

function loadAnalyticsFilters() {
    if (isUpdatingFilters) return;
    isUpdatingFilters = true;

    let period = $('input[name="guided_period"]:checked').val() || 'all';
    let allRecords = JSON.parse(localStorage.getItem('amr_records')) || [];
    let dateRecords = filterByPeriod(allRecords, period); 
    dateRecords = applyDeduplication(dateRecords);
    
    let uniqueSamples = new Set(dateRecords.map(r => r.Sample).filter(Boolean));
    let currentSample = $('#guided_sample').val();
    
    $('#guided_sample').empty();
    $('#guided_sample').append(new Option("Select a specimen...", "none", true, true));
    $('#guided_sample').append(new Option("All Specimens", "all"));
    
    Array.from(uniqueSamples).sort().forEach(s => { $('#guided_sample').append(new Option(s, s)); });
    
    if (currentSample && currentSample !== "none") {
        if (currentSample !== "all" && !uniqueSamples.has(currentSample)) $('#guided_sample').append(new Option(currentSample, currentSample));
        $('#guided_sample').val(currentSample);
    } else {
        $('#guided_sample').val("none");
    }

    let orgs = new Set(), abxs = new Set();
    let allPossibleAbxs = [...(typeof abxList !== 'undefined' ? abxList : []), ...getCustomAntibiotics().map(a=>a.name)];
    
    dateRecords.forEach(r => {
        if(r['Selective organism']) orgs.add(r['Selective organism']);
        allPossibleAbxs.forEach(a => { if (r[a] && r[a] !== '-' && r[a] !== '') abxs.add(a); });
    });

    let currentAdvOrgs = $('#adv_organism').val() || [];
    $('#adv_organism').empty();
    Array.from(orgs).sort().forEach(o => { $('#adv_organism').append(new Option(o, o, currentAdvOrgs.includes(o), currentAdvOrgs.includes(o))); });

    let currentAdvAbxs = $('#adv_antibiotic').val() || [];
    $('#adv_antibiotic').empty();
    Array.from(abxs).sort().forEach(a => { $('#adv_antibiotic').append(new Option(a, a, currentAdvAbxs.includes(a), currentAdvAbxs.includes(a))); });

    $('#guided_sample, #adv_organism, #adv_antibiotic').trigger('change.select2');
    isUpdatingFilters = false;
    
    generateGuidedAnalytics();
}

function generateGuidedAnalytics() {
    const targetSample = $('#guided_sample').val();
    if (!targetSample || targetSample === "none") {
        $('#guidedContainer').addClass('hidden');
        $('#guidedPlaceholder').removeClass('hidden').html('<div class="text-sm font-bold text-slate-500 text-center py-4">Please select a date range above to generate the prevalence report.</div>');
        return;
    }

    let period = $('input[name="guided_period"]:checked').val() || 'all';
    let allRecords = JSON.parse(localStorage.getItem('amr_records')) || [];
    let records = filterByPeriod(allRecords, period);

    if (targetSample !== "all") { records = records.filter(r => r.Sample === targetSample); }
    records = applyWardFilter(records, $('input[name="guided_ward"]:checked').val() || 'total');
    records = applyDeduplication(records);
        
    if (records.length === 0) {
        $('#guidedContainer').addClass('hidden');
        $('#guidedPlaceholder').removeClass('hidden').html(`
            <div class="bg-slate-50 border-dashed border-2 border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center mx-1 mt-4">
                <h4 class="text-sm font-bold text-slate-600">No Data Available</h4>
            </div>
        `);
        return;
    }

    $('#guidedPlaceholder').addClass('hidden');
    $('#guidedContainer').removeClass('hidden');

    let orgCounts = {};
    records.forEach(r => { let org = r['Selective organism']; if(org) orgCounts[org] = (orgCounts[org] || 0) + 1; });
    currentGuidedOrgs = Object.keys(orgCounts).sort((a,b)=>orgCounts[b]-orgCounts[a]);
        
    if(chartGuidedPie_instance) chartGuidedPie_instance.destroy();
    
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

    let bugSelect = $('#guided_bug_select'); bugSelect.empty();
    currentGuidedOrgs.forEach(org => { bugSelect.append(new Option(`${formatScientificName(org)} (n=${orgCounts[org]})`, org)); });
    currentGuidedBug = currentGuidedOrgs[0]; bugSelect.val(currentGuidedBug);
    renderGuidedAST();
}

$(document).on('change', '#guided_metric_toggle', function() {
    if ($(this).is(':checked')) { currentGuidedMetric = 'R'; $('#lbl_R').removeClass('text-slate-400').addClass('text-rose-600'); $('#lbl_S').removeClass('text-emerald-600').addClass('text-slate-400'); } 
    else { currentGuidedMetric = 'S'; $('#lbl_S').removeClass('text-slate-400').addClass('text-emerald-600'); $('#lbl_R').removeClass('text-rose-600').addClass('text-slate-400'); }
    renderGuidedAST(); 
});

$(document).on('change', '#guided_bug_select', function() { currentGuidedBug = $(this).val(); renderGuidedAST(); });
$(document).on('change', '#guided_hide_low', function() { renderGuidedAST(); });

function renderGuidedAST() {
    if (chartGuidedAMR_instance) chartGuidedAMR_instance.destroy();
    
    if (!currentGuidedBug || currentGuidedBug === "") {
        $('#guidedAmrContainer').html('<div class="flex items-center justify-center h-full w-full text-slate-400 font-bold text-sm absolute inset-0">No Data Available</div>');
        $('#guidedAmrContainer').css('width', '100%');
        return;
    }
    
    $('#guidedAmrContainer').html('<canvas id="chartGuidedAMR"></canvas>');
    const targetSample = $('#guided_sample').val();
    let period = $('input[name="guided_period"]:checked').val() || 'all';

    let allRecords = JSON.parse(localStorage.getItem('amr_records')) || [];
    let records = filterByPeriod(allRecords, period);
    records = records.filter(r => r['Selective organism'] === currentGuidedBug);
    if (targetSample && targetSample !== "all") records = records.filter(r => r.Sample === targetSample);
    
    records = applyWardFilter(records, $('input[name="guided_ward"]:checked').val() || 'total');
    records = applyDeduplication(records);
    
    let allPossibleAbxs = [...(typeof abxList !== 'undefined' ? abxList : []), ...getCustomAntibiotics().map(a=>a.name)];
    let abxStats = {};

    records.forEach(r => {
        allPossibleAbxs.forEach(abx => {
            let res = r[abx];
            if (res && res !== '-' && res !== '') {
                if (!abxStats[abx]) abxStats[abx] = { tested: 0, r: 0, s: 0 };
                abxStats[abx].tested += 1;
                if (res === 'R') abxStats[abx].r += 1;
                if (res === 'S') abxStats[abx].s += 1;
            }
        });
    });

    let testedAbxs = Object.keys(abxStats).sort();
    let labels = [], data = [], bgColors = [], ciData = [], nDataArr = [];
    let baseColor = currentGuidedMetric === 'S' ? 'rgba(16, 185, 129, 0.9)' : 'rgba(225, 29, 72, 0.9)'; 
    let hideLowN = $('#guided_hide_low').is(':checked');

    testedAbxs.forEach(abx => {
        let s = abxStats[abx];
        let isReliable = s.tested >= 30;
        if (hideLowN && !isReliable) return;
        let targetVal = currentGuidedMetric === 'R' ? s.r : s.s;
        let p = Math.round((targetVal / s.tested) * 100);
        labels.push(isReliable ? abx : `${abx} *`);
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

    let chartWidth = labels.length > 5 ? (labels.length * 45) + 'px' : '100%';
    $('#guidedAmrContainer').css('width', chartWidth);

    chartGuidedAMR_instance = new Chart(document.getElementById('chartGuidedAMR'), {
        type: 'bar',
        data: { labels, datasets: [{ data, backgroundColor: bgColors, ciData, nData: nDataArr, borderRadius: 4, maxBarThickness: 30 }] },
        options: { 
            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, 
            scales: { y: { max: 100, beginAtZero: true }, x: { ticks: { maxRotation: 90, minRotation: 90, autoSkip: false, font: {size: 10, weight: 'bold'} } } } 
        },
        plugins: [errorBarsPlugin]
    });
}

window.togglePathoSearch = function() {
    $('#patho_content').toggleClass('hidden');
    $('#patho_icon').toggleClass('rotate-180');
    if(!$('#patho_content').hasClass('hidden')) updatePathoDropdowns();
};

$(document).on('change', '#patho_bug', function() { renderPathoChart(); });
$(document).on('change', '#patho_metric_toggle', function() {
    if ($(this).is(':checked')) { currentPathoMetric = 'R'; $('#lbl_patho_R').removeClass('text-slate-400').addClass('text-rose-600'); $('#lbl_patho_S').removeClass('text-emerald-600').addClass('text-slate-400'); } 
    else { currentPathoMetric = 'S'; $('#lbl_patho_S').removeClass('text-slate-400').addClass('text-emerald-600'); $('#lbl_patho_R').removeClass('text-rose-600').addClass('text-slate-400'); }
    renderPathoChart(); 
});

function updatePathoDropdowns() {
    let period = $('input[name="patho_period"]:checked').val() || 'all';
    let records = JSON.parse(localStorage.getItem('amr_records')) || [];
    records = filterByPeriod(records, period);

    let orgs = new Set();
    records.forEach(r => { if(r['Selective organism']) orgs.add(r['Selective organism']); });

    let bugSelect = $('#patho_bug');
    let currentVal = bugSelect.val();
    if (currentVal && !orgs.has(currentVal)) orgs.add(currentVal);

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
    let records = JSON.parse(localStorage.getItem('amr_records')) || [];
    records = filterByPeriod(records, period);
    records = records.filter(r => r['Selective organism'] === bug);
    records = applyWardFilter(records, $('input[name="patho_ward"]:checked').val() || 'total');
    records = applyDeduplication(records);

    let allPossibleAbxs = [...(typeof abxList !== 'undefined' ? abxList : []), ...getCustomAntibiotics().map(a=>a.name)];
    let abxStats = {};

    records.forEach(r => {
        allPossibleAbxs.forEach(abx => {
            let res = r[abx];
            if (res && res !== '-' && res !== '') {
                if (!abxStats[abx]) abxStats[abx] = { tested: 0, r: 0, s: 0 };
                abxStats[abx].tested += 1;
                if (res === 'R') abxStats[abx].r += 1;
                if (res === 'S') abxStats[abx].s += 1;
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

    let labels = [], data = [], bgColors = [], ciData = [], nDataArr = [];
    let baseColor = currentPathoMetric === 'S' ? 'rgba(16, 185, 129, 0.9)' : 'rgba(225, 29, 72, 0.9)'; 
    let hideLowN = $('#patho_hide_low').is(':checked');

    testedAbxs.forEach(abx => {
        let s = abxStats[abx];
        let isReliable = s.tested >= 30;
        if (hideLowN && !isReliable) return;
        let targetVal = currentPathoMetric === 'R' ? s.r : s.s;
        let p = Math.round((targetVal / s.tested) * 100);

        labels.push(isReliable ? abx : `${abx} *`);
        data.push(p);
        bgColors.push(isReliable ? baseColor : 'rgba(148, 163, 184, 0.5)'); 
        ciData.push(wilsonScoreCI(targetVal, s.tested));
        nDataArr.push(s.tested);
    });

    let chartWidth = labels.length > 5 ? (labels.length * 45) + 'px' : '100%';
    $('#pathoAmrContainer').css('width', chartWidth);

    chartPathoAMR_instance = new Chart(document.getElementById('chartPathoAMR'), {
        type: 'bar',
        data: { labels, datasets: [{ data, backgroundColor: bgColors, ciData, nData: nDataArr, borderRadius: 4, maxBarThickness: 30 }] },
        options: { 
            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, 
            scales: { y: { max: 100, beginAtZero: true }, x: { ticks: { maxRotation: 90, minRotation: 90, autoSkip: false, font: {size: 10, weight: 'bold'} } } } 
        },
        plugins: [errorBarsPlugin]
    });
}

window.toggleAbxSearch = function() {
    $('#abx_content').toggleClass('hidden');
    $('#abx_icon').toggleClass('rotate-180');
    if(!$('#abx_content').hasClass('hidden')) updateAbxDropdowns();
};

$(document).on('change', '#abx_drug', function() { renderAbxChart(); });
$(document).on('change', '#abx_metric_toggle', function() {
    if ($(this).is(':checked')) { currentAbxMetric = 'R'; $('#lbl_abx_R').removeClass('text-slate-400').addClass('text-rose-600'); $('#lbl_abx_S').removeClass('text-emerald-600').addClass('text-slate-400'); } 
    else { currentAbxMetric = 'S'; $('#lbl_abx_S').removeClass('text-slate-400').addClass('text-emerald-600'); $('#lbl_abx_R').removeClass('text-rose-600').addClass('text-slate-400'); }
    renderAbxChart(); 
});

function updateAbxDropdowns() {
    let period = $('input[name="abx_period"]:checked').val() || 'all';
    let records = JSON.parse(localStorage.getItem('amr_records')) || [];
    records = filterByPeriod(records, period);

    let abxs = new Set();
    let allPossibleAbxs = [...(typeof abxList !== 'undefined' ? abxList : []), ...getCustomAntibiotics().map(a=>a.name)];
    records.forEach(r => {
        allPossibleAbxs.forEach(a => { if (r[a] && r[a] !== '-' && r[a] !== '') abxs.add(a); });
    });

    let drugSelect = $('#abx_drug');
    let currentVal = drugSelect.val();
    if (currentVal && !abxs.has(currentVal)) abxs.add(currentVal);

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
    let records = JSON.parse(localStorage.getItem('amr_records')) || [];
    records = filterByPeriod(records, period);
    records = applyWardFilter(records, $('input[name="abx_ward"]:checked').val() || 'total');
    records = applyDeduplication(records);

    let orgStats = {};
    records.forEach(r => {
        let org = r['Selective organism'];
        let res = r[drug];
        if (org && res && res !== '-' && res !== '') {
            if (!orgStats[org]) orgStats[org] = { tested: 0, r: 0, s: 0 };
            orgStats[org].tested += 1;
            if (res === 'R') orgStats[org].r += 1;
            if (res === 'S') orgStats[org].s += 1;
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
        let targetVal = currentAbxMetric === 'R' ? s.r : s.s;
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
        data: { labels, datasets: [{ data, backgroundColor: bgColors, ciData, nData: nDataArr, borderRadius: 4, maxBarThickness: 30 }] },
        options: { 
            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, 
            scales: { y: { max: 100, beginAtZero: true }, x: { ticks: { maxRotation: 90, minRotation: 90, autoSkip: false, font: {size: 10, weight: 'bold'} } } } 
        },
        plugins: [errorBarsPlugin]
    });
}

window.toggleAdvancedSearch = function() {
    $('#adv_content').toggleClass('hidden');
    $('#adv_icon').toggleClass('rotate-180');
    if(!$('#adv_content').hasClass('hidden')) {
        let allRecords = JSON.parse(localStorage.getItem('amr_records')) || [];
        let allSamples = new Set(allRecords.map(r => r.Sample).filter(Boolean));
        let currentAdvSample = $('#adv_sample').val();
        $('#adv_sample').empty().append(new Option("All Specimens", ""));
        Array.from(allSamples).sort().forEach(s => $('#adv_sample').append(new Option(s, s)));
        if(currentAdvSample) $('#adv_sample').val(currentAdvSample);
    }
};

window.generateAdvancedAnalytics = function() {
    const startDate = $('#adv_start').val();
    const endDate = $('#adv_end').val();
    const targetSample = $('#adv_sample').val();
    let targetOrgs = $('#adv_organism').val() || [];
    let targetAbxs = $('#adv_antibiotic').val() || [];
    const metric = $('#adv_metric').val() || 'R'; 

    let allRecords = JSON.parse(localStorage.getItem('amr_records')) || [];
    let records = allRecords;

    if (startDate && endDate) { records = records.filter(r => r.Date >= startDate && r.Date <= endDate); } 
    else if (startDate) { records = records.filter(r => r.Date >= startDate); } 
    else if (endDate) { records = records.filter(r => r.Date <= endDate); }

    if (targetSample) { records = records.filter(r => r.Sample === targetSample); }
    records = applyWardFilter(records, $('input[name="adv_ward"]:checked').val() || 'total');
    records = applyDeduplication(records);

    if (targetOrgs.length === 0) targetOrgs = Array.from(document.getElementById('adv_organism').options).map(o => o.value);
    if (targetAbxs.length === 0) targetAbxs = Array.from(document.getElementById('adv_antibiotic').options).map(o => o.value);

    if (targetOrgs.length === 0 || targetAbxs.length === 0) { Swal.fire('No Data', 'No records match your selected criteria.', 'info'); return; }

    $('#advContainer').removeClass('hidden');
    let hmLegend = metric === 'R' ? 
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
                    if (!heatmapStats[org][abx]) heatmapStats[org][abx] = { t: 0, r: 0, s: 0 };
                    heatmapStats[org][abx].t += 1;
                    if (res === 'R') heatmapStats[org][abx].r += 1;
                    if (res === 'S') heatmapStats[org][abx].s += 1;
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
                let targetVal = metric === 'R' ? cell.r : cell.s;
                let p = Math.round((targetVal / cell.t) * 100);
                let isLow = cell.t < 30;
                let dangerScore = metric === 'R' ? p : (100 - p);
                let ci = wilsonScoreCI(targetVal, cell.t);
                
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

function generateLiveSurveillance() {
    let allRecords = JSON.parse(localStorage.getItem('amr_records')) || [];
    let s = JSON.parse(localStorage.getItem('amr_live_settings')) || { calc_mode: 'auto', manual_month: '', cutoff_day: '', show_amr: true, show_top3: true, profile1_abx: 'Meropenem', profile2_abx: 'Ceftriaxone' };
    
    const blacklist = ["xxx", "con", "no growth", "contaminated", "normal flora", "mixed flora", "no significant growth"];
    let cleanRecords = allRecords.filter(r => { let org = (r['Selective organism'] || "").toLowerCase(); return org !== "" && !blacklist.some(b => org.includes(b)); });
    if (cleanRecords.length === 0) return;

    let targetMonthPrefix = "";
    if (s.calc_mode === 'manual' && s.manual_month) {
        targetMonthPrefix = s.manual_month;
    } else {
        let cutoffDay = parseInt(s.cutoff_day);
        if (!isNaN(cutoffDay) && cutoffDay > 0 && cutoffDay <= 31) {
            let now = new Date(); let currentYear = now.getFullYear(); let currentMonth = now.getMonth() + 1; let currentDay = now.getDate();
            let targetY = currentYear; let targetM = currentMonth;
            if (currentDay < cutoffDay) { targetM -= 2; } else { targetM -= 1; }
            while (targetM < 1) { targetM += 12; targetY -= 1; }
            targetMonthPrefix = `${targetY}-${String(targetM).padStart(2, '0')}`;
        } else {
            let allMonths = [...new Set(cleanRecords.map(r => r.Date ? r.Date.substring(0,7) : "").filter(Boolean))].sort().reverse();
            if(allMonths.length > 0) { targetMonthPrefix = allMonths[0]; } else { targetMonthPrefix = new Date().toISOString().slice(0, 7); }
        }
    }

    let [qYear, qMonthStr] = targetMonthPrefix.split('-'); qYear = parseInt(qYear); let currentMonthNum = parseInt(qMonthStr);
    let qMonths = []; let qLabel = "";
    if (currentMonthNum <= 3) { qYear -= 1; qMonths = ["10","11","12"]; qLabel = `Q4 ${qYear}`; }
    else if (currentMonthNum <= 6) { qMonths = ["01","02","03"]; qLabel = `Q1 ${qYear}`; }
    else if (currentMonthNum <= 9) { qMonths = ["04","05","06"]; qLabel = `Q2 ${qYear}`; }
    else { qMonths = ["07","08","09"]; qLabel = `Q3 ${qYear}`; }

    let monthRecords = cleanRecords.filter(r => r.Date && r.Date.startsWith(targetMonthPrefix));
    let quarterRecords = cleanRecords.filter(r => {
        if(!r.Date) return false; let parts = r.Date.split('-');
        return parseInt(parts[0]) === qYear && qMonths.includes(parts[1]);
    });

    $('#live_month_title').text(`Surveillance Overview (${targetMonthPrefix})`);
    $('#live_q_title').text(`Surveillance Overview (${qLabel})`);

    liveCharts.forEach(c => c.destroy()); liveCharts = [];
    buildMobileLiveSection(monthRecords, 'm', s, targetMonthPrefix);
    buildMobileLiveSection(quarterRecords, 'q', s, qLabel);
}

function buildMobileLiveSection(records, prefix, settings, timeLabel) {
    $(`#live_${prefix}_total`).text(records.length);
    if(records.length === 0) {
        $(`#live_${prefix}_bug`).text("-"); $(`#live_${prefix}_spec`).text("-");
        $(`#live_${prefix}_top3_container, #live_${prefix}_profiles_wrapper`).addClass('hidden');
        $(`#live_${prefix}_amr_title`).text(`Critical Resistance Markers (${timeLabel})`);
        $(`#live_${prefix}_blood_subtitle`).text(timeLabel); $(`#live_${prefix}_urine_subtitle`).text(timeLabel);
        $(`#live_${prefix}_bar_title`).text(`Top 5 Specimens (${timeLabel})`);
        return;
    }

    $(`#live_${prefix}_profiles_wrapper`).removeClass('hidden');
    $(`#live_${prefix}_amr_title`).text(`Critical Resistance Markers (${timeLabel})`);
    $(`#live_${prefix}_blood_subtitle`).text(timeLabel); $(`#live_${prefix}_urine_subtitle`).text(timeLabel);
    $(`#live_${prefix}_bar_title`).text(`Top 5 Specimens (${timeLabel})`);

    const surveillanceRecords = applyDeduplication(records);
    let orgCounts = {}, specCounts = {};

    const criticalPairs = [
        { orgs: ["escherichia coli", "klebsiella pneumoniae"], abxList: ["Ceftriaxone", "Cefotaxime", "Ceftazidime"], label: "ESBL Indicator\n(3rd Gen Ceph)" },
        { orgs: ["escherichia coli", "klebsiella pneumoniae"], abxList: ["Ertapenem", "Meropenem", "Imipenem"], label: "CRE\n(Carbapenem)" },
        { orgs: ["staphylococcus aureus"], abxList: ["Cefoxitin", "Cefoxitin screen", "Oxacillin"], label: "MRSA\n(FOX/OX)" },
        { orgs: ["enterococcus faecalis", "enterococcus faecium", "enterococcus spp"], abxList: ["Vancomycin", "Teicoplanin"], label: "VRE\n(Vancomycin)" },
        { orgs: ["staphylococcus aureus"], abxList: ["Vancomycin"], label: "VRSA\n(Vancomycin)" }
    ];

    let amrStats = criticalPairs.map(p => ({ label: p.label, tested: 0, resistant: 0 }));

    records.forEach(r => {
        let org = r['Selective organism'] || "", spec = r['Sample'];
        orgCounts[org] = (orgCounts[org] || 0) + 1;
        if (spec && spec !== "-") specCounts[spec] = (specCounts[spec] || 0) + 1;
    });

    surveillanceRecords.forEach(r => {
        let org = r['Selective organism'] || ""; let orgLower = org.toLowerCase();
        criticalPairs.forEach((pair, index) => {
            if (pair.orgs.some(o => orgLower.includes(o.toLowerCase()))) {
                let validResults = pair.abxList.map(a => r[a] ? String(r[a]).trim().toUpperCase() : '').filter(val => val && val !== '-');
                if (validResults.length > 0) {
                    amrStats[index].tested++;
                    if (validResults.some(val => val === 'R' || val.startsWith('R'))) amrStats[index].resistant++;
                }
            }
        });
    });

    $(`#live_${prefix}_bug`).text(formatScientificName(Object.keys(orgCounts).sort((a, b) => orgCounts[b] - orgCounts[a])[0]) || "-");
    $(`#live_${prefix}_spec`).text(Object.keys(specCounts).sort((a, b) => specCounts[b] - specCounts[a])[0] || "-");

    let labels = [], data = [], bgColors = [], ciData = [], nDataArr = [];
    amrStats.forEach((stat, index) => {
        labels.push(stat.label.split('\n'));
        let palette = extendedPalette[index % extendedPalette.length]; 
        if (stat.tested === 0) { data.push(0); bgColors.push(palette.faded); ciData.push({ lower: 0, upper: 0 }); nDataArr.push(0); } else {
            data.push(Math.round((stat.resistant / stat.tested) * 100));
            bgColors.push(stat.tested >= 30 ? palette.bg : '#94a3b8'); 
            ciData.push(wilsonScoreCI(stat.resistant, stat.tested)); nDataArr.push(stat.tested);
        }
    });

    liveCharts.push(new Chart(document.getElementById(`chart_${prefix}_amr`), {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Pathogen', data, backgroundColor: bgColors, ciData, nData: nDataArr, borderRadius: 4, maxBarThickness: 30 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { max: 100, beginAtZero: true } } },
        plugins: [errorBarsPlugin]
    }));
    
    let bloodRecords = records.filter(r => r.Sample && r.Sample.toLowerCase() === 'blood');
    let urineRecords = records.filter(r => r.Sample && r.Sample.toLowerCase() === 'urine');
    let bloodCounts = {}; bloodRecords.forEach(r => { let o = r['Selective organism']; if(o) bloodCounts[o] = (bloodCounts[o] || 0) + 1; });
    let urineCounts = {}; urineRecords.forEach(r => { let o = r['Selective organism']; if(o) urineCounts[o] = (urineCounts[o] || 0) + 1; });
    
    let sortedBlood = Object.keys(bloodCounts).sort((a,b)=>bloodCounts[b]-bloodCounts[a]).slice(0, 5);
    let sortedUrine = Object.keys(urineCounts).sort((a,b)=>urineCounts[b]-urineCounts[a]).slice(0, 5);
    
    let bloodData = sortedBlood.length ? sortedBlood.map(o=>bloodCounts[o]) : [1];
    let bloodLabels = sortedBlood.length ? sortedBlood.map(o => formatScientificName(o)) : ['No Blood Samples'];
    let bloodColors = sortedBlood.length ? ['#ef4444','#dc2626','#f87171','#fca5a5','#fef2f2'] : ['#e2e8f0'];

    liveCharts.push(new Chart(document.getElementById(`chart_${prefix}_blood`), {
        type: 'doughnut', data: { labels: bloodLabels, datasets: [{ data: bloodData, backgroundColor: bloodColors }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: sortedBlood.length > 0 } } }
    }));
    
    let urineData = sortedUrine.length ? sortedUrine.map(o=>urineCounts[o]) : [1];
    let urineLabels = sortedUrine.length ? sortedUrine.map(o => formatScientificName(o)) : ['No Urine Samples'];
    let urineColors = sortedUrine.length ? ['#eab308','#ca8a04','#fde047','#fef08a','#fefce8'] : ['#e2e8f0'];

    liveCharts.push(new Chart(document.getElementById(`chart_${prefix}_urine`), {
        type: 'doughnut', data: { labels: urineLabels, datasets: [{ data: urineData, backgroundColor: urineColors }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: sortedUrine.length > 0 } } }
    }));

    let sortedSpecs = Object.keys(specCounts).sort((a,b)=>specCounts[b]-specCounts[a]);
    let top5Specs = sortedSpecs.slice(0, 5);

    liveCharts.push(new Chart(document.getElementById(`chart_${prefix}_bar`), {
        type: 'bar', data: { labels: top5Specs, datasets: [{ data: top5Specs.map(s => specCounts[s]), backgroundColor: '#2cb4a4', borderRadius: 4 }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { stepSize: 1, maxRotation: 45, minRotation: 45 } }, y: { grid: { display: false } } } }
    }));

    let top3Specs = sortedSpecs.slice(0, 3);
    let htmlTop3 = `<h4 class="text-xs font-bold text-slate-700 mt-2 mb-2 border-b pb-1">Top 3 Specimens Breakdown (${timeLabel})</h4>`;
    
    let allPossibleAbxs = [...(typeof abxList !== 'undefined' ? abxList : []), ...getCustomAntibiotics().map(a=>a.name)];
    top3Specs.forEach(spec => {
        let specRecords = records.filter(r => r.Sample === spec);
        let bCounts = {};
        specRecords.forEach(r => { let o = r['Selective organism']; if(o) bCounts[o] = (bCounts[o]||0)+1; });
        let topBugSpec = formatScientificName(Object.keys(bCounts).sort((a,b)=>bCounts[b]-bCounts[a])[0]) || "-";

        let abxS = {}, abxT = {};
        specRecords.forEach(r => {
            allPossibleAbxs.forEach(a => {
                if(r[a] && r[a] !== '-') { abxT[a] = (abxT[a]||0)+1; if(r[a] === 'S') abxS[a] = (abxS[a]||0)+1; }
            });
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
    if (top3Specs.length > 0) $(`#live_${prefix}_top3_container`).html(htmlTop3).removeClass('hidden');

    let mdrStats = { 'Non-MDR': 0, 'MDR': 0, 'XDR': 0 }; let wardMdrStats = {};
    records.forEach(r => {
        let resistantGroups = new Set(); let org = r['Selective organism'] || ""; let ward = r['Ward'] || "Unknown";
        if (!org || org === '-') return;

        if (typeof abxGroups !== 'undefined') {
            Object.keys(abxGroups).forEach(group => {
                if (group === "Antifungals") return; 
                let abxsInGroup = abxGroups[group];
                for (let abx of abxsInGroup) { if (r[abx] && r[abx] === 'R') { resistantGroups.add(group); break; } }
            });
        }
        let count = resistantGroups.size; let classification = 'Non-MDR';
        if (count >= 5) classification = 'XDR'; else if (count >= 3) classification = 'MDR'; 
        mdrStats[classification]++;
        
        if (!wardMdrStats[ward]) wardMdrStats[ward] = { 'Non-MDR': 0, 'MDR': 0, 'XDR': 0, total: 0 };
        wardMdrStats[ward][classification]++; wardMdrStats[ward].total++;
    });

    let mdrData = [mdrStats['Non-MDR'], mdrStats['MDR'], mdrStats['XDR']];
    let mdrLabels = ['Normal / Susceptible', 'MDR (≥3 Classes)', 'XDR (≥5 Classes)'];
    let mdrColors = ['#10b981', '#f59e0b', '#e11d48'];
    if (mdrData.reduce((a, b) => a + b, 0) === 0) { mdrData = [1]; mdrLabels = ['No Valid Data']; mdrColors = ['#e2e8f0']; }

    liveCharts.push(new Chart(document.getElementById(`chart_${prefix}_mdr_pie`), {
        type: 'doughnut',
        data: { labels: mdrLabels, datasets: [{ data: mdrData, backgroundColor: mdrColors, borderWidth: 2 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9, weight: 'bold' } } }, title: { display: true, text: 'Overall Resistance Classification', font: { size: 10, weight: 'bold' }, padding: { bottom: 10 } } } }
    }));

    let sortedWards = Object.keys(wardMdrStats).sort((a, b) => (wardMdrStats[b]['MDR'] + wardMdrStats[b]['XDR']) - (wardMdrStats[a]['MDR'] + wardMdrStats[a]['XDR'])).slice(0, 5); 
    let stackLabels = sortedWards.map(w => w.length > 12 ? w.slice(0, 10) + '..' : w);
    let stackNonMDR = sortedWards.map(w => wardMdrStats[w]['Non-MDR']);
    let stackMDR = sortedWards.map(w => wardMdrStats[w]['MDR']);
    let stackXDR = sortedWards.map(w => wardMdrStats[w]['XDR']);

    liveCharts.push(new Chart(document.getElementById(`chart_${prefix}_mdr_bar`), {
        type: 'bar',
        data: { labels: stackLabels, datasets: [ { label: 'Non-MDR', data: stackNonMDR, backgroundColor: '#10b981', borderRadius: 2 }, { label: 'MDR', data: stackMDR, backgroundColor: '#f59e0b', borderRadius: 2 }, { label: 'XDR', data: stackXDR, backgroundColor: '#e11d48', borderRadius: 2 } ] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, title: { display: true, text: 'Hotspots (Top 5 Wards)', font: { size: 10, weight: 'bold' }, padding: { bottom: 10 } } }, scales: { x: { stacked: true, ticks: { font: { size: 9, weight: 'bold' } }, grid: { display: false } }, y: { stacked: true, beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { stepSize: 1 } } } }
    }));

    let p1 = settings.profile1_abx || 'Meropenem'; let p2 = settings.profile2_abx || 'Ceftriaxone';
    $(`#live_${prefix}_profile1_title`).text(`${p1} Resistance (% R)`); $(`#live_${prefix}_profile2_title`).text(`${p2} Resistance (% R)`);

    buildMobileAbxProfileChart(p1, `chart_${prefix}_mero`, `live_${prefix}_mero_count`, records, prefix === 'm' ? '#2563eb' : '#059669');
    buildMobileAbxProfileChart(p2, `chart_${prefix}_cro`, `live_${prefix}_cro_count`, records, '#0d9488');
}

function buildMobileAbxProfileChart(abxName, canvasId, countElId, records, primaryColor) {
    let canvas = document.getElementById(canvasId); if (!canvas) return;
    let orgMap = {};
    records.forEach(r => {
        let org = r['Selective organism']; if (!org || org === '-') return;
        let val = r[abxName];
        if (val && val !== '-' && val !== '') {
            if (!orgMap[org]) orgMap[org] = { tested: 0, resistant: 0 };
            orgMap[org].tested++; if (val === 'R') orgMap[org].resistant++;
        }
    });

    let sortedOrgs = Object.keys(orgMap).sort((a, b) => orgMap[b].tested - orgMap[a].tested).slice(0, 5);
    let totalTestedAbx = Object.values(orgMap).reduce((sum, item) => sum + item.tested, 0);
    if (countElId) $(`#${countElId}`).text(`(n=${totalTestedAbx})`);

    let labels = [], data = [], bgColors = [], ciData = [], nDataArr = [];
    sortedOrgs.forEach((org, index) => {
        let item = orgMap[org]; let p = Math.round((item.resistant / item.tested) * 100); let palette = extendedPalette[index % extendedPalette.length];
        labels.push(org); data.push(p); bgColors.push(item.tested >= 30 ? palette.bg : '#94a3b8'); ciData.push(wilsonScoreCI(item.resistant, item.tested)); nDataArr.push(item.tested);
    });

    if (sortedOrgs.length === 0) { labels = ['No Data']; data = [0]; bgColors = ['#e2e8f0']; ciData = [{ lower: 0, upper: 0 }]; nDataArr = [0]; }

    let chart = new Chart(canvas, {
        type: 'bar',
        data: { labels: labels.map(lbl => formatScientificName(lbl)), datasets: [{ label: abxName, data: data, backgroundColor: bgColors, ciData: ciData, nData: nDataArr, borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 }, x: { ticks: { autoSkip: false, maxRotation: 45, minRotation: 45, font: { size: 10 } } } } },
        plugins: [errorBarsPlugin] 
    });
    liveCharts.push(chart);
}
