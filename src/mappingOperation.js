var Store = require('./store');
var SiestaModel = require('./object').SiestaModel;
var log = require('../vendor/operations.js/src/log');
var Operation = require('../vendor/operations.js/src/operation').Operation;
var RestError = require('../src/error').RestError;

var Logger = log.loggerWithName('MappingOperation');
Logger.setLevel(log.Level.warn);

var PerformanceMonitor = require('./performance').PerformanceMonitor;


var async = require('async');

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
        var m = new PerformanceMonitor('Mapping Operation');
        m.start();
        this._done = function (err) {
            m.end();
            done(err);
        };
        var data = self.data;
        var remoteIdentifier;
        var idField;
        if (!self._obj) {
            if (data instanceof SiestaModel) {
                self._obj = data;
                //noinspection JSPotentiallyInvalidUsageOfThis
                this.checkIfDone();
            }
            else {
                var storeOpts = {};
                var shouldGoToStore = false;
                if (self.mapping.singleton) {
                    storeOpts.mapping = self.mapping;
                    shouldGoToStore = true;
                }
                else {
                    idField = self.mapping.id;
                    if (typeof(data) == 'object') {
                        remoteIdentifier = data[idField];
                    }
                    else {
                        // Here we assume that the data given is a remote identifier.
                        if (Logger.trace.isEnabled)
                            Logger.trace('Assuming remote identifier');
                        remoteIdentifier = data;
                        self.data = {};
                        self.data[idField] = data;
                        data = self.data;
                    }
                    if (remoteIdentifier) {
                        if (Logger.debug.isEnabled)
                            Logger.debug('Can lookup via remote id');
                        storeOpts[idField] = remoteIdentifier;
                        storeOpts.mapping = self.mapping;
                    }
                    if (data._id) {
                        if (Logger.debug.isEnabled)
                            Logger.debug('Can lookup via _id');
                        storeOpts._id = data._id;
                    }
                    shouldGoToStore = remoteIdentifier || data._id;
                }

                if (shouldGoToStore) {
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
                                var siestaModel = cache.get(storeOpts);
                                if (siestaModel) {
                                    // The race condition occurred. Use the object created by the other mapping operation
                                    // instead.
                                    self._obj = siestaModel;
                                    self._startMapping();
                                }
                                else {
                                    self._obj = self.mapping._new(newData);
                                    self._startMapping();
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
                    self._obj = self.mapping._new();
                    self._startMapping();
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
        if (Logger.trace.isEnabled)
            Logger.trace('Mapping operation finishing: ' + this._dump(true));
        var isError = false;
        for (var prop in self._errors) {
            if (self._errors.hasOwnProperty(prop)) {
                isError = true;
                break;
            }
        }
        self._done(isError ? self._errors : null, self._obj);
    }
    else {
        if (Logger.info.isEnabled) {
            var numOperationsReamining = this.operations.length - this._finished.length;
            Logger.info(numOperationsReamining.toString() + ' remaining');
        }
    }
};

MappingOperation.prototype._mapArray = function (prop, arr) {
    if (Logger.trace.isEnabled)
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
                            if (Logger.debug.isEnabled)
                                Logger.debug('Setting relationship ' + prop);
                            proxy.set(mappedArr, function (err) {
                                if (err) {
                                    if (Logger.debug.isEnabled)
                                        Logger.debug('Error setting relationship "' + prop + '"', err);
                                    self._errors[prop] = err;
                                }
                                else {
                                    if (Logger.debug.isEnabled)
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
//    Logger.info('_mapRelationship' + JSON.stringify({prop: prop, val: val}, null, 4));
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
    if (Logger.trace.isEnabled)
        Logger.trace('Mapping operation starting: ' + this._dump(true));
    for (var prop in data) {
        if (data.hasOwnProperty(prop)) {
            if (Logger.trace.isEnabled)
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
                    if (Logger.debug.isEnabled)
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
    obj.name = this.name;
    obj.purpose = this.purpose;
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

/**
 * This is a massive optimisation over the above MappingOperation and hence has become rather complicated.
 * It attempts to send as few requests to PouchDB as possible by flattening relationships across multiple
 * objects and then piecing everything back together for mapping at the end.
 *
 * Note that flattening is only one level deep at the moment e.g. [[model1, model2], [model3], model4] ->
 *                                                                [model1, model2, model3, model4].
 *
 * I've never come across an API that goes any deeper than that, but if that's the case this whole piece of code
 * is probably going to need to be rewritten to be more flexible.
 *
 * @param mapping
 * @param data
 * @param completion
 * @constructor
 */
function BulkMappingOperation(mapping, data, completion) {
    var self = this;
    this.mapping = mapping;
    this.data = data;

    this.subopResults = {};

    this.errors = [];

    /**
     * If set, data will be mapped onto the objects in override rather than performing a lookup.
     * @type {Array}
     */
    this.override = null;

    function _map(i, model, data) {
        // If a siesta model was passed as data, there is nothing to map onto it.
        for (var prop in data) {
            if (data.hasOwnProperty(prop)) {
                var isError = !!self.errors[i];
                if (isError) {
                    isError = !!self.errors[i][prop];
                }
                if (!isError) {
                    var val = data[prop];
                    if (model._fields.indexOf(prop) > -1) {
                        model[prop] = val;
                    }
                    else if (model._relationshipFields.indexOf(prop) > -1) {

                        var related = self.subopResults[prop][i];
                        try {
                            model[prop] = related;
                        }
                        catch (err) {
                            if (err instanceof RestError) {
                                if (!self.errors[i]) {
                                    self.errors[i] = {};
                                }
                                self.errors[i][prop] = err;
                            }
                            else {
                                throw err;
                            }
                        }

                    }
                    else {
                        if (Logger.debug.isEnabled)
                            Logger.debug('No such property ' + prop.toString());
                    }
                }
            }
        }

    }

    function work(done) {
        var categories, local, remote, singleton;

        if (!self.override && !self.mapping.singleton) {
            categories = self._categoriseData();
            local = categories.local;
            remote = categories.remote;
        }
        else if (self.override) {
            local = {};
            remote = {};
            _.each(self.override, function (obj) {
                if (obj._id) {
                    local[obj._id] = obj;
                }
                if (obj[mapping.id]) {
                    remote[obj[mapping.id]] = obj;
                }
            });
        }

        async.parallel([
            function (callback) {
                if (!self.override && !self.mapping.singleton) {
                    var localIdentifiers = _.pluck(categories.localLookups, '_id');
                    Store.getMultipleLocal(localIdentifiers, function (err, objects) {
                        if (!err) {
                            for (var i = 0; i < localIdentifiers.length; i++) {
                                var object = objects[i];
                                var localId = localIdentifiers[i];
                                if (object) {
                                    local[localId] = object;
                                }

                            }
                        }
                        callback(err);
                    });
                }
                else {
                    callback();
                }
            },

            function (callback) {
                if (!self.override && !self.mapping.singleton) {
                    var remoteIdentifiers = _.pluck(categories.remoteLookups, mapping.id);
                    Store.getMultipleRemote(remoteIdentifiers, mapping, function (err, objects) {
                        if (!err) {
                            for (var i = 0; i < remoteIdentifiers.length; i++) {
                                var object = objects[i];
                                var remoteId = remoteIdentifiers[i];
                                if (object) {
                                    remote[remoteId] = object;
                                }
                            }
                        }
                        callback(err);
                    });
                }
                else {
                    callback();
                }
            },
            function (callback) {
                if (self.mapping.singleton) {
                    self.mapping.all(function (err, objs) {
                        if (objs.length > 1) {
                            throw new RestError('Something has gone badly wrong. More than one singleton');
                        }
                        else if (objs.length) {
                            singleton = objs[0];
                        }
                        else {
                            singleton = self.mapping._new();
                        }
                        callback();
                    })
                }
                else {
                    callback();
                }
            },
            function (callback) {
                var subOperationMap = self._constructSubOperations();
                var subOperations = [];
                for (var relationshipName in subOperationMap) {
                    if (subOperationMap.hasOwnProperty(relationshipName)) {
                        var op = subOperationMap[relationshipName];
                        subOperations.push(op);
                    }
                }
                if (subOperations.length) {
                    var compositeOperation = new Operation('Sub Operations', subOperations);
                    compositeOperation.onCompletion(function () {
                        _.each(subOperations, function (subop) {
                            var indexes = subop.__indexes;
                            var results = subop.result;
                            if (indexes.length !== results.length) {
                                throw Error('Something went very wrong');
                            }
                            var relationshipName = subop.__relationshipName;
                            self.subopResults[relationshipName] = [];
                            var subopErrors;
                            // Flatten the errors of the suboperation.
                            if (subop.error) {
                                subopErrors = [];
                                for (var i = 0; i < subop.error.length; i++) {
                                    var e = subop.error[i];
                                    if (Object.prototype.toString.call(e) == '[object Array]') {
                                        _.each(e, function (e1) {
                                            subopErrors.push(e1);
                                        })
                                    }
                                    else {
                                        subopErrors.push(e);
                                    }
                                }
                            }
                            for (var i = 0; i < indexes.length; i++) {
                                var idx = indexes[i];
                                if (subopErrors && subopErrors[i]) {
                                    var err = subopErrors[i];
                                    if (!self.errors[idx]) self.errors[idx] = {};
                                    self.errors[idx][relationshipName] = err;
                                }
                                else {
                                    self.subopResults[relationshipName][idx] = results[i];
                                }
                            }
                        });
                        callback();
                    });
                    compositeOperation.start();
                }
                else {
                    callback();
                }
            }
        ], function (errors) {
            if (errors) {
                done(errors);
            }
            else {

                function getObj(idx, datum) {
                    var obj;
                    if (self.override) {
                        obj = self.override[idx];
                    }
                    else if (self.mapping.singleton) {
                        obj = singleton;
                    }
                    else {
                        if (datum._id) {
                            obj = local[datum._id];
                            if (!obj) {
                                if (!self.errors[idx]) self.errors[idx] = {};
                                self.errors[idx]['_id'] = new RestError('No such object with _id="' + datum._id + '"');
                                return;
                            }
                        }
                        else if (datum[mapping.id]) {
                            remoteId = datum[mapping.id];
                            obj = remote[remoteId];
                        }
                    }
                    if (!obj) {
                        obj = mapping._new();
                        if (datum._id) {
                            local[datum._id] = obj;
                        }
                        if (datum[mapping.id]) {
                            remoteId = datum[mapping.id];
                            remote[remoteId] = obj;
                        }
                        if (!datum._id && !datum[mapping.id]) {
                            datum._id = obj._id;
                            local[obj._id] = obj;
                        }
                    }
                    if (obj != datum) { // e.g. is a SiestaModel is passed as a data item.
                        _map(idx, obj, datum);
                    }
                    return obj;
                }

                var objects = [];

                var n = 0;
                for (var i = 0; i < data.length; i++) {
                    var datum = data[i];
                    var remoteId;
                    if (Object.prototype.toString.call(datum) == '[object Array]') {
                        var arr = [];
                        for (var j = 0; j < datum.length; j++) {
                            var subDatum = datum[j];
                            arr.push(getObj(n, subDatum));
                            n += 1;
                        }
                        objects.push(arr);
                    }
                    else {
                        objects.push(getObj(n, datum));
                        n += 1;
                    }
                }
                var isError = self.errors.length;
                done(isError ? _unflattenErrors() : null, objects);
            }
        });
    }

    function _unflattenErrors() {
        var unflattenedErrors = [];
        var n = 0;
        for (var i = 0; i < data.length; i++) {
            var datum = data[i];
            if (Object.prototype.toString.call(datum) == '[object Array]') {
                var arr = [];
                for (var j = 0; j < datum.length; j++) {
                    arr.push(self.errors[n]);
                    n += 1;
                }
                unflattenedErrors[i] = arr;
            }
            else {
                unflattenedErrors[i] = self.errors[n];
                n += 1;
            }

        }
        return unflattenedErrors;
    }

    Operation.call(this);
    this.name = 'Mapping Operation';
    this.work = work;
    this.completion = completion;
}


BulkMappingOperation.prototype = Object.create(Operation.prototype);

BulkMappingOperation.prototype._categoriseData = function () {
    var self = this;
    var localLookups = [];
    var remoteLookups = [];
    var newObjects = [];
    var local = {};
    var remote = {};

    var data = this.data;

    /**
     * Place the datum into a category that defines how we're going to perform a lookup against local storage. This can
     * either be:
     *    (1) Look up by local id (_id).
     *    (2) Look up by remote id (whatever is defined the 'id' field in the mapping.
     *    (3) Neither, we need to create a new object.
     *
     * If (1) fails then (2) will fail, so we don't need to lookup twice.
     *
     * This method also applies transformations and will return the modified datum if this is the case.
     * @param datum
     * @returns {*}
     */
    function categoriseDatum(datum) {
        var modifiedDatum;
        if (typeof datum != 'object') {
            modifiedDatum = {};
            modifiedDatum[self.mapping.id] = datum;
        }
        if (datum instanceof SiestaModel) {
            local[datum._id] = datum;
            if (datum[self.mapping.id]) {
                remote[datum[self.mapping.id]] = datum;
            }
            return;
        }
        datum = modifiedDatum ? modifiedDatum : datum;
        if (datum._id) {
            localLookups.push(datum);
        }
        if (datum[self.mapping.id]) {
            remoteLookups.push(datum);
        }
        if (!datum._id && !datum[self.mapping.id]) {
            newObjects.push(datum);
        }
        return modifiedDatum;
    }

    for (var i = 0; i < data.length; i++) {
        var datum = data[i];
        if (Object.prototype.toString.call(datum) == '[object Array]') {
            for (var j = 0; j < datum.length; j++) {
                var modifiedSubDatum = categoriseDatum(datum[j]);
                if (modifiedSubDatum) {
                    datum[j] = modifiedSubDatum;
                }
            }

        }
        else {
            var modifiedDatum = categoriseDatum(datum);
            if (modifiedDatum) {
                data[i] = modifiedDatum;
            }
        }
    }

    return {
        localLookups: localLookups,
        local: local,
        remoteLookups: remoteLookups,
        remote: remote,
        newObjects: newObjects
    }
};

BulkMappingOperation.prototype._constructSubOperations = function () {
    var operations = {};
    var relationships = this.mapping.relationships;
    for (var name in relationships) {
        if (relationships.hasOwnProperty(name)) {
            var relationship = relationships[name];
            var relatedData = [];
            var indexes = [];
            var idx = 0;
            for (var i = 0; i < this.data.length; i++) {
                var datum = this.data[i];
                if (Object.prototype.toString.call(datum) == '[object Array]') {
                    for (var j = 0; j < datum.length; j++) {
                        var subDatum = datum[j];
                        if (subDatum[name]) {
                            relatedData.push(subDatum[name]);
                            indexes.push(idx);
                            idx++;
                        }
                    }
                }
                else if (datum[name]) {
                    relatedData.push(datum[name]);
                    indexes.push(idx);
                    idx++;
                }
                else {
                    idx++;
                }
            }
            if (relatedData.length) {
                var reverseMapping = relationship.forwardName == name ? relationship.reverseMapping : relationship.forwardMapping;
                var op = new BulkMappingOperation(reverseMapping, relatedData);
                // We use the following properties later when mapping the models that result from the related data.
                op.__relationshipName = name;
                op.__indexes = indexes;
                operations[name] = op;
            }
        }
    }
    return operations;
};

exports.MappingOperation = MappingOperation;
exports.BulkMappingOperation = BulkMappingOperation;