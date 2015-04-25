/**
 * Base functionality for relationships.
 * @module relationships
 */
var InternalSiestaError = require('./error').InternalSiestaError,
  util = require('./util'),
  Query = require('./Query'),
  log = require('./log'),
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

        // If it's a subclass, a proxy will already exist. Therefore no need to install.
        if (!modelInstance.__proxies[name]) {
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

          modelInstance.__proxies[name] = this;
          modelInstance._proxies.push(this);
        }

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
    if (obj) {
      if (util.isArray(obj)) {
        this.related = obj;
      } else {
        this.related = obj;
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
          console.log('p.related', p.related);
          p.splicer(opts)(p.related.length, 0, self.object);
          console.log('new p.related', p.related);
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
    return this.related ? this.related.slice(idx, idx + numRemove) : null;
  },

  _getAddedForSpliceChangeEvent: function(args) {
    var add = Array.prototype.slice.call(args, 2);
    return add.length ? add : [];
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
