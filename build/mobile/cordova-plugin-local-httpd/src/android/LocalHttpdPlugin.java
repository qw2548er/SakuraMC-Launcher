package com.sakuramc.httpd;

import org.apache.cordova.*;
import org.json.JSONArray;
import org.json.JSONException;
import android.content.Context;
import java.io.*;

public class LocalHttpdPlugin extends CordovaPlugin {
    private static final int DEFAULT_PORT = 8787;
    private NanoHTTPD server;
    private int port = DEFAULT_PORT;

    @Override
    public boolean execute(String action, JSONArray args, CallbackContext callbackContext) throws JSONException {
        if ("startServer".equals(action)) {
            int port = args.getInt(0);
            String wwwDir = args.getString(1);
            return startServer(port, wwwDir, callbackContext);
        } else if ("stopServer".equals(action)) {
            return stopServer(callbackContext);
        } else if ("getServerUrl".equals(action)) {
            return getServerUrl(callbackContext);
        }
        return false;
    }

    private boolean startServer(int port, String wwwDir, CallbackContext callbackContext) {
        try {
            if (server != null) {
                server.stop();
                server = null;
            }

            Context context = cordova.getActivity().getApplicationContext();
            String wwwRoot = "www";
            if (wwwDir != null && !wwwDir.isEmpty()) {
                wwwRoot = wwwDir;
            }

            this.port = port;
            server = new NanoHTTPD(port, context, wwwRoot);
            server.start();

            PluginResult result = new PluginResult(PluginResult.Status.OK, "http://localhost:" + port + "/");
            callbackContext.sendPluginResult(result);
            return true;
        } catch (Exception e) {
            StringWriter sw = new StringWriter();
            PrintWriter pw = new PrintWriter(sw);
            e.printStackTrace(pw);
            callbackContext.error("Failed to start server: " + e.getMessage() + "\n" + sw.toString());
            return true;
        }
    }

    private boolean stopServer(CallbackContext callbackContext) {
        try {
            if (server != null) {
                server.stop();
                server = null;
            }
            callbackContext.success("Server stopped");
            return true;
        } catch (Exception e) {
            callbackContext.error("Failed to stop server: " + e.getMessage());
            return true;
        }
    }

    private boolean getServerUrl(CallbackContext callbackContext) {
        if (server != null) {
            callbackContext.success("http://localhost:" + port + "/");
        } else {
            callbackContext.error("Server not running");
        }
        return true;
    }

    @Override
    public void onDestroy() {
        if (server != null) {
            server.stop();
            server = null;
        }
        super.onDestroy();
    }
}
