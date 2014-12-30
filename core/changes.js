/**
 * The changes module deals with changes to SiestaModel instances. In the in-memory case this
 * just means that notifications are sent on any change. If the storage module is being used,
 * the changes module is extended to deal with merging changes into whatever persistant storage
 * method is being used.
 * @module changes
 */

var defineSubProperty = require('./util').defineSubProperty
    , notificationCentre = require('./notificationCentre').notificationCentre
    , InternalSiestaError = require('./error').InternalSiestaError
    , log = require('./operation/log')
    , collectionRegistry = require('./collectionRegistry').CollectionRegistry;

var Logger = log.loggerWithName('changes');
Logger.setLevel(log.Level.warn);

/**
 * Constants that describe change events.
 * Set => A new value is assigned to an attribute/relationship
 * Splice => All javascript array operations are described as splices.
 * Delete => Used in the case where objects are removed from an array, but array order is not known in advance.
 * Remove => Object deletion events
 * New => Object creation events
 * @type {Object}
 */
var ChangeType = {
    Set: 'Set',
    Splice: 'Splice',
    Delete: 'Delete',
    New: 'New',
    Remove: 'Remove'
};

var ChangeOptFields = [
    'collection', 'model', '_id', 'field', 'type', 'index',
    'added', 'addedId', 'removed', 'removedId', 'new', 'newId', 'old',
    'oldId', 'obj'
];


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
    _.each(ChangeOptFields, function (f) {
        this[f] = this._opts[f];
    }.bind(this));
}

Change.prototype._dump = function (json) {
    var dumped = {};
    dumped.collection = (typeof this.collection) == 'string' ? this.collection : this.collection._dump();
    dumped.model = (typeof this.model) == 'string' ? this.model : this.model.type;
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

/**
 * Broadcas
 * @param  {String} collectionName
 * @param  {String} modelName
 * @param  {Object} c an options dictionary representing the change
 * @return {[type]}
 */
function broadcast(collectionName, modelName, c) {
    if (Logger.trace.isEnabled) Logger.trace('Sending notification "' + collectionName + '" of type ' + c.type);
    notificationCentre.emit(collectionName, c);
    var modelNotif = collectionName + ':' + modelName;
    if (Logger.trace.isEnabled) Logger.trace('Sending notification "' + modelNotif + '" of type ' + c.type);
    notificationCentre.emit(modelNotif, c);
    var genericNotif = 'Siesta';
    if (Logger.trace.isEnabled) Logger.trace('Sending notification "' + genericNotif + '" of type ' + c.type);
    notificationCentre.emit(genericNotif, c);
    var localIdNotif = c._id;
    if (Logger.trace.isEnabled) Logger.trace('Sending notification "' + localIdNotif + '" of type ' + c.type);
    notificationCentre.emit(localIdNotif, c);
    var collection = collectionRegistry[collectionName];
    var err;
    if (!collection) {
        err = 'No such collection "' + collectionName + '"';
        Logger.error(err, collectionRegistry);
        throw new InternalSiestaError(err);
    }
    var model = collection[modelName];
    if (!model) {
        err = 'No such model "' + modelName + '"';
        Logger.error(err, collectionRegistry);
        throw new InternalSiestaError(err);
    }
    if (model.id && c.obj[model.id]) {
        var remoteIdNotif = collectionName + ':' + modelName + ':' + c.obj[model.id];
        if (Logger.trace.isEnabled) Logger.trace('Sending notification "' + remoteIdNotif + '" of type ' + c.type);
        notificationCentre.emit(remoteIdNotif, c);
    }
}

/**
 * Throw an error if the change is incorrect.
 * @param changeOpts
 * @throws {InternalSiestaError} If change options are invalid
 */
function validateChange(changeOpts) {
    if (!changeOpts.model) throw new InternalSiestaError('Must pass a model');
    if (!changeOpts.collection) throw new InternalSiestaError('Must pass a collection');
    if (!changeOpts._id) throw new InternalSiestaError('Must pass a local identifier');
    if (!changeOpts.obj) throw new InternalSiestaError('Must pass the object');
}

/**
 * Register that a change has been made.
 * @param opts
 * @return {Change} The constructed change
 */
function registerChange(opts) {
    validateChange(opts);
    var collection = opts.collection;
    var model = opts.model;
    var c = new Change(opts);
    broadcast(collection, model, c);
    return c;
}

exports.Change = Change;
exports.registerChange = registerChange;
exports.validateChange = validateChange;
exports.ChangeType = ChangeType;