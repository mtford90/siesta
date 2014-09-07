var wrappedCallback = require('./misc').wrappedCallback;
var PouchAdapter = require('./pouch');
var RestError = require('./error').RestError;
var log = require('../vendor/operations.js/src/log');
var Logger = log.loggerWithName('Store');
Logger.setLevel(log.Level.warn);

var cache = require('./cache');

function get(opts, callback) {
    if (Logger.debug.isEnabled)
        Logger.debug('get', opts);
    var restObject;
    if (opts._id) {
        if (Object.prototype.toString.call(opts._id) === '[object Array]') {
            // Proxy onto getMultiple instead.
            getMultiple(_.map(opts._id, function (id) {return {_id: id}}), callback);
        }
        else {
            restObject = cache.get(opts);
            if (restObject) {
                if (Logger.debug.isEnabled)
                    Logger.debug('Had cached object', {opts: opts, obj: restObject});
                wrappedCallback(callback)(null, restObject);
            }
            else {
                if (Object.prototype.toString.call(opts._id) === '[object Array]') {
                    // Proxy onto getMultiple instead.
                    getMultiple(_.map(opts._id, function (id) {return {_id: id}}), callback);
                }
                else {
                    PouchAdapter.getPouch().get(opts._id).then(function (doc) {
                        var docs = PouchAdapter.toFount([doc]);

                        if (callback) callback(null, docs.length ? docs[0] : null);
                    }, wrappedCallback(callback));
                }
            }
        }
    }
    else if (opts.mapping) {
        if (Object.prototype.toString.call(opts[opts.mapping.id]) === '[object Array]') {
            // Proxy onto getMultiple instead.
            getMultiple(_.map(opts[opts.mapping.id], function (id) {
                var o = {};
                o[opts.mapping.id] = id;
                o.mapping = opts.mapping;
                return o
            }), callback);
        }
        else {
            restObject = cache.get(opts);
            if (restObject) {
                if (Logger.debug.isEnabled)
                    Logger.debug('Had cached object', {opts: opts, obj: restObject});
                wrappedCallback(callback)(null, restObject);
            }
            else {
                var mapping = opts.mapping;
                var idField = mapping.id;
                var id = opts[idField];
                if (id) {
                    mapping.get(id, function (err, obj) {
                        if (!err) {
                            if (obj) {
                                callback(null, obj);
                            }
                            else {
                                callback(null, null);
                            }
                        }
                        else {
                            callback(err);
                        }
                    });
                }
                else {
                    wrappedCallback(callback)(new RestError('Invalid options given to store. Missing "' + idField.toString() + '."', {opts: opts}));
                }
            }
        }
    }
    else {
        // No way in which to find an object locally.
        var context = {opts: opts};
        var msg = 'Invalid options given to store';
        Logger.error(msg, context);
        wrappedCallback(callback)(new RestError(msg, context));
    }
}

function getMultiple(optsArray, callback) {
    var docs = [];
    var errors = [];
    _.each(optsArray, function (opts) {
        get(opts, function (err, doc) {
            if (err) {
                errors.push(err);
            }
            else {
                docs.push(doc);
            }
            if (docs.length + errors.length == optsArray.length) {
                if (callback) {
                    if (errors.length) {
                        callback(errors);
                    }
                    else {
                        callback(null, docs);
                    }
                }
            }
        });
    });
}

exports.get = get;
exports.getMultiple = getMultiple;
