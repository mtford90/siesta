var log = require('./operation/log');
var Logger = log.loggerWithName('SiestaModel');
Logger.setLevel(log.Level.warn);

var defineSubProperty = require('./misc').defineSubProperty;
//var OperationQueue = require('../vendor/operations.js/src/queue').OperationQueue;
var util = require('./util');
var _ = util._;
var error = require('./error');
var InternalSiestaError = error.InternalSiestaError;
var coreChanges = require('./changes');

var cache = require('./cache');

//var queues = {};

function SiestaModel(mapping) {

    if (!this) {
        return new SiestaModel(mapping);
    }
    var self = this;
    this.mapping = mapping;
    Object.defineProperty(this, 'idField', {
        get: function() {
            return self.mapping.id || 'id';
        },
        enumerable: true,
        configurable: true
    });
    defineSubProperty.call(this, 'type', this.mapping);
    defineSubProperty.call(this, 'collection', this.mapping);
    defineSubProperty.call(this, '_fields', this.mapping);
    Object.defineProperty(this, '_relationshipFields', {
        get: function() {
            return _.map(self._proxies, function(p) {
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


    this.isFault = false;

    Object.defineProperty(this, 'isSaved', {
        get: function() {
            return !!self._rev;
        },
        enumerable: true,
        configurable: true
    });

    this._rev = null;

    this.removed = false;
}

/**
 * Human readable dump of this object
 * @returns {*}
 * @private
 */
SiestaModel.prototype._dump = function(asJson) {
    var self = this;
    var cleanObj = {};
    cleanObj.mapping = this.mapping.type;
    cleanObj.collection = this.collection;
    cleanObj._id = this._id;
    cleanObj = _.reduce(this._fields, function(memo, f) {
        if (self[f]) {
            memo[f] = self[f];
        }
        return memo;
    }, cleanObj);
    cleanObj = _.reduce(this._relationshipFields, function(memo, f) {
        if (self[f + 'Proxy']) {
            if (self[f + 'Proxy'].hasOwnProperty('_id')) {
                if (util.isArray(self[f + 'Proxy']._id)) {
                    if (self[f].length) {
                        memo[f] = self[f + 'Proxy']._id;
                    }
                } else if (self[f + 'Proxy']._id) {
                    memo[f] = self[f + 'Proxy']._id;
                }
            } else {
                memo[f] = self[f];
            }
        }
        return memo;
    }, cleanObj);

    return asJson ? JSON.stringify(cleanObj, null, 4) : cleanObj;
};


SiestaModel.prototype.get = function(callback) {
    var deferred = window.q ? window.q.defer() : null;
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    callback(null, this);
    return deferred ? deferred.promise : null;
};

SiestaModel.prototype.remove = function(callback) {
    var deferred = window.q ? window.q.defer() : null;
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    cache.remove(this);
    this.removed = true;
    coreChanges.registerChange({
        collection: this.collection,
        mapping: this.mapping.type,
        _id: this._id,
        oldId: this._id,
        old: this,
        type: coreChanges.ChangeType.Remove,
        obj: this
    });
    callback(null, this);
    return deferred ? deferred.promise : null;
}

SiestaModel.prototype.restore = function(callback) {
    var deferred = window.q ? window.q.defer() : null;
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    if (this.removed) {
        cache.insert(this);
        this.removed = false;
    }
    coreChanges.registerChange({
        collection: this.collection,
        mapping: this.mapping.type,
        _id: this._id,
        newId: this._id,
        new: this,
        type: coreChanges.ChangeType.New,
        obj: this
    });
    callback(null, this);
    return deferred ? deferred.promise : null;
}

exports.SiestaModel = SiestaModel;
exports.dumpSaveQueues = function() {
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