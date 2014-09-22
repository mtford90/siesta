var Store = require('./store');
var SiestaModel = require('./object').SiestaModel;
var log = require('../vendor/operations.js/src/log');
var Operation = require('../vendor/operations.js/src/operation').Operation;
var RestError = require('../src/error').RestError;

var Logger = log.loggerWithName('MappingOperation');
Logger.setLevel(log.Level.warn);


var cache = require('./cache');
var util = require('./util');
var _ = util._;
var defineSubProperty = require('./misc').defineSubProperty;

function flattenArray(arr) {
    return _.reduce(arr, function (memo, e) {
        if (util.isArray(e)) {
            memo = memo.concat(e);
        }
        else {
            memo.push(e);
        }
        return memo;
    }, []);
}

function unflattenArray(arr, modelArr) {
    var n = 0;
    var unflattened = [];
    for (var i = 0; i < modelArr.length; i++) {
        if (util.isArray(modelArr[i])) {
            var newArr = [];
            unflattened[i] = newArr;
            for (var j = 0; j < modelArr[i].length; j++) {
                newArr.push(arr[n]);
                n++;
            }
        }
        else {
            unflattened[i] = arr[n];
            n++;
        }
    }
    return unflattened;
}

function BulkMappingOperation(opts) {
    Operation.call(this);

    this._opts = opts;

    defineSubProperty.call(this, 'mapping', this._opts);
    defineSubProperty.call(this, 'data', this._opts);
    defineSubProperty.call(this, 'objects', this._opts);
    if (!this.objects) this.objects = [];

    this.errors = [];
    this.name = 'Mapping Operation';
    this.work = _.bind(this._start, this);
}

BulkMappingOperation.prototype = Object.create(Operation.prototype);


/**
 * Performs mapping assuming each datum has an object to be mapped onto.
 * @private
 */
BulkMappingOperation.prototype._map = function () {
    for (var i = 0; i < this.data.length; i++) {
        var datum = this.data[i];
        var object = this.objects[i];
        if (object) { // If object is falsy, then there was an error looking up that object/creating it.
            var fields = this.mapping._fields;
            _.each(fields, function (f) {
                if (datum[f] !== undefined) { // null is fine
                    object[f] = datum[f];
                }
            });
        }
    }
};

/**
 * For indices where no object is present, perform lookups, creating a new object if necessary.
 * @private
 */
BulkMappingOperation.prototype._lookup = function (callback) {
    var self = this;
    var remoteLookups = {};
    var localLookups = {};
    for (var i = 0; i < this.data.length; i++) {
        if (!this.objects[i]) {
            var lookup;
            var datum = this.data[i];
            var isScalar = typeof datum == 'string' || typeof datum == 'number' || datum instanceof String;
            if (isScalar) {
                lookup = {index: i, datum: {}};
                lookup.datum[self.mapping.id] = datum;
                remoteLookups[datum] = lookup;
            }
            else if (datum._id) {
                localLookups[datum._id] = {index: i, datum: datum};
            }
            else if (datum[self.mapping.id]) {
                remoteLookups[datum[self.mapping.id]] = {index: i, datum: datum};
            }
            else {
                this.objects[i] = self.mapping._new();
            }
        }
    }
    util.parallel([
            function (callback) {
                var localIdentifiers = _.keys(localLookups);
                Store.getMultipleLocal(localIdentifiers, function (err, objects) {
                    if (!err) {
                        for (var i = 0; i < objects.length; i++) {
                            var obj = objects[i];
                            var _id = localIdentifiers[i];
                            var lookup = localLookups[_id];
                            if (!obj) {
                                self.errors[lookup.index] = {_id: 'No object with _id="' + _id.toString() + '"'};
                            }
                            else {
                                self.objects[lookup.index] = obj;
                            }
                        }
                    }
                    callback(err);
                });
            },
            function () {
                var remoteIdentifiers = _.keys(remoteLookups);
                Store.getMultipleRemote(remoteIdentifiers, self.mapping, function (err, objects) {
                    if (!err) {
                        for (var i = 0; i < objects.length; i++) {
                            var obj = objects[i];
                            var remoteId = remoteIdentifiers[i];
                            var lookup = remoteLookups[remoteId];
                            if (obj) {
                                self.objects[lookup.index] = obj;
                            }
                            else {
                                self.objects[lookup.index] = self.mapping._new();
                            }
                        }
                    }
                    callback(err);
                });
            }
        ],
        callback);
};

BulkMappingOperation.prototype._start = function (done) {
    var self = this;
    this._lookup(function () {
        self._map();
        done(self.errors, self.objects);
    });
};

BulkMappingOperation.prototype._constructSubOperations = function (done) {

};


exports.BulkMappingOperation = BulkMappingOperation;
exports.flattenArray = flattenArray;
exports.unflattenArray = unflattenArray;