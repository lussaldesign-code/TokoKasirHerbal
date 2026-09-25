const { contextBridge, ipcRenderer } = require('electron');

function receiptPrinterName() {
  try {
    const saved = window.localStorage?.getItem('tokokasirlussal-printer');
    if (saved) return saved;
  } catch (_) {}
  try {
    return ipcRenderer.sendSync('get-receipt-printer-name') || '';
  } catch (_) {
    return '';
  }
}

contextBridge.exposeInMainWorld('electronUpdater', {
  available: true,
  download: (url) => ipcRenderer.invoke('download-update', url),
  onProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('update-download-progress', handler);
    return () => ipcRenderer.removeListener('update-download-progress', handler);
  }
});

contextBridge.exposeInMainWorld('receiptPrinterName', receiptPrinterName);
contextBridge.exposeInMainWorld('refreshReceiptPrinters', async () => {
  try {
    return await ipcRenderer.invoke('list-printers');
  } catch (_) {
    return [];
  }
});

contextBridge.exposeInMainWorld('electronPrinter', {
  available: true,
  listPrinters: () => ipcRenderer.invoke('list-printers'),
  printReport: (html, printerName) => ipcRenderer.invoke('print-report', { html, printerName }),
  printReceipt: (html, printerName) => ipcRenderer.invoke('print-receipt', { html, printerName })
});
