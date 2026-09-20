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
function fetchCloudData() {
    if (!db) {
        loadAnalyticsFilters();
        generateLiveSurveillance();
        return;
    }
    
    Swal.fire({ title: 'Connecting to Cloud...', text: 'Establishing live connection...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    
    // استخدام onSnapshot بدلاً من get لجعل التحديث فورياً ومستمراً
    db.collection("amr_sync").doc("hospital_main").onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            const cloudRecords = data.records || [];
            // سحب الإعدادات السحابية أو استخدام الافتراضية
            const cloudSettings = data.settings || { profile1_abx: 'Meropenem', profile2_abx: 'Ceftriaxone' };
            
            // حفظ البيانات محلياً في الهاتف
            localStorage.setItem('amr_records', JSON.stringify(cloudRecords));
            localStorage.setItem('amr_live_settings', JSON.stringify(cloudSettings));
            
            // إعادة رسم المخططات فوراً بناءً على الإعدادات الجديدة
            loadAnalyticsFilters();
            generateLiveSurveillance();
        }
        Swal.close();
    }, (error) => {
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

function generateLiveSurveillance() {
    let allRecords = JSON.parse(localStorage.getItem('amr_records')) || [];
    let settings = JSON.parse(localStorage.getItem('amr_live_settings')) || { profile1_abx: 'Meropenem', profile2_abx: 'Ceftriaxone' };

    const blacklist = ["xxx", "con", "no growth", "contaminated", "normal flora", "mixed flora", "no significant growth"];
    let cleanRecords = allRecords.filter(r => {
        let org = (r['Selective organism'] || "").toLowerCase();
        return org !== "" && !blacklist.some(b => org.includes(b));
    });

    if (cleanRecords.length === 0) return;

    let allDates = cleanRecords.map(r => r.Date).filter(Boolean).sort();
    if(allDates.length === 0) return; 

    let latestDateStr = allDates[allDates.length - 1]; 
    let targetMonthPrefix = latestDateStr.substring(0, 7);

    let [lYear, lMonth] = targetMonthPrefix.split('-').map(Number);
    let qYear = lYear, qMonths = [], qLabel = "";

    if (lMonth <= 3) { qYear -= 1; qMonths = ["10","11","12"]; qLabel = `Q4 ${qYear}`; }
    else if (lMonth <= 6) { qMonths = ["01","02","03"]; qLabel = `Q1 ${qYear}`; }
    else if (lMonth <= 9) { qMonths = ["04","05","06"]; qLabel = `Q2 ${qYear}`; }
    else { qMonths = ["07","08","09"]; qLabel = `Q3 ${qYear}`; }

    let monthRecords = cleanRecords.filter(r => r.Date && r.Date.startsWith(targetMonthPrefix));
    let quarterRecords = cleanRecords.filter(r => {
        if(!r.Date) return false;
        let parts = r.Date.split('-');
        return parseInt(parts[0]) === qYear && qMonths.includes(parts[1]);
    });

    $('#live_month_title').text(`Surveillance Overview (${targetMonthPrefix})`);
    $('#live_q_title').text(`Surveillance Overview (${qLabel})`);

    liveCharts.forEach(c => c.destroy()); liveCharts = [];
    buildMobileLiveSection(monthRecords, 'm', settings, targetMonthPrefix);
    buildMobileLiveSection(quarterRecords, 'q', settings, qLabel);
}

function buildMobileLiveSection(records, prefix, settings, timeLabel) {
    $(`#live_${prefix}_total`).text(records.length);
    if(records.length === 0) {
        $(`#live_${prefix}_bug`).text("-");
        $(`#live_${prefix}_spec`).text("-");
        $(`#live_${prefix}_top3_container, #live_${prefix}_profiles_wrapper`).addClass('hidden');
        
        $(`#live_${prefix}_amr_title`).text(`Critical Resistance Markers (${timeLabel})`);
        $(`#live_${prefix}_blood_subtitle`).text(timeLabel);
        $(`#live_${prefix}_urine_subtitle`).text(timeLabel);
        $(`#live_${prefix}_bar_title`).text(`Top 5 Specimens (${timeLabel})`);
        return;
    }

    $(`#live_${prefix}_profiles_wrapper`).removeClass('hidden');

    $(`#live_${prefix}_amr_title`).text(`Critical Resistance Markers (${timeLabel})`);
    $(`#live_${prefix}_blood_subtitle`).text(timeLabel);
    $(`#live_${prefix}_urine_subtitle`).text(timeLabel);
    $(`#live_${prefix}_bar_title`).text(`Top 5 Specimens (${timeLabel})`);

    // --- CLSI M39 DEDUPLICATION (First isolate per patient per organism) ---
    const seenPatientOrg = new Set();
    const surveillanceRecords = records.filter(r => {
        const pName = (r['Name'] || '').trim().toLowerCase();
        const orgName = (r['Selective organism'] || '').trim().toLowerCase();
        // If patient name is missing, retain the record to prevent data loss
        if (!pName || pName === 'unknown' || pName === 'unknown patient') return true;
        
        const key = `${pName}_${orgName}`;
        if (seenPatientOrg.has(key)) return false;
        seenPatientOrg.add(key);
        return true;
    });

    let orgCounts = {}, specCounts = {};

    // --- CLINICALLY VALIDATED CRITICAL MARKERS (CLSI M100 / WHO GLASS) ---
    const criticalPairs = [
        { 
            orgs: ["escherichia coli", "klebsiella pneumoniae"], 
            abxList: ["Ceftriaxone", "Cefotaxime", "Ceftazidime"], 
            label: "ESBL Indicator\n(3rd Gen Ceph)" 
        },
        { 
            orgs: ["escherichia coli", "klebsiella pneumoniae"], 
            abxList: ["Ertapenem", "Meropenem", "Imipenem"], 
            label: "CRE\n(Carbapenem)" 
        },
        { 
            orgs: ["staphylococcus aureus"], 
            // Cefoxitin is the gold standard surrogate test for mecA-mediated MRSA
            abxList: ["Cefoxitin", "Cefoxitin screen", "Oxacillin"], 
            label: "MRSA\n(FOX/OX)" 
        },
        { 
            // Purely Enterococcal VRE (Separated from Staph aureus)
            orgs: ["enterococcus faecalis", "enterococcus faecium", "enterococcus spp"], 
            abxList: ["Vancomycin", "Teicoplanin"], 
            label: "VRE\n(Vancomycin)" 
        },
        { 
            // Tracked independently due to high clinical severity
            orgs: ["staphylococcus aureus"], 
            abxList: ["Vancomycin"], 
            label: "VRSA\n(Vancomycin)" 
        }
    ];

    let amrStats = criticalPairs.map(p => ({ label: p.label, tested: 0, resistant: 0 }));

    // Tally prevalence using all valid records
    records.forEach(r => {
        let org = r['Selective organism'] || "", spec = r['Sample'];
        orgCounts[org] = (orgCounts[org] || 0) + 1;
        if (spec && spec !== "-") specCounts[spec] = (specCounts[spec] || 0) + 1;
    });

    // Evaluate AMR resistance on deduplicated surveillance records
    surveillanceRecords.forEach(r => {
        let org = r['Selective organism'] || "";
        let orgLower = org.toLowerCase();

        criticalPairs.forEach((pair, index) => {
            if (pair.orgs.some(o => orgLower.includes(o.toLowerCase()))) {
                // Collect all valid test results available in this panel
                let validResults = pair.abxList
                    .map(a => r[a] ? String(r[a]).trim().toUpperCase() : '')
                    .filter(val => val && val !== '-');

                if (validResults.length > 0) {
                    amrStats[index].tested++;
                    // Non-susceptible/Resistant if ANY indicator agent in the panel is 'R'
                    if (validResults.some(val => val === 'R' || val.startsWith('R'))) {
                        amrStats[index].resistant++;
                    }
                }
            }
        });
    });

    $(`#live_${prefix}_bug`).text(formatOrgName(Object.keys(orgCounts).sort((a, b) => orgCounts[b] - orgCounts[a])[0]) || "-");
    $(`#live_${prefix}_spec`).text(Object.keys(specCounts).sort((a, b) => specCounts[b] - specCounts[a])[0] || "-");

    let labels = [], data = [], bgColors = [], ciData = [], nDataArr = [];
    amrStats.forEach((stat, index) => {
        labels.push(stat.label.split('\n'));
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
            scales: { y: { max: 100, beginAtZero: true } } 
        },
        plugins: [errorBarsPlugin]
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
    if (top3Specs.length > 0) $(`#live_${prefix}_top3_container`).html(htmlTop3).removeClass('hidden');

    let p1 = settings.profile1_abx || 'Meropenem';
    let p2 = settings.profile2_abx || 'Ceftriaxone';

    $(`#live_${prefix}_profile1_title`).text(`${p1} Resistance (% R)`);
    $(`#live_${prefix}_profile2_title`).text(`${p2} Resistance (% R)`);

    buildMobileAbxProfileChart(p1, `chart_${prefix}_mero`, `live_${prefix}_mero_count`, records, prefix === 'm' ? '#2563eb' : '#059669');
    buildMobileAbxProfileChart(p2, `chart_${prefix}_cro`, `live_${prefix}_cro_count`, records, '#0d9488');
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
                x: { 
                    ticks: { 
                        autoSkip: false, // لا تقم بقص أو إخفاء أي اسم
                        maxRotation: 45, 
                        minRotation: 45,
                        font: { size: 10 } 
                    } 
                } 
            }
        },
        plugins: [errorBarsPlugin] // إزالة إضافة الأسماء العمودية
    });
    
    liveCharts.push(chart);
}

window.toggleAdvancedSearch = function() {
    $('#adv_content').toggleClass('hidden');
    $('#adv_icon').toggleClass('rotate-180');
    
    // Populate the all specimens dropdown when opened
    if(!$('#adv_content').hasClass('hidden')) {
        let allRecords = JSON.parse(localStorage.getItem('amr_records')) || [];
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
    let allRecords = JSON.parse(localStorage.getItem('amr_records')) || [];
    let dateRecords = filterByPeriod(allRecords, period); 
    dateRecords = applyWardFilter(dateRecords, $('input[name="guided_ward"]:checked').val() || 'total');
    
    let uniqueSamples = new Set(dateRecords.map(r => r.Sample).filter(Boolean));
    let currentSample = $('#guided_sample').val();
    
    // Force the "Select a Specimen" prompt
    $('#guided_sample').empty();
    $('#guided_sample').append(new Option("Select a specimen...", "none", true, true));
    $('#guided_sample').append(new Option("All Specimens", "all"));
    
    Array.from(uniqueSamples).sort().forEach(s => {
        $('#guided_sample').append(new Option(s, s));
    });
    
    // Keep selection if valid, otherwise force "none"
    if (currentSample && currentSample !== "none" && (uniqueSamples.has(currentSample) || currentSample === "all")) {
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
    Array.from(orgs).sort().forEach(o => $('#adv_organism').append(new Option(o, o, currentAdvOrgs.includes(o), currentAdvOrgs.includes(o))));

    let currentAdvAbxs = $('#adv_antibiotic').val() || [];
    $('#adv_antibiotic').empty();
    Array.from(abxs).sort().forEach(a => $('#adv_antibiotic').append(new Option(a, a, currentAdvAbxs.includes(a), currentAdvAbxs.includes(a))));

    $('#guided_sample, #adv_organism, #adv_antibiotic').trigger('change.select2');
    isUpdatingFilters = false;
    
    // Trigger analysis
    generateGuidedAnalytics();
}

window.toggleGuidedSearch = function() {
    $('#guided_content').toggleClass('hidden');
    $('#guided_icon').toggleClass('rotate-180');
};

// Add listener to trigger search when a specimen is selected
$(document).on('change', '#guided_sample', function() {
    generateGuidedAnalytics();
});

$(document).on('change', '#guided_metric_toggle', function() {
    if ($(this).is(':checked')) {
        currentGuidedMetric = 'R';
        $('#lbl_R').removeClass('text-slate-400').addClass('text-rose-600');
        $('#lbl_S').removeClass('text-emerald-600').addClass('text-slate-400');
    } else {
        currentGuidedMetric = 'S';
        $('#lbl_S').removeClass('text-slate-400').addClass('text-emerald-600');
        $('#lbl_R').removeClass('text-rose-600').addClass('text-slate-400');
    }
    renderGuidedAST(); 
});

$(document).on('change', '#guided_bug_select', function() {
    currentGuidedBug = $(this).val();
    renderGuidedAST();
});

function generateGuidedAnalytics() {
    const targetSample = $('#guided_sample').val();

    // Block execution if no valid specimen is selected
    if (!targetSample || targetSample === "none") {
        $('#guidedContainer').addClass('hidden');
        $('#guidedPlaceholder').addClass('hidden');
        return;
    }

    let period = $('input[name="guided_period"]:checked').val() || 'all';
    let allRecords = JSON.parse(localStorage.getItem('amr_records')) || [];
    let records = filterByPeriod(allRecords, period);

    if (targetSample !== "all") { 
        records = records.filter(r => r.Sample === targetSample); 
    }
    
    records = applyWardFilter(records, $('input[name="adv_ward"]:checked').val() || 'total');
    records = applyWardFilter(records, $('input[name="guided_ward"]:checked').val() || 'total');
    
    if (records.length === 0) {
        $('#guidedContainer').addClass('hidden');
        $('#guidedPlaceholder').addClass('hidden');
        return;
    }

    $('#guidedPlaceholder').addClass('hidden');
    $('#guidedContainer').removeClass('hidden');
    let orgCounts = {};
    records.forEach(r => {
        let org = r['Selective organism'];
        if(org) orgCounts[org] = (orgCounts[org] || 0) + 1;
    });

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
    if (!currentGuidedBug) return;

    const targetSample = $('#guided_sample').val();
    let period = $('input[name="guided_period"]:checked').val() || 'all';

    let allRecords = JSON.parse(localStorage.getItem('amr_records')) || [];
    let records = filterByPeriod(allRecords, period);
    records = records.filter(r => r['Selective organism'] === currentGuidedBug);
    
    if (targetSample && targetSample !== "all") {
        records = records.filter(r => r.Sample === targetSample);
    }
    
    records = applyWardFilter(records, $('input[name="guided_ward"]:checked').val() || 'total');
    
    let allPossibleAbxs = [...abxList, ...getCustomAntibiotics().map(a=>a.name)];
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

    if (chartGuidedAMR_instance) chartGuidedAMR_instance.destroy();

    let chartWidth = labels.length > 5 ? (labels.length * 45) + 'px' : '100%';
    $('#guidedAmrContainer').css('width', chartWidth);

    chartGuidedAMR_instance = new Chart(document.getElementById('chartGuidedAMR'), {
        type: 'bar',
        data: { labels, datasets: [{ data, backgroundColor: bgColors, ciData, nData: nDataArr, borderRadius: 4 }] },
        options: { 
            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, 
            scales: { y: { max: 100, beginAtZero: true }, x: { ticks: { maxRotation: 90, minRotation: 90, autoSkip: false, font: {size: 10, weight: 'bold'} } } } 
        },
        plugins: [errorBarsPlugin]
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
$(document).on('change', '#patho_metric_toggle', function() {
    if ($(this).is(':checked')) {
        currentPathoMetric = 'R';
        $('#lbl_patho_R').removeClass('text-slate-400').addClass('text-rose-600');
        $('#lbl_patho_S').removeClass('text-emerald-600').addClass('text-slate-400');
    } else {
        currentPathoMetric = 'S';
        $('#lbl_patho_S').removeClass('text-slate-400').addClass('text-emerald-600');
        $('#lbl_patho_R').removeClass('text-rose-600').addClass('text-slate-400');
    }
    renderPathoChart(); 
});

function updatePathoDropdowns() {
    let period = $('input[name="patho_period"]:checked').val() || 'all';

    let records = JSON.parse(localStorage.getItem('amr_records')) || [];
    records = filterByPeriod(records, period);
    records = applyWardFilter(records, $('input[name="patho_ward"]:checked').val() || 'total');

    let orgs = new Set();
    records.forEach(r => { if(r['Selective organism']) orgs.add(r['Selective organism']); });

    let bugSelect = $('#patho_bug');
    let currentVal = bugSelect.val();
    bugSelect.empty().append(new Option("Select a bacteria...", ""));
    Array.from(orgs).sort().forEach(o => bugSelect.append(new Option(formatScientificName(o), o)));
    
    if(currentVal && orgs.has(currentVal)) bugSelect.val(currentVal);
    bugSelect.trigger('change.select2');
    renderPathoChart();
}

$(document).on('change', '#patho_hide_low', function() { renderPathoChart(); });

function renderPathoChart() {
    const bug = $('#patho_bug').val();
    if(!bug) {
        if (chartPathoAMR_instance) chartPathoAMR_instance.destroy();
        return;
    }

    let period = $('input[name="patho_period"]:checked').val() || 'all';
    let records = JSON.parse(localStorage.getItem('amr_records')) || [];
    records = filterByPeriod(records, period);
    records = records.filter(r => r['Selective organism'] === bug);
    records = applyWardFilter(records, $('input[name="patho_ward"]:checked').val() || 'total');
    

    let allPossibleAbxs = [...abxList, ...getCustomAntibiotics().map(a=>a.name)];
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

    if (chartPathoAMR_instance) chartPathoAMR_instance.destroy();

    let chartWidth = labels.length > 5 ? (labels.length * 45) + 'px' : '100%';
    $('#pathoAmrContainer').css('width', chartWidth);

    chartPathoAMR_instance = new Chart(document.getElementById('chartPathoAMR'), {
        type: 'bar',
        data: { labels, datasets: [{ data, backgroundColor: bgColors, ciData, nData: nDataArr, borderRadius: 4 }] },
        options: { 
            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, 
            scales: { y: { max: 100, beginAtZero: true }, x: { ticks: { maxRotation: 90, minRotation: 90, autoSkip: false, font: {size: 10, weight: 'bold'} } } } 
        },
        plugins: [errorBarsPlugin]
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
$(document).on('change', '#abx_metric_toggle', function() {
    if ($(this).is(':checked')) {
        currentAbxMetric = 'R';
        $('#lbl_abx_R').removeClass('text-slate-400').addClass('text-rose-600');
        $('#lbl_abx_S').removeClass('text-emerald-600').addClass('text-slate-400');
    } else {
        currentAbxMetric = 'S';
        $('#lbl_abx_S').removeClass('text-slate-400').addClass('text-emerald-600');
        $('#lbl_abx_R').removeClass('text-rose-600').addClass('text-slate-400');
    }
    renderAbxChart(); 
});

function updateAbxDropdowns() {
    let period = $('input[name="abx_period"]:checked').val() || 'all';

    let records = JSON.parse(localStorage.getItem('amr_records')) || [];
    records = filterByPeriod(records, period);
    records = applyWardFilter(records, $('input[name="abx_ward"]:checked').val() || 'total');

    let abxs = new Set();
    let allPossibleAbxs = [...abxList, ...getCustomAntibiotics().map(a=>a.name)];
    records.forEach(r => {
        allPossibleAbxs.forEach(a => { if (r[a] && r[a] !== '-' && r[a] !== '') abxs.add(a); });
    });

    let drugSelect = $('#abx_drug');
    let currentVal = drugSelect.val();
    drugSelect.empty().append(new Option("Select an antimicrobial...", ""));
    Array.from(abxs).sort().forEach(a => drugSelect.append(new Option(a, a)));
    
    if(currentVal && abxs.has(currentVal)) drugSelect.val(currentVal);
    drugSelect.trigger('change.select2');
    renderAbxChart();
}

$(document).on('change', '#abx_hide_low', function() { renderAbxChart(); });

function renderAbxChart() {
    const drug = $('#abx_drug').val();
    if(!drug) {
        if (chartAbxAMR_instance) chartAbxAMR_instance.destroy();
        return;
    }

    let period = $('input[name="abx_period"]:checked').val() || 'all';
    let records = JSON.parse(localStorage.getItem('amr_records')) || [];
    records = filterByPeriod(records, period);
    records = applyWardFilter(records, $('input[name="abx_ward"]:checked').val() || 'total');

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

    if (chartAbxAMR_instance) chartAbxAMR_instance.destroy();

    let chartWidth = labels.length > 5 ? (labels.length * 45) + 'px' : '100%';
    $('#abxAmrContainer').css('width', chartWidth);

    chartAbxAMR_instance = new Chart(document.getElementById('chartAbxAMR'), {
        type: 'bar',
        data: { labels, datasets: [{ data, backgroundColor: bgColors, ciData, nData: nDataArr, borderRadius: 4 }] },
        options: { 
            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, 
            scales: { y: { max: 100, beginAtZero: true }, x: { ticks: { maxRotation: 90, minRotation: 90, autoSkip: false, font: {size: 10, weight: 'bold'} } } } 
        },
        plugins: [errorBarsPlugin]
    });
}
window.generateAdvancedAnalytics = function() {
    const startDate = $('#adv_start').val();
    const endDate = $('#adv_end').val();
    const targetSample = $('#adv_sample').val();
    let targetOrgs = $('#adv_organism').val() || [];
    let targetAbxs = $('#adv_antibiotic').val() || [];
    const metric = $('#adv_metric').val() || 'R'; 

    let allRecords = JSON.parse(localStorage.getItem('amr_records')) || [];
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
                let ci = wilsonScoreCI(targetVal, cell.t); // Calculate the confidence interval
                
                let bgClass = 'bg-white', textClass = 'text-slate-700';
                if (dangerScore <= 20) { bgClass = 'bg-emerald-100'; textClass = 'text-emerald-800'; }
                else if (dangerScore <= 40) { bgClass = 'bg-yellow-100'; textClass = 'text-yellow-800'; }
                else if (dangerScore <= 60) { bgClass = 'bg-orange-200'; textClass = 'text-orange-900'; }
                else if (dangerScore <= 80) { bgClass = 'bg-red-400'; textClass = 'text-white font-bold'; }
                else { bgClass = 'bg-red-600'; textClass = 'text-white font-bold'; }

                if (isLow) textClass += dangerScore > 60 ? ' text-red-100' : ' opacity-70';
                
                // Added a tiny div for the CI under the percentage
                hmHtml += `<td class="${bgClass} ${textClass} align-middle">
                    <div class="leading-none">${p}% ${isLow ? '<span class="text-red-500 font-bold">*</span>' : ''}</div>
                    <div class="text-[8px] font-normal opacity-80 tracking-tighter mt-0.5">(${ci.lower}-${ci.upper})</div>
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
                <div class="mx-auto w-20 h-20 bg-teal-50 text-teal-700 rounded-full flex items-center justify-center mb-4 border border-teal-100 shadow-sm overflow-hidden p-1">
                    <img src="icon.png" alt="AMR Icon" class="w-full h-full object-contain">
                </div>
                <h3 class="text-xl font-bold text-slate-800">AMR Tracker Dashboard</h3>
                <p class="font-medium text-teal-700">Antimicrobial Resistance Surveillance System</p>
                <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 text-right text-sm leading-loose mt-4" dir="rtl">
                    تم تصميم وإعداد هذه المنصة البرمجية من قبل عضو لجنة المضادات الحيوية، <b>الصيدلاني السريري سعد نبيل الحمادي</b>، 
                    بالتعاون مع <b>وحدة الـ AMR</b> وكادر <b>مختبر المايكروبايولوجي</b> في <b>مستشفى الموانئ التعليمي</b>.
                </div>
                <p class="text-[11px] text-slate-500 mt-4 leading-relaxed bg-amber-50 p-3 rounded-lg border border-amber-100 text-right" dir="rtl">
                    <b>الحقوق القانونية:</b> هذه الأداة مخصصة لتسهيل عمليات الرصد الوبائي وتوليد الإحصائيات السريرية الدقيقة، جميع الحقوق الفكرية والبرمجية محفوظة &copy; 2026.
                </p>
            </div>
        `,
        showConfirmButton: true,
        confirmButtonText: 'إغلاق',
        confirmButtonColor: '#0d9488',
        width: '90%'
    });
}

// --- Modal: Install Guide ---
function showInstallGuide() {
    Swal.fire({
        title: '📲 تثبيت التطبيق',
        html: `
            <div class="text-sm text-slate-600 leading-relaxed space-y-5 text-right mt-3" dir="rtl">
                <p class="font-medium text-slate-700">للحصول على أفضل تجربة وسرعة في الوصول، قم بتثبيت لوحة البيانات كبرنامج على هاتفك:</p>
                
                <div class="bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <h4 class="font-bold text-blue-800 mb-2 flex items-center gap-2"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg> أجهزة آيفون (iOS)</h4>
                    <ol class="list-decimal list-inside space-y-1 text-xs">
                        <li>افتح هذا الرابط باستخدام متصفح <b>Safari</b> حصراً.</li>
                        <li>اضغط على زر المشاركة <span class="inline-block border border-slate-300 rounded px-1 bg-white">⍗</span> أسفل الشاشة.</li>
                        <li>اختر <b>"إضافة إلى الصفحة الرئيسية"</b> (Add to Home Screen).</li>
                    </ol>
                </div>

                <div class="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                    <h4 class="font-bold text-emerald-800 mb-2 flex items-center gap-2"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg> أجهزة أندرويد (Android)</h4>
                    <ol class="list-decimal list-inside space-y-1 text-xs">
                        <li>افتح هذا الرابط باستخدام متصفح <b>Chrome</b>.</li>
                        <li>اضغط على خيارات القائمة <span class="inline-block border border-slate-300 rounded px-1 bg-white">⋮</span> أعلى الشاشة.</li>
                        <li>اختر <b>"تثبيت التطبيق"</b> (Install app) أو <b>"الإضافة للشاشة الرئيسية"</b>.</li>
                    </ol>
                </div>
            </div>
        `,
        showConfirmButton: true,
        confirmButtonText: 'حسناً، فهمت',
        confirmButtonColor: '#0d9488',
        width: '90%'
    });
}

