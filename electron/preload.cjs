const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronUpdater', {
  available: true
});

contextBridge.exposeInMainWorld('electronPrinter', {
  available: true,
  printReport: html => ipcRenderer.invoke('print-report', html)
});
