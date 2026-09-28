(function(){
  'use strict';

  // Stock notification rules:
  // Agarillus -> show when stock < 10.
  // Other categories -> show only when stock is exactly 0.
  // Read from the product cards so this module does not depend on the lexical
  // `products` variable inside app.js.
  function readCards(){
    const root=document.getElementById('products');
    if(!root)return [];
    const alerts=[];
    root.querySelectorAll('.rak').forEach(function(rack){
      const category=String(rack.querySelector('h3')?.textContent||'').replace(/^\s*📦\s*/,'').trim().toLowerCase();
      rack.querySelectorAll('.product[data-product-id]').forEach(function(card){
        const stockText=String(card.querySelector('.stock')?.textContent||'');
        const match=stockText.match(/-?\d+(?:[.,]\d+)?/);
        if(!match)return;
        const stock=Number(String(match[0]).replace(',','.'));
        const agarillus=category==='agarillus';
        if((agarillus&&stock<10)||(!agarillus&&stock===0)){
          alerts.push({id:card.dataset.productId||'',nama:String(card.querySelector('.info b')?.textContent||'-').trim(),stok:stock});
        }
      });
    });
    return alerts.sort((a,b)=>a.stok-b.stok);
  }

  function getAllAlerts(){
    // The product grid can be filtered by search/category. Temporarily render
    // the complete catalog so the bell never misses an out-of-stock product.
    const search=document.getElementById('search');
    const category=document.getElementById('category');
    const oldSearch=search?.value||'';
    const oldCategory=category?.value||'Semua';
    let alerts=[];
    try{
      if(typeof window.renderProducts==='function'){
        if(search)search.value='';
        if(category)category.value='Semua';
        window.renderProducts();
      }
      alerts=readCards();
    }finally{
      if(search)search.value=oldSearch;
      if(category)category.value=oldCategory;
      if(typeof window.renderProducts==='function')window.renderProducts();
    }
    return alerts;
  }

  function renderFilteredNotifications(){
    try{
      const list=document.getElementById('notificationList');
      const badge=document.getElementById('notificationBadge');
      const count=document.getElementById('notificationCount');
      if(!list)return;
      const alerts=getAllAlerts();
      if(badge){badge.textContent=alerts.length>99?'99+':String(alerts.length);badge.classList.toggle('show',alerts.length>0)}
      if(count)count.textContent=String(alerts.length);
      const escape=typeof window.esc==='function'?window.esc:function(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))};
      list.innerHTML=alerts.map(function(p){
        const empty=p.stok===0;
        return '<div class="notify-item '+(empty?'danger':'warn')+'"><span>'+(empty?'🔴':'🟠')+'</span><b>'+escape(empty?'Produk '+p.nama+' habis':'Produk '+p.nama+' stok '+p.stok)+'</b></div>';
      }).join('')||'<div class="notify-empty">Stok aman</div>';
    }catch(error){console.error('[bell-rule]',error)}
  }

  function install(){
    try{
      if(typeof window.renderNotifications==='function'&&!window.renderNotifications.__stockRule){
        const original=window.renderNotifications;
        function filtered(){
          try{original.apply(this,arguments)}catch(error){console.warn('[bell-rule] original renderer',error)}
          renderFilteredNotifications();
        }
        filtered.__stockRule=true;
        filtered.__original=original;
        window.renderNotifications=filtered;
      }
      renderFilteredNotifications();
    }catch(error){console.error('[bell-rule] install',error)}
  }

  function boot(){
    install();
    let tries=0;
    const timer=setInterval(function(){install();tries++;if(tries>=60)clearInterval(timer)},500);
    window.addEventListener('load',install,{once:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
