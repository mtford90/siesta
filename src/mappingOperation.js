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

function flattenArray (arr) {
    return _.reduce(arr, function(memo, e) {
        if (util.isArray(e)) {
            memo = memo.concat(e);
        }
        else {
            memo.push(e);
        }
        return memo;
    }, []);
}

function unflattenArray (arr, modelArr) {
    var n = 0;
    var unflattened = [];
    for (var i=0;i<modelArr.length;i++) {
        if (util.isArray(modelArr[i])) {
            var newArr = [];
            unflattened[i] = newArr;
            for (var j=0;j<modelArr[i].length;j++) {
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
    defineSubProperty.call(this, 'result', this._opts, 'objects');

    this.errors = [];
    this.name = 'Mapping Operation';
    this.work = this._start;
}


BulkMappingOperation.prototype._start = function (done) {
    done();
};

BulkMappingOperation.prototype = Object.create(Operation.prototype);

exports.BulkMappingOperation = BulkMappingOperation;
exports.flattenArray = flattenArray;
exports.unflattenArray = unflattenArray;