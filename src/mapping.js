var log = require('../vendor/operations.js/src/log');
var Logger = log.loggerWithName('Mapping');
Logger.setLevel(log.Level.warn);

var defineSubProperty = require('./misc').defineSubProperty;
var CollectionRegistry = require('./collectionRegistry').CollectionRegistry;
var RestError = require('./error').RestError;
var relationship = require('./relationship');
var RelationshipType = relationship.RelationshipType;
var Query = require('./query').Query;
var index = require('./index');
var Index = index.Index;
var Operation = require('../vendor/operations.js/src/operation').Operation;
var MappingOperation = require('./mappingOperation').MappingOperation;
var SaveOperation = require('./saveOperation').SaveOperation;
var RestObject = require('./object').RestObject;
var guid = require('./misc').guid;
var cache = require('./cache');
var extend = require('extend');

var ChangeType = require('./ChangeType').ChangeType;
var wrapArray = require('./notificationCentre').wrapArray;
var broadcast = require('./notificationCentre').broadcast;


var ForeignKeyProxy = require('./proxy').ForeignKeyProxy;
var OneToOneProxy = require('./proxy').OneToOneProxy;


function Mapping(opts) {
    var self = this;
    this._opts = opts;
    Object.defineProperty(this, '_fields', {
        get: function () {
            var fields = [];
            if (self._opts.id) {
                fields.push(self._opts.id);
            }
            if (self._opts.attributes) {
                _.each(self._opts.attributes, function (x) {fields.push(x)});
            }
            return fields;
        },
        enumerable: true,
        configurable: true
    });

    defineSubProperty.call(this, 'type', self._opts);
    defineSubProperty.call(this, 'id', self._opts);
    defineSubProperty.call(this, 'collection', self._opts);
    defineSubProperty.call(this, 'attributes', self._opts);
    defineSubProperty.call(this, 'relationships', self._opts);

    if (!this.relationships) {
        this.relationships = [];
    }

    this.__dirtyObjects = [];

    Object.defineProperty(this, 'isDirty', {
        get: function () {
            return !!self.__dirtyObjects.length;
        },
        enumerable: true,
        configurable: true
    });

}

Mapping.prototype._markObjectAsDirty = function (obj) {
    if (this.__dirtyObjects.indexOf(obj) < 0) {
        this.__dirtyObjects.push(obj);
    }
    this._markCollectionAsDirtyIfNeccessary();
};

Mapping.prototype._unmarkObjectAsDirty = function (obj) {
    var idx = this.__dirtyObjects.indexOf(obj);
    if (idx > -1) {
        this.__dirtyObjects.splice(idx, 1);
    }
    this._markCollectionAsDirtyIfNeccessary();
};

Mapping.prototype._markCollectionAsDirtyIfNeccessary = function () {
    var collection = CollectionRegistry[this.collection];
    if (collection) {
        if (this.__dirtyObjects.length) {
            collection._markMappingAsDirty(this);
        }
        else {
            collection._unmarkMappingAsDirty(this);
        }
    }
    else {
        throw new RestError('Collection "' + this.collection + '" does not exist.');
    }

};

Mapping.prototype.installRelationships = function () {
    var self = this;
    self._relationships = [];
    if (self._opts.relationships) {
        for (var name in self._opts.relationships) {
            if (Logger.debug.isEnabled)
                Logger.debug(self.type + ': configuring relationship ' + name);
            if (self._opts.relationships.hasOwnProperty(name)) {
                var relationship = self._opts.relationships[name];
                if (relationship.type == RelationshipType.ForeignKey ||
                    relationship.type == RelationshipType.OneToOne) {
                    var mappingName = relationship.mapping;
                    if (Logger.debug.isEnabled)
                        Logger.debug('reverseMappingName', mappingName);
                    var collection = CollectionRegistry[self.collection];
                    if (Logger.debug.isEnabled)
                        Logger.debug('collection', CollectionRegistry);
                    var reverseMapping = collection[mappingName];

                    if (!reverseMapping) {
                        var arr = mappingName.split('.');
                        if (arr.length == 2) {
                            var collectionName = arr[0];
                            mappingName = arr[1];
                            var otherCollection = CollectionRegistry[collectionName];
                            if (!otherCollection) {
                                throw new RestError('Collection with name "' + collectionName + '" does not exist.');
                            }
                            reverseMapping = otherCollection[mappingName];
                        }
                    }
                    if (Logger.debug.isEnabled)
                        Logger.debug('reverseMapping', reverseMapping);
                    if (reverseMapping) {
                        relationship.reverseMapping = reverseMapping;
                        relationship.forwardMapping = this;
                        relationship.forwardName = name;
                        relationship.reverseName = relationship.reverse;
                    }
                    else {
                        throw new RestError('Mapping with name "' + mappingName.toString() + '" does not exist');
                    }
                }
                else {
                    throw new RestError('Relationship type ' + relationship.type + ' does not exist');
                }

            }
        }
    }
};

Mapping.prototype.installReverseRelationships = function () {
    for (var forwardName in this.relationships) {
        if (this.relationships.hasOwnProperty(forwardName)) {
            var relationship = this.relationships[forwardName];
            var reverseMapping = relationship.reverseMapping;
            reverseMapping.relationships[relationship.reverseName] = relationship;
        }
    }
};

Mapping.prototype.query = function (query, callback) {
    var q = new Query(this, query);
    q.execute(callback);
};

Mapping.prototype.get = function (id, callback) {
    var opts = {};
    opts[this.id] = id;
    var q = new Query(this, opts);
    q.execute(function (err, rows) {
        var obj = null;
        if (!err && rows.length) {
            if (rows.length > 1) {
                err = 'More than one object with id=' + id.toString();
            }
            else {
                obj = rows[0];
            }
        }
        if (callback) callback(err, obj);
    });
};

Mapping.prototype.all = function (callback) {
    var q = new Query(this, {});
    q.execute(callback);
};

Mapping.prototype.install = function (callback) {
    var errors = this._validate();
    if (!errors.length) {
        index.installIndexes(this.collection, this.type, this._fields, callback);
    }
    else {
        if (callback) callback(errors);
    }
};

Mapping.prototype._validate = function () {
    var errors = [];
    if (!this.type) {
        errors.push('Must specify a type');
    }
    if (!this.collection) {
        errors.push('A mapping must belong to an collection');
    }
    return errors;
};


/**
 * Map data into Fount.
 *
 * @param data Raw data received remotely or otherwise
 * @param callback Called once pouch persistence returns.
 * @param obj Force mapping to this object
 */
Mapping.prototype.map = function (data, callback, obj) {
    if (Object.prototype.toString.call(data) == '[object Array]') {
        return this._mapBulk(data, callback);
    }
    else {
        var op = new MappingOperation(this, data, function () {
            var err = op.error;
            if (err) {
                if (callback) callback(err);
            }
            else if (callback) {
                callback(null, op._obj, op.operations);
            }
        });
        op._obj = obj;
        op.start();
        return op;
    }
};


Mapping.prototype._mapBulk = function (data, callback) {
    if (Logger.trace.isEnabled)
        Logger.trace('_mapBulk: ' + JSON.stringify(data, null, 4));
    var self = this;
    var operations = _.map(data, function (datum) {
        return new MappingOperation(self, datum);
    });
    var op = new Operation('Bulk Mapping', operations, function (err) {
        if (err) {
            callback(err);
        }
        else {
            var objects = _.pluck(operations, '_obj');
            var res = _.map(operations, function (op) {
                return {
                    err: op.error,
                    obj: op._obj,
                    raw: op.data,
                    op: op
                }
            });
            callback(null, objects, res);
        }

    });
    op.start();
    return op;
};

/**
 * Convert raw data into a RestObject
 * @returns {RestObject}
 * @private
 */
Mapping.prototype._new = function (data) {
    var self = this;
    var _id;
    if (data) {
        _id = data._id ? data._id : guid();
    }
    else {
        _id = guid();
    }
    var restObject = new RestObject(this);
    if (Logger.info.isEnabled)
        Logger.info('New object created _id="' + _id.toString() + '"', data);
    restObject._id = _id;
    // Place attributes on the object.
    restObject.__values = data || {};
    var fields = this._fields;
    var idx = fields.indexOf(this.id);
    if (idx > -1) {
        fields.splice(idx, 1);
    }
    restObject.__dirtyFields = [];
    _.each(fields, function (field) {
        Object.defineProperty(restObject, field, {
            get: function () {
                return restObject.__values[field] || null;
            },
            set: function (v) {
                var old = restObject.__values[field];
                restObject.__values[field] = v;
                broadcast(restObject, {
                    type: ChangeType.Set,
                    old: old,
                    new: v,
                    field: field
                });
                if (Object.prototype.toString.call(v) === '[object Array]') {
                    wrapArray(v, field, restObject);
                }

                if (v != old) {
                    var logger = log.loggerWithName('RestObject');
                    if (logger.trace.isEnabled)
                        logger.trace('Marking "' + field + '" as dirty for _id="' + restObject._id + '" as just changed to ' + v);
                    restObject._markFieldAsDirty(field);
                }

            },
            enumerable: true,
            configurable: true
        });
    });

    Object.defineProperty(restObject, this.id, {
        get: function () {
            return restObject.__values[self.id] || null;
        },
        set: function (v) {
            var old = restObject.__values[self.id];
            restObject.__values[self.id] = v;
            broadcast(restObject, {
                type: ChangeType.Set,
                old: old,
                new: v,
                field: self.id
            });
            cache.remoteInsert(restObject, v, old);
        },
        enumerable: true,
        configurable: true
    });

    // Place relationships on the object.

    for (var name in this.relationships) {
        var proxy;
        if (this.relationships.hasOwnProperty(name)) {
            var relationship = this.relationships[name];
            if (relationship.type == RelationshipType.ForeignKey) {
                proxy = new ForeignKeyProxy(relationship);
            }
            else if (relationship.type == RelationshipType.OneToOne) {
                proxy = new OneToOneProxy(relationship);
            }
            else {
                throw new RestError('No such relationship type: ' + relationship.type);
            }
        }
        proxy.install(restObject);
    }
    return restObject;
};

Mapping.prototype.save = function (callback) {
    var dirtyObjects = this.__dirtyObjects;
    if (dirtyObjects.length) {
        var saveOperations = _.map(dirtyObjects, function (obj) {
            return new SaveOperation(obj);
        });
        var op = new Operation('Save at mapping level', saveOperations, function () {
            if (callback) callback(op.error ? op.error : null);
        });
        op.start();
        return op;
    }
    else {
        if (callback) callback();
    }
};

Mapping.prototype._dump = function (asJSON) {
    var dumped = {};
    dumped.name = this.type;
    dumped.attributes = this.attributes;
    dumped.id = this.id;
    dumped.collection = this.collection;
    dumped.relationships = _.map(this.relationships, function (r) {
        if (r.isForward(this)) {
            return r.name;
        }
        else {
            return r.reverseName;
        }
    });
    return asJSON ? JSON.stringify(dumped, null, 4) : dumped;
};

Mapping.prototype.toString = function () {
    return 'Mapping[' + this.type + ']';
};


/**
 * A subclass of RestError specifcally for errors that occur during mapping.
 * @param message
 * @param context
 * @param ssf
 * @returns {MappingError}
 * @constructor
 */
function MappingError(message, context, ssf) {
    if (!this) {
        return new MappingError(message, context);
    }

    this.message = message;

    this.context = context;
    // capture stack trace
    ssf = ssf || arguments.callee;
    if (ssf && RestError.captureStackTrace) {
        RestError.captureStackTrace(this, ssf);
    }
}

MappingError.prototype = Object.create(RestError.prototype);
MappingError.prototype.name = 'MappingError';
MappingError.prototype.constructor = MappingError;

function arrayAsString(arr) {
    var arrContents = _.reduce(arr, function (memo, f) {return memo + '"' + f + '",'}, '');
    arrContents = arrContents.substring(0, arrContents.length - 1);
    return '[' + arrContents + ']';
}


function constructMapFunction(collection, type, fields) {
    var mapFunc;
    var onlyEmptyFieldSetSpecified = (fields.length == 1 && !fields[0].length);
    var noFieldSetsSpecified = !fields.length || onlyEmptyFieldSetSpecified;

    var arr = arrayAsString(fields);
    if (noFieldSetsSpecified) {
        mapFunc = function (doc) {
            var type = "$2";
            var collection = "$3";
            if (doc.type == type && doc.collection == collection) {
                emit(doc.type, doc);
            }
        }.toString();
    }
    else {
        mapFunc = function (doc) {
            var type = "$2";
            var collection = "$3";
            if (doc.type == type && doc.collection == collection) {
                //noinspection JSUnresolvedVariable
                var fields = $1;
                var aggField = '';
                for (var idx in fields) {
                    //noinspection JSUnfilteredForInLoop
                    var field = fields[idx];
                    var value = doc[field];
                    if (value !== null && value !== undefined) {
                        aggField += value.toString() + '_';
                    }
                    else if (value === null) {
                        aggField += 'null_';
                    }
                    else {
                        aggField += 'undefined_';
                    }
                }
                aggField = aggField.substring(0, aggField.length - 1);
                emit(aggField, doc);
            }
        }.toString();
        mapFunc = mapFunc.replace('$1', arr);
    }
    mapFunc = mapFunc.replace('$2', type);
    mapFunc = mapFunc.replace('$3', collection);
    return mapFunc;
}


function constructMapFunction2(collection, type, fields) {
    var mapFunc;
    var onlyEmptyFieldSetSpecified = (fields.length == 1 && !fields[0].length);
    var noFieldSetsSpecified = !fields.length || onlyEmptyFieldSetSpecified;

    if (noFieldSetsSpecified) {
        mapFunc = function (doc) {
            if (doc.type == type && doc.collection == collection) {
                emit(doc.type, doc);
            }
        };
    }
    else {
        mapFunc = function (doc) {
            if (doc.type == type && doc.collection == collection) {
                var aggField = '';
                for (var idx in fields) {
                    //noinspection JSUnfilteredForInLoop
                    var field = fields[idx];
                    var value = doc[field];
                    if (value !== null && value !== undefined) {
                        aggField += value.toString() + '_';
                    }
                    else if (value === null) {
                        aggField += 'null_';
                    }
                    else {
                        aggField += 'undefined_';
                    }
                }
                aggField = aggField.substring(0, aggField.length - 1);
                emit(aggField, doc);
            }
        };
    }
    return mapFunc;
}

exports.Mapping = Mapping;
exports.MappingError = MappingError;
exports.constructMapFunction2 = constructMapFunction2;
exports.constructMapFunction = constructMapFunction;