#!/usr/bin/env bash
set -e
SRC="android/app/src/main/java/com/lussaldesign/tokokasirlussal"
mkdir -p "$SRC"
cat > "$SRC/UpdateBridge.java" <<'JAVA'
package com.lussaldesign.tokokasirlussal;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import java.util.Locale;

public class UpdateBridge {
    private final Context context;
    private final DownloadManager manager;
    public UpdateBridge(Context context) {
        this.context=context.getApplicationContext();
        this.manager=(DownloadManager)context.getSystemService(Context.DOWNLOAD_SERVICE);
    }
    @JavascriptInterface public String downloadApk(String url, String version) {
        try {
            DownloadManager.Request request=new DownloadManager.Request(Uri.parse(url));
            request.setTitle("TokoKasirLussal update");
            request.setDescription("Mengunduh update aplikasi...");
            request.setMimeType("application/vnd.android.package-archive");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setAllowedOverMetered(true);
            request.setAllowedOverRoaming(false);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS,
                "TokoKasirLussal-update-v"+(version==null||version.isEmpty()?"latest":version)+".apk");
            return String.valueOf(manager.enqueue(request));
        } catch(Exception e) { return "0"; }
    }
    @JavascriptInterface public String getStatus(String idText) {
        DownloadManager.Query query=new DownloadManager.Query();
        try {
            long id=Long.parseLong(idText);
            query.setFilterById(id);
            android.database.Cursor c=manager.query(query);
            if(c==null)return "{\"status\":\"error\",\"message\":\"DownloadManager tidak tersedia.\"}";
            try {
                if(!c.moveToFirst())return "{\"status\":\"error\",\"message\":\"Download tidak ditemukan.\"}";
                int st=c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                long received=c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
                long total=c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
                if(st==DownloadManager.STATUS_SUCCESSFUL)return json("success",received,total,"");
                if(st==DownloadManager.STATUS_FAILED) {
                    int reason=c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON));
                    return json("failed",received,total,"DownloadManager error "+reason);
                }
                return json("downloading",received,total,"");
            } finally { c.close(); }
        } catch(Exception e) {
            return "{\"status\":\"error\",\"message\":\"" + escape(e.getMessage()) + "\"}";
        }
    }
    @JavascriptInterface public String installApk(String idText) {
        try {
            long id=Long.parseLong(idText);
            Uri uri=manager.getUriForDownloadedFile(id);
            if(uri==null)return "File update belum selesai diunduh.";
            if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.O && !context.getPackageManager().canRequestPackageInstalls()) {
                Intent settings=new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:"+context.getPackageName()));
                settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(settings);
                return "permission";
            }
            Intent intent=new Intent(Intent.ACTION_INSTALL_PACKAGE);
            intent.setDataAndType(uri,"application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            return "ok";
        } catch(Exception e) { return "error: "+e.getMessage(); }
    }
    private static String json(String status,long received,long total,String message) {
        return String.format(Locale.US,
            "{\"status\":\"%s\",\"received\":%d,\"total\":%d,\"message\":\"%s\"}",
            status,received,total,escape(message));
    }
    private static String escape(String s) {
        return s==null?"":s.replace("\\","\\\\").replace("\"","\\\"").replace("\n"," ");
    }
}
JAVA
cat > "$SRC/MainActivity.java" <<'JAVA'
package com.lussaldesign.tokokasirlussal;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView webView=getBridge().getWebView();
        if(webView!=null) webView.addJavascriptInterface(new UpdateBridge(this),"AndroidUpdater");
    }
}
JAVA
python3 - <<'PY'
from pathlib import Path
p=Path("android/app/src/main/AndroidManifest.xml")
s=p.read_text(encoding="utf-8")
perm='<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES"/>\n'
if 'android.permission.REQUEST_INSTALL_PACKAGES' not in s:
    start=s.find("<manifest")
    idx=s.find(">", start)
    if start < 0 or idx < 0: raise SystemExit("Manifest root tag not found")
    s=s[:idx+1]+"\n"+perm+s[idx+1:]
p.write_text(s, encoding="utf-8")
PY
