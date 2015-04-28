var log = require('./log')('filter'),
  util = require('./util'),
  error = require('./error'),
  ModelInstance = require('./ModelInstance'),
  constructFilterSet = require('./FilterSet');

/**
 * @class
 * @param {Model} model
 * @param {Object} filter
 */
function Filter(model, filter) {
  var opts = {};
  for (var prop in filter) {
    if (filter.hasOwnProperty(prop)) {
      if (prop.slice(0, 2) == '__') {
        opts[prop.slice(2)] = filter[prop];
        delete filter[prop];
      }
    }
  }
  util.extend(this, {
    model: model,
    query: filter,
    opts: opts
  });
  opts.order = opts.order || [];
  if (!util.isArray(opts.order)) opts.order = [opts.order];
}

function valueAsString(fieldValue) {
  var fieldAsString;
  if (fieldValue === null) fieldAsString = 'null';
  else if (fieldValue === undefined) fieldAsString = 'undefined';
  else if (fieldValue instanceof ModelInstance) fieldAsString = fieldValue.localId;
  else fieldAsString = fieldValue.toString();
  return fieldAsString;
}

function contains(opts) {
  if (!opts.invalid) {
    var obj = opts.object;
    if (util.isArray(obj)) {
      arr = util.pluck(obj, opts.field);
    }
    else
      var arr = obj[opts.field];
    if (util.isArray(arr) || util.isString(arr)) {
      return arr.indexOf(opts.value) > -1;
    }
  }
  return false;
}

var comparators = {
  e: function(opts) {
    return opts.object[opts.field] == opts.value;
  },
  ne: function(opts) {
    return opts.object[opts.field] != opts.value;
  },
  lt: function(opts) {
    if (!opts.invalid) return opts.object[opts.field] < opts.value;
    return false;
  },
  gt: function(opts) {
    if (!opts.invalid) return opts.object[opts.field] > opts.value;
    return false;
  },
  lte: function(opts) {
    if (!opts.invalid) return opts.object[opts.field] <= opts.value;
    return false;
  },
  gte: function(opts) {
    if (!opts.invalid) return opts.object[opts.field] >= opts.value;
    return false;
  },
  contains: contains,
  in: contains
};

util.extend(Filter, {
  comparators: comparators,
  registerComparator: function(symbol, fn) {
    if (!comparators[symbol]) {
      comparators[symbol] = fn;
    }
  }
});

function cacheForModel(model) {
  var cacheByType = model.context.cache._localCacheByType;
  var modelName = model.name;
  var collectionName = model.collectionName;
  var cacheByModel = cacheByType[collectionName];
  var cacheByLocalId;
  if (cacheByModel) {
    cacheByLocalId = cacheByModel[modelName] || {};
  }
  return cacheByLocalId;
}

util.extend(Filter.prototype, {
  execute: function(cb) {
    return util.promise(cb, function(cb) {
      this._executeInMemory(cb);
    }.bind(this));
  },
  _dump: function(asJson) {
    return asJson ? '{}' : {};
  },
  sortFunc: function(fields) {
    var sortFunc = function(ascending, field) {
      return function(v1, v2) {
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
  _sortResults: function(res) {
    var order = this.opts.order;
    if (res && order) {
      var fields = order.map(function(ordering) {
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
  _getCacheByLocalId: function() {
    return this.model.descendants.reduce(function(memo, childModel) {
      return util.extend(memo, cacheForModel(childModel));
    }, util.extend({}, cacheForModel(this.model)));
  },
  _executeInMemory: function(callback) {
    var cacheByLocalId = this._getCacheByLocalId();
    var keys = Object.keys(cacheByLocalId);
    var self = this;
    var res = [];
    var err;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var obj = cacheByLocalId[k];
      var matches = self.objectMatchesFilter(obj);
      if (typeof(matches) == 'string') {
        err = error(matches);
        break;
      } else {
        if (matches) res.push(obj);
      }
    }
    res = this._sortResults(res);
    callback(err, err ? null : constructFilterSet(res, this.model));
  },
  clearOrdering: function() {
    this.opts.order = null;
  },
  objectMatchesOrFilter: function(obj, orFilter) {
    for (var idx in orFilter) {
      if (orFilter.hasOwnProperty(idx)) {
        var filter = orFilter[idx];
        if (this.objectMatchesBaseFilter(obj, filter)) {
          return true;
        }
      }
    }
    return false;
  },
  objectMatchesAndFilter: function(obj, andFilter) {
    for (var idx in andFilter) {
      if (andFilter.hasOwnProperty(idx)) {
        var filter = andFilter[idx];
        if (!this.objectMatchesBaseFilter(obj, filter)) {
          return false;
        }
      }
    }
    return true;
  },
  splitMatches: function(obj, unprocessedField, value) {
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
    fields.slice(0, fields.length - 1).forEach(function(f) {
      if (util.isArray(obj)) {
        obj = util.pluck(obj, f);
      }
      else {
        obj = obj[f];
      }
    });
    // If we get to the point where we're about to index null or undefined we stop - obviously this object does
    // not match the filter.
    var notNullOrUndefined = obj != undefined;
    if (notNullOrUndefined) {
      if (util.isArray(obj)) {
      }
      else {
        var val = obj[field];
        var invalid = util.isArray(val) ? false : val === null || val === undefined;
      }
      var comparator = Filter.comparators[op],
        opts = {object: obj, field: field, value: value, invalid: invalid};
      if (!comparator) {
        return 'No comparator registered for filter operation "' + op + '"';
      }
      return comparator(opts);
    }
    return false;
  },
  objectMatches: function(obj, unprocessedField, value, filter) {
    if (unprocessedField == '$or') {
      var $or = filter['$or'];
      if (!util.isArray($or)) {
        $or = Object.keys($or).map(function(k) {
          var normalised = {};
          normalised[k] = $or[k];
          return normalised;
        });
      }
      if (!this.objectMatchesOrFilter(obj, $or)) return false;
    }
    else if (unprocessedField == '$and') {
      if (!this.objectMatchesAndFilter(obj, filter['$and'])) return false;
    }
    else {
      var matches = this.splitMatches(obj, unprocessedField, value);
      if (typeof matches != 'boolean') return matches;
      if (!matches) return false;
    }
    return true;
  },
  objectMatchesBaseFilter: function(obj, filter) {
    var fields = Object.keys(filter);
    for (var i = 0; i < fields.length; i++) {
      var unprocessedField = fields[i],
        value = filter[unprocessedField];
      var rt = this.objectMatches(obj, unprocessedField, value, filter);
      if (typeof rt != 'boolean') return rt;
      if (!rt) return false;
    }
    return true;
  },
  objectMatchesFilter: function(obj) {
    return this.objectMatchesBaseFilter(obj, this.query);
  }
});

module.exports = Filter;
