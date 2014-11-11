(function () {

    var _i = siesta._internal
        , mapping = _i.mapping
        , util = _i.util
        , extend = _.extend
        , Mapping = mapping.Mapping
        ;

    var changes = require('./changes')
        , pouch = require('./pouch')
        , query = require('./query')
        , index = require('./index')
        , store = require('./store')
        ;

    var oldReset = siesta.reset;

    siesta.reset = function (inMemory, callback) {
        changes.resetChanges();
        index.clearIndexes();
        pouch.reset(inMemory, callback);
        oldReset.apply(oldReset, arguments);
    };

    var oldInstall = mapping.Mapping.prototype.install;

    Mapping.prototype.getIndexesToInstall = function () {
        var self = this;
        var fieldHash = _.reduce(self._fields, function (m, f) {
            m[f] = {};
            return m
        }, {});
        for (var prop in self.relationships) {
            if (self.relationships.hasOwnProperty(prop)) {
                var r = self.relationships[prop];
                if (r.reverse != prop) {
                    fieldHash[prop] = {};
                }
            }
        }
        var indexesToInstall = _.reduce(self.indexes, function (m, f) {
            if (fieldHash[f]) m.push(f);
            return m;
        }, []);
        if (self.id) indexesToInstall.push(self.id);
        return  indexesToInstall;
    };

    Mapping.prototype.install = function (callback) {
        var deferred = q.defer();
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
        var self = this;
        oldInstall.call(this, function (err) {
            if (!err) {
                var indexesToInstall = self.getIndexesToInstall();
                index.installIndexes(self.collection, self.type, indexesToInstall, function (err) {
                    self._installed = !err;
                    if (callback) callback(err);
                });
            }
            else if (callback) {
                callback(err);
            }
        });
        return deferred.promise;
    };

    if (!siesta.ext) {
        siesta.ext = {};
    }

    siesta.ext.storage = {
        changes: changes,
        pouch: pouch,
        Pouch: pouch,
        query: query,
        index: index,
        store: store,
        Index: index.Index,
        RawQuery: query.RawQuery
    };

})();