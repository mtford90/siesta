var defineSubProperty = require('./misc').defineSubProperty;
var notificationCentre = require('./notificationCentre').notificationCentre;
var RestError = require('./error').RestError;
var log = require('../vendor/operations.js/src/log');

var Logger = log.loggerWithName('changes');
Logger.setLevel(log.Level.warn);

var ChangeType = {
    Set: 'Set',
    Splice: 'Splice',
    Remove: 'Remove'
};

/**
 * Represents an individual change.
 * @param opts
 * @constructor
 */
function Change(opts) {
    this._opts = opts;
    if (!this._opts) {
        this._opts = {};
    }
    defineSubProperty.call(this, 'collection', this._opts);
    defineSubProperty.call(this, 'mapping', this._opts);
    defineSubProperty.call(this, '_id', this._opts);
    defineSubProperty.call(this, 'field', this._opts);
    defineSubProperty.call(this, 'type', this._opts);
    defineSubProperty.call(this, 'index', this._opts);
    defineSubProperty.call(this, 'added', this._opts);
    defineSubProperty.call(this, 'addedId', this._opts);
    defineSubProperty.call(this, 'removed', this._opts);
    defineSubProperty.call(this, 'removedId', this._opts);
    defineSubProperty.call(this, 'new', this._opts);
    defineSubProperty.call(this, 'newId', this._opts);
    defineSubProperty.call(this, 'old', this._opts);
    defineSubProperty.call(this, 'oldId', this._opts);
}

Change.prototype._dump = function (json) {
    var dumped = {};
    dumped.collection = (typeof this.collection) == 'string' ? this.collection : this.collection._dump();
    dumped.mapping = (typeof this.mapping) == 'string' ? this.mapping : this.mapping.type;
    dumped._id = this._id;
    dumped.field = this.field;
    dumped.type = this.type;
    if (this.index) dumped.index = this.index;
    if (this.added) dumped.added = _.map(this.added, function (x) {return x._dump()});
    if (this.removed) dumped.removed = _.map(this.removed, function (x) {return x._dump()});
    if (this.old) dumped.old = this.old;
    if (this.new) dumped.new = this.new;
    return json ? JSON.stringify(dumped, null, 4) : dumped;
};

function broadcast(collection, mapping, c) {
    if (Logger.trace.isEnabled) Logger.trace('Sending notification "' + collection + '"');
    notificationCentre.emit(collection, c);
    var mappingNotif = collection + ':' + mapping;
    if (Logger.trace.isEnabled) Logger.trace('Sending notification "' + mappingNotif + '"');
    notificationCentre.emit(mappingNotif, c);
    var genericNotif = 'Siesta';
    if (Logger.trace.isEnabled) Logger.trace('Sending notification "' + genericNotif + '"');
    notificationCentre.emit(genericNotif, c);
}

/**
 * Throw an error if the change is incorrect.
 * @param changeOpts
 */
function validateChange(changeOpts) {
    if (!changeOpts.mapping) throw new RestError('Must pass a mapping');
    if (!changeOpts.collection) throw new RestError('Must pass a collection');
    if (!changeOpts._id) throw new RestError('Must pass a local identifier');
}


/**
 * Register that a change has been made.
 * @param opts
 */
function registerChange(opts) {
    validateChange(opts);
    var collection = opts.collection;
    var mapping = opts.mapping;
    var c = new Change(opts);
    broadcast(collection, mapping, c);
    return c;
}

exports.Change = Change;
exports.registerChange = registerChange;
exports.validateChange = validateChange;
exports.ChangeType = ChangeType;