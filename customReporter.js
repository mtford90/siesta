var Dot, parseLine, sourceMapper, superEpilogue;

sourceMapper = require('source-map-support');

Dot = require('./node_modules/grunt-mocha/node_modules/mocha/lib/reporters/dot.js');

module.exports = Dot;

parseLine = function (line) {
    var file, frame, row, _, _ref;
    _ref = line.match(/file:\/\/\/(.*):(\d*)/), _ = _ref[0], file = _ref[1], row = _ref[2];
    return frame = {
        getFileName: function () {
            return file;
        },
        getLineNumber: function () {
            return row;
        },
        getColumnNumber: function () {
            return 1;
        }
    };
};

superEpilogue = Dot.prototype.epilogue;

Dot.prototype.epilogue = function () {
    var test, _i, _len, _ref;
    _ref = this.failures;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        test = _ref[_i];
        test.err.stack = test.err.stack.split('\n').map(function (line) {
            var mapped;
            if (line.match(/^    at /)) {
                mapped = sourceMapper.wrapCallSite(parseLine(line));
                return line.replace(/file:\/\/\/(.*):(\d*)/, "file:///" + (mapped.getFileName()) + ":" + (mapped.getLineNumber()));
            } else {
                return line;
            }
        }).join('\n');
    }
    return superEpilogue.bind(this)();
};
