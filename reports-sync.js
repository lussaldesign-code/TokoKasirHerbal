/* Sinkronisasi laporan dengan retur penjualan/pembelian. */
(function(){
  function dayOf(v){
    const d=new Date(v);
    if(Number.isNaN(d.getTime())) return '';
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function monthOf(v){ return dayOf(v).slice(0,7); }
  function money(v){ return typeof rp==='function' ? rp(v) : 'Rp '+Number(v||0).toLocaleString('id-ID'); }

  window.renderReports=function(){
    const now=new Date(), day=dayOf(now), month=monthOf(now);
    const ss=Array.isArray(sales)?sales:[];
    const si=Array.isArray(saleItems)?saleItems:[];
    const sr=Array.isArray(saleReturns)?saleReturns:[];
    const sri=Array.isArray(saleReturnItems)?saleReturnItems:[];
    const pr=Array.isArray(purchaseReturns)?purchaseReturns:[];
    const pri=Array.isArray(purchaseReturnItems)?purchaseReturnItems:[];
    const rcp=Array.isArray(receivablePayments)?receivablePayments:[];
    const ags=Array.isArray(agents)?agents:[];

    // Retur dihitung berdasarkan tanggal RETUR, sehingga laporan langsung berubah
    // saat retur dicatat, termasuk retur atas transaksi hari sebelumnya.
    const returnedQtyBySaleItem={};
    const returnedValueBySaleItem={};
    sri.forEach(r=>{
      returnedQtyBySaleItem[r.sale_item_id]=(returnedQtyBySaleItem[r.sale_item_id]||0)+Number(r.qty||0);
      returnedValueBySaleItem[r.sale_item_id]=(returnedValueBySaleItem[r.sale_item_id]||0)+Number(r.subtotal||0);
    });

    const saleReturnToday=sr.filter(r=>dayOf(r.created_at)===day);
    const saleReturnMonth=sr.filter(r=>monthOf(r.created_at)===month);
    const returnHari=saleReturnToday.reduce((a,r)=>a+Number(r.total||0),0);
    const returnBulan=saleReturnMonth.reduce((a,r)=>a+Number(r.total||0),0);
    const returnQtyHari=sri.filter(r=>saleReturnToday.some(x=>x.id===r.sale_return_id)).reduce((a,r)=>a+Number(r.qty||0),0);
    const returnQtyBulan=sri.filter(r=>saleReturnMonth.some(x=>x.id===r.sale_return_id)).reduce((a,r)=>a+Number(r.qty||0),0);
    const purchaseReturnToday=pr.filter(r=>dayOf(r.created_at)===day);
    const purchaseReturnMonth=pr.filter(r=>monthOf(r.created_at)===month);
    const purchaseToday=(Array.isArray(purchases)?purchases:[]).filter(p=>dayOf(p.created_at||p.tanggal)===day);
    const purchaseMonth=(Array.isArray(purchases)?purchases:[]).filter(p=>monthOf(p.created_at||p.tanggal)===month);
    const purchaseReturnValueToday=purchaseReturnToday.reduce((a,r)=>a+Number(r.total||0),0);
    const purchaseReturnValueMonth=purchaseReturnMonth.reduce((a,r)=>a+Number(r.total||0),0);
    const purchaseGrossToday=purchaseToday.reduce((a,p)=>a+Number(p.total||0),0);
    const purchaseGrossMonth=purchaseMonth.reduce((a,p)=>a+Number(p.total||0),0);
    const purchaseNetToday=Math.max(0,purchaseGrossToday-purchaseReturnValueToday);
    const purchaseNetMonth=Math.max(0,purchaseGrossMonth-purchaseReturnValueMonth);

    const ds=ss.filter(s=>dayOf(s.created_at)===day);
    const ms=ss.filter(s=>monthOf(s.created_at)===month);
    const dpHari=ds.reduce((a,s)=>a+Number(s.dibayar||0),0);
    const pelunasanHari=rcp.filter(p=>dayOf(p.created_at)===day).reduce((a,p)=>a+Number(p.jumlah||0),0);
    const income=dpHari+pelunasanHari-returnHari;

    const monthInitial=ms.reduce((a,s)=>a+Number(s.dibayar||0),0);
    const monthPayments=rcp.filter(p=>monthOf(p.created_at)===month).reduce((a,p)=>a+Number(p.jumlah||0),0);
    const mincome=monthInitial+monthPayments-returnBulan;

    const outstanding=(Array.isArray(receivables)?receivables:[]).reduce((a,r)=>a+Number(r.sisa||0),0);

    // Produk terjual bersih = penjualan pada hari tersebut dikurangi retur
    // yang terjadi pada hari tersebut.
    const items=si.filter(i=>ds.some(s=>s.id===i.sale_id));
    const productMap={};
    items.forEach(i=>{
      const returned=returnedQtyBySaleItem[i.id]||0;
      const netQty=Math.max(0,Number(i.qty||0)-returned);
      const netTotal=Math.max(0,Number(i.subtotal||0)-(returnedValueBySaleItem[i.id]||0));
      if(!productMap[i.product_id||i.nama_produk])productMap[i.product_id||i.nama_produk]={nama:i.nama_produk||'Produk',qty:0,total:0};
      productMap[i.product_id||i.nama_produk].qty+=netQty;
      productMap[i.product_id||i.nama_produk].total+=netTotal;
    });
    // Retur hari ini dari transaksi lama tetap muncul sebagai pengurang di produk.
    sri.filter(r=>saleReturnToday.some(x=>x.id===r.sale_return_id)).forEach(r=>{
      const original=si.find(i=>i.id===r.sale_item_id);
      if(original && !ds.some(s=>s.id===original.sale_id)){
        const k=original.product_id||original.nama_produk;
        if(!productMap[k])productMap[k]={nama:original.nama_produk||'Produk',qty:0,total:0};
        productMap[k].qty-=Number(r.qty||0);
        productMap[k].total-=Number(r.subtotal||0);
      }
    });
    const itemRows=Object.values(productMap).filter(x=>x.qty!==0||x.total!==0).sort((a,b)=>b.total-a.total);

    if($('income'))$('income').textContent=money(income);
    if($('sold'))$('sold').textContent=ds.length+' transaksi';
    if($('stock'))$('stock').textContent=(Array.isArray(products)?products:[]).reduce((a,p)=>a+Number(p.stok||0),0)+' Pcs';
    if($('monthIncome'))$('monthIncome').textContent=money(mincome);
    if($('monthSold'))$('monthSold').textContent=ms.length+' transaksi';
    if($('debtTotal'))$('debtTotal').textContent=money(outstanding);
    if($('cashIncome'))$('cashIncome').textContent=money(dpHari);
    if($('debtPaymentIncome'))$('debtPaymentIncome').textContent=money(pelunasanHari);
    if($('soldQty'))$('soldQty').textContent=itemRows.reduce((a,x)=>a+x.qty,0)+' Pcs';
    if($('reportDate'))$('reportDate').textContent=now.toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});

    // Tambahkan informasi retur tanpa mengubah struktur HTML lama.
    const reportTab=$('tab-laporan');
    if(reportTab){
      let box=$('reportReturnSummary');
      if(!box){
        box=document.createElement('div');
        box.id='reportReturnSummary';
        box.className='dash';
        reportTab.insertBefore(box,reportTab.firstChild);
      }
      box.innerHTML='<div class="metric card"><span>Retur Penjualan Hari Ini</span><b>'+money(returnHari)+'</b><small class="note">'+returnQtyHari+' Pcs dikembalikan</small></div>'+
        '<div class="metric card"><span>Retur Penjualan Bulan Ini</span><b>'+money(returnBulan)+'</b><small class="note">'+returnQtyBulan+' Pcs dikembalikan</small></div>';
    }

    $('sales').innerHTML=ds.map(s=>{
      const ag=ags.find(a=>a.id===s.agent_id);
      const returned=sr.filter(r=>r.sale_id===s.id).reduce((a,r)=>a+Number(r.total||0),0);
      const net=Math.max(0,Number(s.total||0)-returned);
      const status=returned>0?' <span class="note">• Retur '+money(returned)+' • Bersih '+money(net)+'</span>':'';
      return '<tr><td>'+new Date(s.created_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})+
        '</td><td><b>'+esc(s.nomor_transaksi)+'</b></td><td>'+esc(ag?.nama||'Umum')+
        '</td><td>'+money(net)+status+'</td><td>'+money(s.dibayar)+
        '</td><td>'+money(Math.max(0,net-Number(s.dibayar||0)))+
        '</td><td>'+esc(reportPaymentLabel(s))+'<br><button class="btn danger" style="margin-top:5px" onclick="openSaleReturn(\''+s.id+'\')">↩ Retur</button></td></tr>';
    }).join('')||'<tr><td colspan="7" class="note">Belum ada penjualan hari ini.</td></tr>';

    if($('monthlySales'))$('monthlySales').innerHTML=ms.map(s=>{
      const returned=sr.filter(r=>r.sale_id===s.id).reduce((a,r)=>a+Number(r.total||0),0);
      const net=Math.max(0,Number(s.total||0)-returned);
      return '<tr><td>'+new Date(s.created_at).toLocaleDateString('id-ID')+'</td><td>'+esc(s.nomor_transaksi)+'</td><td>'+money(net)+'</td><td>'+money(s.dibayar)+'</td><td>'+esc(reportPaymentLabel(s))+(returned?' <span class="note">Retur '+money(returned)+'</span>':'')+'</td></tr>';
    }).join('')||'<tr><td colspan="5" class="note">Belum ada penjualan bulan ini.</td></tr>';

    if($('soldProducts'))$('soldProducts').innerHTML=itemRows.map((x,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(x.nama)+'</td><td>'+x.qty+'</td><td>'+money(x.total)+'</td></tr>').join('')||'<tr><td colspan="4" class="note">Belum ada produk terjual hari ini.</td></tr>';

    if($('paymentRows')){
      const rows=[
        ...ds.map(s=>({tanggal:s.created_at,nomor:s.nomor_transaksi,keterangan:'Pembayaran transaksi '+s.nomor_transaksi,jumlah:Number(s.dibayar||0)})),
        ...rcp.filter(p=>dayOf(p.created_at)===day).map(p=>({tanggal:p.created_at,nomor:'Piutang',keterangan:p.keterangan||'Pembayaran piutang',jumlah:Number(p.jumlah||0)})),
        ...saleReturnToday.map(r=>({tanggal:r.created_at,nomor:'Retur',keterangan:'Retur penjualan'+(r.alasan?' — '+r.alasan:''),jumlah:-Number(r.total||0)})),
        ...purchaseReturnToday.map(r=>({tanggal:r.created_at,nomor:'Retur Pembelian',keterangan:'Retur pembelian ke supplier'+(r.alasan?' — '+r.alasan:''),jumlah:0}))
      ].filter(x=>x.jumlah!==0).sort((a,b)=>new Date(b.tanggal)-new Date(a.tanggal));
      $('paymentRows').innerHTML=rows.map(x=>'<tr><td>'+new Date(x.tanggal).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})+'</td><td>'+esc(x.nomor)+'</td><td>'+esc(x.keterangan)+'</td><td>'+money(x.jumlah)+'</td></tr>').join('')||'<tr><td colspan="4" class="note">Belum ada penerimaan hari ini.</td></tr>';
    }
  };
})();