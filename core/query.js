/**
 * @module query
 */

var log = require('./operation/log')
    , cache = require('./cache')
    , util = require('./util');

var Logger = log.loggerWithName('Query');
Logger.setLevel(log.Level.trace);

/**
 * @class  [Query description]
 * @param {Mapping} mapping
 * @param {Object} opts
 */
function Query(mapping, opts) {
    this.mapping = mapping;
    this.query = opts;
    this.ordering = null;
}

_.extend(Query.prototype, {
    execute: function (callback) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
        this._executeInMemory(callback);
        return deferred ? deferred.promise : null;
    },
    _dump: function (asJson) {
        return asJson ? '{}' : {};
    },
    _sortResults: function(res) {
        if (res && this.ordering) {
            var splt = this.ordering.split('-'),
                ascending = true,
                field = null;
            if (splt.length > 1) {
                field = splt[1];
                ascending = false;
            }
            else {
                field = splt[0];
            }
            res = _.sortBy(res, function (x) {
                return x[field];
            });
            if (!ascending) res.reverse();
        }
        return res;
    },
    _executeInMemory: function (callback) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
        var cacheByType = cache._localCacheByType;
        var mappingName = this.mapping.type;
        var collectionName = this.mapping.collection;
        var cacheByMapping = cacheByType[collectionName];
        var cacheByLocalId;
        if (cacheByMapping) {
            cacheByLocalId = cacheByMapping[mappingName];
        }
        if (cacheByLocalId) {
            var keys = Object.keys(cacheByLocalId);
            var self = this;
            var res = [];
            var err;
            for (var i = 0; i < keys.length; i++) {
                var k = keys[i];
                var obj = cacheByLocalId[k];
                var matches = self.objectMatchesQuery(obj);
                if (typeof(matches) == 'string') {
                    err = matches;
                    break;
                } else {
                    if (matches) res.push(obj);
                }
            }
            res = this._sortResults(res);
            callback(err, err ? null : res);
        } else if (callback) {
            callback(null, []);
        }
        return deferred ? deferred.promise : null;
    },
    orderBy: function (order) {
        this.ordering = order;
        return this;
    },
    objectMatchesQuery: function (obj) {
        var fields = Object.keys(this.query);
        for (var i = 0; i < fields.length; i++) {
            var origField = fields[i];
            var splt = origField.split('__');
            var op = 'e';
            var field;
            if (splt.length == 2) {
                field = splt[0];
                op = splt[1];
            } else {
                field = origField;
            }
            var queryObj = this.query[origField];
            var val = obj[field];
            var invalid = val === null || val === undefined;
            if (op == 'e') {
                if (val != queryObj) {
                    return false;
                }
            } else if (op == 'lt') {
                if (Logger.trace && !invalid) Logger.trace(val.toString() + ' >= ' + queryObj.toString())
                if (invalid || val >= queryObj) {
                    return false;
                }
            } else if (op == 'lte') {
                if (invalid || val > queryObj) {
                    return false;
                }
            } else if (op == 'gt') {
                if (invalid || val <= queryObj) {
                    return false;
                }
            } else if (op == 'gte') {
                if (invalid || val < queryObj) {
                    return false;
                }
            } else {
                return 'Query operator "' + op + '"' + ' does not exist';
            }
        }
        return true;
    }
});

exports.Query = Query;