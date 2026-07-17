package com.sakuramc.httpd;

import android.content.Context;
import android.content.res.AssetManager;
import java.io.*;
import java.net.*;
import java.util.*;

public class NanoHTTPD {
    public static final int HTTP_OK = 200;
    public static final int HTTP_NOTFOUND = 404;
    public static final int MIME_HTML = 0;
    public static final String MIME_TYPE_HTML = "text/html";
    public static final String MIME_TYPE_JS = "application/javascript";
    public static final String MIME_TYPE_CSS = "text/css";
    public static final String MIME_TYPE_JSON = "application/json";
    public static final String MIME_TYPE_PNG = "image/png";
    public static final String MIME_TYPE_SVG = "image/svg+xml";
    public static final String MIME_TYPE_WOFF = "font/woff";
    public static final String MIME_TYPE_WOFF2 = "font/woff2";
    public static final String MIME_TYPE_DEFAULT = "application/octet-stream";

    private final int port;
    private final Context context;
    private final String wwwRoot;
    private ServerSocket serverSocket;
    private boolean running = false;

    public NanoHTTPD(int port, Context context, String wwwRoot) {
        this.port = port;
        this.context = context;
        this.wwwRoot = wwwRoot;
    }

    public void start() throws IOException {
        serverSocket = new ServerSocket(port);
        running = true;
        Thread t = new Thread(() -> {
            while (running) {
                try {
                    Socket client = serverSocket.accept();
                    handleClient(client);
                } catch (IOException e) {
                    if (running) {
                        e.printStackTrace();
                    }
                }
            }
        });
        t.setDaemon(true);
        t.start();
    }

    public void stop() {
        running = false;
        try {
            if (serverSocket != null) serverSocket.close();
        } catch (IOException e) {}
    }

    public int getListeningPort() {
        return port;
    }

    private void handleClient(Socket client) {
        try {
            BufferedReader in = new BufferedReader(new InputStreamReader(client.getInputStream()));
            OutputStream out = client.getOutputStream();

            String line = in.readLine();
            if (line == null) {
                client.close();
                return;
            }

            StringTokenizer st = new StringTokenizer(line);
            if (!st.hasMoreTokens()) {
                client.close();
                return;
            }

            String method = st.nextToken();
            if (!st.hasMoreTokens()) {
                client.close();
                return;
            }

            String path = st.nextToken();
            String decodedPath = URLDecoder.decode(path, "UTF-8");

            int headerLines = 0;
            while (in.ready() && headerLines < 100) {
                String headerLine = in.readLine();
                if (headerLine == null || headerLine.isEmpty()) break;
                headerLines++;
            }

            if (decodedPath.endsWith("/")) {
                decodedPath += "index.html";
            }

            if (decodedPath.startsWith("/")) {
                decodedPath = decodedPath.substring(1);
            }

            String assetPath = wwwRoot + "/" + decodedPath;
            assetPath = assetPath.replace("//", "/");
            if (assetPath.startsWith("/")) {
                assetPath = assetPath.substring(1);
            }

            AssetManager assetManager = context.getAssets();
            InputStream is = null;
            try {
                is = assetManager.open(assetPath);
            } catch (IOException e) {
                sendError(out, HTTP_NOTFOUND, "Not Found");
                out.flush();
                client.close();
                return;
            }

            if (is != null) {
                try {
                    sendStream(out, is, decodedPath);
                } finally {
                    try { is.close(); } catch (IOException e) {}
                }
            } else {
                sendError(out, HTTP_NOTFOUND, "Not Found");
            }

            out.flush();
            client.close();
        } catch (Exception e) {
            e.printStackTrace();
            try { client.close(); } catch (IOException ex) {}
        }
    }

    private void sendError(OutputStream out, int status, String message) throws IOException {
        String body = "<html><body><h1>" + status + " " + message + "</h1></body></html>";
        String response = "HTTP/1.1 " + status + " " + message + "\r\n" +
                "Content-Type: text/html\r\n" +
                "Content-Length: " + body.getBytes("UTF-8").length + "\r\n" +
                "Connection: close\r\n\r\n" + body;
        out.write(response.getBytes("UTF-8"));
    }

    private void sendStream(OutputStream out, InputStream is, String fileName) throws IOException {
        String mimeType = getMimeTypeForFile(fileName);

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int len;
        while ((len = is.read(buffer)) != -1) {
            baos.write(buffer, 0, len);
        }
        byte[] data = baos.toByteArray();

        StringBuilder headers = new StringBuilder();
        headers.append("HTTP/1.1 200 OK\r\n");
        headers.append("Content-Type: ").append(mimeType).append("\r\n");
        headers.append("Content-Length: ").append(data.length).append("\r\n");
        headers.append("Cache-Control: no-cache\r\n");
        headers.append("Access-Control-Allow-Origin: *\r\n");
        headers.append("Connection: close\r\n\r\n");

        out.write(headers.toString().getBytes("UTF-8"));
        out.write(data);
    }

    private String getMimeTypeForFile(String fileName) {
        if (fileName.endsWith(".html") || fileName.endsWith(".htm")) return MIME_TYPE_HTML;
        if (fileName.endsWith(".js")) return MIME_TYPE_JS;
        if (fileName.endsWith(".mjs")) return MIME_TYPE_JS;
        if (fileName.endsWith(".css")) return MIME_TYPE_CSS;
        if (fileName.endsWith(".json")) return MIME_TYPE_JSON;
        if (fileName.endsWith(".png")) return MIME_TYPE_PNG;
        if (fileName.endsWith(".svg")) return MIME_TYPE_SVG;
        if (fileName.endsWith(".woff")) return MIME_TYPE_WOFF;
        if (fileName.endsWith(".woff2")) return MIME_TYPE_WOFF2;
        if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) return "image/jpeg";
        if (fileName.endsWith(".gif")) return "image/gif";
        if (fileName.endsWith(".ico")) return "image/x-icon";
        if (fileName.endsWith(".webp")) return "image/webp";
        if (fileName.endsWith(".xml")) return "text/xml";
        if (fileName.endsWith(".txt")) return "text/plain";
        if (fileName.endsWith(".wasm")) return "application/wasm";
        if (fileName.endsWith(".mp3")) return "audio/mpeg";
        if (fileName.endsWith(".mp4")) return "video/mp4";
        return MIME_TYPE_DEFAULT;
    }
}
