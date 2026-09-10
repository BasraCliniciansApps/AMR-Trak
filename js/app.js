let dataTable;
let chartAMR_instance = null;
let chartOrg_instance = null;
let chartSpec_instance = null;
let chartGen_instance = null;
let chartTrend_instance = null;
let isUpdatingFilters = false;

// --- Migration Script to update old records to new clean names ---
function runDatabaseMigration() {
    let records = JSON.parse(localStorage.getItem('amr_records')) || [];
    let migrated = false;
    
    // تحويل الاسم القديم للإيكولاي إلى الاسم الجديد في السجلات السابقة تلقائياً
    records.forEach(r => {
        if (r['Selective organism'] === "Escherichia coli (E.coli)") {
            r['Selective organism'] = "Escherichia coli";
            migrated = true;
        }
        if (r['Antibiogram organism'] === "Escherichia coli (E.coli)") {
            r['Antibiogram organism'] = "Escherichia coli";
            migrated = true;
        }
    });

    const migrationMap = {
        "Ampicillin (AM)": "Ampicillin",
        "Flouxacillin": "Flucloxacillin",
        "Penicillin (P)": "Penicillin",
        "Ampicillin/Salbactam (SAM)": "Ampicillin/Sulbactam",
        "Amoxicillin/ Salbactam": "Amoxicillin/Sulbactam",
        "Oxacillin (OX)": "Oxacillin",
        "Amoxicillin/ Clavulonic acid (AMC)": "Amoxicillin/Clavulanic acid",
        "Piperacillin (PR)": "Piperacillin",
        "Ticarcillin (TIC)": "Ticarcillin",
        "Ticarcillin/Clavulonic acid (TIM)": "Ticarcillin/Clavulanic acid",
        "Piperacillin / Tazobactam (TPZ)": "Piperacillin/Tazobactam",
        "Ceftriaxone (CRO)": "Ceftriaxone",
        "Cefotaxim (CTX)": "Cefotaxime",
        "Ceftazidime (CAZ)": "Ceftazidime",
        "Cefepime (FEP)": "Cefepime",
        "Cefixime (CFM)": "Cefixime",
        "Cefuroxime (CXM)": "Cefuroxime",
        "Amikacin (AK)": "Amikacin",
        "Gentamicin (CN)": "Gentamicin",
        "Tobramycin (TOB)": "Tobramycin",
        "Netlimicin (NET)": "Netilmicin",
        "Imipenem (IMP)": "Imipenem",
        "Meropenem (MEM)": "Meropenem",
        "Aztreonam (ATM)": "Aztreonam",
        "Azithromycin (AZM)": "Azithromycin",
        "Clarithromycin (CLR)": "Clarithromycin",
        "Erythromycin (E)": "Erythromycin",
        "Ciprofloxacin (CIP)": "Ciprofloxacin",
        "Levofloxacin (LEV)": "Levofloxacin",
        "Vancomycin (VA)": "Vancomycin",
        "Tetracycline (TE)": "Tetracycline",
        "Doxacycline(DO)": "Doxycycline",
        "Trimethoprim/Sulfamethoxazole (TXS)": "Trimethoprim/Sulfamethoxazole",
        "Rifampicin (RA)": "Rifampicin",
        "Nitrofurantoin (F)": "Nitrofurantoin",
        "Trimethoprim (TIM)": "Trimethoprim",
        "Fosfomycin (FOS)": "Fosfomycin",
        "Clindamycin (DA)": "Clindamycin",
        "Fucidin": "Fusidic acid",
        "Doxacycline": "Doxycycline",
        "Nalidixic acid (NA)": "Nalidixic acid",
        "Ofloxacin (OFX)": "Ofloxacin",
        "Norfloxacin (ROR)": "Norfloxacin"
    };

    records.forEach(r => {
        Object.keys(migrationMap).forEach(oldKey => {
            if (r[oldKey] !== undefined) {
                r[migrationMap[oldKey]] = r[oldKey];
                delete r[oldKey];
                migrated = true;
            }
        });
    });

    if (migrated) {
        localStorage.setItem('amr_records', JSON.stringify(records));
    }
}

// --- 2. Custom Database Logic ---
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
    if (el.classList.contains('print-hidden')) {
        el.classList.remove('print-hidden');
        el.classList.remove('print-fade');
    } else {
        el.classList.add('print-hidden');
        el.classList.add('print-fade');
    }
}

// --- WHONET DATA EXTRACTOR & INJECTOR ---
function triggerDataExtractor() {
    document.getElementById('extractorFileInput').click();
}

async function processDataExtraction(event) {
    const file = event.target.files[0];
    if (!file) return;

    Swal.fire({ title: 'Processing File...', text: 'Loading dictionaries and extracting records...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    // 1. Fetch the external organisms dictionary JSON file
    let externalOrgMap = {};
    try {
        const response = await fetch('organisms_dictionary.json');
        if (response.ok) {
            const jsonDict = await response.json();
            Object.keys(jsonDict).forEach(key => {
                externalOrgMap[key.toLowerCase()] = jsonDict[key];
            });
        } else {
            console.warn("organisms_dictionary.json not found on server, continuing with internal mapping.");
        }
    } catch (error) {
        console.warn("Could not fetch organisms_dictionary.json.");
    }

    // 2. Fetch the external specimens dictionary JSON file (New Integration)
    let externalSpecimenMap = {};
    try {
        const response = await fetch('specimens_dictionary.json');
        if (response.ok) {
            const jsonDict = await response.json();
            Object.keys(jsonDict).forEach(key => {
                externalSpecimenMap[key.toLowerCase()] = jsonDict[key];
            });
        } else {
            console.warn("specimens_dictionary.json not found on server, continuing with internal fallback mapping.");
        }
    } catch (error) {
        console.warn("Could not fetch specimens_dictionary.json.");
    }

    const reader = new FileReader();
    reader.onload = e => {
        const text = e.target.result;
        const lines = text.split(/\r?\n/);
        if(lines.length < 2) {
            Swal.fire('Error', 'File appears to be empty or invalid.', 'error');
            return;
        }

        let separator = '\t';
        if(lines[0].split('\t').length <= 1) { separator = ','; }
        const actualHeaders = lines[0].split(separator).map(h => h.trim().toLowerCase());

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
        
        const whonetAbxMap = {
            "amp": "Ampicillin", "amc": "Amoxicillin/Clavulanic acid", "amx": "Amoxicillin",
            "sam": "Ampicillin/Sulbactam", "tzp": "Piperacillin/Tazobactam", "pip": "Piperacillin",
            "pen": "Penicillin", "oxc": "Oxacillin", "fox": "Cefoxitin",
            "czz": "Cefazolin", "cxm": "Cefuroxime", "cro": "Ceftriaxone",
            "ctx": "Cefotaxime", "caz": "Ceftazidime", "fep": "Cefepime",
            "ipm": "Imipenem", "mem": "Meropenem", "etp": "Ertapenem",
            "atm": "Aztreonam", "ami": "Amikacin", "gen": "Gentamicin",
            "tob": "Tobramycin", "cip": "Ciprofloxacin", "lev": "Levofloxacin",
            "mox": "Moxifloxacin", "ery": "Erythromycin", "azi": "Azithromycin",
            "clr": "Clarithromycin", "cli": "Clindamycin", "van": "Vancomycin",
            "tec": "Teicoplanin", "tcy": "Tetracycline", "dox": "Doxycycline",
            "tgc": "Tigecycline", "sxt": "Trimethoprim/Sulfamethoxazole",
            "nit": "Nitrofurantoin", "fos": "Fosfomycin", "col": "Colistin",
            "lnz": "Linezolid", "rif": "Rifampicin"
        };

        for(let i = 0; i < actualHeaders.length; i++) {
            let h = actualHeaders[i].toLowerCase();
            let matchedName = null;
            if (whonetAbxMap[h]) {
                matchedName = whonetAbxMap[h];
            } else if (h.includes('_nd') || h.includes('_nm')) {
                let prefix = h.split('_')[0];
                if (whonetAbxMap[prefix]) matchedName = whonetAbxMap[prefix];
            } else {
                let directMatch = allPossibleAbxs.find(a => a.toLowerCase() === h);
                if(directMatch) matchedName = directMatch;
            }

            if(matchedName) {
                abxColumns.push({ index: i, name: matchedName });
            }
        }

        let records = JSON.parse(localStorage.getItem('amr_records')) || [];
        let addedCount = 0;
        let skippedCount = 0;

        const wardMap = {
            'ped': 'Pediatrics', 'ped in': 'Pediatrics',
            'icu': 'ICU', 'ccu': 'Resuscitation / CCU', 'eme': 'Resuscitation / CCU',
            'sur': 'General Surgery', 'sur in': 'General Surgery',
            'med': 'Internal Medicine', 'med in': 'Internal Medicine',
            'neo': 'Neonatal Unit', 'neo in': 'Neonatal Unit',
            'neu in': 'Neurology & Neurosurgery',
            'out': 'Outpatient',
            'obg': 'General Obstetrics & Gynecology', 'obg in': 'General Obstetrics & Gynecology',
            'ent': 'ENT'
        };

        for(let i = 1; i < lines.length; i++) {
            if(!lines[i].trim()) continue;
            const cols = lines[i].split(separator).map(c => c.trim());

            let orgCode = idxOrg > -1 && cols[idxOrg] ? cols[idxOrg].toLowerCase() : "";
            if(!orgCode || orgCode === 'xxx' || orgCode === 'con' || orgCode === 'no growth') {
                skippedCount++;
                continue;
            }

            let hasSRIData = false;
            let abxResults = {};
            
            abxColumns.forEach(abx => {
                let val = cols[abx.index] ? cols[abx.index].trim().toUpperCase() : "";
                if (val === 'S' || val === 'I' || val === 'R') {
                    hasSRIData = true;
                    abxResults[abx.name] = val;
                } else if (val.startsWith('S') || val.startsWith('I') || val.startsWith('R')) {
                    hasSRIData = true;
                    abxResults[abx.name] = val.charAt(0);
                }
            });

            if (!hasSRIData) {
                skippedCount++;
                continue;
            }

            let fName = idxFName > -1 && cols[idxFName] ? cols[idxFName] : "";
            let lName = idxLName > -1 && cols[idxLName] ? cols[idxLName] : "";
            let name = (fName + " " + lName).trim() || "Unknown Patient";

            let rawAge = idxAge > -1 && cols[idxAge] ? cols[idxAge] : "";
            let ageNum = parseInt(rawAge) || "";
            let ageUnit = "Years";
            if(rawAge.toLowerCase().includes('m')) ageUnit = "Months";
            if(rawAge.toLowerCase().includes('d')) ageUnit = "Days";

            let rawSex = idxSex > -1 && cols[idxSex] ? cols[idxSex].toLowerCase() : "";
            let sex = rawSex.startsWith('f') ? "Female" : "Male";

            let rawWard = idxWard > -1 && cols[idxWard] ? cols[idxWard].toLowerCase() : "";
            let ward = wardMap[rawWard] || (rawWard ? rawWard.charAt(0).toUpperCase() + rawWard.slice(1) : "-");

            // قراءة اسم العينة من القاموس المرفوع
            let rawSample = idxSample > -1 && cols[idxSample] ? cols[idxSample].toLowerCase() : "";
            let sample = externalSpecimenMap[rawSample] || (rawSample ? rawSample.charAt(0).toUpperCase() + rawSample.slice(1) : "-");

            let rawDate = idxDate > -1 && cols[idxDate] ? cols[idxDate].trim() : "";
            let formattedDate = ""; 
            
            if(rawDate) {
                let dateParts = rawDate.split(/[\/\-]/);
                
                if(dateParts.length >= 3) {
                    let part1 = dateParts[0];
                    let part2 = dateParts[1].padStart(2, '0');
                    let part3 = dateParts[2].split(' ')[0]; 
                    
                    let year, month;
                    if(part1.length === 4) {
                        year = part1;
                        month = part2;
                    } else {
                        year = part3;
                        if(year.length === 2) year = "20" + year;
                        month = part2;
                    }
                    formattedDate = `${year}-${month}`;
                } else {
                    let d = new Date(rawDate);
                    if(!isNaN(d)) formattedDate = d.toISOString().slice(0, 7);
                }
            }

            if(!formattedDate) {
                skippedCount++;
                continue;
            }

            let fullOrgName = externalOrgMap[orgCode] || whonetOrgMap[orgCode] || (orgCode.charAt(0).toUpperCase() + orgCode.slice(1));
                    
            const orgNameCleanup = {
                "Escherichia coli (E.coli)": "Escherichia coli",
                "Klebsiella pneumoniae ss. pneumoniae": "Klebsiella pneumoniae",
                "Staphylococcus aureus ss. aureus": "Staphylococcus aureus",
                "Staphylococcus hominis ss. hominis": "Staphylococcus hominis",
                "Staphylococcus capitis ss. capitis": "Staphylococcus capitis",
                "Staphylococcus saprophyticus ss. saprophyticus": "Staphylococcus saprophyticus"
            };

            if (orgNameCleanup[fullOrgName]) {
                fullOrgName = orgNameCleanup[fullOrgName];
            }

            let record = {
                'Name': name,
                'Age': ageNum,
                'Age Unit': ageUnit,
                'Sex': sex,
                'Ward': ward,
                'Sample': sample,
                'Date': formattedDate,
                'Selective organism': fullOrgName,
                'Antibiogram organism': fullOrgName 
            };

            Object.assign(record, abxResults);

            records.push(record);
            addedCount++;
        }

        localStorage.setItem('amr_records', JSON.stringify(records));
        
        initDataTable();
        if(!$('#viewAnalytics').hasClass('hidden')) loadAnalyticsFilters();
        
        Swal.fire('Success!', `Extraction complete: ${addedCount} isolates added.\nIgnored ${skippedCount} samples (No growth or invalid date).`, 'success');
        event.target.value = ''; 
    };
    reader.readAsText(file);
}

// --- 3. Initialization ---
$(document).ready(function() {
    runDatabaseMigration();

    let oldCustom = JSON.parse(localStorage.getItem('amr_custom_abx'));
    if (oldCustom && oldCustom.length > 0 && typeof oldCustom[0] === 'string') {
        let migrated = oldCustom.map(a => ({ name: a, group: 'Others' }));
        localStorage.setItem('amr_custom_abx_v2', JSON.stringify(migrated));
        localStorage.removeItem('amr_custom_abx');
    }

    loadBacteriaOptions();
    loadSampleOptions();
    loadWardOptions();
    
    renderDefaultAntibiotics();

    $('#default_abx_container').on('change', '.default-abx-select', function() {
        updateAbxColor(this);
    });

    $('.select2-enable').select2({ width: '100%', dropdownParent: $('#formModal') });
    $('#p_sample').select2({ width: '100%', dropdownParent: $('#formModal'), tags: true, placeholder: "Select or type new sample..." });
    $('#p_ward').select2({ width: '100%', dropdownParent: $('#formModal'), tags: true, placeholder: "Select or type new ward..." });
    $('#p_organism').select2({ width: '100%', dropdownParent: $('#formModal'), tags: true, placeholder: "Type name or shortcode (e.g., ECO, PAE)..." });
    
    $('.select2-multiple').select2({ width: '100%' });
    $('.select2-basic').select2({ width: '100%' }); 
    $('#trend_years').select2({ width: '100%', dropdownAutoWidth: true });
    
    let today = new Date().toISOString().slice(0, 7);
    $('#p_date').val(today);
    
    let currentYear = new Date().getFullYear();
    $('#ana_start').val(`${currentYear}-01-01`);
    $('#ana_end').val(`${currentYear}-12-31`);
    $('#trend_start').val(`${currentYear}-01-01`);
    $('#trend_end').val(`${currentYear}-12-31`);

    loadAnalyticsFilters();

    $('#ana_start, #ana_end, #ana_sample').on('change', function() {
        loadAnalyticsFilters(); 
    });

    initDataTable();

    let isSelect2Closing = false;
    $(document).on('select2:closing', 'select', function() {
        isSelect2Closing = true;
    });
    $(document).on('select2:close', 'select', function() {
        setTimeout(function() { isSelect2Closing = false; }, 50);
    });
    $(document).on('focus', '.select2-selection', function() {
        if (isSelect2Closing) return;
        let select = $(this).closest('.select2-container').siblings('select:enabled');
        if (select.prop('multiple')) return; 
        if (select.length > 0 && !select.data('select2').isOpen()) {
            select.select2('open');
        }
    });
    $(document).on('select2:open', function(e) {
        setTimeout(function() {
            const searchField = document.querySelector('.select2-container--open .select2-search__field');
            if (searchField) {
                searchField.focus();
            }
        }, 50);
    });
});

// --- Tabs Logic ---
function showTab(tabName) {
    $('#viewRecords, #viewAnalytics').addClass('hidden');
    $('#btnTabRecords, #btnTabAnalytics').removeClass('bg-teal-600 text-white border-teal-400/50').addClass('bg-white/5 text-teal-100 border-teal-300/20');
    
    if (tabName === 'records') {
        $('#viewRecords').removeClass('hidden');
        $('#btnTabRecords').removeClass('bg-white/5 text-teal-100 border-teal-300/20').addClass('bg-teal-600 text-white border-teal-400/50');
    } else if (tabName === 'analytics') {
        loadAnalyticsFilters();
        $('#viewAnalytics').removeClass('hidden');
        $('#btnTabAnalytics').removeClass('bg-white/5 text-teal-100 border-teal-300/20').addClass('bg-teal-600 text-white border-teal-400/50');
    }
}

// --- BACKUP AND RESTORE LOGIC ---
function showBackupModal() {
    Swal.fire({
        title: '💾 Backup & Restore',
        html: `
            <div class="text-left space-y-4 mt-2">
                <div class="bg-teal-50 p-4 rounded-xl border border-teal-100">
                    <h4 class="font-bold text-teal-900 mb-2">1. Backup Data</h4>
                    <p class="text-xs text-slate-600 mb-3">Download all your patient records, custom antibiotics, and settings to a secure file on your computer.</p>
                    <button onclick="downloadBackup()" class="w-full bg-teal-600 text-white font-bold py-2 rounded-lg shadow hover:bg-teal-700 transition-colors">📥 Download Backup</button>
                </div>
                <div class="bg-amber-50 p-4 rounded-xl border border-amber-100">
                    <h4 class="font-bold text-amber-900 mb-2">2. Restore Data</h4>
                    <p class="text-xs text-slate-600 mb-3">Upload a previously saved backup file. <b class="text-red-500">Warning:</b> This will replace all current data.</p>
                    <input type="file" id="backupFileInput" accept=".json" class="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-100 file:text-amber-700 hover:file:bg-amber-200 mb-3" />
                    <button onclick="processRestore()" class="w-full bg-amber-600 text-white font-bold py-2 rounded-lg shadow hover:bg-amber-700 transition-colors">📤 Restore Backup</button>
                </div>
            </div>
        `,
        showConfirmButton: false,
        showCloseButton: true,
        width: '500px'
    });
}

window.downloadBackup = function() {
    const data = {
        amr_records: JSON.parse(localStorage.getItem('amr_records')) || [],
        amr_samples: JSON.parse(localStorage.getItem('amr_samples')) || defaultSamples,
        amr_wards: JSON.parse(localStorage.getItem('amr_wards')) || defaultWards,
        amr_organisms: JSON.parse(localStorage.getItem('amr_organisms')) || [],
        amr_custom_abx_v2: JSON.parse(localStorage.getItem('amr_custom_abx_v2')) || []
    };

    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const dateStr = new Date().toISOString().split('T')[0];
    saveAs(blob, `AMR_Tracker_Backup_${dateStr}.json`);
    
    Swal.fire('Success!', 'Backup downloaded successfully.', 'success');
};

window.processRestore = function() {
    const fileInput = document.getElementById('backupFileInput');
    if (!fileInput.files.length) {
        Swal.showValidationMessage('Please select a backup file first.');
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (!importedData.amr_records) throw new Error("Invalid backup file structure.");

            Swal.fire({
                title: 'Are you sure?',
                text: "This will overwrite all existing data. Make sure you have backed up your current work!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#e11d48',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Yes, Restore it!'
            }).then((result) => {
                if (result.isConfirmed) {
                    localStorage.setItem('amr_records', JSON.stringify(importedData.amr_records));
                    if (importedData.amr_samples) localStorage.setItem('amr_samples', JSON.stringify(importedData.amr_samples));
                    if (importedData.amr_wards) localStorage.setItem('amr_wards', JSON.stringify(importedData.amr_wards));
                    if (importedData.amr_organisms) localStorage.setItem('amr_organisms', JSON.stringify(importedData.amr_organisms));
                    if (importedData.amr_custom_abx_v2) localStorage.setItem('amr_custom_abx_v2', JSON.stringify(importedData.amr_custom_abx_v2));

                    loadBacteriaOptions();
                    loadSampleOptions();
                    loadWardOptions();
                    renderDefaultAntibiotics();
                    initDataTable();
                    if(!$('#viewAnalytics').hasClass('hidden')) loadAnalyticsFilters();

                    Swal.fire('Restored!', 'Your data has been restored successfully.', 'success');
                }
            });
        } catch (error) {
            Swal.fire('Error', 'Invalid or corrupted backup file.', 'error');
        }
    };
    reader.readAsText(file);
};

// --- 4. Data Entry UI Functions ---
function renderDefaultAntibiotics() {
    let currentGroups = JSON.parse(JSON.stringify(abxGroups));
    let customAbx = getCustomAntibiotics();
    customAbx.forEach(c => {
        if(currentGroups[c.group]) {
            currentGroups[c.group].push(c.name);
        } else {
            if(!currentGroups["Others"]) currentGroups["Others"] = [];
            currentGroups["Others"].push(c.name);
        }
    });

    let html = '';
    for (const [group, abxs] of Object.entries(currentGroups)) {
        if(abxs.length === 0) continue;
        html += `
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-5">
            <h5 class="text-sm font-bold bg-slate-50 text-teal-900 px-4 py-2 border-b border-slate-200">${group}</h5>
            <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-0">`;
        abxs.forEach(abx => {
            const safeId = abx.replace(/[^a-zA-Z0-9]/g, '_');
            html += `
                <div class="flex items-center justify-between border-r border-b border-slate-100 p-2.5 hover:bg-teal-50/30 transition-colors">
                    <span class="text-[11px] font-bold text-slate-700 truncate mr-2 w-2/3" title="${abx}">${abx}</span>
                    <select data-abx="${abx}" id="default_abx_${safeId}" class="default-abx-select compact-dropdown border border-slate-300 rounded-md text-xs font-bold bg-white focus:ring-2 focus:ring-teal-500 w-1/3 py-1.5 shadow-sm transition-colors">
                        <option value="" class="text-slate-400">-</option>
                        <option value="S" class="text-emerald-600 bg-emerald-50">S</option>
                        <option value="I" class="text-amber-600 bg-amber-50">I</option>
                        <option value="R" class="text-rose-600 bg-rose-50">R</option>
                    </select>
                </div>
            `;
        });
        html += `</div></div>`;
    }
    $('#default_abx_container').html(html);
}

function loadBacteriaOptions() {
    const select = $('#p_organism');
    select.empty();
    select.append(new Option("Type name or shortcode (e.g., ECO, PAE)...", ""));

    const groups = { "Gram-Negative": [], "Gram-Positive": [], "Others": [], "Fungi": [], "Custom": [] };
    
    bacteriaLibrary.forEach(bact => {
        const optionText = `${bact.name} (${bact.code})`;
        groups[bact.group].push(new Option(optionText, bact.name));
    });

    let savedOrgs = JSON.parse(localStorage.getItem('amr_organisms')) || [];
    savedOrgs.forEach(org => {
        groups["Custom"].push(new Option(org, org));
    });

    for (const [groupName, options] of Object.entries(groups)) {
        if (options.length > 0) {
            const optgroup = $(`<optgroup label="${groupName}"></optgroup>`);
            options.forEach(opt => optgroup.append(opt));
            select.append(optgroup);
        }
    }
}

function loadSampleOptions() {
    let savedSamples = JSON.parse(localStorage.getItem('amr_samples')) || defaultSamples;
    const sampleSelect = $('#p_sample');
    sampleSelect.empty(); 
    savedSamples.forEach(sample => {
        sampleSelect.append(new Option(sample, sample));
    });
}

function loadWardOptions() {
    let savedWards = JSON.parse(localStorage.getItem('amr_wards')) || defaultWards;
    const wardSelect = $('#p_ward');
    wardSelect.empty(); 
    wardSelect.append(new Option("Select Ward (Optional)...", ""));
    savedWards.forEach(ward => { wardSelect.append(new Option(ward, ward)); });
}

function loadAnalyticsFilters() {
    if (isUpdatingFilters) return;
    isUpdatingFilters = true;

    const startDate = $('#ana_start').val();
    const endDate = $('#ana_end').val();
    const targetSample = $('#ana_sample').val();

    let allRecords = JSON.parse(localStorage.getItem('amr_records')) || [];
    
    let records = allRecords.filter(r => {
        if(!startDate || !endDate) return true;
        return r.Date >= startDate && r.Date <= endDate;
    });

    if (targetSample) {
        records = records.filter(r => r.Sample === targetSample);
    }

    let uniqueSamples = new Set(records.map(r => r.Sample).filter(Boolean));
    let currentSample = $('#ana_sample').val();
    $('#ana_sample').empty().append(new Option("All Samples", ""));
    Array.from(uniqueSamples).sort().forEach(s => {
        $('#ana_sample').append(new Option(s, s));
    });
    if (currentSample && uniqueSamples.has(currentSample)) {
        $('#ana_sample').val(currentSample);
    }

    let orgs = new Set();
    let abxs = new Set();
    let allPossibleAbxs = [...abxList, ...getCustomAntibiotics().map(a=>a.name)];

    records.forEach(r => {
        let org = r['Selective organism'];
        if(org) orgs.add(org);
        allPossibleAbxs.forEach(a => {
            if (r[a] && r[a] !== '-' && r[a] !== '') abxs.add(a);
        });
    });

    let currentOrgs = $('#ana_organism').val() || [];
    $('#ana_organism').empty();
    Array.from(orgs).sort().forEach(o => {
        let isSelected = currentOrgs.includes(o);
        $('#ana_organism').append(new Option(o, o, isSelected, isSelected));
    });

    let currentAbxs = $('#ana_antibiotic').val() || [];
    $('#ana_antibiotic').empty();
    Array.from(abxs).sort().forEach(a => {
        let isSelected = currentAbxs.includes(a);
        $('#ana_antibiotic').append(new Option(a, a, isSelected, isSelected));
    });
    
    let currentTrendAbxs = $('#trend_antibiotic').val() || [];
    $('#trend_antibiotic').empty();
    Array.from(abxs).sort().forEach(a => {
        let isSelected = currentTrendAbxs.includes(a);
        $('#trend_antibiotic').append(new Option(a, a, isSelected, isSelected));
    });

    let trendOrgSelect = $('#trend_organism');
    let currentTrendOrg = trendOrgSelect.val();
    trendOrgSelect.empty();
    Array.from(orgs).sort().forEach(o => {
        trendOrgSelect.append(new Option(o, o));
    });
    if(currentTrendOrg && orgs.has(currentTrendOrg)) {
        trendOrgSelect.val(currentTrendOrg);
    }

    let currentYearStr = new Date().getFullYear().toString();
    let allYears = new Set();
    allRecords.forEach(r => {
        if(r.Date) {
            let y = r.Date.split('-')[0];
            if(y !== currentYearStr) allYears.add(y);
        }
    });
    
    let trendYearsSelect = $('#trend_years');
    let currentTrendYears = trendYearsSelect.val() || [];
    trendYearsSelect.empty();
    Array.from(allYears).sort((a,b) => b-a).forEach(y => {
        let isSelected = currentTrendYears.includes(y) || currentTrendYears.length === 0;
        trendYearsSelect.append(new Option(y, y, isSelected, isSelected));
    });

    $('#ana_sample').trigger('change.select2');
    $('#ana_organism').trigger('change.select2');
    $('#ana_antibiotic').trigger('change.select2');
    $('#trend_antibiotic').trigger('change.select2');
    $('#trend_years').trigger('change.select2');

    isUpdatingFilters = false;
}

function initDataTable() {
    let records = JSON.parse(localStorage.getItem('amr_records')) || [];
    
    let cols = [
        { data: null, title: 'Action', orderable: false, render: function(data, type, row, meta) {
            return `
            <div class="flex gap-2">
                <button onclick="editRecord(${meta.row})" class="bg-amber-400 hover:bg-amber-500 text-white px-3 py-1 rounded-md text-xs font-bold shadow-sm transition-colors">Edit</button>
                <button onclick="deleteRecord(${meta.row})" class="bg-rose-500 hover:bg-rose-600 text-white px-3 py-1 rounded-md text-xs font-bold shadow-sm transition-colors">Delete</button>
            </div>`;
        }},
        { data: 'Name', title: 'Name' },
        { data: null, title: 'Age', render: function(data, type, row) { 
            return row['Age'] ? row['Age'] + ' ' + (row['Age Unit'] || '') : '-'; 
        }},
        { data: 'Sex', title: 'Sex' },
        { data: 'Ward', title: 'Ward' },
        { data: 'Sample', title: 'Sample' },
        { data: 'Date', title: 'Date' },
        { data: 'Selective organism', title: 'Selective organism' }
    ];

    let customAbx = getCustomAntibiotics();
    let allAbxColumns = [...abxList, ...customAbx.map(a=>a.name)];
    allAbxColumns.forEach(abx => { cols.push({ data: abx, title: abx, defaultContent: '-' }); });

    if ($.fn.DataTable.isDataTable('#recordsTable')) {
        $('#recordsTable').DataTable().destroy();
    }

    dataTable = $('#recordsTable').DataTable({
        data: records,
        columns: cols,
        scrollX: true, 
        order: [[ 6, "desc" ]], 
        dom: '<"flex flex-col sm:flex-row justify-between items-center mb-4 gap-3"Bf>rt<"flex flex-col sm:flex-row justify-between items-center mt-4 gap-3"ip>',
        buttons: [
            { extend: 'excelHtml5', text: 'Export to Excel', className: 'mr-2 rounded shadow' },
            { extend: 'print', text: 'Print Records', className: 'rounded shadow' }
        ],
        pageLength: 15,
        language: { search: "", searchPlaceholder: "Search records..." }
    });
}

function openModal() {
    $('#entryForm')[0].reset();
    $('#editIndex').val('-1');
    $('#p_date').val(new Date().toISOString().slice(0, 7));
    $('#active_abx_container').empty();
    selectedAbxMap = {};
    
    $('#p_ward').trigger('change');
    $('#p_sex').trigger('change');
    $('#p_sample').val(null).trigger('change');
    $('#p_organism').val(null).trigger('change');
    $('#p_antibiogram_org').val('').trigger('change');
    
    $('.default-abx-select').each(function() {
        $(this).val('').trigger('change');
        updateAbxColor(this);
    });
    
    $('#modalTitle').text('Add New Patient Record');
    $('#formModal').removeClass('hidden');
}

function closeModal() {
    $('#formModal').addClass('hidden');
}

let selectedAbxMap = {};

function addAntibiotic(abxName = null, result = 'S') {
    const abx = abxName || $('#abx_selector').val();
    if(!abx) return;

    let isDefault = false;
    $(`.default-abx-select[data-abx="${$.escapeSelector(abx)}"]`).each(function() {
        $(this).val(result).trigger('change');
        isDefault = true;
    });

    if (isDefault) { $('#abx_selector').val(null).trigger('change'); return; }

    if (selectedAbxMap[abx]) return; 
    
    selectedAbxMap[abx] = result;
    const safeId = abx.replace(/[^a-zA-Z0-9\s]/g, '_').trim();
    const html = `
        <div id="row_${safeId}" class="flex items-center justify-between bg-white border border-gray-200 rounded-md p-3 shadow-sm hover:shadow transition">
            <span class="text-sm font-semibold text-gray-700 truncate w-3/5" title="${abx}">${abx}</span>
            <select class="abx-result-select border border-gray-300 rounded-md p-1.5 text-sm font-bold bg-gray-50 focus:ring-blue-500 w-1/4" onchange="updateAbxResult('${abx}', this.value)">
                <option value="S" class="text-green-600" ${result==='S'?'selected':''}>S</option>
                <option value="I" class="text-yellow-600" ${result==='I'?'selected':''}>I</option>
                <option value="R" class="text-red-600" ${result==='R'?'selected':''}>R</option>
            </select>
            <button type="button" onclick="removeAntibiotic('${abx}', '${safeId}')" class="text-red-400 hover:text-red-600 font-bold px-2 text-lg transition">&times;</button>
        </div>
    `;
    $('#active_abx_container').append(html);
    $('#abx_selector').val(null).trigger('change');
}

function updateAbxResult(abx, val) {
    selectedAbxMap[abx] = val;
}

function removeAntibiotic(abx, safeId) {
    delete selectedAbxMap[abx];
    $(`#row_${safeId}`).remove();
}

$('#entryForm').submit(function(e) {
    e.preventDefault();
    
    let currentSample = $('#p_sample').val();
    let savedSamples = JSON.parse(localStorage.getItem('amr_samples')) || defaultSamples;

    if (currentSample && !savedSamples.includes(currentSample)) {
        savedSamples.push(currentSample);
        localStorage.setItem('amr_samples', JSON.stringify(savedSamples));
        $('#p_sample').append(new Option(currentSample, currentSample, true, true)).trigger('change');
    }
    
    let currentWard = $('#p_ward').val();
    let savedWards = JSON.parse(localStorage.getItem('amr_wards')) || defaultWards;
    if (currentWard && !savedWards.includes(currentWard)) {
        savedWards.push(currentWard); localStorage.setItem('amr_wards', JSON.stringify(savedWards));
        $('#p_ward').append(new Option(currentWard, currentWard, true, true)).trigger('change');
    }

    let currentOrganism = $('#p_organism').val();
    let savedOrgs = JSON.parse(localStorage.getItem('amr_organisms')) || [];
    let isDefaultOrg = bacteriaLibrary.some(b => b.name === currentOrganism);

    if (currentOrganism && !isDefaultOrg && !savedOrgs.includes(currentOrganism)) {
        savedOrgs.push(currentOrganism);
        localStorage.setItem('amr_organisms', JSON.stringify(savedOrgs));
        $('#p_organism').append(new Option(currentOrganism, currentOrganism, true, true)).trigger('change');
    }

    let record = {
        'Name': $('#p_name').val(),
        'Age': $('#p_age').val(),
        'Age Unit': $('#p_age_unit').val(),
        'Sex': $('#p_sex').val(),
        'Ward': currentWard || "-",
        'Sample': currentSample,
        'Date': $('#p_date').val(),
        'Selective organism': currentOrganism,
        'Antibiogram organism': $('#p_antibiogram_org').val() 
    };

    if (!record['Selective organism']) {
        Swal.fire({ icon: 'error', title: 'Oops...', text: 'Please select an organism.' });
        return;
    }

    Object.keys(selectedAbxMap).forEach(abx => {
        record[abx] = selectedAbxMap[abx];
    });

    $('.default-abx-select').each(function() {
        const val = $(this).val();
        if (val && val !== "") { record[$(this).attr('data-abx')] = val; }
    });

    let records = JSON.parse(localStorage.getItem('amr_records')) || [];
    let editIndex = $('#editIndex').val();

    if (editIndex > -1) {
        records[editIndex] = record; 
    } else {
        records.push(record); 
    }

    localStorage.setItem('amr_records', JSON.stringify(records));
    closeModal();
    initDataTable();
    
    if(!$('#viewAnalytics').hasClass('hidden')) loadAnalyticsFilters();

    Swal.fire({ icon: 'success', title: 'Saved!', timer: 1500, showConfirmButton: false });
});

function editRecord(index) {
    let records = JSON.parse(localStorage.getItem('amr_records')) || [];
    let record = records[index];
    
    openModal();
    $('#modalTitle').text('Edit Patient Record');
    $('#editIndex').val(index);
    
    $('#p_name').val(record['Name']);
    $('#p_age').val(record['Age']);
    $('#p_age_unit').val(record['Age Unit'] || 'Years');
    $('#p_sex').val(record['Sex']).trigger('change');
    
    if (record['Ward'] && record['Ward'] !== "-") { 
        if ($('#p_ward').find("option[value='" + record['Ward'] + "']").length) {
            $('#p_ward').val(record['Ward']).trigger('change'); 
        } else {
            $('#p_ward').append(new Option(record['Ward'], record['Ward'], true, true)).trigger('change');
        }
    } else { 
        $('#p_ward').val('').trigger('change'); 
    }
    
    if ($('#p_sample').find("option[value='" + record['Sample'] + "']").length) {
        $('#p_sample').val(record['Sample']).trigger('change');
    } else {
        var newSampleOption = new Option(record['Sample'], record['Sample'], true, true);
        $('#p_sample').append(newSampleOption).trigger('change');
    }

    $('#p_date').val(record['Date'] ? record['Date'].substring(0, 7) : '');
    
    if ($('#p_organism').find("option[value='" + record['Selective organism'] + "']").length) {
        $('#p_organism').val(record['Selective organism']).trigger('change');
    } else {
        var newOrgOption = new Option(record['Selective organism'], record['Selective organism'], true, true);
        $('#p_organism').append(newOrgOption).trigger('change');
    }

    if (record['Antibiogram organism']) {
        $('#p_antibiogram_org').val(record['Antibiogram organism']).trigger('change');
    } else {
        $('#p_antibiogram_org').val('').trigger('change');
    }

    const standardProps = ['Name', 'Age', 'Age Unit', 'Sex', 'Ward', 'Sample', 'Date', 'Selective organism', 'Antibiogram organism'];
    
    Object.keys(record).forEach(key => {
        if (!standardProps.includes(key)) {
            let val = record[key];
            if (val && val !== '-') {
                let selectEl = $(`.default-abx-select[data-abx="${$.escapeSelector(key)}"]`);
                if (selectEl.length > 0) {
                    selectEl.val(val).trigger('change');
                } else {
                    addAntibiotic(key, val);
                }
            }
        }
    });
}

function deleteRecord(index) {
    Swal.fire({ title: 'Are you sure?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#e11d48', confirmButtonText: 'Yes, delete it!' })
    .then((result) => {
        if (result.isConfirmed) {
            let records = JSON.parse(localStorage.getItem('amr_records')) || [];
            records.splice(index, 1); localStorage.setItem('amr_records', JSON.stringify(records));
            initDataTable(); Swal.fire('Deleted!', '', 'success');
        }
    });
}

// --- Manage Dictionaries ---
function manageSamples() {
    let savedSamples = JSON.parse(localStorage.getItem('amr_samples')) || defaultSamples;
    let customSamples = savedSamples.filter(s => !defaultSamples.includes(s));
    if (customSamples.length === 0) { Swal.fire({ icon: 'info', title: 'No Custom Samples' }); return; }
    let html = '<div class="text-left space-y-2 mt-4">';
    customSamples.forEach(sample => {
        html += `<div class="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span class="font-medium text-slate-700">${sample}</span>
            <button type="button" onclick="deleteCustomSample('${sample.replace(/'/g, "\\'")}')" class="text-rose-500 font-bold bg-white px-3 py-1 rounded border hover:bg-rose-50 transition-colors">Delete</button></div>`;
    });
    html += '</div>';
    Swal.fire({ title: 'Manage Custom Samples', html: html, confirmButtonText: 'Done' });
}

window.deleteCustomSample = function(sample) {
    let s = JSON.parse(localStorage.getItem('amr_samples')) || defaultSamples;
    localStorage.setItem('amr_samples', JSON.stringify(s.filter(x => x !== sample)));
    loadSampleOptions(); 
    if(!$('#viewAnalytics').hasClass('hidden')) loadAnalyticsFilters(); 
    manageSamples();
};

function manageWards() {
    let savedWards = JSON.parse(localStorage.getItem('amr_wards')) || defaultWards;
    let customWards = savedWards.filter(w => !defaultWards.includes(w));
    if (customWards.length === 0) { Swal.fire({ icon: 'info', title: 'No Custom Wards' }); return; }
    let html = '<div class="text-left space-y-2 mt-4">';
    customWards.forEach(ward => {
        html += `<div class="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span class="font-medium text-slate-700">${ward}</span>
            <button type="button" onclick="deleteCustomWard('${ward.replace(/'/g, "\\'")}')" class="text-rose-500 font-bold bg-white px-3 py-1 rounded border hover:bg-rose-50 transition-colors">Delete</button></div>`;
    });
    html += '</div>';
    Swal.fire({ title: 'Manage Custom Wards', html: html, confirmButtonText: 'Done' });
}

window.deleteCustomWard = function(ward) {
    let w = JSON.parse(localStorage.getItem('amr_wards')) || defaultWards;
    localStorage.setItem('amr_wards', JSON.stringify(w.filter(x => x !== ward)));
    loadWardOptions(); 
    manageWards();
};

function manageOrganisms() {
    let savedOrgs = JSON.parse(localStorage.getItem('amr_organisms')) || [];
    if (savedOrgs.length === 0) { Swal.fire({ icon: 'info', title: 'No Custom Organisms' }); return; }
    let html = '<div class="text-left space-y-2 mt-4">';
    savedOrgs.forEach(org => {
        html += `<div class="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span class="font-medium text-slate-700">${org}</span>
            <button type="button" onclick="deleteCustomOrganism('${org.replace(/'/g, "\\'")}')" class="text-rose-500 font-bold bg-white px-3 py-1 rounded border hover:bg-rose-50 transition-colors">Delete</button></div>`;
    });
    html += '</div>';
    Swal.fire({ title: 'Manage Custom Organisms', html: html, confirmButtonText: 'Done' });
}

window.deleteCustomOrganism = function(org) {
    let savedOrgs = JSON.parse(localStorage.getItem('amr_organisms')) || [];
    localStorage.setItem('amr_organisms', JSON.stringify(savedOrgs.filter(x => x !== org)));
    loadBacteriaOptions(); 
    if(!$('#viewAnalytics').hasClass('hidden')) loadAnalyticsFilters(); 
    manageOrganisms();
};

function manageAntibioticsDB() {
    let customAbx = getCustomAntibiotics();
    let groupsArr = Object.keys(abxGroups);
    if (!groupsArr.includes("Others")) groupsArr.push("Others");

    let groupsOptions = groupsArr.map(g => `<option value="${g}">${g}</option>`).join('');
    
    let listHtml = customAbx.length === 0 ? '<p class="text-xs text-slate-500 text-center py-4 bg-slate-50 rounded-lg border border-slate-200">No custom antibiotics added yet.</p>' : 
        customAbx.map(a => {
            let opts = groupsArr.map(g => `<option value="${g}" ${a.group === g ? 'selected' : ''}>${g}</option>`).join('');
            return `
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 p-3 rounded-lg border border-slate-200 mb-2 gap-2">
                <div class="font-bold text-sm text-slate-800 truncate w-full sm:flex-1" title="${a.name}">${a.name}</div>
                <div class="flex w-full sm:w-auto gap-2">
                    <select onchange="updateAbxGroupInDB('${a.name.replace(/'/g, "\\'")}', this.value)" class="flex-1 sm:w-32 border border-slate-300 rounded p-1.5 text-xs focus:ring-teal-500" dir="ltr" title="Change Group">
                        ${opts}
                    </select>
                    <button type="button" onclick="removeAbxFromDB('${a.name.replace(/'/g, "\\'")}')" class="text-rose-500 font-bold text-xs bg-white px-3 py-1.5 rounded border border-rose-200 hover:bg-rose-50 transition-colors">Delete</button>
                </div>
            </div>
            `;
        }).join('');

    let html = `
        <div class="text-left space-y-5">
            <div class="bg-teal-50 p-4 rounded-xl border border-teal-100">
                <h5 class="font-bold text-teal-900 mb-3">Add New Antibiotic / Antifungal</h5>
                <input type="text" id="new_abx_name" placeholder="Name..." class="w-full border border-slate-300 p-2.5 rounded-lg mb-3 focus:ring-2 focus:ring-teal-500 outline-none" dir="ltr">
                <select id="new_abx_group" class="w-full border border-slate-300 p-2.5 rounded-lg mb-4 focus:ring-2 focus:ring-teal-500 outline-none" dir="ltr">
                    ${groupsOptions}
                </select>
                <button type="button" onclick="addNewAbxToDB()" class="w-full bg-teal-600 text-white font-bold py-2.5 rounded-lg shadow hover:bg-teal-700 transition-colors">Add to Database</button>
                <p id="abx_error" class="text-rose-500 text-xs font-bold mt-2 hidden"></p>
            </div>
            <div>
                <h5 class="font-bold text-slate-700 mb-3 border-b border-slate-200 pb-2">Custom Antibiotics List</h5>
                <div id="custom_abx_list" class="max-h-60 overflow-y-auto pr-2 custom-scroll">
                    ${listHtml}
                </div>
            </div>
        </div>
    `;

    Swal.fire({
        title: 'Database Manager',
        html: html,
        showConfirmButton: true,
        confirmButtonText: 'Done',
        confirmButtonColor: '#0d9488',
        width: '600px'
    }).then(() => {
        renderDefaultAntibiotics();
        initDataTable();
    });
}

window.addNewAbxToDB = function() {
    let name = document.getElementById('new_abx_name').value.trim();
    let group = document.getElementById('new_abx_group').value;
    let errorEl = document.getElementById('abx_error');
    
    if(!name) { 
        errorEl.innerText = 'Name is required!'; 
        errorEl.classList.remove('hidden');
        return; 
    }
    
    let allCurrent = [...abxList, ...getCustomAntibiotics().map(a=>a.name)];
    if(allCurrent.map(a=>a.toLowerCase()).includes(name.toLowerCase())) {
        errorEl.innerText = 'Item already exists!';
        errorEl.classList.remove('hidden');
        return;
    }

    saveCustomAntibiotic(name, group);
    manageAntibioticsDB(); 
};

window.removeAbxFromDB = function(name) {
    deleteCustomAntibiotic(name);
    manageAntibioticsDB();
};

window.updateAbxGroupInDB = function(name, newGroup) {
    let custom = getCustomAntibiotics();
    let index = custom.findIndex(a => a.name === name);
    if (index !== -1) {
        custom[index].group = newGroup;
        localStorage.setItem('amr_custom_abx_v2', JSON.stringify(custom));
        renderDefaultAntibiotics(); 
    }
};

// --- 6. Smart Analytics, Heatmap & Wilson CI ---
function wilsonScoreCI(r, n) {
    if (n === 0) return { lower: 0, upper: 0 };
    const p = r / n;
    const z = 1.96; 
    const z2 = z * z;
    const denominator = 1 + z2 / n;
    const center = p + z2 / (2 * n);
    const spread = z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
    const lower = (center - spread) / denominator;
    const upper = (center + spread) / denominator;
    return { lower: Math.max(0, Math.round(lower * 100)), upper: Math.min(100, Math.round(upper * 100)) };
}

const orgColorPalette = [
    { bg: 'rgba(185, 28, 28, 0.9)', lowBg: 'rgba(203, 213, 225, 0.6)' },
    { bg: 'rgba(30, 64, 175, 0.9)', lowBg: 'rgba(203, 213, 225, 0.6)' },
    { bg: 'rgba(21, 128, 61, 0.9)', lowBg: 'rgba(203, 213, 225, 0.6)' },
    { bg: 'rgba(162, 28, 175, 0.9)', lowBg: 'rgba(203, 213, 225, 0.6)' },
    { bg: 'rgba(194, 65, 12, 0.9)', lowBg: 'rgba(203, 213, 225, 0.6)' },
    { bg: 'rgba(13, 148, 136, 0.9)', lowBg: 'rgba(203, 213, 225, 0.6)' },
    { bg: 'rgba(217, 70, 239, 0.9)', lowBg: 'rgba(203, 213, 225, 0.6)' }
];

window.clearAnalyticsFilters = function() {
    let currentYear = new Date().getFullYear();
    $('#ana_start').val(`${currentYear}-01-01`);
    $('#ana_end').val(`${currentYear}-12-31`);

    $('#ana_sample').val(null).trigger('change.select2');
    $('#ana_organism').val(null).trigger('change.select2');
    $('#ana_antibiotic').val(null).trigger('change.select2');
    
    $('#trend_start').val(`${currentYear}-01-01`);
    $('#trend_end').val(`${currentYear}-12-31`);
    $('#trend_antibiotic').val(null).trigger('change.select2');

    loadAnalyticsFilters();

    $('#analyticsContainer').addClass('hidden');
    $('#analyticsPlaceholder').removeClass('hidden').html(`
        <svg class="w-16 h-16 mb-4 text-slate-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2h-2a2 2 0 01-2-2h-2a2 2 0 01-2-2h-2a2 2 0 01-2-2z"></path></svg>
        <p class="text-lg font-medium text-slate-500">Select parameters and click 'Analyze' to view insights.</p>
    `);
};

window.toggleTrendType = function() {
    if ($('#trend_type').val() === 'yearly') {
        $('#trend_year_container').removeClass('hidden').addClass('flex');
        $('#trend_seasonal_dates').removeClass('flex').addClass('hidden');
    } else {
        $('#trend_year_container').removeClass('flex').addClass('hidden');
        $('#trend_seasonal_dates').removeClass('hidden').addClass('flex');
    }
};

window.renderTrendChart = function() {
    const trendType = $('#trend_type').val();
    const targetOrg = $('#trend_organism').val();
    const targetAbxs = $('#trend_antibiotic').val() || [];
    
    if (!targetOrg) {
        Swal.fire('Notice', 'Please select an organism for the trend analysis.', 'info');
        return;
    }

    let allRecords = JSON.parse(localStorage.getItem('amr_records')) || [];
    let records = allRecords.filter(r => r['Selective organism'] === targetOrg);

    if (targetAbxs.length === 0) {
         $('#trendTableBody').html('<tr><td colspan="5" class="text-center py-4 text-slate-500">Please select at least one antibiotic to view trends.</td></tr>');
         if(chartTrend_instance) chartTrend_instance.destroy();
         return;
    }

    let chartLabels = [];
    let datasets = [];
    let tableHtml = '';

    if (trendType === 'seasonal') {
        const startDate = $('#trend_start').val();
        const endDate = $('#trend_end').val();
        if(startDate && endDate) {
            records = records.filter(r => r.Date >= startDate && r.Date <= endDate);
        }

        chartLabels = ['Q1 (Jan-Mar)', 'Q2 (Apr-Jun)', 'Q3 (Jul-Sep)', 'Q4 (Oct-Dec)'];
        let quartersData = { 'Q1': {}, 'Q2': {}, 'Q3': {}, 'Q4': {} };
        
        targetAbxs.forEach(abx => {
            ['Q1', 'Q2', 'Q3', 'Q4'].forEach(q => { quartersData[q][abx] = {t:0, r:0}; });
        });

        records.forEach(r => {
            if(!r.Date) return;
            let month = parseInt(r.Date.split('-')[1]);
            let q = month <= 3 ? 'Q1' : month <= 6 ? 'Q2' : month <= 9 ? 'Q3' : 'Q4';
            
            targetAbxs.forEach(abx => {
                let res = r[abx];
                if (res && res !== '-' && res !== '') {
                    quartersData[q][abx].t++;
                    if(res === 'R') quartersData[q][abx].r++;
                }
            });
        });

        targetAbxs.forEach((abx, i) => {
            let dataR = [];
            let palette = orgColorPalette[i % orgColorPalette.length]; 
            
            ['Q1', 'Q2', 'Q3', 'Q4'].forEach((q, qIdx) => {
                let s = quartersData[q][abx];
                let p = s.t > 0 ? Math.round((s.r / s.t) * 100) : null;
                dataR.push(p);

                if(s.t > 0) {
                    tableHtml += `
                        <tr class="hover:bg-slate-50 transition-colors ${s.t < 30 ? 'text-slate-500' : 'text-slate-700 font-medium'}">
                            <td class="px-4 py-2 border-b border-slate-100">${chartLabels[qIdx]}</td>
                            <td class="px-4 py-2 border-b border-slate-100 font-bold" style="color:${palette.bg.replace('0.9','1')}">${abx}</td>
                            <td class="px-4 py-2 border-b border-slate-100 text-center">${s.t}</td>
                            <td class="px-4 py-2 border-b border-slate-100 text-center">${s.r}</td>
                            <td class="px-4 py-2 border-b border-slate-100 text-center">${p}% ${s.t < 30 ? '<span class="text-red-500 font-bold">*</span>':''}</td>
                        </tr>
                    `;
                }
            });

            datasets.push({
                label: abx,
                data: dataR,
                borderColor: palette.bg.replace('0.9','1'),
                backgroundColor: palette.bg.replace('0.9','1'),
                tension: 0.3,
                fill: false,
                spanGaps: true,
                pointRadius: 5,
                pointHoverRadius: 7
            });
        });

    } else {
        let selectedYears = $('#trend_years').val() || [];
        if(selectedYears.length === 0) {
            $('#trendTableBody').html('<tr><td colspan="5" class="text-center py-4 text-slate-500">Please select at least one complete year.</td></tr>');
            if(chartTrend_instance) chartTrend_instance.destroy();
            return;
        }

        records = records.filter(r => {
            if(!r.Date) return false;
            return selectedYears.includes(r.Date.split('-')[0]);
        });

        chartLabels = targetAbxs;
        let yearsData = {}; 
        selectedYears.sort().forEach(y => { yearsData[y] = {}; targetAbxs.forEach(a => yearsData[y][a] = {t:0, r:0}); });

        records.forEach(r => {
            let y = r.Date.split('-')[0];
            targetAbxs.forEach(abx => {
                let res = r[abx];
                if(res && res !== '-' && res !== '') {
                    yearsData[y][abx].t++;
                    if(res === 'R') yearsData[y][abx].r++;
                }
            });
        });

        selectedYears.sort().forEach((y, i) => {
            let dataR = [];
            let bgColors = [];
            let palette = orgColorPalette[i % orgColorPalette.length]; 

            targetAbxs.forEach(abx => {
                let s = yearsData[y][abx];
                let p = s.t > 0 ? Math.round((s.r / s.t) * 100) : 0;
                let isRel = s.t >= 30;
                
                if(s.t === 0) { dataR.push(0); bgColors.push(palette.lowBg); }
                else {
                    dataR.push(p);
                    bgColors.push(isRel ? palette.bg : palette.lowBg);
                }

                if(s.t > 0) {
                    tableHtml += `
                        <tr class="hover:bg-slate-50 transition-colors ${!isRel ? 'text-slate-500' : 'text-slate-700 font-medium'}">
                            <td class="px-4 py-2 border-b border-slate-100 font-bold" style="color:${palette.bg.replace('0.9','1')}">${y}</td>
                            <td class="px-4 py-2 border-b border-slate-100 font-bold">${abx}</td>
                            <td class="px-4 py-2 border-b border-slate-100 text-center">${s.t}</td>
                            <td class="px-4 py-2 border-b border-slate-100 text-center">${s.r}</td>
                            <td class="px-4 py-2 border-b border-slate-100 text-center">${p}% ${!isRel ? '<span class="text-red-500 font-bold">*</span>':''}</td>
                        </tr>
                    `;
                }
            });

            datasets.push({
                label: y,
                data: dataR,
                backgroundColor: bgColors,
                borderRadius: 4
            });
        });
    }

    if(tableHtml === '') tableHtml = '<tr><td colspan="5" class="text-center py-4 text-slate-500">No trend data found for the selected criteria.</td></tr>';
    $('#trendTableBody').html(tableHtml);

    if (chartTrend_instance) chartTrend_instance.destroy();
    
    let chartType = trendType === 'seasonal' ? 'line' : 'bar';
    
    chartTrend_instance = new Chart(document.getElementById('chartTrend'), {
        type: chartType,
        data: { labels: chartLabels, datasets: datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { 
                y: { beginAtZero: true, max: 100, title: { display: true, text: '% Resistance', font: {weight: 'bold'} }, grid: {color: '#f1f5f9'} },
                x: { grid: {display: false} }
            },
            plugins: { 
                legend: { display: true, position: 'top' },
                tooltip: {
                    callbacks: { label: function(context) { return context.dataset.label + ': ' + context.parsed.y + '%'; } }
                }
            }
        }
    });
};

function generateAnalytics() {
    const startDate = $('#ana_start').val();
    const endDate = $('#ana_end').val();
    const targetSample = $('#ana_sample').val();
    const targetOrgs = $('#ana_organism').val() || [];
    const targetAbxs = $('#ana_antibiotic').val() || [];
    const metric = $('#ana_metric').val() || 'R'; // قراءة نوع العرض (R أو S)
    const metricLabel = metric === 'R' ? 'Resistance' : 'Susceptibility';

    if (!startDate || !endDate) { Swal.fire('Required', 'Please select both dates.', 'warning'); return; }

    let allRecords = JSON.parse(localStorage.getItem('amr_records')) || [];
    let records = allRecords.filter(r => r.Date >= startDate && r.Date <= endDate);

    if (targetSample) { records = records.filter(r => r.Sample === targetSample); }
    
    if (records.length === 0) {
        $('#analyticsPlaceholder').removeClass('hidden').html(`
            <svg class="w-16 h-16 mb-4 text-slate-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            <p class="text-lg font-medium text-slate-500">No records found for the selected criteria.</p>
        `);
        $('#analyticsContainer').addClass('hidden');
        return;
    }

    $('#analyticsPlaceholder').addClass('hidden');
    $('#analyticsContainer').removeClass('hidden');

    let dashTitle = "Antibiogram Analysis";
    let dashSub = `${startDate} to ${endDate} | Metric: % ${metricLabel}`;
    if(targetSample) dashSub += ` | Sample: ${targetSample}`;
    $('#dashTitle').text(dashTitle);
    $('#dashSubtitle').text(dashSub);

    // تحديث عناوين المخططات بناءً على الاختيار
    $('#chartAMR').parent().siblings('div').find('h3').html(`AMR Profile Comparison (% ${metricLabel}) <button type="button" onclick="togglePrintSection('print_sect_amr')" class="text-slate-400 hover:text-teal-600 no-print" title="Toggle Print Visibility">👁️</button>`);
    $('#heatmapWrapper').siblings('.flex').find('h3').html(`Antibiogram Heatmap (% ${metricLabel}) <button type="button" onclick="togglePrintSection('print_sect_heatmap')" class="text-slate-400 hover:text-teal-600 no-print" title="Toggle Print Visibility">👁️</button>`);

    let orgCounts = {};
    let specCounts = {};
    let genderCounts = { "Male": 0, "Female": 0 };
    let heatmapStats = {};
    let allPossibleAbxs = [...abxList, ...getCustomAntibiotics().map(a=>a.name)];
    
    let allPresentOrgs = new Set();

    records.forEach(r => {
        let org = r['Selective organism'];
        if(!org) return;
        
        allPresentOrgs.add(org);
        orgCounts[org] = (orgCounts[org] || 0) + 1;
        if(r.Sample) specCounts[r.Sample] = (specCounts[r.Sample] || 0) + 1;
        if(r.Sex && genderCounts[r.Sex] !== undefined) genderCounts[r.Sex] += 1;

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

    let displayOrgs = [];
    let displayAbxs = [];

    if (targetOrgs.length === 0 && targetAbxs.length === 0) {
        $('#print_sect_amr').addClass('hidden');
        if (chartAMR_instance) chartAMR_instance.destroy();
    } else {
        $('#print_sect_amr').removeClass('hidden');

        if (targetOrgs.length > 0 && targetAbxs.length === 0) {
            displayOrgs = targetOrgs;
            let foundAbxs = new Set();
            displayOrgs.forEach(org => {
                if (amrStats[org]) {
                    Object.keys(amrStats[org].abx).forEach(abx => {
                        if (amrStats[org].abx[abx].tested > 0) foundAbxs.add(abx);
                    });
                }
            });
            displayAbxs = Array.from(foundAbxs).sort();
        } else if (targetOrgs.length === 0 && targetAbxs.length > 0) {
            displayAbxs = targetAbxs;
            let foundOrgs = new Set();
            Array.from(allPresentOrgs).forEach(org => {
                displayAbxs.forEach(abx => {
                    if (amrStats[org].abx[abx] && amrStats[org].abx[abx].tested > 0) foundOrgs.add(org);
                });
            });
            displayOrgs = Array.from(foundOrgs).sort();
        } else {
            displayOrgs = targetOrgs;
            displayAbxs = targetAbxs;
        }

        let anyLowReliability = false;
        let datasets = [];
        let tableHtml = '';

        if (displayOrgs.length === 0 || displayAbxs.length === 0) {
            tableHtml = '<tr><td colspan="6" class="text-center py-4 text-slate-500">No cross-data found for the selected combinations.</td></tr>';
        } else {
            displayOrgs.forEach((org, orgIndex) => {
                let s_org = amrStats[org];
                if (!s_org) return;

                let dataR = [];
                let bgColors = [];
                let palette = orgColorPalette[orgIndex % orgColorPalette.length];

                displayAbxs.forEach(abx => {
                    let s = s_org.abx[abx];
                    if (!s || s.tested === 0) {
                        dataR.push(0); 
                        bgColors.push(palette.lowBg);
                    } else {
                        let targetVal = metric === 'R' ? s.r : s.s;
                        let p = Math.round((targetVal / s.tested) * 100);
                        let isReliable = s.tested >= 30;
                        if (!isReliable) anyLowReliability = true;
                        
                        dataR.push(p);
                        bgColors.push(isReliable ? palette.bg : palette.lowBg);

                        let ci = wilsonScoreCI(targetVal, s.tested);
                        tableHtml += `
                            <tr class="hover:bg-slate-50 transition-colors ${!isReliable ? 'text-slate-500' : 'font-semibold text-slate-700'}">
                                <td class="px-4 py-2 border-b border-slate-100">${abx}</td>
                                <td class="px-4 py-2 border-b border-slate-100"><span style="color:${palette.bg.replace('0.9','1')}">${org}</span> ${!isReliable ? '<span class="text-red-500 font-bold">*</span>' : ''}</td>
                                <td class="px-4 py-2 border-b border-slate-100 text-center">${s.tested}</td>
                                <td class="px-4 py-2 border-b border-slate-100 text-center">${targetVal}</td>
                                <td class="px-4 py-2 border-b border-slate-100 text-center">${p}%</td>
                                <td class="px-4 py-2 border-b border-slate-100 text-center">${ci.lower}% - ${ci.upper}%</td>
                            </tr>
                        `;
                    }
                });

                datasets.push({
                    label: org,
                    data: dataR,
                    backgroundColor: bgColors,
                    borderRadius: 4
                });
            });
        }

        if (anyLowReliability) $('#amrClsiWarning').removeClass('hidden');
        else $('#amrClsiWarning').addClass('hidden');

        // تحديث هيدر الجدول
        $('#ciTableBody').html(tableHtml);
        $('#ciTableBody').siblings('thead').find('th').eq(3).text(`Count (${metric})`);
        $('#ciTableBody').siblings('thead').find('th').eq(4).text(`% ${metricLabel}`);

        if (chartAMR_instance) chartAMR_instance.destroy();
        chartAMR_instance = new Chart(document.getElementById('chartAMR'), {
            type: 'bar',
            data: { labels: displayAbxs, datasets: datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { 
                    y: { beginAtZero: true, max: 100, title: { display: true, text: `% ${metricLabel}`, font: {weight: 'bold'} }, grid: {color: '#f1f5f9'} },
                    x: { grid: {display: false}, ticks: { autoSkip: false, maxRotation: 45, minRotation: 45 } }
                },
                plugins: { legend: { display: true, position: 'top' } } 
            }
        });
    }

    // Heatmap Building 
    let hmOrgs = Object.keys(heatmapStats);
    if (targetOrgs.length > 0) {
        hmOrgs = hmOrgs.filter(o => targetOrgs.includes(o));
    }
    
    let hmAbxSet = new Set();
    hmOrgs.forEach(o => { 
        Object.keys(heatmapStats[o]).forEach(a => {
            if (heatmapStats[o][a].t > 0) hmAbxSet.add(a);
        }); 
    });
    let hmAbxs = Array.from(hmAbxSet);
    if (targetAbxs.length > 0) {
        hmAbxs = hmAbxs.filter(a => targetAbxs.includes(a));
    }
    
    hmOrgs.sort();
    hmAbxs.sort();

    if (hmOrgs.length > 0 && hmAbxs.length > 0) {
        let hmHtml = '<table class="heatmap-table"><thead><tr><th>Organism (n)</th>';
        hmAbxs.forEach(a => { hmHtml += `<th><div class="w-20 truncate" title="${a}">${a}</div></th>`; });
        hmHtml += '</tr></thead><tbody>';

        hmOrgs.forEach(o => {
            let rowHasData = hmAbxs.some(a => heatmapStats[o][a] && heatmapStats[o][a].t > 0);
            if(!rowHasData) return;

            let orgTotal = orgCounts[o] || 0;
            hmHtml += `<tr><th>${o} <span class="text-xs font-normal text-slate-400">(${orgTotal})</span></th>`;
            
            hmAbxs.forEach(a => {
                let cell = heatmapStats[o][a];
                if (!cell || cell.t === 0) {
                    hmHtml += '<td class="bg-slate-50 text-slate-300">-</td>';
                } else {
                    let targetVal = metric === 'R' ? cell.r : cell.s;
                    let p = Math.round((targetVal / cell.t) * 100);
                    let isLow = cell.t < 30;
                    
                    // منطق الألوان الذكي: إذا كان R فالعالي أحمر (خطر)، وإذا S فالعالي أخضر (جيد)
                    let dangerScore = metric === 'R' ? p : (100 - p);
                    
                    let bgClass = 'bg-white';
                    let textClass = 'text-slate-700';
                    
                    if (dangerScore <= 20) { bgClass = 'bg-emerald-100'; textClass = 'text-emerald-800'; }
                    else if (dangerScore <= 40) { bgClass = 'bg-yellow-100'; textClass = 'text-yellow-800'; }
                    else if (dangerScore <= 60) { bgClass = 'bg-orange-200'; textClass = 'text-orange-900'; }
                    else if (dangerScore <= 80) { bgClass = 'bg-red-400'; textClass = 'text-white font-bold'; }
                    else { bgClass = 'bg-red-600'; textClass = 'text-white font-bold'; }

                    if (isLow) {
                        if(dangerScore > 60) textClass = 'text-red-100';
                        else textClass += ' opacity-70';
                    }

                    hmHtml += `<td class="${bgClass} ${textClass}">${p}% ${isLow ? '<span class="text-[10px] text-red-500 font-bold ml-0.5">*</span>' : ''}</td>`;
                }
            });
            hmHtml += '</tr>';
        });
        hmHtml += '</tbody></table>';
        $('#heatmapWrapper').html(hmHtml);
    } else {
        $('#heatmapWrapper').html('<p class="text-center text-slate-400 py-4">No data matches the selected filters.</p>');
    }

    let sortedOrgs = Object.keys(orgCounts).sort((a,b)=>orgCounts[b]-orgCounts[a]).slice(0, 10);
    if(chartOrg_instance) chartOrg_instance.destroy();
    chartOrg_instance = new Chart(document.getElementById('chartOrg'), {
        type: 'doughnut',
        data: {
            labels: sortedOrgs,
            datasets: [{ data: sortedOrgs.map(o=>orgCounts[o]), backgroundColor: ['#0d9488','#0ea5e9','#3b82f6','#06b6d4','#14b8a6','#10b981','#84cc16','#eab308','#f59e0b','#f97316'] }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 10 } } } } }
    });

    let sortedSpecs = Object.keys(specCounts).sort((a,b)=>specCounts[b]-specCounts[a]);
    if(chartSpec_instance) chartSpec_instance.destroy();
    chartSpec_instance = new Chart(document.getElementById('chartSpecimen'), {
        type: 'bar',
        data: {
            labels: sortedSpecs,
            datasets: [{ label: 'Isolates', data: sortedSpecs.map(s=>specCounts[s]), backgroundColor: '#0ea5e9', borderRadius: 4 }]
        },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: {x: {grid: {color: '#f1f5f9'}}, y: {grid: {display: false}}} }
    });

    if(chartGen_instance) chartGen_instance.destroy();
    chartGen_instance = new Chart(document.getElementById('chartGender'), {
        type: 'pie',
        data: {
            labels: ['Male', 'Female'],
            datasets: [{ data: [genderCounts['Male'], genderCounts['Female']], backgroundColor: ['#0ea5e9', '#ec4899'] }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
    
    $('#print_sect_trend').removeClass('hidden');
}

// --- 7. Official File Export using Fetch + XlsxPopulate ---
function showExportModal() {
    let allRecords = JSON.parse(localStorage.getItem('amr_records')) || [];
    let years = new Set();
    let currentYear = new Date().getFullYear().toString();
    
    allRecords.forEach(r => {
        if(r.Date) years.add(r.Date.split('-')[0]);
    });
    if(years.size === 0) years.add(currentYear);
    
    let yearsOptions = Array.from(years).sort((a,b) => b-a).map(y => `<option value="${y}">${y}</option>`).join('');

    Swal.fire({
        title: 'Export Official Antibiogram',
        html: `
            <div class="text-left space-y-4">
                <p class="text-sm text-slate-500 bg-teal-50 p-3 rounded-lg border border-teal-100">Select the Year and Quarter. The system will automatically fetch <b>Antibiogram_5.xlsx</b> from the server, populate it accurately, and download it.</p>
                <div class="flex gap-4">
                    <div class="flex-1">
                        <label class="block text-sm font-bold text-slate-700 mb-1">Year</label>
                        <select id="export_year" class="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none">
                            ${yearsOptions}
                        </select>
                    </div>
                    <div class="flex-1">
                        <label class="block text-sm font-bold text-slate-700 mb-1">Quarter</label>
                        <select id="export_quarter" class="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none">
                            <option value="Q1">Quarter 1 (Jan, Feb, Mar)</option>
                            <option value="Q2">Quarter 2 (Apr, May, Jun)</option>
                            <option value="Q3">Quarter 3 (Jul, Aug, Sep)</option>
                            <option value="Q4">Quarter 4 (Oct, Nov, Dec)</option>
                        </select>
                    </div>
                </div>
            </div>
        `,
        showCancelButton: true, confirmButtonText: '📥 Download Excel', confirmButtonColor: '#10b981', cancelButtonColor: '#64748b',
        preConfirm: () => {
            const year = document.getElementById('export_year').value;
            const quarter = document.getElementById('export_quarter').value;
            if (!year || !quarter) { Swal.showValidationMessage('Please select Year and Quarter'); return false; }
            return { year, quarter };
        }
    }).then((result) => {
        if (result.isConfirmed) processAntibiogramExport(result.value.year, result.value.quarter);
    });
}
async function processAntibiogramExport(year, quarter) {
    let allRecords = JSON.parse(localStorage.getItem('amr_records')) || [];
    
    const quarterMonths = {
        "Q1": ["01", "02", "03"],
        "Q2": ["04", "05", "06"],
        "Q3": ["07", "08", "09"],
        "Q4": ["10", "11", "12"]
    };
    const targetMonths = quarterMonths[quarter];

    let records = allRecords.filter(r => {
        if (!r.Date) return false;
        let parts = r.Date.split('-');
        let rYear = parts[0];
        let rMonth = parts[1];
        return rYear === year && targetMonths.includes(rMonth);
    });

    if (records.length === 0) {
        Swal.fire('No Data', 'No records found in this selected quarter.', 'info');
        return;
    }

    Swal.fire({ title: 'Generating Ministry File...', text: 'Fetching template and applying data directly...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {
        const response = await fetch('Antibiogram_5.xlsx');
        if (!response.ok) throw new Error("Could not find 'Antibiogram_5.xlsx' in the repository. Ensure it is uploaded correctly next to the index.html file.");
        const arrayBuffer = await response.arrayBuffer();

        let stats = {};
        records.forEach(r => {
            let orgName = r['Antibiogram organism'];
            if (!orgName) return; 

            let rowNum = orgMapExport[orgName];
            if (!rowNum) return; 

            if (!stats[orgName]) stats[orgName] = { total: 0, abx: {} };
            stats[orgName].total += 1;

            Object.keys(abxMapExport).forEach(appAbx => {
                let result = r[appAbx];
                if (result && result !== '-' && result !== '') {
                    if (!stats[orgName].abx[appAbx]) stats[orgName].abx[appAbx] = { tested: 0, resistant: 0 };
                    stats[orgName].abx[appAbx].tested += 1; 
                    if (result === 'R') stats[orgName].abx[appAbx].resistant += 1; 
                }
            });
        });

        const workbook = await XlsxPopulate.fromDataAsync(arrayBuffer);
        const sheet = workbook.sheet(0);
        
        Object.keys(stats).forEach(org => {
            let rowNum = orgMapExport[org];
            if (rowNum && stats[org].total > 0) {
                sheet.cell(rowNum, 3).value(stats[org].total);

                Object.keys(stats[org].abx).forEach(abx => {
                    let cols = abxMapExport[abx];
                    if (cols) {
                        let s = stats[org].abx[abx];
                        if (s.tested > 0) {
                            sheet.cell(rowNum, cols.t).value(s.tested);
                            sheet.cell(rowNum, cols.r).value(s.resistant);
                        }
                    }
                });
            }
        });

        const quarterLabels = {
            "Q1": "Q1 (Jan - Mar)",
            "Q2": "Q2 (Apr - Jun)",
            "Q3": "Q3 (Jul - Sep)",
            "Q4": "Q4 (Oct - Dec)"
        };
        const periodString = `${quarterLabels[quarter]} ${year}`;
        
        sheet.cell("C1").value(`Period: ${periodString}`);

        const blob = await workbook.outputAsync();
        saveAs(blob, `Ministry_Antibiogram_${periodString}.xlsx`);
        Swal.fire('Success!', 'The official file has been exported successfully.', 'success');

    } catch (err) {
        console.error(err);
        Swal.fire('Error', err.message, 'error');
    }
}
