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

let dashCharts = [];

// الاتصال اللحظي بقاعدة البيانات
db.collection("amr_sync").doc("hospital_main").onSnapshot((doc) => {
    if (doc.exists) {
        const records = doc.data().records || [];
        renderDashboard(records);
    } else {
        $('#dash_total, #dash_bug, #dash_spec').text("No Data");
    }
}, (error) => {
    console.error("Cloud Error: ", error);
    $('#connection_status').removeClass('text-emerald-600 bg-emerald-50').addClass('text-red-600 bg-red-50').html('Disconnected');
});

function renderDashboard(records) {
    const blacklist = ["xxx", "con", "no growth", "contaminated", "normal flora", "mixed flora", "no significant growth"];
    let cleanRecords = records.filter(r => {
        let org = (r['Selective organism'] || "").toLowerCase();
        return org !== "" && !blacklist.some(b => org.includes(b));
    });

    $('#dash_total').text(cleanRecords.length);
    if(cleanRecords.length === 0) return;

    let orgCounts = {}; let specCounts = {};
    const criticalPairs = [
        { orgs: ["escherichia coli", "klebsiella pneumoniae"], abx: ["Ceftriaxone"], label: "ESBL (CRO)" },
        { orgs: ["escherichia coli", "klebsiella pneumoniae"], abx: ["Meropenem", "Imipenem"], label: "CRE (Carbapenem)" },
        { orgs: ["staphylococcus aureus"], abx: ["Oxacillin", "Cefoxitin"], label: "MRSA (OX/FOX)" }
    ];

    let amrStats = criticalPairs.map(p => ({ label: p.label, tested: 0, resistant: 0 }));

    cleanRecords.forEach(r => {
        let org = r['Selective organism'] || "";
        let spec = r['Sample'];
        orgCounts[org] = (orgCounts[org] || 0) + 1;
        if(spec && spec !== "-") specCounts[spec] = (specCounts[spec] || 0) + 1;

        let orgLower = org.toLowerCase();
        criticalPairs.forEach((pair, index) => {
            if (pair.orgs.some(o => orgLower.includes(o.toLowerCase()))) {
                let abxFound = pair.abx.find(a => r[a] && r[a] !== '-');
                if (abxFound) {
                    amrStats[index].tested++;
                    if (r[abxFound] === 'R') amrStats[index].resistant++;
                }
            }
        });
    });

    $('#dash_bug').text(Object.keys(orgCounts).sort((a,b)=>orgCounts[b]-orgCounts[a])[0] || "-");
    $('#dash_spec').text(Object.keys(specCounts).sort((a,b)=>specCounts[b]-specCounts[a])[0] || "-");

    dashCharts.forEach(c => c.destroy());
    dashCharts = [];

    // Chart 1: AMR
    let labels = []; let data = []; let bgColors = [];
    amrStats.forEach(stat => {
        labels.push(stat.label);
        let p = stat.tested === 0 ? 0 : Math.round((stat.resistant / stat.tested) * 100);
        data.push(p);
        bgColors.push(stat.tested >= 30 ? 'rgba(220, 38, 38, 0.9)' : 'rgba(148, 163, 184, 0.5)');
    });

    dashCharts.push(new Chart(document.getElementById('dash_chart_amr'), {
        type: 'bar',
        data: { labels: labels, datasets: [{ label: '% R', data: data, backgroundColor: bgColors, borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { max: 100, beginAtZero: true } } }
    }));

    // Chart 2: Top Orgs
    let topOrgs = Object.keys(orgCounts).sort((a,b)=>orgCounts[b]-orgCounts[a]).slice(0, 5);
    dashCharts.push(new Chart(document.getElementById('dash_chart_pie'), {
        type: 'doughnut',
        data: { labels: topOrgs, datasets: [{ data: topOrgs.map(o=>orgCounts[o]), backgroundColor: ['#0f766e','#0ea5e9','#3b82f6','#8b5cf6','#ec4899'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: {boxWidth: 10} } } }
    }));

    // Chart 3: Top Specs
    let topSpecs = Object.keys(specCounts).sort((a,b)=>specCounts[b]-specCounts[a]).slice(0, 5);
    dashCharts.push(new Chart(document.getElementById('dash_chart_bar'), {
        type: 'bar',
        data: { labels: topSpecs, datasets: [{ label: 'Isolates', data: topSpecs.map(s=>specCounts[s]), backgroundColor: '#14b8a6', borderRadius: 4 }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    }));
}