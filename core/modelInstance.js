var log = require('./operation/log')
    , util = require('./util')
    , defineSubProperty = util.defineSubProperty
    , _ = util._
    , error = require('./error')
    , InternalSiestaError = error.InternalSiestaError
    , coreChanges = require('./changes')
    , notificationCentre = require('./notificationCentre').notificationCentre
    , cache = require('./cache');

var Logger = log.loggerWithName('ModelInstance');
Logger.setLevel(log.Level.warn);

function ModelInstance(model) {
    var self = this;
    this.model = model;
    Object.defineProperty(this, 'idField', {
        get: function () {
            return self.model.id || 'id';
        },
        enumerable: true,
        configurable: true
    });
    defineSubProperty.call(this, 'type', this.model);
    defineSubProperty.call(this, 'collection', this.model);
    defineSubProperty.call(this, '_attributeNames', this.model);
    Object.defineProperty(this, '_relationshipNames', {
        get: function () {
            var proxies = _.map(Object.keys(self.__proxies || {}), function (x) {return self.__proxies[x]});
            return _.map(proxies, function (p) {
                if (p.isForward) {
                    return p.forwardName;
                } else {
                    return p.reverseName;
                }
            });
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(this, 'dirty', {
        get: function () {
            if (siesta.ext.storageEnabled) {
                return self._id in siesta.ext.storage._unsavedObjectsHash;
            }
            else return undefined;
        },
        enumerable: true
    });
    this.removed = false;
}


_.extend(ModelInstance.prototype, {
    get: function (callback) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
        callback(null, this);
        return deferred ? deferred.promise : null;
    },
    remove: function (callback) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
        cache.remove(this);
        this.removed = true;
        coreChanges.registerChange({
            collection: this.collection,
            model: this.model.type,
            _id: this._id,
            oldId: this._id,
            old: this,
            type: coreChanges.ChangeType.Remove,
            obj: this
        });
        callback(null, this);
        return deferred ? deferred.promise : null;
    },
    restore: function (callback) {
        var deferred = window.q ? window.q.defer() : null;
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
        if (this.removed) {
            cache.insert(this);
            this.removed = false;
        }
        coreChanges.registerChange({
            collection: this.collection,
            model: this.model.type,
            _id: this._id,
            newId: this._id,
            new: this,
            type: coreChanges.ChangeType.New,
            obj: this
        });
        callback(null, this);
        return deferred ? deferred.promise : null;
    }
});

_.extend(ModelInstance.prototype, {
    listen: function (fn) {
        notificationCentre.on(this._id, fn);
        return function () {
            this.removeListener(fn);
        }.bind(this);
    },
    listenOnce: function (fn) {
        return notificationCentre.once(this._id, fn);
    },
    removeListener: function (fn) {
        return notificationCentre.removeListener(this._id, fn);
    }
});

// Inspection
_.extend(ModelInstance.prototype, {
    getAttributes: function () {
        return _.extend({}, this.__values);
    },
    isInstanceOf: function (model) {
        return this.model == model || this.model.isDescendantOf(model);
    }
});

_.extend(ModelInstance.prototype, {
    _dumpString: function (reverseRelationships) {
        return JSON.stringify(this._dump(reverseRelationships, null, 4));
    },
    _dump: function (reverseRelationships) {
        reverseRelationships = reverseRelationships === undefined ? true : reverseRelationships;
        var dumped = _.extend({}, this.__values);
        //_.reduce(this.model.relationships, function (dumped, relationship) {
        //    var relationshipName;
        //    if (relationship.isReverse && reverseRelationships) {
        //        relationshipName = relationship.reverseName;
        //    }
        //    else if (!relationship.isReverse) {
        //        relationshipName = relationship.forwardName;
        //    }
        //    if (relationshipName) {
        //        var relationshipValue = this[relationshipName];
        //        if (util.isArray(relationshipValue)) {
        //            dumped[relationshipName] = _.map(relationshipValue, function (r) {
        //                return r._dump(false);
        //            });
        //        }
        //        else {
        //            dumped[relationshipName] = relationshipValue._dump(false);
        //         }
        //    }
        //    return dumped;
        //}.bind(this), dumped);
        dumped._rev = this._rev;
        dumped._id = this._id;
        return dumped;
    }
});

exports.ModelInstance = ModelInstance;
exports.dumpSaveQueues = function () {
    var dumped = {};
    for (var id in queues) {
        if (queues.hasOwnProperty(id)) {
            var queue = queues[id];
            dumped[id] = {
                numRunning: queue.numRunningOperations,
                queued: queue._queuedOperations.length
            };
        }
    }
    return dumped;
};