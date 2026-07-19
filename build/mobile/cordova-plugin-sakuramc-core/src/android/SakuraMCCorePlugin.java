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
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.util.Log;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

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

    private CallbackContext pendingCallback;
    private String pendingAction;

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
        if (requestCode != MANAGE_STORAGE_REQUEST_CODE || pendingCallback == null || !"requestManageExternalStorage".equals(pendingAction)) {
            return;
        }
        boolean granted = Build.VERSION.SDK_INT < Build.VERSION_CODES.R || Environment.isExternalStorageManager();
        pendingCallback.success(granted ? 1 : 0);
        pendingCallback = null;
    }

    private JSONObject createPermissionResult(boolean allGranted, JSONObject results) throws JSONException {
        JSONObject obj = new JSONObject();
        obj.put("allGranted", allGranted);
        obj.put("results", results);
        return obj;
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
