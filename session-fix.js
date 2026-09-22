// Keeps the Supabase browser session across page reloads and restores the app automatically.
(function(){
  window.addEventListener('load', async function(){
    try {
      if (!window.APP_CONFIG?.url || !window.APP_CONFIG?.key || !window.supabase?.createClient) return;
      // app.js creates a client with persistSession:false. Replace it with a persistent client.
      sb = window.supabase.createClient(window.APP_CONFIG.url, window.APP_CONFIG.key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: 'tokokasirherbal-auth'
        }
      });
      const { data, error } = await sb.auth.getSession();
      if (error) throw error;
      if (data?.session?.user) {
        currentUser = data.session.user;
        await loadProfile();
        if (!profile?.aktif) {
          await sb.auth.signOut();
          return;
        }
        showApp();
        await loadAll();
      }
      sb.auth.onAuthStateChange(function(event, session){
        if (event === 'SIGNED_OUT') {
          currentUser = null;
          profile = null;
          location.reload();
        }
      });
    } catch (e) {
      console.error('Session restore:', e);
    }
  });
})();
