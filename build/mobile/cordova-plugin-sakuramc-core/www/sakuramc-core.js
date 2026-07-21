/**
 * SakuraMCCore 插件 JS 桥接
 *
 * 桥接 cordova.exec 到 cordova.plugins.SakuraMCCore
 * 所有方法签名: method(...args, success, error)
 */
var exec = require('cordova/exec');

var SakuraMCCore = {
    // ===== 权限管理 =====
    checkPermission: function (permission, success, error) {
        exec(success, error, 'SakuraMCCore', 'checkPermission', [permission]);
    },
    requestPermissions: function (permissions, success, error) {
        exec(success, error, 'SakuraMCCore', 'requestPermissions', permissions);
    },
    requestManageExternalStorage: function (success, error) {
        exec(success, error, 'SakuraMCCore', 'requestManageExternalStorage', []);
    },
    checkManageExternalStorage: function (success, error) {
        exec(success, error, 'SakuraMCCore', 'checkManageExternalStorage', []);
    },
    openAppSettings: function (success, error) {
        exec(success, error, 'SakuraMCCore', 'openAppSettings', []);
    },
    getPlatformInfo: function (success, error) {
        exec(success, error, 'SakuraMCCore', 'getPlatformInfo', []);
    },

    // ===== 目录路径 =====
    getAppFilesDir: function (success, error) {
        exec(success, error, 'SakuraMCCore', 'getAppFilesDir', []);
    },
    getAppExternalFilesDir: function (success, error) {
        exec(success, error, 'SakuraMCCore', 'getAppExternalFilesDir', []);
    },

    // ===== 文件管理器 =====
    openExternalFileManager: function (path, success, error) {
        exec(success, error, 'SakuraMCCore', 'openExternalFileManager', [path || '']);
    },

    // ===== 文件选择与导入 =====
    chooseFile: function (acceptType, multiple, success, error) {
        exec(success, error, 'SakuraMCCore', 'chooseFile', [acceptType || '*/*', !!multiple]);
    },
    importFile: function (uri, destDir, success, error) {
        exec(success, error, 'SakuraMCCore', 'importFile', [uri, destDir]);
    },

    // ===== 文件操作 =====
    getFileInfo: function (path, success, error) {
        exec(success, error, 'SakuraMCCore', 'getFileInfo', [path]);
    },
    mkdir: function (path, success, error) {
        exec(success, error, 'SakuraMCCore', 'mkdir', [path]);
    },
    rename: function (oldPath, newPath, success, error) {
        exec(success, error, 'SakuraMCCore', 'rename', [oldPath, newPath]);
    },
    unzip: function (zipPath, destDir, success, error) {
        exec(success, error, 'SakuraMCCore', 'unzip', [zipPath, destDir]);
    },
    listZip: function (zipPath, success, error) {
        exec(success, error, 'SakuraMCCore', 'listZip', [zipPath]);
    },
    shareFile: function (path, title, success, error) {
        exec(success, error, 'SakuraMCCore', 'shareFile', [path, title || '分享']);
    },
    getImageBase64: function (path, maxWidth, maxHeight, success, error) {
        exec(success, error, 'SakuraMCCore', 'getImageBase64', [path, maxWidth || 0, maxHeight || 0]);
    },
    sha1File: function (path, success, error) {
        exec(success, error, 'SakuraMCCore', 'sha1File', [path]);
    }
};

module.exports = SakuraMCCore;
