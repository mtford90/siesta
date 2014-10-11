var log = require('../vendor/operations.js/src/log');
var Logger = log.loggerWithName('Collection');
Logger.setLevel(log.Level.warn);

var CollectionRegistry = require('./collectionRegistry').CollectionRegistry;
var DescriptorRegistry = require('./descriptorRegistry').DescriptorRegistry;
var RequestDescriptor = require('./requestDescriptor').RequestDescriptor;
var ResponseDescriptor = require('./responseDescriptor').ResponseDescriptor;
var Operation = require('../vendor/operations.js/src/operation').Operation;
var RestError = require('./error').RestError;
var Mapping = require('./mapping').Mapping;
var extend = require('extend');
var observe = require('../vendor/observe-js/src/observe').Platform;

//var $ = require('../vendor/zepto').$;
var util = require('./util');
var _ = util._;

var q = require('q');

/**
 * @param name
 * @constructor
 */
function Collection(name) {
    if (!this) return new Collection(name);
    if (!name) throw RestError('Collection must have a name');
    this._name = name;
    this._docId = 'Collection_' + this._name;
    this._rawMappings = {};
    this._mappings = {};
    this.baseURL = '';
    this.installed = false;
    CollectionRegistry.register(this);
}

/**
 * Ensure mappings are installed.
 * @param callback
 */
Collection.prototype.install = function (callback) {
    var deferred = q.defer();
    var self = this;
    if (!this.installed) {
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
                    Logger.error('Failed to install collection', op.error);
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
    return deferred.promise;
};

Collection.prototype._finaliseInstallation = function (err, callback) {
    if (!err) {
        this.installed = true;
        var index = require('../index');
        index[this._name] = this;
    }
    if (callback) callback(err);
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

