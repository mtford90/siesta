(function () {
    var events = require('./events'),
        InternalSiestaError = require('./error').InternalSiestaError,
        log = require('./log')('ModelEvents'),
        extend = require('./util')._.extend,
        collectionRegistry = require('./collectionRegistry').CollectionRegistry;


    /**
     * Constants that describe change events.
     * Set => A new value is assigned to an attribute/relationship
     * Splice => All javascript array operations are described as splices.
     * Delete => Used in the case where objects are removed from an array, but array order is not known in advance.
     * Remove => Object deletion events
     * New => Object creation events
     * @type {Object}
     */
    var ModelEventType = {
            Set: 'Set',
            Splice: 'Splice',
            New: 'New',
            Remove: 'Remove'
        };

    /**
     * Represents an individual change.
     * @param opts
     * @constructor
     */
    function ModelEvent(opts) {
        this._opts = opts || {};
        Object.keys(opts).forEach(function (k) {
            this[k] = opts[k];
        }.bind(this));
    }

    ModelEvent.prototype._dump = function (pretty) {
        var dumped = {};
        dumped.collection = (typeof this.collection) == 'string' ? this.collection : this.collection._dump();
        dumped.model = (typeof this.model) == 'string' ? this.model : this.model.name;
        dumped._id = this._id;
        dumped.field = this.field;
        dumped.type = this.type;
        if (this.index) dumped.index = this.index;
        if (this.added) dumped.added = _.map(this.added, function (x) {return x._dump()});
        if (this.removed) dumped.removed = _.map(this.removed, function (x) {return x._dump()});
        if (this.old) dumped.old = this.old;
        if (this.new) dumped.new = this.new;
        return pretty ? util.prettyPrint(dumped) : dumped;
    };

    /**
     * Broadcas
     * @param  {String} collectionName
     * @param  {String} modelName
     * @param  {Object} c an options dictionary representing the change
     * @return {[type]}
     */
    function broadcastEvent(collectionName, modelName, c) {
        log('Sending notification "' + collectionName + '" of type ' + c.type);
        events.emit(collectionName, c);
        var modelNotif = collectionName + ':' + modelName;
        log('Sending notification "' + modelNotif + '" of type ' + c.type);
        events.emit(modelNotif, c);
        var genericNotif = 'Siesta';
        log('Sending notification "' + genericNotif + '" of type ' + c.type);
        events.emit(genericNotif, c);
        var localIdNotif = c._id;
        log('Sending notification "' + localIdNotif + '" of type ' + c.type);
        events.emit(localIdNotif, c);
        var collection = collectionRegistry[collectionName];
        var err;
        if (!collection) {
            err = 'No such collection "' + collectionName + '"';
            log(err, collectionRegistry);
            throw new InternalSiestaError(err);
        }
        var model = collection[modelName];
        if (!model) {
            err = 'No such model "' + modelName + '"';
            log(err, collectionRegistry);
            throw new InternalSiestaError(err);
        }
        if (model.id && c.obj[model.id]) {
            var remoteIdNotif = collectionName + ':' + modelName + ':' + c.obj[model.id];
            log('Sending notification "' + remoteIdNotif + '" of type ' + c.type);
            events.emit(remoteIdNotif, c);
        }
    }

    function validateEventOpts(opts) {
        if (!opts.model) throw new InternalSiestaError('Must pass a model');
        if (!opts.collection) throw new InternalSiestaError('Must pass a collection');
        if (!opts._id) throw new InternalSiestaError('Must pass a local identifier');
        if (!opts.obj) throw new InternalSiestaError('Must pass the object');
    }

    function emit(opts) {
        validateEventOpts(opts);
        var collection = opts.collection;
        var model = opts.model;
        var c = new ModelEvent(opts);
        broadcastEvent(collection, model, c);
        return c;
    }

    extend(exports, {
        ModelEvent: ModelEvent,
        emit: emit,
        validateEventOpts: validateEventOpts,
        ModelEventType: ModelEventType
    });
})();