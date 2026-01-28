const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  dbRun: (sql, params = []) => ipcRenderer.invoke('db:run', sql, params),
  dbGet: (sql, params = []) => ipcRenderer.invoke('db:get', sql, params),
  dbAll: (sql, params = []) => ipcRenderer.invoke('db:all', sql, params),
  getDataPath: () => ipcRenderer.invoke('app:getDataPath'),
});
