var observe = require('../vendor/observe-js/src/observe').Platform,
  Promise = require('lie'),
  argsarray = require('argsarray'),
  InternalSiestaError = require('./error').InternalSiestaError;

// Used by paramNames function.
var FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m,
  FN_ARG_SPLIT = /,/,
  FN_ARG = /^\s*(_?)(.+?)\1\s*$/,
  STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;

/**
 * Compact a sparse array
 * @param arr
 * @returns {Array}
 */
function compact(arr) {
  arr = arr || [];
  return arr.filter(function(x) {return x});
}

/**
 * Execute tasks in parallel
 * @param tasks
 * @param cb
 */
function parallel(tasks, cb) {
  cb = cb || function() {};
  if (tasks && tasks.length) {
    var results = [], errors = [], numFinished = 0;
    tasks.forEach(function(fn, idx) {
      results[idx] = false;
      fn(function(err, res) {
        numFinished++;
        if (err) errors[idx] = err;
        results[idx] = res;
        if (numFinished == tasks.length) {
          cb(
            errors.length ? compact(errors) : null,
            compact(results),
            {results: results, errors: errors}
          );
        }
      });
    });
  } else cb();
}

/**
 * Execute tasks one after another
 * @param tasks
 * @param cb
 */
function series(tasks, cb) {
  cb = cb || function() {};
  if (tasks && tasks.length) {
    var results = [], errors = [], idx = 0;

    function executeTask(task) {
      task(function(err, res) {
        if (err) errors[idx] = err;
        results[idx] = res;
        if (!tasks.length) {
          cb(
            errors.length ? compact(errors) : null,
            compact(results),
            {results: results, errors: errors}
          );
        }
        else {
          idx++;
          nextTask();
        }
      });
    }

    function nextTask() {
      var nextTask = tasks.shift();
      executeTask(nextTask);
    }

    nextTask();

  } else cb();
}

function cb(callback, deferred) {
  return function(err) {
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

var extend = function(left, right) {
  for (var prop in right) {
    if (right.hasOwnProperty(prop)) {
      left[prop] = right[prop];
    }
  }
  return left;
};

var isArrayShim = function(obj) {
    if (obj)return obj.toString() === '[object Array]';
    return false;
  },
  isArray = Array.isArray || isArrayShim,
  isString = function(o) {
    return typeof o == 'string' || o instanceof String
  };

extend(module.exports, {
  argsarray: argsarray,
  /**
   * Performs dirty check/Object.observe callbacks depending on the browser.
   *
   * If Object.observe is present,
   * @param callback
   */
  next: function(callback) {
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
  extend: extend,
  guid: (function() {
    function s4() {
      return Math.floor((1 + Math.random()) * 0x10000)
        .toString(16)
        .substring(1);
    }

    return function() {
      return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
        s4() + '-' + s4() + s4() + s4();
    };
  })(),
  assert: function(condition, message, context) {
    if (!condition) {
      message = message || "Assertion failed";
      context = context || {};
      throw new InternalSiestaError(message, context);
    }
  },
  pluck: function(coll, key) {
    return coll.map(function(o) {return o[key]});
  },
  thenBy: (function() {
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
      return extend(function(a, b) {
        return x(a, b) || y(a, b);
      });
    }

    return extend;
  })(),
  /**
   * TODO: This is bloody ugly.
   * Pretty damn useful to be able to access the bound object on a function tho.
   * See: http://stackoverflow.com/questions/14307264/what-object-javascript-function-is-bound-to-what-is-its-this
   */
  _patchBind: function() {
    var _bind = Function.prototype.apply.bind(Function.prototype.bind);
    Object.defineProperty(Function.prototype, 'bind', {
      value: function(obj) {
        var boundFunction = _bind(this, arguments);
        Object.defineProperty(boundFunction, '__siesta_bound_object', {
          value: obj,
          writable: true,
          configurable: true,
          enumerable: false
        });
        return boundFunction;
      }
    });
  },
  Promise: Promise,
  promise: function(cb, fn) {
    cb = cb || function() {};
    return new Promise(function(resolve, reject) {
      var _cb = argsarray(function(args) {
        var err = args[0],
          rest = args.slice(1);
        if (err) {
          try {
            reject(err);
          }
          catch (e) {
            console.error('Uncaught error during promise rejection', e);
          }
        }
        else {
          try {
            resolve(rest[0]);
          }
          catch (e) {
            try {
              reject(e);
            }
            catch (e) {
              console.error('Uncaught error during promise rejection', e);
            }
          }
        }
        var bound = cb['__siesta_bound_object'] || cb; // Preserve bound object.
        cb.apply(bound, args);
      });
      fn(_cb);
    })
  },
  subProperties: function(obj, subObj, properties) {
    if (!isArray(properties)) {
      properties = Array.prototype.slice.call(arguments, 2);
    }
    for (var i = 0; i < properties.length; i++) {
      (function(property) {
        var opts = {
          set: false,
          name: property,
          property: property
        };
        if (!isString(property)) {
          extend(opts, property);
        }
        var desc = {
          get: function() {
            return subObj[opts.property];
          },
          enumerable: true,
          configurable: true
        };
        if (opts.set) {
          desc.set = function(v) {
            subObj[opts.property] = v;
          };
        }
        Object.defineProperty(obj, opts.name, desc);
      })(properties[i]);
    }
  },
  capitaliseFirstLetter: function(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  },
  extendFromOpts: function(obj, opts, defaults, errorOnUnknown) {
    errorOnUnknown = errorOnUnknown == undefined ? true : errorOnUnknown;
    if (errorOnUnknown) {
      var defaultKeys = Object.keys(defaults),
        optsKeys = Object.keys(opts);
      var unknownKeys = optsKeys.filter(function(n) {
        return defaultKeys.indexOf(n) == -1
      });
      if (unknownKeys.length) throw Error('Unknown options: ' + unknownKeys.toString());
    }
    // Apply any functions specified in the defaults.
    Object.keys(defaults).forEach(function(k) {
      var d = defaults[k];
      if (typeof d == 'function') {
        defaults[k] = d(opts[k]);
        delete opts[k];
      }
    });
    extend(defaults, opts);
    extend(obj, defaults);
  },
  isString: isString,
  isArray: isArray,
  prettyPrint: function(o) {
    return JSON.stringify(o, null, 4);
  },
  flattenArray: function(arr) {
    return arr.reduce(function(memo, e) {
      if (isArray(e)) {
        memo = memo.concat(e);
      } else {
        memo.push(e);
      }
      return memo;
    }, []);
  },
  unflattenArray: function(arr, modelArr) {
    var n = 0;
    var unflattened = [];
    for (var i = 0; i < modelArr.length; i++) {
      if (isArray(modelArr[i])) {
        var newArr = [];
        unflattened[i] = newArr;
        for (var j = 0; j < modelArr[i].length; j++) {
          newArr.push(arr[n]);
          n++;
        }
      } else {
        unflattened[i] = arr[n];
        n++;
      }
    }
    return unflattened;
  },
  /**
   * Return the parameter names of a function.
   * Note: adapted from AngularJS dependency injection :)
   * @param fn
   */
  paramNames: function(fn) {
    // TODO: Is there a more robust way of doing this?
    var params = [],
      fnText,
      argDecl;
    fnText = fn.toString().replace(STRIP_COMMENTS, '');
    argDecl = fnText.match(FN_ARGS);

    argDecl[1].split(FN_ARG_SPLIT).forEach(function(arg) {
      arg.replace(FN_ARG, function(all, underscore, name) {
        params.push(name);
      });
    });
    return params;
  },
  compact: compact,
  parallel: parallel,
  series: series
});