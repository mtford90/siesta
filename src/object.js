var log = require('../vendor/operations.js/src/log');
var Logger = log.loggerWithName('SiestaModel');
Logger.setLevel(log.Level.warn);

var defineSubProperty = require('./misc').defineSubProperty;
var SaveOperation = require('./saveOperation').SaveOperation;
var OperationQueue = require('../vendor/operations.js/src/queue').OperationQueue;

var queues = {};

function SiestaModel(mapping) {
    if (!this) {
        return new SiestaModel(mapping);
    }
    var self = this;
    this.mapping = mapping;
    Object.defineProperty(this, 'idField', {
        get: function () {
            return self.mapping.id ? self.mapping.id : 'id';
        },
        enumerable: true,
        configurable: true
    });
    defineSubProperty.call(this, 'type', this.mapping);
    defineSubProperty.call(this, 'collection', this.mapping);
    defineSubProperty.call(this, '_fields', this.mapping);
    Object.defineProperty(this, '_relationshipFields', {
        get: function () {
            return _.map(self._proxies, function (p) {
                if (p.isForward) {
                    return p.forwardName;
                }
                else {
                    return p.reverseName;
                }
            });
        },
        enumerable: true,
        configurable: true
    });

    this.__dirtyFields = [];

    Object.defineProperty(this, 'isDirty', {
        get: function () {
            var isDirty = self.__dirtyFields.length > 0;
            if (isDirty) {
                if (Logger.trace.isEnabled)
                    Logger.trace('id="' + self._id + '" is dirty', self.__dirtyFields);
            }
            return  isDirty;
        },
        enumerable: true,
        configurable: true
    });

    this.isFault = false;
}

SiestaModel.prototype._unmarkFieldsAsDirty = function (fields) {
    var self = this;
    _.each(fields, function (f) {
        self._unmarkFieldAsDirty(f);
    })
};

SiestaModel.prototype._unmarkFieldAsDirty = function (field) {
    var idx = this.__dirtyFields.indexOf(field);
    if (idx > -1) {
        this.__dirtyFields.splice(idx, 1);
    }
    this._markTypeAsDirtyIfNeccessary();
};

SiestaModel.prototype._markFieldsAsDirty = function (fields) {
    var self = this;
    _.each(fields, function (f) {
        self._markFieldAsDirty(f);
    });
};

SiestaModel.prototype._markFieldAsDirty = function (field) {
    if (Logger.trace.isEnabled)
        Logger.trace('_markFieldAsDirty', field);
    if (this.__dirtyFields.indexOf(field) < 0) {
        this.__dirtyFields.push(field);
    }
    if (Logger.trace.isEnabled)
        Logger.trace('__dirtyFields', this.__dirtyFields);
    this._markTypeAsDirtyIfNeccessary();
};

/**
 * Mark dirty one level up.
 * @private
 */
SiestaModel.prototype._markTypeAsDirtyIfNeccessary = function () {
    if (this.isDirty) {
        this.mapping._markObjectAsDirty(this);
    }
    else {
        this.mapping._unmarkObjectAsDirty(this);
    }
};

/**
 * Write down any dirty fields to PouchDB.
 * @param callback Called when completed
 */
SiestaModel.prototype.save = function (callback) {
    if (Logger.trace.isEnabled)
        Logger.trace('save');
    var op = new SaveOperation(this);
    op.onCompletion(function () {
        if (callback) callback(op.error, op);
    });
    var localId = this._id;
    var queue = queues[localId];
    if (!queue) {
        queue = new OperationQueue('SiestaModel[' + localId.toString() + ']', 1);
        queues[localId] = queue;
        queue.start();
    }
    queue.addOperation(op);
};

/**
 * Human readable dump of this object
 * @returns {*}
 * @private
 */
SiestaModel.prototype._dump = function (asJson) {
    var self = this;
    var cleanObj = {};
    cleanObj.mapping = this.mapping.type;
    cleanObj.collection = this.collection;
    cleanObj._id = this._id;
    cleanObj = _.reduce(this._fields, function (memo, f) {
        if (self[f]) {
            memo[f] = self[f];
        }
        return memo;
    }, cleanObj);
    cleanObj = _.reduce(this._relationshipFields, function (memo, f) {
        if (self[f + 'Proxy']) {
            if (self[f + 'Proxy'].hasOwnProperty('_id')) {
                if (Object.prototype.toString.call(self[f + 'Proxy']._id) === '[object Array]') {
                    if (self[f].length) {
                        memo[f] = self[f + 'Proxy']._id;
                    }
                }
                else if (self[f + 'Proxy']._id) {
                    memo[f] = self[f + 'Proxy']._id;
                }
            }
            else {
                memo[f] = self[f];
            }
        }
        return memo;
    }, cleanObj);


    return asJson ? JSON.stringify(cleanObj, null, 4) : cleanObj;
};

exports.SiestaModel = SiestaModel;
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