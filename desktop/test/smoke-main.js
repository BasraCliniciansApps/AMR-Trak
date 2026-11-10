// Headless smoke test: loads the real app, checks libs, offline storage, takes a screenshot.
const { app, BrowserWindow, session } = require('electron');
require('../main.js');
app.whenReady().then(async () => {
  await session.defaultSession.enableNetworkEmulation({ offline: true });   // simulate no internet
  setTimeout(async () => {
    const win = BrowserWindow.getAllWindows()[0];
    const wc = win.webContents;
    const errors = [];
    wc.on('console-message', (e, lvl, msg) => { if (lvl >= 2) errors.push(msg); });
    await new Promise(r => setTimeout(r, 4000));
    const res = await wc.executeJavaScript(`(async()=>{
      localStorage.setItem('smoke_key', JSON.stringify({a:1}));
      const dict = await fetch('organisms_dictionary.json').then(r=>r.ok);
      const xl = await fetch('Antibiogram_5.xlsx').then(r=>r.ok);
      return {jq: typeof $, dt: typeof $.fn.DataTable, s2: typeof $.fn.select2, xlsx: typeof XLSX, chart: typeof Chart,
        swal: typeof Swal, fb: typeof firebase, saveAs: typeof saveAs, xp: typeof XlsxPopulate, dict, xl,
        loginVisible: !document.getElementById('loginOverlay').classList.contains('hidden'),
        twApplied: getComputedStyle(document.body).fontFamily.slice(0,40), title: document.title};
    })()`);
    console.log('RESULT', JSON.stringify(res));
    console.log('ERRORS', JSON.stringify(errors.slice(0, 10)));
    const img = await wc.capturePage();
    require('fs').writeFileSync('/tmp/amr-smoke.png', img.toPNG());
    await new Promise(r => setTimeout(r, 1200));   // let debounced save flush
    app.quit();
  }, 1500);
});
