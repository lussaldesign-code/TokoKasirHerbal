/* Username-only kiosk login. Uses Supabase Anonymous Auth for a real session, while the operator selects a named account. */
(function(){
  const KKEY='tokokasirherbal-kiosk-user';
  let kioskAccounts=[];
  const q=id=>document.getElementById(id);
  const escK=s=>String(s??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
  function kioskClient(){
    return window.supabase.createClient(window.APP_CONFIG.url,window.APP_CONFIG.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'tokokasirherbal-kiosk-auth'}});
  }
  function setLoginUI(){
    const box=document.querySelector('#login .login-box'); if(!box)return;
    box.innerHTML='<div style="text-align:center;margin-bottom:22px"><div style="font-size:46px">🌿</div><h1 style="margin:8px 0">Herbalinovasi POS</h1><p class="note">Masuk dengan nama akun. Tidak perlu email atau password.</p></div><div class="field"><label>Nama Akun</label><input id="kioskUsername" autocomplete="username" placeholder="Contoh: admin" onkeydown="if(event.key===\'Enter\')kioskLogin()"></div><button class="btn primary" style="width:100%;font-size:16px;padding:12px" onclick="kioskLogin()">Masuk</button><p class="note" style="margin-top:14px;text-align:center">Gunakan akun yang dibuat oleh Admin.</p>';
  }
  async function kioskLogin(){
    try{
      const username=(q('kioskUsername')?.value||'').trim().toLowerCase();
      if(!username)return window.toast('Masukkan nama akun.');
      if(!window.sb||!window.sb.auth) window.sb=kioskClient();
      let session=(await window.sb.auth.getSession()).data.session;
      if(!session){
        const {data,error}=await window.sb.auth.signInAnonymously();
        if(error)throw new Error(error.message+' Aktifkan Anonymous Sign-Ins di Supabase > Authentication > Providers.');
        session=data.session;
      }
      window.currentUser=session.user;
      const {data,error}=await window.sb.rpc('kiosk_login',{p_username:username});
      if(error)throw error;
      if(!data?.length)throw new Error('Akun tidak ditemukan.');
      localStorage.setItem(KKEY,username);
      await window.loadProfile();
      window.showApp();
      await window.loadAll();
    }catch(e){console.error('kioskLogin',e);window.toast(e.message||'Gagal masuk');}
  }
  async function kioskRestore(){
    try{
      window.sb=kioskClient();
      const {data}=await window.sb.auth.getSession();
      const username=localStorage.getItem(KKEY);
      if(!data?.session||!username){setLoginUI();return;}
      window.currentUser=data.session.user;
      const {data:loginData,error}=await window.sb.rpc('kiosk_login',{p_username:username});
      if(error||!loginData?.length){localStorage.removeItem(KKEY);await window.sb.auth.signOut();setLoginUI();return;}
      await window.loadProfile();
      if(!window.profile?.aktif){localStorage.removeItem(KKEY);await window.sb.auth.signOut();setLoginUI();return;}
      window.showApp();await window.loadAll();
    }catch(e){console.error('kioskRestore',e);localStorage.removeItem(KKEY);setLoginUI();}
  }
  async function kioskLogout(){localStorage.removeItem(KKEY);if(window.sb?.auth)await window.sb.auth.signOut();location.reload();}
  async function kioskLoadProfile(){
    if(!window.currentUser?.id)throw Error('Sesi aplikasi tidak valid.');
    const username=localStorage.getItem(KKEY);if(!username)throw Error('Akun belum dipilih.');
    const {data,error}=await window.sb.from('users').select('*').eq('username',username).maybeSingle();
    if(error)throw error;if(!data)throw Error('Profile akun belum tersedia.');window.profile=data;
  }
  async function loadAccounts(){
    const {data,error}=await window.sb.rpc('list_login_accounts');
    if(error)throw error;kioskAccounts=data||[];renderAccounts();
  }
  function renderAccounts(){
    const body=q('users');if(!body)return;
    body.innerHTML=kioskAccounts.map(a=>'<tr><td>'+escK(a.nama)+'</td><td>'+escK(a.username)+'</td><td><select onchange="kioskChangeRole(\''+a.id+'\',this.value)" '+(a.id===kioskAccounts.find(x=>x.username===localStorage.getItem(KKEY))?.id?'disabled':'')+'><option value="karyawan" '+(a.role==='karyawan'?'selected':'')+'>Karyawan</option><option value="admin" '+(a.role==='admin'?'selected':'')+'>Admin</option></select></td><td>'+(a.aktif?'Aktif':'Nonaktif')+'</td><td><button class="btn secondary" onclick="kioskToggle(\''+a.id+'\','+(!a.aktif)+')">'+(a.aktif?'Nonaktifkan':'Aktifkan')+'</button></td></tr>').join('');
  }
  async function kioskChangeRole(id,role){try{const {error}=await window.sb.rpc('update_login_account',{p_id:id,p_nama:kioskAccounts.find(a=>a.id===id)?.nama||'',p_role:role});if(error)throw error;await loadAccounts();window.toast('Role akun diperbarui.');}catch(e){window.toast(e.message);await loadAccounts();}}
  async function kioskToggle(id,aktif){try{if(!confirm(aktif?'Aktifkan akun ini?':'Nonaktifkan akun ini?'))return;const current=kioskAccounts.find(a=>a.id===id);if(current?.username===localStorage.getItem(KKEY)&&!aktif)return window.toast('Akun yang sedang digunakan tidak dapat dinonaktifkan.');const {error}=await window.sb.rpc('toggle_login_account',{p_id:id,p_aktif:aktif});if(error)throw error;await loadAccounts();window.toast(aktif?'Akun diaktifkan.':'Akun dinonaktifkan.');}catch(e){window.toast(e.message)}}
  async function kioskCreateAccount(){
    try{const u=(q('newKioskUsername')?.value||'').trim().toLowerCase(),n=(q('newKioskName')?.value||'').trim(),r=q('newKioskRole')?.value||'karyawan';if(!u||!n)return window.toast('Nama akun dan nama lengkap wajib diisi.');const {error}=await window.sb.rpc('create_login_account',{p_username:u,p_nama:n,p_role:r});if(error)throw error;q('newKioskUsername').value='';q('newKioskName').value='';q('newKioskRole').value='karyawan';await loadAccounts();window.toast('Akun '+u+' berhasil dibuat.');}catch(e){window.toast(e.message||'Gagal membuat akun.')}}
  function injectAccountUI(){
    const head=document.querySelector('#tab-akun .head');if(head&&!document.getElementById('newKioskUsername')){const b=document.createElement('button');b.className='btn primary';b.textContent='+ Buat Akun';b.onclick=()=>q('kioskAccountModal').classList.add('show');head.appendChild(b);}
    if(!q('kioskAccountModal')){const d=document.createElement('div');d.id='kioskAccountModal';d.className='modal';d.innerHTML='<div class="modalbox"><h3>Buat Akun Baru</h3><div class="field"><label>Nama Akun</label><input id="newKioskUsername" placeholder="contoh: kasir1"></div><div class="field"><label>Nama Lengkap</label><input id="newKioskName" placeholder="Nama karyawan"></div><div class="field"><label>Role</label><select id="newKioskRole"><option value="karyawan">Karyawan</option><option value="admin">Admin</option></select></div><div class="actions"><button class="btn secondary" onclick="q(\'kioskAccountModal\').classList.remove(\'show\')">Batal</button><button class="btn primary" onclick="kioskCreateAccount()">Simpan Akun</button></div></div>';document.body.appendChild(d);}
  }
  window.kioskLogin=kioskLogin;window.kioskLogout=kioskLogout;window.kioskChangeRole=kioskChangeRole;window.kioskToggle=kioskToggle;window.kioskCreateAccount=kioskCreateAccount;
  window.addEventListener('load',function(){setTimeout(async function(){
    if(!window.APP_CONFIG?.url||!window.APP_CONFIG?.key||!window.supabase?.createClient)return;
    window.sb=kioskClient();
    window.login=kioskLogin;window.logout=kioskLogout;window.loadProfile=kioskLoadProfile;
    const oldRenderUsers=window.renderUsers;window.renderUsers=async function(){if(window.profile?.role==='admin'){injectAccountUI();try{await loadAccounts();}catch(e){console.error(e);}}else if(oldRenderUsers)oldRenderUsers();};
    setLoginUI();
    await kioskRestore();
    injectAccountUI();
  },100);});
})();
