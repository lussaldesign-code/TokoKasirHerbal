/* Authentication + existing bell notification compatibility fix. */
(function(){
'use strict';
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
   const storageKey='tokokasirlussal-auth-v2';
   const client=window.__webLoginClient||(window.__webLoginClient=window.supabase.createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey}}));
   let session=null;
   try{session=(await client.auth.getSession()).data?.session}catch(_){try{localStorage.removeItem(storageKey)}catch(e){};await client.auth.signOut().catch(()=>{});session=null}
   if(!session?.user?.id){const anon=await client.auth.signInAnonymously();if(anon.error)throw Error('Login otomatis Supabase gagal: '+anon.error.message);session=anon.data?.session;}
   if(!session?.user?.id)throw Error('Supabase tidak mengembalikan sesi.');
   let result=admin?await client.rpc('kiosk_login_pin',{p_username:username,p_pin:pin}):await client.rpc('kiosk_login_cashier',{p_username:username});
   if(result.error&&/jwt|session|anonymous|not authenticated|expired/i.test(result.error.message||'')){
    await client.auth.signOut().catch(()=>{});try{localStorage.removeItem(storageKey)}catch(_){}
    const anon=await client.auth.signInAnonymously();if(anon.error)throw anon.error;session=anon.data?.session;
    result=admin?await client.rpc('kiosk_login_pin',{p_username:username,p_pin:pin}):await client.rpc('kiosk_login_cashier',{p_username:username});
   }
   if(result.error)throw result.error;
   const account=Array.isArray(result.data)?result.data[0]:result.data;if(!account)throw Error('Akun tidak ditemukan atau tidak aktif.');
   const role=String(account.role||'').toLowerCase();if(admin&&role!=='admin')throw Error('Akun ini bukan akun admin.');if(!admin&&role==='admin')throw Error('Gunakan tombol Login Admin.');
   const prof=await client.rpc('kiosk_profile',{p_username:account.username||username});if(prof.error)throw prof.error;
   const profile=Array.isArray(prof.data)?prof.data[0]:prof.data;if(!profile)throw Error('Profil akun belum tersedia.');if(profile.aktif===false)throw Error('Akun tidak aktif.');
   window.sb=client;window.currentUser=session.user;window.profile={...profile,auth_user_id:session.user.id};localStorage.setItem('tokokasirlussal-username',String(profile.username||account.username||username));
   if(typeof window.showApp==='function')window.showApp();else{$('login')?.classList.add('hidden');$('app')?.classList.remove('hidden');document.body.classList.remove('login-screen');document.body.classList.add('app-screen');}
   try{if(typeof window.loadAll==='function')await window.loadAll()}catch(loadErr){console.error('[auth] loadAll after login',loadErr);toastMsg('Login berhasil, tetapi data belum dapat dimuat: '+(loadErr?.message||'periksa koneksi data'));}
  }catch(e){console.error('[auth-login-fix]',e);const m=String(e?.message||e||'Login gagal');toastMsg(/anonymous|disabled|sign.?in/i.test(m)?'Login otomatis Supabase gagal. Aktifkan Anonymous Sign-Ins di Supabase Authentication.':m)}
  finally{busy=false;if(btn){btn.disabled=false;btn.removeAttribute('aria-busy');btn.innerHTML=old||'Masuk ke Dashboard <span>→</span>';}}
 };
 document.addEventListener('keydown',e=>{if(e.key==='Enter'&&document.body.classList.contains('login-screen')&&!e.target.matches('textarea,button'))window.login()});
}
function stockItems(){
 const list=Array.isArray(window.products)?window.products:[];
 const cat=p=>String(p?.kategori??p?.category??p?.nama_kategori??p?.category_name??'').trim().toLowerCase();
 const stock=p=>Number(p?.stok??p?.stock??p?.jumlah_stok??p?.qty??0);
 return list.map(p=>({id:p.id,nama:String(p?.nama??p?.nama_produk??p?.name??'Produk'),kategori:String(p?.kategori??p?.category??p?.nama_kategori??p?.category_name??''),stok:stock(p)})).filter(p=>Number.isFinite(p.stok)&&((cat(p)==='agarillus'&&p.stok<10)||(cat(p)!=='agarillus'&&p.stok===0))).sort((a,b)=>a.stok-b.stok||a.nama.localeCompare(b.nama,'id'));
}
window.getStockNotificationItems=stockItems;
function renderBell(){
 const bell=$('notificationBell'),badge=$('notificationBadge'),count=$('notificationCount'),list=$('notificationList'),wrap=document.querySelector('.notify-wrap');
 if(!bell||!badge||!count||!list)return;
 const items=stockItems();count.textContent=String(items.length);badge.textContent=String(items.length);badge.classList.toggle('show',items.length>0);
 if(!items.length){list.innerHTML='<div class="notify-empty">Tidak ada notifikasi stok.</div>';return;}
 list.innerHTML=items.map(p=>{const empty=p.stok===0;return '<div class="notify-item '+(empty?'danger':'warn')+'"><span style="font-size:17px">'+(empty?'🔴':'🟡')+'</span><div style="min-width:0"><b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(p.nama)+'</b><span style="font-size:10px;opacity:.82">'+esc(p.kategori||'Tanpa kategori')+' · '+(empty?'Stok habis':'Stok menipis: '+p.stok)+'</span></div></div>'}).join('');
 if(wrap)wrap.style.display=document.body.classList.contains('login-screen')?'none':'';
}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function bindBell(){
 if(window.__stockBellFixReady)return;window.__stockBellFixReady=true;
 document.addEventListener('click',e=>{const bell=e.target.closest?.('#notificationBell');if(bell){e.preventDefault();e.stopImmediatePropagation();$('notificationMenu')?.classList.toggle('show');renderBell();}else if(!e.target.closest?.('.notify-wrap'))$('notificationMenu')?.classList.remove('show')},true);
 renderBell();setInterval(renderBell,2500);document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderBell()});
}
function start(){boot();bindBell()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
