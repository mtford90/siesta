var log = require('../vendor/operations.js/src/log');
var HttpLogger = log.loggerWithName('HTTP');
var Logger = log.loggerWithName('Collection');
Logger.setLevel(log.Level.warn);
HttpLogger.setLevel(log.Level.warn);

var CollectionRegistry = require('./collectionRegistry').CollectionRegistry;
var DescriptorRegistry = require('./descriptorRegistry').DescriptorRegistry;
var RequestDescriptor = require('./requestDescriptor').RequestDescriptor;
var ResponseDescriptor = require('./responseDescriptor').ResponseDescriptor;
var Operation = require('../vendor/operations.js/src/operation').Operation;
var RestError = require('./error').RestError;
var Mapping = require('./mapping').Mapping;
var Pouch = require('./pouch');
var extend = require('extend');
var changes = require('./changes');
var observe = require('../vendor/observe-js/src/observe').Platform;

var $ = require('../vendor/zepto').$;
var util = require('./util');
var _ = util._;


/**
 * @param name
 * @constructor
 */
function Collection(name) {
    if (!this) return new Collection(name);
    var self = this;

    this._name = name;
    this._docId = 'Collection_' + this._name;
    this._doc = null;
    this._rawMappings = {};
    this._mappings = {};
    this.baseURL = '';
    this.installed = false;
}

/**
 * Ensure mappings are installed.
 * @param callback
 */
Collection.prototype.install = function (callback) {
    var self = this;
    if (!this.installed) {
        CollectionRegistry.register(self);
        var mappingsToInstall = [];
        for (var name in this._mappings) {
            if (this._mappings.hasOwnProperty(name)) {
                var mapping = this._mappings[name];
                mappingsToInstall.push(mapping);
            }
        }
        if (Logger.info.isEnabled)
            Logger.info('There are ' + mappingsToInstall.length.toString() + ' mappings to install');
        if (mappingsToInstall.length) {
            var operations = _.map(mappingsToInstall, function (m) {
                return new Operation('Install Mapping', _.bind(m.install, m));
            });
            var op = new Operation('Install Mappings', operations);
            op.completion = function () {
                if (op.failed) {
                    self._finaliseInstallation(op.error, callback);
                }
                else {
                    self.installed = true;
                    var errors = [];
                    _.each(mappingsToInstall, function (m) {
                        if (Logger.info.isEnabled)
                            Logger.info('Installing relationships for mapping with name "' + m.type + '"');
                        try {
                            m.installRelationships();
                        }
                        catch (err) {
                            if (err instanceof RestError) {
                                errors.push(err);
                            }
                            else {
                                throw err;
                            }
                        }
                    });
                    if (!errors.length) {
                        _.each(mappingsToInstall, function (m) {
                            if (Logger.info.isEnabled)
                                Logger.info('Installing reverse relationships for mapping with name "' + m.type + '"');
                            try {
                                m.installReverseRelationships();
                            }
                            catch (err) {
                                if (err instanceof RestError) {
                                    errors.push(err);
                                }
                                else {
                                    throw err;
                                }
                            }
                        });
                    }
                    var err;
                    if (errors.length == 1) {
                        err = errors[0];
                    }
                    else if (errors.length) {
                        err = errors;
                    }
                    self._finaliseInstallation(err, callback);
                }
            };
            op.start();
        }
        else {
            self._finaliseInstallation(null, callback);
        }
    }
    else {
        var err = new RestError('Collection "' + this._name + '" has already been installed');
        self._finaliseInstallation(err, callback);
    }
};

Collection.prototype._finaliseInstallation = function (err, callback) {
    if (!err) {
        this.installed = true;
        var index = require('../index');
        index[this._name] = this;
    }
    if (callback) callback(err);
};


Collection._reset = Pouch.reset;

Collection._getPouch = Pouch.getPouch;

Collection.prototype.save = function (callback) {
    util.next(function () {
        changes.mergeChanges(callback);
    });
};

Collection.prototype._mapping = function (name, mapping) {
    if (name) {
        this._rawMappings[name] = mapping;
        var opts = extend(true, {}, mapping);
        opts.type = name;
        opts.collection = this._name;
        var mappingObject = new Mapping(opts);
        this._mappings[name] = mappingObject;
        this[name] = mappingObject;
        return mappingObject;
    }
    else {
        throw new RestError('No name specified when creating mapping');
    }
};

Collection.prototype.mapping = function () {
    var self = this;
    if (arguments.length) {
        if (arguments.length == 1) {
            if (util.isArray(arguments[0])) {
                return _.map(arguments[0], function (m) {
                    return self._mapping(m.name, m);
                });
            }
            else {
                return this._mapping(arguments[0].name, arguments[0]);
            }
        }
        else {
            if (typeof arguments[0] == 'string') {
                return this._mapping(arguments[0], arguments[1]);
            }
            else {
                return _.map(arguments, function (m) {
                    return self._mapping(m.name, m);
                });
            }
        }
    }
    return null;
};


/*
 HTTP Requests
 */
Collection.prototype._httpResponse = function (method, path) {
    var self = this;
    var args = Array.prototype.slice.call(arguments, 2);
    var callback;
    var opts = {};
    var name = this._name;
    if (typeof(args[0]) == 'function') {
        callback = args[0];
    }
    else if (typeof (args[0]) == 'object') {
        opts = args[0];
        callback = args[1];
    }
    opts.type = method;
    if (!opts.url) { // Allow overrides.
        var baseURL = this.baseURL;
        opts.url = baseURL + path;
    }
    opts.success = function (data, textStatus, jqXHR) {
        if (HttpLogger.trace.isEnabled)
            HttpLogger.trace(opts.type + ' ' + jqXHR.status + ' ' + opts.url + ': ' + JSON.stringify(data, null, 4));
        var resp = {data: data, textStatus: textStatus, jqXHR: jqXHR};
        var descriptors = DescriptorRegistry.responseDescriptorsForCollection(self);
        var matchedDescriptor;
        var extractedData;

        for (var i = 0; i < descriptors.length; i++) {
            var descriptor = descriptors[i];
            extractedData = descriptor.match(opts, data);
            if (extractedData) {
                matchedDescriptor = descriptor;
                break;
            }
        }
        if (matchedDescriptor) {
            if (Logger.trace.isEnabled)
                Logger.trace('Mapping extracted data: ' + JSON.stringify(extractedData, null, 4));
            if (typeof(extractedData) == 'object') {
                var mapping = matchedDescriptor.mapping;
                mapping.map(extractedData, function (err, obj) {
                    if (callback) {
                        callback(err, obj, resp);
                    }
                }, opts.obj);
            }
            else { // Matched, but no data.
                callback(null, true, resp);
            }
        }
        else if (callback) {
            if (name) {
                callback(null, null, resp);
            }
            else {
                // There was a bug where collection name doesn't exist. If this occurs, then will never get hold of any descriptors.
                throw new RestError('Unnamed collection');
            }

        }
    };
    opts.error = function (jqXHR, textStatus, errorThrown) {
        var resp = {jqXHR: jqXHR, textStatus: textStatus, errorThrown: errorThrown};
        if (callback) callback(resp, null, resp);
    };
    $.ajax(opts);
};

Collection.prototype.GET = function () {
    _.partial(this._httpResponse, 'GET').apply(this, arguments);
};

Collection.prototype.OPTIONS = function () {
    _.partial(this._httpResponse, 'OPTIONS').apply(this, arguments);
};

Collection.prototype.TRACE = function () {
    _.partial(this._httpRequest, 'TRACE').apply(this, arguments);
};

Collection.prototype.HEAD = function () {
    _.partial(this._httpResponse, 'HEAD').apply(this, arguments);
};

Collection.prototype.POST = function () {
    _.partial(this._httpRequest, 'POST').apply(this, arguments);
};

Collection.prototype.PUT = function () {
    _.partial(this._httpRequest, 'PUT').apply(this, arguments);
};

Collection.prototype.PATCH = function () {
    _.partial(this._httpRequest, 'PATCH').apply(this, arguments);
};

Collection.prototype._httpRequest = function (method, path, object) {
    var self = this;
    var args = Array.prototype.slice.call(arguments, 2);
    var callback;
    var opts = {};
    if (typeof(args[0]) == 'function') {
        callback = args[0];
    }
    else if (typeof (args[0]) == 'object') {
        opts = args[0];
        callback = args[1];
    }
    args = Array.prototype.slice.call(args, 2);
    var requestDescriptors = DescriptorRegistry.requestDescriptorsForCollection(this);
    var matchedDescriptor;
    opts.type = method;
    var baseURL = this.baseURL;
    opts.url = baseURL + path;
    for (var i = 0; i < requestDescriptors.length; i++) {
        var requestDescriptor = requestDescriptors[i];
        if (requestDescriptor._matchConfig(opts)) {
            matchedDescriptor = requestDescriptor;
            break;
        }
    }
    if (matchedDescriptor) {
        if (Logger.trace.isEnabled)
            Logger.trace('Matched descriptor: ' + matchedDescriptor._dump(true));
        matchedDescriptor._serialise(object, function (err, data) {
            if (Logger.trace.isEnabled)
                Logger.trace('_serialise', {err: err, data: data});
            if (err) {
                if (callback) callback(err, null, null);
            }
            else {
                opts.data = data;
                opts.obj = object;
                _.partial(self._httpResponse, method, path, opts, callback).apply(self, args);
            }
        });
    }
    else if (callback) {
        if (Logger.trace.isEnabled)
            Logger.trace('Did not match descriptor');
        callback(null, null, null);
    }
};

function requestDescriptor(opts) {
    var requestDescriptor = new RequestDescriptor(opts);
    DescriptorRegistry.registerRequestDescriptor(requestDescriptor);
    return requestDescriptor;
}

function responseDescriptor(opts) {
    var responseDescriptor = new ResponseDescriptor(opts);
    DescriptorRegistry.registerResponseDescriptor(responseDescriptor);
    return responseDescriptor;
}

Collection.prototype._descriptor = function (registrationFunc) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (args.length) {
        if (args.length == 1) {
            if (util.isArray(args[0])) {
                return _.map(args[0], function (d) {
                    return registrationFunc(d);
                });
            }
            else {
                return registrationFunc(args[0]);
            }
        }
        else {
            return _.map(args, function (d) {
                return registrationFunc(d);
            });
        }
    }
    return null;
};

Collection.prototype.requestDescriptor = function () {
    return _.partial(this._descriptor, requestDescriptor).apply(this, arguments);
};

Collection.prototype.responseDescriptor = function () {
    return _.partial(this._descriptor, responseDescriptor).apply(this, arguments);
};

Collection.prototype._dump = function (asJson) {
    var obj = {};
    obj.installed = this.installed;
    obj.docId = this._docId;
    obj.name = this._name;
    obj.baseURL = this.baseURL;
    return asJson ? JSON.stringify(obj, null, 4) : obj;
};

exports.Collection = Collection;

