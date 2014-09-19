/*
 * Changes describe differences between the in-memory object graph and the object graph sat in the databases.
 *
 * Faulted objects being pulled into memory will have changes applied to them.
 *
 * On siesta.save() all changes will be merged into the database.
 */

var defineSubProperty = require('./misc').defineSubProperty;

var RestError = require('./error').RestError;

var changes = {};

function Change(opts) {
    this._opts = opts;
    defineSubProperty.call(this, 'collection');
    defineSubProperty.call(this, 'mapping');
    defineSubProperty.call(this, '_id');
    defineSubProperty.call(this, 'field');
    defineSubProperty.call(this, 'type');
    defineSubProperty.call(this, 'index');
    defineSubProperty.call(this, 'addedCount');
    defineSubProperty.call(this, 'removed');
    defineSubProperty.call(this, 'new');
    defineSubProperty.call(this, 'old');
}

/**
 * Apply this change to the given object.
 * Will throw an error if this object does not match the change.
 * Removes the change from changes.
 * @param obj
 */
Change.prototype.apply = function (obj) {

};

/**
 * Merge changes into PouchDB
 */
function mergeChanges() {

}

/**
 * Register that a change has been made.
 * @param opts
 */
function registerChange(opts) {
    if (!opts.mapping) throw new RestError('Must pass a mapping');
    if (!opts.collection) throw new RestError('Must pass a collection');
}

exports.Change = Change;
exports.registerChange = registerChange;
exports.mergeChanges = mergeChanges;
exports.changes = changes;

Object.defineProperty(exports, 'allChanges', {
    get: function () {

    },
    enumerable: true,
    configurable: true
});