package com.sakuramc.webview;

import org.apache.cordova.*;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.os.Build;

public class WebViewConfigPlugin extends CordovaPlugin {
    
    @Override
    protected void pluginInitialize() {
        super.pluginInitialize();
        configureWebView();
    }
    
    private void configureWebView() {
        try {
            final WebView webView = (WebView) this.webView.getView();
            final WebSettings settings = webView.getSettings();
            
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setLoadWithOverviewMode(true);
            settings.setUseWideViewPort(true);
            settings.setBuiltInZoomControls(false);
            settings.setDisplayZoomControls(false);
            
            settings.setAllowFileAccess(true);
            settings.setAllowContentAccess(true);
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
                settings.setAllowFileAccessFromFileURLs(true);
                settings.setAllowUniversalAccessFromFileURLs(true);
            }
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            }
            
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);
            settings.setRenderPriority(WebSettings.RenderPriority.HIGH);
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                WebView.setWebContentsDebuggingEnabled(true);
            }
            
            settings.setMediaPlaybackRequiresUserGesture(false);
            
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
    
    @Override
    public boolean execute(String action, CordovaArgs args, CallbackContext callbackContext) {
        if ("configure".equals(action)) {
            configureWebView();
            callbackContext.success();
            return true;
        }
        return false;
    }
}
