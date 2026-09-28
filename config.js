// Konfigurasi Supabase untuk aplikasi browser.
// Hanya gunakan publishable/anon key. Jangan pernah menaruh service_role/secret key di file ini.
window.APP_CONFIG={
  url:'https://geoedddgvzvqsykuekdw.supabase.co',
  key:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdlb2VkZGRndnp2cXN5a3Vla2R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwODM3MjAsImV4cCI6MjEwNTY1OTcyMH0.DKaoJbKparsGc9_WEQ_jefQVJl5raNgPGckbw9UVoNI'
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
 const ss=Array.isArray(sales)?sales:[];
 const ps=Array.isArray(purchases)?purchases:[];
 const sr=Array.isArray(saleReturns)?saleReturns:[];
 const pr=Array.isArray(purchaseReturns)?purchaseReturns:[];
 document.getElementById('returnSaleCount').textContent=sr.length;
 document.getElementById('returnPurchaseCount').textContent=pr.length;
 saleList.innerHTML=ss.map(s=>{
   const returned=sr.filter(r=>r.sale_id===s.id).reduce((a,r)=>a+Number(r.total||0),0);
   const items=(Array.isArray(saleItems)?saleItems:[]).filter(i=>i.sale_id===s.id);
   const remaining=items.reduce((sum,i)=>{
     const used=(Array.isArray(saleReturnItems)?saleReturnItems:[]).filter(r=>r.sale_item_id===i.id).reduce((a,r)=>a+Number(r.qty||0),0);
     return sum+Math.max(0,Number(i.qty||0)-used);
   },0);
   return '<tr><td>'+esc(s.created_at?new Date(s.created_at).toLocaleDateString('id-ID'):'-')+'</td><td><b>'+esc(s.nomor_transaksi||s.id)+'</b></td><td>'+rp(Math.max(0,Number(s.total||0)-returned))+'</td><td>'+rp(s.dibayar||0)+'</td><td><button class="btn danger" type="button" '+(remaining<=0?'disabled':'')+' onclick="openSaleReturn(&quot;'+escAttr(s.id)+'&quot;)">'+(remaining>0?'↩ Retur':'✓ Sudah Diretur')+'</button></td></tr>';
 }).join('')||'<tr><td colspan="5" class="note">Belum ada transaksi penjualan.</td></tr>';
 purchaseList.innerHTML=ps.map(p=>{
   const returned=pr.filter(r=>r.purchase_id===p.id).reduce((a,r)=>a+Number(r.total||0),0);
   const items=(Array.isArray(purchaseItems)?purchaseItems:[]).filter(i=>i.purchase_id===p.id);
   const remaining=items.reduce((sum,i)=>{
     const used=(Array.isArray(purchaseReturnItems)?purchaseReturnItems:[]).filter(r=>r.purchase_item_id===i.id).reduce((a,r)=>a+Number(r.qty||0),0);
     return sum+Math.max(0,Number(i.qty||0)-used);
   },0);
   return '<tr><td>'+esc(p.tanggal||'-')+'</td><td><b>'+esc(p.nomor_pembelian||p.id)+'</b></td><td>'+esc(p.supplier||'-')+'</td><td>'+rp(Math.max(0,Number(p.total||0)-returned))+'</td><td><button class="btn danger" type="button" '+(remaining<=0?'disabled':'')+' onclick="openPurchaseReturn(&quot;'+escAttr(p.id)+'&quot;)">'+(remaining>0?'↩ Retur':'✓ Sudah Diretur')+'</button></td></tr>';
 }).join('')||'<tr><td colspan="5" class="note">Belum ada pembelian.</td></tr>';
}