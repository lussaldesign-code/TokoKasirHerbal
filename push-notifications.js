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
  function getSb(){try{return typeof sb!=='undefined'?sb:null}catch(e){return null}}
  function getUser(){try{return typeof currentUser!=='undefined'?currentUser:null}catch(e){return null}}
  function getProfile(){try{return typeof profile!=='undefined'?profile:null}catch(e){return null}}

  async function saveToken(token){
    token=String(token||'').trim();
    if(!token)return false;
    pendingToken=token;
    localStorage.setItem('tokokasirlussal-fcm-token',token);
    try{
      const client=getSb(),user=getUser(),prof=getProfile();
      if(!client||!user)return false;
      const r=await client.rpc('register_push_device',{p_token:token,p_username:prof?.username||null});
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
    if(started)return false;
    if(!getSb()||!getUser()||!getProfile())return false;
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
