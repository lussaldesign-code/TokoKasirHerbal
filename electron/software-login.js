/* Windows-only login controller. This file is never loaded by Web/APK. */
(function(){
'use strict';
let busy=false;
function $(id){return document.getElementById(id)}
function bind(){
 const submit=$('loginSubmit'),kasir=$('loginKasirBtn'),admin=$('loginAdminBtn');
 if(submit&&submit.dataset.softwareBridgeBound!=='1'){submit.dataset.softwareBridgeBound='1';submit.onclick=softwareLogin;submit.addEventListener('click',softwareLogin,true);}
 if(kasir&&kasir.dataset.softwareBridgeBound!=='1'){kasir.dataset.softwareBridgeBound='1';kasir.onclick=()=>window.setLoginMode?.('kasir');}
 if(admin&&admin.dataset.softwareBridgeBound!=='1'){admin.dataset.softwareBridgeBound='1';admin.onclick=()=>window.setLoginMode?.('admin');}
}
async function softwareLogin(e){
 if(e){e.preventDefault();e.stopImmediatePropagation();e.stopPropagation();}
 if(busy)return;
 busy=true;
 const submit=$('loginSubmit'),old=submit?.innerHTML;
 try{
  if(typeof window.login!=='function')throw new Error('Modul login Windows belum dimuat. Tutup lalu buka kembali aplikasi.');
  if(submit){submit.disabled=true;submit.innerHTML='Memeriksa login... <span>⏳</span>';}
  await window.login();
 }catch(err){
  console.error('[software-login-bridge]',err);
  const message=err?.message||String(err)||'Login gagal.';
  if(typeof window.toast==='function')window.toast(message);else alert(message);
 }finally{
  busy=false;
  if(submit){submit.disabled=false;submit.innerHTML=old||'Masuk ke Dashboard <span>→</span>';}
 }
}
window.__softwareLoginBridge=softwareLogin;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
window.addEventListener('load',bind);
new MutationObserver(bind).observe(document.documentElement,{childList:true,subtree:true});
})();