package com.sakuramc.webview;

import org.apache.cordova.*;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.graphics.Color;

public class WebViewConfigPlugin extends CordovaPlugin {
    
    @Override
    protected void pluginInitialize() {
        super.pluginInitialize();
        configureFullScreen();
        configureWebView();
    }
    
    private void configureFullScreen() {
        try {
            final Window window = cordova.getActivity().getWindow();
            
            window.setStatusBarColor(Color.TRANSPARENT);
            window.setNavigationBarColor(Color.TRANSPARENT);
            
            int uiOptions = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN;
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                uiOptions |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            }
            
            window.getDecorView().setSystemUiVisibility(uiOptions);
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                WindowManager.LayoutParams lp = window.getAttributes();
                lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
                window.setAttributes(lp);
            }
            
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
            window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
            
        } catch (Exception e) {
            e.printStackTrace();
        }
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
            
            webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.HONEYCOMB) {
                webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
            }
            
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
    
    @Override
    public boolean execute(String action, CordovaArgs args, CallbackContext callbackContext) {
        if ("configure".equals(action)) {
            configureFullScreen();
            configureWebView();
            callbackContext.success();
            return true;
        }
        return false;
    }
}
