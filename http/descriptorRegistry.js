var _internal = siesta._internal,
    util = _internal.util,
    _ = util._,
    InternalSiestaError = _internal.error.InternalSiestaError,
    log = _internal.log;

var Logger = log.loggerWithName('Descriptor');

/**
 * @class Entry point for descriptor registration.
 * @constructor
 */
function DescriptorRegistry() {
    if (!this) {
        return new DescriptorRegistry(opts);
    }
    this.requestDescriptors = {};
    this.responseDescriptors = {};
}

function _registerDescriptor(descriptors, descriptor) {
    var model = descriptor._opts.model,
        collection = descriptor._opts.collection,
        collectionName;
    if (collection) {
        if (util.isString(collection)) collectionName = collection;
        else collectionName = collection.name;
    }
    else if (model) {
        if (util.isString(model)) throw new InternalSiestaError('Not enough information to register the descriptor');
        else collectionName = model.collection.name;
    }
    if (!descriptors[collectionName]) {
        descriptors[collectionName] = [];
    }
    descriptors[collectionName].push(descriptor);
}

function _descriptorsForCollection(descriptors, collection) {
    var descriptorsForCollection;
    if (typeof(collection) == 'string') {
        descriptorsForCollection = descriptors[collection] || [];
    }
    else {
        descriptorsForCollection = (descriptors[collection.name] || []);
    }
    if (Logger.trace.isEnabled) {
        Logger.trace('_descriptorsForCollection', {
            collection: collection,
            allDescriptors: descriptors,
            descriptors: descriptorsForCollection
        })
    }
    return descriptorsForCollection;
}


_.extend(DescriptorRegistry.prototype, {
    registerRequestDescriptor: function (requestDescriptor) {
        _registerDescriptor(this.requestDescriptors, requestDescriptor);
    },
    registerResponseDescriptor: function (responseDescriptor) {
        if (Logger.trace.isEnabled)
            Logger.trace('registerResponseDescriptor');
        _registerDescriptor(this.responseDescriptors, responseDescriptor);
    },
    requestDescriptorsForCollection: function (collection) {
        return _descriptorsForCollection(this.requestDescriptors, collection);
    },
    responseDescriptorsForCollection: function (collection) {
        var descriptorsForCollection = _descriptorsForCollection(this.responseDescriptors, collection);
        if (!descriptorsForCollection.length) {
            if (Logger.debug.isEnabled)
                Logger.debug('No response descriptors for collection ', {collection: collection});
        }
        return descriptorsForCollection;
    },
    reset: function () {
        this.requestDescriptors = {};
        this.responseDescriptors = {};
    }
});

exports.DescriptorRegistry = new DescriptorRegistry();