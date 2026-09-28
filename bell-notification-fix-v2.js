/* Existing top-right bell only. Login/session are untouched. */
(function(){
'use strict';
function patchOriginalRenderer(){
  if(window.__bellNotificationFixV2)return;
  const original=window.renderNotifications;
  if(typeof original!=='function')return;
  window.__bellNotificationFixV2=true;
  window.renderNotifications=function(){
    const oldFilter=Array.prototype.filter;
    Array.prototype.filter=function(callback,thisArg){
      const arr=this;
      const looksLikeProducts=Array.isArray(arr)&&arr.some(function(p){
        return p&&typeof p==='object'&&('stok' in p)&&('nama' in p||'nama_produk' in p||'name' in p);
      });
      if(!looksLikeProducts)return oldFilter.call(arr,callback,thisArg);
      return oldFilter.call(arr,function(p,i,a){
        const base=callback.call(thisArg,p,i,a);
        if(!base)return false;
        const stock=Number(p?.stok??p?.stock??p?.jumlah_stok??p?.qty??0);
        const category=String(p?.kategori??p?.category??p?.nama_kategori??p?.category_name??'').trim().toLowerCase();
        return stock===0 || (category==='agarillus'&&stock>0&&stock<10);
      },thisArg);
    };
    try{return original.apply(this,arguments)}finally{Array.prototype.filter=oldFilter}
  };
  window.renderNotifications();
}
function start(){patchOriginalRenderer()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.addEventListener('load',start,{once:true});
})();
