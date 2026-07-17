var exec = require('cordova/exec');

var LocalHttpd = {
    startServer: function(port, wwwDir, success, error) {
        exec(success, error, 'LocalHttpd', 'startServer', [port, wwwDir]);
    },
    stopServer: function(success, error) {
        exec(success, error, 'LocalHttpd', 'stopServer', []);
    },
    getServerUrl: function(success, error) {
        exec(success, error, 'LocalHttpd', 'getServerUrl', []);
    }
};

module.exports = LocalHttpd;
