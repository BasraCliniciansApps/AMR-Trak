const { app, BrowserWindow } = require('electron');
const fs = require('fs');
require('../main.js');
app.whenReady().then(() => setTimeout(async () => {
  const wc = BrowserWindow.getAllWindows()[0].webContents;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  await sleep(3000);
  await wc.executeJavaScript(`document.getElementById('loginOverlay').classList.add('hidden');document.getElementById('mainAppContainer').classList.remove('hidden'); showSettingsModal(); 0`);
  await sleep(800);
  fs.writeFileSync('/tmp/set1.png', (await wc.capturePage()).toPNG());
  const info = await wc.executeJavaScript(`JSON.stringify([...document.querySelectorAll('#settingsModal button, #settingsModal h2, #settingsModal h3, #settingsModal summary, #settingsModal label')].map(e=>e.tagName+': '+e.textContent.trim().replace(/\\s+/g,' ').slice(0,60)).filter(t=>t.length>6))`);
  console.log('SET', info);
  // scroll to see more
  await wc.executeJavaScript(`(function(){var m=document.querySelector('#settingsModal .overflow-y-auto, #settingsModal [class*=overflow]'); if(m) m.scrollTop=700; return 0})()`);
  await sleep(400);
  fs.writeFileSync('/tmp/set2.png', (await wc.capturePage()).toPNG());
  await wc.executeJavaScript(`closeSettingsModal && closeSettingsModal(); openModal(); 0`);
  await sleep(800);
  fs.writeFileSync('/tmp/add1.png', (await wc.capturePage()).toPNG());
  app.quit();
}, 1500));
