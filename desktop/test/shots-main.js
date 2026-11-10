const { app, BrowserWindow } = require('electron');
require('../main.js');
app.whenReady().then(() => setTimeout(async () => {
  const wc = BrowserWindow.getAllWindows()[0].webContents;
  await new Promise(r => setTimeout(r, 3000));
  await wc.executeJavaScript(`document.getElementById('loginOverlay').classList.add('hidden');document.getElementById('mainAppContainer').classList.remove('hidden');`);
  await new Promise(r => setTimeout(r, 800));
  console.log('CHK', await wc.executeJavaScript(`JSON.stringify({aside:getComputedStyle(document.querySelector('aside')).display, exportInHeader:!!document.querySelector('#mainAppContainer header button[onclick*=showExportModal]'), dashBtn:!!document.getElementById('dtDashBtn'), font:getComputedStyle(document.getElementById('dtBrand').querySelector('.dt-name')).fontFamily.slice(0,20), fontsOk:document.fonts.check('700 20px "Space Grotesk"')})`));
  require('fs').writeFileSync('/tmp/s2.png', (await wc.capturePage()).toPNG());
  await wc.executeJavaScript(`document.getElementById('dtDashBtn').click()`);
  await new Promise(r => setTimeout(r, 4000));
  const w = BrowserWindow.getAllWindows().find(x => x.getTitle() === 'AMR Trak Dashboard');
  console.log('DASHWIN', !!w, w && w.getContentSize().join('x'), w && w.webContents.getURL());
  if (w) require('fs').writeFileSync('/tmp/s3.png', (await w.webContents.capturePage()).toPNG());
  app.quit();
}, 1500));
