// --- Firebase Hybrid Sync Initialization ---
const firebaseConfig = {
    apiKey: "AIzaSyCyWcTzvYXwsYQEgs_iNh_Co68H9_2kYU4",
    authDomain: "antibiogramtrak.firebaseapp.com",
    projectId: "antibiogramtrak",
    storageBucket: "antibiogramtrak.firebasestorage.app",
    messagingSenderId: "679667156703",
    appId: "1:679667156703:web:ca37e1544e3d20e922cb6a"
};

let db = null;
let auth = null;
try {
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();

        auth.onAuthStateChanged((user) => {
            if (user) {
                $('#loginOverlay').addClass('hidden');
                $('#mainAppContainer').removeClass('hidden');
            } else {
                $('#loginOverlay').removeClass('hidden');
                $('#mainAppContainer').addClass('hidden');
            }
        });
        
        window.addEventListener('online', syncLocalToCloud);
        syncCloudToLocal();
    }
} catch(e) {
    console.warn("Firebase not loaded, running strictly offline.");
}

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

function loginUser() {
    const email = $('#loginEmail').val();
    const pass = $('#loginPass').val();
    if(!email || !pass) { Swal.fire('تنبيه', 'يرجى إدخال البريد وكلمة المرور', 'warning'); return; }
    Swal.showLoading();
    auth.signInWithEmailAndPassword(email, pass).then(() => { Swal.close(); }).catch((error) => {
        Swal.fire('خطأ', 'بيانات الدخول غير صحيحة!', 'error'); console.error(error);
    });
}

function logoutUser() { if (auth) auth.signOut(); }

async function syncLocalToCloud() {
    if (!db) return;
    try {
        let localRecords = JSON.parse(localStorage.getItem('amr_records')) || [];
        let liveSettings = JSON.parse(localStorage.getItem('amr_live_settings')) || { profile1_abx: 'Meropenem', profile2_abx: 'Ceftriaxone' };
        await db.collection("amr_sync").doc("hospital_main").set({
            records: localRecords, settings: liveSettings, last_updated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch(e) { console.error("Error syncing to cloud:", e); }
}

function syncCloudToLocal() {
    if (!db) return;
    db.collection("amr_sync").doc("hospital_main").onSnapshot((doc) => {
        if (doc.exists) {
            if (doc.metadata.hasPendingWrites) return;
            const cloudRecords = doc.data().records || [];
            const cloudSettings = doc.data().settings || null;
            let localRecordsStr = localStorage.getItem('amr_records') || "[]";
            let cloudRecordsStr = JSON.stringify(cloudRecords);
            let localRecords = JSON.parse(localRecordsStr);

            if (cloudRecordsStr !== localRecordsStr && cloudRecords.length > 0) {
                localStorage.setItem('amr_records', cloudRecordsStr);
                if (typeof initDataTable === 'function') initDataTable();
                if (!$('#viewAnalytics').hasClass('hidden') && typeof loadAnalyticsFilters === 'function') loadAnalyticsFilters();
                if (!$('#viewLive').hasClass('hidden') && typeof generateLiveSurveillance === 'function') generateLiveSurveillance();
            } else if (localRecords.length > 0 && cloudRecords.length === 0) {
                if (typeof syncLocalToCloud === 'function') syncLocalToCloud();
            }
            if (cloudSettings) localStorage.setItem('amr_live_settings', JSON.stringify(cloudSettings));
        }
    }, (error) => { console.error("Error fetching live data from cloud:", error); });
}

let dataTable;
let chartAMR_instance = null; let chartOrg_instance = null; let chartSpec_instance = null; let chartGen_instance = null;
let liveCharts = []; let isUpdatingFilters = false;

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
                    const ci = dataset.ciData[index];
                    if (!ci || (ci.lower === 0 && ci.upper === 0 && dataset.data[index] === 0)) return;
                    const yLower = chart.scales.y.getPixelForValue(ci.lower);
                    const yUpper = chart.scales.y.getPixelForValue(ci.upper);
                    let x = element.x;
                    if (x === undefined) return;
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

function runDatabaseMigration() {
    let records = JSON.parse(localStorage.getItem('amr_records')) || [];
    let migrated = false;
    records.forEach(r => {
        if (r['Selective organism'] === "Escherichia coli (E.coli)") { r['Selective organism'] = "Escherichia coli"; migrated = true; }
        if (r['Antibiogram organism'] === "Escherichia coli (E.coli)") { r['Antibiogram organism'] = "Escherichia coli"; migrated = true; }
    });
    if (migrated) localStorage.setItem('amr_records', JSON.stringify(records));
}

function getCustomAntibiotics() { return JSON.parse(localStorage.getItem('amr_custom_abx_v2')) || []; }
function saveCustomAntibiotic(name, group) {
    let custom = getCustomAntibiotics(); custom.push({name, group});
    localStorage.setItem('amr_custom_abx_v2', JSON.stringify(custom));
}
function deleteCustomAntibiotic(name) {
    let custom = getCustomAntibiotics(); custom = custom.filter(a => a.name !== name);
    localStorage.setItem('amr_custom_abx_v2', JSON.stringify(custom));
}

function updateAbxColor(el) {
    $(el).removeClass('bg-emerald-100 bg-amber-100 bg-rose-100 bg-white');
    const val = $(el).val();
    if (val === 'S') $(el).addClass('bg-emerald-100');
    else if (val === 'I') $(el).addClass('bg-amber-100');
    else if (val === 'R') $(el).addClass('bg-rose-100');
    else $(el).addClass('bg-white');
}

function togglePrintSection(id) {
    const el = document.getElementById(id);
    if (el.classList.contains('print-hidden')) { el.classList.remove('print-hidden'); el.classList.remove('print-fade'); } 
    else { el.classList.add('print-hidden'); el.classList.add('print-fade'); }
}

function triggerDataExtractor() { document.getElementById('extractorFileInput').click(); }

async function processDataExtraction(event) {
    const file = event.target.files[0];
    if (!file) return;
    Swal.fire({ title: 'Processing File...', text: 'Loading dictionaries and extracting records...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    let externalOrgMap = {};
    try { const response = await fetch('organisms_dictionary.json'); if (response.ok) { const jsonDict = await response.json(); Object.keys(jsonDict).forEach(key => { externalOrgMap[key.toLowerCase()] = jsonDict[key]; }); } } catch (error) { console.warn("Error fetching organism dict"); }
    let externalSpecimenMap = {};
    try { const response = await fetch('specimens_dictionary.json'); if (response.ok) { const jsonDict = await response.json(); Object.keys(jsonDict).forEach(key => { externalSpecimenMap[key.toLowerCase()] = jsonDict[key]; }); } } catch (error) { console.warn("Error fetching specimen dict"); }

    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const arrayBuffer = e.target.result;
                const workbook = await XlsxPopulate.fromDataAsync(arrayBuffer);
                const values = workbook.sheet(0).usedRange().value();
                const rawData = values.map(row => row.map(cell => cell != null ? String(cell).trim() : ""));
                parseAndInjectData(rawData, externalOrgMap, externalSpecimenMap, event);
            } catch (err) { Swal.fire('Error', 'Failed to read Excel file.', 'error'); event.target.value = ''; }
        };
        reader.readAsArrayBuffer(file);
    } else {
        const reader = new FileReader();
        reader.onload = e => {
            const text = e.target.result;
            const lines = text.split(/\r?\n/);
            if(lines.length < 2) { Swal.fire('Error', 'File is empty.', 'error'); event.target.value = ''; return; }
            let separator = lines[0].split('\t').length <= 1 ? ',' : '\t';
            const rawData = lines.filter(line => line.trim() !== '').map(line => line.split(separator).map(c => c.trim()));
            parseAndInjectData(rawData, externalOrgMap, externalSpecimenMap, event);
        };
        reader.readAsText(file);
    }
}

function parseAndInjectData(rawData, externalOrgMap, externalSpecimenMap, event) {
    if (!rawData || rawData.length < 2) { Swal.fire('Error', 'No valid data.', 'error'); event.target.value = ''; return; }
    const actualHeaders = rawData[0].map(h => h.toLowerCase());
    const idxFName = actualHeaders.findIndex(h => h === 'first_name' || h === 'first name' || h === 'patient_name');
    const idxLName = actualHeaders.findIndex(h => h === 'last_name' || h === 'last name');
    const idxAge = actualHeaders.findIndex(h => h === 'age');
    const idxSex = actualHeaders.findIndex(h => h === 'sex' || h === 'gender');
    const idxWard = actualHeaders.findIndex(h => h === 'ward' || h === 'location' || h === 'department');
    const idxSample = actualHeaders.findIndex(h => h === 'specimen' || h === 'sample' || h === 'spec_type' || h === 'specimen type');
    const idxDate = actualHeaders.findIndex(h => h === 'spec_date' || h === 'specimen date' || h === 'date');
    const idxOrg = actualHeaders.findIndex(h => h === 'organism' || h === 'org');

    const abxColumns = [];
    const allPossibleAbxs = [...abxList, ...getCustomAntibiotics().map(a=>a.name)];
    
    for(let i = 0; i < actualHeaders.length; i++) {
        let h = actualHeaders[i].toLowerCase();
        let matchedName = allPossibleAbxs.find(a => a.toLowerCase() === h);
        if(matchedName) abxColumns.push({ index: i, name: matchedName });
    }

    let records = JSON.parse(localStorage.getItem('amr_records')) || [];
    let addedCount = 0; let skippedCount = 0;

    for(let i = 1; i < rawData.length; i++) {
        const cols = rawData[i];
        let orgCode = idxOrg > -1 && cols[idxOrg] ? cols[idxOrg].toLowerCase() : "";
        if(!orgCode || orgCode === 'xxx' || orgCode === 'con' || orgCode === 'no growth') { skippedCount++; continue; }

        let hasSRIData = false; let abxResults = {};
        abxColumns.forEach(abx => {
            let val = cols[abx.index] ? String(cols[abx.index]).trim().toUpperCase() : "";
            if (val === 'S' || val === 'I' || val === 'R') { hasSRIData = true; abxResults[abx.name] = val; }
        });
        if (!hasSRIData) { skippedCount++; continue; }

        let rawDate = idxDate > -1 && cols[idxDate] ? String(cols[idxDate]).trim() : "";
        let formattedDate = ""; 
        if(rawDate) {
            let dateParts = rawDate.split(/[\/\-]/);
            if(dateParts.length >= 3) {
                let month = dateParts[1].padStart(2, '0');
                let year = dateParts[2].split(' ')[0]; 
                if(year.length === 2) year = "20" + year;
                formattedDate = `${year}-${month}`;
            } else {
                let d = new Date(rawDate);
                if(!isNaN(d)) formattedDate = d.toISOString().slice(0, 7);
            }
        }
        if(!formattedDate) { skippedCount++; continue; }

        let fullOrgName = externalOrgMap[orgCode] || (orgCode.charAt(0).toUpperCase() + orgCode.slice(1));
        let record = {
            'Name': (cols[idxFName] || "Unknown").trim(), 'Age': parseInt(cols[idxAge]) || "", 'Age Unit': "Years",
            'Sex': (cols[idxSex] || "").toLowerCase().startsWith('f') ? "Female" : "Male",
            'Ward': cols[idxWard] || "-", 'Sample': cols[idxSample] || "-", 'Date': formattedDate,
            'Selective organism': fullOrgName, 'Antibiogram organism': fullOrgName 
        };
        Object.assign(record, abxResults);
        records.push(record);
        addedCount++;
    }

    localStorage.setItem('amr_records', JSON.stringify(records));
    initDataTable();
    if (typeof syncLocalToCloud === "function" && navigator.onLine) syncLocalToCloud();
    if (!$('#viewAnalytics').hasClass('hidden')) loadAnalyticsFilters();
    Swal.fire('Success!', `Extraction complete: ${addedCount} isolates added.`, 'success');
    event.target.value = ''; 
}

$(document).ready(function() {
    runDatabaseMigration();
    loadBacteriaOptions(); loadSampleOptions(); loadWardOptions(); renderDefaultAntibiotics();
    $('#default_abx_container').on('change', '.default-abx-select', function() { updateAbxColor(this); });
    $('.select2-enable').select2({ width: '100\%', dropdownParent:$('#formModal') });
    $('#p_sample').select2({ width: '100\%', dropdownParent: $('#formModal'), tags: true });
    $('#p_ward').select2({ width: '100\%', dropdownParent: $('#formModal'), tags: true });
    $('#p_organism').select2({ width: '100\%', dropdownParent: $('#formModal'), tags: true });
    $('.select2-multiple').select2({ width: '100%' }); $('.select2-basic').select2({ width: '100\%' });$('#p_date').val(new Date().toISOString().slice(0, 7));
    let currentYear = new Date().getFullYear();
    $('#ana_start').val(`${currentYear}-01-01`); $('#ana_end').val(`${currentYear}-12-31`);

    loadAnalyticsFilters();
    $('#ana_start, #ana_end, #ana_sample').on('change', function() { loadAnalyticsFilters(); });
    initDataTable();
});

function showTab(tabName) {
    $('#viewRecords, #viewAnalytics, #viewLive').addClass('hidden');
    $('#btnTabRecords, #btnTabAnalytics, #btnTabLive').removeClass('bg-teal-600 bg-rose-600 text-white border-teal-400 border-rose-400').addClass('bg-white/10 text-teal-50 border-teal-500/30');
    if (tabName === 'records') {
        $('#viewRecords').removeClass('hidden'); $('#btnTabRecords').addClass('bg-teal-600 text-white border-teal-400');
    } else if (tabName === 'analytics') {
        loadAnalyticsFilters(); $('#viewAnalytics').removeClass('hidden'); $('#btnTabAnalytics').addClass('bg-teal-600 text-white border-teal-400');
    } else if (tabName === 'live') {
        $('#viewLive').removeClass('hidden'); $('#btnTabLive').addClass('bg-rose-600 text-white border-rose-400');
    }
}

function loadAnalyticsFilters() {
    if (isUpdatingFilters) return;
    isUpdatingFilters = true;
    const startDate = $('#ana_start').val(); const endDate = $('#ana_end').val(); const targetSample = $('#ana_sample').val();
    let allRecords = JSON.parse(localStorage.getItem('amr_records')) || [];
    
    let dateFilteredRecords = allRecords.filter(r => {
        if(!startDate || !endDate) return true;
        return r.Date >= startDate && r.Date <= endDate;
    });

    let uniqueSamples = new Set(dateFilteredRecords.map(r => r.Sample).filter(Boolean));
    let currentSample = $('#ana_sample').val(); 
    $('#ana_sample').empty().append(new Option("All Specimens", ""));
    Array.from(uniqueSamples).sort().forEach(s => $('#ana_sample').append(new Option(s, s)));
    if (currentSample && uniqueSamples.has(currentSample)) $('#ana_sample').val(currentSample);

    let finalRecords = targetSample ? dateFilteredRecords.filter(r => r.Sample === targetSample) : dateFilteredRecords;
    let orgs = new Set(), abxs = new Set();
    let allPossibleAbxs = [...abxList, ...getCustomAntibiotics().map(a=>a.name)];

    finalRecords.forEach(r => {
        if(r['Selective organism']) orgs.add(r['Selective organism']);
        allPossibleAbxs.forEach(a => { if (r[a] && r[a] !== '-' && r[a] !== '') abxs.add(a); });
    });

    let currentOrgs = $('#ana_organism').val() || [];
    $('#ana_organism').empty(); Array.from(orgs).sort().forEach(o => $('#ana_organism').append(new Option(o, o, currentOrgs.includes(o), currentOrgs.includes(o))));

    let currentAbxs = $('#ana_antibiotic').val() || [];
    $('#ana_antibiotic').empty(); Array.from(abxs).sort().forEach(a => $('#ana_antibiotic').append(new Option(a, a, currentAbxs.includes(a), currentAbxs.includes(a))));
    
    $('#ana_sample, #ana_organism, #ana_antibiotic').trigger('change.select2');
    isUpdatingFilters = false;
}

function initDataTable() {
    let records = JSON.parse(localStorage.getItem('amr_records')) || [];
    let cols = [
        { data: null, title: 'Action', orderable: false, render: function(data, type, row, meta) { return `<div class="flex gap-2"><button onclick="editRecord(${meta.row})" class="bg-amber-400 hover:bg-amber-500 text-white px-3 py-1 rounded-md text-xs font-bold">Edit</button><button onclick="deleteRecord(${meta.row})" class="bg-rose-500 hover:bg-rose-600 text-white px-3 py-1 rounded-md text-xs font-bold">Delete</button></div>`; }},
        { data: 'Name', title: 'Name' },
        { data: null, title: 'Age', render: function(data, type, row) { return row['Age'] ? row['Age'] + ' ' + (row['Age Unit'] || '') : '-'; }},
        { data: 'Sex', title: 'Sex' }, { data: 'Ward', title: 'Ward' }, { data: 'Sample', title: 'Sample' }, { data: 'Date', title: 'Date' }, { data: 'Selective organism', title: 'Selective organism' }
    ];

    [...abxList, ...getCustomAntibiotics().map(a=>a.name)].forEach(abx => cols.push({ data: abx, title: abx, defaultContent: '-' }));

    if ($.fn.DataTable.isDataTable('#recordsTable')) { $('#recordsTable').DataTable().destroy(); $('#recordsTable').empty(); }

    dataTable = $('#recordsTable').DataTable({
        data: records, columns: cols, scrollX: true, deferRender: true, order: [[ 6, "desc" ]], stateSave: true,
        dom: '<"flex flex-col sm:flex-row justify-between items-center mb-4 gap-3"Bf>rt<"flex flex-col sm:flex-row justify-between items-center mt-4 gap-3"ip>',
        buttons: [{ extend: 'excelHtml5', text: 'Export to Excel' }, { extend: 'print', text: 'Print' }],
        pageLength: 15, language: { search: "", searchPlaceholder: "Search records..." }
    });
}

function openModal() {
    $('#entryForm')[0].reset(); $('#editIndex').val('-1'); $('#p_date').val(new Date().toISOString().slice(0, 7)); $('#active_abx_container').empty(); selectedAbxMap = {};
    $('#p_ward, #p_sex, #p_sample, #p_organism, #p_antibiogram_org').val(null).trigger('change');
    $('.default-abx-select').each(function() {$(this).val('').trigger('change'); updateAbxColor(this); });
    $('#modalTitle').text('Add New Patient Record'); $('#formModal').removeClass('hidden');
}

function closeModal() { $('#formModal').addClass('hidden'); }

let selectedAbxMap = {};
function addAntibiotic(abxName = null, result = 'S') {
    const abx = abxName || $('#abx_selector').val(); if(!abx) return;
    let isDefault = false;
    $(`.default-abx-select[data-abx="${$.escapeSelector(abx)}"]`).each(function() { $(this).val(result).trigger('change'); isDefault = true; });
    if (isDefault) { $('#abx_selector').val(null).trigger('change'); return; }
    if (selectedAbxMap[abx]) return; 
    selectedAbxMap[abx] = result;
    const safeId = abx.replace(/[^a-zA-Z0-9\s]/g, '_').trim();
    $('#active_abx_container').append(`<div id="row_${safeId}" class="flex justify-between bg-white border rounded p-3"><span class="text-sm font-semibold truncate">${abx}</span><select class="border rounded p-1 text-sm bg-gray-50" onchange="updateAbxResult('${abx}', this.value)"><option value="S" ${result==='S'?'selected':''}>S</option><option value="I" ${result==='I'?'selected':''}>I</option><option value="R" ${result==='R'?'selected':''}>R</option></select><button type="button" onclick="removeAntibiotic('${abx}', '${safeId}')" class="text-red-400 font-bold px-2">&times;</button></div>`);
    $('#abx_selector').val(null).trigger('change');
}

function updateAbxResult(abx, val) { selectedAbxMap[abx] = val; }
function removeAntibiotic(abx, safeId) { delete selectedAbxMap[abx]; $(`#row_${safeId}`).remove(); }

$('#entryForm').submit(function(e) {
    e.preventDefault();
    let currentSample = $('#p_sample').val(); let savedSamples = JSON.parse(localStorage.getItem('amr_samples')) || defaultSamples;
    if (currentSample && !savedSamples.includes(currentSample)) { savedSamples.push(currentSample); localStorage.setItem('amr_samples', JSON.stringify(savedSamples)); }
    let currentWard = $('#p_ward').val(); let savedWards = JSON.parse(localStorage.getItem('amr_wards')) || defaultWards;
    if (currentWard && !savedWards.includes(currentWard)) { savedWards.push(currentWard); localStorage.setItem('amr_wards', JSON.stringify(savedWards)); }
    let currentOrganism = $('#p_organism').val(); let savedOrgs = JSON.parse(localStorage.getItem('amr_organisms')) || [];
    if (currentOrganism && !savedOrgs.includes(currentOrganism)) { savedOrgs.push(currentOrganism); localStorage.setItem('amr_organisms', JSON.stringify(savedOrgs)); }

    let record = { 'Name': $('#p_name').val(), 'Age': $('#p_age').val(), 'Age Unit': $('#p_age_unit').val(), 'Sex': $('#p_sex').val(), 'Ward': currentWard \vert{}\vert{} "-", 'Sample': currentSample, 'Date': $('#p_date').val(), 'Selective organism': currentOrganism, 'Antibiogram organism': $('#p_antibiogram_org').val() };
    Object.keys(selectedAbxMap).forEach(abx => record[abx] = selectedAbxMap[abx]);
    $('.default-abx-select').each(function() { if ($(this).val()) record[$(this).attr('data-abx')] =$(this).val(); });

    let records = JSON.parse(localStorage.getItem('amr_records')) || [];
    let editIndex = $('#editIndex').val();
    if (editIndex > -1) records[editIndex] = record; else records.push(record);

    localStorage.setItem('amr_records', JSON.stringify(records));
    closeModal(); initDataTable(); if(!$('#viewAnalytics').hasClass('hidden')) loadAnalyticsFilters();
    if (navigator.onLine) syncLocalToCloud();
    Swal.fire({ icon: 'success', title: 'Saved!', timer: 1500, showConfirmButton: false });
});

function editRecord(index) {
    let records = JSON.parse(localStorage.getItem('amr_records')) || [];
    let record = records[index]; openModal(); $('#modalTitle').text('Edit Record'); $('#editIndex').val(index);
    $('#p_name').val(record['Name']); $('#p_age').val(record['Age']); $('#p_sex').val(record['Sex']).trigger('change');
    if(record['Ward']) $('#p_ward').append(new Option(record['Ward'], record['Ward'], true, true)).trigger('change');
    if(record['Sample']) $('#p_sample').append(new Option(record['Sample'], record['Sample'], true, true)).trigger('change');
    $('#p_date').val(record['Date'] ? record['Date'].substring(0, 7) : '');
    if(record['Selective organism']) $('#p_organism').append(new Option(record['Selective organism'], record['Selective organism'], true, true)).trigger('change');
    $('#p_antibiogram_org').val(record['Antibiogram organism'] || '').trigger('change');
    const stdProps = ['Name', 'Age', 'Age Unit', 'Sex', 'Ward', 'Sample', 'Date', 'Selective organism', 'Antibiogram organism'];
    Object.keys(record).forEach(key => {
        if (!stdProps.includes(key) && record[key] && record[key] !== '-') {
            let sel = $(`.default-abx-select[data-abx="${$.escapeSelector(key)}"]`);
            if (sel.length > 0) sel.val(record[key]).trigger('change'); else addAntibiotic(key, record[key]);
        }
    });
}

function deleteRecord(index) {
    Swal.fire({ title: 'Are you sure?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#e11d48', confirmButtonText: 'Yes, delete it!' }).then((result) => {
        if (result.isConfirmed) {
            let records = JSON.parse(localStorage.getItem('amr_records')) || [];
            records.splice(index, 1); localStorage.setItem('amr_records', JSON.stringify(records));
            initDataTable(); if (navigator.onLine) syncLocalToCloud(); Swal.fire('Deleted!', '', 'success');
        }
    });
}

function wilsonScoreCI(r, n) {
    if (n === 0) return { lower: 0, upper: 0 };
    const p = r / n, z2 = 3.8416, denominator = 1 + z2 / n, center = p + z2 / (2 * n), spread = 1.96 * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
    return { lower: Math.max(0, Math.round(((center - spread) / denominator) * 100)), upper: Math.min(100, Math.round(((center + spread) / denominator) * 100)) };
}

window.clearAnalyticsFilters = function() {
    let y = new Date().getFullYear(); $('#ana_start').val(`${y}-01-01`); $('#ana_end').val(`${y}-12-31`);
    $('#ana_sample, #ana_organism, #ana_antibiotic').val(null).trigger('change.select2'); loadAnalyticsFilters();
    $('#analyticsContainer').addClass('hidden'); $('#analyticsPlaceholder').removeClass('hidden');
};

function generateAnalytics() {
    const startDate = $('#ana_start').val(); const endDate = $('#ana_end').val(); const targetSample = $('#ana_sample').val();
    const targetOrgs = $('#ana_organism').val() || []; const targetAbxs = $('#ana_antibiotic').val() || [];
    const metric = $('#ana_metric').val() || 'R'; const metricLabel = metric === 'R' ? 'Resistance' : 'Susceptibility';

    if (!startDate || !endDate) { Swal.fire('Required', 'Please select both dates.', 'warning'); return; }
    let records = (JSON.parse(localStorage.getItem('amr_records')) || []).filter(r => r.Date >= startDate && r.Date <= endDate);
    if (targetSample) records = records.filter(r => r.Sample === targetSample);
    
    if (records.length === 0) {
        $('#analyticsPlaceholder').removeClass('hidden').html('<p class="text-lg font-medium text-slate-500 py-10">No records found.</p>');
        $('#analyticsContainer').addClass('hidden'); return;
    }

    $('#analyticsPlaceholder').addClass('hidden'); $('#analyticsContainer').removeClass('hidden');
    $('#dashTitle').text("Antibiogram Analysis"); $('#dashSubtitle').text(`${startDate} to ${endDate} | Metric: % ${metricLabel}`);

    let orgCounts = {}, specCounts = {}, heatmapStats = {};
    let allPresentOrgs = new Set();
    let allPossibleAbxs = [...abxList, ...getCustomAntibiotics().map(a=>a.name)];

    records.forEach(r => {
        let org = r['Selective organism']; if(!org) return;
        allPresentOrgs.add(org); orgCounts[org] = (orgCounts[org] || 0) + 1;
        if(r.Sample) specCounts[r.Sample] = (specCounts[r.Sample] || 0) + 1;
        if (!heatmapStats[org]) heatmapStats[org] = {};
        allPossibleAbxs.forEach(abx => {
            let res = r[abx];
            if (res && res !== '-' && res !== '') {
                if (!heatmapStats[org][abx]) heatmapStats[org][abx] = { t: 0, r: 0, s: 0 };
                heatmapStats[org][abx].t += 1;
                if (res === 'R') heatmapStats[org][abx].r += 1;
                if (res === 'S') heatmapStats[org][abx].s += 1;
            }
        });
    });

    let amrStats = {}; 
    Array.from(allPresentOrgs).forEach(org => {
        amrStats[org] = { total: orgCounts[org], abx: {} };
        allPossibleAbxs.forEach(a => { amrStats[org].abx[a] = { tested: 0, r: 0, s: 0 }; });
    });

    records.forEach(r => {
        let org = r['Selective organism'];
        allPossibleAbxs.forEach(abx => {
            let res = r[abx];
            if (res && res !== '-' && res !== '') {
                amrStats[org].abx[abx].tested += 1;
                if (res === 'R') amrStats[org].abx[abx].r += 1;
                if (res === 'S') amrStats[org].abx[abx].s += 1;
            }
        });
    });

    let displayOrgs = [], displayAbxs = [];
    if (targetOrgs.length === 0 && targetAbxs.length === 0) { $('#print_sect_amr').addClass('hidden'); } else {
        $('#print_sect_amr').removeClass('hidden');
        if (targetOrgs.length > 0 && targetAbxs.length === 0) {
            displayOrgs = targetOrgs; let foundAbxs = new Set();
            displayOrgs.forEach(org => { if (amrStats[org]) Object.keys(amrStats[org].abx).forEach(abx => { if (amrStats[org].abx[abx].tested > 0) foundAbxs.add(abx); }); });
            displayAbxs = Array.from(foundAbxs).sort();
        } else if (targetOrgs.length === 0 && targetAbxs.length > 0) {
            displayAbxs = targetAbxs; let foundOrgs = new Set();
            Array.from(allPresentOrgs).forEach(org => { displayAbxs.forEach(abx => { if (amrStats[org] && amrStats[org].abx[abx] && amrStats[org].abx[abx].tested > 0) foundOrgs.add(org); }); });
            displayOrgs = Array.from(foundOrgs).sort();
        } else { displayOrgs = targetOrgs; displayAbxs = targetAbxs; }
    }

    let tableHtml = ''; let anyLowReliability = false;
    displayAbxs.forEach((abx, abxIndex) => {
        let palette = extendedPalette[abxIndex % extendedPalette.length];
        displayOrgs.forEach(org => {
            let s = amrStats[org] ? amrStats[org].abx[abx] : null;
            if (s && s.tested > 0) {
                let targetVal = metric === 'R' ? s.r : s.s; let p = Math.round((targetVal / s.tested) * 100);
                let isReliable = s.tested >= 30; if (!isReliable) anyLowReliability = true;
                let ci = wilsonScoreCI(targetVal, s.tested);
                tableHtml += `<tr class="${!isReliable ? 'text-slate-500' : 'font-semibold'}"><td class="px-4 py-2 border-b">${abx}</td><td class="px-4 py-2 border-b">${formatScientificName(org)} ${!isReliable ? '*' : ''}</td><td class="px-4 py-2 border-b text-center">${s.tested}</td><td class="px-4 py-2 border-b text-center">${targetVal}</td><td class="px-4 py-2 border-b text-center">${p}%</td><td class="px-4 py-2 border-b text-center text-slate-500">${ci.lower}% - ${ci.upper}%</td></tr>`;
            }
        });
    });
    if (anyLowReliability) $('#amrClsiWarning').removeClass('hidden'); else $('#amrClsiWarning').addClass('hidden');
    $('#ciTableBody').html(tableHtml);

    let datasets = [];
    let focusOnOrganism = (targetOrgs.length > 0 && targetAbxs.length === 0) || (displayOrgs.length === 1 && displayAbxs.length > 1);
    let primaryItems = focusOnOrganism ? displayOrgs : displayAbxs;
    let secondaryItems = focusOnOrganism ? displayAbxs : displayOrgs;

    if (displayOrgs.length > 0 && displayAbxs.length > 0) {
        primaryItems.forEach((primary, pIndex) => {
            let dataR = [], bgColors = [], ciData = [], nDataArr = []; let hasData = false;
            secondaryItems.forEach((secondary, sIndex) => {
                let palette = extendedPalette[sIndex % extendedPalette.length];
                let org = focusOnOrganism ? primary : secondary; let abx = focusOnOrganism ? secondary : primary;
                let s = amrStats[org] ? amrStats[org].abx[abx] : null;
                if (!s || s.tested === 0) { dataR.push(0); bgColors.push(palette.faded); ciData.push({lower: 0, upper: 0}); nDataArr.push(0); } else {
                    hasData = true; let targetVal = metric === 'R' ? s.r : s.s; let p = Math.round((targetVal / s.tested) * 100);
                    dataR.push(p); bgColors.push(s.tested >= 30 ? palette.bg : '#94a3b8'); ciData.push(wilsonScoreCI(targetVal, s.tested)); nDataArr.push(s.tested);
                }
            });
            if (hasData) datasets.push({ label: formatScientificName(primary), data: dataR, backgroundColor: bgColors, borderRadius: 4, ciData: ciData, nData: nDataArr });
        });
    }

    if (chartAMR_instance) chartAMR_instance.destroy();
    chartAMR_instance = new Chart(document.getElementById('chartAMR'), {
        type: 'bar', data: { labels: secondaryItems.map(item => focusOnOrganism ? item : formatScientificName(item)), datasets: datasets },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } },
        plugins: [errorBarsPlugin]
    });

    let hmOrgs = Object.keys(heatmapStats);
    if (targetOrgs.length > 0) hmOrgs = hmOrgs.filter(o => targetOrgs.includes(o));
    let hmAbxSet = new Set(); hmOrgs.forEach(o => { Object.keys(heatmapStats[o]).forEach(a => { if (heatmapStats[o][a].t > 0) hmAbxSet.add(a); }); });
    let hmAbxs = Array.from(hmAbxSet); if (targetAbxs.length > 0) hmAbxs = hmAbxs.filter(a => targetAbxs.includes(a));
    hmOrgs.sort(); hmAbxs.sort();

    if (hmOrgs.length > 0 && hmAbxs.length > 0) {
        let hmHtml = '<table class="heatmap-table"><thead><tr><th>Organism (n)</th>';
        hmAbxs.forEach(a => { hmHtml += `<th><div class="w-20 truncate">${a}</div></th>`; }); hmHtml += '</tr></thead><tbody>';
        hmOrgs.forEach(o => {
            let orgTotal = orgCounts[o] || 0; hmHtml += `<tr><th>${formatScientificName(o)} (${orgTotal})</th>`;
            hmAbxs.forEach(a => {
                let cell = heatmapStats[o][a];
                if (!cell || cell.t === 0) { hmHtml += '<td class="bg-slate-50">-</td>'; } else {
                    let targetVal = metric === 'R' ? cell.r : cell.s; let p = Math.round((targetVal / cell.t) * 100);
                    let isLow = cell.t < 30; let dangerScore = metric === 'R' ? p : (100 - p);
                    let bgClass = 'bg-white', textClass = 'text-slate-700';
                    if (dangerScore <= 20) { bgClass = 'bg-emerald-100'; textClass = 'text-emerald-800'; }
                    else if (dangerScore <= 40) { bgClass = 'bg-yellow-100'; textClass = 'text-yellow-800'; }
                    else if (dangerScore <= 60) { bgClass = 'bg-orange-200'; textClass = 'text-orange-900'; }
                    else if (dangerScore <= 80) { bgClass = 'bg-red-400'; textClass = 'text-white font-bold'; }
                    else { bgClass = 'bg-red-600'; textClass = 'text-white font-bold'; }
                    hmHtml += `<td class="${bgClass} ${textClass}">${p}% ${isLow ? '*' : ''}</td>`;
                }
            }); hmHtml += '</tr>';
        }); hmHtml += '</tbody></table>'; $('#heatmapWrapper').html(hmHtml);
    } else { $('#heatmapWrapper').html('<p class="text-center py-4">No data matches.</p>'); }

    let sortedOrgs = Object.keys(orgCounts).sort((a,b)=>orgCounts[b]-orgCounts[a]).slice(0, 10);
    if(chartOrg_instance) chartOrg_instance.destroy();
    chartOrg_instance = new Chart(document.getElementById('chartOrg'), { type: 'doughnut', data: { labels: sortedOrgs.map(o => formatScientificName(o)), datasets: [{ data: sortedOrgs.map(o=>orgCounts[o]), backgroundColor: ['#0d9488','#0ea5e9','#3b82f6','#06b6d4','#14b8a6','#10b981','#84cc16','#eab308','#f59e0b','#f97316'] }] }, options: { responsive: true, maintainAspectRatio: false } });
}

// Convert Text to Excel
function convertTextToExcel() {
    const fileInput = document.getElementById('converterFileInput'); const statusDiv = document.getElementById('converterStatus');
    if (!fileInput.files.length) { statusDiv.className = 'text-xs font-bold mt-3 text-red-500 block'; statusDiv.innerText = "⚠️ Please select a file first!"; return; }
    statusDiv.className = 'text-xs font-bold mt-3 text-amber-500 block'; statusDiv.innerText = "⏳ Converting...";
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const text = e.target.result; const delimiter = text.indexOf('\t') !== -1 ? '\t' : ',';
            const rows = text.split('\n').map(row => row.split(delimiter));
            const wb = XLSX.utils.book_new(); const ws = XLSX.utils.aoa_to_sheet(rows); XLSX.utils.book_append_sheet(wb, ws, "AMR Data");
            XLSX.writeFile(wb, fileInput.files[0].name.replace(/\.[^/.]+$/, "") + "_Converted.xlsx");
            statusDiv.className = 'text-xs font-bold mt-3 text-emerald-600 block'; statusDiv.innerText = "✅ Success! File downloaded."; setTimeout(() => { fileInput.value = ''; }, 2000);
        } catch (err) { statusDiv.className = 'text-xs font-bold mt-3 text-red-500 block'; statusDiv.innerText = "❌ Error occurred."; }
    };
    reader.readAsText(fileInput.files[0]);
}

function showExportModal() {
    Swal.fire({
        title: 'Export Official Antibiogram',
        html: `
            <div class="text-left space-y-4">
                <div class="flex gap-4">
                    <div class="flex-1"><label class="block text-sm font-bold text-slate-700 mb-1">Year</label><select id="export_year" class="w-full border border-slate-300 p-2.5 rounded-lg outline-none"><option value="2026">2026</option></select></div>
                    <div class="flex-1"><label class="block text-sm font-bold text-slate-700 mb-1">Quarter</label><select id="export_quarter" class="w-full border border-slate-300 p-2.5 rounded-lg outline-none"><option value="Q1">Q1</option><option value="Q2">Q2</option><option value="Q3">Q3</option><option value="Q4">Q4</option></select></div>
                </div>
            </div>
        `,
        showCancelButton: true, confirmButtonText: '📥 Download Excel', confirmButtonColor: '#10b981',
        preConfirm: () => { return { year: document.getElementById('export_year').value, quarter: document.getElementById('export_quarter').value }; }
    }).then((result) => { if (result.isConfirmed) processAntibiogramExport(result.value.year, result.value.quarter); });
}

async function processAntibiogramExport(year, quarter) {
    Swal.fire('Info', 'Export requires Antibiogram_5.xlsx template in your root directory. Ensure logic matches your local setup.', 'info');
}

window.downloadBackup = function() {
    const data = { amr_records: JSON.parse(localStorage.getItem('amr_records')) || [], amr_samples: JSON.parse(localStorage.getItem('amr_samples')) || [], amr_wards: JSON.parse(localStorage.getItem('amr_wards')) || [], amr_organisms: JSON.parse(localStorage.getItem('amr_organisms')) || [], amr_custom_abx_v2: JSON.parse(localStorage.getItem('amr_custom_abx_v2')) || [], amr_live_settings: JSON.parse(localStorage.getItem('amr_live_settings')) || null };
    saveAs(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `AMR_Backup_${new Date().toISOString().split('T')[0]}.json`);
};

window.processRestore = function() {
    const file = document.getElementById('backupFileInput').files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (!importedData.amr_records) throw new Error("Invalid structure.");
            localStorage.setItem('amr_records', JSON.stringify(importedData.amr_records));
            if (importedData.amr_live_settings) localStorage.setItem('amr_live_settings', JSON.stringify(importedData.amr_live_settings));
            initDataTable(); if (navigator.onLine) syncLocalToCloud(); Swal.fire('Restored!', 'Data restored.', 'success');
        } catch (err) { Swal.fire('Error', 'Corrupted file.', 'error'); }
    }; reader.readAsText(file);
};
