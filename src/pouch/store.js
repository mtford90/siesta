var _i = siesta._internal
    , wrappedCallback = _i.misc.wrappedCallback
    , util = _i.util
    , _ = util._
    , cache = _i.cache
    , RestError = _i.error.RestError
    , log = _i.log
    , coreStore = _i.store
;

var Logger = log.loggerWithName('Store');
Logger.setLevel(log.Level.warn);

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
    })
}

function getMultipleRemoteFrompouch(mapping, remoteIdentifiers, results, callback) {
    var i = new Index(mapping.collection, mapping.type, [mapping.id]);
    var name = i._getName();
    PouchAdapter.getPouch().query(name, {keys: remoteIdentifiers, include_docs: true}, function (err, docs) {
        if (err) {
            callback(err);
        }
        else {
            var rows = _.pluck(docs.rows, 'doc');
            var models = PouchAdapter.toSiesta(rows);
            _.each(models, function (model) {
                var remoteId = model[mapping.id];
                results.cached[remoteId] = model;
            });
            callback();
        }
    });
}

exports.getFromPouch = getFromPouch;
exports.getMultipleLocalFromCouch = getMultipleLocalFromCouch;
exports.getMultipleRemoteFrompouch = getMultipleRemoteFrompouch;