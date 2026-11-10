const { app, BrowserWindow } = require('electron');
require('../main.js');
app.whenReady().then(() => setTimeout(async () => {
  const main = BrowserWindow.getAllWindows()[0];
  await new Promise(r => setTimeout(r, 2500));
  await main.webContents.executeJavaScript(`desktopApp.openDashboard()`);
  await new Promise(r => setTimeout(r, 3500));
  const w = BrowserWindow.getAllWindows().find(x => x.getTitle() === 'AMR Trak Dashboard');
  console.log('PHONE', !!w, w && w.getContentSize().join('x'), w && w.contentView.children.length);
  require('fs').writeFileSync('/tmp/phone.png', (await w.webContents.capturePage()).toPNG());
  app.quit();
}, 1500));
