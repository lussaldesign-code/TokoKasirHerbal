/* Windows-only login controller. This file is never loaded by Web/APK. */
(function(){
'use strict';
let busy=false;
function $(id){return document.getElementById(id)}

function loginVisible(){
 const login=$('login');
 return !!login && !login.classList.contains('hidden');
}

function syncLoginNotifications(){
 const selectors='[data-notification],[data-notifications],[aria-label*="notif" i],[aria-label*="bell" i],[title*="notif" i],[title*="bell" i],[class*="notification" i],[class*="notifications" i],[class*="notif-bell" i],[class*="bell" i]';
 document.querySelectorAll(selectors).forEach(el=>{
  if(el.id==='login' || el.closest('#login') || el.closest('.login')) return;
  if(loginVisible()){
   if(el.dataset.softwareLoginHidden!=='1'){
    el.dataset.softwareLoginHidden='1';
    el.dataset.softwareLoginDisplay=el.style.display||'';
   }
   el.style.display='none';
  }else if(el.dataset.softwareLoginHidden==='1'){
   el.style.display=el.dataset.softwareLoginDisplay||'';
   delete el.dataset.softwareLoginHidden;
   delete el.dataset.softwareLoginDisplay;
  }
 });
}

function bind(){
 const submit=$('loginSubmit'),kasir=$('loginKasirBtn'),admin=$('loginAdminBtn');
 if(submit&&submit.dataset.softwareBridgeBound!=='1'){
  submit.dataset.softwareBridgeBound='1';
  submit.addEventListener('click',softwareLogin,true);
 }
 if(kasir&&kasir.dataset.softwareBridgeBound!=='1'){
  kasir.dataset.softwareBridgeBound='1';
  kasir.addEventListener('click',()=>window.setLoginMode?.('kasir'));
 }
 if(admin&&admin.dataset.softwareBridgeBound!=='1'){
  admin.dataset.softwareBridgeBound='1';
  admin.addEventListener('click',()=>window.setLoginMode?.('admin'));
 }
 syncLoginNotifications();
}

async function waitForLoginController(timeout=5000){
 const started=Date.now();
 while(typeof window.login!=='function' && Date.now()-started<timeout){
  await new Promise(resolve=>setTimeout(resolve,50));
 }
 if(typeof window.login!=='function'){
  throw new Error('Modul login Windows belum dimuat. Silakan tutup lalu buka kembali aplikasi.');
 }
 return window.login;
}

async function softwareLogin(e){
 if(e){e.preventDefault();e.stopImmediatePropagation();e.stopPropagation();}
 if(busy)return;
 busy=true;
 const submit=$('loginSubmit'),old=submit?.innerHTML;
 try{
  const loginController=await waitForLoginController();
  if(submit){submit.disabled=true;submit.innerHTML='Memeriksa login... <span>⏳</span>';}
  await loginController();
 }catch(err){
  console.error('[software-login-bridge]',err);
  const message=err?.message||String(err)||'Login gagal.';
  if(typeof window.toast==='function')window.toast(message);else alert(message);
 }finally{
  busy=false;
  if(submit){submit.disabled=false;submit.innerHTML=old||'Masuk ke Dashboard <span>→</span>';}
  syncLoginNotifications();
 }
}

window.__softwareLoginBridge=softwareLogin;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
window.addEventListener('load',bind);
new MutationObserver(bind).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});
})();