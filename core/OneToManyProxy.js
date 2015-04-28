var RelationshipProxy = require('./RelationshipProxy'),
  util = require('./util'),
  modelEvents = require('./modelEvents'),
  wrapArrayForAttributes = modelEvents.wrapArray,
  ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver,
  ModelEventType = modelEvents.ModelEventType;

/**
 * @class  [OneToManyProxy description]
 * @constructor
 * @param {[type]} opts
 */
function OneToManyProxy(opts) {
  RelationshipProxy.call(this, opts);
  if (this.isReverse) {
    this.related = [];
  }
}

OneToManyProxy.prototype = Object.create(RelationshipProxy.prototype);

util.extend(OneToManyProxy.prototype, {
  clearReverse: function(removed) {
    var self = this;
    removed.forEach(function(removedObject) {
      var reverseProxy = self.reverseProxyForInstance(removedObject);
      reverseProxy.setIdAndRelated(null);
    });
  },
  setReverseOfAdded: function(added) {
    var self = this;
    added.forEach(function(added) {
      var forwardProxy = self.reverseProxyForInstance(added);
      forwardProxy.setIdAndRelated(self.object);
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
          model.context.broadcast({
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
  /**
   * Validate the object that we're setting
   * @param obj
   * @returns {string|null} An error message or null
   * @class OneToManyProxy
   */
  validate: function(obj) {
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
  install: function(obj) {
    RelationshipProxy.prototype.install.call(this, obj);

    if (this.isReverse) {
      obj[('splice' + util.capitaliseFirstLetter(this.reverseName))] = this.splice.bind(this);
      this.wrapArray(this.related);
    }

  }
});

module.exports = OneToManyProxy;
