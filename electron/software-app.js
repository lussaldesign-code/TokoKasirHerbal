const APP_VERSION='1.0.28';
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
async function login(){
 try{
  const pin=($('pin')?.value||'').trim();
  const username=($('username')?.value||'').trim().toLowerCase();
  if(!username)return toast(loginMode==='admin'?'Masukkan username admin terlebih dahulu.':'Masukkan username kasir terlebih dahulu.');
  if(loginMode==='admin'&&!/^[0-9]{4}$/.test(pin))return toast('PIN admin harus tepat 4 angka.');
  const btn=document.querySelector('#loginForm button[type="submit"],#loginBtn');
  if(btn){btn.disabled=true;btn.dataset.oldText=btn.textContent;btn.textContent='Memproses...';}
  if(!window.softwareAuth?.login)throw Error('Modul login Windows tidak tersedia. Silakan pasang versi software terbaru.');
  const result=await window.softwareAuth.login({mode:loginMode,username,pin});
  if(!result?.ok||!result.session?.access_token||!result.profile)throw Error('Login gagal: sesi software tidak lengkap.');
  if(!sb){
    requireConfig();
    sb=supabase.createClient(CONFIG.url,CONFIG.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'tokokasirlussal-auth'}});
  }
  const sessionResult=await sb.auth.setSession({access_token:result.session.access_token,refresh_token:result.session.refresh_token||''});
  if(sessionResult.error)throw sessionResult.error;
  currentUser=sessionResult.data?.session?.user||result.session.user;
  profile=result.profile;
  localStorage.setItem('tokokasirlussal-username',profile.username);
  showApp();
  try{await loadAll();toast('Login berhasil. Selamat datang, '+(profile.nama||profile.username)+'.');}
  catch(loadErr){console.error('loadAll after login',loadErr);toast('Login berhasil, tetapi data belum dapat dimuat: '+(loadErr?.message||'periksa data Supabase'));}
 }catch(e){
  console.error('software login',e);
  toast(String(e?.message||e||'Login gagal'));
 }finally{
  const btn=document.querySelector('#loginForm button[type="submit"],#loginBtn');
  if(btn){btn.disabled=false;btn.textContent=btn.dataset.oldText||'Login';}
 }
}
