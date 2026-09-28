(function(){
  'use strict';

  // Aturan lonceng stok:
  // 1) Kategori Agarillus -> tampil jika stok < 10 (termasuk stok 0).
  // 2) Semua kategori selain Agarillus -> tampil hanya jika stok = 0.
  // Tidak mengubah data produk atau stok; hanya menyaring tampilan notifikasi.
  function isAgarillus(product){
    return String(product?.kategori || '').trim().toLowerCase() === 'agarillus';
  }

  function getAlerts(){
    return (Array.isArray(window.products) ? window.products : [])
      .filter(function(product){
        const stock = Number(product?.stok ?? 0);
        return isAgarillus(product) ? stock < 10 : stock === 0;
      })
      .sort(function(a,b){
        return Number(a?.stok ?? 0) - Number(b?.stok ?? 0);
      });
  }

  function renderFilteredNotifications(){
    try{
      const list = document.getElementById('notificationList');
      const badge = document.getElementById('notificationBadge');
      const count = document.getElementById('notificationCount');
      if(!list)return;

      const alerts = getAlerts();
      if(badge){
        badge.textContent = alerts.length > 99 ? '99+' : String(alerts.length);
        badge.classList.toggle('show', alerts.length > 0);
      }
      if(count)count.textContent = String(alerts.length);

      list.innerHTML = alerts.map(function(product){
        const stock = Number(product?.stok ?? 0);
        const empty = stock === 0;
        const name = typeof esc === 'function' ? esc(product?.nama || '-') : String(product?.nama || '-');
        return '<div class="notify-item '+(empty?'danger':'warn')+'">'
          +'<span>'+(empty?'🔴':'🟠')+'</span>'
          +'<b>'+(empty?'Produk '+name+' habis':'Produk '+name+' stok '+stock)+'</b>'
          +'</div>';
      }).join('') || '<div class="notify-empty">Stok aman</div>';
    }catch(error){
      console.error('[bell-rule]',error);
    }
  }

  function install(){
    try{
      if(typeof window.renderNotifications === 'function' && !window.renderNotifications.__stockRule){
        const original = window.renderNotifications;
        function filtered(){
          // Jalankan renderer asli hanya untuk menjaga efek samping UI yang tidak terkait,
          // lalu timpa daftar/badge dengan hasil filter stok yang benar.
          try{ original.apply(this,arguments); }catch(error){ console.warn('[bell-rule] original renderer',error); }
          renderFilteredNotifications();
        }
        filtered.__stockRule = true;
        filtered.__original = original;
        window.renderNotifications = filtered;
      }
      renderFilteredNotifications();
    }catch(error){
      console.error('[bell-rule] install',error);
    }
  }

  // app.js dapat mendefinisikan renderer setelah DOMContentLoaded, jadi jangan
  // bergantung pada satu waktu eksekusi saja.
  function boot(){
    install();
    let tries = 0;
    const timer = setInterval(function(){
      install();
      tries++;
      if(tries >= 30)clearInterval(timer);
    },500);
    window.addEventListener('load',install,{once:true});
  }

  if(document.readyState === 'loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
