angular.module('restkit.requestDescriptor', ['restkit'])

    .factory('RequestDescriptor', function (defineSubProperty, RestAPIRegistry, RestError) {
        // The XRegExp object has these properties that we want to ignore when matching.
        var ignore = ['index', 'input'];


        function RequestDescriptor(opts) {
            if (!this) {
                return new RequestDescriptor(opts);
            }

            this._opts = opts;

            // Convert path string into XRegExp if not already.
            if (this._opts.path) {
                if (!(this._opts.path instanceof XRegExp)) {
                    this._opts.path = XRegExp(this._opts.path);
                }
            }

            // Convert wildcards into methods and ensure is an array.
            if (this._opts.method) {
                if (this._opts.method == '*' || this._opts.method.indexOf('*') > -1) {
                    this._opts.method = this.httpMethods;
                }
                else if (typeof(this._opts.method) == 'string') {
                    this._opts.method = [this._opts.method];
                }
            }

            // Mappings can be passed as the actual mapping object or as a string (with API specified too)
            if (this._opts.mapping) {
                if (typeof(this._opts.mapping) == 'string') {
                    if (this._opts.api) {
                        var api;
                        if (typeof(this._opts.api) == 'string') {
                            api = RestAPIRegistry[this._opts.api];
                        }
                        else {
                            api = this._opts.api;
                        }
                        if (api) {
                            var actualMapping = api[this._opts.mapping];
                            if (actualMapping) {
                                this._opts.mapping = actualMapping;
                            }
                            else {
                                throw new RestError('Mapping ' + this._opts.mapping + ' does not exist', {opts: opts});
                            }
                        }
                        else {
                            throw new RestError('API ' + this._opts.api + ' does not exist', {opts: opts});
                        }
                    }
                    else {
                        throw new RestError('Passed mapping as string, but did not specify the collection it belongs to', {opts: opts});
                    }
                }
            }

            // If key path, convert data key path into an object that we can then use to traverse the HTTP bodies.
            // otherwise leave as string or undefined.
            var data = this._opts.data;
            if (data) {
                if (data.length) {
                    var root;
                    var arr = data.split('.');
                    if (arr.length == 1) {
                        root = arr[0];
                    }
                    else {
                        var obj = {};
                        root = obj;
                        var previousKey = arr[0];
                        for (var i = 1; i < arr.length; i++) {
                            var key = arr[i];
                            if (i == (arr.length - 1)) {
                                obj[previousKey] = key;
                            }
                            else {
                                var newVar = {};
                                obj[previousKey] = newVar;
                                obj = newVar;
                                previousKey = key;
                            }
                        }
                    }
                    this._opts.data = root;
                }
            }

            defineSubProperty.call(this, 'path', this._opts);
            defineSubProperty.call(this, 'method', this._opts);
            defineSubProperty.call(this, 'mapping', this._opts);
            defineSubProperty.call(this, 'data', this._opts);
        }

        RequestDescriptor.prototype.httpMethods = ['POST', 'PATCH', 'PUT', 'HEAD', 'GET', 'DELETE', 'OPTIONS', 'TRACE', 'CONNECT'];


        RequestDescriptor.prototype._matchPath = function (path) {
            var match = XRegExp.exec(path, this.path);
            var matched = null;
            if (match) {
                matched = {};
                for (var prop in match) {
                    if (match.hasOwnProperty(prop)) {
                        if (isNaN(parseInt(prop)) && ignore.indexOf(prop) < 0) {
                            matched[prop] = match[prop];
                        }
                    }
                }
            }
            return matched;
        };

        return RequestDescriptor;
    })

;