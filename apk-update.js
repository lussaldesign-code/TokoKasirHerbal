/* APK-ONLY RELEASE UPDATE FLOW
 * APK update source = GitHub Releases.
 * Web/Windows updater is untouched.
 */
(function(){
  'use strict';
  var native=window.AndroidUpdater;
  var pollTimer=null,downloadedId=0;
  var RELEASE_API='https://api.github.com/repos/lussaldesign-code/TokoKasirHerbal/releases/latest';
  var CURRENT_APK_VERSION='__APK_VERSION__';

  function nativeJson(url){
    if(!native||typeof native.getUpdateManifest!=='function')return null;
    try{
      var raw=native.getUpdateManifest(url);
      var parsed=JSON.parse(raw||'{}');
      if(parsed&&parsed.error)throw Error(parsed.error);
      return parsed;
    }catch(e){console.warn('[apk-release-update] native request failed',e);return null}
  }
  async function getRelease(){
    var data=nativeJson(RELEASE_API);
    if(data&&data.tag_name)return data;
    var res=await fetch(RELEASE_API+'?t='+Date.now(),{cache:'no-store',headers:{'Accept':'application/vnd.github+json','Cache-Control':'no-cache'}});
    if(!res.ok)throw Error('GitHub Release HTTP '+res.status);
    return await res.json();
  }
  function releaseVersion(release){
    return String(release?.tag_name||release?.name||'').replace(/^v/i,'').trim();
  }
  function newer(a,b){
    var A=String(a||'0').split('.').map(x=>parseInt(x,10)||0),B=String(b||'0').split('.').map(x=>parseInt(x,10)||0);
    for(var i=0;i<3;i++){if((A[i]||0)>(B[i]||0))return true;if((A[i]||0)<(B[i]||0))return false}
    return false;
  }
  function findApk(release){
    var assets=Array.isArray(release?.assets)?release.assets:[];
    var apk=assets.find(function(a){return /\.apk$/i.test(String(a?.name||''))});
    return apk?.browser_download_url||'';
  }
  function installNow(){
    if(!downloadedId)return toast('File update belum siap.');
    try{
      var r=native&&native.installApk?native.installApk(String(downloadedId)):'';
      if(r==='permission')toast('Izinkan TokoKasirLussal memasang aplikasi dari sumber ini, lalu tekan Install Update lagi.');
      else if(r!=='ok')toast('Tidak dapat membuka installer: '+(r||'error'));
    }catch(e){toast('Gagal membuka installer: '+(e.message||e))}
  }

  window.startUpdateDownload=function(){
    var info=window.__latestUpdateInfo;
    if(!info||!info.url)return toast('Link update Release tidak tersedia.');
    var accept=document.getElementById('updateAcceptBtn');
    if(accept){accept.disabled=true;accept.textContent='Mengunduh...'}
    setUpdateModal('downloading',info);
    updateProgress(0,'Menyiapkan download...','Menghubungkan ke GitHub Release...');
    if(!native||typeof native.downloadApk!=='function'){
      closeUpdateModal();toast('Komponen download APK belum tersedia. Silakan gunakan APK terbaru.');return;
    }
    try{
      downloadedId=Number(native.downloadApk(info.url,info.version||'latest'));
      if(!downloadedId)throw Error('Android DownloadManager tidak mengembalikan ID download.');
    }catch(e){closeUpdateModal();toast('Gagal memulai download: '+(e.message||e));return}
    clearInterval(pollTimer);
    pollTimer=setInterval(function(){
      var s={};
      try{s=JSON.parse(native.getStatus(String(downloadedId))||'{}')}catch(e){s={status:'error',message:e.message||String(e)}}
      if(s.total>0)updateProgress((s.received/s.total)*100,'Mengunduh update...',((s.received/1048576).toFixed(1)+' / '+(s.total/1048576).toFixed(1)+' MB'));
      else updateProgress(5,'Mengunduh update...','Menunggu data dari GitHub...');
      if(s.status==='success'){
        clearInterval(pollTimer);pollTimer=null;
        updateProgress(100,'Download selesai','File APK dari Release sudah tersimpan di perangkat.');
        setUpdateModal('done',info);
        var b=document.getElementById('updateAcceptBtn');
        if(b){b.disabled=false;b.textContent='Install Update';b.onclick=installNow}
        var m=document.getElementById('updateMessage');
        if(m)m.textContent='Download selesai. Tekan Install Update untuk memasang versi terbaru.';
      }else if(s.status==='failed'||s.status==='error'){
        clearInterval(pollTimer);pollTimer=null;closeUpdateModal();
        toast('Gagal mengunduh update: '+(s.message||'periksa koneksi internet.'));
      }
    },500);
  };

  async function checkReleaseUpdate(e){
    if(e){e.preventDefault();e.stopImmediatePropagation()}
    var btn=document.getElementById('checkUpdateBtn');
    if(btn){btn.disabled=true;btn.textContent='⏳ Mengecek...'}
    try{
      var release=await getRelease();
      var latest=releaseVersion(release);
      var url=findApk(release);
      if(!latest)throw Error('Versi GitHub Release tidak valid.');
      if(!url)throw Error('Release terbaru tidak memiliki file APK.');
      if(newer(latest,CURRENT_APK_VERSION)){
        var info={version:latest,url:url,releaseUrl:release.html_url||'',name:release.name||('v'+latest)};
        window.__latestUpdateInfo=info;
        setUpdateModal('available',info);
      }else{
        toast('APK sudah versi terbaru (v'+CURRENT_APK_VERSION+'). Release: v'+latest+'.');
      }
    }catch(err){
      console.error('[apk-release-update]',err);
      toast('Gagal mengecek Release APK: '+(err.message||'periksa koneksi internet.'));
    }finally{
      if(btn){btn.disabled=false;btn.textContent='🔄 Update'}
    }
  }

  function bind(){
    if(!window.Capacitor)return;
    var btn=document.getElementById('checkUpdateBtn');
    if(!btn||btn.dataset.releaseUpdaterBound==='1')return;
    btn.dataset.releaseUpdaterBound='1';
    btn.addEventListener('click',checkReleaseUpdate,true);
    btn.setAttribute('onclick','return false;');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
  window.addEventListener('load',bind);
  window.addEventListener('beforeunload',function(){if(pollTimer)clearInterval(pollTimer)});
})();
