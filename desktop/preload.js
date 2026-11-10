const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktopStore', {
  load: () => ipcRenderer.sendSync('store:load'),
  set: (k, v) => ipcRenderer.send('store:set', k, v),
  remove: k => ipcRenderer.send('store:remove', k),
  clear: () => ipcRenderer.send('store:clear')
});
contextBridge.exposeInMainWorld('desktopApp', {
  openDashboard: () => ipcRenderer.send('dashboard:open')
});
