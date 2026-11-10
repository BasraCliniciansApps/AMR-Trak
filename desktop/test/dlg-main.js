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
  const steps = [
    ['d1', 'showBackupModal()'],
    ['d2', "Swal.fire({title:'Are you sure?',text:'This cannot be undone.',icon:'warning',showCancelButton:true,confirmButtonText:'Yes, delete',confirmButtonColor:'#e11d48'})"],
    ['d3', "Swal.fire('Saved!','Record saved.','success')"],
    ['d4', 'showExportModal()'],
    ['d5', 'showImportHistory()'],
    ['d6', "Swal.fire('Required','Please select a month.','warning')"],
    ['d7', 'showDashControl()'],
    ['d8', 'showSettingsModal()'],
  ];
  for (const [n, code] of steps) {
    await wc.executeJavaScript(`try{Swal.close()}catch(e){}; try{closeDashControl()}catch(e){}; try{closeSettingsModal()}catch(e){}; 0`);
    await sleep(300);
    await wc.executeJavaScript(`(function(){ ${code}; })(); 0`); await sleep(900); await shot(n);
  }
  console.log('ERR', JSON.stringify(errs.slice(0,5)));
  app.quit();
}, 1500));
