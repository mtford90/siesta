var _i = siesta._internal;
var log = _i.log;
var Logger = log.loggerWithName('DescriptorRegistry');
Logger.setLevel(log.Level.warn);

var assert = _i.misc.assert;


function DescriptorRegistry() {
    if (!this) {
        return new DescriptorRegistry(opts);
    }
    this.requestDescriptors = {};
    this.responseDescriptors = {};
}

function _registerDescriptor(descriptors, descriptor) {
    var mapping = descriptor.mapping;
    var collection = mapping.collection;
    assert(mapping);
    assert(collection);
    assert(typeof(collection) == 'string');
    if (!descriptors[collection]) {
        descriptors[collection] = [];
    }
    descriptors[collection].push(descriptor);
}

DescriptorRegistry.prototype.registerRequestDescriptor = function (requestDescriptor) {
    _registerDescriptor(this.requestDescriptors, requestDescriptor);
};

DescriptorRegistry.prototype.registerResponseDescriptor = function (responseDescriptor) {
    if (Logger.trace.isEnabled)
        Logger.trace('registerResponseDescriptor');
    _registerDescriptor(this.responseDescriptors, responseDescriptor);
};

function _descriptorsForCollection(descriptors, collection) {
    var descriptorsForCollection;
    if (typeof(collection) == 'string') {
        descriptorsForCollection = descriptors[collection] || [];
    }
    else {
        descriptorsForCollection = (descriptors[collection._name] || []);
    }
    return descriptorsForCollection;
}

DescriptorRegistry.prototype.requestDescriptorsForCollection = function (collection) {
    return _descriptorsForCollection(this.requestDescriptors, collection);
};

DescriptorRegistry.prototype.responseDescriptorsForCollection = function (collection) {
    var descriptorsForCollection = _descriptorsForCollection(this.responseDescriptors, collection);
    if (!descriptorsForCollection.length) {
        if (Logger.debug.isEnabled)
            Logger.debug('No response descriptors for collection ', this.responseDescriptors);
    }
    return  descriptorsForCollection;
};

DescriptorRegistry.prototype.reset = function () {
    this.requestDescriptors = {};
    this.responseDescriptors = {};
};

exports.DescriptorRegistry = new DescriptorRegistry();