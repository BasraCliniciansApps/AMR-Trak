const { app, BrowserWindow, protocol, net, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
]);

const APP_DIR = path.join(__dirname, 'app');
let DATA_DIR, DATA_FILE, BACKUP_DIR;
let cache = null;           // in-memory copy of all stored keys
let writeTimer = null;

function initPaths() {
  DATA_DIR = path.join(app.getPath('documents'), 'AMR Trak');
  DATA_FILE = path.join(DATA_DIR, 'amr-data.json');
  BACKUP_DIR = path.join(DATA_DIR, 'Backups');
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function loadData() {
  if (cache) return cache;
  for (const f of [DATA_FILE, DATA_FILE + '.bak']) {
    try { cache = JSON.parse(fs.readFileSync(f, 'utf8')); return cache; } catch (e) { /* try next */ }
  }
  cache = {};
  return cache;
}

function flushNow() {
  if (!cache) return;
  clearTimeout(writeTimer); writeTimer = null;
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cache));
  if (fs.existsSync(DATA_FILE)) fs.copyFileSync(DATA_FILE, DATA_FILE + '.bak');
  fs.renameSync(tmp, DATA_FILE);
}

function scheduleWrite() {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => { try { flushNow(); } catch (e) { console.error('save failed', e); } }, 400);
}

// one dated backup per day (keeps the last 30)
function dailyBackup() {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const d = new Date(), pad = n => String(n).padStart(2, '0');
    const name = `amr-data_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
    const dest = path.join(BACKUP_DIR, name);
    if (!fs.existsSync(dest)) fs.copyFileSync(DATA_FILE, dest);
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('amr-data_')).sort();
    files.slice(0, Math.max(0, files.length - 30)).forEach(f => fs.unlinkSync(path.join(BACKUP_DIR, f)));
  } catch (e) { console.error('backup failed', e); }
}

ipcMain.on('store:load', e => { e.returnValue = loadData(); });
ipcMain.on('store:set', (e, k, v) => { loadData()[k] = v; scheduleWrite(); });
ipcMain.on('store:remove', (e, k) => { delete loadData()[k]; scheduleWrite(); });
ipcMain.on('store:clear', () => { cache = {}; scheduleWrite(); });

const DASHBOARD_URL = 'https://basracliniciansapps.github.io/AMR-Trak/dashboard';
let dashWin = null;
// Phone-sized window showing the REAL dashboard (top-level page, own persistent profile) so its
// service worker + cached data work offline exactly like the installed phone app, and it
// always follows whatever is published for the dashboard.
function openDashboard() {
  if (dashWin && !dashWin.isDestroyed()) { dashWin.focus(); return; }
  dashWin = new BrowserWindow({
    useContentSize: true, width: 400, height: 860, resizable: false, maximizable: false, fullscreenable: false,
    autoHideMenuBar: true, title: 'AMR Trak Dashboard', backgroundColor: '#ffffff',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { partition: 'persist:dashboard', contextIsolation: true, nodeIntegration: false }
  });
  dashWin.setMenuBarVisibility(false);
  const wc = dashWin.webContents;
  wc.on('dom-ready', () => {   // desktop already is the "installed" app: skip the install prompt
    wc.executeJavaScript("try{localStorage.setItem('amr_dashboard_install_prompted','true')}catch(e){}").catch(() => {});
  });
  wc.on('did-navigate', (e, url, code) => {          // 404 / server error page -> friendly message
    if (/^https?:/.test(url) && code >= 400) dashWin.loadURL('app://local/dashboard-offline.html');
  });
  wc.on('did-fail-load', (e, code, desc, url, isMain) => {
    if (isMain && code !== -3) dashWin.loadURL('app://local/dashboard-offline.html');
  });
  wc.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  dashWin.loadURL(DASHBOARD_URL);
}
ipcMain.on('dashboard:open', openDashboard);

function createWindow() {
  const win = new BrowserWindow({
    width: 1366, height: 860, show: false, autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  win.maximize();
  win.once('ready-to-show', () => win.show());
  win.loadURL('app://local/index.html');
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

function buildMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'File', submenu: [
      { label: 'Open data folder', click: () => shell.openPath(DATA_DIR) },
      { label: 'Open backups folder', click: () => shell.openPath(BACKUP_DIR) },
      { type: 'separator' }, { role: 'quit' } ] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'togglefullscreen' }] }
  ]));
}

if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.on('second-instance', () => {
    const w = BrowserWindow.getAllWindows()[0];
    if (w) { if (w.isMinimized()) w.restore(); w.focus(); }
  });
  app.whenReady().then(() => {
    initPaths(); loadData(); dailyBackup(); buildMenu();
    protocol.handle('app', req => {
      const u = new URL(req.url);
      const rel = decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'index.html';
      const file = path.normalize(path.join(APP_DIR, rel));
      if (!file.startsWith(APP_DIR + path.sep)) return new Response('Forbidden', { status: 403 });
      return net.fetch(pathToFileURL(file).toString());
    });
    createWindow();
    if (app.isPackaged) {
      try {
        const { autoUpdater } = require('electron-updater');
        autoUpdater.on('error', () => {});            // offline / no release yet: stay silent
        autoUpdater.checkForUpdatesAndNotify().catch(() => {});
      } catch (e) { /* ignore */ }
    }
  });
  app.on('before-quit', () => { try { flushNow(); } catch (e) {} });
  app.on('window-all-closed', () => app.quit());
}
