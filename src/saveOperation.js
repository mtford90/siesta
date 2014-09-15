var log = require('../vendor/operations.js/src/log');
var Logger = log.loggerWithName('SaveOperation');
Logger.setLevel(log.Level.warn);

var Operation = require('../vendor/operations.js/src/operation').Operation;

var pouch = require('./pouch');
var cache = require('./cache');
var store = require('./store');

var RestError = require('./error').RestError;

var Platform = require('../vendor/observe-js/src/observe').Platform;

var PerformanceMonitor = require('./performance').PerformanceMonitor;


var utils = require('./util');

var _ = utils._;


function getDirtyFields (model) {
    var clonedArray = [];
    var dirtyFields = model.__dirtyFields;
    _.each(dirtyFields, function (f) {
        clonedArray.push(f);
    });
    return clonedArray;
}




function BulkSaveOperation(objects, completion) {
    if (!this) return new BulkSaveOperation(object, completion);
    var self = this;

    var work = function (done) {
        this._completion = done;
        self._start();
    };

    Operation.call(this);
    this.work = work;
    this.name = 'Bulk Save Operation';
    this.completion = completion;
    this.objects = objects;
}

BulkSaveOperation.prototype = Object.create(Operation.prototype);

BulkSaveOperation.prototype._start = function () {
    var self = this;
    var m = new PerformanceMonitor('Bulk Save (' + self.objects.length.toString() + ' objects)');
    m.start();
    var reduction = _.reduce(this.objects, function (memo, o) {
        memo.adapted.push(pouch.from(o));
        memo.dirtyFields.push(getDirtyFields(o));
        return memo;
    }, {adapted: [], dirtyFields: []});
    pouch.getPouch().bulkDocs(reduction.adapted, function (err, responses) {
        if (err && !responses) {
            self._completion(err);
        }
        else {
            var errors = [];
            for (var i=0;i<responses.length;i++) {
                var response = responses[i];
                var object = self.objects[i];
                var dirtyFields = reduction.dirtyFields[i];
                if (response.ok) {
                    object._rev = response.rev;
                    object._unmarkFieldsAsDirty(dirtyFields);
                }
                else {
                    // TODO: Is it safe to ignore document update conflicts?
                    // It may be possible that there's a race condition here and something may not get saved.
                    // In which case it may be necessary to gather up objects involved in 409s and save them again.
                    if (response.status != 409) {
                        errors[i] = response;
                    }
                }
            }
            m.end();
            self._completion(errors.length ? errors : null);
        }

    });
};


exports.BulkSaveOperation = BulkSaveOperation;
