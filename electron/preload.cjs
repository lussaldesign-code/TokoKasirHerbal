const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronUpdater', {
  available: true
});

contextBridge.exposeInMainWorld('electronPrinter', {
  available: true,
  listPrinters: () => ipcRenderer.invoke('list-printers'),
  printReport: (html, printerName) => ipcRenderer.invoke('print-report', { html, printerName }),
  printReceipt: (html, printerName) => ipcRenderer.invoke('print-receipt', { html, printerName })
});
