var log = require('../node_modules/operations/src/log');
var Logger = log.loggerWithName('RestObject');
Logger.setLevel(log.Level.warn);

var defineSubProperty = require('./misc').defineSubProperty;
var SaveOperation = require('./saveOperation').SaveOperation;

function RestObject(mapping) {
    if (!this) {
        return new RestObject(mapping);
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
            return _.map(self.mapping.relationships, function (r) {
                if (r.isForward(self)) {
                    return r.name;
                }
                else {
                    return r.reverseName;
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
                Logger.trace('id="' + self._id + '" is dirty', self.__dirtyFields);
            }
            return  isDirty;
        },
        enumerable: true,
        configurable: true
    });
}

RestObject.prototype._unmarkFieldsAsDirty = function (fields) {
    var self = this;
    _.each(fields, function (f) {
        self._unmarkFieldAsDirty(f);
    })
};

RestObject.prototype._unmarkFieldAsDirty = function (field) {
    var idx = this.__dirtyFields.indexOf(field);
    if (idx > -1) {
        this.__dirtyFields.splice(idx, 1);
    }
    this._markTypeAsDirtyIfNeccessary();
};

RestObject.prototype._markFieldsAsDirty = function (fields) {
    var self = this;
    _.each(fields, function (f) {
        self._markFieldAsDirty(f);
    });
};

RestObject.prototype._markFieldAsDirty = function (field) {
    if (this.__dirtyFields.indexOf(field) < 0) {
        this.__dirtyFields.push(field);
    }
    this._markTypeAsDirtyIfNeccessary();
};

/**
 * Mark dirty one level up.
 * @private
 */
RestObject.prototype._markTypeAsDirtyIfNeccessary = function () {
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
RestObject.prototype.save = function (callback) {
    Logger.trace('save');
    var op = new SaveOperation(this, callback);
    op.start();
};

/**
 * Human readable dump of this object
 * @returns {*}
 * @private
 */
RestObject.prototype._dump = function (asJson) {
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
        if (self[f]) {
            if (self[f].hasOwnProperty('_id')) {
                if (Object.prototype.toString.call(self[f]) === '[object Array]') {
                    if (self[f].length) {
                        memo[f] = _.map(self[f], function (proxy) {return proxy._id});
                    }
                }
                else if (self[f]._id) {
                    memo[f] = self[f]._id;
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

exports.RestObject = RestObject;