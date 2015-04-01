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
(function() {
  /**
   * @module relationships
   */

  var RelationshipProxy = require('./RelationshipProxy'),
    util = require('./util'),
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

  util.extend(ManyToManyProxy.prototype, {
    clearReverse: function(removed) {
      var self = this;
      removed.forEach(function(removedObject) {
        var reverseProxy = self.reverseProxyForInstance(removedObject);
        var idx = reverseProxy.related.indexOf(self.object);
        reverseProxy.makeChangesToRelatedWithoutObservations(function() {
          reverseProxy.splice(idx, 1);
        });
      });
    },
    setReverseOfAdded: function(added) {
      var self = this;
      added.forEach(function(addedObject) {
        var reverseProxy = self.reverseProxyForInstance(addedObject);
        reverseProxy.makeChangesToRelatedWithoutObservations(function() {
          reverseProxy.splice(0, 0, self.object);
        });
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
    get: function(cb) {
      return util.promise(cb, function(cb) {
        cb(null, this.related);
      }.bind(this));
    },
    validate: function(obj) {
      if (Object.prototype.toString.call(obj) != '[object Array]') {
        return 'Cannot assign scalar to many to many';
      }
      return null;
    },
    set: function(obj, opts) {
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
    install: function(obj) {
      RelationshipProxy.prototype.install.call(this, obj);
      this.wrapArray(this.related);
      obj[('splice' + util.capitaliseFirstLetter(this.reverseName))] = this.splice.bind(this);
    },
    registerRemovalListener: function(obj) {
      this.relatedCancelListeners[obj.localId] = obj.on('*', function(e) {

      }.bind(this));
    }
  });


  module.exports = ManyToManyProxy;
})();
},{"../vendor/observe-js/src/observe":53,"./RelationshipProxy":10,"./events":16,"./modelEvents":22,"./util":25}],3:[function(require,module,exports){
(function() {
  var log = require('./log'),
    util = require('./util'),
    error = require('./error'),
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
          var proxies = Object.keys(self.__proxies || {}).map(function(x) {
            return self.__proxies[x]
          });
          return proxies.map(function(p) {
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

  util.extend(ModelInstance.prototype, {
    get: function(cb) {
      return util.promise(cb, function(cb) {
        cb(null, this);
      }.bind(this));
    },
    emit: function(type, opts) {
      if (typeof type == 'object') opts = type;
      else opts.type = type;
      opts = opts || {};
      util.extend(opts, {
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
  util.extend(ModelInstance.prototype, {
    getAttributes: function() {
      return util.extend({}, this.__values);
    },
    isInstanceOf: function(model) {
      return this.model == model;
    },
    isA: function(model) {
      return this.model == model || this.model.isDescendantOf(model);
    }
  });

  // Dump
  util.extend(ModelInstance.prototype, {
    _dumpString: function(reverseRelationships) {
      return JSON.stringify(this._dump(reverseRelationships, null, 4));
    },
    _dump: function(reverseRelationships) {
      var dumped = util.extend({}, this.__values);
      dumped._rev = this._rev;
      dumped.localId = this.localId;
      return dumped;
    }
  });

  // Serialisation
  util.extend(ModelInstance.prototype, {
    _defaultSerialise: function(opts) {
      var serialised = {};
      var includeNullAttributes = opts.includeNullAttributes !== undefined ? opts.includeNullAttributes : true,
        includeNullRelationships = opts.includeNullRelationships !== undefined ? opts.includeNullRelationships : true;
      var serialisableFields = this.model.serialisableFields ||
        this._attributeNames.concat.apply(this._attributeNames, this._relationshipNames).concat(this.id);
      this._attributeNames.forEach(function(attrName) {
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
      this._relationshipNames.forEach(function(relName) {
        if (serialisableFields.indexOf(relName) > -1) {
          var val = this[relName],
            rel = this.model.relationships[relName];
          if (util.isArray(val)) {
            val = util.pluck(val, this.model.id);
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

  util.extend(ModelInstance.prototype, {
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
},{"./cache":12,"./error":15,"./events":16,"./log":19,"./modelEvents":22,"./util":25}],4:[function(require,module,exports){
(function () {
    var RelationshipProxy = require('./RelationshipProxy'),
        util = require('./util'),
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

    util.extend(OneToManyProxy.prototype, {
        clearReverse: function (removed) {
            var self = this;
            removed.forEach(function (removedObject) {
                var reverseProxy = self.reverseProxyForInstance(removedObject);
                reverseProxy.setIdAndRelated(null);
            });
        },
        setReverseOfAdded: function (added) {
            var self = this;
            added.forEach(function (added) {
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
                obj[('splice' + util.capitaliseFirstLetter(this.reverseName))] = this.splice.bind(this);
                this.wrapArray(this.related);
            }

        }
    });


    module.exports = OneToManyProxy;
})();
},{"../vendor/observe-js/src/observe":53,"./RelationshipProxy":10,"./events":16,"./modelEvents":22,"./util":25}],5:[function(require,module,exports){
(function() {
  var RelationshipProxy = require('./RelationshipProxy'),
    util = require('./util'),
    SiestaModel = require('./ModelInstance');

  /**
   * [OneToOneProxy description]
   * @param {Object} opts
   */
  function OneToOneProxy(opts) {
    RelationshipProxy.call(this, opts);
  }


  OneToOneProxy.prototype = Object.create(RelationshipProxy.prototype);

  util.extend(OneToOneProxy.prototype, {
    /**
     * Validate the object that we're setting
     * @param obj
     * @returns {string|null} An error message or null
     */
    validate: function(obj) {
      if (Object.prototype.toString.call(obj) == '[object Array]') {
        return 'Cannot assign array to one to one relationship';
      }
      else if ((!obj instanceof SiestaModel)) {

      }
      return null;
    },
    set: function(obj, opts) {
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
    get: function(cb) {
      return util.promise(cb, function(cb) {
        cb(null, this.related);
      }.bind(this));
    }
  });


  module.exports = OneToOneProxy;
})();
},{"./ModelInstance":3,"./RelationshipProxy":10,"./util":25}],6:[function(require,module,exports){
var util = require('./util');

/**
 * Acts as a placeholder for various objects e.g. lazy registration of models.
 * @param [opts]
 * @constructor
 */
function Placeholder(opts) {
  util.extend(this, opts || {});
  this.isPlaceholder = true;
}

module.exports = Placeholder;
},{"./util":25}],7:[function(require,module,exports){
(function() {
  var log = require('./log')('query'),
    cache = require('./cache'),
    util = require('./util'),
    error = require('./error'),
    ModelInstance = require('./ModelInstance'),
    constructQuerySet = require('./QuerySet');

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
    util.extend(this, {
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

  util.extend(Query, {
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

  util.extend(Query.prototype, {
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
      fields.slice(0, fields.length - 1).forEach(function(f) {
        if (util.isArray(obj)) {
          obj = util.pluck(obj, f);
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
},{"./ModelInstance":3,"./QuerySet":8,"./cache":12,"./error":15,"./log":19,"./util":25}],8:[function(require,module,exports){
var util = require('./util'),
  Promise = util.Promise,
  error = require('./error'),
  ModelInstance = require('./ModelInstance');

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
      get: function() {
        return querySet(util.pluck(arr, prop));
      },
      set: function(v) {
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
    arr[prop] = function() {
      var args = arguments,
        res = this.map(function(p) {
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
  arr = util.extend([], arr);
  var attributeNames = model._attributeNames,
    relationshipNames = model._relationshipNames,
    names = attributeNames.concat(relationshipNames).concat(instanceMethods);
  names.forEach(defineAttribute.bind(defineAttribute, arr));
  var instanceMethods = Object.keys(ModelInstance.prototype);
  instanceMethods.forEach(defineMethod.bind(defineMethod, arr));
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
    propertyNames.forEach(function(prop) {
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
  ARRAY_METHODS.forEach(function(p) {
    arr[p] = throwImmutableError;
  });
  arr.immutable = true;
  arr.mutableCopy = arr.asArray = function() {
    var mutableArr = this.map(function(x) {return x});
    mutableArr.asQuerySet = function() {
      return querySet(this);
    };
    mutableArr.asModelQuerySet = function(model) {
      return modelQuerySet(this, model);
    };
    return mutableArr;
  };
  return arr;
}

module.exports = modelQuerySet;
},{"./ModelInstance":3,"./error":15,"./util":25}],9:[function(require,module,exports){
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
    util = require('./util');

  /**
   *
   * @param {Query} query - The underlying query
   * @constructor
   */
  function ReactiveQuery(query) {
    var self = this;
    EventEmitter.call(this);
    Chain.call(this);
    util.extend(this, {
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
      util.extend(this, {
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
  util.extend(ReactiveQuery.prototype, Chain.prototype);

  util.extend(ReactiveQuery, {
    InsertionPolicy: {
      Front: 'Front',
      Back: 'Back'
    }
  });

  util.extend(ReactiveQuery.prototype, {
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
},{"./Chain":1,"./Query":7,"./QuerySet":8,"./error":15,"./events":16,"./log":19,"./modelEvents":22,"./util":25,"events":29}],10:[function(require,module,exports){
/**
 * Base functionality for relationships.
 * @module relationships
 */
(function() {

  var InternalSiestaError = require('./error').InternalSiestaError,
    util = require('./util'),
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

    util.extend(this, {
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

  util.extend(RelationshipProxy, {});

  util.extend(RelationshipProxy.prototype, {
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
  util.extend(RelationshipProxy.prototype, {
    set: function(obj, opts) {
      throw new InternalSiestaError('Must subclass RelationshipProxy');
    },
    get: function(callback) {
      throw new InternalSiestaError('Must subclass RelationshipProxy');
    }
  });

  util.extend(RelationshipProxy.prototype, {
    proxyForInstance: function(modelInstance, reverse) {
      var name = reverse ? this.getReverseName() : this.getForwardName(),
        model = reverse ? this.reverseModel : this.forwardModel;
      var ret;
      // This should never happen. Should g   et caught in the mapping operation?
      if (util.isArray(modelInstance)) {
        ret = modelInstance.map(function(o) {
          return o.__proxies[name];
        });
      } else {
        var proxies = modelInstance.__proxies;
        if (!proxies) {
          console.error('modelInstancce', modelInstance);
          throw 'help me';
        }
        var proxy = proxies[name];
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
        var res = this.related.splice.bind(this.related, idx, numRemove).apply(this.related, add);
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
        reverseProxies.forEach(function(p) {
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
      reverseProxies.forEach(function(p) {
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
},{"../vendor/observe-js/src/observe":53,"./Query":7,"./cache":12,"./error":15,"./events":16,"./log":19,"./modelEvents":22,"./util":25}],11:[function(require,module,exports){
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
    if (util.isArray(localId)) return localId.map(function(x) {return localCacheById[x]});
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
    return util.isArray(remoteId) ? remoteId.map(function(x) {return cache[x]}) : cache[remoteId];
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
},{"./error":15,"./log":19,"./util":25}],13:[function(require,module,exports){
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
    error = require('./error'),
    argsarray = require('argsarray'),
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

    util.extend(this, {
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

  util.extend(Collection.prototype, {
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
          modelsToInstall.forEach(function(m) {
            log('Installing relationships for mapping with name "' + m.name + '"');
            var err = m.installRelationships();
            if (err) errors.push(err);
          });
          if (!errors.length) {
            modelsToInstall.forEach(function(m) {
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

    _model: function(name, opts) {
      if (name) {
        this._rawModels[name] = opts;
        opts = extend(true, {}, opts);
        opts.name = name;
        opts.collection = this;
        var model = new Model(opts);
        this._models[name] = model;
        this[name] = model;
        if (this.installed) {
          var error = model.installRelationships();
          if (!error) error = model.installReverseRelationships();
          if (error)  throw error;
        }
        return model;
      }
      else {
        throw new Error('No name specified when creating mapping');
      }
    },

    /**
     * Registers a model with this collection.
     */
    model: argsarray(function(args) {
      if (args.length) {
        if (args.length == 1) {
          if (util.isArray(args[0])) {
            return args[0].map(function(m) {
              return this._model(m.name, m);
            }.bind(this));
          } else {
            var name, opts;
            if (util.isString(args[0])) {
              name = args[0];
              opts = {};
            }
            else {
              opts = args[0];
              name = opts.name;
            }
            return this._model(name, opts);
          }
        } else {
          if (typeof args[0] == 'string') {
            return this._model(args[0], args[1]);
          } else {
            return args.map(function(m) {
              return this._model(m.name, m);
            }.bind(this));
          }
        }
      }

      return null;
    }),

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
        var tasks = Object.keys(this._models).map(function(modelName) {
          var m = this._models[modelName];
          return m.count.bind(m);
        }.bind(this));
        util.async.parallel(tasks, function(err, ns) {
          var n;
          if (!err) {
            n = ns.reduce(function(m, r) {
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
              return util.extend(memo, res || {});
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
},{"../vendor/observe-js/src/observe":53,"./cache":12,"./collectionRegistry":14,"./error":15,"./events":16,"./index":17,"./log":19,"./model":21,"./util":25,"argsarray":27,"extend":33}],14:[function(require,module,exports){
/**
 * @module collection
 */
(function() {
  var util = require('./util');

  function CollectionRegistry() {
    if (!this) return new CollectionRegistry();
    this.collectionNames = [];
  }

  util.extend(CollectionRegistry.prototype, {
    register: function(collection) {
      var name = collection.name;
      this[name] = collection;
      this.collectionNames.push(name);
    },
    reset: function() {
      var self = this;
      this.collectionNames.forEach(function(name) {
        delete self[name];
      });
      this.collectionNames = [];
    }
  });

  exports.CollectionRegistry = new CollectionRegistry();
})();
},{"./util":25}],15:[function(require,module,exports){
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
    util.extend(this, {
      event: event,
      listeners: {}
    });
    var defaultChainOpts = {};

    defaultChainOpts.on = this.on.bind(this);
    defaultChainOpts.once = this.once.bind(this);

    Chain.call(this, util.extend(defaultChainOpts, chainOpts || {}));
  }

  ProxyEventEmitter.prototype = Object.create(Chain.prototype);

  util.extend(ProxyEventEmitter.prototype, {
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

  util.extend(eventEmitter, {
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
},{"../vendor/observe-js/src/observe":53,"./Chain":1,"./modelEvents":22,"./util":25,"argsarray":27,"events":29}],17:[function(require,module,exports){
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
    log = require('./log');
  util._patchBind();

  // Initialise siesta object. Strange format facilities using submodules with requireJS (eventually)
  var siesta = function(ext) {
    if (!siesta.ext) siesta.ext = {};
    util.extend(siesta.ext, ext || {});
    return siesta;
  };

  // Notifications
  util.extend(siesta, {
    on: events.on.bind(events),
    off: events.removeListener.bind(events),
    once: events.once.bind(events),
    removeAllListeners: events.removeAllListeners.bind(events)
  });
  util.extend(siesta, {
    removeListener: siesta.off,
    addListener: siesta.on
  });

  // Expose some stuff for usage by extensions and/or users
  util.extend(siesta, {
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
      querySet: querySet,
      observe: require('../vendor/observe-js/src/observe'),
      Query: Query,
      ManyToManyProxy: ManyToManyProxy,
      OneToManyProxy: OneToManyProxy,
      OneToOneProxy: OneToOneProxy,
      RelationshipProxy: RelationshipProxy
    },
    async: util.async,
    isArray: util.isArray,
    isString: util.isString
  });

  siesta.ext = {};

  var installed = false,
    installing = false;


  util.extend(siesta, {
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
      var c = new Collection(name, opts);
      if (installed) c.installed = true; // TODO: Remove
      return c;
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
            tasks = collectionNames.map(function(n) {
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
              return util.extend(memo, res);
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
},{"../storage":52,"../vendor/observe-js/src/observe":53,"./ManyToManyProxy":2,"./ModelInstance":3,"./OneToManyProxy":4,"./OneToOneProxy":5,"./Query":7,"./QuerySet":8,"./ReactiveQuery":9,"./RelationshipProxy":10,"./RelationshipType":11,"./cache":12,"./collection":13,"./collectionRegistry":14,"./error":15,"./events":16,"./log":19,"./mappingOperation":20,"./model":21,"./modelEvents":22,"./util":25,"debug":30,"extend":33}],18:[function(require,module,exports){
(function() {
  var log = require('./log')('model'),
    InternalSiestaError = require('./error').InternalSiestaError,
    RelationshipType = require('./RelationshipType'),
    Query = require('./Query'),
    ModelInstance = require('./ModelInstance'),
    util = require('./util'),
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
      util.extend(modelInstance, {
        __values: util.extend(Model.attributes.reduce(function(m, a) {
          if (a.default !== undefined) m[a.name] = a.default;
          return m;
        }, {}), data || {})
      });
      if (idx > -1) attributeNames.splice(idx, 1);
      attributeNames.forEach(function(attributeName) {
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
            var propertyDependencies = this._propertyDependencies[attributeName] || [];
            propertyDependencies = propertyDependencies.map(function(dependant) {
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
      Object.keys(Model.methods).forEach(function(methodName) {
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
      _propertyNames.forEach(function(propName) {
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
    /**
     * @param definition - Definition of a relationship
     * @param modelInstance - Instance of which to install the relationship.
     */
    _installRelationship: function(definition, modelInstance) {
      console.log('installing def', definition, modelInstance);
      var proxy;
      var type = definition.type;
      if (type == RelationshipType.OneToMany) {
        proxy = new OneToManyProxy(definition);
      }
      else if (type == RelationshipType.OneToOne) {
        proxy = new OneToOneProxy(definition);
      }
      else if (type == RelationshipType.ManyToMany) {
        proxy = new ManyToManyProxy(definition);
      }
      else {
        throw new InternalSiestaError('No such relationship type: ' + type);
      }
      proxy.install(modelInstance);
    },
    _installRelationshipProxies: function(modelInstance) {
      var model = this.model;
      for (var name in model.relationships) {
        if (model.relationships.hasOwnProperty(name)) {
          var definition = util.extend({}, model.relationships[name]);
          this._installRelationship(definition, modelInstance);
        }
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
      this._installRelationshipProxies(modelInstance);
      this._registerInstance(modelInstance, shouldRegisterChange);
      return modelInstance;
    }
  };

  module.exports = ModelInstanceFactory;
})();
},{"./ManyToManyProxy":2,"./ModelInstance":3,"./OneToManyProxy":4,"./OneToOneProxy":5,"./Query":7,"./ReactiveQuery":9,"./RelationshipType":11,"./cache":12,"./error":15,"./events":16,"./log":19,"./modelEvents":22,"./util":25,"extend":33}],19:[function(require,module,exports){
(function() {
  /**
   * Dead simple logging service based on visionmedia/debug
   * @module log
   */

  var debug = require('debug'),
    argsarray = require('argsarray');

  module.exports = function(name) {
    var log = debug('siesta:' + name);
    var fn = argsarray(function(args) {
      log.call(log, args);
    });
    Object.defineProperty(fn, 'enabled', {
      get: function() {
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
   * @param opts.data
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

    util.extend(this, {
      errors: [],
      subTaskResults: {},
      _newObjects: []
    });


    this.model._installReversePlaceholders();
    this.data = this.preprocessData();
  }

  util.extend(MappingOperation.prototype, {
    mapAttributes: function() {
      for (var i = 0; i < this.data.length; i++) {
        var datum = this.data[i],
          object = this.objects[i];
        // No point mapping object onto itself. This happens if a ModelInstance is passed as a relationship.
        if (datum != object) {
          if (object) { // If object is falsy, then there was an error looking up that object/creating it.
            var fields = this.model._attributeNames;
            fields.forEach(function(f) {
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
      var relationshipFields = Object.keys(self.subTaskResults);
      relationshipFields.forEach(function(f) {
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
     * Figure out which data items require a cache lookup.
     * @returns {{remoteLookups: Array, localLookups: Array}}
     * @private
     */
    _sortLookups: function() {
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
              lookup.datum[this.model.id] = datum;
              remoteLookups.push(lookup);
            } else if (datum instanceof ModelInstance) { // We won't need to perform any mapping.
              this.objects[i] = datum;
            } else if (datum.localId) {
              localLookups.push({
                index: i,
                datum: datum
              });
            } else if (datum[this.model.id]) {
              remoteLookups.push({
                index: i,
                datum: datum
              });
            } else {
              this.objects[i] = this._instance();
            }
          } else {
            this.objects[i] = null;
          }
        }
      }
      return {remoteLookups: remoteLookups, localLookups: localLookups};
    },
    _performLocalLookups: function(localLookups) {
      var localIdentifiers = util.pluck(util.pluck(localLookups, 'datum'), 'localId'),
        localObjects = cache.getViaLocalId(localIdentifiers);
      for (var i = 0; i < localIdentifiers.length; i++) {
        var obj = localObjects[i];
        var localId = localIdentifiers[i];
        var lookup = localLookups[i];
        if (!obj) {
          // If there are multiple mapping operations going on, there may be
          obj = cache.get({localId: localId});
          if (!obj) obj = this._instance({localId: localId}, !this.disableevents);
          this.objects[lookup.index] = obj;
        } else {
          this.objects[lookup.index] = obj;
        }
      }

    },
    _performRemoteLookups: function(remoteLookups) {
      var remoteIdentifiers = util.pluck(util.pluck(remoteLookups, 'datum'), this.model.id),
        remoteObjects = cache.getViaRemoteId(remoteIdentifiers, {model: this.model});
      for (var i = 0; i < remoteObjects.length; i++) {
        var obj = remoteObjects[i],
          lookup = remoteLookups[i];
        if (obj) {
          this.objects[lookup.index] = obj;
        } else {
          var data = {};
          var remoteId = remoteIdentifiers[i];
          data[this.model.id] = remoteId;
          var cacheQuery = {
            model: this.model
          };
          cacheQuery[this.model.id] = remoteId;
          var cached = cache.get(cacheQuery);
          if (cached) {
            this.objects[lookup.index] = cached;
          } else {
            this.objects[lookup.index] = this._instance();
            // It's important that we map the remote identifier here to ensure that it ends
            // up in the cache.
            this.objects[lookup.index][this.model.id] = remoteId;
          }
        }
      }
    },
    /**
     * For indices where no object is present, perform cache lookups, creating a new object if necessary.
     * @private
     */
    _lookup: function() {
      if (this.model.singleton) {
        this._lookupSingleton();
      }
      else {
        var lookups = this._sortLookups(),
          remoteLookups = lookups.remoteLookups,
          localLookups = lookups.localLookups;
        this._performLocalLookups(localLookups);
        this._performRemoteLookups(remoteLookups);
      }
    },
    _lookupSingleton: function() {
      // Pick a random localId from the array of data being mapped onto the singleton object. Note that they should
      // always be the same. This is just a precaution.
      var localIdentifiers = util.pluck(this.data, 'localId'), localId;
      for (i = 0; i < localIdentifiers.length; i++) {
        if (localIdentifiers[i]) {
          localId = {localId: localIdentifiers[i]};
          break;
        }
      }
      // The mapping operation is responsible for creating singleton instances if they do not already exist.
      var singleton = cache.getSingleton(this.model) || this._instance(localId);
      for (var i = 0; i < this.data.length; i++) {
        this.objects[i] = singleton;
      }
    },
    _instance: function() {
      var model = this.model,
        modelInstance = model._instance.apply(model, arguments);
      this._newObjects.push(modelInstance);
      return modelInstance;
    },

    preprocessData: function() {
      var data = util.extend([], this.data);
      return data.map(function(datum) {
        if (datum) {
          if (!util.isString(datum)) {
            var keys = Object.keys(datum);
            keys.forEach(function(k) {
              var isRelationship = this.model._relationshipNames.indexOf(k) > -1;

              if (isRelationship) {
                var val = datum[k];
                if (val instanceof ModelInstance) {
                  datum[k] = {localId: val.localId};
                }

              }
            }.bind(this));
          }
        }
        return datum;
      }.bind(this));
    },
    start: function(done) {
      var data = this.data;
      if (data.length) {
        var self = this;
        var tasks = [];
        this._lookup();
        tasks.push(this._executeSubOperations.bind(this));
        util.async.parallel(tasks, function(err) {
          if (err) console.error(err);
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
            var initTasks = self._newObjects.reduce(function(memo, o) {
              var init = o.model.init;
              if (init) {
                var paramNames = util.paramNames(init);
                if (paramNames.length > 1) {
                  memo.push(init.bind(o, fromStorage, done));
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
          if (util.isArray(err)) isError = err.reduce(function(memo, x) {
            return memo || x
          }, false);
          if (isError) {
            if (!this.errors[idx]) this.errors[idx] = {};
            this.errors[idx][relationshipName] = err;
          }
        }
      }
    },
    _executeSubOperations: function(callback) {
      var self = this,
        relationshipNames = Object.keys(this.model.relationships);
      if (relationshipNames.length) {
        var tasks = relationshipNames.reduce(function(m, relationshipName) {
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


})();
},{"./ModelInstance":3,"./cache":12,"./log":19,"./util":25}],21:[function(require,module,exports){
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
    InstanceFactory = require('./instanceFactory');

  /**
   *
   * @param {Object} opts
   */
  function Model(opts) {
    var self = this;
    this._opts = opts ? util.extend({}, opts) : {};

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

    this._factory = new InstanceFactory(this);
    this._instance = this._factory._instance.bind(this._factory);

    util.extend(this, {
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
          self.attributes.forEach(function(x) {
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
          return self.children.reduce(function(memo, descendant) {
            return Array.prototype.concat.call(memo, descendant.descendants);
          }.bind(self), util.extend([], self.children));
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

  util.extend(Model, {
    /**
     * Normalise attributes passed via the options dictionary.
     * @param attributes
     * @returns {Array}
     * @private
     */
    _processAttributes: function(attributes) {
      return attributes.reduce(function(m, a) {
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

  util.extend(Model.prototype, {
    installStatics: function(statics) {
      if (statics) {
        Object.keys(statics).forEach(function(staticName) {
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
      console.log('validateRelationship', relationship);
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
    _getReverseModel: function(reverseName) {
      var reverseModel;
      if (reverseName instanceof Model) reverseModel = reverseName;
      else reverseModel = this.collection[reverseName];
      if (!reverseModel) { // May have used Collection.Model format.
        var arr = reverseName.split('.');
        if (arr.length == 2) {
          var collectionName = arr[0];
          reverseName = arr[1];
          var otherCollection = CollectionRegistry[collectionName];
          if (otherCollection)
            reverseModel = otherCollection[reverseName];
        }
      }
      return reverseModel;
    },
    /**
     * Return the reverse model or a placeholder that will be resolved later.
     * @param forwardName
     * @param reverseName
     * @returns {*}
     * @private
     */
    _getReverseModelOrPlaceholder: function(forwardName, reverseName) {
      var reverseModel = this._getReverseModel(reverseName);
      return reverseModel || new Placeholder({name: reverseName, ref: this, forwardName: forwardName});
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
                  var reverseModel = this._getReverseModelOrPlaceholder(name, reverseModelName);
                  util.extend(relationship, {
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
      } else {
        throw new InternalSiestaError('Relationships for "' + this.name + '" have already been installed');
      }
      if (!err) this._relationshipsInstalled = true;
      return err;
    },
    _installReverse: function(relationship) {
      var reverseModel = relationship.reverseModel;
      var isPlaceholder = reverseModel.isPlaceholder;
      if (isPlaceholder) {
        var modelName = relationship.reverseModel.name;
        reverseModel = this._getReverseModel(modelName);
        console.log('asdasd', modelName, reverseModel);
        if (reverseModel) {
          relationship.reverseModel = reverseModel;
        }
      }
      if (reverseModel) {
        var err;
        var reverseName = relationship.reverseName,
          forwardModel = relationship.forwardModel;

        if (reverseModel != this || reverseModel == forwardModel) {
          if (reverseModel.singleton) {
            if (relationship.type == RelationshipType.ManyToMany) err = 'Singleton model cannot be related via reverse ManyToMany';
            if (relationship.type == RelationshipType.OneToMany) err = 'Singleton model cannot be related via reverse OneToMany';
          }
          if (!err) {
            log(this.name + ': configuring  reverse relationship ' + reverseName);
            if (reverseModel.relationships[reverseName]) {
              // We are ok to redefine reverse relationships whereby the models are in the same hierarchy
              var isAncestorModel = reverseModel.relationships[reverseName].forwardModel.isAncestorOf(this);
              var isDescendentModel = reverseModel.relationships[reverseName].forwardModel.isDescendantOf(this);
              if (!isAncestorModel && !isDescendentModel) {
                err = 'Reverse relationship "' + reverseName + '" already exists on model "' + reverseModel.name + '"';
              }
            }
            if (!err) {
              reverseModel.relationships[reverseName] = relationship;
            }
          }
        }
        if (isPlaceholder) {
          var existingReverseInstances = (cache._localCacheByType[reverseModel.collectionName] || {})[reverseModel.name] || {};
          Object.keys(existingReverseInstances).forEach(function(localId) {
            var instancce = existingReverseInstances[localId];
            var r = util.extend({}, relationship);
            r.isReverse = true;
            this._factory._installRelationship(r, instancce);
          }.bind(this));
        }
      }
      return err;
    },
    /**
     * Cycle through relationships and replace any placeholders with the actual models where possible.
     */
    _installReversePlaceholders: function() {
      for (var forwardName in this.relationships) {
        if (this.relationships.hasOwnProperty(forwardName)) {
          var relationship = this.relationships[forwardName];
          if (relationship.reverseModel.isPlaceholder) this._installReverse(relationship);
        }
      }
    },
    installReverseRelationships: function() {
      if (!this._reverseRelationshipsInstalled) {
        for (var forwardName in this.relationships) {
          if (this.relationships.hasOwnProperty(forwardName)) {
            var relationship = this.relationships[forwardName];
            relationship = extend(true, {}, relationship);
            relationship.isReverse = true;
            var err = this._installReverse(relationship);
          }
        }
        this._reverseRelationshipsInstalled = true;
      }
      else {
        throw new InternalSiestaError('Reverse relationships for "' + this.name + '" have already been installed.');
      }
      return err;
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
              query = util.extend({}, query);
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
      util.extend(opts, {model: this, data: data});
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
      return Object.keys(modelCache).reduce(function(m, localId) {
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
      dumped.relationships = this.relationships.map(function(r) {
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
  util.extend(Model.prototype, {
    child: function(nameOrOpts, opts) {
      if (typeof nameOrOpts == 'string') {
        opts.name = nameOrOpts;
      } else {
        opts = name;
      }
      util.extend(opts, {
        attributes: Array.prototype.concat.call(opts.attributes || [], this._opts.attributes),
        relationships: util.extend(opts.relationships || {}, this._opts.relationships),
        methods: util.extend(util.extend({}, this._opts.methods) || {}, opts.methods),
        statics: util.extend(util.extend({}, this._opts.statics) || {}, opts.statics),
        properties: util.extend(util.extend({}, this._opts.properties) || {}, opts.properties),
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

},{"./ManyToManyProxy":2,"./ModelInstance":3,"./OneToOneProxy":5,"./Placeholder":6,"./Query":7,"./ReactiveQuery":9,"./RelationshipType":11,"./cache":12,"./collectionRegistry":14,"./error":15,"./events":16,"./instanceFactory":18,"./log":19,"./mappingOperation":20,"./modelEvents":22,"./util":25,"argsarray":27,"extend":33}],22:[function(require,module,exports){
(function() {
  var events = require('./events'),
    InternalSiestaError = require('./error').InternalSiestaError,
    log = require('./log')('events'),
    extend = require('./util').extend,
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
    if (this.added) dumped.added = this.added.map(function(x) {return x._dump()});
    if (this.removed) dumped.removed = this.removed.map(function(x) {return x._dump()});
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
},{"./collectionRegistry":14,"./error":15,"./events":16,"./log":19,"./util":25}],23:[function(require,module,exports){
(function() {
  var misc = require('./misc');

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
      eachSeries(Object.keys(tasks), function(k, callback) {
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
},{"./misc":26}],24:[function(require,module,exports){
function splat(arr) {
  arr = arr || [];
  return arr.filter(function(x) {return x});
}

function parallel(tasks, cb) {
  var results = [], errors = [], numFinished = 0;
  tasks.forEach(function(fn, idx) {
    results[idx] = false;
    fn(function(err, res) {
      numFinished++;
      if (err) errors[idx] = err;
      results[idx] = res;
      if (numFinished == tasks.length) {
        cb(
          errors.length ? splat(errors) : null,
          splat(results),
          {results: results, errors: errors}
        );
      }
    });
  });
}

module.exports = {
  parallel: parallel
};
},{}],25:[function(require,module,exports){
/*
 * This is a collection of utilities taken from libraries such as async.js, underscore.js etc.
 * @module util
 */

(function() {
  var async = require('./async'),
    async2 = require('./async2'),
    misc = require('./misc');

  misc.extend(module.exports, {
    async: async,
    async2: async2
  });
  misc.extend(module.exports, misc);

})();
},{"./async":23,"./async2":24,"./misc":26}],26:[function(require,module,exports){
(function() {
  var observe = require('../../vendor/observe-js/src/observe').Platform,
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

  var extend = function(left, right) {
    for (var prop in right) {
      if (right.hasOwnProperty(prop)) {
        left[prop] = right[prop];
      }
    }
    return left;
  };

  var isArrayShim = function(obj) {
      if (obj)return obj.toString() === '[object Array]';
      return false;
    },
    isArray = Array.isArray || isArrayShim,
    isString = function(o) {
      return typeof o == 'string' || o instanceof String
    };
  extend(module.exports, {
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
    extend: extend,
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
    pluck: function(coll, key) {
      return coll.map(function(o) {return o[key]});
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
            extend(opts, property);
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
      Object.keys(defaults).forEach(function(k) {
        var d = defaults[k];
        if (typeof d == 'function') {
          defaults[k] = d(opts[k]);
          delete opts[k];
        }
      });
      extend(defaults, opts);
      extend(obj, defaults);
    },
    isString: isString,
    isArray: isArray,
    prettyPrint: function(o) {
      return JSON.stringify(o, null, 4);
    },
    flattenArray: function(arr) {
      return arr.reduce(function(memo, e) {
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
},{"../../vendor/observe-js/src/observe":53,"./../error":15,"argsarray":27,"lie":37}],27:[function(require,module,exports){
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

    function ensureIndexInstalled(model, cb) {
      if (!model._indexInstalled) {
        var designDoc = constructIndexDesignDoc(model.collectionName, model.name);
        pouch
          .put(designDoc)
          .then(function(resp) {
            var err;
            if (!resp.ok) {
              var isConflict = response.status == 409;
              if (!isConflict) err = resp;
              model.indexInstalled = true;
            }
            cb(err);
          })
          .catch(cb);
      }
      else {
        cb();
      }
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
      pouch
        .bulkDocs(indexes)
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
      serialised = util.extend(serialised, __values);
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
      serialised = modelInstance._relationshipNames.reduce(function(memo, n) {
        var val = modelInstance[n];
        if (siesta.isArray(val)) {
          memo[n] = util.pluck(val, 'localId');
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
      relationshipNames.forEach(function(r) {
        var localId = datum[r];
        if (localId) {
          if (siesta.isArray(localId)) {
            datum[r] = localId.map(function(x) {
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
     * @param [opts.collectionName]
     * @param [opts.modelName]
     * @param [opts.model]
     * @param callback
     * @private
     */
    function _loadModel(opts, callback) {
      var loaded = {};
      var collectionName = opts.collectionName,
        modelName = opts.modelName,
        model = opts.model;
      if (model) {
        collectionName = model.collectionName;
        modelName = model.name;
      }
      var fullyQualifiedName = fullyQualifiedModelName(collectionName, modelName);
      log('Loading instances for ' + fullyQualifiedName);
      var Model = CollectionRegistry[collectionName][modelName];
      log('Querying pouch');
      pouch.query(fullyQualifiedName)
        //pouch.query({map: mapFunc})
        .then(function(resp) {
          log('Queried pouch successfully');
          var rows = resp.rows;
          var data = util.pluck(rows, 'value').map(function(datum) {
            return _prepareDatum(datum, Model);
          });

          data.map(function(datum) {
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
          collectionNames.forEach(function(collectionName) {
            var collection = CollectionRegistry[collectionName],
              modelNames = Object.keys(collection._models);
            modelNames.forEach(function(modelName) {
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
              results.forEach(function(r) {
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
      pouch.allDocs({keys: util.pluck(objects, 'localId')})
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
      var serialisedDocs = objects.map(_serialise);
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

    util.extend(storage, {
      _load: _load,
      _loadModel: _loadModel,
      save: save,
      _serialise: _serialise,
      ensureIndexesForAll: ensureIndexesForAll,
      ensureIndexInstalled: ensureIndexInstalled,
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

    util.extend(siesta, {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL0NoYWluLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9NYW55VG9NYW55UHJveHkuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL01vZGVsSW5zdGFuY2UuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL09uZVRvTWFueVByb3h5LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9PbmVUb09uZVByb3h5LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9QbGFjZWhvbGRlci5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvUXVlcnkuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL1F1ZXJ5U2V0LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9SZWFjdGl2ZVF1ZXJ5LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9SZWxhdGlvbnNoaXBQcm94eS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvUmVsYXRpb25zaGlwVHlwZS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvY2FjaGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL2NvbGxlY3Rpb24uanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL2NvbGxlY3Rpb25SZWdpc3RyeS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvZXJyb3IuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL2V2ZW50cy5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvaW5kZXguanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL2luc3RhbmNlRmFjdG9yeS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvbG9nLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9tYXBwaW5nT3BlcmF0aW9uLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9tb2RlbC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvbW9kZWxFdmVudHMuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL3V0aWwvYXN5bmMuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL3V0aWwvYXN5bmMyLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS91dGlsL2luZGV4LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS91dGlsL21pc2MuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvYXJnc2FycmF5L2luZGV4LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcmVzb2x2ZS9lbXB0eS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2RlYnVnL2Jyb3dzZXIuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvZGVidWcvZGVidWcuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvZGVidWcvbm9kZV9tb2R1bGVzL21zL2luZGV4LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2V4dGVuZC9pbmRleC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9saWUvbGliL0lOVEVSTkFMLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2xpZS9saWIvYWxsLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2xpZS9saWIvaGFuZGxlcnMuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvbGllL2xpYi9pbmRleC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9saWUvbGliL3Byb21pc2UuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvbGllL2xpYi9xdWV1ZUl0ZW0uanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvbGllL2xpYi9yYWNlLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2xpZS9saWIvcmVqZWN0LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2xpZS9saWIvcmVzb2x2ZS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9saWUvbGliL3Jlc29sdmVUaGVuYWJsZS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9saWUvbGliL3N0YXRlcy5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9saWUvbGliL3RyeUNhdGNoLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2xpZS9saWIvdW53cmFwLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2xpZS9ub2RlX21vZHVsZXMvaW1tZWRpYXRlL2xpYi9pbmRleC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9saWUvbm9kZV9tb2R1bGVzL2ltbWVkaWF0ZS9saWIvbWVzc2FnZUNoYW5uZWwuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvbGllL25vZGVfbW9kdWxlcy9pbW1lZGlhdGUvbGliL211dGF0aW9uLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2xpZS9ub2RlX21vZHVsZXMvaW1tZWRpYXRlL2xpYi9zdGF0ZUNoYW5nZS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9saWUvbm9kZV9tb2R1bGVzL2ltbWVkaWF0ZS9saWIvdGltZW91dC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L3N0b3JhZ2UvaW5kZXguanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3UUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2U0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25SQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeFZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDalNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbk9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDalpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVrQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5U0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEJBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN1NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxZ0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIoZnVuY3Rpb24oKSB7XG5cbiAgdmFyIGFyZ3NhcnJheSA9IHJlcXVpcmUoJ2FyZ3NhcnJheScpO1xuXG4gIC8qKlxuICAgKiBDbGFzcyBmb3IgZmFjaWxpdGF0aW5nIFwiY2hhaW5lZFwiIGJlaGF2aW91ciBlLmc6XG4gICAqXG4gICAqIHZhciBjYW5jZWwgPSBVc2Vyc1xuICAgKiAgLm9uKCduZXcnLCBmdW5jdGlvbiAodXNlcikge1xuICAgKiAgICAgLy8gLi4uXG4gICAqICAgfSlcbiAgICogIC5xdWVyeSh7JG9yOiB7YWdlX19ndGU6IDIwLCBhZ2VfX2x0ZTogMzB9fSlcbiAgICogIC5vbignKicsIGZ1bmN0aW9uIChjaGFuZ2UpIHtcbiAgICogICAgIC8vIC4uXG4gICAqICAgfSk7XG4gICAqXG4gICAqIEBwYXJhbSBvcHRzXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKi9cbiAgZnVuY3Rpb24gQ2hhaW4ob3B0cykge1xuICAgIHRoaXMub3B0cyA9IG9wdHM7XG4gIH1cblxuICBDaGFpbi5wcm90b3R5cGUgPSB7XG4gICAgLyoqXG4gICAgICogQ29uc3RydWN0IGEgbGluayBpbiB0aGUgY2hhaW4gb2YgY2FsbHMuXG4gICAgICogQHBhcmFtIG9wdHNcbiAgICAgKiBAcGFyYW0gb3B0cy5mblxuICAgICAqIEBwYXJhbSBvcHRzLnR5cGVcbiAgICAgKi9cbiAgICBfaGFuZGxlckxpbms6IGZ1bmN0aW9uKG9wdHMpIHtcbiAgICAgIHZhciBmaXJzdExpbms7XG4gICAgICBmaXJzdExpbmsgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHR5cCA9IG9wdHMudHlwZTtcbiAgICAgICAgaWYgKG9wdHMuZm4pXG4gICAgICAgICAgdGhpcy5fcmVtb3ZlTGlzdGVuZXIob3B0cy5mbiwgdHlwKTtcbiAgICAgICAgaWYgKGZpcnN0TGluay5fcGFyZW50TGluaykgZmlyc3RMaW5rLl9wYXJlbnRMaW5rKCk7IC8vIENhbmNlbCBsaXN0ZW5lcnMgYWxsIHRoZSB3YXkgdXAgdGhlIGNoYWluLlxuICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgT2JqZWN0LmtleXModGhpcy5vcHRzKS5mb3JFYWNoKGZ1bmN0aW9uKHByb3ApIHtcbiAgICAgICAgdmFyIGZ1bmMgPSB0aGlzLm9wdHNbcHJvcF07XG4gICAgICAgIGZpcnN0TGlua1twcm9wXSA9IGFyZ3NhcnJheShmdW5jdGlvbihhcmdzKSB7XG4gICAgICAgICAgdmFyIGxpbmsgPSBmdW5jLmFwcGx5KGZ1bmMuX19zaWVzdGFfYm91bmRfb2JqZWN0LCBhcmdzKTtcbiAgICAgICAgICBsaW5rLl9wYXJlbnRMaW5rID0gZmlyc3RMaW5rO1xuICAgICAgICAgIHJldHVybiBsaW5rO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgIGZpcnN0TGluay5fcGFyZW50TGluayA9IG51bGw7XG4gICAgICByZXR1cm4gZmlyc3RMaW5rO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogQ29uc3RydWN0IGEgbGluayBpbiB0aGUgY2hhaW4gb2YgY2FsbHMuXG4gICAgICogQHBhcmFtIG9wdHNcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2xlYW5dXG4gICAgICovXG4gICAgX2xpbms6IGZ1bmN0aW9uKG9wdHMsIGNsZWFuKSB7XG4gICAgICB2YXIgY2hhaW4gPSB0aGlzO1xuICAgICAgY2xlYW4gPSBjbGVhbiB8fCBmdW5jdGlvbigpIHt9O1xuICAgICAgdmFyIGxpbms7XG4gICAgICBsaW5rID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGNsZWFuKCk7XG4gICAgICAgIGlmIChsaW5rLl9wYXJlbnRMaW5rKSBsaW5rLl9wYXJlbnRMaW5rKCk7IC8vIENhbmNlbCBsaXN0ZW5lcnMgYWxsIHRoZSB3YXkgdXAgdGhlIGNoYWluLlxuICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgbGluay5fX3NpZXN0YV9pc0xpbmsgPSB0cnVlO1xuICAgICAgbGluay5vcHRzID0gb3B0cztcbiAgICAgIGxpbmsuY2xlYW4gPSBjbGVhbjtcbiAgICAgIE9iamVjdC5rZXlzKG9wdHMpLmZvckVhY2goZnVuY3Rpb24ocHJvcCkge1xuICAgICAgICB2YXIgZnVuYyA9IG9wdHNbcHJvcF07XG4gICAgICAgIGxpbmtbcHJvcF0gPSBhcmdzYXJyYXkoZnVuY3Rpb24oYXJncykge1xuICAgICAgICAgIHZhciBwb3NzaWJsZUxpbmsgPSBmdW5jLmFwcGx5KGZ1bmMuX19zaWVzdGFfYm91bmRfb2JqZWN0LCBhcmdzKTtcbiAgICAgICAgICBpZiAoIXBvc3NpYmxlTGluayB8fCAhcG9zc2libGVMaW5rLl9fc2llc3RhX2lzTGluaykgeyAvLyBQYXRjaCBpbiBhIGxpbmsgaW4gdGhlIGNoYWluIHRvIGF2b2lkIGl0IGJlaW5nIGJyb2tlbiwgYmFzaW5nIG9mZiB0aGUgY3VycmVudCBsaW5rXG4gICAgICAgICAgICBuZXh0TGluayA9IGNoYWluLl9saW5rKGxpbmsub3B0cyk7XG4gICAgICAgICAgICBmb3IgKHZhciBwcm9wIGluIHBvc3NpYmxlTGluaykge1xuICAgICAgICAgICAgICAvL25vaW5zcGVjdGlvbiBKU1VuZmlsdGVyZWRGb3JJbkxvb3BcbiAgICAgICAgICAgICAgaWYgKHBvc3NpYmxlTGlua1twcm9wXSBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgICAgICAgICAgICAgLy9ub2luc3BlY3Rpb24gSlNVbmZpbHRlcmVkRm9ySW5Mb29wXG4gICAgICAgICAgICAgICAgbmV4dExpbmtbcHJvcF0gPSBwb3NzaWJsZUxpbmtbcHJvcF07XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB2YXIgbmV4dExpbmsgPSBwb3NzaWJsZUxpbms7XG4gICAgICAgICAgfVxuICAgICAgICAgIG5leHRMaW5rLl9wYXJlbnRMaW5rID0gbGluaztcbiAgICAgICAgICAvLyBJbmhlcml0IG1ldGhvZHMgZnJvbSB0aGUgcGFyZW50IGxpbmsgaWYgdGhvc2UgbWV0aG9kcyBkb24ndCBhbHJlYWR5IGV4aXN0LlxuICAgICAgICAgIGZvciAocHJvcCBpbiBsaW5rKSB7XG4gICAgICAgICAgICBpZiAobGlua1twcm9wXSBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgICAgICAgICAgIG5leHRMaW5rW3Byb3BdID0gbGlua1twcm9wXS5iaW5kKGxpbmspO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gbmV4dExpbms7XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgbGluay5fcGFyZW50TGluayA9IG51bGw7XG4gICAgICByZXR1cm4gbGluaztcbiAgICB9XG4gIH07XG4gIG1vZHVsZS5leHBvcnRzID0gQ2hhaW47XG59KSgpOyIsIihmdW5jdGlvbigpIHtcbiAgLyoqXG4gICAqIEBtb2R1bGUgcmVsYXRpb25zaGlwc1xuICAgKi9cblxuICB2YXIgUmVsYXRpb25zaGlwUHJveHkgPSByZXF1aXJlKCcuL1JlbGF0aW9uc2hpcFByb3h5JyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICAgIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gICAgd3JhcEFycmF5Rm9yQXR0cmlidXRlcyA9IGV2ZW50cy53cmFwQXJyYXksXG4gICAgQXJyYXlPYnNlcnZlciA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuQXJyYXlPYnNlcnZlcixcbiAgICBNb2RlbEV2ZW50VHlwZSA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKS5Nb2RlbEV2ZW50VHlwZTtcblxuICAvKipcbiAgICogW01hbnlUb01hbnlQcm94eSBkZXNjcmlwdGlvbl1cbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdHNcbiAgICovXG4gIGZ1bmN0aW9uIE1hbnlUb01hbnlQcm94eShvcHRzKSB7XG4gICAgUmVsYXRpb25zaGlwUHJveHkuY2FsbCh0aGlzLCBvcHRzKTtcbiAgICB0aGlzLnJlbGF0ZWQgPSBbXTtcbiAgICB0aGlzLnJlbGF0ZWRDYW5jZWxMaXN0ZW5lcnMgPSB7fTtcbiAgfVxuXG4gIE1hbnlUb01hbnlQcm94eS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZSk7XG5cbiAgdXRpbC5leHRlbmQoTWFueVRvTWFueVByb3h5LnByb3RvdHlwZSwge1xuICAgIGNsZWFyUmV2ZXJzZTogZnVuY3Rpb24ocmVtb3ZlZCkge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgcmVtb3ZlZC5mb3JFYWNoKGZ1bmN0aW9uKHJlbW92ZWRPYmplY3QpIHtcbiAgICAgICAgdmFyIHJldmVyc2VQcm94eSA9IHNlbGYucmV2ZXJzZVByb3h5Rm9ySW5zdGFuY2UocmVtb3ZlZE9iamVjdCk7XG4gICAgICAgIHZhciBpZHggPSByZXZlcnNlUHJveHkucmVsYXRlZC5pbmRleE9mKHNlbGYub2JqZWN0KTtcbiAgICAgICAgcmV2ZXJzZVByb3h5Lm1ha2VDaGFuZ2VzVG9SZWxhdGVkV2l0aG91dE9ic2VydmF0aW9ucyhmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXZlcnNlUHJveHkuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSxcbiAgICBzZXRSZXZlcnNlT2ZBZGRlZDogZnVuY3Rpb24oYWRkZWQpIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgIGFkZGVkLmZvckVhY2goZnVuY3Rpb24oYWRkZWRPYmplY3QpIHtcbiAgICAgICAgdmFyIHJldmVyc2VQcm94eSA9IHNlbGYucmV2ZXJzZVByb3h5Rm9ySW5zdGFuY2UoYWRkZWRPYmplY3QpO1xuICAgICAgICByZXZlcnNlUHJveHkubWFrZUNoYW5nZXNUb1JlbGF0ZWRXaXRob3V0T2JzZXJ2YXRpb25zKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldmVyc2VQcm94eS5zcGxpY2UoMCwgMCwgc2VsZi5vYmplY3QpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0sXG4gICAgd3JhcEFycmF5OiBmdW5jdGlvbihhcnIpIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgIHdyYXBBcnJheUZvckF0dHJpYnV0ZXMoYXJyLCB0aGlzLnJldmVyc2VOYW1lLCB0aGlzLm9iamVjdCk7XG4gICAgICBpZiAoIWFyci5hcnJheU9ic2VydmVyKSB7XG4gICAgICAgIGFyci5hcnJheU9ic2VydmVyID0gbmV3IEFycmF5T2JzZXJ2ZXIoYXJyKTtcbiAgICAgICAgdmFyIG9ic2VydmVyRnVuY3Rpb24gPSBmdW5jdGlvbihzcGxpY2VzKSB7XG4gICAgICAgICAgc3BsaWNlcy5mb3JFYWNoKGZ1bmN0aW9uKHNwbGljZSkge1xuICAgICAgICAgICAgdmFyIGFkZGVkID0gc3BsaWNlLmFkZGVkQ291bnQgPyBhcnIuc2xpY2Uoc3BsaWNlLmluZGV4LCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCkgOiBbXTtcbiAgICAgICAgICAgIHZhciByZW1vdmVkID0gc3BsaWNlLnJlbW92ZWQ7XG4gICAgICAgICAgICBzZWxmLmNsZWFyUmV2ZXJzZShyZW1vdmVkKTtcbiAgICAgICAgICAgIHNlbGYuc2V0UmV2ZXJzZU9mQWRkZWQoYWRkZWQpO1xuICAgICAgICAgICAgdmFyIG1vZGVsID0gc2VsZi5nZXRGb3J3YXJkTW9kZWwoKTtcbiAgICAgICAgICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBtb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgbW9kZWw6IG1vZGVsLm5hbWUsXG4gICAgICAgICAgICAgIGxvY2FsSWQ6IHNlbGYub2JqZWN0LmxvY2FsSWQsXG4gICAgICAgICAgICAgIGZpZWxkOiBzZWxmLmdldEZvcndhcmROYW1lKCksXG4gICAgICAgICAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgICAgICAgICAgIGFkZGVkOiBhZGRlZCxcbiAgICAgICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgICBpbmRleDogc3BsaWNlLmluZGV4LFxuICAgICAgICAgICAgICBvYmo6IHNlbGYub2JqZWN0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICAgICAgYXJyLmFycmF5T2JzZXJ2ZXIub3BlbihvYnNlcnZlckZ1bmN0aW9uKTtcbiAgICAgIH1cbiAgICB9LFxuICAgIGdldDogZnVuY3Rpb24oY2IpIHtcbiAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICAgIGNiKG51bGwsIHRoaXMucmVsYXRlZCk7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH0sXG4gICAgdmFsaWRhdGU6IGZ1bmN0aW9uKG9iaikge1xuICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopICE9ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICAgICAgcmV0dXJuICdDYW5ub3QgYXNzaWduIHNjYWxhciB0byBtYW55IHRvIG1hbnknO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uKG9iaiwgb3B0cykge1xuICAgICAgdGhpcy5jaGVja0luc3RhbGxlZCgpO1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgaWYgKG9iaikge1xuICAgICAgICB2YXIgZXJyb3JNZXNzYWdlO1xuICAgICAgICBpZiAoZXJyb3JNZXNzYWdlID0gdGhpcy52YWxpZGF0ZShvYmopKSB7XG4gICAgICAgICAgcmV0dXJuIGVycm9yTWVzc2FnZTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICB0aGlzLmNsZWFyUmV2ZXJzZVJlbGF0ZWQob3B0cyk7XG4gICAgICAgICAgc2VsZi5zZXRJZEFuZFJlbGF0ZWQob2JqLCBvcHRzKTtcbiAgICAgICAgICB0aGlzLndyYXBBcnJheShvYmopO1xuICAgICAgICAgIHNlbGYuc2V0SWRBbmRSZWxhdGVkUmV2ZXJzZShvYmosIG9wdHMpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgdGhpcy5jbGVhclJldmVyc2VSZWxhdGVkKG9wdHMpO1xuICAgICAgICBzZWxmLnNldElkQW5kUmVsYXRlZChvYmosIG9wdHMpO1xuICAgICAgfVxuICAgIH0sXG4gICAgaW5zdGFsbDogZnVuY3Rpb24ob2JqKSB7XG4gICAgICBSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUuaW5zdGFsbC5jYWxsKHRoaXMsIG9iaik7XG4gICAgICB0aGlzLndyYXBBcnJheSh0aGlzLnJlbGF0ZWQpO1xuICAgICAgb2JqWygnc3BsaWNlJyArIHV0aWwuY2FwaXRhbGlzZUZpcnN0TGV0dGVyKHRoaXMucmV2ZXJzZU5hbWUpKV0gPSB0aGlzLnNwbGljZS5iaW5kKHRoaXMpO1xuICAgIH0sXG4gICAgcmVnaXN0ZXJSZW1vdmFsTGlzdGVuZXI6IGZ1bmN0aW9uKG9iaikge1xuICAgICAgdGhpcy5yZWxhdGVkQ2FuY2VsTGlzdGVuZXJzW29iai5sb2NhbElkXSA9IG9iai5vbignKicsIGZ1bmN0aW9uKGUpIHtcblxuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG4gIH0pO1xuXG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBNYW55VG9NYW55UHJveHk7XG59KSgpOyIsIihmdW5jdGlvbigpIHtcbiAgdmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLFxuICAgIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICAgIE1vZGVsRXZlbnRUeXBlID0gbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUsXG4gICAgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgICBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKTtcblxuICBmdW5jdGlvbiBNb2RlbEluc3RhbmNlKG1vZGVsKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHRoaXMubW9kZWwgPSBtb2RlbDtcblxuICAgIHV0aWwuc3ViUHJvcGVydGllcyh0aGlzLCB0aGlzLm1vZGVsLCBbXG4gICAgICAnY29sbGVjdGlvbicsXG4gICAgICAnY29sbGVjdGlvbk5hbWUnLFxuICAgICAgJ19hdHRyaWJ1dGVOYW1lcycsXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICdpZEZpZWxkJyxcbiAgICAgICAgcHJvcGVydHk6ICdpZCdcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICdtb2RlbE5hbWUnLFxuICAgICAgICBwcm9wZXJ0eTogJ25hbWUnXG4gICAgICB9XG4gICAgXSk7XG5cbiAgICBldmVudHMuUHJveHlFdmVudEVtaXR0ZXIuY2FsbCh0aGlzKTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHRoaXMsIHtcbiAgICAgIF9yZWxhdGlvbnNoaXBOYW1lczoge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBwcm94aWVzID0gT2JqZWN0LmtleXMoc2VsZi5fX3Byb3hpZXMgfHwge30pLm1hcChmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICByZXR1cm4gc2VsZi5fX3Byb3hpZXNbeF1cbiAgICAgICAgICB9KTtcbiAgICAgICAgICByZXR1cm4gcHJveGllcy5tYXAoZnVuY3Rpb24ocCkge1xuICAgICAgICAgICAgaWYgKHAuaXNGb3J3YXJkKSB7XG4gICAgICAgICAgICAgIHJldHVybiBwLmZvcndhcmROYW1lO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHAucmV2ZXJzZU5hbWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgfSxcbiAgICAgIGRpcnR5OiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgaWYgKHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBzZWxmLmxvY2FsSWQgaW4gc2llc3RhLmV4dC5zdG9yYWdlLl91bnNhdmVkT2JqZWN0c0hhc2g7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2UgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgICAgfSxcbiAgICAgIC8vIFRoaXMgaXMgZm9yIFByb3h5RXZlbnRFbWl0dGVyLlxuICAgICAgZXZlbnQ6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5sb2NhbElkXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMucmVtb3ZlZCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogV2hldGhlciBvciBub3QgZXZlbnRzIChzZXQsIHJlbW92ZSBldGMpIGFyZSBlbWl0dGVkIGZvciB0aGlzIG1vZGVsIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogVGhpcyBpcyB1c2VkIGFzIGEgd2F5IG9mIGNvbnRyb2xsaW5nIHdoYXQgZXZlbnRzIGFyZSBlbWl0dGVkIHdoZW4gdGhlIG1vZGVsIGluc3RhbmNlIGlzIGNyZWF0ZWQuIEUuZy4gd2UgZG9uJ3RcbiAgICAgKiB3YW50IHRvIHNlbmQgYSBtZXRyaWMgc2hpdCB0b24gb2YgJ3NldCcgZXZlbnRzIGlmIHdlJ3JlIG5ld2x5IGNyZWF0aW5nIGFuIGluc3RhbmNlLiBXZSBvbmx5IHdhbnQgdG8gc2VuZCB0aGVcbiAgICAgKiAnbmV3JyBldmVudCBvbmNlIGNvbnN0cnVjdGVkLlxuICAgICAqXG4gICAgICogVGhpcyBpcyBwcm9iYWJseSBhIGJpdCBvZiBhIGhhY2sgYW5kIHNob3VsZCBiZSByZW1vdmVkIGV2ZW50dWFsbHkuXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICB0aGlzLl9lbWl0RXZlbnRzID0gZmFsc2U7XG4gIH1cblxuICBNb2RlbEluc3RhbmNlLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoZXZlbnRzLlByb3h5RXZlbnRFbWl0dGVyLnByb3RvdHlwZSk7XG5cbiAgdXRpbC5leHRlbmQoTW9kZWxJbnN0YW5jZS5wcm90b3R5cGUsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKGNiKSB7XG4gICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgICBjYihudWxsLCB0aGlzKTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfSxcbiAgICBlbWl0OiBmdW5jdGlvbih0eXBlLCBvcHRzKSB7XG4gICAgICBpZiAodHlwZW9mIHR5cGUgPT0gJ29iamVjdCcpIG9wdHMgPSB0eXBlO1xuICAgICAgZWxzZSBvcHRzLnR5cGUgPSB0eXBlO1xuICAgICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgICB1dGlsLmV4dGVuZChvcHRzLCB7XG4gICAgICAgIGNvbGxlY3Rpb246IHRoaXMuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgIG1vZGVsOiB0aGlzLm1vZGVsLm5hbWUsXG4gICAgICAgIGxvY2FsSWQ6IHRoaXMubG9jYWxJZCxcbiAgICAgICAgb2JqOiB0aGlzXG4gICAgICB9KTtcbiAgICAgIG1vZGVsRXZlbnRzLmVtaXQob3B0cyk7XG4gICAgfSxcbiAgICByZW1vdmU6IGZ1bmN0aW9uKGNiLCBub3RpZmljYXRpb24pIHtcbiAgICAgIG5vdGlmaWNhdGlvbiA9IG5vdGlmaWNhdGlvbiA9PSBudWxsID8gdHJ1ZSA6IG5vdGlmaWNhdGlvbjtcbiAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICAgIGNhY2hlLnJlbW92ZSh0aGlzKTtcbiAgICAgICAgdGhpcy5yZW1vdmVkID0gdHJ1ZTtcbiAgICAgICAgaWYgKG5vdGlmaWNhdGlvbikge1xuICAgICAgICAgIHRoaXMuZW1pdChtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5SZW1vdmUsIHtcbiAgICAgICAgICAgIG9sZDogdGhpc1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHZhciByZW1vdmUgPSB0aGlzLm1vZGVsLnJlbW92ZTtcbiAgICAgICAgaWYgKHJlbW92ZSkge1xuICAgICAgICAgIHZhciBwYXJhbU5hbWVzID0gdXRpbC5wYXJhbU5hbWVzKHJlbW92ZSk7XG4gICAgICAgICAgaWYgKHBhcmFtTmFtZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICByZW1vdmUuY2FsbCh0aGlzLCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgY2IoZXJyLCBzZWxmKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJlbW92ZS5jYWxsKHRoaXMpO1xuICAgICAgICAgICAgY2IobnVsbCwgdGhpcyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGNiKG51bGwsIHRoaXMpO1xuICAgICAgICB9XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH0sXG4gICAgcmVzdG9yZTogZnVuY3Rpb24oY2IpIHtcbiAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICAgIHZhciBfZmluaXNoID0gZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgIHRoaXMuZW1pdChtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5OZXcsIHtcbiAgICAgICAgICAgICAgbmV3OiB0aGlzXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY2IoZXJyLCB0aGlzKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICBpZiAodGhpcy5yZW1vdmVkKSB7XG4gICAgICAgICAgY2FjaGUuaW5zZXJ0KHRoaXMpO1xuICAgICAgICAgIHRoaXMucmVtb3ZlZCA9IGZhbHNlO1xuICAgICAgICAgIHZhciBpbml0ID0gdGhpcy5tb2RlbC5pbml0O1xuICAgICAgICAgIGlmIChpbml0KSB7XG4gICAgICAgICAgICB2YXIgcGFyYW1OYW1lcyA9IHV0aWwucGFyYW1OYW1lcyhpbml0KTtcbiAgICAgICAgICAgIHZhciBmcm9tU3RvcmFnZSA9IHRydWU7XG4gICAgICAgICAgICBpZiAocGFyYW1OYW1lcy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgIGluaXQuY2FsbCh0aGlzLCBmcm9tU3RvcmFnZSwgX2ZpbmlzaCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgaW5pdC5jYWxsKHRoaXMsIGZyb21TdG9yYWdlKTtcbiAgICAgICAgICAgICAgX2ZpbmlzaCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIF9maW5pc2goKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfVxuICB9KTtcblxuICAvLyBJbnNwZWN0aW9uXG4gIHV0aWwuZXh0ZW5kKE1vZGVsSW5zdGFuY2UucHJvdG90eXBlLCB7XG4gICAgZ2V0QXR0cmlidXRlczogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdXRpbC5leHRlbmQoe30sIHRoaXMuX192YWx1ZXMpO1xuICAgIH0sXG4gICAgaXNJbnN0YW5jZU9mOiBmdW5jdGlvbihtb2RlbCkge1xuICAgICAgcmV0dXJuIHRoaXMubW9kZWwgPT0gbW9kZWw7XG4gICAgfSxcbiAgICBpc0E6IGZ1bmN0aW9uKG1vZGVsKSB7XG4gICAgICByZXR1cm4gdGhpcy5tb2RlbCA9PSBtb2RlbCB8fCB0aGlzLm1vZGVsLmlzRGVzY2VuZGFudE9mKG1vZGVsKTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIER1bXBcbiAgdXRpbC5leHRlbmQoTW9kZWxJbnN0YW5jZS5wcm90b3R5cGUsIHtcbiAgICBfZHVtcFN0cmluZzogZnVuY3Rpb24ocmV2ZXJzZVJlbGF0aW9uc2hpcHMpIHtcbiAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh0aGlzLl9kdW1wKHJldmVyc2VSZWxhdGlvbnNoaXBzLCBudWxsLCA0KSk7XG4gICAgfSxcbiAgICBfZHVtcDogZnVuY3Rpb24ocmV2ZXJzZVJlbGF0aW9uc2hpcHMpIHtcbiAgICAgIHZhciBkdW1wZWQgPSB1dGlsLmV4dGVuZCh7fSwgdGhpcy5fX3ZhbHVlcyk7XG4gICAgICBkdW1wZWQuX3JldiA9IHRoaXMuX3JldjtcbiAgICAgIGR1bXBlZC5sb2NhbElkID0gdGhpcy5sb2NhbElkO1xuICAgICAgcmV0dXJuIGR1bXBlZDtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIFNlcmlhbGlzYXRpb25cbiAgdXRpbC5leHRlbmQoTW9kZWxJbnN0YW5jZS5wcm90b3R5cGUsIHtcbiAgICBfZGVmYXVsdFNlcmlhbGlzZTogZnVuY3Rpb24ob3B0cykge1xuICAgICAgdmFyIHNlcmlhbGlzZWQgPSB7fTtcbiAgICAgIHZhciBpbmNsdWRlTnVsbEF0dHJpYnV0ZXMgPSBvcHRzLmluY2x1ZGVOdWxsQXR0cmlidXRlcyAhPT0gdW5kZWZpbmVkID8gb3B0cy5pbmNsdWRlTnVsbEF0dHJpYnV0ZXMgOiB0cnVlLFxuICAgICAgICBpbmNsdWRlTnVsbFJlbGF0aW9uc2hpcHMgPSBvcHRzLmluY2x1ZGVOdWxsUmVsYXRpb25zaGlwcyAhPT0gdW5kZWZpbmVkID8gb3B0cy5pbmNsdWRlTnVsbFJlbGF0aW9uc2hpcHMgOiB0cnVlO1xuICAgICAgdmFyIHNlcmlhbGlzYWJsZUZpZWxkcyA9IHRoaXMubW9kZWwuc2VyaWFsaXNhYmxlRmllbGRzIHx8XG4gICAgICAgIHRoaXMuX2F0dHJpYnV0ZU5hbWVzLmNvbmNhdC5hcHBseSh0aGlzLl9hdHRyaWJ1dGVOYW1lcywgdGhpcy5fcmVsYXRpb25zaGlwTmFtZXMpLmNvbmNhdCh0aGlzLmlkKTtcbiAgICAgIHRoaXMuX2F0dHJpYnV0ZU5hbWVzLmZvckVhY2goZnVuY3Rpb24oYXR0ck5hbWUpIHtcbiAgICAgICAgaWYgKHNlcmlhbGlzYWJsZUZpZWxkcy5pbmRleE9mKGF0dHJOYW1lKSA+IC0xKSB7XG4gICAgICAgICAgdmFyIGF0dHJEZWZpbml0aW9uID0gdGhpcy5tb2RlbC5fYXR0cmlidXRlRGVmaW5pdGlvbldpdGhOYW1lKGF0dHJOYW1lKSB8fCB7fTtcbiAgICAgICAgICB2YXIgc2VyaWFsaXNlcjtcbiAgICAgICAgICBpZiAoYXR0ckRlZmluaXRpb24uc2VyaWFsaXNlKSBzZXJpYWxpc2VyID0gYXR0ckRlZmluaXRpb24uc2VyaWFsaXNlLmJpbmQodGhpcyk7XG4gICAgICAgICAgZWxzZSBzZXJpYWxpc2VyID0gdGhpcy5tb2RlbC5zZXJpYWxpc2VGaWVsZC5iaW5kKHRoaXMsIGF0dHJOYW1lKTtcbiAgICAgICAgICB2YXIgdmFsID0gdGhpc1thdHRyTmFtZV07XG4gICAgICAgICAgaWYgKHZhbCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgaWYgKGluY2x1ZGVOdWxsQXR0cmlidXRlcykge1xuICAgICAgICAgICAgICBzZXJpYWxpc2VkW2F0dHJOYW1lXSA9IHNlcmlhbGlzZXIodmFsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSBpZiAodmFsICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHNlcmlhbGlzZWRbYXR0ck5hbWVdID0gc2VyaWFsaXNlcih2YWwpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgIHRoaXMuX3JlbGF0aW9uc2hpcE5hbWVzLmZvckVhY2goZnVuY3Rpb24ocmVsTmFtZSkge1xuICAgICAgICBpZiAoc2VyaWFsaXNhYmxlRmllbGRzLmluZGV4T2YocmVsTmFtZSkgPiAtMSkge1xuICAgICAgICAgIHZhciB2YWwgPSB0aGlzW3JlbE5hbWVdLFxuICAgICAgICAgICAgcmVsID0gdGhpcy5tb2RlbC5yZWxhdGlvbnNoaXBzW3JlbE5hbWVdO1xuICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkodmFsKSkge1xuICAgICAgICAgICAgdmFsID0gdXRpbC5wbHVjayh2YWwsIHRoaXMubW9kZWwuaWQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIGlmICh2YWwpIHtcbiAgICAgICAgICAgIHZhbCA9IHZhbFt0aGlzLm1vZGVsLmlkXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHJlbCAmJiAhcmVsLmlzUmV2ZXJzZSkge1xuICAgICAgICAgICAgdmFyIHNlcmlhbGlzZXI7XG4gICAgICAgICAgICBpZiAocmVsLnNlcmlhbGlzZSkgc2VyaWFsaXNlciA9IHJlbC5zZXJpYWxpc2UuYmluZCh0aGlzKTtcbiAgICAgICAgICAgIGVsc2Ugc2VyaWFsaXNlciA9IHRoaXMubW9kZWwuc2VyaWFsaXNlRmllbGQuYmluZCh0aGlzLCByZWxOYW1lKTtcbiAgICAgICAgICAgIGlmICh2YWwgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgaWYgKGluY2x1ZGVOdWxsUmVsYXRpb25zaGlwcykge1xuICAgICAgICAgICAgICAgIHNlcmlhbGlzZWRbcmVsTmFtZV0gPSBzZXJpYWxpc2VyKHZhbCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHV0aWwuaXNBcnJheSh2YWwpKSB7XG4gICAgICAgICAgICAgIGlmICgoaW5jbHVkZU51bGxSZWxhdGlvbnNoaXBzICYmICF2YWwubGVuZ3RoKSB8fCB2YWwubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgc2VyaWFsaXNlZFtyZWxOYW1lXSA9IHNlcmlhbGlzZXIodmFsKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodmFsICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgc2VyaWFsaXNlZFtyZWxOYW1lXSA9IHNlcmlhbGlzZXIodmFsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICByZXR1cm4gc2VyaWFsaXNlZDtcbiAgICB9LFxuICAgIHNlcmlhbGlzZTogZnVuY3Rpb24ob3B0cykge1xuICAgICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgICBpZiAoIXRoaXMubW9kZWwuc2VyaWFsaXNlKSByZXR1cm4gdGhpcy5fZGVmYXVsdFNlcmlhbGlzZShvcHRzKTtcbiAgICAgIGVsc2UgcmV0dXJuIHRoaXMubW9kZWwuc2VyaWFsaXNlKHRoaXMsIG9wdHMpO1xuICAgIH1cbiAgfSk7XG5cbiAgdXRpbC5leHRlbmQoTW9kZWxJbnN0YW5jZS5wcm90b3R5cGUsIHtcbiAgICAvKipcbiAgICAgKiBFbWl0IGFuIGV2ZW50IGluZGljYXRpbmcgdGhhdCB0aGlzIGluc3RhbmNlIGhhcyBqdXN0IGJlZW4gY3JlYXRlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9lbWl0TmV3OiBmdW5jdGlvbigpIHtcbiAgICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgICAgICBjb2xsZWN0aW9uOiB0aGlzLm1vZGVsLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICBtb2RlbDogdGhpcy5tb2RlbC5uYW1lLFxuICAgICAgICBsb2NhbElkOiB0aGlzLmxvY2FsSWQsXG4gICAgICAgIG5ldzogdGhpcyxcbiAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuTmV3LFxuICAgICAgICBvYmo6IHRoaXNcbiAgICAgIH0pO1xuICAgIH1cbiAgfSk7XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBNb2RlbEluc3RhbmNlO1xufSkoKTsiLCIoZnVuY3Rpb24gKCkge1xuICAgIHZhciBSZWxhdGlvbnNoaXBQcm94eSA9IHJlcXVpcmUoJy4vUmVsYXRpb25zaGlwUHJveHknKSxcbiAgICAgICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgICAgICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgICAgICAgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgICAgICAgd3JhcEFycmF5Rm9yQXR0cmlidXRlcyA9IGV2ZW50cy53cmFwQXJyYXksXG4gICAgICAgIEFycmF5T2JzZXJ2ZXIgPSByZXF1aXJlKCcuLi92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZScpLkFycmF5T2JzZXJ2ZXIsXG4gICAgICAgIE1vZGVsRXZlbnRUeXBlID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLk1vZGVsRXZlbnRUeXBlO1xuXG4gICAgLyoqXG4gICAgICogQGNsYXNzICBbT25lVG9NYW55UHJveHkgZGVzY3JpcHRpb25dXG4gICAgICogQGNvbnN0cnVjdG9yXG4gICAgICogQHBhcmFtIHtbdHlwZV19IG9wdHNcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBPbmVUb01hbnlQcm94eShvcHRzKSB7XG4gICAgICAgIFJlbGF0aW9uc2hpcFByb3h5LmNhbGwodGhpcywgb3B0cyk7XG4gICAgICAgIGlmICh0aGlzLmlzUmV2ZXJzZSkgdGhpcy5yZWxhdGVkID0gW107XG4gICAgfVxuXG4gICAgT25lVG9NYW55UHJveHkucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUpO1xuXG4gICAgdXRpbC5leHRlbmQoT25lVG9NYW55UHJveHkucHJvdG90eXBlLCB7XG4gICAgICAgIGNsZWFyUmV2ZXJzZTogZnVuY3Rpb24gKHJlbW92ZWQpIHtcbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIHJlbW92ZWQuZm9yRWFjaChmdW5jdGlvbiAocmVtb3ZlZE9iamVjdCkge1xuICAgICAgICAgICAgICAgIHZhciByZXZlcnNlUHJveHkgPSBzZWxmLnJldmVyc2VQcm94eUZvckluc3RhbmNlKHJlbW92ZWRPYmplY3QpO1xuICAgICAgICAgICAgICAgIHJldmVyc2VQcm94eS5zZXRJZEFuZFJlbGF0ZWQobnVsbCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0UmV2ZXJzZU9mQWRkZWQ6IGZ1bmN0aW9uIChhZGRlZCkge1xuICAgICAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAgICAgYWRkZWQuZm9yRWFjaChmdW5jdGlvbiAoYWRkZWQpIHtcbiAgICAgICAgICAgICAgICB2YXIgZm9yd2FyZFByb3h5ID0gc2VsZi5yZXZlcnNlUHJveHlGb3JJbnN0YW5jZShhZGRlZCk7XG4gICAgICAgICAgICAgICAgZm9yd2FyZFByb3h5LnNldElkQW5kUmVsYXRlZChzZWxmLm9iamVjdCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgd3JhcEFycmF5OiBmdW5jdGlvbiAoYXJyKSB7XG4gICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzKGFyciwgdGhpcy5yZXZlcnNlTmFtZSwgdGhpcy5vYmplY3QpO1xuICAgICAgICAgICAgaWYgKCFhcnIuYXJyYXlPYnNlcnZlcikge1xuICAgICAgICAgICAgICAgIGFyci5hcnJheU9ic2VydmVyID0gbmV3IEFycmF5T2JzZXJ2ZXIoYXJyKTtcbiAgICAgICAgICAgICAgICB2YXIgb2JzZXJ2ZXJGdW5jdGlvbiA9IGZ1bmN0aW9uIChzcGxpY2VzKSB7XG4gICAgICAgICAgICAgICAgICAgIHNwbGljZXMuZm9yRWFjaChmdW5jdGlvbiAoc3BsaWNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgYWRkZWQgPSBzcGxpY2UuYWRkZWRDb3VudCA/IGFyci5zbGljZShzcGxpY2UuaW5kZXgsIHNwbGljZS5pbmRleCArIHNwbGljZS5hZGRlZENvdW50KSA6IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlbW92ZWQgPSBzcGxpY2UucmVtb3ZlZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuY2xlYXJSZXZlcnNlKHJlbW92ZWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5zZXRSZXZlcnNlT2ZBZGRlZChhZGRlZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbW9kZWwgPSBzZWxmLmdldEZvcndhcmRNb2RlbCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbjogbW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWw6IG1vZGVsLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9jYWxJZDogc2VsZi5vYmplY3QubG9jYWxJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWVsZDogc2VsZi5nZXRGb3J3YXJkTmFtZSgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWRkZWQ6IGFkZGVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRleDogc3BsaWNlLmluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iajogc2VsZi5vYmplY3RcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGFyci5hcnJheU9ic2VydmVyLm9wZW4ob2JzZXJ2ZXJGdW5jdGlvbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGdldDogZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgICAgICBjYihudWxsLCB0aGlzLnJlbGF0ZWQpO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfSxcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFZhbGlkYXRlIHRoZSBvYmplY3QgdGhhdCB3ZSdyZSBzZXR0aW5nXG4gICAgICAgICAqIEBwYXJhbSBvYmpcbiAgICAgICAgICogQHJldHVybnMge3N0cmluZ3xudWxsfSBBbiBlcnJvciBtZXNzYWdlIG9yIG51bGxcbiAgICAgICAgICogQGNsYXNzIE9uZVRvTWFueVByb3h5XG4gICAgICAgICAqL1xuICAgICAgICB2YWxpZGF0ZTogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICAgICAgdmFyIHN0ciA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopO1xuICAgICAgICAgICAgaWYgKHRoaXMuaXNGb3J3YXJkKSB7XG4gICAgICAgICAgICAgICAgaWYgKHN0ciA9PSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAnQ2Fubm90IGFzc2lnbiBhcnJheSBmb3J3YXJkIG9uZVRvTWFueSAoJyArIHN0ciArICcpOiAnICsgdGhpcy5mb3J3YXJkTmFtZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoc3RyICE9ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICdDYW5ub3Qgc2NhbGFyIHRvIHJldmVyc2Ugb25lVG9NYW55ICgnICsgc3RyICsgJyk6ICcgKyB0aGlzLnJldmVyc2VOYW1lO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uIChvYmosIG9wdHMpIHtcbiAgICAgICAgICAgIHRoaXMuY2hlY2tJbnN0YWxsZWQoKTtcbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIGlmIChvYmopIHtcbiAgICAgICAgICAgICAgICB2YXIgZXJyb3JNZXNzYWdlO1xuICAgICAgICAgICAgICAgIGlmIChlcnJvck1lc3NhZ2UgPSB0aGlzLnZhbGlkYXRlKG9iaikpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yTWVzc2FnZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2xlYXJSZXZlcnNlUmVsYXRlZChvcHRzKTtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5zZXRJZEFuZFJlbGF0ZWQob2JqLCBvcHRzKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNlbGYuaXNSZXZlcnNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLndyYXBBcnJheShzZWxmLnJlbGF0ZWQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuc2V0SWRBbmRSZWxhdGVkUmV2ZXJzZShvYmosIG9wdHMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuY2xlYXJSZXZlcnNlUmVsYXRlZChvcHRzKTtcbiAgICAgICAgICAgICAgICBzZWxmLnNldElkQW5kUmVsYXRlZChvYmosIG9wdHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBpbnN0YWxsOiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgICAgICBSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUuaW5zdGFsbC5jYWxsKHRoaXMsIG9iaik7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmlzUmV2ZXJzZSkge1xuICAgICAgICAgICAgICAgIG9ialsoJ3NwbGljZScgKyB1dGlsLmNhcGl0YWxpc2VGaXJzdExldHRlcih0aGlzLnJldmVyc2VOYW1lKSldID0gdGhpcy5zcGxpY2UuYmluZCh0aGlzKTtcbiAgICAgICAgICAgICAgICB0aGlzLndyYXBBcnJheSh0aGlzLnJlbGF0ZWQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cbiAgICB9KTtcblxuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBPbmVUb01hbnlQcm94eTtcbn0pKCk7IiwiKGZ1bmN0aW9uKCkge1xuICB2YXIgUmVsYXRpb25zaGlwUHJveHkgPSByZXF1aXJlKCcuL1JlbGF0aW9uc2hpcFByb3h5JyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIFNpZXN0YU1vZGVsID0gcmVxdWlyZSgnLi9Nb2RlbEluc3RhbmNlJyk7XG5cbiAgLyoqXG4gICAqIFtPbmVUb09uZVByb3h5IGRlc2NyaXB0aW9uXVxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICAgKi9cbiAgZnVuY3Rpb24gT25lVG9PbmVQcm94eShvcHRzKSB7XG4gICAgUmVsYXRpb25zaGlwUHJveHkuY2FsbCh0aGlzLCBvcHRzKTtcbiAgfVxuXG5cbiAgT25lVG9PbmVQcm94eS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZSk7XG5cbiAgdXRpbC5leHRlbmQoT25lVG9PbmVQcm94eS5wcm90b3R5cGUsIHtcbiAgICAvKipcbiAgICAgKiBWYWxpZGF0ZSB0aGUgb2JqZWN0IHRoYXQgd2UncmUgc2V0dGluZ1xuICAgICAqIEBwYXJhbSBvYmpcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfG51bGx9IEFuIGVycm9yIG1lc3NhZ2Ugb3IgbnVsbFxuICAgICAqL1xuICAgIHZhbGlkYXRlOiBmdW5jdGlvbihvYmopIHtcbiAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSA9PSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICAgIHJldHVybiAnQ2Fubm90IGFzc2lnbiBhcnJheSB0byBvbmUgdG8gb25lIHJlbGF0aW9uc2hpcCc7XG4gICAgICB9XG4gICAgICBlbHNlIGlmICgoIW9iaiBpbnN0YW5jZW9mIFNpZXN0YU1vZGVsKSkge1xuXG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24ob2JqLCBvcHRzKSB7XG4gICAgICB0aGlzLmNoZWNrSW5zdGFsbGVkKCk7XG4gICAgICBpZiAob2JqKSB7XG4gICAgICAgIHZhciBlcnJvck1lc3NhZ2U7XG4gICAgICAgIGlmIChlcnJvck1lc3NhZ2UgPSB0aGlzLnZhbGlkYXRlKG9iaikpIHtcbiAgICAgICAgICByZXR1cm4gZXJyb3JNZXNzYWdlO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIHRoaXMuY2xlYXJSZXZlcnNlUmVsYXRlZChvcHRzKTtcbiAgICAgICAgICB0aGlzLnNldElkQW5kUmVsYXRlZChvYmosIG9wdHMpO1xuICAgICAgICAgIHRoaXMuc2V0SWRBbmRSZWxhdGVkUmV2ZXJzZShvYmosIG9wdHMpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgdGhpcy5jbGVhclJldmVyc2VSZWxhdGVkKG9wdHMpO1xuICAgICAgICB0aGlzLnNldElkQW5kUmVsYXRlZChvYmosIG9wdHMpO1xuICAgICAgfVxuICAgIH0sXG4gICAgZ2V0OiBmdW5jdGlvbihjYikge1xuICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgICAgY2IobnVsbCwgdGhpcy5yZWxhdGVkKTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfVxuICB9KTtcblxuXG4gIG1vZHVsZS5leHBvcnRzID0gT25lVG9PbmVQcm94eTtcbn0pKCk7IiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcblxuLyoqXG4gKiBBY3RzIGFzIGEgcGxhY2Vob2xkZXIgZm9yIHZhcmlvdXMgb2JqZWN0cyBlLmcuIGxhenkgcmVnaXN0cmF0aW9uIG9mIG1vZGVscy5cbiAqIEBwYXJhbSBbb3B0c11cbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBQbGFjZWhvbGRlcihvcHRzKSB7XG4gIHV0aWwuZXh0ZW5kKHRoaXMsIG9wdHMgfHwge30pO1xuICB0aGlzLmlzUGxhY2Vob2xkZXIgPSB0cnVlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFBsYWNlaG9sZGVyOyIsIihmdW5jdGlvbigpIHtcbiAgdmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJykoJ3F1ZXJ5JyksXG4gICAgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLFxuICAgIE1vZGVsSW5zdGFuY2UgPSByZXF1aXJlKCcuL01vZGVsSW5zdGFuY2UnKSxcbiAgICBjb25zdHJ1Y3RRdWVyeVNldCA9IHJlcXVpcmUoJy4vUXVlcnlTZXQnKTtcblxuICAvKipcbiAgICogQGNsYXNzIFtRdWVyeSBkZXNjcmlwdGlvbl1cbiAgICogQHBhcmFtIHtNb2RlbH0gbW9kZWxcbiAgICogQHBhcmFtIHtPYmplY3R9IHF1ZXJ5XG4gICAqL1xuICBmdW5jdGlvbiBRdWVyeShtb2RlbCwgcXVlcnkpIHtcbiAgICB2YXIgb3B0cyA9IHt9O1xuICAgIGZvciAodmFyIHByb3AgaW4gcXVlcnkpIHtcbiAgICAgIGlmIChxdWVyeS5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICBpZiAocHJvcC5zbGljZSgwLCAyKSA9PSAnX18nKSB7XG4gICAgICAgICAgb3B0c1twcm9wLnNsaWNlKDIpXSA9IHF1ZXJ5W3Byb3BdO1xuICAgICAgICAgIGRlbGV0ZSBxdWVyeVtwcm9wXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB1dGlsLmV4dGVuZCh0aGlzLCB7XG4gICAgICBtb2RlbDogbW9kZWwsXG4gICAgICBxdWVyeTogcXVlcnksXG4gICAgICBvcHRzOiBvcHRzXG4gICAgfSk7XG4gICAgb3B0cy5vcmRlciA9IG9wdHMub3JkZXIgfHwgW107XG4gICAgaWYgKCF1dGlsLmlzQXJyYXkob3B0cy5vcmRlcikpIG9wdHMub3JkZXIgPSBbb3B0cy5vcmRlcl07XG4gIH1cblxuICBmdW5jdGlvbiB2YWx1ZUFzU3RyaW5nKGZpZWxkVmFsdWUpIHtcbiAgICB2YXIgZmllbGRBc1N0cmluZztcbiAgICBpZiAoZmllbGRWYWx1ZSA9PT0gbnVsbCkgZmllbGRBc1N0cmluZyA9ICdudWxsJztcbiAgICBlbHNlIGlmIChmaWVsZFZhbHVlID09PSB1bmRlZmluZWQpIGZpZWxkQXNTdHJpbmcgPSAndW5kZWZpbmVkJztcbiAgICBlbHNlIGlmIChmaWVsZFZhbHVlIGluc3RhbmNlb2YgTW9kZWxJbnN0YW5jZSkgZmllbGRBc1N0cmluZyA9IGZpZWxkVmFsdWUubG9jYWxJZDtcbiAgICBlbHNlIGZpZWxkQXNTdHJpbmcgPSBmaWVsZFZhbHVlLnRvU3RyaW5nKCk7XG4gICAgcmV0dXJuIGZpZWxkQXNTdHJpbmc7XG4gIH1cblxuICBmdW5jdGlvbiBjb250YWlucyhvcHRzKSB7XG4gICAgaWYgKCFvcHRzLmludmFsaWQpIHtcbiAgICAgIHZhciBhcnIgPSBvcHRzLm9iamVjdFtvcHRzLmZpZWxkXTtcbiAgICAgIGlmICh1dGlsLmlzQXJyYXkoYXJyKSB8fCB1dGlsLmlzU3RyaW5nKGFycikpIHtcbiAgICAgICAgcmV0dXJuIGFyci5pbmRleE9mKG9wdHMudmFsdWUpID4gLTE7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHZhciBjb21wYXJhdG9ycyA9IHtcbiAgICBlOiBmdW5jdGlvbihvcHRzKSB7XG4gICAgICB2YXIgZmllbGRWYWx1ZSA9IG9wdHMub2JqZWN0W29wdHMuZmllbGRdO1xuICAgICAgaWYgKGxvZy5lbmFibGVkKSB7XG4gICAgICAgIGxvZyhvcHRzLmZpZWxkICsgJzogJyArIHZhbHVlQXNTdHJpbmcoZmllbGRWYWx1ZSkgKyAnID09ICcgKyB2YWx1ZUFzU3RyaW5nKG9wdHMudmFsdWUpLCB7b3B0czogb3B0c30pO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZpZWxkVmFsdWUgPT0gb3B0cy52YWx1ZTtcbiAgICB9LFxuICAgIGx0OiBmdW5jdGlvbihvcHRzKSB7XG4gICAgICBpZiAoIW9wdHMuaW52YWxpZCkgcmV0dXJuIG9wdHMub2JqZWN0W29wdHMuZmllbGRdIDwgb3B0cy52YWx1ZTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9LFxuICAgIGd0OiBmdW5jdGlvbihvcHRzKSB7XG4gICAgICBpZiAoIW9wdHMuaW52YWxpZCkgcmV0dXJuIG9wdHMub2JqZWN0W29wdHMuZmllbGRdID4gb3B0cy52YWx1ZTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9LFxuICAgIGx0ZTogZnVuY3Rpb24ob3B0cykge1xuICAgICAgaWYgKCFvcHRzLmludmFsaWQpIHJldHVybiBvcHRzLm9iamVjdFtvcHRzLmZpZWxkXSA8PSBvcHRzLnZhbHVlO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0sXG4gICAgZ3RlOiBmdW5jdGlvbihvcHRzKSB7XG4gICAgICBpZiAoIW9wdHMuaW52YWxpZCkgcmV0dXJuIG9wdHMub2JqZWN0W29wdHMuZmllbGRdID49IG9wdHMudmFsdWU7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSxcbiAgICBjb250YWluczogY29udGFpbnMsXG4gICAgaW46IGNvbnRhaW5zXG4gIH07XG5cbiAgdXRpbC5leHRlbmQoUXVlcnksIHtcbiAgICBjb21wYXJhdG9yczogY29tcGFyYXRvcnMsXG4gICAgcmVnaXN0ZXJDb21wYXJhdG9yOiBmdW5jdGlvbihzeW1ib2wsIGZuKSB7XG4gICAgICBpZiAoIWNvbXBhcmF0b3JzW3N5bWJvbF0pIHtcbiAgICAgICAgY29tcGFyYXRvcnNbc3ltYm9sXSA9IGZuO1xuICAgICAgfVxuICAgIH1cbiAgfSk7XG5cbiAgZnVuY3Rpb24gY2FjaGVGb3JNb2RlbChtb2RlbCkge1xuICAgIHZhciBjYWNoZUJ5VHlwZSA9IGNhY2hlLl9sb2NhbENhY2hlQnlUeXBlO1xuICAgIHZhciBtb2RlbE5hbWUgPSBtb2RlbC5uYW1lO1xuICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IG1vZGVsLmNvbGxlY3Rpb25OYW1lO1xuICAgIHZhciBjYWNoZUJ5TW9kZWwgPSBjYWNoZUJ5VHlwZVtjb2xsZWN0aW9uTmFtZV07XG4gICAgdmFyIGNhY2hlQnlMb2NhbElkO1xuICAgIGlmIChjYWNoZUJ5TW9kZWwpIHtcbiAgICAgIGNhY2hlQnlMb2NhbElkID0gY2FjaGVCeU1vZGVsW21vZGVsTmFtZV0gfHwge307XG4gICAgfVxuICAgIHJldHVybiBjYWNoZUJ5TG9jYWxJZDtcbiAgfVxuXG4gIHV0aWwuZXh0ZW5kKFF1ZXJ5LnByb3RvdHlwZSwge1xuICAgIGV4ZWN1dGU6IGZ1bmN0aW9uKGNiKSB7XG4gICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgICB0aGlzLl9leGVjdXRlSW5NZW1vcnkoY2IpO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9LFxuICAgIF9kdW1wOiBmdW5jdGlvbihhc0pzb24pIHtcbiAgICAgIHJldHVybiBhc0pzb24gPyAne30nIDoge307XG4gICAgfSxcbiAgICBzb3J0RnVuYzogZnVuY3Rpb24oZmllbGRzKSB7XG4gICAgICB2YXIgc29ydEZ1bmMgPSBmdW5jdGlvbihhc2NlbmRpbmcsIGZpZWxkKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbih2MSwgdjIpIHtcbiAgICAgICAgICB2YXIgZDEgPSB2MVtmaWVsZF0sXG4gICAgICAgICAgICBkMiA9IHYyW2ZpZWxkXSxcbiAgICAgICAgICAgIHJlcztcbiAgICAgICAgICBpZiAodHlwZW9mIGQxID09ICdzdHJpbmcnIHx8IGQxIGluc3RhbmNlb2YgU3RyaW5nICYmXG4gICAgICAgICAgICB0eXBlb2YgZDIgPT0gJ3N0cmluZycgfHwgZDIgaW5zdGFuY2VvZiBTdHJpbmcpIHtcbiAgICAgICAgICAgIHJlcyA9IGFzY2VuZGluZyA/IGQxLmxvY2FsZUNvbXBhcmUoZDIpIDogZDIubG9jYWxlQ29tcGFyZShkMSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaWYgKGQxIGluc3RhbmNlb2YgRGF0ZSkgZDEgPSBkMS5nZXRUaW1lKCk7XG4gICAgICAgICAgICBpZiAoZDIgaW5zdGFuY2VvZiBEYXRlKSBkMiA9IGQyLmdldFRpbWUoKTtcbiAgICAgICAgICAgIGlmIChhc2NlbmRpbmcpIHJlcyA9IGQxIC0gZDI7XG4gICAgICAgICAgICBlbHNlIHJlcyA9IGQyIC0gZDE7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiByZXM7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICB2YXIgcyA9IHV0aWw7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGZpZWxkcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgZmllbGQgPSBmaWVsZHNbaV07XG4gICAgICAgIHMgPSBzLnRoZW5CeShzb3J0RnVuYyhmaWVsZC5hc2NlbmRpbmcsIGZpZWxkLmZpZWxkKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcyA9PSB1dGlsID8gbnVsbCA6IHM7XG4gICAgfSxcbiAgICBfc29ydFJlc3VsdHM6IGZ1bmN0aW9uKHJlcykge1xuICAgICAgdmFyIG9yZGVyID0gdGhpcy5vcHRzLm9yZGVyO1xuICAgICAgaWYgKHJlcyAmJiBvcmRlcikge1xuICAgICAgICB2YXIgZmllbGRzID0gb3JkZXIubWFwKGZ1bmN0aW9uKG9yZGVyaW5nKSB7XG4gICAgICAgICAgdmFyIHNwbHQgPSBvcmRlcmluZy5zcGxpdCgnLScpLFxuICAgICAgICAgICAgYXNjZW5kaW5nID0gdHJ1ZSxcbiAgICAgICAgICAgIGZpZWxkID0gbnVsbDtcbiAgICAgICAgICBpZiAoc3BsdC5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICBmaWVsZCA9IHNwbHRbMV07XG4gICAgICAgICAgICBhc2NlbmRpbmcgPSBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBmaWVsZCA9IHNwbHRbMF07XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiB7ZmllbGQ6IGZpZWxkLCBhc2NlbmRpbmc6IGFzY2VuZGluZ307XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIHZhciBzb3J0RnVuYyA9IHRoaXMuc29ydEZ1bmMoZmllbGRzKTtcbiAgICAgICAgaWYgKHJlcy5pbW11dGFibGUpIHJlcyA9IHJlcy5tdXRhYmxlQ29weSgpO1xuICAgICAgICBpZiAoc29ydEZ1bmMpIHJlcy5zb3J0KHNvcnRGdW5jKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXM7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZXR1cm4gYWxsIG1vZGVsIGluc3RhbmNlcyBpbiB0aGUgY2FjaGUuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZ2V0Q2FjaGVCeUxvY2FsSWQ6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMubW9kZWwuZGVzY2VuZGFudHMucmVkdWNlKGZ1bmN0aW9uKG1lbW8sIGNoaWxkTW9kZWwpIHtcbiAgICAgICAgcmV0dXJuIHV0aWwuZXh0ZW5kKG1lbW8sIGNhY2hlRm9yTW9kZWwoY2hpbGRNb2RlbCkpO1xuICAgICAgfSwgdXRpbC5leHRlbmQoe30sIGNhY2hlRm9yTW9kZWwodGhpcy5tb2RlbCkpKTtcbiAgICB9LFxuICAgIF9leGVjdXRlSW5NZW1vcnk6IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICB2YXIgX2V4ZWN1dGVJbk1lbW9yeSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgY2FjaGVCeUxvY2FsSWQgPSB0aGlzLl9nZXRDYWNoZUJ5TG9jYWxJZCgpO1xuICAgICAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKGNhY2hlQnlMb2NhbElkKTtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICB2YXIgcmVzID0gW107XG4gICAgICAgIHZhciBlcnI7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIHZhciBrID0ga2V5c1tpXTtcbiAgICAgICAgICB2YXIgb2JqID0gY2FjaGVCeUxvY2FsSWRba107XG4gICAgICAgICAgdmFyIG1hdGNoZXMgPSBzZWxmLm9iamVjdE1hdGNoZXNRdWVyeShvYmopO1xuICAgICAgICAgIGlmICh0eXBlb2YobWF0Y2hlcykgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGVyciA9IGVycm9yKG1hdGNoZXMpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChtYXRjaGVzKSByZXMucHVzaChvYmopO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXMgPSB0aGlzLl9zb3J0UmVzdWx0cyhyZXMpO1xuICAgICAgICBpZiAoZXJyKSBsb2coJ0Vycm9yIGV4ZWN1dGluZyBxdWVyeScsIGVycik7XG4gICAgICAgIGNhbGxiYWNrKGVyciwgZXJyID8gbnVsbCA6IGNvbnN0cnVjdFF1ZXJ5U2V0KHJlcywgdGhpcy5tb2RlbCkpO1xuICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgaWYgKHRoaXMub3B0cy5pZ25vcmVJbnN0YWxsZWQpIHtcbiAgICAgICAgX2V4ZWN1dGVJbk1lbW9yeSgpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHNpZXN0YS5fYWZ0ZXJJbnN0YWxsKF9leGVjdXRlSW5NZW1vcnkpO1xuICAgICAgfVxuXG4gICAgfSxcbiAgICBjbGVhck9yZGVyaW5nOiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMub3B0cy5vcmRlciA9IG51bGw7XG4gICAgfSxcbiAgICBvYmplY3RNYXRjaGVzT3JRdWVyeTogZnVuY3Rpb24ob2JqLCBvclF1ZXJ5KSB7XG4gICAgICBmb3IgKHZhciBpZHggaW4gb3JRdWVyeSkge1xuICAgICAgICBpZiAob3JRdWVyeS5oYXNPd25Qcm9wZXJ0eShpZHgpKSB7XG4gICAgICAgICAgdmFyIHF1ZXJ5ID0gb3JRdWVyeVtpZHhdO1xuICAgICAgICAgIGlmICh0aGlzLm9iamVjdE1hdGNoZXNCYXNlUXVlcnkob2JqLCBxdWVyeSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0sXG4gICAgb2JqZWN0TWF0Y2hlc0FuZFF1ZXJ5OiBmdW5jdGlvbihvYmosIGFuZFF1ZXJ5KSB7XG4gICAgICBmb3IgKHZhciBpZHggaW4gYW5kUXVlcnkpIHtcbiAgICAgICAgaWYgKGFuZFF1ZXJ5Lmhhc093blByb3BlcnR5KGlkeCkpIHtcbiAgICAgICAgICB2YXIgcXVlcnkgPSBhbmRRdWVyeVtpZHhdO1xuICAgICAgICAgIGlmICghdGhpcy5vYmplY3RNYXRjaGVzQmFzZVF1ZXJ5KG9iaiwgcXVlcnkpKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9LFxuICAgIHNwbGl0TWF0Y2hlczogZnVuY3Rpb24ob2JqLCB1bnByb2Nlc3NlZEZpZWxkLCB2YWx1ZSkge1xuICAgICAgdmFyIG9wID0gJ2UnO1xuICAgICAgdmFyIGZpZWxkcyA9IHVucHJvY2Vzc2VkRmllbGQuc3BsaXQoJy4nKTtcbiAgICAgIHZhciBzcGx0ID0gZmllbGRzW2ZpZWxkcy5sZW5ndGggLSAxXS5zcGxpdCgnX18nKTtcbiAgICAgIGlmIChzcGx0Lmxlbmd0aCA9PSAyKSB7XG4gICAgICAgIHZhciBmaWVsZCA9IHNwbHRbMF07XG4gICAgICAgIG9wID0gc3BsdFsxXTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBmaWVsZCA9IHNwbHRbMF07XG4gICAgICB9XG4gICAgICBmaWVsZHNbZmllbGRzLmxlbmd0aCAtIDFdID0gZmllbGQ7XG4gICAgICBmaWVsZHMuc2xpY2UoMCwgZmllbGRzLmxlbmd0aCAtIDEpLmZvckVhY2goZnVuY3Rpb24oZikge1xuICAgICAgICBpZiAodXRpbC5pc0FycmF5KG9iaikpIHtcbiAgICAgICAgICBvYmogPSB1dGlsLnBsdWNrKG9iaiwgZik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgb2JqID0gb2JqW2ZdO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIC8vIElmIHdlIGdldCB0byB0aGUgcG9pbnQgd2hlcmUgd2UncmUgYWJvdXQgdG8gaW5kZXggbnVsbCBvciB1bmRlZmluZWQgd2Ugc3RvcCAtIG9idmlvdXNseSB0aGlzIG9iamVjdCBkb2VzXG4gICAgICAvLyBub3QgbWF0Y2ggdGhlIHF1ZXJ5LlxuICAgICAgdmFyIG5vdE51bGxPclVuZGVmaW5lZCA9IG9iaiAhPSB1bmRlZmluZWQ7XG4gICAgICBpZiAobm90TnVsbE9yVW5kZWZpbmVkKSB7XG4gICAgICAgIHZhciB2YWwgPSBvYmpbZmllbGRdOyAvLyBCcmVha3MgaGVyZS5cbiAgICAgICAgdmFyIGludmFsaWQgPSB2YWwgPT09IG51bGwgfHwgdmFsID09PSB1bmRlZmluZWQ7XG4gICAgICAgIHZhciBjb21wYXJhdG9yID0gUXVlcnkuY29tcGFyYXRvcnNbb3BdLFxuICAgICAgICAgIG9wdHMgPSB7b2JqZWN0OiBvYmosIGZpZWxkOiBmaWVsZCwgdmFsdWU6IHZhbHVlLCBpbnZhbGlkOiBpbnZhbGlkfTtcbiAgICAgICAgaWYgKCFjb21wYXJhdG9yKSB7XG4gICAgICAgICAgcmV0dXJuICdObyBjb21wYXJhdG9yIHJlZ2lzdGVyZWQgZm9yIHF1ZXJ5IG9wZXJhdGlvbiBcIicgKyBvcCArICdcIic7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvbXBhcmF0b3Iob3B0cyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSxcbiAgICBvYmplY3RNYXRjaGVzOiBmdW5jdGlvbihvYmosIHVucHJvY2Vzc2VkRmllbGQsIHZhbHVlLCBxdWVyeSkge1xuICAgICAgaWYgKHVucHJvY2Vzc2VkRmllbGQgPT0gJyRvcicpIHtcbiAgICAgICAgdmFyICRvciA9IHF1ZXJ5Wyckb3InXTtcbiAgICAgICAgaWYgKCF1dGlsLmlzQXJyYXkoJG9yKSkge1xuICAgICAgICAgICRvciA9IE9iamVjdC5rZXlzKCRvcikubWFwKGZ1bmN0aW9uKGspIHtcbiAgICAgICAgICAgIHZhciBub3JtYWxpc2VkID0ge307XG4gICAgICAgICAgICBub3JtYWxpc2VkW2tdID0gJG9yW2tdO1xuICAgICAgICAgICAgcmV0dXJuIG5vcm1hbGlzZWQ7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF0aGlzLm9iamVjdE1hdGNoZXNPclF1ZXJ5KG9iaiwgJG9yKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgZWxzZSBpZiAodW5wcm9jZXNzZWRGaWVsZCA9PSAnJGFuZCcpIHtcbiAgICAgICAgaWYgKCF0aGlzLm9iamVjdE1hdGNoZXNBbmRRdWVyeShvYmosIHF1ZXJ5WyckYW5kJ10pKSByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgdmFyIG1hdGNoZXMgPSB0aGlzLnNwbGl0TWF0Y2hlcyhvYmosIHVucHJvY2Vzc2VkRmllbGQsIHZhbHVlKTtcbiAgICAgICAgaWYgKHR5cGVvZiBtYXRjaGVzICE9ICdib29sZWFuJykgcmV0dXJuIG1hdGNoZXM7XG4gICAgICAgIGlmICghbWF0Y2hlcykgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSxcbiAgICBvYmplY3RNYXRjaGVzQmFzZVF1ZXJ5OiBmdW5jdGlvbihvYmosIHF1ZXJ5KSB7XG4gICAgICB2YXIgZmllbGRzID0gT2JqZWN0LmtleXMocXVlcnkpO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBmaWVsZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIHVucHJvY2Vzc2VkRmllbGQgPSBmaWVsZHNbaV0sXG4gICAgICAgICAgdmFsdWUgPSBxdWVyeVt1bnByb2Nlc3NlZEZpZWxkXTtcbiAgICAgICAgdmFyIHJ0ID0gdGhpcy5vYmplY3RNYXRjaGVzKG9iaiwgdW5wcm9jZXNzZWRGaWVsZCwgdmFsdWUsIHF1ZXJ5KTtcbiAgICAgICAgaWYgKHR5cGVvZiBydCAhPSAnYm9vbGVhbicpIHJldHVybiBydDtcbiAgICAgICAgaWYgKCFydCkgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSxcbiAgICBvYmplY3RNYXRjaGVzUXVlcnk6IGZ1bmN0aW9uKG9iaikge1xuICAgICAgcmV0dXJuIHRoaXMub2JqZWN0TWF0Y2hlc0Jhc2VRdWVyeShvYmosIHRoaXMucXVlcnkpO1xuICAgIH1cbiAgfSk7XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBRdWVyeTtcbn0pKCk7IiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgUHJvbWlzZSA9IHV0aWwuUHJvbWlzZSxcbiAgZXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJyksXG4gIE1vZGVsSW5zdGFuY2UgPSByZXF1aXJlKCcuL01vZGVsSW5zdGFuY2UnKTtcblxuLypcbiBUT0RPOiBVc2UgRVM2IFByb3h5IGluc3RlYWQuXG4gRXZlbnR1YWxseSBxdWVyeSBzZXRzIHNob3VsZCB1c2UgRVM2IFByb3hpZXMgd2hpY2ggd2lsbCBiZSBtdWNoIG1vcmUgbmF0dXJhbCBhbmQgcm9idXN0LiBFLmcuIG5vIG5lZWQgZm9yIHRoZSBiZWxvd1xuICovXG52YXIgQVJSQVlfTUVUSE9EUyA9IFsncHVzaCcsICdzb3J0JywgJ3JldmVyc2UnLCAnc3BsaWNlJywgJ3NoaWZ0JywgJ3Vuc2hpZnQnXSxcbiAgTlVNQkVSX01FVEhPRFMgPSBbJ3RvU3RyaW5nJywgJ3RvRXhwb25lbnRpYWwnLCAndG9GaXhlZCcsICd0b1ByZWNpc2lvbicsICd2YWx1ZU9mJ10sXG4gIE5VTUJFUl9QUk9QRVJUSUVTID0gWydNQVhfVkFMVUUnLCAnTUlOX1ZBTFVFJywgJ05FR0FUSVZFX0lORklOSVRZJywgJ05hTicsICdQT1NJVElWRV9JTkZJTklUWSddLFxuICBTVFJJTkdfTUVUSE9EUyA9IFsnY2hhckF0JywgJ2NoYXJDb2RlQXQnLCAnY29uY2F0JywgJ2Zyb21DaGFyQ29kZScsICdpbmRleE9mJywgJ2xhc3RJbmRleE9mJywgJ2xvY2FsZUNvbXBhcmUnLFxuICAgICdtYXRjaCcsICdyZXBsYWNlJywgJ3NlYXJjaCcsICdzbGljZScsICdzcGxpdCcsICdzdWJzdHInLCAnc3Vic3RyaW5nJywgJ3RvTG9jYWxlTG93ZXJDYXNlJywgJ3RvTG9jYWxlVXBwZXJDYXNlJyxcbiAgICAndG9Mb3dlckNhc2UnLCAndG9TdHJpbmcnLCAndG9VcHBlckNhc2UnLCAndHJpbScsICd2YWx1ZU9mJ10sXG4gIFNUUklOR19QUk9QRVJUSUVTID0gWydsZW5ndGgnXTtcblxuLyoqXG4gKiBSZXR1cm4gdGhlIHByb3BlcnR5IG5hbWVzIGZvciBhIGdpdmVuIG9iamVjdC4gSGFuZGxlcyBzcGVjaWFsIGNhc2VzIHN1Y2ggYXMgc3RyaW5ncyBhbmQgbnVtYmVycyB0aGF0IGRvIG5vdCBoYXZlXG4gKiB0aGUgZ2V0T3duUHJvcGVydHlOYW1lcyBmdW5jdGlvbi5cbiAqIFRoZSBzcGVjaWFsIGNhc2VzIGFyZSB2ZXJ5IG11Y2ggaGFja3MuIFRoaXMgaGFjayBjYW4gYmUgcmVtb3ZlZCBvbmNlIHRoZSBQcm94eSBvYmplY3QgaXMgbW9yZSB3aWRlbHkgYWRvcHRlZC5cbiAqIEBwYXJhbSBvYmplY3RcbiAqIEByZXR1cm5zIHtBcnJheX1cbiAqL1xuZnVuY3Rpb24gZ2V0UHJvcGVydHlOYW1lcyhvYmplY3QpIHtcbiAgdmFyIHByb3BlcnR5TmFtZXM7XG4gIGlmICh0eXBlb2Ygb2JqZWN0ID09ICdzdHJpbmcnIHx8IG9iamVjdCBpbnN0YW5jZW9mIFN0cmluZykge1xuICAgIHByb3BlcnR5TmFtZXMgPSBTVFJJTkdfTUVUSE9EUy5jb25jYXQoU1RSSU5HX1BST1BFUlRJRVMpO1xuICB9XG4gIGVsc2UgaWYgKHR5cGVvZiBvYmplY3QgPT0gJ251bWJlcicgfHwgb2JqZWN0IGluc3RhbmNlb2YgTnVtYmVyKSB7XG4gICAgcHJvcGVydHlOYW1lcyA9IE5VTUJFUl9NRVRIT0RTLmNvbmNhdChOVU1CRVJfUFJPUEVSVElFUyk7XG4gIH1cbiAgZWxzZSB7XG4gICAgcHJvcGVydHlOYW1lcyA9IG9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKCk7XG4gIH1cbiAgcmV0dXJuIHByb3BlcnR5TmFtZXM7XG59XG5cbi8qKlxuICogRGVmaW5lIGEgcHJveHkgcHJvcGVydHkgdG8gYXR0cmlidXRlcyBvbiBvYmplY3RzIGluIHRoZSBhcnJheVxuICogQHBhcmFtIGFyclxuICogQHBhcmFtIHByb3BcbiAqL1xuZnVuY3Rpb24gZGVmaW5lQXR0cmlidXRlKGFyciwgcHJvcCkge1xuICBpZiAoIShwcm9wIGluIGFycikpIHsgLy8gZS5nLiB3ZSBjYW5ub3QgcmVkZWZpbmUgLmxlbmd0aFxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShhcnIsIHByb3AsIHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBxdWVyeVNldCh1dGlsLnBsdWNrKGFyciwgcHJvcCkpO1xuICAgICAgfSxcbiAgICAgIHNldDogZnVuY3Rpb24odikge1xuICAgICAgICBpZiAodXRpbC5pc0FycmF5KHYpKSB7XG4gICAgICAgICAgaWYgKHRoaXMubGVuZ3RoICE9IHYubGVuZ3RoKSB0aHJvdyBlcnJvcih7bWVzc2FnZTogJ011c3QgYmUgc2FtZSBsZW5ndGgnfSk7XG4gICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB2Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzW2ldW3Byb3BdID0gdltpXTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgZm9yIChpID0gMDsgaSA8IHRoaXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXNbaV1bcHJvcF0gPSB2O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzUHJvbWlzZShvYmopIHtcbiAgLy8gVE9ETzogRG9uJ3QgdGhpbmsgdGhpcyBpcyB2ZXJ5IHJvYnVzdC5cbiAgcmV0dXJuIG9iai50aGVuICYmIG9iai5jYXRjaDtcbn1cblxuLyoqXG4gKiBEZWZpbmUgYSBwcm94eSBtZXRob2Qgb24gdGhlIGFycmF5IGlmIG5vdCBhbHJlYWR5IGluIGV4aXN0ZW5jZS5cbiAqIEBwYXJhbSBhcnJcbiAqIEBwYXJhbSBwcm9wXG4gKi9cbmZ1bmN0aW9uIGRlZmluZU1ldGhvZChhcnIsIHByb3ApIHtcbiAgaWYgKCEocHJvcCBpbiBhcnIpKSB7IC8vIGUuZy4gd2UgZG9uJ3Qgd2FudCB0byByZWRlZmluZSB0b1N0cmluZ1xuICAgIGFycltwcm9wXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGFyZ3MgPSBhcmd1bWVudHMsXG4gICAgICAgIHJlcyA9IHRoaXMubWFwKGZ1bmN0aW9uKHApIHtcbiAgICAgICAgICByZXR1cm4gcFtwcm9wXS5hcHBseShwLCBhcmdzKTtcbiAgICAgICAgfSk7XG4gICAgICB2YXIgYXJlUHJvbWlzZXMgPSBmYWxzZTtcbiAgICAgIGlmIChyZXMubGVuZ3RoKSBhcmVQcm9taXNlcyA9IGlzUHJvbWlzZShyZXNbMF0pO1xuICAgICAgcmV0dXJuIGFyZVByb21pc2VzID8gUHJvbWlzZS5hbGwocmVzKSA6IHF1ZXJ5U2V0KHJlcyk7XG4gICAgfTtcbiAgfVxufVxuXG4vKipcbiAqIFRyYW5zZm9ybSB0aGUgYXJyYXkgaW50byBhIHF1ZXJ5IHNldC5cbiAqIFJlbmRlcnMgdGhlIGFycmF5IGltbXV0YWJsZS5cbiAqIEBwYXJhbSBhcnJcbiAqIEBwYXJhbSBtb2RlbCAtIFRoZSBtb2RlbCB3aXRoIHdoaWNoIHRvIHByb3h5IHRvXG4gKi9cbmZ1bmN0aW9uIG1vZGVsUXVlcnlTZXQoYXJyLCBtb2RlbCkge1xuICBhcnIgPSB1dGlsLmV4dGVuZChbXSwgYXJyKTtcbiAgdmFyIGF0dHJpYnV0ZU5hbWVzID0gbW9kZWwuX2F0dHJpYnV0ZU5hbWVzLFxuICAgIHJlbGF0aW9uc2hpcE5hbWVzID0gbW9kZWwuX3JlbGF0aW9uc2hpcE5hbWVzLFxuICAgIG5hbWVzID0gYXR0cmlidXRlTmFtZXMuY29uY2F0KHJlbGF0aW9uc2hpcE5hbWVzKS5jb25jYXQoaW5zdGFuY2VNZXRob2RzKTtcbiAgbmFtZXMuZm9yRWFjaChkZWZpbmVBdHRyaWJ1dGUuYmluZChkZWZpbmVBdHRyaWJ1dGUsIGFycikpO1xuICB2YXIgaW5zdGFuY2VNZXRob2RzID0gT2JqZWN0LmtleXMoTW9kZWxJbnN0YW5jZS5wcm90b3R5cGUpO1xuICBpbnN0YW5jZU1ldGhvZHMuZm9yRWFjaChkZWZpbmVNZXRob2QuYmluZChkZWZpbmVNZXRob2QsIGFycikpO1xuICByZXR1cm4gcmVuZGVySW1tdXRhYmxlKGFycik7XG59XG5cbi8qKlxuICogVHJhbnNmb3JtIHRoZSBhcnJheSBpbnRvIGEgcXVlcnkgc2V0LCBiYXNlZCBvbiB3aGF0ZXZlciBpcyBpbiBpdC5cbiAqIE5vdGUgdGhhdCBhbGwgb2JqZWN0cyBtdXN0IGJlIG9mIHRoZSBzYW1lIHR5cGUuIFRoaXMgZnVuY3Rpb24gd2lsbCB0YWtlIHRoZSBmaXJzdCBvYmplY3QgYW5kIGRlY2lkZSBob3cgdG8gcHJveHlcbiAqIGJhc2VkIG9uIHRoYXQuXG4gKiBAcGFyYW0gYXJyXG4gKi9cbmZ1bmN0aW9uIHF1ZXJ5U2V0KGFycikge1xuICBpZiAoYXJyLmxlbmd0aCkge1xuICAgIHZhciByZWZlcmVuY2VPYmplY3QgPSBhcnJbMF0sXG4gICAgICBwcm9wZXJ0eU5hbWVzID0gZ2V0UHJvcGVydHlOYW1lcyhyZWZlcmVuY2VPYmplY3QpO1xuICAgIHByb3BlcnR5TmFtZXMuZm9yRWFjaChmdW5jdGlvbihwcm9wKSB7XG4gICAgICBpZiAodHlwZW9mIHJlZmVyZW5jZU9iamVjdFtwcm9wXSA9PSAnZnVuY3Rpb24nKSBkZWZpbmVNZXRob2QoYXJyLCBwcm9wLCBhcmd1bWVudHMpO1xuICAgICAgZWxzZSBkZWZpbmVBdHRyaWJ1dGUoYXJyLCBwcm9wKTtcbiAgICB9KTtcbiAgfVxuICByZXR1cm4gcmVuZGVySW1tdXRhYmxlKGFycik7XG59XG5cbmZ1bmN0aW9uIHRocm93SW1tdXRhYmxlRXJyb3IoKSB7XG4gIHRocm93IG5ldyBFcnJvcignQ2Fubm90IG1vZGlmeSBhIHF1ZXJ5IHNldCcpO1xufVxuXG4vKipcbiAqIFJlbmRlciBhbiBhcnJheSBpbW11dGFibGUgYnkgcmVwbGFjaW5nIGFueSBmdW5jdGlvbnMgdGhhdCBjYW4gbXV0YXRlIGl0LlxuICogQHBhcmFtIGFyclxuICovXG5mdW5jdGlvbiByZW5kZXJJbW11dGFibGUoYXJyKSB7XG4gIEFSUkFZX01FVEhPRFMuZm9yRWFjaChmdW5jdGlvbihwKSB7XG4gICAgYXJyW3BdID0gdGhyb3dJbW11dGFibGVFcnJvcjtcbiAgfSk7XG4gIGFyci5pbW11dGFibGUgPSB0cnVlO1xuICBhcnIubXV0YWJsZUNvcHkgPSBhcnIuYXNBcnJheSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBtdXRhYmxlQXJyID0gdGhpcy5tYXAoZnVuY3Rpb24oeCkge3JldHVybiB4fSk7XG4gICAgbXV0YWJsZUFyci5hc1F1ZXJ5U2V0ID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gcXVlcnlTZXQodGhpcyk7XG4gICAgfTtcbiAgICBtdXRhYmxlQXJyLmFzTW9kZWxRdWVyeVNldCA9IGZ1bmN0aW9uKG1vZGVsKSB7XG4gICAgICByZXR1cm4gbW9kZWxRdWVyeVNldCh0aGlzLCBtb2RlbCk7XG4gICAgfTtcbiAgICByZXR1cm4gbXV0YWJsZUFycjtcbiAgfTtcbiAgcmV0dXJuIGFycjtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBtb2RlbFF1ZXJ5U2V0OyIsIi8qKlxuICogRm9yIHRob3NlIGZhbWlsaWFyIHdpdGggQXBwbGUncyBDb2NvYSBsaWJyYXJ5LCByZWFjdGl2ZSBxdWVyaWVzIHJvdWdobHkgbWFwIG9udG8gTlNGZXRjaGVkUmVzdWx0c0NvbnRyb2xsZXIuXG4gKlxuICogVGhleSBwcmVzZW50IGEgcXVlcnkgc2V0IHRoYXQgJ3JlYWN0cycgdG8gY2hhbmdlcyBpbiB0aGUgdW5kZXJseWluZyBkYXRhLlxuICogQG1vZHVsZSByZWFjdGl2ZVF1ZXJ5XG4gKi9cblxuXG4oZnVuY3Rpb24oKSB7XG5cbiAgdmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJykoJ3F1ZXJ5OnJlYWN0aXZlJyksXG4gICAgUXVlcnkgPSByZXF1aXJlKCcuL1F1ZXJ5JyksXG4gICAgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyLFxuICAgIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gICAgQ2hhaW4gPSByZXF1aXJlKCcuL0NoYWluJyksXG4gICAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgIGNvbnN0cnVjdFF1ZXJ5U2V0ID0gcmVxdWlyZSgnLi9RdWVyeVNldCcpLFxuICAgIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcblxuICAvKipcbiAgICpcbiAgICogQHBhcmFtIHtRdWVyeX0gcXVlcnkgLSBUaGUgdW5kZXJseWluZyBxdWVyeVxuICAgKiBAY29uc3RydWN0b3JcbiAgICovXG4gIGZ1bmN0aW9uIFJlYWN0aXZlUXVlcnkocXVlcnkpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgRXZlbnRFbWl0dGVyLmNhbGwodGhpcyk7XG4gICAgQ2hhaW4uY2FsbCh0aGlzKTtcbiAgICB1dGlsLmV4dGVuZCh0aGlzLCB7XG4gICAgICBpbnNlcnRpb25Qb2xpY3k6IFJlYWN0aXZlUXVlcnkuSW5zZXJ0aW9uUG9saWN5LkJhY2ssXG4gICAgICBpbml0aWFsaXNlZDogZmFsc2VcbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAncXVlcnknLCB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcXVlcnlcbiAgICAgIH0sXG4gICAgICBzZXQ6IGZ1bmN0aW9uKHYpIHtcbiAgICAgICAgaWYgKHYpIHtcbiAgICAgICAgICB0aGlzLl9xdWVyeSA9IHY7XG4gICAgICAgICAgdGhpcy5yZXN1bHRzID0gY29uc3RydWN0UXVlcnlTZXQoW10sIHYubW9kZWwpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIHRoaXMuX3F1ZXJ5ID0gbnVsbDtcbiAgICAgICAgICB0aGlzLnJlc3VsdHMgPSBudWxsO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgY29uZmlndXJhYmxlOiBmYWxzZSxcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9KTtcblxuICAgIGlmIChxdWVyeSkge1xuICAgICAgdXRpbC5leHRlbmQodGhpcywge1xuICAgICAgICBfcXVlcnk6IHF1ZXJ5LFxuICAgICAgICByZXN1bHRzOiBjb25zdHJ1Y3RRdWVyeVNldChbXSwgcXVlcnkubW9kZWwpXG4gICAgICB9KVxuICAgIH1cblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHRoaXMsIHtcbiAgICAgIGluaXRpYWxpemVkOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuaW5pdGlhbGlzZWRcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIG1vZGVsOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIHF1ZXJ5ID0gc2VsZi5fcXVlcnk7XG4gICAgICAgICAgaWYgKHF1ZXJ5KSB7XG4gICAgICAgICAgICByZXR1cm4gcXVlcnkubW9kZWxcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBjb2xsZWN0aW9uOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuIHNlbGYubW9kZWwuY29sbGVjdGlvbk5hbWVcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG5cbiAgfVxuXG4gIFJlYWN0aXZlUXVlcnkucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShFdmVudEVtaXR0ZXIucHJvdG90eXBlKTtcbiAgdXRpbC5leHRlbmQoUmVhY3RpdmVRdWVyeS5wcm90b3R5cGUsIENoYWluLnByb3RvdHlwZSk7XG5cbiAgdXRpbC5leHRlbmQoUmVhY3RpdmVRdWVyeSwge1xuICAgIEluc2VydGlvblBvbGljeToge1xuICAgICAgRnJvbnQ6ICdGcm9udCcsXG4gICAgICBCYWNrOiAnQmFjaydcbiAgICB9XG4gIH0pO1xuXG4gIHV0aWwuZXh0ZW5kKFJlYWN0aXZlUXVlcnkucHJvdG90eXBlLCB7XG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0gY2JcbiAgICAgKiBAcGFyYW0ge2Jvb2x9IF9pZ25vcmVJbml0IC0gZXhlY3V0ZSBxdWVyeSBhZ2FpbiwgaW5pdGlhbGlzZWQgb3Igbm90LlxuICAgICAqIEByZXR1cm5zIHsqfVxuICAgICAqL1xuICAgIGluaXQ6IGZ1bmN0aW9uKGNiLCBfaWdub3JlSW5pdCkge1xuICAgICAgaWYgKHRoaXMuX3F1ZXJ5KSB7XG4gICAgICAgIGlmIChsb2cpIGxvZygnaW5pdCcpO1xuICAgICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgICAgIGlmICgoIXRoaXMuaW5pdGlhbGlzZWQpIHx8IF9pZ25vcmVJbml0KSB7XG4gICAgICAgICAgICB0aGlzLl9xdWVyeS5leGVjdXRlKGZ1bmN0aW9uKGVyciwgcmVzdWx0cykge1xuICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgIGNiKG51bGwsIHRoaXMuX2FwcGx5UmVzdWx0cyhyZXN1bHRzKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgY2IoZXJyKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjYihudWxsLCB0aGlzLnJlc3VsdHMpO1xuICAgICAgICAgIH1cbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgIH1cbiAgICAgIGVsc2UgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ05vIF9xdWVyeSBkZWZpbmVkJyk7XG4gICAgfSxcbiAgICBfYXBwbHlSZXN1bHRzOiBmdW5jdGlvbihyZXN1bHRzKSB7XG4gICAgICB0aGlzLnJlc3VsdHMgPSByZXN1bHRzO1xuICAgICAgaWYgKCF0aGlzLmhhbmRsZXIpIHtcbiAgICAgICAgdmFyIG5hbWUgPSB0aGlzLl9jb25zdHJ1Y3ROb3RpZmljYXRpb25OYW1lKCk7XG4gICAgICAgIHZhciBoYW5kbGVyID0gZnVuY3Rpb24obikge1xuICAgICAgICAgIHRoaXMuX2hhbmRsZU5vdGlmKG4pO1xuICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuaGFuZGxlciA9IGhhbmRsZXI7XG4gICAgICAgIGV2ZW50cy5vbihuYW1lLCBoYW5kbGVyKTtcbiAgICAgIH1cbiAgICAgIGxvZygnTGlzdGVuaW5nIHRvICcgKyBuYW1lKTtcbiAgICAgIHRoaXMuaW5pdGlhbGlzZWQgPSB0cnVlO1xuICAgICAgcmV0dXJuIHRoaXMucmVzdWx0cztcbiAgICB9LFxuICAgIGluc2VydDogZnVuY3Rpb24obmV3T2JqKSB7XG4gICAgICB2YXIgcmVzdWx0cyA9IHRoaXMucmVzdWx0cy5tdXRhYmxlQ29weSgpO1xuICAgICAgaWYgKHRoaXMuaW5zZXJ0aW9uUG9saWN5ID09IFJlYWN0aXZlUXVlcnkuSW5zZXJ0aW9uUG9saWN5LkJhY2spIHZhciBpZHggPSByZXN1bHRzLnB1c2gobmV3T2JqKTtcbiAgICAgIGVsc2UgaWR4ID0gcmVzdWx0cy51bnNoaWZ0KG5ld09iaik7XG4gICAgICB0aGlzLnJlc3VsdHMgPSByZXN1bHRzLmFzTW9kZWxRdWVyeVNldCh0aGlzLm1vZGVsKTtcbiAgICAgIHJldHVybiBpZHg7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBFeGVjdXRlIHRoZSB1bmRlcmx5aW5nIHF1ZXJ5IGFnYWluLlxuICAgICAqIEBwYXJhbSBjYlxuICAgICAqL1xuICAgIHVwZGF0ZTogZnVuY3Rpb24oY2IpIHtcbiAgICAgIHJldHVybiB0aGlzLmluaXQoY2IsIHRydWUpXG4gICAgfSxcbiAgICBfaGFuZGxlTm90aWY6IGZ1bmN0aW9uKG4pIHtcbiAgICAgIGxvZygnX2hhbmRsZU5vdGlmJywgbik7XG4gICAgICBpZiAobi50eXBlID09IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLk5ldykge1xuICAgICAgICB2YXIgbmV3T2JqID0gbi5uZXc7XG4gICAgICAgIGlmICh0aGlzLl9xdWVyeS5vYmplY3RNYXRjaGVzUXVlcnkobmV3T2JqKSkge1xuICAgICAgICAgIGxvZygnTmV3IG9iamVjdCBtYXRjaGVzJywgbmV3T2JqKTtcbiAgICAgICAgICB2YXIgaWR4ID0gdGhpcy5pbnNlcnQobmV3T2JqKTtcbiAgICAgICAgICB0aGlzLmVtaXQobW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLCB7XG4gICAgICAgICAgICBpbmRleDogaWR4LFxuICAgICAgICAgICAgYWRkZWQ6IFtuZXdPYmpdLFxuICAgICAgICAgICAgdHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgb2JqOiB0aGlzXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgbG9nKCdOZXcgb2JqZWN0IGRvZXMgbm90IG1hdGNoJywgbmV3T2JqKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZWxzZSBpZiAobi50eXBlID09IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNldCkge1xuICAgICAgICBuZXdPYmogPSBuLm9iajtcbiAgICAgICAgdmFyIGluZGV4ID0gdGhpcy5yZXN1bHRzLmluZGV4T2YobmV3T2JqKSxcbiAgICAgICAgICBhbHJlYWR5Q29udGFpbnMgPSBpbmRleCA+IC0xLFxuICAgICAgICAgIG1hdGNoZXMgPSB0aGlzLl9xdWVyeS5vYmplY3RNYXRjaGVzUXVlcnkobmV3T2JqKTtcbiAgICAgICAgaWYgKG1hdGNoZXMgJiYgIWFscmVhZHlDb250YWlucykge1xuICAgICAgICAgIGxvZygnVXBkYXRlZCBvYmplY3Qgbm93IG1hdGNoZXMhJywgbmV3T2JqKTtcbiAgICAgICAgICBpZHggPSB0aGlzLmluc2VydChuZXdPYmopO1xuICAgICAgICAgIHRoaXMuZW1pdChtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5TcGxpY2UsIHtcbiAgICAgICAgICAgIGluZGV4OiBpZHgsXG4gICAgICAgICAgICBhZGRlZDogW25ld09ial0sXG4gICAgICAgICAgICB0eXBlOiBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgICAgICAgICBvYmo6IHRoaXNcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICghbWF0Y2hlcyAmJiBhbHJlYWR5Q29udGFpbnMpIHtcbiAgICAgICAgICBsb2coJ1VwZGF0ZWQgb2JqZWN0IG5vIGxvbmdlciBtYXRjaGVzIScsIG5ld09iaik7XG4gICAgICAgICAgcmVzdWx0cyA9IHRoaXMucmVzdWx0cy5tdXRhYmxlQ29weSgpO1xuICAgICAgICAgIHZhciByZW1vdmVkID0gcmVzdWx0cy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgIHRoaXMucmVzdWx0cyA9IHJlc3VsdHMuYXNNb2RlbFF1ZXJ5U2V0KHRoaXMubW9kZWwpO1xuICAgICAgICAgIHRoaXMuZW1pdChtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5TcGxpY2UsIHtcbiAgICAgICAgICAgIGluZGV4OiBpbmRleCxcbiAgICAgICAgICAgIG9iajogdGhpcyxcbiAgICAgICAgICAgIG5ldzogbmV3T2JqLFxuICAgICAgICAgICAgdHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgcmVtb3ZlZDogcmVtb3ZlZFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKCFtYXRjaGVzICYmICFhbHJlYWR5Q29udGFpbnMpIHtcbiAgICAgICAgICBsb2coJ0RvZXMgbm90IGNvbnRhaW4sIGJ1dCBkb2VzbnQgbWF0Y2ggc28gbm90IGluc2VydGluZycsIG5ld09iaik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAobWF0Y2hlcyAmJiBhbHJlYWR5Q29udGFpbnMpIHtcbiAgICAgICAgICBsb2coJ01hdGNoZXMgYnV0IGFscmVhZHkgY29udGFpbnMnLCBuZXdPYmopO1xuICAgICAgICAgIC8vIFNlbmQgdGhlIG5vdGlmaWNhdGlvbiBvdmVyLlxuICAgICAgICAgIHRoaXMuZW1pdChuLnR5cGUsIG4pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBlbHNlIGlmIChuLnR5cGUgPT0gbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuUmVtb3ZlKSB7XG4gICAgICAgIG5ld09iaiA9IG4ub2JqO1xuICAgICAgICB2YXIgcmVzdWx0cyA9IHRoaXMucmVzdWx0cy5tdXRhYmxlQ29weSgpO1xuICAgICAgICBpbmRleCA9IHJlc3VsdHMuaW5kZXhPZihuZXdPYmopO1xuICAgICAgICBpZiAoaW5kZXggPiAtMSkge1xuICAgICAgICAgIGxvZygnUmVtb3Zpbmcgb2JqZWN0JywgbmV3T2JqKTtcbiAgICAgICAgICByZW1vdmVkID0gcmVzdWx0cy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgIHRoaXMucmVzdWx0cyA9IGNvbnN0cnVjdFF1ZXJ5U2V0KHJlc3VsdHMsIHRoaXMubW9kZWwpO1xuICAgICAgICAgIHRoaXMuZW1pdChtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5TcGxpY2UsIHtcbiAgICAgICAgICAgIGluZGV4OiBpbmRleCxcbiAgICAgICAgICAgIG9iajogdGhpcyxcbiAgICAgICAgICAgIHR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgIHJlbW92ZWQ6IHJlbW92ZWRcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBsb2coJ05vIG1vZGVsRXZlbnRzIG5lY2Nlc3NhcnkuJywgbmV3T2JqKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdVbmtub3duIGNoYW5nZSB0eXBlIFwiJyArIG4udHlwZS50b1N0cmluZygpICsgJ1wiJylcbiAgICAgIH1cbiAgICAgIHRoaXMucmVzdWx0cyA9IGNvbnN0cnVjdFF1ZXJ5U2V0KHRoaXMuX3F1ZXJ5Ll9zb3J0UmVzdWx0cyh0aGlzLnJlc3VsdHMpLCB0aGlzLm1vZGVsKTtcbiAgICB9LFxuICAgIF9jb25zdHJ1Y3ROb3RpZmljYXRpb25OYW1lOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLm1vZGVsLmNvbGxlY3Rpb25OYW1lICsgJzonICsgdGhpcy5tb2RlbC5uYW1lO1xuICAgIH0sXG4gICAgdGVybWluYXRlOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLmhhbmRsZXIpIHtcbiAgICAgICAgZXZlbnRzLnJlbW92ZUxpc3RlbmVyKHRoaXMuX2NvbnN0cnVjdE5vdGlmaWNhdGlvbk5hbWUoKSwgdGhpcy5oYW5kbGVyKTtcbiAgICAgIH1cbiAgICAgIHRoaXMucmVzdWx0cyA9IG51bGw7XG4gICAgICB0aGlzLmhhbmRsZXIgPSBudWxsO1xuICAgIH0sXG4gICAgX3JlZ2lzdGVyRXZlbnRIYW5kbGVyOiBmdW5jdGlvbihvbiwgbmFtZSwgZm4pIHtcbiAgICAgIHZhciByZW1vdmVMaXN0ZW5lciA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXI7XG4gICAgICBpZiAobmFtZS50cmltKCkgPT0gJyonKSB7XG4gICAgICAgIE9iamVjdC5rZXlzKG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlKS5mb3JFYWNoKGZ1bmN0aW9uKGspIHtcbiAgICAgICAgICBvbi5jYWxsKHRoaXMsIG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlW2tdLCBmbik7XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgb24uY2FsbCh0aGlzLCBuYW1lLCBmbik7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5fbGluayh7XG4gICAgICAgICAgb246IHRoaXMub24uYmluZCh0aGlzKSxcbiAgICAgICAgICBvbmNlOiB0aGlzLm9uY2UuYmluZCh0aGlzKSxcbiAgICAgICAgICB1cGRhdGU6IHRoaXMudXBkYXRlLmJpbmQodGhpcyksXG4gICAgICAgICAgaW5zZXJ0OiB0aGlzLmluc2VydC5iaW5kKHRoaXMpXG4gICAgICAgIH0sXG4gICAgICAgIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGlmIChuYW1lLnRyaW0oKSA9PSAnKicpIHtcbiAgICAgICAgICAgIE9iamVjdC5rZXlzKG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlKS5mb3JFYWNoKGZ1bmN0aW9uKGspIHtcbiAgICAgICAgICAgICAgcmVtb3ZlTGlzdGVuZXIuY2FsbCh0aGlzLCBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZVtrXSwgZm4pO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZW1vdmVMaXN0ZW5lci5jYWxsKHRoaXMsIG5hbWUsIGZuKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgfSxcbiAgICBvbjogZnVuY3Rpb24obmFtZSwgZm4pIHtcbiAgICAgIHJldHVybiB0aGlzLl9yZWdpc3RlckV2ZW50SGFuZGxlcihFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uLCBuYW1lLCBmbik7XG4gICAgfSxcbiAgICBvbmNlOiBmdW5jdGlvbihuYW1lLCBmbikge1xuICAgICAgcmV0dXJuIHRoaXMuX3JlZ2lzdGVyRXZlbnRIYW5kbGVyKEV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSwgbmFtZSwgZm4pO1xuICAgIH1cbiAgfSk7XG5cblxuICBtb2R1bGUuZXhwb3J0cyA9IFJlYWN0aXZlUXVlcnk7XG59KSgpOyIsIi8qKlxuICogQmFzZSBmdW5jdGlvbmFsaXR5IGZvciByZWxhdGlvbnNoaXBzLlxuICogQG1vZHVsZSByZWxhdGlvbnNoaXBzXG4gKi9cbihmdW5jdGlvbigpIHtcblxuICB2YXIgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICBRdWVyeSA9IHJlcXVpcmUoJy4vUXVlcnknKSxcbiAgICBsb2cgPSByZXF1aXJlKCcuL2xvZycpLFxuICAgIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpLFxuICAgIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gICAgd3JhcEFycmF5Rm9yQXR0cmlidXRlcyA9IGV2ZW50cy53cmFwQXJyYXksXG4gICAgQXJyYXlPYnNlcnZlciA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuQXJyYXlPYnNlcnZlcixcbiAgICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgICBNb2RlbEV2ZW50VHlwZSA9IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlO1xuXG4gIC8qKlxuICAgKiBAY2xhc3MgIFtSZWxhdGlvbnNoaXBQcm94eSBkZXNjcmlwdGlvbl1cbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdHNcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqL1xuICBmdW5jdGlvbiBSZWxhdGlvbnNoaXBQcm94eShvcHRzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuXG4gICAgdXRpbC5leHRlbmQodGhpcywge1xuICAgICAgb2JqZWN0OiBudWxsLFxuICAgICAgcmVsYXRlZDogbnVsbFxuICAgIH0pO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXModGhpcywge1xuICAgICAgaXNGb3J3YXJkOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuICFzZWxmLmlzUmV2ZXJzZTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbih2KSB7XG4gICAgICAgICAgc2VsZi5pc1JldmVyc2UgPSAhdjtcbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdXRpbC5leHRlbmRGcm9tT3B0cyh0aGlzLCBvcHRzLCB7XG4gICAgICByZXZlcnNlTW9kZWw6IG51bGwsXG4gICAgICBmb3J3YXJkTW9kZWw6IG51bGwsXG4gICAgICBmb3J3YXJkTmFtZTogbnVsbCxcbiAgICAgIHJldmVyc2VOYW1lOiBudWxsLFxuICAgICAgaXNSZXZlcnNlOiBudWxsLFxuICAgICAgc2VyaWFsaXNlOiBudWxsXG4gICAgfSwgZmFsc2UpO1xuXG4gICAgdGhpcy5jYW5jZWxMaXN0ZW5zID0ge307XG4gIH1cblxuICB1dGlsLmV4dGVuZChSZWxhdGlvbnNoaXBQcm94eSwge30pO1xuXG4gIHV0aWwuZXh0ZW5kKFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZSwge1xuICAgIC8qKlxuICAgICAqIEluc3RhbGwgdGhpcyBwcm94eSBvbiB0aGUgZ2l2ZW4gaW5zdGFuY2VcbiAgICAgKiBAcGFyYW0ge01vZGVsSW5zdGFuY2V9IG1vZGVsSW5zdGFuY2VcbiAgICAgKi9cbiAgICBpbnN0YWxsOiBmdW5jdGlvbihtb2RlbEluc3RhbmNlKSB7XG4gICAgICBpZiAobW9kZWxJbnN0YW5jZSkge1xuICAgICAgICBpZiAoIXRoaXMub2JqZWN0KSB7XG4gICAgICAgICAgdGhpcy5vYmplY3QgPSBtb2RlbEluc3RhbmNlO1xuICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICB2YXIgbmFtZSA9IHRoaXMuZ2V0Rm9yd2FyZE5hbWUoKTtcbiAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobW9kZWxJbnN0YW5jZSwgbmFtZSwge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHNlbGYucmVsYXRlZDtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzZXQ6IGZ1bmN0aW9uKHYpIHtcbiAgICAgICAgICAgICAgc2VsZi5zZXQodik7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGlmICghbW9kZWxJbnN0YW5jZS5fX3Byb3hpZXMpIG1vZGVsSW5zdGFuY2UuX19wcm94aWVzID0ge307XG4gICAgICAgICAgbW9kZWxJbnN0YW5jZS5fX3Byb3hpZXNbbmFtZV0gPSB0aGlzO1xuICAgICAgICAgIGlmICghbW9kZWxJbnN0YW5jZS5fcHJveGllcykge1xuICAgICAgICAgICAgbW9kZWxJbnN0YW5jZS5fcHJveGllcyA9IFtdO1xuICAgICAgICAgIH1cbiAgICAgICAgICBtb2RlbEluc3RhbmNlLl9wcm94aWVzLnB1c2godGhpcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ0FscmVhZHkgaW5zdGFsbGVkLicpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gb2JqZWN0IHBhc3NlZCB0byByZWxhdGlvbnNoaXAgaW5zdGFsbCcpO1xuICAgICAgfVxuICAgIH1cblxuICB9KTtcblxuICAvL25vaW5zcGVjdGlvbiBKU1VudXNlZExvY2FsU3ltYm9sc1xuICB1dGlsLmV4dGVuZChSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUsIHtcbiAgICBzZXQ6IGZ1bmN0aW9uKG9iaiwgb3B0cykge1xuICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ011c3Qgc3ViY2xhc3MgUmVsYXRpb25zaGlwUHJveHknKTtcbiAgICB9LFxuICAgIGdldDogZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNdXN0IHN1YmNsYXNzIFJlbGF0aW9uc2hpcFByb3h5Jyk7XG4gICAgfVxuICB9KTtcblxuICB1dGlsLmV4dGVuZChSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUsIHtcbiAgICBwcm94eUZvckluc3RhbmNlOiBmdW5jdGlvbihtb2RlbEluc3RhbmNlLCByZXZlcnNlKSB7XG4gICAgICB2YXIgbmFtZSA9IHJldmVyc2UgPyB0aGlzLmdldFJldmVyc2VOYW1lKCkgOiB0aGlzLmdldEZvcndhcmROYW1lKCksXG4gICAgICAgIG1vZGVsID0gcmV2ZXJzZSA/IHRoaXMucmV2ZXJzZU1vZGVsIDogdGhpcy5mb3J3YXJkTW9kZWw7XG4gICAgICB2YXIgcmV0O1xuICAgICAgLy8gVGhpcyBzaG91bGQgbmV2ZXIgaGFwcGVuLiBTaG91bGQgZyAgIGV0IGNhdWdodCBpbiB0aGUgbWFwcGluZyBvcGVyYXRpb24/XG4gICAgICBpZiAodXRpbC5pc0FycmF5KG1vZGVsSW5zdGFuY2UpKSB7XG4gICAgICAgIHJldCA9IG1vZGVsSW5zdGFuY2UubWFwKGZ1bmN0aW9uKG8pIHtcbiAgICAgICAgICByZXR1cm4gby5fX3Byb3hpZXNbbmFtZV07XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIHByb3hpZXMgPSBtb2RlbEluc3RhbmNlLl9fcHJveGllcztcbiAgICAgICAgaWYgKCFwcm94aWVzKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcignbW9kZWxJbnN0YW5jY2UnLCBtb2RlbEluc3RhbmNlKTtcbiAgICAgICAgICB0aHJvdyAnaGVscCBtZSc7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHByb3h5ID0gcHJveGllc1tuYW1lXTtcbiAgICAgICAgaWYgKCFwcm94eSkge1xuICAgICAgICAgIHZhciBlcnIgPSAnTm8gcHJveHkgd2l0aCBuYW1lIFwiJyArIG5hbWUgKyAnXCIgb24gbWFwcGluZyAnICsgbW9kZWwubmFtZTtcbiAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihlcnIpO1xuICAgICAgICB9XG4gICAgICAgIHJldCA9IHByb3h5O1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJldDtcbiAgICB9LFxuICAgIHJldmVyc2VQcm94eUZvckluc3RhbmNlOiBmdW5jdGlvbihtb2RlbEluc3RhbmNlKSB7XG4gICAgICByZXR1cm4gdGhpcy5wcm94eUZvckluc3RhbmNlKG1vZGVsSW5zdGFuY2UsIHRydWUpO1xuICAgIH0sXG4gICAgZ2V0UmV2ZXJzZU5hbWU6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuaXNGb3J3YXJkID8gdGhpcy5yZXZlcnNlTmFtZSA6IHRoaXMuZm9yd2FyZE5hbWU7XG4gICAgfSxcbiAgICBnZXRGb3J3YXJkTmFtZTogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5pc0ZvcndhcmQgPyB0aGlzLmZvcndhcmROYW1lIDogdGhpcy5yZXZlcnNlTmFtZTtcbiAgICB9LFxuICAgIGdldEZvcndhcmRNb2RlbDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5pc0ZvcndhcmQgPyB0aGlzLmZvcndhcmRNb2RlbCA6IHRoaXMucmV2ZXJzZU1vZGVsO1xuICAgIH0sXG4gICAgY2xlYXJSZW1vdmFsTGlzdGVuZXI6IGZ1bmN0aW9uKG9iaikge1xuICAgICAgdmFyIGxvY2FsSWQgPSBvYmoubG9jYWxJZDtcbiAgICAgIHZhciBjYW5jZWxMaXN0ZW4gPSB0aGlzLmNhbmNlbExpc3RlbnNbbG9jYWxJZF07XG4gICAgICAvLyBUT0RPOiBSZW1vdmUgdGhpcyBjaGVjay4gY2FuY2VsTGlzdGVuIHNob3VsZCBhbHdheXMgZXhpc3RcbiAgICAgIGlmIChjYW5jZWxMaXN0ZW4pIHtcbiAgICAgICAgY2FuY2VsTGlzdGVuKCk7XG4gICAgICAgIHRoaXMuY2FuY2VsTGlzdGVuc1tsb2NhbElkXSA9IG51bGw7XG4gICAgICB9XG4gICAgfSxcbiAgICBsaXN0ZW5Gb3JSZW1vdmFsOiBmdW5jdGlvbihvYmopIHtcbiAgICAgIHRoaXMuY2FuY2VsTGlzdGVuc1tvYmoubG9jYWxJZF0gPSBvYmoub24oJyonLCBmdW5jdGlvbihlKSB7XG4gICAgICAgIGlmIChlLnR5cGUgPT0gTW9kZWxFdmVudFR5cGUuUmVtb3ZlKSB7XG4gICAgICAgICAgaWYgKHV0aWwuaXNBcnJheSh0aGlzLnJlbGF0ZWQpKSB7XG4gICAgICAgICAgICB2YXIgaWR4ID0gdGhpcy5yZWxhdGVkLmluZGV4T2Yob2JqKTtcbiAgICAgICAgICAgIHRoaXMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5zZXRJZEFuZFJlbGF0ZWQobnVsbCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuY2xlYXJSZW1vdmFsTGlzdGVuZXIob2JqKTtcbiAgICAgICAgfVxuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIENvbmZpZ3VyZSBfaWQgYW5kIHJlbGF0ZWQgd2l0aCB0aGUgbmV3IHJlbGF0ZWQgb2JqZWN0LlxuICAgICAqIEBwYXJhbSBvYmpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdHNdXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0cy5kaXNhYmxlTm90aWZpY2F0aW9uc11cbiAgICAgKiBAcmV0dXJucyB7U3RyaW5nfHVuZGVmaW5lZH0gLSBFcnJvciBtZXNzYWdlIG9yIHVuZGVmaW5lZFxuICAgICAqL1xuICAgIHNldElkQW5kUmVsYXRlZDogZnVuY3Rpb24ob2JqLCBvcHRzKSB7XG4gICAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICAgIGlmICghb3B0cy5kaXNhYmxlZXZlbnRzKSB2YXIgb2xkVmFsdWUgPSB0aGlzLl9nZXRPbGRWYWx1ZUZvclNldENoYW5nZUV2ZW50KCk7XG4gICAgICB2YXIgcHJldmlvdXNseVJlbGF0ZWQgPSB0aGlzLnJlbGF0ZWQ7XG4gICAgICBpZiAocHJldmlvdXNseVJlbGF0ZWQpIHRoaXMuY2xlYXJSZW1vdmFsTGlzdGVuZXIocHJldmlvdXNseVJlbGF0ZWQpO1xuICAgICAgaWYgKG9iaikge1xuICAgICAgICBpZiAodXRpbC5pc0FycmF5KG9iaikpIHtcbiAgICAgICAgICB0aGlzLnJlbGF0ZWQgPSBvYmo7XG4gICAgICAgICAgb2JqLmZvckVhY2goZnVuY3Rpb24oX29iaikge1xuICAgICAgICAgICAgdGhpcy5saXN0ZW5Gb3JSZW1vdmFsKF9vYmopO1xuICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5yZWxhdGVkID0gb2JqO1xuICAgICAgICAgIHRoaXMubGlzdGVuRm9yUmVtb3ZhbChvYmopO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgdGhpcy5yZWxhdGVkID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIGlmICghb3B0cy5kaXNhYmxlZXZlbnRzKSB0aGlzLnJlZ2lzdGVyU2V0Q2hhbmdlKG9iaiwgb2xkVmFsdWUpO1xuICAgIH0sXG4gICAgY2hlY2tJbnN0YWxsZWQ6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKCF0aGlzLm9iamVjdCkge1xuICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignUHJveHkgbXVzdCBiZSBpbnN0YWxsZWQgb24gYW4gb2JqZWN0IGJlZm9yZSBjYW4gdXNlIGl0LicpO1xuICAgICAgfVxuICAgIH0sXG4gICAgc3BsaWNlcjogZnVuY3Rpb24ob3B0cykge1xuICAgICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgICByZXR1cm4gZnVuY3Rpb24oaWR4LCBudW1SZW1vdmUpIHtcbiAgICAgICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgICAgIGlmICghb3B0cy5kaXNhYmxlZXZlbnRzKSB7XG4gICAgICAgICAgdmFyIGFkZGVkID0gdGhpcy5fZ2V0QWRkZWRGb3JTcGxpY2VDaGFuZ2VFdmVudChhcmd1bWVudHMpLFxuICAgICAgICAgICAgcmVtb3ZlZCA9IHRoaXMuX2dldFJlbW92ZWRGb3JTcGxpY2VDaGFuZ2VFdmVudChpZHgsIG51bVJlbW92ZSk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGFkZCA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgICAgIHZhciByZXMgPSB0aGlzLnJlbGF0ZWQuc3BsaWNlLmJpbmQodGhpcy5yZWxhdGVkLCBpZHgsIG51bVJlbW92ZSkuYXBwbHkodGhpcy5yZWxhdGVkLCBhZGQpO1xuICAgICAgICBpZiAoIW9wdHMuZGlzYWJsZWV2ZW50cykgdGhpcy5yZWdpc3RlclNwbGljZUNoYW5nZShpZHgsIGFkZGVkLCByZW1vdmVkKTtcbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICAgIH0uYmluZCh0aGlzKTtcbiAgICB9LFxuICAgIGNsZWFyUmV2ZXJzZVJlbGF0ZWQ6IGZ1bmN0aW9uKG9wdHMpIHtcbiAgICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgaWYgKHRoaXMucmVsYXRlZCkge1xuICAgICAgICB2YXIgcmV2ZXJzZVByb3h5ID0gdGhpcy5yZXZlcnNlUHJveHlGb3JJbnN0YW5jZSh0aGlzLnJlbGF0ZWQpO1xuICAgICAgICB2YXIgcmV2ZXJzZVByb3hpZXMgPSB1dGlsLmlzQXJyYXkocmV2ZXJzZVByb3h5KSA/IHJldmVyc2VQcm94eSA6IFtyZXZlcnNlUHJveHldO1xuICAgICAgICByZXZlcnNlUHJveGllcy5mb3JFYWNoKGZ1bmN0aW9uKHApIHtcbiAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KHAucmVsYXRlZCkpIHtcbiAgICAgICAgICAgIHZhciBpZHggPSBwLnJlbGF0ZWQuaW5kZXhPZihzZWxmLm9iamVjdCk7XG4gICAgICAgICAgICBwLm1ha2VDaGFuZ2VzVG9SZWxhdGVkV2l0aG91dE9ic2VydmF0aW9ucyhmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgcC5zcGxpY2VyKG9wdHMpKGlkeCwgMSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcC5zZXRJZEFuZFJlbGF0ZWQobnVsbCwgb3B0cyk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9LFxuICAgIHNldElkQW5kUmVsYXRlZFJldmVyc2U6IGZ1bmN0aW9uKG9iaiwgb3B0cykge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgdmFyIHJldmVyc2VQcm94eSA9IHRoaXMucmV2ZXJzZVByb3h5Rm9ySW5zdGFuY2Uob2JqKTtcbiAgICAgIHZhciByZXZlcnNlUHJveGllcyA9IHV0aWwuaXNBcnJheShyZXZlcnNlUHJveHkpID8gcmV2ZXJzZVByb3h5IDogW3JldmVyc2VQcm94eV07XG4gICAgICByZXZlcnNlUHJveGllcy5mb3JFYWNoKGZ1bmN0aW9uKHApIHtcbiAgICAgICAgaWYgKHV0aWwuaXNBcnJheShwLnJlbGF0ZWQpKSB7XG4gICAgICAgICAgcC5tYWtlQ2hhbmdlc1RvUmVsYXRlZFdpdGhvdXRPYnNlcnZhdGlvbnMoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBwLnNwbGljZXIob3B0cykocC5yZWxhdGVkLmxlbmd0aCwgMCwgc2VsZi5vYmplY3QpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHAuY2xlYXJSZXZlcnNlUmVsYXRlZChvcHRzKTtcbiAgICAgICAgICBwLnNldElkQW5kUmVsYXRlZChzZWxmLm9iamVjdCwgb3B0cyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0sXG4gICAgbWFrZUNoYW5nZXNUb1JlbGF0ZWRXaXRob3V0T2JzZXJ2YXRpb25zOiBmdW5jdGlvbihmKSB7XG4gICAgICBpZiAodGhpcy5yZWxhdGVkKSB7XG4gICAgICAgIHRoaXMucmVsYXRlZC5hcnJheU9ic2VydmVyLmNsb3NlKCk7XG4gICAgICAgIHRoaXMucmVsYXRlZC5hcnJheU9ic2VydmVyID0gbnVsbDtcbiAgICAgICAgZigpO1xuICAgICAgICB0aGlzLndyYXBBcnJheSh0aGlzLnJlbGF0ZWQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZigpO1xuICAgICAgfVxuICAgIH0sXG4gICAgLyoqXG4gICAgICogR2V0IG9sZCB2YWx1ZSB0aGF0IGlzIHNlbnQgb3V0IGluIGVtaXNzaW9ucy5cbiAgICAgKiBAcmV0dXJucyB7Kn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9nZXRPbGRWYWx1ZUZvclNldENoYW5nZUV2ZW50OiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBvbGRWYWx1ZSA9IHRoaXMucmVsYXRlZDtcbiAgICAgIGlmICh1dGlsLmlzQXJyYXkob2xkVmFsdWUpICYmICFvbGRWYWx1ZS5sZW5ndGgpIHtcbiAgICAgICAgb2xkVmFsdWUgPSBudWxsO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG9sZFZhbHVlO1xuICAgIH0sXG4gICAgcmVnaXN0ZXJTZXRDaGFuZ2U6IGZ1bmN0aW9uKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgdmFyIHByb3h5T2JqZWN0ID0gdGhpcy5vYmplY3Q7XG4gICAgICBpZiAoIXByb3h5T2JqZWN0KSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignUHJveHkgbXVzdCBoYXZlIGFuIG9iamVjdCBhc3NvY2lhdGVkJyk7XG4gICAgICB2YXIgbW9kZWwgPSBwcm94eU9iamVjdC5tb2RlbC5uYW1lO1xuICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gcHJveHlPYmplY3QuY29sbGVjdGlvbk5hbWU7XG4gICAgICAvLyBXZSB0YWtlIFtdID09IG51bGwgPT0gdW5kZWZpbmVkIGluIHRoZSBjYXNlIG9mIHJlbGF0aW9uc2hpcHMuXG4gICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgY29sbGVjdGlvbjogY29sbGVjdGlvbk5hbWUsXG4gICAgICAgIG1vZGVsOiBtb2RlbCxcbiAgICAgICAgbG9jYWxJZDogcHJveHlPYmplY3QubG9jYWxJZCxcbiAgICAgICAgZmllbGQ6IHRoaXMuZ2V0Rm9yd2FyZE5hbWUoKSxcbiAgICAgICAgb2xkOiBvbGRWYWx1ZSxcbiAgICAgICAgbmV3OiBuZXdWYWx1ZSxcbiAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU2V0LFxuICAgICAgICBvYmo6IHByb3h5T2JqZWN0XG4gICAgICB9KTtcbiAgICB9LFxuXG4gICAgX2dldFJlbW92ZWRGb3JTcGxpY2VDaGFuZ2VFdmVudDogZnVuY3Rpb24oaWR4LCBudW1SZW1vdmUpIHtcbiAgICAgIHZhciByZW1vdmVkID0gdGhpcy5yZWxhdGVkID8gdGhpcy5yZWxhdGVkLnNsaWNlKGlkeCwgaWR4ICsgbnVtUmVtb3ZlKSA6IG51bGw7XG4gICAgICByZXR1cm4gcmVtb3ZlZDtcbiAgICB9LFxuXG4gICAgX2dldEFkZGVkRm9yU3BsaWNlQ2hhbmdlRXZlbnQ6IGZ1bmN0aW9uKGFyZ3MpIHtcbiAgICAgIHZhciBhZGQgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmdzLCAyKSxcbiAgICAgICAgYWRkZWQgPSBhZGQubGVuZ3RoID8gYWRkIDogW107XG4gICAgICByZXR1cm4gYWRkZWQ7XG4gICAgfSxcblxuICAgIHJlZ2lzdGVyU3BsaWNlQ2hhbmdlOiBmdW5jdGlvbihpZHgsIGFkZGVkLCByZW1vdmVkKSB7XG4gICAgICB2YXIgbW9kZWwgPSB0aGlzLm9iamVjdC5tb2RlbC5uYW1lLFxuICAgICAgICBjb2xsID0gdGhpcy5vYmplY3QuY29sbGVjdGlvbk5hbWU7XG4gICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgY29sbGVjdGlvbjogY29sbCxcbiAgICAgICAgbW9kZWw6IG1vZGVsLFxuICAgICAgICBsb2NhbElkOiB0aGlzLm9iamVjdC5sb2NhbElkLFxuICAgICAgICBmaWVsZDogdGhpcy5nZXRGb3J3YXJkTmFtZSgpLFxuICAgICAgICBpbmRleDogaWR4LFxuICAgICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgICAgICBhZGRlZDogYWRkZWQsXG4gICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgb2JqOiB0aGlzLm9iamVjdFxuICAgICAgfSk7XG4gICAgfSxcbiAgICB3cmFwQXJyYXk6IGZ1bmN0aW9uKGFycikge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgd3JhcEFycmF5Rm9yQXR0cmlidXRlcyhhcnIsIHRoaXMucmV2ZXJzZU5hbWUsIHRoaXMub2JqZWN0KTtcbiAgICAgIGlmICghYXJyLmFycmF5T2JzZXJ2ZXIpIHtcbiAgICAgICAgYXJyLmFycmF5T2JzZXJ2ZXIgPSBuZXcgQXJyYXlPYnNlcnZlcihhcnIpO1xuICAgICAgICB2YXIgb2JzZXJ2ZXJGdW5jdGlvbiA9IGZ1bmN0aW9uKHNwbGljZXMpIHtcbiAgICAgICAgICBzcGxpY2VzLmZvckVhY2goZnVuY3Rpb24oc3BsaWNlKSB7XG4gICAgICAgICAgICB2YXIgYWRkZWQgPSBzcGxpY2UuYWRkZWRDb3VudCA/IGFyci5zbGljZShzcGxpY2UuaW5kZXgsIHNwbGljZS5pbmRleCArIHNwbGljZS5hZGRlZENvdW50KSA6IFtdO1xuICAgICAgICAgICAgdmFyIG1vZGVsID0gc2VsZi5nZXRGb3J3YXJkTW9kZWwoKTtcbiAgICAgICAgICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBtb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgbW9kZWw6IG1vZGVsLm5hbWUsXG4gICAgICAgICAgICAgIGxvY2FsSWQ6IHNlbGYub2JqZWN0LmxvY2FsSWQsXG4gICAgICAgICAgICAgIGZpZWxkOiBzZWxmLmdldEZvcndhcmROYW1lKCksXG4gICAgICAgICAgICAgIHJlbW92ZWQ6IHNwbGljZS5yZW1vdmVkLFxuICAgICAgICAgICAgICBhZGRlZDogYWRkZWQsXG4gICAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgICAgb2JqOiBzZWxmLm9iamVjdFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgICAgIGFyci5hcnJheU9ic2VydmVyLm9wZW4ob2JzZXJ2ZXJGdW5jdGlvbik7XG4gICAgICB9XG4gICAgfSxcbiAgICBzcGxpY2U6IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5zcGxpY2VyKHt9KS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cblxuICB9KTtcblxuXG4gIG1vZHVsZS5leHBvcnRzID0gUmVsYXRpb25zaGlwUHJveHk7XG5cblxufSkoKTsiLCIoZnVuY3Rpb24gKCkge1xuICAgIG1vZHVsZS5leHBvcnRzID0ge1xuICAgICAgICBPbmVUb01hbnk6ICdPbmVUb01hbnknLFxuICAgICAgICBPbmVUb09uZTogJ09uZVRvT25lJyxcbiAgICAgICAgTWFueVRvTWFueTogJ01hbnlUb01hbnknXG4gICAgfTtcbn0pKCk7IiwiLyoqXG4gKiBUaGlzIGlzIGFuIGluLW1lbW9yeSBjYWNoZSBmb3IgbW9kZWxzLiBNb2RlbHMgYXJlIGNhY2hlZCBieSBsb2NhbCBpZCAoX2lkKSBhbmQgcmVtb3RlIGlkIChkZWZpbmVkIGJ5IHRoZSBtYXBwaW5nKS5cbiAqIExvb2t1cHMgYXJlIHBlcmZvcm1lZCBhZ2FpbnN0IHRoZSBjYWNoZSB3aGVuIG1hcHBpbmcuXG4gKiBAbW9kdWxlIGNhY2hlXG4gKi9cbihmdW5jdGlvbigpIHtcblxuICB2YXIgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSgnY2FjaGUnKSxcbiAgICBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpO1xuXG5cbiAgdmFyIGxvY2FsQ2FjaGVCeUlkID0ge30sXG4gICAgbG9jYWxDYWNoZSA9IHt9LFxuICAgIHJlbW90ZUNhY2hlID0ge307XG5cbiAgLyoqXG4gICAqIENsZWFyIG91dCB0aGUgY2FjaGUuXG4gICAqL1xuICBmdW5jdGlvbiByZXNldCgpIHtcbiAgICByZW1vdGVDYWNoZSA9IHt9O1xuICAgIGxvY2FsQ2FjaGVCeUlkID0ge307XG4gICAgbG9jYWxDYWNoZSA9IHt9O1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiB0aGUgb2JqZWN0IGluIHRoZSBjYWNoZSBnaXZlbiBhIGxvY2FsIGlkIChfaWQpXG4gICAqIEBwYXJhbSAge1N0cmluZ3xBcnJheX0gbG9jYWxJZFxuICAgKiBAcmV0dXJuIHtNb2RlbEluc3RhbmNlfVxuICAgKi9cbiAgZnVuY3Rpb24gZ2V0VmlhTG9jYWxJZChsb2NhbElkKSB7XG4gICAgaWYgKHV0aWwuaXNBcnJheShsb2NhbElkKSkgcmV0dXJuIGxvY2FsSWQubWFwKGZ1bmN0aW9uKHgpIHtyZXR1cm4gbG9jYWxDYWNoZUJ5SWRbeF19KTtcbiAgICBlbHNlIHJldHVybiBsb2NhbENhY2hlQnlJZFtsb2NhbElkXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gdGhlIHNpbmdsZXRvbiBvYmplY3QgZ2l2ZW4gYSBzaW5nbGV0b24gbW9kZWwuXG4gICAqIEBwYXJhbSAge01vZGVsfSBtb2RlbFxuICAgKiBAcmV0dXJuIHtNb2RlbEluc3RhbmNlfVxuICAgKi9cbiAgZnVuY3Rpb24gZ2V0U2luZ2xldG9uKG1vZGVsKSB7XG4gICAgdmFyIG1vZGVsTmFtZSA9IG1vZGVsLm5hbWU7XG4gICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gbW9kZWwuY29sbGVjdGlvbk5hbWU7XG4gICAgdmFyIGNvbGxlY3Rpb25DYWNoZSA9IGxvY2FsQ2FjaGVbY29sbGVjdGlvbk5hbWVdO1xuICAgIGlmIChjb2xsZWN0aW9uQ2FjaGUpIHtcbiAgICAgIHZhciB0eXBlQ2FjaGUgPSBjb2xsZWN0aW9uQ2FjaGVbbW9kZWxOYW1lXTtcbiAgICAgIGlmICh0eXBlQ2FjaGUpIHtcbiAgICAgICAgdmFyIG9ianMgPSBbXTtcbiAgICAgICAgZm9yICh2YXIgcHJvcCBpbiB0eXBlQ2FjaGUpIHtcbiAgICAgICAgICBpZiAodHlwZUNhY2hlLmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgICAgICBvYmpzLnB1c2godHlwZUNhY2hlW3Byb3BdKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9ianMubGVuZ3RoID4gMSkge1xuICAgICAgICAgIHZhciBlcnJTdHIgPSAnQSBzaW5nbGV0b24gbW9kZWwgaGFzIG1vcmUgdGhhbiAxIG9iamVjdCBpbiB0aGUgY2FjaGUhIFRoaXMgaXMgYSBzZXJpb3VzIGVycm9yLiAnICtcbiAgICAgICAgICAgICdFaXRoZXIgYSBtb2RlbCBoYXMgYmVlbiBtb2RpZmllZCBhZnRlciBvYmplY3RzIGhhdmUgYWxyZWFkeSBiZWVuIGNyZWF0ZWQsIG9yIHNvbWV0aGluZyBoYXMgZ29uZScgK1xuICAgICAgICAgICAgJ3Zlcnkgd3JvbmcuIFBsZWFzZSBmaWxlIGEgYnVnIHJlcG9ydCBpZiB0aGUgbGF0dGVyLic7XG4gICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoZXJyU3RyKTtcbiAgICAgICAgfSBlbHNlIGlmIChvYmpzLmxlbmd0aCkge1xuICAgICAgICAgIHJldHVybiBvYmpzWzBdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIEdpdmVuIGEgcmVtb3RlIGlkZW50aWZpZXIgYW5kIGFuIG9wdGlvbnMgb2JqZWN0IHRoYXQgZGVzY3JpYmVzIG1hcHBpbmcvY29sbGVjdGlvbixcbiAgICogcmV0dXJuIHRoZSBtb2RlbCBpZiBjYWNoZWQuXG4gICAqIEBwYXJhbSAge1N0cmluZ3xBcnJheX0gcmVtb3RlSWRcbiAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRzXG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0cy5tb2RlbFxuICAgKiBAcmV0dXJuIHtNb2RlbEluc3RhbmNlfVxuICAgKi9cbiAgZnVuY3Rpb24gZ2V0VmlhUmVtb3RlSWQocmVtb3RlSWQsIG9wdHMpIHtcbiAgICB2YXIgY2FjaGUgPSAocmVtb3RlQ2FjaGVbb3B0cy5tb2RlbC5jb2xsZWN0aW9uTmFtZV0gfHwge30pW29wdHMubW9kZWwubmFtZV0gfHwge307XG4gICAgcmV0dXJuIHV0aWwuaXNBcnJheShyZW1vdGVJZCkgPyByZW1vdGVJZC5tYXAoZnVuY3Rpb24oeCkge3JldHVybiBjYWNoZVt4XX0pIDogY2FjaGVbcmVtb3RlSWRdO1xuICB9XG5cbiAgLyoqXG4gICAqIEluc2VydCBhbiBvYmplY3QgaW50byB0aGUgY2FjaGUgdXNpbmcgYSByZW1vdGUgaWRlbnRpZmllciBkZWZpbmVkIGJ5IHRoZSBtYXBwaW5nLlxuICAgKiBAcGFyYW0gIHtNb2RlbEluc3RhbmNlfSBvYmpcbiAgICogQHBhcmFtICB7U3RyaW5nfSByZW1vdGVJZFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IHByZXZpb3VzUmVtb3RlSWQgSWYgcmVtb3RlIGlkIGhhcyBiZWVuIGNoYW5nZWQsIHRoaXMgaXMgdGhlIG9sZCByZW1vdGUgaWRlbnRpZmllclxuICAgKi9cbiAgZnVuY3Rpb24gcmVtb3RlSW5zZXJ0KG9iaiwgcmVtb3RlSWQsIHByZXZpb3VzUmVtb3RlSWQpIHtcbiAgICBpZiAob2JqKSB7XG4gICAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBvYmoubW9kZWwuY29sbGVjdGlvbk5hbWU7XG4gICAgICBpZiAoY29sbGVjdGlvbk5hbWUpIHtcbiAgICAgICAgaWYgKCFyZW1vdGVDYWNoZVtjb2xsZWN0aW9uTmFtZV0pIHtcbiAgICAgICAgICByZW1vdGVDYWNoZVtjb2xsZWN0aW9uTmFtZV0gPSB7fTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgdHlwZSA9IG9iai5tb2RlbC5uYW1lO1xuICAgICAgICBpZiAodHlwZSkge1xuICAgICAgICAgIGlmICghcmVtb3RlQ2FjaGVbY29sbGVjdGlvbk5hbWVdW3R5cGVdKSB7XG4gICAgICAgICAgICByZW1vdGVDYWNoZVtjb2xsZWN0aW9uTmFtZV1bdHlwZV0gPSB7fTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHByZXZpb3VzUmVtb3RlSWQpIHtcbiAgICAgICAgICAgIHJlbW90ZUNhY2hlW2NvbGxlY3Rpb25OYW1lXVt0eXBlXVtwcmV2aW91c1JlbW90ZUlkXSA9IG51bGw7XG4gICAgICAgICAgfVxuICAgICAgICAgIHZhciBjYWNoZWRPYmplY3QgPSByZW1vdGVDYWNoZVtjb2xsZWN0aW9uTmFtZV1bdHlwZV1bcmVtb3RlSWRdO1xuICAgICAgICAgIGlmICghY2FjaGVkT2JqZWN0KSB7XG4gICAgICAgICAgICByZW1vdGVDYWNoZVtjb2xsZWN0aW9uTmFtZV1bdHlwZV1bcmVtb3RlSWRdID0gb2JqO1xuICAgICAgICAgICAgbG9nKCdSZW1vdGUgY2FjaGUgaW5zZXJ0OiAnICsgb2JqLl9kdW1wKHRydWUpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gU29tZXRoaW5nIGhhcyBnb25lIHJlYWxseSB3cm9uZy4gT25seSBvbmUgb2JqZWN0IGZvciBhIHBhcnRpY3VsYXIgY29sbGVjdGlvbi90eXBlL3JlbW90ZWlkIGNvbWJvXG4gICAgICAgICAgICAvLyBzaG91bGQgZXZlciBleGlzdC5cbiAgICAgICAgICAgIGlmIChvYmogIT0gY2FjaGVkT2JqZWN0KSB7XG4gICAgICAgICAgICAgIHZhciBtZXNzYWdlID0gJ09iamVjdCAnICsgY29sbGVjdGlvbk5hbWUudG9TdHJpbmcoKSArICc6JyArIHR5cGUudG9TdHJpbmcoKSArICdbJyArIG9iai5tb2RlbC5pZCArICc9XCInICsgcmVtb3RlSWQgKyAnXCJdIGFscmVhZHkgZXhpc3RzIGluIHRoZSBjYWNoZS4nICtcbiAgICAgICAgICAgICAgICAnIFRoaXMgaXMgYSBzZXJpb3VzIGVycm9yLCBwbGVhc2UgZmlsZSBhIGJ1ZyByZXBvcnQgaWYgeW91IGFyZSBleHBlcmllbmNpbmcgdGhpcyBvdXQgaW4gdGhlIHdpbGQnO1xuICAgICAgICAgICAgICBsb2cobWVzc2FnZSwge1xuICAgICAgICAgICAgICAgIG9iajogb2JqLFxuICAgICAgICAgICAgICAgIGNhY2hlZE9iamVjdDogY2FjaGVkT2JqZWN0XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihtZXNzYWdlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGxvZygnT2JqZWN0IGhhcyBhbHJlYWR5IGJlZW4gaW5zZXJ0ZWQ6ICcgKyBvYmouX2R1bXAodHJ1ZSkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNb2RlbCBoYXMgbm8gdHlwZScsIHtcbiAgICAgICAgICAgIG1vZGVsOiBvYmoubW9kZWwsXG4gICAgICAgICAgICBvYmo6IG9ialxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTW9kZWwgaGFzIG5vIGNvbGxlY3Rpb24nLCB7XG4gICAgICAgICAgbW9kZWw6IG9iai5tb2RlbCxcbiAgICAgICAgICBvYmo6IG9ialxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIG1zZyA9ICdNdXN0IHBhc3MgYW4gb2JqZWN0IHdoZW4gaW5zZXJ0aW5nIHRvIGNhY2hlJztcbiAgICAgIGxvZyhtc2cpO1xuICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IobXNnKTtcbiAgICB9XG4gIH1cblxuXG4gIGZ1bmN0aW9uIF9yZW1vdGVDYWNoZSgpIHtcbiAgICByZXR1cm4gcmVtb3RlQ2FjaGVcbiAgfVxuXG4gIGZ1bmN0aW9uIF9sb2NhbENhY2hlKCkge1xuICAgIHJldHVybiBsb2NhbENhY2hlQnlJZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBRdWVyeSB0aGUgY2FjaGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRzIE9iamVjdCBkZXNjcmliaW5nIHRoZSBxdWVyeVxuICAgKiBAcmV0dXJuIHtNb2RlbEluc3RhbmNlfVxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBqc1xuICAgKiBjYWNoZS5nZXQoe19pZDogJzUnfSk7IC8vIFF1ZXJ5IGJ5IGxvY2FsIGlkXG4gICAqIGNhY2hlLmdldCh7cmVtb3RlSWQ6ICc1JywgbWFwcGluZzogbXlNYXBwaW5nfSk7IC8vIFF1ZXJ5IGJ5IHJlbW90ZSBpZFxuICAgKiBgYGBcbiAgICovXG4gIGZ1bmN0aW9uIGdldChvcHRzKSB7XG4gICAgbG9nKCdnZXQnLCBvcHRzKTtcbiAgICB2YXIgb2JqLCBpZEZpZWxkLCByZW1vdGVJZDtcbiAgICB2YXIgbG9jYWxJZCA9IG9wdHMubG9jYWxJZDtcbiAgICBpZiAobG9jYWxJZCkge1xuICAgICAgb2JqID0gZ2V0VmlhTG9jYWxJZChsb2NhbElkKTtcbiAgICAgIGlmIChvYmopIHtcbiAgICAgICAgcmV0dXJuIG9iajtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChvcHRzLm1vZGVsKSB7XG4gICAgICAgICAgaWRGaWVsZCA9IG9wdHMubW9kZWwuaWQ7XG4gICAgICAgICAgcmVtb3RlSWQgPSBvcHRzW2lkRmllbGRdO1xuICAgICAgICAgIGxvZyhpZEZpZWxkICsgJz0nICsgcmVtb3RlSWQpO1xuICAgICAgICAgIHJldHVybiBnZXRWaWFSZW1vdGVJZChyZW1vdGVJZCwgb3B0cyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKG9wdHMubW9kZWwpIHtcbiAgICAgIGlkRmllbGQgPSBvcHRzLm1vZGVsLmlkO1xuICAgICAgcmVtb3RlSWQgPSBvcHRzW2lkRmllbGRdO1xuICAgICAgaWYgKHJlbW90ZUlkKSB7XG4gICAgICAgIHJldHVybiBnZXRWaWFSZW1vdGVJZChyZW1vdGVJZCwgb3B0cyk7XG4gICAgICB9IGVsc2UgaWYgKG9wdHMubW9kZWwuc2luZ2xldG9uKSB7XG4gICAgICAgIHJldHVybiBnZXRTaW5nbGV0b24ob3B0cy5tb2RlbCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvZygnSW52YWxpZCBvcHRzIHRvIGNhY2hlJywge1xuICAgICAgICBvcHRzOiBvcHRzXG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKipcbiAgICogSW5zZXJ0IGFuIG9iamVjdCBpbnRvIHRoZSBjYWNoZS5cbiAgICogQHBhcmFtICB7TW9kZWxJbnN0YW5jZX0gb2JqXG4gICAqIEB0aHJvd3Mge0ludGVybmFsU2llc3RhRXJyb3J9IEFuIG9iamVjdCB3aXRoIF9pZC9yZW1vdGVJZCBhbHJlYWR5IGV4aXN0cy4gTm90IHRocm93biBpZiBzYW1lIG9iaGVjdC5cbiAgICovXG4gIGZ1bmN0aW9uIGluc2VydChvYmopIHtcbiAgICB2YXIgbG9jYWxJZCA9IG9iai5sb2NhbElkO1xuICAgIGlmIChsb2NhbElkKSB7XG4gICAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBvYmoubW9kZWwuY29sbGVjdGlvbk5hbWU7XG4gICAgICB2YXIgbW9kZWxOYW1lID0gb2JqLm1vZGVsLm5hbWU7XG4gICAgICBpZiAoIWxvY2FsQ2FjaGVCeUlkW2xvY2FsSWRdKSB7XG4gICAgICAgIGxvY2FsQ2FjaGVCeUlkW2xvY2FsSWRdID0gb2JqO1xuICAgICAgICBpZiAoIWxvY2FsQ2FjaGVbY29sbGVjdGlvbk5hbWVdKSBsb2NhbENhY2hlW2NvbGxlY3Rpb25OYW1lXSA9IHt9O1xuICAgICAgICBpZiAoIWxvY2FsQ2FjaGVbY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV0pIGxvY2FsQ2FjaGVbY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV0gPSB7fTtcbiAgICAgICAgbG9jYWxDYWNoZVtjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXVtsb2NhbElkXSA9IG9iajtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFNvbWV0aGluZyBoYXMgZ29uZSBiYWRseSB3cm9uZyBoZXJlLiBUd28gb2JqZWN0cyBzaG91bGQgbmV2ZXIgZXhpc3Qgd2l0aCB0aGUgc2FtZSBfaWRcbiAgICAgICAgaWYgKGxvY2FsQ2FjaGVCeUlkW2xvY2FsSWRdICE9IG9iaikge1xuICAgICAgICAgIHZhciBtZXNzYWdlID0gJ09iamVjdCB3aXRoIGxvY2FsSWQ9XCInICsgbG9jYWxJZC50b1N0cmluZygpICsgJ1wiIGlzIGFscmVhZHkgaW4gdGhlIGNhY2hlLiAnICtcbiAgICAgICAgICAgICdUaGlzIGlzIGEgc2VyaW91cyBlcnJvci4gUGxlYXNlIGZpbGUgYSBidWcgcmVwb3J0IGlmIHlvdSBhcmUgZXhwZXJpZW5jaW5nIHRoaXMgb3V0IGluIHRoZSB3aWxkJztcbiAgICAgICAgICBsb2cobWVzc2FnZSk7XG4gICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IobWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdmFyIGlkRmllbGQgPSBvYmouaWRGaWVsZDtcbiAgICB2YXIgcmVtb3RlSWQgPSBvYmpbaWRGaWVsZF07XG4gICAgaWYgKHJlbW90ZUlkKSB7XG4gICAgICByZW1vdGVJbnNlcnQob2JqLCByZW1vdGVJZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvZygnTm8gcmVtb3RlIGlkIChcIicgKyBpZEZpZWxkICsgJ1wiKSBzbyB3b250IGJlIHBsYWNpbmcgaW4gdGhlIHJlbW90ZSBjYWNoZScsIG9iaik7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdHJ1ZSBpZiBvYmplY3QgaXMgaW4gdGhlIGNhY2hlXG4gICAqIEBwYXJhbSAge01vZGVsSW5zdGFuY2V9IG9ialxuICAgKiBAcmV0dXJuIHtib29sZWFufVxuICAgKi9cbiAgZnVuY3Rpb24gY29udGFpbnMob2JqKSB7XG4gICAgdmFyIHEgPSB7XG4gICAgICBsb2NhbElkOiBvYmoubG9jYWxJZFxuICAgIH07XG4gICAgdmFyIG1vZGVsID0gb2JqLm1vZGVsO1xuICAgIGlmIChtb2RlbC5pZCkge1xuICAgICAgaWYgKG9ialttb2RlbC5pZF0pIHtcbiAgICAgICAgcS5tb2RlbCA9IG1vZGVsO1xuICAgICAgICBxW21vZGVsLmlkXSA9IG9ialttb2RlbC5pZF07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiAhIWdldChxKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmVzIHRoZSBvYmplY3QgZnJvbSB0aGUgY2FjaGUgKGlmIGl0J3MgYWN0dWFsbHkgaW4gdGhlIGNhY2hlKSBvdGhlcndpc2VzIHRocm93cyBhbiBlcnJvci5cbiAgICogQHBhcmFtICB7TW9kZWxJbnN0YW5jZX0gb2JqXG4gICAqIEB0aHJvd3Mge0ludGVybmFsU2llc3RhRXJyb3J9IElmIG9iamVjdCBhbHJlYWR5IGluIHRoZSBjYWNoZS5cbiAgICovXG4gIGZ1bmN0aW9uIHJlbW92ZShvYmopIHtcbiAgICBpZiAoY29udGFpbnMob2JqKSkge1xuICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gb2JqLm1vZGVsLmNvbGxlY3Rpb25OYW1lO1xuICAgICAgdmFyIG1vZGVsTmFtZSA9IG9iai5tb2RlbC5uYW1lO1xuICAgICAgdmFyIGxvY2FsSWQgPSBvYmoubG9jYWxJZDtcbiAgICAgIGlmICghbW9kZWxOYW1lKSB0aHJvdyBJbnRlcm5hbFNpZXN0YUVycm9yKCdObyBtYXBwaW5nIG5hbWUnKTtcbiAgICAgIGlmICghY29sbGVjdGlvbk5hbWUpIHRocm93IEludGVybmFsU2llc3RhRXJyb3IoJ05vIGNvbGxlY3Rpb24gbmFtZScpO1xuICAgICAgaWYgKCFsb2NhbElkKSB0aHJvdyBJbnRlcm5hbFNpZXN0YUVycm9yKCdObyBsb2NhbElkJyk7XG4gICAgICBkZWxldGUgbG9jYWxDYWNoZVtjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXVtsb2NhbElkXTtcbiAgICAgIGRlbGV0ZSBsb2NhbENhY2hlQnlJZFtsb2NhbElkXTtcbiAgICAgIGlmIChvYmoubW9kZWwuaWQpIHtcbiAgICAgICAgdmFyIHJlbW90ZUlkID0gb2JqW29iai5tb2RlbC5pZF07XG4gICAgICAgIGlmIChyZW1vdGVJZCkge1xuICAgICAgICAgIGRlbGV0ZSByZW1vdGVDYWNoZVtjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXVtyZW1vdGVJZF07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuXG4gIGV4cG9ydHMuX3JlbW90ZUNhY2hlID0gX3JlbW90ZUNhY2hlO1xuICBleHBvcnRzLl9sb2NhbENhY2hlID0gX2xvY2FsQ2FjaGU7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX2xvY2FsQ2FjaGVCeVR5cGUnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBsb2NhbENhY2hlO1xuICAgIH1cbiAgfSk7XG4gIGV4cG9ydHMuZ2V0ID0gZ2V0O1xuICBleHBvcnRzLmluc2VydCA9IGluc2VydDtcbiAgZXhwb3J0cy5yZW1vdGVJbnNlcnQgPSByZW1vdGVJbnNlcnQ7XG4gIGV4cG9ydHMucmVzZXQgPSByZXNldDtcbiAgZXhwb3J0cy5jb250YWlucyA9IGNvbnRhaW5zO1xuICBleHBvcnRzLnJlbW92ZSA9IHJlbW92ZTtcbiAgZXhwb3J0cy5nZXRTaW5nbGV0b24gPSBnZXRTaW5nbGV0b247XG4gIGV4cG9ydHMuZ2V0VmlhTG9jYWxJZCA9IGdldFZpYUxvY2FsSWQ7XG4gIGV4cG9ydHMuZ2V0VmlhUmVtb3RlSWQgPSBnZXRWaWFSZW1vdGVJZDtcbiAgZXhwb3J0cy5jb3VudCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyhsb2NhbENhY2hlQnlJZCkubGVuZ3RoO1xuICB9XG59KSgpOyIsIi8qKlxuICogQG1vZHVsZSBjb2xsZWN0aW9uXG4gKi9cbihmdW5jdGlvbigpIHtcbiAgdmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJykoJ2NvbGxlY3Rpb24nKSxcbiAgICBDb2xsZWN0aW9uUmVnaXN0cnkgPSByZXF1aXJlKCcuL2NvbGxlY3Rpb25SZWdpc3RyeScpLkNvbGxlY3Rpb25SZWdpc3RyeSxcbiAgICBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgTW9kZWwgPSByZXF1aXJlKCcuL21vZGVsJyksXG4gICAgZXh0ZW5kID0gcmVxdWlyZSgnZXh0ZW5kJyksXG4gICAgb2JzZXJ2ZSA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuUGxhdGZvcm0sXG4gICAgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gICAgZXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJyksXG4gICAgYXJnc2FycmF5ID0gcmVxdWlyZSgnYXJnc2FycmF5JyksXG4gICAgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyk7XG5cblxuICAvKipcbiAgICogQSBjb2xsZWN0aW9uIGRlc2NyaWJlcyBhIHNldCBvZiBtb2RlbHMgYW5kIG9wdGlvbmFsbHkgYSBSRVNUIEFQSSB3aGljaCB3ZSB3b3VsZFxuICAgKiBsaWtlIHRvIG1vZGVsLlxuICAgKlxuICAgKiBAcGFyYW0gbmFtZVxuICAgKiBAcGFyYW0gb3B0c1xuICAgKiBAY29uc3RydWN0b3JcbiAgICpcbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYGBganNcbiAgICogdmFyIEdpdEh1YiA9IG5ldyBzaWVzdGEoJ0dpdEh1YicpXG4gICAqIC8vIC4uLiBjb25maWd1cmUgbWFwcGluZ3MsIGRlc2NyaXB0b3JzIGV0YyAuLi5cbiAgICogR2l0SHViLmluc3RhbGwoZnVuY3Rpb24gKCkge1xuICAgICAqICAgICAvLyAuLi4gY2Fycnkgb24uXG4gICAgICogfSk7XG4gICAqIGBgYFxuICAgKi9cbiAgZnVuY3Rpb24gQ29sbGVjdGlvbihuYW1lLCBvcHRzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICghbmFtZSkgdGhyb3cgbmV3IEVycm9yKCdDb2xsZWN0aW9uIG11c3QgaGF2ZSBhIG5hbWUnKTtcblxuICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgIHV0aWwuZXh0ZW5kRnJvbU9wdHModGhpcywgb3B0cywge30pO1xuXG4gICAgdXRpbC5leHRlbmQodGhpcywge1xuICAgICAgbmFtZTogbmFtZSxcbiAgICAgIF9yYXdNb2RlbHM6IHt9LFxuICAgICAgX21vZGVsczoge30sXG4gICAgICBfb3B0czogb3B0cyxcbiAgICAgIGluc3RhbGxlZDogZmFsc2VcbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHRoaXMsIHtcbiAgICAgIGRpcnR5OiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgaWYgKHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQpIHtcbiAgICAgICAgICAgIHZhciB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbiA9IHNpZXN0YS5leHQuc3RvcmFnZS5fdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb24sXG4gICAgICAgICAgICAgIGhhc2ggPSB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbltzZWxmLm5hbWVdIHx8IHt9O1xuICAgICAgICAgICAgcmV0dXJuICEhT2JqZWN0LmtleXMoaGFzaCkubGVuZ3RoO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIENvbGxlY3Rpb25SZWdpc3RyeS5yZWdpc3Rlcih0aGlzKTtcbiAgICB0aGlzLl9tYWtlQXZhaWxhYmxlT25Sb290KCk7XG4gICAgZXZlbnRzLlByb3h5RXZlbnRFbWl0dGVyLmNhbGwodGhpcywgdGhpcy5uYW1lKTtcbiAgfVxuXG4gIENvbGxlY3Rpb24ucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShldmVudHMuUHJveHlFdmVudEVtaXR0ZXIucHJvdG90eXBlKTtcblxuICB1dGlsLmV4dGVuZChDb2xsZWN0aW9uLnByb3RvdHlwZSwge1xuICAgIF9nZXRNb2RlbHNUb0luc3RhbGw6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIG1vZGVsc1RvSW5zdGFsbCA9IFtdO1xuICAgICAgZm9yICh2YXIgbmFtZSBpbiB0aGlzLl9tb2RlbHMpIHtcbiAgICAgICAgaWYgKHRoaXMuX21vZGVscy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICAgIHZhciBtb2RlbCA9IHRoaXMuX21vZGVsc1tuYW1lXTtcbiAgICAgICAgICBtb2RlbHNUb0luc3RhbGwucHVzaChtb2RlbCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGxvZygnVGhlcmUgYXJlICcgKyBtb2RlbHNUb0luc3RhbGwubGVuZ3RoLnRvU3RyaW5nKCkgKyAnIG1hcHBpbmdzIHRvIGluc3RhbGwnKTtcbiAgICAgIHJldHVybiBtb2RlbHNUb0luc3RhbGw7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBNZWFucyB0aGF0IHdlIGNhbiBhY2Nlc3MgdGhlIGNvbGxlY3Rpb24gb24gdGhlIHNpZXN0YSBvYmplY3QuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbWFrZUF2YWlsYWJsZU9uUm9vdDogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgaW5kZXggPSByZXF1aXJlKCcuL2luZGV4Jyk7XG4gICAgICBpbmRleFt0aGlzLm5hbWVdID0gdGhpcztcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIEVuc3VyZSBtYXBwaW5ncyBhcmUgaW5zdGFsbGVkLlxuICAgICAqIEBwYXJhbSBbY2JdXG4gICAgICogQGNsYXNzIENvbGxlY3Rpb25cbiAgICAgKi9cbiAgICBpbnN0YWxsOiBmdW5jdGlvbihjYikge1xuICAgICAgdmFyIG1vZGVsc1RvSW5zdGFsbCA9IHRoaXMuX2dldE1vZGVsc1RvSW5zdGFsbCgpO1xuICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgICAgaWYgKCF0aGlzLmluc3RhbGxlZCkge1xuICAgICAgICAgIHRoaXMuaW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgICB2YXIgZXJyb3JzID0gW107XG4gICAgICAgICAgbW9kZWxzVG9JbnN0YWxsLmZvckVhY2goZnVuY3Rpb24obSkge1xuICAgICAgICAgICAgbG9nKCdJbnN0YWxsaW5nIHJlbGF0aW9uc2hpcHMgZm9yIG1hcHBpbmcgd2l0aCBuYW1lIFwiJyArIG0ubmFtZSArICdcIicpO1xuICAgICAgICAgICAgdmFyIGVyciA9IG0uaW5zdGFsbFJlbGF0aW9uc2hpcHMoKTtcbiAgICAgICAgICAgIGlmIChlcnIpIGVycm9ycy5wdXNoKGVycik7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgaWYgKCFlcnJvcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICBtb2RlbHNUb0luc3RhbGwuZm9yRWFjaChmdW5jdGlvbihtKSB7XG4gICAgICAgICAgICAgIGxvZygnSW5zdGFsbGluZyByZXZlcnNlIHJlbGF0aW9uc2hpcHMgZm9yIG1hcHBpbmcgd2l0aCBuYW1lIFwiJyArIG0ubmFtZSArICdcIicpO1xuICAgICAgICAgICAgICB2YXIgZXJyID0gbS5pbnN0YWxsUmV2ZXJzZVJlbGF0aW9uc2hpcHMoKTtcbiAgICAgICAgICAgICAgaWYgKGVycikgZXJyb3JzLnB1c2goZXJyKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaWYgKCFlcnJvcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgIHRoaXMuaW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgdGhpcy5fbWFrZUF2YWlsYWJsZU9uUm9vdCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBjYihlcnJvcnMubGVuZ3RoID8gZXJyb3IoJ0Vycm9ycyB3ZXJlIGVuY291bnRlcmVkIHdoaWxzdCBzZXR0aW5nIHVwIHRoZSBjb2xsZWN0aW9uJywge2Vycm9yczogZXJyb3JzfSkgOiBudWxsKTtcbiAgICAgICAgfSBlbHNlIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdDb2xsZWN0aW9uIFwiJyArIHRoaXMubmFtZSArICdcIiBoYXMgYWxyZWFkeSBiZWVuIGluc3RhbGxlZCcpO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9LFxuXG4gICAgX21vZGVsOiBmdW5jdGlvbihuYW1lLCBvcHRzKSB7XG4gICAgICBpZiAobmFtZSkge1xuICAgICAgICB0aGlzLl9yYXdNb2RlbHNbbmFtZV0gPSBvcHRzO1xuICAgICAgICBvcHRzID0gZXh0ZW5kKHRydWUsIHt9LCBvcHRzKTtcbiAgICAgICAgb3B0cy5uYW1lID0gbmFtZTtcbiAgICAgICAgb3B0cy5jb2xsZWN0aW9uID0gdGhpcztcbiAgICAgICAgdmFyIG1vZGVsID0gbmV3IE1vZGVsKG9wdHMpO1xuICAgICAgICB0aGlzLl9tb2RlbHNbbmFtZV0gPSBtb2RlbDtcbiAgICAgICAgdGhpc1tuYW1lXSA9IG1vZGVsO1xuICAgICAgICBpZiAodGhpcy5pbnN0YWxsZWQpIHtcbiAgICAgICAgICB2YXIgZXJyb3IgPSBtb2RlbC5pbnN0YWxsUmVsYXRpb25zaGlwcygpO1xuICAgICAgICAgIGlmICghZXJyb3IpIGVycm9yID0gbW9kZWwuaW5zdGFsbFJldmVyc2VSZWxhdGlvbnNoaXBzKCk7XG4gICAgICAgICAgaWYgKGVycm9yKSAgdGhyb3cgZXJyb3I7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1vZGVsO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignTm8gbmFtZSBzcGVjaWZpZWQgd2hlbiBjcmVhdGluZyBtYXBwaW5nJyk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJlZ2lzdGVycyBhIG1vZGVsIHdpdGggdGhpcyBjb2xsZWN0aW9uLlxuICAgICAqL1xuICAgIG1vZGVsOiBhcmdzYXJyYXkoZnVuY3Rpb24oYXJncykge1xuICAgICAgaWYgKGFyZ3MubGVuZ3RoKSB7XG4gICAgICAgIGlmIChhcmdzLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgICAgaWYgKHV0aWwuaXNBcnJheShhcmdzWzBdKSkge1xuICAgICAgICAgICAgcmV0dXJuIGFyZ3NbMF0ubWFwKGZ1bmN0aW9uKG0pIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX21vZGVsKG0ubmFtZSwgbSk7XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIgbmFtZSwgb3B0cztcbiAgICAgICAgICAgIGlmICh1dGlsLmlzU3RyaW5nKGFyZ3NbMF0pKSB7XG4gICAgICAgICAgICAgIG5hbWUgPSBhcmdzWzBdO1xuICAgICAgICAgICAgICBvcHRzID0ge307XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgb3B0cyA9IGFyZ3NbMF07XG4gICAgICAgICAgICAgIG5hbWUgPSBvcHRzLm5hbWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fbW9kZWwobmFtZSwgb3B0cyk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmICh0eXBlb2YgYXJnc1swXSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX21vZGVsKGFyZ3NbMF0sIGFyZ3NbMV0pO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gYXJncy5tYXAoZnVuY3Rpb24obSkge1xuICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fbW9kZWwobS5uYW1lLCBtKTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0pLFxuXG4gICAgLyoqXG4gICAgICogRHVtcCB0aGlzIGNvbGxlY3Rpb24gYXMgSlNPTlxuICAgICAqIEBwYXJhbSAge0Jvb2xlYW59IGFzSnNvbiBXaGV0aGVyIG9yIG5vdCB0byBhcHBseSBKU09OLnN0cmluZ2lmeVxuICAgICAqIEByZXR1cm4ge1N0cmluZ3xPYmplY3R9XG4gICAgICogQGNsYXNzIENvbGxlY3Rpb25cbiAgICAgKi9cbiAgICBfZHVtcDogZnVuY3Rpb24oYXNKc29uKSB7XG4gICAgICB2YXIgb2JqID0ge307XG4gICAgICBvYmouaW5zdGFsbGVkID0gdGhpcy5pbnN0YWxsZWQ7XG4gICAgICBvYmouZG9jSWQgPSB0aGlzLl9kb2NJZDtcbiAgICAgIG9iai5uYW1lID0gdGhpcy5uYW1lO1xuICAgICAgcmV0dXJuIGFzSnNvbiA/IHV0aWwucHJldHR5UHJpbnQob2JqKSA6IG9iajtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgbnVtYmVyIG9mIG9iamVjdHMgaW4gdGhpcyBjb2xsZWN0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIGNiXG4gICAgICogQHJldHVybnMge1Byb21pc2V9XG4gICAgICovXG4gICAgY291bnQ6IGZ1bmN0aW9uKGNiKSB7XG4gICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgICB2YXIgdGFza3MgPSBPYmplY3Qua2V5cyh0aGlzLl9tb2RlbHMpLm1hcChmdW5jdGlvbihtb2RlbE5hbWUpIHtcbiAgICAgICAgICB2YXIgbSA9IHRoaXMuX21vZGVsc1ttb2RlbE5hbWVdO1xuICAgICAgICAgIHJldHVybiBtLmNvdW50LmJpbmQobSk7XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIHV0aWwuYXN5bmMucGFyYWxsZWwodGFza3MsIGZ1bmN0aW9uKGVyciwgbnMpIHtcbiAgICAgICAgICB2YXIgbjtcbiAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgbiA9IG5zLnJlZHVjZShmdW5jdGlvbihtLCByKSB7XG4gICAgICAgICAgICAgIHJldHVybiBtICsgclxuICAgICAgICAgICAgfSwgMCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNiKGVyciwgbik7XG4gICAgICAgIH0pO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9LFxuXG4gICAgZ3JhcGg6IGZ1bmN0aW9uKGRhdGEsIG9wdHMsIGNiKSB7XG4gICAgICBpZiAodHlwZW9mIG9wdHMgPT0gJ2Z1bmN0aW9uJykgY2IgPSBvcHRzO1xuICAgICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgICB2YXIgdGFza3MgPSBbXSwgZXJyO1xuICAgICAgICBmb3IgKHZhciBtb2RlbE5hbWUgaW4gZGF0YSkge1xuICAgICAgICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KG1vZGVsTmFtZSkpIHtcbiAgICAgICAgICAgIHZhciBtb2RlbCA9IHRoaXMuX21vZGVsc1ttb2RlbE5hbWVdO1xuICAgICAgICAgICAgaWYgKG1vZGVsKSB7XG4gICAgICAgICAgICAgIChmdW5jdGlvbihtb2RlbCwgZGF0YSkge1xuICAgICAgICAgICAgICAgIHRhc2tzLnB1c2goZnVuY3Rpb24oZG9uZSkge1xuICAgICAgICAgICAgICAgICAgbW9kZWwuZ3JhcGgoZGF0YSwgZnVuY3Rpb24oZXJyLCBtb2RlbHMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICB2YXIgcmVzdWx0cyA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdHNbbW9kZWwubmFtZV0gPSBtb2RlbHM7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZG9uZShlcnIsIHJlc3VsdHMpO1xuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH0pKG1vZGVsLCBkYXRhW21vZGVsTmFtZV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIGVyciA9ICdObyBzdWNoIG1vZGVsIFwiJyArIG1vZGVsTmFtZSArICdcIic7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICghZXJyKSB1dGlsLmFzeW5jLnNlcmllcyh0YXNrcywgZnVuY3Rpb24oZXJyLCByZXN1bHRzKSB7XG4gICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgIHJlc3VsdHMgPSByZXN1bHRzLnJlZHVjZShmdW5jdGlvbihtZW1vLCByZXMpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHV0aWwuZXh0ZW5kKG1lbW8sIHJlcyB8fCB7fSk7XG4gICAgICAgICAgICB9LCB7fSlcbiAgICAgICAgICB9IGVsc2UgcmVzdWx0cyA9IG51bGw7XG4gICAgICAgICAgY2IoZXJyLCByZXN1bHRzKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGVsc2UgY2IoZXJyb3IoZXJyLCB7ZGF0YTogZGF0YSwgaW52YWxpZE1vZGVsTmFtZTogbW9kZWxOYW1lfSkpO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9LFxuXG4gICAgcmVtb3ZlQWxsOiBmdW5jdGlvbihjYikge1xuICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgICAgdXRpbC5Qcm9taXNlLmFsbChcbiAgICAgICAgICBPYmplY3Qua2V5cyh0aGlzLl9tb2RlbHMpLm1hcChmdW5jdGlvbihtb2RlbE5hbWUpIHtcbiAgICAgICAgICAgIHZhciBtb2RlbCA9IHRoaXMuX21vZGVsc1ttb2RlbE5hbWVdO1xuICAgICAgICAgICAgcmV0dXJuIG1vZGVsLnJlbW92ZUFsbCgpO1xuICAgICAgICAgIH0uYmluZCh0aGlzKSlcbiAgICAgICAgKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgY2IobnVsbCk7XG4gICAgICAgICAgfSlcbiAgICAgICAgICAuY2F0Y2goY2IpXG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH1cbiAgfSk7XG5cblxuICBtb2R1bGUuZXhwb3J0cyA9IENvbGxlY3Rpb247XG59KSgpOyIsIi8qKlxuICogQG1vZHVsZSBjb2xsZWN0aW9uXG4gKi9cbihmdW5jdGlvbigpIHtcbiAgdmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcblxuICBmdW5jdGlvbiBDb2xsZWN0aW9uUmVnaXN0cnkoKSB7XG4gICAgaWYgKCF0aGlzKSByZXR1cm4gbmV3IENvbGxlY3Rpb25SZWdpc3RyeSgpO1xuICAgIHRoaXMuY29sbGVjdGlvbk5hbWVzID0gW107XG4gIH1cblxuICB1dGlsLmV4dGVuZChDb2xsZWN0aW9uUmVnaXN0cnkucHJvdG90eXBlLCB7XG4gICAgcmVnaXN0ZXI6IGZ1bmN0aW9uKGNvbGxlY3Rpb24pIHtcbiAgICAgIHZhciBuYW1lID0gY29sbGVjdGlvbi5uYW1lO1xuICAgICAgdGhpc1tuYW1lXSA9IGNvbGxlY3Rpb247XG4gICAgICB0aGlzLmNvbGxlY3Rpb25OYW1lcy5wdXNoKG5hbWUpO1xuICAgIH0sXG4gICAgcmVzZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgdGhpcy5jb2xsZWN0aW9uTmFtZXMuZm9yRWFjaChmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgIGRlbGV0ZSBzZWxmW25hbWVdO1xuICAgICAgfSk7XG4gICAgICB0aGlzLmNvbGxlY3Rpb25OYW1lcyA9IFtdO1xuICAgIH1cbiAgfSk7XG5cbiAgZXhwb3J0cy5Db2xsZWN0aW9uUmVnaXN0cnkgPSBuZXcgQ29sbGVjdGlvblJlZ2lzdHJ5KCk7XG59KSgpOyIsIi8qKlxuICogQG1vZHVsZSBlcnJvclxuICovXG4oZnVuY3Rpb24oKSB7XG5cbiAgLyoqXG4gICAqIFVzZXJzIHNob3VsZCBuZXZlciBzZWUgdGhlc2UgdGhyb3duLiBBIGJ1ZyByZXBvcnQgc2hvdWxkIGJlIGZpbGVkIGlmIHNvIGFzIGl0IG1lYW5zIHNvbWUgYXNzZXJ0aW9uIGhhcyBmYWlsZWQuXG4gICAqIEBwYXJhbSBtZXNzYWdlXG4gICAqIEBwYXJhbSBjb250ZXh0XG4gICAqIEBwYXJhbSBzc2ZcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqL1xuICBmdW5jdGlvbiBJbnRlcm5hbFNpZXN0YUVycm9yKG1lc3NhZ2UsIGNvbnRleHQsIHNzZikge1xuICAgIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG4gICAgdGhpcy5jb250ZXh0ID0gY29udGV4dDtcbiAgICAvLyBjYXB0dXJlIHN0YWNrIHRyYWNlXG4gICAgaWYgKHNzZiAmJiBFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSkge1xuICAgICAgRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UodGhpcywgc3NmKTtcbiAgICB9XG4gIH1cblxuICBJbnRlcm5hbFNpZXN0YUVycm9yLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRXJyb3IucHJvdG90eXBlKTtcbiAgSW50ZXJuYWxTaWVzdGFFcnJvci5wcm90b3R5cGUubmFtZSA9ICdJbnRlcm5hbFNpZXN0YUVycm9yJztcbiAgSW50ZXJuYWxTaWVzdGFFcnJvci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBJbnRlcm5hbFNpZXN0YUVycm9yO1xuXG4gIGZ1bmN0aW9uIGlzU2llc3RhRXJyb3IoZXJyKSB7XG4gICAgaWYgKHR5cGVvZiBlcnIgPT0gJ29iamVjdCcpIHtcbiAgICAgIHJldHVybiAnZXJyb3InIGluIGVyciAmJiAnb2snIGluIGVyciAmJiAncmVhc29uJyBpbiBlcnI7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZXJyTWVzc2FnZSwgZXh0cmEpIHtcbiAgICBpZiAoaXNTaWVzdGFFcnJvcihlcnJNZXNzYWdlKSkge1xuICAgICAgcmV0dXJuIGVyck1lc3NhZ2U7XG4gICAgfVxuICAgIHZhciBlcnIgPSB7XG4gICAgICByZWFzb246IGVyck1lc3NhZ2UsXG4gICAgICBlcnJvcjogdHJ1ZSxcbiAgICAgIG9rOiBmYWxzZVxuICAgIH07XG4gICAgZm9yICh2YXIgcHJvcCBpbiBleHRyYSB8fCB7fSkge1xuICAgICAgaWYgKGV4dHJhLmhhc093blByb3BlcnR5KHByb3ApKSBlcnJbcHJvcF0gPSBleHRyYVtwcm9wXTtcbiAgICB9XG4gICAgZXJyLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodGhpcyk7XG4gICAgfTtcbiAgICByZXR1cm4gZXJyO1xuICB9O1xuXG4gIG1vZHVsZS5leHBvcnRzLkludGVybmFsU2llc3RhRXJyb3IgPSBJbnRlcm5hbFNpZXN0YUVycm9yO1xuXG59KSgpOyIsIihmdW5jdGlvbigpIHtcbiAgdmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcixcbiAgICBBcnJheU9ic2VydmVyID0gcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKS5BcnJheU9ic2VydmVyLFxuICAgIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICBhcmdzYXJyYXkgPSByZXF1aXJlKCdhcmdzYXJyYXknKSxcbiAgICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgICBDaGFpbiA9IHJlcXVpcmUoJy4vQ2hhaW4nKTtcblxuICB2YXIgZXZlbnRFbWl0dGVyID0gbmV3IEV2ZW50RW1pdHRlcigpO1xuICBldmVudEVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKDEwMCk7XG5cbiAgLyoqXG4gICAqIExpc3RlbiB0byBhIHBhcnRpY3VsYXIgZXZlbnQgZnJvbSB0aGUgU2llc3RhIGdsb2JhbCBFdmVudEVtaXR0ZXIuXG4gICAqIE1hbmFnZXMgaXRzIG93biBzZXQgb2YgbGlzdGVuZXJzLlxuICAgKiBAY29uc3RydWN0b3JcbiAgICovXG4gIGZ1bmN0aW9uIFByb3h5RXZlbnRFbWl0dGVyKGV2ZW50LCBjaGFpbk9wdHMpIHtcbiAgICB1dGlsLmV4dGVuZCh0aGlzLCB7XG4gICAgICBldmVudDogZXZlbnQsXG4gICAgICBsaXN0ZW5lcnM6IHt9XG4gICAgfSk7XG4gICAgdmFyIGRlZmF1bHRDaGFpbk9wdHMgPSB7fTtcblxuICAgIGRlZmF1bHRDaGFpbk9wdHMub24gPSB0aGlzLm9uLmJpbmQodGhpcyk7XG4gICAgZGVmYXVsdENoYWluT3B0cy5vbmNlID0gdGhpcy5vbmNlLmJpbmQodGhpcyk7XG5cbiAgICBDaGFpbi5jYWxsKHRoaXMsIHV0aWwuZXh0ZW5kKGRlZmF1bHRDaGFpbk9wdHMsIGNoYWluT3B0cyB8fCB7fSkpO1xuICB9XG5cbiAgUHJveHlFdmVudEVtaXR0ZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShDaGFpbi5wcm90b3R5cGUpO1xuXG4gIHV0aWwuZXh0ZW5kKFByb3h5RXZlbnRFbWl0dGVyLnByb3RvdHlwZSwge1xuICAgIG9uOiBmdW5jdGlvbih0eXBlLCBmbikge1xuICAgICAgaWYgKHR5cGVvZiB0eXBlID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgZm4gPSB0eXBlO1xuICAgICAgICB0eXBlID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBpZiAodHlwZS50cmltKCkgPT0gJyonKSB0eXBlID0gbnVsbDtcbiAgICAgICAgdmFyIF9mbiA9IGZuO1xuICAgICAgICBmbiA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICBlID0gZSB8fCB7fTtcbiAgICAgICAgICBpZiAodHlwZSkge1xuICAgICAgICAgICAgaWYgKGUudHlwZSA9PSB0eXBlKSB7XG4gICAgICAgICAgICAgIF9mbihlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBfZm4oZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB2YXIgbGlzdGVuZXJzID0gdGhpcy5saXN0ZW5lcnM7XG4gICAgICAgIGlmICh0eXBlKSB7XG4gICAgICAgICAgaWYgKCFsaXN0ZW5lcnNbdHlwZV0pIGxpc3RlbmVyc1t0eXBlXSA9IFtdO1xuICAgICAgICAgIGxpc3RlbmVyc1t0eXBlXS5wdXNoKGZuKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZXZlbnRFbWl0dGVyLm9uKHRoaXMuZXZlbnQsIGZuKTtcbiAgICAgIHJldHVybiB0aGlzLl9oYW5kbGVyTGluayh7XG4gICAgICAgIGZuOiBmbixcbiAgICAgICAgdHlwZTogdHlwZSxcbiAgICAgICAgZXh0ZW5kOiB0aGlzLnByb3h5Q2hhaW5PcHRzXG4gICAgICB9KTtcbiAgICB9LFxuICAgIG9uY2U6IGZ1bmN0aW9uKHR5cGUsIGZuKSB7XG4gICAgICB2YXIgZXZlbnQgPSB0aGlzLmV2ZW50O1xuICAgICAgaWYgKHR5cGVvZiB0eXBlID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgZm4gPSB0eXBlO1xuICAgICAgICB0eXBlID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBpZiAodHlwZS50cmltKCkgPT0gJyonKSB0eXBlID0gbnVsbDtcbiAgICAgICAgdmFyIF9mbiA9IGZuO1xuICAgICAgICBmbiA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICBlID0gZSB8fCB7fTtcbiAgICAgICAgICBpZiAodHlwZSkge1xuICAgICAgICAgICAgaWYgKGUudHlwZSA9PSB0eXBlKSB7XG4gICAgICAgICAgICAgIGV2ZW50RW1pdHRlci5yZW1vdmVMaXN0ZW5lcihldmVudCwgZm4pO1xuICAgICAgICAgICAgICBfZm4oZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgX2ZuKGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHR5cGUpIHJldHVybiBldmVudEVtaXR0ZXIub24oZXZlbnQsIGZuKTtcbiAgICAgIGVsc2UgcmV0dXJuIGV2ZW50RW1pdHRlci5vbmNlKGV2ZW50LCBmbik7XG4gICAgfSxcbiAgICBfcmVtb3ZlTGlzdGVuZXI6IGZ1bmN0aW9uKGZuLCB0eXBlKSB7XG4gICAgICBpZiAodHlwZSkge1xuICAgICAgICB2YXIgbGlzdGVuZXJzID0gdGhpcy5saXN0ZW5lcnNbdHlwZV0sXG4gICAgICAgICAgaWR4ID0gbGlzdGVuZXJzLmluZGV4T2YoZm4pO1xuICAgICAgICBsaXN0ZW5lcnMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gZXZlbnRFbWl0dGVyLnJlbW92ZUxpc3RlbmVyKHRoaXMuZXZlbnQsIGZuKTtcbiAgICB9LFxuICAgIGVtaXQ6IGZ1bmN0aW9uKHR5cGUsIHBheWxvYWQpIHtcbiAgICAgIGlmICh0eXBlb2YgdHlwZSA9PSAnb2JqZWN0Jykge1xuICAgICAgICBwYXlsb2FkID0gdHlwZTtcbiAgICAgICAgdHlwZSA9IG51bGw7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgcGF5bG9hZCA9IHBheWxvYWQgfHwge307XG4gICAgICAgIHBheWxvYWQudHlwZSA9IHR5cGU7XG4gICAgICB9XG4gICAgICBldmVudEVtaXR0ZXIuZW1pdC5jYWxsKGV2ZW50RW1pdHRlciwgdGhpcy5ldmVudCwgcGF5bG9hZCk7XG4gICAgfSxcbiAgICBfcmVtb3ZlQWxsTGlzdGVuZXJzOiBmdW5jdGlvbih0eXBlKSB7XG4gICAgICAodGhpcy5saXN0ZW5lcnNbdHlwZV0gfHwgW10pLmZvckVhY2goZnVuY3Rpb24oZm4pIHtcbiAgICAgICAgZXZlbnRFbWl0dGVyLnJlbW92ZUxpc3RlbmVyKHRoaXMuZXZlbnQsIGZuKTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICB0aGlzLmxpc3RlbmVyc1t0eXBlXSA9IFtdO1xuICAgIH0sXG4gICAgcmVtb3ZlQWxsTGlzdGVuZXJzOiBmdW5jdGlvbih0eXBlKSB7XG4gICAgICBpZiAodHlwZSkge1xuICAgICAgICB0aGlzLl9yZW1vdmVBbGxMaXN0ZW5lcnModHlwZSk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgZm9yICh0eXBlIGluIHRoaXMubGlzdGVuZXJzKSB7XG4gICAgICAgICAgaWYgKHRoaXMubGlzdGVuZXJzLmhhc093blByb3BlcnR5KHR5cGUpKSB7XG4gICAgICAgICAgICB0aGlzLl9yZW1vdmVBbGxMaXN0ZW5lcnModHlwZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICB1dGlsLmV4dGVuZChldmVudEVtaXR0ZXIsIHtcbiAgICBQcm94eUV2ZW50RW1pdHRlcjogUHJveHlFdmVudEVtaXR0ZXIsXG4gICAgd3JhcEFycmF5OiBmdW5jdGlvbihhcnJheSwgZmllbGQsIG1vZGVsSW5zdGFuY2UpIHtcbiAgICAgIGlmICghYXJyYXkub2JzZXJ2ZXIpIHtcbiAgICAgICAgYXJyYXkub2JzZXJ2ZXIgPSBuZXcgQXJyYXlPYnNlcnZlcihhcnJheSk7XG4gICAgICAgIGFycmF5Lm9ic2VydmVyLm9wZW4oZnVuY3Rpb24oc3BsaWNlcykge1xuICAgICAgICAgIHZhciBmaWVsZElzQXR0cmlidXRlID0gbW9kZWxJbnN0YW5jZS5fYXR0cmlidXRlTmFtZXMuaW5kZXhPZihmaWVsZCkgPiAtMTtcbiAgICAgICAgICBpZiAoZmllbGRJc0F0dHJpYnV0ZSkge1xuICAgICAgICAgICAgc3BsaWNlcy5mb3JFYWNoKGZ1bmN0aW9uKHNwbGljZSkge1xuICAgICAgICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBtb2RlbEluc3RhbmNlLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgICAgIG1vZGVsOiBtb2RlbEluc3RhbmNlLm1vZGVsLm5hbWUsXG4gICAgICAgICAgICAgICAgbG9jYWxJZDogbW9kZWxJbnN0YW5jZS5sb2NhbElkLFxuICAgICAgICAgICAgICAgIGluZGV4OiBzcGxpY2UuaW5kZXgsXG4gICAgICAgICAgICAgICAgcmVtb3ZlZDogc3BsaWNlLnJlbW92ZWQsXG4gICAgICAgICAgICAgICAgYWRkZWQ6IHNwbGljZS5hZGRlZENvdW50ID8gYXJyYXkuc2xpY2Uoc3BsaWNlLmluZGV4LCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCkgOiBbXSxcbiAgICAgICAgICAgICAgICB0eXBlOiBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgICAgICAgICAgICAgZmllbGQ6IGZpZWxkLFxuICAgICAgICAgICAgICAgIG9iajogbW9kZWxJbnN0YW5jZVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICB2YXIgb2xkRW1pdCA9IGV2ZW50RW1pdHRlci5lbWl0O1xuXG4gIC8vIEVuc3VyZSB0aGF0IGVycm9ycyBpbiBldmVudCBoYW5kbGVycyBkbyBub3Qgc3RhbGwgU2llc3RhLlxuICBldmVudEVtaXR0ZXIuZW1pdCA9IGZ1bmN0aW9uKGV2ZW50LCBwYXlsb2FkKSB7XG4gICAgdHJ5IHtcbiAgICAgIG9sZEVtaXQuY2FsbChldmVudEVtaXR0ZXIsIGV2ZW50LCBwYXlsb2FkKTtcbiAgICB9XG4gICAgY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgfVxuICB9O1xuXG4gIG1vZHVsZS5leHBvcnRzID0gZXZlbnRFbWl0dGVyO1xufSkoKTsiLCIoZnVuY3Rpb24oKSB7XG4gIHZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gICAgQ29sbGVjdGlvblJlZ2lzdHJ5ID0gcmVxdWlyZSgnLi9jb2xsZWN0aW9uUmVnaXN0cnknKS5Db2xsZWN0aW9uUmVnaXN0cnksXG4gICAgQ29sbGVjdGlvbiA9IHJlcXVpcmUoJy4vY29sbGVjdGlvbicpLFxuICAgIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpLFxuICAgIE1vZGVsID0gcmVxdWlyZSgnLi9tb2RlbCcpLFxuICAgIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLFxuICAgIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gICAgUmVsYXRpb25zaGlwVHlwZSA9IHJlcXVpcmUoJy4vUmVsYXRpb25zaGlwVHlwZScpLFxuICAgIFJlYWN0aXZlUXVlcnkgPSByZXF1aXJlKCcuL1JlYWN0aXZlUXVlcnknKSxcbiAgICBNYW55VG9NYW55UHJveHkgPSByZXF1aXJlKCcuL01hbnlUb01hbnlQcm94eScpLFxuICAgIE9uZVRvT25lUHJveHkgPSByZXF1aXJlKCcuL09uZVRvT25lUHJveHknKSxcbiAgICBPbmVUb01hbnlQcm94eSA9IHJlcXVpcmUoJy4vT25lVG9NYW55UHJveHknKSxcbiAgICBSZWxhdGlvbnNoaXBQcm94eSA9IHJlcXVpcmUoJy4vUmVsYXRpb25zaGlwUHJveHknKSxcbiAgICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgICBRdWVyeSA9IHJlcXVpcmUoJy4vUXVlcnknKSxcbiAgICBxdWVyeVNldCA9IHJlcXVpcmUoJy4vUXVlcnlTZXQnKSxcbiAgICBsb2cgPSByZXF1aXJlKCcuL2xvZycpO1xuICB1dGlsLl9wYXRjaEJpbmQoKTtcblxuICAvLyBJbml0aWFsaXNlIHNpZXN0YSBvYmplY3QuIFN0cmFuZ2UgZm9ybWF0IGZhY2lsaXRpZXMgdXNpbmcgc3VibW9kdWxlcyB3aXRoIHJlcXVpcmVKUyAoZXZlbnR1YWxseSlcbiAgdmFyIHNpZXN0YSA9IGZ1bmN0aW9uKGV4dCkge1xuICAgIGlmICghc2llc3RhLmV4dCkgc2llc3RhLmV4dCA9IHt9O1xuICAgIHV0aWwuZXh0ZW5kKHNpZXN0YS5leHQsIGV4dCB8fCB7fSk7XG4gICAgcmV0dXJuIHNpZXN0YTtcbiAgfTtcblxuICAvLyBOb3RpZmljYXRpb25zXG4gIHV0aWwuZXh0ZW5kKHNpZXN0YSwge1xuICAgIG9uOiBldmVudHMub24uYmluZChldmVudHMpLFxuICAgIG9mZjogZXZlbnRzLnJlbW92ZUxpc3RlbmVyLmJpbmQoZXZlbnRzKSxcbiAgICBvbmNlOiBldmVudHMub25jZS5iaW5kKGV2ZW50cyksXG4gICAgcmVtb3ZlQWxsTGlzdGVuZXJzOiBldmVudHMucmVtb3ZlQWxsTGlzdGVuZXJzLmJpbmQoZXZlbnRzKVxuICB9KTtcbiAgdXRpbC5leHRlbmQoc2llc3RhLCB7XG4gICAgcmVtb3ZlTGlzdGVuZXI6IHNpZXN0YS5vZmYsXG4gICAgYWRkTGlzdGVuZXI6IHNpZXN0YS5vblxuICB9KTtcblxuICAvLyBFeHBvc2Ugc29tZSBzdHVmZiBmb3IgdXNhZ2UgYnkgZXh0ZW5zaW9ucyBhbmQvb3IgdXNlcnNcbiAgdXRpbC5leHRlbmQoc2llc3RhLCB7XG4gICAgUmVsYXRpb25zaGlwVHlwZTogUmVsYXRpb25zaGlwVHlwZSxcbiAgICBNb2RlbEV2ZW50VHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUsXG4gICAgbG9nOiBsb2cuTGV2ZWwsXG4gICAgSW5zZXJ0aW9uUG9saWN5OiBSZWFjdGl2ZVF1ZXJ5Lkluc2VydGlvblBvbGljeSxcbiAgICBfaW50ZXJuYWw6IHtcbiAgICAgIGxvZzogbG9nLFxuICAgICAgTW9kZWw6IE1vZGVsLFxuICAgICAgZXJyb3I6IGVycm9yLFxuICAgICAgTW9kZWxFdmVudFR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLFxuICAgICAgTW9kZWxJbnN0YW5jZTogcmVxdWlyZSgnLi9Nb2RlbEluc3RhbmNlJyksXG4gICAgICBleHRlbmQ6IHJlcXVpcmUoJ2V4dGVuZCcpLFxuICAgICAgTWFwcGluZ09wZXJhdGlvbjogcmVxdWlyZSgnLi9tYXBwaW5nT3BlcmF0aW9uJyksXG4gICAgICBldmVudHM6IGV2ZW50cyxcbiAgICAgIFByb3h5RXZlbnRFbWl0dGVyOiBldmVudHMuUHJveHlFdmVudEVtaXR0ZXIsXG4gICAgICBjYWNoZTogcmVxdWlyZSgnLi9jYWNoZScpLFxuICAgICAgbW9kZWxFdmVudHM6IG1vZGVsRXZlbnRzLFxuICAgICAgQ29sbGVjdGlvblJlZ2lzdHJ5OiByZXF1aXJlKCcuL2NvbGxlY3Rpb25SZWdpc3RyeScpLkNvbGxlY3Rpb25SZWdpc3RyeSxcbiAgICAgIENvbGxlY3Rpb246IENvbGxlY3Rpb24sXG4gICAgICB1dGlsczogdXRpbCxcbiAgICAgIHV0aWw6IHV0aWwsXG4gICAgICBxdWVyeVNldDogcXVlcnlTZXQsXG4gICAgICBvYnNlcnZlOiByZXF1aXJlKCcuLi92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZScpLFxuICAgICAgUXVlcnk6IFF1ZXJ5LFxuICAgICAgTWFueVRvTWFueVByb3h5OiBNYW55VG9NYW55UHJveHksXG4gICAgICBPbmVUb01hbnlQcm94eTogT25lVG9NYW55UHJveHksXG4gICAgICBPbmVUb09uZVByb3h5OiBPbmVUb09uZVByb3h5LFxuICAgICAgUmVsYXRpb25zaGlwUHJveHk6IFJlbGF0aW9uc2hpcFByb3h5XG4gICAgfSxcbiAgICBhc3luYzogdXRpbC5hc3luYyxcbiAgICBpc0FycmF5OiB1dGlsLmlzQXJyYXksXG4gICAgaXNTdHJpbmc6IHV0aWwuaXNTdHJpbmdcbiAgfSk7XG5cbiAgc2llc3RhLmV4dCA9IHt9O1xuXG4gIHZhciBpbnN0YWxsZWQgPSBmYWxzZSxcbiAgICBpbnN0YWxsaW5nID0gZmFsc2U7XG5cblxuICB1dGlsLmV4dGVuZChzaWVzdGEsIHtcbiAgICAvKipcbiAgICAgKiBXaXBlIGV2ZXJ5dGhpbmcuIFVzZWQgZHVyaW5nIHRlc3QgZ2VuZXJhbGx5LlxuICAgICAqL1xuICAgIHJlc2V0OiBmdW5jdGlvbihjYiwgcmVzZXRTdG9yYWdlKSB7XG4gICAgICBpbnN0YWxsZWQgPSBmYWxzZTtcbiAgICAgIGluc3RhbGxpbmcgPSBmYWxzZTtcbiAgICAgIGRlbGV0ZSB0aGlzLnF1ZXVlZFRhc2tzO1xuICAgICAgY2FjaGUucmVzZXQoKTtcbiAgICAgIENvbGxlY3Rpb25SZWdpc3RyeS5yZXNldCgpO1xuICAgICAgZXZlbnRzLnJlbW92ZUFsbExpc3RlbmVycygpO1xuICAgICAgaWYgKHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQpIHtcbiAgICAgICAgcmVzZXRTdG9yYWdlID0gcmVzZXRTdG9yYWdlID09PSB1bmRlZmluZWQgPyB0cnVlIDogcmVzZXRTdG9yYWdlO1xuICAgICAgICBpZiAocmVzZXRTdG9yYWdlKSBzaWVzdGEuZXh0LnN0b3JhZ2UuX3Jlc2V0KGNiKTtcbiAgICAgICAgZWxzZSBjYigpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNiKCk7XG4gICAgICB9XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGFuZCByZWdpc3RlcnMgYSBuZXcgQ29sbGVjdGlvbi5cbiAgICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWVcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IFtvcHRzXVxuICAgICAqIEByZXR1cm4ge0NvbGxlY3Rpb259XG4gICAgICovXG4gICAgY29sbGVjdGlvbjogZnVuY3Rpb24obmFtZSwgb3B0cykge1xuICAgICAgdmFyIGMgPSBuZXcgQ29sbGVjdGlvbihuYW1lLCBvcHRzKTtcbiAgICAgIGlmIChpbnN0YWxsZWQpIGMuaW5zdGFsbGVkID0gdHJ1ZTsgLy8gVE9ETzogUmVtb3ZlXG4gICAgICByZXR1cm4gYztcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIEluc3RhbGwgYWxsIGNvbGxlY3Rpb25zLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYl1cbiAgICAgKiBAcmV0dXJucyB7cS5Qcm9taXNlfVxuICAgICAqL1xuICAgIGluc3RhbGw6IGZ1bmN0aW9uKGNiKSB7XG4gICAgICBpZiAoIWluc3RhbGxpbmcgJiYgIWluc3RhbGxlZCkge1xuICAgICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgICAgIGluc3RhbGxpbmcgPSB0cnVlO1xuICAgICAgICAgIHZhciBjb2xsZWN0aW9uTmFtZXMgPSBDb2xsZWN0aW9uUmVnaXN0cnkuY29sbGVjdGlvbk5hbWVzLFxuICAgICAgICAgICAgdGFza3MgPSBjb2xsZWN0aW9uTmFtZXMubWFwKGZ1bmN0aW9uKG4pIHtcbiAgICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb24gPSBDb2xsZWN0aW9uUmVnaXN0cnlbbl07XG4gICAgICAgICAgICAgIHJldHVybiBjb2xsZWN0aW9uLmluc3RhbGwuYmluZChjb2xsZWN0aW9uKTtcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgc3RvcmFnZUVuYWJsZWQgPSBzaWVzdGEuZXh0LnN0b3JhZ2VFbmFibGVkO1xuICAgICAgICAgIGlmIChzdG9yYWdlRW5hYmxlZCkgdGFza3MgPSB0YXNrcy5jb25jYXQoW3NpZXN0YS5leHQuc3RvcmFnZS5lbnN1cmVJbmRleGVzRm9yQWxsLCBzaWVzdGEuZXh0LnN0b3JhZ2UuX2xvYWRdKTtcbiAgICAgICAgICB0YXNrcy5wdXNoKGZ1bmN0aW9uKGRvbmUpIHtcbiAgICAgICAgICAgIGluc3RhbGxlZCA9IHRydWU7XG4gICAgICAgICAgICBpZiAodGhpcy5xdWV1ZWRUYXNrcykgdGhpcy5xdWV1ZWRUYXNrcy5leGVjdXRlKCk7XG4gICAgICAgICAgICBkb25lKCk7XG4gICAgICAgICAgfS5iaW5kKHRoaXMpKTtcblxuICAgICAgICAgIHNpZXN0YS5hc3luYy5zZXJpZXModGFza3MsIGNiKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgIH1cbiAgICAgIGVsc2UgY2IoZXJyb3IoJ2FscmVhZHkgaW5zdGFsbGluZycpKTtcbiAgICB9LFxuICAgIF9wdXNoVGFzazogZnVuY3Rpb24odGFzaykge1xuICAgICAgaWYgKCF0aGlzLnF1ZXVlZFRhc2tzKSB7XG4gICAgICAgIHRoaXMucXVldWVkVGFza3MgPSBuZXcgZnVuY3Rpb24gUXVldWUoKSB7XG4gICAgICAgICAgdGhpcy50YXNrcyA9IFtdO1xuICAgICAgICAgIHRoaXMuZXhlY3V0ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdGhpcy50YXNrcy5mb3JFYWNoKGZ1bmN0aW9uKGYpIHtcbiAgICAgICAgICAgICAgZigpXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHRoaXMudGFza3MgPSBbXTtcbiAgICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICB0aGlzLnF1ZXVlZFRhc2tzLnRhc2tzLnB1c2godGFzayk7XG4gICAgfSxcbiAgICBfYWZ0ZXJJbnN0YWxsOiBmdW5jdGlvbih0YXNrKSB7XG4gICAgICBpZiAoIWluc3RhbGxlZCkge1xuICAgICAgICBpZiAoIWluc3RhbGxpbmcpIHtcbiAgICAgICAgICB0aGlzLmluc3RhbGwoZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHNldHRpbmcgdXAgc2llc3RhJywgZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLnF1ZXVlZFRhc2tzO1xuICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gSW4gY2FzZSBpbnN0YWxsZWQgc3RyYWlnaHQgYXdheSBlLmcuIGlmIHN0b3JhZ2UgZXh0ZW5zaW9uIG5vdCBpbnN0YWxsZWQuXG4gICAgICAgIGlmICghaW5zdGFsbGVkKSB0aGlzLl9wdXNoVGFzayh0YXNrKTtcbiAgICAgICAgZWxzZSB0YXNrKCk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgdGFzaygpO1xuICAgICAgfVxuICAgIH0sXG4gICAgc2V0TG9nTGV2ZWw6IGZ1bmN0aW9uKGxvZ2dlck5hbWUsIGxldmVsKSB7XG4gICAgICB2YXIgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKGxvZ2dlck5hbWUpO1xuICAgICAgTG9nZ2VyLnNldExldmVsKGxldmVsKTtcbiAgICB9LFxuICAgIGdyYXBoOiBmdW5jdGlvbihkYXRhLCBvcHRzLCBjYikge1xuICAgICAgaWYgKHR5cGVvZiBvcHRzID09ICdmdW5jdGlvbicpIGNiID0gb3B0cztcbiAgICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgICAgdmFyIHRhc2tzID0gW10sIGVycjtcbiAgICAgICAgZm9yICh2YXIgY29sbGVjdGlvbk5hbWUgaW4gZGF0YSkge1xuICAgICAgICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KGNvbGxlY3Rpb25OYW1lKSkge1xuICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb24gPSBDb2xsZWN0aW9uUmVnaXN0cnlbY29sbGVjdGlvbk5hbWVdO1xuICAgICAgICAgICAgaWYgKGNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgKGZ1bmN0aW9uKGNvbGxlY3Rpb24sIGRhdGEpIHtcbiAgICAgICAgICAgICAgICB0YXNrcy5wdXNoKGZ1bmN0aW9uKGRvbmUpIHtcbiAgICAgICAgICAgICAgICAgIGNvbGxlY3Rpb24uZ3JhcGgoZGF0YSwgZnVuY3Rpb24oZXJyLCByZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICB2YXIgcmVzdWx0cyA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdHNbY29sbGVjdGlvbi5uYW1lXSA9IHJlcztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBkb25lKGVyciwgcmVzdWx0cyk7XG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSkoY29sbGVjdGlvbiwgZGF0YVtjb2xsZWN0aW9uTmFtZV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIGVyciA9ICdObyBzdWNoIGNvbGxlY3Rpb24gXCInICsgY29sbGVjdGlvbk5hbWUgKyAnXCInO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoIWVycikgdXRpbC5hc3luYy5zZXJpZXModGFza3MsIGZ1bmN0aW9uKGVyciwgcmVzdWx0cykge1xuICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICByZXN1bHRzID0gcmVzdWx0cy5yZWR1Y2UoZnVuY3Rpb24obWVtbywgcmVzKSB7XG4gICAgICAgICAgICAgIHJldHVybiB1dGlsLmV4dGVuZChtZW1vLCByZXMpO1xuICAgICAgICAgICAgfSwge30pXG4gICAgICAgICAgfSBlbHNlIHJlc3VsdHMgPSBudWxsO1xuICAgICAgICAgIGNiKGVyciwgcmVzdWx0cyk7XG4gICAgICAgIH0pO1xuICAgICAgICBlbHNlIGNiKGVycm9yKGVyciwge2RhdGE6IGRhdGEsIGludmFsaWRDb2xsZWN0aW9uTmFtZTogY29sbGVjdGlvbk5hbWV9KSk7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH0sXG4gICAgbm90aWZ5OiB1dGlsLm5leHQsXG4gICAgcmVnaXN0ZXJDb21wYXJhdG9yOiBRdWVyeS5yZWdpc3RlckNvbXBhcmF0b3IuYmluZChRdWVyeSksXG4gICAgY291bnQ6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIGNhY2hlLmNvdW50KCk7XG4gICAgfSxcbiAgICBnZXQ6IGZ1bmN0aW9uKGlkLCBjYikge1xuICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgICAgdGhpcy5fYWZ0ZXJJbnN0YWxsKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGNiKG51bGwsIGNhY2hlLl9sb2NhbENhY2hlKClbaWRdKTtcbiAgICAgICAgfSk7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH0sXG4gICAgcmVtb3ZlQWxsOiBmdW5jdGlvbihjYikge1xuICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgICAgdXRpbC5Qcm9taXNlLmFsbChcbiAgICAgICAgICBDb2xsZWN0aW9uUmVnaXN0cnkuY29sbGVjdGlvbk5hbWVzLm1hcChmdW5jdGlvbihjb2xsZWN0aW9uTmFtZSkge1xuICAgICAgICAgICAgcmV0dXJuIENvbGxlY3Rpb25SZWdpc3RyeVtjb2xsZWN0aW9uTmFtZV0ucmVtb3ZlQWxsKCk7XG4gICAgICAgICAgfS5iaW5kKHRoaXMpKVxuICAgICAgICApLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBjYihudWxsKTtcbiAgICAgICAgICB9KS5jYXRjaChjYilcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfVxuICB9KTtcblxuICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyhzaWVzdGEsIHtcbiAgICBfY2FuQ2hhbmdlOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gIShpbnN0YWxsaW5nIHx8IGluc3RhbGxlZCk7XG4gICAgICB9XG4gICAgfSxcbiAgICBpbnN0YWxsZWQ6IHtcbiAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gaW5zdGFsbGVkO1xuICAgICAgfVxuICAgIH1cbiAgfSk7XG5cbiAgaWYgKHR5cGVvZiB3aW5kb3cgIT0gJ3VuZGVmaW5lZCcpIHtcbiAgICB3aW5kb3dbJ3NpZXN0YSddID0gc2llc3RhO1xuICB9XG5cbiAgc2llc3RhLmxvZyA9IHJlcXVpcmUoJ2RlYnVnJyk7XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBzaWVzdGE7XG5cbiAgKGZ1bmN0aW9uIGxvYWRFeHRlbnNpb25zKCkge1xuICAgIHJlcXVpcmUoJy4uL3N0b3JhZ2UnKTtcbiAgfSkoKTtcblxufSkoKTsiLCIoZnVuY3Rpb24oKSB7XG4gIHZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpKCdtb2RlbCcpLFxuICAgIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgICBSZWxhdGlvbnNoaXBUeXBlID0gcmVxdWlyZSgnLi9SZWxhdGlvbnNoaXBUeXBlJyksXG4gICAgUXVlcnkgPSByZXF1aXJlKCcuL1F1ZXJ5JyksXG4gICAgTW9kZWxJbnN0YW5jZSA9IHJlcXVpcmUoJy4vTW9kZWxJbnN0YW5jZScpLFxuICAgIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICBndWlkID0gdXRpbC5ndWlkLFxuICAgIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpLFxuICAgIGV4dGVuZCA9IHJlcXVpcmUoJ2V4dGVuZCcpLFxuICAgIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICAgIHdyYXBBcnJheSA9IHJlcXVpcmUoJy4vZXZlbnRzJykud3JhcEFycmF5LFxuICAgIE9uZVRvTWFueVByb3h5ID0gcmVxdWlyZSgnLi9PbmVUb01hbnlQcm94eScpLFxuICAgIE9uZVRvT25lUHJveHkgPSByZXF1aXJlKCcuL09uZVRvT25lUHJveHknKSxcbiAgICBNYW55VG9NYW55UHJveHkgPSByZXF1aXJlKCcuL01hbnlUb01hbnlQcm94eScpLFxuICAgIFJlYWN0aXZlUXVlcnkgPSByZXF1aXJlKCcuL1JlYWN0aXZlUXVlcnknKSxcbiAgICBNb2RlbEV2ZW50VHlwZSA9IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlO1xuXG4gIGZ1bmN0aW9uIE1vZGVsSW5zdGFuY2VGYWN0b3J5KG1vZGVsKSB7XG4gICAgdGhpcy5tb2RlbCA9IG1vZGVsO1xuICB9XG5cbiAgTW9kZWxJbnN0YW5jZUZhY3RvcnkucHJvdG90eXBlID0ge1xuICAgIF9nZXRMb2NhbElkOiBmdW5jdGlvbihkYXRhKSB7XG4gICAgICB2YXIgbG9jYWxJZDtcbiAgICAgIGlmIChkYXRhKSB7XG4gICAgICAgIGxvY2FsSWQgPSBkYXRhLmxvY2FsSWQgPyBkYXRhLmxvY2FsSWQgOiBndWlkKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsb2NhbElkID0gZ3VpZCgpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGxvY2FsSWQ7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBDb25maWd1cmUgYXR0cmlidXRlc1xuICAgICAqIEBwYXJhbSBtb2RlbEluc3RhbmNlXG4gICAgICogQHBhcmFtIGRhdGFcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuXG4gICAgX2luc3RhbGxBdHRyaWJ1dGVzOiBmdW5jdGlvbihtb2RlbEluc3RhbmNlLCBkYXRhKSB7XG4gICAgICB2YXIgTW9kZWwgPSB0aGlzLm1vZGVsLFxuICAgICAgICBhdHRyaWJ1dGVOYW1lcyA9IE1vZGVsLl9hdHRyaWJ1dGVOYW1lcyxcbiAgICAgICAgaWR4ID0gYXR0cmlidXRlTmFtZXMuaW5kZXhPZihNb2RlbC5pZCk7XG4gICAgICB1dGlsLmV4dGVuZChtb2RlbEluc3RhbmNlLCB7XG4gICAgICAgIF9fdmFsdWVzOiB1dGlsLmV4dGVuZChNb2RlbC5hdHRyaWJ1dGVzLnJlZHVjZShmdW5jdGlvbihtLCBhKSB7XG4gICAgICAgICAgaWYgKGEuZGVmYXVsdCAhPT0gdW5kZWZpbmVkKSBtW2EubmFtZV0gPSBhLmRlZmF1bHQ7XG4gICAgICAgICAgcmV0dXJuIG07XG4gICAgICAgIH0sIHt9KSwgZGF0YSB8fCB7fSlcbiAgICAgIH0pO1xuICAgICAgaWYgKGlkeCA+IC0xKSBhdHRyaWJ1dGVOYW1lcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgIGF0dHJpYnV0ZU5hbWVzLmZvckVhY2goZnVuY3Rpb24oYXR0cmlidXRlTmFtZSkge1xuICAgICAgICB2YXIgYXR0cmlidXRlRGVmaW5pdGlvbiA9IE1vZGVsLl9hdHRyaWJ1dGVEZWZpbml0aW9uV2l0aE5hbWUoYXR0cmlidXRlTmFtZSk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShtb2RlbEluc3RhbmNlLCBhdHRyaWJ1dGVOYW1lLCB7XG4gICAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciB2YWx1ZSA9IG1vZGVsSW5zdGFuY2UuX192YWx1ZXNbYXR0cmlidXRlTmFtZV07XG4gICAgICAgICAgICByZXR1cm4gdmFsdWUgPT09IHVuZGVmaW5lZCA/IG51bGwgOiB2YWx1ZTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIHNldDogZnVuY3Rpb24odikge1xuICAgICAgICAgICAgaWYgKGF0dHJpYnV0ZURlZmluaXRpb24ucGFyc2UpIHtcbiAgICAgICAgICAgICAgdiA9IGF0dHJpYnV0ZURlZmluaXRpb24ucGFyc2UuY2FsbChtb2RlbEluc3RhbmNlLCB2KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChNb2RlbC5wYXJzZUF0dHJpYnV0ZSkge1xuICAgICAgICAgICAgICB2ID0gTW9kZWwucGFyc2VBdHRyaWJ1dGUuY2FsbChtb2RlbEluc3RhbmNlLCBhdHRyaWJ1dGVOYW1lLCB2KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciBvbGQgPSBtb2RlbEluc3RhbmNlLl9fdmFsdWVzW2F0dHJpYnV0ZU5hbWVdO1xuICAgICAgICAgICAgdmFyIHByb3BlcnR5RGVwZW5kZW5jaWVzID0gdGhpcy5fcHJvcGVydHlEZXBlbmRlbmNpZXNbYXR0cmlidXRlTmFtZV0gfHwgW107XG4gICAgICAgICAgICBwcm9wZXJ0eURlcGVuZGVuY2llcyA9IHByb3BlcnR5RGVwZW5kZW5jaWVzLm1hcChmdW5jdGlvbihkZXBlbmRhbnQpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBwcm9wOiBkZXBlbmRhbnQsXG4gICAgICAgICAgICAgICAgb2xkOiB0aGlzW2RlcGVuZGFudF1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcblxuICAgICAgICAgICAgbW9kZWxJbnN0YW5jZS5fX3ZhbHVlc1thdHRyaWJ1dGVOYW1lXSA9IHY7XG4gICAgICAgICAgICBwcm9wZXJ0eURlcGVuZGVuY2llcy5mb3JFYWNoKGZ1bmN0aW9uKGRlcCkge1xuICAgICAgICAgICAgICB2YXIgcHJvcGVydHlOYW1lID0gZGVwLnByb3A7XG4gICAgICAgICAgICAgIHZhciBuZXdfID0gdGhpc1twcm9wZXJ0eU5hbWVdO1xuICAgICAgICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBNb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICBtb2RlbDogTW9kZWwubmFtZSxcbiAgICAgICAgICAgICAgICBsb2NhbElkOiBtb2RlbEluc3RhbmNlLmxvY2FsSWQsXG4gICAgICAgICAgICAgICAgbmV3OiBuZXdfLFxuICAgICAgICAgICAgICAgIG9sZDogZGVwLm9sZCxcbiAgICAgICAgICAgICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5TZXQsXG4gICAgICAgICAgICAgICAgZmllbGQ6IHByb3BlcnR5TmFtZSxcbiAgICAgICAgICAgICAgICBvYmo6IG1vZGVsSW5zdGFuY2VcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgICAgdmFyIGUgPSB7XG4gICAgICAgICAgICAgIGNvbGxlY3Rpb246IE1vZGVsLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgICBtb2RlbDogTW9kZWwubmFtZSxcbiAgICAgICAgICAgICAgbG9jYWxJZDogbW9kZWxJbnN0YW5jZS5sb2NhbElkLFxuICAgICAgICAgICAgICBuZXc6IHYsXG4gICAgICAgICAgICAgIG9sZDogb2xkLFxuICAgICAgICAgICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5TZXQsXG4gICAgICAgICAgICAgIGZpZWxkOiBhdHRyaWJ1dGVOYW1lLFxuICAgICAgICAgICAgICBvYmo6IG1vZGVsSW5zdGFuY2VcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB3aW5kb3cubGFzdEVtaXNzaW9uID0gZTtcbiAgICAgICAgICAgIG1vZGVsRXZlbnRzLmVtaXQoZSk7XG4gICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KHYpKSB7XG4gICAgICAgICAgICAgIHdyYXBBcnJheSh2LCBhdHRyaWJ1dGVOYW1lLCBtb2RlbEluc3RhbmNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LFxuICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSxcbiAgICBfaW5zdGFsbE1ldGhvZHM6IGZ1bmN0aW9uKG1vZGVsSW5zdGFuY2UpIHtcbiAgICAgIHZhciBNb2RlbCA9IHRoaXMubW9kZWw7XG4gICAgICBPYmplY3Qua2V5cyhNb2RlbC5tZXRob2RzKS5mb3JFYWNoKGZ1bmN0aW9uKG1ldGhvZE5hbWUpIHtcbiAgICAgICAgaWYgKG1vZGVsSW5zdGFuY2VbbWV0aG9kTmFtZV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIG1vZGVsSW5zdGFuY2VbbWV0aG9kTmFtZV0gPSBNb2RlbC5tZXRob2RzW21ldGhvZE5hbWVdLmJpbmQobW9kZWxJbnN0YW5jZSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgbG9nKCdBIG1ldGhvZCB3aXRoIG5hbWUgXCInICsgbWV0aG9kTmFtZSArICdcIiBhbHJlYWR5IGV4aXN0cy4gSWdub3JpbmcgaXQuJyk7XG4gICAgICAgIH1cbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfSxcbiAgICBfaW5zdGFsbFByb3BlcnRpZXM6IGZ1bmN0aW9uKG1vZGVsSW5zdGFuY2UpIHtcbiAgICAgIHZhciBfcHJvcGVydHlOYW1lcyA9IE9iamVjdC5rZXlzKHRoaXMubW9kZWwucHJvcGVydGllcyksXG4gICAgICAgIF9wcm9wZXJ0eURlcGVuZGVuY2llcyA9IHt9O1xuICAgICAgX3Byb3BlcnR5TmFtZXMuZm9yRWFjaChmdW5jdGlvbihwcm9wTmFtZSkge1xuICAgICAgICB2YXIgcHJvcERlZiA9IHRoaXMubW9kZWwucHJvcGVydGllc1twcm9wTmFtZV07XG4gICAgICAgIHZhciBkZXBlbmRlbmNpZXMgPSBwcm9wRGVmLmRlcGVuZGVuY2llcyB8fCBbXTtcbiAgICAgICAgZGVwZW5kZW5jaWVzLmZvckVhY2goZnVuY3Rpb24oYXR0cikge1xuICAgICAgICAgIGlmICghX3Byb3BlcnR5RGVwZW5kZW5jaWVzW2F0dHJdKSBfcHJvcGVydHlEZXBlbmRlbmNpZXNbYXR0cl0gPSBbXTtcbiAgICAgICAgICBfcHJvcGVydHlEZXBlbmRlbmNpZXNbYXR0cl0ucHVzaChwcm9wTmFtZSk7XG4gICAgICAgIH0pO1xuICAgICAgICBkZWxldGUgcHJvcERlZi5kZXBlbmRlbmNpZXM7XG4gICAgICAgIGlmIChtb2RlbEluc3RhbmNlW3Byb3BOYW1lXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG1vZGVsSW5zdGFuY2UsIHByb3BOYW1lLCBwcm9wRGVmKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBsb2coJ0EgcHJvcGVydHkvbWV0aG9kIHdpdGggbmFtZSBcIicgKyBwcm9wTmFtZSArICdcIiBhbHJlYWR5IGV4aXN0cy4gSWdub3JpbmcgaXQuJyk7XG4gICAgICAgIH1cbiAgICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICAgIG1vZGVsSW5zdGFuY2UuX3Byb3BlcnR5RGVwZW5kZW5jaWVzID0gX3Byb3BlcnR5RGVwZW5kZW5jaWVzO1xuICAgIH0sXG4gICAgX2luc3RhbGxSZW1vdGVJZDogZnVuY3Rpb24obW9kZWxJbnN0YW5jZSkge1xuICAgICAgdmFyIE1vZGVsID0gdGhpcy5tb2RlbDtcbiAgICAgIHZhciBpZEZpZWxkID0gTW9kZWwuaWQ7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobW9kZWxJbnN0YW5jZSwgaWRGaWVsZCwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiBtb2RlbEluc3RhbmNlLl9fdmFsdWVzW01vZGVsLmlkXSB8fCBudWxsO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uKHYpIHtcbiAgICAgICAgICB2YXIgb2xkID0gbW9kZWxJbnN0YW5jZVtNb2RlbC5pZF07XG4gICAgICAgICAgbW9kZWxJbnN0YW5jZS5fX3ZhbHVlc1tNb2RlbC5pZF0gPSB2O1xuICAgICAgICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgICAgICAgICAgY29sbGVjdGlvbjogTW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICBtb2RlbDogTW9kZWwubmFtZSxcbiAgICAgICAgICAgIGxvY2FsSWQ6IG1vZGVsSW5zdGFuY2UubG9jYWxJZCxcbiAgICAgICAgICAgIG5ldzogdixcbiAgICAgICAgICAgIG9sZDogb2xkLFxuICAgICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU2V0LFxuICAgICAgICAgICAgZmllbGQ6IE1vZGVsLmlkLFxuICAgICAgICAgICAgb2JqOiBtb2RlbEluc3RhbmNlXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgY2FjaGUucmVtb3RlSW5zZXJ0KG1vZGVsSW5zdGFuY2UsIHYsIG9sZCk7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgfSk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBAcGFyYW0gZGVmaW5pdGlvbiAtIERlZmluaXRpb24gb2YgYSByZWxhdGlvbnNoaXBcbiAgICAgKiBAcGFyYW0gbW9kZWxJbnN0YW5jZSAtIEluc3RhbmNlIG9mIHdoaWNoIHRvIGluc3RhbGwgdGhlIHJlbGF0aW9uc2hpcC5cbiAgICAgKi9cbiAgICBfaW5zdGFsbFJlbGF0aW9uc2hpcDogZnVuY3Rpb24oZGVmaW5pdGlvbiwgbW9kZWxJbnN0YW5jZSkge1xuICAgICAgY29uc29sZS5sb2coJ2luc3RhbGxpbmcgZGVmJywgZGVmaW5pdGlvbiwgbW9kZWxJbnN0YW5jZSk7XG4gICAgICB2YXIgcHJveHk7XG4gICAgICB2YXIgdHlwZSA9IGRlZmluaXRpb24udHlwZTtcbiAgICAgIGlmICh0eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuT25lVG9NYW55KSB7XG4gICAgICAgIHByb3h5ID0gbmV3IE9uZVRvTWFueVByb3h5KGRlZmluaXRpb24pO1xuICAgICAgfVxuICAgICAgZWxzZSBpZiAodHlwZSA9PSBSZWxhdGlvbnNoaXBUeXBlLk9uZVRvT25lKSB7XG4gICAgICAgIHByb3h5ID0gbmV3IE9uZVRvT25lUHJveHkoZGVmaW5pdGlvbik7XG4gICAgICB9XG4gICAgICBlbHNlIGlmICh0eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuTWFueVRvTWFueSkge1xuICAgICAgICBwcm94eSA9IG5ldyBNYW55VG9NYW55UHJveHkoZGVmaW5pdGlvbik7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ05vIHN1Y2ggcmVsYXRpb25zaGlwIHR5cGU6ICcgKyB0eXBlKTtcbiAgICAgIH1cbiAgICAgIHByb3h5Lmluc3RhbGwobW9kZWxJbnN0YW5jZSk7XG4gICAgfSxcbiAgICBfaW5zdGFsbFJlbGF0aW9uc2hpcFByb3hpZXM6IGZ1bmN0aW9uKG1vZGVsSW5zdGFuY2UpIHtcbiAgICAgIHZhciBtb2RlbCA9IHRoaXMubW9kZWw7XG4gICAgICBmb3IgKHZhciBuYW1lIGluIG1vZGVsLnJlbGF0aW9uc2hpcHMpIHtcbiAgICAgICAgaWYgKG1vZGVsLnJlbGF0aW9uc2hpcHMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgICB2YXIgZGVmaW5pdGlvbiA9IHV0aWwuZXh0ZW5kKHt9LCBtb2RlbC5yZWxhdGlvbnNoaXBzW25hbWVdKTtcbiAgICAgICAgICB0aGlzLl9pbnN0YWxsUmVsYXRpb25zaGlwKGRlZmluaXRpb24sIG1vZGVsSW5zdGFuY2UpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcbiAgICBfcmVnaXN0ZXJJbnN0YW5jZTogZnVuY3Rpb24obW9kZWxJbnN0YW5jZSwgc2hvdWxkUmVnaXN0ZXJDaGFuZ2UpIHtcbiAgICAgIGNhY2hlLmluc2VydChtb2RlbEluc3RhbmNlKTtcbiAgICAgIHNob3VsZFJlZ2lzdGVyQ2hhbmdlID0gc2hvdWxkUmVnaXN0ZXJDaGFuZ2UgPT09IHVuZGVmaW5lZCA/IHRydWUgOiBzaG91bGRSZWdpc3RlckNoYW5nZTtcbiAgICAgIGlmIChzaG91bGRSZWdpc3RlckNoYW5nZSkgbW9kZWxJbnN0YW5jZS5fZW1pdE5ldygpO1xuICAgIH0sXG4gICAgX2luc3RhbGxMb2NhbElkOiBmdW5jdGlvbihtb2RlbEluc3RhbmNlLCBkYXRhKSB7XG4gICAgICBtb2RlbEluc3RhbmNlLmxvY2FsSWQgPSB0aGlzLl9nZXRMb2NhbElkKGRhdGEpO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogQ29udmVydCByYXcgZGF0YSBpbnRvIGEgTW9kZWxJbnN0YW5jZVxuICAgICAqIEByZXR1cm5zIHtNb2RlbEluc3RhbmNlfVxuICAgICAqL1xuICAgIF9pbnN0YW5jZTogZnVuY3Rpb24oZGF0YSwgc2hvdWxkUmVnaXN0ZXJDaGFuZ2UpIHtcbiAgICAgIGlmICghdGhpcy5tb2RlbC5fcmVsYXRpb25zaGlwc0luc3RhbGxlZCB8fCAhdGhpcy5tb2RlbC5fcmV2ZXJzZVJlbGF0aW9uc2hpcHNJbnN0YWxsZWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ01vZGVsIG11c3QgYmUgZnVsbHkgaW5zdGFsbGVkIGJlZm9yZSBjcmVhdGluZyBhbnkgbW9kZWxzJyk7XG4gICAgICB9XG4gICAgICB2YXIgbW9kZWxJbnN0YW5jZSA9IG5ldyBNb2RlbEluc3RhbmNlKHRoaXMubW9kZWwpO1xuICAgICAgdGhpcy5faW5zdGFsbExvY2FsSWQobW9kZWxJbnN0YW5jZSwgZGF0YSk7XG4gICAgICB0aGlzLl9pbnN0YWxsQXR0cmlidXRlcyhtb2RlbEluc3RhbmNlLCBkYXRhKTtcbiAgICAgIHRoaXMuX2luc3RhbGxNZXRob2RzKG1vZGVsSW5zdGFuY2UpO1xuICAgICAgdGhpcy5faW5zdGFsbFByb3BlcnRpZXMobW9kZWxJbnN0YW5jZSk7XG4gICAgICB0aGlzLl9pbnN0YWxsUmVtb3RlSWQobW9kZWxJbnN0YW5jZSk7XG4gICAgICB0aGlzLl9pbnN0YWxsUmVsYXRpb25zaGlwUHJveGllcyhtb2RlbEluc3RhbmNlKTtcbiAgICAgIHRoaXMuX3JlZ2lzdGVySW5zdGFuY2UobW9kZWxJbnN0YW5jZSwgc2hvdWxkUmVnaXN0ZXJDaGFuZ2UpO1xuICAgICAgcmV0dXJuIG1vZGVsSW5zdGFuY2U7XG4gICAgfVxuICB9O1xuXG4gIG1vZHVsZS5leHBvcnRzID0gTW9kZWxJbnN0YW5jZUZhY3Rvcnk7XG59KSgpOyIsIihmdW5jdGlvbigpIHtcbiAgLyoqXG4gICAqIERlYWQgc2ltcGxlIGxvZ2dpbmcgc2VydmljZSBiYXNlZCBvbiB2aXNpb25tZWRpYS9kZWJ1Z1xuICAgKiBAbW9kdWxlIGxvZ1xuICAgKi9cblxuICB2YXIgZGVidWcgPSByZXF1aXJlKCdkZWJ1ZycpLFxuICAgIGFyZ3NhcnJheSA9IHJlcXVpcmUoJ2FyZ3NhcnJheScpO1xuXG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBsb2cgPSBkZWJ1Zygnc2llc3RhOicgKyBuYW1lKTtcbiAgICB2YXIgZm4gPSBhcmdzYXJyYXkoZnVuY3Rpb24oYXJncykge1xuICAgICAgbG9nLmNhbGwobG9nLCBhcmdzKTtcbiAgICB9KTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZm4sICdlbmFibGVkJywge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGRlYnVnLmVuYWJsZWQobmFtZSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIGZuO1xuICB9O1xufSkoKTsiLCIoZnVuY3Rpb24oKSB7XG4gIHZhciBNb2RlbEluc3RhbmNlID0gcmVxdWlyZSgnLi9Nb2RlbEluc3RhbmNlJyksXG4gICAgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSgnZ3JhcGgnKSxcbiAgICBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKSxcbiAgICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gICAgYXN5bmMgPSB1dGlsLmFzeW5jO1xuXG4gIGZ1bmN0aW9uIFNpZXN0YUVycm9yKG9wdHMpIHtcbiAgICB0aGlzLm9wdHMgPSBvcHRzO1xuICB9XG5cbiAgU2llc3RhRXJyb3IucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHRoaXMub3B0cywgbnVsbCwgNCk7XG4gIH07XG5cbiAgLyoqXG4gICAqIEVuY2Fwc3VsYXRlcyB0aGUgaWRlYSBvZiBtYXBwaW5nIGFycmF5cyBvZiBkYXRhIG9udG8gdGhlIG9iamVjdCBncmFwaCBvciBhcnJheXMgb2Ygb2JqZWN0cy5cbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdHNcbiAgICogQHBhcmFtIG9wdHMubW9kZWxcbiAgICogQHBhcmFtIG9wdHMuZGF0YVxuICAgKiBAcGFyYW0gb3B0cy5vYmplY3RzXG4gICAqIEBwYXJhbSBvcHRzLmRpc2FibGVOb3RpZmljYXRpb25zXG4gICAqL1xuICBmdW5jdGlvbiBNYXBwaW5nT3BlcmF0aW9uKG9wdHMpIHtcbiAgICB0aGlzLl9vcHRzID0gb3B0cztcblxuICAgIHV0aWwuZXh0ZW5kRnJvbU9wdHModGhpcywgb3B0cywge1xuICAgICAgbW9kZWw6IG51bGwsXG4gICAgICBkYXRhOiBudWxsLFxuICAgICAgb2JqZWN0czogW10sXG4gICAgICBkaXNhYmxlZXZlbnRzOiBmYWxzZSxcbiAgICAgIF9pZ25vcmVJbnN0YWxsZWQ6IGZhbHNlLFxuICAgICAgZnJvbVN0b3JhZ2U6IGZhbHNlXG4gICAgfSk7XG5cbiAgICB1dGlsLmV4dGVuZCh0aGlzLCB7XG4gICAgICBlcnJvcnM6IFtdLFxuICAgICAgc3ViVGFza1Jlc3VsdHM6IHt9LFxuICAgICAgX25ld09iamVjdHM6IFtdXG4gICAgfSk7XG5cblxuICAgIHRoaXMubW9kZWwuX2luc3RhbGxSZXZlcnNlUGxhY2Vob2xkZXJzKCk7XG4gICAgdGhpcy5kYXRhID0gdGhpcy5wcmVwcm9jZXNzRGF0YSgpO1xuICB9XG5cbiAgdXRpbC5leHRlbmQoTWFwcGluZ09wZXJhdGlvbi5wcm90b3R5cGUsIHtcbiAgICBtYXBBdHRyaWJ1dGVzOiBmdW5jdGlvbigpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5kYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBkYXR1bSA9IHRoaXMuZGF0YVtpXSxcbiAgICAgICAgICBvYmplY3QgPSB0aGlzLm9iamVjdHNbaV07XG4gICAgICAgIC8vIE5vIHBvaW50IG1hcHBpbmcgb2JqZWN0IG9udG8gaXRzZWxmLiBUaGlzIGhhcHBlbnMgaWYgYSBNb2RlbEluc3RhbmNlIGlzIHBhc3NlZCBhcyBhIHJlbGF0aW9uc2hpcC5cbiAgICAgICAgaWYgKGRhdHVtICE9IG9iamVjdCkge1xuICAgICAgICAgIGlmIChvYmplY3QpIHsgLy8gSWYgb2JqZWN0IGlzIGZhbHN5LCB0aGVuIHRoZXJlIHdhcyBhbiBlcnJvciBsb29raW5nIHVwIHRoYXQgb2JqZWN0L2NyZWF0aW5nIGl0LlxuICAgICAgICAgICAgdmFyIGZpZWxkcyA9IHRoaXMubW9kZWwuX2F0dHJpYnV0ZU5hbWVzO1xuICAgICAgICAgICAgZmllbGRzLmZvckVhY2goZnVuY3Rpb24oZikge1xuICAgICAgICAgICAgICBpZiAoZGF0dW1bZl0gIT09IHVuZGVmaW5lZCkgeyAvLyBudWxsIGlzIGZpbmVcbiAgICAgICAgICAgICAgICAvLyBJZiBldmVudHMgYXJlIGRpc2FibGVkIHdlIHVwZGF0ZSBfX3ZhbHVlcyBvYmplY3QgZGlyZWN0bHkuIFRoaXMgYXZvaWRzIHRyaWdnZXJpbmdcbiAgICAgICAgICAgICAgICAvLyBldmVudHMgd2hpY2ggYXJlIGJ1aWx0IGludG8gdGhlIHNldCBmdW5jdGlvbiBvZiB0aGUgcHJvcGVydHkuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZGlzYWJsZWV2ZW50cykge1xuICAgICAgICAgICAgICAgICAgb2JqZWN0Ll9fdmFsdWVzW2ZdID0gZGF0dW1bZl07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgb2JqZWN0W2ZdID0gZGF0dW1bZl07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgICAgLy8gUG91Y2hEQiByZXZpc2lvbiAoaWYgdXNpbmcgc3RvcmFnZSBtb2R1bGUpLlxuICAgICAgICAgICAgLy8gVE9ETzogQ2FuIHRoaXMgYmUgcHVsbGVkIG91dCBvZiBjb3JlP1xuICAgICAgICAgICAgaWYgKGRhdHVtLl9yZXYpIG9iamVjdC5fcmV2ID0gZGF0dW0uX3JldjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIF9tYXA6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgdmFyIGVycjtcbiAgICAgIHRoaXMubWFwQXR0cmlidXRlcygpO1xuICAgICAgdmFyIHJlbGF0aW9uc2hpcEZpZWxkcyA9IE9iamVjdC5rZXlzKHNlbGYuc3ViVGFza1Jlc3VsdHMpO1xuICAgICAgcmVsYXRpb25zaGlwRmllbGRzLmZvckVhY2goZnVuY3Rpb24oZikge1xuICAgICAgICB2YXIgcmVzID0gc2VsZi5zdWJUYXNrUmVzdWx0c1tmXTtcbiAgICAgICAgdmFyIGluZGV4ZXMgPSByZXMuaW5kZXhlcyxcbiAgICAgICAgICBvYmplY3RzID0gcmVzLm9iamVjdHM7XG4gICAgICAgIHZhciByZWxhdGVkRGF0YSA9IHNlbGYuZ2V0UmVsYXRlZERhdGEoZikucmVsYXRlZERhdGE7XG4gICAgICAgIHZhciB1bmZsYXR0ZW5lZE9iamVjdHMgPSB1dGlsLnVuZmxhdHRlbkFycmF5KG9iamVjdHMsIHJlbGF0ZWREYXRhKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB1bmZsYXR0ZW5lZE9iamVjdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICB2YXIgaWR4ID0gaW5kZXhlc1tpXTtcbiAgICAgICAgICAvLyBFcnJvcnMgYXJlIHBsdWNrZWQgZnJvbSB0aGUgc3Vib3BlcmF0aW9ucy5cbiAgICAgICAgICB2YXIgZXJyb3IgPSBzZWxmLmVycm9yc1tpZHhdO1xuICAgICAgICAgIGVyciA9IGVycm9yID8gZXJyb3JbZl0gOiBudWxsO1xuICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICB2YXIgcmVsYXRlZCA9IHVuZmxhdHRlbmVkT2JqZWN0c1tpXTsgLy8gQ2FuIGJlIGFycmF5IG9yIHNjYWxhci5cbiAgICAgICAgICAgIHZhciBvYmplY3QgPSBzZWxmLm9iamVjdHNbaWR4XTtcbiAgICAgICAgICAgIGlmIChvYmplY3QpIHtcbiAgICAgICAgICAgICAgZXJyID0gb2JqZWN0Ll9fcHJveGllc1tmXS5zZXQocmVsYXRlZCwge2Rpc2FibGVldmVudHM6IHNlbGYuZGlzYWJsZWV2ZW50c30pO1xuICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFzZWxmLmVycm9yc1tpZHhdKSBzZWxmLmVycm9yc1tpZHhdID0ge307XG4gICAgICAgICAgICAgICAgc2VsZi5lcnJvcnNbaWR4XVtmXSA9IGVycjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBGaWd1cmUgb3V0IHdoaWNoIGRhdGEgaXRlbXMgcmVxdWlyZSBhIGNhY2hlIGxvb2t1cC5cbiAgICAgKiBAcmV0dXJucyB7e3JlbW90ZUxvb2t1cHM6IEFycmF5LCBsb2NhbExvb2t1cHM6IEFycmF5fX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9zb3J0TG9va3VwczogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgcmVtb3RlTG9va3VwcyA9IFtdO1xuICAgICAgdmFyIGxvY2FsTG9va3VwcyA9IFtdO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKCF0aGlzLm9iamVjdHNbaV0pIHtcbiAgICAgICAgICB2YXIgbG9va3VwO1xuICAgICAgICAgIHZhciBkYXR1bSA9IHRoaXMuZGF0YVtpXTtcbiAgICAgICAgICB2YXIgaXNTY2FsYXIgPSB0eXBlb2YgZGF0dW0gPT0gJ3N0cmluZycgfHwgdHlwZW9mIGRhdHVtID09ICdudW1iZXInIHx8IGRhdHVtIGluc3RhbmNlb2YgU3RyaW5nO1xuICAgICAgICAgIGlmIChkYXR1bSkge1xuICAgICAgICAgICAgaWYgKGlzU2NhbGFyKSB7XG4gICAgICAgICAgICAgIGxvb2t1cCA9IHtcbiAgICAgICAgICAgICAgICBpbmRleDogaSxcbiAgICAgICAgICAgICAgICBkYXR1bToge31cbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgbG9va3VwLmRhdHVtW3RoaXMubW9kZWwuaWRdID0gZGF0dW07XG4gICAgICAgICAgICAgIHJlbW90ZUxvb2t1cHMucHVzaChsb29rdXApO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkYXR1bSBpbnN0YW5jZW9mIE1vZGVsSW5zdGFuY2UpIHsgLy8gV2Ugd29uJ3QgbmVlZCB0byBwZXJmb3JtIGFueSBtYXBwaW5nLlxuICAgICAgICAgICAgICB0aGlzLm9iamVjdHNbaV0gPSBkYXR1bTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZGF0dW0ubG9jYWxJZCkge1xuICAgICAgICAgICAgICBsb2NhbExvb2t1cHMucHVzaCh7XG4gICAgICAgICAgICAgICAgaW5kZXg6IGksXG4gICAgICAgICAgICAgICAgZGF0dW06IGRhdHVtXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkYXR1bVt0aGlzLm1vZGVsLmlkXSkge1xuICAgICAgICAgICAgICByZW1vdGVMb29rdXBzLnB1c2goe1xuICAgICAgICAgICAgICAgIGluZGV4OiBpLFxuICAgICAgICAgICAgICAgIGRhdHVtOiBkYXR1bVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHRoaXMub2JqZWN0c1tpXSA9IHRoaXMuX2luc3RhbmNlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMub2JqZWN0c1tpXSA9IG51bGw7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4ge3JlbW90ZUxvb2t1cHM6IHJlbW90ZUxvb2t1cHMsIGxvY2FsTG9va3VwczogbG9jYWxMb29rdXBzfTtcbiAgICB9LFxuICAgIF9wZXJmb3JtTG9jYWxMb29rdXBzOiBmdW5jdGlvbihsb2NhbExvb2t1cHMpIHtcbiAgICAgIHZhciBsb2NhbElkZW50aWZpZXJzID0gdXRpbC5wbHVjayh1dGlsLnBsdWNrKGxvY2FsTG9va3VwcywgJ2RhdHVtJyksICdsb2NhbElkJyksXG4gICAgICAgIGxvY2FsT2JqZWN0cyA9IGNhY2hlLmdldFZpYUxvY2FsSWQobG9jYWxJZGVudGlmaWVycyk7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxvY2FsSWRlbnRpZmllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIG9iaiA9IGxvY2FsT2JqZWN0c1tpXTtcbiAgICAgICAgdmFyIGxvY2FsSWQgPSBsb2NhbElkZW50aWZpZXJzW2ldO1xuICAgICAgICB2YXIgbG9va3VwID0gbG9jYWxMb29rdXBzW2ldO1xuICAgICAgICBpZiAoIW9iaikge1xuICAgICAgICAgIC8vIElmIHRoZXJlIGFyZSBtdWx0aXBsZSBtYXBwaW5nIG9wZXJhdGlvbnMgZ29pbmcgb24sIHRoZXJlIG1heSBiZVxuICAgICAgICAgIG9iaiA9IGNhY2hlLmdldCh7bG9jYWxJZDogbG9jYWxJZH0pO1xuICAgICAgICAgIGlmICghb2JqKSBvYmogPSB0aGlzLl9pbnN0YW5jZSh7bG9jYWxJZDogbG9jYWxJZH0sICF0aGlzLmRpc2FibGVldmVudHMpO1xuICAgICAgICAgIHRoaXMub2JqZWN0c1tsb29rdXAuaW5kZXhdID0gb2JqO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMub2JqZWN0c1tsb29rdXAuaW5kZXhdID0gb2JqO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICB9LFxuICAgIF9wZXJmb3JtUmVtb3RlTG9va3VwczogZnVuY3Rpb24ocmVtb3RlTG9va3Vwcykge1xuICAgICAgdmFyIHJlbW90ZUlkZW50aWZpZXJzID0gdXRpbC5wbHVjayh1dGlsLnBsdWNrKHJlbW90ZUxvb2t1cHMsICdkYXR1bScpLCB0aGlzLm1vZGVsLmlkKSxcbiAgICAgICAgcmVtb3RlT2JqZWN0cyA9IGNhY2hlLmdldFZpYVJlbW90ZUlkKHJlbW90ZUlkZW50aWZpZXJzLCB7bW9kZWw6IHRoaXMubW9kZWx9KTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVtb3RlT2JqZWN0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgb2JqID0gcmVtb3RlT2JqZWN0c1tpXSxcbiAgICAgICAgICBsb29rdXAgPSByZW1vdGVMb29rdXBzW2ldO1xuICAgICAgICBpZiAob2JqKSB7XG4gICAgICAgICAgdGhpcy5vYmplY3RzW2xvb2t1cC5pbmRleF0gPSBvYmo7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyIGRhdGEgPSB7fTtcbiAgICAgICAgICB2YXIgcmVtb3RlSWQgPSByZW1vdGVJZGVudGlmaWVyc1tpXTtcbiAgICAgICAgICBkYXRhW3RoaXMubW9kZWwuaWRdID0gcmVtb3RlSWQ7XG4gICAgICAgICAgdmFyIGNhY2hlUXVlcnkgPSB7XG4gICAgICAgICAgICBtb2RlbDogdGhpcy5tb2RlbFxuICAgICAgICAgIH07XG4gICAgICAgICAgY2FjaGVRdWVyeVt0aGlzLm1vZGVsLmlkXSA9IHJlbW90ZUlkO1xuICAgICAgICAgIHZhciBjYWNoZWQgPSBjYWNoZS5nZXQoY2FjaGVRdWVyeSk7XG4gICAgICAgICAgaWYgKGNhY2hlZCkge1xuICAgICAgICAgICAgdGhpcy5vYmplY3RzW2xvb2t1cC5pbmRleF0gPSBjYWNoZWQ7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMub2JqZWN0c1tsb29rdXAuaW5kZXhdID0gdGhpcy5faW5zdGFuY2UoKTtcbiAgICAgICAgICAgIC8vIEl0J3MgaW1wb3J0YW50IHRoYXQgd2UgbWFwIHRoZSByZW1vdGUgaWRlbnRpZmllciBoZXJlIHRvIGVuc3VyZSB0aGF0IGl0IGVuZHNcbiAgICAgICAgICAgIC8vIHVwIGluIHRoZSBjYWNoZS5cbiAgICAgICAgICAgIHRoaXMub2JqZWN0c1tsb29rdXAuaW5kZXhdW3RoaXMubW9kZWwuaWRdID0gcmVtb3RlSWQ7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBGb3IgaW5kaWNlcyB3aGVyZSBubyBvYmplY3QgaXMgcHJlc2VudCwgcGVyZm9ybSBjYWNoZSBsb29rdXBzLCBjcmVhdGluZyBhIG5ldyBvYmplY3QgaWYgbmVjZXNzYXJ5LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2xvb2t1cDogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5tb2RlbC5zaW5nbGV0b24pIHtcbiAgICAgICAgdGhpcy5fbG9va3VwU2luZ2xldG9uKCk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgdmFyIGxvb2t1cHMgPSB0aGlzLl9zb3J0TG9va3VwcygpLFxuICAgICAgICAgIHJlbW90ZUxvb2t1cHMgPSBsb29rdXBzLnJlbW90ZUxvb2t1cHMsXG4gICAgICAgICAgbG9jYWxMb29rdXBzID0gbG9va3Vwcy5sb2NhbExvb2t1cHM7XG4gICAgICAgIHRoaXMuX3BlcmZvcm1Mb2NhbExvb2t1cHMobG9jYWxMb29rdXBzKTtcbiAgICAgICAgdGhpcy5fcGVyZm9ybVJlbW90ZUxvb2t1cHMocmVtb3RlTG9va3Vwcyk7XG4gICAgICB9XG4gICAgfSxcbiAgICBfbG9va3VwU2luZ2xldG9uOiBmdW5jdGlvbigpIHtcbiAgICAgIC8vIFBpY2sgYSByYW5kb20gbG9jYWxJZCBmcm9tIHRoZSBhcnJheSBvZiBkYXRhIGJlaW5nIG1hcHBlZCBvbnRvIHRoZSBzaW5nbGV0b24gb2JqZWN0LiBOb3RlIHRoYXQgdGhleSBzaG91bGRcbiAgICAgIC8vIGFsd2F5cyBiZSB0aGUgc2FtZS4gVGhpcyBpcyBqdXN0IGEgcHJlY2F1dGlvbi5cbiAgICAgIHZhciBsb2NhbElkZW50aWZpZXJzID0gdXRpbC5wbHVjayh0aGlzLmRhdGEsICdsb2NhbElkJyksIGxvY2FsSWQ7XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgbG9jYWxJZGVudGlmaWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAobG9jYWxJZGVudGlmaWVyc1tpXSkge1xuICAgICAgICAgIGxvY2FsSWQgPSB7bG9jYWxJZDogbG9jYWxJZGVudGlmaWVyc1tpXX07XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIFRoZSBtYXBwaW5nIG9wZXJhdGlvbiBpcyByZXNwb25zaWJsZSBmb3IgY3JlYXRpbmcgc2luZ2xldG9uIGluc3RhbmNlcyBpZiB0aGV5IGRvIG5vdCBhbHJlYWR5IGV4aXN0LlxuICAgICAgdmFyIHNpbmdsZXRvbiA9IGNhY2hlLmdldFNpbmdsZXRvbih0aGlzLm1vZGVsKSB8fCB0aGlzLl9pbnN0YW5jZShsb2NhbElkKTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5kYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHRoaXMub2JqZWN0c1tpXSA9IHNpbmdsZXRvbjtcbiAgICAgIH1cbiAgICB9LFxuICAgIF9pbnN0YW5jZTogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgbW9kZWwgPSB0aGlzLm1vZGVsLFxuICAgICAgICBtb2RlbEluc3RhbmNlID0gbW9kZWwuX2luc3RhbmNlLmFwcGx5KG1vZGVsLCBhcmd1bWVudHMpO1xuICAgICAgdGhpcy5fbmV3T2JqZWN0cy5wdXNoKG1vZGVsSW5zdGFuY2UpO1xuICAgICAgcmV0dXJuIG1vZGVsSW5zdGFuY2U7XG4gICAgfSxcblxuICAgIHByZXByb2Nlc3NEYXRhOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBkYXRhID0gdXRpbC5leHRlbmQoW10sIHRoaXMuZGF0YSk7XG4gICAgICByZXR1cm4gZGF0YS5tYXAoZnVuY3Rpb24oZGF0dW0pIHtcbiAgICAgICAgaWYgKGRhdHVtKSB7XG4gICAgICAgICAgaWYgKCF1dGlsLmlzU3RyaW5nKGRhdHVtKSkge1xuICAgICAgICAgICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhkYXR1bSk7XG4gICAgICAgICAgICBrZXlzLmZvckVhY2goZnVuY3Rpb24oaykge1xuICAgICAgICAgICAgICB2YXIgaXNSZWxhdGlvbnNoaXAgPSB0aGlzLm1vZGVsLl9yZWxhdGlvbnNoaXBOYW1lcy5pbmRleE9mKGspID4gLTE7XG5cbiAgICAgICAgICAgICAgaWYgKGlzUmVsYXRpb25zaGlwKSB7XG4gICAgICAgICAgICAgICAgdmFyIHZhbCA9IGRhdHVtW2tdO1xuICAgICAgICAgICAgICAgIGlmICh2YWwgaW5zdGFuY2VvZiBNb2RlbEluc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgICBkYXR1bVtrXSA9IHtsb2NhbElkOiB2YWwubG9jYWxJZH07XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkYXR1bTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfSxcbiAgICBzdGFydDogZnVuY3Rpb24oZG9uZSkge1xuICAgICAgdmFyIGRhdGEgPSB0aGlzLmRhdGE7XG4gICAgICBpZiAoZGF0YS5sZW5ndGgpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICB2YXIgdGFza3MgPSBbXTtcbiAgICAgICAgdGhpcy5fbG9va3VwKCk7XG4gICAgICAgIHRhc2tzLnB1c2godGhpcy5fZXhlY3V0ZVN1Yk9wZXJhdGlvbnMuYmluZCh0aGlzKSk7XG4gICAgICAgIHV0aWwuYXN5bmMucGFyYWxsZWwodGFza3MsIGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgIGlmIChlcnIpIGNvbnNvbGUuZXJyb3IoZXJyKTtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgc2VsZi5fbWFwKCk7XG4gICAgICAgICAgICAvLyBVc2VycyBhcmUgYWxsb3dlZCB0byBhZGQgYSBjdXN0b20gaW5pdCBtZXRob2QgdG8gdGhlIG1ldGhvZHMgb2JqZWN0IHdoZW4gZGVmaW5pbmcgYSBNb2RlbCwgb2YgdGhlIGZvcm06XG4gICAgICAgICAgICAvL1xuICAgICAgICAgICAgLy9cbiAgICAgICAgICAgIC8vIGluaXQ6IGZ1bmN0aW9uIChbZG9uZV0pIHtcbiAgICAgICAgICAgIC8vICAgICAvLyAuLi5cbiAgICAgICAgICAgIC8vICB9XG4gICAgICAgICAgICAvL1xuICAgICAgICAgICAgLy9cbiAgICAgICAgICAgIC8vIElmIGRvbmUgaXMgcGFzc2VkLCB0aGVuIF9faW5pdCBtdXN0IGJlIGV4ZWN1dGVkIGFzeW5jaHJvbm91c2x5LCBhbmQgdGhlIG1hcHBpbmcgb3BlcmF0aW9uIHdpbGwgbm90XG4gICAgICAgICAgICAvLyBmaW5pc2ggdW50aWwgYWxsIGluaXRzIGhhdmUgZXhlY3V0ZWQuXG4gICAgICAgICAgICAvL1xuICAgICAgICAgICAgLy8gSGVyZSB3ZSBlbnN1cmUgdGhlIGV4ZWN1dGlvbiBvZiBhbGwgb2YgdGhlbVxuICAgICAgICAgICAgdmFyIGZyb21TdG9yYWdlID0gdGhpcy5mcm9tU3RvcmFnZTtcbiAgICAgICAgICAgIHZhciBpbml0VGFza3MgPSBzZWxmLl9uZXdPYmplY3RzLnJlZHVjZShmdW5jdGlvbihtZW1vLCBvKSB7XG4gICAgICAgICAgICAgIHZhciBpbml0ID0gby5tb2RlbC5pbml0O1xuICAgICAgICAgICAgICBpZiAoaW5pdCkge1xuICAgICAgICAgICAgICAgIHZhciBwYXJhbU5hbWVzID0gdXRpbC5wYXJhbU5hbWVzKGluaXQpO1xuICAgICAgICAgICAgICAgIGlmIChwYXJhbU5hbWVzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICAgIG1lbW8ucHVzaChpbml0LmJpbmQobywgZnJvbVN0b3JhZ2UsIGRvbmUpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICBpbml0LmNhbGwobywgZnJvbVN0b3JhZ2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBvLl9lbWl0RXZlbnRzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgby5fZW1pdE5ldygpO1xuICAgICAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgICAgIH0sIFtdKTtcbiAgICAgICAgICAgIGFzeW5jLnBhcmFsbGVsKGluaXRUYXNrcywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgIGRvbmUoc2VsZi5lcnJvcnMubGVuZ3RoID8gc2VsZi5lcnJvcnMgOiBudWxsLCBzZWxmLm9iamVjdHMpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdVbmNhdWdodCBlcnJvciB3aGVuIGV4ZWN1dGluZyBpbml0IGZ1bmNpdG9ucyBvbiBtb2RlbHMuJywgZSk7XG4gICAgICAgICAgICBkb25lKGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRvbmUobnVsbCwgW10pO1xuICAgICAgfVxuICAgIH1cbiAgICAsXG4gICAgZ2V0UmVsYXRlZERhdGE6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgIHZhciBpbmRleGVzID0gW107XG4gICAgICB2YXIgcmVsYXRlZERhdGEgPSBbXTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5kYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBkYXR1bSA9IHRoaXMuZGF0YVtpXTtcbiAgICAgICAgaWYgKGRhdHVtKSB7XG4gICAgICAgICAgdmFyIHZhbCA9IGRhdHVtW25hbWVdO1xuICAgICAgICAgIGlmICh2YWwpIHtcbiAgICAgICAgICAgIGluZGV4ZXMucHVzaChpKTtcbiAgICAgICAgICAgIHJlbGF0ZWREYXRhLnB1c2godmFsKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGluZGV4ZXM6IGluZGV4ZXMsXG4gICAgICAgIHJlbGF0ZWREYXRhOiByZWxhdGVkRGF0YVxuICAgICAgfTtcbiAgICB9XG4gICAgLFxuICAgIHByb2Nlc3NFcnJvcnNGcm9tVGFzazogZnVuY3Rpb24ocmVsYXRpb25zaGlwTmFtZSwgZXJyb3JzLCBpbmRleGVzKSB7XG4gICAgICBpZiAoZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICB2YXIgcmVsYXRlZERhdGEgPSB0aGlzLmdldFJlbGF0ZWREYXRhKHJlbGF0aW9uc2hpcE5hbWUpLnJlbGF0ZWREYXRhO1xuICAgICAgICB2YXIgdW5mbGF0dGVuZWRFcnJvcnMgPSB1dGlsLnVuZmxhdHRlbkFycmF5KGVycm9ycywgcmVsYXRlZERhdGEpO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHVuZmxhdHRlbmVkRXJyb3JzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgdmFyIGlkeCA9IGluZGV4ZXNbaV07XG4gICAgICAgICAgdmFyIGVyciA9IHVuZmxhdHRlbmVkRXJyb3JzW2ldO1xuICAgICAgICAgIHZhciBpc0Vycm9yID0gZXJyO1xuICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkoZXJyKSkgaXNFcnJvciA9IGVyci5yZWR1Y2UoZnVuY3Rpb24obWVtbywgeCkge1xuICAgICAgICAgICAgcmV0dXJuIG1lbW8gfHwgeFxuICAgICAgICAgIH0sIGZhbHNlKTtcbiAgICAgICAgICBpZiAoaXNFcnJvcikge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmVycm9yc1tpZHhdKSB0aGlzLmVycm9yc1tpZHhdID0ge307XG4gICAgICAgICAgICB0aGlzLmVycm9yc1tpZHhdW3JlbGF0aW9uc2hpcE5hbWVdID0gZXJyO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG4gICAgX2V4ZWN1dGVTdWJPcGVyYXRpb25zOiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzLFxuICAgICAgICByZWxhdGlvbnNoaXBOYW1lcyA9IE9iamVjdC5rZXlzKHRoaXMubW9kZWwucmVsYXRpb25zaGlwcyk7XG4gICAgICBpZiAocmVsYXRpb25zaGlwTmFtZXMubGVuZ3RoKSB7XG4gICAgICAgIHZhciB0YXNrcyA9IHJlbGF0aW9uc2hpcE5hbWVzLnJlZHVjZShmdW5jdGlvbihtLCByZWxhdGlvbnNoaXBOYW1lKSB7XG4gICAgICAgICAgdmFyIHJlbGF0aW9uc2hpcCA9IHNlbGYubW9kZWwucmVsYXRpb25zaGlwc1tyZWxhdGlvbnNoaXBOYW1lXTtcbiAgICAgICAgICB2YXIgcmV2ZXJzZU1vZGVsID0gcmVsYXRpb25zaGlwLmZvcndhcmROYW1lID09IHJlbGF0aW9uc2hpcE5hbWUgPyByZWxhdGlvbnNoaXAucmV2ZXJzZU1vZGVsIDogcmVsYXRpb25zaGlwLmZvcndhcmRNb2RlbDtcbiAgICAgICAgICAvLyBNb2NrIGFueSBtaXNzaW5nIHNpbmdsZXRvbiBkYXRhIHRvIGVuc3VyZSB0aGF0IGFsbCBzaW5nbGV0b24gaW5zdGFuY2VzIGFyZSBjcmVhdGVkLlxuICAgICAgICAgIGlmIChyZXZlcnNlTW9kZWwuc2luZ2xldG9uICYmICFyZWxhdGlvbnNoaXAuaXNSZXZlcnNlKSB7XG4gICAgICAgICAgICB0aGlzLmRhdGEuZm9yRWFjaChmdW5jdGlvbihkYXR1bSkge1xuICAgICAgICAgICAgICBpZiAoIWRhdHVtW3JlbGF0aW9uc2hpcE5hbWVdKSBkYXR1bVtyZWxhdGlvbnNoaXBOYW1lXSA9IHt9O1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHZhciBfX3JldCA9IHRoaXMuZ2V0UmVsYXRlZERhdGEocmVsYXRpb25zaGlwTmFtZSksXG4gICAgICAgICAgICBpbmRleGVzID0gX19yZXQuaW5kZXhlcyxcbiAgICAgICAgICAgIHJlbGF0ZWREYXRhID0gX19yZXQucmVsYXRlZERhdGE7XG4gICAgICAgICAgaWYgKHJlbGF0ZWREYXRhLmxlbmd0aCkge1xuICAgICAgICAgICAgdmFyIGZsYXRSZWxhdGVkRGF0YSA9IHV0aWwuZmxhdHRlbkFycmF5KHJlbGF0ZWREYXRhKTtcbiAgICAgICAgICAgIHZhciBvcCA9IG5ldyBNYXBwaW5nT3BlcmF0aW9uKHtcbiAgICAgICAgICAgICAgbW9kZWw6IHJldmVyc2VNb2RlbCxcbiAgICAgICAgICAgICAgZGF0YTogZmxhdFJlbGF0ZWREYXRhLFxuICAgICAgICAgICAgICBkaXNhYmxlZXZlbnRzOiBzZWxmLmRpc2FibGVldmVudHMsXG4gICAgICAgICAgICAgIF9pZ25vcmVJbnN0YWxsZWQ6IHNlbGYuX2lnbm9yZUluc3RhbGxlZCxcbiAgICAgICAgICAgICAgZnJvbVN0b3JhZ2U6IHRoaXMuZnJvbVN0b3JhZ2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChvcCkge1xuICAgICAgICAgICAgdmFyIHRhc2s7XG4gICAgICAgICAgICB0YXNrID0gZnVuY3Rpb24oZG9uZSkge1xuICAgICAgICAgICAgICBvcC5zdGFydChmdW5jdGlvbihlcnJvcnMsIG9iamVjdHMpIHtcbiAgICAgICAgICAgICAgICBzZWxmLnN1YlRhc2tSZXN1bHRzW3JlbGF0aW9uc2hpcE5hbWVdID0ge1xuICAgICAgICAgICAgICAgICAgZXJyb3JzOiBlcnJvcnMsXG4gICAgICAgICAgICAgICAgICBvYmplY3RzOiBvYmplY3RzLFxuICAgICAgICAgICAgICAgICAgaW5kZXhlczogaW5kZXhlc1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgc2VsZi5wcm9jZXNzRXJyb3JzRnJvbVRhc2socmVsYXRpb25zaGlwTmFtZSwgb3AuZXJyb3JzLCBpbmRleGVzKTtcbiAgICAgICAgICAgICAgICBkb25lKCk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIG0ucHVzaCh0YXNrKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIG07XG4gICAgICAgIH0uYmluZCh0aGlzKSwgW10pO1xuICAgICAgICBhc3luYy5wYXJhbGxlbCh0YXNrcywgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgfVxuICAgIH1cbiAgfSlcbiAgO1xuXG4gIG1vZHVsZS5leHBvcnRzID0gTWFwcGluZ09wZXJhdGlvbjtcblxuXG59KSgpOyIsIihmdW5jdGlvbigpIHtcblxuICB2YXIgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSgnbW9kZWwnKSxcbiAgICBDb2xsZWN0aW9uUmVnaXN0cnkgPSByZXF1aXJlKCcuL2NvbGxlY3Rpb25SZWdpc3RyeScpLkNvbGxlY3Rpb25SZWdpc3RyeSxcbiAgICBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgUmVsYXRpb25zaGlwVHlwZSA9IHJlcXVpcmUoJy4vUmVsYXRpb25zaGlwVHlwZScpLFxuICAgIFF1ZXJ5ID0gcmVxdWlyZSgnLi9RdWVyeScpLFxuICAgIE1hcHBpbmdPcGVyYXRpb24gPSByZXF1aXJlKCcuL21hcHBpbmdPcGVyYXRpb24nKSxcbiAgICBNb2RlbEluc3RhbmNlID0gcmVxdWlyZSgnLi9Nb2RlbEluc3RhbmNlJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpLFxuICAgIGFyZ3NhcnJheSA9IHJlcXVpcmUoJ2FyZ3NhcnJheScpLFxuICAgIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLFxuICAgIGV4dGVuZCA9IHJlcXVpcmUoJ2V4dGVuZCcpLFxuICAgIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICAgIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gICAgT25lVG9PbmVQcm94eSA9IHJlcXVpcmUoJy4vT25lVG9PbmVQcm94eScpLFxuICAgIE1hbnlUb01hbnlQcm94eSA9IHJlcXVpcmUoJy4vTWFueVRvTWFueVByb3h5JyksXG4gICAgUGxhY2Vob2xkZXIgPSByZXF1aXJlKCcuL1BsYWNlaG9sZGVyJyksXG4gICAgUmVhY3RpdmVRdWVyeSA9IHJlcXVpcmUoJy4vUmVhY3RpdmVRdWVyeScpLFxuICAgIEluc3RhbmNlRmFjdG9yeSA9IHJlcXVpcmUoJy4vaW5zdGFuY2VGYWN0b3J5Jyk7XG5cbiAgLyoqXG4gICAqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gICAqL1xuICBmdW5jdGlvbiBNb2RlbChvcHRzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHRoaXMuX29wdHMgPSBvcHRzID8gdXRpbC5leHRlbmQoe30sIG9wdHMpIDoge307XG5cbiAgICB1dGlsLmV4dGVuZEZyb21PcHRzKHRoaXMsIG9wdHMsIHtcbiAgICAgIG1ldGhvZHM6IHt9LFxuICAgICAgYXR0cmlidXRlczogW10sXG4gICAgICBjb2xsZWN0aW9uOiBmdW5jdGlvbihjKSB7XG4gICAgICAgIGlmICh1dGlsLmlzU3RyaW5nKGMpKSB7XG4gICAgICAgICAgYyA9IENvbGxlY3Rpb25SZWdpc3RyeVtjXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYztcbiAgICAgIH0sXG4gICAgICBpZDogJ2lkJyxcbiAgICAgIHJlbGF0aW9uc2hpcHM6IFtdLFxuICAgICAgbmFtZTogbnVsbCxcbiAgICAgIGluZGV4ZXM6IFtdLFxuICAgICAgc2luZ2xldG9uOiBmYWxzZSxcbiAgICAgIHN0YXRpY3M6IHRoaXMuaW5zdGFsbFN0YXRpY3MuYmluZCh0aGlzKSxcbiAgICAgIHByb3BlcnRpZXM6IHt9LFxuICAgICAgaW5pdDogbnVsbCxcbiAgICAgIHNlcmlhbGlzZTogbnVsbCxcbiAgICAgIHNlcmlhbGlzZUZpZWxkOiBudWxsLFxuICAgICAgc2VyaWFsaXNhYmxlRmllbGRzOiBudWxsLFxuICAgICAgcmVtb3ZlOiBudWxsLFxuICAgICAgcGFyc2VBdHRyaWJ1dGU6IG51bGxcbiAgICB9LCBmYWxzZSk7XG5cbiAgICBpZiAoIXRoaXMucGFyc2VBdHRyaWJ1dGUpIHtcbiAgICAgIHRoaXMucGFyc2VBdHRyaWJ1dGUgPSBmdW5jdGlvbihhdHRyTmFtZSwgdmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghdGhpcy5zZXJpYWxpc2VGaWVsZCkge1xuICAgICAgdGhpcy5zZXJpYWxpc2VGaWVsZCA9IGZ1bmN0aW9uKGF0dHJOYW1lLCB2YWx1ZSkge1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICB9O1xuICAgIH1cblxuICAgIHRoaXMuYXR0cmlidXRlcyA9IE1vZGVsLl9wcm9jZXNzQXR0cmlidXRlcyh0aGlzLmF0dHJpYnV0ZXMpO1xuXG4gICAgdGhpcy5fZmFjdG9yeSA9IG5ldyBJbnN0YW5jZUZhY3RvcnkodGhpcyk7XG4gICAgdGhpcy5faW5zdGFuY2UgPSB0aGlzLl9mYWN0b3J5Ll9pbnN0YW5jZS5iaW5kKHRoaXMuX2ZhY3RvcnkpO1xuXG4gICAgdXRpbC5leHRlbmQodGhpcywge1xuICAgICAgX3JlbGF0aW9uc2hpcHNJbnN0YWxsZWQ6IGZhbHNlLFxuICAgICAgX3JldmVyc2VSZWxhdGlvbnNoaXBzSW5zdGFsbGVkOiBmYWxzZSxcbiAgICAgIGNoaWxkcmVuOiBbXVxuICAgIH0pO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXModGhpcywge1xuICAgICAgX3JlbGF0aW9uc2hpcE5hbWVzOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKHNlbGYucmVsYXRpb25zaGlwcyk7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgIH0sXG4gICAgICBfYXR0cmlidXRlTmFtZXM6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgbmFtZXMgPSBbXTtcbiAgICAgICAgICBpZiAoc2VsZi5pZCkge1xuICAgICAgICAgICAgbmFtZXMucHVzaChzZWxmLmlkKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgc2VsZi5hdHRyaWJ1dGVzLmZvckVhY2goZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgbmFtZXMucHVzaCh4Lm5hbWUpXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgcmV0dXJuIG5hbWVzO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgIH0sXG4gICAgICBpbnN0YWxsZWQ6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gc2VsZi5fcmVsYXRpb25zaGlwc0luc3RhbGxlZCAmJiBzZWxmLl9yZXZlcnNlUmVsYXRpb25zaGlwc0luc3RhbGxlZDtcbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICB9LFxuICAgICAgZGVzY2VuZGFudHM6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gc2VsZi5jaGlsZHJlbi5yZWR1Y2UoZnVuY3Rpb24obWVtbywgZGVzY2VuZGFudCkge1xuICAgICAgICAgICAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5jb25jYXQuY2FsbChtZW1vLCBkZXNjZW5kYW50LmRlc2NlbmRhbnRzKTtcbiAgICAgICAgICB9LmJpbmQoc2VsZiksIHV0aWwuZXh0ZW5kKFtdLCBzZWxmLmNoaWxkcmVuKSk7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgIH0sXG4gICAgICBkaXJ0eToge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGlmIChzaWVzdGEuZXh0LnN0b3JhZ2VFbmFibGVkKSB7XG4gICAgICAgICAgICB2YXIgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb24gPSBzaWVzdGEuZXh0LnN0b3JhZ2UuX3Vuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uLFxuICAgICAgICAgICAgICBoYXNoID0gKHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uW3RoaXMuY29sbGVjdGlvbk5hbWVdIHx8IHt9KVt0aGlzLm5hbWVdIHx8IHt9O1xuICAgICAgICAgICAgcmV0dXJuICEhT2JqZWN0LmtleXMoaGFzaCkubGVuZ3RoO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgIH0sXG4gICAgICBjb2xsZWN0aW9uTmFtZToge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiB0aGlzLmNvbGxlY3Rpb24ubmFtZTtcbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgICAgfVxuICAgIH0pO1xuICAgIHZhciBnbG9iYWxFdmVudE5hbWUgPSB0aGlzLmNvbGxlY3Rpb25OYW1lICsgJzonICsgdGhpcy5uYW1lLFxuICAgICAgcHJveGllZCA9IHtcbiAgICAgICAgcXVlcnk6IHRoaXMucXVlcnkuYmluZCh0aGlzKVxuICAgICAgfTtcblxuICAgIGV2ZW50cy5Qcm94eUV2ZW50RW1pdHRlci5jYWxsKHRoaXMsIGdsb2JhbEV2ZW50TmFtZSwgcHJveGllZCk7XG4gIH1cblxuICB1dGlsLmV4dGVuZChNb2RlbCwge1xuICAgIC8qKlxuICAgICAqIE5vcm1hbGlzZSBhdHRyaWJ1dGVzIHBhc3NlZCB2aWEgdGhlIG9wdGlvbnMgZGljdGlvbmFyeS5cbiAgICAgKiBAcGFyYW0gYXR0cmlidXRlc1xuICAgICAqIEByZXR1cm5zIHtBcnJheX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9wcm9jZXNzQXR0cmlidXRlczogZnVuY3Rpb24oYXR0cmlidXRlcykge1xuICAgICAgcmV0dXJuIGF0dHJpYnV0ZXMucmVkdWNlKGZ1bmN0aW9uKG0sIGEpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBhID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgbS5wdXNoKHtcbiAgICAgICAgICAgIG5hbWU6IGFcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBtLnB1c2goYSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG07XG4gICAgICB9LCBbXSlcbiAgICB9XG4gIH0pO1xuXG4gIE1vZGVsLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoZXZlbnRzLlByb3h5RXZlbnRFbWl0dGVyLnByb3RvdHlwZSk7XG5cbiAgdXRpbC5leHRlbmQoTW9kZWwucHJvdG90eXBlLCB7XG4gICAgaW5zdGFsbFN0YXRpY3M6IGZ1bmN0aW9uKHN0YXRpY3MpIHtcbiAgICAgIGlmIChzdGF0aWNzKSB7XG4gICAgICAgIE9iamVjdC5rZXlzKHN0YXRpY3MpLmZvckVhY2goZnVuY3Rpb24oc3RhdGljTmFtZSkge1xuICAgICAgICAgIGlmICh0aGlzW3N0YXRpY05hbWVdKSB7XG4gICAgICAgICAgICBsb2coJ1N0YXRpYyBtZXRob2Qgd2l0aCBuYW1lIFwiJyArIHN0YXRpY05hbWUgKyAnXCIgYWxyZWFkeSBleGlzdHMuIElnbm9yaW5nIGl0LicpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXNbc3RhdGljTmFtZV0gPSBzdGF0aWNzW3N0YXRpY05hbWVdLmJpbmQodGhpcyk7XG4gICAgICAgICAgfVxuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHN0YXRpY3M7XG4gICAgfSxcbiAgICBfdmFsaWRhdGVSZWxhdGlvbnNoaXBUeXBlOiBmdW5jdGlvbihyZWxhdGlvbnNoaXApIHtcbiAgICAgIGNvbnNvbGUubG9nKCd2YWxpZGF0ZVJlbGF0aW9uc2hpcCcsIHJlbGF0aW9uc2hpcCk7XG4gICAgICBpZiAoIXJlbGF0aW9uc2hpcC50eXBlKSB7XG4gICAgICAgIGlmICh0aGlzLnNpbmdsZXRvbikgcmVsYXRpb25zaGlwLnR5cGUgPSBSZWxhdGlvbnNoaXBUeXBlLk9uZVRvT25lO1xuICAgICAgICBlbHNlIHJlbGF0aW9uc2hpcC50eXBlID0gUmVsYXRpb25zaGlwVHlwZS5PbmVUb01hbnk7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5zaW5nbGV0b24gJiYgcmVsYXRpb25zaGlwLnR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5NYW55VG9NYW55KSB7XG4gICAgICAgIHJldHVybiAnU2luZ2xldG9uIG1vZGVsIGNhbm5vdCB1c2UgTWFueVRvTWFueSByZWxhdGlvbnNoaXAuJztcbiAgICAgIH1cbiAgICAgIGlmIChPYmplY3Qua2V5cyhSZWxhdGlvbnNoaXBUeXBlKS5pbmRleE9mKHJlbGF0aW9uc2hpcC50eXBlKSA8IDApXG4gICAgICAgIHJldHVybiAnUmVsYXRpb25zaGlwIHR5cGUgJyArIHJlbGF0aW9uc2hpcC50eXBlICsgJyBkb2VzIG5vdCBleGlzdCc7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuICAgIF9nZXRSZXZlcnNlTW9kZWw6IGZ1bmN0aW9uKHJldmVyc2VOYW1lKSB7XG4gICAgICB2YXIgcmV2ZXJzZU1vZGVsO1xuICAgICAgaWYgKHJldmVyc2VOYW1lIGluc3RhbmNlb2YgTW9kZWwpIHJldmVyc2VNb2RlbCA9IHJldmVyc2VOYW1lO1xuICAgICAgZWxzZSByZXZlcnNlTW9kZWwgPSB0aGlzLmNvbGxlY3Rpb25bcmV2ZXJzZU5hbWVdO1xuICAgICAgaWYgKCFyZXZlcnNlTW9kZWwpIHsgLy8gTWF5IGhhdmUgdXNlZCBDb2xsZWN0aW9uLk1vZGVsIGZvcm1hdC5cbiAgICAgICAgdmFyIGFyciA9IHJldmVyc2VOYW1lLnNwbGl0KCcuJyk7XG4gICAgICAgIGlmIChhcnIubGVuZ3RoID09IDIpIHtcbiAgICAgICAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBhcnJbMF07XG4gICAgICAgICAgcmV2ZXJzZU5hbWUgPSBhcnJbMV07XG4gICAgICAgICAgdmFyIG90aGVyQ29sbGVjdGlvbiA9IENvbGxlY3Rpb25SZWdpc3RyeVtjb2xsZWN0aW9uTmFtZV07XG4gICAgICAgICAgaWYgKG90aGVyQ29sbGVjdGlvbilcbiAgICAgICAgICAgIHJldmVyc2VNb2RlbCA9IG90aGVyQ29sbGVjdGlvbltyZXZlcnNlTmFtZV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiByZXZlcnNlTW9kZWw7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZXR1cm4gdGhlIHJldmVyc2UgbW9kZWwgb3IgYSBwbGFjZWhvbGRlciB0aGF0IHdpbGwgYmUgcmVzb2x2ZWQgbGF0ZXIuXG4gICAgICogQHBhcmFtIGZvcndhcmROYW1lXG4gICAgICogQHBhcmFtIHJldmVyc2VOYW1lXG4gICAgICogQHJldHVybnMgeyp9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZ2V0UmV2ZXJzZU1vZGVsT3JQbGFjZWhvbGRlcjogZnVuY3Rpb24oZm9yd2FyZE5hbWUsIHJldmVyc2VOYW1lKSB7XG4gICAgICB2YXIgcmV2ZXJzZU1vZGVsID0gdGhpcy5fZ2V0UmV2ZXJzZU1vZGVsKHJldmVyc2VOYW1lKTtcbiAgICAgIHJldHVybiByZXZlcnNlTW9kZWwgfHwgbmV3IFBsYWNlaG9sZGVyKHtuYW1lOiByZXZlcnNlTmFtZSwgcmVmOiB0aGlzLCBmb3J3YXJkTmFtZTogZm9yd2FyZE5hbWV9KTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIEluc3RhbGwgcmVsYXRpb25zaGlwcy4gUmV0dXJucyBlcnJvciBpbiBmb3JtIG9mIHN0cmluZyBpZiBmYWlscy5cbiAgICAgKiBAcmV0dXJuIHtTdHJpbmd8bnVsbH1cbiAgICAgKi9cbiAgICBpbnN0YWxsUmVsYXRpb25zaGlwczogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoIXRoaXMuX3JlbGF0aW9uc2hpcHNJbnN0YWxsZWQpIHtcbiAgICAgICAgdmFyIGVyciA9IG51bGw7XG4gICAgICAgIGZvciAodmFyIG5hbWUgaW4gdGhpcy5fb3B0cy5yZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgICAgaWYgKHRoaXMuX29wdHMucmVsYXRpb25zaGlwcy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICAgICAgdmFyIHJlbGF0aW9uc2hpcCA9IHRoaXMuX29wdHMucmVsYXRpb25zaGlwc1tuYW1lXTtcbiAgICAgICAgICAgIC8vIElmIGEgcmV2ZXJzZSByZWxhdGlvbnNoaXAgaXMgaW5zdGFsbGVkIGJlZm9yZWhhbmQsIHdlIGRvIG5vdCB3YW50IHRvIHByb2Nlc3MgdGhlbS5cbiAgICAgICAgICAgIHZhciBpc0ZvcndhcmQgPSAhcmVsYXRpb25zaGlwLmlzUmV2ZXJzZTtcbiAgICAgICAgICAgIGlmIChpc0ZvcndhcmQpIHtcbiAgICAgICAgICAgICAgbG9nKHRoaXMubmFtZSArICc6IGNvbmZpZ3VyaW5nIHJlbGF0aW9uc2hpcCAnICsgbmFtZSwgcmVsYXRpb25zaGlwKTtcbiAgICAgICAgICAgICAgaWYgKCEoZXJyID0gdGhpcy5fdmFsaWRhdGVSZWxhdGlvbnNoaXBUeXBlKHJlbGF0aW9uc2hpcCkpKSB7XG4gICAgICAgICAgICAgICAgdmFyIHJldmVyc2VNb2RlbE5hbWUgPSByZWxhdGlvbnNoaXAubW9kZWw7XG4gICAgICAgICAgICAgICAgaWYgKHJldmVyc2VNb2RlbE5hbWUpIHtcbiAgICAgICAgICAgICAgICAgIHZhciByZXZlcnNlTW9kZWwgPSB0aGlzLl9nZXRSZXZlcnNlTW9kZWxPclBsYWNlaG9sZGVyKG5hbWUsIHJldmVyc2VNb2RlbE5hbWUpO1xuICAgICAgICAgICAgICAgICAgdXRpbC5leHRlbmQocmVsYXRpb25zaGlwLCB7XG4gICAgICAgICAgICAgICAgICAgIHJldmVyc2VNb2RlbDogcmV2ZXJzZU1vZGVsLFxuICAgICAgICAgICAgICAgICAgICBmb3J3YXJkTW9kZWw6IHRoaXMsXG4gICAgICAgICAgICAgICAgICAgIGZvcndhcmROYW1lOiBuYW1lLFxuICAgICAgICAgICAgICAgICAgICByZXZlcnNlTmFtZTogcmVsYXRpb25zaGlwLnJldmVyc2UgfHwgJ3JldmVyc2VfJyArIG5hbWUsXG4gICAgICAgICAgICAgICAgICAgIGlzUmV2ZXJzZTogZmFsc2VcbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgZGVsZXRlIHJlbGF0aW9uc2hpcC5tb2RlbDtcbiAgICAgICAgICAgICAgICAgIGRlbGV0ZSByZWxhdGlvbnNoaXAucmV2ZXJzZTtcblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHJldHVybiAnTXVzdCBwYXNzIG1vZGVsJztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ1JlbGF0aW9uc2hpcHMgZm9yIFwiJyArIHRoaXMubmFtZSArICdcIiBoYXZlIGFscmVhZHkgYmVlbiBpbnN0YWxsZWQnKTtcbiAgICAgIH1cbiAgICAgIGlmICghZXJyKSB0aGlzLl9yZWxhdGlvbnNoaXBzSW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgIHJldHVybiBlcnI7XG4gICAgfSxcbiAgICBfaW5zdGFsbFJldmVyc2U6IGZ1bmN0aW9uKHJlbGF0aW9uc2hpcCkge1xuICAgICAgdmFyIHJldmVyc2VNb2RlbCA9IHJlbGF0aW9uc2hpcC5yZXZlcnNlTW9kZWw7XG4gICAgICB2YXIgaXNQbGFjZWhvbGRlciA9IHJldmVyc2VNb2RlbC5pc1BsYWNlaG9sZGVyO1xuICAgICAgaWYgKGlzUGxhY2Vob2xkZXIpIHtcbiAgICAgICAgdmFyIG1vZGVsTmFtZSA9IHJlbGF0aW9uc2hpcC5yZXZlcnNlTW9kZWwubmFtZTtcbiAgICAgICAgcmV2ZXJzZU1vZGVsID0gdGhpcy5fZ2V0UmV2ZXJzZU1vZGVsKG1vZGVsTmFtZSk7XG4gICAgICAgIGNvbnNvbGUubG9nKCdhc2Rhc2QnLCBtb2RlbE5hbWUsIHJldmVyc2VNb2RlbCk7XG4gICAgICAgIGlmIChyZXZlcnNlTW9kZWwpIHtcbiAgICAgICAgICByZWxhdGlvbnNoaXAucmV2ZXJzZU1vZGVsID0gcmV2ZXJzZU1vZGVsO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAocmV2ZXJzZU1vZGVsKSB7XG4gICAgICAgIHZhciBlcnI7XG4gICAgICAgIHZhciByZXZlcnNlTmFtZSA9IHJlbGF0aW9uc2hpcC5yZXZlcnNlTmFtZSxcbiAgICAgICAgICBmb3J3YXJkTW9kZWwgPSByZWxhdGlvbnNoaXAuZm9yd2FyZE1vZGVsO1xuXG4gICAgICAgIGlmIChyZXZlcnNlTW9kZWwgIT0gdGhpcyB8fCByZXZlcnNlTW9kZWwgPT0gZm9yd2FyZE1vZGVsKSB7XG4gICAgICAgICAgaWYgKHJldmVyc2VNb2RlbC5zaW5nbGV0b24pIHtcbiAgICAgICAgICAgIGlmIChyZWxhdGlvbnNoaXAudHlwZSA9PSBSZWxhdGlvbnNoaXBUeXBlLk1hbnlUb01hbnkpIGVyciA9ICdTaW5nbGV0b24gbW9kZWwgY2Fubm90IGJlIHJlbGF0ZWQgdmlhIHJldmVyc2UgTWFueVRvTWFueSc7XG4gICAgICAgICAgICBpZiAocmVsYXRpb25zaGlwLnR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5PbmVUb01hbnkpIGVyciA9ICdTaW5nbGV0b24gbW9kZWwgY2Fubm90IGJlIHJlbGF0ZWQgdmlhIHJldmVyc2UgT25lVG9NYW55JztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgIGxvZyh0aGlzLm5hbWUgKyAnOiBjb25maWd1cmluZyAgcmV2ZXJzZSByZWxhdGlvbnNoaXAgJyArIHJldmVyc2VOYW1lKTtcbiAgICAgICAgICAgIGlmIChyZXZlcnNlTW9kZWwucmVsYXRpb25zaGlwc1tyZXZlcnNlTmFtZV0pIHtcbiAgICAgICAgICAgICAgLy8gV2UgYXJlIG9rIHRvIHJlZGVmaW5lIHJldmVyc2UgcmVsYXRpb25zaGlwcyB3aGVyZWJ5IHRoZSBtb2RlbHMgYXJlIGluIHRoZSBzYW1lIGhpZXJhcmNoeVxuICAgICAgICAgICAgICB2YXIgaXNBbmNlc3Rvck1vZGVsID0gcmV2ZXJzZU1vZGVsLnJlbGF0aW9uc2hpcHNbcmV2ZXJzZU5hbWVdLmZvcndhcmRNb2RlbC5pc0FuY2VzdG9yT2YodGhpcyk7XG4gICAgICAgICAgICAgIHZhciBpc0Rlc2NlbmRlbnRNb2RlbCA9IHJldmVyc2VNb2RlbC5yZWxhdGlvbnNoaXBzW3JldmVyc2VOYW1lXS5mb3J3YXJkTW9kZWwuaXNEZXNjZW5kYW50T2YodGhpcyk7XG4gICAgICAgICAgICAgIGlmICghaXNBbmNlc3Rvck1vZGVsICYmICFpc0Rlc2NlbmRlbnRNb2RlbCkge1xuICAgICAgICAgICAgICAgIGVyciA9ICdSZXZlcnNlIHJlbGF0aW9uc2hpcCBcIicgKyByZXZlcnNlTmFtZSArICdcIiBhbHJlYWR5IGV4aXN0cyBvbiBtb2RlbCBcIicgKyByZXZlcnNlTW9kZWwubmFtZSArICdcIic7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgIHJldmVyc2VNb2RlbC5yZWxhdGlvbnNoaXBzW3JldmVyc2VOYW1lXSA9IHJlbGF0aW9uc2hpcDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGlzUGxhY2Vob2xkZXIpIHtcbiAgICAgICAgICB2YXIgZXhpc3RpbmdSZXZlcnNlSW5zdGFuY2VzID0gKGNhY2hlLl9sb2NhbENhY2hlQnlUeXBlW3JldmVyc2VNb2RlbC5jb2xsZWN0aW9uTmFtZV0gfHwge30pW3JldmVyc2VNb2RlbC5uYW1lXSB8fCB7fTtcbiAgICAgICAgICBPYmplY3Qua2V5cyhleGlzdGluZ1JldmVyc2VJbnN0YW5jZXMpLmZvckVhY2goZnVuY3Rpb24obG9jYWxJZCkge1xuICAgICAgICAgICAgdmFyIGluc3RhbmNjZSA9IGV4aXN0aW5nUmV2ZXJzZUluc3RhbmNlc1tsb2NhbElkXTtcbiAgICAgICAgICAgIHZhciByID0gdXRpbC5leHRlbmQoe30sIHJlbGF0aW9uc2hpcCk7XG4gICAgICAgICAgICByLmlzUmV2ZXJzZSA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLl9mYWN0b3J5Ll9pbnN0YWxsUmVsYXRpb25zaGlwKHIsIGluc3RhbmNjZSk7XG4gICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIGVycjtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIEN5Y2xlIHRocm91Z2ggcmVsYXRpb25zaGlwcyBhbmQgcmVwbGFjZSBhbnkgcGxhY2Vob2xkZXJzIHdpdGggdGhlIGFjdHVhbCBtb2RlbHMgd2hlcmUgcG9zc2libGUuXG4gICAgICovXG4gICAgX2luc3RhbGxSZXZlcnNlUGxhY2Vob2xkZXJzOiBmdW5jdGlvbigpIHtcbiAgICAgIGZvciAodmFyIGZvcndhcmROYW1lIGluIHRoaXMucmVsYXRpb25zaGlwcykge1xuICAgICAgICBpZiAodGhpcy5yZWxhdGlvbnNoaXBzLmhhc093blByb3BlcnR5KGZvcndhcmROYW1lKSkge1xuICAgICAgICAgIHZhciByZWxhdGlvbnNoaXAgPSB0aGlzLnJlbGF0aW9uc2hpcHNbZm9yd2FyZE5hbWVdO1xuICAgICAgICAgIGlmIChyZWxhdGlvbnNoaXAucmV2ZXJzZU1vZGVsLmlzUGxhY2Vob2xkZXIpIHRoaXMuX2luc3RhbGxSZXZlcnNlKHJlbGF0aW9uc2hpcCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIGluc3RhbGxSZXZlcnNlUmVsYXRpb25zaGlwczogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoIXRoaXMuX3JldmVyc2VSZWxhdGlvbnNoaXBzSW5zdGFsbGVkKSB7XG4gICAgICAgIGZvciAodmFyIGZvcndhcmROYW1lIGluIHRoaXMucmVsYXRpb25zaGlwcykge1xuICAgICAgICAgIGlmICh0aGlzLnJlbGF0aW9uc2hpcHMuaGFzT3duUHJvcGVydHkoZm9yd2FyZE5hbWUpKSB7XG4gICAgICAgICAgICB2YXIgcmVsYXRpb25zaGlwID0gdGhpcy5yZWxhdGlvbnNoaXBzW2ZvcndhcmROYW1lXTtcbiAgICAgICAgICAgIHJlbGF0aW9uc2hpcCA9IGV4dGVuZCh0cnVlLCB7fSwgcmVsYXRpb25zaGlwKTtcbiAgICAgICAgICAgIHJlbGF0aW9uc2hpcC5pc1JldmVyc2UgPSB0cnVlO1xuICAgICAgICAgICAgdmFyIGVyciA9IHRoaXMuX2luc3RhbGxSZXZlcnNlKHJlbGF0aW9uc2hpcCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3JldmVyc2VSZWxhdGlvbnNoaXBzSW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignUmV2ZXJzZSByZWxhdGlvbnNoaXBzIGZvciBcIicgKyB0aGlzLm5hbWUgKyAnXCIgaGF2ZSBhbHJlYWR5IGJlZW4gaW5zdGFsbGVkLicpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGVycjtcbiAgICB9LFxuICAgIF9xdWVyeTogZnVuY3Rpb24ocXVlcnkpIHtcbiAgICAgIHJldHVybiBuZXcgUXVlcnkodGhpcywgcXVlcnkgfHwge30pO1xuICAgIH0sXG4gICAgcXVlcnk6IGZ1bmN0aW9uKHF1ZXJ5LCBjYikge1xuICAgICAgdmFyIHF1ZXJ5SW5zdGFuY2U7XG4gICAgICB2YXIgcHJvbWlzZSA9IHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgICAgaWYgKCF0aGlzLnNpbmdsZXRvbikge1xuICAgICAgICAgIHF1ZXJ5SW5zdGFuY2UgPSB0aGlzLl9xdWVyeShxdWVyeSk7XG4gICAgICAgICAgcmV0dXJuIHF1ZXJ5SW5zdGFuY2UuZXhlY3V0ZShjYik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgcXVlcnlJbnN0YW5jZSA9IHRoaXMuX3F1ZXJ5KHtfX2lnbm9yZUluc3RhbGxlZDogdHJ1ZX0pO1xuICAgICAgICAgIHF1ZXJ5SW5zdGFuY2UuZXhlY3V0ZShmdW5jdGlvbihlcnIsIG9ianMpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIGNiKGVycik7XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gQ2FjaGUgYSBuZXcgc2luZ2xldG9uIGFuZCB0aGVuIHJlZXhlY3V0ZSB0aGUgcXVlcnlcbiAgICAgICAgICAgICAgcXVlcnkgPSB1dGlsLmV4dGVuZCh7fSwgcXVlcnkpO1xuICAgICAgICAgICAgICBxdWVyeS5fX2lnbm9yZUluc3RhbGxlZCA9IHRydWU7XG4gICAgICAgICAgICAgIGlmICghb2Jqcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmdyYXBoKHt9LCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHF1ZXJ5SW5zdGFuY2UgPSB0aGlzLl9xdWVyeShxdWVyeSk7XG4gICAgICAgICAgICAgICAgICAgIHF1ZXJ5SW5zdGFuY2UuZXhlY3V0ZShjYik7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY2IoZXJyKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHF1ZXJ5SW5zdGFuY2UgPSB0aGlzLl9xdWVyeShxdWVyeSk7XG4gICAgICAgICAgICAgICAgcXVlcnlJbnN0YW5jZS5leGVjdXRlKGNiKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH1cbiAgICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICAgIC8vIEJ5IHdyYXBwaW5nIHRoZSBwcm9taXNlIGluIGFub3RoZXIgcHJvbWlzZSB3ZSBjYW4gcHVzaCB0aGUgaW52b2NhdGlvbnMgdG8gdGhlIGJvdHRvbSBvZiB0aGUgZXZlbnQgbG9vcCBzbyB0aGF0XG4gICAgICAvLyBhbnkgZXZlbnQgaGFuZGxlcnMgYWRkZWQgdG8gdGhlIGNoYWluIGFyZSBob25vdXJlZCBzdHJhaWdodCBhd2F5LlxuICAgICAgdmFyIGxpbmtQcm9taXNlID0gbmV3IHV0aWwuUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgcHJvbWlzZS50aGVuKGFyZ3NhcnJheShmdW5jdGlvbihhcmdzKSB7XG4gICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJlc29sdmUuYXBwbHkobnVsbCwgYXJncyk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pLCBhcmdzYXJyYXkoZnVuY3Rpb24oYXJncykge1xuICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZWplY3QuYXBwbHkobnVsbCwgYXJncyk7XG4gICAgICAgICAgfSlcbiAgICAgICAgfSkpO1xuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiB0aGlzLl9saW5rKHtcbiAgICAgICAgdGhlbjogbGlua1Byb21pc2UudGhlbi5iaW5kKGxpbmtQcm9taXNlKSxcbiAgICAgICAgY2F0Y2g6IGxpbmtQcm9taXNlLmNhdGNoLmJpbmQobGlua1Byb21pc2UpLFxuICAgICAgICBvbjogYXJnc2FycmF5KGZ1bmN0aW9uKGFyZ3MpIHtcbiAgICAgICAgICB2YXIgcnEgPSBuZXcgUmVhY3RpdmVRdWVyeSh0aGlzLl9xdWVyeShxdWVyeSkpO1xuICAgICAgICAgIHJxLmluaXQoKTtcbiAgICAgICAgICBycS5vbi5hcHBseShycSwgYXJncyk7XG4gICAgICAgIH0uYmluZCh0aGlzKSlcbiAgICAgIH0pO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogT25seSB1c2VkIGluIHRlc3RpbmcgYXQgdGhlIG1vbWVudC5cbiAgICAgKiBAcGFyYW0gcXVlcnlcbiAgICAgKiBAcmV0dXJucyB7UmVhY3RpdmVRdWVyeX1cbiAgICAgKi9cbiAgICBfcmVhY3RpdmVRdWVyeTogZnVuY3Rpb24ocXVlcnkpIHtcbiAgICAgIHJldHVybiBuZXcgUmVhY3RpdmVRdWVyeShuZXcgUXVlcnkodGhpcywgcXVlcnkgfHwge30pKTtcbiAgICB9LFxuICAgIG9uZTogZnVuY3Rpb24ob3B0cywgY2IpIHtcbiAgICAgIGlmICh0eXBlb2Ygb3B0cyA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGNiID0gb3B0cztcbiAgICAgICAgb3B0cyA9IHt9O1xuICAgICAgfVxuICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgICAgdGhpcy5xdWVyeShvcHRzLCBmdW5jdGlvbihlcnIsIHJlcykge1xuICAgICAgICAgIGlmIChlcnIpIGNiKGVycik7XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBpZiAocmVzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgY2IoZXJyb3IoJ01vcmUgdGhhbiBvbmUgaW5zdGFuY2UgcmV0dXJuZWQgd2hlbiBleGVjdXRpbmcgZ2V0IHF1ZXJ5IScpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICByZXMgPSByZXMubGVuZ3RoID8gcmVzWzBdIDogbnVsbDtcbiAgICAgICAgICAgICAgY2IobnVsbCwgcmVzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9LFxuICAgIGFsbDogZnVuY3Rpb24ocSwgY2IpIHtcbiAgICAgIGlmICh0eXBlb2YgcSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGNiID0gcTtcbiAgICAgICAgcSA9IHt9O1xuICAgICAgfVxuICAgICAgcSA9IHEgfHwge307XG4gICAgICB2YXIgcXVlcnkgPSB7fTtcbiAgICAgIGlmIChxLl9fb3JkZXIpIHF1ZXJ5Ll9fb3JkZXIgPSBxLl9fb3JkZXI7XG4gICAgICByZXR1cm4gdGhpcy5xdWVyeShxLCBjYik7XG4gICAgfSxcbiAgICBfYXR0cmlidXRlRGVmaW5pdGlvbldpdGhOYW1lOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuYXR0cmlidXRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgYXR0cmlidXRlRGVmaW5pdGlvbiA9IHRoaXMuYXR0cmlidXRlc1tpXTtcbiAgICAgICAgaWYgKGF0dHJpYnV0ZURlZmluaXRpb24ubmFtZSA9PSBuYW1lKSByZXR1cm4gYXR0cmlidXRlRGVmaW5pdGlvbjtcbiAgICAgIH1cbiAgICB9LFxuICAgIC8qKlxuICAgICAqIE1hcCBkYXRhIGludG8gU2llc3RhLlxuICAgICAqXG4gICAgICogQHBhcmFtIGRhdGEgUmF3IGRhdGEgcmVjZWl2ZWQgcmVtb3RlbHkgb3Igb3RoZXJ3aXNlXG4gICAgICogQHBhcmFtIHtmdW5jdGlvbnxvYmplY3R9IFtvcHRzXVxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gb3B0cy5vdmVycmlkZVxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gb3B0cy5faWdub3JlSW5zdGFsbGVkIC0gQSBoYWNrIHRoYXQgYWxsb3dzIG1hcHBpbmcgb250byBNb2RlbHMgZXZlbiBpZiBpbnN0YWxsIHByb2Nlc3MgaGFzIG5vdCBmaW5pc2hlZC5cbiAgICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBbY2JdIENhbGxlZCBvbmNlIHBvdWNoIHBlcnNpc3RlbmNlIHJldHVybnMuXG4gICAgICovXG4gICAgZ3JhcGg6IGZ1bmN0aW9uKGRhdGEsIG9wdHMsIGNiKSB7XG4gICAgICBpZiAodHlwZW9mIG9wdHMgPT0gJ2Z1bmN0aW9uJykgY2IgPSBvcHRzO1xuICAgICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgICB2YXIgX21hcCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBvdmVycmlkZXMgPSBvcHRzLm92ZXJyaWRlO1xuICAgICAgICAgIGlmIChvdmVycmlkZXMpIHtcbiAgICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkob3ZlcnJpZGVzKSkgb3B0cy5vYmplY3RzID0gb3ZlcnJpZGVzO1xuICAgICAgICAgICAgZWxzZSBvcHRzLm9iamVjdHMgPSBbb3ZlcnJpZGVzXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZGVsZXRlIG9wdHMub3ZlcnJpZGU7XG4gICAgICAgICAgaWYgKHV0aWwuaXNBcnJheShkYXRhKSkge1xuICAgICAgICAgICAgdGhpcy5fbWFwQnVsayhkYXRhLCBvcHRzLCBjYik7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX21hcEJ1bGsoW2RhdGFdLCBvcHRzLCBmdW5jdGlvbihlcnIsIG9iamVjdHMpIHtcbiAgICAgICAgICAgICAgdmFyIG9iajtcbiAgICAgICAgICAgICAgaWYgKG9iamVjdHMpIHtcbiAgICAgICAgICAgICAgICBpZiAob2JqZWN0cy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgIG9iaiA9IG9iamVjdHNbMF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGVyciA9IGVyciA/ICh1dGlsLmlzQXJyYXkoZGF0YSkgPyBlcnIgOiAodXRpbC5pc0FycmF5KGVycikgPyBlcnJbMF0gOiBlcnIpKSA6IG51bGw7XG4gICAgICAgICAgICAgIGNiKGVyciwgb2JqKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICBpZiAob3B0cy5faWdub3JlSW5zdGFsbGVkKSB7XG4gICAgICAgICAgX21hcCgpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Ugc2llc3RhLl9hZnRlckluc3RhbGwoX21hcCk7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH0sXG4gICAgX21hcEJ1bGs6IGZ1bmN0aW9uKGRhdGEsIG9wdHMsIGNhbGxiYWNrKSB7XG4gICAgICB1dGlsLmV4dGVuZChvcHRzLCB7bW9kZWw6IHRoaXMsIGRhdGE6IGRhdGF9KTtcbiAgICAgIHZhciBvcCA9IG5ldyBNYXBwaW5nT3BlcmF0aW9uKG9wdHMpO1xuICAgICAgb3Auc3RhcnQoZnVuY3Rpb24oZXJyLCBvYmplY3RzKSB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGVycik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY2FsbGJhY2sobnVsbCwgb2JqZWN0cyB8fCBbXSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0sXG4gICAgX2NvdW50Q2FjaGU6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGNvbGxDYWNoZSA9IGNhY2hlLl9sb2NhbENhY2hlQnlUeXBlW3RoaXMuY29sbGVjdGlvbk5hbWVdIHx8IHt9O1xuICAgICAgdmFyIG1vZGVsQ2FjaGUgPSBjb2xsQ2FjaGVbdGhpcy5uYW1lXSB8fCB7fTtcbiAgICAgIHJldHVybiBPYmplY3Qua2V5cyhtb2RlbENhY2hlKS5yZWR1Y2UoZnVuY3Rpb24obSwgbG9jYWxJZCkge1xuICAgICAgICBtW2xvY2FsSWRdID0ge307XG4gICAgICAgIHJldHVybiBtO1xuICAgICAgfSwge30pO1xuICAgIH0sXG4gICAgY291bnQ6IGZ1bmN0aW9uKGNiKSB7XG4gICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgICBjYihudWxsLCBPYmplY3Qua2V5cyh0aGlzLl9jb3VudENhY2hlKCkpLmxlbmd0aCk7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH0sXG4gICAgX2R1bXA6IGZ1bmN0aW9uKGFzSlNPTikge1xuICAgICAgdmFyIGR1bXBlZCA9IHt9O1xuICAgICAgZHVtcGVkLm5hbWUgPSB0aGlzLm5hbWU7XG4gICAgICBkdW1wZWQuYXR0cmlidXRlcyA9IHRoaXMuYXR0cmlidXRlcztcbiAgICAgIGR1bXBlZC5pZCA9IHRoaXMuaWQ7XG4gICAgICBkdW1wZWQuY29sbGVjdGlvbiA9IHRoaXMuY29sbGVjdGlvbk5hbWU7XG4gICAgICBkdW1wZWQucmVsYXRpb25zaGlwcyA9IHRoaXMucmVsYXRpb25zaGlwcy5tYXAoZnVuY3Rpb24ocikge1xuICAgICAgICByZXR1cm4gci5pc0ZvcndhcmQgPyByLmZvcndhcmROYW1lIDogci5yZXZlcnNlTmFtZTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIGFzSlNPTiA/IHV0aWwucHJldHR5UHJpbnQoZHVtcGVkKSA6IGR1bXBlZDtcbiAgICB9LFxuICAgIHRvU3RyaW5nOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiAnTW9kZWxbJyArIHRoaXMubmFtZSArICddJztcbiAgICB9LFxuICAgIHJlbW92ZUFsbDogZnVuY3Rpb24oY2IpIHtcbiAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICAgIHRoaXMuYWxsKClcbiAgICAgICAgICAudGhlbihmdW5jdGlvbihpbnN0YW5jZXMpIHtcbiAgICAgICAgICAgIGluc3RhbmNlcy5yZW1vdmUoKTtcbiAgICAgICAgICAgIGNiKCk7XG4gICAgICAgICAgfSlcbiAgICAgICAgICAuY2F0Y2goY2IpO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG5cbiAgfSk7XG5cbiAgLy8gU3ViY2xhc3NpbmdcbiAgdXRpbC5leHRlbmQoTW9kZWwucHJvdG90eXBlLCB7XG4gICAgY2hpbGQ6IGZ1bmN0aW9uKG5hbWVPck9wdHMsIG9wdHMpIHtcbiAgICAgIGlmICh0eXBlb2YgbmFtZU9yT3B0cyA9PSAnc3RyaW5nJykge1xuICAgICAgICBvcHRzLm5hbWUgPSBuYW1lT3JPcHRzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3B0cyA9IG5hbWU7XG4gICAgICB9XG4gICAgICB1dGlsLmV4dGVuZChvcHRzLCB7XG4gICAgICAgIGF0dHJpYnV0ZXM6IEFycmF5LnByb3RvdHlwZS5jb25jYXQuY2FsbChvcHRzLmF0dHJpYnV0ZXMgfHwgW10sIHRoaXMuX29wdHMuYXR0cmlidXRlcyksXG4gICAgICAgIHJlbGF0aW9uc2hpcHM6IHV0aWwuZXh0ZW5kKG9wdHMucmVsYXRpb25zaGlwcyB8fCB7fSwgdGhpcy5fb3B0cy5yZWxhdGlvbnNoaXBzKSxcbiAgICAgICAgbWV0aG9kczogdXRpbC5leHRlbmQodXRpbC5leHRlbmQoe30sIHRoaXMuX29wdHMubWV0aG9kcykgfHwge30sIG9wdHMubWV0aG9kcyksXG4gICAgICAgIHN0YXRpY3M6IHV0aWwuZXh0ZW5kKHV0aWwuZXh0ZW5kKHt9LCB0aGlzLl9vcHRzLnN0YXRpY3MpIHx8IHt9LCBvcHRzLnN0YXRpY3MpLFxuICAgICAgICBwcm9wZXJ0aWVzOiB1dGlsLmV4dGVuZCh1dGlsLmV4dGVuZCh7fSwgdGhpcy5fb3B0cy5wcm9wZXJ0aWVzKSB8fCB7fSwgb3B0cy5wcm9wZXJ0aWVzKSxcbiAgICAgICAgaWQ6IG9wdHMuaWQgfHwgdGhpcy5fb3B0cy5pZCxcbiAgICAgICAgaW5pdDogb3B0cy5pbml0IHx8IHRoaXMuX29wdHMuaW5pdCxcbiAgICAgICAgcmVtb3ZlOiBvcHRzLnJlbW92ZSB8fCB0aGlzLl9vcHRzLnJlbW92ZSxcbiAgICAgICAgc2VyaWFsaXNlOiBvcHRzLnNlcmlhbGlzZSB8fCB0aGlzLl9vcHRzLnNlcmlhbGlzZSxcbiAgICAgICAgc2VyaWFsaXNlRmllbGQ6IG9wdHMuc2VyaWFsaXNlRmllbGQgfHwgdGhpcy5fb3B0cy5zZXJpYWxpc2VGaWVsZCxcbiAgICAgICAgcGFyc2VBdHRyaWJ1dGU6IG9wdHMucGFyc2VBdHRyaWJ1dGUgfHwgdGhpcy5fb3B0cy5wYXJzZUF0dHJpYnV0ZVxuICAgICAgfSk7XG5cbiAgICAgIGlmICh0aGlzLl9vcHRzLnNlcmlhbGlzYWJsZUZpZWxkcykge1xuICAgICAgICBvcHRzLnNlcmlhbGlzYWJsZUZpZWxkcyA9IEFycmF5LnByb3RvdHlwZS5jb25jYXQuYXBwbHkob3B0cy5zZXJpYWxpc2FibGVGaWVsZHMgfHwgW10sIHRoaXMuX29wdHMuc2VyaWFsaXNhYmxlRmllbGRzKTtcbiAgICAgIH1cblxuICAgICAgdmFyIG1vZGVsID0gdGhpcy5jb2xsZWN0aW9uLm1vZGVsKG9wdHMubmFtZSwgb3B0cyk7XG4gICAgICBtb2RlbC5wYXJlbnQgPSB0aGlzO1xuICAgICAgdGhpcy5jaGlsZHJlbi5wdXNoKG1vZGVsKTtcbiAgICAgIHJldHVybiBtb2RlbDtcbiAgICB9LFxuICAgIGlzQ2hpbGRPZjogZnVuY3Rpb24ocGFyZW50KSB7XG4gICAgICByZXR1cm4gdGhpcy5wYXJlbnQgPT0gcGFyZW50O1xuICAgIH0sXG4gICAgaXNQYXJlbnRPZjogZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgIHJldHVybiB0aGlzLmNoaWxkcmVuLmluZGV4T2YoY2hpbGQpID4gLTE7XG4gICAgfSxcbiAgICBpc0Rlc2NlbmRhbnRPZjogZnVuY3Rpb24oYW5jZXN0b3IpIHtcbiAgICAgIHZhciBwYXJlbnQgPSB0aGlzLnBhcmVudDtcbiAgICAgIHdoaWxlIChwYXJlbnQpIHtcbiAgICAgICAgaWYgKHBhcmVudCA9PSBhbmNlc3RvcikgcmV0dXJuIHRydWU7XG4gICAgICAgIHBhcmVudCA9IHBhcmVudC5wYXJlbnQ7XG4gICAgICB9XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSxcbiAgICBpc0FuY2VzdG9yT2Y6IGZ1bmN0aW9uKGRlc2NlbmRhbnQpIHtcbiAgICAgIHJldHVybiB0aGlzLmRlc2NlbmRhbnRzLmluZGV4T2YoZGVzY2VuZGFudCkgPiAtMTtcbiAgICB9LFxuICAgIGhhc0F0dHJpYnV0ZU5hbWVkOiBmdW5jdGlvbihhdHRyaWJ1dGVOYW1lKSB7XG4gICAgICByZXR1cm4gdGhpcy5fYXR0cmlidXRlTmFtZXMuaW5kZXhPZihhdHRyaWJ1dGVOYW1lKSA+IC0xO1xuICAgIH1cbiAgfSk7XG5cblxuICBtb2R1bGUuZXhwb3J0cyA9IE1vZGVsO1xuXG59KSgpO1xuIiwiKGZ1bmN0aW9uKCkge1xuICB2YXIgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgICBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSgnZXZlbnRzJyksXG4gICAgZXh0ZW5kID0gcmVxdWlyZSgnLi91dGlsJykuZXh0ZW5kLFxuICAgIGNvbGxlY3Rpb25SZWdpc3RyeSA9IHJlcXVpcmUoJy4vY29sbGVjdGlvblJlZ2lzdHJ5JykuQ29sbGVjdGlvblJlZ2lzdHJ5O1xuXG5cbiAgLyoqXG4gICAqIENvbnN0YW50cyB0aGF0IGRlc2NyaWJlIGNoYW5nZSBldmVudHMuXG4gICAqIFNldCA9PiBBIG5ldyB2YWx1ZSBpcyBhc3NpZ25lZCB0byBhbiBhdHRyaWJ1dGUvcmVsYXRpb25zaGlwXG4gICAqIFNwbGljZSA9PiBBbGwgamF2YXNjcmlwdCBhcnJheSBvcGVyYXRpb25zIGFyZSBkZXNjcmliZWQgYXMgc3BsaWNlcy5cbiAgICogRGVsZXRlID0+IFVzZWQgaW4gdGhlIGNhc2Ugd2hlcmUgb2JqZWN0cyBhcmUgcmVtb3ZlZCBmcm9tIGFuIGFycmF5LCBidXQgYXJyYXkgb3JkZXIgaXMgbm90IGtub3duIGluIGFkdmFuY2UuXG4gICAqIFJlbW92ZSA9PiBPYmplY3QgZGVsZXRpb24gZXZlbnRzXG4gICAqIE5ldyA9PiBPYmplY3QgY3JlYXRpb24gZXZlbnRzXG4gICAqIEB0eXBlIHtPYmplY3R9XG4gICAqL1xuICB2YXIgTW9kZWxFdmVudFR5cGUgPSB7XG4gICAgU2V0OiAnc2V0JyxcbiAgICBTcGxpY2U6ICdzcGxpY2UnLFxuICAgIE5ldzogJ25ldycsXG4gICAgUmVtb3ZlOiAncmVtb3ZlJ1xuICB9O1xuXG4gIC8qKlxuICAgKiBSZXByZXNlbnRzIGFuIGluZGl2aWR1YWwgY2hhbmdlLlxuICAgKiBAcGFyYW0gb3B0c1xuICAgKiBAY29uc3RydWN0b3JcbiAgICovXG4gIGZ1bmN0aW9uIE1vZGVsRXZlbnQob3B0cykge1xuICAgIHRoaXMuX29wdHMgPSBvcHRzIHx8IHt9O1xuICAgIE9iamVjdC5rZXlzKG9wdHMpLmZvckVhY2goZnVuY3Rpb24oaykge1xuICAgICAgdGhpc1trXSA9IG9wdHNba107XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfVxuXG5cbiAgTW9kZWxFdmVudC5wcm90b3R5cGUuX2R1bXAgPSBmdW5jdGlvbihwcmV0dHkpIHtcbiAgICB2YXIgZHVtcGVkID0ge307XG4gICAgZHVtcGVkLmNvbGxlY3Rpb24gPSAodHlwZW9mIHRoaXMuY29sbGVjdGlvbikgPT0gJ3N0cmluZycgPyB0aGlzLmNvbGxlY3Rpb24gOiB0aGlzLmNvbGxlY3Rpb24uX2R1bXAoKTtcbiAgICBkdW1wZWQubW9kZWwgPSAodHlwZW9mIHRoaXMubW9kZWwpID09ICdzdHJpbmcnID8gdGhpcy5tb2RlbCA6IHRoaXMubW9kZWwubmFtZTtcbiAgICBkdW1wZWQubG9jYWxJZCA9IHRoaXMubG9jYWxJZDtcbiAgICBkdW1wZWQuZmllbGQgPSB0aGlzLmZpZWxkO1xuICAgIGR1bXBlZC50eXBlID0gdGhpcy50eXBlO1xuICAgIGlmICh0aGlzLmluZGV4KSBkdW1wZWQuaW5kZXggPSB0aGlzLmluZGV4O1xuICAgIGlmICh0aGlzLmFkZGVkKSBkdW1wZWQuYWRkZWQgPSB0aGlzLmFkZGVkLm1hcChmdW5jdGlvbih4KSB7cmV0dXJuIHguX2R1bXAoKX0pO1xuICAgIGlmICh0aGlzLnJlbW92ZWQpIGR1bXBlZC5yZW1vdmVkID0gdGhpcy5yZW1vdmVkLm1hcChmdW5jdGlvbih4KSB7cmV0dXJuIHguX2R1bXAoKX0pO1xuICAgIGlmICh0aGlzLm9sZCkgZHVtcGVkLm9sZCA9IHRoaXMub2xkO1xuICAgIGlmICh0aGlzLm5ldykgZHVtcGVkLm5ldyA9IHRoaXMubmV3O1xuICAgIHJldHVybiBwcmV0dHkgPyB1dGlsLnByZXR0eVByaW50KGR1bXBlZCkgOiBkdW1wZWQ7XG4gIH07XG5cbiAgZnVuY3Rpb24gYnJvYWRjYXN0RXZlbnQoY29sbGVjdGlvbk5hbWUsIG1vZGVsTmFtZSwgb3B0cykge1xuICAgIHZhciBnZW5lcmljRXZlbnQgPSAnU2llc3RhJyxcbiAgICAgIGNvbGxlY3Rpb24gPSBjb2xsZWN0aW9uUmVnaXN0cnlbY29sbGVjdGlvbk5hbWVdLFxuICAgICAgbW9kZWwgPSBjb2xsZWN0aW9uW21vZGVsTmFtZV07XG4gICAgaWYgKCFjb2xsZWN0aW9uKSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gc3VjaCBjb2xsZWN0aW9uIFwiJyArIGNvbGxlY3Rpb25OYW1lICsgJ1wiJyk7XG4gICAgaWYgKCFtb2RlbCkgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ05vIHN1Y2ggbW9kZWwgXCInICsgbW9kZWxOYW1lICsgJ1wiJyk7XG4gICAgdmFyIHNob3VsZEVtaXQgPSBvcHRzLm9iai5fZW1pdEV2ZW50cztcbiAgICAvLyBEb24ndCBlbWl0IHBvaW50bGVzcyBldmVudHMuXG4gICAgaWYgKHNob3VsZEVtaXQgJiYgJ25ldycgaW4gb3B0cyAmJiAnb2xkJyBpbiBvcHRzKSB7XG4gICAgICBpZiAob3B0cy5uZXcgaW5zdGFuY2VvZiBEYXRlICYmIG9wdHMub2xkIGluc3RhbmNlb2YgRGF0ZSkge1xuICAgICAgICBzaG91bGRFbWl0ID0gb3B0cy5uZXcuZ2V0VGltZSgpICE9IG9wdHMub2xkLmdldFRpbWUoKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBzaG91bGRFbWl0ID0gb3B0cy5uZXcgIT0gb3B0cy5vbGQ7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChzaG91bGRFbWl0KSB7XG4gICAgICBldmVudHMuZW1pdChnZW5lcmljRXZlbnQsIG9wdHMpO1xuICAgICAgaWYgKHNpZXN0YS5pbnN0YWxsZWQpIHtcbiAgICAgICAgdmFyIG1vZGVsRXZlbnQgPSBjb2xsZWN0aW9uTmFtZSArICc6JyArIG1vZGVsTmFtZSxcbiAgICAgICAgICBsb2NhbElkRXZlbnQgPSBvcHRzLmxvY2FsSWQ7XG4gICAgICAgIGV2ZW50cy5lbWl0KGNvbGxlY3Rpb25OYW1lLCBvcHRzKTtcbiAgICAgICAgZXZlbnRzLmVtaXQobW9kZWxFdmVudCwgb3B0cyk7XG4gICAgICAgIGV2ZW50cy5lbWl0KGxvY2FsSWRFdmVudCwgb3B0cyk7XG4gICAgICB9XG4gICAgICBpZiAobW9kZWwuaWQgJiYgb3B0cy5vYmpbbW9kZWwuaWRdKSBldmVudHMuZW1pdChjb2xsZWN0aW9uTmFtZSArICc6JyArIG1vZGVsTmFtZSArICc6JyArIG9wdHMub2JqW21vZGVsLmlkXSwgb3B0cyk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gdmFsaWRhdGVFdmVudE9wdHMob3B0cykge1xuICAgIGlmICghb3B0cy5tb2RlbCkgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ011c3QgcGFzcyBhIG1vZGVsJyk7XG4gICAgaWYgKCFvcHRzLmNvbGxlY3Rpb24pIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNdXN0IHBhc3MgYSBjb2xsZWN0aW9uJyk7XG4gICAgaWYgKCFvcHRzLmxvY2FsSWQpIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNdXN0IHBhc3MgYSBsb2NhbCBpZGVudGlmaWVyJyk7XG4gICAgaWYgKCFvcHRzLm9iaikgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ011c3QgcGFzcyB0aGUgb2JqZWN0Jyk7XG4gIH1cblxuICBmdW5jdGlvbiBlbWl0KG9wdHMpIHtcbiAgICB2YWxpZGF0ZUV2ZW50T3B0cyhvcHRzKTtcbiAgICB2YXIgY29sbGVjdGlvbiA9IG9wdHMuY29sbGVjdGlvbjtcbiAgICB2YXIgbW9kZWwgPSBvcHRzLm1vZGVsO1xuICAgIHZhciBjID0gbmV3IE1vZGVsRXZlbnQob3B0cyk7XG4gICAgYnJvYWRjYXN0RXZlbnQoY29sbGVjdGlvbiwgbW9kZWwsIGMpO1xuICAgIHJldHVybiBjO1xuICB9XG5cbiAgZXh0ZW5kKGV4cG9ydHMsIHtcbiAgICBNb2RlbEV2ZW50OiBNb2RlbEV2ZW50LFxuICAgIGVtaXQ6IGVtaXQsXG4gICAgdmFsaWRhdGVFdmVudE9wdHM6IHZhbGlkYXRlRXZlbnRPcHRzLFxuICAgIE1vZGVsRXZlbnRUeXBlOiBNb2RlbEV2ZW50VHlwZVxuICB9KTtcbn0pKCk7IiwiKGZ1bmN0aW9uKCkge1xuICB2YXIgbWlzYyA9IHJlcXVpcmUoJy4vbWlzYycpO1xuXG4gIGZ1bmN0aW9uIGRvUGFyYWxsZWwoZm4pIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICByZXR1cm4gZm4uYXBwbHkobnVsbCwgW2VhY2hdLmNvbmNhdChhcmdzKSk7XG4gICAgfTtcbiAgfVxuXG4gIHZhciBtYXAgPSBkb1BhcmFsbGVsKF9hc3luY01hcCk7XG5cbiAgdmFyIHJvb3Q7XG5cbiAgZnVuY3Rpb24gX21hcChhcnIsIGl0ZXJhdG9yKSB7XG4gICAgaWYgKGFyci5tYXApIHtcbiAgICAgIHJldHVybiBhcnIubWFwKGl0ZXJhdG9yKTtcbiAgICB9XG4gICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICBlYWNoKGFyciwgZnVuY3Rpb24oeCwgaSwgYSkge1xuICAgICAgcmVzdWx0cy5wdXNoKGl0ZXJhdG9yKHgsIGksIGEpKTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0cztcbiAgfVxuXG4gIGZ1bmN0aW9uIF9hc3luY01hcChlYWNoZm4sIGFyciwgaXRlcmF0b3IsIGNhbGxiYWNrKSB7XG4gICAgYXJyID0gX21hcChhcnIsIGZ1bmN0aW9uKHgsIGkpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGluZGV4OiBpLFxuICAgICAgICB2YWx1ZTogeFxuICAgICAgfTtcbiAgICB9KTtcbiAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICBlYWNoZm4oYXJyLCBmdW5jdGlvbih4LCBjYWxsYmFjaykge1xuICAgICAgICBpdGVyYXRvcih4LnZhbHVlLCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgICAgZWFjaGZuKGFyciwgZnVuY3Rpb24oeCwgY2FsbGJhY2spIHtcbiAgICAgICAgaXRlcmF0b3IoeC52YWx1ZSwgZnVuY3Rpb24oZXJyLCB2KSB7XG4gICAgICAgICAgcmVzdWx0c1t4LmluZGV4XSA9IHY7XG4gICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgfSk7XG4gICAgICB9LCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgY2FsbGJhY2soZXJyLCByZXN1bHRzKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIHZhciBtYXBTZXJpZXMgPSBkb1NlcmllcyhfYXN5bmNNYXApO1xuXG4gIGZ1bmN0aW9uIGRvU2VyaWVzKGZuKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgcmV0dXJuIGZuLmFwcGx5KG51bGwsIFtlYWNoU2VyaWVzXS5jb25jYXQoYXJncykpO1xuICAgIH07XG4gIH1cblxuXG4gIGZ1bmN0aW9uIGVhY2hTZXJpZXMoYXJyLCBpdGVyYXRvciwgY2FsbGJhY2spIHtcbiAgICBjYWxsYmFjayA9IGNhbGxiYWNrIHx8IGZ1bmN0aW9uKCkge307XG4gICAgaWYgKCFhcnIubGVuZ3RoKSB7XG4gICAgICByZXR1cm4gY2FsbGJhY2soKTtcbiAgICB9XG4gICAgdmFyIGNvbXBsZXRlZCA9IDA7XG4gICAgdmFyIGl0ZXJhdGUgPSBmdW5jdGlvbigpIHtcbiAgICAgIGl0ZXJhdG9yKGFycltjb21wbGV0ZWRdLCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgY2FsbGJhY2sgPSBmdW5jdGlvbigpIHt9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbXBsZXRlZCArPSAxO1xuICAgICAgICAgIGlmIChjb21wbGV0ZWQgPj0gYXJyLmxlbmd0aCkge1xuICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaXRlcmF0ZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfTtcbiAgICBpdGVyYXRlKCk7XG4gIH1cblxuXG4gIGZ1bmN0aW9uIF9lYWNoKGFyciwgaXRlcmF0b3IpIHtcbiAgICBpZiAoYXJyLmZvckVhY2gpIHtcbiAgICAgIHJldHVybiBhcnIuZm9yRWFjaChpdGVyYXRvcik7XG4gICAgfVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJyLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICBpdGVyYXRvcihhcnJbaV0sIGksIGFycik7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZWFjaChhcnIsIGl0ZXJhdG9yLCBjYWxsYmFjaykge1xuICAgIGNhbGxiYWNrID0gY2FsbGJhY2sgfHwgZnVuY3Rpb24oKSB7fTtcbiAgICBpZiAoIWFyci5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBjYWxsYmFjaygpO1xuICAgIH1cbiAgICB2YXIgY29tcGxldGVkID0gMDtcbiAgICBfZWFjaChhcnIsIGZ1bmN0aW9uKHgpIHtcbiAgICAgIGl0ZXJhdG9yKHgsIG9ubHlfb25jZShkb25lKSk7XG4gICAgfSk7XG5cbiAgICBmdW5jdGlvbiBkb25lKGVycikge1xuICAgICAgaWYgKGVycikge1xuICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICBjYWxsYmFjayA9IGZ1bmN0aW9uKCkge307XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb21wbGV0ZWQgKz0gMTtcbiAgICAgICAgaWYgKGNvbXBsZXRlZCA+PSBhcnIubGVuZ3RoKSB7XG4gICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHZhciBfcGFyYWxsZWwgPSBmdW5jdGlvbihlYWNoZm4sIHRhc2tzLCBjYWxsYmFjaykge1xuICAgIGNhbGxiYWNrID0gY2FsbGJhY2sgfHwgZnVuY3Rpb24oKSB7fTtcbiAgICBpZiAobWlzYy5pc0FycmF5KHRhc2tzKSkge1xuICAgICAgZWFjaGZuLm1hcCh0YXNrcywgZnVuY3Rpb24oZm4sIGNhbGxiYWNrKSB7XG4gICAgICAgIGlmIChmbikge1xuICAgICAgICAgIGZuKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoIDw9IDEpIHtcbiAgICAgICAgICAgICAgYXJncyA9IGFyZ3NbMF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYWxsYmFjay5jYWxsKG51bGwsIGVyciwgYXJncyk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0sIGNhbGxiYWNrKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIHJlc3VsdHMgPSB7fTtcbiAgICAgIGVhY2hmbi5lYWNoKE9iamVjdC5rZXlzKHRhc2tzKSwgZnVuY3Rpb24oaywgY2FsbGJhY2spIHtcbiAgICAgICAgdGFza3Nba10oZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICAgIGlmIChhcmdzLmxlbmd0aCA8PSAxKSB7XG4gICAgICAgICAgICBhcmdzID0gYXJnc1swXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmVzdWx0c1trXSA9IGFyZ3M7XG4gICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgfSk7XG4gICAgICB9LCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgY2FsbGJhY2soZXJyLCByZXN1bHRzKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfTtcblxuICBmdW5jdGlvbiBzZXJpZXModGFza3MsIGNhbGxiYWNrKSB7XG4gICAgY2FsbGJhY2sgPSBjYWxsYmFjayB8fCBmdW5jdGlvbigpIHt9O1xuICAgIGlmIChtaXNjLmlzQXJyYXkodGFza3MpKSB7XG4gICAgICBtYXBTZXJpZXModGFza3MsIGZ1bmN0aW9uKGZuLCBjYWxsYmFjaykge1xuICAgICAgICBpZiAoZm4pIHtcbiAgICAgICAgICBmbihmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICAgIGlmIChhcmdzLmxlbmd0aCA8PSAxKSB7XG4gICAgICAgICAgICAgIGFyZ3MgPSBhcmdzWzBdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FsbGJhY2suY2FsbChudWxsLCBlcnIsIGFyZ3MpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9LCBjYWxsYmFjayk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciByZXN1bHRzID0ge307XG4gICAgICBlYWNoU2VyaWVzKE9iamVjdC5rZXlzKHRhc2tzKSwgZnVuY3Rpb24oaywgY2FsbGJhY2spIHtcbiAgICAgICAgdGFza3Nba10oZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICAgIGlmIChhcmdzLmxlbmd0aCA8PSAxKSB7XG4gICAgICAgICAgICBhcmdzID0gYXJnc1swXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmVzdWx0c1trXSA9IGFyZ3M7XG4gICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgfSk7XG4gICAgICB9LCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgY2FsbGJhY2soZXJyLCByZXN1bHRzKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG9ubHlfb25jZShmbikge1xuICAgIHZhciBjYWxsZWQgPSBmYWxzZTtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoY2FsbGVkKSB0aHJvdyBuZXcgRXJyb3IoXCJDYWxsYmFjayB3YXMgYWxyZWFkeSBjYWxsZWQuXCIpO1xuICAgICAgY2FsbGVkID0gdHJ1ZTtcbiAgICAgIGZuLmFwcGx5KHJvb3QsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcGFyYWxsZWwodGFza3MsIGNhbGxiYWNrKSB7XG4gICAgX3BhcmFsbGVsKHtcbiAgICAgIG1hcDogbWFwLFxuICAgICAgZWFjaDogZWFjaFxuICAgIH0sIHRhc2tzLCBjYWxsYmFjayk7XG4gIH1cblxuICBtb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBzZXJpZXM6IHNlcmllcyxcbiAgICBwYXJhbGxlbDogcGFyYWxsZWxcbiAgfTtcbn0pKCk7IiwiZnVuY3Rpb24gc3BsYXQoYXJyKSB7XG4gIGFyciA9IGFyciB8fCBbXTtcbiAgcmV0dXJuIGFyci5maWx0ZXIoZnVuY3Rpb24oeCkge3JldHVybiB4fSk7XG59XG5cbmZ1bmN0aW9uIHBhcmFsbGVsKHRhc2tzLCBjYikge1xuICB2YXIgcmVzdWx0cyA9IFtdLCBlcnJvcnMgPSBbXSwgbnVtRmluaXNoZWQgPSAwO1xuICB0YXNrcy5mb3JFYWNoKGZ1bmN0aW9uKGZuLCBpZHgpIHtcbiAgICByZXN1bHRzW2lkeF0gPSBmYWxzZTtcbiAgICBmbihmdW5jdGlvbihlcnIsIHJlcykge1xuICAgICAgbnVtRmluaXNoZWQrKztcbiAgICAgIGlmIChlcnIpIGVycm9yc1tpZHhdID0gZXJyO1xuICAgICAgcmVzdWx0c1tpZHhdID0gcmVzO1xuICAgICAgaWYgKG51bUZpbmlzaGVkID09IHRhc2tzLmxlbmd0aCkge1xuICAgICAgICBjYihcbiAgICAgICAgICBlcnJvcnMubGVuZ3RoID8gc3BsYXQoZXJyb3JzKSA6IG51bGwsXG4gICAgICAgICAgc3BsYXQocmVzdWx0cyksXG4gICAgICAgICAge3Jlc3VsdHM6IHJlc3VsdHMsIGVycm9yczogZXJyb3JzfVxuICAgICAgICApO1xuICAgICAgfVxuICAgIH0pO1xuICB9KTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIHBhcmFsbGVsOiBwYXJhbGxlbFxufTsiLCIvKlxuICogVGhpcyBpcyBhIGNvbGxlY3Rpb24gb2YgdXRpbGl0aWVzIHRha2VuIGZyb20gbGlicmFyaWVzIHN1Y2ggYXMgYXN5bmMuanMsIHVuZGVyc2NvcmUuanMgZXRjLlxuICogQG1vZHVsZSB1dGlsXG4gKi9cblxuKGZ1bmN0aW9uKCkge1xuICB2YXIgYXN5bmMgPSByZXF1aXJlKCcuL2FzeW5jJyksXG4gICAgYXN5bmMyID0gcmVxdWlyZSgnLi9hc3luYzInKSxcbiAgICBtaXNjID0gcmVxdWlyZSgnLi9taXNjJyk7XG5cbiAgbWlzYy5leHRlbmQobW9kdWxlLmV4cG9ydHMsIHtcbiAgICBhc3luYzogYXN5bmMsXG4gICAgYXN5bmMyOiBhc3luYzJcbiAgfSk7XG4gIG1pc2MuZXh0ZW5kKG1vZHVsZS5leHBvcnRzLCBtaXNjKTtcblxufSkoKTsiLCIoZnVuY3Rpb24oKSB7XG4gIHZhciBvYnNlcnZlID0gcmVxdWlyZSgnLi4vLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKS5QbGF0Zm9ybSxcbiAgICBQcm9taXNlID0gcmVxdWlyZSgnbGllJyksXG4gICAgYXJnc2FycmF5ID0gcmVxdWlyZSgnYXJnc2FycmF5JyksXG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vLi4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yO1xuXG4gIC8vIFVzZWQgYnkgcGFyYW1OYW1lcyBmdW5jdGlvbi5cbiAgdmFyIEZOX0FSR1MgPSAvXmZ1bmN0aW9uXFxzKlteXFwoXSpcXChcXHMqKFteXFwpXSopXFwpL20sXG4gICAgRk5fQVJHX1NQTElUID0gLywvLFxuICAgIEZOX0FSRyA9IC9eXFxzKihfPykoLis/KVxcMVxccyokLyxcbiAgICBTVFJJUF9DT01NRU5UUyA9IC8oKFxcL1xcLy4qJCl8KFxcL1xcKltcXHNcXFNdKj9cXCpcXC8pKS9tZztcblxuICBmdW5jdGlvbiBjYihjYWxsYmFjaywgZGVmZXJyZWQpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oZXJyKSB7XG4gICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrLmFwcGx5KGNhbGxiYWNrLCBhcmd1bWVudHMpO1xuICAgICAgaWYgKGRlZmVycmVkKSB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlLmFwcGx5KGRlZmVycmVkLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG4gIH1cblxuICB2YXIgZXh0ZW5kID0gZnVuY3Rpb24obGVmdCwgcmlnaHQpIHtcbiAgICBmb3IgKHZhciBwcm9wIGluIHJpZ2h0KSB7XG4gICAgICBpZiAocmlnaHQuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgbGVmdFtwcm9wXSA9IHJpZ2h0W3Byb3BdO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbGVmdDtcbiAgfTtcblxuICB2YXIgaXNBcnJheVNoaW0gPSBmdW5jdGlvbihvYmopIHtcbiAgICAgIGlmIChvYmopcmV0dXJuIG9iai50b1N0cmluZygpID09PSAnW29iamVjdCBBcnJheV0nO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0sXG4gICAgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgaXNBcnJheVNoaW0sXG4gICAgaXNTdHJpbmcgPSBmdW5jdGlvbihvKSB7XG4gICAgICByZXR1cm4gdHlwZW9mIG8gPT0gJ3N0cmluZycgfHwgbyBpbnN0YW5jZW9mIFN0cmluZ1xuICAgIH07XG4gIGV4dGVuZChtb2R1bGUuZXhwb3J0cywge1xuICAgIGFyZ3NhcnJheTogYXJnc2FycmF5LFxuICAgIC8qKlxuICAgICAqIFBlcmZvcm1zIGRpcnR5IGNoZWNrL09iamVjdC5vYnNlcnZlIGNhbGxiYWNrcyBkZXBlbmRpbmcgb24gdGhlIGJyb3dzZXIuXG4gICAgICpcbiAgICAgKiBJZiBPYmplY3Qub2JzZXJ2ZSBpcyBwcmVzZW50LFxuICAgICAqIEBwYXJhbSBjYWxsYmFja1xuICAgICAqL1xuICAgIG5leHQ6IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICBvYnNlcnZlLnBlcmZvcm1NaWNyb3Rhc2tDaGVja3BvaW50KCk7XG4gICAgICBzZXRUaW1lb3V0KGNhbGxiYWNrKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBoYW5kbGVyIHRoYXQgYWN0cyB1cG9uIGEgY2FsbGJhY2sgb3IgYSBwcm9taXNlIGRlcGVuZGluZyBvbiB0aGUgcmVzdWx0IG9mIGEgZGlmZmVyZW50IGNhbGxiYWNrLlxuICAgICAqIEBwYXJhbSBjYWxsYmFja1xuICAgICAqIEBwYXJhbSBbZGVmZXJyZWRdXG4gICAgICogQHJldHVybnMge0Z1bmN0aW9ufVxuICAgICAqL1xuICAgIGNiOiBjYixcbiAgICBleHRlbmQ6IGV4dGVuZCxcbiAgICBndWlkOiAoZnVuY3Rpb24oKSB7XG4gICAgICBmdW5jdGlvbiBzNCgpIHtcbiAgICAgICAgcmV0dXJuIE1hdGguZmxvb3IoKDEgKyBNYXRoLnJhbmRvbSgpKSAqIDB4MTAwMDApXG4gICAgICAgICAgLnRvU3RyaW5nKDE2KVxuICAgICAgICAgIC5zdWJzdHJpbmcoMSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHM0KCkgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArIHM0KCkgKyAnLScgK1xuICAgICAgICAgIHM0KCkgKyAnLScgKyBzNCgpICsgczQoKSArIHM0KCk7XG4gICAgICB9O1xuICAgIH0pKCksXG4gICAgYXNzZXJ0OiBmdW5jdGlvbihjb25kaXRpb24sIG1lc3NhZ2UsIGNvbnRleHQpIHtcbiAgICAgIGlmICghY29uZGl0aW9uKSB7XG4gICAgICAgIG1lc3NhZ2UgPSBtZXNzYWdlIHx8IFwiQXNzZXJ0aW9uIGZhaWxlZFwiO1xuICAgICAgICBjb250ZXh0ID0gY29udGV4dCB8fCB7fTtcbiAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IobWVzc2FnZSwgY29udGV4dCk7XG4gICAgICB9XG4gICAgfSxcbiAgICBwbHVjazogZnVuY3Rpb24oY29sbCwga2V5KSB7XG4gICAgICByZXR1cm4gY29sbC5tYXAoZnVuY3Rpb24obykge3JldHVybiBvW2tleV19KTtcbiAgICB9LFxuICAgIHRoZW5CeTogKGZ1bmN0aW9uKCkge1xuICAgICAgLyogbWl4aW4gZm9yIHRoZSBgdGhlbkJ5YCBwcm9wZXJ0eSAqL1xuICAgICAgZnVuY3Rpb24gZXh0ZW5kKGYpIHtcbiAgICAgICAgZi50aGVuQnkgPSB0YjtcbiAgICAgICAgcmV0dXJuIGY7XG4gICAgICB9XG5cbiAgICAgIC8qIGFkZHMgYSBzZWNvbmRhcnkgY29tcGFyZSBmdW5jdGlvbiB0byB0aGUgdGFyZ2V0IGZ1bmN0aW9uIChgdGhpc2AgY29udGV4dClcbiAgICAgICB3aGljaCBpcyBhcHBsaWVkIGluIGNhc2UgdGhlIGZpcnN0IG9uZSByZXR1cm5zIDAgKGVxdWFsKVxuICAgICAgIHJldHVybnMgYSBuZXcgY29tcGFyZSBmdW5jdGlvbiwgd2hpY2ggaGFzIGEgYHRoZW5CeWAgbWV0aG9kIGFzIHdlbGwgKi9cbiAgICAgIGZ1bmN0aW9uIHRiKHkpIHtcbiAgICAgICAgdmFyIHggPSB0aGlzO1xuICAgICAgICByZXR1cm4gZXh0ZW5kKGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgICAgICByZXR1cm4geChhLCBiKSB8fCB5KGEsIGIpO1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGV4dGVuZDtcbiAgICB9KSgpLFxuICAgIGRlZmluZVN1YlByb3BlcnR5OiBmdW5jdGlvbihwcm9wZXJ0eSwgc3ViT2JqLCBpbm5lclByb3BlcnR5KSB7XG4gICAgICByZXR1cm4gT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIHByb3BlcnR5LCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgaWYgKGlubmVyUHJvcGVydHkpIHtcbiAgICAgICAgICAgIHJldHVybiBzdWJPYmpbaW5uZXJQcm9wZXJ0eV07XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHN1Yk9ialtwcm9wZXJ0eV07XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgICAgaWYgKGlubmVyUHJvcGVydHkpIHtcbiAgICAgICAgICAgIHN1Yk9ialtpbm5lclByb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHN1Yk9ialtwcm9wZXJ0eV0gPSB2YWx1ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgfSk7XG4gICAgfSxcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eU5vU2V0OiBmdW5jdGlvbihwcm9wZXJ0eSwgc3ViT2JqLCBpbm5lclByb3BlcnR5KSB7XG4gICAgICByZXR1cm4gT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIHByb3BlcnR5LCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgaWYgKGlubmVyUHJvcGVydHkpIHtcbiAgICAgICAgICAgIHJldHVybiBzdWJPYmpbaW5uZXJQcm9wZXJ0eV07XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHN1Yk9ialtwcm9wZXJ0eV07XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgIH0pO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogVE9ETzogVGhpcyBpcyBibG9vZHkgdWdseS5cbiAgICAgKiBQcmV0dHkgZGFtbiB1c2VmdWwgdG8gYmUgYWJsZSB0byBhY2Nlc3MgdGhlIGJvdW5kIG9iamVjdCBvbiBhIGZ1bmN0aW9uIHRoby5cbiAgICAgKiBTZWU6IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMTQzMDcyNjQvd2hhdC1vYmplY3QtamF2YXNjcmlwdC1mdW5jdGlvbi1pcy1ib3VuZC10by13aGF0LWlzLWl0cy10aGlzXG4gICAgICovXG4gICAgX3BhdGNoQmluZDogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgX2JpbmQgPSBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHkuYmluZChGdW5jdGlvbi5wcm90b3R5cGUuYmluZCk7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoRnVuY3Rpb24ucHJvdG90eXBlLCAnYmluZCcsIHtcbiAgICAgICAgdmFsdWU6IGZ1bmN0aW9uKG9iaikge1xuICAgICAgICAgIHZhciBib3VuZEZ1bmN0aW9uID0gX2JpbmQodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoYm91bmRGdW5jdGlvbiwgJ19fc2llc3RhX2JvdW5kX29iamVjdCcsIHtcbiAgICAgICAgICAgIHZhbHVlOiBvYmosXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGVudW1lcmFibGU6IGZhbHNlXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgcmV0dXJuIGJvdW5kRnVuY3Rpb247XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0sXG4gICAgUHJvbWlzZTogUHJvbWlzZSxcbiAgICBwcm9taXNlOiBmdW5jdGlvbihjYiwgZm4pIHtcbiAgICAgIGNiID0gY2IgfHwgZnVuY3Rpb24oKSB7fTtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgdmFyIF9jYiA9IGFyZ3NhcnJheShmdW5jdGlvbihhcmdzKSB7XG4gICAgICAgICAgdmFyIGVyciA9IGFyZ3NbMF0sXG4gICAgICAgICAgICByZXN0ID0gYXJncy5zbGljZSgxKTtcbiAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1VuY2F1Z2h0IGVycm9yIGR1cmluZyBwcm9taXNlIHJlamVjdGlvbicsIGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIHJlc29sdmUocmVzdFswXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHJlamVjdChlKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1VuY2F1Z2h0IGVycm9yIGR1cmluZyBwcm9taXNlIHJlamVjdGlvbicsIGUpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHZhciBib3VuZCA9IGNiWydfX3NpZXN0YV9ib3VuZF9vYmplY3QnXSB8fCBjYjsgLy8gUHJlc2VydmUgYm91bmQgb2JqZWN0LlxuICAgICAgICAgIGNiLmFwcGx5KGJvdW5kLCBhcmdzKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGZuKF9jYik7XG4gICAgICB9KVxuICAgIH0sXG4gICAgc3ViUHJvcGVydGllczogZnVuY3Rpb24ob2JqLCBzdWJPYmosIHByb3BlcnRpZXMpIHtcbiAgICAgIGlmICghaXNBcnJheShwcm9wZXJ0aWVzKSkge1xuICAgICAgICBwcm9wZXJ0aWVzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICAgIH1cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcHJvcGVydGllcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAoZnVuY3Rpb24ocHJvcGVydHkpIHtcbiAgICAgICAgICB2YXIgb3B0cyA9IHtcbiAgICAgICAgICAgIHNldDogZmFsc2UsXG4gICAgICAgICAgICBuYW1lOiBwcm9wZXJ0eSxcbiAgICAgICAgICAgIHByb3BlcnR5OiBwcm9wZXJ0eVxuICAgICAgICAgIH07XG4gICAgICAgICAgaWYgKCFpc1N0cmluZyhwcm9wZXJ0eSkpIHtcbiAgICAgICAgICAgIGV4dGVuZChvcHRzLCBwcm9wZXJ0eSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHZhciBkZXNjID0ge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHN1Yk9ialtvcHRzLnByb3BlcnR5XTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICAgICAgfTtcbiAgICAgICAgICBpZiAob3B0cy5zZXQpIHtcbiAgICAgICAgICAgIGRlc2Muc2V0ID0gZnVuY3Rpb24odikge1xuICAgICAgICAgICAgICBzdWJPYmpbb3B0cy5wcm9wZXJ0eV0gPSB2O1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9XG4gICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgb3B0cy5uYW1lLCBkZXNjKTtcbiAgICAgICAgfSkocHJvcGVydGllc1tpXSk7XG4gICAgICB9XG4gICAgfSxcbiAgICBjYXBpdGFsaXNlRmlyc3RMZXR0ZXI6IGZ1bmN0aW9uKHN0cmluZykge1xuICAgICAgcmV0dXJuIHN0cmluZy5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHN0cmluZy5zbGljZSgxKTtcbiAgICB9LFxuICAgIGV4dGVuZEZyb21PcHRzOiBmdW5jdGlvbihvYmosIG9wdHMsIGRlZmF1bHRzLCBlcnJvck9uVW5rbm93bikge1xuICAgICAgZXJyb3JPblVua25vd24gPSBlcnJvck9uVW5rbm93biA9PSB1bmRlZmluZWQgPyB0cnVlIDogZXJyb3JPblVua25vd247XG4gICAgICBpZiAoZXJyb3JPblVua25vd24pIHtcbiAgICAgICAgdmFyIGRlZmF1bHRLZXlzID0gT2JqZWN0LmtleXMoZGVmYXVsdHMpLFxuICAgICAgICAgIG9wdHNLZXlzID0gT2JqZWN0LmtleXMob3B0cyk7XG4gICAgICAgIHZhciB1bmtub3duS2V5cyA9IG9wdHNLZXlzLmZpbHRlcihmdW5jdGlvbihuKSB7XG4gICAgICAgICAgcmV0dXJuIGRlZmF1bHRLZXlzLmluZGV4T2YobikgPT0gLTFcbiAgICAgICAgfSk7XG4gICAgICAgIGlmICh1bmtub3duS2V5cy5sZW5ndGgpIHRocm93IEVycm9yKCdVbmtub3duIG9wdGlvbnM6ICcgKyB1bmtub3duS2V5cy50b1N0cmluZygpKTtcbiAgICAgIH1cbiAgICAgIC8vIEFwcGx5IGFueSBmdW5jdGlvbnMgc3BlY2lmaWVkIGluIHRoZSBkZWZhdWx0cy5cbiAgICAgIE9iamVjdC5rZXlzKGRlZmF1bHRzKS5mb3JFYWNoKGZ1bmN0aW9uKGspIHtcbiAgICAgICAgdmFyIGQgPSBkZWZhdWx0c1trXTtcbiAgICAgICAgaWYgKHR5cGVvZiBkID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICBkZWZhdWx0c1trXSA9IGQob3B0c1trXSk7XG4gICAgICAgICAgZGVsZXRlIG9wdHNba107XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgZXh0ZW5kKGRlZmF1bHRzLCBvcHRzKTtcbiAgICAgIGV4dGVuZChvYmosIGRlZmF1bHRzKTtcbiAgICB9LFxuICAgIGlzU3RyaW5nOiBpc1N0cmluZyxcbiAgICBpc0FycmF5OiBpc0FycmF5LFxuICAgIHByZXR0eVByaW50OiBmdW5jdGlvbihvKSB7XG4gICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkobywgbnVsbCwgNCk7XG4gICAgfSxcbiAgICBmbGF0dGVuQXJyYXk6IGZ1bmN0aW9uKGFycikge1xuICAgICAgcmV0dXJuIGFyci5yZWR1Y2UoZnVuY3Rpb24obWVtbywgZSkge1xuICAgICAgICBpZiAoaXNBcnJheShlKSkge1xuICAgICAgICAgIG1lbW8gPSBtZW1vLmNvbmNhdChlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBtZW1vLnB1c2goZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICB9LCBbXSk7XG4gICAgfSxcbiAgICB1bmZsYXR0ZW5BcnJheTogZnVuY3Rpb24oYXJyLCBtb2RlbEFycikge1xuICAgICAgdmFyIG4gPSAwO1xuICAgICAgdmFyIHVuZmxhdHRlbmVkID0gW107XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG1vZGVsQXJyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChpc0FycmF5KG1vZGVsQXJyW2ldKSkge1xuICAgICAgICAgIHZhciBuZXdBcnIgPSBbXTtcbiAgICAgICAgICB1bmZsYXR0ZW5lZFtpXSA9IG5ld0FycjtcbiAgICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IG1vZGVsQXJyW2ldLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICBuZXdBcnIucHVzaChhcnJbbl0pO1xuICAgICAgICAgICAgbisrO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB1bmZsYXR0ZW5lZFtpXSA9IGFycltuXTtcbiAgICAgICAgICBuKys7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiB1bmZsYXR0ZW5lZDtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFJldHVybiB0aGUgcGFyYW1ldGVyIG5hbWVzIG9mIGEgZnVuY3Rpb24uXG4gICAgICogTm90ZTogYWRhcHRlZCBmcm9tIEFuZ3VsYXJKUyBkZXBlbmRlbmN5IGluamVjdGlvbiA6KVxuICAgICAqIEBwYXJhbSBmblxuICAgICAqL1xuICAgIHBhcmFtTmFtZXM6IGZ1bmN0aW9uKGZuKSB7XG4gICAgICAvLyBUT0RPOiBJcyB0aGVyZSBhIG1vcmUgcm9idXN0IHdheSBvZiBkb2luZyB0aGlzP1xuICAgICAgdmFyIHBhcmFtcyA9IFtdLFxuICAgICAgICBmblRleHQsXG4gICAgICAgIGFyZ0RlY2w7XG4gICAgICBmblRleHQgPSBmbi50b1N0cmluZygpLnJlcGxhY2UoU1RSSVBfQ09NTUVOVFMsICcnKTtcbiAgICAgIGFyZ0RlY2wgPSBmblRleHQubWF0Y2goRk5fQVJHUyk7XG5cbiAgICAgIGFyZ0RlY2xbMV0uc3BsaXQoRk5fQVJHX1NQTElUKS5mb3JFYWNoKGZ1bmN0aW9uKGFyZykge1xuICAgICAgICBhcmcucmVwbGFjZShGTl9BUkcsIGZ1bmN0aW9uKGFsbCwgdW5kZXJzY29yZSwgbmFtZSkge1xuICAgICAgICAgIHBhcmFtcy5wdXNoKG5hbWUpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHBhcmFtcztcbiAgICB9XG4gIH0pO1xufSkoKTsiLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gYXJnc0FycmF5O1xuXG5mdW5jdGlvbiBhcmdzQXJyYXkoZnVuKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgaWYgKGxlbikge1xuICAgICAgdmFyIGFyZ3MgPSBbXTtcbiAgICAgIHZhciBpID0gLTE7XG4gICAgICB3aGlsZSAoKytpIDwgbGVuKSB7XG4gICAgICAgIGFyZ3NbaV0gPSBhcmd1bWVudHNbaV07XG4gICAgICB9XG4gICAgICByZXR1cm4gZnVuLmNhbGwodGhpcywgYXJncyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBmdW4uY2FsbCh0aGlzLCBbXSk7XG4gICAgfVxuICB9O1xufSIsbnVsbCwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH1cbiAgICAgIHRocm93IFR5cGVFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4nKTtcbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICAgICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcblxuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIHZhciBtO1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgaWYgKHR5cGVvZiBjb25zb2xlLnRyYWNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgaW4gSUUgMTBcbiAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghZW1pdHRlci5fZXZlbnRzIHx8ICFlbWl0dGVyLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gMDtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbihlbWl0dGVyLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IDE7XG4gIGVsc2VcbiAgICByZXQgPSBlbWl0dGVyLl9ldmVudHNbdHlwZV0ubGVuZ3RoO1xuICByZXR1cm4gcmV0O1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuIiwiXG4vKipcbiAqIFRoaXMgaXMgdGhlIHdlYiBicm93c2VyIGltcGxlbWVudGF0aW9uIG9mIGBkZWJ1ZygpYC5cbiAqXG4gKiBFeHBvc2UgYGRlYnVnKClgIGFzIHRoZSBtb2R1bGUuXG4gKi9cblxuZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9kZWJ1ZycpO1xuZXhwb3J0cy5sb2cgPSBsb2c7XG5leHBvcnRzLmZvcm1hdEFyZ3MgPSBmb3JtYXRBcmdzO1xuZXhwb3J0cy5zYXZlID0gc2F2ZTtcbmV4cG9ydHMubG9hZCA9IGxvYWQ7XG5leHBvcnRzLnVzZUNvbG9ycyA9IHVzZUNvbG9ycztcblxuLyoqXG4gKiBVc2UgY2hyb21lLnN0b3JhZ2UubG9jYWwgaWYgd2UgYXJlIGluIGFuIGFwcFxuICovXG5cbnZhciBzdG9yYWdlO1xuXG5pZiAodHlwZW9mIGNocm9tZSAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIGNocm9tZS5zdG9yYWdlICE9PSAndW5kZWZpbmVkJylcbiAgc3RvcmFnZSA9IGNocm9tZS5zdG9yYWdlLmxvY2FsO1xuZWxzZVxuICBzdG9yYWdlID0gd2luZG93LmxvY2FsU3RvcmFnZTtcblxuLyoqXG4gKiBDb2xvcnMuXG4gKi9cblxuZXhwb3J0cy5jb2xvcnMgPSBbXG4gICdsaWdodHNlYWdyZWVuJyxcbiAgJ2ZvcmVzdGdyZWVuJyxcbiAgJ2dvbGRlbnJvZCcsXG4gICdkb2RnZXJibHVlJyxcbiAgJ2RhcmtvcmNoaWQnLFxuICAnY3JpbXNvbidcbl07XG5cbi8qKlxuICogQ3VycmVudGx5IG9ubHkgV2ViS2l0LWJhc2VkIFdlYiBJbnNwZWN0b3JzLCBGaXJlZm94ID49IHYzMSxcbiAqIGFuZCB0aGUgRmlyZWJ1ZyBleHRlbnNpb24gKGFueSBGaXJlZm94IHZlcnNpb24pIGFyZSBrbm93blxuICogdG8gc3VwcG9ydCBcIiVjXCIgQ1NTIGN1c3RvbWl6YXRpb25zLlxuICpcbiAqIFRPRE86IGFkZCBhIGBsb2NhbFN0b3JhZ2VgIHZhcmlhYmxlIHRvIGV4cGxpY2l0bHkgZW5hYmxlL2Rpc2FibGUgY29sb3JzXG4gKi9cblxuZnVuY3Rpb24gdXNlQ29sb3JzKCkge1xuICAvLyBpcyB3ZWJraXQ/IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzE2NDU5NjA2LzM3Njc3M1xuICByZXR1cm4gKCdXZWJraXRBcHBlYXJhbmNlJyBpbiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc3R5bGUpIHx8XG4gICAgLy8gaXMgZmlyZWJ1Zz8gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMzk4MTIwLzM3Njc3M1xuICAgICh3aW5kb3cuY29uc29sZSAmJiAoY29uc29sZS5maXJlYnVnIHx8IChjb25zb2xlLmV4Y2VwdGlvbiAmJiBjb25zb2xlLnRhYmxlKSkpIHx8XG4gICAgLy8gaXMgZmlyZWZveCA+PSB2MzE/XG4gICAgLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9Ub29scy9XZWJfQ29uc29sZSNTdHlsaW5nX21lc3NhZ2VzXG4gICAgKG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5tYXRjaCgvZmlyZWZveFxcLyhcXGQrKS8pICYmIHBhcnNlSW50KFJlZ0V4cC4kMSwgMTApID49IDMxKTtcbn1cblxuLyoqXG4gKiBNYXAgJWogdG8gYEpTT04uc3RyaW5naWZ5KClgLCBzaW5jZSBubyBXZWIgSW5zcGVjdG9ycyBkbyB0aGF0IGJ5IGRlZmF1bHQuXG4gKi9cblxuZXhwb3J0cy5mb3JtYXR0ZXJzLmogPSBmdW5jdGlvbih2KSB7XG4gIHJldHVybiBKU09OLnN0cmluZ2lmeSh2KTtcbn07XG5cblxuLyoqXG4gKiBDb2xvcml6ZSBsb2cgYXJndW1lbnRzIGlmIGVuYWJsZWQuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBmb3JtYXRBcmdzKCkge1xuICB2YXIgYXJncyA9IGFyZ3VtZW50cztcbiAgdmFyIHVzZUNvbG9ycyA9IHRoaXMudXNlQ29sb3JzO1xuXG4gIGFyZ3NbMF0gPSAodXNlQ29sb3JzID8gJyVjJyA6ICcnKVxuICAgICsgdGhpcy5uYW1lc3BhY2VcbiAgICArICh1c2VDb2xvcnMgPyAnICVjJyA6ICcgJylcbiAgICArIGFyZ3NbMF1cbiAgICArICh1c2VDb2xvcnMgPyAnJWMgJyA6ICcgJylcbiAgICArICcrJyArIGV4cG9ydHMuaHVtYW5pemUodGhpcy5kaWZmKTtcblxuICBpZiAoIXVzZUNvbG9ycykgcmV0dXJuIGFyZ3M7XG5cbiAgdmFyIGMgPSAnY29sb3I6ICcgKyB0aGlzLmNvbG9yO1xuICBhcmdzID0gW2FyZ3NbMF0sIGMsICdjb2xvcjogaW5oZXJpdCddLmNvbmNhdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmdzLCAxKSk7XG5cbiAgLy8gdGhlIGZpbmFsIFwiJWNcIiBpcyBzb21ld2hhdCB0cmlja3ksIGJlY2F1c2UgdGhlcmUgY291bGQgYmUgb3RoZXJcbiAgLy8gYXJndW1lbnRzIHBhc3NlZCBlaXRoZXIgYmVmb3JlIG9yIGFmdGVyIHRoZSAlYywgc28gd2UgbmVlZCB0b1xuICAvLyBmaWd1cmUgb3V0IHRoZSBjb3JyZWN0IGluZGV4IHRvIGluc2VydCB0aGUgQ1NTIGludG9cbiAgdmFyIGluZGV4ID0gMDtcbiAgdmFyIGxhc3RDID0gMDtcbiAgYXJnc1swXS5yZXBsYWNlKC8lW2EteiVdL2csIGZ1bmN0aW9uKG1hdGNoKSB7XG4gICAgaWYgKCclJScgPT09IG1hdGNoKSByZXR1cm47XG4gICAgaW5kZXgrKztcbiAgICBpZiAoJyVjJyA9PT0gbWF0Y2gpIHtcbiAgICAgIC8vIHdlIG9ubHkgYXJlIGludGVyZXN0ZWQgaW4gdGhlICpsYXN0KiAlY1xuICAgICAgLy8gKHRoZSB1c2VyIG1heSBoYXZlIHByb3ZpZGVkIHRoZWlyIG93bilcbiAgICAgIGxhc3RDID0gaW5kZXg7XG4gICAgfVxuICB9KTtcblxuICBhcmdzLnNwbGljZShsYXN0QywgMCwgYyk7XG4gIHJldHVybiBhcmdzO1xufVxuXG4vKipcbiAqIEludm9rZXMgYGNvbnNvbGUubG9nKClgIHdoZW4gYXZhaWxhYmxlLlxuICogTm8tb3Agd2hlbiBgY29uc29sZS5sb2dgIGlzIG5vdCBhIFwiZnVuY3Rpb25cIi5cbiAqXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGxvZygpIHtcbiAgLy8gdGhpcyBoYWNrZXJ5IGlzIHJlcXVpcmVkIGZvciBJRTgvOSwgd2hlcmVcbiAgLy8gdGhlIGBjb25zb2xlLmxvZ2AgZnVuY3Rpb24gZG9lc24ndCBoYXZlICdhcHBseSdcbiAgcmV0dXJuICdvYmplY3QnID09PSB0eXBlb2YgY29uc29sZVxuICAgICYmIGNvbnNvbGUubG9nXG4gICAgJiYgRnVuY3Rpb24ucHJvdG90eXBlLmFwcGx5LmNhbGwoY29uc29sZS5sb2csIGNvbnNvbGUsIGFyZ3VtZW50cyk7XG59XG5cbi8qKlxuICogU2F2ZSBgbmFtZXNwYWNlc2AuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVzcGFjZXNcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHNhdmUobmFtZXNwYWNlcykge1xuICB0cnkge1xuICAgIGlmIChudWxsID09IG5hbWVzcGFjZXMpIHtcbiAgICAgIHN0b3JhZ2UucmVtb3ZlSXRlbSgnZGVidWcnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RvcmFnZS5kZWJ1ZyA9IG5hbWVzcGFjZXM7XG4gICAgfVxuICB9IGNhdGNoKGUpIHt9XG59XG5cbi8qKlxuICogTG9hZCBgbmFtZXNwYWNlc2AuXG4gKlxuICogQHJldHVybiB7U3RyaW5nfSByZXR1cm5zIHRoZSBwcmV2aW91c2x5IHBlcnNpc3RlZCBkZWJ1ZyBtb2Rlc1xuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gbG9hZCgpIHtcbiAgdmFyIHI7XG4gIHRyeSB7XG4gICAgciA9IHN0b3JhZ2UuZGVidWc7XG4gIH0gY2F0Y2goZSkge31cbiAgcmV0dXJuIHI7XG59XG5cbi8qKlxuICogRW5hYmxlIG5hbWVzcGFjZXMgbGlzdGVkIGluIGBsb2NhbFN0b3JhZ2UuZGVidWdgIGluaXRpYWxseS5cbiAqL1xuXG5leHBvcnRzLmVuYWJsZShsb2FkKCkpO1xuIiwiXG4vKipcbiAqIFRoaXMgaXMgdGhlIGNvbW1vbiBsb2dpYyBmb3IgYm90aCB0aGUgTm9kZS5qcyBhbmQgd2ViIGJyb3dzZXJcbiAqIGltcGxlbWVudGF0aW9ucyBvZiBgZGVidWcoKWAuXG4gKlxuICogRXhwb3NlIGBkZWJ1ZygpYCBhcyB0aGUgbW9kdWxlLlxuICovXG5cbmV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IGRlYnVnO1xuZXhwb3J0cy5jb2VyY2UgPSBjb2VyY2U7XG5leHBvcnRzLmRpc2FibGUgPSBkaXNhYmxlO1xuZXhwb3J0cy5lbmFibGUgPSBlbmFibGU7XG5leHBvcnRzLmVuYWJsZWQgPSBlbmFibGVkO1xuZXhwb3J0cy5odW1hbml6ZSA9IHJlcXVpcmUoJ21zJyk7XG5cbi8qKlxuICogVGhlIGN1cnJlbnRseSBhY3RpdmUgZGVidWcgbW9kZSBuYW1lcywgYW5kIG5hbWVzIHRvIHNraXAuXG4gKi9cblxuZXhwb3J0cy5uYW1lcyA9IFtdO1xuZXhwb3J0cy5za2lwcyA9IFtdO1xuXG4vKipcbiAqIE1hcCBvZiBzcGVjaWFsIFwiJW5cIiBoYW5kbGluZyBmdW5jdGlvbnMsIGZvciB0aGUgZGVidWcgXCJmb3JtYXRcIiBhcmd1bWVudC5cbiAqXG4gKiBWYWxpZCBrZXkgbmFtZXMgYXJlIGEgc2luZ2xlLCBsb3dlcmNhc2VkIGxldHRlciwgaS5lLiBcIm5cIi5cbiAqL1xuXG5leHBvcnRzLmZvcm1hdHRlcnMgPSB7fTtcblxuLyoqXG4gKiBQcmV2aW91c2x5IGFzc2lnbmVkIGNvbG9yLlxuICovXG5cbnZhciBwcmV2Q29sb3IgPSAwO1xuXG4vKipcbiAqIFByZXZpb3VzIGxvZyB0aW1lc3RhbXAuXG4gKi9cblxudmFyIHByZXZUaW1lO1xuXG4vKipcbiAqIFNlbGVjdCBhIGNvbG9yLlxuICpcbiAqIEByZXR1cm4ge051bWJlcn1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHNlbGVjdENvbG9yKCkge1xuICByZXR1cm4gZXhwb3J0cy5jb2xvcnNbcHJldkNvbG9yKysgJSBleHBvcnRzLmNvbG9ycy5sZW5ndGhdO1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIGRlYnVnZ2VyIHdpdGggdGhlIGdpdmVuIGBuYW1lc3BhY2VgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2VcbiAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBkZWJ1ZyhuYW1lc3BhY2UpIHtcblxuICAvLyBkZWZpbmUgdGhlIGBkaXNhYmxlZGAgdmVyc2lvblxuICBmdW5jdGlvbiBkaXNhYmxlZCgpIHtcbiAgfVxuICBkaXNhYmxlZC5lbmFibGVkID0gZmFsc2U7XG5cbiAgLy8gZGVmaW5lIHRoZSBgZW5hYmxlZGAgdmVyc2lvblxuICBmdW5jdGlvbiBlbmFibGVkKCkge1xuXG4gICAgdmFyIHNlbGYgPSBlbmFibGVkO1xuXG4gICAgLy8gc2V0IGBkaWZmYCB0aW1lc3RhbXBcbiAgICB2YXIgY3VyciA9ICtuZXcgRGF0ZSgpO1xuICAgIHZhciBtcyA9IGN1cnIgLSAocHJldlRpbWUgfHwgY3Vycik7XG4gICAgc2VsZi5kaWZmID0gbXM7XG4gICAgc2VsZi5wcmV2ID0gcHJldlRpbWU7XG4gICAgc2VsZi5jdXJyID0gY3VycjtcbiAgICBwcmV2VGltZSA9IGN1cnI7XG5cbiAgICAvLyBhZGQgdGhlIGBjb2xvcmAgaWYgbm90IHNldFxuICAgIGlmIChudWxsID09IHNlbGYudXNlQ29sb3JzKSBzZWxmLnVzZUNvbG9ycyA9IGV4cG9ydHMudXNlQ29sb3JzKCk7XG4gICAgaWYgKG51bGwgPT0gc2VsZi5jb2xvciAmJiBzZWxmLnVzZUNvbG9ycykgc2VsZi5jb2xvciA9IHNlbGVjdENvbG9yKCk7XG5cbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG5cbiAgICBhcmdzWzBdID0gZXhwb3J0cy5jb2VyY2UoYXJnc1swXSk7XG5cbiAgICBpZiAoJ3N0cmluZycgIT09IHR5cGVvZiBhcmdzWzBdKSB7XG4gICAgICAvLyBhbnl0aGluZyBlbHNlIGxldCdzIGluc3BlY3Qgd2l0aCAlb1xuICAgICAgYXJncyA9IFsnJW8nXS5jb25jYXQoYXJncyk7XG4gICAgfVxuXG4gICAgLy8gYXBwbHkgYW55IGBmb3JtYXR0ZXJzYCB0cmFuc2Zvcm1hdGlvbnNcbiAgICB2YXIgaW5kZXggPSAwO1xuICAgIGFyZ3NbMF0gPSBhcmdzWzBdLnJlcGxhY2UoLyUoW2EteiVdKS9nLCBmdW5jdGlvbihtYXRjaCwgZm9ybWF0KSB7XG4gICAgICAvLyBpZiB3ZSBlbmNvdW50ZXIgYW4gZXNjYXBlZCAlIHRoZW4gZG9uJ3QgaW5jcmVhc2UgdGhlIGFycmF5IGluZGV4XG4gICAgICBpZiAobWF0Y2ggPT09ICclJScpIHJldHVybiBtYXRjaDtcbiAgICAgIGluZGV4Kys7XG4gICAgICB2YXIgZm9ybWF0dGVyID0gZXhwb3J0cy5mb3JtYXR0ZXJzW2Zvcm1hdF07XG4gICAgICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGZvcm1hdHRlcikge1xuICAgICAgICB2YXIgdmFsID0gYXJnc1tpbmRleF07XG4gICAgICAgIG1hdGNoID0gZm9ybWF0dGVyLmNhbGwoc2VsZiwgdmFsKTtcblxuICAgICAgICAvLyBub3cgd2UgbmVlZCB0byByZW1vdmUgYGFyZ3NbaW5kZXhdYCBzaW5jZSBpdCdzIGlubGluZWQgaW4gdGhlIGBmb3JtYXRgXG4gICAgICAgIGFyZ3Muc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgaW5kZXgtLTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtYXRjaDtcbiAgICB9KTtcblxuICAgIGlmICgnZnVuY3Rpb24nID09PSB0eXBlb2YgZXhwb3J0cy5mb3JtYXRBcmdzKSB7XG4gICAgICBhcmdzID0gZXhwb3J0cy5mb3JtYXRBcmdzLmFwcGx5KHNlbGYsIGFyZ3MpO1xuICAgIH1cbiAgICB2YXIgbG9nRm4gPSBlbmFibGVkLmxvZyB8fCBleHBvcnRzLmxvZyB8fCBjb25zb2xlLmxvZy5iaW5kKGNvbnNvbGUpO1xuICAgIGxvZ0ZuLmFwcGx5KHNlbGYsIGFyZ3MpO1xuICB9XG4gIGVuYWJsZWQuZW5hYmxlZCA9IHRydWU7XG5cbiAgdmFyIGZuID0gZXhwb3J0cy5lbmFibGVkKG5hbWVzcGFjZSkgPyBlbmFibGVkIDogZGlzYWJsZWQ7XG5cbiAgZm4ubmFtZXNwYWNlID0gbmFtZXNwYWNlO1xuXG4gIHJldHVybiBmbjtcbn1cblxuLyoqXG4gKiBFbmFibGVzIGEgZGVidWcgbW9kZSBieSBuYW1lc3BhY2VzLiBUaGlzIGNhbiBpbmNsdWRlIG1vZGVzXG4gKiBzZXBhcmF0ZWQgYnkgYSBjb2xvbiBhbmQgd2lsZGNhcmRzLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2VzXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGVuYWJsZShuYW1lc3BhY2VzKSB7XG4gIGV4cG9ydHMuc2F2ZShuYW1lc3BhY2VzKTtcblxuICB2YXIgc3BsaXQgPSAobmFtZXNwYWNlcyB8fCAnJykuc3BsaXQoL1tcXHMsXSsvKTtcbiAgdmFyIGxlbiA9IHNwbGl0Lmxlbmd0aDtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKCFzcGxpdFtpXSkgY29udGludWU7IC8vIGlnbm9yZSBlbXB0eSBzdHJpbmdzXG4gICAgbmFtZXNwYWNlcyA9IHNwbGl0W2ldLnJlcGxhY2UoL1xcKi9nLCAnLio/Jyk7XG4gICAgaWYgKG5hbWVzcGFjZXNbMF0gPT09ICctJykge1xuICAgICAgZXhwb3J0cy5za2lwcy5wdXNoKG5ldyBSZWdFeHAoJ14nICsgbmFtZXNwYWNlcy5zdWJzdHIoMSkgKyAnJCcpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZXhwb3J0cy5uYW1lcy5wdXNoKG5ldyBSZWdFeHAoJ14nICsgbmFtZXNwYWNlcyArICckJykpO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIERpc2FibGUgZGVidWcgb3V0cHV0LlxuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZGlzYWJsZSgpIHtcbiAgZXhwb3J0cy5lbmFibGUoJycpO1xufVxuXG4vKipcbiAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgZ2l2ZW4gbW9kZSBuYW1lIGlzIGVuYWJsZWQsIGZhbHNlIG90aGVyd2lzZS5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZW5hYmxlZChuYW1lKSB7XG4gIHZhciBpLCBsZW47XG4gIGZvciAoaSA9IDAsIGxlbiA9IGV4cG9ydHMuc2tpcHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBpZiAoZXhwb3J0cy5za2lwc1tpXS50ZXN0KG5hbWUpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIGZvciAoaSA9IDAsIGxlbiA9IGV4cG9ydHMubmFtZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBpZiAoZXhwb3J0cy5uYW1lc1tpXS50ZXN0KG5hbWUpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vKipcbiAqIENvZXJjZSBgdmFsYC5cbiAqXG4gKiBAcGFyYW0ge01peGVkfSB2YWxcbiAqIEByZXR1cm4ge01peGVkfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gY29lcmNlKHZhbCkge1xuICBpZiAodmFsIGluc3RhbmNlb2YgRXJyb3IpIHJldHVybiB2YWwuc3RhY2sgfHwgdmFsLm1lc3NhZ2U7XG4gIHJldHVybiB2YWw7XG59XG4iLCIvKipcbiAqIEhlbHBlcnMuXG4gKi9cblxudmFyIHMgPSAxMDAwO1xudmFyIG0gPSBzICogNjA7XG52YXIgaCA9IG0gKiA2MDtcbnZhciBkID0gaCAqIDI0O1xudmFyIHkgPSBkICogMzY1LjI1O1xuXG4vKipcbiAqIFBhcnNlIG9yIGZvcm1hdCB0aGUgZ2l2ZW4gYHZhbGAuXG4gKlxuICogT3B0aW9uczpcbiAqXG4gKiAgLSBgbG9uZ2AgdmVyYm9zZSBmb3JtYXR0aW5nIFtmYWxzZV1cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xOdW1iZXJ9IHZhbFxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqIEByZXR1cm4ge1N0cmluZ3xOdW1iZXJ9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odmFsLCBvcHRpb25zKXtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gIGlmICgnc3RyaW5nJyA9PSB0eXBlb2YgdmFsKSByZXR1cm4gcGFyc2UodmFsKTtcbiAgcmV0dXJuIG9wdGlvbnMubG9uZ1xuICAgID8gbG9uZyh2YWwpXG4gICAgOiBzaG9ydCh2YWwpO1xufTtcblxuLyoqXG4gKiBQYXJzZSB0aGUgZ2l2ZW4gYHN0cmAgYW5kIHJldHVybiBtaWxsaXNlY29uZHMuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7TnVtYmVyfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gcGFyc2Uoc3RyKSB7XG4gIHZhciBtYXRjaCA9IC9eKCg/OlxcZCspP1xcLj9cXGQrKSAqKG1zfHNlY29uZHM/fHN8bWludXRlcz98bXxob3Vycz98aHxkYXlzP3xkfHllYXJzP3x5KT8kL2kuZXhlYyhzdHIpO1xuICBpZiAoIW1hdGNoKSByZXR1cm47XG4gIHZhciBuID0gcGFyc2VGbG9hdChtYXRjaFsxXSk7XG4gIHZhciB0eXBlID0gKG1hdGNoWzJdIHx8ICdtcycpLnRvTG93ZXJDYXNlKCk7XG4gIHN3aXRjaCAodHlwZSkge1xuICAgIGNhc2UgJ3llYXJzJzpcbiAgICBjYXNlICd5ZWFyJzpcbiAgICBjYXNlICd5JzpcbiAgICAgIHJldHVybiBuICogeTtcbiAgICBjYXNlICdkYXlzJzpcbiAgICBjYXNlICdkYXknOlxuICAgIGNhc2UgJ2QnOlxuICAgICAgcmV0dXJuIG4gKiBkO1xuICAgIGNhc2UgJ2hvdXJzJzpcbiAgICBjYXNlICdob3VyJzpcbiAgICBjYXNlICdoJzpcbiAgICAgIHJldHVybiBuICogaDtcbiAgICBjYXNlICdtaW51dGVzJzpcbiAgICBjYXNlICdtaW51dGUnOlxuICAgIGNhc2UgJ20nOlxuICAgICAgcmV0dXJuIG4gKiBtO1xuICAgIGNhc2UgJ3NlY29uZHMnOlxuICAgIGNhc2UgJ3NlY29uZCc6XG4gICAgY2FzZSAncyc6XG4gICAgICByZXR1cm4gbiAqIHM7XG4gICAgY2FzZSAnbXMnOlxuICAgICAgcmV0dXJuIG47XG4gIH1cbn1cblxuLyoqXG4gKiBTaG9ydCBmb3JtYXQgZm9yIGBtc2AuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1zXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBzaG9ydChtcykge1xuICBpZiAobXMgPj0gZCkgcmV0dXJuIE1hdGgucm91bmQobXMgLyBkKSArICdkJztcbiAgaWYgKG1zID49IGgpIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gaCkgKyAnaCc7XG4gIGlmIChtcyA+PSBtKSByZXR1cm4gTWF0aC5yb3VuZChtcyAvIG0pICsgJ20nO1xuICBpZiAobXMgPj0gcykgcmV0dXJuIE1hdGgucm91bmQobXMgLyBzKSArICdzJztcbiAgcmV0dXJuIG1zICsgJ21zJztcbn1cblxuLyoqXG4gKiBMb25nIGZvcm1hdCBmb3IgYG1zYC5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gbXNcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGxvbmcobXMpIHtcbiAgcmV0dXJuIHBsdXJhbChtcywgZCwgJ2RheScpXG4gICAgfHwgcGx1cmFsKG1zLCBoLCAnaG91cicpXG4gICAgfHwgcGx1cmFsKG1zLCBtLCAnbWludXRlJylcbiAgICB8fCBwbHVyYWwobXMsIHMsICdzZWNvbmQnKVxuICAgIHx8IG1zICsgJyBtcyc7XG59XG5cbi8qKlxuICogUGx1cmFsaXphdGlvbiBoZWxwZXIuXG4gKi9cblxuZnVuY3Rpb24gcGx1cmFsKG1zLCBuLCBuYW1lKSB7XG4gIGlmIChtcyA8IG4pIHJldHVybjtcbiAgaWYgKG1zIDwgbiAqIDEuNSkgcmV0dXJuIE1hdGguZmxvb3IobXMgLyBuKSArICcgJyArIG5hbWU7XG4gIHJldHVybiBNYXRoLmNlaWwobXMgLyBuKSArICcgJyArIG5hbWUgKyAncyc7XG59XG4iLCJ2YXIgaGFzT3duID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcbnZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG52YXIgdW5kZWZpbmVkO1xuXG52YXIgaXNQbGFpbk9iamVjdCA9IGZ1bmN0aW9uIGlzUGxhaW5PYmplY3Qob2JqKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG4gICAgaWYgKCFvYmogfHwgdG9TdHJpbmcuY2FsbChvYmopICE9PSAnW29iamVjdCBPYmplY3RdJyB8fCBvYmoubm9kZVR5cGUgfHwgb2JqLnNldEludGVydmFsKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB2YXIgaGFzX293bl9jb25zdHJ1Y3RvciA9IGhhc093bi5jYWxsKG9iaiwgJ2NvbnN0cnVjdG9yJyk7XG4gICAgdmFyIGhhc19pc19wcm9wZXJ0eV9vZl9tZXRob2QgPSBvYmouY29uc3RydWN0b3IgJiYgb2JqLmNvbnN0cnVjdG9yLnByb3RvdHlwZSAmJiBoYXNPd24uY2FsbChvYmouY29uc3RydWN0b3IucHJvdG90eXBlLCAnaXNQcm90b3R5cGVPZicpO1xuICAgIC8vIE5vdCBvd24gY29uc3RydWN0b3IgcHJvcGVydHkgbXVzdCBiZSBPYmplY3RcbiAgICBpZiAob2JqLmNvbnN0cnVjdG9yICYmICFoYXNfb3duX2NvbnN0cnVjdG9yICYmICFoYXNfaXNfcHJvcGVydHlfb2ZfbWV0aG9kKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBPd24gcHJvcGVydGllcyBhcmUgZW51bWVyYXRlZCBmaXJzdGx5LCBzbyB0byBzcGVlZCB1cCxcbiAgICAvLyBpZiBsYXN0IG9uZSBpcyBvd24sIHRoZW4gYWxsIHByb3BlcnRpZXMgYXJlIG93bi5cbiAgICB2YXIga2V5O1xuICAgIGZvciAoa2V5IGluIG9iaikge31cblxuICAgIHJldHVybiBrZXkgPT09IHVuZGVmaW5lZCB8fCBoYXNPd24uY2FsbChvYmosIGtleSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGV4dGVuZCgpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcbiAgICB2YXIgb3B0aW9ucywgbmFtZSwgc3JjLCBjb3B5LCBjb3B5SXNBcnJheSwgY2xvbmUsXG4gICAgICAgIHRhcmdldCA9IGFyZ3VtZW50c1swXSxcbiAgICAgICAgaSA9IDEsXG4gICAgICAgIGxlbmd0aCA9IGFyZ3VtZW50cy5sZW5ndGgsXG4gICAgICAgIGRlZXAgPSBmYWxzZTtcblxuICAgIC8vIEhhbmRsZSBhIGRlZXAgY29weSBzaXR1YXRpb25cbiAgICBpZiAodHlwZW9mIHRhcmdldCA9PT0gXCJib29sZWFuXCIpIHtcbiAgICAgICAgZGVlcCA9IHRhcmdldDtcbiAgICAgICAgdGFyZ2V0ID0gYXJndW1lbnRzWzFdIHx8IHt9O1xuICAgICAgICAvLyBza2lwIHRoZSBib29sZWFuIGFuZCB0aGUgdGFyZ2V0XG4gICAgICAgIGkgPSAyO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHRhcmdldCAhPT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgdGFyZ2V0ICE9PSBcImZ1bmN0aW9uXCIgfHwgdGFyZ2V0ID09IHVuZGVmaW5lZCkge1xuICAgICAgICB0YXJnZXQgPSB7fTtcbiAgICB9XG5cbiAgICBmb3IgKDsgaSA8IGxlbmd0aDsgKytpKSB7XG4gICAgICAgIC8vIE9ubHkgZGVhbCB3aXRoIG5vbi1udWxsL3VuZGVmaW5lZCB2YWx1ZXNcbiAgICAgICAgaWYgKChvcHRpb25zID0gYXJndW1lbnRzW2ldKSAhPSBudWxsKSB7XG4gICAgICAgICAgICAvLyBFeHRlbmQgdGhlIGJhc2Ugb2JqZWN0XG4gICAgICAgICAgICBmb3IgKG5hbWUgaW4gb3B0aW9ucykge1xuICAgICAgICAgICAgICAgIHNyYyA9IHRhcmdldFtuYW1lXTtcbiAgICAgICAgICAgICAgICBjb3B5ID0gb3B0aW9uc1tuYW1lXTtcblxuICAgICAgICAgICAgICAgIC8vIFByZXZlbnQgbmV2ZXItZW5kaW5nIGxvb3BcbiAgICAgICAgICAgICAgICBpZiAodGFyZ2V0ID09PSBjb3B5KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIFJlY3Vyc2UgaWYgd2UncmUgbWVyZ2luZyBwbGFpbiBvYmplY3RzIG9yIGFycmF5c1xuICAgICAgICAgICAgICAgIGlmIChkZWVwICYmIGNvcHkgJiYgKGlzUGxhaW5PYmplY3QoY29weSkgfHwgKGNvcHlJc0FycmF5ID0gQXJyYXkuaXNBcnJheShjb3B5KSkpKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjb3B5SXNBcnJheSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29weUlzQXJyYXkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsb25lID0gc3JjICYmIEFycmF5LmlzQXJyYXkoc3JjKSA/IHNyYyA6IFtdO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2xvbmUgPSBzcmMgJiYgaXNQbGFpbk9iamVjdChzcmMpID8gc3JjIDoge307XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBOZXZlciBtb3ZlIG9yaWdpbmFsIG9iamVjdHMsIGNsb25lIHRoZW1cbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0W25hbWVdID0gZXh0ZW5kKGRlZXAsIGNsb25lLCBjb3B5KTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBEb24ndCBicmluZyBpbiB1bmRlZmluZWQgdmFsdWVzXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjb3B5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0W25hbWVdID0gY29weTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBSZXR1cm4gdGhlIG1vZGlmaWVkIG9iamVjdFxuICAgIHJldHVybiB0YXJnZXQ7XG59O1xuXG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gSU5URVJOQUw7XG5cbmZ1bmN0aW9uIElOVEVSTkFMKCkge30iLCIndXNlIHN0cmljdCc7XG52YXIgUHJvbWlzZSA9IHJlcXVpcmUoJy4vcHJvbWlzZScpO1xudmFyIHJlamVjdCA9IHJlcXVpcmUoJy4vcmVqZWN0Jyk7XG52YXIgcmVzb2x2ZSA9IHJlcXVpcmUoJy4vcmVzb2x2ZScpO1xudmFyIElOVEVSTkFMID0gcmVxdWlyZSgnLi9JTlRFUk5BTCcpO1xudmFyIGhhbmRsZXJzID0gcmVxdWlyZSgnLi9oYW5kbGVycycpO1xubW9kdWxlLmV4cG9ydHMgPSBhbGw7XG5mdW5jdGlvbiBhbGwoaXRlcmFibGUpIHtcbiAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChpdGVyYWJsZSkgIT09ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICByZXR1cm4gcmVqZWN0KG5ldyBUeXBlRXJyb3IoJ211c3QgYmUgYW4gYXJyYXknKSk7XG4gIH1cblxuICB2YXIgbGVuID0gaXRlcmFibGUubGVuZ3RoO1xuICB2YXIgY2FsbGVkID0gZmFsc2U7XG4gIGlmICghbGVuKSB7XG4gICAgcmV0dXJuIHJlc29sdmUoW10pO1xuICB9XG5cbiAgdmFyIHZhbHVlcyA9IG5ldyBBcnJheShsZW4pO1xuICB2YXIgcmVzb2x2ZWQgPSAwO1xuICB2YXIgaSA9IC0xO1xuICB2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKElOVEVSTkFMKTtcbiAgXG4gIHdoaWxlICgrK2kgPCBsZW4pIHtcbiAgICBhbGxSZXNvbHZlcihpdGVyYWJsZVtpXSwgaSk7XG4gIH1cbiAgcmV0dXJuIHByb21pc2U7XG4gIGZ1bmN0aW9uIGFsbFJlc29sdmVyKHZhbHVlLCBpKSB7XG4gICAgcmVzb2x2ZSh2YWx1ZSkudGhlbihyZXNvbHZlRnJvbUFsbCwgZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICBpZiAoIWNhbGxlZCkge1xuICAgICAgICBjYWxsZWQgPSB0cnVlO1xuICAgICAgICBoYW5kbGVycy5yZWplY3QocHJvbWlzZSwgZXJyb3IpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGZ1bmN0aW9uIHJlc29sdmVGcm9tQWxsKG91dFZhbHVlKSB7XG4gICAgICB2YWx1ZXNbaV0gPSBvdXRWYWx1ZTtcbiAgICAgIGlmICgrK3Jlc29sdmVkID09PSBsZW4gJiAhY2FsbGVkKSB7XG4gICAgICAgIGNhbGxlZCA9IHRydWU7XG4gICAgICAgIGhhbmRsZXJzLnJlc29sdmUocHJvbWlzZSwgdmFsdWVzKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn0iLCIndXNlIHN0cmljdCc7XG52YXIgdHJ5Q2F0Y2ggPSByZXF1aXJlKCcuL3RyeUNhdGNoJyk7XG52YXIgcmVzb2x2ZVRoZW5hYmxlID0gcmVxdWlyZSgnLi9yZXNvbHZlVGhlbmFibGUnKTtcbnZhciBzdGF0ZXMgPSByZXF1aXJlKCcuL3N0YXRlcycpO1xuXG5leHBvcnRzLnJlc29sdmUgPSBmdW5jdGlvbiAoc2VsZiwgdmFsdWUpIHtcbiAgdmFyIHJlc3VsdCA9IHRyeUNhdGNoKGdldFRoZW4sIHZhbHVlKTtcbiAgaWYgKHJlc3VsdC5zdGF0dXMgPT09ICdlcnJvcicpIHtcbiAgICByZXR1cm4gZXhwb3J0cy5yZWplY3Qoc2VsZiwgcmVzdWx0LnZhbHVlKTtcbiAgfVxuICB2YXIgdGhlbmFibGUgPSByZXN1bHQudmFsdWU7XG5cbiAgaWYgKHRoZW5hYmxlKSB7XG4gICAgcmVzb2x2ZVRoZW5hYmxlLnNhZmVseShzZWxmLCB0aGVuYWJsZSk7XG4gIH0gZWxzZSB7XG4gICAgc2VsZi5zdGF0ZSA9IHN0YXRlcy5GVUxGSUxMRUQ7XG4gICAgc2VsZi5vdXRjb21lID0gdmFsdWU7XG4gICAgdmFyIGkgPSAtMTtcbiAgICB2YXIgbGVuID0gc2VsZi5xdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUgKCsraSA8IGxlbikge1xuICAgICAgc2VsZi5xdWV1ZVtpXS5jYWxsRnVsZmlsbGVkKHZhbHVlKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHNlbGY7XG59O1xuZXhwb3J0cy5yZWplY3QgPSBmdW5jdGlvbiAoc2VsZiwgZXJyb3IpIHtcbiAgc2VsZi5zdGF0ZSA9IHN0YXRlcy5SRUpFQ1RFRDtcbiAgc2VsZi5vdXRjb21lID0gZXJyb3I7XG4gIHZhciBpID0gLTE7XG4gIHZhciBsZW4gPSBzZWxmLnF1ZXVlLmxlbmd0aDtcbiAgd2hpbGUgKCsraSA8IGxlbikge1xuICAgIHNlbGYucXVldWVbaV0uY2FsbFJlamVjdGVkKGVycm9yKTtcbiAgfVxuICByZXR1cm4gc2VsZjtcbn07XG5cbmZ1bmN0aW9uIGdldFRoZW4ob2JqKSB7XG4gIC8vIE1ha2Ugc3VyZSB3ZSBvbmx5IGFjY2VzcyB0aGUgYWNjZXNzb3Igb25jZSBhcyByZXF1aXJlZCBieSB0aGUgc3BlY1xuICB2YXIgdGhlbiA9IG9iaiAmJiBvYmoudGhlbjtcbiAgaWYgKG9iaiAmJiB0eXBlb2Ygb2JqID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgdGhlbiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHJldHVybiBmdW5jdGlvbiBhcHB5VGhlbigpIHtcbiAgICAgIHRoZW4uYXBwbHkob2JqLCBhcmd1bWVudHMpO1xuICAgIH07XG4gIH1cbn0iLCJtb2R1bGUuZXhwb3J0cyA9IGV4cG9ydHMgPSByZXF1aXJlKCcuL3Byb21pc2UnKTtcblxuZXhwb3J0cy5yZXNvbHZlID0gcmVxdWlyZSgnLi9yZXNvbHZlJyk7XG5leHBvcnRzLnJlamVjdCA9IHJlcXVpcmUoJy4vcmVqZWN0Jyk7XG5leHBvcnRzLmFsbCA9IHJlcXVpcmUoJy4vYWxsJyk7XG5leHBvcnRzLnJhY2UgPSByZXF1aXJlKCcuL3JhY2UnKTsiLCIndXNlIHN0cmljdCc7XG5cbnZhciB1bndyYXAgPSByZXF1aXJlKCcuL3Vud3JhcCcpO1xudmFyIElOVEVSTkFMID0gcmVxdWlyZSgnLi9JTlRFUk5BTCcpO1xudmFyIHJlc29sdmVUaGVuYWJsZSA9IHJlcXVpcmUoJy4vcmVzb2x2ZVRoZW5hYmxlJyk7XG52YXIgc3RhdGVzID0gcmVxdWlyZSgnLi9zdGF0ZXMnKTtcbnZhciBRdWV1ZUl0ZW0gPSByZXF1aXJlKCcuL3F1ZXVlSXRlbScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFByb21pc2U7XG5mdW5jdGlvbiBQcm9taXNlKHJlc29sdmVyKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBQcm9taXNlKSkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlcik7XG4gIH1cbiAgaWYgKHR5cGVvZiByZXNvbHZlciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3Jlc29sdmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuICB9XG4gIHRoaXMuc3RhdGUgPSBzdGF0ZXMuUEVORElORztcbiAgdGhpcy5xdWV1ZSA9IFtdO1xuICB0aGlzLm91dGNvbWUgPSB2b2lkIDA7XG4gIGlmIChyZXNvbHZlciAhPT0gSU5URVJOQUwpIHtcbiAgICByZXNvbHZlVGhlbmFibGUuc2FmZWx5KHRoaXMsIHJlc29sdmVyKTtcbiAgfVxufVxuXG5Qcm9taXNlLnByb3RvdHlwZVsnY2F0Y2gnXSA9IGZ1bmN0aW9uIChvblJlamVjdGVkKSB7XG4gIHJldHVybiB0aGlzLnRoZW4obnVsbCwgb25SZWplY3RlZCk7XG59O1xuUHJvbWlzZS5wcm90b3R5cGUudGhlbiA9IGZ1bmN0aW9uIChvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCkge1xuICBpZiAodHlwZW9mIG9uRnVsZmlsbGVkICE9PSAnZnVuY3Rpb24nICYmIHRoaXMuc3RhdGUgPT09IHN0YXRlcy5GVUxGSUxMRUQgfHxcbiAgICB0eXBlb2Ygb25SZWplY3RlZCAhPT0gJ2Z1bmN0aW9uJyAmJiB0aGlzLnN0YXRlID09PSBzdGF0ZXMuUkVKRUNURUQpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICB2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKElOVEVSTkFMKTtcblxuICBcbiAgaWYgKHRoaXMuc3RhdGUgIT09IHN0YXRlcy5QRU5ESU5HKSB7XG4gICAgdmFyIHJlc29sdmVyID0gdGhpcy5zdGF0ZSA9PT0gc3RhdGVzLkZVTEZJTExFRCA/IG9uRnVsZmlsbGVkOiBvblJlamVjdGVkO1xuICAgIHVud3JhcChwcm9taXNlLCByZXNvbHZlciwgdGhpcy5vdXRjb21lKTtcbiAgfSBlbHNlIHtcbiAgICB0aGlzLnF1ZXVlLnB1c2gobmV3IFF1ZXVlSXRlbShwcm9taXNlLCBvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCkpO1xuICB9XG5cbiAgcmV0dXJuIHByb21pc2U7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xudmFyIGhhbmRsZXJzID0gcmVxdWlyZSgnLi9oYW5kbGVycycpO1xudmFyIHVud3JhcCA9IHJlcXVpcmUoJy4vdW53cmFwJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gUXVldWVJdGVtO1xuZnVuY3Rpb24gUXVldWVJdGVtKHByb21pc2UsIG9uRnVsZmlsbGVkLCBvblJlamVjdGVkKSB7XG4gIHRoaXMucHJvbWlzZSA9IHByb21pc2U7XG4gIGlmICh0eXBlb2Ygb25GdWxmaWxsZWQgPT09ICdmdW5jdGlvbicpIHtcbiAgICB0aGlzLm9uRnVsZmlsbGVkID0gb25GdWxmaWxsZWQ7XG4gICAgdGhpcy5jYWxsRnVsZmlsbGVkID0gdGhpcy5vdGhlckNhbGxGdWxmaWxsZWQ7XG4gIH1cbiAgaWYgKHR5cGVvZiBvblJlamVjdGVkID09PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhpcy5vblJlamVjdGVkID0gb25SZWplY3RlZDtcbiAgICB0aGlzLmNhbGxSZWplY3RlZCA9IHRoaXMub3RoZXJDYWxsUmVqZWN0ZWQ7XG4gIH1cbn1cblF1ZXVlSXRlbS5wcm90b3R5cGUuY2FsbEZ1bGZpbGxlZCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICBoYW5kbGVycy5yZXNvbHZlKHRoaXMucHJvbWlzZSwgdmFsdWUpO1xufTtcblF1ZXVlSXRlbS5wcm90b3R5cGUub3RoZXJDYWxsRnVsZmlsbGVkID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIHVud3JhcCh0aGlzLnByb21pc2UsIHRoaXMub25GdWxmaWxsZWQsIHZhbHVlKTtcbn07XG5RdWV1ZUl0ZW0ucHJvdG90eXBlLmNhbGxSZWplY3RlZCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICBoYW5kbGVycy5yZWplY3QodGhpcy5wcm9taXNlLCB2YWx1ZSk7XG59O1xuUXVldWVJdGVtLnByb3RvdHlwZS5vdGhlckNhbGxSZWplY3RlZCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICB1bndyYXAodGhpcy5wcm9taXNlLCB0aGlzLm9uUmVqZWN0ZWQsIHZhbHVlKTtcbn07IiwiJ3VzZSBzdHJpY3QnO1xudmFyIFByb21pc2UgPSByZXF1aXJlKCcuL3Byb21pc2UnKTtcbnZhciByZWplY3QgPSByZXF1aXJlKCcuL3JlamVjdCcpO1xudmFyIHJlc29sdmUgPSByZXF1aXJlKCcuL3Jlc29sdmUnKTtcbnZhciBJTlRFUk5BTCA9IHJlcXVpcmUoJy4vSU5URVJOQUwnKTtcbnZhciBoYW5kbGVycyA9IHJlcXVpcmUoJy4vaGFuZGxlcnMnKTtcbm1vZHVsZS5leHBvcnRzID0gcmFjZTtcbmZ1bmN0aW9uIHJhY2UoaXRlcmFibGUpIHtcbiAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChpdGVyYWJsZSkgIT09ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICByZXR1cm4gcmVqZWN0KG5ldyBUeXBlRXJyb3IoJ211c3QgYmUgYW4gYXJyYXknKSk7XG4gIH1cblxuICB2YXIgbGVuID0gaXRlcmFibGUubGVuZ3RoO1xuICB2YXIgY2FsbGVkID0gZmFsc2U7XG4gIGlmICghbGVuKSB7XG4gICAgcmV0dXJuIHJlc29sdmUoW10pO1xuICB9XG5cbiAgdmFyIHJlc29sdmVkID0gMDtcbiAgdmFyIGkgPSAtMTtcbiAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZShJTlRFUk5BTCk7XG4gIFxuICB3aGlsZSAoKytpIDwgbGVuKSB7XG4gICAgcmVzb2x2ZXIoaXRlcmFibGVbaV0pO1xuICB9XG4gIHJldHVybiBwcm9taXNlO1xuICBmdW5jdGlvbiByZXNvbHZlcih2YWx1ZSkge1xuICAgIHJlc29sdmUodmFsdWUpLnRoZW4oZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG4gICAgICBpZiAoIWNhbGxlZCkge1xuICAgICAgICBjYWxsZWQgPSB0cnVlO1xuICAgICAgICBoYW5kbGVycy5yZXNvbHZlKHByb21pc2UsIHJlc3BvbnNlKTtcbiAgICAgIH1cbiAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgIGlmICghY2FsbGVkKSB7XG4gICAgICAgIGNhbGxlZCA9IHRydWU7XG4gICAgICAgIGhhbmRsZXJzLnJlamVjdChwcm9taXNlLCBlcnJvcik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn0iLCIndXNlIHN0cmljdCc7XG5cbnZhciBQcm9taXNlID0gcmVxdWlyZSgnLi9wcm9taXNlJyk7XG52YXIgSU5URVJOQUwgPSByZXF1aXJlKCcuL0lOVEVSTkFMJyk7XG52YXIgaGFuZGxlcnMgPSByZXF1aXJlKCcuL2hhbmRsZXJzJyk7XG5tb2R1bGUuZXhwb3J0cyA9IHJlamVjdDtcblxuZnVuY3Rpb24gcmVqZWN0KHJlYXNvbikge1xuXHR2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKElOVEVSTkFMKTtcblx0cmV0dXJuIGhhbmRsZXJzLnJlamVjdChwcm9taXNlLCByZWFzb24pO1xufSIsIid1c2Ugc3RyaWN0JztcblxudmFyIFByb21pc2UgPSByZXF1aXJlKCcuL3Byb21pc2UnKTtcbnZhciBJTlRFUk5BTCA9IHJlcXVpcmUoJy4vSU5URVJOQUwnKTtcbnZhciBoYW5kbGVycyA9IHJlcXVpcmUoJy4vaGFuZGxlcnMnKTtcbm1vZHVsZS5leHBvcnRzID0gcmVzb2x2ZTtcblxudmFyIEZBTFNFID0gaGFuZGxlcnMucmVzb2x2ZShuZXcgUHJvbWlzZShJTlRFUk5BTCksIGZhbHNlKTtcbnZhciBOVUxMID0gaGFuZGxlcnMucmVzb2x2ZShuZXcgUHJvbWlzZShJTlRFUk5BTCksIG51bGwpO1xudmFyIFVOREVGSU5FRCA9IGhhbmRsZXJzLnJlc29sdmUobmV3IFByb21pc2UoSU5URVJOQUwpLCB2b2lkIDApO1xudmFyIFpFUk8gPSBoYW5kbGVycy5yZXNvbHZlKG5ldyBQcm9taXNlKElOVEVSTkFMKSwgMCk7XG52YXIgRU1QVFlTVFJJTkcgPSBoYW5kbGVycy5yZXNvbHZlKG5ldyBQcm9taXNlKElOVEVSTkFMKSwgJycpO1xuXG5mdW5jdGlvbiByZXNvbHZlKHZhbHVlKSB7XG4gIGlmICh2YWx1ZSkge1xuICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIFByb21pc2UpIHtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGhhbmRsZXJzLnJlc29sdmUobmV3IFByb21pc2UoSU5URVJOQUwpLCB2YWx1ZSk7XG4gIH1cbiAgdmFyIHZhbHVlVHlwZSA9IHR5cGVvZiB2YWx1ZTtcbiAgc3dpdGNoICh2YWx1ZVR5cGUpIHtcbiAgICBjYXNlICdib29sZWFuJzpcbiAgICAgIHJldHVybiBGQUxTRTtcbiAgICBjYXNlICd1bmRlZmluZWQnOlxuICAgICAgcmV0dXJuIFVOREVGSU5FRDtcbiAgICBjYXNlICdvYmplY3QnOlxuICAgICAgcmV0dXJuIE5VTEw7XG4gICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgIHJldHVybiBaRVJPO1xuICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICByZXR1cm4gRU1QVFlTVFJJTkc7XG4gIH1cbn0iLCIndXNlIHN0cmljdCc7XG52YXIgaGFuZGxlcnMgPSByZXF1aXJlKCcuL2hhbmRsZXJzJyk7XG52YXIgdHJ5Q2F0Y2ggPSByZXF1aXJlKCcuL3RyeUNhdGNoJyk7XG5mdW5jdGlvbiBzYWZlbHlSZXNvbHZlVGhlbmFibGUoc2VsZiwgdGhlbmFibGUpIHtcbiAgLy8gRWl0aGVyIGZ1bGZpbGwsIHJlamVjdCBvciByZWplY3Qgd2l0aCBlcnJvclxuICB2YXIgY2FsbGVkID0gZmFsc2U7XG4gIGZ1bmN0aW9uIG9uRXJyb3IodmFsdWUpIHtcbiAgICBpZiAoY2FsbGVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNhbGxlZCA9IHRydWU7XG4gICAgaGFuZGxlcnMucmVqZWN0KHNlbGYsIHZhbHVlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9uU3VjY2Vzcyh2YWx1ZSkge1xuICAgIGlmIChjYWxsZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY2FsbGVkID0gdHJ1ZTtcbiAgICBoYW5kbGVycy5yZXNvbHZlKHNlbGYsIHZhbHVlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRyeVRvVW53cmFwKCkge1xuICAgIHRoZW5hYmxlKG9uU3VjY2Vzcywgb25FcnJvcik7XG4gIH1cbiAgXG4gIHZhciByZXN1bHQgPSB0cnlDYXRjaCh0cnlUb1Vud3JhcCk7XG4gIGlmIChyZXN1bHQuc3RhdHVzID09PSAnZXJyb3InKSB7XG4gICAgb25FcnJvcihyZXN1bHQudmFsdWUpO1xuICB9XG59XG5leHBvcnRzLnNhZmVseSA9IHNhZmVseVJlc29sdmVUaGVuYWJsZTsiLCIvLyBMYXp5IG1hbidzIHN5bWJvbHMgZm9yIHN0YXRlc1xuXG5leHBvcnRzLlJFSkVDVEVEID0gWydSRUpFQ1RFRCddO1xuZXhwb3J0cy5GVUxGSUxMRUQgPSBbJ0ZVTEZJTExFRCddO1xuZXhwb3J0cy5QRU5ESU5HID0gWydQRU5ESU5HJ107IiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHRyeUNhdGNoO1xuXG5mdW5jdGlvbiB0cnlDYXRjaChmdW5jLCB2YWx1ZSkge1xuICB2YXIgb3V0ID0ge307XG4gIHRyeSB7XG4gICAgb3V0LnZhbHVlID0gZnVuYyh2YWx1ZSk7XG4gICAgb3V0LnN0YXR1cyA9ICdzdWNjZXNzJztcbiAgfSBjYXRjaCAoZSkge1xuICAgIG91dC5zdGF0dXMgPSAnZXJyb3InO1xuICAgIG91dC52YWx1ZSA9IGU7XG4gIH1cbiAgcmV0dXJuIG91dDtcbn0iLCIndXNlIHN0cmljdCc7XG5cbnZhciBpbW1lZGlhdGUgPSByZXF1aXJlKCdpbW1lZGlhdGUnKTtcbnZhciBoYW5kbGVycyA9IHJlcXVpcmUoJy4vaGFuZGxlcnMnKTtcbm1vZHVsZS5leHBvcnRzID0gdW53cmFwO1xuXG5mdW5jdGlvbiB1bndyYXAocHJvbWlzZSwgZnVuYywgdmFsdWUpIHtcbiAgaW1tZWRpYXRlKGZ1bmN0aW9uKCkge1xuICAgIHZhciByZXR1cm5WYWx1ZTtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuVmFsdWUgPSBmdW5jKHZhbHVlKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB2YXIgaGFuZGxlciA9IGhhbmRsZXJzLnJlamVjdChwcm9taXNlLCBlKTtcbiAgICAgIGlmICghaGFuZGxlci5xdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgLy8gRW5zdXJlIHRoYXQgZXJyb3JzIGFyZSBub3QgY29tcGxldGVseSBzd2FsbG93ZWQuXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1VuaGFuZGxlZCBlcnJvciBpbiBwcm9taXNlIGNoYWluJywge1xuICAgICAgICAgIGVycm9yOiBlLFxuICAgICAgICAgIGZ1bmM6IGZ1bmMsXG4gICAgICAgICAgdmFsdWU6IHZhbHVlLFxuICAgICAgICAgIGZ1bmNBc1N0cmluZzogZnVuYy50b1N0cmluZygpXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGhhbmRsZXI7XG4gICAgfVxuICAgIGlmIChyZXR1cm5WYWx1ZSA9PT0gcHJvbWlzZSkge1xuICAgICAgaGFuZGxlcnMucmVqZWN0KHByb21pc2UsIG5ldyBUeXBlRXJyb3IoJ0Nhbm5vdCByZXNvbHZlIHByb21pc2Ugd2l0aCBpdHNlbGYnKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGhhbmRsZXJzLnJlc29sdmUocHJvbWlzZSwgcmV0dXJuVmFsdWUpO1xuICAgIH1cbiAgfSk7XG59IiwiJ3VzZSBzdHJpY3QnO1xudmFyIHR5cGVzID0gW1xuICByZXF1aXJlKCcuL25leHRUaWNrJyksXG4gIHJlcXVpcmUoJy4vbXV0YXRpb24uanMnKSxcbiAgcmVxdWlyZSgnLi9tZXNzYWdlQ2hhbm5lbCcpLFxuICByZXF1aXJlKCcuL3N0YXRlQ2hhbmdlJyksXG4gIHJlcXVpcmUoJy4vdGltZW91dCcpXG5dO1xudmFyIGRyYWluaW5nO1xudmFyIHF1ZXVlID0gW107XG4vL25hbWVkIG5leHRUaWNrIGZvciBsZXNzIGNvbmZ1c2luZyBzdGFjayB0cmFjZXNcbmZ1bmN0aW9uIG5leHRUaWNrKCkge1xuICBkcmFpbmluZyA9IHRydWU7XG4gIHZhciBpLCBvbGRRdWV1ZTtcbiAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgd2hpbGUgKGxlbikge1xuICAgIG9sZFF1ZXVlID0gcXVldWU7XG4gICAgcXVldWUgPSBbXTtcbiAgICBpID0gLTE7XG4gICAgd2hpbGUgKCsraSA8IGxlbikge1xuICAgICAgb2xkUXVldWVbaV0oKTtcbiAgICB9XG4gICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICB9XG4gIGRyYWluaW5nID0gZmFsc2U7XG59XG52YXIgc2NoZWR1bGVEcmFpbjtcbnZhciBpID0gLTE7XG52YXIgbGVuID0gdHlwZXMubGVuZ3RoO1xud2hpbGUgKCsrIGkgPCBsZW4pIHtcbiAgaWYgKHR5cGVzW2ldICYmIHR5cGVzW2ldLnRlc3QgJiYgdHlwZXNbaV0udGVzdCgpKSB7XG4gICAgc2NoZWR1bGVEcmFpbiA9IHR5cGVzW2ldLmluc3RhbGwobmV4dFRpY2spO1xuICAgIGJyZWFrO1xuICB9XG59XG5tb2R1bGUuZXhwb3J0cyA9IGltbWVkaWF0ZTtcbmZ1bmN0aW9uIGltbWVkaWF0ZSh0YXNrKSB7XG4gIGlmIChxdWV1ZS5wdXNoKHRhc2spID09PSAxICYmICFkcmFpbmluZykge1xuICAgIHNjaGVkdWxlRHJhaW4oKTtcbiAgfVxufSIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy50ZXN0ID0gZnVuY3Rpb24gKCkge1xuICBpZiAoZ2xvYmFsLnNldEltbWVkaWF0ZSkge1xuICAgIC8vIHdlIGNhbiBvbmx5IGdldCBoZXJlIGluIElFMTBcbiAgICAvLyB3aGljaCBkb2Vzbid0IGhhbmRlbCBwb3N0TWVzc2FnZSB3ZWxsXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiB0eXBlb2YgZ2xvYmFsLk1lc3NhZ2VDaGFubmVsICE9PSAndW5kZWZpbmVkJztcbn07XG5cbmV4cG9ydHMuaW5zdGFsbCA9IGZ1bmN0aW9uIChmdW5jKSB7XG4gIHZhciBjaGFubmVsID0gbmV3IGdsb2JhbC5NZXNzYWdlQ2hhbm5lbCgpO1xuICBjaGFubmVsLnBvcnQxLm9ubWVzc2FnZSA9IGZ1bmM7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgY2hhbm5lbC5wb3J0Mi5wb3N0TWVzc2FnZSgwKTtcbiAgfTtcbn07XG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSkiLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG4ndXNlIHN0cmljdCc7XG4vL2Jhc2VkIG9mZiByc3ZwIGh0dHBzOi8vZ2l0aHViLmNvbS90aWxkZWlvL3JzdnAuanNcbi8vbGljZW5zZSBodHRwczovL2dpdGh1Yi5jb20vdGlsZGVpby9yc3ZwLmpzL2Jsb2IvbWFzdGVyL0xJQ0VOU0Vcbi8vaHR0cHM6Ly9naXRodWIuY29tL3RpbGRlaW8vcnN2cC5qcy9ibG9iL21hc3Rlci9saWIvcnN2cC9hc2FwLmpzXG5cbnZhciBNdXRhdGlvbiA9IGdsb2JhbC5NdXRhdGlvbk9ic2VydmVyIHx8IGdsb2JhbC5XZWJLaXRNdXRhdGlvbk9ic2VydmVyO1xuXG5leHBvcnRzLnRlc3QgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiBNdXRhdGlvbjtcbn07XG5cbmV4cG9ydHMuaW5zdGFsbCA9IGZ1bmN0aW9uIChoYW5kbGUpIHtcbiAgdmFyIGNhbGxlZCA9IDA7XG4gIHZhciBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbihoYW5kbGUpO1xuICB2YXIgZWxlbWVudCA9IGdsb2JhbC5kb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnJyk7XG4gIG9ic2VydmVyLm9ic2VydmUoZWxlbWVudCwge1xuICAgIGNoYXJhY3RlckRhdGE6IHRydWVcbiAgfSk7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgZWxlbWVudC5kYXRhID0gKGNhbGxlZCA9ICsrY2FsbGVkICUgMik7XG4gIH07XG59O1xufSkuY2FsbCh0aGlzLHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pIiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLnRlc3QgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiAnZG9jdW1lbnQnIGluIGdsb2JhbCAmJiAnb25yZWFkeXN0YXRlY2hhbmdlJyBpbiBnbG9iYWwuZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XG59O1xuXG5leHBvcnRzLmluc3RhbGwgPSBmdW5jdGlvbiAoaGFuZGxlKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG5cbiAgICAvLyBDcmVhdGUgYSA8c2NyaXB0PiBlbGVtZW50OyBpdHMgcmVhZHlzdGF0ZWNoYW5nZSBldmVudCB3aWxsIGJlIGZpcmVkIGFzeW5jaHJvbm91c2x5IG9uY2UgaXQgaXMgaW5zZXJ0ZWRcbiAgICAvLyBpbnRvIHRoZSBkb2N1bWVudC4gRG8gc28sIHRodXMgcXVldWluZyB1cCB0aGUgdGFzay4gUmVtZW1iZXIgdG8gY2xlYW4gdXAgb25jZSBpdCdzIGJlZW4gY2FsbGVkLlxuICAgIHZhciBzY3JpcHRFbCA9IGdsb2JhbC5kb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKTtcbiAgICBzY3JpcHRFbC5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgICBoYW5kbGUoKTtcblxuICAgICAgc2NyaXB0RWwub25yZWFkeXN0YXRlY2hhbmdlID0gbnVsbDtcbiAgICAgIHNjcmlwdEVsLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoc2NyaXB0RWwpO1xuICAgICAgc2NyaXB0RWwgPSBudWxsO1xuICAgIH07XG4gICAgZ2xvYmFsLmRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5hcHBlbmRDaGlsZChzY3JpcHRFbCk7XG5cbiAgICByZXR1cm4gaGFuZGxlO1xuICB9O1xufTtcbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KSIsIid1c2Ugc3RyaWN0JztcbmV4cG9ydHMudGVzdCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRydWU7XG59O1xuXG5leHBvcnRzLmluc3RhbGwgPSBmdW5jdGlvbiAodCkge1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHNldFRpbWVvdXQodCwgMCk7XG4gIH07XG59OyIsIihmdW5jdGlvbigpIHtcbiAgaWYgKHR5cGVvZiBzaWVzdGEgPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIG1vZHVsZSA9PSAndW5kZWZpbmVkJykge1xuICAgIHRocm93IG5ldyBFcnJvcignQ291bGQgbm90IGZpbmQgd2luZG93LnNpZXN0YS4gTWFrZSBzdXJlIHlvdSBpbmNsdWRlIHNpZXN0YS5jb3JlLmpzIGZpcnN0LicpO1xuICB9XG5cbiAgdmFyIF9pID0gc2llc3RhLl9pbnRlcm5hbCxcbiAgICBjYWNoZSA9IF9pLmNhY2hlLFxuICAgIENvbGxlY3Rpb25SZWdpc3RyeSA9IF9pLkNvbGxlY3Rpb25SZWdpc3RyeSxcbiAgICBsb2cgPSBfaS5sb2coJ3N0b3JhZ2UnKSxcbiAgICBlcnJvciA9IF9pLmVycm9yLFxuICAgIHV0aWwgPSBfaS51dGlsLFxuICAgIGV2ZW50cyA9IF9pLmV2ZW50cztcblxuICB2YXIgdW5zYXZlZE9iamVjdHMgPSBbXSxcbiAgICB1bnNhdmVkT2JqZWN0c0hhc2ggPSB7fSxcbiAgICB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbiA9IHt9O1xuXG4gIHZhciBzdG9yYWdlID0ge307XG5cbiAgLy8gVmFyaWFibGVzIGJlZ2lubmluZyB3aXRoIHVuZGVyc2NvcmUgYXJlIHRyZWF0ZWQgYXMgc3BlY2lhbCBieSBQb3VjaERCL0NvdWNoREIgc28gd2hlbiBzZXJpYWxpc2luZyB3ZSBuZWVkIHRvXG4gIC8vIHJlcGxhY2Ugd2l0aCBzb21ldGhpbmcgZWxzZS5cbiAgdmFyIFVOREVSU0NPUkUgPSAvXy9nLFxuICAgIFVOREVSU0NPUkVfUkVQTEFDRU1FTlQgPSAvQC9nO1xuXG4gIGZ1bmN0aW9uIF9pbml0TWV0YSgpIHtcbiAgICByZXR1cm4ge2RhdGVGaWVsZHM6IFtdfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGZ1bGx5UXVhbGlmaWVkTW9kZWxOYW1lKGNvbGxlY3Rpb25OYW1lLCBtb2RlbE5hbWUpIHtcbiAgICByZXR1cm4gY29sbGVjdGlvbk5hbWUgKyAnLicgKyBtb2RlbE5hbWU7XG4gIH1cblxuICBpZiAodHlwZW9mIFBvdWNoREIgPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBzaWVzdGEuZXh0LnN0b3JhZ2VFbmFibGVkID0gZmFsc2U7XG4gICAgY29uc29sZS5sb2coJ1BvdWNoREIgaXMgbm90IHByZXNlbnQgdGhlcmVmb3JlIHN0b3JhZ2UgaXMgZGlzYWJsZWQuJyk7XG4gIH1cbiAgZWxzZSB7XG4gICAgdmFyIERCX05BTUUgPSAnc2llc3RhJyxcbiAgICAgIHBvdWNoID0gbmV3IFBvdWNoREIoREJfTkFNRSwge2F1dG9fY29tcGFjdGlvbjogdHJ1ZX0pO1xuXG4gICAgLyoqXG4gICAgICogU29tZXRpbWVzIHNpZXN0YSBuZWVkcyB0byBzdG9yZSBzb21lIGV4dHJhIGluZm9ybWF0aW9uIGFib3V0IHRoZSBtb2RlbCBpbnN0YW5jZS5cbiAgICAgKiBAcGFyYW0gc2VyaWFsaXNlZFxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgZnVuY3Rpb24gX2FkZE1ldGEoc2VyaWFsaXNlZCkge1xuICAgICAgLy8gUG91Y2hEQiA8PSAzLjIuMSBoYXMgYSBidWcgd2hlcmVieSBkYXRlIGZpZWxkcyBhcmUgbm90IGRlc2VyaWFsaXNlZCBwcm9wZXJseSBpZiB5b3UgdXNlIGRiLnF1ZXJ5XG4gICAgICAvLyB0aGVyZWZvcmUgd2UgbmVlZCB0byBhZGQgZXh0cmEgaW5mbyB0byB0aGUgb2JqZWN0IGZvciBkZXNlcmlhbGlzaW5nIGRhdGVzIG1hbnVhbGx5LlxuICAgICAgc2VyaWFsaXNlZC5zaWVzdGFfbWV0YSA9IF9pbml0TWV0YSgpO1xuICAgICAgZm9yICh2YXIgcHJvcCBpbiBzZXJpYWxpc2VkKSB7XG4gICAgICAgIGlmIChzZXJpYWxpc2VkLmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgICAgaWYgKHNlcmlhbGlzZWRbcHJvcF0gaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgICAgICAgICBzZXJpYWxpc2VkLnNpZXN0YV9tZXRhLmRhdGVGaWVsZHMucHVzaChwcm9wKTtcbiAgICAgICAgICAgIHNlcmlhbGlzZWRbcHJvcF0gPSBzZXJpYWxpc2VkW3Byb3BdLmdldFRpbWUoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfcHJvY2Vzc01ldGEoZGF0dW0pIHtcbiAgICAgIHZhciBtZXRhID0gZGF0dW0uc2llc3RhX21ldGEgfHwgX2luaXRNZXRhKCk7XG4gICAgICBtZXRhLmRhdGVGaWVsZHMuZm9yRWFjaChmdW5jdGlvbihkYXRlRmllbGQpIHtcbiAgICAgICAgdmFyIHZhbHVlID0gZGF0dW1bZGF0ZUZpZWxkXTtcbiAgICAgICAgaWYgKCEodmFsdWUgaW5zdGFuY2VvZiBEYXRlKSkge1xuICAgICAgICAgIGRhdHVtW2RhdGVGaWVsZF0gPSBuZXcgRGF0ZSh2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgZGVsZXRlIGRhdHVtLnNpZXN0YV9tZXRhO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNvbnN0cnVjdEluZGV4RGVzaWduRG9jKGNvbGxlY3Rpb25OYW1lLCBtb2RlbE5hbWUpIHtcbiAgICAgIHZhciBmdWxseVF1YWxpZmllZE5hbWUgPSBmdWxseVF1YWxpZmllZE1vZGVsTmFtZShjb2xsZWN0aW9uTmFtZSwgbW9kZWxOYW1lKTtcbiAgICAgIHZhciB2aWV3cyA9IHt9O1xuICAgICAgdmlld3NbZnVsbHlRdWFsaWZpZWROYW1lXSA9IHtcbiAgICAgICAgbWFwOiBmdW5jdGlvbihkb2MpIHtcbiAgICAgICAgICBpZiAoZG9jLmNvbGxlY3Rpb24gPT0gJyQxJyAmJiBkb2MubW9kZWwgPT0gJyQyJykgZW1pdChkb2MuY29sbGVjdGlvbiArICcuJyArIGRvYy5tb2RlbCwgZG9jKTtcbiAgICAgICAgfS50b1N0cmluZygpLnJlcGxhY2UoJyQxJywgY29sbGVjdGlvbk5hbWUpLnJlcGxhY2UoJyQyJywgbW9kZWxOYW1lKVxuICAgICAgfTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIF9pZDogJ19kZXNpZ24vJyArIGZ1bGx5UXVhbGlmaWVkTmFtZSxcbiAgICAgICAgdmlld3M6IHZpZXdzXG4gICAgICB9O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGVuc3VyZUluZGV4SW5zdGFsbGVkKG1vZGVsLCBjYikge1xuICAgICAgaWYgKCFtb2RlbC5faW5kZXhJbnN0YWxsZWQpIHtcbiAgICAgICAgdmFyIGRlc2lnbkRvYyA9IGNvbnN0cnVjdEluZGV4RGVzaWduRG9jKG1vZGVsLmNvbGxlY3Rpb25OYW1lLCBtb2RlbC5uYW1lKTtcbiAgICAgICAgcG91Y2hcbiAgICAgICAgICAucHV0KGRlc2lnbkRvYylcbiAgICAgICAgICAudGhlbihmdW5jdGlvbihyZXNwKSB7XG4gICAgICAgICAgICB2YXIgZXJyO1xuICAgICAgICAgICAgaWYgKCFyZXNwLm9rKSB7XG4gICAgICAgICAgICAgIHZhciBpc0NvbmZsaWN0ID0gcmVzcG9uc2Uuc3RhdHVzID09IDQwOTtcbiAgICAgICAgICAgICAgaWYgKCFpc0NvbmZsaWN0KSBlcnIgPSByZXNwO1xuICAgICAgICAgICAgICBtb2RlbC5pbmRleEluc3RhbGxlZCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYihlcnIpO1xuICAgICAgICAgIH0pXG4gICAgICAgICAgLmNhdGNoKGNiKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBjYigpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNvbnN0cnVjdEluZGV4ZXNGb3JBbGxNb2RlbHMoKSB7XG4gICAgICB2YXIgaW5kZXhlcyA9IFtdO1xuICAgICAgdmFyIHJlZ2lzdHJ5ID0gc2llc3RhLl9pbnRlcm5hbC5Db2xsZWN0aW9uUmVnaXN0cnk7XG4gICAgICByZWdpc3RyeS5jb2xsZWN0aW9uTmFtZXMuZm9yRWFjaChmdW5jdGlvbihjb2xsZWN0aW9uTmFtZSkge1xuICAgICAgICB2YXIgbW9kZWxzID0gcmVnaXN0cnlbY29sbGVjdGlvbk5hbWVdLl9tb2RlbHM7XG4gICAgICAgIGZvciAodmFyIG1vZGVsTmFtZSBpbiBtb2RlbHMpIHtcbiAgICAgICAgICBpZiAobW9kZWxzLmhhc093blByb3BlcnR5KG1vZGVsTmFtZSkpIHtcbiAgICAgICAgICAgIGluZGV4ZXMucHVzaChjb25zdHJ1Y3RJbmRleERlc2lnbkRvYyhjb2xsZWN0aW9uTmFtZSwgbW9kZWxOYW1lKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBpbmRleGVzO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9fZW5zdXJlSW5kZXhlcyhpbmRleGVzLCBjYikge1xuICAgICAgcG91Y2hcbiAgICAgICAgLmJ1bGtEb2NzKGluZGV4ZXMpXG4gICAgICAgIC50aGVuKGZ1bmN0aW9uKHJlc3ApIHtcbiAgICAgICAgICB2YXIgZXJyb3JzID0gW107XG4gICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXNwLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgcmVzcG9uc2UgPSByZXNwW2ldO1xuICAgICAgICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICAgICAgICAvLyBDb25mbGljdCBtZWFucyBhbHJlYWR5IGV4aXN0cywgYW5kIHRoaXMgaXMgZmluZSFcbiAgICAgICAgICAgICAgdmFyIGlzQ29uZmxpY3QgPSByZXNwb25zZS5zdGF0dXMgPT0gNDA5O1xuICAgICAgICAgICAgICBpZiAoIWlzQ29uZmxpY3QpIGVycm9ycy5wdXNoKHJlc3BvbnNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgY2IoZXJyb3JzLmxlbmd0aCA/IGVycm9yKCdtdWx0aXBsZSBlcnJvcnMnLCB7ZXJyb3JzOiBlcnJvcnN9KSA6IG51bGwpO1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goY2IpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGVuc3VyZUluZGV4ZXNGb3JBbGwoY2IpIHtcbiAgICAgIHZhciBpbmRleGVzID0gY29uc3RydWN0SW5kZXhlc0ZvckFsbE1vZGVscygpO1xuICAgICAgX19lbnN1cmVJbmRleGVzKGluZGV4ZXMsIGNiKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXJpYWxpc2UgYSBtb2RlbCBpbnRvIGEgZm9ybWF0IHRoYXQgUG91Y2hEQiBidWxrRG9jcyBBUEkgY2FuIHByb2Nlc3NcbiAgICAgKiBAcGFyYW0ge01vZGVsSW5zdGFuY2V9IG1vZGVsSW5zdGFuY2VcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfc2VyaWFsaXNlKG1vZGVsSW5zdGFuY2UpIHtcbiAgICAgIHZhciBzZXJpYWxpc2VkID0ge307XG4gICAgICB2YXIgX192YWx1ZXMgPSBtb2RlbEluc3RhbmNlLl9fdmFsdWVzO1xuICAgICAgc2VyaWFsaXNlZCA9IHV0aWwuZXh0ZW5kKHNlcmlhbGlzZWQsIF9fdmFsdWVzKTtcbiAgICAgIE9iamVjdC5rZXlzKHNlcmlhbGlzZWQpLmZvckVhY2goZnVuY3Rpb24oaykge1xuICAgICAgICBzZXJpYWxpc2VkW2sucmVwbGFjZShVTkRFUlNDT1JFLCAnQCcpXSA9IF9fdmFsdWVzW2tdO1xuICAgICAgfSk7XG4gICAgICBfYWRkTWV0YShzZXJpYWxpc2VkKTtcbiAgICAgIHNlcmlhbGlzZWRbJ2NvbGxlY3Rpb24nXSA9IG1vZGVsSW5zdGFuY2UuY29sbGVjdGlvbk5hbWU7XG4gICAgICBzZXJpYWxpc2VkWydtb2RlbCddID0gbW9kZWxJbnN0YW5jZS5tb2RlbE5hbWU7XG4gICAgICBzZXJpYWxpc2VkWydfaWQnXSA9IG1vZGVsSW5zdGFuY2UubG9jYWxJZDtcbiAgICAgIGlmIChtb2RlbEluc3RhbmNlLnJlbW92ZWQpIHNlcmlhbGlzZWRbJ19kZWxldGVkJ10gPSB0cnVlO1xuICAgICAgdmFyIHJldiA9IG1vZGVsSW5zdGFuY2UuX3JldjtcbiAgICAgIGlmIChyZXYpIHNlcmlhbGlzZWRbJ19yZXYnXSA9IHJldjtcbiAgICAgIHNlcmlhbGlzZWQgPSBtb2RlbEluc3RhbmNlLl9yZWxhdGlvbnNoaXBOYW1lcy5yZWR1Y2UoZnVuY3Rpb24obWVtbywgbikge1xuICAgICAgICB2YXIgdmFsID0gbW9kZWxJbnN0YW5jZVtuXTtcbiAgICAgICAgaWYgKHNpZXN0YS5pc0FycmF5KHZhbCkpIHtcbiAgICAgICAgICBtZW1vW25dID0gdXRpbC5wbHVjayh2YWwsICdsb2NhbElkJyk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodmFsKSB7XG4gICAgICAgICAgbWVtb1tuXSA9IHZhbC5sb2NhbElkO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgfSwgc2VyaWFsaXNlZCk7XG4gICAgICByZXR1cm4gc2VyaWFsaXNlZDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfcHJlcGFyZURhdHVtKHJhd0RhdHVtLCBtb2RlbCkge1xuICAgICAgX3Byb2Nlc3NNZXRhKHJhd0RhdHVtKTtcbiAgICAgIGRlbGV0ZSByYXdEYXR1bS5jb2xsZWN0aW9uO1xuICAgICAgZGVsZXRlIHJhd0RhdHVtLm1vZGVsO1xuICAgICAgcmF3RGF0dW0ubG9jYWxJZCA9IHJhd0RhdHVtLl9pZDtcbiAgICAgIGRlbGV0ZSByYXdEYXR1bS5faWQ7XG4gICAgICB2YXIgZGF0dW0gPSB7fTtcbiAgICAgIE9iamVjdC5rZXlzKHJhd0RhdHVtKS5mb3JFYWNoKGZ1bmN0aW9uKGspIHtcbiAgICAgICAgZGF0dW1bay5yZXBsYWNlKFVOREVSU0NPUkVfUkVQTEFDRU1FTlQsICdfJyldID0gcmF3RGF0dW1ba107XG4gICAgICB9KTtcblxuICAgICAgdmFyIHJlbGF0aW9uc2hpcE5hbWVzID0gbW9kZWwuX3JlbGF0aW9uc2hpcE5hbWVzO1xuICAgICAgcmVsYXRpb25zaGlwTmFtZXMuZm9yRWFjaChmdW5jdGlvbihyKSB7XG4gICAgICAgIHZhciBsb2NhbElkID0gZGF0dW1bcl07XG4gICAgICAgIGlmIChsb2NhbElkKSB7XG4gICAgICAgICAgaWYgKHNpZXN0YS5pc0FycmF5KGxvY2FsSWQpKSB7XG4gICAgICAgICAgICBkYXR1bVtyXSA9IGxvY2FsSWQubWFwKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHtsb2NhbElkOiB4fVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgZGF0dW1bcl0gPSB7bG9jYWxJZDogbG9jYWxJZH07XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIGRhdHVtO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIG9wdHNcbiAgICAgKiBAcGFyYW0gW29wdHMuY29sbGVjdGlvbk5hbWVdXG4gICAgICogQHBhcmFtIFtvcHRzLm1vZGVsTmFtZV1cbiAgICAgKiBAcGFyYW0gW29wdHMubW9kZWxdXG4gICAgICogQHBhcmFtIGNhbGxiYWNrXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfbG9hZE1vZGVsKG9wdHMsIGNhbGxiYWNrKSB7XG4gICAgICB2YXIgbG9hZGVkID0ge307XG4gICAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBvcHRzLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICBtb2RlbE5hbWUgPSBvcHRzLm1vZGVsTmFtZSxcbiAgICAgICAgbW9kZWwgPSBvcHRzLm1vZGVsO1xuICAgICAgaWYgKG1vZGVsKSB7XG4gICAgICAgIGNvbGxlY3Rpb25OYW1lID0gbW9kZWwuY29sbGVjdGlvbk5hbWU7XG4gICAgICAgIG1vZGVsTmFtZSA9IG1vZGVsLm5hbWU7XG4gICAgICB9XG4gICAgICB2YXIgZnVsbHlRdWFsaWZpZWROYW1lID0gZnVsbHlRdWFsaWZpZWRNb2RlbE5hbWUoY29sbGVjdGlvbk5hbWUsIG1vZGVsTmFtZSk7XG4gICAgICBsb2coJ0xvYWRpbmcgaW5zdGFuY2VzIGZvciAnICsgZnVsbHlRdWFsaWZpZWROYW1lKTtcbiAgICAgIHZhciBNb2RlbCA9IENvbGxlY3Rpb25SZWdpc3RyeVtjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXTtcbiAgICAgIGxvZygnUXVlcnlpbmcgcG91Y2gnKTtcbiAgICAgIHBvdWNoLnF1ZXJ5KGZ1bGx5UXVhbGlmaWVkTmFtZSlcbiAgICAgICAgLy9wb3VjaC5xdWVyeSh7bWFwOiBtYXBGdW5jfSlcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24ocmVzcCkge1xuICAgICAgICAgIGxvZygnUXVlcmllZCBwb3VjaCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgICB2YXIgcm93cyA9IHJlc3Aucm93cztcbiAgICAgICAgICB2YXIgZGF0YSA9IHV0aWwucGx1Y2socm93cywgJ3ZhbHVlJykubWFwKGZ1bmN0aW9uKGRhdHVtKSB7XG4gICAgICAgICAgICByZXR1cm4gX3ByZXBhcmVEYXR1bShkYXR1bSwgTW9kZWwpO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgZGF0YS5tYXAoZnVuY3Rpb24oZGF0dW0pIHtcbiAgICAgICAgICAgIHZhciByZW1vdGVJZCA9IGRhdHVtW01vZGVsLmlkXTtcbiAgICAgICAgICAgIGlmIChyZW1vdGVJZCkge1xuICAgICAgICAgICAgICBpZiAobG9hZGVkW3JlbW90ZUlkXSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0R1cGxpY2F0ZXMgZGV0ZWN0ZWQgaW4gc3RvcmFnZS4gWW91IGhhdmUgZW5jb3VudGVyZWQgYSBzZXJpb3VzIGJ1Zy4gUGxlYXNlIHJlcG9ydCB0aGlzLicpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGxvYWRlZFtyZW1vdGVJZF0gPSBkYXR1bTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgbG9nKCdNYXBwaW5nIGRhdGEnLCBkYXRhKTtcblxuICAgICAgICAgIE1vZGVsLmdyYXBoKGRhdGEsIHtcbiAgICAgICAgICAgIF9pZ25vcmVJbnN0YWxsZWQ6IHRydWUsXG4gICAgICAgICAgICBmcm9tU3RvcmFnZTogdHJ1ZVxuICAgICAgICAgIH0sIGZ1bmN0aW9uKGVyciwgaW5zdGFuY2VzKSB7XG4gICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICBpZiAobG9nLmVuYWJsZWQpXG4gICAgICAgICAgICAgICAgbG9nKCdMb2FkZWQgJyArIGluc3RhbmNlcyA/IGluc3RhbmNlcy5sZW5ndGgudG9TdHJpbmcoKSA6IDAgKyAnIGluc3RhbmNlcyBmb3IgJyArIGZ1bGx5UXVhbGlmaWVkTmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgbG9nKCdFcnJvciBsb2FkaW5nIG1vZGVscycsIGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYWxsYmFjayhlcnIsIGluc3RhbmNlcyk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICB9KTtcblxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExvYWQgYWxsIGRhdGEgZnJvbSBQb3VjaERCLlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9sb2FkKGNiKSB7XG4gICAgICBpZiAoc2F2aW5nKSB0aHJvdyBuZXcgRXJyb3IoJ25vdCBsb2FkZWQgeWV0IGhvdyBjYW4gaSBzYXZlJyk7XG4gICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgICBpZiAoc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCkge1xuICAgICAgICAgIHZhciBjb2xsZWN0aW9uTmFtZXMgPSBDb2xsZWN0aW9uUmVnaXN0cnkuY29sbGVjdGlvbk5hbWVzO1xuICAgICAgICAgIHZhciB0YXNrcyA9IFtdO1xuICAgICAgICAgIGNvbGxlY3Rpb25OYW1lcy5mb3JFYWNoKGZ1bmN0aW9uKGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgICAgICAgICB2YXIgY29sbGVjdGlvbiA9IENvbGxlY3Rpb25SZWdpc3RyeVtjb2xsZWN0aW9uTmFtZV0sXG4gICAgICAgICAgICAgIG1vZGVsTmFtZXMgPSBPYmplY3Qua2V5cyhjb2xsZWN0aW9uLl9tb2RlbHMpO1xuICAgICAgICAgICAgbW9kZWxOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uKG1vZGVsTmFtZSkge1xuICAgICAgICAgICAgICB0YXNrcy5wdXNoKGZ1bmN0aW9uKGNiKSB7XG4gICAgICAgICAgICAgICAgLy8gV2UgY2FsbCBmcm9tIHN0b3JhZ2UgdG8gYWxsb3cgZm9yIHJlcGxhY2VtZW50IG9mIF9sb2FkTW9kZWwgZm9yIHBlcmZvcm1hbmNlIGV4dGVuc2lvbi5cbiAgICAgICAgICAgICAgICBzdG9yYWdlLl9sb2FkTW9kZWwoe1xuICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbk5hbWU6IGNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgICAgICAgbW9kZWxOYW1lOiBtb2RlbE5hbWVcbiAgICAgICAgICAgICAgICB9LCBjYik7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgc2llc3RhLmFzeW5jLnNlcmllcyh0YXNrcywgZnVuY3Rpb24oZXJyLCByZXN1bHRzKSB7XG4gICAgICAgICAgICB2YXIgbjtcbiAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgIHZhciBpbnN0YW5jZXMgPSBbXTtcbiAgICAgICAgICAgICAgcmVzdWx0cy5mb3JFYWNoKGZ1bmN0aW9uKHIpIHtcbiAgICAgICAgICAgICAgICBpbnN0YW5jZXMgPSBpbnN0YW5jZXMuY29uY2F0KHIpXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICBuID0gaW5zdGFuY2VzLmxlbmd0aDtcbiAgICAgICAgICAgICAgaWYgKGxvZykge1xuICAgICAgICAgICAgICAgIGxvZygnTG9hZGVkICcgKyBuLnRvU3RyaW5nKCkgKyAnIGluc3RhbmNlcy4gQ2FjaGUgc2l6ZSBpcyAnICsgY2FjaGUuY291bnQoKSwge1xuICAgICAgICAgICAgICAgICAgcmVtb3RlOiBjYWNoZS5fcmVtb3RlQ2FjaGUoKSxcbiAgICAgICAgICAgICAgICAgIGxvY2FsQ2FjaGU6IGNhY2hlLl9sb2NhbENhY2hlKClcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBzaWVzdGEub24oJ1NpZXN0YScsIGxpc3RlbmVyKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY2IoZXJyLCBuKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBjYigpO1xuICAgICAgICB9XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNhdmVDb25mbGljdHMob2JqZWN0cywgY2IpIHtcbiAgICAgIHBvdWNoLmFsbERvY3Moe2tleXM6IHV0aWwucGx1Y2sob2JqZWN0cywgJ2xvY2FsSWQnKX0pXG4gICAgICAgIC50aGVuKGZ1bmN0aW9uKHJlc3ApIHtcbiAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlc3Aucm93cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgb2JqZWN0c1tpXS5fcmV2ID0gcmVzcC5yb3dzW2ldLnZhbHVlLnJldjtcbiAgICAgICAgICB9XG4gICAgICAgICAgc2F2ZVRvUG91Y2gob2JqZWN0cywgY2IpO1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgY2IoZXJyKTtcbiAgICAgICAgfSlcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzYXZlVG9Qb3VjaChvYmplY3RzLCBjYikge1xuICAgICAgdmFyIGNvbmZsaWN0cyA9IFtdO1xuICAgICAgdmFyIHNlcmlhbGlzZWREb2NzID0gb2JqZWN0cy5tYXAoX3NlcmlhbGlzZSk7XG4gICAgICBwb3VjaC5idWxrRG9jcyhzZXJpYWxpc2VkRG9jcykudGhlbihmdW5jdGlvbihyZXNwKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVzcC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIHZhciByZXNwb25zZSA9IHJlc3BbaV07XG4gICAgICAgICAgdmFyIG9iaiA9IG9iamVjdHNbaV07XG4gICAgICAgICAgaWYgKHJlc3BvbnNlLm9rKSB7XG4gICAgICAgICAgICBvYmouX3JldiA9IHJlc3BvbnNlLnJldjtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSBpZiAocmVzcG9uc2Uuc3RhdHVzID09IDQwOSkge1xuICAgICAgICAgICAgY29uZmxpY3RzLnB1c2gob2JqKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBsb2coJ0Vycm9yIHNhdmluZyBvYmplY3Qgd2l0aCBsb2NhbElkPVwiJyArIG9iai5sb2NhbElkICsgJ1wiJywgcmVzcG9uc2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoY29uZmxpY3RzLmxlbmd0aCkge1xuICAgICAgICAgIHNhdmVDb25mbGljdHMoY29uZmxpY3RzLCBjYik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgY2IoKTtcbiAgICAgICAgfVxuICAgICAgfSwgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgIGNiKGVycik7XG4gICAgICB9KTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIFNhdmUgYWxsIG1vZGVsRXZlbnRzIGRvd24gdG8gUG91Y2hEQi5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBzYXZlKGNiKSB7XG4gICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgICBzaWVzdGEuX2FmdGVySW5zdGFsbChmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgaW5zdGFuY2VzID0gdW5zYXZlZE9iamVjdHM7XG4gICAgICAgICAgdW5zYXZlZE9iamVjdHMgPSBbXTtcbiAgICAgICAgICB1bnNhdmVkT2JqZWN0c0hhc2ggPSB7fTtcbiAgICAgICAgICB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbiA9IHt9O1xuICAgICAgICAgIHNhdmVUb1BvdWNoKGluc3RhbmNlcywgY2IpO1xuICAgICAgICB9KTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGlzdGVuZXIobikge1xuICAgICAgdmFyIGNoYW5nZWRPYmplY3QgPSBuLm9iaixcbiAgICAgICAgaWRlbnQgPSBjaGFuZ2VkT2JqZWN0LmxvY2FsSWQ7XG4gICAgICBpZiAoIWNoYW5nZWRPYmplY3QpIHtcbiAgICAgICAgdGhyb3cgbmV3IF9pLmVycm9yLkludGVybmFsU2llc3RhRXJyb3IoJ05vIG9iaiBmaWVsZCBpbiBub3RpZmljYXRpb24gcmVjZWl2ZWQgYnkgc3RvcmFnZSBleHRlbnNpb24nKTtcbiAgICAgIH1cbiAgICAgIGlmICghKGlkZW50IGluIHVuc2F2ZWRPYmplY3RzSGFzaCkpIHtcbiAgICAgICAgdW5zYXZlZE9iamVjdHNIYXNoW2lkZW50XSA9IGNoYW5nZWRPYmplY3Q7XG4gICAgICAgIHVuc2F2ZWRPYmplY3RzLnB1c2goY2hhbmdlZE9iamVjdCk7XG4gICAgICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IGNoYW5nZWRPYmplY3QuY29sbGVjdGlvbk5hbWU7XG4gICAgICAgIGlmICghdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbk5hbWVdKSB7XG4gICAgICAgICAgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbk5hbWVdID0ge307XG4gICAgICAgIH1cbiAgICAgICAgdmFyIG1vZGVsTmFtZSA9IGNoYW5nZWRPYmplY3QubW9kZWwubmFtZTtcbiAgICAgICAgaWYgKCF1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXSkge1xuICAgICAgICAgIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uW2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdID0ge307XG4gICAgICAgIH1cbiAgICAgICAgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV1baWRlbnRdID0gY2hhbmdlZE9iamVjdDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB1dGlsLmV4dGVuZChzdG9yYWdlLCB7XG4gICAgICBfbG9hZDogX2xvYWQsXG4gICAgICBfbG9hZE1vZGVsOiBfbG9hZE1vZGVsLFxuICAgICAgc2F2ZTogc2F2ZSxcbiAgICAgIF9zZXJpYWxpc2U6IF9zZXJpYWxpc2UsXG4gICAgICBlbnN1cmVJbmRleGVzRm9yQWxsOiBlbnN1cmVJbmRleGVzRm9yQWxsLFxuICAgICAgZW5zdXJlSW5kZXhJbnN0YWxsZWQ6IGVuc3VyZUluZGV4SW5zdGFsbGVkLFxuICAgICAgX3Jlc2V0OiBmdW5jdGlvbihjYikge1xuICAgICAgICBzaWVzdGEucmVtb3ZlTGlzdGVuZXIoJ1NpZXN0YScsIGxpc3RlbmVyKTtcbiAgICAgICAgdW5zYXZlZE9iamVjdHMgPSBbXTtcbiAgICAgICAgdW5zYXZlZE9iamVjdHNIYXNoID0ge307XG4gICAgICAgIHBvdWNoLmRlc3Ryb3koZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgIHBvdWNoID0gbmV3IFBvdWNoREIoREJfTkFNRSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGxvZygnUmVzZXQgY29tcGxldGUnKTtcbiAgICAgICAgICBjYihlcnIpO1xuICAgICAgICB9KVxuICAgICAgfVxuXG4gICAgfSk7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyhzdG9yYWdlLCB7XG4gICAgICBfdW5zYXZlZE9iamVjdHM6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gdW5zYXZlZE9iamVjdHNcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIF91bnNhdmVkT2JqZWN0c0hhc2g6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gdW5zYXZlZE9iamVjdHNIYXNoXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBfdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb246IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25cbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIF9wb3VjaDoge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiBwb3VjaFxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAoIXNpZXN0YS5leHQpIHNpZXN0YS5leHQgPSB7fTtcbiAgICBzaWVzdGEuZXh0LnN0b3JhZ2UgPSBzdG9yYWdlO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoc2llc3RhLmV4dCwge1xuICAgICAgc3RvcmFnZUVuYWJsZWQ6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICBpZiAoc2llc3RhLmV4dC5fc3RvcmFnZUVuYWJsZWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmV0dXJuIHNpZXN0YS5leHQuX3N0b3JhZ2VFbmFibGVkO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gISFzaWVzdGEuZXh0LnN0b3JhZ2U7XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24odikge1xuICAgICAgICAgIHNpZXN0YS5leHQuX3N0b3JhZ2VFbmFibGVkID0gdjtcbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdmFyIGludGVydmFsLCBzYXZpbmcsIGF1dG9zYXZlSW50ZXJ2YWwgPSAxMDAwO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoc2llc3RhLCB7XG4gICAgICBhdXRvc2F2ZToge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiAhIWludGVydmFsO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uKGF1dG9zYXZlKSB7XG4gICAgICAgICAgaWYgKGF1dG9zYXZlKSB7XG4gICAgICAgICAgICBpZiAoIWludGVydmFsKSB7XG4gICAgICAgICAgICAgIGludGVydmFsID0gc2V0SW50ZXJ2YWwoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgLy8gQ2hlZWt5IHdheSBvZiBhdm9pZGluZyBtdWx0aXBsZSBzYXZlcyBoYXBwZW5pbmcuLi5cbiAgICAgICAgICAgICAgICBpZiAoIXNhdmluZykge1xuICAgICAgICAgICAgICAgICAgc2F2aW5nID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgIHNpZXN0YS5zYXZlKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICAgIGV2ZW50cy5lbWl0KCdzYXZlZCcpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHNhdmluZyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9LCBzaWVzdGEuYXV0b3NhdmVJbnRlcnZhbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaWYgKGludGVydmFsKSB7XG4gICAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwoaW50ZXJ2YWwpO1xuICAgICAgICAgICAgICBpbnRlcnZhbCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgYXV0b3NhdmVJbnRlcnZhbDoge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiBhdXRvc2F2ZUludGVydmFsO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uKF9hdXRvc2F2ZUludGVydmFsKSB7XG4gICAgICAgICAgYXV0b3NhdmVJbnRlcnZhbCA9IF9hdXRvc2F2ZUludGVydmFsO1xuICAgICAgICAgIGlmIChpbnRlcnZhbCkge1xuICAgICAgICAgICAgLy8gUmVzZXQgaW50ZXJ2YWxcbiAgICAgICAgICAgIHNpZXN0YS5hdXRvc2F2ZSA9IGZhbHNlO1xuICAgICAgICAgICAgc2llc3RhLmF1dG9zYXZlID0gdHJ1ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBkaXJ0eToge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbiA9IHNpZXN0YS5leHQuc3RvcmFnZS5fdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb247XG4gICAgICAgICAgcmV0dXJuICEhT2JqZWN0LmtleXModW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb24pLmxlbmd0aDtcbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdXRpbC5leHRlbmQoc2llc3RhLCB7XG4gICAgICBzYXZlOiBzYXZlLFxuICAgICAgc2V0UG91Y2g6IGZ1bmN0aW9uKF9wKSB7XG4gICAgICAgIGlmIChzaWVzdGEuX2NhbkNoYW5nZSkgcG91Y2ggPSBfcDtcbiAgICAgICAgZWxzZSB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBjaGFuZ2UgUG91Y2hEQiBpbnN0YW5jZSB3aGVuIGFuIG9iamVjdCBncmFwaCBleGlzdHMuJyk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgfVxuXG4gIG1vZHVsZS5leHBvcnRzID0gc3RvcmFnZTtcblxufSkoKTsiLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG4vKlxuICogQ29weXJpZ2h0IChjKSAyMDE0IFRoZSBQb2x5bWVyIFByb2plY3QgQXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqIFRoaXMgY29kZSBtYXkgb25seSBiZSB1c2VkIHVuZGVyIHRoZSBCU0Qgc3R5bGUgbGljZW5zZSBmb3VuZCBhdCBodHRwOi8vcG9seW1lci5naXRodWIuaW8vTElDRU5TRS50eHRcbiAqIFRoZSBjb21wbGV0ZSBzZXQgb2YgYXV0aG9ycyBtYXkgYmUgZm91bmQgYXQgaHR0cDovL3BvbHltZXIuZ2l0aHViLmlvL0FVVEhPUlMudHh0XG4gKiBUaGUgY29tcGxldGUgc2V0IG9mIGNvbnRyaWJ1dG9ycyBtYXkgYmUgZm91bmQgYXQgaHR0cDovL3BvbHltZXIuZ2l0aHViLmlvL0NPTlRSSUJVVE9SUy50eHRcbiAqIENvZGUgZGlzdHJpYnV0ZWQgYnkgR29vZ2xlIGFzIHBhcnQgb2YgdGhlIHBvbHltZXIgcHJvamVjdCBpcyBhbHNvXG4gKiBzdWJqZWN0IHRvIGFuIGFkZGl0aW9uYWwgSVAgcmlnaHRzIGdyYW50IGZvdW5kIGF0IGh0dHA6Ly9wb2x5bWVyLmdpdGh1Yi5pby9QQVRFTlRTLnR4dFxuICovXG5cbihmdW5jdGlvbihnbG9iYWwpIHtcbiAgJ3VzZSBzdHJpY3QnO1xuXG4gIHZhciB0ZXN0aW5nRXhwb3NlQ3ljbGVDb3VudCA9IGdsb2JhbC50ZXN0aW5nRXhwb3NlQ3ljbGVDb3VudDtcblxuICAvLyBEZXRlY3QgYW5kIGRvIGJhc2ljIHNhbml0eSBjaGVja2luZyBvbiBPYmplY3QvQXJyYXkub2JzZXJ2ZS5cbiAgZnVuY3Rpb24gZGV0ZWN0T2JqZWN0T2JzZXJ2ZSgpIHtcbiAgICBpZiAodHlwZW9mIE9iamVjdC5vYnNlcnZlICE9PSAnZnVuY3Rpb24nIHx8XG4gICAgICAgIHR5cGVvZiBBcnJheS5vYnNlcnZlICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdmFyIHJlY29yZHMgPSBbXTtcblxuICAgIGZ1bmN0aW9uIGNhbGxiYWNrKHJlY3MpIHtcbiAgICAgIHJlY29yZHMgPSByZWNzO1xuICAgIH1cblxuICAgIHZhciB0ZXN0ID0ge307XG4gICAgdmFyIGFyciA9IFtdO1xuICAgIE9iamVjdC5vYnNlcnZlKHRlc3QsIGNhbGxiYWNrKTtcbiAgICBBcnJheS5vYnNlcnZlKGFyciwgY2FsbGJhY2spO1xuICAgIHRlc3QuaWQgPSAxO1xuICAgIHRlc3QuaWQgPSAyO1xuICAgIGRlbGV0ZSB0ZXN0LmlkO1xuICAgIGFyci5wdXNoKDEsIDIpO1xuICAgIGFyci5sZW5ndGggPSAwO1xuXG4gICAgT2JqZWN0LmRlbGl2ZXJDaGFuZ2VSZWNvcmRzKGNhbGxiYWNrKTtcbiAgICBpZiAocmVjb3Jkcy5sZW5ndGggIT09IDUpXG4gICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICBpZiAocmVjb3Jkc1swXS50eXBlICE9ICdhZGQnIHx8XG4gICAgICAgIHJlY29yZHNbMV0udHlwZSAhPSAndXBkYXRlJyB8fFxuICAgICAgICByZWNvcmRzWzJdLnR5cGUgIT0gJ2RlbGV0ZScgfHxcbiAgICAgICAgcmVjb3Jkc1szXS50eXBlICE9ICdzcGxpY2UnIHx8XG4gICAgICAgIHJlY29yZHNbNF0udHlwZSAhPSAnc3BsaWNlJykge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIE9iamVjdC51bm9ic2VydmUodGVzdCwgY2FsbGJhY2spO1xuICAgIEFycmF5LnVub2JzZXJ2ZShhcnIsIGNhbGxiYWNrKTtcblxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgdmFyIGhhc09ic2VydmUgPSBkZXRlY3RPYmplY3RPYnNlcnZlKCk7XG5cbiAgZnVuY3Rpb24gZGV0ZWN0RXZhbCgpIHtcbiAgICAvLyBEb24ndCB0ZXN0IGZvciBldmFsIGlmIHdlJ3JlIHJ1bm5pbmcgaW4gYSBDaHJvbWUgQXBwIGVudmlyb25tZW50LlxuICAgIC8vIFdlIGNoZWNrIGZvciBBUElzIHNldCB0aGF0IG9ubHkgZXhpc3QgaW4gYSBDaHJvbWUgQXBwIGNvbnRleHQuXG4gICAgaWYgKHR5cGVvZiBjaHJvbWUgIT09ICd1bmRlZmluZWQnICYmIGNocm9tZS5hcHAgJiYgY2hyb21lLmFwcC5ydW50aW1lKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gRmlyZWZveCBPUyBBcHBzIGRvIG5vdCBhbGxvdyBldmFsLiBUaGlzIGZlYXR1cmUgZGV0ZWN0aW9uIGlzIHZlcnkgaGFja3lcbiAgICAvLyBidXQgZXZlbiBpZiBzb21lIG90aGVyIHBsYXRmb3JtIGFkZHMgc3VwcG9ydCBmb3IgdGhpcyBmdW5jdGlvbiB0aGlzIGNvZGVcbiAgICAvLyB3aWxsIGNvbnRpbnVlIHRvIHdvcmsuXG4gICAgaWYgKG5hdmlnYXRvci5nZXREZXZpY2VTdG9yYWdlKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIHZhciBmID0gbmV3IEZ1bmN0aW9uKCcnLCAncmV0dXJuIHRydWU7Jyk7XG4gICAgICByZXR1cm4gZigpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgdmFyIGhhc0V2YWwgPSBkZXRlY3RFdmFsKCk7XG5cbiAgZnVuY3Rpb24gaXNJbmRleChzKSB7XG4gICAgcmV0dXJuICtzID09PSBzID4+PiAwICYmIHMgIT09ICcnO1xuICB9XG5cbiAgZnVuY3Rpb24gdG9OdW1iZXIocykge1xuICAgIHJldHVybiArcztcbiAgfVxuXG4gIHZhciBudW1iZXJJc05hTiA9IGdsb2JhbC5OdW1iZXIuaXNOYU4gfHwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJyAmJiBnbG9iYWwuaXNOYU4odmFsdWUpO1xuICB9XG5cblxuICB2YXIgY3JlYXRlT2JqZWN0ID0gKCdfX3Byb3RvX18nIGluIHt9KSA/XG4gICAgZnVuY3Rpb24ob2JqKSB7IHJldHVybiBvYmo7IH0gOlxuICAgIGZ1bmN0aW9uKG9iaikge1xuICAgICAgdmFyIHByb3RvID0gb2JqLl9fcHJvdG9fXztcbiAgICAgIGlmICghcHJvdG8pXG4gICAgICAgIHJldHVybiBvYmo7XG4gICAgICB2YXIgbmV3T2JqZWN0ID0gT2JqZWN0LmNyZWF0ZShwcm90byk7XG4gICAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhvYmopLmZvckVhY2goZnVuY3Rpb24obmFtZSkge1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobmV3T2JqZWN0LCBuYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKG9iaiwgbmFtZSkpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gbmV3T2JqZWN0O1xuICAgIH07XG5cbiAgdmFyIGlkZW50U3RhcnQgPSAnW1xcJF9hLXpBLVpdJztcbiAgdmFyIGlkZW50UGFydCA9ICdbXFwkX2EtekEtWjAtOV0nO1xuXG5cbiAgdmFyIE1BWF9ESVJUWV9DSEVDS19DWUNMRVMgPSAxMDAwO1xuXG4gIGZ1bmN0aW9uIGRpcnR5Q2hlY2sob2JzZXJ2ZXIpIHtcbiAgICB2YXIgY3ljbGVzID0gMDtcbiAgICB3aGlsZSAoY3ljbGVzIDwgTUFYX0RJUlRZX0NIRUNLX0NZQ0xFUyAmJiBvYnNlcnZlci5jaGVja18oKSkge1xuICAgICAgY3ljbGVzKys7XG4gICAgfVxuICAgIGlmICh0ZXN0aW5nRXhwb3NlQ3ljbGVDb3VudClcbiAgICAgIGdsb2JhbC5kaXJ0eUNoZWNrQ3ljbGVDb3VudCA9IGN5Y2xlcztcblxuICAgIHJldHVybiBjeWNsZXMgPiAwO1xuICB9XG5cbiAgZnVuY3Rpb24gb2JqZWN0SXNFbXB0eShvYmplY3QpIHtcbiAgICBmb3IgKHZhciBwcm9wIGluIG9iamVjdClcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRpZmZJc0VtcHR5KGRpZmYpIHtcbiAgICByZXR1cm4gb2JqZWN0SXNFbXB0eShkaWZmLmFkZGVkKSAmJlxuICAgICAgICAgICBvYmplY3RJc0VtcHR5KGRpZmYucmVtb3ZlZCkgJiZcbiAgICAgICAgICAgb2JqZWN0SXNFbXB0eShkaWZmLmNoYW5nZWQpO1xuICB9XG5cbiAgZnVuY3Rpb24gZGlmZk9iamVjdEZyb21PbGRPYmplY3Qob2JqZWN0LCBvbGRPYmplY3QpIHtcbiAgICB2YXIgYWRkZWQgPSB7fTtcbiAgICB2YXIgcmVtb3ZlZCA9IHt9O1xuICAgIHZhciBjaGFuZ2VkID0ge307XG5cbiAgICBmb3IgKHZhciBwcm9wIGluIG9sZE9iamVjdCkge1xuICAgICAgdmFyIG5ld1ZhbHVlID0gb2JqZWN0W3Byb3BdO1xuXG4gICAgICBpZiAobmV3VmFsdWUgIT09IHVuZGVmaW5lZCAmJiBuZXdWYWx1ZSA9PT0gb2xkT2JqZWN0W3Byb3BdKVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgaWYgKCEocHJvcCBpbiBvYmplY3QpKSB7XG4gICAgICAgIHJlbW92ZWRbcHJvcF0gPSB1bmRlZmluZWQ7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAobmV3VmFsdWUgIT09IG9sZE9iamVjdFtwcm9wXSlcbiAgICAgICAgY2hhbmdlZFtwcm9wXSA9IG5ld1ZhbHVlO1xuICAgIH1cblxuICAgIGZvciAodmFyIHByb3AgaW4gb2JqZWN0KSB7XG4gICAgICBpZiAocHJvcCBpbiBvbGRPYmplY3QpXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICBhZGRlZFtwcm9wXSA9IG9iamVjdFtwcm9wXTtcbiAgICB9XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShvYmplY3QpICYmIG9iamVjdC5sZW5ndGggIT09IG9sZE9iamVjdC5sZW5ndGgpXG4gICAgICBjaGFuZ2VkLmxlbmd0aCA9IG9iamVjdC5sZW5ndGg7XG5cbiAgICByZXR1cm4ge1xuICAgICAgYWRkZWQ6IGFkZGVkLFxuICAgICAgcmVtb3ZlZDogcmVtb3ZlZCxcbiAgICAgIGNoYW5nZWQ6IGNoYW5nZWRcbiAgICB9O1xuICB9XG5cbiAgdmFyIGVvbVRhc2tzID0gW107XG4gIGZ1bmN0aW9uIHJ1bkVPTVRhc2tzKCkge1xuICAgIGlmICghZW9tVGFza3MubGVuZ3RoKVxuICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBlb21UYXNrcy5sZW5ndGg7IGkrKykge1xuICAgICAgZW9tVGFza3NbaV0oKTtcbiAgICB9XG4gICAgZW9tVGFza3MubGVuZ3RoID0gMDtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHZhciBydW5FT00gPSBoYXNPYnNlcnZlID8gKGZ1bmN0aW9uKCl7XG4gICAgdmFyIGVvbU9iaiA9IHsgcGluZ1Bvbmc6IHRydWUgfTtcbiAgICB2YXIgZW9tUnVuU2NoZWR1bGVkID0gZmFsc2U7XG5cbiAgICBPYmplY3Qub2JzZXJ2ZShlb21PYmosIGZ1bmN0aW9uKCkge1xuICAgICAgcnVuRU9NVGFza3MoKTtcbiAgICAgIGVvbVJ1blNjaGVkdWxlZCA9IGZhbHNlO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uKGZuKSB7XG4gICAgICBlb21UYXNrcy5wdXNoKGZuKTtcbiAgICAgIGlmICghZW9tUnVuU2NoZWR1bGVkKSB7XG4gICAgICAgIGVvbVJ1blNjaGVkdWxlZCA9IHRydWU7XG4gICAgICAgIGVvbU9iai5waW5nUG9uZyA9ICFlb21PYmoucGluZ1Bvbmc7XG4gICAgICB9XG4gICAgfTtcbiAgfSkoKSA6XG4gIChmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oZm4pIHtcbiAgICAgIGVvbVRhc2tzLnB1c2goZm4pO1xuICAgIH07XG4gIH0pKCk7XG5cbiAgdmFyIG9ic2VydmVkT2JqZWN0Q2FjaGUgPSBbXTtcblxuICBmdW5jdGlvbiBuZXdPYnNlcnZlZE9iamVjdCgpIHtcbiAgICB2YXIgb2JzZXJ2ZXI7XG4gICAgdmFyIG9iamVjdDtcbiAgICB2YXIgZGlzY2FyZFJlY29yZHMgPSBmYWxzZTtcbiAgICB2YXIgZmlyc3QgPSB0cnVlO1xuXG4gICAgZnVuY3Rpb24gY2FsbGJhY2socmVjb3Jkcykge1xuICAgICAgaWYgKG9ic2VydmVyICYmIG9ic2VydmVyLnN0YXRlXyA9PT0gT1BFTkVEICYmICFkaXNjYXJkUmVjb3JkcylcbiAgICAgICAgb2JzZXJ2ZXIuY2hlY2tfKHJlY29yZHMpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBvcGVuOiBmdW5jdGlvbihvYnMpIHtcbiAgICAgICAgaWYgKG9ic2VydmVyKVxuICAgICAgICAgIHRocm93IEVycm9yKCdPYnNlcnZlZE9iamVjdCBpbiB1c2UnKTtcblxuICAgICAgICBpZiAoIWZpcnN0KVxuICAgICAgICAgIE9iamVjdC5kZWxpdmVyQ2hhbmdlUmVjb3JkcyhjYWxsYmFjayk7XG5cbiAgICAgICAgb2JzZXJ2ZXIgPSBvYnM7XG4gICAgICAgIGZpcnN0ID0gZmFsc2U7XG4gICAgICB9LFxuICAgICAgb2JzZXJ2ZTogZnVuY3Rpb24ob2JqLCBhcnJheU9ic2VydmUpIHtcbiAgICAgICAgb2JqZWN0ID0gb2JqO1xuICAgICAgICBpZiAoYXJyYXlPYnNlcnZlKVxuICAgICAgICAgIEFycmF5Lm9ic2VydmUob2JqZWN0LCBjYWxsYmFjayk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICBPYmplY3Qub2JzZXJ2ZShvYmplY3QsIGNhbGxiYWNrKTtcbiAgICAgIH0sXG4gICAgICBkZWxpdmVyOiBmdW5jdGlvbihkaXNjYXJkKSB7XG4gICAgICAgIGRpc2NhcmRSZWNvcmRzID0gZGlzY2FyZDtcbiAgICAgICAgT2JqZWN0LmRlbGl2ZXJDaGFuZ2VSZWNvcmRzKGNhbGxiYWNrKTtcbiAgICAgICAgZGlzY2FyZFJlY29yZHMgPSBmYWxzZTtcbiAgICAgIH0sXG4gICAgICBjbG9zZTogZnVuY3Rpb24oKSB7XG4gICAgICAgIG9ic2VydmVyID0gdW5kZWZpbmVkO1xuICAgICAgICBPYmplY3QudW5vYnNlcnZlKG9iamVjdCwgY2FsbGJhY2spO1xuICAgICAgICBvYnNlcnZlZE9iamVjdENhY2hlLnB1c2godGhpcyk7XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIC8qXG4gICAqIFRoZSBvYnNlcnZlZFNldCBhYnN0cmFjdGlvbiBpcyBhIHBlcmYgb3B0aW1pemF0aW9uIHdoaWNoIHJlZHVjZXMgdGhlIHRvdGFsXG4gICAqIG51bWJlciBvZiBPYmplY3Qub2JzZXJ2ZSBvYnNlcnZhdGlvbnMgb2YgYSBzZXQgb2Ygb2JqZWN0cy4gVGhlIGlkZWEgaXMgdGhhdFxuICAgKiBncm91cHMgb2YgT2JzZXJ2ZXJzIHdpbGwgaGF2ZSBzb21lIG9iamVjdCBkZXBlbmRlbmNpZXMgaW4gY29tbW9uIGFuZCB0aGlzXG4gICAqIG9ic2VydmVkIHNldCBlbnN1cmVzIHRoYXQgZWFjaCBvYmplY3QgaW4gdGhlIHRyYW5zaXRpdmUgY2xvc3VyZSBvZlxuICAgKiBkZXBlbmRlbmNpZXMgaXMgb25seSBvYnNlcnZlZCBvbmNlLiBUaGUgb2JzZXJ2ZWRTZXQgYWN0cyBhcyBhIHdyaXRlIGJhcnJpZXJcbiAgICogc3VjaCB0aGF0IHdoZW5ldmVyIGFueSBjaGFuZ2UgY29tZXMgdGhyb3VnaCwgYWxsIE9ic2VydmVycyBhcmUgY2hlY2tlZCBmb3JcbiAgICogY2hhbmdlZCB2YWx1ZXMuXG4gICAqXG4gICAqIE5vdGUgdGhhdCB0aGlzIG9wdGltaXphdGlvbiBpcyBleHBsaWNpdGx5IG1vdmluZyB3b3JrIGZyb20gc2V0dXAtdGltZSB0b1xuICAgKiBjaGFuZ2UtdGltZS5cbiAgICpcbiAgICogVE9ETyhyYWZhZWx3KTogSW1wbGVtZW50IFwiZ2FyYmFnZSBjb2xsZWN0aW9uXCIuIEluIG9yZGVyIHRvIG1vdmUgd29yayBvZmZcbiAgICogdGhlIGNyaXRpY2FsIHBhdGgsIHdoZW4gT2JzZXJ2ZXJzIGFyZSBjbG9zZWQsIHRoZWlyIG9ic2VydmVkIG9iamVjdHMgYXJlXG4gICAqIG5vdCBPYmplY3QudW5vYnNlcnZlKGQpLiBBcyBhIHJlc3VsdCwgaXQnc2llc3RhIHBvc3NpYmxlIHRoYXQgaWYgdGhlIG9ic2VydmVkU2V0XG4gICAqIGlzIGtlcHQgb3BlbiwgYnV0IHNvbWUgT2JzZXJ2ZXJzIGhhdmUgYmVlbiBjbG9zZWQsIGl0IGNvdWxkIGNhdXNlIFwibGVha3NcIlxuICAgKiAocHJldmVudCBvdGhlcndpc2UgY29sbGVjdGFibGUgb2JqZWN0cyBmcm9tIGJlaW5nIGNvbGxlY3RlZCkuIEF0IHNvbWVcbiAgICogcG9pbnQsIHdlIHNob3VsZCBpbXBsZW1lbnQgaW5jcmVtZW50YWwgXCJnY1wiIHdoaWNoIGtlZXBzIGEgbGlzdCBvZlxuICAgKiBvYnNlcnZlZFNldHMgd2hpY2ggbWF5IG5lZWQgY2xlYW4tdXAgYW5kIGRvZXMgc21hbGwgYW1vdW50cyBvZiBjbGVhbnVwIG9uIGFcbiAgICogdGltZW91dCB1bnRpbCBhbGwgaXMgY2xlYW4uXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGdldE9ic2VydmVkT2JqZWN0KG9ic2VydmVyLCBvYmplY3QsIGFycmF5T2JzZXJ2ZSkge1xuICAgIHZhciBkaXIgPSBvYnNlcnZlZE9iamVjdENhY2hlLnBvcCgpIHx8IG5ld09ic2VydmVkT2JqZWN0KCk7XG4gICAgZGlyLm9wZW4ob2JzZXJ2ZXIpO1xuICAgIGRpci5vYnNlcnZlKG9iamVjdCwgYXJyYXlPYnNlcnZlKTtcbiAgICByZXR1cm4gZGlyO1xuICB9XG5cbiAgdmFyIG9ic2VydmVkU2V0Q2FjaGUgPSBbXTtcblxuICBmdW5jdGlvbiBuZXdPYnNlcnZlZFNldCgpIHtcbiAgICB2YXIgb2JzZXJ2ZXJDb3VudCA9IDA7XG4gICAgdmFyIG9ic2VydmVycyA9IFtdO1xuICAgIHZhciBvYmplY3RzID0gW107XG4gICAgdmFyIHJvb3RPYmo7XG4gICAgdmFyIHJvb3RPYmpQcm9wcztcblxuICAgIGZ1bmN0aW9uIG9ic2VydmUob2JqLCBwcm9wKSB7XG4gICAgICBpZiAoIW9iailcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICBpZiAob2JqID09PSByb290T2JqKVxuICAgICAgICByb290T2JqUHJvcHNbcHJvcF0gPSB0cnVlO1xuXG4gICAgICBpZiAob2JqZWN0cy5pbmRleE9mKG9iaikgPCAwKSB7XG4gICAgICAgIG9iamVjdHMucHVzaChvYmopO1xuICAgICAgICBPYmplY3Qub2JzZXJ2ZShvYmosIGNhbGxiYWNrKTtcbiAgICAgIH1cblxuICAgICAgb2JzZXJ2ZShPYmplY3QuZ2V0UHJvdG90eXBlT2Yob2JqKSwgcHJvcCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWxsUm9vdE9iak5vbk9ic2VydmVkUHJvcHMocmVjcykge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZWNzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciByZWMgPSByZWNzW2ldO1xuICAgICAgICBpZiAocmVjLm9iamVjdCAhPT0gcm9vdE9iaiB8fFxuICAgICAgICAgICAgcm9vdE9ialByb3BzW3JlYy5uYW1lXSB8fFxuICAgICAgICAgICAgcmVjLnR5cGUgPT09ICdzZXRQcm90b3R5cGUnKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjYWxsYmFjayhyZWNzKSB7XG4gICAgICBpZiAoYWxsUm9vdE9iak5vbk9ic2VydmVkUHJvcHMocmVjcykpXG4gICAgICAgIHJldHVybjtcblxuICAgICAgdmFyIG9ic2VydmVyO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvYnNlcnZlcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgb2JzZXJ2ZXIgPSBvYnNlcnZlcnNbaV07XG4gICAgICAgIGlmIChvYnNlcnZlci5zdGF0ZV8gPT0gT1BFTkVEKSB7XG4gICAgICAgICAgb2JzZXJ2ZXIuaXRlcmF0ZU9iamVjdHNfKG9ic2VydmUpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb2JzZXJ2ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIG9ic2VydmVyID0gb2JzZXJ2ZXJzW2ldO1xuICAgICAgICBpZiAob2JzZXJ2ZXIuc3RhdGVfID09IE9QRU5FRCkge1xuICAgICAgICAgIG9ic2VydmVyLmNoZWNrXygpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIHJlY29yZCA9IHtcbiAgICAgIG9iamVjdDogdW5kZWZpbmVkLFxuICAgICAgb2JqZWN0czogb2JqZWN0cyxcbiAgICAgIG9wZW46IGZ1bmN0aW9uKG9icywgb2JqZWN0KSB7XG4gICAgICAgIGlmICghcm9vdE9iaikge1xuICAgICAgICAgIHJvb3RPYmogPSBvYmplY3Q7XG4gICAgICAgICAgcm9vdE9ialByb3BzID0ge307XG4gICAgICAgIH1cblxuICAgICAgICBvYnNlcnZlcnMucHVzaChvYnMpO1xuICAgICAgICBvYnNlcnZlckNvdW50Kys7XG4gICAgICAgIG9icy5pdGVyYXRlT2JqZWN0c18ob2JzZXJ2ZSk7XG4gICAgICB9LFxuICAgICAgY2xvc2U6IGZ1bmN0aW9uKG9icykge1xuICAgICAgICBvYnNlcnZlckNvdW50LS07XG4gICAgICAgIGlmIChvYnNlcnZlckNvdW50ID4gMCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb2JqZWN0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIE9iamVjdC51bm9ic2VydmUob2JqZWN0c1tpXSwgY2FsbGJhY2spO1xuICAgICAgICAgIE9ic2VydmVyLnVub2JzZXJ2ZWRDb3VudCsrO1xuICAgICAgICB9XG5cbiAgICAgICAgb2JzZXJ2ZXJzLmxlbmd0aCA9IDA7XG4gICAgICAgIG9iamVjdHMubGVuZ3RoID0gMDtcbiAgICAgICAgcm9vdE9iaiA9IHVuZGVmaW5lZDtcbiAgICAgICAgcm9vdE9ialByb3BzID0gdW5kZWZpbmVkO1xuICAgICAgICBvYnNlcnZlZFNldENhY2hlLnB1c2godGhpcyk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiByZWNvcmQ7XG4gIH1cblxuICB2YXIgbGFzdE9ic2VydmVkU2V0O1xuXG4gIHZhciBVTk9QRU5FRCA9IDA7XG4gIHZhciBPUEVORUQgPSAxO1xuICB2YXIgQ0xPU0VEID0gMjtcblxuICB2YXIgbmV4dE9ic2VydmVySWQgPSAxO1xuXG4gIGZ1bmN0aW9uIE9ic2VydmVyKCkge1xuICAgIHRoaXMuc3RhdGVfID0gVU5PUEVORUQ7XG4gICAgdGhpcy5jYWxsYmFja18gPSB1bmRlZmluZWQ7XG4gICAgdGhpcy50YXJnZXRfID0gdW5kZWZpbmVkOyAvLyBUT0RPKHJhZmFlbHcpOiBTaG91bGQgYmUgV2Vha1JlZlxuICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfID0gdW5kZWZpbmVkO1xuICAgIHRoaXMudmFsdWVfID0gdW5kZWZpbmVkO1xuICAgIHRoaXMuaWRfID0gbmV4dE9ic2VydmVySWQrKztcbiAgfVxuXG4gIE9ic2VydmVyLnByb3RvdHlwZSA9IHtcbiAgICBvcGVuOiBmdW5jdGlvbihjYWxsYmFjaywgdGFyZ2V0KSB7XG4gICAgICBpZiAodGhpcy5zdGF0ZV8gIT0gVU5PUEVORUQpXG4gICAgICAgIHRocm93IEVycm9yKCdPYnNlcnZlciBoYXMgYWxyZWFkeSBiZWVuIG9wZW5lZC4nKTtcblxuICAgICAgYWRkVG9BbGwodGhpcyk7XG4gICAgICB0aGlzLmNhbGxiYWNrXyA9IGNhbGxiYWNrO1xuICAgICAgdGhpcy50YXJnZXRfID0gdGFyZ2V0O1xuICAgICAgdGhpcy5jb25uZWN0XygpO1xuICAgICAgdGhpcy5zdGF0ZV8gPSBPUEVORUQ7XG4gICAgICByZXR1cm4gdGhpcy52YWx1ZV87XG4gICAgfSxcblxuICAgIGNsb3NlOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLnN0YXRlXyAhPSBPUEVORUQpXG4gICAgICAgIHJldHVybjtcblxuICAgICAgcmVtb3ZlRnJvbUFsbCh0aGlzKTtcbiAgICAgIHRoaXMuZGlzY29ubmVjdF8oKTtcbiAgICAgIHRoaXMudmFsdWVfID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy5jYWxsYmFja18gPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLnRhcmdldF8gPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLnN0YXRlXyA9IENMT1NFRDtcbiAgICB9LFxuXG4gICAgZGVsaXZlcjogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5zdGF0ZV8gIT0gT1BFTkVEKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIGRpcnR5Q2hlY2sodGhpcyk7XG4gICAgfSxcblxuICAgIHJlcG9ydF86IGZ1bmN0aW9uKGNoYW5nZXMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHRoaXMuY2FsbGJhY2tfLmFwcGx5KHRoaXMudGFyZ2V0XywgY2hhbmdlcyk7XG4gICAgICB9IGNhdGNoIChleCkge1xuICAgICAgICBPYnNlcnZlci5fZXJyb3JUaHJvd25EdXJpbmdDYWxsYmFjayA9IHRydWU7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0V4Y2VwdGlvbiBjYXVnaHQgZHVyaW5nIG9ic2VydmVyIGNhbGxiYWNrOiAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgKGV4LnN0YWNrIHx8IGV4KSk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIGRpc2NhcmRDaGFuZ2VzOiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuY2hlY2tfKHVuZGVmaW5lZCwgdHJ1ZSk7XG4gICAgICByZXR1cm4gdGhpcy52YWx1ZV87XG4gICAgfVxuICB9XG5cbiAgdmFyIGNvbGxlY3RPYnNlcnZlcnMgPSAhaGFzT2JzZXJ2ZTtcbiAgdmFyIGFsbE9ic2VydmVycztcbiAgT2JzZXJ2ZXIuX2FsbE9ic2VydmVyc0NvdW50ID0gMDtcblxuICBpZiAoY29sbGVjdE9ic2VydmVycykge1xuICAgIGFsbE9ic2VydmVycyA9IFtdO1xuICB9XG5cbiAgZnVuY3Rpb24gYWRkVG9BbGwob2JzZXJ2ZXIpIHtcbiAgICBPYnNlcnZlci5fYWxsT2JzZXJ2ZXJzQ291bnQrKztcbiAgICBpZiAoIWNvbGxlY3RPYnNlcnZlcnMpXG4gICAgICByZXR1cm47XG5cbiAgICBhbGxPYnNlcnZlcnMucHVzaChvYnNlcnZlcik7XG4gIH1cblxuICBmdW5jdGlvbiByZW1vdmVGcm9tQWxsKG9ic2VydmVyKSB7XG4gICAgT2JzZXJ2ZXIuX2FsbE9ic2VydmVyc0NvdW50LS07XG4gIH1cblxuICB2YXIgcnVubmluZ01pY3JvdGFza0NoZWNrcG9pbnQgPSBmYWxzZTtcblxuICB2YXIgaGFzRGVidWdGb3JjZUZ1bGxEZWxpdmVyeSA9IGhhc09ic2VydmUgJiYgaGFzRXZhbCAmJiAoZnVuY3Rpb24oKSB7XG4gICAgdHJ5IHtcbiAgICAgIGV2YWwoJyVSdW5NaWNyb3Rhc2tzKCknKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9KSgpO1xuXG4gIGdsb2JhbC5QbGF0Zm9ybSA9IGdsb2JhbC5QbGF0Zm9ybSB8fCB7fTtcblxuICBnbG9iYWwuUGxhdGZvcm0ucGVyZm9ybU1pY3JvdGFza0NoZWNrcG9pbnQgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAocnVubmluZ01pY3JvdGFza0NoZWNrcG9pbnQpXG4gICAgICByZXR1cm47XG5cbiAgICBpZiAoaGFzRGVidWdGb3JjZUZ1bGxEZWxpdmVyeSkge1xuICAgICAgZXZhbCgnJVJ1bk1pY3JvdGFza3MoKScpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICghY29sbGVjdE9ic2VydmVycylcbiAgICAgIHJldHVybjtcblxuICAgIHJ1bm5pbmdNaWNyb3Rhc2tDaGVja3BvaW50ID0gdHJ1ZTtcblxuICAgIHZhciBjeWNsZXMgPSAwO1xuICAgIHZhciBhbnlDaGFuZ2VkLCB0b0NoZWNrO1xuXG4gICAgZG8ge1xuICAgICAgY3ljbGVzKys7XG4gICAgICB0b0NoZWNrID0gYWxsT2JzZXJ2ZXJzO1xuICAgICAgYWxsT2JzZXJ2ZXJzID0gW107XG4gICAgICBhbnlDaGFuZ2VkID0gZmFsc2U7XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdG9DaGVjay5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgb2JzZXJ2ZXIgPSB0b0NoZWNrW2ldO1xuICAgICAgICBpZiAob2JzZXJ2ZXIuc3RhdGVfICE9IE9QRU5FRClcbiAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICBpZiAob2JzZXJ2ZXIuY2hlY2tfKCkpXG4gICAgICAgICAgYW55Q2hhbmdlZCA9IHRydWU7XG5cbiAgICAgICAgYWxsT2JzZXJ2ZXJzLnB1c2gob2JzZXJ2ZXIpO1xuICAgICAgfVxuICAgICAgaWYgKHJ1bkVPTVRhc2tzKCkpXG4gICAgICAgIGFueUNoYW5nZWQgPSB0cnVlO1xuICAgIH0gd2hpbGUgKGN5Y2xlcyA8IE1BWF9ESVJUWV9DSEVDS19DWUNMRVMgJiYgYW55Q2hhbmdlZCk7XG5cbiAgICBpZiAodGVzdGluZ0V4cG9zZUN5Y2xlQ291bnQpXG4gICAgICBnbG9iYWwuZGlydHlDaGVja0N5Y2xlQ291bnQgPSBjeWNsZXM7XG5cbiAgICBydW5uaW5nTWljcm90YXNrQ2hlY2twb2ludCA9IGZhbHNlO1xuICB9O1xuXG4gIGlmIChjb2xsZWN0T2JzZXJ2ZXJzKSB7XG4gICAgZ2xvYmFsLlBsYXRmb3JtLmNsZWFyT2JzZXJ2ZXJzID0gZnVuY3Rpb24oKSB7XG4gICAgICBhbGxPYnNlcnZlcnMgPSBbXTtcbiAgICB9O1xuICB9XG5cbiAgZnVuY3Rpb24gT2JqZWN0T2JzZXJ2ZXIob2JqZWN0KSB7XG4gICAgT2JzZXJ2ZXIuY2FsbCh0aGlzKTtcbiAgICB0aGlzLnZhbHVlXyA9IG9iamVjdDtcbiAgICB0aGlzLm9sZE9iamVjdF8gPSB1bmRlZmluZWQ7XG4gIH1cblxuICBPYmplY3RPYnNlcnZlci5wcm90b3R5cGUgPSBjcmVhdGVPYmplY3Qoe1xuICAgIF9fcHJvdG9fXzogT2JzZXJ2ZXIucHJvdG90eXBlLFxuXG4gICAgYXJyYXlPYnNlcnZlOiBmYWxzZSxcblxuICAgIGNvbm5lY3RfOiBmdW5jdGlvbihjYWxsYmFjaywgdGFyZ2V0KSB7XG4gICAgICBpZiAoaGFzT2JzZXJ2ZSkge1xuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXyA9IGdldE9ic2VydmVkT2JqZWN0KHRoaXMsIHRoaXMudmFsdWVfLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYXJyYXlPYnNlcnZlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMub2xkT2JqZWN0XyA9IHRoaXMuY29weU9iamVjdCh0aGlzLnZhbHVlXyk7XG4gICAgICB9XG5cbiAgICB9LFxuXG4gICAgY29weU9iamVjdDogZnVuY3Rpb24ob2JqZWN0KSB7XG4gICAgICB2YXIgY29weSA9IEFycmF5LmlzQXJyYXkob2JqZWN0KSA/IFtdIDoge307XG4gICAgICBmb3IgKHZhciBwcm9wIGluIG9iamVjdCkge1xuICAgICAgICBjb3B5W3Byb3BdID0gb2JqZWN0W3Byb3BdO1xuICAgICAgfTtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KG9iamVjdCkpXG4gICAgICAgIGNvcHkubGVuZ3RoID0gb2JqZWN0Lmxlbmd0aDtcbiAgICAgIHJldHVybiBjb3B5O1xuICAgIH0sXG5cbiAgICBjaGVja186IGZ1bmN0aW9uKGNoYW5nZVJlY29yZHMsIHNraXBDaGFuZ2VzKSB7XG4gICAgICB2YXIgZGlmZjtcbiAgICAgIHZhciBvbGRWYWx1ZXM7XG4gICAgICBpZiAoaGFzT2JzZXJ2ZSkge1xuICAgICAgICBpZiAoIWNoYW5nZVJlY29yZHMpXG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIG9sZFZhbHVlcyA9IHt9O1xuICAgICAgICBkaWZmID0gZGlmZk9iamVjdEZyb21DaGFuZ2VSZWNvcmRzKHRoaXMudmFsdWVfLCBjaGFuZ2VSZWNvcmRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZFZhbHVlcyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvbGRWYWx1ZXMgPSB0aGlzLm9sZE9iamVjdF87XG4gICAgICAgIGRpZmYgPSBkaWZmT2JqZWN0RnJvbU9sZE9iamVjdCh0aGlzLnZhbHVlXywgdGhpcy5vbGRPYmplY3RfKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGRpZmZJc0VtcHR5KGRpZmYpKVxuICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgIGlmICghaGFzT2JzZXJ2ZSlcbiAgICAgICAgdGhpcy5vbGRPYmplY3RfID0gdGhpcy5jb3B5T2JqZWN0KHRoaXMudmFsdWVfKTtcblxuICAgICAgdGhpcy5yZXBvcnRfKFtcbiAgICAgICAgZGlmZi5hZGRlZCB8fCB7fSxcbiAgICAgICAgZGlmZi5yZW1vdmVkIHx8IHt9LFxuICAgICAgICBkaWZmLmNoYW5nZWQgfHwge30sXG4gICAgICAgIGZ1bmN0aW9uKHByb3BlcnR5KSB7XG4gICAgICAgICAgcmV0dXJuIG9sZFZhbHVlc1twcm9wZXJ0eV07XG4gICAgICAgIH1cbiAgICAgIF0pO1xuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9LFxuXG4gICAgZGlzY29ubmVjdF86IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKGhhc09ic2VydmUpIHtcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8uY2xvc2UoKTtcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8gPSB1bmRlZmluZWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm9sZE9iamVjdF8gPSB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgfSxcblxuICAgIGRlbGl2ZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuc3RhdGVfICE9IE9QRU5FRClcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICBpZiAoaGFzT2JzZXJ2ZSlcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8uZGVsaXZlcihmYWxzZSk7XG4gICAgICBlbHNlXG4gICAgICAgIGRpcnR5Q2hlY2sodGhpcyk7XG4gICAgfSxcblxuICAgIGRpc2NhcmRDaGFuZ2VzOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLmRpcmVjdE9ic2VydmVyXylcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8uZGVsaXZlcih0cnVlKTtcbiAgICAgIGVsc2VcbiAgICAgICAgdGhpcy5vbGRPYmplY3RfID0gdGhpcy5jb3B5T2JqZWN0KHRoaXMudmFsdWVfKTtcblxuICAgICAgcmV0dXJuIHRoaXMudmFsdWVfO1xuICAgIH1cbiAgfSk7XG5cbiAgZnVuY3Rpb24gQXJyYXlPYnNlcnZlcihhcnJheSkge1xuICAgIGlmICghQXJyYXkuaXNBcnJheShhcnJheSkpXG4gICAgICB0aHJvdyBFcnJvcignUHJvdmlkZWQgb2JqZWN0IGlzIG5vdCBhbiBBcnJheScpO1xuICAgIE9iamVjdE9ic2VydmVyLmNhbGwodGhpcywgYXJyYXkpO1xuICB9XG5cbiAgQXJyYXlPYnNlcnZlci5wcm90b3R5cGUgPSBjcmVhdGVPYmplY3Qoe1xuXG4gICAgX19wcm90b19fOiBPYmplY3RPYnNlcnZlci5wcm90b3R5cGUsXG5cbiAgICBhcnJheU9ic2VydmU6IHRydWUsXG5cbiAgICBjb3B5T2JqZWN0OiBmdW5jdGlvbihhcnIpIHtcbiAgICAgIHJldHVybiBhcnIuc2xpY2UoKTtcbiAgICB9LFxuXG4gICAgY2hlY2tfOiBmdW5jdGlvbihjaGFuZ2VSZWNvcmRzKSB7XG4gICAgICB2YXIgc3BsaWNlcztcbiAgICAgIGlmIChoYXNPYnNlcnZlKSB7XG4gICAgICAgIGlmICghY2hhbmdlUmVjb3JkcylcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIHNwbGljZXMgPSBwcm9qZWN0QXJyYXlTcGxpY2VzKHRoaXMudmFsdWVfLCBjaGFuZ2VSZWNvcmRzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNwbGljZXMgPSBjYWxjU3BsaWNlcyh0aGlzLnZhbHVlXywgMCwgdGhpcy52YWx1ZV8ubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5vbGRPYmplY3RfLCAwLCB0aGlzLm9sZE9iamVjdF8ubGVuZ3RoKTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFzcGxpY2VzIHx8ICFzcGxpY2VzLmxlbmd0aClcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICBpZiAoIWhhc09ic2VydmUpXG4gICAgICAgIHRoaXMub2xkT2JqZWN0XyA9IHRoaXMuY29weU9iamVjdCh0aGlzLnZhbHVlXyk7XG5cbiAgICAgIHRoaXMucmVwb3J0Xyhbc3BsaWNlc10pO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9KTtcblxuICBBcnJheU9ic2VydmVyLmFwcGx5U3BsaWNlcyA9IGZ1bmN0aW9uKHByZXZpb3VzLCBjdXJyZW50LCBzcGxpY2VzKSB7XG4gICAgc3BsaWNlcy5mb3JFYWNoKGZ1bmN0aW9uKHNwbGljZSkge1xuICAgICAgdmFyIHNwbGljZUFyZ3MgPSBbc3BsaWNlLmluZGV4LCBzcGxpY2UucmVtb3ZlZC5sZW5ndGhdO1xuICAgICAgdmFyIGFkZEluZGV4ID0gc3BsaWNlLmluZGV4O1xuICAgICAgd2hpbGUgKGFkZEluZGV4IDwgc3BsaWNlLmluZGV4ICsgc3BsaWNlLmFkZGVkQ291bnQpIHtcbiAgICAgICAgc3BsaWNlQXJncy5wdXNoKGN1cnJlbnRbYWRkSW5kZXhdKTtcbiAgICAgICAgYWRkSW5kZXgrKztcbiAgICAgIH1cblxuICAgICAgQXJyYXkucHJvdG90eXBlLnNwbGljZS5hcHBseShwcmV2aW91cywgc3BsaWNlQXJncyk7XG4gICAgfSk7XG4gIH07XG5cbiAgdmFyIG9ic2VydmVyU2VudGluZWwgPSB7fTtcblxuICB2YXIgZXhwZWN0ZWRSZWNvcmRUeXBlcyA9IHtcbiAgICBhZGQ6IHRydWUsXG4gICAgdXBkYXRlOiB0cnVlLFxuICAgIGRlbGV0ZTogdHJ1ZVxuICB9O1xuXG4gIGZ1bmN0aW9uIGRpZmZPYmplY3RGcm9tQ2hhbmdlUmVjb3JkcyhvYmplY3QsIGNoYW5nZVJlY29yZHMsIG9sZFZhbHVlcykge1xuICAgIHZhciBhZGRlZCA9IHt9O1xuICAgIHZhciByZW1vdmVkID0ge307XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoYW5nZVJlY29yZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciByZWNvcmQgPSBjaGFuZ2VSZWNvcmRzW2ldO1xuICAgICAgaWYgKCFleHBlY3RlZFJlY29yZFR5cGVzW3JlY29yZC50eXBlXSkge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdVbmtub3duIGNoYW5nZVJlY29yZCB0eXBlOiAnICsgcmVjb3JkLnR5cGUpO1xuICAgICAgICBjb25zb2xlLmVycm9yKHJlY29yZCk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoIShyZWNvcmQubmFtZSBpbiBvbGRWYWx1ZXMpKVxuICAgICAgICBvbGRWYWx1ZXNbcmVjb3JkLm5hbWVdID0gcmVjb3JkLm9sZFZhbHVlO1xuXG4gICAgICBpZiAocmVjb3JkLnR5cGUgPT0gJ3VwZGF0ZScpXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICBpZiAocmVjb3JkLnR5cGUgPT0gJ2FkZCcpIHtcbiAgICAgICAgaWYgKHJlY29yZC5uYW1lIGluIHJlbW92ZWQpXG4gICAgICAgICAgZGVsZXRlIHJlbW92ZWRbcmVjb3JkLm5hbWVdO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgYWRkZWRbcmVjb3JkLm5hbWVdID0gdHJ1ZTtcblxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gdHlwZSA9ICdkZWxldGUnXG4gICAgICBpZiAocmVjb3JkLm5hbWUgaW4gYWRkZWQpIHtcbiAgICAgICAgZGVsZXRlIGFkZGVkW3JlY29yZC5uYW1lXTtcbiAgICAgICAgZGVsZXRlIG9sZFZhbHVlc1tyZWNvcmQubmFtZV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZW1vdmVkW3JlY29yZC5uYW1lXSA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yICh2YXIgcHJvcCBpbiBhZGRlZClcbiAgICAgIGFkZGVkW3Byb3BdID0gb2JqZWN0W3Byb3BdO1xuXG4gICAgZm9yICh2YXIgcHJvcCBpbiByZW1vdmVkKVxuICAgICAgcmVtb3ZlZFtwcm9wXSA9IHVuZGVmaW5lZDtcblxuICAgIHZhciBjaGFuZ2VkID0ge307XG4gICAgZm9yICh2YXIgcHJvcCBpbiBvbGRWYWx1ZXMpIHtcbiAgICAgIGlmIChwcm9wIGluIGFkZGVkIHx8IHByb3AgaW4gcmVtb3ZlZClcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIHZhciBuZXdWYWx1ZSA9IG9iamVjdFtwcm9wXTtcbiAgICAgIGlmIChvbGRWYWx1ZXNbcHJvcF0gIT09IG5ld1ZhbHVlKVxuICAgICAgICBjaGFuZ2VkW3Byb3BdID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGFkZGVkOiBhZGRlZCxcbiAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgICBjaGFuZ2VkOiBjaGFuZ2VkXG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG5ld1NwbGljZShpbmRleCwgcmVtb3ZlZCwgYWRkZWRDb3VudCkge1xuICAgIHJldHVybiB7XG4gICAgICBpbmRleDogaW5kZXgsXG4gICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgICAgYWRkZWRDb3VudDogYWRkZWRDb3VudFxuICAgIH07XG4gIH1cblxuICB2YXIgRURJVF9MRUFWRSA9IDA7XG4gIHZhciBFRElUX1VQREFURSA9IDE7XG4gIHZhciBFRElUX0FERCA9IDI7XG4gIHZhciBFRElUX0RFTEVURSA9IDM7XG5cbiAgZnVuY3Rpb24gQXJyYXlTcGxpY2UoKSB7fVxuXG4gIEFycmF5U3BsaWNlLnByb3RvdHlwZSA9IHtcblxuICAgIC8vIE5vdGU6IFRoaXMgZnVuY3Rpb24gaXMgKmJhc2VkKiBvbiB0aGUgY29tcHV0YXRpb24gb2YgdGhlIExldmVuc2h0ZWluXG4gICAgLy8gXCJlZGl0XCIgZGlzdGFuY2UuIFRoZSBvbmUgY2hhbmdlIGlzIHRoYXQgXCJ1cGRhdGVzXCIgYXJlIHRyZWF0ZWQgYXMgdHdvXG4gICAgLy8gZWRpdHMgLSBub3Qgb25lLiBXaXRoIEFycmF5IHNwbGljZXMsIGFuIHVwZGF0ZSBpcyByZWFsbHkgYSBkZWxldGVcbiAgICAvLyBmb2xsb3dlZCBieSBhbiBhZGQuIEJ5IHJldGFpbmluZyB0aGlzLCB3ZSBvcHRpbWl6ZSBmb3IgXCJrZWVwaW5nXCIgdGhlXG4gICAgLy8gbWF4aW11bSBhcnJheSBpdGVtcyBpbiB0aGUgb3JpZ2luYWwgYXJyYXkuIEZvciBleGFtcGxlOlxuICAgIC8vXG4gICAgLy8gICAneHh4eDEyMycgLT4gJzEyM3l5eXknXG4gICAgLy9cbiAgICAvLyBXaXRoIDEtZWRpdCB1cGRhdGVzLCB0aGUgc2hvcnRlc3QgcGF0aCB3b3VsZCBiZSBqdXN0IHRvIHVwZGF0ZSBhbGwgc2V2ZW5cbiAgICAvLyBjaGFyYWN0ZXJzLiBXaXRoIDItZWRpdCB1cGRhdGVzLCB3ZSBkZWxldGUgNCwgbGVhdmUgMywgYW5kIGFkZCA0LiBUaGlzXG4gICAgLy8gbGVhdmVzIHRoZSBzdWJzdHJpbmcgJzEyMycgaW50YWN0LlxuICAgIGNhbGNFZGl0RGlzdGFuY2VzOiBmdW5jdGlvbihjdXJyZW50LCBjdXJyZW50U3RhcnQsIGN1cnJlbnRFbmQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZCwgb2xkU3RhcnQsIG9sZEVuZCkge1xuICAgICAgLy8gXCJEZWxldGlvblwiIGNvbHVtbnNcbiAgICAgIHZhciByb3dDb3VudCA9IG9sZEVuZCAtIG9sZFN0YXJ0ICsgMTtcbiAgICAgIHZhciBjb2x1bW5Db3VudCA9IGN1cnJlbnRFbmQgLSBjdXJyZW50U3RhcnQgKyAxO1xuICAgICAgdmFyIGRpc3RhbmNlcyA9IG5ldyBBcnJheShyb3dDb3VudCk7XG5cbiAgICAgIC8vIFwiQWRkaXRpb25cIiByb3dzLiBJbml0aWFsaXplIG51bGwgY29sdW1uLlxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByb3dDb3VudDsgaSsrKSB7XG4gICAgICAgIGRpc3RhbmNlc1tpXSA9IG5ldyBBcnJheShjb2x1bW5Db3VudCk7XG4gICAgICAgIGRpc3RhbmNlc1tpXVswXSA9IGk7XG4gICAgICB9XG5cbiAgICAgIC8vIEluaXRpYWxpemUgbnVsbCByb3dcbiAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgY29sdW1uQ291bnQ7IGorKylcbiAgICAgICAgZGlzdGFuY2VzWzBdW2pdID0gajtcblxuICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCByb3dDb3VudDsgaSsrKSB7XG4gICAgICAgIGZvciAodmFyIGogPSAxOyBqIDwgY29sdW1uQ291bnQ7IGorKykge1xuICAgICAgICAgIGlmICh0aGlzLmVxdWFscyhjdXJyZW50W2N1cnJlbnRTdGFydCArIGogLSAxXSwgb2xkW29sZFN0YXJ0ICsgaSAtIDFdKSlcbiAgICAgICAgICAgIGRpc3RhbmNlc1tpXVtqXSA9IGRpc3RhbmNlc1tpIC0gMV1baiAtIDFdO1xuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdmFyIG5vcnRoID0gZGlzdGFuY2VzW2kgLSAxXVtqXSArIDE7XG4gICAgICAgICAgICB2YXIgd2VzdCA9IGRpc3RhbmNlc1tpXVtqIC0gMV0gKyAxO1xuICAgICAgICAgICAgZGlzdGFuY2VzW2ldW2pdID0gbm9ydGggPCB3ZXN0ID8gbm9ydGggOiB3ZXN0O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gZGlzdGFuY2VzO1xuICAgIH0sXG5cbiAgICAvLyBUaGlzIHN0YXJ0cyBhdCB0aGUgZmluYWwgd2VpZ2h0LCBhbmQgd2Fsa3MgXCJiYWNrd2FyZFwiIGJ5IGZpbmRpbmdcbiAgICAvLyB0aGUgbWluaW11bSBwcmV2aW91cyB3ZWlnaHQgcmVjdXJzaXZlbHkgdW50aWwgdGhlIG9yaWdpbiBvZiB0aGUgd2VpZ2h0XG4gICAgLy8gbWF0cml4LlxuICAgIHNwbGljZU9wZXJhdGlvbnNGcm9tRWRpdERpc3RhbmNlczogZnVuY3Rpb24oZGlzdGFuY2VzKSB7XG4gICAgICB2YXIgaSA9IGRpc3RhbmNlcy5sZW5ndGggLSAxO1xuICAgICAgdmFyIGogPSBkaXN0YW5jZXNbMF0ubGVuZ3RoIC0gMTtcbiAgICAgIHZhciBjdXJyZW50ID0gZGlzdGFuY2VzW2ldW2pdO1xuICAgICAgdmFyIGVkaXRzID0gW107XG4gICAgICB3aGlsZSAoaSA+IDAgfHwgaiA+IDApIHtcbiAgICAgICAgaWYgKGkgPT0gMCkge1xuICAgICAgICAgIGVkaXRzLnB1c2goRURJVF9BREQpO1xuICAgICAgICAgIGotLTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaiA9PSAwKSB7XG4gICAgICAgICAgZWRpdHMucHVzaChFRElUX0RFTEVURSk7XG4gICAgICAgICAgaS0tO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIHZhciBub3J0aFdlc3QgPSBkaXN0YW5jZXNbaSAtIDFdW2ogLSAxXTtcbiAgICAgICAgdmFyIHdlc3QgPSBkaXN0YW5jZXNbaSAtIDFdW2pdO1xuICAgICAgICB2YXIgbm9ydGggPSBkaXN0YW5jZXNbaV1baiAtIDFdO1xuXG4gICAgICAgIHZhciBtaW47XG4gICAgICAgIGlmICh3ZXN0IDwgbm9ydGgpXG4gICAgICAgICAgbWluID0gd2VzdCA8IG5vcnRoV2VzdCA/IHdlc3QgOiBub3J0aFdlc3Q7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICBtaW4gPSBub3J0aCA8IG5vcnRoV2VzdCA/IG5vcnRoIDogbm9ydGhXZXN0O1xuXG4gICAgICAgIGlmIChtaW4gPT0gbm9ydGhXZXN0KSB7XG4gICAgICAgICAgaWYgKG5vcnRoV2VzdCA9PSBjdXJyZW50KSB7XG4gICAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfTEVBVkUpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfVVBEQVRFKTtcbiAgICAgICAgICAgIGN1cnJlbnQgPSBub3J0aFdlc3Q7XG4gICAgICAgICAgfVxuICAgICAgICAgIGktLTtcbiAgICAgICAgICBqLS07XG4gICAgICAgIH0gZWxzZSBpZiAobWluID09IHdlc3QpIHtcbiAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfREVMRVRFKTtcbiAgICAgICAgICBpLS07XG4gICAgICAgICAgY3VycmVudCA9IHdlc3Q7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZWRpdHMucHVzaChFRElUX0FERCk7XG4gICAgICAgICAgai0tO1xuICAgICAgICAgIGN1cnJlbnQgPSBub3J0aDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBlZGl0cy5yZXZlcnNlKCk7XG4gICAgICByZXR1cm4gZWRpdHM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFNwbGljZSBQcm9qZWN0aW9uIGZ1bmN0aW9uczpcbiAgICAgKlxuICAgICAqIEEgc3BsaWNlIG1hcCBpcyBhIHJlcHJlc2VudGF0aW9uIG9mIGhvdyBhIHByZXZpb3VzIGFycmF5IG9mIGl0ZW1zXG4gICAgICogd2FzIHRyYW5zZm9ybWVkIGludG8gYSBuZXcgYXJyYXkgb2YgaXRlbXMuIENvbmNlcHR1YWxseSBpdCBpcyBhIGxpc3Qgb2ZcbiAgICAgKiB0dXBsZXMgb2ZcbiAgICAgKlxuICAgICAqICAgPGluZGV4LCByZW1vdmVkLCBhZGRlZENvdW50PlxuICAgICAqXG4gICAgICogd2hpY2ggYXJlIGtlcHQgaW4gYXNjZW5kaW5nIGluZGV4IG9yZGVyIG9mLiBUaGUgdHVwbGUgcmVwcmVzZW50cyB0aGF0IGF0XG4gICAgICogdGhlIHxpbmRleHwsIHxyZW1vdmVkfCBzZXF1ZW5jZSBvZiBpdGVtcyB3ZXJlIHJlbW92ZWQsIGFuZCBjb3VudGluZyBmb3J3YXJkXG4gICAgICogZnJvbSB8aW5kZXh8LCB8YWRkZWRDb3VudHwgaXRlbXMgd2VyZSBhZGRlZC5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIExhY2tpbmcgaW5kaXZpZHVhbCBzcGxpY2UgbXV0YXRpb24gaW5mb3JtYXRpb24sIHRoZSBtaW5pbWFsIHNldCBvZlxuICAgICAqIHNwbGljZXMgY2FuIGJlIHN5bnRoZXNpemVkIGdpdmVuIHRoZSBwcmV2aW91cyBzdGF0ZSBhbmQgZmluYWwgc3RhdGUgb2YgYW5cbiAgICAgKiBhcnJheS4gVGhlIGJhc2ljIGFwcHJvYWNoIGlzIHRvIGNhbGN1bGF0ZSB0aGUgZWRpdCBkaXN0YW5jZSBtYXRyaXggYW5kXG4gICAgICogY2hvb3NlIHRoZSBzaG9ydGVzdCBwYXRoIHRocm91Z2ggaXQuXG4gICAgICpcbiAgICAgKiBDb21wbGV4aXR5OiBPKGwgKiBwKVxuICAgICAqICAgbDogVGhlIGxlbmd0aCBvZiB0aGUgY3VycmVudCBhcnJheVxuICAgICAqICAgcDogVGhlIGxlbmd0aCBvZiB0aGUgb2xkIGFycmF5XG4gICAgICovXG4gICAgY2FsY1NwbGljZXM6IGZ1bmN0aW9uKGN1cnJlbnQsIGN1cnJlbnRTdGFydCwgY3VycmVudEVuZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkLCBvbGRTdGFydCwgb2xkRW5kKSB7XG4gICAgICB2YXIgcHJlZml4Q291bnQgPSAwO1xuICAgICAgdmFyIHN1ZmZpeENvdW50ID0gMDtcblxuICAgICAgdmFyIG1pbkxlbmd0aCA9IE1hdGgubWluKGN1cnJlbnRFbmQgLSBjdXJyZW50U3RhcnQsIG9sZEVuZCAtIG9sZFN0YXJ0KTtcbiAgICAgIGlmIChjdXJyZW50U3RhcnQgPT0gMCAmJiBvbGRTdGFydCA9PSAwKVxuICAgICAgICBwcmVmaXhDb3VudCA9IHRoaXMuc2hhcmVkUHJlZml4KGN1cnJlbnQsIG9sZCwgbWluTGVuZ3RoKTtcblxuICAgICAgaWYgKGN1cnJlbnRFbmQgPT0gY3VycmVudC5sZW5ndGggJiYgb2xkRW5kID09IG9sZC5sZW5ndGgpXG4gICAgICAgIHN1ZmZpeENvdW50ID0gdGhpcy5zaGFyZWRTdWZmaXgoY3VycmVudCwgb2xkLCBtaW5MZW5ndGggLSBwcmVmaXhDb3VudCk7XG5cbiAgICAgIGN1cnJlbnRTdGFydCArPSBwcmVmaXhDb3VudDtcbiAgICAgIG9sZFN0YXJ0ICs9IHByZWZpeENvdW50O1xuICAgICAgY3VycmVudEVuZCAtPSBzdWZmaXhDb3VudDtcbiAgICAgIG9sZEVuZCAtPSBzdWZmaXhDb3VudDtcblxuICAgICAgaWYgKGN1cnJlbnRFbmQgLSBjdXJyZW50U3RhcnQgPT0gMCAmJiBvbGRFbmQgLSBvbGRTdGFydCA9PSAwKVxuICAgICAgICByZXR1cm4gW107XG5cbiAgICAgIGlmIChjdXJyZW50U3RhcnQgPT0gY3VycmVudEVuZCkge1xuICAgICAgICB2YXIgc3BsaWNlID0gbmV3U3BsaWNlKGN1cnJlbnRTdGFydCwgW10sIDApO1xuICAgICAgICB3aGlsZSAob2xkU3RhcnQgPCBvbGRFbmQpXG4gICAgICAgICAgc3BsaWNlLnJlbW92ZWQucHVzaChvbGRbb2xkU3RhcnQrK10pO1xuXG4gICAgICAgIHJldHVybiBbIHNwbGljZSBdO1xuICAgICAgfSBlbHNlIGlmIChvbGRTdGFydCA9PSBvbGRFbmQpXG4gICAgICAgIHJldHVybiBbIG5ld1NwbGljZShjdXJyZW50U3RhcnQsIFtdLCBjdXJyZW50RW5kIC0gY3VycmVudFN0YXJ0KSBdO1xuXG4gICAgICB2YXIgb3BzID0gdGhpcy5zcGxpY2VPcGVyYXRpb25zRnJvbUVkaXREaXN0YW5jZXMoXG4gICAgICAgICAgdGhpcy5jYWxjRWRpdERpc3RhbmNlcyhjdXJyZW50LCBjdXJyZW50U3RhcnQsIGN1cnJlbnRFbmQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGQsIG9sZFN0YXJ0LCBvbGRFbmQpKTtcblxuICAgICAgdmFyIHNwbGljZSA9IHVuZGVmaW5lZDtcbiAgICAgIHZhciBzcGxpY2VzID0gW107XG4gICAgICB2YXIgaW5kZXggPSBjdXJyZW50U3RhcnQ7XG4gICAgICB2YXIgb2xkSW5kZXggPSBvbGRTdGFydDtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHN3aXRjaChvcHNbaV0pIHtcbiAgICAgICAgICBjYXNlIEVESVRfTEVBVkU6XG4gICAgICAgICAgICBpZiAoc3BsaWNlKSB7XG4gICAgICAgICAgICAgIHNwbGljZXMucHVzaChzcGxpY2UpO1xuICAgICAgICAgICAgICBzcGxpY2UgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGluZGV4Kys7XG4gICAgICAgICAgICBvbGRJbmRleCsrO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSBFRElUX1VQREFURTpcbiAgICAgICAgICAgIGlmICghc3BsaWNlKVxuICAgICAgICAgICAgICBzcGxpY2UgPSBuZXdTcGxpY2UoaW5kZXgsIFtdLCAwKTtcblxuICAgICAgICAgICAgc3BsaWNlLmFkZGVkQ291bnQrKztcbiAgICAgICAgICAgIGluZGV4Kys7XG5cbiAgICAgICAgICAgIHNwbGljZS5yZW1vdmVkLnB1c2gob2xkW29sZEluZGV4XSk7XG4gICAgICAgICAgICBvbGRJbmRleCsrO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSBFRElUX0FERDpcbiAgICAgICAgICAgIGlmICghc3BsaWNlKVxuICAgICAgICAgICAgICBzcGxpY2UgPSBuZXdTcGxpY2UoaW5kZXgsIFtdLCAwKTtcblxuICAgICAgICAgICAgc3BsaWNlLmFkZGVkQ291bnQrKztcbiAgICAgICAgICAgIGluZGV4Kys7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIEVESVRfREVMRVRFOlxuICAgICAgICAgICAgaWYgKCFzcGxpY2UpXG4gICAgICAgICAgICAgIHNwbGljZSA9IG5ld1NwbGljZShpbmRleCwgW10sIDApO1xuXG4gICAgICAgICAgICBzcGxpY2UucmVtb3ZlZC5wdXNoKG9sZFtvbGRJbmRleF0pO1xuICAgICAgICAgICAgb2xkSW5kZXgrKztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChzcGxpY2UpIHtcbiAgICAgICAgc3BsaWNlcy5wdXNoKHNwbGljZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gc3BsaWNlcztcbiAgICB9LFxuXG4gICAgc2hhcmVkUHJlZml4OiBmdW5jdGlvbihjdXJyZW50LCBvbGQsIHNlYXJjaExlbmd0aCkge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzZWFyY2hMZW5ndGg7IGkrKylcbiAgICAgICAgaWYgKCF0aGlzLmVxdWFscyhjdXJyZW50W2ldLCBvbGRbaV0pKVxuICAgICAgICAgIHJldHVybiBpO1xuICAgICAgcmV0dXJuIHNlYXJjaExlbmd0aDtcbiAgICB9LFxuXG4gICAgc2hhcmVkU3VmZml4OiBmdW5jdGlvbihjdXJyZW50LCBvbGQsIHNlYXJjaExlbmd0aCkge1xuICAgICAgdmFyIGluZGV4MSA9IGN1cnJlbnQubGVuZ3RoO1xuICAgICAgdmFyIGluZGV4MiA9IG9sZC5sZW5ndGg7XG4gICAgICB2YXIgY291bnQgPSAwO1xuICAgICAgd2hpbGUgKGNvdW50IDwgc2VhcmNoTGVuZ3RoICYmIHRoaXMuZXF1YWxzKGN1cnJlbnRbLS1pbmRleDFdLCBvbGRbLS1pbmRleDJdKSlcbiAgICAgICAgY291bnQrKztcblxuICAgICAgcmV0dXJuIGNvdW50O1xuICAgIH0sXG5cbiAgICBjYWxjdWxhdGVTcGxpY2VzOiBmdW5jdGlvbihjdXJyZW50LCBwcmV2aW91cykge1xuICAgICAgcmV0dXJuIHRoaXMuY2FsY1NwbGljZXMoY3VycmVudCwgMCwgY3VycmVudC5sZW5ndGgsIHByZXZpb3VzLCAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJldmlvdXMubGVuZ3RoKTtcbiAgICB9LFxuXG4gICAgZXF1YWxzOiBmdW5jdGlvbihjdXJyZW50VmFsdWUsIHByZXZpb3VzVmFsdWUpIHtcbiAgICAgIHJldHVybiBjdXJyZW50VmFsdWUgPT09IHByZXZpb3VzVmFsdWU7XG4gICAgfVxuICB9O1xuXG4gIHZhciBhcnJheVNwbGljZSA9IG5ldyBBcnJheVNwbGljZSgpO1xuXG4gIGZ1bmN0aW9uIGNhbGNTcGxpY2VzKGN1cnJlbnQsIGN1cnJlbnRTdGFydCwgY3VycmVudEVuZCxcbiAgICAgICAgICAgICAgICAgICAgICAgb2xkLCBvbGRTdGFydCwgb2xkRW5kKSB7XG4gICAgcmV0dXJuIGFycmF5U3BsaWNlLmNhbGNTcGxpY2VzKGN1cnJlbnQsIGN1cnJlbnRTdGFydCwgY3VycmVudEVuZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkLCBvbGRTdGFydCwgb2xkRW5kKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGludGVyc2VjdChzdGFydDEsIGVuZDEsIHN0YXJ0MiwgZW5kMikge1xuICAgIC8vIERpc2pvaW50XG4gICAgaWYgKGVuZDEgPCBzdGFydDIgfHwgZW5kMiA8IHN0YXJ0MSlcbiAgICAgIHJldHVybiAtMTtcblxuICAgIC8vIEFkamFjZW50XG4gICAgaWYgKGVuZDEgPT0gc3RhcnQyIHx8IGVuZDIgPT0gc3RhcnQxKVxuICAgICAgcmV0dXJuIDA7XG5cbiAgICAvLyBOb24temVybyBpbnRlcnNlY3QsIHNwYW4xIGZpcnN0XG4gICAgaWYgKHN0YXJ0MSA8IHN0YXJ0Mikge1xuICAgICAgaWYgKGVuZDEgPCBlbmQyKVxuICAgICAgICByZXR1cm4gZW5kMSAtIHN0YXJ0MjsgLy8gT3ZlcmxhcFxuICAgICAgZWxzZVxuICAgICAgICByZXR1cm4gZW5kMiAtIHN0YXJ0MjsgLy8gQ29udGFpbmVkXG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIE5vbi16ZXJvIGludGVyc2VjdCwgc3BhbjIgZmlyc3RcbiAgICAgIGlmIChlbmQyIDwgZW5kMSlcbiAgICAgICAgcmV0dXJuIGVuZDIgLSBzdGFydDE7IC8vIE92ZXJsYXBcbiAgICAgIGVsc2VcbiAgICAgICAgcmV0dXJuIGVuZDEgLSBzdGFydDE7IC8vIENvbnRhaW5lZFxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG1lcmdlU3BsaWNlKHNwbGljZXMsIGluZGV4LCByZW1vdmVkLCBhZGRlZENvdW50KSB7XG5cbiAgICB2YXIgc3BsaWNlID0gbmV3U3BsaWNlKGluZGV4LCByZW1vdmVkLCBhZGRlZENvdW50KTtcblxuICAgIHZhciBpbnNlcnRlZCA9IGZhbHNlO1xuICAgIHZhciBpbnNlcnRpb25PZmZzZXQgPSAwO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzcGxpY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgY3VycmVudCA9IHNwbGljZXNbaV07XG4gICAgICBjdXJyZW50LmluZGV4ICs9IGluc2VydGlvbk9mZnNldDtcblxuICAgICAgaWYgKGluc2VydGVkKVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgdmFyIGludGVyc2VjdENvdW50ID0gaW50ZXJzZWN0KHNwbGljZS5pbmRleCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcGxpY2UuaW5kZXggKyBzcGxpY2UucmVtb3ZlZC5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudC5pbmRleCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50LmluZGV4ICsgY3VycmVudC5hZGRlZENvdW50KTtcblxuICAgICAgaWYgKGludGVyc2VjdENvdW50ID49IDApIHtcbiAgICAgICAgLy8gTWVyZ2UgdGhlIHR3byBzcGxpY2VzXG5cbiAgICAgICAgc3BsaWNlcy5zcGxpY2UoaSwgMSk7XG4gICAgICAgIGktLTtcblxuICAgICAgICBpbnNlcnRpb25PZmZzZXQgLT0gY3VycmVudC5hZGRlZENvdW50IC0gY3VycmVudC5yZW1vdmVkLmxlbmd0aDtcblxuICAgICAgICBzcGxpY2UuYWRkZWRDb3VudCArPSBjdXJyZW50LmFkZGVkQ291bnQgLSBpbnRlcnNlY3RDb3VudDtcbiAgICAgICAgdmFyIGRlbGV0ZUNvdW50ID0gc3BsaWNlLnJlbW92ZWQubGVuZ3RoICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudC5yZW1vdmVkLmxlbmd0aCAtIGludGVyc2VjdENvdW50O1xuXG4gICAgICAgIGlmICghc3BsaWNlLmFkZGVkQ291bnQgJiYgIWRlbGV0ZUNvdW50KSB7XG4gICAgICAgICAgLy8gbWVyZ2VkIHNwbGljZSBpcyBhIG5vb3AuIGRpc2NhcmQuXG4gICAgICAgICAgaW5zZXJ0ZWQgPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhciByZW1vdmVkID0gY3VycmVudC5yZW1vdmVkO1xuXG4gICAgICAgICAgaWYgKHNwbGljZS5pbmRleCA8IGN1cnJlbnQuaW5kZXgpIHtcbiAgICAgICAgICAgIC8vIHNvbWUgcHJlZml4IG9mIHNwbGljZS5yZW1vdmVkIGlzIHByZXBlbmRlZCB0byBjdXJyZW50LnJlbW92ZWQuXG4gICAgICAgICAgICB2YXIgcHJlcGVuZCA9IHNwbGljZS5yZW1vdmVkLnNsaWNlKDAsIGN1cnJlbnQuaW5kZXggLSBzcGxpY2UuaW5kZXgpO1xuICAgICAgICAgICAgQXJyYXkucHJvdG90eXBlLnB1c2guYXBwbHkocHJlcGVuZCwgcmVtb3ZlZCk7XG4gICAgICAgICAgICByZW1vdmVkID0gcHJlcGVuZDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoc3BsaWNlLmluZGV4ICsgc3BsaWNlLnJlbW92ZWQubGVuZ3RoID4gY3VycmVudC5pbmRleCArIGN1cnJlbnQuYWRkZWRDb3VudCkge1xuICAgICAgICAgICAgLy8gc29tZSBzdWZmaXggb2Ygc3BsaWNlLnJlbW92ZWQgaXMgYXBwZW5kZWQgdG8gY3VycmVudC5yZW1vdmVkLlxuICAgICAgICAgICAgdmFyIGFwcGVuZCA9IHNwbGljZS5yZW1vdmVkLnNsaWNlKGN1cnJlbnQuaW5kZXggKyBjdXJyZW50LmFkZGVkQ291bnQgLSBzcGxpY2UuaW5kZXgpO1xuICAgICAgICAgICAgQXJyYXkucHJvdG90eXBlLnB1c2guYXBwbHkocmVtb3ZlZCwgYXBwZW5kKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBzcGxpY2UucmVtb3ZlZCA9IHJlbW92ZWQ7XG4gICAgICAgICAgaWYgKGN1cnJlbnQuaW5kZXggPCBzcGxpY2UuaW5kZXgpIHtcbiAgICAgICAgICAgIHNwbGljZS5pbmRleCA9IGN1cnJlbnQuaW5kZXg7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHNwbGljZS5pbmRleCA8IGN1cnJlbnQuaW5kZXgpIHtcbiAgICAgICAgLy8gSW5zZXJ0IHNwbGljZSBoZXJlLlxuXG4gICAgICAgIGluc2VydGVkID0gdHJ1ZTtcblxuICAgICAgICBzcGxpY2VzLnNwbGljZShpLCAwLCBzcGxpY2UpO1xuICAgICAgICBpKys7XG5cbiAgICAgICAgdmFyIG9mZnNldCA9IHNwbGljZS5hZGRlZENvdW50IC0gc3BsaWNlLnJlbW92ZWQubGVuZ3RoXG4gICAgICAgIGN1cnJlbnQuaW5kZXggKz0gb2Zmc2V0O1xuICAgICAgICBpbnNlcnRpb25PZmZzZXQgKz0gb2Zmc2V0O1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghaW5zZXJ0ZWQpXG4gICAgICBzcGxpY2VzLnB1c2goc3BsaWNlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZUluaXRpYWxTcGxpY2VzKGFycmF5LCBjaGFuZ2VSZWNvcmRzKSB7XG4gICAgdmFyIHNwbGljZXMgPSBbXTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hhbmdlUmVjb3Jkcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHJlY29yZCA9IGNoYW5nZVJlY29yZHNbaV07XG4gICAgICBzd2l0Y2gocmVjb3JkLnR5cGUpIHtcbiAgICAgICAgY2FzZSAnc3BsaWNlJzpcbiAgICAgICAgICBtZXJnZVNwbGljZShzcGxpY2VzLCByZWNvcmQuaW5kZXgsIHJlY29yZC5yZW1vdmVkLnNsaWNlKCksIHJlY29yZC5hZGRlZENvdW50KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnYWRkJzpcbiAgICAgICAgY2FzZSAndXBkYXRlJzpcbiAgICAgICAgY2FzZSAnZGVsZXRlJzpcbiAgICAgICAgICBpZiAoIWlzSW5kZXgocmVjb3JkLm5hbWUpKVxuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgdmFyIGluZGV4ID0gdG9OdW1iZXIocmVjb3JkLm5hbWUpO1xuICAgICAgICAgIGlmIChpbmRleCA8IDApXG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICBtZXJnZVNwbGljZShzcGxpY2VzLCBpbmRleCwgW3JlY29yZC5vbGRWYWx1ZV0sIDEpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1VuZXhwZWN0ZWQgcmVjb3JkIHR5cGU6ICcgKyBKU09OLnN0cmluZ2lmeShyZWNvcmQpKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gc3BsaWNlcztcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb2plY3RBcnJheVNwbGljZXMoYXJyYXksIGNoYW5nZVJlY29yZHMpIHtcbiAgICB2YXIgc3BsaWNlcyA9IFtdO1xuXG4gICAgY3JlYXRlSW5pdGlhbFNwbGljZXMoYXJyYXksIGNoYW5nZVJlY29yZHMpLmZvckVhY2goZnVuY3Rpb24oc3BsaWNlKSB7XG4gICAgICBpZiAoc3BsaWNlLmFkZGVkQ291bnQgPT0gMSAmJiBzcGxpY2UucmVtb3ZlZC5sZW5ndGggPT0gMSkge1xuICAgICAgICBpZiAoc3BsaWNlLnJlbW92ZWRbMF0gIT09IGFycmF5W3NwbGljZS5pbmRleF0pXG4gICAgICAgICAgc3BsaWNlcy5wdXNoKHNwbGljZSk7XG5cbiAgICAgICAgcmV0dXJuXG4gICAgICB9O1xuXG4gICAgICBzcGxpY2VzID0gc3BsaWNlcy5jb25jYXQoY2FsY1NwbGljZXMoYXJyYXksIHNwbGljZS5pbmRleCwgc3BsaWNlLmluZGV4ICsgc3BsaWNlLmFkZGVkQ291bnQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3BsaWNlLnJlbW92ZWQsIDAsIHNwbGljZS5yZW1vdmVkLmxlbmd0aCkpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHNwbGljZXM7XG4gIH1cblxuIC8vIEV4cG9ydCB0aGUgb2JzZXJ2ZS1qcyBvYmplY3QgZm9yICoqTm9kZS5qcyoqLCB3aXRoXG4vLyBiYWNrd2FyZHMtY29tcGF0aWJpbGl0eSBmb3IgdGhlIG9sZCBgcmVxdWlyZSgpYCBBUEkuIElmIHdlJ3JlIGluXG4vLyB0aGUgYnJvd3NlciwgZXhwb3J0IGFzIGEgZ2xvYmFsIG9iamVjdC5cbnZhciBleHBvc2UgPSBnbG9iYWw7XG5pZiAodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcbmV4cG9zZSA9IGV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cztcbn1cbmV4cG9zZSA9IGV4cG9ydHM7XG59XG5leHBvc2UuT2JzZXJ2ZXIgPSBPYnNlcnZlcjtcbmV4cG9zZS5PYnNlcnZlci5ydW5FT01fID0gcnVuRU9NO1xuZXhwb3NlLk9ic2VydmVyLm9ic2VydmVyU2VudGluZWxfID0gb2JzZXJ2ZXJTZW50aW5lbDsgLy8gZm9yIHRlc3RpbmcuXG5leHBvc2UuT2JzZXJ2ZXIuaGFzT2JqZWN0T2JzZXJ2ZSA9IGhhc09ic2VydmU7XG5leHBvc2UuQXJyYXlPYnNlcnZlciA9IEFycmF5T2JzZXJ2ZXI7XG5leHBvc2UuQXJyYXlPYnNlcnZlci5jYWxjdWxhdGVTcGxpY2VzID0gZnVuY3Rpb24oY3VycmVudCwgcHJldmlvdXMpIHtcbnJldHVybiBhcnJheVNwbGljZS5jYWxjdWxhdGVTcGxpY2VzKGN1cnJlbnQsIHByZXZpb3VzKTtcbn07XG5leHBvc2UuUGxhdGZvcm0gPSBnbG9iYWwuUGxhdGZvcm07XG5leHBvc2UuQXJyYXlTcGxpY2UgPSBBcnJheVNwbGljZTtcbmV4cG9zZS5PYmplY3RPYnNlcnZlciA9IE9iamVjdE9ic2VydmVyO1xufSkodHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcgJiYgZ2xvYmFsICYmIHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZSA/IGdsb2JhbCA6IHRoaXMgfHwgd2luZG93KTtcblxufSkuY2FsbCh0aGlzLHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pIl19
