var Descriptor = require('./descriptor').Descriptor;

/**
 * Describes what to do with a HTTP response.
 * @constructor
 * @implements {Descriptor}
 * @param {Object} opts
 */
function ResponseDescriptor(opts) {
    if (!this) {
        return new ResponseDescriptor(opts);
    }
    Descriptor.call(this, opts);
}

ResponseDescriptor.prototype = Object.create(Descriptor.prototype);

ResponseDescriptor.prototype._extractData = function (data) {
    var extractedData = Descriptor.prototype._extractData.call(this, data);
    if (extractedData) {
        this._transformData(extractedData);
    }
    return extractedData;
};

ResponseDescriptor.prototype._matchData = function (data) {
    var extractedData = Descriptor.prototype._matchData.call(this, data);
    if (extractedData) {
        this._transformData(extractedData);
    }
    return extractedData;
};

ResponseDescriptor.prototype._dump = function (asJson) {
    var obj = {};
    obj.methods = this.method;
    obj.mapping = this.mapping.type;
    obj.path = this._rawOpts.path;
    var transforms = {};
    for (var f in this.transforms) {
        if (this.transforms.hasOwnProperty(f)) {
            var transform = this.transforms[f];
            if (typeof(transform) == 'function') {
                transforms[f] = 'function () { ... }'
            }
            else {
                transforms[f] = this.transforms[f];
            }
        }
    }
    obj.transforms = transforms;
    return asJson ? JSON.stringify(obj, null, 4) : obj;
};

exports.ResponseDescriptor = ResponseDescriptor;