const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const { execFileSync } = require('child_process');

let mainWindow;

ipcMain.handle('download-update', async (event, url) => {
  if (typeof url !== 'string' || !/^https:\/\//i.test(url)) throw new Error('URL update tidak valid.');
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  if (!senderWindow) throw new Error('Jendela aplikasi tidak tersedia.');
  return await new Promise((resolve, reject) => {
    let settled = false;
    const fail = (err) => { if (!settled) { settled = true; reject(err instanceof Error ? err : new Error(String(err))); } };
    senderWindow.webContents.session.once('will-download', (_event, item) => {
      const downloadsPath = app.getPath('downloads');
      const safeName = String(item.getFilename() || 'TokoKasirLussal-update.exe').replace(/[\\/:*?"<>|]/g, '_');
      const target = path.join(downloadsPath, safeName);
      item.setSavePath(target);
      item.on('updated', (_event, state) => {
        if (state === 'interrupted') return fail(new Error('Download terputus.'));
        const total = item.getTotalBytes();
        const received = item.getReceivedBytes();
        const percent = total > 0 ? (received / total) * 100 : 0;
        event.sender.send('update-download-progress', { percent, received, total, filename: safeName });
      });
      item.once('done', (_event, state) => {
        if (state !== 'completed') return fail(new Error('Download gagal: '+state));
        settled = true;
        resolve({ok:true,path:target,filename:safeName});
      });
    });
    try { senderWindow.webContents.downloadURL(url); }
    catch (e) { fail(e); }
  });
});

ipcMain.on('get-receipt-printer-name', (event) => {
  try {
    const script = "@(Get-CimInstance Win32_Printer | Select-Object Name,Default) | ConvertTo-Json -Compress";
    const raw = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 4000
    }).trim();
    if (!raw) {
      event.returnValue = '';
      return;
    }

    const parsed = JSON.parse(raw);
    const printers = Array.isArray(parsed) ? parsed : [parsed];
    const panda = printers.find(p => /panda/i.test(String(p?.Name || '')));
    const defaultPrinter = printers.find(p => p?.Default === true || String(p?.Default).toLowerCase() === 'true');
    const selected = panda || defaultPrinter || printers[0];
    event.returnValue = String(selected?.Name || '');
  } catch (error) {
    console.error('[printer] failed to detect Windows printer:', error);
    event.returnValue = '';
  }
});

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
    title: 'TokoKasirLussal',
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
  // Prefer the bundled app so the Windows POS keeps working even when GitHub Pages is unavailable.
  mainWindow.loadFile(path.join(__dirname, '..', 'index.html')).catch(error => {
    console.error('[web-shell] local load failed:', error);
    mainWindow.loadURL(REMOTE_APP_URL).catch(remoteError => console.error('[web-shell] remote load failed:', remoteError));
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
  // Windows tidak melakukan update otomatis. Update hanya diunduh saat pengguna memilihnya dari menu Cek Update.

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
