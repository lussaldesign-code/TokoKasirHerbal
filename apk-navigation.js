/* APK-ONLY navigation gestures. Requires Capacitor; login is never touched. */
(function(){
  'use strict';
  function init(){
    if(!window.Capacitor)return;
    var side=document.querySelector('body.app-screen .side');
    if(!side || side.dataset.apkNavV2==='1')return;
    side.dataset.apkNavV2='1';

    var handle=document.createElement('div');
    handle.className='apk-nav-handle';
    handle.setAttribute('aria-label','Tarik menu');
    side.appendChild(handle);

    var startX=0,startY=0,lastX=0,lastY=0,axis=null,dragging=false,hidden=false;
    var baseY=0,navHeight=70;

    function height(){ return side.getBoundingClientRect().height || navHeight; }
    function setHidden(v,animate){
      hidden=!!v;
      side.classList.toggle('apk-nav-hidden',hidden);
      if(animate) side.style.transform='';
    }
    function activeIntoView(){
      if(hidden)return;
      var active=side.querySelector('.nav.active');
      if(active)active.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
    }
    function start(e){
      if(!e.touches||!e.touches[0])return;
      var t=e.touches[0];
      startX=lastX=t.clientX; startY=lastY=t.clientY;
      axis=null; dragging=true; baseY=hidden ? height()-25 : 0;
      side.classList.add('apk-nav-dragging');
    }
    function move(e){
      if(!dragging||!e.touches||!e.touches[0])return;
      var t=e.touches[0],dx=t.clientX-startX,dy=t.clientY-startY;
      lastX=t.clientX;lastY=t.clientY;
      if(!axis && Math.hypot(dx,dy)>7) axis=Math.abs(dx)>Math.abs(dy)?'x':'y';
      if(axis==='x'){
        e.preventDefault();
        side.scrollLeft-=t.clientX-startX-(lastX-t.clientX);
        startX=t.clientX;
        return;
      }
      if(axis==='y'){
        e.preventDefault();
        var next=Math.max(0,Math.min(height()-25,baseY+dy));
        side.style.transform='translate3d(0,'+next+'px,0)';
      }
    }
    function end(){
      if(!dragging)return;
      var dy=lastY-startY;
      side.classList.remove('apk-nav-dragging');
      dragging=false;
      if(axis==='y'){
        var h=height();
        if(dy>35) setHidden(true,true);
        else if(dy<-35) setHidden(false,true);
        else setHidden(hidden,true);
      }
      axis=null;
      setTimeout(activeIntoView,30);
    }

    side.addEventListener('touchstart',start,{passive:true});
    side.addEventListener('touchmove',move,{passive:false});
    side.addEventListener('touchend',end,{passive:true});
    side.addEventListener('touchcancel',end,{passive:true});

    /* Mouse/trackpad support when the APK is tested on a desktop. */
    side.addEventListener('wheel',function(e){
      if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){
        e.preventDefault();
        side.scrollLeft+=e.deltaY;
      }
    },{passive:false});

    new MutationObserver(function(){
      if(!hidden)activeIntoView();
    }).observe(side,{subtree:true,attributes:true,attributeFilter:['class']});
    window.addEventListener('resize',activeIntoView,{passive:true});
    setTimeout(activeIntoView,250);
    setTimeout(activeIntoView,1000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
  window.addEventListener('load',init);
})();
