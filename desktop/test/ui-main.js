const { app, BrowserWindow } = require('electron');
const fs = require('fs');
require('../main.js');
app.whenReady().then(() => setTimeout(async () => {
  const wc = BrowserWindow.getAllWindows()[0].webContents;
  const errs = []; wc.on('console-message', (e, l, m) => { if (l >= 3) errs.push(m); });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const shot = async n => fs.writeFileSync('/tmp/' + n + '.png', (await wc.capturePage()).toPNG());
  await sleep(3000);
  await wc.executeJavaScript(`document.getElementById('loginOverlay').classList.add('hidden');document.getElementById('mainAppContainer').classList.remove('hidden'); 0`);
  await sleep(700); await shot('u1');
  console.log('FUNCS', await wc.executeJavaScript(`JSON.stringify(['triggerDataExtractor','showImportHistory','openPatientLink','showBackupModal','showExportModal','showDashControl','showSettingsModal','publishNow','openModal'].map(f=>f+':'+typeof window[f]))`));
  console.log('SYNC', await wc.executeJavaScript(`!!document.querySelector('.dt-card .st #syncStatus')`));
  await wc.executeJavaScript(`showSettingsModal(); document.querySelector('#settingsModal .dt-sec').classList.remove('dt-collapsed'); 0`); await sleep(500); await shot('u2');
  console.log('SECS', await wc.executeJavaScript(`JSON.stringify([...document.querySelectorAll('#settingsModal .dt-sec')].map(s=>s.querySelector('h4').textContent+' | rows:'+(s.querySelector('#abbrTableBody')?1:0)))`));
  await wc.executeJavaScript(`closeSettingsModal(); openModal(); 0`); await sleep(900); await shot('u3');
  // discard confirm (trusted input via insertText)
  await wc.executeJavaScript(`document.getElementById('p_name').focus(); 0`); wc.insertText('x'); await sleep(300);
  console.log('DIRTYTEST', await wc.executeJavaScript(`(function(){document.querySelector('#formModal button[onclick="closeModal()"].px-6').click(); return !!document.querySelector('.swal2-popup') && document.getElementById('formModal').classList.contains('hidden')===false})()`));
  await sleep(300); await shot('u4');
  await wc.executeJavaScript(`document.querySelector('.swal2-confirm').click(); 0`); await sleep(500);
  console.log('CLOSED', await wc.executeJavaScript(`document.getElementById('formModal').classList.contains('hidden')`));
  await wc.executeJavaScript(`openModal(); 0`); await sleep(500);
  await wc.executeJavaScript(`document.querySelector('#formModal button[onclick="closeModal()"].px-6').click(); 0`); await sleep(300);
  console.log('CLEAN_CLOSE', await wc.executeJavaScript(`document.getElementById('formModal').classList.contains('hidden') && !document.querySelector('.swal2-popup')`));
  console.log('ERR', JSON.stringify(errs.slice(0,5)));
  app.quit();
}, 1500));
