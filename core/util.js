/*
 * This is a collection of utilities taken from libraries such as async.js, underscore.js etc.
 * @module util
 */


function capitaliseFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

exports.capitaliseFirstLetter = capitaliseFirstLetter;

var root = {};
// START async.js //

var isArray = Array.isArray || function (obj) {
        return _toString.call(obj) === '[object Array]';
    };

function doParallel(fn) {
    return function () {
        var args = Array.prototype.slice.call(arguments);
        return fn.apply(null, [each].concat(args));
    };
}

var map = doParallel(_asyncMap);

function _map(arr, iterator) {
    if (arr.map) {
        return arr.map(iterator);
    }
    var results = [];
    each(arr, function (x, i, a) {
        results.push(iterator(x, i, a));
    });
    return results;
}

function _asyncMap(eachfn, arr, iterator, callback) {
    arr = _map(arr, function (x, i) {
        return {
            index: i,
            value: x
        };
    });
    if (!callback) {
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (err) {
                callback(err);
            });
        });
    } else {
        var results = [];
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (err, v) {
                results[x.index] = v;
                callback(err);
            });
        }, function (err) {
            callback(err, results);
        });
    }
}

var mapSeries = doSeries(_asyncMap);

function doSeries(fn) {
    return function () {
        var args = Array.prototype.slice.call(arguments);
        return fn.apply(null, [eachSeries].concat(args));
    };
}


function eachSeries(arr, iterator, callback) {
    callback = callback || function () {};
    if (!arr.length) {
        return callback();
    }
    var completed = 0;
    var iterate = function () {
        iterator(arr[completed], function (err) {
            if (err) {
                callback(err);
                callback = function () {};
            } else {
                completed += 1;
                if (completed >= arr.length) {
                    callback();
                } else {
                    iterate();
                }
            }
        });
    };
    iterate();
}


function _each(arr, iterator) {
    if (arr.forEach) {
        return arr.forEach(iterator);
    }
    for (var i = 0; i < arr.length; i += 1) {
        iterator(arr[i], i, arr);
    }
}

function each(arr, iterator, callback) {
    callback = callback || function () {};
    if (!arr.length) {
        return callback();
    }
    var completed = 0;
    _each(arr, function (x) {
        iterator(x, only_once(done));
    });

    function done(err) {
        if (err) {
            callback(err);
            callback = function () {};
        } else {
            completed += 1;
            if (completed >= arr.length) {
                callback();
            }
        }
    }
}



var _parallel = function (eachfn, tasks, callback) {
    callback = callback || function () {};
    if (isArray(tasks)) {
        eachfn.map(tasks, function (fn, callback) {
            if (fn) {
                fn(function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    callback.call(null, err, args);
                });
            }
        }, callback);
    } else {
        var results = {};
        eachfn.each(keys(tasks), function (k, callback) {
            tasks[k](function (err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (args.length <= 1) {
                    args = args[0];
                }
                results[k] = args;
                callback(err);
            });
        }, function (err) {
            callback(err, results);
        });
    }
};

function series(tasks, callback) {
    callback = callback || function () {};
    if (isArray(tasks)) {
        mapSeries(tasks, function (fn, callback) {
            if (fn) {
                fn(function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    callback.call(null, err, args);
                });
            }
        }, callback);
    } else {
        var results = {};
        eachSeries(_.keys(tasks), function (k, callback) {
            tasks[k](function (err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (args.length <= 1) {
                    args = args[0];
                }
                results[k] = args;
                callback(err);
            });
        }, function (err) {
            callback(err, results);
        });
    }
}

function only_once(fn) {
    var called = false;
    return function () {
        if (called) throw new Error("Callback was already called.");
        called = true;
        fn.apply(root, arguments);
    }
}

function parallel(tasks, callback) {
    _parallel({
        map: map,
        each: each
    }, tasks, callback);
}

exports.series = series;
exports.parallel = parallel;
exports.isArray = isArray;

// END async.js //




var observe = require('../vendor/observe-js/src/observe').Platform;

function next(callback) {
    observe.performMicrotaskCheckpoint();
    setTimeout(callback);
}

/**
 * Performs dirty check/Object.observe callbacks depending on the browser.
 *
 * If Object.observe is present,
 * @param callback
 */
exports.next = next;

/**
 * Returns a handler that acts upon a callback or a promise depending on the result of a different callback.
 * @param callback
 * @param [deferred]
 * @returns {Function}
 */
exports.cb = function (callback, deferred) {
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
};

var InternalSiestaError = require('./error').InternalSiestaError;

function assert(condition, message, context) {
    if (!condition) {
        message = message || "Assertion failed";
        context = context || {};
        throw new InternalSiestaError(message, context);
    }
}

function defineSubProperty(property, subObj, innerProperty) {
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
}

var guid = (function () {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }

    return function () {
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
            s4() + '-' + s4() + s4() + s4();
    };
})();


var thenBy = (function () {
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
})();

_.extend(module.exports, {
    assert: assert,
    defineSubProperty: defineSubProperty,
    guid: guid,
    thenBy: thenBy,
    _: require('./underscore')
});


/**
 * Simplifies dealing with both callbacks & promises as well has handling lack of q library.
 */
module.exports.defer = function (cb) {
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
            finish: function (err ,res) {
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
};
