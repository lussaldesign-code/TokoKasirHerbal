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

  // Windows-only report printing. Uses the same native Electron print bridge as the working sales report.
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(\`
      (function () {
        if (window.__windowsReportPrintPickerInstalled) return;
        window.__windowsReportPrintPickerInstalled = true;
        var escP = function (v) {
          return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) {
            return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c];
          });
        };
        var moneyP = function (v) { return 'Rp ' + Number(v || 0).toLocaleString('id-ID'); };
        var dateObjP = function (v) { var d = v ? new Date(v) : null; return d && !isNaN(d.getTime()) ? d : null; };
        var dateP = function (v) { var d = dateObjP(v); return d ? d.toLocaleDateString('id-ID') : '-'; };
        var localKeyP = function (v) {
          var d = dateObjP(v); if (!d) return '';
          return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
        };
        var tableP = function (headers, rows) {
          return '<table><thead><tr>' + headers.map(function (h) { return '<th>' + escP(h) + '</th>'; }).join('') +
            '</tr></thead><tbody>' + (rows.length ? rows.map(function (row) {
              return '<tr>' + row.map(function (v) { return '<td>' + (v == null ? '' : v) + '</td>'; }).join('') + '</tr>';
            }).join('') : '<tr><td colspan="' + headers.length + '">Tidak ada data untuk pilihan ini.</td></tr>') + '</tbody></table>';
        };
        var htmlP = function (title, note, table, summary) {
          return '<!doctype html><html><head><meta charset="utf-8"><title>' + escP(title) + '</title><style>' +
            'body{font:12px Arial,sans-serif;color:#17211b;margin:20px}h1{font-size:21px;margin:0 0 6px}p{color:#526157;margin:5px 0 14px}' +
            'table{width:100%;border-collapse:collapse}th,td{border:1px solid #cbd5ce;padding:6px;text-align:left;vertical-align:top}th{background:#eaf1ec} .right{text-align:right}' +
            '@media print{body{margin:8mm}thead{display:table-header-group}tr{break-inside:avoid}}' +
            '</style></head><body><h1>' + escP(title) + '</h1><p>' + escP(note) + '<br>Dicetak: ' + escP(new Date().toLocaleString('id-ID')) + '</p>' +
            table + (summary ? '<p><b>' + escP(summary) + '</b></p>' : '') + '</body></html>';
        };
        var sendPrintP = async function (kind) {
          var html = '';
          var subtitle = '';
          if (kind === 'allproducts' || kind === 'outstock') {
            if (typeof products === 'undefined' || !Array.isArray(products)) throw new Error('Data produk belum dimuat.');
            var ps = products.filter(function (p) { return kind === 'allproducts' || Number(p.stok || 0) <= 0; })
              .sort(function (a,b) { return String(a.nama || '').localeCompare(String(b.nama || ''), 'id'); });
            var rows = ps.map(function (p,i) { return [
              String(i+1), escP(p.nama || '-'), escP(p.kategori || '-'), escP(p.kode_produk || p.kode || p.barcode || '-'),
              escP(p.stok == null ? 0 : p.stok), moneyP(p.harga_ecer), moneyP(p.harga_reseller), moneyP(p.harga_agen), moneyP(p.harga_grosir), escP(p.satuan || '-')
            ]; });
            var title = kind === 'outstock' ? 'LAPORAN PRODUK STOK HABIS' : 'LAPORAN LENGKAP SEMUA PRODUK';
            html = htmlP(title, 'Jumlah produk: ' + ps.length,
              tableP(['No','Nama Produk','Kategori','Kode/Barcode','Stok','Harga Ecer','Harga Reseller','Harga Agen','Harga Grosir','Satuan'], rows));
          } else if (kind === 'receivables') {
            if (typeof receivables === 'undefined' || !Array.isArray(receivables)) throw new Error('Data piutang belum dimuat.');
            var debts = receivables.filter(function (r) { return Number(r.sisa || 0) > 0; })
              .sort(function (a,b) { return Number(b.sisa || 0) - Number(a.sisa || 0); });
            var dr = debts.map(function (r,i) { return [
              String(i+1), escP(r.sales && r.sales.nomor_transaksi || '-'), escP(r.agents && r.agents.nama || '-'),
              dateP(r.created_at), moneyP(r.total), moneyP(r.dibayar), moneyP(r.sisa)
            ]; });
            var totalDebt = debts.reduce(function (sum,r) { return sum + Number(r.sisa || 0); }, 0);
            html = htmlP('LAPORAN PIUTANG BELUM LUNAS', 'Jumlah piutang aktif: ' + debts.length,
              tableP(['No','No. Transaksi','Nama Agen/Pelanggan','Tanggal','Total','Dibayar','Sisa Piutang'], dr),
              'Total sisa piutang: ' + moneyP(totalDebt));
          } else if (kind === 'sales_today' || kind === 'sales_month' || kind === 'sales_all') {
            if (typeof sales === 'undefined' || !Array.isArray(sales)) throw new Error('Data penjualan belum dimuat.');
            var today = localKeyP(new Date()), month = today.slice(0,7);
            var ss = sales.filter(function (s) {
              if (kind === 'sales_all') return true;
              var key = localKeyP(s.created_at);
              return kind === 'sales_today' ? key === today : key.slice(0,7) === month;
            }).sort(function (a,b) { return new Date(a.created_at || 0) - new Date(b.created_at || 0); });
            var items = typeof saleItems !== 'undefined' && Array.isArray(saleItems) ? saleItems : [];
            var ags = typeof agents !== 'undefined' && Array.isArray(agents) ? agents : [];
            var us = typeof users !== 'undefined' && Array.isArray(users) ? users : [];
            var rowsSales = ss.map(function (s,i) {
              var itemText = items.filter(function (it) { return it.sale_id === s.id; }).map(function (it) {
                return escP(it.nama_produk || it.product_name || 'Produk') + ' × ' + escP(it.qty || 0);
              }).join('; ') || '-';
              var agent = ags.find(function (a) { return a.id === s.agent_id; });
              var cashier = us.find(function (u) { return u.id === s.kasir_id; });
              return [String(i+1), dateP(s.created_at), escP(s.nomor_transaksi || '-'), escP(cashier && (cashier.nama || cashier.username) || '-'),
                escP(agent && agent.nama || 'Umum'), itemText, moneyP(s.total), moneyP(s.dibayar), moneyP(s.sisa)];
            });
            var label = kind === 'sales_today' ? 'HARI INI' : kind === 'sales_month' ? 'BULAN INI' : 'SEMUA DATA';
            var totalSales = ss.reduce(function (sum,s) { return sum + Number(s.total || 0); }, 0);
            var paidSales = ss.reduce(function (sum,s) { return sum + Number(s.dibayar || 0); }, 0);
            html = htmlP('LAPORAN PENJUALAN - ' + label, 'Jumlah transaksi: ' + ss.length,
              tableP(['No','Tanggal','No. Transaksi','Kasir','Pelanggan/Agen','Rincian Produk','Total','Dibayar','Sisa'], rowsSales),
              'Total transaksi: ' + moneyP(totalSales) + ' • Total dibayar: ' + moneyP(paidSales));
          } else {
            if (typeof window.buildPrintReportHtml !== 'function') throw new Error('Laporan penjualan belum tersedia.');
            html = window.buildPrintReportHtml();
          }
          if (!window.electronPrinter || typeof window.electronPrinter.printReport !== 'function') {
            throw new Error('Jalur cetak Windows tidak tersedia. Tutup dan buka kembali software.');
          }
          var printerName = '';
          try {
            if (typeof window.receiptPrinterName === 'function') printerName = window.receiptPrinterName() || '';
            if (!printerName && document.getElementById('receiptPrinter')) printerName = document.getElementById('receiptPrinter').value || '';
          } catch (_) {}
          await window.electronPrinter.printReport(html, printerName);
          if (typeof toast === 'function') toast('Dokumen berhasil dikirim ke printer ' + (printerName || 'default Windows') + '.');
        };
        window.printReport = function () {
          var old = document.getElementById('windowsReportPrintPicker'); if (old) old.remove();
          var overlay = document.createElement('div');
          overlay.id = 'windowsReportPrintPicker';
          overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(12,24,17,.62);display:flex;align-items:center;justify-content:center;padding:18px;';
          overlay.innerHTML = '<div role="dialog" aria-modal="true" style="background:#fff;color:#1b2b21;width:min(540px,100%);max-height:90vh;overflow:auto;border-radius:16px;padding:24px;box-shadow:0 20px 70px #0005;font:14px Arial,sans-serif">' +
            '<h2 style="margin:0 0 8px;font-size:21px">Pilih Data yang Dicetak</h2><p style="margin:0 0 18px;color:#647268">Pilih jenis laporan.</p><div style="display:grid;gap:10px">' +
            '<button data-print-kind="allproducts" style="padding:13px;text-align:left;border:1px solid #d6e1d9;border-radius:10px;background:#f5faf6;font-weight:700;cursor:pointer">📦 Semua Data Produk <small style="display:block;font-weight:400;margin-top:4px">Detail produk, stok, kode, dan empat harga</small></button>' +
            '<button data-print-kind="outstock" style="padding:13px;text-align:left;border:1px solid #f0d5d5;border-radius:10px;background:#fff7f7;font-weight:700;cursor:pointer">🔴 Data Stok Habis</button>' +
            '<button data-print-kind="receivables" style="padding:13px;text-align:left;border:1px solid #f0dfb9;border-radius:10px;background:#fffbf2;font-weight:700;cursor:pointer">💰 Data Piutang Belum Lunas</button>' +
            '<div style="border-top:1px solid #e1e8e3;margin-top:5px;padding-top:12px;font-weight:700">Laporan Penjualan</div>' +
            '<button data-print-kind="sales_today" style="padding:11px;border:1px solid #d6e1d9;border-radius:10px;background:#fff;cursor:pointer">🧾 Hari Ini</button>' +
            '<button data-print-kind="sales_month" style="padding:11px;border:1px solid #d6e1d9;border-radius:10px;background:#fff;cursor:pointer">📅 Bulan Ini</button>' +
            '<button data-print-kind="sales_all" style="padding:11px;border:1px solid #d6e1d9;border-radius:10px;background:#fff;cursor:pointer">📚 Semua Data Penjualan</button>' +
            '</div><button data-print-cancel style="margin-top:14px;width:100%;padding:10px;border:0;border-radius:9px;background:#edf1ee;cursor:pointer">Batal</button></div>';
          overlay.addEventListener('click', function (event) {
            if (event.target === overlay || event.target.closest('[data-print-cancel]')) { overlay.remove(); return; }
            var button = event.target.closest('[data-print-kind]');
            if (button) {
              var kind = button.getAttribute('data-print-kind');
              button.disabled = true; button.style.opacity = '.6';
              sendPrintP(kind).catch(function (err) {
                console.error('[windows-report-print]', err);
                if (typeof toast === 'function') toast('Gagal mencetak: ' + (err && err.message || 'periksa printer dan data'));
              }).finally(function () { button.disabled = false; button.style.opacity = '1'; });
            }
          });
          document.body.appendChild(overlay);
        };
      })();
    \`).catch(error => console.error('[windows-report-print] failed to install:', error));
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
