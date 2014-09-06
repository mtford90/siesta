var Store = require('./store');
var RestObject = require('./object').RestObject;
var log = require('../vendor/operations.js/src/log');
var Operation = require('../vendor/operations.js/src/operation').Operation;

var Logger = log.loggerWithName('MappingOperation');
Logger.setLevel(log.Level.info);


var cache = require('./cache');

/**
 *
 * @param mapping
 * @param data The data we are want to map onto obj.
 * @param completion Called when this mapping operation completes, failed or otherwise.
 * @constructor
 */
function MappingOperation(mapping, data, completion) {
    if (!this) {
        return new MappingOperation(mapping, data, completion);
    }
    var self = this;
    this.mapping = mapping;
    this.data = data;
    this._obj = null;
    this._errors = {};
    this.operations = [];
    this._finished = [];

    var work = function (done) {
        this._done = done;
        var data = self.data;
        var remoteIdentifier;
        var idField;
        if (!self._obj) {
            if (data instanceof RestObject) {
                self._obj = data;
                //noinspection JSPotentiallyInvalidUsageOfThis
                this.checkIfDone();
            }
            else {
                var storeOpts = {};
                idField = self.mapping.id;
                if (typeof(data) == 'object') {
                    remoteIdentifier = data[idField];
                }
                else {
                    // Here we assume that the data given is a remote identifier.
                    Logger.trace('Assuming remote identifier');
                    remoteIdentifier = data;
                    self.data = {};
                    self.data[idField] = data;
                    data = self.data;
                }
                if (remoteIdentifier) {
                    Logger.debug('Can lookup via remote id');
                    storeOpts[idField] = remoteIdentifier;
                    storeOpts.mapping = self.mapping;
                }
                if (data._id) {
                    Logger.debug('Can lookup via _id');
                    storeOpts._id = data._id;
                }
                if (remoteIdentifier || data._id) {
                    Store.get(storeOpts, function (err, obj) {
                        if (!err) {
                            if (!obj) {
                                var newData = {};
                                if (remoteIdentifier && idField) {
                                    newData[idField] = remoteIdentifier;
                                }
                                // Check the cache just in case we've been beaten to it by another mapping operation.
                                // The Store will go out to Pouch if it's not in the cache, giving other operations the
                                // chance to get here first and insert a new object into the store.
                                // TODO: Alternative would be to only allow one Store operation at a time.
                                var restObject = cache.get(storeOpts);
                                if (restObject) {
                                    // The race condition occurred. Use the object created by the other mapping operation
                                    // instead.
                                    self._obj = restObject;
                                    self._startMapping();
                                }
                                else {
                                    restObject = self.mapping._new(newData);
                                    restObject.save(function (err) {
                                        if (err) {
                                            self._errors = err;
                                            self.checkIfDone();
                                        }
                                        else {
                                            self._obj = restObject;
                                            self._startMapping();
                                        }
                                    });
                                }
                            }
                            else {
                                self._obj = obj;
                                self._startMapping();
                            }
                        }
                        else {
                            self._errors = err;
                            self.checkIfDone();
                        }
                    });
                }
                else {
                    var restObject = self.mapping._new();
                    restObject.save(function (err) {
                        if (err) {
                            self._errors = err;
                            self.checkIfDone();
                        }
                        else {
                            self._obj = restObject;
                            self._startMapping();
                        }
                    });

                }

            }
        }
        else {
            self._startMapping();
        }
    };


    Operation.call(this);
    this.name = 'Mapping Operation';
    this.work = work;
    this.completion = completion;

}

MappingOperation.prototype = Object.create(Operation.prototype);

/**
 * Check to see if all sub-ops have finished. Call the completion function if finished.
 */
MappingOperation.prototype.checkIfDone = function () {
    var self = this;
    var isFinished = this.operations.length == this._finished.length;

    if (isFinished) {
        Logger.trace('Mapping operation finishing: ' + this._dump(true));
        if (this._obj) {
            Logger.info('Saving the mapped object: ' + this._obj._dump(true));
            this._obj.save(function (err) {
                if (err) {
                    self._errors.save = err;
                    Logger.trace('Error saving the mapped object: ' + self._obj._dump(true));
                }
                else {
                    Logger.trace('Saved the mapped object: ' + self._obj._dump(true));
                }
                var isError = false;
                for (var prop in self._errors) {
                    if (self._errors.hasOwnProperty(prop)) {
                        isError = true;
                        break;
                    }
                }
                self._done(isError ? self._errors : null, self._obj);
            })
        }
        else {
            var isError = false;
            for (var prop in self._errors) {
                if (self._errors.hasOwnProperty(prop)) {
                    isError = true;
                    break;
                }
            }
            self._done(isError ? self._errors : null, self._obj);
        }
    }
};

MappingOperation.prototype._mapArray = function (prop, arr) {
    Logger.trace('_mapArray', {prop: prop, arr: arr, op: this});
    var self = this;
    var obj = this._obj;
    if (this._isAttribute(prop)) {
        this._mapAttribute(prop, arr);
    }
    else { // Reverse foreign key or many to many. We need to map all elements in the array.
        var proxy = obj[prop + 'Proxy'];
        var isForward = proxy.isForward;
        var reverseMapping;
        if (isForward) {
            reverseMapping = proxy.reverseMapping;
        }
        else {
            reverseMapping = proxy.forwardMapping;
        }
        var mappedArr = [];
        var errors = [];
        var numFinished = 0;
        var arrayOperations = [];
        // Need to use an IEFE as i+item are mutable and the operations are completed async.
        for (var i = 0; i < arr.length; i++) {
            (function (i, item) {
                var subOperation = new MappingOperation(reverseMapping, item, function () {
                    var err = subOperation.error;
                    if (!err) {
                        mappedArr[i] = subOperation._obj;
                    }
                    else {
                        errors.push(err);
                    }
                    numFinished++;
                    if (numFinished == arr.length) {
                        if (!errors.length) {
                            var proxy = obj[prop + 'Proxy'];
                            Logger.debug('Setting relationship ' + prop);
                            proxy.set(mappedArr, function (err) {
                                if (err) {
                                    Logger.debug('Error setting relationship "' + prop + '"', err);
                                    self._errors[prop] = err;
                                }
                                else {
                                    Logger.debug('Successfully set relationship', prop);
                                }
                                self._finished.push(arrayOperations);
                                self.checkIfDone();
                            })
                        }
                        else {
                            self._errors[prop] = errors;
                            self._finished.push(arrayOperations);
                            self.checkIfDone();
                        }
                    }
                });
                arrayOperations[i] = subOperation;
                subOperation.start();
            })(i, arr[i]);
        }
        self.operations.push(arrayOperations);
    }
};

MappingOperation.prototype._mapAttribute = function (prop, val) {
    this._obj[prop] = val;
};

MappingOperation.prototype._mapRelationship = function (prop, val) {
    Logger.info('_mapRelationship' + JSON.stringify({prop: prop, val: val}, null, 4));
    var self = this;
    var obj = this._obj;
    var proxy = obj[prop + 'Proxy'];
    var isForward = proxy.isForward;
    var reverseMapping;
    if (isForward) {
        reverseMapping = proxy.reverseMapping;
    }
    else {
        reverseMapping = proxy.forwardMapping;
    }
    var subOperation = new MappingOperation(reverseMapping, val, function () {
        var err = subOperation.error;
        if (err) {
            self._errors[prop] = err;
            self._finished.push(subOperation);
            self.checkIfDone();
        }
        else {
            var related = subOperation._obj;
            var proxy = self._obj[prop + 'Proxy'];
            proxy.set(related, function (err) {
                if (err) {
                    self._errors[prop] = err;
                }
                else {
                }
                self._finished.push(subOperation);
                self.checkIfDone();
            })
        }
    });
    this.operations.push(subOperation);
    subOperation.start();
};

MappingOperation.prototype._isAttribute = function (prop) {
    return this._obj._fields.indexOf(prop) > -1;
};

MappingOperation.prototype._isRelationship = function (prop) {
    return this._obj._relationshipFields.indexOf(prop) > -1;
};

/**
 * Kick off the mapping.
 * @private
 */
MappingOperation.prototype._startMapping = function () {
    var data = this.data;
    Logger.trace('Mapping operation starting: ' + this._dump(true));
    for (var prop in data) {
        if (data.hasOwnProperty(prop)) {
            Logger.trace('Checking "' + prop + '"');
            var val = data[prop];
            if (Object.prototype.toString.call(val) == '[object Array]') {
                this._mapArray(prop, val);
            }
            else {
                if (this._isAttribute(prop)) {
                    this._mapAttribute(prop, val);
                }
                else if (this._isRelationship(prop)) {
                    this._mapRelationship(prop, val);
                }
                else {
                    Logger.debug('No such property ' + prop.toString());
                }
            }
        }
    }
    // If no relationships etc, no sub-ops will be spawned.
    this.checkIfDone();
};

MappingOperation.prototype._dump = function (asJson) {
    var obj = {};
//            obj.name = this.name;
//            obj.purpose = this.purpose;
//            obj.data = this.data;
//            obj.obj = this._obj ? this._obj._dump() : null;
//            obj.completed = this.completed;
//            obj.errors = this._errors;
//            obj.mapping = this.mapping.type;
//            obj.running = this.running;
//            obj.completedSuboperations = _.reduce(this.operations, function (memo, op) {
//                 if (op.completed) {
//                     memo.push(op);
//                 }
//                return memo;
//            }, []);
//            obj.incompleteSuboperations = _.reduce(this.operations, function (memo, op) {
//                if (!op.completed) {
//                    memo.push(op);
//                }
//                return memo;
//            }, []);
    return asJson ? JSON.stringify(obj, null, 4) : obj;
};

exports.MappingOperation = MappingOperation;