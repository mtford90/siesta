angular.module('restkit.requestDescriptor', ['restkit'])

    .factory('RequestDescriptor', function (defineSubProperty) {
        // The XRegExp object has these properties that we want to ignore when matching.
        var ignore = ['index', 'input'];

        function RequestDescriptor(opts) {
            this._opts = opts;
            if (this._opts.path) {
                if (!(this._opts.path instanceof XRegExp)) {
                    this._opts.path = XRegExp(this._opts.path);
                }
            }
            defineSubProperty.call(this, 'path', this._opts);
        }

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