// --- 1. Master Data Definitions ---

const bacteriaLibrary = [
    { name: "Escherichia coli", code: "ECO", group: "Gram-Negative" },
    { name: "Klebsiella pneumoniae", code: "KPN", group: "Gram-Negative" },
    { name: "Klebsiella oxytoca", code: "KOX", group: "Gram-Negative" },
    { name: "Klebsiella aerogenes", code: "KAE", group: "Gram-Negative" },
    { name: "Enterobacter cloacae", code: "ECL", group: "Gram-Negative" },
    { name: "Enterobacter (spp)", code: "ENT", group: "Gram-Negative" },
    { name: "Proteus mirabilis", code: "PMI", group: "Gram-Negative" },
    { name: "Proteus vulgaris", code: "PVU", group: "Gram-Negative" },
    { name: "Proteus (other spp)", code: "PRO", group: "Gram-Negative" },
    { name: "Morganella morganii", code: "MMO", group: "Gram-Negative" },
    { name: "Providencia stuartii", code: "PST", group: "Gram-Negative" },
    { name: "Providencia rettgeri", code: "PRE", group: "Gram-Negative" },
    { name: "Providencia spp", code: "PRV", group: "Gram-Negative" },
    { name: "Serratia marcescens", code: "SMA", group: "Gram-Negative" },
    { name: "Serratia spp", code: "SER", group: "Gram-Negative" },
    { name: "Citrobacter freundii", code: "CFR", group: "Gram-Negative" },
    { name: "Citrobacter koseri", code: "CKO", group: "Gram-Negative" },
    { name: "Citrobacter (spp)", code: "CIT", group: "Gram-Negative" },
    { name: "Salmonella Typhi", code: "STY", group: "Gram-Negative" },
    { name: "Salmonella Typhimurium", code: "STM", group: "Gram-Negative" },
    { name: "Salmonella Enteritidis", code: "SEN", group: "Gram-Negative" },
    { name: "Salmonella spp", code: "SAL", group: "Gram-Negative" },
    { name: "Shigella sonnei", code: "SSO", group: "Gram-Negative" },
    { name: "Shigella flexneri", code: "SFL", group: "Gram-Negative" },
    { name: "Shigella dysenteriae", code: "SDY", group: "Gram-Negative" },
    { name: "Shigella (spp)", code: "SHI", group: "Gram-Negative" },
    { name: "Yersinia enterocolitica", code: "YEN", group: "Gram-Negative" },
    { name: "Enterobacteriaceae (other spp)", code: "EBO", group: "Gram-Negative" },
    { name: "Pseudomonas aeruginosa", code: "PAE", group: "Gram-Negative" },
    { name: "Pseudomonas putida", code: "PPU", group: "Gram-Negative" },
    { name: "Acinetobacter baumannii", code: "ABA", group: "Gram-Negative" },
    { name: "Acinetobacter lwoffii", code: "ALW", group: "Gram-Negative" },
    { name: "Acinetobacter spp.", code: "ACI", group: "Gram-Negative" },
    { name: "Stenotrophomonas maltophilia", code: "SML", group: "Gram-Negative" },
    { name: "Burkholderia cepacia complex", code: "BCC", group: "Gram-Negative" },
    { name: "Haemophilus influenzae", code: "HIN", group: "Gram-Negative" },
    { name: "Haemophilus parainfluenzae", code: "HPA", group: "Gram-Negative" },
    { name: "Neisseria gonorrhoeae", code: "NGO", group: "Gram-Negative" },
    { name: "Neisseria meningitidis", code: "NME", group: "Gram-Negative" },
    { name: "Moraxella catarrhalis", code: "MCA", group: "Gram-Negative" },
    { name: "Campylobacter jejuni", code: "CJE", group: "Gram-Negative" },
    { name: "Helicobacter pylori", code: "HPY", group: "Gram-Negative" },
    { name: "Vibrio cholerae", code: "VCH", group: "Gram-Negative" },
    { name: "Brucella melitensis", code: "BME", group: "Gram-Negative" },
    { name: "Brucella abortus", code: "BAB", group: "Gram-Negative" },
    { name: "Bacteroides fragilis", code: "BFR", group: "Gram-Negative" },
    { name: "Legionella pneumophila", code: "LPN", group: "Gram-Negative" },
    { name: "Chlamydia trachomatis", code: "CTR", group: "Gram-Negative" },
    { name: "Fusobacterium canifelinum", code: "FCA", group: "Gram-Negative" },
    { name: "Staphylococcus aureus", code: "SAU", group: "Gram-Positive" },
    { name: "Staphylococcus epidermidis", code: "SEP", group: "Gram-Positive" },
    { name: "Staphylococcus saprophyticus", code: "SSP", group: "Gram-Positive" },
    { name: "Staphylococcus haemolyticus", code: "SHM", group: "Gram-Positive" },
    { name: "Staphylococcus hominis", code: "SHO", group: "Gram-Positive" },
    { name: "Staphylococcus lugdunensis", code: "SLG", group: "Gram-Positive" },
    { name: "Staphylococcus non-aureus (spp) / CoNS", code: "CNS", group: "Gram-Positive" },
    { name: "Streptococcus pneumoniae", code: "SPN", group: "Gram-Positive" },
    { name: "Streptococcus pyogenes (Group A)", code: "SPY", group: "Gram-Positive" },
    { name: "Streptococcus agalactiae (Group B)", code: "SAG", group: "Gram-Positive" },
    { name: "Streptococcus mutans", code: "SMU", group: "Gram-Positive" },
    { name: "Streptococcus spp (β-hemolytic group)", code: "SBH", group: "Gram-Positive" },
    { name: "Streptococcus viridans", code: "SVI", group: "Gram-Positive" },
    { name: "Enterococcus faecalis", code: "EFA", group: "Gram-Positive" },
    { name: "Enterococcus faecium", code: "EFM", group: "Gram-Positive" },
    { name: "Enterococcus gallinarum / E. casseliflavus", code: "EGC", group: "Gram-Positive" },
    { name: "Enterococcus spp", code: "ENC", group: "Gram-Positive" },
    { name: "Listeria monocytogenes", code: "LMO", group: "Gram-Positive" },
    { name: "Listeria spp", code: "LIS", group: "Gram-Positive" },
    { name: "Corynebacterium diphtheriae", code: "CDI", group: "Gram-Positive" },
    { name: "Corynebacterium jeikeium", code: "CJE", group: "Gram-Positive" },
    { name: "Bacillus cereus", code: "BCE", group: "Gram-Positive" },
    { name: "Bacillus anthracis", code: "BAN", group: "Gram-Positive" },
    { name: "Bacillus spp", code: "BAC", group: "Gram-Positive" },
    { name: "Clostridium perfringens", code: "CPE", group: "Gram-Positive" },
    { name: "Clostridioides difficile", code: "CDF", group: "Gram-Positive" },
    { name: "Clostridium tetani", code: "CTE", group: "Gram-Positive" },
    { name: "Clostridium Spp", code: "CLO", group: "Gram-Positive" },
    { name: "Cutibacterium acnes", code: "CAC", group: "Gram-Positive" },
    { name: "Mycobacterium tuberculosis", code: "MTB", group: "Others" },
    { name: "Mycoplasma pneumoniae", code: "MPN", group: "Others" },
    { name: "Anaerobes (General)", code: "ANA", group: "Others" },
    { name: "Candida albicans", code: "CAL", group: "Fungi" },
    { name: "Candida auris", code: "CAU", group: "Fungi" }
];

const abxGroups = {
    "Penicillins": ["Benzylpenicillin", "Penicillin", "Ampicillin", "Amoxicillin", "Cloxacillin", "Oxacillin", "Amoxicillin/Clavulanic acid", "Ampicillin/Sulbactam", "Amoxicillin/Sulbactam", "Piperacillin", "Piperacillin/Tazobactam", "Ticarcillin", "Ticarcillin/Clavulanic acid", "Mecillinam"],
    "Cephalosporins": ["Cefazolin", "Cefoxitin", "Cefuroxime", "Cefixime", "Ceftriaxone", "Cefotaxime", "Ceftazidime", "Cefepime", "Cefaclor", "Cefpodoxime", "Cefdinir", "Cephalothin", "Cefoperazone", "Cefotetan", "Ceftaroline", "Ceftizoxime", "Ceftobiprole", "Ceftazidime/Avibactam", "Ceftolozane/Tazobactam", "Cefoxitin screen"],
    "Carbapenems & Monobactams": ["Imipenem", "Meropenem", "Ertapenem", "Doripenem", "Meropenem/Vaborbactam", "Imipenem/Relebactam", "Aztreonam"],
    "Aminoglycosides": ["Amikacin", "Gentamicin", "Gentamicin high-level", "Kanamycin high-level", "Tobramycin", "Netilmicin", "Streptomycin", "Kanamycin", "Plazomicin", "Spectinomycin"],
    "Fluoroquinolones": ["Nalidixic acid", "Ciprofloxacin", "Levofloxacin", "Moxifloxacin", "Ofloxacin", "Norfloxacin"],
    "Macrolides & Lincosamides": ["Erythromycin", "Azithromycin", "Clarithromycin", "Clindamycin", "Quinupristin/Dalfopristin", "Inducible Clindamycin Resistance"],
    "Glycopeptides": ["Vancomycin", "Teicoplanin", "Daptomycin", "Dalbavancin", "Oritavancin", "Telavancin"],
    "Tetracyclines": ["Tetracycline", "Doxycycline", "Minocycline", "Tigecycline"],
    "Others": ["Trimethoprim/Sulfamethoxazole", "Trimethoprim", "Sulfonamides", "Nitrofurantoin", "Fosfomycin", "Colistin", "Polymyxin B", "Linezolid", "Rifampicin", "Fusidic acid", "Mupirocin"],
    "Antifungals": ["Fluconazole", "Caspofungin", "Voriconazole", "Micafungin", "Anidulafungin", "Rezafungin", "Clotrimazole"]
};

const abxList = Object.values(abxGroups).flat();

const abxMapExport = {
    "Ampicillin": {t:4, r:5}, "Flucloxacillin": {t:7, r:8}, "Penicillin": {t:10, r:11},
    "Ampicillin/Sulbactam": {t:13, r:14}, "Amoxicillin": {t:16, r:17}, "Oxacillin": {t:19, r:20},
    "Amoxicillin/Clavulanic acid": {t:22, r:23}, "Piperacillin": {t:25, r:26}, "Ticarcillin": {t:28, r:29},
    "Ticarcillin/Clavulanic acid": {t:31, r:32}, "Piperacillin/Tazobactam": {t:34, r:35},
    "Ceftriaxone": {t:37, r:38}, "Cefotaxime": {t:40, r:41}, "Ceftazidime": {t:43, r:44},
    "Cefepime": {t:46, r:47}, "Cefoxitin": {t:49, r:50}, "Cefazolin": {t:52, r:53}, "Cefixime": {t:55, r:56},
    "Cefaclor": {t:58, r:59}, "Cefpodoxime": {t:61, r:62}, "Cefdinir": {t:64, r:65}, "Cephalothin": {t:67, r:68},
    "Cefuroxime": {t:70, r:71}, "Amikacin": {t:73, r:74}, "Gentamicin": {t:76, r:77},
    "Tobramycin": {t:79, r:80}, "Netilmicin": {t:82, r:83}, "Imipenem": {t:85, r:86},
    "Meropenem": {t:88, r:89}, "Ertapenem": {t:91, r:92}, "Aztreonam": {t:94, r:95},
    "Azithromycin": {t:97, r:98}, "Clarithromycin": {t:100, r:101}, "Erythromycin": {t:103, r:104},
    "Ciprofloxacin": {t:106, r:107}, "Moxifloxacin": {t:109, r:110}, "Levofloxacin": {t:112, r:113},
    "Teicoplanin": {t:115, r:116}, "Vancomycin": {t:118, r:119}, "Tigecycline": {t:121, r:122},
    "Tetracycline": {t:124, r:125}, "Doxycycline": {t:127, r:128}, "Colistin": {t:130, r:131},
    "Chloramphenicol": {t:133, r:134}, "Trimethoprim/Sulfamethoxazole": {t:136, r:137},
    "Rifampicin": {t:139, r:140}, "Nitrofurantoin": {t:142, r:143}, "Trimethoprim": {t:145, r:146},
    "Sulfisoxazole": {t:148, r:149}, "Fosfomycin": {t:151, r:152}, "Clindamycin": {t:154, r:155},
    "Metronidazole": {t:157, r:158}, "Fusidic acid": {t:160, r:161}
};

const orgMapExport = {
    "E.coli": 6, "klebsiella pneumoniae": 7, "proteus mirabillis": 8, "proteus (other spp)": 9, 
    "citrobacter (spp)": 10, "enterobacter (spp)": 11, "providencia spp": 12, "salmonella spp": 13, 
    "shigella (spp)": 14, "serratia": 15, "yersinia enterocoliticae": 16, "enterobacteriaceae (other spp)": 17,
    "acinetobacter baumannii": 18, "acinetobacter spp.": 19, "burkholderia cepacia complex": 20,
    "pseudomonas aeruginosa": 21, "hemophilus influenzae": 22, "neisseria gonorrhoeae": 23,
    "neisseria meningitis": 24, "bacteroides fragilis": 25, "chlamydia trachomatis": 26,
    "helicobacter pylori": 27, "Fusobacterium canifelinum": 28, "staphylococcus aureus": 29,
    "staphylococcus non-aureus (spp)": 30, "streptococcus pneumoniae": 31,
    "streptococcus pyogenes (groupnA)": 32, "listeria": 33, "clostridium Spp": 34,
    "bacillus": 35, "enterococcus faecalis": 36, "enterococcus spp": 37,
    "mycobacterium tuberculosis": 38, "streptococcus spp (β-hemolytic group)": 39,
    "streptococcus viridans": 40, "anaerobes": 41, "Enterococcus faecium": 42,
    "Enterococcus gallinarum/E. casseliflavus": 43
};

const defaultSamples = ["Blood", "Urine", "Sputum", "Wound Swab", "CSF", "Pus", "Stool", "Aspirate"];
const defaultWards = [
    "Pediatrics", 
    "Emergency", 
    "CCU", 
    "Internal Medicine", 
    "Surgery", 
    "Neonatal Unit", 
    "Neonatal ICU", 
    "Pediatric ICU", 
    "ICU", 
    "Obstetrics & Gynecology", 
    "Neurosurgery", 
    "Orthopedics",
    "Epidemiology / Isolation"
];

// WHONET Fallback Mapping
const whonetOrgMap = {
    "eco": "Escherichia coli", "kpn": "Klebsiella pneumoniae", "kox": "Klebsiella oxytoca", 
    "kae": "Klebsiella aerogenes", "ecl": "Enterobacter cloacae", "ent": "Enterobacter (spp)", 
    "pmi": "Proteus mirabilis", "pvu": "Proteus vulgaris", "pro": "Proteus (other spp)", 
    "mmo": "Morganella morganii", "pst": "Providencia stuartii", "pre": "Providencia rettgeri", 
    "prv": "Providencia spp", "sma": "Serratia marcescens", "ser": "Serratia spp", 
    "cfr": "Citrobacter freundii", "cko": "Citrobacter koseri", "cit": "Citrobacter (spp)", 
    "sty": "Salmonella Typhi", "stm": "Salmonella Typhimurium", "sen": "Salmonella Enteritidis", 
    "sal": "Salmonella spp", "sso": "Shigella sonnei", "sfl": "Shigella flexneri", 
    "sdy": "Shigella dysenteriae", "shi": "Shigella (spp)", "yen": "Yersinia enterocolitica", 
    "ebo": "Enterobacteriaceae (other spp)", "pae": "Pseudomonas aeruginosa", "ppu": "Pseudomonas putida", 
    "aba": "Acinetobacter baumannii", "alw": "Acinetobacter lwoffii", "aci": "Acinetobacter spp.", 
    "sml": "Stenotrophomonas maltophilia", "bcc": "Burkholderia cepacia complex", "hin": "Haemophilus influenzae", 
    "hpa": "Haemophilus parainfluenzae", "ngo": "Neisseria gonorrhoeae", "nme": "Neisseria meningitidis", 
    "mca": "Moraxella catarrhalis", "cje": "Campylobacter jejuni", "hpy": "Helicobacter pylori", 
    "vch": "Vibrio cholerae", "bme": "Brucella melitensis", "bab": "Brucella abortus", 
    "bfr": "Bacteroides fragilis", "lpn": "Legionella pneumophila", "ctr": "Chlamydia trachomatis", 
    "fca": "Fusobacterium canifelinum", "sau": "Staphylococcus aureus", "sep": "Staphylococcus epidermidis", 
    "ssp": "Staphylococcus saprophyticus", "shm": "Staphylococcus haemolyticus", "sho": "Staphylococcus hominis", 
    "slg": "Staphylococcus lugdunensis", "cns": "Staphylococcus non-aureus (spp) / CoNS", "sta": "Staphylococcus spp", 
    "spn": "Streptococcus pneumoniae", "spy": "Streptococcus pyogenes (Group A)", "sag": "Streptococcus agalactiae (Group B)", 
    "smu": "Streptococcus mutans", "sbh": "Streptococcus spp (β-hemolytic group)", "svi": "Streptococcus viridans", 
    "efa": "Enterococcus faecalis", "efm": "Enterococcus faecium", "egc": "Enterococcus gallinarum / E. casseliflavus", 
    "enc": "Enterococcus spp", "lmo": "Listeria monocytogenes", "lis": "Listeria spp", 
    "cdi": "Corynebacterium diphtheriae", "bce": "Bacillus cereus", "ban": "Bacillus anthracis", 
    "bac": "Bacillus spp", "cpe": "Clostridium perfringens", "cdf": "Clostridioides difficile", 
    "cte": "Clostridium tetani", "clo": "Clostridium Spp", "cac": "Cutibacterium acnes",
    "mtb": "Mycobacterium tuberculosis", "mpn": "Mycoplasma pneumoniae", "ana": "Anaerobes (General)", 
    "cal": "Candida albicans", "cau": "Candida auris", "cgl": "Candida glabrata", "cpa": "Candida parapsilosis",
    "eae": "Enterobacter aerogenes", "cfr": "Citrobacter freundii", 
    "ckr": "Citrobacter koseri", "sca": "Staphylococcus capitis"
};


// =====================================================================
// First-isolate deduplication (CLSI M39)
// One isolate per patient per organism per analysis year.
// Identification number in WHONET restarts every year, so the key is
// (Patient ID + year of isolate + organism). The earliest isolate by
// date is kept (not the first in array order).
// =====================================================================
function getDedupPatientId(r) {
    const raw = String(r['Patient ID'] || r['Name'] || '').trim().toLowerCase();
    if (!raw || raw === 'unknown' || raw === 'unknown patient') return '';
    return raw;
}

// Screening / surveillance cultures must be excluded from the antibiogram (CLSI M39).
const SCREENING_SPECIMEN_REGEX = /\b(rectal|perirectal|nasal|nares|axilla|axillary|groin|inguinal)\s+swabs?\b|screening|surveillance/i;
function isScreeningSpecimen(r) {
    return SCREENING_SPECIMEN_REGEX.test(String(r['Sample'] || ''));
}

// Non-susceptible = Intermediate, Susceptible-dose dependent, or Resistant
function isNonSusceptibleResult(v) {
    v = String(v || '').trim().toUpperCase();
    return v === 'R' || v === 'I' || v === 'SDD';
}

function applyDeduplication(records) {
    records = records.filter(r => !isScreeningSpecimen(r));
    const winners = new Map(); // key -> chosen record
    const keyOf = (r) => {
        const pid = getDedupPatientId(r);
        const year = String(r['Date'] || '').substring(0, 4);
        const org = String(r['Selective organism'] || '').trim().toLowerCase();
        // Cannot dedup without patient id, a valid year, or an organism: keep the record
        if (!pid || !/^\d{4}$/.test(year) || !org) return null;
        return pid + '|' + year + '|' + org;
    };

    records.forEach(r => {
        const key = keyOf(r);
        if (key === null) return;
        const cur = winners.get(key);
        if (!cur || String(r['Specimen Date'] || r['Date']) < String(cur['Specimen Date'] || cur['Date'])) winners.set(key, r);
    });

    return records.filter(r => {
        const key = keyOf(r);
        return key === null || winners.get(key) === r;
    });
}


// =====================================================================
// MDR / XDR classification (Magiorakos et al., Clin Microbiol Infect 2012)
// - Non-susceptible (NS) = I or R.
// - MDR: NS to >=1 agent in >=3 antimicrobial categories.
// - XDR: NS to >=1 agent in all but <=2 categories of ALL categories that
//   apply to the organism (untested categories are unknown, not susceptible).
//   With routine panels XDR is therefore only established when the panel is
//   broad enough. "possibleXDR" flags isolates that look XDR on the tested
//   categories but whose panel is too narrow to confirm it.
// - Only organisms with a defined category list are classified:
//   Enterobacterales, P. aeruginosa, Acinetobacter spp., S. aureus.
// - Intrinsic resistance is excluded from the category counts.
// >>> Category lists and intrinsic-resistance exclusions below should be
// >>> reviewed by the clinical pharmacist; edit them here only.
// =====================================================================
const MDR_MIN_TESTED_FOR_POSSIBLE_XDR = 6;

const MDR_TABLES = {
    'Enterobacterales': {
        'Aminoglycosides': ['Gentamicin', 'Tobramycin', 'Amikacin', 'Netilmicin'],
        'Antipseudomonal penicillins + BLI': ['Piperacillin/Tazobactam', 'Ticarcillin/Clavulanic acid'],
        'Carbapenems': ['Ertapenem', 'Imipenem', 'Meropenem', 'Doripenem'],
        'Cephalosporins (1st/2nd gen)': ['Cefazolin', 'Cefuroxime'],
        'Cephalosporins (3rd/4th gen)': ['Cefotaxime', 'Ceftriaxone', 'Ceftazidime', 'Cefepime'],
        'Cephamycins': ['Cefoxitin', 'Cefotetan'],
        'Fluoroquinolones': ['Ciprofloxacin', 'Levofloxacin', 'Ofloxacin', 'Moxifloxacin'],
        'Folate pathway inhibitors': ['Trimethoprim/Sulfamethoxazole'],
        'Glycylcyclines': ['Tigecycline'],
        'Monobactams': ['Aztreonam'],
        'Penicillins': ['Ampicillin'],
        'Penicillins + BLI': ['Amoxicillin/Clavulanic acid', 'Ampicillin/Sulbactam'],
        'Phosphonic acids': ['Fosfomycin'],
        'Polymyxins': ['Colistin', 'Polymyxin B'],
        'Tetracyclines': ['Tetracycline', 'Doxycycline', 'Minocycline']
    },
    'Pseudomonas aeruginosa': {
        'Aminoglycosides': ['Gentamicin', 'Tobramycin', 'Amikacin', 'Netilmicin'],
        'Antipseudomonal carbapenems': ['Imipenem', 'Meropenem', 'Doripenem'],
        'Antipseudomonal cephalosporins': ['Ceftazidime', 'Cefepime'],
        'Antipseudomonal fluoroquinolones': ['Ciprofloxacin', 'Levofloxacin'],
        'Antipseudomonal penicillins + BLI': ['Piperacillin/Tazobactam', 'Ticarcillin/Clavulanic acid'],
        'Monobactams': ['Aztreonam'],
        'Phosphonic acids': ['Fosfomycin'],
        'Polymyxins': ['Colistin', 'Polymyxin B']
    },
    'Acinetobacter spp.': {
        'Aminoglycosides': ['Gentamicin', 'Tobramycin', 'Amikacin', 'Netilmicin'],
        'Antipseudomonal carbapenems': ['Imipenem', 'Meropenem', 'Doripenem'],
        'Antipseudomonal fluoroquinolones': ['Ciprofloxacin', 'Levofloxacin'],
        'Antipseudomonal penicillins + BLI': ['Piperacillin/Tazobactam', 'Ticarcillin/Clavulanic acid'],
        'Extended-spectrum cephalosporins': ['Cefotaxime', 'Ceftriaxone', 'Ceftazidime', 'Cefepime'],
        'Folate pathway inhibitors': ['Trimethoprim/Sulfamethoxazole'],
        'Penicillins + BLI': ['Ampicillin/Sulbactam'],
        'Polymyxins': ['Colistin', 'Polymyxin B'],
        'Tetracyclines': ['Tetracycline', 'Doxycycline', 'Minocycline']
    },
    'Staphylococcus aureus': {
        'Aminoglycosides': ['Gentamicin'],
        'Ansamycins': ['Rifampicin'],
        'Anti-MRSA cephalosporins': ['Ceftaroline'],
        'Anti-staphylococcal beta-lactams': ['Oxacillin', 'Cefoxitin', 'Cefoxitin screen'],
        'Fluoroquinolones': ['Ciprofloxacin', 'Levofloxacin', 'Moxifloxacin'],
        'Folate pathway inhibitors': ['Trimethoprim/Sulfamethoxazole'],
        'Fusidane': ['Fusidic acid'],
        'Glycopeptides': ['Vancomycin', 'Teicoplanin'],
        'Glycylcyclines': ['Tigecycline'],
        'Lincosamides': ['Clindamycin'],
        'Lipopeptides': ['Daptomycin'],
        'Macrolides': ['Erythromycin', 'Azithromycin', 'Clarithromycin'],
        'Oxazolidinones': ['Linezolid'],
        'Phosphonic acids': ['Fosfomycin'],
        'Streptogramins': ['Quinupristin/Dalfopristin'],
        'Tetracyclines': ['Tetracycline', 'Doxycycline', 'Minocycline']
    }
};

// Intrinsic (expected) resistance: categories excluded for these organisms.
const MDR_INTRINSIC_RULES = [
    { test: /klebsiella|raoultella|citrobacter koseri|citrobacter diversus/, exclude: ['Penicillins'] },
    { test: /enterobacter|klebsiella aerogenes|citrobacter freundii|serratia|morganella/,
      exclude: ['Penicillins', 'Penicillins + BLI', 'Cephalosporins (1st/2nd gen)', 'Cephamycins'] },
    { test: /proteus|morganella|providencia|serratia/, exclude: ['Polymyxins'] },
    { test: /proteus|morganella|providencia/, exclude: ['Tetracyclines', 'Glycylcyclines'] }
];

function getMdrGroup(orgLower) {
    if (/^(escherichia|klebsiella|raoultella|enterobacter|proteus|morganella|providencia|serratia|citrobacter|salmonella|shigella|yersinia|hafnia|pantoea|cronobacter|edwardsiella|enterobacteriaceae)/.test(orgLower)) return 'Enterobacterales';
    if (orgLower.includes('pseudomonas aeruginosa')) return 'Pseudomonas aeruginosa';
    if (orgLower.startsWith('acinetobacter')) return 'Acinetobacter spp.';
    if (orgLower.includes('staphylococcus aureus')) return 'Staphylococcus aureus';
    return null;
}

// Returns { cls: 'Non-MDR'|'MDR'|'XDR', ns, tested, total, group, possibleXDR } or null if not classifiable.
function classifyMDR(r) {
    const orgLower = String(r['Selective organism'] || '').trim().toLowerCase();
    const group = getMdrGroup(orgLower);
    if (!group) return null;

    const excluded = new Set();
    MDR_INTRINSIC_RULES.forEach(rule => { if (rule.test.test(orgLower)) rule.exclude.forEach(c => excluded.add(c)); });

    let tested = 0, ns = 0, total = 0;
    Object.keys(MDR_TABLES[group]).forEach(cat => {
        if (excluded.has(cat)) return;
        total++;
        let anyTested = false, anyNS = false;
        MDR_TABLES[group][cat].forEach(abx => {
            const v = String(r[abx] || '').trim().toUpperCase();
            if (v === 'S' || v === 'I' || v === 'R' || v === 'SDD') {
                anyTested = true;
                if (v !== 'S') anyNS = true;
            }
        });
        if (anyTested) { tested++; if (anyNS) ns++; }
    });

    let cls = 'Non-MDR', possibleXDR = false;
    if (ns >= 3) {
        cls = 'MDR';
        if (ns >= total - 2) cls = 'XDR';
        else if (tested >= MDR_MIN_TESTED_FOR_POSSIBLE_XDR && (tested - ns) <= 2) possibleXDR = true;
    }
    return { cls, ns, tested, total, group, possibleXDR };
}


// =====================================================================
// MIC helpers and staphylococcal vancomycin rules (CLSI M100)
// - Vancomycin for Staphylococcus must be tested by MIC; disk diffusion has no
//   valid breakpoints, so disk results for staphylococci are not used.
// - MIC values must be on the 2-fold dilution scale (0.5, 1, 2, 4 ... 32);
//   anything else (e.g. 116, 23) is a data-entry error.
// - Breakpoints: S. aureus S<=2, I 4-8, R>=16 | other staphylococci S<=4, I 8-16, R>=32.
// Set EXCLUDE_INVALID_STAPH_VANCOMYCIN = false to keep staphylococcal
// vancomycin results exactly as reported by the lab (the Ministry template
// contains a Vancomycin column and would then be fed as before).
// =====================================================================
const EXCLUDE_INVALID_STAPH_VANCOMYCIN = true;

// Returns { letter } for S/I/R typed in an MIC field, { numeric, op, valid, text } for numbers, or null.
function parseMicValue(raw) {
    const t = String(raw === undefined || raw === null ? '' : raw).trim();
    if (!t) return null;
    const up = t.toUpperCase();
    if (up === 'S' || up === 'I' || up === 'R') return { letter: up };
    const m = t.match(/^(<=|>=|<|>|≤|≥)?\s*(\d+(?:\.\d+)?)$/);
    if (!m) return { numeric: null, valid: false, text: t };
    const num = parseFloat(m[2]);
    const lg = Math.log2(num);
    const valid = num > 0 && Math.abs(lg - Math.round(lg)) < 0.1;
    let op = m[1] || '';
    if (op === '≤') op = '<='; if (op === '≥') op = '>=';
    return { numeric: num, op: op, valid: valid, text: t };
}

// S/I/R for staphylococcal vancomycin from an MIC (CLSI M100 breakpoints)
function interpretStaphVancomycinMic(isAureus, mic) {
    if (!mic || mic.numeric === null || !mic.valid) return null;
    let v = mic.numeric;
    if (mic.op === '<') v = v / 2;      // "<4" means 2 or lower on the dilution scale
    if (mic.op === '>') v = v * 2;      // ">8" means 16 or higher
    const sMax = isAureus ? 2 : 4, rMin = isAureus ? 16 : 32;
    if (v <= sMax) return 'S';
    if (v >= rMin) return 'R';
    return 'I';
}

// Decide what to store for Vancomycin on a staphylococcal isolate.
// vanSources: { disk: 'S'|'I'|'R', mic: 'S'|'I'|'R' } as reported in the WHONET interpretation file
// rawMicText: the raw MIC text from the WHONET values file (or null when that file was not provided)
// Returns { action: 'keep'|'drop'|'set', value, micText, flag }
function resolveStaphVancomycin(orgLower, vanSources, rawMicText) {
    const keep = { action: 'keep', flag: null, micText: null };
    if (!orgLower.startsWith('staphylococcus')) return keep;
    const isAureus = orgLower.includes('staphylococcus aureus');
    const dropOrKeep = (flag) => ({ action: EXCLUDE_INVALID_STAPH_VANCOMYCIN ? 'drop' : 'keep', flag: flag, micText: null });
    const hasMic = vanSources.mic !== undefined, hasDisk = vanSources.disk !== undefined;

    if (!hasMic && hasDisk && !rawMicText) return dropOrKeep('vanc_disk');

    const mic = parseMicValue(rawMicText);
    if (mic && mic.letter) {
        if (mic.letter === 'S') return keep;
        return dropOrKeep('vanc_typed_IR');
    }
    if (mic && mic.numeric !== undefined) {
        if (!mic.valid) { const r = dropOrKeep('vanc_mic_invalid'); r.micText = mic.text; return r; }
        const derived = interpretStaphVancomycinMic(isAureus, mic);
        let flag = null;
        if (vanSources.mic && vanSources.mic !== derived) flag = 'vanc_interp_mismatch';
        else if (isAureus && derived === 'R') flag = 'vanc_candidate';
        return { action: 'set', value: derived, micText: isAureus ? mic.text : null, flag: flag };
    }
    if (isAureus && (vanSources.mic === 'R' || vanSources.mic === 'I')) return { action: 'keep', flag: 'vanc_needs_mic', micText: null };
    return keep;
}

// Patient ID + year conflicts: the same Identification number in the same year with different names
function normalizePersonName(n) {
    return String(n || '').toLowerCase().replace(/[^a-z؀-ۿ ]/g, ' ').replace(/\s+/g, ' ').trim();
}
function findIdNameConflicts(records) {
    const groups = new Map();
    records.forEach(r => {
        const id = String(r['Patient ID'] || '').trim().toLowerCase();
        const year = String(r['Date'] || '').substring(0, 4);
        const nm = normalizePersonName(r['Name']);
        if (!id || id === 'unknown' || !/^\d{4}$/.test(year) || !nm || nm === 'unknown patient') return;
        const key = id + '|' + year;
        if (!groups.has(key)) groups.set(key, new Set());
        groups.get(key).add(nm);
    });
    const out = [];
    groups.forEach((names, key) => { if (names.size > 1) out.push({ id: key.split('|')[0], year: key.split('|')[1], names: names.size }); });
    return out;
}

// =====================================================================
// Critical resistance markers - defined ONCE for the dashboard and the PC app.
// Based on WHO GLASS / WHO bacterial priority pathogens and CLSI M100.
//  - "3GC-R" is a phenotypic PROXY for ESBL; "ESBL (lab)" uses the laboratory's
//    confirmed ESBL flag imported from WHONET.
//  - CRE covers all Enterobacterales; "CPE (lab)" uses the lab carbapenemase flag.
//  - CRAB and CRPA follow the WHO priority list.
//  - MRSA is decided by cefoxitin (CLSI), oxacillin only if cefoxitin was not
//    tested, and the lab MRSA flag only if neither was tested.
//  - VRE is decided by vancomycin only (teicoplanin-R alone is not VRE).
//  - VRSA = S. aureus with a numeric vancomycin MIC >= 16. It stays a
//    candidate until confirmed (VRSA Confirmation = '+').
// A marker is counted per first isolate; "tested" = isolates with a usable result.
// =====================================================================
function labFlagResult(v) {
    v = String(v || '').trim();
    if (v === '+') return { tested: true, resistant: true };
    if (v === '-') return { tested: true, resistant: false };
    return null;
}

const CRITICAL_MARKERS = [
    { label: "3GC-R", info: "Third-generation cephalosporin resistance (ceftriaxone, cefotaxime or ceftazidime) in E. coli and K. pneumoniae. WHO GLASS phenotypic proxy for ESBL production.", abxPriority: [["Ceftriaxone", "Cefotaxime", "Ceftazidime"]],
      match: o => o.includes("escherichia coli") || o.includes("klebsiella pneumoniae") },
    { label: "ESBL", info: "ESBL confirmed by the laboratory (WHONET flag) in E. coli and K. pneumoniae.",
      match: o => o.includes("escherichia coli") || o.includes("klebsiella pneumoniae"),
      evaluate: r => labFlagResult(r['Lab ESBL']) },
    { label: "CRE", info: "Carbapenem-resistant Enterobacterales: resistant to ertapenem, meropenem, imipenem or doripenem.", abxPriority: [["Ertapenem", "Meropenem", "Imipenem", "Doripenem"]],
      match: o => getMdrGroup(o) === 'Enterobacterales' },
    { label: "CPE", info: "Carbapenemase production confirmed by the laboratory (WHONET flag) in Enterobacterales.",
      match: o => getMdrGroup(o) === 'Enterobacterales',
      evaluate: r => labFlagResult(r['Lab Carbapenemase']) },
    { label: "CRAB", info: "Carbapenem-resistant Acinetobacter baumannii (imipenem, meropenem or doripenem). WHO critical priority pathogen.", abxPriority: [["Imipenem", "Meropenem", "Doripenem"]],
      match: o => o.includes("acinetobacter baumannii") || o.includes("acinetobacter calcoaceticus") },
    { label: "CRPA", info: "Carbapenem-resistant Pseudomonas aeruginosa (imipenem, meropenem or doripenem). WHO high priority pathogen.", abxPriority: [["Imipenem", "Meropenem", "Doripenem"]],
      match: o => o.includes("pseudomonas aeruginosa") },
    { label: "MRSA", info: "Methicillin-resistant S. aureus. Decided by cefoxitin (CLSI); oxacillin only if cefoxitin was not tested; the laboratory MRSA flag only if neither was tested.", abxPriority: [["Cefoxitin", "Cefoxitin screen"], ["Oxacillin"]], fallbackFlag: 'Lab MRSA',
      match: o => o.includes("staphylococcus aureus") },
    { label: "VRE", info: "Vancomycin-resistant Enterococcus. Decided by vancomycin only (teicoplanin resistance alone does not count).", abxPriority: [["Vancomycin"]],
      match: o => o.includes("enterococcus") },
    { label: "VRSA", info: "S. aureus with a vancomycin MIC of 16 µg/mL or more (CLSI M100). Remains a candidate until confirmed by a reference laboratory.",
      match: o => o.includes("staphylococcus aureus"),
      evaluate: r => {
          const mic = parseMicValue(r['Vancomycin MIC']);
          if (!mic || mic.numeric === undefined || mic.numeric === null || !mic.valid) return null;
          return { tested: true, resistant: interpretStaphVancomycinMic(true, mic) === 'R' };
      } }
];

function evaluateCriticalMarkers(records) {
    const stats = CRITICAL_MARKERS.map(m => ({ label: m.label, tested: 0, resistant: 0 }));
    records.forEach(r => {
        const orgLower = String(r['Selective organism'] || '').trim().toLowerCase();
        CRITICAL_MARKERS.forEach((m, i) => {
            if (!m.match(orgLower)) return;
            if (m.evaluate) {
                const res = m.evaluate(r);
                if (res) { stats[i].tested++; if (res.resistant) stats[i].resistant++; }
                return;
            }
            for (const group of m.abxPriority) {
                const results = group.map(a => String(r[a] || '').trim().toUpperCase())
                                     .filter(v => v === 'S' || v === 'I' || v === 'R' || v === 'SDD');
                if (results.length === 0) continue;   // try next agent group
                stats[i].tested++;
                if (results.includes('R')) stats[i].resistant++;
                return;
            }
            if (m.fallbackFlag) {
                const res = labFlagResult(r[m.fallbackFlag]);
                if (res) { stats[i].tested++; if (res.resistant) stats[i].resistant++; }
            }
        });
    });
    return stats;
}

// Non-antibiotic fields stored on a record (must never be rendered as antibiotic dropdowns)
const RECORD_META_FIELDS = ['Specimen Date', 'Lab ESBL', 'Lab Carbapenemase', 'Lab MRSA', 'VRSA Confirmation', 'Vancomycin MIC', 'Original ID', 'Name Original'];

// =====================================================================
// WHO AWaRe classification (WHO Essential Medicines List 2023).
// Only agents whose category is unambiguous are listed; others stay unclassified.
// =====================================================================
const AWARE_CLASS = {
    // Access
    "Benzylpenicillin": "A", "Penicillin": "A", "Ampicillin": "A", "Amoxicillin": "A", "Cloxacillin": "A", "Oxacillin": "A",
    "Amoxicillin/Clavulanic acid": "A", "Ampicillin/Sulbactam": "A", "Cefazolin": "A", "Gentamicin": "A", "Amikacin": "A",
    "Clindamycin": "A", "Doxycycline": "A", "Nitrofurantoin": "A", "Trimethoprim": "A", "Trimethoprim/Sulfamethoxazole": "A",
    "Chloramphenicol": "A", "Spectinomycin": "A",
    // Watch
    "Cefuroxime": "W", "Cefixime": "W", "Ceftriaxone": "W", "Cefotaxime": "W", "Ceftazidime": "W", "Cefepime": "W", "Cefoxitin": "W",
    "Cefpodoxime": "W", "Cefaclor": "W", "Cefotetan": "W", "Cefoperazone": "W",
    "Piperacillin": "W", "Piperacillin/Tazobactam": "W", "Ticarcillin": "W", "Ticarcillin/Clavulanic acid": "W",
    "Imipenem": "W", "Meropenem": "W", "Ertapenem": "W", "Doripenem": "W",
    "Ciprofloxacin": "W", "Levofloxacin": "W", "Moxifloxacin": "W", "Ofloxacin": "W", "Norfloxacin": "W",
    "Azithromycin": "W", "Clarithromycin": "W", "Erythromycin": "W", "Vancomycin": "W", "Teicoplanin": "W",
    "Tobramycin": "W", "Streptomycin": "W", "Kanamycin": "W", "Rifampicin": "W",
    // Reserve
    "Colistin": "R", "Polymyxin B": "R", "Linezolid": "R", "Tigecycline": "R", "Daptomycin": "R", "Plazomicin": "R",
    "Ceftazidime/Avibactam": "R", "Ceftolozane/Tazobactam": "R", "Ceftaroline": "R", "Ceftobiprole": "R",
    "Meropenem/Vaborbactam": "R", "Imipenem/Relebactam": "R", "Telavancin": "R", "Quinupristin/Dalfopristin": "R"
};
function awareTag(abx) { return AWARE_CLASS[abx] ? ` [${AWARE_CLASS[abx]}]` : ''; }

// =====================================================================
// Selective testing: when only part of the isolates of a species were tested for a drug
// (e.g. colistin only on suspected carbapenem-resistant isolates), %R is biased upward.
// =====================================================================
const SELECTIVE_TESTING_THRESHOLD = 0.5;
function isSelectivelyTested(testedCount, totalIsolates) {
    return totalIsolates >= 30 && testedCount > 0 && (testedCount / totalIsolates) < SELECTIVE_TESTING_THRESHOLD;
}

// =====================================================================
// Possible contaminants: skin-flora organisms in BLOOD cultures. A single positive set
// of these is often a contaminant; they are flagged (not removed) for clinical review.
// =====================================================================
const CONTAMINANT_REGEX = /staphylococcus (epidermidis|hominis|haemolyticus|capitis|warneri|auricularis|cohnii|xylosus|simulans)|coagulase|corynebacterium|micrococcus|bacillus (?!anthracis)|cutibacterium|propionibacterium|streptococcus (viridans|mitis|oralis|sanguinis|salivarius)/i;
function isPossibleContaminant(r) {
    return /blood/i.test(String(r['Sample'] || '')) && CONTAMINANT_REGEX.test(String(r['Selective organism'] || ''));
}

// =====================================================================
// Privacy for the public dashboard document:
// no names, no internal ids, Patient ID replaced by a salted SHA-256 pseudonym
// (same patient -> same pseudonym, so first-isolate de-duplication still works).
// =====================================================================
async function sha256Hex(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function buildPublicRecords(records, salt) {
    const cache = new Map();
    const out = [];
    for (const r of records) {
        const copy = { ...r };
        delete copy['Name']; delete copy['_uid']; delete copy['Name Original']; delete copy['Original ID'];
        const pid = String(r['Patient ID'] || '').trim().toLowerCase();
        const year = String(r['Date'] || '').substring(0, 4);
        if (pid && pid !== 'unknown') {
            const k = pid;
            if (!cache.has(k)) cache.set(k, (await sha256Hex(salt + '|' + k)).substring(0, 16));
            copy['Patient ID'] = cache.get(k);
        } else {
            copy['Patient ID'] = '';
        }
        out.push(copy);
    }
    return out;
}

// =====================================================================
// Organism nomenclature: old / synonym names -> current accepted names.
// Applied to 'Selective organism' (all analytics and charts). 'Antibiogram organism'
// (used only by the Ministry export) is never changed by this.
// Candida glabrata is kept (CLSI M60 / WHO still use it; Nakaseomyces glabratus is the taxonomic synonym).
// =====================================================================
const ORGANISM_SYNONYMS = {
    "xanthomonas maltophilia": "Stenotrophomonas maltophilia",
    "pseudomonas maltophilia": "Stenotrophomonas maltophilia",
    "proteus morganii": "Morganella morganii",
    "morganella morgani": "Morganella morganii",
    "klebsiella mobilis": "Klebsiella aerogenes",
    "enterobacter aerogenes": "Klebsiella aerogenes",
    "enterobacter sakazakii": "Cronobacter sakazakii",
    "enterobacter agglomerans": "Pantoea agglomerans",
    "erwinia agglomerans": "Pantoea agglomerans",
    "citrobacter diversus": "Citrobacter koseri",
    "pseudomonas cepacia": "Burkholderia cepacia complex",
    "alcaligenes xylosoxidans": "Achromobacter xylosoxidans",
    "flavobacterium meningosepticum": "Elizabethkingia meningoseptica",
    "chryseobacterium meningosepticum": "Elizabethkingia meningoseptica",
    "torulopsis glabrata": "Candida glabrata",
    "nakaseomyces glabratus": "Candida glabrata",
    "pichia kudriavzevii": "Candida krusei",
    "candida guilliermondii": "Meyerozyma guilliermondii",
    "pichia guilliermondii": "Meyerozyma guilliermondii",
    "micrococcus kristinae": "Kocuria kristinae",
    "streptococcus, beta-haem. group b": "Streptococcus agalactiae",
    "streptococcus group b": "Streptococcus agalactiae",
    "streptococcus, beta-haem. group a": "Streptococcus pyogenes",
    "streptococcus group a": "Streptococcus pyogenes",
    "clostridium difficile": "Clostridioides difficile",
    "propionibacterium acnes": "Cutibacterium acnes"
};
function canonicalOrganismName(name) {
    const key = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
    return ORGANISM_SYNONYMS[key] || name;
}
// Returns the number of records whose organism name was updated (in place)
function normalizeOrganismNames(records) {
    let n = 0;
    records.forEach(r => {
        const c = canonicalOrganismName(r['Selective organism']);
        if (c !== r['Selective organism']) { r['Selective organism'] = c; n++; }
    });
    return n;
}

// =====================================================================
// Data-quality audit (runs on every import; nothing is changed silently).
// Returns a list of { code, text } for one record. Checks: expected (intrinsic) resistance
// reported as susceptible (CLSI M100 / EUCAST expected phenotypes), methicillin discordance,
// and disagreement between laboratory flags and the antibiotic results.
// =====================================================================
const EXPECTED_RESISTANCE = [
    { test: /^(klebsiella|raoultella|citrobacter koseri)/, abx: ['Ampicillin', 'Amoxicillin'] },
    { test: /^(enterobacter|klebsiella aerogenes|citrobacter freundii|serratia|morganella)/, abx: ['Ampicillin', 'Amoxicillin', 'Amoxicillin/Clavulanic acid', 'Ampicillin/Sulbactam', 'Cefazolin', 'Cefoxitin'] },
    { test: /^(proteus|morganella|providencia|serratia)/, abx: ['Colistin', 'Polymyxin B'] },
    { test: /^(proteus mirabilis|morganella|providencia)/, abx: ['Tetracycline', 'Tigecycline'] },
    { test: /^pseudomonas aeruginosa/, abx: ['Ampicillin', 'Amoxicillin/Clavulanic acid', 'Cefazolin', 'Ceftriaxone', 'Cefotaxime', 'Ertapenem', 'Trimethoprim/Sulfamethoxazole', 'Tetracycline'] },
    { test: /^acinetobacter baumannii/, abx: ['Ampicillin', 'Cefazolin', 'Ertapenem'] },
    { test: /^enterococcus/, abx: ['Cefazolin', 'Cefuroxime', 'Ceftriaxone', 'Cefotaxime', 'Ceftazidime', 'Cefepime', 'Clindamycin', 'Trimethoprim/Sulfamethoxazole'] },
    { test: /^streptococcus pyogenes/, abx: [] }
];
function auditRecord(r) {
    const issues = [];
    const org = String(r['Selective organism'] || '').trim().toLowerCase();
    const val = a => String(r[a] || '').trim().toUpperCase();
    EXPECTED_RESISTANCE.forEach(rule => {
        if (!rule.test.test(org)) return;
        rule.abx.forEach(a => { if (val(a) === 'S') issues.push({ code: 'intrinsic', text: `${r['Selective organism']}: ${a} reported susceptible (expected resistant)` }); });
    });
    if (org.startsWith('streptococcus pyogenes') && val('Penicillin') && val('Penicillin') !== 'S')
        issues.push({ code: 'intrinsic', text: 'Streptococcus pyogenes: penicillin non-susceptible is not expected - confirm identification/result' });
    if (org.includes('staphylococcus aureus')) {
        const fox = val('Cefoxitin') || val('Cefoxitin screen'), oxa = val('Oxacillin');
        if (fox && oxa && ((fox === 'R') !== (oxa === 'R'))) issues.push({ code: 'mrsa_discord', text: 'S. aureus: cefoxitin and oxacillin disagree (cefoxitin is used)' });
        if (r['Lab MRSA'] === '+' && fox === 'S') issues.push({ code: 'flag_mismatch', text: 'Lab MRSA positive but cefoxitin susceptible' });
        if (r['Lab MRSA'] === '-' && fox === 'R') issues.push({ code: 'flag_mismatch', text: 'Lab MRSA negative but cefoxitin resistant' });
    }
    if (r['Lab ESBL'] === '+' && ['Ceftriaxone', 'Cefotaxime', 'Ceftazidime'].every(a => !val(a) || val(a) === 'S') && ['Ceftriaxone', 'Cefotaxime', 'Ceftazidime'].some(a => val(a)))
        issues.push({ code: 'flag_mismatch', text: 'Lab ESBL positive but all tested 3rd-generation cephalosporins are susceptible' });
    if (r['Lab Carbapenemase'] === '+' && ['Meropenem', 'Imipenem', 'Ertapenem'].some(a => val(a)) && ['Meropenem', 'Imipenem', 'Ertapenem'].every(a => !val(a) || val(a) === 'S'))
        issues.push({ code: 'flag_mismatch', text: 'Lab carbapenemase positive but all tested carbapenems are susceptible' });
    return issues;
}
