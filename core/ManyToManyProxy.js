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
  if (this.isReverse) {
    this.related = [];
    //this.forwardModel.on(modelEvents.ModelEventType.Remove, function(e) {
    //  if (e.field == e.forwardName) {
    //    var idx = this.related.indexOf(e.obj);
    //    if (idx > -1) {
    //      var removed = this.related.splice(idx, 1);
    //    }
    //    modelEvents.emit({
    //      collection: this.reverseModel.collectionName,
    //      model: this.reverseModel.name,
    //      localId: this.object.localId,
    //      field: this.reverseName,
    //      removed: removed,
    //      added: [],
    //      type: ModelEventType.Splice,
    //      index: idx,
    //      obj: this.object
    //    });
    //  }
    //}.bind(this));
  }
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