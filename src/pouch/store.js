var _i = siesta._internal
    , wrappedCallback = _i.misc.wrappedCallback
    , util = _i.util
    , _ = util._
    , cache = _i.cache
    , RestError = _i.error.RestError
    , log = _i.log
    , coreStore = _i.store
    , q = _i.q
;

var Logger = log.loggerWithName('Store');
Logger.setLevel(log.Level.trace);

var PouchAdapter = require('./pouch');
var index = require('./index');
var Index = index.Index;

function getFromPouch(opts, callback) {
    PouchAdapter.getPouch().get(opts._id).then(function (doc) {
        var docs = PouchAdapter.toSiesta([doc]);
        if (callback) callback(null, docs.length ? docs[0] : null);
    }, wrappedCallback(callback));
}

function getMultipleLocalFromCouch(results, callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    PouchAdapter.getPouch().allDocs({keys: results.notCached, include_docs: true}, function (err, docs) {
        if (err) {
            callback(err);
        }
        else {
            var rows = _.pluck(docs.rows, 'doc');
            var models = PouchAdapter.toSiesta(rows);
            _.each(models, function (m) {
                if (m) {
                    results.cached[m._id] = m;
                }
            });
            callback();
        }
    });
    return deferred.promise;
}

function getMultipleRemoteFrompouch(mapping, remoteIdentifiers, results, callback) {
    if (Logger.trace.isEnabled) Logger.trace('getMultipleRemoteFrompouch(' + mapping.type + '):', remoteIdentifiers);
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    var i = new Index(mapping.collection, mapping.type, [mapping.id]);
    var name = i._getName();
    PouchAdapter.getPouch().query(name, {keys: _.map(remoteIdentifiers, function (i) {return i.toString();}), include_docs: true}, function (err, docs) {
        if (err) {
            callback(err);
        }
        else {
            var rows = _.pluck(docs.rows, 'value');
            if (Logger.trace.isEnabled) Logger.trace('[ROWS] getMultipleRemoteFrompouch(' + mapping.type + '):', rows);
            var models = PouchAdapter.toSiesta(rows);
            _.each(models, function (model) {
                var remoteId = model[mapping.id];
                results.cached[remoteId] = model;
                var idx = results.notCached.indexOf(remoteId);
                results.notCached.splice(idx, 1);
            });
            if (Logger.trace.isEnabled) {
                Logger.trace('[RESULTS] getMultipleRemoteFrompouch(' + mapping.type + '):', results);
            }
            callback();
        }
    });
    return deferred.promise;
}

exports.getFromPouch = getFromPouch;
exports.getMultipleLocalFromCouch = getMultipleLocalFromCouch;
exports.getMultipleRemoteFrompouch = getMultipleRemoteFrompouch;