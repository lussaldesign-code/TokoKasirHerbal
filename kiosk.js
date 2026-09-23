/* Username-only kiosk login + modern responsive UI. */
(function(){
  const KKEY='tokokasirherbal-kiosk-user';
  const q=id=>document.getElementById(id);
  const client=()=>window.supabase.createClient(window.APP_CONFIG.url,window.APP_CONFIG.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'tokokasirherbal-auth'}});

  // Modern responsive visual layer: desktop + mobile, gradients, glass cards and smooth pop-up motion.
  const style=document.createElement('style');
  style.id='herbal-modern-ui';
  style.textContent=`
  :root{--p:#0f9f6e;--p2:#22c55e;--ink:#172033;--muted:#64748b;--bg:#eef7f3;--line:#dce8e3;--shadow:0 14px 40px rgba(15,55,40,.10);--radius:18px}
  body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;background:radial-gradient(circle at 10% 0%,#dcfce7 0,#eef7f3 34%,#f8fafc 100%);color:var(--ink)}
  .card{border:1px solid rgba(255,255,255,.75);border-radius:var(--radius);box-shadow:var(--shadow);background:rgba(255,255,255,.92);backdrop-filter:blur(12px)}
  .app{gap:18px;padding:18px;max-width:1700px;margin:auto}
  .side{width:92px;padding:14px 10px;gap:10px;border-radius:22px;background:linear-gradient(180deg,#ffffff,#f0faf5);box-shadow:0 16px 45px rgba(15,55,40,.13)}
  .nav{width:72px;height:66px;border-radius:16px;background:transparent;transition:.22s ease;position:relative}
  .nav:hover{transform:translateY(-2px);background:#e7f8ef;box-shadow:0 8px 20px rgba(16,185,129,.12)}
  .nav.active{background:linear-gradient(135deg,#d9fbe9,#effff6);color:#087f58;box-shadow:inset 0 0 0 1px #c8f0da}
  .nav span{margin-bottom:3px}
  .main{min-height:calc(100vh - 36px)}
  .head{padding:16px 20px;border-bottom:1px solid rgba(220,232,227,.8);background:linear-gradient(90deg,rgba(255,255,255,.98),rgba(244,252,248,.9));border-radius:18px 18px 0 0}
  .head h2{margin:0;font-size:21px;letter-spacing:-.3px}
  .tools input,.tools select,.field input,.field select{border:1px solid #d8e6df;border-radius:12px;background:#fff;transition:.2s;outline:none}
  .tools input:focus,.tools select:focus,.field input:focus,.field select:focus{border-color:#55c992;box-shadow:0 0 0 4px rgba(34,197,94,.10)}
  .btn{border-radius:12px;transition:.2s;box-shadow:0 6px 16px rgba(15,55,40,.08)}
  .btn:hover{transform:translateY(-1px);box-shadow:0 10px 22px rgba(15,55,40,.13)}
  .primary{background:linear-gradient(135deg,#0f9f6e,#22c55e)}
  .danger{background:linear-gradient(135deg,#ef4444,#f97316)}
  .secondary{background:linear-gradient(135deg,#64748b,#475569)}
  .products,.tablebox{padding:18px}
  .rak{padding:2px 0 12px}
  .rak h3{border:0;padding:10px 2px;margin:0 0 8px;color:#276749;font-size:14px;display:flex;align-items:center;gap:8px}
  .rak h3:after{content:"";height:1px;background:linear-gradient(90deg,#b7e8ce,transparent);flex:1}
  .grid{gap:14px}
  .product{border:1px solid #e0ebe6;border-radius:16px;background:linear-gradient(145deg,#fff,#f5fbf8);box-shadow:0 7px 20px rgba(15,55,40,.07);transition:.22s;animation:rise .32s ease both}
  .product:hover{transform:translateY(-4px);box-shadow:0 16px 30px rgba(15,55,40,.13);border-color:#b7e8ce}
  .product img{height:115px;background:linear-gradient(135deg,#edf8f2,#dff5e8)}
  .info{padding:11px}
  .price{color:#0b8b60}
  .cartpanel{box-shadow:var(--shadow)}
  .cartitem{padding:12px 4px;border-bottom:1px dashed #d9e7e1}
  .footer{background:linear-gradient(180deg,#fbfffd,#eef9f4);border-radius:0 0 18px 18px}
  .total b{background:linear-gradient(135deg,#087f58,#22a96d);-webkit-background-clip:text;background-clip:text;color:transparent}
  .metric{border:1px solid #e0ebe6;background:linear-gradient(135deg,#fff,#effaf5);border-radius:16px;box-shadow:0 8px 22px rgba(15,55,40,.07);transition:.2s}
  .metric:hover{transform:translateY(-3px)}
  .metric b{font-size:22px;color:#087f58}
  .tablebox table{border-collapse:separate;border-spacing:0 6px}
  .tablebox th{color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.05em;border:0}
  .tablebox td{background:#fff;border-top:1px solid #e7efeb;border-bottom:1px solid #e7efeb}
  .tablebox td:first-child{border-left:1px solid #e7efeb;border-radius:10px 0 0 10px}.tablebox td:last-child{border-right:1px solid #e7efeb;border-radius:0 10px 10px 0}
  .modal{background:rgba(10,25,20,.58);backdrop-filter:blur(7px)}
  .modalbox{border:1px solid rgba(255,255,255,.8);border-radius:22px;box-shadow:0 28px 80px rgba(0,0,0,.22);animation:pop .22s cubic-bezier(.2,.8,.2,1)}
  .toast{border-radius:13px;box-shadow:0 14px 35px rgba(0,0,0,.2);animation:toastIn .25s ease}
  .login{background:radial-gradient(circle at 20% 15%,#bbf7d0 0,#e8f8f0 35%,#f8fafc 100%)}
  .login-box{padding:36px;border-radius:26px!important;box-shadow:0 25px 80px rgba(15,55,40,.16)!important;animation:pop .45s cubic-bezier(.2,.8,.2,1)}
  .login-box h1{background:linear-gradient(135deg,#087f58,#22c55e);-webkit-background-clip:text;background-clip:text;color:transparent}
  @keyframes pop{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}
  @keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  @keyframes toastIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
  @media(max-width:900px){.app{padding:9px;gap:8px}.main{height:calc(100vh - 70px);min-height:0;padding-bottom:64px}.side{height:62px;padding:5px;gap:2px;border-radius:18px 18px 0 0;box-shadow:0 -8px 28px rgba(15,55,40,.12)}.nav{height:52px;border-radius:13px;font-size:10px}.nav span{font-size:20px}.head{padding:13px 14px}.head h2{font-size:18px}.tools{gap:7px}.products,.tablebox{padding:12px}.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.product img{height:100px}.cartpanel{min-height:360px}.dash{gap:9px;padding:12px}.metric{padding:14px}.tablebox{overflow-x:auto}.tablebox table{min-width:650px}.modal{padding:10px}.modalbox{max-height:88vh;padding:17px;border-radius:19px}.login{padding:15px}.login-box{padding:25px}}
  @media(min-width:901px) and (max-width:1200px){.side{width:78px}.nav{width:62px}.cartpanel{min-width:300px}.grid{grid-template-columns:repeat(auto-fill,minmax(130px,1fr))}}
  `;
  document.head.appendChild(style);

  function setLoginUI(){const box=document.querySelector('#login .login-box');if(!box)return;box.innerHTML='<div style="text-align:center;margin-bottom:22px"><div style="font-size:48px;filter:drop-shadow(0 8px 12px rgba(16,185,129,.18))">🌿</div><h1 style="margin:8px 0">Herbalinovasi POS</h1><p class="note">Kasir modern • masuk dengan nama akun</p></div><div class="field"><label>Nama Akun</label><input id="kioskUsername" autocomplete="username" placeholder="Contoh: admin" onkeydown="if(event.key===\'Enter\')kioskLogin()"></div><button class="btn primary" style="width:100%;font-size:16px;padding:13px" onclick="kioskLogin()">Masuk ke Kasir →</button>'}
  async function ensureSession(){if(!window.APP_CONFIG?.url||!window.APP_CONFIG?.key)throw Error('Konfigurasi Supabase belum tersedia.');window.sb=client();sb=window.sb;let s=(await sb.auth.getSession()).data.session;if(s)return s;const r=await sb.auth.signInAnonymously();if(r.error)throw new Error('Gagal membuat sesi Supabase: '+r.error.message);if(!r.data?.session)throw new Error('Supabase tidak mengembalikan sesi.');return r.data.session}
  async function kioskLogin(){try{const u=(q('kioskUsername')?.value||'').trim().toLowerCase();if(!u)return window.toast('Masukkan nama akun.');const s=await ensureSession();currentUser=s.user;const {data,error}=await sb.rpc('kiosk_login',{p_username:u});if(error)throw error;if(!data?.length)throw new Error('Akun tidak ditemukan atau nonaktif.');localStorage.setItem(KKEY,u);await kioskLoadProfile();showApp();await loadAll()}catch(e){console.error(e);window.toast(e.message||'Login gagal')}}
  async function kioskRestore(){try{if(!window.APP_CONFIG?.url||!window.APP_CONFIG?.key)return;window.sb=client();sb=window.sb;const u=localStorage.getItem(KKEY);if(!u){setLoginUI();return}const s=(await sb.auth.getSession()).data.session;if(!s){localStorage.removeItem(KKEY);setLoginUI();return}currentUser=s.user;const {data,error}=await sb.rpc('kiosk_login',{p_username:u});if(error||!data?.length){localStorage.removeItem(KKEY);await sb.auth.signOut();setLoginUI();return}await kioskLoadProfile();if(!profile?.aktif){localStorage.removeItem(KKEY);await sb.auth.signOut();setLoginUI();return}showApp();await loadAll()}catch(e){console.error(e);localStorage.removeItem(KKEY);setLoginUI()}}
  async function kioskLogout(){localStorage.removeItem(KKEY);if(window.sb?.auth)await window.sb.auth.signOut();location.reload()}
  async function kioskLoadProfile(){const u=localStorage.getItem(KKEY);if(!u)throw Error('Akun belum dipilih.');const {data,error}=await sb.rpc('kiosk_profile',{p_username:u});if(error)throw error;if(!data?.length)throw Error('Profile akun belum tersedia.');profile=data[0]}
  window.kioskLogin=kioskLogin;window.kioskLogout=kioskLogout;window.login=kioskLogin;window.logout=kioskLogout;
  window.addEventListener('load',()=>{if(!window.APP_CONFIG?.url||!window.APP_CONFIG?.key||!window.supabase?.createClient)return;setLoginUI();kioskRestore()});
})();
