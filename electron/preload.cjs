const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronUpdater', {
  available: true
});

contextBridge.exposeInMainWorld('electronPrinter', {
  available: true,
  listPrinters: () => ipcRenderer.invoke('list-printers'),
  printReport: html => ipcRenderer.invoke('print-report', html),
  printReceipt: (html, printerName) => ipcRenderer.invoke('print-receipt', { html, printerName })
});
