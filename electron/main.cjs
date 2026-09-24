const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let mainWindow;

function setupAutoUpdater() {
  if (!app.isPackaged || process.platform !== 'win32') return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;

  autoUpdater.on('checking-for-update', () => console.log('[updater] checking for update'));
  autoUpdater.on('update-available', info => console.log('[updater] update available:', info.version));
  autoUpdater.on('download-progress', progress => console.log('[updater] download:', Math.round(progress.percent) + '%'));

  autoUpdater.on('update-downloaded', async info => {
    console.log('[updater] update downloaded:', info.version);
    if (!mainWindow || mainWindow.isDestroyed()) {
      autoUpdater.quitAndInstall(false, true);
      return;
    }
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update TokoKasirHerbal',
      message: 'Update versi ' + info.version + ' sudah siap dipasang.',
      detail: 'Aplikasi akan ditutup dan dibuka kembali untuk menyelesaikan update.',
      buttons: ['Update Sekarang', 'Nanti']
    });
    if (result.response === 0) autoUpdater.quitAndInstall(false, true);
  });

  autoUpdater.on('error', error => console.error('[updater] error:', error));
  setTimeout(() => autoUpdater.checkForUpdates().catch(error => console.error('[updater] check failed:', error)), 5000);
}

ipcMain.handle('list-printers', async () => {
  if (!mainWindow || mainWindow.isDestroyed()) return [];
  const printers = await mainWindow.webContents.getPrintersAsync();
  return printers.map(p => ({
    name: p.name,
    displayName: p.displayName || p.name,
    description: p.description || '',
    status: p.status,
    isDefault: !!p.isDefault
  }));
});

ipcMain.handle('print-receipt', async (_event, payload) => {
  const html = payload?.html;
  const printerName = payload?.printerName;
  if (typeof html !== 'string' || !html.trim()) throw new Error('Struk kosong.');
  if (!printerName) throw new Error('Printer belum dipilih.');

  const printWindow = new BrowserWindow({
    show: false,
    width: 420,
    height: 800,
    parent: mainWindow || undefined,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });

  try {
    await printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    await new Promise(resolve => setTimeout(resolve, 300));
    await new Promise((resolve, reject) => {
      printWindow.webContents.print({
        silent: true,
        deviceName: printerName,
        printBackground: true,
        margins: { marginType: 'none' }
      }, (success, reason) => {
        if (success) resolve();
        else reject(new Error(reason || 'Printer tidak dapat menerima pekerjaan cetak.'));
      });
    });
    return { ok: true, printerName };
  } finally {
    if (!printWindow.isDestroyed()) printWindow.close();
  }
});

ipcMain.handle('print-report', async (_event, payload) => {
  const html = typeof payload === 'string' ? payload : payload?.html;
  const requestedPrinter = typeof payload === 'object' ? payload?.printerName : '';
  if (typeof html !== 'string' || !html.trim()) throw new Error('Dokumen cetak kosong.');

  const printWindow = new BrowserWindow({
    show: false,
    width: 1000,
    height: 800,
    parent: mainWindow || undefined,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });

  try {
    await printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    await new Promise(resolve => setTimeout(resolve, 250));
    await new Promise((resolve, reject) => {
      printWindow.webContents.print({ silent: true, deviceName: requestedPrinter || undefined, printBackground: true, margins: { marginType: 'default' } }, (success, reason) => {
        if (success) resolve();
        else reject(new Error(reason || 'Gagal membuka dialog printer.'));
      });
    });
    return { ok: true };
  } finally {
    if (!printWindow.isDestroyed()) printWindow.close();
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'TokoKasirHerbal',
    backgroundColor: '#f6f8f7',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  const REMOTE_APP_URL = 'https://lussaldesign-code.github.io/TokoKasirHerbal/';
  mainWindow.loadURL(REMOTE_APP_URL).catch(error => {
    console.error('[web-shell] remote load failed:', error);
    mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
