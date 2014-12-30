var observe = require('../../vendor/observe-js/src/observe').Platform,
    _ = require('./underscore'),
    InternalSiestaError = require('./../error').InternalSiestaError;

function cb(callback, deferred) {
    return function (err) {
        if (callback) callback.apply(callback, arguments);
        if (deferred) {
            if (err) {
                deferred.reject(err);
            }
            else {
                deferred.resolve.apply(deferred, Array.prototype.slice.call(arguments, 1));
            }
        }
    };
}

_.extend(module.exports, {
    /**
     * Performs dirty check/Object.observe callbacks depending on the browser.
     *
     * If Object.observe is present,
     * @param callback
     */
    next: function (callback) {
        observe.performMicrotaskCheckpoint();
        setTimeout(callback);
    },
    /**
     * Returns a handler that acts upon a callback or a promise depending on the result of a different callback.
     * @param callback
     * @param [deferred]
     * @returns {Function}
     */
    cb: cb,
    guid: (function () {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
        }

        return function () {
            return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
                s4() + '-' + s4() + s4() + s4();
        };
    })(),
    assert: function (condition, message, context) {
        if (!condition) {
            message = message || "Assertion failed";
            context = context || {};
            throw new InternalSiestaError(message, context);
        }
    },
    thenBy: (function () {
        /* mixin for the `thenBy` property */
        function extend(f) {
            f.thenBy = tb;
            return f;
        }

        /* adds a secondary compare function to the target function (`this` context)
         which is applied in case the first one returns 0 (equal)
         returns a new compare function, which has a `thenBy` method as well */
        function tb(y) {
            var x = this;
            return extend(function (a, b) {
                return x(a, b) || y(a, b);
            });
        }

        return extend;
    })(),
    defer: function (cb) {
        var deferred;
        cb = cb || function () {};
        if (window.q) {
            deferred = window.q.defer();
            var reject = deferred.reject,
                resolve = deferred.resolve;
            _.extend(deferred, {
                reject: function (err) {
                    cb(err);
                    reject.call(this, err);
                },
                resolve: function (res) {
                    cb(null, res);
                    resolve.call(this, res);
                },
                finish: function (err, res) {
                    cb(err, res);
                    if (err) reject.call(this, err);
                    else resolve.call(this, res);
                }
            });
        }
        else {
            deferred = {
                promise: undefined,
                reject: function (err) {
                    cb(err);
                },
                resolve: function (res) {
                    cb(null, res)
                },
                finish: function (err, res) {
                    cb(err, res);
                }
            }
        }
        return deferred;
    },
    defineSubProperty: function (property, subObj, innerProperty) {
        return Object.defineProperty(this, property, {
            get: function () {
                if (innerProperty) {
                    return subObj[innerProperty];
                }
                else {
                    return subObj[property];
                }
            },
            set: function (value) {
                if (innerProperty) {
                    subObj[innerProperty] = value;
                }
                else {
                    subObj[property] = value;
                }
            },
            enumerable: true,
            configurable: true
        });
    },
    /**
     * I got sick of writing Object.defineProperty. This function allows to do so in bulk.
     * @param obj
     * @param opts
     */
    defineProperties: function (obj, opts) {
        _.each(Object.keys(opts), function (k) {
            Object.defineProperty(obj, k, opts[k]);
        });
    },
    capitaliseFirstLetter: function (string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    },
    extendFromOpts: function (obj, opts, defaults) {
        var defaultKeys = Object.keys(defaults),
            optsKeys = Object.keys(opts);
        var unknownKeys = optsKeys.filter(function (n) {
            return defaultKeys.indexOf(n) == -1
        });
        if (unknownKeys.length) throw Error('Unknown options: ' + unknownKeys.toString());
        // Apply any functions specified in the defaults.
        _.each(Object.keys(defaults), function (k) {
            var d = defaults[k];
            if (typeof d == 'function') {
                defaults[k] = d(opts[k]);
                delete opts[k];
            }
        });
        _.extend(defaults, opts);
        _.extend(obj, defaults);
    },
    isString: function (o) {
        return typeof o == 'string' || o instanceof String
    }
});