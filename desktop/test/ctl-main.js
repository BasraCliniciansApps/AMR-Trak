const { app, BrowserWindow } = require('electron');
const fs = require('fs');
require('../main.js');
app.whenReady().then(() => setTimeout(async () => {
  const wc = BrowserWindow.getAllWindows()[0].webContents;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  await sleep(3000);
  await wc.executeJavaScript(`document.getElementById('loginOverlay').classList.add('hidden');document.getElementById('mainAppContainer').classList.remove('hidden'); dtShowHome(); showDashControl(); 0`);
  await sleep(4000);
  const fr = wc.mainFrame.frames.find(f => /control\.html/.test(f.url));
  console.log('FRAME', !!fr, fr && fr.url);
  if (fr) console.log('BODY', await fr.executeJavaScript(`JSON.stringify({len: document.body.innerText.length, text: document.body.innerText.slice(0,150), store: typeof window.desktopStore})`));
  fs.writeFileSync('/tmp/ctl.png', (await wc.capturePage()).toPNG());
  app.quit();
}, 1500));
