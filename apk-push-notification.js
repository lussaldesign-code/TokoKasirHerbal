/* APK-only push notification bridge. Web and Electron are deliberately ignored. */
(function(){
  const isApk=!!window.Capacitor && !/Electron/i.test(navigator.userAgent||'');
  if(!isApk)return;
  let syncTimer=null;

  async function getPushClient(){
    if(window.sb?.rpc)return window.sb;
    try{
      const cfg=window.APP_CONFIG||{};
      if(!cfg.url||!cfg.key||!window.supabase?.createClient)return null;
      return window.supabase.createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'tokokasirlussal-auth-v2'}});
    }catch(e){console.error('[push] client init failed',e);return null}
  }

  async function syncStoredToken(){
    const token=localStorage.getItem('tokokasirlussal-push-token');
    if(!token)return false;
    try{
      const client=await getPushClient();
      if(!client?.rpc)return false;
      const sessionResult=await client.auth.getSession();
      const authUserId=sessionResult.data?.session?.user?.id||null;
      if(!authUserId)return false;
      const username=localStorage.getItem('tokokasirlussal-username')||null;
      const result=await client.rpc('push_device_register',{p_token:token,p_username:username,p_auth_user_id:authUserId});
      if(result.error)throw result.error;
      if(syncTimer){clearInterval(syncTimer);syncTimer=null;}
      console.info('[push] device token registered');
      return true;
    }catch(e){console.error('[push] token sync failed',e);return false}
  }

  function scheduleTokenSync(){
    if(syncTimer)return;
    syncTimer=setInterval(()=>{syncStoredToken().catch(()=>{})},5000);
    syncStoredToken().catch(()=>{});
  }

  async function registerPush(){
    try{
      const mod=window.Capacitor?.Plugins?.PushNotifications;
      if(!mod){console.warn('[push] Capacitor PushNotifications plugin not installed');return;}
      let perm=await mod.checkPermissions();
      if(perm.receive!=='granted') perm=await mod.requestPermissions();
      if(perm.receive!=='granted'){console.warn('[push] notification permission denied');return;}
      await mod.createChannel({id:'tokokasir',name:'TokoKasirLussal',description:'Notifikasi penjualan dan produk habis',importance:5,sound:'default',vibration:true});
      await mod.register();
    }catch(e){console.error('[push] register failed',e)}
  }

  function bind(){
    const mod=window.Capacitor?.Plugins?.PushNotifications;
    if(!mod)return;
    mod.addListener('registration', async token=>{
      try{localStorage.setItem('tokokasirlussal-push-token',token.value)}catch(_){}
      scheduleTokenSync();
    });
    mod.addListener('registrationError',e=>console.error('[push] registration error',e));
    mod.addListener('pushNotificationReceived',n=>console.info('[push] received',n));
    mod.addListener('pushNotificationActionPerformed',action=>{
      const target=action?.notification?.data?.target;
      if(target && typeof window.tab==='function'){
        const nav=[...document.querySelectorAll('.nav')].find(x=>(x.getAttribute('onclick')||'').includes("tab('"+target+"'"));
        if(nav)window.tab(target,nav);
      }
    });
    setTimeout(()=>{registerPush();scheduleTokenSync()},1200);
  }

  window.TokoKasirPush={register:registerPush,sync:syncStoredToken};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
