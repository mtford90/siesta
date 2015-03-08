(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * Solves the common problem of maintaining the order of a set of a models and querying on that order.
 *
 * The same as ReactiveQuery but enables manual reordering of models and maintains an index field.
 */

(function() {

  var ReactiveQuery = require('./ReactiveQuery'),
      log = require('./log')('query'),
      util = require('./util'),
      error = require('./error'),
      modelEvents = require('./modelEvents'),
      InternalSiestaError = error.InternalSiestaError,
      constructQuerySet = require('./QuerySet'),
      _ = util._;

  function ArrangedReactiveQuery(query) {
    ReactiveQuery.call(this, query);
    this.indexAttribute = 'index';
  }

  ArrangedReactiveQuery.prototype = Object.create(ReactiveQuery.prototype);

  _.extend(ArrangedReactiveQuery.prototype, {
    _refreshIndexes: function() {
      var results = this.results,
          indexAttribute = this.indexAttribute;
      if (!results) throw new InternalSiestaError('ArrangedReactiveQuery must be initialised');
      for (var i = 0; i < results.length; i++) {
        var modelInstance = results[i];
        modelInstance[indexAttribute] = i;
      }
    },
    _mergeIndexes: function() {
      var results = this.results,
          newResults = [],
          outOfBounds = [],
          unindexed = [];
      for (var i = 0; i < results.length; i++) {
        var res = results[i],
            storedIndex = res[this.indexAttribute];
        if (storedIndex == undefined) { // null or undefined
          unindexed.push(res);
        }
        else if (storedIndex > results.length) {
          outOfBounds.push(res);
        }
        else {
          // Handle duplicate indexes
          if (!newResults[storedIndex]) {
            newResults[storedIndex] = res;
          }
          else {
            unindexed.push(res);
          }
        }
      }
      outOfBounds = _.sortBy(outOfBounds, function(x) {
        return x[this.indexAttribute];
      }.bind(this));
      // Shift the index of all models with indexes out of bounds into the correct range.
      for (i = 0; i < outOfBounds.length; i++) {
        res = outOfBounds[i];
        var resultsIndex = this.results.length - outOfBounds.length + i;
        res[this.indexAttribute] = resultsIndex;
        newResults[resultsIndex] = res;
      }
      unindexed = this._query._sortResults(unindexed);
      var n = 0;
      while (unindexed.length) {
        res = unindexed.shift();
        while (newResults[n]) {
          n++;
        }
        newResults[n] = res;
        res[this.indexAttribute] = n;
      }

      this.results = constructQuerySet(newResults, this.model);
    },
    init: function(cb) {
      return util.promise(cb, function(cb) {
        ReactiveQuery.prototype.init.call(this, function(err) {
          if (!err) {
            if (!this.model.hasAttributeNamed(this.indexAttribute)) {
              err = error('Model "' + this.model.name + '" does not have an attribute named "' + this.indexAttribute + '"');
            }
            else {
              this._mergeIndexes();
              this._query.clearOrdering();
            }
          }
          cb(err, err ? null : this.results);
        }.bind(this));
      }.bind(this));
    },
    _handleNotif: function(n) {
      // We don't want to keep executing the query each time the index event fires as we're changing the index ourselves
      if (n.field != this.indexAttribute) {
        ReactiveQuery.prototype._handleNotif.call(this, n);
        this._refreshIndexes();
      }
    },
    validateIndex: function(idx) {
      var maxIndex = this.results.length - 1,
          minIndex = 0;
      if (!(idx >= minIndex && idx <= maxIndex)) {
        throw new Error('Index ' + idx.toString() + ' is out of bounds');
      }
    },
    swapObjectsAtIndexes: function(from, to) {
      //noinspection UnnecessaryLocalVariableJS
      this.validateIndex(from);
      this.validateIndex(to);
      var fromModel = this.results[from],
          toModel = this.results[to];
      if (!fromModel) {
        throw new Error('No model at index "' + from.toString() + '"');
      }
      if (!toModel) {
        throw new Error('No model at index "' + to.toString() + '"');
      }
      this.results[to] = fromModel;
      this.results[from] = toModel;
      fromModel[this.indexAttribute] = to;
      toModel[this.indexAttribute] = from;
    },
    swapObjects: function(obj1, obj2) {
      var fromIdx = this.results.indexOf(obj1),
          toIdx = this.results.indexOf(obj2);
      this.swapObjectsAtIndexes(fromIdx, toIdx);
    },
    move: function(from, to) {
      this.validateIndex(from);
      this.validateIndex(to);
      var results = this.results.mutableCopy();
      (function(oldIndex, newIndex) {
        if (newIndex >= this.length) {
          var k = newIndex - this.length;
          while ((k--) + 1) {
            this.push(undefined);
          }
        }
      }).call(results, from, to);
      var removed = results.splice(from, 1)[0];
      this.results = results.asModelQuerySet(this.model);
      this.emit(modelEvents.ModelEventType.Splice, {
        index: from,
        removed: [removed],
        type: modelEvents.ModelEventType.Splice,
        obj: this,
        field: 'results'
      });
      results.splice(to, 0, removed);
      this.results = results.asModelQuerySet(this.model);
      this.emit(modelEvents.ModelEventType.Splice, {
        index: to,
        added: [removed],
        type: modelEvents.ModelEventType.Splice,
        obj: this,
        field: 'results'
      });
      this._refreshIndexes();
    }
  });

  module.exports = ArrangedReactiveQuery;
})();
},{"./QuerySet":8,"./ReactiveQuery":9,"./error":15,"./log":19,"./modelEvents":22,"./util":25}],2:[function(require,module,exports){
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
},{"argsarray":28}],3:[function(require,module,exports){
(function () {
    /**
     * @module relationships
     */

    var RelationshipProxy = require('./RelationshipProxy'),
        Store = require('./store'),
        util = require('./util'),
        _ = util._,
        InternalSiestaError = require('./error').InternalSiestaError,
        modelEvents = require('./modelEvents'),
        events = require('./events'),
        wrapArrayForAttributes = events.wrapArray,
        SiestaModel = require('./ModelInstance'),
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
},{"../vendor/observe-js/src/observe":54,"./ModelInstance":4,"./RelationshipProxy":10,"./error":15,"./events":16,"./modelEvents":22,"./store":23,"./util":25}],4:[function(require,module,exports){
(function() {
  var log = require('./log'),
    util = require('./util'),
    _ = util._,
    error = require('./error'),
    InternalSiestaError = error.InternalSiestaError,
    modelEvents = require('./modelEvents'),
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

  module.exports = ModelInstance;
})();
},{"./cache":12,"./error":15,"./events":16,"./log":19,"./modelEvents":22,"./util":25}],5:[function(require,module,exports){
(function () {
    var RelationshipProxy = require('./RelationshipProxy'),
        Store = require('./store'),
        util = require('./util'),
        _ = util._,
        InternalSiestaError = require('./error').InternalSiestaError,
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
},{"../vendor/observe-js/src/observe":54,"./RelationshipProxy":10,"./error":15,"./events":16,"./modelEvents":22,"./store":23,"./util":25}],6:[function(require,module,exports){
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
},{"./ModelInstance":4,"./RelationshipProxy":10,"./util":25}],7:[function(require,module,exports){
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
        contains: function(opts) {
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
},{"./ModelInstance":4,"./QuerySet":8,"./cache":12,"./error":15,"./log":19,"./util":25}],8:[function(require,module,exports){
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
},{"./ModelInstance":4,"./error":15,"./util":25}],9:[function(require,module,exports){
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
        once: this.once.bind(this)
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
},{"./Chain":2,"./Query":7,"./QuerySet":8,"./error":15,"./events":16,"./log":19,"./modelEvents":22,"./util":25,"events":30}],10:[function(require,module,exports){
/**
 * Base functionality for relationships.
 * @module relationships
 */
(function() {

  var InternalSiestaError = require('./error').InternalSiestaError,
    Store = require('./store'),
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
},{"../vendor/observe-js/src/observe":54,"./Query":7,"./cache":12,"./error":15,"./events":16,"./log":19,"./modelEvents":22,"./store":23,"./util":25}],11:[function(require,module,exports){
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
   * @param  {String} localId
   * @return {ModelInstance}
   */
  function getViaLocalId(localId) {
    var obj = localCacheById[localId];
    if (obj) {
      log('Local cache hit: ' + obj._dump(true));
    } else {
      log('Local cache miss: ' + localId);
    }
    return obj;
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
   * @param  {String} remoteId
   * @param  {Object} opts
   * @return {ModelInstance}
   */
  function getViaRemoteId(remoteId, opts) {
    var type = opts.model.name;
    var collectionName = opts.model.collectionName;
    var collectionCache = remoteCache[collectionName];
    if (collectionCache) {
      var typeCache = remoteCache[collectionName][type];
      if (typeCache) {
        var obj = typeCache[remoteId];
        if (obj) {
          log('Remote cache hit: ' + obj._dump(true));
        } else {
          log('Remote cache miss: ' + remoteId);
        }
        return obj;
      }
    }
    log('Remote cache miss: ' + remoteId);
    return null;
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
            log('Remote cache now looks like: ' + remoteDump(true))
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

  /**
   * Dump the remote id cache
   * @param  {boolean} asJson Whether or not to apply JSON.stringify
   * @return {String|Object}
   */
  function remoteDump(asJson) {
    var dumpedRestCache = {};
    for (var coll in remoteCache) {
      if (remoteCache.hasOwnProperty(coll)) {
        var dumpedCollCache = {};
        dumpedRestCache[coll] = dumpedCollCache;
        var collCache = remoteCache[coll];
        for (var model in collCache) {
          if (collCache.hasOwnProperty(model)) {
            var dumpedModelCache = {};
            dumpedCollCache[model] = dumpedModelCache;
            var modelCache = collCache[model];
            for (var remoteId in modelCache) {
              if (modelCache.hasOwnProperty(remoteId)) {
                if (modelCache[remoteId]) {
                  dumpedModelCache[remoteId] = modelCache[remoteId]._dump();
                }
              }
            }
          }
        }
      }
    }
    return asJson ? util.prettyPrint((dumpedRestCache, null, 4
  )) :
    dumpedRestCache;
  }

  /**
   * Dump the local id (_id) cache
   * @param  {boolean} asJson Whether or not to apply JSON.stringify
   * @return {String|Object}
   */
  function localDump(asJson) {
    var dumpedIdCache = {};
    for (var id in localCacheById) {
      if (localCacheById.hasOwnProperty(id)) {
        dumpedIdCache[id] = localCacheById[id]._dump()
      }
    }
    return asJson ? util.prettyPrint((dumpedIdCache, null, 4
  )) :
    dumpedIdCache;
  }

  /**
   * Dump to the cache.
   * @param  {boolean} asJson Whether or not to apply JSON.stringify
   * @return {String|Object}
   */
  function dump(asJson) {
    var dumped = {
      localCache: localDump(),
      remoteCache: remoteDump()
    };
    return asJson ? util.prettyPrint((dumped, null, 4
  )) :
    dumped;
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
      log('Local cache insert: ' + obj._dumpString());
      if (!localCacheById[localId]) {
        localCacheById[localId] = obj;
        log('Local cache now looks like: ' + localDump(true));
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
  exports._dump = dump;
  exports.contains = contains;
  exports.remove = remove;
  exports.getSingleton = getSingleton;
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
    util.extendFromOpts(this, opts, {
      /**
       * The URL of the API e.g. http://api.github.com
       * @type {string}
       */
      baseURL: ''
    });

    _.extend(this, {
      name: name,
      _rawModels: {},
      _models: {},
      _opts: opts,
      /**
       * Set to true if installation has succeeded. You cannot use the collectio
       * @type {boolean}
       */
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
    events.ProxyEventEmitter.call(this, this.name);
  }

  Collection.prototype = Object.create(events.ProxyEventEmitter.prototype);

  _.extend(Collection.prototype, {
    /**
     * Ensure mappings are installed.
     * @param [cb]
     * @class Collection
     */
    install: function(cb) {
      return util.promise(cb, function(cb) {
        var self = this;
        if (!this.installed) {
          var modelsToInstall = [];
          for (var name in this._models) {
            if (this._models.hasOwnProperty(name)) {
              var model = this._models[name];
              modelsToInstall.push(model);
            }
          }
          log('There are ' + modelsToInstall.length.toString() + ' mappings to install');
          if (modelsToInstall.length) {
            var tasks = _.map(modelsToInstall, function(m) {
              return _.bind(m.install, m);
            });

            util.async.parallel(tasks, function(err) {
              if (err) {

                log('Failed to install collection', err);
                self._finaliseInstallation(err, cb);
              }
              else {
                self.installed = true;
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
                }

                if (errors.length == 1) {
                  err = errors[0];
                } else if (errors.length) {
                  err = errors;
                }

                self._finaliseInstallation(err, cb);
              }
            });

          } else {
            self._finaliseInstallation(null, cb);
          }
        } else {
          throw new InternalSiestaError('Collection "' + this.name + '" has already been installed');
        }
      }.bind(this));
    },

    /**
     * Mark this collection as installed, and place the collection on the global Siesta object.
     * @param  {Object}   err
     * @param  {Function} callback
     * @class Collection
     */
    _finaliseInstallation: function(err, callback) {
      if (err) err = error('Errors were encountered whilst setting up the collection', {errors: err});
      if (!err) {
        this.installed = true;
        var index = require('./index');
        index[this.name] = this;
      }
      callback(err);
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
     * @param {String|Object} optsOrName An options object or the name of the mapping. Must pass options as second param if specify name.
     * @param {Object} opts Options if name already specified.
     * @return {Model}
     * @class Collection
     */
    model: function(op) {
      var acceptModels = !this.installed;
      if (acceptModels) {
        var self = this;
        if (arguments.length) {
          if (arguments.length == 1) {
            if (util.isArray(arguments[0])) {
              return _.map(arguments[0], function(m) {
                return self._model(m.name, m);
              });
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
                return self._model(m.name, m);
              });
            }
          }
        }
      }
      else {
        throw Error('Cannot create new models once the object graph is established!');
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
      obj.baseURL = this.baseURL;
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
},{"../vendor/observe-js/src/observe":54,"./cache":12,"./collectionRegistry":14,"./error":15,"./events":16,"./index":17,"./log":19,"./model":21,"./util":25,"extend":34}],14:[function(require,module,exports){
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
      _ = util._,
      modelEvents = require('./modelEvents'),
      Chain = require('./Chain');

  var events = new EventEmitter();
  events.setMaxListeners(100);

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
      events.on(this.event, fn);
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
              events.removeListener(event, fn);
              _fn(e);
            }
          }
          else {
            _fn(e);
          }
        }
      }
      if (type) return events.on(event, fn);
      else return events.once(event, fn);
    },
    _removeListener: function(fn, type) {
      if (type) {
        var listeners = this.listeners[type],
            idx = listeners.indexOf(fn);
        listeners.splice(idx, 1);
      }
      return events.removeListener(this.event, fn);
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
      events.emit.call(events, this.event, payload);
    },
    _removeAllListeners: function(type) {
      (this.listeners[type] || []).forEach(function(fn) {
        events.removeListener(this.event, fn);
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

  _.extend(events, {
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

  module.exports = events;
})();
},{"../vendor/observe-js/src/observe":54,"./Chain":2,"./modelEvents":22,"./util":25,"argsarray":28,"events":30}],17:[function(require,module,exports){
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
      Store: require('./store'),
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
              return CollectionRegistry[n].install.bind(CollectionRegistry[n]);
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
},{"../storage":53,"../vendor/observe-js/src/observe":54,"./ManyToManyProxy":3,"./ModelInstance":4,"./OneToManyProxy":5,"./OneToOneProxy":6,"./Query":7,"./QuerySet":8,"./ReactiveQuery":9,"./RelationshipProxy":10,"./RelationshipType":11,"./cache":12,"./collection":13,"./collectionRegistry":14,"./error":15,"./events":16,"./log":19,"./mappingOperation":20,"./model":21,"./modelEvents":22,"./store":23,"./util":25,"debug":31,"extend":34}],18:[function(require,module,exports){
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
    store = require('./store'),
    extend = require('extend'),
    modelEvents = require('./modelEvents'),
    wrapArray = require('./events').wrapArray,
    OneToManyProxy = require('./OneToManyProxy'),
    OneToOneProxy = require('./OneToOneProxy'),
    ManyToManyProxy = require('./ManyToManyProxy'),
    ReactiveQuery = require('./ReactiveQuery'),
    ArrangedReactiveQuery = require('./ArrangedReactiveQuery'),
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
      if (shouldRegisterChange) {
        modelEvents.emit({
          collection: this.model.collectionName,
          model: this.model.name,
          localId: modelInstance.localId,
          new: modelInstance,
          type: ModelEventType.New,
          obj: modelInstance
        });
      }
    },
    _installLocalId: function(modelInstance, data) {
      modelInstance.localId = this._getLocalId(data);
    },
    /**
     * Convert raw data into a ModelInstance
     * @returns {ModelInstance}
     */
    _instance: function(data, shouldRegisterChange) {
      if (this.model.installed) {
        var modelInstance = new ModelInstance(this.model);
        this._installLocalId(modelInstance, data);
        this._installAttributes(modelInstance, data);
        this._installMethods(modelInstance);
        this._installProperties(modelInstance);
        this._installRemoteId(modelInstance);
        this._installRelationships(modelInstance);
        this._registerInstance(modelInstance, shouldRegisterChange);
        return modelInstance;
      } else {
        throw new InternalSiestaError('Model must be fully installed before creating any models');
      }
    }
  };

  module.exports = function(model) {
    var factory = new ModelInstanceFactory(model);
    return factory._instance.bind(factory);
  }
})();
},{"./ArrangedReactiveQuery":1,"./ManyToManyProxy":3,"./ModelInstance":4,"./OneToManyProxy":5,"./OneToOneProxy":6,"./Query":7,"./ReactiveQuery":9,"./RelationshipType":11,"./cache":12,"./error":15,"./events":16,"./log":19,"./modelEvents":22,"./store":23,"./util":25,"extend":34}],19:[function(require,module,exports){
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
},{"argsarray":28,"debug":31}],20:[function(require,module,exports){
(function() {
  var Store = require('./store'),
    SiestaModel = require('./ModelInstance'),
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
              } else if (datum instanceof SiestaModel) { // We won't need to perform any mapping.
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
              if (localIdentifiers.length) {
                Store.getMultipleLocal(localIdentifiers, function(err, objects) {
                  if (!err) {
                    for (var i = 0; i < localIdentifiers.length; i++) {
                      var obj = objects[i];
                      var localId = localIdentifiers[i];
                      var lookup = localLookups[i];
                      if (!obj) {
                        // If there are multiple mapping operations going on, there may be
                        obj = cache.get({localId: localId});
                        if (!obj)
                          obj = self._instance({localId: localId}, !self.disableevents);
                        self.objects[lookup.index] = obj;
                      } else {
                        self.objects[lookup.index] = obj;
                      }
                    }
                  }
                  done(err);
                });
              } else {
                done();
              }
            },
            function(done) {
              var remoteIdentifiers = _.pluck(_.pluck(remoteLookups, 'datum'), self.model.id);
              if (remoteIdentifiers.length) {
                Store.getMultipleRemote(remoteIdentifiers, self.model, function(err, objects) {
                  if (!err) {
                    if (log.enabled) {
                      var results = {};
                      for (i = 0; i < objects.length; i++) {
                        results[remoteIdentifiers[i]] = objects[i] ? objects[i].localId : null;
                      }
                    }
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
                  }
                  done(err);
                });
              } else {
                done();
              }
            }
          ],
          cb);
      }.bind(this));
    },
    _lookupSingleton: function(cb) {
      return util.promise(cb, function(cb) {
        var self = this;
        // Pick a random _id from the array of data being mapped onto the singleton object. Note that they should
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
    },
    _instance: function() {
      var model = this.model,
        modelInstance = model._instance.apply(model, arguments);
      this._newObjects.push(modelInstance);
      return modelInstance;
    },
    start: function(done) {
      if (this.data.length) {
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
            var initTasks = _.reduce(self._newObjects, function(m, o) {
              var init = o.model.init;
              if (init) {
                var paramNames = util.paramNames(init);
                if (paramNames.length > 1) {
                  m.push(_.bind(init, o, fromStorage, done));
                }
                else {
                  init.call(o, fromStorage);
                }
              }
              return m;
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
    },
    getRelatedData: function(name) {
      var indexes = [];
      var relatedData = [];
      for (var i = 0; i < this.data.length; i++) {
        var datum = this.data[i];
        if (datum) {
          if (datum[name]) {
            indexes.push(i);
            relatedData.push(datum[name]);
          }
        }
      }
      return {
        indexes: indexes,
        relatedData: relatedData
      };
    },
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
    },
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
  });

  module.exports = MappingOperation;


})();
},{"./ModelInstance":4,"./cache":12,"./log":19,"./store":23,"./util":25}],21:[function(require,module,exports){
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
    store = require('./store'),
    argsarray = require('argsarray'),
    error = require('./error'),
    extend = require('extend'),
    modelEvents = require('./modelEvents'),
    events = require('./events'),
    OneToOneProxy = require('./OneToOneProxy'),
    ManyToManyProxy = require('./ManyToManyProxy'),
    ReactiveQuery = require('./ReactiveQuery'),
    instanceFactory = require('./instanceFactory'),
    ArrangedReactiveQuery = require('./ArrangedReactiveQuery'),
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
      parseAttribute: null,
      store: null
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

    if (this.store === undefined || this.store === null) {
      this.store = function() {
        return true;
      }
    }
    else if (this.store === false) {
      this.store = function() {
        return false;
      }
    }
    else if (this.store === true) {
      this.store = function() {
        return true;
      }
    }

    this.attributes = Model._processAttributes(this.attributes);

    this._instance = new instanceFactory(this);

    _.extend(this, {
      _installed: false,
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
          return self._installed && self._relationshipsInstalled && self._reverseRelationshipsInstalled;
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
     * Install relationships. Returns error in form of string if fails.
     * @return {String|null}
     */
    installRelationships: function() {
      if (!this._relationshipsInstalled) {
        var self = this,
          err = null;
        self._relationships = [];
        if (self._opts.relationships) {
          for (var name in self._opts.relationships) {
            if (self._opts.relationships.hasOwnProperty(name)) {
              var relationship = self._opts.relationships[name];
              // If a reverse relationship is installed beforehand, we do not want to process them.
              if (!relationship.isReverse) {
                log(this.name + ': configuring relationship ' + name, relationship);
                if (!(err = this._validateRelationshipType(relationship))) {
                  var modelName = relationship.model;
                  if (modelName) {
                    delete relationship.model;
                    var reverseModel;
                    if (modelName instanceof Model) {
                      reverseModel = modelName;
                    }
                    else {
                      log('reverseModelName', modelName);
                      if (!self.collection) throw new InternalSiestaError('Model must have collection');
                      var collection = self.collection;
                      if (!collection)    throw new InternalSiestaError('Collection ' + self.collectionName + ' not registered');
                      reverseModel = collection[modelName];
                    }
                    if (!reverseModel) {
                      var arr = modelName.split('.');
                      if (arr.length == 2) {
                        var collectionName = arr[0];
                        modelName = arr[1];
                        var otherCollection = CollectionRegistry[collectionName];
                        if (!otherCollection) return 'Collection with name "' + collectionName + '" does not exist.';
                        reverseModel = otherCollection[modelName];
                      }
                    }
                    log('reverseModel', reverseModel);
                    if (reverseModel) {
                      _.extend(relationship, {
                        reverseModel: reverseModel,
                        forwardModel: this,
                        forwardName: name,
                        reverseName: relationship.reverse || 'reverse_' + name,
                        isReverse: false
                      });
                      delete relationship.reverse;
                    } else return 'Model with name "' + modelName.toString() + '" does not exist';
                  }
                  else return 'Must pass model';
                }
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
    installReverseRelationships: function() {
      if (!this._reverseRelationshipsInstalled) {
        for (var forwardName in this.relationships) {
          if (this.relationships.hasOwnProperty(forwardName)) {
            var relationship = this.relationships[forwardName];
            relationship = extend(true, {}, relationship);
            relationship.isReverse = true;
            var reverseModel = relationship.reverseModel,
              reverseName = relationship.reverseName;
            if (reverseModel.singleton) {
              if (relationship.type == RelationshipType.ManyToMany) return 'Singleton model cannot be related via reverse ManyToMany';
              if (relationship.type == RelationshipType.OneToMany) return 'Singleton model cannot be related via reverse OneToMany';
            }
            log(this.name + ': configuring  reverse relationship ' + reverseName);
            reverseModel.relationships[reverseName] = relationship;
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
      var linkPromise = new Promise(function(resolve, reject) {
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
    /**
     * Only used in the testing at the moment.
     * @param query
     * @returns {ArrangedReactiveQuery}
     */
    _arrangedReactiveQuery: function(query) {
      return new ArrangedReactiveQuery(new Query(this, query || {}));
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
    install: function(cb) {
      log('Installing mapping ' + this.name);
      return util.promise(cb, function(cb) {
        if (!this._installed) {
          this._installed = true;
          cb();
        } else {
          throw new InternalSiestaError('Model "' + this.name + '" has already been installed');
        }
      }.bind(this));
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
        parseAttribute: opts.parseAttribute || this._opts.parseAttribute,
        store: opts.store == undefined ? this._opts.store : opts.store
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

},{"./ArrangedReactiveQuery":1,"./ManyToManyProxy":3,"./ModelInstance":4,"./OneToOneProxy":6,"./Query":7,"./ReactiveQuery":9,"./RelationshipType":11,"./cache":12,"./collectionRegistry":14,"./error":15,"./events":16,"./instanceFactory":18,"./log":19,"./mappingOperation":20,"./modelEvents":22,"./store":23,"./util":25,"argsarray":28,"extend":34}],22:[function(require,module,exports){
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

  function prettyChange(c) {
    if (c.type == ModelEventType.Set) {
      return c.model + '[' + c.localId + '].' + c.field + ' = ' + c.new;
    }
    else if (c.type == ModelEventType.Splice) {

    }
    else if (c.type == ModelEventType.New) {

    }
    else if (c.type == ModelEventType.Remove) {

    }
  }

  /**
   * Broadcas
   * @param  {String} collectionName
   * @param  {String} modelName
   * @param  {Object} c an options dictionary representing the change
   * @return {[type]}
   */
  function broadcastEvent(collectionName, modelName, c) {
    log('Sending notification "' + collectionName + '" of type ' + c.type, c);
    events.emit(collectionName, c);
    var modelNotif = collectionName + ':' + modelName;
    log('Sending notification "' + modelNotif + '" of type ' + c.type, c);
    events.emit(modelNotif, c);
    var genericNotif = 'Siesta';
    log('Sending notification "' + genericNotif + '" of type ' + c.type, c);
    events.emit(genericNotif, c);
    var localIdNotif = c.localId;
    log('Sending notification "' + localIdNotif + '" of type ' + c.type, c);
    events.emit(localIdNotif, c);
    var collection = collectionRegistry[collectionName];
    var err;
    if (!collection) {
      err = 'No such collection "' + collectionName + '"';
      log(err, collectionRegistry);
      throw new InternalSiestaError(err);
    }
    var model = collection[modelName];
    if (!model) {
      err = 'No such model "' + modelName + '"';
      log(err, collectionRegistry);
      throw new InternalSiestaError(err);
    }
    if (model.id && c.obj[model.id]) {
      var remoteIdNotif = collectionName + ':' + modelName + ':' + c.obj[model.id];
      log('Sending notification "' + remoteIdNotif + '" of type ' + c.type);
      events.emit(remoteIdNotif, c);
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
/**
 * The "store" is responsible for mediating between the in-memory cache and any persistent storage.
 * Note that persistent storage has not been properly implemented yet and so this is pretty useless.
 * All queries will go straight to the cache instead.
 * @module store
 */


(function () {
    var InternalSiestaError = require('./error').InternalSiestaError,
        log = require('./log')('store'),
        util = require('./util'),
        _ = util._,
        cache = require('./cache');


    function get(opts, cb) {
        log('get', opts);
        var siestaModel;
        return util.promise(cb, function (cb) {
            if (opts.localId) {
                if (util.isArray(opts.localId)) {
                    // Proxy onto getMultiple instead.
                    getMultiple(_.map(opts.localId, function (id) {
                        return {
                            localId: id
                        }
                    }), cb);
                } else {
                    siestaModel = cache.get(opts);
                    if (siestaModel) {
                        if (log.enabled)
                            log('Had cached object', {
                                opts: opts,
                                obj: siestaModel
                            });
                        if (cb) cb(null, siestaModel);
                    } else {
                        if (util.isArray(opts.localId)) {
                            // Proxy onto getMultiple instead.
                            getMultiple(_.map(opts.localId, function (id) {
                                return {
                                    localId: id
                                }
                            }), cb);
                        } else if (cb) {
                            var storage = siesta.ext.storage;
                            if (storage) {
                                storage.store.getFromPouch(opts, cb);
                            } else {
                                throw new Error('Storage module not installed');
                            }
                        }
                    }
                }
            } else if (opts.model) {
                if (util.isArray(opts[opts.model.id])) {
                    // Proxy onto getMultiple instead.
                    getMultiple(_.map(opts[opts.model.id], function (id) {
                        var o = {};
                        o[opts.model.id] = id;
                        o.model = opts.model;
                        return o
                    }), cb);
                } else {
                    siestaModel = cache.get(opts);
                    if (siestaModel) {
                        if (log.enabled)
                            log('Had cached object', {
                                opts: opts,
                                obj: siestaModel
                            });
                        if (cb) cb(null, siestaModel);
                    } else {
                        var model = opts.model;
                        if (model.singleton) {
                            model.one(cb);
                        } else {
                            var idField = model.id;
                            var id = opts[idField];
                            var oneOpts = {};
                            oneOpts[idField] = id;
                            if (id) {
                                model.one(oneOpts, function (err, obj) {
                                    if (!err) {
                                        if (obj) {
                                            cb(null, obj);
                                        } else {
                                            cb(null, null);
                                        }
                                    } else {
                                        cb(err);
                                    }
                                });
                            } else {
                                throw new InternalSiestaError('Invalid options given to store. Missing "' + idField.toString() + '."');
                            }
                        }

                    }
                }
            } else {
                // No way in which to find an object locally.
                var context = {
                    opts: opts
                };
                var msg = 'Invalid options given to store';
                throw new InternalSiestaError(msg, context);
            }
        }.bind(this));
    }

    function getMultiple(optsArray, cb) {
        return util.promise(cb, function (cb) {
            var docs = [];
            var errors = [];
            _.each(optsArray, function (opts) {
                get(opts, function (err, doc) {
                    if (err) {
                        errors.push(err);
                    } else {
                        docs.push(doc);
                    }
                    if (docs.length + errors.length == optsArray.length) {
                        if (cb) {
                            if (errors.length) {
                                cb(errors);
                            } else {
                                cb(null, docs);
                            }
                        }
                    }
                });
            });
        }.bind(this));
    }

    /**
     * Uses pouch bulk fetch API. Much faster than getMultiple.
     * @param localIdentifiers
     * @param cb
     */
    function getMultipleLocal(localIdentifiers, cb) {
        return util.promise(cb, function (cb) {
            var results = _.reduce(localIdentifiers, function (memo, localId) {
                var obj = cache.get({
                    localId: localId
                });
                if (obj) {
                    memo.cached[localId] = obj;
                } else {
                    memo.notCached.push(localId);
                }
                return memo;
            }, {
                cached: {},
                notCached: []
            });

            function finish(err) {
                if (cb) {
                    if (err) {
                        cb(err);
                    } else {
                        cb(null, _.map(localIdentifiers, function (localId) {
                            return results.cached[localId];
                        }));
                    }
                }
            }

            finish();
        }.bind(this));
    }

    function getMultipleRemote(remoteIdentifiers, model, cb) {
        return util.promise(cb, function (cb) {
            var results = _.reduce(remoteIdentifiers, function (memo, id) {
                var cacheQuery = {
                    model: model
                };
                cacheQuery[model.id] = id;
                var obj = cache.get(cacheQuery);
                if (obj) {
                    memo.cached[id] = obj;
                } else {
                    memo.notCached.push(id);
                }
                return memo;
            }, {
                cached: {},
                notCached: []
            });

            function finish(err) {
                if (cb) {
                    if (err) {
                        cb(err);
                    } else {
                        cb(null, _.map(remoteIdentifiers, function (id) {
                            return results.cached[id];
                        }));
                    }
                }
            }

            finish();
        }.bind(this));
    }

    module.exports = {
        get: get,
        getMultiple: getMultiple,
        getMultipleLocal: getMultipleLocal,
        getMultipleRemote: getMultipleRemote
    };

})();
},{"./cache":12,"./error":15,"./log":19,"./util":25}],24:[function(require,module,exports){
(function () {
    var misc = require('./misc'),
        _ = require('./underscore');

    function doParallel(fn) {
        return function () {
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
        each(arr, function (x, i, a) {
            results.push(iterator(x, i, a));
        });
        return results;
    }

    function _asyncMap(eachfn, arr, iterator, callback) {
        arr = _map(arr, function (x, i) {
            return {
                index: i,
                value: x
            };
        });
        if (!callback) {
            eachfn(arr, function (x, callback) {
                iterator(x.value, function (err) {
                    callback(err);
                });
            });
        } else {
            var results = [];
            eachfn(arr, function (x, callback) {
                iterator(x.value, function (err, v) {
                    results[x.index] = v;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    }

    var mapSeries = doSeries(_asyncMap);

    function doSeries(fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [eachSeries].concat(args));
        };
    }


    function eachSeries(arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        var iterate = function () {
            iterator(arr[completed], function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
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
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        _each(arr, function (x) {
            iterator(x, only_once(done));
        });

        function done(err) {
            if (err) {
                callback(err);
                callback = function () {};
            } else {
                completed += 1;
                if (completed >= arr.length) {
                    callback();
                }
            }
        }
    }




    var _parallel = function (eachfn, tasks, callback) {
        callback = callback || function () {};
        if (misc.isArray(tasks)) {
            eachfn.map(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
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
            eachfn.each(Object.keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    function series(tasks, callback) {
        callback = callback || function () {};
        if (misc.isArray(tasks)) {
            mapSeries(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
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
            eachSeries(_.keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    }

    function only_once(fn) {
        var called = false;
        return function () {
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
},{"./misc":26,"./underscore":27}],25:[function(require,module,exports){
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
},{"./async":24,"./misc":26,"./underscore":27}],26:[function(require,module,exports){
(function () {
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
        return function (err) {
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

    var isArrayShim = function (obj) {
            return _.toString.call(obj) === '[object Array]';
        },
        isArray = Array.isArray || isArrayShim,
        isString = function (o) {
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
        next: function (callback) {
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
        guid: (function () {
            function s4() {
                return Math.floor((1 + Math.random()) * 0x10000)
                    .toString(16)
                    .substring(1);
            }

            return function () {
                return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
                    s4() + '-' + s4() + s4() + s4();
            };
        })(),
        assert: function (condition, message, context) {
            if (!condition) {
                message = message || "Assertion failed";
                context = context || {};
                throw new InternalSiestaError(message, context);
            }
        },
        thenBy: (function () {
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
                return extend(function (a, b) {
                    return x(a, b) || y(a, b);
                });
            }

            return extend;
        })(),
        defineSubProperty: function (property, subObj, innerProperty) {
            return Object.defineProperty(this, property, {
                get: function () {
                    if (innerProperty) {
                        return subObj[innerProperty];
                    }
                    else {
                        return subObj[property];
                    }
                },
                set: function (value) {
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
        defineSubPropertyNoSet: function (property, subObj, innerProperty) {
            return Object.defineProperty(this, property, {
                get: function () {
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
        _patchBind: function () {
            var _bind = Function.prototype.apply.bind(Function.prototype.bind);
            Object.defineProperty(Function.prototype, 'bind', {
                value: function (obj) {
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
        promise: function (cb, fn) {
            cb = cb || function () {
            };
            return new Promise(function (resolve, reject) {
                var _cb = argsarray(function (args) {
                    var err = args[0],
                        rest = args.slice(1);
                    if (err) reject(err);
                    else resolve(rest[0]);
                    var bound = cb['__siesta_bound_object'] || cb; // Preserve bound object.
                    cb.apply(bound, args);
                });
                fn(_cb);
            })
        },
        subProperties: function (obj, subObj, properties) {
            if (!isArray(properties)) {
                properties = Array.prototype.slice.call(arguments, 2);
            }
            for (var i = 0; i < properties.length; i++) {
                (function (property) {
                    var opts = {
                        set: false,
                        name: property,
                        property: property
                    };
                    if (!isString(property)) {
                        _.extend(opts, property);
                    }
                    var desc = {
                        get: function () {
                            return subObj[opts.property];
                        },
                        enumerable: true,
                        configurable: true
                    };
                    if (opts.set) {
                        desc.set = function (v) {
                            subObj[opts.property] = v;
                        };
                    }
                    Object.defineProperty(obj, opts.name, desc);
                })(properties[i]);
            }
        },
        capitaliseFirstLetter: function (string) {
            return string.charAt(0).toUpperCase() + string.slice(1);
        },
        extendFromOpts: function (obj, opts, defaults, errorOnUnknown) {
            errorOnUnknown = errorOnUnknown == undefined ? true : errorOnUnknown;
            if (errorOnUnknown) {
                var defaultKeys = Object.keys(defaults),
                    optsKeys = Object.keys(opts);
                var unknownKeys = optsKeys.filter(function (n) {
                    return defaultKeys.indexOf(n) == -1
                });
                if (unknownKeys.length) throw Error('Unknown options: ' + unknownKeys.toString());
            }
            // Apply any functions specified in the defaults.
            _.each(Object.keys(defaults), function (k) {
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
        prettyPrint: function (o) {
            return JSON.stringify(o, null, 4);
        },
        flattenArray: function (arr) {
            return _.reduce(arr, function (memo, e) {
                if (isArray(e)) {
                    memo = memo.concat(e);
                } else {
                    memo.push(e);
                }
                return memo;
            }, []);
        },
        unflattenArray: function (arr, modelArr) {
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
        paramNames: function (fn) {
            // TODO: Is there a more robust way of doing this?
            var params = [],
                fnText,
                argDecl;
            fnText = fn.toString().replace(STRIP_COMMENTS, '');
            argDecl = fnText.match(FN_ARGS);

            argDecl[1].split(FN_ARG_SPLIT).forEach(function (arg) {
                arg.replace(FN_ARG, function (all, underscore, name) {
                    params.push(name);
                });
            });
            return params;
        }
    });
})();
},{"../../vendor/observe-js/src/observe":54,"./../error":15,"./underscore":27,"argsarray":28,"lie":38}],27:[function(require,module,exports){
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
},{}],28:[function(require,module,exports){
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
},{}],29:[function(require,module,exports){

},{}],30:[function(require,module,exports){
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

},{}],31:[function(require,module,exports){

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

},{"./debug":32}],32:[function(require,module,exports){

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

},{"ms":33}],33:[function(require,module,exports){
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

},{}],34:[function(require,module,exports){
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


},{}],35:[function(require,module,exports){
'use strict';

module.exports = INTERNAL;

function INTERNAL() {}
},{}],36:[function(require,module,exports){
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
},{"./INTERNAL":35,"./handlers":37,"./promise":39,"./reject":42,"./resolve":43}],37:[function(require,module,exports){
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
},{"./resolveThenable":44,"./states":45,"./tryCatch":46}],38:[function(require,module,exports){
module.exports = exports = require('./promise');

exports.resolve = require('./resolve');
exports.reject = require('./reject');
exports.all = require('./all');
exports.race = require('./race');
},{"./all":36,"./promise":39,"./race":41,"./reject":42,"./resolve":43}],39:[function(require,module,exports){
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

},{"./INTERNAL":35,"./queueItem":40,"./resolveThenable":44,"./states":45,"./unwrap":47}],40:[function(require,module,exports){
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
},{"./handlers":37,"./unwrap":47}],41:[function(require,module,exports){
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
},{"./INTERNAL":35,"./handlers":37,"./promise":39,"./reject":42,"./resolve":43}],42:[function(require,module,exports){
'use strict';

var Promise = require('./promise');
var INTERNAL = require('./INTERNAL');
var handlers = require('./handlers');
module.exports = reject;

function reject(reason) {
	var promise = new Promise(INTERNAL);
	return handlers.reject(promise, reason);
}
},{"./INTERNAL":35,"./handlers":37,"./promise":39}],43:[function(require,module,exports){
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
},{"./INTERNAL":35,"./handlers":37,"./promise":39}],44:[function(require,module,exports){
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
},{"./handlers":37,"./tryCatch":46}],45:[function(require,module,exports){
// Lazy man's symbols for states

exports.REJECTED = ['REJECTED'];
exports.FULFILLED = ['FULFILLED'];
exports.PENDING = ['PENDING'];
},{}],46:[function(require,module,exports){
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
},{}],47:[function(require,module,exports){
'use strict';

var immediate = require('immediate');
var handlers = require('./handlers');
module.exports = unwrap;

function unwrap(promise, func, value) {
  immediate(function () {
    var returnValue;
    try {
      returnValue = func(value);
    } catch (e) {
      return handlers.reject(promise, e);
    }
    if (returnValue === promise) {
      handlers.reject(promise, new TypeError('Cannot resolve promise with itself'));
    } else {
      handlers.resolve(promise, returnValue);
    }
  });
}
},{"./handlers":37,"immediate":48}],48:[function(require,module,exports){
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
},{"./messageChannel":49,"./mutation.js":50,"./nextTick":29,"./stateChange":51,"./timeout":52}],49:[function(require,module,exports){
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
},{}],50:[function(require,module,exports){
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
},{}],51:[function(require,module,exports){
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
},{}],52:[function(require,module,exports){
'use strict';
exports.test = function () {
  return true;
};

exports.install = function (t) {
  return function () {
    setTimeout(t, 0);
  };
};
},{}],53:[function(require,module,exports){
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
          // If the related is not stored then it wouldn't make sense to create a relation in storage.
          val = val.filter(function(instance) {
            return instance.model.store(instance);
          });
          memo[n] = _.pluck(val, 'localId');
        }
        else if (val) {
          // If the related is not stored then it wouldn't make sense to create a relation in storage.
          var store = val.model.store(val);
          if (store) memo[n] = val.localId;
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
          instances = instances.filter(function(instance) {
            return instance.model.store(instance);
          });
          log('Saving instances', instances);
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
},{}],54:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL0FycmFuZ2VkUmVhY3RpdmVRdWVyeS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvQ2hhaW4uanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL01hbnlUb01hbnlQcm94eS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvTW9kZWxJbnN0YW5jZS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvT25lVG9NYW55UHJveHkuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL09uZVRvT25lUHJveHkuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL1F1ZXJ5LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9RdWVyeVNldC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvUmVhY3RpdmVRdWVyeS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvUmVsYXRpb25zaGlwUHJveHkuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL1JlbGF0aW9uc2hpcFR5cGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL2NhY2hlLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9jb2xsZWN0aW9uLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9jb2xsZWN0aW9uUmVnaXN0cnkuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL2Vycm9yLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9ldmVudHMuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL2luZGV4LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9pbnN0YW5jZUZhY3RvcnkuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL2xvZy5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvbWFwcGluZ09wZXJhdGlvbi5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvbW9kZWwuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9jb3JlL21vZGVsRXZlbnRzLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS9zdG9yZS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvdXRpbC9hc3luYy5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvdXRpbC9pbmRleC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L2NvcmUvdXRpbC9taXNjLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvY29yZS91dGlsL3VuZGVyc2NvcmUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvYXJnc2FycmF5L2luZGV4LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcmVzb2x2ZS9lbXB0eS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2RlYnVnL2Jyb3dzZXIuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvZGVidWcvZGVidWcuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvZGVidWcvbm9kZV9tb2R1bGVzL21zL2luZGV4LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2V4dGVuZC9pbmRleC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9saWUvbGliL0lOVEVSTkFMLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2xpZS9saWIvYWxsLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2xpZS9saWIvaGFuZGxlcnMuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvbGllL2xpYi9pbmRleC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9saWUvbGliL3Byb21pc2UuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvbGllL2xpYi9xdWV1ZUl0ZW0uanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvbGllL2xpYi9yYWNlLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2xpZS9saWIvcmVqZWN0LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2xpZS9saWIvcmVzb2x2ZS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9saWUvbGliL3Jlc29sdmVUaGVuYWJsZS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9saWUvbGliL3N0YXRlcy5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9saWUvbGliL3RyeUNhdGNoLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2xpZS9saWIvdW53cmFwLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2xpZS9ub2RlX21vZHVsZXMvaW1tZWRpYXRlL2xpYi9pbmRleC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9saWUvbm9kZV9tb2R1bGVzL2ltbWVkaWF0ZS9saWIvbWVzc2FnZUNoYW5uZWwuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvbGllL25vZGVfbW9kdWxlcy9pbW1lZGlhdGUvbGliL211dGF0aW9uLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2xpZS9ub2RlX21vZHVsZXMvaW1tZWRpYXRlL2xpYi9zdGF0ZUNoYW5nZS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9saWUvbm9kZV9tb2R1bGVzL2ltbWVkaWF0ZS9saWIvdGltZW91dC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L3N0b3JhZ2UvaW5kZXguanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9IQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbFJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqVUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqUUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbllBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDek5BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9RQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQkE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3U0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDck1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9HQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6ZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qKlxuICogU29sdmVzIHRoZSBjb21tb24gcHJvYmxlbSBvZiBtYWludGFpbmluZyB0aGUgb3JkZXIgb2YgYSBzZXQgb2YgYSBtb2RlbHMgYW5kIHF1ZXJ5aW5nIG9uIHRoYXQgb3JkZXIuXG4gKlxuICogVGhlIHNhbWUgYXMgUmVhY3RpdmVRdWVyeSBidXQgZW5hYmxlcyBtYW51YWwgcmVvcmRlcmluZyBvZiBtb2RlbHMgYW5kIG1haW50YWlucyBhbiBpbmRleCBmaWVsZC5cbiAqL1xuXG4oZnVuY3Rpb24oKSB7XG5cbiAgdmFyIFJlYWN0aXZlUXVlcnkgPSByZXF1aXJlKCcuL1JlYWN0aXZlUXVlcnknKSxcbiAgICAgIGxvZyA9IHJlcXVpcmUoJy4vbG9nJykoJ3F1ZXJ5JyksXG4gICAgICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gICAgICBlcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKSxcbiAgICAgIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICAgICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IGVycm9yLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgICBjb25zdHJ1Y3RRdWVyeVNldCA9IHJlcXVpcmUoJy4vUXVlcnlTZXQnKSxcbiAgICAgIF8gPSB1dGlsLl87XG5cbiAgZnVuY3Rpb24gQXJyYW5nZWRSZWFjdGl2ZVF1ZXJ5KHF1ZXJ5KSB7XG4gICAgUmVhY3RpdmVRdWVyeS5jYWxsKHRoaXMsIHF1ZXJ5KTtcbiAgICB0aGlzLmluZGV4QXR0cmlidXRlID0gJ2luZGV4JztcbiAgfVxuXG4gIEFycmFuZ2VkUmVhY3RpdmVRdWVyeS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFJlYWN0aXZlUXVlcnkucHJvdG90eXBlKTtcblxuICBfLmV4dGVuZChBcnJhbmdlZFJlYWN0aXZlUXVlcnkucHJvdG90eXBlLCB7XG4gICAgX3JlZnJlc2hJbmRleGVzOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciByZXN1bHRzID0gdGhpcy5yZXN1bHRzLFxuICAgICAgICAgIGluZGV4QXR0cmlidXRlID0gdGhpcy5pbmRleEF0dHJpYnV0ZTtcbiAgICAgIGlmICghcmVzdWx0cykgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ0FycmFuZ2VkUmVhY3RpdmVRdWVyeSBtdXN0IGJlIGluaXRpYWxpc2VkJyk7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlc3VsdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIG1vZGVsSW5zdGFuY2UgPSByZXN1bHRzW2ldO1xuICAgICAgICBtb2RlbEluc3RhbmNlW2luZGV4QXR0cmlidXRlXSA9IGk7XG4gICAgICB9XG4gICAgfSxcbiAgICBfbWVyZ2VJbmRleGVzOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciByZXN1bHRzID0gdGhpcy5yZXN1bHRzLFxuICAgICAgICAgIG5ld1Jlc3VsdHMgPSBbXSxcbiAgICAgICAgICBvdXRPZkJvdW5kcyA9IFtdLFxuICAgICAgICAgIHVuaW5kZXhlZCA9IFtdO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXN1bHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciByZXMgPSByZXN1bHRzW2ldLFxuICAgICAgICAgICAgc3RvcmVkSW5kZXggPSByZXNbdGhpcy5pbmRleEF0dHJpYnV0ZV07XG4gICAgICAgIGlmIChzdG9yZWRJbmRleCA9PSB1bmRlZmluZWQpIHsgLy8gbnVsbCBvciB1bmRlZmluZWRcbiAgICAgICAgICB1bmluZGV4ZWQucHVzaChyZXMpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHN0b3JlZEluZGV4ID4gcmVzdWx0cy5sZW5ndGgpIHtcbiAgICAgICAgICBvdXRPZkJvdW5kcy5wdXNoKHJlcyk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgLy8gSGFuZGxlIGR1cGxpY2F0ZSBpbmRleGVzXG4gICAgICAgICAgaWYgKCFuZXdSZXN1bHRzW3N0b3JlZEluZGV4XSkge1xuICAgICAgICAgICAgbmV3UmVzdWx0c1tzdG9yZWRJbmRleF0gPSByZXM7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdW5pbmRleGVkLnB1c2gocmVzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIG91dE9mQm91bmRzID0gXy5zb3J0Qnkob3V0T2ZCb3VuZHMsIGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgcmV0dXJuIHhbdGhpcy5pbmRleEF0dHJpYnV0ZV07XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgLy8gU2hpZnQgdGhlIGluZGV4IG9mIGFsbCBtb2RlbHMgd2l0aCBpbmRleGVzIG91dCBvZiBib3VuZHMgaW50byB0aGUgY29ycmVjdCByYW5nZS5cbiAgICAgIGZvciAoaSA9IDA7IGkgPCBvdXRPZkJvdW5kcy5sZW5ndGg7IGkrKykge1xuICAgICAgICByZXMgPSBvdXRPZkJvdW5kc1tpXTtcbiAgICAgICAgdmFyIHJlc3VsdHNJbmRleCA9IHRoaXMucmVzdWx0cy5sZW5ndGggLSBvdXRPZkJvdW5kcy5sZW5ndGggKyBpO1xuICAgICAgICByZXNbdGhpcy5pbmRleEF0dHJpYnV0ZV0gPSByZXN1bHRzSW5kZXg7XG4gICAgICAgIG5ld1Jlc3VsdHNbcmVzdWx0c0luZGV4XSA9IHJlcztcbiAgICAgIH1cbiAgICAgIHVuaW5kZXhlZCA9IHRoaXMuX3F1ZXJ5Ll9zb3J0UmVzdWx0cyh1bmluZGV4ZWQpO1xuICAgICAgdmFyIG4gPSAwO1xuICAgICAgd2hpbGUgKHVuaW5kZXhlZC5sZW5ndGgpIHtcbiAgICAgICAgcmVzID0gdW5pbmRleGVkLnNoaWZ0KCk7XG4gICAgICAgIHdoaWxlIChuZXdSZXN1bHRzW25dKSB7XG4gICAgICAgICAgbisrO1xuICAgICAgICB9XG4gICAgICAgIG5ld1Jlc3VsdHNbbl0gPSByZXM7XG4gICAgICAgIHJlc1t0aGlzLmluZGV4QXR0cmlidXRlXSA9IG47XG4gICAgICB9XG5cbiAgICAgIHRoaXMucmVzdWx0cyA9IGNvbnN0cnVjdFF1ZXJ5U2V0KG5ld1Jlc3VsdHMsIHRoaXMubW9kZWwpO1xuICAgIH0sXG4gICAgaW5pdDogZnVuY3Rpb24oY2IpIHtcbiAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICAgIFJlYWN0aXZlUXVlcnkucHJvdG90eXBlLmluaXQuY2FsbCh0aGlzLCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgaWYgKCF0aGlzLm1vZGVsLmhhc0F0dHJpYnV0ZU5hbWVkKHRoaXMuaW5kZXhBdHRyaWJ1dGUpKSB7XG4gICAgICAgICAgICAgIGVyciA9IGVycm9yKCdNb2RlbCBcIicgKyB0aGlzLm1vZGVsLm5hbWUgKyAnXCIgZG9lcyBub3QgaGF2ZSBhbiBhdHRyaWJ1dGUgbmFtZWQgXCInICsgdGhpcy5pbmRleEF0dHJpYnV0ZSArICdcIicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIHRoaXMuX21lcmdlSW5kZXhlcygpO1xuICAgICAgICAgICAgICB0aGlzLl9xdWVyeS5jbGVhck9yZGVyaW5nKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGNiKGVyciwgZXJyID8gbnVsbCA6IHRoaXMucmVzdWx0cyk7XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH0sXG4gICAgX2hhbmRsZU5vdGlmOiBmdW5jdGlvbihuKSB7XG4gICAgICAvLyBXZSBkb24ndCB3YW50IHRvIGtlZXAgZXhlY3V0aW5nIHRoZSBxdWVyeSBlYWNoIHRpbWUgdGhlIGluZGV4IGV2ZW50IGZpcmVzIGFzIHdlJ3JlIGNoYW5naW5nIHRoZSBpbmRleCBvdXJzZWx2ZXNcbiAgICAgIGlmIChuLmZpZWxkICE9IHRoaXMuaW5kZXhBdHRyaWJ1dGUpIHtcbiAgICAgICAgUmVhY3RpdmVRdWVyeS5wcm90b3R5cGUuX2hhbmRsZU5vdGlmLmNhbGwodGhpcywgbik7XG4gICAgICAgIHRoaXMuX3JlZnJlc2hJbmRleGVzKCk7XG4gICAgICB9XG4gICAgfSxcbiAgICB2YWxpZGF0ZUluZGV4OiBmdW5jdGlvbihpZHgpIHtcbiAgICAgIHZhciBtYXhJbmRleCA9IHRoaXMucmVzdWx0cy5sZW5ndGggLSAxLFxuICAgICAgICAgIG1pbkluZGV4ID0gMDtcbiAgICAgIGlmICghKGlkeCA+PSBtaW5JbmRleCAmJiBpZHggPD0gbWF4SW5kZXgpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSW5kZXggJyArIGlkeC50b1N0cmluZygpICsgJyBpcyBvdXQgb2YgYm91bmRzJyk7XG4gICAgICB9XG4gICAgfSxcbiAgICBzd2FwT2JqZWN0c0F0SW5kZXhlczogZnVuY3Rpb24oZnJvbSwgdG8pIHtcbiAgICAgIC8vbm9pbnNwZWN0aW9uIFVubmVjZXNzYXJ5TG9jYWxWYXJpYWJsZUpTXG4gICAgICB0aGlzLnZhbGlkYXRlSW5kZXgoZnJvbSk7XG4gICAgICB0aGlzLnZhbGlkYXRlSW5kZXgodG8pO1xuICAgICAgdmFyIGZyb21Nb2RlbCA9IHRoaXMucmVzdWx0c1tmcm9tXSxcbiAgICAgICAgICB0b01vZGVsID0gdGhpcy5yZXN1bHRzW3RvXTtcbiAgICAgIGlmICghZnJvbU1vZGVsKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignTm8gbW9kZWwgYXQgaW5kZXggXCInICsgZnJvbS50b1N0cmluZygpICsgJ1wiJyk7XG4gICAgICB9XG4gICAgICBpZiAoIXRvTW9kZWwpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBtb2RlbCBhdCBpbmRleCBcIicgKyB0by50b1N0cmluZygpICsgJ1wiJyk7XG4gICAgICB9XG4gICAgICB0aGlzLnJlc3VsdHNbdG9dID0gZnJvbU1vZGVsO1xuICAgICAgdGhpcy5yZXN1bHRzW2Zyb21dID0gdG9Nb2RlbDtcbiAgICAgIGZyb21Nb2RlbFt0aGlzLmluZGV4QXR0cmlidXRlXSA9IHRvO1xuICAgICAgdG9Nb2RlbFt0aGlzLmluZGV4QXR0cmlidXRlXSA9IGZyb207XG4gICAgfSxcbiAgICBzd2FwT2JqZWN0czogZnVuY3Rpb24ob2JqMSwgb2JqMikge1xuICAgICAgdmFyIGZyb21JZHggPSB0aGlzLnJlc3VsdHMuaW5kZXhPZihvYmoxKSxcbiAgICAgICAgICB0b0lkeCA9IHRoaXMucmVzdWx0cy5pbmRleE9mKG9iajIpO1xuICAgICAgdGhpcy5zd2FwT2JqZWN0c0F0SW5kZXhlcyhmcm9tSWR4LCB0b0lkeCk7XG4gICAgfSxcbiAgICBtb3ZlOiBmdW5jdGlvbihmcm9tLCB0bykge1xuICAgICAgdGhpcy52YWxpZGF0ZUluZGV4KGZyb20pO1xuICAgICAgdGhpcy52YWxpZGF0ZUluZGV4KHRvKTtcbiAgICAgIHZhciByZXN1bHRzID0gdGhpcy5yZXN1bHRzLm11dGFibGVDb3B5KCk7XG4gICAgICAoZnVuY3Rpb24ob2xkSW5kZXgsIG5ld0luZGV4KSB7XG4gICAgICAgIGlmIChuZXdJbmRleCA+PSB0aGlzLmxlbmd0aCkge1xuICAgICAgICAgIHZhciBrID0gbmV3SW5kZXggLSB0aGlzLmxlbmd0aDtcbiAgICAgICAgICB3aGlsZSAoKGstLSkgKyAxKSB7XG4gICAgICAgICAgICB0aGlzLnB1c2godW5kZWZpbmVkKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pLmNhbGwocmVzdWx0cywgZnJvbSwgdG8pO1xuICAgICAgdmFyIHJlbW92ZWQgPSByZXN1bHRzLnNwbGljZShmcm9tLCAxKVswXTtcbiAgICAgIHRoaXMucmVzdWx0cyA9IHJlc3VsdHMuYXNNb2RlbFF1ZXJ5U2V0KHRoaXMubW9kZWwpO1xuICAgICAgdGhpcy5lbWl0KG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSwge1xuICAgICAgICBpbmRleDogZnJvbSxcbiAgICAgICAgcmVtb3ZlZDogW3JlbW92ZWRdLFxuICAgICAgICB0eXBlOiBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgICAgIG9iajogdGhpcyxcbiAgICAgICAgZmllbGQ6ICdyZXN1bHRzJ1xuICAgICAgfSk7XG4gICAgICByZXN1bHRzLnNwbGljZSh0bywgMCwgcmVtb3ZlZCk7XG4gICAgICB0aGlzLnJlc3VsdHMgPSByZXN1bHRzLmFzTW9kZWxRdWVyeVNldCh0aGlzLm1vZGVsKTtcbiAgICAgIHRoaXMuZW1pdChtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5TcGxpY2UsIHtcbiAgICAgICAgaW5kZXg6IHRvLFxuICAgICAgICBhZGRlZDogW3JlbW92ZWRdLFxuICAgICAgICB0eXBlOiBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgICAgIG9iajogdGhpcyxcbiAgICAgICAgZmllbGQ6ICdyZXN1bHRzJ1xuICAgICAgfSk7XG4gICAgICB0aGlzLl9yZWZyZXNoSW5kZXhlcygpO1xuICAgIH1cbiAgfSk7XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBBcnJhbmdlZFJlYWN0aXZlUXVlcnk7XG59KSgpOyIsIihmdW5jdGlvbigpIHtcblxuICB2YXIgYXJnc2FycmF5ID0gcmVxdWlyZSgnYXJnc2FycmF5Jyk7XG5cbiAgLyoqXG4gICAqIENsYXNzIGZvciBmYWNpbGl0YXRpbmcgXCJjaGFpbmVkXCIgYmVoYXZpb3VyIGUuZzpcbiAgICpcbiAgICogdmFyIGNhbmNlbCA9IFVzZXJzXG4gICAqICAub24oJ25ldycsIGZ1bmN0aW9uICh1c2VyKSB7XG4gICAqICAgICAvLyAuLi5cbiAgICogICB9KVxuICAgKiAgLnF1ZXJ5KHskb3I6IHthZ2VfX2d0ZTogMjAsIGFnZV9fbHRlOiAzMH19KVxuICAgKiAgLm9uKCcqJywgZnVuY3Rpb24gKGNoYW5nZSkge1xuICAgKiAgICAgLy8gLi5cbiAgICogICB9KTtcbiAgICpcbiAgICogQHBhcmFtIG9wdHNcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqL1xuICBmdW5jdGlvbiBDaGFpbihvcHRzKSB7XG4gICAgdGhpcy5vcHRzID0gb3B0cztcbiAgfVxuXG4gIENoYWluLnByb3RvdHlwZSA9IHtcbiAgICAvKipcbiAgICAgKiBDb25zdHJ1Y3QgYSBsaW5rIGluIHRoZSBjaGFpbiBvZiBjYWxscy5cbiAgICAgKiBAcGFyYW0gb3B0c1xuICAgICAqIEBwYXJhbSBvcHRzLmZuXG4gICAgICogQHBhcmFtIG9wdHMudHlwZVxuICAgICAqL1xuICAgIF9oYW5kbGVyTGluazogZnVuY3Rpb24ob3B0cykge1xuICAgICAgdmFyIGZpcnN0TGluaztcbiAgICAgIGZpcnN0TGluayA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgdHlwID0gb3B0cy50eXBlO1xuICAgICAgICBpZiAob3B0cy5mbilcbiAgICAgICAgICB0aGlzLl9yZW1vdmVMaXN0ZW5lcihvcHRzLmZuLCB0eXApO1xuICAgICAgICBpZiAoZmlyc3RMaW5rLl9wYXJlbnRMaW5rKSBmaXJzdExpbmsuX3BhcmVudExpbmsoKTsgLy8gQ2FuY2VsIGxpc3RlbmVycyBhbGwgdGhlIHdheSB1cCB0aGUgY2hhaW4uXG4gICAgICB9LmJpbmQodGhpcyk7XG4gICAgICBPYmplY3Qua2V5cyh0aGlzLm9wdHMpLmZvckVhY2goZnVuY3Rpb24ocHJvcCkge1xuICAgICAgICB2YXIgZnVuYyA9IHRoaXMub3B0c1twcm9wXTtcbiAgICAgICAgZmlyc3RMaW5rW3Byb3BdID0gYXJnc2FycmF5KGZ1bmN0aW9uKGFyZ3MpIHtcbiAgICAgICAgICB2YXIgbGluayA9IGZ1bmMuYXBwbHkoZnVuYy5fX3NpZXN0YV9ib3VuZF9vYmplY3QsIGFyZ3MpO1xuICAgICAgICAgIGxpbmsuX3BhcmVudExpbmsgPSBmaXJzdExpbms7XG4gICAgICAgICAgcmV0dXJuIGxpbms7XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgZmlyc3RMaW5rLl9wYXJlbnRMaW5rID0gbnVsbDtcbiAgICAgIHJldHVybiBmaXJzdExpbms7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBDb25zdHJ1Y3QgYSBsaW5rIGluIHRoZSBjaGFpbiBvZiBjYWxscy5cbiAgICAgKiBAcGFyYW0gb3B0c1xuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjbGVhbl1cbiAgICAgKi9cbiAgICBfbGluazogZnVuY3Rpb24ob3B0cywgY2xlYW4pIHtcbiAgICAgIHZhciBjaGFpbiA9IHRoaXM7XG4gICAgICBjbGVhbiA9IGNsZWFuIHx8IGZ1bmN0aW9uKCkge307XG4gICAgICB2YXIgbGluaztcbiAgICAgIGxpbmsgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgY2xlYW4oKTtcbiAgICAgICAgaWYgKGxpbmsuX3BhcmVudExpbmspIGxpbmsuX3BhcmVudExpbmsoKTsgLy8gQ2FuY2VsIGxpc3RlbmVycyBhbGwgdGhlIHdheSB1cCB0aGUgY2hhaW4uXG4gICAgICB9LmJpbmQodGhpcyk7XG4gICAgICBsaW5rLl9fc2llc3RhX2lzTGluayA9IHRydWU7XG4gICAgICBsaW5rLm9wdHMgPSBvcHRzO1xuICAgICAgbGluay5jbGVhbiA9IGNsZWFuO1xuICAgICAgT2JqZWN0LmtleXMob3B0cykuZm9yRWFjaChmdW5jdGlvbihwcm9wKSB7XG4gICAgICAgIHZhciBmdW5jID0gb3B0c1twcm9wXTtcbiAgICAgICAgbGlua1twcm9wXSA9IGFyZ3NhcnJheShmdW5jdGlvbihhcmdzKSB7XG4gICAgICAgICAgdmFyIHBvc3NpYmxlTGluayA9IGZ1bmMuYXBwbHkoZnVuYy5fX3NpZXN0YV9ib3VuZF9vYmplY3QsIGFyZ3MpO1xuICAgICAgICAgIGlmICghcG9zc2libGVMaW5rIHx8ICFwb3NzaWJsZUxpbmsuX19zaWVzdGFfaXNMaW5rKSB7IC8vIFBhdGNoIGluIGEgbGluayBpbiB0aGUgY2hhaW4gdG8gYXZvaWQgaXQgYmVpbmcgYnJva2VuLCBiYXNpbmcgb2ZmIHRoZSBjdXJyZW50IGxpbmtcbiAgICAgICAgICAgIG5leHRMaW5rID0gY2hhaW4uX2xpbmsobGluay5vcHRzKTtcbiAgICAgICAgICAgIGZvciAodmFyIHByb3AgaW4gcG9zc2libGVMaW5rKSB7XG4gICAgICAgICAgICAgIC8vbm9pbnNwZWN0aW9uIEpTVW5maWx0ZXJlZEZvckluTG9vcFxuICAgICAgICAgICAgICBpZiAocG9zc2libGVMaW5rW3Byb3BdIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAvL25vaW5zcGVjdGlvbiBKU1VuZmlsdGVyZWRGb3JJbkxvb3BcbiAgICAgICAgICAgICAgICBuZXh0TGlua1twcm9wXSA9IHBvc3NpYmxlTGlua1twcm9wXTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHZhciBuZXh0TGluayA9IHBvc3NpYmxlTGluaztcbiAgICAgICAgICB9XG4gICAgICAgICAgbmV4dExpbmsuX3BhcmVudExpbmsgPSBsaW5rO1xuICAgICAgICAgIC8vIEluaGVyaXQgbWV0aG9kcyBmcm9tIHRoZSBwYXJlbnQgbGluayBpZiB0aG9zZSBtZXRob2RzIGRvbid0IGFscmVhZHkgZXhpc3QuXG4gICAgICAgICAgZm9yIChwcm9wIGluIGxpbmspIHtcbiAgICAgICAgICAgIGlmIChsaW5rW3Byb3BdIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICAgICAgICAgICAgbmV4dExpbmtbcHJvcF0gPSBsaW5rW3Byb3BdLmJpbmQobGluayk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBuZXh0TGluaztcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICBsaW5rLl9wYXJlbnRMaW5rID0gbnVsbDtcbiAgICAgIHJldHVybiBsaW5rO1xuICAgIH1cbiAgfTtcbiAgbW9kdWxlLmV4cG9ydHMgPSBDaGFpbjtcbn0pKCk7IiwiKGZ1bmN0aW9uICgpIHtcbiAgICAvKipcbiAgICAgKiBAbW9kdWxlIHJlbGF0aW9uc2hpcHNcbiAgICAgKi9cblxuICAgIHZhciBSZWxhdGlvbnNoaXBQcm94eSA9IHJlcXVpcmUoJy4vUmVsYXRpb25zaGlwUHJveHknKSxcbiAgICAgICAgU3RvcmUgPSByZXF1aXJlKCcuL3N0b3JlJyksXG4gICAgICAgIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICAgICAgXyA9IHV0aWwuXyxcbiAgICAgICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgICAgICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgICAgICAgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgICAgICAgd3JhcEFycmF5Rm9yQXR0cmlidXRlcyA9IGV2ZW50cy53cmFwQXJyYXksXG4gICAgICAgIFNpZXN0YU1vZGVsID0gcmVxdWlyZSgnLi9Nb2RlbEluc3RhbmNlJyksXG4gICAgICAgIEFycmF5T2JzZXJ2ZXIgPSByZXF1aXJlKCcuLi92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZScpLkFycmF5T2JzZXJ2ZXIsXG4gICAgICAgIE1vZGVsRXZlbnRUeXBlID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLk1vZGVsRXZlbnRUeXBlO1xuXG4gICAgLyoqXG4gICAgICogW01hbnlUb01hbnlQcm94eSBkZXNjcmlwdGlvbl1cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICAgICAqL1xuICAgIGZ1bmN0aW9uIE1hbnlUb01hbnlQcm94eShvcHRzKSB7XG4gICAgICAgIFJlbGF0aW9uc2hpcFByb3h5LmNhbGwodGhpcywgb3B0cyk7XG4gICAgICAgIHRoaXMucmVsYXRlZCA9IFtdO1xuICAgICAgICB0aGlzLnJlbGF0ZWRDYW5jZWxMaXN0ZW5lcnMgPSB7fTtcbiAgICB9XG5cbiAgICBNYW55VG9NYW55UHJveHkucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUpO1xuXG4gICAgXy5leHRlbmQoTWFueVRvTWFueVByb3h5LnByb3RvdHlwZSwge1xuICAgICAgICBjbGVhclJldmVyc2U6IGZ1bmN0aW9uIChyZW1vdmVkKSB7XG4gICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICBfLmVhY2gocmVtb3ZlZCwgZnVuY3Rpb24gKHJlbW92ZWRPYmplY3QpIHtcbiAgICAgICAgICAgICAgICB2YXIgcmV2ZXJzZVByb3h5ID0gc2VsZi5yZXZlcnNlUHJveHlGb3JJbnN0YW5jZShyZW1vdmVkT2JqZWN0KTtcbiAgICAgICAgICAgICAgICB2YXIgaWR4ID0gcmV2ZXJzZVByb3h5LnJlbGF0ZWQuaW5kZXhPZihzZWxmLm9iamVjdCk7XG4gICAgICAgICAgICAgICAgcmV2ZXJzZVByb3h5Lm1ha2VDaGFuZ2VzVG9SZWxhdGVkV2l0aG91dE9ic2VydmF0aW9ucyhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldmVyc2VQcm94eS5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBzZXRSZXZlcnNlT2ZBZGRlZDogZnVuY3Rpb24gKGFkZGVkKSB7XG4gICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICBfLmVhY2goYWRkZWQsIGZ1bmN0aW9uIChhZGRlZE9iamVjdCkge1xuICAgICAgICAgICAgICAgIHZhciByZXZlcnNlUHJveHkgPSBzZWxmLnJldmVyc2VQcm94eUZvckluc3RhbmNlKGFkZGVkT2JqZWN0KTtcbiAgICAgICAgICAgICAgICByZXZlcnNlUHJveHkubWFrZUNoYW5nZXNUb1JlbGF0ZWRXaXRob3V0T2JzZXJ2YXRpb25zKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV2ZXJzZVByb3h5LnNwbGljZSgwLCAwLCBzZWxmLm9iamVjdCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgd3JhcEFycmF5OiBmdW5jdGlvbiAoYXJyKSB7XG4gICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzKGFyciwgdGhpcy5yZXZlcnNlTmFtZSwgdGhpcy5vYmplY3QpO1xuICAgICAgICAgICAgaWYgKCFhcnIuYXJyYXlPYnNlcnZlcikge1xuICAgICAgICAgICAgICAgIGFyci5hcnJheU9ic2VydmVyID0gbmV3IEFycmF5T2JzZXJ2ZXIoYXJyKTtcbiAgICAgICAgICAgICAgICB2YXIgb2JzZXJ2ZXJGdW5jdGlvbiA9IGZ1bmN0aW9uIChzcGxpY2VzKSB7XG4gICAgICAgICAgICAgICAgICAgIHNwbGljZXMuZm9yRWFjaChmdW5jdGlvbiAoc3BsaWNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgYWRkZWQgPSBzcGxpY2UuYWRkZWRDb3VudCA/IGFyci5zbGljZShzcGxpY2UuaW5kZXgsIHNwbGljZS5pbmRleCArIHNwbGljZS5hZGRlZENvdW50KSA6IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlbW92ZWQgPSBzcGxpY2UucmVtb3ZlZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuY2xlYXJSZXZlcnNlKHJlbW92ZWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5zZXRSZXZlcnNlT2ZBZGRlZChhZGRlZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbW9kZWwgPSBzZWxmLmdldEZvcndhcmRNb2RlbCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbjogbW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWw6IG1vZGVsLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9jYWxJZDogc2VsZi5vYmplY3QubG9jYWxJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWVsZDogc2VsZi5nZXRGb3J3YXJkTmFtZSgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWRkZWQ6IGFkZGVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRleDogc3BsaWNlLmluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iajogc2VsZi5vYmplY3RcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGFyci5hcnJheU9ic2VydmVyLm9wZW4ob2JzZXJ2ZXJGdW5jdGlvbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGdldDogZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgICAgICBjYihudWxsLCB0aGlzLnJlbGF0ZWQpO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfSxcbiAgICAgICAgdmFsaWRhdGU6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSAhPSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICdDYW5ub3QgYXNzaWduIHNjYWxhciB0byBtYW55IHRvIG1hbnknO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24gKG9iaiwgb3B0cykge1xuICAgICAgICAgICAgdGhpcy5jaGVja0luc3RhbGxlZCgpO1xuICAgICAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAgICAgaWYgKG9iaikge1xuICAgICAgICAgICAgICAgIHZhciBlcnJvck1lc3NhZ2U7XG4gICAgICAgICAgICAgICAgaWYgKGVycm9yTWVzc2FnZSA9IHRoaXMudmFsaWRhdGUob2JqKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JNZXNzYWdlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jbGVhclJldmVyc2VSZWxhdGVkKG9wdHMpO1xuICAgICAgICAgICAgICAgICAgICBzZWxmLnNldElkQW5kUmVsYXRlZChvYmosIG9wdHMpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLndyYXBBcnJheShvYmopO1xuICAgICAgICAgICAgICAgICAgICBzZWxmLnNldElkQW5kUmVsYXRlZFJldmVyc2Uob2JqLCBvcHRzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNsZWFyUmV2ZXJzZVJlbGF0ZWQob3B0cyk7XG4gICAgICAgICAgICAgICAgc2VsZi5zZXRJZEFuZFJlbGF0ZWQob2JqLCBvcHRzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgaW5zdGFsbDogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICAgICAgUmVsYXRpb25zaGlwUHJveHkucHJvdG90eXBlLmluc3RhbGwuY2FsbCh0aGlzLCBvYmopO1xuICAgICAgICAgICAgdGhpcy53cmFwQXJyYXkodGhpcy5yZWxhdGVkKTtcbiAgICAgICAgICAgIG9ialsoJ3NwbGljZScgKyB1dGlsLmNhcGl0YWxpc2VGaXJzdExldHRlcih0aGlzLnJldmVyc2VOYW1lKSldID0gXy5iaW5kKHRoaXMuc3BsaWNlLCB0aGlzKTtcbiAgICAgICAgfSxcbiAgICAgICAgcmVnaXN0ZXJSZW1vdmFsTGlzdGVuZXI6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgICAgIHRoaXMucmVsYXRlZENhbmNlbExpc3RlbmVyc1tvYmoubG9jYWxJZF0gPSBvYmoub24oJyonLCBmdW5jdGlvbiAoZSkge1xuXG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgfSk7XG5cblxuICAgIG1vZHVsZS5leHBvcnRzID0gTWFueVRvTWFueVByb3h5O1xufSkoKTsiLCIoZnVuY3Rpb24oKSB7XG4gIHZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpLFxuICAgIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICBfID0gdXRpbC5fLFxuICAgIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLFxuICAgIEludGVybmFsU2llc3RhRXJyb3IgPSBlcnJvci5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICAgIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gICAgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyk7XG5cbiAgZnVuY3Rpb24gTW9kZWxJbnN0YW5jZShtb2RlbCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB0aGlzLm1vZGVsID0gbW9kZWw7XG5cbiAgICB1dGlsLnN1YlByb3BlcnRpZXModGhpcywgdGhpcy5tb2RlbCwgW1xuICAgICAgJ2NvbGxlY3Rpb24nLFxuICAgICAgJ2NvbGxlY3Rpb25OYW1lJyxcbiAgICAgICdfYXR0cmlidXRlTmFtZXMnLFxuICAgICAge1xuICAgICAgICBuYW1lOiAnaWRGaWVsZCcsXG4gICAgICAgIHByb3BlcnR5OiAnaWQnXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiAnbW9kZWxOYW1lJyxcbiAgICAgICAgcHJvcGVydHk6ICduYW1lJ1xuICAgICAgfVxuICAgIF0pO1xuXG4gICAgZXZlbnRzLlByb3h5RXZlbnRFbWl0dGVyLmNhbGwodGhpcyk7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyh0aGlzLCB7XG4gICAgICBfcmVsYXRpb25zaGlwTmFtZXM6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgcHJveGllcyA9IF8ubWFwKE9iamVjdC5rZXlzKHNlbGYuX19wcm94aWVzIHx8IHt9KSwgZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgcmV0dXJuIHNlbGYuX19wcm94aWVzW3hdXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgcmV0dXJuIF8ubWFwKHByb3hpZXMsIGZ1bmN0aW9uKHApIHtcbiAgICAgICAgICAgIGlmIChwLmlzRm9yd2FyZCkge1xuICAgICAgICAgICAgICByZXR1cm4gcC5mb3J3YXJkTmFtZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHJldHVybiBwLnJldmVyc2VOYW1lO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgIH0sXG4gICAgICBkaXJ0eToge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGlmIChzaWVzdGEuZXh0LnN0b3JhZ2VFbmFibGVkKSB7XG4gICAgICAgICAgICByZXR1cm4gc2VsZi5sb2NhbElkIGluIHNpZXN0YS5leHQuc3RvcmFnZS5fdW5zYXZlZE9iamVjdHNIYXNoO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgIH0sXG4gICAgICAvLyBUaGlzIGlzIGZvciBQcm94eUV2ZW50RW1pdHRlci5cbiAgICAgIGV2ZW50OiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMubG9jYWxJZFxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0aGlzLnJlbW92ZWQgPSBmYWxzZTtcbiAgfVxuXG4gIE1vZGVsSW5zdGFuY2UucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShldmVudHMuUHJveHlFdmVudEVtaXR0ZXIucHJvdG90eXBlKTtcblxuICBfLmV4dGVuZChNb2RlbEluc3RhbmNlLnByb3RvdHlwZSwge1xuICAgIGdldDogZnVuY3Rpb24oY2IpIHtcbiAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICAgIGNiKG51bGwsIHRoaXMpO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9LFxuICAgIGVtaXQ6IGZ1bmN0aW9uKHR5cGUsIG9wdHMpIHtcbiAgICAgIGlmICh0eXBlb2YgdHlwZSA9PSAnb2JqZWN0Jykgb3B0cyA9IHR5cGU7XG4gICAgICBlbHNlIG9wdHMudHlwZSA9IHR5cGU7XG4gICAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICAgIF8uZXh0ZW5kKG9wdHMsIHtcbiAgICAgICAgY29sbGVjdGlvbjogdGhpcy5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgbW9kZWw6IHRoaXMubW9kZWwubmFtZSxcbiAgICAgICAgbG9jYWxJZDogdGhpcy5sb2NhbElkLFxuICAgICAgICBvYmo6IHRoaXNcbiAgICAgIH0pO1xuICAgICAgbW9kZWxFdmVudHMuZW1pdChvcHRzKTtcbiAgICB9LFxuICAgIHJlbW92ZTogZnVuY3Rpb24oY2IsIG5vdGlmaWNhdGlvbikge1xuICAgICAgbm90aWZpY2F0aW9uID0gbm90aWZpY2F0aW9uID09IG51bGwgPyB0cnVlIDogbm90aWZpY2F0aW9uO1xuICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgICAgY2FjaGUucmVtb3ZlKHRoaXMpO1xuICAgICAgICB0aGlzLnJlbW92ZWQgPSB0cnVlO1xuICAgICAgICBpZiAobm90aWZpY2F0aW9uKSB7XG4gICAgICAgICAgdGhpcy5lbWl0KG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlJlbW92ZSwge1xuICAgICAgICAgICAgb2xkOiB0aGlzXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHJlbW92ZSA9IHRoaXMubW9kZWwucmVtb3ZlO1xuICAgICAgICBpZiAocmVtb3ZlKSB7XG4gICAgICAgICAgdmFyIHBhcmFtTmFtZXMgPSB1dGlsLnBhcmFtTmFtZXMocmVtb3ZlKTtcbiAgICAgICAgICBpZiAocGFyYW1OYW1lcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIHJlbW92ZS5jYWxsKHRoaXMsIGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICBjYihlcnIsIHNlbGYpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmVtb3ZlLmNhbGwodGhpcyk7XG4gICAgICAgICAgICBjYihudWxsLCB0aGlzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgY2IobnVsbCwgdGhpcyk7XG4gICAgICAgIH1cbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfSxcbiAgICByZXN0b3JlOiBmdW5jdGlvbihjYikge1xuICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgICAgdmFyIF9maW5pc2ggPSBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgdGhpcy5lbWl0KG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLk5ldywge1xuICAgICAgICAgICAgICBuZXc6IHRoaXNcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjYihlcnIsIHRoaXMpO1xuICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgICAgIGlmICh0aGlzLnJlbW92ZWQpIHtcbiAgICAgICAgICBjYWNoZS5pbnNlcnQodGhpcyk7XG4gICAgICAgICAgdGhpcy5yZW1vdmVkID0gZmFsc2U7XG4gICAgICAgICAgdmFyIGluaXQgPSB0aGlzLm1vZGVsLmluaXQ7XG4gICAgICAgICAgaWYgKGluaXQpIHtcbiAgICAgICAgICAgIHZhciBwYXJhbU5hbWVzID0gdXRpbC5wYXJhbU5hbWVzKGluaXQpO1xuICAgICAgICAgICAgdmFyIGZyb21TdG9yYWdlID0gdHJ1ZTtcbiAgICAgICAgICAgIGlmIChwYXJhbU5hbWVzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgaW5pdC5jYWxsKHRoaXMsIGZyb21TdG9yYWdlLCBfZmluaXNoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICBpbml0LmNhbGwodGhpcywgZnJvbVN0b3JhZ2UpO1xuICAgICAgICAgICAgICBfZmluaXNoKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgX2ZpbmlzaCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIEluc3BlY3Rpb25cbiAgXy5leHRlbmQoTW9kZWxJbnN0YW5jZS5wcm90b3R5cGUsIHtcbiAgICBnZXRBdHRyaWJ1dGVzOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBfLmV4dGVuZCh7fSwgdGhpcy5fX3ZhbHVlcyk7XG4gICAgfSxcbiAgICBpc0luc3RhbmNlT2Y6IGZ1bmN0aW9uKG1vZGVsKSB7XG4gICAgICByZXR1cm4gdGhpcy5tb2RlbCA9PSBtb2RlbDtcbiAgICB9LFxuICAgIGlzQTogZnVuY3Rpb24obW9kZWwpIHtcbiAgICAgIHJldHVybiB0aGlzLm1vZGVsID09IG1vZGVsIHx8IHRoaXMubW9kZWwuaXNEZXNjZW5kYW50T2YobW9kZWwpO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gRHVtcFxuICBfLmV4dGVuZChNb2RlbEluc3RhbmNlLnByb3RvdHlwZSwge1xuICAgIF9kdW1wU3RyaW5nOiBmdW5jdGlvbihyZXZlcnNlUmVsYXRpb25zaGlwcykge1xuICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHRoaXMuX2R1bXAocmV2ZXJzZVJlbGF0aW9uc2hpcHMsIG51bGwsIDQpKTtcbiAgICB9LFxuICAgIF9kdW1wOiBmdW5jdGlvbihyZXZlcnNlUmVsYXRpb25zaGlwcykge1xuICAgICAgdmFyIGR1bXBlZCA9IF8uZXh0ZW5kKHt9LCB0aGlzLl9fdmFsdWVzKTtcbiAgICAgIGR1bXBlZC5fcmV2ID0gdGhpcy5fcmV2O1xuICAgICAgZHVtcGVkLmxvY2FsSWQgPSB0aGlzLmxvY2FsSWQ7XG4gICAgICByZXR1cm4gZHVtcGVkO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gU2VyaWFsaXNhdGlvblxuICBfLmV4dGVuZChNb2RlbEluc3RhbmNlLnByb3RvdHlwZSwge1xuICAgIF9kZWZhdWx0U2VyaWFsaXNlOiBmdW5jdGlvbihvcHRzKSB7XG4gICAgICB2YXIgc2VyaWFsaXNlZCA9IHt9O1xuICAgICAgdmFyIGluY2x1ZGVOdWxsQXR0cmlidXRlcyA9IG9wdHMuaW5jbHVkZU51bGxBdHRyaWJ1dGVzICE9PSB1bmRlZmluZWQgPyBvcHRzLmluY2x1ZGVOdWxsQXR0cmlidXRlcyA6IHRydWUsXG4gICAgICAgIGluY2x1ZGVOdWxsUmVsYXRpb25zaGlwcyA9IG9wdHMuaW5jbHVkZU51bGxSZWxhdGlvbnNoaXBzICE9PSB1bmRlZmluZWQgPyBvcHRzLmluY2x1ZGVOdWxsUmVsYXRpb25zaGlwcyA6IHRydWU7XG4gICAgICB2YXIgc2VyaWFsaXNhYmxlRmllbGRzID0gdGhpcy5tb2RlbC5zZXJpYWxpc2FibGVGaWVsZHMgfHxcbiAgICAgICAgdGhpcy5fYXR0cmlidXRlTmFtZXMuY29uY2F0LmFwcGx5KHRoaXMuX2F0dHJpYnV0ZU5hbWVzLCB0aGlzLl9yZWxhdGlvbnNoaXBOYW1lcykuY29uY2F0KHRoaXMuaWQpO1xuICAgICAgXy5lYWNoKHRoaXMuX2F0dHJpYnV0ZU5hbWVzLCBmdW5jdGlvbihhdHRyTmFtZSkge1xuICAgICAgICBpZiAoc2VyaWFsaXNhYmxlRmllbGRzLmluZGV4T2YoYXR0ck5hbWUpID4gLTEpIHtcbiAgICAgICAgICB2YXIgYXR0ckRlZmluaXRpb24gPSB0aGlzLm1vZGVsLl9hdHRyaWJ1dGVEZWZpbml0aW9uV2l0aE5hbWUoYXR0ck5hbWUpIHx8IHt9O1xuICAgICAgICAgIHZhciBzZXJpYWxpc2VyO1xuICAgICAgICAgIGlmIChhdHRyRGVmaW5pdGlvbi5zZXJpYWxpc2UpIHNlcmlhbGlzZXIgPSBhdHRyRGVmaW5pdGlvbi5zZXJpYWxpc2UuYmluZCh0aGlzKTtcbiAgICAgICAgICBlbHNlIHNlcmlhbGlzZXIgPSB0aGlzLm1vZGVsLnNlcmlhbGlzZUZpZWxkLmJpbmQodGhpcywgYXR0ck5hbWUpO1xuICAgICAgICAgIHZhciB2YWwgPSB0aGlzW2F0dHJOYW1lXTtcbiAgICAgICAgICBpZiAodmFsID09PSBudWxsKSB7XG4gICAgICAgICAgICBpZiAoaW5jbHVkZU51bGxBdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICAgIHNlcmlhbGlzZWRbYXR0ck5hbWVdID0gc2VyaWFsaXNlcih2YWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIGlmICh2YWwgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgc2VyaWFsaXNlZFthdHRyTmFtZV0gPSBzZXJpYWxpc2VyKHZhbCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgXy5lYWNoKHRoaXMuX3JlbGF0aW9uc2hpcE5hbWVzLCBmdW5jdGlvbihyZWxOYW1lKSB7XG4gICAgICAgIGlmIChzZXJpYWxpc2FibGVGaWVsZHMuaW5kZXhPZihyZWxOYW1lKSA+IC0xKSB7XG4gICAgICAgICAgdmFyIHZhbCA9IHRoaXNbcmVsTmFtZV0sXG4gICAgICAgICAgICByZWwgPSB0aGlzLm1vZGVsLnJlbGF0aW9uc2hpcHNbcmVsTmFtZV07XG4gICAgICAgICAgaWYgKHV0aWwuaXNBcnJheSh2YWwpKSB7XG4gICAgICAgICAgICB2YWwgPSBfLnBsdWNrKHZhbCwgdGhpcy5tb2RlbC5pZCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2UgaWYgKHZhbCkge1xuICAgICAgICAgICAgdmFsID0gdmFsW3RoaXMubW9kZWwuaWRdO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAocmVsICYmICFyZWwuaXNSZXZlcnNlKSB7XG4gICAgICAgICAgICB2YXIgc2VyaWFsaXNlcjtcbiAgICAgICAgICAgIGlmIChyZWwuc2VyaWFsaXNlKSBzZXJpYWxpc2VyID0gcmVsLnNlcmlhbGlzZS5iaW5kKHRoaXMpO1xuICAgICAgICAgICAgZWxzZSBzZXJpYWxpc2VyID0gdGhpcy5tb2RlbC5zZXJpYWxpc2VGaWVsZC5iaW5kKHRoaXMsIHJlbE5hbWUpO1xuICAgICAgICAgICAgaWYgKHZhbCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICBpZiAoaW5jbHVkZU51bGxSZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgICAgICAgICAgc2VyaWFsaXNlZFtyZWxOYW1lXSA9IHNlcmlhbGlzZXIodmFsKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodXRpbC5pc0FycmF5KHZhbCkpIHtcbiAgICAgICAgICAgICAgaWYgKChpbmNsdWRlTnVsbFJlbGF0aW9uc2hpcHMgJiYgIXZhbC5sZW5ndGgpIHx8IHZhbC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBzZXJpYWxpc2VkW3JlbE5hbWVdID0gc2VyaWFsaXNlcih2YWwpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh2YWwgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICBzZXJpYWxpc2VkW3JlbE5hbWVdID0gc2VyaWFsaXNlcih2YWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgIHJldHVybiBzZXJpYWxpc2VkO1xuICAgIH0sXG4gICAgc2VyaWFsaXNlOiBmdW5jdGlvbihvcHRzKSB7XG4gICAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICAgIGlmICghdGhpcy5tb2RlbC5zZXJpYWxpc2UpIHJldHVybiB0aGlzLl9kZWZhdWx0U2VyaWFsaXNlKG9wdHMpO1xuICAgICAgZWxzZSByZXR1cm4gdGhpcy5tb2RlbC5zZXJpYWxpc2UodGhpcywgb3B0cyk7XG4gICAgfVxuICB9KTtcblxuICBtb2R1bGUuZXhwb3J0cyA9IE1vZGVsSW5zdGFuY2U7XG59KSgpOyIsIihmdW5jdGlvbiAoKSB7XG4gICAgdmFyIFJlbGF0aW9uc2hpcFByb3h5ID0gcmVxdWlyZSgnLi9SZWxhdGlvbnNoaXBQcm94eScpLFxuICAgICAgICBTdG9yZSA9IHJlcXVpcmUoJy4vc3RvcmUnKSxcbiAgICAgICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgICAgICBfID0gdXRpbC5fLFxuICAgICAgICBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgICAgIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICAgICAgICBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICAgICAgICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzID0gZXZlbnRzLndyYXBBcnJheSxcbiAgICAgICAgQXJyYXlPYnNlcnZlciA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuQXJyYXlPYnNlcnZlcixcbiAgICAgICAgTW9kZWxFdmVudFR5cGUgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJykuTW9kZWxFdmVudFR5cGU7XG5cbiAgICAvKipcbiAgICAgKiBAY2xhc3MgIFtPbmVUb01hbnlQcm94eSBkZXNjcmlwdGlvbl1cbiAgICAgKiBAY29uc3RydWN0b3JcbiAgICAgKiBAcGFyYW0ge1t0eXBlXX0gb3B0c1xuICAgICAqL1xuICAgIGZ1bmN0aW9uIE9uZVRvTWFueVByb3h5KG9wdHMpIHtcbiAgICAgICAgUmVsYXRpb25zaGlwUHJveHkuY2FsbCh0aGlzLCBvcHRzKTtcbiAgICAgICAgaWYgKHRoaXMuaXNSZXZlcnNlKSB0aGlzLnJlbGF0ZWQgPSBbXTtcbiAgICB9XG5cbiAgICBPbmVUb01hbnlQcm94eS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZSk7XG5cbiAgICBfLmV4dGVuZChPbmVUb01hbnlQcm94eS5wcm90b3R5cGUsIHtcbiAgICAgICAgY2xlYXJSZXZlcnNlOiBmdW5jdGlvbiAocmVtb3ZlZCkge1xuICAgICAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAgICAgXy5lYWNoKHJlbW92ZWQsIGZ1bmN0aW9uIChyZW1vdmVkT2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgdmFyIHJldmVyc2VQcm94eSA9IHNlbGYucmV2ZXJzZVByb3h5Rm9ySW5zdGFuY2UocmVtb3ZlZE9iamVjdCk7XG4gICAgICAgICAgICAgICAgcmV2ZXJzZVByb3h5LnNldElkQW5kUmVsYXRlZChudWxsKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBzZXRSZXZlcnNlT2ZBZGRlZDogZnVuY3Rpb24gKGFkZGVkKSB7XG4gICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICBfLmVhY2goYWRkZWQsIGZ1bmN0aW9uIChhZGRlZCkge1xuICAgICAgICAgICAgICAgIHZhciBmb3J3YXJkUHJveHkgPSBzZWxmLnJldmVyc2VQcm94eUZvckluc3RhbmNlKGFkZGVkKTtcbiAgICAgICAgICAgICAgICBmb3J3YXJkUHJveHkuc2V0SWRBbmRSZWxhdGVkKHNlbGYub2JqZWN0KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICB3cmFwQXJyYXk6IGZ1bmN0aW9uIChhcnIpIHtcbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIHdyYXBBcnJheUZvckF0dHJpYnV0ZXMoYXJyLCB0aGlzLnJldmVyc2VOYW1lLCB0aGlzLm9iamVjdCk7XG4gICAgICAgICAgICBpZiAoIWFyci5hcnJheU9ic2VydmVyKSB7XG4gICAgICAgICAgICAgICAgYXJyLmFycmF5T2JzZXJ2ZXIgPSBuZXcgQXJyYXlPYnNlcnZlcihhcnIpO1xuICAgICAgICAgICAgICAgIHZhciBvYnNlcnZlckZ1bmN0aW9uID0gZnVuY3Rpb24gKHNwbGljZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgc3BsaWNlcy5mb3JFYWNoKGZ1bmN0aW9uIChzcGxpY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBhZGRlZCA9IHNwbGljZS5hZGRlZENvdW50ID8gYXJyLnNsaWNlKHNwbGljZS5pbmRleCwgc3BsaWNlLmluZGV4ICsgc3BsaWNlLmFkZGVkQ291bnQpIDogW107XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcmVtb3ZlZCA9IHNwbGljZS5yZW1vdmVkO1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5jbGVhclJldmVyc2UocmVtb3ZlZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLnNldFJldmVyc2VPZkFkZGVkKGFkZGVkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBtb2RlbCA9IHNlbGYuZ2V0Rm9yd2FyZE1vZGVsKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBtb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtb2RlbDogbW9kZWwubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2NhbElkOiBzZWxmLm9iamVjdC5sb2NhbElkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpZWxkOiBzZWxmLmdldEZvcndhcmROYW1lKCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlZDogcmVtb3ZlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhZGRlZDogYWRkZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4OiBzcGxpY2UuaW5kZXgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqOiBzZWxmLm9iamVjdFxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgYXJyLmFycmF5T2JzZXJ2ZXIub3BlbihvYnNlcnZlckZ1bmN0aW9uKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgICAgIGNiKG51bGwsIHRoaXMucmVsYXRlZCk7XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9LFxuICAgICAgICAvKipcbiAgICAgICAgICogVmFsaWRhdGUgdGhlIG9iamVjdCB0aGF0IHdlJ3JlIHNldHRpbmdcbiAgICAgICAgICogQHBhcmFtIG9ialxuICAgICAgICAgKiBAcmV0dXJucyB7c3RyaW5nfG51bGx9IEFuIGVycm9yIG1lc3NhZ2Ugb3IgbnVsbFxuICAgICAgICAgKiBAY2xhc3MgT25lVG9NYW55UHJveHlcbiAgICAgICAgICovXG4gICAgICAgIHZhbGlkYXRlOiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgICAgICB2YXIgc3RyID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaik7XG4gICAgICAgICAgICBpZiAodGhpcy5pc0ZvcndhcmQpIHtcbiAgICAgICAgICAgICAgICBpZiAoc3RyID09ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICdDYW5ub3QgYXNzaWduIGFycmF5IGZvcndhcmQgb25lVG9NYW55ICgnICsgc3RyICsgJyk6ICcgKyB0aGlzLmZvcndhcmROYW1lO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChzdHIgIT0gJ1tvYmplY3QgQXJyYXldJykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ0Nhbm5vdCBzY2FsYXIgdG8gcmV2ZXJzZSBvbmVUb01hbnkgKCcgKyBzdHIgKyAnKTogJyArIHRoaXMucmV2ZXJzZU5hbWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24gKG9iaiwgb3B0cykge1xuICAgICAgICAgICAgdGhpcy5jaGVja0luc3RhbGxlZCgpO1xuICAgICAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAgICAgaWYgKG9iaikge1xuICAgICAgICAgICAgICAgIHZhciBlcnJvck1lc3NhZ2U7XG4gICAgICAgICAgICAgICAgaWYgKGVycm9yTWVzc2FnZSA9IHRoaXMudmFsaWRhdGUob2JqKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JNZXNzYWdlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jbGVhclJldmVyc2VSZWxhdGVkKG9wdHMpO1xuICAgICAgICAgICAgICAgICAgICBzZWxmLnNldElkQW5kUmVsYXRlZChvYmosIG9wdHMpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2VsZi5pc1JldmVyc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMud3JhcEFycmF5KHNlbGYucmVsYXRlZCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgc2VsZi5zZXRJZEFuZFJlbGF0ZWRSZXZlcnNlKG9iaiwgb3B0cyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jbGVhclJldmVyc2VSZWxhdGVkKG9wdHMpO1xuICAgICAgICAgICAgICAgIHNlbGYuc2V0SWRBbmRSZWxhdGVkKG9iaiwgb3B0cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGluc3RhbGw6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgICAgIFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZS5pbnN0YWxsLmNhbGwodGhpcywgb2JqKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuaXNSZXZlcnNlKSB7XG4gICAgICAgICAgICAgICAgb2JqWygnc3BsaWNlJyArIHV0aWwuY2FwaXRhbGlzZUZpcnN0TGV0dGVyKHRoaXMucmV2ZXJzZU5hbWUpKV0gPSBfLmJpbmQodGhpcy5zcGxpY2UsIHRoaXMpO1xuICAgICAgICAgICAgICAgIHRoaXMud3JhcEFycmF5KHRoaXMucmVsYXRlZCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuICAgIH0pO1xuXG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IE9uZVRvTWFueVByb3h5O1xufSkoKTsiLCIoZnVuY3Rpb24gKCkge1xuICAgIHZhciBSZWxhdGlvbnNoaXBQcm94eSA9IHJlcXVpcmUoJy4vUmVsYXRpb25zaGlwUHJveHknKSxcbiAgICAgICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgICAgICBfID0gdXRpbC5fLFxuICAgICAgICBTaWVzdGFNb2RlbCA9IHJlcXVpcmUoJy4vTW9kZWxJbnN0YW5jZScpO1xuXG4gICAgLyoqXG4gICAgICogW09uZVRvT25lUHJveHkgZGVzY3JpcHRpb25dXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9wdHNcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBPbmVUb09uZVByb3h5KG9wdHMpIHtcbiAgICAgICAgUmVsYXRpb25zaGlwUHJveHkuY2FsbCh0aGlzLCBvcHRzKTtcbiAgICB9XG5cblxuICAgIE9uZVRvT25lUHJveHkucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUpO1xuXG4gICAgXy5leHRlbmQoT25lVG9PbmVQcm94eS5wcm90b3R5cGUsIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFZhbGlkYXRlIHRoZSBvYmplY3QgdGhhdCB3ZSdyZSBzZXR0aW5nXG4gICAgICAgICAqIEBwYXJhbSBvYmpcbiAgICAgICAgICogQHJldHVybnMge3N0cmluZ3xudWxsfSBBbiBlcnJvciBtZXNzYWdlIG9yIG51bGxcbiAgICAgICAgICovXG4gICAgICAgIHZhbGlkYXRlOiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgICAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaikgPT0gJ1tvYmplY3QgQXJyYXldJykge1xuICAgICAgICAgICAgICAgIHJldHVybiAnQ2Fubm90IGFzc2lnbiBhcnJheSB0byBvbmUgdG8gb25lIHJlbGF0aW9uc2hpcCc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICgoIW9iaiBpbnN0YW5jZW9mIFNpZXN0YU1vZGVsKSkge1xuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAob2JqLCBvcHRzKSB7XG4gICAgICAgICAgICB0aGlzLmNoZWNrSW5zdGFsbGVkKCk7XG4gICAgICAgICAgICBpZiAob2JqKSB7XG4gICAgICAgICAgICAgICAgdmFyIGVycm9yTWVzc2FnZTtcbiAgICAgICAgICAgICAgICBpZiAoZXJyb3JNZXNzYWdlID0gdGhpcy52YWxpZGF0ZShvYmopKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBlcnJvck1lc3NhZ2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNsZWFyUmV2ZXJzZVJlbGF0ZWQob3B0cyk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0SWRBbmRSZWxhdGVkKG9iaiwgb3B0cyk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0SWRBbmRSZWxhdGVkUmV2ZXJzZShvYmosIG9wdHMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuY2xlYXJSZXZlcnNlUmVsYXRlZChvcHRzKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNldElkQW5kUmVsYXRlZChvYmosIG9wdHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBnZXQ6IGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICAgICAgY2IobnVsbCwgdGhpcy5yZWxhdGVkKTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBPbmVUb09uZVByb3h5O1xufSkoKTsiLCIoZnVuY3Rpb24oKSB7XG4gICAgdmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJykoJ3F1ZXJ5JyksXG4gICAgICAgIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpLFxuICAgICAgICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gICAgICAgIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLFxuICAgICAgICBNb2RlbEluc3RhbmNlID0gcmVxdWlyZSgnLi9Nb2RlbEluc3RhbmNlJyksXG4gICAgICAgIGNvbnN0cnVjdFF1ZXJ5U2V0ID0gcmVxdWlyZSgnLi9RdWVyeVNldCcpLFxuICAgICAgICBfID0gdXRpbC5fO1xuXG4gICAgLyoqXG4gICAgICogQGNsYXNzIFtRdWVyeSBkZXNjcmlwdGlvbl1cbiAgICAgKiBAcGFyYW0ge01vZGVsfSBtb2RlbFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBxdWVyeVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIFF1ZXJ5KG1vZGVsLCBxdWVyeSkge1xuICAgICAgICB2YXIgb3B0cyA9IHt9O1xuICAgICAgICBmb3IgKHZhciBwcm9wIGluIHF1ZXJ5KSB7XG4gICAgICAgICAgICBpZiAocXVlcnkuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgICAgICAgICBpZiAocHJvcC5zbGljZSgwLCAyKSA9PSAnX18nKSB7XG4gICAgICAgICAgICAgICAgICAgIG9wdHNbcHJvcC5zbGljZSgyKV0gPSBxdWVyeVtwcm9wXTtcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHF1ZXJ5W3Byb3BdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBfLmV4dGVuZCh0aGlzLCB7XG4gICAgICAgICAgICBtb2RlbDogbW9kZWwsXG4gICAgICAgICAgICBxdWVyeTogcXVlcnksXG4gICAgICAgICAgICBvcHRzOiBvcHRzXG4gICAgICAgIH0pO1xuICAgICAgICBvcHRzLm9yZGVyID0gb3B0cy5vcmRlciB8fCBbXTtcbiAgICAgICAgaWYgKCF1dGlsLmlzQXJyYXkob3B0cy5vcmRlcikpIG9wdHMub3JkZXIgPSBbb3B0cy5vcmRlcl07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdmFsdWVBc1N0cmluZyhmaWVsZFZhbHVlKSB7XG4gICAgICAgIHZhciBmaWVsZEFzU3RyaW5nO1xuICAgICAgICBpZiAoZmllbGRWYWx1ZSA9PT0gbnVsbCkgZmllbGRBc1N0cmluZyA9ICdudWxsJztcbiAgICAgICAgZWxzZSBpZiAoZmllbGRWYWx1ZSA9PT0gdW5kZWZpbmVkKSBmaWVsZEFzU3RyaW5nID0gJ3VuZGVmaW5lZCc7XG4gICAgICAgIGVsc2UgaWYgKGZpZWxkVmFsdWUgaW5zdGFuY2VvZiBNb2RlbEluc3RhbmNlKSBmaWVsZEFzU3RyaW5nID0gZmllbGRWYWx1ZS5sb2NhbElkO1xuICAgICAgICBlbHNlIGZpZWxkQXNTdHJpbmcgPSBmaWVsZFZhbHVlLnRvU3RyaW5nKCk7XG4gICAgICAgIHJldHVybiBmaWVsZEFzU3RyaW5nO1xuICAgIH1cblxuICAgIHZhciBjb21wYXJhdG9ycyA9IHtcbiAgICAgICAgZTogZnVuY3Rpb24ob3B0cykge1xuICAgICAgICAgICAgdmFyIGZpZWxkVmFsdWUgPSBvcHRzLm9iamVjdFtvcHRzLmZpZWxkXTtcbiAgICAgICAgICAgIGlmIChsb2cuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIGxvZyhvcHRzLmZpZWxkICsgJzogJyArIHZhbHVlQXNTdHJpbmcoZmllbGRWYWx1ZSkgKyAnID09ICcgKyB2YWx1ZUFzU3RyaW5nKG9wdHMudmFsdWUpLCB7b3B0czogb3B0c30pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGZpZWxkVmFsdWUgPT0gb3B0cy52YWx1ZTtcbiAgICAgICAgfSxcbiAgICAgICAgbHQ6IGZ1bmN0aW9uKG9wdHMpIHtcbiAgICAgICAgICAgIGlmICghb3B0cy5pbnZhbGlkKSByZXR1cm4gb3B0cy5vYmplY3Rbb3B0cy5maWVsZF0gPCBvcHRzLnZhbHVlO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9LFxuICAgICAgICBndDogZnVuY3Rpb24ob3B0cykge1xuICAgICAgICAgICAgaWYgKCFvcHRzLmludmFsaWQpIHJldHVybiBvcHRzLm9iamVjdFtvcHRzLmZpZWxkXSA+IG9wdHMudmFsdWU7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0sXG4gICAgICAgIGx0ZTogZnVuY3Rpb24ob3B0cykge1xuICAgICAgICAgICAgaWYgKCFvcHRzLmludmFsaWQpIHJldHVybiBvcHRzLm9iamVjdFtvcHRzLmZpZWxkXSA8PSBvcHRzLnZhbHVlO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9LFxuICAgICAgICBndGU6IGZ1bmN0aW9uKG9wdHMpIHtcbiAgICAgICAgICAgIGlmICghb3B0cy5pbnZhbGlkKSByZXR1cm4gb3B0cy5vYmplY3Rbb3B0cy5maWVsZF0gPj0gb3B0cy52YWx1ZTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSxcbiAgICAgICAgY29udGFpbnM6IGZ1bmN0aW9uKG9wdHMpIHtcbiAgICAgICAgICAgIGlmICghb3B0cy5pbnZhbGlkKSB7XG4gICAgICAgICAgICAgICAgdmFyIGFyciA9IG9wdHMub2JqZWN0W29wdHMuZmllbGRdO1xuICAgICAgICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkoYXJyKSB8fCB1dGlsLmlzU3RyaW5nKGFycikpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGFyci5pbmRleE9mKG9wdHMudmFsdWUpID4gLTE7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIF8uZXh0ZW5kKFF1ZXJ5LCB7XG4gICAgICAgIGNvbXBhcmF0b3JzOiBjb21wYXJhdG9ycyxcbiAgICAgICAgcmVnaXN0ZXJDb21wYXJhdG9yOiBmdW5jdGlvbihzeW1ib2wsIGZuKSB7XG4gICAgICAgICAgICBpZiAoIWNvbXBhcmF0b3JzW3N5bWJvbF0pIHtcbiAgICAgICAgICAgICAgICBjb21wYXJhdG9yc1tzeW1ib2xdID0gZm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGZ1bmN0aW9uIGNhY2hlRm9yTW9kZWwobW9kZWwpIHtcbiAgICAgICAgdmFyIGNhY2hlQnlUeXBlID0gY2FjaGUuX2xvY2FsQ2FjaGVCeVR5cGU7XG4gICAgICAgIHZhciBtb2RlbE5hbWUgPSBtb2RlbC5uYW1lO1xuICAgICAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBtb2RlbC5jb2xsZWN0aW9uTmFtZTtcbiAgICAgICAgdmFyIGNhY2hlQnlNb2RlbCA9IGNhY2hlQnlUeXBlW2NvbGxlY3Rpb25OYW1lXTtcbiAgICAgICAgdmFyIGNhY2hlQnlMb2NhbElkO1xuICAgICAgICBpZiAoY2FjaGVCeU1vZGVsKSB7XG4gICAgICAgICAgICBjYWNoZUJ5TG9jYWxJZCA9IGNhY2hlQnlNb2RlbFttb2RlbE5hbWVdIHx8IHt9O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjYWNoZUJ5TG9jYWxJZDtcbiAgICB9XG5cbiAgICBfLmV4dGVuZChRdWVyeS5wcm90b3R5cGUsIHtcbiAgICAgICAgZXhlY3V0ZTogZnVuY3Rpb24oY2IpIHtcbiAgICAgICAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZXhlY3V0ZUluTWVtb3J5KGNiKTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH0sXG4gICAgICAgIF9kdW1wOiBmdW5jdGlvbihhc0pzb24pIHtcbiAgICAgICAgICAgIHJldHVybiBhc0pzb24gPyAne30nIDoge307XG4gICAgICAgIH0sXG4gICAgICAgIHNvcnRGdW5jOiBmdW5jdGlvbihmaWVsZHMpIHtcbiAgICAgICAgICAgIHZhciBzb3J0RnVuYyA9IGZ1bmN0aW9uKGFzY2VuZGluZywgZmllbGQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24odjEsIHYyKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBkMSA9IHYxW2ZpZWxkXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGQyID0gdjJbZmllbGRdLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzO1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGQxID09ICdzdHJpbmcnIHx8IGQxIGluc3RhbmNlb2YgU3RyaW5nICYmXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlb2YgZDIgPT0gJ3N0cmluZycgfHwgZDIgaW5zdGFuY2VvZiBTdHJpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcyA9IGFzY2VuZGluZyA/IGQxLmxvY2FsZUNvbXBhcmUoZDIpIDogZDIubG9jYWxlQ29tcGFyZShkMSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZDEgaW5zdGFuY2VvZiBEYXRlKSBkMSA9IGQxLmdldFRpbWUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkMiBpbnN0YW5jZW9mIERhdGUpIGQyID0gZDIuZ2V0VGltZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFzY2VuZGluZykgcmVzID0gZDEgLSBkMjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgcmVzID0gZDIgLSBkMTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB2YXIgcyA9IHV0aWw7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGZpZWxkcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBmaWVsZCA9IGZpZWxkc1tpXTtcbiAgICAgICAgICAgICAgICBzID0gcy50aGVuQnkoc29ydEZ1bmMoZmllbGQuYXNjZW5kaW5nLCBmaWVsZC5maWVsZCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHMgPT0gdXRpbCA/IG51bGwgOiBzO1xuICAgICAgICB9LFxuICAgICAgICBfc29ydFJlc3VsdHM6IGZ1bmN0aW9uKHJlcykge1xuICAgICAgICAgICAgdmFyIG9yZGVyID0gdGhpcy5vcHRzLm9yZGVyO1xuICAgICAgICAgICAgaWYgKHJlcyAmJiBvcmRlcikge1xuICAgICAgICAgICAgICAgIHZhciBmaWVsZHMgPSBfLm1hcChvcmRlciwgZnVuY3Rpb24ob3JkZXJpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHNwbHQgPSBvcmRlcmluZy5zcGxpdCgnLScpLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXNjZW5kaW5nID0gdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpZWxkID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNwbHQubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZmllbGQgPSBzcGx0WzFdO1xuICAgICAgICAgICAgICAgICAgICAgICAgYXNjZW5kaW5nID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmaWVsZCA9IHNwbHRbMF07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtmaWVsZDogZmllbGQsIGFzY2VuZGluZzogYXNjZW5kaW5nfTtcbiAgICAgICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgICAgICAgIHZhciBzb3J0RnVuYyA9IHRoaXMuc29ydEZ1bmMoZmllbGRzKTtcbiAgICAgICAgICAgICAgICBpZiAocmVzLmltbXV0YWJsZSkgcmVzID0gcmVzLm11dGFibGVDb3B5KCk7XG4gICAgICAgICAgICAgICAgaWYgKHNvcnRGdW5jKSByZXMuc29ydChzb3J0RnVuYyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcmVzO1xuICAgICAgICB9LFxuICAgICAgICAvKipcbiAgICAgICAgICogUmV0dXJuIGFsbCBtb2RlbCBpbnN0YW5jZXMgaW4gdGhlIGNhY2hlLlxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgX2dldENhY2hlQnlMb2NhbElkOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiBfLnJlZHVjZSh0aGlzLm1vZGVsLmRlc2NlbmRhbnRzLCBmdW5jdGlvbihtZW1vLCBjaGlsZE1vZGVsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIF8uZXh0ZW5kKG1lbW8sIGNhY2hlRm9yTW9kZWwoY2hpbGRNb2RlbCkpO1xuICAgICAgICAgICAgfSwgXy5leHRlbmQoe30sIGNhY2hlRm9yTW9kZWwodGhpcy5tb2RlbCkpKTtcbiAgICAgICAgfSxcbiAgICAgICAgX2V4ZWN1dGVJbk1lbW9yeTogZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICAgICAgICAgIHZhciBfZXhlY3V0ZUluTWVtb3J5ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgdmFyIGNhY2hlQnlMb2NhbElkID0gdGhpcy5fZ2V0Q2FjaGVCeUxvY2FsSWQoKTtcbiAgICAgICAgICAgICAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKGNhY2hlQnlMb2NhbElkKTtcbiAgICAgICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICAgICAgdmFyIHJlcyA9IFtdO1xuICAgICAgICAgICAgICAgIHZhciBlcnI7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBrID0ga2V5c1tpXTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG9iaiA9IGNhY2hlQnlMb2NhbElkW2tdO1xuICAgICAgICAgICAgICAgICAgICB2YXIgbWF0Y2hlcyA9IHNlbGYub2JqZWN0TWF0Y2hlc1F1ZXJ5KG9iaik7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YobWF0Y2hlcykgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVyciA9IGVycm9yKG1hdGNoZXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobWF0Y2hlcykgcmVzLnB1c2gob2JqKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXMgPSB0aGlzLl9zb3J0UmVzdWx0cyhyZXMpO1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIGxvZygnRXJyb3IgZXhlY3V0aW5nIHF1ZXJ5JywgZXJyKTtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIsIGVyciA/IG51bGwgOiBjb25zdHJ1Y3RRdWVyeVNldChyZXMsIHRoaXMubW9kZWwpKTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICAgICAgICAgIGlmICh0aGlzLm9wdHMuaWdub3JlSW5zdGFsbGVkKSB7XG4gICAgICAgICAgICAgICAgX2V4ZWN1dGVJbk1lbW9yeSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgc2llc3RhLl9hZnRlckluc3RhbGwoX2V4ZWN1dGVJbk1lbW9yeSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfSxcbiAgICAgICAgY2xlYXJPcmRlcmluZzogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB0aGlzLm9wdHMub3JkZXIgPSBudWxsO1xuICAgICAgICB9LFxuICAgICAgICBvYmplY3RNYXRjaGVzT3JRdWVyeTogZnVuY3Rpb24ob2JqLCBvclF1ZXJ5KSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpZHggaW4gb3JRdWVyeSkge1xuICAgICAgICAgICAgICAgIGlmIChvclF1ZXJ5Lmhhc093blByb3BlcnR5KGlkeCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHF1ZXJ5ID0gb3JRdWVyeVtpZHhdO1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5vYmplY3RNYXRjaGVzQmFzZVF1ZXJ5KG9iaiwgcXVlcnkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSxcbiAgICAgICAgb2JqZWN0TWF0Y2hlc0FuZFF1ZXJ5OiBmdW5jdGlvbihvYmosIGFuZFF1ZXJ5KSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpZHggaW4gYW5kUXVlcnkpIHtcbiAgICAgICAgICAgICAgICBpZiAoYW5kUXVlcnkuaGFzT3duUHJvcGVydHkoaWR4KSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcXVlcnkgPSBhbmRRdWVyeVtpZHhdO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMub2JqZWN0TWF0Y2hlc0Jhc2VRdWVyeShvYmosIHF1ZXJ5KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0sXG4gICAgICAgIHNwbGl0TWF0Y2hlczogZnVuY3Rpb24ob2JqLCB1bnByb2Nlc3NlZEZpZWxkLCB2YWx1ZSkge1xuICAgICAgICAgICAgdmFyIG9wID0gJ2UnO1xuICAgICAgICAgICAgdmFyIGZpZWxkcyA9IHVucHJvY2Vzc2VkRmllbGQuc3BsaXQoJy4nKTtcbiAgICAgICAgICAgIHZhciBzcGx0ID0gZmllbGRzW2ZpZWxkcy5sZW5ndGggLSAxXS5zcGxpdCgnX18nKTtcbiAgICAgICAgICAgIGlmIChzcGx0Lmxlbmd0aCA9PSAyKSB7XG4gICAgICAgICAgICAgICAgdmFyIGZpZWxkID0gc3BsdFswXTtcbiAgICAgICAgICAgICAgICBvcCA9IHNwbHRbMV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBmaWVsZCA9IHNwbHRbMF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmaWVsZHNbZmllbGRzLmxlbmd0aCAtIDFdID0gZmllbGQ7XG4gICAgICAgICAgICBfLmVhY2goZmllbGRzLnNsaWNlKDAsIGZpZWxkcy5sZW5ndGggLSAxKSwgZnVuY3Rpb24oZikge1xuICAgICAgICAgICAgICAgIG9iaiA9IG9ialtmXTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgLy8gSWYgd2UgZ2V0IHRvIHRoZSBwb2ludCB3aGVyZSB3ZSdyZSBhYm91dCB0byBpbmRleCBudWxsIG9yIHVuZGVmaW5lZCB3ZSBzdG9wIC0gb2J2aW91c2x5IHRoaXMgb2JqZWN0IGRvZXNcbiAgICAgICAgICAgIC8vIG5vdCBtYXRjaCB0aGUgcXVlcnkuXG4gICAgICAgICAgICB2YXIgbm90TnVsbE9yVW5kZWZpbmVkID0gb2JqICE9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIGlmIChub3ROdWxsT3JVbmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICB2YXIgdmFsID0gb2JqW2ZpZWxkXTsgLy8gQnJlYWtzIGhlcmUuXG4gICAgICAgICAgICAgICAgdmFyIGludmFsaWQgPSB2YWwgPT09IG51bGwgfHwgdmFsID09PSB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgdmFyIGNvbXBhcmF0b3IgPSBRdWVyeS5jb21wYXJhdG9yc1tvcF0sXG4gICAgICAgICAgICAgICAgICAgIG9wdHMgPSB7b2JqZWN0OiBvYmosIGZpZWxkOiBmaWVsZCwgdmFsdWU6IHZhbHVlLCBpbnZhbGlkOiBpbnZhbGlkfTtcbiAgICAgICAgICAgICAgICBpZiAoIWNvbXBhcmF0b3IpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICdObyBjb21wYXJhdG9yIHJlZ2lzdGVyZWQgZm9yIHF1ZXJ5IG9wZXJhdGlvbiBcIicgKyBvcCArICdcIic7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBjb21wYXJhdG9yKG9wdHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9LFxuICAgICAgICBvYmplY3RNYXRjaGVzOiBmdW5jdGlvbihvYmosIHVucHJvY2Vzc2VkRmllbGQsIHZhbHVlLCBxdWVyeSkge1xuICAgICAgICAgICAgaWYgKHVucHJvY2Vzc2VkRmllbGQgPT0gJyRvcicpIHtcbiAgICAgICAgICAgICAgICB2YXIgJG9yID0gcXVlcnlbJyRvciddO1xuICAgICAgICAgICAgICAgIGlmICghdXRpbC5pc0FycmF5KCRvcikpIHtcbiAgICAgICAgICAgICAgICAgICAgJG9yID0gT2JqZWN0LmtleXMoJG9yKS5tYXAoZnVuY3Rpb24oaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5vcm1hbGlzZWQgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vcm1hbGlzZWRba10gPSAkb3Jba107XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbm9ybWFsaXNlZDtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICghdGhpcy5vYmplY3RNYXRjaGVzT3JRdWVyeShvYmosICRvcikpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHVucHJvY2Vzc2VkRmllbGQgPT0gJyRhbmQnKSB7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLm9iamVjdE1hdGNoZXNBbmRRdWVyeShvYmosIHF1ZXJ5WyckYW5kJ10pKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YXIgbWF0Y2hlcyA9IHRoaXMuc3BsaXRNYXRjaGVzKG9iaiwgdW5wcm9jZXNzZWRGaWVsZCwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgbWF0Y2hlcyAhPSAnYm9vbGVhbicpIHJldHVybiBtYXRjaGVzO1xuICAgICAgICAgICAgICAgIGlmICghbWF0Y2hlcykgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0sXG4gICAgICAgIG9iamVjdE1hdGNoZXNCYXNlUXVlcnk6IGZ1bmN0aW9uKG9iaiwgcXVlcnkpIHtcbiAgICAgICAgICAgIHZhciBmaWVsZHMgPSBPYmplY3Qua2V5cyhxdWVyeSk7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGZpZWxkcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciB1bnByb2Nlc3NlZEZpZWxkID0gZmllbGRzW2ldLFxuICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9IHF1ZXJ5W3VucHJvY2Vzc2VkRmllbGRdO1xuICAgICAgICAgICAgICAgIHZhciBydCA9IHRoaXMub2JqZWN0TWF0Y2hlcyhvYmosIHVucHJvY2Vzc2VkRmllbGQsIHZhbHVlLCBxdWVyeSk7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBydCAhPSAnYm9vbGVhbicpIHJldHVybiBydDtcbiAgICAgICAgICAgICAgICBpZiAoIXJ0KSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSxcbiAgICAgICAgb2JqZWN0TWF0Y2hlc1F1ZXJ5OiBmdW5jdGlvbihvYmopIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm9iamVjdE1hdGNoZXNCYXNlUXVlcnkob2JqLCB0aGlzLnF1ZXJ5KTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBRdWVyeTtcbn0pKCk7IiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICBQcm9taXNlID0gdXRpbC5Qcm9taXNlLFxuICAgIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLFxuICAgIE1vZGVsSW5zdGFuY2UgPSByZXF1aXJlKCcuL01vZGVsSW5zdGFuY2UnKSxcbiAgICBfID0gcmVxdWlyZSgnLi91dGlsJykuXztcblxuLypcbiBUT0RPOiBVc2UgRVM2IFByb3h5IGluc3RlYWQuXG4gRXZlbnR1YWxseSBxdWVyeSBzZXRzIHNob3VsZCB1c2UgRVM2IFByb3hpZXMgd2hpY2ggd2lsbCBiZSBtdWNoIG1vcmUgbmF0dXJhbCBhbmQgcm9idXN0LiBFLmcuIG5vIG5lZWQgZm9yIHRoZSBiZWxvd1xuICovXG52YXIgQVJSQVlfTUVUSE9EUyA9IFsncHVzaCcsICdzb3J0JywgJ3JldmVyc2UnLCAnc3BsaWNlJywgJ3NoaWZ0JywgJ3Vuc2hpZnQnXSxcbiAgICBOVU1CRVJfTUVUSE9EUyA9IFsndG9TdHJpbmcnLCAndG9FeHBvbmVudGlhbCcsICd0b0ZpeGVkJywgJ3RvUHJlY2lzaW9uJywgJ3ZhbHVlT2YnXSxcbiAgICBOVU1CRVJfUFJPUEVSVElFUyA9IFsnTUFYX1ZBTFVFJywgJ01JTl9WQUxVRScsICdORUdBVElWRV9JTkZJTklUWScsICdOYU4nLCAnUE9TSVRJVkVfSU5GSU5JVFknXSxcbiAgICBTVFJJTkdfTUVUSE9EUyA9IFsnY2hhckF0JywgJ2NoYXJDb2RlQXQnLCAnY29uY2F0JywgJ2Zyb21DaGFyQ29kZScsICdpbmRleE9mJywgJ2xhc3RJbmRleE9mJywgJ2xvY2FsZUNvbXBhcmUnLFxuICAgICAgICAnbWF0Y2gnLCAncmVwbGFjZScsICdzZWFyY2gnLCAnc2xpY2UnLCAnc3BsaXQnLCAnc3Vic3RyJywgJ3N1YnN0cmluZycsICd0b0xvY2FsZUxvd2VyQ2FzZScsICd0b0xvY2FsZVVwcGVyQ2FzZScsXG4gICAgICAgICd0b0xvd2VyQ2FzZScsICd0b1N0cmluZycsICd0b1VwcGVyQ2FzZScsICd0cmltJywgJ3ZhbHVlT2YnXSxcbiAgICBTVFJJTkdfUFJPUEVSVElFUyA9IFsnbGVuZ3RoJ107XG5cbi8qKlxuICogUmV0dXJuIHRoZSBwcm9wZXJ0eSBuYW1lcyBmb3IgYSBnaXZlbiBvYmplY3QuIEhhbmRsZXMgc3BlY2lhbCBjYXNlcyBzdWNoIGFzIHN0cmluZ3MgYW5kIG51bWJlcnMgdGhhdCBkbyBub3QgaGF2ZVxuICogdGhlIGdldE93blByb3BlcnR5TmFtZXMgZnVuY3Rpb24uXG4gKiBUaGUgc3BlY2lhbCBjYXNlcyBhcmUgdmVyeSBtdWNoIGhhY2tzLiBUaGlzIGhhY2sgY2FuIGJlIHJlbW92ZWQgb25jZSB0aGUgUHJveHkgb2JqZWN0IGlzIG1vcmUgd2lkZWx5IGFkb3B0ZWQuXG4gKiBAcGFyYW0gb2JqZWN0XG4gKiBAcmV0dXJucyB7QXJyYXl9XG4gKi9cbmZ1bmN0aW9uIGdldFByb3BlcnR5TmFtZXMob2JqZWN0KSB7XG4gICAgdmFyIHByb3BlcnR5TmFtZXM7XG4gICAgaWYgKHR5cGVvZiBvYmplY3QgPT0gJ3N0cmluZycgfHwgb2JqZWN0IGluc3RhbmNlb2YgU3RyaW5nKSB7XG4gICAgICAgIHByb3BlcnR5TmFtZXMgPSBTVFJJTkdfTUVUSE9EUy5jb25jYXQoU1RSSU5HX1BST1BFUlRJRVMpO1xuICAgIH1cbiAgICBlbHNlIGlmICh0eXBlb2Ygb2JqZWN0ID09ICdudW1iZXInIHx8IG9iamVjdCBpbnN0YW5jZW9mIE51bWJlcikge1xuICAgICAgICBwcm9wZXJ0eU5hbWVzID0gTlVNQkVSX01FVEhPRFMuY29uY2F0KE5VTUJFUl9QUk9QRVJUSUVTKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHByb3BlcnR5TmFtZXMgPSBvYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcygpO1xuICAgIH1cbiAgICByZXR1cm4gcHJvcGVydHlOYW1lcztcbn1cblxuLyoqXG4gKiBEZWZpbmUgYSBwcm94eSBwcm9wZXJ0eSB0byBhdHRyaWJ1dGVzIG9uIG9iamVjdHMgaW4gdGhlIGFycmF5XG4gKiBAcGFyYW0gYXJyXG4gKiBAcGFyYW0gcHJvcFxuICovXG5mdW5jdGlvbiBkZWZpbmVBdHRyaWJ1dGUoYXJyLCBwcm9wKSB7XG4gICAgaWYgKCEocHJvcCBpbiBhcnIpKSB7IC8vIGUuZy4gd2UgY2Fubm90IHJlZGVmaW5lIC5sZW5ndGhcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGFyciwgcHJvcCwge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHF1ZXJ5U2V0KF8ucGx1Y2soYXJyLCBwcm9wKSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2V0OiBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkodikpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMubGVuZ3RoICE9IHYubGVuZ3RoKSB0aHJvdyBlcnJvcih7bWVzc2FnZTogJ011c3QgYmUgc2FtZSBsZW5ndGgnfSk7XG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpc1tpXVtwcm9wXSA9IHZbaV07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzW2ldW3Byb3BdID0gdjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBpc1Byb21pc2Uob2JqKSB7XG4gICAgLy8gVE9ETzogRG9uJ3QgdGhpbmsgdGhpcyBpcyB2ZXJ5IHJvYnVzdC5cbiAgICByZXR1cm4gb2JqLnRoZW4gJiYgb2JqLmNhdGNoO1xufVxuXG4vKipcbiAqIERlZmluZSBhIHByb3h5IG1ldGhvZCBvbiB0aGUgYXJyYXkgaWYgbm90IGFscmVhZHkgaW4gZXhpc3RlbmNlLlxuICogQHBhcmFtIGFyclxuICogQHBhcmFtIHByb3BcbiAqL1xuZnVuY3Rpb24gZGVmaW5lTWV0aG9kKGFyciwgcHJvcCkge1xuICAgIGlmICghKHByb3AgaW4gYXJyKSkgeyAvLyBlLmcuIHdlIGRvbid0IHdhbnQgdG8gcmVkZWZpbmUgdG9TdHJpbmdcbiAgICAgICAgYXJyW3Byb3BdID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGFyZ3MgPSBhcmd1bWVudHMsXG4gICAgICAgICAgICAgICAgcmVzID0gdGhpcy5tYXAoZnVuY3Rpb24gKHApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHBbcHJvcF0uYXBwbHkocCwgYXJncyk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB2YXIgYXJlUHJvbWlzZXMgPSBmYWxzZTtcbiAgICAgICAgICAgIGlmIChyZXMubGVuZ3RoKSBhcmVQcm9taXNlcyA9IGlzUHJvbWlzZShyZXNbMF0pO1xuICAgICAgICAgICAgcmV0dXJuIGFyZVByb21pc2VzID8gUHJvbWlzZS5hbGwocmVzKSA6IHF1ZXJ5U2V0KHJlcyk7XG4gICAgICAgIH07XG4gICAgfVxufVxuXG4vKipcbiAqIFRyYW5zZm9ybSB0aGUgYXJyYXkgaW50byBhIHF1ZXJ5IHNldC5cbiAqIFJlbmRlcnMgdGhlIGFycmF5IGltbXV0YWJsZS5cbiAqIEBwYXJhbSBhcnJcbiAqIEBwYXJhbSBtb2RlbCAtIFRoZSBtb2RlbCB3aXRoIHdoaWNoIHRvIHByb3h5IHRvXG4gKi9cbmZ1bmN0aW9uIG1vZGVsUXVlcnlTZXQoYXJyLCBtb2RlbCkge1xuICAgIGFyciA9IF8uZXh0ZW5kKFtdLCBhcnIpO1xuICAgIHZhciBhdHRyaWJ1dGVOYW1lcyA9IG1vZGVsLl9hdHRyaWJ1dGVOYW1lcyxcbiAgICAgICAgcmVsYXRpb25zaGlwTmFtZXMgPSBtb2RlbC5fcmVsYXRpb25zaGlwTmFtZXMsXG4gICAgICAgIG5hbWVzID0gYXR0cmlidXRlTmFtZXMuY29uY2F0KHJlbGF0aW9uc2hpcE5hbWVzKS5jb25jYXQoaW5zdGFuY2VNZXRob2RzKTtcbiAgICBuYW1lcy5mb3JFYWNoKF8ucGFydGlhbChkZWZpbmVBdHRyaWJ1dGUsIGFycikpO1xuICAgIHZhciBpbnN0YW5jZU1ldGhvZHMgPSBPYmplY3Qua2V5cyhNb2RlbEluc3RhbmNlLnByb3RvdHlwZSk7XG4gICAgaW5zdGFuY2VNZXRob2RzLmZvckVhY2goXy5wYXJ0aWFsKGRlZmluZU1ldGhvZCwgYXJyKSk7XG4gICAgcmV0dXJuIHJlbmRlckltbXV0YWJsZShhcnIpO1xufVxuXG4vKipcbiAqIFRyYW5zZm9ybSB0aGUgYXJyYXkgaW50byBhIHF1ZXJ5IHNldCwgYmFzZWQgb24gd2hhdGV2ZXIgaXMgaW4gaXQuXG4gKiBOb3RlIHRoYXQgYWxsIG9iamVjdHMgbXVzdCBiZSBvZiB0aGUgc2FtZSB0eXBlLiBUaGlzIGZ1bmN0aW9uIHdpbGwgdGFrZSB0aGUgZmlyc3Qgb2JqZWN0IGFuZCBkZWNpZGUgaG93IHRvIHByb3h5XG4gKiBiYXNlZCBvbiB0aGF0LlxuICogQHBhcmFtIGFyclxuICovXG5mdW5jdGlvbiBxdWVyeVNldChhcnIpIHtcbiAgICBpZiAoYXJyLmxlbmd0aCkge1xuICAgICAgICB2YXIgcmVmZXJlbmNlT2JqZWN0ID0gYXJyWzBdLFxuICAgICAgICAgICAgcHJvcGVydHlOYW1lcyA9IGdldFByb3BlcnR5TmFtZXMocmVmZXJlbmNlT2JqZWN0KTtcbiAgICAgICAgcHJvcGVydHlOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uIChwcm9wKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHJlZmVyZW5jZU9iamVjdFtwcm9wXSA9PSAnZnVuY3Rpb24nKSBkZWZpbmVNZXRob2QoYXJyLCBwcm9wLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgZWxzZSBkZWZpbmVBdHRyaWJ1dGUoYXJyLCBwcm9wKTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiByZW5kZXJJbW11dGFibGUoYXJyKTtcbn1cblxuZnVuY3Rpb24gdGhyb3dJbW11dGFibGVFcnJvcigpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBtb2RpZnkgYSBxdWVyeSBzZXQnKTtcbn1cblxuLyoqXG4gKiBSZW5kZXIgYW4gYXJyYXkgaW1tdXRhYmxlIGJ5IHJlcGxhY2luZyBhbnkgZnVuY3Rpb25zIHRoYXQgY2FuIG11dGF0ZSBpdC5cbiAqIEBwYXJhbSBhcnJcbiAqL1xuZnVuY3Rpb24gcmVuZGVySW1tdXRhYmxlKGFycikge1xuICAgIEFSUkFZX01FVEhPRFMuZm9yRWFjaChmdW5jdGlvbiAocCkge1xuICAgICAgICBhcnJbcF0gPSB0aHJvd0ltbXV0YWJsZUVycm9yO1xuICAgIH0pO1xuICAgIGFyci5pbW11dGFibGUgPSB0cnVlO1xuICAgIGFyci5tdXRhYmxlQ29weSA9IGFyci5hc0FycmF5ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgbXV0YWJsZUFyciA9IF8ubWFwKHRoaXMsIGZ1bmN0aW9uICh4KSB7cmV0dXJuIHh9KTtcbiAgICAgICAgbXV0YWJsZUFyci5hc1F1ZXJ5U2V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHF1ZXJ5U2V0KHRoaXMpO1xuICAgICAgICB9O1xuICAgICAgICBtdXRhYmxlQXJyLmFzTW9kZWxRdWVyeVNldCA9IGZ1bmN0aW9uIChtb2RlbCkge1xuICAgICAgICAgICAgcmV0dXJuIG1vZGVsUXVlcnlTZXQodGhpcywgbW9kZWwpO1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gbXV0YWJsZUFycjtcbiAgICB9O1xuICAgIHJldHVybiBhcnI7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gbW9kZWxRdWVyeVNldDsiLCIvKipcbiAqIEZvciB0aG9zZSBmYW1pbGlhciB3aXRoIEFwcGxlJ3MgQ29jb2EgbGlicmFyeSwgcmVhY3RpdmUgcXVlcmllcyByb3VnaGx5IG1hcCBvbnRvIE5TRmV0Y2hlZFJlc3VsdHNDb250cm9sbGVyLlxuICpcbiAqIFRoZXkgcHJlc2VudCBhIHF1ZXJ5IHNldCB0aGF0ICdyZWFjdHMnIHRvIGNoYW5nZXMgaW4gdGhlIHVuZGVybHlpbmcgZGF0YS5cbiAqIEBtb2R1bGUgcmVhY3RpdmVRdWVyeVxuICovXG5cblxuKGZ1bmN0aW9uKCkge1xuXG4gIHZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpKCdxdWVyeTpyZWFjdGl2ZScpLFxuICAgICAgUXVlcnkgPSByZXF1aXJlKCcuL1F1ZXJ5JyksXG4gICAgICBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXIsXG4gICAgICBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICAgICAgQ2hhaW4gPSByZXF1aXJlKCcuL0NoYWluJyksXG4gICAgICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgICAgIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgICAgIGNvbnN0cnVjdFF1ZXJ5U2V0ID0gcmVxdWlyZSgnLi9RdWVyeVNldCcpLFxuICAgICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgICAgXyA9IHV0aWwuXztcblxuICAvKipcbiAgICpcbiAgICogQHBhcmFtIHtRdWVyeX0gcXVlcnkgLSBUaGUgdW5kZXJseWluZyBxdWVyeVxuICAgKiBAY29uc3RydWN0b3JcbiAgICovXG4gIGZ1bmN0aW9uIFJlYWN0aXZlUXVlcnkocXVlcnkpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgRXZlbnRFbWl0dGVyLmNhbGwodGhpcyk7XG4gICAgQ2hhaW4uY2FsbCh0aGlzKTtcbiAgICBfLmV4dGVuZCh0aGlzLCB7XG4gICAgICBpbnNlcnRpb25Qb2xpY3k6IFJlYWN0aXZlUXVlcnkuSW5zZXJ0aW9uUG9saWN5LkJhY2ssXG4gICAgICBpbml0aWFsaXNlZDogZmFsc2VcbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAncXVlcnknLCB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcXVlcnlcbiAgICAgIH0sXG4gICAgICBzZXQ6IGZ1bmN0aW9uKHYpIHtcbiAgICAgICAgaWYgKHYpIHtcbiAgICAgICAgICB0aGlzLl9xdWVyeSA9IHY7XG4gICAgICAgICAgdGhpcy5yZXN1bHRzID0gY29uc3RydWN0UXVlcnlTZXQoW10sIHYubW9kZWwpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIHRoaXMuX3F1ZXJ5ID0gbnVsbDtcbiAgICAgICAgICB0aGlzLnJlc3VsdHMgPSBudWxsO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgY29uZmlndXJhYmxlOiBmYWxzZSxcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9KTtcblxuICAgIGlmIChxdWVyeSkge1xuICAgICAgXy5leHRlbmQodGhpcywge1xuICAgICAgICBfcXVlcnk6IHF1ZXJ5LFxuICAgICAgICByZXN1bHRzOiBjb25zdHJ1Y3RRdWVyeVNldChbXSwgcXVlcnkubW9kZWwpXG4gICAgICB9KVxuICAgIH1cblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHRoaXMsIHtcbiAgICAgIGluaXRpYWxpemVkOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuaW5pdGlhbGlzZWRcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIG1vZGVsOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIHF1ZXJ5ID0gc2VsZi5fcXVlcnk7XG4gICAgICAgICAgaWYgKHF1ZXJ5KSB7XG4gICAgICAgICAgICByZXR1cm4gcXVlcnkubW9kZWxcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBjb2xsZWN0aW9uOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuIHNlbGYubW9kZWwuY29sbGVjdGlvbk5hbWVcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG5cbiAgfVxuXG4gIFJlYWN0aXZlUXVlcnkucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShFdmVudEVtaXR0ZXIucHJvdG90eXBlKTtcbiAgXy5leHRlbmQoUmVhY3RpdmVRdWVyeS5wcm90b3R5cGUsIENoYWluLnByb3RvdHlwZSk7XG5cbiAgXy5leHRlbmQoUmVhY3RpdmVRdWVyeSwge1xuICAgIEluc2VydGlvblBvbGljeToge1xuICAgICAgRnJvbnQ6ICdGcm9udCcsXG4gICAgICBCYWNrOiAnQmFjaydcbiAgICB9XG4gIH0pO1xuXG4gIF8uZXh0ZW5kKFJlYWN0aXZlUXVlcnkucHJvdG90eXBlLCB7XG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0gY2JcbiAgICAgKiBAcGFyYW0ge2Jvb2x9IF9pZ25vcmVJbml0IC0gZXhlY3V0ZSBxdWVyeSBhZ2FpbiwgaW5pdGlhbGlzZWQgb3Igbm90LlxuICAgICAqIEByZXR1cm5zIHsqfVxuICAgICAqL1xuICAgIGluaXQ6IGZ1bmN0aW9uKGNiLCBfaWdub3JlSW5pdCkge1xuICAgICAgaWYgKHRoaXMuX3F1ZXJ5KSB7XG4gICAgICAgIGlmIChsb2cpIGxvZygnaW5pdCcpO1xuICAgICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgICAgIGlmICgoIXRoaXMuaW5pdGlhbGlzZWQpIHx8IF9pZ25vcmVJbml0KSB7XG4gICAgICAgICAgICB0aGlzLl9xdWVyeS5leGVjdXRlKGZ1bmN0aW9uKGVyciwgcmVzdWx0cykge1xuICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgIGNiKG51bGwsIHRoaXMuX2FwcGx5UmVzdWx0cyhyZXN1bHRzKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgY2IoZXJyKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjYihudWxsLCB0aGlzLnJlc3VsdHMpO1xuICAgICAgICAgIH1cbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgIH1cbiAgICAgIGVsc2UgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ05vIF9xdWVyeSBkZWZpbmVkJyk7XG4gICAgfSxcbiAgICBfYXBwbHlSZXN1bHRzOiBmdW5jdGlvbihyZXN1bHRzKSB7XG4gICAgICB0aGlzLnJlc3VsdHMgPSByZXN1bHRzO1xuICAgICAgaWYgKCF0aGlzLmhhbmRsZXIpIHtcbiAgICAgICAgdmFyIG5hbWUgPSB0aGlzLl9jb25zdHJ1Y3ROb3RpZmljYXRpb25OYW1lKCk7XG4gICAgICAgIHZhciBoYW5kbGVyID0gZnVuY3Rpb24obikge1xuICAgICAgICAgIHRoaXMuX2hhbmRsZU5vdGlmKG4pO1xuICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuaGFuZGxlciA9IGhhbmRsZXI7XG4gICAgICAgIGV2ZW50cy5vbihuYW1lLCBoYW5kbGVyKTtcbiAgICAgIH1cbiAgICAgIGxvZygnTGlzdGVuaW5nIHRvICcgKyBuYW1lKTtcbiAgICAgIHRoaXMuaW5pdGlhbGlzZWQgPSB0cnVlO1xuICAgICAgcmV0dXJuIHRoaXMucmVzdWx0cztcbiAgICB9LFxuICAgIGluc2VydDogZnVuY3Rpb24obmV3T2JqKSB7XG4gICAgICB2YXIgcmVzdWx0cyA9IHRoaXMucmVzdWx0cy5tdXRhYmxlQ29weSgpO1xuICAgICAgaWYgKHRoaXMuaW5zZXJ0aW9uUG9saWN5ID09IFJlYWN0aXZlUXVlcnkuSW5zZXJ0aW9uUG9saWN5LkJhY2spIHZhciBpZHggPSByZXN1bHRzLnB1c2gobmV3T2JqKTtcbiAgICAgIGVsc2UgaWR4ID0gcmVzdWx0cy51bnNoaWZ0KG5ld09iaik7XG4gICAgICB0aGlzLnJlc3VsdHMgPSByZXN1bHRzLmFzTW9kZWxRdWVyeVNldCh0aGlzLm1vZGVsKTtcbiAgICAgIHJldHVybiBpZHg7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBFeGVjdXRlIHRoZSB1bmRlcmx5aW5nIHF1ZXJ5IGFnYWluLlxuICAgICAqIEBwYXJhbSBjYlxuICAgICAqL1xuICAgIHVwZGF0ZTogZnVuY3Rpb24oY2IpIHtcbiAgICAgIHJldHVybiB0aGlzLmluaXQoY2IsIHRydWUpXG4gICAgfSxcbiAgICBfaGFuZGxlTm90aWY6IGZ1bmN0aW9uKG4pIHtcbiAgICAgIGxvZygnX2hhbmRsZU5vdGlmJywgbik7XG4gICAgICBpZiAobi50eXBlID09IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLk5ldykge1xuICAgICAgICB2YXIgbmV3T2JqID0gbi5uZXc7XG4gICAgICAgIGlmICh0aGlzLl9xdWVyeS5vYmplY3RNYXRjaGVzUXVlcnkobmV3T2JqKSkge1xuICAgICAgICAgIGxvZygnTmV3IG9iamVjdCBtYXRjaGVzJywgbmV3T2JqKTtcbiAgICAgICAgICB2YXIgaWR4ID0gdGhpcy5pbnNlcnQobmV3T2JqKTtcbiAgICAgICAgICB0aGlzLmVtaXQobW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLCB7XG4gICAgICAgICAgICBpbmRleDogaWR4LFxuICAgICAgICAgICAgYWRkZWQ6IFtuZXdPYmpdLFxuICAgICAgICAgICAgdHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgb2JqOiB0aGlzXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgbG9nKCdOZXcgb2JqZWN0IGRvZXMgbm90IG1hdGNoJywgbmV3T2JqKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZWxzZSBpZiAobi50eXBlID09IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNldCkge1xuICAgICAgICBuZXdPYmogPSBuLm9iajtcbiAgICAgICAgdmFyIGluZGV4ID0gdGhpcy5yZXN1bHRzLmluZGV4T2YobmV3T2JqKSxcbiAgICAgICAgICAgIGFscmVhZHlDb250YWlucyA9IGluZGV4ID4gLTEsXG4gICAgICAgICAgICBtYXRjaGVzID0gdGhpcy5fcXVlcnkub2JqZWN0TWF0Y2hlc1F1ZXJ5KG5ld09iaik7XG4gICAgICAgIGlmIChtYXRjaGVzICYmICFhbHJlYWR5Q29udGFpbnMpIHtcbiAgICAgICAgICBsb2coJ1VwZGF0ZWQgb2JqZWN0IG5vdyBtYXRjaGVzIScsIG5ld09iaik7XG4gICAgICAgICAgaWR4ID0gdGhpcy5pbnNlcnQobmV3T2JqKTtcbiAgICAgICAgICB0aGlzLmVtaXQobW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLCB7XG4gICAgICAgICAgICBpbmRleDogaWR4LFxuICAgICAgICAgICAgYWRkZWQ6IFtuZXdPYmpdLFxuICAgICAgICAgICAgdHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgb2JqOiB0aGlzXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoIW1hdGNoZXMgJiYgYWxyZWFkeUNvbnRhaW5zKSB7XG4gICAgICAgICAgbG9nKCdVcGRhdGVkIG9iamVjdCBubyBsb25nZXIgbWF0Y2hlcyEnLCBuZXdPYmopO1xuICAgICAgICAgIHJlc3VsdHMgPSB0aGlzLnJlc3VsdHMubXV0YWJsZUNvcHkoKTtcbiAgICAgICAgICB2YXIgcmVtb3ZlZCA9IHJlc3VsdHMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICB0aGlzLnJlc3VsdHMgPSByZXN1bHRzLmFzTW9kZWxRdWVyeVNldCh0aGlzLm1vZGVsKTtcbiAgICAgICAgICB0aGlzLmVtaXQobW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLCB7XG4gICAgICAgICAgICBpbmRleDogaW5kZXgsXG4gICAgICAgICAgICBvYmo6IHRoaXMsXG4gICAgICAgICAgICBuZXc6IG5ld09iaixcbiAgICAgICAgICAgIHR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgIHJlbW92ZWQ6IHJlbW92ZWRcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICghbWF0Y2hlcyAmJiAhYWxyZWFkeUNvbnRhaW5zKSB7XG4gICAgICAgICAgbG9nKCdEb2VzIG5vdCBjb250YWluLCBidXQgZG9lc250IG1hdGNoIHNvIG5vdCBpbnNlcnRpbmcnLCBuZXdPYmopO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKG1hdGNoZXMgJiYgYWxyZWFkeUNvbnRhaW5zKSB7XG4gICAgICAgICAgbG9nKCdNYXRjaGVzIGJ1dCBhbHJlYWR5IGNvbnRhaW5zJywgbmV3T2JqKTtcbiAgICAgICAgICAvLyBTZW5kIHRoZSBub3RpZmljYXRpb24gb3Zlci5cbiAgICAgICAgICB0aGlzLmVtaXQobi50eXBlLCBuKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZWxzZSBpZiAobi50eXBlID09IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlJlbW92ZSkge1xuICAgICAgICBuZXdPYmogPSBuLm9iajtcbiAgICAgICAgdmFyIHJlc3VsdHMgPSB0aGlzLnJlc3VsdHMubXV0YWJsZUNvcHkoKTtcbiAgICAgICAgaW5kZXggPSByZXN1bHRzLmluZGV4T2YobmV3T2JqKTtcbiAgICAgICAgaWYgKGluZGV4ID4gLTEpIHtcbiAgICAgICAgICBsb2coJ1JlbW92aW5nIG9iamVjdCcsIG5ld09iaik7XG4gICAgICAgICAgcmVtb3ZlZCA9IHJlc3VsdHMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICB0aGlzLnJlc3VsdHMgPSBjb25zdHJ1Y3RRdWVyeVNldChyZXN1bHRzLCB0aGlzLm1vZGVsKTtcbiAgICAgICAgICB0aGlzLmVtaXQobW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLCB7XG4gICAgICAgICAgICBpbmRleDogaW5kZXgsXG4gICAgICAgICAgICBvYmo6IHRoaXMsXG4gICAgICAgICAgICB0eXBlOiBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgICAgICAgICByZW1vdmVkOiByZW1vdmVkXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgbG9nKCdObyBtb2RlbEV2ZW50cyBuZWNjZXNzYXJ5LicsIG5ld09iaik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignVW5rbm93biBjaGFuZ2UgdHlwZSBcIicgKyBuLnR5cGUudG9TdHJpbmcoKSArICdcIicpXG4gICAgICB9XG4gICAgICB0aGlzLnJlc3VsdHMgPSBjb25zdHJ1Y3RRdWVyeVNldCh0aGlzLl9xdWVyeS5fc29ydFJlc3VsdHModGhpcy5yZXN1bHRzKSwgdGhpcy5tb2RlbCk7XG4gICAgfSxcbiAgICBfY29uc3RydWN0Tm90aWZpY2F0aW9uTmFtZTogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5tb2RlbC5jb2xsZWN0aW9uTmFtZSArICc6JyArIHRoaXMubW9kZWwubmFtZTtcbiAgICB9LFxuICAgIHRlcm1pbmF0ZTogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5oYW5kbGVyKSB7XG4gICAgICAgIGV2ZW50cy5yZW1vdmVMaXN0ZW5lcih0aGlzLl9jb25zdHJ1Y3ROb3RpZmljYXRpb25OYW1lKCksIHRoaXMuaGFuZGxlcik7XG4gICAgICB9XG4gICAgICB0aGlzLnJlc3VsdHMgPSBudWxsO1xuICAgICAgdGhpcy5oYW5kbGVyID0gbnVsbDtcbiAgICB9LFxuICAgIF9yZWdpc3RlckV2ZW50SGFuZGxlcjogZnVuY3Rpb24ob24sIG5hbWUsIGZuKSB7XG4gICAgICB2YXIgcmVtb3ZlTGlzdGVuZXIgPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyO1xuICAgICAgaWYgKG5hbWUudHJpbSgpID09ICcqJykge1xuICAgICAgICBPYmplY3Qua2V5cyhtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZSkuZm9yRWFjaChmdW5jdGlvbihrKSB7XG4gICAgICAgICAgb24uY2FsbCh0aGlzLCBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZVtrXSwgZm4pO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIG9uLmNhbGwodGhpcywgbmFtZSwgZm4pO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuX2xpbmsoe1xuICAgICAgICBvbjogdGhpcy5vbi5iaW5kKHRoaXMpLFxuICAgICAgICBvbmNlOiB0aGlzLm9uY2UuYmluZCh0aGlzKVxuICAgICAgfSxcbiAgICAgICAgZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmIChuYW1lLnRyaW0oKSA9PSAnKicpIHtcbiAgICAgICAgICBPYmplY3Qua2V5cyhtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZSkuZm9yRWFjaChmdW5jdGlvbihrKSB7XG4gICAgICAgICAgICByZW1vdmVMaXN0ZW5lci5jYWxsKHRoaXMsIG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlW2tdLCBmbik7XG4gICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICByZW1vdmVMaXN0ZW5lci5jYWxsKHRoaXMsIG5hbWUsIGZuKTtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9LFxuICAgIG9uOiBmdW5jdGlvbihuYW1lLCBmbikge1xuICAgICAgcmV0dXJuIHRoaXMuX3JlZ2lzdGVyRXZlbnRIYW5kbGVyKEV2ZW50RW1pdHRlci5wcm90b3R5cGUub24sIG5hbWUsIGZuKTtcbiAgICB9LFxuICAgIG9uY2U6IGZ1bmN0aW9uKG5hbWUsIGZuKSB7XG4gICAgICByZXR1cm4gdGhpcy5fcmVnaXN0ZXJFdmVudEhhbmRsZXIoRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlLCBuYW1lLCBmbik7XG4gICAgfVxuICB9KTtcblxuXG4gIG1vZHVsZS5leHBvcnRzID0gUmVhY3RpdmVRdWVyeTtcbn0pKCk7IiwiLyoqXG4gKiBCYXNlIGZ1bmN0aW9uYWxpdHkgZm9yIHJlbGF0aW9uc2hpcHMuXG4gKiBAbW9kdWxlIHJlbGF0aW9uc2hpcHNcbiAqL1xuKGZ1bmN0aW9uKCkge1xuXG4gIHZhciBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgU3RvcmUgPSByZXF1aXJlKCcuL3N0b3JlJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIF8gPSB1dGlsLl8sXG4gICAgUXVlcnkgPSByZXF1aXJlKCcuL1F1ZXJ5JyksXG4gICAgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSxcbiAgICBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKSxcbiAgICBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICAgIHdyYXBBcnJheUZvckF0dHJpYnV0ZXMgPSBldmVudHMud3JhcEFycmF5LFxuICAgIEFycmF5T2JzZXJ2ZXIgPSByZXF1aXJlKCcuLi92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZScpLkFycmF5T2JzZXJ2ZXIsXG4gICAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gICAgTW9kZWxFdmVudFR5cGUgPSBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZTtcblxuICAvKipcbiAgICogQGNsYXNzICBbUmVsYXRpb25zaGlwUHJveHkgZGVzY3JpcHRpb25dXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKi9cbiAgZnVuY3Rpb24gUmVsYXRpb25zaGlwUHJveHkob3B0cykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBvcHRzID0gb3B0cyB8fCB7fTtcblxuICAgIF8uZXh0ZW5kKHRoaXMsIHtcbiAgICAgIG9iamVjdDogbnVsbCxcbiAgICAgIHJlbGF0ZWQ6IG51bGxcbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHRoaXMsIHtcbiAgICAgIGlzRm9yd2FyZDoge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiAhc2VsZi5pc1JldmVyc2U7XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24odikge1xuICAgICAgICAgIHNlbGYuaXNSZXZlcnNlID0gIXY7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHV0aWwuZXh0ZW5kRnJvbU9wdHModGhpcywgb3B0cywge1xuICAgICAgcmV2ZXJzZU1vZGVsOiBudWxsLFxuICAgICAgZm9yd2FyZE1vZGVsOiBudWxsLFxuICAgICAgZm9yd2FyZE5hbWU6IG51bGwsXG4gICAgICByZXZlcnNlTmFtZTogbnVsbCxcbiAgICAgIGlzUmV2ZXJzZTogbnVsbCxcbiAgICAgIHNlcmlhbGlzZTogbnVsbFxuICAgIH0sIGZhbHNlKTtcblxuICAgIHRoaXMuY2FuY2VsTGlzdGVucyA9IHt9O1xuICB9XG5cbiAgXy5leHRlbmQoUmVsYXRpb25zaGlwUHJveHksIHt9KTtcblxuICBfLmV4dGVuZChSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUsIHtcbiAgICAvKipcbiAgICAgKiBJbnN0YWxsIHRoaXMgcHJveHkgb24gdGhlIGdpdmVuIGluc3RhbmNlXG4gICAgICogQHBhcmFtIHtNb2RlbEluc3RhbmNlfSBtb2RlbEluc3RhbmNlXG4gICAgICovXG4gICAgaW5zdGFsbDogZnVuY3Rpb24obW9kZWxJbnN0YW5jZSkge1xuICAgICAgaWYgKG1vZGVsSW5zdGFuY2UpIHtcbiAgICAgICAgaWYgKCF0aGlzLm9iamVjdCkge1xuICAgICAgICAgIHRoaXMub2JqZWN0ID0gbW9kZWxJbnN0YW5jZTtcbiAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgdmFyIG5hbWUgPSB0aGlzLmdldEZvcndhcmROYW1lKCk7XG4gICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG1vZGVsSW5zdGFuY2UsIG5hbWUsIHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgIHJldHVybiBzZWxmLnJlbGF0ZWQ7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2V0OiBmdW5jdGlvbih2KSB7XG4gICAgICAgICAgICAgIHNlbGYuc2V0KHYpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBpZiAoIW1vZGVsSW5zdGFuY2UuX19wcm94aWVzKSBtb2RlbEluc3RhbmNlLl9fcHJveGllcyA9IHt9O1xuICAgICAgICAgIG1vZGVsSW5zdGFuY2UuX19wcm94aWVzW25hbWVdID0gdGhpcztcbiAgICAgICAgICBpZiAoIW1vZGVsSW5zdGFuY2UuX3Byb3hpZXMpIHtcbiAgICAgICAgICAgIG1vZGVsSW5zdGFuY2UuX3Byb3hpZXMgPSBbXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgbW9kZWxJbnN0YW5jZS5fcHJveGllcy5wdXNoKHRoaXMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdBbHJlYWR5IGluc3RhbGxlZC4nKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ05vIG9iamVjdCBwYXNzZWQgdG8gcmVsYXRpb25zaGlwIGluc3RhbGwnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgfSk7XG5cbiAgLy9ub2luc3BlY3Rpb24gSlNVbnVzZWRMb2NhbFN5bWJvbHNcbiAgXy5leHRlbmQoUmVsYXRpb25zaGlwUHJveHkucHJvdG90eXBlLCB7XG4gICAgc2V0OiBmdW5jdGlvbihvYmosIG9wdHMpIHtcbiAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNdXN0IHN1YmNsYXNzIFJlbGF0aW9uc2hpcFByb3h5Jyk7XG4gICAgfSxcbiAgICBnZXQ6IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTXVzdCBzdWJjbGFzcyBSZWxhdGlvbnNoaXBQcm94eScpO1xuICAgIH1cbiAgfSk7XG5cbiAgXy5leHRlbmQoUmVsYXRpb25zaGlwUHJveHkucHJvdG90eXBlLCB7XG4gICAgcHJveHlGb3JJbnN0YW5jZTogZnVuY3Rpb24obW9kZWxJbnN0YW5jZSwgcmV2ZXJzZSkge1xuICAgICAgdmFyIG5hbWUgPSByZXZlcnNlID8gdGhpcy5nZXRSZXZlcnNlTmFtZSgpIDogdGhpcy5nZXRGb3J3YXJkTmFtZSgpLFxuICAgICAgICBtb2RlbCA9IHJldmVyc2UgPyB0aGlzLnJldmVyc2VNb2RlbCA6IHRoaXMuZm9yd2FyZE1vZGVsO1xuICAgICAgdmFyIHJldDtcbiAgICAgIC8vIFRoaXMgc2hvdWxkIG5ldmVyIGhhcHBlbi4gU2hvdWxkIGcgICBldCBjYXVnaHQgaW4gdGhlIG1hcHBpbmcgb3BlcmF0aW9uP1xuICAgICAgaWYgKHV0aWwuaXNBcnJheShtb2RlbEluc3RhbmNlKSkge1xuICAgICAgICByZXQgPSBfLm1hcChtb2RlbEluc3RhbmNlLCBmdW5jdGlvbihvKSB7XG4gICAgICAgICAgcmV0dXJuIG8uX19wcm94aWVzW25hbWVdO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBwcm94eSA9IG1vZGVsSW5zdGFuY2UuX19wcm94aWVzW25hbWVdO1xuICAgICAgICBpZiAoIXByb3h5KSB7XG4gICAgICAgICAgdmFyIGVyciA9ICdObyBwcm94eSB3aXRoIG5hbWUgXCInICsgbmFtZSArICdcIiBvbiBtYXBwaW5nICcgKyBtb2RlbC5uYW1lO1xuICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKGVycik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0ID0gcHJveHk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmV0O1xuICAgIH0sXG4gICAgcmV2ZXJzZVByb3h5Rm9ySW5zdGFuY2U6IGZ1bmN0aW9uKG1vZGVsSW5zdGFuY2UpIHtcbiAgICAgIHJldHVybiB0aGlzLnByb3h5Rm9ySW5zdGFuY2UobW9kZWxJbnN0YW5jZSwgdHJ1ZSk7XG4gICAgfSxcbiAgICBnZXRSZXZlcnNlTmFtZTogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5pc0ZvcndhcmQgPyB0aGlzLnJldmVyc2VOYW1lIDogdGhpcy5mb3J3YXJkTmFtZTtcbiAgICB9LFxuICAgIGdldEZvcndhcmROYW1lOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLmlzRm9yd2FyZCA/IHRoaXMuZm9yd2FyZE5hbWUgOiB0aGlzLnJldmVyc2VOYW1lO1xuICAgIH0sXG4gICAgZ2V0Rm9yd2FyZE1vZGVsOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLmlzRm9yd2FyZCA/IHRoaXMuZm9yd2FyZE1vZGVsIDogdGhpcy5yZXZlcnNlTW9kZWw7XG4gICAgfSxcbiAgICBjbGVhclJlbW92YWxMaXN0ZW5lcjogZnVuY3Rpb24ob2JqKSB7XG4gICAgICB2YXIgbG9jYWxJZCA9IG9iai5sb2NhbElkO1xuICAgICAgdmFyIGNhbmNlbExpc3RlbiA9IHRoaXMuY2FuY2VsTGlzdGVuc1tsb2NhbElkXTtcbiAgICAgIC8vIFRPRE86IFJlbW92ZSB0aGlzIGNoZWNrLiBjYW5jZWxMaXN0ZW4gc2hvdWxkIGFsd2F5cyBleGlzdFxuICAgICAgaWYgKGNhbmNlbExpc3Rlbikge1xuICAgICAgICBjYW5jZWxMaXN0ZW4oKTtcbiAgICAgICAgdGhpcy5jYW5jZWxMaXN0ZW5zW2xvY2FsSWRdID0gbnVsbDtcbiAgICAgIH1cbiAgICB9LFxuICAgIGxpc3RlbkZvclJlbW92YWw6IGZ1bmN0aW9uKG9iaikge1xuICAgICAgdGhpcy5jYW5jZWxMaXN0ZW5zW29iai5sb2NhbElkXSA9IG9iai5vbignKicsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgaWYgKGUudHlwZSA9PSBNb2RlbEV2ZW50VHlwZS5SZW1vdmUpIHtcbiAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KHRoaXMucmVsYXRlZCkpIHtcbiAgICAgICAgICAgIHZhciBpZHggPSB0aGlzLnJlbGF0ZWQuaW5kZXhPZihvYmopO1xuICAgICAgICAgICAgdGhpcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnNldElkQW5kUmVsYXRlZChudWxsKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5jbGVhclJlbW92YWxMaXN0ZW5lcihvYmopO1xuICAgICAgICB9XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogQ29uZmlndXJlIF9pZCBhbmQgcmVsYXRlZCB3aXRoIHRoZSBuZXcgcmVsYXRlZCBvYmplY3QuXG4gICAgICogQHBhcmFtIG9ialxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0c11cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRzLmRpc2FibGVOb3RpZmljYXRpb25zXVxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd8dW5kZWZpbmVkfSAtIEVycm9yIG1lc3NhZ2Ugb3IgdW5kZWZpbmVkXG4gICAgICovXG4gICAgc2V0SWRBbmRSZWxhdGVkOiBmdW5jdGlvbihvYmosIG9wdHMpIHtcbiAgICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgICAgaWYgKCFvcHRzLmRpc2FibGVldmVudHMpIHZhciBvbGRWYWx1ZSA9IHRoaXMuX2dldE9sZFZhbHVlRm9yU2V0Q2hhbmdlRXZlbnQoKTtcbiAgICAgIHZhciBwcmV2aW91c2x5UmVsYXRlZCA9IHRoaXMucmVsYXRlZDtcbiAgICAgIGlmIChwcmV2aW91c2x5UmVsYXRlZCkgdGhpcy5jbGVhclJlbW92YWxMaXN0ZW5lcihwcmV2aW91c2x5UmVsYXRlZCk7XG4gICAgICBpZiAob2JqKSB7XG4gICAgICAgIGlmICh1dGlsLmlzQXJyYXkob2JqKSkge1xuICAgICAgICAgIHRoaXMucmVsYXRlZCA9IG9iajtcbiAgICAgICAgICBvYmouZm9yRWFjaChmdW5jdGlvbihfb2JqKSB7XG4gICAgICAgICAgICB0aGlzLmxpc3RlbkZvclJlbW92YWwoX29iaik7XG4gICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnJlbGF0ZWQgPSBvYmo7XG4gICAgICAgICAgdGhpcy5saXN0ZW5Gb3JSZW1vdmFsKG9iaik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICB0aGlzLnJlbGF0ZWQgPSBudWxsO1xuICAgICAgfVxuICAgICAgaWYgKCFvcHRzLmRpc2FibGVldmVudHMpIHRoaXMucmVnaXN0ZXJTZXRDaGFuZ2Uob2JqLCBvbGRWYWx1ZSk7XG4gICAgfSxcbiAgICBjaGVja0luc3RhbGxlZDogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoIXRoaXMub2JqZWN0KSB7XG4gICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdQcm94eSBtdXN0IGJlIGluc3RhbGxlZCBvbiBhbiBvYmplY3QgYmVmb3JlIGNhbiB1c2UgaXQuJyk7XG4gICAgICB9XG4gICAgfSxcbiAgICBzcGxpY2VyOiBmdW5jdGlvbihvcHRzKSB7XG4gICAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICAgIHJldHVybiBmdW5jdGlvbihpZHgsIG51bVJlbW92ZSkge1xuICAgICAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICAgICAgaWYgKCFvcHRzLmRpc2FibGVldmVudHMpIHtcbiAgICAgICAgICB2YXIgYWRkZWQgPSB0aGlzLl9nZXRBZGRlZEZvclNwbGljZUNoYW5nZUV2ZW50KGFyZ3VtZW50cyksXG4gICAgICAgICAgICByZW1vdmVkID0gdGhpcy5fZ2V0UmVtb3ZlZEZvclNwbGljZUNoYW5nZUV2ZW50KGlkeCwgbnVtUmVtb3ZlKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgYWRkID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICAgICAgdmFyIHJlcyA9IF8ucGFydGlhbCh0aGlzLnJlbGF0ZWQuc3BsaWNlLCBpZHgsIG51bVJlbW92ZSkuYXBwbHkodGhpcy5yZWxhdGVkLCBhZGQpO1xuICAgICAgICBpZiAoIW9wdHMuZGlzYWJsZWV2ZW50cykgdGhpcy5yZWdpc3RlclNwbGljZUNoYW5nZShpZHgsIGFkZGVkLCByZW1vdmVkKTtcbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICAgIH0uYmluZCh0aGlzKTtcbiAgICB9LFxuICAgIGNsZWFyUmV2ZXJzZVJlbGF0ZWQ6IGZ1bmN0aW9uKG9wdHMpIHtcbiAgICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgaWYgKHRoaXMucmVsYXRlZCkge1xuICAgICAgICB2YXIgcmV2ZXJzZVByb3h5ID0gdGhpcy5yZXZlcnNlUHJveHlGb3JJbnN0YW5jZSh0aGlzLnJlbGF0ZWQpO1xuICAgICAgICB2YXIgcmV2ZXJzZVByb3hpZXMgPSB1dGlsLmlzQXJyYXkocmV2ZXJzZVByb3h5KSA/IHJldmVyc2VQcm94eSA6IFtyZXZlcnNlUHJveHldO1xuICAgICAgICBfLmVhY2gocmV2ZXJzZVByb3hpZXMsIGZ1bmN0aW9uKHApIHtcbiAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KHAucmVsYXRlZCkpIHtcbiAgICAgICAgICAgIHZhciBpZHggPSBwLnJlbGF0ZWQuaW5kZXhPZihzZWxmLm9iamVjdCk7XG4gICAgICAgICAgICBwLm1ha2VDaGFuZ2VzVG9SZWxhdGVkV2l0aG91dE9ic2VydmF0aW9ucyhmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgcC5zcGxpY2VyKG9wdHMpKGlkeCwgMSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcC5zZXRJZEFuZFJlbGF0ZWQobnVsbCwgb3B0cyk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9LFxuICAgIHNldElkQW5kUmVsYXRlZFJldmVyc2U6IGZ1bmN0aW9uKG9iaiwgb3B0cykge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgdmFyIHJldmVyc2VQcm94eSA9IHRoaXMucmV2ZXJzZVByb3h5Rm9ySW5zdGFuY2Uob2JqKTtcbiAgICAgIHZhciByZXZlcnNlUHJveGllcyA9IHV0aWwuaXNBcnJheShyZXZlcnNlUHJveHkpID8gcmV2ZXJzZVByb3h5IDogW3JldmVyc2VQcm94eV07XG4gICAgICBfLmVhY2gocmV2ZXJzZVByb3hpZXMsIGZ1bmN0aW9uKHApIHtcbiAgICAgICAgaWYgKHV0aWwuaXNBcnJheShwLnJlbGF0ZWQpKSB7XG4gICAgICAgICAgcC5tYWtlQ2hhbmdlc1RvUmVsYXRlZFdpdGhvdXRPYnNlcnZhdGlvbnMoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBwLnNwbGljZXIob3B0cykocC5yZWxhdGVkLmxlbmd0aCwgMCwgc2VsZi5vYmplY3QpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHAuY2xlYXJSZXZlcnNlUmVsYXRlZChvcHRzKTtcbiAgICAgICAgICBwLnNldElkQW5kUmVsYXRlZChzZWxmLm9iamVjdCwgb3B0cyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0sXG4gICAgbWFrZUNoYW5nZXNUb1JlbGF0ZWRXaXRob3V0T2JzZXJ2YXRpb25zOiBmdW5jdGlvbihmKSB7XG4gICAgICBpZiAodGhpcy5yZWxhdGVkKSB7XG4gICAgICAgIHRoaXMucmVsYXRlZC5hcnJheU9ic2VydmVyLmNsb3NlKCk7XG4gICAgICAgIHRoaXMucmVsYXRlZC5hcnJheU9ic2VydmVyID0gbnVsbDtcbiAgICAgICAgZigpO1xuICAgICAgICB0aGlzLndyYXBBcnJheSh0aGlzLnJlbGF0ZWQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZigpO1xuICAgICAgfVxuICAgIH0sXG4gICAgLyoqXG4gICAgICogR2V0IG9sZCB2YWx1ZSB0aGF0IGlzIHNlbnQgb3V0IGluIGVtaXNzaW9ucy5cbiAgICAgKiBAcmV0dXJucyB7Kn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9nZXRPbGRWYWx1ZUZvclNldENoYW5nZUV2ZW50OiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBvbGRWYWx1ZSA9IHRoaXMucmVsYXRlZDtcbiAgICAgIGlmICh1dGlsLmlzQXJyYXkob2xkVmFsdWUpICYmICFvbGRWYWx1ZS5sZW5ndGgpIHtcbiAgICAgICAgb2xkVmFsdWUgPSBudWxsO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG9sZFZhbHVlO1xuICAgIH0sXG4gICAgcmVnaXN0ZXJTZXRDaGFuZ2U6IGZ1bmN0aW9uKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgdmFyIHByb3h5T2JqZWN0ID0gdGhpcy5vYmplY3Q7XG4gICAgICBpZiAoIXByb3h5T2JqZWN0KSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignUHJveHkgbXVzdCBoYXZlIGFuIG9iamVjdCBhc3NvY2lhdGVkJyk7XG4gICAgICB2YXIgbW9kZWwgPSBwcm94eU9iamVjdC5tb2RlbC5uYW1lO1xuICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gcHJveHlPYmplY3QuY29sbGVjdGlvbk5hbWU7XG4gICAgICAvLyBXZSB0YWtlIFtdID09IG51bGwgPT0gdW5kZWZpbmVkIGluIHRoZSBjYXNlIG9mIHJlbGF0aW9uc2hpcHMuXG4gICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgY29sbGVjdGlvbjogY29sbGVjdGlvbk5hbWUsXG4gICAgICAgIG1vZGVsOiBtb2RlbCxcbiAgICAgICAgbG9jYWxJZDogcHJveHlPYmplY3QubG9jYWxJZCxcbiAgICAgICAgZmllbGQ6IHRoaXMuZ2V0Rm9yd2FyZE5hbWUoKSxcbiAgICAgICAgb2xkOiBvbGRWYWx1ZSxcbiAgICAgICAgbmV3OiBuZXdWYWx1ZSxcbiAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU2V0LFxuICAgICAgICBvYmo6IHByb3h5T2JqZWN0XG4gICAgICB9KTtcbiAgICB9LFxuXG4gICAgX2dldFJlbW92ZWRGb3JTcGxpY2VDaGFuZ2VFdmVudDogZnVuY3Rpb24oaWR4LCBudW1SZW1vdmUpIHtcbiAgICAgIHZhciByZW1vdmVkID0gdGhpcy5yZWxhdGVkID8gdGhpcy5yZWxhdGVkLnNsaWNlKGlkeCwgaWR4ICsgbnVtUmVtb3ZlKSA6IG51bGw7XG4gICAgICByZXR1cm4gcmVtb3ZlZDtcbiAgICB9LFxuXG4gICAgX2dldEFkZGVkRm9yU3BsaWNlQ2hhbmdlRXZlbnQ6IGZ1bmN0aW9uKGFyZ3MpIHtcbiAgICAgIHZhciBhZGQgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmdzLCAyKSxcbiAgICAgICAgYWRkZWQgPSBhZGQubGVuZ3RoID8gYWRkIDogW107XG4gICAgICByZXR1cm4gYWRkZWQ7XG4gICAgfSxcblxuICAgIHJlZ2lzdGVyU3BsaWNlQ2hhbmdlOiBmdW5jdGlvbihpZHgsIGFkZGVkLCByZW1vdmVkKSB7XG4gICAgICB2YXIgbW9kZWwgPSB0aGlzLm9iamVjdC5tb2RlbC5uYW1lLFxuICAgICAgICBjb2xsID0gdGhpcy5vYmplY3QuY29sbGVjdGlvbk5hbWU7XG4gICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgY29sbGVjdGlvbjogY29sbCxcbiAgICAgICAgbW9kZWw6IG1vZGVsLFxuICAgICAgICBsb2NhbElkOiB0aGlzLm9iamVjdC5sb2NhbElkLFxuICAgICAgICBmaWVsZDogdGhpcy5nZXRGb3J3YXJkTmFtZSgpLFxuICAgICAgICBpbmRleDogaWR4LFxuICAgICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgICAgICBhZGRlZDogYWRkZWQsXG4gICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgb2JqOiB0aGlzLm9iamVjdFxuICAgICAgfSk7XG4gICAgfSxcbiAgICB3cmFwQXJyYXk6IGZ1bmN0aW9uKGFycikge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgd3JhcEFycmF5Rm9yQXR0cmlidXRlcyhhcnIsIHRoaXMucmV2ZXJzZU5hbWUsIHRoaXMub2JqZWN0KTtcbiAgICAgIGlmICghYXJyLmFycmF5T2JzZXJ2ZXIpIHtcbiAgICAgICAgYXJyLmFycmF5T2JzZXJ2ZXIgPSBuZXcgQXJyYXlPYnNlcnZlcihhcnIpO1xuICAgICAgICB2YXIgb2JzZXJ2ZXJGdW5jdGlvbiA9IGZ1bmN0aW9uKHNwbGljZXMpIHtcbiAgICAgICAgICBzcGxpY2VzLmZvckVhY2goZnVuY3Rpb24oc3BsaWNlKSB7XG4gICAgICAgICAgICB2YXIgYWRkZWQgPSBzcGxpY2UuYWRkZWRDb3VudCA/IGFyci5zbGljZShzcGxpY2UuaW5kZXgsIHNwbGljZS5pbmRleCArIHNwbGljZS5hZGRlZENvdW50KSA6IFtdO1xuICAgICAgICAgICAgdmFyIG1vZGVsID0gc2VsZi5nZXRGb3J3YXJkTW9kZWwoKTtcbiAgICAgICAgICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBtb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgbW9kZWw6IG1vZGVsLm5hbWUsXG4gICAgICAgICAgICAgIGxvY2FsSWQ6IHNlbGYub2JqZWN0LmxvY2FsSWQsXG4gICAgICAgICAgICAgIGZpZWxkOiBzZWxmLmdldEZvcndhcmROYW1lKCksXG4gICAgICAgICAgICAgIHJlbW92ZWQ6IHNwbGljZS5yZW1vdmVkLFxuICAgICAgICAgICAgICBhZGRlZDogYWRkZWQsXG4gICAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgICAgb2JqOiBzZWxmLm9iamVjdFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgICAgIGFyci5hcnJheU9ic2VydmVyLm9wZW4ob2JzZXJ2ZXJGdW5jdGlvbik7XG4gICAgICB9XG4gICAgfSxcbiAgICBzcGxpY2U6IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5zcGxpY2VyKHt9KS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cblxuICB9KTtcblxuXG4gIG1vZHVsZS5leHBvcnRzID0gUmVsYXRpb25zaGlwUHJveHk7XG5cblxufSkoKTsiLCIoZnVuY3Rpb24gKCkge1xuICAgIG1vZHVsZS5leHBvcnRzID0ge1xuICAgICAgICBPbmVUb01hbnk6ICdPbmVUb01hbnknLFxuICAgICAgICBPbmVUb09uZTogJ09uZVRvT25lJyxcbiAgICAgICAgTWFueVRvTWFueTogJ01hbnlUb01hbnknXG4gICAgfTtcbn0pKCk7IiwiLyoqXG4gKiBUaGlzIGlzIGFuIGluLW1lbW9yeSBjYWNoZSBmb3IgbW9kZWxzLiBNb2RlbHMgYXJlIGNhY2hlZCBieSBsb2NhbCBpZCAoX2lkKSBhbmQgcmVtb3RlIGlkIChkZWZpbmVkIGJ5IHRoZSBtYXBwaW5nKS5cbiAqIExvb2t1cHMgYXJlIHBlcmZvcm1lZCBhZ2FpbnN0IHRoZSBjYWNoZSB3aGVuIG1hcHBpbmcuXG4gKiBAbW9kdWxlIGNhY2hlXG4gKi9cbihmdW5jdGlvbigpIHtcblxuICB2YXIgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSgnY2FjaGUnKSxcbiAgICBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpO1xuXG5cbiAgdmFyIGxvY2FsQ2FjaGVCeUlkID0ge30sXG4gICAgbG9jYWxDYWNoZSA9IHt9LFxuICAgIHJlbW90ZUNhY2hlID0ge307XG5cbiAgLyoqXG4gICAqIENsZWFyIG91dCB0aGUgY2FjaGUuXG4gICAqL1xuICBmdW5jdGlvbiByZXNldCgpIHtcbiAgICByZW1vdGVDYWNoZSA9IHt9O1xuICAgIGxvY2FsQ2FjaGVCeUlkID0ge307XG4gICAgbG9jYWxDYWNoZSA9IHt9O1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiB0aGUgb2JqZWN0IGluIHRoZSBjYWNoZSBnaXZlbiBhIGxvY2FsIGlkIChfaWQpXG4gICAqIEBwYXJhbSAge1N0cmluZ30gbG9jYWxJZFxuICAgKiBAcmV0dXJuIHtNb2RlbEluc3RhbmNlfVxuICAgKi9cbiAgZnVuY3Rpb24gZ2V0VmlhTG9jYWxJZChsb2NhbElkKSB7XG4gICAgdmFyIG9iaiA9IGxvY2FsQ2FjaGVCeUlkW2xvY2FsSWRdO1xuICAgIGlmIChvYmopIHtcbiAgICAgIGxvZygnTG9jYWwgY2FjaGUgaGl0OiAnICsgb2JqLl9kdW1wKHRydWUpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbG9nKCdMb2NhbCBjYWNoZSBtaXNzOiAnICsgbG9jYWxJZCk7XG4gICAgfVxuICAgIHJldHVybiBvYmo7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHRoZSBzaW5nbGV0b24gb2JqZWN0IGdpdmVuIGEgc2luZ2xldG9uIG1vZGVsLlxuICAgKiBAcGFyYW0gIHtNb2RlbH0gbW9kZWxcbiAgICogQHJldHVybiB7TW9kZWxJbnN0YW5jZX1cbiAgICovXG4gIGZ1bmN0aW9uIGdldFNpbmdsZXRvbihtb2RlbCkge1xuICAgIHZhciBtb2RlbE5hbWUgPSBtb2RlbC5uYW1lO1xuICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IG1vZGVsLmNvbGxlY3Rpb25OYW1lO1xuICAgIHZhciBjb2xsZWN0aW9uQ2FjaGUgPSBsb2NhbENhY2hlW2NvbGxlY3Rpb25OYW1lXTtcbiAgICBpZiAoY29sbGVjdGlvbkNhY2hlKSB7XG4gICAgICB2YXIgdHlwZUNhY2hlID0gY29sbGVjdGlvbkNhY2hlW21vZGVsTmFtZV07XG4gICAgICBpZiAodHlwZUNhY2hlKSB7XG4gICAgICAgIHZhciBvYmpzID0gW107XG4gICAgICAgIGZvciAodmFyIHByb3AgaW4gdHlwZUNhY2hlKSB7XG4gICAgICAgICAgaWYgKHR5cGVDYWNoZS5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgICAgb2Jqcy5wdXNoKHR5cGVDYWNoZVtwcm9wXSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChvYmpzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICB2YXIgZXJyU3RyID0gJ0Egc2luZ2xldG9uIG1vZGVsIGhhcyBtb3JlIHRoYW4gMSBvYmplY3QgaW4gdGhlIGNhY2hlISBUaGlzIGlzIGEgc2VyaW91cyBlcnJvci4gJyArXG4gICAgICAgICAgICAnRWl0aGVyIGEgbW9kZWwgaGFzIGJlZW4gbW9kaWZpZWQgYWZ0ZXIgb2JqZWN0cyBoYXZlIGFscmVhZHkgYmVlbiBjcmVhdGVkLCBvciBzb21ldGhpbmcgaGFzIGdvbmUnICtcbiAgICAgICAgICAgICd2ZXJ5IHdyb25nLiBQbGVhc2UgZmlsZSBhIGJ1ZyByZXBvcnQgaWYgdGhlIGxhdHRlci4nO1xuICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKGVyclN0cik7XG4gICAgICAgIH0gZWxzZSBpZiAob2Jqcy5sZW5ndGgpIHtcbiAgICAgICAgICByZXR1cm4gb2Jqc1swXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBHaXZlbiBhIHJlbW90ZSBpZGVudGlmaWVyIGFuZCBhbiBvcHRpb25zIG9iamVjdCB0aGF0IGRlc2NyaWJlcyBtYXBwaW5nL2NvbGxlY3Rpb24sXG4gICAqIHJldHVybiB0aGUgbW9kZWwgaWYgY2FjaGVkLlxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IHJlbW90ZUlkXG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0c1xuICAgKiBAcmV0dXJuIHtNb2RlbEluc3RhbmNlfVxuICAgKi9cbiAgZnVuY3Rpb24gZ2V0VmlhUmVtb3RlSWQocmVtb3RlSWQsIG9wdHMpIHtcbiAgICB2YXIgdHlwZSA9IG9wdHMubW9kZWwubmFtZTtcbiAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBvcHRzLm1vZGVsLmNvbGxlY3Rpb25OYW1lO1xuICAgIHZhciBjb2xsZWN0aW9uQ2FjaGUgPSByZW1vdGVDYWNoZVtjb2xsZWN0aW9uTmFtZV07XG4gICAgaWYgKGNvbGxlY3Rpb25DYWNoZSkge1xuICAgICAgdmFyIHR5cGVDYWNoZSA9IHJlbW90ZUNhY2hlW2NvbGxlY3Rpb25OYW1lXVt0eXBlXTtcbiAgICAgIGlmICh0eXBlQ2FjaGUpIHtcbiAgICAgICAgdmFyIG9iaiA9IHR5cGVDYWNoZVtyZW1vdGVJZF07XG4gICAgICAgIGlmIChvYmopIHtcbiAgICAgICAgICBsb2coJ1JlbW90ZSBjYWNoZSBoaXQ6ICcgKyBvYmouX2R1bXAodHJ1ZSkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxvZygnUmVtb3RlIGNhY2hlIG1pc3M6ICcgKyByZW1vdGVJZCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG9iajtcbiAgICAgIH1cbiAgICB9XG4gICAgbG9nKCdSZW1vdGUgY2FjaGUgbWlzczogJyArIHJlbW90ZUlkKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbnNlcnQgYW4gb2JqZWN0IGludG8gdGhlIGNhY2hlIHVzaW5nIGEgcmVtb3RlIGlkZW50aWZpZXIgZGVmaW5lZCBieSB0aGUgbWFwcGluZy5cbiAgICogQHBhcmFtICB7TW9kZWxJbnN0YW5jZX0gb2JqXG4gICAqIEBwYXJhbSAge1N0cmluZ30gcmVtb3RlSWRcbiAgICogQHBhcmFtICB7U3RyaW5nfSBwcmV2aW91c1JlbW90ZUlkIElmIHJlbW90ZSBpZCBoYXMgYmVlbiBjaGFuZ2VkLCB0aGlzIGlzIHRoZSBvbGQgcmVtb3RlIGlkZW50aWZpZXJcbiAgICovXG4gIGZ1bmN0aW9uIHJlbW90ZUluc2VydChvYmosIHJlbW90ZUlkLCBwcmV2aW91c1JlbW90ZUlkKSB7XG4gICAgaWYgKG9iaikge1xuICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gb2JqLm1vZGVsLmNvbGxlY3Rpb25OYW1lO1xuICAgICAgaWYgKGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgICAgIGlmICghcmVtb3RlQ2FjaGVbY29sbGVjdGlvbk5hbWVdKSB7XG4gICAgICAgICAgcmVtb3RlQ2FjaGVbY29sbGVjdGlvbk5hbWVdID0ge307XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHR5cGUgPSBvYmoubW9kZWwubmFtZTtcbiAgICAgICAgaWYgKHR5cGUpIHtcbiAgICAgICAgICBpZiAoIXJlbW90ZUNhY2hlW2NvbGxlY3Rpb25OYW1lXVt0eXBlXSkge1xuICAgICAgICAgICAgcmVtb3RlQ2FjaGVbY29sbGVjdGlvbk5hbWVdW3R5cGVdID0ge307XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChwcmV2aW91c1JlbW90ZUlkKSB7XG4gICAgICAgICAgICByZW1vdGVDYWNoZVtjb2xsZWN0aW9uTmFtZV1bdHlwZV1bcHJldmlvdXNSZW1vdGVJZF0gPSBudWxsO1xuICAgICAgICAgIH1cbiAgICAgICAgICB2YXIgY2FjaGVkT2JqZWN0ID0gcmVtb3RlQ2FjaGVbY29sbGVjdGlvbk5hbWVdW3R5cGVdW3JlbW90ZUlkXTtcbiAgICAgICAgICBpZiAoIWNhY2hlZE9iamVjdCkge1xuICAgICAgICAgICAgcmVtb3RlQ2FjaGVbY29sbGVjdGlvbk5hbWVdW3R5cGVdW3JlbW90ZUlkXSA9IG9iajtcbiAgICAgICAgICAgIGxvZygnUmVtb3RlIGNhY2hlIGluc2VydDogJyArIG9iai5fZHVtcCh0cnVlKSk7XG4gICAgICAgICAgICBsb2coJ1JlbW90ZSBjYWNoZSBub3cgbG9va3MgbGlrZTogJyArIHJlbW90ZUR1bXAodHJ1ZSkpXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFNvbWV0aGluZyBoYXMgZ29uZSByZWFsbHkgd3JvbmcuIE9ubHkgb25lIG9iamVjdCBmb3IgYSBwYXJ0aWN1bGFyIGNvbGxlY3Rpb24vdHlwZS9yZW1vdGVpZCBjb21ib1xuICAgICAgICAgICAgLy8gc2hvdWxkIGV2ZXIgZXhpc3QuXG4gICAgICAgICAgICBpZiAob2JqICE9IGNhY2hlZE9iamVjdCkge1xuICAgICAgICAgICAgICB2YXIgbWVzc2FnZSA9ICdPYmplY3QgJyArIGNvbGxlY3Rpb25OYW1lLnRvU3RyaW5nKCkgKyAnOicgKyB0eXBlLnRvU3RyaW5nKCkgKyAnWycgKyBvYmoubW9kZWwuaWQgKyAnPVwiJyArIHJlbW90ZUlkICsgJ1wiXSBhbHJlYWR5IGV4aXN0cyBpbiB0aGUgY2FjaGUuJyArXG4gICAgICAgICAgICAgICAgJyBUaGlzIGlzIGEgc2VyaW91cyBlcnJvciwgcGxlYXNlIGZpbGUgYSBidWcgcmVwb3J0IGlmIHlvdSBhcmUgZXhwZXJpZW5jaW5nIHRoaXMgb3V0IGluIHRoZSB3aWxkJztcbiAgICAgICAgICAgICAgbG9nKG1lc3NhZ2UsIHtcbiAgICAgICAgICAgICAgICBvYmo6IG9iaixcbiAgICAgICAgICAgICAgICBjYWNoZWRPYmplY3Q6IGNhY2hlZE9iamVjdFxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IobWVzc2FnZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBsb2coJ09iamVjdCBoYXMgYWxyZWFkeSBiZWVuIGluc2VydGVkOiAnICsgb2JqLl9kdW1wKHRydWUpKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTW9kZWwgaGFzIG5vIHR5cGUnLCB7XG4gICAgICAgICAgICBtb2RlbDogb2JqLm1vZGVsLFxuICAgICAgICAgICAgb2JqOiBvYmpcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ01vZGVsIGhhcyBubyBjb2xsZWN0aW9uJywge1xuICAgICAgICAgIG1vZGVsOiBvYmoubW9kZWwsXG4gICAgICAgICAgb2JqOiBvYmpcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBtc2cgPSAnTXVzdCBwYXNzIGFuIG9iamVjdCB3aGVuIGluc2VydGluZyB0byBjYWNoZSc7XG4gICAgICBsb2cobXNnKTtcbiAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKG1zZyk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIER1bXAgdGhlIHJlbW90ZSBpZCBjYWNoZVxuICAgKiBAcGFyYW0gIHtib29sZWFufSBhc0pzb24gV2hldGhlciBvciBub3QgdG8gYXBwbHkgSlNPTi5zdHJpbmdpZnlcbiAgICogQHJldHVybiB7U3RyaW5nfE9iamVjdH1cbiAgICovXG4gIGZ1bmN0aW9uIHJlbW90ZUR1bXAoYXNKc29uKSB7XG4gICAgdmFyIGR1bXBlZFJlc3RDYWNoZSA9IHt9O1xuICAgIGZvciAodmFyIGNvbGwgaW4gcmVtb3RlQ2FjaGUpIHtcbiAgICAgIGlmIChyZW1vdGVDYWNoZS5oYXNPd25Qcm9wZXJ0eShjb2xsKSkge1xuICAgICAgICB2YXIgZHVtcGVkQ29sbENhY2hlID0ge307XG4gICAgICAgIGR1bXBlZFJlc3RDYWNoZVtjb2xsXSA9IGR1bXBlZENvbGxDYWNoZTtcbiAgICAgICAgdmFyIGNvbGxDYWNoZSA9IHJlbW90ZUNhY2hlW2NvbGxdO1xuICAgICAgICBmb3IgKHZhciBtb2RlbCBpbiBjb2xsQ2FjaGUpIHtcbiAgICAgICAgICBpZiAoY29sbENhY2hlLmhhc093blByb3BlcnR5KG1vZGVsKSkge1xuICAgICAgICAgICAgdmFyIGR1bXBlZE1vZGVsQ2FjaGUgPSB7fTtcbiAgICAgICAgICAgIGR1bXBlZENvbGxDYWNoZVttb2RlbF0gPSBkdW1wZWRNb2RlbENhY2hlO1xuICAgICAgICAgICAgdmFyIG1vZGVsQ2FjaGUgPSBjb2xsQ2FjaGVbbW9kZWxdO1xuICAgICAgICAgICAgZm9yICh2YXIgcmVtb3RlSWQgaW4gbW9kZWxDYWNoZSkge1xuICAgICAgICAgICAgICBpZiAobW9kZWxDYWNoZS5oYXNPd25Qcm9wZXJ0eShyZW1vdGVJZCkpIHtcbiAgICAgICAgICAgICAgICBpZiAobW9kZWxDYWNoZVtyZW1vdGVJZF0pIHtcbiAgICAgICAgICAgICAgICAgIGR1bXBlZE1vZGVsQ2FjaGVbcmVtb3RlSWRdID0gbW9kZWxDYWNoZVtyZW1vdGVJZF0uX2R1bXAoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGFzSnNvbiA/IHV0aWwucHJldHR5UHJpbnQoKGR1bXBlZFJlc3RDYWNoZSwgbnVsbCwgNFxuICApKSA6XG4gICAgZHVtcGVkUmVzdENhY2hlO1xuICB9XG5cbiAgLyoqXG4gICAqIER1bXAgdGhlIGxvY2FsIGlkIChfaWQpIGNhY2hlXG4gICAqIEBwYXJhbSAge2Jvb2xlYW59IGFzSnNvbiBXaGV0aGVyIG9yIG5vdCB0byBhcHBseSBKU09OLnN0cmluZ2lmeVxuICAgKiBAcmV0dXJuIHtTdHJpbmd8T2JqZWN0fVxuICAgKi9cbiAgZnVuY3Rpb24gbG9jYWxEdW1wKGFzSnNvbikge1xuICAgIHZhciBkdW1wZWRJZENhY2hlID0ge307XG4gICAgZm9yICh2YXIgaWQgaW4gbG9jYWxDYWNoZUJ5SWQpIHtcbiAgICAgIGlmIChsb2NhbENhY2hlQnlJZC5oYXNPd25Qcm9wZXJ0eShpZCkpIHtcbiAgICAgICAgZHVtcGVkSWRDYWNoZVtpZF0gPSBsb2NhbENhY2hlQnlJZFtpZF0uX2R1bXAoKVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gYXNKc29uID8gdXRpbC5wcmV0dHlQcmludCgoZHVtcGVkSWRDYWNoZSwgbnVsbCwgNFxuICApKSA6XG4gICAgZHVtcGVkSWRDYWNoZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEdW1wIHRvIHRoZSBjYWNoZS5cbiAgICogQHBhcmFtICB7Ym9vbGVhbn0gYXNKc29uIFdoZXRoZXIgb3Igbm90IHRvIGFwcGx5IEpTT04uc3RyaW5naWZ5XG4gICAqIEByZXR1cm4ge1N0cmluZ3xPYmplY3R9XG4gICAqL1xuICBmdW5jdGlvbiBkdW1wKGFzSnNvbikge1xuICAgIHZhciBkdW1wZWQgPSB7XG4gICAgICBsb2NhbENhY2hlOiBsb2NhbER1bXAoKSxcbiAgICAgIHJlbW90ZUNhY2hlOiByZW1vdGVEdW1wKClcbiAgICB9O1xuICAgIHJldHVybiBhc0pzb24gPyB1dGlsLnByZXR0eVByaW50KChkdW1wZWQsIG51bGwsIDRcbiAgKSkgOlxuICAgIGR1bXBlZDtcbiAgfVxuXG4gIGZ1bmN0aW9uIF9yZW1vdGVDYWNoZSgpIHtcbiAgICByZXR1cm4gcmVtb3RlQ2FjaGVcbiAgfVxuXG4gIGZ1bmN0aW9uIF9sb2NhbENhY2hlKCkge1xuICAgIHJldHVybiBsb2NhbENhY2hlQnlJZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBRdWVyeSB0aGUgY2FjaGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRzIE9iamVjdCBkZXNjcmliaW5nIHRoZSBxdWVyeVxuICAgKiBAcmV0dXJuIHtNb2RlbEluc3RhbmNlfVxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBqc1xuICAgKiBjYWNoZS5nZXQoe19pZDogJzUnfSk7IC8vIFF1ZXJ5IGJ5IGxvY2FsIGlkXG4gICAqIGNhY2hlLmdldCh7cmVtb3RlSWQ6ICc1JywgbWFwcGluZzogbXlNYXBwaW5nfSk7IC8vIFF1ZXJ5IGJ5IHJlbW90ZSBpZFxuICAgKiBgYGBcbiAgICovXG4gIGZ1bmN0aW9uIGdldChvcHRzKSB7XG4gICAgbG9nKCdnZXQnLCBvcHRzKTtcbiAgICB2YXIgb2JqLCBpZEZpZWxkLCByZW1vdGVJZDtcbiAgICB2YXIgbG9jYWxJZCA9IG9wdHMubG9jYWxJZDtcbiAgICBpZiAobG9jYWxJZCkge1xuICAgICAgb2JqID0gZ2V0VmlhTG9jYWxJZChsb2NhbElkKTtcbiAgICAgIGlmIChvYmopIHtcbiAgICAgICAgcmV0dXJuIG9iajtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChvcHRzLm1vZGVsKSB7XG4gICAgICAgICAgaWRGaWVsZCA9IG9wdHMubW9kZWwuaWQ7XG4gICAgICAgICAgcmVtb3RlSWQgPSBvcHRzW2lkRmllbGRdO1xuICAgICAgICAgIGxvZyhpZEZpZWxkICsgJz0nICsgcmVtb3RlSWQpO1xuICAgICAgICAgIHJldHVybiBnZXRWaWFSZW1vdGVJZChyZW1vdGVJZCwgb3B0cyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKG9wdHMubW9kZWwpIHtcbiAgICAgIGlkRmllbGQgPSBvcHRzLm1vZGVsLmlkO1xuICAgICAgcmVtb3RlSWQgPSBvcHRzW2lkRmllbGRdO1xuICAgICAgaWYgKHJlbW90ZUlkKSB7XG4gICAgICAgIHJldHVybiBnZXRWaWFSZW1vdGVJZChyZW1vdGVJZCwgb3B0cyk7XG4gICAgICB9IGVsc2UgaWYgKG9wdHMubW9kZWwuc2luZ2xldG9uKSB7XG4gICAgICAgIHJldHVybiBnZXRTaW5nbGV0b24ob3B0cy5tb2RlbCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvZygnSW52YWxpZCBvcHRzIHRvIGNhY2hlJywge1xuICAgICAgICBvcHRzOiBvcHRzXG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKipcbiAgICogSW5zZXJ0IGFuIG9iamVjdCBpbnRvIHRoZSBjYWNoZS5cbiAgICogQHBhcmFtICB7TW9kZWxJbnN0YW5jZX0gb2JqXG4gICAqIEB0aHJvd3Mge0ludGVybmFsU2llc3RhRXJyb3J9IEFuIG9iamVjdCB3aXRoIF9pZC9yZW1vdGVJZCBhbHJlYWR5IGV4aXN0cy4gTm90IHRocm93biBpZiBzYW1lIG9iaGVjdC5cbiAgICovXG4gIGZ1bmN0aW9uIGluc2VydChvYmopIHtcbiAgICB2YXIgbG9jYWxJZCA9IG9iai5sb2NhbElkO1xuICAgIGlmIChsb2NhbElkKSB7XG4gICAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBvYmoubW9kZWwuY29sbGVjdGlvbk5hbWU7XG4gICAgICB2YXIgbW9kZWxOYW1lID0gb2JqLm1vZGVsLm5hbWU7XG4gICAgICBsb2coJ0xvY2FsIGNhY2hlIGluc2VydDogJyArIG9iai5fZHVtcFN0cmluZygpKTtcbiAgICAgIGlmICghbG9jYWxDYWNoZUJ5SWRbbG9jYWxJZF0pIHtcbiAgICAgICAgbG9jYWxDYWNoZUJ5SWRbbG9jYWxJZF0gPSBvYmo7XG4gICAgICAgIGxvZygnTG9jYWwgY2FjaGUgbm93IGxvb2tzIGxpa2U6ICcgKyBsb2NhbER1bXAodHJ1ZSkpO1xuICAgICAgICBpZiAoIWxvY2FsQ2FjaGVbY29sbGVjdGlvbk5hbWVdKSBsb2NhbENhY2hlW2NvbGxlY3Rpb25OYW1lXSA9IHt9O1xuICAgICAgICBpZiAoIWxvY2FsQ2FjaGVbY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV0pIGxvY2FsQ2FjaGVbY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV0gPSB7fTtcbiAgICAgICAgbG9jYWxDYWNoZVtjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXVtsb2NhbElkXSA9IG9iajtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFNvbWV0aGluZyBoYXMgZ29uZSBiYWRseSB3cm9uZyBoZXJlLiBUd28gb2JqZWN0cyBzaG91bGQgbmV2ZXIgZXhpc3Qgd2l0aCB0aGUgc2FtZSBfaWRcbiAgICAgICAgaWYgKGxvY2FsQ2FjaGVCeUlkW2xvY2FsSWRdICE9IG9iaikge1xuICAgICAgICAgIHZhciBtZXNzYWdlID0gJ09iamVjdCB3aXRoIGxvY2FsSWQ9XCInICsgbG9jYWxJZC50b1N0cmluZygpICsgJ1wiIGlzIGFscmVhZHkgaW4gdGhlIGNhY2hlLiAnICtcbiAgICAgICAgICAgICdUaGlzIGlzIGEgc2VyaW91cyBlcnJvci4gUGxlYXNlIGZpbGUgYSBidWcgcmVwb3J0IGlmIHlvdSBhcmUgZXhwZXJpZW5jaW5nIHRoaXMgb3V0IGluIHRoZSB3aWxkJztcbiAgICAgICAgICBsb2cobWVzc2FnZSk7XG4gICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IobWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdmFyIGlkRmllbGQgPSBvYmouaWRGaWVsZDtcbiAgICB2YXIgcmVtb3RlSWQgPSBvYmpbaWRGaWVsZF07XG4gICAgaWYgKHJlbW90ZUlkKSB7XG4gICAgICByZW1vdGVJbnNlcnQob2JqLCByZW1vdGVJZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvZygnTm8gcmVtb3RlIGlkIChcIicgKyBpZEZpZWxkICsgJ1wiKSBzbyB3b250IGJlIHBsYWNpbmcgaW4gdGhlIHJlbW90ZSBjYWNoZScsIG9iaik7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdHJ1ZSBpZiBvYmplY3QgaXMgaW4gdGhlIGNhY2hlXG4gICAqIEBwYXJhbSAge01vZGVsSW5zdGFuY2V9IG9ialxuICAgKiBAcmV0dXJuIHtib29sZWFufVxuICAgKi9cbiAgZnVuY3Rpb24gY29udGFpbnMob2JqKSB7XG4gICAgdmFyIHEgPSB7XG4gICAgICBsb2NhbElkOiBvYmoubG9jYWxJZFxuICAgIH07XG4gICAgdmFyIG1vZGVsID0gb2JqLm1vZGVsO1xuICAgIGlmIChtb2RlbC5pZCkge1xuICAgICAgaWYgKG9ialttb2RlbC5pZF0pIHtcbiAgICAgICAgcS5tb2RlbCA9IG1vZGVsO1xuICAgICAgICBxW21vZGVsLmlkXSA9IG9ialttb2RlbC5pZF07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiAhIWdldChxKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmVzIHRoZSBvYmplY3QgZnJvbSB0aGUgY2FjaGUgKGlmIGl0J3MgYWN0dWFsbHkgaW4gdGhlIGNhY2hlKSBvdGhlcndpc2VzIHRocm93cyBhbiBlcnJvci5cbiAgICogQHBhcmFtICB7TW9kZWxJbnN0YW5jZX0gb2JqXG4gICAqIEB0aHJvd3Mge0ludGVybmFsU2llc3RhRXJyb3J9IElmIG9iamVjdCBhbHJlYWR5IGluIHRoZSBjYWNoZS5cbiAgICovXG4gIGZ1bmN0aW9uIHJlbW92ZShvYmopIHtcbiAgICBpZiAoY29udGFpbnMob2JqKSkge1xuICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gb2JqLm1vZGVsLmNvbGxlY3Rpb25OYW1lO1xuICAgICAgdmFyIG1vZGVsTmFtZSA9IG9iai5tb2RlbC5uYW1lO1xuICAgICAgdmFyIGxvY2FsSWQgPSBvYmoubG9jYWxJZDtcbiAgICAgIGlmICghbW9kZWxOYW1lKSB0aHJvdyBJbnRlcm5hbFNpZXN0YUVycm9yKCdObyBtYXBwaW5nIG5hbWUnKTtcbiAgICAgIGlmICghY29sbGVjdGlvbk5hbWUpIHRocm93IEludGVybmFsU2llc3RhRXJyb3IoJ05vIGNvbGxlY3Rpb24gbmFtZScpO1xuICAgICAgaWYgKCFsb2NhbElkKSB0aHJvdyBJbnRlcm5hbFNpZXN0YUVycm9yKCdObyBsb2NhbElkJyk7XG4gICAgICBkZWxldGUgbG9jYWxDYWNoZVtjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXVtsb2NhbElkXTtcbiAgICAgIGRlbGV0ZSBsb2NhbENhY2hlQnlJZFtsb2NhbElkXTtcbiAgICAgIGlmIChvYmoubW9kZWwuaWQpIHtcbiAgICAgICAgdmFyIHJlbW90ZUlkID0gb2JqW29iai5tb2RlbC5pZF07XG4gICAgICAgIGlmIChyZW1vdGVJZCkge1xuICAgICAgICAgIGRlbGV0ZSByZW1vdGVDYWNoZVtjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXVtyZW1vdGVJZF07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuXG4gIGV4cG9ydHMuX3JlbW90ZUNhY2hlID0gX3JlbW90ZUNhY2hlO1xuICBleHBvcnRzLl9sb2NhbENhY2hlID0gX2xvY2FsQ2FjaGU7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX2xvY2FsQ2FjaGVCeVR5cGUnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBsb2NhbENhY2hlO1xuICAgIH1cbiAgfSk7XG4gIGV4cG9ydHMuZ2V0ID0gZ2V0O1xuICBleHBvcnRzLmluc2VydCA9IGluc2VydDtcbiAgZXhwb3J0cy5yZW1vdGVJbnNlcnQgPSByZW1vdGVJbnNlcnQ7XG4gIGV4cG9ydHMucmVzZXQgPSByZXNldDtcbiAgZXhwb3J0cy5fZHVtcCA9IGR1bXA7XG4gIGV4cG9ydHMuY29udGFpbnMgPSBjb250YWlucztcbiAgZXhwb3J0cy5yZW1vdmUgPSByZW1vdmU7XG4gIGV4cG9ydHMuZ2V0U2luZ2xldG9uID0gZ2V0U2luZ2xldG9uO1xuICBleHBvcnRzLmNvdW50ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKGxvY2FsQ2FjaGVCeUlkKS5sZW5ndGg7XG4gIH1cbn0pKCk7IiwiLyoqXG4gKiBAbW9kdWxlIGNvbGxlY3Rpb25cbiAqL1xuKGZ1bmN0aW9uKCkge1xuICB2YXIgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSgnY29sbGVjdGlvbicpLFxuICAgIENvbGxlY3Rpb25SZWdpc3RyeSA9IHJlcXVpcmUoJy4vY29sbGVjdGlvblJlZ2lzdHJ5JykuQ29sbGVjdGlvblJlZ2lzdHJ5LFxuICAgIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgICBNb2RlbCA9IHJlcXVpcmUoJy4vbW9kZWwnKSxcbiAgICBleHRlbmQgPSByZXF1aXJlKCdleHRlbmQnKSxcbiAgICBvYnNlcnZlID0gcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKS5QbGF0Zm9ybSxcbiAgICBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICAgIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICBfID0gdXRpbC5fLFxuICAgIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLFxuICAgIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpO1xuXG5cbiAgLyoqXG4gICAqIEEgY29sbGVjdGlvbiBkZXNjcmliZXMgYSBzZXQgb2YgbW9kZWxzIGFuZCBvcHRpb25hbGx5IGEgUkVTVCBBUEkgd2hpY2ggd2Ugd291bGRcbiAgICogbGlrZSB0byBtb2RlbC5cbiAgICpcbiAgICogQHBhcmFtIG5hbWVcbiAgICogQHBhcmFtIG9wdHNcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYGpzXG4gICAqIHZhciBHaXRIdWIgPSBuZXcgc2llc3RhKCdHaXRIdWInKVxuICAgKiAvLyAuLi4gY29uZmlndXJlIG1hcHBpbmdzLCBkZXNjcmlwdG9ycyBldGMgLi4uXG4gICAqIEdpdEh1Yi5pbnN0YWxsKGZ1bmN0aW9uICgpIHtcbiAgICAgKiAgICAgLy8gLi4uIGNhcnJ5IG9uLlxuICAgICAqIH0pO1xuICAgKiBgYGBcbiAgICovXG4gIGZ1bmN0aW9uIENvbGxlY3Rpb24obmFtZSwgb3B0cykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoIW5hbWUpIHRocm93IG5ldyBFcnJvcignQ29sbGVjdGlvbiBtdXN0IGhhdmUgYSBuYW1lJyk7XG5cbiAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICB1dGlsLmV4dGVuZEZyb21PcHRzKHRoaXMsIG9wdHMsIHtcbiAgICAgIC8qKlxuICAgICAgICogVGhlIFVSTCBvZiB0aGUgQVBJIGUuZy4gaHR0cDovL2FwaS5naXRodWIuY29tXG4gICAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAgICovXG4gICAgICBiYXNlVVJMOiAnJ1xuICAgIH0pO1xuXG4gICAgXy5leHRlbmQodGhpcywge1xuICAgICAgbmFtZTogbmFtZSxcbiAgICAgIF9yYXdNb2RlbHM6IHt9LFxuICAgICAgX21vZGVsczoge30sXG4gICAgICBfb3B0czogb3B0cyxcbiAgICAgIC8qKlxuICAgICAgICogU2V0IHRvIHRydWUgaWYgaW5zdGFsbGF0aW9uIGhhcyBzdWNjZWVkZWQuIFlvdSBjYW5ub3QgdXNlIHRoZSBjb2xsZWN0aW9cbiAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICovXG4gICAgICBpbnN0YWxsZWQ6IGZhbHNlXG4gICAgfSk7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyh0aGlzLCB7XG4gICAgICBkaXJ0eToge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGlmIChzaWVzdGEuZXh0LnN0b3JhZ2VFbmFibGVkKSB7XG4gICAgICAgICAgICB2YXIgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb24gPSBzaWVzdGEuZXh0LnN0b3JhZ2UuX3Vuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uLFxuICAgICAgICAgICAgICBoYXNoID0gdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bc2VsZi5uYW1lXSB8fCB7fTtcbiAgICAgICAgICAgIHJldHVybiAhIU9iamVjdC5rZXlzKGhhc2gpLmxlbmd0aDtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBDb2xsZWN0aW9uUmVnaXN0cnkucmVnaXN0ZXIodGhpcyk7XG4gICAgZXZlbnRzLlByb3h5RXZlbnRFbWl0dGVyLmNhbGwodGhpcywgdGhpcy5uYW1lKTtcbiAgfVxuXG4gIENvbGxlY3Rpb24ucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShldmVudHMuUHJveHlFdmVudEVtaXR0ZXIucHJvdG90eXBlKTtcblxuICBfLmV4dGVuZChDb2xsZWN0aW9uLnByb3RvdHlwZSwge1xuICAgIC8qKlxuICAgICAqIEVuc3VyZSBtYXBwaW5ncyBhcmUgaW5zdGFsbGVkLlxuICAgICAqIEBwYXJhbSBbY2JdXG4gICAgICogQGNsYXNzIENvbGxlY3Rpb25cbiAgICAgKi9cbiAgICBpbnN0YWxsOiBmdW5jdGlvbihjYikge1xuICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICBpZiAoIXRoaXMuaW5zdGFsbGVkKSB7XG4gICAgICAgICAgdmFyIG1vZGVsc1RvSW5zdGFsbCA9IFtdO1xuICAgICAgICAgIGZvciAodmFyIG5hbWUgaW4gdGhpcy5fbW9kZWxzKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fbW9kZWxzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgICAgICAgIHZhciBtb2RlbCA9IHRoaXMuX21vZGVsc1tuYW1lXTtcbiAgICAgICAgICAgICAgbW9kZWxzVG9JbnN0YWxsLnB1c2gobW9kZWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBsb2coJ1RoZXJlIGFyZSAnICsgbW9kZWxzVG9JbnN0YWxsLmxlbmd0aC50b1N0cmluZygpICsgJyBtYXBwaW5ncyB0byBpbnN0YWxsJyk7XG4gICAgICAgICAgaWYgKG1vZGVsc1RvSW5zdGFsbC5sZW5ndGgpIHtcbiAgICAgICAgICAgIHZhciB0YXNrcyA9IF8ubWFwKG1vZGVsc1RvSW5zdGFsbCwgZnVuY3Rpb24obSkge1xuICAgICAgICAgICAgICByZXR1cm4gXy5iaW5kKG0uaW5zdGFsbCwgbSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdXRpbC5hc3luYy5wYXJhbGxlbCh0YXNrcywgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgIGlmIChlcnIpIHtcblxuICAgICAgICAgICAgICAgIGxvZygnRmFpbGVkIHRvIGluc3RhbGwgY29sbGVjdGlvbicsIGVycik7XG4gICAgICAgICAgICAgICAgc2VsZi5fZmluYWxpc2VJbnN0YWxsYXRpb24oZXJyLCBjYik7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgc2VsZi5pbnN0YWxsZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHZhciBlcnJvcnMgPSBbXTtcbiAgICAgICAgICAgICAgICBfLmVhY2gobW9kZWxzVG9JbnN0YWxsLCBmdW5jdGlvbihtKSB7XG4gICAgICAgICAgICAgICAgICBsb2coJ0luc3RhbGxpbmcgcmVsYXRpb25zaGlwcyBmb3IgbWFwcGluZyB3aXRoIG5hbWUgXCInICsgbS5uYW1lICsgJ1wiJyk7XG4gICAgICAgICAgICAgICAgICB2YXIgZXJyID0gbS5pbnN0YWxsUmVsYXRpb25zaGlwcygpO1xuICAgICAgICAgICAgICAgICAgaWYgKGVycikgZXJyb3JzLnB1c2goZXJyKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAoIWVycm9ycy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgIF8uZWFjaChtb2RlbHNUb0luc3RhbGwsIGZ1bmN0aW9uKG0pIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nKCdJbnN0YWxsaW5nIHJldmVyc2UgcmVsYXRpb25zaGlwcyBmb3IgbWFwcGluZyB3aXRoIG5hbWUgXCInICsgbS5uYW1lICsgJ1wiJyk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBlcnIgPSBtLmluc3RhbGxSZXZlcnNlUmVsYXRpb25zaGlwcygpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSBlcnJvcnMucHVzaChlcnIpO1xuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGVycm9ycy5sZW5ndGggPT0gMSkge1xuICAgICAgICAgICAgICAgICAgZXJyID0gZXJyb3JzWzBdO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgZXJyID0gZXJyb3JzO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHNlbGYuX2ZpbmFsaXNlSW5zdGFsbGF0aW9uKGVyciwgY2IpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzZWxmLl9maW5hbGlzZUluc3RhbGxhdGlvbihudWxsLCBjYik7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdDb2xsZWN0aW9uIFwiJyArIHRoaXMubmFtZSArICdcIiBoYXMgYWxyZWFkeSBiZWVuIGluc3RhbGxlZCcpO1xuICAgICAgICB9XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBNYXJrIHRoaXMgY29sbGVjdGlvbiBhcyBpbnN0YWxsZWQsIGFuZCBwbGFjZSB0aGUgY29sbGVjdGlvbiBvbiB0aGUgZ2xvYmFsIFNpZXN0YSBvYmplY3QuXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSAgIGVyclxuICAgICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgICAqIEBjbGFzcyBDb2xsZWN0aW9uXG4gICAgICovXG4gICAgX2ZpbmFsaXNlSW5zdGFsbGF0aW9uOiBmdW5jdGlvbihlcnIsIGNhbGxiYWNrKSB7XG4gICAgICBpZiAoZXJyKSBlcnIgPSBlcnJvcignRXJyb3JzIHdlcmUgZW5jb3VudGVyZWQgd2hpbHN0IHNldHRpbmcgdXAgdGhlIGNvbGxlY3Rpb24nLCB7ZXJyb3JzOiBlcnJ9KTtcbiAgICAgIGlmICghZXJyKSB7XG4gICAgICAgIHRoaXMuaW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgdmFyIGluZGV4ID0gcmVxdWlyZSgnLi9pbmRleCcpO1xuICAgICAgICBpbmRleFt0aGlzLm5hbWVdID0gdGhpcztcbiAgICAgIH1cbiAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBHaXZlbiB0aGUgbmFtZSBvZiBhIG1hcHBpbmcgYW5kIGFuIG9wdGlvbnMgb2JqZWN0IGRlc2NyaWJpbmcgdGhlIG1hcHBpbmcsIGNyZWF0aW5nIGEgTW9kZWxcbiAgICAgKiBvYmplY3QsIGluc3RhbGwgaXQgYW5kIHJldHVybiBpdC5cbiAgICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWVcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IG9wdHNcbiAgICAgKiBAcmV0dXJuIHtNb2RlbH1cbiAgICAgKiBAY2xhc3MgQ29sbGVjdGlvblxuICAgICAqL1xuICAgIF9tb2RlbDogZnVuY3Rpb24obmFtZSwgb3B0cykge1xuICAgICAgaWYgKG5hbWUpIHtcbiAgICAgICAgdGhpcy5fcmF3TW9kZWxzW25hbWVdID0gb3B0cztcbiAgICAgICAgb3B0cyA9IGV4dGVuZCh0cnVlLCB7fSwgb3B0cyk7XG4gICAgICAgIG9wdHMubmFtZSA9IG5hbWU7XG4gICAgICAgIG9wdHMuY29sbGVjdGlvbiA9IHRoaXM7XG4gICAgICAgIHZhciBtb2RlbCA9IG5ldyBNb2RlbChvcHRzKTtcbiAgICAgICAgdGhpcy5fbW9kZWxzW25hbWVdID0gbW9kZWw7XG4gICAgICAgIHRoaXNbbmFtZV0gPSBtb2RlbDtcbiAgICAgICAgcmV0dXJuIG1vZGVsO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBuYW1lIHNwZWNpZmllZCB3aGVuIGNyZWF0aW5nIG1hcHBpbmcnKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmVnaXN0ZXJzIGEgbW9kZWwgd2l0aCB0aGlzIGNvbGxlY3Rpb24uXG4gICAgICogQHBhcmFtIHtTdHJpbmd8T2JqZWN0fSBvcHRzT3JOYW1lIEFuIG9wdGlvbnMgb2JqZWN0IG9yIHRoZSBuYW1lIG9mIHRoZSBtYXBwaW5nLiBNdXN0IHBhc3Mgb3B0aW9ucyBhcyBzZWNvbmQgcGFyYW0gaWYgc3BlY2lmeSBuYW1lLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzIE9wdGlvbnMgaWYgbmFtZSBhbHJlYWR5IHNwZWNpZmllZC5cbiAgICAgKiBAcmV0dXJuIHtNb2RlbH1cbiAgICAgKiBAY2xhc3MgQ29sbGVjdGlvblxuICAgICAqL1xuICAgIG1vZGVsOiBmdW5jdGlvbihvcCkge1xuICAgICAgdmFyIGFjY2VwdE1vZGVscyA9ICF0aGlzLmluc3RhbGxlZDtcbiAgICAgIGlmIChhY2NlcHRNb2RlbHMpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09IDEpIHtcbiAgICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkoYXJndW1lbnRzWzBdKSkge1xuICAgICAgICAgICAgICByZXR1cm4gXy5tYXAoYXJndW1lbnRzWzBdLCBmdW5jdGlvbihtKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNlbGYuX21vZGVsKG0ubmFtZSwgbSk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdmFyIG5hbWUsIG9wdHM7XG4gICAgICAgICAgICAgIGlmICh1dGlsLmlzU3RyaW5nKGFyZ3VtZW50c1swXSkpIHtcbiAgICAgICAgICAgICAgICBuYW1lID0gYXJndW1lbnRzWzBdO1xuICAgICAgICAgICAgICAgIG9wdHMgPSB7fTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBvcHRzID0gYXJndW1lbnRzWzBdO1xuICAgICAgICAgICAgICAgIG5hbWUgPSBvcHRzLm5hbWU7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX21vZGVsKG5hbWUsIG9wdHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGFyZ3VtZW50c1swXSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fbW9kZWwoYXJndW1lbnRzWzBdLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmV0dXJuIF8ubWFwKGFyZ3VtZW50cywgZnVuY3Rpb24obSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzZWxmLl9tb2RlbChtLm5hbWUsIG0pO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICB0aHJvdyBFcnJvcignQ2Fubm90IGNyZWF0ZSBuZXcgbW9kZWxzIG9uY2UgdGhlIG9iamVjdCBncmFwaCBpcyBlc3RhYmxpc2hlZCEnKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBEdW1wIHRoaXMgY29sbGVjdGlvbiBhcyBKU09OXG4gICAgICogQHBhcmFtICB7Qm9vbGVhbn0gYXNKc29uIFdoZXRoZXIgb3Igbm90IHRvIGFwcGx5IEpTT04uc3RyaW5naWZ5XG4gICAgICogQHJldHVybiB7U3RyaW5nfE9iamVjdH1cbiAgICAgKiBAY2xhc3MgQ29sbGVjdGlvblxuICAgICAqL1xuICAgIF9kdW1wOiBmdW5jdGlvbihhc0pzb24pIHtcbiAgICAgIHZhciBvYmogPSB7fTtcbiAgICAgIG9iai5pbnN0YWxsZWQgPSB0aGlzLmluc3RhbGxlZDtcbiAgICAgIG9iai5kb2NJZCA9IHRoaXMuX2RvY0lkO1xuICAgICAgb2JqLm5hbWUgPSB0aGlzLm5hbWU7XG4gICAgICBvYmouYmFzZVVSTCA9IHRoaXMuYmFzZVVSTDtcbiAgICAgIHJldHVybiBhc0pzb24gPyB1dGlsLnByZXR0eVByaW50KG9iaikgOiBvYmo7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIG51bWJlciBvZiBvYmplY3RzIGluIHRoaXMgY29sbGVjdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBjYlxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlfVxuICAgICAqL1xuICAgIGNvdW50OiBmdW5jdGlvbihjYikge1xuICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgICAgdmFyIHRhc2tzID0gXy5tYXAodGhpcy5fbW9kZWxzLCBmdW5jdGlvbihtKSB7XG4gICAgICAgICAgcmV0dXJuIF8uYmluZChtLmNvdW50LCBtKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHV0aWwuYXN5bmMucGFyYWxsZWwodGFza3MsIGZ1bmN0aW9uKGVyciwgbnMpIHtcbiAgICAgICAgICB2YXIgbjtcbiAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgbiA9IF8ucmVkdWNlKG5zLCBmdW5jdGlvbihtLCByKSB7XG4gICAgICAgICAgICAgIHJldHVybiBtICsgclxuICAgICAgICAgICAgfSwgMCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNiKGVyciwgbik7XG4gICAgICAgIH0pO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9LFxuXG4gICAgZ3JhcGg6IGZ1bmN0aW9uKGRhdGEsIG9wdHMsIGNiKSB7XG4gICAgICBpZiAodHlwZW9mIG9wdHMgPT0gJ2Z1bmN0aW9uJykgY2IgPSBvcHRzO1xuICAgICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgICB2YXIgdGFza3MgPSBbXSwgZXJyO1xuICAgICAgICBmb3IgKHZhciBtb2RlbE5hbWUgaW4gZGF0YSkge1xuICAgICAgICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KG1vZGVsTmFtZSkpIHtcbiAgICAgICAgICAgIHZhciBtb2RlbCA9IHRoaXMuX21vZGVsc1ttb2RlbE5hbWVdO1xuICAgICAgICAgICAgaWYgKG1vZGVsKSB7XG4gICAgICAgICAgICAgIChmdW5jdGlvbihtb2RlbCwgZGF0YSkge1xuICAgICAgICAgICAgICAgIHRhc2tzLnB1c2goZnVuY3Rpb24oZG9uZSkge1xuICAgICAgICAgICAgICAgICAgbW9kZWwuZ3JhcGgoZGF0YSwgZnVuY3Rpb24oZXJyLCBtb2RlbHMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICB2YXIgcmVzdWx0cyA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdHNbbW9kZWwubmFtZV0gPSBtb2RlbHM7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZG9uZShlcnIsIHJlc3VsdHMpO1xuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH0pKG1vZGVsLCBkYXRhW21vZGVsTmFtZV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIGVyciA9ICdObyBzdWNoIG1vZGVsIFwiJyArIG1vZGVsTmFtZSArICdcIic7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICghZXJyKSB1dGlsLmFzeW5jLnNlcmllcyh0YXNrcywgZnVuY3Rpb24oZXJyLCByZXN1bHRzKSB7XG4gICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgIHJlc3VsdHMgPSByZXN1bHRzLnJlZHVjZShmdW5jdGlvbihtZW1vLCByZXMpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIF8uZXh0ZW5kKG1lbW8sIHJlcyk7XG4gICAgICAgICAgICB9LCB7fSlcbiAgICAgICAgICB9IGVsc2UgcmVzdWx0cyA9IG51bGw7XG4gICAgICAgICAgY2IoZXJyLCByZXN1bHRzKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGVsc2UgY2IoZXJyb3IoZXJyLCB7ZGF0YTogZGF0YSwgaW52YWxpZE1vZGVsTmFtZTogbW9kZWxOYW1lfSkpO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9LFxuXG4gICAgcmVtb3ZlQWxsOiBmdW5jdGlvbihjYikge1xuICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgICAgdXRpbC5Qcm9taXNlLmFsbChcbiAgICAgICAgICBPYmplY3Qua2V5cyh0aGlzLl9tb2RlbHMpLm1hcChmdW5jdGlvbihtb2RlbE5hbWUpIHtcbiAgICAgICAgICAgIHZhciBtb2RlbCA9IHRoaXMuX21vZGVsc1ttb2RlbE5hbWVdO1xuICAgICAgICAgICAgcmV0dXJuIG1vZGVsLnJlbW92ZUFsbCgpO1xuICAgICAgICAgIH0uYmluZCh0aGlzKSlcbiAgICAgICAgKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgY2IobnVsbCk7XG4gICAgICAgICAgfSlcbiAgICAgICAgICAuY2F0Y2goY2IpXG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH1cbiAgfSk7XG5cblxuICBtb2R1bGUuZXhwb3J0cyA9IENvbGxlY3Rpb247XG59KSgpOyIsIi8qKlxuICogQG1vZHVsZSBjb2xsZWN0aW9uXG4gKi9cbihmdW5jdGlvbiAoKSB7XG4gICAgdmFyIF8gPSByZXF1aXJlKCcuL3V0aWwnKS5fO1xuXG4gICAgZnVuY3Rpb24gQ29sbGVjdGlvblJlZ2lzdHJ5KCkge1xuICAgICAgICBpZiAoIXRoaXMpIHJldHVybiBuZXcgQ29sbGVjdGlvblJlZ2lzdHJ5KCk7XG4gICAgICAgIHRoaXMuY29sbGVjdGlvbk5hbWVzID0gW107XG4gICAgfVxuXG4gICAgXy5leHRlbmQoQ29sbGVjdGlvblJlZ2lzdHJ5LnByb3RvdHlwZSwge1xuICAgICAgICByZWdpc3RlcjogZnVuY3Rpb24gKGNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgIHZhciBuYW1lID0gY29sbGVjdGlvbi5uYW1lO1xuICAgICAgICAgICAgdGhpc1tuYW1lXSA9IGNvbGxlY3Rpb247XG4gICAgICAgICAgICB0aGlzLmNvbGxlY3Rpb25OYW1lcy5wdXNoKG5hbWUpO1xuICAgICAgICB9LFxuICAgICAgICByZXNldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAgICAgXy5lYWNoKHRoaXMuY29sbGVjdGlvbk5hbWVzLCBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgICAgICAgICAgIGRlbGV0ZSBzZWxmW25hbWVdO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB0aGlzLmNvbGxlY3Rpb25OYW1lcyA9IFtdO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBleHBvcnRzLkNvbGxlY3Rpb25SZWdpc3RyeSA9IG5ldyBDb2xsZWN0aW9uUmVnaXN0cnkoKTtcbn0pKCk7IiwiLyoqXG4gKiBAbW9kdWxlIGVycm9yXG4gKi9cbihmdW5jdGlvbigpIHtcblxuICAvKipcbiAgICogVXNlcnMgc2hvdWxkIG5ldmVyIHNlZSB0aGVzZSB0aHJvd24uIEEgYnVnIHJlcG9ydCBzaG91bGQgYmUgZmlsZWQgaWYgc28gYXMgaXQgbWVhbnMgc29tZSBhc3NlcnRpb24gaGFzIGZhaWxlZC5cbiAgICogQHBhcmFtIG1lc3NhZ2VcbiAgICogQHBhcmFtIGNvbnRleHRcbiAgICogQHBhcmFtIHNzZlxuICAgKiBAY29uc3RydWN0b3JcbiAgICovXG4gIGZ1bmN0aW9uIEludGVybmFsU2llc3RhRXJyb3IobWVzc2FnZSwgY29udGV4dCwgc3NmKSB7XG4gICAgdGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcbiAgICB0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xuICAgIC8vIGNhcHR1cmUgc3RhY2sgdHJhY2VcbiAgICBpZiAoc3NmICYmIEVycm9yLmNhcHR1cmVTdGFja1RyYWNlKSB7XG4gICAgICBFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCBzc2YpO1xuICAgIH1cbiAgfVxuXG4gIEludGVybmFsU2llc3RhRXJyb3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShFcnJvci5wcm90b3R5cGUpO1xuICBJbnRlcm5hbFNpZXN0YUVycm9yLnByb3RvdHlwZS5uYW1lID0gJ0ludGVybmFsU2llc3RhRXJyb3InO1xuICBJbnRlcm5hbFNpZXN0YUVycm9yLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IEludGVybmFsU2llc3RhRXJyb3I7XG5cbiAgZnVuY3Rpb24gaXNTaWVzdGFFcnJvcihlcnIpIHtcbiAgICBpZiAodHlwZW9mIGVyciA9PSAnb2JqZWN0Jykge1xuICAgICAgcmV0dXJuICdlcnJvcicgaW4gZXJyICYmICdvaycgaW4gZXJyICYmICdyZWFzb24nIGluIGVycjtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihlcnJNZXNzYWdlLCBleHRyYSkge1xuICAgIGlmIChpc1NpZXN0YUVycm9yKGVyck1lc3NhZ2UpKSB7XG4gICAgICByZXR1cm4gZXJyTWVzc2FnZTtcbiAgICB9XG4gICAgdmFyIGVyciA9IHtcbiAgICAgIHJlYXNvbjogZXJyTWVzc2FnZSxcbiAgICAgIGVycm9yOiB0cnVlLFxuICAgICAgb2s6IGZhbHNlXG4gICAgfTtcbiAgICBmb3IgKHZhciBwcm9wIGluIGV4dHJhIHx8IHt9KSB7XG4gICAgICBpZiAoZXh0cmEuaGFzT3duUHJvcGVydHkocHJvcCkpIGVycltwcm9wXSA9IGV4dHJhW3Byb3BdO1xuICAgIH1cbiAgICBlcnIudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh0aGlzKTtcbiAgICB9O1xuICAgIHJldHVybiBlcnI7XG4gIH07XG5cbiAgbW9kdWxlLmV4cG9ydHMuSW50ZXJuYWxTaWVzdGFFcnJvciA9IEludGVybmFsU2llc3RhRXJyb3I7XG5cbn0pKCk7IiwiKGZ1bmN0aW9uKCkge1xuICB2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyLFxuICAgICAgQXJyYXlPYnNlcnZlciA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuQXJyYXlPYnNlcnZlcixcbiAgICAgIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICAgIGFyZ3NhcnJheSA9IHJlcXVpcmUoJ2FyZ3NhcnJheScpLFxuICAgICAgXyA9IHV0aWwuXyxcbiAgICAgIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICAgICAgQ2hhaW4gPSByZXF1aXJlKCcuL0NoYWluJyk7XG5cbiAgdmFyIGV2ZW50cyA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcbiAgZXZlbnRzLnNldE1heExpc3RlbmVycygxMDApO1xuXG4gIC8qKlxuICAgKiBMaXN0ZW4gdG8gYSBwYXJ0aWN1bGFyIGV2ZW50IGZyb20gdGhlIFNpZXN0YSBnbG9iYWwgRXZlbnRFbWl0dGVyLlxuICAgKiBNYW5hZ2VzIGl0cyBvd24gc2V0IG9mIGxpc3RlbmVycy5cbiAgICogQGNvbnN0cnVjdG9yXG4gICAqL1xuICBmdW5jdGlvbiBQcm94eUV2ZW50RW1pdHRlcihldmVudCwgY2hhaW5PcHRzKSB7XG4gICAgXy5leHRlbmQodGhpcywge1xuICAgICAgZXZlbnQ6IGV2ZW50LFxuICAgICAgbGlzdGVuZXJzOiB7fVxuICAgIH0pO1xuICAgIHZhciBkZWZhdWx0Q2hhaW5PcHRzID0ge307XG5cbiAgICBkZWZhdWx0Q2hhaW5PcHRzLm9uID0gdGhpcy5vbi5iaW5kKHRoaXMpO1xuICAgIGRlZmF1bHRDaGFpbk9wdHMub25jZSA9IHRoaXMub25jZS5iaW5kKHRoaXMpO1xuXG4gICAgQ2hhaW4uY2FsbCh0aGlzLCBfLmV4dGVuZChkZWZhdWx0Q2hhaW5PcHRzLCBjaGFpbk9wdHMgfHwge30pKTtcbiAgfVxuXG4gIFByb3h5RXZlbnRFbWl0dGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoQ2hhaW4ucHJvdG90eXBlKTtcblxuICBfLmV4dGVuZChQcm94eUV2ZW50RW1pdHRlci5wcm90b3R5cGUsIHtcbiAgICBvbjogZnVuY3Rpb24odHlwZSwgZm4pIHtcbiAgICAgIGlmICh0eXBlb2YgdHlwZSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGZuID0gdHlwZTtcbiAgICAgICAgdHlwZSA9IG51bGw7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgaWYgKHR5cGUudHJpbSgpID09ICcqJykgdHlwZSA9IG51bGw7XG4gICAgICAgIHZhciBfZm4gPSBmbjtcbiAgICAgICAgZm4gPSBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgZSA9IGUgfHwge307XG4gICAgICAgICAgaWYgKHR5cGUpIHtcbiAgICAgICAgICAgIGlmIChlLnR5cGUgPT0gdHlwZSkge1xuICAgICAgICAgICAgICBfZm4oZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgX2ZuKGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdmFyIGxpc3RlbmVycyA9IHRoaXMubGlzdGVuZXJzO1xuICAgICAgICBpZiAodHlwZSkge1xuICAgICAgICAgIGlmICghbGlzdGVuZXJzW3R5cGVdKSBsaXN0ZW5lcnNbdHlwZV0gPSBbXTtcbiAgICAgICAgICBsaXN0ZW5lcnNbdHlwZV0ucHVzaChmbik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGV2ZW50cy5vbih0aGlzLmV2ZW50LCBmbik7XG4gICAgICByZXR1cm4gdGhpcy5faGFuZGxlckxpbmsoe1xuICAgICAgICBmbjogZm4sXG4gICAgICAgIHR5cGU6IHR5cGUsXG4gICAgICAgIGV4dGVuZDogdGhpcy5wcm94eUNoYWluT3B0c1xuICAgICAgfSk7XG4gICAgfSxcbiAgICBvbmNlOiBmdW5jdGlvbih0eXBlLCBmbikge1xuICAgICAgdmFyIGV2ZW50ID0gdGhpcy5ldmVudDtcbiAgICAgIGlmICh0eXBlb2YgdHlwZSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGZuID0gdHlwZTtcbiAgICAgICAgdHlwZSA9IG51bGw7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgaWYgKHR5cGUudHJpbSgpID09ICcqJykgdHlwZSA9IG51bGw7XG4gICAgICAgIHZhciBfZm4gPSBmbjtcbiAgICAgICAgZm4gPSBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgZSA9IGUgfHwge307XG4gICAgICAgICAgaWYgKHR5cGUpIHtcbiAgICAgICAgICAgIGlmIChlLnR5cGUgPT0gdHlwZSkge1xuICAgICAgICAgICAgICBldmVudHMucmVtb3ZlTGlzdGVuZXIoZXZlbnQsIGZuKTtcbiAgICAgICAgICAgICAgX2ZuKGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIF9mbihlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICh0eXBlKSByZXR1cm4gZXZlbnRzLm9uKGV2ZW50LCBmbik7XG4gICAgICBlbHNlIHJldHVybiBldmVudHMub25jZShldmVudCwgZm4pO1xuICAgIH0sXG4gICAgX3JlbW92ZUxpc3RlbmVyOiBmdW5jdGlvbihmbiwgdHlwZSkge1xuICAgICAgaWYgKHR5cGUpIHtcbiAgICAgICAgdmFyIGxpc3RlbmVycyA9IHRoaXMubGlzdGVuZXJzW3R5cGVdLFxuICAgICAgICAgICAgaWR4ID0gbGlzdGVuZXJzLmluZGV4T2YoZm4pO1xuICAgICAgICBsaXN0ZW5lcnMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gZXZlbnRzLnJlbW92ZUxpc3RlbmVyKHRoaXMuZXZlbnQsIGZuKTtcbiAgICB9LFxuICAgIGVtaXQ6IGZ1bmN0aW9uKHR5cGUsIHBheWxvYWQpIHtcbiAgICAgIGlmICh0eXBlb2YgdHlwZSA9PSAnb2JqZWN0Jykge1xuICAgICAgICBwYXlsb2FkID0gdHlwZTtcbiAgICAgICAgdHlwZSA9IG51bGw7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgcGF5bG9hZCA9IHBheWxvYWQgfHwge307XG4gICAgICAgIHBheWxvYWQudHlwZSA9IHR5cGU7XG4gICAgICB9XG4gICAgICBldmVudHMuZW1pdC5jYWxsKGV2ZW50cywgdGhpcy5ldmVudCwgcGF5bG9hZCk7XG4gICAgfSxcbiAgICBfcmVtb3ZlQWxsTGlzdGVuZXJzOiBmdW5jdGlvbih0eXBlKSB7XG4gICAgICAodGhpcy5saXN0ZW5lcnNbdHlwZV0gfHwgW10pLmZvckVhY2goZnVuY3Rpb24oZm4pIHtcbiAgICAgICAgZXZlbnRzLnJlbW92ZUxpc3RlbmVyKHRoaXMuZXZlbnQsIGZuKTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICB0aGlzLmxpc3RlbmVyc1t0eXBlXSA9IFtdO1xuICAgIH0sXG4gICAgcmVtb3ZlQWxsTGlzdGVuZXJzOiBmdW5jdGlvbih0eXBlKSB7XG4gICAgICBpZiAodHlwZSkge1xuICAgICAgICB0aGlzLl9yZW1vdmVBbGxMaXN0ZW5lcnModHlwZSk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgZm9yICh0eXBlIGluIHRoaXMubGlzdGVuZXJzKSB7XG4gICAgICAgICAgaWYgKHRoaXMubGlzdGVuZXJzLmhhc093blByb3BlcnR5KHR5cGUpKSB7XG4gICAgICAgICAgICB0aGlzLl9yZW1vdmVBbGxMaXN0ZW5lcnModHlwZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICBfLmV4dGVuZChldmVudHMsIHtcbiAgICBQcm94eUV2ZW50RW1pdHRlcjogUHJveHlFdmVudEVtaXR0ZXIsXG4gICAgd3JhcEFycmF5OiBmdW5jdGlvbihhcnJheSwgZmllbGQsIG1vZGVsSW5zdGFuY2UpIHtcbiAgICAgIGlmICghYXJyYXkub2JzZXJ2ZXIpIHtcbiAgICAgICAgYXJyYXkub2JzZXJ2ZXIgPSBuZXcgQXJyYXlPYnNlcnZlcihhcnJheSk7XG4gICAgICAgIGFycmF5Lm9ic2VydmVyLm9wZW4oZnVuY3Rpb24oc3BsaWNlcykge1xuICAgICAgICAgIHZhciBmaWVsZElzQXR0cmlidXRlID0gbW9kZWxJbnN0YW5jZS5fYXR0cmlidXRlTmFtZXMuaW5kZXhPZihmaWVsZCkgPiAtMTtcbiAgICAgICAgICBpZiAoZmllbGRJc0F0dHJpYnV0ZSkge1xuICAgICAgICAgICAgc3BsaWNlcy5mb3JFYWNoKGZ1bmN0aW9uKHNwbGljZSkge1xuICAgICAgICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBtb2RlbEluc3RhbmNlLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgICAgIG1vZGVsOiBtb2RlbEluc3RhbmNlLm1vZGVsLm5hbWUsXG4gICAgICAgICAgICAgICAgbG9jYWxJZDogbW9kZWxJbnN0YW5jZS5sb2NhbElkLFxuICAgICAgICAgICAgICAgIGluZGV4OiBzcGxpY2UuaW5kZXgsXG4gICAgICAgICAgICAgICAgcmVtb3ZlZDogc3BsaWNlLnJlbW92ZWQsXG4gICAgICAgICAgICAgICAgYWRkZWQ6IHNwbGljZS5hZGRlZENvdW50ID8gYXJyYXkuc2xpY2Uoc3BsaWNlLmluZGV4LCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCkgOiBbXSxcbiAgICAgICAgICAgICAgICB0eXBlOiBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgICAgICAgICAgICAgZmllbGQ6IGZpZWxkLFxuICAgICAgICAgICAgICAgIG9iajogbW9kZWxJbnN0YW5jZVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICBtb2R1bGUuZXhwb3J0cyA9IGV2ZW50cztcbn0pKCk7IiwiKGZ1bmN0aW9uKCkge1xuICB2YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIENvbGxlY3Rpb25SZWdpc3RyeSA9IHJlcXVpcmUoJy4vY29sbGVjdGlvblJlZ2lzdHJ5JykuQ29sbGVjdGlvblJlZ2lzdHJ5LFxuICAgIENvbGxlY3Rpb24gPSByZXF1aXJlKCcuL2NvbGxlY3Rpb24nKSxcbiAgICBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKSxcbiAgICBNb2RlbCA9IHJlcXVpcmUoJy4vbW9kZWwnKSxcbiAgICBlcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKSxcbiAgICBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICAgIFJlbGF0aW9uc2hpcFR5cGUgPSByZXF1aXJlKCcuL1JlbGF0aW9uc2hpcFR5cGUnKSxcbiAgICBSZWFjdGl2ZVF1ZXJ5ID0gcmVxdWlyZSgnLi9SZWFjdGl2ZVF1ZXJ5JyksXG4gICAgTWFueVRvTWFueVByb3h5ID0gcmVxdWlyZSgnLi9NYW55VG9NYW55UHJveHknKSxcbiAgICBPbmVUb09uZVByb3h5ID0gcmVxdWlyZSgnLi9PbmVUb09uZVByb3h5JyksXG4gICAgT25lVG9NYW55UHJveHkgPSByZXF1aXJlKCcuL09uZVRvTWFueVByb3h5JyksXG4gICAgUmVsYXRpb25zaGlwUHJveHkgPSByZXF1aXJlKCcuL1JlbGF0aW9uc2hpcFByb3h5JyksXG4gICAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gICAgUXVlcnkgPSByZXF1aXJlKCcuL1F1ZXJ5JyksXG4gICAgcXVlcnlTZXQgPSByZXF1aXJlKCcuL1F1ZXJ5U2V0JyksXG4gICAgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSxcbiAgICBfID0gdXRpbC5fO1xuICB1dGlsLl9wYXRjaEJpbmQoKTtcblxuICAvLyBJbml0aWFsaXNlIHNpZXN0YSBvYmplY3QuIFN0cmFuZ2UgZm9ybWF0IGZhY2lsaXRpZXMgdXNpbmcgc3VibW9kdWxlcyB3aXRoIHJlcXVpcmVKUyAoZXZlbnR1YWxseSlcbiAgdmFyIHNpZXN0YSA9IGZ1bmN0aW9uKGV4dCkge1xuICAgIGlmICghc2llc3RhLmV4dCkgc2llc3RhLmV4dCA9IHt9O1xuICAgIF8uZXh0ZW5kKHNpZXN0YS5leHQsIGV4dCB8fCB7fSk7XG4gICAgcmV0dXJuIHNpZXN0YTtcbiAgfTtcblxuICAvLyBOb3RpZmljYXRpb25zXG4gIF8uZXh0ZW5kKHNpZXN0YSwge1xuICAgIG9uOiBldmVudHMub24uYmluZChldmVudHMpLFxuICAgIG9mZjogZXZlbnRzLnJlbW92ZUxpc3RlbmVyLmJpbmQoZXZlbnRzKSxcbiAgICBvbmNlOiBldmVudHMub25jZS5iaW5kKGV2ZW50cyksXG4gICAgcmVtb3ZlQWxsTGlzdGVuZXJzOiBldmVudHMucmVtb3ZlQWxsTGlzdGVuZXJzLmJpbmQoZXZlbnRzKVxuICB9KTtcbiAgXy5leHRlbmQoc2llc3RhLCB7XG4gICAgcmVtb3ZlTGlzdGVuZXI6IHNpZXN0YS5vZmYsXG4gICAgYWRkTGlzdGVuZXI6IHNpZXN0YS5vblxuICB9KTtcblxuICAvLyBFeHBvc2Ugc29tZSBzdHVmZiBmb3IgdXNhZ2UgYnkgZXh0ZW5zaW9ucyBhbmQvb3IgdXNlcnNcbiAgXy5leHRlbmQoc2llc3RhLCB7XG4gICAgUmVsYXRpb25zaGlwVHlwZTogUmVsYXRpb25zaGlwVHlwZSxcbiAgICBNb2RlbEV2ZW50VHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUsXG4gICAgbG9nOiBsb2cuTGV2ZWwsXG4gICAgSW5zZXJ0aW9uUG9saWN5OiBSZWFjdGl2ZVF1ZXJ5Lkluc2VydGlvblBvbGljeSxcbiAgICBfaW50ZXJuYWw6IHtcbiAgICAgIGxvZzogbG9nLFxuICAgICAgTW9kZWw6IE1vZGVsLFxuICAgICAgZXJyb3I6IGVycm9yLFxuICAgICAgTW9kZWxFdmVudFR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLFxuICAgICAgTW9kZWxJbnN0YW5jZTogcmVxdWlyZSgnLi9Nb2RlbEluc3RhbmNlJyksXG4gICAgICBleHRlbmQ6IHJlcXVpcmUoJ2V4dGVuZCcpLFxuICAgICAgTWFwcGluZ09wZXJhdGlvbjogcmVxdWlyZSgnLi9tYXBwaW5nT3BlcmF0aW9uJyksXG4gICAgICBldmVudHM6IGV2ZW50cyxcbiAgICAgIFByb3h5RXZlbnRFbWl0dGVyOiBldmVudHMuUHJveHlFdmVudEVtaXR0ZXIsXG4gICAgICBjYWNoZTogcmVxdWlyZSgnLi9jYWNoZScpLFxuICAgICAgbW9kZWxFdmVudHM6IG1vZGVsRXZlbnRzLFxuICAgICAgQ29sbGVjdGlvblJlZ2lzdHJ5OiByZXF1aXJlKCcuL2NvbGxlY3Rpb25SZWdpc3RyeScpLkNvbGxlY3Rpb25SZWdpc3RyeSxcbiAgICAgIENvbGxlY3Rpb246IENvbGxlY3Rpb24sXG4gICAgICB1dGlsczogdXRpbCxcbiAgICAgIHV0aWw6IHV0aWwsXG4gICAgICBfOiB1dGlsLl8sXG4gICAgICBxdWVyeVNldDogcXVlcnlTZXQsXG4gICAgICBvYnNlcnZlOiByZXF1aXJlKCcuLi92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZScpLFxuICAgICAgUXVlcnk6IFF1ZXJ5LFxuICAgICAgU3RvcmU6IHJlcXVpcmUoJy4vc3RvcmUnKSxcbiAgICAgIE1hbnlUb01hbnlQcm94eTogTWFueVRvTWFueVByb3h5LFxuICAgICAgT25lVG9NYW55UHJveHk6IE9uZVRvTWFueVByb3h5LFxuICAgICAgT25lVG9PbmVQcm94eTogT25lVG9PbmVQcm94eSxcbiAgICAgIFJlbGF0aW9uc2hpcFByb3h5OiBSZWxhdGlvbnNoaXBQcm94eVxuICAgIH0sXG4gICAgXzogdXRpbC5fLFxuICAgIGFzeW5jOiB1dGlsLmFzeW5jLFxuICAgIGlzQXJyYXk6IHV0aWwuaXNBcnJheSxcbiAgICBpc1N0cmluZzogdXRpbC5pc1N0cmluZ1xuICB9KTtcblxuICBzaWVzdGEuZXh0ID0ge307XG5cbiAgdmFyIGluc3RhbGxlZCA9IGZhbHNlLFxuICAgIGluc3RhbGxpbmcgPSBmYWxzZTtcblxuXG4gIF8uZXh0ZW5kKHNpZXN0YSwge1xuICAgIC8qKlxuICAgICAqIFdpcGUgZXZlcnl0aGluZy4gVXNlZCBkdXJpbmcgdGVzdCBnZW5lcmFsbHkuXG4gICAgICovXG4gICAgcmVzZXQ6IGZ1bmN0aW9uKGNiLCByZXNldFN0b3JhZ2UpIHtcbiAgICAgIGluc3RhbGxlZCA9IGZhbHNlO1xuICAgICAgaW5zdGFsbGluZyA9IGZhbHNlO1xuICAgICAgZGVsZXRlIHRoaXMucXVldWVkVGFza3M7XG4gICAgICBjYWNoZS5yZXNldCgpO1xuICAgICAgQ29sbGVjdGlvblJlZ2lzdHJ5LnJlc2V0KCk7XG4gICAgICBldmVudHMucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XG4gICAgICBpZiAoc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCkge1xuICAgICAgICByZXNldFN0b3JhZ2UgPSByZXNldFN0b3JhZ2UgPT09IHVuZGVmaW5lZCA/IHRydWUgOiByZXNldFN0b3JhZ2U7XG4gICAgICAgIGlmIChyZXNldFN0b3JhZ2UpIHNpZXN0YS5leHQuc3RvcmFnZS5fcmVzZXQoY2IpO1xuICAgICAgICBlbHNlIGNiKCk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY2IoKTtcbiAgICAgIH1cbiAgICB9LFxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYW5kIHJlZ2lzdGVycyBhIG5ldyBDb2xsZWN0aW9uLlxuICAgICAqIEBwYXJhbSAge1N0cmluZ30gbmFtZVxuICAgICAqIEBwYXJhbSAge09iamVjdH0gW29wdHNdXG4gICAgICogQHJldHVybiB7Q29sbGVjdGlvbn1cbiAgICAgKi9cbiAgICBjb2xsZWN0aW9uOiBmdW5jdGlvbihuYW1lLCBvcHRzKSB7XG4gICAgICByZXR1cm4gbmV3IENvbGxlY3Rpb24obmFtZSwgb3B0cyk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBJbnN0YWxsIGFsbCBjb2xsZWN0aW9ucy5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2JdXG4gICAgICogQHJldHVybnMge3EuUHJvbWlzZX1cbiAgICAgKi9cbiAgICBpbnN0YWxsOiBmdW5jdGlvbihjYikge1xuICAgICAgaWYgKCFpbnN0YWxsaW5nICYmICFpbnN0YWxsZWQpIHtcbiAgICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgICAgICBpbnN0YWxsaW5nID0gdHJ1ZTtcbiAgICAgICAgICB2YXIgY29sbGVjdGlvbk5hbWVzID0gQ29sbGVjdGlvblJlZ2lzdHJ5LmNvbGxlY3Rpb25OYW1lcyxcbiAgICAgICAgICAgIHRhc2tzID0gXy5tYXAoY29sbGVjdGlvbk5hbWVzLCBmdW5jdGlvbihuKSB7XG4gICAgICAgICAgICAgIHJldHVybiBDb2xsZWN0aW9uUmVnaXN0cnlbbl0uaW5zdGFsbC5iaW5kKENvbGxlY3Rpb25SZWdpc3RyeVtuXSk7XG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIHN0b3JhZ2VFbmFibGVkID0gc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZDtcbiAgICAgICAgICBpZiAoc3RvcmFnZUVuYWJsZWQpIHRhc2tzID0gdGFza3MuY29uY2F0KFtzaWVzdGEuZXh0LnN0b3JhZ2UuZW5zdXJlSW5kZXhlc0ZvckFsbCwgc2llc3RhLmV4dC5zdG9yYWdlLl9sb2FkXSk7XG4gICAgICAgICAgdGFza3MucHVzaChmdW5jdGlvbihkb25lKSB7XG4gICAgICAgICAgICBpbnN0YWxsZWQgPSB0cnVlO1xuICAgICAgICAgICAgaWYgKHRoaXMucXVldWVkVGFza3MpIHRoaXMucXVldWVkVGFza3MuZXhlY3V0ZSgpO1xuICAgICAgICAgICAgZG9uZSgpO1xuICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICAgICAgICBzaWVzdGEuYXN5bmMuc2VyaWVzKHRhc2tzLCBjYik7XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICB9XG4gICAgICBlbHNlIGNiKGVycm9yKCdhbHJlYWR5IGluc3RhbGxpbmcnKSk7XG4gICAgfSxcbiAgICBfcHVzaFRhc2s6IGZ1bmN0aW9uKHRhc2spIHtcbiAgICAgIGlmICghdGhpcy5xdWV1ZWRUYXNrcykge1xuICAgICAgICB0aGlzLnF1ZXVlZFRhc2tzID0gbmV3IGZ1bmN0aW9uIFF1ZXVlKCkge1xuICAgICAgICAgIHRoaXMudGFza3MgPSBbXTtcbiAgICAgICAgICB0aGlzLmV4ZWN1dGUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHRoaXMudGFza3MuZm9yRWFjaChmdW5jdGlvbihmKSB7XG4gICAgICAgICAgICAgIGYoKVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB0aGlzLnRhc2tzID0gW107XG4gICAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgdGhpcy5xdWV1ZWRUYXNrcy50YXNrcy5wdXNoKHRhc2spO1xuICAgIH0sXG4gICAgX2FmdGVySW5zdGFsbDogZnVuY3Rpb24odGFzaykge1xuICAgICAgaWYgKCFpbnN0YWxsZWQpIHtcbiAgICAgICAgaWYgKCFpbnN0YWxsaW5nKSB7XG4gICAgICAgICAgdGhpcy5pbnN0YWxsKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBzZXR0aW5nIHVwIHNpZXN0YScsIGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5xdWV1ZWRUYXNrcztcbiAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgICAgIC8vIEluIGNhc2UgaW5zdGFsbGVkIHN0cmFpZ2h0IGF3YXkgZS5nLiBpZiBzdG9yYWdlIGV4dGVuc2lvbiBub3QgaW5zdGFsbGVkLlxuICAgICAgICBpZiAoIWluc3RhbGxlZCkgdGhpcy5fcHVzaFRhc2sodGFzayk7XG4gICAgICAgIGVsc2UgdGFzaygpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHRhc2soKTtcbiAgICAgIH1cbiAgICB9LFxuICAgIHNldExvZ0xldmVsOiBmdW5jdGlvbihsb2dnZXJOYW1lLCBsZXZlbCkge1xuICAgICAgdmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZShsb2dnZXJOYW1lKTtcbiAgICAgIExvZ2dlci5zZXRMZXZlbChsZXZlbCk7XG4gICAgfSxcbiAgICBncmFwaDogZnVuY3Rpb24oZGF0YSwgb3B0cywgY2IpIHtcbiAgICAgIGlmICh0eXBlb2Ygb3B0cyA9PSAnZnVuY3Rpb24nKSBjYiA9IG9wdHM7XG4gICAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICAgIHZhciB0YXNrcyA9IFtdLCBlcnI7XG4gICAgICAgIGZvciAodmFyIGNvbGxlY3Rpb25OYW1lIGluIGRhdGEpIHtcbiAgICAgICAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eShjb2xsZWN0aW9uTmFtZSkpIHtcbiAgICAgICAgICAgIHZhciBjb2xsZWN0aW9uID0gQ29sbGVjdGlvblJlZ2lzdHJ5W2NvbGxlY3Rpb25OYW1lXTtcbiAgICAgICAgICAgIGlmIChjb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICAgIChmdW5jdGlvbihjb2xsZWN0aW9uLCBkYXRhKSB7XG4gICAgICAgICAgICAgICAgdGFza3MucHVzaChmdW5jdGlvbihkb25lKSB7XG4gICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uLmdyYXBoKGRhdGEsIGZ1bmN0aW9uKGVyciwgcmVzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgdmFyIHJlc3VsdHMgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICByZXN1bHRzW2NvbGxlY3Rpb24ubmFtZV0gPSByZXM7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZG9uZShlcnIsIHJlc3VsdHMpO1xuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH0pKGNvbGxlY3Rpb24sIGRhdGFbY29sbGVjdGlvbk5hbWVdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICBlcnIgPSAnTm8gc3VjaCBjb2xsZWN0aW9uIFwiJyArIGNvbGxlY3Rpb25OYW1lICsgJ1wiJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFlcnIpIHV0aWwuYXN5bmMuc2VyaWVzKHRhc2tzLCBmdW5jdGlvbihlcnIsIHJlc3VsdHMpIHtcbiAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgcmVzdWx0cyA9IHJlc3VsdHMucmVkdWNlKGZ1bmN0aW9uKG1lbW8sIHJlcykge1xuICAgICAgICAgICAgICByZXR1cm4gXy5leHRlbmQobWVtbywgcmVzKTtcbiAgICAgICAgICAgIH0sIHt9KVxuICAgICAgICAgIH0gZWxzZSByZXN1bHRzID0gbnVsbDtcbiAgICAgICAgICBjYihlcnIsIHJlc3VsdHMpO1xuICAgICAgICB9KTtcbiAgICAgICAgZWxzZSBjYihlcnJvcihlcnIsIHtkYXRhOiBkYXRhLCBpbnZhbGlkQ29sbGVjdGlvbk5hbWU6IGNvbGxlY3Rpb25OYW1lfSkpO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9LFxuICAgIG5vdGlmeTogdXRpbC5uZXh0LFxuICAgIHJlZ2lzdGVyQ29tcGFyYXRvcjogUXVlcnkucmVnaXN0ZXJDb21wYXJhdG9yLmJpbmQoUXVlcnkpLFxuICAgIGNvdW50OiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBjYWNoZS5jb3VudCgpO1xuICAgIH0sXG4gICAgZ2V0OiBmdW5jdGlvbihpZCwgY2IpIHtcbiAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICAgIHRoaXMuX2FmdGVySW5zdGFsbChmdW5jdGlvbigpIHtcbiAgICAgICAgICBjYihudWxsLCBjYWNoZS5fbG9jYWxDYWNoZSgpW2lkXSk7XG4gICAgICAgIH0pO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9LFxuICAgIHJlbW92ZUFsbDogZnVuY3Rpb24oY2IpIHtcbiAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICAgIHV0aWwuUHJvbWlzZS5hbGwoXG4gICAgICAgICAgQ29sbGVjdGlvblJlZ2lzdHJ5LmNvbGxlY3Rpb25OYW1lcy5tYXAoZnVuY3Rpb24oY29sbGVjdGlvbk5hbWUpIHtcbiAgICAgICAgICAgIHJldHVybiBDb2xsZWN0aW9uUmVnaXN0cnlbY29sbGVjdGlvbk5hbWVdLnJlbW92ZUFsbCgpO1xuICAgICAgICAgIH0uYmluZCh0aGlzKSlcbiAgICAgICAgKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgY2IobnVsbCk7XG4gICAgICAgICAgfSkuY2F0Y2goY2IpXG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH1cbiAgfSk7XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoc2llc3RhLCB7XG4gICAgX2NhbkNoYW5nZToge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuICEoaW5zdGFsbGluZyB8fCBpbnN0YWxsZWQpO1xuICAgICAgfVxuICAgIH1cbiAgfSk7XG5cbiAgaWYgKHR5cGVvZiB3aW5kb3cgIT0gJ3VuZGVmaW5lZCcpIHtcbiAgICB3aW5kb3dbJ3NpZXN0YSddID0gc2llc3RhO1xuICB9XG5cbiAgc2llc3RhLmxvZyA9IHJlcXVpcmUoJ2RlYnVnJyk7XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBzaWVzdGE7XG5cbiAgKGZ1bmN0aW9uIGxvYWRFeHRlbnNpb25zKCkge1xuICAgIHJlcXVpcmUoJy4uL3N0b3JhZ2UnKTtcbiAgfSkoKTtcblxufSkoKTsiLCIoZnVuY3Rpb24oKSB7XG4gIHZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpKCdtb2RlbCcpLFxuICAgIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgICBSZWxhdGlvbnNoaXBUeXBlID0gcmVxdWlyZSgnLi9SZWxhdGlvbnNoaXBUeXBlJyksXG4gICAgUXVlcnkgPSByZXF1aXJlKCcuL1F1ZXJ5JyksXG4gICAgTW9kZWxJbnN0YW5jZSA9IHJlcXVpcmUoJy4vTW9kZWxJbnN0YW5jZScpLFxuICAgIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICBfID0gdXRpbC5fLFxuICAgIGd1aWQgPSB1dGlsLmd1aWQsXG4gICAgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyksXG4gICAgc3RvcmUgPSByZXF1aXJlKCcuL3N0b3JlJyksXG4gICAgZXh0ZW5kID0gcmVxdWlyZSgnZXh0ZW5kJyksXG4gICAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gICAgd3JhcEFycmF5ID0gcmVxdWlyZSgnLi9ldmVudHMnKS53cmFwQXJyYXksXG4gICAgT25lVG9NYW55UHJveHkgPSByZXF1aXJlKCcuL09uZVRvTWFueVByb3h5JyksXG4gICAgT25lVG9PbmVQcm94eSA9IHJlcXVpcmUoJy4vT25lVG9PbmVQcm94eScpLFxuICAgIE1hbnlUb01hbnlQcm94eSA9IHJlcXVpcmUoJy4vTWFueVRvTWFueVByb3h5JyksXG4gICAgUmVhY3RpdmVRdWVyeSA9IHJlcXVpcmUoJy4vUmVhY3RpdmVRdWVyeScpLFxuICAgIEFycmFuZ2VkUmVhY3RpdmVRdWVyeSA9IHJlcXVpcmUoJy4vQXJyYW5nZWRSZWFjdGl2ZVF1ZXJ5JyksXG4gICAgTW9kZWxFdmVudFR5cGUgPSBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZTtcblxuICBmdW5jdGlvbiBNb2RlbEluc3RhbmNlRmFjdG9yeShtb2RlbCkge1xuICAgIHRoaXMubW9kZWwgPSBtb2RlbDtcbiAgfVxuXG4gIE1vZGVsSW5zdGFuY2VGYWN0b3J5LnByb3RvdHlwZSA9IHtcbiAgICBfZ2V0TG9jYWxJZDogZnVuY3Rpb24oZGF0YSkge1xuICAgICAgdmFyIGxvY2FsSWQ7XG4gICAgICBpZiAoZGF0YSkge1xuICAgICAgICBsb2NhbElkID0gZGF0YS5sb2NhbElkID8gZGF0YS5sb2NhbElkIDogZ3VpZCgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbG9jYWxJZCA9IGd1aWQoKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBsb2NhbElkO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogQ29uZmlndXJlIGF0dHJpYnV0ZXNcbiAgICAgKiBAcGFyYW0gbW9kZWxJbnN0YW5jZVxuICAgICAqIEBwYXJhbSBkYXRhXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cblxuICAgIF9pbnN0YWxsQXR0cmlidXRlczogZnVuY3Rpb24obW9kZWxJbnN0YW5jZSwgZGF0YSkge1xuICAgICAgdmFyIE1vZGVsID0gdGhpcy5tb2RlbCxcbiAgICAgICAgYXR0cmlidXRlTmFtZXMgPSBNb2RlbC5fYXR0cmlidXRlTmFtZXMsXG4gICAgICAgIGlkeCA9IGF0dHJpYnV0ZU5hbWVzLmluZGV4T2YoTW9kZWwuaWQpO1xuICAgICAgXy5leHRlbmQobW9kZWxJbnN0YW5jZSwge1xuICAgICAgICBfX3ZhbHVlczogXy5leHRlbmQoXy5yZWR1Y2UoTW9kZWwuYXR0cmlidXRlcywgZnVuY3Rpb24obSwgYSkge1xuICAgICAgICAgIGlmIChhLmRlZmF1bHQgIT09IHVuZGVmaW5lZCkgbVthLm5hbWVdID0gYS5kZWZhdWx0O1xuICAgICAgICAgIHJldHVybiBtO1xuICAgICAgICB9LCB7fSksIGRhdGEgfHwge30pXG4gICAgICB9KTtcbiAgICAgIGlmIChpZHggPiAtMSkgYXR0cmlidXRlTmFtZXMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICBfLmVhY2goYXR0cmlidXRlTmFtZXMsIGZ1bmN0aW9uKGF0dHJpYnV0ZU5hbWUpIHtcbiAgICAgICAgdmFyIGF0dHJpYnV0ZURlZmluaXRpb24gPSBNb2RlbC5fYXR0cmlidXRlRGVmaW5pdGlvbldpdGhOYW1lKGF0dHJpYnV0ZU5hbWUpO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobW9kZWxJbnN0YW5jZSwgYXR0cmlidXRlTmFtZSwge1xuICAgICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB2YXIgdmFsdWUgPSBtb2RlbEluc3RhbmNlLl9fdmFsdWVzW2F0dHJpYnV0ZU5hbWVdO1xuICAgICAgICAgICAgcmV0dXJuIHZhbHVlID09PSB1bmRlZmluZWQgPyBudWxsIDogdmFsdWU7XG4gICAgICAgICAgfSxcbiAgICAgICAgICBzZXQ6IGZ1bmN0aW9uKHYpIHtcbiAgICAgICAgICAgIGlmIChhdHRyaWJ1dGVEZWZpbml0aW9uLnBhcnNlKSB7XG4gICAgICAgICAgICAgIHYgPSBhdHRyaWJ1dGVEZWZpbml0aW9uLnBhcnNlLmNhbGwobW9kZWxJbnN0YW5jZSwgdik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoTW9kZWwucGFyc2VBdHRyaWJ1dGUpIHtcbiAgICAgICAgICAgICAgdiA9IE1vZGVsLnBhcnNlQXR0cmlidXRlLmNhbGwobW9kZWxJbnN0YW5jZSwgYXR0cmlidXRlTmFtZSwgdik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgb2xkID0gbW9kZWxJbnN0YW5jZS5fX3ZhbHVlc1thdHRyaWJ1dGVOYW1lXTtcbiAgICAgICAgICAgIHZhciBwcm9wZXJ0eURlcGVuZGVuY2llcyA9IHRoaXMuX3Byb3BlcnR5RGVwZW5kZW5jaWVzW2F0dHJpYnV0ZU5hbWVdO1xuICAgICAgICAgICAgcHJvcGVydHlEZXBlbmRlbmNpZXMgPSBfLm1hcChwcm9wZXJ0eURlcGVuZGVuY2llcywgZnVuY3Rpb24oZGVwZW5kYW50KSB7XG4gICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgcHJvcDogZGVwZW5kYW50LFxuICAgICAgICAgICAgICAgIG9sZDogdGhpc1tkZXBlbmRhbnRdXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICAgICAgICAgIG1vZGVsSW5zdGFuY2UuX192YWx1ZXNbYXR0cmlidXRlTmFtZV0gPSB2O1xuICAgICAgICAgICAgcHJvcGVydHlEZXBlbmRlbmNpZXMuZm9yRWFjaChmdW5jdGlvbihkZXApIHtcbiAgICAgICAgICAgICAgdmFyIHByb3BlcnR5TmFtZSA9IGRlcC5wcm9wO1xuICAgICAgICAgICAgICB2YXIgbmV3XyA9IHRoaXNbcHJvcGVydHlOYW1lXTtcbiAgICAgICAgICAgICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgICAgICAgICAgICAgY29sbGVjdGlvbjogTW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgICAgbW9kZWw6IE1vZGVsLm5hbWUsXG4gICAgICAgICAgICAgICAgbG9jYWxJZDogbW9kZWxJbnN0YW5jZS5sb2NhbElkLFxuICAgICAgICAgICAgICAgIG5ldzogbmV3XyxcbiAgICAgICAgICAgICAgICBvbGQ6IGRlcC5vbGQsXG4gICAgICAgICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU2V0LFxuICAgICAgICAgICAgICAgIGZpZWxkOiBwcm9wZXJ0eU5hbWUsXG4gICAgICAgICAgICAgICAgb2JqOiBtb2RlbEluc3RhbmNlXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgIHZhciBlID0ge1xuICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBNb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgbW9kZWw6IE1vZGVsLm5hbWUsXG4gICAgICAgICAgICAgIGxvY2FsSWQ6IG1vZGVsSW5zdGFuY2UubG9jYWxJZCxcbiAgICAgICAgICAgICAgbmV3OiB2LFxuICAgICAgICAgICAgICBvbGQ6IG9sZCxcbiAgICAgICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU2V0LFxuICAgICAgICAgICAgICBmaWVsZDogYXR0cmlidXRlTmFtZSxcbiAgICAgICAgICAgICAgb2JqOiBtb2RlbEluc3RhbmNlXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgd2luZG93Lmxhc3RFbWlzc2lvbiA9IGU7XG4gICAgICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KGUpO1xuICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheSh2KSkge1xuICAgICAgICAgICAgICB3cmFwQXJyYXkodiwgYXR0cmlidXRlTmFtZSwgbW9kZWxJbnN0YW5jZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0sXG4gICAgX2luc3RhbGxNZXRob2RzOiBmdW5jdGlvbihtb2RlbEluc3RhbmNlKSB7XG4gICAgICB2YXIgTW9kZWwgPSB0aGlzLm1vZGVsO1xuICAgICAgXy5lYWNoKE9iamVjdC5rZXlzKE1vZGVsLm1ldGhvZHMpLCBmdW5jdGlvbihtZXRob2ROYW1lKSB7XG4gICAgICAgIGlmIChtb2RlbEluc3RhbmNlW21ldGhvZE5hbWVdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBtb2RlbEluc3RhbmNlW21ldGhvZE5hbWVdID0gTW9kZWwubWV0aG9kc1ttZXRob2ROYW1lXS5iaW5kKG1vZGVsSW5zdGFuY2UpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGxvZygnQSBtZXRob2Qgd2l0aCBuYW1lIFwiJyArIG1ldGhvZE5hbWUgKyAnXCIgYWxyZWFkeSBleGlzdHMuIElnbm9yaW5nIGl0LicpO1xuICAgICAgICB9XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH0sXG4gICAgX2luc3RhbGxQcm9wZXJ0aWVzOiBmdW5jdGlvbihtb2RlbEluc3RhbmNlKSB7XG4gICAgICB2YXIgX3Byb3BlcnR5TmFtZXMgPSBPYmplY3Qua2V5cyh0aGlzLm1vZGVsLnByb3BlcnRpZXMpLFxuICAgICAgICBfcHJvcGVydHlEZXBlbmRlbmNpZXMgPSB7fTtcbiAgICAgIF8uZWFjaChfcHJvcGVydHlOYW1lcywgZnVuY3Rpb24ocHJvcE5hbWUpIHtcbiAgICAgICAgdmFyIHByb3BEZWYgPSB0aGlzLm1vZGVsLnByb3BlcnRpZXNbcHJvcE5hbWVdO1xuICAgICAgICB2YXIgZGVwZW5kZW5jaWVzID0gcHJvcERlZi5kZXBlbmRlbmNpZXMgfHwgW107XG4gICAgICAgIGRlcGVuZGVuY2llcy5mb3JFYWNoKGZ1bmN0aW9uKGF0dHIpIHtcbiAgICAgICAgICBpZiAoIV9wcm9wZXJ0eURlcGVuZGVuY2llc1thdHRyXSkgX3Byb3BlcnR5RGVwZW5kZW5jaWVzW2F0dHJdID0gW107XG4gICAgICAgICAgX3Byb3BlcnR5RGVwZW5kZW5jaWVzW2F0dHJdLnB1c2gocHJvcE5hbWUpO1xuICAgICAgICB9KTtcbiAgICAgICAgZGVsZXRlIHByb3BEZWYuZGVwZW5kZW5jaWVzO1xuICAgICAgICBpZiAobW9kZWxJbnN0YW5jZVtwcm9wTmFtZV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShtb2RlbEluc3RhbmNlLCBwcm9wTmFtZSwgcHJvcERlZik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgbG9nKCdBIHByb3BlcnR5L21ldGhvZCB3aXRoIG5hbWUgXCInICsgcHJvcE5hbWUgKyAnXCIgYWxyZWFkeSBleGlzdHMuIElnbm9yaW5nIGl0LicpO1xuICAgICAgICB9XG4gICAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgICBtb2RlbEluc3RhbmNlLl9wcm9wZXJ0eURlcGVuZGVuY2llcyA9IF9wcm9wZXJ0eURlcGVuZGVuY2llcztcbiAgICB9LFxuICAgIF9pbnN0YWxsUmVtb3RlSWQ6IGZ1bmN0aW9uKG1vZGVsSW5zdGFuY2UpIHtcbiAgICAgIHZhciBNb2RlbCA9IHRoaXMubW9kZWw7XG4gICAgICB2YXIgaWRGaWVsZCA9IE1vZGVsLmlkO1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG1vZGVsSW5zdGFuY2UsIGlkRmllbGQsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gbW9kZWxJbnN0YW5jZS5fX3ZhbHVlc1tNb2RlbC5pZF0gfHwgbnVsbDtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbih2KSB7XG4gICAgICAgICAgdmFyIG9sZCA9IG1vZGVsSW5zdGFuY2VbTW9kZWwuaWRdO1xuICAgICAgICAgIG1vZGVsSW5zdGFuY2UuX192YWx1ZXNbTW9kZWwuaWRdID0gdjtcbiAgICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgICAgIGNvbGxlY3Rpb246IE1vZGVsLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgbW9kZWw6IE1vZGVsLm5hbWUsXG4gICAgICAgICAgICBsb2NhbElkOiBtb2RlbEluc3RhbmNlLmxvY2FsSWQsXG4gICAgICAgICAgICBuZXc6IHYsXG4gICAgICAgICAgICBvbGQ6IG9sZCxcbiAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNldCxcbiAgICAgICAgICAgIGZpZWxkOiBNb2RlbC5pZCxcbiAgICAgICAgICAgIG9iajogbW9kZWxJbnN0YW5jZVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGNhY2hlLnJlbW90ZUluc2VydChtb2RlbEluc3RhbmNlLCB2LCBvbGQpO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgIH0pO1xuICAgIH0sXG4gICAgX2luc3RhbGxSZWxhdGlvbnNoaXBzOiBmdW5jdGlvbihtb2RlbEluc3RhbmNlKSB7XG4gICAgICB2YXIgbW9kZWwgPSB0aGlzLm1vZGVsO1xuICAgICAgZm9yICh2YXIgbmFtZSBpbiBtb2RlbC5yZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgIHZhciBwcm94eTtcbiAgICAgICAgaWYgKG1vZGVsLnJlbGF0aW9uc2hpcHMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgICB2YXIgcmVsYXRpb25zaGlwT3B0cyA9IF8uZXh0ZW5kKHt9LCBtb2RlbC5yZWxhdGlvbnNoaXBzW25hbWVdKSxcbiAgICAgICAgICAgIHR5cGUgPSByZWxhdGlvbnNoaXBPcHRzLnR5cGU7XG4gICAgICAgICAgZGVsZXRlIHJlbGF0aW9uc2hpcE9wdHMudHlwZTtcbiAgICAgICAgICBpZiAodHlwZSA9PSBSZWxhdGlvbnNoaXBUeXBlLk9uZVRvTWFueSkge1xuICAgICAgICAgICAgcHJveHkgPSBuZXcgT25lVG9NYW55UHJveHkocmVsYXRpb25zaGlwT3B0cyk7XG4gICAgICAgICAgfSBlbHNlIGlmICh0eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuT25lVG9PbmUpIHtcbiAgICAgICAgICAgIHByb3h5ID0gbmV3IE9uZVRvT25lUHJveHkocmVsYXRpb25zaGlwT3B0cyk7XG4gICAgICAgICAgfSBlbHNlIGlmICh0eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuTWFueVRvTWFueSkge1xuICAgICAgICAgICAgcHJveHkgPSBuZXcgTWFueVRvTWFueVByb3h5KHJlbGF0aW9uc2hpcE9wdHMpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gc3VjaCByZWxhdGlvbnNoaXAgdHlwZTogJyArIHR5cGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBwcm94eS5pbnN0YWxsKG1vZGVsSW5zdGFuY2UpO1xuICAgICAgfVxuICAgIH0sXG4gICAgX3JlZ2lzdGVySW5zdGFuY2U6IGZ1bmN0aW9uKG1vZGVsSW5zdGFuY2UsIHNob3VsZFJlZ2lzdGVyQ2hhbmdlKSB7XG4gICAgICBjYWNoZS5pbnNlcnQobW9kZWxJbnN0YW5jZSk7XG4gICAgICBzaG91bGRSZWdpc3RlckNoYW5nZSA9IHNob3VsZFJlZ2lzdGVyQ2hhbmdlID09PSB1bmRlZmluZWQgPyB0cnVlIDogc2hvdWxkUmVnaXN0ZXJDaGFuZ2U7XG4gICAgICBpZiAoc2hvdWxkUmVnaXN0ZXJDaGFuZ2UpIHtcbiAgICAgICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgICAgICAgY29sbGVjdGlvbjogdGhpcy5tb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICBtb2RlbDogdGhpcy5tb2RlbC5uYW1lLFxuICAgICAgICAgIGxvY2FsSWQ6IG1vZGVsSW5zdGFuY2UubG9jYWxJZCxcbiAgICAgICAgICBuZXc6IG1vZGVsSW5zdGFuY2UsXG4gICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuTmV3LFxuICAgICAgICAgIG9iajogbW9kZWxJbnN0YW5jZVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9LFxuICAgIF9pbnN0YWxsTG9jYWxJZDogZnVuY3Rpb24obW9kZWxJbnN0YW5jZSwgZGF0YSkge1xuICAgICAgbW9kZWxJbnN0YW5jZS5sb2NhbElkID0gdGhpcy5fZ2V0TG9jYWxJZChkYXRhKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIENvbnZlcnQgcmF3IGRhdGEgaW50byBhIE1vZGVsSW5zdGFuY2VcbiAgICAgKiBAcmV0dXJucyB7TW9kZWxJbnN0YW5jZX1cbiAgICAgKi9cbiAgICBfaW5zdGFuY2U6IGZ1bmN0aW9uKGRhdGEsIHNob3VsZFJlZ2lzdGVyQ2hhbmdlKSB7XG4gICAgICBpZiAodGhpcy5tb2RlbC5pbnN0YWxsZWQpIHtcbiAgICAgICAgdmFyIG1vZGVsSW5zdGFuY2UgPSBuZXcgTW9kZWxJbnN0YW5jZSh0aGlzLm1vZGVsKTtcbiAgICAgICAgdGhpcy5faW5zdGFsbExvY2FsSWQobW9kZWxJbnN0YW5jZSwgZGF0YSk7XG4gICAgICAgIHRoaXMuX2luc3RhbGxBdHRyaWJ1dGVzKG1vZGVsSW5zdGFuY2UsIGRhdGEpO1xuICAgICAgICB0aGlzLl9pbnN0YWxsTWV0aG9kcyhtb2RlbEluc3RhbmNlKTtcbiAgICAgICAgdGhpcy5faW5zdGFsbFByb3BlcnRpZXMobW9kZWxJbnN0YW5jZSk7XG4gICAgICAgIHRoaXMuX2luc3RhbGxSZW1vdGVJZChtb2RlbEluc3RhbmNlKTtcbiAgICAgICAgdGhpcy5faW5zdGFsbFJlbGF0aW9uc2hpcHMobW9kZWxJbnN0YW5jZSk7XG4gICAgICAgIHRoaXMuX3JlZ2lzdGVySW5zdGFuY2UobW9kZWxJbnN0YW5jZSwgc2hvdWxkUmVnaXN0ZXJDaGFuZ2UpO1xuICAgICAgICByZXR1cm4gbW9kZWxJbnN0YW5jZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNb2RlbCBtdXN0IGJlIGZ1bGx5IGluc3RhbGxlZCBiZWZvcmUgY3JlYXRpbmcgYW55IG1vZGVscycpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcblxuICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG1vZGVsKSB7XG4gICAgdmFyIGZhY3RvcnkgPSBuZXcgTW9kZWxJbnN0YW5jZUZhY3RvcnkobW9kZWwpO1xuICAgIHJldHVybiBmYWN0b3J5Ll9pbnN0YW5jZS5iaW5kKGZhY3RvcnkpO1xuICB9XG59KSgpOyIsIihmdW5jdGlvbiAoKSB7XG4gICAgLyoqXG4gICAgICogRGVhZCBzaW1wbGUgbG9nZ2luZyBzZXJ2aWNlIGJhc2VkIG9uIHZpc2lvbm1lZGlhL2RlYnVnXG4gICAgICogQG1vZHVsZSBsb2dcbiAgICAgKi9cblxuICAgIHZhciBkZWJ1ZyA9IHJlcXVpcmUoJ2RlYnVnJyksXG4gICAgICAgIGFyZ3NhcnJheSA9IHJlcXVpcmUoJ2FyZ3NhcnJheScpO1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgICB2YXIgbG9nID0gZGVidWcoJ3NpZXN0YTonICsgbmFtZSk7XG4gICAgICAgIHZhciBmbiA9IGFyZ3NhcnJheShmdW5jdGlvbiAoYXJncykge1xuICAgICAgICAgICAgbG9nLmNhbGwobG9nLCBhcmdzKTtcbiAgICAgICAgfSk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShmbiwgJ2VuYWJsZWQnLCB7XG4gICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZGVidWcuZW5hYmxlZChuYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBmbjtcbiAgICB9O1xufSkoKTsiLCIoZnVuY3Rpb24oKSB7XG4gIHZhciBTdG9yZSA9IHJlcXVpcmUoJy4vc3RvcmUnKSxcbiAgICBTaWVzdGFNb2RlbCA9IHJlcXVpcmUoJy4vTW9kZWxJbnN0YW5jZScpLFxuICAgIGxvZyA9IHJlcXVpcmUoJy4vbG9nJykoJ2dyYXBoJyksXG4gICAgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICAgIF8gPSB1dGlsLl8sXG4gICAgYXN5bmMgPSB1dGlsLmFzeW5jO1xuXG4gIGZ1bmN0aW9uIFNpZXN0YUVycm9yKG9wdHMpIHtcbiAgICB0aGlzLm9wdHMgPSBvcHRzO1xuICB9XG5cbiAgU2llc3RhRXJyb3IucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHRoaXMub3B0cywgbnVsbCwgNCk7XG4gIH07XG5cblxuICAvKipcbiAgICogRW5jYXBzdWxhdGVzIHRoZSBpZGVhIG9mIG1hcHBpbmcgYXJyYXlzIG9mIGRhdGEgb250byB0aGUgb2JqZWN0IGdyYXBoIG9yIGFycmF5cyBvZiBvYmplY3RzLlxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICAgKiBAcGFyYW0gb3B0cy5tb2RlbFxuICAgKiBAcGFyYW0gb3B0cy5kYXRhI1xuICAgKiBAcGFyYW0gb3B0cy5vYmplY3RzXG4gICAqIEBwYXJhbSBvcHRzLmRpc2FibGVOb3RpZmljYXRpb25zXG4gICAqL1xuICBmdW5jdGlvbiBNYXBwaW5nT3BlcmF0aW9uKG9wdHMpIHtcbiAgICB0aGlzLl9vcHRzID0gb3B0cztcblxuICAgIHV0aWwuZXh0ZW5kRnJvbU9wdHModGhpcywgb3B0cywge1xuICAgICAgbW9kZWw6IG51bGwsXG4gICAgICBkYXRhOiBudWxsLFxuICAgICAgb2JqZWN0czogW10sXG4gICAgICBkaXNhYmxlZXZlbnRzOiBmYWxzZSxcbiAgICAgIF9pZ25vcmVJbnN0YWxsZWQ6IGZhbHNlLFxuICAgICAgZnJvbVN0b3JhZ2U6IGZhbHNlXG4gICAgfSk7XG5cbiAgICBfLmV4dGVuZCh0aGlzLCB7XG4gICAgICBlcnJvcnM6IFtdLFxuICAgICAgc3ViVGFza1Jlc3VsdHM6IHt9LFxuICAgICAgX25ld09iamVjdHM6IFtdXG4gICAgfSk7XG4gIH1cblxuXG4gIF8uZXh0ZW5kKE1hcHBpbmdPcGVyYXRpb24ucHJvdG90eXBlLCB7XG4gICAgbWFwQXR0cmlidXRlczogZnVuY3Rpb24oKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgZGF0dW0gPSB0aGlzLmRhdGFbaV07XG4gICAgICAgIHZhciBvYmplY3QgPSB0aGlzLm9iamVjdHNbaV07XG4gICAgICAgIC8vIE5vIHBvaW50IG1hcHBpbmcgb2JqZWN0IG9udG8gaXRzZWxmLiBUaGlzIGhhcHBlbnMgaWYgYSBNb2RlbEluc3RhbmNlIGlzIHBhc3NlZCBhcyBhIHJlbGF0aW9uc2hpcC5cbiAgICAgICAgaWYgKGRhdHVtICE9IG9iamVjdCkge1xuICAgICAgICAgIGlmIChvYmplY3QpIHsgLy8gSWYgb2JqZWN0IGlzIGZhbHN5LCB0aGVuIHRoZXJlIHdhcyBhbiBlcnJvciBsb29raW5nIHVwIHRoYXQgb2JqZWN0L2NyZWF0aW5nIGl0LlxuICAgICAgICAgICAgdmFyIGZpZWxkcyA9IHRoaXMubW9kZWwuX2F0dHJpYnV0ZU5hbWVzO1xuICAgICAgICAgICAgXy5lYWNoKGZpZWxkcywgZnVuY3Rpb24oZikge1xuICAgICAgICAgICAgICBpZiAoZGF0dW1bZl0gIT09IHVuZGVmaW5lZCkgeyAvLyBudWxsIGlzIGZpbmVcbiAgICAgICAgICAgICAgICAvLyBJZiBldmVudHMgYXJlIGRpc2FibGVkIHdlIHVwZGF0ZSBfX3ZhbHVlcyBvYmplY3QgZGlyZWN0bHkuIFRoaXMgYXZvaWRzIHRyaWdnZXJpbmdcbiAgICAgICAgICAgICAgICAvLyBldmVudHMgd2hpY2ggYXJlIGJ1aWx0IGludG8gdGhlIHNldCBmdW5jdGlvbiBvZiB0aGUgcHJvcGVydHkuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZGlzYWJsZWV2ZW50cykge1xuICAgICAgICAgICAgICAgICAgb2JqZWN0Ll9fdmFsdWVzW2ZdID0gZGF0dW1bZl07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgb2JqZWN0W2ZdID0gZGF0dW1bZl07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgICAgLy8gUG91Y2hEQiByZXZpc2lvbiAoaWYgdXNpbmcgc3RvcmFnZSBtb2R1bGUpLlxuICAgICAgICAgICAgLy8gVE9ETzogQ2FuIHRoaXMgYmUgcHVsbGVkIG91dCBvZiBjb3JlP1xuICAgICAgICAgICAgaWYgKGRhdHVtLl9yZXYpIG9iamVjdC5fcmV2ID0gZGF0dW0uX3JldjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIF9tYXA6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgdmFyIGVycjtcbiAgICAgIHRoaXMubWFwQXR0cmlidXRlcygpO1xuICAgICAgdmFyIHJlbGF0aW9uc2hpcEZpZWxkcyA9IF8ua2V5cyhzZWxmLnN1YlRhc2tSZXN1bHRzKTtcbiAgICAgIF8uZWFjaChyZWxhdGlvbnNoaXBGaWVsZHMsIGZ1bmN0aW9uKGYpIHtcbiAgICAgICAgdmFyIHJlcyA9IHNlbGYuc3ViVGFza1Jlc3VsdHNbZl07XG4gICAgICAgIHZhciBpbmRleGVzID0gcmVzLmluZGV4ZXMsXG4gICAgICAgICAgb2JqZWN0cyA9IHJlcy5vYmplY3RzO1xuICAgICAgICB2YXIgcmVsYXRlZERhdGEgPSBzZWxmLmdldFJlbGF0ZWREYXRhKGYpLnJlbGF0ZWREYXRhO1xuICAgICAgICB2YXIgdW5mbGF0dGVuZWRPYmplY3RzID0gdXRpbC51bmZsYXR0ZW5BcnJheShvYmplY3RzLCByZWxhdGVkRGF0YSk7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdW5mbGF0dGVuZWRPYmplY3RzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgdmFyIGlkeCA9IGluZGV4ZXNbaV07XG4gICAgICAgICAgLy8gRXJyb3JzIGFyZSBwbHVja2VkIGZyb20gdGhlIHN1Ym9wZXJhdGlvbnMuXG4gICAgICAgICAgdmFyIGVycm9yID0gc2VsZi5lcnJvcnNbaWR4XTtcbiAgICAgICAgICBlcnIgPSBlcnJvciA/IGVycm9yW2ZdIDogbnVsbDtcbiAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgdmFyIHJlbGF0ZWQgPSB1bmZsYXR0ZW5lZE9iamVjdHNbaV07IC8vIENhbiBiZSBhcnJheSBvciBzY2FsYXIuXG4gICAgICAgICAgICB2YXIgb2JqZWN0ID0gc2VsZi5vYmplY3RzW2lkeF07XG4gICAgICAgICAgICBpZiAob2JqZWN0KSB7XG4gICAgICAgICAgICAgIGVyciA9IG9iamVjdC5fX3Byb3hpZXNbZl0uc2V0KHJlbGF0ZWQsIHtkaXNhYmxlZXZlbnRzOiBzZWxmLmRpc2FibGVldmVudHN9KTtcbiAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGlmICghc2VsZi5lcnJvcnNbaWR4XSkgc2VsZi5lcnJvcnNbaWR4XSA9IHt9O1xuICAgICAgICAgICAgICAgIHNlbGYuZXJyb3JzW2lkeF1bZl0gPSBlcnI7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogRm9yIGluZGljZXMgd2hlcmUgbm8gb2JqZWN0IGlzIHByZXNlbnQsIHBlcmZvcm0gbG9va3VwcywgY3JlYXRpbmcgYSBuZXcgb2JqZWN0IGlmIG5lY2Vzc2FyeS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9sb29rdXA6IGZ1bmN0aW9uKGNiKSB7XG4gICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHZhciByZW1vdGVMb29rdXBzID0gW107XG4gICAgICAgIHZhciBsb2NhbExvb2t1cHMgPSBbXTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBpZiAoIXRoaXMub2JqZWN0c1tpXSkge1xuICAgICAgICAgICAgdmFyIGxvb2t1cDtcbiAgICAgICAgICAgIHZhciBkYXR1bSA9IHRoaXMuZGF0YVtpXTtcbiAgICAgICAgICAgIHZhciBpc1NjYWxhciA9IHR5cGVvZiBkYXR1bSA9PSAnc3RyaW5nJyB8fCB0eXBlb2YgZGF0dW0gPT0gJ251bWJlcicgfHwgZGF0dW0gaW5zdGFuY2VvZiBTdHJpbmc7XG4gICAgICAgICAgICBpZiAoZGF0dW0pIHtcbiAgICAgICAgICAgICAgaWYgKGlzU2NhbGFyKSB7XG4gICAgICAgICAgICAgICAgbG9va3VwID0ge1xuICAgICAgICAgICAgICAgICAgaW5kZXg6IGksXG4gICAgICAgICAgICAgICAgICBkYXR1bToge31cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGxvb2t1cC5kYXR1bVtzZWxmLm1vZGVsLmlkXSA9IGRhdHVtO1xuICAgICAgICAgICAgICAgIHJlbW90ZUxvb2t1cHMucHVzaChsb29rdXApO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKGRhdHVtIGluc3RhbmNlb2YgU2llc3RhTW9kZWwpIHsgLy8gV2Ugd29uJ3QgbmVlZCB0byBwZXJmb3JtIGFueSBtYXBwaW5nLlxuICAgICAgICAgICAgICAgIHRoaXMub2JqZWN0c1tpXSA9IGRhdHVtO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKGRhdHVtLmxvY2FsSWQpIHtcbiAgICAgICAgICAgICAgICBsb2NhbExvb2t1cHMucHVzaCh7XG4gICAgICAgICAgICAgICAgICBpbmRleDogaSxcbiAgICAgICAgICAgICAgICAgIGRhdHVtOiBkYXR1bVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKGRhdHVtW3NlbGYubW9kZWwuaWRdKSB7XG4gICAgICAgICAgICAgICAgcmVtb3RlTG9va3Vwcy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgIGluZGV4OiBpLFxuICAgICAgICAgICAgICAgICAgZGF0dW06IGRhdHVtXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5vYmplY3RzW2ldID0gc2VsZi5faW5zdGFuY2UoKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdGhpcy5vYmplY3RzW2ldID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdXRpbC5hc3luYy5wYXJhbGxlbChbXG4gICAgICAgICAgICBmdW5jdGlvbihkb25lKSB7XG4gICAgICAgICAgICAgIHZhciBsb2NhbElkZW50aWZpZXJzID0gXy5wbHVjayhfLnBsdWNrKGxvY2FsTG9va3VwcywgJ2RhdHVtJyksICdsb2NhbElkJyk7XG4gICAgICAgICAgICAgIGlmIChsb2NhbElkZW50aWZpZXJzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIFN0b3JlLmdldE11bHRpcGxlTG9jYWwobG9jYWxJZGVudGlmaWVycywgZnVuY3Rpb24oZXJyLCBvYmplY3RzKSB7XG4gICAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxvY2FsSWRlbnRpZmllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICB2YXIgb2JqID0gb2JqZWN0c1tpXTtcbiAgICAgICAgICAgICAgICAgICAgICB2YXIgbG9jYWxJZCA9IGxvY2FsSWRlbnRpZmllcnNbaV07XG4gICAgICAgICAgICAgICAgICAgICAgdmFyIGxvb2t1cCA9IGxvY2FsTG9va3Vwc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgICBpZiAoIW9iaikge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gSWYgdGhlcmUgYXJlIG11bHRpcGxlIG1hcHBpbmcgb3BlcmF0aW9ucyBnb2luZyBvbiwgdGhlcmUgbWF5IGJlXG4gICAgICAgICAgICAgICAgICAgICAgICBvYmogPSBjYWNoZS5nZXQoe2xvY2FsSWQ6IGxvY2FsSWR9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghb2JqKVxuICAgICAgICAgICAgICAgICAgICAgICAgICBvYmogPSBzZWxmLl9pbnN0YW5jZSh7bG9jYWxJZDogbG9jYWxJZH0sICFzZWxmLmRpc2FibGVldmVudHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5vYmplY3RzW2xvb2t1cC5pbmRleF0gPSBvYmo7XG4gICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYub2JqZWN0c1tsb29rdXAuaW5kZXhdID0gb2JqO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgZG9uZShlcnIpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGRvbmUoKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZ1bmN0aW9uKGRvbmUpIHtcbiAgICAgICAgICAgICAgdmFyIHJlbW90ZUlkZW50aWZpZXJzID0gXy5wbHVjayhfLnBsdWNrKHJlbW90ZUxvb2t1cHMsICdkYXR1bScpLCBzZWxmLm1vZGVsLmlkKTtcbiAgICAgICAgICAgICAgaWYgKHJlbW90ZUlkZW50aWZpZXJzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIFN0b3JlLmdldE11bHRpcGxlUmVtb3RlKHJlbW90ZUlkZW50aWZpZXJzLCBzZWxmLm1vZGVsLCBmdW5jdGlvbihlcnIsIG9iamVjdHMpIHtcbiAgICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChsb2cuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICAgIHZhciByZXN1bHRzID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IG9iamVjdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdHNbcmVtb3RlSWRlbnRpZmllcnNbaV1dID0gb2JqZWN0c1tpXSA/IG9iamVjdHNbaV0ubG9jYWxJZCA6IG51bGw7XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBvYmplY3RzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgdmFyIG9iaiA9IG9iamVjdHNbaV07XG4gICAgICAgICAgICAgICAgICAgICAgdmFyIGxvb2t1cCA9IHJlbW90ZUxvb2t1cHNbaV07XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKG9iaikge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5vYmplY3RzW2xvb2t1cC5pbmRleF0gPSBvYmo7XG4gICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBkYXRhID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcmVtb3RlSWQgPSByZW1vdGVJZGVudGlmaWVyc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFbc2VsZi5tb2RlbC5pZF0gPSByZW1vdGVJZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjYWNoZVF1ZXJ5ID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBtb2RlbDogc2VsZi5tb2RlbFxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhY2hlUXVlcnlbc2VsZi5tb2RlbC5pZF0gPSByZW1vdGVJZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjYWNoZWQgPSBjYWNoZS5nZXQoY2FjaGVRdWVyeSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2FjaGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYub2JqZWN0c1tsb29rdXAuaW5kZXhdID0gY2FjaGVkO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5vYmplY3RzW2xvb2t1cC5pbmRleF0gPSBzZWxmLl9pbnN0YW5jZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBJdCdzIGltcG9ydGFudCB0aGF0IHdlIG1hcCB0aGUgcmVtb3RlIGlkZW50aWZpZXIgaGVyZSB0byBlbnN1cmUgdGhhdCBpdCBlbmRzXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHVwIGluIHRoZSBjYWNoZS5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5vYmplY3RzW2xvb2t1cC5pbmRleF1bc2VsZi5tb2RlbC5pZF0gPSByZW1vdGVJZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGRvbmUoZXJyKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBkb25lKCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICBdLFxuICAgICAgICAgIGNiKTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfSxcbiAgICBfbG9va3VwU2luZ2xldG9uOiBmdW5jdGlvbihjYikge1xuICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAvLyBQaWNrIGEgcmFuZG9tIF9pZCBmcm9tIHRoZSBhcnJheSBvZiBkYXRhIGJlaW5nIG1hcHBlZCBvbnRvIHRoZSBzaW5nbGV0b24gb2JqZWN0LiBOb3RlIHRoYXQgdGhleSBzaG91bGRcbiAgICAgICAgLy8gYWx3YXlzIGJlIHRoZSBzYW1lLiBUaGlzIGlzIGp1c3QgYSBwcmVjYXV0aW9uLlxuICAgICAgICB2YXIgbG9jYWxJZGVudGlmaWVycyA9IF8ucGx1Y2soc2VsZi5kYXRhLCAnbG9jYWxJZCcpLFxuICAgICAgICAgIGxvY2FsSWQ7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBsb2NhbElkZW50aWZpZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgaWYgKGxvY2FsSWRlbnRpZmllcnNbaV0pIHtcbiAgICAgICAgICAgIGxvY2FsSWQgPSB7bG9jYWxJZDogbG9jYWxJZGVudGlmaWVyc1tpXX07XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gVGhlIG1hcHBpbmcgb3BlcmF0aW9uIGlzIHJlc3BvbnNpYmxlIGZvciBjcmVhdGluZyBzaW5nbGV0b24gaW5zdGFuY2VzIGlmIHRoZXkgZG8gbm90IGFscmVhZHkgZXhpc3QuXG4gICAgICAgIHZhciBzaW5nbGV0b24gPSBjYWNoZS5nZXRTaW5nbGV0b24odGhpcy5tb2RlbCkgfHwgdGhpcy5faW5zdGFuY2UobG9jYWxJZCk7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2VsZi5kYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgc2VsZi5vYmplY3RzW2ldID0gc2luZ2xldG9uO1xuICAgICAgICB9XG4gICAgICAgIGNiKCk7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH0sXG4gICAgX2luc3RhbmNlOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBtb2RlbCA9IHRoaXMubW9kZWwsXG4gICAgICAgIG1vZGVsSW5zdGFuY2UgPSBtb2RlbC5faW5zdGFuY2UuYXBwbHkobW9kZWwsIGFyZ3VtZW50cyk7XG4gICAgICB0aGlzLl9uZXdPYmplY3RzLnB1c2gobW9kZWxJbnN0YW5jZSk7XG4gICAgICByZXR1cm4gbW9kZWxJbnN0YW5jZTtcbiAgICB9LFxuICAgIHN0YXJ0OiBmdW5jdGlvbihkb25lKSB7XG4gICAgICBpZiAodGhpcy5kYXRhLmxlbmd0aCkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHZhciB0YXNrcyA9IFtdO1xuICAgICAgICB2YXIgbG9va3VwRnVuYyA9IHRoaXMubW9kZWwuc2luZ2xldG9uID8gdGhpcy5fbG9va3VwU2luZ2xldG9uIDogdGhpcy5fbG9va3VwO1xuICAgICAgICB0YXNrcy5wdXNoKF8uYmluZChsb29rdXBGdW5jLCB0aGlzKSk7XG4gICAgICAgIHRhc2tzLnB1c2goXy5iaW5kKHRoaXMuX2V4ZWN1dGVTdWJPcGVyYXRpb25zLCB0aGlzKSk7XG4gICAgICAgIHV0aWwuYXN5bmMucGFyYWxsZWwodGFza3MsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBzZWxmLl9tYXAoKTtcblxuICAgICAgICAgICAgLy8gVXNlcnMgYXJlIGFsbG93ZWQgdG8gYWRkIGEgY3VzdG9tIGluaXQgbWV0aG9kIHRvIHRoZSBtZXRob2RzIG9iamVjdCB3aGVuIGRlZmluaW5nIGEgTW9kZWwsIG9mIHRoZSBmb3JtOlxuICAgICAgICAgICAgLy9cbiAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAvLyBpbml0OiBmdW5jdGlvbiAoW2RvbmVdKSB7XG4gICAgICAgICAgICAvLyAgICAgLy8gLi4uXG4gICAgICAgICAgICAvLyAgfVxuICAgICAgICAgICAgLy9cbiAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAvLyBJZiBkb25lIGlzIHBhc3NlZCwgdGhlbiBfX2luaXQgbXVzdCBiZSBleGVjdXRlZCBhc3luY2hyb25vdXNseSwgYW5kIHRoZSBtYXBwaW5nIG9wZXJhdGlvbiB3aWxsIG5vdFxuICAgICAgICAgICAgLy8gZmluaXNoIHVudGlsIGFsbCBpbml0cyBoYXZlIGV4ZWN1dGVkLlxuICAgICAgICAgICAgLy9cbiAgICAgICAgICAgIC8vIEhlcmUgd2UgZW5zdXJlIHRoZSBleGVjdXRpb24gb2YgYWxsIG9mIHRoZW1cbiAgICAgICAgICAgIHZhciBmcm9tU3RvcmFnZSA9IHRoaXMuZnJvbVN0b3JhZ2U7XG4gICAgICAgICAgICB2YXIgaW5pdFRhc2tzID0gXy5yZWR1Y2Uoc2VsZi5fbmV3T2JqZWN0cywgZnVuY3Rpb24obSwgbykge1xuICAgICAgICAgICAgICB2YXIgaW5pdCA9IG8ubW9kZWwuaW5pdDtcbiAgICAgICAgICAgICAgaWYgKGluaXQpIHtcbiAgICAgICAgICAgICAgICB2YXIgcGFyYW1OYW1lcyA9IHV0aWwucGFyYW1OYW1lcyhpbml0KTtcbiAgICAgICAgICAgICAgICBpZiAocGFyYW1OYW1lcy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgICBtLnB1c2goXy5iaW5kKGluaXQsIG8sIGZyb21TdG9yYWdlLCBkb25lKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgaW5pdC5jYWxsKG8sIGZyb21TdG9yYWdlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIG07XG4gICAgICAgICAgICB9LCBbXSk7XG4gICAgICAgICAgICBhc3luYy5wYXJhbGxlbChpbml0VGFza3MsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICBkb25lKHNlbGYuZXJyb3JzLmxlbmd0aCA/IHNlbGYuZXJyb3JzIDogbnVsbCwgc2VsZi5vYmplY3RzKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignVW5jYXVnaHQgZXJyb3Igd2hlbiBleGVjdXRpbmcgaW5pdCBmdW5jaXRvbnMgb24gbW9kZWxzLicsIGUpO1xuICAgICAgICAgICAgZG9uZShlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkb25lKG51bGwsIFtdKTtcbiAgICAgIH1cbiAgICB9LFxuICAgIGdldFJlbGF0ZWREYXRhOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgICB2YXIgaW5kZXhlcyA9IFtdO1xuICAgICAgdmFyIHJlbGF0ZWREYXRhID0gW107XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgZGF0dW0gPSB0aGlzLmRhdGFbaV07XG4gICAgICAgIGlmIChkYXR1bSkge1xuICAgICAgICAgIGlmIChkYXR1bVtuYW1lXSkge1xuICAgICAgICAgICAgaW5kZXhlcy5wdXNoKGkpO1xuICAgICAgICAgICAgcmVsYXRlZERhdGEucHVzaChkYXR1bVtuYW1lXSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4ge1xuICAgICAgICBpbmRleGVzOiBpbmRleGVzLFxuICAgICAgICByZWxhdGVkRGF0YTogcmVsYXRlZERhdGFcbiAgICAgIH07XG4gICAgfSxcbiAgICBwcm9jZXNzRXJyb3JzRnJvbVRhc2s6IGZ1bmN0aW9uKHJlbGF0aW9uc2hpcE5hbWUsIGVycm9ycywgaW5kZXhlcykge1xuICAgICAgaWYgKGVycm9ycy5sZW5ndGgpIHtcbiAgICAgICAgdmFyIHJlbGF0ZWREYXRhID0gdGhpcy5nZXRSZWxhdGVkRGF0YShyZWxhdGlvbnNoaXBOYW1lKS5yZWxhdGVkRGF0YTtcbiAgICAgICAgdmFyIHVuZmxhdHRlbmVkRXJyb3JzID0gdXRpbC51bmZsYXR0ZW5BcnJheShlcnJvcnMsIHJlbGF0ZWREYXRhKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB1bmZsYXR0ZW5lZEVycm9ycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIHZhciBpZHggPSBpbmRleGVzW2ldO1xuICAgICAgICAgIHZhciBlcnIgPSB1bmZsYXR0ZW5lZEVycm9yc1tpXTtcbiAgICAgICAgICB2YXIgaXNFcnJvciA9IGVycjtcbiAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KGVycikpIGlzRXJyb3IgPSBfLnJlZHVjZShlcnIsIGZ1bmN0aW9uKG1lbW8sIHgpIHtcbiAgICAgICAgICAgIHJldHVybiBtZW1vIHx8IHhcbiAgICAgICAgICB9LCBmYWxzZSk7XG4gICAgICAgICAgaWYgKGlzRXJyb3IpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5lcnJvcnNbaWR4XSkgdGhpcy5lcnJvcnNbaWR4XSA9IHt9O1xuICAgICAgICAgICAgdGhpcy5lcnJvcnNbaWR4XVtyZWxhdGlvbnNoaXBOYW1lXSA9IGVycjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIF9leGVjdXRlU3ViT3BlcmF0aW9uczogZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcyxcbiAgICAgICAgcmVsYXRpb25zaGlwTmFtZXMgPSBfLmtleXModGhpcy5tb2RlbC5yZWxhdGlvbnNoaXBzKTtcbiAgICAgIGlmIChyZWxhdGlvbnNoaXBOYW1lcy5sZW5ndGgpIHtcbiAgICAgICAgdmFyIHRhc2tzID0gXy5yZWR1Y2UocmVsYXRpb25zaGlwTmFtZXMsIGZ1bmN0aW9uKG0sIHJlbGF0aW9uc2hpcE5hbWUpIHtcbiAgICAgICAgICB2YXIgcmVsYXRpb25zaGlwID0gc2VsZi5tb2RlbC5yZWxhdGlvbnNoaXBzW3JlbGF0aW9uc2hpcE5hbWVdO1xuICAgICAgICAgIHZhciByZXZlcnNlTW9kZWwgPSByZWxhdGlvbnNoaXAuZm9yd2FyZE5hbWUgPT0gcmVsYXRpb25zaGlwTmFtZSA/IHJlbGF0aW9uc2hpcC5yZXZlcnNlTW9kZWwgOiByZWxhdGlvbnNoaXAuZm9yd2FyZE1vZGVsO1xuICAgICAgICAgIC8vIE1vY2sgYW55IG1pc3Npbmcgc2luZ2xldG9uIGRhdGEgdG8gZW5zdXJlIHRoYXQgYWxsIHNpbmdsZXRvbiBpbnN0YW5jZXMgYXJlIGNyZWF0ZWQuXG4gICAgICAgICAgaWYgKHJldmVyc2VNb2RlbC5zaW5nbGV0b24gJiYgIXJlbGF0aW9uc2hpcC5pc1JldmVyc2UpIHtcbiAgICAgICAgICAgIHRoaXMuZGF0YS5mb3JFYWNoKGZ1bmN0aW9uKGRhdHVtKSB7XG4gICAgICAgICAgICAgIGlmICghZGF0dW1bcmVsYXRpb25zaGlwTmFtZV0pIGRhdHVtW3JlbGF0aW9uc2hpcE5hbWVdID0ge307XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdmFyIF9fcmV0ID0gdGhpcy5nZXRSZWxhdGVkRGF0YShyZWxhdGlvbnNoaXBOYW1lKSxcbiAgICAgICAgICAgIGluZGV4ZXMgPSBfX3JldC5pbmRleGVzLFxuICAgICAgICAgICAgcmVsYXRlZERhdGEgPSBfX3JldC5yZWxhdGVkRGF0YTtcbiAgICAgICAgICBpZiAocmVsYXRlZERhdGEubGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgZmxhdFJlbGF0ZWREYXRhID0gdXRpbC5mbGF0dGVuQXJyYXkocmVsYXRlZERhdGEpO1xuICAgICAgICAgICAgdmFyIG9wID0gbmV3IE1hcHBpbmdPcGVyYXRpb24oe1xuICAgICAgICAgICAgICBtb2RlbDogcmV2ZXJzZU1vZGVsLFxuICAgICAgICAgICAgICBkYXRhOiBmbGF0UmVsYXRlZERhdGEsXG4gICAgICAgICAgICAgIGRpc2FibGVldmVudHM6IHNlbGYuZGlzYWJsZWV2ZW50cyxcbiAgICAgICAgICAgICAgX2lnbm9yZUluc3RhbGxlZDogc2VsZi5faWdub3JlSW5zdGFsbGVkLFxuICAgICAgICAgICAgICBmcm9tU3RvcmFnZTogdGhpcy5mcm9tU3RvcmFnZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKG9wKSB7XG4gICAgICAgICAgICB2YXIgdGFzaztcbiAgICAgICAgICAgIHRhc2sgPSBmdW5jdGlvbihkb25lKSB7XG4gICAgICAgICAgICAgIG9wLnN0YXJ0KGZ1bmN0aW9uKGVycm9ycywgb2JqZWN0cykge1xuICAgICAgICAgICAgICAgIHNlbGYuc3ViVGFza1Jlc3VsdHNbcmVsYXRpb25zaGlwTmFtZV0gPSB7XG4gICAgICAgICAgICAgICAgICBlcnJvcnM6IGVycm9ycyxcbiAgICAgICAgICAgICAgICAgIG9iamVjdHM6IG9iamVjdHMsXG4gICAgICAgICAgICAgICAgICBpbmRleGVzOiBpbmRleGVzXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBzZWxmLnByb2Nlc3NFcnJvcnNGcm9tVGFzayhyZWxhdGlvbnNoaXBOYW1lLCBvcC5lcnJvcnMsIGluZGV4ZXMpO1xuICAgICAgICAgICAgICAgIGRvbmUoKTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgbS5wdXNoKHRhc2spO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gbTtcbiAgICAgICAgfS5iaW5kKHRoaXMpLCBbXSk7XG4gICAgICAgIGFzeW5jLnBhcmFsbGVsKHRhc2tzLCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICBtb2R1bGUuZXhwb3J0cyA9IE1hcHBpbmdPcGVyYXRpb247XG5cblxufSkoKTsiLCIoZnVuY3Rpb24oKSB7XG5cbiAgdmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJykoJ21vZGVsJyksXG4gICAgQ29sbGVjdGlvblJlZ2lzdHJ5ID0gcmVxdWlyZSgnLi9jb2xsZWN0aW9uUmVnaXN0cnknKS5Db2xsZWN0aW9uUmVnaXN0cnksXG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgIFJlbGF0aW9uc2hpcFR5cGUgPSByZXF1aXJlKCcuL1JlbGF0aW9uc2hpcFR5cGUnKSxcbiAgICBRdWVyeSA9IHJlcXVpcmUoJy4vUXVlcnknKSxcbiAgICBNYXBwaW5nT3BlcmF0aW9uID0gcmVxdWlyZSgnLi9tYXBwaW5nT3BlcmF0aW9uJyksXG4gICAgTW9kZWxJbnN0YW5jZSA9IHJlcXVpcmUoJy4vTW9kZWxJbnN0YW5jZScpLFxuICAgIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgICBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKSxcbiAgICBzdG9yZSA9IHJlcXVpcmUoJy4vc3RvcmUnKSxcbiAgICBhcmdzYXJyYXkgPSByZXF1aXJlKCdhcmdzYXJyYXknKSxcbiAgICBlcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKSxcbiAgICBleHRlbmQgPSByZXF1aXJlKCdleHRlbmQnKSxcbiAgICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgICBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICAgIE9uZVRvT25lUHJveHkgPSByZXF1aXJlKCcuL09uZVRvT25lUHJveHknKSxcbiAgICBNYW55VG9NYW55UHJveHkgPSByZXF1aXJlKCcuL01hbnlUb01hbnlQcm94eScpLFxuICAgIFJlYWN0aXZlUXVlcnkgPSByZXF1aXJlKCcuL1JlYWN0aXZlUXVlcnknKSxcbiAgICBpbnN0YW5jZUZhY3RvcnkgPSByZXF1aXJlKCcuL2luc3RhbmNlRmFjdG9yeScpLFxuICAgIEFycmFuZ2VkUmVhY3RpdmVRdWVyeSA9IHJlcXVpcmUoJy4vQXJyYW5nZWRSZWFjdGl2ZVF1ZXJ5JyksXG4gICAgXyA9IHV0aWwuXztcblxuICAvKipcbiAgICpcbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdHNcbiAgICovXG4gIGZ1bmN0aW9uIE1vZGVsKG9wdHMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdGhpcy5fb3B0cyA9IG9wdHMgPyBfLmV4dGVuZCh7fSwgb3B0cykgOiB7fTtcblxuICAgIHV0aWwuZXh0ZW5kRnJvbU9wdHModGhpcywgb3B0cywge1xuICAgICAgbWV0aG9kczoge30sXG4gICAgICBhdHRyaWJ1dGVzOiBbXSxcbiAgICAgIGNvbGxlY3Rpb246IGZ1bmN0aW9uKGMpIHtcbiAgICAgICAgaWYgKHV0aWwuaXNTdHJpbmcoYykpIHtcbiAgICAgICAgICBjID0gQ29sbGVjdGlvblJlZ2lzdHJ5W2NdO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjO1xuICAgICAgfSxcbiAgICAgIGlkOiAnaWQnLFxuICAgICAgcmVsYXRpb25zaGlwczogW10sXG4gICAgICBuYW1lOiBudWxsLFxuICAgICAgaW5kZXhlczogW10sXG4gICAgICBzaW5nbGV0b246IGZhbHNlLFxuICAgICAgc3RhdGljczogdGhpcy5pbnN0YWxsU3RhdGljcy5iaW5kKHRoaXMpLFxuICAgICAgcHJvcGVydGllczoge30sXG4gICAgICBpbml0OiBudWxsLFxuICAgICAgc2VyaWFsaXNlOiBudWxsLFxuICAgICAgc2VyaWFsaXNlRmllbGQ6IG51bGwsXG4gICAgICBzZXJpYWxpc2FibGVGaWVsZHM6IG51bGwsXG4gICAgICByZW1vdmU6IG51bGwsXG4gICAgICBwYXJzZUF0dHJpYnV0ZTogbnVsbCxcbiAgICAgIHN0b3JlOiBudWxsXG4gICAgfSwgZmFsc2UpO1xuXG4gICAgaWYgKCF0aGlzLnBhcnNlQXR0cmlidXRlKSB7XG4gICAgICB0aGlzLnBhcnNlQXR0cmlidXRlID0gZnVuY3Rpb24oYXR0ck5hbWUsIHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuc2VyaWFsaXNlRmllbGQpIHtcbiAgICAgIHRoaXMuc2VyaWFsaXNlRmllbGQgPSBmdW5jdGlvbihhdHRyTmFtZSwgdmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5zdG9yZSA9PT0gdW5kZWZpbmVkIHx8IHRoaXMuc3RvcmUgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuc3RvcmUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2UgaWYgKHRoaXMuc3RvcmUgPT09IGZhbHNlKSB7XG4gICAgICB0aGlzLnN0b3JlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gICAgZWxzZSBpZiAodGhpcy5zdG9yZSA9PT0gdHJ1ZSkge1xuICAgICAgdGhpcy5zdG9yZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmF0dHJpYnV0ZXMgPSBNb2RlbC5fcHJvY2Vzc0F0dHJpYnV0ZXModGhpcy5hdHRyaWJ1dGVzKTtcblxuICAgIHRoaXMuX2luc3RhbmNlID0gbmV3IGluc3RhbmNlRmFjdG9yeSh0aGlzKTtcblxuICAgIF8uZXh0ZW5kKHRoaXMsIHtcbiAgICAgIF9pbnN0YWxsZWQ6IGZhbHNlLFxuICAgICAgX3JlbGF0aW9uc2hpcHNJbnN0YWxsZWQ6IGZhbHNlLFxuICAgICAgX3JldmVyc2VSZWxhdGlvbnNoaXBzSW5zdGFsbGVkOiBmYWxzZSxcbiAgICAgIGNoaWxkcmVuOiBbXVxuICAgIH0pO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXModGhpcywge1xuICAgICAgX3JlbGF0aW9uc2hpcE5hbWVzOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKHNlbGYucmVsYXRpb25zaGlwcyk7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgIH0sXG4gICAgICBfYXR0cmlidXRlTmFtZXM6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgbmFtZXMgPSBbXTtcbiAgICAgICAgICBpZiAoc2VsZi5pZCkge1xuICAgICAgICAgICAgbmFtZXMucHVzaChzZWxmLmlkKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgXy5lYWNoKHNlbGYuYXR0cmlidXRlcywgZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgbmFtZXMucHVzaCh4Lm5hbWUpXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgcmV0dXJuIG5hbWVzO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgIH0sXG4gICAgICBpbnN0YWxsZWQ6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gc2VsZi5faW5zdGFsbGVkICYmIHNlbGYuX3JlbGF0aW9uc2hpcHNJbnN0YWxsZWQgJiYgc2VsZi5fcmV2ZXJzZVJlbGF0aW9uc2hpcHNJbnN0YWxsZWQ7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgfSxcbiAgICAgIGRlc2NlbmRhbnRzOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuIF8ucmVkdWNlKHNlbGYuY2hpbGRyZW4sIGZ1bmN0aW9uKG1lbW8sIGRlc2NlbmRhbnQpIHtcbiAgICAgICAgICAgIHJldHVybiBBcnJheS5wcm90b3R5cGUuY29uY2F0LmNhbGwobWVtbywgZGVzY2VuZGFudC5kZXNjZW5kYW50cyk7XG4gICAgICAgICAgfS5iaW5kKHNlbGYpLCBfLmV4dGVuZChbXSwgc2VsZi5jaGlsZHJlbikpO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgICB9LFxuICAgICAgZGlydHk6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICBpZiAoc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCkge1xuICAgICAgICAgICAgdmFyIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uID0gc2llc3RhLmV4dC5zdG9yYWdlLl91bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbixcbiAgICAgICAgICAgICAgaGFzaCA9ICh1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvblt0aGlzLmNvbGxlY3Rpb25OYW1lXSB8fCB7fSlbdGhpcy5uYW1lXSB8fCB7fTtcbiAgICAgICAgICAgIHJldHVybiAhIU9iamVjdC5rZXlzKGhhc2gpLmxlbmd0aDtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgICB9LFxuICAgICAgY29sbGVjdGlvbk5hbWU6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5jb2xsZWN0aW9uLm5hbWU7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgIH1cbiAgICB9KTtcbiAgICB2YXIgZ2xvYmFsRXZlbnROYW1lID0gdGhpcy5jb2xsZWN0aW9uTmFtZSArICc6JyArIHRoaXMubmFtZSxcbiAgICAgIHByb3hpZWQgPSB7XG4gICAgICAgIHF1ZXJ5OiB0aGlzLnF1ZXJ5LmJpbmQodGhpcylcbiAgICAgIH07XG5cbiAgICBldmVudHMuUHJveHlFdmVudEVtaXR0ZXIuY2FsbCh0aGlzLCBnbG9iYWxFdmVudE5hbWUsIHByb3hpZWQpO1xuICB9XG5cbiAgXy5leHRlbmQoTW9kZWwsIHtcbiAgICAvKipcbiAgICAgKiBOb3JtYWxpc2UgYXR0cmlidXRlcyBwYXNzZWQgdmlhIHRoZSBvcHRpb25zIGRpY3Rpb25hcnkuXG4gICAgICogQHBhcmFtIGF0dHJpYnV0ZXNcbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcHJvY2Vzc0F0dHJpYnV0ZXM6IGZ1bmN0aW9uKGF0dHJpYnV0ZXMpIHtcbiAgICAgIHJldHVybiBfLnJlZHVjZShhdHRyaWJ1dGVzLCBmdW5jdGlvbihtLCBhKSB7XG4gICAgICAgIGlmICh0eXBlb2YgYSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgIG0ucHVzaCh7XG4gICAgICAgICAgICBuYW1lOiBhXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgbS5wdXNoKGEpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtO1xuICAgICAgfSwgW10pXG4gICAgfVxuICB9KTtcblxuICBNb2RlbC5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKGV2ZW50cy5Qcm94eUV2ZW50RW1pdHRlci5wcm90b3R5cGUpO1xuXG4gIF8uZXh0ZW5kKE1vZGVsLnByb3RvdHlwZSwge1xuICAgIGluc3RhbGxTdGF0aWNzOiBmdW5jdGlvbihzdGF0aWNzKSB7XG4gICAgICBpZiAoc3RhdGljcykge1xuICAgICAgICBfLmVhY2goT2JqZWN0LmtleXMoc3RhdGljcyksIGZ1bmN0aW9uKHN0YXRpY05hbWUpIHtcbiAgICAgICAgICBpZiAodGhpc1tzdGF0aWNOYW1lXSkge1xuICAgICAgICAgICAgbG9nKCdTdGF0aWMgbWV0aG9kIHdpdGggbmFtZSBcIicgKyBzdGF0aWNOYW1lICsgJ1wiIGFscmVhZHkgZXhpc3RzLiBJZ25vcmluZyBpdC4nKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aGlzW3N0YXRpY05hbWVdID0gc3RhdGljc1tzdGF0aWNOYW1lXS5iaW5kKHRoaXMpO1xuICAgICAgICAgIH1cbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzdGF0aWNzO1xuICAgIH0sXG4gICAgX3ZhbGlkYXRlUmVsYXRpb25zaGlwVHlwZTogZnVuY3Rpb24ocmVsYXRpb25zaGlwKSB7XG4gICAgICBpZiAoIXJlbGF0aW9uc2hpcC50eXBlKSB7XG4gICAgICAgIGlmICh0aGlzLnNpbmdsZXRvbikgcmVsYXRpb25zaGlwLnR5cGUgPSBSZWxhdGlvbnNoaXBUeXBlLk9uZVRvT25lO1xuICAgICAgICBlbHNlIHJlbGF0aW9uc2hpcC50eXBlID0gUmVsYXRpb25zaGlwVHlwZS5PbmVUb01hbnk7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5zaW5nbGV0b24gJiYgcmVsYXRpb25zaGlwLnR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5NYW55VG9NYW55KSB7XG4gICAgICAgIHJldHVybiAnU2luZ2xldG9uIG1vZGVsIGNhbm5vdCB1c2UgTWFueVRvTWFueSByZWxhdGlvbnNoaXAuJztcbiAgICAgIH1cbiAgICAgIGlmIChPYmplY3Qua2V5cyhSZWxhdGlvbnNoaXBUeXBlKS5pbmRleE9mKHJlbGF0aW9uc2hpcC50eXBlKSA8IDApXG4gICAgICAgIHJldHVybiAnUmVsYXRpb25zaGlwIHR5cGUgJyArIHJlbGF0aW9uc2hpcC50eXBlICsgJyBkb2VzIG5vdCBleGlzdCc7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogSW5zdGFsbCByZWxhdGlvbnNoaXBzLiBSZXR1cm5zIGVycm9yIGluIGZvcm0gb2Ygc3RyaW5nIGlmIGZhaWxzLlxuICAgICAqIEByZXR1cm4ge1N0cmluZ3xudWxsfVxuICAgICAqL1xuICAgIGluc3RhbGxSZWxhdGlvbnNoaXBzOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICghdGhpcy5fcmVsYXRpb25zaGlwc0luc3RhbGxlZCkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXMsXG4gICAgICAgICAgZXJyID0gbnVsbDtcbiAgICAgICAgc2VsZi5fcmVsYXRpb25zaGlwcyA9IFtdO1xuICAgICAgICBpZiAoc2VsZi5fb3B0cy5yZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgICAgZm9yICh2YXIgbmFtZSBpbiBzZWxmLl9vcHRzLnJlbGF0aW9uc2hpcHMpIHtcbiAgICAgICAgICAgIGlmIChzZWxmLl9vcHRzLnJlbGF0aW9uc2hpcHMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgICAgICAgdmFyIHJlbGF0aW9uc2hpcCA9IHNlbGYuX29wdHMucmVsYXRpb25zaGlwc1tuYW1lXTtcbiAgICAgICAgICAgICAgLy8gSWYgYSByZXZlcnNlIHJlbGF0aW9uc2hpcCBpcyBpbnN0YWxsZWQgYmVmb3JlaGFuZCwgd2UgZG8gbm90IHdhbnQgdG8gcHJvY2VzcyB0aGVtLlxuICAgICAgICAgICAgICBpZiAoIXJlbGF0aW9uc2hpcC5pc1JldmVyc2UpIHtcbiAgICAgICAgICAgICAgICBsb2codGhpcy5uYW1lICsgJzogY29uZmlndXJpbmcgcmVsYXRpb25zaGlwICcgKyBuYW1lLCByZWxhdGlvbnNoaXApO1xuICAgICAgICAgICAgICAgIGlmICghKGVyciA9IHRoaXMuX3ZhbGlkYXRlUmVsYXRpb25zaGlwVHlwZShyZWxhdGlvbnNoaXApKSkge1xuICAgICAgICAgICAgICAgICAgdmFyIG1vZGVsTmFtZSA9IHJlbGF0aW9uc2hpcC5tb2RlbDtcbiAgICAgICAgICAgICAgICAgIGlmIChtb2RlbE5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHJlbGF0aW9uc2hpcC5tb2RlbDtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJldmVyc2VNb2RlbDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1vZGVsTmFtZSBpbnN0YW5jZW9mIE1vZGVsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgcmV2ZXJzZU1vZGVsID0gbW9kZWxOYW1lO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgIGxvZygncmV2ZXJzZU1vZGVsTmFtZScsIG1vZGVsTmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKCFzZWxmLmNvbGxlY3Rpb24pIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNb2RlbCBtdXN0IGhhdmUgY29sbGVjdGlvbicpO1xuICAgICAgICAgICAgICAgICAgICAgIHZhciBjb2xsZWN0aW9uID0gc2VsZi5jb2xsZWN0aW9uO1xuICAgICAgICAgICAgICAgICAgICAgIGlmICghY29sbGVjdGlvbikgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ0NvbGxlY3Rpb24gJyArIHNlbGYuY29sbGVjdGlvbk5hbWUgKyAnIG5vdCByZWdpc3RlcmVkJyk7XG4gICAgICAgICAgICAgICAgICAgICAgcmV2ZXJzZU1vZGVsID0gY29sbGVjdGlvblttb2RlbE5hbWVdO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICghcmV2ZXJzZU1vZGVsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgdmFyIGFyciA9IG1vZGVsTmFtZS5zcGxpdCgnLicpO1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChhcnIubGVuZ3RoID09IDIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IGFyclswXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsTmFtZSA9IGFyclsxXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBvdGhlckNvbGxlY3Rpb24gPSBDb2xsZWN0aW9uUmVnaXN0cnlbY29sbGVjdGlvbk5hbWVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFvdGhlckNvbGxlY3Rpb24pIHJldHVybiAnQ29sbGVjdGlvbiB3aXRoIG5hbWUgXCInICsgY29sbGVjdGlvbk5hbWUgKyAnXCIgZG9lcyBub3QgZXhpc3QuJztcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldmVyc2VNb2RlbCA9IG90aGVyQ29sbGVjdGlvblttb2RlbE5hbWVdO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBsb2coJ3JldmVyc2VNb2RlbCcsIHJldmVyc2VNb2RlbCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXZlcnNlTW9kZWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICBfLmV4dGVuZChyZWxhdGlvbnNoaXAsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldmVyc2VNb2RlbDogcmV2ZXJzZU1vZGVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yd2FyZE1vZGVsOiB0aGlzLFxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yd2FyZE5hbWU6IG5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICByZXZlcnNlTmFtZTogcmVsYXRpb25zaGlwLnJldmVyc2UgfHwgJ3JldmVyc2VfJyArIG5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBpc1JldmVyc2U6IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHJlbGF0aW9uc2hpcC5yZXZlcnNlO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgcmV0dXJuICdNb2RlbCB3aXRoIG5hbWUgXCInICsgbW9kZWxOYW1lLnRvU3RyaW5nKCkgKyAnXCIgZG9lcyBub3QgZXhpc3QnO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgZWxzZSByZXR1cm4gJ011c3QgcGFzcyBtb2RlbCc7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignUmVsYXRpb25zaGlwcyBmb3IgXCInICsgdGhpcy5uYW1lICsgJ1wiIGhhdmUgYWxyZWFkeSBiZWVuIGluc3RhbGxlZCcpO1xuICAgICAgfVxuICAgICAgaWYgKCFlcnIpIHRoaXMuX3JlbGF0aW9uc2hpcHNJbnN0YWxsZWQgPSB0cnVlO1xuICAgICAgcmV0dXJuIGVycjtcbiAgICB9LFxuICAgIGluc3RhbGxSZXZlcnNlUmVsYXRpb25zaGlwczogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoIXRoaXMuX3JldmVyc2VSZWxhdGlvbnNoaXBzSW5zdGFsbGVkKSB7XG4gICAgICAgIGZvciAodmFyIGZvcndhcmROYW1lIGluIHRoaXMucmVsYXRpb25zaGlwcykge1xuICAgICAgICAgIGlmICh0aGlzLnJlbGF0aW9uc2hpcHMuaGFzT3duUHJvcGVydHkoZm9yd2FyZE5hbWUpKSB7XG4gICAgICAgICAgICB2YXIgcmVsYXRpb25zaGlwID0gdGhpcy5yZWxhdGlvbnNoaXBzW2ZvcndhcmROYW1lXTtcbiAgICAgICAgICAgIHJlbGF0aW9uc2hpcCA9IGV4dGVuZCh0cnVlLCB7fSwgcmVsYXRpb25zaGlwKTtcbiAgICAgICAgICAgIHJlbGF0aW9uc2hpcC5pc1JldmVyc2UgPSB0cnVlO1xuICAgICAgICAgICAgdmFyIHJldmVyc2VNb2RlbCA9IHJlbGF0aW9uc2hpcC5yZXZlcnNlTW9kZWwsXG4gICAgICAgICAgICAgIHJldmVyc2VOYW1lID0gcmVsYXRpb25zaGlwLnJldmVyc2VOYW1lO1xuICAgICAgICAgICAgaWYgKHJldmVyc2VNb2RlbC5zaW5nbGV0b24pIHtcbiAgICAgICAgICAgICAgaWYgKHJlbGF0aW9uc2hpcC50eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuTWFueVRvTWFueSkgcmV0dXJuICdTaW5nbGV0b24gbW9kZWwgY2Fubm90IGJlIHJlbGF0ZWQgdmlhIHJldmVyc2UgTWFueVRvTWFueSc7XG4gICAgICAgICAgICAgIGlmIChyZWxhdGlvbnNoaXAudHlwZSA9PSBSZWxhdGlvbnNoaXBUeXBlLk9uZVRvTWFueSkgcmV0dXJuICdTaW5nbGV0b24gbW9kZWwgY2Fubm90IGJlIHJlbGF0ZWQgdmlhIHJldmVyc2UgT25lVG9NYW55JztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxvZyh0aGlzLm5hbWUgKyAnOiBjb25maWd1cmluZyAgcmV2ZXJzZSByZWxhdGlvbnNoaXAgJyArIHJldmVyc2VOYW1lKTtcbiAgICAgICAgICAgIHJldmVyc2VNb2RlbC5yZWxhdGlvbnNoaXBzW3JldmVyc2VOYW1lXSA9IHJlbGF0aW9uc2hpcDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fcmV2ZXJzZVJlbGF0aW9uc2hpcHNJbnN0YWxsZWQgPSB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ1JldmVyc2UgcmVsYXRpb25zaGlwcyBmb3IgXCInICsgdGhpcy5uYW1lICsgJ1wiIGhhdmUgYWxyZWFkeSBiZWVuIGluc3RhbGxlZC4nKTtcbiAgICAgIH1cbiAgICB9LFxuICAgIF9xdWVyeTogZnVuY3Rpb24ocXVlcnkpIHtcbiAgICAgIHJldHVybiBuZXcgUXVlcnkodGhpcywgcXVlcnkgfHwge30pO1xuICAgIH0sXG4gICAgcXVlcnk6IGZ1bmN0aW9uKHF1ZXJ5LCBjYikge1xuICAgICAgdmFyIHF1ZXJ5SW5zdGFuY2U7XG4gICAgICB2YXIgcHJvbWlzZSA9IHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgICAgaWYgKCF0aGlzLnNpbmdsZXRvbikge1xuICAgICAgICAgIHF1ZXJ5SW5zdGFuY2UgPSB0aGlzLl9xdWVyeShxdWVyeSk7XG4gICAgICAgICAgcmV0dXJuIHF1ZXJ5SW5zdGFuY2UuZXhlY3V0ZShjYik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgcXVlcnlJbnN0YW5jZSA9IHRoaXMuX3F1ZXJ5KHtfX2lnbm9yZUluc3RhbGxlZDogdHJ1ZX0pO1xuICAgICAgICAgIHF1ZXJ5SW5zdGFuY2UuZXhlY3V0ZShmdW5jdGlvbihlcnIsIG9ianMpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIGNiKGVycik7XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gQ2FjaGUgYSBuZXcgc2luZ2xldG9uIGFuZCB0aGVuIHJlZXhlY3V0ZSB0aGUgcXVlcnlcbiAgICAgICAgICAgICAgcXVlcnkgPSBfLmV4dGVuZCh7fSwgcXVlcnkpO1xuICAgICAgICAgICAgICBxdWVyeS5fX2lnbm9yZUluc3RhbGxlZCA9IHRydWU7XG4gICAgICAgICAgICAgIGlmICghb2Jqcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmdyYXBoKHt9LCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHF1ZXJ5SW5zdGFuY2UgPSB0aGlzLl9xdWVyeShxdWVyeSk7XG4gICAgICAgICAgICAgICAgICAgIHF1ZXJ5SW5zdGFuY2UuZXhlY3V0ZShjYik7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY2IoZXJyKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHF1ZXJ5SW5zdGFuY2UgPSB0aGlzLl9xdWVyeShxdWVyeSk7XG4gICAgICAgICAgICAgICAgcXVlcnlJbnN0YW5jZS5leGVjdXRlKGNiKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH1cbiAgICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICAgIC8vIEJ5IHdyYXBwaW5nIHRoZSBwcm9taXNlIGluIGFub3RoZXIgcHJvbWlzZSB3ZSBjYW4gcHVzaCB0aGUgaW52b2NhdGlvbnMgdG8gdGhlIGJvdHRvbSBvZiB0aGUgZXZlbnQgbG9vcCBzbyB0aGF0XG4gICAgICAvLyBhbnkgZXZlbnQgaGFuZGxlcnMgYWRkZWQgdG8gdGhlIGNoYWluIGFyZSBob25vdXJlZCBzdHJhaWdodCBhd2F5LlxuICAgICAgdmFyIGxpbmtQcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIHByb21pc2UudGhlbihhcmdzYXJyYXkoZnVuY3Rpb24oYXJncykge1xuICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXNvbHZlLmFwcGx5KG51bGwsIGFyZ3MpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KSwgYXJnc2FycmF5KGZ1bmN0aW9uKGFyZ3MpIHtcbiAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmVqZWN0LmFwcGx5KG51bGwsIGFyZ3MpO1xuICAgICAgICAgIH0pXG4gICAgICAgIH0pKTtcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gdGhpcy5fbGluayh7XG4gICAgICAgIHRoZW46IGxpbmtQcm9taXNlLnRoZW4uYmluZChsaW5rUHJvbWlzZSksXG4gICAgICAgIGNhdGNoOiBsaW5rUHJvbWlzZS5jYXRjaC5iaW5kKGxpbmtQcm9taXNlKSxcbiAgICAgICAgb246IGFyZ3NhcnJheShmdW5jdGlvbihhcmdzKSB7XG4gICAgICAgICAgdmFyIHJxID0gbmV3IFJlYWN0aXZlUXVlcnkodGhpcy5fcXVlcnkocXVlcnkpKTtcbiAgICAgICAgICBycS5pbml0KCk7XG4gICAgICAgICAgcnEub24uYXBwbHkocnEsIGFyZ3MpO1xuICAgICAgICB9LmJpbmQodGhpcykpXG4gICAgICB9KTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIE9ubHkgdXNlZCBpbiB0ZXN0aW5nIGF0IHRoZSBtb21lbnQuXG4gICAgICogQHBhcmFtIHF1ZXJ5XG4gICAgICogQHJldHVybnMge1JlYWN0aXZlUXVlcnl9XG4gICAgICovXG4gICAgX3JlYWN0aXZlUXVlcnk6IGZ1bmN0aW9uKHF1ZXJ5KSB7XG4gICAgICByZXR1cm4gbmV3IFJlYWN0aXZlUXVlcnkobmV3IFF1ZXJ5KHRoaXMsIHF1ZXJ5IHx8IHt9KSk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBPbmx5IHVzZWQgaW4gdGhlIHRlc3RpbmcgYXQgdGhlIG1vbWVudC5cbiAgICAgKiBAcGFyYW0gcXVlcnlcbiAgICAgKiBAcmV0dXJucyB7QXJyYW5nZWRSZWFjdGl2ZVF1ZXJ5fVxuICAgICAqL1xuICAgIF9hcnJhbmdlZFJlYWN0aXZlUXVlcnk6IGZ1bmN0aW9uKHF1ZXJ5KSB7XG4gICAgICByZXR1cm4gbmV3IEFycmFuZ2VkUmVhY3RpdmVRdWVyeShuZXcgUXVlcnkodGhpcywgcXVlcnkgfHwge30pKTtcbiAgICB9LFxuICAgIG9uZTogZnVuY3Rpb24ob3B0cywgY2IpIHtcbiAgICAgIGlmICh0eXBlb2Ygb3B0cyA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGNiID0gb3B0cztcbiAgICAgICAgb3B0cyA9IHt9O1xuICAgICAgfVxuICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgICAgdGhpcy5xdWVyeShvcHRzLCBmdW5jdGlvbihlcnIsIHJlcykge1xuICAgICAgICAgIGlmIChlcnIpIGNiKGVycik7XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBpZiAocmVzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgY2IoZXJyb3IoJ01vcmUgdGhhbiBvbmUgaW5zdGFuY2UgcmV0dXJuZWQgd2hlbiBleGVjdXRpbmcgZ2V0IHF1ZXJ5IScpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICByZXMgPSByZXMubGVuZ3RoID8gcmVzWzBdIDogbnVsbDtcbiAgICAgICAgICAgICAgY2IobnVsbCwgcmVzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9LFxuICAgIGFsbDogZnVuY3Rpb24ocSwgY2IpIHtcbiAgICAgIGlmICh0eXBlb2YgcSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGNiID0gcTtcbiAgICAgICAgcSA9IHt9O1xuICAgICAgfVxuICAgICAgcSA9IHEgfHwge307XG4gICAgICB2YXIgcXVlcnkgPSB7fTtcbiAgICAgIGlmIChxLl9fb3JkZXIpIHF1ZXJ5Ll9fb3JkZXIgPSBxLl9fb3JkZXI7XG4gICAgICByZXR1cm4gdGhpcy5xdWVyeShxLCBjYik7XG4gICAgfSxcbiAgICBfYXR0cmlidXRlRGVmaW5pdGlvbldpdGhOYW1lOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuYXR0cmlidXRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgYXR0cmlidXRlRGVmaW5pdGlvbiA9IHRoaXMuYXR0cmlidXRlc1tpXTtcbiAgICAgICAgaWYgKGF0dHJpYnV0ZURlZmluaXRpb24ubmFtZSA9PSBuYW1lKSByZXR1cm4gYXR0cmlidXRlRGVmaW5pdGlvbjtcbiAgICAgIH1cbiAgICB9LFxuICAgIGluc3RhbGw6IGZ1bmN0aW9uKGNiKSB7XG4gICAgICBsb2coJ0luc3RhbGxpbmcgbWFwcGluZyAnICsgdGhpcy5uYW1lKTtcbiAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICAgIGlmICghdGhpcy5faW5zdGFsbGVkKSB7XG4gICAgICAgICAgdGhpcy5faW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgICBjYigpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNb2RlbCBcIicgKyB0aGlzLm5hbWUgKyAnXCIgaGFzIGFscmVhZHkgYmVlbiBpbnN0YWxsZWQnKTtcbiAgICAgICAgfVxuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIE1hcCBkYXRhIGludG8gU2llc3RhLlxuICAgICAqXG4gICAgICogQHBhcmFtIGRhdGEgUmF3IGRhdGEgcmVjZWl2ZWQgcmVtb3RlbHkgb3Igb3RoZXJ3aXNlXG4gICAgICogQHBhcmFtIHtmdW5jdGlvbnxvYmplY3R9IFtvcHRzXVxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gb3B0cy5vdmVycmlkZVxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gb3B0cy5faWdub3JlSW5zdGFsbGVkIC0gQSBoYWNrIHRoYXQgYWxsb3dzIG1hcHBpbmcgb250byBNb2RlbHMgZXZlbiBpZiBpbnN0YWxsIHByb2Nlc3MgaGFzIG5vdCBmaW5pc2hlZC5cbiAgICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBbY2JdIENhbGxlZCBvbmNlIHBvdWNoIHBlcnNpc3RlbmNlIHJldHVybnMuXG4gICAgICovXG4gICAgZ3JhcGg6IGZ1bmN0aW9uKGRhdGEsIG9wdHMsIGNiKSB7XG4gICAgICBpZiAodHlwZW9mIG9wdHMgPT0gJ2Z1bmN0aW9uJykgY2IgPSBvcHRzO1xuICAgICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgICB2YXIgX21hcCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBvdmVycmlkZXMgPSBvcHRzLm92ZXJyaWRlO1xuICAgICAgICAgIGlmIChvdmVycmlkZXMpIHtcbiAgICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkob3ZlcnJpZGVzKSkgb3B0cy5vYmplY3RzID0gb3ZlcnJpZGVzO1xuICAgICAgICAgICAgZWxzZSBvcHRzLm9iamVjdHMgPSBbb3ZlcnJpZGVzXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZGVsZXRlIG9wdHMub3ZlcnJpZGU7XG4gICAgICAgICAgaWYgKHV0aWwuaXNBcnJheShkYXRhKSkge1xuICAgICAgICAgICAgdGhpcy5fbWFwQnVsayhkYXRhLCBvcHRzLCBjYik7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX21hcEJ1bGsoW2RhdGFdLCBvcHRzLCBmdW5jdGlvbihlcnIsIG9iamVjdHMpIHtcbiAgICAgICAgICAgICAgdmFyIG9iajtcbiAgICAgICAgICAgICAgaWYgKG9iamVjdHMpIHtcbiAgICAgICAgICAgICAgICBpZiAob2JqZWN0cy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgIG9iaiA9IG9iamVjdHNbMF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGVyciA9IGVyciA/ICh1dGlsLmlzQXJyYXkoZGF0YSkgPyBlcnIgOiAodXRpbC5pc0FycmF5KGVycikgPyBlcnJbMF0gOiBlcnIpKSA6IG51bGw7XG4gICAgICAgICAgICAgIGNiKGVyciwgb2JqKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICBpZiAob3B0cy5faWdub3JlSW5zdGFsbGVkKSB7XG4gICAgICAgICAgX21hcCgpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Ugc2llc3RhLl9hZnRlckluc3RhbGwoX21hcCk7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH0sXG4gICAgX21hcEJ1bGs6IGZ1bmN0aW9uKGRhdGEsIG9wdHMsIGNhbGxiYWNrKSB7XG4gICAgICBfLmV4dGVuZChvcHRzLCB7bW9kZWw6IHRoaXMsIGRhdGE6IGRhdGF9KTtcbiAgICAgIHZhciBvcCA9IG5ldyBNYXBwaW5nT3BlcmF0aW9uKG9wdHMpO1xuICAgICAgb3Auc3RhcnQoZnVuY3Rpb24oZXJyLCBvYmplY3RzKSB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGVycik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY2FsbGJhY2sobnVsbCwgb2JqZWN0cyB8fCBbXSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0sXG4gICAgX2NvdW50Q2FjaGU6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGNvbGxDYWNoZSA9IGNhY2hlLl9sb2NhbENhY2hlQnlUeXBlW3RoaXMuY29sbGVjdGlvbk5hbWVdIHx8IHt9O1xuICAgICAgdmFyIG1vZGVsQ2FjaGUgPSBjb2xsQ2FjaGVbdGhpcy5uYW1lXSB8fCB7fTtcbiAgICAgIHJldHVybiBfLnJlZHVjZShPYmplY3Qua2V5cyhtb2RlbENhY2hlKSwgZnVuY3Rpb24obSwgbG9jYWxJZCkge1xuICAgICAgICBtW2xvY2FsSWRdID0ge307XG4gICAgICAgIHJldHVybiBtO1xuICAgICAgfSwge30pO1xuICAgIH0sXG4gICAgY291bnQ6IGZ1bmN0aW9uKGNiKSB7XG4gICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgICBjYihudWxsLCBPYmplY3Qua2V5cyh0aGlzLl9jb3VudENhY2hlKCkpLmxlbmd0aCk7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH0sXG4gICAgX2R1bXA6IGZ1bmN0aW9uKGFzSlNPTikge1xuICAgICAgdmFyIGR1bXBlZCA9IHt9O1xuICAgICAgZHVtcGVkLm5hbWUgPSB0aGlzLm5hbWU7XG4gICAgICBkdW1wZWQuYXR0cmlidXRlcyA9IHRoaXMuYXR0cmlidXRlcztcbiAgICAgIGR1bXBlZC5pZCA9IHRoaXMuaWQ7XG4gICAgICBkdW1wZWQuY29sbGVjdGlvbiA9IHRoaXMuY29sbGVjdGlvbk5hbWU7XG4gICAgICBkdW1wZWQucmVsYXRpb25zaGlwcyA9IF8ubWFwKHRoaXMucmVsYXRpb25zaGlwcywgZnVuY3Rpb24ocikge1xuICAgICAgICByZXR1cm4gci5pc0ZvcndhcmQgPyByLmZvcndhcmROYW1lIDogci5yZXZlcnNlTmFtZTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIGFzSlNPTiA/IHV0aWwucHJldHR5UHJpbnQoZHVtcGVkKSA6IGR1bXBlZDtcbiAgICB9LFxuICAgIHRvU3RyaW5nOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiAnTW9kZWxbJyArIHRoaXMubmFtZSArICddJztcbiAgICB9LFxuICAgIHJlbW92ZUFsbDogZnVuY3Rpb24oY2IpIHtcbiAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICAgIHRoaXMuYWxsKClcbiAgICAgICAgICAudGhlbihmdW5jdGlvbihpbnN0YW5jZXMpIHtcbiAgICAgICAgICAgIGluc3RhbmNlcy5yZW1vdmUoKTtcbiAgICAgICAgICAgIGNiKCk7XG4gICAgICAgICAgfSlcbiAgICAgICAgICAuY2F0Y2goY2IpO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG5cbiAgfSk7XG5cbiAgLy8gU3ViY2xhc3NpbmdcbiAgXy5leHRlbmQoTW9kZWwucHJvdG90eXBlLCB7XG4gICAgY2hpbGQ6IGZ1bmN0aW9uKG5hbWVPck9wdHMsIG9wdHMpIHtcbiAgICAgIGlmICh0eXBlb2YgbmFtZU9yT3B0cyA9PSAnc3RyaW5nJykge1xuICAgICAgICBvcHRzLm5hbWUgPSBuYW1lT3JPcHRzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3B0cyA9IG5hbWU7XG4gICAgICB9XG4gICAgICBfLmV4dGVuZChvcHRzLCB7XG4gICAgICAgIGF0dHJpYnV0ZXM6IEFycmF5LnByb3RvdHlwZS5jb25jYXQuY2FsbChvcHRzLmF0dHJpYnV0ZXMgfHwgW10sIHRoaXMuX29wdHMuYXR0cmlidXRlcyksXG4gICAgICAgIHJlbGF0aW9uc2hpcHM6IF8uZXh0ZW5kKG9wdHMucmVsYXRpb25zaGlwcyB8fCB7fSwgdGhpcy5fb3B0cy5yZWxhdGlvbnNoaXBzKSxcbiAgICAgICAgbWV0aG9kczogXy5leHRlbmQoXy5leHRlbmQoe30sIHRoaXMuX29wdHMubWV0aG9kcykgfHwge30sIG9wdHMubWV0aG9kcyksXG4gICAgICAgIHN0YXRpY3M6IF8uZXh0ZW5kKF8uZXh0ZW5kKHt9LCB0aGlzLl9vcHRzLnN0YXRpY3MpIHx8IHt9LCBvcHRzLnN0YXRpY3MpLFxuICAgICAgICBwcm9wZXJ0aWVzOiBfLmV4dGVuZChfLmV4dGVuZCh7fSwgdGhpcy5fb3B0cy5wcm9wZXJ0aWVzKSB8fCB7fSwgb3B0cy5wcm9wZXJ0aWVzKSxcbiAgICAgICAgaWQ6IG9wdHMuaWQgfHwgdGhpcy5fb3B0cy5pZCxcbiAgICAgICAgaW5pdDogb3B0cy5pbml0IHx8IHRoaXMuX29wdHMuaW5pdCxcbiAgICAgICAgcmVtb3ZlOiBvcHRzLnJlbW92ZSB8fCB0aGlzLl9vcHRzLnJlbW92ZSxcbiAgICAgICAgc2VyaWFsaXNlOiBvcHRzLnNlcmlhbGlzZSB8fCB0aGlzLl9vcHRzLnNlcmlhbGlzZSxcbiAgICAgICAgc2VyaWFsaXNlRmllbGQ6IG9wdHMuc2VyaWFsaXNlRmllbGQgfHwgdGhpcy5fb3B0cy5zZXJpYWxpc2VGaWVsZCxcbiAgICAgICAgcGFyc2VBdHRyaWJ1dGU6IG9wdHMucGFyc2VBdHRyaWJ1dGUgfHwgdGhpcy5fb3B0cy5wYXJzZUF0dHJpYnV0ZSxcbiAgICAgICAgc3RvcmU6IG9wdHMuc3RvcmUgPT0gdW5kZWZpbmVkID8gdGhpcy5fb3B0cy5zdG9yZSA6IG9wdHMuc3RvcmVcbiAgICAgIH0pO1xuXG4gICAgICBpZiAodGhpcy5fb3B0cy5zZXJpYWxpc2FibGVGaWVsZHMpIHtcbiAgICAgICAgb3B0cy5zZXJpYWxpc2FibGVGaWVsZHMgPSBBcnJheS5wcm90b3R5cGUuY29uY2F0LmFwcGx5KG9wdHMuc2VyaWFsaXNhYmxlRmllbGRzIHx8IFtdLCB0aGlzLl9vcHRzLnNlcmlhbGlzYWJsZUZpZWxkcyk7XG4gICAgICB9XG5cbiAgICAgIHZhciBtb2RlbCA9IHRoaXMuY29sbGVjdGlvbi5tb2RlbChvcHRzLm5hbWUsIG9wdHMpO1xuICAgICAgbW9kZWwucGFyZW50ID0gdGhpcztcbiAgICAgIHRoaXMuY2hpbGRyZW4ucHVzaChtb2RlbCk7XG4gICAgICByZXR1cm4gbW9kZWw7XG4gICAgfSxcbiAgICBpc0NoaWxkT2Y6IGZ1bmN0aW9uKHBhcmVudCkge1xuICAgICAgcmV0dXJuIHRoaXMucGFyZW50ID09IHBhcmVudDtcbiAgICB9LFxuICAgIGlzUGFyZW50T2Y6IGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgICByZXR1cm4gdGhpcy5jaGlsZHJlbi5pbmRleE9mKGNoaWxkKSA+IC0xO1xuICAgIH0sXG4gICAgaXNEZXNjZW5kYW50T2Y6IGZ1bmN0aW9uKGFuY2VzdG9yKSB7XG4gICAgICB2YXIgcGFyZW50ID0gdGhpcy5wYXJlbnQ7XG4gICAgICB3aGlsZSAocGFyZW50KSB7XG4gICAgICAgIGlmIChwYXJlbnQgPT0gYW5jZXN0b3IpIHJldHVybiB0cnVlO1xuICAgICAgICBwYXJlbnQgPSBwYXJlbnQucGFyZW50O1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0sXG4gICAgaXNBbmNlc3Rvck9mOiBmdW5jdGlvbihkZXNjZW5kYW50KSB7XG4gICAgICByZXR1cm4gdGhpcy5kZXNjZW5kYW50cy5pbmRleE9mKGRlc2NlbmRhbnQpID4gLTE7XG4gICAgfSxcbiAgICBoYXNBdHRyaWJ1dGVOYW1lZDogZnVuY3Rpb24oYXR0cmlidXRlTmFtZSkge1xuICAgICAgcmV0dXJuIHRoaXMuX2F0dHJpYnV0ZU5hbWVzLmluZGV4T2YoYXR0cmlidXRlTmFtZSkgPiAtMTtcbiAgICB9XG4gIH0pO1xuXG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBNb2RlbDtcblxufSkoKTtcbiIsIihmdW5jdGlvbigpIHtcbiAgdmFyIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgIGxvZyA9IHJlcXVpcmUoJy4vbG9nJykoJ2V2ZW50cycpLFxuICAgIGV4dGVuZCA9IHJlcXVpcmUoJy4vdXRpbCcpLl8uZXh0ZW5kLFxuICAgIGNvbGxlY3Rpb25SZWdpc3RyeSA9IHJlcXVpcmUoJy4vY29sbGVjdGlvblJlZ2lzdHJ5JykuQ29sbGVjdGlvblJlZ2lzdHJ5O1xuXG5cbiAgLyoqXG4gICAqIENvbnN0YW50cyB0aGF0IGRlc2NyaWJlIGNoYW5nZSBldmVudHMuXG4gICAqIFNldCA9PiBBIG5ldyB2YWx1ZSBpcyBhc3NpZ25lZCB0byBhbiBhdHRyaWJ1dGUvcmVsYXRpb25zaGlwXG4gICAqIFNwbGljZSA9PiBBbGwgamF2YXNjcmlwdCBhcnJheSBvcGVyYXRpb25zIGFyZSBkZXNjcmliZWQgYXMgc3BsaWNlcy5cbiAgICogRGVsZXRlID0+IFVzZWQgaW4gdGhlIGNhc2Ugd2hlcmUgb2JqZWN0cyBhcmUgcmVtb3ZlZCBmcm9tIGFuIGFycmF5LCBidXQgYXJyYXkgb3JkZXIgaXMgbm90IGtub3duIGluIGFkdmFuY2UuXG4gICAqIFJlbW92ZSA9PiBPYmplY3QgZGVsZXRpb24gZXZlbnRzXG4gICAqIE5ldyA9PiBPYmplY3QgY3JlYXRpb24gZXZlbnRzXG4gICAqIEB0eXBlIHtPYmplY3R9XG4gICAqL1xuICB2YXIgTW9kZWxFdmVudFR5cGUgPSB7XG4gICAgU2V0OiAnc2V0JyxcbiAgICBTcGxpY2U6ICdzcGxpY2UnLFxuICAgIE5ldzogJ25ldycsXG4gICAgUmVtb3ZlOiAncmVtb3ZlJ1xuICB9O1xuXG4gIC8qKlxuICAgKiBSZXByZXNlbnRzIGFuIGluZGl2aWR1YWwgY2hhbmdlLlxuICAgKiBAcGFyYW0gb3B0c1xuICAgKiBAY29uc3RydWN0b3JcbiAgICovXG4gIGZ1bmN0aW9uIE1vZGVsRXZlbnQob3B0cykge1xuICAgIHRoaXMuX29wdHMgPSBvcHRzIHx8IHt9O1xuICAgIE9iamVjdC5rZXlzKG9wdHMpLmZvckVhY2goZnVuY3Rpb24oaykge1xuICAgICAgdGhpc1trXSA9IG9wdHNba107XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfVxuXG5cbiAgTW9kZWxFdmVudC5wcm90b3R5cGUuX2R1bXAgPSBmdW5jdGlvbihwcmV0dHkpIHtcbiAgICB2YXIgZHVtcGVkID0ge307XG4gICAgZHVtcGVkLmNvbGxlY3Rpb24gPSAodHlwZW9mIHRoaXMuY29sbGVjdGlvbikgPT0gJ3N0cmluZycgPyB0aGlzLmNvbGxlY3Rpb24gOiB0aGlzLmNvbGxlY3Rpb24uX2R1bXAoKTtcbiAgICBkdW1wZWQubW9kZWwgPSAodHlwZW9mIHRoaXMubW9kZWwpID09ICdzdHJpbmcnID8gdGhpcy5tb2RlbCA6IHRoaXMubW9kZWwubmFtZTtcbiAgICBkdW1wZWQubG9jYWxJZCA9IHRoaXMubG9jYWxJZDtcbiAgICBkdW1wZWQuZmllbGQgPSB0aGlzLmZpZWxkO1xuICAgIGR1bXBlZC50eXBlID0gdGhpcy50eXBlO1xuICAgIGlmICh0aGlzLmluZGV4KSBkdW1wZWQuaW5kZXggPSB0aGlzLmluZGV4O1xuICAgIGlmICh0aGlzLmFkZGVkKSBkdW1wZWQuYWRkZWQgPSBfLm1hcCh0aGlzLmFkZGVkLCBmdW5jdGlvbih4KSB7cmV0dXJuIHguX2R1bXAoKX0pO1xuICAgIGlmICh0aGlzLnJlbW92ZWQpIGR1bXBlZC5yZW1vdmVkID0gXy5tYXAodGhpcy5yZW1vdmVkLCBmdW5jdGlvbih4KSB7cmV0dXJuIHguX2R1bXAoKX0pO1xuICAgIGlmICh0aGlzLm9sZCkgZHVtcGVkLm9sZCA9IHRoaXMub2xkO1xuICAgIGlmICh0aGlzLm5ldykgZHVtcGVkLm5ldyA9IHRoaXMubmV3O1xuICAgIHJldHVybiBwcmV0dHkgPyB1dGlsLnByZXR0eVByaW50KGR1bXBlZCkgOiBkdW1wZWQ7XG4gIH07XG5cbiAgZnVuY3Rpb24gcHJldHR5Q2hhbmdlKGMpIHtcbiAgICBpZiAoYy50eXBlID09IE1vZGVsRXZlbnRUeXBlLlNldCkge1xuICAgICAgcmV0dXJuIGMubW9kZWwgKyAnWycgKyBjLmxvY2FsSWQgKyAnXS4nICsgYy5maWVsZCArICcgPSAnICsgYy5uZXc7XG4gICAgfVxuICAgIGVsc2UgaWYgKGMudHlwZSA9PSBNb2RlbEV2ZW50VHlwZS5TcGxpY2UpIHtcblxuICAgIH1cbiAgICBlbHNlIGlmIChjLnR5cGUgPT0gTW9kZWxFdmVudFR5cGUuTmV3KSB7XG5cbiAgICB9XG4gICAgZWxzZSBpZiAoYy50eXBlID09IE1vZGVsRXZlbnRUeXBlLlJlbW92ZSkge1xuXG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEJyb2FkY2FzXG4gICAqIEBwYXJhbSAge1N0cmluZ30gY29sbGVjdGlvbk5hbWVcbiAgICogQHBhcmFtICB7U3RyaW5nfSBtb2RlbE5hbWVcbiAgICogQHBhcmFtICB7T2JqZWN0fSBjIGFuIG9wdGlvbnMgZGljdGlvbmFyeSByZXByZXNlbnRpbmcgdGhlIGNoYW5nZVxuICAgKiBAcmV0dXJuIHtbdHlwZV19XG4gICAqL1xuICBmdW5jdGlvbiBicm9hZGNhc3RFdmVudChjb2xsZWN0aW9uTmFtZSwgbW9kZWxOYW1lLCBjKSB7XG4gICAgbG9nKCdTZW5kaW5nIG5vdGlmaWNhdGlvbiBcIicgKyBjb2xsZWN0aW9uTmFtZSArICdcIiBvZiB0eXBlICcgKyBjLnR5cGUsIGMpO1xuICAgIGV2ZW50cy5lbWl0KGNvbGxlY3Rpb25OYW1lLCBjKTtcbiAgICB2YXIgbW9kZWxOb3RpZiA9IGNvbGxlY3Rpb25OYW1lICsgJzonICsgbW9kZWxOYW1lO1xuICAgIGxvZygnU2VuZGluZyBub3RpZmljYXRpb24gXCInICsgbW9kZWxOb3RpZiArICdcIiBvZiB0eXBlICcgKyBjLnR5cGUsIGMpO1xuICAgIGV2ZW50cy5lbWl0KG1vZGVsTm90aWYsIGMpO1xuICAgIHZhciBnZW5lcmljTm90aWYgPSAnU2llc3RhJztcbiAgICBsb2coJ1NlbmRpbmcgbm90aWZpY2F0aW9uIFwiJyArIGdlbmVyaWNOb3RpZiArICdcIiBvZiB0eXBlICcgKyBjLnR5cGUsIGMpO1xuICAgIGV2ZW50cy5lbWl0KGdlbmVyaWNOb3RpZiwgYyk7XG4gICAgdmFyIGxvY2FsSWROb3RpZiA9IGMubG9jYWxJZDtcbiAgICBsb2coJ1NlbmRpbmcgbm90aWZpY2F0aW9uIFwiJyArIGxvY2FsSWROb3RpZiArICdcIiBvZiB0eXBlICcgKyBjLnR5cGUsIGMpO1xuICAgIGV2ZW50cy5lbWl0KGxvY2FsSWROb3RpZiwgYyk7XG4gICAgdmFyIGNvbGxlY3Rpb24gPSBjb2xsZWN0aW9uUmVnaXN0cnlbY29sbGVjdGlvbk5hbWVdO1xuICAgIHZhciBlcnI7XG4gICAgaWYgKCFjb2xsZWN0aW9uKSB7XG4gICAgICBlcnIgPSAnTm8gc3VjaCBjb2xsZWN0aW9uIFwiJyArIGNvbGxlY3Rpb25OYW1lICsgJ1wiJztcbiAgICAgIGxvZyhlcnIsIGNvbGxlY3Rpb25SZWdpc3RyeSk7XG4gICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihlcnIpO1xuICAgIH1cbiAgICB2YXIgbW9kZWwgPSBjb2xsZWN0aW9uW21vZGVsTmFtZV07XG4gICAgaWYgKCFtb2RlbCkge1xuICAgICAgZXJyID0gJ05vIHN1Y2ggbW9kZWwgXCInICsgbW9kZWxOYW1lICsgJ1wiJztcbiAgICAgIGxvZyhlcnIsIGNvbGxlY3Rpb25SZWdpc3RyeSk7XG4gICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihlcnIpO1xuICAgIH1cbiAgICBpZiAobW9kZWwuaWQgJiYgYy5vYmpbbW9kZWwuaWRdKSB7XG4gICAgICB2YXIgcmVtb3RlSWROb3RpZiA9IGNvbGxlY3Rpb25OYW1lICsgJzonICsgbW9kZWxOYW1lICsgJzonICsgYy5vYmpbbW9kZWwuaWRdO1xuICAgICAgbG9nKCdTZW5kaW5nIG5vdGlmaWNhdGlvbiBcIicgKyByZW1vdGVJZE5vdGlmICsgJ1wiIG9mIHR5cGUgJyArIGMudHlwZSk7XG4gICAgICBldmVudHMuZW1pdChyZW1vdGVJZE5vdGlmLCBjKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiB2YWxpZGF0ZUV2ZW50T3B0cyhvcHRzKSB7XG4gICAgaWYgKCFvcHRzLm1vZGVsKSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTXVzdCBwYXNzIGEgbW9kZWwnKTtcbiAgICBpZiAoIW9wdHMuY29sbGVjdGlvbikgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ011c3QgcGFzcyBhIGNvbGxlY3Rpb24nKTtcbiAgICBpZiAoIW9wdHMubG9jYWxJZCkgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ011c3QgcGFzcyBhIGxvY2FsIGlkZW50aWZpZXInKTtcbiAgICBpZiAoIW9wdHMub2JqKSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTXVzdCBwYXNzIHRoZSBvYmplY3QnKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGVtaXQob3B0cykge1xuICAgIHZhbGlkYXRlRXZlbnRPcHRzKG9wdHMpO1xuICAgIHZhciBjb2xsZWN0aW9uID0gb3B0cy5jb2xsZWN0aW9uO1xuICAgIHZhciBtb2RlbCA9IG9wdHMubW9kZWw7XG4gICAgdmFyIGMgPSBuZXcgTW9kZWxFdmVudChvcHRzKTtcbiAgICBicm9hZGNhc3RFdmVudChjb2xsZWN0aW9uLCBtb2RlbCwgYyk7XG4gICAgcmV0dXJuIGM7XG4gIH1cblxuICBleHRlbmQoZXhwb3J0cywge1xuICAgIE1vZGVsRXZlbnQ6IE1vZGVsRXZlbnQsXG4gICAgZW1pdDogZW1pdCxcbiAgICB2YWxpZGF0ZUV2ZW50T3B0czogdmFsaWRhdGVFdmVudE9wdHMsXG4gICAgTW9kZWxFdmVudFR5cGU6IE1vZGVsRXZlbnRUeXBlXG4gIH0pO1xufSkoKTsiLCIvKipcbiAqIFRoZSBcInN0b3JlXCIgaXMgcmVzcG9uc2libGUgZm9yIG1lZGlhdGluZyBiZXR3ZWVuIHRoZSBpbi1tZW1vcnkgY2FjaGUgYW5kIGFueSBwZXJzaXN0ZW50IHN0b3JhZ2UuXG4gKiBOb3RlIHRoYXQgcGVyc2lzdGVudCBzdG9yYWdlIGhhcyBub3QgYmVlbiBwcm9wZXJseSBpbXBsZW1lbnRlZCB5ZXQgYW5kIHNvIHRoaXMgaXMgcHJldHR5IHVzZWxlc3MuXG4gKiBBbGwgcXVlcmllcyB3aWxsIGdvIHN0cmFpZ2h0IHRvIHRoZSBjYWNoZSBpbnN0ZWFkLlxuICogQG1vZHVsZSBzdG9yZVxuICovXG5cblxuKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICAgICAgICBsb2cgPSByZXF1aXJlKCcuL2xvZycpKCdzdG9yZScpLFxuICAgICAgICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gICAgICAgIF8gPSB1dGlsLl8sXG4gICAgICAgIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpO1xuXG5cbiAgICBmdW5jdGlvbiBnZXQob3B0cywgY2IpIHtcbiAgICAgICAgbG9nKCdnZXQnLCBvcHRzKTtcbiAgICAgICAgdmFyIHNpZXN0YU1vZGVsO1xuICAgICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgICAgIGlmIChvcHRzLmxvY2FsSWQpIHtcbiAgICAgICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KG9wdHMubG9jYWxJZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gUHJveHkgb250byBnZXRNdWx0aXBsZSBpbnN0ZWFkLlxuICAgICAgICAgICAgICAgICAgICBnZXRNdWx0aXBsZShfLm1hcChvcHRzLmxvY2FsSWQsIGZ1bmN0aW9uIChpZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2NhbElkOiBpZFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KSwgY2IpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHNpZXN0YU1vZGVsID0gY2FjaGUuZ2V0KG9wdHMpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2llc3RhTW9kZWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsb2cuZW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2coJ0hhZCBjYWNoZWQgb2JqZWN0Jywge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRzOiBvcHRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmo6IHNpZXN0YU1vZGVsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2IpIGNiKG51bGwsIHNpZXN0YU1vZGVsKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkob3B0cy5sb2NhbElkKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFByb3h5IG9udG8gZ2V0TXVsdGlwbGUgaW5zdGVhZC5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBnZXRNdWx0aXBsZShfLm1hcChvcHRzLmxvY2FsSWQsIGZ1bmN0aW9uIChpZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9jYWxJZDogaWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pLCBjYik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGNiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHN0b3JhZ2UgPSBzaWVzdGEuZXh0LnN0b3JhZ2U7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHN0b3JhZ2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RvcmFnZS5zdG9yZS5nZXRGcm9tUG91Y2gob3B0cywgY2IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignU3RvcmFnZSBtb2R1bGUgbm90IGluc3RhbGxlZCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAob3B0cy5tb2RlbCkge1xuICAgICAgICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkob3B0c1tvcHRzLm1vZGVsLmlkXSkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gUHJveHkgb250byBnZXRNdWx0aXBsZSBpbnN0ZWFkLlxuICAgICAgICAgICAgICAgICAgICBnZXRNdWx0aXBsZShfLm1hcChvcHRzW29wdHMubW9kZWwuaWRdLCBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBvID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICBvW29wdHMubW9kZWwuaWRdID0gaWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBvLm1vZGVsID0gb3B0cy5tb2RlbDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBvXG4gICAgICAgICAgICAgICAgICAgIH0pLCBjYik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgc2llc3RhTW9kZWwgPSBjYWNoZS5nZXQob3B0cyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzaWVzdGFNb2RlbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxvZy5lbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZygnSGFkIGNhY2hlZCBvYmplY3QnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdHM6IG9wdHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iajogc2llc3RhTW9kZWxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjYikgY2IobnVsbCwgc2llc3RhTW9kZWwpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG1vZGVsID0gb3B0cy5tb2RlbDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChtb2RlbC5zaW5nbGV0b24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtb2RlbC5vbmUoY2IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgaWRGaWVsZCA9IG1vZGVsLmlkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBpZCA9IG9wdHNbaWRGaWVsZF07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG9uZU9wdHMgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbmVPcHRzW2lkRmllbGRdID0gaWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsLm9uZShvbmVPcHRzLCBmdW5jdGlvbiAoZXJyLCBvYmopIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9iaikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYihudWxsLCBvYmopO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNiKG51bGwsIG51bGwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2IoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ0ludmFsaWQgb3B0aW9ucyBnaXZlbiB0byBzdG9yZS4gTWlzc2luZyBcIicgKyBpZEZpZWxkLnRvU3RyaW5nKCkgKyAnLlwiJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIE5vIHdheSBpbiB3aGljaCB0byBmaW5kIGFuIG9iamVjdCBsb2NhbGx5LlxuICAgICAgICAgICAgICAgIHZhciBjb250ZXh0ID0ge1xuICAgICAgICAgICAgICAgICAgICBvcHRzOiBvcHRzXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB2YXIgbXNnID0gJ0ludmFsaWQgb3B0aW9ucyBnaXZlbiB0byBzdG9yZSc7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IobXNnLCBjb250ZXh0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRNdWx0aXBsZShvcHRzQXJyYXksIGNiKSB7XG4gICAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgdmFyIGRvY3MgPSBbXTtcbiAgICAgICAgICAgIHZhciBlcnJvcnMgPSBbXTtcbiAgICAgICAgICAgIF8uZWFjaChvcHRzQXJyYXksIGZ1bmN0aW9uIChvcHRzKSB7XG4gICAgICAgICAgICAgICAgZ2V0KG9wdHMsIGZ1bmN0aW9uIChlcnIsIGRvYykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlcnJvcnMucHVzaChlcnIpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgZG9jcy5wdXNoKGRvYyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKGRvY3MubGVuZ3RoICsgZXJyb3JzLmxlbmd0aCA9PSBvcHRzQXJyYXkubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYihlcnJvcnMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNiKG51bGwsIGRvY3MpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXNlcyBwb3VjaCBidWxrIGZldGNoIEFQSS4gTXVjaCBmYXN0ZXIgdGhhbiBnZXRNdWx0aXBsZS5cbiAgICAgKiBAcGFyYW0gbG9jYWxJZGVudGlmaWVyc1xuICAgICAqIEBwYXJhbSBjYlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGdldE11bHRpcGxlTG9jYWwobG9jYWxJZGVudGlmaWVycywgY2IpIHtcbiAgICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICB2YXIgcmVzdWx0cyA9IF8ucmVkdWNlKGxvY2FsSWRlbnRpZmllcnMsIGZ1bmN0aW9uIChtZW1vLCBsb2NhbElkKSB7XG4gICAgICAgICAgICAgICAgdmFyIG9iaiA9IGNhY2hlLmdldCh7XG4gICAgICAgICAgICAgICAgICAgIGxvY2FsSWQ6IGxvY2FsSWRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAob2JqKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lbW8uY2FjaGVkW2xvY2FsSWRdID0gb2JqO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG1lbW8ubm90Q2FjaGVkLnB1c2gobG9jYWxJZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICAgICAgfSwge1xuICAgICAgICAgICAgICAgIGNhY2hlZDoge30sXG4gICAgICAgICAgICAgICAgbm90Q2FjaGVkOiBbXVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGZ1bmN0aW9uIGZpbmlzaChlcnIpIHtcbiAgICAgICAgICAgICAgICBpZiAoY2IpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2IoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNiKG51bGwsIF8ubWFwKGxvY2FsSWRlbnRpZmllcnMsIGZ1bmN0aW9uIChsb2NhbElkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdHMuY2FjaGVkW2xvY2FsSWRdO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmaW5pc2goKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRNdWx0aXBsZVJlbW90ZShyZW1vdGVJZGVudGlmaWVycywgbW9kZWwsIGNiKSB7XG4gICAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uIChjYikge1xuICAgICAgICAgICAgdmFyIHJlc3VsdHMgPSBfLnJlZHVjZShyZW1vdGVJZGVudGlmaWVycywgZnVuY3Rpb24gKG1lbW8sIGlkKSB7XG4gICAgICAgICAgICAgICAgdmFyIGNhY2hlUXVlcnkgPSB7XG4gICAgICAgICAgICAgICAgICAgIG1vZGVsOiBtb2RlbFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgY2FjaGVRdWVyeVttb2RlbC5pZF0gPSBpZDtcbiAgICAgICAgICAgICAgICB2YXIgb2JqID0gY2FjaGUuZ2V0KGNhY2hlUXVlcnkpO1xuICAgICAgICAgICAgICAgIGlmIChvYmopIHtcbiAgICAgICAgICAgICAgICAgICAgbWVtby5jYWNoZWRbaWRdID0gb2JqO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG1lbW8ubm90Q2FjaGVkLnB1c2goaWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgICAgIH0sIHtcbiAgICAgICAgICAgICAgICBjYWNoZWQ6IHt9LFxuICAgICAgICAgICAgICAgIG5vdENhY2hlZDogW11cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBmdW5jdGlvbiBmaW5pc2goZXJyKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNiKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNiKGVycik7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYihudWxsLCBfLm1hcChyZW1vdGVJZGVudGlmaWVycywgZnVuY3Rpb24gKGlkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdHMuY2FjaGVkW2lkXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZmluaXNoKCk7XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfVxuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgICAgIGdldDogZ2V0LFxuICAgICAgICBnZXRNdWx0aXBsZTogZ2V0TXVsdGlwbGUsXG4gICAgICAgIGdldE11bHRpcGxlTG9jYWw6IGdldE11bHRpcGxlTG9jYWwsXG4gICAgICAgIGdldE11bHRpcGxlUmVtb3RlOiBnZXRNdWx0aXBsZVJlbW90ZVxuICAgIH07XG5cbn0pKCk7IiwiKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgbWlzYyA9IHJlcXVpcmUoJy4vbWlzYycpLFxuICAgICAgICBfID0gcmVxdWlyZSgnLi91bmRlcnNjb3JlJyk7XG5cbiAgICBmdW5jdGlvbiBkb1BhcmFsbGVsKGZuKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICAgICAgICByZXR1cm4gZm4uYXBwbHkobnVsbCwgW2VhY2hdLmNvbmNhdChhcmdzKSk7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgdmFyIG1hcCA9IGRvUGFyYWxsZWwoX2FzeW5jTWFwKTtcblxuICAgIHZhciByb290O1xuXG4gICAgZnVuY3Rpb24gX21hcChhcnIsIGl0ZXJhdG9yKSB7XG4gICAgICAgIGlmIChhcnIubWFwKSB7XG4gICAgICAgICAgICByZXR1cm4gYXJyLm1hcChpdGVyYXRvcik7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICAgICAgZWFjaChhcnIsIGZ1bmN0aW9uICh4LCBpLCBhKSB7XG4gICAgICAgICAgICByZXN1bHRzLnB1c2goaXRlcmF0b3IoeCwgaSwgYSkpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX2FzeW5jTWFwKGVhY2hmbiwgYXJyLCBpdGVyYXRvciwgY2FsbGJhY2spIHtcbiAgICAgICAgYXJyID0gX21hcChhcnIsIGZ1bmN0aW9uICh4LCBpKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGluZGV4OiBpLFxuICAgICAgICAgICAgICAgIHZhbHVlOiB4XG4gICAgICAgICAgICB9O1xuICAgICAgICB9KTtcbiAgICAgICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgICAgICAgZWFjaGZuKGFyciwgZnVuY3Rpb24gKHgsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgaXRlcmF0b3IoeC52YWx1ZSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgICAgICAgICAgZWFjaGZuKGFyciwgZnVuY3Rpb24gKHgsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgaXRlcmF0b3IoeC52YWx1ZSwgZnVuY3Rpb24gKGVyciwgdikge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRzW3guaW5kZXhdID0gdjtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIsIHJlc3VsdHMpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgbWFwU2VyaWVzID0gZG9TZXJpZXMoX2FzeW5jTWFwKTtcblxuICAgIGZ1bmN0aW9uIGRvU2VyaWVzKGZuKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICAgICAgICByZXR1cm4gZm4uYXBwbHkobnVsbCwgW2VhY2hTZXJpZXNdLmNvbmNhdChhcmdzKSk7XG4gICAgICAgIH07XG4gICAgfVxuXG5cbiAgICBmdW5jdGlvbiBlYWNoU2VyaWVzKGFyciwgaXRlcmF0b3IsIGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrID0gY2FsbGJhY2sgfHwgZnVuY3Rpb24gKCkge307XG4gICAgICAgIGlmICghYXJyLmxlbmd0aCkge1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKCk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGNvbXBsZXRlZCA9IDA7XG4gICAgICAgIHZhciBpdGVyYXRlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaXRlcmF0b3IoYXJyW2NvbXBsZXRlZF0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrID0gZnVuY3Rpb24gKCkge307XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29tcGxldGVkICs9IDE7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjb21wbGV0ZWQgPj0gYXJyLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGl0ZXJhdGUoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgICAgICBpdGVyYXRlKCk7XG4gICAgfVxuXG5cbiAgICBmdW5jdGlvbiBfZWFjaChhcnIsIGl0ZXJhdG9yKSB7XG4gICAgICAgIGlmIChhcnIuZm9yRWFjaCkge1xuICAgICAgICAgICAgcmV0dXJuIGFyci5mb3JFYWNoKGl0ZXJhdG9yKTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICAgICAgaXRlcmF0b3IoYXJyW2ldLCBpLCBhcnIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZWFjaChhcnIsIGl0ZXJhdG9yLCBjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjayA9IGNhbGxiYWNrIHx8IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICBpZiAoIWFyci5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjaygpO1xuICAgICAgICB9XG4gICAgICAgIHZhciBjb21wbGV0ZWQgPSAwO1xuICAgICAgICBfZWFjaChhcnIsIGZ1bmN0aW9uICh4KSB7XG4gICAgICAgICAgICBpdGVyYXRvcih4LCBvbmx5X29uY2UoZG9uZSkpO1xuICAgICAgICB9KTtcblxuICAgICAgICBmdW5jdGlvbiBkb25lKGVycikge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2sgPSBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29tcGxldGVkICs9IDE7XG4gICAgICAgICAgICAgICAgaWYgKGNvbXBsZXRlZCA+PSBhcnIubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG5cblxuXG4gICAgdmFyIF9wYXJhbGxlbCA9IGZ1bmN0aW9uIChlYWNoZm4sIHRhc2tzLCBjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjayA9IGNhbGxiYWNrIHx8IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICBpZiAobWlzYy5pc0FycmF5KHRhc2tzKSkge1xuICAgICAgICAgICAgZWFjaGZuLm1hcCh0YXNrcywgZnVuY3Rpb24gKGZuLCBjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIGlmIChmbikge1xuICAgICAgICAgICAgICAgICAgICBmbihmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYXJncy5sZW5ndGggPD0gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3MgPSBhcmdzWzBdO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2suY2FsbChudWxsLCBlcnIsIGFyZ3MpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LCBjYWxsYmFjayk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIgcmVzdWx0cyA9IHt9O1xuICAgICAgICAgICAgZWFjaGZuLmVhY2goT2JqZWN0LmtleXModGFza3MpLCBmdW5jdGlvbiAoaywgY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICB0YXNrc1trXShmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoIDw9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3MgPSBhcmdzWzBdO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdHNba10gPSBhcmdzO1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgcmVzdWx0cyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBmdW5jdGlvbiBzZXJpZXModGFza3MsIGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrID0gY2FsbGJhY2sgfHwgZnVuY3Rpb24gKCkge307XG4gICAgICAgIGlmIChtaXNjLmlzQXJyYXkodGFza3MpKSB7XG4gICAgICAgICAgICBtYXBTZXJpZXModGFza3MsIGZ1bmN0aW9uIChmbiwgY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBpZiAoZm4pIHtcbiAgICAgICAgICAgICAgICAgICAgZm4oZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoIDw9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcmdzID0gYXJnc1swXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrLmNhbGwobnVsbCwgZXJyLCBhcmdzKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSwgY2FsbGJhY2spO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIHJlc3VsdHMgPSB7fTtcbiAgICAgICAgICAgIGVhY2hTZXJpZXMoXy5rZXlzKHRhc2tzKSwgZnVuY3Rpb24gKGssIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgdGFza3Nba10oZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhcmdzLmxlbmd0aCA8PSAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhcmdzID0gYXJnc1swXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXN1bHRzW2tdID0gYXJncztcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIsIHJlc3VsdHMpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbmx5X29uY2UoZm4pIHtcbiAgICAgICAgdmFyIGNhbGxlZCA9IGZhbHNlO1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKGNhbGxlZCkgdGhyb3cgbmV3IEVycm9yKFwiQ2FsbGJhY2sgd2FzIGFscmVhZHkgY2FsbGVkLlwiKTtcbiAgICAgICAgICAgIGNhbGxlZCA9IHRydWU7XG4gICAgICAgICAgICBmbi5hcHBseShyb290LCBhcmd1bWVudHMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGFyYWxsZWwodGFza3MsIGNhbGxiYWNrKSB7XG4gICAgICAgIF9wYXJhbGxlbCh7XG4gICAgICAgICAgICBtYXA6IG1hcCxcbiAgICAgICAgICAgIGVhY2g6IGVhY2hcbiAgICAgICAgfSwgdGFza3MsIGNhbGxiYWNrKTtcbiAgICB9XG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IHtcbiAgICAgICAgc2VyaWVzOiBzZXJpZXMsXG4gICAgICAgIHBhcmFsbGVsOiBwYXJhbGxlbFxuICAgIH07XG59KSgpOyIsIi8qXG4gKiBUaGlzIGlzIGEgY29sbGVjdGlvbiBvZiB1dGlsaXRpZXMgdGFrZW4gZnJvbSBsaWJyYXJpZXMgc3VjaCBhcyBhc3luYy5qcywgdW5kZXJzY29yZS5qcyBldGMuXG4gKiBAbW9kdWxlIHV0aWxcbiAqL1xuXG4oZnVuY3Rpb24gKCkge1xuICAgIHZhciBfID0gcmVxdWlyZSgnLi91bmRlcnNjb3JlJyksXG4gICAgICAgIGFzeW5jID0gcmVxdWlyZSgnLi9hc3luYycpLFxuICAgICAgICBtaXNjID0gcmVxdWlyZSgnLi9taXNjJyk7XG5cbiAgICBfLmV4dGVuZChtb2R1bGUuZXhwb3J0cywge1xuICAgICAgICBfOiBfLFxuICAgICAgICBhc3luYzogYXN5bmNcbiAgICB9KTtcbiAgICBfLmV4dGVuZChtb2R1bGUuZXhwb3J0cywgbWlzYyk7XG5cbn0pKCk7IiwiKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgb2JzZXJ2ZSA9IHJlcXVpcmUoJy4uLy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuUGxhdGZvcm0sXG4gICAgICAgIF8gPSByZXF1aXJlKCcuL3VuZGVyc2NvcmUnKSxcbiAgICAgICAgUHJvbWlzZSA9IHJlcXVpcmUoJ2xpZScpLFxuICAgICAgICBhcmdzYXJyYXkgPSByZXF1aXJlKCdhcmdzYXJyYXknKSxcbiAgICAgICAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vLi4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yO1xuXG4gICAgLy8gVXNlZCBieSBwYXJhbU5hbWVzIGZ1bmN0aW9uLlxuICAgIHZhciBGTl9BUkdTID0gL15mdW5jdGlvblxccypbXlxcKF0qXFwoXFxzKihbXlxcKV0qKVxcKS9tLFxuICAgICAgICBGTl9BUkdfU1BMSVQgPSAvLC8sXG4gICAgICAgIEZOX0FSRyA9IC9eXFxzKihfPykoLis/KVxcMVxccyokLyxcbiAgICAgICAgU1RSSVBfQ09NTUVOVFMgPSAvKChcXC9cXC8uKiQpfChcXC9cXCpbXFxzXFxTXSo/XFwqXFwvKSkvbWc7XG5cbiAgICBmdW5jdGlvbiBjYihjYWxsYmFjaywgZGVmZXJyZWQpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2suYXBwbHkoY2FsbGJhY2ssIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICBpZiAoZGVmZXJyZWQpIHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZS5hcHBseShkZWZlcnJlZCwgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHZhciBpc0FycmF5U2hpbSA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgICAgIHJldHVybiBfLnRvU3RyaW5nLmNhbGwob2JqKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbiAgICAgICAgfSxcbiAgICAgICAgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgaXNBcnJheVNoaW0sXG4gICAgICAgIGlzU3RyaW5nID0gZnVuY3Rpb24gKG8pIHtcbiAgICAgICAgICAgIHJldHVybiB0eXBlb2YgbyA9PSAnc3RyaW5nJyB8fCBvIGluc3RhbmNlb2YgU3RyaW5nXG4gICAgICAgIH07XG4gICAgXy5leHRlbmQobW9kdWxlLmV4cG9ydHMsIHtcbiAgICAgICAgYXJnc2FycmF5OiBhcmdzYXJyYXksXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBQZXJmb3JtcyBkaXJ0eSBjaGVjay9PYmplY3Qub2JzZXJ2ZSBjYWxsYmFja3MgZGVwZW5kaW5nIG9uIHRoZSBicm93c2VyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBJZiBPYmplY3Qub2JzZXJ2ZSBpcyBwcmVzZW50LFxuICAgICAgICAgKiBAcGFyYW0gY2FsbGJhY2tcbiAgICAgICAgICovXG4gICAgICAgIG5leHQ6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICAgICAgb2JzZXJ2ZS5wZXJmb3JtTWljcm90YXNrQ2hlY2twb2ludCgpO1xuICAgICAgICAgICAgc2V0VGltZW91dChjYWxsYmFjayk7XG4gICAgICAgIH0sXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXR1cm5zIGEgaGFuZGxlciB0aGF0IGFjdHMgdXBvbiBhIGNhbGxiYWNrIG9yIGEgcHJvbWlzZSBkZXBlbmRpbmcgb24gdGhlIHJlc3VsdCBvZiBhIGRpZmZlcmVudCBjYWxsYmFjay5cbiAgICAgICAgICogQHBhcmFtIGNhbGxiYWNrXG4gICAgICAgICAqIEBwYXJhbSBbZGVmZXJyZWRdXG4gICAgICAgICAqIEByZXR1cm5zIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIGNiOiBjYixcbiAgICAgICAgZ3VpZDogKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGZ1bmN0aW9uIHM0KCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBNYXRoLmZsb29yKCgxICsgTWF0aC5yYW5kb20oKSkgKiAweDEwMDAwKVxuICAgICAgICAgICAgICAgICAgICAudG9TdHJpbmcoMTYpXG4gICAgICAgICAgICAgICAgICAgIC5zdWJzdHJpbmcoMSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHM0KCkgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArIHM0KCkgKyAnLScgK1xuICAgICAgICAgICAgICAgICAgICBzNCgpICsgJy0nICsgczQoKSArIHM0KCkgKyBzNCgpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfSkoKSxcbiAgICAgICAgYXNzZXJ0OiBmdW5jdGlvbiAoY29uZGl0aW9uLCBtZXNzYWdlLCBjb250ZXh0KSB7XG4gICAgICAgICAgICBpZiAoIWNvbmRpdGlvbikge1xuICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSBtZXNzYWdlIHx8IFwiQXNzZXJ0aW9uIGZhaWxlZFwiO1xuICAgICAgICAgICAgICAgIGNvbnRleHQgPSBjb250ZXh0IHx8IHt9O1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKG1lc3NhZ2UsIGNvbnRleHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB0aGVuQnk6IChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAvKiBtaXhpbiBmb3IgdGhlIGB0aGVuQnlgIHByb3BlcnR5ICovXG4gICAgICAgICAgICBmdW5jdGlvbiBleHRlbmQoZikge1xuICAgICAgICAgICAgICAgIGYudGhlbkJ5ID0gdGI7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGY7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8qIGFkZHMgYSBzZWNvbmRhcnkgY29tcGFyZSBmdW5jdGlvbiB0byB0aGUgdGFyZ2V0IGZ1bmN0aW9uIChgdGhpc2AgY29udGV4dClcbiAgICAgICAgICAgICB3aGljaCBpcyBhcHBsaWVkIGluIGNhc2UgdGhlIGZpcnN0IG9uZSByZXR1cm5zIDAgKGVxdWFsKVxuICAgICAgICAgICAgIHJldHVybnMgYSBuZXcgY29tcGFyZSBmdW5jdGlvbiwgd2hpY2ggaGFzIGEgYHRoZW5CeWAgbWV0aG9kIGFzIHdlbGwgKi9cbiAgICAgICAgICAgIGZ1bmN0aW9uIHRiKHkpIHtcbiAgICAgICAgICAgICAgICB2YXIgeCA9IHRoaXM7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGV4dGVuZChmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geChhLCBiKSB8fCB5KGEsIGIpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZXh0ZW5kO1xuICAgICAgICB9KSgpLFxuICAgICAgICBkZWZpbmVTdWJQcm9wZXJ0eTogZnVuY3Rpb24gKHByb3BlcnR5LCBzdWJPYmosIGlubmVyUHJvcGVydHkpIHtcbiAgICAgICAgICAgIHJldHVybiBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgcHJvcGVydHksIHtcbiAgICAgICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlubmVyUHJvcGVydHkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzdWJPYmpbaW5uZXJQcm9wZXJ0eV07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gc3ViT2JqW3Byb3BlcnR5XTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgc2V0OiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlubmVyUHJvcGVydHkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Yk9ialtpbm5lclByb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3ViT2JqW3Byb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIGRlZmluZVN1YlByb3BlcnR5Tm9TZXQ6IGZ1bmN0aW9uIChwcm9wZXJ0eSwgc3ViT2JqLCBpbm5lclByb3BlcnR5KSB7XG4gICAgICAgICAgICByZXR1cm4gT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIHByb3BlcnR5LCB7XG4gICAgICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbm5lclByb3BlcnR5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gc3ViT2JqW2lubmVyUHJvcGVydHldO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHN1Yk9ialtwcm9wZXJ0eV07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRPRE86IFRoaXMgaXMgYmxvb2R5IHVnbHkuXG4gICAgICAgICAqIFByZXR0eSBkYW1uIHVzZWZ1bCB0byBiZSBhYmxlIHRvIGFjY2VzcyB0aGUgYm91bmQgb2JqZWN0IG9uIGEgZnVuY3Rpb24gdGhvLlxuICAgICAgICAgKiBTZWU6IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMTQzMDcyNjQvd2hhdC1vYmplY3QtamF2YXNjcmlwdC1mdW5jdGlvbi1pcy1ib3VuZC10by13aGF0LWlzLWl0cy10aGlzXG4gICAgICAgICAqL1xuICAgICAgICBfcGF0Y2hCaW5kOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgX2JpbmQgPSBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHkuYmluZChGdW5jdGlvbi5wcm90b3R5cGUuYmluZCk7XG4gICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoRnVuY3Rpb24ucHJvdG90eXBlLCAnYmluZCcsIHtcbiAgICAgICAgICAgICAgICB2YWx1ZTogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICAgICAgICAgICAgICB2YXIgYm91bmRGdW5jdGlvbiA9IF9iaW5kKHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShib3VuZEZ1bmN0aW9uLCAnX19zaWVzdGFfYm91bmRfb2JqZWN0Jywge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6IG9iaixcbiAgICAgICAgICAgICAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZW51bWVyYWJsZTogZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBib3VuZEZ1bmN0aW9uO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBQcm9taXNlOiBQcm9taXNlLFxuICAgICAgICBwcm9taXNlOiBmdW5jdGlvbiAoY2IsIGZuKSB7XG4gICAgICAgICAgICBjYiA9IGNiIHx8IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgICAgICAgIHZhciBfY2IgPSBhcmdzYXJyYXkoZnVuY3Rpb24gKGFyZ3MpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGVyciA9IGFyZ3NbMF0sXG4gICAgICAgICAgICAgICAgICAgICAgICByZXN0ID0gYXJncy5zbGljZSgxKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycikgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgcmVzb2x2ZShyZXN0WzBdKTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGJvdW5kID0gY2JbJ19fc2llc3RhX2JvdW5kX29iamVjdCddIHx8IGNiOyAvLyBQcmVzZXJ2ZSBib3VuZCBvYmplY3QuXG4gICAgICAgICAgICAgICAgICAgIGNiLmFwcGx5KGJvdW5kLCBhcmdzKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBmbihfY2IpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgfSxcbiAgICAgICAgc3ViUHJvcGVydGllczogZnVuY3Rpb24gKG9iaiwgc3ViT2JqLCBwcm9wZXJ0aWVzKSB7XG4gICAgICAgICAgICBpZiAoIWlzQXJyYXkocHJvcGVydGllcykpIHtcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcHJvcGVydGllcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIChmdW5jdGlvbiAocHJvcGVydHkpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG9wdHMgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogcHJvcGVydHksXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eTogcHJvcGVydHlcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFpc1N0cmluZyhwcm9wZXJ0eSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIF8uZXh0ZW5kKG9wdHMsIHByb3BlcnR5KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB2YXIgZGVzYyA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzdWJPYmpbb3B0cy5wcm9wZXJ0eV07XG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICBpZiAob3B0cy5zZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2Muc2V0ID0gZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdWJPYmpbb3B0cy5wcm9wZXJ0eV0gPSB2O1xuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCBvcHRzLm5hbWUsIGRlc2MpO1xuICAgICAgICAgICAgICAgIH0pKHByb3BlcnRpZXNbaV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBjYXBpdGFsaXNlRmlyc3RMZXR0ZXI6IGZ1bmN0aW9uIChzdHJpbmcpIHtcbiAgICAgICAgICAgIHJldHVybiBzdHJpbmcuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBzdHJpbmcuc2xpY2UoMSk7XG4gICAgICAgIH0sXG4gICAgICAgIGV4dGVuZEZyb21PcHRzOiBmdW5jdGlvbiAob2JqLCBvcHRzLCBkZWZhdWx0cywgZXJyb3JPblVua25vd24pIHtcbiAgICAgICAgICAgIGVycm9yT25Vbmtub3duID0gZXJyb3JPblVua25vd24gPT0gdW5kZWZpbmVkID8gdHJ1ZSA6IGVycm9yT25Vbmtub3duO1xuICAgICAgICAgICAgaWYgKGVycm9yT25Vbmtub3duKSB7XG4gICAgICAgICAgICAgICAgdmFyIGRlZmF1bHRLZXlzID0gT2JqZWN0LmtleXMoZGVmYXVsdHMpLFxuICAgICAgICAgICAgICAgICAgICBvcHRzS2V5cyA9IE9iamVjdC5rZXlzKG9wdHMpO1xuICAgICAgICAgICAgICAgIHZhciB1bmtub3duS2V5cyA9IG9wdHNLZXlzLmZpbHRlcihmdW5jdGlvbiAobikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZGVmYXVsdEtleXMuaW5kZXhPZihuKSA9PSAtMVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGlmICh1bmtub3duS2V5cy5sZW5ndGgpIHRocm93IEVycm9yKCdVbmtub3duIG9wdGlvbnM6ICcgKyB1bmtub3duS2V5cy50b1N0cmluZygpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIEFwcGx5IGFueSBmdW5jdGlvbnMgc3BlY2lmaWVkIGluIHRoZSBkZWZhdWx0cy5cbiAgICAgICAgICAgIF8uZWFjaChPYmplY3Qua2V5cyhkZWZhdWx0cyksIGZ1bmN0aW9uIChrKSB7XG4gICAgICAgICAgICAgICAgdmFyIGQgPSBkZWZhdWx0c1trXTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGQgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0c1trXSA9IGQob3B0c1trXSk7XG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBvcHRzW2tdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXy5leHRlbmQoZGVmYXVsdHMsIG9wdHMpO1xuICAgICAgICAgICAgXy5leHRlbmQob2JqLCBkZWZhdWx0cyk7XG4gICAgICAgIH0sXG4gICAgICAgIGlzU3RyaW5nOiBpc1N0cmluZyxcbiAgICAgICAgaXNBcnJheTogaXNBcnJheSxcbiAgICAgICAgcHJldHR5UHJpbnQ6IGZ1bmN0aW9uIChvKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkobywgbnVsbCwgNCk7XG4gICAgICAgIH0sXG4gICAgICAgIGZsYXR0ZW5BcnJheTogZnVuY3Rpb24gKGFycikge1xuICAgICAgICAgICAgcmV0dXJuIF8ucmVkdWNlKGFyciwgZnVuY3Rpb24gKG1lbW8sIGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoaXNBcnJheShlKSkge1xuICAgICAgICAgICAgICAgICAgICBtZW1vID0gbWVtby5jb25jYXQoZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbWVtby5wdXNoKGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgICAgIH0sIFtdKTtcbiAgICAgICAgfSxcbiAgICAgICAgdW5mbGF0dGVuQXJyYXk6IGZ1bmN0aW9uIChhcnIsIG1vZGVsQXJyKSB7XG4gICAgICAgICAgICB2YXIgbiA9IDA7XG4gICAgICAgICAgICB2YXIgdW5mbGF0dGVuZWQgPSBbXTtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbW9kZWxBcnIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoaXNBcnJheShtb2RlbEFycltpXSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG5ld0FyciA9IFtdO1xuICAgICAgICAgICAgICAgICAgICB1bmZsYXR0ZW5lZFtpXSA9IG5ld0FycjtcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBtb2RlbEFycltpXS5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgbmV3QXJyLnB1c2goYXJyW25dKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG4rKztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHVuZmxhdHRlbmVkW2ldID0gYXJyW25dO1xuICAgICAgICAgICAgICAgICAgICBuKys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHVuZmxhdHRlbmVkO1xuICAgICAgICB9LFxuICAgICAgICAvKipcbiAgICAgICAgICogUmV0dXJuIHRoZSBwYXJhbWV0ZXIgbmFtZXMgb2YgYSBmdW5jdGlvbi5cbiAgICAgICAgICogTm90ZTogYWRhcHRlZCBmcm9tIEFuZ3VsYXJKUyBkZXBlbmRlbmN5IGluamVjdGlvbiA6KVxuICAgICAgICAgKiBAcGFyYW0gZm5cbiAgICAgICAgICovXG4gICAgICAgIHBhcmFtTmFtZXM6IGZ1bmN0aW9uIChmbikge1xuICAgICAgICAgICAgLy8gVE9ETzogSXMgdGhlcmUgYSBtb3JlIHJvYnVzdCB3YXkgb2YgZG9pbmcgdGhpcz9cbiAgICAgICAgICAgIHZhciBwYXJhbXMgPSBbXSxcbiAgICAgICAgICAgICAgICBmblRleHQsXG4gICAgICAgICAgICAgICAgYXJnRGVjbDtcbiAgICAgICAgICAgIGZuVGV4dCA9IGZuLnRvU3RyaW5nKCkucmVwbGFjZShTVFJJUF9DT01NRU5UUywgJycpO1xuICAgICAgICAgICAgYXJnRGVjbCA9IGZuVGV4dC5tYXRjaChGTl9BUkdTKTtcblxuICAgICAgICAgICAgYXJnRGVjbFsxXS5zcGxpdChGTl9BUkdfU1BMSVQpLmZvckVhY2goZnVuY3Rpb24gKGFyZykge1xuICAgICAgICAgICAgICAgIGFyZy5yZXBsYWNlKEZOX0FSRywgZnVuY3Rpb24gKGFsbCwgdW5kZXJzY29yZSwgbmFtZSkge1xuICAgICAgICAgICAgICAgICAgICBwYXJhbXMucHVzaChuYW1lKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHBhcmFtcztcbiAgICAgICAgfVxuICAgIH0pO1xufSkoKTsiLCIvKipcbiAqIE9mdGVuIHVzZWQgZnVuY3Rpb25zIGZyb20gdW5kZXJzY29yZSwgcHVsbGVkIG91dCBmb3IgYnJldml0eS5cbiAqIEBtb2R1bGUgdW5kZXJzY29yZVxuICovXG5cbihmdW5jdGlvbiAoKSB7XG4gICAgdmFyIF8gPSB7fSxcbiAgICAgICAgQXJyYXlQcm90byA9IEFycmF5LnByb3RvdHlwZSxcbiAgICAgICAgRnVuY1Byb3RvID0gRnVuY3Rpb24ucHJvdG90eXBlLFxuICAgICAgICBuYXRpdmVGb3JFYWNoID0gQXJyYXlQcm90by5mb3JFYWNoLFxuICAgICAgICBuYXRpdmVNYXAgPSBBcnJheVByb3RvLm1hcCxcbiAgICAgICAgbmF0aXZlUmVkdWNlID0gQXJyYXlQcm90by5yZWR1Y2UsXG4gICAgICAgIG5hdGl2ZUJpbmQgPSBGdW5jUHJvdG8uYmluZCxcbiAgICAgICAgc2xpY2UgPSBBcnJheVByb3RvLnNsaWNlLFxuICAgICAgICBicmVha2VyID0ge30sXG4gICAgICAgIGN0b3IgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIH07XG5cbiAgICBmdW5jdGlvbiBrZXlzKG9iaikge1xuICAgICAgICBpZiAoT2JqZWN0LmtleXMpIHtcbiAgICAgICAgICAgIHJldHVybiBPYmplY3Qua2V5cyhvYmopO1xuICAgICAgICB9XG4gICAgICAgIHZhciBrZXlzID0gW107XG4gICAgICAgIGZvciAodmFyIGsgaW4gb2JqKSB7XG4gICAgICAgICAgICBpZiAob2JqLmhhc093blByb3BlcnR5KGspKSB7XG4gICAgICAgICAgICAgICAga2V5cy5wdXNoKGspO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBrZXlzO1xuICAgIH1cblxuICAgIF8ua2V5cyA9IGtleXM7XG5cbiAgICBfLmVhY2ggPSBfLmZvckVhY2ggPSBmdW5jdGlvbiAob2JqLCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgICAgICBpZiAob2JqID09IG51bGwpIHJldHVybiBvYmo7XG4gICAgICAgIGlmIChuYXRpdmVGb3JFYWNoICYmIG9iai5mb3JFYWNoID09PSBuYXRpdmVGb3JFYWNoKSB7XG4gICAgICAgICAgICBvYmouZm9yRWFjaChpdGVyYXRvciwgY29udGV4dCk7XG4gICAgICAgIH0gZWxzZSBpZiAob2JqLmxlbmd0aCA9PT0gK29iai5sZW5ndGgpIHtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBvYmoubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoaXRlcmF0b3IuY2FsbChjb250ZXh0LCBvYmpbaV0sIGksIG9iaikgPT09IGJyZWFrZXIpIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciBrZXlzID0gXy5rZXlzKG9iaik7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0ga2V5cy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmIChpdGVyYXRvci5jYWxsKGNvbnRleHQsIG9ialtrZXlzW2ldXSwga2V5c1tpXSwgb2JqKSA9PT0gYnJlYWtlcikgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvYmo7XG4gICAgfTtcblxuICAgIC8vIFJldHVybiB0aGUgcmVzdWx0cyBvZiBhcHBseWluZyB0aGUgaXRlcmF0b3IgdG8gZWFjaCBlbGVtZW50LlxuICAgIC8vIERlbGVnYXRlcyB0byAqKkVDTUFTY3JpcHQgNSoqJ3MgbmF0aXZlIGBtYXBgIGlmIGF2YWlsYWJsZS5cbiAgICBfLm1hcCA9IF8uY29sbGVjdCA9IGZ1bmN0aW9uIChvYmosIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgICAgIHZhciByZXN1bHRzID0gW107XG4gICAgICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIHJlc3VsdHM7XG4gICAgICAgIGlmIChuYXRpdmVNYXAgJiYgb2JqLm1hcCA9PT0gbmF0aXZlTWFwKSByZXR1cm4gb2JqLm1hcChpdGVyYXRvciwgY29udGV4dCk7XG4gICAgICAgIF8uZWFjaChvYmosIGZ1bmN0aW9uICh2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgICAgICAgIHJlc3VsdHMucHVzaChpdGVyYXRvci5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgbGlzdCkpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfTtcblxuICAgIC8vIEludGVybmFsIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhbiBlZmZpY2llbnQgKGZvciBjdXJyZW50IGVuZ2luZXMpIHZlcnNpb25cbiAgICAvLyBvZiB0aGUgcGFzc2VkLWluIGNhbGxiYWNrLCB0byBiZSByZXBlYXRlZGx5IGFwcGxpZWQgaW4gb3RoZXIgVW5kZXJzY29yZVxuICAgIC8vIGZ1bmN0aW9ucy5cbiAgICB2YXIgY3JlYXRlQ2FsbGJhY2sgPSBmdW5jdGlvbiAoZnVuYywgY29udGV4dCwgYXJnQ291bnQpIHtcbiAgICAgICAgaWYgKGNvbnRleHQgPT09IHZvaWQgMCkgcmV0dXJuIGZ1bmM7XG4gICAgICAgIHN3aXRjaCAoYXJnQ291bnQgPT0gbnVsbCA/IDMgOiBhcmdDb3VudCkge1xuICAgICAgICAgICAgY2FzZSAxOlxuICAgICAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmMuY2FsbChjb250ZXh0LCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGNhc2UgMjpcbiAgICAgICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKHZhbHVlLCBvdGhlcikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZnVuYy5jYWxsKGNvbnRleHQsIHZhbHVlLCBvdGhlcik7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGNhc2UgMzpcbiAgICAgICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZnVuYy5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbik7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGNhc2UgNDpcbiAgICAgICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGFjY3VtdWxhdG9yLCB2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmMuY2FsbChjb250ZXh0LCBhY2N1bXVsYXRvciwgdmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gZnVuYy5hcHBseShjb250ZXh0LCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuICAgIH07XG5cbiAgICAvLyBSdW4gYSBmdW5jdGlvbiAqKm4qKiB0aW1lcy5cbiAgICBfLnRpbWVzID0gZnVuY3Rpb24gKG4sIGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgICAgIHZhciBhY2N1bSA9IG5ldyBBcnJheShNYXRoLm1heCgwLCBuKSk7XG4gICAgICAgIGl0ZXJhdGVlID0gY3JlYXRlQ2FsbGJhY2soaXRlcmF0ZWUsIGNvbnRleHQsIDEpO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG47IGkrKykgYWNjdW1baV0gPSBpdGVyYXRlZShpKTtcbiAgICAgICAgcmV0dXJuIGFjY3VtO1xuICAgIH07XG5cbiAgICAvLyBQYXJ0aWFsbHkgYXBwbHkgYSBmdW5jdGlvbiBieSBjcmVhdGluZyBhIHZlcnNpb24gdGhhdCBoYXMgaGFkIHNvbWUgb2YgaXRzXG4gICAgLy8gYXJndW1lbnRzIHByZS1maWxsZWQsIHdpdGhvdXQgY2hhbmdpbmcgaXRzIGR5bmFtaWMgYHRoaXNgIGNvbnRleHQuIF8gYWN0c1xuICAgIC8vIGFzIGEgcGxhY2Vob2xkZXIsIGFsbG93aW5nIGFueSBjb21iaW5hdGlvbiBvZiBhcmd1bWVudHMgdG8gYmUgcHJlLWZpbGxlZC5cbiAgICBfLnBhcnRpYWwgPSBmdW5jdGlvbiAoZnVuYykge1xuICAgICAgICB2YXIgYm91bmRBcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIHBvc2l0aW9uID0gMDtcbiAgICAgICAgICAgIHZhciBhcmdzID0gYm91bmRBcmdzLnNsaWNlKCk7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0gYXJncy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmIChhcmdzW2ldID09PSBfKSBhcmdzW2ldID0gYXJndW1lbnRzW3Bvc2l0aW9uKytdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgd2hpbGUgKHBvc2l0aW9uIDwgYXJndW1lbnRzLmxlbmd0aCkgYXJncy5wdXNoKGFyZ3VtZW50c1twb3NpdGlvbisrXSk7XG4gICAgICAgICAgICByZXR1cm4gZnVuYy5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgfTtcbiAgICB9O1xuXG4gICAgLy8gQ29udmVuaWVuY2UgdmVyc2lvbiBvZiBhIGNvbW1vbiB1c2UgY2FzZSBvZiBgbWFwYDogZmV0Y2hpbmcgYSBwcm9wZXJ0eS5cbiAgICBfLnBsdWNrID0gZnVuY3Rpb24gKG9iaiwga2V5KSB7XG4gICAgICAgIHJldHVybiBfLm1hcChvYmosIF8ucHJvcGVydHkoa2V5KSk7XG4gICAgfTtcblxuICAgIHZhciByZWR1Y2VFcnJvciA9ICdSZWR1Y2Ugb2YgZW1wdHkgYXJyYXkgd2l0aCBubyBpbml0aWFsIHZhbHVlJztcblxuICAgIC8vICoqUmVkdWNlKiogYnVpbGRzIHVwIGEgc2luZ2xlIHJlc3VsdCBmcm9tIGEgbGlzdCBvZiB2YWx1ZXMsIGFrYSBgaW5qZWN0YCxcbiAgICAvLyBvciBgZm9sZGxgLiBEZWxlZ2F0ZXMgdG8gKipFQ01BU2NyaXB0IDUqKidzIG5hdGl2ZSBgcmVkdWNlYCBpZiBhdmFpbGFibGUuXG4gICAgXy5yZWR1Y2UgPSBfLmZvbGRsID0gXy5pbmplY3QgPSBmdW5jdGlvbiAob2JqLCBpdGVyYXRvciwgbWVtbywgY29udGV4dCkge1xuICAgICAgICB2YXIgaW5pdGlhbCA9IGFyZ3VtZW50cy5sZW5ndGggPiAyO1xuICAgICAgICBpZiAob2JqID09IG51bGwpIG9iaiA9IFtdO1xuICAgICAgICBpZiAobmF0aXZlUmVkdWNlICYmIG9iai5yZWR1Y2UgPT09IG5hdGl2ZVJlZHVjZSkge1xuICAgICAgICAgICAgaWYgKGNvbnRleHQpIGl0ZXJhdG9yID0gXy5iaW5kKGl0ZXJhdG9yLCBjb250ZXh0KTtcbiAgICAgICAgICAgIHJldHVybiBpbml0aWFsID8gb2JqLnJlZHVjZShpdGVyYXRvciwgbWVtbykgOiBvYmoucmVkdWNlKGl0ZXJhdG9yKTtcbiAgICAgICAgfVxuICAgICAgICBfLmVhY2gob2JqLCBmdW5jdGlvbiAodmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICAgICAgICBpZiAoIWluaXRpYWwpIHtcbiAgICAgICAgICAgICAgICBtZW1vID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgaW5pdGlhbCA9IHRydWU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG1lbW8gPSBpdGVyYXRvci5jYWxsKGNvbnRleHQsIG1lbW8sIHZhbHVlLCBpbmRleCwgbGlzdCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoIWluaXRpYWwpIHRocm93IG5ldyBUeXBlRXJyb3IocmVkdWNlRXJyb3IpO1xuICAgICAgICByZXR1cm4gbWVtbztcbiAgICB9O1xuXG4gICAgXy5wcm9wZXJ0eSA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgICAgIHJldHVybiBvYmpba2V5XTtcbiAgICAgICAgfTtcbiAgICB9O1xuXG4gICAgLy8gT3B0aW1pemUgYGlzRnVuY3Rpb25gIGlmIGFwcHJvcHJpYXRlLlxuICAgIGlmICh0eXBlb2YoLy4vKSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBfLmlzRnVuY3Rpb24gPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgICAgICByZXR1cm4gdHlwZW9mIG9iaiA9PT0gJ2Z1bmN0aW9uJztcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBfLmlzT2JqZWN0ID0gZnVuY3Rpb24gKG9iaikge1xuICAgICAgICB2YXIgdHlwZSA9IHR5cGVvZiBvYmo7XG4gICAgICAgIHJldHVybiB0eXBlID09PSAnZnVuY3Rpb24nIHx8IHR5cGUgPT09ICdvYmplY3QnICYmICEhb2JqO1xuICAgIH07XG5cbiAgICAvLyBBbiBpbnRlcm5hbCBmdW5jdGlvbiB0byBnZW5lcmF0ZSBsb29rdXAgaXRlcmF0b3JzLlxuICAgIHZhciBsb29rdXBJdGVyYXRvciA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICBpZiAodmFsdWUgPT0gbnVsbCkgcmV0dXJuIF8uaWRlbnRpdHk7XG4gICAgICAgIGlmIChfLmlzRnVuY3Rpb24odmFsdWUpKSByZXR1cm4gdmFsdWU7XG4gICAgICAgIHJldHVybiBfLnByb3BlcnR5KHZhbHVlKTtcbiAgICB9O1xuXG4gICAgLy8gU29ydCB0aGUgb2JqZWN0J3MgdmFsdWVzIGJ5IGEgY3JpdGVyaW9uIHByb2R1Y2VkIGJ5IGFuIGl0ZXJhdG9yLlxuICAgIF8uc29ydEJ5ID0gZnVuY3Rpb24gKG9iaiwgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgICAgICAgaXRlcmF0b3IgPSBsb29rdXBJdGVyYXRvcihpdGVyYXRvcik7XG4gICAgICAgIHJldHVybiBfLnBsdWNrKF8ubWFwKG9iaiwgZnVuY3Rpb24gKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICB2YWx1ZTogdmFsdWUsXG4gICAgICAgICAgICAgICAgaW5kZXg6IGluZGV4LFxuICAgICAgICAgICAgICAgIGNyaXRlcmlhOiBpdGVyYXRvci5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgbGlzdClcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0pLnNvcnQoZnVuY3Rpb24gKGxlZnQsIHJpZ2h0KSB7XG4gICAgICAgICAgICB2YXIgYSA9IGxlZnQuY3JpdGVyaWE7XG4gICAgICAgICAgICB2YXIgYiA9IHJpZ2h0LmNyaXRlcmlhO1xuICAgICAgICAgICAgaWYgKGEgIT09IGIpIHtcbiAgICAgICAgICAgICAgICBpZiAoYSA+IGIgfHwgYSA9PT0gdm9pZCAwKSByZXR1cm4gMTtcbiAgICAgICAgICAgICAgICBpZiAoYSA8IGIgfHwgYiA9PT0gdm9pZCAwKSByZXR1cm4gLTE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbGVmdC5pbmRleCAtIHJpZ2h0LmluZGV4O1xuICAgICAgICB9KSwgJ3ZhbHVlJyk7XG4gICAgfTtcblxuXG4gICAgLy8gQ3JlYXRlIGEgZnVuY3Rpb24gYm91bmQgdG8gYSBnaXZlbiBvYmplY3QgKGFzc2lnbmluZyBgdGhpc2AsIGFuZCBhcmd1bWVudHMsXG4gICAgLy8gb3B0aW9uYWxseSkuIERlbGVnYXRlcyB0byAqKkVDTUFTY3JpcHQgNSoqJ3MgbmF0aXZlIGBGdW5jdGlvbi5iaW5kYCBpZlxuICAgIC8vIGF2YWlsYWJsZS5cbiAgICBfLmJpbmQgPSBmdW5jdGlvbiAoZnVuYywgY29udGV4dCkge1xuICAgICAgICB2YXIgYXJncywgYm91bmQ7XG4gICAgICAgIGlmIChuYXRpdmVCaW5kICYmIGZ1bmMuYmluZCA9PT0gbmF0aXZlQmluZCkgcmV0dXJuIG5hdGl2ZUJpbmQuYXBwbHkoZnVuYywgc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcbiAgICAgICAgaWYgKCFfLmlzRnVuY3Rpb24oZnVuYykpIHRocm93IG5ldyBUeXBlRXJyb3I7XG4gICAgICAgIGFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgICAgIHJldHVybiBib3VuZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBib3VuZCkpIHJldHVybiBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MuY29uY2F0KHNsaWNlLmNhbGwoYXJndW1lbnRzKSkpO1xuICAgICAgICAgICAgY3Rvci5wcm90b3R5cGUgPSBmdW5jLnByb3RvdHlwZTtcbiAgICAgICAgICAgIHZhciBzZWxmID0gbmV3IGN0b3I7XG4gICAgICAgICAgICBjdG9yLnByb3RvdHlwZSA9IG51bGw7XG4gICAgICAgICAgICB1XG4gICAgICAgICAgICB2YXIgcmVzdWx0ID0gZnVuYy5hcHBseShzZWxmLCBhcmdzLmNvbmNhdChzbGljZS5jYWxsKGFyZ3VtZW50cykpKTtcbiAgICAgICAgICAgIGlmIChPYmplY3QocmVzdWx0KSA9PT0gcmVzdWx0KSByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgICAgcmV0dXJuIHNlbGY7XG4gICAgICAgIH07XG4gICAgfTtcblxuICAgIF8uaWRlbnRpdHkgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH07XG5cbiAgICBfLnppcCA9IGZ1bmN0aW9uIChhcnJheSkge1xuICAgICAgICBpZiAoYXJyYXkgPT0gbnVsbCkgcmV0dXJuIFtdO1xuICAgICAgICB2YXIgbGVuZ3RoID0gXy5tYXgoYXJndW1lbnRzLCAnbGVuZ3RoJykubGVuZ3RoO1xuICAgICAgICB2YXIgcmVzdWx0cyA9IEFycmF5KGxlbmd0aCk7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHJlc3VsdHNbaV0gPSBfLnBsdWNrKGFyZ3VtZW50cywgaSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfTtcblxuICAgIC8vIFJldHVybiB0aGUgbWF4aW11bSBlbGVtZW50IChvciBlbGVtZW50LWJhc2VkIGNvbXB1dGF0aW9uKS5cbiAgICBfLm1heCA9IGZ1bmN0aW9uIChvYmosIGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgICAgIHZhciByZXN1bHQgPSAtSW5maW5pdHksXG4gICAgICAgICAgICBsYXN0Q29tcHV0ZWQgPSAtSW5maW5pdHksXG4gICAgICAgICAgICB2YWx1ZSwgY29tcHV0ZWQ7XG4gICAgICAgIGlmIChpdGVyYXRlZSA9PSBudWxsICYmIG9iaiAhPSBudWxsKSB7XG4gICAgICAgICAgICBvYmogPSBvYmoubGVuZ3RoID09PSArb2JqLmxlbmd0aCA/IG9iaiA6IF8udmFsdWVzKG9iaik7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0gb2JqLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSBvYmpbaV07XG4gICAgICAgICAgICAgICAgaWYgKHZhbHVlID4gcmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGl0ZXJhdGVlID0gXy5pdGVyYXRlZShpdGVyYXRlZSwgY29udGV4dCk7XG4gICAgICAgICAgICBfLmVhY2gob2JqLCBmdW5jdGlvbiAodmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICAgICAgICAgICAgY29tcHV0ZWQgPSBpdGVyYXRlZSh2YWx1ZSwgaW5kZXgsIGxpc3QpO1xuICAgICAgICAgICAgICAgIGlmIChjb21wdXRlZCA+IGxhc3RDb21wdXRlZCB8fCBjb21wdXRlZCA9PT0gLUluZmluaXR5ICYmIHJlc3VsdCA9PT0gLUluZmluaXR5KSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICBsYXN0Q29tcHV0ZWQgPSBjb21wdXRlZDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG5cblxuICAgIF8uaXRlcmF0ZWUgPSBmdW5jdGlvbiAodmFsdWUsIGNvbnRleHQsIGFyZ0NvdW50KSB7XG4gICAgICAgIGlmICh2YWx1ZSA9PSBudWxsKSByZXR1cm4gXy5pZGVudGl0eTtcbiAgICAgICAgaWYgKF8uaXNGdW5jdGlvbih2YWx1ZSkpIHJldHVybiBjcmVhdGVDYWxsYmFjayh2YWx1ZSwgY29udGV4dCwgYXJnQ291bnQpO1xuICAgICAgICBpZiAoXy5pc09iamVjdCh2YWx1ZSkpIHJldHVybiBfLm1hdGNoZXModmFsdWUpO1xuICAgICAgICByZXR1cm4gXy5wcm9wZXJ0eSh2YWx1ZSk7XG4gICAgfTtcblxuICAgIF8ucGFpcnMgPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIHZhciBrZXlzID0gXy5rZXlzKG9iaik7XG4gICAgICAgIHZhciBsZW5ndGggPSBrZXlzLmxlbmd0aDtcbiAgICAgICAgdmFyIHBhaXJzID0gQXJyYXkobGVuZ3RoKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgcGFpcnNbaV0gPSBba2V5c1tpXSwgb2JqW2tleXNbaV1dXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcGFpcnM7XG4gICAgfTtcblxuICAgIF8ubWF0Y2hlcyA9IGZ1bmN0aW9uIChhdHRycykge1xuICAgICAgICB2YXIgcGFpcnMgPSBfLnBhaXJzKGF0dHJzKSxcbiAgICAgICAgICAgIGxlbmd0aCA9IHBhaXJzLmxlbmd0aDtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuICFsZW5ndGg7XG4gICAgICAgICAgICBvYmogPSBuZXcgT2JqZWN0KG9iaik7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIHBhaXIgPSBwYWlyc1tpXSxcbiAgICAgICAgICAgICAgICAgICAga2V5ID0gcGFpclswXTtcbiAgICAgICAgICAgICAgICBpZiAocGFpclsxXSAhPT0gb2JqW2tleV0gfHwgIShrZXkgaW4gb2JqKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH07XG4gICAgfTtcblxuICAgIF8uc29tZSA9IGZ1bmN0aW9uIChvYmosIHByZWRpY2F0ZSwgY29udGV4dCkge1xuICAgICAgICBpZiAob2JqID09IG51bGwpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcHJlZGljYXRlID0gXy5pdGVyYXRlZShwcmVkaWNhdGUsIGNvbnRleHQpO1xuICAgICAgICB2YXIga2V5cyA9IG9iai5sZW5ndGggIT09ICtvYmoubGVuZ3RoICYmIF8ua2V5cyhvYmopLFxuICAgICAgICAgICAgbGVuZ3RoID0gKGtleXMgfHwgb2JqKS5sZW5ndGgsXG4gICAgICAgICAgICBpbmRleCwgY3VycmVudEtleTtcbiAgICAgICAgZm9yIChpbmRleCA9IDA7IGluZGV4IDwgbGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgICAgICBjdXJyZW50S2V5ID0ga2V5cyA/IGtleXNbaW5kZXhdIDogaW5kZXg7XG4gICAgICAgICAgICBpZiAocHJlZGljYXRlKG9ialtjdXJyZW50S2V5XSwgY3VycmVudEtleSwgb2JqKSkgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH07XG5cblxuICAgIC8vIEV4dGVuZCBhIGdpdmVuIG9iamVjdCB3aXRoIGFsbCB0aGUgcHJvcGVydGllcyBpbiBwYXNzZWQtaW4gb2JqZWN0KHMpLlxuICAgIF8uZXh0ZW5kID0gZnVuY3Rpb24gKG9iaikge1xuICAgICAgICBpZiAoIV8uaXNPYmplY3Qob2JqKSkgcmV0dXJuIG9iajtcbiAgICAgICAgdmFyIHNvdXJjZSwgcHJvcDtcbiAgICAgICAgZm9yICh2YXIgaSA9IDEsIGxlbmd0aCA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgc291cmNlID0gYXJndW1lbnRzW2ldO1xuICAgICAgICAgICAgZm9yIChwcm9wIGluIHNvdXJjZSkge1xuICAgICAgICAgICAgICAgIC8vbm9pbnNwZWN0aW9uIEpTVW5maWx0ZXJlZEZvckluTG9vcFxuICAgICAgICAgICAgICAgIGlmIChoYXNPd25Qcm9wZXJ0eS5jYWxsKHNvdXJjZSwgcHJvcCkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy9ub2luc3BlY3Rpb24gSlNVbmZpbHRlcmVkRm9ySW5Mb29wXG4gICAgICAgICAgICAgICAgICAgIG9ialtwcm9wXSA9IHNvdXJjZVtwcm9wXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG9iajtcbiAgICB9O1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBfO1xufSkoKTsiLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gYXJnc0FycmF5O1xuXG5mdW5jdGlvbiBhcmdzQXJyYXkoZnVuKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgaWYgKGxlbikge1xuICAgICAgdmFyIGFyZ3MgPSBbXTtcbiAgICAgIHZhciBpID0gLTE7XG4gICAgICB3aGlsZSAoKytpIDwgbGVuKSB7XG4gICAgICAgIGFyZ3NbaV0gPSBhcmd1bWVudHNbaV07XG4gICAgICB9XG4gICAgICByZXR1cm4gZnVuLmNhbGwodGhpcywgYXJncyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBmdW4uY2FsbCh0aGlzLCBbXSk7XG4gICAgfVxuICB9O1xufSIsbnVsbCwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH1cbiAgICAgIHRocm93IFR5cGVFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4nKTtcbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICAgICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcblxuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIHZhciBtO1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgaWYgKHR5cGVvZiBjb25zb2xlLnRyYWNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgaW4gSUUgMTBcbiAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghZW1pdHRlci5fZXZlbnRzIHx8ICFlbWl0dGVyLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gMDtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbihlbWl0dGVyLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IDE7XG4gIGVsc2VcbiAgICByZXQgPSBlbWl0dGVyLl9ldmVudHNbdHlwZV0ubGVuZ3RoO1xuICByZXR1cm4gcmV0O1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuIiwiXG4vKipcbiAqIFRoaXMgaXMgdGhlIHdlYiBicm93c2VyIGltcGxlbWVudGF0aW9uIG9mIGBkZWJ1ZygpYC5cbiAqXG4gKiBFeHBvc2UgYGRlYnVnKClgIGFzIHRoZSBtb2R1bGUuXG4gKi9cblxuZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9kZWJ1ZycpO1xuZXhwb3J0cy5sb2cgPSBsb2c7XG5leHBvcnRzLmZvcm1hdEFyZ3MgPSBmb3JtYXRBcmdzO1xuZXhwb3J0cy5zYXZlID0gc2F2ZTtcbmV4cG9ydHMubG9hZCA9IGxvYWQ7XG5leHBvcnRzLnVzZUNvbG9ycyA9IHVzZUNvbG9ycztcblxuLyoqXG4gKiBVc2UgY2hyb21lLnN0b3JhZ2UubG9jYWwgaWYgd2UgYXJlIGluIGFuIGFwcFxuICovXG5cbnZhciBzdG9yYWdlO1xuXG5pZiAodHlwZW9mIGNocm9tZSAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIGNocm9tZS5zdG9yYWdlICE9PSAndW5kZWZpbmVkJylcbiAgc3RvcmFnZSA9IGNocm9tZS5zdG9yYWdlLmxvY2FsO1xuZWxzZVxuICBzdG9yYWdlID0gd2luZG93LmxvY2FsU3RvcmFnZTtcblxuLyoqXG4gKiBDb2xvcnMuXG4gKi9cblxuZXhwb3J0cy5jb2xvcnMgPSBbXG4gICdsaWdodHNlYWdyZWVuJyxcbiAgJ2ZvcmVzdGdyZWVuJyxcbiAgJ2dvbGRlbnJvZCcsXG4gICdkb2RnZXJibHVlJyxcbiAgJ2RhcmtvcmNoaWQnLFxuICAnY3JpbXNvbidcbl07XG5cbi8qKlxuICogQ3VycmVudGx5IG9ubHkgV2ViS2l0LWJhc2VkIFdlYiBJbnNwZWN0b3JzLCBGaXJlZm94ID49IHYzMSxcbiAqIGFuZCB0aGUgRmlyZWJ1ZyBleHRlbnNpb24gKGFueSBGaXJlZm94IHZlcnNpb24pIGFyZSBrbm93blxuICogdG8gc3VwcG9ydCBcIiVjXCIgQ1NTIGN1c3RvbWl6YXRpb25zLlxuICpcbiAqIFRPRE86IGFkZCBhIGBsb2NhbFN0b3JhZ2VgIHZhcmlhYmxlIHRvIGV4cGxpY2l0bHkgZW5hYmxlL2Rpc2FibGUgY29sb3JzXG4gKi9cblxuZnVuY3Rpb24gdXNlQ29sb3JzKCkge1xuICAvLyBpcyB3ZWJraXQ/IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzE2NDU5NjA2LzM3Njc3M1xuICByZXR1cm4gKCdXZWJraXRBcHBlYXJhbmNlJyBpbiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc3R5bGUpIHx8XG4gICAgLy8gaXMgZmlyZWJ1Zz8gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMzk4MTIwLzM3Njc3M1xuICAgICh3aW5kb3cuY29uc29sZSAmJiAoY29uc29sZS5maXJlYnVnIHx8IChjb25zb2xlLmV4Y2VwdGlvbiAmJiBjb25zb2xlLnRhYmxlKSkpIHx8XG4gICAgLy8gaXMgZmlyZWZveCA+PSB2MzE/XG4gICAgLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9Ub29scy9XZWJfQ29uc29sZSNTdHlsaW5nX21lc3NhZ2VzXG4gICAgKG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5tYXRjaCgvZmlyZWZveFxcLyhcXGQrKS8pICYmIHBhcnNlSW50KFJlZ0V4cC4kMSwgMTApID49IDMxKTtcbn1cblxuLyoqXG4gKiBNYXAgJWogdG8gYEpTT04uc3RyaW5naWZ5KClgLCBzaW5jZSBubyBXZWIgSW5zcGVjdG9ycyBkbyB0aGF0IGJ5IGRlZmF1bHQuXG4gKi9cblxuZXhwb3J0cy5mb3JtYXR0ZXJzLmogPSBmdW5jdGlvbih2KSB7XG4gIHJldHVybiBKU09OLnN0cmluZ2lmeSh2KTtcbn07XG5cblxuLyoqXG4gKiBDb2xvcml6ZSBsb2cgYXJndW1lbnRzIGlmIGVuYWJsZWQuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBmb3JtYXRBcmdzKCkge1xuICB2YXIgYXJncyA9IGFyZ3VtZW50cztcbiAgdmFyIHVzZUNvbG9ycyA9IHRoaXMudXNlQ29sb3JzO1xuXG4gIGFyZ3NbMF0gPSAodXNlQ29sb3JzID8gJyVjJyA6ICcnKVxuICAgICsgdGhpcy5uYW1lc3BhY2VcbiAgICArICh1c2VDb2xvcnMgPyAnICVjJyA6ICcgJylcbiAgICArIGFyZ3NbMF1cbiAgICArICh1c2VDb2xvcnMgPyAnJWMgJyA6ICcgJylcbiAgICArICcrJyArIGV4cG9ydHMuaHVtYW5pemUodGhpcy5kaWZmKTtcblxuICBpZiAoIXVzZUNvbG9ycykgcmV0dXJuIGFyZ3M7XG5cbiAgdmFyIGMgPSAnY29sb3I6ICcgKyB0aGlzLmNvbG9yO1xuICBhcmdzID0gW2FyZ3NbMF0sIGMsICdjb2xvcjogaW5oZXJpdCddLmNvbmNhdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmdzLCAxKSk7XG5cbiAgLy8gdGhlIGZpbmFsIFwiJWNcIiBpcyBzb21ld2hhdCB0cmlja3ksIGJlY2F1c2UgdGhlcmUgY291bGQgYmUgb3RoZXJcbiAgLy8gYXJndW1lbnRzIHBhc3NlZCBlaXRoZXIgYmVmb3JlIG9yIGFmdGVyIHRoZSAlYywgc28gd2UgbmVlZCB0b1xuICAvLyBmaWd1cmUgb3V0IHRoZSBjb3JyZWN0IGluZGV4IHRvIGluc2VydCB0aGUgQ1NTIGludG9cbiAgdmFyIGluZGV4ID0gMDtcbiAgdmFyIGxhc3RDID0gMDtcbiAgYXJnc1swXS5yZXBsYWNlKC8lW2EteiVdL2csIGZ1bmN0aW9uKG1hdGNoKSB7XG4gICAgaWYgKCclJScgPT09IG1hdGNoKSByZXR1cm47XG4gICAgaW5kZXgrKztcbiAgICBpZiAoJyVjJyA9PT0gbWF0Y2gpIHtcbiAgICAgIC8vIHdlIG9ubHkgYXJlIGludGVyZXN0ZWQgaW4gdGhlICpsYXN0KiAlY1xuICAgICAgLy8gKHRoZSB1c2VyIG1heSBoYXZlIHByb3ZpZGVkIHRoZWlyIG93bilcbiAgICAgIGxhc3RDID0gaW5kZXg7XG4gICAgfVxuICB9KTtcblxuICBhcmdzLnNwbGljZShsYXN0QywgMCwgYyk7XG4gIHJldHVybiBhcmdzO1xufVxuXG4vKipcbiAqIEludm9rZXMgYGNvbnNvbGUubG9nKClgIHdoZW4gYXZhaWxhYmxlLlxuICogTm8tb3Agd2hlbiBgY29uc29sZS5sb2dgIGlzIG5vdCBhIFwiZnVuY3Rpb25cIi5cbiAqXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGxvZygpIHtcbiAgLy8gdGhpcyBoYWNrZXJ5IGlzIHJlcXVpcmVkIGZvciBJRTgvOSwgd2hlcmVcbiAgLy8gdGhlIGBjb25zb2xlLmxvZ2AgZnVuY3Rpb24gZG9lc24ndCBoYXZlICdhcHBseSdcbiAgcmV0dXJuICdvYmplY3QnID09PSB0eXBlb2YgY29uc29sZVxuICAgICYmIGNvbnNvbGUubG9nXG4gICAgJiYgRnVuY3Rpb24ucHJvdG90eXBlLmFwcGx5LmNhbGwoY29uc29sZS5sb2csIGNvbnNvbGUsIGFyZ3VtZW50cyk7XG59XG5cbi8qKlxuICogU2F2ZSBgbmFtZXNwYWNlc2AuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVzcGFjZXNcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHNhdmUobmFtZXNwYWNlcykge1xuICB0cnkge1xuICAgIGlmIChudWxsID09IG5hbWVzcGFjZXMpIHtcbiAgICAgIHN0b3JhZ2UucmVtb3ZlSXRlbSgnZGVidWcnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RvcmFnZS5kZWJ1ZyA9IG5hbWVzcGFjZXM7XG4gICAgfVxuICB9IGNhdGNoKGUpIHt9XG59XG5cbi8qKlxuICogTG9hZCBgbmFtZXNwYWNlc2AuXG4gKlxuICogQHJldHVybiB7U3RyaW5nfSByZXR1cm5zIHRoZSBwcmV2aW91c2x5IHBlcnNpc3RlZCBkZWJ1ZyBtb2Rlc1xuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gbG9hZCgpIHtcbiAgdmFyIHI7XG4gIHRyeSB7XG4gICAgciA9IHN0b3JhZ2UuZGVidWc7XG4gIH0gY2F0Y2goZSkge31cbiAgcmV0dXJuIHI7XG59XG5cbi8qKlxuICogRW5hYmxlIG5hbWVzcGFjZXMgbGlzdGVkIGluIGBsb2NhbFN0b3JhZ2UuZGVidWdgIGluaXRpYWxseS5cbiAqL1xuXG5leHBvcnRzLmVuYWJsZShsb2FkKCkpO1xuIiwiXG4vKipcbiAqIFRoaXMgaXMgdGhlIGNvbW1vbiBsb2dpYyBmb3IgYm90aCB0aGUgTm9kZS5qcyBhbmQgd2ViIGJyb3dzZXJcbiAqIGltcGxlbWVudGF0aW9ucyBvZiBgZGVidWcoKWAuXG4gKlxuICogRXhwb3NlIGBkZWJ1ZygpYCBhcyB0aGUgbW9kdWxlLlxuICovXG5cbmV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IGRlYnVnO1xuZXhwb3J0cy5jb2VyY2UgPSBjb2VyY2U7XG5leHBvcnRzLmRpc2FibGUgPSBkaXNhYmxlO1xuZXhwb3J0cy5lbmFibGUgPSBlbmFibGU7XG5leHBvcnRzLmVuYWJsZWQgPSBlbmFibGVkO1xuZXhwb3J0cy5odW1hbml6ZSA9IHJlcXVpcmUoJ21zJyk7XG5cbi8qKlxuICogVGhlIGN1cnJlbnRseSBhY3RpdmUgZGVidWcgbW9kZSBuYW1lcywgYW5kIG5hbWVzIHRvIHNraXAuXG4gKi9cblxuZXhwb3J0cy5uYW1lcyA9IFtdO1xuZXhwb3J0cy5za2lwcyA9IFtdO1xuXG4vKipcbiAqIE1hcCBvZiBzcGVjaWFsIFwiJW5cIiBoYW5kbGluZyBmdW5jdGlvbnMsIGZvciB0aGUgZGVidWcgXCJmb3JtYXRcIiBhcmd1bWVudC5cbiAqXG4gKiBWYWxpZCBrZXkgbmFtZXMgYXJlIGEgc2luZ2xlLCBsb3dlcmNhc2VkIGxldHRlciwgaS5lLiBcIm5cIi5cbiAqL1xuXG5leHBvcnRzLmZvcm1hdHRlcnMgPSB7fTtcblxuLyoqXG4gKiBQcmV2aW91c2x5IGFzc2lnbmVkIGNvbG9yLlxuICovXG5cbnZhciBwcmV2Q29sb3IgPSAwO1xuXG4vKipcbiAqIFByZXZpb3VzIGxvZyB0aW1lc3RhbXAuXG4gKi9cblxudmFyIHByZXZUaW1lO1xuXG4vKipcbiAqIFNlbGVjdCBhIGNvbG9yLlxuICpcbiAqIEByZXR1cm4ge051bWJlcn1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHNlbGVjdENvbG9yKCkge1xuICByZXR1cm4gZXhwb3J0cy5jb2xvcnNbcHJldkNvbG9yKysgJSBleHBvcnRzLmNvbG9ycy5sZW5ndGhdO1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIGRlYnVnZ2VyIHdpdGggdGhlIGdpdmVuIGBuYW1lc3BhY2VgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2VcbiAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBkZWJ1ZyhuYW1lc3BhY2UpIHtcblxuICAvLyBkZWZpbmUgdGhlIGBkaXNhYmxlZGAgdmVyc2lvblxuICBmdW5jdGlvbiBkaXNhYmxlZCgpIHtcbiAgfVxuICBkaXNhYmxlZC5lbmFibGVkID0gZmFsc2U7XG5cbiAgLy8gZGVmaW5lIHRoZSBgZW5hYmxlZGAgdmVyc2lvblxuICBmdW5jdGlvbiBlbmFibGVkKCkge1xuXG4gICAgdmFyIHNlbGYgPSBlbmFibGVkO1xuXG4gICAgLy8gc2V0IGBkaWZmYCB0aW1lc3RhbXBcbiAgICB2YXIgY3VyciA9ICtuZXcgRGF0ZSgpO1xuICAgIHZhciBtcyA9IGN1cnIgLSAocHJldlRpbWUgfHwgY3Vycik7XG4gICAgc2VsZi5kaWZmID0gbXM7XG4gICAgc2VsZi5wcmV2ID0gcHJldlRpbWU7XG4gICAgc2VsZi5jdXJyID0gY3VycjtcbiAgICBwcmV2VGltZSA9IGN1cnI7XG5cbiAgICAvLyBhZGQgdGhlIGBjb2xvcmAgaWYgbm90IHNldFxuICAgIGlmIChudWxsID09IHNlbGYudXNlQ29sb3JzKSBzZWxmLnVzZUNvbG9ycyA9IGV4cG9ydHMudXNlQ29sb3JzKCk7XG4gICAgaWYgKG51bGwgPT0gc2VsZi5jb2xvciAmJiBzZWxmLnVzZUNvbG9ycykgc2VsZi5jb2xvciA9IHNlbGVjdENvbG9yKCk7XG5cbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG5cbiAgICBhcmdzWzBdID0gZXhwb3J0cy5jb2VyY2UoYXJnc1swXSk7XG5cbiAgICBpZiAoJ3N0cmluZycgIT09IHR5cGVvZiBhcmdzWzBdKSB7XG4gICAgICAvLyBhbnl0aGluZyBlbHNlIGxldCdzIGluc3BlY3Qgd2l0aCAlb1xuICAgICAgYXJncyA9IFsnJW8nXS5jb25jYXQoYXJncyk7XG4gICAgfVxuXG4gICAgLy8gYXBwbHkgYW55IGBmb3JtYXR0ZXJzYCB0cmFuc2Zvcm1hdGlvbnNcbiAgICB2YXIgaW5kZXggPSAwO1xuICAgIGFyZ3NbMF0gPSBhcmdzWzBdLnJlcGxhY2UoLyUoW2EteiVdKS9nLCBmdW5jdGlvbihtYXRjaCwgZm9ybWF0KSB7XG4gICAgICAvLyBpZiB3ZSBlbmNvdW50ZXIgYW4gZXNjYXBlZCAlIHRoZW4gZG9uJ3QgaW5jcmVhc2UgdGhlIGFycmF5IGluZGV4XG4gICAgICBpZiAobWF0Y2ggPT09ICclJScpIHJldHVybiBtYXRjaDtcbiAgICAgIGluZGV4Kys7XG4gICAgICB2YXIgZm9ybWF0dGVyID0gZXhwb3J0cy5mb3JtYXR0ZXJzW2Zvcm1hdF07XG4gICAgICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGZvcm1hdHRlcikge1xuICAgICAgICB2YXIgdmFsID0gYXJnc1tpbmRleF07XG4gICAgICAgIG1hdGNoID0gZm9ybWF0dGVyLmNhbGwoc2VsZiwgdmFsKTtcblxuICAgICAgICAvLyBub3cgd2UgbmVlZCB0byByZW1vdmUgYGFyZ3NbaW5kZXhdYCBzaW5jZSBpdCdzIGlubGluZWQgaW4gdGhlIGBmb3JtYXRgXG4gICAgICAgIGFyZ3Muc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgaW5kZXgtLTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtYXRjaDtcbiAgICB9KTtcblxuICAgIGlmICgnZnVuY3Rpb24nID09PSB0eXBlb2YgZXhwb3J0cy5mb3JtYXRBcmdzKSB7XG4gICAgICBhcmdzID0gZXhwb3J0cy5mb3JtYXRBcmdzLmFwcGx5KHNlbGYsIGFyZ3MpO1xuICAgIH1cbiAgICB2YXIgbG9nRm4gPSBlbmFibGVkLmxvZyB8fCBleHBvcnRzLmxvZyB8fCBjb25zb2xlLmxvZy5iaW5kKGNvbnNvbGUpO1xuICAgIGxvZ0ZuLmFwcGx5KHNlbGYsIGFyZ3MpO1xuICB9XG4gIGVuYWJsZWQuZW5hYmxlZCA9IHRydWU7XG5cbiAgdmFyIGZuID0gZXhwb3J0cy5lbmFibGVkKG5hbWVzcGFjZSkgPyBlbmFibGVkIDogZGlzYWJsZWQ7XG5cbiAgZm4ubmFtZXNwYWNlID0gbmFtZXNwYWNlO1xuXG4gIHJldHVybiBmbjtcbn1cblxuLyoqXG4gKiBFbmFibGVzIGEgZGVidWcgbW9kZSBieSBuYW1lc3BhY2VzLiBUaGlzIGNhbiBpbmNsdWRlIG1vZGVzXG4gKiBzZXBhcmF0ZWQgYnkgYSBjb2xvbiBhbmQgd2lsZGNhcmRzLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2VzXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGVuYWJsZShuYW1lc3BhY2VzKSB7XG4gIGV4cG9ydHMuc2F2ZShuYW1lc3BhY2VzKTtcblxuICB2YXIgc3BsaXQgPSAobmFtZXNwYWNlcyB8fCAnJykuc3BsaXQoL1tcXHMsXSsvKTtcbiAgdmFyIGxlbiA9IHNwbGl0Lmxlbmd0aDtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKCFzcGxpdFtpXSkgY29udGludWU7IC8vIGlnbm9yZSBlbXB0eSBzdHJpbmdzXG4gICAgbmFtZXNwYWNlcyA9IHNwbGl0W2ldLnJlcGxhY2UoL1xcKi9nLCAnLio/Jyk7XG4gICAgaWYgKG5hbWVzcGFjZXNbMF0gPT09ICctJykge1xuICAgICAgZXhwb3J0cy5za2lwcy5wdXNoKG5ldyBSZWdFeHAoJ14nICsgbmFtZXNwYWNlcy5zdWJzdHIoMSkgKyAnJCcpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZXhwb3J0cy5uYW1lcy5wdXNoKG5ldyBSZWdFeHAoJ14nICsgbmFtZXNwYWNlcyArICckJykpO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIERpc2FibGUgZGVidWcgb3V0cHV0LlxuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZGlzYWJsZSgpIHtcbiAgZXhwb3J0cy5lbmFibGUoJycpO1xufVxuXG4vKipcbiAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgZ2l2ZW4gbW9kZSBuYW1lIGlzIGVuYWJsZWQsIGZhbHNlIG90aGVyd2lzZS5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZW5hYmxlZChuYW1lKSB7XG4gIHZhciBpLCBsZW47XG4gIGZvciAoaSA9IDAsIGxlbiA9IGV4cG9ydHMuc2tpcHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBpZiAoZXhwb3J0cy5za2lwc1tpXS50ZXN0KG5hbWUpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIGZvciAoaSA9IDAsIGxlbiA9IGV4cG9ydHMubmFtZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBpZiAoZXhwb3J0cy5uYW1lc1tpXS50ZXN0KG5hbWUpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vKipcbiAqIENvZXJjZSBgdmFsYC5cbiAqXG4gKiBAcGFyYW0ge01peGVkfSB2YWxcbiAqIEByZXR1cm4ge01peGVkfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gY29lcmNlKHZhbCkge1xuICBpZiAodmFsIGluc3RhbmNlb2YgRXJyb3IpIHJldHVybiB2YWwuc3RhY2sgfHwgdmFsLm1lc3NhZ2U7XG4gIHJldHVybiB2YWw7XG59XG4iLCIvKipcbiAqIEhlbHBlcnMuXG4gKi9cblxudmFyIHMgPSAxMDAwO1xudmFyIG0gPSBzICogNjA7XG52YXIgaCA9IG0gKiA2MDtcbnZhciBkID0gaCAqIDI0O1xudmFyIHkgPSBkICogMzY1LjI1O1xuXG4vKipcbiAqIFBhcnNlIG9yIGZvcm1hdCB0aGUgZ2l2ZW4gYHZhbGAuXG4gKlxuICogT3B0aW9uczpcbiAqXG4gKiAgLSBgbG9uZ2AgdmVyYm9zZSBmb3JtYXR0aW5nIFtmYWxzZV1cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xOdW1iZXJ9IHZhbFxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqIEByZXR1cm4ge1N0cmluZ3xOdW1iZXJ9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odmFsLCBvcHRpb25zKXtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gIGlmICgnc3RyaW5nJyA9PSB0eXBlb2YgdmFsKSByZXR1cm4gcGFyc2UodmFsKTtcbiAgcmV0dXJuIG9wdGlvbnMubG9uZ1xuICAgID8gbG9uZyh2YWwpXG4gICAgOiBzaG9ydCh2YWwpO1xufTtcblxuLyoqXG4gKiBQYXJzZSB0aGUgZ2l2ZW4gYHN0cmAgYW5kIHJldHVybiBtaWxsaXNlY29uZHMuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7TnVtYmVyfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gcGFyc2Uoc3RyKSB7XG4gIHZhciBtYXRjaCA9IC9eKCg/OlxcZCspP1xcLj9cXGQrKSAqKG1zfHNlY29uZHM/fHN8bWludXRlcz98bXxob3Vycz98aHxkYXlzP3xkfHllYXJzP3x5KT8kL2kuZXhlYyhzdHIpO1xuICBpZiAoIW1hdGNoKSByZXR1cm47XG4gIHZhciBuID0gcGFyc2VGbG9hdChtYXRjaFsxXSk7XG4gIHZhciB0eXBlID0gKG1hdGNoWzJdIHx8ICdtcycpLnRvTG93ZXJDYXNlKCk7XG4gIHN3aXRjaCAodHlwZSkge1xuICAgIGNhc2UgJ3llYXJzJzpcbiAgICBjYXNlICd5ZWFyJzpcbiAgICBjYXNlICd5JzpcbiAgICAgIHJldHVybiBuICogeTtcbiAgICBjYXNlICdkYXlzJzpcbiAgICBjYXNlICdkYXknOlxuICAgIGNhc2UgJ2QnOlxuICAgICAgcmV0dXJuIG4gKiBkO1xuICAgIGNhc2UgJ2hvdXJzJzpcbiAgICBjYXNlICdob3VyJzpcbiAgICBjYXNlICdoJzpcbiAgICAgIHJldHVybiBuICogaDtcbiAgICBjYXNlICdtaW51dGVzJzpcbiAgICBjYXNlICdtaW51dGUnOlxuICAgIGNhc2UgJ20nOlxuICAgICAgcmV0dXJuIG4gKiBtO1xuICAgIGNhc2UgJ3NlY29uZHMnOlxuICAgIGNhc2UgJ3NlY29uZCc6XG4gICAgY2FzZSAncyc6XG4gICAgICByZXR1cm4gbiAqIHM7XG4gICAgY2FzZSAnbXMnOlxuICAgICAgcmV0dXJuIG47XG4gIH1cbn1cblxuLyoqXG4gKiBTaG9ydCBmb3JtYXQgZm9yIGBtc2AuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1zXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBzaG9ydChtcykge1xuICBpZiAobXMgPj0gZCkgcmV0dXJuIE1hdGgucm91bmQobXMgLyBkKSArICdkJztcbiAgaWYgKG1zID49IGgpIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gaCkgKyAnaCc7XG4gIGlmIChtcyA+PSBtKSByZXR1cm4gTWF0aC5yb3VuZChtcyAvIG0pICsgJ20nO1xuICBpZiAobXMgPj0gcykgcmV0dXJuIE1hdGgucm91bmQobXMgLyBzKSArICdzJztcbiAgcmV0dXJuIG1zICsgJ21zJztcbn1cblxuLyoqXG4gKiBMb25nIGZvcm1hdCBmb3IgYG1zYC5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gbXNcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGxvbmcobXMpIHtcbiAgcmV0dXJuIHBsdXJhbChtcywgZCwgJ2RheScpXG4gICAgfHwgcGx1cmFsKG1zLCBoLCAnaG91cicpXG4gICAgfHwgcGx1cmFsKG1zLCBtLCAnbWludXRlJylcbiAgICB8fCBwbHVyYWwobXMsIHMsICdzZWNvbmQnKVxuICAgIHx8IG1zICsgJyBtcyc7XG59XG5cbi8qKlxuICogUGx1cmFsaXphdGlvbiBoZWxwZXIuXG4gKi9cblxuZnVuY3Rpb24gcGx1cmFsKG1zLCBuLCBuYW1lKSB7XG4gIGlmIChtcyA8IG4pIHJldHVybjtcbiAgaWYgKG1zIDwgbiAqIDEuNSkgcmV0dXJuIE1hdGguZmxvb3IobXMgLyBuKSArICcgJyArIG5hbWU7XG4gIHJldHVybiBNYXRoLmNlaWwobXMgLyBuKSArICcgJyArIG5hbWUgKyAncyc7XG59XG4iLCJ2YXIgaGFzT3duID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcbnZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG52YXIgdW5kZWZpbmVkO1xuXG52YXIgaXNQbGFpbk9iamVjdCA9IGZ1bmN0aW9uIGlzUGxhaW5PYmplY3Qob2JqKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG4gICAgaWYgKCFvYmogfHwgdG9TdHJpbmcuY2FsbChvYmopICE9PSAnW29iamVjdCBPYmplY3RdJyB8fCBvYmoubm9kZVR5cGUgfHwgb2JqLnNldEludGVydmFsKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB2YXIgaGFzX293bl9jb25zdHJ1Y3RvciA9IGhhc093bi5jYWxsKG9iaiwgJ2NvbnN0cnVjdG9yJyk7XG4gICAgdmFyIGhhc19pc19wcm9wZXJ0eV9vZl9tZXRob2QgPSBvYmouY29uc3RydWN0b3IgJiYgb2JqLmNvbnN0cnVjdG9yLnByb3RvdHlwZSAmJiBoYXNPd24uY2FsbChvYmouY29uc3RydWN0b3IucHJvdG90eXBlLCAnaXNQcm90b3R5cGVPZicpO1xuICAgIC8vIE5vdCBvd24gY29uc3RydWN0b3IgcHJvcGVydHkgbXVzdCBiZSBPYmplY3RcbiAgICBpZiAob2JqLmNvbnN0cnVjdG9yICYmICFoYXNfb3duX2NvbnN0cnVjdG9yICYmICFoYXNfaXNfcHJvcGVydHlfb2ZfbWV0aG9kKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBPd24gcHJvcGVydGllcyBhcmUgZW51bWVyYXRlZCBmaXJzdGx5LCBzbyB0byBzcGVlZCB1cCxcbiAgICAvLyBpZiBsYXN0IG9uZSBpcyBvd24sIHRoZW4gYWxsIHByb3BlcnRpZXMgYXJlIG93bi5cbiAgICB2YXIga2V5O1xuICAgIGZvciAoa2V5IGluIG9iaikge31cblxuICAgIHJldHVybiBrZXkgPT09IHVuZGVmaW5lZCB8fCBoYXNPd24uY2FsbChvYmosIGtleSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGV4dGVuZCgpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcbiAgICB2YXIgb3B0aW9ucywgbmFtZSwgc3JjLCBjb3B5LCBjb3B5SXNBcnJheSwgY2xvbmUsXG4gICAgICAgIHRhcmdldCA9IGFyZ3VtZW50c1swXSxcbiAgICAgICAgaSA9IDEsXG4gICAgICAgIGxlbmd0aCA9IGFyZ3VtZW50cy5sZW5ndGgsXG4gICAgICAgIGRlZXAgPSBmYWxzZTtcblxuICAgIC8vIEhhbmRsZSBhIGRlZXAgY29weSBzaXR1YXRpb25cbiAgICBpZiAodHlwZW9mIHRhcmdldCA9PT0gXCJib29sZWFuXCIpIHtcbiAgICAgICAgZGVlcCA9IHRhcmdldDtcbiAgICAgICAgdGFyZ2V0ID0gYXJndW1lbnRzWzFdIHx8IHt9O1xuICAgICAgICAvLyBza2lwIHRoZSBib29sZWFuIGFuZCB0aGUgdGFyZ2V0XG4gICAgICAgIGkgPSAyO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHRhcmdldCAhPT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgdGFyZ2V0ICE9PSBcImZ1bmN0aW9uXCIgfHwgdGFyZ2V0ID09IHVuZGVmaW5lZCkge1xuICAgICAgICB0YXJnZXQgPSB7fTtcbiAgICB9XG5cbiAgICBmb3IgKDsgaSA8IGxlbmd0aDsgKytpKSB7XG4gICAgICAgIC8vIE9ubHkgZGVhbCB3aXRoIG5vbi1udWxsL3VuZGVmaW5lZCB2YWx1ZXNcbiAgICAgICAgaWYgKChvcHRpb25zID0gYXJndW1lbnRzW2ldKSAhPSBudWxsKSB7XG4gICAgICAgICAgICAvLyBFeHRlbmQgdGhlIGJhc2Ugb2JqZWN0XG4gICAgICAgICAgICBmb3IgKG5hbWUgaW4gb3B0aW9ucykge1xuICAgICAgICAgICAgICAgIHNyYyA9IHRhcmdldFtuYW1lXTtcbiAgICAgICAgICAgICAgICBjb3B5ID0gb3B0aW9uc1tuYW1lXTtcblxuICAgICAgICAgICAgICAgIC8vIFByZXZlbnQgbmV2ZXItZW5kaW5nIGxvb3BcbiAgICAgICAgICAgICAgICBpZiAodGFyZ2V0ID09PSBjb3B5KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIFJlY3Vyc2UgaWYgd2UncmUgbWVyZ2luZyBwbGFpbiBvYmplY3RzIG9yIGFycmF5c1xuICAgICAgICAgICAgICAgIGlmIChkZWVwICYmIGNvcHkgJiYgKGlzUGxhaW5PYmplY3QoY29weSkgfHwgKGNvcHlJc0FycmF5ID0gQXJyYXkuaXNBcnJheShjb3B5KSkpKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjb3B5SXNBcnJheSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29weUlzQXJyYXkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsb25lID0gc3JjICYmIEFycmF5LmlzQXJyYXkoc3JjKSA/IHNyYyA6IFtdO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2xvbmUgPSBzcmMgJiYgaXNQbGFpbk9iamVjdChzcmMpID8gc3JjIDoge307XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBOZXZlciBtb3ZlIG9yaWdpbmFsIG9iamVjdHMsIGNsb25lIHRoZW1cbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0W25hbWVdID0gZXh0ZW5kKGRlZXAsIGNsb25lLCBjb3B5KTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBEb24ndCBicmluZyBpbiB1bmRlZmluZWQgdmFsdWVzXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjb3B5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0W25hbWVdID0gY29weTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBSZXR1cm4gdGhlIG1vZGlmaWVkIG9iamVjdFxuICAgIHJldHVybiB0YXJnZXQ7XG59O1xuXG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gSU5URVJOQUw7XG5cbmZ1bmN0aW9uIElOVEVSTkFMKCkge30iLCIndXNlIHN0cmljdCc7XG52YXIgUHJvbWlzZSA9IHJlcXVpcmUoJy4vcHJvbWlzZScpO1xudmFyIHJlamVjdCA9IHJlcXVpcmUoJy4vcmVqZWN0Jyk7XG52YXIgcmVzb2x2ZSA9IHJlcXVpcmUoJy4vcmVzb2x2ZScpO1xudmFyIElOVEVSTkFMID0gcmVxdWlyZSgnLi9JTlRFUk5BTCcpO1xudmFyIGhhbmRsZXJzID0gcmVxdWlyZSgnLi9oYW5kbGVycycpO1xubW9kdWxlLmV4cG9ydHMgPSBhbGw7XG5mdW5jdGlvbiBhbGwoaXRlcmFibGUpIHtcbiAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChpdGVyYWJsZSkgIT09ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICByZXR1cm4gcmVqZWN0KG5ldyBUeXBlRXJyb3IoJ211c3QgYmUgYW4gYXJyYXknKSk7XG4gIH1cblxuICB2YXIgbGVuID0gaXRlcmFibGUubGVuZ3RoO1xuICB2YXIgY2FsbGVkID0gZmFsc2U7XG4gIGlmICghbGVuKSB7XG4gICAgcmV0dXJuIHJlc29sdmUoW10pO1xuICB9XG5cbiAgdmFyIHZhbHVlcyA9IG5ldyBBcnJheShsZW4pO1xuICB2YXIgcmVzb2x2ZWQgPSAwO1xuICB2YXIgaSA9IC0xO1xuICB2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKElOVEVSTkFMKTtcbiAgXG4gIHdoaWxlICgrK2kgPCBsZW4pIHtcbiAgICBhbGxSZXNvbHZlcihpdGVyYWJsZVtpXSwgaSk7XG4gIH1cbiAgcmV0dXJuIHByb21pc2U7XG4gIGZ1bmN0aW9uIGFsbFJlc29sdmVyKHZhbHVlLCBpKSB7XG4gICAgcmVzb2x2ZSh2YWx1ZSkudGhlbihyZXNvbHZlRnJvbUFsbCwgZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICBpZiAoIWNhbGxlZCkge1xuICAgICAgICBjYWxsZWQgPSB0cnVlO1xuICAgICAgICBoYW5kbGVycy5yZWplY3QocHJvbWlzZSwgZXJyb3IpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGZ1bmN0aW9uIHJlc29sdmVGcm9tQWxsKG91dFZhbHVlKSB7XG4gICAgICB2YWx1ZXNbaV0gPSBvdXRWYWx1ZTtcbiAgICAgIGlmICgrK3Jlc29sdmVkID09PSBsZW4gJiAhY2FsbGVkKSB7XG4gICAgICAgIGNhbGxlZCA9IHRydWU7XG4gICAgICAgIGhhbmRsZXJzLnJlc29sdmUocHJvbWlzZSwgdmFsdWVzKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn0iLCIndXNlIHN0cmljdCc7XG52YXIgdHJ5Q2F0Y2ggPSByZXF1aXJlKCcuL3RyeUNhdGNoJyk7XG52YXIgcmVzb2x2ZVRoZW5hYmxlID0gcmVxdWlyZSgnLi9yZXNvbHZlVGhlbmFibGUnKTtcbnZhciBzdGF0ZXMgPSByZXF1aXJlKCcuL3N0YXRlcycpO1xuXG5leHBvcnRzLnJlc29sdmUgPSBmdW5jdGlvbiAoc2VsZiwgdmFsdWUpIHtcbiAgdmFyIHJlc3VsdCA9IHRyeUNhdGNoKGdldFRoZW4sIHZhbHVlKTtcbiAgaWYgKHJlc3VsdC5zdGF0dXMgPT09ICdlcnJvcicpIHtcbiAgICByZXR1cm4gZXhwb3J0cy5yZWplY3Qoc2VsZiwgcmVzdWx0LnZhbHVlKTtcbiAgfVxuICB2YXIgdGhlbmFibGUgPSByZXN1bHQudmFsdWU7XG5cbiAgaWYgKHRoZW5hYmxlKSB7XG4gICAgcmVzb2x2ZVRoZW5hYmxlLnNhZmVseShzZWxmLCB0aGVuYWJsZSk7XG4gIH0gZWxzZSB7XG4gICAgc2VsZi5zdGF0ZSA9IHN0YXRlcy5GVUxGSUxMRUQ7XG4gICAgc2VsZi5vdXRjb21lID0gdmFsdWU7XG4gICAgdmFyIGkgPSAtMTtcbiAgICB2YXIgbGVuID0gc2VsZi5xdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUgKCsraSA8IGxlbikge1xuICAgICAgc2VsZi5xdWV1ZVtpXS5jYWxsRnVsZmlsbGVkKHZhbHVlKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHNlbGY7XG59O1xuZXhwb3J0cy5yZWplY3QgPSBmdW5jdGlvbiAoc2VsZiwgZXJyb3IpIHtcbiAgc2VsZi5zdGF0ZSA9IHN0YXRlcy5SRUpFQ1RFRDtcbiAgc2VsZi5vdXRjb21lID0gZXJyb3I7XG4gIHZhciBpID0gLTE7XG4gIHZhciBsZW4gPSBzZWxmLnF1ZXVlLmxlbmd0aDtcbiAgd2hpbGUgKCsraSA8IGxlbikge1xuICAgIHNlbGYucXVldWVbaV0uY2FsbFJlamVjdGVkKGVycm9yKTtcbiAgfVxuICByZXR1cm4gc2VsZjtcbn07XG5cbmZ1bmN0aW9uIGdldFRoZW4ob2JqKSB7XG4gIC8vIE1ha2Ugc3VyZSB3ZSBvbmx5IGFjY2VzcyB0aGUgYWNjZXNzb3Igb25jZSBhcyByZXF1aXJlZCBieSB0aGUgc3BlY1xuICB2YXIgdGhlbiA9IG9iaiAmJiBvYmoudGhlbjtcbiAgaWYgKG9iaiAmJiB0eXBlb2Ygb2JqID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgdGhlbiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHJldHVybiBmdW5jdGlvbiBhcHB5VGhlbigpIHtcbiAgICAgIHRoZW4uYXBwbHkob2JqLCBhcmd1bWVudHMpO1xuICAgIH07XG4gIH1cbn0iLCJtb2R1bGUuZXhwb3J0cyA9IGV4cG9ydHMgPSByZXF1aXJlKCcuL3Byb21pc2UnKTtcblxuZXhwb3J0cy5yZXNvbHZlID0gcmVxdWlyZSgnLi9yZXNvbHZlJyk7XG5leHBvcnRzLnJlamVjdCA9IHJlcXVpcmUoJy4vcmVqZWN0Jyk7XG5leHBvcnRzLmFsbCA9IHJlcXVpcmUoJy4vYWxsJyk7XG5leHBvcnRzLnJhY2UgPSByZXF1aXJlKCcuL3JhY2UnKTsiLCIndXNlIHN0cmljdCc7XG5cbnZhciB1bndyYXAgPSByZXF1aXJlKCcuL3Vud3JhcCcpO1xudmFyIElOVEVSTkFMID0gcmVxdWlyZSgnLi9JTlRFUk5BTCcpO1xudmFyIHJlc29sdmVUaGVuYWJsZSA9IHJlcXVpcmUoJy4vcmVzb2x2ZVRoZW5hYmxlJyk7XG52YXIgc3RhdGVzID0gcmVxdWlyZSgnLi9zdGF0ZXMnKTtcbnZhciBRdWV1ZUl0ZW0gPSByZXF1aXJlKCcuL3F1ZXVlSXRlbScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFByb21pc2U7XG5mdW5jdGlvbiBQcm9taXNlKHJlc29sdmVyKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBQcm9taXNlKSkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlcik7XG4gIH1cbiAgaWYgKHR5cGVvZiByZXNvbHZlciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3Jlc29sdmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuICB9XG4gIHRoaXMuc3RhdGUgPSBzdGF0ZXMuUEVORElORztcbiAgdGhpcy5xdWV1ZSA9IFtdO1xuICB0aGlzLm91dGNvbWUgPSB2b2lkIDA7XG4gIGlmIChyZXNvbHZlciAhPT0gSU5URVJOQUwpIHtcbiAgICByZXNvbHZlVGhlbmFibGUuc2FmZWx5KHRoaXMsIHJlc29sdmVyKTtcbiAgfVxufVxuXG5Qcm9taXNlLnByb3RvdHlwZVsnY2F0Y2gnXSA9IGZ1bmN0aW9uIChvblJlamVjdGVkKSB7XG4gIHJldHVybiB0aGlzLnRoZW4obnVsbCwgb25SZWplY3RlZCk7XG59O1xuUHJvbWlzZS5wcm90b3R5cGUudGhlbiA9IGZ1bmN0aW9uIChvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCkge1xuICBpZiAodHlwZW9mIG9uRnVsZmlsbGVkICE9PSAnZnVuY3Rpb24nICYmIHRoaXMuc3RhdGUgPT09IHN0YXRlcy5GVUxGSUxMRUQgfHxcbiAgICB0eXBlb2Ygb25SZWplY3RlZCAhPT0gJ2Z1bmN0aW9uJyAmJiB0aGlzLnN0YXRlID09PSBzdGF0ZXMuUkVKRUNURUQpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICB2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKElOVEVSTkFMKTtcblxuICBcbiAgaWYgKHRoaXMuc3RhdGUgIT09IHN0YXRlcy5QRU5ESU5HKSB7XG4gICAgdmFyIHJlc29sdmVyID0gdGhpcy5zdGF0ZSA9PT0gc3RhdGVzLkZVTEZJTExFRCA/IG9uRnVsZmlsbGVkOiBvblJlamVjdGVkO1xuICAgIHVud3JhcChwcm9taXNlLCByZXNvbHZlciwgdGhpcy5vdXRjb21lKTtcbiAgfSBlbHNlIHtcbiAgICB0aGlzLnF1ZXVlLnB1c2gobmV3IFF1ZXVlSXRlbShwcm9taXNlLCBvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCkpO1xuICB9XG5cbiAgcmV0dXJuIHByb21pc2U7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xudmFyIGhhbmRsZXJzID0gcmVxdWlyZSgnLi9oYW5kbGVycycpO1xudmFyIHVud3JhcCA9IHJlcXVpcmUoJy4vdW53cmFwJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gUXVldWVJdGVtO1xuZnVuY3Rpb24gUXVldWVJdGVtKHByb21pc2UsIG9uRnVsZmlsbGVkLCBvblJlamVjdGVkKSB7XG4gIHRoaXMucHJvbWlzZSA9IHByb21pc2U7XG4gIGlmICh0eXBlb2Ygb25GdWxmaWxsZWQgPT09ICdmdW5jdGlvbicpIHtcbiAgICB0aGlzLm9uRnVsZmlsbGVkID0gb25GdWxmaWxsZWQ7XG4gICAgdGhpcy5jYWxsRnVsZmlsbGVkID0gdGhpcy5vdGhlckNhbGxGdWxmaWxsZWQ7XG4gIH1cbiAgaWYgKHR5cGVvZiBvblJlamVjdGVkID09PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhpcy5vblJlamVjdGVkID0gb25SZWplY3RlZDtcbiAgICB0aGlzLmNhbGxSZWplY3RlZCA9IHRoaXMub3RoZXJDYWxsUmVqZWN0ZWQ7XG4gIH1cbn1cblF1ZXVlSXRlbS5wcm90b3R5cGUuY2FsbEZ1bGZpbGxlZCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICBoYW5kbGVycy5yZXNvbHZlKHRoaXMucHJvbWlzZSwgdmFsdWUpO1xufTtcblF1ZXVlSXRlbS5wcm90b3R5cGUub3RoZXJDYWxsRnVsZmlsbGVkID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIHVud3JhcCh0aGlzLnByb21pc2UsIHRoaXMub25GdWxmaWxsZWQsIHZhbHVlKTtcbn07XG5RdWV1ZUl0ZW0ucHJvdG90eXBlLmNhbGxSZWplY3RlZCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICBoYW5kbGVycy5yZWplY3QodGhpcy5wcm9taXNlLCB2YWx1ZSk7XG59O1xuUXVldWVJdGVtLnByb3RvdHlwZS5vdGhlckNhbGxSZWplY3RlZCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICB1bndyYXAodGhpcy5wcm9taXNlLCB0aGlzLm9uUmVqZWN0ZWQsIHZhbHVlKTtcbn07IiwiJ3VzZSBzdHJpY3QnO1xudmFyIFByb21pc2UgPSByZXF1aXJlKCcuL3Byb21pc2UnKTtcbnZhciByZWplY3QgPSByZXF1aXJlKCcuL3JlamVjdCcpO1xudmFyIHJlc29sdmUgPSByZXF1aXJlKCcuL3Jlc29sdmUnKTtcbnZhciBJTlRFUk5BTCA9IHJlcXVpcmUoJy4vSU5URVJOQUwnKTtcbnZhciBoYW5kbGVycyA9IHJlcXVpcmUoJy4vaGFuZGxlcnMnKTtcbm1vZHVsZS5leHBvcnRzID0gcmFjZTtcbmZ1bmN0aW9uIHJhY2UoaXRlcmFibGUpIHtcbiAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChpdGVyYWJsZSkgIT09ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICByZXR1cm4gcmVqZWN0KG5ldyBUeXBlRXJyb3IoJ211c3QgYmUgYW4gYXJyYXknKSk7XG4gIH1cblxuICB2YXIgbGVuID0gaXRlcmFibGUubGVuZ3RoO1xuICB2YXIgY2FsbGVkID0gZmFsc2U7XG4gIGlmICghbGVuKSB7XG4gICAgcmV0dXJuIHJlc29sdmUoW10pO1xuICB9XG5cbiAgdmFyIHJlc29sdmVkID0gMDtcbiAgdmFyIGkgPSAtMTtcbiAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZShJTlRFUk5BTCk7XG4gIFxuICB3aGlsZSAoKytpIDwgbGVuKSB7XG4gICAgcmVzb2x2ZXIoaXRlcmFibGVbaV0pO1xuICB9XG4gIHJldHVybiBwcm9taXNlO1xuICBmdW5jdGlvbiByZXNvbHZlcih2YWx1ZSkge1xuICAgIHJlc29sdmUodmFsdWUpLnRoZW4oZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG4gICAgICBpZiAoIWNhbGxlZCkge1xuICAgICAgICBjYWxsZWQgPSB0cnVlO1xuICAgICAgICBoYW5kbGVycy5yZXNvbHZlKHByb21pc2UsIHJlc3BvbnNlKTtcbiAgICAgIH1cbiAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgIGlmICghY2FsbGVkKSB7XG4gICAgICAgIGNhbGxlZCA9IHRydWU7XG4gICAgICAgIGhhbmRsZXJzLnJlamVjdChwcm9taXNlLCBlcnJvcik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn0iLCIndXNlIHN0cmljdCc7XG5cbnZhciBQcm9taXNlID0gcmVxdWlyZSgnLi9wcm9taXNlJyk7XG52YXIgSU5URVJOQUwgPSByZXF1aXJlKCcuL0lOVEVSTkFMJyk7XG52YXIgaGFuZGxlcnMgPSByZXF1aXJlKCcuL2hhbmRsZXJzJyk7XG5tb2R1bGUuZXhwb3J0cyA9IHJlamVjdDtcblxuZnVuY3Rpb24gcmVqZWN0KHJlYXNvbikge1xuXHR2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKElOVEVSTkFMKTtcblx0cmV0dXJuIGhhbmRsZXJzLnJlamVjdChwcm9taXNlLCByZWFzb24pO1xufSIsIid1c2Ugc3RyaWN0JztcblxudmFyIFByb21pc2UgPSByZXF1aXJlKCcuL3Byb21pc2UnKTtcbnZhciBJTlRFUk5BTCA9IHJlcXVpcmUoJy4vSU5URVJOQUwnKTtcbnZhciBoYW5kbGVycyA9IHJlcXVpcmUoJy4vaGFuZGxlcnMnKTtcbm1vZHVsZS5leHBvcnRzID0gcmVzb2x2ZTtcblxudmFyIEZBTFNFID0gaGFuZGxlcnMucmVzb2x2ZShuZXcgUHJvbWlzZShJTlRFUk5BTCksIGZhbHNlKTtcbnZhciBOVUxMID0gaGFuZGxlcnMucmVzb2x2ZShuZXcgUHJvbWlzZShJTlRFUk5BTCksIG51bGwpO1xudmFyIFVOREVGSU5FRCA9IGhhbmRsZXJzLnJlc29sdmUobmV3IFByb21pc2UoSU5URVJOQUwpLCB2b2lkIDApO1xudmFyIFpFUk8gPSBoYW5kbGVycy5yZXNvbHZlKG5ldyBQcm9taXNlKElOVEVSTkFMKSwgMCk7XG52YXIgRU1QVFlTVFJJTkcgPSBoYW5kbGVycy5yZXNvbHZlKG5ldyBQcm9taXNlKElOVEVSTkFMKSwgJycpO1xuXG5mdW5jdGlvbiByZXNvbHZlKHZhbHVlKSB7XG4gIGlmICh2YWx1ZSkge1xuICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIFByb21pc2UpIHtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGhhbmRsZXJzLnJlc29sdmUobmV3IFByb21pc2UoSU5URVJOQUwpLCB2YWx1ZSk7XG4gIH1cbiAgdmFyIHZhbHVlVHlwZSA9IHR5cGVvZiB2YWx1ZTtcbiAgc3dpdGNoICh2YWx1ZVR5cGUpIHtcbiAgICBjYXNlICdib29sZWFuJzpcbiAgICAgIHJldHVybiBGQUxTRTtcbiAgICBjYXNlICd1bmRlZmluZWQnOlxuICAgICAgcmV0dXJuIFVOREVGSU5FRDtcbiAgICBjYXNlICdvYmplY3QnOlxuICAgICAgcmV0dXJuIE5VTEw7XG4gICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgIHJldHVybiBaRVJPO1xuICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICByZXR1cm4gRU1QVFlTVFJJTkc7XG4gIH1cbn0iLCIndXNlIHN0cmljdCc7XG52YXIgaGFuZGxlcnMgPSByZXF1aXJlKCcuL2hhbmRsZXJzJyk7XG52YXIgdHJ5Q2F0Y2ggPSByZXF1aXJlKCcuL3RyeUNhdGNoJyk7XG5mdW5jdGlvbiBzYWZlbHlSZXNvbHZlVGhlbmFibGUoc2VsZiwgdGhlbmFibGUpIHtcbiAgLy8gRWl0aGVyIGZ1bGZpbGwsIHJlamVjdCBvciByZWplY3Qgd2l0aCBlcnJvclxuICB2YXIgY2FsbGVkID0gZmFsc2U7XG4gIGZ1bmN0aW9uIG9uRXJyb3IodmFsdWUpIHtcbiAgICBpZiAoY2FsbGVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNhbGxlZCA9IHRydWU7XG4gICAgaGFuZGxlcnMucmVqZWN0KHNlbGYsIHZhbHVlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9uU3VjY2Vzcyh2YWx1ZSkge1xuICAgIGlmIChjYWxsZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY2FsbGVkID0gdHJ1ZTtcbiAgICBoYW5kbGVycy5yZXNvbHZlKHNlbGYsIHZhbHVlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRyeVRvVW53cmFwKCkge1xuICAgIHRoZW5hYmxlKG9uU3VjY2Vzcywgb25FcnJvcik7XG4gIH1cbiAgXG4gIHZhciByZXN1bHQgPSB0cnlDYXRjaCh0cnlUb1Vud3JhcCk7XG4gIGlmIChyZXN1bHQuc3RhdHVzID09PSAnZXJyb3InKSB7XG4gICAgb25FcnJvcihyZXN1bHQudmFsdWUpO1xuICB9XG59XG5leHBvcnRzLnNhZmVseSA9IHNhZmVseVJlc29sdmVUaGVuYWJsZTsiLCIvLyBMYXp5IG1hbidzIHN5bWJvbHMgZm9yIHN0YXRlc1xuXG5leHBvcnRzLlJFSkVDVEVEID0gWydSRUpFQ1RFRCddO1xuZXhwb3J0cy5GVUxGSUxMRUQgPSBbJ0ZVTEZJTExFRCddO1xuZXhwb3J0cy5QRU5ESU5HID0gWydQRU5ESU5HJ107IiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHRyeUNhdGNoO1xuXG5mdW5jdGlvbiB0cnlDYXRjaChmdW5jLCB2YWx1ZSkge1xuICB2YXIgb3V0ID0ge307XG4gIHRyeSB7XG4gICAgb3V0LnZhbHVlID0gZnVuYyh2YWx1ZSk7XG4gICAgb3V0LnN0YXR1cyA9ICdzdWNjZXNzJztcbiAgfSBjYXRjaCAoZSkge1xuICAgIG91dC5zdGF0dXMgPSAnZXJyb3InO1xuICAgIG91dC52YWx1ZSA9IGU7XG4gIH1cbiAgcmV0dXJuIG91dDtcbn0iLCIndXNlIHN0cmljdCc7XG5cbnZhciBpbW1lZGlhdGUgPSByZXF1aXJlKCdpbW1lZGlhdGUnKTtcbnZhciBoYW5kbGVycyA9IHJlcXVpcmUoJy4vaGFuZGxlcnMnKTtcbm1vZHVsZS5leHBvcnRzID0gdW53cmFwO1xuXG5mdW5jdGlvbiB1bndyYXAocHJvbWlzZSwgZnVuYywgdmFsdWUpIHtcbiAgaW1tZWRpYXRlKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcmV0dXJuVmFsdWU7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVyblZhbHVlID0gZnVuYyh2YWx1ZSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgcmV0dXJuIGhhbmRsZXJzLnJlamVjdChwcm9taXNlLCBlKTtcbiAgICB9XG4gICAgaWYgKHJldHVyblZhbHVlID09PSBwcm9taXNlKSB7XG4gICAgICBoYW5kbGVycy5yZWplY3QocHJvbWlzZSwgbmV3IFR5cGVFcnJvcignQ2Fubm90IHJlc29sdmUgcHJvbWlzZSB3aXRoIGl0c2VsZicpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaGFuZGxlcnMucmVzb2x2ZShwcm9taXNlLCByZXR1cm5WYWx1ZSk7XG4gICAgfVxuICB9KTtcbn0iLCIndXNlIHN0cmljdCc7XG52YXIgdHlwZXMgPSBbXG4gIHJlcXVpcmUoJy4vbmV4dFRpY2snKSxcbiAgcmVxdWlyZSgnLi9tdXRhdGlvbi5qcycpLFxuICByZXF1aXJlKCcuL21lc3NhZ2VDaGFubmVsJyksXG4gIHJlcXVpcmUoJy4vc3RhdGVDaGFuZ2UnKSxcbiAgcmVxdWlyZSgnLi90aW1lb3V0Jylcbl07XG52YXIgZHJhaW5pbmc7XG52YXIgcXVldWUgPSBbXTtcbi8vbmFtZWQgbmV4dFRpY2sgZm9yIGxlc3MgY29uZnVzaW5nIHN0YWNrIHRyYWNlc1xuZnVuY3Rpb24gbmV4dFRpY2soKSB7XG4gIGRyYWluaW5nID0gdHJ1ZTtcbiAgdmFyIGksIG9sZFF1ZXVlO1xuICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICB3aGlsZSAobGVuKSB7XG4gICAgb2xkUXVldWUgPSBxdWV1ZTtcbiAgICBxdWV1ZSA9IFtdO1xuICAgIGkgPSAtMTtcbiAgICB3aGlsZSAoKytpIDwgbGVuKSB7XG4gICAgICBvbGRRdWV1ZVtpXSgpO1xuICAgIH1cbiAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gIH1cbiAgZHJhaW5pbmcgPSBmYWxzZTtcbn1cbnZhciBzY2hlZHVsZURyYWluO1xudmFyIGkgPSAtMTtcbnZhciBsZW4gPSB0eXBlcy5sZW5ndGg7XG53aGlsZSAoKysgaSA8IGxlbikge1xuICBpZiAodHlwZXNbaV0gJiYgdHlwZXNbaV0udGVzdCAmJiB0eXBlc1tpXS50ZXN0KCkpIHtcbiAgICBzY2hlZHVsZURyYWluID0gdHlwZXNbaV0uaW5zdGFsbChuZXh0VGljayk7XG4gICAgYnJlYWs7XG4gIH1cbn1cbm1vZHVsZS5leHBvcnRzID0gaW1tZWRpYXRlO1xuZnVuY3Rpb24gaW1tZWRpYXRlKHRhc2spIHtcbiAgaWYgKHF1ZXVlLnB1c2godGFzaykgPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgc2NoZWR1bGVEcmFpbigpO1xuICB9XG59IiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLnRlc3QgPSBmdW5jdGlvbiAoKSB7XG4gIGlmIChnbG9iYWwuc2V0SW1tZWRpYXRlKSB7XG4gICAgLy8gd2UgY2FuIG9ubHkgZ2V0IGhlcmUgaW4gSUUxMFxuICAgIC8vIHdoaWNoIGRvZXNuJ3QgaGFuZGVsIHBvc3RNZXNzYWdlIHdlbGxcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIHR5cGVvZiBnbG9iYWwuTWVzc2FnZUNoYW5uZWwgIT09ICd1bmRlZmluZWQnO1xufTtcblxuZXhwb3J0cy5pbnN0YWxsID0gZnVuY3Rpb24gKGZ1bmMpIHtcbiAgdmFyIGNoYW5uZWwgPSBuZXcgZ2xvYmFsLk1lc3NhZ2VDaGFubmVsKCk7XG4gIGNoYW5uZWwucG9ydDEub25tZXNzYWdlID0gZnVuYztcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICBjaGFubmVsLnBvcnQyLnBvc3RNZXNzYWdlKDApO1xuICB9O1xufTtcbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KSIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbid1c2Ugc3RyaWN0Jztcbi8vYmFzZWQgb2ZmIHJzdnAgaHR0cHM6Ly9naXRodWIuY29tL3RpbGRlaW8vcnN2cC5qc1xuLy9saWNlbnNlIGh0dHBzOi8vZ2l0aHViLmNvbS90aWxkZWlvL3JzdnAuanMvYmxvYi9tYXN0ZXIvTElDRU5TRVxuLy9odHRwczovL2dpdGh1Yi5jb20vdGlsZGVpby9yc3ZwLmpzL2Jsb2IvbWFzdGVyL2xpYi9yc3ZwL2FzYXAuanNcblxudmFyIE11dGF0aW9uID0gZ2xvYmFsLk11dGF0aW9uT2JzZXJ2ZXIgfHwgZ2xvYmFsLldlYktpdE11dGF0aW9uT2JzZXJ2ZXI7XG5cbmV4cG9ydHMudGVzdCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIE11dGF0aW9uO1xufTtcblxuZXhwb3J0cy5pbnN0YWxsID0gZnVuY3Rpb24gKGhhbmRsZSkge1xuICB2YXIgY2FsbGVkID0gMDtcbiAgdmFyIG9ic2VydmVyID0gbmV3IE11dGF0aW9uKGhhbmRsZSk7XG4gIHZhciBlbGVtZW50ID0gZ2xvYmFsLmRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcnKTtcbiAgb2JzZXJ2ZXIub2JzZXJ2ZShlbGVtZW50LCB7XG4gICAgY2hhcmFjdGVyRGF0YTogdHJ1ZVxuICB9KTtcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICBlbGVtZW50LmRhdGEgPSAoY2FsbGVkID0gKytjYWxsZWQgJSAyKTtcbiAgfTtcbn07XG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSkiLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG4ndXNlIHN0cmljdCc7XG5cbmV4cG9ydHMudGVzdCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuICdkb2N1bWVudCcgaW4gZ2xvYmFsICYmICdvbnJlYWR5c3RhdGVjaGFuZ2UnIGluIGdsb2JhbC5kb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKTtcbn07XG5cbmV4cG9ydHMuaW5zdGFsbCA9IGZ1bmN0aW9uIChoYW5kbGUpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcblxuICAgIC8vIENyZWF0ZSBhIDxzY3JpcHQ+IGVsZW1lbnQ7IGl0cyByZWFkeXN0YXRlY2hhbmdlIGV2ZW50IHdpbGwgYmUgZmlyZWQgYXN5bmNocm9ub3VzbHkgb25jZSBpdCBpcyBpbnNlcnRlZFxuICAgIC8vIGludG8gdGhlIGRvY3VtZW50LiBEbyBzbywgdGh1cyBxdWV1aW5nIHVwIHRoZSB0YXNrLiBSZW1lbWJlciB0byBjbGVhbiB1cCBvbmNlIGl0J3MgYmVlbiBjYWxsZWQuXG4gICAgdmFyIHNjcmlwdEVsID0gZ2xvYmFsLmRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpO1xuICAgIHNjcmlwdEVsLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIGhhbmRsZSgpO1xuXG4gICAgICBzY3JpcHRFbC5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBudWxsO1xuICAgICAgc2NyaXB0RWwucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChzY3JpcHRFbCk7XG4gICAgICBzY3JpcHRFbCA9IG51bGw7XG4gICAgfTtcbiAgICBnbG9iYWwuZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmFwcGVuZENoaWxkKHNjcmlwdEVsKTtcblxuICAgIHJldHVybiBoYW5kbGU7XG4gIH07XG59O1xufSkuY2FsbCh0aGlzLHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pIiwiJ3VzZSBzdHJpY3QnO1xuZXhwb3J0cy50ZXN0ID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdHJ1ZTtcbn07XG5cbmV4cG9ydHMuaW5zdGFsbCA9IGZ1bmN0aW9uICh0KSB7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgc2V0VGltZW91dCh0LCAwKTtcbiAgfTtcbn07IiwiKGZ1bmN0aW9uKCkge1xuICBpZiAodHlwZW9mIHNpZXN0YSA9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgbW9kdWxlID09ICd1bmRlZmluZWQnKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdDb3VsZCBub3QgZmluZCB3aW5kb3cuc2llc3RhLiBNYWtlIHN1cmUgeW91IGluY2x1ZGUgc2llc3RhLmNvcmUuanMgZmlyc3QuJyk7XG4gIH1cblxuICB2YXIgX2kgPSBzaWVzdGEuX2ludGVybmFsLFxuICAgIGNhY2hlID0gX2kuY2FjaGUsXG4gICAgQ29sbGVjdGlvblJlZ2lzdHJ5ID0gX2kuQ29sbGVjdGlvblJlZ2lzdHJ5LFxuICAgIGxvZyA9IF9pLmxvZygnc3RvcmFnZScpLFxuICAgIGVycm9yID0gX2kuZXJyb3IsXG4gICAgdXRpbCA9IF9pLnV0aWwsXG4gICAgXyA9IHV0aWwuXyxcbiAgICBldmVudHMgPSBfaS5ldmVudHM7XG5cbiAgdmFyIHVuc2F2ZWRPYmplY3RzID0gW10sXG4gICAgdW5zYXZlZE9iamVjdHNIYXNoID0ge30sXG4gICAgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb24gPSB7fTtcblxuICB2YXIgc3RvcmFnZSA9IHt9O1xuXG4gIC8vIFZhcmlhYmxlcyBiZWdpbm5pbmcgd2l0aCB1bmRlcnNjb3JlIGFyZSB0cmVhdGVkIGFzIHNwZWNpYWwgYnkgUG91Y2hEQi9Db3VjaERCIHNvIHdoZW4gc2VyaWFsaXNpbmcgd2UgbmVlZCB0b1xuICAvLyByZXBsYWNlIHdpdGggc29tZXRoaW5nIGVsc2UuXG4gIHZhciBVTkRFUlNDT1JFID0gL18vZyxcbiAgICBVTkRFUlNDT1JFX1JFUExBQ0VNRU5UID0gL0AvZztcblxuICBmdW5jdGlvbiBfaW5pdE1ldGEoKSB7XG4gICAgcmV0dXJuIHtkYXRlRmllbGRzOiBbXX07XG4gIH1cblxuICBmdW5jdGlvbiBmdWxseVF1YWxpZmllZE1vZGVsTmFtZShjb2xsZWN0aW9uTmFtZSwgbW9kZWxOYW1lKSB7XG4gICAgcmV0dXJuIGNvbGxlY3Rpb25OYW1lICsgJy4nICsgbW9kZWxOYW1lO1xuICB9XG5cbiAgaWYgKHR5cGVvZiBQb3VjaERCID09ICd1bmRlZmluZWQnKSB7XG4gICAgc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCA9IGZhbHNlO1xuICAgIGNvbnNvbGUubG9nKCdQb3VjaERCIGlzIG5vdCBwcmVzZW50IHRoZXJlZm9yZSBzdG9yYWdlIGlzIGRpc2FibGVkLicpO1xuICB9XG4gIGVsc2Uge1xuICAgIHZhciBEQl9OQU1FID0gJ3NpZXN0YScsXG4gICAgICBwb3VjaCA9IG5ldyBQb3VjaERCKERCX05BTUUsIHthdXRvX2NvbXBhY3Rpb246IHRydWV9KTtcblxuICAgIC8qKlxuICAgICAqIFNvbWV0aW1lcyBzaWVzdGEgbmVlZHMgdG8gc3RvcmUgc29tZSBleHRyYSBpbmZvcm1hdGlvbiBhYm91dCB0aGUgbW9kZWwgaW5zdGFuY2UuXG4gICAgICogQHBhcmFtIHNlcmlhbGlzZWRcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9hZGRNZXRhKHNlcmlhbGlzZWQpIHtcbiAgICAgIC8vIFBvdWNoREIgPD0gMy4yLjEgaGFzIGEgYnVnIHdoZXJlYnkgZGF0ZSBmaWVsZHMgYXJlIG5vdCBkZXNlcmlhbGlzZWQgcHJvcGVybHkgaWYgeW91IHVzZSBkYi5xdWVyeVxuICAgICAgLy8gdGhlcmVmb3JlIHdlIG5lZWQgdG8gYWRkIGV4dHJhIGluZm8gdG8gdGhlIG9iamVjdCBmb3IgZGVzZXJpYWxpc2luZyBkYXRlcyBtYW51YWxseS5cbiAgICAgIHNlcmlhbGlzZWQuc2llc3RhX21ldGEgPSBfaW5pdE1ldGEoKTtcbiAgICAgIGZvciAodmFyIHByb3AgaW4gc2VyaWFsaXNlZCkge1xuICAgICAgICBpZiAoc2VyaWFsaXNlZC5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgIGlmIChzZXJpYWxpc2VkW3Byb3BdIGluc3RhbmNlb2YgRGF0ZSkge1xuICAgICAgICAgICAgc2VyaWFsaXNlZC5zaWVzdGFfbWV0YS5kYXRlRmllbGRzLnB1c2gocHJvcCk7XG4gICAgICAgICAgICBzZXJpYWxpc2VkW3Byb3BdID0gc2VyaWFsaXNlZFtwcm9wXS5nZXRUaW1lKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX3Byb2Nlc3NNZXRhKGRhdHVtKSB7XG4gICAgICB2YXIgbWV0YSA9IGRhdHVtLnNpZXN0YV9tZXRhIHx8IF9pbml0TWV0YSgpO1xuICAgICAgbWV0YS5kYXRlRmllbGRzLmZvckVhY2goZnVuY3Rpb24oZGF0ZUZpZWxkKSB7XG4gICAgICAgIHZhciB2YWx1ZSA9IGRhdHVtW2RhdGVGaWVsZF07XG4gICAgICAgIGlmICghKHZhbHVlIGluc3RhbmNlb2YgRGF0ZSkpIHtcbiAgICAgICAgICBkYXR1bVtkYXRlRmllbGRdID0gbmV3IERhdGUodmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGRlbGV0ZSBkYXR1bS5zaWVzdGFfbWV0YTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjb25zdHJ1Y3RJbmRleERlc2lnbkRvYyhjb2xsZWN0aW9uTmFtZSwgbW9kZWxOYW1lKSB7XG4gICAgICB2YXIgZnVsbHlRdWFsaWZpZWROYW1lID0gZnVsbHlRdWFsaWZpZWRNb2RlbE5hbWUoY29sbGVjdGlvbk5hbWUsIG1vZGVsTmFtZSk7XG4gICAgICB2YXIgdmlld3MgPSB7fTtcbiAgICAgIHZpZXdzW2Z1bGx5UXVhbGlmaWVkTmFtZV0gPSB7XG4gICAgICAgIG1hcDogZnVuY3Rpb24oZG9jKSB7XG4gICAgICAgICAgaWYgKGRvYy5jb2xsZWN0aW9uID09ICckMScgJiYgZG9jLm1vZGVsID09ICckMicpIGVtaXQoZG9jLmNvbGxlY3Rpb24gKyAnLicgKyBkb2MubW9kZWwsIGRvYyk7XG4gICAgICAgIH0udG9TdHJpbmcoKS5yZXBsYWNlKCckMScsIGNvbGxlY3Rpb25OYW1lKS5yZXBsYWNlKCckMicsIG1vZGVsTmFtZSlcbiAgICAgIH07XG4gICAgICByZXR1cm4ge1xuICAgICAgICBfaWQ6ICdfZGVzaWduLycgKyBmdWxseVF1YWxpZmllZE5hbWUsXG4gICAgICAgIHZpZXdzOiB2aWV3c1xuICAgICAgfTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjb25zdHJ1Y3RJbmRleGVzRm9yQWxsTW9kZWxzKCkge1xuICAgICAgdmFyIGluZGV4ZXMgPSBbXTtcbiAgICAgIHZhciByZWdpc3RyeSA9IHNpZXN0YS5faW50ZXJuYWwuQ29sbGVjdGlvblJlZ2lzdHJ5O1xuICAgICAgcmVnaXN0cnkuY29sbGVjdGlvbk5hbWVzLmZvckVhY2goZnVuY3Rpb24oY29sbGVjdGlvbk5hbWUpIHtcbiAgICAgICAgdmFyIG1vZGVscyA9IHJlZ2lzdHJ5W2NvbGxlY3Rpb25OYW1lXS5fbW9kZWxzO1xuICAgICAgICBmb3IgKHZhciBtb2RlbE5hbWUgaW4gbW9kZWxzKSB7XG4gICAgICAgICAgaWYgKG1vZGVscy5oYXNPd25Qcm9wZXJ0eShtb2RlbE5hbWUpKSB7XG4gICAgICAgICAgICBpbmRleGVzLnB1c2goY29uc3RydWN0SW5kZXhEZXNpZ25Eb2MoY29sbGVjdGlvbk5hbWUsIG1vZGVsTmFtZSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICByZXR1cm4gaW5kZXhlcztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfX2Vuc3VyZUluZGV4ZXMoaW5kZXhlcywgY2IpIHtcbiAgICAgIHBvdWNoLmJ1bGtEb2NzKGluZGV4ZXMpXG4gICAgICAgIC50aGVuKGZ1bmN0aW9uKHJlc3ApIHtcbiAgICAgICAgICB2YXIgZXJyb3JzID0gW107XG4gICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXNwLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgcmVzcG9uc2UgPSByZXNwW2ldO1xuICAgICAgICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICAgICAgICAvLyBDb25mbGljdCBtZWFucyBhbHJlYWR5IGV4aXN0cywgYW5kIHRoaXMgaXMgZmluZSFcbiAgICAgICAgICAgICAgdmFyIGlzQ29uZmxpY3QgPSByZXNwb25zZS5zdGF0dXMgPT0gNDA5O1xuICAgICAgICAgICAgICBpZiAoIWlzQ29uZmxpY3QpIGVycm9ycy5wdXNoKHJlc3BvbnNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgY2IoZXJyb3JzLmxlbmd0aCA/IGVycm9yKCdtdWx0aXBsZSBlcnJvcnMnLCB7ZXJyb3JzOiBlcnJvcnN9KSA6IG51bGwpO1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goY2IpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGVuc3VyZUluZGV4ZXNGb3JBbGwoY2IpIHtcbiAgICAgIHZhciBpbmRleGVzID0gY29uc3RydWN0SW5kZXhlc0ZvckFsbE1vZGVscygpO1xuICAgICAgX19lbnN1cmVJbmRleGVzKGluZGV4ZXMsIGNiKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXJpYWxpc2UgYSBtb2RlbCBpbnRvIGEgZm9ybWF0IHRoYXQgUG91Y2hEQiBidWxrRG9jcyBBUEkgY2FuIHByb2Nlc3NcbiAgICAgKiBAcGFyYW0ge01vZGVsSW5zdGFuY2V9IG1vZGVsSW5zdGFuY2VcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfc2VyaWFsaXNlKG1vZGVsSW5zdGFuY2UpIHtcbiAgICAgIHZhciBzZXJpYWxpc2VkID0ge307XG4gICAgICB2YXIgX192YWx1ZXMgPSBtb2RlbEluc3RhbmNlLl9fdmFsdWVzO1xuICAgICAgc2VyaWFsaXNlZCA9IHNpZXN0YS5fLmV4dGVuZChzZXJpYWxpc2VkLCBfX3ZhbHVlcyk7XG4gICAgICBPYmplY3Qua2V5cyhzZXJpYWxpc2VkKS5mb3JFYWNoKGZ1bmN0aW9uKGspIHtcbiAgICAgICAgc2VyaWFsaXNlZFtrLnJlcGxhY2UoVU5ERVJTQ09SRSwgJ0AnKV0gPSBfX3ZhbHVlc1trXTtcbiAgICAgIH0pO1xuICAgICAgX2FkZE1ldGEoc2VyaWFsaXNlZCk7XG4gICAgICBzZXJpYWxpc2VkWydjb2xsZWN0aW9uJ10gPSBtb2RlbEluc3RhbmNlLmNvbGxlY3Rpb25OYW1lO1xuICAgICAgc2VyaWFsaXNlZFsnbW9kZWwnXSA9IG1vZGVsSW5zdGFuY2UubW9kZWxOYW1lO1xuICAgICAgc2VyaWFsaXNlZFsnX2lkJ10gPSBtb2RlbEluc3RhbmNlLmxvY2FsSWQ7XG4gICAgICBpZiAobW9kZWxJbnN0YW5jZS5yZW1vdmVkKSBzZXJpYWxpc2VkWydfZGVsZXRlZCddID0gdHJ1ZTtcbiAgICAgIHZhciByZXYgPSBtb2RlbEluc3RhbmNlLl9yZXY7XG4gICAgICBpZiAocmV2KSBzZXJpYWxpc2VkWydfcmV2J10gPSByZXY7XG4gICAgICBzZXJpYWxpc2VkID0gXy5yZWR1Y2UobW9kZWxJbnN0YW5jZS5fcmVsYXRpb25zaGlwTmFtZXMsIGZ1bmN0aW9uKG1lbW8sIG4pIHtcbiAgICAgICAgdmFyIHZhbCA9IG1vZGVsSW5zdGFuY2Vbbl07XG4gICAgICAgIGlmIChzaWVzdGEuaXNBcnJheSh2YWwpKSB7XG4gICAgICAgICAgLy8gSWYgdGhlIHJlbGF0ZWQgaXMgbm90IHN0b3JlZCB0aGVuIGl0IHdvdWxkbid0IG1ha2Ugc2Vuc2UgdG8gY3JlYXRlIGEgcmVsYXRpb24gaW4gc3RvcmFnZS5cbiAgICAgICAgICB2YWwgPSB2YWwuZmlsdGVyKGZ1bmN0aW9uKGluc3RhbmNlKSB7XG4gICAgICAgICAgICByZXR1cm4gaW5zdGFuY2UubW9kZWwuc3RvcmUoaW5zdGFuY2UpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIG1lbW9bbl0gPSBfLnBsdWNrKHZhbCwgJ2xvY2FsSWQnKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh2YWwpIHtcbiAgICAgICAgICAvLyBJZiB0aGUgcmVsYXRlZCBpcyBub3Qgc3RvcmVkIHRoZW4gaXQgd291bGRuJ3QgbWFrZSBzZW5zZSB0byBjcmVhdGUgYSByZWxhdGlvbiBpbiBzdG9yYWdlLlxuICAgICAgICAgIHZhciBzdG9yZSA9IHZhbC5tb2RlbC5zdG9yZSh2YWwpO1xuICAgICAgICAgIGlmIChzdG9yZSkgbWVtb1tuXSA9IHZhbC5sb2NhbElkO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgfSwgc2VyaWFsaXNlZCk7XG4gICAgICByZXR1cm4gc2VyaWFsaXNlZDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfcHJlcGFyZURhdHVtKHJhd0RhdHVtLCBtb2RlbCkge1xuICAgICAgX3Byb2Nlc3NNZXRhKHJhd0RhdHVtKTtcbiAgICAgIGRlbGV0ZSByYXdEYXR1bS5jb2xsZWN0aW9uO1xuICAgICAgZGVsZXRlIHJhd0RhdHVtLm1vZGVsO1xuICAgICAgcmF3RGF0dW0ubG9jYWxJZCA9IHJhd0RhdHVtLl9pZDtcbiAgICAgIGRlbGV0ZSByYXdEYXR1bS5faWQ7XG4gICAgICB2YXIgZGF0dW0gPSB7fTtcbiAgICAgIE9iamVjdC5rZXlzKHJhd0RhdHVtKS5mb3JFYWNoKGZ1bmN0aW9uKGspIHtcbiAgICAgICAgZGF0dW1bay5yZXBsYWNlKFVOREVSU0NPUkVfUkVQTEFDRU1FTlQsICdfJyldID0gcmF3RGF0dW1ba107XG4gICAgICB9KTtcblxuICAgICAgdmFyIHJlbGF0aW9uc2hpcE5hbWVzID0gbW9kZWwuX3JlbGF0aW9uc2hpcE5hbWVzO1xuICAgICAgXy5lYWNoKHJlbGF0aW9uc2hpcE5hbWVzLCBmdW5jdGlvbihyKSB7XG4gICAgICAgIHZhciBsb2NhbElkID0gZGF0dW1bcl07XG4gICAgICAgIGlmIChsb2NhbElkKSB7XG4gICAgICAgICAgaWYgKHNpZXN0YS5pc0FycmF5KGxvY2FsSWQpKSB7XG4gICAgICAgICAgICBkYXR1bVtyXSA9IF8ubWFwKGxvY2FsSWQsIGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHtsb2NhbElkOiB4fVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgZGF0dW1bcl0gPSB7bG9jYWxJZDogbG9jYWxJZH07XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIGRhdHVtO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIG9wdHNcbiAgICAgKiBAcGFyYW0gb3B0cy5jb2xsZWN0aW9uTmFtZVxuICAgICAqIEBwYXJhbSBvcHRzLm1vZGVsTmFtZVxuICAgICAqIEBwYXJhbSBjYWxsYmFja1xuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgZnVuY3Rpb24gX2xvYWRNb2RlbChvcHRzLCBjYWxsYmFjaykge1xuICAgICAgdmFyIGxvYWRlZCA9IHt9O1xuICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gb3B0cy5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgbW9kZWxOYW1lID0gb3B0cy5tb2RlbE5hbWU7XG4gICAgICB2YXIgZnVsbHlRdWFsaWZpZWROYW1lID0gZnVsbHlRdWFsaWZpZWRNb2RlbE5hbWUoY29sbGVjdGlvbk5hbWUsIG1vZGVsTmFtZSk7XG4gICAgICBsb2coJ0xvYWRpbmcgaW5zdGFuY2VzIGZvciAnICsgZnVsbHlRdWFsaWZpZWROYW1lKTtcbiAgICAgIHZhciBNb2RlbCA9IENvbGxlY3Rpb25SZWdpc3RyeVtjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXTtcbiAgICAgIGxvZygnUXVlcnlpbmcgcG91Y2gnKTtcbiAgICAgIHBvdWNoLnF1ZXJ5KGZ1bGx5UXVhbGlmaWVkTmFtZSlcbiAgICAgICAgLy9wb3VjaC5xdWVyeSh7bWFwOiBtYXBGdW5jfSlcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24ocmVzcCkge1xuICAgICAgICAgIGxvZygnUXVlcmllZCBwb3VjaCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgICB2YXIgcm93cyA9IHJlc3Aucm93cztcbiAgICAgICAgICB2YXIgZGF0YSA9IHNpZXN0YS5fLm1hcChzaWVzdGEuXy5wbHVjayhyb3dzLCAndmFsdWUnKSwgZnVuY3Rpb24oZGF0dW0pIHtcbiAgICAgICAgICAgIHJldHVybiBfcHJlcGFyZURhdHVtKGRhdHVtLCBNb2RlbCk7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICBzaWVzdGEuXy5tYXAoZGF0YSwgZnVuY3Rpb24oZGF0dW0pIHtcbiAgICAgICAgICAgIHZhciByZW1vdGVJZCA9IGRhdHVtW01vZGVsLmlkXTtcbiAgICAgICAgICAgIGlmIChyZW1vdGVJZCkge1xuICAgICAgICAgICAgICBpZiAobG9hZGVkW3JlbW90ZUlkXSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0R1cGxpY2F0ZXMgZGV0ZWN0ZWQgaW4gc3RvcmFnZS4gWW91IGhhdmUgZW5jb3VudGVyZWQgYSBzZXJpb3VzIGJ1Zy4gUGxlYXNlIHJlcG9ydCB0aGlzLicpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGxvYWRlZFtyZW1vdGVJZF0gPSBkYXR1bTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgbG9nKCdNYXBwaW5nIGRhdGEnLCBkYXRhKTtcblxuICAgICAgICAgIE1vZGVsLmdyYXBoKGRhdGEsIHtcbiAgICAgICAgICAgIF9pZ25vcmVJbnN0YWxsZWQ6IHRydWUsXG4gICAgICAgICAgICBmcm9tU3RvcmFnZTogdHJ1ZVxuICAgICAgICAgIH0sIGZ1bmN0aW9uKGVyciwgaW5zdGFuY2VzKSB7XG4gICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICBpZiAobG9nLmVuYWJsZWQpXG4gICAgICAgICAgICAgICAgbG9nKCdMb2FkZWQgJyArIGluc3RhbmNlcyA/IGluc3RhbmNlcy5sZW5ndGgudG9TdHJpbmcoKSA6IDAgKyAnIGluc3RhbmNlcyBmb3IgJyArIGZ1bGx5UXVhbGlmaWVkTmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgbG9nKCdFcnJvciBsb2FkaW5nIG1vZGVscycsIGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYWxsYmFjayhlcnIsIGluc3RhbmNlcyk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICB9KTtcblxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExvYWQgYWxsIGRhdGEgZnJvbSBQb3VjaERCLlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9sb2FkKGNiKSB7XG4gICAgICBpZiAoc2F2aW5nKSB0aHJvdyBuZXcgRXJyb3IoJ25vdCBsb2FkZWQgeWV0IGhvdyBjYW4gaSBzYXZlJyk7XG4gICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgICBpZiAoc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCkge1xuICAgICAgICAgIHZhciBjb2xsZWN0aW9uTmFtZXMgPSBDb2xsZWN0aW9uUmVnaXN0cnkuY29sbGVjdGlvbk5hbWVzO1xuICAgICAgICAgIHZhciB0YXNrcyA9IFtdO1xuICAgICAgICAgIF8uZWFjaChjb2xsZWN0aW9uTmFtZXMsIGZ1bmN0aW9uKGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgICAgICAgICB2YXIgY29sbGVjdGlvbiA9IENvbGxlY3Rpb25SZWdpc3RyeVtjb2xsZWN0aW9uTmFtZV0sXG4gICAgICAgICAgICAgIG1vZGVsTmFtZXMgPSBPYmplY3Qua2V5cyhjb2xsZWN0aW9uLl9tb2RlbHMpO1xuICAgICAgICAgICAgXy5lYWNoKG1vZGVsTmFtZXMsIGZ1bmN0aW9uKG1vZGVsTmFtZSkge1xuICAgICAgICAgICAgICB0YXNrcy5wdXNoKGZ1bmN0aW9uKGNiKSB7XG4gICAgICAgICAgICAgICAgLy8gV2UgY2FsbCBmcm9tIHN0b3JhZ2UgdG8gYWxsb3cgZm9yIHJlcGxhY2VtZW50IG9mIF9sb2FkTW9kZWwgZm9yIHBlcmZvcm1hbmNlIGV4dGVuc2lvbi5cbiAgICAgICAgICAgICAgICBzdG9yYWdlLl9sb2FkTW9kZWwoe1xuICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbk5hbWU6IGNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgICAgICAgbW9kZWxOYW1lOiBtb2RlbE5hbWVcbiAgICAgICAgICAgICAgICB9LCBjYik7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgc2llc3RhLmFzeW5jLnNlcmllcyh0YXNrcywgZnVuY3Rpb24oZXJyLCByZXN1bHRzKSB7XG4gICAgICAgICAgICB2YXIgbjtcbiAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgIHZhciBpbnN0YW5jZXMgPSBbXTtcbiAgICAgICAgICAgICAgc2llc3RhLl8uZWFjaChyZXN1bHRzLCBmdW5jdGlvbihyKSB7XG4gICAgICAgICAgICAgICAgaW5zdGFuY2VzID0gaW5zdGFuY2VzLmNvbmNhdChyKVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgbiA9IGluc3RhbmNlcy5sZW5ndGg7XG4gICAgICAgICAgICAgIGlmIChsb2cpIHtcbiAgICAgICAgICAgICAgICBsb2coJ0xvYWRlZCAnICsgbi50b1N0cmluZygpICsgJyBpbnN0YW5jZXMuIENhY2hlIHNpemUgaXMgJyArIGNhY2hlLmNvdW50KCksIHtcbiAgICAgICAgICAgICAgICAgIHJlbW90ZTogY2FjaGUuX3JlbW90ZUNhY2hlKCksXG4gICAgICAgICAgICAgICAgICBsb2NhbENhY2hlOiBjYWNoZS5fbG9jYWxDYWNoZSgpXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgc2llc3RhLm9uKCdTaWVzdGEnLCBsaXN0ZW5lcik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNiKGVyciwgbik7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgY2IoKTtcbiAgICAgICAgfVxuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzYXZlQ29uZmxpY3RzKG9iamVjdHMsIGNiKSB7XG4gICAgICBwb3VjaC5hbGxEb2NzKHtrZXlzOiBfLnBsdWNrKG9iamVjdHMsICdsb2NhbElkJyl9KVxuICAgICAgICAudGhlbihmdW5jdGlvbihyZXNwKSB7XG4gICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXNwLnJvd3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIG9iamVjdHNbaV0uX3JldiA9IHJlc3Aucm93c1tpXS52YWx1ZS5yZXY7XG4gICAgICAgICAgfVxuICAgICAgICAgIHNhdmVUb1BvdWNoKG9iamVjdHMsIGNiKTtcbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgIGNiKGVycik7XG4gICAgICAgIH0pXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2F2ZVRvUG91Y2gob2JqZWN0cywgY2IpIHtcbiAgICAgIHZhciBjb25mbGljdHMgPSBbXTtcbiAgICAgIHZhciBzZXJpYWxpc2VkRG9jcyA9IF8ubWFwKG9iamVjdHMsIF9zZXJpYWxpc2UpO1xuICAgICAgcG91Y2guYnVsa0RvY3Moc2VyaWFsaXNlZERvY3MpLnRoZW4oZnVuY3Rpb24ocmVzcCkge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlc3AubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICB2YXIgcmVzcG9uc2UgPSByZXNwW2ldO1xuICAgICAgICAgIHZhciBvYmogPSBvYmplY3RzW2ldO1xuICAgICAgICAgIGlmIChyZXNwb25zZS5vaykge1xuICAgICAgICAgICAgb2JqLl9yZXYgPSByZXNwb25zZS5yZXY7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2UgaWYgKHJlc3BvbnNlLnN0YXR1cyA9PSA0MDkpIHtcbiAgICAgICAgICAgIGNvbmZsaWN0cy5wdXNoKG9iaik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgbG9nKCdFcnJvciBzYXZpbmcgb2JqZWN0IHdpdGggbG9jYWxJZD1cIicgKyBvYmoubG9jYWxJZCArICdcIicsIHJlc3BvbnNlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvbmZsaWN0cy5sZW5ndGgpIHtcbiAgICAgICAgICBzYXZlQ29uZmxpY3RzKGNvbmZsaWN0cywgY2IpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGNiKCk7XG4gICAgICAgIH1cbiAgICAgIH0sIGZ1bmN0aW9uKGVycikge1xuICAgICAgICBjYihlcnIpO1xuICAgICAgfSk7XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBTYXZlIGFsbCBtb2RlbEV2ZW50cyBkb3duIHRvIFBvdWNoREIuXG4gICAgICovXG4gICAgZnVuY3Rpb24gc2F2ZShjYikge1xuICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgICAgc2llc3RhLl9hZnRlckluc3RhbGwoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIGluc3RhbmNlcyA9IHVuc2F2ZWRPYmplY3RzO1xuICAgICAgICAgIHVuc2F2ZWRPYmplY3RzID0gW107XG4gICAgICAgICAgdW5zYXZlZE9iamVjdHNIYXNoID0ge307XG4gICAgICAgICAgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb24gPSB7fTtcbiAgICAgICAgICBpbnN0YW5jZXMgPSBpbnN0YW5jZXMuZmlsdGVyKGZ1bmN0aW9uKGluc3RhbmNlKSB7XG4gICAgICAgICAgICByZXR1cm4gaW5zdGFuY2UubW9kZWwuc3RvcmUoaW5zdGFuY2UpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIGxvZygnU2F2aW5nIGluc3RhbmNlcycsIGluc3RhbmNlcyk7XG4gICAgICAgICAgc2F2ZVRvUG91Y2goaW5zdGFuY2VzLCBjYik7XG4gICAgICAgIH0pO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaXN0ZW5lcihuKSB7XG4gICAgICB2YXIgY2hhbmdlZE9iamVjdCA9IG4ub2JqLFxuICAgICAgICBpZGVudCA9IGNoYW5nZWRPYmplY3QubG9jYWxJZDtcbiAgICAgIGlmICghY2hhbmdlZE9iamVjdCkge1xuICAgICAgICB0aHJvdyBuZXcgX2kuZXJyb3IuSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gb2JqIGZpZWxkIGluIG5vdGlmaWNhdGlvbiByZWNlaXZlZCBieSBzdG9yYWdlIGV4dGVuc2lvbicpO1xuICAgICAgfVxuICAgICAgaWYgKCEoaWRlbnQgaW4gdW5zYXZlZE9iamVjdHNIYXNoKSkge1xuICAgICAgICB1bnNhdmVkT2JqZWN0c0hhc2hbaWRlbnRdID0gY2hhbmdlZE9iamVjdDtcbiAgICAgICAgdW5zYXZlZE9iamVjdHMucHVzaChjaGFuZ2VkT2JqZWN0KTtcbiAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gY2hhbmdlZE9iamVjdC5jb2xsZWN0aW9uTmFtZTtcbiAgICAgICAgaWYgKCF1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uTmFtZV0pIHtcbiAgICAgICAgICB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uTmFtZV0gPSB7fTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgbW9kZWxOYW1lID0gY2hhbmdlZE9iamVjdC5tb2RlbC5uYW1lO1xuICAgICAgICBpZiAoIXVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uW2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdKSB7XG4gICAgICAgICAgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV0gPSB7fTtcbiAgICAgICAgfVxuICAgICAgICB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXVtpZGVudF0gPSBjaGFuZ2VkT2JqZWN0O1xuICAgICAgfVxuICAgIH1cblxuICAgIF8uZXh0ZW5kKHN0b3JhZ2UsIHtcbiAgICAgIF9sb2FkOiBfbG9hZCxcbiAgICAgIF9sb2FkTW9kZWw6IF9sb2FkTW9kZWwsXG4gICAgICBzYXZlOiBzYXZlLFxuICAgICAgX3NlcmlhbGlzZTogX3NlcmlhbGlzZSxcbiAgICAgIGVuc3VyZUluZGV4ZXNGb3JBbGw6IGVuc3VyZUluZGV4ZXNGb3JBbGwsXG4gICAgICBfcmVzZXQ6IGZ1bmN0aW9uKGNiKSB7XG4gICAgICAgIHNpZXN0YS5yZW1vdmVMaXN0ZW5lcignU2llc3RhJywgbGlzdGVuZXIpO1xuICAgICAgICB1bnNhdmVkT2JqZWN0cyA9IFtdO1xuICAgICAgICB1bnNhdmVkT2JqZWN0c0hhc2ggPSB7fTtcbiAgICAgICAgcG91Y2guZGVzdHJveShmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgcG91Y2ggPSBuZXcgUG91Y2hEQihEQl9OQU1FKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgbG9nKCdSZXNldCBjb21wbGV0ZScpO1xuICAgICAgICAgIGNiKGVycik7XG4gICAgICAgIH0pXG4gICAgICB9XG5cbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHN0b3JhZ2UsIHtcbiAgICAgIF91bnNhdmVkT2JqZWN0czoge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiB1bnNhdmVkT2JqZWN0c1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgX3Vuc2F2ZWRPYmplY3RzSGFzaDoge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiB1bnNhdmVkT2JqZWN0c0hhc2hcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIF91bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbjoge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvblxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgX3BvdWNoOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuIHBvdWNoXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuXG4gICAgaWYgKCFzaWVzdGEuZXh0KSBzaWVzdGEuZXh0ID0ge307XG4gICAgc2llc3RhLmV4dC5zdG9yYWdlID0gc3RvcmFnZTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHNpZXN0YS5leHQsIHtcbiAgICAgIHN0b3JhZ2VFbmFibGVkOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgaWYgKHNpZXN0YS5leHQuX3N0b3JhZ2VFbmFibGVkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBzaWVzdGEuZXh0Ll9zdG9yYWdlRW5hYmxlZDtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuICEhc2llc3RhLmV4dC5zdG9yYWdlO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uKHYpIHtcbiAgICAgICAgICBzaWVzdGEuZXh0Ll9zdG9yYWdlRW5hYmxlZCA9IHY7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHZhciBpbnRlcnZhbCwgc2F2aW5nLCBhdXRvc2F2ZUludGVydmFsID0gMTAwMDtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHNpZXN0YSwge1xuICAgICAgYXV0b3NhdmU6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gISFpbnRlcnZhbDtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbihhdXRvc2F2ZSkge1xuICAgICAgICAgIGlmIChhdXRvc2F2ZSkge1xuICAgICAgICAgICAgaWYgKCFpbnRlcnZhbCkge1xuICAgICAgICAgICAgICBpbnRlcnZhbCA9IHNldEludGVydmFsKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIC8vIENoZWVreSB3YXkgb2YgYXZvaWRpbmcgbXVsdGlwbGUgc2F2ZXMgaGFwcGVuaW5nLi4uXG4gICAgICAgICAgICAgICAgaWYgKCFzYXZpbmcpIHtcbiAgICAgICAgICAgICAgICAgIHNhdmluZyA9IHRydWU7XG4gICAgICAgICAgICAgICAgICBzaWVzdGEuc2F2ZShmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICBldmVudHMuZW1pdCgnc2F2ZWQnKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBzYXZpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSwgc2llc3RhLmF1dG9zYXZlSW50ZXJ2YWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGlmIChpbnRlcnZhbCkge1xuICAgICAgICAgICAgICBjbGVhckludGVydmFsKGludGVydmFsKTtcbiAgICAgICAgICAgICAgaW50ZXJ2YWwgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGF1dG9zYXZlSW50ZXJ2YWw6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gYXV0b3NhdmVJbnRlcnZhbDtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbihfYXV0b3NhdmVJbnRlcnZhbCkge1xuICAgICAgICAgIGF1dG9zYXZlSW50ZXJ2YWwgPSBfYXV0b3NhdmVJbnRlcnZhbDtcbiAgICAgICAgICBpZiAoaW50ZXJ2YWwpIHtcbiAgICAgICAgICAgIC8vIFJlc2V0IGludGVydmFsXG4gICAgICAgICAgICBzaWVzdGEuYXV0b3NhdmUgPSBmYWxzZTtcbiAgICAgICAgICAgIHNpZXN0YS5hdXRvc2F2ZSA9IHRydWU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgZGlydHk6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb24gPSBzaWVzdGEuZXh0LnN0b3JhZ2UuX3Vuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uO1xuICAgICAgICAgIHJldHVybiAhIU9iamVjdC5rZXlzKHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uKS5sZW5ndGg7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIF8uZXh0ZW5kKHNpZXN0YSwge1xuICAgICAgc2F2ZTogc2F2ZSxcbiAgICAgIHNldFBvdWNoOiBmdW5jdGlvbihfcCkge1xuICAgICAgICBpZiAoc2llc3RhLl9jYW5DaGFuZ2UpIHBvdWNoID0gX3A7XG4gICAgICAgIGVsc2UgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgY2hhbmdlIFBvdWNoREIgaW5zdGFuY2Ugd2hlbiBhbiBvYmplY3QgZ3JhcGggZXhpc3RzLicpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gIH1cblxuICBtb2R1bGUuZXhwb3J0cyA9IHN0b3JhZ2U7XG5cbn0pKCk7IiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuLypcbiAqIENvcHlyaWdodCAoYykgMjAxNCBUaGUgUG9seW1lciBQcm9qZWN0IEF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiBUaGlzIGNvZGUgbWF5IG9ubHkgYmUgdXNlZCB1bmRlciB0aGUgQlNEIHN0eWxlIGxpY2Vuc2UgZm91bmQgYXQgaHR0cDovL3BvbHltZXIuZ2l0aHViLmlvL0xJQ0VOU0UudHh0XG4gKiBUaGUgY29tcGxldGUgc2V0IG9mIGF1dGhvcnMgbWF5IGJlIGZvdW5kIGF0IGh0dHA6Ly9wb2x5bWVyLmdpdGh1Yi5pby9BVVRIT1JTLnR4dFxuICogVGhlIGNvbXBsZXRlIHNldCBvZiBjb250cmlidXRvcnMgbWF5IGJlIGZvdW5kIGF0IGh0dHA6Ly9wb2x5bWVyLmdpdGh1Yi5pby9DT05UUklCVVRPUlMudHh0XG4gKiBDb2RlIGRpc3RyaWJ1dGVkIGJ5IEdvb2dsZSBhcyBwYXJ0IG9mIHRoZSBwb2x5bWVyIHByb2plY3QgaXMgYWxzb1xuICogc3ViamVjdCB0byBhbiBhZGRpdGlvbmFsIElQIHJpZ2h0cyBncmFudCBmb3VuZCBhdCBodHRwOi8vcG9seW1lci5naXRodWIuaW8vUEFURU5UUy50eHRcbiAqL1xuXG4oZnVuY3Rpb24oZ2xvYmFsKSB7XG4gICd1c2Ugc3RyaWN0JztcblxuICB2YXIgdGVzdGluZ0V4cG9zZUN5Y2xlQ291bnQgPSBnbG9iYWwudGVzdGluZ0V4cG9zZUN5Y2xlQ291bnQ7XG5cbiAgLy8gRGV0ZWN0IGFuZCBkbyBiYXNpYyBzYW5pdHkgY2hlY2tpbmcgb24gT2JqZWN0L0FycmF5Lm9ic2VydmUuXG4gIGZ1bmN0aW9uIGRldGVjdE9iamVjdE9ic2VydmUoKSB7XG4gICAgaWYgKHR5cGVvZiBPYmplY3Qub2JzZXJ2ZSAhPT0gJ2Z1bmN0aW9uJyB8fFxuICAgICAgICB0eXBlb2YgQXJyYXkub2JzZXJ2ZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHZhciByZWNvcmRzID0gW107XG5cbiAgICBmdW5jdGlvbiBjYWxsYmFjayhyZWNzKSB7XG4gICAgICByZWNvcmRzID0gcmVjcztcbiAgICB9XG5cbiAgICB2YXIgdGVzdCA9IHt9O1xuICAgIHZhciBhcnIgPSBbXTtcbiAgICBPYmplY3Qub2JzZXJ2ZSh0ZXN0LCBjYWxsYmFjayk7XG4gICAgQXJyYXkub2JzZXJ2ZShhcnIsIGNhbGxiYWNrKTtcbiAgICB0ZXN0LmlkID0gMTtcbiAgICB0ZXN0LmlkID0gMjtcbiAgICBkZWxldGUgdGVzdC5pZDtcbiAgICBhcnIucHVzaCgxLCAyKTtcbiAgICBhcnIubGVuZ3RoID0gMDtcblxuICAgIE9iamVjdC5kZWxpdmVyQ2hhbmdlUmVjb3JkcyhjYWxsYmFjayk7XG4gICAgaWYgKHJlY29yZHMubGVuZ3RoICE9PSA1KVxuICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgaWYgKHJlY29yZHNbMF0udHlwZSAhPSAnYWRkJyB8fFxuICAgICAgICByZWNvcmRzWzFdLnR5cGUgIT0gJ3VwZGF0ZScgfHxcbiAgICAgICAgcmVjb3Jkc1syXS50eXBlICE9ICdkZWxldGUnIHx8XG4gICAgICAgIHJlY29yZHNbM10udHlwZSAhPSAnc3BsaWNlJyB8fFxuICAgICAgICByZWNvcmRzWzRdLnR5cGUgIT0gJ3NwbGljZScpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBPYmplY3QudW5vYnNlcnZlKHRlc3QsIGNhbGxiYWNrKTtcbiAgICBBcnJheS51bm9ic2VydmUoYXJyLCBjYWxsYmFjayk7XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHZhciBoYXNPYnNlcnZlID0gZGV0ZWN0T2JqZWN0T2JzZXJ2ZSgpO1xuXG4gIGZ1bmN0aW9uIGRldGVjdEV2YWwoKSB7XG4gICAgLy8gRG9uJ3QgdGVzdCBmb3IgZXZhbCBpZiB3ZSdyZSBydW5uaW5nIGluIGEgQ2hyb21lIEFwcCBlbnZpcm9ubWVudC5cbiAgICAvLyBXZSBjaGVjayBmb3IgQVBJcyBzZXQgdGhhdCBvbmx5IGV4aXN0IGluIGEgQ2hyb21lIEFwcCBjb250ZXh0LlxuICAgIGlmICh0eXBlb2YgY2hyb21lICE9PSAndW5kZWZpbmVkJyAmJiBjaHJvbWUuYXBwICYmIGNocm9tZS5hcHAucnVudGltZSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIEZpcmVmb3ggT1MgQXBwcyBkbyBub3QgYWxsb3cgZXZhbC4gVGhpcyBmZWF0dXJlIGRldGVjdGlvbiBpcyB2ZXJ5IGhhY2t5XG4gICAgLy8gYnV0IGV2ZW4gaWYgc29tZSBvdGhlciBwbGF0Zm9ybSBhZGRzIHN1cHBvcnQgZm9yIHRoaXMgZnVuY3Rpb24gdGhpcyBjb2RlXG4gICAgLy8gd2lsbCBjb250aW51ZSB0byB3b3JrLlxuICAgIGlmIChuYXZpZ2F0b3IuZ2V0RGV2aWNlU3RvcmFnZSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICB2YXIgZiA9IG5ldyBGdW5jdGlvbignJywgJ3JldHVybiB0cnVlOycpO1xuICAgICAgcmV0dXJuIGYoKTtcbiAgICB9IGNhdGNoIChleCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIHZhciBoYXNFdmFsID0gZGV0ZWN0RXZhbCgpO1xuXG4gIGZ1bmN0aW9uIGlzSW5kZXgocykge1xuICAgIHJldHVybiArcyA9PT0gcyA+Pj4gMCAmJiBzICE9PSAnJztcbiAgfVxuXG4gIGZ1bmN0aW9uIHRvTnVtYmVyKHMpIHtcbiAgICByZXR1cm4gK3M7XG4gIH1cblxuICB2YXIgbnVtYmVySXNOYU4gPSBnbG9iYWwuTnVtYmVyLmlzTmFOIHx8IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgJiYgZ2xvYmFsLmlzTmFOKHZhbHVlKTtcbiAgfVxuXG5cbiAgdmFyIGNyZWF0ZU9iamVjdCA9ICgnX19wcm90b19fJyBpbiB7fSkgP1xuICAgIGZ1bmN0aW9uKG9iaikgeyByZXR1cm4gb2JqOyB9IDpcbiAgICBmdW5jdGlvbihvYmopIHtcbiAgICAgIHZhciBwcm90byA9IG9iai5fX3Byb3RvX187XG4gICAgICBpZiAoIXByb3RvKVxuICAgICAgICByZXR1cm4gb2JqO1xuICAgICAgdmFyIG5ld09iamVjdCA9IE9iamVjdC5jcmVhdGUocHJvdG8pO1xuICAgICAgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMob2JqKS5mb3JFYWNoKGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG5ld09iamVjdCwgbmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihvYmosIG5hbWUpKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIG5ld09iamVjdDtcbiAgICB9O1xuXG4gIHZhciBpZGVudFN0YXJ0ID0gJ1tcXCRfYS16QS1aXSc7XG4gIHZhciBpZGVudFBhcnQgPSAnW1xcJF9hLXpBLVowLTldJztcblxuXG4gIHZhciBNQVhfRElSVFlfQ0hFQ0tfQ1lDTEVTID0gMTAwMDtcblxuICBmdW5jdGlvbiBkaXJ0eUNoZWNrKG9ic2VydmVyKSB7XG4gICAgdmFyIGN5Y2xlcyA9IDA7XG4gICAgd2hpbGUgKGN5Y2xlcyA8IE1BWF9ESVJUWV9DSEVDS19DWUNMRVMgJiYgb2JzZXJ2ZXIuY2hlY2tfKCkpIHtcbiAgICAgIGN5Y2xlcysrO1xuICAgIH1cbiAgICBpZiAodGVzdGluZ0V4cG9zZUN5Y2xlQ291bnQpXG4gICAgICBnbG9iYWwuZGlydHlDaGVja0N5Y2xlQ291bnQgPSBjeWNsZXM7XG5cbiAgICByZXR1cm4gY3ljbGVzID4gMDtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9iamVjdElzRW1wdHkob2JqZWN0KSB7XG4gICAgZm9yICh2YXIgcHJvcCBpbiBvYmplY3QpXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBmdW5jdGlvbiBkaWZmSXNFbXB0eShkaWZmKSB7XG4gICAgcmV0dXJuIG9iamVjdElzRW1wdHkoZGlmZi5hZGRlZCkgJiZcbiAgICAgICAgICAgb2JqZWN0SXNFbXB0eShkaWZmLnJlbW92ZWQpICYmXG4gICAgICAgICAgIG9iamVjdElzRW1wdHkoZGlmZi5jaGFuZ2VkKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRpZmZPYmplY3RGcm9tT2xkT2JqZWN0KG9iamVjdCwgb2xkT2JqZWN0KSB7XG4gICAgdmFyIGFkZGVkID0ge307XG4gICAgdmFyIHJlbW92ZWQgPSB7fTtcbiAgICB2YXIgY2hhbmdlZCA9IHt9O1xuXG4gICAgZm9yICh2YXIgcHJvcCBpbiBvbGRPYmplY3QpIHtcbiAgICAgIHZhciBuZXdWYWx1ZSA9IG9iamVjdFtwcm9wXTtcblxuICAgICAgaWYgKG5ld1ZhbHVlICE9PSB1bmRlZmluZWQgJiYgbmV3VmFsdWUgPT09IG9sZE9iamVjdFtwcm9wXSlcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIGlmICghKHByb3AgaW4gb2JqZWN0KSkge1xuICAgICAgICByZW1vdmVkW3Byb3BdID0gdW5kZWZpbmVkO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKG5ld1ZhbHVlICE9PSBvbGRPYmplY3RbcHJvcF0pXG4gICAgICAgIGNoYW5nZWRbcHJvcF0gPSBuZXdWYWx1ZTtcbiAgICB9XG5cbiAgICBmb3IgKHZhciBwcm9wIGluIG9iamVjdCkge1xuICAgICAgaWYgKHByb3AgaW4gb2xkT2JqZWN0KVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgYWRkZWRbcHJvcF0gPSBvYmplY3RbcHJvcF07XG4gICAgfVxuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkob2JqZWN0KSAmJiBvYmplY3QubGVuZ3RoICE9PSBvbGRPYmplY3QubGVuZ3RoKVxuICAgICAgY2hhbmdlZC5sZW5ndGggPSBvYmplY3QubGVuZ3RoO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGFkZGVkOiBhZGRlZCxcbiAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgICBjaGFuZ2VkOiBjaGFuZ2VkXG4gICAgfTtcbiAgfVxuXG4gIHZhciBlb21UYXNrcyA9IFtdO1xuICBmdW5jdGlvbiBydW5FT01UYXNrcygpIHtcbiAgICBpZiAoIWVvbVRhc2tzLmxlbmd0aClcbiAgICAgIHJldHVybiBmYWxzZTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZW9tVGFza3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIGVvbVRhc2tzW2ldKCk7XG4gICAgfVxuICAgIGVvbVRhc2tzLmxlbmd0aCA9IDA7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICB2YXIgcnVuRU9NID0gaGFzT2JzZXJ2ZSA/IChmdW5jdGlvbigpe1xuICAgIHZhciBlb21PYmogPSB7IHBpbmdQb25nOiB0cnVlIH07XG4gICAgdmFyIGVvbVJ1blNjaGVkdWxlZCA9IGZhbHNlO1xuXG4gICAgT2JqZWN0Lm9ic2VydmUoZW9tT2JqLCBmdW5jdGlvbigpIHtcbiAgICAgIHJ1bkVPTVRhc2tzKCk7XG4gICAgICBlb21SdW5TY2hlZHVsZWQgPSBmYWxzZTtcbiAgICB9KTtcblxuICAgIHJldHVybiBmdW5jdGlvbihmbikge1xuICAgICAgZW9tVGFza3MucHVzaChmbik7XG4gICAgICBpZiAoIWVvbVJ1blNjaGVkdWxlZCkge1xuICAgICAgICBlb21SdW5TY2hlZHVsZWQgPSB0cnVlO1xuICAgICAgICBlb21PYmoucGluZ1BvbmcgPSAhZW9tT2JqLnBpbmdQb25nO1xuICAgICAgfVxuICAgIH07XG4gIH0pKCkgOlxuICAoZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKGZuKSB7XG4gICAgICBlb21UYXNrcy5wdXNoKGZuKTtcbiAgICB9O1xuICB9KSgpO1xuXG4gIHZhciBvYnNlcnZlZE9iamVjdENhY2hlID0gW107XG5cbiAgZnVuY3Rpb24gbmV3T2JzZXJ2ZWRPYmplY3QoKSB7XG4gICAgdmFyIG9ic2VydmVyO1xuICAgIHZhciBvYmplY3Q7XG4gICAgdmFyIGRpc2NhcmRSZWNvcmRzID0gZmFsc2U7XG4gICAgdmFyIGZpcnN0ID0gdHJ1ZTtcblxuICAgIGZ1bmN0aW9uIGNhbGxiYWNrKHJlY29yZHMpIHtcbiAgICAgIGlmIChvYnNlcnZlciAmJiBvYnNlcnZlci5zdGF0ZV8gPT09IE9QRU5FRCAmJiAhZGlzY2FyZFJlY29yZHMpXG4gICAgICAgIG9ic2VydmVyLmNoZWNrXyhyZWNvcmRzKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgb3BlbjogZnVuY3Rpb24ob2JzKSB7XG4gICAgICAgIGlmIChvYnNlcnZlcilcbiAgICAgICAgICB0aHJvdyBFcnJvcignT2JzZXJ2ZWRPYmplY3QgaW4gdXNlJyk7XG5cbiAgICAgICAgaWYgKCFmaXJzdClcbiAgICAgICAgICBPYmplY3QuZGVsaXZlckNoYW5nZVJlY29yZHMoY2FsbGJhY2spO1xuXG4gICAgICAgIG9ic2VydmVyID0gb2JzO1xuICAgICAgICBmaXJzdCA9IGZhbHNlO1xuICAgICAgfSxcbiAgICAgIG9ic2VydmU6IGZ1bmN0aW9uKG9iaiwgYXJyYXlPYnNlcnZlKSB7XG4gICAgICAgIG9iamVjdCA9IG9iajtcbiAgICAgICAgaWYgKGFycmF5T2JzZXJ2ZSlcbiAgICAgICAgICBBcnJheS5vYnNlcnZlKG9iamVjdCwgY2FsbGJhY2spO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgT2JqZWN0Lm9ic2VydmUob2JqZWN0LCBjYWxsYmFjayk7XG4gICAgICB9LFxuICAgICAgZGVsaXZlcjogZnVuY3Rpb24oZGlzY2FyZCkge1xuICAgICAgICBkaXNjYXJkUmVjb3JkcyA9IGRpc2NhcmQ7XG4gICAgICAgIE9iamVjdC5kZWxpdmVyQ2hhbmdlUmVjb3JkcyhjYWxsYmFjayk7XG4gICAgICAgIGRpc2NhcmRSZWNvcmRzID0gZmFsc2U7XG4gICAgICB9LFxuICAgICAgY2xvc2U6IGZ1bmN0aW9uKCkge1xuICAgICAgICBvYnNlcnZlciA9IHVuZGVmaW5lZDtcbiAgICAgICAgT2JqZWN0LnVub2JzZXJ2ZShvYmplY3QsIGNhbGxiYWNrKTtcbiAgICAgICAgb2JzZXJ2ZWRPYmplY3RDYWNoZS5wdXNoKHRoaXMpO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICAvKlxuICAgKiBUaGUgb2JzZXJ2ZWRTZXQgYWJzdHJhY3Rpb24gaXMgYSBwZXJmIG9wdGltaXphdGlvbiB3aGljaCByZWR1Y2VzIHRoZSB0b3RhbFxuICAgKiBudW1iZXIgb2YgT2JqZWN0Lm9ic2VydmUgb2JzZXJ2YXRpb25zIG9mIGEgc2V0IG9mIG9iamVjdHMuIFRoZSBpZGVhIGlzIHRoYXRcbiAgICogZ3JvdXBzIG9mIE9ic2VydmVycyB3aWxsIGhhdmUgc29tZSBvYmplY3QgZGVwZW5kZW5jaWVzIGluIGNvbW1vbiBhbmQgdGhpc1xuICAgKiBvYnNlcnZlZCBzZXQgZW5zdXJlcyB0aGF0IGVhY2ggb2JqZWN0IGluIHRoZSB0cmFuc2l0aXZlIGNsb3N1cmUgb2ZcbiAgICogZGVwZW5kZW5jaWVzIGlzIG9ubHkgb2JzZXJ2ZWQgb25jZS4gVGhlIG9ic2VydmVkU2V0IGFjdHMgYXMgYSB3cml0ZSBiYXJyaWVyXG4gICAqIHN1Y2ggdGhhdCB3aGVuZXZlciBhbnkgY2hhbmdlIGNvbWVzIHRocm91Z2gsIGFsbCBPYnNlcnZlcnMgYXJlIGNoZWNrZWQgZm9yXG4gICAqIGNoYW5nZWQgdmFsdWVzLlxuICAgKlxuICAgKiBOb3RlIHRoYXQgdGhpcyBvcHRpbWl6YXRpb24gaXMgZXhwbGljaXRseSBtb3Zpbmcgd29yayBmcm9tIHNldHVwLXRpbWUgdG9cbiAgICogY2hhbmdlLXRpbWUuXG4gICAqXG4gICAqIFRPRE8ocmFmYWVsdyk6IEltcGxlbWVudCBcImdhcmJhZ2UgY29sbGVjdGlvblwiLiBJbiBvcmRlciB0byBtb3ZlIHdvcmsgb2ZmXG4gICAqIHRoZSBjcml0aWNhbCBwYXRoLCB3aGVuIE9ic2VydmVycyBhcmUgY2xvc2VkLCB0aGVpciBvYnNlcnZlZCBvYmplY3RzIGFyZVxuICAgKiBub3QgT2JqZWN0LnVub2JzZXJ2ZShkKS4gQXMgYSByZXN1bHQsIGl0J3NpZXN0YSBwb3NzaWJsZSB0aGF0IGlmIHRoZSBvYnNlcnZlZFNldFxuICAgKiBpcyBrZXB0IG9wZW4sIGJ1dCBzb21lIE9ic2VydmVycyBoYXZlIGJlZW4gY2xvc2VkLCBpdCBjb3VsZCBjYXVzZSBcImxlYWtzXCJcbiAgICogKHByZXZlbnQgb3RoZXJ3aXNlIGNvbGxlY3RhYmxlIG9iamVjdHMgZnJvbSBiZWluZyBjb2xsZWN0ZWQpLiBBdCBzb21lXG4gICAqIHBvaW50LCB3ZSBzaG91bGQgaW1wbGVtZW50IGluY3JlbWVudGFsIFwiZ2NcIiB3aGljaCBrZWVwcyBhIGxpc3Qgb2ZcbiAgICogb2JzZXJ2ZWRTZXRzIHdoaWNoIG1heSBuZWVkIGNsZWFuLXVwIGFuZCBkb2VzIHNtYWxsIGFtb3VudHMgb2YgY2xlYW51cCBvbiBhXG4gICAqIHRpbWVvdXQgdW50aWwgYWxsIGlzIGNsZWFuLlxuICAgKi9cblxuICBmdW5jdGlvbiBnZXRPYnNlcnZlZE9iamVjdChvYnNlcnZlciwgb2JqZWN0LCBhcnJheU9ic2VydmUpIHtcbiAgICB2YXIgZGlyID0gb2JzZXJ2ZWRPYmplY3RDYWNoZS5wb3AoKSB8fCBuZXdPYnNlcnZlZE9iamVjdCgpO1xuICAgIGRpci5vcGVuKG9ic2VydmVyKTtcbiAgICBkaXIub2JzZXJ2ZShvYmplY3QsIGFycmF5T2JzZXJ2ZSk7XG4gICAgcmV0dXJuIGRpcjtcbiAgfVxuXG4gIHZhciBvYnNlcnZlZFNldENhY2hlID0gW107XG5cbiAgZnVuY3Rpb24gbmV3T2JzZXJ2ZWRTZXQoKSB7XG4gICAgdmFyIG9ic2VydmVyQ291bnQgPSAwO1xuICAgIHZhciBvYnNlcnZlcnMgPSBbXTtcbiAgICB2YXIgb2JqZWN0cyA9IFtdO1xuICAgIHZhciByb290T2JqO1xuICAgIHZhciByb290T2JqUHJvcHM7XG5cbiAgICBmdW5jdGlvbiBvYnNlcnZlKG9iaiwgcHJvcCkge1xuICAgICAgaWYgKCFvYmopXG4gICAgICAgIHJldHVybjtcblxuICAgICAgaWYgKG9iaiA9PT0gcm9vdE9iailcbiAgICAgICAgcm9vdE9ialByb3BzW3Byb3BdID0gdHJ1ZTtcblxuICAgICAgaWYgKG9iamVjdHMuaW5kZXhPZihvYmopIDwgMCkge1xuICAgICAgICBvYmplY3RzLnB1c2gob2JqKTtcbiAgICAgICAgT2JqZWN0Lm9ic2VydmUob2JqLCBjYWxsYmFjayk7XG4gICAgICB9XG5cbiAgICAgIG9ic2VydmUoT2JqZWN0LmdldFByb3RvdHlwZU9mKG9iaiksIHByb3ApO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFsbFJvb3RPYmpOb25PYnNlcnZlZFByb3BzKHJlY3MpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVjcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgcmVjID0gcmVjc1tpXTtcbiAgICAgICAgaWYgKHJlYy5vYmplY3QgIT09IHJvb3RPYmogfHxcbiAgICAgICAgICAgIHJvb3RPYmpQcm9wc1tyZWMubmFtZV0gfHxcbiAgICAgICAgICAgIHJlYy50eXBlID09PSAnc2V0UHJvdG90eXBlJykge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY2FsbGJhY2socmVjcykge1xuICAgICAgaWYgKGFsbFJvb3RPYmpOb25PYnNlcnZlZFByb3BzKHJlY3MpKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIHZhciBvYnNlcnZlcjtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb2JzZXJ2ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIG9ic2VydmVyID0gb2JzZXJ2ZXJzW2ldO1xuICAgICAgICBpZiAob2JzZXJ2ZXIuc3RhdGVfID09IE9QRU5FRCkge1xuICAgICAgICAgIG9ic2VydmVyLml0ZXJhdGVPYmplY3RzXyhvYnNlcnZlKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9ic2VydmVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICBvYnNlcnZlciA9IG9ic2VydmVyc1tpXTtcbiAgICAgICAgaWYgKG9ic2VydmVyLnN0YXRlXyA9PSBPUEVORUQpIHtcbiAgICAgICAgICBvYnNlcnZlci5jaGVja18oKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHZhciByZWNvcmQgPSB7XG4gICAgICBvYmplY3Q6IHVuZGVmaW5lZCxcbiAgICAgIG9iamVjdHM6IG9iamVjdHMsXG4gICAgICBvcGVuOiBmdW5jdGlvbihvYnMsIG9iamVjdCkge1xuICAgICAgICBpZiAoIXJvb3RPYmopIHtcbiAgICAgICAgICByb290T2JqID0gb2JqZWN0O1xuICAgICAgICAgIHJvb3RPYmpQcm9wcyA9IHt9O1xuICAgICAgICB9XG5cbiAgICAgICAgb2JzZXJ2ZXJzLnB1c2gob2JzKTtcbiAgICAgICAgb2JzZXJ2ZXJDb3VudCsrO1xuICAgICAgICBvYnMuaXRlcmF0ZU9iamVjdHNfKG9ic2VydmUpO1xuICAgICAgfSxcbiAgICAgIGNsb3NlOiBmdW5jdGlvbihvYnMpIHtcbiAgICAgICAgb2JzZXJ2ZXJDb3VudC0tO1xuICAgICAgICBpZiAob2JzZXJ2ZXJDb3VudCA+IDApIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9iamVjdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBPYmplY3QudW5vYnNlcnZlKG9iamVjdHNbaV0sIGNhbGxiYWNrKTtcbiAgICAgICAgICBPYnNlcnZlci51bm9ic2VydmVkQ291bnQrKztcbiAgICAgICAgfVxuXG4gICAgICAgIG9ic2VydmVycy5sZW5ndGggPSAwO1xuICAgICAgICBvYmplY3RzLmxlbmd0aCA9IDA7XG4gICAgICAgIHJvb3RPYmogPSB1bmRlZmluZWQ7XG4gICAgICAgIHJvb3RPYmpQcm9wcyA9IHVuZGVmaW5lZDtcbiAgICAgICAgb2JzZXJ2ZWRTZXRDYWNoZS5wdXNoKHRoaXMpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICByZXR1cm4gcmVjb3JkO1xuICB9XG5cbiAgdmFyIGxhc3RPYnNlcnZlZFNldDtcblxuICB2YXIgVU5PUEVORUQgPSAwO1xuICB2YXIgT1BFTkVEID0gMTtcbiAgdmFyIENMT1NFRCA9IDI7XG5cbiAgdmFyIG5leHRPYnNlcnZlcklkID0gMTtcblxuICBmdW5jdGlvbiBPYnNlcnZlcigpIHtcbiAgICB0aGlzLnN0YXRlXyA9IFVOT1BFTkVEO1xuICAgIHRoaXMuY2FsbGJhY2tfID0gdW5kZWZpbmVkO1xuICAgIHRoaXMudGFyZ2V0XyA9IHVuZGVmaW5lZDsgLy8gVE9ETyhyYWZhZWx3KTogU2hvdWxkIGJlIFdlYWtSZWZcbiAgICB0aGlzLmRpcmVjdE9ic2VydmVyXyA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLnZhbHVlXyA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLmlkXyA9IG5leHRPYnNlcnZlcklkKys7XG4gIH1cblxuICBPYnNlcnZlci5wcm90b3R5cGUgPSB7XG4gICAgb3BlbjogZnVuY3Rpb24oY2FsbGJhY2ssIHRhcmdldCkge1xuICAgICAgaWYgKHRoaXMuc3RhdGVfICE9IFVOT1BFTkVEKVxuICAgICAgICB0aHJvdyBFcnJvcignT2JzZXJ2ZXIgaGFzIGFscmVhZHkgYmVlbiBvcGVuZWQuJyk7XG5cbiAgICAgIGFkZFRvQWxsKHRoaXMpO1xuICAgICAgdGhpcy5jYWxsYmFja18gPSBjYWxsYmFjaztcbiAgICAgIHRoaXMudGFyZ2V0XyA9IHRhcmdldDtcbiAgICAgIHRoaXMuY29ubmVjdF8oKTtcbiAgICAgIHRoaXMuc3RhdGVfID0gT1BFTkVEO1xuICAgICAgcmV0dXJuIHRoaXMudmFsdWVfO1xuICAgIH0sXG5cbiAgICBjbG9zZTogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5zdGF0ZV8gIT0gT1BFTkVEKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIHJlbW92ZUZyb21BbGwodGhpcyk7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RfKCk7XG4gICAgICB0aGlzLnZhbHVlXyA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMuY2FsbGJhY2tfID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy50YXJnZXRfID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy5zdGF0ZV8gPSBDTE9TRUQ7XG4gICAgfSxcblxuICAgIGRlbGl2ZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuc3RhdGVfICE9IE9QRU5FRClcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICBkaXJ0eUNoZWNrKHRoaXMpO1xuICAgIH0sXG5cbiAgICByZXBvcnRfOiBmdW5jdGlvbihjaGFuZ2VzKSB7XG4gICAgICB0cnkge1xuICAgICAgICB0aGlzLmNhbGxiYWNrXy5hcHBseSh0aGlzLnRhcmdldF8sIGNoYW5nZXMpO1xuICAgICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgICAgT2JzZXJ2ZXIuX2Vycm9yVGhyb3duRHVyaW5nQ2FsbGJhY2sgPSB0cnVlO1xuICAgICAgICBjb25zb2xlLmVycm9yKCdFeGNlcHRpb24gY2F1Z2h0IGR1cmluZyBvYnNlcnZlciBjYWxsYmFjazogJyArXG4gICAgICAgICAgICAgICAgICAgICAgIChleC5zdGFjayB8fCBleCkpO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICBkaXNjYXJkQ2hhbmdlczogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLmNoZWNrXyh1bmRlZmluZWQsIHRydWUpO1xuICAgICAgcmV0dXJuIHRoaXMudmFsdWVfO1xuICAgIH1cbiAgfVxuXG4gIHZhciBjb2xsZWN0T2JzZXJ2ZXJzID0gIWhhc09ic2VydmU7XG4gIHZhciBhbGxPYnNlcnZlcnM7XG4gIE9ic2VydmVyLl9hbGxPYnNlcnZlcnNDb3VudCA9IDA7XG5cbiAgaWYgKGNvbGxlY3RPYnNlcnZlcnMpIHtcbiAgICBhbGxPYnNlcnZlcnMgPSBbXTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFkZFRvQWxsKG9ic2VydmVyKSB7XG4gICAgT2JzZXJ2ZXIuX2FsbE9ic2VydmVyc0NvdW50Kys7XG4gICAgaWYgKCFjb2xsZWN0T2JzZXJ2ZXJzKVxuICAgICAgcmV0dXJuO1xuXG4gICAgYWxsT2JzZXJ2ZXJzLnB1c2gob2JzZXJ2ZXIpO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVtb3ZlRnJvbUFsbChvYnNlcnZlcikge1xuICAgIE9ic2VydmVyLl9hbGxPYnNlcnZlcnNDb3VudC0tO1xuICB9XG5cbiAgdmFyIHJ1bm5pbmdNaWNyb3Rhc2tDaGVja3BvaW50ID0gZmFsc2U7XG5cbiAgdmFyIGhhc0RlYnVnRm9yY2VGdWxsRGVsaXZlcnkgPSBoYXNPYnNlcnZlICYmIGhhc0V2YWwgJiYgKGZ1bmN0aW9uKCkge1xuICAgIHRyeSB7XG4gICAgICBldmFsKCclUnVuTWljcm90YXNrcygpJyk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIChleCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfSkoKTtcblxuICBnbG9iYWwuUGxhdGZvcm0gPSBnbG9iYWwuUGxhdGZvcm0gfHwge307XG5cbiAgZ2xvYmFsLlBsYXRmb3JtLnBlcmZvcm1NaWNyb3Rhc2tDaGVja3BvaW50ID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKHJ1bm5pbmdNaWNyb3Rhc2tDaGVja3BvaW50KVxuICAgICAgcmV0dXJuO1xuXG4gICAgaWYgKGhhc0RlYnVnRm9yY2VGdWxsRGVsaXZlcnkpIHtcbiAgICAgIGV2YWwoJyVSdW5NaWNyb3Rhc2tzKCknKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIWNvbGxlY3RPYnNlcnZlcnMpXG4gICAgICByZXR1cm47XG5cbiAgICBydW5uaW5nTWljcm90YXNrQ2hlY2twb2ludCA9IHRydWU7XG5cbiAgICB2YXIgY3ljbGVzID0gMDtcbiAgICB2YXIgYW55Q2hhbmdlZCwgdG9DaGVjaztcblxuICAgIGRvIHtcbiAgICAgIGN5Y2xlcysrO1xuICAgICAgdG9DaGVjayA9IGFsbE9ic2VydmVycztcbiAgICAgIGFsbE9ic2VydmVycyA9IFtdO1xuICAgICAgYW55Q2hhbmdlZCA9IGZhbHNlO1xuXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRvQ2hlY2subGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIG9ic2VydmVyID0gdG9DaGVja1tpXTtcbiAgICAgICAgaWYgKG9ic2VydmVyLnN0YXRlXyAhPSBPUEVORUQpXG4gICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgaWYgKG9ic2VydmVyLmNoZWNrXygpKVxuICAgICAgICAgIGFueUNoYW5nZWQgPSB0cnVlO1xuXG4gICAgICAgIGFsbE9ic2VydmVycy5wdXNoKG9ic2VydmVyKTtcbiAgICAgIH1cbiAgICAgIGlmIChydW5FT01UYXNrcygpKVxuICAgICAgICBhbnlDaGFuZ2VkID0gdHJ1ZTtcbiAgICB9IHdoaWxlIChjeWNsZXMgPCBNQVhfRElSVFlfQ0hFQ0tfQ1lDTEVTICYmIGFueUNoYW5nZWQpO1xuXG4gICAgaWYgKHRlc3RpbmdFeHBvc2VDeWNsZUNvdW50KVxuICAgICAgZ2xvYmFsLmRpcnR5Q2hlY2tDeWNsZUNvdW50ID0gY3ljbGVzO1xuXG4gICAgcnVubmluZ01pY3JvdGFza0NoZWNrcG9pbnQgPSBmYWxzZTtcbiAgfTtcblxuICBpZiAoY29sbGVjdE9ic2VydmVycykge1xuICAgIGdsb2JhbC5QbGF0Zm9ybS5jbGVhck9ic2VydmVycyA9IGZ1bmN0aW9uKCkge1xuICAgICAgYWxsT2JzZXJ2ZXJzID0gW107XG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIE9iamVjdE9ic2VydmVyKG9iamVjdCkge1xuICAgIE9ic2VydmVyLmNhbGwodGhpcyk7XG4gICAgdGhpcy52YWx1ZV8gPSBvYmplY3Q7XG4gICAgdGhpcy5vbGRPYmplY3RfID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgT2JqZWN0T2JzZXJ2ZXIucHJvdG90eXBlID0gY3JlYXRlT2JqZWN0KHtcbiAgICBfX3Byb3RvX186IE9ic2VydmVyLnByb3RvdHlwZSxcblxuICAgIGFycmF5T2JzZXJ2ZTogZmFsc2UsXG5cbiAgICBjb25uZWN0XzogZnVuY3Rpb24oY2FsbGJhY2ssIHRhcmdldCkge1xuICAgICAgaWYgKGhhc09ic2VydmUpIHtcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8gPSBnZXRPYnNlcnZlZE9iamVjdCh0aGlzLCB0aGlzLnZhbHVlXyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFycmF5T2JzZXJ2ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm9sZE9iamVjdF8gPSB0aGlzLmNvcHlPYmplY3QodGhpcy52YWx1ZV8pO1xuICAgICAgfVxuXG4gICAgfSxcblxuICAgIGNvcHlPYmplY3Q6IGZ1bmN0aW9uKG9iamVjdCkge1xuICAgICAgdmFyIGNvcHkgPSBBcnJheS5pc0FycmF5KG9iamVjdCkgPyBbXSA6IHt9O1xuICAgICAgZm9yICh2YXIgcHJvcCBpbiBvYmplY3QpIHtcbiAgICAgICAgY29weVtwcm9wXSA9IG9iamVjdFtwcm9wXTtcbiAgICAgIH07XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShvYmplY3QpKVxuICAgICAgICBjb3B5Lmxlbmd0aCA9IG9iamVjdC5sZW5ndGg7XG4gICAgICByZXR1cm4gY29weTtcbiAgICB9LFxuXG4gICAgY2hlY2tfOiBmdW5jdGlvbihjaGFuZ2VSZWNvcmRzLCBza2lwQ2hhbmdlcykge1xuICAgICAgdmFyIGRpZmY7XG4gICAgICB2YXIgb2xkVmFsdWVzO1xuICAgICAgaWYgKGhhc09ic2VydmUpIHtcbiAgICAgICAgaWYgKCFjaGFuZ2VSZWNvcmRzKVxuICAgICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgICBvbGRWYWx1ZXMgPSB7fTtcbiAgICAgICAgZGlmZiA9IGRpZmZPYmplY3RGcm9tQ2hhbmdlUmVjb3Jkcyh0aGlzLnZhbHVlXywgY2hhbmdlUmVjb3JkcyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGRWYWx1ZXMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb2xkVmFsdWVzID0gdGhpcy5vbGRPYmplY3RfO1xuICAgICAgICBkaWZmID0gZGlmZk9iamVjdEZyb21PbGRPYmplY3QodGhpcy52YWx1ZV8sIHRoaXMub2xkT2JqZWN0Xyk7XG4gICAgICB9XG5cbiAgICAgIGlmIChkaWZmSXNFbXB0eShkaWZmKSlcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICBpZiAoIWhhc09ic2VydmUpXG4gICAgICAgIHRoaXMub2xkT2JqZWN0XyA9IHRoaXMuY29weU9iamVjdCh0aGlzLnZhbHVlXyk7XG5cbiAgICAgIHRoaXMucmVwb3J0XyhbXG4gICAgICAgIGRpZmYuYWRkZWQgfHwge30sXG4gICAgICAgIGRpZmYucmVtb3ZlZCB8fCB7fSxcbiAgICAgICAgZGlmZi5jaGFuZ2VkIHx8IHt9LFxuICAgICAgICBmdW5jdGlvbihwcm9wZXJ0eSkge1xuICAgICAgICAgIHJldHVybiBvbGRWYWx1ZXNbcHJvcGVydHldO1xuICAgICAgICB9XG4gICAgICBdKTtcblxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSxcblxuICAgIGRpc2Nvbm5lY3RfOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmIChoYXNPYnNlcnZlKSB7XG4gICAgICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfLmNsb3NlKCk7XG4gICAgICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfID0gdW5kZWZpbmVkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5vbGRPYmplY3RfID0gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICBkZWxpdmVyOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLnN0YXRlXyAhPSBPUEVORUQpXG4gICAgICAgIHJldHVybjtcblxuICAgICAgaWYgKGhhc09ic2VydmUpXG4gICAgICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfLmRlbGl2ZXIoZmFsc2UpO1xuICAgICAgZWxzZVxuICAgICAgICBkaXJ0eUNoZWNrKHRoaXMpO1xuICAgIH0sXG5cbiAgICBkaXNjYXJkQ2hhbmdlczogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5kaXJlY3RPYnNlcnZlcl8pXG4gICAgICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfLmRlbGl2ZXIodHJ1ZSk7XG4gICAgICBlbHNlXG4gICAgICAgIHRoaXMub2xkT2JqZWN0XyA9IHRoaXMuY29weU9iamVjdCh0aGlzLnZhbHVlXyk7XG5cbiAgICAgIHJldHVybiB0aGlzLnZhbHVlXztcbiAgICB9XG4gIH0pO1xuXG4gIGZ1bmN0aW9uIEFycmF5T2JzZXJ2ZXIoYXJyYXkpIHtcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoYXJyYXkpKVxuICAgICAgdGhyb3cgRXJyb3IoJ1Byb3ZpZGVkIG9iamVjdCBpcyBub3QgYW4gQXJyYXknKTtcbiAgICBPYmplY3RPYnNlcnZlci5jYWxsKHRoaXMsIGFycmF5KTtcbiAgfVxuXG4gIEFycmF5T2JzZXJ2ZXIucHJvdG90eXBlID0gY3JlYXRlT2JqZWN0KHtcblxuICAgIF9fcHJvdG9fXzogT2JqZWN0T2JzZXJ2ZXIucHJvdG90eXBlLFxuXG4gICAgYXJyYXlPYnNlcnZlOiB0cnVlLFxuXG4gICAgY29weU9iamVjdDogZnVuY3Rpb24oYXJyKSB7XG4gICAgICByZXR1cm4gYXJyLnNsaWNlKCk7XG4gICAgfSxcblxuICAgIGNoZWNrXzogZnVuY3Rpb24oY2hhbmdlUmVjb3Jkcykge1xuICAgICAgdmFyIHNwbGljZXM7XG4gICAgICBpZiAoaGFzT2JzZXJ2ZSkge1xuICAgICAgICBpZiAoIWNoYW5nZVJlY29yZHMpXG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICBzcGxpY2VzID0gcHJvamVjdEFycmF5U3BsaWNlcyh0aGlzLnZhbHVlXywgY2hhbmdlUmVjb3Jkcyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzcGxpY2VzID0gY2FsY1NwbGljZXModGhpcy52YWx1ZV8sIDAsIHRoaXMudmFsdWVfLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMub2xkT2JqZWN0XywgMCwgdGhpcy5vbGRPYmplY3RfLmxlbmd0aCk7XG4gICAgICB9XG5cbiAgICAgIGlmICghc3BsaWNlcyB8fCAhc3BsaWNlcy5sZW5ndGgpXG4gICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgaWYgKCFoYXNPYnNlcnZlKVxuICAgICAgICB0aGlzLm9sZE9iamVjdF8gPSB0aGlzLmNvcHlPYmplY3QodGhpcy52YWx1ZV8pO1xuXG4gICAgICB0aGlzLnJlcG9ydF8oW3NwbGljZXNdKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfSk7XG5cbiAgQXJyYXlPYnNlcnZlci5hcHBseVNwbGljZXMgPSBmdW5jdGlvbihwcmV2aW91cywgY3VycmVudCwgc3BsaWNlcykge1xuICAgIHNwbGljZXMuZm9yRWFjaChmdW5jdGlvbihzcGxpY2UpIHtcbiAgICAgIHZhciBzcGxpY2VBcmdzID0gW3NwbGljZS5pbmRleCwgc3BsaWNlLnJlbW92ZWQubGVuZ3RoXTtcbiAgICAgIHZhciBhZGRJbmRleCA9IHNwbGljZS5pbmRleDtcbiAgICAgIHdoaWxlIChhZGRJbmRleCA8IHNwbGljZS5pbmRleCArIHNwbGljZS5hZGRlZENvdW50KSB7XG4gICAgICAgIHNwbGljZUFyZ3MucHVzaChjdXJyZW50W2FkZEluZGV4XSk7XG4gICAgICAgIGFkZEluZGV4Kys7XG4gICAgICB9XG5cbiAgICAgIEFycmF5LnByb3RvdHlwZS5zcGxpY2UuYXBwbHkocHJldmlvdXMsIHNwbGljZUFyZ3MpO1xuICAgIH0pO1xuICB9O1xuXG4gIHZhciBvYnNlcnZlclNlbnRpbmVsID0ge307XG5cbiAgdmFyIGV4cGVjdGVkUmVjb3JkVHlwZXMgPSB7XG4gICAgYWRkOiB0cnVlLFxuICAgIHVwZGF0ZTogdHJ1ZSxcbiAgICBkZWxldGU6IHRydWVcbiAgfTtcblxuICBmdW5jdGlvbiBkaWZmT2JqZWN0RnJvbUNoYW5nZVJlY29yZHMob2JqZWN0LCBjaGFuZ2VSZWNvcmRzLCBvbGRWYWx1ZXMpIHtcbiAgICB2YXIgYWRkZWQgPSB7fTtcbiAgICB2YXIgcmVtb3ZlZCA9IHt9O1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGFuZ2VSZWNvcmRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgcmVjb3JkID0gY2hhbmdlUmVjb3Jkc1tpXTtcbiAgICAgIGlmICghZXhwZWN0ZWRSZWNvcmRUeXBlc1tyZWNvcmQudHlwZV0pIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignVW5rbm93biBjaGFuZ2VSZWNvcmQgdHlwZTogJyArIHJlY29yZC50eXBlKTtcbiAgICAgICAgY29uc29sZS5lcnJvcihyZWNvcmQpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKCEocmVjb3JkLm5hbWUgaW4gb2xkVmFsdWVzKSlcbiAgICAgICAgb2xkVmFsdWVzW3JlY29yZC5uYW1lXSA9IHJlY29yZC5vbGRWYWx1ZTtcblxuICAgICAgaWYgKHJlY29yZC50eXBlID09ICd1cGRhdGUnKVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgaWYgKHJlY29yZC50eXBlID09ICdhZGQnKSB7XG4gICAgICAgIGlmIChyZWNvcmQubmFtZSBpbiByZW1vdmVkKVxuICAgICAgICAgIGRlbGV0ZSByZW1vdmVkW3JlY29yZC5uYW1lXTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGFkZGVkW3JlY29yZC5uYW1lXSA9IHRydWU7XG5cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIHR5cGUgPSAnZGVsZXRlJ1xuICAgICAgaWYgKHJlY29yZC5uYW1lIGluIGFkZGVkKSB7XG4gICAgICAgIGRlbGV0ZSBhZGRlZFtyZWNvcmQubmFtZV07XG4gICAgICAgIGRlbGV0ZSBvbGRWYWx1ZXNbcmVjb3JkLm5hbWVdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVtb3ZlZFtyZWNvcmQubmFtZV0gPSB0cnVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvciAodmFyIHByb3AgaW4gYWRkZWQpXG4gICAgICBhZGRlZFtwcm9wXSA9IG9iamVjdFtwcm9wXTtcblxuICAgIGZvciAodmFyIHByb3AgaW4gcmVtb3ZlZClcbiAgICAgIHJlbW92ZWRbcHJvcF0gPSB1bmRlZmluZWQ7XG5cbiAgICB2YXIgY2hhbmdlZCA9IHt9O1xuICAgIGZvciAodmFyIHByb3AgaW4gb2xkVmFsdWVzKSB7XG4gICAgICBpZiAocHJvcCBpbiBhZGRlZCB8fCBwcm9wIGluIHJlbW92ZWQpXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICB2YXIgbmV3VmFsdWUgPSBvYmplY3RbcHJvcF07XG4gICAgICBpZiAob2xkVmFsdWVzW3Byb3BdICE9PSBuZXdWYWx1ZSlcbiAgICAgICAgY2hhbmdlZFtwcm9wXSA9IG5ld1ZhbHVlO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBhZGRlZDogYWRkZWQsXG4gICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgICAgY2hhbmdlZDogY2hhbmdlZFxuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBuZXdTcGxpY2UoaW5kZXgsIHJlbW92ZWQsIGFkZGVkQ291bnQpIHtcbiAgICByZXR1cm4ge1xuICAgICAgaW5kZXg6IGluZGV4LFxuICAgICAgcmVtb3ZlZDogcmVtb3ZlZCxcbiAgICAgIGFkZGVkQ291bnQ6IGFkZGVkQ291bnRcbiAgICB9O1xuICB9XG5cbiAgdmFyIEVESVRfTEVBVkUgPSAwO1xuICB2YXIgRURJVF9VUERBVEUgPSAxO1xuICB2YXIgRURJVF9BREQgPSAyO1xuICB2YXIgRURJVF9ERUxFVEUgPSAzO1xuXG4gIGZ1bmN0aW9uIEFycmF5U3BsaWNlKCkge31cblxuICBBcnJheVNwbGljZS5wcm90b3R5cGUgPSB7XG5cbiAgICAvLyBOb3RlOiBUaGlzIGZ1bmN0aW9uIGlzICpiYXNlZCogb24gdGhlIGNvbXB1dGF0aW9uIG9mIHRoZSBMZXZlbnNodGVpblxuICAgIC8vIFwiZWRpdFwiIGRpc3RhbmNlLiBUaGUgb25lIGNoYW5nZSBpcyB0aGF0IFwidXBkYXRlc1wiIGFyZSB0cmVhdGVkIGFzIHR3b1xuICAgIC8vIGVkaXRzIC0gbm90IG9uZS4gV2l0aCBBcnJheSBzcGxpY2VzLCBhbiB1cGRhdGUgaXMgcmVhbGx5IGEgZGVsZXRlXG4gICAgLy8gZm9sbG93ZWQgYnkgYW4gYWRkLiBCeSByZXRhaW5pbmcgdGhpcywgd2Ugb3B0aW1pemUgZm9yIFwia2VlcGluZ1wiIHRoZVxuICAgIC8vIG1heGltdW0gYXJyYXkgaXRlbXMgaW4gdGhlIG9yaWdpbmFsIGFycmF5LiBGb3IgZXhhbXBsZTpcbiAgICAvL1xuICAgIC8vICAgJ3h4eHgxMjMnIC0+ICcxMjN5eXl5J1xuICAgIC8vXG4gICAgLy8gV2l0aCAxLWVkaXQgdXBkYXRlcywgdGhlIHNob3J0ZXN0IHBhdGggd291bGQgYmUganVzdCB0byB1cGRhdGUgYWxsIHNldmVuXG4gICAgLy8gY2hhcmFjdGVycy4gV2l0aCAyLWVkaXQgdXBkYXRlcywgd2UgZGVsZXRlIDQsIGxlYXZlIDMsIGFuZCBhZGQgNC4gVGhpc1xuICAgIC8vIGxlYXZlcyB0aGUgc3Vic3RyaW5nICcxMjMnIGludGFjdC5cbiAgICBjYWxjRWRpdERpc3RhbmNlczogZnVuY3Rpb24oY3VycmVudCwgY3VycmVudFN0YXJ0LCBjdXJyZW50RW5kLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGQsIG9sZFN0YXJ0LCBvbGRFbmQpIHtcbiAgICAgIC8vIFwiRGVsZXRpb25cIiBjb2x1bW5zXG4gICAgICB2YXIgcm93Q291bnQgPSBvbGRFbmQgLSBvbGRTdGFydCArIDE7XG4gICAgICB2YXIgY29sdW1uQ291bnQgPSBjdXJyZW50RW5kIC0gY3VycmVudFN0YXJ0ICsgMTtcbiAgICAgIHZhciBkaXN0YW5jZXMgPSBuZXcgQXJyYXkocm93Q291bnQpO1xuXG4gICAgICAvLyBcIkFkZGl0aW9uXCIgcm93cy4gSW5pdGlhbGl6ZSBudWxsIGNvbHVtbi5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcm93Q291bnQ7IGkrKykge1xuICAgICAgICBkaXN0YW5jZXNbaV0gPSBuZXcgQXJyYXkoY29sdW1uQ291bnQpO1xuICAgICAgICBkaXN0YW5jZXNbaV1bMF0gPSBpO1xuICAgICAgfVxuXG4gICAgICAvLyBJbml0aWFsaXplIG51bGwgcm93XG4gICAgICBmb3IgKHZhciBqID0gMDsgaiA8IGNvbHVtbkNvdW50OyBqKyspXG4gICAgICAgIGRpc3RhbmNlc1swXVtqXSA9IGo7XG5cbiAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgcm93Q291bnQ7IGkrKykge1xuICAgICAgICBmb3IgKHZhciBqID0gMTsgaiA8IGNvbHVtbkNvdW50OyBqKyspIHtcbiAgICAgICAgICBpZiAodGhpcy5lcXVhbHMoY3VycmVudFtjdXJyZW50U3RhcnQgKyBqIC0gMV0sIG9sZFtvbGRTdGFydCArIGkgLSAxXSkpXG4gICAgICAgICAgICBkaXN0YW5jZXNbaV1bal0gPSBkaXN0YW5jZXNbaSAtIDFdW2ogLSAxXTtcbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHZhciBub3J0aCA9IGRpc3RhbmNlc1tpIC0gMV1bal0gKyAxO1xuICAgICAgICAgICAgdmFyIHdlc3QgPSBkaXN0YW5jZXNbaV1baiAtIDFdICsgMTtcbiAgICAgICAgICAgIGRpc3RhbmNlc1tpXVtqXSA9IG5vcnRoIDwgd2VzdCA/IG5vcnRoIDogd2VzdDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGRpc3RhbmNlcztcbiAgICB9LFxuXG4gICAgLy8gVGhpcyBzdGFydHMgYXQgdGhlIGZpbmFsIHdlaWdodCwgYW5kIHdhbGtzIFwiYmFja3dhcmRcIiBieSBmaW5kaW5nXG4gICAgLy8gdGhlIG1pbmltdW0gcHJldmlvdXMgd2VpZ2h0IHJlY3Vyc2l2ZWx5IHVudGlsIHRoZSBvcmlnaW4gb2YgdGhlIHdlaWdodFxuICAgIC8vIG1hdHJpeC5cbiAgICBzcGxpY2VPcGVyYXRpb25zRnJvbUVkaXREaXN0YW5jZXM6IGZ1bmN0aW9uKGRpc3RhbmNlcykge1xuICAgICAgdmFyIGkgPSBkaXN0YW5jZXMubGVuZ3RoIC0gMTtcbiAgICAgIHZhciBqID0gZGlzdGFuY2VzWzBdLmxlbmd0aCAtIDE7XG4gICAgICB2YXIgY3VycmVudCA9IGRpc3RhbmNlc1tpXVtqXTtcbiAgICAgIHZhciBlZGl0cyA9IFtdO1xuICAgICAgd2hpbGUgKGkgPiAwIHx8IGogPiAwKSB7XG4gICAgICAgIGlmIChpID09IDApIHtcbiAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfQUREKTtcbiAgICAgICAgICBqLS07XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGogPT0gMCkge1xuICAgICAgICAgIGVkaXRzLnB1c2goRURJVF9ERUxFVEUpO1xuICAgICAgICAgIGktLTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgbm9ydGhXZXN0ID0gZGlzdGFuY2VzW2kgLSAxXVtqIC0gMV07XG4gICAgICAgIHZhciB3ZXN0ID0gZGlzdGFuY2VzW2kgLSAxXVtqXTtcbiAgICAgICAgdmFyIG5vcnRoID0gZGlzdGFuY2VzW2ldW2ogLSAxXTtcblxuICAgICAgICB2YXIgbWluO1xuICAgICAgICBpZiAod2VzdCA8IG5vcnRoKVxuICAgICAgICAgIG1pbiA9IHdlc3QgPCBub3J0aFdlc3QgPyB3ZXN0IDogbm9ydGhXZXN0O1xuICAgICAgICBlbHNlXG4gICAgICAgICAgbWluID0gbm9ydGggPCBub3J0aFdlc3QgPyBub3J0aCA6IG5vcnRoV2VzdDtcblxuICAgICAgICBpZiAobWluID09IG5vcnRoV2VzdCkge1xuICAgICAgICAgIGlmIChub3J0aFdlc3QgPT0gY3VycmVudCkge1xuICAgICAgICAgICAgZWRpdHMucHVzaChFRElUX0xFQVZFKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZWRpdHMucHVzaChFRElUX1VQREFURSk7XG4gICAgICAgICAgICBjdXJyZW50ID0gbm9ydGhXZXN0O1xuICAgICAgICAgIH1cbiAgICAgICAgICBpLS07XG4gICAgICAgICAgai0tO1xuICAgICAgICB9IGVsc2UgaWYgKG1pbiA9PSB3ZXN0KSB7XG4gICAgICAgICAgZWRpdHMucHVzaChFRElUX0RFTEVURSk7XG4gICAgICAgICAgaS0tO1xuICAgICAgICAgIGN1cnJlbnQgPSB3ZXN0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGVkaXRzLnB1c2goRURJVF9BREQpO1xuICAgICAgICAgIGotLTtcbiAgICAgICAgICBjdXJyZW50ID0gbm9ydGg7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZWRpdHMucmV2ZXJzZSgpO1xuICAgICAgcmV0dXJuIGVkaXRzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTcGxpY2UgUHJvamVjdGlvbiBmdW5jdGlvbnM6XG4gICAgICpcbiAgICAgKiBBIHNwbGljZSBtYXAgaXMgYSByZXByZXNlbnRhdGlvbiBvZiBob3cgYSBwcmV2aW91cyBhcnJheSBvZiBpdGVtc1xuICAgICAqIHdhcyB0cmFuc2Zvcm1lZCBpbnRvIGEgbmV3IGFycmF5IG9mIGl0ZW1zLiBDb25jZXB0dWFsbHkgaXQgaXMgYSBsaXN0IG9mXG4gICAgICogdHVwbGVzIG9mXG4gICAgICpcbiAgICAgKiAgIDxpbmRleCwgcmVtb3ZlZCwgYWRkZWRDb3VudD5cbiAgICAgKlxuICAgICAqIHdoaWNoIGFyZSBrZXB0IGluIGFzY2VuZGluZyBpbmRleCBvcmRlciBvZi4gVGhlIHR1cGxlIHJlcHJlc2VudHMgdGhhdCBhdFxuICAgICAqIHRoZSB8aW5kZXh8LCB8cmVtb3ZlZHwgc2VxdWVuY2Ugb2YgaXRlbXMgd2VyZSByZW1vdmVkLCBhbmQgY291bnRpbmcgZm9yd2FyZFxuICAgICAqIGZyb20gfGluZGV4fCwgfGFkZGVkQ291bnR8IGl0ZW1zIHdlcmUgYWRkZWQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBMYWNraW5nIGluZGl2aWR1YWwgc3BsaWNlIG11dGF0aW9uIGluZm9ybWF0aW9uLCB0aGUgbWluaW1hbCBzZXQgb2ZcbiAgICAgKiBzcGxpY2VzIGNhbiBiZSBzeW50aGVzaXplZCBnaXZlbiB0aGUgcHJldmlvdXMgc3RhdGUgYW5kIGZpbmFsIHN0YXRlIG9mIGFuXG4gICAgICogYXJyYXkuIFRoZSBiYXNpYyBhcHByb2FjaCBpcyB0byBjYWxjdWxhdGUgdGhlIGVkaXQgZGlzdGFuY2UgbWF0cml4IGFuZFxuICAgICAqIGNob29zZSB0aGUgc2hvcnRlc3QgcGF0aCB0aHJvdWdoIGl0LlxuICAgICAqXG4gICAgICogQ29tcGxleGl0eTogTyhsICogcClcbiAgICAgKiAgIGw6IFRoZSBsZW5ndGggb2YgdGhlIGN1cnJlbnQgYXJyYXlcbiAgICAgKiAgIHA6IFRoZSBsZW5ndGggb2YgdGhlIG9sZCBhcnJheVxuICAgICAqL1xuICAgIGNhbGNTcGxpY2VzOiBmdW5jdGlvbihjdXJyZW50LCBjdXJyZW50U3RhcnQsIGN1cnJlbnRFbmQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIG9sZCwgb2xkU3RhcnQsIG9sZEVuZCkge1xuICAgICAgdmFyIHByZWZpeENvdW50ID0gMDtcbiAgICAgIHZhciBzdWZmaXhDb3VudCA9IDA7XG5cbiAgICAgIHZhciBtaW5MZW5ndGggPSBNYXRoLm1pbihjdXJyZW50RW5kIC0gY3VycmVudFN0YXJ0LCBvbGRFbmQgLSBvbGRTdGFydCk7XG4gICAgICBpZiAoY3VycmVudFN0YXJ0ID09IDAgJiYgb2xkU3RhcnQgPT0gMClcbiAgICAgICAgcHJlZml4Q291bnQgPSB0aGlzLnNoYXJlZFByZWZpeChjdXJyZW50LCBvbGQsIG1pbkxlbmd0aCk7XG5cbiAgICAgIGlmIChjdXJyZW50RW5kID09IGN1cnJlbnQubGVuZ3RoICYmIG9sZEVuZCA9PSBvbGQubGVuZ3RoKVxuICAgICAgICBzdWZmaXhDb3VudCA9IHRoaXMuc2hhcmVkU3VmZml4KGN1cnJlbnQsIG9sZCwgbWluTGVuZ3RoIC0gcHJlZml4Q291bnQpO1xuXG4gICAgICBjdXJyZW50U3RhcnQgKz0gcHJlZml4Q291bnQ7XG4gICAgICBvbGRTdGFydCArPSBwcmVmaXhDb3VudDtcbiAgICAgIGN1cnJlbnRFbmQgLT0gc3VmZml4Q291bnQ7XG4gICAgICBvbGRFbmQgLT0gc3VmZml4Q291bnQ7XG5cbiAgICAgIGlmIChjdXJyZW50RW5kIC0gY3VycmVudFN0YXJ0ID09IDAgJiYgb2xkRW5kIC0gb2xkU3RhcnQgPT0gMClcbiAgICAgICAgcmV0dXJuIFtdO1xuXG4gICAgICBpZiAoY3VycmVudFN0YXJ0ID09IGN1cnJlbnRFbmQpIHtcbiAgICAgICAgdmFyIHNwbGljZSA9IG5ld1NwbGljZShjdXJyZW50U3RhcnQsIFtdLCAwKTtcbiAgICAgICAgd2hpbGUgKG9sZFN0YXJ0IDwgb2xkRW5kKVxuICAgICAgICAgIHNwbGljZS5yZW1vdmVkLnB1c2gob2xkW29sZFN0YXJ0KytdKTtcblxuICAgICAgICByZXR1cm4gWyBzcGxpY2UgXTtcbiAgICAgIH0gZWxzZSBpZiAob2xkU3RhcnQgPT0gb2xkRW5kKVxuICAgICAgICByZXR1cm4gWyBuZXdTcGxpY2UoY3VycmVudFN0YXJ0LCBbXSwgY3VycmVudEVuZCAtIGN1cnJlbnRTdGFydCkgXTtcblxuICAgICAgdmFyIG9wcyA9IHRoaXMuc3BsaWNlT3BlcmF0aW9uc0Zyb21FZGl0RGlzdGFuY2VzKFxuICAgICAgICAgIHRoaXMuY2FsY0VkaXREaXN0YW5jZXMoY3VycmVudCwgY3VycmVudFN0YXJ0LCBjdXJyZW50RW5kLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkLCBvbGRTdGFydCwgb2xkRW5kKSk7XG5cbiAgICAgIHZhciBzcGxpY2UgPSB1bmRlZmluZWQ7XG4gICAgICB2YXIgc3BsaWNlcyA9IFtdO1xuICAgICAgdmFyIGluZGV4ID0gY3VycmVudFN0YXJ0O1xuICAgICAgdmFyIG9sZEluZGV4ID0gb2xkU3RhcnQ7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9wcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBzd2l0Y2gob3BzW2ldKSB7XG4gICAgICAgICAgY2FzZSBFRElUX0xFQVZFOlxuICAgICAgICAgICAgaWYgKHNwbGljZSkge1xuICAgICAgICAgICAgICBzcGxpY2VzLnB1c2goc3BsaWNlKTtcbiAgICAgICAgICAgICAgc3BsaWNlID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpbmRleCsrO1xuICAgICAgICAgICAgb2xkSW5kZXgrKztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgRURJVF9VUERBVEU6XG4gICAgICAgICAgICBpZiAoIXNwbGljZSlcbiAgICAgICAgICAgICAgc3BsaWNlID0gbmV3U3BsaWNlKGluZGV4LCBbXSwgMCk7XG5cbiAgICAgICAgICAgIHNwbGljZS5hZGRlZENvdW50Kys7XG4gICAgICAgICAgICBpbmRleCsrO1xuXG4gICAgICAgICAgICBzcGxpY2UucmVtb3ZlZC5wdXNoKG9sZFtvbGRJbmRleF0pO1xuICAgICAgICAgICAgb2xkSW5kZXgrKztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgRURJVF9BREQ6XG4gICAgICAgICAgICBpZiAoIXNwbGljZSlcbiAgICAgICAgICAgICAgc3BsaWNlID0gbmV3U3BsaWNlKGluZGV4LCBbXSwgMCk7XG5cbiAgICAgICAgICAgIHNwbGljZS5hZGRlZENvdW50Kys7XG4gICAgICAgICAgICBpbmRleCsrO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSBFRElUX0RFTEVURTpcbiAgICAgICAgICAgIGlmICghc3BsaWNlKVxuICAgICAgICAgICAgICBzcGxpY2UgPSBuZXdTcGxpY2UoaW5kZXgsIFtdLCAwKTtcblxuICAgICAgICAgICAgc3BsaWNlLnJlbW92ZWQucHVzaChvbGRbb2xkSW5kZXhdKTtcbiAgICAgICAgICAgIG9sZEluZGV4Kys7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoc3BsaWNlKSB7XG4gICAgICAgIHNwbGljZXMucHVzaChzcGxpY2UpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHNwbGljZXM7XG4gICAgfSxcblxuICAgIHNoYXJlZFByZWZpeDogZnVuY3Rpb24oY3VycmVudCwgb2xkLCBzZWFyY2hMZW5ndGgpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2VhcmNoTGVuZ3RoOyBpKyspXG4gICAgICAgIGlmICghdGhpcy5lcXVhbHMoY3VycmVudFtpXSwgb2xkW2ldKSlcbiAgICAgICAgICByZXR1cm4gaTtcbiAgICAgIHJldHVybiBzZWFyY2hMZW5ndGg7XG4gICAgfSxcblxuICAgIHNoYXJlZFN1ZmZpeDogZnVuY3Rpb24oY3VycmVudCwgb2xkLCBzZWFyY2hMZW5ndGgpIHtcbiAgICAgIHZhciBpbmRleDEgPSBjdXJyZW50Lmxlbmd0aDtcbiAgICAgIHZhciBpbmRleDIgPSBvbGQubGVuZ3RoO1xuICAgICAgdmFyIGNvdW50ID0gMDtcbiAgICAgIHdoaWxlIChjb3VudCA8IHNlYXJjaExlbmd0aCAmJiB0aGlzLmVxdWFscyhjdXJyZW50Wy0taW5kZXgxXSwgb2xkWy0taW5kZXgyXSkpXG4gICAgICAgIGNvdW50Kys7XG5cbiAgICAgIHJldHVybiBjb3VudDtcbiAgICB9LFxuXG4gICAgY2FsY3VsYXRlU3BsaWNlczogZnVuY3Rpb24oY3VycmVudCwgcHJldmlvdXMpIHtcbiAgICAgIHJldHVybiB0aGlzLmNhbGNTcGxpY2VzKGN1cnJlbnQsIDAsIGN1cnJlbnQubGVuZ3RoLCBwcmV2aW91cywgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByZXZpb3VzLmxlbmd0aCk7XG4gICAgfSxcblxuICAgIGVxdWFsczogZnVuY3Rpb24oY3VycmVudFZhbHVlLCBwcmV2aW91c1ZhbHVlKSB7XG4gICAgICByZXR1cm4gY3VycmVudFZhbHVlID09PSBwcmV2aW91c1ZhbHVlO1xuICAgIH1cbiAgfTtcblxuICB2YXIgYXJyYXlTcGxpY2UgPSBuZXcgQXJyYXlTcGxpY2UoKTtcblxuICBmdW5jdGlvbiBjYWxjU3BsaWNlcyhjdXJyZW50LCBjdXJyZW50U3RhcnQsIGN1cnJlbnRFbmQsXG4gICAgICAgICAgICAgICAgICAgICAgIG9sZCwgb2xkU3RhcnQsIG9sZEVuZCkge1xuICAgIHJldHVybiBhcnJheVNwbGljZS5jYWxjU3BsaWNlcyhjdXJyZW50LCBjdXJyZW50U3RhcnQsIGN1cnJlbnRFbmQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZCwgb2xkU3RhcnQsIG9sZEVuZCk7XG4gIH1cblxuICBmdW5jdGlvbiBpbnRlcnNlY3Qoc3RhcnQxLCBlbmQxLCBzdGFydDIsIGVuZDIpIHtcbiAgICAvLyBEaXNqb2ludFxuICAgIGlmIChlbmQxIDwgc3RhcnQyIHx8IGVuZDIgPCBzdGFydDEpXG4gICAgICByZXR1cm4gLTE7XG5cbiAgICAvLyBBZGphY2VudFxuICAgIGlmIChlbmQxID09IHN0YXJ0MiB8fCBlbmQyID09IHN0YXJ0MSlcbiAgICAgIHJldHVybiAwO1xuXG4gICAgLy8gTm9uLXplcm8gaW50ZXJzZWN0LCBzcGFuMSBmaXJzdFxuICAgIGlmIChzdGFydDEgPCBzdGFydDIpIHtcbiAgICAgIGlmIChlbmQxIDwgZW5kMilcbiAgICAgICAgcmV0dXJuIGVuZDEgLSBzdGFydDI7IC8vIE92ZXJsYXBcbiAgICAgIGVsc2VcbiAgICAgICAgcmV0dXJuIGVuZDIgLSBzdGFydDI7IC8vIENvbnRhaW5lZFxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBOb24temVybyBpbnRlcnNlY3QsIHNwYW4yIGZpcnN0XG4gICAgICBpZiAoZW5kMiA8IGVuZDEpXG4gICAgICAgIHJldHVybiBlbmQyIC0gc3RhcnQxOyAvLyBPdmVybGFwXG4gICAgICBlbHNlXG4gICAgICAgIHJldHVybiBlbmQxIC0gc3RhcnQxOyAvLyBDb250YWluZWRcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBtZXJnZVNwbGljZShzcGxpY2VzLCBpbmRleCwgcmVtb3ZlZCwgYWRkZWRDb3VudCkge1xuXG4gICAgdmFyIHNwbGljZSA9IG5ld1NwbGljZShpbmRleCwgcmVtb3ZlZCwgYWRkZWRDb3VudCk7XG5cbiAgICB2YXIgaW5zZXJ0ZWQgPSBmYWxzZTtcbiAgICB2YXIgaW5zZXJ0aW9uT2Zmc2V0ID0gMDtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc3BsaWNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGN1cnJlbnQgPSBzcGxpY2VzW2ldO1xuICAgICAgY3VycmVudC5pbmRleCArPSBpbnNlcnRpb25PZmZzZXQ7XG5cbiAgICAgIGlmIChpbnNlcnRlZClcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIHZhciBpbnRlcnNlY3RDb3VudCA9IGludGVyc2VjdChzcGxpY2UuaW5kZXgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3BsaWNlLmluZGV4ICsgc3BsaWNlLnJlbW92ZWQubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnQuaW5kZXgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudC5pbmRleCArIGN1cnJlbnQuYWRkZWRDb3VudCk7XG5cbiAgICAgIGlmIChpbnRlcnNlY3RDb3VudCA+PSAwKSB7XG4gICAgICAgIC8vIE1lcmdlIHRoZSB0d28gc3BsaWNlc1xuXG4gICAgICAgIHNwbGljZXMuc3BsaWNlKGksIDEpO1xuICAgICAgICBpLS07XG5cbiAgICAgICAgaW5zZXJ0aW9uT2Zmc2V0IC09IGN1cnJlbnQuYWRkZWRDb3VudCAtIGN1cnJlbnQucmVtb3ZlZC5sZW5ndGg7XG5cbiAgICAgICAgc3BsaWNlLmFkZGVkQ291bnQgKz0gY3VycmVudC5hZGRlZENvdW50IC0gaW50ZXJzZWN0Q291bnQ7XG4gICAgICAgIHZhciBkZWxldGVDb3VudCA9IHNwbGljZS5yZW1vdmVkLmxlbmd0aCArXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnQucmVtb3ZlZC5sZW5ndGggLSBpbnRlcnNlY3RDb3VudDtcblxuICAgICAgICBpZiAoIXNwbGljZS5hZGRlZENvdW50ICYmICFkZWxldGVDb3VudCkge1xuICAgICAgICAgIC8vIG1lcmdlZCBzcGxpY2UgaXMgYSBub29wLiBkaXNjYXJkLlxuICAgICAgICAgIGluc2VydGVkID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YXIgcmVtb3ZlZCA9IGN1cnJlbnQucmVtb3ZlZDtcblxuICAgICAgICAgIGlmIChzcGxpY2UuaW5kZXggPCBjdXJyZW50LmluZGV4KSB7XG4gICAgICAgICAgICAvLyBzb21lIHByZWZpeCBvZiBzcGxpY2UucmVtb3ZlZCBpcyBwcmVwZW5kZWQgdG8gY3VycmVudC5yZW1vdmVkLlxuICAgICAgICAgICAgdmFyIHByZXBlbmQgPSBzcGxpY2UucmVtb3ZlZC5zbGljZSgwLCBjdXJyZW50LmluZGV4IC0gc3BsaWNlLmluZGV4KTtcbiAgICAgICAgICAgIEFycmF5LnByb3RvdHlwZS5wdXNoLmFwcGx5KHByZXBlbmQsIHJlbW92ZWQpO1xuICAgICAgICAgICAgcmVtb3ZlZCA9IHByZXBlbmQ7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHNwbGljZS5pbmRleCArIHNwbGljZS5yZW1vdmVkLmxlbmd0aCA+IGN1cnJlbnQuaW5kZXggKyBjdXJyZW50LmFkZGVkQ291bnQpIHtcbiAgICAgICAgICAgIC8vIHNvbWUgc3VmZml4IG9mIHNwbGljZS5yZW1vdmVkIGlzIGFwcGVuZGVkIHRvIGN1cnJlbnQucmVtb3ZlZC5cbiAgICAgICAgICAgIHZhciBhcHBlbmQgPSBzcGxpY2UucmVtb3ZlZC5zbGljZShjdXJyZW50LmluZGV4ICsgY3VycmVudC5hZGRlZENvdW50IC0gc3BsaWNlLmluZGV4KTtcbiAgICAgICAgICAgIEFycmF5LnByb3RvdHlwZS5wdXNoLmFwcGx5KHJlbW92ZWQsIGFwcGVuZCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgc3BsaWNlLnJlbW92ZWQgPSByZW1vdmVkO1xuICAgICAgICAgIGlmIChjdXJyZW50LmluZGV4IDwgc3BsaWNlLmluZGV4KSB7XG4gICAgICAgICAgICBzcGxpY2UuaW5kZXggPSBjdXJyZW50LmluZGV4O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChzcGxpY2UuaW5kZXggPCBjdXJyZW50LmluZGV4KSB7XG4gICAgICAgIC8vIEluc2VydCBzcGxpY2UgaGVyZS5cblxuICAgICAgICBpbnNlcnRlZCA9IHRydWU7XG5cbiAgICAgICAgc3BsaWNlcy5zcGxpY2UoaSwgMCwgc3BsaWNlKTtcbiAgICAgICAgaSsrO1xuXG4gICAgICAgIHZhciBvZmZzZXQgPSBzcGxpY2UuYWRkZWRDb3VudCAtIHNwbGljZS5yZW1vdmVkLmxlbmd0aFxuICAgICAgICBjdXJyZW50LmluZGV4ICs9IG9mZnNldDtcbiAgICAgICAgaW5zZXJ0aW9uT2Zmc2V0ICs9IG9mZnNldDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIWluc2VydGVkKVxuICAgICAgc3BsaWNlcy5wdXNoKHNwbGljZSk7XG4gIH1cblxuICBmdW5jdGlvbiBjcmVhdGVJbml0aWFsU3BsaWNlcyhhcnJheSwgY2hhbmdlUmVjb3Jkcykge1xuICAgIHZhciBzcGxpY2VzID0gW107XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoYW5nZVJlY29yZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciByZWNvcmQgPSBjaGFuZ2VSZWNvcmRzW2ldO1xuICAgICAgc3dpdGNoKHJlY29yZC50eXBlKSB7XG4gICAgICAgIGNhc2UgJ3NwbGljZSc6XG4gICAgICAgICAgbWVyZ2VTcGxpY2Uoc3BsaWNlcywgcmVjb3JkLmluZGV4LCByZWNvcmQucmVtb3ZlZC5zbGljZSgpLCByZWNvcmQuYWRkZWRDb3VudCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2FkZCc6XG4gICAgICAgIGNhc2UgJ3VwZGF0ZSc6XG4gICAgICAgIGNhc2UgJ2RlbGV0ZSc6XG4gICAgICAgICAgaWYgKCFpc0luZGV4KHJlY29yZC5uYW1lKSlcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIHZhciBpbmRleCA9IHRvTnVtYmVyKHJlY29yZC5uYW1lKTtcbiAgICAgICAgICBpZiAoaW5kZXggPCAwKVxuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgbWVyZ2VTcGxpY2Uoc3BsaWNlcywgaW5kZXgsIFtyZWNvcmQub2xkVmFsdWVdLCAxKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBjb25zb2xlLmVycm9yKCdVbmV4cGVjdGVkIHJlY29yZCB0eXBlOiAnICsgSlNPTi5zdHJpbmdpZnkocmVjb3JkKSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHNwbGljZXM7XG4gIH1cblxuICBmdW5jdGlvbiBwcm9qZWN0QXJyYXlTcGxpY2VzKGFycmF5LCBjaGFuZ2VSZWNvcmRzKSB7XG4gICAgdmFyIHNwbGljZXMgPSBbXTtcblxuICAgIGNyZWF0ZUluaXRpYWxTcGxpY2VzKGFycmF5LCBjaGFuZ2VSZWNvcmRzKS5mb3JFYWNoKGZ1bmN0aW9uKHNwbGljZSkge1xuICAgICAgaWYgKHNwbGljZS5hZGRlZENvdW50ID09IDEgJiYgc3BsaWNlLnJlbW92ZWQubGVuZ3RoID09IDEpIHtcbiAgICAgICAgaWYgKHNwbGljZS5yZW1vdmVkWzBdICE9PSBhcnJheVtzcGxpY2UuaW5kZXhdKVxuICAgICAgICAgIHNwbGljZXMucHVzaChzcGxpY2UpO1xuXG4gICAgICAgIHJldHVyblxuICAgICAgfTtcblxuICAgICAgc3BsaWNlcyA9IHNwbGljZXMuY29uY2F0KGNhbGNTcGxpY2VzKGFycmF5LCBzcGxpY2UuaW5kZXgsIHNwbGljZS5pbmRleCArIHNwbGljZS5hZGRlZENvdW50LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNwbGljZS5yZW1vdmVkLCAwLCBzcGxpY2UucmVtb3ZlZC5sZW5ndGgpKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBzcGxpY2VzO1xuICB9XG5cbiAvLyBFeHBvcnQgdGhlIG9ic2VydmUtanMgb2JqZWN0IGZvciAqKk5vZGUuanMqKiwgd2l0aFxuLy8gYmFja3dhcmRzLWNvbXBhdGliaWxpdHkgZm9yIHRoZSBvbGQgYHJlcXVpcmUoKWAgQVBJLiBJZiB3ZSdyZSBpblxuLy8gdGhlIGJyb3dzZXIsIGV4cG9ydCBhcyBhIGdsb2JhbCBvYmplY3QuXG52YXIgZXhwb3NlID0gZ2xvYmFsO1xuaWYgKHR5cGVvZiBleHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7XG5leHBvc2UgPSBleHBvcnRzID0gbW9kdWxlLmV4cG9ydHM7XG59XG5leHBvc2UgPSBleHBvcnRzO1xufVxuZXhwb3NlLk9ic2VydmVyID0gT2JzZXJ2ZXI7XG5leHBvc2UuT2JzZXJ2ZXIucnVuRU9NXyA9IHJ1bkVPTTtcbmV4cG9zZS5PYnNlcnZlci5vYnNlcnZlclNlbnRpbmVsXyA9IG9ic2VydmVyU2VudGluZWw7IC8vIGZvciB0ZXN0aW5nLlxuZXhwb3NlLk9ic2VydmVyLmhhc09iamVjdE9ic2VydmUgPSBoYXNPYnNlcnZlO1xuZXhwb3NlLkFycmF5T2JzZXJ2ZXIgPSBBcnJheU9ic2VydmVyO1xuZXhwb3NlLkFycmF5T2JzZXJ2ZXIuY2FsY3VsYXRlU3BsaWNlcyA9IGZ1bmN0aW9uKGN1cnJlbnQsIHByZXZpb3VzKSB7XG5yZXR1cm4gYXJyYXlTcGxpY2UuY2FsY3VsYXRlU3BsaWNlcyhjdXJyZW50LCBwcmV2aW91cyk7XG59O1xuZXhwb3NlLlBsYXRmb3JtID0gZ2xvYmFsLlBsYXRmb3JtO1xuZXhwb3NlLkFycmF5U3BsaWNlID0gQXJyYXlTcGxpY2U7XG5leHBvc2UuT2JqZWN0T2JzZXJ2ZXIgPSBPYmplY3RPYnNlcnZlcjtcbn0pKHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnICYmIGdsb2JhbCAmJiB0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUgPyBnbG9iYWwgOiB0aGlzIHx8IHdpbmRvdyk7XG5cbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KSJdfQ==
