/* Professional POS UI + reliable product delete */
(function(){
  const css=document.createElement('style');
  css.textContent=`#products.products{padding:18px;overflow:auto}#products .rak{margin:0 0 24px}#products .rak h3{margin:0 0 14px;padding:0 0 10px;border-bottom:1px solid var(--line);font-size:15px;font-weight:800}#products .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px;align-items:stretch}#products .product{min-width:0;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;background:#fff;cursor:pointer;position:relative;box-shadow:0 3px 12px #0000000b;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}#products .product:hover{transform:translateY(-3px);box-shadow:0 9px 24px #00000018;border-color:#d1d5db}#products .product img{width:100%;height:145px;display:block;object-fit:cover;background:#f1f5f9}#products .product .info{padding:12px;text-align:left}#products .product .info b{display:block;min-height:36px;font-size:14px;line-height:1.3;margin-bottom:7px}#products .product .price{font-size:16px}#products .product .stock{margin-top:5px;font-size:11px}#products .product .edit{z-index:4;box-shadow:0 2px 8px #0002;font-size:14px}#productModal .modalbox{max-width:560px;border-radius:20px;padding:22px}#productModal .product-delete-action{display:none}#productModal.editing .product-delete-action{display:block}#productModal .actions{align-items:center}#productModal .actions .product-delete-action{flex:0 0 auto;padding:9px 14px}@media(max-width:800px){#products .grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}#products .product img{height:115px}#products .product .info{padding:9px}#products .product .info b{font-size:13px;min-height:34px}#products .product .price{font-size:14px}#productModal .modalbox{max-height:92vh;padding:16px;border-radius:16px}#productModal .actions{flex-wrap:wrap}#productModal .actions .product-delete-action{order:3;flex-basis:100%;margin-top:2px}}@media(min-width:801px) and (max-width:1100px){#products .grid{grid-template-columns:repeat(3,minmax(0,1fr))}}`;
  document.head.appendChild(css);

  function getAppClient(){
    try{ if(typeof sb!=='undefined' && sb) return sb; }catch(e){}
    return null;
  }

  function getAppProfile(){
    try{ if(typeof profile!=='undefined' && profile) return profile; }catch(e){}
    return null;
  }

  async function ensureAdminSession(){
    const api=getAppClient();
    if(!api) throw Error('Aplikasi belum selesai memuat. Silakan coba lagi.');
    const {data,error}=await api.auth.getSession();
    if(error) throw error;
    if(!data?.session?.user) throw Error('Sesi login tidak ditemukan. Silakan login kembali.');

    /* Gunakan profile aplikasi yang sudah dipakai setelah login terlebih dahulu.
       Ini mencegah pengecekan role yang berbeda dari profile aktif aplikasi. */
    const appProfile=getAppProfile();
    if(appProfile && String(appProfile.auth_user_id||'')===String(data.session.user.id) && String(appProfile.role||'').trim().toLowerCase()==='admin' && appProfile.aktif!==false){
      return {api,user:data.session.user,prof:appProfile};
    }

    const {data:prof,error:pe}=await api.from('users').select('id,auth_user_id,role,aktif').eq('auth_user_id',data.session.user.id).maybeSingle();
    if(pe) throw pe;
    if(!prof || !prof.aktif) throw Error('Profil pengguna tidak aktif atau belum terhubung dengan akun login.');
    if(String(prof.role||'').trim().toLowerCase()!=='admin') throw Error('Akun login ini belum memiliki role Admin di public.users.');
    return {api,user:data.session.user,prof};
  }

  function setupEditDelete(){
    const modal=document.getElementById('productModal'),id=document.getElementById('productId');
    if(!modal||!id)return;
    modal.classList.toggle('editing',!!id.value);
    let btn=modal.querySelector('.product-delete-action');
    if(!btn){
      btn=document.createElement('button');
      btn.type='button';
      btn.className='btn danger product-delete-action';
      btn.textContent='🗑️ Hapus Produk';
      btn.onclick=deleteCurrentProduct;
      modal.querySelector('.actions')?.appendChild(btn);
    }
  }

  async function deleteCurrentProduct(){
    const id=document.getElementById('productId')?.value;
    const nama=document.getElementById('pNama')?.value?.trim()||'produk ini';
    if(!id)return toast('Produk baru belum dapat dihapus.');
    if(!confirm('Yakin ingin menghapus produk "'+nama+'"?\n\nProduk akan disembunyikan dari kasir, sedangkan riwayat transaksi tetap aman.'))return;
    try{
      const {api}=await ensureAdminSession();
      const {data,error}=await api.from('products').update({aktif:false,updated_at:new Date().toISOString()}).eq('id',id).select('id').maybeSingle();
      if(error)throw error;
      if(!data)throw Error('Produk tidak ditemukan atau tidak memiliki izin untuk dihapus.');
      closeModal('productModal');
      if(typeof selectedProductImage!=='undefined')selectedProductImage='';
      toast('Produk berhasil dihapus.');
      if(typeof loadAll==='function')await loadAll();
    }catch(e){
      console.error('deleteCurrentProduct',e);
      toast('Gagal menghapus produk: '+(e.message||'periksa sesi login/RLS Supabase'));
    }
  }

  function watch(){
    setupEditDelete();
    const modal=document.getElementById('productModal');
    if(modal&&!modal.dataset.deleteWatcher){
      modal.dataset.deleteWatcher='1';
      new MutationObserver(setupEditDelete).observe(modal,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
    }
  }

  function start(){watch();setInterval(setupEditDelete,500)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
