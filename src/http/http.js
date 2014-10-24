(function () {
    if (!siesta) {
        throw new Error('Could not find siesta');
    }

    var Collection = siesta.Collection
        , log = siesta._internal.log
        , util = siesta._internal.util
        , q = siesta._internal.q
        ;

    var DescriptorRegistry = require('./descriptorRegistry').DescriptorRegistry;

    var Logger = log.loggerWithName('HTTP');
    Logger.setLevel(log.Level.warn);

    if (!siesta.ext) {
        siesta.ext = {};
    }

    siesta.ext.http = {
        RequestDescriptor: require('./requestDescriptor').RequestDescriptor,
        ResponseDescriptor: require('./responseDescriptor').ResponseDescriptor,
        Descriptor: require('./descriptor').Descriptor,
        Serialiser: require('./serialiser'),
        DescriptorRegistry: require('./descriptorRegistry').DescriptorRegistry
    };

    Collection.prototype._httpResponse = function (method, path) {
        var self = this;
        var args = Array.prototype.slice.call(arguments, 2);
        var callback;
        var opts = {};
        var name = this._name;
        if (typeof(args[0]) == 'function') {
            callback = args[0];
        }
        else if (typeof (args[0]) == 'object') {
            opts = args[0];
            callback = args[1];
        }
        var deferred = q.defer();
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
        opts.type = method;
        if (!opts.url) { // Allow overrides.
            var baseURL = this.baseURL;
            opts.url = baseURL + path;
        }
        opts.success = function (data, textStatus, jqXHR) {
            if (Logger.trace.isEnabled)
                Logger.trace(opts.type + ' ' + jqXHR.status + ' ' + opts.url + ': ' + JSON.stringify(data, null, 4));
            var resp = {data: data, textStatus: textStatus, jqXHR: jqXHR};
            var descriptors = DescriptorRegistry.responseDescriptorsForCollection(self);
            var matchedDescriptor;
            var extractedData;

            for (var i = 0; i < descriptors.length; i++) {
                var descriptor = descriptors[i];
                extractedData = descriptor.match(opts, data);
                if (extractedData) {
                    matchedDescriptor = descriptor;
                    break;
                }
            }
            if (matchedDescriptor) {
                if (Logger.trace.isEnabled)
                    Logger.trace('Mapping extracted data: ' + JSON.stringify(extractedData, null, 4));
                if (typeof(extractedData) == 'object') {
                    var mapping = matchedDescriptor.mapping;
                    mapping.map(extractedData, function (err, obj) {
                        if (callback) {
                            callback(err, obj, resp);
                        }
                    }, opts.obj);
                }
                else { // Matched, but no data.
                    callback(null, true, resp);
                }
            }
            else if (callback) {
                if (name) {
                    callback(null, null, resp);
                }
                else {
                    // There was a bug where collection name doesn't exist. If this occurs, then will never get hold of any descriptors.
                    throw new InternalSiestaError('Unnamed collection');
                }

            }
        };
        opts.error = function (jqXHR, textStatus, errorThrown) {
            var resp = {jqXHR: jqXHR, textStatus: textStatus, errorThrown: errorThrown};
            if (callback) callback(resp, null, resp);
        };
        $.ajax(opts);
    };
    Collection.prototype._httpRequest = function (method, path, object) {
        var self = this;
        var args = Array.prototype.slice.call(arguments, 2);
        var callback;
        var opts = {};
        if (typeof(args[0]) == 'function') {
            callback = args[0];
        }
        else if (typeof (args[0]) == 'object') {
            opts = args[0];
            callback = args[1];
        }
        var deferred = q.defer();
        callback = util.constructCallbackAndPromiseHandler(callback, deferred);
        args = Array.prototype.slice.call(args, 2);
        var requestDescriptors = DescriptorRegistry.requestDescriptorsForCollection(this);
        var matchedDescriptor;
        opts.type = method;
        var baseURL = this.baseURL;
        opts.url = baseURL + path;
        for (var i = 0; i < requestDescriptors.length; i++) {
            var requestDescriptor = requestDescriptors[i];
            if (requestDescriptor._matchConfig(opts)) {
                matchedDescriptor = requestDescriptor;
                break;
            }
        }
        if (matchedDescriptor) {
            if (Logger.trace.isEnabled)
                Logger.trace('Matched descriptor: ' + matchedDescriptor._dump(true));
            matchedDescriptor._serialise(object, function (err, data) {
                if (Logger.trace.isEnabled)
                    Logger.trace('_serialise', {err: err, data: data});
                if (err) {
                    if (callback) callback(err, null, null);
                }
                else {
                    opts.data = data;
                    opts.obj = object;
                    _.partial(self._httpResponse, method, path, opts, callback).apply(self, args);
                }
            });
        }
        else if (callback) {
            if (Logger.trace.isEnabled)
                Logger.trace('Did not match descriptor');
            callback(null, null, null);
        }
        return deferred.promise;
    };

})();