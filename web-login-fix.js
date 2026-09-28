/* Web login compatibility fix — does not alter APK/Electron. */
(function(){
'use strict';
if(window.Capacitor || /Electron/i.test(navigator.userAgent||'')) return;
function boot(){
 if(window.__webLoginFixReady)return; window.__webLoginFixReady=true;
 const $=id=>document.getElementById(id);
 const toastMsg=m=>{try{if(typeof window.toast==='function')return window.toast(m)}catch(_){};const t=$('toast');if(t){t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3500)}else console.error(m)};
 const cfg=window.APP_CONFIG||{}; let busy=false;
 window.login=async function(){
  if(busy)return; busy=true; const btn=$('loginSubmit'),old=btn?.innerHTML;
  if(btn){btn.disabled=true;btn.setAttribute('aria-busy','true');btn.innerHTML='Memproses login... <span>⏳</span>';}
  try{
   if(!cfg.url||!cfg.key)throw Error('Konfigurasi Supabase belum tersedia.');
   if(!window.supabase?.createClient)throw Error('Supabase belum siap. Silakan muat ulang halaman.');
   const username=String($('username')?.value||'').trim().toLowerCase(),pin=String($('pin')?.value||'').trim();
   const admin=$('pinField')&&!$('pinField').classList.contains('hidden');
   if(!username){toastMsg(admin?'Masukkan username admin terlebih dahulu.':'Masukkan username kasir terlebih dahulu.');return;}
   if(admin&&!/^\d{4}$/.test(pin)){toastMsg('PIN admin harus tepat 4 angka.');return;}
   const client=window.__webLoginClient||(window.__webLoginClient=window.supabase.createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'tokokasirlussal-auth-v2'}}));
   let session=(await client.auth.getSession()).data?.session;
   if(!session?.user?.id){const anon=await client.auth.signInAnonymously();if(anon.error)throw Error('Login otomatis Supabase gagal: '+anon.error.message);session=anon.data?.session;}
   if(!session?.user?.id)throw Error('Supabase tidak mengembalikan sesi.');
   let result=admin?await client.rpc('kiosk_login_pin',{p_username:username,p_pin:pin}):await client.rpc('kiosk_login_cashier',{p_username:username});
   if(result.error&&/jwt|session|anonymous|not authenticated/i.test(result.error.message||'')){await client.auth.signOut();const anon=await client.auth.signInAnonymously();if(anon.error)throw anon.error;result=admin?await client.rpc('kiosk_login_pin',{p_username:username,p_pin:pin}):await client.rpc('kiosk_login_cashier',{p_username:username});}
   if(result.error)throw result.error;
   const account=Array.isArray(result.data)?result.data[0]:result.data;if(!account)throw Error('Akun tidak ditemukan atau tidak aktif.');
   const role=String(account.role||'').toLowerCase();if(admin&&role!=='admin')throw Error('Akun ini bukan akun admin.');if(!admin&&role==='admin')throw Error('Gunakan tombol Login Admin.');
   const prof=await client.rpc('kiosk_profile',{p_username:account.username||username});if(prof.error)throw prof.error;
   const profile=Array.isArray(prof.data)?prof.data[0]:prof.data;if(!profile)throw Error('Profil akun belum tersedia.');if(profile.aktif===false)throw Error('Akun tidak aktif.');
   window.sb=client;window.currentUser=session.user;window.profile={...profile,auth_user_id:session.user.id};localStorage.setItem('tokokasirlussal-username',String(profile.username||account.username||username));
   if(typeof window.showApp==='function')window.showApp();else{$('login')?.classList.add('hidden');$('app')?.classList.remove('hidden');document.body.classList.remove('login-screen');document.body.classList.add('app-screen');}
   if(typeof window.loadAll==='function')await window.loadAll();
  }catch(e){console.error('[web-login-fix]',e);const m=String(e?.message||e||'Login gagal');toastMsg(/anonymous|disabled|sign.?in/i.test(m)?'Login otomatis Supabase gagal. Aktifkan Anonymous Sign-Ins di Supabase Authentication.':m)}
  finally{busy=false;if(btn){btn.disabled=false;btn.removeAttribute('aria-busy');btn.innerHTML=old||'Masuk ke Dashboard <span>→</span>';}}
 };
 document.addEventListener('keydown',e=>{if(e.key==='Enter'&&document.body.classList.contains('login-screen')&&!e.target.matches('textarea,button'))window.login()});
}
if(document.readyState==='complete')boot();else window.addEventListener('load',boot,{once:true});
})();
