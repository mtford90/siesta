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
        if (Logger.trace.isEnabled)
            Logger.trace('Error during save operation for id="' + this.object._id + '"', err);
    }
    else {
        if (Logger.trace.isEnabled)
            Logger.trace('Finished save operation for id="' + this.object._id + '"');
    }

    this._completion(err);
};

SaveOperation.prototype._initialSave = function () {
    var self = this;
    var m = new PerformanceMonitor('Initial Save');
    m.start();
    var object = this.object;
    if (Logger.info.isEnabled)
        Logger.info('_initialSave: ' + object._dump(true));
    cache.insert(object);
    var adapted = pouch.from(object);
    var dirtyFields = this._getDirtyFields();
    pouch.getPouch().put(adapted, function (err, resp) {
        if (!err) {
            object._rev = resp.rev;
            self._clearDirtyFields(dirtyFields);
            m.end();
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
    if (Logger.trace.isEnabled)
        Logger.trace('_clearDirtyFields', fields);
    this.object._unmarkFieldsAsDirty(fields);
};

SaveOperation.prototype._saveDirtyFields = function () {
    var self = this;
    // If Object.observe does not exist, this performs a fake micro task which will force
    // fields to be marked as dirty.
    Platform.performMicrotaskCheckpoint();
    // Wait for end of microtask to ensure fields are marked as dirty by observer.
    setTimeout(function () {
        if (Logger.debug.isEnabled)
            Logger.debug('_saveDirtyFields');
        var m = new PerformanceMonitor('Save Dirty Fields');
        m.start();
        var dirtyFields = self._getDirtyFields();
        if (dirtyFields.length) {
            if (Logger.debug.isEnabled)
                Logger.debug('_saveDirtyFields, have dirty fields to save for id="' + self.object._id + '"', dirtyFields);
            var changes = {};
            _.each(dirtyFields, function (field) {
                var isAttribute = self.object._fields.indexOf(field) > -1;
                if (isAttribute) {
                    changes[field] = self.object[field];
                }
                else { // Relationship
                    var proxyField = (field + 'Proxy');
                    var proxy = self.object[ proxyField];
                    if (proxy) {
                        changes[field] = proxy._id;
                    }
                    else {
                        throw 'err';
                    }
                }
            });
            if (Logger.debug.isEnabled)
                Logger.debug('_saveDirtyFields, writing changes for _id="' + self.object._id + '"', changes);
            pouch.retryUntilWrittenMultiple(self.object._id, changes, function (err) {
                if (err) {
                    Logger.error('Error saving object.', err);
                    self._finish(err);
                }
                else {
                    if (Logger.trace.isEnabled)
                        Logger.trace('Successfully saved.');
                    self._clearDirtyFields(dirtyFields);
                    m.end();
                    self._finish(err);
                }
            });
        }
        else {
            if (Logger.debug.isEnabled)
                Logger.debug('_saveDirtyFields, no dirty fields to save');
            self._finish();
        }
    });

};

SaveOperation.prototype._start = function () {
    var self = this;
    if (Logger.trace.isEnabled)
        Logger.trace('Starting save operation for id="' + this.object._id + '"');
    if (this.object.mapping.singleton) {
        this.object.mapping.get(function (err, obj) {
            if (err) {
                self._finish(err);
            }
            else if (obj) {
                if (obj == self.object) {
                    self._saveDirtyFields();
                }
                else {
                    self._finish(new RestError('A singleton already exists!'))
                }
            }
            else if (!obj) {
                self._initialSave();
            }
        });
    }
    else {
        var id = self.object._id;
        if (cache.get({_id: id})) {
            self._saveDirtyFields();
        }
        else {
            self._initialSave();
        }
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