/* APK-ONLY: keep the selected feature visible inside the horizontal navigation. */
(function(){
  function setup(){
    if(!window.Capacitor)return;
    const side=document.querySelector('body.app-screen .side');
    if(!side||side.dataset.apkHorizontalNav==='1')return;
    side.dataset.apkHorizontalNav='1';
    const sync=()=>{
      const active=side.querySelector('.nav.active');
      if(active){
        active.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
      }
      side.classList.toggle('nav-scrolled-start',side.scrollLeft<=2);
      side.classList.toggle('nav-scrolled-end',side.scrollLeft+side.clientWidth>=side.scrollWidth-2);
    };
    side.addEventListener('scroll',sync,{passive:true});
    side.addEventListener('wheel',e=>{
      if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){
        side.scrollLeft+=e.deltaY;
      }
    },{passive:true});
    new MutationObserver(sync).observe(side,{subtree:true,attributes:true,attributeFilter:['class','style']});
    window.addEventListener('resize',sync,{passive:true});
    setTimeout(sync,250);
    setTimeout(sync,1000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);
  else setup();
  window.addEventListener('load',setup);
})();
