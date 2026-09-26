const APP_VERSION='1.0.19';
const UPDATE_MANIFEST_URL=new URL('update.json',location.href).href;
const WINDOWS_UPDATE_MANIFEST_URL=new URL('windows-update.json',location.href).href;
const UPDATE_MANIFEST_FALLBACK='https://raw.githubusercontent.com/lussaldesign-code/TokoKasirHerbal/main/update.json';
const WINDOWS_UPDATE_MANIFEST_FALLBACK='https://raw.githubusercontent.com/lussaldesign-code/TokoKasirHerbal/main/windows-update.json';
const IS_ELECTRON=!!(navigator.userAgent&&/Electron/i.test(navigator.userAgent));
const WEB_VERSION_URL=new URL('web-version.json',location.href).href;
const CONFIG=window.APP_CONFIG||{url:'',key:''};
let sb=null,currentUser=null,profile=null,products=[],agents=[],receivables=[],sales=[],saleItems=[],saleReturnItems=[],receivablePayments=[],users=[],purchases=[],purchaseItems=[],purchaseReturnItems=[],saleReturns=[],purchaseReturns=[],cart=[],purchaseCart=[],priceProduct=null,selectedProductImage='';
let catalogRacks=[];
const $=id=>document.getElementById(id),rp=n=>'Rp '+Number(n||0).toLocaleString('id-ID');
let soundEnabled=localStorage.getItem('tokokasirlussal-sound')!=='off';
let audioCtx=null;
function ensureAudio(){try{if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();return audioCtx}catch(e){return null}}
function playUiSound(type='click'){
  if(!soundEnabled)return;
  const ctx=ensureAudio();if(!ctx)return;
  const now=ctx.currentTime;
  const cfg=type==='success'?{f:720,d:.09,v:.045}:type==='error'?{f:180,d:.13,v:.05}:{f:420,d:.045,v:.028};
  try{
    const osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type='sine';osc.frequency.setValueAtTime(cfg.f,now);
    if(type==='success')osc.frequency.exponentialRampToValueAtTime(980,now+cfg.d);
    if(type==='error')osc.frequency.exponentialRampToValueAtTime(120,now+cfg.d);
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(cfg.v,now+.008);gain.gain.exponentialRampToValueAtTime(.0001,now+cfg.d);
    osc.connect(gain);gain.connect(ctx.destination);osc.start(now);osc.stop(now+cfg.d+.02);
  }catch(e){}
}
function toggleUiSound(){
  soundEnabled=!soundEnabled;
  localStorage.setItem('tokokasirlussal-sound',soundEnabled?'on':'off');
  toast(soundEnabled?'🔊 Suara klik aktif':'🔇 Suara klik dimatikan');
  if(soundEnabled)playUiSound('success');
}
document.addEventListener('pointerdown',e=>{
  const target=e.target.closest('button,.nav,.btn,select,[role="button"]');
  if(target&&!target.disabled)playUiSound('click');
},{passive:true});
function toast(m){$('toast').textContent=m;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),3000)}
function requireConfig(){if(!CONFIG.url||!CONFIG.key){toast('Isi config.js dengan Supabase URL dan publishable/anon key.');throw Error('Supabase config belum diisi')}}
async function ensureSession(){requireConfig();if(!sb)sb=supabase.createClient(CONFIG.url,CONFIG.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'tokokasirlussal-auth'}});let s=await sb.auth.getSession();if(s.error)throw s.error;const existing=s.data?.session;if(existing?.user?.is_anonymous===true)return existing;if(existing){await sb.auth.signOut({scope:'local'});}let r=await sb.auth.signInAnonymously();if(r.error)throw Error('Login otomatis Supabase gagal: '+r.error.message);if(!r.data?.session)throw Error('Supabase tidak mengembalikan sesi.');return r.data.session}
let loginMode='kasir';
function setLoginMode(mode){loginMode=mode;const isAdmin=mode==='admin';$('loginKasirBtn')?.classList.toggle('primary',!isAdmin);$('loginKasirBtn')?.classList.toggle('secondary',isAdmin);$('loginAdminBtn')?.classList.toggle('primary',isAdmin);$('loginAdminBtn')?.classList.toggle('secondary',!isAdmin);$('usernameField')?.classList.remove('hidden');$('pinField')?.classList.toggle('hidden',!isAdmin);if($('usernameLabel'))$('usernameLabel').textContent=isAdmin?'Username Admin':'Username Kasir';if($('username'))$('username').placeholder=isAdmin?'Masukkan username admin':'Masukkan username kasir';if($('loginTitle'))$('loginTitle').textContent=isAdmin?'Login Admin':'Login Kasir';if($('loginHint'))$('loginHint').textContent=isAdmin?'Masukkan username admin dan PIN 4 angka.':'Masukkan username kasir untuk masuk.';if(isAdmin)$('pin')?.focus();else $('username')?.focus()}
async function login(){try{const pin=($('pin')?.value||'').trim(),username=($('username')?.value||'').trim().toLowerCase();if(!username)return toast(loginMode==='admin'?'Masukkan username admin terlebih dahulu.':'Masukkan username kasir terlebih dahulu.');if(loginMode==='admin'&&!/^[0-9]{4}$/.test(pin))return toast('PIN admin harus tepat 4 angka.');let session=await ensureSession();currentUser=session.user;let result=loginMode==='admin'?await sb.rpc('kiosk_login_pin',{p_username:username,p_pin:pin}):await sb.rpc('kiosk_login_cashier',{p_username:username});if(result.error&&/JWT|session|anonymous|not authenticated/i.test(result.error.message||'')){await sb.auth.signOut();session=await ensureSession();currentUser=session.user;result=loginMode==='admin'?await sb.rpc('kiosk_login_pin',{p_username:username,p_pin:pin}):await sb.rpc('kiosk_login_cashier',{p_username:username});}if(result.error)throw result.error;const data=result.data;if(!data?.length)throw Error('Akun tidak ditemukan atau tidak aktif.');const account=data[0];if(loginMode==='admin'&&account.role!=='admin')throw Error('Akun ini bukan akun admin.');if(loginMode==='kasir'&&account.role==='admin')throw Error('Gunakan tombol Login Admin.');const prof=await sb.rpc('kiosk_profile',{p_username:account.username});if(prof.error)throw prof.error;if(!prof.data?.length)throw Error('Profil akun belum tersedia.');profile=prof.data[0];profile.auth_user_id=currentUser.id;if(!profile.aktif)throw Error('Akun tidak aktif.');localStorage.setItem('tokokasirlussal-username',profile.username);showApp();try{await loadAll()}catch(loadErr){console.error('loadAll after login',loadErr);toast('Login berhasil, tetapi data belum dapat dimuat: '+(loadErr?.message||'periksa data Supabase'));}}catch(e){console.error('login',e);const m=String(e?.message||e);if(/anonymous|disabled|sign.?in/i.test(m))toast('Login otomatis Supabase gagal. Aktifkan Anonymous Sign-Ins di Supabase Authentication.');else toast(m||'Login gagal')}}
async function loadProfileByUsername(username){const {data,error}=await sb.rpc('kiosk_profile',{p_username:username});if(error)throw error;if(!data?.length)throw Error('Profil akun belum tersedia.');profile=data[0]}
async function restoreLogin(){showLogin()}
async function logout(){try{localStorage.removeItem('tokokasirlussal-username');if(sb)await sb.auth.signOut()}finally{location.reload()}}
async function loadProfile(){if(!currentUser?.id)throw Error('Sesi login tidak valid.');const {data,error}=await sb.from('users').select('*').eq('auth_user_id',currentUser.id).maybeSingle();if(error)throw error;if(!data)throw Error('Profile pengguna belum dibuat di public.users.');profile=data}
function showLogin(){document.body.classList.add('login-screen');document.body.classList.remove('app-screen','mobile-sheet-open');$('app')?.classList.add('hidden');$('app')?.setAttribute('aria-hidden','true');$('login')?.classList.remove('hidden');$('login')?.removeAttribute('aria-hidden')}
function showApp(){document.body.classList.remove('login-screen');document.body.classList.add('app-screen');$('login')?.classList.add('hidden');$('login')?.setAttribute('aria-hidden','true');$('app')?.classList.remove('hidden');$('app')?.removeAttribute('aria-hidden');const admin=String(profile?.role||'').toLowerCase()==='admin';document.documentElement.dataset.userRole=admin?'admin':'cashier';document.body.dataset.userRole=admin?'admin':'cashier';if($('activeUser'))$('activeUser').textContent=(admin?'Admin':'Kasir')+' Aktif: '+(profile?.nama||profile?.username||'-');updateAccountView();showAppVersion();['navAgen','navPiutang','navPembelian','navLaporan','navAkun'].forEach(id=>{const el=$(id);if(el)el.style.setProperty('display',admin?'flex':'none','important')});if($('addProductBtn'))$('addProductBtn').style.setProperty('display',admin?'block':'none','important');if($('addAgentBtn'))$('addAgentBtn').style.setProperty('display',admin?'block':'none','important');if(!admin){document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));$('tab-dashboard')?.classList.add('active');document.querySelectorAll('.nav').forEach(x=>x.classList.remove('active'));document.querySelector('.nav[onclick*="tab(\'dashboard\'"]')?.classList.add('active')}}
/* TOKOKASIRLUSSAL_MOBILE_SWIPE_V2 */
const _originalTab=tab;
tab=function(name,el){
 const ok=_originalTab(name,el);
 if(ok && window.innerWidth<=800){
   const target=$('tab-'+name);
   if(target){target.scrollTop=0; target.scrollLeft=0;}
   document.querySelector('.main')?.scrollTo({top:0,left:0,behavior:'instant'});
 }
 return ok;
};
/* TOKOKASIRLUSSAL_MOBILE_SWIPE_V1 */
const MOBILE_TAB_ORDER=['dashboard','kasir','agen','piutang','pembelian','laporan','akun'];
let mobileSwipeStartX=0,mobileSwipeStartY=0,mobileSwipeTracking=false;
function mobileVisibleTabs(){
  return MOBILE_TAB_ORDER.filter(name=>{
    const section=$('tab-'+name), nav=[...document.querySelectorAll('.nav')].find(x=>(x.getAttribute('onclick')||'').includes("tab('"+name+"'"));
    return !!section && !!nav && !section.classList.contains('hidden') && getComputedStyle(nav).display!=='none';
  });
}
function mobileGoBySwipe(direction){
  if(window.innerWidth>800)return;
  const current=document.querySelector('.tab.active')?.id?.replace(/^tab-/,'')||'dashboard';
  const list=mobileVisibleTabs(),idx=list.indexOf(current);
  if(idx<0)return;
  const next=list[idx+direction];
  if(!next)return;
  const nav=[...document.querySelectorAll('.nav')].find(x=>(x.getAttribute('onclick')||'').includes("tab('"+next+"'"));
  if(tab(next,nav)){
    const target=$('tab-'+next);
    if(target){target.classList.remove('mobile-slide-next','mobile-slide-prev');void target.offsetWidth;target.classList.add(direction>0?'mobile-slide-next':'mobile-slide-prev');setTimeout(()=>target.classList.remove('mobile-slide-next','mobile-slide-prev'),260);}
    history.replaceState(null,'','#'+next);
  }
}
function setupMobileSwipe(){
  const main=$('.main')||$('app');
  if(!main||main.dataset.mobileSwipeReady==='1')return;
  main.dataset.mobileSwipeReady='1';
  main.addEventListener('touchstart',e=>{
    if(window.innerWidth>800)return;
    const t=e.changedTouches?.[0];if(!t)return;
    if(e.target.closest('input,select,textarea,button,.modal,.cartbody,.tablebox')){mobileSwipeTracking=false;return;}
    mobileSwipeStartX=t.clientX;mobileSwipeStartY=t.clientY;mobileSwipeTracking=true;
  },{passive:true});
  main.addEventListener('touchend',e=>{
    if(!mobileSwipeTracking||window.innerWidth>800)return;
    mobileSwipeTracking=false;
    const t=e.changedTouches?.[0];if(!t)return;
    const dx=t.clientX-mobileSwipeStartX,dy=t.clientY-mobileSwipeStartY;
    if(Math.abs(dx)<65||Math.abs(dx)<Math.abs(dy)*1.35)return;
    mobileGoBySwipe(dx<0?1:-1);
  },{passive:true});
}
function setupMobileTabState(){
  setupMobileSwipe();
  const hash=location.hash.replace('#','');
  if(window.innerWidth<=800 && MOBILE_TAB_ORDER.includes(hash)){
    const nav=[...document.querySelectorAll('.nav')].find(x=>(x.getAttribute('onclick')||'').includes("tab('"+hash+"'"));
    tab(hash,nav);
  }
}

function isAdminOnlyTab(name){return ['agen','piutang','pembelian','laporan','akun'].includes(name)}
function tab(name,el){const target=$('tab-'+name);if(!target){console.warn('Tab tidak ditemukan:',name);toast('Menu '+name+' belum tersedia.');return false;}if(profile?.role!=='admin'&&isAdminOnlyTab(name)){toast('Menu ini khusus Admin.');return false;}document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));target.classList.add('active');document.querySelectorAll('.nav').forEach(x=>x.classList.remove('active'));el?.classList.add('active');if(name==='akun')refreshReceiptPrinters();return true}
function goDashboardAction(name){const target=$('tab-'+name);if(!target){toast('Menu belum tersedia: '+name);return;}const nav=[...document.querySelectorAll('.nav')].find(x=>(x.getAttribute('onclick')||'').includes("tab('"+name+"'"));tab(name,nav||null);target.scrollIntoView({behavior:'smooth',block:'start'});}
async function loadAll(){
 const required=[
  sb.from('products').select('*').eq('aktif',true).order('nama'),
  sb.from('agents').select('*').eq('aktif',true).order('nama'),
  sb.from('receivables').select('*, agents(nama), sales(nomor_transaksi,created_at)').order('created_at',{ascending:false}),
  sb.from('barang_dibawa').select('*').order('created_at',{ascending:false}),
  sb.from('barang_dibawa_items').select('*').order('created_at',{ascending:false})
 ];
 const results=await Promise.all(required);
 for(const x of results)if(x.error)throw x.error;
 const [p,a,r,bd,bdi]=results;
 products=p.data||[];agents=a.data||[];receivables=r.data||[];barangDibawa=bd.data||[];barangDibawaItems=bdi.data||[];
 await loadDashboardCatalog();
 sales=[];saleItems=[];receivablePayments=[];purchases=[];purchaseItems=[];
 saleReturns=[];saleReturnItems=[];purchaseReturns=[];purchaseReturnItems=[];users=[];

 const common=[
  ['sales',profile?.role==='admin'
    ?sb.from('sales').select('*').order('created_at',{ascending:false}).limit(1000)
    :sb.from('sales').select('*').eq('kasir_id',profile.id).order('created_at',{ascending:false}).limit(500)],
  ['sale_items',sb.from('sale_items').select('*').order('created_at',{ascending:false}).limit(5000)],
  ['sale_returns',sb.from('sale_returns').select('*').order('created_at',{ascending:false}).limit(500)],
  ['sale_return_items',sb.from('sale_return_items').select('*').order('created_at',{ascending:false}).limit(5000)]
 ];
 const adminOnly=profile?.role==='admin'?[
  ['receivable_payments',sb.from('receivable_payments').select('*').order('created_at',{ascending:false}).limit(5000)],
  ['purchases',sb.from('purchases').select('*').order('created_at',{ascending:false}).limit(500)],
  ['purchase_items',sb.from('purchase_items').select('*').order('created_at',{ascending:false}).limit(5000)],
  ['purchase_returns',sb.from('purchase_returns').select('*').order('created_at',{ascending:false}).limit(500)],
  ['purchase_return_items',sb.from('purchase_return_items').select('*').order('created_at',{ascending:false}).limit(5000)],
  ['users',sb.from('users').select('id,username,nama,role,aktif,created_at,updated_at,auth_user_id').order('nama')]
 ]:[];
 const optional=[...common,...adminOnly];
 const optionalResults=await Promise.all(optional.map(async([name,q])=>{
  try{const x=await q;if(x.error){console.warn('loadAll '+name,x.error);return {data:[]}}return x}
  catch(e){console.warn('loadAll '+name,e);return {data:[]}}
 }));
 const get=n=>optionalResults[optional.findIndex(x=>x[0]===n)]?.data||[];
 sales=get('sales');saleItems=get('sale_items');saleReturns=get('sale_returns');saleReturnItems=get('sale_return_items');
 receivablePayments=get('receivable_payments');purchases=get('purchases');purchaseItems=get('purchase_items');
 purchaseReturns=get('purchase_returns');purchaseReturnItems=get('purchase_return_items');users=get('users');
 renderAll();
}

function changeAmount(){const total=cart.reduce((n,x)=>n+Number(x.harga||0)*Number(x.qty||0),0);const cash=Number($('cash')?.value||0);const el=$('change');if(el)el.textContent=cash>=total&&total>0?'Kembalian: '+rp(cash-total):cash>0?'Kurang: '+rp(Math.max(0,total-cash)):''}
function renderCart(){const el=$('cart');if(!el)return;el.innerHTML=cart.length?cart.map((x,i)=>'<div class="cart-item"><div style="flex:1;min-width:0"><b>'+esc(x.nama)+'</b><small style="display:block;color:#789487">'+esc(x.type_label||'Ecer')+' • '+rp(x.harga)+'</small></div><div style="display:flex;align-items:center;gap:6px"><button class="btn secondary" style="padding:4px 8px" onclick="changeCartQty('+i+',-1)">−</button><b>'+x.qty+'</b><button class="btn secondary" style="padding:4px 8px" onclick="changeCartQty('+i+',1)">+</button><button class="btn secondary" style="padding:4px 8px" onclick="removeCartItem('+i+')">✕</button></div><b style="min-width:85px;text-align:right">'+rp(x.harga*x.qty)+'</b></div>').join(''):'<div class="note">Belum ada produk di keranjang.</div>';const total=cart.reduce((n,x)=>n+Number(x.harga||0)*Number(x.qty||0),0);if($('total'))$('total').textContent=rp(total);changeAmount()}
function changeCartQty(index,delta){if(!cart[index])return;cart[index].qty=Math.max(0,Number(cart[index].qty||0)+delta);if(cart[index].qty===0)cart.splice(index,1);renderCart()}
function removeCartItem(index){if(index<0||!cart[index])return;cart.splice(index,1);renderCart()}
function choosePrice(id){const p=products.find(x=>x.id===id);if(!p)return toast('Produk tidak ditemukan.');priceProduct=p;const btns=$('priceButtons');if(!btns)return;const prices=[['ecer','Harga Ecer',p.harga_ecer],['reseller','Harga Reseller',p.harga_reseller],['agen','Harga Agen',p.harga_agen],['grosir','Harga Grosir',p.harga_grosir]].filter(x=>Number(x[2])>0);$('priceName').textContent='Pilih Harga • '+p.nama;btns.innerHTML=prices.map(x=>'<button type="button" class="price-choice-btn" data-price-type="'+escAttr(x[0])+'"><span>'+esc(x[1])+'</span><b>'+rp(x[2])+'</b></button>').join('');
btns.querySelectorAll('.price-choice-btn').forEach(btn=>btn.addEventListener('click',()=>{addToCart(btn.dataset.priceType);btn.blur()}));openModal('priceModal')}
function paymentChanged(){const metode=$('payment')?.value, cashFields=$('cashFields'), debtFields=$('debtFields');if(!cashFields||!debtFields)return;const isDebt=metode==='piutang';cashFields.classList.toggle('hidden',isDebt);debtFields.classList.toggle('hidden',!isDebt);if(isDebt){fillAgentSelect();$('cash').value='';$('change').textContent='';}else{$('dp').value='';$('agentForSale').value='';changeAmount()}}
function addToCart(type){if(!priceProduct)return toast('Produk belum dipilih.');const map={ecer:['Harga Ecer','harga_ecer'],reseller:['Harga Reseller','harga_reseller'],agen:['Harga Agen','harga_agen'],grosir:['Harga Grosir','harga_grosir']};const cfg=map[type]||map.ecer;const harga=Number(priceProduct[cfg[1]]||0);if(harga<=0)return toast('Harga '+cfg[0]+' belum diatur.');const existing=cart.find(x=>x.id===priceProduct.id&&x.type===type);if(existing)existing.qty++;else cart.push({id:priceProduct.id,nama:priceProduct.nama,harga,qty:1,type,type_label:cfg[0]});closeModal('priceModal');renderCart()}
function renderAll(){syncCategoryControls();renderProducts();renderAgents();renderReceivables();renderReports();renderPurchases();renderReturns();renderUsers();fillAgentSelect();fillPurchaseProducts();renderCart();renderPurchaseCart();renderNotifications();renderBarangDibawa();if(typeof renderReturnsMenu==='function')renderReturnsMenu()}
function renderProducts(){const q=($('search')?.value||'').trim().toLowerCase(),cat=$('category')?.value||'Semua';const list=products.filter(p=>String(p.nama||'').toLowerCase().includes(q)&&(cat==='Semua'||String(p.kategori||'')===cat));const groups=[...new Set(list.map(p=>String(p.kategori||'Produk').trim()||'Produk'))];const el=$('products');if(!el)return;el.innerHTML=groups.map(group=>'<div class="rak"><h3>📦 '+esc(group)+'</h3><div class="grid">'+list.filter(p=>(String(p.kategori||'Produk').trim()||'Produk')===group).map(p=>'<div class="product" data-product-id="'+escAttr(p.id)+'"><button class="edit '+(profile?.role==='admin'?'':'hidden')+'" data-edit-id="'+escAttr(p.id)+'">✏️</button><img src="'+escAttr(p.gambar||'')+'" onerror="this.style.display=\'none\'"><div class="info"><b>'+esc(p.nama)+'</b><div class="price">'+rp(p.harga_ecer)+'</div><div class="stock">Sisa Stok: '+Number(p.stok||0)+'</div></div></div>').join('')+'</div></div>').join('')||'<div class="note">Produk belum tersedia.</div>';el.querySelectorAll('[data-product-id]').forEach(card=>card.addEventListener('click',()=>choosePrice(card.dataset.productId)));el.querySelectorAll('[data-edit-id]').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();openProduct(btn.dataset.editId)}))}

async function testReceiptPrinter(){
  const name=receiptPrinterName()||$('receiptPrinter')?.value;
  if(!name)return toast('Pilih printer Panda terlebih dahulu.');
  const html=buildReceiptHtml({nomor:'TEST-PRINTER',items:[{nama:'Tes printer Panda',qty:1,harga:1000,subtotal:1000}],total:1000,dibayar:1000,kembalian:0,metode:'tunai'});
  try{await window.electronPrinter.printReceipt(html,name);toast('Tes cetak berhasil dikirim ke '+name+'.');}catch(e){console.error(e);toast('Tes printer gagal: '+(e.message||e));}
}
function buildReceiptHtml(s){
  const width='72mm';
  const items=(s.items||[]).map(x=>'<div class="item"><div>'+esc(x.nama)+'</div><div class="line"><span>'+x.qty+' x '+rp(x.harga)+'</span><b>'+rp(x.subtotal)+'</b></div></div>').join('');
  const sisa=Math.max(0,Number(s.total||0)-Number(s.dibayar||0));
  return '<!doctype html><html><head><meta charset="utf-8"><style>@page{size:'+width+' auto;margin:0}body{width:'+width+';margin:0;padding:3mm 2mm;font-family:Arial,sans-serif;font-size:11px;color:#000}.c{text-align:center}.b{font-weight:700}.line{display:flex;justify-content:space-between;gap:6px}.item{margin:5px 0}.sep{border-top:1px dashed #000;margin:7px 0}.big{font-size:14px}.small{font-size:9px}</style></head><body><div class="c b big">MANAJEMEN TOKO KASIR</div><div class="c small">TOKOKASIRLUSSAL</div><div class="sep"></div><div>No: '+esc(s.nomor)+'</div><div>'+new Date().toLocaleString('id-ID')+'</div><div class="sep"></div>'+items+'<div class="sep"></div><div class="line"><span>TOTAL</span><b>'+rp(s.total)+'</b></div><div class="line"><span>DIBAYAR</span><b>'+rp(s.dibayar)+'</b></div>'+(s.metode==='tunai'?'<div class="line"><span>KEMBALIAN</span><b>'+rp(s.kembalian)+'</b></div>':'<div class="line"><span>SISA PIUTANG</span><b>'+rp(sisa)+'</b></div>')+'<div class="sep"></div><div class="c">Terima kasih</div><div class="c small">Struk resmi TokoKasirLussal</div></body></html>';
}
async function printReceipt(s){
  try{
    if(window.electronPrinter?.available){
      const name=receiptPrinterName()||$('receiptPrinter')?.value||'';
      if(!name)return toast('Transaksi berhasil. Pilih printer Panda di Pengaturan untuk mencetak struk.');
      await window.electronPrinter.printReceipt(buildReceiptHtml(s),name);
      toast('Struk berhasil dikirim ke printer.');
      return;
    }
    const win=window.open('','_blank','width=420,height=700');
    if(!win)return toast('Transaksi berhasil. Izinkan pop-up untuk mencetak struk.');
    win.document.write(buildReceiptHtml(s).replace('</body>','<script>window.onload=()=>setTimeout(()=>window.print(),150)<\\/script></body>'));
    win.document.close();
  }catch(e){console.error('printReceipt',e);toast('Transaksi berhasil, tetapi cetak gagal: '+(e.message||e));}
}
async function checkout(){try{if(!cart.length)return toast('Keranjang kosong.');const cartSnapshot=cart.map(x=>({...x}));const total=cartSnapshot.reduce((a,x)=>a+x.harga*x.qty,0),metode=$('payment').value,dibayar=metode==='tunai'?Number($('cash').value||0):Number($('dp').value||0),agent=metode==='piutang'?$('agentForSale').value:null;if(metode==='tunai'&&dibayar<total)return toast('Uang tunai kurang.');if(metode==='piutang'&&!agent)return toast('Pilih agen.');const {data,error}=await sb.rpc('create_sale',{p_kasir_id:profile.id,p_agent_id:agent||null,p_metode:metode,p_dibayar:dibayar,p_items:cartSnapshot.map(x=>({product_id:x.id,qty:x.qty,tipe_harga:x.type}))});if(error)throw error;toast('Transaksi '+data.nomor_transaksi+' berhasil.');
    const cetak=confirm('Transaksi berhasil.\n\nNomor: '+data.nomor_transaksi+'\nTotal: '+rp(Number(data.total||total))+'\n\nApakah ingin mencetak struk transaksi ini?');
    if(cetak){await printReceipt({nomor:data.nomor_transaksi,items:cartSnapshot,total:Number(data.total||total),dibayar,kembalian:metode==='tunai'?Math.max(0,dibayar-total):0,metode});}
    cart=[];$('cash').value='';$('dp').value='';await loadAll()}catch(e){console.error(e);toast(e.message||'Transaksi gagal')}}
function fillAgentSelect(){$('agentForSale').innerHTML='<option value="">Pilih agen</option>'+agents.map(a=>`<option value="${a.id}">${esc(a.nama)}${a.hp?' — '+esc(a.hp):''}</option>`).join('')}
function renderAgents(){$('agents').innerHTML=agents.map(a=>`<tr><td>${esc(a.nama)}</td><td>${esc(a.hp||'-')}</td><td>${esc(a.alamat||'-')}</td><td>${profile?.role==='admin'?`<button class="btn danger" onclick="deleteAgent('${a.id}')">Hapus</button>`:''}</td></tr>`).join('')}
async function saveAgent(){try{if(profile?.role!=='admin')return toast('Hanya admin yang dapat menambah agen.');const nama=$('aNama').value.trim(),hp=$('aHp').value.trim(),alamat=$('aAlamat').value.trim();if(!nama)return toast('Nama wajib diisi.');const {data,error}=await sb.from('agents').insert({nama,hp,alamat}).select().single();if(error)throw error;if(!data)throw Error('Agen tidak berhasil disimpan.');closeModal('agentModal');$('aNama').value=$('aHp').value=$('aAlamat').value='';await loadAll();toast('Agen berhasil ditambahkan.')}catch(e){console.error('saveAgent',e);toast('Gagal menyimpan agen: '+(e.message||'periksa RLS Supabase'))}}
async function deleteAgent(id){if(profile?.role!=='admin')return toast('Hanya admin yang dapat menghapus agen.');if(!confirm('Nonaktifkan agen ini?'))return;const {data,error}=await sb.from('agents').update({aktif:false}).eq('id',id).select().single();if(error)toast(error.message);else{await loadAll();toast('Agen dinonaktifkan.')}}
function renderReceivables(){$('receivables').innerHTML=receivables.map(r=>`<tr><td>${esc(r.sales?.nomor_transaksi||'-')}</td><td>${esc(r.agents?.nama||'-')}</td><td>${new Date(r.created_at).toLocaleDateString('id-ID')}</td><td>${rp(r.total)}</td><td>${rp(r.dibayar)}</td><td><b style="color:${r.sisa?'var(--danger)':'var(--p)'}">${r.sisa?rp(r.sisa):'LUNAS'}</b></td><td>${r.sisa?`<button class="btn primary" onclick="payDebt('${r.id}',${r.sisa})">Bayar</button>`:''}</td></tr>`).join('')}
async function payDebt(id,sisa){const v=prompt('Nominal pembayaran',String(sisa));if(!v)return;const amount=Number(v);if(!Number.isFinite(amount)||amount<=0)return toast('Nominal pembayaran tidak valid.');try{const {error}=await sb.rpc('pay_receivable',{p_receivable_id:id,p_kasir_id:profile.id,p_jumlah:amount,p_keterangan:'Pembayaran piutang'});if(error)throw error;await loadAll();toast('Pembayaran piutang berhasil.')}catch(e){toast(e.message)}}
function localDay(d=new Date()){const x=new Date(d);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')}
function reportPaymentLabel(s){return s.metode_pembayaran==='piutang'?'Piutang / DP':'Lunas Tunai'}
function renderReports(){
 const now=new Date(),day=localDay(now),month=day.slice(0,7);
 const ss=Array.isArray(sales)?sales:[],si=Array.isArray(saleItems)?saleItems:[];
 const sr=Array.isArray(saleReturns)?saleReturns:[],sri=Array.isArray(saleReturnItems)?saleReturnItems:[];
 const ps=Array.isArray(purchases)?purchases:[],pr=Array.isArray(purchaseReturns)?purchaseReturns:[];
 const pri=Array.isArray(purchaseReturnItems)?purchaseReturnItems:[],rcp=Array.isArray(receivablePayments)?receivablePayments:[];
 const returnBySale={};
 sr.forEach(r=>{returnBySale[r.sale_id]=(returnBySale[r.sale_id]||0)+Number(r.total||0)});
 const returnedSaleIds=new Set(Object.keys(returnBySale));
 const daySales=ss.filter(s=>localDay(s.created_at)===day);
 const monthSales=ss.filter(s=>localDay(s.created_at).slice(0,7)===month);
 const activeDaySales=daySales.filter(s=>!returnedSaleIds.has(s.id));
 const activeMonthSales=monthSales.filter(s=>!returnedSaleIds.has(s.id));
 const paymentNet=s=>Math.max(0,Number(s.dibayar||0)-Number(returnBySale[s.id]||0));
 const income=daySales.reduce((a,s)=>a+paymentNet(s),0)+rcp.filter(p=>localDay(p.created_at)===day).reduce((a,p)=>a+Number(p.jumlah||0),0);
 const mincome=monthSales.reduce((a,s)=>a+paymentNet(s),0)+rcp.filter(p=>localDay(p.created_at).slice(0,7)===month).reduce((a,p)=>a+Number(p.jumlah||0),0);
 const returHari=sr.filter(r=>localDay(r.created_at)===day).reduce((a,r)=>a+Number(r.total||0),0);
 const returBulan=sr.filter(r=>localDay(r.created_at).slice(0,7)===month).reduce((a,r)=>a+Number(r.total||0),0);
 const purchaseHari=ps.filter(p=>localDay(p.created_at||p.tanggal)===day);
 const purchaseBulan=ps.filter(p=>localDay(p.created_at||p.tanggal).slice(0,7)===month);
 const purRetHari=pr.filter(r=>localDay(r.created_at)===day),purRetBulan=pr.filter(r=>localDay(r.created_at).slice(0,7)===month);
 const purGrossHari=purchaseHari.reduce((a,p)=>a+Number(p.total||0),0),purGrossBulan=purchaseBulan.reduce((a,p)=>a+Number(p.total||0),0);
 const purRetHariTotal=purRetHari.reduce((a,r)=>a+Number(r.total||0),0),purRetBulanTotal=purRetBulan.reduce((a,r)=>a+Number(r.total||0),0);
 const purNetHari=Math.max(0,purGrossHari-purRetHariTotal),purNetBulan=Math.max(0,purGrossBulan-purRetBulanTotal);
 const outstanding=(Array.isArray(receivables)?receivables:[]).reduce((a,r)=>a+Number(r.sisa||0),0);
 const returnedQty={},returnedValue={};
 sri.forEach(r=>{returnedQty[r.sale_item_id]=(returnedQty[r.sale_item_id]||0)+Number(r.qty||0);returnedValue[r.sale_item_id]=(returnedValue[r.sale_item_id]||0)+Number(r.subtotal||0)});
 const productMap={};
 daySales.forEach(s=>{
   si.filter(i=>i.sale_id===s.id).forEach(i=>{
     const k=i.product_id||i.nama_produk;
     const q=Math.max(0,Number(i.qty||0)-(returnedQty[i.id]||0));
     const t=Math.max(0,Number(i.subtotal||0)-(returnedValue[i.id]||0));
     if(!productMap[k])productMap[k]={nama:i.nama_produk||'Produk',qty:0,total:0};
     productMap[k].qty+=q;productMap[k].total+=t;
   });
 });
 const itemRows=Object.values(productMap).filter(x=>x.qty!==0||x.total!==0).sort((a,b)=>b.total-a.total);
 const retQtyHari=sri.filter(r=>sr.some(x=>x.id===r.sale_return_id)).reduce((a,r)=>a+Number(r.qty||0),0);
 $('income').textContent=rp(income);
 $('sold').textContent=activeDaySales.length+' transaksi';
 $('stock').textContent=products.reduce((a,p)=>a+Number(p.stok||0),0)+' Pcs';
 if($('monthIncome'))$('monthIncome').textContent=rp(mincome);
 if($('monthSold'))$('monthSold').textContent=activeMonthSales.length+' transaksi';
 // Premium dashboard mirror
 if($('dashIncome'))$('dashIncome').textContent=rp(income);
 if($('dashSold'))$('dashSold').textContent=activeDaySales.length+' transaksi';
 if($('dashStock'))$('dashStock').textContent=products.reduce((a,p)=>a+Number(p.stok||0),0)+' Pcs';
 if($('dashMonthIncome'))$('dashMonthIncome').textContent=rp(mincome);
 renderDashboardCatalog();
 if($('debtTotal'))$('debtTotal').textContent=rp(outstanding);
 if($('cashIncome'))$('cashIncome').textContent=rp(daySales.reduce((a,s)=>a+paymentNet(s),0));
 if($('debtPaymentIncome'))$('debtPaymentIncome').textContent=rp(rcp.filter(p=>localDay(p.created_at)===day).reduce((a,p)=>a+Number(p.jumlah||0),0));
 if($('soldQty'))$('soldQty').textContent=itemRows.reduce((a,x)=>a+x.qty,0)+' Pcs';
 if($('reportDate'))$('reportDate').textContent=now.toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});
 if($('reportReturnSummary'))$('reportReturnSummary').innerHTML='<div class="metric card"><span>Retur Penjualan Hari Ini</span><b>'+rp(returHari)+'</b><small class="note">'+retQtyHari+' Pcs dikembalikan</small></div><div class="metric card"><span>Retur Penjualan Bulan Ini</span><b>'+rp(returBulan)+'</b></div><div class="metric card"><span>Pembelian Bersih Hari Ini</span><b>'+rp(purNetHari)+'</b><small class="note">Bruto '+rp(purGrossHari)+' • Retur '+rp(purRetHariTotal)+'</small></div><div class="metric card"><span>Pembelian Bersih Bulan Ini</span><b>'+rp(purNetBulan)+'</b><small class="note">Bruto '+rp(purGrossBulan)+' • Retur '+rp(purRetBulanTotal)+'</small></div>';

 const userMap=Object.fromEntries((Array.isArray(users)?users:[]).map(u=>[u.id,u]));
 const productNameMap=Object.fromEntries((Array.isArray(products)?products:[]).map(p=>[p.id,p.nama]));
 const saleItemsBySale={};
 si.forEach(i=>{(saleItemsBySale[i.sale_id]||(saleItemsBySale[i.sale_id]=[])).push(i)});
 const transactionProducts=s=>{
   const rows=saleItemsBySale[s.id]||[];
   if(!rows.length)return '—';
   return rows.map(i=>{
     const name=i.nama_produk||productNameMap[i.product_id]||'Produk tidak ditemukan';
     const qty=Number(i.qty||0);
     return esc(name)+(qty>0?' × '+qty:'');
   }).join('<br>');
 };
 const transactionUser=s=>esc(userMap[s.kasir_id]?.nama||userMap[s.kasir_id]?.username||(s.kasir_id===profile?.id?(profile?.nama||profile?.username):'—'));

 const salesEl=$('sales');
 if(salesEl)salesEl.innerHTML=activeDaySales.map(s=>{
   const ag=agents.find(a=>a.id===s.agent_id);
   const total=Number(s.total||0),paid=paymentNet(s);
   return '<tr><td>'+new Date(s.created_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})+'</td><td><b>'+esc(s.nomor_transaksi)+'</b></td><td>'+transactionProducts(s)+'</td><td>'+transactionUser(s)+'</td><td>'+esc(ag?.nama||'Umum')+'</td><td>'+rp(total)+'</td><td>'+rp(paid)+'</td><td>'+esc(reportPaymentLabel(s))+'</td></tr>';
 }).join('')||'<tr><td colspan="8" class="note">Belum ada penjualan aktif hari ini.</td></tr>';

 if($('monthlySales'))$('monthlySales').innerHTML=activeMonthSales.map(s=>{
   const total=Number(s.total||0),paid=paymentNet(s);
   return '<tr><td>'+new Date(s.created_at).toLocaleDateString('id-ID')+'</td><td>'+esc(s.nomor_transaksi)+'</td><td>'+transactionProducts(s)+'</td><td>'+transactionUser(s)+'</td><td>'+rp(total)+'</td><td>'+rp(paid)+'</td><td>'+esc(reportPaymentLabel(s))+'</td></tr>';
 }).join('')||'<tr><td colspan="7" class="note">Belum ada penjualan aktif bulan ini.</td></tr>';

 if($('soldProducts'))$('soldProducts').innerHTML=itemRows.map((x,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(x.nama)+'</td><td>'+x.qty+'</td><td>'+rp(x.total)+'</td></tr>').join('')||'<tr><td colspan="4" class="note">Belum ada produk terjual hari ini.</td></tr>';

 if($('paymentRows')){
   const rows=[
     ...daySales.map(s=>({tanggal:s.created_at,nomor:s.nomor_transaksi,keterangan:returnBySale[s.id]?'Penjualan bersih setelah retur '+s.nomor_transaksi:'Pembayaran transaksi '+s.nomor_transaksi,jumlah:paymentNet(s)})),
     ...rcp.filter(p=>localDay(p.created_at)===day).map(p=>({tanggal:p.created_at,nomor:'Piutang',keterangan:p.keterangan||'Pembayaran piutang',jumlah:Number(p.jumlah||0)}))
   ].filter(x=>x.jumlah!==0).sort((a,b)=>new Date(b.tanggal)-new Date(a.tanggal));
   $('paymentRows').innerHTML=rows.map(x=>'<tr><td>'+new Date(x.tanggal).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})+'</td><td>'+esc(x.nomor)+'</td><td>'+esc(x.keterangan)+'</td><td>'+rp(x.jumlah)+'</td></tr>').join('')||'<tr><td colspan="4" class="note">Belum ada penerimaan aktif hari ini.</td></tr>';
 }
}
function versionParts(v){return String(v||'0').replace(/^v/i,'').split('.').map(x=>parseInt(x,10)||0)}
function isNewerVersion(latest,current){const a=versionParts(latest),b=versionParts(current);for(let i=0;i<3;i++){if((a[i]||0)>(b[i]||0))return true;if((a[i]||0)<(b[i]||0))return false}return false}
async function fetchUpdateManifest(primaryUrl,fallbackUrl){
  const urls=[primaryUrl,fallbackUrl].filter(Boolean);
  let lastError=null;
  for(const url of urls){
    try{
      const res=await fetch(url+'?t='+Date.now(),{cache:'no-store',headers:{'Cache-Control':'no-cache','Pragma':'no-cache'}});
      if(!res.ok){lastError=Error('HTTP '+res.status);continue;}
      const data=await res.json();
      if(data&&data.version)return data;
      lastError=Error('Manifest update tidak valid.');
    }catch(e){lastError=e;}
  }
  throw lastError||Error('Manifest update tidak dapat diakses.');
}
function setUpdateModal(state, info={}){
  const modal=$('updateModal'); if(!modal)return;
  const title=$('updateTitle'),msg=$('updateMessage'),cur=$('updateCurrentVersion'),latest=$('updateLatestVersion');
  const actions=$('updateActions'),progress=$('updateProgressWrap'),accept=$('updateAcceptBtn'),later=$('updateLaterBtn');
  const icon=$('updateIcon');
  if(cur)cur.textContent='v'+APP_VERSION;
  if(latest)latest.textContent=info.version?'v'+info.version:'-';
  if(state==='available'){
    if(title)title.textContent='Update tersedia';
    if(msg)msg.textContent='Versi baru TokoKasirLussal tersedia. Pilih Setuju untuk mulai mengunduh, atau Nanti jika ingin melanjutkan nanti.';
    if(icon)icon.textContent='↻';
    if(actions)actions.classList.remove('hidden');
    if(progress)progress.classList.add('hidden');
    if(accept){accept.disabled=false;accept.textContent='Setuju & Download'}
    if(later){later.disabled=false;later.textContent='Nanti'}
  }else if(state==='downloading'){
    if(title)title.textContent='Mengunduh update...';
    if(msg)msg.textContent='Update sedang diunduh. Aplikasi tetap dapat digunakan selama proses berlangsung.';
    if(icon)icon.textContent='↓';
    if(actions)actions.classList.add('hidden');
    if(progress)progress.classList.remove('hidden');
  }else if(state==='done'){
    if(title)title.textContent='Download selesai';
    if(msg)msg.textContent=IS_ELECTRON?'Installer sudah diunduh. Jalankan installer untuk memasang versi terbaru.':'File APK sudah diunduh. Buka file APK untuk memasang versi terbaru.';
    if(icon)icon.textContent='✓';
    if(progress)progress.classList.remove('hidden');
    if(actions)actions.classList.remove('hidden');
    if(accept){accept.textContent=IS_ELECTRON?'Buka Installer':'Buka APK';accept.disabled=false;accept.onclick=async()=>{if(IS_ELECTRON&&window.electronUpdater?.openDownloaded&&window.__downloadedUpdatePath){await window.electronUpdater.openDownloaded(window.__downloadedUpdatePath)}else if(info.url){window.open(info.url,'_blank')}}}
    if(later){later.textContent='Tutup';later.disabled=false}
  }
  modal.classList.add('show');modal.setAttribute('aria-hidden','false');
}
function closeUpdateModal(){const m=$('updateModal');if(!m)return;m.classList.remove('show');m.setAttribute('aria-hidden','true');}
function updateProgress(percent,label,detail){
  const p=Math.max(0,Math.min(100,Number(percent)||0));
  const bar=$('updateProgressBar'),pct=$('updateProgressPercent'),lab=$('updateProgressLabel'),det=$('updateProgressDetail');
  if(bar)bar.style.width=p+'%';if(pct)pct.textContent=Math.round(p)+'%';if(lab)lab.textContent=label||'Mengunduh...';if(det)det.textContent=detail||'Mohon tunggu, jangan tutup aplikasi.';
}
if(window.electronUpdater?.onProgress){window.electronUpdater.onProgress(data=>{if(data?.total)updateProgress((data.received/data.total)*100,'Mengunduh update...',((data.received/1048576).toFixed(1)+' / '+(data.total/1048576).toFixed(1)+' MB'));else updateProgress(15,'Mengunduh update...','Data sedang diunduh...')});}
async function downloadUpdateFile(url){
  if(IS_ELECTRON && window.electronUpdater?.download){
    return await window.electronUpdater.download(url);
  }
  const res=await fetch(url,{cache:'no-store'});
  if(!res.ok)throw Error('Download gagal (HTTP '+res.status+').');
  const total=Number(res.headers.get('content-length')||0);
  if(!res.body){
    const blob=await res.blob(); const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=url.split('/').pop()||'TokoKasirLussal-update';a.click();return {ok:true};
  }
  const reader=res.body.getReader();const chunks=[];let received=0;
  while(true){
    const {done,value}=await reader.read();if(done)break;
    chunks.push(value);received+=value.byteLength;
    updateProgress(total?(received/total*100):Math.min(95,received/1000000),'Mengunduh update...',total?((received/1048576).toFixed(1)+' / '+(total/1048576).toFixed(1)+' MB'):'Data sedang diunduh...');
  }
  const blob=new Blob(chunks);const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=url.split('/').pop()||'TokoKasirLussal-update';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),30000);return {ok:true};
}
async function startUpdateDownload(){
  if(!window.__latestUpdateInfo?.url)return toast('Link update tidak tersedia.');
  const info=window.__latestUpdateInfo;
  const accept=$('updateAcceptBtn');if(accept){accept.disabled=true;accept.textContent='Mengunduh...'}
  setUpdateModal('downloading',info);updateProgress(0,'Menyiapkan download...','Menghubungkan ke server update...');
  try{
    const result=await downloadUpdateFile(info.url);
    window.__downloadedUpdatePath=result?.path||'';
    updateProgress(100,'Download selesai','File update sudah tersimpan di perangkat.');
    setUpdateModal('done',info);
    if(!IS_ELECTRON)toast('Update berhasil diunduh. Buka APK untuk memasangnya.');
  }catch(e){
    console.error('downloadUpdateFile',e);
    closeUpdateModal();toast('Gagal mengunduh update: '+(e.message||'periksa koneksi internet.'));
  }
}
async function checkForUpdate(){
  const btn=$('checkUpdateBtn');
  if(btn){btn.disabled=true;btn.textContent='⏳ Mengecek...'}
  try{
    const primary=IS_ELECTRON?WINDOWS_UPDATE_MANIFEST_URL:UPDATE_MANIFEST_URL;
    const fallback=IS_ELECTRON?WINDOWS_UPDATE_MANIFEST_FALLBACK:UPDATE_MANIFEST_FALLBACK;
    let info=null;
    try{info=await fetchUpdateManifest(primary,fallback);}
    catch(manifestError){
      console.warn('[updater] manifest fetch failed, trying GitHub Releases API',manifestError);
      const api='https://api.github.com/repos/lussaldesign-code/TokoKasirHerbal/releases/latest?t='+Date.now();
      const rr=await fetch(api,{cache:'no-store',headers:{Accept:'application/vnd.github+json'}});
      if(!rr.ok)throw Error('Server update tidak dapat dihubungi (HTTP '+rr.status+').');
      const rel=await rr.json();const latestRel=String(rel.tag_name||'').replace(/^v/i,'');const assets=Array.isArray(rel.assets)?rel.assets:[];
      const asset=assets.find(x=>IS_ELECTRON?/Setup-[0-9].*\.exe$/i.test(x.name):/\.apk$/i.test(x.name));
      info={version:latestRel,installer:asset?.browser_download_url||'',apk:asset?.browser_download_url||''};
    }
    const latest=String(info?.version||'').trim();const url=String(IS_ELECTRON?(info?.installer||''):(info?.apk||''));
    if(!latest)throw Error('Versi update tidak valid atau server update belum tersedia.');
    if(isNewerVersion(latest,APP_VERSION)){
      const finalInfo={...info,version:latest,url:url||'https://github.com/lussaldesign-code/TokoKasirLussal/releases/latest'};
      window.__latestUpdateInfo=finalInfo;
      setUpdateModal('available',finalInfo);
      return;
    }
    toast('Aplikasi sudah versi terbaru (v'+APP_VERSION+'). Server mendeteksi v'+latest+'.');
  }catch(e){console.error('checkForUpdate',e);toast('Gagal mengecek update: '+(e.message||'periksa koneksi internet.'))}
  finally{if(btn){btn.disabled=false;btn.textContent='🔄 Cek Update'}}
}
async function checkRemoteWebUpdate(){
  try{
    const res=await fetch(WEB_VERSION_URL+'?t='+Date.now(),{cache:'no-store',headers:{'Cache-Control':'no-cache','Pragma':'no-cache'}});
    if(!res.ok)return;
    const info=await res.json();
    const remote=String(info?.commit||info?.version||'').trim();
    if(!remote)return;
    const key='tokokasirlussal-web-build';
    const local=localStorage.getItem(key);
    if(!local){localStorage.setItem(key,remote);return;}
    if(local===remote)return;
    localStorage.setItem(key,remote);
    if('serviceWorker' in navigator){
      try{const reg=await navigator.serviceWorker.getRegistration();if(reg)await reg.update();}catch(e){console.warn('service worker update',e)}
    }
    toast('🔄 Versi web terbaru tersedia. Aplikasi diperbarui otomatis...');
    setTimeout(()=>location.reload(),900);
  }catch(e){console.warn('remote web update check',e)}
}
function showAppVersion(){const el=$('appVersion');if(el)el.textContent='Versi '+APP_VERSION}
function updateAccountView(){const w=$('accountWelcome'),em=$('accountEmail'),ei=$('accountEmailInput');if(w)w.textContent=(profile?.nama||'Akun')+' (@'+(profile?.username||'-')+')';if(em)em.textContent='Login: '+(profile?.username||'-');if(ei)ei.value='Username: '+(profile?.username||'-')}
let barangDibawa=[];let barangDibawaItems=[];let carryCart=[];let carryEditingId=null;
let stockNotificationState={};
try{stockNotificationState=JSON.parse(localStorage.getItem('tokokasir_stock_notice_state')||'{}')}catch(e){stockNotificationState={}}
let dashboardCatalog=[];
function defaultDashboardCatalog(){return products.slice(0,4).map(p=>p.id)}
async function loadDashboardCatalog(){try{const {data,error}=await sb.rpc('kiosk_get_dashboard_catalog');if(error)throw error;const saved=Array.isArray(data)?data.filter(Boolean):[];dashboardCatalog=saved.filter(id=>products.some(p=>p.id===id));if(!dashboardCatalog.length)dashboardCatalog=defaultDashboardCatalog();if(!saved.length&&profile?.role==='admin')await saveDashboardCatalog()}catch(e){console.warn('loadDashboardCatalog',e);dashboardCatalog=defaultDashboardCatalog()}}
async function saveDashboardCatalog(){const {error}=await sb.rpc('kiosk_save_dashboard_catalog',{p_catalog:dashboardCatalog});if(error)throw error}
function renderCatalogSettings(){const el=$('catalogSettingsList');if(!el)return;el.innerHTML=products.map(p=>{const on=dashboardCatalog.includes(p.id),pid=escAttr(p.id);return '<label class="catalog-product-option '+(on?'selected':'')+'"><input type="checkbox" '+(on?'checked':'')+' data-catalog-id="'+pid+'"><img src="'+escAttr(p.gambar||'')+'"><span><b>'+esc(p.nama)+'</b><small>'+rp(p.harga_ecer)+' • Stok '+p.stok+'</small></span><em>'+((dashboardCatalog.indexOf(p.id)+1)||'')+'</em></label>'}).join('')||'<div class="note">Belum ada produk.</div>';el.querySelectorAll('input[data-catalog-id]').forEach(input=>input.addEventListener('change',()=>toggleDashboardCatalog(input.dataset.catalogId,input.checked)))}
function openCatalogSettings(){if(profile?.role!=='admin')return toast('Hanya admin yang dapat mengatur katalog dashboard.');renderCatalogSettings();openModal('catalogModal')}
async function toggleDashboardCatalog(id,checked){try{if(checked){if(!dashboardCatalog.includes(id))dashboardCatalog.push(id)}else dashboardCatalog=dashboardCatalog.filter(x=>x!==id);await saveDashboardCatalog();renderCatalogSettings();renderDashboardCatalog();toast(checked?'Produk ditambahkan ke Katalog Produk Baru.':'Produk dihapus dari Katalog Produk Baru.')}catch(e){toast('Gagal menyimpan katalog: '+(e.message||e))}}
function renderDashboardCatalog(){const dp=$('dashboardProducts');if(!dp)return;const list=dashboardCatalog.map(id=>products.find(p=>p.id===id)).filter(Boolean);dp.innerHTML=list.map(p=>'<div class="product" data-product-id="'+escAttr(p.id)+'"><img src="'+escAttr(p.gambar||'')+'"><div class="info"><b>'+esc(p.nama)+'</b><div class="price">'+rp(p.harga_ecer)+'</div><div class="stock">Sisa Stok: '+p.stok+'</div></div></div>').join('')||'<div class="note">Belum ada produk di katalog. Admin dapat mengaturnya dengan ikon ⚙️.</div>';dp.querySelectorAll('[data-product-id]').forEach(card=>card.addEventListener('click',()=>choosePrice(card.dataset.productId)))}
function syncCategoryControls(selected=''){const cats=[...new Set(products.map(p=>String(p.kategori||'').trim()).filter(Boolean))];const filter=$('category');if(filter){const current=selected||filter.value;filter.innerHTML='<option value="Semua">Semua Kategori</option>'+cats.map(c=>'<option value="'+escAttr(c)+'">'+esc(c)+'</option>').join('');filter.value=cats.includes(current)?current:'Semua'}const rak=$('pKategori');if(rak){const current=selected||rak.value;rak.innerHTML=cats.map(c=>'<option value="'+escAttr(c)+'">'+esc(c)+'</option>').join('');if(current&&cats.includes(current))rak.value=current;else if(cats.length)rak.value=cats[0]}}
function openAccount(){if(!profile)return;if(!$('accountModal'))return toast('Panel akun belum tersedia.');$('accountNama').value=profile.nama||'';$('accountUsername').value=profile.username||'';$('accountEmailInput').value='Username: '+(profile.username||'');openModal('accountModal')}
async function setUserPin(id){if(profile?.role!=='admin')return toast('Hanya admin yang dapat mengubah PIN.');const u=users.find(x=>x.id===id);if(!u||u.role!=='admin')return toast('PIN hanya diperlukan untuk akun admin.');const p=prompt('PIN baru (4 angka) untuk '+u.username);if(p===null)return;if(!/^[0-9]{4}$/.test(p))return toast('PIN admin harus tepat 4 angka.');const {error}=await sb.rpc('admin_set_password',{p_user_id:id,p_pin:p});if(error)toast(error.message);else toast('PIN admin berhasil diubah.')}
function openNewUser(){if(profile?.role!=='admin')return toast('Hanya admin yang dapat menambah akun.');$('newUserNama').value='';$('newUserUsername').value='';$('newUserRole').value='karyawan';syncAccountPinField('karyawan','new');openModal('newUserModal')}
async function saveNewUser(){try{if(profile?.role!=='admin')return toast('Hanya admin yang dapat menambah akun.');const nama=$('newUserNama').value.trim(),username=$('newUserUsername').value.trim().toLowerCase(),role=$('newUserRole').value,pin=role==='admin'?$('newUserPassword').value.trim():'';if(!nama||!username)return toast('Nama dan username wajib diisi.');if(!/^[a-z0-9._-]{3,30}$/.test(username))return toast('Username 3-30 karakter: huruf, angka, titik, garis bawah atau strip.');if(role==='admin'&&!/^[0-9]{4}$/.test(pin))return toast('PIN admin harus tepat 4 angka.');if(role==='karyawan'&&pin)return toast('Kasir tidak menggunakan PIN.');const {error}=await sb.rpc('admin_create_user',{p_username:username,p_nama:nama,p_role:role,p_pin:pin||null});if(error)throw error;closeModal('newUserModal');await loadAll();toast('Akun '+(role==='admin'?'admin':'kasir')+' berhasil dibuat.')}catch(e){console.error('saveNewUser',e);toast('Gagal membuat akun: '+(e.message||'periksa database'))}}
async function saveAccount(){try{const nama=$('accountNama').value.trim(),username=$('accountUsername').value.trim().toLowerCase();if(!nama)return toast('Nama wajib diisi.');if(!/^[a-z0-9._-]{3,30}$/.test(username))return toast('Username 3-30 karakter: huruf, angka, titik, garis bawah atau strip.');const {data,error}=await sb.rpc('kiosk_update_account',{p_nama:nama,p_username:username});if(error)throw error;if(!data?.length)throw Error('Akun tidak berhasil diperbarui.');profile=data[0];localStorage.setItem('tokokasirlussal-username',username);$('activeUser').textContent='Kasir Aktif: '+profile.nama;closeModal('accountModal');updateAccountView();if($('activeUser'))$('activeUser').textContent=(profile?.role==='admin'?'Admin':'Kasir')+' Aktif: '+(profile?.nama||profile?.username||'-');await loadAll();toast('Akun berhasil diperbarui.')}catch(e){console.error('saveAccount',e);toast('Gagal memperbarui akun: '+(e.message||'periksa database'))}}
function renderUsers(){if(profile?.role!=='admin'){$('users').innerHTML='';return}const total=users.length,admins=users.filter(u=>u.role==='admin').length,cashiers=users.filter(u=>u.role!=='admin').length,active=users.filter(u=>u.aktif).length;if($('accountCount'))$('accountCount').textContent=total;if($('adminCount'))$('adminCount').textContent=admins;if($('cashierCount'))$('cashierCount').textContent=cashiers;if($('activeAccountCount'))$('activeAccountCount').textContent=active;$('users').innerHTML=users.map(u=>{const initial=esc((u.nama||u.username||'?').trim().charAt(0).toUpperCase());return `<div class="account-card"><div class="account-card-top"><div class="avatar">${initial}</div><div style="min-width:0;flex:1"><div class="account-name">${esc(u.nama||'-')}</div><div class="account-username">@${esc(u.username||'-')}</div></div></div><div class="account-card-meta"><div><span class="role-pill ${u.role==='admin'?'admin':''}">${u.role==='admin'?'🛡️ Admin':'🛒 Kasir'}</span> <span class="status-pill ${u.aktif?'on':'off'}">${u.aktif?'Aktif':'Nonaktif'}</span></div><div class="account-card-actions"><button class="btn secondary" onclick="openUserEditor('${u.id}')">✏️ Edit</button></div></div></div>`}).join('')||'<div class="note">Belum ada akun.</div>'}
function setAccountRole(prefix,role){const select=$(prefix+'UserRole');if(!select)return;select.value=role;const wrap=$(prefix+'PinWrap'),input=$(prefix+'UserPassword');if(wrap)wrap.classList.toggle('hidden',role!=='admin');if(wrap)wrap.classList.toggle('pin-slide-in',role==='admin');if(input){input.value='';input.disabled=role!=='admin';input.placeholder=role==='admin'?'••••':'Kasir tidak menggunakan PIN';}const modal=$(prefix==='edit'?'userModal':'newUserModal');modal?.querySelectorAll('.role-choice').forEach(b=>b.classList.toggle('active',b.dataset.role===role));}function syncAccountPinField(mode,prefix){const isAdmin=mode==='admin';const wrap=$(prefix+'PinWrap'),input=$(prefix+'UserPassword');if(wrap)wrap.classList.toggle('hidden',!isAdmin);if(input){input.value='';input.placeholder=isAdmin?'••••':'Kasir tidak menggunakan PIN';input.disabled=!isAdmin;input.setAttribute('aria-hidden',String(!isAdmin));}if(wrap){wrap.classList.toggle('pin-slide-in',isAdmin);}}
function openUserEditor(id){if(profile?.role!=='admin')return toast('Hanya admin yang dapat mengelola akun.');const u=users.find(x=>x.id===id);if(!u)return toast('Akun tidak ditemukan.');$('editUserId').value=u.id;$('editUserNama').value=u.nama||'';$('editUserUsername').value=u.username||'';$('editUserRole').value=u.role||'karyawan';$('editUserAktif').value=u.aktif?'true':'false';syncAccountPinField(u.role==='admin'?'admin':'karyawan','edit');openModal('userModal')}
async function saveUserEdit(){try{if(profile?.role!=='admin')return toast('Hanya admin yang dapat mengelola akun.');const id=$('editUserId').value,nama=$('editUserNama').value.trim(),username=$('editUserUsername').value.trim().toLowerCase(),role=$('editUserRole').value,aktif=$('editUserAktif').value==='true',pin=$('editUserPassword').value.trim(),oldRole=users.find(u=>u.id===id)?.role;if(!id||!nama||!username)return toast('Nama dan username wajib diisi.');if(!/^[a-z0-9._-]{3,30}$/.test(username))return toast('Username 3-30 karakter: huruf, angka, titik, garis bawah atau strip.');if(id===profile.id&&(role!=='admin'||!aktif))return toast('Akun admin yang sedang digunakan tidak dapat diturunkan atau dinonaktifkan.');if(role==='admin'&&pin&&!/^[0-9]{4}$/.test(pin))return toast('PIN admin harus tepat 4 angka.');if(role==='karyawan'&&pin)return toast('Kasir tidak menggunakan PIN.');if(role==='admin'&&oldRole!=='admin'&&!pin)return toast('PIN wajib diisi saat akun kasir diubah menjadi admin.');const {data,error}=await sb.rpc('admin_update_user',{p_user_id:id,p_nama:nama,p_username:username,p_role:role,p_aktif:aktif,p_pin:pin||null});if(error)throw error;if(!data?.length)throw Error('Database tidak mengembalikan akun yang diperbarui.');if(id===profile.id){profile={...profile,...data[0]};localStorage.setItem('tokokasirlussal-username',profile.username);updateAccountView();if($('activeUser'))$('activeUser').textContent='Admin Aktif: '+(profile.nama||profile.username||'-')}closeModal('userModal');await loadAll();toast('Akun berhasil diperbarui.')}catch(e){console.error('saveUserEdit',e);toast('Gagal memperbarui akun: '+(e.message||'periksa database/RLS'))}}
function openProduct(id){if(profile?.role!=='admin')return toast('Hanya admin yang dapat mengelola produk.');const p=id?products.find(x=>x.id===id):null;const deleteBtn=$('deleteProductBtn');if(deleteBtn)deleteBtn.classList.toggle('hidden',!p);selectedProductImage=p?.gambar||'';$('productTitle').textContent=p?'Edit Produk':'Produk Baru';$('productId').value=p?.id||'';$('pNama').value=p?.nama||'';$('pEcer').value=p?.harga_ecer||0;$('pReseller').value=p?.harga_reseller||0;$('pAgen').value=p?.harga_agen||0;$('pGrosir').value=p?.harga_grosir||0;$('pStok').value=p?.stok||0;$('pKategori').value=p?.kategori||'Kapsul';$('pGambar').value=p?.gambar&&!p.gambar.startsWith('data:image/')?p.gambar:'';const fileInput=$('pGambarFile');if(fileInput)fileInput.value='';const preview=$('pGambarPreview');if(preview){if(p?.gambar){preview.src=p.gambar;preview.classList.remove('hidden')}else{preview.src='';preview.classList.add('hidden')}}openModal('productModal')}
function previewProductImage(event){const file=event.target.files?.[0];if(!file)return;if(!file.type.startsWith('image/')){event.target.value='';return toast('File harus berupa gambar.')}if(file.size>8*1024*1024){event.target.value='';return toast('Ukuran gambar maksimal 8 MB.')}const reader=new FileReader();reader.onload=()=>{const preview=$('pGambarPreview');if(preview){preview.src=reader.result;preview.classList.remove('hidden')}};reader.onerror=()=>toast('Gagal membaca gambar.');reader.readAsDataURL(file)}
function compressImage(file,max=900,quality=.76){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const img=new Image();img.onerror=reject;img.onload=()=>{const scale=Math.min(1,max/Math.max(img.width,img.height)),w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale)),c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.drawImage(img,0,0,w,h);resolve(c.toDataURL('image/jpeg',quality))};img.src=reader.result};reader.readAsDataURL(file)})}
async function saveProduct(){try{if(profile?.role!=='admin')return toast('Hanya admin yang dapat menyimpan produk.');const nama=$('pNama').value.trim();if(!nama)return toast('Nama produk wajib diisi.');const nums=['pEcer','pReseller','pAgen','pGrosir','pStok'].map(id=>Number($(id).value||0));if(nums.some(v=>!Number.isFinite(v)||v<0))return toast('Harga dan stok harus berupa angka nol atau lebih.');const [harga_ecer,harga_reseller,harga_agen,harga_grosir,stok]=nums;let gambar=$('pGambar').value.trim()||selectedProductImage;const fileInput=$('pGambarFile'),file=fileInput?.files?.[0];if(file){toast('Mengolah gambar...');gambar=await compressImage(file);if(gambar.length>900000)gambar=await compressImage(file,700,.65);if(gambar.length>1400000)throw Error('Gambar masih terlalu besar. Pilih gambar yang lebih kecil.')}const row={nama,harga_ecer,harga_reseller,harga_agen,harga_grosir,stok,kategori:$('pKategori').value||'Lainnya',gambar,aktif:true};const id=$('productId').value;let q=id?sb.from('products').update(row).eq('id',id):sb.from('products').insert(row);const {data,error}=await q.select().single();if(error)throw error;if(!data)throw Error('Produk tidak berhasil disimpan.');closeModal('productModal');selectedProductImage='';await loadAll();toast(id?'Produk berhasil diperbarui.':'Produk berhasil ditambahkan.')}catch(e){console.error('saveProduct',e);toast('Gagal menyimpan produk: '+(e.message||'periksa RLS Supabase'))}}
async function deleteProduct(event){try{if(event)event.stopPropagation();if(profile?.role!=='admin')return toast('Hanya admin yang dapat menghapus produk.');const id=$('productId').value;if(!id)return toast('Produk belum dipilih.');const nama=$('pNama').value.trim()||'produk ini';if(!confirm('Hapus produk "'+nama+'"? Produk akan dihapus dari daftar penjualan.'))return;const {data,error}=await sb.from('products').update({aktif:false}).eq('id',id).select().single();if(error)throw error;if(!data)throw Error('Produk tidak berhasil dihapus.');closeModal('productModal');selectedProductImage='';await loadAll();toast('Produk berhasil dihapus.')}catch(e){console.error('deleteProduct',e);toast('Gagal menghapus produk: '+(e.message||'periksa RLS Supabase'))}}
function openAgent(){if(profile?.role!=='admin')return toast('Hanya admin yang dapat menambah agen.');$('aNama').value=$('aHp').value=$('aAlamat').value='';openModal('agentModal')}
function openModal(id){const m=$(id);if(!m)return;const sheet=document.querySelector('.side');sheet?.classList.remove('sheet-half','sheet-expanded');document.body.classList.add('modal-open');document.body.classList.remove('mobile-sheet-open');document.getElementById('mobileSheetBackdrop')?.classList.remove('show');m.classList.add('show');m.setAttribute('aria-hidden','false');setTimeout(()=>{const first=m.querySelector('input:not([type="hidden"]),select,button');first?.focus()},80)}
function closeModal(id){const m=$(id);if(!m)return;m.classList.remove('show');m.setAttribute('aria-hidden','true');if(!document.querySelector('.modal.show'))document.body.classList.remove('modal-open')}
document.addEventListener('click',e=>{const m=e.target.closest('.modal');if(m&&e.target===m)closeModal(m.id)});
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;const m=document.querySelector('.modal.show');if(m)closeModal(m.id)});
function buildPrintReportHtml(){
  const d=new Date();
  const date=d.toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});
  const shop='LAPORAN PENJUALAN HARIAN';
  const body=$('tab-laporan')?.innerHTML||'<p>Data laporan tidak tersedia.</p>';
  return '<!doctype html><html><head><meta charset="utf-8"><title>'+shop+'</title><style>'+
    'body{font-family:Arial,sans-serif;color:#17211b;margin:0;padding:28px;font-size:12px}'+
    'h1{font-size:22px;margin:0 0 4px}h2{font-size:14px;margin:22px 0 8px;border-bottom:2px solid #173b25;padding-bottom:6px}'+
    '.letter{max-width:950px;margin:auto}.letterhead{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #173b25;padding-bottom:14px}'+
    '.meta{text-align:right;color:#5d6b63}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0}'+
    '.box{border:1px solid #dfe7e1;border-radius:8px;padding:10px}.box b{display:block;font-size:16px;margin-top:4px}'+
    'table{width:100%;border-collapse:collapse;margin-bottom:12px}th,td{border:1px solid #d9e1dc;padding:7px;text-align:left}'+
    'th{background:#eef5f0;font-size:10px;text-transform:uppercase}.right{text-align:right}.sign{margin-top:35px;display:flex;justify-content:flex-end}.sign div{width:220px;text-align:center}.muted{color:#68766e}'+
    '@media print{body{padding:12px}.no-print{display:none!important}}'+
    '</style></head><body><div class="letter"><div class="letterhead"><div><h1>'+shop+'</h1><div class="muted">TokoKasirLussal • Dokumen laporan resmi</div></div><div class="meta">Tanggal laporan<br><b>'+date+'</b></div></div>'+
    body+'<div class="sign"><div><p>Mengetahui,</p><br><br><b>Admin / Penanggung Jawab</b></div></div></div></body></html>';
}
async function printReport(){
  try{
    const html=buildPrintReportHtml();
    if(window.electronPrinter?.available){
      const printerName=receiptPrinterName()||$('receiptPrinter')?.value||'';
      await window.electronPrinter.printReport(html,printerName);
      toast(printerName?'Laporan dikirim ke printer '+printerName+'.':'Laporan dikirim ke printer default Windows.');
      return;
    }
    if(IS_ELECTRON)return toast('Fitur cetak native belum tersedia pada versi aplikasi ini. Silakan perbarui TokoKasirLussal.');
    const win=window.open('','_blank','width=1000,height=800');
    if(!win)return toast('Izinkan pop-up untuk mencetak laporan.');
    win.document.open();
    win.document.write(html.replace('</body>','<script>window.onload=()=>setTimeout(()=>window.print(),150)<\\/script></body>'));
    win.document.close();
  }catch(e){
    console.error('printReport',e);
    toast('Gagal membuka cetak: '+(e?.message||'periksa printer'));
  }
}

function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}function escAttr(s){return esc(s).replace(/javascript:/gi,'')}
window.addEventListener('load',async()=>{try{requireConfig();setupMobileTabState();setLoginMode('kasir');showLogin();checkRemoteWebUpdate();setInterval(checkRemoteWebUpdate,60000)}catch(e){console.error('init',e);showLogin();toast(e.message||'Aplikasi gagal dimuat')}})
function openPurchase(){if(profile?.role!=='admin')return toast('Hanya admin yang dapat mencatat pembelian.');$('purchaseDate').value=new Date().toISOString().slice(0,10);fillPurchaseProducts();renderPurchaseCart();openModal('purchaseModal')}
function fillPurchaseProducts(){$('purchaseProduct').innerHTML='<option value="">Pilih produk</option>'+products.map(p=>`<option value="${p.id}">${esc(p.nama)} — stok ${p.stok}</option>`).join('')}
function addPurchaseItem(){const id=$('purchaseProduct').value,qty=Number($('purchaseQty').value||0),harga=Number($('purchasePrice').value||0);if(!id||qty<=0||harga<0)return toast('Pilih produk dan isi qty/harga beli.');const p=products.find(x=>x.id===id),ex=purchaseCart.find(x=>x.product_id===id);if(ex){ex.qty+=qty;ex.harga_beli=harga}else purchaseCart.push({product_id:id,nama:p.nama,qty,harga_beli:harga});$('purchaseQty').value='1';$('purchasePrice').value='0';renderPurchaseCart()}
function renderPurchaseCart(){$('purchaseCart').innerHTML=purchaseCart.map((x,i)=>`<div class="cartitem"><div><b>${esc(x.nama)}</b><div class="note">${x.qty} × ${rp(x.harga_beli)}</div><strong class="price">${rp(x.qty*x.harga_beli)}</strong></div><button class="btn danger" onclick="purchaseCart.splice(${i},1);renderPurchaseCart()">×</button></div>`).join('')||'<div class="note">Belum ada barang.</div>';const t=purchaseCart.reduce((a,x)=>a+x.qty*x.harga_beli,0);if($('purchaseTotal'))$('purchaseTotal').textContent=rp(t)}
async function savePurchase(){try{if(profile?.role!=='admin')return toast('Hanya admin yang dapat mencatat pembelian.');if(!purchaseCart.length)return toast('Tambahkan barang pembelian.');const {data,error}=await sb.rpc('create_purchase',{p_supplier:$('purchaseSupplier').value.trim(),p_tanggal:$('purchaseDate').value||new Date().toISOString().slice(0,10),p_catatan:$('purchaseNote').value.trim(),p_items:purchaseCart.map(x=>({product_id:x.product_id,qty:x.qty,harga_beli:x.harga_beli}))});if(error)throw error;toast('Pembelian '+data.nomor_pembelian+' berhasil dan stok bertambah.');purchaseCart=[];$('purchaseSupplier').value='';$('purchaseNote').value='';closeModal('purchaseModal');await loadAll()}catch(e){console.error(e);toast('Gagal menyimpan pembelian: '+(e.message||'periksa database'))}}
function renderPurchases(){$('purchases').innerHTML=purchases.map(p=>{const returned=purchaseReturns.filter(r=>r.purchase_id===p.id).reduce((a,r)=>a+Number(r.total||0),0);const net=Math.max(0,Number(p.total||0)-returned);return `<tr><td>${esc(p.nomor_pembelian)}</td><td>${esc(p.tanggal)}</td><td>${esc(p.supplier||'-')}</td><td>${rp(net)}${returned?`<div class="note">Retur ${rp(returned)}</div>`:''}</td><td><button class="btn danger" onclick="openPurchaseReturn('${p.id}')">↩ Retur</button></td></tr>`}).join('')||'<tr><td colspan="5" class="note">Belum ada pembelian.</td></tr>'}
function ensureReturnModal(){if($('returnModal'))return;document.body.insertAdjacentHTML('beforeend',`<div id="returnModal" class="modal"><div class="modalbox"><h3 id="returnTitle">Retur Barang</h3><div id="returnItems"></div><div class="field"><label>Alasan Retur</label><input id="returnReason" placeholder="Contoh: rusak / salah barang / barang dikembalikan"></div><div class="actions"><button class="btn secondary" onclick="closeModal('returnModal')">Batal</button><button class="btn primary" onclick="submitReturn()">Simpan Retur</button></div></div></div>`)}
let returnMode='',returnRefId='';
function renderReturns(){
 const salesEl=$('returnSalesList');
 if(salesEl){
  salesEl.innerHTML=sales.map(s=>{
   const already=saleReturns.some(r=>r.sale_id===s.id);
   const returned=saleReturns.filter(r=>r.sale_id===s.id).reduce((a,r)=>a+Number(r.total||0),0);
   const remaining=saleItems.filter(i=>i.sale_id===s.id).reduce((sum,i)=>sum+Math.max(0,Number(i.qty||0)-saleReturnItems.filter(r=>r.sale_item_id===i.id).reduce((a,r)=>a+Number(r.qty||0),0)),0);
   return '<tr><td><b>'+esc(s.nomor_transaksi)+'</b></td><td>'+new Date(s.created_at).toLocaleString('id-ID')+'</td><td>'+rp(Math.max(0,Number(s.total||0)-returned))+'</td><td>'+(already?'<span class="note">Sudah retur</span>':'-')+'</td><td>'+remaining+' Pcs</td><td><button class="btn danger" '+(already||remaining<=0?'disabled':'')+' onclick="openSaleReturn(\''+s.id+'\')">'+(already?'✓ Retur Selesai':'↩ Retur')+'</button></td></tr>';
  }).join('')||'<tr><td colspan="6" class="note">Belum ada transaksi yang dapat diretur.</td></tr>';
 }
 const prSection=$('returnPurchaseSection'),prEl=$('returnPurchaseList');
 if(prSection)prSection.style.display=profile?.role==='admin'?'block':'none';
 if(prEl&&profile?.role==='admin'){
  prEl.innerHTML=purchases.map(p=>{
   const already=purchaseReturns.some(r=>r.purchase_id===p.id);
   return '<tr><td><b>'+esc(p.nomor_pembelian)+'</b></td><td>'+esc(p.tanggal)+'</td><td>'+esc(p.supplier||'-')+'</td><td><button class="btn danger" '+(already?'disabled':'')+' onclick="openPurchaseReturn(\''+p.id+'\')">'+(already?'✓ Retur Selesai':'↩ Retur')+'</button></td></tr>';
  }).join('')||'<tr><td colspan="4" class="note">Belum ada pembelian yang dapat diretur.</td></tr>';
 }
}
async function openSaleReturn(id){
 try{
  ensureReturnModal();returnMode='sale';returnRefId=id;
  const q=await sb.from('sale_items').select('*').eq('sale_id',id).order('created_at');
  if(q.error)throw q.error;
  const items=q.data||[];
  const ids=items.map(x=>x.id);
  let returns=[];
  if(ids.length){
   const rr=await sb.from('sale_return_items').select('*').in('sale_item_id',ids).order('created_at');
   if(rr.error)throw rr.error;
   returns=rr.data||[];
  }
  saleItems=[...saleItems.filter(x=>x.sale_id!==id),...items];
  saleReturnItems=[...saleReturnItems.filter(x=>!ids.includes(x.sale_item_id)),...returns];
  $('returnTitle').textContent='Retur Barang Terjual';
  $('returnItems').innerHTML=items.map(x=>{
   const returned=returns.filter(r=>r.sale_item_id===x.id).reduce((a,r)=>a+Number(r.qty||0),0);
   const remaining=Math.max(0,Number(x.qty||0)-returned);
   return '<div class="field" style="border:1px solid #e5ece7;padding:10px;border-radius:10px"><label>'+esc(x.nama_produk)+' — '+rp(x.harga)+'</label><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="note">Terjual '+x.qty+' • Sudah retur '+returned+' • Sisa '+remaining+'</span><input id="retSale_'+x.id+'" type="number" min="0" max="'+remaining+'" step="1" value="0" '+(remaining<=0?'disabled':'')+' style="max-width:120px"></div></div>';
  }).join('')||'<div class="note">Detail barang transaksi tidak ditemukan.</div>';
  $('returnReason').value='';openModal('returnModal');
 }catch(e){console.error('openSaleReturn',e);toast('Detail retur gagal dimuat: '+(e?.message||e))}
}
async function openPurchaseReturn(id){
 try{
  ensureReturnModal();returnMode='purchase';returnRefId=id;
  const q=await sb.from('purchase_items').select('*').eq('purchase_id',id).order('created_at');
  if(q.error)throw q.error;
  const items=q.data||[];
  const ids=items.map(x=>x.id);
  let returns=[];
  if(ids.length){
   const rr=await sb.from('purchase_return_items').select('*').in('purchase_item_id',ids).order('created_at');
   if(rr.error)throw rr.error;
   returns=rr.data||[];
  }
  purchaseItems=[...purchaseItems.filter(x=>x.purchase_id!==id),...items];
  purchaseReturnItems=[...purchaseReturnItems.filter(x=>!ids.includes(x.purchase_item_id)),...returns];
  $('returnTitle').textContent='Retur Barang Dibeli';
  $('returnItems').innerHTML=items.map(x=>{
   const returned=returns.filter(r=>r.purchase_item_id===x.id).reduce((a,r)=>a+Number(r.qty||0),0);
   const remaining=Math.max(0,Number(x.qty||0)-returned);
   return '<div class="field" style="border:1px solid #e5ece7;padding:10px;border-radius:10px"><label>Produk '+esc(products.find(p=>p.id===x.product_id)?.nama||x.product_id)+' — '+rp(x.harga_beli)+'</label><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="note">Dibeli '+x.qty+' • Sudah retur '+returned+' • Sisa '+remaining+'</span><input id="retPur_'+x.id+'" type="number" min="0" max="'+remaining+'" step="1" value="0" '+(remaining<=0?'disabled':'')+' style="max-width:120px"></div></div>';
  }).join('')||'<div class="note">Detail pembelian tidak ditemukan.</div>';
  $('returnReason').value='';openModal('returnModal');
 }catch(e){console.error('openPurchaseReturn',e);toast('Detail retur gagal dimuat: '+(e?.message||e))}
}
async function submitReturn(){
 try{
  if(!returnMode||!returnRefId)return toast('Pilih transaksi yang akan diretur.');
  const selector=returnMode==='sale'?'[id^="retSale_"]':'[id^="retPur_"]';
  const inputs=[...document.querySelectorAll(selector)];
  const items=inputs.map(i=>({id:i.id.replace(/^ret(?:Sale|Pur)_/,''),qty:Number(i.value||0)})).filter(x=>Number.isInteger(x.qty)&&x.qty>0);
  if(!items.length)return toast('Masukkan qty retur minimal 1.');

  // Ambil ulang detail retur tepat sebelum submit agar tidak memakai data/cache lama.
  const itemTable=returnMode==='sale'?'sale_items':'purchase_items';
  const returnTable=returnMode==='sale'?'sale_return_items':'purchase_return_items';
  const fk=returnMode==='sale'?'sale_id':'purchase_id';
  const itemIdField=returnMode==='sale'?'sale_item_id':'purchase_item_id';
  const freshItems=await sb.from(itemTable).select('*').eq(fk,returnRefId);
  if(freshItems.error)throw freshItems.error;
  const freshIds=(freshItems.data||[]).map(x=>x.id);
  const freshReturns=freshIds.length
    ? await sb.from(returnTable).select('*').in(itemIdField,freshIds)
    : {data:[],error:null};
  if(freshReturns.error)throw freshReturns.error;

  const available=new Map((freshItems.data||[]).map(x=>{
    const returned=(freshReturns.data||[]).filter(r=>r[itemIdField]===x.id).reduce((a,r)=>a+Number(r.qty||0),0);
    return [x.id,Math.max(0,Number(x.qty||0)-returned)];
  }));
  for(const item of items){
    const left=available.get(item.id);
    if(left===undefined)throw Error('Item transaksi tidak ditemukan atau sudah tidak tersedia untuk retur.');
    if(item.qty>left)throw Error('Qty retur '+item.qty+' melebihi sisa qty '+left+'. Silakan masukkan qty sesuai sisa.');
  }

  const existingReturn=returnMode==='sale'
    ? saleReturns.find(r=>r.sale_id===returnRefId)
    : purchaseReturns.find(r=>r.purchase_id===returnRefId);
  if(existingReturn)throw Error('Transaksi ini sudah pernah diretur. Retur hanya dapat dilakukan satu kali.');
  const alasan=$('returnReason').value.trim();
  const rpc=returnMode==='sale'?'create_sale_return':'create_purchase_return';
  const payload=returnMode==='sale'
   ?{p_kasir_id:profile.id,p_sale_id:returnRefId,p_items:items.map(x=>({sale_item_id:x.id,qty:x.qty})),p_alasan:alasan}
   :{p_kasir_id:profile.id,p_purchase_id:returnRefId,p_items:items.map(x=>({purchase_item_id:x.id,qty:x.qty})),p_alasan:alasan};
  const {data,error}=await sb.rpc(rpc,payload);
  if(error)throw error;
  closeModal('returnModal');
  await loadAll();
  const total=Number(data?.total||0);
  toast('Retur berhasil disimpan'+(total?' — '+rp(total):'')+'. Stok, laporan, dan histori sudah disinkronkan.');
 }catch(e){console.error('submitReturn',e);toast('Retur gagal: '+(e?.message||'Periksa transaksi, qty, stok, atau hak akses.'))}
}




// ==================== STOCK NOTIFICATIONS ====================
function stockNoticeFor(p){const n=Number(p?.stok||0);if(n<=0)return 'out';if(n<10)return 'low';return 'ok'}
function stockNoticeText(p){const n=Number(p?.stok||0);return n<=0?'Produk '+p.nama+' habis':'Produk '+p.nama+' stok '+n}
function renderNotifications(){
 const list=$('notificationList'),badge=$('notificationBadge'),count=$('notificationCount');if(!list)return;
 const alerts=products.filter(p=>Number(p.stok||0)<10).sort((a,b)=>Number(a.stok||0)-Number(b.stok||0));
 if(badge){badge.textContent=alerts.length>99?'99+':String(alerts.length);badge.classList.toggle('show',alerts.length>0)}
 if(count)count.textContent=String(alerts.length);
 list.innerHTML=alerts.map(p=>{const out=Number(p.stok||0)<=0;return '<div class="notify-item '+(out?'danger':'warn')+'"><span>'+ (out?'🔴':'🟠') +'</span><b>'+esc(stockNoticeText(p))+'</b></div>'}).join('')||'<div class="notify-empty">Stok aman</div>';
 const next={};products.forEach(p=>next[p.id]=stockNoticeFor(p));
 let changed=null;for(const p of products){const prev=stockNotificationState[p.id]||'ok',now=next[p.id];if((now==='out'||now==='low')&&prev==='ok'){changed=p;break}}
 stockNotificationState=next;try{localStorage.setItem('tokokasir_stock_notice_state',JSON.stringify(next))}catch(e){}
 if(changed)showStockToast(stockNoticeText(changed),Number(changed.stok||0)<=0?'danger':'warn');
}
function showStockToast(message,type){const el=$('stockToast');if(!el)return;el.textContent=message;el.className='stock-toast show '+type;clearTimeout(window.__stockToastTimer);window.__stockToastTimer=setTimeout(()=>el.classList.remove('show'),3500)}
function toggleNotifications(){$('notificationMenu')?.classList.toggle('show')}
document.addEventListener('click',e=>{if(!e.target.closest('.notify-wrap'))$('notificationMenu')?.classList.remove('show')});

// ==================== BARANG DIBAWA ====================
function carryProductsOptions(selected=''){return '<option value="">Pilih produk</option>'+products.map(p=>'<option value="'+escAttr(p.id)+'" '+(p.id===selected?'selected':'')+'>'+esc(p.nama)+' — stok '+Number(p.stok||0)+'</option>').join('')}
function addCarryRow(productId='',qty=1){
 const box=$('carryItems');if(!box)return;
 const row=document.createElement('div');row.className='carry-item-row';
 row.innerHTML='<select class="carry-product">'+carryProductsOptions(productId)+'</select><input class="carry-qty" type="number" min="1" step="1" value="'+Math.max(1,Number(qty||1))+'"><button type="button" class="btn danger carry-remove">×</button>';
 row.querySelector('.carry-remove').onclick=()=>{row.remove();updateCarrySummary()};
 row.querySelector('.carry-qty').oninput=updateCarrySummary;row.querySelector('.carry-product').onchange=updateCarrySummary;
 box.appendChild(row);updateCarrySummary();
}
function updateCarrySummary(){const rows=[...document.querySelectorAll('#carryItems .carry-item-row')];const total=rows.reduce((a,r)=>a+Math.max(0,Number(r.querySelector('.carry-qty')?.value||0)),0);if($('carrySummary'))$('carrySummary').textContent='Total barang: '+total}
function openBarangDibawa(){
 carryEditingId=null;carryCart=[];$('carryPerson').value='';$('carryNote').value='';$('carryItems').innerHTML='';$('carryPeople').innerHTML=agents.map(a=>'<option value="'+escAttr(a.nama)+'"></option>').join('');addCarryRow();openModal('barangDibawaModal');
}
async function saveBarangDibawa(){
 try{
  const person=$('carryPerson').value.trim();if(!person)return toast('Isi siapa yang mengambil barang.');
  const rows=[...document.querySelectorAll('#carryItems .carry-item-row')];
  const items=rows.map(r=>({product_id:r.querySelector('.carry-product')?.value,qty:Number(r.querySelector('.carry-qty')?.value||0)})).filter(x=>x.product_id&&x.qty>0);
  if(!items.length)return toast('Pilih barang minimal 1.');
  const seen=new Set();for(const x of items){if(seen.has(x.product_id))return toast('Produk yang sama cukup satu baris.');seen.add(x.product_id);const p=products.find(y=>y.id===x.product_id);if(!p||x.qty>Number(p.stok||0))return toast('Stok '+(p?.nama||'produk')+' tidak cukup.')}
  const {data,error}=await sb.rpc('create_barang_dibawa',{p_user_id:profile.id,p_diambil_oleh:person,p_catatan:$('carryNote').value.trim(),p_items:items});
  if(error)throw error;closeModal('barangDibawaModal');await loadAll();toast('Barang dibawa tersimpan. Stok sudah berkurang.');
 }catch(e){console.error('saveBarangDibawa',e);toast('Gagal menyimpan: '+(e.message||e))}
}
function renderBarangDibawa(){
 const el=$('barangDibawaList');if(!el)return;
 if(!barangDibawa.length){el.innerHTML='<div class="note">Belum ada data barang dibawa.</div>';return}
 el.innerHTML=barangDibawa.map(h=>{
  const items=barangDibawaItems.filter(x=>x.barang_dibawa_id===h.id);
  const detail=items.map(x=>esc(x.nama_produk)+' × '+x.qty_dibawa+(h.status==='selesai'?' (terjual '+x.qty_terjual+', kembali '+x.qty_kembali+')':'')).join(' • ');
  return '<div class="carry-card '+(h.status==='selesai'?'carry-done':'carry-pending')+'"><div class="carry-card-top"><div><b>'+esc(h.diambil_oleh)+'</b><small> • '+new Date(h.created_at).toLocaleString('id-ID')+'</small></div><span class="carry-status '+(h.status==='selesai'?'done':'')+'">'+(h.status==='selesai'?'Selesai':'Dibawa')+'</span></div><div class="carry-products">'+detail+'</div>'+(h.catatan?'<small>'+esc(h.catatan)+'</small>':'')+(h.status==='dibawa'?'<div style="margin-top:12px"><button class="btn primary" onclick="openBarangDibawaComplete(\''+h.id+'\')">Selesaikan</button></div>':'')+'</div>';
 }).join('');
}
function openBarangDibawaComplete(id){
 const h=barangDibawa.find(x=>x.id===id),items=barangDibawaItems.filter(x=>x.barang_dibawa_id===id);if(!h||h.status!=='dibawa')return toast('Data barang dibawa tidak tersedia.');
 $('carryCompleteItems').innerHTML=items.map(x=>'<div class="field" style="border:1px solid #193128;padding:10px;border-radius:12px"><label>'+esc(x.nama_produk)+' • Dibawa '+x.qty_dibawa+'</label><div class="carry-complete-row"><span class="note">Harga '+rp(x.harga)+'</span><input class="carry-sold" data-item-id="'+x.id+'" type="number" min="0" max="'+x.qty_dibawa+'" value="'+x.qty_dibawa+'"><input class="carry-return" data-item-id="'+x.id+'" type="number" min="0" max="'+x.qty_dibawa+'" value="0"></div><small class="note">Kolom: terjual • kembali</small></div>').join('');
 openModal('barangDibawaCompleteModal');
}
async function completeBarangDibawa(){
 try{
  const h=[...barangDibawa].find(x=>x.id===(document.querySelector('#carryCompleteItems .carry-sold')?.dataset?.headerId||''));
  const id=window.__carryCompleteId;
  if(!id)return toast('Data barang dibawa tidak dipilih.');
  const items=[...document.querySelectorAll('#carryCompleteItems .carry-sold')].map(input=>{const itemId=input.dataset.itemId;const ret=document.querySelector('#carryCompleteItems .carry-return[data-item-id="'+itemId+'"]');return {item_id:itemId,qty_terjual:Number(input.value||0),qty_kembali:Number(ret?.value||0)}});
  for(const x of items){if(!Number.isInteger(x.qty_terjual)||!Number.isInteger(x.qty_kembali)||x.qty_terjual<0||x.qty_kembali<0)return toast('Qty harus bilangan bulat.');const original=barangDibawaItems.find(i=>i.id===x.item_id);if(!original||x.qty_terjual+x.qty_kembali!==Number(original.qty_dibawa))return toast('Qty '+(original?.nama_produk||'produk')+': dibawa harus sama dengan terjual + kembali.')}
  const {data,error}=await sb.rpc('complete_barang_dibawa',{p_user_id:profile.id,p_barang_dibawa_id:id,p_items:items});if(error)throw error;
  closeModal('barangDibawaCompleteModal');await loadAll();toast(data?.total_terjual?('Selesai. '+data.total_terjual+' barang tercatat sebagai penjualan.'):'Selesai. Barang kembali sudah ditambahkan ke stok.');
 }catch(e){console.error('completeBarangDibawa',e);toast('Gagal menyelesaikan: '+(e.message||e))}
}
const _oldOpenBarangDibawaComplete=openBarangDibawaComplete;
openBarangDibawaComplete=function(id){window.__carryCompleteId=id;return _oldOpenBarangDibawaComplete(id)};
/* TOKOKASIRLUSSAL_MOBILE_BOTTOM_SHEET_V2 */
(function setupMobileBottomSheet(){
  let sheet,handle,dragging=false,currentState='collapsed',startY=0,startTranslate=0;
  function isMobile(){return window.innerWidth<=800}
  function getSheet(){return document.querySelector('.side')}
  function stateTranslate(state){
    if(!sheet)return 0;
    const h=sheet.getBoundingClientRect().height||76;
    return state==='collapsed'?Math.max(0,h-18):0;
  }
  function applyState(state,animate=true){
    sheet=getSheet();if(!sheet||!isMobile())return;
    currentState=state;
    sheet.classList.toggle('sheet-collapsed',state==='collapsed');
    sheet.classList.toggle('sheet-expanded',state==='expanded');
    sheet.classList.toggle('sheet-dragging',!animate);
    document.body.classList.toggle('mobile-sheet-open',state==='expanded');
    if(!animate)sheet.style.transform='translateY('+stateTranslate(state)+'px)';
    else sheet.style.removeProperty('transform');
  }
  function begin(e){
    if(!isMobile()||!sheet)return;
    startY=e.clientY;
    const rect=sheet.getBoundingClientRect();
    startTranslate=rect.top-(window.innerHeight-rect.height);
    dragging=true;
    sheet.classList.add('sheet-dragging');
    handle.setPointerCapture?.(e.pointerId);
  }
  function move(e){
    if(!dragging||!sheet)return;
    const h=sheet.getBoundingClientRect().height||76;
    const max=Math.max(0,h-18);
    const next=Math.max(0,Math.min(max,startTranslate+e.clientY-startY));
    sheet.style.transform='translateY('+next+'px)';
    e.preventDefault();
  }
  function end(e){
    if(!dragging||!sheet)return;
    dragging=false;
    const h=sheet.getBoundingClientRect().height||76;
    const rect=sheet.getBoundingClientRect();
    const current=rect.top-(window.innerHeight-h);
    const elapsed=Math.max(16,performance.now()-(window.__sheetDragTime||performance.now()));
    const velocity=(e.clientY-startY)/elapsed;
    sheet.style.removeProperty('transform');
    applyState(velocity<-0.35||current<h*.45?'expanded':'collapsed',true);
  }
  function init(){
    sheet=getSheet();
    handle=document.getElementById('mobileSheetHandle');
    if(!sheet||!handle||sheet.dataset.bottomSheetReady==='1')return;
    sheet.dataset.bottomSheetReady='1';
    handle.addEventListener('pointerdown',e=>{window.__sheetDragTime=performance.now();begin(e)});
    handle.addEventListener('pointermove',move);
    handle.addEventListener('pointerup',end);
    handle.addEventListener('pointercancel',end);
    window.addEventListener('resize',()=>{
      if(isMobile())applyState(currentState);
      else{sheet.style.removeProperty('transform');document.body.classList.remove('mobile-sheet-open')}
    });
    applyState('collapsed');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
let deferredInstallPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();
  deferredInstallPrompt=e;
  const b=$('installBtn');
  if(b)b.classList.remove('hidden');
});
window.addEventListener('appinstalled',()=>{
  deferredInstallPrompt=null;
  const b=$('installBtn');
  if(b)b.classList.add('hidden');
  toast('TokoKasirLussal berhasil dipasang di HP.');
});
async function installApp(){
  if(!deferredInstallPrompt){
    toast('Jika tombol instal belum muncul, buka menu browser lalu pilih Tambahkan ke layar utama.');
    return;
  }
  deferredInstallPrompt.prompt();
  const choice=await deferredInstallPrompt.userChoice;
  if(choice?.outcome==='accepted')toast('Aplikasi sedang dipasang...');
  deferredInstallPrompt=null;
  const b=$('installBtn');
  if(b)b.classList.add('hidden');
}
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('PWA service worker',e)));
}