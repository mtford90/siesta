(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function() {

  var argsarray = require('argsarray');

  /**
   * Class for facilitating "chained" behaviour e.g:
   *
   * var cancel = Users
   *  .on('new', function (user) {
   *     // ...
   *   })
   *  .query({$or: {age__gte: 20, age__lte: 30}})
   *  .on('*', function (change) {
   *     // ..
   *   });
   *
   * @param opts
   * @constructor
   */
  function Chain(opts) {
    this.opts = opts;
  }

  Chain.prototype = {
    /**
     * Construct a link in the chain of calls.
     * @param opts
     * @param opts.fn
     * @param opts.type
     */
    _handlerLink: function(opts) {
      var firstLink;
      firstLink = function() {
        var typ = opts.type;
        if (opts.fn)
          this._removeListener(opts.fn, typ);
        if (firstLink._parentLink) firstLink._parentLink(); // Cancel listeners all the way up the chain.
      }.bind(this);
      Object.keys(this.opts).forEach(function(prop) {
        var func = this.opts[prop];
        firstLink[prop] = argsarray(function(args) {
          var link = func.apply(func.__siesta_bound_object, args);
          link._parentLink = firstLink;
          return link;
        }.bind(this));
      }.bind(this));
      firstLink._parentLink = null;
      return firstLink;
    },
    /**
     * Construct a link in the chain of calls.
     * @param opts
     * @param {Function} [clean]
     */
    _link: function(opts, clean) {
      var chain = this;
      clean = clean || function() {};
      var link;
      link = function() {
        clean();
        if (link._parentLink) link._parentLink(); // Cancel listeners all the way up the chain.
      }.bind(this);
      link.__siesta_isLink = true;
      link.opts = opts;
      link.clean = clean;
      Object.keys(opts).forEach(function(prop) {
        var func = opts[prop];
        link[prop] = argsarray(function(args) {
          var possibleLink = func.apply(func.__siesta_bound_object, args);
          if (!possibleLink || !possibleLink.__siesta_isLink) { // Patch in a link in the chain to avoid it being broken, basing off the current link
            nextLink = chain._link(link.opts);
            for (var prop in possibleLink) {
              //noinspection JSUnfilteredForInLoop
              if (possibleLink[prop] instanceof Function) {
                //noinspection JSUnfilteredForInLoop
                nextLink[prop] = possibleLink[prop];
              }
            }
          }
          else {
            var nextLink = possibleLink;
          }
          nextLink._parentLink = link;
          // Inherit methods from the parent link if those methods don't already exist.
          for (prop in link) {
            if (link[prop] instanceof Function) {
              nextLink[prop] = link[prop].bind(link);
            }
          }
          return nextLink;
        }.bind(this));
      }.bind(this));
      link._parentLink = null;
      return link;
    }
  };
  module.exports = Chain;
})();
},{"argsarray":27}],2:[function(require,module,exports){
(function () {
    /**
     * @module relationships
     */

    var RelationshipProxy = require('./RelationshipProxy'),
        util = require('./util'),
        _ = util._,
        modelEvents = require('./modelEvents'),
        events = require('./events'),
        wrapArrayForAttributes = events.wrapArray,
        ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver,
        ModelEventType = require('./modelEvents').ModelEventType;

    /**
     * [ManyToManyProxy description]
     * @param {Object} opts
     */
    function ManyToManyProxy(opts) {
        RelationshipProxy.call(this, opts);
        this.related = [];
        this.relatedCancelListeners = {};
    }

    ManyToManyProxy.prototype = Object.create(RelationshipProxy.prototype);

    _.extend(ManyToManyProxy.prototype, {
        clearReverse: function (removed) {
            var self = this;
            _.each(removed, function (removedObject) {
                var reverseProxy = self.reverseProxyForInstance(removedObject);
                var idx = reverseProxy.related.indexOf(self.object);
                reverseProxy.makeChangesToRelatedWithoutObservations(function () {
                    reverseProxy.splice(idx, 1);
                });
            });
        },
        setReverseOfAdded: function (added) {
            var self = this;
            _.each(added, function (addedObject) {
                var reverseProxy = self.reverseProxyForInstance(addedObject);
                reverseProxy.makeChangesToRelatedWithoutObservations(function () {
                    reverseProxy.splice(0, 0, self.object);
                });
            });
        },
        wrapArray: function (arr) {
            var self = this;
            wrapArrayForAttributes(arr, this.reverseName, this.object);
            if (!arr.arrayObserver) {
                arr.arrayObserver = new ArrayObserver(arr);
                var observerFunction = function (splices) {
                    splices.forEach(function (splice) {
                        var added = splice.addedCount ? arr.slice(splice.index, splice.index + splice.addedCount) : [];
                        var removed = splice.removed;
                        self.clearReverse(removed);
                        self.setReverseOfAdded(added);
                        var model = self.getForwardModel();
                        modelEvents.emit({
                            collection: model.collectionName,
                            model: model.name,
                            localId: self.object.localId,
                            field: self.getForwardName(),
                            removed: removed,
                            added: added,
                            type: ModelEventType.Splice,
                            index: splice.index,
                            obj: self.object
                        });
                    });
                };
                arr.arrayObserver.open(observerFunction);
            }
        },
        get: function (cb) {
            return util.promise(cb, function (cb) {
                cb(null, this.related);
            }.bind(this));
        },
        validate: function (obj) {
            if (Object.prototype.toString.call(obj) != '[object Array]') {
                return 'Cannot assign scalar to many to many';
            }
            return null;
        },
        set: function (obj, opts) {
            this.checkInstalled();
            var self = this;
            if (obj) {
                var errorMessage;
                if (errorMessage = this.validate(obj)) {
                    return errorMessage;
                }
                else {
                    this.clearReverseRelated(opts);
                    self.setIdAndRelated(obj, opts);
                    this.wrapArray(obj);
                    self.setIdAndRelatedReverse(obj, opts);
                }
            }
            else {
                this.clearReverseRelated(opts);
                self.setIdAndRelated(obj, opts);
            }
        },
        install: function (obj) {
            RelationshipProxy.prototype.install.call(this, obj);
            this.wrapArray(this.related);
            obj[('splice' + util.capitaliseFirstLetter(this.reverseName))] = _.bind(this.splice, this);
        },
        registerRemovalListener: function (obj) {
            this.relatedCancelListeners[obj.localId] = obj.on('*', function (e) {

            }.bind(this));
        }
    });


    module.exports = ManyToManyProxy;
})();
},{"../vendor/observe-js/src/observe":53,"./RelationshipProxy":10,"./events":16,"./modelEvents":22,"./util":24}],3:[function(require,module,exports){
(function() {
  var log = require('./log'),
    util = require('./util'),
    _ = util._,
    error = require('./error'),
    InternalSiestaError = error.InternalSiestaError,
    modelEvents = require('./modelEvents'),
    ModelEventType = modelEvents.ModelEventType,
    events = require('./events'),
    cache = require('./cache');

  function ModelInstance(model) {
    var self = this;
    this.model = model;

    util.subProperties(this, this.model, [
      'collection',
      'collectionName',
      '_attributeNames',
      {
        name: 'idField',
        property: 'id'
      },
      {
        name: 'modelName',
        property: 'name'
      }
    ]);

    events.ProxyEventEmitter.call(this);

    Object.defineProperties(this, {
      _relationshipNames: {
        get: function() {
          var proxies = _.map(Object.keys(self.__proxies || {}), function(x) {
            return self.__proxies[x]
          });
          return _.map(proxies, function(p) {
            if (p.isForward) {
              return p.forwardName;
            } else {
              return p.reverseName;
            }
          });
        },
        enumerable: true,
        configurable: true
      },
      dirty: {
        get: function() {
          if (siesta.ext.storageEnabled) {
            return self.localId in siesta.ext.storage._unsavedObjectsHash;
          }
          else return undefined;
        },
        enumerable: true
      },
      // This is for ProxyEventEmitter.
      event: {
        get: function() {
          return this.localId
        }
      }
    });

    this.removed = false;

    /**
     * Whether or not events (set, remove etc) are emitted for this model instance.
     *
     * This is used as a way of controlling what events are emitted when the model instance is created. E.g. we don't
     * want to send a metric shit ton of 'set' events if we're newly creating an instance. We only want to send the
     * 'new' event once constructed.
     *
     * This is probably a bit of a hack and should be removed eventually.
     * @type {boolean}
     * @private
     */
    this._emitEvents = false;
  }

  ModelInstance.prototype = Object.create(events.ProxyEventEmitter.prototype);

  _.extend(ModelInstance.prototype, {
    get: function(cb) {
      return util.promise(cb, function(cb) {
        cb(null, this);
      }.bind(this));
    },
    emit: function(type, opts) {
      if (typeof type == 'object') opts = type;
      else opts.type = type;
      opts = opts || {};
      _.extend(opts, {
        collection: this.collectionName,
        model: this.model.name,
        localId: this.localId,
        obj: this
      });
      modelEvents.emit(opts);
    },
    remove: function(cb, notification) {
      notification = notification == null ? true : notification;
      return util.promise(cb, function(cb) {
        cache.remove(this);
        this.removed = true;
        if (notification) {
          this.emit(modelEvents.ModelEventType.Remove, {
            old: this
          });
        }
        var remove = this.model.remove;
        if (remove) {
          var paramNames = util.paramNames(remove);
          if (paramNames.length) {
            var self = this;
            remove.call(this, function(err) {
              cb(err, self);
            });
          }
          else {
            remove.call(this);
            cb(null, this);
          }
        }
        else {
          cb(null, this);
        }
      }.bind(this));
    },
    restore: function(cb) {
      return util.promise(cb, function(cb) {
        var _finish = function(err) {
          if (!err) {
            this.emit(modelEvents.ModelEventType.New, {
              new: this
            });
          }
          cb(err, this);
        }.bind(this);
        if (this.removed) {
          cache.insert(this);
          this.removed = false;
          var init = this.model.init;
          if (init) {
            var paramNames = util.paramNames(init);
            var fromStorage = true;
            if (paramNames.length > 1) {
              init.call(this, fromStorage, _finish);
            }
            else {
              init.call(this, fromStorage);
              _finish();
            }
          }
          else {
            _finish();
          }
        }
      }.bind(this));
    }
  });

  // Inspection
  _.extend(ModelInstance.prototype, {
    getAttributes: function() {
      return _.extend({}, this.__values);
    },
    isInstanceOf: function(model) {
      return this.model == model;
    },
    isA: function(model) {
      return this.model == model || this.model.isDescendantOf(model);
    }
  });

  // Dump
  _.extend(ModelInstance.prototype, {
    _dumpString: function(reverseRelationships) {
      return JSON.stringify(this._dump(reverseRelationships, null, 4));
    },
    _dump: function(reverseRelationships) {
      var dumped = _.extend({}, this.__values);
      dumped._rev = this._rev;
      dumped.localId = this.localId;
      return dumped;
    }
  });

  // Serialisation
  _.extend(ModelInstance.prototype, {
    _defaultSerialise: function(opts) {
      var serialised = {};
      var includeNullAttributes = opts.includeNullAttributes !== undefined ? opts.includeNullAttributes : true,
        includeNullRelationships = opts.includeNullRelationships !== undefined ? opts.includeNullRelationships : true;
      var serialisableFields = this.model.serialisableFields ||
        this._attributeNames.concat.apply(this._attributeNames, this._relationshipNames).concat(this.id);
      _.each(this._attributeNames, function(attrName) {
        if (serialisableFields.indexOf(attrName) > -1) {
          var attrDefinition = this.model._attributeDefinitionWithName(attrName) || {};
          var serialiser;
          if (attrDefinition.serialise) serialiser = attrDefinition.serialise.bind(this);
          else serialiser = this.model.serialiseField.bind(this, attrName);
          var val = this[attrName];
          if (val === null) {
            if (includeNullAttributes) {
              serialised[attrName] = serialiser(val);
            }
          }
          else if (val !== undefined) {
            serialised[attrName] = serialiser(val);
          }
        }
      }.bind(this));
      _.each(this._relationshipNames, function(relName) {
        if (serialisableFields.indexOf(relName) > -1) {
          var val = this[relName],
            rel = this.model.relationships[relName];
          if (util.isArray(val)) {
            val = _.pluck(val, this.model.id);
          }
          else if (val) {
            val = val[this.model.id];
          }
          if (rel && !rel.isReverse) {
            var serialiser;
            if (rel.serialise) serialiser = rel.serialise.bind(this);
            else serialiser = this.model.serialiseField.bind(this, relName);
            if (val === null) {
              if (includeNullRelationships) {
                serialised[relName] = serialiser(val);
              }
            }
            else if (util.isArray(val)) {
              if ((includeNullRelationships && !val.length) || val.length) {
                serialised[relName] = serialiser(val);
              }
            }
            else if (val !== undefined) {
              serialised[relName] = serialiser(val);
            }
          }
        }
      }.bind(this));
      return serialised;
    },
    serialise: function(opts) {
      opts = opts || {};
      if (!this.model.serialise) return this._defaultSerialise(opts);
      else return this.model.serialise(this, opts);
    }
  });

  _.extend(ModelInstance.prototype, {
    /**
     * Emit an event indicating that this instance has just been created.
     * @private
     */
    _emitNew: function() {
      modelEvents.emit({
        collection: this.model.collectionName,
        model: this.model.name,
        localId: this.localId,
        new: this,
        type: ModelEventType.New,
        obj: this
      });
    }
  });

  module.exports = ModelInstance;
})();
},{"./cache":12,"./error":15,"./events":16,"./log":19,"./modelEvents":22,"./util":24}],4:[function(require,module,exports){
(function () {
    var RelationshipProxy = require('./RelationshipProxy'),
        util = require('./util'),
        _ = util._,
        modelEvents = require('./modelEvents'),
        events = require('./events'),
        wrapArrayForAttributes = events.wrapArray,
        ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver,
        ModelEventType = require('./modelEvents').ModelEventType;

    /**
     * @class  [OneToManyProxy description]
     * @constructor
     * @param {[type]} opts
     */
    function OneToManyProxy(opts) {
        RelationshipProxy.call(this, opts);
        if (this.isReverse) this.related = [];
    }

    OneToManyProxy.prototype = Object.create(RelationshipProxy.prototype);

    _.extend(OneToManyProxy.prototype, {
        clearReverse: function (removed) {
            var self = this;
            _.each(removed, function (removedObject) {
                var reverseProxy = self.reverseProxyForInstance(removedObject);
                reverseProxy.setIdAndRelated(null);
            });
        },
        setReverseOfAdded: function (added) {
            var self = this;
            _.each(added, function (added) {
                var forwardProxy = self.reverseProxyForInstance(added);
                forwardProxy.setIdAndRelated(self.object);
            });
        },
        wrapArray: function (arr) {
            var self = this;
            wrapArrayForAttributes(arr, this.reverseName, this.object);
            if (!arr.arrayObserver) {
                arr.arrayObserver = new ArrayObserver(arr);
                var observerFunction = function (splices) {
                    splices.forEach(function (splice) {
                        var added = splice.addedCount ? arr.slice(splice.index, splice.index + splice.addedCount) : [];
                        var removed = splice.removed;
                        self.clearReverse(removed);
                        self.setReverseOfAdded(added);
                        var model = self.getForwardModel();
                        modelEvents.emit({
                            collection: model.collectionName,
                            model: model.name,
                            localId: self.object.localId,
                            field: self.getForwardName(),
                            removed: removed,
                            added: added,
                            type: ModelEventType.Splice,
                            index: splice.index,
                            obj: self.object
                        });
                    });
                };
                arr.arrayObserver.open(observerFunction);
            }
        },
        get: function (cb) {
            return util.promise(cb, function (cb) {
                cb(null, this.related);
            }.bind(this));
        },
        /**
         * Validate the object that we're setting
         * @param obj
         * @returns {string|null} An error message or null
         * @class OneToManyProxy
         */
        validate: function (obj) {
            var str = Object.prototype.toString.call(obj);
            if (this.isForward) {
                if (str == '[object Array]') {
                    return 'Cannot assign array forward oneToMany (' + str + '): ' + this.forwardName;
                }
            }
            else {
                if (str != '[object Array]') {
                    return 'Cannot scalar to reverse oneToMany (' + str + '): ' + this.reverseName;
                }
            }
            return null;
        },
        set: function (obj, opts) {
            this.checkInstalled();
            var self = this;
            if (obj) {
                var errorMessage;
                if (errorMessage = this.validate(obj)) {
                    return errorMessage;
                }
                else {
                    this.clearReverseRelated(opts);
                    self.setIdAndRelated(obj, opts);
                    if (self.isReverse) {
                        this.wrapArray(self.related);
                    }
                    self.setIdAndRelatedReverse(obj, opts);
                }
            }
            else {
                this.clearReverseRelated(opts);
                self.setIdAndRelated(obj, opts);
            }
        },
        install: function (obj) {
            RelationshipProxy.prototype.install.call(this, obj);

            if (this.isReverse) {
                obj[('splice' + util.capitaliseFirstLetter(this.reverseName))] = _.bind(this.splice, this);
                this.wrapArray(this.related);
            }

        }
    });


    module.exports = OneToManyProxy;
})();
},{"../vendor/observe-js/src/observe":53,"./RelationshipProxy":10,"./events":16,"./modelEvents":22,"./util":24}],5:[function(require,module,exports){
(function () {
    var RelationshipProxy = require('./RelationshipProxy'),
        util = require('./util'),
        _ = util._,
        SiestaModel = require('./ModelInstance');

    /**
     * [OneToOneProxy description]
     * @param {Object} opts
     */
    function OneToOneProxy(opts) {
        RelationshipProxy.call(this, opts);
    }


    OneToOneProxy.prototype = Object.create(RelationshipProxy.prototype);

    _.extend(OneToOneProxy.prototype, {
        /**
         * Validate the object that we're setting
         * @param obj
         * @returns {string|null} An error message or null
         */
        validate: function (obj) {
            if (Object.prototype.toString.call(obj) == '[object Array]') {
                return 'Cannot assign array to one to one relationship';
            }
            else if ((!obj instanceof SiestaModel)) {

            }
            return null;
        },
        set: function (obj, opts) {
            this.checkInstalled();
            if (obj) {
                var errorMessage;
                if (errorMessage = this.validate(obj)) {
                    return errorMessage;
                }
                else {
                    this.clearReverseRelated(opts);
                    this.setIdAndRelated(obj, opts);
                    this.setIdAndRelatedReverse(obj, opts);
                }
            }
            else {
                this.clearReverseRelated(opts);
                this.setIdAndRelated(obj, opts);
            }
        },
        get: function (cb) {
            return util.promise(cb, function (cb) {
                cb(null, this.related);
            }.bind(this));
        }
    });


    module.exports = OneToOneProxy;
})();
},{"./ModelInstance":3,"./RelationshipProxy":10,"./util":24}],6:[function(require,module,exports){
var util = require('./util'),
  _ = util._;

/**
 * Acts as a placeholder for various objects e.g. lazy registration of models.
 * @param [opts]
 * @constructor
 */
function Placeholder(opts) {
  _.extend(this, opts || {});
  this.isPlaceholder = true;
}

module.exports = Placeholder;
},{"./util":24}],7:[function(require,module,exports){
(function() {
  var log = require('./log')('query'),
    cache = require('./cache'),
    util = require('./util'),
    error = require('./error'),
    ModelInstance = require('./ModelInstance'),
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
      var arr = opts.object[opts.field];
      if (util.isArray(arr) || util.isString(arr)) {
        return arr.indexOf(opts.value) > -1;
      }
    }
    return false;
  }

  var comparators = {
    e: function(opts) {
      var fieldValue = opts.object[opts.field];
      if (log.enabled) {
        log(opts.field + ': ' + valueAsString(fieldValue) + ' == ' + valueAsString(opts.value), {opts: opts});
      }
      return fieldValue == opts.value;
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

  _.extend(Query, {
    comparators: comparators,
    registerComparator: function(symbol, fn) {
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
        var fields = _.map(order, function(ordering) {
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
      return _.reduce(this.model.descendants, function(memo, childModel) {
        return _.extend(memo, cacheForModel(childModel));
      }, _.extend({}, cacheForModel(this.model)));
    },
    _executeInMemory: function(callback) {
      var _executeInMemory = function() {
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
    clearOrdering: function() {
      this.opts.order = null;
    },
    objectMatchesOrQuery: function(obj, orQuery) {
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
    objectMatchesAndQuery: function(obj, andQuery) {
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
      _.each(fields.slice(0, fields.length - 1), function(f) {
        if (util.isArray(obj)) {
          obj = _.pluck(obj, f);
        }
        else {
          obj = obj[f];
        }
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
    objectMatches: function(obj, unprocessedField, value, query) {
      if (unprocessedField == '$or') {
        var $or = query['$or'];
        if (!util.isArray($or)) {
          $or = Object.keys($or).map(function(k) {
            var normalised = {};
            normalised[k] = $or[k];
            return normalised;
          });
        }
        if (!this.objectMatchesOrQuery(obj, $or)) return false;
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
    objectMatchesBaseQuery: function(obj, query) {
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
    objectMatchesQuery: function(obj) {
      return this.objectMatchesBaseQuery(obj, this.query);
    }
  });

  module.exports = Query;
})();
},{"./ModelInstance":3,"./QuerySet":8,"./cache":12,"./error":15,"./log":19,"./util":24}],8:[function(require,module,exports){
var util = require('./util'),
    Promise = util.Promise,
    error = require('./error'),
    ModelInstance = require('./ModelInstance'),
    _ = require('./util')._;

/*
 TODO: Use ES6 Proxy instead.
 Eventually query sets should use ES6 Proxies which will be much more natural and robust. E.g. no need for the below
 */
var ARRAY_METHODS = ['push', 'sort', 'reverse', 'splice', 'shift', 'unshift'],
    NUMBER_METHODS = ['toString', 'toExponential', 'toFixed', 'toPrecision', 'valueOf'],
    NUMBER_PROPERTIES = ['MAX_VALUE', 'MIN_VALUE', 'NEGATIVE_INFINITY', 'NaN', 'POSITIVE_INFINITY'],
    STRING_METHODS = ['charAt', 'charCodeAt', 'concat', 'fromCharCode', 'indexOf', 'lastIndexOf', 'localeCompare',
        'match', 'replace', 'search', 'slice', 'split', 'substr', 'substring', 'toLocaleLowerCase', 'toLocaleUpperCase',
        'toLowerCase', 'toString', 'toUpperCase', 'trim', 'valueOf'],
    STRING_PROPERTIES = ['length'];

/**
 * Return the property names for a given object. Handles special cases such as strings and numbers that do not have
 * the getOwnPropertyNames function.
 * The special cases are very much hacks. This hack can be removed once the Proxy object is more widely adopted.
 * @param object
 * @returns {Array}
 */
function getPropertyNames(object) {
    var propertyNames;
    if (typeof object == 'string' || object instanceof String) {
        propertyNames = STRING_METHODS.concat(STRING_PROPERTIES);
    }
    else if (typeof object == 'number' || object instanceof Number) {
        propertyNames = NUMBER_METHODS.concat(NUMBER_PROPERTIES);
    }
    else {
        propertyNames = object.getOwnPropertyNames();
    }
    return propertyNames;
}

/**
 * Define a proxy property to attributes on objects in the array
 * @param arr
 * @param prop
 */
function defineAttribute(arr, prop) {
    if (!(prop in arr)) { // e.g. we cannot redefine .length
        Object.defineProperty(arr, prop, {
            get: function () {
                return querySet(_.pluck(arr, prop));
            },
            set: function (v) {
                if (util.isArray(v)) {
                    if (this.length != v.length) throw error({message: 'Must be same length'});
                    for (var i = 0; i < v.length; i++) {
                        this[i][prop] = v[i];
                    }
                }
                else {
                    for (i = 0; i < this.length; i++) {
                        this[i][prop] = v;
                    }
                }
            }
        });
    }
}

function isPromise(obj) {
    // TODO: Don't think this is very robust.
    return obj.then && obj.catch;
}

/**
 * Define a proxy method on the array if not already in existence.
 * @param arr
 * @param prop
 */
function defineMethod(arr, prop) {
    if (!(prop in arr)) { // e.g. we don't want to redefine toString
        arr[prop] = function () {
            var args = arguments,
                res = this.map(function (p) {
                    return p[prop].apply(p, args);
                });
            var arePromises = false;
            if (res.length) arePromises = isPromise(res[0]);
            return arePromises ? Promise.all(res) : querySet(res);
        };
    }
}

/**
 * Transform the array into a query set.
 * Renders the array immutable.
 * @param arr
 * @param model - The model with which to proxy to
 */
function modelQuerySet(arr, model) {
    arr = _.extend([], arr);
    var attributeNames = model._attributeNames,
        relationshipNames = model._relationshipNames,
        names = attributeNames.concat(relationshipNames).concat(instanceMethods);
    names.forEach(_.partial(defineAttribute, arr));
    var instanceMethods = Object.keys(ModelInstance.prototype);
    instanceMethods.forEach(_.partial(defineMethod, arr));
    return renderImmutable(arr);
}

/**
 * Transform the array into a query set, based on whatever is in it.
 * Note that all objects must be of the same type. This function will take the first object and decide how to proxy
 * based on that.
 * @param arr
 */
function querySet(arr) {
    if (arr.length) {
        var referenceObject = arr[0],
            propertyNames = getPropertyNames(referenceObject);
        propertyNames.forEach(function (prop) {
            if (typeof referenceObject[prop] == 'function') defineMethod(arr, prop, arguments);
            else defineAttribute(arr, prop);
        });
    }
    return renderImmutable(arr);
}

function throwImmutableError() {
    throw new Error('Cannot modify a query set');
}

/**
 * Render an array immutable by replacing any functions that can mutate it.
 * @param arr
 */
function renderImmutable(arr) {
    ARRAY_METHODS.forEach(function (p) {
        arr[p] = throwImmutableError;
    });
    arr.immutable = true;
    arr.mutableCopy = arr.asArray = function () {
        var mutableArr = _.map(this, function (x) {return x});
        mutableArr.asQuerySet = function () {
            return querySet(this);
        };
        mutableArr.asModelQuerySet = function (model) {
            return modelQuerySet(this, model);
        };
        return mutableArr;
    };
    return arr;
}

module.exports = modelQuerySet;
},{"./ModelInstance":3,"./error":15,"./util":24}],9:[function(require,module,exports){
/**
 * For those familiar with Apple's Cocoa library, reactive queries roughly map onto NSFetchedResultsController.
 *
 * They present a query set that 'reacts' to changes in the underlying data.
 * @module reactiveQuery
 */


(function() {

  var log = require('./log')('query:reactive'),
    Query = require('./Query'),
    EventEmitter = require('events').EventEmitter,
    events = require('./events'),
    Chain = require('./Chain'),
    modelEvents = require('./modelEvents'),
    InternalSiestaError = require('./error').InternalSiestaError,
    constructQuerySet = require('./QuerySet'),
    util = require('./util'),
    _ = util._;

  /**
   *
   * @param {Query} query - The underlying query
   * @constructor
   */
  function ReactiveQuery(query) {
    var self = this;
    EventEmitter.call(this);
    Chain.call(this);
    _.extend(this, {
      insertionPolicy: ReactiveQuery.InsertionPolicy.Back,
      initialised: false
    });

    Object.defineProperty(this, 'query', {
      get: function() {
        return this._query
      },
      set: function(v) {
        if (v) {
          this._query = v;
          this.results = constructQuerySet([], v.model);
        }
        else {
          this._query = null;
          this.results = null;
        }
      },
      configurable: false,
      enumerable: true
    });

    if (query) {
      _.extend(this, {
        _query: query,
        results: constructQuerySet([], query.model)
      })
    }

    Object.defineProperties(this, {
      initialized: {
        get: function() {
          return this.initialised
        }
      },
      model: {
        get: function() {
          var query = self._query;
          if (query) {
            return query.model
          }
        }
      },
      collection: {
        get: function() {
          return self.model.collectionName
        }
      }
    });


  }

  ReactiveQuery.prototype = Object.create(EventEmitter.prototype);
  _.extend(ReactiveQuery.prototype, Chain.prototype);

  _.extend(ReactiveQuery, {
    InsertionPolicy: {
      Front: 'Front',
      Back: 'Back'
    }
  });

  _.extend(ReactiveQuery.prototype, {
    /**
     *
     * @param cb
     * @param {bool} _ignoreInit - execute query again, initialised or not.
     * @returns {*}
     */
    init: function(cb, _ignoreInit) {
      if (this._query) {
        if (log) log('init');
        return util.promise(cb, function(cb) {
          if ((!this.initialised) || _ignoreInit) {
            this._query.execute(function(err, results) {
              if (!err) {
                cb(null, this._applyResults(results));
              }
              else {
                cb(err);
              }
            }.bind(this));
          }
          else {
            cb(null, this.results);
          }
        }.bind(this));
      }
      else throw new InternalSiestaError('No _query defined');
    },
    _applyResults: function(results) {
      this.results = results;
      if (!this.handler) {
        var name = this._constructNotificationName();
        var handler = function(n) {
          this._handleNotif(n);
        }.bind(this);
        this.handler = handler;
        events.on(name, handler);
      }
      log('Listening to ' + name);
      this.initialised = true;
      return this.results;
    },
    insert: function(newObj) {
      var results = this.results.mutableCopy();
      if (this.insertionPolicy == ReactiveQuery.InsertionPolicy.Back) var idx = results.push(newObj);
      else idx = results.unshift(newObj);
      this.results = results.asModelQuerySet(this.model);
      return idx;
    },
    /**
     * Execute the underlying query again.
     * @param cb
     */
    update: function(cb) {
      return this.init(cb, true)
    },
    _handleNotif: function(n) {
      log('_handleNotif', n);
      if (n.type == modelEvents.ModelEventType.New) {
        var newObj = n.new;
        if (this._query.objectMatchesQuery(newObj)) {
          log('New object matches', newObj);
          var idx = this.insert(newObj);
          this.emit(modelEvents.ModelEventType.Splice, {
            index: idx,
            added: [newObj],
            type: modelEvents.ModelEventType.Splice,
            obj: this
          });
        }
        else {
          log('New object does not match', newObj);
        }
      }
      else if (n.type == modelEvents.ModelEventType.Set) {
        newObj = n.obj;
        var index = this.results.indexOf(newObj),
          alreadyContains = index > -1,
          matches = this._query.objectMatchesQuery(newObj);
        if (matches && !alreadyContains) {
          log('Updated object now matches!', newObj);
          idx = this.insert(newObj);
          this.emit(modelEvents.ModelEventType.Splice, {
            index: idx,
            added: [newObj],
            type: modelEvents.ModelEventType.Splice,
            obj: this
          });
        }
        else if (!matches && alreadyContains) {
          log('Updated object no longer matches!', newObj);
          results = this.results.mutableCopy();
          var removed = results.splice(index, 1);
          this.results = results.asModelQuerySet(this.model);
          this.emit(modelEvents.ModelEventType.Splice, {
            index: index,
            obj: this,
            new: newObj,
            type: modelEvents.ModelEventType.Splice,
            removed: removed
          });
        }
        else if (!matches && !alreadyContains) {
          log('Does not contain, but doesnt match so not inserting', newObj);
        }
        else if (matches && alreadyContains) {
          log('Matches but already contains', newObj);
          // Send the notification over.
          this.emit(n.type, n);
        }
      }
      else if (n.type == modelEvents.ModelEventType.Remove) {
        newObj = n.obj;
        var results = this.results.mutableCopy();
        index = results.indexOf(newObj);
        if (index > -1) {
          log('Removing object', newObj);
          removed = results.splice(index, 1);
          this.results = constructQuerySet(results, this.model);
          this.emit(modelEvents.ModelEventType.Splice, {
            index: index,
            obj: this,
            type: modelEvents.ModelEventType.Splice,
            removed: removed
          });
        }
        else {
          log('No modelEvents neccessary.', newObj);
        }
      }
      else {
        throw new InternalSiestaError('Unknown change type "' + n.type.toString() + '"')
      }
      this.results = constructQuerySet(this._query._sortResults(this.results), this.model);
    },
    _constructNotificationName: function() {
      return this.model.collectionName + ':' + this.model.name;
    },
    terminate: function() {
      if (this.handler) {
        events.removeListener(this._constructNotificationName(), this.handler);
      }
      this.results = null;
      this.handler = null;
    },
    _registerEventHandler: function(on, name, fn) {
      var removeListener = EventEmitter.prototype.removeListener;
      if (name.trim() == '*') {
        Object.keys(modelEvents.ModelEventType).forEach(function(k) {
          on.call(this, modelEvents.ModelEventType[k], fn);
        }.bind(this));
      }
      else {
        on.call(this, name, fn);
      }
      return this._link({
          on: this.on.bind(this),
          once: this.once.bind(this),
          update: this.update.bind(this),
          insert: this.insert.bind(this)
        },
        function() {
          if (name.trim() == '*') {
            Object.keys(modelEvents.ModelEventType).forEach(function(k) {
              removeListener.call(this, modelEvents.ModelEventType[k], fn);
            }.bind(this));
          }
          else {
            removeListener.call(this, name, fn);
          }
        })
    },
    on: function(name, fn) {
      return this._registerEventHandler(EventEmitter.prototype.on, name, fn);
    },
    once: function(name, fn) {
      return this._registerEventHandler(EventEmitter.prototype.once, name, fn);
    }
  });


  module.exports = ReactiveQuery;
})();
},{"./Chain":1,"./Query":7,"./QuerySet":8,"./error":15,"./events":16,"./log":19,"./modelEvents":22,"./util":24,"events":29}],10:[function(require,module,exports){
/**
 * Base functionality for relationships.
 * @module relationships
 */
(function() {

  var InternalSiestaError = require('./error').InternalSiestaError,
    util = require('./util'),
    _ = util._,
    Query = require('./Query'),
    log = require('./log'),
    cache = require('./cache'),
    events = require('./events'),
    wrapArrayForAttributes = events.wrapArray,
    ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver,
    modelEvents = require('./modelEvents'),
    ModelEventType = modelEvents.ModelEventType;

  /**
   * @class  [RelationshipProxy description]
   * @param {Object} opts
   * @constructor
   */
  function RelationshipProxy(opts) {
    var self = this;
    opts = opts || {};

    _.extend(this, {
      object: null,
      related: null
    });

    Object.defineProperties(this, {
      isForward: {
        get: function() {
          return !self.isReverse;
        },
        set: function(v) {
          self.isReverse = !v;
        },
        enumerable: true
      }
    });

    util.extendFromOpts(this, opts, {
      reverseModel: null,
      forwardModel: null,
      forwardName: null,
      reverseName: null,
      isReverse: null,
      serialise: null
    }, false);

    this.cancelListens = {};
  }

  _.extend(RelationshipProxy, {});

  _.extend(RelationshipProxy.prototype, {
    /**
     * Install this proxy on the given instance
     * @param {ModelInstance} modelInstance
     */
    install: function(modelInstance) {
      if (modelInstance) {
        if (!this.object) {
          this.object = modelInstance;
          var self = this;
          var name = this.getForwardName();
          Object.defineProperty(modelInstance, name, {
            get: function() {
              return self.related;
            },
            set: function(v) {
              self.set(v);
            },
            configurable: true,
            enumerable: true
          });
          if (!modelInstance.__proxies) modelInstance.__proxies = {};
          modelInstance.__proxies[name] = this;
          if (!modelInstance._proxies) {
            modelInstance._proxies = [];
          }
          modelInstance._proxies.push(this);
        } else {
          throw new InternalSiestaError('Already installed.');
        }
      } else {
        throw new InternalSiestaError('No object passed to relationship install');
      }
    }

  });

  //noinspection JSUnusedLocalSymbols
  _.extend(RelationshipProxy.prototype, {
    set: function(obj, opts) {
      throw new InternalSiestaError('Must subclass RelationshipProxy');
    },
    get: function(callback) {
      throw new InternalSiestaError('Must subclass RelationshipProxy');
    }
  });

  _.extend(RelationshipProxy.prototype, {
    proxyForInstance: function(modelInstance, reverse) {
      var name = reverse ? this.getReverseName() : this.getForwardName(),
        model = reverse ? this.reverseModel : this.forwardModel;
      var ret;
      // This should never happen. Should g   et caught in the mapping operation?
      if (util.isArray(modelInstance)) {
        ret = _.map(modelInstance, function(o) {
          return o.__proxies[name];
        });
      } else {
        var proxy = modelInstance.__proxies[name];
        if (!proxy) {
          var err = 'No proxy with name "' + name + '" on mapping ' + model.name;
          throw new InternalSiestaError(err);
        }
        ret = proxy;
      }
      return ret;
    },
    reverseProxyForInstance: function(modelInstance) {
      return this.proxyForInstance(modelInstance, true);
    },
    getReverseName: function() {
      return this.isForward ? this.reverseName : this.forwardName;
    },
    getForwardName: function() {
      return this.isForward ? this.forwardName : this.reverseName;
    },
    getForwardModel: function() {
      return this.isForward ? this.forwardModel : this.reverseModel;
    },
    clearRemovalListener: function(obj) {
      var localId = obj.localId;
      var cancelListen = this.cancelListens[localId];
      // TODO: Remove this check. cancelListen should always exist
      if (cancelListen) {
        cancelListen();
        this.cancelListens[localId] = null;
      }
    },
    listenForRemoval: function(obj) {
      this.cancelListens[obj.localId] = obj.on('*', function(e) {
        if (e.type == ModelEventType.Remove) {
          if (util.isArray(this.related)) {
            var idx = this.related.indexOf(obj);
            this.splice(idx, 1);
          }
          else {
            this.setIdAndRelated(null);
          }
          this.clearRemovalListener(obj);
        }
      }.bind(this));
    },
    /**
     * Configure _id and related with the new related object.
     * @param obj
     * @param {object} [opts]
     * @param {boolean} [opts.disableNotifications]
     * @returns {String|undefined} - Error message or undefined
     */
    setIdAndRelated: function(obj, opts) {
      opts = opts || {};
      if (!opts.disableevents) var oldValue = this._getOldValueForSetChangeEvent();
      var previouslyRelated = this.related;
      if (previouslyRelated) this.clearRemovalListener(previouslyRelated);
      if (obj) {
        if (util.isArray(obj)) {
          this.related = obj;
          obj.forEach(function(_obj) {
            this.listenForRemoval(_obj);
          }.bind(this));
        } else {
          this.related = obj;
          this.listenForRemoval(obj);
        }
      }
      else {
        this.related = null;
      }
      if (!opts.disableevents) this.registerSetChange(obj, oldValue);
    },
    checkInstalled: function() {
      if (!this.object) {
        throw new InternalSiestaError('Proxy must be installed on an object before can use it.');
      }
    },
    splicer: function(opts) {
      opts = opts || {};
      return function(idx, numRemove) {
        opts = opts || {};
        if (!opts.disableevents) {
          var added = this._getAddedForSpliceChangeEvent(arguments),
            removed = this._getRemovedForSpliceChangeEvent(idx, numRemove);
        }
        var add = Array.prototype.slice.call(arguments, 2);
        var res = _.partial(this.related.splice, idx, numRemove).apply(this.related, add);
        if (!opts.disableevents) this.registerSpliceChange(idx, added, removed);
        return res;
      }.bind(this);
    },
    clearReverseRelated: function(opts) {
      opts = opts || {};
      var self = this;
      if (this.related) {
        var reverseProxy = this.reverseProxyForInstance(this.related);
        var reverseProxies = util.isArray(reverseProxy) ? reverseProxy : [reverseProxy];
        _.each(reverseProxies, function(p) {
          if (util.isArray(p.related)) {
            var idx = p.related.indexOf(self.object);
            p.makeChangesToRelatedWithoutObservations(function() {
              p.splicer(opts)(idx, 1);
            });
          } else {
            p.setIdAndRelated(null, opts);
          }
        });
      }
    },
    setIdAndRelatedReverse: function(obj, opts) {
      var self = this;
      var reverseProxy = this.reverseProxyForInstance(obj);
      var reverseProxies = util.isArray(reverseProxy) ? reverseProxy : [reverseProxy];
      _.each(reverseProxies, function(p) {
        if (util.isArray(p.related)) {
          p.makeChangesToRelatedWithoutObservations(function() {
            p.splicer(opts)(p.related.length, 0, self.object);
          });
        } else {
          p.clearReverseRelated(opts);
          p.setIdAndRelated(self.object, opts);
        }
      });
    },
    makeChangesToRelatedWithoutObservations: function(f) {
      if (this.related) {
        this.related.arrayObserver.close();
        this.related.arrayObserver = null;
        f();
        this.wrapArray(this.related);
      } else {
        f();
      }
    },
    /**
     * Get old value that is sent out in emissions.
     * @returns {*}
     * @private
     */
    _getOldValueForSetChangeEvent: function() {
      var oldValue = this.related;
      if (util.isArray(oldValue) && !oldValue.length) {
        oldValue = null;
      }
      return oldValue;
    },
    registerSetChange: function(newValue, oldValue) {
      var proxyObject = this.object;
      if (!proxyObject) throw new InternalSiestaError('Proxy must have an object associated');
      var model = proxyObject.model.name;
      var collectionName = proxyObject.collectionName;
      // We take [] == null == undefined in the case of relationships.
      modelEvents.emit({
        collection: collectionName,
        model: model,
        localId: proxyObject.localId,
        field: this.getForwardName(),
        old: oldValue,
        new: newValue,
        type: ModelEventType.Set,
        obj: proxyObject
      });
    },

    _getRemovedForSpliceChangeEvent: function(idx, numRemove) {
      var removed = this.related ? this.related.slice(idx, idx + numRemove) : null;
      return removed;
    },

    _getAddedForSpliceChangeEvent: function(args) {
      var add = Array.prototype.slice.call(args, 2),
        added = add.length ? add : [];
      return added;
    },

    registerSpliceChange: function(idx, added, removed) {
      var model = this.object.model.name,
        coll = this.object.collectionName;
      modelEvents.emit({
        collection: coll,
        model: model,
        localId: this.object.localId,
        field: this.getForwardName(),
        index: idx,
        removed: removed,
        added: added,
        type: ModelEventType.Splice,
        obj: this.object
      });
    },
    wrapArray: function(arr) {
      var self = this;
      wrapArrayForAttributes(arr, this.reverseName, this.object);
      if (!arr.arrayObserver) {
        arr.arrayObserver = new ArrayObserver(arr);
        var observerFunction = function(splices) {
          splices.forEach(function(splice) {
            var added = splice.addedCount ? arr.slice(splice.index, splice.index + splice.addedCount) : [];
            var model = self.getForwardModel();
            modelEvents.emit({
              collection: model.collectionName,
              model: model.name,
              localId: self.object.localId,
              field: self.getForwardName(),
              removed: splice.removed,
              added: added,
              type: ModelEventType.Splice,
              obj: self.object
            });
          });
        };
        arr.arrayObserver.open(observerFunction);
      }
    },
    splice: function() {
      this.splicer({}).apply(this, arguments);
    }

  });


  module.exports = RelationshipProxy;


})();
},{"../vendor/observe-js/src/observe":53,"./Query":7,"./cache":12,"./error":15,"./events":16,"./log":19,"./modelEvents":22,"./util":24}],11:[function(require,module,exports){
(function () {
    module.exports = {
        OneToMany: 'OneToMany',
        OneToOne: 'OneToOne',
        ManyToMany: 'ManyToMany'
    };
})();
},{}],12:[function(require,module,exports){
/**
 * This is an in-memory cache for models. Models are cached by local id (_id) and remote id (defined by the mapping).
 * Lookups are performed against the cache when mapping.
 * @module cache
 */
(function() {

  var log = require('./log')('cache'),
    InternalSiestaError = require('./error').InternalSiestaError,
    util = require('./util');


  var localCacheById = {},
    localCache = {},
    remoteCache = {};

  /**
   * Clear out the cache.
   */
  function reset() {
    remoteCache = {};
    localCacheById = {};
    localCache = {};
  }

  /**
   * Return the object in the cache given a local id (_id)
   * @param  {String|Array} localId
   * @return {ModelInstance}
   */
  function getViaLocalId(localId) {
    if (util.isArray(localId)) return _.map(localId, function (x) {return localCacheById[x]});
    else return localCacheById[localId];
  }

  /**
   * Return the singleton object given a singleton model.
   * @param  {Model} model
   * @return {ModelInstance}
   */
  function getSingleton(model) {
    var modelName = model.name;
    var collectionName = model.collectionName;
    var collectionCache = localCache[collectionName];
    if (collectionCache) {
      var typeCache = collectionCache[modelName];
      if (typeCache) {
        var objs = [];
        for (var prop in typeCache) {
          if (typeCache.hasOwnProperty(prop)) {
            objs.push(typeCache[prop]);
          }
        }
        if (objs.length > 1) {
          var errStr = 'A singleton model has more than 1 object in the cache! This is a serious error. ' +
            'Either a model has been modified after objects have already been created, or something has gone' +
            'very wrong. Please file a bug report if the latter.';
          throw new InternalSiestaError(errStr);
        } else if (objs.length) {
          return objs[0];
        }
      }
    }
    return null;
  }

  /**
   * Given a remote identifier and an options object that describes mapping/collection,
   * return the model if cached.
   * @param  {String|Array} remoteId
   * @param  {Object} opts
   * @param  {Object} opts.model
   * @return {ModelInstance}
   */
  function getViaRemoteId(remoteId, opts) {
    var cache = (remoteCache[opts.model.collectionName] || {})[opts.model.name] || {};
    return util.isArray(remoteId) ? _.map(remoteId, function(x) {return cache[x]}) : cache[remoteId];
  }

  /**
   * Insert an object into the cache using a remote identifier defined by the mapping.
   * @param  {ModelInstance} obj
   * @param  {String} remoteId
   * @param  {String} previousRemoteId If remote id has been changed, this is the old remote identifier
   */
  function remoteInsert(obj, remoteId, previousRemoteId) {
    if (obj) {
      var collectionName = obj.model.collectionName;
      if (collectionName) {
        if (!remoteCache[collectionName]) {
          remoteCache[collectionName] = {};
        }
        var type = obj.model.name;
        if (type) {
          if (!remoteCache[collectionName][type]) {
            remoteCache[collectionName][type] = {};
          }
          if (previousRemoteId) {
            remoteCache[collectionName][type][previousRemoteId] = null;
          }
          var cachedObject = remoteCache[collectionName][type][remoteId];
          if (!cachedObject) {
            remoteCache[collectionName][type][remoteId] = obj;
            log('Remote cache insert: ' + obj._dump(true));
          } else {
            // Something has gone really wrong. Only one object for a particular collection/type/remoteid combo
            // should ever exist.
            if (obj != cachedObject) {
              var message = 'Object ' + collectionName.toString() + ':' + type.toString() + '[' + obj.model.id + '="' + remoteId + '"] already exists in the cache.' +
                ' This is a serious error, please file a bug report if you are experiencing this out in the wild';
              log(message, {
                obj: obj,
                cachedObject: cachedObject
              });
              throw new InternalSiestaError(message);
            } else {
              log('Object has already been inserted: ' + obj._dump(true));
            }

          }
        } else {
          throw new InternalSiestaError('Model has no type', {
            model: obj.model,
            obj: obj
          });
        }
      } else {
        throw new InternalSiestaError('Model has no collection', {
          model: obj.model,
          obj: obj
        });
      }
    } else {
      var msg = 'Must pass an object when inserting to cache';
      log(msg);
      throw new InternalSiestaError(msg);
    }
  }


  function _remoteCache() {
    return remoteCache
  }

  function _localCache() {
    return localCacheById;
  }

  /**
   * Query the cache
   * @param  {Object} opts Object describing the query
   * @return {ModelInstance}
   * @example
   * ```js
   * cache.get({_id: '5'}); // Query by local id
   * cache.get({remoteId: '5', mapping: myMapping}); // Query by remote id
   * ```
   */
  function get(opts) {
    log('get', opts);
    var obj, idField, remoteId;
    var localId = opts.localId;
    if (localId) {
      obj = getViaLocalId(localId);
      if (obj) {
        return obj;
      } else {
        if (opts.model) {
          idField = opts.model.id;
          remoteId = opts[idField];
          log(idField + '=' + remoteId);
          return getViaRemoteId(remoteId, opts);
        } else {
          return null;
        }
      }
    } else if (opts.model) {
      idField = opts.model.id;
      remoteId = opts[idField];
      if (remoteId) {
        return getViaRemoteId(remoteId, opts);
      } else if (opts.model.singleton) {
        return getSingleton(opts.model);
      }
    } else {
      log('Invalid opts to cache', {
        opts: opts
      });
    }
    return null;
  }

  /**
   * Insert an object into the cache.
   * @param  {ModelInstance} obj
   * @throws {InternalSiestaError} An object with _id/remoteId already exists. Not thrown if same obhect.
   */
  function insert(obj) {
    var localId = obj.localId;
    if (localId) {
      var collectionName = obj.model.collectionName;
      var modelName = obj.model.name;
      if (!localCacheById[localId]) {
        localCacheById[localId] = obj;
        if (!localCache[collectionName]) localCache[collectionName] = {};
        if (!localCache[collectionName][modelName]) localCache[collectionName][modelName] = {};
        localCache[collectionName][modelName][localId] = obj;
      } else {
        // Something has gone badly wrong here. Two objects should never exist with the same _id
        if (localCacheById[localId] != obj) {
          var message = 'Object with localId="' + localId.toString() + '" is already in the cache. ' +
            'This is a serious error. Please file a bug report if you are experiencing this out in the wild';
          log(message);
          throw new InternalSiestaError(message);
        }
      }
    }
    var idField = obj.idField;
    var remoteId = obj[idField];
    if (remoteId) {
      remoteInsert(obj, remoteId);
    } else {
      log('No remote id ("' + idField + '") so wont be placing in the remote cache', obj);
    }
  }

  /**
   * Returns true if object is in the cache
   * @param  {ModelInstance} obj
   * @return {boolean}
   */
  function contains(obj) {
    var q = {
      localId: obj.localId
    };
    var model = obj.model;
    if (model.id) {
      if (obj[model.id]) {
        q.model = model;
        q[model.id] = obj[model.id];
      }
    }
    return !!get(q);
  }

  /**
   * Removes the object from the cache (if it's actually in the cache) otherwises throws an error.
   * @param  {ModelInstance} obj
   * @throws {InternalSiestaError} If object already in the cache.
   */
  function remove(obj) {
    if (contains(obj)) {
      var collectionName = obj.model.collectionName;
      var modelName = obj.model.name;
      var localId = obj.localId;
      if (!modelName) throw InternalSiestaError('No mapping name');
      if (!collectionName) throw InternalSiestaError('No collection name');
      if (!localId) throw InternalSiestaError('No localId');
      delete localCache[collectionName][modelName][localId];
      delete localCacheById[localId];
      if (obj.model.id) {
        var remoteId = obj[obj.model.id];
        if (remoteId) {
          delete remoteCache[collectionName][modelName][remoteId];
        }
      }
    }
  }


  exports._remoteCache = _remoteCache;
  exports._localCache = _localCache;
  Object.defineProperty(exports, '_localCacheByType', {
    get: function() {
      return localCache;
    }
  });
  exports.get = get;
  exports.insert = insert;
  exports.remoteInsert = remoteInsert;
  exports.reset = reset;
  exports.contains = contains;
  exports.remove = remove;
  exports.getSingleton = getSingleton;
  exports.getViaLocalId = getViaLocalId;
  exports.getViaRemoteId = getViaRemoteId;
  exports.count = function() {
    return Object.keys(localCacheById).length;
  }
})();
},{"./error":15,"./log":19,"./util":24}],13:[function(require,module,exports){
/**
 * @module collection
 */
(function() {
  var log = require('./log')('collection'),
    CollectionRegistry = require('./collectionRegistry').CollectionRegistry,
    InternalSiestaError = require('./error').InternalSiestaError,
    Model = require('./model'),
    extend = require('extend'),
    observe = require('../vendor/observe-js/src/observe').Platform,
    events = require('./events'),
    util = require('./util'),
    _ = util._,
    error = require('./error'),
    cache = require('./cache');


  /**
   * A collection describes a set of models and optionally a REST API which we would
   * like to model.
   *
   * @param name
   * @param opts
   * @constructor
   *
   *
   * @example
   * ```js
   * var GitHub = new siesta('GitHub')
   * // ... configure mappings, descriptors etc ...
   * GitHub.install(function () {
     *     // ... carry on.
     * });
   * ```
   */
  function Collection(name, opts) {
    var self = this;
    if (!name) throw new Error('Collection must have a name');

    opts = opts || {};
    util.extendFromOpts(this, opts, {});

    _.extend(this, {
      name: name,
      _rawModels: {},
      _models: {},
      _opts: opts,
      installed: false
    });

    Object.defineProperties(this, {
      dirty: {
        get: function() {
          if (siesta.ext.storageEnabled) {
            var unsavedObjectsByCollection = siesta.ext.storage._unsavedObjectsByCollection,
              hash = unsavedObjectsByCollection[self.name] || {};
            return !!Object.keys(hash).length;
          }
          else return undefined;
        },
        enumerable: true
      }
    });

    CollectionRegistry.register(this);
    this._makeAvailableOnRoot();
    events.ProxyEventEmitter.call(this, this.name);
  }

  Collection.prototype = Object.create(events.ProxyEventEmitter.prototype);

  _.extend(Collection.prototype, {
    _getModelsToInstall: function() {
      var modelsToInstall = [];
      for (var name in this._models) {
        if (this._models.hasOwnProperty(name)) {
          var model = this._models[name];
          modelsToInstall.push(model);
        }
      }
      log('There are ' + modelsToInstall.length.toString() + ' mappings to install');
      return modelsToInstall;
    },
    /**
     * Means that we can access the collection on the siesta object.
     * @private
     */
    _makeAvailableOnRoot: function() {
      var index = require('./index');
      index[this.name] = this;
    },
    /**
     * Ensure mappings are installed.
     * @param [cb]
     * @class Collection
     */
    install: function(cb) {
      var modelsToInstall = this._getModelsToInstall();
      return util.promise(cb, function(cb) {
        if (!this.installed) {
          this.installed = true;
          var errors = [];
          _.each(modelsToInstall, function(m) {
            log('Installing relationships for mapping with name "' + m.name + '"');
            var err = m.installRelationships();
            if (err) errors.push(err);
          });
          if (!errors.length) {
            _.each(modelsToInstall, function(m) {
              log('Installing reverse relationships for mapping with name "' + m.name + '"');
              var err = m.installReverseRelationships();
              if (err) errors.push(err);
            });
            if (!errors.length) {
              this.installed = true;
              this._makeAvailableOnRoot();
            }
          }
          cb(errors.length ? error('Errors were encountered whilst setting up the collection', {errors: errors}) : null);
        } else throw new InternalSiestaError('Collection "' + this.name + '" has already been installed');
      }.bind(this));
    },
    /**
     * Given the name of a mapping and an options object describing the mapping, creating a Model
     * object, install it and return it.
     * @param  {String} name
     * @param  {Object} opts
     * @return {Model}
     * @class Collection
     */
    _model: function(name, opts) {
      if (name) {
        this._rawModels[name] = opts;
        opts = extend(true, {}, opts);
        opts.name = name;
        opts.collection = this;
        var model = new Model(opts);
        this._models[name] = model;
        this[name] = model;
        return model;
      } else {
        throw new Error('No name specified when creating mapping');
      }
    },

    /**
     * Registers a model with this collection.
     * @param op
     */
    model: function(op) {
      if (arguments.length) {
        if (arguments.length == 1) {
          if (util.isArray(arguments[0])) {
            return _.map(arguments[0], function(m) {
              return this._model(m.name, m);
            }.bind(this));
          } else {
            var name, opts;
            if (util.isString(arguments[0])) {
              name = arguments[0];
              opts = {};
            }
            else {
              opts = arguments[0];
              name = opts.name;
            }
            return this._model(name, opts);
          }
        } else {
          if (typeof arguments[0] == 'string') {
            return this._model(arguments[0], arguments[1]);
          } else {
            return _.map(arguments, function(m) {
              return this._model(m.name, m);
            }.bind(this));
          }
        }
      }
      if (this.installed) {

      }
      return null;
    },

    /**
     * Dump this collection as JSON
     * @param  {Boolean} asJson Whether or not to apply JSON.stringify
     * @return {String|Object}
     * @class Collection
     */
    _dump: function(asJson) {
      var obj = {};
      obj.installed = this.installed;
      obj.docId = this._docId;
      obj.name = this.name;
      return asJson ? util.prettyPrint(obj) : obj;
    },

    /**
     * Returns the number of objects in this collection.
     *
     * @param cb
     * @returns {Promise}
     */
    count: function(cb) {
      return util.promise(cb, function(cb) {
        var tasks = _.map(this._models, function(m) {
          return _.bind(m.count, m);
        });
        util.async.parallel(tasks, function(err, ns) {
          var n;
          if (!err) {
            n = _.reduce(ns, function(m, r) {
              return m + r
            }, 0);
          }
          cb(err, n);
        });
      }.bind(this));
    },

    graph: function(data, opts, cb) {
      if (typeof opts == 'function') cb = opts;
      opts = opts || {};
      return util.promise(cb, function(cb) {
        var tasks = [], err;
        for (var modelName in data) {
          if (data.hasOwnProperty(modelName)) {
            var model = this._models[modelName];
            if (model) {
              (function(model, data) {
                tasks.push(function(done) {
                  model.graph(data, function(err, models) {
                    if (!err) {
                      var results = {};
                      results[model.name] = models;
                    }
                    done(err, results);
                  });
                });
              })(model, data[modelName]);
            }
            else {
              err = 'No such model "' + modelName + '"';
            }
          }
        }
        if (!err) util.async.series(tasks, function(err, results) {
          if (!err) {
            results = results.reduce(function(memo, res) {
              return _.extend(memo, res);
            }, {})
          } else results = null;
          cb(err, results);
        });
        else cb(error(err, {data: data, invalidModelName: modelName}));
      }.bind(this));
    },

    removeAll: function(cb) {
      return util.promise(cb, function(cb) {
        util.Promise.all(
          Object.keys(this._models).map(function(modelName) {
            var model = this._models[modelName];
            return model.removeAll();
          }.bind(this))
        ).then(function() {
            cb(null);
          })
          .catch(cb)
      }.bind(this));
    }
  });


  module.exports = Collection;
})();
},{"../vendor/observe-js/src/observe":53,"./cache":12,"./collectionRegistry":14,"./error":15,"./events":16,"./index":17,"./log":19,"./model":21,"./util":24,"extend":33}],14:[function(require,module,exports){
/**
 * @module collection
 */
(function () {
    var _ = require('./util')._;

    function CollectionRegistry() {
        if (!this) return new CollectionRegistry();
        this.collectionNames = [];
    }

    _.extend(CollectionRegistry.prototype, {
        register: function (collection) {
            var name = collection.name;
            this[name] = collection;
            this.collectionNames.push(name);
        },
        reset: function () {
            var self = this;
            _.each(this.collectionNames, function (name) {
                delete self[name];
            });
            this.collectionNames = [];
        }
    });

    exports.CollectionRegistry = new CollectionRegistry();
})();
},{"./util":24}],15:[function(require,module,exports){
/**
 * @module error
 */
(function() {

  /**
   * Users should never see these thrown. A bug report should be filed if so as it means some assertion has failed.
   * @param message
   * @param context
   * @param ssf
   * @constructor
   */
  function InternalSiestaError(message, context, ssf) {
    this.message = message;
    this.context = context;
    // capture stack trace
    if (ssf && Error.captureStackTrace) {
      Error.captureStackTrace(this, ssf);
    }
  }

  InternalSiestaError.prototype = Object.create(Error.prototype);
  InternalSiestaError.prototype.name = 'InternalSiestaError';
  InternalSiestaError.prototype.constructor = InternalSiestaError;

  function isSiestaError(err) {
    if (typeof err == 'object') {
      return 'error' in err && 'ok' in err && 'reason' in err;
    }
    return false;
  }

  module.exports = function(errMessage, extra) {
    if (isSiestaError(errMessage)) {
      return errMessage;
    }
    var err = {
      reason: errMessage,
      error: true,
      ok: false
    };
    for (var prop in extra || {}) {
      if (extra.hasOwnProperty(prop)) err[prop] = extra[prop];
    }
    err.toString = function() {
      return JSON.stringify(this);
    };
    return err;
  };

  module.exports.InternalSiestaError = InternalSiestaError;

})();
},{}],16:[function(require,module,exports){
(function() {
  var EventEmitter = require('events').EventEmitter,
    ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver,
    util = require('./util'),
    argsarray = require('argsarray'),
    _ = util._,
    modelEvents = require('./modelEvents'),
    Chain = require('./Chain');

  var eventEmitter = new EventEmitter();
  eventEmitter.setMaxListeners(100);

  /**
   * Listen to a particular event from the Siesta global EventEmitter.
   * Manages its own set of listeners.
   * @constructor
   */
  function ProxyEventEmitter(event, chainOpts) {
    _.extend(this, {
      event: event,
      listeners: {}
    });
    var defaultChainOpts = {};

    defaultChainOpts.on = this.on.bind(this);
    defaultChainOpts.once = this.once.bind(this);

    Chain.call(this, _.extend(defaultChainOpts, chainOpts || {}));
  }

  ProxyEventEmitter.prototype = Object.create(Chain.prototype);

  _.extend(ProxyEventEmitter.prototype, {
    on: function(type, fn) {
      if (typeof type == 'function') {
        fn = type;
        type = null;
      }
      else {
        if (type.trim() == '*') type = null;
        var _fn = fn;
        fn = function(e) {
          e = e || {};
          if (type) {
            if (e.type == type) {
              _fn(e);
            }
          }
          else {
            _fn(e);
          }
        };
        var listeners = this.listeners;
        if (type) {
          if (!listeners[type]) listeners[type] = [];
          listeners[type].push(fn);
        }
      }
      eventEmitter.on(this.event, fn);
      return this._handlerLink({
        fn: fn,
        type: type,
        extend: this.proxyChainOpts
      });
    },
    once: function(type, fn) {
      var event = this.event;
      if (typeof type == 'function') {
        fn = type;
        type = null;
      }
      else {
        if (type.trim() == '*') type = null;
        var _fn = fn;
        fn = function(e) {
          e = e || {};
          if (type) {
            if (e.type == type) {
              eventEmitter.removeListener(event, fn);
              _fn(e);
            }
          }
          else {
            _fn(e);
          }
        }
      }
      if (type) return eventEmitter.on(event, fn);
      else return eventEmitter.once(event, fn);
    },
    _removeListener: function(fn, type) {
      if (type) {
        var listeners = this.listeners[type],
          idx = listeners.indexOf(fn);
        listeners.splice(idx, 1);
      }
      return eventEmitter.removeListener(this.event, fn);
    },
    emit: function(type, payload) {
      if (typeof type == 'object') {
        payload = type;
        type = null;
      }
      else {
        payload = payload || {};
        payload.type = type;
      }
      eventEmitter.emit.call(eventEmitter, this.event, payload);
    },
    _removeAllListeners: function(type) {
      (this.listeners[type] || []).forEach(function(fn) {
        eventEmitter.removeListener(this.event, fn);
      }.bind(this));
      this.listeners[type] = [];
    },
    removeAllListeners: function(type) {
      if (type) {
        this._removeAllListeners(type);
      }
      else {
        for (type in this.listeners) {
          if (this.listeners.hasOwnProperty(type)) {
            this._removeAllListeners(type);
          }
        }
      }
    }
  });

  _.extend(eventEmitter, {
    ProxyEventEmitter: ProxyEventEmitter,
    wrapArray: function(array, field, modelInstance) {
      if (!array.observer) {
        array.observer = new ArrayObserver(array);
        array.observer.open(function(splices) {
          var fieldIsAttribute = modelInstance._attributeNames.indexOf(field) > -1;
          if (fieldIsAttribute) {
            splices.forEach(function(splice) {
              modelEvents.emit({
                collection: modelInstance.collectionName,
                model: modelInstance.model.name,
                localId: modelInstance.localId,
                index: splice.index,
                removed: splice.removed,
                added: splice.addedCount ? array.slice(splice.index, splice.index + splice.addedCount) : [],
                type: modelEvents.ModelEventType.Splice,
                field: field,
                obj: modelInstance
              });
            });
          }
        });
      }
    }
  });

  var oldEmit = eventEmitter.emit;

  // Ensure that errors in event handlers do not stall Siesta.
  eventEmitter.emit = function(event, payload) {
    try {
      oldEmit.call(eventEmitter, event, payload);
    }
    catch (e) {
      console.error(e);
    }
  };

  module.exports = eventEmitter;
})();
},{"../vendor/observe-js/src/observe":53,"./Chain":1,"./modelEvents":22,"./util":24,"argsarray":27,"events":29}],17:[function(require,module,exports){
(function() {
  var util = require('./util'),
    CollectionRegistry = require('./collectionRegistry').CollectionRegistry,
    Collection = require('./collection'),
    cache = require('./cache'),
    Model = require('./model'),
    error = require('./error'),
    events = require('./events'),
    RelationshipType = require('./RelationshipType'),
    ReactiveQuery = require('./ReactiveQuery'),
    ManyToManyProxy = require('./ManyToManyProxy'),
    OneToOneProxy = require('./OneToOneProxy'),
    OneToManyProxy = require('./OneToManyProxy'),
    RelationshipProxy = require('./RelationshipProxy'),
    modelEvents = require('./modelEvents'),
    Query = require('./Query'),
    querySet = require('./QuerySet'),
    log = require('./log'),
    _ = util._;
  util._patchBind();

  // Initialise siesta object. Strange format facilities using submodules with requireJS (eventually)
  var siesta = function(ext) {
    if (!siesta.ext) siesta.ext = {};
    _.extend(siesta.ext, ext || {});
    return siesta;
  };

  // Notifications
  _.extend(siesta, {
    on: events.on.bind(events),
    off: events.removeListener.bind(events),
    once: events.once.bind(events),
    removeAllListeners: events.removeAllListeners.bind(events)
  });
  _.extend(siesta, {
    removeListener: siesta.off,
    addListener: siesta.on
  });

  // Expose some stuff for usage by extensions and/or users
  _.extend(siesta, {
    RelationshipType: RelationshipType,
    ModelEventType: modelEvents.ModelEventType,
    log: log.Level,
    InsertionPolicy: ReactiveQuery.InsertionPolicy,
    _internal: {
      log: log,
      Model: Model,
      error: error,
      ModelEventType: modelEvents.ModelEventType,
      ModelInstance: require('./ModelInstance'),
      extend: require('extend'),
      MappingOperation: require('./mappingOperation'),
      events: events,
      ProxyEventEmitter: events.ProxyEventEmitter,
      cache: require('./cache'),
      modelEvents: modelEvents,
      CollectionRegistry: require('./collectionRegistry').CollectionRegistry,
      Collection: Collection,
      utils: util,
      util: util,
      _: util._,
      querySet: querySet,
      observe: require('../vendor/observe-js/src/observe'),
      Query: Query,
      ManyToManyProxy: ManyToManyProxy,
      OneToManyProxy: OneToManyProxy,
      OneToOneProxy: OneToOneProxy,
      RelationshipProxy: RelationshipProxy
    },
    _: util._,
    async: util.async,
    isArray: util.isArray,
    isString: util.isString
  });

  siesta.ext = {};

  var installed = false,
    installing = false;


  _.extend(siesta, {
    /**
     * Wipe everything. Used during test generally.
     */
    reset: function(cb, resetStorage) {
      installed = false;
      installing = false;
      delete this.queuedTasks;
      cache.reset();
      CollectionRegistry.reset();
      events.removeAllListeners();
      if (siesta.ext.storageEnabled) {
        resetStorage = resetStorage === undefined ? true : resetStorage;
        if (resetStorage) siesta.ext.storage._reset(cb);
        else cb();
      }
      else {
        cb();
      }
    },
    /**
     * Creates and registers a new Collection.
     * @param  {String} name
     * @param  {Object} [opts]
     * @return {Collection}
     */
    collection: function(name, opts) {
      return new Collection(name, opts);
    },
    /**
     * Install all collections.
     * @param {Function} [cb]
     * @returns {q.Promise}
     */
    install: function(cb) {
      if (!installing && !installed) {
        return util.promise(cb, function(cb) {
          installing = true;
          var collectionNames = CollectionRegistry.collectionNames,
            tasks = _.map(collectionNames, function(n) {
              var collection = CollectionRegistry[n];
              return collection.install.bind(collection);
            }),
            storageEnabled = siesta.ext.storageEnabled;
          if (storageEnabled) tasks = tasks.concat([siesta.ext.storage.ensureIndexesForAll, siesta.ext.storage._load]);
          tasks.push(function(done) {
            installed = true;
            if (this.queuedTasks) this.queuedTasks.execute();
            done();
          }.bind(this));

          siesta.async.series(tasks, cb);
        }.bind(this));
      }
      else cb(error('already installing'));
    },
    _pushTask: function(task) {
      if (!this.queuedTasks) {
        this.queuedTasks = new function Queue() {
          this.tasks = [];
          this.execute = function() {
            this.tasks.forEach(function(f) {
              f()
            });
            this.tasks = [];
          }.bind(this);
        };
      }
      this.queuedTasks.tasks.push(task);
    },
    _afterInstall: function(task) {
      if (!installed) {
        if (!installing) {
          this.install(function(err) {
            if (err) {
              console.error('Error setting up siesta', err);
            }
            delete this.queuedTasks;
          }.bind(this));
        }
        // In case installed straight away e.g. if storage extension not installed.
        if (!installed) this._pushTask(task);
        else task();
      }
      else {
        task();
      }
    },
    setLogLevel: function(loggerName, level) {
      var Logger = log.loggerWithName(loggerName);
      Logger.setLevel(level);
    },
    graph: function(data, opts, cb) {
      if (typeof opts == 'function') cb = opts;
      opts = opts || {};
      return util.promise(cb, function(cb) {
        var tasks = [], err;
        for (var collectionName in data) {
          if (data.hasOwnProperty(collectionName)) {
            var collection = CollectionRegistry[collectionName];
            if (collection) {
              (function(collection, data) {
                tasks.push(function(done) {
                  collection.graph(data, function(err, res) {
                    if (!err) {
                      var results = {};
                      results[collection.name] = res;
                    }
                    done(err, results);
                  });
                });
              })(collection, data[collectionName]);
            }
            else {
              err = 'No such collection "' + collectionName + '"';
            }
          }
        }
        if (!err) util.async.series(tasks, function(err, results) {
          if (!err) {
            results = results.reduce(function(memo, res) {
              return _.extend(memo, res);
            }, {})
          } else results = null;
          cb(err, results);
        });
        else cb(error(err, {data: data, invalidCollectionName: collectionName}));
      }.bind(this));
    },
    notify: util.next,
    registerComparator: Query.registerComparator.bind(Query),
    count: function() {
      return cache.count();
    },
    get: function(id, cb) {
      return util.promise(cb, function(cb) {
        this._afterInstall(function() {
          cb(null, cache._localCache()[id]);
        });
      }.bind(this));
    },
    removeAll: function(cb) {
      return util.promise(cb, function(cb) {
        util.Promise.all(
          CollectionRegistry.collectionNames.map(function(collectionName) {
            return CollectionRegistry[collectionName].removeAll();
          }.bind(this))
        ).then(function() {
            cb(null);
          }).catch(cb)
      }.bind(this));
    }
  });

  Object.defineProperties(siesta, {
    _canChange: {
      get: function() {
        return !(installing || installed);
      }
    },
    installed: {
      get: function () {
        return installed;
      }
    }
  });

  if (typeof window != 'undefined') {
    window['siesta'] = siesta;
  }

  siesta.log = require('debug');

  module.exports = siesta;

  (function loadExtensions() {
    require('../storage');
  })();

})();
},{"../storage":52,"../vendor/observe-js/src/observe":53,"./ManyToManyProxy":2,"./ModelInstance":3,"./OneToManyProxy":4,"./OneToOneProxy":5,"./Query":7,"./QuerySet":8,"./ReactiveQuery":9,"./RelationshipProxy":10,"./RelationshipType":11,"./cache":12,"./collection":13,"./collectionRegistry":14,"./error":15,"./events":16,"./log":19,"./mappingOperation":20,"./model":21,"./modelEvents":22,"./util":24,"debug":30,"extend":33}],18:[function(require,module,exports){
(function() {
  var log = require('./log')('model'),
    InternalSiestaError = require('./error').InternalSiestaError,
    RelationshipType = require('./RelationshipType'),
    Query = require('./Query'),
    ModelInstance = require('./ModelInstance'),
    util = require('./util'),
    _ = util._,
    guid = util.guid,
    cache = require('./cache'),
    extend = require('extend'),
    modelEvents = require('./modelEvents'),
    wrapArray = require('./events').wrapArray,
    OneToManyProxy = require('./OneToManyProxy'),
    OneToOneProxy = require('./OneToOneProxy'),
    ManyToManyProxy = require('./ManyToManyProxy'),
    ReactiveQuery = require('./ReactiveQuery'),
    ModelEventType = modelEvents.ModelEventType;

  function ModelInstanceFactory(model) {
    this.model = model;
  }

  ModelInstanceFactory.prototype = {
    _getLocalId: function(data) {
      var localId;
      if (data) {
        localId = data.localId ? data.localId : guid();
      } else {
        localId = guid();
      }
      return localId;
    },
    /**
     * Configure attributes
     * @param modelInstance
     * @param data
     * @private
     */

    _installAttributes: function(modelInstance, data) {
      var Model = this.model,
        attributeNames = Model._attributeNames,
        idx = attributeNames.indexOf(Model.id);
      _.extend(modelInstance, {
        __values: _.extend(_.reduce(Model.attributes, function(m, a) {
          if (a.default !== undefined) m[a.name] = a.default;
          return m;
        }, {}), data || {})
      });
      if (idx > -1) attributeNames.splice(idx, 1);
      _.each(attributeNames, function(attributeName) {
        var attributeDefinition = Model._attributeDefinitionWithName(attributeName);
        Object.defineProperty(modelInstance, attributeName, {
          get: function() {
            var value = modelInstance.__values[attributeName];
            return value === undefined ? null : value;
          },
          set: function(v) {
            if (attributeDefinition.parse) {
              v = attributeDefinition.parse.call(modelInstance, v);
            }
            if (Model.parseAttribute) {
              v = Model.parseAttribute.call(modelInstance, attributeName, v);
            }
            var old = modelInstance.__values[attributeName];
            var propertyDependencies = this._propertyDependencies[attributeName];
            propertyDependencies = _.map(propertyDependencies, function(dependant) {
              return {
                prop: dependant,
                old: this[dependant]
              }
            }.bind(this));

            modelInstance.__values[attributeName] = v;
            propertyDependencies.forEach(function(dep) {
              var propertyName = dep.prop;
              var new_ = this[propertyName];
              modelEvents.emit({
                collection: Model.collectionName,
                model: Model.name,
                localId: modelInstance.localId,
                new: new_,
                old: dep.old,
                type: ModelEventType.Set,
                field: propertyName,
                obj: modelInstance
              });
            }.bind(this));
            var e = {
              collection: Model.collectionName,
              model: Model.name,
              localId: modelInstance.localId,
              new: v,
              old: old,
              type: ModelEventType.Set,
              field: attributeName,
              obj: modelInstance
            };
            window.lastEmission = e;
            modelEvents.emit(e);
            if (util.isArray(v)) {
              wrapArray(v, attributeName, modelInstance);
            }
          },
          enumerable: true,
          configurable: true
        });
      });
    },
    _installMethods: function(modelInstance) {
      var Model = this.model;
      _.each(Object.keys(Model.methods), function(methodName) {
        if (modelInstance[methodName] === undefined) {
          modelInstance[methodName] = Model.methods[methodName].bind(modelInstance);
        }
        else {
          log('A method with name "' + methodName + '" already exists. Ignoring it.');
        }
      }.bind(this));
    },
    _installProperties: function(modelInstance) {
      var _propertyNames = Object.keys(this.model.properties),
        _propertyDependencies = {};
      _.each(_propertyNames, function(propName) {
        var propDef = this.model.properties[propName];
        var dependencies = propDef.dependencies || [];
        dependencies.forEach(function(attr) {
          if (!_propertyDependencies[attr]) _propertyDependencies[attr] = [];
          _propertyDependencies[attr].push(propName);
        });
        delete propDef.dependencies;
        if (modelInstance[propName] === undefined) {
          Object.defineProperty(modelInstance, propName, propDef);
        }
        else {
          log('A property/method with name "' + propName + '" already exists. Ignoring it.');
        }
      }.bind(this));

      modelInstance._propertyDependencies = _propertyDependencies;
    },
    _installRemoteId: function(modelInstance) {
      var Model = this.model;
      var idField = Model.id;
      Object.defineProperty(modelInstance, idField, {
        get: function() {
          return modelInstance.__values[Model.id] || null;
        },
        set: function(v) {
          var old = modelInstance[Model.id];
          modelInstance.__values[Model.id] = v;
          modelEvents.emit({
            collection: Model.collectionName,
            model: Model.name,
            localId: modelInstance.localId,
            new: v,
            old: old,
            type: ModelEventType.Set,
            field: Model.id,
            obj: modelInstance
          });
          cache.remoteInsert(modelInstance, v, old);
        },
        enumerable: true,
        configurable: true
      });
    },
    _installRelationships: function(modelInstance) {
      var model = this.model;
      for (var name in model.relationships) {
        var proxy;
        if (model.relationships.hasOwnProperty(name)) {
          var relationshipOpts = _.extend({}, model.relationships[name]),
            type = relationshipOpts.type;
          delete relationshipOpts.type;
          if (type == RelationshipType.OneToMany) {
            proxy = new OneToManyProxy(relationshipOpts);
          } else if (type == RelationshipType.OneToOne) {
            proxy = new OneToOneProxy(relationshipOpts);
          } else if (type == RelationshipType.ManyToMany) {
            proxy = new ManyToManyProxy(relationshipOpts);
          } else {
            throw new InternalSiestaError('No such relationship type: ' + type);
          }
        }
        proxy.install(modelInstance);
      }
    },
    _registerInstance: function(modelInstance, shouldRegisterChange) {
      cache.insert(modelInstance);
      shouldRegisterChange = shouldRegisterChange === undefined ? true : shouldRegisterChange;
      if (shouldRegisterChange) modelInstance._emitNew();
    },
    _installLocalId: function(modelInstance, data) {
      modelInstance.localId = this._getLocalId(data);
    },
    /**
     * Convert raw data into a ModelInstance
     * @returns {ModelInstance}
     */
    _instance: function(data, shouldRegisterChange) {
      if (!this.model._relationshipsInstalled || !this.model._reverseRelationshipsInstalled) {
        throw new InternalSiestaError('Model must be fully installed before creating any models');
      }
      var modelInstance = new ModelInstance(this.model);
      this._installLocalId(modelInstance, data);
      this._installAttributes(modelInstance, data);
      this._installMethods(modelInstance);
      this._installProperties(modelInstance);
      this._installRemoteId(modelInstance);
      this._installRelationships(modelInstance);
      this._registerInstance(modelInstance, shouldRegisterChange);
      return modelInstance;
    }
  };

  module.exports = function(model) {
    var factory = new ModelInstanceFactory(model);
    return factory._instance.bind(factory);
  }
})();
},{"./ManyToManyProxy":2,"./ModelInstance":3,"./OneToManyProxy":4,"./OneToOneProxy":5,"./Query":7,"./ReactiveQuery":9,"./RelationshipType":11,"./cache":12,"./error":15,"./events":16,"./log":19,"./modelEvents":22,"./util":24,"extend":33}],19:[function(require,module,exports){
(function () {
    /**
     * Dead simple logging service based on visionmedia/debug
     * @module log
     */

    var debug = require('debug'),
        argsarray = require('argsarray');

    module.exports = function (name) {
        var log = debug('siesta:' + name);
        var fn = argsarray(function (args) {
            log.call(log, args);
        });
        Object.defineProperty(fn, 'enabled', {
            get: function () {
                return debug.enabled(name);
            }
        });
        return fn;
    };
})();
},{"argsarray":27,"debug":30}],20:[function(require,module,exports){
(function() {
  var ModelInstance = require('./ModelInstance'),
    log = require('./log')('graph'),
    cache = require('./cache'),
    util = require('./util'),
    _ = util._,
    async = util.async;

  function SiestaError(opts) {
    this.opts = opts;
  }

  SiestaError.prototype.toString = function() {
    return JSON.stringify(this.opts, null, 4);
  };


  /**
   * Encapsulates the idea of mapping arrays of data onto the object graph or arrays of objects.
   * @param {Object} opts
   * @param opts.model
   * @param opts.data#
   * @param opts.objects
   * @param opts.disableNotifications
   */
  function MappingOperation(opts) {
    this._opts = opts;

    util.extendFromOpts(this, opts, {
      model: null,
      data: null,
      objects: [],
      disableevents: false,
      _ignoreInstalled: false,
      fromStorage: false
    });

    _.extend(this, {
      errors: [],
      subTaskResults: {},
      _newObjects: []
    });

    this.data = this.preprocessData();
  }


  _.extend(MappingOperation.prototype, {
    mapAttributes: function() {
      for (var i = 0; i < this.data.length; i++) {
        var datum = this.data[i];
        var object = this.objects[i];
        // No point mapping object onto itself. This happens if a ModelInstance is passed as a relationship.
        if (datum != object) {
          if (object) { // If object is falsy, then there was an error looking up that object/creating it.
            var fields = this.model._attributeNames;
            _.each(fields, function(f) {
              if (datum[f] !== undefined) { // null is fine
                // If events are disabled we update __values object directly. This avoids triggering
                // events which are built into the set function of the property.
                if (this.disableevents) {
                  object.__values[f] = datum[f];
                }
                else {
                  object[f] = datum[f];
                }
              }
            }.bind(this));
            // PouchDB revision (if using storage module).
            // TODO: Can this be pulled out of core?
            if (datum._rev) object._rev = datum._rev;
          }
        }
      }
    },
    _map: function() {
      var self = this;
      var err;
      this.mapAttributes();
      var relationshipFields = _.keys(self.subTaskResults);
      _.each(relationshipFields, function(f) {
        var res = self.subTaskResults[f];
        var indexes = res.indexes,
          objects = res.objects;
        var relatedData = self.getRelatedData(f).relatedData;
        var unflattenedObjects = util.unflattenArray(objects, relatedData);
        for (var i = 0; i < unflattenedObjects.length; i++) {
          var idx = indexes[i];
          // Errors are plucked from the suboperations.
          var error = self.errors[idx];
          err = error ? error[f] : null;
          if (!err) {
            var related = unflattenedObjects[i]; // Can be array or scalar.
            var object = self.objects[idx];
            if (object) {
              err = object.__proxies[f].set(related, {disableevents: self.disableevents});
              if (err) {
                if (!self.errors[idx]) self.errors[idx] = {};
                self.errors[idx][f] = err;
              }
            }
          }
        }
      });
    },
    /**
     * For indices where no object is present, perform lookups, creating a new object if necessary.
     * @private
     */
    _lookup: function(cb) {
      return util.promise(cb, function(cb) {
        var self = this;
        var remoteLookups = [];
        var localLookups = [];
        for (var i = 0; i < this.data.length; i++) {
          if (!this.objects[i]) {
            var lookup;
            var datum = this.data[i];
            var isScalar = typeof datum == 'string' || typeof datum == 'number' || datum instanceof String;
            if (datum) {
              if (isScalar) {
                lookup = {
                  index: i,
                  datum: {}
                };
                lookup.datum[self.model.id] = datum;
                remoteLookups.push(lookup);
              } else if (datum instanceof ModelInstance) { // We won't need to perform any mapping.
                this.objects[i] = datum;
              } else if (datum.localId) {
                localLookups.push({
                  index: i,
                  datum: datum
                });
              } else if (datum[self.model.id]) {
                remoteLookups.push({
                  index: i,
                  datum: datum
                });
              } else {
                this.objects[i] = self._instance();
              }
            } else {
              this.objects[i] = null;
            }
          }
        }
        util.async.parallel([
          function(done) {
            var localIdentifiers = _.pluck(_.pluck(localLookups, 'datum'), 'localId');
            var objects = cache.getViaLocalId(localIdentifiers);
            for (var i = 0; i < localIdentifiers.length; i++) {
              var obj = objects[i];
              var localId = localIdentifiers[i];
              var lookup = localLookups[i];
              if (!obj) {
                // If there are multiple mapping operations going on, there may be
                obj = cache.get({localId: localId});
                if (!obj) obj = self._instance({localId: localId}, !self.disableevents);
                self.objects[lookup.index] = obj;
              } else {
                self.objects[lookup.index] = obj;
              }
            }
            done();
          },
          function(done) {
            var remoteIdentifiers = _.pluck(_.pluck(remoteLookups, 'datum'), self.model.id);
            var objects = cache.getViaRemoteId(remoteIdentifiers, {model: self.model});
            for (i = 0; i < objects.length; i++) {
              var obj = objects[i];
              var lookup = remoteLookups[i];
              if (obj) {
                self.objects[lookup.index] = obj;
              } else {
                var data = {};
                var remoteId = remoteIdentifiers[i];
                data[self.model.id] = remoteId;
                var cacheQuery = {
                  model: self.model
                };
                cacheQuery[self.model.id] = remoteId;
                var cached = cache.get(cacheQuery);
                if (cached) {
                  self.objects[lookup.index] = cached;
                } else {
                  self.objects[lookup.index] = self._instance();
                  // It's important that we map the remote identifier here to ensure that it ends
                  // up in the cache.
                  self.objects[lookup.index][self.model.id] = remoteId;
                }
              }
            }
            done();
          }
        ], cb);
      }.bind(this));
    },
    _lookupSingleton: function(cb) {
      return util.promise(cb, function(cb) {
        var self = this;
        // Pick a random localId from the array of data being mapped onto the singleton object. Note that they should
        // always be the same. This is just a precaution.
        var localIdentifiers = _.pluck(self.data, 'localId'),
          localId;
        for (i = 0; i < localIdentifiers.length; i++) {
          if (localIdentifiers[i]) {
            localId = {localId: localIdentifiers[i]};
            break;
          }
        }
        // The mapping operation is responsible for creating singleton instances if they do not already exist.
        var singleton = cache.getSingleton(this.model) || this._instance(localId);
        for (var i = 0; i < self.data.length; i++) {
          self.objects[i] = singleton;
        }
        cb();
      }.bind(this));
    }
    ,
    _instance: function() {
      var model = this.model,
        modelInstance = model._instance.apply(model, arguments);
      this._newObjects.push(modelInstance);
      return modelInstance;
    }
    ,
    preprocessData: function() {
      var data = _.extend([], this.data);
      return _.map(data, function(datum) {
        if (datum) {
          if (!util.isString(datum)) {
            var keys = _.keys(datum);
            _.each(keys, function(k) {
              var isRelationship = this.model._relationshipNames.indexOf(k) > -1;

              if (isRelationship) {
                var val = datum[k];
                if (val instanceof ModelInstance) {
                  datum[k] = {localId: val.localId};
                }
                else if (util.isArray(val)) {
                  datum[k] = _.each(val, function(e) {
                    if (e instanceof ModelInstance) {
                      return {localId: val.localId};
                    }
                    return val;
                  });
                }
              }
            }.bind(this));
          }
        }
        return datum;
      }.bind(this));
    }
    ,
    start: function(done) {
      var data = this.data;
      if (data.length) {
        var self = this;
        var tasks = [];
        var lookupFunc = this.model.singleton ? this._lookupSingleton : this._lookup;
        tasks.push(_.bind(lookupFunc, this));
        tasks.push(_.bind(this._executeSubOperations, this));
        util.async.parallel(tasks, function() {
          try {
            self._map();

            // Users are allowed to add a custom init method to the methods object when defining a Model, of the form:
            //
            //
            // init: function ([done]) {
            //     // ...
            //  }
            //
            //
            // If done is passed, then __init must be executed asynchronously, and the mapping operation will not
            // finish until all inits have executed.
            //
            // Here we ensure the execution of all of them
            var fromStorage = this.fromStorage;
            var initTasks = _.reduce(self._newObjects, function(memo, o) {
              var init = o.model.init;
              if (init) {
                var paramNames = util.paramNames(init);
                if (paramNames.length > 1) {
                  memo.push(_.bind(init, o, fromStorage, done));
                }
                else {
                  init.call(o, fromStorage);
                }
              }
              o._emitEvents = true;
              o._emitNew();
              return memo;
            }, []);
            async.parallel(initTasks, function() {
              done(self.errors.length ? self.errors : null, self.objects);
            });
          }
          catch (e) {
            console.error('Uncaught error when executing init funcitons on models.', e);
            done(e);
          }
        }.bind(this));
      } else {
        done(null, []);
      }
    }
    ,
    getRelatedData: function(name) {
      var indexes = [];
      var relatedData = [];
      for (var i = 0; i < this.data.length; i++) {
        var datum = this.data[i];
        if (datum) {
          var val = datum[name];
          if (val) {
            indexes.push(i);
            relatedData.push(val);
          }
        }
      }
      return {
        indexes: indexes,
        relatedData: relatedData
      };
    }
    ,
    processErrorsFromTask: function(relationshipName, errors, indexes) {
      if (errors.length) {
        var relatedData = this.getRelatedData(relationshipName).relatedData;
        var unflattenedErrors = util.unflattenArray(errors, relatedData);
        for (var i = 0; i < unflattenedErrors.length; i++) {
          var idx = indexes[i];
          var err = unflattenedErrors[i];
          var isError = err;
          if (util.isArray(err)) isError = _.reduce(err, function(memo, x) {
            return memo || x
          }, false);
          if (isError) {
            if (!this.errors[idx]) this.errors[idx] = {};
            this.errors[idx][relationshipName] = err;
          }
        }
      }
    }
    ,
    _executeSubOperations: function(callback) {
      var self = this,
        relationshipNames = _.keys(this.model.relationships);
      if (relationshipNames.length) {
        var tasks = _.reduce(relationshipNames, function(m, relationshipName) {
          var relationship = self.model.relationships[relationshipName];
          var reverseModel = relationship.forwardName == relationshipName ? relationship.reverseModel : relationship.forwardModel;
          // Mock any missing singleton data to ensure that all singleton instances are created.
          if (reverseModel.singleton && !relationship.isReverse) {
            this.data.forEach(function(datum) {
              if (!datum[relationshipName]) datum[relationshipName] = {};
            });
          }
          var __ret = this.getRelatedData(relationshipName),
            indexes = __ret.indexes,
            relatedData = __ret.relatedData;
          if (relatedData.length) {
            var flatRelatedData = util.flattenArray(relatedData);
            var op = new MappingOperation({
              model: reverseModel,
              data: flatRelatedData,
              disableevents: self.disableevents,
              _ignoreInstalled: self._ignoreInstalled,
              fromStorage: this.fromStorage
            });
          }

          if (op) {
            var task;
            task = function(done) {
              op.start(function(errors, objects) {
                self.subTaskResults[relationshipName] = {
                  errors: errors,
                  objects: objects,
                  indexes: indexes
                };
                self.processErrorsFromTask(relationshipName, op.errors, indexes);
                done();
              });
            };
            m.push(task);
          }
          return m;
        }.bind(this), []);
        async.parallel(tasks, function(err) {
          callback(err);
        });
      } else {
        callback();
      }
    }
  })
  ;

  module.exports = MappingOperation;


})
();
},{"./ModelInstance":3,"./cache":12,"./log":19,"./util":24}],21:[function(require,module,exports){
(function() {

  var log = require('./log')('model'),
    CollectionRegistry = require('./collectionRegistry').CollectionRegistry,
    InternalSiestaError = require('./error').InternalSiestaError,
    RelationshipType = require('./RelationshipType'),
    Query = require('./Query'),
    MappingOperation = require('./mappingOperation'),
    ModelInstance = require('./ModelInstance'),
    util = require('./util'),
    cache = require('./cache'),
    argsarray = require('argsarray'),
    error = require('./error'),
    extend = require('extend'),
    modelEvents = require('./modelEvents'),
    events = require('./events'),
    OneToOneProxy = require('./OneToOneProxy'),
    ManyToManyProxy = require('./ManyToManyProxy'),
    Placeholder = require('./Placeholder'),
    ReactiveQuery = require('./ReactiveQuery'),
    instanceFactory = require('./instanceFactory'),
    _ = util._;

  /**
   *
   * @param {Object} opts
   */
  function Model(opts) {
    var self = this;
    this._opts = opts ? _.extend({}, opts) : {};

    util.extendFromOpts(this, opts, {
      methods: {},
      attributes: [],
      collection: function(c) {
        if (util.isString(c)) {
          c = CollectionRegistry[c];
        }
        return c;
      },
      id: 'id',
      relationships: [],
      name: null,
      indexes: [],
      singleton: false,
      statics: this.installStatics.bind(this),
      properties: {},
      init: null,
      serialise: null,
      serialiseField: null,
      serialisableFields: null,
      remove: null,
      parseAttribute: null
    }, false);

    if (!this.parseAttribute) {
      this.parseAttribute = function(attrName, value) {
        return value;
      }
    }

    if (!this.serialiseField) {
      this.serialiseField = function(attrName, value) {
        return value;
      };
    }

    this.attributes = Model._processAttributes(this.attributes);

    this._instance = new instanceFactory(this);

    _.extend(this, {
      _relationshipsInstalled: false,
      _reverseRelationshipsInstalled: false,
      children: []
    });

    Object.defineProperties(this, {
      _relationshipNames: {
        get: function() {
          return Object.keys(self.relationships);
        },
        enumerable: true
      },
      _attributeNames: {
        get: function() {
          var names = [];
          if (self.id) {
            names.push(self.id);
          }
          _.each(self.attributes, function(x) {
            names.push(x.name)
          });
          return names;
        },
        enumerable: true,
        configurable: true
      },
      installed: {
        get: function() {
          return self._relationshipsInstalled && self._reverseRelationshipsInstalled;
        },
        enumerable: true,
        configurable: true
      },
      descendants: {
        get: function() {
          return _.reduce(self.children, function(memo, descendant) {
            return Array.prototype.concat.call(memo, descendant.descendants);
          }.bind(self), _.extend([], self.children));
        },
        enumerable: true
      },
      dirty: {
        get: function() {
          if (siesta.ext.storageEnabled) {
            var unsavedObjectsByCollection = siesta.ext.storage._unsavedObjectsByCollection,
              hash = (unsavedObjectsByCollection[this.collectionName] || {})[this.name] || {};
            return !!Object.keys(hash).length;
          }
          else return undefined;
        },
        enumerable: true
      },
      collectionName: {
        get: function() {
          return this.collection.name;
        },
        enumerable: true
      }
    });
    var globalEventName = this.collectionName + ':' + this.name,
      proxied = {
        query: this.query.bind(this)
      };

    events.ProxyEventEmitter.call(this, globalEventName, proxied);
  }

  _.extend(Model, {
    /**
     * Normalise attributes passed via the options dictionary.
     * @param attributes
     * @returns {Array}
     * @private
     */
    _processAttributes: function(attributes) {
      return _.reduce(attributes, function(m, a) {
        if (typeof a == 'string') {
          m.push({
            name: a
          });
        }
        else {
          m.push(a);
        }
        return m;
      }, [])
    }
  });

  Model.prototype = Object.create(events.ProxyEventEmitter.prototype);

  _.extend(Model.prototype, {
    installStatics: function(statics) {
      if (statics) {
        _.each(Object.keys(statics), function(staticName) {
          if (this[staticName]) {
            log('Static method with name "' + staticName + '" already exists. Ignoring it.');
          }
          else {
            this[staticName] = statics[staticName].bind(this);
          }
        }.bind(this));
      }
      return statics;
    },
    _validateRelationshipType: function(relationship) {
      if (!relationship.type) {
        if (this.singleton) relationship.type = RelationshipType.OneToOne;
        else relationship.type = RelationshipType.OneToMany;
      }
      if (this.singleton && relationship.type == RelationshipType.ManyToMany) {
        return 'Singleton model cannot use ManyToMany relationship.';
      }
      if (Object.keys(RelationshipType).indexOf(relationship.type) < 0)
        return 'Relationship type ' + relationship.type + ' does not exist';
      return null;
    },
    /**
     * Return the reverse model or a placeholder that will be resolved later.
     * @param name
     * @returns {*}
     * @private
     */
    _getReverseModel: function(name) {
      var reverseModel;
      if (name instanceof Model) reverseModel = name;
      else reverseModel = this.collection[name];
      if (!reverseModel) { // May have used Collection.Model format.
        var arr = name.split('.');
        if (arr.length == 2) {
          var collectionName = arr[0];
          name = arr[1];
          var otherCollection = CollectionRegistry[collectionName];
          if (!otherCollection) return 'Collection with name "' + collectionName + '" does not exist.';
          reverseModel = otherCollection[name];
        }
      }
      return reverseModel || new Placeholder({name: name});
    },
    /**
     * Install relationships. Returns error in form of string if fails.
     * @return {String|null}
     */
    installRelationships: function() {
      if (!this._relationshipsInstalled) {
        var err = null;
        for (var name in this._opts.relationships) {
          if (this._opts.relationships.hasOwnProperty(name)) {
            var relationship = this._opts.relationships[name];
            // If a reverse relationship is installed beforehand, we do not want to process them.
            var isForward = !relationship.isReverse;
            if (isForward) {
              log(this.name + ': configuring relationship ' + name, relationship);
              if (!(err = this._validateRelationshipType(relationship))) {
                var reverseModelName = relationship.model;
                if (reverseModelName) {
                  var reverseModel = this._getReverseModel(reverseModelName);
                  if (util.isString(reverseModel)) return reverseModel;
                  _.extend(relationship, {
                    reverseModel: reverseModel,
                    forwardModel: this,
                    forwardName: name,
                    reverseName: relationship.reverse || 'reverse_' + name,
                    isReverse: false
                  });
                  delete relationship.model;
                  delete relationship.reverse;
                }
                else return 'Must pass model';
              }
            }
          }
        }
      } else throw new InternalSiestaError('Relationships for "' + this.name + '" have already been installed');
      if (!err) this._relationshipsInstalled = true;
      return err;
    },
    installReverseRelationships: function() {
      var installed = [];
      if (!this._reverseRelationshipsInstalled) {
        for (var forwardName in this.relationships) {
          if (this.relationships.hasOwnProperty(forwardName)) {
            var relationship = this.relationships[forwardName];
            relationship = extend(true, {}, relationship);
            relationship.isReverse = true;
            var reverseModel = relationship.reverseModel,
              reverseName = relationship.reverseName,
              forwardModel = relationship.forwardModel;
            if (reverseModel != this || reverseModel == forwardModel) {
              installed.push(reverseName);
              if (reverseModel.singleton) {
                if (relationship.type == RelationshipType.ManyToMany) return 'Singleton model cannot be related via reverse ManyToMany';
                if (relationship.type == RelationshipType.OneToMany) return 'Singleton model cannot be related via reverse OneToMany';
              }
              log(this.name + ': configuring  reverse relationship ' + reverseName);
              if (reverseModel.relationships[reverseName]) {
                // We are ok to redefine reverse relationships whereby the models are in the same hierarchy
                var isAncestorModel = reverseModel.relationships[reverseName].forwardModel.isAncestorOf(this);
                var isDescendentModel = reverseModel.relationships[reverseName].forwardModel.isDescendantOf(this);
                if (!isAncestorModel && !isDescendentModel)
                  return 'Reverse relationship "' + reverseName + '" already exists on model "' + reverseModel.name + '"';
              }
              reverseModel.relationships[reverseName] = relationship;
            }
          }
        }
        this._reverseRelationshipsInstalled = true;
      } else {
        throw new InternalSiestaError('Reverse relationships for "' + this.name + '" have already been installed.');
      }
    },
    _query: function(query) {
      return new Query(this, query || {});
    },
    query: function(query, cb) {
      var queryInstance;
      var promise = util.promise(cb, function(cb) {
        if (!this.singleton) {
          queryInstance = this._query(query);
          return queryInstance.execute(cb);
        }
        else {
          queryInstance = this._query({__ignoreInstalled: true});
          queryInstance.execute(function(err, objs) {
            if (err) cb(err);
            else {
              // Cache a new singleton and then reexecute the query
              query = _.extend({}, query);
              query.__ignoreInstalled = true;
              if (!objs.length) {
                this.graph({}, function(err) {
                  if (!err) {
                    queryInstance = this._query(query);
                    queryInstance.execute(cb);
                  }
                  else {
                    cb(err);
                  }
                }.bind(this));
              }
              else {
                queryInstance = this._query(query);
                queryInstance.execute(cb);
              }
            }
          }.bind(this));
        }
      }.bind(this));

      // By wrapping the promise in another promise we can push the invocations to the bottom of the event loop so that
      // any event handlers added to the chain are honoured straight away.
      var linkPromise = new util.Promise(function(resolve, reject) {
        promise.then(argsarray(function(args) {
          setTimeout(function() {
            resolve.apply(null, args);
          });
        }), argsarray(function(args) {
          setTimeout(function() {
            reject.apply(null, args);
          })
        }));
      });

      return this._link({
        then: linkPromise.then.bind(linkPromise),
        catch: linkPromise.catch.bind(linkPromise),
        on: argsarray(function(args) {
          var rq = new ReactiveQuery(this._query(query));
          rq.init();
          rq.on.apply(rq, args);
        }.bind(this))
      });
    },
    /**
     * Only used in testing at the moment.
     * @param query
     * @returns {ReactiveQuery}
     */
    _reactiveQuery: function(query) {
      return new ReactiveQuery(new Query(this, query || {}));
    },
    one: function(opts, cb) {
      if (typeof opts == 'function') {
        cb = opts;
        opts = {};
      }
      return util.promise(cb, function(cb) {
        this.query(opts, function(err, res) {
          if (err) cb(err);
          else {
            if (res.length > 1) {
              cb(error('More than one instance returned when executing get query!'));
            }
            else {
              res = res.length ? res[0] : null;
              cb(null, res);
            }
          }
        });
      }.bind(this));
    },
    all: function(q, cb) {
      if (typeof q == 'function') {
        cb = q;
        q = {};
      }
      q = q || {};
      var query = {};
      if (q.__order) query.__order = q.__order;
      return this.query(q, cb);
    },
    _attributeDefinitionWithName: function(name) {
      for (var i = 0; i < this.attributes.length; i++) {
        var attributeDefinition = this.attributes[i];
        if (attributeDefinition.name == name) return attributeDefinition;
      }
    },
    /**
     * Map data into Siesta.
     *
     * @param data Raw data received remotely or otherwise
     * @param {function|object} [opts]
     * @param {boolean} opts.override
     * @param {boolean} opts._ignoreInstalled - A hack that allows mapping onto Models even if install process has not finished.
     * @param {function} [cb] Called once pouch persistence returns.
     */
    graph: function(data, opts, cb) {
      if (typeof opts == 'function') cb = opts;
      opts = opts || {};
      return util.promise(cb, function(cb) {
        var _map = function() {
          var overrides = opts.override;
          if (overrides) {
            if (util.isArray(overrides)) opts.objects = overrides;
            else opts.objects = [overrides];
          }
          delete opts.override;
          if (util.isArray(data)) {
            this._mapBulk(data, opts, cb);
          } else {
            this._mapBulk([data], opts, function(err, objects) {
              var obj;
              if (objects) {
                if (objects.length) {
                  obj = objects[0];
                }
              }
              err = err ? (util.isArray(data) ? err : (util.isArray(err) ? err[0] : err)) : null;
              cb(err, obj);
            });
          }
        }.bind(this);
        if (opts._ignoreInstalled) {
          _map();
        }
        else siesta._afterInstall(_map);
      }.bind(this));
    },
    _mapBulk: function(data, opts, callback) {
      _.extend(opts, {model: this, data: data});
      var op = new MappingOperation(opts);
      op.start(function(err, objects) {
        if (err) {
          if (callback) callback(err);
        } else {
          callback(null, objects || []);
        }
      });
    },
    _countCache: function() {
      var collCache = cache._localCacheByType[this.collectionName] || {};
      var modelCache = collCache[this.name] || {};
      return _.reduce(Object.keys(modelCache), function(m, localId) {
        m[localId] = {};
        return m;
      }, {});
    },
    count: function(cb) {
      return util.promise(cb, function(cb) {
        cb(null, Object.keys(this._countCache()).length);
      }.bind(this));
    },
    _dump: function(asJSON) {
      var dumped = {};
      dumped.name = this.name;
      dumped.attributes = this.attributes;
      dumped.id = this.id;
      dumped.collection = this.collectionName;
      dumped.relationships = _.map(this.relationships, function(r) {
        return r.isForward ? r.forwardName : r.reverseName;
      });
      return asJSON ? util.prettyPrint(dumped) : dumped;
    },
    toString: function() {
      return 'Model[' + this.name + ']';
    },
    removeAll: function(cb) {
      return util.promise(cb, function(cb) {
        this.all()
          .then(function(instances) {
            instances.remove();
            cb();
          })
          .catch(cb);
      }.bind(this));
    }

  });

  // Subclassing
  _.extend(Model.prototype, {
    child: function(nameOrOpts, opts) {
      if (typeof nameOrOpts == 'string') {
        opts.name = nameOrOpts;
      } else {
        opts = name;
      }
      _.extend(opts, {
        attributes: Array.prototype.concat.call(opts.attributes || [], this._opts.attributes),
        relationships: _.extend(opts.relationships || {}, this._opts.relationships),
        methods: _.extend(_.extend({}, this._opts.methods) || {}, opts.methods),
        statics: _.extend(_.extend({}, this._opts.statics) || {}, opts.statics),
        properties: _.extend(_.extend({}, this._opts.properties) || {}, opts.properties),
        id: opts.id || this._opts.id,
        init: opts.init || this._opts.init,
        remove: opts.remove || this._opts.remove,
        serialise: opts.serialise || this._opts.serialise,
        serialiseField: opts.serialiseField || this._opts.serialiseField,
        parseAttribute: opts.parseAttribute || this._opts.parseAttribute
      });

      if (this._opts.serialisableFields) {
        opts.serialisableFields = Array.prototype.concat.apply(opts.serialisableFields || [], this._opts.serialisableFields);
      }

      var model = this.collection.model(opts.name, opts);
      model.parent = this;
      this.children.push(model);
      return model;
    },
    isChildOf: function(parent) {
      return this.parent == parent;
    },
    isParentOf: function(child) {
      return this.children.indexOf(child) > -1;
    },
    isDescendantOf: function(ancestor) {
      var parent = this.parent;
      while (parent) {
        if (parent == ancestor) return true;
        parent = parent.parent;
      }
      return false;
    },
    isAncestorOf: function(descendant) {
      return this.descendants.indexOf(descendant) > -1;
    },
    hasAttributeNamed: function(attributeName) {
      return this._attributeNames.indexOf(attributeName) > -1;
    }
  });


  module.exports = Model;

})();

},{"./ManyToManyProxy":2,"./ModelInstance":3,"./OneToOneProxy":5,"./Placeholder":6,"./Query":7,"./ReactiveQuery":9,"./RelationshipType":11,"./cache":12,"./collectionRegistry":14,"./error":15,"./events":16,"./instanceFactory":18,"./log":19,"./mappingOperation":20,"./modelEvents":22,"./util":24,"argsarray":27,"extend":33}],22:[function(require,module,exports){
(function() {
  var events = require('./events'),
    InternalSiestaError = require('./error').InternalSiestaError,
    log = require('./log')('events'),
    extend = require('./util')._.extend,
    collectionRegistry = require('./collectionRegistry').CollectionRegistry;


  /**
   * Constants that describe change events.
   * Set => A new value is assigned to an attribute/relationship
   * Splice => All javascript array operations are described as splices.
   * Delete => Used in the case where objects are removed from an array, but array order is not known in advance.
   * Remove => Object deletion events
   * New => Object creation events
   * @type {Object}
   */
  var ModelEventType = {
    Set: 'set',
    Splice: 'splice',
    New: 'new',
    Remove: 'remove'
  };

  /**
   * Represents an individual change.
   * @param opts
   * @constructor
   */
  function ModelEvent(opts) {
    this._opts = opts || {};
    Object.keys(opts).forEach(function(k) {
      this[k] = opts[k];
    }.bind(this));
  }


  ModelEvent.prototype._dump = function(pretty) {
    var dumped = {};
    dumped.collection = (typeof this.collection) == 'string' ? this.collection : this.collection._dump();
    dumped.model = (typeof this.model) == 'string' ? this.model : this.model.name;
    dumped.localId = this.localId;
    dumped.field = this.field;
    dumped.type = this.type;
    if (this.index) dumped.index = this.index;
    if (this.added) dumped.added = _.map(this.added, function(x) {return x._dump()});
    if (this.removed) dumped.removed = _.map(this.removed, function(x) {return x._dump()});
    if (this.old) dumped.old = this.old;
    if (this.new) dumped.new = this.new;
    return pretty ? util.prettyPrint(dumped) : dumped;
  };

  function broadcastEvent(collectionName, modelName, opts) {
    var genericEvent = 'Siesta',
      collection = collectionRegistry[collectionName],
      model = collection[modelName];
    if (!collection) throw new InternalSiestaError('No such collection "' + collectionName + '"');
    if (!model) throw new InternalSiestaError('No such model "' + modelName + '"');
    var shouldEmit = opts.obj._emitEvents;
    // Don't emit pointless events.
    if (shouldEmit && 'new' in opts && 'old' in opts) {
      if (opts.new instanceof Date && opts.old instanceof Date) {
        shouldEmit = opts.new.getTime() != opts.old.getTime();
      }
      else {
        shouldEmit = opts.new != opts.old;
      }
    }
    if (shouldEmit) {
      events.emit(genericEvent, opts);
      if (siesta.installed) {
        var modelEvent = collectionName + ':' + modelName,
          localIdEvent = opts.localId;
        events.emit(collectionName, opts);
        events.emit(modelEvent, opts);
        events.emit(localIdEvent, opts);
      }
      if (model.id && opts.obj[model.id]) events.emit(collectionName + ':' + modelName + ':' + opts.obj[model.id], opts);
    }
  }

  function validateEventOpts(opts) {
    if (!opts.model) throw new InternalSiestaError('Must pass a model');
    if (!opts.collection) throw new InternalSiestaError('Must pass a collection');
    if (!opts.localId) throw new InternalSiestaError('Must pass a local identifier');
    if (!opts.obj) throw new InternalSiestaError('Must pass the object');
  }

  function emit(opts) {
    validateEventOpts(opts);
    var collection = opts.collection;
    var model = opts.model;
    var c = new ModelEvent(opts);
    broadcastEvent(collection, model, c);
    return c;
  }

  extend(exports, {
    ModelEvent: ModelEvent,
    emit: emit,
    validateEventOpts: validateEventOpts,
    ModelEventType: ModelEventType
  });
})();
},{"./collectionRegistry":14,"./error":15,"./events":16,"./log":19,"./util":24}],23:[function(require,module,exports){
(function() {
  var misc = require('./misc'),
    _ = require('./underscore');

  function doParallel(fn) {
    return function() {
      var args = Array.prototype.slice.call(arguments);
      return fn.apply(null, [each].concat(args));
    };
  }

  var map = doParallel(_asyncMap);

  var root;

  function _map(arr, iterator) {
    if (arr.map) {
      return arr.map(iterator);
    }
    var results = [];
    each(arr, function(x, i, a) {
      results.push(iterator(x, i, a));
    });
    return results;
  }

  function _asyncMap(eachfn, arr, iterator, callback) {
    arr = _map(arr, function(x, i) {
      return {
        index: i,
        value: x
      };
    });
    if (!callback) {
      eachfn(arr, function(x, callback) {
        iterator(x.value, function(err) {
          callback(err);
        });
      });
    } else {
      var results = [];
      eachfn(arr, function(x, callback) {
        iterator(x.value, function(err, v) {
          results[x.index] = v;
          callback(err);
        });
      }, function(err) {
        callback(err, results);
      });
    }
  }

  var mapSeries = doSeries(_asyncMap);

  function doSeries(fn) {
    return function() {
      var args = Array.prototype.slice.call(arguments);
      return fn.apply(null, [eachSeries].concat(args));
    };
  }


  function eachSeries(arr, iterator, callback) {
    callback = callback || function() {};
    if (!arr.length) {
      return callback();
    }
    var completed = 0;
    var iterate = function() {
      iterator(arr[completed], function(err) {
        if (err) {
          callback(err);
          callback = function() {};
        } else {
          completed += 1;
          if (completed >= arr.length) {
            callback();
          } else {
            iterate();
          }
        }
      });
    };
    iterate();
  }


  function _each(arr, iterator) {
    if (arr.forEach) {
      return arr.forEach(iterator);
    }
    for (var i = 0; i < arr.length; i += 1) {
      iterator(arr[i], i, arr);
    }
  }

  function each(arr, iterator, callback) {
    callback = callback || function() {};
    if (!arr.length) {
      return callback();
    }
    var completed = 0;
    _each(arr, function(x) {
      iterator(x, only_once(done));
    });

    function done(err) {
      if (err) {
        callback(err);
        callback = function() {};
      } else {
        completed += 1;
        if (completed >= arr.length) {
          callback();
        }
      }
    }
  }

  var _parallel = function(eachfn, tasks, callback) {
    callback = callback || function() {};
    if (misc.isArray(tasks)) {
      eachfn.map(tasks, function(fn, callback) {
        if (fn) {
          fn(function(err) {
            var args = Array.prototype.slice.call(arguments, 1);
            if (args.length <= 1) {
              args = args[0];
            }
            callback.call(null, err, args);
          });
        }
      }, callback);
    } else {
      var results = {};
      eachfn.each(Object.keys(tasks), function(k, callback) {
        tasks[k](function(err) {
          var args = Array.prototype.slice.call(arguments, 1);
          if (args.length <= 1) {
            args = args[0];
          }
          results[k] = args;
          callback(err);
        });
      }, function(err) {
        callback(err, results);
      });
    }
  };

  function series(tasks, callback) {
    callback = callback || function() {};
    if (misc.isArray(tasks)) {
      mapSeries(tasks, function(fn, callback) {
        if (fn) {
          fn(function(err) {
            var args = Array.prototype.slice.call(arguments, 1);
            if (args.length <= 1) {
              args = args[0];
            }
            callback.call(null, err, args);
          });
        }
      }, callback);
    } else {
      var results = {};
      eachSeries(_.keys(tasks), function(k, callback) {
        tasks[k](function(err) {
          var args = Array.prototype.slice.call(arguments, 1);
          if (args.length <= 1) {
            args = args[0];
          }
          results[k] = args;
          callback(err);
        });
      }, function(err) {
        callback(err, results);
      });
    }
  }

  function only_once(fn) {
    var called = false;
    return function() {
      if (called) throw new Error("Callback was already called.");
      called = true;
      fn.apply(root, arguments);
    }
  }

  function parallel(tasks, callback) {
    _parallel({
      map: map,
      each: each
    }, tasks, callback);
  }

  module.exports = {
    series: series,
    parallel: parallel
  };
})();
},{"./misc":25,"./underscore":26}],24:[function(require,module,exports){
/*
 * This is a collection of utilities taken from libraries such as async.js, underscore.js etc.
 * @module util
 */

(function () {
    var _ = require('./underscore'),
        async = require('./async'),
        misc = require('./misc');

    _.extend(module.exports, {
        _: _,
        async: async
    });
    _.extend(module.exports, misc);

})();
},{"./async":23,"./misc":25,"./underscore":26}],25:[function(require,module,exports){
(function() {
  var observe = require('../../vendor/observe-js/src/observe').Platform,
    _ = require('./underscore'),
    Promise = require('lie'),
    argsarray = require('argsarray'),
    InternalSiestaError = require('./../error').InternalSiestaError;

  // Used by paramNames function.
  var FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m,
    FN_ARG_SPLIT = /,/,
    FN_ARG = /^\s*(_?)(.+?)\1\s*$/,
    STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;

  function cb(callback, deferred) {
    return function(err) {
      if (callback) callback.apply(callback, arguments);
      if (deferred) {
        if (err) {
          deferred.reject(err);
        }
        else {
          deferred.resolve.apply(deferred, Array.prototype.slice.call(arguments, 1));
        }
      }
    };
  }

  var isArrayShim = function(obj) {
      return _.toString.call(obj) === '[object Array]';
    },
    isArray = Array.isArray || isArrayShim,
    isString = function(o) {
      return typeof o == 'string' || o instanceof String
    };
  _.extend(module.exports, {
    argsarray: argsarray,
    /**
     * Performs dirty check/Object.observe callbacks depending on the browser.
     *
     * If Object.observe is present,
     * @param callback
     */
    next: function(callback) {
      observe.performMicrotaskCheckpoint();
      setTimeout(callback);
    },
    /**
     * Returns a handler that acts upon a callback or a promise depending on the result of a different callback.
     * @param callback
     * @param [deferred]
     * @returns {Function}
     */
    cb: cb,
    guid: (function() {
      function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
          .toString(16)
          .substring(1);
      }

      return function() {
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
          s4() + '-' + s4() + s4() + s4();
      };
    })(),
    assert: function(condition, message, context) {
      if (!condition) {
        message = message || "Assertion failed";
        context = context || {};
        throw new InternalSiestaError(message, context);
      }
    },
    thenBy: (function() {
      /* mixin for the `thenBy` property */
      function extend(f) {
        f.thenBy = tb;
        return f;
      }

      /* adds a secondary compare function to the target function (`this` context)
       which is applied in case the first one returns 0 (equal)
       returns a new compare function, which has a `thenBy` method as well */
      function tb(y) {
        var x = this;
        return extend(function(a, b) {
          return x(a, b) || y(a, b);
        });
      }

      return extend;
    })(),
    defineSubProperty: function(property, subObj, innerProperty) {
      return Object.defineProperty(this, property, {
        get: function() {
          if (innerProperty) {
            return subObj[innerProperty];
          }
          else {
            return subObj[property];
          }
        },
        set: function(value) {
          if (innerProperty) {
            subObj[innerProperty] = value;
          }
          else {
            subObj[property] = value;
          }
        },
        enumerable: true,
        configurable: true
      });
    },
    defineSubPropertyNoSet: function(property, subObj, innerProperty) {
      return Object.defineProperty(this, property, {
        get: function() {
          if (innerProperty) {
            return subObj[innerProperty];
          }
          else {
            return subObj[property];
          }
        },
        enumerable: true,
        configurable: true
      });
    },
    /**
     * TODO: This is bloody ugly.
     * Pretty damn useful to be able to access the bound object on a function tho.
     * See: http://stackoverflow.com/questions/14307264/what-object-javascript-function-is-bound-to-what-is-its-this
     */
    _patchBind: function() {
      var _bind = Function.prototype.apply.bind(Function.prototype.bind);
      Object.defineProperty(Function.prototype, 'bind', {
        value: function(obj) {
          var boundFunction = _bind(this, arguments);
          Object.defineProperty(boundFunction, '__siesta_bound_object', {
            value: obj,
            writable: true,
            configurable: true,
            enumerable: false
          });
          return boundFunction;
        }
      });
    },
    Promise: Promise,
    promise: function(cb, fn) {
      cb = cb || function() {};
      return new Promise(function(resolve, reject) {
        var _cb = argsarray(function(args) {
          var err = args[0],
            rest = args.slice(1);
          if (err) {
            try {
              reject(err);
            }
            catch (e) {
              console.error('Uncaught error during promise rejection', e);
            }
          }
          else {
            try {
              resolve(rest[0]);
            }
            catch (e) {
              try {
                reject(e);
              }
              catch (e) {
                console.error('Uncaught error during promise rejection', e);
              }
            }
          }
          var bound = cb['__siesta_bound_object'] || cb; // Preserve bound object.
          cb.apply(bound, args);
        });
        fn(_cb);
      })
    },
    subProperties: function(obj, subObj, properties) {
      if (!isArray(properties)) {
        properties = Array.prototype.slice.call(arguments, 2);
      }
      for (var i = 0; i < properties.length; i++) {
        (function(property) {
          var opts = {
            set: false,
            name: property,
            property: property
          };
          if (!isString(property)) {
            _.extend(opts, property);
          }
          var desc = {
            get: function() {
              return subObj[opts.property];
            },
            enumerable: true,
            configurable: true
          };
          if (opts.set) {
            desc.set = function(v) {
              subObj[opts.property] = v;
            };
          }
          Object.defineProperty(obj, opts.name, desc);
        })(properties[i]);
      }
    },
    capitaliseFirstLetter: function(string) {
      return string.charAt(0).toUpperCase() + string.slice(1);
    },
    extendFromOpts: function(obj, opts, defaults, errorOnUnknown) {
      errorOnUnknown = errorOnUnknown == undefined ? true : errorOnUnknown;
      if (errorOnUnknown) {
        var defaultKeys = Object.keys(defaults),
          optsKeys = Object.keys(opts);
        var unknownKeys = optsKeys.filter(function(n) {
          return defaultKeys.indexOf(n) == -1
        });
        if (unknownKeys.length) throw Error('Unknown options: ' + unknownKeys.toString());
      }
      // Apply any functions specified in the defaults.
      _.each(Object.keys(defaults), function(k) {
        var d = defaults[k];
        if (typeof d == 'function') {
          defaults[k] = d(opts[k]);
          delete opts[k];
        }
      });
      _.extend(defaults, opts);
      _.extend(obj, defaults);
    },
    isString: isString,
    isArray: isArray,
    prettyPrint: function(o) {
      return JSON.stringify(o, null, 4);
    },
    flattenArray: function(arr) {
      return _.reduce(arr, function(memo, e) {
        if (isArray(e)) {
          memo = memo.concat(e);
        } else {
          memo.push(e);
        }
        return memo;
      }, []);
    },
    unflattenArray: function(arr, modelArr) {
      var n = 0;
      var unflattened = [];
      for (var i = 0; i < modelArr.length; i++) {
        if (isArray(modelArr[i])) {
          var newArr = [];
          unflattened[i] = newArr;
          for (var j = 0; j < modelArr[i].length; j++) {
            newArr.push(arr[n]);
            n++;
          }
        } else {
          unflattened[i] = arr[n];
          n++;
        }
      }
      return unflattened;
    },
    /**
     * Return the parameter names of a function.
     * Note: adapted from AngularJS dependency injection :)
     * @param fn
     */
    paramNames: function(fn) {
      // TODO: Is there a more robust way of doing this?
      var params = [],
        fnText,
        argDecl;
      fnText = fn.toString().replace(STRIP_COMMENTS, '');
      argDecl = fnText.match(FN_ARGS);

      argDecl[1].split(FN_ARG_SPLIT).forEach(function(arg) {
        arg.replace(FN_ARG, function(all, underscore, name) {
          params.push(name);
        });
      });
      return params;
    }
  });
})();
},{"../../vendor/observe-js/src/observe":53,"./../error":15,"./underscore":26,"argsarray":27,"lie":37}],26:[function(require,module,exports){
/**
 * Often used functions from underscore, pulled out for brevity.
 * @module underscore
 */

(function () {
    var _ = {},
        ArrayProto = Array.prototype,
        FuncProto = Function.prototype,
        nativeForEach = ArrayProto.forEach,
        nativeMap = ArrayProto.map,
        nativeReduce = ArrayProto.reduce,
        nativeBind = FuncProto.bind,
        slice = ArrayProto.slice,
        breaker = {},
        ctor = function () {
        };

    function keys(obj) {
        if (Object.keys) {
            return Object.keys(obj);
        }
        var keys = [];
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) {
                keys.push(k);
            }
        }
        return keys;
    }

    _.keys = keys;

    _.each = _.forEach = function (obj, iterator, context) {
        if (obj == null) return obj;
        if (nativeForEach && obj.forEach === nativeForEach) {
            obj.forEach(iterator, context);
        } else if (obj.length === +obj.length) {
            for (var i = 0, length = obj.length; i < length; i++) {
                if (iterator.call(context, obj[i], i, obj) === breaker) return;
            }
        } else {
            var keys = _.keys(obj);
            for (var i = 0, length = keys.length; i < length; i++) {
                if (iterator.call(context, obj[keys[i]], keys[i], obj) === breaker) return;
            }
        }
        return obj;
    };

    // Return the results of applying the iterator to each element.
    // Delegates to **ECMAScript 5**'s native `map` if available.
    _.map = _.collect = function (obj, iterator, context) {
        var results = [];
        if (obj == null) return results;
        if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);
        _.each(obj, function (value, index, list) {
            results.push(iterator.call(context, value, index, list));
        });
        return results;
    };

    // Internal function that returns an efficient (for current engines) version
    // of the passed-in callback, to be repeatedly applied in other Underscore
    // functions.
    var createCallback = function (func, context, argCount) {
        if (context === void 0) return func;
        switch (argCount == null ? 3 : argCount) {
            case 1:
                return function (value) {
                    return func.call(context, value);
                };
            case 2:
                return function (value, other) {
                    return func.call(context, value, other);
                };
            case 3:
                return function (value, index, collection) {
                    return func.call(context, value, index, collection);
                };
            case 4:
                return function (accumulator, value, index, collection) {
                    return func.call(context, accumulator, value, index, collection);
                };
        }
        return function () {
            return func.apply(context, arguments);
        };
    };

    // Run a function **n** times.
    _.times = function (n, iteratee, context) {
        var accum = new Array(Math.max(0, n));
        iteratee = createCallback(iteratee, context, 1);
        for (var i = 0; i < n; i++) accum[i] = iteratee(i);
        return accum;
    };

    // Partially apply a function by creating a version that has had some of its
    // arguments pre-filled, without changing its dynamic `this` context. _ acts
    // as a placeholder, allowing any combination of arguments to be pre-filled.
    _.partial = function (func) {
        var boundArgs = slice.call(arguments, 1);
        return function () {
            var position = 0;
            var args = boundArgs.slice();
            for (var i = 0, length = args.length; i < length; i++) {
                if (args[i] === _) args[i] = arguments[position++];
            }
            while (position < arguments.length) args.push(arguments[position++]);
            return func.apply(this, args);
        };
    };

    // Convenience version of a common use case of `map`: fetching a property.
    _.pluck = function (obj, key) {
        return _.map(obj, _.property(key));
    };

    var reduceError = 'Reduce of empty array with no initial value';

    // **Reduce** builds up a single result from a list of values, aka `inject`,
    // or `foldl`. Delegates to **ECMAScript 5**'s native `reduce` if available.
    _.reduce = _.foldl = _.inject = function (obj, iterator, memo, context) {
        var initial = arguments.length > 2;
        if (obj == null) obj = [];
        if (nativeReduce && obj.reduce === nativeReduce) {
            if (context) iterator = _.bind(iterator, context);
            return initial ? obj.reduce(iterator, memo) : obj.reduce(iterator);
        }
        _.each(obj, function (value, index, list) {
            if (!initial) {
                memo = value;
                initial = true;
            } else {
                memo = iterator.call(context, memo, value, index, list);
            }
        });
        if (!initial) throw new TypeError(reduceError);
        return memo;
    };

    _.property = function (key) {
        return function (obj) {
            return obj[key];
        };
    };

    // Optimize `isFunction` if appropriate.
    if (typeof(/./) !== 'function') {
        _.isFunction = function (obj) {
            return typeof obj === 'function';
        };
    }

    _.isObject = function (obj) {
        var type = typeof obj;
        return type === 'function' || type === 'object' && !!obj;
    };

    // An internal function to generate lookup iterators.
    var lookupIterator = function (value) {
        if (value == null) return _.identity;
        if (_.isFunction(value)) return value;
        return _.property(value);
    };

    // Sort the object's values by a criterion produced by an iterator.
    _.sortBy = function (obj, iterator, context) {
        iterator = lookupIterator(iterator);
        return _.pluck(_.map(obj, function (value, index, list) {
            return {
                value: value,
                index: index,
                criteria: iterator.call(context, value, index, list)
            };
        }).sort(function (left, right) {
            var a = left.criteria;
            var b = right.criteria;
            if (a !== b) {
                if (a > b || a === void 0) return 1;
                if (a < b || b === void 0) return -1;
            }
            return left.index - right.index;
        }), 'value');
    };


    // Create a function bound to a given object (assigning `this`, and arguments,
    // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
    // available.
    _.bind = function (func, context) {
        var args, bound;
        if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
        if (!_.isFunction(func)) throw new TypeError;
        args = slice.call(arguments, 2);
        return bound = function () {
            if (!(this instanceof bound)) return func.apply(context, args.concat(slice.call(arguments)));
            ctor.prototype = func.prototype;
            var self = new ctor;
            ctor.prototype = null;
            u
            var result = func.apply(self, args.concat(slice.call(arguments)));
            if (Object(result) === result) return result;
            return self;
        };
    };

    _.identity = function (value) {
        return value;
    };

    _.zip = function (array) {
        if (array == null) return [];
        var length = _.max(arguments, 'length').length;
        var results = Array(length);
        for (var i = 0; i < length; i++) {
            results[i] = _.pluck(arguments, i);
        }
        return results;
    };

    // Return the maximum element (or element-based computation).
    _.max = function (obj, iteratee, context) {
        var result = -Infinity,
            lastComputed = -Infinity,
            value, computed;
        if (iteratee == null && obj != null) {
            obj = obj.length === +obj.length ? obj : _.values(obj);
            for (var i = 0, length = obj.length; i < length; i++) {
                value = obj[i];
                if (value > result) {
                    result = value;
                }
            }
        } else {
            iteratee = _.iteratee(iteratee, context);
            _.each(obj, function (value, index, list) {
                computed = iteratee(value, index, list);
                if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
                    result = value;
                    lastComputed = computed;
                }
            });
        }
        return result;
    };


    _.iteratee = function (value, context, argCount) {
        if (value == null) return _.identity;
        if (_.isFunction(value)) return createCallback(value, context, argCount);
        if (_.isObject(value)) return _.matches(value);
        return _.property(value);
    };

    _.pairs = function (obj) {
        var keys = _.keys(obj);
        var length = keys.length;
        var pairs = Array(length);
        for (var i = 0; i < length; i++) {
            pairs[i] = [keys[i], obj[keys[i]]];
        }
        return pairs;
    };

    _.matches = function (attrs) {
        var pairs = _.pairs(attrs),
            length = pairs.length;
        return function (obj) {
            if (obj == null) return !length;
            obj = new Object(obj);
            for (var i = 0; i < length; i++) {
                var pair = pairs[i],
                    key = pair[0];
                if (pair[1] !== obj[key] || !(key in obj)) return false;
            }
            return true;
        };
    };

    _.some = function (obj, predicate, context) {
        if (obj == null) return false;
        predicate = _.iteratee(predicate, context);
        var keys = obj.length !== +obj.length && _.keys(obj),
            length = (keys || obj).length,
            index, currentKey;
        for (index = 0; index < length; index++) {
            currentKey = keys ? keys[index] : index;
            if (predicate(obj[currentKey], currentKey, obj)) return true;
        }
        return false;
    };


    // Extend a given object with all the properties in passed-in object(s).
    _.extend = function (obj) {
        if (!_.isObject(obj)) return obj;
        var source, prop;
        for (var i = 1, length = arguments.length; i < length; i++) {
            source = arguments[i];
            for (prop in source) {
                //noinspection JSUnfilteredForInLoop
                if (hasOwnProperty.call(source, prop)) {
                    //noinspection JSUnfilteredForInLoop
                    obj[prop] = source[prop];
                }
            }
        }
        return obj;
    };

    module.exports = _;
})();
},{}],27:[function(require,module,exports){
'use strict';

module.exports = argsArray;

function argsArray(fun) {
  return function () {
    var len = arguments.length;
    if (len) {
      var args = [];
      var i = -1;
      while (++i < len) {
        args[i] = arguments[i];
      }
      return fun.call(this, args);
    } else {
      return fun.call(this, []);
    }
  };
}
},{}],28:[function(require,module,exports){

},{}],29:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],30:[function(require,module,exports){

/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = require('./debug');
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;

/**
 * Use chrome.storage.local if we are in an app
 */

var storage;

if (typeof chrome !== 'undefined' && typeof chrome.storage !== 'undefined')
  storage = chrome.storage.local;
else
  storage = window.localStorage;

/**
 * Colors.
 */

exports.colors = [
  'lightseagreen',
  'forestgreen',
  'goldenrod',
  'dodgerblue',
  'darkorchid',
  'crimson'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // is webkit? http://stackoverflow.com/a/16459606/376773
  return ('WebkitAppearance' in document.documentElement.style) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (window.console && (console.firebug || (console.exception && console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31);
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  return JSON.stringify(v);
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs() {
  var args = arguments;
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return args;

  var c = 'color: ' + this.color;
  args = [args[0], c, 'color: inherit'].concat(Array.prototype.slice.call(args, 1));

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
  return args;
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  // this hackery is required for IE8/9, where
  // the `console.log` function doesn't have 'apply'
  return 'object' === typeof console
    && console.log
    && Function.prototype.apply.call(console.log, console, arguments);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      storage.removeItem('debug');
    } else {
      storage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    r = storage.debug;
  } catch(e) {}
  return r;
}

/**
 * Enable namespaces listed in `localStorage.debug` initially.
 */

exports.enable(load());

},{"./debug":31}],31:[function(require,module,exports){

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = debug;
exports.coerce = coerce;
exports.disable = disable;
exports.enable = enable;
exports.enabled = enabled;
exports.humanize = require('ms');

/**
 * The currently active debug mode names, and names to skip.
 */

exports.names = [];
exports.skips = [];

/**
 * Map of special "%n" handling functions, for the debug "format" argument.
 *
 * Valid key names are a single, lowercased letter, i.e. "n".
 */

exports.formatters = {};

/**
 * Previously assigned color.
 */

var prevColor = 0;

/**
 * Previous log timestamp.
 */

var prevTime;

/**
 * Select a color.
 *
 * @return {Number}
 * @api private
 */

function selectColor() {
  return exports.colors[prevColor++ % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function debug(namespace) {

  // define the `disabled` version
  function disabled() {
  }
  disabled.enabled = false;

  // define the `enabled` version
  function enabled() {

    var self = enabled;

    // set `diff` timestamp
    var curr = +new Date();
    var ms = curr - (prevTime || curr);
    self.diff = ms;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // add the `color` if not set
    if (null == self.useColors) self.useColors = exports.useColors();
    if (null == self.color && self.useColors) self.color = selectColor();

    var args = Array.prototype.slice.call(arguments);

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %o
      args = ['%o'].concat(args);
    }

    // apply any `formatters` transformations
    var index = 0;
    args[0] = args[0].replace(/%([a-z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    });

    if ('function' === typeof exports.formatArgs) {
      args = exports.formatArgs.apply(self, args);
    }
    var logFn = enabled.log || exports.log || console.log.bind(console);
    logFn.apply(self, args);
  }
  enabled.enabled = true;

  var fn = exports.enabled(namespace) ? enabled : disabled;

  fn.namespace = namespace;

  return fn;
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */

function enable(namespaces) {
  exports.save(namespaces);

  var split = (namespaces || '').split(/[\s,]+/);
  var len = split.length;

  for (var i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
  }
}

/**
 * Disable debug output.
 *
 * @api public
 */

function disable() {
  exports.enable('');
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

function enabled(name) {
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Coerce `val`.
 *
 * @param {Mixed} val
 * @return {Mixed}
 * @api private
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}

},{"ms":32}],32:[function(require,module,exports){
/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} options
 * @return {String|Number}
 * @api public
 */

module.exports = function(val, options){
  options = options || {};
  if ('string' == typeof val) return parse(val);
  return options.long
    ? long(val)
    : short(val);
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  var match = /^((?:\d+)?\.?\d+) *(ms|seconds?|s|minutes?|m|hours?|h|days?|d|years?|y)?$/i.exec(str);
  if (!match) return;
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'y':
      return n * y;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 's':
      return n * s;
    case 'ms':
      return n;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function short(ms) {
  if (ms >= d) return Math.round(ms / d) + 'd';
  if (ms >= h) return Math.round(ms / h) + 'h';
  if (ms >= m) return Math.round(ms / m) + 'm';
  if (ms >= s) return Math.round(ms / s) + 's';
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function long(ms) {
  return plural(ms, d, 'day')
    || plural(ms, h, 'hour')
    || plural(ms, m, 'minute')
    || plural(ms, s, 'second')
    || ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, n, name) {
  if (ms < n) return;
  if (ms < n * 1.5) return Math.floor(ms / n) + ' ' + name;
  return Math.ceil(ms / n) + ' ' + name + 's';
}

},{}],33:[function(require,module,exports){
var hasOwn = Object.prototype.hasOwnProperty;
var toString = Object.prototype.toString;
var undefined;

var isPlainObject = function isPlainObject(obj) {
    "use strict";
    if (!obj || toString.call(obj) !== '[object Object]' || obj.nodeType || obj.setInterval) {
        return false;
    }

    var has_own_constructor = hasOwn.call(obj, 'constructor');
    var has_is_property_of_method = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
    // Not own constructor property must be Object
    if (obj.constructor && !has_own_constructor && !has_is_property_of_method) {
        return false;
    }

    // Own properties are enumerated firstly, so to speed up,
    // if last one is own, then all properties are own.
    var key;
    for (key in obj) {}

    return key === undefined || hasOwn.call(obj, key);
};

module.exports = function extend() {
    "use strict";
    var options, name, src, copy, copyIsArray, clone,
        target = arguments[0],
        i = 1,
        length = arguments.length,
        deep = false;

    // Handle a deep copy situation
    if (typeof target === "boolean") {
        deep = target;
        target = arguments[1] || {};
        // skip the boolean and the target
        i = 2;
    } else if (typeof target !== "object" && typeof target !== "function" || target == undefined) {
        target = {};
    }

    for (; i < length; ++i) {
        // Only deal with non-null/undefined values
        if ((options = arguments[i]) != null) {
            // Extend the base object
            for (name in options) {
                src = target[name];
                copy = options[name];

                // Prevent never-ending loop
                if (target === copy) {
                    continue;
                }

                // Recurse if we're merging plain objects or arrays
                if (deep && copy && (isPlainObject(copy) || (copyIsArray = Array.isArray(copy)))) {
                    if (copyIsArray) {
                        copyIsArray = false;
                        clone = src && Array.isArray(src) ? src : [];
                    } else {
                        clone = src && isPlainObject(src) ? src : {};
                    }

                    // Never move original objects, clone them
                    target[name] = extend(deep, clone, copy);

                    // Don't bring in undefined values
                } else if (copy !== undefined) {
                    target[name] = copy;
                }
            }
        }
    }

    // Return the modified object
    return target;
};


},{}],34:[function(require,module,exports){
'use strict';

module.exports = INTERNAL;

function INTERNAL() {}
},{}],35:[function(require,module,exports){
'use strict';
var Promise = require('./promise');
var reject = require('./reject');
var resolve = require('./resolve');
var INTERNAL = require('./INTERNAL');
var handlers = require('./handlers');
module.exports = all;
function all(iterable) {
  if (Object.prototype.toString.call(iterable) !== '[object Array]') {
    return reject(new TypeError('must be an array'));
  }

  var len = iterable.length;
  var called = false;
  if (!len) {
    return resolve([]);
  }

  var values = new Array(len);
  var resolved = 0;
  var i = -1;
  var promise = new Promise(INTERNAL);
  
  while (++i < len) {
    allResolver(iterable[i], i);
  }
  return promise;
  function allResolver(value, i) {
    resolve(value).then(resolveFromAll, function (error) {
      if (!called) {
        called = true;
        handlers.reject(promise, error);
      }
    });
    function resolveFromAll(outValue) {
      values[i] = outValue;
      if (++resolved === len & !called) {
        called = true;
        handlers.resolve(promise, values);
      }
    }
  }
}
},{"./INTERNAL":34,"./handlers":36,"./promise":38,"./reject":41,"./resolve":42}],36:[function(require,module,exports){
'use strict';
var tryCatch = require('./tryCatch');
var resolveThenable = require('./resolveThenable');
var states = require('./states');

exports.resolve = function (self, value) {
  var result = tryCatch(getThen, value);
  if (result.status === 'error') {
    return exports.reject(self, result.value);
  }
  var thenable = result.value;

  if (thenable) {
    resolveThenable.safely(self, thenable);
  } else {
    self.state = states.FULFILLED;
    self.outcome = value;
    var i = -1;
    var len = self.queue.length;
    while (++i < len) {
      self.queue[i].callFulfilled(value);
    }
  }
  return self;
};
exports.reject = function (self, error) {
  self.state = states.REJECTED;
  self.outcome = error;
  var i = -1;
  var len = self.queue.length;
  while (++i < len) {
    self.queue[i].callRejected(error);
  }
  return self;
};

function getThen(obj) {
  // Make sure we only access the accessor once as required by the spec
  var then = obj && obj.then;
  if (obj && typeof obj === 'object' && typeof then === 'function') {
    return function appyThen() {
      then.apply(obj, arguments);
    };
  }
}
},{"./resolveThenable":43,"./states":44,"./tryCatch":45}],37:[function(require,module,exports){
module.exports = exports = require('./promise');

exports.resolve = require('./resolve');
exports.reject = require('./reject');
exports.all = require('./all');
exports.race = require('./race');
},{"./all":35,"./promise":38,"./race":40,"./reject":41,"./resolve":42}],38:[function(require,module,exports){
'use strict';

var unwrap = require('./unwrap');
var INTERNAL = require('./INTERNAL');
var resolveThenable = require('./resolveThenable');
var states = require('./states');
var QueueItem = require('./queueItem');

module.exports = Promise;
function Promise(resolver) {
  if (!(this instanceof Promise)) {
    return new Promise(resolver);
  }
  if (typeof resolver !== 'function') {
    throw new TypeError('resolver must be a function');
  }
  this.state = states.PENDING;
  this.queue = [];
  this.outcome = void 0;
  if (resolver !== INTERNAL) {
    resolveThenable.safely(this, resolver);
  }
}

Promise.prototype['catch'] = function (onRejected) {
  return this.then(null, onRejected);
};
Promise.prototype.then = function (onFulfilled, onRejected) {
  if (typeof onFulfilled !== 'function' && this.state === states.FULFILLED ||
    typeof onRejected !== 'function' && this.state === states.REJECTED) {
    return this;
  }
  var promise = new Promise(INTERNAL);

  
  if (this.state !== states.PENDING) {
    var resolver = this.state === states.FULFILLED ? onFulfilled: onRejected;
    unwrap(promise, resolver, this.outcome);
  } else {
    this.queue.push(new QueueItem(promise, onFulfilled, onRejected));
  }

  return promise;
};

},{"./INTERNAL":34,"./queueItem":39,"./resolveThenable":43,"./states":44,"./unwrap":46}],39:[function(require,module,exports){
'use strict';
var handlers = require('./handlers');
var unwrap = require('./unwrap');

module.exports = QueueItem;
function QueueItem(promise, onFulfilled, onRejected) {
  this.promise = promise;
  if (typeof onFulfilled === 'function') {
    this.onFulfilled = onFulfilled;
    this.callFulfilled = this.otherCallFulfilled;
  }
  if (typeof onRejected === 'function') {
    this.onRejected = onRejected;
    this.callRejected = this.otherCallRejected;
  }
}
QueueItem.prototype.callFulfilled = function (value) {
  handlers.resolve(this.promise, value);
};
QueueItem.prototype.otherCallFulfilled = function (value) {
  unwrap(this.promise, this.onFulfilled, value);
};
QueueItem.prototype.callRejected = function (value) {
  handlers.reject(this.promise, value);
};
QueueItem.prototype.otherCallRejected = function (value) {
  unwrap(this.promise, this.onRejected, value);
};
},{"./handlers":36,"./unwrap":46}],40:[function(require,module,exports){
'use strict';
var Promise = require('./promise');
var reject = require('./reject');
var resolve = require('./resolve');
var INTERNAL = require('./INTERNAL');
var handlers = require('./handlers');
module.exports = race;
function race(iterable) {
  if (Object.prototype.toString.call(iterable) !== '[object Array]') {
    return reject(new TypeError('must be an array'));
  }

  var len = iterable.length;
  var called = false;
  if (!len) {
    return resolve([]);
  }

  var resolved = 0;
  var i = -1;
  var promise = new Promise(INTERNAL);
  
  while (++i < len) {
    resolver(iterable[i]);
  }
  return promise;
  function resolver(value) {
    resolve(value).then(function (response) {
      if (!called) {
        called = true;
        handlers.resolve(promise, response);
      }
    }, function (error) {
      if (!called) {
        called = true;
        handlers.reject(promise, error);
      }
    });
  }
}
},{"./INTERNAL":34,"./handlers":36,"./promise":38,"./reject":41,"./resolve":42}],41:[function(require,module,exports){
'use strict';

var Promise = require('./promise');
var INTERNAL = require('./INTERNAL');
var handlers = require('./handlers');
module.exports = reject;

function reject(reason) {
	var promise = new Promise(INTERNAL);
	return handlers.reject(promise, reason);
}
},{"./INTERNAL":34,"./handlers":36,"./promise":38}],42:[function(require,module,exports){
'use strict';

var Promise = require('./promise');
var INTERNAL = require('./INTERNAL');
var handlers = require('./handlers');
module.exports = resolve;

var FALSE = handlers.resolve(new Promise(INTERNAL), false);
var NULL = handlers.resolve(new Promise(INTERNAL), null);
var UNDEFINED = handlers.resolve(new Promise(INTERNAL), void 0);
var ZERO = handlers.resolve(new Promise(INTERNAL), 0);
var EMPTYSTRING = handlers.resolve(new Promise(INTERNAL), '');

function resolve(value) {
  if (value) {
    if (value instanceof Promise) {
      return value;
    }
    return handlers.resolve(new Promise(INTERNAL), value);
  }
  var valueType = typeof value;
  switch (valueType) {
    case 'boolean':
      return FALSE;
    case 'undefined':
      return UNDEFINED;
    case 'object':
      return NULL;
    case 'number':
      return ZERO;
    case 'string':
      return EMPTYSTRING;
  }
}
},{"./INTERNAL":34,"./handlers":36,"./promise":38}],43:[function(require,module,exports){
'use strict';
var handlers = require('./handlers');
var tryCatch = require('./tryCatch');
function safelyResolveThenable(self, thenable) {
  // Either fulfill, reject or reject with error
  var called = false;
  function onError(value) {
    if (called) {
      return;
    }
    called = true;
    handlers.reject(self, value);
  }

  function onSuccess(value) {
    if (called) {
      return;
    }
    called = true;
    handlers.resolve(self, value);
  }

  function tryToUnwrap() {
    thenable(onSuccess, onError);
  }
  
  var result = tryCatch(tryToUnwrap);
  if (result.status === 'error') {
    onError(result.value);
  }
}
exports.safely = safelyResolveThenable;
},{"./handlers":36,"./tryCatch":45}],44:[function(require,module,exports){
// Lazy man's symbols for states

exports.REJECTED = ['REJECTED'];
exports.FULFILLED = ['FULFILLED'];
exports.PENDING = ['PENDING'];
},{}],45:[function(require,module,exports){
'use strict';

module.exports = tryCatch;

function tryCatch(func, value) {
  var out = {};
  try {
    out.value = func(value);
    out.status = 'success';
  } catch (e) {
    out.status = 'error';
    out.value = e;
  }
  return out;
}
},{}],46:[function(require,module,exports){
'use strict';

var immediate = require('immediate');
var handlers = require('./handlers');
module.exports = unwrap;

function unwrap(promise, func, value) {
  immediate(function() {
    var returnValue;
    try {
      returnValue = func(value);
    } catch (e) {
      var handler = handlers.reject(promise, e);
      if (!handler.queue.length) {
        // Ensure that errors are not completely swallowed.
        console.error(e);
        console.error('Unhandled error in promise chain', {
          error: e,
          func: func,
          value: value,
          funcAsString: func.toString()
        });
      }
      return handler;
    }
    if (returnValue === promise) {
      handlers.reject(promise, new TypeError('Cannot resolve promise with itself'));
    } else {
      handlers.resolve(promise, returnValue);
    }
  });
}
},{"./handlers":36,"immediate":47}],47:[function(require,module,exports){
'use strict';
var types = [
  require('./nextTick'),
  require('./mutation.js'),
  require('./messageChannel'),
  require('./stateChange'),
  require('./timeout')
];
var draining;
var queue = [];
//named nextTick for less confusing stack traces
function nextTick() {
  draining = true;
  var i, oldQueue;
  var len = queue.length;
  while (len) {
    oldQueue = queue;
    queue = [];
    i = -1;
    while (++i < len) {
      oldQueue[i]();
    }
    len = queue.length;
  }
  draining = false;
}
var scheduleDrain;
var i = -1;
var len = types.length;
while (++ i < len) {
  if (types[i] && types[i].test && types[i].test()) {
    scheduleDrain = types[i].install(nextTick);
    break;
  }
}
module.exports = immediate;
function immediate(task) {
  if (queue.push(task) === 1 && !draining) {
    scheduleDrain();
  }
}
},{"./messageChannel":48,"./mutation.js":49,"./nextTick":28,"./stateChange":50,"./timeout":51}],48:[function(require,module,exports){
(function (global){
'use strict';

exports.test = function () {
  if (global.setImmediate) {
    // we can only get here in IE10
    // which doesn't handel postMessage well
    return false;
  }
  return typeof global.MessageChannel !== 'undefined';
};

exports.install = function (func) {
  var channel = new global.MessageChannel();
  channel.port1.onmessage = func;
  return function () {
    channel.port2.postMessage(0);
  };
};
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],49:[function(require,module,exports){
(function (global){
'use strict';
//based off rsvp https://github.com/tildeio/rsvp.js
//license https://github.com/tildeio/rsvp.js/blob/master/LICENSE
//https://github.com/tildeio/rsvp.js/blob/master/lib/rsvp/asap.js

var Mutation = global.MutationObserver || global.WebKitMutationObserver;

exports.test = function () {
  return Mutation;
};

exports.install = function (handle) {
  var called = 0;
  var observer = new Mutation(handle);
  var element = global.document.createTextNode('');
  observer.observe(element, {
    characterData: true
  });
  return function () {
    element.data = (called = ++called % 2);
  };
};
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],50:[function(require,module,exports){
(function (global){
'use strict';

exports.test = function () {
  return 'document' in global && 'onreadystatechange' in global.document.createElement('script');
};

exports.install = function (handle) {
  return function () {

    // Create a <script> element; its readystatechange event will be fired asynchronously once it is inserted
    // into the document. Do so, thus queuing up the task. Remember to clean up once it's been called.
    var scriptEl = global.document.createElement('script');
    scriptEl.onreadystatechange = function () {
      handle();

      scriptEl.onreadystatechange = null;
      scriptEl.parentNode.removeChild(scriptEl);
      scriptEl = null;
    };
    global.document.documentElement.appendChild(scriptEl);

    return handle;
  };
};
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],51:[function(require,module,exports){
'use strict';
exports.test = function () {
  return true;
};

exports.install = function (t) {
  return function () {
    setTimeout(t, 0);
  };
};
},{}],52:[function(require,module,exports){
(function() {
  if (typeof siesta == 'undefined' && typeof module == 'undefined') {
    throw new Error('Could not find window.siesta. Make sure you include siesta.core.js first.');
  }

  var _i = siesta._internal,
    cache = _i.cache,
    CollectionRegistry = _i.CollectionRegistry,
    log = _i.log('storage'),
    error = _i.error,
    util = _i.util,
    _ = util._,
    events = _i.events;

  var unsavedObjects = [],
    unsavedObjectsHash = {},
    unsavedObjectsByCollection = {};

  var storage = {};

  // Variables beginning with underscore are treated as special by PouchDB/CouchDB so when serialising we need to
  // replace with something else.
  var UNDERSCORE = /_/g,
    UNDERSCORE_REPLACEMENT = /@/g;

  function _initMeta() {
    return {dateFields: []};
  }

  function fullyQualifiedModelName(collectionName, modelName) {
    return collectionName + '.' + modelName;
  }

  if (typeof PouchDB == 'undefined') {
    siesta.ext.storageEnabled = false;
    console.log('PouchDB is not present therefore storage is disabled.');
  }
  else {
    var DB_NAME = 'siesta',
      pouch = new PouchDB(DB_NAME, {auto_compaction: true});

    /**
     * Sometimes siesta needs to store some extra information about the model instance.
     * @param serialised
     * @private
     */
    function _addMeta(serialised) {
      // PouchDB <= 3.2.1 has a bug whereby date fields are not deserialised properly if you use db.query
      // therefore we need to add extra info to the object for deserialising dates manually.
      serialised.siesta_meta = _initMeta();
      for (var prop in serialised) {
        if (serialised.hasOwnProperty(prop)) {
          if (serialised[prop] instanceof Date) {
            serialised.siesta_meta.dateFields.push(prop);
            serialised[prop] = serialised[prop].getTime();
          }
        }
      }
    }

    function _processMeta(datum) {
      var meta = datum.siesta_meta || _initMeta();
      meta.dateFields.forEach(function(dateField) {
        var value = datum[dateField];
        if (!(value instanceof Date)) {
          datum[dateField] = new Date(value);
        }
      });
      delete datum.siesta_meta;
    }

    function constructIndexDesignDoc(collectionName, modelName) {
      var fullyQualifiedName = fullyQualifiedModelName(collectionName, modelName);
      var views = {};
      views[fullyQualifiedName] = {
        map: function(doc) {
          if (doc.collection == '$1' && doc.model == '$2') emit(doc.collection + '.' + doc.model, doc);
        }.toString().replace('$1', collectionName).replace('$2', modelName)
      };
      return {
        _id: '_design/' + fullyQualifiedName,
        views: views
      };
    }

    function constructIndexesForAllModels() {
      var indexes = [];
      var registry = siesta._internal.CollectionRegistry;
      registry.collectionNames.forEach(function(collectionName) {
        var models = registry[collectionName]._models;
        for (var modelName in models) {
          if (models.hasOwnProperty(modelName)) {
            indexes.push(constructIndexDesignDoc(collectionName, modelName));
          }
        }
      });
      return indexes;
    }

    function __ensureIndexes(indexes, cb) {
      pouch.bulkDocs(indexes)
        .then(function(resp) {
          var errors = [];
          for (var i = 0; i < resp.length; i++) {
            var response = resp[i];
            if (!response.ok) {
              // Conflict means already exists, and this is fine!
              var isConflict = response.status == 409;
              if (!isConflict) errors.push(response);
            }
          }
          cb(errors.length ? error('multiple errors', {errors: errors}) : null);
        })
        .catch(cb);
    }

    function ensureIndexesForAll(cb) {
      var indexes = constructIndexesForAllModels();
      __ensureIndexes(indexes, cb);
    }

    /**
     * Serialise a model into a format that PouchDB bulkDocs API can process
     * @param {ModelInstance} modelInstance
     */
    function _serialise(modelInstance) {
      var serialised = {};
      var __values = modelInstance.__values;
      serialised = siesta._.extend(serialised, __values);
      Object.keys(serialised).forEach(function(k) {
        serialised[k.replace(UNDERSCORE, '@')] = __values[k];
      });
      _addMeta(serialised);
      serialised['collection'] = modelInstance.collectionName;
      serialised['model'] = modelInstance.modelName;
      serialised['_id'] = modelInstance.localId;
      if (modelInstance.removed) serialised['_deleted'] = true;
      var rev = modelInstance._rev;
      if (rev) serialised['_rev'] = rev;
      serialised = _.reduce(modelInstance._relationshipNames, function(memo, n) {
        var val = modelInstance[n];
        if (siesta.isArray(val)) {
          memo[n] = _.pluck(val, 'localId');
        }
        else if (val) {
          memo[n] = val.localId;
        }
        return memo;
      }, serialised);
      return serialised;
    }

    function _prepareDatum(rawDatum, model) {
      _processMeta(rawDatum);
      delete rawDatum.collection;
      delete rawDatum.model;
      rawDatum.localId = rawDatum._id;
      delete rawDatum._id;
      var datum = {};
      Object.keys(rawDatum).forEach(function(k) {
        datum[k.replace(UNDERSCORE_REPLACEMENT, '_')] = rawDatum[k];
      });

      var relationshipNames = model._relationshipNames;
      _.each(relationshipNames, function(r) {
        var localId = datum[r];
        if (localId) {
          if (siesta.isArray(localId)) {
            datum[r] = _.map(localId, function(x) {
              return {localId: x}
            });
          }
          else {
            datum[r] = {localId: localId};
          }
        }

      });
      return datum;
    }

    /**
     *
     * @param opts
     * @param opts.collectionName
     * @param opts.modelName
     * @param callback
     * @private
     */
    function _loadModel(opts, callback) {
      var loaded = {};
      var collectionName = opts.collectionName,
        modelName = opts.modelName;
      var fullyQualifiedName = fullyQualifiedModelName(collectionName, modelName);
      log('Loading instances for ' + fullyQualifiedName);
      var Model = CollectionRegistry[collectionName][modelName];
      log('Querying pouch');
      pouch.query(fullyQualifiedName)
        //pouch.query({map: mapFunc})
        .then(function(resp) {
          log('Queried pouch successfully');
          var rows = resp.rows;
          var data = siesta._.map(siesta._.pluck(rows, 'value'), function(datum) {
            return _prepareDatum(datum, Model);
          });

          siesta._.map(data, function(datum) {
            var remoteId = datum[Model.id];
            if (remoteId) {
              if (loaded[remoteId]) {
                console.error('Duplicates detected in storage. You have encountered a serious bug. Please report this.');
              }
              else {
                loaded[remoteId] = datum;
              }
            }
          });

          log('Mapping data', data);

          Model.graph(data, {
            _ignoreInstalled: true,
            fromStorage: true
          }, function(err, instances) {
            if (!err) {
              if (log.enabled)
                log('Loaded ' + instances ? instances.length.toString() : 0 + ' instances for ' + fullyQualifiedName);
            }
            else {
              log('Error loading models', err);
            }
            callback(err, instances);
          });
        })
        .catch(function(err) {
          callback(err);
        });

    }

    /**
     * Load all data from PouchDB.
     */
    function _load(cb) {
      if (saving) throw new Error('not loaded yet how can i save');
      return util.promise(cb, function(cb) {
        if (siesta.ext.storageEnabled) {
          var collectionNames = CollectionRegistry.collectionNames;
          var tasks = [];
          _.each(collectionNames, function(collectionName) {
            var collection = CollectionRegistry[collectionName],
              modelNames = Object.keys(collection._models);
            _.each(modelNames, function(modelName) {
              tasks.push(function(cb) {
                // We call from storage to allow for replacement of _loadModel for performance extension.
                storage._loadModel({
                  collectionName: collectionName,
                  modelName: modelName
                }, cb);
              });
            });
          });
          siesta.async.series(tasks, function(err, results) {
            var n;
            if (!err) {
              var instances = [];
              siesta._.each(results, function(r) {
                instances = instances.concat(r)
              });
              n = instances.length;
              if (log) {
                log('Loaded ' + n.toString() + ' instances. Cache size is ' + cache.count(), {
                  remote: cache._remoteCache(),
                  localCache: cache._localCache()
                });
              }
              siesta.on('Siesta', listener);
            }

            cb(err, n);
          });
        }
        else {
          cb();
        }
      }.bind(this));
    }

    function saveConflicts(objects, cb) {
      pouch.allDocs({keys: _.pluck(objects, 'localId')})
        .then(function(resp) {
          for (var i = 0; i < resp.rows.length; i++) {
            objects[i]._rev = resp.rows[i].value.rev;
          }
          saveToPouch(objects, cb);
        })
        .catch(function(err) {
          cb(err);
        })
    }

    function saveToPouch(objects, cb) {
      var conflicts = [];
      var serialisedDocs = _.map(objects, _serialise);
      pouch.bulkDocs(serialisedDocs).then(function(resp) {
        for (var i = 0; i < resp.length; i++) {
          var response = resp[i];
          var obj = objects[i];
          if (response.ok) {
            obj._rev = response.rev;
          }
          else if (response.status == 409) {
            conflicts.push(obj);
          }
          else {
            log('Error saving object with localId="' + obj.localId + '"', response);
          }
        }
        if (conflicts.length) {
          saveConflicts(conflicts, cb);
        }
        else {
          cb();
        }
      }, function(err) {
        cb(err);
      });
    }


    /**
     * Save all modelEvents down to PouchDB.
     */
    function save(cb) {
      return util.promise(cb, function(cb) {
        siesta._afterInstall(function() {
          var instances = unsavedObjects;
          unsavedObjects = [];
          unsavedObjectsHash = {};
          unsavedObjectsByCollection = {};
          saveToPouch(instances, cb);
        });
      }.bind(this));
    }

    function listener(n) {
      var changedObject = n.obj,
        ident = changedObject.localId;
      if (!changedObject) {
        throw new _i.error.InternalSiestaError('No obj field in notification received by storage extension');
      }
      if (!(ident in unsavedObjectsHash)) {
        unsavedObjectsHash[ident] = changedObject;
        unsavedObjects.push(changedObject);
        var collectionName = changedObject.collectionName;
        if (!unsavedObjectsByCollection[collectionName]) {
          unsavedObjectsByCollection[collectionName] = {};
        }
        var modelName = changedObject.model.name;
        if (!unsavedObjectsByCollection[collectionName][modelName]) {
          unsavedObjectsByCollection[collectionName][modelName] = {};
        }
        unsavedObjectsByCollection[collectionName][modelName][ident] = changedObject;
      }
    }

    _.extend(storage, {
      _load: _load,
      _loadModel: _loadModel,
      save: save,
      _serialise: _serialise,
      ensureIndexesForAll: ensureIndexesForAll,
      _reset: function(cb) {
        siesta.removeListener('Siesta', listener);
        unsavedObjects = [];
        unsavedObjectsHash = {};
        pouch.destroy(function(err) {
          if (!err) {
            pouch = new PouchDB(DB_NAME);
          }
          log('Reset complete');
          cb(err);
        })
      }

    });

    Object.defineProperties(storage, {
      _unsavedObjects: {
        get: function() {
          return unsavedObjects
        }
      },
      _unsavedObjectsHash: {
        get: function() {
          return unsavedObjectsHash
        }
      },
      _unsavedObjectsByCollection: {
        get: function() {
          return unsavedObjectsByCollection
        }
      },
      _pouch: {
        get: function() {
          return pouch
        }
      }
    });


    if (!siesta.ext) siesta.ext = {};
    siesta.ext.storage = storage;

    Object.defineProperties(siesta.ext, {
      storageEnabled: {
        get: function() {
          if (siesta.ext._storageEnabled !== undefined) {
            return siesta.ext._storageEnabled;
          }
          return !!siesta.ext.storage;
        },
        set: function(v) {
          siesta.ext._storageEnabled = v;
        },
        enumerable: true
      }
    });

    var interval, saving, autosaveInterval = 1000;

    Object.defineProperties(siesta, {
      autosave: {
        get: function() {
          return !!interval;
        },
        set: function(autosave) {
          if (autosave) {
            if (!interval) {
              interval = setInterval(function() {
                // Cheeky way of avoiding multiple saves happening...
                if (!saving) {
                  saving = true;
                  siesta.save(function(err) {
                    if (!err) {
                      events.emit('saved');
                    }
                    saving = false;
                  });
                }
              }, siesta.autosaveInterval);
            }
          }
          else {
            if (interval) {
              clearInterval(interval);
              interval = null;
            }
          }
        }
      },
      autosaveInterval: {
        get: function() {
          return autosaveInterval;
        },
        set: function(_autosaveInterval) {
          autosaveInterval = _autosaveInterval;
          if (interval) {
            // Reset interval
            siesta.autosave = false;
            siesta.autosave = true;
          }
        }
      },
      dirty: {
        get: function() {
          var unsavedObjectsByCollection = siesta.ext.storage._unsavedObjectsByCollection;
          return !!Object.keys(unsavedObjectsByCollection).length;
        },
        enumerable: true
      }
    });

    _.extend(siesta, {
      save: save,
      setPouch: function(_p) {
        if (siesta._canChange) pouch = _p;
        else throw new Error('Cannot change PouchDB instance when an object graph exists.');
      }
    });

  }

  module.exports = storage;

})();
},{}],53:[function(require,module,exports){
(function (global){
/*
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

(function(global) {
  'use strict';

  var testingExposeCycleCount = global.testingExposeCycleCount;

  // Detect and do basic sanity checking on Object/Array.observe.
  function detectObjectObserve() {
    if (typeof Object.observe !== 'function' ||
        typeof Array.observe !== 'function') {
      return false;
    }

    var records = [];

    function callback(recs) {
      records = recs;
    }

    var test = {};
    var arr = [];
    Object.observe(test, callback);
    Array.observe(arr, callback);
    test.id = 1;
    test.id = 2;
    delete test.id;
    arr.push(1, 2);
    arr.length = 0;

    Object.deliverChangeRecords(callback);
    if (records.length !== 5)
      return false;

    if (records[0].type != 'add' ||
        records[1].type != 'update' ||
        records[2].type != 'delete' ||
        records[3].type != 'splice' ||
        records[4].type != 'splice') {
      return false;
    }

    Object.unobserve(test, callback);
    Array.unobserve(arr, callback);

    return true;
  }

  var hasObserve = detectObjectObserve();

  function detectEval() {
    // Don't test for eval if we're running in a Chrome App environment.
    // We check for APIs set that only exist in a Chrome App context.
    if (typeof chrome !== 'undefined' && chrome.app && chrome.app.runtime) {
      return false;
    }

    // Firefox OS Apps do not allow eval. This feature detection is very hacky
    // but even if some other platform adds support for this function this code
    // will continue to work.
    if (navigator.getDeviceStorage) {
      return false;
    }

    try {
      var f = new Function('', 'return true;');
      return f();
    } catch (ex) {
      return false;
    }
  }

  var hasEval = detectEval();

  function isIndex(s) {
    return +s === s >>> 0 && s !== '';
  }

  function toNumber(s) {
    return +s;
  }

  var numberIsNaN = global.Number.isNaN || function(value) {
    return typeof value === 'number' && global.isNaN(value);
  }


  var createObject = ('__proto__' in {}) ?
    function(obj) { return obj; } :
    function(obj) {
      var proto = obj.__proto__;
      if (!proto)
        return obj;
      var newObject = Object.create(proto);
      Object.getOwnPropertyNames(obj).forEach(function(name) {
        Object.defineProperty(newObject, name,
                             Object.getOwnPropertyDescriptor(obj, name));
      });
      return newObject;
    };

  var identStart = '[\$_a-zA-Z]';
  var identPart = '[\$_a-zA-Z0-9]';


  var MAX_DIRTY_CHECK_CYCLES = 1000;

  function dirtyCheck(observer) {
    var cycles = 0;
    while (cycles < MAX_DIRTY_CHECK_CYCLES && observer.check_()) {
      cycles++;
    }
    if (testingExposeCycleCount)
      global.dirtyCheckCycleCount = cycles;

    return cycles > 0;
  }

  function objectIsEmpty(object) {
    for (var prop in object)
      return false;
    return true;
  }

  function diffIsEmpty(diff) {
    return objectIsEmpty(diff.added) &&
           objectIsEmpty(diff.removed) &&
           objectIsEmpty(diff.changed);
  }

  function diffObjectFromOldObject(object, oldObject) {
    var added = {};
    var removed = {};
    var changed = {};

    for (var prop in oldObject) {
      var newValue = object[prop];

      if (newValue !== undefined && newValue === oldObject[prop])
        continue;

      if (!(prop in object)) {
        removed[prop] = undefined;
        continue;
      }

      if (newValue !== oldObject[prop])
        changed[prop] = newValue;
    }

    for (var prop in object) {
      if (prop in oldObject)
        continue;

      added[prop] = object[prop];
    }

    if (Array.isArray(object) && object.length !== oldObject.length)
      changed.length = object.length;

    return {
      added: added,
      removed: removed,
      changed: changed
    };
  }

  var eomTasks = [];
  function runEOMTasks() {
    if (!eomTasks.length)
      return false;

    for (var i = 0; i < eomTasks.length; i++) {
      eomTasks[i]();
    }
    eomTasks.length = 0;
    return true;
  }

  var runEOM = hasObserve ? (function(){
    var eomObj = { pingPong: true };
    var eomRunScheduled = false;

    Object.observe(eomObj, function() {
      runEOMTasks();
      eomRunScheduled = false;
    });

    return function(fn) {
      eomTasks.push(fn);
      if (!eomRunScheduled) {
        eomRunScheduled = true;
        eomObj.pingPong = !eomObj.pingPong;
      }
    };
  })() :
  (function() {
    return function(fn) {
      eomTasks.push(fn);
    };
  })();

  var observedObjectCache = [];

  function newObservedObject() {
    var observer;
    var object;
    var discardRecords = false;
    var first = true;

    function callback(records) {
      if (observer && observer.state_ === OPENED && !discardRecords)
        observer.check_(records);
    }

    return {
      open: function(obs) {
        if (observer)
          throw Error('ObservedObject in use');

        if (!first)
          Object.deliverChangeRecords(callback);

        observer = obs;
        first = false;
      },
      observe: function(obj, arrayObserve) {
        object = obj;
        if (arrayObserve)
          Array.observe(object, callback);
        else
          Object.observe(object, callback);
      },
      deliver: function(discard) {
        discardRecords = discard;
        Object.deliverChangeRecords(callback);
        discardRecords = false;
      },
      close: function() {
        observer = undefined;
        Object.unobserve(object, callback);
        observedObjectCache.push(this);
      }
    };
  }

  /*
   * The observedSet abstraction is a perf optimization which reduces the total
   * number of Object.observe observations of a set of objects. The idea is that
   * groups of Observers will have some object dependencies in common and this
   * observed set ensures that each object in the transitive closure of
   * dependencies is only observed once. The observedSet acts as a write barrier
   * such that whenever any change comes through, all Observers are checked for
   * changed values.
   *
   * Note that this optimization is explicitly moving work from setup-time to
   * change-time.
   *
   * TODO(rafaelw): Implement "garbage collection". In order to move work off
   * the critical path, when Observers are closed, their observed objects are
   * not Object.unobserve(d). As a result, it'siesta possible that if the observedSet
   * is kept open, but some Observers have been closed, it could cause "leaks"
   * (prevent otherwise collectable objects from being collected). At some
   * point, we should implement incremental "gc" which keeps a list of
   * observedSets which may need clean-up and does small amounts of cleanup on a
   * timeout until all is clean.
   */

  function getObservedObject(observer, object, arrayObserve) {
    var dir = observedObjectCache.pop() || newObservedObject();
    dir.open(observer);
    dir.observe(object, arrayObserve);
    return dir;
  }

  var observedSetCache = [];

  function newObservedSet() {
    var observerCount = 0;
    var observers = [];
    var objects = [];
    var rootObj;
    var rootObjProps;

    function observe(obj, prop) {
      if (!obj)
        return;

      if (obj === rootObj)
        rootObjProps[prop] = true;

      if (objects.indexOf(obj) < 0) {
        objects.push(obj);
        Object.observe(obj, callback);
      }

      observe(Object.getPrototypeOf(obj), prop);
    }

    function allRootObjNonObservedProps(recs) {
      for (var i = 0; i < recs.length; i++) {
        var rec = recs[i];
        if (rec.object !== rootObj ||
            rootObjProps[rec.name] ||
            rec.type === 'setPrototype') {
          return false;
        }
      }
      return true;
    }

    function callback(recs) {
      if (allRootObjNonObservedProps(recs))
        return;

      var observer;
      for (var i = 0; i < observers.length; i++) {
        observer = observers[i];
        if (observer.state_ == OPENED) {
          observer.iterateObjects_(observe);
        }
      }

      for (var i = 0; i < observers.length; i++) {
        observer = observers[i];
        if (observer.state_ == OPENED) {
          observer.check_();
        }
      }
    }

    var record = {
      object: undefined,
      objects: objects,
      open: function(obs, object) {
        if (!rootObj) {
          rootObj = object;
          rootObjProps = {};
        }

        observers.push(obs);
        observerCount++;
        obs.iterateObjects_(observe);
      },
      close: function(obs) {
        observerCount--;
        if (observerCount > 0) {
          return;
        }

        for (var i = 0; i < objects.length; i++) {
          Object.unobserve(objects[i], callback);
          Observer.unobservedCount++;
        }

        observers.length = 0;
        objects.length = 0;
        rootObj = undefined;
        rootObjProps = undefined;
        observedSetCache.push(this);
      }
    };

    return record;
  }

  var lastObservedSet;

  var UNOPENED = 0;
  var OPENED = 1;
  var CLOSED = 2;

  var nextObserverId = 1;

  function Observer() {
    this.state_ = UNOPENED;
    this.callback_ = undefined;
    this.target_ = undefined; // TODO(rafaelw): Should be WeakRef
    this.directObserver_ = undefined;
    this.value_ = undefined;
    this.id_ = nextObserverId++;
  }

  Observer.prototype = {
    open: function(callback, target) {
      if (this.state_ != UNOPENED)
        throw Error('Observer has already been opened.');

      addToAll(this);
      this.callback_ = callback;
      this.target_ = target;
      this.connect_();
      this.state_ = OPENED;
      return this.value_;
    },

    close: function() {
      if (this.state_ != OPENED)
        return;

      removeFromAll(this);
      this.disconnect_();
      this.value_ = undefined;
      this.callback_ = undefined;
      this.target_ = undefined;
      this.state_ = CLOSED;
    },

    deliver: function() {
      if (this.state_ != OPENED)
        return;

      dirtyCheck(this);
    },

    report_: function(changes) {
      try {
        this.callback_.apply(this.target_, changes);
      } catch (ex) {
        Observer._errorThrownDuringCallback = true;
        console.error('Exception caught during observer callback: ' +
                       (ex.stack || ex));
      }
    },

    discardChanges: function() {
      this.check_(undefined, true);
      return this.value_;
    }
  }

  var collectObservers = !hasObserve;
  var allObservers;
  Observer._allObserversCount = 0;

  if (collectObservers) {
    allObservers = [];
  }

  function addToAll(observer) {
    Observer._allObserversCount++;
    if (!collectObservers)
      return;

    allObservers.push(observer);
  }

  function removeFromAll(observer) {
    Observer._allObserversCount--;
  }

  var runningMicrotaskCheckpoint = false;

  var hasDebugForceFullDelivery = hasObserve && hasEval && (function() {
    try {
      eval('%RunMicrotasks()');
      return true;
    } catch (ex) {
      return false;
    }
  })();

  global.Platform = global.Platform || {};

  global.Platform.performMicrotaskCheckpoint = function() {
    if (runningMicrotaskCheckpoint)
      return;

    if (hasDebugForceFullDelivery) {
      eval('%RunMicrotasks()');
      return;
    }

    if (!collectObservers)
      return;

    runningMicrotaskCheckpoint = true;

    var cycles = 0;
    var anyChanged, toCheck;

    do {
      cycles++;
      toCheck = allObservers;
      allObservers = [];
      anyChanged = false;

      for (var i = 0; i < toCheck.length; i++) {
        var observer = toCheck[i];
        if (observer.state_ != OPENED)
          continue;

        if (observer.check_())
          anyChanged = true;

        allObservers.push(observer);
      }
      if (runEOMTasks())
        anyChanged = true;
    } while (cycles < MAX_DIRTY_CHECK_CYCLES && anyChanged);

    if (testingExposeCycleCount)
      global.dirtyCheckCycleCount = cycles;

    runningMicrotaskCheckpoint = false;
  };

  if (collectObservers) {
    global.Platform.clearObservers = function() {
      allObservers = [];
    };
  }

  function ObjectObserver(object) {
    Observer.call(this);
    this.value_ = object;
    this.oldObject_ = undefined;
  }

  ObjectObserver.prototype = createObject({
    __proto__: Observer.prototype,

    arrayObserve: false,

    connect_: function(callback, target) {
      if (hasObserve) {
        this.directObserver_ = getObservedObject(this, this.value_,
                                                 this.arrayObserve);
      } else {
        this.oldObject_ = this.copyObject(this.value_);
      }

    },

    copyObject: function(object) {
      var copy = Array.isArray(object) ? [] : {};
      for (var prop in object) {
        copy[prop] = object[prop];
      };
      if (Array.isArray(object))
        copy.length = object.length;
      return copy;
    },

    check_: function(changeRecords, skipChanges) {
      var diff;
      var oldValues;
      if (hasObserve) {
        if (!changeRecords)
          return false;

        oldValues = {};
        diff = diffObjectFromChangeRecords(this.value_, changeRecords,
                                           oldValues);
      } else {
        oldValues = this.oldObject_;
        diff = diffObjectFromOldObject(this.value_, this.oldObject_);
      }

      if (diffIsEmpty(diff))
        return false;

      if (!hasObserve)
        this.oldObject_ = this.copyObject(this.value_);

      this.report_([
        diff.added || {},
        diff.removed || {},
        diff.changed || {},
        function(property) {
          return oldValues[property];
        }
      ]);

      return true;
    },

    disconnect_: function() {
      if (hasObserve) {
        this.directObserver_.close();
        this.directObserver_ = undefined;
      } else {
        this.oldObject_ = undefined;
      }
    },

    deliver: function() {
      if (this.state_ != OPENED)
        return;

      if (hasObserve)
        this.directObserver_.deliver(false);
      else
        dirtyCheck(this);
    },

    discardChanges: function() {
      if (this.directObserver_)
        this.directObserver_.deliver(true);
      else
        this.oldObject_ = this.copyObject(this.value_);

      return this.value_;
    }
  });

  function ArrayObserver(array) {
    if (!Array.isArray(array))
      throw Error('Provided object is not an Array');
    ObjectObserver.call(this, array);
  }

  ArrayObserver.prototype = createObject({

    __proto__: ObjectObserver.prototype,

    arrayObserve: true,

    copyObject: function(arr) {
      return arr.slice();
    },

    check_: function(changeRecords) {
      var splices;
      if (hasObserve) {
        if (!changeRecords)
          return false;
        splices = projectArraySplices(this.value_, changeRecords);
      } else {
        splices = calcSplices(this.value_, 0, this.value_.length,
                              this.oldObject_, 0, this.oldObject_.length);
      }

      if (!splices || !splices.length)
        return false;

      if (!hasObserve)
        this.oldObject_ = this.copyObject(this.value_);

      this.report_([splices]);
      return true;
    }
  });

  ArrayObserver.applySplices = function(previous, current, splices) {
    splices.forEach(function(splice) {
      var spliceArgs = [splice.index, splice.removed.length];
      var addIndex = splice.index;
      while (addIndex < splice.index + splice.addedCount) {
        spliceArgs.push(current[addIndex]);
        addIndex++;
      }

      Array.prototype.splice.apply(previous, spliceArgs);
    });
  };

  var observerSentinel = {};

  var expectedRecordTypes = {
    add: true,
    update: true,
    delete: true
  };

  function diffObjectFromChangeRecords(object, changeRecords, oldValues) {
    var added = {};
    var removed = {};

    for (var i = 0; i < changeRecords.length; i++) {
      var record = changeRecords[i];
      if (!expectedRecordTypes[record.type]) {
        console.error('Unknown changeRecord type: ' + record.type);
        console.error(record);
        continue;
      }

      if (!(record.name in oldValues))
        oldValues[record.name] = record.oldValue;

      if (record.type == 'update')
        continue;

      if (record.type == 'add') {
        if (record.name in removed)
          delete removed[record.name];
        else
          added[record.name] = true;

        continue;
      }

      // type = 'delete'
      if (record.name in added) {
        delete added[record.name];
        delete oldValues[record.name];
      } else {
        removed[record.name] = true;
      }
    }

    for (var prop in added)
      added[prop] = object[prop];

    for (var prop in removed)
      removed[prop] = undefined;

    var changed = {};
    for (var prop in oldValues) {
      if (prop in added || prop in removed)
        continue;

      var newValue = object[prop];
      if (oldValues[prop] !== newValue)
        changed[prop] = newValue;
    }

    return {
      added: added,
      removed: removed,
      changed: changed
    };
  }

  function newSplice(index, removed, addedCount) {
    return {
      index: index,
      removed: removed,
      addedCount: addedCount
    };
  }

  var EDIT_LEAVE = 0;
  var EDIT_UPDATE = 1;
  var EDIT_ADD = 2;
  var EDIT_DELETE = 3;

  function ArraySplice() {}

  ArraySplice.prototype = {

    // Note: This function is *based* on the computation of the Levenshtein
    // "edit" distance. The one change is that "updates" are treated as two
    // edits - not one. With Array splices, an update is really a delete
    // followed by an add. By retaining this, we optimize for "keeping" the
    // maximum array items in the original array. For example:
    //
    //   'xxxx123' -> '123yyyy'
    //
    // With 1-edit updates, the shortest path would be just to update all seven
    // characters. With 2-edit updates, we delete 4, leave 3, and add 4. This
    // leaves the substring '123' intact.
    calcEditDistances: function(current, currentStart, currentEnd,
                                old, oldStart, oldEnd) {
      // "Deletion" columns
      var rowCount = oldEnd - oldStart + 1;
      var columnCount = currentEnd - currentStart + 1;
      var distances = new Array(rowCount);

      // "Addition" rows. Initialize null column.
      for (var i = 0; i < rowCount; i++) {
        distances[i] = new Array(columnCount);
        distances[i][0] = i;
      }

      // Initialize null row
      for (var j = 0; j < columnCount; j++)
        distances[0][j] = j;

      for (var i = 1; i < rowCount; i++) {
        for (var j = 1; j < columnCount; j++) {
          if (this.equals(current[currentStart + j - 1], old[oldStart + i - 1]))
            distances[i][j] = distances[i - 1][j - 1];
          else {
            var north = distances[i - 1][j] + 1;
            var west = distances[i][j - 1] + 1;
            distances[i][j] = north < west ? north : west;
          }
        }
      }

      return distances;
    },

    // This starts at the final weight, and walks "backward" by finding
    // the minimum previous weight recursively until the origin of the weight
    // matrix.
    spliceOperationsFromEditDistances: function(distances) {
      var i = distances.length - 1;
      var j = distances[0].length - 1;
      var current = distances[i][j];
      var edits = [];
      while (i > 0 || j > 0) {
        if (i == 0) {
          edits.push(EDIT_ADD);
          j--;
          continue;
        }
        if (j == 0) {
          edits.push(EDIT_DELETE);
          i--;
          continue;
        }
        var northWest = distances[i - 1][j - 1];
        var west = distances[i - 1][j];
        var north = distances[i][j - 1];

        var min;
        if (west < north)
          min = west < northWest ? west : northWest;
        else
          min = north < northWest ? north : northWest;

        if (min == northWest) {
          if (northWest == current) {
            edits.push(EDIT_LEAVE);
          } else {
            edits.push(EDIT_UPDATE);
            current = northWest;
          }
          i--;
          j--;
        } else if (min == west) {
          edits.push(EDIT_DELETE);
          i--;
          current = west;
        } else {
          edits.push(EDIT_ADD);
          j--;
          current = north;
        }
      }

      edits.reverse();
      return edits;
    },

    /**
     * Splice Projection functions:
     *
     * A splice map is a representation of how a previous array of items
     * was transformed into a new array of items. Conceptually it is a list of
     * tuples of
     *
     *   <index, removed, addedCount>
     *
     * which are kept in ascending index order of. The tuple represents that at
     * the |index|, |removed| sequence of items were removed, and counting forward
     * from |index|, |addedCount| items were added.
     */

    /**
     * Lacking individual splice mutation information, the minimal set of
     * splices can be synthesized given the previous state and final state of an
     * array. The basic approach is to calculate the edit distance matrix and
     * choose the shortest path through it.
     *
     * Complexity: O(l * p)
     *   l: The length of the current array
     *   p: The length of the old array
     */
    calcSplices: function(current, currentStart, currentEnd,
                          old, oldStart, oldEnd) {
      var prefixCount = 0;
      var suffixCount = 0;

      var minLength = Math.min(currentEnd - currentStart, oldEnd - oldStart);
      if (currentStart == 0 && oldStart == 0)
        prefixCount = this.sharedPrefix(current, old, minLength);

      if (currentEnd == current.length && oldEnd == old.length)
        suffixCount = this.sharedSuffix(current, old, minLength - prefixCount);

      currentStart += prefixCount;
      oldStart += prefixCount;
      currentEnd -= suffixCount;
      oldEnd -= suffixCount;

      if (currentEnd - currentStart == 0 && oldEnd - oldStart == 0)
        return [];

      if (currentStart == currentEnd) {
        var splice = newSplice(currentStart, [], 0);
        while (oldStart < oldEnd)
          splice.removed.push(old[oldStart++]);

        return [ splice ];
      } else if (oldStart == oldEnd)
        return [ newSplice(currentStart, [], currentEnd - currentStart) ];

      var ops = this.spliceOperationsFromEditDistances(
          this.calcEditDistances(current, currentStart, currentEnd,
                                 old, oldStart, oldEnd));

      var splice = undefined;
      var splices = [];
      var index = currentStart;
      var oldIndex = oldStart;
      for (var i = 0; i < ops.length; i++) {
        switch(ops[i]) {
          case EDIT_LEAVE:
            if (splice) {
              splices.push(splice);
              splice = undefined;
            }

            index++;
            oldIndex++;
            break;
          case EDIT_UPDATE:
            if (!splice)
              splice = newSplice(index, [], 0);

            splice.addedCount++;
            index++;

            splice.removed.push(old[oldIndex]);
            oldIndex++;
            break;
          case EDIT_ADD:
            if (!splice)
              splice = newSplice(index, [], 0);

            splice.addedCount++;
            index++;
            break;
          case EDIT_DELETE:
            if (!splice)
              splice = newSplice(index, [], 0);

            splice.removed.push(old[oldIndex]);
            oldIndex++;
            break;
        }
      }

      if (splice) {
        splices.push(splice);
      }
      return splices;
    },

    sharedPrefix: function(current, old, searchLength) {
      for (var i = 0; i < searchLength; i++)
        if (!this.equals(current[i], old[i]))
          return i;
      return searchLength;
    },

    sharedSuffix: function(current, old, searchLength) {
      var index1 = current.length;
      var index2 = old.length;
      var count = 0;
      while (count < searchLength && this.equals(current[--index1], old[--index2]))
        count++;

      return count;
    },

    calculateSplices: function(current, previous) {
      return this.calcSplices(current, 0, current.length, previous, 0,
                              previous.length);
    },

    equals: function(currentValue, previousValue) {
      return currentValue === previousValue;
    }
  };

  var arraySplice = new ArraySplice();

  function calcSplices(current, currentStart, currentEnd,
                       old, oldStart, oldEnd) {
    return arraySplice.calcSplices(current, currentStart, currentEnd,
                                   old, oldStart, oldEnd);
  }

  function intersect(start1, end1, start2, end2) {
    // Disjoint
    if (end1 < start2 || end2 < start1)
      return -1;

    // Adjacent
    if (end1 == start2 || end2 == start1)
      return 0;

    // Non-zero intersect, span1 first
    if (start1 < start2) {
      if (end1 < end2)
        return end1 - start2; // Overlap
      else
        return end2 - start2; // Contained
    } else {
      // Non-zero intersect, span2 first
      if (end2 < end1)
        return end2 - start1; // Overlap
      else
        return end1 - start1; // Contained
    }
  }

  function mergeSplice(splices, index, removed, addedCount) {

    var splice = newSplice(index, removed, addedCount);

    var inserted = false;
    var insertionOffset = 0;

    for (var i = 0; i < splices.length; i++) {
      var current = splices[i];
      current.index += insertionOffset;

      if (inserted)
        continue;

      var intersectCount = intersect(splice.index,
                                     splice.index + splice.removed.length,
                                     current.index,
                                     current.index + current.addedCount);

      if (intersectCount >= 0) {
        // Merge the two splices

        splices.splice(i, 1);
        i--;

        insertionOffset -= current.addedCount - current.removed.length;

        splice.addedCount += current.addedCount - intersectCount;
        var deleteCount = splice.removed.length +
                          current.removed.length - intersectCount;

        if (!splice.addedCount && !deleteCount) {
          // merged splice is a noop. discard.
          inserted = true;
        } else {
          var removed = current.removed;

          if (splice.index < current.index) {
            // some prefix of splice.removed is prepended to current.removed.
            var prepend = splice.removed.slice(0, current.index - splice.index);
            Array.prototype.push.apply(prepend, removed);
            removed = prepend;
          }

          if (splice.index + splice.removed.length > current.index + current.addedCount) {
            // some suffix of splice.removed is appended to current.removed.
            var append = splice.removed.slice(current.index + current.addedCount - splice.index);
            Array.prototype.push.apply(removed, append);
          }

          splice.removed = removed;
          if (current.index < splice.index) {
            splice.index = current.index;
          }
        }
      } else if (splice.index < current.index) {
        // Insert splice here.

        inserted = true;

        splices.splice(i, 0, splice);
        i++;

        var offset = splice.addedCount - splice.removed.length
        current.index += offset;
        insertionOffset += offset;
      }
    }

    if (!inserted)
      splices.push(splice);
  }

  function createInitialSplices(array, changeRecords) {
    var splices = [];

    for (var i = 0; i < changeRecords.length; i++) {
      var record = changeRecords[i];
      switch(record.type) {
        case 'splice':
          mergeSplice(splices, record.index, record.removed.slice(), record.addedCount);
          break;
        case 'add':
        case 'update':
        case 'delete':
          if (!isIndex(record.name))
            continue;
          var index = toNumber(record.name);
          if (index < 0)
            continue;
          mergeSplice(splices, index, [record.oldValue], 1);
          break;
        default:
          console.error('Unexpected record type: ' + JSON.stringify(record));
          break;
      }
    }

    return splices;
  }

  function projectArraySplices(array, changeRecords) {
    var splices = [];

    createInitialSplices(array, changeRecords).forEach(function(splice) {
      if (splice.addedCount == 1 && splice.removed.length == 1) {
        if (splice.removed[0] !== array[splice.index])
          splices.push(splice);

        return
      };

      splices = splices.concat(calcSplices(array, splice.index, splice.index + splice.addedCount,
                                           splice.removed, 0, splice.removed.length));
    });

    return splices;
  }

 // Export the observe-js object for **Node.js**, with
// backwards-compatibility for the old `require()` API. If we're in
// the browser, export as a global object.
var expose = global;
if (typeof exports !== 'undefined') {
if (typeof module !== 'undefined' && module.exports) {
expose = exports = module.exports;
}
expose = exports;
}
expose.Observer = Observer;
expose.Observer.runEOM_ = runEOM;
expose.Observer.observerSentinel_ = observerSentinel; // for testing.
expose.Observer.hasObjectObserve = hasObserve;
expose.ArrayObserver = ArrayObserver;
expose.ArrayObserver.calculateSplices = function(current, previous) {
return arraySplice.calculateSplices(current, previous);
};
expose.Platform = global.Platform;
expose.ArraySplice = ArraySplice;
expose.ObjectObserver = ObjectObserver;
})(typeof global !== 'undefined' && global && typeof module !== 'undefined' && module ? global : this || window);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}]},{},[17])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL0NoYWluLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9NYW55VG9NYW55UHJveHkuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL01vZGVsSW5zdGFuY2UuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL09uZVRvTWFueVByb3h5LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9PbmVUb09uZVByb3h5LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9QbGFjZWhvbGRlci5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvUXVlcnkuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL1F1ZXJ5U2V0LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9SZWFjdGl2ZVF1ZXJ5LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9SZWxhdGlvbnNoaXBQcm94eS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvUmVsYXRpb25zaGlwVHlwZS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvY2FjaGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL2NvbGxlY3Rpb24uanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL2NvbGxlY3Rpb25SZWdpc3RyeS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvZXJyb3IuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL2V2ZW50cy5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvaW5kZXguanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL2luc3RhbmNlRmFjdG9yeS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvbG9nLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9tYXBwaW5nT3BlcmF0aW9uLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9tb2RlbC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvbW9kZWxFdmVudHMuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL3V0aWwvYXN5bmMuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL3V0aWwvaW5kZXguanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL3V0aWwvbWlzYy5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvdXRpbC91bmRlcnNjb3JlLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2FyZ3NhcnJheS9pbmRleC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXJlc29sdmUvZW1wdHkuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9kZWJ1Zy9icm93c2VyLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2RlYnVnL2RlYnVnLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2RlYnVnL25vZGVfbW9kdWxlcy9tcy9pbmRleC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9leHRlbmQvaW5kZXguanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvbGllL2xpYi9JTlRFUk5BTC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9saWUvbGliL2FsbC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9saWUvbGliL2hhbmRsZXJzLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2xpZS9saWIvaW5kZXguanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvbGllL2xpYi9wcm9taXNlLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2xpZS9saWIvcXVldWVJdGVtLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2xpZS9saWIvcmFjZS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9saWUvbGliL3JlamVjdC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9saWUvbGliL3Jlc29sdmUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvbGllL2xpYi9yZXNvbHZlVGhlbmFibGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvbGllL2xpYi9zdGF0ZXMuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvbGllL2xpYi90cnlDYXRjaC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9saWUvbGliL3Vud3JhcC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9saWUvbm9kZV9tb2R1bGVzL2ltbWVkaWF0ZS9saWIvaW5kZXguanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvbGllL25vZGVfbW9kdWxlcy9pbW1lZGlhdGUvbGliL21lc3NhZ2VDaGFubmVsLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2xpZS9ub2RlX21vZHVsZXMvaW1tZWRpYXRlL2xpYi9tdXRhdGlvbi5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9saWUvbm9kZV9tb2R1bGVzL2ltbWVkaWF0ZS9saWIvc3RhdGVDaGFuZ2UuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvbGllL25vZGVfbW9kdWxlcy9pbW1lZGlhdGUvbGliL3RpbWVvdXQuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9zdG9yYWdlL2luZGV4LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL1FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4U0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqU0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcFJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdlpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMWhCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6TUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqU0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6VEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEJBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN1NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvZUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIihmdW5jdGlvbigpIHtcblxuICB2YXIgYXJnc2FycmF5ID0gcmVxdWlyZSgnYXJnc2FycmF5Jyk7XG5cbiAgLyoqXG4gICAqIENsYXNzIGZvciBmYWNpbGl0YXRpbmcgXCJjaGFpbmVkXCIgYmVoYXZpb3VyIGUuZzpcbiAgICpcbiAgICogdmFyIGNhbmNlbCA9IFVzZXJzXG4gICAqICAub24oJ25ldycsIGZ1bmN0aW9uICh1c2VyKSB7XG4gICAqICAgICAvLyAuLi5cbiAgICogICB9KVxuICAgKiAgLnF1ZXJ5KHskb3I6IHthZ2VfX2d0ZTogMjAsIGFnZV9fbHRlOiAzMH19KVxuICAgKiAgLm9uKCcqJywgZnVuY3Rpb24gKGNoYW5nZSkge1xuICAgKiAgICAgLy8gLi5cbiAgICogICB9KTtcbiAgICpcbiAgICogQHBhcmFtIG9wdHNcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqL1xuICBmdW5jdGlvbiBDaGFpbihvcHRzKSB7XG4gICAgdGhpcy5vcHRzID0gb3B0cztcbiAgfVxuXG4gIENoYWluLnByb3RvdHlwZSA9IHtcbiAgICAvKipcbiAgICAgKiBDb25zdHJ1Y3QgYSBsaW5rIGluIHRoZSBjaGFpbiBvZiBjYWxscy5cbiAgICAgKiBAcGFyYW0gb3B0c1xuICAgICAqIEBwYXJhbSBvcHRzLmZuXG4gICAgICogQHBhcmFtIG9wdHMudHlwZVxuICAgICAqL1xuICAgIF9oYW5kbGVyTGluazogZnVuY3Rpb24ob3B0cykge1xuICAgICAgdmFyIGZpcnN0TGluaztcbiAgICAgIGZpcnN0TGluayA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgdHlwID0gb3B0cy50eXBlO1xuICAgICAgICBpZiAob3B0cy5mbilcbiAgICAgICAgICB0aGlzLl9yZW1vdmVMaXN0ZW5lcihvcHRzLmZuLCB0eXApO1xuICAgICAgICBpZiAoZmlyc3RMaW5rLl9wYXJlbnRMaW5rKSBmaXJzdExpbmsuX3BhcmVudExpbmsoKTsgLy8gQ2FuY2VsIGxpc3RlbmVycyBhbGwgdGhlIHdheSB1cCB0aGUgY2hhaW4uXG4gICAgICB9LmJpbmQodGhpcyk7XG4gICAgICBPYmplY3Qua2V5cyh0aGlzLm9wdHMpLmZvckVhY2goZnVuY3Rpb24ocHJvcCkge1xuICAgICAgICB2YXIgZnVuYyA9IHRoaXMub3B0c1twcm9wXTtcbiAgICAgICAgZmlyc3RMaW5rW3Byb3BdID0gYXJnc2FycmF5KGZ1bmN0aW9uKGFyZ3MpIHtcbiAgICAgICAgICB2YXIgbGluayA9IGZ1bmMuYXBwbHkoZnVuYy5fX3NpZXN0YV9ib3VuZF9vYmplY3QsIGFyZ3MpO1xuICAgICAgICAgIGxpbmsuX3BhcmVudExpbmsgPSBmaXJzdExpbms7XG4gICAgICAgICAgcmV0dXJuIGxpbms7XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgZmlyc3RMaW5rLl9wYXJlbnRMaW5rID0gbnVsbDtcbiAgICAgIHJldHVybiBmaXJzdExpbms7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBDb25zdHJ1Y3QgYSBsaW5rIGluIHRoZSBjaGFpbiBvZiBjYWxscy5cbiAgICAgKiBAcGFyYW0gb3B0c1xuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjbGVhbl1cbiAgICAgKi9cbiAgICBfbGluazogZnVuY3Rpb24ob3B0cywgY2xlYW4pIHtcbiAgICAgIHZhciBjaGFpbiA9IHRoaXM7XG4gICAgICBjbGVhbiA9IGNsZWFuIHx8IGZ1bmN0aW9uKCkge307XG4gICAgICB2YXIgbGluaztcbiAgICAgIGxpbmsgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgY2xlYW4oKTtcbiAgICAgICAgaWYgKGxpbmsuX3BhcmVudExpbmspIGxpbmsuX3BhcmVudExpbmsoKTsgLy8gQ2FuY2VsIGxpc3RlbmVycyBhbGwgdGhlIHdheSB1cCB0aGUgY2hhaW4uXG4gICAgICB9LmJpbmQodGhpcyk7XG4gICAgICBsaW5rLl9fc2llc3RhX2lzTGluayA9IHRydWU7XG4gICAgICBsaW5rLm9wdHMgPSBvcHRzO1xuICAgICAgbGluay5jbGVhbiA9IGNsZWFuO1xuICAgICAgT2JqZWN0LmtleXMob3B0cykuZm9yRWFjaChmdW5jdGlvbihwcm9wKSB7XG4gICAgICAgIHZhciBmdW5jID0gb3B0c1twcm9wXTtcbiAgICAgICAgbGlua1twcm9wXSA9IGFyZ3NhcnJheShmdW5jdGlvbihhcmdzKSB7XG4gICAgICAgICAgdmFyIHBvc3NpYmxlTGluayA9IGZ1bmMuYXBwbHkoZnVuYy5fX3NpZXN0YV9ib3VuZF9vYmplY3QsIGFyZ3MpO1xuICAgICAgICAgIGlmICghcG9zc2libGVMaW5rIHx8ICFwb3NzaWJsZUxpbmsuX19zaWVzdGFfaXNMaW5rKSB7IC8vIFBhdGNoIGluIGEgbGluayBpbiB0aGUgY2hhaW4gdG8gYXZvaWQgaXQgYmVpbmcgYnJva2VuLCBiYXNpbmcgb2ZmIHRoZSBjdXJyZW50IGxpbmtcbiAgICAgICAgICAgIG5leHRMaW5rID0gY2hhaW4uX2xpbmsobGluay5vcHRzKTtcbiAgICAgICAgICAgIGZvciAodmFyIHByb3AgaW4gcG9zc2libGVMaW5rKSB7XG4gICAgICAgICAgICAgIC8vbm9pbnNwZWN0aW9uIEpTVW5maWx0ZXJlZEZvckluTG9vcFxuICAgICAgICAgICAgICBpZiAocG9zc2libGVMaW5rW3Byb3BdIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAvL25vaW5zcGVjdGlvbiBKU1VuZmlsdGVyZWRGb3JJbkxvb3BcbiAgICAgICAgICAgICAgICBuZXh0TGlua1twcm9wXSA9IHBvc3NpYmxlTGlua1twcm9wXTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHZhciBuZXh0TGluayA9IHBvc3NpYmxlTGluaztcbiAgICAgICAgICB9XG4gICAgICAgICAgbmV4dExpbmsuX3BhcmVudExpbmsgPSBsaW5rO1xuICAgICAgICAgIC8vIEluaGVyaXQgbWV0aG9kcyBmcm9tIHRoZSBwYXJlbnQgbGluayBpZiB0aG9zZSBtZXRob2RzIGRvbid0IGFscmVhZHkgZXhpc3QuXG4gICAgICAgICAgZm9yIChwcm9wIGluIGxpbmspIHtcbiAgICAgICAgICAgIGlmIChsaW5rW3Byb3BdIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICAgICAgICAgICAgbmV4dExpbmtbcHJvcF0gPSBsaW5rW3Byb3BdLmJpbmQobGluayk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBuZXh0TGluaztcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICBsaW5rLl9wYXJlbnRMaW5rID0gbnVsbDtcbiAgICAgIHJldHVybiBsaW5rO1xuICAgIH1cbiAgfTtcbiAgbW9kdWxlLmV4cG9ydHMgPSBDaGFpbjtcbn0pKCk7IiwiKGZ1bmN0aW9uICgpIHtcbiAgICAvKipcbiAgICAgKiBAbW9kdWxlIHJlbGF0aW9uc2hpcHNcbiAgICAgKi9cblxuICAgIHZhciBSZWxhdGlvbnNoaXBQcm94eSA9IHJlcXVpcmUoJy4vUmVsYXRpb25zaGlwUHJveHknKSxcbiAgICAgICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgICAgICBfID0gdXRpbC5fLFxuICAgICAgICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgICAgICAgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgICAgICAgd3JhcEFycmF5Rm9yQXR0cmlidXRlcyA9IGV2ZW50cy53cmFwQXJyYXksXG4gICAgICAgIEFycmF5T2JzZXJ2ZXIgPSByZXF1aXJlKCcuLi92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZScpLkFycmF5T2JzZXJ2ZXIsXG4gICAgICAgIE1vZGVsRXZlbnRUeXBlID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLk1vZGVsRXZlbnRUeXBlO1xuXG4gICAgLyoqXG4gICAgICogW01hbnlUb01hbnlQcm94eSBkZXNjcmlwdGlvbl1cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICAgICAqL1xuICAgIGZ1bmN0aW9uIE1hbnlUb01hbnlQcm94eShvcHRzKSB7XG4gICAgICAgIFJlbGF0aW9uc2hpcFByb3h5LmNhbGwodGhpcywgb3B0cyk7XG4gICAgICAgIHRoaXMucmVsYXRlZCA9IFtdO1xuICAgICAgICB0aGlzLnJlbGF0ZWRDYW5jZWxMaXN0ZW5lcnMgPSB7fTtcbiAgICB9XG5cbiAgICBNYW55VG9NYW55UHJveHkucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUpO1xuXG4gICAgXy5leHRlbmQoTWFueVRvTWFueVByb3h5LnByb3RvdHlwZSwge1xuICAgICAgICBjbGVhclJldmVyc2U6IGZ1bmN0aW9uIChyZW1vdmVkKSB7XG4gICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICBfLmVhY2gocmVtb3ZlZCwgZnVuY3Rpb24gKHJlbW92ZWRPYmplY3QpIHtcbiAgICAgICAgICAgICAgICB2YXIgcmV2ZXJzZVByb3h5ID0gc2VsZi5yZXZlcnNlUHJveHlGb3JJbnN0YW5jZShyZW1vdmVkT2JqZWN0KTtcbiAgICAgICAgICAgICAgICB2YXIgaWR4ID0gcmV2ZXJzZVByb3h5LnJlbGF0ZWQuaW5kZXhPZihzZWxmLm9iamVjdCk7XG4gICAgICAgICAgICAgICAgcmV2ZXJzZVByb3h5Lm1ha2VDaGFuZ2VzVG9SZWxhdGVkV2l0aG91dE9ic2VydmF0aW9ucyhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldmVyc2VQcm94eS5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBzZXRSZXZlcnNlT2ZBZGRlZDogZnVuY3Rpb24gKGFkZGVkKSB7XG4gICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICBfLmVhY2goYWRkZWQsIGZ1bmN0aW9uIChhZGRlZE9iamVjdCkge1xuICAgICAgICAgICAgICAgIHZhciByZXZlcnNlUHJveHkgPSBzZWxmLnJldmVyc2VQcm94eUZvckluc3RhbmNlKGFkZGVkT2JqZWN0KTtcbiAgICAgICAgICAgICAgICByZXZlcnNlUHJveHkubWFrZUNoYW5nZXNUb1JlbGF0ZWRXaXRob3V0T2JzZXJ2YXRpb25zKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV2ZXJzZVByb3h5LnNwbGljZSgwLCAwLCBzZWxmLm9iamVjdCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgd3JhcEFycmF5OiBmdW5jdGlvbiAoYXJyKSB7XG4gICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzKGFyciwgdGhpcy5yZXZlcnNlTmFtZSwgdGhpcy5vYmplY3QpO1xuICAgICAgICAgICAgaWYgKCFhcnIuYXJyYXlPYnNlcnZlcikge1xuICAgICAgICAgICAgICAgIGFyci5hcnJheU9ic2VydmVyID0gbmV3IEFycmF5T2JzZXJ2ZXIoYXJyKTtcbiAgICAgICAgICAgICAgICB2YXIgb2JzZXJ2ZXJGdW5jdGlvbiA9IGZ1bmN0aW9uIChzcGxpY2VzKSB7XG4gICAgICAgICAgICAgICAgICAgIHNwbGljZXMuZm9yRWFjaChmdW5jdGlvbiAoc3BsaWNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgYWRkZWQgPSBzcGxpY2UuYWRkZWRDb3VudCA/IGFyci5zbGljZShzcGxpY2UuaW5kZXgsIHNwbGljZS5pbmRleCArIHNwbGljZS5hZGRlZENvdW50KSA6IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlbW92ZWQgPSBzcGxpY2UucmVtb3ZlZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuY2xlYXJSZXZlcnNlKHJlbW92ZWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5zZXRSZXZlcnNlT2ZBZGRlZChhZGRlZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbW9kZWwgPSBzZWxmLmdldEZvcndhcmRNb2RlbCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbjogbW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWw6IG1vZGVsLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9jYWxJZDogc2VsZi5vYmplY3QubG9jYWxJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWVsZDogc2VsZi5nZXRGb3J3YXJkTmFtZSgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWRkZWQ6IGFkZGVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRleDogc3BsaWNlLmluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iajogc2VsZi5vYmplY3RcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGFyci5hcnJheU9ic2VydmVyLm9wZW4ob2JzZXJ2ZXJGdW5jdGlvbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGdldDogZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgICAgICBjYihudWxsLCB0aGlzLnJlbGF0ZWQpO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfSxcbiAgICAgICAgdmFsaWRhdGU6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSAhPSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICdDYW5ub3QgYXNzaWduIHNjYWxhciB0byBtYW55IHRvIG1hbnknO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24gKG9iaiwgb3B0cykge1xuICAgICAgICAgICAgdGhpcy5jaGVja0luc3RhbGxlZCgpO1xuICAgICAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAgICAgaWYgKG9iaikge1xuICAgICAgICAgICAgICAgIHZhciBlcnJvck1lc3NhZ2U7XG4gICAgICAgICAgICAgICAgaWYgKGVycm9yTWVzc2FnZSA9IHRoaXMudmFsaWRhdGUob2JqKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JNZXNzYWdlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jbGVhclJldmVyc2VSZWxhdGVkKG9wdHMpO1xuICAgICAgICAgICAgICAgICAgICBzZWxmLnNldElkQW5kUmVsYXRlZChvYmosIG9wdHMpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLndyYXBBcnJheShvYmopO1xuICAgICAgICAgICAgICAgICAgICBzZWxmLnNldElkQW5kUmVsYXRlZFJldmVyc2Uob2JqLCBvcHRzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNsZWFyUmV2ZXJzZVJlbGF0ZWQob3B0cyk7XG4gICAgICAgICAgICAgICAgc2VsZi5zZXRJZEFuZFJlbGF0ZWQob2JqLCBvcHRzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgaW5zdGFsbDogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICAgICAgUmVsYXRpb25zaGlwUHJveHkucHJvdG90eXBlLmluc3RhbGwuY2FsbCh0aGlzLCBvYmopO1xuICAgICAgICAgICAgdGhpcy53cmFwQXJyYXkodGhpcy5yZWxhdGVkKTtcbiAgICAgICAgICAgIG9ialsoJ3NwbGljZScgKyB1dGlsLmNhcGl0YWxpc2VGaXJzdExldHRlcih0aGlzLnJldmVyc2VOYW1lKSldID0gXy5iaW5kKHRoaXMuc3BsaWNlLCB0aGlzKTtcbiAgICAgICAgfSxcbiAgICAgICAgcmVnaXN0ZXJSZW1vdmFsTGlzdGVuZXI6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgICAgIHRoaXMucmVsYXRlZENhbmNlbExpc3RlbmVyc1tvYmoubG9jYWxJZF0gPSBvYmoub24oJyonLCBmdW5jdGlvbiAoZSkge1xuXG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgfSk7XG5cblxuICAgIG1vZHVsZS5leHBvcnRzID0gTWFueVRvTWFueVByb3h5O1xufSkoKTsiLCIoZnVuY3Rpb24oKSB7XG4gIHZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpLFxuICAgIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICBfID0gdXRpbC5fLFxuICAgIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLFxuICAgIEludGVybmFsU2llc3RhRXJyb3IgPSBlcnJvci5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICAgIE1vZGVsRXZlbnRUeXBlID0gbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUsXG4gICAgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgICBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKTtcblxuICBmdW5jdGlvbiBNb2RlbEluc3RhbmNlKG1vZGVsKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHRoaXMubW9kZWwgPSBtb2RlbDtcblxuICAgIHV0aWwuc3ViUHJvcGVydGllcyh0aGlzLCB0aGlzLm1vZGVsLCBbXG4gICAgICAnY29sbGVjdGlvbicsXG4gICAgICAnY29sbGVjdGlvbk5hbWUnLFxuICAgICAgJ19hdHRyaWJ1dGVOYW1lcycsXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICdpZEZpZWxkJyxcbiAgICAgICAgcHJvcGVydHk6ICdpZCdcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICdtb2RlbE5hbWUnLFxuICAgICAgICBwcm9wZXJ0eTogJ25hbWUnXG4gICAgICB9XG4gICAgXSk7XG5cbiAgICBldmVudHMuUHJveHlFdmVudEVtaXR0ZXIuY2FsbCh0aGlzKTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHRoaXMsIHtcbiAgICAgIF9yZWxhdGlvbnNoaXBOYW1lczoge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBwcm94aWVzID0gXy5tYXAoT2JqZWN0LmtleXMoc2VsZi5fX3Byb3hpZXMgfHwge30pLCBmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICByZXR1cm4gc2VsZi5fX3Byb3hpZXNbeF1cbiAgICAgICAgICB9KTtcbiAgICAgICAgICByZXR1cm4gXy5tYXAocHJveGllcywgZnVuY3Rpb24ocCkge1xuICAgICAgICAgICAgaWYgKHAuaXNGb3J3YXJkKSB7XG4gICAgICAgICAgICAgIHJldHVybiBwLmZvcndhcmROYW1lO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHAucmV2ZXJzZU5hbWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgfSxcbiAgICAgIGRpcnR5OiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgaWYgKHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBzZWxmLmxvY2FsSWQgaW4gc2llc3RhLmV4dC5zdG9yYWdlLl91bnNhdmVkT2JqZWN0c0hhc2g7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2UgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgICAgfSxcbiAgICAgIC8vIFRoaXMgaXMgZm9yIFByb3h5RXZlbnRFbWl0dGVyLlxuICAgICAgZXZlbnQ6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5sb2NhbElkXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMucmVtb3ZlZCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogV2hldGhlciBvciBub3QgZXZlbnRzIChzZXQsIHJlbW92ZSBldGMpIGFyZSBlbWl0dGVkIGZvciB0aGlzIG1vZGVsIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogVGhpcyBpcyB1c2VkIGFzIGEgd2F5IG9mIGNvbnRyb2xsaW5nIHdoYXQgZXZlbnRzIGFyZSBlbWl0dGVkIHdoZW4gdGhlIG1vZGVsIGluc3RhbmNlIGlzIGNyZWF0ZWQuIEUuZy4gd2UgZG9uJ3RcbiAgICAgKiB3YW50IHRvIHNlbmQgYSBtZXRyaWMgc2hpdCB0b24gb2YgJ3NldCcgZXZlbnRzIGlmIHdlJ3JlIG5ld2x5IGNyZWF0aW5nIGFuIGluc3RhbmNlLiBXZSBvbmx5IHdhbnQgdG8gc2VuZCB0aGVcbiAgICAgKiAnbmV3JyBldmVudCBvbmNlIGNvbnN0cnVjdGVkLlxuICAgICAqXG4gICAgICogVGhpcyBpcyBwcm9iYWJseSBhIGJpdCBvZiBhIGhhY2sgYW5kIHNob3VsZCBiZSByZW1vdmVkIGV2ZW50dWFsbHkuXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICB0aGlzLl9lbWl0RXZlbnRzID0gZmFsc2U7XG4gIH1cblxuICBNb2RlbEluc3RhbmNlLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoZXZlbnRzLlByb3h5RXZlbnRFbWl0dGVyLnByb3RvdHlwZSk7XG5cbiAgXy5leHRlbmQoTW9kZWxJbnN0YW5jZS5wcm90b3R5cGUsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKGNiKSB7XG4gICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgICBjYihudWxsLCB0aGlzKTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfSxcbiAgICBlbWl0OiBmdW5jdGlvbih0eXBlLCBvcHRzKSB7XG4gICAgICBpZiAodHlwZW9mIHR5cGUgPT0gJ29iamVjdCcpIG9wdHMgPSB0eXBlO1xuICAgICAgZWxzZSBvcHRzLnR5cGUgPSB0eXBlO1xuICAgICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgICBfLmV4dGVuZChvcHRzLCB7XG4gICAgICAgIGNvbGxlY3Rpb246IHRoaXMuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgIG1vZGVsOiB0aGlzLm1vZGVsLm5hbWUsXG4gICAgICAgIGxvY2FsSWQ6IHRoaXMubG9jYWxJZCxcbiAgICAgICAgb2JqOiB0aGlzXG4gICAgICB9KTtcbiAgICAgIG1vZGVsRXZlbnRzLmVtaXQob3B0cyk7XG4gICAgfSxcbiAgICByZW1vdmU6IGZ1bmN0aW9uKGNiLCBub3RpZmljYXRpb24pIHtcbiAgICAgIG5vdGlmaWNhdGlvbiA9IG5vdGlmaWNhdGlvbiA9PSBudWxsID8gdHJ1ZSA6IG5vdGlmaWNhdGlvbjtcbiAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICAgIGNhY2hlLnJlbW92ZSh0aGlzKTtcbiAgICAgICAgdGhpcy5yZW1vdmVkID0gdHJ1ZTtcbiAgICAgICAgaWYgKG5vdGlmaWNhdGlvbikge1xuICAgICAgICAgIHRoaXMuZW1pdChtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5SZW1vdmUsIHtcbiAgICAgICAgICAgIG9sZDogdGhpc1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHZhciByZW1vdmUgPSB0aGlzLm1vZGVsLnJlbW92ZTtcbiAgICAgICAgaWYgKHJlbW92ZSkge1xuICAgICAgICAgIHZhciBwYXJhbU5hbWVzID0gdXRpbC5wYXJhbU5hbWVzKHJlbW92ZSk7XG4gICAgICAgICAgaWYgKHBhcmFtTmFtZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICByZW1vdmUuY2FsbCh0aGlzLCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgY2IoZXJyLCBzZWxmKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJlbW92ZS5jYWxsKHRoaXMpO1xuICAgICAgICAgICAgY2IobnVsbCwgdGhpcyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGNiKG51bGwsIHRoaXMpO1xuICAgICAgICB9XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH0sXG4gICAgcmVzdG9yZTogZnVuY3Rpb24oY2IpIHtcbiAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICAgIHZhciBfZmluaXNoID0gZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgIHRoaXMuZW1pdChtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5OZXcsIHtcbiAgICAgICAgICAgICAgbmV3OiB0aGlzXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY2IoZXJyLCB0aGlzKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICBpZiAodGhpcy5yZW1vdmVkKSB7XG4gICAgICAgICAgY2FjaGUuaW5zZXJ0KHRoaXMpO1xuICAgICAgICAgIHRoaXMucmVtb3ZlZCA9IGZhbHNlO1xuICAgICAgICAgIHZhciBpbml0ID0gdGhpcy5tb2RlbC5pbml0O1xuICAgICAgICAgIGlmIChpbml0KSB7XG4gICAgICAgICAgICB2YXIgcGFyYW1OYW1lcyA9IHV0aWwucGFyYW1OYW1lcyhpbml0KTtcbiAgICAgICAgICAgIHZhciBmcm9tU3RvcmFnZSA9IHRydWU7XG4gICAgICAgICAgICBpZiAocGFyYW1OYW1lcy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgIGluaXQuY2FsbCh0aGlzLCBmcm9tU3RvcmFnZSwgX2ZpbmlzaCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgaW5pdC5jYWxsKHRoaXMsIGZyb21TdG9yYWdlKTtcbiAgICAgICAgICAgICAgX2ZpbmlzaCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIF9maW5pc2goKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfVxuICB9KTtcblxuICAvLyBJbnNwZWN0aW9uXG4gIF8uZXh0ZW5kKE1vZGVsSW5zdGFuY2UucHJvdG90eXBlLCB7XG4gICAgZ2V0QXR0cmlidXRlczogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gXy5leHRlbmQoe30sIHRoaXMuX192YWx1ZXMpO1xuICAgIH0sXG4gICAgaXNJbnN0YW5jZU9mOiBmdW5jdGlvbihtb2RlbCkge1xuICAgICAgcmV0dXJuIHRoaXMubW9kZWwgPT0gbW9kZWw7XG4gICAgfSxcbiAgICBpc0E6IGZ1bmN0aW9uKG1vZGVsKSB7XG4gICAgICByZXR1cm4gdGhpcy5tb2RlbCA9PSBtb2RlbCB8fCB0aGlzLm1vZGVsLmlzRGVzY2VuZGFudE9mKG1vZGVsKTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIER1bXBcbiAgXy5leHRlbmQoTW9kZWxJbnN0YW5jZS5wcm90b3R5cGUsIHtcbiAgICBfZHVtcFN0cmluZzogZnVuY3Rpb24ocmV2ZXJzZVJlbGF0aW9uc2hpcHMpIHtcbiAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh0aGlzLl9kdW1wKHJldmVyc2VSZWxhdGlvbnNoaXBzLCBudWxsLCA0KSk7XG4gICAgfSxcbiAgICBfZHVtcDogZnVuY3Rpb24ocmV2ZXJzZVJlbGF0aW9uc2hpcHMpIHtcbiAgICAgIHZhciBkdW1wZWQgPSBfLmV4dGVuZCh7fSwgdGhpcy5fX3ZhbHVlcyk7XG4gICAgICBkdW1wZWQuX3JldiA9IHRoaXMuX3JldjtcbiAgICAgIGR1bXBlZC5sb2NhbElkID0gdGhpcy5sb2NhbElkO1xuICAgICAgcmV0dXJuIGR1bXBlZDtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIFNlcmlhbGlzYXRpb25cbiAgXy5leHRlbmQoTW9kZWxJbnN0YW5jZS5wcm90b3R5cGUsIHtcbiAgICBfZGVmYXVsdFNlcmlhbGlzZTogZnVuY3Rpb24ob3B0cykge1xuICAgICAgdmFyIHNlcmlhbGlzZWQgPSB7fTtcbiAgICAgIHZhciBpbmNsdWRlTnVsbEF0dHJpYnV0ZXMgPSBvcHRzLmluY2x1ZGVOdWxsQXR0cmlidXRlcyAhPT0gdW5kZWZpbmVkID8gb3B0cy5pbmNsdWRlTnVsbEF0dHJpYnV0ZXMgOiB0cnVlLFxuICAgICAgICBpbmNsdWRlTnVsbFJlbGF0aW9uc2hpcHMgPSBvcHRzLmluY2x1ZGVOdWxsUmVsYXRpb25zaGlwcyAhPT0gdW5kZWZpbmVkID8gb3B0cy5pbmNsdWRlTnVsbFJlbGF0aW9uc2hpcHMgOiB0cnVlO1xuICAgICAgdmFyIHNlcmlhbGlzYWJsZUZpZWxkcyA9IHRoaXMubW9kZWwuc2VyaWFsaXNhYmxlRmllbGRzIHx8XG4gICAgICAgIHRoaXMuX2F0dHJpYnV0ZU5hbWVzLmNvbmNhdC5hcHBseSh0aGlzLl9hdHRyaWJ1dGVOYW1lcywgdGhpcy5fcmVsYXRpb25zaGlwTmFtZXMpLmNvbmNhdCh0aGlzLmlkKTtcbiAgICAgIF8uZWFjaCh0aGlzLl9hdHRyaWJ1dGVOYW1lcywgZnVuY3Rpb24oYXR0ck5hbWUpIHtcbiAgICAgICAgaWYgKHNlcmlhbGlzYWJsZUZpZWxkcy5pbmRleE9mKGF0dHJOYW1lKSA+IC0xKSB7XG4gICAgICAgICAgdmFyIGF0dHJEZWZpbml0aW9uID0gdGhpcy5tb2RlbC5fYXR0cmlidXRlRGVmaW5pdGlvbldpdGhOYW1lKGF0dHJOYW1lKSB8fCB7fTtcbiAgICAgICAgICB2YXIgc2VyaWFsaXNlcjtcbiAgICAgICAgICBpZiAoYXR0ckRlZmluaXRpb24uc2VyaWFsaXNlKSBzZXJpYWxpc2VyID0gYXR0ckRlZmluaXRpb24uc2VyaWFsaXNlLmJpbmQodGhpcyk7XG4gICAgICAgICAgZWxzZSBzZXJpYWxpc2VyID0gdGhpcy5tb2RlbC5zZXJpYWxpc2VGaWVsZC5iaW5kKHRoaXMsIGF0dHJOYW1lKTtcbiAgICAgICAgICB2YXIgdmFsID0gdGhpc1thdHRyTmFtZV07XG4gICAgICAgICAgaWYgKHZhbCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgaWYgKGluY2x1ZGVOdWxsQXR0cmlidXRlcykge1xuICAgICAgICAgICAgICBzZXJpYWxpc2VkW2F0dHJOYW1lXSA9IHNlcmlhbGlzZXIodmFsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSBpZiAodmFsICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHNlcmlhbGlzZWRbYXR0ck5hbWVdID0gc2VyaWFsaXNlcih2YWwpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgIF8uZWFjaCh0aGlzLl9yZWxhdGlvbnNoaXBOYW1lcywgZnVuY3Rpb24ocmVsTmFtZSkge1xuICAgICAgICBpZiAoc2VyaWFsaXNhYmxlRmllbGRzLmluZGV4T2YocmVsTmFtZSkgPiAtMSkge1xuICAgICAgICAgIHZhciB2YWwgPSB0aGlzW3JlbE5hbWVdLFxuICAgICAgICAgICAgcmVsID0gdGhpcy5tb2RlbC5yZWxhdGlvbnNoaXBzW3JlbE5hbWVdO1xuICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkodmFsKSkge1xuICAgICAgICAgICAgdmFsID0gXy5wbHVjayh2YWwsIHRoaXMubW9kZWwuaWQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIGlmICh2YWwpIHtcbiAgICAgICAgICAgIHZhbCA9IHZhbFt0aGlzLm1vZGVsLmlkXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHJlbCAmJiAhcmVsLmlzUmV2ZXJzZSkge1xuICAgICAgICAgICAgdmFyIHNlcmlhbGlzZXI7XG4gICAgICAgICAgICBpZiAocmVsLnNlcmlhbGlzZSkgc2VyaWFsaXNlciA9IHJlbC5zZXJpYWxpc2UuYmluZCh0aGlzKTtcbiAgICAgICAgICAgIGVsc2Ugc2VyaWFsaXNlciA9IHRoaXMubW9kZWwuc2VyaWFsaXNlRmllbGQuYmluZCh0aGlzLCByZWxOYW1lKTtcbiAgICAgICAgICAgIGlmICh2YWwgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgaWYgKGluY2x1ZGVOdWxsUmVsYXRpb25zaGlwcykge1xuICAgICAgICAgICAgICAgIHNlcmlhbGlzZWRbcmVsTmFtZV0gPSBzZXJpYWxpc2VyKHZhbCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHV0aWwuaXNBcnJheSh2YWwpKSB7XG4gICAgICAgICAgICAgIGlmICgoaW5jbHVkZU51bGxSZWxhdGlvbnNoaXBzICYmICF2YWwubGVuZ3RoKSB8fCB2YWwubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgc2VyaWFsaXNlZFtyZWxOYW1lXSA9IHNlcmlhbGlzZXIodmFsKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodmFsICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgc2VyaWFsaXNlZFtyZWxOYW1lXSA9IHNlcmlhbGlzZXIodmFsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICByZXR1cm4gc2VyaWFsaXNlZDtcbiAgICB9LFxuICAgIHNlcmlhbGlzZTogZnVuY3Rpb24ob3B0cykge1xuICAgICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgICBpZiAoIXRoaXMubW9kZWwuc2VyaWFsaXNlKSByZXR1cm4gdGhpcy5fZGVmYXVsdFNlcmlhbGlzZShvcHRzKTtcbiAgICAgIGVsc2UgcmV0dXJuIHRoaXMubW9kZWwuc2VyaWFsaXNlKHRoaXMsIG9wdHMpO1xuICAgIH1cbiAgfSk7XG5cbiAgXy5leHRlbmQoTW9kZWxJbnN0YW5jZS5wcm90b3R5cGUsIHtcbiAgICAvKipcbiAgICAgKiBFbWl0IGFuIGV2ZW50IGluZGljYXRpbmcgdGhhdCB0aGlzIGluc3RhbmNlIGhhcyBqdXN0IGJlZW4gY3JlYXRlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9lbWl0TmV3OiBmdW5jdGlvbigpIHtcbiAgICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgICAgICBjb2xsZWN0aW9uOiB0aGlzLm1vZGVsLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICBtb2RlbDogdGhpcy5tb2RlbC5uYW1lLFxuICAgICAgICBsb2NhbElkOiB0aGlzLmxvY2FsSWQsXG4gICAgICAgIG5ldzogdGhpcyxcbiAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuTmV3LFxuICAgICAgICBvYmo6IHRoaXNcbiAgICAgIH0pO1xuICAgIH1cbiAgfSk7XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBNb2RlbEluc3RhbmNlO1xufSkoKTsiLCIoZnVuY3Rpb24gKCkge1xuICAgIHZhciBSZWxhdGlvbnNoaXBQcm94eSA9IHJlcXVpcmUoJy4vUmVsYXRpb25zaGlwUHJveHknKSxcbiAgICAgICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgICAgICBfID0gdXRpbC5fLFxuICAgICAgICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgICAgICAgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgICAgICAgd3JhcEFycmF5Rm9yQXR0cmlidXRlcyA9IGV2ZW50cy53cmFwQXJyYXksXG4gICAgICAgIEFycmF5T2JzZXJ2ZXIgPSByZXF1aXJlKCcuLi92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZScpLkFycmF5T2JzZXJ2ZXIsXG4gICAgICAgIE1vZGVsRXZlbnRUeXBlID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLk1vZGVsRXZlbnRUeXBlO1xuXG4gICAgLyoqXG4gICAgICogQGNsYXNzICBbT25lVG9NYW55UHJveHkgZGVzY3JpcHRpb25dXG4gICAgICogQGNvbnN0cnVjdG9yXG4gICAgICogQHBhcmFtIHtbdHlwZV19IG9wdHNcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBPbmVUb01hbnlQcm94eShvcHRzKSB7XG4gICAgICAgIFJlbGF0aW9uc2hpcFByb3h5LmNhbGwodGhpcywgb3B0cyk7XG4gICAgICAgIGlmICh0aGlzLmlzUmV2ZXJzZSkgdGhpcy5yZWxhdGVkID0gW107XG4gICAgfVxuXG4gICAgT25lVG9NYW55UHJveHkucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUpO1xuXG4gICAgXy5leHRlbmQoT25lVG9NYW55UHJveHkucHJvdG90eXBlLCB7XG4gICAgICAgIGNsZWFyUmV2ZXJzZTogZnVuY3Rpb24gKHJlbW92ZWQpIHtcbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIF8uZWFjaChyZW1vdmVkLCBmdW5jdGlvbiAocmVtb3ZlZE9iamVjdCkge1xuICAgICAgICAgICAgICAgIHZhciByZXZlcnNlUHJveHkgPSBzZWxmLnJldmVyc2VQcm94eUZvckluc3RhbmNlKHJlbW92ZWRPYmplY3QpO1xuICAgICAgICAgICAgICAgIHJldmVyc2VQcm94eS5zZXRJZEFuZFJlbGF0ZWQobnVsbCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0UmV2ZXJzZU9mQWRkZWQ6IGZ1bmN0aW9uIChhZGRlZCkge1xuICAgICAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAgICAgXy5lYWNoKGFkZGVkLCBmdW5jdGlvbiAoYWRkZWQpIHtcbiAgICAgICAgICAgICAgICB2YXIgZm9yd2FyZFByb3h5ID0gc2VsZi5yZXZlcnNlUHJveHlGb3JJbnN0YW5jZShhZGRlZCk7XG4gICAgICAgICAgICAgICAgZm9yd2FyZFByb3h5LnNldElkQW5kUmVsYXRlZChzZWxmLm9iamVjdCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgd3JhcEFycmF5OiBmdW5jdGlvbiAoYXJyKSB7XG4gICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzKGFyciwgdGhpcy5yZXZlcnNlTmFtZSwgdGhpcy5vYmplY3QpO1xuICAgICAgICAgICAgaWYgKCFhcnIuYXJyYXlPYnNlcnZlcikge1xuICAgICAgICAgICAgICAgIGFyci5hcnJheU9ic2VydmVyID0gbmV3IEFycmF5T2JzZXJ2ZXIoYXJyKTtcbiAgICAgICAgICAgICAgICB2YXIgb2JzZXJ2ZXJGdW5jdGlvbiA9IGZ1bmN0aW9uIChzcGxpY2VzKSB7XG4gICAgICAgICAgICAgICAgICAgIHNwbGljZXMuZm9yRWFjaChmdW5jdGlvbiAoc3BsaWNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgYWRkZWQgPSBzcGxpY2UuYWRkZWRDb3VudCA/IGFyci5zbGljZShzcGxpY2UuaW5kZXgsIHNwbGljZS5pbmRleCArIHNwbGljZS5hZGRlZENvdW50KSA6IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlbW92ZWQgPSBzcGxpY2UucmVtb3ZlZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuY2xlYXJSZXZlcnNlKHJlbW92ZWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5zZXRSZXZlcnNlT2ZBZGRlZChhZGRlZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbW9kZWwgPSBzZWxmLmdldEZvcndhcmRNb2RlbCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbjogbW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWw6IG1vZGVsLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9jYWxJZDogc2VsZi5vYmplY3QubG9jYWxJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWVsZDogc2VsZi5nZXRGb3J3YXJkTmFtZSgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWRkZWQ6IGFkZGVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRleDogc3BsaWNlLmluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iajogc2VsZi5vYmplY3RcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGFyci5hcnJheU9ic2VydmVyLm9wZW4ob2JzZXJ2ZXJGdW5jdGlvbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGdldDogZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgICAgICBjYihudWxsLCB0aGlzLnJlbGF0ZWQpO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfSxcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFZhbGlkYXRlIHRoZSBvYmplY3QgdGhhdCB3ZSdyZSBzZXR0aW5nXG4gICAgICAgICAqIEBwYXJhbSBvYmpcbiAgICAgICAgICogQHJldHVybnMge3N0cmluZ3xudWxsfSBBbiBlcnJvciBtZXNzYWdlIG9yIG51bGxcbiAgICAgICAgICogQGNsYXNzIE9uZVRvTWFueVByb3h5XG4gICAgICAgICAqL1xuICAgICAgICB2YWxpZGF0ZTogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICAgICAgdmFyIHN0ciA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopO1xuICAgICAgICAgICAgaWYgKHRoaXMuaXNGb3J3YXJkKSB7XG4gICAgICAgICAgICAgICAgaWYgKHN0ciA9PSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAnQ2Fubm90IGFzc2lnbiBhcnJheSBmb3J3YXJkIG9uZVRvTWFueSAoJyArIHN0ciArICcpOiAnICsgdGhpcy5mb3J3YXJkTmFtZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoc3RyICE9ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICdDYW5ub3Qgc2NhbGFyIHRvIHJldmVyc2Ugb25lVG9NYW55ICgnICsgc3RyICsgJyk6ICcgKyB0aGlzLnJldmVyc2VOYW1lO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uIChvYmosIG9wdHMpIHtcbiAgICAgICAgICAgIHRoaXMuY2hlY2tJbnN0YWxsZWQoKTtcbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIGlmIChvYmopIHtcbiAgICAgICAgICAgICAgICB2YXIgZXJyb3JNZXNzYWdlO1xuICAgICAgICAgICAgICAgIGlmIChlcnJvck1lc3NhZ2UgPSB0aGlzLnZhbGlkYXRlKG9iaikpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yTWVzc2FnZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2xlYXJSZXZlcnNlUmVsYXRlZChvcHRzKTtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5zZXRJZEFuZFJlbGF0ZWQob2JqLCBvcHRzKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNlbGYuaXNSZXZlcnNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLndyYXBBcnJheShzZWxmLnJlbGF0ZWQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuc2V0SWRBbmRSZWxhdGVkUmV2ZXJzZShvYmosIG9wdHMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuY2xlYXJSZXZlcnNlUmVsYXRlZChvcHRzKTtcbiAgICAgICAgICAgICAgICBzZWxmLnNldElkQW5kUmVsYXRlZChvYmosIG9wdHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBpbnN0YWxsOiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgICAgICBSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUuaW5zdGFsbC5jYWxsKHRoaXMsIG9iaik7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmlzUmV2ZXJzZSkge1xuICAgICAgICAgICAgICAgIG9ialsoJ3NwbGljZScgKyB1dGlsLmNhcGl0YWxpc2VGaXJzdExldHRlcih0aGlzLnJldmVyc2VOYW1lKSldID0gXy5iaW5kKHRoaXMuc3BsaWNlLCB0aGlzKTtcbiAgICAgICAgICAgICAgICB0aGlzLndyYXBBcnJheSh0aGlzLnJlbGF0ZWQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cbiAgICB9KTtcblxuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBPbmVUb01hbnlQcm94eTtcbn0pKCk7IiwiKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgUmVsYXRpb25zaGlwUHJveHkgPSByZXF1aXJlKCcuL1JlbGF0aW9uc2hpcFByb3h5JyksXG4gICAgICAgIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICAgICAgXyA9IHV0aWwuXyxcbiAgICAgICAgU2llc3RhTW9kZWwgPSByZXF1aXJlKCcuL01vZGVsSW5zdGFuY2UnKTtcblxuICAgIC8qKlxuICAgICAqIFtPbmVUb09uZVByb3h5IGRlc2NyaXB0aW9uXVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gICAgICovXG4gICAgZnVuY3Rpb24gT25lVG9PbmVQcm94eShvcHRzKSB7XG4gICAgICAgIFJlbGF0aW9uc2hpcFByb3h5LmNhbGwodGhpcywgb3B0cyk7XG4gICAgfVxuXG5cbiAgICBPbmVUb09uZVByb3h5LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoUmVsYXRpb25zaGlwUHJveHkucHJvdG90eXBlKTtcblxuICAgIF8uZXh0ZW5kKE9uZVRvT25lUHJveHkucHJvdG90eXBlLCB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBWYWxpZGF0ZSB0aGUgb2JqZWN0IHRoYXQgd2UncmUgc2V0dGluZ1xuICAgICAgICAgKiBAcGFyYW0gb2JqXG4gICAgICAgICAqIEByZXR1cm5zIHtzdHJpbmd8bnVsbH0gQW4gZXJyb3IgbWVzc2FnZSBvciBudWxsXG4gICAgICAgICAqL1xuICAgICAgICB2YWxpZGF0ZTogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopID09ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJ0Nhbm5vdCBhc3NpZ24gYXJyYXkgdG8gb25lIHRvIG9uZSByZWxhdGlvbnNoaXAnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoKCFvYmogaW5zdGFuY2VvZiBTaWVzdGFNb2RlbCkpIHtcblxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24gKG9iaiwgb3B0cykge1xuICAgICAgICAgICAgdGhpcy5jaGVja0luc3RhbGxlZCgpO1xuICAgICAgICAgICAgaWYgKG9iaikge1xuICAgICAgICAgICAgICAgIHZhciBlcnJvck1lc3NhZ2U7XG4gICAgICAgICAgICAgICAgaWYgKGVycm9yTWVzc2FnZSA9IHRoaXMudmFsaWRhdGUob2JqKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JNZXNzYWdlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jbGVhclJldmVyc2VSZWxhdGVkKG9wdHMpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNldElkQW5kUmVsYXRlZChvYmosIG9wdHMpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNldElkQW5kUmVsYXRlZFJldmVyc2Uob2JqLCBvcHRzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNsZWFyUmV2ZXJzZVJlbGF0ZWQob3B0cyk7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRJZEFuZFJlbGF0ZWQob2JqLCBvcHRzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgICAgIGNiKG51bGwsIHRoaXMucmVsYXRlZCk7XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgfSk7XG5cblxuICAgIG1vZHVsZS5leHBvcnRzID0gT25lVG9PbmVQcm94eTtcbn0pKCk7IiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgXyA9IHV0aWwuXztcblxuLyoqXG4gKiBBY3RzIGFzIGEgcGxhY2Vob2xkZXIgZm9yIHZhcmlvdXMgb2JqZWN0cyBlLmcuIGxhenkgcmVnaXN0cmF0aW9uIG9mIG1vZGVscy5cbiAqIEBwYXJhbSBbb3B0c11cbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBQbGFjZWhvbGRlcihvcHRzKSB7XG4gIF8uZXh0ZW5kKHRoaXMsIG9wdHMgfHwge30pO1xuICB0aGlzLmlzUGxhY2Vob2xkZXIgPSB0cnVlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFBsYWNlaG9sZGVyOyIsIihmdW5jdGlvbigpIHtcbiAgdmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJykoJ3F1ZXJ5JyksXG4gICAgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLFxuICAgIE1vZGVsSW5zdGFuY2UgPSByZXF1aXJlKCcuL01vZGVsSW5zdGFuY2UnKSxcbiAgICBjb25zdHJ1Y3RRdWVyeVNldCA9IHJlcXVpcmUoJy4vUXVlcnlTZXQnKSxcbiAgICBfID0gdXRpbC5fO1xuXG4gIC8qKlxuICAgKiBAY2xhc3MgW1F1ZXJ5IGRlc2NyaXB0aW9uXVxuICAgKiBAcGFyYW0ge01vZGVsfSBtb2RlbFxuICAgKiBAcGFyYW0ge09iamVjdH0gcXVlcnlcbiAgICovXG4gIGZ1bmN0aW9uIFF1ZXJ5KG1vZGVsLCBxdWVyeSkge1xuICAgIHZhciBvcHRzID0ge307XG4gICAgZm9yICh2YXIgcHJvcCBpbiBxdWVyeSkge1xuICAgICAgaWYgKHF1ZXJ5Lmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgIGlmIChwcm9wLnNsaWNlKDAsIDIpID09ICdfXycpIHtcbiAgICAgICAgICBvcHRzW3Byb3Auc2xpY2UoMildID0gcXVlcnlbcHJvcF07XG4gICAgICAgICAgZGVsZXRlIHF1ZXJ5W3Byb3BdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIF8uZXh0ZW5kKHRoaXMsIHtcbiAgICAgIG1vZGVsOiBtb2RlbCxcbiAgICAgIHF1ZXJ5OiBxdWVyeSxcbiAgICAgIG9wdHM6IG9wdHNcbiAgICB9KTtcbiAgICBvcHRzLm9yZGVyID0gb3B0cy5vcmRlciB8fCBbXTtcbiAgICBpZiAoIXV0aWwuaXNBcnJheShvcHRzLm9yZGVyKSkgb3B0cy5vcmRlciA9IFtvcHRzLm9yZGVyXTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHZhbHVlQXNTdHJpbmcoZmllbGRWYWx1ZSkge1xuICAgIHZhciBmaWVsZEFzU3RyaW5nO1xuICAgIGlmIChmaWVsZFZhbHVlID09PSBudWxsKSBmaWVsZEFzU3RyaW5nID0gJ251bGwnO1xuICAgIGVsc2UgaWYgKGZpZWxkVmFsdWUgPT09IHVuZGVmaW5lZCkgZmllbGRBc1N0cmluZyA9ICd1bmRlZmluZWQnO1xuICAgIGVsc2UgaWYgKGZpZWxkVmFsdWUgaW5zdGFuY2VvZiBNb2RlbEluc3RhbmNlKSBmaWVsZEFzU3RyaW5nID0gZmllbGRWYWx1ZS5sb2NhbElkO1xuICAgIGVsc2UgZmllbGRBc1N0cmluZyA9IGZpZWxkVmFsdWUudG9TdHJpbmcoKTtcbiAgICByZXR1cm4gZmllbGRBc1N0cmluZztcbiAgfVxuXG4gIGZ1bmN0aW9uIGNvbnRhaW5zKG9wdHMpIHtcbiAgICBpZiAoIW9wdHMuaW52YWxpZCkge1xuICAgICAgdmFyIGFyciA9IG9wdHMub2JqZWN0W29wdHMuZmllbGRdO1xuICAgICAgaWYgKHV0aWwuaXNBcnJheShhcnIpIHx8IHV0aWwuaXNTdHJpbmcoYXJyKSkge1xuICAgICAgICByZXR1cm4gYXJyLmluZGV4T2Yob3B0cy52YWx1ZSkgPiAtMTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgdmFyIGNvbXBhcmF0b3JzID0ge1xuICAgIGU6IGZ1bmN0aW9uKG9wdHMpIHtcbiAgICAgIHZhciBmaWVsZFZhbHVlID0gb3B0cy5vYmplY3Rbb3B0cy5maWVsZF07XG4gICAgICBpZiAobG9nLmVuYWJsZWQpIHtcbiAgICAgICAgbG9nKG9wdHMuZmllbGQgKyAnOiAnICsgdmFsdWVBc1N0cmluZyhmaWVsZFZhbHVlKSArICcgPT0gJyArIHZhbHVlQXNTdHJpbmcob3B0cy52YWx1ZSksIHtvcHRzOiBvcHRzfSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gZmllbGRWYWx1ZSA9PSBvcHRzLnZhbHVlO1xuICAgIH0sXG4gICAgbHQ6IGZ1bmN0aW9uKG9wdHMpIHtcbiAgICAgIGlmICghb3B0cy5pbnZhbGlkKSByZXR1cm4gb3B0cy5vYmplY3Rbb3B0cy5maWVsZF0gPCBvcHRzLnZhbHVlO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0sXG4gICAgZ3Q6IGZ1bmN0aW9uKG9wdHMpIHtcbiAgICAgIGlmICghb3B0cy5pbnZhbGlkKSByZXR1cm4gb3B0cy5vYmplY3Rbb3B0cy5maWVsZF0gPiBvcHRzLnZhbHVlO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0sXG4gICAgbHRlOiBmdW5jdGlvbihvcHRzKSB7XG4gICAgICBpZiAoIW9wdHMuaW52YWxpZCkgcmV0dXJuIG9wdHMub2JqZWN0W29wdHMuZmllbGRdIDw9IG9wdHMudmFsdWU7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSxcbiAgICBndGU6IGZ1bmN0aW9uKG9wdHMpIHtcbiAgICAgIGlmICghb3B0cy5pbnZhbGlkKSByZXR1cm4gb3B0cy5vYmplY3Rbb3B0cy5maWVsZF0gPj0gb3B0cy52YWx1ZTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9LFxuICAgIGNvbnRhaW5zOiBjb250YWlucyxcbiAgICBpbjogY29udGFpbnNcbiAgfTtcblxuICBfLmV4dGVuZChRdWVyeSwge1xuICAgIGNvbXBhcmF0b3JzOiBjb21wYXJhdG9ycyxcbiAgICByZWdpc3RlckNvbXBhcmF0b3I6IGZ1bmN0aW9uKHN5bWJvbCwgZm4pIHtcbiAgICAgIGlmICghY29tcGFyYXRvcnNbc3ltYm9sXSkge1xuICAgICAgICBjb21wYXJhdG9yc1tzeW1ib2xdID0gZm47XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICBmdW5jdGlvbiBjYWNoZUZvck1vZGVsKG1vZGVsKSB7XG4gICAgdmFyIGNhY2hlQnlUeXBlID0gY2FjaGUuX2xvY2FsQ2FjaGVCeVR5cGU7XG4gICAgdmFyIG1vZGVsTmFtZSA9IG1vZGVsLm5hbWU7XG4gICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gbW9kZWwuY29sbGVjdGlvbk5hbWU7XG4gICAgdmFyIGNhY2hlQnlNb2RlbCA9IGNhY2hlQnlUeXBlW2NvbGxlY3Rpb25OYW1lXTtcbiAgICB2YXIgY2FjaGVCeUxvY2FsSWQ7XG4gICAgaWYgKGNhY2hlQnlNb2RlbCkge1xuICAgICAgY2FjaGVCeUxvY2FsSWQgPSBjYWNoZUJ5TW9kZWxbbW9kZWxOYW1lXSB8fCB7fTtcbiAgICB9XG4gICAgcmV0dXJuIGNhY2hlQnlMb2NhbElkO1xuICB9XG5cbiAgXy5leHRlbmQoUXVlcnkucHJvdG90eXBlLCB7XG4gICAgZXhlY3V0ZTogZnVuY3Rpb24oY2IpIHtcbiAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICAgIHRoaXMuX2V4ZWN1dGVJbk1lbW9yeShjYik7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH0sXG4gICAgX2R1bXA6IGZ1bmN0aW9uKGFzSnNvbikge1xuICAgICAgcmV0dXJuIGFzSnNvbiA/ICd7fScgOiB7fTtcbiAgICB9LFxuICAgIHNvcnRGdW5jOiBmdW5jdGlvbihmaWVsZHMpIHtcbiAgICAgIHZhciBzb3J0RnVuYyA9IGZ1bmN0aW9uKGFzY2VuZGluZywgZmllbGQpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHYxLCB2Mikge1xuICAgICAgICAgIHZhciBkMSA9IHYxW2ZpZWxkXSxcbiAgICAgICAgICAgIGQyID0gdjJbZmllbGRdLFxuICAgICAgICAgICAgcmVzO1xuICAgICAgICAgIGlmICh0eXBlb2YgZDEgPT0gJ3N0cmluZycgfHwgZDEgaW5zdGFuY2VvZiBTdHJpbmcgJiZcbiAgICAgICAgICAgIHR5cGVvZiBkMiA9PSAnc3RyaW5nJyB8fCBkMiBpbnN0YW5jZW9mIFN0cmluZykge1xuICAgICAgICAgICAgcmVzID0gYXNjZW5kaW5nID8gZDEubG9jYWxlQ29tcGFyZShkMikgOiBkMi5sb2NhbGVDb21wYXJlKGQxKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBpZiAoZDEgaW5zdGFuY2VvZiBEYXRlKSBkMSA9IGQxLmdldFRpbWUoKTtcbiAgICAgICAgICAgIGlmIChkMiBpbnN0YW5jZW9mIERhdGUpIGQyID0gZDIuZ2V0VGltZSgpO1xuICAgICAgICAgICAgaWYgKGFzY2VuZGluZykgcmVzID0gZDEgLSBkMjtcbiAgICAgICAgICAgIGVsc2UgcmVzID0gZDIgLSBkMTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHJlcztcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIHZhciBzID0gdXRpbDtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZmllbGRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBmaWVsZCA9IGZpZWxkc1tpXTtcbiAgICAgICAgcyA9IHMudGhlbkJ5KHNvcnRGdW5jKGZpZWxkLmFzY2VuZGluZywgZmllbGQuZmllbGQpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzID09IHV0aWwgPyBudWxsIDogcztcbiAgICB9LFxuICAgIF9zb3J0UmVzdWx0czogZnVuY3Rpb24ocmVzKSB7XG4gICAgICB2YXIgb3JkZXIgPSB0aGlzLm9wdHMub3JkZXI7XG4gICAgICBpZiAocmVzICYmIG9yZGVyKSB7XG4gICAgICAgIHZhciBmaWVsZHMgPSBfLm1hcChvcmRlciwgZnVuY3Rpb24ob3JkZXJpbmcpIHtcbiAgICAgICAgICB2YXIgc3BsdCA9IG9yZGVyaW5nLnNwbGl0KCctJyksXG4gICAgICAgICAgICBhc2NlbmRpbmcgPSB0cnVlLFxuICAgICAgICAgICAgZmllbGQgPSBudWxsO1xuICAgICAgICAgIGlmIChzcGx0Lmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgIGZpZWxkID0gc3BsdFsxXTtcbiAgICAgICAgICAgIGFzY2VuZGluZyA9IGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGZpZWxkID0gc3BsdFswXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHtmaWVsZDogZmllbGQsIGFzY2VuZGluZzogYXNjZW5kaW5nfTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgdmFyIHNvcnRGdW5jID0gdGhpcy5zb3J0RnVuYyhmaWVsZHMpO1xuICAgICAgICBpZiAocmVzLmltbXV0YWJsZSkgcmVzID0gcmVzLm11dGFibGVDb3B5KCk7XG4gICAgICAgIGlmIChzb3J0RnVuYykgcmVzLnNvcnQoc29ydEZ1bmMpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlcztcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFJldHVybiBhbGwgbW9kZWwgaW5zdGFuY2VzIGluIHRoZSBjYWNoZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9nZXRDYWNoZUJ5TG9jYWxJZDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gXy5yZWR1Y2UodGhpcy5tb2RlbC5kZXNjZW5kYW50cywgZnVuY3Rpb24obWVtbywgY2hpbGRNb2RlbCkge1xuICAgICAgICByZXR1cm4gXy5leHRlbmQobWVtbywgY2FjaGVGb3JNb2RlbChjaGlsZE1vZGVsKSk7XG4gICAgICB9LCBfLmV4dGVuZCh7fSwgY2FjaGVGb3JNb2RlbCh0aGlzLm1vZGVsKSkpO1xuICAgIH0sXG4gICAgX2V4ZWN1dGVJbk1lbW9yeTogZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICAgIHZhciBfZXhlY3V0ZUluTWVtb3J5ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBjYWNoZUJ5TG9jYWxJZCA9IHRoaXMuX2dldENhY2hlQnlMb2NhbElkKCk7XG4gICAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMoY2FjaGVCeUxvY2FsSWQpO1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHZhciByZXMgPSBbXTtcbiAgICAgICAgdmFyIGVycjtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgdmFyIGsgPSBrZXlzW2ldO1xuICAgICAgICAgIHZhciBvYmogPSBjYWNoZUJ5TG9jYWxJZFtrXTtcbiAgICAgICAgICB2YXIgbWF0Y2hlcyA9IHNlbGYub2JqZWN0TWF0Y2hlc1F1ZXJ5KG9iaik7XG4gICAgICAgICAgaWYgKHR5cGVvZihtYXRjaGVzKSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgZXJyID0gZXJyb3IobWF0Y2hlcyk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKG1hdGNoZXMpIHJlcy5wdXNoKG9iaik7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJlcyA9IHRoaXMuX3NvcnRSZXN1bHRzKHJlcyk7XG4gICAgICAgIGlmIChlcnIpIGxvZygnRXJyb3IgZXhlY3V0aW5nIHF1ZXJ5JywgZXJyKTtcbiAgICAgICAgY2FsbGJhY2soZXJyLCBlcnIgPyBudWxsIDogY29uc3RydWN0UXVlcnlTZXQocmVzLCB0aGlzLm1vZGVsKSk7XG4gICAgICB9LmJpbmQodGhpcyk7XG4gICAgICBpZiAodGhpcy5vcHRzLmlnbm9yZUluc3RhbGxlZCkge1xuICAgICAgICBfZXhlY3V0ZUluTWVtb3J5KCk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgc2llc3RhLl9hZnRlckluc3RhbGwoX2V4ZWN1dGVJbk1lbW9yeSk7XG4gICAgICB9XG5cbiAgICB9LFxuICAgIGNsZWFyT3JkZXJpbmc6IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5vcHRzLm9yZGVyID0gbnVsbDtcbiAgICB9LFxuICAgIG9iamVjdE1hdGNoZXNPclF1ZXJ5OiBmdW5jdGlvbihvYmosIG9yUXVlcnkpIHtcbiAgICAgIGZvciAodmFyIGlkeCBpbiBvclF1ZXJ5KSB7XG4gICAgICAgIGlmIChvclF1ZXJ5Lmhhc093blByb3BlcnR5KGlkeCkpIHtcbiAgICAgICAgICB2YXIgcXVlcnkgPSBvclF1ZXJ5W2lkeF07XG4gICAgICAgICAgaWYgKHRoaXMub2JqZWN0TWF0Y2hlc0Jhc2VRdWVyeShvYmosIHF1ZXJ5KSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSxcbiAgICBvYmplY3RNYXRjaGVzQW5kUXVlcnk6IGZ1bmN0aW9uKG9iaiwgYW5kUXVlcnkpIHtcbiAgICAgIGZvciAodmFyIGlkeCBpbiBhbmRRdWVyeSkge1xuICAgICAgICBpZiAoYW5kUXVlcnkuaGFzT3duUHJvcGVydHkoaWR4KSkge1xuICAgICAgICAgIHZhciBxdWVyeSA9IGFuZFF1ZXJ5W2lkeF07XG4gICAgICAgICAgaWYgKCF0aGlzLm9iamVjdE1hdGNoZXNCYXNlUXVlcnkob2JqLCBxdWVyeSkpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0sXG4gICAgc3BsaXRNYXRjaGVzOiBmdW5jdGlvbihvYmosIHVucHJvY2Vzc2VkRmllbGQsIHZhbHVlKSB7XG4gICAgICB2YXIgb3AgPSAnZSc7XG4gICAgICB2YXIgZmllbGRzID0gdW5wcm9jZXNzZWRGaWVsZC5zcGxpdCgnLicpO1xuICAgICAgdmFyIHNwbHQgPSBmaWVsZHNbZmllbGRzLmxlbmd0aCAtIDFdLnNwbGl0KCdfXycpO1xuICAgICAgaWYgKHNwbHQubGVuZ3RoID09IDIpIHtcbiAgICAgICAgdmFyIGZpZWxkID0gc3BsdFswXTtcbiAgICAgICAgb3AgPSBzcGx0WzFdO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGZpZWxkID0gc3BsdFswXTtcbiAgICAgIH1cbiAgICAgIGZpZWxkc1tmaWVsZHMubGVuZ3RoIC0gMV0gPSBmaWVsZDtcbiAgICAgIF8uZWFjaChmaWVsZHMuc2xpY2UoMCwgZmllbGRzLmxlbmd0aCAtIDEpLCBmdW5jdGlvbihmKSB7XG4gICAgICAgIGlmICh1dGlsLmlzQXJyYXkob2JqKSkge1xuICAgICAgICAgIG9iaiA9IF8ucGx1Y2sob2JqLCBmKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBvYmogPSBvYmpbZl07XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgLy8gSWYgd2UgZ2V0IHRvIHRoZSBwb2ludCB3aGVyZSB3ZSdyZSBhYm91dCB0byBpbmRleCBudWxsIG9yIHVuZGVmaW5lZCB3ZSBzdG9wIC0gb2J2aW91c2x5IHRoaXMgb2JqZWN0IGRvZXNcbiAgICAgIC8vIG5vdCBtYXRjaCB0aGUgcXVlcnkuXG4gICAgICB2YXIgbm90TnVsbE9yVW5kZWZpbmVkID0gb2JqICE9IHVuZGVmaW5lZDtcbiAgICAgIGlmIChub3ROdWxsT3JVbmRlZmluZWQpIHtcbiAgICAgICAgdmFyIHZhbCA9IG9ialtmaWVsZF07IC8vIEJyZWFrcyBoZXJlLlxuICAgICAgICB2YXIgaW52YWxpZCA9IHZhbCA9PT0gbnVsbCB8fCB2YWwgPT09IHVuZGVmaW5lZDtcbiAgICAgICAgdmFyIGNvbXBhcmF0b3IgPSBRdWVyeS5jb21wYXJhdG9yc1tvcF0sXG4gICAgICAgICAgb3B0cyA9IHtvYmplY3Q6IG9iaiwgZmllbGQ6IGZpZWxkLCB2YWx1ZTogdmFsdWUsIGludmFsaWQ6IGludmFsaWR9O1xuICAgICAgICBpZiAoIWNvbXBhcmF0b3IpIHtcbiAgICAgICAgICByZXR1cm4gJ05vIGNvbXBhcmF0b3IgcmVnaXN0ZXJlZCBmb3IgcXVlcnkgb3BlcmF0aW9uIFwiJyArIG9wICsgJ1wiJztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY29tcGFyYXRvcihvcHRzKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9LFxuICAgIG9iamVjdE1hdGNoZXM6IGZ1bmN0aW9uKG9iaiwgdW5wcm9jZXNzZWRGaWVsZCwgdmFsdWUsIHF1ZXJ5KSB7XG4gICAgICBpZiAodW5wcm9jZXNzZWRGaWVsZCA9PSAnJG9yJykge1xuICAgICAgICB2YXIgJG9yID0gcXVlcnlbJyRvciddO1xuICAgICAgICBpZiAoIXV0aWwuaXNBcnJheSgkb3IpKSB7XG4gICAgICAgICAgJG9yID0gT2JqZWN0LmtleXMoJG9yKS5tYXAoZnVuY3Rpb24oaykge1xuICAgICAgICAgICAgdmFyIG5vcm1hbGlzZWQgPSB7fTtcbiAgICAgICAgICAgIG5vcm1hbGlzZWRba10gPSAkb3Jba107XG4gICAgICAgICAgICByZXR1cm4gbm9ybWFsaXNlZDtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXRoaXMub2JqZWN0TWF0Y2hlc09yUXVlcnkob2JqLCAkb3IpKSByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBlbHNlIGlmICh1bnByb2Nlc3NlZEZpZWxkID09ICckYW5kJykge1xuICAgICAgICBpZiAoIXRoaXMub2JqZWN0TWF0Y2hlc0FuZFF1ZXJ5KG9iaiwgcXVlcnlbJyRhbmQnXSkpIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICB2YXIgbWF0Y2hlcyA9IHRoaXMuc3BsaXRNYXRjaGVzKG9iaiwgdW5wcm9jZXNzZWRGaWVsZCwgdmFsdWUpO1xuICAgICAgICBpZiAodHlwZW9mIG1hdGNoZXMgIT0gJ2Jvb2xlYW4nKSByZXR1cm4gbWF0Y2hlcztcbiAgICAgICAgaWYgKCFtYXRjaGVzKSByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9LFxuICAgIG9iamVjdE1hdGNoZXNCYXNlUXVlcnk6IGZ1bmN0aW9uKG9iaiwgcXVlcnkpIHtcbiAgICAgIHZhciBmaWVsZHMgPSBPYmplY3Qua2V5cyhxdWVyeSk7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGZpZWxkcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgdW5wcm9jZXNzZWRGaWVsZCA9IGZpZWxkc1tpXSxcbiAgICAgICAgICB2YWx1ZSA9IHF1ZXJ5W3VucHJvY2Vzc2VkRmllbGRdO1xuICAgICAgICB2YXIgcnQgPSB0aGlzLm9iamVjdE1hdGNoZXMob2JqLCB1bnByb2Nlc3NlZEZpZWxkLCB2YWx1ZSwgcXVlcnkpO1xuICAgICAgICBpZiAodHlwZW9mIHJ0ICE9ICdib29sZWFuJykgcmV0dXJuIHJ0O1xuICAgICAgICBpZiAoIXJ0KSByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9LFxuICAgIG9iamVjdE1hdGNoZXNRdWVyeTogZnVuY3Rpb24ob2JqKSB7XG4gICAgICByZXR1cm4gdGhpcy5vYmplY3RNYXRjaGVzQmFzZVF1ZXJ5KG9iaiwgdGhpcy5xdWVyeSk7XG4gICAgfVxuICB9KTtcblxuICBtb2R1bGUuZXhwb3J0cyA9IFF1ZXJ5O1xufSkoKTsiLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIFByb21pc2UgPSB1dGlsLlByb21pc2UsXG4gICAgZXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJyksXG4gICAgTW9kZWxJbnN0YW5jZSA9IHJlcXVpcmUoJy4vTW9kZWxJbnN0YW5jZScpLFxuICAgIF8gPSByZXF1aXJlKCcuL3V0aWwnKS5fO1xuXG4vKlxuIFRPRE86IFVzZSBFUzYgUHJveHkgaW5zdGVhZC5cbiBFdmVudHVhbGx5IHF1ZXJ5IHNldHMgc2hvdWxkIHVzZSBFUzYgUHJveGllcyB3aGljaCB3aWxsIGJlIG11Y2ggbW9yZSBuYXR1cmFsIGFuZCByb2J1c3QuIEUuZy4gbm8gbmVlZCBmb3IgdGhlIGJlbG93XG4gKi9cbnZhciBBUlJBWV9NRVRIT0RTID0gWydwdXNoJywgJ3NvcnQnLCAncmV2ZXJzZScsICdzcGxpY2UnLCAnc2hpZnQnLCAndW5zaGlmdCddLFxuICAgIE5VTUJFUl9NRVRIT0RTID0gWyd0b1N0cmluZycsICd0b0V4cG9uZW50aWFsJywgJ3RvRml4ZWQnLCAndG9QcmVjaXNpb24nLCAndmFsdWVPZiddLFxuICAgIE5VTUJFUl9QUk9QRVJUSUVTID0gWydNQVhfVkFMVUUnLCAnTUlOX1ZBTFVFJywgJ05FR0FUSVZFX0lORklOSVRZJywgJ05hTicsICdQT1NJVElWRV9JTkZJTklUWSddLFxuICAgIFNUUklOR19NRVRIT0RTID0gWydjaGFyQXQnLCAnY2hhckNvZGVBdCcsICdjb25jYXQnLCAnZnJvbUNoYXJDb2RlJywgJ2luZGV4T2YnLCAnbGFzdEluZGV4T2YnLCAnbG9jYWxlQ29tcGFyZScsXG4gICAgICAgICdtYXRjaCcsICdyZXBsYWNlJywgJ3NlYXJjaCcsICdzbGljZScsICdzcGxpdCcsICdzdWJzdHInLCAnc3Vic3RyaW5nJywgJ3RvTG9jYWxlTG93ZXJDYXNlJywgJ3RvTG9jYWxlVXBwZXJDYXNlJyxcbiAgICAgICAgJ3RvTG93ZXJDYXNlJywgJ3RvU3RyaW5nJywgJ3RvVXBwZXJDYXNlJywgJ3RyaW0nLCAndmFsdWVPZiddLFxuICAgIFNUUklOR19QUk9QRVJUSUVTID0gWydsZW5ndGgnXTtcblxuLyoqXG4gKiBSZXR1cm4gdGhlIHByb3BlcnR5IG5hbWVzIGZvciBhIGdpdmVuIG9iamVjdC4gSGFuZGxlcyBzcGVjaWFsIGNhc2VzIHN1Y2ggYXMgc3RyaW5ncyBhbmQgbnVtYmVycyB0aGF0IGRvIG5vdCBoYXZlXG4gKiB0aGUgZ2V0T3duUHJvcGVydHlOYW1lcyBmdW5jdGlvbi5cbiAqIFRoZSBzcGVjaWFsIGNhc2VzIGFyZSB2ZXJ5IG11Y2ggaGFja3MuIFRoaXMgaGFjayBjYW4gYmUgcmVtb3ZlZCBvbmNlIHRoZSBQcm94eSBvYmplY3QgaXMgbW9yZSB3aWRlbHkgYWRvcHRlZC5cbiAqIEBwYXJhbSBvYmplY3RcbiAqIEByZXR1cm5zIHtBcnJheX1cbiAqL1xuZnVuY3Rpb24gZ2V0UHJvcGVydHlOYW1lcyhvYmplY3QpIHtcbiAgICB2YXIgcHJvcGVydHlOYW1lcztcbiAgICBpZiAodHlwZW9mIG9iamVjdCA9PSAnc3RyaW5nJyB8fCBvYmplY3QgaW5zdGFuY2VvZiBTdHJpbmcpIHtcbiAgICAgICAgcHJvcGVydHlOYW1lcyA9IFNUUklOR19NRVRIT0RTLmNvbmNhdChTVFJJTkdfUFJPUEVSVElFUyk7XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGVvZiBvYmplY3QgPT0gJ251bWJlcicgfHwgb2JqZWN0IGluc3RhbmNlb2YgTnVtYmVyKSB7XG4gICAgICAgIHByb3BlcnR5TmFtZXMgPSBOVU1CRVJfTUVUSE9EUy5jb25jYXQoTlVNQkVSX1BST1BFUlRJRVMpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgcHJvcGVydHlOYW1lcyA9IG9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKCk7XG4gICAgfVxuICAgIHJldHVybiBwcm9wZXJ0eU5hbWVzO1xufVxuXG4vKipcbiAqIERlZmluZSBhIHByb3h5IHByb3BlcnR5IHRvIGF0dHJpYnV0ZXMgb24gb2JqZWN0cyBpbiB0aGUgYXJyYXlcbiAqIEBwYXJhbSBhcnJcbiAqIEBwYXJhbSBwcm9wXG4gKi9cbmZ1bmN0aW9uIGRlZmluZUF0dHJpYnV0ZShhcnIsIHByb3ApIHtcbiAgICBpZiAoIShwcm9wIGluIGFycikpIHsgLy8gZS5nLiB3ZSBjYW5ub3QgcmVkZWZpbmUgLmxlbmd0aFxuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoYXJyLCBwcm9wLCB7XG4gICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcXVlcnlTZXQoXy5wbHVjayhhcnIsIHByb3ApKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheSh2KSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5sZW5ndGggIT0gdi5sZW5ndGgpIHRocm93IGVycm9yKHttZXNzYWdlOiAnTXVzdCBiZSBzYW1lIGxlbmd0aCd9KTtcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB2Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzW2ldW3Byb3BdID0gdltpXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IHRoaXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXNbaV1bcHJvcF0gPSB2O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGlzUHJvbWlzZShvYmopIHtcbiAgICAvLyBUT0RPOiBEb24ndCB0aGluayB0aGlzIGlzIHZlcnkgcm9idXN0LlxuICAgIHJldHVybiBvYmoudGhlbiAmJiBvYmouY2F0Y2g7XG59XG5cbi8qKlxuICogRGVmaW5lIGEgcHJveHkgbWV0aG9kIG9uIHRoZSBhcnJheSBpZiBub3QgYWxyZWFkeSBpbiBleGlzdGVuY2UuXG4gKiBAcGFyYW0gYXJyXG4gKiBAcGFyYW0gcHJvcFxuICovXG5mdW5jdGlvbiBkZWZpbmVNZXRob2QoYXJyLCBwcm9wKSB7XG4gICAgaWYgKCEocHJvcCBpbiBhcnIpKSB7IC8vIGUuZy4gd2UgZG9uJ3Qgd2FudCB0byByZWRlZmluZSB0b1N0cmluZ1xuICAgICAgICBhcnJbcHJvcF0gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgYXJncyA9IGFyZ3VtZW50cyxcbiAgICAgICAgICAgICAgICByZXMgPSB0aGlzLm1hcChmdW5jdGlvbiAocCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcFtwcm9wXS5hcHBseShwLCBhcmdzKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHZhciBhcmVQcm9taXNlcyA9IGZhbHNlO1xuICAgICAgICAgICAgaWYgKHJlcy5sZW5ndGgpIGFyZVByb21pc2VzID0gaXNQcm9taXNlKHJlc1swXSk7XG4gICAgICAgICAgICByZXR1cm4gYXJlUHJvbWlzZXMgPyBQcm9taXNlLmFsbChyZXMpIDogcXVlcnlTZXQocmVzKTtcbiAgICAgICAgfTtcbiAgICB9XG59XG5cbi8qKlxuICogVHJhbnNmb3JtIHRoZSBhcnJheSBpbnRvIGEgcXVlcnkgc2V0LlxuICogUmVuZGVycyB0aGUgYXJyYXkgaW1tdXRhYmxlLlxuICogQHBhcmFtIGFyclxuICogQHBhcmFtIG1vZGVsIC0gVGhlIG1vZGVsIHdpdGggd2hpY2ggdG8gcHJveHkgdG9cbiAqL1xuZnVuY3Rpb24gbW9kZWxRdWVyeVNldChhcnIsIG1vZGVsKSB7XG4gICAgYXJyID0gXy5leHRlbmQoW10sIGFycik7XG4gICAgdmFyIGF0dHJpYnV0ZU5hbWVzID0gbW9kZWwuX2F0dHJpYnV0ZU5hbWVzLFxuICAgICAgICByZWxhdGlvbnNoaXBOYW1lcyA9IG1vZGVsLl9yZWxhdGlvbnNoaXBOYW1lcyxcbiAgICAgICAgbmFtZXMgPSBhdHRyaWJ1dGVOYW1lcy5jb25jYXQocmVsYXRpb25zaGlwTmFtZXMpLmNvbmNhdChpbnN0YW5jZU1ldGhvZHMpO1xuICAgIG5hbWVzLmZvckVhY2goXy5wYXJ0aWFsKGRlZmluZUF0dHJpYnV0ZSwgYXJyKSk7XG4gICAgdmFyIGluc3RhbmNlTWV0aG9kcyA9IE9iamVjdC5rZXlzKE1vZGVsSW5zdGFuY2UucHJvdG90eXBlKTtcbiAgICBpbnN0YW5jZU1ldGhvZHMuZm9yRWFjaChfLnBhcnRpYWwoZGVmaW5lTWV0aG9kLCBhcnIpKTtcbiAgICByZXR1cm4gcmVuZGVySW1tdXRhYmxlKGFycik7XG59XG5cbi8qKlxuICogVHJhbnNmb3JtIHRoZSBhcnJheSBpbnRvIGEgcXVlcnkgc2V0LCBiYXNlZCBvbiB3aGF0ZXZlciBpcyBpbiBpdC5cbiAqIE5vdGUgdGhhdCBhbGwgb2JqZWN0cyBtdXN0IGJlIG9mIHRoZSBzYW1lIHR5cGUuIFRoaXMgZnVuY3Rpb24gd2lsbCB0YWtlIHRoZSBmaXJzdCBvYmplY3QgYW5kIGRlY2lkZSBob3cgdG8gcHJveHlcbiAqIGJhc2VkIG9uIHRoYXQuXG4gKiBAcGFyYW0gYXJyXG4gKi9cbmZ1bmN0aW9uIHF1ZXJ5U2V0KGFycikge1xuICAgIGlmIChhcnIubGVuZ3RoKSB7XG4gICAgICAgIHZhciByZWZlcmVuY2VPYmplY3QgPSBhcnJbMF0sXG4gICAgICAgICAgICBwcm9wZXJ0eU5hbWVzID0gZ2V0UHJvcGVydHlOYW1lcyhyZWZlcmVuY2VPYmplY3QpO1xuICAgICAgICBwcm9wZXJ0eU5hbWVzLmZvckVhY2goZnVuY3Rpb24gKHByb3ApIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgcmVmZXJlbmNlT2JqZWN0W3Byb3BdID09ICdmdW5jdGlvbicpIGRlZmluZU1ldGhvZChhcnIsIHByb3AsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICBlbHNlIGRlZmluZUF0dHJpYnV0ZShhcnIsIHByb3ApO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlbmRlckltbXV0YWJsZShhcnIpO1xufVxuXG5mdW5jdGlvbiB0aHJvd0ltbXV0YWJsZUVycm9yKCkge1xuICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IG1vZGlmeSBhIHF1ZXJ5IHNldCcpO1xufVxuXG4vKipcbiAqIFJlbmRlciBhbiBhcnJheSBpbW11dGFibGUgYnkgcmVwbGFjaW5nIGFueSBmdW5jdGlvbnMgdGhhdCBjYW4gbXV0YXRlIGl0LlxuICogQHBhcmFtIGFyclxuICovXG5mdW5jdGlvbiByZW5kZXJJbW11dGFibGUoYXJyKSB7XG4gICAgQVJSQVlfTUVUSE9EUy5mb3JFYWNoKGZ1bmN0aW9uIChwKSB7XG4gICAgICAgIGFycltwXSA9IHRocm93SW1tdXRhYmxlRXJyb3I7XG4gICAgfSk7XG4gICAgYXJyLmltbXV0YWJsZSA9IHRydWU7XG4gICAgYXJyLm11dGFibGVDb3B5ID0gYXJyLmFzQXJyYXkgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBtdXRhYmxlQXJyID0gXy5tYXAodGhpcywgZnVuY3Rpb24gKHgpIHtyZXR1cm4geH0pO1xuICAgICAgICBtdXRhYmxlQXJyLmFzUXVlcnlTZXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gcXVlcnlTZXQodGhpcyk7XG4gICAgICAgIH07XG4gICAgICAgIG11dGFibGVBcnIuYXNNb2RlbFF1ZXJ5U2V0ID0gZnVuY3Rpb24gKG1vZGVsKSB7XG4gICAgICAgICAgICByZXR1cm4gbW9kZWxRdWVyeVNldCh0aGlzLCBtb2RlbCk7XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBtdXRhYmxlQXJyO1xuICAgIH07XG4gICAgcmV0dXJuIGFycjtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBtb2RlbFF1ZXJ5U2V0OyIsIi8qKlxuICogRm9yIHRob3NlIGZhbWlsaWFyIHdpdGggQXBwbGUncyBDb2NvYSBsaWJyYXJ5LCByZWFjdGl2ZSBxdWVyaWVzIHJvdWdobHkgbWFwIG9udG8gTlNGZXRjaGVkUmVzdWx0c0NvbnRyb2xsZXIuXG4gKlxuICogVGhleSBwcmVzZW50IGEgcXVlcnkgc2V0IHRoYXQgJ3JlYWN0cycgdG8gY2hhbmdlcyBpbiB0aGUgdW5kZXJseWluZyBkYXRhLlxuICogQG1vZHVsZSByZWFjdGl2ZVF1ZXJ5XG4gKi9cblxuXG4oZnVuY3Rpb24oKSB7XG5cbiAgdmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJykoJ3F1ZXJ5OnJlYWN0aXZlJyksXG4gICAgUXVlcnkgPSByZXF1aXJlKCcuL1F1ZXJ5JyksXG4gICAgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyLFxuICAgIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gICAgQ2hhaW4gPSByZXF1aXJlKCcuL0NoYWluJyksXG4gICAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgIGNvbnN0cnVjdFF1ZXJ5U2V0ID0gcmVxdWlyZSgnLi9RdWVyeVNldCcpLFxuICAgIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICBfID0gdXRpbC5fO1xuXG4gIC8qKlxuICAgKlxuICAgKiBAcGFyYW0ge1F1ZXJ5fSBxdWVyeSAtIFRoZSB1bmRlcmx5aW5nIHF1ZXJ5XG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKi9cbiAgZnVuY3Rpb24gUmVhY3RpdmVRdWVyeShxdWVyeSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBFdmVudEVtaXR0ZXIuY2FsbCh0aGlzKTtcbiAgICBDaGFpbi5jYWxsKHRoaXMpO1xuICAgIF8uZXh0ZW5kKHRoaXMsIHtcbiAgICAgIGluc2VydGlvblBvbGljeTogUmVhY3RpdmVRdWVyeS5JbnNlcnRpb25Qb2xpY3kuQmFjayxcbiAgICAgIGluaXRpYWxpc2VkOiBmYWxzZVxuICAgIH0pO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdxdWVyeScsIHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9xdWVyeVxuICAgICAgfSxcbiAgICAgIHNldDogZnVuY3Rpb24odikge1xuICAgICAgICBpZiAodikge1xuICAgICAgICAgIHRoaXMuX3F1ZXJ5ID0gdjtcbiAgICAgICAgICB0aGlzLnJlc3VsdHMgPSBjb25zdHJ1Y3RRdWVyeVNldChbXSwgdi5tb2RlbCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgdGhpcy5fcXVlcnkgPSBudWxsO1xuICAgICAgICAgIHRoaXMucmVzdWx0cyA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBjb25maWd1cmFibGU6IGZhbHNlLFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH0pO1xuXG4gICAgaWYgKHF1ZXJ5KSB7XG4gICAgICBfLmV4dGVuZCh0aGlzLCB7XG4gICAgICAgIF9xdWVyeTogcXVlcnksXG4gICAgICAgIHJlc3VsdHM6IGNvbnN0cnVjdFF1ZXJ5U2V0KFtdLCBxdWVyeS5tb2RlbClcbiAgICAgIH0pXG4gICAgfVxuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXModGhpcywge1xuICAgICAgaW5pdGlhbGl6ZWQ6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5pbml0aWFsaXNlZFxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgbW9kZWw6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgcXVlcnkgPSBzZWxmLl9xdWVyeTtcbiAgICAgICAgICBpZiAocXVlcnkpIHtcbiAgICAgICAgICAgIHJldHVybiBxdWVyeS5tb2RlbFxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGNvbGxlY3Rpb246IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gc2VsZi5tb2RlbC5jb2xsZWN0aW9uTmFtZVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cblxuICB9XG5cbiAgUmVhY3RpdmVRdWVyeS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEV2ZW50RW1pdHRlci5wcm90b3R5cGUpO1xuICBfLmV4dGVuZChSZWFjdGl2ZVF1ZXJ5LnByb3RvdHlwZSwgQ2hhaW4ucHJvdG90eXBlKTtcblxuICBfLmV4dGVuZChSZWFjdGl2ZVF1ZXJ5LCB7XG4gICAgSW5zZXJ0aW9uUG9saWN5OiB7XG4gICAgICBGcm9udDogJ0Zyb250JyxcbiAgICAgIEJhY2s6ICdCYWNrJ1xuICAgIH1cbiAgfSk7XG5cbiAgXy5leHRlbmQoUmVhY3RpdmVRdWVyeS5wcm90b3R5cGUsIHtcbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSBjYlxuICAgICAqIEBwYXJhbSB7Ym9vbH0gX2lnbm9yZUluaXQgLSBleGVjdXRlIHF1ZXJ5IGFnYWluLCBpbml0aWFsaXNlZCBvciBub3QuXG4gICAgICogQHJldHVybnMgeyp9XG4gICAgICovXG4gICAgaW5pdDogZnVuY3Rpb24oY2IsIF9pZ25vcmVJbml0KSB7XG4gICAgICBpZiAodGhpcy5fcXVlcnkpIHtcbiAgICAgICAgaWYgKGxvZykgbG9nKCdpbml0Jyk7XG4gICAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICAgICAgaWYgKCghdGhpcy5pbml0aWFsaXNlZCkgfHwgX2lnbm9yZUluaXQpIHtcbiAgICAgICAgICAgIHRoaXMuX3F1ZXJ5LmV4ZWN1dGUoZnVuY3Rpb24oZXJyLCByZXN1bHRzKSB7XG4gICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgY2IobnVsbCwgdGhpcy5fYXBwbHlSZXN1bHRzKHJlc3VsdHMpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBjYihlcnIpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNiKG51bGwsIHRoaXMucmVzdWx0cyk7XG4gICAgICAgICAgfVxuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgfVxuICAgICAgZWxzZSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gX3F1ZXJ5IGRlZmluZWQnKTtcbiAgICB9LFxuICAgIF9hcHBseVJlc3VsdHM6IGZ1bmN0aW9uKHJlc3VsdHMpIHtcbiAgICAgIHRoaXMucmVzdWx0cyA9IHJlc3VsdHM7XG4gICAgICBpZiAoIXRoaXMuaGFuZGxlcikge1xuICAgICAgICB2YXIgbmFtZSA9IHRoaXMuX2NvbnN0cnVjdE5vdGlmaWNhdGlvbk5hbWUoKTtcbiAgICAgICAgdmFyIGhhbmRsZXIgPSBmdW5jdGlvbihuKSB7XG4gICAgICAgICAgdGhpcy5faGFuZGxlTm90aWYobik7XG4gICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5oYW5kbGVyID0gaGFuZGxlcjtcbiAgICAgICAgZXZlbnRzLm9uKG5hbWUsIGhhbmRsZXIpO1xuICAgICAgfVxuICAgICAgbG9nKCdMaXN0ZW5pbmcgdG8gJyArIG5hbWUpO1xuICAgICAgdGhpcy5pbml0aWFsaXNlZCA9IHRydWU7XG4gICAgICByZXR1cm4gdGhpcy5yZXN1bHRzO1xuICAgIH0sXG4gICAgaW5zZXJ0OiBmdW5jdGlvbihuZXdPYmopIHtcbiAgICAgIHZhciByZXN1bHRzID0gdGhpcy5yZXN1bHRzLm11dGFibGVDb3B5KCk7XG4gICAgICBpZiAodGhpcy5pbnNlcnRpb25Qb2xpY3kgPT0gUmVhY3RpdmVRdWVyeS5JbnNlcnRpb25Qb2xpY3kuQmFjaykgdmFyIGlkeCA9IHJlc3VsdHMucHVzaChuZXdPYmopO1xuICAgICAgZWxzZSBpZHggPSByZXN1bHRzLnVuc2hpZnQobmV3T2JqKTtcbiAgICAgIHRoaXMucmVzdWx0cyA9IHJlc3VsdHMuYXNNb2RlbFF1ZXJ5U2V0KHRoaXMubW9kZWwpO1xuICAgICAgcmV0dXJuIGlkeDtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIEV4ZWN1dGUgdGhlIHVuZGVybHlpbmcgcXVlcnkgYWdhaW4uXG4gICAgICogQHBhcmFtIGNiXG4gICAgICovXG4gICAgdXBkYXRlOiBmdW5jdGlvbihjYikge1xuICAgICAgcmV0dXJuIHRoaXMuaW5pdChjYiwgdHJ1ZSlcbiAgICB9LFxuICAgIF9oYW5kbGVOb3RpZjogZnVuY3Rpb24obikge1xuICAgICAgbG9nKCdfaGFuZGxlTm90aWYnLCBuKTtcbiAgICAgIGlmIChuLnR5cGUgPT0gbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuTmV3KSB7XG4gICAgICAgIHZhciBuZXdPYmogPSBuLm5ldztcbiAgICAgICAgaWYgKHRoaXMuX3F1ZXJ5Lm9iamVjdE1hdGNoZXNRdWVyeShuZXdPYmopKSB7XG4gICAgICAgICAgbG9nKCdOZXcgb2JqZWN0IG1hdGNoZXMnLCBuZXdPYmopO1xuICAgICAgICAgIHZhciBpZHggPSB0aGlzLmluc2VydChuZXdPYmopO1xuICAgICAgICAgIHRoaXMuZW1pdChtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5TcGxpY2UsIHtcbiAgICAgICAgICAgIGluZGV4OiBpZHgsXG4gICAgICAgICAgICBhZGRlZDogW25ld09ial0sXG4gICAgICAgICAgICB0eXBlOiBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgICAgICAgICBvYmo6IHRoaXNcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBsb2coJ05ldyBvYmplY3QgZG9lcyBub3QgbWF0Y2gnLCBuZXdPYmopO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBlbHNlIGlmIChuLnR5cGUgPT0gbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU2V0KSB7XG4gICAgICAgIG5ld09iaiA9IG4ub2JqO1xuICAgICAgICB2YXIgaW5kZXggPSB0aGlzLnJlc3VsdHMuaW5kZXhPZihuZXdPYmopLFxuICAgICAgICAgIGFscmVhZHlDb250YWlucyA9IGluZGV4ID4gLTEsXG4gICAgICAgICAgbWF0Y2hlcyA9IHRoaXMuX3F1ZXJ5Lm9iamVjdE1hdGNoZXNRdWVyeShuZXdPYmopO1xuICAgICAgICBpZiAobWF0Y2hlcyAmJiAhYWxyZWFkeUNvbnRhaW5zKSB7XG4gICAgICAgICAgbG9nKCdVcGRhdGVkIG9iamVjdCBub3cgbWF0Y2hlcyEnLCBuZXdPYmopO1xuICAgICAgICAgIGlkeCA9IHRoaXMuaW5zZXJ0KG5ld09iaik7XG4gICAgICAgICAgdGhpcy5lbWl0KG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSwge1xuICAgICAgICAgICAgaW5kZXg6IGlkeCxcbiAgICAgICAgICAgIGFkZGVkOiBbbmV3T2JqXSxcbiAgICAgICAgICAgIHR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgIG9iajogdGhpc1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKCFtYXRjaGVzICYmIGFscmVhZHlDb250YWlucykge1xuICAgICAgICAgIGxvZygnVXBkYXRlZCBvYmplY3Qgbm8gbG9uZ2VyIG1hdGNoZXMhJywgbmV3T2JqKTtcbiAgICAgICAgICByZXN1bHRzID0gdGhpcy5yZXN1bHRzLm11dGFibGVDb3B5KCk7XG4gICAgICAgICAgdmFyIHJlbW92ZWQgPSByZXN1bHRzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgdGhpcy5yZXN1bHRzID0gcmVzdWx0cy5hc01vZGVsUXVlcnlTZXQodGhpcy5tb2RlbCk7XG4gICAgICAgICAgdGhpcy5lbWl0KG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSwge1xuICAgICAgICAgICAgaW5kZXg6IGluZGV4LFxuICAgICAgICAgICAgb2JqOiB0aGlzLFxuICAgICAgICAgICAgbmV3OiBuZXdPYmosXG4gICAgICAgICAgICB0eXBlOiBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgICAgICAgICByZW1vdmVkOiByZW1vdmVkXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoIW1hdGNoZXMgJiYgIWFscmVhZHlDb250YWlucykge1xuICAgICAgICAgIGxvZygnRG9lcyBub3QgY29udGFpbiwgYnV0IGRvZXNudCBtYXRjaCBzbyBub3QgaW5zZXJ0aW5nJywgbmV3T2JqKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChtYXRjaGVzICYmIGFscmVhZHlDb250YWlucykge1xuICAgICAgICAgIGxvZygnTWF0Y2hlcyBidXQgYWxyZWFkeSBjb250YWlucycsIG5ld09iaik7XG4gICAgICAgICAgLy8gU2VuZCB0aGUgbm90aWZpY2F0aW9uIG92ZXIuXG4gICAgICAgICAgdGhpcy5lbWl0KG4udHlwZSwgbik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKG4udHlwZSA9PSBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5SZW1vdmUpIHtcbiAgICAgICAgbmV3T2JqID0gbi5vYmo7XG4gICAgICAgIHZhciByZXN1bHRzID0gdGhpcy5yZXN1bHRzLm11dGFibGVDb3B5KCk7XG4gICAgICAgIGluZGV4ID0gcmVzdWx0cy5pbmRleE9mKG5ld09iaik7XG4gICAgICAgIGlmIChpbmRleCA+IC0xKSB7XG4gICAgICAgICAgbG9nKCdSZW1vdmluZyBvYmplY3QnLCBuZXdPYmopO1xuICAgICAgICAgIHJlbW92ZWQgPSByZXN1bHRzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgdGhpcy5yZXN1bHRzID0gY29uc3RydWN0UXVlcnlTZXQocmVzdWx0cywgdGhpcy5tb2RlbCk7XG4gICAgICAgICAgdGhpcy5lbWl0KG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSwge1xuICAgICAgICAgICAgaW5kZXg6IGluZGV4LFxuICAgICAgICAgICAgb2JqOiB0aGlzLFxuICAgICAgICAgICAgdHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgcmVtb3ZlZDogcmVtb3ZlZFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGxvZygnTm8gbW9kZWxFdmVudHMgbmVjY2Vzc2FyeS4nLCBuZXdPYmopO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ1Vua25vd24gY2hhbmdlIHR5cGUgXCInICsgbi50eXBlLnRvU3RyaW5nKCkgKyAnXCInKVxuICAgICAgfVxuICAgICAgdGhpcy5yZXN1bHRzID0gY29uc3RydWN0UXVlcnlTZXQodGhpcy5fcXVlcnkuX3NvcnRSZXN1bHRzKHRoaXMucmVzdWx0cyksIHRoaXMubW9kZWwpO1xuICAgIH0sXG4gICAgX2NvbnN0cnVjdE5vdGlmaWNhdGlvbk5hbWU6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMubW9kZWwuY29sbGVjdGlvbk5hbWUgKyAnOicgKyB0aGlzLm1vZGVsLm5hbWU7XG4gICAgfSxcbiAgICB0ZXJtaW5hdGU6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuaGFuZGxlcikge1xuICAgICAgICBldmVudHMucmVtb3ZlTGlzdGVuZXIodGhpcy5fY29uc3RydWN0Tm90aWZpY2F0aW9uTmFtZSgpLCB0aGlzLmhhbmRsZXIpO1xuICAgICAgfVxuICAgICAgdGhpcy5yZXN1bHRzID0gbnVsbDtcbiAgICAgIHRoaXMuaGFuZGxlciA9IG51bGw7XG4gICAgfSxcbiAgICBfcmVnaXN0ZXJFdmVudEhhbmRsZXI6IGZ1bmN0aW9uKG9uLCBuYW1lLCBmbikge1xuICAgICAgdmFyIHJlbW92ZUxpc3RlbmVyID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lcjtcbiAgICAgIGlmIChuYW1lLnRyaW0oKSA9PSAnKicpIHtcbiAgICAgICAgT2JqZWN0LmtleXMobW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUpLmZvckVhY2goZnVuY3Rpb24oaykge1xuICAgICAgICAgIG9uLmNhbGwodGhpcywgbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGVba10sIGZuKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBvbi5jYWxsKHRoaXMsIG5hbWUsIGZuKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLl9saW5rKHtcbiAgICAgICAgICBvbjogdGhpcy5vbi5iaW5kKHRoaXMpLFxuICAgICAgICAgIG9uY2U6IHRoaXMub25jZS5iaW5kKHRoaXMpLFxuICAgICAgICAgIHVwZGF0ZTogdGhpcy51cGRhdGUuYmluZCh0aGlzKSxcbiAgICAgICAgICBpbnNlcnQ6IHRoaXMuaW5zZXJ0LmJpbmQodGhpcylcbiAgICAgICAgfSxcbiAgICAgICAgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgaWYgKG5hbWUudHJpbSgpID09ICcqJykge1xuICAgICAgICAgICAgT2JqZWN0LmtleXMobW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUpLmZvckVhY2goZnVuY3Rpb24oaykge1xuICAgICAgICAgICAgICByZW1vdmVMaXN0ZW5lci5jYWxsKHRoaXMsIG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlW2tdLCBmbik7XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJlbW92ZUxpc3RlbmVyLmNhbGwodGhpcywgbmFtZSwgZm4pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICB9LFxuICAgIG9uOiBmdW5jdGlvbihuYW1lLCBmbikge1xuICAgICAgcmV0dXJuIHRoaXMuX3JlZ2lzdGVyRXZlbnRIYW5kbGVyKEV2ZW50RW1pdHRlci5wcm90b3R5cGUub24sIG5hbWUsIGZuKTtcbiAgICB9LFxuICAgIG9uY2U6IGZ1bmN0aW9uKG5hbWUsIGZuKSB7XG4gICAgICByZXR1cm4gdGhpcy5fcmVnaXN0ZXJFdmVudEhhbmRsZXIoRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlLCBuYW1lLCBmbik7XG4gICAgfVxuICB9KTtcblxuXG4gIG1vZHVsZS5leHBvcnRzID0gUmVhY3RpdmVRdWVyeTtcbn0pKCk7IiwiLyoqXG4gKiBCYXNlIGZ1bmN0aW9uYWxpdHkgZm9yIHJlbGF0aW9uc2hpcHMuXG4gKiBAbW9kdWxlIHJlbGF0aW9uc2hpcHNcbiAqL1xuKGZ1bmN0aW9uKCkge1xuXG4gIHZhciBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIF8gPSB1dGlsLl8sXG4gICAgUXVlcnkgPSByZXF1aXJlKCcuL1F1ZXJ5JyksXG4gICAgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSxcbiAgICBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKSxcbiAgICBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICAgIHdyYXBBcnJheUZvckF0dHJpYnV0ZXMgPSBldmVudHMud3JhcEFycmF5LFxuICAgIEFycmF5T2JzZXJ2ZXIgPSByZXF1aXJlKCcuLi92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZScpLkFycmF5T2JzZXJ2ZXIsXG4gICAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gICAgTW9kZWxFdmVudFR5cGUgPSBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZTtcblxuICAvKipcbiAgICogQGNsYXNzICBbUmVsYXRpb25zaGlwUHJveHkgZGVzY3JpcHRpb25dXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKi9cbiAgZnVuY3Rpb24gUmVsYXRpb25zaGlwUHJveHkob3B0cykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBvcHRzID0gb3B0cyB8fCB7fTtcblxuICAgIF8uZXh0ZW5kKHRoaXMsIHtcbiAgICAgIG9iamVjdDogbnVsbCxcbiAgICAgIHJlbGF0ZWQ6IG51bGxcbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHRoaXMsIHtcbiAgICAgIGlzRm9yd2FyZDoge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiAhc2VsZi5pc1JldmVyc2U7XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24odikge1xuICAgICAgICAgIHNlbGYuaXNSZXZlcnNlID0gIXY7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHV0aWwuZXh0ZW5kRnJvbU9wdHModGhpcywgb3B0cywge1xuICAgICAgcmV2ZXJzZU1vZGVsOiBudWxsLFxuICAgICAgZm9yd2FyZE1vZGVsOiBudWxsLFxuICAgICAgZm9yd2FyZE5hbWU6IG51bGwsXG4gICAgICByZXZlcnNlTmFtZTogbnVsbCxcbiAgICAgIGlzUmV2ZXJzZTogbnVsbCxcbiAgICAgIHNlcmlhbGlzZTogbnVsbFxuICAgIH0sIGZhbHNlKTtcblxuICAgIHRoaXMuY2FuY2VsTGlzdGVucyA9IHt9O1xuICB9XG5cbiAgXy5leHRlbmQoUmVsYXRpb25zaGlwUHJveHksIHt9KTtcblxuICBfLmV4dGVuZChSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUsIHtcbiAgICAvKipcbiAgICAgKiBJbnN0YWxsIHRoaXMgcHJveHkgb24gdGhlIGdpdmVuIGluc3RhbmNlXG4gICAgICogQHBhcmFtIHtNb2RlbEluc3RhbmNlfSBtb2RlbEluc3RhbmNlXG4gICAgICovXG4gICAgaW5zdGFsbDogZnVuY3Rpb24obW9kZWxJbnN0YW5jZSkge1xuICAgICAgaWYgKG1vZGVsSW5zdGFuY2UpIHtcbiAgICAgICAgaWYgKCF0aGlzLm9iamVjdCkge1xuICAgICAgICAgIHRoaXMub2JqZWN0ID0gbW9kZWxJbnN0YW5jZTtcbiAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgdmFyIG5hbWUgPSB0aGlzLmdldEZvcndhcmROYW1lKCk7XG4gICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG1vZGVsSW5zdGFuY2UsIG5hbWUsIHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgIHJldHVybiBzZWxmLnJlbGF0ZWQ7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2V0OiBmdW5jdGlvbih2KSB7XG4gICAgICAgICAgICAgIHNlbGYuc2V0KHYpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBpZiAoIW1vZGVsSW5zdGFuY2UuX19wcm94aWVzKSBtb2RlbEluc3RhbmNlLl9fcHJveGllcyA9IHt9O1xuICAgICAgICAgIG1vZGVsSW5zdGFuY2UuX19wcm94aWVzW25hbWVdID0gdGhpcztcbiAgICAgICAgICBpZiAoIW1vZGVsSW5zdGFuY2UuX3Byb3hpZXMpIHtcbiAgICAgICAgICAgIG1vZGVsSW5zdGFuY2UuX3Byb3hpZXMgPSBbXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgbW9kZWxJbnN0YW5jZS5fcHJveGllcy5wdXNoKHRoaXMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdBbHJlYWR5IGluc3RhbGxlZC4nKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ05vIG9iamVjdCBwYXNzZWQgdG8gcmVsYXRpb25zaGlwIGluc3RhbGwnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgfSk7XG5cbiAgLy9ub2luc3BlY3Rpb24gSlNVbnVzZWRMb2NhbFN5bWJvbHNcbiAgXy5leHRlbmQoUmVsYXRpb25zaGlwUHJveHkucHJvdG90eXBlLCB7XG4gICAgc2V0OiBmdW5jdGlvbihvYmosIG9wdHMpIHtcbiAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNdXN0IHN1YmNsYXNzIFJlbGF0aW9uc2hpcFByb3h5Jyk7XG4gICAgfSxcbiAgICBnZXQ6IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTXVzdCBzdWJjbGFzcyBSZWxhdGlvbnNoaXBQcm94eScpO1xuICAgIH1cbiAgfSk7XG5cbiAgXy5leHRlbmQoUmVsYXRpb25zaGlwUHJveHkucHJvdG90eXBlLCB7XG4gICAgcHJveHlGb3JJbnN0YW5jZTogZnVuY3Rpb24obW9kZWxJbnN0YW5jZSwgcmV2ZXJzZSkge1xuICAgICAgdmFyIG5hbWUgPSByZXZlcnNlID8gdGhpcy5nZXRSZXZlcnNlTmFtZSgpIDogdGhpcy5nZXRGb3J3YXJkTmFtZSgpLFxuICAgICAgICBtb2RlbCA9IHJldmVyc2UgPyB0aGlzLnJldmVyc2VNb2RlbCA6IHRoaXMuZm9yd2FyZE1vZGVsO1xuICAgICAgdmFyIHJldDtcbiAgICAgIC8vIFRoaXMgc2hvdWxkIG5ldmVyIGhhcHBlbi4gU2hvdWxkIGcgICBldCBjYXVnaHQgaW4gdGhlIG1hcHBpbmcgb3BlcmF0aW9uP1xuICAgICAgaWYgKHV0aWwuaXNBcnJheShtb2RlbEluc3RhbmNlKSkge1xuICAgICAgICByZXQgPSBfLm1hcChtb2RlbEluc3RhbmNlLCBmdW5jdGlvbihvKSB7XG4gICAgICAgICAgcmV0dXJuIG8uX19wcm94aWVzW25hbWVdO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBwcm94eSA9IG1vZGVsSW5zdGFuY2UuX19wcm94aWVzW25hbWVdO1xuICAgICAgICBpZiAoIXByb3h5KSB7XG4gICAgICAgICAgdmFyIGVyciA9ICdObyBwcm94eSB3aXRoIG5hbWUgXCInICsgbmFtZSArICdcIiBvbiBtYXBwaW5nICcgKyBtb2RlbC5uYW1lO1xuICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKGVycik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0ID0gcHJveHk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmV0O1xuICAgIH0sXG4gICAgcmV2ZXJzZVByb3h5Rm9ySW5zdGFuY2U6IGZ1bmN0aW9uKG1vZGVsSW5zdGFuY2UpIHtcbiAgICAgIHJldHVybiB0aGlzLnByb3h5Rm9ySW5zdGFuY2UobW9kZWxJbnN0YW5jZSwgdHJ1ZSk7XG4gICAgfSxcbiAgICBnZXRSZXZlcnNlTmFtZTogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5pc0ZvcndhcmQgPyB0aGlzLnJldmVyc2VOYW1lIDogdGhpcy5mb3J3YXJkTmFtZTtcbiAgICB9LFxuICAgIGdldEZvcndhcmROYW1lOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLmlzRm9yd2FyZCA/IHRoaXMuZm9yd2FyZE5hbWUgOiB0aGlzLnJldmVyc2VOYW1lO1xuICAgIH0sXG4gICAgZ2V0Rm9yd2FyZE1vZGVsOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLmlzRm9yd2FyZCA/IHRoaXMuZm9yd2FyZE1vZGVsIDogdGhpcy5yZXZlcnNlTW9kZWw7XG4gICAgfSxcbiAgICBjbGVhclJlbW92YWxMaXN0ZW5lcjogZnVuY3Rpb24ob2JqKSB7XG4gICAgICB2YXIgbG9jYWxJZCA9IG9iai5sb2NhbElkO1xuICAgICAgdmFyIGNhbmNlbExpc3RlbiA9IHRoaXMuY2FuY2VsTGlzdGVuc1tsb2NhbElkXTtcbiAgICAgIC8vIFRPRE86IFJlbW92ZSB0aGlzIGNoZWNrLiBjYW5jZWxMaXN0ZW4gc2hvdWxkIGFsd2F5cyBleGlzdFxuICAgICAgaWYgKGNhbmNlbExpc3Rlbikge1xuICAgICAgICBjYW5jZWxMaXN0ZW4oKTtcbiAgICAgICAgdGhpcy5jYW5jZWxMaXN0ZW5zW2xvY2FsSWRdID0gbnVsbDtcbiAgICAgIH1cbiAgICB9LFxuICAgIGxpc3RlbkZvclJlbW92YWw6IGZ1bmN0aW9uKG9iaikge1xuICAgICAgdGhpcy5jYW5jZWxMaXN0ZW5zW29iai5sb2NhbElkXSA9IG9iai5vbignKicsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgaWYgKGUudHlwZSA9PSBNb2RlbEV2ZW50VHlwZS5SZW1vdmUpIHtcbiAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KHRoaXMucmVsYXRlZCkpIHtcbiAgICAgICAgICAgIHZhciBpZHggPSB0aGlzLnJlbGF0ZWQuaW5kZXhPZihvYmopO1xuICAgICAgICAgICAgdGhpcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnNldElkQW5kUmVsYXRlZChudWxsKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5jbGVhclJlbW92YWxMaXN0ZW5lcihvYmopO1xuICAgICAgICB9XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogQ29uZmlndXJlIF9pZCBhbmQgcmVsYXRlZCB3aXRoIHRoZSBuZXcgcmVsYXRlZCBvYmplY3QuXG4gICAgICogQHBhcmFtIG9ialxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0c11cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRzLmRpc2FibGVOb3RpZmljYXRpb25zXVxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd8dW5kZWZpbmVkfSAtIEVycm9yIG1lc3NhZ2Ugb3IgdW5kZWZpbmVkXG4gICAgICovXG4gICAgc2V0SWRBbmRSZWxhdGVkOiBmdW5jdGlvbihvYmosIG9wdHMpIHtcbiAgICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgICAgaWYgKCFvcHRzLmRpc2FibGVldmVudHMpIHZhciBvbGRWYWx1ZSA9IHRoaXMuX2dldE9sZFZhbHVlRm9yU2V0Q2hhbmdlRXZlbnQoKTtcbiAgICAgIHZhciBwcmV2aW91c2x5UmVsYXRlZCA9IHRoaXMucmVsYXRlZDtcbiAgICAgIGlmIChwcmV2aW91c2x5UmVsYXRlZCkgdGhpcy5jbGVhclJlbW92YWxMaXN0ZW5lcihwcmV2aW91c2x5UmVsYXRlZCk7XG4gICAgICBpZiAob2JqKSB7XG4gICAgICAgIGlmICh1dGlsLmlzQXJyYXkob2JqKSkge1xuICAgICAgICAgIHRoaXMucmVsYXRlZCA9IG9iajtcbiAgICAgICAgICBvYmouZm9yRWFjaChmdW5jdGlvbihfb2JqKSB7XG4gICAgICAgICAgICB0aGlzLmxpc3RlbkZvclJlbW92YWwoX29iaik7XG4gICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnJlbGF0ZWQgPSBvYmo7XG4gICAgICAgICAgdGhpcy5saXN0ZW5Gb3JSZW1vdmFsKG9iaik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICB0aGlzLnJlbGF0ZWQgPSBudWxsO1xuICAgICAgfVxuICAgICAgaWYgKCFvcHRzLmRpc2FibGVldmVudHMpIHRoaXMucmVnaXN0ZXJTZXRDaGFuZ2Uob2JqLCBvbGRWYWx1ZSk7XG4gICAgfSxcbiAgICBjaGVja0luc3RhbGxlZDogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoIXRoaXMub2JqZWN0KSB7XG4gICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdQcm94eSBtdXN0IGJlIGluc3RhbGxlZCBvbiBhbiBvYmplY3QgYmVmb3JlIGNhbiB1c2UgaXQuJyk7XG4gICAgICB9XG4gICAgfSxcbiAgICBzcGxpY2VyOiBmdW5jdGlvbihvcHRzKSB7XG4gICAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICAgIHJldHVybiBmdW5jdGlvbihpZHgsIG51bVJlbW92ZSkge1xuICAgICAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICAgICAgaWYgKCFvcHRzLmRpc2FibGVldmVudHMpIHtcbiAgICAgICAgICB2YXIgYWRkZWQgPSB0aGlzLl9nZXRBZGRlZEZvclNwbGljZUNoYW5nZUV2ZW50KGFyZ3VtZW50cyksXG4gICAgICAgICAgICByZW1vdmVkID0gdGhpcy5fZ2V0UmVtb3ZlZEZvclNwbGljZUNoYW5nZUV2ZW50KGlkeCwgbnVtUmVtb3ZlKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgYWRkID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICAgICAgdmFyIHJlcyA9IF8ucGFydGlhbCh0aGlzLnJlbGF0ZWQuc3BsaWNlLCBpZHgsIG51bVJlbW92ZSkuYXBwbHkodGhpcy5yZWxhdGVkLCBhZGQpO1xuICAgICAgICBpZiAoIW9wdHMuZGlzYWJsZWV2ZW50cykgdGhpcy5yZWdpc3RlclNwbGljZUNoYW5nZShpZHgsIGFkZGVkLCByZW1vdmVkKTtcbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICAgIH0uYmluZCh0aGlzKTtcbiAgICB9LFxuICAgIGNsZWFyUmV2ZXJzZVJlbGF0ZWQ6IGZ1bmN0aW9uKG9wdHMpIHtcbiAgICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgaWYgKHRoaXMucmVsYXRlZCkge1xuICAgICAgICB2YXIgcmV2ZXJzZVByb3h5ID0gdGhpcy5yZXZlcnNlUHJveHlGb3JJbnN0YW5jZSh0aGlzLnJlbGF0ZWQpO1xuICAgICAgICB2YXIgcmV2ZXJzZVByb3hpZXMgPSB1dGlsLmlzQXJyYXkocmV2ZXJzZVByb3h5KSA/IHJldmVyc2VQcm94eSA6IFtyZXZlcnNlUHJveHldO1xuICAgICAgICBfLmVhY2gocmV2ZXJzZVByb3hpZXMsIGZ1bmN0aW9uKHApIHtcbiAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KHAucmVsYXRlZCkpIHtcbiAgICAgICAgICAgIHZhciBpZHggPSBwLnJlbGF0ZWQuaW5kZXhPZihzZWxmLm9iamVjdCk7XG4gICAgICAgICAgICBwLm1ha2VDaGFuZ2VzVG9SZWxhdGVkV2l0aG91dE9ic2VydmF0aW9ucyhmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgcC5zcGxpY2VyKG9wdHMpKGlkeCwgMSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcC5zZXRJZEFuZFJlbGF0ZWQobnVsbCwgb3B0cyk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9LFxuICAgIHNldElkQW5kUmVsYXRlZFJldmVyc2U6IGZ1bmN0aW9uKG9iaiwgb3B0cykge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgdmFyIHJldmVyc2VQcm94eSA9IHRoaXMucmV2ZXJzZVByb3h5Rm9ySW5zdGFuY2Uob2JqKTtcbiAgICAgIHZhciByZXZlcnNlUHJveGllcyA9IHV0aWwuaXNBcnJheShyZXZlcnNlUHJveHkpID8gcmV2ZXJzZVByb3h5IDogW3JldmVyc2VQcm94eV07XG4gICAgICBfLmVhY2gocmV2ZXJzZVByb3hpZXMsIGZ1bmN0aW9uKHApIHtcbiAgICAgICAgaWYgKHV0aWwuaXNBcnJheShwLnJlbGF0ZWQpKSB7XG4gICAgICAgICAgcC5tYWtlQ2hhbmdlc1RvUmVsYXRlZFdpdGhvdXRPYnNlcnZhdGlvbnMoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBwLnNwbGljZXIob3B0cykocC5yZWxhdGVkLmxlbmd0aCwgMCwgc2VsZi5vYmplY3QpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHAuY2xlYXJSZXZlcnNlUmVsYXRlZChvcHRzKTtcbiAgICAgICAgICBwLnNldElkQW5kUmVsYXRlZChzZWxmLm9iamVjdCwgb3B0cyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0sXG4gICAgbWFrZUNoYW5nZXNUb1JlbGF0ZWRXaXRob3V0T2JzZXJ2YXRpb25zOiBmdW5jdGlvbihmKSB7XG4gICAgICBpZiAodGhpcy5yZWxhdGVkKSB7XG4gICAgICAgIHRoaXMucmVsYXRlZC5hcnJheU9ic2VydmVyLmNsb3NlKCk7XG4gICAgICAgIHRoaXMucmVsYXRlZC5hcnJheU9ic2VydmVyID0gbnVsbDtcbiAgICAgICAgZigpO1xuICAgICAgICB0aGlzLndyYXBBcnJheSh0aGlzLnJlbGF0ZWQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZigpO1xuICAgICAgfVxuICAgIH0sXG4gICAgLyoqXG4gICAgICogR2V0IG9sZCB2YWx1ZSB0aGF0IGlzIHNlbnQgb3V0IGluIGVtaXNzaW9ucy5cbiAgICAgKiBAcmV0dXJucyB7Kn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9nZXRPbGRWYWx1ZUZvclNldENoYW5nZUV2ZW50OiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBvbGRWYWx1ZSA9IHRoaXMucmVsYXRlZDtcbiAgICAgIGlmICh1dGlsLmlzQXJyYXkob2xkVmFsdWUpICYmICFvbGRWYWx1ZS5sZW5ndGgpIHtcbiAgICAgICAgb2xkVmFsdWUgPSBudWxsO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG9sZFZhbHVlO1xuICAgIH0sXG4gICAgcmVnaXN0ZXJTZXRDaGFuZ2U6IGZ1bmN0aW9uKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgdmFyIHByb3h5T2JqZWN0ID0gdGhpcy5vYmplY3Q7XG4gICAgICBpZiAoIXByb3h5T2JqZWN0KSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignUHJveHkgbXVzdCBoYXZlIGFuIG9iamVjdCBhc3NvY2lhdGVkJyk7XG4gICAgICB2YXIgbW9kZWwgPSBwcm94eU9iamVjdC5tb2RlbC5uYW1lO1xuICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gcHJveHlPYmplY3QuY29sbGVjdGlvbk5hbWU7XG4gICAgICAvLyBXZSB0YWtlIFtdID09IG51bGwgPT0gdW5kZWZpbmVkIGluIHRoZSBjYXNlIG9mIHJlbGF0aW9uc2hpcHMuXG4gICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgY29sbGVjdGlvbjogY29sbGVjdGlvbk5hbWUsXG4gICAgICAgIG1vZGVsOiBtb2RlbCxcbiAgICAgICAgbG9jYWxJZDogcHJveHlPYmplY3QubG9jYWxJZCxcbiAgICAgICAgZmllbGQ6IHRoaXMuZ2V0Rm9yd2FyZE5hbWUoKSxcbiAgICAgICAgb2xkOiBvbGRWYWx1ZSxcbiAgICAgICAgbmV3OiBuZXdWYWx1ZSxcbiAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU2V0LFxuICAgICAgICBvYmo6IHByb3h5T2JqZWN0XG4gICAgICB9KTtcbiAgICB9LFxuXG4gICAgX2dldFJlbW92ZWRGb3JTcGxpY2VDaGFuZ2VFdmVudDogZnVuY3Rpb24oaWR4LCBudW1SZW1vdmUpIHtcbiAgICAgIHZhciByZW1vdmVkID0gdGhpcy5yZWxhdGVkID8gdGhpcy5yZWxhdGVkLnNsaWNlKGlkeCwgaWR4ICsgbnVtUmVtb3ZlKSA6IG51bGw7XG4gICAgICByZXR1cm4gcmVtb3ZlZDtcbiAgICB9LFxuXG4gICAgX2dldEFkZGVkRm9yU3BsaWNlQ2hhbmdlRXZlbnQ6IGZ1bmN0aW9uKGFyZ3MpIHtcbiAgICAgIHZhciBhZGQgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmdzLCAyKSxcbiAgICAgICAgYWRkZWQgPSBhZGQubGVuZ3RoID8gYWRkIDogW107XG4gICAgICByZXR1cm4gYWRkZWQ7XG4gICAgfSxcblxuICAgIHJlZ2lzdGVyU3BsaWNlQ2hhbmdlOiBmdW5jdGlvbihpZHgsIGFkZGVkLCByZW1vdmVkKSB7XG4gICAgICB2YXIgbW9kZWwgPSB0aGlzLm9iamVjdC5tb2RlbC5uYW1lLFxuICAgICAgICBjb2xsID0gdGhpcy5vYmplY3QuY29sbGVjdGlvbk5hbWU7XG4gICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgY29sbGVjdGlvbjogY29sbCxcbiAgICAgICAgbW9kZWw6IG1vZGVsLFxuICAgICAgICBsb2NhbElkOiB0aGlzLm9iamVjdC5sb2NhbElkLFxuICAgICAgICBmaWVsZDogdGhpcy5nZXRGb3J3YXJkTmFtZSgpLFxuICAgICAgICBpbmRleDogaWR4LFxuICAgICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgICAgICBhZGRlZDogYWRkZWQsXG4gICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgb2JqOiB0aGlzLm9iamVjdFxuICAgICAgfSk7XG4gICAgfSxcbiAgICB3cmFwQXJyYXk6IGZ1bmN0aW9uKGFycikge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgd3JhcEFycmF5Rm9yQXR0cmlidXRlcyhhcnIsIHRoaXMucmV2ZXJzZU5hbWUsIHRoaXMub2JqZWN0KTtcbiAgICAgIGlmICghYXJyLmFycmF5T2JzZXJ2ZXIpIHtcbiAgICAgICAgYXJyLmFycmF5T2JzZXJ2ZXIgPSBuZXcgQXJyYXlPYnNlcnZlcihhcnIpO1xuICAgICAgICB2YXIgb2JzZXJ2ZXJGdW5jdGlvbiA9IGZ1bmN0aW9uKHNwbGljZXMpIHtcbiAgICAgICAgICBzcGxpY2VzLmZvckVhY2goZnVuY3Rpb24oc3BsaWNlKSB7XG4gICAgICAgICAgICB2YXIgYWRkZWQgPSBzcGxpY2UuYWRkZWRDb3VudCA/IGFyci5zbGljZShzcGxpY2UuaW5kZXgsIHNwbGljZS5pbmRleCArIHNwbGljZS5hZGRlZENvdW50KSA6IFtdO1xuICAgICAgICAgICAgdmFyIG1vZGVsID0gc2VsZi5nZXRGb3J3YXJkTW9kZWwoKTtcbiAgICAgICAgICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBtb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgbW9kZWw6IG1vZGVsLm5hbWUsXG4gICAgICAgICAgICAgIGxvY2FsSWQ6IHNlbGYub2JqZWN0LmxvY2FsSWQsXG4gICAgICAgICAgICAgIGZpZWxkOiBzZWxmLmdldEZvcndhcmROYW1lKCksXG4gICAgICAgICAgICAgIHJlbW92ZWQ6IHNwbGljZS5yZW1vdmVkLFxuICAgICAgICAgICAgICBhZGRlZDogYWRkZWQsXG4gICAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgICAgb2JqOiBzZWxmLm9iamVjdFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgICAgIGFyci5hcnJheU9ic2VydmVyLm9wZW4ob2JzZXJ2ZXJGdW5jdGlvbik7XG4gICAgICB9XG4gICAgfSxcbiAgICBzcGxpY2U6IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5zcGxpY2VyKHt9KS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cblxuICB9KTtcblxuXG4gIG1vZHVsZS5leHBvcnRzID0gUmVsYXRpb25zaGlwUHJveHk7XG5cblxufSkoKTsiLCIoZnVuY3Rpb24gKCkge1xuICAgIG1vZHVsZS5leHBvcnRzID0ge1xuICAgICAgICBPbmVUb01hbnk6ICdPbmVUb01hbnknLFxuICAgICAgICBPbmVUb09uZTogJ09uZVRvT25lJyxcbiAgICAgICAgTWFueVRvTWFueTogJ01hbnlUb01hbnknXG4gICAgfTtcbn0pKCk7IiwiLyoqXG4gKiBUaGlzIGlzIGFuIGluLW1lbW9yeSBjYWNoZSBmb3IgbW9kZWxzLiBNb2RlbHMgYXJlIGNhY2hlZCBieSBsb2NhbCBpZCAoX2lkKSBhbmQgcmVtb3RlIGlkIChkZWZpbmVkIGJ5IHRoZSBtYXBwaW5nKS5cbiAqIExvb2t1cHMgYXJlIHBlcmZvcm1lZCBhZ2FpbnN0IHRoZSBjYWNoZSB3aGVuIG1hcHBpbmcuXG4gKiBAbW9kdWxlIGNhY2hlXG4gKi9cbihmdW5jdGlvbigpIHtcblxuICB2YXIgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSgnY2FjaGUnKSxcbiAgICBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpO1xuXG5cbiAgdmFyIGxvY2FsQ2FjaGVCeUlkID0ge30sXG4gICAgbG9jYWxDYWNoZSA9IHt9LFxuICAgIHJlbW90ZUNhY2hlID0ge307XG5cbiAgLyoqXG4gICAqIENsZWFyIG91dCB0aGUgY2FjaGUuXG4gICAqL1xuICBmdW5jdGlvbiByZXNldCgpIHtcbiAgICByZW1vdGVDYWNoZSA9IHt9O1xuICAgIGxvY2FsQ2FjaGVCeUlkID0ge307XG4gICAgbG9jYWxDYWNoZSA9IHt9O1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiB0aGUgb2JqZWN0IGluIHRoZSBjYWNoZSBnaXZlbiBhIGxvY2FsIGlkIChfaWQpXG4gICAqIEBwYXJhbSAge1N0cmluZ3xBcnJheX0gbG9jYWxJZFxuICAgKiBAcmV0dXJuIHtNb2RlbEluc3RhbmNlfVxuICAgKi9cbiAgZnVuY3Rpb24gZ2V0VmlhTG9jYWxJZChsb2NhbElkKSB7XG4gICAgaWYgKHV0aWwuaXNBcnJheShsb2NhbElkKSkgcmV0dXJuIF8ubWFwKGxvY2FsSWQsIGZ1bmN0aW9uICh4KSB7cmV0dXJuIGxvY2FsQ2FjaGVCeUlkW3hdfSk7XG4gICAgZWxzZSByZXR1cm4gbG9jYWxDYWNoZUJ5SWRbbG9jYWxJZF07XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHRoZSBzaW5nbGV0b24gb2JqZWN0IGdpdmVuIGEgc2luZ2xldG9uIG1vZGVsLlxuICAgKiBAcGFyYW0gIHtNb2RlbH0gbW9kZWxcbiAgICogQHJldHVybiB7TW9kZWxJbnN0YW5jZX1cbiAgICovXG4gIGZ1bmN0aW9uIGdldFNpbmdsZXRvbihtb2RlbCkge1xuICAgIHZhciBtb2RlbE5hbWUgPSBtb2RlbC5uYW1lO1xuICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IG1vZGVsLmNvbGxlY3Rpb25OYW1lO1xuICAgIHZhciBjb2xsZWN0aW9uQ2FjaGUgPSBsb2NhbENhY2hlW2NvbGxlY3Rpb25OYW1lXTtcbiAgICBpZiAoY29sbGVjdGlvbkNhY2hlKSB7XG4gICAgICB2YXIgdHlwZUNhY2hlID0gY29sbGVjdGlvbkNhY2hlW21vZGVsTmFtZV07XG4gICAgICBpZiAodHlwZUNhY2hlKSB7XG4gICAgICAgIHZhciBvYmpzID0gW107XG4gICAgICAgIGZvciAodmFyIHByb3AgaW4gdHlwZUNhY2hlKSB7XG4gICAgICAgICAgaWYgKHR5cGVDYWNoZS5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgICAgb2Jqcy5wdXNoKHR5cGVDYWNoZVtwcm9wXSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChvYmpzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICB2YXIgZXJyU3RyID0gJ0Egc2luZ2xldG9uIG1vZGVsIGhhcyBtb3JlIHRoYW4gMSBvYmplY3QgaW4gdGhlIGNhY2hlISBUaGlzIGlzIGEgc2VyaW91cyBlcnJvci4gJyArXG4gICAgICAgICAgICAnRWl0aGVyIGEgbW9kZWwgaGFzIGJlZW4gbW9kaWZpZWQgYWZ0ZXIgb2JqZWN0cyBoYXZlIGFscmVhZHkgYmVlbiBjcmVhdGVkLCBvciBzb21ldGhpbmcgaGFzIGdvbmUnICtcbiAgICAgICAgICAgICd2ZXJ5IHdyb25nLiBQbGVhc2UgZmlsZSBhIGJ1ZyByZXBvcnQgaWYgdGhlIGxhdHRlci4nO1xuICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKGVyclN0cik7XG4gICAgICAgIH0gZWxzZSBpZiAob2Jqcy5sZW5ndGgpIHtcbiAgICAgICAgICByZXR1cm4gb2Jqc1swXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBHaXZlbiBhIHJlbW90ZSBpZGVudGlmaWVyIGFuZCBhbiBvcHRpb25zIG9iamVjdCB0aGF0IGRlc2NyaWJlcyBtYXBwaW5nL2NvbGxlY3Rpb24sXG4gICAqIHJldHVybiB0aGUgbW9kZWwgaWYgY2FjaGVkLlxuICAgKiBAcGFyYW0gIHtTdHJpbmd8QXJyYXl9IHJlbW90ZUlkXG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0c1xuICAgKiBAcGFyYW0gIHtPYmplY3R9IG9wdHMubW9kZWxcbiAgICogQHJldHVybiB7TW9kZWxJbnN0YW5jZX1cbiAgICovXG4gIGZ1bmN0aW9uIGdldFZpYVJlbW90ZUlkKHJlbW90ZUlkLCBvcHRzKSB7XG4gICAgdmFyIGNhY2hlID0gKHJlbW90ZUNhY2hlW29wdHMubW9kZWwuY29sbGVjdGlvbk5hbWVdIHx8IHt9KVtvcHRzLm1vZGVsLm5hbWVdIHx8IHt9O1xuICAgIHJldHVybiB1dGlsLmlzQXJyYXkocmVtb3RlSWQpID8gXy5tYXAocmVtb3RlSWQsIGZ1bmN0aW9uKHgpIHtyZXR1cm4gY2FjaGVbeF19KSA6IGNhY2hlW3JlbW90ZUlkXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbnNlcnQgYW4gb2JqZWN0IGludG8gdGhlIGNhY2hlIHVzaW5nIGEgcmVtb3RlIGlkZW50aWZpZXIgZGVmaW5lZCBieSB0aGUgbWFwcGluZy5cbiAgICogQHBhcmFtICB7TW9kZWxJbnN0YW5jZX0gb2JqXG4gICAqIEBwYXJhbSAge1N0cmluZ30gcmVtb3RlSWRcbiAgICogQHBhcmFtICB7U3RyaW5nfSBwcmV2aW91c1JlbW90ZUlkIElmIHJlbW90ZSBpZCBoYXMgYmVlbiBjaGFuZ2VkLCB0aGlzIGlzIHRoZSBvbGQgcmVtb3RlIGlkZW50aWZpZXJcbiAgICovXG4gIGZ1bmN0aW9uIHJlbW90ZUluc2VydChvYmosIHJlbW90ZUlkLCBwcmV2aW91c1JlbW90ZUlkKSB7XG4gICAgaWYgKG9iaikge1xuICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gb2JqLm1vZGVsLmNvbGxlY3Rpb25OYW1lO1xuICAgICAgaWYgKGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgICAgIGlmICghcmVtb3RlQ2FjaGVbY29sbGVjdGlvbk5hbWVdKSB7XG4gICAgICAgICAgcmVtb3RlQ2FjaGVbY29sbGVjdGlvbk5hbWVdID0ge307XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHR5cGUgPSBvYmoubW9kZWwubmFtZTtcbiAgICAgICAgaWYgKHR5cGUpIHtcbiAgICAgICAgICBpZiAoIXJlbW90ZUNhY2hlW2NvbGxlY3Rpb25OYW1lXVt0eXBlXSkge1xuICAgICAgICAgICAgcmVtb3RlQ2FjaGVbY29sbGVjdGlvbk5hbWVdW3R5cGVdID0ge307XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChwcmV2aW91c1JlbW90ZUlkKSB7XG4gICAgICAgICAgICByZW1vdGVDYWNoZVtjb2xsZWN0aW9uTmFtZV1bdHlwZV1bcHJldmlvdXNSZW1vdGVJZF0gPSBudWxsO1xuICAgICAgICAgIH1cbiAgICAgICAgICB2YXIgY2FjaGVkT2JqZWN0ID0gcmVtb3RlQ2FjaGVbY29sbGVjdGlvbk5hbWVdW3R5cGVdW3JlbW90ZUlkXTtcbiAgICAgICAgICBpZiAoIWNhY2hlZE9iamVjdCkge1xuICAgICAgICAgICAgcmVtb3RlQ2FjaGVbY29sbGVjdGlvbk5hbWVdW3R5cGVdW3JlbW90ZUlkXSA9IG9iajtcbiAgICAgICAgICAgIGxvZygnUmVtb3RlIGNhY2hlIGluc2VydDogJyArIG9iai5fZHVtcCh0cnVlKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFNvbWV0aGluZyBoYXMgZ29uZSByZWFsbHkgd3JvbmcuIE9ubHkgb25lIG9iamVjdCBmb3IgYSBwYXJ0aWN1bGFyIGNvbGxlY3Rpb24vdHlwZS9yZW1vdGVpZCBjb21ib1xuICAgICAgICAgICAgLy8gc2hvdWxkIGV2ZXIgZXhpc3QuXG4gICAgICAgICAgICBpZiAob2JqICE9IGNhY2hlZE9iamVjdCkge1xuICAgICAgICAgICAgICB2YXIgbWVzc2FnZSA9ICdPYmplY3QgJyArIGNvbGxlY3Rpb25OYW1lLnRvU3RyaW5nKCkgKyAnOicgKyB0eXBlLnRvU3RyaW5nKCkgKyAnWycgKyBvYmoubW9kZWwuaWQgKyAnPVwiJyArIHJlbW90ZUlkICsgJ1wiXSBhbHJlYWR5IGV4aXN0cyBpbiB0aGUgY2FjaGUuJyArXG4gICAgICAgICAgICAgICAgJyBUaGlzIGlzIGEgc2VyaW91cyBlcnJvciwgcGxlYXNlIGZpbGUgYSBidWcgcmVwb3J0IGlmIHlvdSBhcmUgZXhwZXJpZW5jaW5nIHRoaXMgb3V0IGluIHRoZSB3aWxkJztcbiAgICAgICAgICAgICAgbG9nKG1lc3NhZ2UsIHtcbiAgICAgICAgICAgICAgICBvYmo6IG9iaixcbiAgICAgICAgICAgICAgICBjYWNoZWRPYmplY3Q6IGNhY2hlZE9iamVjdFxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IobWVzc2FnZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBsb2coJ09iamVjdCBoYXMgYWxyZWFkeSBiZWVuIGluc2VydGVkOiAnICsgb2JqLl9kdW1wKHRydWUpKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTW9kZWwgaGFzIG5vIHR5cGUnLCB7XG4gICAgICAgICAgICBtb2RlbDogb2JqLm1vZGVsLFxuICAgICAgICAgICAgb2JqOiBvYmpcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ01vZGVsIGhhcyBubyBjb2xsZWN0aW9uJywge1xuICAgICAgICAgIG1vZGVsOiBvYmoubW9kZWwsXG4gICAgICAgICAgb2JqOiBvYmpcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBtc2cgPSAnTXVzdCBwYXNzIGFuIG9iamVjdCB3aGVuIGluc2VydGluZyB0byBjYWNoZSc7XG4gICAgICBsb2cobXNnKTtcbiAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKG1zZyk7XG4gICAgfVxuICB9XG5cblxuICBmdW5jdGlvbiBfcmVtb3RlQ2FjaGUoKSB7XG4gICAgcmV0dXJuIHJlbW90ZUNhY2hlXG4gIH1cblxuICBmdW5jdGlvbiBfbG9jYWxDYWNoZSgpIHtcbiAgICByZXR1cm4gbG9jYWxDYWNoZUJ5SWQ7XG4gIH1cblxuICAvKipcbiAgICogUXVlcnkgdGhlIGNhY2hlXG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0cyBPYmplY3QgZGVzY3JpYmluZyB0aGUgcXVlcnlcbiAgICogQHJldHVybiB7TW9kZWxJbnN0YW5jZX1cbiAgICogQGV4YW1wbGVcbiAgICogYGBganNcbiAgICogY2FjaGUuZ2V0KHtfaWQ6ICc1J30pOyAvLyBRdWVyeSBieSBsb2NhbCBpZFxuICAgKiBjYWNoZS5nZXQoe3JlbW90ZUlkOiAnNScsIG1hcHBpbmc6IG15TWFwcGluZ30pOyAvLyBRdWVyeSBieSByZW1vdGUgaWRcbiAgICogYGBgXG4gICAqL1xuICBmdW5jdGlvbiBnZXQob3B0cykge1xuICAgIGxvZygnZ2V0Jywgb3B0cyk7XG4gICAgdmFyIG9iaiwgaWRGaWVsZCwgcmVtb3RlSWQ7XG4gICAgdmFyIGxvY2FsSWQgPSBvcHRzLmxvY2FsSWQ7XG4gICAgaWYgKGxvY2FsSWQpIHtcbiAgICAgIG9iaiA9IGdldFZpYUxvY2FsSWQobG9jYWxJZCk7XG4gICAgICBpZiAob2JqKSB7XG4gICAgICAgIHJldHVybiBvYmo7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAob3B0cy5tb2RlbCkge1xuICAgICAgICAgIGlkRmllbGQgPSBvcHRzLm1vZGVsLmlkO1xuICAgICAgICAgIHJlbW90ZUlkID0gb3B0c1tpZEZpZWxkXTtcbiAgICAgICAgICBsb2coaWRGaWVsZCArICc9JyArIHJlbW90ZUlkKTtcbiAgICAgICAgICByZXR1cm4gZ2V0VmlhUmVtb3RlSWQocmVtb3RlSWQsIG9wdHMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChvcHRzLm1vZGVsKSB7XG4gICAgICBpZEZpZWxkID0gb3B0cy5tb2RlbC5pZDtcbiAgICAgIHJlbW90ZUlkID0gb3B0c1tpZEZpZWxkXTtcbiAgICAgIGlmIChyZW1vdGVJZCkge1xuICAgICAgICByZXR1cm4gZ2V0VmlhUmVtb3RlSWQocmVtb3RlSWQsIG9wdHMpO1xuICAgICAgfSBlbHNlIGlmIChvcHRzLm1vZGVsLnNpbmdsZXRvbikge1xuICAgICAgICByZXR1cm4gZ2V0U2luZ2xldG9uKG9wdHMubW9kZWwpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBsb2coJ0ludmFsaWQgb3B0cyB0byBjYWNoZScsIHtcbiAgICAgICAgb3B0czogb3B0c1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIEluc2VydCBhbiBvYmplY3QgaW50byB0aGUgY2FjaGUuXG4gICAqIEBwYXJhbSAge01vZGVsSW5zdGFuY2V9IG9ialxuICAgKiBAdGhyb3dzIHtJbnRlcm5hbFNpZXN0YUVycm9yfSBBbiBvYmplY3Qgd2l0aCBfaWQvcmVtb3RlSWQgYWxyZWFkeSBleGlzdHMuIE5vdCB0aHJvd24gaWYgc2FtZSBvYmhlY3QuXG4gICAqL1xuICBmdW5jdGlvbiBpbnNlcnQob2JqKSB7XG4gICAgdmFyIGxvY2FsSWQgPSBvYmoubG9jYWxJZDtcbiAgICBpZiAobG9jYWxJZCkge1xuICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gb2JqLm1vZGVsLmNvbGxlY3Rpb25OYW1lO1xuICAgICAgdmFyIG1vZGVsTmFtZSA9IG9iai5tb2RlbC5uYW1lO1xuICAgICAgaWYgKCFsb2NhbENhY2hlQnlJZFtsb2NhbElkXSkge1xuICAgICAgICBsb2NhbENhY2hlQnlJZFtsb2NhbElkXSA9IG9iajtcbiAgICAgICAgaWYgKCFsb2NhbENhY2hlW2NvbGxlY3Rpb25OYW1lXSkgbG9jYWxDYWNoZVtjb2xsZWN0aW9uTmFtZV0gPSB7fTtcbiAgICAgICAgaWYgKCFsb2NhbENhY2hlW2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdKSBsb2NhbENhY2hlW2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdID0ge307XG4gICAgICAgIGxvY2FsQ2FjaGVbY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV1bbG9jYWxJZF0gPSBvYmo7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBTb21ldGhpbmcgaGFzIGdvbmUgYmFkbHkgd3JvbmcgaGVyZS4gVHdvIG9iamVjdHMgc2hvdWxkIG5ldmVyIGV4aXN0IHdpdGggdGhlIHNhbWUgX2lkXG4gICAgICAgIGlmIChsb2NhbENhY2hlQnlJZFtsb2NhbElkXSAhPSBvYmopIHtcbiAgICAgICAgICB2YXIgbWVzc2FnZSA9ICdPYmplY3Qgd2l0aCBsb2NhbElkPVwiJyArIGxvY2FsSWQudG9TdHJpbmcoKSArICdcIiBpcyBhbHJlYWR5IGluIHRoZSBjYWNoZS4gJyArXG4gICAgICAgICAgICAnVGhpcyBpcyBhIHNlcmlvdXMgZXJyb3IuIFBsZWFzZSBmaWxlIGEgYnVnIHJlcG9ydCBpZiB5b3UgYXJlIGV4cGVyaWVuY2luZyB0aGlzIG91dCBpbiB0aGUgd2lsZCc7XG4gICAgICAgICAgbG9nKG1lc3NhZ2UpO1xuICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKG1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHZhciBpZEZpZWxkID0gb2JqLmlkRmllbGQ7XG4gICAgdmFyIHJlbW90ZUlkID0gb2JqW2lkRmllbGRdO1xuICAgIGlmIChyZW1vdGVJZCkge1xuICAgICAgcmVtb3RlSW5zZXJ0KG9iaiwgcmVtb3RlSWQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2coJ05vIHJlbW90ZSBpZCAoXCInICsgaWRGaWVsZCArICdcIikgc28gd29udCBiZSBwbGFjaW5nIGluIHRoZSByZW1vdGUgY2FjaGUnLCBvYmopO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRydWUgaWYgb2JqZWN0IGlzIGluIHRoZSBjYWNoZVxuICAgKiBAcGFyYW0gIHtNb2RlbEluc3RhbmNlfSBvYmpcbiAgICogQHJldHVybiB7Ym9vbGVhbn1cbiAgICovXG4gIGZ1bmN0aW9uIGNvbnRhaW5zKG9iaikge1xuICAgIHZhciBxID0ge1xuICAgICAgbG9jYWxJZDogb2JqLmxvY2FsSWRcbiAgICB9O1xuICAgIHZhciBtb2RlbCA9IG9iai5tb2RlbDtcbiAgICBpZiAobW9kZWwuaWQpIHtcbiAgICAgIGlmIChvYmpbbW9kZWwuaWRdKSB7XG4gICAgICAgIHEubW9kZWwgPSBtb2RlbDtcbiAgICAgICAgcVttb2RlbC5pZF0gPSBvYmpbbW9kZWwuaWRdO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gISFnZXQocSk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlcyB0aGUgb2JqZWN0IGZyb20gdGhlIGNhY2hlIChpZiBpdCdzIGFjdHVhbGx5IGluIHRoZSBjYWNoZSkgb3RoZXJ3aXNlcyB0aHJvd3MgYW4gZXJyb3IuXG4gICAqIEBwYXJhbSAge01vZGVsSW5zdGFuY2V9IG9ialxuICAgKiBAdGhyb3dzIHtJbnRlcm5hbFNpZXN0YUVycm9yfSBJZiBvYmplY3QgYWxyZWFkeSBpbiB0aGUgY2FjaGUuXG4gICAqL1xuICBmdW5jdGlvbiByZW1vdmUob2JqKSB7XG4gICAgaWYgKGNvbnRhaW5zKG9iaikpIHtcbiAgICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IG9iai5tb2RlbC5jb2xsZWN0aW9uTmFtZTtcbiAgICAgIHZhciBtb2RlbE5hbWUgPSBvYmoubW9kZWwubmFtZTtcbiAgICAgIHZhciBsb2NhbElkID0gb2JqLmxvY2FsSWQ7XG4gICAgICBpZiAoIW1vZGVsTmFtZSkgdGhyb3cgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gbWFwcGluZyBuYW1lJyk7XG4gICAgICBpZiAoIWNvbGxlY3Rpb25OYW1lKSB0aHJvdyBJbnRlcm5hbFNpZXN0YUVycm9yKCdObyBjb2xsZWN0aW9uIG5hbWUnKTtcbiAgICAgIGlmICghbG9jYWxJZCkgdGhyb3cgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gbG9jYWxJZCcpO1xuICAgICAgZGVsZXRlIGxvY2FsQ2FjaGVbY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV1bbG9jYWxJZF07XG4gICAgICBkZWxldGUgbG9jYWxDYWNoZUJ5SWRbbG9jYWxJZF07XG4gICAgICBpZiAob2JqLm1vZGVsLmlkKSB7XG4gICAgICAgIHZhciByZW1vdGVJZCA9IG9ialtvYmoubW9kZWwuaWRdO1xuICAgICAgICBpZiAocmVtb3RlSWQpIHtcbiAgICAgICAgICBkZWxldGUgcmVtb3RlQ2FjaGVbY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV1bcmVtb3RlSWRdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cblxuICBleHBvcnRzLl9yZW1vdGVDYWNoZSA9IF9yZW1vdGVDYWNoZTtcbiAgZXhwb3J0cy5fbG9jYWxDYWNoZSA9IF9sb2NhbENhY2hlO1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ19sb2NhbENhY2hlQnlUeXBlJywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gbG9jYWxDYWNoZTtcbiAgICB9XG4gIH0pO1xuICBleHBvcnRzLmdldCA9IGdldDtcbiAgZXhwb3J0cy5pbnNlcnQgPSBpbnNlcnQ7XG4gIGV4cG9ydHMucmVtb3RlSW5zZXJ0ID0gcmVtb3RlSW5zZXJ0O1xuICBleHBvcnRzLnJlc2V0ID0gcmVzZXQ7XG4gIGV4cG9ydHMuY29udGFpbnMgPSBjb250YWlucztcbiAgZXhwb3J0cy5yZW1vdmUgPSByZW1vdmU7XG4gIGV4cG9ydHMuZ2V0U2luZ2xldG9uID0gZ2V0U2luZ2xldG9uO1xuICBleHBvcnRzLmdldFZpYUxvY2FsSWQgPSBnZXRWaWFMb2NhbElkO1xuICBleHBvcnRzLmdldFZpYVJlbW90ZUlkID0gZ2V0VmlhUmVtb3RlSWQ7XG4gIGV4cG9ydHMuY291bnQgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXMobG9jYWxDYWNoZUJ5SWQpLmxlbmd0aDtcbiAgfVxufSkoKTsiLCIvKipcbiAqIEBtb2R1bGUgY29sbGVjdGlvblxuICovXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpKCdjb2xsZWN0aW9uJyksXG4gICAgQ29sbGVjdGlvblJlZ2lzdHJ5ID0gcmVxdWlyZSgnLi9jb2xsZWN0aW9uUmVnaXN0cnknKS5Db2xsZWN0aW9uUmVnaXN0cnksXG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgIE1vZGVsID0gcmVxdWlyZSgnLi9tb2RlbCcpLFxuICAgIGV4dGVuZCA9IHJlcXVpcmUoJ2V4dGVuZCcpLFxuICAgIG9ic2VydmUgPSByZXF1aXJlKCcuLi92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZScpLlBsYXRmb3JtLFxuICAgIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIF8gPSB1dGlsLl8sXG4gICAgZXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJyksXG4gICAgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyk7XG5cblxuICAvKipcbiAgICogQSBjb2xsZWN0aW9uIGRlc2NyaWJlcyBhIHNldCBvZiBtb2RlbHMgYW5kIG9wdGlvbmFsbHkgYSBSRVNUIEFQSSB3aGljaCB3ZSB3b3VsZFxuICAgKiBsaWtlIHRvIG1vZGVsLlxuICAgKlxuICAgKiBAcGFyYW0gbmFtZVxuICAgKiBAcGFyYW0gb3B0c1xuICAgKiBAY29uc3RydWN0b3JcbiAgICpcbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYGBganNcbiAgICogdmFyIEdpdEh1YiA9IG5ldyBzaWVzdGEoJ0dpdEh1YicpXG4gICAqIC8vIC4uLiBjb25maWd1cmUgbWFwcGluZ3MsIGRlc2NyaXB0b3JzIGV0YyAuLi5cbiAgICogR2l0SHViLmluc3RhbGwoZnVuY3Rpb24gKCkge1xuICAgICAqICAgICAvLyAuLi4gY2Fycnkgb24uXG4gICAgICogfSk7XG4gICAqIGBgYFxuICAgKi9cbiAgZnVuY3Rpb24gQ29sbGVjdGlvbihuYW1lLCBvcHRzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICghbmFtZSkgdGhyb3cgbmV3IEVycm9yKCdDb2xsZWN0aW9uIG11c3QgaGF2ZSBhIG5hbWUnKTtcblxuICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgIHV0aWwuZXh0ZW5kRnJvbU9wdHModGhpcywgb3B0cywge30pO1xuXG4gICAgXy5leHRlbmQodGhpcywge1xuICAgICAgbmFtZTogbmFtZSxcbiAgICAgIF9yYXdNb2RlbHM6IHt9LFxuICAgICAgX21vZGVsczoge30sXG4gICAgICBfb3B0czogb3B0cyxcbiAgICAgIGluc3RhbGxlZDogZmFsc2VcbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHRoaXMsIHtcbiAgICAgIGRpcnR5OiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgaWYgKHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQpIHtcbiAgICAgICAgICAgIHZhciB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbiA9IHNpZXN0YS5leHQuc3RvcmFnZS5fdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb24sXG4gICAgICAgICAgICAgIGhhc2ggPSB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbltzZWxmLm5hbWVdIHx8IHt9O1xuICAgICAgICAgICAgcmV0dXJuICEhT2JqZWN0LmtleXMoaGFzaCkubGVuZ3RoO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIENvbGxlY3Rpb25SZWdpc3RyeS5yZWdpc3Rlcih0aGlzKTtcbiAgICB0aGlzLl9tYWtlQXZhaWxhYmxlT25Sb290KCk7XG4gICAgZXZlbnRzLlByb3h5RXZlbnRFbWl0dGVyLmNhbGwodGhpcywgdGhpcy5uYW1lKTtcbiAgfVxuXG4gIENvbGxlY3Rpb24ucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShldmVudHMuUHJveHlFdmVudEVtaXR0ZXIucHJvdG90eXBlKTtcblxuICBfLmV4dGVuZChDb2xsZWN0aW9uLnByb3RvdHlwZSwge1xuICAgIF9nZXRNb2RlbHNUb0luc3RhbGw6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIG1vZGVsc1RvSW5zdGFsbCA9IFtdO1xuICAgICAgZm9yICh2YXIgbmFtZSBpbiB0aGlzLl9tb2RlbHMpIHtcbiAgICAgICAgaWYgKHRoaXMuX21vZGVscy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICAgIHZhciBtb2RlbCA9IHRoaXMuX21vZGVsc1tuYW1lXTtcbiAgICAgICAgICBtb2RlbHNUb0luc3RhbGwucHVzaChtb2RlbCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGxvZygnVGhlcmUgYXJlICcgKyBtb2RlbHNUb0luc3RhbGwubGVuZ3RoLnRvU3RyaW5nKCkgKyAnIG1hcHBpbmdzIHRvIGluc3RhbGwnKTtcbiAgICAgIHJldHVybiBtb2RlbHNUb0luc3RhbGw7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBNZWFucyB0aGF0IHdlIGNhbiBhY2Nlc3MgdGhlIGNvbGxlY3Rpb24gb24gdGhlIHNpZXN0YSBvYmplY3QuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbWFrZUF2YWlsYWJsZU9uUm9vdDogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgaW5kZXggPSByZXF1aXJlKCcuL2luZGV4Jyk7XG4gICAgICBpbmRleFt0aGlzLm5hbWVdID0gdGhpcztcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIEVuc3VyZSBtYXBwaW5ncyBhcmUgaW5zdGFsbGVkLlxuICAgICAqIEBwYXJhbSBbY2JdXG4gICAgICogQGNsYXNzIENvbGxlY3Rpb25cbiAgICAgKi9cbiAgICBpbnN0YWxsOiBmdW5jdGlvbihjYikge1xuICAgICAgdmFyIG1vZGVsc1RvSW5zdGFsbCA9IHRoaXMuX2dldE1vZGVsc1RvSW5zdGFsbCgpO1xuICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgICAgaWYgKCF0aGlzLmluc3RhbGxlZCkge1xuICAgICAgICAgIHRoaXMuaW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgICB2YXIgZXJyb3JzID0gW107XG4gICAgICAgICAgXy5lYWNoKG1vZGVsc1RvSW5zdGFsbCwgZnVuY3Rpb24obSkge1xuICAgICAgICAgICAgbG9nKCdJbnN0YWxsaW5nIHJlbGF0aW9uc2hpcHMgZm9yIG1hcHBpbmcgd2l0aCBuYW1lIFwiJyArIG0ubmFtZSArICdcIicpO1xuICAgICAgICAgICAgdmFyIGVyciA9IG0uaW5zdGFsbFJlbGF0aW9uc2hpcHMoKTtcbiAgICAgICAgICAgIGlmIChlcnIpIGVycm9ycy5wdXNoKGVycik7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgaWYgKCFlcnJvcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICBfLmVhY2gobW9kZWxzVG9JbnN0YWxsLCBmdW5jdGlvbihtKSB7XG4gICAgICAgICAgICAgIGxvZygnSW5zdGFsbGluZyByZXZlcnNlIHJlbGF0aW9uc2hpcHMgZm9yIG1hcHBpbmcgd2l0aCBuYW1lIFwiJyArIG0ubmFtZSArICdcIicpO1xuICAgICAgICAgICAgICB2YXIgZXJyID0gbS5pbnN0YWxsUmV2ZXJzZVJlbGF0aW9uc2hpcHMoKTtcbiAgICAgICAgICAgICAgaWYgKGVycikgZXJyb3JzLnB1c2goZXJyKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaWYgKCFlcnJvcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgIHRoaXMuaW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgdGhpcy5fbWFrZUF2YWlsYWJsZU9uUm9vdCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBjYihlcnJvcnMubGVuZ3RoID8gZXJyb3IoJ0Vycm9ycyB3ZXJlIGVuY291bnRlcmVkIHdoaWxzdCBzZXR0aW5nIHVwIHRoZSBjb2xsZWN0aW9uJywge2Vycm9yczogZXJyb3JzfSkgOiBudWxsKTtcbiAgICAgICAgfSBlbHNlIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdDb2xsZWN0aW9uIFwiJyArIHRoaXMubmFtZSArICdcIiBoYXMgYWxyZWFkeSBiZWVuIGluc3RhbGxlZCcpO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIEdpdmVuIHRoZSBuYW1lIG9mIGEgbWFwcGluZyBhbmQgYW4gb3B0aW9ucyBvYmplY3QgZGVzY3JpYmluZyB0aGUgbWFwcGluZywgY3JlYXRpbmcgYSBNb2RlbFxuICAgICAqIG9iamVjdCwgaW5zdGFsbCBpdCBhbmQgcmV0dXJuIGl0LlxuICAgICAqIEBwYXJhbSAge1N0cmluZ30gbmFtZVxuICAgICAqIEBwYXJhbSAge09iamVjdH0gb3B0c1xuICAgICAqIEByZXR1cm4ge01vZGVsfVxuICAgICAqIEBjbGFzcyBDb2xsZWN0aW9uXG4gICAgICovXG4gICAgX21vZGVsOiBmdW5jdGlvbihuYW1lLCBvcHRzKSB7XG4gICAgICBpZiAobmFtZSkge1xuICAgICAgICB0aGlzLl9yYXdNb2RlbHNbbmFtZV0gPSBvcHRzO1xuICAgICAgICBvcHRzID0gZXh0ZW5kKHRydWUsIHt9LCBvcHRzKTtcbiAgICAgICAgb3B0cy5uYW1lID0gbmFtZTtcbiAgICAgICAgb3B0cy5jb2xsZWN0aW9uID0gdGhpcztcbiAgICAgICAgdmFyIG1vZGVsID0gbmV3IE1vZGVsKG9wdHMpO1xuICAgICAgICB0aGlzLl9tb2RlbHNbbmFtZV0gPSBtb2RlbDtcbiAgICAgICAgdGhpc1tuYW1lXSA9IG1vZGVsO1xuICAgICAgICByZXR1cm4gbW9kZWw7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIG5hbWUgc3BlY2lmaWVkIHdoZW4gY3JlYXRpbmcgbWFwcGluZycpO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZWdpc3RlcnMgYSBtb2RlbCB3aXRoIHRoaXMgY29sbGVjdGlvbi5cbiAgICAgKiBAcGFyYW0gb3BcbiAgICAgKi9cbiAgICBtb2RlbDogZnVuY3Rpb24ob3ApIHtcbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09IDEpIHtcbiAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KGFyZ3VtZW50c1swXSkpIHtcbiAgICAgICAgICAgIHJldHVybiBfLm1hcChhcmd1bWVudHNbMF0sIGZ1bmN0aW9uKG0pIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX21vZGVsKG0ubmFtZSwgbSk7XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIgbmFtZSwgb3B0cztcbiAgICAgICAgICAgIGlmICh1dGlsLmlzU3RyaW5nKGFyZ3VtZW50c1swXSkpIHtcbiAgICAgICAgICAgICAgbmFtZSA9IGFyZ3VtZW50c1swXTtcbiAgICAgICAgICAgICAgb3B0cyA9IHt9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIG9wdHMgPSBhcmd1bWVudHNbMF07XG4gICAgICAgICAgICAgIG5hbWUgPSBvcHRzLm5hbWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fbW9kZWwobmFtZSwgb3B0cyk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmICh0eXBlb2YgYXJndW1lbnRzWzBdID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fbW9kZWwoYXJndW1lbnRzWzBdLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gXy5tYXAoYXJndW1lbnRzLCBmdW5jdGlvbihtKSB7XG4gICAgICAgICAgICAgIHJldHVybiB0aGlzLl9tb2RlbChtLm5hbWUsIG0pO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLmluc3RhbGxlZCkge1xuXG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogRHVtcCB0aGlzIGNvbGxlY3Rpb24gYXMgSlNPTlxuICAgICAqIEBwYXJhbSAge0Jvb2xlYW59IGFzSnNvbiBXaGV0aGVyIG9yIG5vdCB0byBhcHBseSBKU09OLnN0cmluZ2lmeVxuICAgICAqIEByZXR1cm4ge1N0cmluZ3xPYmplY3R9XG4gICAgICogQGNsYXNzIENvbGxlY3Rpb25cbiAgICAgKi9cbiAgICBfZHVtcDogZnVuY3Rpb24oYXNKc29uKSB7XG4gICAgICB2YXIgb2JqID0ge307XG4gICAgICBvYmouaW5zdGFsbGVkID0gdGhpcy5pbnN0YWxsZWQ7XG4gICAgICBvYmouZG9jSWQgPSB0aGlzLl9kb2NJZDtcbiAgICAgIG9iai5uYW1lID0gdGhpcy5uYW1lO1xuICAgICAgcmV0dXJuIGFzSnNvbiA/IHV0aWwucHJldHR5UHJpbnQob2JqKSA6IG9iajtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgbnVtYmVyIG9mIG9iamVjdHMgaW4gdGhpcyBjb2xsZWN0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIGNiXG4gICAgICogQHJldHVybnMge1Byb21pc2V9XG4gICAgICovXG4gICAgY291bnQ6IGZ1bmN0aW9uKGNiKSB7XG4gICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgICB2YXIgdGFza3MgPSBfLm1hcCh0aGlzLl9tb2RlbHMsIGZ1bmN0aW9uKG0pIHtcbiAgICAgICAgICByZXR1cm4gXy5iaW5kKG0uY291bnQsIG0pO1xuICAgICAgICB9KTtcbiAgICAgICAgdXRpbC5hc3luYy5wYXJhbGxlbCh0YXNrcywgZnVuY3Rpb24oZXJyLCBucykge1xuICAgICAgICAgIHZhciBuO1xuICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICBuID0gXy5yZWR1Y2UobnMsIGZ1bmN0aW9uKG0sIHIpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIG0gKyByXG4gICAgICAgICAgICB9LCAwKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY2IoZXJyLCBuKTtcbiAgICAgICAgfSk7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH0sXG5cbiAgICBncmFwaDogZnVuY3Rpb24oZGF0YSwgb3B0cywgY2IpIHtcbiAgICAgIGlmICh0eXBlb2Ygb3B0cyA9PSAnZnVuY3Rpb24nKSBjYiA9IG9wdHM7XG4gICAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICAgIHZhciB0YXNrcyA9IFtdLCBlcnI7XG4gICAgICAgIGZvciAodmFyIG1vZGVsTmFtZSBpbiBkYXRhKSB7XG4gICAgICAgICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkobW9kZWxOYW1lKSkge1xuICAgICAgICAgICAgdmFyIG1vZGVsID0gdGhpcy5fbW9kZWxzW21vZGVsTmFtZV07XG4gICAgICAgICAgICBpZiAobW9kZWwpIHtcbiAgICAgICAgICAgICAgKGZ1bmN0aW9uKG1vZGVsLCBkYXRhKSB7XG4gICAgICAgICAgICAgICAgdGFza3MucHVzaChmdW5jdGlvbihkb25lKSB7XG4gICAgICAgICAgICAgICAgICBtb2RlbC5ncmFwaChkYXRhLCBmdW5jdGlvbihlcnIsIG1vZGVscykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICAgIHZhciByZXN1bHRzID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgcmVzdWx0c1ttb2RlbC5uYW1lXSA9IG1vZGVscztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBkb25lKGVyciwgcmVzdWx0cyk7XG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSkobW9kZWwsIGRhdGFbbW9kZWxOYW1lXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgZXJyID0gJ05vIHN1Y2ggbW9kZWwgXCInICsgbW9kZWxOYW1lICsgJ1wiJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFlcnIpIHV0aWwuYXN5bmMuc2VyaWVzKHRhc2tzLCBmdW5jdGlvbihlcnIsIHJlc3VsdHMpIHtcbiAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgcmVzdWx0cyA9IHJlc3VsdHMucmVkdWNlKGZ1bmN0aW9uKG1lbW8sIHJlcykge1xuICAgICAgICAgICAgICByZXR1cm4gXy5leHRlbmQobWVtbywgcmVzKTtcbiAgICAgICAgICAgIH0sIHt9KVxuICAgICAgICAgIH0gZWxzZSByZXN1bHRzID0gbnVsbDtcbiAgICAgICAgICBjYihlcnIsIHJlc3VsdHMpO1xuICAgICAgICB9KTtcbiAgICAgICAgZWxzZSBjYihlcnJvcihlcnIsIHtkYXRhOiBkYXRhLCBpbnZhbGlkTW9kZWxOYW1lOiBtb2RlbE5hbWV9KSk7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH0sXG5cbiAgICByZW1vdmVBbGw6IGZ1bmN0aW9uKGNiKSB7XG4gICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgICB1dGlsLlByb21pc2UuYWxsKFxuICAgICAgICAgIE9iamVjdC5rZXlzKHRoaXMuX21vZGVscykubWFwKGZ1bmN0aW9uKG1vZGVsTmFtZSkge1xuICAgICAgICAgICAgdmFyIG1vZGVsID0gdGhpcy5fbW9kZWxzW21vZGVsTmFtZV07XG4gICAgICAgICAgICByZXR1cm4gbW9kZWwucmVtb3ZlQWxsKCk7XG4gICAgICAgICAgfS5iaW5kKHRoaXMpKVxuICAgICAgICApLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBjYihudWxsKTtcbiAgICAgICAgICB9KVxuICAgICAgICAgIC5jYXRjaChjYilcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfVxuICB9KTtcblxuXG4gIG1vZHVsZS5leHBvcnRzID0gQ29sbGVjdGlvbjtcbn0pKCk7IiwiLyoqXG4gKiBAbW9kdWxlIGNvbGxlY3Rpb25cbiAqL1xuKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgXyA9IHJlcXVpcmUoJy4vdXRpbCcpLl87XG5cbiAgICBmdW5jdGlvbiBDb2xsZWN0aW9uUmVnaXN0cnkoKSB7XG4gICAgICAgIGlmICghdGhpcykgcmV0dXJuIG5ldyBDb2xsZWN0aW9uUmVnaXN0cnkoKTtcbiAgICAgICAgdGhpcy5jb2xsZWN0aW9uTmFtZXMgPSBbXTtcbiAgICB9XG5cbiAgICBfLmV4dGVuZChDb2xsZWN0aW9uUmVnaXN0cnkucHJvdG90eXBlLCB7XG4gICAgICAgIHJlZ2lzdGVyOiBmdW5jdGlvbiAoY29sbGVjdGlvbikge1xuICAgICAgICAgICAgdmFyIG5hbWUgPSBjb2xsZWN0aW9uLm5hbWU7XG4gICAgICAgICAgICB0aGlzW25hbWVdID0gY29sbGVjdGlvbjtcbiAgICAgICAgICAgIHRoaXMuY29sbGVjdGlvbk5hbWVzLnB1c2gobmFtZSk7XG4gICAgICAgIH0sXG4gICAgICAgIHJlc2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICBfLmVhY2godGhpcy5jb2xsZWN0aW9uTmFtZXMsIGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICAgICAgICAgICAgZGVsZXRlIHNlbGZbbmFtZV07XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHRoaXMuY29sbGVjdGlvbk5hbWVzID0gW107XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGV4cG9ydHMuQ29sbGVjdGlvblJlZ2lzdHJ5ID0gbmV3IENvbGxlY3Rpb25SZWdpc3RyeSgpO1xufSkoKTsiLCIvKipcbiAqIEBtb2R1bGUgZXJyb3JcbiAqL1xuKGZ1bmN0aW9uKCkge1xuXG4gIC8qKlxuICAgKiBVc2VycyBzaG91bGQgbmV2ZXIgc2VlIHRoZXNlIHRocm93bi4gQSBidWcgcmVwb3J0IHNob3VsZCBiZSBmaWxlZCBpZiBzbyBhcyBpdCBtZWFucyBzb21lIGFzc2VydGlvbiBoYXMgZmFpbGVkLlxuICAgKiBAcGFyYW0gbWVzc2FnZVxuICAgKiBAcGFyYW0gY29udGV4dFxuICAgKiBAcGFyYW0gc3NmXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKi9cbiAgZnVuY3Rpb24gSW50ZXJuYWxTaWVzdGFFcnJvcihtZXNzYWdlLCBjb250ZXh0LCBzc2YpIHtcbiAgICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xuICAgIHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG4gICAgLy8gY2FwdHVyZSBzdGFjayB0cmFjZVxuICAgIGlmIChzc2YgJiYgRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UpIHtcbiAgICAgIEVycm9yLmNhcHR1cmVTdGFja1RyYWNlKHRoaXMsIHNzZik7XG4gICAgfVxuICB9XG5cbiAgSW50ZXJuYWxTaWVzdGFFcnJvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEVycm9yLnByb3RvdHlwZSk7XG4gIEludGVybmFsU2llc3RhRXJyb3IucHJvdG90eXBlLm5hbWUgPSAnSW50ZXJuYWxTaWVzdGFFcnJvcic7XG4gIEludGVybmFsU2llc3RhRXJyb3IucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gSW50ZXJuYWxTaWVzdGFFcnJvcjtcblxuICBmdW5jdGlvbiBpc1NpZXN0YUVycm9yKGVycikge1xuICAgIGlmICh0eXBlb2YgZXJyID09ICdvYmplY3QnKSB7XG4gICAgICByZXR1cm4gJ2Vycm9yJyBpbiBlcnIgJiYgJ29rJyBpbiBlcnIgJiYgJ3JlYXNvbicgaW4gZXJyO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGVyck1lc3NhZ2UsIGV4dHJhKSB7XG4gICAgaWYgKGlzU2llc3RhRXJyb3IoZXJyTWVzc2FnZSkpIHtcbiAgICAgIHJldHVybiBlcnJNZXNzYWdlO1xuICAgIH1cbiAgICB2YXIgZXJyID0ge1xuICAgICAgcmVhc29uOiBlcnJNZXNzYWdlLFxuICAgICAgZXJyb3I6IHRydWUsXG4gICAgICBvazogZmFsc2VcbiAgICB9O1xuICAgIGZvciAodmFyIHByb3AgaW4gZXh0cmEgfHwge30pIHtcbiAgICAgIGlmIChleHRyYS5oYXNPd25Qcm9wZXJ0eShwcm9wKSkgZXJyW3Byb3BdID0gZXh0cmFbcHJvcF07XG4gICAgfVxuICAgIGVyci50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHRoaXMpO1xuICAgIH07XG4gICAgcmV0dXJuIGVycjtcbiAgfTtcblxuICBtb2R1bGUuZXhwb3J0cy5JbnRlcm5hbFNpZXN0YUVycm9yID0gSW50ZXJuYWxTaWVzdGFFcnJvcjtcblxufSkoKTsiLCIoZnVuY3Rpb24oKSB7XG4gIHZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXIsXG4gICAgQXJyYXlPYnNlcnZlciA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuQXJyYXlPYnNlcnZlcixcbiAgICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gICAgYXJnc2FycmF5ID0gcmVxdWlyZSgnYXJnc2FycmF5JyksXG4gICAgXyA9IHV0aWwuXyxcbiAgICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgICBDaGFpbiA9IHJlcXVpcmUoJy4vQ2hhaW4nKTtcblxuICB2YXIgZXZlbnRFbWl0dGVyID0gbmV3IEV2ZW50RW1pdHRlcigpO1xuICBldmVudEVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKDEwMCk7XG5cbiAgLyoqXG4gICAqIExpc3RlbiB0byBhIHBhcnRpY3VsYXIgZXZlbnQgZnJvbSB0aGUgU2llc3RhIGdsb2JhbCBFdmVudEVtaXR0ZXIuXG4gICAqIE1hbmFnZXMgaXRzIG93biBzZXQgb2YgbGlzdGVuZXJzLlxuICAgKiBAY29uc3RydWN0b3JcbiAgICovXG4gIGZ1bmN0aW9uIFByb3h5RXZlbnRFbWl0dGVyKGV2ZW50LCBjaGFpbk9wdHMpIHtcbiAgICBfLmV4dGVuZCh0aGlzLCB7XG4gICAgICBldmVudDogZXZlbnQsXG4gICAgICBsaXN0ZW5lcnM6IHt9XG4gICAgfSk7XG4gICAgdmFyIGRlZmF1bHRDaGFpbk9wdHMgPSB7fTtcblxuICAgIGRlZmF1bHRDaGFpbk9wdHMub24gPSB0aGlzLm9uLmJpbmQodGhpcyk7XG4gICAgZGVmYXVsdENoYWluT3B0cy5vbmNlID0gdGhpcy5vbmNlLmJpbmQodGhpcyk7XG5cbiAgICBDaGFpbi5jYWxsKHRoaXMsIF8uZXh0ZW5kKGRlZmF1bHRDaGFpbk9wdHMsIGNoYWluT3B0cyB8fCB7fSkpO1xuICB9XG5cbiAgUHJveHlFdmVudEVtaXR0ZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShDaGFpbi5wcm90b3R5cGUpO1xuXG4gIF8uZXh0ZW5kKFByb3h5RXZlbnRFbWl0dGVyLnByb3RvdHlwZSwge1xuICAgIG9uOiBmdW5jdGlvbih0eXBlLCBmbikge1xuICAgICAgaWYgKHR5cGVvZiB0eXBlID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgZm4gPSB0eXBlO1xuICAgICAgICB0eXBlID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBpZiAodHlwZS50cmltKCkgPT0gJyonKSB0eXBlID0gbnVsbDtcbiAgICAgICAgdmFyIF9mbiA9IGZuO1xuICAgICAgICBmbiA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICBlID0gZSB8fCB7fTtcbiAgICAgICAgICBpZiAodHlwZSkge1xuICAgICAgICAgICAgaWYgKGUudHlwZSA9PSB0eXBlKSB7XG4gICAgICAgICAgICAgIF9mbihlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBfZm4oZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB2YXIgbGlzdGVuZXJzID0gdGhpcy5saXN0ZW5lcnM7XG4gICAgICAgIGlmICh0eXBlKSB7XG4gICAgICAgICAgaWYgKCFsaXN0ZW5lcnNbdHlwZV0pIGxpc3RlbmVyc1t0eXBlXSA9IFtdO1xuICAgICAgICAgIGxpc3RlbmVyc1t0eXBlXS5wdXNoKGZuKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZXZlbnRFbWl0dGVyLm9uKHRoaXMuZXZlbnQsIGZuKTtcbiAgICAgIHJldHVybiB0aGlzLl9oYW5kbGVyTGluayh7XG4gICAgICAgIGZuOiBmbixcbiAgICAgICAgdHlwZTogdHlwZSxcbiAgICAgICAgZXh0ZW5kOiB0aGlzLnByb3h5Q2hhaW5PcHRzXG4gICAgICB9KTtcbiAgICB9LFxuICAgIG9uY2U6IGZ1bmN0aW9uKHR5cGUsIGZuKSB7XG4gICAgICB2YXIgZXZlbnQgPSB0aGlzLmV2ZW50O1xuICAgICAgaWYgKHR5cGVvZiB0eXBlID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgZm4gPSB0eXBlO1xuICAgICAgICB0eXBlID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBpZiAodHlwZS50cmltKCkgPT0gJyonKSB0eXBlID0gbnVsbDtcbiAgICAgICAgdmFyIF9mbiA9IGZuO1xuICAgICAgICBmbiA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICBlID0gZSB8fCB7fTtcbiAgICAgICAgICBpZiAodHlwZSkge1xuICAgICAgICAgICAgaWYgKGUudHlwZSA9PSB0eXBlKSB7XG4gICAgICAgICAgICAgIGV2ZW50RW1pdHRlci5yZW1vdmVMaXN0ZW5lcihldmVudCwgZm4pO1xuICAgICAgICAgICAgICBfZm4oZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgX2ZuKGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHR5cGUpIHJldHVybiBldmVudEVtaXR0ZXIub24oZXZlbnQsIGZuKTtcbiAgICAgIGVsc2UgcmV0dXJuIGV2ZW50RW1pdHRlci5vbmNlKGV2ZW50LCBmbik7XG4gICAgfSxcbiAgICBfcmVtb3ZlTGlzdGVuZXI6IGZ1bmN0aW9uKGZuLCB0eXBlKSB7XG4gICAgICBpZiAodHlwZSkge1xuICAgICAgICB2YXIgbGlzdGVuZXJzID0gdGhpcy5saXN0ZW5lcnNbdHlwZV0sXG4gICAgICAgICAgaWR4ID0gbGlzdGVuZXJzLmluZGV4T2YoZm4pO1xuICAgICAgICBsaXN0ZW5lcnMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gZXZlbnRFbWl0dGVyLnJlbW92ZUxpc3RlbmVyKHRoaXMuZXZlbnQsIGZuKTtcbiAgICB9LFxuICAgIGVtaXQ6IGZ1bmN0aW9uKHR5cGUsIHBheWxvYWQpIHtcbiAgICAgIGlmICh0eXBlb2YgdHlwZSA9PSAnb2JqZWN0Jykge1xuICAgICAgICBwYXlsb2FkID0gdHlwZTtcbiAgICAgICAgdHlwZSA9IG51bGw7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgcGF5bG9hZCA9IHBheWxvYWQgfHwge307XG4gICAgICAgIHBheWxvYWQudHlwZSA9IHR5cGU7XG4gICAgICB9XG4gICAgICBldmVudEVtaXR0ZXIuZW1pdC5jYWxsKGV2ZW50RW1pdHRlciwgdGhpcy5ldmVudCwgcGF5bG9hZCk7XG4gICAgfSxcbiAgICBfcmVtb3ZlQWxsTGlzdGVuZXJzOiBmdW5jdGlvbih0eXBlKSB7XG4gICAgICAodGhpcy5saXN0ZW5lcnNbdHlwZV0gfHwgW10pLmZvckVhY2goZnVuY3Rpb24oZm4pIHtcbiAgICAgICAgZXZlbnRFbWl0dGVyLnJlbW92ZUxpc3RlbmVyKHRoaXMuZXZlbnQsIGZuKTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICB0aGlzLmxpc3RlbmVyc1t0eXBlXSA9IFtdO1xuICAgIH0sXG4gICAgcmVtb3ZlQWxsTGlzdGVuZXJzOiBmdW5jdGlvbih0eXBlKSB7XG4gICAgICBpZiAodHlwZSkge1xuICAgICAgICB0aGlzLl9yZW1vdmVBbGxMaXN0ZW5lcnModHlwZSk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgZm9yICh0eXBlIGluIHRoaXMubGlzdGVuZXJzKSB7XG4gICAgICAgICAgaWYgKHRoaXMubGlzdGVuZXJzLmhhc093blByb3BlcnR5KHR5cGUpKSB7XG4gICAgICAgICAgICB0aGlzLl9yZW1vdmVBbGxMaXN0ZW5lcnModHlwZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICBfLmV4dGVuZChldmVudEVtaXR0ZXIsIHtcbiAgICBQcm94eUV2ZW50RW1pdHRlcjogUHJveHlFdmVudEVtaXR0ZXIsXG4gICAgd3JhcEFycmF5OiBmdW5jdGlvbihhcnJheSwgZmllbGQsIG1vZGVsSW5zdGFuY2UpIHtcbiAgICAgIGlmICghYXJyYXkub2JzZXJ2ZXIpIHtcbiAgICAgICAgYXJyYXkub2JzZXJ2ZXIgPSBuZXcgQXJyYXlPYnNlcnZlcihhcnJheSk7XG4gICAgICAgIGFycmF5Lm9ic2VydmVyLm9wZW4oZnVuY3Rpb24oc3BsaWNlcykge1xuICAgICAgICAgIHZhciBmaWVsZElzQXR0cmlidXRlID0gbW9kZWxJbnN0YW5jZS5fYXR0cmlidXRlTmFtZXMuaW5kZXhPZihmaWVsZCkgPiAtMTtcbiAgICAgICAgICBpZiAoZmllbGRJc0F0dHJpYnV0ZSkge1xuICAgICAgICAgICAgc3BsaWNlcy5mb3JFYWNoKGZ1bmN0aW9uKHNwbGljZSkge1xuICAgICAgICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBtb2RlbEluc3RhbmNlLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgICAgIG1vZGVsOiBtb2RlbEluc3RhbmNlLm1vZGVsLm5hbWUsXG4gICAgICAgICAgICAgICAgbG9jYWxJZDogbW9kZWxJbnN0YW5jZS5sb2NhbElkLFxuICAgICAgICAgICAgICAgIGluZGV4OiBzcGxpY2UuaW5kZXgsXG4gICAgICAgICAgICAgICAgcmVtb3ZlZDogc3BsaWNlLnJlbW92ZWQsXG4gICAgICAgICAgICAgICAgYWRkZWQ6IHNwbGljZS5hZGRlZENvdW50ID8gYXJyYXkuc2xpY2Uoc3BsaWNlLmluZGV4LCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCkgOiBbXSxcbiAgICAgICAgICAgICAgICB0eXBlOiBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgICAgICAgICAgICAgZmllbGQ6IGZpZWxkLFxuICAgICAgICAgICAgICAgIG9iajogbW9kZWxJbnN0YW5jZVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICB2YXIgb2xkRW1pdCA9IGV2ZW50RW1pdHRlci5lbWl0O1xuXG4gIC8vIEVuc3VyZSB0aGF0IGVycm9ycyBpbiBldmVudCBoYW5kbGVycyBkbyBub3Qgc3RhbGwgU2llc3RhLlxuICBldmVudEVtaXR0ZXIuZW1pdCA9IGZ1bmN0aW9uKGV2ZW50LCBwYXlsb2FkKSB7XG4gICAgdHJ5IHtcbiAgICAgIG9sZEVtaXQuY2FsbChldmVudEVtaXR0ZXIsIGV2ZW50LCBwYXlsb2FkKTtcbiAgICB9XG4gICAgY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgfVxuICB9O1xuXG4gIG1vZHVsZS5leHBvcnRzID0gZXZlbnRFbWl0dGVyO1xufSkoKTsiLCIoZnVuY3Rpb24oKSB7XG4gIHZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gICAgQ29sbGVjdGlvblJlZ2lzdHJ5ID0gcmVxdWlyZSgnLi9jb2xsZWN0aW9uUmVnaXN0cnknKS5Db2xsZWN0aW9uUmVnaXN0cnksXG4gICAgQ29sbGVjdGlvbiA9IHJlcXVpcmUoJy4vY29sbGVjdGlvbicpLFxuICAgIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpLFxuICAgIE1vZGVsID0gcmVxdWlyZSgnLi9tb2RlbCcpLFxuICAgIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLFxuICAgIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gICAgUmVsYXRpb25zaGlwVHlwZSA9IHJlcXVpcmUoJy4vUmVsYXRpb25zaGlwVHlwZScpLFxuICAgIFJlYWN0aXZlUXVlcnkgPSByZXF1aXJlKCcuL1JlYWN0aXZlUXVlcnknKSxcbiAgICBNYW55VG9NYW55UHJveHkgPSByZXF1aXJlKCcuL01hbnlUb01hbnlQcm94eScpLFxuICAgIE9uZVRvT25lUHJveHkgPSByZXF1aXJlKCcuL09uZVRvT25lUHJveHknKSxcbiAgICBPbmVUb01hbnlQcm94eSA9IHJlcXVpcmUoJy4vT25lVG9NYW55UHJveHknKSxcbiAgICBSZWxhdGlvbnNoaXBQcm94eSA9IHJlcXVpcmUoJy4vUmVsYXRpb25zaGlwUHJveHknKSxcbiAgICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgICBRdWVyeSA9IHJlcXVpcmUoJy4vUXVlcnknKSxcbiAgICBxdWVyeVNldCA9IHJlcXVpcmUoJy4vUXVlcnlTZXQnKSxcbiAgICBsb2cgPSByZXF1aXJlKCcuL2xvZycpLFxuICAgIF8gPSB1dGlsLl87XG4gIHV0aWwuX3BhdGNoQmluZCgpO1xuXG4gIC8vIEluaXRpYWxpc2Ugc2llc3RhIG9iamVjdC4gU3RyYW5nZSBmb3JtYXQgZmFjaWxpdGllcyB1c2luZyBzdWJtb2R1bGVzIHdpdGggcmVxdWlyZUpTIChldmVudHVhbGx5KVxuICB2YXIgc2llc3RhID0gZnVuY3Rpb24oZXh0KSB7XG4gICAgaWYgKCFzaWVzdGEuZXh0KSBzaWVzdGEuZXh0ID0ge307XG4gICAgXy5leHRlbmQoc2llc3RhLmV4dCwgZXh0IHx8IHt9KTtcbiAgICByZXR1cm4gc2llc3RhO1xuICB9O1xuXG4gIC8vIE5vdGlmaWNhdGlvbnNcbiAgXy5leHRlbmQoc2llc3RhLCB7XG4gICAgb246IGV2ZW50cy5vbi5iaW5kKGV2ZW50cyksXG4gICAgb2ZmOiBldmVudHMucmVtb3ZlTGlzdGVuZXIuYmluZChldmVudHMpLFxuICAgIG9uY2U6IGV2ZW50cy5vbmNlLmJpbmQoZXZlbnRzKSxcbiAgICByZW1vdmVBbGxMaXN0ZW5lcnM6IGV2ZW50cy5yZW1vdmVBbGxMaXN0ZW5lcnMuYmluZChldmVudHMpXG4gIH0pO1xuICBfLmV4dGVuZChzaWVzdGEsIHtcbiAgICByZW1vdmVMaXN0ZW5lcjogc2llc3RhLm9mZixcbiAgICBhZGRMaXN0ZW5lcjogc2llc3RhLm9uXG4gIH0pO1xuXG4gIC8vIEV4cG9zZSBzb21lIHN0dWZmIGZvciB1c2FnZSBieSBleHRlbnNpb25zIGFuZC9vciB1c2Vyc1xuICBfLmV4dGVuZChzaWVzdGEsIHtcbiAgICBSZWxhdGlvbnNoaXBUeXBlOiBSZWxhdGlvbnNoaXBUeXBlLFxuICAgIE1vZGVsRXZlbnRUeXBlOiBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZSxcbiAgICBsb2c6IGxvZy5MZXZlbCxcbiAgICBJbnNlcnRpb25Qb2xpY3k6IFJlYWN0aXZlUXVlcnkuSW5zZXJ0aW9uUG9saWN5LFxuICAgIF9pbnRlcm5hbDoge1xuICAgICAgbG9nOiBsb2csXG4gICAgICBNb2RlbDogTW9kZWwsXG4gICAgICBlcnJvcjogZXJyb3IsXG4gICAgICBNb2RlbEV2ZW50VHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUsXG4gICAgICBNb2RlbEluc3RhbmNlOiByZXF1aXJlKCcuL01vZGVsSW5zdGFuY2UnKSxcbiAgICAgIGV4dGVuZDogcmVxdWlyZSgnZXh0ZW5kJyksXG4gICAgICBNYXBwaW5nT3BlcmF0aW9uOiByZXF1aXJlKCcuL21hcHBpbmdPcGVyYXRpb24nKSxcbiAgICAgIGV2ZW50czogZXZlbnRzLFxuICAgICAgUHJveHlFdmVudEVtaXR0ZXI6IGV2ZW50cy5Qcm94eUV2ZW50RW1pdHRlcixcbiAgICAgIGNhY2hlOiByZXF1aXJlKCcuL2NhY2hlJyksXG4gICAgICBtb2RlbEV2ZW50czogbW9kZWxFdmVudHMsXG4gICAgICBDb2xsZWN0aW9uUmVnaXN0cnk6IHJlcXVpcmUoJy4vY29sbGVjdGlvblJlZ2lzdHJ5JykuQ29sbGVjdGlvblJlZ2lzdHJ5LFxuICAgICAgQ29sbGVjdGlvbjogQ29sbGVjdGlvbixcbiAgICAgIHV0aWxzOiB1dGlsLFxuICAgICAgdXRpbDogdXRpbCxcbiAgICAgIF86IHV0aWwuXyxcbiAgICAgIHF1ZXJ5U2V0OiBxdWVyeVNldCxcbiAgICAgIG9ic2VydmU6IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJyksXG4gICAgICBRdWVyeTogUXVlcnksXG4gICAgICBNYW55VG9NYW55UHJveHk6IE1hbnlUb01hbnlQcm94eSxcbiAgICAgIE9uZVRvTWFueVByb3h5OiBPbmVUb01hbnlQcm94eSxcbiAgICAgIE9uZVRvT25lUHJveHk6IE9uZVRvT25lUHJveHksXG4gICAgICBSZWxhdGlvbnNoaXBQcm94eTogUmVsYXRpb25zaGlwUHJveHlcbiAgICB9LFxuICAgIF86IHV0aWwuXyxcbiAgICBhc3luYzogdXRpbC5hc3luYyxcbiAgICBpc0FycmF5OiB1dGlsLmlzQXJyYXksXG4gICAgaXNTdHJpbmc6IHV0aWwuaXNTdHJpbmdcbiAgfSk7XG5cbiAgc2llc3RhLmV4dCA9IHt9O1xuXG4gIHZhciBpbnN0YWxsZWQgPSBmYWxzZSxcbiAgICBpbnN0YWxsaW5nID0gZmFsc2U7XG5cblxuICBfLmV4dGVuZChzaWVzdGEsIHtcbiAgICAvKipcbiAgICAgKiBXaXBlIGV2ZXJ5dGhpbmcuIFVzZWQgZHVyaW5nIHRlc3QgZ2VuZXJhbGx5LlxuICAgICAqL1xuICAgIHJlc2V0OiBmdW5jdGlvbihjYiwgcmVzZXRTdG9yYWdlKSB7XG4gICAgICBpbnN0YWxsZWQgPSBmYWxzZTtcbiAgICAgIGluc3RhbGxpbmcgPSBmYWxzZTtcbiAgICAgIGRlbGV0ZSB0aGlzLnF1ZXVlZFRhc2tzO1xuICAgICAgY2FjaGUucmVzZXQoKTtcbiAgICAgIENvbGxlY3Rpb25SZWdpc3RyeS5yZXNldCgpO1xuICAgICAgZXZlbnRzLnJlbW92ZUFsbExpc3RlbmVycygpO1xuICAgICAgaWYgKHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQpIHtcbiAgICAgICAgcmVzZXRTdG9yYWdlID0gcmVzZXRTdG9yYWdlID09PSB1bmRlZmluZWQgPyB0cnVlIDogcmVzZXRTdG9yYWdlO1xuICAgICAgICBpZiAocmVzZXRTdG9yYWdlKSBzaWVzdGEuZXh0LnN0b3JhZ2UuX3Jlc2V0KGNiKTtcbiAgICAgICAgZWxzZSBjYigpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNiKCk7XG4gICAgICB9XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGFuZCByZWdpc3RlcnMgYSBuZXcgQ29sbGVjdGlvbi5cbiAgICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWVcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IFtvcHRzXVxuICAgICAqIEByZXR1cm4ge0NvbGxlY3Rpb259XG4gICAgICovXG4gICAgY29sbGVjdGlvbjogZnVuY3Rpb24obmFtZSwgb3B0cykge1xuICAgICAgcmV0dXJuIG5ldyBDb2xsZWN0aW9uKG5hbWUsIG9wdHMpO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogSW5zdGFsbCBhbGwgY29sbGVjdGlvbnMuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NiXVxuICAgICAqIEByZXR1cm5zIHtxLlByb21pc2V9XG4gICAgICovXG4gICAgaW5zdGFsbDogZnVuY3Rpb24oY2IpIHtcbiAgICAgIGlmICghaW5zdGFsbGluZyAmJiAhaW5zdGFsbGVkKSB7XG4gICAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICAgICAgaW5zdGFsbGluZyA9IHRydWU7XG4gICAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lcyA9IENvbGxlY3Rpb25SZWdpc3RyeS5jb2xsZWN0aW9uTmFtZXMsXG4gICAgICAgICAgICB0YXNrcyA9IF8ubWFwKGNvbGxlY3Rpb25OYW1lcywgZnVuY3Rpb24obikge1xuICAgICAgICAgICAgICB2YXIgY29sbGVjdGlvbiA9IENvbGxlY3Rpb25SZWdpc3RyeVtuXTtcbiAgICAgICAgICAgICAgcmV0dXJuIGNvbGxlY3Rpb24uaW5zdGFsbC5iaW5kKGNvbGxlY3Rpb24pO1xuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBzdG9yYWdlRW5hYmxlZCA9IHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQ7XG4gICAgICAgICAgaWYgKHN0b3JhZ2VFbmFibGVkKSB0YXNrcyA9IHRhc2tzLmNvbmNhdChbc2llc3RhLmV4dC5zdG9yYWdlLmVuc3VyZUluZGV4ZXNGb3JBbGwsIHNpZXN0YS5leHQuc3RvcmFnZS5fbG9hZF0pO1xuICAgICAgICAgIHRhc2tzLnB1c2goZnVuY3Rpb24oZG9uZSkge1xuICAgICAgICAgICAgaW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0aGlzLnF1ZXVlZFRhc2tzKSB0aGlzLnF1ZXVlZFRhc2tzLmV4ZWN1dGUoKTtcbiAgICAgICAgICAgIGRvbmUoKTtcbiAgICAgICAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgICAgICAgc2llc3RhLmFzeW5jLnNlcmllcyh0YXNrcywgY2IpO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgfVxuICAgICAgZWxzZSBjYihlcnJvcignYWxyZWFkeSBpbnN0YWxsaW5nJykpO1xuICAgIH0sXG4gICAgX3B1c2hUYXNrOiBmdW5jdGlvbih0YXNrKSB7XG4gICAgICBpZiAoIXRoaXMucXVldWVkVGFza3MpIHtcbiAgICAgICAgdGhpcy5xdWV1ZWRUYXNrcyA9IG5ldyBmdW5jdGlvbiBRdWV1ZSgpIHtcbiAgICAgICAgICB0aGlzLnRhc2tzID0gW107XG4gICAgICAgICAgdGhpcy5leGVjdXRlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB0aGlzLnRhc2tzLmZvckVhY2goZnVuY3Rpb24oZikge1xuICAgICAgICAgICAgICBmKClcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdGhpcy50YXNrcyA9IFtdO1xuICAgICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIHRoaXMucXVldWVkVGFza3MudGFza3MucHVzaCh0YXNrKTtcbiAgICB9LFxuICAgIF9hZnRlckluc3RhbGw6IGZ1bmN0aW9uKHRhc2spIHtcbiAgICAgIGlmICghaW5zdGFsbGVkKSB7XG4gICAgICAgIGlmICghaW5zdGFsbGluZykge1xuICAgICAgICAgIHRoaXMuaW5zdGFsbChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3Igc2V0dGluZyB1cCBzaWVzdGEnLCBlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZGVsZXRlIHRoaXMucXVldWVkVGFza3M7XG4gICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBJbiBjYXNlIGluc3RhbGxlZCBzdHJhaWdodCBhd2F5IGUuZy4gaWYgc3RvcmFnZSBleHRlbnNpb24gbm90IGluc3RhbGxlZC5cbiAgICAgICAgaWYgKCFpbnN0YWxsZWQpIHRoaXMuX3B1c2hUYXNrKHRhc2spO1xuICAgICAgICBlbHNlIHRhc2soKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICB0YXNrKCk7XG4gICAgICB9XG4gICAgfSxcbiAgICBzZXRMb2dMZXZlbDogZnVuY3Rpb24obG9nZ2VyTmFtZSwgbGV2ZWwpIHtcbiAgICAgIHZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUobG9nZ2VyTmFtZSk7XG4gICAgICBMb2dnZXIuc2V0TGV2ZWwobGV2ZWwpO1xuICAgIH0sXG4gICAgZ3JhcGg6IGZ1bmN0aW9uKGRhdGEsIG9wdHMsIGNiKSB7XG4gICAgICBpZiAodHlwZW9mIG9wdHMgPT0gJ2Z1bmN0aW9uJykgY2IgPSBvcHRzO1xuICAgICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgICB2YXIgdGFza3MgPSBbXSwgZXJyO1xuICAgICAgICBmb3IgKHZhciBjb2xsZWN0aW9uTmFtZSBpbiBkYXRhKSB7XG4gICAgICAgICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoY29sbGVjdGlvbk5hbWUpKSB7XG4gICAgICAgICAgICB2YXIgY29sbGVjdGlvbiA9IENvbGxlY3Rpb25SZWdpc3RyeVtjb2xsZWN0aW9uTmFtZV07XG4gICAgICAgICAgICBpZiAoY29sbGVjdGlvbikge1xuICAgICAgICAgICAgICAoZnVuY3Rpb24oY29sbGVjdGlvbiwgZGF0YSkge1xuICAgICAgICAgICAgICAgIHRhc2tzLnB1c2goZnVuY3Rpb24oZG9uZSkge1xuICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbi5ncmFwaChkYXRhLCBmdW5jdGlvbihlcnIsIHJlcykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICAgIHZhciByZXN1bHRzID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgcmVzdWx0c1tjb2xsZWN0aW9uLm5hbWVdID0gcmVzO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGRvbmUoZXJyLCByZXN1bHRzKTtcbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9KShjb2xsZWN0aW9uLCBkYXRhW2NvbGxlY3Rpb25OYW1lXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgZXJyID0gJ05vIHN1Y2ggY29sbGVjdGlvbiBcIicgKyBjb2xsZWN0aW9uTmFtZSArICdcIic7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICghZXJyKSB1dGlsLmFzeW5jLnNlcmllcyh0YXNrcywgZnVuY3Rpb24oZXJyLCByZXN1bHRzKSB7XG4gICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgIHJlc3VsdHMgPSByZXN1bHRzLnJlZHVjZShmdW5jdGlvbihtZW1vLCByZXMpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIF8uZXh0ZW5kKG1lbW8sIHJlcyk7XG4gICAgICAgICAgICB9LCB7fSlcbiAgICAgICAgICB9IGVsc2UgcmVzdWx0cyA9IG51bGw7XG4gICAgICAgICAgY2IoZXJyLCByZXN1bHRzKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGVsc2UgY2IoZXJyb3IoZXJyLCB7ZGF0YTogZGF0YSwgaW52YWxpZENvbGxlY3Rpb25OYW1lOiBjb2xsZWN0aW9uTmFtZX0pKTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfSxcbiAgICBub3RpZnk6IHV0aWwubmV4dCxcbiAgICByZWdpc3RlckNvbXBhcmF0b3I6IFF1ZXJ5LnJlZ2lzdGVyQ29tcGFyYXRvci5iaW5kKFF1ZXJ5KSxcbiAgICBjb3VudDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gY2FjaGUuY291bnQoKTtcbiAgICB9LFxuICAgIGdldDogZnVuY3Rpb24oaWQsIGNiKSB7XG4gICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgICB0aGlzLl9hZnRlckluc3RhbGwoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgY2IobnVsbCwgY2FjaGUuX2xvY2FsQ2FjaGUoKVtpZF0pO1xuICAgICAgICB9KTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfSxcbiAgICByZW1vdmVBbGw6IGZ1bmN0aW9uKGNiKSB7XG4gICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgICB1dGlsLlByb21pc2UuYWxsKFxuICAgICAgICAgIENvbGxlY3Rpb25SZWdpc3RyeS5jb2xsZWN0aW9uTmFtZXMubWFwKGZ1bmN0aW9uKGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgICAgICAgICByZXR1cm4gQ29sbGVjdGlvblJlZ2lzdHJ5W2NvbGxlY3Rpb25OYW1lXS5yZW1vdmVBbGwoKTtcbiAgICAgICAgICB9LmJpbmQodGhpcykpXG4gICAgICAgICkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGNiKG51bGwpO1xuICAgICAgICAgIH0pLmNhdGNoKGNiKVxuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG4gIH0pO1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHNpZXN0YSwge1xuICAgIF9jYW5DaGFuZ2U6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAhKGluc3RhbGxpbmcgfHwgaW5zdGFsbGVkKTtcbiAgICAgIH1cbiAgICB9LFxuICAgIGluc3RhbGxlZDoge1xuICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBpbnN0YWxsZWQ7XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICBpZiAodHlwZW9mIHdpbmRvdyAhPSAndW5kZWZpbmVkJykge1xuICAgIHdpbmRvd1snc2llc3RhJ10gPSBzaWVzdGE7XG4gIH1cblxuICBzaWVzdGEubG9nID0gcmVxdWlyZSgnZGVidWcnKTtcblxuICBtb2R1bGUuZXhwb3J0cyA9IHNpZXN0YTtcblxuICAoZnVuY3Rpb24gbG9hZEV4dGVuc2lvbnMoKSB7XG4gICAgcmVxdWlyZSgnLi4vc3RvcmFnZScpO1xuICB9KSgpO1xuXG59KSgpOyIsIihmdW5jdGlvbigpIHtcbiAgdmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJykoJ21vZGVsJyksXG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgIFJlbGF0aW9uc2hpcFR5cGUgPSByZXF1aXJlKCcuL1JlbGF0aW9uc2hpcFR5cGUnKSxcbiAgICBRdWVyeSA9IHJlcXVpcmUoJy4vUXVlcnknKSxcbiAgICBNb2RlbEluc3RhbmNlID0gcmVxdWlyZSgnLi9Nb2RlbEluc3RhbmNlJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIF8gPSB1dGlsLl8sXG4gICAgZ3VpZCA9IHV0aWwuZ3VpZCxcbiAgICBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKSxcbiAgICBleHRlbmQgPSByZXF1aXJlKCdleHRlbmQnKSxcbiAgICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgICB3cmFwQXJyYXkgPSByZXF1aXJlKCcuL2V2ZW50cycpLndyYXBBcnJheSxcbiAgICBPbmVUb01hbnlQcm94eSA9IHJlcXVpcmUoJy4vT25lVG9NYW55UHJveHknKSxcbiAgICBPbmVUb09uZVByb3h5ID0gcmVxdWlyZSgnLi9PbmVUb09uZVByb3h5JyksXG4gICAgTWFueVRvTWFueVByb3h5ID0gcmVxdWlyZSgnLi9NYW55VG9NYW55UHJveHknKSxcbiAgICBSZWFjdGl2ZVF1ZXJ5ID0gcmVxdWlyZSgnLi9SZWFjdGl2ZVF1ZXJ5JyksXG4gICAgTW9kZWxFdmVudFR5cGUgPSBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZTtcblxuICBmdW5jdGlvbiBNb2RlbEluc3RhbmNlRmFjdG9yeShtb2RlbCkge1xuICAgIHRoaXMubW9kZWwgPSBtb2RlbDtcbiAgfVxuXG4gIE1vZGVsSW5zdGFuY2VGYWN0b3J5LnByb3RvdHlwZSA9IHtcbiAgICBfZ2V0TG9jYWxJZDogZnVuY3Rpb24oZGF0YSkge1xuICAgICAgdmFyIGxvY2FsSWQ7XG4gICAgICBpZiAoZGF0YSkge1xuICAgICAgICBsb2NhbElkID0gZGF0YS5sb2NhbElkID8gZGF0YS5sb2NhbElkIDogZ3VpZCgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbG9jYWxJZCA9IGd1aWQoKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBsb2NhbElkO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogQ29uZmlndXJlIGF0dHJpYnV0ZXNcbiAgICAgKiBAcGFyYW0gbW9kZWxJbnN0YW5jZVxuICAgICAqIEBwYXJhbSBkYXRhXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cblxuICAgIF9pbnN0YWxsQXR0cmlidXRlczogZnVuY3Rpb24obW9kZWxJbnN0YW5jZSwgZGF0YSkge1xuICAgICAgdmFyIE1vZGVsID0gdGhpcy5tb2RlbCxcbiAgICAgICAgYXR0cmlidXRlTmFtZXMgPSBNb2RlbC5fYXR0cmlidXRlTmFtZXMsXG4gICAgICAgIGlkeCA9IGF0dHJpYnV0ZU5hbWVzLmluZGV4T2YoTW9kZWwuaWQpO1xuICAgICAgXy5leHRlbmQobW9kZWxJbnN0YW5jZSwge1xuICAgICAgICBfX3ZhbHVlczogXy5leHRlbmQoXy5yZWR1Y2UoTW9kZWwuYXR0cmlidXRlcywgZnVuY3Rpb24obSwgYSkge1xuICAgICAgICAgIGlmIChhLmRlZmF1bHQgIT09IHVuZGVmaW5lZCkgbVthLm5hbWVdID0gYS5kZWZhdWx0O1xuICAgICAgICAgIHJldHVybiBtO1xuICAgICAgICB9LCB7fSksIGRhdGEgfHwge30pXG4gICAgICB9KTtcbiAgICAgIGlmIChpZHggPiAtMSkgYXR0cmlidXRlTmFtZXMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICBfLmVhY2goYXR0cmlidXRlTmFtZXMsIGZ1bmN0aW9uKGF0dHJpYnV0ZU5hbWUpIHtcbiAgICAgICAgdmFyIGF0dHJpYnV0ZURlZmluaXRpb24gPSBNb2RlbC5fYXR0cmlidXRlRGVmaW5pdGlvbldpdGhOYW1lKGF0dHJpYnV0ZU5hbWUpO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobW9kZWxJbnN0YW5jZSwgYXR0cmlidXRlTmFtZSwge1xuICAgICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB2YXIgdmFsdWUgPSBtb2RlbEluc3RhbmNlLl9fdmFsdWVzW2F0dHJpYnV0ZU5hbWVdO1xuICAgICAgICAgICAgcmV0dXJuIHZhbHVlID09PSB1bmRlZmluZWQgPyBudWxsIDogdmFsdWU7XG4gICAgICAgICAgfSxcbiAgICAgICAgICBzZXQ6IGZ1bmN0aW9uKHYpIHtcbiAgICAgICAgICAgIGlmIChhdHRyaWJ1dGVEZWZpbml0aW9uLnBhcnNlKSB7XG4gICAgICAgICAgICAgIHYgPSBhdHRyaWJ1dGVEZWZpbml0aW9uLnBhcnNlLmNhbGwobW9kZWxJbnN0YW5jZSwgdik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoTW9kZWwucGFyc2VBdHRyaWJ1dGUpIHtcbiAgICAgICAgICAgICAgdiA9IE1vZGVsLnBhcnNlQXR0cmlidXRlLmNhbGwobW9kZWxJbnN0YW5jZSwgYXR0cmlidXRlTmFtZSwgdik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgb2xkID0gbW9kZWxJbnN0YW5jZS5fX3ZhbHVlc1thdHRyaWJ1dGVOYW1lXTtcbiAgICAgICAgICAgIHZhciBwcm9wZXJ0eURlcGVuZGVuY2llcyA9IHRoaXMuX3Byb3BlcnR5RGVwZW5kZW5jaWVzW2F0dHJpYnV0ZU5hbWVdO1xuICAgICAgICAgICAgcHJvcGVydHlEZXBlbmRlbmNpZXMgPSBfLm1hcChwcm9wZXJ0eURlcGVuZGVuY2llcywgZnVuY3Rpb24oZGVwZW5kYW50KSB7XG4gICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgcHJvcDogZGVwZW5kYW50LFxuICAgICAgICAgICAgICAgIG9sZDogdGhpc1tkZXBlbmRhbnRdXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICAgICAgICAgIG1vZGVsSW5zdGFuY2UuX192YWx1ZXNbYXR0cmlidXRlTmFtZV0gPSB2O1xuICAgICAgICAgICAgcHJvcGVydHlEZXBlbmRlbmNpZXMuZm9yRWFjaChmdW5jdGlvbihkZXApIHtcbiAgICAgICAgICAgICAgdmFyIHByb3BlcnR5TmFtZSA9IGRlcC5wcm9wO1xuICAgICAgICAgICAgICB2YXIgbmV3XyA9IHRoaXNbcHJvcGVydHlOYW1lXTtcbiAgICAgICAgICAgICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgICAgICAgICAgICAgY29sbGVjdGlvbjogTW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgICAgbW9kZWw6IE1vZGVsLm5hbWUsXG4gICAgICAgICAgICAgICAgbG9jYWxJZDogbW9kZWxJbnN0YW5jZS5sb2NhbElkLFxuICAgICAgICAgICAgICAgIG5ldzogbmV3XyxcbiAgICAgICAgICAgICAgICBvbGQ6IGRlcC5vbGQsXG4gICAgICAgICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU2V0LFxuICAgICAgICAgICAgICAgIGZpZWxkOiBwcm9wZXJ0eU5hbWUsXG4gICAgICAgICAgICAgICAgb2JqOiBtb2RlbEluc3RhbmNlXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgIHZhciBlID0ge1xuICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBNb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgbW9kZWw6IE1vZGVsLm5hbWUsXG4gICAgICAgICAgICAgIGxvY2FsSWQ6IG1vZGVsSW5zdGFuY2UubG9jYWxJZCxcbiAgICAgICAgICAgICAgbmV3OiB2LFxuICAgICAgICAgICAgICBvbGQ6IG9sZCxcbiAgICAgICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU2V0LFxuICAgICAgICAgICAgICBmaWVsZDogYXR0cmlidXRlTmFtZSxcbiAgICAgICAgICAgICAgb2JqOiBtb2RlbEluc3RhbmNlXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgd2luZG93Lmxhc3RFbWlzc2lvbiA9IGU7XG4gICAgICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KGUpO1xuICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheSh2KSkge1xuICAgICAgICAgICAgICB3cmFwQXJyYXkodiwgYXR0cmlidXRlTmFtZSwgbW9kZWxJbnN0YW5jZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0sXG4gICAgX2luc3RhbGxNZXRob2RzOiBmdW5jdGlvbihtb2RlbEluc3RhbmNlKSB7XG4gICAgICB2YXIgTW9kZWwgPSB0aGlzLm1vZGVsO1xuICAgICAgXy5lYWNoKE9iamVjdC5rZXlzKE1vZGVsLm1ldGhvZHMpLCBmdW5jdGlvbihtZXRob2ROYW1lKSB7XG4gICAgICAgIGlmIChtb2RlbEluc3RhbmNlW21ldGhvZE5hbWVdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBtb2RlbEluc3RhbmNlW21ldGhvZE5hbWVdID0gTW9kZWwubWV0aG9kc1ttZXRob2ROYW1lXS5iaW5kKG1vZGVsSW5zdGFuY2UpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGxvZygnQSBtZXRob2Qgd2l0aCBuYW1lIFwiJyArIG1ldGhvZE5hbWUgKyAnXCIgYWxyZWFkeSBleGlzdHMuIElnbm9yaW5nIGl0LicpO1xuICAgICAgICB9XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH0sXG4gICAgX2luc3RhbGxQcm9wZXJ0aWVzOiBmdW5jdGlvbihtb2RlbEluc3RhbmNlKSB7XG4gICAgICB2YXIgX3Byb3BlcnR5TmFtZXMgPSBPYmplY3Qua2V5cyh0aGlzLm1vZGVsLnByb3BlcnRpZXMpLFxuICAgICAgICBfcHJvcGVydHlEZXBlbmRlbmNpZXMgPSB7fTtcbiAgICAgIF8uZWFjaChfcHJvcGVydHlOYW1lcywgZnVuY3Rpb24ocHJvcE5hbWUpIHtcbiAgICAgICAgdmFyIHByb3BEZWYgPSB0aGlzLm1vZGVsLnByb3BlcnRpZXNbcHJvcE5hbWVdO1xuICAgICAgICB2YXIgZGVwZW5kZW5jaWVzID0gcHJvcERlZi5kZXBlbmRlbmNpZXMgfHwgW107XG4gICAgICAgIGRlcGVuZGVuY2llcy5mb3JFYWNoKGZ1bmN0aW9uKGF0dHIpIHtcbiAgICAgICAgICBpZiAoIV9wcm9wZXJ0eURlcGVuZGVuY2llc1thdHRyXSkgX3Byb3BlcnR5RGVwZW5kZW5jaWVzW2F0dHJdID0gW107XG4gICAgICAgICAgX3Byb3BlcnR5RGVwZW5kZW5jaWVzW2F0dHJdLnB1c2gocHJvcE5hbWUpO1xuICAgICAgICB9KTtcbiAgICAgICAgZGVsZXRlIHByb3BEZWYuZGVwZW5kZW5jaWVzO1xuICAgICAgICBpZiAobW9kZWxJbnN0YW5jZVtwcm9wTmFtZV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShtb2RlbEluc3RhbmNlLCBwcm9wTmFtZSwgcHJvcERlZik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgbG9nKCdBIHByb3BlcnR5L21ldGhvZCB3aXRoIG5hbWUgXCInICsgcHJvcE5hbWUgKyAnXCIgYWxyZWFkeSBleGlzdHMuIElnbm9yaW5nIGl0LicpO1xuICAgICAgICB9XG4gICAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgICBtb2RlbEluc3RhbmNlLl9wcm9wZXJ0eURlcGVuZGVuY2llcyA9IF9wcm9wZXJ0eURlcGVuZGVuY2llcztcbiAgICB9LFxuICAgIF9pbnN0YWxsUmVtb3RlSWQ6IGZ1bmN0aW9uKG1vZGVsSW5zdGFuY2UpIHtcbiAgICAgIHZhciBNb2RlbCA9IHRoaXMubW9kZWw7XG4gICAgICB2YXIgaWRGaWVsZCA9IE1vZGVsLmlkO1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG1vZGVsSW5zdGFuY2UsIGlkRmllbGQsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gbW9kZWxJbnN0YW5jZS5fX3ZhbHVlc1tNb2RlbC5pZF0gfHwgbnVsbDtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbih2KSB7XG4gICAgICAgICAgdmFyIG9sZCA9IG1vZGVsSW5zdGFuY2VbTW9kZWwuaWRdO1xuICAgICAgICAgIG1vZGVsSW5zdGFuY2UuX192YWx1ZXNbTW9kZWwuaWRdID0gdjtcbiAgICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgICAgIGNvbGxlY3Rpb246IE1vZGVsLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgbW9kZWw6IE1vZGVsLm5hbWUsXG4gICAgICAgICAgICBsb2NhbElkOiBtb2RlbEluc3RhbmNlLmxvY2FsSWQsXG4gICAgICAgICAgICBuZXc6IHYsXG4gICAgICAgICAgICBvbGQ6IG9sZCxcbiAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNldCxcbiAgICAgICAgICAgIGZpZWxkOiBNb2RlbC5pZCxcbiAgICAgICAgICAgIG9iajogbW9kZWxJbnN0YW5jZVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGNhY2hlLnJlbW90ZUluc2VydChtb2RlbEluc3RhbmNlLCB2LCBvbGQpO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgIH0pO1xuICAgIH0sXG4gICAgX2luc3RhbGxSZWxhdGlvbnNoaXBzOiBmdW5jdGlvbihtb2RlbEluc3RhbmNlKSB7XG4gICAgICB2YXIgbW9kZWwgPSB0aGlzLm1vZGVsO1xuICAgICAgZm9yICh2YXIgbmFtZSBpbiBtb2RlbC5yZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgIHZhciBwcm94eTtcbiAgICAgICAgaWYgKG1vZGVsLnJlbGF0aW9uc2hpcHMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgICB2YXIgcmVsYXRpb25zaGlwT3B0cyA9IF8uZXh0ZW5kKHt9LCBtb2RlbC5yZWxhdGlvbnNoaXBzW25hbWVdKSxcbiAgICAgICAgICAgIHR5cGUgPSByZWxhdGlvbnNoaXBPcHRzLnR5cGU7XG4gICAgICAgICAgZGVsZXRlIHJlbGF0aW9uc2hpcE9wdHMudHlwZTtcbiAgICAgICAgICBpZiAodHlwZSA9PSBSZWxhdGlvbnNoaXBUeXBlLk9uZVRvTWFueSkge1xuICAgICAgICAgICAgcHJveHkgPSBuZXcgT25lVG9NYW55UHJveHkocmVsYXRpb25zaGlwT3B0cyk7XG4gICAgICAgICAgfSBlbHNlIGlmICh0eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuT25lVG9PbmUpIHtcbiAgICAgICAgICAgIHByb3h5ID0gbmV3IE9uZVRvT25lUHJveHkocmVsYXRpb25zaGlwT3B0cyk7XG4gICAgICAgICAgfSBlbHNlIGlmICh0eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuTWFueVRvTWFueSkge1xuICAgICAgICAgICAgcHJveHkgPSBuZXcgTWFueVRvTWFueVByb3h5KHJlbGF0aW9uc2hpcE9wdHMpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gc3VjaCByZWxhdGlvbnNoaXAgdHlwZTogJyArIHR5cGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBwcm94eS5pbnN0YWxsKG1vZGVsSW5zdGFuY2UpO1xuICAgICAgfVxuICAgIH0sXG4gICAgX3JlZ2lzdGVySW5zdGFuY2U6IGZ1bmN0aW9uKG1vZGVsSW5zdGFuY2UsIHNob3VsZFJlZ2lzdGVyQ2hhbmdlKSB7XG4gICAgICBjYWNoZS5pbnNlcnQobW9kZWxJbnN0YW5jZSk7XG4gICAgICBzaG91bGRSZWdpc3RlckNoYW5nZSA9IHNob3VsZFJlZ2lzdGVyQ2hhbmdlID09PSB1bmRlZmluZWQgPyB0cnVlIDogc2hvdWxkUmVnaXN0ZXJDaGFuZ2U7XG4gICAgICBpZiAoc2hvdWxkUmVnaXN0ZXJDaGFuZ2UpIG1vZGVsSW5zdGFuY2UuX2VtaXROZXcoKTtcbiAgICB9LFxuICAgIF9pbnN0YWxsTG9jYWxJZDogZnVuY3Rpb24obW9kZWxJbnN0YW5jZSwgZGF0YSkge1xuICAgICAgbW9kZWxJbnN0YW5jZS5sb2NhbElkID0gdGhpcy5fZ2V0TG9jYWxJZChkYXRhKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIENvbnZlcnQgcmF3IGRhdGEgaW50byBhIE1vZGVsSW5zdGFuY2VcbiAgICAgKiBAcmV0dXJucyB7TW9kZWxJbnN0YW5jZX1cbiAgICAgKi9cbiAgICBfaW5zdGFuY2U6IGZ1bmN0aW9uKGRhdGEsIHNob3VsZFJlZ2lzdGVyQ2hhbmdlKSB7XG4gICAgICBpZiAoIXRoaXMubW9kZWwuX3JlbGF0aW9uc2hpcHNJbnN0YWxsZWQgfHwgIXRoaXMubW9kZWwuX3JldmVyc2VSZWxhdGlvbnNoaXBzSW5zdGFsbGVkKSB7XG4gICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNb2RlbCBtdXN0IGJlIGZ1bGx5IGluc3RhbGxlZCBiZWZvcmUgY3JlYXRpbmcgYW55IG1vZGVscycpO1xuICAgICAgfVxuICAgICAgdmFyIG1vZGVsSW5zdGFuY2UgPSBuZXcgTW9kZWxJbnN0YW5jZSh0aGlzLm1vZGVsKTtcbiAgICAgIHRoaXMuX2luc3RhbGxMb2NhbElkKG1vZGVsSW5zdGFuY2UsIGRhdGEpO1xuICAgICAgdGhpcy5faW5zdGFsbEF0dHJpYnV0ZXMobW9kZWxJbnN0YW5jZSwgZGF0YSk7XG4gICAgICB0aGlzLl9pbnN0YWxsTWV0aG9kcyhtb2RlbEluc3RhbmNlKTtcbiAgICAgIHRoaXMuX2luc3RhbGxQcm9wZXJ0aWVzKG1vZGVsSW5zdGFuY2UpO1xuICAgICAgdGhpcy5faW5zdGFsbFJlbW90ZUlkKG1vZGVsSW5zdGFuY2UpO1xuICAgICAgdGhpcy5faW5zdGFsbFJlbGF0aW9uc2hpcHMobW9kZWxJbnN0YW5jZSk7XG4gICAgICB0aGlzLl9yZWdpc3Rlckluc3RhbmNlKG1vZGVsSW5zdGFuY2UsIHNob3VsZFJlZ2lzdGVyQ2hhbmdlKTtcbiAgICAgIHJldHVybiBtb2RlbEluc3RhbmNlO1xuICAgIH1cbiAgfTtcblxuICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG1vZGVsKSB7XG4gICAgdmFyIGZhY3RvcnkgPSBuZXcgTW9kZWxJbnN0YW5jZUZhY3RvcnkobW9kZWwpO1xuICAgIHJldHVybiBmYWN0b3J5Ll9pbnN0YW5jZS5iaW5kKGZhY3RvcnkpO1xuICB9XG59KSgpOyIsIihmdW5jdGlvbiAoKSB7XG4gICAgLyoqXG4gICAgICogRGVhZCBzaW1wbGUgbG9nZ2luZyBzZXJ2aWNlIGJhc2VkIG9uIHZpc2lvbm1lZGlhL2RlYnVnXG4gICAgICogQG1vZHVsZSBsb2dcbiAgICAgKi9cblxuICAgIHZhciBkZWJ1ZyA9IHJlcXVpcmUoJ2RlYnVnJyksXG4gICAgICAgIGFyZ3NhcnJheSA9IHJlcXVpcmUoJ2FyZ3NhcnJheScpO1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgICB2YXIgbG9nID0gZGVidWcoJ3NpZXN0YTonICsgbmFtZSk7XG4gICAgICAgIHZhciBmbiA9IGFyZ3NhcnJheShmdW5jdGlvbiAoYXJncykge1xuICAgICAgICAgICAgbG9nLmNhbGwobG9nLCBhcmdzKTtcbiAgICAgICAgfSk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShmbiwgJ2VuYWJsZWQnLCB7XG4gICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZGVidWcuZW5hYmxlZChuYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBmbjtcbiAgICB9O1xufSkoKTsiLCIoZnVuY3Rpb24oKSB7XG4gIHZhciBNb2RlbEluc3RhbmNlID0gcmVxdWlyZSgnLi9Nb2RlbEluc3RhbmNlJyksXG4gICAgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSgnZ3JhcGgnKSxcbiAgICBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKSxcbiAgICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gICAgXyA9IHV0aWwuXyxcbiAgICBhc3luYyA9IHV0aWwuYXN5bmM7XG5cbiAgZnVuY3Rpb24gU2llc3RhRXJyb3Iob3B0cykge1xuICAgIHRoaXMub3B0cyA9IG9wdHM7XG4gIH1cblxuICBTaWVzdGFFcnJvci5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodGhpcy5vcHRzLCBudWxsLCA0KTtcbiAgfTtcblxuXG4gIC8qKlxuICAgKiBFbmNhcHN1bGF0ZXMgdGhlIGlkZWEgb2YgbWFwcGluZyBhcnJheXMgb2YgZGF0YSBvbnRvIHRoZSBvYmplY3QgZ3JhcGggb3IgYXJyYXlzIG9mIG9iamVjdHMuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gICAqIEBwYXJhbSBvcHRzLm1vZGVsXG4gICAqIEBwYXJhbSBvcHRzLmRhdGEjXG4gICAqIEBwYXJhbSBvcHRzLm9iamVjdHNcbiAgICogQHBhcmFtIG9wdHMuZGlzYWJsZU5vdGlmaWNhdGlvbnNcbiAgICovXG4gIGZ1bmN0aW9uIE1hcHBpbmdPcGVyYXRpb24ob3B0cykge1xuICAgIHRoaXMuX29wdHMgPSBvcHRzO1xuXG4gICAgdXRpbC5leHRlbmRGcm9tT3B0cyh0aGlzLCBvcHRzLCB7XG4gICAgICBtb2RlbDogbnVsbCxcbiAgICAgIGRhdGE6IG51bGwsXG4gICAgICBvYmplY3RzOiBbXSxcbiAgICAgIGRpc2FibGVldmVudHM6IGZhbHNlLFxuICAgICAgX2lnbm9yZUluc3RhbGxlZDogZmFsc2UsXG4gICAgICBmcm9tU3RvcmFnZTogZmFsc2VcbiAgICB9KTtcblxuICAgIF8uZXh0ZW5kKHRoaXMsIHtcbiAgICAgIGVycm9yczogW10sXG4gICAgICBzdWJUYXNrUmVzdWx0czoge30sXG4gICAgICBfbmV3T2JqZWN0czogW11cbiAgICB9KTtcblxuICAgIHRoaXMuZGF0YSA9IHRoaXMucHJlcHJvY2Vzc0RhdGEoKTtcbiAgfVxuXG5cbiAgXy5leHRlbmQoTWFwcGluZ09wZXJhdGlvbi5wcm90b3R5cGUsIHtcbiAgICBtYXBBdHRyaWJ1dGVzOiBmdW5jdGlvbigpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5kYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBkYXR1bSA9IHRoaXMuZGF0YVtpXTtcbiAgICAgICAgdmFyIG9iamVjdCA9IHRoaXMub2JqZWN0c1tpXTtcbiAgICAgICAgLy8gTm8gcG9pbnQgbWFwcGluZyBvYmplY3Qgb250byBpdHNlbGYuIFRoaXMgaGFwcGVucyBpZiBhIE1vZGVsSW5zdGFuY2UgaXMgcGFzc2VkIGFzIGEgcmVsYXRpb25zaGlwLlxuICAgICAgICBpZiAoZGF0dW0gIT0gb2JqZWN0KSB7XG4gICAgICAgICAgaWYgKG9iamVjdCkgeyAvLyBJZiBvYmplY3QgaXMgZmFsc3ksIHRoZW4gdGhlcmUgd2FzIGFuIGVycm9yIGxvb2tpbmcgdXAgdGhhdCBvYmplY3QvY3JlYXRpbmcgaXQuXG4gICAgICAgICAgICB2YXIgZmllbGRzID0gdGhpcy5tb2RlbC5fYXR0cmlidXRlTmFtZXM7XG4gICAgICAgICAgICBfLmVhY2goZmllbGRzLCBmdW5jdGlvbihmKSB7XG4gICAgICAgICAgICAgIGlmIChkYXR1bVtmXSAhPT0gdW5kZWZpbmVkKSB7IC8vIG51bGwgaXMgZmluZVxuICAgICAgICAgICAgICAgIC8vIElmIGV2ZW50cyBhcmUgZGlzYWJsZWQgd2UgdXBkYXRlIF9fdmFsdWVzIG9iamVjdCBkaXJlY3RseS4gVGhpcyBhdm9pZHMgdHJpZ2dlcmluZ1xuICAgICAgICAgICAgICAgIC8vIGV2ZW50cyB3aGljaCBhcmUgYnVpbHQgaW50byB0aGUgc2V0IGZ1bmN0aW9uIG9mIHRoZSBwcm9wZXJ0eS5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5kaXNhYmxlZXZlbnRzKSB7XG4gICAgICAgICAgICAgICAgICBvYmplY3QuX192YWx1ZXNbZl0gPSBkYXR1bVtmXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICBvYmplY3RbZl0gPSBkYXR1bVtmXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgICAgICAvLyBQb3VjaERCIHJldmlzaW9uIChpZiB1c2luZyBzdG9yYWdlIG1vZHVsZSkuXG4gICAgICAgICAgICAvLyBUT0RPOiBDYW4gdGhpcyBiZSBwdWxsZWQgb3V0IG9mIGNvcmU/XG4gICAgICAgICAgICBpZiAoZGF0dW0uX3Jldikgb2JqZWN0Ll9yZXYgPSBkYXR1bS5fcmV2O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG4gICAgX21hcDogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICB2YXIgZXJyO1xuICAgICAgdGhpcy5tYXBBdHRyaWJ1dGVzKCk7XG4gICAgICB2YXIgcmVsYXRpb25zaGlwRmllbGRzID0gXy5rZXlzKHNlbGYuc3ViVGFza1Jlc3VsdHMpO1xuICAgICAgXy5lYWNoKHJlbGF0aW9uc2hpcEZpZWxkcywgZnVuY3Rpb24oZikge1xuICAgICAgICB2YXIgcmVzID0gc2VsZi5zdWJUYXNrUmVzdWx0c1tmXTtcbiAgICAgICAgdmFyIGluZGV4ZXMgPSByZXMuaW5kZXhlcyxcbiAgICAgICAgICBvYmplY3RzID0gcmVzLm9iamVjdHM7XG4gICAgICAgIHZhciByZWxhdGVkRGF0YSA9IHNlbGYuZ2V0UmVsYXRlZERhdGEoZikucmVsYXRlZERhdGE7XG4gICAgICAgIHZhciB1bmZsYXR0ZW5lZE9iamVjdHMgPSB1dGlsLnVuZmxhdHRlbkFycmF5KG9iamVjdHMsIHJlbGF0ZWREYXRhKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB1bmZsYXR0ZW5lZE9iamVjdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICB2YXIgaWR4ID0gaW5kZXhlc1tpXTtcbiAgICAgICAgICAvLyBFcnJvcnMgYXJlIHBsdWNrZWQgZnJvbSB0aGUgc3Vib3BlcmF0aW9ucy5cbiAgICAgICAgICB2YXIgZXJyb3IgPSBzZWxmLmVycm9yc1tpZHhdO1xuICAgICAgICAgIGVyciA9IGVycm9yID8gZXJyb3JbZl0gOiBudWxsO1xuICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICB2YXIgcmVsYXRlZCA9IHVuZmxhdHRlbmVkT2JqZWN0c1tpXTsgLy8gQ2FuIGJlIGFycmF5IG9yIHNjYWxhci5cbiAgICAgICAgICAgIHZhciBvYmplY3QgPSBzZWxmLm9iamVjdHNbaWR4XTtcbiAgICAgICAgICAgIGlmIChvYmplY3QpIHtcbiAgICAgICAgICAgICAgZXJyID0gb2JqZWN0Ll9fcHJveGllc1tmXS5zZXQocmVsYXRlZCwge2Rpc2FibGVldmVudHM6IHNlbGYuZGlzYWJsZWV2ZW50c30pO1xuICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFzZWxmLmVycm9yc1tpZHhdKSBzZWxmLmVycm9yc1tpZHhdID0ge307XG4gICAgICAgICAgICAgICAgc2VsZi5lcnJvcnNbaWR4XVtmXSA9IGVycjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBGb3IgaW5kaWNlcyB3aGVyZSBubyBvYmplY3QgaXMgcHJlc2VudCwgcGVyZm9ybSBsb29rdXBzLCBjcmVhdGluZyBhIG5ldyBvYmplY3QgaWYgbmVjZXNzYXJ5LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2xvb2t1cDogZnVuY3Rpb24oY2IpIHtcbiAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgdmFyIHJlbW90ZUxvb2t1cHMgPSBbXTtcbiAgICAgICAgdmFyIGxvY2FsTG9va3VwcyA9IFtdO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGlmICghdGhpcy5vYmplY3RzW2ldKSB7XG4gICAgICAgICAgICB2YXIgbG9va3VwO1xuICAgICAgICAgICAgdmFyIGRhdHVtID0gdGhpcy5kYXRhW2ldO1xuICAgICAgICAgICAgdmFyIGlzU2NhbGFyID0gdHlwZW9mIGRhdHVtID09ICdzdHJpbmcnIHx8IHR5cGVvZiBkYXR1bSA9PSAnbnVtYmVyJyB8fCBkYXR1bSBpbnN0YW5jZW9mIFN0cmluZztcbiAgICAgICAgICAgIGlmIChkYXR1bSkge1xuICAgICAgICAgICAgICBpZiAoaXNTY2FsYXIpIHtcbiAgICAgICAgICAgICAgICBsb29rdXAgPSB7XG4gICAgICAgICAgICAgICAgICBpbmRleDogaSxcbiAgICAgICAgICAgICAgICAgIGRhdHVtOiB7fVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgbG9va3VwLmRhdHVtW3NlbGYubW9kZWwuaWRdID0gZGF0dW07XG4gICAgICAgICAgICAgICAgcmVtb3RlTG9va3Vwcy5wdXNoKGxvb2t1cCk7XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAoZGF0dW0gaW5zdGFuY2VvZiBNb2RlbEluc3RhbmNlKSB7IC8vIFdlIHdvbid0IG5lZWQgdG8gcGVyZm9ybSBhbnkgbWFwcGluZy5cbiAgICAgICAgICAgICAgICB0aGlzLm9iamVjdHNbaV0gPSBkYXR1bTtcbiAgICAgICAgICAgICAgfSBlbHNlIGlmIChkYXR1bS5sb2NhbElkKSB7XG4gICAgICAgICAgICAgICAgbG9jYWxMb29rdXBzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgaW5kZXg6IGksXG4gICAgICAgICAgICAgICAgICBkYXR1bTogZGF0dW1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSBlbHNlIGlmIChkYXR1bVtzZWxmLm1vZGVsLmlkXSkge1xuICAgICAgICAgICAgICAgIHJlbW90ZUxvb2t1cHMucHVzaCh7XG4gICAgICAgICAgICAgICAgICBpbmRleDogaSxcbiAgICAgICAgICAgICAgICAgIGRhdHVtOiBkYXR1bVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMub2JqZWN0c1tpXSA9IHNlbGYuX2luc3RhbmNlKCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHRoaXMub2JqZWN0c1tpXSA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHV0aWwuYXN5bmMucGFyYWxsZWwoW1xuICAgICAgICAgIGZ1bmN0aW9uKGRvbmUpIHtcbiAgICAgICAgICAgIHZhciBsb2NhbElkZW50aWZpZXJzID0gXy5wbHVjayhfLnBsdWNrKGxvY2FsTG9va3VwcywgJ2RhdHVtJyksICdsb2NhbElkJyk7XG4gICAgICAgICAgICB2YXIgb2JqZWN0cyA9IGNhY2hlLmdldFZpYUxvY2FsSWQobG9jYWxJZGVudGlmaWVycyk7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxvY2FsSWRlbnRpZmllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgdmFyIG9iaiA9IG9iamVjdHNbaV07XG4gICAgICAgICAgICAgIHZhciBsb2NhbElkID0gbG9jYWxJZGVudGlmaWVyc1tpXTtcbiAgICAgICAgICAgICAgdmFyIGxvb2t1cCA9IGxvY2FsTG9va3Vwc1tpXTtcbiAgICAgICAgICAgICAgaWYgKCFvYmopIHtcbiAgICAgICAgICAgICAgICAvLyBJZiB0aGVyZSBhcmUgbXVsdGlwbGUgbWFwcGluZyBvcGVyYXRpb25zIGdvaW5nIG9uLCB0aGVyZSBtYXkgYmVcbiAgICAgICAgICAgICAgICBvYmogPSBjYWNoZS5nZXQoe2xvY2FsSWQ6IGxvY2FsSWR9KTtcbiAgICAgICAgICAgICAgICBpZiAoIW9iaikgb2JqID0gc2VsZi5faW5zdGFuY2Uoe2xvY2FsSWQ6IGxvY2FsSWR9LCAhc2VsZi5kaXNhYmxlZXZlbnRzKTtcbiAgICAgICAgICAgICAgICBzZWxmLm9iamVjdHNbbG9va3VwLmluZGV4XSA9IG9iajtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzZWxmLm9iamVjdHNbbG9va3VwLmluZGV4XSA9IG9iajtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZG9uZSgpO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgZnVuY3Rpb24oZG9uZSkge1xuICAgICAgICAgICAgdmFyIHJlbW90ZUlkZW50aWZpZXJzID0gXy5wbHVjayhfLnBsdWNrKHJlbW90ZUxvb2t1cHMsICdkYXR1bScpLCBzZWxmLm1vZGVsLmlkKTtcbiAgICAgICAgICAgIHZhciBvYmplY3RzID0gY2FjaGUuZ2V0VmlhUmVtb3RlSWQocmVtb3RlSWRlbnRpZmllcnMsIHttb2RlbDogc2VsZi5tb2RlbH0pO1xuICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IG9iamVjdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgdmFyIG9iaiA9IG9iamVjdHNbaV07XG4gICAgICAgICAgICAgIHZhciBsb29rdXAgPSByZW1vdGVMb29rdXBzW2ldO1xuICAgICAgICAgICAgICBpZiAob2JqKSB7XG4gICAgICAgICAgICAgICAgc2VsZi5vYmplY3RzW2xvb2t1cC5pbmRleF0gPSBvYmo7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIGRhdGEgPSB7fTtcbiAgICAgICAgICAgICAgICB2YXIgcmVtb3RlSWQgPSByZW1vdGVJZGVudGlmaWVyc1tpXTtcbiAgICAgICAgICAgICAgICBkYXRhW3NlbGYubW9kZWwuaWRdID0gcmVtb3RlSWQ7XG4gICAgICAgICAgICAgICAgdmFyIGNhY2hlUXVlcnkgPSB7XG4gICAgICAgICAgICAgICAgICBtb2RlbDogc2VsZi5tb2RlbFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgY2FjaGVRdWVyeVtzZWxmLm1vZGVsLmlkXSA9IHJlbW90ZUlkO1xuICAgICAgICAgICAgICAgIHZhciBjYWNoZWQgPSBjYWNoZS5nZXQoY2FjaGVRdWVyeSk7XG4gICAgICAgICAgICAgICAgaWYgKGNhY2hlZCkge1xuICAgICAgICAgICAgICAgICAgc2VsZi5vYmplY3RzW2xvb2t1cC5pbmRleF0gPSBjYWNoZWQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHNlbGYub2JqZWN0c1tsb29rdXAuaW5kZXhdID0gc2VsZi5faW5zdGFuY2UoKTtcbiAgICAgICAgICAgICAgICAgIC8vIEl0J3MgaW1wb3J0YW50IHRoYXQgd2UgbWFwIHRoZSByZW1vdGUgaWRlbnRpZmllciBoZXJlIHRvIGVuc3VyZSB0aGF0IGl0IGVuZHNcbiAgICAgICAgICAgICAgICAgIC8vIHVwIGluIHRoZSBjYWNoZS5cbiAgICAgICAgICAgICAgICAgIHNlbGYub2JqZWN0c1tsb29rdXAuaW5kZXhdW3NlbGYubW9kZWwuaWRdID0gcmVtb3RlSWQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkb25lKCk7XG4gICAgICAgICAgfVxuICAgICAgICBdLCBjYik7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH0sXG4gICAgX2xvb2t1cFNpbmdsZXRvbjogZnVuY3Rpb24oY2IpIHtcbiAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgLy8gUGljayBhIHJhbmRvbSBsb2NhbElkIGZyb20gdGhlIGFycmF5IG9mIGRhdGEgYmVpbmcgbWFwcGVkIG9udG8gdGhlIHNpbmdsZXRvbiBvYmplY3QuIE5vdGUgdGhhdCB0aGV5IHNob3VsZFxuICAgICAgICAvLyBhbHdheXMgYmUgdGhlIHNhbWUuIFRoaXMgaXMganVzdCBhIHByZWNhdXRpb24uXG4gICAgICAgIHZhciBsb2NhbElkZW50aWZpZXJzID0gXy5wbHVjayhzZWxmLmRhdGEsICdsb2NhbElkJyksXG4gICAgICAgICAgbG9jYWxJZDtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGxvY2FsSWRlbnRpZmllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBpZiAobG9jYWxJZGVudGlmaWVyc1tpXSkge1xuICAgICAgICAgICAgbG9jYWxJZCA9IHtsb2NhbElkOiBsb2NhbElkZW50aWZpZXJzW2ldfTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBUaGUgbWFwcGluZyBvcGVyYXRpb24gaXMgcmVzcG9uc2libGUgZm9yIGNyZWF0aW5nIHNpbmdsZXRvbiBpbnN0YW5jZXMgaWYgdGhleSBkbyBub3QgYWxyZWFkeSBleGlzdC5cbiAgICAgICAgdmFyIHNpbmdsZXRvbiA9IGNhY2hlLmdldFNpbmdsZXRvbih0aGlzLm1vZGVsKSB8fCB0aGlzLl9pbnN0YW5jZShsb2NhbElkKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzZWxmLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBzZWxmLm9iamVjdHNbaV0gPSBzaW5nbGV0b247XG4gICAgICAgIH1cbiAgICAgICAgY2IoKTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfVxuICAgICxcbiAgICBfaW5zdGFuY2U6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIG1vZGVsID0gdGhpcy5tb2RlbCxcbiAgICAgICAgbW9kZWxJbnN0YW5jZSA9IG1vZGVsLl9pbnN0YW5jZS5hcHBseShtb2RlbCwgYXJndW1lbnRzKTtcbiAgICAgIHRoaXMuX25ld09iamVjdHMucHVzaChtb2RlbEluc3RhbmNlKTtcbiAgICAgIHJldHVybiBtb2RlbEluc3RhbmNlO1xuICAgIH1cbiAgICAsXG4gICAgcHJlcHJvY2Vzc0RhdGE6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGRhdGEgPSBfLmV4dGVuZChbXSwgdGhpcy5kYXRhKTtcbiAgICAgIHJldHVybiBfLm1hcChkYXRhLCBmdW5jdGlvbihkYXR1bSkge1xuICAgICAgICBpZiAoZGF0dW0pIHtcbiAgICAgICAgICBpZiAoIXV0aWwuaXNTdHJpbmcoZGF0dW0pKSB7XG4gICAgICAgICAgICB2YXIga2V5cyA9IF8ua2V5cyhkYXR1bSk7XG4gICAgICAgICAgICBfLmVhY2goa2V5cywgZnVuY3Rpb24oaykge1xuICAgICAgICAgICAgICB2YXIgaXNSZWxhdGlvbnNoaXAgPSB0aGlzLm1vZGVsLl9yZWxhdGlvbnNoaXBOYW1lcy5pbmRleE9mKGspID4gLTE7XG5cbiAgICAgICAgICAgICAgaWYgKGlzUmVsYXRpb25zaGlwKSB7XG4gICAgICAgICAgICAgICAgdmFyIHZhbCA9IGRhdHVtW2tdO1xuICAgICAgICAgICAgICAgIGlmICh2YWwgaW5zdGFuY2VvZiBNb2RlbEluc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgICBkYXR1bVtrXSA9IHtsb2NhbElkOiB2YWwubG9jYWxJZH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHV0aWwuaXNBcnJheSh2YWwpKSB7XG4gICAgICAgICAgICAgICAgICBkYXR1bVtrXSA9IF8uZWFjaCh2YWwsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGUgaW5zdGFuY2VvZiBNb2RlbEluc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtsb2NhbElkOiB2YWwubG9jYWxJZH07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHZhbDtcbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRhdHVtO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG4gICAgLFxuICAgIHN0YXJ0OiBmdW5jdGlvbihkb25lKSB7XG4gICAgICB2YXIgZGF0YSA9IHRoaXMuZGF0YTtcbiAgICAgIGlmIChkYXRhLmxlbmd0aCkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHZhciB0YXNrcyA9IFtdO1xuICAgICAgICB2YXIgbG9va3VwRnVuYyA9IHRoaXMubW9kZWwuc2luZ2xldG9uID8gdGhpcy5fbG9va3VwU2luZ2xldG9uIDogdGhpcy5fbG9va3VwO1xuICAgICAgICB0YXNrcy5wdXNoKF8uYmluZChsb29rdXBGdW5jLCB0aGlzKSk7XG4gICAgICAgIHRhc2tzLnB1c2goXy5iaW5kKHRoaXMuX2V4ZWN1dGVTdWJPcGVyYXRpb25zLCB0aGlzKSk7XG4gICAgICAgIHV0aWwuYXN5bmMucGFyYWxsZWwodGFza3MsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBzZWxmLl9tYXAoKTtcblxuICAgICAgICAgICAgLy8gVXNlcnMgYXJlIGFsbG93ZWQgdG8gYWRkIGEgY3VzdG9tIGluaXQgbWV0aG9kIHRvIHRoZSBtZXRob2RzIG9iamVjdCB3aGVuIGRlZmluaW5nIGEgTW9kZWwsIG9mIHRoZSBmb3JtOlxuICAgICAgICAgICAgLy9cbiAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAvLyBpbml0OiBmdW5jdGlvbiAoW2RvbmVdKSB7XG4gICAgICAgICAgICAvLyAgICAgLy8gLi4uXG4gICAgICAgICAgICAvLyAgfVxuICAgICAgICAgICAgLy9cbiAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAvLyBJZiBkb25lIGlzIHBhc3NlZCwgdGhlbiBfX2luaXQgbXVzdCBiZSBleGVjdXRlZCBhc3luY2hyb25vdXNseSwgYW5kIHRoZSBtYXBwaW5nIG9wZXJhdGlvbiB3aWxsIG5vdFxuICAgICAgICAgICAgLy8gZmluaXNoIHVudGlsIGFsbCBpbml0cyBoYXZlIGV4ZWN1dGVkLlxuICAgICAgICAgICAgLy9cbiAgICAgICAgICAgIC8vIEhlcmUgd2UgZW5zdXJlIHRoZSBleGVjdXRpb24gb2YgYWxsIG9mIHRoZW1cbiAgICAgICAgICAgIHZhciBmcm9tU3RvcmFnZSA9IHRoaXMuZnJvbVN0b3JhZ2U7XG4gICAgICAgICAgICB2YXIgaW5pdFRhc2tzID0gXy5yZWR1Y2Uoc2VsZi5fbmV3T2JqZWN0cywgZnVuY3Rpb24obWVtbywgbykge1xuICAgICAgICAgICAgICB2YXIgaW5pdCA9IG8ubW9kZWwuaW5pdDtcbiAgICAgICAgICAgICAgaWYgKGluaXQpIHtcbiAgICAgICAgICAgICAgICB2YXIgcGFyYW1OYW1lcyA9IHV0aWwucGFyYW1OYW1lcyhpbml0KTtcbiAgICAgICAgICAgICAgICBpZiAocGFyYW1OYW1lcy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgICBtZW1vLnB1c2goXy5iaW5kKGluaXQsIG8sIGZyb21TdG9yYWdlLCBkb25lKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgaW5pdC5jYWxsKG8sIGZyb21TdG9yYWdlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgby5fZW1pdEV2ZW50cyA9IHRydWU7XG4gICAgICAgICAgICAgIG8uX2VtaXROZXcoKTtcbiAgICAgICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgICAgICB9LCBbXSk7XG4gICAgICAgICAgICBhc3luYy5wYXJhbGxlbChpbml0VGFza3MsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICBkb25lKHNlbGYuZXJyb3JzLmxlbmd0aCA/IHNlbGYuZXJyb3JzIDogbnVsbCwgc2VsZi5vYmplY3RzKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignVW5jYXVnaHQgZXJyb3Igd2hlbiBleGVjdXRpbmcgaW5pdCBmdW5jaXRvbnMgb24gbW9kZWxzLicsIGUpO1xuICAgICAgICAgICAgZG9uZShlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkb25lKG51bGwsIFtdKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLFxuICAgIGdldFJlbGF0ZWREYXRhOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgICB2YXIgaW5kZXhlcyA9IFtdO1xuICAgICAgdmFyIHJlbGF0ZWREYXRhID0gW107XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgZGF0dW0gPSB0aGlzLmRhdGFbaV07XG4gICAgICAgIGlmIChkYXR1bSkge1xuICAgICAgICAgIHZhciB2YWwgPSBkYXR1bVtuYW1lXTtcbiAgICAgICAgICBpZiAodmFsKSB7XG4gICAgICAgICAgICBpbmRleGVzLnB1c2goaSk7XG4gICAgICAgICAgICByZWxhdGVkRGF0YS5wdXNoKHZhbCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4ge1xuICAgICAgICBpbmRleGVzOiBpbmRleGVzLFxuICAgICAgICByZWxhdGVkRGF0YTogcmVsYXRlZERhdGFcbiAgICAgIH07XG4gICAgfVxuICAgICxcbiAgICBwcm9jZXNzRXJyb3JzRnJvbVRhc2s6IGZ1bmN0aW9uKHJlbGF0aW9uc2hpcE5hbWUsIGVycm9ycywgaW5kZXhlcykge1xuICAgICAgaWYgKGVycm9ycy5sZW5ndGgpIHtcbiAgICAgICAgdmFyIHJlbGF0ZWREYXRhID0gdGhpcy5nZXRSZWxhdGVkRGF0YShyZWxhdGlvbnNoaXBOYW1lKS5yZWxhdGVkRGF0YTtcbiAgICAgICAgdmFyIHVuZmxhdHRlbmVkRXJyb3JzID0gdXRpbC51bmZsYXR0ZW5BcnJheShlcnJvcnMsIHJlbGF0ZWREYXRhKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB1bmZsYXR0ZW5lZEVycm9ycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIHZhciBpZHggPSBpbmRleGVzW2ldO1xuICAgICAgICAgIHZhciBlcnIgPSB1bmZsYXR0ZW5lZEVycm9yc1tpXTtcbiAgICAgICAgICB2YXIgaXNFcnJvciA9IGVycjtcbiAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KGVycikpIGlzRXJyb3IgPSBfLnJlZHVjZShlcnIsIGZ1bmN0aW9uKG1lbW8sIHgpIHtcbiAgICAgICAgICAgIHJldHVybiBtZW1vIHx8IHhcbiAgICAgICAgICB9LCBmYWxzZSk7XG4gICAgICAgICAgaWYgKGlzRXJyb3IpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5lcnJvcnNbaWR4XSkgdGhpcy5lcnJvcnNbaWR4XSA9IHt9O1xuICAgICAgICAgICAgdGhpcy5lcnJvcnNbaWR4XVtyZWxhdGlvbnNoaXBOYW1lXSA9IGVycjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLFxuICAgIF9leGVjdXRlU3ViT3BlcmF0aW9uczogZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcyxcbiAgICAgICAgcmVsYXRpb25zaGlwTmFtZXMgPSBfLmtleXModGhpcy5tb2RlbC5yZWxhdGlvbnNoaXBzKTtcbiAgICAgIGlmIChyZWxhdGlvbnNoaXBOYW1lcy5sZW5ndGgpIHtcbiAgICAgICAgdmFyIHRhc2tzID0gXy5yZWR1Y2UocmVsYXRpb25zaGlwTmFtZXMsIGZ1bmN0aW9uKG0sIHJlbGF0aW9uc2hpcE5hbWUpIHtcbiAgICAgICAgICB2YXIgcmVsYXRpb25zaGlwID0gc2VsZi5tb2RlbC5yZWxhdGlvbnNoaXBzW3JlbGF0aW9uc2hpcE5hbWVdO1xuICAgICAgICAgIHZhciByZXZlcnNlTW9kZWwgPSByZWxhdGlvbnNoaXAuZm9yd2FyZE5hbWUgPT0gcmVsYXRpb25zaGlwTmFtZSA/IHJlbGF0aW9uc2hpcC5yZXZlcnNlTW9kZWwgOiByZWxhdGlvbnNoaXAuZm9yd2FyZE1vZGVsO1xuICAgICAgICAgIC8vIE1vY2sgYW55IG1pc3Npbmcgc2luZ2xldG9uIGRhdGEgdG8gZW5zdXJlIHRoYXQgYWxsIHNpbmdsZXRvbiBpbnN0YW5jZXMgYXJlIGNyZWF0ZWQuXG4gICAgICAgICAgaWYgKHJldmVyc2VNb2RlbC5zaW5nbGV0b24gJiYgIXJlbGF0aW9uc2hpcC5pc1JldmVyc2UpIHtcbiAgICAgICAgICAgIHRoaXMuZGF0YS5mb3JFYWNoKGZ1bmN0aW9uKGRhdHVtKSB7XG4gICAgICAgICAgICAgIGlmICghZGF0dW1bcmVsYXRpb25zaGlwTmFtZV0pIGRhdHVtW3JlbGF0aW9uc2hpcE5hbWVdID0ge307XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdmFyIF9fcmV0ID0gdGhpcy5nZXRSZWxhdGVkRGF0YShyZWxhdGlvbnNoaXBOYW1lKSxcbiAgICAgICAgICAgIGluZGV4ZXMgPSBfX3JldC5pbmRleGVzLFxuICAgICAgICAgICAgcmVsYXRlZERhdGEgPSBfX3JldC5yZWxhdGVkRGF0YTtcbiAgICAgICAgICBpZiAocmVsYXRlZERhdGEubGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgZmxhdFJlbGF0ZWREYXRhID0gdXRpbC5mbGF0dGVuQXJyYXkocmVsYXRlZERhdGEpO1xuICAgICAgICAgICAgdmFyIG9wID0gbmV3IE1hcHBpbmdPcGVyYXRpb24oe1xuICAgICAgICAgICAgICBtb2RlbDogcmV2ZXJzZU1vZGVsLFxuICAgICAgICAgICAgICBkYXRhOiBmbGF0UmVsYXRlZERhdGEsXG4gICAgICAgICAgICAgIGRpc2FibGVldmVudHM6IHNlbGYuZGlzYWJsZWV2ZW50cyxcbiAgICAgICAgICAgICAgX2lnbm9yZUluc3RhbGxlZDogc2VsZi5faWdub3JlSW5zdGFsbGVkLFxuICAgICAgICAgICAgICBmcm9tU3RvcmFnZTogdGhpcy5mcm9tU3RvcmFnZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKG9wKSB7XG4gICAgICAgICAgICB2YXIgdGFzaztcbiAgICAgICAgICAgIHRhc2sgPSBmdW5jdGlvbihkb25lKSB7XG4gICAgICAgICAgICAgIG9wLnN0YXJ0KGZ1bmN0aW9uKGVycm9ycywgb2JqZWN0cykge1xuICAgICAgICAgICAgICAgIHNlbGYuc3ViVGFza1Jlc3VsdHNbcmVsYXRpb25zaGlwTmFtZV0gPSB7XG4gICAgICAgICAgICAgICAgICBlcnJvcnM6IGVycm9ycyxcbiAgICAgICAgICAgICAgICAgIG9iamVjdHM6IG9iamVjdHMsXG4gICAgICAgICAgICAgICAgICBpbmRleGVzOiBpbmRleGVzXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBzZWxmLnByb2Nlc3NFcnJvcnNGcm9tVGFzayhyZWxhdGlvbnNoaXBOYW1lLCBvcC5lcnJvcnMsIGluZGV4ZXMpO1xuICAgICAgICAgICAgICAgIGRvbmUoKTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgbS5wdXNoKHRhc2spO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gbTtcbiAgICAgICAgfS5iaW5kKHRoaXMpLCBbXSk7XG4gICAgICAgIGFzeW5jLnBhcmFsbGVsKHRhc2tzLCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICB9XG4gICAgfVxuICB9KVxuICA7XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBNYXBwaW5nT3BlcmF0aW9uO1xuXG5cbn0pXG4oKTsiLCIoZnVuY3Rpb24oKSB7XG5cbiAgdmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJykoJ21vZGVsJyksXG4gICAgQ29sbGVjdGlvblJlZ2lzdHJ5ID0gcmVxdWlyZSgnLi9jb2xsZWN0aW9uUmVnaXN0cnknKS5Db2xsZWN0aW9uUmVnaXN0cnksXG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgIFJlbGF0aW9uc2hpcFR5cGUgPSByZXF1aXJlKCcuL1JlbGF0aW9uc2hpcFR5cGUnKSxcbiAgICBRdWVyeSA9IHJlcXVpcmUoJy4vUXVlcnknKSxcbiAgICBNYXBwaW5nT3BlcmF0aW9uID0gcmVxdWlyZSgnLi9tYXBwaW5nT3BlcmF0aW9uJyksXG4gICAgTW9kZWxJbnN0YW5jZSA9IHJlcXVpcmUoJy4vTW9kZWxJbnN0YW5jZScpLFxuICAgIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKSxcbiAgICBhcmdzYXJyYXkgPSByZXF1aXJlKCdhcmdzYXJyYXknKSxcbiAgICBlcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKSxcbiAgICBleHRlbmQgPSByZXF1aXJlKCdleHRlbmQnKSxcbiAgICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgICBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICAgIE9uZVRvT25lUHJveHkgPSByZXF1aXJlKCcuL09uZVRvT25lUHJveHknKSxcbiAgICBNYW55VG9NYW55UHJveHkgPSByZXF1aXJlKCcuL01hbnlUb01hbnlQcm94eScpLFxuICAgIFBsYWNlaG9sZGVyID0gcmVxdWlyZSgnLi9QbGFjZWhvbGRlcicpLFxuICAgIFJlYWN0aXZlUXVlcnkgPSByZXF1aXJlKCcuL1JlYWN0aXZlUXVlcnknKSxcbiAgICBpbnN0YW5jZUZhY3RvcnkgPSByZXF1aXJlKCcuL2luc3RhbmNlRmFjdG9yeScpLFxuICAgIF8gPSB1dGlsLl87XG5cbiAgLyoqXG4gICAqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gICAqL1xuICBmdW5jdGlvbiBNb2RlbChvcHRzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHRoaXMuX29wdHMgPSBvcHRzID8gXy5leHRlbmQoe30sIG9wdHMpIDoge307XG5cbiAgICB1dGlsLmV4dGVuZEZyb21PcHRzKHRoaXMsIG9wdHMsIHtcbiAgICAgIG1ldGhvZHM6IHt9LFxuICAgICAgYXR0cmlidXRlczogW10sXG4gICAgICBjb2xsZWN0aW9uOiBmdW5jdGlvbihjKSB7XG4gICAgICAgIGlmICh1dGlsLmlzU3RyaW5nKGMpKSB7XG4gICAgICAgICAgYyA9IENvbGxlY3Rpb25SZWdpc3RyeVtjXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYztcbiAgICAgIH0sXG4gICAgICBpZDogJ2lkJyxcbiAgICAgIHJlbGF0aW9uc2hpcHM6IFtdLFxuICAgICAgbmFtZTogbnVsbCxcbiAgICAgIGluZGV4ZXM6IFtdLFxuICAgICAgc2luZ2xldG9uOiBmYWxzZSxcbiAgICAgIHN0YXRpY3M6IHRoaXMuaW5zdGFsbFN0YXRpY3MuYmluZCh0aGlzKSxcbiAgICAgIHByb3BlcnRpZXM6IHt9LFxuICAgICAgaW5pdDogbnVsbCxcbiAgICAgIHNlcmlhbGlzZTogbnVsbCxcbiAgICAgIHNlcmlhbGlzZUZpZWxkOiBudWxsLFxuICAgICAgc2VyaWFsaXNhYmxlRmllbGRzOiBudWxsLFxuICAgICAgcmVtb3ZlOiBudWxsLFxuICAgICAgcGFyc2VBdHRyaWJ1dGU6IG51bGxcbiAgICB9LCBmYWxzZSk7XG5cbiAgICBpZiAoIXRoaXMucGFyc2VBdHRyaWJ1dGUpIHtcbiAgICAgIHRoaXMucGFyc2VBdHRyaWJ1dGUgPSBmdW5jdGlvbihhdHRyTmFtZSwgdmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghdGhpcy5zZXJpYWxpc2VGaWVsZCkge1xuICAgICAgdGhpcy5zZXJpYWxpc2VGaWVsZCA9IGZ1bmN0aW9uKGF0dHJOYW1lLCB2YWx1ZSkge1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICB9O1xuICAgIH1cblxuICAgIHRoaXMuYXR0cmlidXRlcyA9IE1vZGVsLl9wcm9jZXNzQXR0cmlidXRlcyh0aGlzLmF0dHJpYnV0ZXMpO1xuXG4gICAgdGhpcy5faW5zdGFuY2UgPSBuZXcgaW5zdGFuY2VGYWN0b3J5KHRoaXMpO1xuXG4gICAgXy5leHRlbmQodGhpcywge1xuICAgICAgX3JlbGF0aW9uc2hpcHNJbnN0YWxsZWQ6IGZhbHNlLFxuICAgICAgX3JldmVyc2VSZWxhdGlvbnNoaXBzSW5zdGFsbGVkOiBmYWxzZSxcbiAgICAgIGNoaWxkcmVuOiBbXVxuICAgIH0pO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXModGhpcywge1xuICAgICAgX3JlbGF0aW9uc2hpcE5hbWVzOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKHNlbGYucmVsYXRpb25zaGlwcyk7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgIH0sXG4gICAgICBfYXR0cmlidXRlTmFtZXM6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgbmFtZXMgPSBbXTtcbiAgICAgICAgICBpZiAoc2VsZi5pZCkge1xuICAgICAgICAgICAgbmFtZXMucHVzaChzZWxmLmlkKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgXy5lYWNoKHNlbGYuYXR0cmlidXRlcywgZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgbmFtZXMucHVzaCh4Lm5hbWUpXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgcmV0dXJuIG5hbWVzO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgIH0sXG4gICAgICBpbnN0YWxsZWQ6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gc2VsZi5fcmVsYXRpb25zaGlwc0luc3RhbGxlZCAmJiBzZWxmLl9yZXZlcnNlUmVsYXRpb25zaGlwc0luc3RhbGxlZDtcbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICB9LFxuICAgICAgZGVzY2VuZGFudHM6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gXy5yZWR1Y2Uoc2VsZi5jaGlsZHJlbiwgZnVuY3Rpb24obWVtbywgZGVzY2VuZGFudCkge1xuICAgICAgICAgICAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5jb25jYXQuY2FsbChtZW1vLCBkZXNjZW5kYW50LmRlc2NlbmRhbnRzKTtcbiAgICAgICAgICB9LmJpbmQoc2VsZiksIF8uZXh0ZW5kKFtdLCBzZWxmLmNoaWxkcmVuKSk7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgIH0sXG4gICAgICBkaXJ0eToge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGlmIChzaWVzdGEuZXh0LnN0b3JhZ2VFbmFibGVkKSB7XG4gICAgICAgICAgICB2YXIgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb24gPSBzaWVzdGEuZXh0LnN0b3JhZ2UuX3Vuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uLFxuICAgICAgICAgICAgICBoYXNoID0gKHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uW3RoaXMuY29sbGVjdGlvbk5hbWVdIHx8IHt9KVt0aGlzLm5hbWVdIHx8IHt9O1xuICAgICAgICAgICAgcmV0dXJuICEhT2JqZWN0LmtleXMoaGFzaCkubGVuZ3RoO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgIH0sXG4gICAgICBjb2xsZWN0aW9uTmFtZToge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiB0aGlzLmNvbGxlY3Rpb24ubmFtZTtcbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgICAgfVxuICAgIH0pO1xuICAgIHZhciBnbG9iYWxFdmVudE5hbWUgPSB0aGlzLmNvbGxlY3Rpb25OYW1lICsgJzonICsgdGhpcy5uYW1lLFxuICAgICAgcHJveGllZCA9IHtcbiAgICAgICAgcXVlcnk6IHRoaXMucXVlcnkuYmluZCh0aGlzKVxuICAgICAgfTtcblxuICAgIGV2ZW50cy5Qcm94eUV2ZW50RW1pdHRlci5jYWxsKHRoaXMsIGdsb2JhbEV2ZW50TmFtZSwgcHJveGllZCk7XG4gIH1cblxuICBfLmV4dGVuZChNb2RlbCwge1xuICAgIC8qKlxuICAgICAqIE5vcm1hbGlzZSBhdHRyaWJ1dGVzIHBhc3NlZCB2aWEgdGhlIG9wdGlvbnMgZGljdGlvbmFyeS5cbiAgICAgKiBAcGFyYW0gYXR0cmlidXRlc1xuICAgICAqIEByZXR1cm5zIHtBcnJheX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9wcm9jZXNzQXR0cmlidXRlczogZnVuY3Rpb24oYXR0cmlidXRlcykge1xuICAgICAgcmV0dXJuIF8ucmVkdWNlKGF0dHJpYnV0ZXMsIGZ1bmN0aW9uKG0sIGEpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBhID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgbS5wdXNoKHtcbiAgICAgICAgICAgIG5hbWU6IGFcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBtLnB1c2goYSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG07XG4gICAgICB9LCBbXSlcbiAgICB9XG4gIH0pO1xuXG4gIE1vZGVsLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoZXZlbnRzLlByb3h5RXZlbnRFbWl0dGVyLnByb3RvdHlwZSk7XG5cbiAgXy5leHRlbmQoTW9kZWwucHJvdG90eXBlLCB7XG4gICAgaW5zdGFsbFN0YXRpY3M6IGZ1bmN0aW9uKHN0YXRpY3MpIHtcbiAgICAgIGlmIChzdGF0aWNzKSB7XG4gICAgICAgIF8uZWFjaChPYmplY3Qua2V5cyhzdGF0aWNzKSwgZnVuY3Rpb24oc3RhdGljTmFtZSkge1xuICAgICAgICAgIGlmICh0aGlzW3N0YXRpY05hbWVdKSB7XG4gICAgICAgICAgICBsb2coJ1N0YXRpYyBtZXRob2Qgd2l0aCBuYW1lIFwiJyArIHN0YXRpY05hbWUgKyAnXCIgYWxyZWFkeSBleGlzdHMuIElnbm9yaW5nIGl0LicpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXNbc3RhdGljTmFtZV0gPSBzdGF0aWNzW3N0YXRpY05hbWVdLmJpbmQodGhpcyk7XG4gICAgICAgICAgfVxuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHN0YXRpY3M7XG4gICAgfSxcbiAgICBfdmFsaWRhdGVSZWxhdGlvbnNoaXBUeXBlOiBmdW5jdGlvbihyZWxhdGlvbnNoaXApIHtcbiAgICAgIGlmICghcmVsYXRpb25zaGlwLnR5cGUpIHtcbiAgICAgICAgaWYgKHRoaXMuc2luZ2xldG9uKSByZWxhdGlvbnNoaXAudHlwZSA9IFJlbGF0aW9uc2hpcFR5cGUuT25lVG9PbmU7XG4gICAgICAgIGVsc2UgcmVsYXRpb25zaGlwLnR5cGUgPSBSZWxhdGlvbnNoaXBUeXBlLk9uZVRvTWFueTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLnNpbmdsZXRvbiAmJiByZWxhdGlvbnNoaXAudHlwZSA9PSBSZWxhdGlvbnNoaXBUeXBlLk1hbnlUb01hbnkpIHtcbiAgICAgICAgcmV0dXJuICdTaW5nbGV0b24gbW9kZWwgY2Fubm90IHVzZSBNYW55VG9NYW55IHJlbGF0aW9uc2hpcC4nO1xuICAgICAgfVxuICAgICAgaWYgKE9iamVjdC5rZXlzKFJlbGF0aW9uc2hpcFR5cGUpLmluZGV4T2YocmVsYXRpb25zaGlwLnR5cGUpIDwgMClcbiAgICAgICAgcmV0dXJuICdSZWxhdGlvbnNoaXAgdHlwZSAnICsgcmVsYXRpb25zaGlwLnR5cGUgKyAnIGRvZXMgbm90IGV4aXN0JztcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogUmV0dXJuIHRoZSByZXZlcnNlIG1vZGVsIG9yIGEgcGxhY2Vob2xkZXIgdGhhdCB3aWxsIGJlIHJlc29sdmVkIGxhdGVyLlxuICAgICAqIEBwYXJhbSBuYW1lXG4gICAgICogQHJldHVybnMgeyp9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZ2V0UmV2ZXJzZU1vZGVsOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgICB2YXIgcmV2ZXJzZU1vZGVsO1xuICAgICAgaWYgKG5hbWUgaW5zdGFuY2VvZiBNb2RlbCkgcmV2ZXJzZU1vZGVsID0gbmFtZTtcbiAgICAgIGVsc2UgcmV2ZXJzZU1vZGVsID0gdGhpcy5jb2xsZWN0aW9uW25hbWVdO1xuICAgICAgaWYgKCFyZXZlcnNlTW9kZWwpIHsgLy8gTWF5IGhhdmUgdXNlZCBDb2xsZWN0aW9uLk1vZGVsIGZvcm1hdC5cbiAgICAgICAgdmFyIGFyciA9IG5hbWUuc3BsaXQoJy4nKTtcbiAgICAgICAgaWYgKGFyci5sZW5ndGggPT0gMikge1xuICAgICAgICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IGFyclswXTtcbiAgICAgICAgICBuYW1lID0gYXJyWzFdO1xuICAgICAgICAgIHZhciBvdGhlckNvbGxlY3Rpb24gPSBDb2xsZWN0aW9uUmVnaXN0cnlbY29sbGVjdGlvbk5hbWVdO1xuICAgICAgICAgIGlmICghb3RoZXJDb2xsZWN0aW9uKSByZXR1cm4gJ0NvbGxlY3Rpb24gd2l0aCBuYW1lIFwiJyArIGNvbGxlY3Rpb25OYW1lICsgJ1wiIGRvZXMgbm90IGV4aXN0Lic7XG4gICAgICAgICAgcmV2ZXJzZU1vZGVsID0gb3RoZXJDb2xsZWN0aW9uW25hbWVdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gcmV2ZXJzZU1vZGVsIHx8IG5ldyBQbGFjZWhvbGRlcih7bmFtZTogbmFtZX0pO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogSW5zdGFsbCByZWxhdGlvbnNoaXBzLiBSZXR1cm5zIGVycm9yIGluIGZvcm0gb2Ygc3RyaW5nIGlmIGZhaWxzLlxuICAgICAqIEByZXR1cm4ge1N0cmluZ3xudWxsfVxuICAgICAqL1xuICAgIGluc3RhbGxSZWxhdGlvbnNoaXBzOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICghdGhpcy5fcmVsYXRpb25zaGlwc0luc3RhbGxlZCkge1xuICAgICAgICB2YXIgZXJyID0gbnVsbDtcbiAgICAgICAgZm9yICh2YXIgbmFtZSBpbiB0aGlzLl9vcHRzLnJlbGF0aW9uc2hpcHMpIHtcbiAgICAgICAgICBpZiAodGhpcy5fb3B0cy5yZWxhdGlvbnNoaXBzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgICAgICB2YXIgcmVsYXRpb25zaGlwID0gdGhpcy5fb3B0cy5yZWxhdGlvbnNoaXBzW25hbWVdO1xuICAgICAgICAgICAgLy8gSWYgYSByZXZlcnNlIHJlbGF0aW9uc2hpcCBpcyBpbnN0YWxsZWQgYmVmb3JlaGFuZCwgd2UgZG8gbm90IHdhbnQgdG8gcHJvY2VzcyB0aGVtLlxuICAgICAgICAgICAgdmFyIGlzRm9yd2FyZCA9ICFyZWxhdGlvbnNoaXAuaXNSZXZlcnNlO1xuICAgICAgICAgICAgaWYgKGlzRm9yd2FyZCkge1xuICAgICAgICAgICAgICBsb2codGhpcy5uYW1lICsgJzogY29uZmlndXJpbmcgcmVsYXRpb25zaGlwICcgKyBuYW1lLCByZWxhdGlvbnNoaXApO1xuICAgICAgICAgICAgICBpZiAoIShlcnIgPSB0aGlzLl92YWxpZGF0ZVJlbGF0aW9uc2hpcFR5cGUocmVsYXRpb25zaGlwKSkpIHtcbiAgICAgICAgICAgICAgICB2YXIgcmV2ZXJzZU1vZGVsTmFtZSA9IHJlbGF0aW9uc2hpcC5tb2RlbDtcbiAgICAgICAgICAgICAgICBpZiAocmV2ZXJzZU1vZGVsTmFtZSkge1xuICAgICAgICAgICAgICAgICAgdmFyIHJldmVyc2VNb2RlbCA9IHRoaXMuX2dldFJldmVyc2VNb2RlbChyZXZlcnNlTW9kZWxOYW1lKTtcbiAgICAgICAgICAgICAgICAgIGlmICh1dGlsLmlzU3RyaW5nKHJldmVyc2VNb2RlbCkpIHJldHVybiByZXZlcnNlTW9kZWw7XG4gICAgICAgICAgICAgICAgICBfLmV4dGVuZChyZWxhdGlvbnNoaXAsIHtcbiAgICAgICAgICAgICAgICAgICAgcmV2ZXJzZU1vZGVsOiByZXZlcnNlTW9kZWwsXG4gICAgICAgICAgICAgICAgICAgIGZvcndhcmRNb2RlbDogdGhpcyxcbiAgICAgICAgICAgICAgICAgICAgZm9yd2FyZE5hbWU6IG5hbWUsXG4gICAgICAgICAgICAgICAgICAgIHJldmVyc2VOYW1lOiByZWxhdGlvbnNoaXAucmV2ZXJzZSB8fCAncmV2ZXJzZV8nICsgbmFtZSxcbiAgICAgICAgICAgICAgICAgICAgaXNSZXZlcnNlOiBmYWxzZVxuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICBkZWxldGUgcmVsYXRpb25zaGlwLm1vZGVsO1xuICAgICAgICAgICAgICAgICAgZGVsZXRlIHJlbGF0aW9uc2hpcC5yZXZlcnNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHJldHVybiAnTXVzdCBwYXNzIG1vZGVsJztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdSZWxhdGlvbnNoaXBzIGZvciBcIicgKyB0aGlzLm5hbWUgKyAnXCIgaGF2ZSBhbHJlYWR5IGJlZW4gaW5zdGFsbGVkJyk7XG4gICAgICBpZiAoIWVycikgdGhpcy5fcmVsYXRpb25zaGlwc0luc3RhbGxlZCA9IHRydWU7XG4gICAgICByZXR1cm4gZXJyO1xuICAgIH0sXG4gICAgaW5zdGFsbFJldmVyc2VSZWxhdGlvbnNoaXBzOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBpbnN0YWxsZWQgPSBbXTtcbiAgICAgIGlmICghdGhpcy5fcmV2ZXJzZVJlbGF0aW9uc2hpcHNJbnN0YWxsZWQpIHtcbiAgICAgICAgZm9yICh2YXIgZm9yd2FyZE5hbWUgaW4gdGhpcy5yZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgICAgaWYgKHRoaXMucmVsYXRpb25zaGlwcy5oYXNPd25Qcm9wZXJ0eShmb3J3YXJkTmFtZSkpIHtcbiAgICAgICAgICAgIHZhciByZWxhdGlvbnNoaXAgPSB0aGlzLnJlbGF0aW9uc2hpcHNbZm9yd2FyZE5hbWVdO1xuICAgICAgICAgICAgcmVsYXRpb25zaGlwID0gZXh0ZW5kKHRydWUsIHt9LCByZWxhdGlvbnNoaXApO1xuICAgICAgICAgICAgcmVsYXRpb25zaGlwLmlzUmV2ZXJzZSA9IHRydWU7XG4gICAgICAgICAgICB2YXIgcmV2ZXJzZU1vZGVsID0gcmVsYXRpb25zaGlwLnJldmVyc2VNb2RlbCxcbiAgICAgICAgICAgICAgcmV2ZXJzZU5hbWUgPSByZWxhdGlvbnNoaXAucmV2ZXJzZU5hbWUsXG4gICAgICAgICAgICAgIGZvcndhcmRNb2RlbCA9IHJlbGF0aW9uc2hpcC5mb3J3YXJkTW9kZWw7XG4gICAgICAgICAgICBpZiAocmV2ZXJzZU1vZGVsICE9IHRoaXMgfHwgcmV2ZXJzZU1vZGVsID09IGZvcndhcmRNb2RlbCkge1xuICAgICAgICAgICAgICBpbnN0YWxsZWQucHVzaChyZXZlcnNlTmFtZSk7XG4gICAgICAgICAgICAgIGlmIChyZXZlcnNlTW9kZWwuc2luZ2xldG9uKSB7XG4gICAgICAgICAgICAgICAgaWYgKHJlbGF0aW9uc2hpcC50eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuTWFueVRvTWFueSkgcmV0dXJuICdTaW5nbGV0b24gbW9kZWwgY2Fubm90IGJlIHJlbGF0ZWQgdmlhIHJldmVyc2UgTWFueVRvTWFueSc7XG4gICAgICAgICAgICAgICAgaWYgKHJlbGF0aW9uc2hpcC50eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuT25lVG9NYW55KSByZXR1cm4gJ1NpbmdsZXRvbiBtb2RlbCBjYW5ub3QgYmUgcmVsYXRlZCB2aWEgcmV2ZXJzZSBPbmVUb01hbnknO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGxvZyh0aGlzLm5hbWUgKyAnOiBjb25maWd1cmluZyAgcmV2ZXJzZSByZWxhdGlvbnNoaXAgJyArIHJldmVyc2VOYW1lKTtcbiAgICAgICAgICAgICAgaWYgKHJldmVyc2VNb2RlbC5yZWxhdGlvbnNoaXBzW3JldmVyc2VOYW1lXSkge1xuICAgICAgICAgICAgICAgIC8vIFdlIGFyZSBvayB0byByZWRlZmluZSByZXZlcnNlIHJlbGF0aW9uc2hpcHMgd2hlcmVieSB0aGUgbW9kZWxzIGFyZSBpbiB0aGUgc2FtZSBoaWVyYXJjaHlcbiAgICAgICAgICAgICAgICB2YXIgaXNBbmNlc3Rvck1vZGVsID0gcmV2ZXJzZU1vZGVsLnJlbGF0aW9uc2hpcHNbcmV2ZXJzZU5hbWVdLmZvcndhcmRNb2RlbC5pc0FuY2VzdG9yT2YodGhpcyk7XG4gICAgICAgICAgICAgICAgdmFyIGlzRGVzY2VuZGVudE1vZGVsID0gcmV2ZXJzZU1vZGVsLnJlbGF0aW9uc2hpcHNbcmV2ZXJzZU5hbWVdLmZvcndhcmRNb2RlbC5pc0Rlc2NlbmRhbnRPZih0aGlzKTtcbiAgICAgICAgICAgICAgICBpZiAoIWlzQW5jZXN0b3JNb2RlbCAmJiAhaXNEZXNjZW5kZW50TW9kZWwpXG4gICAgICAgICAgICAgICAgICByZXR1cm4gJ1JldmVyc2UgcmVsYXRpb25zaGlwIFwiJyArIHJldmVyc2VOYW1lICsgJ1wiIGFscmVhZHkgZXhpc3RzIG9uIG1vZGVsIFwiJyArIHJldmVyc2VNb2RlbC5uYW1lICsgJ1wiJztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXZlcnNlTW9kZWwucmVsYXRpb25zaGlwc1tyZXZlcnNlTmFtZV0gPSByZWxhdGlvbnNoaXA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3JldmVyc2VSZWxhdGlvbnNoaXBzSW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdSZXZlcnNlIHJlbGF0aW9uc2hpcHMgZm9yIFwiJyArIHRoaXMubmFtZSArICdcIiBoYXZlIGFscmVhZHkgYmVlbiBpbnN0YWxsZWQuJyk7XG4gICAgICB9XG4gICAgfSxcbiAgICBfcXVlcnk6IGZ1bmN0aW9uKHF1ZXJ5KSB7XG4gICAgICByZXR1cm4gbmV3IFF1ZXJ5KHRoaXMsIHF1ZXJ5IHx8IHt9KTtcbiAgICB9LFxuICAgIHF1ZXJ5OiBmdW5jdGlvbihxdWVyeSwgY2IpIHtcbiAgICAgIHZhciBxdWVyeUluc3RhbmNlO1xuICAgICAgdmFyIHByb21pc2UgPSB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICAgIGlmICghdGhpcy5zaW5nbGV0b24pIHtcbiAgICAgICAgICBxdWVyeUluc3RhbmNlID0gdGhpcy5fcXVlcnkocXVlcnkpO1xuICAgICAgICAgIHJldHVybiBxdWVyeUluc3RhbmNlLmV4ZWN1dGUoY2IpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIHF1ZXJ5SW5zdGFuY2UgPSB0aGlzLl9xdWVyeSh7X19pZ25vcmVJbnN0YWxsZWQ6IHRydWV9KTtcbiAgICAgICAgICBxdWVyeUluc3RhbmNlLmV4ZWN1dGUoZnVuY3Rpb24oZXJyLCBvYmpzKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSBjYihlcnIpO1xuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIC8vIENhY2hlIGEgbmV3IHNpbmdsZXRvbiBhbmQgdGhlbiByZWV4ZWN1dGUgdGhlIHF1ZXJ5XG4gICAgICAgICAgICAgIHF1ZXJ5ID0gXy5leHRlbmQoe30sIHF1ZXJ5KTtcbiAgICAgICAgICAgICAgcXVlcnkuX19pZ25vcmVJbnN0YWxsZWQgPSB0cnVlO1xuICAgICAgICAgICAgICBpZiAoIW9ianMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5ncmFwaCh7fSwgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICBxdWVyeUluc3RhbmNlID0gdGhpcy5fcXVlcnkocXVlcnkpO1xuICAgICAgICAgICAgICAgICAgICBxdWVyeUluc3RhbmNlLmV4ZWN1dGUoY2IpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNiKGVycik7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBxdWVyeUluc3RhbmNlID0gdGhpcy5fcXVlcnkocXVlcnkpO1xuICAgICAgICAgICAgICAgIHF1ZXJ5SW5zdGFuY2UuZXhlY3V0ZShjYik7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgICAvLyBCeSB3cmFwcGluZyB0aGUgcHJvbWlzZSBpbiBhbm90aGVyIHByb21pc2Ugd2UgY2FuIHB1c2ggdGhlIGludm9jYXRpb25zIHRvIHRoZSBib3R0b20gb2YgdGhlIGV2ZW50IGxvb3Agc28gdGhhdFxuICAgICAgLy8gYW55IGV2ZW50IGhhbmRsZXJzIGFkZGVkIHRvIHRoZSBjaGFpbiBhcmUgaG9ub3VyZWQgc3RyYWlnaHQgYXdheS5cbiAgICAgIHZhciBsaW5rUHJvbWlzZSA9IG5ldyB1dGlsLlByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIHByb21pc2UudGhlbihhcmdzYXJyYXkoZnVuY3Rpb24oYXJncykge1xuICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXNvbHZlLmFwcGx5KG51bGwsIGFyZ3MpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KSwgYXJnc2FycmF5KGZ1bmN0aW9uKGFyZ3MpIHtcbiAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmVqZWN0LmFwcGx5KG51bGwsIGFyZ3MpO1xuICAgICAgICAgIH0pXG4gICAgICAgIH0pKTtcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gdGhpcy5fbGluayh7XG4gICAgICAgIHRoZW46IGxpbmtQcm9taXNlLnRoZW4uYmluZChsaW5rUHJvbWlzZSksXG4gICAgICAgIGNhdGNoOiBsaW5rUHJvbWlzZS5jYXRjaC5iaW5kKGxpbmtQcm9taXNlKSxcbiAgICAgICAgb246IGFyZ3NhcnJheShmdW5jdGlvbihhcmdzKSB7XG4gICAgICAgICAgdmFyIHJxID0gbmV3IFJlYWN0aXZlUXVlcnkodGhpcy5fcXVlcnkocXVlcnkpKTtcbiAgICAgICAgICBycS5pbml0KCk7XG4gICAgICAgICAgcnEub24uYXBwbHkocnEsIGFyZ3MpO1xuICAgICAgICB9LmJpbmQodGhpcykpXG4gICAgICB9KTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIE9ubHkgdXNlZCBpbiB0ZXN0aW5nIGF0IHRoZSBtb21lbnQuXG4gICAgICogQHBhcmFtIHF1ZXJ5XG4gICAgICogQHJldHVybnMge1JlYWN0aXZlUXVlcnl9XG4gICAgICovXG4gICAgX3JlYWN0aXZlUXVlcnk6IGZ1bmN0aW9uKHF1ZXJ5KSB7XG4gICAgICByZXR1cm4gbmV3IFJlYWN0aXZlUXVlcnkobmV3IFF1ZXJ5KHRoaXMsIHF1ZXJ5IHx8IHt9KSk7XG4gICAgfSxcbiAgICBvbmU6IGZ1bmN0aW9uKG9wdHMsIGNiKSB7XG4gICAgICBpZiAodHlwZW9mIG9wdHMgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjYiA9IG9wdHM7XG4gICAgICAgIG9wdHMgPSB7fTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICAgIHRoaXMucXVlcnkob3B0cywgZnVuY3Rpb24oZXJyLCByZXMpIHtcbiAgICAgICAgICBpZiAoZXJyKSBjYihlcnIpO1xuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaWYgKHJlcy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgIGNiKGVycm9yKCdNb3JlIHRoYW4gb25lIGluc3RhbmNlIHJldHVybmVkIHdoZW4gZXhlY3V0aW5nIGdldCBxdWVyeSEnKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgcmVzID0gcmVzLmxlbmd0aCA/IHJlc1swXSA6IG51bGw7XG4gICAgICAgICAgICAgIGNiKG51bGwsIHJlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfSxcbiAgICBhbGw6IGZ1bmN0aW9uKHEsIGNiKSB7XG4gICAgICBpZiAodHlwZW9mIHEgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjYiA9IHE7XG4gICAgICAgIHEgPSB7fTtcbiAgICAgIH1cbiAgICAgIHEgPSBxIHx8IHt9O1xuICAgICAgdmFyIHF1ZXJ5ID0ge307XG4gICAgICBpZiAocS5fX29yZGVyKSBxdWVyeS5fX29yZGVyID0gcS5fX29yZGVyO1xuICAgICAgcmV0dXJuIHRoaXMucXVlcnkocSwgY2IpO1xuICAgIH0sXG4gICAgX2F0dHJpYnV0ZURlZmluaXRpb25XaXRoTmFtZTogZnVuY3Rpb24obmFtZSkge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmF0dHJpYnV0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGF0dHJpYnV0ZURlZmluaXRpb24gPSB0aGlzLmF0dHJpYnV0ZXNbaV07XG4gICAgICAgIGlmIChhdHRyaWJ1dGVEZWZpbml0aW9uLm5hbWUgPT0gbmFtZSkgcmV0dXJuIGF0dHJpYnV0ZURlZmluaXRpb247XG4gICAgICB9XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBNYXAgZGF0YSBpbnRvIFNpZXN0YS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBkYXRhIFJhdyBkYXRhIHJlY2VpdmVkIHJlbW90ZWx5IG9yIG90aGVyd2lzZVxuICAgICAqIEBwYXJhbSB7ZnVuY3Rpb258b2JqZWN0fSBbb3B0c11cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IG9wdHMub3ZlcnJpZGVcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IG9wdHMuX2lnbm9yZUluc3RhbGxlZCAtIEEgaGFjayB0aGF0IGFsbG93cyBtYXBwaW5nIG9udG8gTW9kZWxzIGV2ZW4gaWYgaW5zdGFsbCBwcm9jZXNzIGhhcyBub3QgZmluaXNoZWQuXG4gICAgICogQHBhcmFtIHtmdW5jdGlvbn0gW2NiXSBDYWxsZWQgb25jZSBwb3VjaCBwZXJzaXN0ZW5jZSByZXR1cm5zLlxuICAgICAqL1xuICAgIGdyYXBoOiBmdW5jdGlvbihkYXRhLCBvcHRzLCBjYikge1xuICAgICAgaWYgKHR5cGVvZiBvcHRzID09ICdmdW5jdGlvbicpIGNiID0gb3B0cztcbiAgICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgICAgdmFyIF9tYXAgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgb3ZlcnJpZGVzID0gb3B0cy5vdmVycmlkZTtcbiAgICAgICAgICBpZiAob3ZlcnJpZGVzKSB7XG4gICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KG92ZXJyaWRlcykpIG9wdHMub2JqZWN0cyA9IG92ZXJyaWRlcztcbiAgICAgICAgICAgIGVsc2Ugb3B0cy5vYmplY3RzID0gW292ZXJyaWRlc107XG4gICAgICAgICAgfVxuICAgICAgICAgIGRlbGV0ZSBvcHRzLm92ZXJyaWRlO1xuICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkoZGF0YSkpIHtcbiAgICAgICAgICAgIHRoaXMuX21hcEJ1bGsoZGF0YSwgb3B0cywgY2IpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9tYXBCdWxrKFtkYXRhXSwgb3B0cywgZnVuY3Rpb24oZXJyLCBvYmplY3RzKSB7XG4gICAgICAgICAgICAgIHZhciBvYmo7XG4gICAgICAgICAgICAgIGlmIChvYmplY3RzKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9iamVjdHMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICBvYmogPSBvYmplY3RzWzBdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBlcnIgPSBlcnIgPyAodXRpbC5pc0FycmF5KGRhdGEpID8gZXJyIDogKHV0aWwuaXNBcnJheShlcnIpID8gZXJyWzBdIDogZXJyKSkgOiBudWxsO1xuICAgICAgICAgICAgICBjYihlcnIsIG9iaik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICAgICAgaWYgKG9wdHMuX2lnbm9yZUluc3RhbGxlZCkge1xuICAgICAgICAgIF9tYXAoKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHNpZXN0YS5fYWZ0ZXJJbnN0YWxsKF9tYXApO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9LFxuICAgIF9tYXBCdWxrOiBmdW5jdGlvbihkYXRhLCBvcHRzLCBjYWxsYmFjaykge1xuICAgICAgXy5leHRlbmQob3B0cywge21vZGVsOiB0aGlzLCBkYXRhOiBkYXRhfSk7XG4gICAgICB2YXIgb3AgPSBuZXcgTWFwcGluZ09wZXJhdGlvbihvcHRzKTtcbiAgICAgIG9wLnN0YXJ0KGZ1bmN0aW9uKGVyciwgb2JqZWN0cykge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNhbGxiYWNrKG51bGwsIG9iamVjdHMgfHwgW10pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9LFxuICAgIF9jb3VudENhY2hlOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBjb2xsQ2FjaGUgPSBjYWNoZS5fbG9jYWxDYWNoZUJ5VHlwZVt0aGlzLmNvbGxlY3Rpb25OYW1lXSB8fCB7fTtcbiAgICAgIHZhciBtb2RlbENhY2hlID0gY29sbENhY2hlW3RoaXMubmFtZV0gfHwge307XG4gICAgICByZXR1cm4gXy5yZWR1Y2UoT2JqZWN0LmtleXMobW9kZWxDYWNoZSksIGZ1bmN0aW9uKG0sIGxvY2FsSWQpIHtcbiAgICAgICAgbVtsb2NhbElkXSA9IHt9O1xuICAgICAgICByZXR1cm4gbTtcbiAgICAgIH0sIHt9KTtcbiAgICB9LFxuICAgIGNvdW50OiBmdW5jdGlvbihjYikge1xuICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgICAgY2IobnVsbCwgT2JqZWN0LmtleXModGhpcy5fY291bnRDYWNoZSgpKS5sZW5ndGgpO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9LFxuICAgIF9kdW1wOiBmdW5jdGlvbihhc0pTT04pIHtcbiAgICAgIHZhciBkdW1wZWQgPSB7fTtcbiAgICAgIGR1bXBlZC5uYW1lID0gdGhpcy5uYW1lO1xuICAgICAgZHVtcGVkLmF0dHJpYnV0ZXMgPSB0aGlzLmF0dHJpYnV0ZXM7XG4gICAgICBkdW1wZWQuaWQgPSB0aGlzLmlkO1xuICAgICAgZHVtcGVkLmNvbGxlY3Rpb24gPSB0aGlzLmNvbGxlY3Rpb25OYW1lO1xuICAgICAgZHVtcGVkLnJlbGF0aW9uc2hpcHMgPSBfLm1hcCh0aGlzLnJlbGF0aW9uc2hpcHMsIGZ1bmN0aW9uKHIpIHtcbiAgICAgICAgcmV0dXJuIHIuaXNGb3J3YXJkID8gci5mb3J3YXJkTmFtZSA6IHIucmV2ZXJzZU5hbWU7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBhc0pTT04gPyB1dGlsLnByZXR0eVByaW50KGR1bXBlZCkgOiBkdW1wZWQ7XG4gICAgfSxcbiAgICB0b1N0cmluZzogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gJ01vZGVsWycgKyB0aGlzLm5hbWUgKyAnXSc7XG4gICAgfSxcbiAgICByZW1vdmVBbGw6IGZ1bmN0aW9uKGNiKSB7XG4gICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgICB0aGlzLmFsbCgpXG4gICAgICAgICAgLnRoZW4oZnVuY3Rpb24oaW5zdGFuY2VzKSB7XG4gICAgICAgICAgICBpbnN0YW5jZXMucmVtb3ZlKCk7XG4gICAgICAgICAgICBjYigpO1xuICAgICAgICAgIH0pXG4gICAgICAgICAgLmNhdGNoKGNiKTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfVxuXG4gIH0pO1xuXG4gIC8vIFN1YmNsYXNzaW5nXG4gIF8uZXh0ZW5kKE1vZGVsLnByb3RvdHlwZSwge1xuICAgIGNoaWxkOiBmdW5jdGlvbihuYW1lT3JPcHRzLCBvcHRzKSB7XG4gICAgICBpZiAodHlwZW9mIG5hbWVPck9wdHMgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgb3B0cy5uYW1lID0gbmFtZU9yT3B0cztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9wdHMgPSBuYW1lO1xuICAgICAgfVxuICAgICAgXy5leHRlbmQob3B0cywge1xuICAgICAgICBhdHRyaWJ1dGVzOiBBcnJheS5wcm90b3R5cGUuY29uY2F0LmNhbGwob3B0cy5hdHRyaWJ1dGVzIHx8IFtdLCB0aGlzLl9vcHRzLmF0dHJpYnV0ZXMpLFxuICAgICAgICByZWxhdGlvbnNoaXBzOiBfLmV4dGVuZChvcHRzLnJlbGF0aW9uc2hpcHMgfHwge30sIHRoaXMuX29wdHMucmVsYXRpb25zaGlwcyksXG4gICAgICAgIG1ldGhvZHM6IF8uZXh0ZW5kKF8uZXh0ZW5kKHt9LCB0aGlzLl9vcHRzLm1ldGhvZHMpIHx8IHt9LCBvcHRzLm1ldGhvZHMpLFxuICAgICAgICBzdGF0aWNzOiBfLmV4dGVuZChfLmV4dGVuZCh7fSwgdGhpcy5fb3B0cy5zdGF0aWNzKSB8fCB7fSwgb3B0cy5zdGF0aWNzKSxcbiAgICAgICAgcHJvcGVydGllczogXy5leHRlbmQoXy5leHRlbmQoe30sIHRoaXMuX29wdHMucHJvcGVydGllcykgfHwge30sIG9wdHMucHJvcGVydGllcyksXG4gICAgICAgIGlkOiBvcHRzLmlkIHx8IHRoaXMuX29wdHMuaWQsXG4gICAgICAgIGluaXQ6IG9wdHMuaW5pdCB8fCB0aGlzLl9vcHRzLmluaXQsXG4gICAgICAgIHJlbW92ZTogb3B0cy5yZW1vdmUgfHwgdGhpcy5fb3B0cy5yZW1vdmUsXG4gICAgICAgIHNlcmlhbGlzZTogb3B0cy5zZXJpYWxpc2UgfHwgdGhpcy5fb3B0cy5zZXJpYWxpc2UsXG4gICAgICAgIHNlcmlhbGlzZUZpZWxkOiBvcHRzLnNlcmlhbGlzZUZpZWxkIHx8IHRoaXMuX29wdHMuc2VyaWFsaXNlRmllbGQsXG4gICAgICAgIHBhcnNlQXR0cmlidXRlOiBvcHRzLnBhcnNlQXR0cmlidXRlIHx8IHRoaXMuX29wdHMucGFyc2VBdHRyaWJ1dGVcbiAgICAgIH0pO1xuXG4gICAgICBpZiAodGhpcy5fb3B0cy5zZXJpYWxpc2FibGVGaWVsZHMpIHtcbiAgICAgICAgb3B0cy5zZXJpYWxpc2FibGVGaWVsZHMgPSBBcnJheS5wcm90b3R5cGUuY29uY2F0LmFwcGx5KG9wdHMuc2VyaWFsaXNhYmxlRmllbGRzIHx8IFtdLCB0aGlzLl9vcHRzLnNlcmlhbGlzYWJsZUZpZWxkcyk7XG4gICAgICB9XG5cbiAgICAgIHZhciBtb2RlbCA9IHRoaXMuY29sbGVjdGlvbi5tb2RlbChvcHRzLm5hbWUsIG9wdHMpO1xuICAgICAgbW9kZWwucGFyZW50ID0gdGhpcztcbiAgICAgIHRoaXMuY2hpbGRyZW4ucHVzaChtb2RlbCk7XG4gICAgICByZXR1cm4gbW9kZWw7XG4gICAgfSxcbiAgICBpc0NoaWxkT2Y6IGZ1bmN0aW9uKHBhcmVudCkge1xuICAgICAgcmV0dXJuIHRoaXMucGFyZW50ID09IHBhcmVudDtcbiAgICB9LFxuICAgIGlzUGFyZW50T2Y6IGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgICByZXR1cm4gdGhpcy5jaGlsZHJlbi5pbmRleE9mKGNoaWxkKSA+IC0xO1xuICAgIH0sXG4gICAgaXNEZXNjZW5kYW50T2Y6IGZ1bmN0aW9uKGFuY2VzdG9yKSB7XG4gICAgICB2YXIgcGFyZW50ID0gdGhpcy5wYXJlbnQ7XG4gICAgICB3aGlsZSAocGFyZW50KSB7XG4gICAgICAgIGlmIChwYXJlbnQgPT0gYW5jZXN0b3IpIHJldHVybiB0cnVlO1xuICAgICAgICBwYXJlbnQgPSBwYXJlbnQucGFyZW50O1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0sXG4gICAgaXNBbmNlc3Rvck9mOiBmdW5jdGlvbihkZXNjZW5kYW50KSB7XG4gICAgICByZXR1cm4gdGhpcy5kZXNjZW5kYW50cy5pbmRleE9mKGRlc2NlbmRhbnQpID4gLTE7XG4gICAgfSxcbiAgICBoYXNBdHRyaWJ1dGVOYW1lZDogZnVuY3Rpb24oYXR0cmlidXRlTmFtZSkge1xuICAgICAgcmV0dXJuIHRoaXMuX2F0dHJpYnV0ZU5hbWVzLmluZGV4T2YoYXR0cmlidXRlTmFtZSkgPiAtMTtcbiAgICB9XG4gIH0pO1xuXG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBNb2RlbDtcblxufSkoKTtcbiIsIihmdW5jdGlvbigpIHtcbiAgdmFyIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgIGxvZyA9IHJlcXVpcmUoJy4vbG9nJykoJ2V2ZW50cycpLFxuICAgIGV4dGVuZCA9IHJlcXVpcmUoJy4vdXRpbCcpLl8uZXh0ZW5kLFxuICAgIGNvbGxlY3Rpb25SZWdpc3RyeSA9IHJlcXVpcmUoJy4vY29sbGVjdGlvblJlZ2lzdHJ5JykuQ29sbGVjdGlvblJlZ2lzdHJ5O1xuXG5cbiAgLyoqXG4gICAqIENvbnN0YW50cyB0aGF0IGRlc2NyaWJlIGNoYW5nZSBldmVudHMuXG4gICAqIFNldCA9PiBBIG5ldyB2YWx1ZSBpcyBhc3NpZ25lZCB0byBhbiBhdHRyaWJ1dGUvcmVsYXRpb25zaGlwXG4gICAqIFNwbGljZSA9PiBBbGwgamF2YXNjcmlwdCBhcnJheSBvcGVyYXRpb25zIGFyZSBkZXNjcmliZWQgYXMgc3BsaWNlcy5cbiAgICogRGVsZXRlID0+IFVzZWQgaW4gdGhlIGNhc2Ugd2hlcmUgb2JqZWN0cyBhcmUgcmVtb3ZlZCBmcm9tIGFuIGFycmF5LCBidXQgYXJyYXkgb3JkZXIgaXMgbm90IGtub3duIGluIGFkdmFuY2UuXG4gICAqIFJlbW92ZSA9PiBPYmplY3QgZGVsZXRpb24gZXZlbnRzXG4gICAqIE5ldyA9PiBPYmplY3QgY3JlYXRpb24gZXZlbnRzXG4gICAqIEB0eXBlIHtPYmplY3R9XG4gICAqL1xuICB2YXIgTW9kZWxFdmVudFR5cGUgPSB7XG4gICAgU2V0OiAnc2V0JyxcbiAgICBTcGxpY2U6ICdzcGxpY2UnLFxuICAgIE5ldzogJ25ldycsXG4gICAgUmVtb3ZlOiAncmVtb3ZlJ1xuICB9O1xuXG4gIC8qKlxuICAgKiBSZXByZXNlbnRzIGFuIGluZGl2aWR1YWwgY2hhbmdlLlxuICAgKiBAcGFyYW0gb3B0c1xuICAgKiBAY29uc3RydWN0b3JcbiAgICovXG4gIGZ1bmN0aW9uIE1vZGVsRXZlbnQob3B0cykge1xuICAgIHRoaXMuX29wdHMgPSBvcHRzIHx8IHt9O1xuICAgIE9iamVjdC5rZXlzKG9wdHMpLmZvckVhY2goZnVuY3Rpb24oaykge1xuICAgICAgdGhpc1trXSA9IG9wdHNba107XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfVxuXG5cbiAgTW9kZWxFdmVudC5wcm90b3R5cGUuX2R1bXAgPSBmdW5jdGlvbihwcmV0dHkpIHtcbiAgICB2YXIgZHVtcGVkID0ge307XG4gICAgZHVtcGVkLmNvbGxlY3Rpb24gPSAodHlwZW9mIHRoaXMuY29sbGVjdGlvbikgPT0gJ3N0cmluZycgPyB0aGlzLmNvbGxlY3Rpb24gOiB0aGlzLmNvbGxlY3Rpb24uX2R1bXAoKTtcbiAgICBkdW1wZWQubW9kZWwgPSAodHlwZW9mIHRoaXMubW9kZWwpID09ICdzdHJpbmcnID8gdGhpcy5tb2RlbCA6IHRoaXMubW9kZWwubmFtZTtcbiAgICBkdW1wZWQubG9jYWxJZCA9IHRoaXMubG9jYWxJZDtcbiAgICBkdW1wZWQuZmllbGQgPSB0aGlzLmZpZWxkO1xuICAgIGR1bXBlZC50eXBlID0gdGhpcy50eXBlO1xuICAgIGlmICh0aGlzLmluZGV4KSBkdW1wZWQuaW5kZXggPSB0aGlzLmluZGV4O1xuICAgIGlmICh0aGlzLmFkZGVkKSBkdW1wZWQuYWRkZWQgPSBfLm1hcCh0aGlzLmFkZGVkLCBmdW5jdGlvbih4KSB7cmV0dXJuIHguX2R1bXAoKX0pO1xuICAgIGlmICh0aGlzLnJlbW92ZWQpIGR1bXBlZC5yZW1vdmVkID0gXy5tYXAodGhpcy5yZW1vdmVkLCBmdW5jdGlvbih4KSB7cmV0dXJuIHguX2R1bXAoKX0pO1xuICAgIGlmICh0aGlzLm9sZCkgZHVtcGVkLm9sZCA9IHRoaXMub2xkO1xuICAgIGlmICh0aGlzLm5ldykgZHVtcGVkLm5ldyA9IHRoaXMubmV3O1xuICAgIHJldHVybiBwcmV0dHkgPyB1dGlsLnByZXR0eVByaW50KGR1bXBlZCkgOiBkdW1wZWQ7XG4gIH07XG5cbiAgZnVuY3Rpb24gYnJvYWRjYXN0RXZlbnQoY29sbGVjdGlvbk5hbWUsIG1vZGVsTmFtZSwgb3B0cykge1xuICAgIHZhciBnZW5lcmljRXZlbnQgPSAnU2llc3RhJyxcbiAgICAgIGNvbGxlY3Rpb24gPSBjb2xsZWN0aW9uUmVnaXN0cnlbY29sbGVjdGlvbk5hbWVdLFxuICAgICAgbW9kZWwgPSBjb2xsZWN0aW9uW21vZGVsTmFtZV07XG4gICAgaWYgKCFjb2xsZWN0aW9uKSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gc3VjaCBjb2xsZWN0aW9uIFwiJyArIGNvbGxlY3Rpb25OYW1lICsgJ1wiJyk7XG4gICAgaWYgKCFtb2RlbCkgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ05vIHN1Y2ggbW9kZWwgXCInICsgbW9kZWxOYW1lICsgJ1wiJyk7XG4gICAgdmFyIHNob3VsZEVtaXQgPSBvcHRzLm9iai5fZW1pdEV2ZW50cztcbiAgICAvLyBEb24ndCBlbWl0IHBvaW50bGVzcyBldmVudHMuXG4gICAgaWYgKHNob3VsZEVtaXQgJiYgJ25ldycgaW4gb3B0cyAmJiAnb2xkJyBpbiBvcHRzKSB7XG4gICAgICBpZiAob3B0cy5uZXcgaW5zdGFuY2VvZiBEYXRlICYmIG9wdHMub2xkIGluc3RhbmNlb2YgRGF0ZSkge1xuICAgICAgICBzaG91bGRFbWl0ID0gb3B0cy5uZXcuZ2V0VGltZSgpICE9IG9wdHMub2xkLmdldFRpbWUoKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBzaG91bGRFbWl0ID0gb3B0cy5uZXcgIT0gb3B0cy5vbGQ7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChzaG91bGRFbWl0KSB7XG4gICAgICBldmVudHMuZW1pdChnZW5lcmljRXZlbnQsIG9wdHMpO1xuICAgICAgaWYgKHNpZXN0YS5pbnN0YWxsZWQpIHtcbiAgICAgICAgdmFyIG1vZGVsRXZlbnQgPSBjb2xsZWN0aW9uTmFtZSArICc6JyArIG1vZGVsTmFtZSxcbiAgICAgICAgICBsb2NhbElkRXZlbnQgPSBvcHRzLmxvY2FsSWQ7XG4gICAgICAgIGV2ZW50cy5lbWl0KGNvbGxlY3Rpb25OYW1lLCBvcHRzKTtcbiAgICAgICAgZXZlbnRzLmVtaXQobW9kZWxFdmVudCwgb3B0cyk7XG4gICAgICAgIGV2ZW50cy5lbWl0KGxvY2FsSWRFdmVudCwgb3B0cyk7XG4gICAgICB9XG4gICAgICBpZiAobW9kZWwuaWQgJiYgb3B0cy5vYmpbbW9kZWwuaWRdKSBldmVudHMuZW1pdChjb2xsZWN0aW9uTmFtZSArICc6JyArIG1vZGVsTmFtZSArICc6JyArIG9wdHMub2JqW21vZGVsLmlkXSwgb3B0cyk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gdmFsaWRhdGVFdmVudE9wdHMob3B0cykge1xuICAgIGlmICghb3B0cy5tb2RlbCkgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ011c3QgcGFzcyBhIG1vZGVsJyk7XG4gICAgaWYgKCFvcHRzLmNvbGxlY3Rpb24pIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNdXN0IHBhc3MgYSBjb2xsZWN0aW9uJyk7XG4gICAgaWYgKCFvcHRzLmxvY2FsSWQpIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNdXN0IHBhc3MgYSBsb2NhbCBpZGVudGlmaWVyJyk7XG4gICAgaWYgKCFvcHRzLm9iaikgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ011c3QgcGFzcyB0aGUgb2JqZWN0Jyk7XG4gIH1cblxuICBmdW5jdGlvbiBlbWl0KG9wdHMpIHtcbiAgICB2YWxpZGF0ZUV2ZW50T3B0cyhvcHRzKTtcbiAgICB2YXIgY29sbGVjdGlvbiA9IG9wdHMuY29sbGVjdGlvbjtcbiAgICB2YXIgbW9kZWwgPSBvcHRzLm1vZGVsO1xuICAgIHZhciBjID0gbmV3IE1vZGVsRXZlbnQob3B0cyk7XG4gICAgYnJvYWRjYXN0RXZlbnQoY29sbGVjdGlvbiwgbW9kZWwsIGMpO1xuICAgIHJldHVybiBjO1xuICB9XG5cbiAgZXh0ZW5kKGV4cG9ydHMsIHtcbiAgICBNb2RlbEV2ZW50OiBNb2RlbEV2ZW50LFxuICAgIGVtaXQ6IGVtaXQsXG4gICAgdmFsaWRhdGVFdmVudE9wdHM6IHZhbGlkYXRlRXZlbnRPcHRzLFxuICAgIE1vZGVsRXZlbnRUeXBlOiBNb2RlbEV2ZW50VHlwZVxuICB9KTtcbn0pKCk7IiwiKGZ1bmN0aW9uKCkge1xuICB2YXIgbWlzYyA9IHJlcXVpcmUoJy4vbWlzYycpLFxuICAgIF8gPSByZXF1aXJlKCcuL3VuZGVyc2NvcmUnKTtcblxuICBmdW5jdGlvbiBkb1BhcmFsbGVsKGZuKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgcmV0dXJuIGZuLmFwcGx5KG51bGwsIFtlYWNoXS5jb25jYXQoYXJncykpO1xuICAgIH07XG4gIH1cblxuICB2YXIgbWFwID0gZG9QYXJhbGxlbChfYXN5bmNNYXApO1xuXG4gIHZhciByb290O1xuXG4gIGZ1bmN0aW9uIF9tYXAoYXJyLCBpdGVyYXRvcikge1xuICAgIGlmIChhcnIubWFwKSB7XG4gICAgICByZXR1cm4gYXJyLm1hcChpdGVyYXRvcik7XG4gICAgfVxuICAgIHZhciByZXN1bHRzID0gW107XG4gICAgZWFjaChhcnIsIGZ1bmN0aW9uKHgsIGksIGEpIHtcbiAgICAgIHJlc3VsdHMucHVzaChpdGVyYXRvcih4LCBpLCBhKSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH1cblxuICBmdW5jdGlvbiBfYXN5bmNNYXAoZWFjaGZuLCBhcnIsIGl0ZXJhdG9yLCBjYWxsYmFjaykge1xuICAgIGFyciA9IF9tYXAoYXJyLCBmdW5jdGlvbih4LCBpKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBpbmRleDogaSxcbiAgICAgICAgdmFsdWU6IHhcbiAgICAgIH07XG4gICAgfSk7XG4gICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgZWFjaGZuKGFyciwgZnVuY3Rpb24oeCwgY2FsbGJhY2spIHtcbiAgICAgICAgaXRlcmF0b3IoeC52YWx1ZSwgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICAgIGVhY2hmbihhcnIsIGZ1bmN0aW9uKHgsIGNhbGxiYWNrKSB7XG4gICAgICAgIGl0ZXJhdG9yKHgudmFsdWUsIGZ1bmN0aW9uKGVyciwgdikge1xuICAgICAgICAgIHJlc3VsdHNbeC5pbmRleF0gPSB2O1xuICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgIH0pO1xuICAgICAgfSwgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgIGNhbGxiYWNrKGVyciwgcmVzdWx0cyk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICB2YXIgbWFwU2VyaWVzID0gZG9TZXJpZXMoX2FzeW5jTWFwKTtcblxuICBmdW5jdGlvbiBkb1Nlcmllcyhmbikge1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgIHJldHVybiBmbi5hcHBseShudWxsLCBbZWFjaFNlcmllc10uY29uY2F0KGFyZ3MpKTtcbiAgICB9O1xuICB9XG5cblxuICBmdW5jdGlvbiBlYWNoU2VyaWVzKGFyciwgaXRlcmF0b3IsIGNhbGxiYWNrKSB7XG4gICAgY2FsbGJhY2sgPSBjYWxsYmFjayB8fCBmdW5jdGlvbigpIHt9O1xuICAgIGlmICghYXJyLmxlbmd0aCkge1xuICAgICAgcmV0dXJuIGNhbGxiYWNrKCk7XG4gICAgfVxuICAgIHZhciBjb21wbGV0ZWQgPSAwO1xuICAgIHZhciBpdGVyYXRlID0gZnVuY3Rpb24oKSB7XG4gICAgICBpdGVyYXRvcihhcnJbY29tcGxldGVkXSwgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgIGNhbGxiYWNrID0gZnVuY3Rpb24oKSB7fTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb21wbGV0ZWQgKz0gMTtcbiAgICAgICAgICBpZiAoY29tcGxldGVkID49IGFyci5sZW5ndGgpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGl0ZXJhdGUoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH07XG4gICAgaXRlcmF0ZSgpO1xuICB9XG5cblxuICBmdW5jdGlvbiBfZWFjaChhcnIsIGl0ZXJhdG9yKSB7XG4gICAgaWYgKGFyci5mb3JFYWNoKSB7XG4gICAgICByZXR1cm4gYXJyLmZvckVhY2goaXRlcmF0b3IpO1xuICAgIH1cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgaXRlcmF0b3IoYXJyW2ldLCBpLCBhcnIpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGVhY2goYXJyLCBpdGVyYXRvciwgY2FsbGJhY2spIHtcbiAgICBjYWxsYmFjayA9IGNhbGxiYWNrIHx8IGZ1bmN0aW9uKCkge307XG4gICAgaWYgKCFhcnIubGVuZ3RoKSB7XG4gICAgICByZXR1cm4gY2FsbGJhY2soKTtcbiAgICB9XG4gICAgdmFyIGNvbXBsZXRlZCA9IDA7XG4gICAgX2VhY2goYXJyLCBmdW5jdGlvbih4KSB7XG4gICAgICBpdGVyYXRvcih4LCBvbmx5X29uY2UoZG9uZSkpO1xuICAgIH0pO1xuXG4gICAgZnVuY3Rpb24gZG9uZShlcnIpIHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgY2FsbGJhY2sgPSBmdW5jdGlvbigpIHt9O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29tcGxldGVkICs9IDE7XG4gICAgICAgIGlmIChjb21wbGV0ZWQgPj0gYXJyLmxlbmd0aCkge1xuICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICB2YXIgX3BhcmFsbGVsID0gZnVuY3Rpb24oZWFjaGZuLCB0YXNrcywgY2FsbGJhY2spIHtcbiAgICBjYWxsYmFjayA9IGNhbGxiYWNrIHx8IGZ1bmN0aW9uKCkge307XG4gICAgaWYgKG1pc2MuaXNBcnJheSh0YXNrcykpIHtcbiAgICAgIGVhY2hmbi5tYXAodGFza3MsIGZ1bmN0aW9uKGZuLCBjYWxsYmFjaykge1xuICAgICAgICBpZiAoZm4pIHtcbiAgICAgICAgICBmbihmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICAgIGlmIChhcmdzLmxlbmd0aCA8PSAxKSB7XG4gICAgICAgICAgICAgIGFyZ3MgPSBhcmdzWzBdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FsbGJhY2suY2FsbChudWxsLCBlcnIsIGFyZ3MpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9LCBjYWxsYmFjayk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciByZXN1bHRzID0ge307XG4gICAgICBlYWNoZm4uZWFjaChPYmplY3Qua2V5cyh0YXNrcyksIGZ1bmN0aW9uKGssIGNhbGxiYWNrKSB7XG4gICAgICAgIHRhc2tzW2tdKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICBpZiAoYXJncy5sZW5ndGggPD0gMSkge1xuICAgICAgICAgICAgYXJncyA9IGFyZ3NbMF07XG4gICAgICAgICAgfVxuICAgICAgICAgIHJlc3VsdHNba10gPSBhcmdzO1xuICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgIH0pO1xuICAgICAgfSwgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgIGNhbGxiYWNrKGVyciwgcmVzdWx0cyk7XG4gICAgICB9KTtcbiAgICB9XG4gIH07XG5cbiAgZnVuY3Rpb24gc2VyaWVzKHRhc2tzLCBjYWxsYmFjaykge1xuICAgIGNhbGxiYWNrID0gY2FsbGJhY2sgfHwgZnVuY3Rpb24oKSB7fTtcbiAgICBpZiAobWlzYy5pc0FycmF5KHRhc2tzKSkge1xuICAgICAgbWFwU2VyaWVzKHRhc2tzLCBmdW5jdGlvbihmbiwgY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKGZuKSB7XG4gICAgICAgICAgZm4oZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgICAgICBpZiAoYXJncy5sZW5ndGggPD0gMSkge1xuICAgICAgICAgICAgICBhcmdzID0gYXJnc1swXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhbGxiYWNrLmNhbGwobnVsbCwgZXJyLCBhcmdzKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSwgY2FsbGJhY2spO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgcmVzdWx0cyA9IHt9O1xuICAgICAgZWFjaFNlcmllcyhfLmtleXModGFza3MpLCBmdW5jdGlvbihrLCBjYWxsYmFjaykge1xuICAgICAgICB0YXNrc1trXShmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoIDw9IDEpIHtcbiAgICAgICAgICAgIGFyZ3MgPSBhcmdzWzBdO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXN1bHRzW2tdID0gYXJncztcbiAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICB9KTtcbiAgICAgIH0sIGZ1bmN0aW9uKGVycikge1xuICAgICAgICBjYWxsYmFjayhlcnIsIHJlc3VsdHMpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gb25seV9vbmNlKGZuKSB7XG4gICAgdmFyIGNhbGxlZCA9IGZhbHNlO1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIGlmIChjYWxsZWQpIHRocm93IG5ldyBFcnJvcihcIkNhbGxiYWNrIHdhcyBhbHJlYWR5IGNhbGxlZC5cIik7XG4gICAgICBjYWxsZWQgPSB0cnVlO1xuICAgICAgZm4uYXBwbHkocm9vdCwgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBwYXJhbGxlbCh0YXNrcywgY2FsbGJhY2spIHtcbiAgICBfcGFyYWxsZWwoe1xuICAgICAgbWFwOiBtYXAsXG4gICAgICBlYWNoOiBlYWNoXG4gICAgfSwgdGFza3MsIGNhbGxiYWNrKTtcbiAgfVxuXG4gIG1vZHVsZS5leHBvcnRzID0ge1xuICAgIHNlcmllczogc2VyaWVzLFxuICAgIHBhcmFsbGVsOiBwYXJhbGxlbFxuICB9O1xufSkoKTsiLCIvKlxuICogVGhpcyBpcyBhIGNvbGxlY3Rpb24gb2YgdXRpbGl0aWVzIHRha2VuIGZyb20gbGlicmFyaWVzIHN1Y2ggYXMgYXN5bmMuanMsIHVuZGVyc2NvcmUuanMgZXRjLlxuICogQG1vZHVsZSB1dGlsXG4gKi9cblxuKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgXyA9IHJlcXVpcmUoJy4vdW5kZXJzY29yZScpLFxuICAgICAgICBhc3luYyA9IHJlcXVpcmUoJy4vYXN5bmMnKSxcbiAgICAgICAgbWlzYyA9IHJlcXVpcmUoJy4vbWlzYycpO1xuXG4gICAgXy5leHRlbmQobW9kdWxlLmV4cG9ydHMsIHtcbiAgICAgICAgXzogXyxcbiAgICAgICAgYXN5bmM6IGFzeW5jXG4gICAgfSk7XG4gICAgXy5leHRlbmQobW9kdWxlLmV4cG9ydHMsIG1pc2MpO1xuXG59KSgpOyIsIihmdW5jdGlvbigpIHtcbiAgdmFyIG9ic2VydmUgPSByZXF1aXJlKCcuLi8uLi92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZScpLlBsYXRmb3JtLFxuICAgIF8gPSByZXF1aXJlKCcuL3VuZGVyc2NvcmUnKSxcbiAgICBQcm9taXNlID0gcmVxdWlyZSgnbGllJyksXG4gICAgYXJnc2FycmF5ID0gcmVxdWlyZSgnYXJnc2FycmF5JyksXG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vLi4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yO1xuXG4gIC8vIFVzZWQgYnkgcGFyYW1OYW1lcyBmdW5jdGlvbi5cbiAgdmFyIEZOX0FSR1MgPSAvXmZ1bmN0aW9uXFxzKlteXFwoXSpcXChcXHMqKFteXFwpXSopXFwpL20sXG4gICAgRk5fQVJHX1NQTElUID0gLywvLFxuICAgIEZOX0FSRyA9IC9eXFxzKihfPykoLis/KVxcMVxccyokLyxcbiAgICBTVFJJUF9DT01NRU5UUyA9IC8oKFxcL1xcLy4qJCl8KFxcL1xcKltcXHNcXFNdKj9cXCpcXC8pKS9tZztcblxuICBmdW5jdGlvbiBjYihjYWxsYmFjaywgZGVmZXJyZWQpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oZXJyKSB7XG4gICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrLmFwcGx5KGNhbGxiYWNrLCBhcmd1bWVudHMpO1xuICAgICAgaWYgKGRlZmVycmVkKSB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlLmFwcGx5KGRlZmVycmVkLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG4gIH1cblxuICB2YXIgaXNBcnJheVNoaW0gPSBmdW5jdGlvbihvYmopIHtcbiAgICAgIHJldHVybiBfLnRvU3RyaW5nLmNhbGwob2JqKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbiAgICB9LFxuICAgIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5IHx8IGlzQXJyYXlTaGltLFxuICAgIGlzU3RyaW5nID0gZnVuY3Rpb24obykge1xuICAgICAgcmV0dXJuIHR5cGVvZiBvID09ICdzdHJpbmcnIHx8IG8gaW5zdGFuY2VvZiBTdHJpbmdcbiAgICB9O1xuICBfLmV4dGVuZChtb2R1bGUuZXhwb3J0cywge1xuICAgIGFyZ3NhcnJheTogYXJnc2FycmF5LFxuICAgIC8qKlxuICAgICAqIFBlcmZvcm1zIGRpcnR5IGNoZWNrL09iamVjdC5vYnNlcnZlIGNhbGxiYWNrcyBkZXBlbmRpbmcgb24gdGhlIGJyb3dzZXIuXG4gICAgICpcbiAgICAgKiBJZiBPYmplY3Qub2JzZXJ2ZSBpcyBwcmVzZW50LFxuICAgICAqIEBwYXJhbSBjYWxsYmFja1xuICAgICAqL1xuICAgIG5leHQ6IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICBvYnNlcnZlLnBlcmZvcm1NaWNyb3Rhc2tDaGVja3BvaW50KCk7XG4gICAgICBzZXRUaW1lb3V0KGNhbGxiYWNrKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBoYW5kbGVyIHRoYXQgYWN0cyB1cG9uIGEgY2FsbGJhY2sgb3IgYSBwcm9taXNlIGRlcGVuZGluZyBvbiB0aGUgcmVzdWx0IG9mIGEgZGlmZmVyZW50IGNhbGxiYWNrLlxuICAgICAqIEBwYXJhbSBjYWxsYmFja1xuICAgICAqIEBwYXJhbSBbZGVmZXJyZWRdXG4gICAgICogQHJldHVybnMge0Z1bmN0aW9ufVxuICAgICAqL1xuICAgIGNiOiBjYixcbiAgICBndWlkOiAoZnVuY3Rpb24oKSB7XG4gICAgICBmdW5jdGlvbiBzNCgpIHtcbiAgICAgICAgcmV0dXJuIE1hdGguZmxvb3IoKDEgKyBNYXRoLnJhbmRvbSgpKSAqIDB4MTAwMDApXG4gICAgICAgICAgLnRvU3RyaW5nKDE2KVxuICAgICAgICAgIC5zdWJzdHJpbmcoMSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHM0KCkgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArIHM0KCkgKyAnLScgK1xuICAgICAgICAgIHM0KCkgKyAnLScgKyBzNCgpICsgczQoKSArIHM0KCk7XG4gICAgICB9O1xuICAgIH0pKCksXG4gICAgYXNzZXJ0OiBmdW5jdGlvbihjb25kaXRpb24sIG1lc3NhZ2UsIGNvbnRleHQpIHtcbiAgICAgIGlmICghY29uZGl0aW9uKSB7XG4gICAgICAgIG1lc3NhZ2UgPSBtZXNzYWdlIHx8IFwiQXNzZXJ0aW9uIGZhaWxlZFwiO1xuICAgICAgICBjb250ZXh0ID0gY29udGV4dCB8fCB7fTtcbiAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IobWVzc2FnZSwgY29udGV4dCk7XG4gICAgICB9XG4gICAgfSxcbiAgICB0aGVuQnk6IChmdW5jdGlvbigpIHtcbiAgICAgIC8qIG1peGluIGZvciB0aGUgYHRoZW5CeWAgcHJvcGVydHkgKi9cbiAgICAgIGZ1bmN0aW9uIGV4dGVuZChmKSB7XG4gICAgICAgIGYudGhlbkJ5ID0gdGI7XG4gICAgICAgIHJldHVybiBmO1xuICAgICAgfVxuXG4gICAgICAvKiBhZGRzIGEgc2Vjb25kYXJ5IGNvbXBhcmUgZnVuY3Rpb24gdG8gdGhlIHRhcmdldCBmdW5jdGlvbiAoYHRoaXNgIGNvbnRleHQpXG4gICAgICAgd2hpY2ggaXMgYXBwbGllZCBpbiBjYXNlIHRoZSBmaXJzdCBvbmUgcmV0dXJucyAwIChlcXVhbClcbiAgICAgICByZXR1cm5zIGEgbmV3IGNvbXBhcmUgZnVuY3Rpb24sIHdoaWNoIGhhcyBhIGB0aGVuQnlgIG1ldGhvZCBhcyB3ZWxsICovXG4gICAgICBmdW5jdGlvbiB0Yih5KSB7XG4gICAgICAgIHZhciB4ID0gdGhpcztcbiAgICAgICAgcmV0dXJuIGV4dGVuZChmdW5jdGlvbihhLCBiKSB7XG4gICAgICAgICAgcmV0dXJuIHgoYSwgYikgfHwgeShhLCBiKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBleHRlbmQ7XG4gICAgfSkoKSxcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eTogZnVuY3Rpb24ocHJvcGVydHksIHN1Yk9iaiwgaW5uZXJQcm9wZXJ0eSkge1xuICAgICAgcmV0dXJuIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBwcm9wZXJ0eSwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGlmIChpbm5lclByb3BlcnR5KSB7XG4gICAgICAgICAgICByZXR1cm4gc3ViT2JqW2lubmVyUHJvcGVydHldO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBzdWJPYmpbcHJvcGVydHldO1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICAgIGlmIChpbm5lclByb3BlcnR5KSB7XG4gICAgICAgICAgICBzdWJPYmpbaW5uZXJQcm9wZXJ0eV0gPSB2YWx1ZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBzdWJPYmpbcHJvcGVydHldID0gdmFsdWU7XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgIH0pO1xuICAgIH0sXG4gICAgZGVmaW5lU3ViUHJvcGVydHlOb1NldDogZnVuY3Rpb24ocHJvcGVydHksIHN1Yk9iaiwgaW5uZXJQcm9wZXJ0eSkge1xuICAgICAgcmV0dXJuIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBwcm9wZXJ0eSwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGlmIChpbm5lclByb3BlcnR5KSB7XG4gICAgICAgICAgICByZXR1cm4gc3ViT2JqW2lubmVyUHJvcGVydHldO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBzdWJPYmpbcHJvcGVydHldO1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICB9KTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFRPRE86IFRoaXMgaXMgYmxvb2R5IHVnbHkuXG4gICAgICogUHJldHR5IGRhbW4gdXNlZnVsIHRvIGJlIGFibGUgdG8gYWNjZXNzIHRoZSBib3VuZCBvYmplY3Qgb24gYSBmdW5jdGlvbiB0aG8uXG4gICAgICogU2VlOiBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzE0MzA3MjY0L3doYXQtb2JqZWN0LWphdmFzY3JpcHQtZnVuY3Rpb24taXMtYm91bmQtdG8td2hhdC1pcy1pdHMtdGhpc1xuICAgICAqL1xuICAgIF9wYXRjaEJpbmQ6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIF9iaW5kID0gRnVuY3Rpb24ucHJvdG90eXBlLmFwcGx5LmJpbmQoRnVuY3Rpb24ucHJvdG90eXBlLmJpbmQpO1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KEZ1bmN0aW9uLnByb3RvdHlwZSwgJ2JpbmQnLCB7XG4gICAgICAgIHZhbHVlOiBmdW5jdGlvbihvYmopIHtcbiAgICAgICAgICB2YXIgYm91bmRGdW5jdGlvbiA9IF9iaW5kKHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGJvdW5kRnVuY3Rpb24sICdfX3NpZXN0YV9ib3VuZF9vYmplY3QnLCB7XG4gICAgICAgICAgICB2YWx1ZTogb2JqLFxuICAgICAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHJldHVybiBib3VuZEZ1bmN0aW9uO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9LFxuICAgIFByb21pc2U6IFByb21pc2UsXG4gICAgcHJvbWlzZTogZnVuY3Rpb24oY2IsIGZuKSB7XG4gICAgICBjYiA9IGNiIHx8IGZ1bmN0aW9uKCkge307XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIHZhciBfY2IgPSBhcmdzYXJyYXkoZnVuY3Rpb24oYXJncykge1xuICAgICAgICAgIHZhciBlcnIgPSBhcmdzWzBdLFxuICAgICAgICAgICAgcmVzdCA9IGFyZ3Muc2xpY2UoMSk7XG4gICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdVbmNhdWdodCBlcnJvciBkdXJpbmcgcHJvbWlzZSByZWplY3Rpb24nLCBlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICByZXNvbHZlKHJlc3RbMF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICByZWplY3QoZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdVbmNhdWdodCBlcnJvciBkdXJpbmcgcHJvbWlzZSByZWplY3Rpb24nLCBlKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICB2YXIgYm91bmQgPSBjYlsnX19zaWVzdGFfYm91bmRfb2JqZWN0J10gfHwgY2I7IC8vIFByZXNlcnZlIGJvdW5kIG9iamVjdC5cbiAgICAgICAgICBjYi5hcHBseShib3VuZCwgYXJncyk7XG4gICAgICAgIH0pO1xuICAgICAgICBmbihfY2IpO1xuICAgICAgfSlcbiAgICB9LFxuICAgIHN1YlByb3BlcnRpZXM6IGZ1bmN0aW9uKG9iaiwgc3ViT2JqLCBwcm9wZXJ0aWVzKSB7XG4gICAgICBpZiAoIWlzQXJyYXkocHJvcGVydGllcykpIHtcbiAgICAgICAgcHJvcGVydGllcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgICB9XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHByb3BlcnRpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgKGZ1bmN0aW9uKHByb3BlcnR5KSB7XG4gICAgICAgICAgdmFyIG9wdHMgPSB7XG4gICAgICAgICAgICBzZXQ6IGZhbHNlLFxuICAgICAgICAgICAgbmFtZTogcHJvcGVydHksXG4gICAgICAgICAgICBwcm9wZXJ0eTogcHJvcGVydHlcbiAgICAgICAgICB9O1xuICAgICAgICAgIGlmICghaXNTdHJpbmcocHJvcGVydHkpKSB7XG4gICAgICAgICAgICBfLmV4dGVuZChvcHRzLCBwcm9wZXJ0eSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHZhciBkZXNjID0ge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHN1Yk9ialtvcHRzLnByb3BlcnR5XTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICAgICAgfTtcbiAgICAgICAgICBpZiAob3B0cy5zZXQpIHtcbiAgICAgICAgICAgIGRlc2Muc2V0ID0gZnVuY3Rpb24odikge1xuICAgICAgICAgICAgICBzdWJPYmpbb3B0cy5wcm9wZXJ0eV0gPSB2O1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9XG4gICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgb3B0cy5uYW1lLCBkZXNjKTtcbiAgICAgICAgfSkocHJvcGVydGllc1tpXSk7XG4gICAgICB9XG4gICAgfSxcbiAgICBjYXBpdGFsaXNlRmlyc3RMZXR0ZXI6IGZ1bmN0aW9uKHN0cmluZykge1xuICAgICAgcmV0dXJuIHN0cmluZy5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHN0cmluZy5zbGljZSgxKTtcbiAgICB9LFxuICAgIGV4dGVuZEZyb21PcHRzOiBmdW5jdGlvbihvYmosIG9wdHMsIGRlZmF1bHRzLCBlcnJvck9uVW5rbm93bikge1xuICAgICAgZXJyb3JPblVua25vd24gPSBlcnJvck9uVW5rbm93biA9PSB1bmRlZmluZWQgPyB0cnVlIDogZXJyb3JPblVua25vd247XG4gICAgICBpZiAoZXJyb3JPblVua25vd24pIHtcbiAgICAgICAgdmFyIGRlZmF1bHRLZXlzID0gT2JqZWN0LmtleXMoZGVmYXVsdHMpLFxuICAgICAgICAgIG9wdHNLZXlzID0gT2JqZWN0LmtleXMob3B0cyk7XG4gICAgICAgIHZhciB1bmtub3duS2V5cyA9IG9wdHNLZXlzLmZpbHRlcihmdW5jdGlvbihuKSB7XG4gICAgICAgICAgcmV0dXJuIGRlZmF1bHRLZXlzLmluZGV4T2YobikgPT0gLTFcbiAgICAgICAgfSk7XG4gICAgICAgIGlmICh1bmtub3duS2V5cy5sZW5ndGgpIHRocm93IEVycm9yKCdVbmtub3duIG9wdGlvbnM6ICcgKyB1bmtub3duS2V5cy50b1N0cmluZygpKTtcbiAgICAgIH1cbiAgICAgIC8vIEFwcGx5IGFueSBmdW5jdGlvbnMgc3BlY2lmaWVkIGluIHRoZSBkZWZhdWx0cy5cbiAgICAgIF8uZWFjaChPYmplY3Qua2V5cyhkZWZhdWx0cyksIGZ1bmN0aW9uKGspIHtcbiAgICAgICAgdmFyIGQgPSBkZWZhdWx0c1trXTtcbiAgICAgICAgaWYgKHR5cGVvZiBkID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICBkZWZhdWx0c1trXSA9IGQob3B0c1trXSk7XG4gICAgICAgICAgZGVsZXRlIG9wdHNba107XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgXy5leHRlbmQoZGVmYXVsdHMsIG9wdHMpO1xuICAgICAgXy5leHRlbmQob2JqLCBkZWZhdWx0cyk7XG4gICAgfSxcbiAgICBpc1N0cmluZzogaXNTdHJpbmcsXG4gICAgaXNBcnJheTogaXNBcnJheSxcbiAgICBwcmV0dHlQcmludDogZnVuY3Rpb24obykge1xuICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KG8sIG51bGwsIDQpO1xuICAgIH0sXG4gICAgZmxhdHRlbkFycmF5OiBmdW5jdGlvbihhcnIpIHtcbiAgICAgIHJldHVybiBfLnJlZHVjZShhcnIsIGZ1bmN0aW9uKG1lbW8sIGUpIHtcbiAgICAgICAgaWYgKGlzQXJyYXkoZSkpIHtcbiAgICAgICAgICBtZW1vID0gbWVtby5jb25jYXQoZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbWVtby5wdXNoKGUpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgfSwgW10pO1xuICAgIH0sXG4gICAgdW5mbGF0dGVuQXJyYXk6IGZ1bmN0aW9uKGFyciwgbW9kZWxBcnIpIHtcbiAgICAgIHZhciBuID0gMDtcbiAgICAgIHZhciB1bmZsYXR0ZW5lZCA9IFtdO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBtb2RlbEFyci5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoaXNBcnJheShtb2RlbEFycltpXSkpIHtcbiAgICAgICAgICB2YXIgbmV3QXJyID0gW107XG4gICAgICAgICAgdW5mbGF0dGVuZWRbaV0gPSBuZXdBcnI7XG4gICAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBtb2RlbEFycltpXS5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgbmV3QXJyLnB1c2goYXJyW25dKTtcbiAgICAgICAgICAgIG4rKztcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdW5mbGF0dGVuZWRbaV0gPSBhcnJbbl07XG4gICAgICAgICAgbisrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gdW5mbGF0dGVuZWQ7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZXR1cm4gdGhlIHBhcmFtZXRlciBuYW1lcyBvZiBhIGZ1bmN0aW9uLlxuICAgICAqIE5vdGU6IGFkYXB0ZWQgZnJvbSBBbmd1bGFySlMgZGVwZW5kZW5jeSBpbmplY3Rpb24gOilcbiAgICAgKiBAcGFyYW0gZm5cbiAgICAgKi9cbiAgICBwYXJhbU5hbWVzOiBmdW5jdGlvbihmbikge1xuICAgICAgLy8gVE9ETzogSXMgdGhlcmUgYSBtb3JlIHJvYnVzdCB3YXkgb2YgZG9pbmcgdGhpcz9cbiAgICAgIHZhciBwYXJhbXMgPSBbXSxcbiAgICAgICAgZm5UZXh0LFxuICAgICAgICBhcmdEZWNsO1xuICAgICAgZm5UZXh0ID0gZm4udG9TdHJpbmcoKS5yZXBsYWNlKFNUUklQX0NPTU1FTlRTLCAnJyk7XG4gICAgICBhcmdEZWNsID0gZm5UZXh0Lm1hdGNoKEZOX0FSR1MpO1xuXG4gICAgICBhcmdEZWNsWzFdLnNwbGl0KEZOX0FSR19TUExJVCkuZm9yRWFjaChmdW5jdGlvbihhcmcpIHtcbiAgICAgICAgYXJnLnJlcGxhY2UoRk5fQVJHLCBmdW5jdGlvbihhbGwsIHVuZGVyc2NvcmUsIG5hbWUpIHtcbiAgICAgICAgICBwYXJhbXMucHVzaChuYW1lKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBwYXJhbXM7XG4gICAgfVxuICB9KTtcbn0pKCk7IiwiLyoqXG4gKiBPZnRlbiB1c2VkIGZ1bmN0aW9ucyBmcm9tIHVuZGVyc2NvcmUsIHB1bGxlZCBvdXQgZm9yIGJyZXZpdHkuXG4gKiBAbW9kdWxlIHVuZGVyc2NvcmVcbiAqL1xuXG4oZnVuY3Rpb24gKCkge1xuICAgIHZhciBfID0ge30sXG4gICAgICAgIEFycmF5UHJvdG8gPSBBcnJheS5wcm90b3R5cGUsXG4gICAgICAgIEZ1bmNQcm90byA9IEZ1bmN0aW9uLnByb3RvdHlwZSxcbiAgICAgICAgbmF0aXZlRm9yRWFjaCA9IEFycmF5UHJvdG8uZm9yRWFjaCxcbiAgICAgICAgbmF0aXZlTWFwID0gQXJyYXlQcm90by5tYXAsXG4gICAgICAgIG5hdGl2ZVJlZHVjZSA9IEFycmF5UHJvdG8ucmVkdWNlLFxuICAgICAgICBuYXRpdmVCaW5kID0gRnVuY1Byb3RvLmJpbmQsXG4gICAgICAgIHNsaWNlID0gQXJyYXlQcm90by5zbGljZSxcbiAgICAgICAgYnJlYWtlciA9IHt9LFxuICAgICAgICBjdG9yID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB9O1xuXG4gICAgZnVuY3Rpb24ga2V5cyhvYmopIHtcbiAgICAgICAgaWYgKE9iamVjdC5rZXlzKSB7XG4gICAgICAgICAgICByZXR1cm4gT2JqZWN0LmtleXMob2JqKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIga2V5cyA9IFtdO1xuICAgICAgICBmb3IgKHZhciBrIGluIG9iaikge1xuICAgICAgICAgICAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShrKSkge1xuICAgICAgICAgICAgICAgIGtleXMucHVzaChrKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4ga2V5cztcbiAgICB9XG5cbiAgICBfLmtleXMgPSBrZXlzO1xuXG4gICAgXy5lYWNoID0gXy5mb3JFYWNoID0gZnVuY3Rpb24gKG9iaiwgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgICAgICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gb2JqO1xuICAgICAgICBpZiAobmF0aXZlRm9yRWFjaCAmJiBvYmouZm9yRWFjaCA9PT0gbmF0aXZlRm9yRWFjaCkge1xuICAgICAgICAgICAgb2JqLmZvckVhY2goaXRlcmF0b3IsIGNvbnRleHQpO1xuICAgICAgICB9IGVsc2UgaWYgKG9iai5sZW5ndGggPT09ICtvYmoubGVuZ3RoKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0gb2JqLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgb2JqW2ldLCBpLCBvYmopID09PSBicmVha2VyKSByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIga2V5cyA9IF8ua2V5cyhvYmopO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGtleXMubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoaXRlcmF0b3IuY2FsbChjb250ZXh0LCBvYmpba2V5c1tpXV0sIGtleXNbaV0sIG9iaikgPT09IGJyZWFrZXIpIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb2JqO1xuICAgIH07XG5cbiAgICAvLyBSZXR1cm4gdGhlIHJlc3VsdHMgb2YgYXBwbHlpbmcgdGhlIGl0ZXJhdG9yIHRvIGVhY2ggZWxlbWVudC5cbiAgICAvLyBEZWxlZ2F0ZXMgdG8gKipFQ01BU2NyaXB0IDUqKidzIG5hdGl2ZSBgbWFwYCBpZiBhdmFpbGFibGUuXG4gICAgXy5tYXAgPSBfLmNvbGxlY3QgPSBmdW5jdGlvbiAob2JqLCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgICAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgICAgICBpZiAob2JqID09IG51bGwpIHJldHVybiByZXN1bHRzO1xuICAgICAgICBpZiAobmF0aXZlTWFwICYmIG9iai5tYXAgPT09IG5hdGl2ZU1hcCkgcmV0dXJuIG9iai5tYXAoaXRlcmF0b3IsIGNvbnRleHQpO1xuICAgICAgICBfLmVhY2gob2JqLCBmdW5jdGlvbiAodmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICAgICAgICByZXN1bHRzLnB1c2goaXRlcmF0b3IuY2FsbChjb250ZXh0LCB2YWx1ZSwgaW5kZXgsIGxpc3QpKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiByZXN1bHRzO1xuICAgIH07XG5cbiAgICAvLyBJbnRlcm5hbCBmdW5jdGlvbiB0aGF0IHJldHVybnMgYW4gZWZmaWNpZW50IChmb3IgY3VycmVudCBlbmdpbmVzKSB2ZXJzaW9uXG4gICAgLy8gb2YgdGhlIHBhc3NlZC1pbiBjYWxsYmFjaywgdG8gYmUgcmVwZWF0ZWRseSBhcHBsaWVkIGluIG90aGVyIFVuZGVyc2NvcmVcbiAgICAvLyBmdW5jdGlvbnMuXG4gICAgdmFyIGNyZWF0ZUNhbGxiYWNrID0gZnVuY3Rpb24gKGZ1bmMsIGNvbnRleHQsIGFyZ0NvdW50KSB7XG4gICAgICAgIGlmIChjb250ZXh0ID09PSB2b2lkIDApIHJldHVybiBmdW5jO1xuICAgICAgICBzd2l0Y2ggKGFyZ0NvdW50ID09IG51bGwgPyAzIDogYXJnQ291bnQpIHtcbiAgICAgICAgICAgIGNhc2UgMTpcbiAgICAgICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmdW5jLmNhbGwoY29udGV4dCwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICh2YWx1ZSwgb3RoZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmMuY2FsbChjb250ZXh0LCB2YWx1ZSwgb3RoZXIpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICh2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmMuY2FsbChjb250ZXh0LCB2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICBjYXNlIDQ6XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChhY2N1bXVsYXRvciwgdmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmdW5jLmNhbGwoY29udGV4dCwgYWNjdW11bGF0b3IsIHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbik7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkoY29udGV4dCwgYXJndW1lbnRzKTtcbiAgICAgICAgfTtcbiAgICB9O1xuXG4gICAgLy8gUnVuIGEgZnVuY3Rpb24gKipuKiogdGltZXMuXG4gICAgXy50aW1lcyA9IGZ1bmN0aW9uIChuLCBpdGVyYXRlZSwgY29udGV4dCkge1xuICAgICAgICB2YXIgYWNjdW0gPSBuZXcgQXJyYXkoTWF0aC5tYXgoMCwgbikpO1xuICAgICAgICBpdGVyYXRlZSA9IGNyZWF0ZUNhbGxiYWNrKGl0ZXJhdGVlLCBjb250ZXh0LCAxKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBuOyBpKyspIGFjY3VtW2ldID0gaXRlcmF0ZWUoaSk7XG4gICAgICAgIHJldHVybiBhY2N1bTtcbiAgICB9O1xuXG4gICAgLy8gUGFydGlhbGx5IGFwcGx5IGEgZnVuY3Rpb24gYnkgY3JlYXRpbmcgYSB2ZXJzaW9uIHRoYXQgaGFzIGhhZCBzb21lIG9mIGl0c1xuICAgIC8vIGFyZ3VtZW50cyBwcmUtZmlsbGVkLCB3aXRob3V0IGNoYW5naW5nIGl0cyBkeW5hbWljIGB0aGlzYCBjb250ZXh0LiBfIGFjdHNcbiAgICAvLyBhcyBhIHBsYWNlaG9sZGVyLCBhbGxvd2luZyBhbnkgY29tYmluYXRpb24gb2YgYXJndW1lbnRzIHRvIGJlIHByZS1maWxsZWQuXG4gICAgXy5wYXJ0aWFsID0gZnVuY3Rpb24gKGZ1bmMpIHtcbiAgICAgICAgdmFyIGJvdW5kQXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBwb3NpdGlvbiA9IDA7XG4gICAgICAgICAgICB2YXIgYXJncyA9IGJvdW5kQXJncy5zbGljZSgpO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGFyZ3MubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoYXJnc1tpXSA9PT0gXykgYXJnc1tpXSA9IGFyZ3VtZW50c1twb3NpdGlvbisrXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHdoaWxlIChwb3NpdGlvbiA8IGFyZ3VtZW50cy5sZW5ndGgpIGFyZ3MucHVzaChhcmd1bWVudHNbcG9zaXRpb24rK10pO1xuICAgICAgICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkodGhpcywgYXJncyk7XG4gICAgICAgIH07XG4gICAgfTtcblxuICAgIC8vIENvbnZlbmllbmNlIHZlcnNpb24gb2YgYSBjb21tb24gdXNlIGNhc2Ugb2YgYG1hcGA6IGZldGNoaW5nIGEgcHJvcGVydHkuXG4gICAgXy5wbHVjayA9IGZ1bmN0aW9uIChvYmosIGtleSkge1xuICAgICAgICByZXR1cm4gXy5tYXAob2JqLCBfLnByb3BlcnR5KGtleSkpO1xuICAgIH07XG5cbiAgICB2YXIgcmVkdWNlRXJyb3IgPSAnUmVkdWNlIG9mIGVtcHR5IGFycmF5IHdpdGggbm8gaW5pdGlhbCB2YWx1ZSc7XG5cbiAgICAvLyAqKlJlZHVjZSoqIGJ1aWxkcyB1cCBhIHNpbmdsZSByZXN1bHQgZnJvbSBhIGxpc3Qgb2YgdmFsdWVzLCBha2EgYGluamVjdGAsXG4gICAgLy8gb3IgYGZvbGRsYC4gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYHJlZHVjZWAgaWYgYXZhaWxhYmxlLlxuICAgIF8ucmVkdWNlID0gXy5mb2xkbCA9IF8uaW5qZWN0ID0gZnVuY3Rpb24gKG9iaiwgaXRlcmF0b3IsIG1lbW8sIGNvbnRleHQpIHtcbiAgICAgICAgdmFyIGluaXRpYWwgPSBhcmd1bWVudHMubGVuZ3RoID4gMjtcbiAgICAgICAgaWYgKG9iaiA9PSBudWxsKSBvYmogPSBbXTtcbiAgICAgICAgaWYgKG5hdGl2ZVJlZHVjZSAmJiBvYmoucmVkdWNlID09PSBuYXRpdmVSZWR1Y2UpIHtcbiAgICAgICAgICAgIGlmIChjb250ZXh0KSBpdGVyYXRvciA9IF8uYmluZChpdGVyYXRvciwgY29udGV4dCk7XG4gICAgICAgICAgICByZXR1cm4gaW5pdGlhbCA/IG9iai5yZWR1Y2UoaXRlcmF0b3IsIG1lbW8pIDogb2JqLnJlZHVjZShpdGVyYXRvcik7XG4gICAgICAgIH1cbiAgICAgICAgXy5lYWNoKG9iaiwgZnVuY3Rpb24gKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgICAgICAgaWYgKCFpbml0aWFsKSB7XG4gICAgICAgICAgICAgICAgbWVtbyA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIGluaXRpYWwgPSB0cnVlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBtZW1vID0gaXRlcmF0b3IuY2FsbChjb250ZXh0LCBtZW1vLCB2YWx1ZSwgaW5kZXgsIGxpc3QpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKCFpbml0aWFsKSB0aHJvdyBuZXcgVHlwZUVycm9yKHJlZHVjZUVycm9yKTtcbiAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgfTtcblxuICAgIF8ucHJvcGVydHkgPSBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgICAgICByZXR1cm4gb2JqW2tleV07XG4gICAgICAgIH07XG4gICAgfTtcblxuICAgIC8vIE9wdGltaXplIGBpc0Z1bmN0aW9uYCBpZiBhcHByb3ByaWF0ZS5cbiAgICBpZiAodHlwZW9mKC8uLykgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgXy5pc0Z1bmN0aW9uID0gZnVuY3Rpb24gKG9iaikge1xuICAgICAgICAgICAgcmV0dXJuIHR5cGVvZiBvYmogPT09ICdmdW5jdGlvbic7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgXy5pc09iamVjdCA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgdmFyIHR5cGUgPSB0eXBlb2Ygb2JqO1xuICAgICAgICByZXR1cm4gdHlwZSA9PT0gJ2Z1bmN0aW9uJyB8fCB0eXBlID09PSAnb2JqZWN0JyAmJiAhIW9iajtcbiAgICB9O1xuXG4gICAgLy8gQW4gaW50ZXJuYWwgZnVuY3Rpb24gdG8gZ2VuZXJhdGUgbG9va3VwIGl0ZXJhdG9ycy5cbiAgICB2YXIgbG9va3VwSXRlcmF0b3IgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlID09IG51bGwpIHJldHVybiBfLmlkZW50aXR5O1xuICAgICAgICBpZiAoXy5pc0Z1bmN0aW9uKHZhbHVlKSkgcmV0dXJuIHZhbHVlO1xuICAgICAgICByZXR1cm4gXy5wcm9wZXJ0eSh2YWx1ZSk7XG4gICAgfTtcblxuICAgIC8vIFNvcnQgdGhlIG9iamVjdCdzIHZhbHVlcyBieSBhIGNyaXRlcmlvbiBwcm9kdWNlZCBieSBhbiBpdGVyYXRvci5cbiAgICBfLnNvcnRCeSA9IGZ1bmN0aW9uIChvYmosIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgICAgIGl0ZXJhdG9yID0gbG9va3VwSXRlcmF0b3IoaXRlcmF0b3IpO1xuICAgICAgICByZXR1cm4gXy5wbHVjayhfLm1hcChvYmosIGZ1bmN0aW9uICh2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgdmFsdWU6IHZhbHVlLFxuICAgICAgICAgICAgICAgIGluZGV4OiBpbmRleCxcbiAgICAgICAgICAgICAgICBjcml0ZXJpYTogaXRlcmF0b3IuY2FsbChjb250ZXh0LCB2YWx1ZSwgaW5kZXgsIGxpc3QpXG4gICAgICAgICAgICB9O1xuICAgICAgICB9KS5zb3J0KGZ1bmN0aW9uIChsZWZ0LCByaWdodCkge1xuICAgICAgICAgICAgdmFyIGEgPSBsZWZ0LmNyaXRlcmlhO1xuICAgICAgICAgICAgdmFyIGIgPSByaWdodC5jcml0ZXJpYTtcbiAgICAgICAgICAgIGlmIChhICE9PSBiKSB7XG4gICAgICAgICAgICAgICAgaWYgKGEgPiBiIHx8IGEgPT09IHZvaWQgMCkgcmV0dXJuIDE7XG4gICAgICAgICAgICAgICAgaWYgKGEgPCBiIHx8IGIgPT09IHZvaWQgMCkgcmV0dXJuIC0xO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGxlZnQuaW5kZXggLSByaWdodC5pbmRleDtcbiAgICAgICAgfSksICd2YWx1ZScpO1xuICAgIH07XG5cblxuICAgIC8vIENyZWF0ZSBhIGZ1bmN0aW9uIGJvdW5kIHRvIGEgZ2l2ZW4gb2JqZWN0IChhc3NpZ25pbmcgYHRoaXNgLCBhbmQgYXJndW1lbnRzLFxuICAgIC8vIG9wdGlvbmFsbHkpLiBEZWxlZ2F0ZXMgdG8gKipFQ01BU2NyaXB0IDUqKidzIG5hdGl2ZSBgRnVuY3Rpb24uYmluZGAgaWZcbiAgICAvLyBhdmFpbGFibGUuXG4gICAgXy5iaW5kID0gZnVuY3Rpb24gKGZ1bmMsIGNvbnRleHQpIHtcbiAgICAgICAgdmFyIGFyZ3MsIGJvdW5kO1xuICAgICAgICBpZiAobmF0aXZlQmluZCAmJiBmdW5jLmJpbmQgPT09IG5hdGl2ZUJpbmQpIHJldHVybiBuYXRpdmVCaW5kLmFwcGx5KGZ1bmMsIHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSk7XG4gICAgICAgIGlmICghXy5pc0Z1bmN0aW9uKGZ1bmMpKSB0aHJvdyBuZXcgVHlwZUVycm9yO1xuICAgICAgICBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgICAgICByZXR1cm4gYm91bmQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgYm91bmQpKSByZXR1cm4gZnVuYy5hcHBseShjb250ZXh0LCBhcmdzLmNvbmNhdChzbGljZS5jYWxsKGFyZ3VtZW50cykpKTtcbiAgICAgICAgICAgIGN0b3IucHJvdG90eXBlID0gZnVuYy5wcm90b3R5cGU7XG4gICAgICAgICAgICB2YXIgc2VsZiA9IG5ldyBjdG9yO1xuICAgICAgICAgICAgY3Rvci5wcm90b3R5cGUgPSBudWxsO1xuICAgICAgICAgICAgdVxuICAgICAgICAgICAgdmFyIHJlc3VsdCA9IGZ1bmMuYXBwbHkoc2VsZiwgYXJncy5jb25jYXQoc2xpY2UuY2FsbChhcmd1bWVudHMpKSk7XG4gICAgICAgICAgICBpZiAoT2JqZWN0KHJlc3VsdCkgPT09IHJlc3VsdCkgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgICAgIHJldHVybiBzZWxmO1xuICAgICAgICB9O1xuICAgIH07XG5cbiAgICBfLmlkZW50aXR5ID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9O1xuXG4gICAgXy56aXAgPSBmdW5jdGlvbiAoYXJyYXkpIHtcbiAgICAgICAgaWYgKGFycmF5ID09IG51bGwpIHJldHVybiBbXTtcbiAgICAgICAgdmFyIGxlbmd0aCA9IF8ubWF4KGFyZ3VtZW50cywgJ2xlbmd0aCcpLmxlbmd0aDtcbiAgICAgICAgdmFyIHJlc3VsdHMgPSBBcnJheShsZW5ndGgpO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICByZXN1bHRzW2ldID0gXy5wbHVjayhhcmd1bWVudHMsIGkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHRzO1xuICAgIH07XG5cbiAgICAvLyBSZXR1cm4gdGhlIG1heGltdW0gZWxlbWVudCAob3IgZWxlbWVudC1iYXNlZCBjb21wdXRhdGlvbikuXG4gICAgXy5tYXggPSBmdW5jdGlvbiAob2JqLCBpdGVyYXRlZSwgY29udGV4dCkge1xuICAgICAgICB2YXIgcmVzdWx0ID0gLUluZmluaXR5LFxuICAgICAgICAgICAgbGFzdENvbXB1dGVkID0gLUluZmluaXR5LFxuICAgICAgICAgICAgdmFsdWUsIGNvbXB1dGVkO1xuICAgICAgICBpZiAoaXRlcmF0ZWUgPT0gbnVsbCAmJiBvYmogIT0gbnVsbCkge1xuICAgICAgICAgICAgb2JqID0gb2JqLmxlbmd0aCA9PT0gK29iai5sZW5ndGggPyBvYmogOiBfLnZhbHVlcyhvYmopO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IG9iai5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhbHVlID0gb2JqW2ldO1xuICAgICAgICAgICAgICAgIGlmICh2YWx1ZSA+IHJlc3VsdCkge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpdGVyYXRlZSA9IF8uaXRlcmF0ZWUoaXRlcmF0ZWUsIGNvbnRleHQpO1xuICAgICAgICAgICAgXy5lYWNoKG9iaiwgZnVuY3Rpb24gKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgICAgICAgICAgIGNvbXB1dGVkID0gaXRlcmF0ZWUodmFsdWUsIGluZGV4LCBsaXN0KTtcbiAgICAgICAgICAgICAgICBpZiAoY29tcHV0ZWQgPiBsYXN0Q29tcHV0ZWQgfHwgY29tcHV0ZWQgPT09IC1JbmZpbml0eSAmJiByZXN1bHQgPT09IC1JbmZpbml0eSkge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgbGFzdENvbXB1dGVkID0gY29tcHV0ZWQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuXG5cbiAgICBfLml0ZXJhdGVlID0gZnVuY3Rpb24gKHZhbHVlLCBjb250ZXh0LCBhcmdDb3VudCkge1xuICAgICAgICBpZiAodmFsdWUgPT0gbnVsbCkgcmV0dXJuIF8uaWRlbnRpdHk7XG4gICAgICAgIGlmIChfLmlzRnVuY3Rpb24odmFsdWUpKSByZXR1cm4gY3JlYXRlQ2FsbGJhY2sodmFsdWUsIGNvbnRleHQsIGFyZ0NvdW50KTtcbiAgICAgICAgaWYgKF8uaXNPYmplY3QodmFsdWUpKSByZXR1cm4gXy5tYXRjaGVzKHZhbHVlKTtcbiAgICAgICAgcmV0dXJuIF8ucHJvcGVydHkodmFsdWUpO1xuICAgIH07XG5cbiAgICBfLnBhaXJzID0gZnVuY3Rpb24gKG9iaikge1xuICAgICAgICB2YXIga2V5cyA9IF8ua2V5cyhvYmopO1xuICAgICAgICB2YXIgbGVuZ3RoID0ga2V5cy5sZW5ndGg7XG4gICAgICAgIHZhciBwYWlycyA9IEFycmF5KGxlbmd0aCk7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHBhaXJzW2ldID0gW2tleXNbaV0sIG9ialtrZXlzW2ldXV07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHBhaXJzO1xuICAgIH07XG5cbiAgICBfLm1hdGNoZXMgPSBmdW5jdGlvbiAoYXR0cnMpIHtcbiAgICAgICAgdmFyIHBhaXJzID0gXy5wYWlycyhhdHRycyksXG4gICAgICAgICAgICBsZW5ndGggPSBwYWlycy5sZW5ndGg7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgICAgICBpZiAob2JqID09IG51bGwpIHJldHVybiAhbGVuZ3RoO1xuICAgICAgICAgICAgb2JqID0gbmV3IE9iamVjdChvYmopO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBwYWlyID0gcGFpcnNbaV0sXG4gICAgICAgICAgICAgICAgICAgIGtleSA9IHBhaXJbMF07XG4gICAgICAgICAgICAgICAgaWYgKHBhaXJbMV0gIT09IG9ialtrZXldIHx8ICEoa2V5IGluIG9iaikpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9O1xuICAgIH07XG5cbiAgICBfLnNvbWUgPSBmdW5jdGlvbiAob2JqLCBwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICAgICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHByZWRpY2F0ZSA9IF8uaXRlcmF0ZWUocHJlZGljYXRlLCBjb250ZXh0KTtcbiAgICAgICAgdmFyIGtleXMgPSBvYmoubGVuZ3RoICE9PSArb2JqLmxlbmd0aCAmJiBfLmtleXMob2JqKSxcbiAgICAgICAgICAgIGxlbmd0aCA9IChrZXlzIHx8IG9iaikubGVuZ3RoLFxuICAgICAgICAgICAgaW5kZXgsIGN1cnJlbnRLZXk7XG4gICAgICAgIGZvciAoaW5kZXggPSAwOyBpbmRleCA8IGxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICAgICAgY3VycmVudEtleSA9IGtleXMgPyBrZXlzW2luZGV4XSA6IGluZGV4O1xuICAgICAgICAgICAgaWYgKHByZWRpY2F0ZShvYmpbY3VycmVudEtleV0sIGN1cnJlbnRLZXksIG9iaikpIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9O1xuXG5cbiAgICAvLyBFeHRlbmQgYSBnaXZlbiBvYmplY3Qgd2l0aCBhbGwgdGhlIHByb3BlcnRpZXMgaW4gcGFzc2VkLWluIG9iamVjdChzKS5cbiAgICBfLmV4dGVuZCA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgaWYgKCFfLmlzT2JqZWN0KG9iaikpIHJldHVybiBvYmo7XG4gICAgICAgIHZhciBzb3VyY2UsIHByb3A7XG4gICAgICAgIGZvciAodmFyIGkgPSAxLCBsZW5ndGggPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHNvdXJjZSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgICAgIGZvciAocHJvcCBpbiBzb3VyY2UpIHtcbiAgICAgICAgICAgICAgICAvL25vaW5zcGVjdGlvbiBKU1VuZmlsdGVyZWRGb3JJbkxvb3BcbiAgICAgICAgICAgICAgICBpZiAoaGFzT3duUHJvcGVydHkuY2FsbChzb3VyY2UsIHByb3ApKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vbm9pbnNwZWN0aW9uIEpTVW5maWx0ZXJlZEZvckluTG9vcFxuICAgICAgICAgICAgICAgICAgICBvYmpbcHJvcF0gPSBzb3VyY2VbcHJvcF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvYmo7XG4gICAgfTtcblxuICAgIG1vZHVsZS5leHBvcnRzID0gXztcbn0pKCk7IiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGFyZ3NBcnJheTtcblxuZnVuY3Rpb24gYXJnc0FycmF5KGZ1bikge1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHZhciBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGlmIChsZW4pIHtcbiAgICAgIHZhciBhcmdzID0gW107XG4gICAgICB2YXIgaSA9IC0xO1xuICAgICAgd2hpbGUgKCsraSA8IGxlbikge1xuICAgICAgICBhcmdzW2ldID0gYXJndW1lbnRzW2ldO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZ1bi5jYWxsKHRoaXMsIGFyZ3MpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gZnVuLmNhbGwodGhpcywgW10pO1xuICAgIH1cbiAgfTtcbn0iLG51bGwsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICB2YXIgbTtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2Uge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIWVtaXR0ZXIuX2V2ZW50cyB8fCAhZW1pdHRlci5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IDA7XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24oZW1pdHRlci5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSAxO1xuICBlbHNlXG4gICAgcmV0ID0gZW1pdHRlci5fZXZlbnRzW3R5cGVdLmxlbmd0aDtcbiAgcmV0dXJuIHJldDtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsIlxuLyoqXG4gKiBUaGlzIGlzIHRoZSB3ZWIgYnJvd3NlciBpbXBsZW1lbnRhdGlvbiBvZiBgZGVidWcoKWAuXG4gKlxuICogRXhwb3NlIGBkZWJ1ZygpYCBhcyB0aGUgbW9kdWxlLlxuICovXG5cbmV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vZGVidWcnKTtcbmV4cG9ydHMubG9nID0gbG9nO1xuZXhwb3J0cy5mb3JtYXRBcmdzID0gZm9ybWF0QXJncztcbmV4cG9ydHMuc2F2ZSA9IHNhdmU7XG5leHBvcnRzLmxvYWQgPSBsb2FkO1xuZXhwb3J0cy51c2VDb2xvcnMgPSB1c2VDb2xvcnM7XG5cbi8qKlxuICogVXNlIGNocm9tZS5zdG9yYWdlLmxvY2FsIGlmIHdlIGFyZSBpbiBhbiBhcHBcbiAqL1xuXG52YXIgc3RvcmFnZTtcblxuaWYgKHR5cGVvZiBjaHJvbWUgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBjaHJvbWUuc3RvcmFnZSAhPT0gJ3VuZGVmaW5lZCcpXG4gIHN0b3JhZ2UgPSBjaHJvbWUuc3RvcmFnZS5sb2NhbDtcbmVsc2VcbiAgc3RvcmFnZSA9IHdpbmRvdy5sb2NhbFN0b3JhZ2U7XG5cbi8qKlxuICogQ29sb3JzLlxuICovXG5cbmV4cG9ydHMuY29sb3JzID0gW1xuICAnbGlnaHRzZWFncmVlbicsXG4gICdmb3Jlc3RncmVlbicsXG4gICdnb2xkZW5yb2QnLFxuICAnZG9kZ2VyYmx1ZScsXG4gICdkYXJrb3JjaGlkJyxcbiAgJ2NyaW1zb24nXG5dO1xuXG4vKipcbiAqIEN1cnJlbnRseSBvbmx5IFdlYktpdC1iYXNlZCBXZWIgSW5zcGVjdG9ycywgRmlyZWZveCA+PSB2MzEsXG4gKiBhbmQgdGhlIEZpcmVidWcgZXh0ZW5zaW9uIChhbnkgRmlyZWZveCB2ZXJzaW9uKSBhcmUga25vd25cbiAqIHRvIHN1cHBvcnQgXCIlY1wiIENTUyBjdXN0b21pemF0aW9ucy5cbiAqXG4gKiBUT0RPOiBhZGQgYSBgbG9jYWxTdG9yYWdlYCB2YXJpYWJsZSB0byBleHBsaWNpdGx5IGVuYWJsZS9kaXNhYmxlIGNvbG9yc1xuICovXG5cbmZ1bmN0aW9uIHVzZUNvbG9ycygpIHtcbiAgLy8gaXMgd2Via2l0PyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8xNjQ1OTYwNi8zNzY3NzNcbiAgcmV0dXJuICgnV2Via2l0QXBwZWFyYW5jZScgaW4gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlKSB8fFxuICAgIC8vIGlzIGZpcmVidWc/IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzM5ODEyMC8zNzY3NzNcbiAgICAod2luZG93LmNvbnNvbGUgJiYgKGNvbnNvbGUuZmlyZWJ1ZyB8fCAoY29uc29sZS5leGNlcHRpb24gJiYgY29uc29sZS50YWJsZSkpKSB8fFxuICAgIC8vIGlzIGZpcmVmb3ggPj0gdjMxP1xuICAgIC8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvVG9vbHMvV2ViX0NvbnNvbGUjU3R5bGluZ19tZXNzYWdlc1xuICAgIChuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkubWF0Y2goL2ZpcmVmb3hcXC8oXFxkKykvKSAmJiBwYXJzZUludChSZWdFeHAuJDEsIDEwKSA+PSAzMSk7XG59XG5cbi8qKlxuICogTWFwICVqIHRvIGBKU09OLnN0cmluZ2lmeSgpYCwgc2luY2Ugbm8gV2ViIEluc3BlY3RvcnMgZG8gdGhhdCBieSBkZWZhdWx0LlxuICovXG5cbmV4cG9ydHMuZm9ybWF0dGVycy5qID0gZnVuY3Rpb24odikge1xuICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodik7XG59O1xuXG5cbi8qKlxuICogQ29sb3JpemUgbG9nIGFyZ3VtZW50cyBpZiBlbmFibGVkLlxuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZm9ybWF0QXJncygpIHtcbiAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7XG4gIHZhciB1c2VDb2xvcnMgPSB0aGlzLnVzZUNvbG9ycztcblxuICBhcmdzWzBdID0gKHVzZUNvbG9ycyA/ICclYycgOiAnJylcbiAgICArIHRoaXMubmFtZXNwYWNlXG4gICAgKyAodXNlQ29sb3JzID8gJyAlYycgOiAnICcpXG4gICAgKyBhcmdzWzBdXG4gICAgKyAodXNlQ29sb3JzID8gJyVjICcgOiAnICcpXG4gICAgKyAnKycgKyBleHBvcnRzLmh1bWFuaXplKHRoaXMuZGlmZik7XG5cbiAgaWYgKCF1c2VDb2xvcnMpIHJldHVybiBhcmdzO1xuXG4gIHZhciBjID0gJ2NvbG9yOiAnICsgdGhpcy5jb2xvcjtcbiAgYXJncyA9IFthcmdzWzBdLCBjLCAnY29sb3I6IGluaGVyaXQnXS5jb25jYXQoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJncywgMSkpO1xuXG4gIC8vIHRoZSBmaW5hbCBcIiVjXCIgaXMgc29tZXdoYXQgdHJpY2t5LCBiZWNhdXNlIHRoZXJlIGNvdWxkIGJlIG90aGVyXG4gIC8vIGFyZ3VtZW50cyBwYXNzZWQgZWl0aGVyIGJlZm9yZSBvciBhZnRlciB0aGUgJWMsIHNvIHdlIG5lZWQgdG9cbiAgLy8gZmlndXJlIG91dCB0aGUgY29ycmVjdCBpbmRleCB0byBpbnNlcnQgdGhlIENTUyBpbnRvXG4gIHZhciBpbmRleCA9IDA7XG4gIHZhciBsYXN0QyA9IDA7XG4gIGFyZ3NbMF0ucmVwbGFjZSgvJVthLXolXS9nLCBmdW5jdGlvbihtYXRjaCkge1xuICAgIGlmICgnJSUnID09PSBtYXRjaCkgcmV0dXJuO1xuICAgIGluZGV4Kys7XG4gICAgaWYgKCclYycgPT09IG1hdGNoKSB7XG4gICAgICAvLyB3ZSBvbmx5IGFyZSBpbnRlcmVzdGVkIGluIHRoZSAqbGFzdCogJWNcbiAgICAgIC8vICh0aGUgdXNlciBtYXkgaGF2ZSBwcm92aWRlZCB0aGVpciBvd24pXG4gICAgICBsYXN0QyA9IGluZGV4O1xuICAgIH1cbiAgfSk7XG5cbiAgYXJncy5zcGxpY2UobGFzdEMsIDAsIGMpO1xuICByZXR1cm4gYXJncztcbn1cblxuLyoqXG4gKiBJbnZva2VzIGBjb25zb2xlLmxvZygpYCB3aGVuIGF2YWlsYWJsZS5cbiAqIE5vLW9wIHdoZW4gYGNvbnNvbGUubG9nYCBpcyBub3QgYSBcImZ1bmN0aW9uXCIuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBsb2coKSB7XG4gIC8vIHRoaXMgaGFja2VyeSBpcyByZXF1aXJlZCBmb3IgSUU4LzksIHdoZXJlXG4gIC8vIHRoZSBgY29uc29sZS5sb2dgIGZ1bmN0aW9uIGRvZXNuJ3QgaGF2ZSAnYXBwbHknXG4gIHJldHVybiAnb2JqZWN0JyA9PT0gdHlwZW9mIGNvbnNvbGVcbiAgICAmJiBjb25zb2xlLmxvZ1xuICAgICYmIEZ1bmN0aW9uLnByb3RvdHlwZS5hcHBseS5jYWxsKGNvbnNvbGUubG9nLCBjb25zb2xlLCBhcmd1bWVudHMpO1xufVxuXG4vKipcbiAqIFNhdmUgYG5hbWVzcGFjZXNgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2VzXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBzYXZlKG5hbWVzcGFjZXMpIHtcbiAgdHJ5IHtcbiAgICBpZiAobnVsbCA9PSBuYW1lc3BhY2VzKSB7XG4gICAgICBzdG9yYWdlLnJlbW92ZUl0ZW0oJ2RlYnVnJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0b3JhZ2UuZGVidWcgPSBuYW1lc3BhY2VzO1xuICAgIH1cbiAgfSBjYXRjaChlKSB7fVxufVxuXG4vKipcbiAqIExvYWQgYG5hbWVzcGFjZXNgLlxuICpcbiAqIEByZXR1cm4ge1N0cmluZ30gcmV0dXJucyB0aGUgcHJldmlvdXNseSBwZXJzaXN0ZWQgZGVidWcgbW9kZXNcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGxvYWQoKSB7XG4gIHZhciByO1xuICB0cnkge1xuICAgIHIgPSBzdG9yYWdlLmRlYnVnO1xuICB9IGNhdGNoKGUpIHt9XG4gIHJldHVybiByO1xufVxuXG4vKipcbiAqIEVuYWJsZSBuYW1lc3BhY2VzIGxpc3RlZCBpbiBgbG9jYWxTdG9yYWdlLmRlYnVnYCBpbml0aWFsbHkuXG4gKi9cblxuZXhwb3J0cy5lbmFibGUobG9hZCgpKTtcbiIsIlxuLyoqXG4gKiBUaGlzIGlzIHRoZSBjb21tb24gbG9naWMgZm9yIGJvdGggdGhlIE5vZGUuanMgYW5kIHdlYiBicm93c2VyXG4gKiBpbXBsZW1lbnRhdGlvbnMgb2YgYGRlYnVnKClgLlxuICpcbiAqIEV4cG9zZSBgZGVidWcoKWAgYXMgdGhlIG1vZHVsZS5cbiAqL1xuXG5leHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBkZWJ1ZztcbmV4cG9ydHMuY29lcmNlID0gY29lcmNlO1xuZXhwb3J0cy5kaXNhYmxlID0gZGlzYWJsZTtcbmV4cG9ydHMuZW5hYmxlID0gZW5hYmxlO1xuZXhwb3J0cy5lbmFibGVkID0gZW5hYmxlZDtcbmV4cG9ydHMuaHVtYW5pemUgPSByZXF1aXJlKCdtcycpO1xuXG4vKipcbiAqIFRoZSBjdXJyZW50bHkgYWN0aXZlIGRlYnVnIG1vZGUgbmFtZXMsIGFuZCBuYW1lcyB0byBza2lwLlxuICovXG5cbmV4cG9ydHMubmFtZXMgPSBbXTtcbmV4cG9ydHMuc2tpcHMgPSBbXTtcblxuLyoqXG4gKiBNYXAgb2Ygc3BlY2lhbCBcIiVuXCIgaGFuZGxpbmcgZnVuY3Rpb25zLCBmb3IgdGhlIGRlYnVnIFwiZm9ybWF0XCIgYXJndW1lbnQuXG4gKlxuICogVmFsaWQga2V5IG5hbWVzIGFyZSBhIHNpbmdsZSwgbG93ZXJjYXNlZCBsZXR0ZXIsIGkuZS4gXCJuXCIuXG4gKi9cblxuZXhwb3J0cy5mb3JtYXR0ZXJzID0ge307XG5cbi8qKlxuICogUHJldmlvdXNseSBhc3NpZ25lZCBjb2xvci5cbiAqL1xuXG52YXIgcHJldkNvbG9yID0gMDtcblxuLyoqXG4gKiBQcmV2aW91cyBsb2cgdGltZXN0YW1wLlxuICovXG5cbnZhciBwcmV2VGltZTtcblxuLyoqXG4gKiBTZWxlY3QgYSBjb2xvci5cbiAqXG4gKiBAcmV0dXJuIHtOdW1iZXJ9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBzZWxlY3RDb2xvcigpIHtcbiAgcmV0dXJuIGV4cG9ydHMuY29sb3JzW3ByZXZDb2xvcisrICUgZXhwb3J0cy5jb2xvcnMubGVuZ3RoXTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBkZWJ1Z2dlciB3aXRoIHRoZSBnaXZlbiBgbmFtZXNwYWNlYC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZGVidWcobmFtZXNwYWNlKSB7XG5cbiAgLy8gZGVmaW5lIHRoZSBgZGlzYWJsZWRgIHZlcnNpb25cbiAgZnVuY3Rpb24gZGlzYWJsZWQoKSB7XG4gIH1cbiAgZGlzYWJsZWQuZW5hYmxlZCA9IGZhbHNlO1xuXG4gIC8vIGRlZmluZSB0aGUgYGVuYWJsZWRgIHZlcnNpb25cbiAgZnVuY3Rpb24gZW5hYmxlZCgpIHtcblxuICAgIHZhciBzZWxmID0gZW5hYmxlZDtcblxuICAgIC8vIHNldCBgZGlmZmAgdGltZXN0YW1wXG4gICAgdmFyIGN1cnIgPSArbmV3IERhdGUoKTtcbiAgICB2YXIgbXMgPSBjdXJyIC0gKHByZXZUaW1lIHx8IGN1cnIpO1xuICAgIHNlbGYuZGlmZiA9IG1zO1xuICAgIHNlbGYucHJldiA9IHByZXZUaW1lO1xuICAgIHNlbGYuY3VyciA9IGN1cnI7XG4gICAgcHJldlRpbWUgPSBjdXJyO1xuXG4gICAgLy8gYWRkIHRoZSBgY29sb3JgIGlmIG5vdCBzZXRcbiAgICBpZiAobnVsbCA9PSBzZWxmLnVzZUNvbG9ycykgc2VsZi51c2VDb2xvcnMgPSBleHBvcnRzLnVzZUNvbG9ycygpO1xuICAgIGlmIChudWxsID09IHNlbGYuY29sb3IgJiYgc2VsZi51c2VDb2xvcnMpIHNlbGYuY29sb3IgPSBzZWxlY3RDb2xvcigpO1xuXG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuXG4gICAgYXJnc1swXSA9IGV4cG9ydHMuY29lcmNlKGFyZ3NbMF0pO1xuXG4gICAgaWYgKCdzdHJpbmcnICE9PSB0eXBlb2YgYXJnc1swXSkge1xuICAgICAgLy8gYW55dGhpbmcgZWxzZSBsZXQncyBpbnNwZWN0IHdpdGggJW9cbiAgICAgIGFyZ3MgPSBbJyVvJ10uY29uY2F0KGFyZ3MpO1xuICAgIH1cblxuICAgIC8vIGFwcGx5IGFueSBgZm9ybWF0dGVyc2AgdHJhbnNmb3JtYXRpb25zXG4gICAgdmFyIGluZGV4ID0gMDtcbiAgICBhcmdzWzBdID0gYXJnc1swXS5yZXBsYWNlKC8lKFthLXolXSkvZywgZnVuY3Rpb24obWF0Y2gsIGZvcm1hdCkge1xuICAgICAgLy8gaWYgd2UgZW5jb3VudGVyIGFuIGVzY2FwZWQgJSB0aGVuIGRvbid0IGluY3JlYXNlIHRoZSBhcnJheSBpbmRleFxuICAgICAgaWYgKG1hdGNoID09PSAnJSUnKSByZXR1cm4gbWF0Y2g7XG4gICAgICBpbmRleCsrO1xuICAgICAgdmFyIGZvcm1hdHRlciA9IGV4cG9ydHMuZm9ybWF0dGVyc1tmb3JtYXRdO1xuICAgICAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiBmb3JtYXR0ZXIpIHtcbiAgICAgICAgdmFyIHZhbCA9IGFyZ3NbaW5kZXhdO1xuICAgICAgICBtYXRjaCA9IGZvcm1hdHRlci5jYWxsKHNlbGYsIHZhbCk7XG5cbiAgICAgICAgLy8gbm93IHdlIG5lZWQgdG8gcmVtb3ZlIGBhcmdzW2luZGV4XWAgc2luY2UgaXQncyBpbmxpbmVkIGluIHRoZSBgZm9ybWF0YFxuICAgICAgICBhcmdzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIGluZGV4LS07XG4gICAgICB9XG4gICAgICByZXR1cm4gbWF0Y2g7XG4gICAgfSk7XG5cbiAgICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGV4cG9ydHMuZm9ybWF0QXJncykge1xuICAgICAgYXJncyA9IGV4cG9ydHMuZm9ybWF0QXJncy5hcHBseShzZWxmLCBhcmdzKTtcbiAgICB9XG4gICAgdmFyIGxvZ0ZuID0gZW5hYmxlZC5sb2cgfHwgZXhwb3J0cy5sb2cgfHwgY29uc29sZS5sb2cuYmluZChjb25zb2xlKTtcbiAgICBsb2dGbi5hcHBseShzZWxmLCBhcmdzKTtcbiAgfVxuICBlbmFibGVkLmVuYWJsZWQgPSB0cnVlO1xuXG4gIHZhciBmbiA9IGV4cG9ydHMuZW5hYmxlZChuYW1lc3BhY2UpID8gZW5hYmxlZCA6IGRpc2FibGVkO1xuXG4gIGZuLm5hbWVzcGFjZSA9IG5hbWVzcGFjZTtcblxuICByZXR1cm4gZm47XG59XG5cbi8qKlxuICogRW5hYmxlcyBhIGRlYnVnIG1vZGUgYnkgbmFtZXNwYWNlcy4gVGhpcyBjYW4gaW5jbHVkZSBtb2Rlc1xuICogc2VwYXJhdGVkIGJ5IGEgY29sb24gYW5kIHdpbGRjYXJkcy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlc1xuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBlbmFibGUobmFtZXNwYWNlcykge1xuICBleHBvcnRzLnNhdmUobmFtZXNwYWNlcyk7XG5cbiAgdmFyIHNwbGl0ID0gKG5hbWVzcGFjZXMgfHwgJycpLnNwbGl0KC9bXFxzLF0rLyk7XG4gIHZhciBsZW4gPSBzcGxpdC5sZW5ndGg7XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgIGlmICghc3BsaXRbaV0pIGNvbnRpbnVlOyAvLyBpZ25vcmUgZW1wdHkgc3RyaW5nc1xuICAgIG5hbWVzcGFjZXMgPSBzcGxpdFtpXS5yZXBsYWNlKC9cXCovZywgJy4qPycpO1xuICAgIGlmIChuYW1lc3BhY2VzWzBdID09PSAnLScpIHtcbiAgICAgIGV4cG9ydHMuc2tpcHMucHVzaChuZXcgUmVnRXhwKCdeJyArIG5hbWVzcGFjZXMuc3Vic3RyKDEpICsgJyQnKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGV4cG9ydHMubmFtZXMucHVzaChuZXcgUmVnRXhwKCdeJyArIG5hbWVzcGFjZXMgKyAnJCcpKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBEaXNhYmxlIGRlYnVnIG91dHB1dC5cbiAqXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGRpc2FibGUoKSB7XG4gIGV4cG9ydHMuZW5hYmxlKCcnKTtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgdGhlIGdpdmVuIG1vZGUgbmFtZSBpcyBlbmFibGVkLCBmYWxzZSBvdGhlcndpc2UuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGVuYWJsZWQobmFtZSkge1xuICB2YXIgaSwgbGVuO1xuICBmb3IgKGkgPSAwLCBsZW4gPSBleHBvcnRzLnNraXBzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKGV4cG9ydHMuc2tpcHNbaV0udGVzdChuYW1lKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuICBmb3IgKGkgPSAwLCBsZW4gPSBleHBvcnRzLm5hbWVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKGV4cG9ydHMubmFtZXNbaV0udGVzdChuYW1lKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuLyoqXG4gKiBDb2VyY2UgYHZhbGAuXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gdmFsXG4gKiBAcmV0dXJuIHtNaXhlZH1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGNvZXJjZSh2YWwpIHtcbiAgaWYgKHZhbCBpbnN0YW5jZW9mIEVycm9yKSByZXR1cm4gdmFsLnN0YWNrIHx8IHZhbC5tZXNzYWdlO1xuICByZXR1cm4gdmFsO1xufVxuIiwiLyoqXG4gKiBIZWxwZXJzLlxuICovXG5cbnZhciBzID0gMTAwMDtcbnZhciBtID0gcyAqIDYwO1xudmFyIGggPSBtICogNjA7XG52YXIgZCA9IGggKiAyNDtcbnZhciB5ID0gZCAqIDM2NS4yNTtcblxuLyoqXG4gKiBQYXJzZSBvciBmb3JtYXQgdGhlIGdpdmVuIGB2YWxgLlxuICpcbiAqIE9wdGlvbnM6XG4gKlxuICogIC0gYGxvbmdgIHZlcmJvc2UgZm9ybWF0dGluZyBbZmFsc2VdXG4gKlxuICogQHBhcmFtIHtTdHJpbmd8TnVtYmVyfSB2YWxcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcmV0dXJuIHtTdHJpbmd8TnVtYmVyfVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHZhbCwgb3B0aW9ucyl7XG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICBpZiAoJ3N0cmluZycgPT0gdHlwZW9mIHZhbCkgcmV0dXJuIHBhcnNlKHZhbCk7XG4gIHJldHVybiBvcHRpb25zLmxvbmdcbiAgICA/IGxvbmcodmFsKVxuICAgIDogc2hvcnQodmFsKTtcbn07XG5cbi8qKlxuICogUGFyc2UgdGhlIGdpdmVuIGBzdHJgIGFuZCByZXR1cm4gbWlsbGlzZWNvbmRzLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHJcbiAqIEByZXR1cm4ge051bWJlcn1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHBhcnNlKHN0cikge1xuICB2YXIgbWF0Y2ggPSAvXigoPzpcXGQrKT9cXC4/XFxkKykgKihtc3xzZWNvbmRzP3xzfG1pbnV0ZXM/fG18aG91cnM/fGh8ZGF5cz98ZHx5ZWFycz98eSk/JC9pLmV4ZWMoc3RyKTtcbiAgaWYgKCFtYXRjaCkgcmV0dXJuO1xuICB2YXIgbiA9IHBhcnNlRmxvYXQobWF0Y2hbMV0pO1xuICB2YXIgdHlwZSA9IChtYXRjaFsyXSB8fCAnbXMnKS50b0xvd2VyQ2FzZSgpO1xuICBzd2l0Y2ggKHR5cGUpIHtcbiAgICBjYXNlICd5ZWFycyc6XG4gICAgY2FzZSAneWVhcic6XG4gICAgY2FzZSAneSc6XG4gICAgICByZXR1cm4gbiAqIHk7XG4gICAgY2FzZSAnZGF5cyc6XG4gICAgY2FzZSAnZGF5JzpcbiAgICBjYXNlICdkJzpcbiAgICAgIHJldHVybiBuICogZDtcbiAgICBjYXNlICdob3Vycyc6XG4gICAgY2FzZSAnaG91cic6XG4gICAgY2FzZSAnaCc6XG4gICAgICByZXR1cm4gbiAqIGg7XG4gICAgY2FzZSAnbWludXRlcyc6XG4gICAgY2FzZSAnbWludXRlJzpcbiAgICBjYXNlICdtJzpcbiAgICAgIHJldHVybiBuICogbTtcbiAgICBjYXNlICdzZWNvbmRzJzpcbiAgICBjYXNlICdzZWNvbmQnOlxuICAgIGNhc2UgJ3MnOlxuICAgICAgcmV0dXJuIG4gKiBzO1xuICAgIGNhc2UgJ21zJzpcbiAgICAgIHJldHVybiBuO1xuICB9XG59XG5cbi8qKlxuICogU2hvcnQgZm9ybWF0IGZvciBgbXNgLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBtc1xuICogQHJldHVybiB7U3RyaW5nfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gc2hvcnQobXMpIHtcbiAgaWYgKG1zID49IGQpIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gZCkgKyAnZCc7XG4gIGlmIChtcyA+PSBoKSByZXR1cm4gTWF0aC5yb3VuZChtcyAvIGgpICsgJ2gnO1xuICBpZiAobXMgPj0gbSkgcmV0dXJuIE1hdGgucm91bmQobXMgLyBtKSArICdtJztcbiAgaWYgKG1zID49IHMpIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gcykgKyAncyc7XG4gIHJldHVybiBtcyArICdtcyc7XG59XG5cbi8qKlxuICogTG9uZyBmb3JtYXQgZm9yIGBtc2AuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1zXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBsb25nKG1zKSB7XG4gIHJldHVybiBwbHVyYWwobXMsIGQsICdkYXknKVxuICAgIHx8IHBsdXJhbChtcywgaCwgJ2hvdXInKVxuICAgIHx8IHBsdXJhbChtcywgbSwgJ21pbnV0ZScpXG4gICAgfHwgcGx1cmFsKG1zLCBzLCAnc2Vjb25kJylcbiAgICB8fCBtcyArICcgbXMnO1xufVxuXG4vKipcbiAqIFBsdXJhbGl6YXRpb24gaGVscGVyLlxuICovXG5cbmZ1bmN0aW9uIHBsdXJhbChtcywgbiwgbmFtZSkge1xuICBpZiAobXMgPCBuKSByZXR1cm47XG4gIGlmIChtcyA8IG4gKiAxLjUpIHJldHVybiBNYXRoLmZsb29yKG1zIC8gbikgKyAnICcgKyBuYW1lO1xuICByZXR1cm4gTWF0aC5jZWlsKG1zIC8gbikgKyAnICcgKyBuYW1lICsgJ3MnO1xufVxuIiwidmFyIGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG52YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xudmFyIHVuZGVmaW5lZDtcblxudmFyIGlzUGxhaW5PYmplY3QgPSBmdW5jdGlvbiBpc1BsYWluT2JqZWN0KG9iaikge1xuICAgIFwidXNlIHN0cmljdFwiO1xuICAgIGlmICghb2JqIHx8IHRvU3RyaW5nLmNhbGwob2JqKSAhPT0gJ1tvYmplY3QgT2JqZWN0XScgfHwgb2JqLm5vZGVUeXBlIHx8IG9iai5zZXRJbnRlcnZhbCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdmFyIGhhc19vd25fY29uc3RydWN0b3IgPSBoYXNPd24uY2FsbChvYmosICdjb25zdHJ1Y3RvcicpO1xuICAgIHZhciBoYXNfaXNfcHJvcGVydHlfb2ZfbWV0aG9kID0gb2JqLmNvbnN0cnVjdG9yICYmIG9iai5jb25zdHJ1Y3Rvci5wcm90b3R5cGUgJiYgaGFzT3duLmNhbGwob2JqLmNvbnN0cnVjdG9yLnByb3RvdHlwZSwgJ2lzUHJvdG90eXBlT2YnKTtcbiAgICAvLyBOb3Qgb3duIGNvbnN0cnVjdG9yIHByb3BlcnR5IG11c3QgYmUgT2JqZWN0XG4gICAgaWYgKG9iai5jb25zdHJ1Y3RvciAmJiAhaGFzX293bl9jb25zdHJ1Y3RvciAmJiAhaGFzX2lzX3Byb3BlcnR5X29mX21ldGhvZCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gT3duIHByb3BlcnRpZXMgYXJlIGVudW1lcmF0ZWQgZmlyc3RseSwgc28gdG8gc3BlZWQgdXAsXG4gICAgLy8gaWYgbGFzdCBvbmUgaXMgb3duLCB0aGVuIGFsbCBwcm9wZXJ0aWVzIGFyZSBvd24uXG4gICAgdmFyIGtleTtcbiAgICBmb3IgKGtleSBpbiBvYmopIHt9XG5cbiAgICByZXR1cm4ga2V5ID09PSB1bmRlZmluZWQgfHwgaGFzT3duLmNhbGwob2JqLCBrZXkpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBleHRlbmQoKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG4gICAgdmFyIG9wdGlvbnMsIG5hbWUsIHNyYywgY29weSwgY29weUlzQXJyYXksIGNsb25lLFxuICAgICAgICB0YXJnZXQgPSBhcmd1bWVudHNbMF0sXG4gICAgICAgIGkgPSAxLFxuICAgICAgICBsZW5ndGggPSBhcmd1bWVudHMubGVuZ3RoLFxuICAgICAgICBkZWVwID0gZmFsc2U7XG5cbiAgICAvLyBIYW5kbGUgYSBkZWVwIGNvcHkgc2l0dWF0aW9uXG4gICAgaWYgKHR5cGVvZiB0YXJnZXQgPT09IFwiYm9vbGVhblwiKSB7XG4gICAgICAgIGRlZXAgPSB0YXJnZXQ7XG4gICAgICAgIHRhcmdldCA9IGFyZ3VtZW50c1sxXSB8fCB7fTtcbiAgICAgICAgLy8gc2tpcCB0aGUgYm9vbGVhbiBhbmQgdGhlIHRhcmdldFxuICAgICAgICBpID0gMjtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiB0YXJnZXQgIT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHRhcmdldCAhPT0gXCJmdW5jdGlvblwiIHx8IHRhcmdldCA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGFyZ2V0ID0ge307XG4gICAgfVxuXG4gICAgZm9yICg7IGkgPCBsZW5ndGg7ICsraSkge1xuICAgICAgICAvLyBPbmx5IGRlYWwgd2l0aCBub24tbnVsbC91bmRlZmluZWQgdmFsdWVzXG4gICAgICAgIGlmICgob3B0aW9ucyA9IGFyZ3VtZW50c1tpXSkgIT0gbnVsbCkge1xuICAgICAgICAgICAgLy8gRXh0ZW5kIHRoZSBiYXNlIG9iamVjdFxuICAgICAgICAgICAgZm9yIChuYW1lIGluIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICBzcmMgPSB0YXJnZXRbbmFtZV07XG4gICAgICAgICAgICAgICAgY29weSA9IG9wdGlvbnNbbmFtZV07XG5cbiAgICAgICAgICAgICAgICAvLyBQcmV2ZW50IG5ldmVyLWVuZGluZyBsb29wXG4gICAgICAgICAgICAgICAgaWYgKHRhcmdldCA9PT0gY29weSkge1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBSZWN1cnNlIGlmIHdlJ3JlIG1lcmdpbmcgcGxhaW4gb2JqZWN0cyBvciBhcnJheXNcbiAgICAgICAgICAgICAgICBpZiAoZGVlcCAmJiBjb3B5ICYmIChpc1BsYWluT2JqZWN0KGNvcHkpIHx8IChjb3B5SXNBcnJheSA9IEFycmF5LmlzQXJyYXkoY29weSkpKSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoY29weUlzQXJyYXkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvcHlJc0FycmF5ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICBjbG9uZSA9IHNyYyAmJiBBcnJheS5pc0FycmF5KHNyYykgPyBzcmMgOiBbXTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsb25lID0gc3JjICYmIGlzUGxhaW5PYmplY3Qoc3JjKSA/IHNyYyA6IHt9O1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gTmV2ZXIgbW92ZSBvcmlnaW5hbCBvYmplY3RzLCBjbG9uZSB0aGVtXG4gICAgICAgICAgICAgICAgICAgIHRhcmdldFtuYW1lXSA9IGV4dGVuZChkZWVwLCBjbG9uZSwgY29weSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gRG9uJ3QgYnJpbmcgaW4gdW5kZWZpbmVkIHZhbHVlc1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY29weSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldFtuYW1lXSA9IGNvcHk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gUmV0dXJuIHRoZSBtb2RpZmllZCBvYmplY3RcbiAgICByZXR1cm4gdGFyZ2V0O1xufTtcblxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IElOVEVSTkFMO1xuXG5mdW5jdGlvbiBJTlRFUk5BTCgpIHt9IiwiJ3VzZSBzdHJpY3QnO1xudmFyIFByb21pc2UgPSByZXF1aXJlKCcuL3Byb21pc2UnKTtcbnZhciByZWplY3QgPSByZXF1aXJlKCcuL3JlamVjdCcpO1xudmFyIHJlc29sdmUgPSByZXF1aXJlKCcuL3Jlc29sdmUnKTtcbnZhciBJTlRFUk5BTCA9IHJlcXVpcmUoJy4vSU5URVJOQUwnKTtcbnZhciBoYW5kbGVycyA9IHJlcXVpcmUoJy4vaGFuZGxlcnMnKTtcbm1vZHVsZS5leHBvcnRzID0gYWxsO1xuZnVuY3Rpb24gYWxsKGl0ZXJhYmxlKSB7XG4gIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoaXRlcmFibGUpICE9PSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgcmV0dXJuIHJlamVjdChuZXcgVHlwZUVycm9yKCdtdXN0IGJlIGFuIGFycmF5JykpO1xuICB9XG5cbiAgdmFyIGxlbiA9IGl0ZXJhYmxlLmxlbmd0aDtcbiAgdmFyIGNhbGxlZCA9IGZhbHNlO1xuICBpZiAoIWxlbikge1xuICAgIHJldHVybiByZXNvbHZlKFtdKTtcbiAgfVxuXG4gIHZhciB2YWx1ZXMgPSBuZXcgQXJyYXkobGVuKTtcbiAgdmFyIHJlc29sdmVkID0gMDtcbiAgdmFyIGkgPSAtMTtcbiAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZShJTlRFUk5BTCk7XG4gIFxuICB3aGlsZSAoKytpIDwgbGVuKSB7XG4gICAgYWxsUmVzb2x2ZXIoaXRlcmFibGVbaV0sIGkpO1xuICB9XG4gIHJldHVybiBwcm9taXNlO1xuICBmdW5jdGlvbiBhbGxSZXNvbHZlcih2YWx1ZSwgaSkge1xuICAgIHJlc29sdmUodmFsdWUpLnRoZW4ocmVzb2x2ZUZyb21BbGwsIGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgaWYgKCFjYWxsZWQpIHtcbiAgICAgICAgY2FsbGVkID0gdHJ1ZTtcbiAgICAgICAgaGFuZGxlcnMucmVqZWN0KHByb21pc2UsIGVycm9yKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBmdW5jdGlvbiByZXNvbHZlRnJvbUFsbChvdXRWYWx1ZSkge1xuICAgICAgdmFsdWVzW2ldID0gb3V0VmFsdWU7XG4gICAgICBpZiAoKytyZXNvbHZlZCA9PT0gbGVuICYgIWNhbGxlZCkge1xuICAgICAgICBjYWxsZWQgPSB0cnVlO1xuICAgICAgICBoYW5kbGVycy5yZXNvbHZlKHByb21pc2UsIHZhbHVlcyk7XG4gICAgICB9XG4gICAgfVxuICB9XG59IiwiJ3VzZSBzdHJpY3QnO1xudmFyIHRyeUNhdGNoID0gcmVxdWlyZSgnLi90cnlDYXRjaCcpO1xudmFyIHJlc29sdmVUaGVuYWJsZSA9IHJlcXVpcmUoJy4vcmVzb2x2ZVRoZW5hYmxlJyk7XG52YXIgc3RhdGVzID0gcmVxdWlyZSgnLi9zdGF0ZXMnKTtcblxuZXhwb3J0cy5yZXNvbHZlID0gZnVuY3Rpb24gKHNlbGYsIHZhbHVlKSB7XG4gIHZhciByZXN1bHQgPSB0cnlDYXRjaChnZXRUaGVuLCB2YWx1ZSk7XG4gIGlmIChyZXN1bHQuc3RhdHVzID09PSAnZXJyb3InKSB7XG4gICAgcmV0dXJuIGV4cG9ydHMucmVqZWN0KHNlbGYsIHJlc3VsdC52YWx1ZSk7XG4gIH1cbiAgdmFyIHRoZW5hYmxlID0gcmVzdWx0LnZhbHVlO1xuXG4gIGlmICh0aGVuYWJsZSkge1xuICAgIHJlc29sdmVUaGVuYWJsZS5zYWZlbHkoc2VsZiwgdGhlbmFibGUpO1xuICB9IGVsc2Uge1xuICAgIHNlbGYuc3RhdGUgPSBzdGF0ZXMuRlVMRklMTEVEO1xuICAgIHNlbGYub3V0Y29tZSA9IHZhbHVlO1xuICAgIHZhciBpID0gLTE7XG4gICAgdmFyIGxlbiA9IHNlbGYucXVldWUubGVuZ3RoO1xuICAgIHdoaWxlICgrK2kgPCBsZW4pIHtcbiAgICAgIHNlbGYucXVldWVbaV0uY2FsbEZ1bGZpbGxlZCh2YWx1ZSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBzZWxmO1xufTtcbmV4cG9ydHMucmVqZWN0ID0gZnVuY3Rpb24gKHNlbGYsIGVycm9yKSB7XG4gIHNlbGYuc3RhdGUgPSBzdGF0ZXMuUkVKRUNURUQ7XG4gIHNlbGYub3V0Y29tZSA9IGVycm9yO1xuICB2YXIgaSA9IC0xO1xuICB2YXIgbGVuID0gc2VsZi5xdWV1ZS5sZW5ndGg7XG4gIHdoaWxlICgrK2kgPCBsZW4pIHtcbiAgICBzZWxmLnF1ZXVlW2ldLmNhbGxSZWplY3RlZChlcnJvcik7XG4gIH1cbiAgcmV0dXJuIHNlbGY7XG59O1xuXG5mdW5jdGlvbiBnZXRUaGVuKG9iaikge1xuICAvLyBNYWtlIHN1cmUgd2Ugb25seSBhY2Nlc3MgdGhlIGFjY2Vzc29yIG9uY2UgYXMgcmVxdWlyZWQgYnkgdGhlIHNwZWNcbiAgdmFyIHRoZW4gPSBvYmogJiYgb2JqLnRoZW47XG4gIGlmIChvYmogJiYgdHlwZW9mIG9iaiA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIHRoZW4gPT09ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gYXBweVRoZW4oKSB7XG4gICAgICB0aGVuLmFwcGx5KG9iaiwgYXJndW1lbnRzKTtcbiAgICB9O1xuICB9XG59IiwibW9kdWxlLmV4cG9ydHMgPSBleHBvcnRzID0gcmVxdWlyZSgnLi9wcm9taXNlJyk7XG5cbmV4cG9ydHMucmVzb2x2ZSA9IHJlcXVpcmUoJy4vcmVzb2x2ZScpO1xuZXhwb3J0cy5yZWplY3QgPSByZXF1aXJlKCcuL3JlamVjdCcpO1xuZXhwb3J0cy5hbGwgPSByZXF1aXJlKCcuL2FsbCcpO1xuZXhwb3J0cy5yYWNlID0gcmVxdWlyZSgnLi9yYWNlJyk7IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdW53cmFwID0gcmVxdWlyZSgnLi91bndyYXAnKTtcbnZhciBJTlRFUk5BTCA9IHJlcXVpcmUoJy4vSU5URVJOQUwnKTtcbnZhciByZXNvbHZlVGhlbmFibGUgPSByZXF1aXJlKCcuL3Jlc29sdmVUaGVuYWJsZScpO1xudmFyIHN0YXRlcyA9IHJlcXVpcmUoJy4vc3RhdGVzJyk7XG52YXIgUXVldWVJdGVtID0gcmVxdWlyZSgnLi9xdWV1ZUl0ZW0nKTtcblxubW9kdWxlLmV4cG9ydHMgPSBQcm9taXNlO1xuZnVuY3Rpb24gUHJvbWlzZShyZXNvbHZlcikge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgUHJvbWlzZSkpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZXIpO1xuICB9XG4gIGlmICh0eXBlb2YgcmVzb2x2ZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdyZXNvbHZlciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcbiAgfVxuICB0aGlzLnN0YXRlID0gc3RhdGVzLlBFTkRJTkc7XG4gIHRoaXMucXVldWUgPSBbXTtcbiAgdGhpcy5vdXRjb21lID0gdm9pZCAwO1xuICBpZiAocmVzb2x2ZXIgIT09IElOVEVSTkFMKSB7XG4gICAgcmVzb2x2ZVRoZW5hYmxlLnNhZmVseSh0aGlzLCByZXNvbHZlcik7XG4gIH1cbn1cblxuUHJvbWlzZS5wcm90b3R5cGVbJ2NhdGNoJ10gPSBmdW5jdGlvbiAob25SZWplY3RlZCkge1xuICByZXR1cm4gdGhpcy50aGVuKG51bGwsIG9uUmVqZWN0ZWQpO1xufTtcblByb21pc2UucHJvdG90eXBlLnRoZW4gPSBmdW5jdGlvbiAob25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQpIHtcbiAgaWYgKHR5cGVvZiBvbkZ1bGZpbGxlZCAhPT0gJ2Z1bmN0aW9uJyAmJiB0aGlzLnN0YXRlID09PSBzdGF0ZXMuRlVMRklMTEVEIHx8XG4gICAgdHlwZW9mIG9uUmVqZWN0ZWQgIT09ICdmdW5jdGlvbicgJiYgdGhpcy5zdGF0ZSA9PT0gc3RhdGVzLlJFSkVDVEVEKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZShJTlRFUk5BTCk7XG5cbiAgXG4gIGlmICh0aGlzLnN0YXRlICE9PSBzdGF0ZXMuUEVORElORykge1xuICAgIHZhciByZXNvbHZlciA9IHRoaXMuc3RhdGUgPT09IHN0YXRlcy5GVUxGSUxMRUQgPyBvbkZ1bGZpbGxlZDogb25SZWplY3RlZDtcbiAgICB1bndyYXAocHJvbWlzZSwgcmVzb2x2ZXIsIHRoaXMub3V0Y29tZSk7XG4gIH0gZWxzZSB7XG4gICAgdGhpcy5xdWV1ZS5wdXNoKG5ldyBRdWV1ZUl0ZW0ocHJvbWlzZSwgb25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQpKTtcbiAgfVxuXG4gIHJldHVybiBwcm9taXNlO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcbnZhciBoYW5kbGVycyA9IHJlcXVpcmUoJy4vaGFuZGxlcnMnKTtcbnZhciB1bndyYXAgPSByZXF1aXJlKCcuL3Vud3JhcCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFF1ZXVlSXRlbTtcbmZ1bmN0aW9uIFF1ZXVlSXRlbShwcm9taXNlLCBvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCkge1xuICB0aGlzLnByb21pc2UgPSBwcm9taXNlO1xuICBpZiAodHlwZW9mIG9uRnVsZmlsbGVkID09PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhpcy5vbkZ1bGZpbGxlZCA9IG9uRnVsZmlsbGVkO1xuICAgIHRoaXMuY2FsbEZ1bGZpbGxlZCA9IHRoaXMub3RoZXJDYWxsRnVsZmlsbGVkO1xuICB9XG4gIGlmICh0eXBlb2Ygb25SZWplY3RlZCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHRoaXMub25SZWplY3RlZCA9IG9uUmVqZWN0ZWQ7XG4gICAgdGhpcy5jYWxsUmVqZWN0ZWQgPSB0aGlzLm90aGVyQ2FsbFJlamVjdGVkO1xuICB9XG59XG5RdWV1ZUl0ZW0ucHJvdG90eXBlLmNhbGxGdWxmaWxsZWQgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgaGFuZGxlcnMucmVzb2x2ZSh0aGlzLnByb21pc2UsIHZhbHVlKTtcbn07XG5RdWV1ZUl0ZW0ucHJvdG90eXBlLm90aGVyQ2FsbEZ1bGZpbGxlZCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICB1bndyYXAodGhpcy5wcm9taXNlLCB0aGlzLm9uRnVsZmlsbGVkLCB2YWx1ZSk7XG59O1xuUXVldWVJdGVtLnByb3RvdHlwZS5jYWxsUmVqZWN0ZWQgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgaGFuZGxlcnMucmVqZWN0KHRoaXMucHJvbWlzZSwgdmFsdWUpO1xufTtcblF1ZXVlSXRlbS5wcm90b3R5cGUub3RoZXJDYWxsUmVqZWN0ZWQgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgdW53cmFwKHRoaXMucHJvbWlzZSwgdGhpcy5vblJlamVjdGVkLCB2YWx1ZSk7XG59OyIsIid1c2Ugc3RyaWN0JztcbnZhciBQcm9taXNlID0gcmVxdWlyZSgnLi9wcm9taXNlJyk7XG52YXIgcmVqZWN0ID0gcmVxdWlyZSgnLi9yZWplY3QnKTtcbnZhciByZXNvbHZlID0gcmVxdWlyZSgnLi9yZXNvbHZlJyk7XG52YXIgSU5URVJOQUwgPSByZXF1aXJlKCcuL0lOVEVSTkFMJyk7XG52YXIgaGFuZGxlcnMgPSByZXF1aXJlKCcuL2hhbmRsZXJzJyk7XG5tb2R1bGUuZXhwb3J0cyA9IHJhY2U7XG5mdW5jdGlvbiByYWNlKGl0ZXJhYmxlKSB7XG4gIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoaXRlcmFibGUpICE9PSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgcmV0dXJuIHJlamVjdChuZXcgVHlwZUVycm9yKCdtdXN0IGJlIGFuIGFycmF5JykpO1xuICB9XG5cbiAgdmFyIGxlbiA9IGl0ZXJhYmxlLmxlbmd0aDtcbiAgdmFyIGNhbGxlZCA9IGZhbHNlO1xuICBpZiAoIWxlbikge1xuICAgIHJldHVybiByZXNvbHZlKFtdKTtcbiAgfVxuXG4gIHZhciByZXNvbHZlZCA9IDA7XG4gIHZhciBpID0gLTE7XG4gIHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoSU5URVJOQUwpO1xuICBcbiAgd2hpbGUgKCsraSA8IGxlbikge1xuICAgIHJlc29sdmVyKGl0ZXJhYmxlW2ldKTtcbiAgfVxuICByZXR1cm4gcHJvbWlzZTtcbiAgZnVuY3Rpb24gcmVzb2x2ZXIodmFsdWUpIHtcbiAgICByZXNvbHZlKHZhbHVlKS50aGVuKGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgICAgaWYgKCFjYWxsZWQpIHtcbiAgICAgICAgY2FsbGVkID0gdHJ1ZTtcbiAgICAgICAgaGFuZGxlcnMucmVzb2x2ZShwcm9taXNlLCByZXNwb25zZSk7XG4gICAgICB9XG4gICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICBpZiAoIWNhbGxlZCkge1xuICAgICAgICBjYWxsZWQgPSB0cnVlO1xuICAgICAgICBoYW5kbGVycy5yZWplY3QocHJvbWlzZSwgZXJyb3IpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgUHJvbWlzZSA9IHJlcXVpcmUoJy4vcHJvbWlzZScpO1xudmFyIElOVEVSTkFMID0gcmVxdWlyZSgnLi9JTlRFUk5BTCcpO1xudmFyIGhhbmRsZXJzID0gcmVxdWlyZSgnLi9oYW5kbGVycycpO1xubW9kdWxlLmV4cG9ydHMgPSByZWplY3Q7XG5cbmZ1bmN0aW9uIHJlamVjdChyZWFzb24pIHtcblx0dmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZShJTlRFUk5BTCk7XG5cdHJldHVybiBoYW5kbGVycy5yZWplY3QocHJvbWlzZSwgcmVhc29uKTtcbn0iLCIndXNlIHN0cmljdCc7XG5cbnZhciBQcm9taXNlID0gcmVxdWlyZSgnLi9wcm9taXNlJyk7XG52YXIgSU5URVJOQUwgPSByZXF1aXJlKCcuL0lOVEVSTkFMJyk7XG52YXIgaGFuZGxlcnMgPSByZXF1aXJlKCcuL2hhbmRsZXJzJyk7XG5tb2R1bGUuZXhwb3J0cyA9IHJlc29sdmU7XG5cbnZhciBGQUxTRSA9IGhhbmRsZXJzLnJlc29sdmUobmV3IFByb21pc2UoSU5URVJOQUwpLCBmYWxzZSk7XG52YXIgTlVMTCA9IGhhbmRsZXJzLnJlc29sdmUobmV3IFByb21pc2UoSU5URVJOQUwpLCBudWxsKTtcbnZhciBVTkRFRklORUQgPSBoYW5kbGVycy5yZXNvbHZlKG5ldyBQcm9taXNlKElOVEVSTkFMKSwgdm9pZCAwKTtcbnZhciBaRVJPID0gaGFuZGxlcnMucmVzb2x2ZShuZXcgUHJvbWlzZShJTlRFUk5BTCksIDApO1xudmFyIEVNUFRZU1RSSU5HID0gaGFuZGxlcnMucmVzb2x2ZShuZXcgUHJvbWlzZShJTlRFUk5BTCksICcnKTtcblxuZnVuY3Rpb24gcmVzb2x2ZSh2YWx1ZSkge1xuICBpZiAodmFsdWUpIHtcbiAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBQcm9taXNlKSB7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuICAgIHJldHVybiBoYW5kbGVycy5yZXNvbHZlKG5ldyBQcm9taXNlKElOVEVSTkFMKSwgdmFsdWUpO1xuICB9XG4gIHZhciB2YWx1ZVR5cGUgPSB0eXBlb2YgdmFsdWU7XG4gIHN3aXRjaCAodmFsdWVUeXBlKSB7XG4gICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICByZXR1cm4gRkFMU0U7XG4gICAgY2FzZSAndW5kZWZpbmVkJzpcbiAgICAgIHJldHVybiBVTkRFRklORUQ7XG4gICAgY2FzZSAnb2JqZWN0JzpcbiAgICAgIHJldHVybiBOVUxMO1xuICAgIGNhc2UgJ251bWJlcic6XG4gICAgICByZXR1cm4gWkVSTztcbiAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgcmV0dXJuIEVNUFRZU1RSSU5HO1xuICB9XG59IiwiJ3VzZSBzdHJpY3QnO1xudmFyIGhhbmRsZXJzID0gcmVxdWlyZSgnLi9oYW5kbGVycycpO1xudmFyIHRyeUNhdGNoID0gcmVxdWlyZSgnLi90cnlDYXRjaCcpO1xuZnVuY3Rpb24gc2FmZWx5UmVzb2x2ZVRoZW5hYmxlKHNlbGYsIHRoZW5hYmxlKSB7XG4gIC8vIEVpdGhlciBmdWxmaWxsLCByZWplY3Qgb3IgcmVqZWN0IHdpdGggZXJyb3JcbiAgdmFyIGNhbGxlZCA9IGZhbHNlO1xuICBmdW5jdGlvbiBvbkVycm9yKHZhbHVlKSB7XG4gICAgaWYgKGNhbGxlZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjYWxsZWQgPSB0cnVlO1xuICAgIGhhbmRsZXJzLnJlamVjdChzZWxmLCB2YWx1ZSk7XG4gIH1cblxuICBmdW5jdGlvbiBvblN1Y2Nlc3ModmFsdWUpIHtcbiAgICBpZiAoY2FsbGVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNhbGxlZCA9IHRydWU7XG4gICAgaGFuZGxlcnMucmVzb2x2ZShzZWxmLCB2YWx1ZSk7XG4gIH1cblxuICBmdW5jdGlvbiB0cnlUb1Vud3JhcCgpIHtcbiAgICB0aGVuYWJsZShvblN1Y2Nlc3MsIG9uRXJyb3IpO1xuICB9XG4gIFxuICB2YXIgcmVzdWx0ID0gdHJ5Q2F0Y2godHJ5VG9VbndyYXApO1xuICBpZiAocmVzdWx0LnN0YXR1cyA9PT0gJ2Vycm9yJykge1xuICAgIG9uRXJyb3IocmVzdWx0LnZhbHVlKTtcbiAgfVxufVxuZXhwb3J0cy5zYWZlbHkgPSBzYWZlbHlSZXNvbHZlVGhlbmFibGU7IiwiLy8gTGF6eSBtYW4ncyBzeW1ib2xzIGZvciBzdGF0ZXNcblxuZXhwb3J0cy5SRUpFQ1RFRCA9IFsnUkVKRUNURUQnXTtcbmV4cG9ydHMuRlVMRklMTEVEID0gWydGVUxGSUxMRUQnXTtcbmV4cG9ydHMuUEVORElORyA9IFsnUEVORElORyddOyIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSB0cnlDYXRjaDtcblxuZnVuY3Rpb24gdHJ5Q2F0Y2goZnVuYywgdmFsdWUpIHtcbiAgdmFyIG91dCA9IHt9O1xuICB0cnkge1xuICAgIG91dC52YWx1ZSA9IGZ1bmModmFsdWUpO1xuICAgIG91dC5zdGF0dXMgPSAnc3VjY2Vzcyc7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBvdXQuc3RhdHVzID0gJ2Vycm9yJztcbiAgICBvdXQudmFsdWUgPSBlO1xuICB9XG4gIHJldHVybiBvdXQ7XG59IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgaW1tZWRpYXRlID0gcmVxdWlyZSgnaW1tZWRpYXRlJyk7XG52YXIgaGFuZGxlcnMgPSByZXF1aXJlKCcuL2hhbmRsZXJzJyk7XG5tb2R1bGUuZXhwb3J0cyA9IHVud3JhcDtcblxuZnVuY3Rpb24gdW53cmFwKHByb21pc2UsIGZ1bmMsIHZhbHVlKSB7XG4gIGltbWVkaWF0ZShmdW5jdGlvbigpIHtcbiAgICB2YXIgcmV0dXJuVmFsdWU7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVyblZhbHVlID0gZnVuYyh2YWx1ZSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdmFyIGhhbmRsZXIgPSBoYW5kbGVycy5yZWplY3QocHJvbWlzZSwgZSk7XG4gICAgICBpZiAoIWhhbmRsZXIucXVldWUubGVuZ3RoKSB7XG4gICAgICAgIC8vIEVuc3VyZSB0aGF0IGVycm9ycyBhcmUgbm90IGNvbXBsZXRlbHkgc3dhbGxvd2VkLlxuICAgICAgICBjb25zb2xlLmVycm9yKGUpO1xuICAgICAgICBjb25zb2xlLmVycm9yKCdVbmhhbmRsZWQgZXJyb3IgaW4gcHJvbWlzZSBjaGFpbicsIHtcbiAgICAgICAgICBlcnJvcjogZSxcbiAgICAgICAgICBmdW5jOiBmdW5jLFxuICAgICAgICAgIHZhbHVlOiB2YWx1ZSxcbiAgICAgICAgICBmdW5jQXNTdHJpbmc6IGZ1bmMudG9TdHJpbmcoKVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBoYW5kbGVyO1xuICAgIH1cbiAgICBpZiAocmV0dXJuVmFsdWUgPT09IHByb21pc2UpIHtcbiAgICAgIGhhbmRsZXJzLnJlamVjdChwcm9taXNlLCBuZXcgVHlwZUVycm9yKCdDYW5ub3QgcmVzb2x2ZSBwcm9taXNlIHdpdGggaXRzZWxmJykpO1xuICAgIH0gZWxzZSB7XG4gICAgICBoYW5kbGVycy5yZXNvbHZlKHByb21pc2UsIHJldHVyblZhbHVlKTtcbiAgICB9XG4gIH0pO1xufSIsIid1c2Ugc3RyaWN0JztcbnZhciB0eXBlcyA9IFtcbiAgcmVxdWlyZSgnLi9uZXh0VGljaycpLFxuICByZXF1aXJlKCcuL211dGF0aW9uLmpzJyksXG4gIHJlcXVpcmUoJy4vbWVzc2FnZUNoYW5uZWwnKSxcbiAgcmVxdWlyZSgnLi9zdGF0ZUNoYW5nZScpLFxuICByZXF1aXJlKCcuL3RpbWVvdXQnKVxuXTtcbnZhciBkcmFpbmluZztcbnZhciBxdWV1ZSA9IFtdO1xuLy9uYW1lZCBuZXh0VGljayBmb3IgbGVzcyBjb25mdXNpbmcgc3RhY2sgdHJhY2VzXG5mdW5jdGlvbiBuZXh0VGljaygpIHtcbiAgZHJhaW5pbmcgPSB0cnVlO1xuICB2YXIgaSwgb2xkUXVldWU7XG4gIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gIHdoaWxlIChsZW4pIHtcbiAgICBvbGRRdWV1ZSA9IHF1ZXVlO1xuICAgIHF1ZXVlID0gW107XG4gICAgaSA9IC0xO1xuICAgIHdoaWxlICgrK2kgPCBsZW4pIHtcbiAgICAgIG9sZFF1ZXVlW2ldKCk7XG4gICAgfVxuICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgfVxuICBkcmFpbmluZyA9IGZhbHNlO1xufVxudmFyIHNjaGVkdWxlRHJhaW47XG52YXIgaSA9IC0xO1xudmFyIGxlbiA9IHR5cGVzLmxlbmd0aDtcbndoaWxlICgrKyBpIDwgbGVuKSB7XG4gIGlmICh0eXBlc1tpXSAmJiB0eXBlc1tpXS50ZXN0ICYmIHR5cGVzW2ldLnRlc3QoKSkge1xuICAgIHNjaGVkdWxlRHJhaW4gPSB0eXBlc1tpXS5pbnN0YWxsKG5leHRUaWNrKTtcbiAgICBicmVhaztcbiAgfVxufVxubW9kdWxlLmV4cG9ydHMgPSBpbW1lZGlhdGU7XG5mdW5jdGlvbiBpbW1lZGlhdGUodGFzaykge1xuICBpZiAocXVldWUucHVzaCh0YXNrKSA9PT0gMSAmJiAhZHJhaW5pbmcpIHtcbiAgICBzY2hlZHVsZURyYWluKCk7XG4gIH1cbn0iLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG4ndXNlIHN0cmljdCc7XG5cbmV4cG9ydHMudGVzdCA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKGdsb2JhbC5zZXRJbW1lZGlhdGUpIHtcbiAgICAvLyB3ZSBjYW4gb25seSBnZXQgaGVyZSBpbiBJRTEwXG4gICAgLy8gd2hpY2ggZG9lc24ndCBoYW5kZWwgcG9zdE1lc3NhZ2Ugd2VsbFxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICByZXR1cm4gdHlwZW9mIGdsb2JhbC5NZXNzYWdlQ2hhbm5lbCAhPT0gJ3VuZGVmaW5lZCc7XG59O1xuXG5leHBvcnRzLmluc3RhbGwgPSBmdW5jdGlvbiAoZnVuYykge1xuICB2YXIgY2hhbm5lbCA9IG5ldyBnbG9iYWwuTWVzc2FnZUNoYW5uZWwoKTtcbiAgY2hhbm5lbC5wb3J0MS5vbm1lc3NhZ2UgPSBmdW5jO1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIGNoYW5uZWwucG9ydDIucG9zdE1lc3NhZ2UoMCk7XG4gIH07XG59O1xufSkuY2FsbCh0aGlzLHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pIiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuJ3VzZSBzdHJpY3QnO1xuLy9iYXNlZCBvZmYgcnN2cCBodHRwczovL2dpdGh1Yi5jb20vdGlsZGVpby9yc3ZwLmpzXG4vL2xpY2Vuc2UgaHR0cHM6Ly9naXRodWIuY29tL3RpbGRlaW8vcnN2cC5qcy9ibG9iL21hc3Rlci9MSUNFTlNFXG4vL2h0dHBzOi8vZ2l0aHViLmNvbS90aWxkZWlvL3JzdnAuanMvYmxvYi9tYXN0ZXIvbGliL3JzdnAvYXNhcC5qc1xuXG52YXIgTXV0YXRpb24gPSBnbG9iYWwuTXV0YXRpb25PYnNlcnZlciB8fCBnbG9iYWwuV2ViS2l0TXV0YXRpb25PYnNlcnZlcjtcblxuZXhwb3J0cy50ZXN0ID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gTXV0YXRpb247XG59O1xuXG5leHBvcnRzLmluc3RhbGwgPSBmdW5jdGlvbiAoaGFuZGxlKSB7XG4gIHZhciBjYWxsZWQgPSAwO1xuICB2YXIgb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb24oaGFuZGxlKTtcbiAgdmFyIGVsZW1lbnQgPSBnbG9iYWwuZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJycpO1xuICBvYnNlcnZlci5vYnNlcnZlKGVsZW1lbnQsIHtcbiAgICBjaGFyYWN0ZXJEYXRhOiB0cnVlXG4gIH0pO1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIGVsZW1lbnQuZGF0YSA9IChjYWxsZWQgPSArK2NhbGxlZCAlIDIpO1xuICB9O1xufTtcbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KSIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy50ZXN0ID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gJ2RvY3VtZW50JyBpbiBnbG9iYWwgJiYgJ29ucmVhZHlzdGF0ZWNoYW5nZScgaW4gZ2xvYmFsLmRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpO1xufTtcblxuZXhwb3J0cy5pbnN0YWxsID0gZnVuY3Rpb24gKGhhbmRsZSkge1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuXG4gICAgLy8gQ3JlYXRlIGEgPHNjcmlwdD4gZWxlbWVudDsgaXRzIHJlYWR5c3RhdGVjaGFuZ2UgZXZlbnQgd2lsbCBiZSBmaXJlZCBhc3luY2hyb25vdXNseSBvbmNlIGl0IGlzIGluc2VydGVkXG4gICAgLy8gaW50byB0aGUgZG9jdW1lbnQuIERvIHNvLCB0aHVzIHF1ZXVpbmcgdXAgdGhlIHRhc2suIFJlbWVtYmVyIHRvIGNsZWFuIHVwIG9uY2UgaXQncyBiZWVuIGNhbGxlZC5cbiAgICB2YXIgc2NyaXB0RWwgPSBnbG9iYWwuZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XG4gICAgc2NyaXB0RWwub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24gKCkge1xuICAgICAgaGFuZGxlKCk7XG5cbiAgICAgIHNjcmlwdEVsLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IG51bGw7XG4gICAgICBzY3JpcHRFbC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHNjcmlwdEVsKTtcbiAgICAgIHNjcmlwdEVsID0gbnVsbDtcbiAgICB9O1xuICAgIGdsb2JhbC5kb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuYXBwZW5kQ2hpbGQoc2NyaXB0RWwpO1xuXG4gICAgcmV0dXJuIGhhbmRsZTtcbiAgfTtcbn07XG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSkiLCIndXNlIHN0cmljdCc7XG5leHBvcnRzLnRlc3QgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0cnVlO1xufTtcblxuZXhwb3J0cy5pbnN0YWxsID0gZnVuY3Rpb24gKHQpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICBzZXRUaW1lb3V0KHQsIDApO1xuICB9O1xufTsiLCIoZnVuY3Rpb24oKSB7XG4gIGlmICh0eXBlb2Ygc2llc3RhID09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBtb2R1bGUgPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIHdpbmRvdy5zaWVzdGEuIE1ha2Ugc3VyZSB5b3UgaW5jbHVkZSBzaWVzdGEuY29yZS5qcyBmaXJzdC4nKTtcbiAgfVxuXG4gIHZhciBfaSA9IHNpZXN0YS5faW50ZXJuYWwsXG4gICAgY2FjaGUgPSBfaS5jYWNoZSxcbiAgICBDb2xsZWN0aW9uUmVnaXN0cnkgPSBfaS5Db2xsZWN0aW9uUmVnaXN0cnksXG4gICAgbG9nID0gX2kubG9nKCdzdG9yYWdlJyksXG4gICAgZXJyb3IgPSBfaS5lcnJvcixcbiAgICB1dGlsID0gX2kudXRpbCxcbiAgICBfID0gdXRpbC5fLFxuICAgIGV2ZW50cyA9IF9pLmV2ZW50cztcblxuICB2YXIgdW5zYXZlZE9iamVjdHMgPSBbXSxcbiAgICB1bnNhdmVkT2JqZWN0c0hhc2ggPSB7fSxcbiAgICB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbiA9IHt9O1xuXG4gIHZhciBzdG9yYWdlID0ge307XG5cbiAgLy8gVmFyaWFibGVzIGJlZ2lubmluZyB3aXRoIHVuZGVyc2NvcmUgYXJlIHRyZWF0ZWQgYXMgc3BlY2lhbCBieSBQb3VjaERCL0NvdWNoREIgc28gd2hlbiBzZXJpYWxpc2luZyB3ZSBuZWVkIHRvXG4gIC8vIHJlcGxhY2Ugd2l0aCBzb21ldGhpbmcgZWxzZS5cbiAgdmFyIFVOREVSU0NPUkUgPSAvXy9nLFxuICAgIFVOREVSU0NPUkVfUkVQTEFDRU1FTlQgPSAvQC9nO1xuXG4gIGZ1bmN0aW9uIF9pbml0TWV0YSgpIHtcbiAgICByZXR1cm4ge2RhdGVGaWVsZHM6IFtdfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGZ1bGx5UXVhbGlmaWVkTW9kZWxOYW1lKGNvbGxlY3Rpb25OYW1lLCBtb2RlbE5hbWUpIHtcbiAgICByZXR1cm4gY29sbGVjdGlvbk5hbWUgKyAnLicgKyBtb2RlbE5hbWU7XG4gIH1cblxuICBpZiAodHlwZW9mIFBvdWNoREIgPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBzaWVzdGEuZXh0LnN0b3JhZ2VFbmFibGVkID0gZmFsc2U7XG4gICAgY29uc29sZS5sb2coJ1BvdWNoREIgaXMgbm90IHByZXNlbnQgdGhlcmVmb3JlIHN0b3JhZ2UgaXMgZGlzYWJsZWQuJyk7XG4gIH1cbiAgZWxzZSB7XG4gICAgdmFyIERCX05BTUUgPSAnc2llc3RhJyxcbiAgICAgIHBvdWNoID0gbmV3IFBvdWNoREIoREJfTkFNRSwge2F1dG9fY29tcGFjdGlvbjogdHJ1ZX0pO1xuXG4gICAgLyoqXG4gICAgICogU29tZXRpbWVzIHNpZXN0YSBuZWVkcyB0byBzdG9yZSBzb21lIGV4dHJhIGluZm9ybWF0aW9uIGFib3V0IHRoZSBtb2RlbCBpbnN0YW5jZS5cbiAgICAgKiBAcGFyYW0gc2VyaWFsaXNlZFxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgZnVuY3Rpb24gX2FkZE1ldGEoc2VyaWFsaXNlZCkge1xuICAgICAgLy8gUG91Y2hEQiA8PSAzLjIuMSBoYXMgYSBidWcgd2hlcmVieSBkYXRlIGZpZWxkcyBhcmUgbm90IGRlc2VyaWFsaXNlZCBwcm9wZXJseSBpZiB5b3UgdXNlIGRiLnF1ZXJ5XG4gICAgICAvLyB0aGVyZWZvcmUgd2UgbmVlZCB0byBhZGQgZXh0cmEgaW5mbyB0byB0aGUgb2JqZWN0IGZvciBkZXNlcmlhbGlzaW5nIGRhdGVzIG1hbnVhbGx5LlxuICAgICAgc2VyaWFsaXNlZC5zaWVzdGFfbWV0YSA9IF9pbml0TWV0YSgpO1xuICAgICAgZm9yICh2YXIgcHJvcCBpbiBzZXJpYWxpc2VkKSB7XG4gICAgICAgIGlmIChzZXJpYWxpc2VkLmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgICAgaWYgKHNlcmlhbGlzZWRbcHJvcF0gaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgICAgICAgICBzZXJpYWxpc2VkLnNpZXN0YV9tZXRhLmRhdGVGaWVsZHMucHVzaChwcm9wKTtcbiAgICAgICAgICAgIHNlcmlhbGlzZWRbcHJvcF0gPSBzZXJpYWxpc2VkW3Byb3BdLmdldFRpbWUoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfcHJvY2Vzc01ldGEoZGF0dW0pIHtcbiAgICAgIHZhciBtZXRhID0gZGF0dW0uc2llc3RhX21ldGEgfHwgX2luaXRNZXRhKCk7XG4gICAgICBtZXRhLmRhdGVGaWVsZHMuZm9yRWFjaChmdW5jdGlvbihkYXRlRmllbGQpIHtcbiAgICAgICAgdmFyIHZhbHVlID0gZGF0dW1bZGF0ZUZpZWxkXTtcbiAgICAgICAgaWYgKCEodmFsdWUgaW5zdGFuY2VvZiBEYXRlKSkge1xuICAgICAgICAgIGRhdHVtW2RhdGVGaWVsZF0gPSBuZXcgRGF0ZSh2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgZGVsZXRlIGRhdHVtLnNpZXN0YV9tZXRhO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNvbnN0cnVjdEluZGV4RGVzaWduRG9jKGNvbGxlY3Rpb25OYW1lLCBtb2RlbE5hbWUpIHtcbiAgICAgIHZhciBmdWxseVF1YWxpZmllZE5hbWUgPSBmdWxseVF1YWxpZmllZE1vZGVsTmFtZShjb2xsZWN0aW9uTmFtZSwgbW9kZWxOYW1lKTtcbiAgICAgIHZhciB2aWV3cyA9IHt9O1xuICAgICAgdmlld3NbZnVsbHlRdWFsaWZpZWROYW1lXSA9IHtcbiAgICAgICAgbWFwOiBmdW5jdGlvbihkb2MpIHtcbiAgICAgICAgICBpZiAoZG9jLmNvbGxlY3Rpb24gPT0gJyQxJyAmJiBkb2MubW9kZWwgPT0gJyQyJykgZW1pdChkb2MuY29sbGVjdGlvbiArICcuJyArIGRvYy5tb2RlbCwgZG9jKTtcbiAgICAgICAgfS50b1N0cmluZygpLnJlcGxhY2UoJyQxJywgY29sbGVjdGlvbk5hbWUpLnJlcGxhY2UoJyQyJywgbW9kZWxOYW1lKVxuICAgICAgfTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIF9pZDogJ19kZXNpZ24vJyArIGZ1bGx5UXVhbGlmaWVkTmFtZSxcbiAgICAgICAgdmlld3M6IHZpZXdzXG4gICAgICB9O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNvbnN0cnVjdEluZGV4ZXNGb3JBbGxNb2RlbHMoKSB7XG4gICAgICB2YXIgaW5kZXhlcyA9IFtdO1xuICAgICAgdmFyIHJlZ2lzdHJ5ID0gc2llc3RhLl9pbnRlcm5hbC5Db2xsZWN0aW9uUmVnaXN0cnk7XG4gICAgICByZWdpc3RyeS5jb2xsZWN0aW9uTmFtZXMuZm9yRWFjaChmdW5jdGlvbihjb2xsZWN0aW9uTmFtZSkge1xuICAgICAgICB2YXIgbW9kZWxzID0gcmVnaXN0cnlbY29sbGVjdGlvbk5hbWVdLl9tb2RlbHM7XG4gICAgICAgIGZvciAodmFyIG1vZGVsTmFtZSBpbiBtb2RlbHMpIHtcbiAgICAgICAgICBpZiAobW9kZWxzLmhhc093blByb3BlcnR5KG1vZGVsTmFtZSkpIHtcbiAgICAgICAgICAgIGluZGV4ZXMucHVzaChjb25zdHJ1Y3RJbmRleERlc2lnbkRvYyhjb2xsZWN0aW9uTmFtZSwgbW9kZWxOYW1lKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBpbmRleGVzO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9fZW5zdXJlSW5kZXhlcyhpbmRleGVzLCBjYikge1xuICAgICAgcG91Y2guYnVsa0RvY3MoaW5kZXhlcylcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24ocmVzcCkge1xuICAgICAgICAgIHZhciBlcnJvcnMgPSBbXTtcbiAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlc3AubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciByZXNwb25zZSA9IHJlc3BbaV07XG4gICAgICAgICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICAgICAgICAgIC8vIENvbmZsaWN0IG1lYW5zIGFscmVhZHkgZXhpc3RzLCBhbmQgdGhpcyBpcyBmaW5lIVxuICAgICAgICAgICAgICB2YXIgaXNDb25mbGljdCA9IHJlc3BvbnNlLnN0YXR1cyA9PSA0MDk7XG4gICAgICAgICAgICAgIGlmICghaXNDb25mbGljdCkgZXJyb3JzLnB1c2gocmVzcG9uc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBjYihlcnJvcnMubGVuZ3RoID8gZXJyb3IoJ211bHRpcGxlIGVycm9ycycsIHtlcnJvcnM6IGVycm9yc30pIDogbnVsbCk7XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaChjYik7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZW5zdXJlSW5kZXhlc0ZvckFsbChjYikge1xuICAgICAgdmFyIGluZGV4ZXMgPSBjb25zdHJ1Y3RJbmRleGVzRm9yQWxsTW9kZWxzKCk7XG4gICAgICBfX2Vuc3VyZUluZGV4ZXMoaW5kZXhlcywgY2IpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNlcmlhbGlzZSBhIG1vZGVsIGludG8gYSBmb3JtYXQgdGhhdCBQb3VjaERCIGJ1bGtEb2NzIEFQSSBjYW4gcHJvY2Vzc1xuICAgICAqIEBwYXJhbSB7TW9kZWxJbnN0YW5jZX0gbW9kZWxJbnN0YW5jZVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9zZXJpYWxpc2UobW9kZWxJbnN0YW5jZSkge1xuICAgICAgdmFyIHNlcmlhbGlzZWQgPSB7fTtcbiAgICAgIHZhciBfX3ZhbHVlcyA9IG1vZGVsSW5zdGFuY2UuX192YWx1ZXM7XG4gICAgICBzZXJpYWxpc2VkID0gc2llc3RhLl8uZXh0ZW5kKHNlcmlhbGlzZWQsIF9fdmFsdWVzKTtcbiAgICAgIE9iamVjdC5rZXlzKHNlcmlhbGlzZWQpLmZvckVhY2goZnVuY3Rpb24oaykge1xuICAgICAgICBzZXJpYWxpc2VkW2sucmVwbGFjZShVTkRFUlNDT1JFLCAnQCcpXSA9IF9fdmFsdWVzW2tdO1xuICAgICAgfSk7XG4gICAgICBfYWRkTWV0YShzZXJpYWxpc2VkKTtcbiAgICAgIHNlcmlhbGlzZWRbJ2NvbGxlY3Rpb24nXSA9IG1vZGVsSW5zdGFuY2UuY29sbGVjdGlvbk5hbWU7XG4gICAgICBzZXJpYWxpc2VkWydtb2RlbCddID0gbW9kZWxJbnN0YW5jZS5tb2RlbE5hbWU7XG4gICAgICBzZXJpYWxpc2VkWydfaWQnXSA9IG1vZGVsSW5zdGFuY2UubG9jYWxJZDtcbiAgICAgIGlmIChtb2RlbEluc3RhbmNlLnJlbW92ZWQpIHNlcmlhbGlzZWRbJ19kZWxldGVkJ10gPSB0cnVlO1xuICAgICAgdmFyIHJldiA9IG1vZGVsSW5zdGFuY2UuX3JldjtcbiAgICAgIGlmIChyZXYpIHNlcmlhbGlzZWRbJ19yZXYnXSA9IHJldjtcbiAgICAgIHNlcmlhbGlzZWQgPSBfLnJlZHVjZShtb2RlbEluc3RhbmNlLl9yZWxhdGlvbnNoaXBOYW1lcywgZnVuY3Rpb24obWVtbywgbikge1xuICAgICAgICB2YXIgdmFsID0gbW9kZWxJbnN0YW5jZVtuXTtcbiAgICAgICAgaWYgKHNpZXN0YS5pc0FycmF5KHZhbCkpIHtcbiAgICAgICAgICBtZW1vW25dID0gXy5wbHVjayh2YWwsICdsb2NhbElkJyk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodmFsKSB7XG4gICAgICAgICAgbWVtb1tuXSA9IHZhbC5sb2NhbElkO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgfSwgc2VyaWFsaXNlZCk7XG4gICAgICByZXR1cm4gc2VyaWFsaXNlZDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfcHJlcGFyZURhdHVtKHJhd0RhdHVtLCBtb2RlbCkge1xuICAgICAgX3Byb2Nlc3NNZXRhKHJhd0RhdHVtKTtcbiAgICAgIGRlbGV0ZSByYXdEYXR1bS5jb2xsZWN0aW9uO1xuICAgICAgZGVsZXRlIHJhd0RhdHVtLm1vZGVsO1xuICAgICAgcmF3RGF0dW0ubG9jYWxJZCA9IHJhd0RhdHVtLl9pZDtcbiAgICAgIGRlbGV0ZSByYXdEYXR1bS5faWQ7XG4gICAgICB2YXIgZGF0dW0gPSB7fTtcbiAgICAgIE9iamVjdC5rZXlzKHJhd0RhdHVtKS5mb3JFYWNoKGZ1bmN0aW9uKGspIHtcbiAgICAgICAgZGF0dW1bay5yZXBsYWNlKFVOREVSU0NPUkVfUkVQTEFDRU1FTlQsICdfJyldID0gcmF3RGF0dW1ba107XG4gICAgICB9KTtcblxuICAgICAgdmFyIHJlbGF0aW9uc2hpcE5hbWVzID0gbW9kZWwuX3JlbGF0aW9uc2hpcE5hbWVzO1xuICAgICAgXy5lYWNoKHJlbGF0aW9uc2hpcE5hbWVzLCBmdW5jdGlvbihyKSB7XG4gICAgICAgIHZhciBsb2NhbElkID0gZGF0dW1bcl07XG4gICAgICAgIGlmIChsb2NhbElkKSB7XG4gICAgICAgICAgaWYgKHNpZXN0YS5pc0FycmF5KGxvY2FsSWQpKSB7XG4gICAgICAgICAgICBkYXR1bVtyXSA9IF8ubWFwKGxvY2FsSWQsIGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHtsb2NhbElkOiB4fVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgZGF0dW1bcl0gPSB7bG9jYWxJZDogbG9jYWxJZH07XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIGRhdHVtO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIG9wdHNcbiAgICAgKiBAcGFyYW0gb3B0cy5jb2xsZWN0aW9uTmFtZVxuICAgICAqIEBwYXJhbSBvcHRzLm1vZGVsTmFtZVxuICAgICAqIEBwYXJhbSBjYWxsYmFja1xuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgZnVuY3Rpb24gX2xvYWRNb2RlbChvcHRzLCBjYWxsYmFjaykge1xuICAgICAgdmFyIGxvYWRlZCA9IHt9O1xuICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gb3B0cy5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgbW9kZWxOYW1lID0gb3B0cy5tb2RlbE5hbWU7XG4gICAgICB2YXIgZnVsbHlRdWFsaWZpZWROYW1lID0gZnVsbHlRdWFsaWZpZWRNb2RlbE5hbWUoY29sbGVjdGlvbk5hbWUsIG1vZGVsTmFtZSk7XG4gICAgICBsb2coJ0xvYWRpbmcgaW5zdGFuY2VzIGZvciAnICsgZnVsbHlRdWFsaWZpZWROYW1lKTtcbiAgICAgIHZhciBNb2RlbCA9IENvbGxlY3Rpb25SZWdpc3RyeVtjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXTtcbiAgICAgIGxvZygnUXVlcnlpbmcgcG91Y2gnKTtcbiAgICAgIHBvdWNoLnF1ZXJ5KGZ1bGx5UXVhbGlmaWVkTmFtZSlcbiAgICAgICAgLy9wb3VjaC5xdWVyeSh7bWFwOiBtYXBGdW5jfSlcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24ocmVzcCkge1xuICAgICAgICAgIGxvZygnUXVlcmllZCBwb3VjaCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgICB2YXIgcm93cyA9IHJlc3Aucm93cztcbiAgICAgICAgICB2YXIgZGF0YSA9IHNpZXN0YS5fLm1hcChzaWVzdGEuXy5wbHVjayhyb3dzLCAndmFsdWUnKSwgZnVuY3Rpb24oZGF0dW0pIHtcbiAgICAgICAgICAgIHJldHVybiBfcHJlcGFyZURhdHVtKGRhdHVtLCBNb2RlbCk7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICBzaWVzdGEuXy5tYXAoZGF0YSwgZnVuY3Rpb24oZGF0dW0pIHtcbiAgICAgICAgICAgIHZhciByZW1vdGVJZCA9IGRhdHVtW01vZGVsLmlkXTtcbiAgICAgICAgICAgIGlmIChyZW1vdGVJZCkge1xuICAgICAgICAgICAgICBpZiAobG9hZGVkW3JlbW90ZUlkXSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0R1cGxpY2F0ZXMgZGV0ZWN0ZWQgaW4gc3RvcmFnZS4gWW91IGhhdmUgZW5jb3VudGVyZWQgYSBzZXJpb3VzIGJ1Zy4gUGxlYXNlIHJlcG9ydCB0aGlzLicpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGxvYWRlZFtyZW1vdGVJZF0gPSBkYXR1bTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgbG9nKCdNYXBwaW5nIGRhdGEnLCBkYXRhKTtcblxuICAgICAgICAgIE1vZGVsLmdyYXBoKGRhdGEsIHtcbiAgICAgICAgICAgIF9pZ25vcmVJbnN0YWxsZWQ6IHRydWUsXG4gICAgICAgICAgICBmcm9tU3RvcmFnZTogdHJ1ZVxuICAgICAgICAgIH0sIGZ1bmN0aW9uKGVyciwgaW5zdGFuY2VzKSB7XG4gICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICBpZiAobG9nLmVuYWJsZWQpXG4gICAgICAgICAgICAgICAgbG9nKCdMb2FkZWQgJyArIGluc3RhbmNlcyA/IGluc3RhbmNlcy5sZW5ndGgudG9TdHJpbmcoKSA6IDAgKyAnIGluc3RhbmNlcyBmb3IgJyArIGZ1bGx5UXVhbGlmaWVkTmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgbG9nKCdFcnJvciBsb2FkaW5nIG1vZGVscycsIGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYWxsYmFjayhlcnIsIGluc3RhbmNlcyk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICB9KTtcblxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExvYWQgYWxsIGRhdGEgZnJvbSBQb3VjaERCLlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9sb2FkKGNiKSB7XG4gICAgICBpZiAoc2F2aW5nKSB0aHJvdyBuZXcgRXJyb3IoJ25vdCBsb2FkZWQgeWV0IGhvdyBjYW4gaSBzYXZlJyk7XG4gICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgICBpZiAoc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCkge1xuICAgICAgICAgIHZhciBjb2xsZWN0aW9uTmFtZXMgPSBDb2xsZWN0aW9uUmVnaXN0cnkuY29sbGVjdGlvbk5hbWVzO1xuICAgICAgICAgIHZhciB0YXNrcyA9IFtdO1xuICAgICAgICAgIF8uZWFjaChjb2xsZWN0aW9uTmFtZXMsIGZ1bmN0aW9uKGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgICAgICAgICB2YXIgY29sbGVjdGlvbiA9IENvbGxlY3Rpb25SZWdpc3RyeVtjb2xsZWN0aW9uTmFtZV0sXG4gICAgICAgICAgICAgIG1vZGVsTmFtZXMgPSBPYmplY3Qua2V5cyhjb2xsZWN0aW9uLl9tb2RlbHMpO1xuICAgICAgICAgICAgXy5lYWNoKG1vZGVsTmFtZXMsIGZ1bmN0aW9uKG1vZGVsTmFtZSkge1xuICAgICAgICAgICAgICB0YXNrcy5wdXNoKGZ1bmN0aW9uKGNiKSB7XG4gICAgICAgICAgICAgICAgLy8gV2UgY2FsbCBmcm9tIHN0b3JhZ2UgdG8gYWxsb3cgZm9yIHJlcGxhY2VtZW50IG9mIF9sb2FkTW9kZWwgZm9yIHBlcmZvcm1hbmNlIGV4dGVuc2lvbi5cbiAgICAgICAgICAgICAgICBzdG9yYWdlLl9sb2FkTW9kZWwoe1xuICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbk5hbWU6IGNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgICAgICAgbW9kZWxOYW1lOiBtb2RlbE5hbWVcbiAgICAgICAgICAgICAgICB9LCBjYik7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgc2llc3RhLmFzeW5jLnNlcmllcyh0YXNrcywgZnVuY3Rpb24oZXJyLCByZXN1bHRzKSB7XG4gICAgICAgICAgICB2YXIgbjtcbiAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgIHZhciBpbnN0YW5jZXMgPSBbXTtcbiAgICAgICAgICAgICAgc2llc3RhLl8uZWFjaChyZXN1bHRzLCBmdW5jdGlvbihyKSB7XG4gICAgICAgICAgICAgICAgaW5zdGFuY2VzID0gaW5zdGFuY2VzLmNvbmNhdChyKVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgbiA9IGluc3RhbmNlcy5sZW5ndGg7XG4gICAgICAgICAgICAgIGlmIChsb2cpIHtcbiAgICAgICAgICAgICAgICBsb2coJ0xvYWRlZCAnICsgbi50b1N0cmluZygpICsgJyBpbnN0YW5jZXMuIENhY2hlIHNpemUgaXMgJyArIGNhY2hlLmNvdW50KCksIHtcbiAgICAgICAgICAgICAgICAgIHJlbW90ZTogY2FjaGUuX3JlbW90ZUNhY2hlKCksXG4gICAgICAgICAgICAgICAgICBsb2NhbENhY2hlOiBjYWNoZS5fbG9jYWxDYWNoZSgpXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgc2llc3RhLm9uKCdTaWVzdGEnLCBsaXN0ZW5lcik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNiKGVyciwgbik7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgY2IoKTtcbiAgICAgICAgfVxuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzYXZlQ29uZmxpY3RzKG9iamVjdHMsIGNiKSB7XG4gICAgICBwb3VjaC5hbGxEb2NzKHtrZXlzOiBfLnBsdWNrKG9iamVjdHMsICdsb2NhbElkJyl9KVxuICAgICAgICAudGhlbihmdW5jdGlvbihyZXNwKSB7XG4gICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXNwLnJvd3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIG9iamVjdHNbaV0uX3JldiA9IHJlc3Aucm93c1tpXS52YWx1ZS5yZXY7XG4gICAgICAgICAgfVxuICAgICAgICAgIHNhdmVUb1BvdWNoKG9iamVjdHMsIGNiKTtcbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgIGNiKGVycik7XG4gICAgICAgIH0pXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2F2ZVRvUG91Y2gob2JqZWN0cywgY2IpIHtcbiAgICAgIHZhciBjb25mbGljdHMgPSBbXTtcbiAgICAgIHZhciBzZXJpYWxpc2VkRG9jcyA9IF8ubWFwKG9iamVjdHMsIF9zZXJpYWxpc2UpO1xuICAgICAgcG91Y2guYnVsa0RvY3Moc2VyaWFsaXNlZERvY3MpLnRoZW4oZnVuY3Rpb24ocmVzcCkge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlc3AubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICB2YXIgcmVzcG9uc2UgPSByZXNwW2ldO1xuICAgICAgICAgIHZhciBvYmogPSBvYmplY3RzW2ldO1xuICAgICAgICAgIGlmIChyZXNwb25zZS5vaykge1xuICAgICAgICAgICAgb2JqLl9yZXYgPSByZXNwb25zZS5yZXY7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2UgaWYgKHJlc3BvbnNlLnN0YXR1cyA9PSA0MDkpIHtcbiAgICAgICAgICAgIGNvbmZsaWN0cy5wdXNoKG9iaik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgbG9nKCdFcnJvciBzYXZpbmcgb2JqZWN0IHdpdGggbG9jYWxJZD1cIicgKyBvYmoubG9jYWxJZCArICdcIicsIHJlc3BvbnNlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvbmZsaWN0cy5sZW5ndGgpIHtcbiAgICAgICAgICBzYXZlQ29uZmxpY3RzKGNvbmZsaWN0cywgY2IpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGNiKCk7XG4gICAgICAgIH1cbiAgICAgIH0sIGZ1bmN0aW9uKGVycikge1xuICAgICAgICBjYihlcnIpO1xuICAgICAgfSk7XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBTYXZlIGFsbCBtb2RlbEV2ZW50cyBkb3duIHRvIFBvdWNoREIuXG4gICAgICovXG4gICAgZnVuY3Rpb24gc2F2ZShjYikge1xuICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgICAgc2llc3RhLl9hZnRlckluc3RhbGwoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIGluc3RhbmNlcyA9IHVuc2F2ZWRPYmplY3RzO1xuICAgICAgICAgIHVuc2F2ZWRPYmplY3RzID0gW107XG4gICAgICAgICAgdW5zYXZlZE9iamVjdHNIYXNoID0ge307XG4gICAgICAgICAgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb24gPSB7fTtcbiAgICAgICAgICBzYXZlVG9Qb3VjaChpbnN0YW5jZXMsIGNiKTtcbiAgICAgICAgfSk7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpc3RlbmVyKG4pIHtcbiAgICAgIHZhciBjaGFuZ2VkT2JqZWN0ID0gbi5vYmosXG4gICAgICAgIGlkZW50ID0gY2hhbmdlZE9iamVjdC5sb2NhbElkO1xuICAgICAgaWYgKCFjaGFuZ2VkT2JqZWN0KSB7XG4gICAgICAgIHRocm93IG5ldyBfaS5lcnJvci5JbnRlcm5hbFNpZXN0YUVycm9yKCdObyBvYmogZmllbGQgaW4gbm90aWZpY2F0aW9uIHJlY2VpdmVkIGJ5IHN0b3JhZ2UgZXh0ZW5zaW9uJyk7XG4gICAgICB9XG4gICAgICBpZiAoIShpZGVudCBpbiB1bnNhdmVkT2JqZWN0c0hhc2gpKSB7XG4gICAgICAgIHVuc2F2ZWRPYmplY3RzSGFzaFtpZGVudF0gPSBjaGFuZ2VkT2JqZWN0O1xuICAgICAgICB1bnNhdmVkT2JqZWN0cy5wdXNoKGNoYW5nZWRPYmplY3QpO1xuICAgICAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBjaGFuZ2VkT2JqZWN0LmNvbGxlY3Rpb25OYW1lO1xuICAgICAgICBpZiAoIXVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uW2NvbGxlY3Rpb25OYW1lXSkge1xuICAgICAgICAgIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uW2NvbGxlY3Rpb25OYW1lXSA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIHZhciBtb2RlbE5hbWUgPSBjaGFuZ2VkT2JqZWN0Lm1vZGVsLm5hbWU7XG4gICAgICAgIGlmICghdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV0pIHtcbiAgICAgICAgICB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXSA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uW2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdW2lkZW50XSA9IGNoYW5nZWRPYmplY3Q7XG4gICAgICB9XG4gICAgfVxuXG4gICAgXy5leHRlbmQoc3RvcmFnZSwge1xuICAgICAgX2xvYWQ6IF9sb2FkLFxuICAgICAgX2xvYWRNb2RlbDogX2xvYWRNb2RlbCxcbiAgICAgIHNhdmU6IHNhdmUsXG4gICAgICBfc2VyaWFsaXNlOiBfc2VyaWFsaXNlLFxuICAgICAgZW5zdXJlSW5kZXhlc0ZvckFsbDogZW5zdXJlSW5kZXhlc0ZvckFsbCxcbiAgICAgIF9yZXNldDogZnVuY3Rpb24oY2IpIHtcbiAgICAgICAgc2llc3RhLnJlbW92ZUxpc3RlbmVyKCdTaWVzdGEnLCBsaXN0ZW5lcik7XG4gICAgICAgIHVuc2F2ZWRPYmplY3RzID0gW107XG4gICAgICAgIHVuc2F2ZWRPYmplY3RzSGFzaCA9IHt9O1xuICAgICAgICBwb3VjaC5kZXN0cm95KGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICBwb3VjaCA9IG5ldyBQb3VjaERCKERCX05BTUUpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBsb2coJ1Jlc2V0IGNvbXBsZXRlJyk7XG4gICAgICAgICAgY2IoZXJyKTtcbiAgICAgICAgfSlcbiAgICAgIH1cblxuICAgIH0pO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoc3RvcmFnZSwge1xuICAgICAgX3Vuc2F2ZWRPYmplY3RzOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuIHVuc2F2ZWRPYmplY3RzXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBfdW5zYXZlZE9iamVjdHNIYXNoOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuIHVuc2F2ZWRPYmplY3RzSGFzaFxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgX3Vuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBfcG91Y2g6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gcG91Y2hcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG5cbiAgICBpZiAoIXNpZXN0YS5leHQpIHNpZXN0YS5leHQgPSB7fTtcbiAgICBzaWVzdGEuZXh0LnN0b3JhZ2UgPSBzdG9yYWdlO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoc2llc3RhLmV4dCwge1xuICAgICAgc3RvcmFnZUVuYWJsZWQ6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICBpZiAoc2llc3RhLmV4dC5fc3RvcmFnZUVuYWJsZWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmV0dXJuIHNpZXN0YS5leHQuX3N0b3JhZ2VFbmFibGVkO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gISFzaWVzdGEuZXh0LnN0b3JhZ2U7XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24odikge1xuICAgICAgICAgIHNpZXN0YS5leHQuX3N0b3JhZ2VFbmFibGVkID0gdjtcbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdmFyIGludGVydmFsLCBzYXZpbmcsIGF1dG9zYXZlSW50ZXJ2YWwgPSAxMDAwO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoc2llc3RhLCB7XG4gICAgICBhdXRvc2F2ZToge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiAhIWludGVydmFsO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uKGF1dG9zYXZlKSB7XG4gICAgICAgICAgaWYgKGF1dG9zYXZlKSB7XG4gICAgICAgICAgICBpZiAoIWludGVydmFsKSB7XG4gICAgICAgICAgICAgIGludGVydmFsID0gc2V0SW50ZXJ2YWwoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgLy8gQ2hlZWt5IHdheSBvZiBhdm9pZGluZyBtdWx0aXBsZSBzYXZlcyBoYXBwZW5pbmcuLi5cbiAgICAgICAgICAgICAgICBpZiAoIXNhdmluZykge1xuICAgICAgICAgICAgICAgICAgc2F2aW5nID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgIHNpZXN0YS5zYXZlKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICAgIGV2ZW50cy5lbWl0KCdzYXZlZCcpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHNhdmluZyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9LCBzaWVzdGEuYXV0b3NhdmVJbnRlcnZhbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaWYgKGludGVydmFsKSB7XG4gICAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwoaW50ZXJ2YWwpO1xuICAgICAgICAgICAgICBpbnRlcnZhbCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgYXV0b3NhdmVJbnRlcnZhbDoge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiBhdXRvc2F2ZUludGVydmFsO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uKF9hdXRvc2F2ZUludGVydmFsKSB7XG4gICAgICAgICAgYXV0b3NhdmVJbnRlcnZhbCA9IF9hdXRvc2F2ZUludGVydmFsO1xuICAgICAgICAgIGlmIChpbnRlcnZhbCkge1xuICAgICAgICAgICAgLy8gUmVzZXQgaW50ZXJ2YWxcbiAgICAgICAgICAgIHNpZXN0YS5hdXRvc2F2ZSA9IGZhbHNlO1xuICAgICAgICAgICAgc2llc3RhLmF1dG9zYXZlID0gdHJ1ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBkaXJ0eToge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbiA9IHNpZXN0YS5leHQuc3RvcmFnZS5fdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb247XG4gICAgICAgICAgcmV0dXJuICEhT2JqZWN0LmtleXModW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb24pLmxlbmd0aDtcbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgXy5leHRlbmQoc2llc3RhLCB7XG4gICAgICBzYXZlOiBzYXZlLFxuICAgICAgc2V0UG91Y2g6IGZ1bmN0aW9uKF9wKSB7XG4gICAgICAgIGlmIChzaWVzdGEuX2NhbkNoYW5nZSkgcG91Y2ggPSBfcDtcbiAgICAgICAgZWxzZSB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBjaGFuZ2UgUG91Y2hEQiBpbnN0YW5jZSB3aGVuIGFuIG9iamVjdCBncmFwaCBleGlzdHMuJyk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgfVxuXG4gIG1vZHVsZS5leHBvcnRzID0gc3RvcmFnZTtcblxufSkoKTsiLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG4vKlxuICogQ29weXJpZ2h0IChjKSAyMDE0IFRoZSBQb2x5bWVyIFByb2plY3QgQXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqIFRoaXMgY29kZSBtYXkgb25seSBiZSB1c2VkIHVuZGVyIHRoZSBCU0Qgc3R5bGUgbGljZW5zZSBmb3VuZCBhdCBodHRwOi8vcG9seW1lci5naXRodWIuaW8vTElDRU5TRS50eHRcbiAqIFRoZSBjb21wbGV0ZSBzZXQgb2YgYXV0aG9ycyBtYXkgYmUgZm91bmQgYXQgaHR0cDovL3BvbHltZXIuZ2l0aHViLmlvL0FVVEhPUlMudHh0XG4gKiBUaGUgY29tcGxldGUgc2V0IG9mIGNvbnRyaWJ1dG9ycyBtYXkgYmUgZm91bmQgYXQgaHR0cDovL3BvbHltZXIuZ2l0aHViLmlvL0NPTlRSSUJVVE9SUy50eHRcbiAqIENvZGUgZGlzdHJpYnV0ZWQgYnkgR29vZ2xlIGFzIHBhcnQgb2YgdGhlIHBvbHltZXIgcHJvamVjdCBpcyBhbHNvXG4gKiBzdWJqZWN0IHRvIGFuIGFkZGl0aW9uYWwgSVAgcmlnaHRzIGdyYW50IGZvdW5kIGF0IGh0dHA6Ly9wb2x5bWVyLmdpdGh1Yi5pby9QQVRFTlRTLnR4dFxuICovXG5cbihmdW5jdGlvbihnbG9iYWwpIHtcbiAgJ3VzZSBzdHJpY3QnO1xuXG4gIHZhciB0ZXN0aW5nRXhwb3NlQ3ljbGVDb3VudCA9IGdsb2JhbC50ZXN0aW5nRXhwb3NlQ3ljbGVDb3VudDtcblxuICAvLyBEZXRlY3QgYW5kIGRvIGJhc2ljIHNhbml0eSBjaGVja2luZyBvbiBPYmplY3QvQXJyYXkub2JzZXJ2ZS5cbiAgZnVuY3Rpb24gZGV0ZWN0T2JqZWN0T2JzZXJ2ZSgpIHtcbiAgICBpZiAodHlwZW9mIE9iamVjdC5vYnNlcnZlICE9PSAnZnVuY3Rpb24nIHx8XG4gICAgICAgIHR5cGVvZiBBcnJheS5vYnNlcnZlICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdmFyIHJlY29yZHMgPSBbXTtcblxuICAgIGZ1bmN0aW9uIGNhbGxiYWNrKHJlY3MpIHtcbiAgICAgIHJlY29yZHMgPSByZWNzO1xuICAgIH1cblxuICAgIHZhciB0ZXN0ID0ge307XG4gICAgdmFyIGFyciA9IFtdO1xuICAgIE9iamVjdC5vYnNlcnZlKHRlc3QsIGNhbGxiYWNrKTtcbiAgICBBcnJheS5vYnNlcnZlKGFyciwgY2FsbGJhY2spO1xuICAgIHRlc3QuaWQgPSAxO1xuICAgIHRlc3QuaWQgPSAyO1xuICAgIGRlbGV0ZSB0ZXN0LmlkO1xuICAgIGFyci5wdXNoKDEsIDIpO1xuICAgIGFyci5sZW5ndGggPSAwO1xuXG4gICAgT2JqZWN0LmRlbGl2ZXJDaGFuZ2VSZWNvcmRzKGNhbGxiYWNrKTtcbiAgICBpZiAocmVjb3Jkcy5sZW5ndGggIT09IDUpXG4gICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICBpZiAocmVjb3Jkc1swXS50eXBlICE9ICdhZGQnIHx8XG4gICAgICAgIHJlY29yZHNbMV0udHlwZSAhPSAndXBkYXRlJyB8fFxuICAgICAgICByZWNvcmRzWzJdLnR5cGUgIT0gJ2RlbGV0ZScgfHxcbiAgICAgICAgcmVjb3Jkc1szXS50eXBlICE9ICdzcGxpY2UnIHx8XG4gICAgICAgIHJlY29yZHNbNF0udHlwZSAhPSAnc3BsaWNlJykge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIE9iamVjdC51bm9ic2VydmUodGVzdCwgY2FsbGJhY2spO1xuICAgIEFycmF5LnVub2JzZXJ2ZShhcnIsIGNhbGxiYWNrKTtcblxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgdmFyIGhhc09ic2VydmUgPSBkZXRlY3RPYmplY3RPYnNlcnZlKCk7XG5cbiAgZnVuY3Rpb24gZGV0ZWN0RXZhbCgpIHtcbiAgICAvLyBEb24ndCB0ZXN0IGZvciBldmFsIGlmIHdlJ3JlIHJ1bm5pbmcgaW4gYSBDaHJvbWUgQXBwIGVudmlyb25tZW50LlxuICAgIC8vIFdlIGNoZWNrIGZvciBBUElzIHNldCB0aGF0IG9ubHkgZXhpc3QgaW4gYSBDaHJvbWUgQXBwIGNvbnRleHQuXG4gICAgaWYgKHR5cGVvZiBjaHJvbWUgIT09ICd1bmRlZmluZWQnICYmIGNocm9tZS5hcHAgJiYgY2hyb21lLmFwcC5ydW50aW1lKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gRmlyZWZveCBPUyBBcHBzIGRvIG5vdCBhbGxvdyBldmFsLiBUaGlzIGZlYXR1cmUgZGV0ZWN0aW9uIGlzIHZlcnkgaGFja3lcbiAgICAvLyBidXQgZXZlbiBpZiBzb21lIG90aGVyIHBsYXRmb3JtIGFkZHMgc3VwcG9ydCBmb3IgdGhpcyBmdW5jdGlvbiB0aGlzIGNvZGVcbiAgICAvLyB3aWxsIGNvbnRpbnVlIHRvIHdvcmsuXG4gICAgaWYgKG5hdmlnYXRvci5nZXREZXZpY2VTdG9yYWdlKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIHZhciBmID0gbmV3IEZ1bmN0aW9uKCcnLCAncmV0dXJuIHRydWU7Jyk7XG4gICAgICByZXR1cm4gZigpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgdmFyIGhhc0V2YWwgPSBkZXRlY3RFdmFsKCk7XG5cbiAgZnVuY3Rpb24gaXNJbmRleChzKSB7XG4gICAgcmV0dXJuICtzID09PSBzID4+PiAwICYmIHMgIT09ICcnO1xuICB9XG5cbiAgZnVuY3Rpb24gdG9OdW1iZXIocykge1xuICAgIHJldHVybiArcztcbiAgfVxuXG4gIHZhciBudW1iZXJJc05hTiA9IGdsb2JhbC5OdW1iZXIuaXNOYU4gfHwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJyAmJiBnbG9iYWwuaXNOYU4odmFsdWUpO1xuICB9XG5cblxuICB2YXIgY3JlYXRlT2JqZWN0ID0gKCdfX3Byb3RvX18nIGluIHt9KSA/XG4gICAgZnVuY3Rpb24ob2JqKSB7IHJldHVybiBvYmo7IH0gOlxuICAgIGZ1bmN0aW9uKG9iaikge1xuICAgICAgdmFyIHByb3RvID0gb2JqLl9fcHJvdG9fXztcbiAgICAgIGlmICghcHJvdG8pXG4gICAgICAgIHJldHVybiBvYmo7XG4gICAgICB2YXIgbmV3T2JqZWN0ID0gT2JqZWN0LmNyZWF0ZShwcm90byk7XG4gICAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhvYmopLmZvckVhY2goZnVuY3Rpb24obmFtZSkge1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobmV3T2JqZWN0LCBuYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKG9iaiwgbmFtZSkpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gbmV3T2JqZWN0O1xuICAgIH07XG5cbiAgdmFyIGlkZW50U3RhcnQgPSAnW1xcJF9hLXpBLVpdJztcbiAgdmFyIGlkZW50UGFydCA9ICdbXFwkX2EtekEtWjAtOV0nO1xuXG5cbiAgdmFyIE1BWF9ESVJUWV9DSEVDS19DWUNMRVMgPSAxMDAwO1xuXG4gIGZ1bmN0aW9uIGRpcnR5Q2hlY2sob2JzZXJ2ZXIpIHtcbiAgICB2YXIgY3ljbGVzID0gMDtcbiAgICB3aGlsZSAoY3ljbGVzIDwgTUFYX0RJUlRZX0NIRUNLX0NZQ0xFUyAmJiBvYnNlcnZlci5jaGVja18oKSkge1xuICAgICAgY3ljbGVzKys7XG4gICAgfVxuICAgIGlmICh0ZXN0aW5nRXhwb3NlQ3ljbGVDb3VudClcbiAgICAgIGdsb2JhbC5kaXJ0eUNoZWNrQ3ljbGVDb3VudCA9IGN5Y2xlcztcblxuICAgIHJldHVybiBjeWNsZXMgPiAwO1xuICB9XG5cbiAgZnVuY3Rpb24gb2JqZWN0SXNFbXB0eShvYmplY3QpIHtcbiAgICBmb3IgKHZhciBwcm9wIGluIG9iamVjdClcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRpZmZJc0VtcHR5KGRpZmYpIHtcbiAgICByZXR1cm4gb2JqZWN0SXNFbXB0eShkaWZmLmFkZGVkKSAmJlxuICAgICAgICAgICBvYmplY3RJc0VtcHR5KGRpZmYucmVtb3ZlZCkgJiZcbiAgICAgICAgICAgb2JqZWN0SXNFbXB0eShkaWZmLmNoYW5nZWQpO1xuICB9XG5cbiAgZnVuY3Rpb24gZGlmZk9iamVjdEZyb21PbGRPYmplY3Qob2JqZWN0LCBvbGRPYmplY3QpIHtcbiAgICB2YXIgYWRkZWQgPSB7fTtcbiAgICB2YXIgcmVtb3ZlZCA9IHt9O1xuICAgIHZhciBjaGFuZ2VkID0ge307XG5cbiAgICBmb3IgKHZhciBwcm9wIGluIG9sZE9iamVjdCkge1xuICAgICAgdmFyIG5ld1ZhbHVlID0gb2JqZWN0W3Byb3BdO1xuXG4gICAgICBpZiAobmV3VmFsdWUgIT09IHVuZGVmaW5lZCAmJiBuZXdWYWx1ZSA9PT0gb2xkT2JqZWN0W3Byb3BdKVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgaWYgKCEocHJvcCBpbiBvYmplY3QpKSB7XG4gICAgICAgIHJlbW92ZWRbcHJvcF0gPSB1bmRlZmluZWQ7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAobmV3VmFsdWUgIT09IG9sZE9iamVjdFtwcm9wXSlcbiAgICAgICAgY2hhbmdlZFtwcm9wXSA9IG5ld1ZhbHVlO1xuICAgIH1cblxuICAgIGZvciAodmFyIHByb3AgaW4gb2JqZWN0KSB7XG4gICAgICBpZiAocHJvcCBpbiBvbGRPYmplY3QpXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICBhZGRlZFtwcm9wXSA9IG9iamVjdFtwcm9wXTtcbiAgICB9XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShvYmplY3QpICYmIG9iamVjdC5sZW5ndGggIT09IG9sZE9iamVjdC5sZW5ndGgpXG4gICAgICBjaGFuZ2VkLmxlbmd0aCA9IG9iamVjdC5sZW5ndGg7XG5cbiAgICByZXR1cm4ge1xuICAgICAgYWRkZWQ6IGFkZGVkLFxuICAgICAgcmVtb3ZlZDogcmVtb3ZlZCxcbiAgICAgIGNoYW5nZWQ6IGNoYW5nZWRcbiAgICB9O1xuICB9XG5cbiAgdmFyIGVvbVRhc2tzID0gW107XG4gIGZ1bmN0aW9uIHJ1bkVPTVRhc2tzKCkge1xuICAgIGlmICghZW9tVGFza3MubGVuZ3RoKVxuICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBlb21UYXNrcy5sZW5ndGg7IGkrKykge1xuICAgICAgZW9tVGFza3NbaV0oKTtcbiAgICB9XG4gICAgZW9tVGFza3MubGVuZ3RoID0gMDtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHZhciBydW5FT00gPSBoYXNPYnNlcnZlID8gKGZ1bmN0aW9uKCl7XG4gICAgdmFyIGVvbU9iaiA9IHsgcGluZ1Bvbmc6IHRydWUgfTtcbiAgICB2YXIgZW9tUnVuU2NoZWR1bGVkID0gZmFsc2U7XG5cbiAgICBPYmplY3Qub2JzZXJ2ZShlb21PYmosIGZ1bmN0aW9uKCkge1xuICAgICAgcnVuRU9NVGFza3MoKTtcbiAgICAgIGVvbVJ1blNjaGVkdWxlZCA9IGZhbHNlO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uKGZuKSB7XG4gICAgICBlb21UYXNrcy5wdXNoKGZuKTtcbiAgICAgIGlmICghZW9tUnVuU2NoZWR1bGVkKSB7XG4gICAgICAgIGVvbVJ1blNjaGVkdWxlZCA9IHRydWU7XG4gICAgICAgIGVvbU9iai5waW5nUG9uZyA9ICFlb21PYmoucGluZ1Bvbmc7XG4gICAgICB9XG4gICAgfTtcbiAgfSkoKSA6XG4gIChmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oZm4pIHtcbiAgICAgIGVvbVRhc2tzLnB1c2goZm4pO1xuICAgIH07XG4gIH0pKCk7XG5cbiAgdmFyIG9ic2VydmVkT2JqZWN0Q2FjaGUgPSBbXTtcblxuICBmdW5jdGlvbiBuZXdPYnNlcnZlZE9iamVjdCgpIHtcbiAgICB2YXIgb2JzZXJ2ZXI7XG4gICAgdmFyIG9iamVjdDtcbiAgICB2YXIgZGlzY2FyZFJlY29yZHMgPSBmYWxzZTtcbiAgICB2YXIgZmlyc3QgPSB0cnVlO1xuXG4gICAgZnVuY3Rpb24gY2FsbGJhY2socmVjb3Jkcykge1xuICAgICAgaWYgKG9ic2VydmVyICYmIG9ic2VydmVyLnN0YXRlXyA9PT0gT1BFTkVEICYmICFkaXNjYXJkUmVjb3JkcylcbiAgICAgICAgb2JzZXJ2ZXIuY2hlY2tfKHJlY29yZHMpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBvcGVuOiBmdW5jdGlvbihvYnMpIHtcbiAgICAgICAgaWYgKG9ic2VydmVyKVxuICAgICAgICAgIHRocm93IEVycm9yKCdPYnNlcnZlZE9iamVjdCBpbiB1c2UnKTtcblxuICAgICAgICBpZiAoIWZpcnN0KVxuICAgICAgICAgIE9iamVjdC5kZWxpdmVyQ2hhbmdlUmVjb3JkcyhjYWxsYmFjayk7XG5cbiAgICAgICAgb2JzZXJ2ZXIgPSBvYnM7XG4gICAgICAgIGZpcnN0ID0gZmFsc2U7XG4gICAgICB9LFxuICAgICAgb2JzZXJ2ZTogZnVuY3Rpb24ob2JqLCBhcnJheU9ic2VydmUpIHtcbiAgICAgICAgb2JqZWN0ID0gb2JqO1xuICAgICAgICBpZiAoYXJyYXlPYnNlcnZlKVxuICAgICAgICAgIEFycmF5Lm9ic2VydmUob2JqZWN0LCBjYWxsYmFjayk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICBPYmplY3Qub2JzZXJ2ZShvYmplY3QsIGNhbGxiYWNrKTtcbiAgICAgIH0sXG4gICAgICBkZWxpdmVyOiBmdW5jdGlvbihkaXNjYXJkKSB7XG4gICAgICAgIGRpc2NhcmRSZWNvcmRzID0gZGlzY2FyZDtcbiAgICAgICAgT2JqZWN0LmRlbGl2ZXJDaGFuZ2VSZWNvcmRzKGNhbGxiYWNrKTtcbiAgICAgICAgZGlzY2FyZFJlY29yZHMgPSBmYWxzZTtcbiAgICAgIH0sXG4gICAgICBjbG9zZTogZnVuY3Rpb24oKSB7XG4gICAgICAgIG9ic2VydmVyID0gdW5kZWZpbmVkO1xuICAgICAgICBPYmplY3QudW5vYnNlcnZlKG9iamVjdCwgY2FsbGJhY2spO1xuICAgICAgICBvYnNlcnZlZE9iamVjdENhY2hlLnB1c2godGhpcyk7XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIC8qXG4gICAqIFRoZSBvYnNlcnZlZFNldCBhYnN0cmFjdGlvbiBpcyBhIHBlcmYgb3B0aW1pemF0aW9uIHdoaWNoIHJlZHVjZXMgdGhlIHRvdGFsXG4gICAqIG51bWJlciBvZiBPYmplY3Qub2JzZXJ2ZSBvYnNlcnZhdGlvbnMgb2YgYSBzZXQgb2Ygb2JqZWN0cy4gVGhlIGlkZWEgaXMgdGhhdFxuICAgKiBncm91cHMgb2YgT2JzZXJ2ZXJzIHdpbGwgaGF2ZSBzb21lIG9iamVjdCBkZXBlbmRlbmNpZXMgaW4gY29tbW9uIGFuZCB0aGlzXG4gICAqIG9ic2VydmVkIHNldCBlbnN1cmVzIHRoYXQgZWFjaCBvYmplY3QgaW4gdGhlIHRyYW5zaXRpdmUgY2xvc3VyZSBvZlxuICAgKiBkZXBlbmRlbmNpZXMgaXMgb25seSBvYnNlcnZlZCBvbmNlLiBUaGUgb2JzZXJ2ZWRTZXQgYWN0cyBhcyBhIHdyaXRlIGJhcnJpZXJcbiAgICogc3VjaCB0aGF0IHdoZW5ldmVyIGFueSBjaGFuZ2UgY29tZXMgdGhyb3VnaCwgYWxsIE9ic2VydmVycyBhcmUgY2hlY2tlZCBmb3JcbiAgICogY2hhbmdlZCB2YWx1ZXMuXG4gICAqXG4gICAqIE5vdGUgdGhhdCB0aGlzIG9wdGltaXphdGlvbiBpcyBleHBsaWNpdGx5IG1vdmluZyB3b3JrIGZyb20gc2V0dXAtdGltZSB0b1xuICAgKiBjaGFuZ2UtdGltZS5cbiAgICpcbiAgICogVE9ETyhyYWZhZWx3KTogSW1wbGVtZW50IFwiZ2FyYmFnZSBjb2xsZWN0aW9uXCIuIEluIG9yZGVyIHRvIG1vdmUgd29yayBvZmZcbiAgICogdGhlIGNyaXRpY2FsIHBhdGgsIHdoZW4gT2JzZXJ2ZXJzIGFyZSBjbG9zZWQsIHRoZWlyIG9ic2VydmVkIG9iamVjdHMgYXJlXG4gICAqIG5vdCBPYmplY3QudW5vYnNlcnZlKGQpLiBBcyBhIHJlc3VsdCwgaXQnc2llc3RhIHBvc3NpYmxlIHRoYXQgaWYgdGhlIG9ic2VydmVkU2V0XG4gICAqIGlzIGtlcHQgb3BlbiwgYnV0IHNvbWUgT2JzZXJ2ZXJzIGhhdmUgYmVlbiBjbG9zZWQsIGl0IGNvdWxkIGNhdXNlIFwibGVha3NcIlxuICAgKiAocHJldmVudCBvdGhlcndpc2UgY29sbGVjdGFibGUgb2JqZWN0cyBmcm9tIGJlaW5nIGNvbGxlY3RlZCkuIEF0IHNvbWVcbiAgICogcG9pbnQsIHdlIHNob3VsZCBpbXBsZW1lbnQgaW5jcmVtZW50YWwgXCJnY1wiIHdoaWNoIGtlZXBzIGEgbGlzdCBvZlxuICAgKiBvYnNlcnZlZFNldHMgd2hpY2ggbWF5IG5lZWQgY2xlYW4tdXAgYW5kIGRvZXMgc21hbGwgYW1vdW50cyBvZiBjbGVhbnVwIG9uIGFcbiAgICogdGltZW91dCB1bnRpbCBhbGwgaXMgY2xlYW4uXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGdldE9ic2VydmVkT2JqZWN0KG9ic2VydmVyLCBvYmplY3QsIGFycmF5T2JzZXJ2ZSkge1xuICAgIHZhciBkaXIgPSBvYnNlcnZlZE9iamVjdENhY2hlLnBvcCgpIHx8IG5ld09ic2VydmVkT2JqZWN0KCk7XG4gICAgZGlyLm9wZW4ob2JzZXJ2ZXIpO1xuICAgIGRpci5vYnNlcnZlKG9iamVjdCwgYXJyYXlPYnNlcnZlKTtcbiAgICByZXR1cm4gZGlyO1xuICB9XG5cbiAgdmFyIG9ic2VydmVkU2V0Q2FjaGUgPSBbXTtcblxuICBmdW5jdGlvbiBuZXdPYnNlcnZlZFNldCgpIHtcbiAgICB2YXIgb2JzZXJ2ZXJDb3VudCA9IDA7XG4gICAgdmFyIG9ic2VydmVycyA9IFtdO1xuICAgIHZhciBvYmplY3RzID0gW107XG4gICAgdmFyIHJvb3RPYmo7XG4gICAgdmFyIHJvb3RPYmpQcm9wcztcblxuICAgIGZ1bmN0aW9uIG9ic2VydmUob2JqLCBwcm9wKSB7XG4gICAgICBpZiAoIW9iailcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICBpZiAob2JqID09PSByb290T2JqKVxuICAgICAgICByb290T2JqUHJvcHNbcHJvcF0gPSB0cnVlO1xuXG4gICAgICBpZiAob2JqZWN0cy5pbmRleE9mKG9iaikgPCAwKSB7XG4gICAgICAgIG9iamVjdHMucHVzaChvYmopO1xuICAgICAgICBPYmplY3Qub2JzZXJ2ZShvYmosIGNhbGxiYWNrKTtcbiAgICAgIH1cblxuICAgICAgb2JzZXJ2ZShPYmplY3QuZ2V0UHJvdG90eXBlT2Yob2JqKSwgcHJvcCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWxsUm9vdE9iak5vbk9ic2VydmVkUHJvcHMocmVjcykge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZWNzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciByZWMgPSByZWNzW2ldO1xuICAgICAgICBpZiAocmVjLm9iamVjdCAhPT0gcm9vdE9iaiB8fFxuICAgICAgICAgICAgcm9vdE9ialByb3BzW3JlYy5uYW1lXSB8fFxuICAgICAgICAgICAgcmVjLnR5cGUgPT09ICdzZXRQcm90b3R5cGUnKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjYWxsYmFjayhyZWNzKSB7XG4gICAgICBpZiAoYWxsUm9vdE9iak5vbk9ic2VydmVkUHJvcHMocmVjcykpXG4gICAgICAgIHJldHVybjtcblxuICAgICAgdmFyIG9ic2VydmVyO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvYnNlcnZlcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgb2JzZXJ2ZXIgPSBvYnNlcnZlcnNbaV07XG4gICAgICAgIGlmIChvYnNlcnZlci5zdGF0ZV8gPT0gT1BFTkVEKSB7XG4gICAgICAgICAgb2JzZXJ2ZXIuaXRlcmF0ZU9iamVjdHNfKG9ic2VydmUpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb2JzZXJ2ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIG9ic2VydmVyID0gb2JzZXJ2ZXJzW2ldO1xuICAgICAgICBpZiAob2JzZXJ2ZXIuc3RhdGVfID09IE9QRU5FRCkge1xuICAgICAgICAgIG9ic2VydmVyLmNoZWNrXygpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIHJlY29yZCA9IHtcbiAgICAgIG9iamVjdDogdW5kZWZpbmVkLFxuICAgICAgb2JqZWN0czogb2JqZWN0cyxcbiAgICAgIG9wZW46IGZ1bmN0aW9uKG9icywgb2JqZWN0KSB7XG4gICAgICAgIGlmICghcm9vdE9iaikge1xuICAgICAgICAgIHJvb3RPYmogPSBvYmplY3Q7XG4gICAgICAgICAgcm9vdE9ialByb3BzID0ge307XG4gICAgICAgIH1cblxuICAgICAgICBvYnNlcnZlcnMucHVzaChvYnMpO1xuICAgICAgICBvYnNlcnZlckNvdW50Kys7XG4gICAgICAgIG9icy5pdGVyYXRlT2JqZWN0c18ob2JzZXJ2ZSk7XG4gICAgICB9LFxuICAgICAgY2xvc2U6IGZ1bmN0aW9uKG9icykge1xuICAgICAgICBvYnNlcnZlckNvdW50LS07XG4gICAgICAgIGlmIChvYnNlcnZlckNvdW50ID4gMCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb2JqZWN0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIE9iamVjdC51bm9ic2VydmUob2JqZWN0c1tpXSwgY2FsbGJhY2spO1xuICAgICAgICAgIE9ic2VydmVyLnVub2JzZXJ2ZWRDb3VudCsrO1xuICAgICAgICB9XG5cbiAgICAgICAgb2JzZXJ2ZXJzLmxlbmd0aCA9IDA7XG4gICAgICAgIG9iamVjdHMubGVuZ3RoID0gMDtcbiAgICAgICAgcm9vdE9iaiA9IHVuZGVmaW5lZDtcbiAgICAgICAgcm9vdE9ialByb3BzID0gdW5kZWZpbmVkO1xuICAgICAgICBvYnNlcnZlZFNldENhY2hlLnB1c2godGhpcyk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiByZWNvcmQ7XG4gIH1cblxuICB2YXIgbGFzdE9ic2VydmVkU2V0O1xuXG4gIHZhciBVTk9QRU5FRCA9IDA7XG4gIHZhciBPUEVORUQgPSAxO1xuICB2YXIgQ0xPU0VEID0gMjtcblxuICB2YXIgbmV4dE9ic2VydmVySWQgPSAxO1xuXG4gIGZ1bmN0aW9uIE9ic2VydmVyKCkge1xuICAgIHRoaXMuc3RhdGVfID0gVU5PUEVORUQ7XG4gICAgdGhpcy5jYWxsYmFja18gPSB1bmRlZmluZWQ7XG4gICAgdGhpcy50YXJnZXRfID0gdW5kZWZpbmVkOyAvLyBUT0RPKHJhZmFlbHcpOiBTaG91bGQgYmUgV2Vha1JlZlxuICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfID0gdW5kZWZpbmVkO1xuICAgIHRoaXMudmFsdWVfID0gdW5kZWZpbmVkO1xuICAgIHRoaXMuaWRfID0gbmV4dE9ic2VydmVySWQrKztcbiAgfVxuXG4gIE9ic2VydmVyLnByb3RvdHlwZSA9IHtcbiAgICBvcGVuOiBmdW5jdGlvbihjYWxsYmFjaywgdGFyZ2V0KSB7XG4gICAgICBpZiAodGhpcy5zdGF0ZV8gIT0gVU5PUEVORUQpXG4gICAgICAgIHRocm93IEVycm9yKCdPYnNlcnZlciBoYXMgYWxyZWFkeSBiZWVuIG9wZW5lZC4nKTtcblxuICAgICAgYWRkVG9BbGwodGhpcyk7XG4gICAgICB0aGlzLmNhbGxiYWNrXyA9IGNhbGxiYWNrO1xuICAgICAgdGhpcy50YXJnZXRfID0gdGFyZ2V0O1xuICAgICAgdGhpcy5jb25uZWN0XygpO1xuICAgICAgdGhpcy5zdGF0ZV8gPSBPUEVORUQ7XG4gICAgICByZXR1cm4gdGhpcy52YWx1ZV87XG4gICAgfSxcblxuICAgIGNsb3NlOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLnN0YXRlXyAhPSBPUEVORUQpXG4gICAgICAgIHJldHVybjtcblxuICAgICAgcmVtb3ZlRnJvbUFsbCh0aGlzKTtcbiAgICAgIHRoaXMuZGlzY29ubmVjdF8oKTtcbiAgICAgIHRoaXMudmFsdWVfID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy5jYWxsYmFja18gPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLnRhcmdldF8gPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLnN0YXRlXyA9IENMT1NFRDtcbiAgICB9LFxuXG4gICAgZGVsaXZlcjogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5zdGF0ZV8gIT0gT1BFTkVEKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIGRpcnR5Q2hlY2sodGhpcyk7XG4gICAgfSxcblxuICAgIHJlcG9ydF86IGZ1bmN0aW9uKGNoYW5nZXMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHRoaXMuY2FsbGJhY2tfLmFwcGx5KHRoaXMudGFyZ2V0XywgY2hhbmdlcyk7XG4gICAgICB9IGNhdGNoIChleCkge1xuICAgICAgICBPYnNlcnZlci5fZXJyb3JUaHJvd25EdXJpbmdDYWxsYmFjayA9IHRydWU7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0V4Y2VwdGlvbiBjYXVnaHQgZHVyaW5nIG9ic2VydmVyIGNhbGxiYWNrOiAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgKGV4LnN0YWNrIHx8IGV4KSk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIGRpc2NhcmRDaGFuZ2VzOiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuY2hlY2tfKHVuZGVmaW5lZCwgdHJ1ZSk7XG4gICAgICByZXR1cm4gdGhpcy52YWx1ZV87XG4gICAgfVxuICB9XG5cbiAgdmFyIGNvbGxlY3RPYnNlcnZlcnMgPSAhaGFzT2JzZXJ2ZTtcbiAgdmFyIGFsbE9ic2VydmVycztcbiAgT2JzZXJ2ZXIuX2FsbE9ic2VydmVyc0NvdW50ID0gMDtcblxuICBpZiAoY29sbGVjdE9ic2VydmVycykge1xuICAgIGFsbE9ic2VydmVycyA9IFtdO1xuICB9XG5cbiAgZnVuY3Rpb24gYWRkVG9BbGwob2JzZXJ2ZXIpIHtcbiAgICBPYnNlcnZlci5fYWxsT2JzZXJ2ZXJzQ291bnQrKztcbiAgICBpZiAoIWNvbGxlY3RPYnNlcnZlcnMpXG4gICAgICByZXR1cm47XG5cbiAgICBhbGxPYnNlcnZlcnMucHVzaChvYnNlcnZlcik7XG4gIH1cblxuICBmdW5jdGlvbiByZW1vdmVGcm9tQWxsKG9ic2VydmVyKSB7XG4gICAgT2JzZXJ2ZXIuX2FsbE9ic2VydmVyc0NvdW50LS07XG4gIH1cblxuICB2YXIgcnVubmluZ01pY3JvdGFza0NoZWNrcG9pbnQgPSBmYWxzZTtcblxuICB2YXIgaGFzRGVidWdGb3JjZUZ1bGxEZWxpdmVyeSA9IGhhc09ic2VydmUgJiYgaGFzRXZhbCAmJiAoZnVuY3Rpb24oKSB7XG4gICAgdHJ5IHtcbiAgICAgIGV2YWwoJyVSdW5NaWNyb3Rhc2tzKCknKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9KSgpO1xuXG4gIGdsb2JhbC5QbGF0Zm9ybSA9IGdsb2JhbC5QbGF0Zm9ybSB8fCB7fTtcblxuICBnbG9iYWwuUGxhdGZvcm0ucGVyZm9ybU1pY3JvdGFza0NoZWNrcG9pbnQgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAocnVubmluZ01pY3JvdGFza0NoZWNrcG9pbnQpXG4gICAgICByZXR1cm47XG5cbiAgICBpZiAoaGFzRGVidWdGb3JjZUZ1bGxEZWxpdmVyeSkge1xuICAgICAgZXZhbCgnJVJ1bk1pY3JvdGFza3MoKScpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICghY29sbGVjdE9ic2VydmVycylcbiAgICAgIHJldHVybjtcblxuICAgIHJ1bm5pbmdNaWNyb3Rhc2tDaGVja3BvaW50ID0gdHJ1ZTtcblxuICAgIHZhciBjeWNsZXMgPSAwO1xuICAgIHZhciBhbnlDaGFuZ2VkLCB0b0NoZWNrO1xuXG4gICAgZG8ge1xuICAgICAgY3ljbGVzKys7XG4gICAgICB0b0NoZWNrID0gYWxsT2JzZXJ2ZXJzO1xuICAgICAgYWxsT2JzZXJ2ZXJzID0gW107XG4gICAgICBhbnlDaGFuZ2VkID0gZmFsc2U7XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdG9DaGVjay5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgb2JzZXJ2ZXIgPSB0b0NoZWNrW2ldO1xuICAgICAgICBpZiAob2JzZXJ2ZXIuc3RhdGVfICE9IE9QRU5FRClcbiAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICBpZiAob2JzZXJ2ZXIuY2hlY2tfKCkpXG4gICAgICAgICAgYW55Q2hhbmdlZCA9IHRydWU7XG5cbiAgICAgICAgYWxsT2JzZXJ2ZXJzLnB1c2gob2JzZXJ2ZXIpO1xuICAgICAgfVxuICAgICAgaWYgKHJ1bkVPTVRhc2tzKCkpXG4gICAgICAgIGFueUNoYW5nZWQgPSB0cnVlO1xuICAgIH0gd2hpbGUgKGN5Y2xlcyA8IE1BWF9ESVJUWV9DSEVDS19DWUNMRVMgJiYgYW55Q2hhbmdlZCk7XG5cbiAgICBpZiAodGVzdGluZ0V4cG9zZUN5Y2xlQ291bnQpXG4gICAgICBnbG9iYWwuZGlydHlDaGVja0N5Y2xlQ291bnQgPSBjeWNsZXM7XG5cbiAgICBydW5uaW5nTWljcm90YXNrQ2hlY2twb2ludCA9IGZhbHNlO1xuICB9O1xuXG4gIGlmIChjb2xsZWN0T2JzZXJ2ZXJzKSB7XG4gICAgZ2xvYmFsLlBsYXRmb3JtLmNsZWFyT2JzZXJ2ZXJzID0gZnVuY3Rpb24oKSB7XG4gICAgICBhbGxPYnNlcnZlcnMgPSBbXTtcbiAgICB9O1xuICB9XG5cbiAgZnVuY3Rpb24gT2JqZWN0T2JzZXJ2ZXIob2JqZWN0KSB7XG4gICAgT2JzZXJ2ZXIuY2FsbCh0aGlzKTtcbiAgICB0aGlzLnZhbHVlXyA9IG9iamVjdDtcbiAgICB0aGlzLm9sZE9iamVjdF8gPSB1bmRlZmluZWQ7XG4gIH1cblxuICBPYmplY3RPYnNlcnZlci5wcm90b3R5cGUgPSBjcmVhdGVPYmplY3Qoe1xuICAgIF9fcHJvdG9fXzogT2JzZXJ2ZXIucHJvdG90eXBlLFxuXG4gICAgYXJyYXlPYnNlcnZlOiBmYWxzZSxcblxuICAgIGNvbm5lY3RfOiBmdW5jdGlvbihjYWxsYmFjaywgdGFyZ2V0KSB7XG4gICAgICBpZiAoaGFzT2JzZXJ2ZSkge1xuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXyA9IGdldE9ic2VydmVkT2JqZWN0KHRoaXMsIHRoaXMudmFsdWVfLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYXJyYXlPYnNlcnZlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMub2xkT2JqZWN0XyA9IHRoaXMuY29weU9iamVjdCh0aGlzLnZhbHVlXyk7XG4gICAgICB9XG5cbiAgICB9LFxuXG4gICAgY29weU9iamVjdDogZnVuY3Rpb24ob2JqZWN0KSB7XG4gICAgICB2YXIgY29weSA9IEFycmF5LmlzQXJyYXkob2JqZWN0KSA/IFtdIDoge307XG4gICAgICBmb3IgKHZhciBwcm9wIGluIG9iamVjdCkge1xuICAgICAgICBjb3B5W3Byb3BdID0gb2JqZWN0W3Byb3BdO1xuICAgICAgfTtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KG9iamVjdCkpXG4gICAgICAgIGNvcHkubGVuZ3RoID0gb2JqZWN0Lmxlbmd0aDtcbiAgICAgIHJldHVybiBjb3B5O1xuICAgIH0sXG5cbiAgICBjaGVja186IGZ1bmN0aW9uKGNoYW5nZVJlY29yZHMsIHNraXBDaGFuZ2VzKSB7XG4gICAgICB2YXIgZGlmZjtcbiAgICAgIHZhciBvbGRWYWx1ZXM7XG4gICAgICBpZiAoaGFzT2JzZXJ2ZSkge1xuICAgICAgICBpZiAoIWNoYW5nZVJlY29yZHMpXG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIG9sZFZhbHVlcyA9IHt9O1xuICAgICAgICBkaWZmID0gZGlmZk9iamVjdEZyb21DaGFuZ2VSZWNvcmRzKHRoaXMudmFsdWVfLCBjaGFuZ2VSZWNvcmRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZFZhbHVlcyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvbGRWYWx1ZXMgPSB0aGlzLm9sZE9iamVjdF87XG4gICAgICAgIGRpZmYgPSBkaWZmT2JqZWN0RnJvbU9sZE9iamVjdCh0aGlzLnZhbHVlXywgdGhpcy5vbGRPYmplY3RfKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGRpZmZJc0VtcHR5KGRpZmYpKVxuICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgIGlmICghaGFzT2JzZXJ2ZSlcbiAgICAgICAgdGhpcy5vbGRPYmplY3RfID0gdGhpcy5jb3B5T2JqZWN0KHRoaXMudmFsdWVfKTtcblxuICAgICAgdGhpcy5yZXBvcnRfKFtcbiAgICAgICAgZGlmZi5hZGRlZCB8fCB7fSxcbiAgICAgICAgZGlmZi5yZW1vdmVkIHx8IHt9LFxuICAgICAgICBkaWZmLmNoYW5nZWQgfHwge30sXG4gICAgICAgIGZ1bmN0aW9uKHByb3BlcnR5KSB7XG4gICAgICAgICAgcmV0dXJuIG9sZFZhbHVlc1twcm9wZXJ0eV07XG4gICAgICAgIH1cbiAgICAgIF0pO1xuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9LFxuXG4gICAgZGlzY29ubmVjdF86IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKGhhc09ic2VydmUpIHtcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8uY2xvc2UoKTtcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8gPSB1bmRlZmluZWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm9sZE9iamVjdF8gPSB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgfSxcblxuICAgIGRlbGl2ZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuc3RhdGVfICE9IE9QRU5FRClcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICBpZiAoaGFzT2JzZXJ2ZSlcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8uZGVsaXZlcihmYWxzZSk7XG4gICAgICBlbHNlXG4gICAgICAgIGRpcnR5Q2hlY2sodGhpcyk7XG4gICAgfSxcblxuICAgIGRpc2NhcmRDaGFuZ2VzOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLmRpcmVjdE9ic2VydmVyXylcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8uZGVsaXZlcih0cnVlKTtcbiAgICAgIGVsc2VcbiAgICAgICAgdGhpcy5vbGRPYmplY3RfID0gdGhpcy5jb3B5T2JqZWN0KHRoaXMudmFsdWVfKTtcblxuICAgICAgcmV0dXJuIHRoaXMudmFsdWVfO1xuICAgIH1cbiAgfSk7XG5cbiAgZnVuY3Rpb24gQXJyYXlPYnNlcnZlcihhcnJheSkge1xuICAgIGlmICghQXJyYXkuaXNBcnJheShhcnJheSkpXG4gICAgICB0aHJvdyBFcnJvcignUHJvdmlkZWQgb2JqZWN0IGlzIG5vdCBhbiBBcnJheScpO1xuICAgIE9iamVjdE9ic2VydmVyLmNhbGwodGhpcywgYXJyYXkpO1xuICB9XG5cbiAgQXJyYXlPYnNlcnZlci5wcm90b3R5cGUgPSBjcmVhdGVPYmplY3Qoe1xuXG4gICAgX19wcm90b19fOiBPYmplY3RPYnNlcnZlci5wcm90b3R5cGUsXG5cbiAgICBhcnJheU9ic2VydmU6IHRydWUsXG5cbiAgICBjb3B5T2JqZWN0OiBmdW5jdGlvbihhcnIpIHtcbiAgICAgIHJldHVybiBhcnIuc2xpY2UoKTtcbiAgICB9LFxuXG4gICAgY2hlY2tfOiBmdW5jdGlvbihjaGFuZ2VSZWNvcmRzKSB7XG4gICAgICB2YXIgc3BsaWNlcztcbiAgICAgIGlmIChoYXNPYnNlcnZlKSB7XG4gICAgICAgIGlmICghY2hhbmdlUmVjb3JkcylcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIHNwbGljZXMgPSBwcm9qZWN0QXJyYXlTcGxpY2VzKHRoaXMudmFsdWVfLCBjaGFuZ2VSZWNvcmRzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNwbGljZXMgPSBjYWxjU3BsaWNlcyh0aGlzLnZhbHVlXywgMCwgdGhpcy52YWx1ZV8ubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5vbGRPYmplY3RfLCAwLCB0aGlzLm9sZE9iamVjdF8ubGVuZ3RoKTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFzcGxpY2VzIHx8ICFzcGxpY2VzLmxlbmd0aClcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICBpZiAoIWhhc09ic2VydmUpXG4gICAgICAgIHRoaXMub2xkT2JqZWN0XyA9IHRoaXMuY29weU9iamVjdCh0aGlzLnZhbHVlXyk7XG5cbiAgICAgIHRoaXMucmVwb3J0Xyhbc3BsaWNlc10pO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9KTtcblxuICBBcnJheU9ic2VydmVyLmFwcGx5U3BsaWNlcyA9IGZ1bmN0aW9uKHByZXZpb3VzLCBjdXJyZW50LCBzcGxpY2VzKSB7XG4gICAgc3BsaWNlcy5mb3JFYWNoKGZ1bmN0aW9uKHNwbGljZSkge1xuICAgICAgdmFyIHNwbGljZUFyZ3MgPSBbc3BsaWNlLmluZGV4LCBzcGxpY2UucmVtb3ZlZC5sZW5ndGhdO1xuICAgICAgdmFyIGFkZEluZGV4ID0gc3BsaWNlLmluZGV4O1xuICAgICAgd2hpbGUgKGFkZEluZGV4IDwgc3BsaWNlLmluZGV4ICsgc3BsaWNlLmFkZGVkQ291bnQpIHtcbiAgICAgICAgc3BsaWNlQXJncy5wdXNoKGN1cnJlbnRbYWRkSW5kZXhdKTtcbiAgICAgICAgYWRkSW5kZXgrKztcbiAgICAgIH1cblxuICAgICAgQXJyYXkucHJvdG90eXBlLnNwbGljZS5hcHBseShwcmV2aW91cywgc3BsaWNlQXJncyk7XG4gICAgfSk7XG4gIH07XG5cbiAgdmFyIG9ic2VydmVyU2VudGluZWwgPSB7fTtcblxuICB2YXIgZXhwZWN0ZWRSZWNvcmRUeXBlcyA9IHtcbiAgICBhZGQ6IHRydWUsXG4gICAgdXBkYXRlOiB0cnVlLFxuICAgIGRlbGV0ZTogdHJ1ZVxuICB9O1xuXG4gIGZ1bmN0aW9uIGRpZmZPYmplY3RGcm9tQ2hhbmdlUmVjb3JkcyhvYmplY3QsIGNoYW5nZVJlY29yZHMsIG9sZFZhbHVlcykge1xuICAgIHZhciBhZGRlZCA9IHt9O1xuICAgIHZhciByZW1vdmVkID0ge307XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoYW5nZVJlY29yZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciByZWNvcmQgPSBjaGFuZ2VSZWNvcmRzW2ldO1xuICAgICAgaWYgKCFleHBlY3RlZFJlY29yZFR5cGVzW3JlY29yZC50eXBlXSkge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdVbmtub3duIGNoYW5nZVJlY29yZCB0eXBlOiAnICsgcmVjb3JkLnR5cGUpO1xuICAgICAgICBjb25zb2xlLmVycm9yKHJlY29yZCk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoIShyZWNvcmQubmFtZSBpbiBvbGRWYWx1ZXMpKVxuICAgICAgICBvbGRWYWx1ZXNbcmVjb3JkLm5hbWVdID0gcmVjb3JkLm9sZFZhbHVlO1xuXG4gICAgICBpZiAocmVjb3JkLnR5cGUgPT0gJ3VwZGF0ZScpXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICBpZiAocmVjb3JkLnR5cGUgPT0gJ2FkZCcpIHtcbiAgICAgICAgaWYgKHJlY29yZC5uYW1lIGluIHJlbW92ZWQpXG4gICAgICAgICAgZGVsZXRlIHJlbW92ZWRbcmVjb3JkLm5hbWVdO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgYWRkZWRbcmVjb3JkLm5hbWVdID0gdHJ1ZTtcblxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gdHlwZSA9ICdkZWxldGUnXG4gICAgICBpZiAocmVjb3JkLm5hbWUgaW4gYWRkZWQpIHtcbiAgICAgICAgZGVsZXRlIGFkZGVkW3JlY29yZC5uYW1lXTtcbiAgICAgICAgZGVsZXRlIG9sZFZhbHVlc1tyZWNvcmQubmFtZV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZW1vdmVkW3JlY29yZC5uYW1lXSA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yICh2YXIgcHJvcCBpbiBhZGRlZClcbiAgICAgIGFkZGVkW3Byb3BdID0gb2JqZWN0W3Byb3BdO1xuXG4gICAgZm9yICh2YXIgcHJvcCBpbiByZW1vdmVkKVxuICAgICAgcmVtb3ZlZFtwcm9wXSA9IHVuZGVmaW5lZDtcblxuICAgIHZhciBjaGFuZ2VkID0ge307XG4gICAgZm9yICh2YXIgcHJvcCBpbiBvbGRWYWx1ZXMpIHtcbiAgICAgIGlmIChwcm9wIGluIGFkZGVkIHx8IHByb3AgaW4gcmVtb3ZlZClcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIHZhciBuZXdWYWx1ZSA9IG9iamVjdFtwcm9wXTtcbiAgICAgIGlmIChvbGRWYWx1ZXNbcHJvcF0gIT09IG5ld1ZhbHVlKVxuICAgICAgICBjaGFuZ2VkW3Byb3BdID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGFkZGVkOiBhZGRlZCxcbiAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgICBjaGFuZ2VkOiBjaGFuZ2VkXG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG5ld1NwbGljZShpbmRleCwgcmVtb3ZlZCwgYWRkZWRDb3VudCkge1xuICAgIHJldHVybiB7XG4gICAgICBpbmRleDogaW5kZXgsXG4gICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgICAgYWRkZWRDb3VudDogYWRkZWRDb3VudFxuICAgIH07XG4gIH1cblxuICB2YXIgRURJVF9MRUFWRSA9IDA7XG4gIHZhciBFRElUX1VQREFURSA9IDE7XG4gIHZhciBFRElUX0FERCA9IDI7XG4gIHZhciBFRElUX0RFTEVURSA9IDM7XG5cbiAgZnVuY3Rpb24gQXJyYXlTcGxpY2UoKSB7fVxuXG4gIEFycmF5U3BsaWNlLnByb3RvdHlwZSA9IHtcblxuICAgIC8vIE5vdGU6IFRoaXMgZnVuY3Rpb24gaXMgKmJhc2VkKiBvbiB0aGUgY29tcHV0YXRpb24gb2YgdGhlIExldmVuc2h0ZWluXG4gICAgLy8gXCJlZGl0XCIgZGlzdGFuY2UuIFRoZSBvbmUgY2hhbmdlIGlzIHRoYXQgXCJ1cGRhdGVzXCIgYXJlIHRyZWF0ZWQgYXMgdHdvXG4gICAgLy8gZWRpdHMgLSBub3Qgb25lLiBXaXRoIEFycmF5IHNwbGljZXMsIGFuIHVwZGF0ZSBpcyByZWFsbHkgYSBkZWxldGVcbiAgICAvLyBmb2xsb3dlZCBieSBhbiBhZGQuIEJ5IHJldGFpbmluZyB0aGlzLCB3ZSBvcHRpbWl6ZSBmb3IgXCJrZWVwaW5nXCIgdGhlXG4gICAgLy8gbWF4aW11bSBhcnJheSBpdGVtcyBpbiB0aGUgb3JpZ2luYWwgYXJyYXkuIEZvciBleGFtcGxlOlxuICAgIC8vXG4gICAgLy8gICAneHh4eDEyMycgLT4gJzEyM3l5eXknXG4gICAgLy9cbiAgICAvLyBXaXRoIDEtZWRpdCB1cGRhdGVzLCB0aGUgc2hvcnRlc3QgcGF0aCB3b3VsZCBiZSBqdXN0IHRvIHVwZGF0ZSBhbGwgc2V2ZW5cbiAgICAvLyBjaGFyYWN0ZXJzLiBXaXRoIDItZWRpdCB1cGRhdGVzLCB3ZSBkZWxldGUgNCwgbGVhdmUgMywgYW5kIGFkZCA0LiBUaGlzXG4gICAgLy8gbGVhdmVzIHRoZSBzdWJzdHJpbmcgJzEyMycgaW50YWN0LlxuICAgIGNhbGNFZGl0RGlzdGFuY2VzOiBmdW5jdGlvbihjdXJyZW50LCBjdXJyZW50U3RhcnQsIGN1cnJlbnRFbmQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZCwgb2xkU3RhcnQsIG9sZEVuZCkge1xuICAgICAgLy8gXCJEZWxldGlvblwiIGNvbHVtbnNcbiAgICAgIHZhciByb3dDb3VudCA9IG9sZEVuZCAtIG9sZFN0YXJ0ICsgMTtcbiAgICAgIHZhciBjb2x1bW5Db3VudCA9IGN1cnJlbnRFbmQgLSBjdXJyZW50U3RhcnQgKyAxO1xuICAgICAgdmFyIGRpc3RhbmNlcyA9IG5ldyBBcnJheShyb3dDb3VudCk7XG5cbiAgICAgIC8vIFwiQWRkaXRpb25cIiByb3dzLiBJbml0aWFsaXplIG51bGwgY29sdW1uLlxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByb3dDb3VudDsgaSsrKSB7XG4gICAgICAgIGRpc3RhbmNlc1tpXSA9IG5ldyBBcnJheShjb2x1bW5Db3VudCk7XG4gICAgICAgIGRpc3RhbmNlc1tpXVswXSA9IGk7XG4gICAgICB9XG5cbiAgICAgIC8vIEluaXRpYWxpemUgbnVsbCByb3dcbiAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgY29sdW1uQ291bnQ7IGorKylcbiAgICAgICAgZGlzdGFuY2VzWzBdW2pdID0gajtcblxuICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCByb3dDb3VudDsgaSsrKSB7XG4gICAgICAgIGZvciAodmFyIGogPSAxOyBqIDwgY29sdW1uQ291bnQ7IGorKykge1xuICAgICAgICAgIGlmICh0aGlzLmVxdWFscyhjdXJyZW50W2N1cnJlbnRTdGFydCArIGogLSAxXSwgb2xkW29sZFN0YXJ0ICsgaSAtIDFdKSlcbiAgICAgICAgICAgIGRpc3RhbmNlc1tpXVtqXSA9IGRpc3RhbmNlc1tpIC0gMV1baiAtIDFdO1xuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdmFyIG5vcnRoID0gZGlzdGFuY2VzW2kgLSAxXVtqXSArIDE7XG4gICAgICAgICAgICB2YXIgd2VzdCA9IGRpc3RhbmNlc1tpXVtqIC0gMV0gKyAxO1xuICAgICAgICAgICAgZGlzdGFuY2VzW2ldW2pdID0gbm9ydGggPCB3ZXN0ID8gbm9ydGggOiB3ZXN0O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gZGlzdGFuY2VzO1xuICAgIH0sXG5cbiAgICAvLyBUaGlzIHN0YXJ0cyBhdCB0aGUgZmluYWwgd2VpZ2h0LCBhbmQgd2Fsa3MgXCJiYWNrd2FyZFwiIGJ5IGZpbmRpbmdcbiAgICAvLyB0aGUgbWluaW11bSBwcmV2aW91cyB3ZWlnaHQgcmVjdXJzaXZlbHkgdW50aWwgdGhlIG9yaWdpbiBvZiB0aGUgd2VpZ2h0XG4gICAgLy8gbWF0cml4LlxuICAgIHNwbGljZU9wZXJhdGlvbnNGcm9tRWRpdERpc3RhbmNlczogZnVuY3Rpb24oZGlzdGFuY2VzKSB7XG4gICAgICB2YXIgaSA9IGRpc3RhbmNlcy5sZW5ndGggLSAxO1xuICAgICAgdmFyIGogPSBkaXN0YW5jZXNbMF0ubGVuZ3RoIC0gMTtcbiAgICAgIHZhciBjdXJyZW50ID0gZGlzdGFuY2VzW2ldW2pdO1xuICAgICAgdmFyIGVkaXRzID0gW107XG4gICAgICB3aGlsZSAoaSA+IDAgfHwgaiA+IDApIHtcbiAgICAgICAgaWYgKGkgPT0gMCkge1xuICAgICAgICAgIGVkaXRzLnB1c2goRURJVF9BREQpO1xuICAgICAgICAgIGotLTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaiA9PSAwKSB7XG4gICAgICAgICAgZWRpdHMucHVzaChFRElUX0RFTEVURSk7XG4gICAgICAgICAgaS0tO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIHZhciBub3J0aFdlc3QgPSBkaXN0YW5jZXNbaSAtIDFdW2ogLSAxXTtcbiAgICAgICAgdmFyIHdlc3QgPSBkaXN0YW5jZXNbaSAtIDFdW2pdO1xuICAgICAgICB2YXIgbm9ydGggPSBkaXN0YW5jZXNbaV1baiAtIDFdO1xuXG4gICAgICAgIHZhciBtaW47XG4gICAgICAgIGlmICh3ZXN0IDwgbm9ydGgpXG4gICAgICAgICAgbWluID0gd2VzdCA8IG5vcnRoV2VzdCA/IHdlc3QgOiBub3J0aFdlc3Q7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICBtaW4gPSBub3J0aCA8IG5vcnRoV2VzdCA/IG5vcnRoIDogbm9ydGhXZXN0O1xuXG4gICAgICAgIGlmIChtaW4gPT0gbm9ydGhXZXN0KSB7XG4gICAgICAgICAgaWYgKG5vcnRoV2VzdCA9PSBjdXJyZW50KSB7XG4gICAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfTEVBVkUpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfVVBEQVRFKTtcbiAgICAgICAgICAgIGN1cnJlbnQgPSBub3J0aFdlc3Q7XG4gICAgICAgICAgfVxuICAgICAgICAgIGktLTtcbiAgICAgICAgICBqLS07XG4gICAgICAgIH0gZWxzZSBpZiAobWluID09IHdlc3QpIHtcbiAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfREVMRVRFKTtcbiAgICAgICAgICBpLS07XG4gICAgICAgICAgY3VycmVudCA9IHdlc3Q7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZWRpdHMucHVzaChFRElUX0FERCk7XG4gICAgICAgICAgai0tO1xuICAgICAgICAgIGN1cnJlbnQgPSBub3J0aDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBlZGl0cy5yZXZlcnNlKCk7XG4gICAgICByZXR1cm4gZWRpdHM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFNwbGljZSBQcm9qZWN0aW9uIGZ1bmN0aW9uczpcbiAgICAgKlxuICAgICAqIEEgc3BsaWNlIG1hcCBpcyBhIHJlcHJlc2VudGF0aW9uIG9mIGhvdyBhIHByZXZpb3VzIGFycmF5IG9mIGl0ZW1zXG4gICAgICogd2FzIHRyYW5zZm9ybWVkIGludG8gYSBuZXcgYXJyYXkgb2YgaXRlbXMuIENvbmNlcHR1YWxseSBpdCBpcyBhIGxpc3Qgb2ZcbiAgICAgKiB0dXBsZXMgb2ZcbiAgICAgKlxuICAgICAqICAgPGluZGV4LCByZW1vdmVkLCBhZGRlZENvdW50PlxuICAgICAqXG4gICAgICogd2hpY2ggYXJlIGtlcHQgaW4gYXNjZW5kaW5nIGluZGV4IG9yZGVyIG9mLiBUaGUgdHVwbGUgcmVwcmVzZW50cyB0aGF0IGF0XG4gICAgICogdGhlIHxpbmRleHwsIHxyZW1vdmVkfCBzZXF1ZW5jZSBvZiBpdGVtcyB3ZXJlIHJlbW92ZWQsIGFuZCBjb3VudGluZyBmb3J3YXJkXG4gICAgICogZnJvbSB8aW5kZXh8LCB8YWRkZWRDb3VudHwgaXRlbXMgd2VyZSBhZGRlZC5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIExhY2tpbmcgaW5kaXZpZHVhbCBzcGxpY2UgbXV0YXRpb24gaW5mb3JtYXRpb24sIHRoZSBtaW5pbWFsIHNldCBvZlxuICAgICAqIHNwbGljZXMgY2FuIGJlIHN5bnRoZXNpemVkIGdpdmVuIHRoZSBwcmV2aW91cyBzdGF0ZSBhbmQgZmluYWwgc3RhdGUgb2YgYW5cbiAgICAgKiBhcnJheS4gVGhlIGJhc2ljIGFwcHJvYWNoIGlzIHRvIGNhbGN1bGF0ZSB0aGUgZWRpdCBkaXN0YW5jZSBtYXRyaXggYW5kXG4gICAgICogY2hvb3NlIHRoZSBzaG9ydGVzdCBwYXRoIHRocm91Z2ggaXQuXG4gICAgICpcbiAgICAgKiBDb21wbGV4aXR5OiBPKGwgKiBwKVxuICAgICAqICAgbDogVGhlIGxlbmd0aCBvZiB0aGUgY3VycmVudCBhcnJheVxuICAgICAqICAgcDogVGhlIGxlbmd0aCBvZiB0aGUgb2xkIGFycmF5XG4gICAgICovXG4gICAgY2FsY1NwbGljZXM6IGZ1bmN0aW9uKGN1cnJlbnQsIGN1cnJlbnRTdGFydCwgY3VycmVudEVuZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkLCBvbGRTdGFydCwgb2xkRW5kKSB7XG4gICAgICB2YXIgcHJlZml4Q291bnQgPSAwO1xuICAgICAgdmFyIHN1ZmZpeENvdW50ID0gMDtcblxuICAgICAgdmFyIG1pbkxlbmd0aCA9IE1hdGgubWluKGN1cnJlbnRFbmQgLSBjdXJyZW50U3RhcnQsIG9sZEVuZCAtIG9sZFN0YXJ0KTtcbiAgICAgIGlmIChjdXJyZW50U3RhcnQgPT0gMCAmJiBvbGRTdGFydCA9PSAwKVxuICAgICAgICBwcmVmaXhDb3VudCA9IHRoaXMuc2hhcmVkUHJlZml4KGN1cnJlbnQsIG9sZCwgbWluTGVuZ3RoKTtcblxuICAgICAgaWYgKGN1cnJlbnRFbmQgPT0gY3VycmVudC5sZW5ndGggJiYgb2xkRW5kID09IG9sZC5sZW5ndGgpXG4gICAgICAgIHN1ZmZpeENvdW50ID0gdGhpcy5zaGFyZWRTdWZmaXgoY3VycmVudCwgb2xkLCBtaW5MZW5ndGggLSBwcmVmaXhDb3VudCk7XG5cbiAgICAgIGN1cnJlbnRTdGFydCArPSBwcmVmaXhDb3VudDtcbiAgICAgIG9sZFN0YXJ0ICs9IHByZWZpeENvdW50O1xuICAgICAgY3VycmVudEVuZCAtPSBzdWZmaXhDb3VudDtcbiAgICAgIG9sZEVuZCAtPSBzdWZmaXhDb3VudDtcblxuICAgICAgaWYgKGN1cnJlbnRFbmQgLSBjdXJyZW50U3RhcnQgPT0gMCAmJiBvbGRFbmQgLSBvbGRTdGFydCA9PSAwKVxuICAgICAgICByZXR1cm4gW107XG5cbiAgICAgIGlmIChjdXJyZW50U3RhcnQgPT0gY3VycmVudEVuZCkge1xuICAgICAgICB2YXIgc3BsaWNlID0gbmV3U3BsaWNlKGN1cnJlbnRTdGFydCwgW10sIDApO1xuICAgICAgICB3aGlsZSAob2xkU3RhcnQgPCBvbGRFbmQpXG4gICAgICAgICAgc3BsaWNlLnJlbW92ZWQucHVzaChvbGRbb2xkU3RhcnQrK10pO1xuXG4gICAgICAgIHJldHVybiBbIHNwbGljZSBdO1xuICAgICAgfSBlbHNlIGlmIChvbGRTdGFydCA9PSBvbGRFbmQpXG4gICAgICAgIHJldHVybiBbIG5ld1NwbGljZShjdXJyZW50U3RhcnQsIFtdLCBjdXJyZW50RW5kIC0gY3VycmVudFN0YXJ0KSBdO1xuXG4gICAgICB2YXIgb3BzID0gdGhpcy5zcGxpY2VPcGVyYXRpb25zRnJvbUVkaXREaXN0YW5jZXMoXG4gICAgICAgICAgdGhpcy5jYWxjRWRpdERpc3RhbmNlcyhjdXJyZW50LCBjdXJyZW50U3RhcnQsIGN1cnJlbnRFbmQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGQsIG9sZFN0YXJ0LCBvbGRFbmQpKTtcblxuICAgICAgdmFyIHNwbGljZSA9IHVuZGVmaW5lZDtcbiAgICAgIHZhciBzcGxpY2VzID0gW107XG4gICAgICB2YXIgaW5kZXggPSBjdXJyZW50U3RhcnQ7XG4gICAgICB2YXIgb2xkSW5kZXggPSBvbGRTdGFydDtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHN3aXRjaChvcHNbaV0pIHtcbiAgICAgICAgICBjYXNlIEVESVRfTEVBVkU6XG4gICAgICAgICAgICBpZiAoc3BsaWNlKSB7XG4gICAgICAgICAgICAgIHNwbGljZXMucHVzaChzcGxpY2UpO1xuICAgICAgICAgICAgICBzcGxpY2UgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGluZGV4Kys7XG4gICAgICAgICAgICBvbGRJbmRleCsrO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSBFRElUX1VQREFURTpcbiAgICAgICAgICAgIGlmICghc3BsaWNlKVxuICAgICAgICAgICAgICBzcGxpY2UgPSBuZXdTcGxpY2UoaW5kZXgsIFtdLCAwKTtcblxuICAgICAgICAgICAgc3BsaWNlLmFkZGVkQ291bnQrKztcbiAgICAgICAgICAgIGluZGV4Kys7XG5cbiAgICAgICAgICAgIHNwbGljZS5yZW1vdmVkLnB1c2gob2xkW29sZEluZGV4XSk7XG4gICAgICAgICAgICBvbGRJbmRleCsrO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSBFRElUX0FERDpcbiAgICAgICAgICAgIGlmICghc3BsaWNlKVxuICAgICAgICAgICAgICBzcGxpY2UgPSBuZXdTcGxpY2UoaW5kZXgsIFtdLCAwKTtcblxuICAgICAgICAgICAgc3BsaWNlLmFkZGVkQ291bnQrKztcbiAgICAgICAgICAgIGluZGV4Kys7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIEVESVRfREVMRVRFOlxuICAgICAgICAgICAgaWYgKCFzcGxpY2UpXG4gICAgICAgICAgICAgIHNwbGljZSA9IG5ld1NwbGljZShpbmRleCwgW10sIDApO1xuXG4gICAgICAgICAgICBzcGxpY2UucmVtb3ZlZC5wdXNoKG9sZFtvbGRJbmRleF0pO1xuICAgICAgICAgICAgb2xkSW5kZXgrKztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChzcGxpY2UpIHtcbiAgICAgICAgc3BsaWNlcy5wdXNoKHNwbGljZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gc3BsaWNlcztcbiAgICB9LFxuXG4gICAgc2hhcmVkUHJlZml4OiBmdW5jdGlvbihjdXJyZW50LCBvbGQsIHNlYXJjaExlbmd0aCkge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzZWFyY2hMZW5ndGg7IGkrKylcbiAgICAgICAgaWYgKCF0aGlzLmVxdWFscyhjdXJyZW50W2ldLCBvbGRbaV0pKVxuICAgICAgICAgIHJldHVybiBpO1xuICAgICAgcmV0dXJuIHNlYXJjaExlbmd0aDtcbiAgICB9LFxuXG4gICAgc2hhcmVkU3VmZml4OiBmdW5jdGlvbihjdXJyZW50LCBvbGQsIHNlYXJjaExlbmd0aCkge1xuICAgICAgdmFyIGluZGV4MSA9IGN1cnJlbnQubGVuZ3RoO1xuICAgICAgdmFyIGluZGV4MiA9IG9sZC5sZW5ndGg7XG4gICAgICB2YXIgY291bnQgPSAwO1xuICAgICAgd2hpbGUgKGNvdW50IDwgc2VhcmNoTGVuZ3RoICYmIHRoaXMuZXF1YWxzKGN1cnJlbnRbLS1pbmRleDFdLCBvbGRbLS1pbmRleDJdKSlcbiAgICAgICAgY291bnQrKztcblxuICAgICAgcmV0dXJuIGNvdW50O1xuICAgIH0sXG5cbiAgICBjYWxjdWxhdGVTcGxpY2VzOiBmdW5jdGlvbihjdXJyZW50LCBwcmV2aW91cykge1xuICAgICAgcmV0dXJuIHRoaXMuY2FsY1NwbGljZXMoY3VycmVudCwgMCwgY3VycmVudC5sZW5ndGgsIHByZXZpb3VzLCAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJldmlvdXMubGVuZ3RoKTtcbiAgICB9LFxuXG4gICAgZXF1YWxzOiBmdW5jdGlvbihjdXJyZW50VmFsdWUsIHByZXZpb3VzVmFsdWUpIHtcbiAgICAgIHJldHVybiBjdXJyZW50VmFsdWUgPT09IHByZXZpb3VzVmFsdWU7XG4gICAgfVxuICB9O1xuXG4gIHZhciBhcnJheVNwbGljZSA9IG5ldyBBcnJheVNwbGljZSgpO1xuXG4gIGZ1bmN0aW9uIGNhbGNTcGxpY2VzKGN1cnJlbnQsIGN1cnJlbnRTdGFydCwgY3VycmVudEVuZCxcbiAgICAgICAgICAgICAgICAgICAgICAgb2xkLCBvbGRTdGFydCwgb2xkRW5kKSB7XG4gICAgcmV0dXJuIGFycmF5U3BsaWNlLmNhbGNTcGxpY2VzKGN1cnJlbnQsIGN1cnJlbnRTdGFydCwgY3VycmVudEVuZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkLCBvbGRTdGFydCwgb2xkRW5kKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGludGVyc2VjdChzdGFydDEsIGVuZDEsIHN0YXJ0MiwgZW5kMikge1xuICAgIC8vIERpc2pvaW50XG4gICAgaWYgKGVuZDEgPCBzdGFydDIgfHwgZW5kMiA8IHN0YXJ0MSlcbiAgICAgIHJldHVybiAtMTtcblxuICAgIC8vIEFkamFjZW50XG4gICAgaWYgKGVuZDEgPT0gc3RhcnQyIHx8IGVuZDIgPT0gc3RhcnQxKVxuICAgICAgcmV0dXJuIDA7XG5cbiAgICAvLyBOb24temVybyBpbnRlcnNlY3QsIHNwYW4xIGZpcnN0XG4gICAgaWYgKHN0YXJ0MSA8IHN0YXJ0Mikge1xuICAgICAgaWYgKGVuZDEgPCBlbmQyKVxuICAgICAgICByZXR1cm4gZW5kMSAtIHN0YXJ0MjsgLy8gT3ZlcmxhcFxuICAgICAgZWxzZVxuICAgICAgICByZXR1cm4gZW5kMiAtIHN0YXJ0MjsgLy8gQ29udGFpbmVkXG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIE5vbi16ZXJvIGludGVyc2VjdCwgc3BhbjIgZmlyc3RcbiAgICAgIGlmIChlbmQyIDwgZW5kMSlcbiAgICAgICAgcmV0dXJuIGVuZDIgLSBzdGFydDE7IC8vIE92ZXJsYXBcbiAgICAgIGVsc2VcbiAgICAgICAgcmV0dXJuIGVuZDEgLSBzdGFydDE7IC8vIENvbnRhaW5lZFxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG1lcmdlU3BsaWNlKHNwbGljZXMsIGluZGV4LCByZW1vdmVkLCBhZGRlZENvdW50KSB7XG5cbiAgICB2YXIgc3BsaWNlID0gbmV3U3BsaWNlKGluZGV4LCByZW1vdmVkLCBhZGRlZENvdW50KTtcblxuICAgIHZhciBpbnNlcnRlZCA9IGZhbHNlO1xuICAgIHZhciBpbnNlcnRpb25PZmZzZXQgPSAwO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzcGxpY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgY3VycmVudCA9IHNwbGljZXNbaV07XG4gICAgICBjdXJyZW50LmluZGV4ICs9IGluc2VydGlvbk9mZnNldDtcblxuICAgICAgaWYgKGluc2VydGVkKVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgdmFyIGludGVyc2VjdENvdW50ID0gaW50ZXJzZWN0KHNwbGljZS5pbmRleCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcGxpY2UuaW5kZXggKyBzcGxpY2UucmVtb3ZlZC5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudC5pbmRleCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50LmluZGV4ICsgY3VycmVudC5hZGRlZENvdW50KTtcblxuICAgICAgaWYgKGludGVyc2VjdENvdW50ID49IDApIHtcbiAgICAgICAgLy8gTWVyZ2UgdGhlIHR3byBzcGxpY2VzXG5cbiAgICAgICAgc3BsaWNlcy5zcGxpY2UoaSwgMSk7XG4gICAgICAgIGktLTtcblxuICAgICAgICBpbnNlcnRpb25PZmZzZXQgLT0gY3VycmVudC5hZGRlZENvdW50IC0gY3VycmVudC5yZW1vdmVkLmxlbmd0aDtcblxuICAgICAgICBzcGxpY2UuYWRkZWRDb3VudCArPSBjdXJyZW50LmFkZGVkQ291bnQgLSBpbnRlcnNlY3RDb3VudDtcbiAgICAgICAgdmFyIGRlbGV0ZUNvdW50ID0gc3BsaWNlLnJlbW92ZWQubGVuZ3RoICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudC5yZW1vdmVkLmxlbmd0aCAtIGludGVyc2VjdENvdW50O1xuXG4gICAgICAgIGlmICghc3BsaWNlLmFkZGVkQ291bnQgJiYgIWRlbGV0ZUNvdW50KSB7XG4gICAgICAgICAgLy8gbWVyZ2VkIHNwbGljZSBpcyBhIG5vb3AuIGRpc2NhcmQuXG4gICAgICAgICAgaW5zZXJ0ZWQgPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhciByZW1vdmVkID0gY3VycmVudC5yZW1vdmVkO1xuXG4gICAgICAgICAgaWYgKHNwbGljZS5pbmRleCA8IGN1cnJlbnQuaW5kZXgpIHtcbiAgICAgICAgICAgIC8vIHNvbWUgcHJlZml4IG9mIHNwbGljZS5yZW1vdmVkIGlzIHByZXBlbmRlZCB0byBjdXJyZW50LnJlbW92ZWQuXG4gICAgICAgICAgICB2YXIgcHJlcGVuZCA9IHNwbGljZS5yZW1vdmVkLnNsaWNlKDAsIGN1cnJlbnQuaW5kZXggLSBzcGxpY2UuaW5kZXgpO1xuICAgICAgICAgICAgQXJyYXkucHJvdG90eXBlLnB1c2guYXBwbHkocHJlcGVuZCwgcmVtb3ZlZCk7XG4gICAgICAgICAgICByZW1vdmVkID0gcHJlcGVuZDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoc3BsaWNlLmluZGV4ICsgc3BsaWNlLnJlbW92ZWQubGVuZ3RoID4gY3VycmVudC5pbmRleCArIGN1cnJlbnQuYWRkZWRDb3VudCkge1xuICAgICAgICAgICAgLy8gc29tZSBzdWZmaXggb2Ygc3BsaWNlLnJlbW92ZWQgaXMgYXBwZW5kZWQgdG8gY3VycmVudC5yZW1vdmVkLlxuICAgICAgICAgICAgdmFyIGFwcGVuZCA9IHNwbGljZS5yZW1vdmVkLnNsaWNlKGN1cnJlbnQuaW5kZXggKyBjdXJyZW50LmFkZGVkQ291bnQgLSBzcGxpY2UuaW5kZXgpO1xuICAgICAgICAgICAgQXJyYXkucHJvdG90eXBlLnB1c2guYXBwbHkocmVtb3ZlZCwgYXBwZW5kKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBzcGxpY2UucmVtb3ZlZCA9IHJlbW92ZWQ7XG4gICAgICAgICAgaWYgKGN1cnJlbnQuaW5kZXggPCBzcGxpY2UuaW5kZXgpIHtcbiAgICAgICAgICAgIHNwbGljZS5pbmRleCA9IGN1cnJlbnQuaW5kZXg7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHNwbGljZS5pbmRleCA8IGN1cnJlbnQuaW5kZXgpIHtcbiAgICAgICAgLy8gSW5zZXJ0IHNwbGljZSBoZXJlLlxuXG4gICAgICAgIGluc2VydGVkID0gdHJ1ZTtcblxuICAgICAgICBzcGxpY2VzLnNwbGljZShpLCAwLCBzcGxpY2UpO1xuICAgICAgICBpKys7XG5cbiAgICAgICAgdmFyIG9mZnNldCA9IHNwbGljZS5hZGRlZENvdW50IC0gc3BsaWNlLnJlbW92ZWQubGVuZ3RoXG4gICAgICAgIGN1cnJlbnQuaW5kZXggKz0gb2Zmc2V0O1xuICAgICAgICBpbnNlcnRpb25PZmZzZXQgKz0gb2Zmc2V0O1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghaW5zZXJ0ZWQpXG4gICAgICBzcGxpY2VzLnB1c2goc3BsaWNlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZUluaXRpYWxTcGxpY2VzKGFycmF5LCBjaGFuZ2VSZWNvcmRzKSB7XG4gICAgdmFyIHNwbGljZXMgPSBbXTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hhbmdlUmVjb3Jkcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHJlY29yZCA9IGNoYW5nZVJlY29yZHNbaV07XG4gICAgICBzd2l0Y2gocmVjb3JkLnR5cGUpIHtcbiAgICAgICAgY2FzZSAnc3BsaWNlJzpcbiAgICAgICAgICBtZXJnZVNwbGljZShzcGxpY2VzLCByZWNvcmQuaW5kZXgsIHJlY29yZC5yZW1vdmVkLnNsaWNlKCksIHJlY29yZC5hZGRlZENvdW50KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnYWRkJzpcbiAgICAgICAgY2FzZSAndXBkYXRlJzpcbiAgICAgICAgY2FzZSAnZGVsZXRlJzpcbiAgICAgICAgICBpZiAoIWlzSW5kZXgocmVjb3JkLm5hbWUpKVxuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgdmFyIGluZGV4ID0gdG9OdW1iZXIocmVjb3JkLm5hbWUpO1xuICAgICAgICAgIGlmIChpbmRleCA8IDApXG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICBtZXJnZVNwbGljZShzcGxpY2VzLCBpbmRleCwgW3JlY29yZC5vbGRWYWx1ZV0sIDEpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1VuZXhwZWN0ZWQgcmVjb3JkIHR5cGU6ICcgKyBKU09OLnN0cmluZ2lmeShyZWNvcmQpKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gc3BsaWNlcztcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb2plY3RBcnJheVNwbGljZXMoYXJyYXksIGNoYW5nZVJlY29yZHMpIHtcbiAgICB2YXIgc3BsaWNlcyA9IFtdO1xuXG4gICAgY3JlYXRlSW5pdGlhbFNwbGljZXMoYXJyYXksIGNoYW5nZVJlY29yZHMpLmZvckVhY2goZnVuY3Rpb24oc3BsaWNlKSB7XG4gICAgICBpZiAoc3BsaWNlLmFkZGVkQ291bnQgPT0gMSAmJiBzcGxpY2UucmVtb3ZlZC5sZW5ndGggPT0gMSkge1xuICAgICAgICBpZiAoc3BsaWNlLnJlbW92ZWRbMF0gIT09IGFycmF5W3NwbGljZS5pbmRleF0pXG4gICAgICAgICAgc3BsaWNlcy5wdXNoKHNwbGljZSk7XG5cbiAgICAgICAgcmV0dXJuXG4gICAgICB9O1xuXG4gICAgICBzcGxpY2VzID0gc3BsaWNlcy5jb25jYXQoY2FsY1NwbGljZXMoYXJyYXksIHNwbGljZS5pbmRleCwgc3BsaWNlLmluZGV4ICsgc3BsaWNlLmFkZGVkQ291bnQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3BsaWNlLnJlbW92ZWQsIDAsIHNwbGljZS5yZW1vdmVkLmxlbmd0aCkpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHNwbGljZXM7XG4gIH1cblxuIC8vIEV4cG9ydCB0aGUgb2JzZXJ2ZS1qcyBvYmplY3QgZm9yICoqTm9kZS5qcyoqLCB3aXRoXG4vLyBiYWNrd2FyZHMtY29tcGF0aWJpbGl0eSBmb3IgdGhlIG9sZCBgcmVxdWlyZSgpYCBBUEkuIElmIHdlJ3JlIGluXG4vLyB0aGUgYnJvd3NlciwgZXhwb3J0IGFzIGEgZ2xvYmFsIG9iamVjdC5cbnZhciBleHBvc2UgPSBnbG9iYWw7XG5pZiAodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcbmV4cG9zZSA9IGV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cztcbn1cbmV4cG9zZSA9IGV4cG9ydHM7XG59XG5leHBvc2UuT2JzZXJ2ZXIgPSBPYnNlcnZlcjtcbmV4cG9zZS5PYnNlcnZlci5ydW5FT01fID0gcnVuRU9NO1xuZXhwb3NlLk9ic2VydmVyLm9ic2VydmVyU2VudGluZWxfID0gb2JzZXJ2ZXJTZW50aW5lbDsgLy8gZm9yIHRlc3RpbmcuXG5leHBvc2UuT2JzZXJ2ZXIuaGFzT2JqZWN0T2JzZXJ2ZSA9IGhhc09ic2VydmU7XG5leHBvc2UuQXJyYXlPYnNlcnZlciA9IEFycmF5T2JzZXJ2ZXI7XG5leHBvc2UuQXJyYXlPYnNlcnZlci5jYWxjdWxhdGVTcGxpY2VzID0gZnVuY3Rpb24oY3VycmVudCwgcHJldmlvdXMpIHtcbnJldHVybiBhcnJheVNwbGljZS5jYWxjdWxhdGVTcGxpY2VzKGN1cnJlbnQsIHByZXZpb3VzKTtcbn07XG5leHBvc2UuUGxhdGZvcm0gPSBnbG9iYWwuUGxhdGZvcm07XG5leHBvc2UuQXJyYXlTcGxpY2UgPSBBcnJheVNwbGljZTtcbmV4cG9zZS5PYmplY3RPYnNlcnZlciA9IE9iamVjdE9ic2VydmVyO1xufSkodHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcgJiYgZ2xvYmFsICYmIHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZSA/IGdsb2JhbCA6IHRoaXMgfHwgd2luZG93KTtcblxufSkuY2FsbCh0aGlzLHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pIl19
