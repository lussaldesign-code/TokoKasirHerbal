// Supabase Edge Function: send-push-notification
// Requires secrets: FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY.
// This function is intentionally server-side so FCM credentials never ship in the APK.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-push-secret",
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
  const key = await crypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from(binary, c => c.charCodeAt(0)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(data)
  );
  const signed = `${data}.${b64url(String.fromCharCode(...new Uint8Array(signature)))}`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signed
    })
  });
  const tokenJson = await tokenResponse.json();
  if (!tokenResponse.ok) throw new Error(tokenJson.error_description || "FCM OAuth gagal");
  return tokenJson.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const secret = Deno.env.get("PUSH_FUNCTION_SECRET");
    if (!secret || req.headers.get("x-push-secret") !== secret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });
    }

    const body = await req.json();
    const type = body.type === "sale" || body.type === "stock_empty" ? body.type : null;
    if (!type) throw new Error("type harus sale atau stock_empty");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: devices, error: deviceError } = await supabase
      .from("push_devices")
      .select("id,token")
      .eq("enabled", true);
    if (deviceError) throw deviceError;

    const projectId = Deno.env.get("FCM_PROJECT_ID")!;
    const accessToken = await makeAccessToken(
      projectId,
      Deno.env.get("FCM_CLIENT_EMAIL")!,
      Deno.env.get("FCM_PRIVATE_KEY")!
    );

    let title = "TokoKasirLussal";
    let message = "";
    if (type === "sale") {
      title = "🛒 Penjualan Baru";
      const nomor = body.nomor_transaksi ? ` #${body.nomor_transaksi}` : "";
      const total = Number(body.total || 0).toLocaleString("id-ID");
      message = `Transaksi${nomor} • Total Rp ${total}`;
    } else {
      title = "📦 Produk Habis";
      message = `${body.nama_produk || "Produk"} stoknya sudah 0`;
    }

    const results = [];
    for (const device of devices ?? []) {
      const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: {
            token: device.token,
            notification: { title, body: message },
            data: { type, target: type === "sale" ? "laporan" : "produk" },
            android: { priority: "high", notification: { channel_id: "tokokasir" } }
          }
        })
      });
      const result = await response.json();
      if (!response.ok && String(result?.error?.status || "").toUpperCase() === "UNREGISTERED") {
        await supabase.from("push_devices").update({ enabled: false }).eq("id", device.id);
      }
      results.push({ token: device.id, ok: response.ok });
    }
    return new Response(JSON.stringify({ ok: true, type, sent: results.filter(x => x.ok).length, total: results.length }), { headers: cors });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error?.message || error) }), { status: 400, headers: cors });
  }
});
