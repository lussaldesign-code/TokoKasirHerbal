const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
// Windows rollback baseline: v1.0.17 remote web shell.
const path = require('path');
const { autoUpdater } = require('electron-updater');

let mainWindow;

function setupAutoUpdater() {
  if (!app.isPackaged || process.platform !== 'win32') return;

  autoUpdater.autoDownload = true;
  // Instalasi update hanya dilakukan melalui alur yang kita kontrol agar tidak terjadi dua proses installer bersamaan.
  autoUpdater.autoInstallOnAppQuit = false;
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
    if (result.response === 0) {
      // Jalankan installer setelah proses Electron benar-benar ditutup.
      autoUpdater.quitAndInstall(true, true);
    }
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

  // Kembali ke jalur pemuatan software yang stabil.
  // Jangan memaksa app.js versi berbeda dari halaman yang dimuat; ini mencegah
  // ketidakcocokan HTML/CSS/JavaScript pada jendela Windows.
  const REMOTE_APP_URL = 'https://lussaldesign-code.github.io/TokoKasirHerbal/';
  mainWindow.webContents.on('did-finish-load', () => {
    // Override only inside the Windows Electron renderer; web/APK source remains unchanged.
    mainWindow.webContents.executeJavaScript(`
      (function () {
        function isAgarillusProduct(p) {
          return String(p && p.kategori || '').trim().toLocaleLowerCase('id-ID').includes('agarillus');
        }
        window.stockNoticeFor = function (p) {
          var stock = Number(p && p.stok || 0);
          if (isAgarillusProduct(p)) return stock < 10 ? (stock <= 0 ? 'out' : 'low') : 'ok';
          return stock <= 0 ? 'out' : 'ok';
        };
        window.stockNoticeText = function (p) {
          var stock = Number(p && p.stok || 0);
          return stock <= 0 ? 'Produk ' + (p && p.nama || '') + ' habis' : 'Produk ' + (p && p.nama || '') + ' stok ' + stock;
        };
        window.renderNotifications = function () {
          var list = document.getElementById('notificationList');
          var badge = document.getElementById('notificationBadge');
          var count = document.getElementById('notificationCount');
          if (!list || !Array.isArray(window.products)) return;
          var alerts = window.products.filter(function (p) {
            var stock = Number(p && p.stok || 0);
            return isAgarillusProduct(p) ? stock < 10 : stock <= 0;
          }).sort(function (a, b) { return Number(a.stok || 0) - Number(b.stok || 0); });
          if (badge) {
            badge.textContent = alerts.length > 99 ? '99+' : String(alerts.length);
            badge.classList.toggle('show', alerts.length > 0);
          }
          if (count) count.textContent = String(alerts.length);
          list.innerHTML = alerts.map(function (p) {
            var out = Number(p.stok || 0) <= 0;
            var message = window.stockNoticeText(p);
            var safe = typeof window.esc === 'function' ? window.esc(message) : message.replace(/[&<>"]/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]; });
            return '<div class="notify-item ' + (out ? 'danger' : 'warn') + '"><span>' + (out ? '🔴' : '🟠') + '</span><b>' + safe + '</b></div>';
          }).join('') || '<div class="notify-empty">Stok aman</div>';
          var next = {};
          window.products.forEach(function (p) { next[p.id] = window.stockNoticeFor(p); });
          var previous = window.stockNotificationState || {};
          var changed = null;
          for (var i = 0; i < window.products.length; i++) {
            var p = window.products[i];
            var before = previous[p.id] || 'ok';
            var now = next[p.id];
            if ((now === 'out' || now === 'low') && before === 'ok') { changed = p; break; }
          }
          window.stockNotificationState = next;
          try { localStorage.setItem('tokokasir_stock_notice_state', JSON.stringify(next)); } catch (_) {}
          if (changed && typeof window.showStockToast === 'function') {
            window.showStockToast(window.stockNoticeText(changed), Number(changed.stok || 0) <= 0 ? 'danger' : 'warn');
          }
        };
        if (typeof window.renderNotifications === 'function') window.renderNotifications();
      })();
    `).catch(error => console.error('[windows-notifications] failed to apply category rules:', error));
  });

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
