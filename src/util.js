var mapStackTrace = require('../vendor/sourcemapped-stacktrace').mapStackTrace;

function printStackTrace() {
    var e = new Error('printStackTrace');
    var stack = e.stack;
    console.log(stack);
}

exports.printStackTrace = printStackTrace;