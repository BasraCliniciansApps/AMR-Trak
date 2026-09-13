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

const orgColorPalette = [
    { bg: 'rgba(185, 28, 28, 0.9)', lowBg: 'rgba(203, 213, 225, 0.6)' },
    { bg: 'rgba(30, 64, 175, 0.9)', lowBg: 'rgba(203, 213, 225, 0.6)' },
    { bg: 'rgba(21, 128, 61, 0.9)', lowBg: 'rgba(203, 213, 225, 0.6)' },
    { bg: 'rgba(162, 28, 175, 0.9)', lowBg: 'rgba(203, 213, 225, 0.6)' },
    { bg: 'rgba(194, 65, 12, 0.9)', lowBg: 'rgba(203, 213, 225, 0.6)' }
];

// دالة الاختصار العلمي لأسماء البكتيريا (مثال: S. aureus)
function formatOrgName(org) {
    if (!org || typeof org !== 'string' || org.startsWith('No ')) return org || "-";
    // تنظيف الزيادات المكررة
    let name = org.replace(/\(E\.coli\)/gi, "").trim();
    
    let parts = name.split(' ');
    // إذا كان الاسم يتكون من كلمتين فأكثر والكلمة الأولى أطول من 3 أحرف (لتجنب اختصار الكلمات القصيرة جداً)
    if (parts.length >= 2 && parts[0].length > 3) {
        return parts[0].charAt(0).toUpperCase() + '. ' + parts.slice(1).join(' ');
    }
    return name;
}

const errorBarsPlugin = {
    id: 'errorBars',
    afterDatasetsDraw(chart) {
        const ctx = chart.ctx;
        if (!chart.scales || !chart.scales.y) return;
        chart.data.datasets.forEach((dataset, i) => {
            const meta = chart.getDatasetMeta(i);
            if (!meta.hidden && dataset.ciData) {
                meta.data.forEach((element, index) => {
                    const ci = dataset.ciData[index];
                    if (!ci || (ci.lower === 0 && ci.upper === 0 && dataset.data[index] === 0) || dataset.data[index] === null) return;
                    const yLower = chart.scales.y.getPixelForValue(ci.lower);
                    const yUpper = chart.scales.y.getPixelForValue(ci.upper);
                    let x = element.x;
                    if (x === undefined) return;
                    ctx.save();
                    ctx.beginPath();
                    ctx.lineWidth = 1.5; ctx.strokeStyle = '#334155';
                    ctx.moveTo(x, yLower); ctx.lineTo(x, yUpper);
                    ctx.moveTo(x - 5, yUpper); ctx.lineTo(x + 5, yUpper);
                    ctx.moveTo(x - 5, yLower); ctx.lineTo(x + 5, yLower);
                    ctx.stroke(); ctx.restore();
                });
            }
        });
    }
};

function wilsonScoreCI(r, n) {
    if (n === 0) return { lower: 0, upper: 0 };
    const p = r / n, z2 = 3.8416;
    const denominator = 1 + z2 / n;
    const center = p + z2 / (2 * n);
    const spread = 1.96 * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
    return { lower: Math.max(0, Math.round(((center - spread) / denominator) * 100)), upper: Math.min(100, Math.round(((center + spread) / denominator) * 100)) };
}

$(document).ready(function() {
    $('.select2-mobile').select2({ width: '100%' });
    $('.select2-multiple').select2({ width: '100%', allowClear: true });
    
    let currentYear = new Date().getFullYear();
    $('#ana_start').val(`${currentYear}-01-01`);
    $('#ana_end').val(`${currentYear}-12-31`);

    $('#ana_start, #ana_end, #ana_sample').on('change', function() {
        if(!isUpdatingFilters) loadAnalyticsFilters();
    });

    loadAnalyticsFilters();
    generateLiveSurveillance();
    
    // جعل تبويب Analytics هو الافتراضي عند فتح الصفحة
    switchTab('analytics');
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

// -------------------------------------------------------------
// LIVE SURVEILLANCE LOGIC
// -------------------------------------------------------------
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

    $('#live_month_title').text(`Latest Active Month (${targetMonthPrefix})`);
    $('#live_q_title').text(`Last Completed Quarter (${qLabel})`);

    liveCharts.forEach(c => c.destroy()); liveCharts = [];
    buildMobileLiveSection(monthRecords, 'm', settings);
    buildMobileLiveSection(quarterRecords, 'q', settings);
}

function buildMobileLiveSection(records, prefix, settings) {
    $(`#live_${prefix}_total`).text(records.length);
    if(records.length === 0) {
        $(`#live_${prefix}_bug`).text("-");
        $(`#live_${prefix}_spec`).text("-");
        $(`#live_${prefix}_top3_container, #live_${prefix}_profiles_wrapper`).addClass('hidden');
        return;
    }

    $(`#live_${prefix}_profiles_wrapper`).removeClass('hidden');

    let orgCounts = {}, specCounts = {};
    const criticalPairs = [
        { orgs: ["escherichia coli", "klebsiella pneumoniae"], abxList: ["Ceftriaxone", "Cefotaxime", "Ceftazidime"], label: "ESBL\n(3rd Gen Ceph)" },
        { orgs: ["escherichia coli", "klebsiella pneumoniae"], abxList: ["Meropenem", "Imipenem"], label: "CRE\n(Carbapenem)" },
        { orgs: ["staphylococcus aureus"], abxList: ["Oxacillin", "Cefoxitin"], label: "MRSA\n(OX/FOX)" },
        { orgs: ["enterococcus faecalis", "enterococcus faecium", "enterococcus spp", "staphylococcus aureus"], abxList: ["Vancomycin"], label: "VRE/VRSA\n(VA)" }
    ];

    let amrStats = criticalPairs.map(p => ({ label: p.label, tested: 0, resistant: 0 }));

    records.forEach(r => {
        let org = r['Selective organism'] || "", spec = r['Sample'];
        orgCounts[org] = (orgCounts[org] || 0) + 1;
        if(spec && spec !== "-") specCounts[spec] = (specCounts[spec] || 0) + 1;

        let orgLower = org.toLowerCase();
        criticalPairs.forEach((pair, index) => {
            if (pair.orgs.some(o => orgLower.includes(o.toLowerCase()))) {
                let abxFound = pair.abxList.find(a => r[a] && r[a] !== '-' && r[a] !== '');
                if (abxFound) { amrStats[index].tested++; if (r[abxFound] === 'R') amrStats[index].resistant++; }
            }
        });
    });

    $(`#live_${prefix}_bug`).text(formatOrgName(Object.keys(orgCounts).sort((a,b)=>orgCounts[b]-orgCounts[a])[0]) || "-");
    $(`#live_${prefix}_spec`).text(Object.keys(specCounts).sort((a,b)=>specCounts[b]-specCounts[a])[0] || "-");

    let labels = [], data = [], bgColors = [], ciData = [];
    amrStats.forEach(stat => {
        labels.push(stat.label.split('\n'));
        if (stat.tested === 0) { data.push(0); bgColors.push('#e2e8f0'); ciData.push({lower:0, upper:0}); } 
        else {
            data.push(Math.round((stat.resistant / stat.tested) * 100));
            bgColors.push(stat.tested >= 30 ? 'rgba(13, 148, 136, 0.9)' : 'rgba(148, 163, 184, 0.5)');
            ciData.push(wilsonScoreCI(stat.resistant, stat.tested));
        }
    });

    liveCharts.push(new Chart(document.getElementById(`chart_${prefix}_amr`), {
        type: 'bar',
        data: { labels, datasets: [{ data, backgroundColor: bgColors, ciData, borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { max: 100 } } },
        plugins: [errorBarsPlugin]
    }));

    // ==========================================
    // Blood & Urine Pie Charts (Prevalence)
    // ==========================================
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
    // ==========================================

    let sortedSpecs = Object.keys(specCounts).sort((a,b)=>specCounts[b]-specCounts[a]);
    let top3Specs = sortedSpecs.slice(0, 3);
    let htmlTop3 = `<h4 class="text-xs font-bold text-slate-700 mt-2 mb-2 border-b pb-1">Top 3 Specimens Breakdown</h4>`;
    
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

    let sortedOrgs = Object.keys(orgCounts).sort((a,b)=>orgCounts[b]-orgCounts[a]).slice(0, 5);
    let pieLabels = sortedOrgs.map(o => formatOrgName(o));
    liveCharts.push(new Chart(document.getElementById(`chart_${prefix}_pie`), {
        type: 'doughnut', data: { labels: pieLabels, datasets: [{ data: sortedOrgs.map(o=>orgCounts[o]), backgroundColor: ['#0d9488','#0ea5e9','#8b5cf6','#ec4899','#f59e0b'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 8, font: {size: 9} } } } }
    }));

    liveCharts.push(new Chart(document.getElementById(`chart_${prefix}_bar`), {
        type: 'bar', data: { labels: sortedSpecs.slice(0,5), datasets: [{ data: sortedSpecs.slice(0,5).map(s=>specCounts[s]), backgroundColor: '#14b8a6', borderRadius: 4 }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false } } }
    }));

    let p1 = settings.profile1_abx || 'Meropenem';
    let p2 = settings.profile2_abx || 'Ceftriaxone';

    $(`#live_${prefix}_profile1_title`).text(`${p1}`);
    $(`#live_${prefix}_profile2_title`).text(`${p2}`);

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

    let labels = [], data = [], bgColors = [], ciData = [];
    sortedOrgs.forEach(org => {
        let item = orgMap[org];
        let p = Math.round((item.resistant / item.tested) * 100);
        labels.push(formatOrgName(org));
        data.push(p);
        bgColors.push(item.tested >= 30 ? primaryColor : 'rgba(148, 163, 184, 0.55)');
        ciData.push(wilsonScoreCI(item.resistant, item.tested));
    });

    if (sortedOrgs.length === 0) { labels = ['No Data']; data = [0]; bgColors = ['#e2e8f0']; ciData = [{ lower: 0, upper: 0 }]; }

    liveCharts.push(new Chart(canvas, {
        type: 'bar', data: { labels, datasets: [{ data, backgroundColor: bgColors, ciData, borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { max: 100 }, x: { ticks: { font: {size: 8} } } } },
        plugins: [errorBarsPlugin]
    }));
}

// -------------------------------------------------------------
// ANALYTICS LOGIC 
// -------------------------------------------------------------
function loadAnalyticsFilters() {
    if (isUpdatingFilters) return;
    isUpdatingFilters = true;

    let allRecords = JSON.parse(localStorage.getItem('amr_records')) || [];
    const startDate = $('#ana_start').val(), endDate = $('#ana_end').val();
    
    let records = allRecords.filter(r => (!startDate || !endDate) ? true : (r.Date >= startDate && r.Date <= endDate));

    const targetSample = $('#ana_sample').val();
    let uniqueSamples = new Set(records.map(r => r.Sample).filter(Boolean));
    $('#ana_sample').empty().append(new Option("All Samples", ""));
    Array.from(uniqueSamples).sort().forEach(s => $('#ana_sample').append(new Option(s, s)));
    if (targetSample && uniqueSamples.has(targetSample)) $('#ana_sample').val(targetSample);
    
    if (targetSample) records = records.filter(r => r.Sample === targetSample);

    let orgs = new Set(), abxs = new Set();
    records.forEach(r => {
        if(r['Selective organism']) orgs.add(r['Selective organism']);
        if(typeof abxList !== 'undefined') {
            abxList.forEach(a => { if (r[a] && r[a] !== '-' && r[a] !== '') abxs.add(a); });
        }
    });

    let currentOrgs = $('#ana_organism').val() || [];
    $('#ana_organism').empty();
    Array.from(orgs).sort().forEach(o => $('#ana_organism').append(new Option(o, o, currentOrgs.includes(o), currentOrgs.includes(o))));

    let currentAbxs = $('#ana_antibiotic').val() || [];
    $('#ana_antibiotic').empty();
    Array.from(abxs).sort().forEach(a => $('#ana_antibiotic').append(new Option(a, a, currentAbxs.includes(a), currentAbxs.includes(a))));

    $('#ana_sample, #ana_organism, #ana_antibiotic').trigger('change.select2');
    isUpdatingFilters = false;
}

window.generateAnalytics = function() {
    const startDate = $('#ana_start').val(), endDate = $('#ana_end').val();
    const targetSample = $('#ana_sample').val();
    let inputOrgs = $('#ana_organism').val() || [];
    let inputAbxs = $('#ana_antibiotic').val() || [];
    const metric = $('#ana_metric').val() || 'R'; 

    if (!startDate || !endDate) { Swal.fire('Required', 'Please select both dates.', 'warning'); return; }

    let allRecords = JSON.parse(localStorage.getItem('amr_records')) || [];
    let records = allRecords.filter(r => r.Date >= startDate && r.Date <= endDate);
    if (targetSample) records = records.filter(r => r.Sample === targetSample);

    if (records.length === 0) {
        $('#analyticsContainer').addClass('hidden');
        $('#analyticsPlaceholder').removeClass('hidden');
        Swal.fire('No Data', 'No records match selected criteria.', 'info');
        return;
    }

    let allPresentOrgs = new Set();
    let allPresentAbxs = new Set();
    records.forEach(r => {
        if(r['Selective organism']) allPresentOrgs.add(r['Selective organism']);
        if(typeof abxList !== 'undefined') {
            abxList.forEach(a => { if (r[a] && r[a] !== '-' && r[a] !== '') allPresentAbxs.add(a); });
        }
    });

    let targetOrgs = inputOrgs.length > 0 ? inputOrgs : Array.from(allPresentOrgs).sort();
    let targetAbxs = inputAbxs.length > 0 ? inputAbxs : Array.from(allPresentAbxs).sort();

    if (targetOrgs.length === 0 || targetAbxs.length === 0) {
        $('#analyticsContainer').addClass('hidden');
        $('#analyticsPlaceholder').removeClass('hidden');
        Swal.fire('No Data', 'No specific tests match the criteria.', 'info');
        return;
    }

    $('#analyticsPlaceholder').addClass('hidden');
    $('#analyticsContainer').removeClass('hidden');

    let hmDesc = metric === 'R' ? 'Dark Red = High Resistance. <span class="text-red-500 font-bold">*</span> = n &lt; 30.' : 'Dark Green = High Susceptibility. <span class="text-red-500 font-bold">*</span> = n &lt; 30.';
    $('#heatmapDesc').html(hmDesc);
    let hmLegend = metric === 'R' ? 
        `<span class="px-1 bg-emerald-100 text-emerald-800 rounded">0-20%</span><span class="px-1 bg-yellow-100 text-yellow-800 rounded">21-40%</span><span class="px-1 bg-orange-200 text-orange-900 rounded">41-60%</span><span class="px-1 bg-red-400 text-white rounded">61-80%</span><span class="px-1 bg-red-600 text-white rounded">81-100%</span>` :
        `<span class="px-1 bg-red-600 text-white rounded">0-20%</span><span class="px-1 bg-red-400 text-white rounded">21-40%</span><span class="px-1 bg-orange-200 text-orange-900 rounded">41-60%</span><span class="px-1 bg-yellow-100 text-yellow-800 rounded">61-80%</span><span class="px-1 bg-emerald-100 text-emerald-800 rounded">81-100%</span>`;
    $('#heatmapLegend').html(hmLegend);

    let orgCounts = {}, specCounts = {}, genderCounts = { "Male": 0, "Female": 0 }, heatmapStats = {}, amrStats = {};
    targetOrgs.forEach(org => {
        amrStats[org] = { total: 0, abx: {} };
        targetAbxs.forEach(a => { amrStats[org].abx[a] = { tested: 0, r: 0, s: 0 }; });
    });

    records.forEach(r => {
        let org = r['Selective organism'];
        if(!org) return;
        orgCounts[org] = (orgCounts[org] || 0) + 1;
        if(r.Sample) specCounts[r.Sample] = (specCounts[r.Sample] || 0) + 1;
        if(r.Sex && genderCounts[r.Sex] !== undefined) genderCounts[r.Sex] += 1;

        if (!heatmapStats[org]) heatmapStats[org] = {};
        
        if(typeof abxList !== 'undefined') {
            abxList.forEach(abx => {
                let res = r[abx];
                if (res && res !== '-' && res !== '') {
                    if (!heatmapStats[org][abx]) heatmapStats[org][abx] = { t: 0, r: 0, s: 0 };
                    heatmapStats[org][abx].t += 1;
                    if (res === 'R') heatmapStats[org][abx].r += 1;
                    if (res === 'S') heatmapStats[org][abx].s += 1;
                }
            });
        }

        if (targetOrgs.includes(org)) {
            targetAbxs.forEach(abx => {
                let res = r[abx];
                if (res && res !== '-' && res !== '') {
                    amrStats[org].abx[abx].tested += 1;
                    if (res === 'R') amrStats[org].abx[abx].r += 1;
                    if (res === 'S') amrStats[org].abx[abx].s += 1;
                }
            });
        }
    });

    if (inputOrgs.length === 0 && inputAbxs.length === 0) {
        $('#print_sect_amr').addClass('hidden');
    } else {
        $('#print_sect_amr').removeClass('hidden');

        let displayOrgs = inputOrgs.length > 0 ? inputOrgs : targetOrgs;
        let displayAbxs = inputAbxs.length > 0 ? inputAbxs : targetAbxs;

        if (inputOrgs.length > 0 && inputAbxs.length === 0) {
            displayOrgs = inputOrgs;
            let foundAbxs = new Set();
            displayOrgs.forEach(org => {
                if (amrStats[org]) {
                    Object.keys(amrStats[org].abx).forEach(abx => {
                        if (amrStats[org].abx[abx].tested > 0) foundAbxs.add(abx);
                    });
                }
            });
            displayAbxs = Array.from(foundAbxs).sort();
        } else if (inputOrgs.length === 0 && inputAbxs.length > 0) {
            displayAbxs = inputAbxs;
            let foundOrgs = new Set();
            Array.from(allPresentOrgs).forEach(org => {
                displayAbxs.forEach(abx => {
                    if (amrStats[org] && amrStats[org].abx[abx] && amrStats[org].abx[abx].tested > 0) foundOrgs.add(org);
                });
            });
            displayOrgs = Array.from(foundOrgs).sort();
        }

        let finalAbxs = [];
        displayAbxs.forEach(abx => {
            let hasData = displayOrgs.some(org => amrStats[org] && amrStats[org].abx[abx] && amrStats[org].abx[abx].tested > 0);
            if(hasData) finalAbxs.push(abx);
        });
        displayAbxs = finalAbxs;

        let datasets = [];
        displayOrgs.forEach((org, orgIndex) => {
            let s_org = amrStats[org];
            if (!s_org) return;

            let dataR = [], bgColors = [], ciData = [];
            let palette = orgColorPalette[orgIndex % orgColorPalette.length];
            let hasDataForThisOrg = false;

            displayAbxs.forEach(abx => {
                let s = s_org.abx[abx];
                if (!s || s.tested === 0) {
                    dataR.push(null); 
                    bgColors.push(palette.lowBg); 
                    ciData.push({lower: 0, upper: 0});
                } else {
                    hasDataForThisOrg = true;
                    let targetVal = metric === 'R' ? s.r : s.s;
                    let p = Math.round((targetVal / s.tested) * 100);
                    let isReliable = s.tested >= 30;
                    
                    dataR.push(p);
                    bgColors.push(isReliable ? palette.bg : palette.lowBg);
                    ciData.push(wilsonScoreCI(targetVal, s.tested));
                }
            });

            if(hasDataForThisOrg) {
                datasets.push({ 
                    label: formatOrgName(org), 
                    data: dataR, 
                    backgroundColor: bgColors, 
                    borderRadius: 4, 
                    ciData: ciData,
                    maxBarThickness: 45
                });
            }
        });

        if (chartAMR_instance) chartAMR_instance.destroy();
        
        let minWidthNeeded = (displayAbxs.length * datasets.length * 50) + 80;
        $('#amrChartContainer').css('width', `max(100%, ${minWidthNeeded}px)`);

        chartAMR_instance = new Chart(document.getElementById('chartAMR'), {
            type: 'bar',
            data: { labels: displayAbxs, datasets: datasets },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                skipNull: true,
                scales: { 
                    y: { max: 100 },
                    x: { ticks: { maxRotation: 45, minRotation: 45, font: {size: 9} } }
                }, 
                plugins: { 
                    legend: { position: 'top', labels: {boxWidth:8, font:{size:9}} },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                if (context.raw === null) return null;
                                return context.dataset.label + ': ' + context.raw + '%';
                            }
                        }
                    }
                } 
            },
            plugins: [errorBarsPlugin]
        });
    }

    let hmOrgs = Object.keys(heatmapStats).filter(o => targetOrgs.includes(o)).sort();
    let hmAbxs = targetAbxs.sort();

    let hmHtml = '<table class="heatmap-table"><thead><tr><th>Org (n)</th>';
    hmAbxs.forEach(a => { hmHtml += `<th><div class="w-16 truncate text-[10px]" title="${a}">${a}</div></th>`; });
    hmHtml += '</tr></thead><tbody>';

    hmOrgs.forEach(o => {
        let rowHasData = hmAbxs.some(a => heatmapStats[o][a] && heatmapStats[o][a].t > 0);
        if(!rowHasData) return;

        hmHtml += `<tr><th class="text-[10px] text-left leading-tight">${formatOrgName(o)} <br><span class="text-[9px] font-normal text-slate-400">(${orgCounts[o]||0})</span></th>`;
        hmAbxs.forEach(a => {
            let cell = heatmapStats[o][a];
            if (!cell || cell.t === 0) { hmHtml += '<td class="bg-slate-50 text-slate-300">-</td>'; } 
            else {
                let targetVal = metric === 'R' ? cell.r : cell.s;
                let p = Math.round((targetVal / cell.t) * 100);
                let isLow = cell.t < 30;
                let dangerScore = metric === 'R' ? p : (100 - p);
                
                let bgClass = 'bg-white', textClass = 'text-slate-700';
                if (dangerScore <= 20) { bgClass = 'bg-emerald-100'; textClass = 'text-emerald-800'; }
                else if (dangerScore <= 40) { bgClass = 'bg-yellow-100'; textClass = 'text-yellow-800'; }
                else if (dangerScore <= 60) { bgClass = 'bg-orange-200'; textClass = 'text-orange-900'; }
                else if (dangerScore <= 80) { bgClass = 'bg-red-400'; textClass = 'text-white font-bold'; }
                else { bgClass = 'bg-red-600'; textClass = 'text-white font-bold'; }

                if (isLow) textClass += dangerScore > 60 ? ' text-red-100' : ' opacity-70';
                hmHtml += `<td class="${bgClass} ${textClass}">${p}% ${isLow ? '<span class="text-red-500 font-bold">*</span>' : ''}</td>`;
            }
        });
        hmHtml += '</tr>';
    });
    hmHtml += '</tbody></table>';
    $('#heatmapWrapper').html(hmHtml);

    let sortedOrgs = Object.keys(orgCounts).sort((a,b)=>orgCounts[b]-orgCounts[a]).slice(0, 5);
    let orgLabels = sortedOrgs.map(o => formatOrgName(o));
    if(chartOrg_instance) chartOrg_instance.destroy();
    chartOrg_instance = new Chart(document.getElementById('chartOrg'), {
        type: 'doughnut', data: { labels: orgLabels, datasets: [{ data: sortedOrgs.map(o=>orgCounts[o]), backgroundColor: ['#0d9488','#0ea5e9','#3b82f6','#06b6d4','#14b8a6'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: {boxWidth: 8, font:{size: 9}} } } }
    });

    let sortedSpecs = Object.keys(specCounts).sort((a,b)=>specCounts[b]-specCounts[a]).slice(0, 5);
    if(chartSpec_instance) chartSpec_instance.destroy();
    chartSpec_instance = new Chart(document.getElementById('chartSpecimen'), {
        type: 'bar', data: { labels: sortedSpecs, datasets: [{ data: sortedSpecs.map(s=>specCounts[s]), backgroundColor: '#0ea5e9', borderRadius: 4 }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false } } }
    });

    if(chartGen_instance) chartGen_instance.destroy();
    chartGen_instance = new Chart(document.getElementById('chartGender'), {
        type: 'pie', data: { labels: ['Male', 'Female'], datasets: [{ data: [genderCounts['Male'], genderCounts['Female']], backgroundColor: ['#0ea5e9', '#ec4899'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
};
