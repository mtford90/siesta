var _i = siesta._internal
    , log = _i.log
    , InternalSiestaError = _i.error.InternalSiestaError
    , assert = _i.misc.assert
    , defineSubProperty = _i.misc.defineSubProperty
    , CollectionRegistry = _i.CollectionRegistry
    , extend = _i.extend
    , util = _i.util
    , _ = util._
    ;

var Logger = log.loggerWithName('Descriptor');
Logger.setLevel(log.Level.warn);
// The XRegExp object has these properties that we want to ignore when matching.
var ignore = ['index', 'input'];
var XRegExp = require('xregexp').XRegExp;


function Descriptor(opts) {
    if (!this) {
        return new Descriptor(opts);
    }

    this._rawOpts = extend(true, {}, opts);
    this._opts = opts;

    // Convert path string into XRegExp if not already.
    if (this._opts.path) {
        if (!(this._opts.path instanceof XRegExp)) {
            this._opts.path = XRegExp(this._opts.path);
        }
    }
    else {
        this._opts.path = '';
    }

    // Convert wildcards into methods and ensure is an array of uppercase methods.
    if (this._opts.method) {
        if (this._opts.method == '*' || this._opts.method.indexOf('*') > -1) {
            this._opts.method = this.httpMethods;
        }
        else if (typeof(this._opts.method) == 'string') {
            this._opts.method = [this._opts.method];
        }
    }
    else {
        this._opts.method = this.httpMethods;
    }
    this._opts.method = _.map(this._opts.method, function (x) {return x.toUpperCase()});

    // Mappings can be passed as the actual mapping object or as a string (with API specified too)
    if (this._opts.mapping) {
        if (typeof(this._opts.mapping) == 'string') {
            if (this._opts.collection) {
                var collection;
                if (typeof(this._opts.collection) == 'string') {
                    collection = CollectionRegistry[this._opts.collection];
                }
                else {
                    collection = this._opts.collection;
                }
                if (collection) {
                    var actualMapping = collection[this._opts.mapping];
                    if (actualMapping) {
                        this._opts.mapping = actualMapping;
                    }
                    else {
                        throw new InternalSiestaError('Mapping ' + this._opts.mapping + ' does not exist', {opts: opts, descriptor: this});
                    }
                }
                else {
                    throw new InternalSiestaError('Collection ' + this._opts.collection + ' does not exist', {opts: opts, descriptor: this});
                }
            }
            else {
                throw new InternalSiestaError('Passed mapping as string, but did not specify the collection it belongs to', {opts: opts, descriptor: this});
            }
        }
    }
    else {
        throw new InternalSiestaError('Descriptors must be initialised with a mapping', {opts: opts, descriptor: this});
    }

    // If key path, convert data key path into an object that we can then use to traverse the HTTP bodies.
    // otherwise leave as string or undefined.
    var data = this._opts.data;
    if (data) {
        if (data.length) {
            var root;
            var arr = data.split('.');
            if (arr.length == 1) {
                root = arr[0];
            }
            else {
                var obj = {};
                root = obj;
                var previousKey = arr[0];
                for (var i = 1; i < arr.length; i++) {
                    var key = arr[i];
                    if (i == (arr.length - 1)) {
                        obj[previousKey] = key;
                    }
                    else {
                        var newVar = {};
                        obj[previousKey] = newVar;
                        obj = newVar;
                        previousKey = key;
                    }
                }
            }
            this._opts.data = root;
        }
    }

    defineSubProperty.call(this, 'path', this._opts);
    defineSubProperty.call(this, 'method', this._opts);
    defineSubProperty.call(this, 'mapping', this._opts);
    defineSubProperty.call(this, 'data', this._opts);
    defineSubProperty.call(this, 'transforms', this._opts);
}

Descriptor.prototype.httpMethods = ['POST', 'PATCH', 'PUT', 'HEAD', 'GET', 'DELETE', 'OPTIONS', 'TRACE', 'CONNECT'];

Descriptor.prototype._matchPath = function (path) {
    var match = XRegExp.exec(path, this.path);
    var matched = null;
    if (match) {
        matched = {};
        for (var prop in match) {
            if (match.hasOwnProperty(prop)) {
                if (isNaN(parseInt(prop)) && ignore.indexOf(prop) < 0) {
                    matched[prop] = match[prop];
                }
            }
        }
    }
    return matched;
};

Descriptor.prototype._matchMethod = function (method) {
    for (var i = 0; i < this.method.length; i++) {
        if (method.toUpperCase() == this.method[i]) {
            return true;
        }
    }
    return false;
};

/**
 * Bury obj as far down in data as poss.
 * @param obj
 * @param data keypath object
 * @returns {*}
 */
function bury(obj, data) {
    var root = data;
    var keys = Object.keys(data);
    assert(keys.length == 1);
    var key = keys[0];
    var curr = data;
    while (!(typeof(curr[key]) == 'string')) {
        curr = curr[key];
        keys = Object.keys(curr);
        assert(keys.length == 1);
        key = keys[0];
    }
    var newParent = curr[key];
    var newObj = {};
    curr[key] = newObj;
    newObj[newParent] = obj;
    return root;
}

Descriptor.prototype._embedData = function (data) {
    if (this.data) {
        var nested;
        if (typeof(this.data) == 'string') {
            nested = {};
            nested[this.data] = data;
        }
        else {
            nested = bury(data, extend(true, {}, this.data));
        }
        return nested;
    }
    else {
        return data;
    }
};

Descriptor.prototype._extractData = function (data) {
    if (Logger.debug.isEnabled)
        Logger.debug('_extractData', data);
    if (this.data) {
        if (typeof(this.data) == 'string') {
            return data[this.data];
        }
        else {
            var keys = Object.keys(this.data);
            assert(keys.length == 1);
            var currTheirs = data;
            var currOurs = this.data;
            while (typeof(currOurs) != 'string') {
                keys = Object.keys(currOurs);
                assert(keys.length == 1);
                var key = keys[0];
                currOurs = currOurs[key];
                currTheirs = currTheirs[key];
                if (!currTheirs) {
                    break;
                }
            }
            return currTheirs ? currTheirs[currOurs] : null;
        }
    }
    else {
        return data;
    }
};

/**
 * Returns this descriptors mapping if the request config matches.
 * @param config
 * @returns {*}
 * @private
 */
Descriptor.prototype._matchConfig = function (config) {
    var matches = config.type ? this._matchMethod(config.type) : {};
    if (matches) {
        matches = config.url ? this._matchPath(config.url) : {};
    }
    if (matches) {
        if (Logger.trace.isEnabled)
            Logger.trace('matched config');
    }
    return matches;
};

Descriptor.prototype._matchData = function (data) {
    var extractedData = null;
    if (this.data) {
        if (data) {
            extractedData = this._extractData(data);
        }
    }
    else {
        extractedData = data;
    }
    if (extractedData) {
        Logger.trace('matched data');
    }
    return extractedData;
};

Descriptor.prototype.match = function (config, data) {
    var regexMatches = this._matchConfig(config);
    var matches = !!regexMatches;
    var extractedData = false;
    if (matches) {
        Logger.trace('config matches');
        extractedData = this._matchData(data);
        matches = !!extractedData;
        if (matches) {
            var key;
            if (util.isArray(extractedData)) {
                for (key in regexMatches) {
                    if (regexMatches.hasOwnProperty(key)) {
                        _.each(extractedData, function (datum) {
                            datum[key] = regexMatches[key];
                        });
                    }
                }
            }
            else {
                for (key in regexMatches) {
                    if (regexMatches.hasOwnProperty(key)) {
                        extractedData[key] = regexMatches[key];
                    }
                }
            }

            Logger.trace('data matches');
        }
        else {
            Logger.trace('data doesnt match');
        }
    }
    else {
        Logger.trace('config doesnt match');
    }
    return extractedData;
};

Descriptor.prototype._transformData = function (data) {
    var transforms = this.transforms;
    for (var attr in transforms) {
        if (transforms.hasOwnProperty(attr)) {
            if (data[attr]) {
                var transform = transforms[attr];
                var val = data[attr];
                if (typeof(transform) == 'string') {
                    var split = transform.split('.');
                    delete data[attr];
                    if (split.length == 1) {
                        data[split[0]] = val;
                    }
                    else {
                        data[split[0]] = {};
                        var newVal = data[split[0]];
                        for (var i = 1; i < split.length - 1; i++) {
                            var newAttr = split[i];
                            newVal[newAttr] = {};
                            newVal = newVal[newAttr];
                        }
                        newVal[split[split.length - 1]] = val;
                    }
                }
                else if (typeof(transform) == 'function') {
                    var transformed = transform(val);
                    if (util.isArray(transformed)) {
                        delete data[attr];
                        data[transformed[0]] = transformed[1];
                    }
                    else {
                        data[attr] = transformed;
                    }
                }
                else {
                    throw new InternalSiestaError('Invalid transformer');
                }
            }
        }
    }
};


exports.Descriptor = Descriptor;