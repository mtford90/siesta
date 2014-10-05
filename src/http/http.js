(function () {
    if (!siesta) {
        throw new Error('Could not find siesta');
    }

    var Collection = siesta.Collection
        , DescriptorRegistry = siesta._internal.DescriptorRegistry
        , log = siesta._internal.log
    ;

    var Logger = log.loggerWithName('HTTP');
    Logger.setLevel(log.Level.warn);

    siesta.httpEnabled = true;

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
                    throw new RestError('Unnamed collection');
                }

            }
        };
        opts.error = function (jqXHR, textStatus, errorThrown) {
            var resp = {jqXHR: jqXHR, textStatus: textStatus, errorThrown: errorThrown};
            if (callback) callback(resp, null, resp);
        };
        $.ajax(opts);
    };

    Collection.prototype.GET = function () {
        _.partial(this._httpResponse, 'GET').apply(this, arguments);
    };

    Collection.prototype.OPTIONS = function () {
        _.partial(this._httpResponse, 'OPTIONS').apply(this, arguments);
    };

    Collection.prototype.TRACE = function () {
        _.partial(this._httpRequest, 'TRACE').apply(this, arguments);
    };

    Collection.prototype.HEAD = function () {
        _.partial(this._httpResponse, 'HEAD').apply(this, arguments);
    };

    Collection.prototype.POST = function () {
        _.partial(this._httpRequest, 'POST').apply(this, arguments);
    };

    Collection.prototype.PUT = function () {
        _.partial(this._httpRequest, 'PUT').apply(this, arguments);
    };

    Collection.prototype.PATCH = function () {
        _.partial(this._httpRequest, 'PATCH').apply(this, arguments);
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
    };

})();