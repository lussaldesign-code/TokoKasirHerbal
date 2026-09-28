const APP_VERSION='1.0.30';
const UPDATE_MANIFEST_URL=new URL('update.json',location.href).href;
const UPDATE_MANIFEST_FALLBACK='https://raw.githubusercontent.com/lussaldesign-code/TokoKasirHerbal/main/update.json';
const IS_ELECTRON=!!(navigator.userAgent&&/Electron/i.test(navigator.userAgent));
const IS_APK=!!window.Capacitor;
const IS_WEB=!IS_ELECTRON&&!IS_APK;
const WEB_VERSION_URL=new URL('web-version.json',location.href).href;
const CONFIG=window.APP_CONFIG||{url:'',key:''};
let sb=null,currentUser=null,profile=null,products=[],agents=[],receivables=[],sales=[],saleItems=[],saleReturnItems=[],receivablePayments=[],users=[],purchases=[],purchaseItems=[],purchaseReturnItems=[],saleReturns=[],purchaseReturns=[],cart=[],purchaseCart=[],priceProduct=null,selectedProductImage='';
// Expose the live products array to the notification module without changing
// the application's internal state. Top-level `let products` is lexical and
// therefore is not available as window.products to separately loaded scripts.
try{Object.defineProperty(window,'products',{configurable:true,get:()=>products})}catch(e){console.warn('[products-bridge]',e)}
let catalogRacks=[];
let lastCompletedTransaction=null;
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
