(function () {

    var _i = siesta._internal
        , mapping = _i.mapping
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

    Mapping.prototype.install = function (callback) {
        var self = this;
        oldInstall.call(this, function (err) {
            if (!err) {
                var indexesToInstall = [];
                _.each(self._fields, function (f) {
                    indexesToInstall.push(f);
                });
                for (var prop in self.relationships) {
                    if (self.relationships.hasOwnProperty(prop)) {
                        var r = self.relationships[prop];
                        if (r.reverse != prop) {
                            indexesToInstall.push(prop);
                        }
                    }
                }
                index.installIndexes(self.collection, self.type, indexesToInstall, function (err) {
                    self._installed = !err;
                    if (callback) callback(err);
                });
            }
            else if (callback) {
                callback(err);
            }
        });
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