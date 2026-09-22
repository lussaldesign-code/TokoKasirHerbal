/* UI fixes: product delete + mobile transaction action */
(function(){
  const originalRenderProducts=window.renderProducts;
  function addDeleteButtons(){
    if(window.profile?.role!=='admin') return;
    document.querySelectorAll('#products .product').forEach(card=>{
      if(card.querySelector('.delete-product')) return;
      const edit=card.querySelector('.edit');
      if(!edit) return;
      const id=edit.getAttribute('onclick')?.match(/openProduct\\('([^']+)'\\)/)?.[1];
      if(!id) return;
      const b=document.createElement('button');
      b.className='delete-product'; b.type='button'; b.title='Hapus produk'; b.textContent='🗑️';
      b.onclick=(e)=>{e.stopPropagation();window.deleteProduct(id)};
      card.appendChild(b);
    });
  }
  if(typeof originalRenderProducts==='function'){
    window.renderProducts=function(){originalRenderProducts();addDeleteButtons();};
  }
  window.deleteProduct=async function(id){
    if(window.profile?.role!=='admin') return toast('Hanya admin yang dapat menghapus produk.');
    const p=(window.products||[]).find(x=>x.id===id);
    if(!p) return toast('Produk tidak ditemukan.');
    if(!confirm('Hapus produk "'+p.nama+'"? Produk akan dihapus dari daftar penjualan.')) return;
    try{
      const {error}=await window.sb.from('products').update({aktif:false}).eq('id',id);
      if(error) throw error;
      window.cart=(window.cart||[]).filter(x=>x.id!==id);
      await window.loadAll();
      toast('Produk berhasil dihapus.');
    }catch(e){console.error(e);toast('Gagal menghapus produk: '+(e.message||'periksa RLS Supabase'));}
  };
  function ensureMobileButton(){
    if(document.getElementById('mobileCheckoutBtn')) return;
    const b=document.createElement('button');
    b.id='mobileCheckoutBtn'; b.className='btn primary'; b.textContent='🛒 Proses Transaksi';
    b.type='button'; b.onclick=()=>window.checkout();
    document.body.appendChild(b);
  }
  ensureMobileButton();
  const observer=new MutationObserver(()=>addDeleteButtons());
  observer.observe(document.getElementById('products')||document.body,{childList:true,subtree:true});
})();
