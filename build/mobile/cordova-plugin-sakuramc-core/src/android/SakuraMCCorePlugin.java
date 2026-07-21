package com.sakuramc.core;

import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaInterface;
import org.apache.cordova.CordovaWebView;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import android.Manifest;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;
import android.provider.Settings;
import android.util.Log;
import android.webkit.MimeTypeMap;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 樱花 MC 启动器核心插件：权限管理 + 文件安装辅助
 */
public class SakuraMCCorePlugin extends CordovaPlugin {

    private static final String TAG = "SakuraMCCore";
    private static final int PERMISSION_REQUEST_CODE = 0x5A4B;
    private static final int MANAGE_STORAGE_REQUEST_CODE = 0x5A4C;
    private static final int CHOOSE_FILE_REQUEST_CODE = 0x5A4D;
    private static final int OPEN_FILE_REQUEST_CODE = 0x5A4E;

    private CallbackContext pendingCallback;
    private String pendingAction;
    private JSONArray pendingFileArgs;

    @Override
    public void initialize(CordovaInterface cordova, CordovaWebView webView) {
        super.initialize(cordova, webView);
        Log.d(TAG, "SakuraMCCorePlugin initialized");
    }

    @Override
    public boolean execute(String action, JSONArray args, CallbackContext callbackContext) throws JSONException {
        switch (action) {
            case "checkPermission":
                this.checkPermission(args.getString(0), callbackContext);
                return true;
            case "requestPermissions":
                this.requestPermissions(args, callbackContext);
                return true;
            case "requestManageExternalStorage":
                this.requestManageExternalStorage(callbackContext);
                return true;
            case "checkManageExternalStorage":
                this.checkManageExternalStorage(callbackContext);
                return true;
            case "openAppSettings":
                this.openAppSettings(callbackContext);
                return true;
            case "getPlatformInfo":
                this.getPlatformInfo(callbackContext);
                return true;
            case "getAppFilesDir":
                this.getAppFilesDir(callbackContext);
                return true;
            case "getAppExternalFilesDir":
                this.getAppExternalFilesDir(callbackContext);
                return true;
            case "openExternalFileManager":
                this.openExternalFileManager(args.optString(0), callbackContext);
                return true;
            case "chooseFile":
                this.chooseFile(args, callbackContext);
                return true;
            case "importFile":
                this.importFile(args, callbackContext);
                return true;
            case "getFileInfo":
                this.getFileInfo(args.optString(0), callbackContext);
                return true;
            case "mkdir":
                this.mkdir(args.optString(0), callbackContext);
                return true;
            case "rename":
                this.rename(args.optString(0), args.optString(1), callbackContext);
                return true;
            case "unzip":
                this.unzip(args.optString(0), args.optString(1), callbackContext);
                return true;
            case "listZip":
                this.listZip(args.optString(0), callbackContext);
                return true;
            case "shareFile":
                this.shareFile(args.optString(0), args.optString(1), callbackContext);
                return true;
            case "getImageBase64":
                this.getImageBase64(args.optString(0), args.optInt(1, 0), args.optInt(2, 0), callbackContext);
                return true;
            case "sha1File":
                this.sha1File(args.optString(0), callbackContext);
                return true;
            case "download":
                this.download(args.optString(0), args.optString(1), callbackContext);
                return true;
            case "extractAssets":
                this.extractAssets(args.optString(0), args.optString(1), callbackContext);
                return true;
            default:
                return false;
        }
    }

    private void getPlatformInfo(CallbackContext callbackContext) {
        JSONObject info = new JSONObject();
        try {
            info.put("sdkInt", Build.VERSION.SDK_INT);
            info.put("release", Build.VERSION.RELEASE);
            info.put("packageName", cordova.getActivity().getPackageName());
            callbackContext.success(info);
        } catch (JSONException e) {
            callbackContext.error(e.getMessage());
        }
    }

    private void getAppFilesDir(CallbackContext callbackContext) {
        try {
            Context context = cordova.getContext();
            File dir = context.getFilesDir();
            callbackContext.success(dir.getAbsolutePath());
        } catch (Exception e) {
            callbackContext.error(e.getMessage());
        }
    }

    private void getAppExternalFilesDir(CallbackContext callbackContext) {
        try {
            Context context = cordova.getContext();
            File dir = context.getExternalFilesDir(null);
            if (dir == null) {
                // 外部存储不可用时退回内部存储
                dir = context.getFilesDir();
            }
            callbackContext.success(dir.getAbsolutePath());
        } catch (Exception e) {
            callbackContext.error(e.getMessage());
        }
    }

    private void checkPermission(String permissionName, CallbackContext callbackContext) {
        Context context = cordova.getContext();
        String manifestPermission = mapPermissionName(permissionName);
        if (manifestPermission == null) {
            callbackContext.error("Unknown permission: " + permissionName);
            return;
        }
        int result = ContextCompat.checkSelfPermission(context, manifestPermission);
        callbackContext.success(result == PackageManager.PERMISSION_GRANTED ? 1 : 0);
    }

    private void requestPermissions(JSONArray args, CallbackContext callbackContext) throws JSONException {
        List<String> permissions = new ArrayList<>();
        for (int i = 0; i < args.length(); i++) {
            String name = args.getString(i);
            String manifestPermission = mapPermissionName(name);
            if (manifestPermission != null) {
                permissions.add(manifestPermission);
            }
        }

        if (permissions.isEmpty()) {
            callbackContext.success(createPermissionResult(true, new JSONObject()));
            return;
        }

        List<String> toRequest = new ArrayList<>();
        for (String permission : permissions) {
            if (ContextCompat.checkSelfPermission(cordova.getContext(), permission) != PackageManager.PERMISSION_GRANTED) {
                toRequest.add(permission);
            }
        }

        if (toRequest.isEmpty()) {
            callbackContext.success(createPermissionResult(true, new JSONObject()));
            return;
        }

        this.pendingCallback = callbackContext;
        this.pendingAction = "requestPermissions";
        cordova.requestPermissions(this, PERMISSION_REQUEST_CODE, toRequest.toArray(new String[0]));
    }

    private void requestManageExternalStorage(CallbackContext callbackContext) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            callbackContext.success(1);
            return;
        }
        if (Environment.isExternalStorageManager()) {
            callbackContext.success(1);
            return;
        }
        this.pendingCallback = callbackContext;
        this.pendingAction = "requestManageExternalStorage";
        Activity activity = cordova.getActivity();
        Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
        intent.setData(Uri.parse("package:" + activity.getPackageName()));
        cordova.startActivityForResult(this, intent, MANAGE_STORAGE_REQUEST_CODE);
    }

    private void checkManageExternalStorage(CallbackContext callbackContext) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            callbackContext.success(1);
            return;
        }
        callbackContext.success(Environment.isExternalStorageManager() ? 1 : 0);
    }

    private void openAppSettings(CallbackContext callbackContext) {
        Activity activity = cordova.getActivity();
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        intent.setData(Uri.parse("package:" + activity.getPackageName()));
        activity.startActivity(intent);
        callbackContext.success();
    }

    @Override
    public void onRequestPermissionResult(int requestCode, String[] permissions, int[] grantResults) throws JSONException {
        super.onRequestPermissionResult(requestCode, permissions, grantResults);
        if (requestCode != PERMISSION_REQUEST_CODE || pendingCallback == null || !"requestPermissions".equals(pendingAction)) {
            return;
        }

        JSONObject results = new JSONObject();
        boolean allGranted = true;
        for (int i = 0; i < permissions.length; i++) {
            boolean granted = grantResults[i] == PackageManager.PERMISSION_GRANTED;
            results.put(permissions[i], granted);
            if (!granted) allGranted = false;
        }
        pendingCallback.success(createPermissionResult(allGranted, results));
        pendingCallback = null;
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent intent) {
        super.onActivityResult(requestCode, resultCode, intent);
        if (requestCode == MANAGE_STORAGE_REQUEST_CODE && pendingCallback != null && "requestManageExternalStorage".equals(pendingAction)) {
            boolean granted = Build.VERSION.SDK_INT < Build.VERSION_CODES.R || Environment.isExternalStorageManager();
            pendingCallback.success(granted ? 1 : 0);
            pendingCallback = null;
            return;
        }
        if (requestCode == CHOOSE_FILE_REQUEST_CODE && pendingCallback != null && "chooseFile".equals(pendingAction)) {
            if (resultCode == Activity.RESULT_OK && intent != null) {
                try {
                    JSONArray files = new JSONArray();
                    if (intent.getClipData() != null) {
                        int count = intent.getClipData().getItemCount();
                        for (int i = 0; i < count; i++) {
                            Uri uri = intent.getClipData().getItemAt(i).getUri();
                            files.put(uri.toString());
                        }
                    } else if (intent.getData() != null) {
                        files.put(intent.getData().toString());
                    }
                    pendingCallback.success(files);
                } catch (Exception e) {
                    pendingCallback.error(e.getMessage());
                }
            } else {
                pendingCallback.error("User cancelled");
            }
            pendingCallback = null;
            pendingAction = null;
            pendingFileArgs = null;
            return;
        }
    }

    private JSONObject createPermissionResult(boolean allGranted, JSONObject results) throws JSONException {
        JSONObject obj = new JSONObject();
        obj.put("allGranted", allGranted);
        obj.put("results", results);
        return obj;
    }

    private void openExternalFileManager(String path, CallbackContext callbackContext) {
        try {
            Activity activity = cordova.getActivity();
            Intent intent = new Intent(Intent.ACTION_VIEW);
            File targetDir;
            if (path != null && !path.isEmpty()) {
                targetDir = new File(path);
            } else {
                targetDir = Environment.getExternalStorageDirectory();
            }
            if (!targetDir.exists()) {
                targetDir.mkdirs();
            }
            Uri uri = FileProvider.getUriForFile(activity, activity.getPackageName() + ".fileprovider", targetDir);
            intent.setDataAndType(uri, DocumentsContract.Document.MIME_TYPE_DIR);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            intent.addCategory(Intent.CATEGORY_DEFAULT);
            try {
                activity.startActivity(intent);
                callbackContext.success(1);
            } catch (Exception e) {
                Intent fallback = new Intent(Intent.ACTION_VIEW);
                fallback.setDataAndType(Uri.fromFile(targetDir), "resource/folder");
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try {
                    activity.startActivity(fallback);
                    callbackContext.success(1);
                } catch (Exception e2) {
                    Intent market = new Intent(Intent.ACTION_VIEW);
                    market.setData(Uri.parse("content://" + targetDir.getAbsolutePath()));
                    try {
                        activity.startActivity(market);
                        callbackContext.success(1);
                    } catch (Exception e3) {
                        callbackContext.error("No file manager available: " + e3.getMessage());
                    }
                }
            }
        } catch (Exception e) {
            callbackContext.error(e.getMessage());
        }
    }

    private void chooseFile(JSONArray args, CallbackContext callbackContext) throws JSONException {
        try {
            Activity activity = cordova.getActivity();
            String acceptType = args.optString(0, "*/*");
            boolean multiple = args.optBoolean(1, false);
            Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
            intent.setType(acceptType);
            intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, multiple);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            this.pendingCallback = callbackContext;
            this.pendingAction = "chooseFile";
            this.pendingFileArgs = args;
            cordova.startActivityForResult(this, Intent.createChooser(intent, "选择文件"), CHOOSE_FILE_REQUEST_CODE);
        } catch (Exception e) {
            callbackContext.error(e.getMessage());
        }
    }

    private void importFile(JSONArray args, CallbackContext callbackContext) throws JSONException {
        try {
            String uriString = args.getString(0);
            String destDir = args.getString(1);
            Activity activity = cordova.getActivity();
            Uri uri = Uri.parse(uriString);
            ContentResolver resolver = activity.getContentResolver();
            String fileName = getFileName(resolver, uri);
            File destDirectory = new File(destDir);
            if (!destDirectory.exists()) {
                destDirectory.mkdirs();
            }
            File destFile = new File(destDirectory, fileName);
            int copyIndex = 1;
            String baseName = fileName;
            String extension = "";
            int dotPos = fileName.lastIndexOf('.');
            if (dotPos > 0) {
                baseName = fileName.substring(0, dotPos);
                extension = fileName.substring(dotPos);
            }
            while (destFile.exists()) {
                destFile = new File(destDirectory, baseName + "(" + copyIndex + ")" + extension);
                copyIndex++;
            }
            InputStream in = resolver.openInputStream(uri);
            OutputStream out = new FileOutputStream(destFile);
            byte[] buffer = new byte[8192];
            int len;
            long totalBytes = 0;
            while ((len = in.read(buffer)) != -1) {
                out.write(buffer, 0, len);
                totalBytes += len;
            }
            in.close();
            out.close();
            JSONObject result = new JSONObject();
            result.put("path", destFile.getAbsolutePath());
            result.put("name", destFile.getName());
            result.put("size", totalBytes);
            callbackContext.success(result);
        } catch (Exception e) {
            callbackContext.error(e.getMessage());
        }
    }

    private String getFileName(ContentResolver resolver, Uri uri) {
        String result = null;
        if ("content".equalsIgnoreCase(uri.getScheme())) {
            Cursor cursor = resolver.query(uri, null, null, null, null);
            try {
                if (cursor != null && cursor.moveToFirst()) {
                    int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    if (nameIndex >= 0) {
                        result = cursor.getString(nameIndex);
                    }
                }
            } finally {
                if (cursor != null) cursor.close();
            }
        }
        if (result == null) {
            result = uri.getLastPathSegment();
        }
        return result != null ? result : "unknown_file";
    }

    private void getFileInfo(String path, CallbackContext callbackContext) {
        try {
            File file = new File(path);
            JSONObject info = new JSONObject();
            info.put("exists", file.exists());
            info.put("isDirectory", file.isDirectory());
            info.put("isFile", file.isFile());
            info.put("name", file.getName());
            info.put("path", file.getAbsolutePath());
            info.put("size", file.length());
            info.put("lastModified", file.lastModified());
            info.put("canRead", file.canRead());
            info.put("canWrite", file.canWrite());
            callbackContext.success(info);
        } catch (Exception e) {
            callbackContext.error(e.getMessage());
        }
    }

    private void mkdir(String path, CallbackContext callbackContext) {
        try {
            File dir = new File(path);
            boolean created = dir.mkdirs() || dir.exists();
            if (created) {
                callbackContext.success(1);
            } else {
                callbackContext.error("Failed to create directory");
            }
        } catch (Exception e) {
            callbackContext.error(e.getMessage());
        }
    }

    private void rename(String oldPath, String newPath, CallbackContext callbackContext) {
        try {
            File oldFile = new File(oldPath);
            File newFile = new File(newPath);
            if (oldFile.renameTo(newFile)) {
                callbackContext.success(1);
            } else {
                callbackContext.error("Rename failed");
            }
        } catch (Exception e) {
            callbackContext.error(e.getMessage());
        }
    }

    private void unzip(String zipPath, String destDir, CallbackContext callbackContext) {
        final String fZipPath = zipPath;
        final String fDestDir = destDir;
        final CallbackContext fCb = callbackContext;
        new Thread(() -> {
            try {
                File destDirectory = new File(fDestDir);
                if (!destDirectory.exists()) destDirectory.mkdirs();
                java.util.zip.ZipFile zipFile = new java.util.zip.ZipFile(fZipPath);
                java.util.Enumeration<? extends java.util.zip.ZipEntry> entries = zipFile.entries();
                int fileCount = 0;
                while (entries.hasMoreElements()) {
                    java.util.zip.ZipEntry entry = entries.nextElement();
                    File destFile = new File(destDirectory, entry.getName());
                    if (entry.isDirectory()) {
                        destFile.mkdirs();
                    } else {
                        File parent = destFile.getParentFile();
                        if (parent != null && !parent.exists()) parent.mkdirs();
                        InputStream in = zipFile.getInputStream(entry);
                        OutputStream out = new FileOutputStream(destFile);
                        byte[] buffer = new byte[8192];
                        int len;
                        while ((len = in.read(buffer)) != -1) out.write(buffer, 0, len);
                        in.close();
                        out.close();
                        fileCount++;
                    }
                }
                zipFile.close();
                JSONObject result = new JSONObject();
                result.put("success", true);
                result.put("fileCount", fileCount);
                result.put("destDir", fDestDir);
                fCb.success(result);
            } catch (final Exception e) {
                cordova.getActivity().runOnUiThread(() -> fCb.error(e.getMessage()));
            }
        }).start();
    }

    private void listZip(String zipPath, CallbackContext callbackContext) {
        try {
            java.util.zip.ZipFile zipFile = new java.util.zip.ZipFile(zipPath);
            JSONArray files = new JSONArray();
            java.util.Enumeration<? extends java.util.zip.ZipEntry> entries = zipFile.entries();
            while (entries.hasMoreElements()) {
                java.util.zip.ZipEntry entry = entries.nextElement();
                JSONObject item = new JSONObject();
                item.put("name", entry.getName());
                item.put("size", entry.getSize());
                item.put("isDirectory", entry.isDirectory());
                files.put(item);
            }
            zipFile.close();
            callbackContext.success(files);
        } catch (Exception e) {
            callbackContext.error(e.getMessage());
        }
    }

    private void shareFile(String path, String title, CallbackContext callbackContext) {
        try {
            Activity activity = cordova.getActivity();
            File file = new File(path);
            if (!file.exists()) {
                callbackContext.error("File not found: " + path);
                return;
            }
            Uri uri = FileProvider.getUriForFile(activity, activity.getPackageName() + ".fileprovider", file);
            Intent intent = new Intent(Intent.ACTION_SEND);
            String mimeType = guessMimeType(file.getName());
            intent.setType(mimeType);
            intent.putExtra(Intent.EXTRA_STREAM, uri);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            activity.startActivity(Intent.createChooser(intent, title != null && !title.isEmpty() ? title : "分享文件"));
            callbackContext.success(1);
        } catch (Exception e) {
            callbackContext.error(e.getMessage());
        }
    }

    private String guessMimeType(String fileName) {
        String ext = "";
        int dot = fileName.lastIndexOf('.');
        if (dot > 0) ext = fileName.substring(dot + 1).toLowerCase();
        switch (ext) {
            case "png": return "image/png";
            case "jpg":
            case "jpeg": return "image/jpeg";
            case "gif": return "image/gif";
            case "webp": return "image/webp";
            case "pdf": return "application/pdf";
            case "txt": return "text/plain";
            case "json": return "application/json";
            case "zip": return "application/zip";
            case "jar": return "application/java-archive";
            case "mp4": return "video/mp4";
            case "mp3": return "audio/mpeg";
            default: return "*/*";
        }
    }

    private void getImageBase64(String path, int maxWidth, int maxHeight, CallbackContext callbackContext) {
        try {
            File file = new File(path);
            if (!file.exists()) {
                callbackContext.error("File not found");
                return;
            }
            android.graphics.BitmapFactory.Options opts = new android.graphics.BitmapFactory.Options();
            opts.inJustDecodeBounds = true;
            android.graphics.BitmapFactory.decodeFile(path, opts);
            int sampleSize = 1;
            if (maxWidth > 0 && opts.outWidth > maxWidth) {
                sampleSize = Math.round((float) opts.outWidth / (float) maxWidth);
            }
            if (maxHeight > 0 && opts.outHeight > maxHeight) {
                int s2 = Math.round((float) opts.outHeight / (float) maxHeight);
                if (s2 > sampleSize) sampleSize = s2;
            }
            opts.inJustDecodeBounds = false;
            opts.inSampleSize = sampleSize;
            android.graphics.Bitmap bmp = android.graphics.BitmapFactory.decodeFile(path, opts);
            if (bmp == null) {
                callbackContext.error("Failed to decode image");
                return;
            }
            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
            bmp.compress(android.graphics.Bitmap.CompressFormat.JPEG, 85, baos);
            byte[] bytes = baos.toByteArray();
            String base64 = android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP);
            JSONObject result = new JSONObject();
            result.put("base64", "data:image/jpeg;base64," + base64);
            result.put("width", bmp.getWidth());
            result.put("height", bmp.getHeight());
            bmp.recycle();
            callbackContext.success(result);
        } catch (Exception e) {
            callbackContext.error(e.getMessage());
        }
    }

    private void sha1File(String path, CallbackContext callbackContext) {
        final String fPath = path;
        final CallbackContext fCb = callbackContext;
        new Thread(() -> {
            try {
                java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-1");
                InputStream in = new FileInputStream(fPath);
                byte[] buffer = new byte[8192];
                int len;
                while ((len = in.read(buffer)) != -1) md.update(buffer, 0, len);
                in.close();
                byte[] digest = md.digest();
                StringBuilder sb = new StringBuilder();
                for (byte b : digest) sb.append(String.format("%02x", b));
                fCb.success(sb.toString());
            } catch (final Exception e) {
                cordova.getActivity().runOnUiThread(() -> fCb.error(e.getMessage()));
            }
        }).start();
    }

    private void download(String url, String destPath, CallbackContext callbackContext) {
        final String fUrl = url;
        final String fDestPath = destPath;
        final CallbackContext fCb = callbackContext;

        new Thread(() -> {
            java.net.HttpURLConnection conn = null;
            InputStream in = null;
            OutputStream out = null;
            try {
                java.net.URL u = new java.net.URL(fUrl);
                conn = (java.net.HttpURLConnection) u.openConnection();
                conn.setConnectTimeout(30000);
                conn.setReadTimeout(60000);
                conn.setRequestProperty("User-Agent", "SakuraMC-Launcher/0.5.4");
                conn.connect();

                int responseCode = conn.getResponseCode();
                if (responseCode != java.net.HttpURLConnection.HTTP_OK) {
                    fCb.error("HTTP Error: " + responseCode);
                    return;
                }

                long totalSize = conn.getContentLengthLong();
                in = conn.getInputStream();

                File destFile = new File(fDestPath);
                File destDir = destFile.getParentFile();
                if (destDir != null && !destDir.exists()) {
                    destDir.mkdirs();
                }

                out = new FileOutputStream(destFile);
                byte[] buffer = new byte[8192];
                int len;
                long downloaded = 0;
                long lastNotifyTime = 0;

                while ((len = in.read(buffer)) != -1) {
                    out.write(buffer, 0, len);
                    downloaded += len;

                    long now = System.currentTimeMillis();
                    if (now - lastNotifyTime >= 500 || downloaded == totalSize) {
                        lastNotifyTime = now;
                        JSONObject progress = new JSONObject();
                        try {
                            progress.put("downloaded", downloaded);
                            progress.put("total", totalSize);
                            progress.put("status", "progress");
                        } catch (JSONException e) {
                            // ignore
                        }
                        PluginResult result = new PluginResult(PluginResult.Status.OK, progress);
                        result.setKeepCallback(true);
                        fCb.sendPluginResult(result);
                    }
                }

                out.flush();
                JSONObject result = new JSONObject();
                try {
                    result.put("downloaded", downloaded);
                    result.put("total", totalSize);
                    result.put("status", "complete");
                    result.put("path", fDestPath);
                } catch (JSONException e) {
                    // ignore
                }
                fCb.success(result);

            } catch (java.net.SocketTimeoutException e) {
                fCb.error("下载超时");
            } catch (java.io.FileNotFoundException e) {
                fCb.error("文件不存在: " + fDestPath);
            } catch (Exception e) {
                fCb.error(e.getMessage());
            } finally {
                try { if (out != null) out.close(); } catch (Exception e) {}
                try { if (in != null) in.close(); } catch (Exception e) {}
                try { if (conn != null) conn.disconnect(); } catch (Exception e) {}
            }
        }).start();
    }

    private void extractAssets(String assetsPath, String destDir, CallbackContext callbackContext) {
        final String fAssetsPath = assetsPath;
        final String fDestDir = destDir;
        final CallbackContext fCb = callbackContext;

        new Thread(() -> {
            try {
                Context context = cordova.getContext();
                android.content.res.AssetManager assetManager = context.getAssets();
                
                String[] files = assetManager.list(fAssetsPath);
                if (files == null || files.length == 0) {
                    fCb.error("Assets directory is empty: " + fAssetsPath);
                    return;
                }

                File destDirectory = new File(fDestDir);
                if (!destDirectory.exists()) {
                    destDirectory.mkdirs();
                }

                long totalFiles = files.length;
                long extracted = 0;

                for (String fileName : files) {
                    String assetFilePath = fAssetsPath + "/" + fileName;
                    File destFile = new File(destDirectory, fileName);

                    try {
                        InputStream in = assetManager.open(assetFilePath);
                        OutputStream out = new FileOutputStream(destFile);
                        byte[] buffer = new byte[8192];
                        int len;
                        while ((len = in.read(buffer)) != -1) {
                            out.write(buffer, 0, len);
                        }
                        in.close();
                        out.close();
                        extracted++;

                        JSONObject progress = new JSONObject();
                        try {
                            progress.put("extracted", extracted);
                            progress.put("total", totalFiles);
                            progress.put("status", "progress");
                            progress.put("file", fileName);
                        } catch (JSONException e) {
                            // ignore
                        }
                        PluginResult result = new PluginResult(PluginResult.Status.OK, progress);
                        result.setKeepCallback(true);
                        fCb.sendPluginResult(result);
                    } catch (Exception e) {
                        Log.w(TAG, "Failed to extract asset: " + fileName, e);
                    }
                }

                JSONObject result = new JSONObject();
                try {
                    result.put("extracted", extracted);
                    result.put("total", totalFiles);
                    result.put("status", "complete");
                    result.put("destDir", fDestDir);
                } catch (JSONException e) {
                    // ignore
                }
                fCb.success(result);

            } catch (Exception e) {
                fCb.error(e.getMessage());
            }
        }).start();
    }

    private String mapPermissionName(String name) {
        Map<String, String> map = new HashMap<>();
        map.put("storage", Manifest.permission.WRITE_EXTERNAL_STORAGE);
        map.put("readStorage", Manifest.permission.READ_EXTERNAL_STORAGE);
        map.put("mediaImages", Manifest.permission.READ_MEDIA_IMAGES);
        map.put("mediaVideo", Manifest.permission.READ_MEDIA_VIDEO);
        map.put("mediaAudio", Manifest.permission.READ_MEDIA_AUDIO);
        map.put("camera", Manifest.permission.CAMERA);
        map.put("microphone", Manifest.permission.RECORD_AUDIO);
        map.put("notifications", Manifest.permission.POST_NOTIFICATIONS);
        map.put("bluetoothConnect", "android.permission.BLUETOOTH_CONNECT");
        map.put("bluetoothScan", "android.permission.BLUETOOTH_SCAN");
        map.put("systemAlertWindow", "android.permission.SYSTEM_ALERT_WINDOW");
        map.put("modifyAudioSettings", "android.permission.MODIFY_AUDIO_SETTINGS");
        map.put("nfc", "android.permission.NFC");
        map.put("changeWifiState", "android.permission.CHANGE_WIFI_STATE");
        map.put("writeSettings", "android.permission.WRITE_SETTINGS");
        map.put("installShortcut", "android.permission.INSTALL_SHORTCUT");
        map.put("reorderTasks", "android.permission.REORDER_TASKS");
        return map.get(name);
    }
}
