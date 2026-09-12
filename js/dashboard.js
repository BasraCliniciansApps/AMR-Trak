const firebaseConfig = {
    apiKey: "AIzaSyCyWcTzvYXwsYQEgs_iNh_Co68H9_2kYU4",
    authDomain: "antibiogramtrak.firebaseapp.com",
    projectId: "antibiogramtrak",
    storageBucket: "antibiogramtrak.firebasestorage.app",
    messagingSenderId: "679667156703",
    appId: "1:679667156703:web:ca37e1544e3d20e922cb6a"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let cloudRecords = [];
let liveCharts = [];
let chartAna = null;

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
                    if (!ci || (ci.lower === 0 && ci.upper === 0 && dataset.data[index] === 0)) return;
                    const yLower = chart.scales.y.getPixelForValue(ci.lower);
                    const yUpper = chart.scales.y.getPixelForValue(ci.upper);
                    let x = element.x;
                    if (x === undefined) return;
                    ctx.save();
                    ctx.beginPath();
                    ctx.lineWidth = 1.5; ctx.strokeStyle = '#334155';
                    ctx.moveTo(x, yLower); ctx.lineTo(x, yUpper);
                    ctx.moveTo(x - 3, yUpper); ctx.lineTo(x + 3, yUpper);
                    ctx.moveTo(x - 3, yLower); ctx.lineTo(x + 3, yLower);
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
});

// الاتصال المباشر بقاعدة البيانات
db.collection("amr_sync").doc("hospital_main").onSnapshot((doc) => {
    if (doc.exists) {
        cloudRecords = doc.data().records || [];
        if(cloudRecords.length > 0) {
            populateFilters(cloudRecords);
            generateLiveSurveillance();
        } else {
            $('#live_m_total, #live_q_total').text('0');
            $('#live_m_bug, #live_q_bug, #live_m_spec, #live_q_spec').text('-');
        }
    }
}, (error) => {
    console.error("Firebase Error:", error);
    $('#connection_status').removeClass('text-emerald-600 bg-emerald-50 border-emerald-100').addClass('text-red-600 bg-red-50 border-red-100').html('Disconnected');
});

// تعريف وظيفة التبديل لتعمل كـ Global Function
window.switchTab = function(tab) {
    $('#viewLive, #viewAnalytics').addClass('hidden');
    $('#btnNavLive, #btnNavAnalytics').removeClass('active');
    
    if(tab === 'live') {
        $('#viewLive').removeClass('hidden');
        $('#btnNavLive').addClass('active');
        $('#headerTitle').text('Live Surveillance');
    } else {
        $('#viewAnalytics').removeClass('hidden');
        $('#btnNavAnalytics').addClass('active');
        $('#headerTitle').text('Surveillance Analytics');
    }
};

function generateLiveSurveillance() {
    const blacklist = ["xxx", "con", "no growth", "contaminated", "normal flora", "mixed flora"];
    let cleanRecords = cloudRecords.filter(r => {
        let org = (r['Selective organism'] || "").toLowerCase();
        return org !== "" && !blacklist.some(b => org.includes(b));
    });

    if (cleanRecords.length === 0) return;

    let allDates = cleanRecords.map(r => r.Date).filter(Boolean).sort();
    if(allDates.length === 0) return; // حماية ضد الأخطاء إذا لم يوجد تواريخ

    let latestDateStr = allDates[allDates.length - 1]; 
    let targetMonthPrefix = latestDateStr.substring(0, 7);

    let [lYear, lMonth] = targetMonthPrefix.split('-').map(Number);
    let qYear = lYear, qMonths = [], qLabel = "";

    if (lMonth <= 3) { qYear -= 1; qMonths = ["10","11","12"]; qLabel = `Q4 ${qYear}`; }
    else if (lMonth <= 6) { qMonths = ["01","02","03"]; qLabel = `Q1 ${qYear}`; }
    else if (lMonth <= 9) { qMonths = ["04","05","06"]; qLabel = `Q2 ${qYear}`; }
    else { qMonths = ["07","08","09"]; qLabel = `Q3 ${qYear}`; }

    let monthRecords = cleanRecords.filter(r => r.Date && r.Date.startsWith(targetMonthPrefix));
    let quarterRecords = cleanRecords.filter(r => r.Date && r.Date.split('-')[0] == qYear && qMonths.includes(r.Date.split('-')[1]));

    $('#live_m_title').text(`Month (${targetMonthPrefix})`);
    $('#live_q_title').text(`Quarter (${qLabel})`);

    liveCharts.forEach(c => c.destroy()); liveCharts = [];
    buildMobileLiveSection(monthRecords, 'm');
    buildMobileLiveSection(quarterRecords, 'q');
}

function buildMobileLiveSection(records, prefix) {
    $(`#live_${prefix}_total`).text(records.length);
    if(records.length === 0) return;

    let orgCounts = {}, specCounts = {};
    const criticalPairs = [
        { orgs: ["escherichia coli", "klebsiella pneumoniae"], abxList: ["Ceftriaxone", "Cefotaxime", "Ceftazidime"], label: "ESBL" },
        { orgs: ["escherichia coli", "klebsiella pneumoniae"], abxList: ["Meropenem", "Imipenem"], label: "CRE" },
        { orgs: ["staphylococcus aureus"], abxList: ["Oxacillin", "Cefoxitin"], label: "MRSA" }
    ];

    let amrStats = criticalPairs.map(p => ({ label: p.label, tested: 0, resistant: 0 }));

    records.forEach(r => {
        let org = r['Selective organism'] || "", spec = r['Sample'];
        orgCounts[org] = (orgCounts[org] || 0) + 1;
        if(spec && spec !== "-") specCounts[spec] = (specCounts[spec] || 0) + 1;

        criticalPairs.forEach((pair, index) => {
            if (pair.orgs.some(o => org.toLowerCase().includes(o.toLowerCase()))) {
                let abxFound = pair.abxList.find(a => r[a] && r[a] !== '-' && r[a] !== '');
                if (abxFound) { amrStats[index].tested++; if (r[abxFound] === 'R') amrStats[index].resistant++; }
            }
        });
    });

    $(`#live_${prefix}_bug`).text(Object.keys(orgCounts).sort((a,b)=>orgCounts[b]-orgCounts[a])[0] || "-");
    $(`#live_${prefix}_spec`).text(Object.keys(specCounts).sort((a,b)=>specCounts[b]-specCounts[a])[0] || "-");

    let labels = [], data = [], bgColors = [], ciData = [];
    amrStats.forEach(stat => {
        labels.push(stat.label);
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

    if(prefix === 'm') {
        let sortedOrgs = Object.keys(orgCounts).sort((a,b)=>orgCounts[b]-orgCounts[a]).slice(0, 4);
        liveCharts.push(new Chart(document.getElementById(`chart_m_pie`), {
            type: 'doughnut', data: { labels: sortedOrgs, datasets: [{ data: sortedOrgs.map(o=>orgCounts[o]), backgroundColor: ['#0d9488','#0ea5e9','#8b5cf6','#ec4899'] }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 8, font: {size: 9} } } } }
        }));

        let sortedSpecs = Object.keys(specCounts).sort((a,b)=>specCounts[b]-specCounts[a]).slice(0, 4);
        liveCharts.push(new Chart(document.getElementById(`chart_m_bar`), {
            type: 'bar', data: { labels: sortedSpecs, datasets: [{ data: sortedSpecs.map(s=>specCounts[s]), backgroundColor: '#14b8a6', borderRadius: 4 }] },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false } } }
        }));
    }
}

function populateFilters(records) {
    let orgs = new Set(), abxs = new Set(), specs = new Set();
    records.forEach(r => {
        if(r.Sample && r.Sample !== '-') specs.add(r.Sample);
        if(r['Selective organism'] && r['Selective organism'] !== '-') orgs.add(r['Selective organism']);
        Object.keys(r).forEach(k => {
            if(!['Name','Age','Age Unit','Sex','Ward','Sample','Date','Selective organism','Antibiogram organism'].includes(k)) {
                if(r[k] && r[k] !== '-') abxs.add(k);
            }
        });
    });

    $('#ana_sample').empty().append(new Option("All Specimens", ""));
    $('#ana_organism, #ana_antibiotic').empty();

    Array.from(specs).sort().forEach(s => $('#ana_sample').append(new Option(s, s)));
    Array.from(orgs).sort().forEach(o => $('#ana_organism').append(new Option(o, o)));
    Array.from(abxs).sort().forEach(a => $('#ana_antibiotic').append(new Option(a, a)));
}

// تعريف الدالة كـ Global لتعمل من زر الـ HTML
window.runAnalytics = function() {
    const start = $('#ana_start').val(), end = $('#ana_end').val(), spec = $('#ana_sample').val();
    const targetOrgs = $('#ana_organism').val() || [], targetAbxs = $('#ana_antibiotic').val() || [];

    let filtered = cloudRecords.filter(r => r.Date >= start && r.Date <= end);
    if(spec) filtered = filtered.filter(r => r.Sample === spec);

    if (filtered.length === 0 || targetOrgs.length === 0 || targetAbxs.length === 0) {
        alert("Please select at least one Organism and one Antibiotic."); return;
    }

    $('#analyticsResults').removeClass('hidden');
    let datasets = [];
    
    targetOrgs.forEach((org, i) => {
        let orgData = filtered.filter(r => r['Selective organism'] === org);
        let dataR = [], bgColors = [], ciData = [];
        
        targetAbxs.forEach(abx => {
            let tested = 0, resistant = 0;
            orgData.forEach(r => { if(r[abx] && r[abx] !== '-') { tested++; if(r[abx]==='R') resistant++; } });
            
            if(tested === 0) { dataR.push(0); bgColors.push('#e2e8f0'); ciData.push({lower:0,upper:0}); }
            else {
                dataR.push(Math.round((resistant/tested)*100));
                let rel = tested >= 30;
                bgColors.push(rel ? ['#0ea5e9', '#ec4899', '#8b5cf6', '#14b8a6'][i % 4] : '#cbd5e1');
                ciData.push(wilsonScoreCI(resistant, tested));
            }
        });
        datasets.push({ label: org, data: dataR, backgroundColor: bgColors, ciData, borderRadius: 4 });
    });

    if(chartAna) chartAna.destroy();
    chartAna = new Chart(document.getElementById('chartAna'), {
        type: 'bar',
        data: { labels: targetAbxs, datasets },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: {boxWidth:10, font:{size:10}} } }, scales: { y: { max: 100 } } },
        plugins: [errorBarsPlugin]
    });
};
