angular.module('restkit.requestDescriptor', ['restkit'])

    .factory('RequestDescriptor', function (defineSubProperty) {
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

            defineSubProperty.call(this, 'path', this._opts);
            defineSubProperty.call(this, 'method', this._opts);
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