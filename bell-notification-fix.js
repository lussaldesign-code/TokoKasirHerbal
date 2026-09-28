/* Bell notification rules only. Does not modify login/session. */
(function(){
'use strict';
function esc(v){return String(v==null?'':v).replace(/[&<>\'"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]})}
function getCategory(p){return String(p?.kategori??p?.category??p?.nama_kategori??p?.category_name??'').trim().toLowerCase()}
function getStock(p){return Number(p?.stok??p?.stock??p?.jumlah_stok??p?.qty??0)}
function getAlerts(){
 const list=Array.isArray(window.products)?window.products:[];
 return list.map(p=>({
   nama:String(p?.nama??p?.nama_produk??p?.name??'Produk'),
   kategori:String(p?.kategori??p?.category??p?.nama_kategori??p?.category_name??''),
   stok:getStock(p)
 })).filter(p=>Number.isFinite(p.stok)&&((getCategory(p)==='agarillus'&&p.stok>0&&p.stok<10)||(p.stok===0)))
   .sort((a,b)=>a.stok-b.stok||a.nama.localeCompare(b.nama,'id'));
}
function render(){
 const bell=document.getElementById('notificationBell');
 const badge=document.getElementById('notificationBadge');
 const count=document.getElementById('notificationCount');
 const list=document.getElementById('notificationList');
 if(!bell||!badge||!count||!list)return;
 const alerts=getAlerts();
 badge.textContent=alerts.length>99?'99+':String(alerts.length);
 badge.classList.toggle('show',alerts.length>0);
 count.textContent=String(alerts.length);
 if(!alerts.length){list.innerHTML='<div class="notify-empty">Tidak ada notifikasi stok.</div>';return;}
 list.innerHTML=alerts.map(p=>{
   const empty=p.stok===0;
   return '<div class="notify-item '+(empty?'danger':'warn')+'"><span style="font-size:17px">'+(empty?'🔴':'🟡')+'</span><div style="min-width:0"><b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(p.nama)+'</b><span style="font-size:10px;opacity:.82">'+esc(p.kategori||'Tanpa kategori')+' · '+(empty?'Stok habis':'Stok menipis: '+p.stok)+'</span></div></div>';
 }).join('');
}
function start(){
 if(window.__bellNotificationFix)return;window.__bellNotificationFix=true;
 render();
 setInterval(render,2000);
 document.addEventListener('visibilitychange',function(){if(!document.hidden)render()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
