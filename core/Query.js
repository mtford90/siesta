(function () {
    var log = require('./log')('Query'),
        cache = require('./cache'),
        util = require('./util'),
        error = require('./error'),
        constructQuerySet = require('./QuerySet'),
        _ = util._;

    /**
     * @class [Query description]
     * @param {Model} model
     * @param {Object} query
     */
    function Query(model, query) {
        var opts = {};
        for (var prop in query) {
            if (query.hasOwnProperty(prop)) {
                if (prop.slice(0, 2) == '__') {
                    opts[prop.slice(2)] = query[prop];
                    delete query[prop];
                }
            }
        }
        _.extend(this, {
            model: model,
            query: query,
            opts: opts
        });
        opts.order = opts.order || [];
        if (!util.isArray(opts.order)) opts.order = [opts.order];
    }

    var comparators = {
        e: function (opts) {
            var objectValue = opts.object[opts.field];
            if (log.enabled) {
                var stringValue;
                if (objectValue === null) stringValue = 'null';
                else if (objectValue === undefined) stringValue = 'undefined';
                else stringValue = objectValue.toString();
                log(opts.field + ': ' + stringValue + ' == ' + opts.value.toString());
            }
            return objectValue == opts.value;
        },
        lt: function (opts) {
            if (!opts.invalid) return opts.object[opts.field] < opts.value;
            return false;
        },
        gt: function (opts) {
            if (!opts.invalid) return opts.object[opts.field] > opts.value;
            return false;
        },
        lte: function (opts) {
            if (!opts.invalid) return opts.object[opts.field] <= opts.value;
            return false;
        },
        gte: function (opts) {
            if (!opts.invalid) return opts.object[opts.field] >= opts.value;
            return false;
        },
        contains: function (opts) {
            if (!opts.invalid) {
                var arr = opts.object[opts.field];
                if (util.isArray(arr) || util.isString(arr)) {
                    return arr.indexOf(opts.value) > -1;
                }
            }
            return false;
        }
    };

    _.extend(Query, {
        comparators: comparators,
        registerComparator: function (symbol, fn) {
            if (!comparators[symbol]) {
                comparators[symbol] = fn;
            }
        }
    });

    function cacheForModel(model) {
        var cacheByType = cache._localCacheByType;
        var modelName = model.name;
        var collectionName = model.collectionName;
        var cacheByModel = cacheByType[collectionName];
        var cacheByLocalId;
        if (cacheByModel) {
            cacheByLocalId = cacheByModel[modelName] || {};
        }
        return cacheByLocalId;
    }

    _.extend(Query.prototype, {
        execute: function (cb) {
            return util.promise(cb, function (cb) {
                this._executeInMemory(cb);
            }.bind(this));
        },
        _dump: function (asJson) {
            return asJson ? '{}' : {};
        },
        sortFunc: function (fields) {
            var sortFunc = function (ascending, field) {
                return function (v1, v2) {
                    var d1 = v1[field],
                        d2 = v2[field],
                        res;
                    if (typeof d1 == 'string' || d1 instanceof String &&
                        typeof d2 == 'string' || d2 instanceof String) {
                        res = ascending ? d1.localeCompare(d2) : d2.localeCompare(d1);
                    }
                    else {
                        if (d1 instanceof Date) d1 = d1.getTime();
                        if (d2 instanceof Date) d2 = d2.getTime();
                        if (ascending) res = d1 - d2;
                        else res = d2 - d1;
                    }
                    return res;
                }
            };
            var s = util;
            for (var i = 0; i < fields.length; i++) {
                var field = fields[i];
                s = s.thenBy(sortFunc(field.ascending, field.field));
            }
            return s == util ? null : s;
        },
        _sortResults: function (res) {
            var order = this.opts.order;
            if (res && order) {
                var fields = _.map(order, function (ordering) {
                    var splt = ordering.split('-'),
                        ascending = true,
                        field = null;
                    if (splt.length > 1) {
                        field = splt[1];
                        ascending = false;
                    }
                    else {
                        field = splt[0];
                    }
                    return {field: field, ascending: ascending};
                }.bind(this));
                var sortFunc = this.sortFunc(fields);
                if (res.immutable) res = res.mutableCopy();
                if (sortFunc) res.sort(sortFunc);
            }
            return res;
        },
        /**
         * Return all model instances in the cache.
         * @private
         */
        _getCacheByLocalId: function () {
            return _.reduce(this.model.descendants, function (memo, childModel) {
                return _.extend(memo, cacheForModel(childModel));
            }, _.extend({}, cacheForModel(this.model)));
        },
        _executeInMemory: function (callback) {
            var _executeInMemory = function () {
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
                        err = error(matches);
                        break;
                    } else {
                        if (matches) res.push(obj);
                    }
                }
                res = this._sortResults(res);
                if (err) log('Error executing query', err);
                callback(err, err ? null : constructQuerySet(res, this.model));
            }.bind(this);
            if (this.opts.ignoreInstalled) {
                _executeInMemory();
            }
            else {
                siesta._afterInstall(_executeInMemory);
            }

        },
        clearOrdering: function () {
            this.opts.order = null;
        },
        objectMatchesOrQuery: function (obj, orQuery) {
            for (var idx in orQuery) {
                if (orQuery.hasOwnProperty(idx)) {
                    var query = orQuery[idx];
                    if (this.objectMatchesBaseQuery(obj, query)) {
                        return true;
                    }
                }
            }
            return false;
        },
        objectMatchesAndQuery: function (obj, andQuery) {
            for (var idx in andQuery) {
                if (andQuery.hasOwnProperty(idx)) {
                    var query = andQuery[idx];
                    if (!this.objectMatchesBaseQuery(obj, query)) {
                        return false;
                    }
                }
            }
            return true;
        },
        splitMatches: function (obj, unprocessedField, value) {
            var op = 'e';
            var fields = unprocessedField.split('.');
            var splt = fields[fields.length - 1].split('__');
            if (splt.length == 2) {
                var field = splt[0];
                op = splt[1];
            }
            else {
                field = splt[0];
            }
            fields[fields.length - 1] = field;
            _.each(fields.slice(0, fields.length - 1), function (f) {
                obj = obj[f];
            });
            // If we get to the point where we're about to index null or undefined we stop - obviously this object does
            // not match the query.
            var notNullOrUndefined = obj != undefined;
            if (notNullOrUndefined) {
                var val = obj[field]; // Breaks here.
                var invalid = val === null || val === undefined;
                var comparator = Query.comparators[op],
                    opts = {object: obj, field: field, value: value, invalid: invalid};
                if (!comparator) {
                    return 'No comparator registered for query operation "' + op + '"';
                }
                return comparator(opts);
            }
            return false;
        },
        objectMatches: function (obj, unprocessedField, value, query) {
            if (unprocessedField == '$or') {
                if (!this.objectMatchesOrQuery(obj, query['$or'])) return false;
            }
            else if (unprocessedField == '$and') {
                if (!this.objectMatchesAndQuery(obj, query['$and'])) return false;
            }
            else {
                var matches = this.splitMatches(obj, unprocessedField, value);
                if (typeof matches != 'boolean') return matches;
                if (!matches) return false;
            }
            return true;
        },
        objectMatchesBaseQuery: function (obj, query) {
            var fields = Object.keys(query);
            for (var i = 0; i < fields.length; i++) {
                var unprocessedField = fields[i],
                    value = query[unprocessedField];
                var rt = this.objectMatches(obj, unprocessedField, value, query);
                if (typeof rt != 'boolean') return rt;
                if (!rt) return false;
            }
            return true;
        },
        objectMatchesQuery: function (obj) {
            return this.objectMatchesBaseQuery(obj, this.query);
        }
    });

    module.exports = Query;
})();