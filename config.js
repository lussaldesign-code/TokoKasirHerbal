// Konfigurasi Supabase untuk aplikasi browser.
// Hanya gunakan publishable/anon key. Jangan pernah menaruh service_role/secret key di file ini.
window.APP_CONFIG={
  url:'https://geoedddgvzvqsykuekdw.supabase.co',
  key:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnb2VkZGRndnp2cXN5a3Vla2R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwODM3MjAsImV4cCI6MjEwNTY1OTcyMH0.DKaoJbKparsGc9_WEQ_jefQVJl5raNgPGckbw9UVoNI'
};

document.addEventListener('DOMContentLoaded',()=>{
  const side=document.querySelector('.side'),main=document.querySelector('.main');
  const purchaseNav=[...document.querySelectorAll('.nav')].find(x=>x.textContent.includes('Pembelian'));
  if(!side||!main||document.getElementById('navRetur'))return;
  const nav=document.createElement('button');
  nav.id='navRetur';nav.className='nav';nav.type='button';nav.innerHTML='<span>↩️</span>Retur';nav.onclick=()=>openReturnsTab(nav);
  if(purchaseNav)purchaseNav.insertAdjacentElement('afterend',nav);else side.appendChild(nav);
  const sec=document.createElement('section');sec.id='tab-retur';sec.className='tab card';
  sec.innerHTML='<div class="head"><div><h2>Retur Barang</h2><div class="note">Kembalikan barang yang terjual atau barang yang dibeli.</div></div></div><div class="dash" style="grid-template-columns:repeat(2,1fr)"><div class="metric card"><span>Retur Penjualan</span><b id="returnSaleCount">0</b><small class="note">Pilih transaksi penjualan untuk mengembalikan barang ke stok.</small></div><div class="metric card"><span>Retur Pembelian</span><b id="returnPurchaseCount">0</b><small class="note">Pilih pembelian untuk mengembalikan barang ke supplier.</small></div></div><div class="head"><h2>Retur Penjualan</h2></div><div class="tablebox"><table><thead><tr><th>Tanggal</th><th>Nomor</th><th>Total</th><th>Dibayar</th><th>Aksi</th></tr></thead><tbody id="returnSalesList"></tbody></table></div><div class="head"><h2>Retur Pembelian</h2></div><div class="tablebox"><table><thead><tr><th>Tanggal</th><th>Nomor</th><th>Supplier</th><th>Total</th><th>Aksi</th></tr></thead><tbody id="returnPurchasesList"></tbody></table></div>';
  main.appendChild(sec);
});
function openReturnsTab(el){document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));const t=document.getElementById('tab-retur');if(t)t.classList.add('active');document.querySelectorAll('.nav').forEach(x=>x.classList.remove('active'));el?.classList.add('active');renderReturnsMenu()}
function renderReturnsMenu(){
 const saleList=document.getElementById('returnSalesList'),purchaseList=document.getElementById('returnPurchasesList');
 if(!saleList||!purchaseList)return;
 const ss=Array.isArray(sales)?sales:[],ps=Array.isArray(purchases)?purchases:[],sr=Array.isArray(saleReturns)?saleReturns:[],pr=Array.isArray(purchaseReturns)?purchaseReturns:[];
 document.getElementById('returnSaleCount').textContent=sr.length;document.getElementById('returnPurchaseCount').textContent=pr.length;
 saleList.innerHTML=ss.map(s=>{const returned=sr.filter(r=>r.sale_id===s.id).reduce((a,r)=>a+Number(r.total||0),0),items=(Array.isArray(saleItems)?saleItems:[]).filter(i=>i.sale_id===s.id),remaining=items.reduce((sum,i)=>{const used=(Array.isArray(saleReturnItems)?saleReturnItems:[]).filter(r=>r.sale_item_id===i.id).reduce((a,r)=>a+Number(r.qty||0),0);return sum+Math.max(0,Number(i.qty||0)-used)},0);return '<tr><td>'+esc(s.created_at?new Date(s.created_at).toLocaleDateString('id-ID'):'-')+'</td><td><b>'+esc(s.nomor_transaksi||s.id)+'</b></td><td>'+rp(Math.max(0,Number(s.total||0)-returned))+'</td><td>'+rp(s.dibayar||0)+'</td><td><button class="btn danger" type="button" '+(remaining<=0?'disabled':'')+' onclick="openSaleReturn(&quot;'+escAttr(s.id)+'&quot;)">'+(remaining>0?'↩ Retur':'✓ Sudah Diretur')+'</button></td></tr>'}).join('')||'<tr><td colspan="5" class="note">Belum ada transaksi penjualan.</td></tr>';
 purchaseList.innerHTML=ps.map(p=>{const returned=pr.filter(r=>r.purchase_id===p.id).reduce((a,r)=>a+Number(r.total||0),0),items=(Array.isArray(purchaseItems)?purchaseItems:[]).filter(i=>i.purchase_id===p.id),remaining=items.reduce((sum,i)=>{const used=(Array.isArray(purchaseReturnItems)?purchaseReturnItems:[]).filter(r=>r.purchase_item_id===i.id).reduce((a,r)=>a+Number(r.qty||0),0);return sum+Math.max(0,Number(i.qty||0)-used)},0);return '<tr><td>'+esc(p.tanggal||'-')+'</td><td><b>'+esc(p.nomor_pembelian||p.id)+'</b></td><td>'+esc(p.supplier||'-')+'</td><td>'+rp(Math.max(0,Number(p.total||0)-returned))+'</td><td><button class="btn danger" type="button" '+(remaining<=0?'disabled':'')+' onclick="openPurchaseReturn(&quot;'+escAttr(p.id)+'&quot;)">'+(remaining>0?'↩ Retur':'✓ Sudah Diretur')+'</button></td></tr>'}).join('')||'<tr><td colspan="5" class="note">Belum ada pembelian.</td></tr>';
}

/* STOCK NOTIFICATION RULES — Web + Windows software
   Agarillus: stok < 10. Kategori lain: hanya stok 0. */
(function(){
 'use strict';
 const categoryOf=p=>String(p?.kategori??p?.category??p?.nama_kategori??p?.category_name??'').trim().toLowerCase();
 const stockOf=p=>Number(p?.stok??p?.stock??0);
 window.getStockNotificationItems=function(){const list=Array.isArray(window.products)?window.products:[];return list.map(p=>({id:p.id,nama:String(p.nama??p.nama_produk??p.name??'Produk'),kategori:String(p.kategori??p.category??p.nama_kategori??p.category_name??''),stok:stockOf(p)})).filter(p=>Number.isFinite(p.stok)&&(categoryOf(p)==='agarillus'?p.stok<10:p.stok===0)).sort((a,b)=>a.stok-b.stok||a.nama.localeCompare(b.nama,'id'))};
 function escN(v){return String(v).replace(/[&<>'"]/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[s]))}
 function render(){
   if(window.Capacitor)return;
   const host=document.getElementById('tab-dashboard');if(!host)return;
   let box=document.getElementById('stockNotificationShared');
   if(!box){box=document.createElement('section');box.id='stockNotificationShared';box.className='card';box.style.cssText='margin:0 0 12px;padding:14px;border-radius:16px';box.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><div><b>🔔 Notifikasi Stok</b><div class="note">Agarillus: stok &lt; 10. Kategori lain: hanya stok habis.</div></div><b id="stockNotificationSharedCount" style="padding:5px 9px;border-radius:99px;background:#fff3cd;color:#8a5a00;font-size:12px">0</b></div><div id="stockNotificationSharedList" style="margin-top:8px"></div>';host.insertBefore(box,host.firstElementChild||null)}
   const items=window.getStockNotificationItems(),count=document.getElementById('stockNotificationSharedCount'),list=document.getElementById('stockNotificationSharedList');
   if(count)count.textContent=items.length;if(!list)return;
   list.innerHTML=items.length?items.map(p=>'<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;border-top:1px solid #edf1ee"><div style="min-width:0"><b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escN(p.nama)+'</b><span class="note">'+escN(p.kategori||'Tanpa kategori')+' · '+(p.stok===0?'Stok habis':'Stok menipis')+'</span></div><span style="font-weight:800">'+p.stok+' pcs</span></div>').join(''):'<div class="note" style="padding:8px 0">Tidak ada notifikasi stok.</div>';
 }
 function boot(){render();setInterval(render,3000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()})}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
