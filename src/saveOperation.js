var log = require('../vendor/operations.js/src/log');
var Logger = log.loggerWithName('SaveOperation');
Logger.setLevel(log.Level.warn);

var BaseOperation = require('./baseOperation').BaseOperation;
var pouch = require('./pouch');
var cache = require('./cache');

/**
 * Persists an object. Ensures that only one save operation per object is running at a time.
 * This avoids conflicts.
 *
 * @param object
 * @param callback
 * @returns {SaveOperation}
 * @constructor
 */
function SaveOperation(object, callback) {
    if (!this) return new SaveOperation(object, callback);
    var self = this;

    var work = function (done) {
        this._completion = done;
        self._start();
    };

    BaseOperation.call(this, 'Save Operation', work, function () {
        self.callback(self.error, self);
    });

    this.callback = callback;
    this.object = object;
}

SaveOperation.prototype = Object.create(BaseOperation.prototype);

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

/**
 * If we're clearing a dirty relationship field, we need to clear the reverse also.
 * @param fields
 * @param callback
 * @private
 */
SaveOperation.prototype._clearDirtyRelationshipFields = function (fields, callback) {
    var self = this;
    var savingRelationships = [];
    var errors = [];
    var results = [];

    function unmarkAsRelated(o, relationship) {
        if (relationship.isForward(self.object)) {
            o._unmarkFieldAsDirty(relationship.reverseName);
        }
        else {
            o._unmarkFieldAsDirty(relationship.name);
        }
    }

    _.each(fields, function (f) {
        var isRelationship = self.object._fields.indexOf(f) < 0;
        if (isRelationship) {
            savingRelationships.push(f);
            var proxy = self.object[f];
            var relationship = proxy.relationship;
            proxy.get(function (err, related) {
                if (!err) {
                    if (Object.prototype.toString.call(related) === '[object Array]') {
                        _.each(related, function (o) {
                            unmarkAsRelated(o, relationship);
                        })
                    }
                    else {
                        unmarkAsRelated(related, relationship);
                    }
                }
                else {
                    errors.push(err);
                }
                results.push({related: related, err: err});
                if (savingRelationships.length == results.length) {
                    if (callback) callback(errors.length ? errors : null, results);
                }
            });

        }
    });
    if (!savingRelationships.length) {
        if (callback) callback();
    }
};

SaveOperation.prototype._clearDirtyFields = function (fields) {
    Logger.trace('_clearDirtyFields', fields);
    this.object._unmarkFieldsAsDirty(fields);
//            this._clearDirtyRelationshipFields(fields, callback);
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