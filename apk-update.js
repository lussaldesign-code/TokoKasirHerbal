/* TokoKasirLussal — APK updater
 * APK-only: the Android app checks the newest GitHub Release that contains an APK.
 * Web and Windows update systems are not used here.
 */
(function () {
  'use strict';

  const RELEASES_API = 'https://api.github.com/repos/lussaldesign-code/TokoKasirHerbal/releases?per_page=20';
  const CURRENT_VERSION = '1.0.33';
  const native = window.AndroidUpdater;
  let downloadId = 0;
  let statusTimer = null;
  let pendingInstallAfterPermission = false;

  function versionIsNewer(latest, current) {
    const a = String(latest || '0').replace(/^v/i, '').split('.').map(Number);
    const b = String(current || '0').replace(/^v/i, '').split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      const av = Number.isFinite(a[i]) ? a[i] : 0;
      const bv = Number.isFinite(b[i]) ? b[i] : 0;
      if (av !== bv) return av > bv;
    }
    return false;
  }

  function getReleaseVersion(release) {
    return String(release?.tag_name || '').replace(/^v/i, '').trim();
  }

  function getApkAsset(release) {
    const assets = Array.isArray(release?.assets) ? release.assets : [];
    return assets.find(asset => /.apk$/i.test(String(asset?.name || '')));
  }

  function nativeRequest(url) {
    if (!native || typeof native.getUpdateManifest !== 'function') return null;
    try {
      const raw = native.getUpdateManifest(url);
      const data = JSON.parse(raw || 'null');
      return data && !data.error ? data : null;
    } catch (error) {
      console.warn('[apk-updater] native request failed', error);
      return null;
    }
  }

  async function getLatestAndroidRelease() {
    const nativeData = nativeRequest(RELEASES_API);
    if (Array.isArray(nativeData)) {
      const found = nativeData.find(release => getApkAsset(release));
      if (found) return found;
    }

    const response = await fetch(RELEASES_API + '&t=' + Date.now(), {
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error('GitHub Release HTTP ' + response.status);
    }

    const releases = await response.json();
    if (!Array.isArray(releases)) {
      throw new Error('Data GitHub Release tidak valid.');
    }

    const release = releases.find(item => getApkAsset(item));
    if (!release) {
      throw new Error('Belum ada GitHub Release yang memiliki file APK.');
    }
    return release;
  }

  function showUpdate(info) {
    window.__latestUpdateInfo = info;
    setUpdateModal('available', info);
  }

  async function checkReleaseUpdate(event) {
    if (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }

    const button = document.getElementById('checkUpdateBtn');
    if (button) {
      button.disabled = true;
      button.textContent = '⏳ Mengecek...';
    }

    try {
      const release = await getLatestAndroidRelease();
      const latest = getReleaseVersion(release);
      const asset = getApkAsset(release);

      if (!latest) throw new Error('Versi Release APK tidak valid.');
      if (!asset?.browser_download_url) throw new Error('File APK Release tidak tersedia.');

      if (versionIsNewer(latest, CURRENT_VERSION)) {
        showUpdate({
          version: latest,
          url: asset.browser_download_url,
          releaseUrl: release.html_url || '',
          name: release.name || ('v' + latest)
        });
      } else {
        toast('APK sudah versi terbaru (v' + CURRENT_VERSION + '). Release APK: v' + latest + '.');
      }
    } catch (error) {
      console.error('[apk-updater]', error);
      toast('Gagal mengecek update APK: ' + (error?.message || 'periksa koneksi internet.'));
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = '🔄 Update';
      }
    }
  }

  function installDownloadedApk() {
    if (!downloadId) {
      toast('File update belum siap.');
      return;
    }

    try {
      const result = native?.installApk
        ? native.installApk(String(downloadId))
        : 'error: komponen installer tidak tersedia';

      if (result === 'permission') {
        pendingInstallAfterPermission = true;
        toast('Izinkan pemasangan aplikasi dari sumber ini. Setelah kembali ke aplikasi, instalasi akan dilanjutkan otomatis.');
      } else if (result !== 'ok') {
        toast('Tidak dapat membuka installer: ' + result);
      }
    } catch (error) {
      toast('Gagal membuka installer: ' + (error?.message || error));
    }
  }

  function monitorDownload(info) {
    clearInterval(statusTimer);

    statusTimer = setInterval(() => {
      let status;
      try {
        status = JSON.parse(native.getStatus(String(downloadId)) || '{}');
      } catch (error) {
        status = { status: 'error', message: error?.message || String(error) };
      }

      if (status.total > 0) {
        const percent = (status.received / status.total) * 100;
        const received = (status.received / 1048576).toFixed(1);
        const total = (status.total / 1048576).toFixed(1);
        updateProgress(percent, 'Mengunduh update...', received + ' / ' + total + ' MB');
      } else {
        updateProgress(5, 'Mengunduh update...', 'Menunggu data dari GitHub Release...');
      }

      if (status.status === 'success') {
        clearInterval(statusTimer);
        statusTimer = null;
        updateProgress(100, 'Download selesai', 'File APK sudah tersimpan di perangkat.');
        setUpdateModal('done', info);

        const button = document.getElementById('updateAcceptBtn');
        if (button) {
          button.disabled = false;
          button.textContent = 'Install Update';
          button.onclick = installDownloadedApk;
        }

        const message = document.getElementById('updateMessage');
        if (message) {
          message.textContent = 'Download selesai. Tekan Install Update untuk memasang versi terbaru.';
        }
      }

      if (status.status === 'failed' || status.status === 'error') {
        clearInterval(statusTimer);
        statusTimer = null;
        closeUpdateModal();
        toast('Gagal mengunduh update: ' + (status.message || 'periksa koneksi internet.'));
      }
    }, 500);
  }

  function startReleaseDownload() {
    const info = window.__latestUpdateInfo;
    if (!info?.url) {
      toast('Link APK Release tidak tersedia.');
      return;
    }

    if (!native || typeof native.downloadApk !== 'function' || typeof native.getStatus !== 'function') {
      toast('Komponen updater Android belum tersedia pada APK ini.');
      return;
    }

    const button = document.getElementById('updateAcceptBtn');
    if (button) {
      button.disabled = true;
      button.textContent = 'Mengunduh...';
    }

    setUpdateModal('downloading', info);
    updateProgress(0, 'Menyiapkan download...', 'Menghubungkan ke GitHub Release...');

    try {
      downloadId = Number(native.downloadApk(info.url, info.version));
      if (!downloadId) throw new Error('DownloadManager tidak dapat memulai download.');
      monitorDownload(info);
    } catch (error) {
      closeUpdateModal();
      toast('Gagal memulai download: ' + (error?.message || error));
    }
  }

  function bind() {
    if (!window.Capacitor) return;

    const button = document.getElementById('checkUpdateBtn');
    if (!button || button.dataset.apkUpdaterBound === '1') return;

    button.dataset.apkUpdaterBound = '1';
    button.addEventListener('click', checkReleaseUpdate, true);
  }

  window.startUpdateDownload = startReleaseDownload;

  function retryPendingInstall() {
    if (!pendingInstallAfterPermission || !downloadId) return;
    pendingInstallAfterPermission = false;
    setTimeout(() => {
      try {
        const result = native?.installApk
          ? native.installApk(String(downloadId))
          : 'error: komponen installer tidak tersedia';
        if (result !== 'ok' && result !== 'permission') {
          toast('Tidak dapat membuka installer: ' + result);
        }
      } catch (error) {
        toast('Gagal melanjutkan installer: ' + (error?.message || error));
      }
    }, 350);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') retryPendingInstall();
  });
  window.addEventListener('focus', retryPendingInstall);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, { once: true });
  } else {
    bind();
  }

  window.addEventListener('load', bind);
  window.addEventListener('beforeunload', () => clearInterval(statusTimer));
})();
