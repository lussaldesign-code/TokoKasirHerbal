/* TokoKasirLussal APK FCM registration - APK branch only */
(function(){
  'use strict';
  if(!window.Capacitor)return;
  let started=false;
  let listenersReady=false;
  let pendingToken=localStorage.getItem('tokokasirlussal-fcm-token')||'';

  function plugin(){
    try{
      return window.Capacitor?.Plugins?.PushNotifications || window.Capacitor?.registerPlugin?.('PushNotifications');
    }catch(e){return null;}
  }
  function show(msg){try{if(typeof toast==='function')toast(msg);else console.info('[FCM]',msg)}catch(e){console.info('[FCM]',msg)}}

  async function saveToken(token){
    token=String(token||'').trim();
    if(!token)return;
    pendingToken=token;
    localStorage.setItem('tokokasirlussal-fcm-token',token);
    try{
      if(!window.sb||!window.currentUser)return false;
      const username=window.profile?.username||null;
      const r=await window.sb.rpc('register_push_device',{p_token:token,p_username:username});
      if(r.error)throw r.error;
      localStorage.setItem('tokokasirlussal-fcm-registered','1');
      console.info('[FCM] token registered',r.data);
      return true;
    }catch(e){
      console.warn('[FCM] token save failed',e);
      return false;
    }
  }

  async function init(){
    if(started)return;
    if(!window.sb||!window.currentUser||!window.profile)return false;
    const PushNotifications=plugin();
    if(!PushNotifications)return false;
    started=true;
    try{
      if(!listenersReady){
        listenersReady=true;
        await PushNotifications.addListener('registration',async token=>{await saveToken(token?.value)});
        await PushNotifications.addListener('registrationError',err=>console.error('[FCM] registration error',err));
        await PushNotifications.addListener('pushNotificationReceived',n=>console.info('[FCM] notification received',n));
        await PushNotifications.addListener('pushNotificationActionPerformed',a=>console.info('[FCM] notification action',a));
      }
      let perm=await PushNotifications.checkPermissions();
      if(perm.receive!=='granted')perm=await PushNotifications.requestPermissions();
      if(perm.receive!=='granted'){
        show('Izin notifikasi belum diberikan. Aktifkan Notifikasi untuk menerima pemberitahuan penjualan.');
        started=false;
        return false;
      }
      await PushNotifications.register();
      if(pendingToken)await saveToken(pendingToken);
      show('Notifikasi push siap.');
      return true;
    }catch(e){
      console.error('[FCM] init failed',e);
      started=false;
      return false;
    }
  }

  window.TokoKasirLussalPush={init,saveToken};
  const wait=setInterval(async()=>{
    if(await init())clearInterval(wait);
  },800);
  setTimeout(()=>clearInterval(wait),120000);
})();
