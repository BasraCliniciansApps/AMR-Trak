const { app, BrowserWindow, WebContentsView, protocol, net, ipcMain, shell, Menu } = require('electron');
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
  // phone-shaped frameless window: the bezel is drawn by phone-frame.html, the real dashboard
  // runs in a child view (top-level page with its own persistent profile => SW + cache work offline)
  const W = 482, H = 880, SX = 28, SY = 40, SW = 390, SH = 800;
  dashWin = new BrowserWindow({
    width: W, height: H, useContentSize: true, frame: false, transparent: true, hasShadow: false,
    resizable: false, maximizable: false, fullscreenable: false, backgroundColor: '#00000000',
    title: 'AMR Trak Dashboard', icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  dashWin.setMenuBarVisibility(false);
  dashWin.loadURL('app://local/phone-frame.html');
  const view = new WebContentsView({ webPreferences: { partition: 'persist:dashboard', contextIsolation: true, nodeIntegration: false } });
  dashWin.contentView.addChildView(view);
  view.setBounds({ x: SX, y: SY, width: SW, height: SH });
  try { view.setBorderRadius(34); } catch (e) { /* older Electron */ }
  const wc = view.webContents;
  wc.on('dom-ready', () => {   // desktop already is the "installed" app: skip the install prompt
    wc.executeJavaScript("try{localStorage.setItem('amr_dashboard_install_prompted','true')}catch(e){}").catch(() => {});
  });
  wc.on('did-navigate', (e, url, code) => {          // 404 / server error page -> friendly message
    if (/^https?:/.test(url) && code >= 400) wc.loadURL('app://local/dashboard-offline.html');
  });
  wc.on('did-fail-load', (e, code, desc, url, isMain) => {
    if (isMain && code !== -3) wc.loadURL('app://local/dashboard-offline.html');
  });
  wc.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  wc.loadURL(DASHBOARD_URL);
  dashWin.on('closed', () => { try { wc.close(); } catch (e) {} dashWin = null; });
}
ipcMain.on('phone:close', () => { if (dashWin && !dashWin.isDestroyed()) dashWin.close(); });
ipcMain.on('phone:minimize', () => { if (dashWin && !dashWin.isDestroyed()) dashWin.minimize(); });
ipcMain.on('dashboard:open', openDashboard);

function createWindow() {
  const win = new BrowserWindow({
    width: 1366, height: 860, show: false, autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, nodeIntegrationInSubFrames: true }
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
