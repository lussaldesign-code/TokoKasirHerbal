// Supabase browser configuration.
// Gunakan publishable key / anon key saja. JANGAN pernah menaruh service_role/secret key di sini.
window.APP_CONFIG = {
  url: 'https://geoedddgvzvqsykuekdw.supabase.co',
  key: 'sb_publishable_8-kbY1H5hvOd56kzMhOEdA_wgQ_2iyW'
};

// The original app creates its client with persistSession:false.
// Patch that setting before app.js runs so the login survives page reloads.
if (window.supabase?.createClient) {
  const originalCreateClient = window.supabase.createClient.bind(window.supabase);
  window.supabase.createClient = function(url, key, options) {
    options = options || {};
    options.auth = Object.assign({}, options.auth || {}, {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'tokokasirherbal-auth'
    });
    return originalCreateClient(url, key, options);
  };
}

// app.js currently only signs in; it does not restore an existing session on reload.
// Run after its load handler has created the client, then restore the saved session.
window.addEventListener('load', function(){
  setTimeout(async function(){
    try {
      if (!window.supabase?.createClient) return;
      sb = window.supabase.createClient(window.APP_CONFIG.url, window.APP_CONFIG.key);
      const {data, error} = await sb.auth.getSession();
      if (error) throw error;
      if (!data?.session?.user) return;
      currentUser = data.session.user;
      await loadProfile();
      if (!profile?.aktif) { await sb.auth.signOut(); return; }
      showApp();
      await loadAll();
    } catch (e) {
      console.error('Session restore failed:', e);
    }
  }, 0);
});
