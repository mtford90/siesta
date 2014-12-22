/**
 * @module query
 */

var log = require('./operation/log')
    , cache = require('./cache')
    , util = require('./util');

var Logger = log.loggerWithName('Query');
Logger.setLevel(log.Level.warn);

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

function cacheForMapping(mapping) {
    var cacheByType = cache._localCacheByType;
    var mappingName = mapping.type;
    var collectionName = mapping.collection;
    var cacheByMapping = cacheByType[collectionName];
    var cacheByLocalId;
    if (cacheByMapping) {
        cacheByLocalId = cacheByMapping[mappingName] || {};
    }
    return cacheByLocalId;
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
    _sortResults: function (res) {
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
    /**
     * Return all descendants in the hierarchy of the given model.
     * @param model
     */
    gatherDescendants: function (model) {
        return _.reduce(model.children, function (memo, descendant) {
            return Array.prototype.concat.call(memo, this.gatherDescendants(descendant));
        }.bind(this), model.children);
    },
    /**
     * Return all model instances in the cache.
     * @private
     */
    _getCacheByLocalId: function () {
        var mapping = this.mapping;
        var descendants = this.gatherDescendants(mapping);
        return _.reduce(descendants, function (memo, childMapping) {
            return _.extend(memo, cacheForMapping(childMapping));
        }, _.extend({}, cacheForMapping(mapping)));
    },
    _executeInMemory: function (callback) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
        var cacheByLocalId = this._getCacheByLocalId();
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
            var isAttribute = this.mapping._attributeNames.indexOf(field) > -1;
            var queryObj = this.query[origField];
            var val = isAttribute ? obj.__values[field] : obj[field];
            var invalid = val === null || val === undefined;
            if (Logger.trace) {
                var stringVal;
                if (val === null) stringVal = 'null';
                else if (val === undefined) stringVal = 'undefined';
                else stringVal = val.toString();
            }
            if (op == 'e') {
                if (Logger.trace)
                    Logger.trace(stringVal + ' == ' + queryObj.toString());
                if (val != queryObj) {
                    return false;
                }
            } else if (op == 'lt') {
                if (Logger.trace) Logger.trace(stringVal + ' < ' + queryObj.toString())
                if (invalid || val >= queryObj) {
                    return false;
                }
            } else if (op == 'lte') {
                if (Logger.trace)
                    Logger.trace(stringVal + ' <= ' + queryObj.toString());
                if (invalid || val > queryObj) {
                    return false;
                }
            } else if (op == 'gt') {
                if (Logger.trace)
                    Logger.trace(stringVal + ' > ' + queryObj.toString());
                if (invalid || val <= queryObj) {
                    return false;
                }
            } else if (op == 'gte') {
                if (Logger.trace)
                    Logger.trace(stringVal + ' >= ' + queryObj.toString());
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