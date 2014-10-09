var _i = siesta._internal
    , wrappedCallback = _i.misc.wrappedCallback
    , util = _i.util
    , _ = util._
    , cache = _i.cache
    , RestError = _i.error.RestError
    , log = _i.log
    , originalStore = _i.store
;

var Logger = log.loggerWithName('Store');
Logger.setLevel(log.Level.warn);

var PouchAdapter = require('./pouch');
var index = require('./index');
var Index = index.Index;

function get(opts, callback) {
    if (Logger.debug.isEnabled)
        Logger.debug('get', opts);
    var siestaModel;
    if (opts._id) {
        if (util.isArray(opts._id)) {
            // Proxy onto getMultiple instead.
            getMultiple(_.map(opts._id, function (id) {return {_id: id}}), callback);
        }
        else {
            siestaModel = cache.get(opts);
            if (siestaModel) {
                if (Logger.debug.isEnabled)
                    Logger.debug('Had cached object', {opts: opts, obj: siestaModel});
                wrappedCallback(callback)(null, siestaModel);
            }
            else {
                if (util.isArray(opts._id)) {
                    // Proxy onto getMultiple instead.
                    getMultiple(_.map(opts._id, function (id) {return {_id: id}}), callback);
                }
                else {
                    PouchAdapter.getPouch().get(opts._id).then(function (doc) {
                        var docs = PouchAdapter.toSiesta([doc]);
                        if (callback) callback(null, docs.length ? docs[0] : null);
                    }, wrappedCallback(callback));
                }
            }
        }
    }
    else if (opts.mapping) {
        if (util.isArray(opts[opts.mapping.id])) {
            // Proxy onto getMultiple instead.
            getMultiple(_.map(opts[opts.mapping.id], function (id) {
                var o = {};
                o[opts.mapping.id] = id;
                o.mapping = opts.mapping;
                return o
            }), callback);
        }
        else {
            siestaModel = cache.get(opts);
            if (siestaModel) {
                if (Logger.debug.isEnabled)
                    Logger.debug('Had cached object', {opts: opts, obj: siestaModel});
                wrappedCallback(callback)(null, siestaModel);
            }
            else {
                var mapping = opts.mapping;
                if (mapping.singleton) {
                    mapping.get(callback);
                }
                else {
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
/**
 * Uses pouch bulk fetch API. Much faster than getMultiple.
 * @param localIdentifiers
 * @param callback
 */
function getMultipleLocal (localIdentifiers, callback) {
    var results = _.reduce(localIdentifiers, function (memo, _id) {
        var obj = cache.get({_id: _id});
        if (obj) {
            memo.cached[_id] = obj;
        }
        else {
            memo.notCached.push(_id);
        }
        return memo;
    }, {cached: {}, notCached: []});

    function finish(err) {
        if (callback) {
            if (err) {
                callback(err);
            }
            else {
                callback(null, _.map(localIdentifiers, function (_id) {
                    return results.cached[_id];
                }));
            }
        }
    }

    if (results.notCached.length) {
        PouchAdapter.getPouch().allDocs({keys: results.notCached, include_docs: true}, function (err, docs) {
            if (err) {
                finish(err);
            }
            else {
                var rows = _.pluck(docs.rows, 'doc');
                var models = PouchAdapter.toSiesta(rows);
                _.each(models, function (m) {
                    if (m) {
                        results.cached[m._id] = m;
                    }
                });
                finish();
            }
        })
    }
    else {
        finish();
    }
};
function getMultipleRemote (remoteIdentifiers, mapping, callback) {
    var results = _.reduce(remoteIdentifiers, function (memo, id) {
        var cacheQuery = {mapping: mapping};
        cacheQuery[mapping.id] = id;
        var obj = cache.get(cacheQuery);
        if (obj) {
            memo.cached[id] = obj;
        }
        else {
            memo.notCached.push(id);
        }
        return memo;
    }, {cached: {}, notCached: []});

    function finish(err) {
        if (callback) {
            if (err) {
                callback(err);
            }
            else {
                callback(null, _.map(remoteIdentifiers, function (id) {
                    return results.cached[id];
                }));
            }
        }
    }

    if (results.notCached.length) {
        var i = new Index(mapping.collection, mapping.type, [mapping.id]);
        var name = i._getName();
        PouchAdapter.getPouch().query(name, {keys: remoteIdentifiers, include_docs: true}, function (err, docs) {
            if (err) {
                finish(err);
            }
            else {
                var rows = _.pluck(docs.rows, 'doc');
                var models = PouchAdapter.toSiesta(rows);
                _.each(models, function (model) {
                    var remoteId = model[mapping.id];
                    results.cached[remoteId] = model;
                });
                finish();
            }
        });
    }
    else {
        finish();
    }
}

originalStore.get = get;
originalStore.getMultiple = getMultiple;
originalStore.getMultipleLocal = getMultipleLocal;
originalStore.getMultipleRemote = getMultipleRemote;
