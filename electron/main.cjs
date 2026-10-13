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
          if (!list || typeof products === 'undefined' || !Array.isArray(products)) return;
          var alerts = products.filter(function (p) {
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
          products.forEach(function (p) { next[p.id] = window.stockNoticeFor(p); });
          var previous = typeof stockNotificationState !== 'undefined' ? stockNotificationState : {};
          var changed = null;
          for (var i = 0; i < products.length; i++) {
            var p = products[i];
            var before = previous[p.id] || 'ok';
            var now = next[p.id];
            if ((now === 'out' || now === 'low') && before === 'ok') { changed = p; break; }
          }
          stockNotificationState = next;
          try { localStorage.setItem('tokokasir_stock_notice_state', JSON.stringify(next)); } catch (_) {}
          if (changed && typeof window.showStockToast === 'function') {
            window.showStockToast(window.stockNoticeText(changed), Number(changed.stok || 0) <= 0 ? 'danger' : 'warn');
          }
        };
        if (typeof window.renderNotifications === 'function') window.renderNotifications();
      })();
    `).catch(error => console.error('[windows-notifications] failed to apply category rules:', error));
  });

  // Windows-only report print picker. Keeps web and APK files untouched.
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      (function () {
        if (window.__windowsReportPrintPickerInstalled) return;
        window.__windowsReportPrintPickerInstalled = true;
        var escPrint = function (value) {
          return String(value == null ? '' : value).replace(/[&<>"]/g, function (c) {
            return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c];
          });
        };
        var moneyPrint = function (value) {
          return 'Rp ' + Number(value || 0).toLocaleString('id-ID');
        };
        var datePrint = function (value) {
          if (!value) return '-';
          var d = new Date(value);
          return isNaN(d.getTime()) ? escPrint(value) : d.toLocaleDateString('id-ID');
        };
        var makeTable = function (headers, rows) {
          return '<table><thead><tr>' + headers.map(function (h) { return '<th>' + escPrint(h) + '</th>'; }).join('') +
            '</tr></thead><tbody>' + (rows.length ? rows.map(function (row) {
              return '<tr>' + row.map(function (cell) { return '<td>' + cell + '</td>'; }).join('') + '</tr>';
            }).join('') : '<tr><td colspan="' + headers.length + '">Tidak ada data.</td></tr>') + '</tbody></table>';
        };
        var documentHtml = function (title, subtitle, table, totalLabel) {
          var now = new Date().toLocaleString('id-ID');
          return '<!doctype html><html><head><meta charset="utf-8"><title>' + escPrint(title) + '</title><style>' +
            'body{font-family:Arial,sans-serif;color:#17211b;margin:20px;font-size:11px}h1{font-size:20px;margin:0 0 5px}p{margin:4px 0 14px;color:#526157}' +
            'table{width:100%;border-collapse:collapse}th,td{border:1px solid #cbd5ce;padding:6px;text-align:left;vertical-align:top}th{background:#eaf1ec}' +
            '.num{text-align:right;white-space:nowrap}.foot{margin-top:14px;font-size:10px;color:#66736b}@media print{body{margin:8mm}}</style></head><body>' +
            '<h1>' + escPrint(title) + '</h1><p>' + escPrint(subtitle) + '<br>Dicetak: ' + escPrint(now) + '</p>' +
            table + (totalLabel ? '<p><b>' + escPrint(totalLabel) + '</b></p>' : '') +
            '<div class="foot">TokoKasirHerbal • Laporan internal</div></body></html>';
        };
        var printChosenReport = async function (kind) {
          if (typeof products === 'undefined' || !Array.isArray(products)) {
            if (typeof toast === 'function') toast('Data produk belum selesai dimuat.');
            return;
          }
          var html = '';
          if (kind === 'outstock' || kind === 'allproducts') {
            var rowsProducts = products.filter(function (p) {
              return kind === 'allproducts' || Number(p.stok || 0) <= 0;
            }).sort(function (a,b) { return String(a.nama || '').localeCompare(String(b.nama || ''), 'id'); })
              .map(function (p, i) {
                return [
                  String(i + 1),
                  escPrint(p.nama || '-'),
                  escPrint(p.kategori || '-'),
                  escPrint(p.kode_produk || p.kode || p.barcode || '-'),
                  escPrint(p.stok == null ? 0 : p.stok),
                  moneyPrint(p.harga_ecer),
                  moneyPrint(p.harga_reseller),
                  moneyPrint(p.harga_agen),
                  moneyPrint(p.harga_grosir),
                  escPrint(p.satuan || '-')
                ];
              });
            var title = kind === 'outstock' ? 'LAPORAN PRODUK STOK HABIS' : 'LAPORAN LENGKAP SEMUA PRODUK';
            html = documentHtml(title, 'Jumlah produk: ' + rowsProducts.length,
              makeTable(['No','Nama Produk','Kategori','Kode/Barcode','Stok','Harga Ecer','Harga Reseller','Harga Agen','Harga Grosir','Satuan'], rowsProducts));
          } else if (kind === 'receivables') {
            var debts = (typeof receivables !== 'undefined' && Array.isArray(receivables) ? receivables : [])
              .filter(function (r) { return Number(r.sisa || 0) > 0; })
              .sort(function (a,b) { return Number(b.sisa || 0) - Number(a.sisa || 0); });
            var rowsDebts = debts.map(function (r, i) {
              return [String(i+1), escPrint(r.sales && r.sales.nomor_transaksi || '-'),
                escPrint(r.agents && r.agents.nama || '-'), datePrint(r.created_at),
                moneyPrint(r.total), moneyPrint(r.dibayar), moneyPrint(r.sisa)];
            });
            var totalDebt = debts.reduce(function (sum, r) { return sum + Number(r.sisa || 0); }, 0);
            html = documentHtml('LAPORAN PIUTANG BELUM LUNAS', 'Jumlah piutang aktif: ' + debts.length,
              makeTable(['No','No. Transaksi','Nama Agen/Pelanggan','Tanggal','Total','Dibayar','Sisa Piutang'], rowsDebts),
              'Total sisa piutang: ' + moneyPrint(totalDebt));
          } else {
            if (typeof window.buildPrintReportHtml === 'function') html = window.buildPrintReportHtml();
            else { if (typeof toast === 'function') toast('Laporan penjualan belum tersedia.'); return; }
          }
          var printerName = '';
          try { printerName = typeof window.receiptPrinterName === 'function' ? (window.receiptPrinterName() || '') : ''; } catch (_) {}
          var picker = document.getElementById('windowsReportPrintPicker');
          if (picker) picker.remove();
          try {
            if (window.electronPrinter && window.electronPrinter.available) {
              await window.electronPrinter.printReport(html, printerName);
              if (typeof toast === 'function') toast('Dokumen dikirim ke printer ' + (printerName || 'default Windows') + '.');
            } else if (window.IS_ELECTRON) {
              if (typeof toast === 'function') toast('Fitur cetak Windows belum tersedia. Perbarui software.');
            } else {
              var win = window.open('', '_blank', 'width=1000,height=800');
              if (!win) { if (typeof toast === 'function') toast('Izinkan pop-up untuk mencetak.'); return; }
              win.document.open(); win.document.write(html.replace('</body>', '<script>window.onload=()=>setTimeout(()=>window.print(),150)<\\/script></body>')); win.document.close();
            }
          } catch (error) {
            console.error('[windows-report-print]', error);
            if (typeof toast === 'function') toast('Gagal mencetak: ' + (error && error.message || 'periksa printer'));
          }
        };
        window.printReport = function () {
          var existing = document.getElementById('windowsReportPrintPicker');
          if (existing) existing.remove();
          var overlay = document.createElement('div');
          overlay.id = 'windowsReportPrintPicker';
          overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(12,24,17,.62);display:flex;align-items:center;justify-content:center;padding:18px;';
          overlay.innerHTML = '<div role="dialog" aria-modal="true" style="background:#fff;color:#1b2b21;width:min(520px,100%);border-radius:16px;padding:24px;box-shadow:0 20px 70px #0005;font:14px Arial,sans-serif">' +
            '<h2 style="margin:0 0 8px;font-size:21px">Pilih Data yang Dicetak</h2><p style="margin:0 0 18px;color:#647268">Pilih jenis laporan yang ingin dicetak dari software Windows.</p>' +
            '<div style="display:grid;gap:10px">' +
            '<button data-print-kind="allproducts" style="padding:13px;text-align:left;border:1px solid #d6e1d9;border-radius:10px;background:#f5faf6;font-weight:700;cursor:pointer">📦 Semua Data Produk <small style="display:block;font-weight:400;margin-top:4px">Nama, kategori, kode/barcode, stok, dan empat jenis harga</small></button>' +
            '<button data-print-kind="outstock" style="padding:13px;text-align:left;border:1px solid #f0d5d5;border-radius:10px;background:#fff7f7;font-weight:700;cursor:pointer">🔴 Data Stok Habis <small style="display:block;font-weight:400;margin-top:4px">Hanya produk dengan stok nol atau kurang</small></button>' +
            '<button data-print-kind="receivables" style="padding:13px;text-align:left;border:1px solid #f0dfb9;border-radius:10px;background:#fffbf2;font-weight:700;cursor:pointer">💰 Data Piutang <small style="display:block;font-weight:400;margin-top:4px">Transaksi, pelanggan/agen, total, dibayar, dan sisa piutang</small></button>' +
            '<button data-print-kind="sales" style="padding:11px;border:1px solid #d6e1d9;border-radius:10px;background:#fff;cursor:pointer">🧾 Laporan Penjualan (seperti sebelumnya)</button>' +
            '</div><button data-print-cancel style="margin-top:14px;width:100%;padding:10px;border:0;border-radius:9px;background:#edf1ee;cursor:pointer">Batal</button></div>';
          overlay.addEventListener('click', function (event) {
            if (event.target === overlay || event.target.closest('[data-print-cancel]')) { overlay.remove(); return; }
            var button = event.target.closest('[data-print-kind]');
            if (button) printChosenReport(button.getAttribute('data-print-kind'));
          });
          document.body.appendChild(overlay);
        };
      })();
    `).catch(error => console.error('[windows-report-print] failed to install:', error));
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
