// --- Firebase Hybrid Sync Initialization ---
const firebaseConfig = {
    apiKey: "AIzaSyCyWcTzvYXwsYQEgs_iNh_Co68H9_2kYU4",
    authDomain: "antibiogramtrak.firebaseapp.com",
    projectId: "antibiogramtrak",
    storageBucket: "antibiogramtrak.firebasestorage.app",
    messagingSenderId: "679667156703",
    appId: "1:679667156703:web:ca37e1544e3d20e922cb6a"
};

// تهيئة الاتصال فقط في حال وجود مكتبة Firebase
let db = null;
try {
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();

        // تعريف متغير المصادقة
const auth = firebase.auth();

// مراقبة حالة المستخدم (هل هو مسجل دخول أم لا؟)
auth.onAuthStateChanged((user) => {
    if (user) {
        // إذا كان مسجلاً، أخفِ شاشة الدخول وأظهر التطبيق
        $('#loginOverlay').addClass('hidden');
        $('#mainAppContainer').removeClass('hidden');
        // Start listening to the private cloud copy only once signed in (rules require it)
        if (!window._cloudListenerStarted) {
            window._cloudListenerStarted = true;
            syncCloudToLocal();
            setTimeout(() => syncLocalToCloud({ auto: true }), 4000);   // make sure the dashboard copy is current
        }
    } else {
        // Not signed in: show the sign-in screen (the dashboard is a separate page)
        $('#loginOverlay').removeClass('hidden');
        $('#mainAppContainer').addClass('hidden');
    }
});
        
// (applyDeduplication is defined once in data.js)
// دالة تسجيل الدخول (مرتبطة بالزر في شاشة الدخول)
function loginUser() {
    const email = $('#loginEmail').val();
    const pass = $('#loginPass').val();
    
    if(!email || !pass) {
        Swal.fire('Notice', 'Please enter your email and password', 'warning');
        return;
    }

    Swal.showLoading();
    auth.signInWithEmailAndPassword(email, pass)
        .then(() => {
            Swal.close();
            // سيتم تشغيل onAuthStateChanged تلقائياً وفتح التطبيق
        })
        .catch((error) => {
            Swal.fire('Error', 'Incorrect sign-in details!', 'error');
            console.error(error);
        });
}

// دالة تسجيل الخروج (يمكنك إضافتها لأي زر داخل التطبيق لاحقاً)
function logoutUser() {
    auth.signOut();
}
        
        // تفعيل المزامنة التلقائية عند الاتصال بالإنترنت
        window.addEventListener('online', () => syncLocalToCloud({ auto: true }));
    }
} catch(e) {
    console.warn("Firebase not loaded, running strictly offline.");
}

// ---------------------------------------------------------
// CLOUD SYNC (schema v2): the records are split into chunks (one or more per year) so no
// Firestore document ever approaches the 1 MB limit. A small "meta" document lists the chunks.
//   private : amr_sync/hospital_main (meta)  + amr_sync/r_<year>_<n>  (no patient names)
//   public  : amr_public/dashboard  (meta)   + amr_public/r_<year>_<n> (pseudonymised)
// ---------------------------------------------------------
const CHUNK_MAX_CHARS = 600000;      // ~600 KB of JSON per document (limit is 1 MiB)

function recordYear(r) {
    const y = String(r['Date'] || r['Specimen Date'] || '').slice(0, 4);
    return /^\d{4}$/.test(y) ? y : '0000';
}
function quickHash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36) + '.' + str.length.toString(36);
}
// -> [{ id, year, n, hash, json, records }]
function buildChunks(records) {
    const byYear = {};
    records.forEach(r => { (byYear[recordYear(r)] = byYear[recordYear(r)] || []).push(r); });
    const out = [];
    Object.keys(byYear).sort().forEach(year => {
        let part = [], size = 0, idx = 1;
        const flush = () => {
            if (!part.length) return;
            const json = JSON.stringify(part);
            out.push({ id: `r_${year}_${idx}`, year, n: part.length, hash: quickHash(json), records: part });
            idx++; part = []; size = 0;
        };
        byYear[year].forEach(r => {
            const len = JSON.stringify(r).length + 1;
            if (size + len > CHUNK_MAX_CHARS) flush();
            part.push(r); size += len;
        });
        flush();
    });
    return out;
}
function chunkMetaOf(chunks) {
    const m = {};
    chunks.forEach(c => { m[c.id] = { year: c.year, n: c.n, hash: c.hash }; });
    return m;
}
// Reads every chunk listed by the meta document from a collection snapshot.  null = incomplete.
function assembleRecords(meta, docsById) {
    if (Array.isArray(meta.records)) return meta.records;           // legacy single-document format
    const ids = Object.keys(meta.chunks || {}).sort();
    let out = [];
    for (const id of ids) {
        const d = docsById[id];
        if (!d) return null;                                        // chunk not delivered yet
        out = out.concat(d.records || []);
    }
    return out;
}

let _syncBusy = false;
let _syncQueued = null;
function setSyncStatus(kind, text) {
    try { localStorage.setItem('amr_sync_status', JSON.stringify({ kind, text, at: Date.now() })); } catch (e) {}
    const tone = kind === 'ok' ? 'text-emerald-600' : kind === 'warn' ? 'text-amber-600' : 'text-red-600';
    const el = document.getElementById('syncStatus');
    if (el) { el.textContent = text; el.className = 'text-[11px] font-bold ' + tone; }
    const pill = document.getElementById('syncPill');
    if (pill) {
        pill.textContent = (kind === 'ok' ? 'Dashboard: ' : 'Dashboard: ') + (kind === 'ok' ? 'up to date' : kind === 'warn' ? 'needs attention' : 'not published');
        pill.title = text + ' (click to publish now)';
        pill.className = 'hidden sm:inline-flex items-center text-[10px] font-bold px-2.5 py-1 rounded-full border cursor-pointer ' +
            (kind === 'ok' ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : kind === 'warn' ? 'text-amber-800 bg-amber-50 border-amber-200' : 'text-red-700 bg-red-50 border-red-200');
    }
}

// Manual "publish now": runs a sync and tells the user exactly what happened
async function publishNow() {
    Swal.fire({ title: 'Publishing to dashboard...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    const result = await syncLocalToCloud({ manual: true });
    Swal.close();
    if (result && result.ok) {
        Swal.fire({ icon: 'success', title: 'Published', text: result.wrote ? `${result.count} isolates are now on the dashboard.` : `Already up to date (${result.count} isolates).`, timer: 2200, showConfirmButton: false });
    } else if (result && result.error) {
        Swal.fire({ icon: 'error', title: 'Could not publish', text: result.error });
    } else if (!result) {
        let st = null; try { st = JSON.parse(localStorage.getItem('amr_sync_status') || 'null'); } catch (e) {}
        if (!navigator.onLine) Swal.fire({ icon: 'info', title: 'Offline', text: 'Connect to the internet and try again.' });
        else if (st && st.kind !== 'ok') Swal.fire({ icon: 'info', title: 'Nothing was published', text: st.text });
    }
}

// opts.auto  : triggered automatically (never shows dialogs, never overwrites on doubt)
// opts.force : the user explicitly confirmed overwriting the cloud (e.g. Clear All Records)
async function syncLocalToCloud(opts) {
    opts = (opts && typeof opts === 'object' && !(opts instanceof Event)) ? opts : {};
    if (!db) return;
    try { if (!firebase.auth().currentUser) return; } catch (e) { return; }
    if (_syncBusy) { _syncQueued = opts; return; }
    _syncBusy = true;
    let result = null;
    try {
        const localRecords = JSON.parse(localStorage.getItem('amr_records')) || [];
        // Names never leave the device
        const cloudReadyRecords = localRecords.map(r => {
            const c = { ...r };
            delete c['Name']; delete c['Name Original'];
            return c;
        });
        const liveSettings = JSON.parse(localStorage.getItem('amr_live_settings')) || { profile1_abx: 'Meropenem', profile2_abx: 'Ceftriaxone' };

        const privMetaRef = db.collection("amr_sync").doc("hospital_main");
        const privSnap = await privMetaRef.get();
        const privMeta = privSnap.exists ? privSnap.data() : {};
        const cloudTotal = Array.isArray(privMeta.records) ? privMeta.records.length : (privMeta.total || 0);

        // ---- Safety guard: never silently shrink or replace newer cloud data ----
        if (!opts.force && cloudTotal > 0) {
            const lostTooMuch = localRecords.length < cloudTotal * 0.7;
            const knownRev = localStorage.getItem('amr_cloud_rev');
            const cloudChanged = !!(privMeta.rev && knownRev && privMeta.rev !== knownRev);
            if (lostTooMuch || cloudChanged) {
                const msg = lostTooMuch
                    ? `This device holds ${localRecords.length} records but the cloud holds ${cloudTotal}.`
                    : 'The cloud was updated from another device since this device last synced.';
                if (opts.auto) {
                    setSyncStatus('warn', 'Sync paused: ' + msg);
                    return;
                }
                const choice = await Swal.fire({
                    icon: 'warning', title: 'Sync stopped to protect the cloud data',
                    html: `<p style="font-size:13px">${msg}</p><p style="font-size:12px;margin-top:6px">Overwriting would replace the cloud copy with this device's data.</p>`,
                    showDenyButton: true, showCancelButton: true,
                    confirmButtonText: 'Keep cloud (pull it)', denyButtonText: 'Overwrite cloud', cancelButtonText: 'Cancel',
                    confirmButtonColor: '#0d9488', denyButtonColor: '#dc2626'
                });
                if (choice.isConfirmed) {
                    localStorage.removeItem('amr_cloud_rev');
                    setSyncStatus('warn', 'Pulling the cloud copy...');
                    await pullCloudNow();
                    return;
                }
                if (!choice.isDenied) { setSyncStatus('warn', 'Sync cancelled'); return; }
            }
        }

        // ---- Pseudonymisation salt ----
        let salt = localStorage.getItem('amr_hash_salt');
        if (!salt) {
            salt = privMeta.salt || Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
            localStorage.setItem('amr_hash_salt', salt);
        }
        const publicRecords = await buildPublicRecords(cloudReadyRecords, salt);
        const labQuality = pruneFutureLab(JSON.parse(localStorage.getItem('amr_lab_quality') || '{}'));
        try { localStorage.setItem('amr_lab_quality', JSON.stringify(labQuality)); } catch (e) {}

        const rev = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const stamp = firebase.firestore.FieldValue.serverTimestamp();
        const DEL = firebase.firestore.FieldValue.delete();

        // Writes one family (private or public): changed chunks + meta, and removes orphaned chunks
        const writeFamily = async (collection, metaDocId, records, metaExtra) => {
            const metaRef = db.collection(collection).doc(metaDocId);
            const oldMeta = (collection === 'amr_sync') ? privMeta : ((await metaRef.get()).data() || {});
            const oldChunks = oldMeta.chunks || {};
            const chunks = buildChunks(records);
            const sameChunks = chunks.length === Object.keys(oldChunks).length &&
                chunks.every(c => oldChunks[c.id] && oldChunks[c.id].hash === c.hash);
            const sameExtra = Object.keys(metaExtra).every(k => k === 'salt' || JSON.stringify(oldMeta[k] || null) === JSON.stringify(metaExtra[k] || null));
            // Last change wins: never overwrite settings saved from the Control page after this device's copy
            const cloudNewer = oldMeta.settings && (oldMeta.settings._ts || 0) > (liveSettings._ts || 0);
            const effSettings = cloudNewer ? oldMeta.settings : liveSettings;
            if (cloudNewer) localStorage.setItem('amr_live_settings', JSON.stringify(effSettings));
            if (sameChunks && sameExtra && JSON.stringify(oldMeta.settings || null) === JSON.stringify(effSettings) && oldMeta.schema === 2) return false;
            const batch = db.batch();
            chunks.forEach(c => {
                if (!oldChunks[c.id] || oldChunks[c.id].hash !== c.hash) {
                    batch.set(db.collection(collection).doc(c.id), { year: c.year, n: c.n, records: c.records });
                }
            });
            Object.keys(oldChunks).forEach(id => {
                if (!chunks.find(c => c.id === id)) batch.delete(db.collection(collection).doc(id));
            });
            batch.set(metaRef, Object.assign({
                schema: 2, rev: rev, total: records.length, years: [...new Set(chunks.map(c => c.year))],
                chunks: chunkMetaOf(chunks), records: DEL, settings: effSettings, last_updated: stamp
            }, metaExtra), { merge: true });
            await batch.commit();
            return true;
        };

        const w1 = await writeFamily("amr_sync", "hospital_main", cloudReadyRecords, { salt: salt });
        const wardList = [...new Set([...(typeof defaultWards !== 'undefined' ? defaultWards : []), ...localRecords.map(r => r.Ward).filter(Boolean)])].sort();
        const w2 = await writeFamily("amr_public", "dashboard", publicRecords, { labQuality: labQuality, wards: wardList, wardClass: getWardClassMap() || {} });

        if (w1) localStorage.setItem('amr_cloud_rev', rev);
        result = { ok: true, wrote: !!(w1 || w2), count: localRecords.length };
        const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setSyncStatus('ok', `Synced ${t} - ${localRecords.length} records`);
        console.log("Data synced to cloud successfully (names excluded; public copy pseudonymised).");
    } catch (e) {
        console.error("Error syncing to cloud:", e);
        const code = (e && (e.code || e.message)) ? String(e.code || e.message) : 'unknown error';
        setSyncStatus('err', 'Sync failed: ' + code);
        result = { ok: false, error: code + (/permission/i.test(code) ? ' - check that you are signed in with the owner account and that the Firestore rules are published.' : '') };
    } finally {
        _syncBusy = false;
        if (_syncQueued) { const q = _syncQueued; _syncQueued = null; setTimeout(() => syncLocalToCloud(q), 300); }
    }
    return result;
}

// Forces a fresh read of the private collection (used after "Keep cloud")
async function pullCloudNow() {
    const snap = await db.collection("amr_sync").get();
    handlePrivateSnapshot(snap);
}

// دالة لسحب البيانات من السحابة ودمجها مع المحلي بأمان
function syncCloudToLocal() {
    if (!db) return;
    db.collection("amr_sync").onSnapshot(handlePrivateSnapshot, (error) => {
        console.error("Error fetching live data from cloud:", error);
    });
}

function handlePrivateSnapshot(snap) {
    {
        const docsById = {};
        snap.forEach(d => { docsById[d.id] = d.data(); });
        const metaData = docsById['hospital_main'];
        const doc = { exists: !!metaData, metadata: snap.metadata };
        if (doc.exists) {
            if (doc.metadata.hasPendingWrites) return;
            const assembled = assembleRecords(metaData, docsById);
            if (assembled === null) return;            // chunks still arriving
            const cloudRecords = assembled;
            const cloudSettings = metaData.settings || null;
            const legacyFormat = Array.isArray(metaData.records);
            
            let localRecordsStr = localStorage.getItem('amr_records') || "[]";
            let localRecords = JSON.parse(localRecordsStr);

            // 🛡️ خزنة الأسماء المستقلة (Name Vault): لحماية الأسماء بشكل دائم ومستقل عن تحديثات السحابة
            let nameVault = JSON.parse(localStorage.getItem('amr_name_vault')) || {};
            let vaultUpdated = false;
            
            // استخراج الأسماء الحالية وحفظها في الخزنة فوراً
            localRecords.forEach(lr => {
                if (lr['_uid'] && lr['Name'] && lr['Name'] !== 'Unknown Patient') {
                    if (nameVault[lr['_uid']] !== lr['Name']) {
                        nameVault[lr['_uid']] = lr['Name'];
                        vaultUpdated = true;
                    }
                }
            });
            
            if (vaultUpdated) {
                localStorage.setItem('amr_name_vault', JSON.stringify(nameVault));
            }

            // 🔄 دمج البيانات القادمة من السحابة مع الأسماء الموجودة في الخزنة
            let needsCloudFix = false;
            let mergedRecords = cloudRecords.map((cr, index) => {
                let mutableCr = Object.assign({}, cr); // فك التجميد بأمان تام
                let restoredName = "Unknown Patient";
                
                // 1. الأولوية المطلقة: استرجاع الاسم من الخزنة المحمية (لا تتأثر بالإنترنت)
                if (mutableCr['_uid'] && nameVault[mutableCr['_uid']]) {
                    restoredName = nameVault[mutableCr['_uid']];
                } 
                else {
                    // 2. المطابقة عبر الفهرس (كخط دفاع أخير للسجلات القديمة جداً)
                    let indexMatch = localRecords[index];
                    if (indexMatch && 
                        indexMatch['Patient ID'] === mutableCr['Patient ID'] && 
                        indexMatch['Selective organism'] === mutableCr['Selective organism'] && 
                        indexMatch['Date'] === mutableCr['Date']) {
                        
                        restoredName = indexMatch['Name'] || "Unknown Patient";
                        if (indexMatch['_uid']) mutableCr['_uid'] = indexMatch['_uid'];
                    }
                    needsCloudFix = true;
                }
                
                // ضمان وجود معرّف فريد دائماً للحماية المستقبلية
                if (!mutableCr['_uid']) {
                    mutableCr['_uid'] = Date.now().toString(36) + Math.random().toString(36).substr(2, 5) + index;
                    needsCloudFix = true;
                }
                
                mutableCr['Name'] = restoredName;
                return mutableCr;
            });

            let mergedRecordsStr = JSON.stringify(mergedRecords);

            // تحديث واجهة المستخدم فقط إذا كانت السحابة تحمل بيانات حقيقية
            if (mergedRecordsStr !== localRecordsStr && cloudRecords.length > 0) {
                localStorage.setItem('amr_records', mergedRecordsStr);
                
                if (typeof initDataTable === 'function') initDataTable();
                // تم إزالة دوال التحليلات والمخططات لأنها حذفت من واجهة الحاسوب
            } else if (localRecords.length > 0 && cloudRecords.length === 0) {
                needsCloudFix = true;
            }

            if (cloudSettings) {
                // Last change wins: keep this device's copy only if it carries a newer stamp than the cloud copy
                let localCopy = null; try { localCopy = JSON.parse(localStorage.getItem('amr_live_settings') || 'null'); } catch (e) {}
                if (!(localCopy && (localCopy._ts || 0) > (cloudSettings._ts || 0))) localStorage.setItem('amr_live_settings', JSON.stringify(cloudSettings));
            }
            
            if (metaData.rev) localStorage.setItem('amr_cloud_rev', metaData.rev);
            // Convert an old single-document cloud copy to the chunked format
            if (legacyFormat) needsCloudFix = true;
            if (needsCloudFix && typeof syncLocalToCloud === 'function') {
                syncLocalToCloud({ auto: true });
            }
            
            console.log("Real-time sync: Data synchronized and names secured in Vault.");
        }
    }
}
// ---------------------------------------------------------
let dataTable;
let chartAMR_instance = null;
let chartOrg_instance = null;
let chartSpec_instance = null;
let chartGen_instance = null;
let liveCharts = []; 
let isUpdatingFilters = false;


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
// --- Migration Script to update old records to new clean names ---
function runDatabaseMigration() {
    let records = JSON.parse(localStorage.getItem('amr_records')) || [];
    let migrated = false;
    
    records.forEach(r => {
        // 🛠️ AUTO-REPAIR: Fix corrupted _uid caused by the S/I/R dropdown bug
        if (r['_uid'] === 'S' || r['_uid'] === 'I' || r['_uid'] === 'R' || !r['_uid']) {
            r['_uid'] = Date.now().toString() + Math.random().toString(36).substr(2, 5);
            migrated = true;
        }

        // Ministry category: keep a valid manual choice, otherwise derive it from the organism
        if (!r['Antibiogram organism'] || orgMapExport[r['Antibiogram organism']] === undefined) {
            const cat = getMinistryCategory(r['Antibiogram organism']) || getMinistryCategory(r['Selective organism']);
            if (cat && cat !== r['Antibiogram organism']) { r['Antibiogram organism'] = cat; migrated = true; }
        }
        const canonOrg = canonicalOrganismName(r['Selective organism']);
        if (canonOrg !== r['Selective organism']) { r['Selective organism'] = canonOrg; migrated = true; }
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

    // Saved organism list (dropdown): replace old names with current names
    try {
        const savedOrgs = JSON.parse(localStorage.getItem('amr_organisms')) || [];
        const canonOrgs = [...new Set(savedOrgs.map(canonicalOrganismName))];
        if (canonOrgs.length !== savedOrgs.length || canonOrgs.some((x, i) => x !== savedOrgs[i])) {
            localStorage.setItem('amr_organisms', JSON.stringify(canonOrgs));
        }
    } catch (e) {}

    if (migrated) {
        localStorage.setItem('amr_records', JSON.stringify(records));
        // Instantly push repaired IDs to the cloud to prevent refresh mismatch
        if (typeof syncLocalToCloud === 'function' && navigator.onLine) {
            syncLocalToCloud();
        }
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

// --- UNIVERSAL WHONET DATA EXTRACTOR & INJECTOR ---
function triggerDataExtractor() {
    document.getElementById('extractorFileInput').click();
}

function readTableFile(file) {
    return new Promise((resolve, reject) => {
        const name = file.name.toLowerCase();
        const reader = new FileReader();
        if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
            reader.onload = async (e) => {
                try {
                    const workbook = await XlsxPopulate.fromDataAsync(e.target.result);
                    const values = workbook.sheet(0).usedRange().value();
                    resolve(values.map(row => row ? row.map(cell => cell != null ? String(cell).trim() : "") : []));
                } catch (err) { reject(err); }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        } else {
            reader.onload = e => {
                const lines = e.target.result.split(/\r?\n/);
                if (lines.length < 2) { reject(new Error('empty')); return; }
                let separator = '\t';
                if (lines[0].split('\t').length <= 1) separator = ',';
                resolve(lines.filter(line => line.trim() !== '').map(line => line.split(separator).map(c => c.trim())));
            };
            reader.onerror = reject;
            reader.readAsText(file);
        }
    });
}

// A WHONET "values" export has numeric MIC cells; the "interpretations" export has S/I/R letters.
function tableHasNumericMics(table) {
    const h = (table[0] || []).map(x => String(x || '').toLowerCase());
    const micCols = h.map((x, i) => x.endsWith('_nm') ? i : -1).filter(i => i > -1);
    let numeric = 0;
    for (let r = 1; r < Math.min(table.length, 400); r++) {
        micCols.forEach(c => { if (/^[<>≤≥=]*\s*\d/.test(String(table[r][c] || ''))) numeric++; });
    }
    return numeric > 0;
}

async function processDataExtraction(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    Swal.fire({ title: 'Processing File...', text: 'Loading dictionaries and extracting records...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    const loadDict = async (url) => {
        const map = {};
        try {
            const response = await fetch(url);
            if (response.ok) {
                const jsonDict = await response.json();
                Object.keys(jsonDict).forEach(key => { map[key.toLowerCase()] = jsonDict[key]; });
            } else console.warn(url + " not found on server.");
        } catch (error) { console.warn("Could not fetch " + url); }
        return map;
    };
    const externalOrgMap = await loadDict('organisms_dictionary.json');
    const externalSpecimenMap = await loadDict('specimens_dictionary.json');

    try {
        const tables = [];
        for (const f of files.slice(0, 2)) tables.push(await readTableFile(f));
        let main = tables[0], valuesTable = null;
        if (tables.length === 2) {
            const firstHasMic = tableHasNumericMics(tables[0]), secondHasMic = tableHasNumericMics(tables[1]);
            if (firstHasMic && !secondHasMic) { main = tables[1]; valuesTable = tables[0]; }
            else if (!firstHasMic && secondHasMic) { main = tables[0]; valuesTable = tables[1]; }
            else { main = tables[0]; valuesTable = null; }
        } else if (tableHasNumericMics(tables[0])) {
            valuesTable = tables[0];      // single raw-values file: MIC numbers only usable for vancomycin
        }
        parseAndInjectData(main, externalOrgMap, externalSpecimenMap, event, valuesTable);
    } catch (err) {
        console.error(err);
        Swal.fire('Error', 'Failed to read the file. Make sure it is not corrupted.', 'error');
        event.target.value = '';
    }
}

// --- UNIFIED INJECTION LOGIC ---
function parseAndInjectData(rawData, externalOrgMap, externalSpecimenMap, event, valuesTable) {
    if (!rawData || rawData.length < 2 || !rawData[0]) {
        Swal.fire('Error', 'No valid data found to extract.', 'error');
        event.target.value = ''; return;
    }

    const actualHeaders = rawData[0].map(h => h ? h.toLowerCase() : "");
    const idxPatientID = actualHeaders.findIndex(h => h === 'patient_id' || h === 'patient id' || h === 'identification number' || h === 'id');
    const idxFName = actualHeaders.findIndex(h => h === 'first_name' || h === 'first name' || h === 'patient_name');
    const idxLName = actualHeaders.findIndex(h => h === 'last_name' || h === 'last name');
    const idxAge = actualHeaders.findIndex(h => h === 'age');
    const idxSex = actualHeaders.findIndex(h => h === 'sex' || h === 'gender');
    
    // إعطاء الأولوية القصوى لعمود Department بشكل صارم حتى لو احتوى على مسافات
    let idxWard = actualHeaders.findIndex(h => h === 'department' || h.includes('department'));
    
    // تحديد البدائل في حال عدم وجود عمود Department
    if (idxWard === -1) {
        idxWard = actualHeaders.findIndex(h => h === 'location');
    }
    if (idxWard === -1) {
        idxWard = actualHeaders.findIndex(h => h === 'ward');
    }

    const idxSample = actualHeaders.findIndex(h => h === 'specimen' || h === 'sample' || h === 'spec_type' || h === 'specimen type');
    const idxDate = actualHeaders.findIndex(h => h === 'spec_date' || h === 'specimen date' || h === 'date');
    const idxOrg = actualHeaders.findIndex(h => h === 'organism' || h === 'org');
    // Laboratory-confirmed flags exported by WHONET
    const idxEsbl = actualHeaders.findIndex(h => h === 'esbl');
    const idxCarba = actualHeaders.findIndex(h => h === 'carbapenemase');
    const idxMrsaFlag = actualHeaders.findIndex(h => h === 'mrsa');
    const idxVrsa = actualHeaders.findIndex(h => h === 'x_vrsa');
    // Vancomycin disk (_nd) and MIC (_nm) columns are handled separately (CLSI: staphylococci by MIC only)
    const vanDiskIdx = actualHeaders.findIndex(h => h.startsWith('van_nd'));
    const vanMicIdx = actualHeaders.findIndex(h => h.startsWith('van_nm'));
    // Optional raw-values file: same export, same row order
    let valuesAligned = false, valuesVanIdx = -1;
    if (valuesTable && valuesTable[0]) {
        const vh = valuesTable[0].map(h => h ? h.toLowerCase() : "");
        valuesVanIdx = vh.findIndex(h => h.startsWith('van_nm'));
        const vId = vh.findIndex(h => h === 'identification number'), vOrg = vh.findIndex(h => h === 'organism');
        valuesAligned = valuesTable.length === rawData.length && valuesVanIdx > -1 && vId > -1 && vOrg > -1;
        if (valuesAligned) {
            for (let r = 1; r < rawData.length; r++) {
                if ((rawData[r][idxPatientID] || '') !== (valuesTable[r][vId] || '') || (rawData[r][idxOrg] || '') !== (valuesTable[r][vOrg] || '')) { valuesAligned = false; break; }
            }
        }
    }
    const audit = { unknownOrg: new Map(), unknownWard: new Map(), unknownSpec: new Map(), unmappedAbx: new Map(), ignoredAbx: new Map(), renamed: new Map() };
    // Legacy WHONET codes for agents outside the current CLSI M100 / WHO AWaRe lists: recognised and deliberately not imported
    const KNOWN_IGNORED_ABX = new Set(['KAC', 'GAT', 'LOM', 'PNV', 'GEM', 'CPR', 'CIC', 'CCV', 'CLA', 'OPT']);
    const report = { noSpecimen: [], strepPenDisk: 0, duplicates: 0, blankOrg: 0, added: 0, noGrowth: 0, noSri: 0, noDate: 0, vancDisk: 0, vancTypedIR: 0, vancInvalidMic: 0, vancMismatch: 0, vancCandidates: [], vancNeedsMic: 0, vancFromMic: 0, valuesFile: valuesAligned, valuesFileIgnored: !!valuesTable && !valuesAligned };

    const abxColumns = [];
    const allPossibleAbxs = [...abxList, ...getCustomAntibiotics().map(a=>a.name)];
    
    // WHONET antibiotics dictionary (codes checked against the WHONET Antibiotics.txt file: for example KAC is kanamycin/cephalexin, KAH kanamycin-high, STH streptomycin-high, CLO cloxacillin)
    const whonetAbxMap = {
        "amp": "Ampicillin", "amc": "Amoxicillin/Clavulanic acid", "amx": "Amoxicillin",
        "sam": "Ampicillin/Sulbactam", "axs": "Amoxicillin/Sulbactam", "tzp": "Piperacillin/Tazobactam", 
        "pip": "Piperacillin", "pen": "Penicillin", "oxc": "Oxacillin", "oxa": "Oxacillin",
        "tic": "Ticarcillin", "tcc": "Ticarcillin/Clavulanic acid", "mec": "Mecillinam",
        "fox": "Cefoxitin", "czz": "Cefazolin", "czo": "Cefazolin", "cxm": "Cefuroxime", 
        "cfm": "Cefixime", "cro": "Ceftriaxone", "ctx": "Cefotaxime", "caz": "Ceftazidime", 
        "fep": "Cefepime", "cep": "Cephalothin", "cec": "Cefaclor", "cpd": "Cefpodoxime", 
        "cdr": "Cefdinir", "cfp": "Cefoperazone", "ctt": "Cefotetan", "cpt": "Ceftaroline", 
        "czx": "Ceftizoxime", "cza": "Ceftazidime/Avibactam", "czt": "Ceftolozane/Tazobactam",
        "ipm": "Imipenem", "mem": "Meropenem", "etp": "Ertapenem", "dor": "Doripenem", 
        "mev": "Meropenem/Vaborbactam", "imr": "Imipenem/Relebactam", "atm": "Aztreonam",
        "ami": "Amikacin", "amk": "Amikacin", "gen": "Gentamicin", "tob": "Tobramycin", 
        "net": "Netilmicin", "str": "Streptomycin", "kan": "Kanamycin", "geh": "Gentamicin high-level", "kah": "Kanamycin high-level", "sth": "Streptomycin high-level", "plz": "Plazomicin", "spt": "Spectinomycin",
        "cip": "Ciprofloxacin", "lev": "Levofloxacin", "lvx": "Levofloxacin", "mfx": "Moxifloxacin",   // WHONET: MFX = moxifloxacin (MOX = moxalactam)
        "ofx": "Ofloxacin", "nor": "Norfloxacin", "nal": "Nalidixic acid",
        "ery": "Erythromycin", "azi": "Azithromycin", "azm": "Azithromycin", 
        "clr": "Clarithromycin", "cli": "Clindamycin", "qda": "Quinupristin/Dalfopristin",
        "van": "Vancomycin", "tec": "Teicoplanin", "dap": "Daptomycin",
        "dal": "Dalbavancin", "ori": "Oritavancin", "tlv": "Telavancin",
        "tcy": "Tetracycline", "dox": "Doxycycline", "mno": "Minocycline", "tgc": "Tigecycline",
        "sxt": "Trimethoprim/Sulfamethoxazole", "tmp": "Trimethoprim", "sss": "Sulfonamides",
        "nit": "Nitrofurantoin", "fos": "Fosfomycin", "col": "Colistin", "pol": "Polymyxin B",
        "lnz": "Linezolid", "rif": "Rifampicin", "chl": "Chloramphenicol",
        "fus": "Fusidic acid", "fuc": "Fusidic acid",
        "mtr": "Metronidazole",
        "flu": "Fluconazole", "cas": "Caspofungin", "vor": "Voriconazole", 
        "mif": "Micafungin", "ani": "Anidulafungin", "rzf": "Rezafungin", "clo": "Cloxacillin"
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

        if (matchedName === 'Vancomycin' && (i === vanDiskIdx || i === vanMicIdx)) continue;
        if(matchedName) {
            abxColumns.push({ index: i, name: matchedName, isDisk: h.includes('_nd') });
        }
    }

    // WHONET antibiotic columns this app does not know (results would be silently lost)
    const unmappedCols = [];
    actualHeaders.forEach((h, i) => {
        const m = h.match(/^([a-z0-9]{3})_n[dm]/);
        if (m && !whonetAbxMap[m[1]] && !abxColumns.some(c => c.index === i) && i !== vanDiskIdx && i !== vanMicIdx) unmappedCols.push({ index: i, code: m[1].toUpperCase() });
    });

    let records = JSON.parse(localStorage.getItem('amr_records')) || [];
    let addedCount = 0;
    let skippedCount = 0;
    const newRecords = [];
    // Re-importing the same export must not create duplicates: same patient id + month + organism + specimen
    const dupKey = (r) => [String(r['Patient ID'] || '').toLowerCase(), r['Date'], String(r['Selective organism'] || '').toLowerCase(), String(r['Sample'] || '').toLowerCase()].join('|');
    // Manually entered records are not treated as duplicates: when the laboratory file arrives it replaces them (see finalize)
    const existingKeys = new Set(records.filter(r => r['Patient ID'] && r['Patient ID'] !== 'Unknown' && r['Entry'] !== 'manual').map(dupKey));

    const wardMap = {
        'ped': 'Pediatrics', 'ped in': 'Pediatrics',
        'icu': 'ICU', 'ccu': 'CCU', 'eme': 'Emergency',
        'sur': 'Surgery', 'sur in': 'Surgery',
        'med': 'Internal Medicine', 'med in': 'Internal Medicine',
        'neo': 'Neonatal Unit', 'neo in': 'Neonatal Unit',
        'neu in': 'Neurosurgery',
        'out': 'Outpatient',
        'obg': 'Obstetrics & Gynecology', 'obg in': 'Obstetrics & Gynecology',
        'ent': 'ENT',
        'epd\\a': 'Epidemiology / Isolation',
        'epd/a': 'Epidemiology / Isolation',
        'epd': 'Epidemiology / Isolation',
        'gyn': 'Obstetrics & Gynecology',
        'nicu': 'Neonatal ICU',
        'picu': 'Pediatric ICU'
    };

    // Lab-quality counts (growth / no growth / contaminated cultures): stored as aggregates only, never as isolates
    const labCtx = { idx: { org: idxOrg, ward: idxWard, sample: idxSample, date: idxDate, pid: idxPatientID }, wardMap: wardMap, specimenMap: externalSpecimenMap, astCols: abxColumns.map(c => c.index), orgName: c => externalOrgMap[c] || whonetOrgMap[c] || (c.charAt(0).toUpperCase() + c.slice(1)) };
    const labAgg = buildLabQualityFromRows(rawData, labCtx);
    report.futureCultures = labCtx.futureRows || [];

    for(let i = 1; i < rawData.length; i++) {
        const cols = rawData[i];
        
        // تخطي الصفوف الفارغة لمنع انهيار الأكستراكتر
        if (!cols || cols.length === 0) continue;

        let orgCode = idxOrg > -1 && cols[idxOrg] ? cols[idxOrg].toLowerCase() : "";
        if (!orgCode && abxColumns.some(x => /^[SIR]/i.test(String(cols[x.index] || '').trim()))) report.blankOrg++;   // has AST results but no organism
        if(!orgCode || orgCode === 'xxx' || orgCode === 'con' || orgCode === 'no growth') {
            skippedCount++; report.noGrowth++; continue;
        }

        let hasSRIData = false;
        let abxResults = {};
        
        const orgForRules = String(externalOrgMap[orgCode] || whonetOrgMap[orgCode] || orgCode).toLowerCase();
        const isBetaHemolyticStrep = /streptococcus (pyogenes|agalactiae|dysgalactiae)|streptococcus,? beta|group [abcg]\b/.test(orgForRules);
        abxColumns.forEach(abx => {
            let val = cols[abx.index] ? String(cols[abx.index]).trim().toUpperCase() : "";
            // CLSI M100: beta-haemolytic streptococci have no disk breakpoints for R/I to penicillin/ampicillin (disk can only show S)
            if (abx.isDisk && isBetaHemolyticStrep && (abx.name === 'Penicillin' || abx.name === 'Ampicillin') && (val === 'R' || val === 'I')) { report.strepPenDisk++; return; }
            if (val === 'SDD') {
                // CLSI M100: susceptible-dose dependent is its own category. It must not be stored as S (M39 Section 6.6 counts only S as susceptible).
                hasSRIData = true;
                abxResults[abx.name] = 'SDD';
            } else if (val === 'S' || val === 'I' || val === 'R') {
                hasSRIData = true;
                abxResults[abx.name] = val;
            } else if (val.startsWith('S') || val.startsWith('I') || val.startsWith('R')) {
                hasSRIData = true;
                abxResults[abx.name] = val.charAt(0);
            }
        });

        // Vancomycin: handled by organism-specific CLSI rules
        const vDisk = vanDiskIdx > -1 ? String(cols[vanDiskIdx] || '').trim().toUpperCase() : '';
        const vMicLetter = vanMicIdx > -1 ? String(cols[vanMicIdx] || '').trim().toUpperCase() : '';
        const vSources = {};
        if (/^[SIR]$/.test(vDisk)) vSources.disk = vDisk;
        if (/^[SIR]$/.test(vMicLetter)) vSources.mic = vMicLetter;
        let vancFlag = null, vancMicText = null;
        if (vSources.disk || vSources.mic) {
            const orgForVan = String(externalOrgMap[orgCode] || whonetOrgMap[orgCode] || orgCode).toLowerCase();
            const rawMic = valuesAligned ? String(valuesTable[i][valuesVanIdx] || '').trim() : null;
            const dec = resolveStaphVancomycin(orgForVan, vSources, rawMic);
            vancFlag = dec.flag; vancMicText = dec.micText;
            if (dec.action !== 'set') vancMicText = null;
            if (dec.action === 'drop') { /* not stored */ }
            else if (dec.action === 'set') { abxResults['Vancomycin'] = dec.value; hasSRIData = true; report.vancFromMic++; }
            else { abxResults['Vancomycin'] = vSources.mic || vSources.disk; hasSRIData = true; }
            if (vancFlag === 'vanc_disk') report.vancDisk++;
            else if (vancFlag === 'vanc_typed_IR') report.vancTypedIR++;
            else if (vancFlag === 'vanc_mic_invalid') report.vancInvalidMic++;
            else if (vancFlag === 'vanc_interp_mismatch') report.vancMismatch++;
            else if (vancFlag === 'vanc_needs_mic') report.vancNeedsMic++;
        }

        if (!hasSRIData) { skippedCount++; report.noSri++; continue; }

        let patientID = idxPatientID > -1 && cols[idxPatientID] ? String(cols[idxPatientID]).trim() : "";
        let fName = idxFName > -1 && cols[idxFName] ? cols[idxFName] : "";
        let lName = idxLName > -1 && cols[idxLName] ? cols[idxLName] : "";
        let name = (fName + " " + lName).trim() || "Unknown Patient";
        let rawAge = idxAge > -1 && cols[idxAge] ? String(cols[idxAge]) : "";
        let ageNum = parseInt(rawAge) || "";
        let ageUnit = "Years";
        if(rawAge.toLowerCase().includes('m')) ageUnit = "Months";
        if(rawAge.toLowerCase().includes('d')) ageUnit = "Days";

        let rawSex = idxSex > -1 && cols[idxSex] ? String(cols[idxSex]).toLowerCase() : "";
        let sex = rawSex.startsWith('f') ? "Female" : "Male";

        let rawWard = idxWard > -1 && cols[idxWard] ? String(cols[idxWard]).toLowerCase() : "";
        let ward = wardMap[rawWard] || (rawWard ? rawWard.charAt(0).toUpperCase() + rawWard.slice(1) : "-");

        if (rawWard && !wardMap[rawWard]) bump(audit.unknownWard, rawWard);
        let rawSample = idxSample > -1 && cols[idxSample] ? String(cols[idxSample]).toLowerCase() : "";
        if (rawSample && !externalSpecimenMap[rawSample]) bump(audit.unknownSpec, rawSample);
        let sample = externalSpecimenMap[rawSample] || (rawSample ? rawSample.charAt(0).toUpperCase() + rawSample.slice(1) : "-");
        // No specimen type: the source cannot be analysed (and screening cultures cannot be excluded), so the row is not imported
        if (!rawSample || sample === '-') { skippedCount++; report.noSpecimen.push(patientID || ('row ' + (i + 1))); continue; }

        let rawDate = idxDate > -1 && cols[idxDate] ? String(cols[idxDate]).trim() : "";
        let formattedDate = ""; 
        let fullDate = "";
        
        if(rawDate) {
            try {
                // Excel Date Fix: Converts Excel serial dates (e.g. 45293) to JS format natively
                if (!isNaN(rawDate) && Number(rawDate) > 10000 && !rawDate.includes('-') && !rawDate.includes('/')) {
                    let d = new Date((Number(rawDate) - 25569) * 86400 * 1000);
                    if (!isNaN(d)) { formattedDate = d.toISOString().slice(0, 7); fullDate = d.toISOString().slice(0, 10); }
                } else {
                    let dateParts = rawDate.split(/[\/\-]/);
                    if(dateParts.length >= 3) {
                        let part1 = dateParts[0];
                        let part2 = dateParts[1].padStart(2, '0');
                        let part3 = dateParts[2].split(' ')[0]; 
                        
                        let year = part1.length === 4 ? part1 : (part3.length === 2 ? "20" + part3 : part3);
                        formattedDate = `${year}-${part2}`;
                        if (part1.length <= 2) fullDate = `${formattedDate}-${part1.padStart(2, '0')}`;   // d/m/yyyy (WHONET)
                        else if (part3.length <= 2) fullDate = `${formattedDate}-${part3.padStart(2, '0')}`; // yyyy-mm-dd
                    } else {
                        let d = new Date(rawDate);
                        if(!isNaN(d)) { formattedDate = d.toISOString().slice(0, 7); fullDate = d.toISOString().slice(0, 10); }
                    }
                }
            } catch (e) {
                console.warn("Skipping invalid date:", rawDate);
            }
        }

        if(!formattedDate) { skippedCount++; report.noDate++; continue; }
        let fullOrgName = externalOrgMap[orgCode] || whonetOrgMap[orgCode] || (orgCode.charAt(0).toUpperCase() + orgCode.slice(1));
        const orgNameCleanup = {
            "Escherichia coli (E.coli)": "Escherichia coli", "Klebsiella pneumoniae ss. pneumoniae": "Klebsiella pneumoniae",
            "Staphylococcus aureus ss. aureus": "Staphylococcus aureus", "Staphylococcus hominis ss. hominis": "Staphylococcus hominis",
            "Staphylococcus capitis ss. capitis": "Staphylococcus capitis", "Staphylococcus saprophyticus ss. saprophyticus": "Staphylococcus saprophyticus"
        };
        if (orgNameCleanup[fullOrgName]) fullOrgName = orgNameCleanup[fullOrgName];
        const selectiveOrgName = canonicalOrganismName(fullOrgName);   // current taxonomy name for analytics
        if (!(externalOrgMap[orgCode] || whonetOrgMap[orgCode])) bump(audit.unknownOrg, orgCode);
        if (selectiveOrgName !== fullOrgName) bump(audit.renamed, fullOrgName + ' → ' + selectiveOrgName);
        unmappedCols.forEach(c => { if (/^[SIR]/i.test(String(cols[c.index] || '').trim())) bump(KNOWN_IGNORED_ABX.has(c.code) ? audit.ignoredAbx : audit.unmappedAbx, c.code); });

        let record = {
            '_uid': Date.now().toString(36) + Math.random().toString(36).substr(2, 5) + i,
            'Patient ID': patientID,
            'Name': name, 'Age': ageNum, 'Age Unit': ageUnit, 'Sex': sex,
            'Ward': ward, 'Sample': sample, 'Date': formattedDate,
            'Selective organism': selectiveOrgName, 'Antibiogram organism': getMinistryCategory(fullOrgName) 
        };

        Object.assign(record, abxResults);
        if (fullDate) record['Specimen Date'] = fullDate;
        const flagVal = (idx) => { const v = idx > -1 ? String(cols[idx] || '').trim() : ''; return (v === '+' || v === '-') ? v : ''; };
        if (flagVal(idxEsbl)) record['Lab ESBL'] = flagVal(idxEsbl);
        if (flagVal(idxCarba)) record['Lab Carbapenemase'] = flagVal(idxCarba);
        if (flagVal(idxMrsaFlag)) record['Lab MRSA'] = flagVal(idxMrsaFlag);
        if (flagVal(idxVrsa)) record['VRSA Confirmation'] = flagVal(idxVrsa);
        if (vancMicText && vancFlag !== 'vanc_mic_invalid' && fullOrgName === 'Staphylococcus aureus') record['Vancomycin MIC'] = vancMicText;
        if (vancFlag === 'vanc_candidate') report.vancCandidates.push(patientID + ' (MIC ' + vancMicText + ')');
        if (record['Patient ID'] && existingKeys.has(dupKey(record))) { skippedCount++; report.duplicates++; continue; }
        newRecords.push(record);
        records.push(record);
        addedCount++;
        report.added++;
    }

    const fileNames = Array.from(event.target.files || []).map(f => f.name);
    const finalize = () => {
        // Laboratory file replaces ALL manual entries of the months it covers
        try {
            const fileMonths = new Set(Object.keys((labAgg && labAgg.months) || {}));
            newRecords.forEach(r => { if (r['Date']) fileMonths.add(String(r['Date']).slice(0, 7)); });
            let removed = 0;
            for (let i = records.length - 1; i >= 0; i--) {
                const r = records[i];
                if (r['Entry'] === 'manual' && fileMonths.has(String(r['Date'] || '').slice(0, 7))) { records.splice(i, 1); removed++; }
            }
            report.manualReplaced = removed;
            report.manualMonths = Array.from(fileMonths).filter(m => m).sort();
        } catch (e) { console.warn('Manual replacement failed', e); }
        try { if (typeof plAutoLink === 'function') plAutoLink(records); } catch (e) {}   // people confirmed before keep their code
        localStorage.setItem('amr_records', JSON.stringify(records));
        try {
            const mergedLab = mergeLabQuality(JSON.parse(localStorage.getItem('amr_lab_quality') || '{}'), labAgg);
            localStorage.setItem('amr_lab_quality', JSON.stringify(mergedLab.merged));
            report.labMonths = Object.keys(labAgg.months).length;
            report.labKept = mergedLab.keptMonths;
        } catch (e) { console.warn('Lab quality aggregate failed', e); }
        initDataTable();
        if (typeof syncLocalToCloud === "function" && navigator.onLine) syncLocalToCloud();
        Promise.resolve(showImportReport(report, audit, newRecords, skippedCount, fileNames)).then(() => { try { return typeof openPatientLink === 'function' ? openPatientLink({ silent: true }) : null; } catch (e) { console.warn(e); } })
            .catch(e => console.warn('Patient link review failed', e))
            .then(() => ensureWardClasses()).then(ch => { if (ch && typeof syncLocalToCloud === 'function' && navigator.onLine) syncLocalToCloud(); }).catch(e => console.warn('Ward rules failed', e));
        event.target.value = '';
    };

    // Same identification number + same year but different patient names: the user decides BEFORE anything is saved
    // A decision is remembered for the same number, year and set of names, so a repeated import does not ask again
    const allGroups = findIdNameConflictGroups(records, newRecords);
    const icKey = g => [g.id.toLowerCase(), g.year, g.names.slice().sort().join('~')].join('|');
    let icStore = {}; try { icStore = JSON.parse(localStorage.getItem('amr_id_conflicts')) || {}; } catch (e) {}
    const known = allGroups.filter(g => icStore[icKey(g)]);
    if (known.length) applyIdConflictDecisions(known, known.map(g => icStore[icKey(g)]));
    const groups = allGroups.filter(g => !icStore[icKey(g)]);
    if (groups.length === 0) { finalize(); return; }
    reviewIdConflicts(groups).then(decisions => {
        if (decisions === null) { event.target.value = ''; Swal.fire('Import cancelled', 'Nothing was saved.', 'info'); return; }
        applyIdConflictDecisions(groups, decisions);
        groups.forEach((g, gi) => { if (decisions[gi] && (decisions[gi].mode === 'same' || decisions[gi].mode === 'diff')) icStore[icKey(g)] = decisions[gi]; });
        try { localStorage.setItem('amr_id_conflicts', JSON.stringify(icStore)); } catch (e) {}
        finalize();
    });
}

// ---- ID / name conflicts: review window shown before saving ----
function findIdNameConflictGroups(allRecords, newRecords) {
    const newSet = new Set(newRecords);
    const map = new Map();
    allRecords.forEach(r => {
        const id = String(r['Patient ID'] || '').trim();
        const year = String(r['Date'] || '').substring(0, 4);
        const nm = normalizePersonName(r['Name']);
        if (!id || id.toLowerCase() === 'unknown' || !/^\d{4}$/.test(year) || !nm || nm === 'unknown patient') return;
        const key = id.toLowerCase() + '|' + year;
        if (!map.has(key)) map.set(key, { id: id, year: year, rows: [], names: [] });
        const g = map.get(key);
        g.rows.push(r);
        if (!g.names.includes(nm)) g.names.push(nm);
    });
    return Array.from(map.values()).filter(g => g.names.length > 1 && g.rows.some(r => newSet.has(r)));
}

function reviewIdConflicts(groups) {
    const cell = 'padding:3px 6px;border-bottom:1px solid #e2e8f0;white-space:nowrap';
    const html = groups.map((g, gi) => {
        const rows = g.rows.map(r => `<tr><td style="${cell}">${escapeHtml(r['Name'] || '')}</td><td style="${cell}">${escapeHtml(r['Specimen Date'] || r['Date'] || '')}</td><td style="${cell}">${escapeHtml(r['Selective organism'] || '')}</td><td style="${cell}">${escapeHtml(r['Sample'] || '')}</td><td style="${cell}">${escapeHtml(r['Ward'] || '')}</td><td style="${cell}">${escapeHtml(String(r['Age'] || ''))} ${escapeHtml(String(r['Sex'] || ''))}</td></tr>`).join('');
        const nameOpts = Array.from(new Set(g.rows.map(r => r['Name']))).map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
        return `<div style="border:1px solid #fde68a;background:#fffbeb;border-radius:8px;padding:8px;margin-bottom:10px;text-align:left">
            <div style="font-weight:700;margin-bottom:4px">ID ${escapeHtml(g.id)} &middot; ${g.year}</div>
            <div style="overflow-x:auto"><table style="font-size:11px;border-collapse:collapse;width:100%"><tr style="color:#64748b"><th style="${cell};text-align:left">Name</th><th style="${cell};text-align:left">Date</th><th style="${cell};text-align:left">Organism</th><th style="${cell};text-align:left">Specimen</th><th style="${cell};text-align:left">Ward</th><th style="${cell};text-align:left">Age/Sex</th></tr>${rows}</table></div>
            <label style="display:block;margin-top:6px;font-size:12px"><input type="radio" name="idc_${gi}" value="same"> Same patient (name typo) &mdash; use name:
                <select id="idc_name_${gi}" style="font-size:12px;max-width:100%">${nameOpts}</select></label>
            <label style="display:block;margin-top:2px;font-size:12px"><input type="radio" name="idc_${gi}" value="diff"> Different patients &mdash; keep separate (the later patient gets the ID suffix -B, -C...)</label>
        </div>`;
    }).join('');
    return Swal.fire({
        title: 'Review identification numbers',
        html: `<p style="font-size:12px;color:#64748b;text-align:left;margin-bottom:8px">The same identification number appears with different names in the same year. First-isolate counting depends on it, so please decide for each case. Nothing has been saved yet.</p>${html}`,
        width: 'min(96vw, 720px)', showCancelButton: true, confirmButtonText: 'Apply and import', cancelButtonText: 'Cancel import', confirmButtonColor: '#0d9488', allowOutsideClick: false,
        preConfirm: () => {
            const out = [];
            for (let i = 0; i < groups.length; i++) {
                const v = document.querySelector(`input[name="idc_${i}"]:checked`);
                if (!v) { Swal.showValidationMessage('Please choose an option for every identification number.'); return false; }
                out.push({ mode: v.value, name: document.getElementById('idc_name_' + i).value });
            }
            return out;
        }
    }).then(res => res.isConfirmed ? res.value : null);
}

function applyIdConflictDecisions(groups, decisions) {
    groups.forEach((g, gi) => {
        const d = decisions[gi];
        if (d.mode !== 'same' && d.mode !== 'diff') return;
        if (d.mode === 'same') {
            g.rows.forEach(r => { if (normalizePersonName(r['Name']) !== normalizePersonName(d.name)) { r['Name Original'] = r['Name']; r['Name'] = d.name; } });
        } else {
            g.names.forEach((nm, ni) => {
                if (ni === 0) return;
                const suffix = '-' + String.fromCharCode(65 + ni);   // B, C, D...
                g.rows.forEach(r => { if (normalizePersonName(r['Name']) === nm) { r['Original ID'] = r['Patient ID']; r['Patient ID'] = g.id + suffix; } });
            });
        }
    });
}
// ---- Import report: what the app corrected automatically + what needs the user's attention ----
function bump(m, k) { m.set(k, (m.get(k) || 0) + 1); }
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function buildImportReport(report, audit, newRecords, skippedCount) {
    const auto = [], attention = [];
    const topList = (m, n) => Array.from(m.entries()).sort((x, y) => y[1] - x[1]).slice(0, n || 8).map(([k, v]) => `${escapeHtml(k)} (${v})`).join(', ');

    // --- applied automatically ---
    if (report.noGrowth) auto.push(`No growth / contaminant / no organism rows not imported: ${report.noGrowth}`);
    if (report.labMonths) auto.push(`Culture counts (positive / no growth / contaminated) updated for ${report.labMonths} month(s); shown in the dashboard Culture Overview tab`);
    if (report.labKept && report.labKept.length) auto.push(`Culture Overview kept the existing counts for ${report.labKept.join(', ')} (the new file held fewer cultures for those months)`);
    if (report.noSri) auto.push(`Identified organisms without susceptibility results not imported: ${report.noSri}`);
    if (report.manualReplaced) auto.push(`Manual entries replaced by the laboratory file (same month): ${report.manualReplaced}`);
    if (report.duplicates) auto.push(`Already in the database, not added again: ${report.duplicates}`);
    if (report.strepPenDisk) auto.push(`Beta-haemolytic streptococci: penicillin/ampicillin R/I by disk ignored (no valid CLSI disk breakpoints): ${report.strepPenDisk}`);
    if (report.vancDisk) auto.push(`Staphylococcus vancomycin by disk ignored (CLSI: MIC only): ${report.vancDisk}`);
    if (report.vancTypedIR) auto.push(`Staphylococcus vancomycin R/I without a numeric MIC ignored: ${report.vancTypedIR}`);
    if (report.vancInvalidMic) auto.push(`Invalid vancomycin MIC values ignored (not on the 2-fold scale): ${report.vancInvalidMic}`);
    if (report.vancMismatch) auto.push(`Vancomycin result re-interpreted from MIC using CLSI breakpoints: ${report.vancMismatch}`);
    if (report.valuesFile) auto.push('Raw-values file matched row by row: MIC values used');
    if (audit.renamed.size) auto.push(`Old organism names updated: ${topList(audit.renamed)}`);
    // Laboratory-confirmed flags found in the file (counts of positive / negative)
    const flagLine = (field, label) => {
        const pos = newRecords.filter(r => r[field] === '+').length, neg = newRecords.filter(r => r[field] === '-').length;
        return (pos || neg) ? `${label}: ${pos} positive, ${neg} negative` : null;
    };
    const flagLines = [flagLine('Lab ESBL', 'Lab ESBL'), flagLine('Lab Carbapenemase', 'Lab carbapenemase'), flagLine('Lab MRSA', 'Lab MRSA'), flagLine('VRSA Confirmation', 'VRSA confirmation (X_VRSA)')].filter(Boolean);
    if (flagLines.length) auto.unshift('Laboratory flags imported - ' + flagLines.join(' | '));
    const screening = newRecords.filter(isScreeningSpecimen).length;
    if (screening) auto.push(`Screening specimens stored but excluded from analysis (CLSI M39): ${screening}`);

    // --- needs attention ---
    if (report.blankOrg) attention.push({ t: `Rows with susceptibility results but no organism name (not imported): ${report.blankOrg}`, d: 'Fix the organism in WHONET and import again.' });
    if (report.futureCultures && report.futureCultures.length) attention.push({ t: `Cultures dated in the future (not counted): ${report.futureCultures.length} (${report.futureCultures.slice(0, 10).map(escapeHtml).join(', ')})`, d: 'The collection date is after today, usually a year typed wrongly. Fix the date in WHONET and import again.' });
    if (report.noSpecimen.length) attention.push({ t: `Rows without a specimen type (not imported): ${report.noSpecimen.length} (${report.noSpecimen.slice(0, 10).map(escapeHtml).join(', ')})`, d: 'Complete the specimen type in WHONET and import again, or add the record manually.' });
    if (audit.unknownOrg.size) attention.push({ t: `Unrecognised organism codes: ${topList(audit.unknownOrg)}`, d: 'These were stored under the raw code. Add them to organisms_dictionary.json so they get a proper name.' });
    if (audit.ignoredAbx.size) auto.push(`Legacy WHONET antibiotic columns recognised and not imported (outside the current CLSI M100 lists): ${topList(audit.ignoredAbx)}`);
    if (audit.unmappedAbx.size) attention.push({ t: `Antibiotic columns with results that the app does not know: ${topList(audit.unmappedAbx)}`, d: 'Their results were NOT imported. The WHONET code has to be added to the antibiotic dictionary.' });
    if (audit.unknownWard.size) attention.push({ t: `Unrecognised ward codes: ${topList(audit.unknownWard)}`, d: 'Stored as typed. Add them to the ward map so they merge with existing wards.' });
    if (audit.unknownSpec.size) attention.push({ t: `Unrecognised specimen codes: ${topList(audit.unknownSpec)}`, d: 'Stored as typed. Add them to specimens_dictionary.json.' });
    if (report.valuesFileIgnored) attention.push({ t: 'The raw-values file did not match the interpretation file row by row and was not used', d: 'Export both files from WHONET with the same filters and sort order.' });
    if (report.vancNeedsMic) attention.push({ t: `S. aureus vancomycin R/I without an MIC (kept as reported): ${report.vancNeedsMic}`, d: 'Select the raw-values file together with the interpretation file so the MIC can be checked.' });
    if (report.vancCandidates.length) attention.push({ t: `VRSA candidates (MIC ≥16): ${report.vancCandidates.map(escapeHtml).join(', ')}`, d: 'Confirm identification and MIC at the reference laboratory before reporting VRSA.' });
    const idFixed = newRecords.filter(r => r['Original ID'] || r['Name Original']).length;
    if (idFixed) auto.push(`Identification numbers / names resolved by you in the review window: ${idFixed} record(s)`);

    const today = new Date().toISOString().slice(0, 7);
    const futureDates = newRecords.filter(r => r['Date'] > today).length;
    if (futureDates) attention.push({ t: `Records dated in the future: ${futureDates}`, d: 'Check the specimen date format (day/month order) in the export.' });
    const noId = newRecords.filter(r => !r['Patient ID']).length;
    if (noId) attention.push({ t: `Records without an identification number: ${noId}`, d: 'They cannot be de-duplicated per patient and are always counted.' });

    const contam = newRecords.filter(isPossibleContaminant).length;
    if (contam) attention.push({ t: `Possible skin-flora contaminants in blood cultures: ${contam}`, d: 'Flagged only. Review clinically (single positive set of CoNS, Corynebacterium, Micrococcus, viridans streptococci...).' });

    // phenotype audit (expected resistance, flag mismatches)
    const phen = new Map(), phenIds = new Map();
    newRecords.forEach(r => auditRecord(r).forEach(i => { bump(phen, i.text); if (!phenIds.has(i.text)) phenIds.set(i.text, []); if (phenIds.get(i.text).length < 5) phenIds.get(i.text).push(r['Patient ID'] || '?'); }));
    if (phen.size) {
        const rows = Array.from(phen.entries()).sort((x, y) => y[1] - x[1]).slice(0, 10).map(([k, v]) => `${escapeHtml(k)}: ${v} (e.g. ${phenIds.get(k).map(escapeHtml).join(', ')})`);
        attention.push({ t: `Unexpected phenotypes: ${Array.from(phen.values()).reduce((p, c) => p + c, 0)} finding(s)`, d: 'Likely identification or reporting errors:<br>' + rows.join('<br>') });
    }
    return { auto, attention };
}

function showImportReport(report, audit, newRecords, skippedCount, fileNames) {
    const rep = buildImportReport(report, audit, newRecords, skippedCount);
    // keep the last 12 reports so they can be reviewed later
    try {
        const log = JSON.parse(localStorage.getItem('amr_import_log')) || [];
        log.unshift({ when: new Date().toISOString(), files: fileNames, added: report.added, skipped: skippedCount, auto: rep.auto, attention: rep.attention });
        localStorage.setItem('amr_import_log', JSON.stringify(log.slice(0, 12)));
    } catch (e) {}
    return Swal.fire({ title: 'Import report', html: renderImportReportHtml({ added: report.added, skipped: skippedCount, auto: rep.auto, attention: rep.attention }), icon: rep.attention.length ? 'warning' : 'success', width: 'min(94vw, 560px)', confirmButtonText: 'Close', confirmButtonColor: '#0d9488' });
}

function renderImportReportHtml(r) {
    let h = `<div style="text-align:left;font-size:13px;line-height:1.55">
        <p style="margin-bottom:8px"><b>${r.added}</b> isolates added &middot; ${r.skipped} rows not imported</p>`;
    if (r.attention.length) {
        h += `<p style="font-weight:700;color:#b45309;margin:10px 0 4px">Needs your attention (${r.attention.length})</p>`;
        r.attention.forEach(x => { h += `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:8px 10px;margin-bottom:6px"><div style="font-weight:600">${x.t}</div><div style="font-size:12px;color:#78716c;margin-top:2px">${x.d}</div></div>`; });
    } else {
        h += `<p style="color:#047857;font-weight:700;margin:10px 0 4px">Nothing needs attention.</p>`;
    }
    if (r.auto.length) {
        h += `<details style="margin-top:8px"><summary style="cursor:pointer;font-weight:700;color:#0f766e">Applied automatically (${r.auto.length})</summary><ul style="margin:6px 0 0 18px;list-style:disc;font-size:12px;color:#475569">` + r.auto.map(x => `<li>${x}</li>`).join('') + '</ul></details>';
    }
    return h + '</div>';
}

window.showImportHistory = function() {
    const log = JSON.parse(localStorage.getItem('amr_import_log')) || [];
    if (!log.length) { Swal.fire({ title: 'Import history', text: 'No imports recorded on this device yet.', icon: 'info' }); return; }
    const html = log.map((e, i) => `<details style="text-align:left;margin-bottom:6px;border:1px solid #e2e8f0;border-radius:8px;padding:6px 10px"><summary style="cursor:pointer;font-weight:600">${new Date(e.when).toLocaleString()} &middot; ${e.added} added${e.attention.length ? ` &middot; <span style="color:#b45309">${e.attention.length} to review</span>` : ''}</summary>${renderImportReportHtml(e)}</details>`).join('');
    Swal.fire({ title: 'Import history', html: html, width: 'min(94vw, 600px)', confirmButtonText: 'Close', confirmButtonColor: '#0d9488' });
};

// Manual entry: choosing the organism selects the matching Ministry antibiogram category automatically
// (it can still be changed by hand afterwards). Not applied while an existing record is being loaded or saved.
window._ministryAutoSuspended = false;
$(document).on('change', '#p_organism', function() {
    if (window._ministryAutoSuspended) return;
    const target = $('#p_antibiogram_org');
    const org = $(this).val();
    if (!target.length || !org) return;
    target.val(getMinistryCategory(org) || '').trigger('change');
});

// Live CLSI interpretation hint for the vancomycin MIC field
$(document).on('input', '#p_van_mic', function() {
    const org = String($('#p_organism').val() || '').toLowerCase();
    const mic = parseMicValue($(this).val());
    let txt = '';
    if (mic && mic.numeric !== undefined && mic.numeric !== null) {
        if (!mic.valid) txt = 'Not a valid 2-fold MIC value';
        else {
            const r = interpretStaphVancomycinMic(org.includes('staphylococcus aureus'), mic);
            txt = r ? 'CLSI M100: ' + r + (org.includes('staphylococcus aureus') && r === 'R' ? ' - VRSA candidate, confirm at reference lab' : '') : '';
        }
    }
    $('#p_van_mic_hint').text(txt);
});

// --- 3. Initialization ---
$(document).ready(function() {
    try { const st = JSON.parse(localStorage.getItem('amr_sync_status') || 'null'); if (st) setSyncStatus(st.kind, st.text); } catch (e) {}
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
    
    let today = new Date().toISOString().slice(0, 7);
    $('#p_date').val(today);
    
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
// --- Tabs Logic ---
function showTab(tabName) {
    $('#viewRecords').addClass('hidden');
    $('#btnTabRecords').removeClass('bg-teal-600 text-white border-teal-400').addClass('bg-white/10 text-teal-50 border-teal-500/30');
    
    if (tabName === 'records') {
        $('#viewRecords').removeClass('hidden');
        $('#btnTabRecords').removeClass('bg-white/10 text-teal-50 border-teal-500/30').addClass('bg-teal-600 text-white border-teal-400');
    }
}

// --- BACKUP AND RESTORE LOGIC ---
function showBackupModal() {
    Swal.fire({
        title: '💾 Selective Backup & Smart Restore',
        html: `
            <div class="text-left space-y-4 mt-2">
                <div class="bg-teal-50 p-4 rounded-xl border border-teal-100">
                    <h4 class="font-bold text-teal-900 mb-2">1. Backup Data</h4>
                    <p class="text-xs text-slate-600 mb-3">Select a specific time range to backup your patient records.</p>
                    
                    <select id="backupRangeType" class="w-full border border-slate-300 p-2.5 rounded-lg mb-3 text-sm focus:ring-teal-500 outline-none" onchange="toggleBackupDates('backup')">
                        <option value="all">All Records</option>
                        <option value="month">Specific Month</option>
                        <option value="year">Specific Year</option>
                        <option value="range">Date Range</option>
                    </select>
                    
                    <input type="month" id="backupMonth" class="w-full border border-slate-300 p-2.5 rounded-lg mb-3 text-sm hidden focus:ring-teal-500 outline-none">
                    <input type="number" id="backupYear" placeholder="Enter Year (e.g., 2026)" class="w-full border border-slate-300 p-2.5 rounded-lg mb-3 text-sm hidden focus:ring-teal-500 outline-none">
                    <div id="backupRange" class="hidden flex gap-2 mb-3">
                        <input type="month" id="backupStart" class="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:ring-teal-500 outline-none">
                        <input type="month" id="backupEnd" class="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:ring-teal-500 outline-none">
                    </div>
                    
                    <button onclick="downloadBackup()" class="w-full bg-teal-600 text-white font-bold py-2 rounded-lg shadow hover:bg-teal-700 transition-colors">📥 Download Backup</button>
                </div>
                
                <div class="bg-amber-50 p-4 rounded-xl border border-amber-100">
                    <h4 class="font-bold text-amber-900 mb-2">2. Smart Restore Data</h4>
                    <p class="text-xs text-slate-600 mb-3">Upload a backup file. <b class="text-emerald-600">Safe Merge:</b> New records will be added, existing ones updated. Nothing will be deleted.</p>
                    
                    <select id="restoreRangeType" class="w-full border border-slate-300 p-2.5 rounded-lg mb-3 text-sm focus:ring-amber-500 outline-none" onchange="toggleBackupDates('restore')">
                        <option value="all">Restore All Records from File</option>
                        <option value="month">Restore Specific Month Only</option>
                        <option value="year">Restore Specific Year Only</option>
                        <option value="range">Restore Date Range Only</option>
                    </select>
                    
                    <input type="month" id="restoreMonth" class="w-full border border-slate-300 p-2.5 rounded-lg mb-3 text-sm hidden focus:ring-amber-500 outline-none">
                    <input type="number" id="restoreYear" placeholder="Enter Year (e.g., 2026)" class="w-full border border-slate-300 p-2.5 rounded-lg mb-3 text-sm hidden focus:ring-amber-500 outline-none">
                    <div id="restoreRange" class="hidden flex gap-2 mb-3">
                        <input type="month" id="restoreStart" class="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:ring-amber-500 outline-none">
                        <input type="month" id="restoreEnd" class="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:ring-amber-500 outline-none">
                    </div>
                    
                    <input type="file" id="backupFileInput" accept=".json" class="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-100 file:text-amber-700 hover:file:bg-amber-200 mb-3" />
                    <button onclick="processRestore()" class="w-full bg-amber-600 text-white font-bold py-2 rounded-lg shadow hover:bg-amber-700 transition-colors">📤 Smart Restore</button>
                </div>
            </div>
        `,
        showConfirmButton: false,
        showCloseButton: true,
        width: '500px'
    });
}

window.toggleBackupDates = function(mode) {
    const type = document.getElementById(`${mode}RangeType`).value;
    document.getElementById(`${mode}Month`).classList.add('hidden');
    document.getElementById(`${mode}Year`).classList.add('hidden');
    document.getElementById(`${mode}Range`).classList.add('hidden');
    
    if (type === 'month') document.getElementById(`${mode}Month`).classList.remove('hidden');
    if (type === 'year') document.getElementById(`${mode}Year`).classList.remove('hidden');
    if (type === 'range') document.getElementById(`${mode}Range`).classList.remove('hidden');
    if (type === 'range') document.getElementById(`${mode}Range`).classList.add('flex');
};

window.downloadBackup = function() {
    try {
        const type = document.getElementById('backupRangeType').value;
        let allRecords = JSON.parse(localStorage.getItem('amr_records')) || [];
        
        if (type === 'month') {
            const m = document.getElementById('backupMonth').value;
            if (!m) { Swal.fire('Required', 'Please select a month.', 'warning'); return; }
            allRecords = allRecords.filter(r => r.Date && r.Date.startsWith(m));
        } else if (type === 'year') {
            const y = document.getElementById('backupYear').value;
            if (!y) { Swal.fire('Required', 'Please enter a year.', 'warning'); return; }
            allRecords = allRecords.filter(r => r.Date && r.Date.startsWith(y));
        } else if (type === 'range') {
            const s = document.getElementById('backupStart').value;
            const e = document.getElementById('backupEnd').value;
            if (!s || !e) { Swal.fire('Required', 'Please select start and end dates.', 'warning'); return; }
            allRecords = allRecords.filter(r => r.Date && r.Date >= s && r.Date <= e);
        }

        if (allRecords.length === 0) {
            Swal.fire('No Data', 'There are no records matching your selected timeframe.', 'info');
            return;
        }

        const data = {
            amr_records: allRecords,
            amr_samples: JSON.parse(localStorage.getItem('amr_samples')) || (typeof defaultSamples !== 'undefined' ? defaultSamples : []),
            amr_wards: JSON.parse(localStorage.getItem('amr_wards')) || (typeof defaultWards !== 'undefined' ? defaultWards : []),
            amr_organisms: JSON.parse(localStorage.getItem('amr_organisms')) || [],
            amr_custom_abx_v2: JSON.parse(localStorage.getItem('amr_custom_abx_v2')) || [],
            amr_live_settings: JSON.parse(localStorage.getItem('amr_live_settings')) || null,
            amr_lab_quality: JSON.parse(localStorage.getItem('amr_lab_quality')) || null,
            amr_patient_links: JSON.parse(localStorage.getItem('amr_patient_links')) || null,
            amr_id_conflicts: JSON.parse(localStorage.getItem('amr_id_conflicts')) || null,
            amr_ward_class: JSON.parse(localStorage.getItem('amr_ward_class')) || null
        };

        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const dateSuffix = type === 'all' ? 'All_Data' : (type === 'month' ? document.getElementById('backupMonth').value : (type === 'year' ? document.getElementById('backupYear').value : 'Date_Range'));
        
        if (typeof saveAs !== 'undefined') {
            saveAs(blob, `AMR_Tracker_Backup_${dateSuffix}.json`);
        } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `AMR_Tracker_Backup_${dateSuffix}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
        
        Swal.fire('Success!', `Backup downloaded containing ${allRecords.length} records.`, 'success');

    } catch (error) {
        console.error("Exact Backup Error:", error);
        Swal.fire({
            icon: 'error',
            title: 'System Error Detected',
            html: `We found the exact issue causing the button to stop. Please tell me this error message:<br><br><b class="text-red-600 text-sm">${error.message}</b>`
        });
    }
};

window.processRestore = function() {
    const fileInput = document.getElementById('backupFileInput');
    if (!fileInput.files.length) {
        Swal.fire('Required', 'Please select a backup file first.', 'warning');
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (!importedData.amr_records) throw new Error("Invalid backup file structure.");

            Swal.fire({
                title: 'Smart Merge Confirmation',
                text: "Your current data will be kept safe. New records from the file will be added, and existing matches will be updated.",
                icon: 'info',
                showCancelButton: true,
                confirmButtonColor: '#10b981',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Yes, Merge Safely!'
            }).then((result) => {
                if (result.isConfirmed) {
                    let currentRecords = JSON.parse(localStorage.getItem('amr_records')) || [];
                    let importedRecords = importedData.amr_records || [];
                    let addedCount = 0;
                    let updatedCount = 0;

                    // Apply the Date Range Filter if selected on the UI
                    const typeEl = document.getElementById('restoreRangeType');
                    if (typeEl) {
                        const type = typeEl.value;
                        if (type === 'month') {
                            const m = document.getElementById('restoreMonth').value;
                            importedRecords = importedRecords.filter(r => r.Date && r.Date.startsWith(m));
                        } else if (type === 'year') {
                            const y = document.getElementById('restoreYear').value;
                            importedRecords = importedRecords.filter(r => r.Date && r.Date.startsWith(y));
                        } else if (type === 'range') {
                            const s = document.getElementById('restoreStart').value;
                            const e = document.getElementById('restoreEnd').value;
                            importedRecords = importedRecords.filter(r => r.Date && r.Date >= s && r.Date <= e);
                        }
                    }

                    normalizeOrganismNames(importedRecords);   // old organism names in old backups -> current names
                    importedRecords.forEach(importedRecord => {
                        let matchIndex = currentRecords.findIndex(r => {
                            // 1. Exact match using hidden _uid (Safe Update for edited records)
                            if (r['_uid'] && importedRecord['_uid'] && r['_uid'] === importedRecord['_uid']) {
                                return true;
                            }
                            
                            // 2. Fallback match: ONLY merge if Patient ID is NOT "Unknown". 
                            // If it's "Unknown", treat it as a separate patient and do not merge.
                            let validLocalId = r['Patient ID'] && r['Patient ID'].toLowerCase() !== 'unknown';
                            let validImportId = importedRecord['Patient ID'] && importedRecord['Patient ID'].toLowerCase() !== 'unknown';
                            
                            if (!r['_uid'] && validLocalId && validImportId && r['Patient ID'] === importedRecord['Patient ID'] && r['Selective organism'] === importedRecord['Selective organism'] && r['Date'] === importedRecord['Date']) {
                                return true;
                            }
                            return false;
                        });

                        if (matchIndex > -1) {
                            // Update existing record
                            currentRecords[matchIndex] = { ...currentRecords[matchIndex], ...importedRecord };
                            updatedCount++;
                        } else {
                            // Append new record - and assign a _uid if it's missing to prevent future conflicts
                            if (!importedRecord['_uid']) {
                                importedRecord['_uid'] = Date.now().toString(36) + Math.random().toString(36).substr(2, 5) + addedCount;
                            }
                            currentRecords.push(importedRecord);
                            addedCount++;
                        }
                    });

                    localStorage.setItem('amr_records', JSON.stringify(currentRecords));

                    const mergeArray = (localKey, importedArr) => {
                        if (!importedArr) return;
                        let localArr = JSON.parse(localStorage.getItem(localKey)) || [];
                        let combined = [...new Set([...localArr, ...importedArr])];
                        localStorage.setItem(localKey, JSON.stringify(combined));
                    };

                    mergeArray('amr_samples', importedData.amr_samples);
                    mergeArray('amr_wards', importedData.amr_wards);
                    mergeArray('amr_organisms', importedData.amr_organisms);

                    if (importedData.amr_lab_quality && importedData.amr_lab_quality.months) {
                        const lq = mergeLabQuality(JSON.parse(localStorage.getItem('amr_lab_quality') || '{}'), importedData.amr_lab_quality);
                        localStorage.setItem('amr_lab_quality', JSON.stringify(lq.merged));
                    }
                    // Repeat-patient decisions and ward rules: kept from the backup, local ones win on a clash
                    try {
                        if (importedData.amr_patient_links && importedData.amr_patient_links.decisions) {
                            const cur = JSON.parse(localStorage.getItem('amr_patient_links') || '{"decisions":{}}'); cur.decisions = cur.decisions || {};
                            Object.keys(importedData.amr_patient_links.decisions).forEach(k => { if (!cur.decisions[k]) cur.decisions[k] = importedData.amr_patient_links.decisions[k]; });
                            localStorage.setItem('amr_patient_links', JSON.stringify(cur));
                        }
                        if (importedData.amr_id_conflicts) {
                            const ic = Object.assign({}, importedData.amr_id_conflicts, JSON.parse(localStorage.getItem('amr_id_conflicts') || '{}'));
                            localStorage.setItem('amr_id_conflicts', JSON.stringify(ic));
                        }
                        if (importedData.amr_ward_class) {
                            const wc = Object.assign({}, importedData.amr_ward_class, JSON.parse(localStorage.getItem('amr_ward_class') || '{}'));
                            localStorage.setItem('amr_ward_class', JSON.stringify(wc));
                        }
                    } catch (e) { console.warn('Restore of link decisions failed', e); }
                    if (!localStorage.getItem('amr_live_settings') && importedData.amr_live_settings) {
                        localStorage.setItem('amr_live_settings', JSON.stringify(importedData.amr_live_settings));
                    }

                    if (importedData.amr_custom_abx_v2) {
                        let localAbx = JSON.parse(localStorage.getItem('amr_custom_abx_v2')) || [];
                        importedData.amr_custom_abx_v2.forEach(impAbx => {
                            if (!localAbx.some(l => l.name === impAbx.name)) {
                                localAbx.push(impAbx);
                            }
                        });
                        localStorage.setItem('amr_custom_abx_v2', JSON.stringify(localAbx));
                    }

                    if (typeof loadBacteriaOptions === 'function') loadBacteriaOptions();
                    if (typeof loadSampleOptions === 'function') loadSampleOptions();
                    if (typeof loadWardOptions === 'function') loadWardOptions();
                    if (typeof renderDefaultAntibiotics === 'function') renderDefaultAntibiotics();
                    if (typeof initDataTable === 'function') initDataTable();

                    if (typeof syncLocalToCloud === "function" && navigator.onLine) {
                        syncLocalToCloud();
                    }

                    Swal.fire('Restored Successfully!', `Merged data safely:<br>+ ${addedCount} New Records<br>🔄 ${updatedCount} Updated Records`, 'success');
                }
            });
        } catch (error) {
            Swal.fire('Error', 'Invalid or corrupted backup file.', 'error');
        }
    };
    reader.readAsText(file);
};


// --- DASHBOARD CONTROL (same settings page as the phone, embedded) ---
// Both devices edit the same cloud settings; each save is time-stamped and the newest change wins.
function showDashControl() {
    const f = document.getElementById('ctlFrame');
    if (f && !f.getAttribute('src')) f.setAttribute('src', 'control.html?embedded=1');
    $('#ctlModal').removeClass('hidden');
}
function closeDashControl() { $('#ctlModal').addClass('hidden'); }
window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || !e.data || e.data.type !== 'amr-settings' || !e.data.settings) return;
    try { localStorage.setItem('amr_live_settings', JSON.stringify(e.data.settings)); } catch (err) {}
    if (typeof toast === 'function') { try { toast('Dashboard settings published'); } catch (err2) {} }
});

// --- APP MODALS ---
function showSettingsModal() {
    loadAbbreviations();
    restoreSyncStatus();
    $('#settingsModal').removeClass('hidden');
}

function closeSettingsModal() {
    $('#settingsModal').addClass('hidden');
}

function showAboutModal() {
    Swal.fire({
        html: `
            <div class="text-sm text-slate-600 leading-relaxed text-center space-y-4">
                <div class="mx-auto w-16 h-16 bg-blue-50 text-blue-700 rounded-full flex items-center justify-center mb-4 border border-blue-100 shadow-sm">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                </div>
                <h3 class="text-xl font-bold text-slate-800">AMR Tracker</h3>
                <p class="font-medium text-blue-700">Antimicrobial Resistance Surveillance System</p>
                <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center text-sm leading-loose mt-4">
                    This platform was designed and developed by a member of the Antibiotic Committee, <b>Clinical Pharmacist Saad Nabeel Al-Hamadi</b>,
                    in collaboration with the <b>AMR Unit</b> and the <b>Microbiology Laboratory</b> staff at <b>Al-Mawani Teaching Hospital</b>.
                </div>
                <p class="text-xs text-slate-500 mt-4">
                    This clinical system is developed to facilitate professional data entry, robust epidemiology reporting, and precise antibiogram generation. All rights reserved &copy; 2026.
                </p>
            </div>
        `,
        showConfirmButton: true,
        confirmButtonText: 'Close',
        confirmButtonColor: '#1d4ed8',
        width: '500px'
    });
}

function showInstallGuide() {
    Swal.fire({
        title: '💻 System Installation Guide',
        html: `
            <div class="text-sm text-slate-600 leading-relaxed space-y-4 text-left mt-3">
                <p>This system operates entirely locally (offline) within your browser to ensure absolute patient data privacy. To install it natively on your computer:</p>
                <ol class="list-decimal pl-5 space-y-2 font-medium bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <li>Open this application in <b>Google Chrome</b> or <b>Microsoft Edge</b>.</li>
                    <li>Click on the browser's menu (3 vertical dots in the top right).</li>
                    <li>Go to <b>Save and share</b> (or Apps) &gt; <b>Install page as app</b>.</li>
                    <li>Ensure you check the box <b>"Open as window"</b>.</li>
                    <li>Click <b>Install</b>.</li>
                </ol>
            </div>
        `,
        showConfirmButton: true,
        confirmButtonText: 'Got it!',
        confirmButtonColor: '#0f766e',
        width: '550px'
    });
}

function clearAllDatabase() {
    Swal.fire({
        title: 'Are you absolutely sure?',
        text: "This will permanently delete ALL patient isolate records and the stored culture counts. Your custom dictionaries and settings will NOT be affected. You cannot undo this action!",
        icon: 'error',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, DELETE ALL RECORDS'
    }).then((result) => {
        if (result.isConfirmed) {
            // Delete ONLY the records key from local storage
            localStorage.removeItem('amr_records');
            localStorage.removeItem('amr_lab_quality');   // culture counts (growth / no growth) are built from the same imports
            
            // Refresh the data table to show it is empty
            initDataTable();
            
            // Sync the empty table to the cloud to overwrite old data (explicitly confirmed above)
            if (typeof syncLocalToCloud === "function" && navigator.onLine) {
                syncLocalToCloud({ force: true });
            }

            Swal.fire('Cleared!', 'All patient records have been successfully deleted.', 'success');
        }
    });
}

// --- Abbreviations Logic ---
function loadAbbreviations() {
    let abbr = JSON.parse(localStorage.getItem('amr_custom_abbreviations')) || {};
    let html = '';
    for (const [code, name] of Object.entries(abbr)) {
        html += `<tr class="hover:bg-slate-50 transition-colors">
            <td class="p-3 border-b text-slate-700 font-bold uppercase">${code}</td>
            <td class="p-3 border-b text-slate-600">${name}</td>
            <td class="p-3 border-b text-center">
                <button onclick="deleteAbbreviation('${code}')" class="text-red-500 hover:text-red-700 font-bold px-2 py-1 rounded hover:bg-red-50 transition-colors text-xs">Delete</button>
            </td>
        </tr>`;
    }
    if(html === '') html = '<tr><td colspan="3" class="text-center p-4 text-slate-400">No custom abbreviations added yet.</td></tr>';
    $('#abbrTableBody').html(html);
}

function addAbbreviation() {
    let code = $('#abbrCode').val().trim().toLowerCase();
    let name = $('#abbrName').val().trim();
    if (!code || !name) {
        Swal.fire({icon: 'warning', title: 'Missing Info', text: 'Please provide both the short code and the full scientific name.'});
        return;
    }
    let abbr = JSON.parse(localStorage.getItem('amr_custom_abbreviations')) || {};
    abbr[code] = name;
    localStorage.setItem('amr_custom_abbreviations', JSON.stringify(abbr));
    $('#abbrCode').val(''); $('#abbrName').val('');
    loadAbbreviations();
}

function deleteAbbreviation(code) {
    let abbr = JSON.parse(localStorage.getItem('amr_custom_abbreviations')) || {};
    delete abbr[code];
    localStorage.setItem('amr_custom_abbreviations', JSON.stringify(abbr));
    loadAbbreviations();
}

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
                        <option value="SDD" class="text-orange-600 bg-orange-50">SDD</option>
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
    
    // جلب البكتيريا من المكتبة
    bacteriaLibrary.forEach(bact => {
        const optionText = `${bact.name} (${bact.code})`;
        groups[bact.group].push(new Option(optionText, bact.name));
    });

    // جلب البكتيريا المضافة يدوياً (Custom)
    let savedOrgs = JSON.parse(localStorage.getItem('amr_organisms')) || [];
    savedOrgs.forEach(org => {
        groups["Custom"].push(new Option(org, org));
    });

    // إضافة البكتيريا إلى القائمة المنسدلة
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


function initDataTable() {
    let records = JSON.parse(localStorage.getItem('amr_records')) || [];
    
    let cols = [
        { data: null, title: 'Action', orderable: false, className: 'text-center', render: function(data, type, row, meta) {
            return `
            <div class="flex justify-center gap-2">
                <button onclick="editRecord(${meta.row})" class="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-colors">Edit</button>
                <button onclick="deleteRecord(${meta.row})" class="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-colors">Delete</button>
            </div>`;
        }},
        { data: 'Name', title: 'Patient Name / ID', className: 'font-semibold text-slate-700', defaultContent: 'Unknown' },
        { data: null, title: 'Age', render: function(data, type, row) { 
            return row['Age'] ? row['Age'] + ' ' + (row['Age Unit'] || '') : '-'; 
        }},
        { data: 'Sex', title: 'Gender', defaultContent: '-' },
        { data: 'Ward', title: 'Ward / Dept', defaultContent: '-' },
        { data: 'Sample', title: 'Specimen', defaultContent: '-' },
        { data: 'Date', title: 'Collection Date', defaultContent: '-' },
        { data: 'Selective organism', title: 'Isolated Organism', className: 'font-semibold text-slate-700', defaultContent: '-' }
    ];

    let customAbx = getCustomAntibiotics();
    let allAbxColumns = [...abxList, ...customAbx.map(a=>a.name)];
    allAbxColumns.forEach(abx => { 
        cols.push({ 
            data: abx, 
            title: abx, 
            defaultContent: '-',
            render: function(data) {
                if (data === 'S') return `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">S</span>`;
                if (data === 'I') return `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800">I</span>`;
                if (data === 'R') return `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800">R</span>`;
                return data;
            }
        }); 
    });

    // 💡 الحل الجذري: الذاكرة اليدوية لالتقاط الفلاتر والصفحات قبل تدمير الجدول
    let savedPage = 0;
    let savedSearch = "";
    let savedColFilters = {};

    if ($.fn.DataTable.isDataTable('#recordsTable')) {
        let table = $('#recordsTable').DataTable();
        
        // 1. حفظ الصفحة الحالية وكلمة البحث
        savedPage = table.page();
        savedSearch = table.search();
        
        // 2. حفظ الخيارات المحددة من القوائم المنسدلة
        $('#recordsTable thead select').each(function() {
            let val = $(this).val();
            if (val) {
                let colIdx = table.column($(this).parent()).index();
                savedColFilters[colIdx] = val;
            }
        });

        table.destroy();
        $('#recordsTable').empty();
    }

    dataTable = $('#recordsTable').DataTable({
        data: records,
        columns: cols,
        scrollX: true, 
        deferRender: true,
        order: [[ 6, "desc" ]],
        stateSave: false, // 🔴 يجب أن يبقى false لمنع تضارب الأعمدة الديناميكية
        search: { search: savedSearch }, // 3. استعادة البحث العام فوراً
        dom: '<"flex flex-col md:flex-row justify-between items-center mb-4 gap-4"l fB>rt<"flex flex-col md:flex-row justify-between items-center mt-4 gap-4"ip>',
        buttons: [
            { extend: 'excelHtml5', text: 'Export Basic List', className: 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg px-4 py-2 text-sm font-bold shadow-sm transition-colors' }
        ],
        pageLength: 10, 
        lengthMenu: [[10, 15, 25, 50, -1], [10, 15, 25, 50, "All"]],
        language: { 
            search: "", 
            searchPlaceholder: "Search Records...",
            lengthMenu: "Show _MENU_ entries"
        },
        initComplete: function () {
            let api = this.api();
            
            api.columns([3, 4, 5, 6, 7]).every(function () {
                let column = this;
                let colIdx = column.index();
                
                let select = $('<select class="mt-2 block w-full text-xs border-slate-300 rounded shadow-sm focus:ring-blue-500 font-normal outline-none"><option value="">All</option></select>')
                    .appendTo($(column.header()))
                    .on('change', function () {
                        let val = $.fn.dataTable.util.escapeRegex($(this).val());
                        column.search(val ? '^' + val + '$' : '', true, false).draw();
                    })
                    .on('click', function(e) { e.stopPropagation(); });

                column.data().unique().sort().each(function (d, j) {
                    if(d && d !== '-') {
                        select.append('<option value="' + d + '">' + d + '</option>');
                    }
                });
                
                // 4. استعادة الفلتر الخاص بهذا العمود إن كان موجوداً قبل التعديل
                if (savedColFilters[colIdx]) {
                    select.val(savedColFilters[colIdx]);
                    let escapedVal = $.fn.dataTable.util.escapeRegex(savedColFilters[colIdx]);
                    column.search('^' + escapedVal + '$', true, false); 
                }
            });

            $('.dataTables_filter input').addClass('w-64 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm');$('.dataTables_length select').addClass('border border-slate-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm mx-2');
            
            // 5. رسم الجدول مع استعادة الصفحة الحالية
            if (savedPage > 0 || Object.keys(savedColFilters).length > 0) {
                api.page(savedPage).draw(false);
            }
        }
    });
}
function openModal() {
    $('#entryForm')[0].reset();
    $('#editIndex').val('-1');
    $('#p_id').val('');
    $('#p_date').val(new Date().toISOString().slice(0, 7));
    $('#p_specimen_date, #p_van_mic').val('');
    $('#p_lab_esbl, #p_lab_carba, #p_lab_mrsa, #p_vrsa_conf').val('');
    $('#p_van_mic_hint').text('');
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
                <option value="SDD" class="text-orange-600" ${result==='SDD'?'selected':''}>SDD</option>
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
        window._ministryAutoSuspended = true;   // do not overwrite the category chosen for this record
        $('#p_organism').append(new Option(currentOrganism, currentOrganism, true, true)).trigger('change');
        window._ministryAutoSuspended = false;
    }

    // Retrieve records and index FIRST before building the record
    let records = JSON.parse(localStorage.getItem('amr_records')) || [];
    let editIndex = $('#editIndex').val();

    let record = {
        '_uid': editIndex > -1 ? (records[editIndex]['_uid'] || Date.now().toString() + Math.random().toString(36).substr(2, 5)) : Date.now().toString() + Math.random().toString(36).substr(2, 5),
        'Patient ID': $('#p_id').val() || "Unknown",
        'Name': $('#p_name').val(),
        'Age': $('#p_age').val(),
        'Age Unit': $('#p_age_unit').val(),
        'Sex': $('#p_sex').val(),
        'Ward': currentWard || "-",
        'Sample': currentSample,
        'Date': $('#p_date').val(),
        'Selective organism': canonicalOrganismName(currentOrganism),
        'Antibiogram organism': $('#p_antibiogram_org').val() 
    };

    if (!record['Selective organism']) {
        Swal.fire({ icon: 'error', title: 'Oops...', text: 'Please select an organism.' });
        return;
    }

    // Optional full specimen date: must fall in the selected month (keeps first-isolate ordering consistent)
    const specDate = $('#p_specimen_date').val();
    if (specDate) {
        if (specDate.substring(0, 7) !== record['Date']) {
            Swal.fire({ icon: 'error', title: 'Date mismatch', text: 'Specimen date must be inside the selected Month / Year.' });
            return;
        }
        record['Specimen Date'] = specDate;
    }
    [['#p_lab_esbl', 'Lab ESBL'], ['#p_lab_carba', 'Lab Carbapenemase'], ['#p_lab_mrsa', 'Lab MRSA'], ['#p_vrsa_conf', 'VRSA Confirmation']].forEach(([sel, key]) => {
        const v = $(sel).val(); if (v) record[key] = v;
    });

    Object.keys(selectedAbxMap).forEach(abx => {
        record[abx] = selectedAbxMap[abx];
    });

    $('.default-abx-select').each(function() {
        const val = $(this).val();
        if (val && val !== "") { record[$(this).attr('data-abx')] = val; }
    });

    // Staphylococcus vancomycin: MIC only (CLSI M100); S/I/R is derived from the MIC, never from disk
    const orgLowerSave = String(record['Selective organism']).toLowerCase();
    if (orgLowerSave.startsWith('staphylococcus')) {
        const micText = ($('#p_van_mic').val() || '').trim();
        delete record['Vancomycin'];
        if (micText) {
            const mic = parseMicValue(micText);
            if (!mic || mic.numeric === undefined || mic.numeric === null || !mic.valid) {
                Swal.fire({ icon: 'error', title: 'Invalid vancomycin MIC', text: 'Use a standard 2-fold dilution value (0.5, 1, 2, 4, 8, 16, 32 ...).' });
                return;
            }
            const interp = interpretStaphVancomycinMic(orgLowerSave.includes('staphylococcus aureus'), mic);
            if (interp) record['Vancomycin'] = interp;
            if (orgLowerSave.includes('staphylococcus aureus')) record['Vancomycin MIC'] = micText;
        }
    }


if (editIndex > -1) {
        // keep the origin of the record: manual entries stay marked, laboratory imports stay unmarked
        if (records[editIndex] && records[editIndex]['Entry']) record['Entry'] = records[editIndex]['Entry'];
        records[editIndex] = record; 
    } else {
        record['Entry'] = 'manual';   // replaced automatically when the laboratory file for the same month is imported
        records.push(record); 
    }

    localStorage.setItem('amr_records', JSON.stringify(records));
    closeModal();
    initDataTable();
    

    // السطور التي يجب إضافتها لرفع السجل الجديد فوراً للسحابة
    if (typeof syncLocalToCloud === "function" && navigator.onLine) {
        syncLocalToCloud();
    }

    Swal.fire({ icon: 'success', title: 'Saved!', timer: 1500, showConfirmButton: false }).then(() => ensureWardClasses()).then(ch => { if (ch && typeof syncLocalToCloud === 'function' && navigator.onLine) syncLocalToCloud(); });
});

function editRecord(index) {
    let records = JSON.parse(localStorage.getItem('amr_records')) || [];
    let record = records[index];
    
    openModal();
    $('#modalTitle').text('Edit Patient Record');
    $('#editIndex').val(index);
    
    $('#p_id').val(record['Patient ID'] || '');
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
    $('#p_specimen_date').val(record['Specimen Date'] || '');
    $('#p_lab_esbl').val(record['Lab ESBL'] || '');
    $('#p_lab_carba').val(record['Lab Carbapenemase'] || '');
    $('#p_lab_mrsa').val(record['Lab MRSA'] || '');
    $('#p_vrsa_conf').val(record['VRSA Confirmation'] || '');
    $('#p_van_mic').val(record['Vancomycin MIC'] || '');
    
    window._ministryAutoSuspended = true;   // keep the saved Ministry category while loading
    if ($('#p_organism').find("option[value='" + record['Selective organism'] + "']").length) {
        $('#p_organism').val(record['Selective organism']).trigger('change');
    } else {
        var newOrgOption = new Option(record['Selective organism'], record['Selective organism'], true, true);
        $('#p_organism').append(newOrgOption).trigger('change');
    }
    window._ministryAutoSuspended = false;

    if (record['Antibiogram organism']) {
        $('#p_antibiogram_org').val(record['Antibiogram organism']).trigger('change');
    } else {
        $('#p_antibiogram_org').val('').trigger('change');
    }

    // 🔒 Fixed: Added _uid and Patient ID so they never become antibiotic dropdowns again
    const standardProps = ['_uid', 'Patient ID', 'Name', 'Age', 'Age Unit', 'Sex', 'Ward', 'Sample', 'Date', 'Selective organism', 'Antibiogram organism'].concat(RECORD_META_FIELDS);
    
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
    Swal.fire({ 
        title: 'Are you sure?', 
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#e11d48', 
        confirmButtonText: 'Yes, delete it!' 
    })
    .then((result) => {
        if (result.isConfirmed) {
            let records = JSON.parse(localStorage.getItem('amr_records')) || [];
            
            // 1. حذف القيد من السجلات المحلية
            records.splice(index, 1); 
            localStorage.setItem('amr_records', JSON.stringify(records));
            
            // 2. تحديث الجدول أمام المستخدم
            initDataTable(); 
            
            // 3. الإضافة الجديدة: رفع التحديث (بعد الحذف) إلى السحابة إذا كان الإنترنت متوفراً
            if (typeof syncLocalToCloud === "function" && navigator.onLine) {
                syncLocalToCloud();
            }

            Swal.fire('Deleted!', '', 'success');
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
    manageSamples();
};

// ---------- Unit class of each ward (inpatient / outpatient): the user decides once, the choice is kept as a rule ----------
function getWardClassMap() { try { const m = JSON.parse(localStorage.getItem('amr_ward_class')); return (m && typeof m === 'object') ? m : null; } catch (e) { return null; } }
function saveWardClassMap(m) { localStorage.setItem('amr_ward_class', JSON.stringify(m)); }
function wardsInUse() {
    let recs = []; try { recs = JSON.parse(localStorage.getItem('amr_records')) || []; } catch (e) {}
    let saved = []; try { saved = JSON.parse(localStorage.getItem('amr_wards')) || []; } catch (e) {}
    const seen = new Map();
    recs.map(r => r.Ward).concat(saved, (typeof defaultWards !== 'undefined' ? defaultWards : [])).forEach(w => {
        const t = String(w || '').trim(); if (t && t !== '-' && t.toLowerCase() !== 'unknown' && !seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t);
    });
    return Array.from(seen.values()).sort();
}
// Resolves true when a rule was added. First use: the wards already in the data get the class suggested by their name, so only wards that appear later are asked about.
async function ensureWardClasses() {
    let map = getWardClassMap(), changed = false;
    const all = wardsInUse();
    if (!map) {
        map = {};
        all.forEach(w => { const g = guessWardClass(w); if (g === 'inpatient' || g === 'outpatient') map[w.toLowerCase()] = g; });
        saveWardClassMap(map);
        return true;
    }
    for (const w of all.filter(x => !map[x.toLowerCase()])) {
        const r = await Swal.fire({
            icon: 'question', title: 'New ward',
            html: '<div style="text-align:left;font-size:14px">Is <b>' + escapeHtml(w) + '</b> an inpatient or an outpatient unit?<div style="font-size:12px;color:#64748b;margin-top:6px">The choice is saved as the rule for this ward. Intensive care units are set separately.</div></div>',
            showDenyButton: true, showCancelButton: true, confirmButtonText: 'Inpatient', denyButtonText: 'Outpatient', cancelButtonText: 'Decide later', allowOutsideClick: false
        });
        if (r.isConfirmed) map[w.toLowerCase()] = 'inpatient'; else if (r.isDenied) map[w.toLowerCase()] = 'outpatient'; else continue;
        saveWardClassMap(map); changed = true;
    }
    return changed;
}
function manageWardClasses() {
    const map = getWardClassMap() || {};
    const rows = wardsInUse().map(w => {
        const c = map[w.toLowerCase()] || '';
        return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f1f5f9"><span style="font-size:13px;font-weight:600;color:#334155">' + escapeHtml(w) + '</span>'
            + '<select data-ward="' + escapeHtml(w) + '" style="border:1px solid #cbd5e1;border-radius:8px;padding:5px 8px;font-size:12px"><option value=""' + (c ? '' : ' selected') + '>Not set</option><option value="inpatient"' + (c === 'inpatient' ? ' selected' : '') + '>Inpatient</option><option value="outpatient"' + (c === 'outpatient' ? ' selected' : '') + '>Outpatient</option></select></div>';
    }).join('');
    Swal.fire({
        title: 'Ward classes', html: '<div style="text-align:left;max-height:55vh;overflow-y:auto">' + rows + '</div><div style="font-size:11px;color:#64748b;margin-top:8px;text-align:left">A ward that is not set is left out of the Non-ICU and Outpatient views and is listed in Data quality.</div>',
        showCancelButton: true, confirmButtonText: 'Save', preConfirm: () => {
            const m = {}; document.querySelectorAll('.swal2-html-container select[data-ward]').forEach(el => { if (el.value) m[el.dataset.ward.toLowerCase()] = el.value; });
            return m;
        }
    }).then(r => { if (r.isConfirmed) { saveWardClassMap(r.value); if (typeof syncLocalToCloud === 'function' && navigator.onLine) syncLocalToCloud(); } });
}

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

// Dashboard display settings are edited in the Dashboard Control window (same page as on the phone); this page publishes the newest copy with the data.
function restoreSyncStatus() {
    try {
        const st = JSON.parse(localStorage.getItem('amr_sync_status') || 'null');
        if (st) setSyncStatus(st.kind, st.text);
    } catch (e) {}
}
