var log = require('../vendor/operations.js/src/log');
var Logger = log.loggerWithName('SaveOperation');
Logger.setLevel(log.Level.warn);

var Operation = require('../vendor/operations.js/src/operation').Operation;

var pouch = require('./pouch');
var cache = require('./cache');

/**
 * Persists an object. Ensures that only one save operation per object is running at a time.
 * This avoids conflicts.
 *
 * @param object
 * @param completion
 * @returns {SaveOperation}
 * @constructor
 */
function SaveOperation(object, completion) {
    if (!this) return new SaveOperation(object, completion);
    var self = this;

    var work = function (done) {
        this._completion = done;
        self._start();
    };

    Operation.call(this);
    this.work = work;
    this.name = 'Save Operation';
    this.completion = completion;
    this.object = object;
}

SaveOperation.prototype = Object.create(Operation.prototype);

SaveOperation.prototype._finish = function (err) {
    if (err) {
        Logger.trace('Error during save operation for id="' + this.object._id + '"', err);
    }
    else {
        Logger.trace('Finished save operation for id="' + this.object._id + '"');
    }
    if (this._completion) {
        this._completion(err);
    }
};

SaveOperation.prototype._initialSave = function () {
    Logger.trace('_initialSave');
    var self = this;
    var object = this.object;
    cache.insert(object);
    var adapted = pouch.from(object);
    var dirtyFields = this._getDirtyFields();
    pouch.getPouch().put(adapted, function (err, resp) {
        if (!err) {
            object._rev = resp.rev;
            Logger.debug('put success', object);
            self._clearDirtyFields(dirtyFields);
        }
        self._finish(err);
    });
};

SaveOperation.prototype._getDirtyFields = function () {
    var clonedArray = [];
    var dirtyFields = this.object.__dirtyFields;
    _.each(dirtyFields, function (f) {
        clonedArray.push(f);
    });
    return clonedArray;
};


SaveOperation.prototype._clearDirtyFields = function (fields) {
    Logger.trace('_clearDirtyFields', fields);
    this.object._unmarkFieldsAsDirty(fields);
};

SaveOperation.prototype._saveDirtyFields = function () {
    Logger.trace('_saveDirtyFields');
    var self = this;
    var dirtyFields = this._getDirtyFields();
    if (dirtyFields.length) {
        Logger.trace('_saveDirtyFields, have dirty fields to save', dirtyFields);
        var changes = {};
        _.each(dirtyFields, function (field) {
            var isAttribute = self.object._fields.indexOf(field) > -1;
            if (isAttribute) {
                changes[field] = self.object[field];
            }
            else { // Relationship
                var proxy = self.object[field];
                changes[field] = proxy._id;
            }
        });
        Logger.trace('_saveDirtyFields, changes:', changes);
        pouch.retryUntilWrittenMultiple(self.object._id, changes, function (err) {
            if (err) {
                Logger.error('Error saving object.', err);
                self._finish(err);
            }
            else {
                Logger.trace('Successfully saved.');
                self._clearDirtyFields(dirtyFields);
                self._finish(err);
            }
        });
    }
    else {
        Logger.trace('_saveDirtyFields, no dirty fields to save');
        self._finish();
    }
};

SaveOperation.prototype._start = function () {
    Logger.trace('Starting save operation for id="' + this.object._id + '"');
    var id = this.object._id;
    if (cache.get({_id: id})) {
        this._saveDirtyFields();
    }
    else {
        this._initialSave();
    }
};

SaveOperation.prototype._dump = function (asJson) {
    var obj = {
        name: this.name,
        purpose: this.purpose,
        error: this.error,
        completed: this.completed,
        failed: this.failed,
        running: this.running,
        obj: this.object ? this.object._dump() : null

    };
    return asJson ? JSON.stringify(obj, null, 4) : obj;
};

exports.SaveOperation = SaveOperation;