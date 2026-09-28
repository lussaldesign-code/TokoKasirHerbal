import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Content-Type": "application/json"
};

function b64url(input: string) {
  return btoa(input).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function makeAccessToken(projectId: string, clientEmail: string, privateKey: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }));
  const data = `${header}.${claim}`;
  const pem = privateKey.replace(/\\n/g, "\n");
  const binary = atob(pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, ""));
  const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(binary, c => c.charCodeAt(0)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(data));
  const signed = `${data}.${b64url(String.fromCharCode(...new Uint8Array(signature)))}`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: signed })
  });
  const tokenJson = await tokenResponse.json();
  if (!tokenResponse.ok) throw new Error(tokenJson.error_description || "FCM OAuth gagal");
  return tokenJson.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  let eventId = "";
  try {
    const body = await req.json();
    eventId = String(body?.event_id || "");
    if (!eventId) throw new Error("event_id wajib diisi");

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) throw new Error("Konfigurasi Supabase Edge Function belum lengkap");
    const supabase = createClient(url, serviceKey);

    const { data: claimed, error: claimError } = await supabase
      .from("push_notification_queue")
      .update({ status: "processing", attempts: 1, last_error: null })
      .eq("id", eventId)
      .eq("status", "pending")
      .select("id,type,payload,attempts")
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) return new Response(JSON.stringify({ ok: true, skipped: true }), { headers: cors });

    const projectId = Deno.env.get("FCM_PROJECT_ID");
    const clientEmail = Deno.env.get("FCM_CLIENT_EMAIL");
    const privateKey = Deno.env.get("FCM_PRIVATE_KEY");
    if (!projectId || !clientEmail || !privateKey) throw new Error("FCM_PROJECT_ID, FCM_CLIENT_EMAIL, dan FCM_PRIVATE_KEY belum dikonfigurasi di Supabase");

    const { data: devices, error: deviceError } = await supabase.from("push_devices").select("id,token").eq("enabled", true);
    if (deviceError) throw deviceError;

    const accessToken = await makeAccessToken(projectId, clientEmail, privateKey);
    const payload = claimed.payload || {};
    let title = "TokoKasirLussal";
    let message = "";
    if (claimed.type === "sale") {
      title = "🛒 Penjualan Baru";
      const nomor = payload.nomor_transaksi ? ` #${payload.nomor_transaksi}` : "";
      message = `Transaksi${nomor} • Total Rp ${Number(payload.total || 0).toLocaleString("id-ID")}`;
    } else if (claimed.type === "stock_empty") {
      title = "📦 Produk Habis";
      message = `${payload.nama_produk || "Produk"} stoknya sudah 0`;
    } else throw new Error("Jenis push tidak didukung");

    let sent = 0;
    for (const device of devices ?? []) {
      const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: { token: device.token, notification: { title, body: message }, data: { type: claimed.type, target: claimed.type === "sale" ? "laporan" : "produk" }, android: { priority: "high", notification: { channel_id: "tokokasir" } } } })
      });
      const result = await response.json();
      if (response.ok) sent++;
      else if (String(result?.error?.status || "").toUpperCase() === "UNREGISTERED") await supabase.from("push_devices").update({ enabled: false, updated_at: new Date().toISOString() }).eq("id", device.id);
      else console.error("FCM send failed", result);
    }

    await supabase.from("push_notification_queue").update({ status: "sent", processed_at: new Date().toISOString(), last_error: sent === 0 && (devices?.length || 0) > 0 ? "Tidak ada perangkat yang menerima FCM" : null }).eq("id", claimed.id);
    return new Response(JSON.stringify({ ok: true, type: claimed.type, sent, total: devices?.length || 0 }), { headers: cors });
  } catch (error) {
    const message = String(error?.message || error);
    if (eventId) {
      try {
        const url = Deno.env.get("SUPABASE_URL");
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (url && serviceKey) await createClient(url, serviceKey).from("push_notification_queue").update({ status: "failed", last_error: message, processed_at: new Date().toISOString() }).eq("id", eventId);
      } catch (_) {}
    }
    return new Response(JSON.stringify({ error: message }), { status: 400, headers: cors });
  }
});
