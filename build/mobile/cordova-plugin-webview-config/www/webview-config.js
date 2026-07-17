var exec = require('cordova/exec');

module.exports = {
    configure: function(success, error) {
        exec(success, error, 'WebViewConfig', 'configure', []);
    }
};
