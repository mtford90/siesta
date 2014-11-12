var _i = siesta._internal
    , mapping = _i.mapping
    , utils = _i.utils
    , util = _i.utils
    , _ = utils._
    , log = _i.log
    , InternalSiestaError = _i.error.InternalSiestaError
    , Query = _i.query.Query
;

var Logger = log.loggerWithName('RawQuery');
Logger.setLevel(log.Level.warn);

var Pouch = require('./pouch')
    , index = require('./index')
    , Index = index.Index
    ;

function RawQuery(collection, modelName, query) {
    var self = this;
    this.collection = collection;
    this.modelName = modelName;
    this.query = query;

    Object.defineProperty(self, 'mapping', {
        configurable: true,
        enumerable: true,
        get: function () {
            var collection = require('./index')[self.collection];
            if (collection) {
                return collection[self.modelName];
            }
            return null;
        }
    });
}

function resultsCallback(callback, err, resp) {
    var deferred = window.q ? window.q.defer() : null;
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    if (err) {
        if (callback) callback(err);
    }
    else {
        var results = _.pluck(resp.rows, 'value');
        if (callback) callback(null, results);
    }
    return deferred ? deferred.promise : null;
}

RawQuery.prototype.execute = function (callback) {
    var deferred = window.q ? window.q.defer() : null;
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    if (this.mapping) { // During unit testing, we don't populate this.mapping, but rather configure Pouch manually.
        if (!this.mapping.installed) {
            throw new InternalSiestaError('Mapping must be installed');
        }
    }
    var self = this;
    var designDocId = this._getDesignDocName();
    var indexName = self._getIndexName();
    Pouch.getPouch().get(designDocId, function (err) {
        var partialCallback = _.partial(resultsCallback, callback);

        function finish(err, docs) {
            if (Logger.trace.isEnabled)
                Logger.trace('Received results: ', docs);
            partialCallback(err, docs);
        }

        var key;
        if (!err) {
            key = self._constructKey();
            if (!key.length) {
                key = self.modelName;
            }
            if (Logger.debug.isEnabled)
                Logger.debug('Executing query ' + indexName + ':' + ' ' + key);
            Pouch.getPouch().query(indexName, {key: key}, finish);
        }
        else {
            if (err.status == 404) {
                Logger.warn('Couldnt find index "' + indexName + '" and hence must iterate through every single document.');
                var fields = self._sortedFields();
                // TODO: Clean up constructMapFunction so can output both string+func version so don't need eval here.
                // TODO: For some reason constructMapFunction2 (which returns a function) wont work with pouch.
                // I'm thinking that pouch probably doesnt support closures in its queries which would mean
                // we'd have to stick with eval here.
                var f = mapping.constructMapFunction(self.collection, self.modelName, fields);
                eval('var mapFunc = ' + f);
                key = self._constructKey(fields);
                if (!key.length) {
                    key = self.modelName;
                }
                //noinspection JSUnresolvedVariable
                Pouch.getPouch().query(mapFunc, {key: key}, finish);
            }
            else {
                finish(err);
            }
        }
    });
    return deferred ? deferred.promise : null;
};

RawQuery.prototype._getFields = function () {
    var fields = [];
    for (var field in this.query) {
        if (this.query.hasOwnProperty(field)) {
            fields.push(field);
        }
    }
    return fields;
};

RawQuery.prototype._sortedFields = function () {
    var fields = this._getFields();
    return _.sortBy(fields, function (x) {return x});
};

RawQuery.prototype._constructKey = function () {
    var self = this;
    var sortedFields = this._sortedFields();
    var key = _.reduce(sortedFields, function (memo, x) {
        var v;
        if (x === null) {
            v = 'null';
        }
        else if (x === undefined) {
            v = 'undefined';
        }
        else {
            v = self.query[x].toString()
        }
        return memo + v + '_';
    }, '');
    return key.substring(0, key.length - 1);
};

RawQuery.prototype._getDesignDocName = function () {
    var i = new index.Index(this.collection, this.modelName, this._getFields());
    return i._getDesignDocName();
};

RawQuery.prototype._getIndexName = function () {
    var i = new index.Index(this.collection, this.modelName, this._getFields());
    return i._getName();
};

RawQuery.prototype._dump = function (asJson) {
    var obj = {};
    obj.collection = this.collection;
    obj.mapping = this.modelName;
    obj.query = this.query;
    obj.index = this._getIndexName();
    obj.designDoc = this._getDesignDocName();
    return asJson ? JSON.stringify(obj, null, 4) : obj;
};



exports.RawQuery = RawQuery;