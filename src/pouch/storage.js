(function () {

    var _i = siesta._internal
        , mapping = _i.mapping;

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

    var oldMapping = mapping.Mapping;

    dump('Replacing Mapping');

    function _Mapping(opts) {
        oldMapping.call(this, opts);
    }



    _Mapping.prototype = Object.create(oldMapping.prototype);

    _Mapping.install = function (callback) {
        dump('install');
        var self = this;
        oldMapping.install.call(this, function (err) {
            if (!err) {
                var indexesToInstall = [];
                _.each(this._fields, function (f) {
                    indexesToInstall.push(f);
                });
                for (var prop in this.relationships) {
                    if (this.relationships.hasOwnProperty(prop)) {
                        var r = self.relationships[prop];
                        if (r.reverse != prop) {
                            indexesToInstall.push(prop);
                        }
                    }
                }
                index.installIndexes(this.collection, this.type, indexesToInstall, function (err) {
                    self._installed = !err;
                    if (callback) callback(err);
                });
            }
            else if (callback) {
                callback(err);
            }
        });
    };

    mapping.Mapping = _Mapping;


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