(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var collection = require('./src/collection');
var util = require('./src/util');

var CollectionRegistry = require('./src/collectionRegistry').CollectionRegistry
    , Collection = collection.Collection
    , cache = require('./src/cache')
    , Mapping = require('./src/mapping').Mapping
    , notificationCentre = require('./src/notificationCentre').notificationCentre
    , Operation = require('./vendor/operations.js/src/operation').Operation
    , OperationQueue = require('./vendor/operations.js/src/queue').OperationQueue
    , RelationshipType = require('./src/relationship').RelationshipType
    , log = require('./vendor/operations.js/src/log')
    , q = require('q')
    , _ = util._;


Operation.logLevel = log.Level.warn;
OperationQueue.logLevel = log.Level.warn;


var siesta;
if (typeof module != 'undefined') {
    siesta = module.exports;
}
else {
    siesta = {};
}

siesta.save = function save(callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    if (siesta.ext.storageEnabled) {
        util.next(function () {
            var mergeChanges = siesta.ext.storage.changes.mergeChanges;
            mergeChanges(callback);
        });
    }
    else {
        callback('Storage module not installed');
    }
    return deferred.promise;
};

siesta.reset = function () {
    cache.reset();
    CollectionRegistry.reset();
    siesta.ext.http.DescriptorRegistry.reset();
    //noinspection JSAccessibilityCheck
};


siesta.on = _.bind(notificationCentre.on, notificationCentre);
siesta.addListener = _.bind(notificationCentre.addListener, notificationCentre);
siesta.removeListener = _.bind(notificationCentre.removeListener, notificationCentre);
siesta.once = _.bind(notificationCentre.once, notificationCentre);

siesta.Collection = Collection;
siesta.RelationshipType = RelationshipType;

// Used by modules.
var coreChanges = require('./src/changes');

// Make available modules to extensions.
siesta._internal = {
    log: log,
    Mapping: Mapping,
    mapping: require('./src/mapping'),
    error: require('./src/error'),
    ChangeType: coreChanges.ChangeType,
    object: require('./src/object'),
    extend: require('extend'),
    notificationCentre: require('./src/notificationCentre'),
    cache: require('./src/cache'),
    misc: require('./src/misc'),
    Operation: Operation,
    OperationQueue: OperationQueue,
    coreChanges: coreChanges,
    CollectionRegistry: require('./src/collectionRegistry').CollectionRegistry,
    Collection: collection.Collection,
    collection: collection,
    utils: util,
    util: util,
    _: util._,
    query: require('./src/query'),
    store: require('./src/store'),
    q: require('q')
};

siesta.performanceMonitoringEnabled = false;
siesta.httpEnabled = false;
siesta.storageEnabled = false;

siesta.ext = {};

Object.defineProperty(siesta, 'setPouch', {
    get: function () {
        if (siesta.ext.storageEnabled) {
            return siesta.ext.storage.pouch.setPouch;
        }
        return null;
    }
});

Object.defineProperty(siesta.ext, 'storageEnabled', {
    get: function () {
        if (siesta.ext._storageEnabled !== undefined) {
            return siesta.ext._storageEnabled;
        }
        return !!siesta.ext.storage;
    },
    set: function (v) {
        siesta.ext._storageEnabled = v;
    }
});

Object.defineProperty(siesta.ext, 'httpEnabled', {
    get: function () {
        if (siesta.ext._httpEnabled !== undefined) {
            return siesta.ext._httpEnabled;
        }
        return !!siesta.ext.http;
    },
    set: function (v) {
        siesta.ext._httpEnabled = v;
    }
});

siesta.collection = function (name, opts) {
    return new Collection(name, opts);
};


Object.defineProperty(siesta, 'isDirty', {
    get: function () {
        return Collection.isDirty
    },
    configurable: true,
    enumerable: true
});




if (typeof window != 'undefined') {
    window.siesta = siesta;
}

exports.siesta = siesta;
},{"./src/cache":6,"./src/changes":7,"./src/collection":8,"./src/collectionRegistry":9,"./src/error":10,"./src/mapping":12,"./src/misc":14,"./src/notificationCentre":15,"./src/object":16,"./src/query":20,"./src/relationship":21,"./src/store":22,"./src/util":23,"./vendor/operations.js/src/log":25,"./vendor/operations.js/src/operation":26,"./vendor/operations.js/src/queue":27,"extend":4,"q":5}],2:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],3:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],4:[function(require,module,exports){
var hasOwn = Object.prototype.hasOwnProperty;
var toString = Object.prototype.toString;
var undefined;

var isPlainObject = function isPlainObject(obj) {
	"use strict";
	if (!obj || toString.call(obj) !== '[object Object]' || obj.nodeType || obj.setInterval) {
		return false;
	}

	var has_own_constructor = hasOwn.call(obj, 'constructor');
	var has_is_property_of_method = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
	// Not own constructor property must be Object
	if (obj.constructor && !has_own_constructor && !has_is_property_of_method) {
		return false;
	}

	// Own properties are enumerated firstly, so to speed up,
	// if last one is own, then all properties are own.
	var key;
	for (key in obj) {}

	return key === undefined || hasOwn.call(obj, key);
};

module.exports = function extend() {
	"use strict";
	var options, name, src, copy, copyIsArray, clone,
		target = arguments[0],
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if (typeof target === "boolean") {
		deep = target;
		target = arguments[1] || {};
		// skip the boolean and the target
		i = 2;
	} else if (typeof target !== "object" && typeof target !== "function" || target == undefined) {
			target = {};
	}

	for (; i < length; ++i) {
		// Only deal with non-null/undefined values
		if ((options = arguments[i]) != null) {
			// Extend the base object
			for (name in options) {
				src = target[name];
				copy = options[name];

				// Prevent never-ending loop
				if (target === copy) {
					continue;
				}

				// Recurse if we're merging plain objects or arrays
				if (deep && copy && (isPlainObject(copy) || (copyIsArray = Array.isArray(copy)))) {
					if (copyIsArray) {
						copyIsArray = false;
						clone = src && Array.isArray(src) ? src : [];
					} else {
						clone = src && isPlainObject(src) ? src : {};
					}

					// Never move original objects, clone them
					target[name] = extend(deep, clone, copy);

				// Don't bring in undefined values
				} else if (copy !== undefined) {
					target[name] = copy;
				}
			}
		}
	}

	// Return the modified object
	return target;
};


},{}],5:[function(require,module,exports){
(function (process){
// vim:ts=4:sts=4:sw=4:
/*!
 *
 * Copyright 2009-2012 Kris Kowal under the terms of the MIT
 * license found at http://github.com/kriskowal/q/raw/master/LICENSE
 *
 * With parts by Tyler Close
 * Copyright 2007-2009 Tyler Close under the terms of the MIT X license found
 * at http://www.opensource.org/licenses/mit-license.html
 * Forked at ref_send.js version: 2009-05-11
 *
 * With parts by Mark Miller
 * Copyright (C) 2011 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

(function (definition) {
    // Turn off strict mode for this function so we can assign to global.Q
    /* jshint strict: false */

    // This file will function properly as a <script> tag, or a module
    // using CommonJS and NodeJS or RequireJS module formats.  In
    // Common/Node/RequireJS, the module exports the Q API and when
    // executed as a simple <script>, it creates a Q global instead.

    // Montage Require
    if (typeof bootstrap === "function") {
        bootstrap("promise", definition);

    // CommonJS
    } else if (typeof exports === "object") {
        module.exports = definition();

    // RequireJS
    } else if (typeof define === "function" && define.amd) {
        define(definition);

    // SES (Secure EcmaScript)
    } else if (typeof ses !== "undefined") {
        if (!ses.ok()) {
            return;
        } else {
            ses.makeQ = definition;
        }

    // <script>
    } else {
        Q = definition();
    }

})(function () {
"use strict";

var hasStacks = false;
try {
    throw new Error();
} catch (e) {
    hasStacks = !!e.stack;
}

// All code after this point will be filtered from stack traces reported
// by Q.
var qStartingLine = captureLine();
var qFileName;

// shims

// used for fallback in "allResolved"
var noop = function () {};

// Use the fastest possible means to execute a task in a future turn
// of the event loop.
var nextTick =(function () {
    // linked list of tasks (single, with head node)
    var head = {task: void 0, next: null};
    var tail = head;
    var flushing = false;
    var requestTick = void 0;
    var isNodeJS = false;

    function flush() {
        /* jshint loopfunc: true */

        while (head.next) {
            head = head.next;
            var task = head.task;
            head.task = void 0;
            var domain = head.domain;

            if (domain) {
                head.domain = void 0;
                domain.enter();
            }

            try {
                task();

            } catch (e) {
                if (isNodeJS) {
                    // In node, uncaught exceptions are considered fatal errors.
                    // Re-throw them synchronously to interrupt flushing!

                    // Ensure continuation if the uncaught exception is suppressed
                    // listening "uncaughtException" events (as domains does).
                    // Continue in next event to avoid tick recursion.
                    if (domain) {
                        domain.exit();
                    }
                    setTimeout(flush, 0);
                    if (domain) {
                        domain.enter();
                    }

                    throw e;

                } else {
                    // In browsers, uncaught exceptions are not fatal.
                    // Re-throw them asynchronously to avoid slow-downs.
                    setTimeout(function() {
                       throw e;
                    }, 0);
                }
            }

            if (domain) {
                domain.exit();
            }
        }

        flushing = false;
    }

    nextTick = function (task) {
        tail = tail.next = {
            task: task,
            domain: isNodeJS && process.domain,
            next: null
        };

        if (!flushing) {
            flushing = true;
            requestTick();
        }
    };

    if (typeof process !== "undefined" && process.nextTick) {
        // Node.js before 0.9. Note that some fake-Node environments, like the
        // Mocha test runner, introduce a `process` global without a `nextTick`.
        isNodeJS = true;

        requestTick = function () {
            process.nextTick(flush);
        };

    } else if (typeof setImmediate === "function") {
        // In IE10, Node.js 0.9+, or https://github.com/NobleJS/setImmediate
        if (typeof window !== "undefined") {
            requestTick = setImmediate.bind(window, flush);
        } else {
            requestTick = function () {
                setImmediate(flush);
            };
        }

    } else if (typeof MessageChannel !== "undefined") {
        // modern browsers
        // http://www.nonblocking.io/2011/06/windownexttick.html
        var channel = new MessageChannel();
        // At least Safari Version 6.0.5 (8536.30.1) intermittently cannot create
        // working message ports the first time a page loads.
        channel.port1.onmessage = function () {
            requestTick = requestPortTick;
            channel.port1.onmessage = flush;
            flush();
        };
        var requestPortTick = function () {
            // Opera requires us to provide a message payload, regardless of
            // whether we use it.
            channel.port2.postMessage(0);
        };
        requestTick = function () {
            setTimeout(flush, 0);
            requestPortTick();
        };

    } else {
        // old browsers
        requestTick = function () {
            setTimeout(flush, 0);
        };
    }

    return nextTick;
})();

// Attempt to make generics safe in the face of downstream
// modifications.
// There is no situation where this is necessary.
// If you need a security guarantee, these primordials need to be
// deeply frozen anyway, and if you don’t need a security guarantee,
// this is just plain paranoid.
// However, this **might** have the nice side-effect of reducing the size of
// the minified code by reducing x.call() to merely x()
// See Mark Miller’s explanation of what this does.
// http://wiki.ecmascript.org/doku.php?id=conventions:safe_meta_programming
var call = Function.call;
function uncurryThis(f) {
    return function () {
        return call.apply(f, arguments);
    };
}
// This is equivalent, but slower:
// uncurryThis = Function_bind.bind(Function_bind.call);
// http://jsperf.com/uncurrythis

var array_slice = uncurryThis(Array.prototype.slice);

var array_reduce = uncurryThis(
    Array.prototype.reduce || function (callback, basis) {
        var index = 0,
            length = this.length;
        // concerning the initial value, if one is not provided
        if (arguments.length === 1) {
            // seek to the first value in the array, accounting
            // for the possibility that is is a sparse array
            do {
                if (index in this) {
                    basis = this[index++];
                    break;
                }
                if (++index >= length) {
                    throw new TypeError();
                }
            } while (1);
        }
        // reduce
        for (; index < length; index++) {
            // account for the possibility that the array is sparse
            if (index in this) {
                basis = callback(basis, this[index], index);
            }
        }
        return basis;
    }
);

var array_indexOf = uncurryThis(
    Array.prototype.indexOf || function (value) {
        // not a very good shim, but good enough for our one use of it
        for (var i = 0; i < this.length; i++) {
            if (this[i] === value) {
                return i;
            }
        }
        return -1;
    }
);

var array_map = uncurryThis(
    Array.prototype.map || function (callback, thisp) {
        var self = this;
        var collect = [];
        array_reduce(self, function (undefined, value, index) {
            collect.push(callback.call(thisp, value, index, self));
        }, void 0);
        return collect;
    }
);

var object_create = Object.create || function (prototype) {
    function Type() { }
    Type.prototype = prototype;
    return new Type();
};

var object_hasOwnProperty = uncurryThis(Object.prototype.hasOwnProperty);

var object_keys = Object.keys || function (object) {
    var keys = [];
    for (var key in object) {
        if (object_hasOwnProperty(object, key)) {
            keys.push(key);
        }
    }
    return keys;
};

var object_toString = uncurryThis(Object.prototype.toString);

function isObject(value) {
    return value === Object(value);
}

// generator related shims

// FIXME: Remove this function once ES6 generators are in SpiderMonkey.
function isStopIteration(exception) {
    return (
        object_toString(exception) === "[object StopIteration]" ||
        exception instanceof QReturnValue
    );
}

// FIXME: Remove this helper and Q.return once ES6 generators are in
// SpiderMonkey.
var QReturnValue;
if (typeof ReturnValue !== "undefined") {
    QReturnValue = ReturnValue;
} else {
    QReturnValue = function (value) {
        this.value = value;
    };
}

// long stack traces

var STACK_JUMP_SEPARATOR = "From previous event:";

function makeStackTraceLong(error, promise) {
    // If possible, transform the error stack trace by removing Node and Q
    // cruft, then concatenating with the stack trace of `promise`. See #57.
    if (hasStacks &&
        promise.stack &&
        typeof error === "object" &&
        error !== null &&
        error.stack &&
        error.stack.indexOf(STACK_JUMP_SEPARATOR) === -1
    ) {
        var stacks = [];
        for (var p = promise; !!p; p = p.source) {
            if (p.stack) {
                stacks.unshift(p.stack);
            }
        }
        stacks.unshift(error.stack);

        var concatedStacks = stacks.join("\n" + STACK_JUMP_SEPARATOR + "\n");
        error.stack = filterStackString(concatedStacks);
    }
}

function filterStackString(stackString) {
    var lines = stackString.split("\n");
    var desiredLines = [];
    for (var i = 0; i < lines.length; ++i) {
        var line = lines[i];

        if (!isInternalFrame(line) && !isNodeFrame(line) && line) {
            desiredLines.push(line);
        }
    }
    return desiredLines.join("\n");
}

function isNodeFrame(stackLine) {
    return stackLine.indexOf("(module.js:") !== -1 ||
           stackLine.indexOf("(node.js:") !== -1;
}

function getFileNameAndLineNumber(stackLine) {
    // Named functions: "at functionName (filename:lineNumber:columnNumber)"
    // In IE10 function name can have spaces ("Anonymous function") O_o
    var attempt1 = /at .+ \((.+):(\d+):(?:\d+)\)$/.exec(stackLine);
    if (attempt1) {
        return [attempt1[1], Number(attempt1[2])];
    }

    // Anonymous functions: "at filename:lineNumber:columnNumber"
    var attempt2 = /at ([^ ]+):(\d+):(?:\d+)$/.exec(stackLine);
    if (attempt2) {
        return [attempt2[1], Number(attempt2[2])];
    }

    // Firefox style: "function@filename:lineNumber or @filename:lineNumber"
    var attempt3 = /.*@(.+):(\d+)$/.exec(stackLine);
    if (attempt3) {
        return [attempt3[1], Number(attempt3[2])];
    }
}

function isInternalFrame(stackLine) {
    var fileNameAndLineNumber = getFileNameAndLineNumber(stackLine);

    if (!fileNameAndLineNumber) {
        return false;
    }

    var fileName = fileNameAndLineNumber[0];
    var lineNumber = fileNameAndLineNumber[1];

    return fileName === qFileName &&
        lineNumber >= qStartingLine &&
        lineNumber <= qEndingLine;
}

// discover own file name and line number range for filtering stack
// traces
function captureLine() {
    if (!hasStacks) {
        return;
    }

    try {
        throw new Error();
    } catch (e) {
        var lines = e.stack.split("\n");
        var firstLine = lines[0].indexOf("@") > 0 ? lines[1] : lines[2];
        var fileNameAndLineNumber = getFileNameAndLineNumber(firstLine);
        if (!fileNameAndLineNumber) {
            return;
        }

        qFileName = fileNameAndLineNumber[0];
        return fileNameAndLineNumber[1];
    }
}

function deprecate(callback, name, alternative) {
    return function () {
        if (typeof console !== "undefined" &&
            typeof console.warn === "function") {
            console.warn(name + " is deprecated, use " + alternative +
                         " instead.", new Error("").stack);
        }
        return callback.apply(callback, arguments);
    };
}

// end of shims
// beginning of real work

/**
 * Constructs a promise for an immediate reference, passes promises through, or
 * coerces promises from different systems.
 * @param value immediate reference or promise
 */
function Q(value) {
    // If the object is already a Promise, return it directly.  This enables
    // the resolve function to both be used to created references from objects,
    // but to tolerably coerce non-promises to promises.
    if (isPromise(value)) {
        return value;
    }

    // assimilate thenables
    if (isPromiseAlike(value)) {
        return coerce(value);
    } else {
        return fulfill(value);
    }
}
Q.resolve = Q;

/**
 * Performs a task in a future turn of the event loop.
 * @param {Function} task
 */
Q.nextTick = nextTick;

/**
 * Controls whether or not long stack traces will be on
 */
Q.longStackSupport = false;

/**
 * Constructs a {promise, resolve, reject} object.
 *
 * `resolve` is a callback to invoke with a more resolved value for the
 * promise. To fulfill the promise, invoke `resolve` with any value that is
 * not a thenable. To reject the promise, invoke `resolve` with a rejected
 * thenable, or invoke `reject` with the reason directly. To resolve the
 * promise to another thenable, thus putting it in the same state, invoke
 * `resolve` with that other thenable.
 */
Q.defer = defer;
function defer() {
    // if "messages" is an "Array", that indicates that the promise has not yet
    // been resolved.  If it is "undefined", it has been resolved.  Each
    // element of the messages array is itself an array of complete arguments to
    // forward to the resolved promise.  We coerce the resolution value to a
    // promise using the `resolve` function because it handles both fully
    // non-thenable values and other thenables gracefully.
    var messages = [], progressListeners = [], resolvedPromise;

    var deferred = object_create(defer.prototype);
    var promise = object_create(Promise.prototype);

    promise.promiseDispatch = function (resolve, op, operands) {
        var args = array_slice(arguments);
        if (messages) {
            messages.push(args);
            if (op === "when" && operands[1]) { // progress operand
                progressListeners.push(operands[1]);
            }
        } else {
            nextTick(function () {
                resolvedPromise.promiseDispatch.apply(resolvedPromise, args);
            });
        }
    };

    // XXX deprecated
    promise.valueOf = function () {
        if (messages) {
            return promise;
        }
        var nearerValue = nearer(resolvedPromise);
        if (isPromise(nearerValue)) {
            resolvedPromise = nearerValue; // shorten chain
        }
        return nearerValue;
    };

    promise.inspect = function () {
        if (!resolvedPromise) {
            return { state: "pending" };
        }
        return resolvedPromise.inspect();
    };

    if (Q.longStackSupport && hasStacks) {
        try {
            throw new Error();
        } catch (e) {
            // NOTE: don't try to use `Error.captureStackTrace` or transfer the
            // accessor around; that causes memory leaks as per GH-111. Just
            // reify the stack trace as a string ASAP.
            //
            // At the same time, cut off the first line; it's always just
            // "[object Promise]\n", as per the `toString`.
            promise.stack = e.stack.substring(e.stack.indexOf("\n") + 1);
        }
    }

    // NOTE: we do the checks for `resolvedPromise` in each method, instead of
    // consolidating them into `become`, since otherwise we'd create new
    // promises with the lines `become(whatever(value))`. See e.g. GH-252.

    function become(newPromise) {
        resolvedPromise = newPromise;
        promise.source = newPromise;

        array_reduce(messages, function (undefined, message) {
            nextTick(function () {
                newPromise.promiseDispatch.apply(newPromise, message);
            });
        }, void 0);

        messages = void 0;
        progressListeners = void 0;
    }

    deferred.promise = promise;
    deferred.resolve = function (value) {
        if (resolvedPromise) {
            return;
        }

        become(Q(value));
    };

    deferred.fulfill = function (value) {
        if (resolvedPromise) {
            return;
        }

        become(fulfill(value));
    };
    deferred.reject = function (reason) {
        if (resolvedPromise) {
            return;
        }

        become(reject(reason));
    };
    deferred.notify = function (progress) {
        if (resolvedPromise) {
            return;
        }

        array_reduce(progressListeners, function (undefined, progressListener) {
            nextTick(function () {
                progressListener(progress);
            });
        }, void 0);
    };

    return deferred;
}

/**
 * Creates a Node-style callback that will resolve or reject the deferred
 * promise.
 * @returns a nodeback
 */
defer.prototype.makeNodeResolver = function () {
    var self = this;
    return function (error, value) {
        if (error) {
            self.reject(error);
        } else if (arguments.length > 2) {
            self.resolve(array_slice(arguments, 1));
        } else {
            self.resolve(value);
        }
    };
};

/**
 * @param resolver {Function} a function that returns nothing and accepts
 * the resolve, reject, and notify functions for a deferred.
 * @returns a promise that may be resolved with the given resolve and reject
 * functions, or rejected by a thrown exception in resolver
 */
Q.Promise = promise; // ES6
Q.promise = promise;
function promise(resolver) {
    if (typeof resolver !== "function") {
        throw new TypeError("resolver must be a function.");
    }
    var deferred = defer();
    try {
        resolver(deferred.resolve, deferred.reject, deferred.notify);
    } catch (reason) {
        deferred.reject(reason);
    }
    return deferred.promise;
}

promise.race = race; // ES6
promise.all = all; // ES6
promise.reject = reject; // ES6
promise.resolve = Q; // ES6

// XXX experimental.  This method is a way to denote that a local value is
// serializable and should be immediately dispatched to a remote upon request,
// instead of passing a reference.
Q.passByCopy = function (object) {
    //freeze(object);
    //passByCopies.set(object, true);
    return object;
};

Promise.prototype.passByCopy = function () {
    //freeze(object);
    //passByCopies.set(object, true);
    return this;
};

/**
 * If two promises eventually fulfill to the same value, promises that value,
 * but otherwise rejects.
 * @param x {Any*}
 * @param y {Any*}
 * @returns {Any*} a promise for x and y if they are the same, but a rejection
 * otherwise.
 *
 */
Q.join = function (x, y) {
    return Q(x).join(y);
};

Promise.prototype.join = function (that) {
    return Q([this, that]).spread(function (x, y) {
        if (x === y) {
            // TODO: "===" should be Object.is or equiv
            return x;
        } else {
            throw new Error("Can't join: not the same: " + x + " " + y);
        }
    });
};

/**
 * Returns a promise for the first of an array of promises to become fulfilled.
 * @param answers {Array[Any*]} promises to race
 * @returns {Any*} the first promise to be fulfilled
 */
Q.race = race;
function race(answerPs) {
    return promise(function(resolve, reject) {
        // Switch to this once we can assume at least ES5
        // answerPs.forEach(function(answerP) {
        //     Q(answerP).then(resolve, reject);
        // });
        // Use this in the meantime
        for (var i = 0, len = answerPs.length; i < len; i++) {
            Q(answerPs[i]).then(resolve, reject);
        }
    });
}

Promise.prototype.race = function () {
    return this.then(Q.race);
};

/**
 * Constructs a Promise with a promise descriptor object and optional fallback
 * function.  The descriptor contains methods like when(rejected), get(name),
 * set(name, value), post(name, args), and delete(name), which all
 * return either a value, a promise for a value, or a rejection.  The fallback
 * accepts the operation name, a resolver, and any further arguments that would
 * have been forwarded to the appropriate method above had a method been
 * provided with the proper name.  The API makes no guarantees about the nature
 * of the returned object, apart from that it is usable whereever promises are
 * bought and sold.
 */
Q.makePromise = Promise;
function Promise(descriptor, fallback, inspect) {
    if (fallback === void 0) {
        fallback = function (op) {
            return reject(new Error(
                "Promise does not support operation: " + op
            ));
        };
    }
    if (inspect === void 0) {
        inspect = function () {
            return {state: "unknown"};
        };
    }

    var promise = object_create(Promise.prototype);

    promise.promiseDispatch = function (resolve, op, args) {
        var result;
        try {
            if (descriptor[op]) {
                result = descriptor[op].apply(promise, args);
            } else {
                result = fallback.call(promise, op, args);
            }
        } catch (exception) {
            result = reject(exception);
        }
        if (resolve) {
            resolve(result);
        }
    };

    promise.inspect = inspect;

    // XXX deprecated `valueOf` and `exception` support
    if (inspect) {
        var inspected = inspect();
        if (inspected.state === "rejected") {
            promise.exception = inspected.reason;
        }

        promise.valueOf = function () {
            var inspected = inspect();
            if (inspected.state === "pending" ||
                inspected.state === "rejected") {
                return promise;
            }
            return inspected.value;
        };
    }

    return promise;
}

Promise.prototype.toString = function () {
    return "[object Promise]";
};

Promise.prototype.then = function (fulfilled, rejected, progressed) {
    var self = this;
    var deferred = defer();
    var done = false;   // ensure the untrusted promise makes at most a
                        // single call to one of the callbacks

    function _fulfilled(value) {
        try {
            return typeof fulfilled === "function" ? fulfilled(value) : value;
        } catch (exception) {
            return reject(exception);
        }
    }

    function _rejected(exception) {
        if (typeof rejected === "function") {
            makeStackTraceLong(exception, self);
            try {
                return rejected(exception);
            } catch (newException) {
                return reject(newException);
            }
        }
        return reject(exception);
    }

    function _progressed(value) {
        return typeof progressed === "function" ? progressed(value) : value;
    }

    nextTick(function () {
        self.promiseDispatch(function (value) {
            if (done) {
                return;
            }
            done = true;

            deferred.resolve(_fulfilled(value));
        }, "when", [function (exception) {
            if (done) {
                return;
            }
            done = true;

            deferred.resolve(_rejected(exception));
        }]);
    });

    // Progress propagator need to be attached in the current tick.
    self.promiseDispatch(void 0, "when", [void 0, function (value) {
        var newValue;
        var threw = false;
        try {
            newValue = _progressed(value);
        } catch (e) {
            threw = true;
            if (Q.onerror) {
                Q.onerror(e);
            } else {
                throw e;
            }
        }

        if (!threw) {
            deferred.notify(newValue);
        }
    }]);

    return deferred.promise;
};

/**
 * Registers an observer on a promise.
 *
 * Guarantees:
 *
 * 1. that fulfilled and rejected will be called only once.
 * 2. that either the fulfilled callback or the rejected callback will be
 *    called, but not both.
 * 3. that fulfilled and rejected will not be called in this turn.
 *
 * @param value      promise or immediate reference to observe
 * @param fulfilled  function to be called with the fulfilled value
 * @param rejected   function to be called with the rejection exception
 * @param progressed function to be called on any progress notifications
 * @return promise for the return value from the invoked callback
 */
Q.when = when;
function when(value, fulfilled, rejected, progressed) {
    return Q(value).then(fulfilled, rejected, progressed);
}

Promise.prototype.thenResolve = function (value) {
    return this.then(function () { return value; });
};

Q.thenResolve = function (promise, value) {
    return Q(promise).thenResolve(value);
};

Promise.prototype.thenReject = function (reason) {
    return this.then(function () { throw reason; });
};

Q.thenReject = function (promise, reason) {
    return Q(promise).thenReject(reason);
};

/**
 * If an object is not a promise, it is as "near" as possible.
 * If a promise is rejected, it is as "near" as possible too.
 * If it’s a fulfilled promise, the fulfillment value is nearer.
 * If it’s a deferred promise and the deferred has been resolved, the
 * resolution is "nearer".
 * @param object
 * @returns most resolved (nearest) form of the object
 */

// XXX should we re-do this?
Q.nearer = nearer;
function nearer(value) {
    if (isPromise(value)) {
        var inspected = value.inspect();
        if (inspected.state === "fulfilled") {
            return inspected.value;
        }
    }
    return value;
}

/**
 * @returns whether the given object is a promise.
 * Otherwise it is a fulfilled value.
 */
Q.isPromise = isPromise;
function isPromise(object) {
    return isObject(object) &&
        typeof object.promiseDispatch === "function" &&
        typeof object.inspect === "function";
}

Q.isPromiseAlike = isPromiseAlike;
function isPromiseAlike(object) {
    return isObject(object) && typeof object.then === "function";
}

/**
 * @returns whether the given object is a pending promise, meaning not
 * fulfilled or rejected.
 */
Q.isPending = isPending;
function isPending(object) {
    return isPromise(object) && object.inspect().state === "pending";
}

Promise.prototype.isPending = function () {
    return this.inspect().state === "pending";
};

/**
 * @returns whether the given object is a value or fulfilled
 * promise.
 */
Q.isFulfilled = isFulfilled;
function isFulfilled(object) {
    return !isPromise(object) || object.inspect().state === "fulfilled";
}

Promise.prototype.isFulfilled = function () {
    return this.inspect().state === "fulfilled";
};

/**
 * @returns whether the given object is a rejected promise.
 */
Q.isRejected = isRejected;
function isRejected(object) {
    return isPromise(object) && object.inspect().state === "rejected";
}

Promise.prototype.isRejected = function () {
    return this.inspect().state === "rejected";
};

//// BEGIN UNHANDLED REJECTION TRACKING

// This promise library consumes exceptions thrown in handlers so they can be
// handled by a subsequent promise.  The exceptions get added to this array when
// they are created, and removed when they are handled.  Note that in ES6 or
// shimmed environments, this would naturally be a `Set`.
var unhandledReasons = [];
var unhandledRejections = [];
var trackUnhandledRejections = true;

function resetUnhandledRejections() {
    unhandledReasons.length = 0;
    unhandledRejections.length = 0;

    if (!trackUnhandledRejections) {
        trackUnhandledRejections = true;
    }
}

function trackRejection(promise, reason) {
    if (!trackUnhandledRejections) {
        return;
    }

    unhandledRejections.push(promise);
    if (reason && typeof reason.stack !== "undefined") {
        unhandledReasons.push(reason.stack);
    } else {
        unhandledReasons.push("(no stack) " + reason);
    }
}

function untrackRejection(promise) {
    if (!trackUnhandledRejections) {
        return;
    }

    var at = array_indexOf(unhandledRejections, promise);
    if (at !== -1) {
        unhandledRejections.splice(at, 1);
        unhandledReasons.splice(at, 1);
    }
}

Q.resetUnhandledRejections = resetUnhandledRejections;

Q.getUnhandledReasons = function () {
    // Make a copy so that consumers can't interfere with our internal state.
    return unhandledReasons.slice();
};

Q.stopUnhandledRejectionTracking = function () {
    resetUnhandledRejections();
    trackUnhandledRejections = false;
};

resetUnhandledRejections();

//// END UNHANDLED REJECTION TRACKING

/**
 * Constructs a rejected promise.
 * @param reason value describing the failure
 */
Q.reject = reject;
function reject(reason) {
    var rejection = Promise({
        "when": function (rejected) {
            // note that the error has been handled
            if (rejected) {
                untrackRejection(this);
            }
            return rejected ? rejected(reason) : this;
        }
    }, function fallback() {
        return this;
    }, function inspect() {
        return { state: "rejected", reason: reason };
    });

    // Note that the reason has not been handled.
    trackRejection(rejection, reason);

    return rejection;
}

/**
 * Constructs a fulfilled promise for an immediate reference.
 * @param value immediate reference
 */
Q.fulfill = fulfill;
function fulfill(value) {
    return Promise({
        "when": function () {
            return value;
        },
        "get": function (name) {
            return value[name];
        },
        "set": function (name, rhs) {
            value[name] = rhs;
        },
        "delete": function (name) {
            delete value[name];
        },
        "post": function (name, args) {
            // Mark Miller proposes that post with no name should apply a
            // promised function.
            if (name === null || name === void 0) {
                return value.apply(void 0, args);
            } else {
                return value[name].apply(value, args);
            }
        },
        "apply": function (thisp, args) {
            return value.apply(thisp, args);
        },
        "keys": function () {
            return object_keys(value);
        }
    }, void 0, function inspect() {
        return { state: "fulfilled", value: value };
    });
}

/**
 * Converts thenables to Q promises.
 * @param promise thenable promise
 * @returns a Q promise
 */
function coerce(promise) {
    var deferred = defer();
    nextTick(function () {
        try {
            promise.then(deferred.resolve, deferred.reject, deferred.notify);
        } catch (exception) {
            deferred.reject(exception);
        }
    });
    return deferred.promise;
}

/**
 * Annotates an object such that it will never be
 * transferred away from this process over any promise
 * communication channel.
 * @param object
 * @returns promise a wrapping of that object that
 * additionally responds to the "isDef" message
 * without a rejection.
 */
Q.master = master;
function master(object) {
    return Promise({
        "isDef": function () {}
    }, function fallback(op, args) {
        return dispatch(object, op, args);
    }, function () {
        return Q(object).inspect();
    });
}

/**
 * Spreads the values of a promised array of arguments into the
 * fulfillment callback.
 * @param fulfilled callback that receives variadic arguments from the
 * promised array
 * @param rejected callback that receives the exception if the promise
 * is rejected.
 * @returns a promise for the return value or thrown exception of
 * either callback.
 */
Q.spread = spread;
function spread(value, fulfilled, rejected) {
    return Q(value).spread(fulfilled, rejected);
}

Promise.prototype.spread = function (fulfilled, rejected) {
    return this.all().then(function (array) {
        return fulfilled.apply(void 0, array);
    }, rejected);
};

/**
 * The async function is a decorator for generator functions, turning
 * them into asynchronous generators.  Although generators are only part
 * of the newest ECMAScript 6 drafts, this code does not cause syntax
 * errors in older engines.  This code should continue to work and will
 * in fact improve over time as the language improves.
 *
 * ES6 generators are currently part of V8 version 3.19 with the
 * --harmony-generators runtime flag enabled.  SpiderMonkey has had them
 * for longer, but under an older Python-inspired form.  This function
 * works on both kinds of generators.
 *
 * Decorates a generator function such that:
 *  - it may yield promises
 *  - execution will continue when that promise is fulfilled
 *  - the value of the yield expression will be the fulfilled value
 *  - it returns a promise for the return value (when the generator
 *    stops iterating)
 *  - the decorated function returns a promise for the return value
 *    of the generator or the first rejected promise among those
 *    yielded.
 *  - if an error is thrown in the generator, it propagates through
 *    every following yield until it is caught, or until it escapes
 *    the generator function altogether, and is translated into a
 *    rejection for the promise returned by the decorated generator.
 */
Q.async = async;
function async(makeGenerator) {
    return function () {
        // when verb is "send", arg is a value
        // when verb is "throw", arg is an exception
        function continuer(verb, arg) {
            var result;

            // Until V8 3.19 / Chromium 29 is released, SpiderMonkey is the only
            // engine that has a deployed base of browsers that support generators.
            // However, SM's generators use the Python-inspired semantics of
            // outdated ES6 drafts.  We would like to support ES6, but we'd also
            // like to make it possible to use generators in deployed browsers, so
            // we also support Python-style generators.  At some point we can remove
            // this block.

            if (typeof StopIteration === "undefined") {
                // ES6 Generators
                try {
                    result = generator[verb](arg);
                } catch (exception) {
                    return reject(exception);
                }
                if (result.done) {
                    return result.value;
                } else {
                    return when(result.value, callback, errback);
                }
            } else {
                // SpiderMonkey Generators
                // FIXME: Remove this case when SM does ES6 generators.
                try {
                    result = generator[verb](arg);
                } catch (exception) {
                    if (isStopIteration(exception)) {
                        return exception.value;
                    } else {
                        return reject(exception);
                    }
                }
                return when(result, callback, errback);
            }
        }
        var generator = makeGenerator.apply(this, arguments);
        var callback = continuer.bind(continuer, "next");
        var errback = continuer.bind(continuer, "throw");
        return callback();
    };
}

/**
 * The spawn function is a small wrapper around async that immediately
 * calls the generator and also ends the promise chain, so that any
 * unhandled errors are thrown instead of forwarded to the error
 * handler. This is useful because it's extremely common to run
 * generators at the top-level to work with libraries.
 */
Q.spawn = spawn;
function spawn(makeGenerator) {
    Q.done(Q.async(makeGenerator)());
}

// FIXME: Remove this interface once ES6 generators are in SpiderMonkey.
/**
 * Throws a ReturnValue exception to stop an asynchronous generator.
 *
 * This interface is a stop-gap measure to support generator return
 * values in older Firefox/SpiderMonkey.  In browsers that support ES6
 * generators like Chromium 29, just use "return" in your generator
 * functions.
 *
 * @param value the return value for the surrounding generator
 * @throws ReturnValue exception with the value.
 * @example
 * // ES6 style
 * Q.async(function* () {
 *      var foo = yield getFooPromise();
 *      var bar = yield getBarPromise();
 *      return foo + bar;
 * })
 * // Older SpiderMonkey style
 * Q.async(function () {
 *      var foo = yield getFooPromise();
 *      var bar = yield getBarPromise();
 *      Q.return(foo + bar);
 * })
 */
Q["return"] = _return;
function _return(value) {
    throw new QReturnValue(value);
}

/**
 * The promised function decorator ensures that any promise arguments
 * are settled and passed as values (`this` is also settled and passed
 * as a value).  It will also ensure that the result of a function is
 * always a promise.
 *
 * @example
 * var add = Q.promised(function (a, b) {
 *     return a + b;
 * });
 * add(Q(a), Q(B));
 *
 * @param {function} callback The function to decorate
 * @returns {function} a function that has been decorated.
 */
Q.promised = promised;
function promised(callback) {
    return function () {
        return spread([this, all(arguments)], function (self, args) {
            return callback.apply(self, args);
        });
    };
}

/**
 * sends a message to a value in a future turn
 * @param object* the recipient
 * @param op the name of the message operation, e.g., "when",
 * @param args further arguments to be forwarded to the operation
 * @returns result {Promise} a promise for the result of the operation
 */
Q.dispatch = dispatch;
function dispatch(object, op, args) {
    return Q(object).dispatch(op, args);
}

Promise.prototype.dispatch = function (op, args) {
    var self = this;
    var deferred = defer();
    nextTick(function () {
        self.promiseDispatch(deferred.resolve, op, args);
    });
    return deferred.promise;
};

/**
 * Gets the value of a property in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of property to get
 * @return promise for the property value
 */
Q.get = function (object, key) {
    return Q(object).dispatch("get", [key]);
};

Promise.prototype.get = function (key) {
    return this.dispatch("get", [key]);
};

/**
 * Sets the value of a property in a future turn.
 * @param object    promise or immediate reference for object object
 * @param name      name of property to set
 * @param value     new value of property
 * @return promise for the return value
 */
Q.set = function (object, key, value) {
    return Q(object).dispatch("set", [key, value]);
};

Promise.prototype.set = function (key, value) {
    return this.dispatch("set", [key, value]);
};

/**
 * Deletes a property in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of property to delete
 * @return promise for the return value
 */
Q.del = // XXX legacy
Q["delete"] = function (object, key) {
    return Q(object).dispatch("delete", [key]);
};

Promise.prototype.del = // XXX legacy
Promise.prototype["delete"] = function (key) {
    return this.dispatch("delete", [key]);
};

/**
 * Invokes a method in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of method to invoke
 * @param value     a value to post, typically an array of
 *                  invocation arguments for promises that
 *                  are ultimately backed with `resolve` values,
 *                  as opposed to those backed with URLs
 *                  wherein the posted value can be any
 *                  JSON serializable object.
 * @return promise for the return value
 */
// bound locally because it is used by other methods
Q.mapply = // XXX As proposed by "Redsandro"
Q.post = function (object, name, args) {
    return Q(object).dispatch("post", [name, args]);
};

Promise.prototype.mapply = // XXX As proposed by "Redsandro"
Promise.prototype.post = function (name, args) {
    return this.dispatch("post", [name, args]);
};

/**
 * Invokes a method in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of method to invoke
 * @param ...args   array of invocation arguments
 * @return promise for the return value
 */
Q.send = // XXX Mark Miller's proposed parlance
Q.mcall = // XXX As proposed by "Redsandro"
Q.invoke = function (object, name /*...args*/) {
    return Q(object).dispatch("post", [name, array_slice(arguments, 2)]);
};

Promise.prototype.send = // XXX Mark Miller's proposed parlance
Promise.prototype.mcall = // XXX As proposed by "Redsandro"
Promise.prototype.invoke = function (name /*...args*/) {
    return this.dispatch("post", [name, array_slice(arguments, 1)]);
};

/**
 * Applies the promised function in a future turn.
 * @param object    promise or immediate reference for target function
 * @param args      array of application arguments
 */
Q.fapply = function (object, args) {
    return Q(object).dispatch("apply", [void 0, args]);
};

Promise.prototype.fapply = function (args) {
    return this.dispatch("apply", [void 0, args]);
};

/**
 * Calls the promised function in a future turn.
 * @param object    promise or immediate reference for target function
 * @param ...args   array of application arguments
 */
Q["try"] =
Q.fcall = function (object /* ...args*/) {
    return Q(object).dispatch("apply", [void 0, array_slice(arguments, 1)]);
};

Promise.prototype.fcall = function (/*...args*/) {
    return this.dispatch("apply", [void 0, array_slice(arguments)]);
};

/**
 * Binds the promised function, transforming return values into a fulfilled
 * promise and thrown errors into a rejected one.
 * @param object    promise or immediate reference for target function
 * @param ...args   array of application arguments
 */
Q.fbind = function (object /*...args*/) {
    var promise = Q(object);
    var args = array_slice(arguments, 1);
    return function fbound() {
        return promise.dispatch("apply", [
            this,
            args.concat(array_slice(arguments))
        ]);
    };
};
Promise.prototype.fbind = function (/*...args*/) {
    var promise = this;
    var args = array_slice(arguments);
    return function fbound() {
        return promise.dispatch("apply", [
            this,
            args.concat(array_slice(arguments))
        ]);
    };
};

/**
 * Requests the names of the owned properties of a promised
 * object in a future turn.
 * @param object    promise or immediate reference for target object
 * @return promise for the keys of the eventually settled object
 */
Q.keys = function (object) {
    return Q(object).dispatch("keys", []);
};

Promise.prototype.keys = function () {
    return this.dispatch("keys", []);
};

/**
 * Turns an array of promises into a promise for an array.  If any of
 * the promises gets rejected, the whole array is rejected immediately.
 * @param {Array*} an array (or promise for an array) of values (or
 * promises for values)
 * @returns a promise for an array of the corresponding values
 */
// By Mark Miller
// http://wiki.ecmascript.org/doku.php?id=strawman:concurrency&rev=1308776521#allfulfilled
Q.all = all;
function all(promises) {
    return when(promises, function (promises) {
        var countDown = 0;
        var deferred = defer();
        array_reduce(promises, function (undefined, promise, index) {
            var snapshot;
            if (
                isPromise(promise) &&
                (snapshot = promise.inspect()).state === "fulfilled"
            ) {
                promises[index] = snapshot.value;
            } else {
                ++countDown;
                when(
                    promise,
                    function (value) {
                        promises[index] = value;
                        if (--countDown === 0) {
                            deferred.resolve(promises);
                        }
                    },
                    deferred.reject,
                    function (progress) {
                        deferred.notify({ index: index, value: progress });
                    }
                );
            }
        }, void 0);
        if (countDown === 0) {
            deferred.resolve(promises);
        }
        return deferred.promise;
    });
}

Promise.prototype.all = function () {
    return all(this);
};

/**
 * Waits for all promises to be settled, either fulfilled or
 * rejected.  This is distinct from `all` since that would stop
 * waiting at the first rejection.  The promise returned by
 * `allResolved` will never be rejected.
 * @param promises a promise for an array (or an array) of promises
 * (or values)
 * @return a promise for an array of promises
 */
Q.allResolved = deprecate(allResolved, "allResolved", "allSettled");
function allResolved(promises) {
    return when(promises, function (promises) {
        promises = array_map(promises, Q);
        return when(all(array_map(promises, function (promise) {
            return when(promise, noop, noop);
        })), function () {
            return promises;
        });
    });
}

Promise.prototype.allResolved = function () {
    return allResolved(this);
};

/**
 * @see Promise#allSettled
 */
Q.allSettled = allSettled;
function allSettled(promises) {
    return Q(promises).allSettled();
}

/**
 * Turns an array of promises into a promise for an array of their states (as
 * returned by `inspect`) when they have all settled.
 * @param {Array[Any*]} values an array (or promise for an array) of values (or
 * promises for values)
 * @returns {Array[State]} an array of states for the respective values.
 */
Promise.prototype.allSettled = function () {
    return this.then(function (promises) {
        return all(array_map(promises, function (promise) {
            promise = Q(promise);
            function regardless() {
                return promise.inspect();
            }
            return promise.then(regardless, regardless);
        }));
    });
};

/**
 * Captures the failure of a promise, giving an oportunity to recover
 * with a callback.  If the given promise is fulfilled, the returned
 * promise is fulfilled.
 * @param {Any*} promise for something
 * @param {Function} callback to fulfill the returned promise if the
 * given promise is rejected
 * @returns a promise for the return value of the callback
 */
Q.fail = // XXX legacy
Q["catch"] = function (object, rejected) {
    return Q(object).then(void 0, rejected);
};

Promise.prototype.fail = // XXX legacy
Promise.prototype["catch"] = function (rejected) {
    return this.then(void 0, rejected);
};

/**
 * Attaches a listener that can respond to progress notifications from a
 * promise's originating deferred. This listener receives the exact arguments
 * passed to ``deferred.notify``.
 * @param {Any*} promise for something
 * @param {Function} callback to receive any progress notifications
 * @returns the given promise, unchanged
 */
Q.progress = progress;
function progress(object, progressed) {
    return Q(object).then(void 0, void 0, progressed);
}

Promise.prototype.progress = function (progressed) {
    return this.then(void 0, void 0, progressed);
};

/**
 * Provides an opportunity to observe the settling of a promise,
 * regardless of whether the promise is fulfilled or rejected.  Forwards
 * the resolution to the returned promise when the callback is done.
 * The callback can return a promise to defer completion.
 * @param {Any*} promise
 * @param {Function} callback to observe the resolution of the given
 * promise, takes no arguments.
 * @returns a promise for the resolution of the given promise when
 * ``fin`` is done.
 */
Q.fin = // XXX legacy
Q["finally"] = function (object, callback) {
    return Q(object)["finally"](callback);
};

Promise.prototype.fin = // XXX legacy
Promise.prototype["finally"] = function (callback) {
    callback = Q(callback);
    return this.then(function (value) {
        return callback.fcall().then(function () {
            return value;
        });
    }, function (reason) {
        // TODO attempt to recycle the rejection with "this".
        return callback.fcall().then(function () {
            throw reason;
        });
    });
};

/**
 * Terminates a chain of promises, forcing rejections to be
 * thrown as exceptions.
 * @param {Any*} promise at the end of a chain of promises
 * @returns nothing
 */
Q.done = function (object, fulfilled, rejected, progress) {
    return Q(object).done(fulfilled, rejected, progress);
};

Promise.prototype.done = function (fulfilled, rejected, progress) {
    var onUnhandledError = function (error) {
        // forward to a future turn so that ``when``
        // does not catch it and turn it into a rejection.
        nextTick(function () {
            makeStackTraceLong(error, promise);
            if (Q.onerror) {
                Q.onerror(error);
            } else {
                throw error;
            }
        });
    };

    // Avoid unnecessary `nextTick`ing via an unnecessary `when`.
    var promise = fulfilled || rejected || progress ?
        this.then(fulfilled, rejected, progress) :
        this;

    if (typeof process === "object" && process && process.domain) {
        onUnhandledError = process.domain.bind(onUnhandledError);
    }

    promise.then(void 0, onUnhandledError);
};

/**
 * Causes a promise to be rejected if it does not get fulfilled before
 * some milliseconds time out.
 * @param {Any*} promise
 * @param {Number} milliseconds timeout
 * @param {String} custom error message (optional)
 * @returns a promise for the resolution of the given promise if it is
 * fulfilled before the timeout, otherwise rejected.
 */
Q.timeout = function (object, ms, message) {
    return Q(object).timeout(ms, message);
};

Promise.prototype.timeout = function (ms, message) {
    var deferred = defer();
    var timeoutId = setTimeout(function () {
        deferred.reject(new Error(message || "Timed out after " + ms + " ms"));
    }, ms);

    this.then(function (value) {
        clearTimeout(timeoutId);
        deferred.resolve(value);
    }, function (exception) {
        clearTimeout(timeoutId);
        deferred.reject(exception);
    }, deferred.notify);

    return deferred.promise;
};

/**
 * Returns a promise for the given value (or promised value), some
 * milliseconds after it resolved. Passes rejections immediately.
 * @param {Any*} promise
 * @param {Number} milliseconds
 * @returns a promise for the resolution of the given promise after milliseconds
 * time has elapsed since the resolution of the given promise.
 * If the given promise rejects, that is passed immediately.
 */
Q.delay = function (object, timeout) {
    if (timeout === void 0) {
        timeout = object;
        object = void 0;
    }
    return Q(object).delay(timeout);
};

Promise.prototype.delay = function (timeout) {
    return this.then(function (value) {
        var deferred = defer();
        setTimeout(function () {
            deferred.resolve(value);
        }, timeout);
        return deferred.promise;
    });
};

/**
 * Passes a continuation to a Node function, which is called with the given
 * arguments provided as an array, and returns a promise.
 *
 *      Q.nfapply(FS.readFile, [__filename])
 *      .then(function (content) {
 *      })
 *
 */
Q.nfapply = function (callback, args) {
    return Q(callback).nfapply(args);
};

Promise.prototype.nfapply = function (args) {
    var deferred = defer();
    var nodeArgs = array_slice(args);
    nodeArgs.push(deferred.makeNodeResolver());
    this.fapply(nodeArgs).fail(deferred.reject);
    return deferred.promise;
};

/**
 * Passes a continuation to a Node function, which is called with the given
 * arguments provided individually, and returns a promise.
 * @example
 * Q.nfcall(FS.readFile, __filename)
 * .then(function (content) {
 * })
 *
 */
Q.nfcall = function (callback /*...args*/) {
    var args = array_slice(arguments, 1);
    return Q(callback).nfapply(args);
};

Promise.prototype.nfcall = function (/*...args*/) {
    var nodeArgs = array_slice(arguments);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    this.fapply(nodeArgs).fail(deferred.reject);
    return deferred.promise;
};

/**
 * Wraps a NodeJS continuation passing function and returns an equivalent
 * version that returns a promise.
 * @example
 * Q.nfbind(FS.readFile, __filename)("utf-8")
 * .then(console.log)
 * .done()
 */
Q.nfbind =
Q.denodeify = function (callback /*...args*/) {
    var baseArgs = array_slice(arguments, 1);
    return function () {
        var nodeArgs = baseArgs.concat(array_slice(arguments));
        var deferred = defer();
        nodeArgs.push(deferred.makeNodeResolver());
        Q(callback).fapply(nodeArgs).fail(deferred.reject);
        return deferred.promise;
    };
};

Promise.prototype.nfbind =
Promise.prototype.denodeify = function (/*...args*/) {
    var args = array_slice(arguments);
    args.unshift(this);
    return Q.denodeify.apply(void 0, args);
};

Q.nbind = function (callback, thisp /*...args*/) {
    var baseArgs = array_slice(arguments, 2);
    return function () {
        var nodeArgs = baseArgs.concat(array_slice(arguments));
        var deferred = defer();
        nodeArgs.push(deferred.makeNodeResolver());
        function bound() {
            return callback.apply(thisp, arguments);
        }
        Q(bound).fapply(nodeArgs).fail(deferred.reject);
        return deferred.promise;
    };
};

Promise.prototype.nbind = function (/*thisp, ...args*/) {
    var args = array_slice(arguments, 0);
    args.unshift(this);
    return Q.nbind.apply(void 0, args);
};

/**
 * Calls a method of a Node-style object that accepts a Node-style
 * callback with a given array of arguments, plus a provided callback.
 * @param object an object that has the named method
 * @param {String} name name of the method of object
 * @param {Array} args arguments to pass to the method; the callback
 * will be provided by Q and appended to these arguments.
 * @returns a promise for the value or error
 */
Q.nmapply = // XXX As proposed by "Redsandro"
Q.npost = function (object, name, args) {
    return Q(object).npost(name, args);
};

Promise.prototype.nmapply = // XXX As proposed by "Redsandro"
Promise.prototype.npost = function (name, args) {
    var nodeArgs = array_slice(args || []);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    this.dispatch("post", [name, nodeArgs]).fail(deferred.reject);
    return deferred.promise;
};

/**
 * Calls a method of a Node-style object that accepts a Node-style
 * callback, forwarding the given variadic arguments, plus a provided
 * callback argument.
 * @param object an object that has the named method
 * @param {String} name name of the method of object
 * @param ...args arguments to pass to the method; the callback will
 * be provided by Q and appended to these arguments.
 * @returns a promise for the value or error
 */
Q.nsend = // XXX Based on Mark Miller's proposed "send"
Q.nmcall = // XXX Based on "Redsandro's" proposal
Q.ninvoke = function (object, name /*...args*/) {
    var nodeArgs = array_slice(arguments, 2);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    Q(object).dispatch("post", [name, nodeArgs]).fail(deferred.reject);
    return deferred.promise;
};

Promise.prototype.nsend = // XXX Based on Mark Miller's proposed "send"
Promise.prototype.nmcall = // XXX Based on "Redsandro's" proposal
Promise.prototype.ninvoke = function (name /*...args*/) {
    var nodeArgs = array_slice(arguments, 1);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    this.dispatch("post", [name, nodeArgs]).fail(deferred.reject);
    return deferred.promise;
};

/**
 * If a function would like to support both Node continuation-passing-style and
 * promise-returning-style, it can end its internal promise chain with
 * `nodeify(nodeback)`, forwarding the optional nodeback argument.  If the user
 * elects to use a nodeback, the result will be sent there.  If they do not
 * pass a nodeback, they will receive the result promise.
 * @param object a result (or a promise for a result)
 * @param {Function} nodeback a Node.js-style callback
 * @returns either the promise or nothing
 */
Q.nodeify = nodeify;
function nodeify(object, nodeback) {
    return Q(object).nodeify(nodeback);
}

Promise.prototype.nodeify = function (nodeback) {
    if (nodeback) {
        this.then(function (value) {
            nextTick(function () {
                nodeback(null, value);
            });
        }, function (error) {
            nextTick(function () {
                nodeback(error);
            });
        });
    } else {
        return this;
    }
};

// All code before this point will be filtered from stack traces.
var qEndingLine = captureLine();

return Q;

});

}).call(this,require('_process'))
},{"_process":3}],6:[function(require,module,exports){
var log = require('../vendor/operations.js/src/log');
var LocalCacheLogger = log.loggerWithName('LocalCache');
LocalCacheLogger.setLevel(log.Level.warn);
var RemoteCacheLogger = log.loggerWithName('RemoteCache');
RemoteCacheLogger.setLevel(log.Level.warn);
var RestError = require('./error').RestError;
var util = require('./util');

/**
 * Cache by pouch _id.
 * @type {{}}
 */
var localCacheById = {};
var localCache = {};

/**
 * Cache by type and whatever id was specified in the mapping.
 * @type {{}}
 */
var remoteCache = {};

function reset() {
    remoteCache = {};
    localCacheById = {};
    localCache = {};
}

reset();

function getViaLocalId(localId) {
    var obj = localCacheById[localId];
    if (obj) {
        if (LocalCacheLogger.debug.isEnabled)
            LocalCacheLogger.debug('Local cache hit: ' + obj._dump(true));
    }
    else {
        if (LocalCacheLogger.debug.isEnabled)
            LocalCacheLogger.debug('Local cache miss: ' + localId);
    }
    return  obj;
}

function getSingleton(mapping) {
    var mappingName = mapping.type;
    var collectionName = mapping.collection;
    console.error('getSingleton', localCache);
    var collectionCache = localCache[collectionName];
    if (collectionCache) {
        var typeCache = collectionCache[mappingName];
        if (typeCache) {
            var objs = [];
            for (var prop in typeCache) {
                if (typeCache.hasOwnProperty(prop)) {
                    objs.push(typeCache[prop]);
                }
            }
            if (objs.length > 1) {
                throw new RestError('A singleton mapping has more than 1 object in the cache! This is a serious error. ' +
                    'Either a mapping has been modified after objects have already been created, or something has gone' +
                    'very wrong. Please file a bug report if the latter.');
            }
            else if (objs.length) {
                return objs[0];
            }
        }
    }
    return null;
}

function getViaRemoteId(remoteId, opts) {
    var type = opts.mapping.type;
    var collection = opts.mapping.collection;
    var collectionCache = remoteCache[collection];
    if (collectionCache) {
        var typeCache = remoteCache[collection][type];
        if (typeCache) {
            var obj = typeCache[remoteId];
            if (obj) {
                if (RemoteCacheLogger.debug.isEnabled)
                    RemoteCacheLogger.debug('Remote cache hit: ' + obj._dump(true));
            }
            else {
                if (RemoteCacheLogger.debug.isEnabled)
                    RemoteCacheLogger.debug('Remote cache miss: ' + remoteId);
            }
            return  obj;
        }
    }
    if (RemoteCacheLogger.debug.isEnabled)
        RemoteCacheLogger.debug('Remote cache miss: ' + remoteId);
    return null;
}

function remoteInsert(obj, remoteId, previousRemoteId) {
    if (obj) {
        var collection = obj.mapping.collection;
        if (collection) {
            if (!remoteCache[collection]) {
                remoteCache[collection] = {};
            }
            var type = obj.mapping.type;
            if (type) {
                if (!remoteCache[collection][type]) {
                    remoteCache[collection][type] = {};
                }
                if (previousRemoteId) {
                    remoteCache[collection][type][previousRemoteId] = null;
                }
                var cachedObject = remoteCache[collection][type][remoteId];
                if (!cachedObject) {
                    remoteCache[collection][type][remoteId] = obj;
                    if (RemoteCacheLogger.debug.isEnabled)
                        RemoteCacheLogger.debug('Remote cache insert: ' + obj._dump(true));
                    if (RemoteCacheLogger.trace.isEnabled)
                        RemoteCacheLogger.trace('Remote cache now looks like: ' + remoteDump(true))
                }
                else {
                    // Something has gone really wrong. Only one object for a particular collection/type/remoteid combo
                    // should ever exist.
                    if (obj != cachedObject) {
                        var message = 'Object ' + collection.toString() + ':' + type.toString() + '[' + obj.mapping.id + '="' + remoteId + '"] already exists in the cache.' +
                            ' This is a serious error, please file a bug report if you are experiencing this out in the wild';
                        RemoteCacheLogger.error(message, {obj: obj, cachedObject: cachedObject});
                        util.printStackTrace();
                        throw new RestError(message);
                    }
                    else {
                        if (RemoteCacheLogger.debug.isEnabled)
                            RemoteCacheLogger.debug('Object has already been inserted: ' + obj._dump(true));
                    }

                }
            }
            else {
                throw new RestError('Mapping has no type', {mapping: obj.mapping, obj: obj});
            }
        }
        else {
            throw new RestError('Mapping has no collection', {mapping: obj.mapping, obj: obj});
        }
    }
    else {
        var msg = 'Must pass an object when inserting to cache';
        RemoteCacheLogger.error(msg);
        throw new RestError(msg);
    }

}

function remoteDump(asJson) {
    var dumpedRestCache = {};
    for (var coll in remoteCache) {
        if (remoteCache.hasOwnProperty(coll)) {
            var dumpedCollCache = {};
            dumpedRestCache[coll] = dumpedCollCache;
            var collCache = remoteCache[coll];
            for (var mapping in collCache) {
                if (collCache.hasOwnProperty(mapping)) {
                    var dumpedMappingCache = {};
                    dumpedCollCache[mapping] = dumpedMappingCache;
                    var mappingCache = collCache[mapping];
                    for (var remoteId in mappingCache) {
                        if (mappingCache.hasOwnProperty(remoteId)) {
                            if (mappingCache[remoteId]) {
                                dumpedMappingCache[remoteId] = mappingCache[remoteId]._dump();
                            }
                        }
                    }
                }
            }
        }
    }
    return asJson ? JSON.stringify(dumpedRestCache, null, 4) : dumpedRestCache;

}

function localDump(asJson) {
    var dumpedIdCache = {};
    for (var id in localCacheById) {
        if (localCacheById.hasOwnProperty(id)) {
            dumpedIdCache[id] = localCacheById[id]._dump()
        }
    }
    return asJson ? JSON.stringify(dumpedIdCache, null, 4) : dumpedIdCache;
}

function dump(asJson) {
    var dumped = {
        localCache: localDump(),
        remoteCache: remoteDump()
    };
    return asJson ? JSON.stringify(dumped, null, 4) : dumped;
}

function _remoteCache() {
    return remoteCache
}

function _localCache() {
    return localCacheById;
}

function get(opts) {
    if (LocalCacheLogger.debug.isEnabled) LocalCacheLogger.debug('get', opts);
    var obj, idField, remoteId;
    var localId = opts._id;
    if (localId) {
        obj = getViaLocalId(localId);
        if (obj) {
            return obj;
        }
        else {
            if (opts.mapping) {
                idField = opts.mapping.id;
                remoteId = opts[idField];
                if (LocalCacheLogger.debug.isEnabled) LocalCacheLogger.debug(idField + '=' + remoteId);
                return getViaRemoteId(remoteId, opts);
            }
            else {
                return null;
            }
        }
    }
    else if (opts.mapping) {
        idField = opts.mapping.id;
        remoteId = opts[idField];
        if (remoteId) {
            return getViaRemoteId(remoteId, opts);
        }
        else if (opts.mapping.singleton) {
            return getSingleton(opts.mapping);
        }
    }
    else {
        LocalCacheLogger.warn('Invalid opts to cache', {opts: opts});
    }
    return null;
}

// TODO: REMOVE THIS. ONLY FOR DEBUGGING.
function validate() {
    var idents = Object.keys(localCacheById);
    for (var i = 0; i < idents.length; i++) {
        var ident = idents[i];
        var obj = localCacheById[ident];
        if (ident != obj._id) {
            util.printStackTrace();
            throw new RestError('wtf?');
        }
    }
}

function insert(obj) {
    var localId = obj._id;
    if (localId) {
        var collectionName = obj.mapping.collection;
        var mappingName = obj.mapping.type;
        if (!localCacheById[localId]) {
            if (LocalCacheLogger.debug.isEnabled)
                LocalCacheLogger.debug('Local cache insert: ' + obj._dump(true));
            localCacheById[localId] = obj;
            if (LocalCacheLogger.trace.isEnabled)
                LocalCacheLogger.trace('Local cache now looks like: ' + localDump(true));
            if (!localCache[collectionName]) localCache[collectionName] = {};
            if (!localCache[collectionName][ mappingName]) localCache[collectionName][mappingName] = {};
            localCache[collectionName][obj.type][localId] = obj;
        }
        else {
            // Something has gone badly wrong here. Two objects should never exist with the same _id
            if (localCacheById[localId] != obj) {
                var message = 'Object with _id="' + localId.toString() + '" is already in the cache. ' +
                    'This is a serious error. Please file a bug report if you are experiencing this out in the wild';
                LocalCacheLogger.error(message);
                throw new RestError(message);
            }
        }
    }
    var idField = obj.idField;
    var remoteId = obj[idField];
    if (remoteId) {
        remoteInsert(obj, remoteId);
    }
    else {
        if (RemoteCacheLogger.debug.isEnabled)
            RemoteCacheLogger.debug('No remote id ("' + idField + '") so wont be placing in the remote cache', obj);
    }
    validate();
}


function dump(asJson) {
    var dumped = {
        localCache: localDump(),
        remoteCache: remoteDump()
    };
    return asJson ? JSON.stringify(dumped, null, 4) : dumped;
}


exports._remoteCache = _remoteCache;
exports._localCache = _localCache;
Object.defineProperty(exports, '_localCacheByType', {
    get: function () {
        return localCache;
    }
});
exports.get = get;
exports.insert = insert;
exports.remoteInsert = remoteInsert;
exports.reset = reset;
exports._dump = dump;











},{"../vendor/operations.js/src/log":25,"./error":10,"./util":23}],7:[function(require,module,exports){
var defineSubProperty = require('./misc').defineSubProperty;
var notificationCentre = require('./notificationCentre').notificationCentre;
var RestError = require('./error').RestError;
var log = require('../vendor/operations.js/src/log');

var Logger = log.loggerWithName('changes');
Logger.setLevel(log.Level.warn);

var ChangeType = {
    Set: 'Set',
    Splice: 'Splice',
    Remove: 'Remove'
};

/**
 * Represents an individual change.
 * @param opts
 * @constructor
 */
function Change(opts) {
    this._opts = opts;
    if (!this._opts) {
        this._opts = {};
    }
    defineSubProperty.call(this, 'collection', this._opts);
    defineSubProperty.call(this, 'mapping', this._opts);
    defineSubProperty.call(this, '_id', this._opts);
    defineSubProperty.call(this, 'field', this._opts);
    defineSubProperty.call(this, 'type', this._opts);
    defineSubProperty.call(this, 'index', this._opts);
    defineSubProperty.call(this, 'added', this._opts);
    defineSubProperty.call(this, 'addedId', this._opts);
    defineSubProperty.call(this, 'removed', this._opts);
    defineSubProperty.call(this, 'removedId', this._opts);
    defineSubProperty.call(this, 'new', this._opts);
    defineSubProperty.call(this, 'newId', this._opts);
    defineSubProperty.call(this, 'old', this._opts);
    defineSubProperty.call(this, 'oldId', this._opts);
}

Change.prototype._dump = function (json) {
    var dumped = {};
    dumped.collection = (typeof this.collection) == 'string' ? this.collection : this.collection._dump();
    dumped.mapping = (typeof this.mapping) == 'string' ? this.mapping : this.mapping.type;
    dumped._id = this._id;
    dumped.field = this.field;
    dumped.type = this.type;
    if (this.index) dumped.index = this.index;
    if (this.added) dumped.added = _.map(this.added, function (x) {return x._dump()});
    if (this.removed) dumped.removed = _.map(this.removed, function (x) {return x._dump()});
    if (this.old) dumped.old = this.old;
    if (this.new) dumped.new = this.new;
    return json ? JSON.stringify(dumped, null, 4) : dumped;
};

function broadcast(collection, mapping, c) {
    if (Logger.trace.isEnabled) Logger.trace('Sending notification "' + collection + '"');
    notificationCentre.emit(collection, c);
    var mappingNotif = collection + ':' + mapping;
    if (Logger.trace.isEnabled) Logger.trace('Sending notification "' + mappingNotif + '"');
    notificationCentre.emit(mappingNotif, c);
    var genericNotif = 'Siesta';
    if (Logger.trace.isEnabled) Logger.trace('Sending notification "' + genericNotif + '"');
    notificationCentre.emit(genericNotif, c);
}

/**
 * Throw an error if the change is incorrect.
 * @param changeOpts
 */
function validateChange(changeOpts) {
    if (!changeOpts.mapping) throw new RestError('Must pass a mapping');
    if (!changeOpts.collection) throw new RestError('Must pass a collection');
    if (!changeOpts._id) throw new RestError('Must pass a local identifier');
}


/**
 * Register that a change has been made.
 * @param opts
 */
function registerChange(opts) {
    validateChange(opts);
    var collection = opts.collection;
    var mapping = opts.mapping;
    var c = new Change(opts);
    broadcast(collection, mapping, c);
    return c;
}

exports.Change = Change;
exports.registerChange = registerChange;
exports.validateChange = validateChange;
exports.ChangeType = ChangeType;
},{"../vendor/operations.js/src/log":25,"./error":10,"./misc":14,"./notificationCentre":15}],8:[function(require,module,exports){
var log = require('../vendor/operations.js/src/log');
var Logger = log.loggerWithName('Collection');
Logger.setLevel(log.Level.warn);

var CollectionRegistry = require('./collectionRegistry').CollectionRegistry;
var Operation = require('../vendor/operations.js/src/operation').Operation;
var RestError = require('./error').RestError;
var Mapping = require('./mapping').Mapping;
var extend = require('extend');
var observe = require('../vendor/observe-js/src/observe').Platform;

//var $ = require('../vendor/zepto').$;
var util = require('./util');
var _ = util._;

var q = require('q');

var cache = require('./cache');
/**
 * A collection describes a set of models and optionally a REST API which we would
 * like to model.
 *
 * @param name
 * @constructor
 *
 * @example
 * ```js
 * var GitHub = new Collection('GitHub')
 * // ... configure mappings, descriptors etc ...
 * GitHub.install(function () {
 *     // ... carry on.
 * });
 * ```
 */
function Collection(name) {
    var self = this;
    if (!this) return new Collection(name);
    if (!name) throw new RestError('Collection must have a name');
    this._name = name;
    this._docId = 'Collection_' + this._name;
    this._rawMappings = {};
    this._mappings = {};
    /**
     * The URL of the API e.g. http://api.github.com
     * @type {string}
     */
    this.baseURL = '';

    /**
     * Set to true if installation has succeeded. You cannot use the collectio
     * @type {boolean}
     */
    this.installed = false;
    CollectionRegistry.register(this);

    /**
     *
     * @type {string}
     */
    Object.defineProperty(this, 'name', {
        get: function () {
            return self._name;
        }
    });
}

/**
 * Ensure mappings are installed.
 * @param callback
 */
Collection.prototype.install = function (callback) {
    var deferred = q.defer();
    var self = this;
    if (!this.installed) {
        var mappingsToInstall = [];
        for (var name in this._mappings) {
            if (this._mappings.hasOwnProperty(name)) {
                var mapping = this._mappings[name];
                mappingsToInstall.push(mapping);
            }
        }
        if (Logger.info.isEnabled)
            Logger.info('There are ' + mappingsToInstall.length.toString() + ' mappings to install');
        if (mappingsToInstall.length) {
            var operations = _.map(mappingsToInstall, function (m) {
                return new Operation('Install Mapping', _.bind(m.install, m));
            });
            var op = new Operation('Install Mappings', operations);
            op.completion = function () {
                if (op.failed) {
                    Logger.error('Failed to install collection', op.error);
                    self._finaliseInstallation(op.error, callback);
                }
                else {
                    self.installed = true;
                    var errors = [];
                    _.each(mappingsToInstall, function (m) {
                        if (Logger.info.isEnabled)
                            Logger.info('Installing relationships for mapping with name "' + m.type + '"');
                        try {
                            m.installRelationships();
                        }
                        catch (err) {
                            if (err instanceof RestError) {
                                errors.push(err);
                            }
                            else {
                                throw err;
                            }
                        }
                    });
                    if (!errors.length) {
                        _.each(mappingsToInstall, function (m) {
                            if (Logger.info.isEnabled)
                                Logger.info('Installing reverse relationships for mapping with name "' + m.type + '"');
                            try {
                                m.installReverseRelationships();
                            }
                            catch (err) {
                                if (err instanceof RestError) {
                                    errors.push(err);
                                }
                                else {
                                    throw err;
                                }
                            }
                        });
                    }
                    var err;
                    if (errors.length == 1) {
                        err = errors[0];
                    }
                    else if (errors.length) {
                        err = errors;
                    }
                    self._finaliseInstallation(err, callback);
                }
            };
            op.start();
        }
        else {
            self._finaliseInstallation(null, callback);
        }
    }
    else {
        var err = new RestError('Collection "' + this._name + '" has already been installed');
        self._finaliseInstallation(err, callback);
    }
    return deferred.promise;
};
Collection.prototype._finaliseInstallation = function (err, callback) {
    if (!err) {
        this.installed = true;
        var index = require('../index');
        index[this._name] = this;
    }
    if (callback) callback(err);
};
Collection.prototype._mapping = function (name, mapping) {
    if (name) {
        this._rawMappings[name] = mapping;
        var opts = extend(true, {}, mapping);
        opts.type = name;
        opts.collection = this._name;
        var mappingObject = new Mapping(opts);
        this._mappings[name] = mappingObject;
        this[name] = mappingObject;
        return mappingObject;
    }
    else {
        throw new RestError('No name specified when creating mapping');
    }
};
Collection.prototype.mapping = function () {
    var self = this;
    if (arguments.length) {
        if (arguments.length == 1) {
            if (util.isArray(arguments[0])) {
                return _.map(arguments[0], function (m) {
                    return self._mapping(m.name, m);
                });
            }
            else {
                return this._mapping(arguments[0].name, arguments[0]);
            }
        }
        else {
            if (typeof arguments[0] == 'string') {
                return this._mapping(arguments[0], arguments[1]);
            }
            else {
                return _.map(arguments, function (m) {
                    return self._mapping(m.name, m);
                });
            }
        }
    }
    return null;
};

function requestDescriptor(opts) {
    var requestDescriptor = new siesta.ext.http.RequestDescriptor(opts);
    siesta.ext.http.DescriptorRegistry.registerRequestDescriptor(requestDescriptor);
    return requestDescriptor;
}

function responseDescriptor(opts) {
    var responseDescriptor = new siesta.ext.http.ResponseDescriptor(opts);
    siesta.ext.http.DescriptorRegistry.registerResponseDescriptor(responseDescriptor);
    return responseDescriptor;
}

Collection.prototype._descriptor = function (registrationFunc) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (args.length) {
        if (args.length == 1) {
            if (util.isArray(args[0])) {
                return _.map(args[0], function (d) {
                    return registrationFunc(d);
                });
            }
            else {
                return registrationFunc(args[0]);
            }
        }
        else {
            return _.map(args, function (d) {
                return registrationFunc(d);
            });
        }
    }
    return null;
};
Collection.prototype.requestDescriptor = function () {
    return _.partial(this._descriptor, requestDescriptor).apply(this, arguments);
};
Collection.prototype.responseDescriptor = function () {
    return _.partial(this._descriptor, responseDescriptor).apply(this, arguments);
};
Collection.prototype._dump = function (asJson) {
    var obj = {};
    obj.installed = this.installed;
    obj.docId = this._docId;
    obj.name = this._name;
    obj.baseURL = this.baseURL;
    return asJson ? JSON.stringify(obj, null, 4) : obj;
};


/**
 * Persist all changes to PouchDB.
 * Note: Storage extension must be installed.
 * @param callback
 * @returns {Promise}
 */
Collection.prototype.save = function (callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    if (siesta.ext.storageEnabled) {
        util.next(function () {
            var mergeChanges = siesta.ext.storage.changes.mergeChanges;
            mergeChanges(callback);
        });
    }
    else {
        callback('Storage module not installed');
    }
    return deferred.promise;
};


/**
 * Send a HTTP request using the given method
 * @param request Does the request contain data? e.g. POST/PATCH/PUT will be true, GET will false
 * @param method
 * @returns {*}
 */
Collection.prototype.HTTP_METHOD = function (request, method) {
    if (siesta.ext.storageEnabled) {
        return _.partial(request ? this._httpRequest : this._httpResponse, method).apply(this, Array.prototype.slice.call(arguments, 2));
    }
    else {
        throw Error('Storage extension not installed.');
    }
};

/**
 * Send a GET request
 * @returns {*}
 */
Collection.prototype.GET = function () {
    return _.partial(this.HTTP_METHOD, false, 'GET').apply(this, arguments);
};

/**
 * Send a OPTIONS request
 * @returns {*}
 */
Collection.prototype.OPTIONS = function () {
    return _.partial(this.HTTP_METHOD, false, 'OPTIONS').apply(this, arguments);
};

/**
 * Send a TRACE request
 * @returns {*}
 */
Collection.prototype.TRACE = function () {
    return _.partial(this.HTTP_METHOD, false, 'TRACE').apply(this, arguments);
};

/**
 * Send a HEAD request
 * @returns {*}
 */
Collection.prototype.HEAD = function () {
    return _.partial(this.HTTP_METHOD, false, 'HEAD').apply(this, arguments);
};

/**
 * Send a POST request
 * @returns {*}
 */
Collection.prototype.POST = function () {
    return _.partial(this.HTTP_METHOD, true, 'POST').apply(this, arguments);
};

/**
 * Send a PUT request
 * @returns {*}
 */
Collection.prototype.PUT = function () {
    return _.partial(this.HTTP_METHOD, true, 'PUT').apply(this, arguments);
};

/**
 * Send a PATCH request
 * @returns {*}
 */
Collection.prototype.PATCH = function () {
    return _.partial(this.HTTP_METHOD, true, 'PATCH').apply(this, arguments);
};


/**
 * Returns the number of objects in this collection.
 *
 * @param callback
 * @returns Promise
 */
Collection.prototype.count = function (callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    var tasks = _.map(this._mappings, function (m) {
        return _.bind(m.count, m);
    });
    util.parallel(tasks, function (err, ns) {
        var n;
        if (!err) {
            n = _.reduce(ns, function (m, r) {return m + r}, 0);
        }
        callback(err, n);
    });
    return deferred.promise;
};

exports.Collection = Collection;

},{"../index":1,"../vendor/observe-js/src/observe":24,"../vendor/operations.js/src/log":25,"../vendor/operations.js/src/operation":26,"./cache":6,"./collectionRegistry":9,"./error":10,"./mapping":12,"./util":23,"extend":4,"q":5}],9:[function(require,module,exports){
var _ = require('./util')._;

function CollectionRegistry() {
    if (!this) return new CollectionRegistry();
    this.collectionNames = [];
}

CollectionRegistry.prototype.register = function (collection) {
    var name = collection._name;
    this[name] = collection;
    this.collectionNames.push(name);
};

CollectionRegistry.prototype.reset = function () {
    var self = this;
    _.each(this.collectionNames, function (name) {
        delete self[name];
    });
    this.collectionNames = [];
};

exports.CollectionRegistry = new CollectionRegistry();
},{"./util":23}],10:[function(require,module,exports){
function RestError(message, context, ssf) {
    if (!this) {
        return new RestError(message, context);
    }

    this.message = message;

    this.context = context;
    // capture stack trace
    ssf = ssf || arguments.callee;
    if (ssf && Error.captureStackTrace) {
        Error.captureStackTrace(this, ssf);
    }
}

RestError.prototype = Object.create(Error.prototype);
RestError.prototype.name = 'RestError';
RestError.prototype.constructor = RestError;

exports.RestError = RestError;
},{}],11:[function(require,module,exports){
var proxy = require('./proxy')
    , NewObjectProxy = proxy.NewObjectProxy
    , Store = require('./store')
    , util = require('./util')
    , _ = util._
    , RestError = require('./error').RestError
    , coreChanges = require('./changes')
    , notificationCentre = require('./notificationCentre')
    , wrapArrayForAttributes = notificationCentre.wrapArray
    , SiestaModel = require('./object').SiestaModel
    , ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver
    , ChangeType = require('./changes').ChangeType
    , q = require('q')
;


function ManyToManyProxy(opts) {
    NewObjectProxy.call(this, opts);
    var self = this;
    Object.defineProperty(this, 'isFault', {
        get: function () {
            if (self._id) {
                return !self.related;
            }
            return true;
        },
        set: function (v) {
            if (v) {
                self._id = undefined;
                self.related = null;
            }
            else {
                if (!self._id) {
                    self._id = [];
                    self.related = [];
                    wrapArray.call(self, self.related);
                }
            }
        }
    });
    this._reverseIsArray = true;
}


function clearReverse(removed) {
    var self = this;
    _.each(removed, function (removedObject) {
        var reverseProxy = proxy.getReverseProxyForObject.call(self, removedObject);
        var idx = reverseProxy._id.indexOf(self.object._id);
        proxy.makeChangesToRelatedWithoutObservations.call(reverseProxy, function (){
            proxy.splice.call(reverseProxy, idx, 1);
        });
    });
}

function setReverse(added) {
    var self = this;
    _.each(added, function (addedObject) {
        var reverseProxy = proxy.getReverseProxyForObject.call(self, addedObject);
        proxy.makeChangesToRelatedWithoutObservations.call(reverseProxy, function (){
            proxy.splice.call(reverseProxy, 0, 0, self.object);
        });
    });
}

function wrapArray(arr) {
    var self = this;
    wrapArrayForAttributes(arr, this.reverseName, this.object);
    if (!arr.oneToManyObserver) {
        arr.oneToManyObserver = new ArrayObserver(arr);
        var observerFunction = function (splices) {
            splices.forEach(function (splice) {
                var added = splice.addedCount ? arr.slice(splice.index, splice.index + splice.addedCount) : [];
                var removed = splice.removed;
                clearReverse.call(self, removed);
                setReverse.call(self, added);
                var mapping = proxy.getForwardMapping.call(self);
                coreChanges.registerChange({
                    collection: mapping.collection,
                    mapping: mapping,
                    _id: self.object._id,
                    field: proxy.getForwardName.call(self),
                    removed: removed,
                    added: added,
                    removedId: _.pluck(removed, '_id'),
                    addedId: _.pluck(added, '_id'),
                    type: ChangeType.Splice,
                    index: splice.index
                });
            });
        };
        arr.oneToManyObserver.open(observerFunction);
    }
}

ManyToManyProxy.prototype = Object.create(NewObjectProxy.prototype);

ManyToManyProxy.prototype.get = function (callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    var self = this;
    if (this.isFault) {
        Store.get({_id: this._id}, function (err, stored) {
            if (err) {
                if (callback) callback(err);
            }
            else {
                self.related = stored;
                if (callback) callback(null, stored);
            }
        })
    }
    else {
        if (callback) callback(null, this.related);
    }
    return deferred.promise;
};

function validate(obj) {
    if (Object.prototype.toString.call(obj) != '[object Array]') {
            return 'Cannot assign scalar to many to many';
        }
    return null;
}

ManyToManyProxy.prototype.set = function (obj) {
    proxy.checkInstalled.call(this);
    var self = this;
    if (obj) {
        var errorMessage;
        if (errorMessage = validate.call(this, obj)) {
            throw new RestError(errorMessage);
        }
        else {
            proxy.clearReverseRelated.call(this);
            proxy.set.call(self, obj);
            wrapArray.call(self, obj);
            proxy.setReverse.call(self, obj);
        }
    }
    else {
        proxy.clearReverseRelated.call(this);
        proxy.set.call(self, obj);
    }
};

ManyToManyProxy.prototype.install = function (obj) {
    NewObjectProxy.prototype.install.call(this, obj);
    obj[ ('splice' + util.capitaliseFirstLetter(this.reverseName))] = _.bind(proxy.splice, this);
};

exports.ManyToManyProxy = ManyToManyProxy;
},{"../vendor/observe-js/src/observe":24,"./changes":7,"./error":10,"./notificationCentre":15,"./object":16,"./proxy":19,"./store":22,"./util":23,"q":5}],12:[function(require,module,exports){
var log = require('../vendor/operations.js/src/log');
var Logger = log.loggerWithName('Mapping');
Logger.setLevel(log.Level.debug);

var defineSubProperty = require('./misc').defineSubProperty;
var CollectionRegistry = require('./collectionRegistry').CollectionRegistry;
var RestError = require('./error').RestError;
var relationship = require('./relationship');
var RelationshipType = relationship.RelationshipType;
var Query = require('./query').Query;
var Operation = require('../vendor/operations.js/src/operation').Operation;
var BulkMappingOperation = require('./mappingOperation').BulkMappingOperation;
var SiestaModel = require('./object').SiestaModel;
var guid = require('./misc').guid;
var cache = require('./cache');
var store = require('./store');
var extend = require('extend');


var coreChanges = require('./changes');
var ChangeType = coreChanges.ChangeType;
var wrapArray = require('./notificationCentre').wrapArray;

var OneToManyProxy = require('./oneToManyProxy').OneToManyProxy;
var OneToOneProxy = require('./oneToOneProxy').OneToOneProxy;
var ManyToManyProxy = require('./manyToManyProxy').ManyToManyProxy;

var util = require('./util');
var _ = util._;
var q = require('q');


function Mapping(opts) {
    var self = this;
    this._opts = opts;

    Object.defineProperty(this, '_fields', {
        get: function () {
            var fields = [];
            if (self._opts.id) {
                fields.push(self._opts.id);
            }
            if (self._opts.attributes) {
                _.each(self._opts.attributes, function (x) {fields.push(x)});
            }
            return fields;
        },
        enumerable: true,
        configurable: true
    });

    defineSubProperty.call(this, 'type', self._opts);
    defineSubProperty.call(this, 'id', self._opts);
    defineSubProperty.call(this, 'collection', self._opts);
    defineSubProperty.call(this, 'attributes', self._opts);
    defineSubProperty.call(this, 'relationships', self._opts);
    defineSubProperty.call(this, 'indexes', self._opts);
    defineSubProperty.call(this, 'subclass', self._opts);
    defineSubProperty.call(this, 'singleton', self._opts);

    if (!this.relationships) {
        this.relationships = [];
    }

    if (!this.indexes) {
        this.indexes = [];
    }

    this._validateSubclass();

    this._installed = false;
    this._relationshipsInstalled = false;
    this._reverseRelationshipsInstalled = false;

    Object.defineProperty(this, 'installed', {
        get: function () {
            return self._installed && self._relationshipsInstalled && self._reverseRelationshipsInstalled;
        },
        enumerable: true,
        configurable: true
    });

}

/**
 * Ensure that any subclasses passed to the mapping are valid and working correctly.
 * @private
 */
Mapping.prototype._validateSubclass = function () {
    if (this.subclass && this.subclass !== SiestaModel) {
        var obj = new this.subclass(this);
        if (!obj.mapping) {
            throw new RestError('Subclass for mapping "' + this.type + '" has not been configured correctly. ' +
                'Did you call super?');
        }
        if (this.subclass.prototype == SiestaModel.prototype) {
            throw new RestError('Subclass for mapping "' + this.type + '" has not been configured correctly. ' +
                'You should use Object.create on SiestaModel prototype.');
        }
    }
};


Mapping.prototype.installRelationships = function () {
    if (!this._relationshipsInstalled) {
        var self = this;
        self._relationships = [];
        if (self._opts.relationships) {
            for (var name in self._opts.relationships) {
                if (Logger.debug.isEnabled)
                    Logger.debug(self.type + ': configuring relationship ' + name);
                if (self._opts.relationships.hasOwnProperty(name)) {
                    var relationship = self._opts.relationships[name];
                    if (relationship.type == RelationshipType.OneToMany ||
                        relationship.type == RelationshipType.OneToOne ||
                        relationship.type == RelationshipType.ManyToMany) {
                        var mappingName = relationship.mapping;
                        if (Logger.debug.isEnabled)
                            Logger.debug('reverseMappingName', mappingName);
                        if (!self.collection) throw new RestError('Mapping must have collection');
                        var collection = CollectionRegistry[self.collection];
                        if (!collection) {
                            throw new RestError('Collection ' + self.collection + ' not registered');
                        }
                        var reverseMapping = collection[mappingName];
                        if (!reverseMapping) {
                            var arr = mappingName.split('.');
                            if (arr.length == 2) {
                                var collectionName = arr[0];
                                mappingName = arr[1];
                                var otherCollection = CollectionRegistry[collectionName];
                                if (!otherCollection) {
                                    throw new RestError('Collection with name "' + collectionName + '" does not exist.');
                                }
                                reverseMapping = otherCollection[mappingName];
                            }
                        }
                        if (Logger.debug.isEnabled)
                            Logger.debug('reverseMapping', reverseMapping);
                        if (reverseMapping) {
                            relationship.reverseMapping = reverseMapping;
                            relationship.forwardMapping = this;
                            relationship.forwardName = name;
                            relationship.reverseName = relationship.reverse;
                        }
                        else {
                            throw new RestError('Mapping with name "' + mappingName.toString() + '" does not exist');
                        }
                    }
                    else {
                        throw new RestError('Relationship type ' + relationship.type + ' does not exist');
                    }
                }
            }
        }
        this._relationshipsInstalled = true;
    }
    else {
        throw new RestError('Relationships for "' + this.type + '" have already been installed');
    }
};

Mapping.prototype.installReverseRelationships = function () {
            
    if (!this._reverseRelationshipsInstalled) {
        for (var forwardName in this.relationships) {
            if (this.relationships.hasOwnProperty(forwardName)) {
                var relationship = this.relationships[forwardName];
                var reverseMapping = relationship.reverseMapping;
                var reverseName = relationship.reverseName;
                if (Logger.debug.isEnabled)
                    Logger.debug(self.type + ': configuring  reverse relationship ' + name);
                reverseMapping.relationships[reverseName] = relationship;
            }
        }
        this._reverseRelationshipsInstalled = true;
    }
    else {
        throw new RestError('Reverse relationships for "' + this.type + '" have already been installed.');
    }
};

Mapping.prototype.query = function (query, callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    var _query = new Query(this, query);
    _query.execute(callback);
    return deferred.promise;
};

Mapping.prototype.get = function (idOrCallback, callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    function finish(err, res) {
        if (callback) callback(err, res);
    }

    if (this.singleton) {
        if (typeof idOrCallback == 'function') {
            callback = idOrCallback;
        }
        this.all(function (err, objs) {
            if (err) finish(err);
            if (objs.length > 1) {
                throw new RestError('Somehow more than one object has been created for a singleton mapping! ' +
                    'This is a serious error, please file a bug report.');
            }
            else if (objs.length) {
                finish(null, objs[0]);
            }
            else {
                finish(null, objs[0]);
            }
        });
    }
    else {
        var opts = {};
        opts[this.id] = idOrCallback;
        opts.mapping = this;
        var obj = cache.get(opts);
        if (obj) {
            finish(null, obj);
        }
        else {
            delete opts.mapping;
            var query = new Query(this, opts);
            query.execute(function (err, rows) {
                var obj = null;
                if (!err && rows.length) {
                    if (rows.length > 1) {
                        err = 'More than one object with id=' + idOrCallback.toString();
                    }
                    else {
                        obj = rows[0];
                    }
                }
                finish(err, obj);
            });
        }

    }
    return deferred.promise;
};

Mapping.prototype.all = function (callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    var query = new Query(this, {});
    query.execute(callback);
    return deferred.promise;
};

Mapping.prototype.install = function (callback) {
    if (Logger.info.isEnabled) Logger.info('Installing mapping ' + this.type);
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    if (!this._installed) {
        var errors = this._validate();
        this._installed = true;
        if (Logger.info.isEnabled) {
            if (errors.length) Logger.error('Errors installing mapping ' + this.type + ': ' + errors);
            else Logger.info('Installed mapping ' + this.type);
        }
        if (callback) callback(errors.length ? errors : null);
    }
    else {
        throw new RestError('Mapping "' + this.type + '" has already been installed');
    }
    return deferred.promise;
};

Mapping.prototype._validate = function () {
    var errors = [];
    if (!this.type) {
        errors.push('Must specify a type');
    }
    if (!this.collection) {
        errors.push('A mapping must belong to an collection');
    }
    return errors;
};


/**
 * Map data into Siesta.
 *
 * @param data Raw data received remotely or otherwise
 * @param callback Called once pouch persistence returns.
 * @param override Force mapping to this object
 */
Mapping.prototype.map = function (data, callback, override) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    if (this.installed) {
        if (util.isArray(data)) {
            this._mapBulk(data, callback, override);
        }
        else {
            this._mapBulk([data], function (err, objects) {
                if (callback) {
                    var obj;
                    if (objects) {
                        if (objects.length) {
                            obj = objects[0];
                        }
                    }
                    callback(err ? err[0] : null, obj);
                }
            }, override ? [override] : undefined);
        }
    }
    else {
        throw new RestError('Mapping must be fully installed before creating any models');
    }
    return deferred.promise;
};

Mapping.prototype._mapBulk = function (data, callback, override) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    var opts = {mapping: this, data: data};
    if (override) opts.objects = override;
    var op = new BulkMappingOperation(opts);
    op.onCompletion(function () {
        console.log('op!!!!!', op);
        var err = op.error;
        if (err) {
            if (callback) callback(err);
        }
        else {
            var objects = op.result;
            callback(null, objects);
        }
    });
    op.start();
    return deferred.promise;
};

function _countCache() {
    var collCache = cache._localCacheByType[this.collection] || {};
    var mappingCache = collCache[this.type] || {};
    return _.reduce(Object.keys(mappingCache), function (m, _id) {
        m[_id] = {};
        return m;
    }, {});
}

Mapping.prototype.count = function (callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    var hash = _countCache.call(this);
    if (siesta.ext.storageEnabled) {
        var pouch = siesta.ext.storage.Pouch.getPouch();
        var indexName = (new siesta.ext.storage.Index(this.collection, this.type))._getName() + '_';
        pouch.query(indexName, {include_docs: false}, function (err, resp) {
            var n;
            if (!err) {
                _.each(_.pluck(resp.rows, 'id'), function (id) {
                    hash[id] = {};
                });
                n = Object.keys(hash).length;
            }
            callback(err, n);
        });
    }
    else {
        callback(null, Object.keys(hash).length)
    }
    return deferred.promise;
};

/**
 * Convert raw data into a SiestaModel
 * @returns {SiestaModel}
 * @private
 */
Mapping.prototype._new = function (data) {
    if (this.installed) {
        var self = this;
        var _id;
        if (data) {
            _id = data._id ? data._id : guid();
        }
        else {
            _id = guid();
        }
        var newModel;
        if (this.subclass) {
            newModel = new this.subclass(this);
        }
        else {
            newModel = new SiestaModel(this);
        }
        if (Logger.info.isEnabled)
            Logger.info('New object created _id="' + _id.toString() + '", type=' + this.type, data);
        newModel._id = _id;
        // Place attributes on the object.
        newModel.__values = data || {};
        var fields = this._fields;
        var idx = fields.indexOf(this.id);
        if (idx > -1) {
            fields.splice(idx, 1);
        }
        _.each(fields, function (field) {
            Object.defineProperty(newModel, field, {
                get: function () {
                    return newModel.__values[field] || null;
                },
                set: function (v) {
                    var old = newModel.__values[field];
                    newModel.__values[field] = v;
                    coreChanges.registerChange({
                        collection: self.collection,
                        mapping: self.type,
                        _id: newModel._id,
                        new: v,
                        old: old,
                        type: ChangeType.Set,
                        field: field
                    });
                    if (util.isArray(v)) {
                        wrapArray(v, field, newModel);
                    }
                },
                enumerable: true,
                configurable: true
            });
        });

        Object.defineProperty(newModel, this.id, {
            get: function () {
                return newModel.__values[self.id] || null;
            },
            set: function (v) {
                var old = newModel[self.id];
                newModel.__values[self.id] = v;
                coreChanges.registerChange({
                    collection: self.collection,
                    mapping: self.type,
                    _id: newModel._id,
                    new: v,
                    old: old,
                    type: ChangeType.Set,
                    field: self.id
                });
                cache.remoteInsert(newModel, v, old);
            },
            enumerable: true,
            configurable: true
        });


        for (var name in this.relationships) {
            var proxy;
            if (this.relationships.hasOwnProperty(name)) {
                var relationship = this.relationships[name];
                if (relationship.type == RelationshipType.OneToMany) {
                    proxy = new OneToManyProxy(relationship);
                }
                else if (relationship.type == RelationshipType.OneToOne) {
                    proxy = new OneToOneProxy(relationship);
                }
                else if (relationship.type == RelationshipType.ManyToMany) {
                    proxy = new ManyToManyProxy(relationship);
                }
                else {
                    throw new RestError('No such relationship type: ' + relationship.type);
                }
            }
            proxy.install(newModel);
            proxy.isFault = false;
        }
        cache.insert(newModel);
        return newModel;
    }

    else {
        util.printStackTrace();
        throw new RestError('Mapping must be fully installed before creating any models');
    }

};

Mapping.prototype._dump = function (asJSON) {
    var dumped = {};
    dumped.name = this.type;
    dumped.attributes = this.attributes;
    dumped.id = this.id;
    dumped.collection = this.collection;
    dumped.relationships = _.map(this.relationships, function (r) {
        return r.isForward ? r.forwardName : r.reverseName;
    });
    return asJSON ? JSON.stringify(dumped, null, 4) : dumped;
};

Mapping.prototype.toString = function () {
    return 'Mapping[' + this.type + ']';
};

/**
 * A subclass of RestError specifcally for errors that occur during mapping.
 * @param message
 * @param context
 * @param ssf
 * @returns {MappingError}
 * @constructor
 */
function MappingError(message, context, ssf) {
    if (!this) {
        return new MappingError(message, context);
    }

    this.message = message;

    this.context = context;
    // capture stack trace
    ssf = ssf || arguments.callee;
    if (ssf && RestError.captureStackTrace) {
        RestError.captureStackTrace(this, ssf);
    }
}

MappingError.prototype = Object.create(RestError.prototype);
MappingError.prototype.name = 'MappingError';
MappingError.prototype.constructor = MappingError;

function arrayAsString(arr) {
    var arrContents = _.reduce(arr, function (memo, f) {return memo + '"' + f + '",'}, '');
    arrContents = arrContents.substring(0, arrContents.length - 1);
    return '[' + arrContents + ']';
}


function constructMapFunction(collection, type, fields) {
    var mapFunc;
    var onlyEmptyFieldSetSpecified = (fields.length == 1 && !fields[0].length);
    var noFieldSetsSpecified = !fields.length || onlyEmptyFieldSetSpecified;

    var arr = arrayAsString(fields);
    if (noFieldSetsSpecified) {
        mapFunc = function (doc) {
            var type = "$2";
            var collection = "$3";
            if (doc.type == type && doc.collection == collection) {
                emit(doc.type, doc);
            }
        }.toString();
    }
    else {
        mapFunc = function (doc) {
            var type = "$2";
            var collection = "$3";
            if (doc.type == type && doc.collection == collection) {
                //noinspection JSUnresolvedVariable
                var fields = $1;
                var aggField = '';
                for (var idx in fields) {
                    //noinspection JSUnfilteredForInLoop
                    var field = fields[idx];
                    var value = doc[field];
                    if (value !== null && value !== undefined) {
                        aggField += value.toString() + '_';
                    }
                    else if (value === null) {
                        aggField += 'null_';
                    }
                    else {
                        aggField += 'undefined_';
                    }
                }
                aggField = aggField.substring(0, aggField.length - 1);
                emit(aggField, doc);
            }
        }.toString();
        mapFunc = mapFunc.replace('$1', arr);
    }
    mapFunc = mapFunc.replace('$2', type);
    mapFunc = mapFunc.replace('$3', collection);
    return mapFunc;
}


function constructMapFunction2(collection, type, fields) {
    var mapFunc;
    var onlyEmptyFieldSetSpecified = (fields.length == 1 && !fields[0].length);
    var noFieldSetsSpecified = !fields.length || onlyEmptyFieldSetSpecified;

    if (noFieldSetsSpecified) {
        mapFunc = function (doc) {
            if (doc.type == type && doc.collection == collection) {
                emit(doc.type, doc);
            }
        };
    }
    else {
        mapFunc = function (doc) {
            if (doc.type == type && doc.collection == collection) {
                var aggField = '';
                for (var idx in fields) {
                    //noinspection JSUnfilteredForInLoop
                    var field = fields[idx];
                    var value = doc[field];
                    if (value !== null && value !== undefined) {
                        aggField += value.toString() + '_';
                    }
                    else if (value === null) {
                        aggField += 'null_';
                    }
                    else {
                        aggField += 'undefined_';
                    }
                }
                aggField = aggField.substring(0, aggField.length - 1);
                emit(aggField, doc);
            }
        };
    }
    return mapFunc;
}

exports.Mapping = Mapping;
exports.MappingError = MappingError;
exports.constructMapFunction2 = constructMapFunction2;
exports.constructMapFunction = constructMapFunction;
},{"../vendor/operations.js/src/log":25,"../vendor/operations.js/src/operation":26,"./cache":6,"./changes":7,"./collectionRegistry":9,"./error":10,"./manyToManyProxy":11,"./mappingOperation":13,"./misc":14,"./notificationCentre":15,"./object":16,"./oneToManyProxy":17,"./oneToOneProxy":18,"./query":20,"./relationship":21,"./store":22,"./util":23,"extend":4,"q":5}],13:[function(require,module,exports){
var Store = require('./store');
var SiestaModel = require('./object').SiestaModel;
var log = require('../vendor/operations.js/src/log');
var Operation = require('../vendor/operations.js/src/operation').Operation;
var RestError = require('../src/error').RestError;
var Query = require('./query').Query;

var Logger = log.loggerWithName('MappingOperation');
Logger.setLevel(log.Level.warn);

var cache = require('./cache');
var util = require('./util');
var _ = util._;
var defineSubProperty = require('./misc').defineSubProperty;
var ChangeType = require('./changes').ChangeType;
var q = require('q');

function flattenArray(arr) {
    return _.reduce(arr, function (memo, e) {
        if (util.isArray(e)) {
            memo = memo.concat(e);
        }
        else {
            memo.push(e);
        }
        return memo;
    }, []);
}

function unflattenArray(arr, modelArr) {
    var n = 0;
    var unflattened = [];
    for (var i = 0; i < modelArr.length; i++) {
        if (util.isArray(modelArr[i])) {
            var newArr = [];
            unflattened[i] = newArr;
            for (var j = 0; j < modelArr[i].length; j++) {
                newArr.push(arr[n]);
                n++;
            }
        }
        else {
            unflattened[i] = arr[n];
            n++;
        }
    }
    return unflattened;
}

function BulkMappingOperation(opts) {
    Operation.call(this);

    this._opts = opts;

    defineSubProperty.call(this, 'mapping', this._opts);
    defineSubProperty.call(this, 'data', this._opts);
    defineSubProperty.call(this, 'objects', this._opts);
    if (!this.objects) this.objects = [];

    this.errors = [];
    this.name = 'Mapping Operation';
    this.work = _.bind(this._start, this);

    // if (this.data) {
    //     _.each(this.data, function (datum) {
    //         if (!datum) {
    //             Logger.error('Eep! Null data!', this.data);
    //             throw 'Eep! Null data!';
    //         }
    //     })
    // }

    this.subOps = {};
}

BulkMappingOperation.prototype = Object.create(Operation.prototype);

function mapAttributes() {
    for (var i = 0; i < this.data.length; i++) {
        var datum = this.data[i];
        var object = this.objects[i];
        // No point mapping object onto itself. This happens if a SiestaModel is passed as a relationship.
        if (datum != object) {
            if (object) { // If object is falsy, then there was an error looking up that object/creating it.
                var fields = this.mapping._fields;
                _.each(fields, function (f) {
                    if (datum[f] !== undefined) { // null is fine
                        object[f] = datum[f];
                    }
                });
            }
        }
    }
}

BulkMappingOperation.prototype._map = function () {
    var self = this;
    mapAttributes.call(this);
    var relationshipFields = _.keys(self.subOps);
    _.each(relationshipFields, function (f) {
        var op = self.subOps[f].op;
        var indexes = self.subOps[f].indexes;
        var relatedData = getRelatedData.call(self, f).relatedData;
        var unflattenedObjects = unflattenArray(op.objects, relatedData);
        for (var i = 0; i < unflattenedObjects.length; i++) {
            var idx = indexes[i];
            // Errors are plucked from the suboperations.
            var error = self.errors[idx];
            var err = error ? error[f] : null;
            if (!err) {
                var related = unflattenedObjects[i]; // Can be array or scalar.
                var object = self.objects[idx];
                if (object) {
                    try {
                        object[f] = related;
//                        registerRelationshipChange(object, f, related);
                    }
                    catch (err) {
                        if (err instanceof RestError) {
                            if (!self.errors[idx]) self.errors[idx] = {};
                            self.errors[idx][f] = err.message;
                        }
                        else {
                            throw err;
                        }
                    }
                }
            }
        }
    });
};

/**
 * For indices where no object is present, perform lookups, creating a new object if necessary.
 * @private
 */
BulkMappingOperation.prototype._lookup = function (callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    var self = this;
    var remoteLookups = [];
    var localLookups = [];
    for (var i = 0; i < this.data.length; i++) {
        if (!this.objects[i]) {
            var lookup;
            var datum = this.data[i];
            var isScalar = typeof datum == 'string' || typeof datum == 'number' || datum instanceof String;
            if (datum) {
                if (isScalar) {
                    lookup = {index: i, datum: {}};
                    lookup.datum[self.mapping.id] = datum;
                    remoteLookups.push(lookup);
                }
                else if (datum instanceof SiestaModel) { // We won't need to perform any mapping.
                    this.objects[i] = datum;
                }
                else if (datum._id) {
                    localLookups.push({index: i, datum: datum});
                }
                else if (datum[self.mapping.id]) {
                    remoteLookups.push({index: i, datum: datum});
                }
                else {
                    this.objects[i] = self.mapping._new();
                }
            }
            else {
                this.objects[i] = null;
            }
        }
    }
    util.parallel([
            function (callback) {
                var localIdentifiers = _.pluck(_.pluck(localLookups, 'datum'), '_id');
                if (localIdentifiers.length) {
                    Store.getMultipleLocal(localIdentifiers, function (err, objects) {
                        if (!err) {
                            for (var i = 0; i < localIdentifiers.length; i++) {
                                var obj = objects[i];
                                var _id = localIdentifiers[i];
                                var lookup = localLookups[i];
                                if (!obj) {
                                    self.errors[lookup.index] = {_id: 'No object with _id="' + _id.toString() + '"'};
                                }
                                else {
                                    self.objects[lookup.index] = obj;
                                }
                            }
                        }
                        callback(err);
                    });
                }
                else {
                    callback();
                }
            },
            function (callback) {
                var remoteIdentifiers = _.pluck(_.pluck(remoteLookups, 'datum'), self.mapping.id);
                if (remoteIdentifiers.length) {
                    if (Logger.trace.isEnabled)
                        Logger.trace('Looking up remoteIdentifiers: ' + JSON.stringify(remoteIdentifiers, null, 4));
                    Store.getMultipleRemote(remoteIdentifiers, self.mapping, function (err, objects) {
                        if (!err) {
                            if (Logger.trace.isEnabled) {
                                var results = {};
                                for (i = 0; i < objects.length; i++) {
                                    results[remoteIdentifiers[i]] = objects[i] ? objects[i]._id : null;
                                }
                                Logger.trace('Results for remoteIdentifiers: ' + JSON.stringify(results, null, 4));
                            }
                            for (i = 0; i < objects.length; i++) {
                                var obj = objects[i];
                                var lookup = remoteLookups[i];
                                if (obj) {
                                    self.objects[lookup.index] = obj;
                                }
                                else {
                                    var data = {};
                                    var remoteId = remoteIdentifiers[i];
                                    data[self.mapping.id] = remoteId;
                                    var cacheQuery = {mapping: self.mapping};
                                    cacheQuery[self.mapping.id] = remoteId;
                                    var cached = cache.get(cacheQuery);
                                    if (cached) {
                                        self.objects[lookup.index] = cached;
                                    }
                                    else {
                                        self.objects[lookup.index] = self.mapping._new();
                                        // It's important that we map the remote identifier here to ensure that it ends
                                        // up in the cache.
                                        self.objects[lookup.index][self.mapping.id] = remoteId;
                                    }
                                }
                            }
                        }
                        callback(err);
                    });
                }
                else {
                    callback();
                }
            }
        ],
        callback);
    return deferred.promise;
};

BulkMappingOperation.prototype._lookupSingleton = function (callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    var self = this;
    var cachedSingleton = cache.get({mapping: this.mapping});
    if (!cachedSingleton) {
        var query = new Query(this.mapping);
        query.execute(function (err, objs) {
            if (!err) {
                var obj;
                if (objs.length) {
                    if (objs.length == 1) {
                        obj = objs[0];
                    }
                    else {
                        throw new RestError();
                    }
                }
                else {
                    obj = self.mapping._new();
                }
                for (var i = 0; i < self.data.length; i++) {
                    self.objects[i] = obj;
                }
            }
            callback(err);
        });
    }
    else {
        for (var i = 0; i < self.data.length; i++) {
            self.objects[i] = cachedSingleton;
        }
        callback();
    }
    return deferred.promise;
};




BulkMappingOperation.prototype._start = function (done) {
    if (this.data.length) {
        var self = this;
        var tasks = [];
        var lookupFunc = this.mapping.singleton ? this._lookupSingleton : this._lookup;
        tasks.push(_.bind(lookupFunc, this));
        tasks.push(_.bind(this._executeSubOperations, this));
        util.parallel(tasks, function () {
            self._map();
            done(self.errors.length ? self.errors : null, self.objects);
        });
    }
    else {
        done(null, []);
    }
};

function getRelatedData(name) {
    var indexes = [];
    var relatedData = [];
    for (var i = 0; i < this.data.length; i++) {
        var datum = this.data[i];
        if (datum) {
            if (datum[name]) {
                indexes.push(i);
                relatedData.push(datum[name]);
            }
        }
    }
    return {indexes: indexes, relatedData: relatedData};
}

BulkMappingOperation.prototype._constructSubOperations = function () {
    var subOps = this.subOps;
    var relationships = this.mapping.relationships;
    for (var name in relationships) {
        if (relationships.hasOwnProperty(name)) {
            var relationship = relationships[name];
            var reverseMapping = relationship.forwardName == name ? relationship.reverseMapping : relationship.forwardMapping;
            var __ret = getRelatedData.call(this, name);
            var indexes = __ret.indexes;
            var relatedData = __ret.relatedData;
            if (relatedData.length) {
                var flatRelatedData = flattenArray(relatedData);
                var op = new BulkMappingOperation({mapping: reverseMapping, data: flatRelatedData});
                op.__relationshipName = name;
                subOps[name] = {op: op, indexes: indexes};
            }
        }
    }
};

function gatherErrorsFromSubOperations() {
    var self = this;
    var relationshipNames = _.keys(this.subOps);
    _.each(relationshipNames, function (name) {
        var op = self.subOps[name].op;
        var indexes = self.subOps[name].indexes;
        var errors = op.errors;
        if (errors.length) {
            var relatedData = getRelatedData.call(self, name).relatedData;
            var unflattenedErrors = unflattenArray(errors, relatedData);
            for (var i = 0; i < unflattenedErrors.length; i++) {
                var idx = indexes[i];
                var err = unflattenedErrors[i];
                var isError = err;
                if (util.isArray(err)) isError = _.reduce(err, function (memo, x) {return memo || x}, false);
                if (isError) {
                    if (!self.errors[idx]) self.errors[idx] = {};
                    self.errors[idx][name] = err;
                }
            }
        }
    });
}

BulkMappingOperation.prototype._executeSubOperations = function (callback) {
    var self = this;
    this._constructSubOperations();
    var relationshipNames = _.keys(this.subOps);
    if (relationshipNames.length) {
        var subOperations = _.map(relationshipNames, function (k) { return self.subOps[k].op});
        var compositeOperation = new Operation(subOperations);
        compositeOperation.onCompletion(function () {
            gatherErrorsFromSubOperations.call(self, relationshipNames);
            callback();
        });
        compositeOperation.start();
    }
    else {
        callback();
    }
};

exports.BulkMappingOperation = BulkMappingOperation;
exports.flattenArray = flattenArray;
exports.unflattenArray = unflattenArray;
},{"../src/error":10,"../vendor/operations.js/src/log":25,"../vendor/operations.js/src/operation":26,"./cache":6,"./changes":7,"./misc":14,"./object":16,"./query":20,"./store":22,"./util":23,"q":5}],14:[function(require,module,exports){
var RestError = require('./error').RestError;

function assert(condition, message, context) {
    if (!condition) {
        message = message || "Assertion failed";
        context = context || {};
        throw new RestError(message, context);
    }
}

function defineSubProperty (property, subObj, innerProperty) {
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

function wrappedCallback (callback) {
    return function (err, res) {
        if (callback) callback(err, res);
    }
}

exports.assert = assert;
exports.defineSubProperty = defineSubProperty;
exports.guid = guid;
exports.wrappedCallback = wrappedCallback;
},{"./error":10}],15:[function(require,module,exports){
var EventEmitter = require('events').EventEmitter;
var notificationCentre = new EventEmitter();
notificationCentre.setMaxListeners(100);
var ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver;
var coreChanges = require('./changes');
var ChangeType = coreChanges.ChangeType;
var log = require('../vendor/operations.js/src/log');


///**
// * Wraps the methods of a javascript array object so that notifications are sent
// * on calls.
// *
// * @param array the array we have wrapping
// * @param field name of the field
// * @param restObject the object to which this array is a property
// */
//

function wrapArray(array, field, siestaModel) {
    if (!array.observer) {
        array.observer = new ArrayObserver(array);
        array.observer.open(function (splices) {
            var fieldIsAttribute = siestaModel._fields.indexOf(field) > -1;
            if (fieldIsAttribute) {
                splices.forEach(function (splice) {
                    coreChanges.registerChange({
                        collection: siestaModel.collection,
                        mapping: siestaModel.mapping.type,
                        _id: siestaModel._id,
                        index: splice.index,
                        removed: splice.removed,
                        added: splice.addedCount ? array.slice(splice.index, splice.index+splice.addedCount) : [],
                        type: coreChanges.ChangeType.Splice,
                        field: field
                    });
                });
            }
        });
        array.isFault = false;
    }
}



exports.notificationCentre = notificationCentre;
exports.wrapArray = wrapArray;

},{"../vendor/observe-js/src/observe":24,"../vendor/operations.js/src/log":25,"./changes":7,"events":2}],16:[function(require,module,exports){
var log = require('../vendor/operations.js/src/log');
var Logger = log.loggerWithName('SiestaModel');
Logger.setLevel(log.Level.warn);

var defineSubProperty = require('./misc').defineSubProperty;
//var OperationQueue = require('../vendor/operations.js/src/queue').OperationQueue;
var util = require('./util');
var _ = util._;
var error = require('./error');
var RestError = error.RestError;

var q = require('q');

//var queues = {};

function SiestaModel(mapping) {

    if (!this) {
        return new SiestaModel(mapping);
    }
    var self = this;
    this.mapping = mapping;
    Object.defineProperty(this, 'idField', {
        get: function () {
            return self.mapping.id ? self.mapping.id : 'id';
        },
        enumerable: true,
        configurable: true
    });
    defineSubProperty.call(this, 'type', this.mapping);
    defineSubProperty.call(this, 'collection', this.mapping);
    defineSubProperty.call(this, '_fields', this.mapping);
    Object.defineProperty(this, '_relationshipFields', {
        get: function () {
            return _.map(self._proxies, function (p) {
                if (p.isForward) {
                    return p.forwardName;
                }
                else {
                    return p.reverseName;
                }
            });
        },
        enumerable: true,
        configurable: true
    });


    this.isFault = false;

    Object.defineProperty(this, 'isSaved', {
        get: function () {
            return !!self._rev;
        },
        enumerable: true,
        configurable: true
    });

    this._rev = null;

}

/**
 * Human readable dump of this object
 * @returns {*}
 * @private
 */
SiestaModel.prototype._dump = function (asJson) {
    var self = this;
    var cleanObj = {};
    cleanObj.mapping = this.mapping.type;
    cleanObj.collection = this.collection;
    cleanObj._id = this._id;
    cleanObj = _.reduce(this._fields, function (memo, f) {
        if (self[f]) {
            memo[f] = self[f];
        }
        return memo;
    }, cleanObj);
    cleanObj = _.reduce(this._relationshipFields, function (memo, f) {
        if (self[f + 'Proxy']) {
            if (self[f + 'Proxy'].hasOwnProperty('_id')) {
                if (util.isArray(self[f + 'Proxy']._id)) {
                    if (self[f].length) {
                        memo[f] = self[f + 'Proxy']._id;
                    }
                }
                else if (self[f + 'Proxy']._id) {
                    memo[f] = self[f + 'Proxy']._id;
                }
            }
            else {
                memo[f] = self[f];
            }
        }
        return memo;
    }, cleanObj);

    return asJson ? JSON.stringify(cleanObj, null, 4) : cleanObj;
};


SiestaModel.prototype.get = function (callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    if (callback) callback(null, this);
    return deferred.promise;
};

exports.SiestaModel = SiestaModel;
exports.dumpSaveQueues = function () {
    var dumped = {};
    for (var id in queues) {
        if (queues.hasOwnProperty(id)) {
            var queue = queues[id];
            dumped[id] = {
                numRunning: queue.numRunningOperations,
                queued: queue._queuedOperations.length
            };
        }
    }
    return dumped;
};
},{"../vendor/operations.js/src/log":25,"./error":10,"./misc":14,"./util":23,"q":5}],17:[function(require,module,exports){
var proxy = require('./proxy')
    , NewObjectProxy = proxy.NewObjectProxy
    , Store = require('./store')
    , util = require('./util')
    , _ = util._
    , RestError = require('./error').RestError
    , coreChanges = require('./changes')
    , SiestaModel = require('./object').SiestaModel
    , notificationCentre = require('./notificationCentre')
    , wrapArrayForAttributes = notificationCentre.wrapArray
    , ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver
    , ChangeType = require('./changes').ChangeType
    , q = require('q')
    ;


function OneToManyProxy(opts) {
    NewObjectProxy.call(this, opts);

    var self = this;
    Object.defineProperty(this, 'isFault', {
        get: function () {
            if (self.isForward) {
                if (self._id) {
                    return !self.related;
                }
                else if (self._id === null) {
                    return false;
                }
                return true;
            }
            else {
                if (self._id) {
                    if (self.related) {
                        if (self._id.length != self.related.length) {
                            validateRelated.call(this);
                            return true;
                        }
                        else {
                            return false;
                        }
                    }
                    return true;
                }
                return true;
            }
        },
        set: function (v) {
            if (v) {
                self._id = undefined;
                self.related = null;
            }
            else {
                if (!self._id) {
                    if (self.isForward) {
                        self._id = null;
                    }
                    else {
                        self._id = [];
                        self.related = [];
                        wrapArray.call(self, self.related);
                    }
                }
            }
        }
    });
    this._reverseIsArray = true;
    this._forwardIsArray = false;
}

OneToManyProxy.prototype = Object.create(NewObjectProxy.prototype);


function clearReverse(removed) {
    var self = this;
    _.each(removed, function (removedObject) {
        var reverseProxy = proxy.getReverseProxyForObject.call(self, removedObject);
        proxy.set.call(reverseProxy, null);
    });
}

function setReverse(added) {
    var self = this;
    _.each(added, function (added) {
        var forwardProxy = proxy.getReverseProxyForObject.call(self, added);
        proxy.set.call(forwardProxy, self.object);
    });
}

function wrapArray(arr) {
    var self = this;
    wrapArrayForAttributes(arr, this.reverseName, this.object);
    if (!arr.oneToManyObserver) {
        arr.oneToManyObserver = new ArrayObserver(arr);
        var observerFunction = function (splices) {
            splices.forEach(function (splice) {
                var added = splice.addedCount ? arr.slice(splice.index, splice.index + splice.addedCount) : [];
                var removed = splice.removed;
                clearReverse.call(self, removed);
                setReverse.call(self, added);
                var mapping = proxy.getForwardMapping.call(self);
                coreChanges.registerChange({
                    collection: mapping.collection,
                    mapping: mapping,
                    _id: self.object._id,
                    field: proxy.getForwardName.call(self),
                    removed: removed,
                    added: added,
                    removedId: _.pluck(removed, '_id'),
                    addedId: _.pluck(added, '_id'),
                    type: ChangeType.Splice,
                    index: splice.index
                });
            });
        };
        arr.oneToManyObserver.open(observerFunction);
    }
}


OneToManyProxy.prototype.get = function (callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    var self = this;
    if (this.isFault) {
        if (this._id.length) {
            var storeOpts = {_id: this._id};
            Store.get(storeOpts, function (err, stored) {
                if (err) {
                    if (callback) callback(err);
                }
                else {
                    self.related = stored;
                    if (callback) callback(null, stored);
                }
            });
        }
        else if (callback) {
            callback(null, this.related);
        }
    }
    else {
        if (callback) callback(null, this.related);
    }
    return deferred.promise;
};

/**
 * Validate the object that we're setting
 * @param obj
 * @returns {string|null} An error message or null
 */
function validate(obj) {
    var str = Object.prototype.toString.call(obj);
    if (this.isForward) {
        if (str == '[object Array]') {
            return 'Cannot assign array forward oneToMany (' + str + '): ' + this.forwardName;
        }
    }
    else {
        if (str != '[object Array]') {
            return 'Cannot scalar to reverse oneToMany (' + str + '): ' + this.reverseName;
        }
    }
    return null;
}

function validateRelated() {
    var self = this;
    if (self._id) {
        if (self.related) {
            if (self._id.length != self.related.length) {
                if (self.related.length > 0) {
                    throw new RestError('_id and related are somehow out of sync');
                }
            }
        }
    }
}

OneToManyProxy.prototype.set = function (obj) {
    proxy.checkInstalled.call(this);
    var self = this;
    if (obj) {
        var errorMessage;
        if (errorMessage = validate.call(this, obj)) {
            throw new RestError(errorMessage);
        }
        else {
            proxy.clearReverseRelated.call(this);
            proxy.set.call(self, obj);
            if (self.isReverse) {
                wrapArray.call(this, self.related);
            }
            proxy.setReverse.call(self, obj);
        }
    }
    else {
        proxy.clearReverseRelated.call(this);
        proxy.set.call(self, obj);
    }
};

OneToManyProxy.prototype.install = function (obj) {
    NewObjectProxy.prototype.install.call(this, obj);
    if (this.isReverse) {
        obj[ ('splice' + util.capitaliseFirstLetter(this.reverseName))] = _.bind(proxy.splice, this);
    }
};


exports.OneToManyProxy = OneToManyProxy;
},{"../vendor/observe-js/src/observe":24,"./changes":7,"./error":10,"./notificationCentre":15,"./object":16,"./proxy":19,"./store":22,"./util":23,"q":5}],18:[function(require,module,exports){
var proxy = require('./proxy')
    , NewObjectProxy = proxy.NewObjectProxy
    , Store = require('./store')
    , util = require('./util')
    , RestError = require('./error').RestError
    , q = require('q')
    , SiestaModel = require('./object').SiestaModel;



function OneToOneProxy(opts) {
    NewObjectProxy.call(this, opts);
    this._reverseIsArray = false;
    this._forwardIsArray = false;
}

OneToOneProxy.prototype = Object.create(NewObjectProxy.prototype);

/**
 * Validate the object that we're setting
 * @param obj
 * @returns {string|null} An error message or null
 */
function validate(obj) {
    if (Object.prototype.toString.call(obj) == '[object Array]') {
        return 'Cannot assign array to one to one relationship';
    }
    else if ((!obj instanceof SiestaModel)) {

    }
    return null;
}

OneToOneProxy.prototype.set = function (obj) {
    proxy.checkInstalled.call(this);
    var self = this;
    if (obj) {
        var errorMessage;
        if (errorMessage = validate(obj)) {
            throw new RestError(errorMessage);
        }
        else {
            proxy.clearReverseRelated.call(this);
            proxy.set.call(self, obj);
            proxy.setReverse.call(self, obj);
        }
    }
    else {
        proxy.clearReverseRelated.call(this);
        proxy.set.call(self, obj);
    }
};

OneToOneProxy.prototype.get = function (callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    var self = this;
    if (this._id) {
        Store.get({_id: this._id}, function (err, stored) {
            if (err) {
                if (callback) callback(err);
            }
            else {
                self.related = stored;
                if (callback) callback(null, stored);
            }
        })
    }
    return deferred.promise;
};

exports.OneToOneProxy = OneToOneProxy;
},{"./error":10,"./object":16,"./proxy":19,"./store":22,"./util":23,"q":5}],19:[function(require,module,exports){
var RestError = require('./error').RestError
    , Store = require('./store')
    , defineSubProperty = require('./misc').defineSubProperty
    , Operation = require('../vendor/operations.js/src/operation').Operation
    , util = require('./util')
    , _ = util._
    , Query = require('./query').Query
    , log = require('../vendor/operations.js/src/log')
    , notificationCentre = require('./notificationCentre')
    , wrapArrayForAttributes = notificationCentre.wrapArray
    , ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver
    , coreChanges = require('./changes')
    , ChangeType = coreChanges.ChangeType;

function Fault(proxy) {
    var self = this;
    this.proxy = proxy;
    Object.defineProperty(this, 'isFault', {
        get: function () {
            return self.proxy.isFault;
        },
        enumerable: true,
        configurable: true
    });
}

Fault.prototype.get = function () {
    this.proxy.get.apply(this.proxy, arguments);
};

Fault.prototype.set = function () {
    this.proxy.set.apply(this.proxy, arguments);
};

function NewObjectProxy(opts) {
    this._opts = opts;
    if (!this) return new NewObjectProxy(opts);
    var self = this;
    this.fault = new Fault(this);
    this.object = null;
    this._id = undefined;
    this.related = null;
    Object.defineProperty(this, 'isFault', {
        get: function () {
            if (self._id) {
                return !self.related;
            }
            else if (self._id === null) {
                return false;
            }
            return true;
        },
        set: function (v) {
            if (v) {
                self._id = undefined;
                self.related = null;
            }
            else {
                if (!self._id) {
                    self._id = null;
                }
            }
        },
        enumerable: true,
        configurable: true
    });
    defineSubProperty.call(this, 'reverseMapping', this._opts);
    defineSubProperty.call(this, 'forwardMapping', this._opts);
    defineSubProperty.call(this, 'forwardName', this._opts);
    defineSubProperty.call(this, 'reverseName', this._opts);
    Object.defineProperty(this, 'isReverse', {
        get: function () {
            if (self.object) {
                return self.object.mapping == self.reverseMapping;
            }
            else {
                throw new RestError('Cannot use proxy until installed')
            }
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(this, 'isForward', {
        get: function () {
            if (self.object) {
                return self.object.mapping == self.forwardMapping;
            }
            else {
                throw new RestError('Cannot use proxy until installed')
            }
        },
        enumerable: true,
        configurable: true
    });
}

NewObjectProxy.prototype._dump = function (asJson) {
    var dumped = {};
};

NewObjectProxy.prototype.install = function (obj) {
    if (obj) {
        if (!this.object) {
            this.object = obj;
            var self = this;
            var name = getForwardName.call(this);
            Object.defineProperty(obj, name, {
                get: function () {
                    if (self.isFault) {
                        return self.fault;
                    }
                    else {
                        return self.related;
                    }
                },
                set: function (v) {
                    self.set(v);
                },
                configurable: true,
                enumerable: true
            });
            obj[ ('get' + util.capitaliseFirstLetter(name))] = _.bind(this.get, this);
            obj[ ('set' + util.capitaliseFirstLetter(name))] = _.bind(this.set, this);
            obj[name + 'Proxy'] = this;
            if (!obj._proxies) {
                obj._proxies = [];
            }
            obj._proxies.push(this);
        }
        else {
            throw new RestError('Already installed.');
        }
    }
    else {
        throw new RestError('No object passed to relationship install');
    }
};

NewObjectProxy.prototype.set = function (obj) {
    throw new RestError('Must subclass NewObjectProxy');
};

NewObjectProxy.prototype.get = function (callback) {
    throw new RestError('Must subclass NewObjectProxy');
};

// TODO: Share code between getReverseProxyForObject and getForwardProxyForObject

function getReverseProxyForObject(obj) {
    var reverseName = getReverseName.call(this);
    var proxyName = (reverseName + 'Proxy');
    var reverseMapping = this.reverseMapping;
        // This should never happen. Should g   et caught in the mapping operation?
    if (obj.mapping != reverseMapping) {
        var err = 'Mapping does not match.';
        console.error(err, {object: obj, mapping: reverseMapping});
        throw new RestError(err);
    }
    if (util.isArray(obj)) {
        return _.pluck(obj, proxyName);
    }
    else {
        var proxy = obj[proxyName]; 
        if (!proxy) {
            var err = 'No proxy with name "' + proxyName + '" on mapping ' + reverseMapping.type;
            console.error(err, obj);
            throw new RestError(err);
        }
        return proxy;
    }
}

function getForwardProxyForObject(obj) {
    var forwardName = getForwardName.call(this);
    var proxyName = forwardName + 'Proxy';
    var forwardMapping = this.forwardMapping;
    // This should never happen. Should get caught in the mapping operation?
    if (obj.mapping != forwardMapping) {
        var err = 'Mapping does not match.';
        console.error(err, {object: obj, mapping: reverseMapping});
        throw new RestError(err);
    }
    if (util.isArray(obj)) {
        return _.pluck(obj, proxyName);
    }
    else {
        var proxy = obj[proxyName];
        if (!proxy) {
            var err = 'No proxy with name "' + proxyName + '" on mapping ' + forwardMapping.type;
            console.error(err, obj);
            throw new RestError(err);
        }
        return proxy;
    }
}

function getReverseName() {
    return this.isForward ? this.reverseName : this.forwardName;
}

function getForwardName() {
    return this.isForward ? this.forwardName : this.reverseName;
}

function getReverseMapping() {
    return this.isForward ? this.reverseMapping : this.forwardMapping;
}

function getForwardMapping() {
    return this.isForward ? this.forwardMapping : this.reverseMapping;
}

function checkInstalled() {
    if (!this.object) {
        throw new RestError('Proxy must be installed on an object before can use it.');
    }
}

/**
 * Configure _id and related with the new related object.
 * @param obj
 */
function set(obj) {
    registerSetChange.call(this, obj);
    if (obj) {
        if (util.isArray(obj)) {
            this._id = _.pluck(obj, '_id');
            this.related = obj;
        }
        else {
            this._id = obj._id;
            this.related = obj;
        }
    }
    else {
        this._id = null;
        this.related = null;
    }
}

function splice(idx, numRemove) {
    registerSpliceChange.apply(this, arguments);
    var add = Array.prototype.slice.call(arguments, 2);
    var returnValue = _.partial(this._id.splice, idx, numRemove).apply(this._id, _.pluck(add, '_id'));
    if (this.related) {
        _.partial(this.related.splice, idx, numRemove).apply(this.related, add);
    }
    return returnValue;
}

function objAsString(obj) {
    function _objAsString(obj) {
        if (obj) {
            var mapping = obj.mapping;
            var mappingName = mapping.type;
            var ident = obj._id;
            if (typeof ident == 'string') {
                ident = '"' + ident + '"';
            }
            return mappingName + '[_id=' + ident + ']';
        }
        else if (obj === undefined) {
            return 'undefined';
        }
        else if (obj === null) {
            return 'null';
        }
    }

    if (util.isArray(obj)) return _.map(_objAsString, obj).join(', ');
    return _objAsString(obj);
}

function clearReverseRelated() {
    var self = this;
    if (!self.isFault) {
        if (this.related) {
            var reverseProxy = getReverseProxyForObject.call(this, this.related);
            var reverseProxies = util.isArray(reverseProxy) ? reverseProxy : [reverseProxy];
            _.each(reverseProxies, function (p) {
                if (util.isArray(p._id)) {
                    var idx = p._id.indexOf(self.object._id);
                    makeChangesToRelatedWithoutObservations.call(p, function () {
                        splice.call(p, idx, 1);
                    });
                }
                else {
                    set.call(p, null);
                }
            });
        }
    }
    else {
        if (self._id) {
            var reverseName = getReverseName.call(this);
            var reverseMapping = getReverseMapping.call(this);
            var identifiers = util.isArray(self._id) ? self._id : [self._id];
            if (this._reverseIsArray) {
                _.each(identifiers, function (_id) {
                    coreChanges.registerChange({
                        collection: reverseMapping.collection,
                        mapping: reverseMapping.type,
                        _id: _id,
                        field: reverseName,
                        removedId: [self.object._id],
                        removed: [self.object],
                        type: ChangeType.Remove
                    });
                });
            }
            else {
                _.each(identifiers, function (_id) {
                    coreChanges.registerChange({
                        collection: reverseMapping.collection,
                        mapping: reverseMapping.type,
                        _id: _id,
                        field: reverseName,
                        new: null,
                        newId: null,
                        oldId: self.object._id,
                        old: self.object,
                        type: ChangeType.Set
                    });
                });
            }

        }
        else {
            throw new Error(getForwardName.call(this) + ' has no _id');
        }
    }
}

function makeChangesToRelatedWithoutObservations(f) {
    if (this.related) {
        this.related.oneToManyObserver.close();
        this.related.oneToManyObserver = null;
        f();
        wrapArray.call(this, this.related);
    }
    else {
        // If there's a fault we can make changes anyway.
        f();
    }
}

function setReverse(obj) {
    var self = this;
    var reverseProxy = getReverseProxyForObject.call(this, obj);
    var reverseProxies = util.isArray(reverseProxy) ? reverseProxy : [reverseProxy];
    _.each(reverseProxies, function (p) {
        if (util.isArray(p._id)) {
            makeChangesToRelatedWithoutObservations.call(p, function () {
                splice.call(p, p._id.length, 0, self.object);
            });
        }
        else {
            clearReverseRelated.call(p);
            set.call(p, self.object);
        }
    });
}

function registerSetChange(obj) {
    var proxyObject = this.object;
    if (!proxyObject) throw new RestError('Proxy must have an object associated');
    var mapping = proxyObject.mapping.type;
    var coll = proxyObject.collection;
    var newId;
    if (util.isArray(obj)) {
        newId = _.pluck(obj, '_id');
    }
    else {
        newId = obj ? obj._id : obj;
    }
    // We take [] == null == undefined in the case of relationships.
    var oldId = this._id;
    if (util.isArray(oldId) && !oldId.length) {
        oldId = null;
    }
    var old = this.related;
    if (util.isArray(old) && !old.length) {
        old = null;
    }
    coreChanges.registerChange({
        collection: coll,
        mapping: mapping,
        _id: proxyObject._id,
        field: getForwardName.call(this),
        newId: newId,
        oldId: oldId,
        old: old,
        new: obj,
        type: ChangeType.Set
    });
}

function registerSpliceChange(idx, numRemove) {
    var add = Array.prototype.slice.call(arguments, 2);
    var mapping = this.object.mapping.type;
    var coll = this.object.collection;
    coreChanges.registerChange({
        collection: coll,
        mapping: mapping,
        _id: this.object._id,
        field: getForwardName.call(this),
        index: idx,
        removedId: this._id.slice(idx, idx + numRemove),
        removed: this.related ? this.related.slice(idx, idx + numRemove) : null,
        addedId: add.length ? _.pluck(add, '_id') : [],
        added: add.length ? add : [],
        type: ChangeType.Splice
    });
}


function wrapArray(arr) {
    var self = this;
    wrapArrayForAttributes(arr, this.reverseName, this.object);
    if (!arr.oneToManyObserver) {
        arr.oneToManyObserver = new ArrayObserver(arr);
        var observerFunction = function (splices) {
            splices.forEach(function (splice) {
                var added = splice.addedCount ? arr.slice(splice.index, splice.index + splice.addedCount) : [];
                var mapping = getForwardMapping.call(self);
                coreChanges.registerChange({
                    collection: mapping.collection,
                    mapping: mapping,
                    _id: self.object._id,
                    field: getForwardName.call(self),
                    removed: splice.removed,
                    added: added,
                    removedId: _.pluck(splice.removed, '_id'),
                    addedId: _.pluck(splice.added, '_id'),
                    type: ChangeType.Splice
                });
            });
        };
        arr.oneToManyObserver.open(observerFunction);
    }
}

exports.NewObjectProxy = NewObjectProxy;
exports.Fault = Fault;
exports.getReverseProxyForObject = getReverseProxyForObject;
exports.getForwardProxyForObject = getForwardProxyForObject;
exports.getReverseName = getReverseName;
exports.getForwardName = getForwardName;
exports.getReverseMapping = getReverseMapping;
exports.getForwardMapping = getForwardMapping;
exports.checkInstalled = checkInstalled;
exports.set = set;
exports.registerSetChange = registerSetChange;
exports.splice = splice;
exports.clearReverseRelated = clearReverseRelated;
exports.setReverse = setReverse;
exports.objAsString = objAsString;
exports.wrapArray = wrapArray;
exports.registerSpliceChange = registerSpliceChange;
exports.makeChangesToRelatedWithoutObservations = makeChangesToRelatedWithoutObservations;
},{"../vendor/observe-js/src/observe":24,"../vendor/operations.js/src/log":25,"../vendor/operations.js/src/operation":26,"./changes":7,"./error":10,"./misc":14,"./notificationCentre":15,"./query":20,"./store":22,"./util":23}],20:[function(require,module,exports){
var log = require('../vendor/operations.js/src/log');
var cache = require('./cache');
var Logger = log.loggerWithName('Query');
var q = require('q');
var util = require('./util');
Logger.setLevel(log.Level.warn);

function Query(mapping, query) {
    this.mapping = mapping;
    this.query = query;
}

/**
 * If the storage extension is enabled, objects may be faulted and so we need to query via PouchDB. The storage
 * extension provides the RawQuery class to enable this.
 * @param callback
 * @private
 */
function _executeUsingStorageExtension(callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    var storageExtension = siesta.ext.storage;
    var RawQuery = storageExtension.RawQuery;
    var Pouch = storageExtension.Pouch;
    var rawQuery = new RawQuery(this.mapping.collection, this.mapping.type, this.query);
    rawQuery.execute(function (err, results) {
        if (err) {
            callback(err);
        }
        else {
            if (Logger.debug.isEnabled)
                Logger.debug('got results', results);
            if (callback) callback(null, Pouch.toSiesta(results));
        }
    });
    return deferred.promise;
}

/**
 * Returns true if the given object matches the query.
 * @param {SiestaModel} obj
 * @returns {boolean}
 */
function objectMatchesQuery(obj) {
    var fields = Object.keys(this.query);
    for (var i=0; i<fields.length; i++) {
        var field = fields[i];
       if (obj[field] != this.query[field]) {
           return false;
       }
    }
    return true;
}

/**
 * If the storage extension is not enabled, we simply cycle through all objects of the type requested in memory.
 * @param callback
 * @private
 */
function _executeInMemory(callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    var cacheByType = cache._localCacheByType;
    var mappingName = this.mapping.type;
    var collectionName = this.mapping.collection;
    var cacheByMapping = cacheByType[collectionName];
    var cacheByLocalId;
    if (cacheByMapping) {
        cacheByLocalId = cacheByMapping[mappingName];
    }
    if (cacheByLocalId) {
        var keys = Object.keys(cacheByLocalId);
        var self = this;
        var matches = _.reduce(keys, function (memo, k) {
            var obj = cacheByLocalId[k];
            if (objectMatchesQuery.call(self, obj)) memo.push(obj);
            return memo;
        }, []);
        if (callback) callback(null, matches);
    }
    else if (callback) {
        callback(null, []);
    }
    return deferred.promise;
}

Query.prototype.execute = function (callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    if (siesta.ext.storageEnabled) {
        _executeUsingStorageExtension.call(this, callback);
    }
    else {
        _executeInMemory.call(this, callback);
    }
    return deferred.promise;
};

Query.prototype._dump = function (asJson) {
    // TODO
    return asJson ? '{}' : {};
};

exports.Query = Query;



},{"../vendor/operations.js/src/log":25,"./cache":6,"./util":23,"q":5}],21:[function(require,module,exports){
var RestError = require('./error').RestError;
var Store = require('./store');
var q = require('q');


RelationshipType = {
    OneToMany: 'OneToMany',
    OneToOne: 'OneToOne',
    ManyToMany: 'ManyToMany'
};

function RelatedObjectProxy(relationship, object) {
    this.relationship = relationship;
    this.object = object;
    this._id = null;
    this.relatedObject = null;
}

RelatedObjectProxy.prototype.get = function (callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    var self = this;
    this.relationship.getRelated(this.object, function (err, related) {
        if (!err) {
            self.relatedObject = related;
        }
        if (callback) callback(err, related);
    });
    return deferred.promise;
};

RelatedObjectProxy.prototype.set = function (obj, callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    this.relationship.setRelated(this.object, obj, callback);
    return deferred.promise;
};

RelatedObjectProxy.prototype.remove = function (obj, callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    this.relationship.removeRelated(this.object, obj, callback);
    return deferred.promise;
};

RelatedObjectProxy.prototype.add = function (obj, callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    this.relationship.addRelated(this.object, obj, callback);
    return deferred.promise;
};

RelatedObjectProxy.prototype.isFault = function () {
    if (this._id) {
        return !this.relatedObject;
    }
    return false; // If no object is related then implicitly this is not a fault.
};


function Relationship(name, reverseName, mapping, reverseMapping) {
    if (!this) {
        return new Relationship(name, reverseName, mapping, reverseMapping);
    }
    var self = this;
    this.mapping = mapping;
    this.name = name;
    this._reverseName = reverseName;
    Object.defineProperty(this, 'reverseName', {
        get: function () {
            if (self._reverseName) {
                return self._reverseName;
            }
            else {
                return 'reverse_' + self.name;
            }
        }
    });
    this.reverseMapping = reverseMapping;
}

//noinspection JSUnusedLocalSymbols
Relationship.prototype.getRelated = function (obj, callback) {
    throw Error('Relationship.getRelated must be overridden');
};

//noinspection JSUnusedLocalSymbols
Relationship.prototype.setRelated = function (obj, related, callback) {
    throw Error('Relationship.setRelated must be overridden');
};

Relationship.prototype.isForward = function (obj) {
    return obj.mapping === this.mapping;
};

Relationship.prototype.isReverse = function (obj) {
    return obj.mapping === this.reverseMapping;
};

Relationship.prototype.contributeToSiestaModel = function (obj) {
    if (this.isForward(obj)) {
        obj[this.name] = new RelatedObjectProxy(this, obj);
    }
    else if (this.isReverse(obj)) {
        obj[this.reverseName] = new RelatedObjectProxy(this, obj);
    }
    else {
        throw new RestError('Cannot contribute to object as this relationship has neither a forward or reverse mapping that matches', {relationship: this, obj: obj});
    }
};

Relationship.prototype.setRelatedById = function (obj, relatedId, callback) {
    var self = this;
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    Store.get({_id: relatedId}, function (err, related) {
        if (err) {
            callback(err);
        }
        else {
            self.setRelated(obj, related, function () {
                if (callback) callback();
            });
        }
    });
    return deferred.promise;
};

Relationship.prototype._dump = function (asJSON) {
    var obj = {};
    obj.forward = {
        name: this.name,
        mapping: this.mapping.type
    };
    obj.reverse = {
        name: this.reverseName,
        mapping: this.reverseMapping.type
    };
    return asJSON ? JSON.stringify(obj, null, 4) : obj;
};


exports.Relationship = Relationship;
exports.RelatedObjectProxy = RelatedObjectProxy;
exports.RelationshipType = RelationshipType;
},{"./error":10,"./store":22,"q":5}],22:[function(require,module,exports){
var wrappedCallback = require('./misc').wrappedCallback;
var RestError = require('./error').RestError;
var log = require('../vendor/operations.js/src/log');
var Logger = log.loggerWithName('Store');
Logger.setLevel(log.Level.warn);

var util = require('./util');
var _ = util._;
var cache = require('./cache');
var q = require('q');


function get(opts, callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    if (Logger.debug.isEnabled)
        Logger.debug('get', opts);
    var siestaModel;
    if (opts._id) {
        if (util.isArray(opts._id)) {
            // Proxy onto getMultiple instead.
            getMultiple(_.map(opts._id, function (id) {return {_id: id}}), callback);
        }
        else {
            siestaModel = cache.get(opts);
            if (siestaModel) {
                if (Logger.debug.isEnabled)
                    Logger.debug('Had cached object', {opts: opts, obj: siestaModel});
                wrappedCallback(callback)(null, siestaModel);
            }
            else {
                if (util.isArray(opts._id)) {
                    // Proxy onto getMultiple instead.
                    getMultiple(_.map(opts._id, function (id) {return {_id: id}}), callback);
                }
                else if (callback) {
                    var storage = siesta.ext.storage;
                    if (storage) {
                        storage.store.getFromPouch(opts, callback);
                    }
                    else {
                        throw 'Storage module not installed'
                    }
                }
            }
        }
    }
    else if (opts.mapping) {
        if (util.isArray(opts[opts.mapping.id])) {
            // Proxy onto getMultiple instead.
            getMultiple(_.map(opts[opts.mapping.id], function (id) {
                var o = {};
                o[opts.mapping.id] = id;
                o.mapping = opts.mapping;
                return o
            }), callback);
        }
        else {
            siestaModel = cache.get(opts);
            if (siestaModel) {
                if (Logger.debug.isEnabled)
                    Logger.debug('Had cached object', {opts: opts, obj: siestaModel});
                wrappedCallback(callback)(null, siestaModel);
            }
            else {
                var mapping = opts.mapping;
                if (mapping.singleton) {
                    mapping.get(callback);
                }
                else {
                    var idField = mapping.id;
                    var id = opts[idField];
                    if (id) {
                        mapping.get(id, function (err, obj) {
                            if (!err) {
                                if (obj) {
                                    callback(null, obj);
                                }
                                else {
                                    callback(null, null);
                                }
                            }
                            else {
                                callback(err);
                            }
                        });
                    }
                    else {
                        wrappedCallback(callback)(new RestError('Invalid options given to store. Missing "' + idField.toString() + '."', {opts: opts}));
                    }
                }

            }
        }
    }
    else {
        // No way in which to find an object locally.
        var context = {opts: opts};
        var msg = 'Invalid options given to store';
        Logger.error(msg, context);
        wrappedCallback(callback)(new RestError(msg, context));
    }
    return deferred.promise;
}

function getMultiple(optsArray, callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    var docs = [];
    var errors = [];
    _.each(optsArray, function (opts) {
        get(opts, function (err, doc) {
            if (err) {
                errors.push(err);
            }
            else {
                docs.push(doc);
            }
            if (docs.length + errors.length == optsArray.length) {
                if (callback) {
                    if (errors.length) {
                        callback(errors);
                    }
                    else {
                        callback(null, docs);
                    }
                }
            }
        });
    });
    return deferred.promise;
}
/**
 * Uses pouch bulk fetch API. Much faster than getMultiple.
 * @param localIdentifiers
 * @param callback
 */
function getMultipleLocal (localIdentifiers, callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    var results = _.reduce(localIdentifiers, function (memo, _id) {
        var obj = cache.get({_id: _id});
        if (obj) {
            memo.cached[_id] = obj;
        }
        else {
            memo.notCached.push(_id);
        }
        return memo;
    }, {cached: {}, notCached: []});

    function finish(err) {
        if (callback) {
            if (err) {
                callback(err);
            }
            else {
                callback(null, _.map(localIdentifiers, function (_id) {
                    return results.cached[_id];
                }));
            }
        }
    }

    if (results.notCached.length) {
        siesta.ext.storage.store.getMultipleLocalFromCouch(results, finish);
    }
    else {
        finish();
    }
    return deferred.promise;
}

function getMultipleRemote (remoteIdentifiers, mapping, callback) {
    var deferred = q.defer();
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    var results = _.reduce(remoteIdentifiers, function (memo, id) {
        var cacheQuery = {mapping: mapping};
        cacheQuery[mapping.id] = id;
        var obj = cache.get(cacheQuery);
        if (obj) {
            memo.cached[id] = obj;
        }
        else {
            memo.notCached.push(id);
        }
        return memo;
    }, {cached: {}, notCached: []});

    function finish(err) {
        if (callback) {
            if (err) {
                callback(err);
            }
            else {
                callback(null, _.map(remoteIdentifiers, function (id) {
                    return results.cached[id];
                }));
            }
        }
    }

    if (results.notCached.length) {
        siesta.ext.storage.store.getMultipleRemoteFrompouch(mapping, remoteIdentifiers, results, finish);
    }
    else {
        finish();
    }
    return deferred.promise;
}

exports.get = get;
exports.getMultiple = getMultiple;
exports.getMultipleLocal = getMultipleLocal;
exports.getMultipleRemote = getMultipleRemote;
},{"../vendor/operations.js/src/log":25,"./cache":6,"./error":10,"./misc":14,"./util":23,"q":5}],23:[function(require,module,exports){
/* util.js
 * =======
 *
 * This is a collection of utilities taken from libraries such as async.js, underscore.js etc.
 * This is to avoid bloating siesta.js.
 */

function printStackTrace() {
    var e = new Error('printStackTrace');
    var stack = e.stack;
    console.log(stack);
}

function capitaliseFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

exports.printStackTrace = printStackTrace;
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
        return {index: i, value: x};
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
        }
        else {
            completed += 1;
            if (completed >= arr.length) {
                callback();
            }
        }
    }
}

function keys(obj) {
    if (Object.keys) {
        return Object.keys(obj);
    }
    var keys = [];
    for (var k in obj) {
        if (obj.hasOwnProperty(k)) {
            keys.push(k);
        }
    }
    return keys;
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
    }
    else {
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


function only_once(fn) {
    var called = false;
    return function () {
        if (called) throw new Error("Callback was already called.");
        called = true;
        fn.apply(root, arguments);
    }
}

exports.parallel = function (tasks, callback) {
    _parallel({ map: map, each: each }, tasks, callback);
};

exports.isArray = isArray;

// END async.js //

// START underscore.js //

var _ = {};
var ArrayProto = Array.prototype;
var FuncProto = Function.prototype;

var nativeForEach = ArrayProto.forEach;
var nativeMap = ArrayProto.map;
var nativeReduce = ArrayProto.reduce;
var nativeBind = FuncProto.bind;
var slice = ArrayProto.slice;
var breaker = {};

_.keys = keys;

_.each = _.forEach = function (obj, iterator, context) {
    if (obj == null) return obj;
    if (nativeForEach && obj.forEach === nativeForEach) {
        obj.forEach(iterator, context);
    } else if (obj.length === +obj.length) {
        for (var i = 0, length = obj.length; i < length; i++) {
            if (iterator.call(context, obj[i], i, obj) === breaker) return;
        }
    } else {
        var keys = _.keys(obj);
        for (var i = 0, length = keys.length; i < length; i++) {
            if (iterator.call(context, obj[keys[i]], keys[i], obj) === breaker) return;
        }
    }
    return obj;
};

// Return the results of applying the iterator to each element.
// Delegates to **ECMAScript 5**'s native `map` if available.
_.map = _.collect = function (obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);
    _.each(obj, function (value, index, list) {
        results.push(iterator.call(context, value, index, list));
    });
    return results;
};

// Partially apply a function by creating a version that has had some of its
// arguments pre-filled, without changing its dynamic `this` context. _ acts
// as a placeholder, allowing any combination of arguments to be pre-filled.
_.partial = function (func) {
    var boundArgs = slice.call(arguments, 1);
    return function () {
        var position = 0;
        var args = boundArgs.slice();
        for (var i = 0, length = args.length; i < length; i++) {
            if (args[i] === _) args[i] = arguments[position++];
        }
        while (position < arguments.length) args.push(arguments[position++]);
        return func.apply(this, args);
    };
};

// Convenience version of a common use case of `map`: fetching a property.
_.pluck = function (obj, key) {
    return _.map(obj, _.property(key));
};

var reduceError = 'Reduce of empty array with no initial value';

// **Reduce** builds up a single result from a list of values, aka `inject`,
// or `foldl`. Delegates to **ECMAScript 5**'s native `reduce` if available.
_.reduce = _.foldl = _.inject = function (obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduce && obj.reduce === nativeReduce) {
        if (context) iterator = _.bind(iterator, context);
        return initial ? obj.reduce(iterator, memo) : obj.reduce(iterator);
    }
    _.each(obj, function (value, index, list) {
        if (!initial) {
            memo = value;
            initial = true;
        } else {
            memo = iterator.call(context, memo, value, index, list);
        }
    });
    if (!initial) throw new TypeError(reduceError);
    return memo;
};

_.property = function (key) {
    return function (obj) {
        return obj[key];
    };
};

// Optimize `isFunction` if appropriate.
if (typeof (/./) !== 'function') {
    _.isFunction = function (obj) {
        return typeof obj === 'function';
    };
}

// An internal function to generate lookup iterators.
var lookupIterator = function (value) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return value;
    return _.property(value);
};

// Sort the object's values by a criterion produced by an iterator.
_.sortBy = function (obj, iterator, context) {
    iterator = lookupIterator(iterator);
    return _.pluck(_.map(obj, function (value, index, list) {
        return {
            value: value,
            index: index,
            criteria: iterator.call(context, value, index, list)
        };
    }).sort(function (left, right) {
        var a = left.criteria;
        var b = right.criteria;
        if (a !== b) {
            if (a > b || a === void 0) return 1;
            if (a < b || b === void 0) return -1;
        }
        return left.index - right.index;
    }), 'value');
};

var ctor = function(){};

// Create a function bound to a given object (assigning `this`, and arguments,
// optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
// available.
_.bind = function (func, context) {
    var args, bound;
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError;
    args = slice.call(arguments, 2);
    return bound = function () {
        if (!(this instanceof bound)) return func.apply(context, args.concat(slice.call(arguments)));
        ctor.prototype = func.prototype;
        var self = new ctor;
        ctor.prototype = null;
        var result = func.apply(self, args.concat(slice.call(arguments)));
        if (Object(result) === result) return result;
        return self;
    };
};


// END underscore.js //

exports._ = _;


var observe = require('../vendor/observe-js/src/observe').Platform;

/**
 * Performs dirty check/Object.observe callbacks depending on the browser.
 *
 * If Object.observe is present,
 * @param callback
 */
exports.next = function (callback) {
    observe.performMicrotaskCheckpoint();
    setTimeout(callback);
};

/**
 * Returns a handler that acts upon a callback or a promise depending on the result of a different callback.
 * @param callback
 * @param [promise]
 * @returns {Function}
 */
exports.constructCallbackAndPromiseHandler = function (callback, promise) {
    return function (err) {
        if (callback) callback.apply(callback, arguments);
        if (promise) {
            if (err) promise.reject(err);
            else promise.resolve.apply(promise, Array.prototype.slice.call(arguments, 1));
        }
    };
};
},{"../vendor/observe-js/src/observe":24}],24:[function(require,module,exports){
(function (global){
/*
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

(function(global) {
  'use strict';

  var testingExposeCycleCount = global.testingExposeCycleCount;

  // Detect and do basic sanity checking on Object/Array.observe.
  function detectObjectObserve() {
    if (typeof Object.observe !== 'function' ||
        typeof Array.observe !== 'function') {
      return false;
    }

    var records = [];

    function callback(recs) {
      records = recs;
    }

    var test = {};
    var arr = [];
    Object.observe(test, callback);
    Array.observe(arr, callback);
    test.id = 1;
    test.id = 2;
    delete test.id;
    arr.push(1, 2);
    arr.length = 0;

    Object.deliverChangeRecords(callback);
    if (records.length !== 5)
      return false;

    if (records[0].type != 'add' ||
        records[1].type != 'update' ||
        records[2].type != 'delete' ||
        records[3].type != 'splice' ||
        records[4].type != 'splice') {
      return false;
    }

    Object.unobserve(test, callback);
    Array.unobserve(arr, callback);

    return true;
  }

  var hasObserve = detectObjectObserve();

  function detectEval() {
    // Don't test for eval if we're running in a Chrome App environment.
    // We check for APIs set that only exist in a Chrome App context.
    if (typeof chrome !== 'undefined' && chrome.app && chrome.app.runtime) {
      return false;
    }

    // Firefox OS Apps do not allow eval. This feature detection is very hacky
    // but even if some other platform adds support for this function this code
    // will continue to work.
    if (navigator.getDeviceStorage) {
      return false;
    }

    try {
      var f = new Function('', 'return true;');
      return f();
    } catch (ex) {
      return false;
    }
  }

  var hasEval = detectEval();

  function isIndex(s) {
    return +s === s >>> 0 && s !== '';
  }

  function toNumber(s) {
    return +s;
  }

  function isObject(obj) {
    return obj === Object(obj);
  }

  var numberIsNaN = global.Number.isNaN || function(value) {
    return typeof value === 'number' && global.isNaN(value);
  }

  function areSameValue(left, right) {
    if (left === right)
      return left !== 0 || 1 / left === 1 / right;
    if (numberIsNaN(left) && numberIsNaN(right))
      return true;

    return left !== left && right !== right;
  }

  var createObject = ('__proto__' in {}) ?
    function(obj) { return obj; } :
    function(obj) {
      var proto = obj.__proto__;
      if (!proto)
        return obj;
      var newObject = Object.create(proto);
      Object.getOwnPropertyNames(obj).forEach(function(name) {
        Object.defineProperty(newObject, name,
                             Object.getOwnPropertyDescriptor(obj, name));
      });
      return newObject;
    };

  var identStart = '[\$_a-zA-Z]';
  var identPart = '[\$_a-zA-Z0-9]';
  var identRegExp = new RegExp('^' + identStart + '+' + identPart + '*' + '$');

  function getPathCharType(char) {
    if (char === undefined)
      return 'eof';

    var code = char.charCodeAt(0);

    switch(code) {
      case 0x5B: // [
      case 0x5D: // ]
      case 0x2E: // .
      case 0x22: // "
      case 0x27: // '
      case 0x30: // 0
        return char;

      case 0x5F: // _
      case 0x24: // $
        return 'ident';

      case 0x20: // Space
      case 0x09: // Tab
      case 0x0A: // Newline
      case 0x0D: // Return
      case 0xA0:  // No-break space
      case 0xFEFF:  // Byte Order Mark
      case 0x2028:  // Line Separator
      case 0x2029:  // Paragraph Separator
        return 'ws';
    }

    // a-z, A-Z
    if ((0x61 <= code && code <= 0x7A) || (0x41 <= code && code <= 0x5A))
      return 'ident';

    // 1-9
    if (0x31 <= code && code <= 0x39)
      return 'number';

    return 'else';
  }

  var pathStateMachine = {
    'beforePath': {
      'ws': ['beforePath'],
      'ident': ['inIdent', 'append'],
      '[': ['beforeElement'],
      'eof': ['afterPath']
    },

    'inPath': {
      'ws': ['inPath'],
      '.': ['beforeIdent'],
      '[': ['beforeElement'],
      'eof': ['afterPath']
    },

    'beforeIdent': {
      'ws': ['beforeIdent'],
      'ident': ['inIdent', 'append']
    },

    'inIdent': {
      'ident': ['inIdent', 'append'],
      '0': ['inIdent', 'append'],
      'number': ['inIdent', 'append'],
      'ws': ['inPath', 'push'],
      '.': ['beforeIdent', 'push'],
      '[': ['beforeElement', 'push'],
      'eof': ['afterPath', 'push']
    },

    'beforeElement': {
      'ws': ['beforeElement'],
      '0': ['afterZero', 'append'],
      'number': ['inIndex', 'append'],
      "'": ['inSingleQuote', 'append', ''],
      '"': ['inDoubleQuote', 'append', '']
    },

    'afterZero': {
      'ws': ['afterElement', 'push'],
      ']': ['inPath', 'push']
    },

    'inIndex': {
      '0': ['inIndex', 'append'],
      'number': ['inIndex', 'append'],
      'ws': ['afterElement'],
      ']': ['inPath', 'push']
    },

    'inSingleQuote': {
      "'": ['afterElement'],
      'eof': ['error'],
      'else': ['inSingleQuote', 'append']
    },

    'inDoubleQuote': {
      '"': ['afterElement'],
      'eof': ['error'],
      'else': ['inDoubleQuote', 'append']
    },

    'afterElement': {
      'ws': ['afterElement'],
      ']': ['inPath', 'push']
    }
  }

  function noop() {}

  function parsePath(path) {
    var keys = [];
    var index = -1;
    var c, newChar, key, type, transition, action, typeMap, mode = 'beforePath';

    var actions = {
      push: function() {
        if (key === undefined)
          return;

        keys.push(key);
        key = undefined;
      },

      append: function() {
        if (key === undefined)
          key = newChar
        else
          key += newChar;
      }
    };

    function maybeUnescapeQuote() {
      if (index >= path.length)
        return;

      var nextChar = path[index + 1];
      if ((mode == 'inSingleQuote' && nextChar == "'") ||
          (mode == 'inDoubleQuote' && nextChar == '"')) {
        index++;
        newChar = nextChar;
        actions.append();
        return true;
      }
    }

    while (mode) {
      index++;
      c = path[index];

      if (c == '\\' && maybeUnescapeQuote(mode))
        continue;

      type = getPathCharType(c);
      typeMap = pathStateMachine[mode];
      transition = typeMap[type] || typeMap['else'] || 'error';

      if (transition == 'error')
        return; // parse error;

      mode = transition[0];
      action = actions[transition[1]] || noop;
      newChar = transition[2] === undefined ? c : transition[2];
      action();

      if (mode === 'afterPath') {
        return keys;
      }
    }

    return; // parse error
  }

  function isIdent(s) {
    return identRegExp.test(s);
  }

  var constructorIsPrivate = {};

  function Path(parts, privateToken) {
    if (privateToken !== constructorIsPrivate)
      throw Error('Use Path.get to retrieve path objects');

    for (var i = 0; i < parts.length; i++) {
      this.push(String(parts[i]));
    }

    if (hasEval && this.length) {
      this.getValueFrom = this.compiledGetValueFromFn();
    }
  }

  // TODO(rafaelw): Make simple LRU cache
  var pathCache = {};

  function getPath(pathString) {
    if (pathString instanceof Path)
      return pathString;

    if (pathString == null || pathString.length == 0)
      pathString = '';

    if (typeof pathString != 'string') {
      if (isIndex(pathString.length)) {
        // Constructed with array-like (pre-parsed) keys
        return new Path(pathString, constructorIsPrivate);
      }

      pathString = String(pathString);
    }

    var path = pathCache[pathString];
    if (path)
      return path;

    var parts = parsePath(pathString);
    if (!parts)
      return invalidPath;

    var path = new Path(parts, constructorIsPrivate);
    pathCache[pathString] = path;
    return path;
  }

  Path.get = getPath;

  function formatAccessor(key) {
    if (isIndex(key)) {
      return '[' + key + ']';
    } else {
      return '["' + key.replace(/"/g, '\\"') + '"]';
    }
  }

  Path.prototype = createObject({
    __proto__: [],
    valid: true,

    toString: function() {
      var pathString = '';
      for (var i = 0; i < this.length; i++) {
        var key = this[i];
        if (isIdent(key)) {
          pathString += i ? '.' + key : key;
        } else {
          pathString += formatAccessor(key);
        }
      }

      return pathString;
    },

    getValueFrom: function(obj, directObserver) {
      for (var i = 0; i < this.length; i++) {
        if (obj == null)
          return;
        obj = obj[this[i]];
      }
      return obj;
    },

    iterateObjects: function(obj, observe) {
      for (var i = 0; i < this.length; i++) {
        if (i)
          obj = obj[this[i - 1]];
        if (!isObject(obj))
          return;
        observe(obj, this[0]);
      }
    },

    compiledGetValueFromFn: function() {
      var str = '';
      var pathString = 'obj';
      str += 'if (obj != null';
      var i = 0;
      var key;
      for (; i < (this.length - 1); i++) {
        key = this[i];
        pathString += isIdent(key) ? '.' + key : formatAccessor(key);
        str += ' &&\n     ' + pathString + ' != null';
      }
      str += ')\n';

      var key = this[i];
      pathString += isIdent(key) ? '.' + key : formatAccessor(key);

      str += '  return ' + pathString + ';\nelse\n  return undefined;';
      return new Function('obj', str);
    },

    setValueFrom: function(obj, value) {
      if (!this.length)
        return false;

      for (var i = 0; i < this.length - 1; i++) {
        if (!isObject(obj))
          return false;
        obj = obj[this[i]];
      }

      if (!isObject(obj))
        return false;

      obj[this[i]] = value;
      return true;
    }
  });

  var invalidPath = new Path('', constructorIsPrivate);
  invalidPath.valid = false;
  invalidPath.getValueFrom = invalidPath.setValueFrom = function() {};

  var MAX_DIRTY_CHECK_CYCLES = 1000;

  function dirtyCheck(observer) {
    var cycles = 0;
    while (cycles < MAX_DIRTY_CHECK_CYCLES && observer.check_()) {
      cycles++;
    }
    if (testingExposeCycleCount)
      global.dirtyCheckCycleCount = cycles;

    return cycles > 0;
  }

  function objectIsEmpty(object) {
    for (var prop in object)
      return false;
    return true;
  }

  function diffIsEmpty(diff) {
    return objectIsEmpty(diff.added) &&
           objectIsEmpty(diff.removed) &&
           objectIsEmpty(diff.changed);
  }

  function diffObjectFromOldObject(object, oldObject) {
    var added = {};
    var removed = {};
    var changed = {};

    for (var prop in oldObject) {
      var newValue = object[prop];

      if (newValue !== undefined && newValue === oldObject[prop])
        continue;

      if (!(prop in object)) {
        removed[prop] = undefined;
        continue;
      }

      if (newValue !== oldObject[prop])
        changed[prop] = newValue;
    }

    for (var prop in object) {
      if (prop in oldObject)
        continue;

      added[prop] = object[prop];
    }

    if (Array.isArray(object) && object.length !== oldObject.length)
      changed.length = object.length;

    return {
      added: added,
      removed: removed,
      changed: changed
    };
  }

  var eomTasks = [];
  function runEOMTasks() {
    if (!eomTasks.length)
      return false;

    for (var i = 0; i < eomTasks.length; i++) {
      eomTasks[i]();
    }
    eomTasks.length = 0;
    return true;
  }

  var runEOM = hasObserve ? (function(){
    var eomObj = { pingPong: true };
    var eomRunScheduled = false;

    Object.observe(eomObj, function() {
      runEOMTasks();
      eomRunScheduled = false;
    });

    return function(fn) {
      eomTasks.push(fn);
      if (!eomRunScheduled) {
        eomRunScheduled = true;
        eomObj.pingPong = !eomObj.pingPong;
      }
    };
  })() :
  (function() {
    return function(fn) {
      eomTasks.push(fn);
    };
  })();

  var observedObjectCache = [];

  function newObservedObject() {
    var observer;
    var object;
    var discardRecords = false;
    var first = true;

    function callback(records) {
      if (observer && observer.state_ === OPENED && !discardRecords)
        observer.check_(records);
    }

    return {
      open: function(obs) {
        if (observer)
          throw Error('ObservedObject in use');

        if (!first)
          Object.deliverChangeRecords(callback);

        observer = obs;
        first = false;
      },
      observe: function(obj, arrayObserve) {
        object = obj;
        if (arrayObserve)
          Array.observe(object, callback);
        else
          Object.observe(object, callback);
      },
      deliver: function(discard) {
        discardRecords = discard;
        Object.deliverChangeRecords(callback);
        discardRecords = false;
      },
      close: function() {
        observer = undefined;
        Object.unobserve(object, callback);
        observedObjectCache.push(this);
      }
    };
  }

  /*
   * The observedSet abstraction is a perf optimization which reduces the total
   * number of Object.observe observations of a set of objects. The idea is that
   * groups of Observers will have some object dependencies in common and this
   * observed set ensures that each object in the transitive closure of
   * dependencies is only observed once. The observedSet acts as a write barrier
   * such that whenever any change comes through, all Observers are checked for
   * changed values.
   *
   * Note that this optimization is explicitly moving work from setup-time to
   * change-time.
   *
   * TODO(rafaelw): Implement "garbage collection". In order to move work off
   * the critical path, when Observers are closed, their observed objects are
   * not Object.unobserve(d). As a result, it'siesta possible that if the observedSet
   * is kept open, but some Observers have been closed, it could cause "leaks"
   * (prevent otherwise collectable objects from being collected). At some
   * point, we should implement incremental "gc" which keeps a list of
   * observedSets which may need clean-up and does small amounts of cleanup on a
   * timeout until all is clean.
   */

  function getObservedObject(observer, object, arrayObserve) {
    var dir = observedObjectCache.pop() || newObservedObject();
    dir.open(observer);
    dir.observe(object, arrayObserve);
    return dir;
  }

  var observedSetCache = [];

  function newObservedSet() {
    var observerCount = 0;
    var observers = [];
    var objects = [];
    var rootObj;
    var rootObjProps;

    function observe(obj, prop) {
      if (!obj)
        return;

      if (obj === rootObj)
        rootObjProps[prop] = true;

      if (objects.indexOf(obj) < 0) {
        objects.push(obj);
        Object.observe(obj, callback);
      }

      observe(Object.getPrototypeOf(obj), prop);
    }

    function allRootObjNonObservedProps(recs) {
      for (var i = 0; i < recs.length; i++) {
        var rec = recs[i];
        if (rec.object !== rootObj ||
            rootObjProps[rec.name] ||
            rec.type === 'setPrototype') {
          return false;
        }
      }
      return true;
    }

    function callback(recs) {
      if (allRootObjNonObservedProps(recs))
        return;

      var observer;
      for (var i = 0; i < observers.length; i++) {
        observer = observers[i];
        if (observer.state_ == OPENED) {
          observer.iterateObjects_(observe);
        }
      }

      for (var i = 0; i < observers.length; i++) {
        observer = observers[i];
        if (observer.state_ == OPENED) {
          observer.check_();
        }
      }
    }

    var record = {
      object: undefined,
      objects: objects,
      open: function(obs, object) {
        if (!rootObj) {
          rootObj = object;
          rootObjProps = {};
        }

        observers.push(obs);
        observerCount++;
        obs.iterateObjects_(observe);
      },
      close: function(obs) {
        observerCount--;
        if (observerCount > 0) {
          return;
        }

        for (var i = 0; i < objects.length; i++) {
          Object.unobserve(objects[i], callback);
          Observer.unobservedCount++;
        }

        observers.length = 0;
        objects.length = 0;
        rootObj = undefined;
        rootObjProps = undefined;
        observedSetCache.push(this);
      }
    };

    return record;
  }

  var lastObservedSet;

  function getObservedSet(observer, obj) {
    if (!lastObservedSet || lastObservedSet.object !== obj) {
      lastObservedSet = observedSetCache.pop() || newObservedSet();
      lastObservedSet.object = obj;
    }
    lastObservedSet.open(observer, obj);
    return lastObservedSet;
  }

  var UNOPENED = 0;
  var OPENED = 1;
  var CLOSED = 2;
  var RESETTING = 3;

  var nextObserverId = 1;

  function Observer() {
    this.state_ = UNOPENED;
    this.callback_ = undefined;
    this.target_ = undefined; // TODO(rafaelw): Should be WeakRef
    this.directObserver_ = undefined;
    this.value_ = undefined;
    this.id_ = nextObserverId++;
  }

  Observer.prototype = {
    open: function(callback, target) {
      if (this.state_ != UNOPENED)
        throw Error('Observer has already been opened.');

      addToAll(this);
      this.callback_ = callback;
      this.target_ = target;
      this.connect_();
      this.state_ = OPENED;
      return this.value_;
    },

    close: function() {
      if (this.state_ != OPENED)
        return;

      removeFromAll(this);
      this.disconnect_();
      this.value_ = undefined;
      this.callback_ = undefined;
      this.target_ = undefined;
      this.state_ = CLOSED;
    },

    deliver: function() {
      if (this.state_ != OPENED)
        return;

      dirtyCheck(this);
    },

    report_: function(changes) {
      try {
        this.callback_.apply(this.target_, changes);
      } catch (ex) {
        Observer._errorThrownDuringCallback = true;
        console.error('Exception caught during observer callback: ' +
                       (ex.stack || ex));
      }
    },

    discardChanges: function() {
      this.check_(undefined, true);
      return this.value_;
    }
  }

  var collectObservers = !hasObserve;
  var allObservers;
  Observer._allObserversCount = 0;

  if (collectObservers) {
    allObservers = [];
  }

  function addToAll(observer) {
    Observer._allObserversCount++;
    if (!collectObservers)
      return;

    allObservers.push(observer);
  }

  function removeFromAll(observer) {
    Observer._allObserversCount--;
  }

  var runningMicrotaskCheckpoint = false;

  var hasDebugForceFullDelivery = hasObserve && hasEval && (function() {
    try {
      eval('%RunMicrotasks()');
      return true;
    } catch (ex) {
      return false;
    }
  })();

  global.Platform = global.Platform || {};

  global.Platform.performMicrotaskCheckpoint = function() {
    if (runningMicrotaskCheckpoint)
      return;

    if (hasDebugForceFullDelivery) {
      eval('%RunMicrotasks()');
      return;
    }

    if (!collectObservers)
      return;

    runningMicrotaskCheckpoint = true;

    var cycles = 0;
    var anyChanged, toCheck;

    do {
      cycles++;
      toCheck = allObservers;
      allObservers = [];
      anyChanged = false;

      for (var i = 0; i < toCheck.length; i++) {
        var observer = toCheck[i];
        if (observer.state_ != OPENED)
          continue;

        if (observer.check_())
          anyChanged = true;

        allObservers.push(observer);
      }
      if (runEOMTasks())
        anyChanged = true;
    } while (cycles < MAX_DIRTY_CHECK_CYCLES && anyChanged);

    if (testingExposeCycleCount)
      global.dirtyCheckCycleCount = cycles;

    runningMicrotaskCheckpoint = false;
  };

  if (collectObservers) {
    global.Platform.clearObservers = function() {
      allObservers = [];
    };
  }

  function ObjectObserver(object) {
    Observer.call(this);
    this.value_ = object;
    this.oldObject_ = undefined;
  }

  ObjectObserver.prototype = createObject({
    __proto__: Observer.prototype,

    arrayObserve: false,

    connect_: function(callback, target) {
      if (hasObserve) {
        this.directObserver_ = getObservedObject(this, this.value_,
                                                 this.arrayObserve);
      } else {
        this.oldObject_ = this.copyObject(this.value_);
      }

    },

    copyObject: function(object) {
      var copy = Array.isArray(object) ? [] : {};
      for (var prop in object) {
        copy[prop] = object[prop];
      };
      if (Array.isArray(object))
        copy.length = object.length;
      return copy;
    },

    check_: function(changeRecords, skipChanges) {
      var diff;
      var oldValues;
      if (hasObserve) {
        if (!changeRecords)
          return false;

        oldValues = {};
        diff = diffObjectFromChangeRecords(this.value_, changeRecords,
                                           oldValues);
      } else {
        oldValues = this.oldObject_;
        diff = diffObjectFromOldObject(this.value_, this.oldObject_);
      }

      if (diffIsEmpty(diff))
        return false;

      if (!hasObserve)
        this.oldObject_ = this.copyObject(this.value_);

      this.report_([
        diff.added || {},
        diff.removed || {},
        diff.changed || {},
        function(property) {
          return oldValues[property];
        }
      ]);

      return true;
    },

    disconnect_: function() {
      if (hasObserve) {
        this.directObserver_.close();
        this.directObserver_ = undefined;
      } else {
        this.oldObject_ = undefined;
      }
    },

    deliver: function() {
      if (this.state_ != OPENED)
        return;

      if (hasObserve)
        this.directObserver_.deliver(false);
      else
        dirtyCheck(this);
    },

    discardChanges: function() {
      if (this.directObserver_)
        this.directObserver_.deliver(true);
      else
        this.oldObject_ = this.copyObject(this.value_);

      return this.value_;
    }
  });

  function ArrayObserver(array) {
    if (!Array.isArray(array))
      throw Error('Provided object is not an Array');
    ObjectObserver.call(this, array);
  }

  ArrayObserver.prototype = createObject({

    __proto__: ObjectObserver.prototype,

    arrayObserve: true,

    copyObject: function(arr) {
      return arr.slice();
    },

    check_: function(changeRecords) {
      var splices;
      if (hasObserve) {
        if (!changeRecords)
          return false;
        splices = projectArraySplices(this.value_, changeRecords);
      } else {
        splices = calcSplices(this.value_, 0, this.value_.length,
                              this.oldObject_, 0, this.oldObject_.length);
      }

      if (!splices || !splices.length)
        return false;

      if (!hasObserve)
        this.oldObject_ = this.copyObject(this.value_);

      this.report_([splices]);
      return true;
    }
  });

  ArrayObserver.applySplices = function(previous, current, splices) {
    splices.forEach(function(splice) {
      var spliceArgs = [splice.index, splice.removed.length];
      var addIndex = splice.index;
      while (addIndex < splice.index + splice.addedCount) {
        spliceArgs.push(current[addIndex]);
        addIndex++;
      }

      Array.prototype.splice.apply(previous, spliceArgs);
    });
  };

  function PathObserver(object, path) {
    Observer.call(this);

    this.object_ = object;
    this.path_ = getPath(path);
    this.directObserver_ = undefined;
  }

  PathObserver.prototype = createObject({
    __proto__: Observer.prototype,

    get path() {
      return this.path_;
    },

    connect_: function() {
      if (hasObserve)
        this.directObserver_ = getObservedSet(this, this.object_);

      this.check_(undefined, true);
    },

    disconnect_: function() {
      this.value_ = undefined;

      if (this.directObserver_) {
        this.directObserver_.close(this);
        this.directObserver_ = undefined;
      }
    },

    iterateObjects_: function(observe) {
      this.path_.iterateObjects(this.object_, observe);
    },

    check_: function(changeRecords, skipChanges) {
      var oldValue = this.value_;
      this.value_ = this.path_.getValueFrom(this.object_);
      if (skipChanges || areSameValue(this.value_, oldValue))
        return false;

      this.report_([this.value_, oldValue, this]);
      return true;
    },

    setValue: function(newValue) {
      if (this.path_)
        this.path_.setValueFrom(this.object_, newValue);
    }
  });

  function CompoundObserver(reportChangesOnOpen) {
    Observer.call(this);

    this.reportChangesOnOpen_ = reportChangesOnOpen;
    this.value_ = [];
    this.directObserver_ = undefined;
    this.observed_ = [];
  }

  var observerSentinel = {};

  CompoundObserver.prototype = createObject({
    __proto__: Observer.prototype,

    connect_: function() {
      if (hasObserve) {
        var object;
        var needsDirectObserver = false;
        for (var i = 0; i < this.observed_.length; i += 2) {
          object = this.observed_[i]
          if (object !== observerSentinel) {
            needsDirectObserver = true;
            break;
          }
        }

        if (needsDirectObserver)
          this.directObserver_ = getObservedSet(this, object);
      }

      this.check_(undefined, !this.reportChangesOnOpen_);
    },

    disconnect_: function() {
      for (var i = 0; i < this.observed_.length; i += 2) {
        if (this.observed_[i] === observerSentinel)
          this.observed_[i + 1].close();
      }
      this.observed_.length = 0;
      this.value_.length = 0;

      if (this.directObserver_) {
        this.directObserver_.close(this);
        this.directObserver_ = undefined;
      }
    },

    addPath: function(object, path) {
      if (this.state_ != UNOPENED && this.state_ != RESETTING)
        throw Error('Cannot add paths once started.');

      var path = getPath(path);
      this.observed_.push(object, path);
      if (!this.reportChangesOnOpen_)
        return;
      var index = this.observed_.length / 2 - 1;
      this.value_[index] = path.getValueFrom(object);
    },

    addObserver: function(observer) {
      if (this.state_ != UNOPENED && this.state_ != RESETTING)
        throw Error('Cannot add observers once started.');

      this.observed_.push(observerSentinel, observer);
      if (!this.reportChangesOnOpen_)
        return;
      var index = this.observed_.length / 2 - 1;
      this.value_[index] = observer.open(this.deliver, this);
    },

    startReset: function() {
      if (this.state_ != OPENED)
        throw Error('Can only reset while open');

      this.state_ = RESETTING;
      this.disconnect_();
    },

    finishReset: function() {
      if (this.state_ != RESETTING)
        throw Error('Can only finishReset after startReset');
      this.state_ = OPENED;
      this.connect_();

      return this.value_;
    },

    iterateObjects_: function(observe) {
      var object;
      for (var i = 0; i < this.observed_.length; i += 2) {
        object = this.observed_[i]
        if (object !== observerSentinel)
          this.observed_[i + 1].iterateObjects(object, observe)
      }
    },

    check_: function(changeRecords, skipChanges) {
      var oldValues;
      for (var i = 0; i < this.observed_.length; i += 2) {
        var object = this.observed_[i];
        var path = this.observed_[i+1];
        var value;
        if (object === observerSentinel) {
          var observable = path;
          value = this.state_ === UNOPENED ?
              observable.open(this.deliver, this) :
              observable.discardChanges();
        } else {
          value = path.getValueFrom(object);
        }

        if (skipChanges) {
          this.value_[i / 2] = value;
          continue;
        }

        if (areSameValue(value, this.value_[i / 2]))
          continue;

        oldValues = oldValues || [];
        oldValues[i / 2] = this.value_[i / 2];
        this.value_[i / 2] = value;
      }

      if (!oldValues)
        return false;

      // TODO(rafaelw): Having observed_ as the third callback arg here is
      // pretty lame API. Fix.
      this.report_([this.value_, oldValues, this.observed_]);
      return true;
    }
  });

  function identFn(value) { return value; }

  function ObserverTransform(observable, getValueFn, setValueFn,
                             dontPassThroughSet) {
    this.callback_ = undefined;
    this.target_ = undefined;
    this.value_ = undefined;
    this.observable_ = observable;
    this.getValueFn_ = getValueFn || identFn;
    this.setValueFn_ = setValueFn || identFn;
    // TODO(rafaelw): This is a temporary hack. PolymerExpressions needs this
    // at the moment because of a bug in it'siesta dependency tracking.
    this.dontPassThroughSet_ = dontPassThroughSet;
  }

  ObserverTransform.prototype = {
    open: function(callback, target) {
      this.callback_ = callback;
      this.target_ = target;
      this.value_ =
          this.getValueFn_(this.observable_.open(this.observedCallback_, this));
      return this.value_;
    },

    observedCallback_: function(value) {
      value = this.getValueFn_(value);
      if (areSameValue(value, this.value_))
        return;
      var oldValue = this.value_;
      this.value_ = value;
      this.callback_.call(this.target_, this.value_, oldValue);
    },

    discardChanges: function() {
      this.value_ = this.getValueFn_(this.observable_.discardChanges());
      return this.value_;
    },

    deliver: function() {
      return this.observable_.deliver();
    },

    setValue: function(value) {
      value = this.setValueFn_(value);
      if (!this.dontPassThroughSet_ && this.observable_.setValue)
        return this.observable_.setValue(value);
    },

    close: function() {
      if (this.observable_)
        this.observable_.close();
      this.callback_ = undefined;
      this.target_ = undefined;
      this.observable_ = undefined;
      this.value_ = undefined;
      this.getValueFn_ = undefined;
      this.setValueFn_ = undefined;
    }
  }

  var expectedRecordTypes = {
    add: true,
    update: true,
    delete: true
  };

  function diffObjectFromChangeRecords(object, changeRecords, oldValues) {
    var added = {};
    var removed = {};

    for (var i = 0; i < changeRecords.length; i++) {
      var record = changeRecords[i];
      if (!expectedRecordTypes[record.type]) {
        console.error('Unknown changeRecord type: ' + record.type);
        console.error(record);
        continue;
      }

      if (!(record.name in oldValues))
        oldValues[record.name] = record.oldValue;

      if (record.type == 'update')
        continue;

      if (record.type == 'add') {
        if (record.name in removed)
          delete removed[record.name];
        else
          added[record.name] = true;

        continue;
      }

      // type = 'delete'
      if (record.name in added) {
        delete added[record.name];
        delete oldValues[record.name];
      } else {
        removed[record.name] = true;
      }
    }

    for (var prop in added)
      added[prop] = object[prop];

    for (var prop in removed)
      removed[prop] = undefined;

    var changed = {};
    for (var prop in oldValues) {
      if (prop in added || prop in removed)
        continue;

      var newValue = object[prop];
      if (oldValues[prop] !== newValue)
        changed[prop] = newValue;
    }

    return {
      added: added,
      removed: removed,
      changed: changed
    };
  }

  function newSplice(index, removed, addedCount) {
    return {
      index: index,
      removed: removed,
      addedCount: addedCount
    };
  }

  var EDIT_LEAVE = 0;
  var EDIT_UPDATE = 1;
  var EDIT_ADD = 2;
  var EDIT_DELETE = 3;

  function ArraySplice() {}

  ArraySplice.prototype = {

    // Note: This function is *based* on the computation of the Levenshtein
    // "edit" distance. The one change is that "updates" are treated as two
    // edits - not one. With Array splices, an update is really a delete
    // followed by an add. By retaining this, we optimize for "keeping" the
    // maximum array items in the original array. For example:
    //
    //   'xxxx123' -> '123yyyy'
    //
    // With 1-edit updates, the shortest path would be just to update all seven
    // characters. With 2-edit updates, we delete 4, leave 3, and add 4. This
    // leaves the substring '123' intact.
    calcEditDistances: function(current, currentStart, currentEnd,
                                old, oldStart, oldEnd) {
      // "Deletion" columns
      var rowCount = oldEnd - oldStart + 1;
      var columnCount = currentEnd - currentStart + 1;
      var distances = new Array(rowCount);

      // "Addition" rows. Initialize null column.
      for (var i = 0; i < rowCount; i++) {
        distances[i] = new Array(columnCount);
        distances[i][0] = i;
      }

      // Initialize null row
      for (var j = 0; j < columnCount; j++)
        distances[0][j] = j;

      for (var i = 1; i < rowCount; i++) {
        for (var j = 1; j < columnCount; j++) {
          if (this.equals(current[currentStart + j - 1], old[oldStart + i - 1]))
            distances[i][j] = distances[i - 1][j - 1];
          else {
            var north = distances[i - 1][j] + 1;
            var west = distances[i][j - 1] + 1;
            distances[i][j] = north < west ? north : west;
          }
        }
      }

      return distances;
    },

    // This starts at the final weight, and walks "backward" by finding
    // the minimum previous weight recursively until the origin of the weight
    // matrix.
    spliceOperationsFromEditDistances: function(distances) {
      var i = distances.length - 1;
      var j = distances[0].length - 1;
      var current = distances[i][j];
      var edits = [];
      while (i > 0 || j > 0) {
        if (i == 0) {
          edits.push(EDIT_ADD);
          j--;
          continue;
        }
        if (j == 0) {
          edits.push(EDIT_DELETE);
          i--;
          continue;
        }
        var northWest = distances[i - 1][j - 1];
        var west = distances[i - 1][j];
        var north = distances[i][j - 1];

        var min;
        if (west < north)
          min = west < northWest ? west : northWest;
        else
          min = north < northWest ? north : northWest;

        if (min == northWest) {
          if (northWest == current) {
            edits.push(EDIT_LEAVE);
          } else {
            edits.push(EDIT_UPDATE);
            current = northWest;
          }
          i--;
          j--;
        } else if (min == west) {
          edits.push(EDIT_DELETE);
          i--;
          current = west;
        } else {
          edits.push(EDIT_ADD);
          j--;
          current = north;
        }
      }

      edits.reverse();
      return edits;
    },

    /**
     * Splice Projection functions:
     *
     * A splice map is a representation of how a previous array of items
     * was transformed into a new array of items. Conceptually it is a list of
     * tuples of
     *
     *   <index, removed, addedCount>
     *
     * which are kept in ascending index order of. The tuple represents that at
     * the |index|, |removed| sequence of items were removed, and counting forward
     * from |index|, |addedCount| items were added.
     */

    /**
     * Lacking individual splice mutation information, the minimal set of
     * splices can be synthesized given the previous state and final state of an
     * array. The basic approach is to calculate the edit distance matrix and
     * choose the shortest path through it.
     *
     * Complexity: O(l * p)
     *   l: The length of the current array
     *   p: The length of the old array
     */
    calcSplices: function(current, currentStart, currentEnd,
                          old, oldStart, oldEnd) {
      var prefixCount = 0;
      var suffixCount = 0;

      var minLength = Math.min(currentEnd - currentStart, oldEnd - oldStart);
      if (currentStart == 0 && oldStart == 0)
        prefixCount = this.sharedPrefix(current, old, minLength);

      if (currentEnd == current.length && oldEnd == old.length)
        suffixCount = this.sharedSuffix(current, old, minLength - prefixCount);

      currentStart += prefixCount;
      oldStart += prefixCount;
      currentEnd -= suffixCount;
      oldEnd -= suffixCount;

      if (currentEnd - currentStart == 0 && oldEnd - oldStart == 0)
        return [];

      if (currentStart == currentEnd) {
        var splice = newSplice(currentStart, [], 0);
        while (oldStart < oldEnd)
          splice.removed.push(old[oldStart++]);

        return [ splice ];
      } else if (oldStart == oldEnd)
        return [ newSplice(currentStart, [], currentEnd - currentStart) ];

      var ops = this.spliceOperationsFromEditDistances(
          this.calcEditDistances(current, currentStart, currentEnd,
                                 old, oldStart, oldEnd));

      var splice = undefined;
      var splices = [];
      var index = currentStart;
      var oldIndex = oldStart;
      for (var i = 0; i < ops.length; i++) {
        switch(ops[i]) {
          case EDIT_LEAVE:
            if (splice) {
              splices.push(splice);
              splice = undefined;
            }

            index++;
            oldIndex++;
            break;
          case EDIT_UPDATE:
            if (!splice)
              splice = newSplice(index, [], 0);

            splice.addedCount++;
            index++;

            splice.removed.push(old[oldIndex]);
            oldIndex++;
            break;
          case EDIT_ADD:
            if (!splice)
              splice = newSplice(index, [], 0);

            splice.addedCount++;
            index++;
            break;
          case EDIT_DELETE:
            if (!splice)
              splice = newSplice(index, [], 0);

            splice.removed.push(old[oldIndex]);
            oldIndex++;
            break;
        }
      }

      if (splice) {
        splices.push(splice);
      }
      return splices;
    },

    sharedPrefix: function(current, old, searchLength) {
      for (var i = 0; i < searchLength; i++)
        if (!this.equals(current[i], old[i]))
          return i;
      return searchLength;
    },

    sharedSuffix: function(current, old, searchLength) {
      var index1 = current.length;
      var index2 = old.length;
      var count = 0;
      while (count < searchLength && this.equals(current[--index1], old[--index2]))
        count++;

      return count;
    },

    calculateSplices: function(current, previous) {
      return this.calcSplices(current, 0, current.length, previous, 0,
                              previous.length);
    },

    equals: function(currentValue, previousValue) {
      return currentValue === previousValue;
    }
  };

  var arraySplice = new ArraySplice();

  function calcSplices(current, currentStart, currentEnd,
                       old, oldStart, oldEnd) {
    return arraySplice.calcSplices(current, currentStart, currentEnd,
                                   old, oldStart, oldEnd);
  }

  function intersect(start1, end1, start2, end2) {
    // Disjoint
    if (end1 < start2 || end2 < start1)
      return -1;

    // Adjacent
    if (end1 == start2 || end2 == start1)
      return 0;

    // Non-zero intersect, span1 first
    if (start1 < start2) {
      if (end1 < end2)
        return end1 - start2; // Overlap
      else
        return end2 - start2; // Contained
    } else {
      // Non-zero intersect, span2 first
      if (end2 < end1)
        return end2 - start1; // Overlap
      else
        return end1 - start1; // Contained
    }
  }

  function mergeSplice(splices, index, removed, addedCount) {

    var splice = newSplice(index, removed, addedCount);

    var inserted = false;
    var insertionOffset = 0;

    for (var i = 0; i < splices.length; i++) {
      var current = splices[i];
      current.index += insertionOffset;

      if (inserted)
        continue;

      var intersectCount = intersect(splice.index,
                                     splice.index + splice.removed.length,
                                     current.index,
                                     current.index + current.addedCount);

      if (intersectCount >= 0) {
        // Merge the two splices

        splices.splice(i, 1);
        i--;

        insertionOffset -= current.addedCount - current.removed.length;

        splice.addedCount += current.addedCount - intersectCount;
        var deleteCount = splice.removed.length +
                          current.removed.length - intersectCount;

        if (!splice.addedCount && !deleteCount) {
          // merged splice is a noop. discard.
          inserted = true;
        } else {
          var removed = current.removed;

          if (splice.index < current.index) {
            // some prefix of splice.removed is prepended to current.removed.
            var prepend = splice.removed.slice(0, current.index - splice.index);
            Array.prototype.push.apply(prepend, removed);
            removed = prepend;
          }

          if (splice.index + splice.removed.length > current.index + current.addedCount) {
            // some suffix of splice.removed is appended to current.removed.
            var append = splice.removed.slice(current.index + current.addedCount - splice.index);
            Array.prototype.push.apply(removed, append);
          }

          splice.removed = removed;
          if (current.index < splice.index) {
            splice.index = current.index;
          }
        }
      } else if (splice.index < current.index) {
        // Insert splice here.

        inserted = true;

        splices.splice(i, 0, splice);
        i++;

        var offset = splice.addedCount - splice.removed.length
        current.index += offset;
        insertionOffset += offset;
      }
    }

    if (!inserted)
      splices.push(splice);
  }

  function createInitialSplices(array, changeRecords) {
    var splices = [];

    for (var i = 0; i < changeRecords.length; i++) {
      var record = changeRecords[i];
      switch(record.type) {
        case 'splice':
          mergeSplice(splices, record.index, record.removed.slice(), record.addedCount);
          break;
        case 'add':
        case 'update':
        case 'delete':
          if (!isIndex(record.name))
            continue;
          var index = toNumber(record.name);
          if (index < 0)
            continue;
          mergeSplice(splices, index, [record.oldValue], 1);
          break;
        default:
          console.error('Unexpected record type: ' + JSON.stringify(record));
          break;
      }
    }

    return splices;
  }

  function projectArraySplices(array, changeRecords) {
    var splices = [];

    createInitialSplices(array, changeRecords).forEach(function(splice) {
      if (splice.addedCount == 1 && splice.removed.length == 1) {
        if (splice.removed[0] !== array[splice.index])
          splices.push(splice);

        return
      };

      splices = splices.concat(calcSplices(array, splice.index, splice.index + splice.addedCount,
                                           splice.removed, 0, splice.removed.length));
    });

    return splices;
  }

 // Export the observe-js object for **Node.js**, with
// backwards-compatibility for the old `require()` API. If we're in
// the browser, export as a global object.
var expose = global;
if (typeof exports !== 'undefined') {
if (typeof module !== 'undefined' && module.exports) {
expose = exports = module.exports;
}
expose = exports;
}
expose.Observer = Observer;
expose.Observer.runEOM_ = runEOM;
expose.Observer.observerSentinel_ = observerSentinel; // for testing.
expose.Observer.hasObjectObserve = hasObserve;
expose.ArrayObserver = ArrayObserver;
expose.ArrayObserver.calculateSplices = function(current, previous) {
return arraySplice.calculateSplices(current, previous);
};
expose.Platform = global.Platform;
expose.ArraySplice = ArraySplice;
expose.ObjectObserver = ObjectObserver;
expose.PathObserver = PathObserver;
expose.CompoundObserver = CompoundObserver;
expose.Path = Path;
expose.ObserverTransform = ObserverTransform;
})(typeof global !== 'undefined' && global && typeof module !== 'undefined' && module ? global : this || window);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],25:[function(require,module,exports){
function Logger (name) {
    if (!this) return new Logger(name);
    this.name = name;

    this.trace = constructPerformer(this, _.bind(console.debug ? console.debug : console.log, console), Logger.Level.trace);
    this.debug = constructPerformer(this, _.bind(console.debug ? console.debug  : console.log, console), Logger.Level.debug);
    this.info = constructPerformer(this, _.bind(console.info ? console.info : console.log, console), Logger.Level.info);
    this.log = constructPerformer(this, _.bind(console.log ? console.log : console.log, console), Logger.Level.info);
    this.warn = constructPerformer(this, _.bind(console.warn ? console.warn : console.log, console), Logger.Level.warning);
    this.error = constructPerformer(this, _.bind(console.error ? console.error : console.log, console), Logger.Level.error);
    this.fatal = constructPerformer(this, _.bind(console.error ? console.error : console.log, console), Logger.Level.fatal);

}

var logLevels = {};

function constructPerformer (logger, f, level) {
    var performer = function (message) {
        logger.performLog(f, level, message, arguments);
    };
    Object.defineProperty(performer, 'isEnabled', {
        get: function () {
            var currentLevel = logger.currentLevel();
            return level >= currentLevel;
        },
        enumerable: true,
        configurable: true
    });
    performer.f = f;
    performer.logger = logger;
    performer.level = level;
    return performer;
}

Logger.Level = {
    trace: 0,
    debug: 1,
    info: 2,
    warning: 3,
    warn: 3,
    error: 4,
    fatal: 5
};

Logger.LevelText = {};
Logger.LevelText [Logger.Level.trace] = 'TRACE';
Logger.LevelText [Logger.Level.debug] = 'DEBUG';
Logger.LevelText [Logger.Level.info] = 'INFO ';
Logger.LevelText [Logger.Level.warning] = 'WARN ';
Logger.LevelText [Logger.Level.error] = 'ERROR';

Logger.levelAsText = function (level) {
    return this.LevelText[level];
};

Logger.loggerWithName = function (name) {
    return new Logger(name);
};

Logger.prototype.currentLevel = function () {
    var logLevel = logLevels[this.name];
    return  logLevel ? logLevel : Logger.Level.trace;
};

Logger.prototype.setLevel = function (level) {
    logLevels[this.name] = level;
};

Logger.prototype.override = function (level, override, message) {
    var levelAsText = Logger.levelAsText(level);
    var performer = this[levelAsText.trim().toLowerCase()];
    var f = performer.f;
    var otherArguments = Array.prototype.slice.call(arguments, 3, arguments.length);
    this.performLog(f, level, message, otherArguments, override);
};

Logger.prototype.performLog = function (logFunc, level, message, otherArguments, override) {
    var self = this;
    var currentLevel = override !== undefined ? override : this.currentLevel();
    if (currentLevel <= level) {
        logFunc = _.partial(logFunc, Logger.levelAsText(level) + ' [' + self.name + ']: ' + message);
        var args = [];
        for (var i=0; i<otherArguments.length; i++) {
            args[i] = otherArguments[i];
        }
        args.splice(0, 1);
        logFunc.apply(logFunc, args);
    }
};

module.exports = Logger;

},{}],26:[function(require,module,exports){
var log = require('./log');
var Logger = log.loggerWithName('Operation');

function Operation() {
    if (!this) {
        return new (Function.prototype.bind.apply(Operation, arguments));
    }
    var self = this;
    if (arguments.length) {
        if (typeof(arguments[0]) == 'string') {
            this.name = arguments[0];
            this.work = arguments[1];
            this.completion = arguments[2];
        }
        else if (typeof(arguments[0]) == 'function' ||
            Object.prototype.toString.call(arguments[0]) === '[object Array]' ||
            arguments[0] instanceof Operation) {
            this.work = arguments[0];
            this.completion = arguments[1];
        }
    }
    this.error = null;
    this.completed = false;
    this.result = null;
    this.running = false;
    this.cancelled = false;
    this.dependencies = [];
    this._mustSucceed = [];
    this._onCompletion = [];
    this.logLevel = null; // Override.

    Object.defineProperty(this, 'failed', {
        get: function () {
            return  !!self.error || self.failedDueToDependency;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(this, 'composite', {
        get: function () {
            return self.work instanceof Operation ||
                Object.prototype.toString.call(self.work) === '[object Array]'
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(this, 'numOperationsRemaining', {
        get: function () {
            if (self.work instanceof Operation) {
                return self.work.completed ? 0 : 1
            }
            else if (Object.prototype.toString.call(self.work) === '[object Array]') {
                return _.reduce(self.work, function (memo, op) {
                    if (!op.completed) {
                        return memo + 1;
                    }
                    return memo;
                }, 0);
            }
            else {
                return null;
            }
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(this, 'canRun', {
        get: function () {
            if (self.dependencies.length) {
                return _.reduce(self.dependencies, function (memo, dep) {
                    var mustSucceed = self._mustSucceed.indexOf(dep) > -1;
                    var canRun = memo && dep.completed;
                    if (mustSucceed && canRun) {
                        canRun = canRun && !(dep.failed || dep.cancelled);
                    }
                    return canRun;
                }, true);
            }
            return true;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(this, 'failedDueToDependency', {
        get: function () {
            if (self.dependencies.length) {
                var failedDeps = _.reduce(self.dependencies, function (memo, dep) {
                    var mustSucceed = self._mustSucceed.indexOf(dep) > -1;
                    var failed = ((dep.failed || dep.cancelled) && mustSucceed);
                    if (failed) {
                        memo.push(dep);
                    }
                    return memo;
                }, []);
                return failedDeps.length ? failedDeps : false;
            }
            return false;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(this, 'failedDueToCancellationOfDependency', {
        get: function () {
            if (self.dependencies.length) {
                var cancelled = _.reduce(self.dependencies, function (memo, dep) {
                    var mustSucceed = self._mustSucceed.indexOf(dep) > -1;
                    if (mustSucceed) {
                        if (dep.cancelled) memo.push(dep);
                    }
                    return memo;
                }, []);
                return cancelled.length ? cancelled : false;
            }
            return false;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(this, 'loggingOveridden', {
        get: function () {
            if (self.logLevel) {
                return self.logLevel <= log.Level.info;
            }
            return false;
        },
        enumerable: true,
        configurable: true
    })


}

Operation.running = [];

Operation.prototype._startSingle = function () {
    var self = this;
    this.work(function (err, payload) {
        self.result = payload;
        self.error = err;
        self.completed = true;
        self.running = false;
        self._complete();
    });
};

Operation.prototype._startComposite = function () {
    var self = this;
    var operations = self.work instanceof Operation ? [self.work] : self.work;
    _.each(operations, function (op) {
        op.onCompletion(function () {
            var numOperationsRemaining = self.numOperationsRemaining;
            var name = self.name || 'Unnamed';
            Logger.debug(name + ' has ' + numOperationsRemaining.toString() + ' operations remaining');
            if (!numOperationsRemaining) {
                var errors = _.pluck(operations, 'error');
                var results = _.pluck(operations, 'result');
                self.result = _.some(results) ? results : null;
                self.error = _.some(errors) ? errors : null;
                self.completed = true;
                self.running = false;
                self._complete();
            }
        });
        op.start();
    });
};

Operation.prototype._logCompletion = function () {
    var logFunc = this._getLogFunc();
    if (Logger.info.isEnabled || this.loggingOveridden) {
        var name = this.name || 'Unnamed';
        var failedDependencies = this.failedDueToDependency;
        if (failedDependencies) {
            logFunc('"' + name + '" failed due to failure/cancellation of dependencies: ' + _.pluck(failedDependencies, 'name').join(', '));
        }
        else if (this.failed) {
            var err = this.error;
            // Remove null errors.
            if (Object.prototype.toString.call(err) === '[object Array]') {
                err = _.filter(err, function (e) {return e });
            }
            else {
                err = [this.error];
            }
            logFunc('"' + name + '" failed due to errors:', err);
        }
        else if (this.cancelled) {
            logFunc('"' + name + '" has been cancelled.');
        }
        else {
            logFunc('"' + name + '" has succeeded.');
        }
    }
};

Operation.prototype._getLogFunc = function () {
    if (this.logLevel) {
        return _.bind(Logger.override, Logger, log.Level.info, this.logLevel);
    }
    return Logger.info;
};

Operation.prototype._logStart = function () {
    if (Logger.info.isEnabled || this.loggingOveridden) {
        var name = this.name || 'Unnamed';
        var logFunc = this._getLogFunc();
        logFunc('"' + name + '" has started.');
    }
};


Operation.prototype._complete = function () {
    var self = this;
    this.completed = true;
    var idx = Operation.running.indexOf(this);
    Operation.running.splice(idx, 1);
    if (this.completion) {
        _.bind(this.completion, this)();
    }
    this._logCompletion();
    _.each(this._onCompletion, function (o) {
        _.bind(o, self)();
    });
};

Operation.prototype.__start = function () {
    this._logStart();
    if (this.work) {
        if (this.composite) {
            this._startComposite();
        }
        else {
            this._startSingle();
        }
        Operation.running.push(this);
    }
    else {
        this.result = null;
        this.error = null;
        this.running = false;
        this._complete();
    }
};

Operation.prototype.start = function () {
    var self = this;
    var neverStarted = !this.running && !this.completed;
    var neverStartedAndFailed = neverStarted && this.failed;
    // A dependency failed or was cancelled before this operation started.
    if (neverStartedAndFailed) {
        this._complete();
    }
    else if (neverStarted) {
        this.running = true;
        if (this.canRun) {
            this.__start();
        }
        else {
            _.each(this.dependencies, function (dep) {
                dep.onCompletion(function () {
                    if (self.canRun) {
                        self.__start();
                    }
                })
            });
        }
    }
};


Operation.prototype.addDependency = function () {
    var self = this;
    if (arguments.length == 1) {
        this.dependencies.push(arguments[0]);
    }
    else if (arguments.length) {
        var args = arguments;
        var lastArg = args[args.length - 1];
        var mustSucceed = false;
        if (typeof(lastArg) == 'boolean') {
            args = Array.prototype.slice.call(args, 0, args.length - 1);
            mustSucceed = lastArg;
        }
        _.each(args, function (arg) {
            self.dependencies.push(arg);
        });
        if (mustSucceed) {
            _.each(args, function (arg) {
                self._mustSucceed.push(arg);
            })
        }
    }
};

Operation.prototype.onCompletion = function (o) {
    if (!this.completed) {
        this._onCompletion.push(o);
    }
    else {
        _.bind(o, this)();
    }
};

Operation.prototype.cancel = function (callback) {
    if (!this.cancelled) {
        this.cancelled = true;
        Logger.debug('Cancelling ' + this.name, this);
        if (this.composite) {
            _.each(this.work, function (subop) {
                subop.cancel();
            });
        }
        this.onCompletion(function () {
            this.running = false;
            if (callback) callback();
        });
    }
};

Object.defineProperty(Operation, 'logLevel', {
    get: function () {
        return Logger.currentLevel();
    },
    set: function (v) {
        Logger.setLevel(v);
    },
    configurable: true,
    enumerable: true
});

module.exports.Operation = Operation;

},{"./log":25}],27:[function(require,module,exports){

var log = require('./log');
var Logger = log.loggerWithName('OperationQueue');


function OperationQueue() {

    if (!this) {
        return new (Function.prototype.bind.apply(OperationQueue, arguments));
    }
    var self = this;

    if (arguments.length) {
        if (typeof(arguments[0]) == 'number') {
            this.maxConcurrentOperations = arguments[0];
        }
        else {
            this.name = arguments[0];
            this.maxConcurrentOperations = arguments[1];
        }
    }

    this._queuedOperations = [];
    this._runningOperations = [];
    this._running = false;
    this._onStart = [];
    this._onStop = [];
    this.logLevel = null;

    Object.defineProperty(this, 'numRunningOperations', {
        get: function () {
            return self._runningOperations.length;
        },
        configurable: true,
        enumerable: true
    });

    Object.defineProperty(this, 'loggingOveridden', {
        get: function () {
            if (self.logLevel) {
                return self.logLevel <= log.Level.info;
            }
            return false;
        },
        enumerable: true,
        configurable: true
    })
}

OperationQueue.prototype._nextOperations = function () {
    var self = this;
    while ((self._runningOperations.length < self.maxConcurrentOperations) && self._queuedOperations.length) {
        var op = self._queuedOperations[0];
        self._queuedOperations.splice(0, 1);
        self._runOperation(op);
    }
};


OperationQueue.prototype._runOperation = function (op) {
    var self = this;
    for (var i = 0; i < this._queuedOperations.length; i++) {
        if (this._queuedOperations[i] == op) {
            this._queuedOperations.splice(i, 1);
            break;
        }
    }
    this._runningOperations.push(op);
    op.completion = function () {
        var idx = self._runningOperations.indexOf(op);
        self._runningOperations.splice(idx, 1);
        if (self._running) {
            self._nextOperations();
        }
        self._logStatus();
    };
    op.start();
    this._logStatus();
};

OperationQueue.prototype._logStatus = function () {
    var logFunc = this._getLogFunc();
    if (Logger.info.isEnabled || this.loggingOveridden) {
        var numRunning = this.numRunningOperations;
        var numQueued = this._queuedOperations.length;
        var name = this.name || "Unnamed Queue";
        if (numRunning && numQueued) {
            logFunc('"' + name + '" now has ' + numRunning.toString() + ' operations running and ' + numQueued.toString() + ' operations queued');
        }
        else if (numRunning) {
            logFunc('"' + name + '" now has ' + numRunning.toString() + ' operations running');
        }
        else if (numQueued) {
            logFunc('"' + name + '" now has ' + numQueued.toString() + ' operations queued');
        }
        else {
            logFunc('"' + name + '" has no operations running or queued');
        }
    }
};

OperationQueue.prototype._logStart = function () {
    var logFunc = this._getLogFunc();
    if (Logger.info.isEnabled || this.loggingOveridden) {
        var name = this.name || "Unnamed Queue";
        logFunc('"' + name + '" is now running');
    }
};

OperationQueue.prototype._getLogFunc = function () {
    if (this.logLevel) {
        return _.bind(Logger.override, Logger, log.Level.info, this.logLevel);
    }
    return Logger.info;
};


OperationQueue.prototype._logStop = function () {
    var logFunc = this._getLogFunc();
    if (Logger.info.isEnabled || this.loggingOveridden) {
        var name = this.name || "Unnamed Queue";
        logFunc('"' + name + '" is no longer running');
    }
};

OperationQueue.prototype._addOperation = function (op) {
    if (this.numRunningOperations < this.maxConcurrentOperations && this._running) {
        this._runOperation(op);
    }
    else {
        this._queuedOperations.push(op);
    }
    this._logStatus();
};

OperationQueue.prototype.addOperation = function (operationOrOperations) {
    var self = this;
    if (Object.prototype.toString.call(operationOrOperations) === '[object Array]') {
        _.each(operationOrOperations, function (op) {self._addOperation(op)});
    }
    else {
        this._addOperation(operationOrOperations);
    }
};

OperationQueue.prototype.start = function () {
    var self = this;
    var wasRunning = this._running;
    this._running = true;
    if (!wasRunning) {
        _.each(self._onStart, function (c) {
            _.bind(c, self)();
        });
        self._nextOperations();
        self._logStart();
    }
};

OperationQueue.prototype.stop = function (cancel) {
    var self = this;
    var wasRunning = this._running;
    this._running = false;
    if (wasRunning) {
        if (cancel) {
            var operations = this._runningOperations.slice(0); // Clone so not fighting callbacks.
            _.each(operations, function (o) {
                o.cancel();
            });
        }
        self._logStop();
        _.each(self._onStop, function (c) {
            _.bind(c, self)();
        });
    }
};

OperationQueue.prototype.onStart = function (o) {
    this._onStart.push(o);
};
OperationQueue.prototype.onStop = function (o) {
    this._onStop.push(o);
};

Object.defineProperty(OperationQueue, 'logLevel', {
    get: function () {
        return Logger.currentLevel();
    },
    set: function (v) {
        Logger.setLevel(v);
    },
    configurable: true,
    enumerable: true
});


module.exports.OperationQueue = OperationQueue;

},{"./log":25}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9pbmRleC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9leHRlbmQvaW5kZXguanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvcS9xLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvc3JjL2NhY2hlLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvc3JjL2NoYW5nZXMuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9zcmMvY29sbGVjdGlvbi5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L3NyYy9jb2xsZWN0aW9uUmVnaXN0cnkuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9zcmMvZXJyb3IuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9zcmMvbWFueVRvTWFueVByb3h5LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvc3JjL21hcHBpbmcuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9zcmMvbWFwcGluZ09wZXJhdGlvbi5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L3NyYy9taXNjLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvc3JjL25vdGlmaWNhdGlvbkNlbnRyZS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L3NyYy9vYmplY3QuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9zcmMvb25lVG9NYW55UHJveHkuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9zcmMvb25lVG9PbmVQcm94eS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L3NyYy9wcm94eS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L3NyYy9xdWVyeS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L3NyYy9yZWxhdGlvbnNoaXAuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9zcmMvc3RvcmUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9zcmMvdXRpbC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvdmVuZG9yL29wZXJhdGlvbnMuanMvc3JjL2xvZy5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L3ZlbmRvci9vcGVyYXRpb25zLmpzL3NyYy9vcGVyYXRpb24uanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC92ZW5kb3Ivb3BlcmF0aW9ucy5qcy9zcmMvcXVldWUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3U0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsM0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pVQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOVdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL21CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25OQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNjQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0TkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNVZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RzREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2YXIgY29sbGVjdGlvbiA9IHJlcXVpcmUoJy4vc3JjL2NvbGxlY3Rpb24nKTtcbnZhciB1dGlsID0gcmVxdWlyZSgnLi9zcmMvdXRpbCcpO1xuXG52YXIgQ29sbGVjdGlvblJlZ2lzdHJ5ID0gcmVxdWlyZSgnLi9zcmMvY29sbGVjdGlvblJlZ2lzdHJ5JykuQ29sbGVjdGlvblJlZ2lzdHJ5XG4gICAgLCBDb2xsZWN0aW9uID0gY29sbGVjdGlvbi5Db2xsZWN0aW9uXG4gICAgLCBjYWNoZSA9IHJlcXVpcmUoJy4vc3JjL2NhY2hlJylcbiAgICAsIE1hcHBpbmcgPSByZXF1aXJlKCcuL3NyYy9tYXBwaW5nJykuTWFwcGluZ1xuICAgICwgbm90aWZpY2F0aW9uQ2VudHJlID0gcmVxdWlyZSgnLi9zcmMvbm90aWZpY2F0aW9uQ2VudHJlJykubm90aWZpY2F0aW9uQ2VudHJlXG4gICAgLCBPcGVyYXRpb24gPSByZXF1aXJlKCcuL3ZlbmRvci9vcGVyYXRpb25zLmpzL3NyYy9vcGVyYXRpb24nKS5PcGVyYXRpb25cbiAgICAsIE9wZXJhdGlvblF1ZXVlID0gcmVxdWlyZSgnLi92ZW5kb3Ivb3BlcmF0aW9ucy5qcy9zcmMvcXVldWUnKS5PcGVyYXRpb25RdWV1ZVxuICAgICwgUmVsYXRpb25zaGlwVHlwZSA9IHJlcXVpcmUoJy4vc3JjL3JlbGF0aW9uc2hpcCcpLlJlbGF0aW9uc2hpcFR5cGVcbiAgICAsIGxvZyA9IHJlcXVpcmUoJy4vdmVuZG9yL29wZXJhdGlvbnMuanMvc3JjL2xvZycpXG4gICAgLCBxID0gcmVxdWlyZSgncScpXG4gICAgLCBfID0gdXRpbC5fO1xuXG5cbk9wZXJhdGlvbi5sb2dMZXZlbCA9IGxvZy5MZXZlbC53YXJuO1xuT3BlcmF0aW9uUXVldWUubG9nTGV2ZWwgPSBsb2cuTGV2ZWwud2FybjtcblxuXG52YXIgc2llc3RhO1xuaWYgKHR5cGVvZiBtb2R1bGUgIT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBzaWVzdGEgPSBtb2R1bGUuZXhwb3J0cztcbn1cbmVsc2Uge1xuICAgIHNpZXN0YSA9IHt9O1xufVxuXG5zaWVzdGEuc2F2ZSA9IGZ1bmN0aW9uIHNhdmUoY2FsbGJhY2spIHtcbiAgICB2YXIgZGVmZXJyZWQgPSBxLmRlZmVyKCk7XG4gICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICBpZiAoc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCkge1xuICAgICAgICB1dGlsLm5leHQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIG1lcmdlQ2hhbmdlcyA9IHNpZXN0YS5leHQuc3RvcmFnZS5jaGFuZ2VzLm1lcmdlQ2hhbmdlcztcbiAgICAgICAgICAgIG1lcmdlQ2hhbmdlcyhjYWxsYmFjayk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgY2FsbGJhY2soJ1N0b3JhZ2UgbW9kdWxlIG5vdCBpbnN0YWxsZWQnKTtcbiAgICB9XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59O1xuXG5zaWVzdGEucmVzZXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgY2FjaGUucmVzZXQoKTtcbiAgICBDb2xsZWN0aW9uUmVnaXN0cnkucmVzZXQoKTtcbiAgICBzaWVzdGEuZXh0Lmh0dHAuRGVzY3JpcHRvclJlZ2lzdHJ5LnJlc2V0KCk7XG4gICAgLy9ub2luc3BlY3Rpb24gSlNBY2Nlc3NpYmlsaXR5Q2hlY2tcbn07XG5cblxuc2llc3RhLm9uID0gXy5iaW5kKG5vdGlmaWNhdGlvbkNlbnRyZS5vbiwgbm90aWZpY2F0aW9uQ2VudHJlKTtcbnNpZXN0YS5hZGRMaXN0ZW5lciA9IF8uYmluZChub3RpZmljYXRpb25DZW50cmUuYWRkTGlzdGVuZXIsIG5vdGlmaWNhdGlvbkNlbnRyZSk7XG5zaWVzdGEucmVtb3ZlTGlzdGVuZXIgPSBfLmJpbmQobm90aWZpY2F0aW9uQ2VudHJlLnJlbW92ZUxpc3RlbmVyLCBub3RpZmljYXRpb25DZW50cmUpO1xuc2llc3RhLm9uY2UgPSBfLmJpbmQobm90aWZpY2F0aW9uQ2VudHJlLm9uY2UsIG5vdGlmaWNhdGlvbkNlbnRyZSk7XG5cbnNpZXN0YS5Db2xsZWN0aW9uID0gQ29sbGVjdGlvbjtcbnNpZXN0YS5SZWxhdGlvbnNoaXBUeXBlID0gUmVsYXRpb25zaGlwVHlwZTtcblxuLy8gVXNlZCBieSBtb2R1bGVzLlxudmFyIGNvcmVDaGFuZ2VzID0gcmVxdWlyZSgnLi9zcmMvY2hhbmdlcycpO1xuXG4vLyBNYWtlIGF2YWlsYWJsZSBtb2R1bGVzIHRvIGV4dGVuc2lvbnMuXG5zaWVzdGEuX2ludGVybmFsID0ge1xuICAgIGxvZzogbG9nLFxuICAgIE1hcHBpbmc6IE1hcHBpbmcsXG4gICAgbWFwcGluZzogcmVxdWlyZSgnLi9zcmMvbWFwcGluZycpLFxuICAgIGVycm9yOiByZXF1aXJlKCcuL3NyYy9lcnJvcicpLFxuICAgIENoYW5nZVR5cGU6IGNvcmVDaGFuZ2VzLkNoYW5nZVR5cGUsXG4gICAgb2JqZWN0OiByZXF1aXJlKCcuL3NyYy9vYmplY3QnKSxcbiAgICBleHRlbmQ6IHJlcXVpcmUoJ2V4dGVuZCcpLFxuICAgIG5vdGlmaWNhdGlvbkNlbnRyZTogcmVxdWlyZSgnLi9zcmMvbm90aWZpY2F0aW9uQ2VudHJlJyksXG4gICAgY2FjaGU6IHJlcXVpcmUoJy4vc3JjL2NhY2hlJyksXG4gICAgbWlzYzogcmVxdWlyZSgnLi9zcmMvbWlzYycpLFxuICAgIE9wZXJhdGlvbjogT3BlcmF0aW9uLFxuICAgIE9wZXJhdGlvblF1ZXVlOiBPcGVyYXRpb25RdWV1ZSxcbiAgICBjb3JlQ2hhbmdlczogY29yZUNoYW5nZXMsXG4gICAgQ29sbGVjdGlvblJlZ2lzdHJ5OiByZXF1aXJlKCcuL3NyYy9jb2xsZWN0aW9uUmVnaXN0cnknKS5Db2xsZWN0aW9uUmVnaXN0cnksXG4gICAgQ29sbGVjdGlvbjogY29sbGVjdGlvbi5Db2xsZWN0aW9uLFxuICAgIGNvbGxlY3Rpb246IGNvbGxlY3Rpb24sXG4gICAgdXRpbHM6IHV0aWwsXG4gICAgdXRpbDogdXRpbCxcbiAgICBfOiB1dGlsLl8sXG4gICAgcXVlcnk6IHJlcXVpcmUoJy4vc3JjL3F1ZXJ5JyksXG4gICAgc3RvcmU6IHJlcXVpcmUoJy4vc3JjL3N0b3JlJyksXG4gICAgcTogcmVxdWlyZSgncScpXG59O1xuXG5zaWVzdGEucGVyZm9ybWFuY2VNb25pdG9yaW5nRW5hYmxlZCA9IGZhbHNlO1xuc2llc3RhLmh0dHBFbmFibGVkID0gZmFsc2U7XG5zaWVzdGEuc3RvcmFnZUVuYWJsZWQgPSBmYWxzZTtcblxuc2llc3RhLmV4dCA9IHt9O1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoc2llc3RhLCAnc2V0UG91Y2gnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmIChzaWVzdGEuZXh0LnN0b3JhZ2VFbmFibGVkKSB7XG4gICAgICAgICAgICByZXR1cm4gc2llc3RhLmV4dC5zdG9yYWdlLnBvdWNoLnNldFBvdWNoO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoc2llc3RhLmV4dCwgJ3N0b3JhZ2VFbmFibGVkJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoc2llc3RhLmV4dC5fc3RvcmFnZUVuYWJsZWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmV0dXJuIHNpZXN0YS5leHQuX3N0b3JhZ2VFbmFibGVkO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAhIXNpZXN0YS5leHQuc3RvcmFnZTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgc2llc3RhLmV4dC5fc3RvcmFnZUVuYWJsZWQgPSB2O1xuICAgIH1cbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoc2llc3RhLmV4dCwgJ2h0dHBFbmFibGVkJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoc2llc3RhLmV4dC5faHR0cEVuYWJsZWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmV0dXJuIHNpZXN0YS5leHQuX2h0dHBFbmFibGVkO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAhIXNpZXN0YS5leHQuaHR0cDtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgc2llc3RhLmV4dC5faHR0cEVuYWJsZWQgPSB2O1xuICAgIH1cbn0pO1xuXG5zaWVzdGEuY29sbGVjdGlvbiA9IGZ1bmN0aW9uIChuYW1lLCBvcHRzKSB7XG4gICAgcmV0dXJuIG5ldyBDb2xsZWN0aW9uKG5hbWUsIG9wdHMpO1xufTtcblxuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoc2llc3RhLCAnaXNEaXJ0eScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIENvbGxlY3Rpb24uaXNEaXJ0eVxuICAgIH0sXG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIGVudW1lcmFibGU6IHRydWVcbn0pO1xuXG5cblxuXG5pZiAodHlwZW9mIHdpbmRvdyAhPSAndW5kZWZpbmVkJykge1xuICAgIHdpbmRvdy5zaWVzdGEgPSBzaWVzdGE7XG59XG5cbmV4cG9ydHMuc2llc3RhID0gc2llc3RhOyIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICB2YXIgbTtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2Uge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIWVtaXR0ZXIuX2V2ZW50cyB8fCAhZW1pdHRlci5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IDA7XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24oZW1pdHRlci5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSAxO1xuICBlbHNlXG4gICAgcmV0ID0gZW1pdHRlci5fZXZlbnRzW3R5cGVdLmxlbmd0aDtcbiAgcmV0dXJuIHJldDtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbnByb2Nlc3MubmV4dFRpY2sgPSAoZnVuY3Rpb24gKCkge1xuICAgIHZhciBjYW5TZXRJbW1lZGlhdGUgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJ1xuICAgICYmIHdpbmRvdy5zZXRJbW1lZGlhdGU7XG4gICAgdmFyIGNhblBvc3QgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJ1xuICAgICYmIHdpbmRvdy5wb3N0TWVzc2FnZSAmJiB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lclxuICAgIDtcblxuICAgIGlmIChjYW5TZXRJbW1lZGlhdGUpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChmKSB7IHJldHVybiB3aW5kb3cuc2V0SW1tZWRpYXRlKGYpIH07XG4gICAgfVxuXG4gICAgaWYgKGNhblBvc3QpIHtcbiAgICAgICAgdmFyIHF1ZXVlID0gW107XG4gICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgZnVuY3Rpb24gKGV2KSB7XG4gICAgICAgICAgICB2YXIgc291cmNlID0gZXYuc291cmNlO1xuICAgICAgICAgICAgaWYgKChzb3VyY2UgPT09IHdpbmRvdyB8fCBzb3VyY2UgPT09IG51bGwpICYmIGV2LmRhdGEgPT09ICdwcm9jZXNzLXRpY2snKSB7XG4gICAgICAgICAgICAgICAgZXYuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICAgICAgaWYgKHF1ZXVlLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGZuID0gcXVldWUuc2hpZnQoKTtcbiAgICAgICAgICAgICAgICAgICAgZm4oKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIHRydWUpO1xuXG4gICAgICAgIHJldHVybiBmdW5jdGlvbiBuZXh0VGljayhmbikge1xuICAgICAgICAgICAgcXVldWUucHVzaChmbik7XG4gICAgICAgICAgICB3aW5kb3cucG9zdE1lc3NhZ2UoJ3Byb2Nlc3MtdGljaycsICcqJyk7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIGZ1bmN0aW9uIG5leHRUaWNrKGZuKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZm4sIDApO1xuICAgIH07XG59KSgpO1xuXG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn1cblxuLy8gVE9ETyhzaHR5bG1hbilcbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuIiwidmFyIGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG52YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xudmFyIHVuZGVmaW5lZDtcblxudmFyIGlzUGxhaW5PYmplY3QgPSBmdW5jdGlvbiBpc1BsYWluT2JqZWN0KG9iaikge1xuXHRcInVzZSBzdHJpY3RcIjtcblx0aWYgKCFvYmogfHwgdG9TdHJpbmcuY2FsbChvYmopICE9PSAnW29iamVjdCBPYmplY3RdJyB8fCBvYmoubm9kZVR5cGUgfHwgb2JqLnNldEludGVydmFsKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0dmFyIGhhc19vd25fY29uc3RydWN0b3IgPSBoYXNPd24uY2FsbChvYmosICdjb25zdHJ1Y3RvcicpO1xuXHR2YXIgaGFzX2lzX3Byb3BlcnR5X29mX21ldGhvZCA9IG9iai5jb25zdHJ1Y3RvciAmJiBvYmouY29uc3RydWN0b3IucHJvdG90eXBlICYmIGhhc093bi5jYWxsKG9iai5jb25zdHJ1Y3Rvci5wcm90b3R5cGUsICdpc1Byb3RvdHlwZU9mJyk7XG5cdC8vIE5vdCBvd24gY29uc3RydWN0b3IgcHJvcGVydHkgbXVzdCBiZSBPYmplY3Rcblx0aWYgKG9iai5jb25zdHJ1Y3RvciAmJiAhaGFzX293bl9jb25zdHJ1Y3RvciAmJiAhaGFzX2lzX3Byb3BlcnR5X29mX21ldGhvZCkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdC8vIE93biBwcm9wZXJ0aWVzIGFyZSBlbnVtZXJhdGVkIGZpcnN0bHksIHNvIHRvIHNwZWVkIHVwLFxuXHQvLyBpZiBsYXN0IG9uZSBpcyBvd24sIHRoZW4gYWxsIHByb3BlcnRpZXMgYXJlIG93bi5cblx0dmFyIGtleTtcblx0Zm9yIChrZXkgaW4gb2JqKSB7fVxuXG5cdHJldHVybiBrZXkgPT09IHVuZGVmaW5lZCB8fCBoYXNPd24uY2FsbChvYmosIGtleSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGV4dGVuZCgpIHtcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cdHZhciBvcHRpb25zLCBuYW1lLCBzcmMsIGNvcHksIGNvcHlJc0FycmF5LCBjbG9uZSxcblx0XHR0YXJnZXQgPSBhcmd1bWVudHNbMF0sXG5cdFx0aSA9IDEsXG5cdFx0bGVuZ3RoID0gYXJndW1lbnRzLmxlbmd0aCxcblx0XHRkZWVwID0gZmFsc2U7XG5cblx0Ly8gSGFuZGxlIGEgZGVlcCBjb3B5IHNpdHVhdGlvblxuXHRpZiAodHlwZW9mIHRhcmdldCA9PT0gXCJib29sZWFuXCIpIHtcblx0XHRkZWVwID0gdGFyZ2V0O1xuXHRcdHRhcmdldCA9IGFyZ3VtZW50c1sxXSB8fCB7fTtcblx0XHQvLyBza2lwIHRoZSBib29sZWFuIGFuZCB0aGUgdGFyZ2V0XG5cdFx0aSA9IDI7XG5cdH0gZWxzZSBpZiAodHlwZW9mIHRhcmdldCAhPT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgdGFyZ2V0ICE9PSBcImZ1bmN0aW9uXCIgfHwgdGFyZ2V0ID09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGFyZ2V0ID0ge307XG5cdH1cblxuXHRmb3IgKDsgaSA8IGxlbmd0aDsgKytpKSB7XG5cdFx0Ly8gT25seSBkZWFsIHdpdGggbm9uLW51bGwvdW5kZWZpbmVkIHZhbHVlc1xuXHRcdGlmICgob3B0aW9ucyA9IGFyZ3VtZW50c1tpXSkgIT0gbnVsbCkge1xuXHRcdFx0Ly8gRXh0ZW5kIHRoZSBiYXNlIG9iamVjdFxuXHRcdFx0Zm9yIChuYW1lIGluIG9wdGlvbnMpIHtcblx0XHRcdFx0c3JjID0gdGFyZ2V0W25hbWVdO1xuXHRcdFx0XHRjb3B5ID0gb3B0aW9uc1tuYW1lXTtcblxuXHRcdFx0XHQvLyBQcmV2ZW50IG5ldmVyLWVuZGluZyBsb29wXG5cdFx0XHRcdGlmICh0YXJnZXQgPT09IGNvcHkpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFJlY3Vyc2UgaWYgd2UncmUgbWVyZ2luZyBwbGFpbiBvYmplY3RzIG9yIGFycmF5c1xuXHRcdFx0XHRpZiAoZGVlcCAmJiBjb3B5ICYmIChpc1BsYWluT2JqZWN0KGNvcHkpIHx8IChjb3B5SXNBcnJheSA9IEFycmF5LmlzQXJyYXkoY29weSkpKSkge1xuXHRcdFx0XHRcdGlmIChjb3B5SXNBcnJheSkge1xuXHRcdFx0XHRcdFx0Y29weUlzQXJyYXkgPSBmYWxzZTtcblx0XHRcdFx0XHRcdGNsb25lID0gc3JjICYmIEFycmF5LmlzQXJyYXkoc3JjKSA/IHNyYyA6IFtdO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRjbG9uZSA9IHNyYyAmJiBpc1BsYWluT2JqZWN0KHNyYykgPyBzcmMgOiB7fTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvLyBOZXZlciBtb3ZlIG9yaWdpbmFsIG9iamVjdHMsIGNsb25lIHRoZW1cblx0XHRcdFx0XHR0YXJnZXRbbmFtZV0gPSBleHRlbmQoZGVlcCwgY2xvbmUsIGNvcHkpO1xuXG5cdFx0XHRcdC8vIERvbid0IGJyaW5nIGluIHVuZGVmaW5lZCB2YWx1ZXNcblx0XHRcdFx0fSBlbHNlIGlmIChjb3B5ICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHR0YXJnZXRbbmFtZV0gPSBjb3B5O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Ly8gUmV0dXJuIHRoZSBtb2RpZmllZCBvYmplY3Rcblx0cmV0dXJuIHRhcmdldDtcbn07XG5cbiIsIihmdW5jdGlvbiAocHJvY2Vzcyl7XG4vLyB2aW06dHM9NDpzdHM9NDpzdz00OlxuLyohXG4gKlxuICogQ29weXJpZ2h0IDIwMDktMjAxMiBLcmlzIEtvd2FsIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgTUlUXG4gKiBsaWNlbnNlIGZvdW5kIGF0IGh0dHA6Ly9naXRodWIuY29tL2tyaXNrb3dhbC9xL3Jhdy9tYXN0ZXIvTElDRU5TRVxuICpcbiAqIFdpdGggcGFydHMgYnkgVHlsZXIgQ2xvc2VcbiAqIENvcHlyaWdodCAyMDA3LTIwMDkgVHlsZXIgQ2xvc2UgdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBNSVQgWCBsaWNlbnNlIGZvdW5kXG4gKiBhdCBodHRwOi8vd3d3Lm9wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL21pdC1saWNlbnNlLmh0bWxcbiAqIEZvcmtlZCBhdCByZWZfc2VuZC5qcyB2ZXJzaW9uOiAyMDA5LTA1LTExXG4gKlxuICogV2l0aCBwYXJ0cyBieSBNYXJrIE1pbGxlclxuICogQ29weXJpZ2h0IChDKSAyMDExIEdvb2dsZSBJbmMuXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKlxuICovXG5cbihmdW5jdGlvbiAoZGVmaW5pdGlvbikge1xuICAgIC8vIFR1cm4gb2ZmIHN0cmljdCBtb2RlIGZvciB0aGlzIGZ1bmN0aW9uIHNvIHdlIGNhbiBhc3NpZ24gdG8gZ2xvYmFsLlFcbiAgICAvKiBqc2hpbnQgc3RyaWN0OiBmYWxzZSAqL1xuXG4gICAgLy8gVGhpcyBmaWxlIHdpbGwgZnVuY3Rpb24gcHJvcGVybHkgYXMgYSA8c2NyaXB0PiB0YWcsIG9yIGEgbW9kdWxlXG4gICAgLy8gdXNpbmcgQ29tbW9uSlMgYW5kIE5vZGVKUyBvciBSZXF1aXJlSlMgbW9kdWxlIGZvcm1hdHMuICBJblxuICAgIC8vIENvbW1vbi9Ob2RlL1JlcXVpcmVKUywgdGhlIG1vZHVsZSBleHBvcnRzIHRoZSBRIEFQSSBhbmQgd2hlblxuICAgIC8vIGV4ZWN1dGVkIGFzIGEgc2ltcGxlIDxzY3JpcHQ+LCBpdCBjcmVhdGVzIGEgUSBnbG9iYWwgaW5zdGVhZC5cblxuICAgIC8vIE1vbnRhZ2UgUmVxdWlyZVxuICAgIGlmICh0eXBlb2YgYm9vdHN0cmFwID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgYm9vdHN0cmFwKFwicHJvbWlzZVwiLCBkZWZpbml0aW9uKTtcblxuICAgIC8vIENvbW1vbkpTXG4gICAgfSBlbHNlIGlmICh0eXBlb2YgZXhwb3J0cyA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IGRlZmluaXRpb24oKTtcblxuICAgIC8vIFJlcXVpcmVKU1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGRlZmluZSA9PT0gXCJmdW5jdGlvblwiICYmIGRlZmluZS5hbWQpIHtcbiAgICAgICAgZGVmaW5lKGRlZmluaXRpb24pO1xuXG4gICAgLy8gU0VTIChTZWN1cmUgRWNtYVNjcmlwdClcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBzZXMgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgaWYgKCFzZXMub2soKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2VzLm1ha2VRID0gZGVmaW5pdGlvbjtcbiAgICAgICAgfVxuXG4gICAgLy8gPHNjcmlwdD5cbiAgICB9IGVsc2Uge1xuICAgICAgICBRID0gZGVmaW5pdGlvbigpO1xuICAgIH1cblxufSkoZnVuY3Rpb24gKCkge1xuXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciBoYXNTdGFja3MgPSBmYWxzZTtcbnRyeSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCk7XG59IGNhdGNoIChlKSB7XG4gICAgaGFzU3RhY2tzID0gISFlLnN0YWNrO1xufVxuXG4vLyBBbGwgY29kZSBhZnRlciB0aGlzIHBvaW50IHdpbGwgYmUgZmlsdGVyZWQgZnJvbSBzdGFjayB0cmFjZXMgcmVwb3J0ZWRcbi8vIGJ5IFEuXG52YXIgcVN0YXJ0aW5nTGluZSA9IGNhcHR1cmVMaW5lKCk7XG52YXIgcUZpbGVOYW1lO1xuXG4vLyBzaGltc1xuXG4vLyB1c2VkIGZvciBmYWxsYmFjayBpbiBcImFsbFJlc29sdmVkXCJcbnZhciBub29wID0gZnVuY3Rpb24gKCkge307XG5cbi8vIFVzZSB0aGUgZmFzdGVzdCBwb3NzaWJsZSBtZWFucyB0byBleGVjdXRlIGEgdGFzayBpbiBhIGZ1dHVyZSB0dXJuXG4vLyBvZiB0aGUgZXZlbnQgbG9vcC5cbnZhciBuZXh0VGljayA9KGZ1bmN0aW9uICgpIHtcbiAgICAvLyBsaW5rZWQgbGlzdCBvZiB0YXNrcyAoc2luZ2xlLCB3aXRoIGhlYWQgbm9kZSlcbiAgICB2YXIgaGVhZCA9IHt0YXNrOiB2b2lkIDAsIG5leHQ6IG51bGx9O1xuICAgIHZhciB0YWlsID0gaGVhZDtcbiAgICB2YXIgZmx1c2hpbmcgPSBmYWxzZTtcbiAgICB2YXIgcmVxdWVzdFRpY2sgPSB2b2lkIDA7XG4gICAgdmFyIGlzTm9kZUpTID0gZmFsc2U7XG5cbiAgICBmdW5jdGlvbiBmbHVzaCgpIHtcbiAgICAgICAgLyoganNoaW50IGxvb3BmdW5jOiB0cnVlICovXG5cbiAgICAgICAgd2hpbGUgKGhlYWQubmV4dCkge1xuICAgICAgICAgICAgaGVhZCA9IGhlYWQubmV4dDtcbiAgICAgICAgICAgIHZhciB0YXNrID0gaGVhZC50YXNrO1xuICAgICAgICAgICAgaGVhZC50YXNrID0gdm9pZCAwO1xuICAgICAgICAgICAgdmFyIGRvbWFpbiA9IGhlYWQuZG9tYWluO1xuXG4gICAgICAgICAgICBpZiAoZG9tYWluKSB7XG4gICAgICAgICAgICAgICAgaGVhZC5kb21haW4gPSB2b2lkIDA7XG4gICAgICAgICAgICAgICAgZG9tYWluLmVudGVyKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgdGFzaygpO1xuXG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlzTm9kZUpTKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEluIG5vZGUsIHVuY2F1Z2h0IGV4Y2VwdGlvbnMgYXJlIGNvbnNpZGVyZWQgZmF0YWwgZXJyb3JzLlxuICAgICAgICAgICAgICAgICAgICAvLyBSZS10aHJvdyB0aGVtIHN5bmNocm9ub3VzbHkgdG8gaW50ZXJydXB0IGZsdXNoaW5nIVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIEVuc3VyZSBjb250aW51YXRpb24gaWYgdGhlIHVuY2F1Z2h0IGV4Y2VwdGlvbiBpcyBzdXBwcmVzc2VkXG4gICAgICAgICAgICAgICAgICAgIC8vIGxpc3RlbmluZyBcInVuY2F1Z2h0RXhjZXB0aW9uXCIgZXZlbnRzIChhcyBkb21haW5zIGRvZXMpLlxuICAgICAgICAgICAgICAgICAgICAvLyBDb250aW51ZSBpbiBuZXh0IGV2ZW50IHRvIGF2b2lkIHRpY2sgcmVjdXJzaW9uLlxuICAgICAgICAgICAgICAgICAgICBpZiAoZG9tYWluKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkb21haW4uZXhpdCgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoZmx1c2gsIDApO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZG9tYWluKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkb21haW4uZW50ZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHRocm93IGU7XG5cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBJbiBicm93c2VycywgdW5jYXVnaHQgZXhjZXB0aW9ucyBhcmUgbm90IGZhdGFsLlxuICAgICAgICAgICAgICAgICAgICAvLyBSZS10aHJvdyB0aGVtIGFzeW5jaHJvbm91c2x5IHRvIGF2b2lkIHNsb3ctZG93bnMuXG4gICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgIHRocm93IGU7XG4gICAgICAgICAgICAgICAgICAgIH0sIDApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGRvbWFpbikge1xuICAgICAgICAgICAgICAgIGRvbWFpbi5leGl0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmbHVzaGluZyA9IGZhbHNlO1xuICAgIH1cblxuICAgIG5leHRUaWNrID0gZnVuY3Rpb24gKHRhc2spIHtcbiAgICAgICAgdGFpbCA9IHRhaWwubmV4dCA9IHtcbiAgICAgICAgICAgIHRhc2s6IHRhc2ssXG4gICAgICAgICAgICBkb21haW46IGlzTm9kZUpTICYmIHByb2Nlc3MuZG9tYWluLFxuICAgICAgICAgICAgbmV4dDogbnVsbFxuICAgICAgICB9O1xuXG4gICAgICAgIGlmICghZmx1c2hpbmcpIHtcbiAgICAgICAgICAgIGZsdXNoaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgIHJlcXVlc3RUaWNrKCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgaWYgKHR5cGVvZiBwcm9jZXNzICE9PSBcInVuZGVmaW5lZFwiICYmIHByb2Nlc3MubmV4dFRpY2spIHtcbiAgICAgICAgLy8gTm9kZS5qcyBiZWZvcmUgMC45LiBOb3RlIHRoYXQgc29tZSBmYWtlLU5vZGUgZW52aXJvbm1lbnRzLCBsaWtlIHRoZVxuICAgICAgICAvLyBNb2NoYSB0ZXN0IHJ1bm5lciwgaW50cm9kdWNlIGEgYHByb2Nlc3NgIGdsb2JhbCB3aXRob3V0IGEgYG5leHRUaWNrYC5cbiAgICAgICAgaXNOb2RlSlMgPSB0cnVlO1xuXG4gICAgICAgIHJlcXVlc3RUaWNrID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcHJvY2Vzcy5uZXh0VGljayhmbHVzaCk7XG4gICAgICAgIH07XG5cbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBzZXRJbW1lZGlhdGUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAvLyBJbiBJRTEwLCBOb2RlLmpzIDAuOSssIG9yIGh0dHBzOi8vZ2l0aHViLmNvbS9Ob2JsZUpTL3NldEltbWVkaWF0ZVxuICAgICAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICAgICAgcmVxdWVzdFRpY2sgPSBzZXRJbW1lZGlhdGUuYmluZCh3aW5kb3csIGZsdXNoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlcXVlc3RUaWNrID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHNldEltbWVkaWF0ZShmbHVzaCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBNZXNzYWdlQ2hhbm5lbCAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICAvLyBtb2Rlcm4gYnJvd3NlcnNcbiAgICAgICAgLy8gaHR0cDovL3d3dy5ub25ibG9ja2luZy5pby8yMDExLzA2L3dpbmRvd25leHR0aWNrLmh0bWxcbiAgICAgICAgdmFyIGNoYW5uZWwgPSBuZXcgTWVzc2FnZUNoYW5uZWwoKTtcbiAgICAgICAgLy8gQXQgbGVhc3QgU2FmYXJpIFZlcnNpb24gNi4wLjUgKDg1MzYuMzAuMSkgaW50ZXJtaXR0ZW50bHkgY2Fubm90IGNyZWF0ZVxuICAgICAgICAvLyB3b3JraW5nIG1lc3NhZ2UgcG9ydHMgdGhlIGZpcnN0IHRpbWUgYSBwYWdlIGxvYWRzLlxuICAgICAgICBjaGFubmVsLnBvcnQxLm9ubWVzc2FnZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJlcXVlc3RUaWNrID0gcmVxdWVzdFBvcnRUaWNrO1xuICAgICAgICAgICAgY2hhbm5lbC5wb3J0MS5vbm1lc3NhZ2UgPSBmbHVzaDtcbiAgICAgICAgICAgIGZsdXNoKCk7XG4gICAgICAgIH07XG4gICAgICAgIHZhciByZXF1ZXN0UG9ydFRpY2sgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAvLyBPcGVyYSByZXF1aXJlcyB1cyB0byBwcm92aWRlIGEgbWVzc2FnZSBwYXlsb2FkLCByZWdhcmRsZXNzIG9mXG4gICAgICAgICAgICAvLyB3aGV0aGVyIHdlIHVzZSBpdC5cbiAgICAgICAgICAgIGNoYW5uZWwucG9ydDIucG9zdE1lc3NhZ2UoMCk7XG4gICAgICAgIH07XG4gICAgICAgIHJlcXVlc3RUaWNrID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgc2V0VGltZW91dChmbHVzaCwgMCk7XG4gICAgICAgICAgICByZXF1ZXN0UG9ydFRpY2soKTtcbiAgICAgICAgfTtcblxuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIG9sZCBicm93c2Vyc1xuICAgICAgICByZXF1ZXN0VGljayA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHNldFRpbWVvdXQoZmx1c2gsIDApO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBuZXh0VGljaztcbn0pKCk7XG5cbi8vIEF0dGVtcHQgdG8gbWFrZSBnZW5lcmljcyBzYWZlIGluIHRoZSBmYWNlIG9mIGRvd25zdHJlYW1cbi8vIG1vZGlmaWNhdGlvbnMuXG4vLyBUaGVyZSBpcyBubyBzaXR1YXRpb24gd2hlcmUgdGhpcyBpcyBuZWNlc3NhcnkuXG4vLyBJZiB5b3UgbmVlZCBhIHNlY3VyaXR5IGd1YXJhbnRlZSwgdGhlc2UgcHJpbW9yZGlhbHMgbmVlZCB0byBiZVxuLy8gZGVlcGx5IGZyb3plbiBhbnl3YXksIGFuZCBpZiB5b3UgZG9u4oCZdCBuZWVkIGEgc2VjdXJpdHkgZ3VhcmFudGVlLFxuLy8gdGhpcyBpcyBqdXN0IHBsYWluIHBhcmFub2lkLlxuLy8gSG93ZXZlciwgdGhpcyAqKm1pZ2h0KiogaGF2ZSB0aGUgbmljZSBzaWRlLWVmZmVjdCBvZiByZWR1Y2luZyB0aGUgc2l6ZSBvZlxuLy8gdGhlIG1pbmlmaWVkIGNvZGUgYnkgcmVkdWNpbmcgeC5jYWxsKCkgdG8gbWVyZWx5IHgoKVxuLy8gU2VlIE1hcmsgTWlsbGVy4oCZcyBleHBsYW5hdGlvbiBvZiB3aGF0IHRoaXMgZG9lcy5cbi8vIGh0dHA6Ly93aWtpLmVjbWFzY3JpcHQub3JnL2Rva3UucGhwP2lkPWNvbnZlbnRpb25zOnNhZmVfbWV0YV9wcm9ncmFtbWluZ1xudmFyIGNhbGwgPSBGdW5jdGlvbi5jYWxsO1xuZnVuY3Rpb24gdW5jdXJyeVRoaXMoZikge1xuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBjYWxsLmFwcGx5KGYsIGFyZ3VtZW50cyk7XG4gICAgfTtcbn1cbi8vIFRoaXMgaXMgZXF1aXZhbGVudCwgYnV0IHNsb3dlcjpcbi8vIHVuY3VycnlUaGlzID0gRnVuY3Rpb25fYmluZC5iaW5kKEZ1bmN0aW9uX2JpbmQuY2FsbCk7XG4vLyBodHRwOi8vanNwZXJmLmNvbS91bmN1cnJ5dGhpc1xuXG52YXIgYXJyYXlfc2xpY2UgPSB1bmN1cnJ5VGhpcyhBcnJheS5wcm90b3R5cGUuc2xpY2UpO1xuXG52YXIgYXJyYXlfcmVkdWNlID0gdW5jdXJyeVRoaXMoXG4gICAgQXJyYXkucHJvdG90eXBlLnJlZHVjZSB8fCBmdW5jdGlvbiAoY2FsbGJhY2ssIGJhc2lzKSB7XG4gICAgICAgIHZhciBpbmRleCA9IDAsXG4gICAgICAgICAgICBsZW5ndGggPSB0aGlzLmxlbmd0aDtcbiAgICAgICAgLy8gY29uY2VybmluZyB0aGUgaW5pdGlhbCB2YWx1ZSwgaWYgb25lIGlzIG5vdCBwcm92aWRlZFxuICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgLy8gc2VlayB0byB0aGUgZmlyc3QgdmFsdWUgaW4gdGhlIGFycmF5LCBhY2NvdW50aW5nXG4gICAgICAgICAgICAvLyBmb3IgdGhlIHBvc3NpYmlsaXR5IHRoYXQgaXMgaXMgYSBzcGFyc2UgYXJyYXlcbiAgICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgICAgICBpZiAoaW5kZXggaW4gdGhpcykge1xuICAgICAgICAgICAgICAgICAgICBiYXNpcyA9IHRoaXNbaW5kZXgrK107XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoKytpbmRleCA+PSBsZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gd2hpbGUgKDEpO1xuICAgICAgICB9XG4gICAgICAgIC8vIHJlZHVjZVxuICAgICAgICBmb3IgKDsgaW5kZXggPCBsZW5ndGg7IGluZGV4KyspIHtcbiAgICAgICAgICAgIC8vIGFjY291bnQgZm9yIHRoZSBwb3NzaWJpbGl0eSB0aGF0IHRoZSBhcnJheSBpcyBzcGFyc2VcbiAgICAgICAgICAgIGlmIChpbmRleCBpbiB0aGlzKSB7XG4gICAgICAgICAgICAgICAgYmFzaXMgPSBjYWxsYmFjayhiYXNpcywgdGhpc1tpbmRleF0sIGluZGV4KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYmFzaXM7XG4gICAgfVxuKTtcblxudmFyIGFycmF5X2luZGV4T2YgPSB1bmN1cnJ5VGhpcyhcbiAgICBBcnJheS5wcm90b3R5cGUuaW5kZXhPZiB8fCBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgLy8gbm90IGEgdmVyeSBnb29kIHNoaW0sIGJ1dCBnb29kIGVub3VnaCBmb3Igb3VyIG9uZSB1c2Ugb2YgaXRcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodGhpc1tpXSA9PT0gdmFsdWUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gaTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gLTE7XG4gICAgfVxuKTtcblxudmFyIGFycmF5X21hcCA9IHVuY3VycnlUaGlzKFxuICAgIEFycmF5LnByb3RvdHlwZS5tYXAgfHwgZnVuY3Rpb24gKGNhbGxiYWNrLCB0aGlzcCkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHZhciBjb2xsZWN0ID0gW107XG4gICAgICAgIGFycmF5X3JlZHVjZShzZWxmLCBmdW5jdGlvbiAodW5kZWZpbmVkLCB2YWx1ZSwgaW5kZXgpIHtcbiAgICAgICAgICAgIGNvbGxlY3QucHVzaChjYWxsYmFjay5jYWxsKHRoaXNwLCB2YWx1ZSwgaW5kZXgsIHNlbGYpKTtcbiAgICAgICAgfSwgdm9pZCAwKTtcbiAgICAgICAgcmV0dXJuIGNvbGxlY3Q7XG4gICAgfVxuKTtcblxudmFyIG9iamVjdF9jcmVhdGUgPSBPYmplY3QuY3JlYXRlIHx8IGZ1bmN0aW9uIChwcm90b3R5cGUpIHtcbiAgICBmdW5jdGlvbiBUeXBlKCkgeyB9XG4gICAgVHlwZS5wcm90b3R5cGUgPSBwcm90b3R5cGU7XG4gICAgcmV0dXJuIG5ldyBUeXBlKCk7XG59O1xuXG52YXIgb2JqZWN0X2hhc093blByb3BlcnR5ID0gdW5jdXJyeVRoaXMoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eSk7XG5cbnZhciBvYmplY3Rfa2V5cyA9IE9iamVjdC5rZXlzIHx8IGZ1bmN0aW9uIChvYmplY3QpIHtcbiAgICB2YXIga2V5cyA9IFtdO1xuICAgIGZvciAodmFyIGtleSBpbiBvYmplY3QpIHtcbiAgICAgICAgaWYgKG9iamVjdF9oYXNPd25Qcm9wZXJ0eShvYmplY3QsIGtleSkpIHtcbiAgICAgICAgICAgIGtleXMucHVzaChrZXkpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBrZXlzO1xufTtcblxudmFyIG9iamVjdF90b1N0cmluZyA9IHVuY3VycnlUaGlzKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcpO1xuXG5mdW5jdGlvbiBpc09iamVjdCh2YWx1ZSkge1xuICAgIHJldHVybiB2YWx1ZSA9PT0gT2JqZWN0KHZhbHVlKTtcbn1cblxuLy8gZ2VuZXJhdG9yIHJlbGF0ZWQgc2hpbXNcblxuLy8gRklYTUU6IFJlbW92ZSB0aGlzIGZ1bmN0aW9uIG9uY2UgRVM2IGdlbmVyYXRvcnMgYXJlIGluIFNwaWRlck1vbmtleS5cbmZ1bmN0aW9uIGlzU3RvcEl0ZXJhdGlvbihleGNlcHRpb24pIHtcbiAgICByZXR1cm4gKFxuICAgICAgICBvYmplY3RfdG9TdHJpbmcoZXhjZXB0aW9uKSA9PT0gXCJbb2JqZWN0IFN0b3BJdGVyYXRpb25dXCIgfHxcbiAgICAgICAgZXhjZXB0aW9uIGluc3RhbmNlb2YgUVJldHVyblZhbHVlXG4gICAgKTtcbn1cblxuLy8gRklYTUU6IFJlbW92ZSB0aGlzIGhlbHBlciBhbmQgUS5yZXR1cm4gb25jZSBFUzYgZ2VuZXJhdG9ycyBhcmUgaW5cbi8vIFNwaWRlck1vbmtleS5cbnZhciBRUmV0dXJuVmFsdWU7XG5pZiAodHlwZW9mIFJldHVyblZhbHVlICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgUVJldHVyblZhbHVlID0gUmV0dXJuVmFsdWU7XG59IGVsc2Uge1xuICAgIFFSZXR1cm5WYWx1ZSA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gICAgfTtcbn1cblxuLy8gbG9uZyBzdGFjayB0cmFjZXNcblxudmFyIFNUQUNLX0pVTVBfU0VQQVJBVE9SID0gXCJGcm9tIHByZXZpb3VzIGV2ZW50OlwiO1xuXG5mdW5jdGlvbiBtYWtlU3RhY2tUcmFjZUxvbmcoZXJyb3IsIHByb21pc2UpIHtcbiAgICAvLyBJZiBwb3NzaWJsZSwgdHJhbnNmb3JtIHRoZSBlcnJvciBzdGFjayB0cmFjZSBieSByZW1vdmluZyBOb2RlIGFuZCBRXG4gICAgLy8gY3J1ZnQsIHRoZW4gY29uY2F0ZW5hdGluZyB3aXRoIHRoZSBzdGFjayB0cmFjZSBvZiBgcHJvbWlzZWAuIFNlZSAjNTcuXG4gICAgaWYgKGhhc1N0YWNrcyAmJlxuICAgICAgICBwcm9taXNlLnN0YWNrICYmXG4gICAgICAgIHR5cGVvZiBlcnJvciA9PT0gXCJvYmplY3RcIiAmJlxuICAgICAgICBlcnJvciAhPT0gbnVsbCAmJlxuICAgICAgICBlcnJvci5zdGFjayAmJlxuICAgICAgICBlcnJvci5zdGFjay5pbmRleE9mKFNUQUNLX0pVTVBfU0VQQVJBVE9SKSA9PT0gLTFcbiAgICApIHtcbiAgICAgICAgdmFyIHN0YWNrcyA9IFtdO1xuICAgICAgICBmb3IgKHZhciBwID0gcHJvbWlzZTsgISFwOyBwID0gcC5zb3VyY2UpIHtcbiAgICAgICAgICAgIGlmIChwLnN0YWNrKSB7XG4gICAgICAgICAgICAgICAgc3RhY2tzLnVuc2hpZnQocC5zdGFjayk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgc3RhY2tzLnVuc2hpZnQoZXJyb3Iuc3RhY2spO1xuXG4gICAgICAgIHZhciBjb25jYXRlZFN0YWNrcyA9IHN0YWNrcy5qb2luKFwiXFxuXCIgKyBTVEFDS19KVU1QX1NFUEFSQVRPUiArIFwiXFxuXCIpO1xuICAgICAgICBlcnJvci5zdGFjayA9IGZpbHRlclN0YWNrU3RyaW5nKGNvbmNhdGVkU3RhY2tzKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGZpbHRlclN0YWNrU3RyaW5nKHN0YWNrU3RyaW5nKSB7XG4gICAgdmFyIGxpbmVzID0gc3RhY2tTdHJpbmcuc3BsaXQoXCJcXG5cIik7XG4gICAgdmFyIGRlc2lyZWRMaW5lcyA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGluZXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgdmFyIGxpbmUgPSBsaW5lc1tpXTtcblxuICAgICAgICBpZiAoIWlzSW50ZXJuYWxGcmFtZShsaW5lKSAmJiAhaXNOb2RlRnJhbWUobGluZSkgJiYgbGluZSkge1xuICAgICAgICAgICAgZGVzaXJlZExpbmVzLnB1c2gobGluZSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGRlc2lyZWRMaW5lcy5qb2luKFwiXFxuXCIpO1xufVxuXG5mdW5jdGlvbiBpc05vZGVGcmFtZShzdGFja0xpbmUpIHtcbiAgICByZXR1cm4gc3RhY2tMaW5lLmluZGV4T2YoXCIobW9kdWxlLmpzOlwiKSAhPT0gLTEgfHxcbiAgICAgICAgICAgc3RhY2tMaW5lLmluZGV4T2YoXCIobm9kZS5qczpcIikgIT09IC0xO1xufVxuXG5mdW5jdGlvbiBnZXRGaWxlTmFtZUFuZExpbmVOdW1iZXIoc3RhY2tMaW5lKSB7XG4gICAgLy8gTmFtZWQgZnVuY3Rpb25zOiBcImF0IGZ1bmN0aW9uTmFtZSAoZmlsZW5hbWU6bGluZU51bWJlcjpjb2x1bW5OdW1iZXIpXCJcbiAgICAvLyBJbiBJRTEwIGZ1bmN0aW9uIG5hbWUgY2FuIGhhdmUgc3BhY2VzIChcIkFub255bW91cyBmdW5jdGlvblwiKSBPX29cbiAgICB2YXIgYXR0ZW1wdDEgPSAvYXQgLisgXFwoKC4rKTooXFxkKyk6KD86XFxkKylcXCkkLy5leGVjKHN0YWNrTGluZSk7XG4gICAgaWYgKGF0dGVtcHQxKSB7XG4gICAgICAgIHJldHVybiBbYXR0ZW1wdDFbMV0sIE51bWJlcihhdHRlbXB0MVsyXSldO1xuICAgIH1cblxuICAgIC8vIEFub255bW91cyBmdW5jdGlvbnM6IFwiYXQgZmlsZW5hbWU6bGluZU51bWJlcjpjb2x1bW5OdW1iZXJcIlxuICAgIHZhciBhdHRlbXB0MiA9IC9hdCAoW14gXSspOihcXGQrKTooPzpcXGQrKSQvLmV4ZWMoc3RhY2tMaW5lKTtcbiAgICBpZiAoYXR0ZW1wdDIpIHtcbiAgICAgICAgcmV0dXJuIFthdHRlbXB0MlsxXSwgTnVtYmVyKGF0dGVtcHQyWzJdKV07XG4gICAgfVxuXG4gICAgLy8gRmlyZWZveCBzdHlsZTogXCJmdW5jdGlvbkBmaWxlbmFtZTpsaW5lTnVtYmVyIG9yIEBmaWxlbmFtZTpsaW5lTnVtYmVyXCJcbiAgICB2YXIgYXR0ZW1wdDMgPSAvLipAKC4rKTooXFxkKykkLy5leGVjKHN0YWNrTGluZSk7XG4gICAgaWYgKGF0dGVtcHQzKSB7XG4gICAgICAgIHJldHVybiBbYXR0ZW1wdDNbMV0sIE51bWJlcihhdHRlbXB0M1syXSldO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gaXNJbnRlcm5hbEZyYW1lKHN0YWNrTGluZSkge1xuICAgIHZhciBmaWxlTmFtZUFuZExpbmVOdW1iZXIgPSBnZXRGaWxlTmFtZUFuZExpbmVOdW1iZXIoc3RhY2tMaW5lKTtcblxuICAgIGlmICghZmlsZU5hbWVBbmRMaW5lTnVtYmVyKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB2YXIgZmlsZU5hbWUgPSBmaWxlTmFtZUFuZExpbmVOdW1iZXJbMF07XG4gICAgdmFyIGxpbmVOdW1iZXIgPSBmaWxlTmFtZUFuZExpbmVOdW1iZXJbMV07XG5cbiAgICByZXR1cm4gZmlsZU5hbWUgPT09IHFGaWxlTmFtZSAmJlxuICAgICAgICBsaW5lTnVtYmVyID49IHFTdGFydGluZ0xpbmUgJiZcbiAgICAgICAgbGluZU51bWJlciA8PSBxRW5kaW5nTGluZTtcbn1cblxuLy8gZGlzY292ZXIgb3duIGZpbGUgbmFtZSBhbmQgbGluZSBudW1iZXIgcmFuZ2UgZm9yIGZpbHRlcmluZyBzdGFja1xuLy8gdHJhY2VzXG5mdW5jdGlvbiBjYXB0dXJlTGluZSgpIHtcbiAgICBpZiAoIWhhc1N0YWNrcykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICB2YXIgbGluZXMgPSBlLnN0YWNrLnNwbGl0KFwiXFxuXCIpO1xuICAgICAgICB2YXIgZmlyc3RMaW5lID0gbGluZXNbMF0uaW5kZXhPZihcIkBcIikgPiAwID8gbGluZXNbMV0gOiBsaW5lc1syXTtcbiAgICAgICAgdmFyIGZpbGVOYW1lQW5kTGluZU51bWJlciA9IGdldEZpbGVOYW1lQW5kTGluZU51bWJlcihmaXJzdExpbmUpO1xuICAgICAgICBpZiAoIWZpbGVOYW1lQW5kTGluZU51bWJlcikge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgcUZpbGVOYW1lID0gZmlsZU5hbWVBbmRMaW5lTnVtYmVyWzBdO1xuICAgICAgICByZXR1cm4gZmlsZU5hbWVBbmRMaW5lTnVtYmVyWzFdO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZGVwcmVjYXRlKGNhbGxiYWNrLCBuYW1lLCBhbHRlcm5hdGl2ZSkge1xuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICh0eXBlb2YgY29uc29sZSAhPT0gXCJ1bmRlZmluZWRcIiAmJlxuICAgICAgICAgICAgdHlwZW9mIGNvbnNvbGUud2FybiA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4obmFtZSArIFwiIGlzIGRlcHJlY2F0ZWQsIHVzZSBcIiArIGFsdGVybmF0aXZlICtcbiAgICAgICAgICAgICAgICAgICAgICAgICBcIiBpbnN0ZWFkLlwiLCBuZXcgRXJyb3IoXCJcIikuc3RhY2spO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjYWxsYmFjay5hcHBseShjYWxsYmFjaywgYXJndW1lbnRzKTtcbiAgICB9O1xufVxuXG4vLyBlbmQgb2Ygc2hpbXNcbi8vIGJlZ2lubmluZyBvZiByZWFsIHdvcmtcblxuLyoqXG4gKiBDb25zdHJ1Y3RzIGEgcHJvbWlzZSBmb3IgYW4gaW1tZWRpYXRlIHJlZmVyZW5jZSwgcGFzc2VzIHByb21pc2VzIHRocm91Z2gsIG9yXG4gKiBjb2VyY2VzIHByb21pc2VzIGZyb20gZGlmZmVyZW50IHN5c3RlbXMuXG4gKiBAcGFyYW0gdmFsdWUgaW1tZWRpYXRlIHJlZmVyZW5jZSBvciBwcm9taXNlXG4gKi9cbmZ1bmN0aW9uIFEodmFsdWUpIHtcbiAgICAvLyBJZiB0aGUgb2JqZWN0IGlzIGFscmVhZHkgYSBQcm9taXNlLCByZXR1cm4gaXQgZGlyZWN0bHkuICBUaGlzIGVuYWJsZXNcbiAgICAvLyB0aGUgcmVzb2x2ZSBmdW5jdGlvbiB0byBib3RoIGJlIHVzZWQgdG8gY3JlYXRlZCByZWZlcmVuY2VzIGZyb20gb2JqZWN0cyxcbiAgICAvLyBidXQgdG8gdG9sZXJhYmx5IGNvZXJjZSBub24tcHJvbWlzZXMgdG8gcHJvbWlzZXMuXG4gICAgaWYgKGlzUHJvbWlzZSh2YWx1ZSkpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cblxuICAgIC8vIGFzc2ltaWxhdGUgdGhlbmFibGVzXG4gICAgaWYgKGlzUHJvbWlzZUFsaWtlKHZhbHVlKSkge1xuICAgICAgICByZXR1cm4gY29lcmNlKHZhbHVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZnVsZmlsbCh2YWx1ZSk7XG4gICAgfVxufVxuUS5yZXNvbHZlID0gUTtcblxuLyoqXG4gKiBQZXJmb3JtcyBhIHRhc2sgaW4gYSBmdXR1cmUgdHVybiBvZiB0aGUgZXZlbnQgbG9vcC5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IHRhc2tcbiAqL1xuUS5uZXh0VGljayA9IG5leHRUaWNrO1xuXG4vKipcbiAqIENvbnRyb2xzIHdoZXRoZXIgb3Igbm90IGxvbmcgc3RhY2sgdHJhY2VzIHdpbGwgYmUgb25cbiAqL1xuUS5sb25nU3RhY2tTdXBwb3J0ID0gZmFsc2U7XG5cbi8qKlxuICogQ29uc3RydWN0cyBhIHtwcm9taXNlLCByZXNvbHZlLCByZWplY3R9IG9iamVjdC5cbiAqXG4gKiBgcmVzb2x2ZWAgaXMgYSBjYWxsYmFjayB0byBpbnZva2Ugd2l0aCBhIG1vcmUgcmVzb2x2ZWQgdmFsdWUgZm9yIHRoZVxuICogcHJvbWlzZS4gVG8gZnVsZmlsbCB0aGUgcHJvbWlzZSwgaW52b2tlIGByZXNvbHZlYCB3aXRoIGFueSB2YWx1ZSB0aGF0IGlzXG4gKiBub3QgYSB0aGVuYWJsZS4gVG8gcmVqZWN0IHRoZSBwcm9taXNlLCBpbnZva2UgYHJlc29sdmVgIHdpdGggYSByZWplY3RlZFxuICogdGhlbmFibGUsIG9yIGludm9rZSBgcmVqZWN0YCB3aXRoIHRoZSByZWFzb24gZGlyZWN0bHkuIFRvIHJlc29sdmUgdGhlXG4gKiBwcm9taXNlIHRvIGFub3RoZXIgdGhlbmFibGUsIHRodXMgcHV0dGluZyBpdCBpbiB0aGUgc2FtZSBzdGF0ZSwgaW52b2tlXG4gKiBgcmVzb2x2ZWAgd2l0aCB0aGF0IG90aGVyIHRoZW5hYmxlLlxuICovXG5RLmRlZmVyID0gZGVmZXI7XG5mdW5jdGlvbiBkZWZlcigpIHtcbiAgICAvLyBpZiBcIm1lc3NhZ2VzXCIgaXMgYW4gXCJBcnJheVwiLCB0aGF0IGluZGljYXRlcyB0aGF0IHRoZSBwcm9taXNlIGhhcyBub3QgeWV0XG4gICAgLy8gYmVlbiByZXNvbHZlZC4gIElmIGl0IGlzIFwidW5kZWZpbmVkXCIsIGl0IGhhcyBiZWVuIHJlc29sdmVkLiAgRWFjaFxuICAgIC8vIGVsZW1lbnQgb2YgdGhlIG1lc3NhZ2VzIGFycmF5IGlzIGl0c2VsZiBhbiBhcnJheSBvZiBjb21wbGV0ZSBhcmd1bWVudHMgdG9cbiAgICAvLyBmb3J3YXJkIHRvIHRoZSByZXNvbHZlZCBwcm9taXNlLiAgV2UgY29lcmNlIHRoZSByZXNvbHV0aW9uIHZhbHVlIHRvIGFcbiAgICAvLyBwcm9taXNlIHVzaW5nIHRoZSBgcmVzb2x2ZWAgZnVuY3Rpb24gYmVjYXVzZSBpdCBoYW5kbGVzIGJvdGggZnVsbHlcbiAgICAvLyBub24tdGhlbmFibGUgdmFsdWVzIGFuZCBvdGhlciB0aGVuYWJsZXMgZ3JhY2VmdWxseS5cbiAgICB2YXIgbWVzc2FnZXMgPSBbXSwgcHJvZ3Jlc3NMaXN0ZW5lcnMgPSBbXSwgcmVzb2x2ZWRQcm9taXNlO1xuXG4gICAgdmFyIGRlZmVycmVkID0gb2JqZWN0X2NyZWF0ZShkZWZlci5wcm90b3R5cGUpO1xuICAgIHZhciBwcm9taXNlID0gb2JqZWN0X2NyZWF0ZShQcm9taXNlLnByb3RvdHlwZSk7XG5cbiAgICBwcm9taXNlLnByb21pc2VEaXNwYXRjaCA9IGZ1bmN0aW9uIChyZXNvbHZlLCBvcCwgb3BlcmFuZHMpIHtcbiAgICAgICAgdmFyIGFyZ3MgPSBhcnJheV9zbGljZShhcmd1bWVudHMpO1xuICAgICAgICBpZiAobWVzc2FnZXMpIHtcbiAgICAgICAgICAgIG1lc3NhZ2VzLnB1c2goYXJncyk7XG4gICAgICAgICAgICBpZiAob3AgPT09IFwid2hlblwiICYmIG9wZXJhbmRzWzFdKSB7IC8vIHByb2dyZXNzIG9wZXJhbmRcbiAgICAgICAgICAgICAgICBwcm9ncmVzc0xpc3RlbmVycy5wdXNoKG9wZXJhbmRzWzFdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlZFByb21pc2UucHJvbWlzZURpc3BhdGNoLmFwcGx5KHJlc29sdmVkUHJvbWlzZSwgYXJncyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBYWFggZGVwcmVjYXRlZFxuICAgIHByb21pc2UudmFsdWVPZiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKG1lc3NhZ2VzKSB7XG4gICAgICAgICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgbmVhcmVyVmFsdWUgPSBuZWFyZXIocmVzb2x2ZWRQcm9taXNlKTtcbiAgICAgICAgaWYgKGlzUHJvbWlzZShuZWFyZXJWYWx1ZSkpIHtcbiAgICAgICAgICAgIHJlc29sdmVkUHJvbWlzZSA9IG5lYXJlclZhbHVlOyAvLyBzaG9ydGVuIGNoYWluXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5lYXJlclZhbHVlO1xuICAgIH07XG5cbiAgICBwcm9taXNlLmluc3BlY3QgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghcmVzb2x2ZWRQcm9taXNlKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdGF0ZTogXCJwZW5kaW5nXCIgfTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzb2x2ZWRQcm9taXNlLmluc3BlY3QoKTtcbiAgICB9O1xuXG4gICAgaWYgKFEubG9uZ1N0YWNrU3VwcG9ydCAmJiBoYXNTdGFja3MpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAvLyBOT1RFOiBkb24ndCB0cnkgdG8gdXNlIGBFcnJvci5jYXB0dXJlU3RhY2tUcmFjZWAgb3IgdHJhbnNmZXIgdGhlXG4gICAgICAgICAgICAvLyBhY2Nlc3NvciBhcm91bmQ7IHRoYXQgY2F1c2VzIG1lbW9yeSBsZWFrcyBhcyBwZXIgR0gtMTExLiBKdXN0XG4gICAgICAgICAgICAvLyByZWlmeSB0aGUgc3RhY2sgdHJhY2UgYXMgYSBzdHJpbmcgQVNBUC5cbiAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAvLyBBdCB0aGUgc2FtZSB0aW1lLCBjdXQgb2ZmIHRoZSBmaXJzdCBsaW5lOyBpdCdzIGFsd2F5cyBqdXN0XG4gICAgICAgICAgICAvLyBcIltvYmplY3QgUHJvbWlzZV1cXG5cIiwgYXMgcGVyIHRoZSBgdG9TdHJpbmdgLlxuICAgICAgICAgICAgcHJvbWlzZS5zdGFjayA9IGUuc3RhY2suc3Vic3RyaW5nKGUuc3RhY2suaW5kZXhPZihcIlxcblwiKSArIDEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gTk9URTogd2UgZG8gdGhlIGNoZWNrcyBmb3IgYHJlc29sdmVkUHJvbWlzZWAgaW4gZWFjaCBtZXRob2QsIGluc3RlYWQgb2ZcbiAgICAvLyBjb25zb2xpZGF0aW5nIHRoZW0gaW50byBgYmVjb21lYCwgc2luY2Ugb3RoZXJ3aXNlIHdlJ2QgY3JlYXRlIG5ld1xuICAgIC8vIHByb21pc2VzIHdpdGggdGhlIGxpbmVzIGBiZWNvbWUod2hhdGV2ZXIodmFsdWUpKWAuIFNlZSBlLmcuIEdILTI1Mi5cblxuICAgIGZ1bmN0aW9uIGJlY29tZShuZXdQcm9taXNlKSB7XG4gICAgICAgIHJlc29sdmVkUHJvbWlzZSA9IG5ld1Byb21pc2U7XG4gICAgICAgIHByb21pc2Uuc291cmNlID0gbmV3UHJvbWlzZTtcblxuICAgICAgICBhcnJheV9yZWR1Y2UobWVzc2FnZXMsIGZ1bmN0aW9uICh1bmRlZmluZWQsIG1lc3NhZ2UpIHtcbiAgICAgICAgICAgIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBuZXdQcm9taXNlLnByb21pc2VEaXNwYXRjaC5hcHBseShuZXdQcm9taXNlLCBtZXNzYWdlKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LCB2b2lkIDApO1xuXG4gICAgICAgIG1lc3NhZ2VzID0gdm9pZCAwO1xuICAgICAgICBwcm9ncmVzc0xpc3RlbmVycyA9IHZvaWQgMDtcbiAgICB9XG5cbiAgICBkZWZlcnJlZC5wcm9taXNlID0gcHJvbWlzZTtcbiAgICBkZWZlcnJlZC5yZXNvbHZlID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIGlmIChyZXNvbHZlZFByb21pc2UpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGJlY29tZShRKHZhbHVlKSk7XG4gICAgfTtcblxuICAgIGRlZmVycmVkLmZ1bGZpbGwgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgaWYgKHJlc29sdmVkUHJvbWlzZSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgYmVjb21lKGZ1bGZpbGwodmFsdWUpKTtcbiAgICB9O1xuICAgIGRlZmVycmVkLnJlamVjdCA9IGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICAgICAgaWYgKHJlc29sdmVkUHJvbWlzZSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgYmVjb21lKHJlamVjdChyZWFzb24pKTtcbiAgICB9O1xuICAgIGRlZmVycmVkLm5vdGlmeSA9IGZ1bmN0aW9uIChwcm9ncmVzcykge1xuICAgICAgICBpZiAocmVzb2x2ZWRQcm9taXNlKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBhcnJheV9yZWR1Y2UocHJvZ3Jlc3NMaXN0ZW5lcnMsIGZ1bmN0aW9uICh1bmRlZmluZWQsIHByb2dyZXNzTGlzdGVuZXIpIHtcbiAgICAgICAgICAgIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBwcm9ncmVzc0xpc3RlbmVyKHByb2dyZXNzKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LCB2b2lkIDApO1xuICAgIH07XG5cbiAgICByZXR1cm4gZGVmZXJyZWQ7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIE5vZGUtc3R5bGUgY2FsbGJhY2sgdGhhdCB3aWxsIHJlc29sdmUgb3IgcmVqZWN0IHRoZSBkZWZlcnJlZFxuICogcHJvbWlzZS5cbiAqIEByZXR1cm5zIGEgbm9kZWJhY2tcbiAqL1xuZGVmZXIucHJvdG90eXBlLm1ha2VOb2RlUmVzb2x2ZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBmdW5jdGlvbiAoZXJyb3IsIHZhbHVlKSB7XG4gICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgc2VsZi5yZWplY3QoZXJyb3IpO1xuICAgICAgICB9IGVsc2UgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAyKSB7XG4gICAgICAgICAgICBzZWxmLnJlc29sdmUoYXJyYXlfc2xpY2UoYXJndW1lbnRzLCAxKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzZWxmLnJlc29sdmUodmFsdWUpO1xuICAgICAgICB9XG4gICAgfTtcbn07XG5cbi8qKlxuICogQHBhcmFtIHJlc29sdmVyIHtGdW5jdGlvbn0gYSBmdW5jdGlvbiB0aGF0IHJldHVybnMgbm90aGluZyBhbmQgYWNjZXB0c1xuICogdGhlIHJlc29sdmUsIHJlamVjdCwgYW5kIG5vdGlmeSBmdW5jdGlvbnMgZm9yIGEgZGVmZXJyZWQuXG4gKiBAcmV0dXJucyBhIHByb21pc2UgdGhhdCBtYXkgYmUgcmVzb2x2ZWQgd2l0aCB0aGUgZ2l2ZW4gcmVzb2x2ZSBhbmQgcmVqZWN0XG4gKiBmdW5jdGlvbnMsIG9yIHJlamVjdGVkIGJ5IGEgdGhyb3duIGV4Y2VwdGlvbiBpbiByZXNvbHZlclxuICovXG5RLlByb21pc2UgPSBwcm9taXNlOyAvLyBFUzZcblEucHJvbWlzZSA9IHByb21pc2U7XG5mdW5jdGlvbiBwcm9taXNlKHJlc29sdmVyKSB7XG4gICAgaWYgKHR5cGVvZiByZXNvbHZlciAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJyZXNvbHZlciBtdXN0IGJlIGEgZnVuY3Rpb24uXCIpO1xuICAgIH1cbiAgICB2YXIgZGVmZXJyZWQgPSBkZWZlcigpO1xuICAgIHRyeSB7XG4gICAgICAgIHJlc29sdmVyKGRlZmVycmVkLnJlc29sdmUsIGRlZmVycmVkLnJlamVjdCwgZGVmZXJyZWQubm90aWZ5KTtcbiAgICB9IGNhdGNoIChyZWFzb24pIHtcbiAgICAgICAgZGVmZXJyZWQucmVqZWN0KHJlYXNvbik7XG4gICAgfVxuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufVxuXG5wcm9taXNlLnJhY2UgPSByYWNlOyAvLyBFUzZcbnByb21pc2UuYWxsID0gYWxsOyAvLyBFUzZcbnByb21pc2UucmVqZWN0ID0gcmVqZWN0OyAvLyBFUzZcbnByb21pc2UucmVzb2x2ZSA9IFE7IC8vIEVTNlxuXG4vLyBYWFggZXhwZXJpbWVudGFsLiAgVGhpcyBtZXRob2QgaXMgYSB3YXkgdG8gZGVub3RlIHRoYXQgYSBsb2NhbCB2YWx1ZSBpc1xuLy8gc2VyaWFsaXphYmxlIGFuZCBzaG91bGQgYmUgaW1tZWRpYXRlbHkgZGlzcGF0Y2hlZCB0byBhIHJlbW90ZSB1cG9uIHJlcXVlc3QsXG4vLyBpbnN0ZWFkIG9mIHBhc3NpbmcgYSByZWZlcmVuY2UuXG5RLnBhc3NCeUNvcHkgPSBmdW5jdGlvbiAob2JqZWN0KSB7XG4gICAgLy9mcmVlemUob2JqZWN0KTtcbiAgICAvL3Bhc3NCeUNvcGllcy5zZXQob2JqZWN0LCB0cnVlKTtcbiAgICByZXR1cm4gb2JqZWN0O1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUucGFzc0J5Q29weSA9IGZ1bmN0aW9uICgpIHtcbiAgICAvL2ZyZWV6ZShvYmplY3QpO1xuICAgIC8vcGFzc0J5Q29waWVzLnNldChvYmplY3QsIHRydWUpO1xuICAgIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBJZiB0d28gcHJvbWlzZXMgZXZlbnR1YWxseSBmdWxmaWxsIHRvIHRoZSBzYW1lIHZhbHVlLCBwcm9taXNlcyB0aGF0IHZhbHVlLFxuICogYnV0IG90aGVyd2lzZSByZWplY3RzLlxuICogQHBhcmFtIHgge0FueSp9XG4gKiBAcGFyYW0geSB7QW55Kn1cbiAqIEByZXR1cm5zIHtBbnkqfSBhIHByb21pc2UgZm9yIHggYW5kIHkgaWYgdGhleSBhcmUgdGhlIHNhbWUsIGJ1dCBhIHJlamVjdGlvblxuICogb3RoZXJ3aXNlLlxuICpcbiAqL1xuUS5qb2luID0gZnVuY3Rpb24gKHgsIHkpIHtcbiAgICByZXR1cm4gUSh4KS5qb2luKHkpO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuam9pbiA9IGZ1bmN0aW9uICh0aGF0KSB7XG4gICAgcmV0dXJuIFEoW3RoaXMsIHRoYXRdKS5zcHJlYWQoZnVuY3Rpb24gKHgsIHkpIHtcbiAgICAgICAgaWYgKHggPT09IHkpIHtcbiAgICAgICAgICAgIC8vIFRPRE86IFwiPT09XCIgc2hvdWxkIGJlIE9iamVjdC5pcyBvciBlcXVpdlxuICAgICAgICAgICAgcmV0dXJuIHg7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCBqb2luOiBub3QgdGhlIHNhbWU6IFwiICsgeCArIFwiIFwiICsgeSk7XG4gICAgICAgIH1cbiAgICB9KTtcbn07XG5cbi8qKlxuICogUmV0dXJucyBhIHByb21pc2UgZm9yIHRoZSBmaXJzdCBvZiBhbiBhcnJheSBvZiBwcm9taXNlcyB0byBiZWNvbWUgZnVsZmlsbGVkLlxuICogQHBhcmFtIGFuc3dlcnMge0FycmF5W0FueSpdfSBwcm9taXNlcyB0byByYWNlXG4gKiBAcmV0dXJucyB7QW55Kn0gdGhlIGZpcnN0IHByb21pc2UgdG8gYmUgZnVsZmlsbGVkXG4gKi9cblEucmFjZSA9IHJhY2U7XG5mdW5jdGlvbiByYWNlKGFuc3dlclBzKSB7XG4gICAgcmV0dXJuIHByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIC8vIFN3aXRjaCB0byB0aGlzIG9uY2Ugd2UgY2FuIGFzc3VtZSBhdCBsZWFzdCBFUzVcbiAgICAgICAgLy8gYW5zd2VyUHMuZm9yRWFjaChmdW5jdGlvbihhbnN3ZXJQKSB7XG4gICAgICAgIC8vICAgICBRKGFuc3dlclApLnRoZW4ocmVzb2x2ZSwgcmVqZWN0KTtcbiAgICAgICAgLy8gfSk7XG4gICAgICAgIC8vIFVzZSB0aGlzIGluIHRoZSBtZWFudGltZVxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gYW5zd2VyUHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIFEoYW5zd2VyUHNbaV0pLnRoZW4ocmVzb2x2ZSwgcmVqZWN0KTtcbiAgICAgICAgfVxuICAgIH0pO1xufVxuXG5Qcm9taXNlLnByb3RvdHlwZS5yYWNlID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLnRoZW4oUS5yYWNlKTtcbn07XG5cbi8qKlxuICogQ29uc3RydWN0cyBhIFByb21pc2Ugd2l0aCBhIHByb21pc2UgZGVzY3JpcHRvciBvYmplY3QgYW5kIG9wdGlvbmFsIGZhbGxiYWNrXG4gKiBmdW5jdGlvbi4gIFRoZSBkZXNjcmlwdG9yIGNvbnRhaW5zIG1ldGhvZHMgbGlrZSB3aGVuKHJlamVjdGVkKSwgZ2V0KG5hbWUpLFxuICogc2V0KG5hbWUsIHZhbHVlKSwgcG9zdChuYW1lLCBhcmdzKSwgYW5kIGRlbGV0ZShuYW1lKSwgd2hpY2ggYWxsXG4gKiByZXR1cm4gZWl0aGVyIGEgdmFsdWUsIGEgcHJvbWlzZSBmb3IgYSB2YWx1ZSwgb3IgYSByZWplY3Rpb24uICBUaGUgZmFsbGJhY2tcbiAqIGFjY2VwdHMgdGhlIG9wZXJhdGlvbiBuYW1lLCBhIHJlc29sdmVyLCBhbmQgYW55IGZ1cnRoZXIgYXJndW1lbnRzIHRoYXQgd291bGRcbiAqIGhhdmUgYmVlbiBmb3J3YXJkZWQgdG8gdGhlIGFwcHJvcHJpYXRlIG1ldGhvZCBhYm92ZSBoYWQgYSBtZXRob2QgYmVlblxuICogcHJvdmlkZWQgd2l0aCB0aGUgcHJvcGVyIG5hbWUuICBUaGUgQVBJIG1ha2VzIG5vIGd1YXJhbnRlZXMgYWJvdXQgdGhlIG5hdHVyZVxuICogb2YgdGhlIHJldHVybmVkIG9iamVjdCwgYXBhcnQgZnJvbSB0aGF0IGl0IGlzIHVzYWJsZSB3aGVyZWV2ZXIgcHJvbWlzZXMgYXJlXG4gKiBib3VnaHQgYW5kIHNvbGQuXG4gKi9cblEubWFrZVByb21pc2UgPSBQcm9taXNlO1xuZnVuY3Rpb24gUHJvbWlzZShkZXNjcmlwdG9yLCBmYWxsYmFjaywgaW5zcGVjdCkge1xuICAgIGlmIChmYWxsYmFjayA9PT0gdm9pZCAwKSB7XG4gICAgICAgIGZhbGxiYWNrID0gZnVuY3Rpb24gKG9wKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVqZWN0KG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgICBcIlByb21pc2UgZG9lcyBub3Qgc3VwcG9ydCBvcGVyYXRpb246IFwiICsgb3BcbiAgICAgICAgICAgICkpO1xuICAgICAgICB9O1xuICAgIH1cbiAgICBpZiAoaW5zcGVjdCA9PT0gdm9pZCAwKSB7XG4gICAgICAgIGluc3BlY3QgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4ge3N0YXRlOiBcInVua25vd25cIn07XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgdmFyIHByb21pc2UgPSBvYmplY3RfY3JlYXRlKFByb21pc2UucHJvdG90eXBlKTtcblxuICAgIHByb21pc2UucHJvbWlzZURpc3BhdGNoID0gZnVuY3Rpb24gKHJlc29sdmUsIG9wLCBhcmdzKSB7XG4gICAgICAgIHZhciByZXN1bHQ7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAoZGVzY3JpcHRvcltvcF0pIHtcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBkZXNjcmlwdG9yW29wXS5hcHBseShwcm9taXNlLCBhcmdzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gZmFsbGJhY2suY2FsbChwcm9taXNlLCBvcCwgYXJncyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGV4Y2VwdGlvbikge1xuICAgICAgICAgICAgcmVzdWx0ID0gcmVqZWN0KGV4Y2VwdGlvbik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJlc29sdmUpIHtcbiAgICAgICAgICAgIHJlc29sdmUocmVzdWx0KTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBwcm9taXNlLmluc3BlY3QgPSBpbnNwZWN0O1xuXG4gICAgLy8gWFhYIGRlcHJlY2F0ZWQgYHZhbHVlT2ZgIGFuZCBgZXhjZXB0aW9uYCBzdXBwb3J0XG4gICAgaWYgKGluc3BlY3QpIHtcbiAgICAgICAgdmFyIGluc3BlY3RlZCA9IGluc3BlY3QoKTtcbiAgICAgICAgaWYgKGluc3BlY3RlZC5zdGF0ZSA9PT0gXCJyZWplY3RlZFwiKSB7XG4gICAgICAgICAgICBwcm9taXNlLmV4Y2VwdGlvbiA9IGluc3BlY3RlZC5yZWFzb247XG4gICAgICAgIH1cblxuICAgICAgICBwcm9taXNlLnZhbHVlT2YgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgaW5zcGVjdGVkID0gaW5zcGVjdCgpO1xuICAgICAgICAgICAgaWYgKGluc3BlY3RlZC5zdGF0ZSA9PT0gXCJwZW5kaW5nXCIgfHxcbiAgICAgICAgICAgICAgICBpbnNwZWN0ZWQuc3RhdGUgPT09IFwicmVqZWN0ZWRcIikge1xuICAgICAgICAgICAgICAgIHJldHVybiBwcm9taXNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGluc3BlY3RlZC52YWx1ZTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4gcHJvbWlzZTtcbn1cblxuUHJvbWlzZS5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIFwiW29iamVjdCBQcm9taXNlXVwiO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUudGhlbiA9IGZ1bmN0aW9uIChmdWxmaWxsZWQsIHJlamVjdGVkLCBwcm9ncmVzc2VkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBkZWZlcnJlZCA9IGRlZmVyKCk7XG4gICAgdmFyIGRvbmUgPSBmYWxzZTsgICAvLyBlbnN1cmUgdGhlIHVudHJ1c3RlZCBwcm9taXNlIG1ha2VzIGF0IG1vc3QgYVxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gc2luZ2xlIGNhbGwgdG8gb25lIG9mIHRoZSBjYWxsYmFja3NcblxuICAgIGZ1bmN0aW9uIF9mdWxmaWxsZWQodmFsdWUpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJldHVybiB0eXBlb2YgZnVsZmlsbGVkID09PSBcImZ1bmN0aW9uXCIgPyBmdWxmaWxsZWQodmFsdWUpIDogdmFsdWU7XG4gICAgICAgIH0gY2F0Y2ggKGV4Y2VwdGlvbikge1xuICAgICAgICAgICAgcmV0dXJuIHJlamVjdChleGNlcHRpb24pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX3JlamVjdGVkKGV4Y2VwdGlvbikge1xuICAgICAgICBpZiAodHlwZW9mIHJlamVjdGVkID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgIG1ha2VTdGFja1RyYWNlTG9uZyhleGNlcHRpb24sIHNlbGYpO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVqZWN0ZWQoZXhjZXB0aW9uKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKG5ld0V4Y2VwdGlvbikge1xuICAgICAgICAgICAgICAgIHJldHVybiByZWplY3QobmV3RXhjZXB0aW9uKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVqZWN0KGV4Y2VwdGlvbik7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX3Byb2dyZXNzZWQodmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHR5cGVvZiBwcm9ncmVzc2VkID09PSBcImZ1bmN0aW9uXCIgPyBwcm9ncmVzc2VkKHZhbHVlKSA6IHZhbHVlO1xuICAgIH1cblxuICAgIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgc2VsZi5wcm9taXNlRGlzcGF0Y2goZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICBpZiAoZG9uZSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRvbmUgPSB0cnVlO1xuXG4gICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKF9mdWxmaWxsZWQodmFsdWUpKTtcbiAgICAgICAgfSwgXCJ3aGVuXCIsIFtmdW5jdGlvbiAoZXhjZXB0aW9uKSB7XG4gICAgICAgICAgICBpZiAoZG9uZSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRvbmUgPSB0cnVlO1xuXG4gICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKF9yZWplY3RlZChleGNlcHRpb24pKTtcbiAgICAgICAgfV0pO1xuICAgIH0pO1xuXG4gICAgLy8gUHJvZ3Jlc3MgcHJvcGFnYXRvciBuZWVkIHRvIGJlIGF0dGFjaGVkIGluIHRoZSBjdXJyZW50IHRpY2suXG4gICAgc2VsZi5wcm9taXNlRGlzcGF0Y2godm9pZCAwLCBcIndoZW5cIiwgW3ZvaWQgMCwgZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIHZhciBuZXdWYWx1ZTtcbiAgICAgICAgdmFyIHRocmV3ID0gZmFsc2U7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBuZXdWYWx1ZSA9IF9wcm9ncmVzc2VkKHZhbHVlKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhyZXcgPSB0cnVlO1xuICAgICAgICAgICAgaWYgKFEub25lcnJvcikge1xuICAgICAgICAgICAgICAgIFEub25lcnJvcihlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhyZXcpIHtcbiAgICAgICAgICAgIGRlZmVycmVkLm5vdGlmeShuZXdWYWx1ZSk7XG4gICAgICAgIH1cbiAgICB9XSk7XG5cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn07XG5cbi8qKlxuICogUmVnaXN0ZXJzIGFuIG9ic2VydmVyIG9uIGEgcHJvbWlzZS5cbiAqXG4gKiBHdWFyYW50ZWVzOlxuICpcbiAqIDEuIHRoYXQgZnVsZmlsbGVkIGFuZCByZWplY3RlZCB3aWxsIGJlIGNhbGxlZCBvbmx5IG9uY2UuXG4gKiAyLiB0aGF0IGVpdGhlciB0aGUgZnVsZmlsbGVkIGNhbGxiYWNrIG9yIHRoZSByZWplY3RlZCBjYWxsYmFjayB3aWxsIGJlXG4gKiAgICBjYWxsZWQsIGJ1dCBub3QgYm90aC5cbiAqIDMuIHRoYXQgZnVsZmlsbGVkIGFuZCByZWplY3RlZCB3aWxsIG5vdCBiZSBjYWxsZWQgaW4gdGhpcyB0dXJuLlxuICpcbiAqIEBwYXJhbSB2YWx1ZSAgICAgIHByb21pc2Ugb3IgaW1tZWRpYXRlIHJlZmVyZW5jZSB0byBvYnNlcnZlXG4gKiBAcGFyYW0gZnVsZmlsbGVkICBmdW5jdGlvbiB0byBiZSBjYWxsZWQgd2l0aCB0aGUgZnVsZmlsbGVkIHZhbHVlXG4gKiBAcGFyYW0gcmVqZWN0ZWQgICBmdW5jdGlvbiB0byBiZSBjYWxsZWQgd2l0aCB0aGUgcmVqZWN0aW9uIGV4Y2VwdGlvblxuICogQHBhcmFtIHByb2dyZXNzZWQgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIG9uIGFueSBwcm9ncmVzcyBub3RpZmljYXRpb25zXG4gKiBAcmV0dXJuIHByb21pc2UgZm9yIHRoZSByZXR1cm4gdmFsdWUgZnJvbSB0aGUgaW52b2tlZCBjYWxsYmFja1xuICovXG5RLndoZW4gPSB3aGVuO1xuZnVuY3Rpb24gd2hlbih2YWx1ZSwgZnVsZmlsbGVkLCByZWplY3RlZCwgcHJvZ3Jlc3NlZCkge1xuICAgIHJldHVybiBRKHZhbHVlKS50aGVuKGZ1bGZpbGxlZCwgcmVqZWN0ZWQsIHByb2dyZXNzZWQpO1xufVxuXG5Qcm9taXNlLnByb3RvdHlwZS50aGVuUmVzb2x2ZSA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgIHJldHVybiB0aGlzLnRoZW4oZnVuY3Rpb24gKCkgeyByZXR1cm4gdmFsdWU7IH0pO1xufTtcblxuUS50aGVuUmVzb2x2ZSA9IGZ1bmN0aW9uIChwcm9taXNlLCB2YWx1ZSkge1xuICAgIHJldHVybiBRKHByb21pc2UpLnRoZW5SZXNvbHZlKHZhbHVlKTtcbn07XG5cblByb21pc2UucHJvdG90eXBlLnRoZW5SZWplY3QgPSBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgcmV0dXJuIHRoaXMudGhlbihmdW5jdGlvbiAoKSB7IHRocm93IHJlYXNvbjsgfSk7XG59O1xuXG5RLnRoZW5SZWplY3QgPSBmdW5jdGlvbiAocHJvbWlzZSwgcmVhc29uKSB7XG4gICAgcmV0dXJuIFEocHJvbWlzZSkudGhlblJlamVjdChyZWFzb24pO1xufTtcblxuLyoqXG4gKiBJZiBhbiBvYmplY3QgaXMgbm90IGEgcHJvbWlzZSwgaXQgaXMgYXMgXCJuZWFyXCIgYXMgcG9zc2libGUuXG4gKiBJZiBhIHByb21pc2UgaXMgcmVqZWN0ZWQsIGl0IGlzIGFzIFwibmVhclwiIGFzIHBvc3NpYmxlIHRvby5cbiAqIElmIGl04oCZcyBhIGZ1bGZpbGxlZCBwcm9taXNlLCB0aGUgZnVsZmlsbG1lbnQgdmFsdWUgaXMgbmVhcmVyLlxuICogSWYgaXTigJlzIGEgZGVmZXJyZWQgcHJvbWlzZSBhbmQgdGhlIGRlZmVycmVkIGhhcyBiZWVuIHJlc29sdmVkLCB0aGVcbiAqIHJlc29sdXRpb24gaXMgXCJuZWFyZXJcIi5cbiAqIEBwYXJhbSBvYmplY3RcbiAqIEByZXR1cm5zIG1vc3QgcmVzb2x2ZWQgKG5lYXJlc3QpIGZvcm0gb2YgdGhlIG9iamVjdFxuICovXG5cbi8vIFhYWCBzaG91bGQgd2UgcmUtZG8gdGhpcz9cblEubmVhcmVyID0gbmVhcmVyO1xuZnVuY3Rpb24gbmVhcmVyKHZhbHVlKSB7XG4gICAgaWYgKGlzUHJvbWlzZSh2YWx1ZSkpIHtcbiAgICAgICAgdmFyIGluc3BlY3RlZCA9IHZhbHVlLmluc3BlY3QoKTtcbiAgICAgICAgaWYgKGluc3BlY3RlZC5zdGF0ZSA9PT0gXCJmdWxmaWxsZWRcIikge1xuICAgICAgICAgICAgcmV0dXJuIGluc3BlY3RlZC52YWx1ZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdmFsdWU7XG59XG5cbi8qKlxuICogQHJldHVybnMgd2hldGhlciB0aGUgZ2l2ZW4gb2JqZWN0IGlzIGEgcHJvbWlzZS5cbiAqIE90aGVyd2lzZSBpdCBpcyBhIGZ1bGZpbGxlZCB2YWx1ZS5cbiAqL1xuUS5pc1Byb21pc2UgPSBpc1Byb21pc2U7XG5mdW5jdGlvbiBpc1Byb21pc2Uob2JqZWN0KSB7XG4gICAgcmV0dXJuIGlzT2JqZWN0KG9iamVjdCkgJiZcbiAgICAgICAgdHlwZW9mIG9iamVjdC5wcm9taXNlRGlzcGF0Y2ggPT09IFwiZnVuY3Rpb25cIiAmJlxuICAgICAgICB0eXBlb2Ygb2JqZWN0Lmluc3BlY3QgPT09IFwiZnVuY3Rpb25cIjtcbn1cblxuUS5pc1Byb21pc2VBbGlrZSA9IGlzUHJvbWlzZUFsaWtlO1xuZnVuY3Rpb24gaXNQcm9taXNlQWxpa2Uob2JqZWN0KSB7XG4gICAgcmV0dXJuIGlzT2JqZWN0KG9iamVjdCkgJiYgdHlwZW9mIG9iamVjdC50aGVuID09PSBcImZ1bmN0aW9uXCI7XG59XG5cbi8qKlxuICogQHJldHVybnMgd2hldGhlciB0aGUgZ2l2ZW4gb2JqZWN0IGlzIGEgcGVuZGluZyBwcm9taXNlLCBtZWFuaW5nIG5vdFxuICogZnVsZmlsbGVkIG9yIHJlamVjdGVkLlxuICovXG5RLmlzUGVuZGluZyA9IGlzUGVuZGluZztcbmZ1bmN0aW9uIGlzUGVuZGluZyhvYmplY3QpIHtcbiAgICByZXR1cm4gaXNQcm9taXNlKG9iamVjdCkgJiYgb2JqZWN0Lmluc3BlY3QoKS5zdGF0ZSA9PT0gXCJwZW5kaW5nXCI7XG59XG5cblByb21pc2UucHJvdG90eXBlLmlzUGVuZGluZyA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5pbnNwZWN0KCkuc3RhdGUgPT09IFwicGVuZGluZ1wiO1xufTtcblxuLyoqXG4gKiBAcmV0dXJucyB3aGV0aGVyIHRoZSBnaXZlbiBvYmplY3QgaXMgYSB2YWx1ZSBvciBmdWxmaWxsZWRcbiAqIHByb21pc2UuXG4gKi9cblEuaXNGdWxmaWxsZWQgPSBpc0Z1bGZpbGxlZDtcbmZ1bmN0aW9uIGlzRnVsZmlsbGVkKG9iamVjdCkge1xuICAgIHJldHVybiAhaXNQcm9taXNlKG9iamVjdCkgfHwgb2JqZWN0Lmluc3BlY3QoKS5zdGF0ZSA9PT0gXCJmdWxmaWxsZWRcIjtcbn1cblxuUHJvbWlzZS5wcm90b3R5cGUuaXNGdWxmaWxsZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuaW5zcGVjdCgpLnN0YXRlID09PSBcImZ1bGZpbGxlZFwiO1xufTtcblxuLyoqXG4gKiBAcmV0dXJucyB3aGV0aGVyIHRoZSBnaXZlbiBvYmplY3QgaXMgYSByZWplY3RlZCBwcm9taXNlLlxuICovXG5RLmlzUmVqZWN0ZWQgPSBpc1JlamVjdGVkO1xuZnVuY3Rpb24gaXNSZWplY3RlZChvYmplY3QpIHtcbiAgICByZXR1cm4gaXNQcm9taXNlKG9iamVjdCkgJiYgb2JqZWN0Lmluc3BlY3QoKS5zdGF0ZSA9PT0gXCJyZWplY3RlZFwiO1xufVxuXG5Qcm9taXNlLnByb3RvdHlwZS5pc1JlamVjdGVkID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmluc3BlY3QoKS5zdGF0ZSA9PT0gXCJyZWplY3RlZFwiO1xufTtcblxuLy8vLyBCRUdJTiBVTkhBTkRMRUQgUkVKRUNUSU9OIFRSQUNLSU5HXG5cbi8vIFRoaXMgcHJvbWlzZSBsaWJyYXJ5IGNvbnN1bWVzIGV4Y2VwdGlvbnMgdGhyb3duIGluIGhhbmRsZXJzIHNvIHRoZXkgY2FuIGJlXG4vLyBoYW5kbGVkIGJ5IGEgc3Vic2VxdWVudCBwcm9taXNlLiAgVGhlIGV4Y2VwdGlvbnMgZ2V0IGFkZGVkIHRvIHRoaXMgYXJyYXkgd2hlblxuLy8gdGhleSBhcmUgY3JlYXRlZCwgYW5kIHJlbW92ZWQgd2hlbiB0aGV5IGFyZSBoYW5kbGVkLiAgTm90ZSB0aGF0IGluIEVTNiBvclxuLy8gc2hpbW1lZCBlbnZpcm9ubWVudHMsIHRoaXMgd291bGQgbmF0dXJhbGx5IGJlIGEgYFNldGAuXG52YXIgdW5oYW5kbGVkUmVhc29ucyA9IFtdO1xudmFyIHVuaGFuZGxlZFJlamVjdGlvbnMgPSBbXTtcbnZhciB0cmFja1VuaGFuZGxlZFJlamVjdGlvbnMgPSB0cnVlO1xuXG5mdW5jdGlvbiByZXNldFVuaGFuZGxlZFJlamVjdGlvbnMoKSB7XG4gICAgdW5oYW5kbGVkUmVhc29ucy5sZW5ndGggPSAwO1xuICAgIHVuaGFuZGxlZFJlamVjdGlvbnMubGVuZ3RoID0gMDtcblxuICAgIGlmICghdHJhY2tVbmhhbmRsZWRSZWplY3Rpb25zKSB7XG4gICAgICAgIHRyYWNrVW5oYW5kbGVkUmVqZWN0aW9ucyA9IHRydWU7XG4gICAgfVxufVxuXG5mdW5jdGlvbiB0cmFja1JlamVjdGlvbihwcm9taXNlLCByZWFzb24pIHtcbiAgICBpZiAoIXRyYWNrVW5oYW5kbGVkUmVqZWN0aW9ucykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdW5oYW5kbGVkUmVqZWN0aW9ucy5wdXNoKHByb21pc2UpO1xuICAgIGlmIChyZWFzb24gJiYgdHlwZW9mIHJlYXNvbi5zdGFjayAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICB1bmhhbmRsZWRSZWFzb25zLnB1c2gocmVhc29uLnN0YWNrKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB1bmhhbmRsZWRSZWFzb25zLnB1c2goXCIobm8gc3RhY2spIFwiICsgcmVhc29uKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHVudHJhY2tSZWplY3Rpb24ocHJvbWlzZSkge1xuICAgIGlmICghdHJhY2tVbmhhbmRsZWRSZWplY3Rpb25zKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgYXQgPSBhcnJheV9pbmRleE9mKHVuaGFuZGxlZFJlamVjdGlvbnMsIHByb21pc2UpO1xuICAgIGlmIChhdCAhPT0gLTEpIHtcbiAgICAgICAgdW5oYW5kbGVkUmVqZWN0aW9ucy5zcGxpY2UoYXQsIDEpO1xuICAgICAgICB1bmhhbmRsZWRSZWFzb25zLnNwbGljZShhdCwgMSk7XG4gICAgfVxufVxuXG5RLnJlc2V0VW5oYW5kbGVkUmVqZWN0aW9ucyA9IHJlc2V0VW5oYW5kbGVkUmVqZWN0aW9ucztcblxuUS5nZXRVbmhhbmRsZWRSZWFzb25zID0gZnVuY3Rpb24gKCkge1xuICAgIC8vIE1ha2UgYSBjb3B5IHNvIHRoYXQgY29uc3VtZXJzIGNhbid0IGludGVyZmVyZSB3aXRoIG91ciBpbnRlcm5hbCBzdGF0ZS5cbiAgICByZXR1cm4gdW5oYW5kbGVkUmVhc29ucy5zbGljZSgpO1xufTtcblxuUS5zdG9wVW5oYW5kbGVkUmVqZWN0aW9uVHJhY2tpbmcgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmVzZXRVbmhhbmRsZWRSZWplY3Rpb25zKCk7XG4gICAgdHJhY2tVbmhhbmRsZWRSZWplY3Rpb25zID0gZmFsc2U7XG59O1xuXG5yZXNldFVuaGFuZGxlZFJlamVjdGlvbnMoKTtcblxuLy8vLyBFTkQgVU5IQU5ETEVEIFJFSkVDVElPTiBUUkFDS0lOR1xuXG4vKipcbiAqIENvbnN0cnVjdHMgYSByZWplY3RlZCBwcm9taXNlLlxuICogQHBhcmFtIHJlYXNvbiB2YWx1ZSBkZXNjcmliaW5nIHRoZSBmYWlsdXJlXG4gKi9cblEucmVqZWN0ID0gcmVqZWN0O1xuZnVuY3Rpb24gcmVqZWN0KHJlYXNvbikge1xuICAgIHZhciByZWplY3Rpb24gPSBQcm9taXNlKHtcbiAgICAgICAgXCJ3aGVuXCI6IGZ1bmN0aW9uIChyZWplY3RlZCkge1xuICAgICAgICAgICAgLy8gbm90ZSB0aGF0IHRoZSBlcnJvciBoYXMgYmVlbiBoYW5kbGVkXG4gICAgICAgICAgICBpZiAocmVqZWN0ZWQpIHtcbiAgICAgICAgICAgICAgICB1bnRyYWNrUmVqZWN0aW9uKHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHJlamVjdGVkID8gcmVqZWN0ZWQocmVhc29uKSA6IHRoaXM7XG4gICAgICAgIH1cbiAgICB9LCBmdW5jdGlvbiBmYWxsYmFjaygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSwgZnVuY3Rpb24gaW5zcGVjdCgpIHtcbiAgICAgICAgcmV0dXJuIHsgc3RhdGU6IFwicmVqZWN0ZWRcIiwgcmVhc29uOiByZWFzb24gfTtcbiAgICB9KTtcblxuICAgIC8vIE5vdGUgdGhhdCB0aGUgcmVhc29uIGhhcyBub3QgYmVlbiBoYW5kbGVkLlxuICAgIHRyYWNrUmVqZWN0aW9uKHJlamVjdGlvbiwgcmVhc29uKTtcblxuICAgIHJldHVybiByZWplY3Rpb247XG59XG5cbi8qKlxuICogQ29uc3RydWN0cyBhIGZ1bGZpbGxlZCBwcm9taXNlIGZvciBhbiBpbW1lZGlhdGUgcmVmZXJlbmNlLlxuICogQHBhcmFtIHZhbHVlIGltbWVkaWF0ZSByZWZlcmVuY2VcbiAqL1xuUS5mdWxmaWxsID0gZnVsZmlsbDtcbmZ1bmN0aW9uIGZ1bGZpbGwodmFsdWUpIHtcbiAgICByZXR1cm4gUHJvbWlzZSh7XG4gICAgICAgIFwid2hlblwiOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgIH0sXG4gICAgICAgIFwiZ2V0XCI6IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICAgICAgICByZXR1cm4gdmFsdWVbbmFtZV07XG4gICAgICAgIH0sXG4gICAgICAgIFwic2V0XCI6IGZ1bmN0aW9uIChuYW1lLCByaHMpIHtcbiAgICAgICAgICAgIHZhbHVlW25hbWVdID0gcmhzO1xuICAgICAgICB9LFxuICAgICAgICBcImRlbGV0ZVwiOiBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgICAgICAgZGVsZXRlIHZhbHVlW25hbWVdO1xuICAgICAgICB9LFxuICAgICAgICBcInBvc3RcIjogZnVuY3Rpb24gKG5hbWUsIGFyZ3MpIHtcbiAgICAgICAgICAgIC8vIE1hcmsgTWlsbGVyIHByb3Bvc2VzIHRoYXQgcG9zdCB3aXRoIG5vIG5hbWUgc2hvdWxkIGFwcGx5IGFcbiAgICAgICAgICAgIC8vIHByb21pc2VkIGZ1bmN0aW9uLlxuICAgICAgICAgICAgaWYgKG5hbWUgPT09IG51bGwgfHwgbmFtZSA9PT0gdm9pZCAwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHZhbHVlLmFwcGx5KHZvaWQgMCwgYXJncyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZVtuYW1lXS5hcHBseSh2YWx1ZSwgYXJncyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIFwiYXBwbHlcIjogZnVuY3Rpb24gKHRoaXNwLCBhcmdzKSB7XG4gICAgICAgICAgICByZXR1cm4gdmFsdWUuYXBwbHkodGhpc3AsIGFyZ3MpO1xuICAgICAgICB9LFxuICAgICAgICBcImtleXNcIjogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIG9iamVjdF9rZXlzKHZhbHVlKTtcbiAgICAgICAgfVxuICAgIH0sIHZvaWQgMCwgZnVuY3Rpb24gaW5zcGVjdCgpIHtcbiAgICAgICAgcmV0dXJuIHsgc3RhdGU6IFwiZnVsZmlsbGVkXCIsIHZhbHVlOiB2YWx1ZSB9O1xuICAgIH0pO1xufVxuXG4vKipcbiAqIENvbnZlcnRzIHRoZW5hYmxlcyB0byBRIHByb21pc2VzLlxuICogQHBhcmFtIHByb21pc2UgdGhlbmFibGUgcHJvbWlzZVxuICogQHJldHVybnMgYSBRIHByb21pc2VcbiAqL1xuZnVuY3Rpb24gY29lcmNlKHByb21pc2UpIHtcbiAgICB2YXIgZGVmZXJyZWQgPSBkZWZlcigpO1xuICAgIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHByb21pc2UudGhlbihkZWZlcnJlZC5yZXNvbHZlLCBkZWZlcnJlZC5yZWplY3QsIGRlZmVycmVkLm5vdGlmeSk7XG4gICAgICAgIH0gY2F0Y2ggKGV4Y2VwdGlvbikge1xuICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGV4Y2VwdGlvbik7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn1cblxuLyoqXG4gKiBBbm5vdGF0ZXMgYW4gb2JqZWN0IHN1Y2ggdGhhdCBpdCB3aWxsIG5ldmVyIGJlXG4gKiB0cmFuc2ZlcnJlZCBhd2F5IGZyb20gdGhpcyBwcm9jZXNzIG92ZXIgYW55IHByb21pc2VcbiAqIGNvbW11bmljYXRpb24gY2hhbm5lbC5cbiAqIEBwYXJhbSBvYmplY3RcbiAqIEByZXR1cm5zIHByb21pc2UgYSB3cmFwcGluZyBvZiB0aGF0IG9iamVjdCB0aGF0XG4gKiBhZGRpdGlvbmFsbHkgcmVzcG9uZHMgdG8gdGhlIFwiaXNEZWZcIiBtZXNzYWdlXG4gKiB3aXRob3V0IGEgcmVqZWN0aW9uLlxuICovXG5RLm1hc3RlciA9IG1hc3RlcjtcbmZ1bmN0aW9uIG1hc3RlcihvYmplY3QpIHtcbiAgICByZXR1cm4gUHJvbWlzZSh7XG4gICAgICAgIFwiaXNEZWZcIjogZnVuY3Rpb24gKCkge31cbiAgICB9LCBmdW5jdGlvbiBmYWxsYmFjayhvcCwgYXJncykge1xuICAgICAgICByZXR1cm4gZGlzcGF0Y2gob2JqZWN0LCBvcCwgYXJncyk7XG4gICAgfSwgZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gUShvYmplY3QpLmluc3BlY3QoKTtcbiAgICB9KTtcbn1cblxuLyoqXG4gKiBTcHJlYWRzIHRoZSB2YWx1ZXMgb2YgYSBwcm9taXNlZCBhcnJheSBvZiBhcmd1bWVudHMgaW50byB0aGVcbiAqIGZ1bGZpbGxtZW50IGNhbGxiYWNrLlxuICogQHBhcmFtIGZ1bGZpbGxlZCBjYWxsYmFjayB0aGF0IHJlY2VpdmVzIHZhcmlhZGljIGFyZ3VtZW50cyBmcm9tIHRoZVxuICogcHJvbWlzZWQgYXJyYXlcbiAqIEBwYXJhbSByZWplY3RlZCBjYWxsYmFjayB0aGF0IHJlY2VpdmVzIHRoZSBleGNlcHRpb24gaWYgdGhlIHByb21pc2VcbiAqIGlzIHJlamVjdGVkLlxuICogQHJldHVybnMgYSBwcm9taXNlIGZvciB0aGUgcmV0dXJuIHZhbHVlIG9yIHRocm93biBleGNlcHRpb24gb2ZcbiAqIGVpdGhlciBjYWxsYmFjay5cbiAqL1xuUS5zcHJlYWQgPSBzcHJlYWQ7XG5mdW5jdGlvbiBzcHJlYWQodmFsdWUsIGZ1bGZpbGxlZCwgcmVqZWN0ZWQpIHtcbiAgICByZXR1cm4gUSh2YWx1ZSkuc3ByZWFkKGZ1bGZpbGxlZCwgcmVqZWN0ZWQpO1xufVxuXG5Qcm9taXNlLnByb3RvdHlwZS5zcHJlYWQgPSBmdW5jdGlvbiAoZnVsZmlsbGVkLCByZWplY3RlZCkge1xuICAgIHJldHVybiB0aGlzLmFsbCgpLnRoZW4oZnVuY3Rpb24gKGFycmF5KSB7XG4gICAgICAgIHJldHVybiBmdWxmaWxsZWQuYXBwbHkodm9pZCAwLCBhcnJheSk7XG4gICAgfSwgcmVqZWN0ZWQpO1xufTtcblxuLyoqXG4gKiBUaGUgYXN5bmMgZnVuY3Rpb24gaXMgYSBkZWNvcmF0b3IgZm9yIGdlbmVyYXRvciBmdW5jdGlvbnMsIHR1cm5pbmdcbiAqIHRoZW0gaW50byBhc3luY2hyb25vdXMgZ2VuZXJhdG9ycy4gIEFsdGhvdWdoIGdlbmVyYXRvcnMgYXJlIG9ubHkgcGFydFxuICogb2YgdGhlIG5ld2VzdCBFQ01BU2NyaXB0IDYgZHJhZnRzLCB0aGlzIGNvZGUgZG9lcyBub3QgY2F1c2Ugc3ludGF4XG4gKiBlcnJvcnMgaW4gb2xkZXIgZW5naW5lcy4gIFRoaXMgY29kZSBzaG91bGQgY29udGludWUgdG8gd29yayBhbmQgd2lsbFxuICogaW4gZmFjdCBpbXByb3ZlIG92ZXIgdGltZSBhcyB0aGUgbGFuZ3VhZ2UgaW1wcm92ZXMuXG4gKlxuICogRVM2IGdlbmVyYXRvcnMgYXJlIGN1cnJlbnRseSBwYXJ0IG9mIFY4IHZlcnNpb24gMy4xOSB3aXRoIHRoZVxuICogLS1oYXJtb255LWdlbmVyYXRvcnMgcnVudGltZSBmbGFnIGVuYWJsZWQuICBTcGlkZXJNb25rZXkgaGFzIGhhZCB0aGVtXG4gKiBmb3IgbG9uZ2VyLCBidXQgdW5kZXIgYW4gb2xkZXIgUHl0aG9uLWluc3BpcmVkIGZvcm0uICBUaGlzIGZ1bmN0aW9uXG4gKiB3b3JrcyBvbiBib3RoIGtpbmRzIG9mIGdlbmVyYXRvcnMuXG4gKlxuICogRGVjb3JhdGVzIGEgZ2VuZXJhdG9yIGZ1bmN0aW9uIHN1Y2ggdGhhdDpcbiAqICAtIGl0IG1heSB5aWVsZCBwcm9taXNlc1xuICogIC0gZXhlY3V0aW9uIHdpbGwgY29udGludWUgd2hlbiB0aGF0IHByb21pc2UgaXMgZnVsZmlsbGVkXG4gKiAgLSB0aGUgdmFsdWUgb2YgdGhlIHlpZWxkIGV4cHJlc3Npb24gd2lsbCBiZSB0aGUgZnVsZmlsbGVkIHZhbHVlXG4gKiAgLSBpdCByZXR1cm5zIGEgcHJvbWlzZSBmb3IgdGhlIHJldHVybiB2YWx1ZSAod2hlbiB0aGUgZ2VuZXJhdG9yXG4gKiAgICBzdG9wcyBpdGVyYXRpbmcpXG4gKiAgLSB0aGUgZGVjb3JhdGVkIGZ1bmN0aW9uIHJldHVybnMgYSBwcm9taXNlIGZvciB0aGUgcmV0dXJuIHZhbHVlXG4gKiAgICBvZiB0aGUgZ2VuZXJhdG9yIG9yIHRoZSBmaXJzdCByZWplY3RlZCBwcm9taXNlIGFtb25nIHRob3NlXG4gKiAgICB5aWVsZGVkLlxuICogIC0gaWYgYW4gZXJyb3IgaXMgdGhyb3duIGluIHRoZSBnZW5lcmF0b3IsIGl0IHByb3BhZ2F0ZXMgdGhyb3VnaFxuICogICAgZXZlcnkgZm9sbG93aW5nIHlpZWxkIHVudGlsIGl0IGlzIGNhdWdodCwgb3IgdW50aWwgaXQgZXNjYXBlc1xuICogICAgdGhlIGdlbmVyYXRvciBmdW5jdGlvbiBhbHRvZ2V0aGVyLCBhbmQgaXMgdHJhbnNsYXRlZCBpbnRvIGFcbiAqICAgIHJlamVjdGlvbiBmb3IgdGhlIHByb21pc2UgcmV0dXJuZWQgYnkgdGhlIGRlY29yYXRlZCBnZW5lcmF0b3IuXG4gKi9cblEuYXN5bmMgPSBhc3luYztcbmZ1bmN0aW9uIGFzeW5jKG1ha2VHZW5lcmF0b3IpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyB3aGVuIHZlcmIgaXMgXCJzZW5kXCIsIGFyZyBpcyBhIHZhbHVlXG4gICAgICAgIC8vIHdoZW4gdmVyYiBpcyBcInRocm93XCIsIGFyZyBpcyBhbiBleGNlcHRpb25cbiAgICAgICAgZnVuY3Rpb24gY29udGludWVyKHZlcmIsIGFyZykge1xuICAgICAgICAgICAgdmFyIHJlc3VsdDtcblxuICAgICAgICAgICAgLy8gVW50aWwgVjggMy4xOSAvIENocm9taXVtIDI5IGlzIHJlbGVhc2VkLCBTcGlkZXJNb25rZXkgaXMgdGhlIG9ubHlcbiAgICAgICAgICAgIC8vIGVuZ2luZSB0aGF0IGhhcyBhIGRlcGxveWVkIGJhc2Ugb2YgYnJvd3NlcnMgdGhhdCBzdXBwb3J0IGdlbmVyYXRvcnMuXG4gICAgICAgICAgICAvLyBIb3dldmVyLCBTTSdzIGdlbmVyYXRvcnMgdXNlIHRoZSBQeXRob24taW5zcGlyZWQgc2VtYW50aWNzIG9mXG4gICAgICAgICAgICAvLyBvdXRkYXRlZCBFUzYgZHJhZnRzLiAgV2Ugd291bGQgbGlrZSB0byBzdXBwb3J0IEVTNiwgYnV0IHdlJ2QgYWxzb1xuICAgICAgICAgICAgLy8gbGlrZSB0byBtYWtlIGl0IHBvc3NpYmxlIHRvIHVzZSBnZW5lcmF0b3JzIGluIGRlcGxveWVkIGJyb3dzZXJzLCBzb1xuICAgICAgICAgICAgLy8gd2UgYWxzbyBzdXBwb3J0IFB5dGhvbi1zdHlsZSBnZW5lcmF0b3JzLiAgQXQgc29tZSBwb2ludCB3ZSBjYW4gcmVtb3ZlXG4gICAgICAgICAgICAvLyB0aGlzIGJsb2NrLlxuXG4gICAgICAgICAgICBpZiAodHlwZW9mIFN0b3BJdGVyYXRpb24gPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgICAgICAgICAvLyBFUzYgR2VuZXJhdG9yc1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IGdlbmVyYXRvclt2ZXJiXShhcmcpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGV4Y2VwdGlvbikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVqZWN0KGV4Y2VwdGlvbik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQuZG9uZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0LnZhbHVlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB3aGVuKHJlc3VsdC52YWx1ZSwgY2FsbGJhY2ssIGVycmJhY2spO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gU3BpZGVyTW9ua2V5IEdlbmVyYXRvcnNcbiAgICAgICAgICAgICAgICAvLyBGSVhNRTogUmVtb3ZlIHRoaXMgY2FzZSB3aGVuIFNNIGRvZXMgRVM2IGdlbmVyYXRvcnMuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gZ2VuZXJhdG9yW3ZlcmJdKGFyZyk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXhjZXB0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpc1N0b3BJdGVyYXRpb24oZXhjZXB0aW9uKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGV4Y2VwdGlvbi52YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiByZWplY3QoZXhjZXB0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gd2hlbihyZXN1bHQsIGNhbGxiYWNrLCBlcnJiYWNrKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB2YXIgZ2VuZXJhdG9yID0gbWFrZUdlbmVyYXRvci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICB2YXIgY2FsbGJhY2sgPSBjb250aW51ZXIuYmluZChjb250aW51ZXIsIFwibmV4dFwiKTtcbiAgICAgICAgdmFyIGVycmJhY2sgPSBjb250aW51ZXIuYmluZChjb250aW51ZXIsIFwidGhyb3dcIik7XG4gICAgICAgIHJldHVybiBjYWxsYmFjaygpO1xuICAgIH07XG59XG5cbi8qKlxuICogVGhlIHNwYXduIGZ1bmN0aW9uIGlzIGEgc21hbGwgd3JhcHBlciBhcm91bmQgYXN5bmMgdGhhdCBpbW1lZGlhdGVseVxuICogY2FsbHMgdGhlIGdlbmVyYXRvciBhbmQgYWxzbyBlbmRzIHRoZSBwcm9taXNlIGNoYWluLCBzbyB0aGF0IGFueVxuICogdW5oYW5kbGVkIGVycm9ycyBhcmUgdGhyb3duIGluc3RlYWQgb2YgZm9yd2FyZGVkIHRvIHRoZSBlcnJvclxuICogaGFuZGxlci4gVGhpcyBpcyB1c2VmdWwgYmVjYXVzZSBpdCdzIGV4dHJlbWVseSBjb21tb24gdG8gcnVuXG4gKiBnZW5lcmF0b3JzIGF0IHRoZSB0b3AtbGV2ZWwgdG8gd29yayB3aXRoIGxpYnJhcmllcy5cbiAqL1xuUS5zcGF3biA9IHNwYXduO1xuZnVuY3Rpb24gc3Bhd24obWFrZUdlbmVyYXRvcikge1xuICAgIFEuZG9uZShRLmFzeW5jKG1ha2VHZW5lcmF0b3IpKCkpO1xufVxuXG4vLyBGSVhNRTogUmVtb3ZlIHRoaXMgaW50ZXJmYWNlIG9uY2UgRVM2IGdlbmVyYXRvcnMgYXJlIGluIFNwaWRlck1vbmtleS5cbi8qKlxuICogVGhyb3dzIGEgUmV0dXJuVmFsdWUgZXhjZXB0aW9uIHRvIHN0b3AgYW4gYXN5bmNocm9ub3VzIGdlbmVyYXRvci5cbiAqXG4gKiBUaGlzIGludGVyZmFjZSBpcyBhIHN0b3AtZ2FwIG1lYXN1cmUgdG8gc3VwcG9ydCBnZW5lcmF0b3IgcmV0dXJuXG4gKiB2YWx1ZXMgaW4gb2xkZXIgRmlyZWZveC9TcGlkZXJNb25rZXkuICBJbiBicm93c2VycyB0aGF0IHN1cHBvcnQgRVM2XG4gKiBnZW5lcmF0b3JzIGxpa2UgQ2hyb21pdW0gMjksIGp1c3QgdXNlIFwicmV0dXJuXCIgaW4geW91ciBnZW5lcmF0b3JcbiAqIGZ1bmN0aW9ucy5cbiAqXG4gKiBAcGFyYW0gdmFsdWUgdGhlIHJldHVybiB2YWx1ZSBmb3IgdGhlIHN1cnJvdW5kaW5nIGdlbmVyYXRvclxuICogQHRocm93cyBSZXR1cm5WYWx1ZSBleGNlcHRpb24gd2l0aCB0aGUgdmFsdWUuXG4gKiBAZXhhbXBsZVxuICogLy8gRVM2IHN0eWxlXG4gKiBRLmFzeW5jKGZ1bmN0aW9uKiAoKSB7XG4gKiAgICAgIHZhciBmb28gPSB5aWVsZCBnZXRGb29Qcm9taXNlKCk7XG4gKiAgICAgIHZhciBiYXIgPSB5aWVsZCBnZXRCYXJQcm9taXNlKCk7XG4gKiAgICAgIHJldHVybiBmb28gKyBiYXI7XG4gKiB9KVxuICogLy8gT2xkZXIgU3BpZGVyTW9ua2V5IHN0eWxlXG4gKiBRLmFzeW5jKGZ1bmN0aW9uICgpIHtcbiAqICAgICAgdmFyIGZvbyA9IHlpZWxkIGdldEZvb1Byb21pc2UoKTtcbiAqICAgICAgdmFyIGJhciA9IHlpZWxkIGdldEJhclByb21pc2UoKTtcbiAqICAgICAgUS5yZXR1cm4oZm9vICsgYmFyKTtcbiAqIH0pXG4gKi9cblFbXCJyZXR1cm5cIl0gPSBfcmV0dXJuO1xuZnVuY3Rpb24gX3JldHVybih2YWx1ZSkge1xuICAgIHRocm93IG5ldyBRUmV0dXJuVmFsdWUodmFsdWUpO1xufVxuXG4vKipcbiAqIFRoZSBwcm9taXNlZCBmdW5jdGlvbiBkZWNvcmF0b3IgZW5zdXJlcyB0aGF0IGFueSBwcm9taXNlIGFyZ3VtZW50c1xuICogYXJlIHNldHRsZWQgYW5kIHBhc3NlZCBhcyB2YWx1ZXMgKGB0aGlzYCBpcyBhbHNvIHNldHRsZWQgYW5kIHBhc3NlZFxuICogYXMgYSB2YWx1ZSkuICBJdCB3aWxsIGFsc28gZW5zdXJlIHRoYXQgdGhlIHJlc3VsdCBvZiBhIGZ1bmN0aW9uIGlzXG4gKiBhbHdheXMgYSBwcm9taXNlLlxuICpcbiAqIEBleGFtcGxlXG4gKiB2YXIgYWRkID0gUS5wcm9taXNlZChmdW5jdGlvbiAoYSwgYikge1xuICogICAgIHJldHVybiBhICsgYjtcbiAqIH0pO1xuICogYWRkKFEoYSksIFEoQikpO1xuICpcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrIFRoZSBmdW5jdGlvbiB0byBkZWNvcmF0ZVxuICogQHJldHVybnMge2Z1bmN0aW9ufSBhIGZ1bmN0aW9uIHRoYXQgaGFzIGJlZW4gZGVjb3JhdGVkLlxuICovXG5RLnByb21pc2VkID0gcHJvbWlzZWQ7XG5mdW5jdGlvbiBwcm9taXNlZChjYWxsYmFjaykge1xuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBzcHJlYWQoW3RoaXMsIGFsbChhcmd1bWVudHMpXSwgZnVuY3Rpb24gKHNlbGYsIGFyZ3MpIHtcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjay5hcHBseShzZWxmLCBhcmdzKTtcbiAgICAgICAgfSk7XG4gICAgfTtcbn1cblxuLyoqXG4gKiBzZW5kcyBhIG1lc3NhZ2UgdG8gYSB2YWx1ZSBpbiBhIGZ1dHVyZSB0dXJuXG4gKiBAcGFyYW0gb2JqZWN0KiB0aGUgcmVjaXBpZW50XG4gKiBAcGFyYW0gb3AgdGhlIG5hbWUgb2YgdGhlIG1lc3NhZ2Ugb3BlcmF0aW9uLCBlLmcuLCBcIndoZW5cIixcbiAqIEBwYXJhbSBhcmdzIGZ1cnRoZXIgYXJndW1lbnRzIHRvIGJlIGZvcndhcmRlZCB0byB0aGUgb3BlcmF0aW9uXG4gKiBAcmV0dXJucyByZXN1bHQge1Byb21pc2V9IGEgcHJvbWlzZSBmb3IgdGhlIHJlc3VsdCBvZiB0aGUgb3BlcmF0aW9uXG4gKi9cblEuZGlzcGF0Y2ggPSBkaXNwYXRjaDtcbmZ1bmN0aW9uIGRpc3BhdGNoKG9iamVjdCwgb3AsIGFyZ3MpIHtcbiAgICByZXR1cm4gUShvYmplY3QpLmRpc3BhdGNoKG9wLCBhcmdzKTtcbn1cblxuUHJvbWlzZS5wcm90b3R5cGUuZGlzcGF0Y2ggPSBmdW5jdGlvbiAob3AsIGFyZ3MpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGRlZmVycmVkID0gZGVmZXIoKTtcbiAgICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICAgIHNlbGYucHJvbWlzZURpc3BhdGNoKGRlZmVycmVkLnJlc29sdmUsIG9wLCBhcmdzKTtcbiAgICB9KTtcbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn07XG5cbi8qKlxuICogR2V0cyB0aGUgdmFsdWUgb2YgYSBwcm9wZXJ0eSBpbiBhIGZ1dHVyZSB0dXJuLlxuICogQHBhcmFtIG9iamVjdCAgICBwcm9taXNlIG9yIGltbWVkaWF0ZSByZWZlcmVuY2UgZm9yIHRhcmdldCBvYmplY3RcbiAqIEBwYXJhbSBuYW1lICAgICAgbmFtZSBvZiBwcm9wZXJ0eSB0byBnZXRcbiAqIEByZXR1cm4gcHJvbWlzZSBmb3IgdGhlIHByb3BlcnR5IHZhbHVlXG4gKi9cblEuZ2V0ID0gZnVuY3Rpb24gKG9iamVjdCwga2V5KSB7XG4gICAgcmV0dXJuIFEob2JqZWN0KS5kaXNwYXRjaChcImdldFwiLCBba2V5XSk7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAoa2V5KSB7XG4gICAgcmV0dXJuIHRoaXMuZGlzcGF0Y2goXCJnZXRcIiwgW2tleV0pO1xufTtcblxuLyoqXG4gKiBTZXRzIHRoZSB2YWx1ZSBvZiBhIHByb3BlcnR5IGluIGEgZnV0dXJlIHR1cm4uXG4gKiBAcGFyYW0gb2JqZWN0ICAgIHByb21pc2Ugb3IgaW1tZWRpYXRlIHJlZmVyZW5jZSBmb3Igb2JqZWN0IG9iamVjdFxuICogQHBhcmFtIG5hbWUgICAgICBuYW1lIG9mIHByb3BlcnR5IHRvIHNldFxuICogQHBhcmFtIHZhbHVlICAgICBuZXcgdmFsdWUgb2YgcHJvcGVydHlcbiAqIEByZXR1cm4gcHJvbWlzZSBmb3IgdGhlIHJldHVybiB2YWx1ZVxuICovXG5RLnNldCA9IGZ1bmN0aW9uIChvYmplY3QsIGtleSwgdmFsdWUpIHtcbiAgICByZXR1cm4gUShvYmplY3QpLmRpc3BhdGNoKFwic2V0XCIsIFtrZXksIHZhbHVlXSk7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiAoa2V5LCB2YWx1ZSkge1xuICAgIHJldHVybiB0aGlzLmRpc3BhdGNoKFwic2V0XCIsIFtrZXksIHZhbHVlXSk7XG59O1xuXG4vKipcbiAqIERlbGV0ZXMgYSBwcm9wZXJ0eSBpbiBhIGZ1dHVyZSB0dXJuLlxuICogQHBhcmFtIG9iamVjdCAgICBwcm9taXNlIG9yIGltbWVkaWF0ZSByZWZlcmVuY2UgZm9yIHRhcmdldCBvYmplY3RcbiAqIEBwYXJhbSBuYW1lICAgICAgbmFtZSBvZiBwcm9wZXJ0eSB0byBkZWxldGVcbiAqIEByZXR1cm4gcHJvbWlzZSBmb3IgdGhlIHJldHVybiB2YWx1ZVxuICovXG5RLmRlbCA9IC8vIFhYWCBsZWdhY3lcblFbXCJkZWxldGVcIl0gPSBmdW5jdGlvbiAob2JqZWN0LCBrZXkpIHtcbiAgICByZXR1cm4gUShvYmplY3QpLmRpc3BhdGNoKFwiZGVsZXRlXCIsIFtrZXldKTtcbn07XG5cblByb21pc2UucHJvdG90eXBlLmRlbCA9IC8vIFhYWCBsZWdhY3lcblByb21pc2UucHJvdG90eXBlW1wiZGVsZXRlXCJdID0gZnVuY3Rpb24gKGtleSkge1xuICAgIHJldHVybiB0aGlzLmRpc3BhdGNoKFwiZGVsZXRlXCIsIFtrZXldKTtcbn07XG5cbi8qKlxuICogSW52b2tlcyBhIG1ldGhvZCBpbiBhIGZ1dHVyZSB0dXJuLlxuICogQHBhcmFtIG9iamVjdCAgICBwcm9taXNlIG9yIGltbWVkaWF0ZSByZWZlcmVuY2UgZm9yIHRhcmdldCBvYmplY3RcbiAqIEBwYXJhbSBuYW1lICAgICAgbmFtZSBvZiBtZXRob2QgdG8gaW52b2tlXG4gKiBAcGFyYW0gdmFsdWUgICAgIGEgdmFsdWUgdG8gcG9zdCwgdHlwaWNhbGx5IGFuIGFycmF5IG9mXG4gKiAgICAgICAgICAgICAgICAgIGludm9jYXRpb24gYXJndW1lbnRzIGZvciBwcm9taXNlcyB0aGF0XG4gKiAgICAgICAgICAgICAgICAgIGFyZSB1bHRpbWF0ZWx5IGJhY2tlZCB3aXRoIGByZXNvbHZlYCB2YWx1ZXMsXG4gKiAgICAgICAgICAgICAgICAgIGFzIG9wcG9zZWQgdG8gdGhvc2UgYmFja2VkIHdpdGggVVJMc1xuICogICAgICAgICAgICAgICAgICB3aGVyZWluIHRoZSBwb3N0ZWQgdmFsdWUgY2FuIGJlIGFueVxuICogICAgICAgICAgICAgICAgICBKU09OIHNlcmlhbGl6YWJsZSBvYmplY3QuXG4gKiBAcmV0dXJuIHByb21pc2UgZm9yIHRoZSByZXR1cm4gdmFsdWVcbiAqL1xuLy8gYm91bmQgbG9jYWxseSBiZWNhdXNlIGl0IGlzIHVzZWQgYnkgb3RoZXIgbWV0aG9kc1xuUS5tYXBwbHkgPSAvLyBYWFggQXMgcHJvcG9zZWQgYnkgXCJSZWRzYW5kcm9cIlxuUS5wb3N0ID0gZnVuY3Rpb24gKG9iamVjdCwgbmFtZSwgYXJncykge1xuICAgIHJldHVybiBRKG9iamVjdCkuZGlzcGF0Y2goXCJwb3N0XCIsIFtuYW1lLCBhcmdzXSk7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5tYXBwbHkgPSAvLyBYWFggQXMgcHJvcG9zZWQgYnkgXCJSZWRzYW5kcm9cIlxuUHJvbWlzZS5wcm90b3R5cGUucG9zdCA9IGZ1bmN0aW9uIChuYW1lLCBhcmdzKSB7XG4gICAgcmV0dXJuIHRoaXMuZGlzcGF0Y2goXCJwb3N0XCIsIFtuYW1lLCBhcmdzXSk7XG59O1xuXG4vKipcbiAqIEludm9rZXMgYSBtZXRob2QgaW4gYSBmdXR1cmUgdHVybi5cbiAqIEBwYXJhbSBvYmplY3QgICAgcHJvbWlzZSBvciBpbW1lZGlhdGUgcmVmZXJlbmNlIGZvciB0YXJnZXQgb2JqZWN0XG4gKiBAcGFyYW0gbmFtZSAgICAgIG5hbWUgb2YgbWV0aG9kIHRvIGludm9rZVxuICogQHBhcmFtIC4uLmFyZ3MgICBhcnJheSBvZiBpbnZvY2F0aW9uIGFyZ3VtZW50c1xuICogQHJldHVybiBwcm9taXNlIGZvciB0aGUgcmV0dXJuIHZhbHVlXG4gKi9cblEuc2VuZCA9IC8vIFhYWCBNYXJrIE1pbGxlcidzIHByb3Bvc2VkIHBhcmxhbmNlXG5RLm1jYWxsID0gLy8gWFhYIEFzIHByb3Bvc2VkIGJ5IFwiUmVkc2FuZHJvXCJcblEuaW52b2tlID0gZnVuY3Rpb24gKG9iamVjdCwgbmFtZSAvKi4uLmFyZ3MqLykge1xuICAgIHJldHVybiBRKG9iamVjdCkuZGlzcGF0Y2goXCJwb3N0XCIsIFtuYW1lLCBhcnJheV9zbGljZShhcmd1bWVudHMsIDIpXSk7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5zZW5kID0gLy8gWFhYIE1hcmsgTWlsbGVyJ3MgcHJvcG9zZWQgcGFybGFuY2VcblByb21pc2UucHJvdG90eXBlLm1jYWxsID0gLy8gWFhYIEFzIHByb3Bvc2VkIGJ5IFwiUmVkc2FuZHJvXCJcblByb21pc2UucHJvdG90eXBlLmludm9rZSA9IGZ1bmN0aW9uIChuYW1lIC8qLi4uYXJncyovKSB7XG4gICAgcmV0dXJuIHRoaXMuZGlzcGF0Y2goXCJwb3N0XCIsIFtuYW1lLCBhcnJheV9zbGljZShhcmd1bWVudHMsIDEpXSk7XG59O1xuXG4vKipcbiAqIEFwcGxpZXMgdGhlIHByb21pc2VkIGZ1bmN0aW9uIGluIGEgZnV0dXJlIHR1cm4uXG4gKiBAcGFyYW0gb2JqZWN0ICAgIHByb21pc2Ugb3IgaW1tZWRpYXRlIHJlZmVyZW5jZSBmb3IgdGFyZ2V0IGZ1bmN0aW9uXG4gKiBAcGFyYW0gYXJncyAgICAgIGFycmF5IG9mIGFwcGxpY2F0aW9uIGFyZ3VtZW50c1xuICovXG5RLmZhcHBseSA9IGZ1bmN0aW9uIChvYmplY3QsIGFyZ3MpIHtcbiAgICByZXR1cm4gUShvYmplY3QpLmRpc3BhdGNoKFwiYXBwbHlcIiwgW3ZvaWQgMCwgYXJnc10pO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuZmFwcGx5ID0gZnVuY3Rpb24gKGFyZ3MpIHtcbiAgICByZXR1cm4gdGhpcy5kaXNwYXRjaChcImFwcGx5XCIsIFt2b2lkIDAsIGFyZ3NdKTtcbn07XG5cbi8qKlxuICogQ2FsbHMgdGhlIHByb21pc2VkIGZ1bmN0aW9uIGluIGEgZnV0dXJlIHR1cm4uXG4gKiBAcGFyYW0gb2JqZWN0ICAgIHByb21pc2Ugb3IgaW1tZWRpYXRlIHJlZmVyZW5jZSBmb3IgdGFyZ2V0IGZ1bmN0aW9uXG4gKiBAcGFyYW0gLi4uYXJncyAgIGFycmF5IG9mIGFwcGxpY2F0aW9uIGFyZ3VtZW50c1xuICovXG5RW1widHJ5XCJdID1cblEuZmNhbGwgPSBmdW5jdGlvbiAob2JqZWN0IC8qIC4uLmFyZ3MqLykge1xuICAgIHJldHVybiBRKG9iamVjdCkuZGlzcGF0Y2goXCJhcHBseVwiLCBbdm9pZCAwLCBhcnJheV9zbGljZShhcmd1bWVudHMsIDEpXSk7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5mY2FsbCA9IGZ1bmN0aW9uICgvKi4uLmFyZ3MqLykge1xuICAgIHJldHVybiB0aGlzLmRpc3BhdGNoKFwiYXBwbHlcIiwgW3ZvaWQgMCwgYXJyYXlfc2xpY2UoYXJndW1lbnRzKV0pO1xufTtcblxuLyoqXG4gKiBCaW5kcyB0aGUgcHJvbWlzZWQgZnVuY3Rpb24sIHRyYW5zZm9ybWluZyByZXR1cm4gdmFsdWVzIGludG8gYSBmdWxmaWxsZWRcbiAqIHByb21pc2UgYW5kIHRocm93biBlcnJvcnMgaW50byBhIHJlamVjdGVkIG9uZS5cbiAqIEBwYXJhbSBvYmplY3QgICAgcHJvbWlzZSBvciBpbW1lZGlhdGUgcmVmZXJlbmNlIGZvciB0YXJnZXQgZnVuY3Rpb25cbiAqIEBwYXJhbSAuLi5hcmdzICAgYXJyYXkgb2YgYXBwbGljYXRpb24gYXJndW1lbnRzXG4gKi9cblEuZmJpbmQgPSBmdW5jdGlvbiAob2JqZWN0IC8qLi4uYXJncyovKSB7XG4gICAgdmFyIHByb21pc2UgPSBRKG9iamVjdCk7XG4gICAgdmFyIGFyZ3MgPSBhcnJheV9zbGljZShhcmd1bWVudHMsIDEpO1xuICAgIHJldHVybiBmdW5jdGlvbiBmYm91bmQoKSB7XG4gICAgICAgIHJldHVybiBwcm9taXNlLmRpc3BhdGNoKFwiYXBwbHlcIiwgW1xuICAgICAgICAgICAgdGhpcyxcbiAgICAgICAgICAgIGFyZ3MuY29uY2F0KGFycmF5X3NsaWNlKGFyZ3VtZW50cykpXG4gICAgICAgIF0pO1xuICAgIH07XG59O1xuUHJvbWlzZS5wcm90b3R5cGUuZmJpbmQgPSBmdW5jdGlvbiAoLyouLi5hcmdzKi8pIHtcbiAgICB2YXIgcHJvbWlzZSA9IHRoaXM7XG4gICAgdmFyIGFyZ3MgPSBhcnJheV9zbGljZShhcmd1bWVudHMpO1xuICAgIHJldHVybiBmdW5jdGlvbiBmYm91bmQoKSB7XG4gICAgICAgIHJldHVybiBwcm9taXNlLmRpc3BhdGNoKFwiYXBwbHlcIiwgW1xuICAgICAgICAgICAgdGhpcyxcbiAgICAgICAgICAgIGFyZ3MuY29uY2F0KGFycmF5X3NsaWNlKGFyZ3VtZW50cykpXG4gICAgICAgIF0pO1xuICAgIH07XG59O1xuXG4vKipcbiAqIFJlcXVlc3RzIHRoZSBuYW1lcyBvZiB0aGUgb3duZWQgcHJvcGVydGllcyBvZiBhIHByb21pc2VkXG4gKiBvYmplY3QgaW4gYSBmdXR1cmUgdHVybi5cbiAqIEBwYXJhbSBvYmplY3QgICAgcHJvbWlzZSBvciBpbW1lZGlhdGUgcmVmZXJlbmNlIGZvciB0YXJnZXQgb2JqZWN0XG4gKiBAcmV0dXJuIHByb21pc2UgZm9yIHRoZSBrZXlzIG9mIHRoZSBldmVudHVhbGx5IHNldHRsZWQgb2JqZWN0XG4gKi9cblEua2V5cyA9IGZ1bmN0aW9uIChvYmplY3QpIHtcbiAgICByZXR1cm4gUShvYmplY3QpLmRpc3BhdGNoKFwia2V5c1wiLCBbXSk7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5rZXlzID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmRpc3BhdGNoKFwia2V5c1wiLCBbXSk7XG59O1xuXG4vKipcbiAqIFR1cm5zIGFuIGFycmF5IG9mIHByb21pc2VzIGludG8gYSBwcm9taXNlIGZvciBhbiBhcnJheS4gIElmIGFueSBvZlxuICogdGhlIHByb21pc2VzIGdldHMgcmVqZWN0ZWQsIHRoZSB3aG9sZSBhcnJheSBpcyByZWplY3RlZCBpbW1lZGlhdGVseS5cbiAqIEBwYXJhbSB7QXJyYXkqfSBhbiBhcnJheSAob3IgcHJvbWlzZSBmb3IgYW4gYXJyYXkpIG9mIHZhbHVlcyAob3JcbiAqIHByb21pc2VzIGZvciB2YWx1ZXMpXG4gKiBAcmV0dXJucyBhIHByb21pc2UgZm9yIGFuIGFycmF5IG9mIHRoZSBjb3JyZXNwb25kaW5nIHZhbHVlc1xuICovXG4vLyBCeSBNYXJrIE1pbGxlclxuLy8gaHR0cDovL3dpa2kuZWNtYXNjcmlwdC5vcmcvZG9rdS5waHA/aWQ9c3RyYXdtYW46Y29uY3VycmVuY3kmcmV2PTEzMDg3NzY1MjEjYWxsZnVsZmlsbGVkXG5RLmFsbCA9IGFsbDtcbmZ1bmN0aW9uIGFsbChwcm9taXNlcykge1xuICAgIHJldHVybiB3aGVuKHByb21pc2VzLCBmdW5jdGlvbiAocHJvbWlzZXMpIHtcbiAgICAgICAgdmFyIGNvdW50RG93biA9IDA7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IGRlZmVyKCk7XG4gICAgICAgIGFycmF5X3JlZHVjZShwcm9taXNlcywgZnVuY3Rpb24gKHVuZGVmaW5lZCwgcHJvbWlzZSwgaW5kZXgpIHtcbiAgICAgICAgICAgIHZhciBzbmFwc2hvdDtcbiAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICBpc1Byb21pc2UocHJvbWlzZSkgJiZcbiAgICAgICAgICAgICAgICAoc25hcHNob3QgPSBwcm9taXNlLmluc3BlY3QoKSkuc3RhdGUgPT09IFwiZnVsZmlsbGVkXCJcbiAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgIHByb21pc2VzW2luZGV4XSA9IHNuYXBzaG90LnZhbHVlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICArK2NvdW50RG93bjtcbiAgICAgICAgICAgICAgICB3aGVuKFxuICAgICAgICAgICAgICAgICAgICBwcm9taXNlLFxuICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb21pc2VzW2luZGV4XSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKC0tY291bnREb3duID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZShwcm9taXNlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdCxcbiAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24gKHByb2dyZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5ub3RpZnkoeyBpbmRleDogaW5kZXgsIHZhbHVlOiBwcm9ncmVzcyB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIHZvaWQgMCk7XG4gICAgICAgIGlmIChjb3VudERvd24gPT09IDApIHtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUocHJvbWlzZXMpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH0pO1xufVxuXG5Qcm9taXNlLnByb3RvdHlwZS5hbGwgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIGFsbCh0aGlzKTtcbn07XG5cbi8qKlxuICogV2FpdHMgZm9yIGFsbCBwcm9taXNlcyB0byBiZSBzZXR0bGVkLCBlaXRoZXIgZnVsZmlsbGVkIG9yXG4gKiByZWplY3RlZC4gIFRoaXMgaXMgZGlzdGluY3QgZnJvbSBgYWxsYCBzaW5jZSB0aGF0IHdvdWxkIHN0b3BcbiAqIHdhaXRpbmcgYXQgdGhlIGZpcnN0IHJlamVjdGlvbi4gIFRoZSBwcm9taXNlIHJldHVybmVkIGJ5XG4gKiBgYWxsUmVzb2x2ZWRgIHdpbGwgbmV2ZXIgYmUgcmVqZWN0ZWQuXG4gKiBAcGFyYW0gcHJvbWlzZXMgYSBwcm9taXNlIGZvciBhbiBhcnJheSAob3IgYW4gYXJyYXkpIG9mIHByb21pc2VzXG4gKiAob3IgdmFsdWVzKVxuICogQHJldHVybiBhIHByb21pc2UgZm9yIGFuIGFycmF5IG9mIHByb21pc2VzXG4gKi9cblEuYWxsUmVzb2x2ZWQgPSBkZXByZWNhdGUoYWxsUmVzb2x2ZWQsIFwiYWxsUmVzb2x2ZWRcIiwgXCJhbGxTZXR0bGVkXCIpO1xuZnVuY3Rpb24gYWxsUmVzb2x2ZWQocHJvbWlzZXMpIHtcbiAgICByZXR1cm4gd2hlbihwcm9taXNlcywgZnVuY3Rpb24gKHByb21pc2VzKSB7XG4gICAgICAgIHByb21pc2VzID0gYXJyYXlfbWFwKHByb21pc2VzLCBRKTtcbiAgICAgICAgcmV0dXJuIHdoZW4oYWxsKGFycmF5X21hcChwcm9taXNlcywgZnVuY3Rpb24gKHByb21pc2UpIHtcbiAgICAgICAgICAgIHJldHVybiB3aGVuKHByb21pc2UsIG5vb3AsIG5vb3ApO1xuICAgICAgICB9KSksIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBwcm9taXNlcztcbiAgICAgICAgfSk7XG4gICAgfSk7XG59XG5cblByb21pc2UucHJvdG90eXBlLmFsbFJlc29sdmVkID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBhbGxSZXNvbHZlZCh0aGlzKTtcbn07XG5cbi8qKlxuICogQHNlZSBQcm9taXNlI2FsbFNldHRsZWRcbiAqL1xuUS5hbGxTZXR0bGVkID0gYWxsU2V0dGxlZDtcbmZ1bmN0aW9uIGFsbFNldHRsZWQocHJvbWlzZXMpIHtcbiAgICByZXR1cm4gUShwcm9taXNlcykuYWxsU2V0dGxlZCgpO1xufVxuXG4vKipcbiAqIFR1cm5zIGFuIGFycmF5IG9mIHByb21pc2VzIGludG8gYSBwcm9taXNlIGZvciBhbiBhcnJheSBvZiB0aGVpciBzdGF0ZXMgKGFzXG4gKiByZXR1cm5lZCBieSBgaW5zcGVjdGApIHdoZW4gdGhleSBoYXZlIGFsbCBzZXR0bGVkLlxuICogQHBhcmFtIHtBcnJheVtBbnkqXX0gdmFsdWVzIGFuIGFycmF5IChvciBwcm9taXNlIGZvciBhbiBhcnJheSkgb2YgdmFsdWVzIChvclxuICogcHJvbWlzZXMgZm9yIHZhbHVlcylcbiAqIEByZXR1cm5zIHtBcnJheVtTdGF0ZV19IGFuIGFycmF5IG9mIHN0YXRlcyBmb3IgdGhlIHJlc3BlY3RpdmUgdmFsdWVzLlxuICovXG5Qcm9taXNlLnByb3RvdHlwZS5hbGxTZXR0bGVkID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLnRoZW4oZnVuY3Rpb24gKHByb21pc2VzKSB7XG4gICAgICAgIHJldHVybiBhbGwoYXJyYXlfbWFwKHByb21pc2VzLCBmdW5jdGlvbiAocHJvbWlzZSkge1xuICAgICAgICAgICAgcHJvbWlzZSA9IFEocHJvbWlzZSk7XG4gICAgICAgICAgICBmdW5jdGlvbiByZWdhcmRsZXNzKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBwcm9taXNlLmluc3BlY3QoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBwcm9taXNlLnRoZW4ocmVnYXJkbGVzcywgcmVnYXJkbGVzcyk7XG4gICAgICAgIH0pKTtcbiAgICB9KTtcbn07XG5cbi8qKlxuICogQ2FwdHVyZXMgdGhlIGZhaWx1cmUgb2YgYSBwcm9taXNlLCBnaXZpbmcgYW4gb3BvcnR1bml0eSB0byByZWNvdmVyXG4gKiB3aXRoIGEgY2FsbGJhY2suICBJZiB0aGUgZ2l2ZW4gcHJvbWlzZSBpcyBmdWxmaWxsZWQsIHRoZSByZXR1cm5lZFxuICogcHJvbWlzZSBpcyBmdWxmaWxsZWQuXG4gKiBAcGFyYW0ge0FueSp9IHByb21pc2UgZm9yIHNvbWV0aGluZ1xuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgdG8gZnVsZmlsbCB0aGUgcmV0dXJuZWQgcHJvbWlzZSBpZiB0aGVcbiAqIGdpdmVuIHByb21pc2UgaXMgcmVqZWN0ZWRcbiAqIEByZXR1cm5zIGEgcHJvbWlzZSBmb3IgdGhlIHJldHVybiB2YWx1ZSBvZiB0aGUgY2FsbGJhY2tcbiAqL1xuUS5mYWlsID0gLy8gWFhYIGxlZ2FjeVxuUVtcImNhdGNoXCJdID0gZnVuY3Rpb24gKG9iamVjdCwgcmVqZWN0ZWQpIHtcbiAgICByZXR1cm4gUShvYmplY3QpLnRoZW4odm9pZCAwLCByZWplY3RlZCk7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5mYWlsID0gLy8gWFhYIGxlZ2FjeVxuUHJvbWlzZS5wcm90b3R5cGVbXCJjYXRjaFwiXSA9IGZ1bmN0aW9uIChyZWplY3RlZCkge1xuICAgIHJldHVybiB0aGlzLnRoZW4odm9pZCAwLCByZWplY3RlZCk7XG59O1xuXG4vKipcbiAqIEF0dGFjaGVzIGEgbGlzdGVuZXIgdGhhdCBjYW4gcmVzcG9uZCB0byBwcm9ncmVzcyBub3RpZmljYXRpb25zIGZyb20gYVxuICogcHJvbWlzZSdzIG9yaWdpbmF0aW5nIGRlZmVycmVkLiBUaGlzIGxpc3RlbmVyIHJlY2VpdmVzIHRoZSBleGFjdCBhcmd1bWVudHNcbiAqIHBhc3NlZCB0byBgYGRlZmVycmVkLm5vdGlmeWBgLlxuICogQHBhcmFtIHtBbnkqfSBwcm9taXNlIGZvciBzb21ldGhpbmdcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIHRvIHJlY2VpdmUgYW55IHByb2dyZXNzIG5vdGlmaWNhdGlvbnNcbiAqIEByZXR1cm5zIHRoZSBnaXZlbiBwcm9taXNlLCB1bmNoYW5nZWRcbiAqL1xuUS5wcm9ncmVzcyA9IHByb2dyZXNzO1xuZnVuY3Rpb24gcHJvZ3Jlc3Mob2JqZWN0LCBwcm9ncmVzc2VkKSB7XG4gICAgcmV0dXJuIFEob2JqZWN0KS50aGVuKHZvaWQgMCwgdm9pZCAwLCBwcm9ncmVzc2VkKTtcbn1cblxuUHJvbWlzZS5wcm90b3R5cGUucHJvZ3Jlc3MgPSBmdW5jdGlvbiAocHJvZ3Jlc3NlZCkge1xuICAgIHJldHVybiB0aGlzLnRoZW4odm9pZCAwLCB2b2lkIDAsIHByb2dyZXNzZWQpO1xufTtcblxuLyoqXG4gKiBQcm92aWRlcyBhbiBvcHBvcnR1bml0eSB0byBvYnNlcnZlIHRoZSBzZXR0bGluZyBvZiBhIHByb21pc2UsXG4gKiByZWdhcmRsZXNzIG9mIHdoZXRoZXIgdGhlIHByb21pc2UgaXMgZnVsZmlsbGVkIG9yIHJlamVjdGVkLiAgRm9yd2FyZHNcbiAqIHRoZSByZXNvbHV0aW9uIHRvIHRoZSByZXR1cm5lZCBwcm9taXNlIHdoZW4gdGhlIGNhbGxiYWNrIGlzIGRvbmUuXG4gKiBUaGUgY2FsbGJhY2sgY2FuIHJldHVybiBhIHByb21pc2UgdG8gZGVmZXIgY29tcGxldGlvbi5cbiAqIEBwYXJhbSB7QW55Kn0gcHJvbWlzZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgdG8gb2JzZXJ2ZSB0aGUgcmVzb2x1dGlvbiBvZiB0aGUgZ2l2ZW5cbiAqIHByb21pc2UsIHRha2VzIG5vIGFyZ3VtZW50cy5cbiAqIEByZXR1cm5zIGEgcHJvbWlzZSBmb3IgdGhlIHJlc29sdXRpb24gb2YgdGhlIGdpdmVuIHByb21pc2Ugd2hlblxuICogYGBmaW5gYCBpcyBkb25lLlxuICovXG5RLmZpbiA9IC8vIFhYWCBsZWdhY3lcblFbXCJmaW5hbGx5XCJdID0gZnVuY3Rpb24gKG9iamVjdCwgY2FsbGJhY2spIHtcbiAgICByZXR1cm4gUShvYmplY3QpW1wiZmluYWxseVwiXShjYWxsYmFjayk7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5maW4gPSAvLyBYWFggbGVnYWN5XG5Qcm9taXNlLnByb3RvdHlwZVtcImZpbmFsbHlcIl0gPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICBjYWxsYmFjayA9IFEoY2FsbGJhY2spO1xuICAgIHJldHVybiB0aGlzLnRoZW4oZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjay5mY2FsbCgpLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgICB9KTtcbiAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgICAgIC8vIFRPRE8gYXR0ZW1wdCB0byByZWN5Y2xlIHRoZSByZWplY3Rpb24gd2l0aCBcInRoaXNcIi5cbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrLmZjYWxsKCkudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aHJvdyByZWFzb247XG4gICAgICAgIH0pO1xuICAgIH0pO1xufTtcblxuLyoqXG4gKiBUZXJtaW5hdGVzIGEgY2hhaW4gb2YgcHJvbWlzZXMsIGZvcmNpbmcgcmVqZWN0aW9ucyB0byBiZVxuICogdGhyb3duIGFzIGV4Y2VwdGlvbnMuXG4gKiBAcGFyYW0ge0FueSp9IHByb21pc2UgYXQgdGhlIGVuZCBvZiBhIGNoYWluIG9mIHByb21pc2VzXG4gKiBAcmV0dXJucyBub3RoaW5nXG4gKi9cblEuZG9uZSA9IGZ1bmN0aW9uIChvYmplY3QsIGZ1bGZpbGxlZCwgcmVqZWN0ZWQsIHByb2dyZXNzKSB7XG4gICAgcmV0dXJuIFEob2JqZWN0KS5kb25lKGZ1bGZpbGxlZCwgcmVqZWN0ZWQsIHByb2dyZXNzKTtcbn07XG5cblByb21pc2UucHJvdG90eXBlLmRvbmUgPSBmdW5jdGlvbiAoZnVsZmlsbGVkLCByZWplY3RlZCwgcHJvZ3Jlc3MpIHtcbiAgICB2YXIgb25VbmhhbmRsZWRFcnJvciA9IGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICAvLyBmb3J3YXJkIHRvIGEgZnV0dXJlIHR1cm4gc28gdGhhdCBgYHdoZW5gYFxuICAgICAgICAvLyBkb2VzIG5vdCBjYXRjaCBpdCBhbmQgdHVybiBpdCBpbnRvIGEgcmVqZWN0aW9uLlxuICAgICAgICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBtYWtlU3RhY2tUcmFjZUxvbmcoZXJyb3IsIHByb21pc2UpO1xuICAgICAgICAgICAgaWYgKFEub25lcnJvcikge1xuICAgICAgICAgICAgICAgIFEub25lcnJvcihlcnJvcik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgLy8gQXZvaWQgdW5uZWNlc3NhcnkgYG5leHRUaWNrYGluZyB2aWEgYW4gdW5uZWNlc3NhcnkgYHdoZW5gLlxuICAgIHZhciBwcm9taXNlID0gZnVsZmlsbGVkIHx8IHJlamVjdGVkIHx8IHByb2dyZXNzID9cbiAgICAgICAgdGhpcy50aGVuKGZ1bGZpbGxlZCwgcmVqZWN0ZWQsIHByb2dyZXNzKSA6XG4gICAgICAgIHRoaXM7XG5cbiAgICBpZiAodHlwZW9mIHByb2Nlc3MgPT09IFwib2JqZWN0XCIgJiYgcHJvY2VzcyAmJiBwcm9jZXNzLmRvbWFpbikge1xuICAgICAgICBvblVuaGFuZGxlZEVycm9yID0gcHJvY2Vzcy5kb21haW4uYmluZChvblVuaGFuZGxlZEVycm9yKTtcbiAgICB9XG5cbiAgICBwcm9taXNlLnRoZW4odm9pZCAwLCBvblVuaGFuZGxlZEVycm9yKTtcbn07XG5cbi8qKlxuICogQ2F1c2VzIGEgcHJvbWlzZSB0byBiZSByZWplY3RlZCBpZiBpdCBkb2VzIG5vdCBnZXQgZnVsZmlsbGVkIGJlZm9yZVxuICogc29tZSBtaWxsaXNlY29uZHMgdGltZSBvdXQuXG4gKiBAcGFyYW0ge0FueSp9IHByb21pc2VcbiAqIEBwYXJhbSB7TnVtYmVyfSBtaWxsaXNlY29uZHMgdGltZW91dFxuICogQHBhcmFtIHtTdHJpbmd9IGN1c3RvbSBlcnJvciBtZXNzYWdlIChvcHRpb25hbClcbiAqIEByZXR1cm5zIGEgcHJvbWlzZSBmb3IgdGhlIHJlc29sdXRpb24gb2YgdGhlIGdpdmVuIHByb21pc2UgaWYgaXQgaXNcbiAqIGZ1bGZpbGxlZCBiZWZvcmUgdGhlIHRpbWVvdXQsIG90aGVyd2lzZSByZWplY3RlZC5cbiAqL1xuUS50aW1lb3V0ID0gZnVuY3Rpb24gKG9iamVjdCwgbXMsIG1lc3NhZ2UpIHtcbiAgICByZXR1cm4gUShvYmplY3QpLnRpbWVvdXQobXMsIG1lc3NhZ2UpO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUudGltZW91dCA9IGZ1bmN0aW9uIChtcywgbWVzc2FnZSkge1xuICAgIHZhciBkZWZlcnJlZCA9IGRlZmVyKCk7XG4gICAgdmFyIHRpbWVvdXRJZCA9IHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICBkZWZlcnJlZC5yZWplY3QobmV3IEVycm9yKG1lc3NhZ2UgfHwgXCJUaW1lZCBvdXQgYWZ0ZXIgXCIgKyBtcyArIFwiIG1zXCIpKTtcbiAgICB9LCBtcyk7XG5cbiAgICB0aGlzLnRoZW4oZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHZhbHVlKTtcbiAgICB9LCBmdW5jdGlvbiAoZXhjZXB0aW9uKSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXhjZXB0aW9uKTtcbiAgICB9LCBkZWZlcnJlZC5ub3RpZnkpO1xuXG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59O1xuXG4vKipcbiAqIFJldHVybnMgYSBwcm9taXNlIGZvciB0aGUgZ2l2ZW4gdmFsdWUgKG9yIHByb21pc2VkIHZhbHVlKSwgc29tZVxuICogbWlsbGlzZWNvbmRzIGFmdGVyIGl0IHJlc29sdmVkLiBQYXNzZXMgcmVqZWN0aW9ucyBpbW1lZGlhdGVseS5cbiAqIEBwYXJhbSB7QW55Kn0gcHJvbWlzZVxuICogQHBhcmFtIHtOdW1iZXJ9IG1pbGxpc2Vjb25kc1xuICogQHJldHVybnMgYSBwcm9taXNlIGZvciB0aGUgcmVzb2x1dGlvbiBvZiB0aGUgZ2l2ZW4gcHJvbWlzZSBhZnRlciBtaWxsaXNlY29uZHNcbiAqIHRpbWUgaGFzIGVsYXBzZWQgc2luY2UgdGhlIHJlc29sdXRpb24gb2YgdGhlIGdpdmVuIHByb21pc2UuXG4gKiBJZiB0aGUgZ2l2ZW4gcHJvbWlzZSByZWplY3RzLCB0aGF0IGlzIHBhc3NlZCBpbW1lZGlhdGVseS5cbiAqL1xuUS5kZWxheSA9IGZ1bmN0aW9uIChvYmplY3QsIHRpbWVvdXQpIHtcbiAgICBpZiAodGltZW91dCA9PT0gdm9pZCAwKSB7XG4gICAgICAgIHRpbWVvdXQgPSBvYmplY3Q7XG4gICAgICAgIG9iamVjdCA9IHZvaWQgMDtcbiAgICB9XG4gICAgcmV0dXJuIFEob2JqZWN0KS5kZWxheSh0aW1lb3V0KTtcbn07XG5cblByb21pc2UucHJvdG90eXBlLmRlbGF5ID0gZnVuY3Rpb24gKHRpbWVvdXQpIHtcbiAgICByZXR1cm4gdGhpcy50aGVuKGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSBkZWZlcigpO1xuICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUodmFsdWUpO1xuICAgICAgICB9LCB0aW1lb3V0KTtcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfSk7XG59O1xuXG4vKipcbiAqIFBhc3NlcyBhIGNvbnRpbnVhdGlvbiB0byBhIE5vZGUgZnVuY3Rpb24sIHdoaWNoIGlzIGNhbGxlZCB3aXRoIHRoZSBnaXZlblxuICogYXJndW1lbnRzIHByb3ZpZGVkIGFzIGFuIGFycmF5LCBhbmQgcmV0dXJucyBhIHByb21pc2UuXG4gKlxuICogICAgICBRLm5mYXBwbHkoRlMucmVhZEZpbGUsIFtfX2ZpbGVuYW1lXSlcbiAqICAgICAgLnRoZW4oZnVuY3Rpb24gKGNvbnRlbnQpIHtcbiAqICAgICAgfSlcbiAqXG4gKi9cblEubmZhcHBseSA9IGZ1bmN0aW9uIChjYWxsYmFjaywgYXJncykge1xuICAgIHJldHVybiBRKGNhbGxiYWNrKS5uZmFwcGx5KGFyZ3MpO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUubmZhcHBseSA9IGZ1bmN0aW9uIChhcmdzKSB7XG4gICAgdmFyIGRlZmVycmVkID0gZGVmZXIoKTtcbiAgICB2YXIgbm9kZUFyZ3MgPSBhcnJheV9zbGljZShhcmdzKTtcbiAgICBub2RlQXJncy5wdXNoKGRlZmVycmVkLm1ha2VOb2RlUmVzb2x2ZXIoKSk7XG4gICAgdGhpcy5mYXBwbHkobm9kZUFyZ3MpLmZhaWwoZGVmZXJyZWQucmVqZWN0KTtcbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn07XG5cbi8qKlxuICogUGFzc2VzIGEgY29udGludWF0aW9uIHRvIGEgTm9kZSBmdW5jdGlvbiwgd2hpY2ggaXMgY2FsbGVkIHdpdGggdGhlIGdpdmVuXG4gKiBhcmd1bWVudHMgcHJvdmlkZWQgaW5kaXZpZHVhbGx5LCBhbmQgcmV0dXJucyBhIHByb21pc2UuXG4gKiBAZXhhbXBsZVxuICogUS5uZmNhbGwoRlMucmVhZEZpbGUsIF9fZmlsZW5hbWUpXG4gKiAudGhlbihmdW5jdGlvbiAoY29udGVudCkge1xuICogfSlcbiAqXG4gKi9cblEubmZjYWxsID0gZnVuY3Rpb24gKGNhbGxiYWNrIC8qLi4uYXJncyovKSB7XG4gICAgdmFyIGFyZ3MgPSBhcnJheV9zbGljZShhcmd1bWVudHMsIDEpO1xuICAgIHJldHVybiBRKGNhbGxiYWNrKS5uZmFwcGx5KGFyZ3MpO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUubmZjYWxsID0gZnVuY3Rpb24gKC8qLi4uYXJncyovKSB7XG4gICAgdmFyIG5vZGVBcmdzID0gYXJyYXlfc2xpY2UoYXJndW1lbnRzKTtcbiAgICB2YXIgZGVmZXJyZWQgPSBkZWZlcigpO1xuICAgIG5vZGVBcmdzLnB1c2goZGVmZXJyZWQubWFrZU5vZGVSZXNvbHZlcigpKTtcbiAgICB0aGlzLmZhcHBseShub2RlQXJncykuZmFpbChkZWZlcnJlZC5yZWplY3QpO1xuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufTtcblxuLyoqXG4gKiBXcmFwcyBhIE5vZGVKUyBjb250aW51YXRpb24gcGFzc2luZyBmdW5jdGlvbiBhbmQgcmV0dXJucyBhbiBlcXVpdmFsZW50XG4gKiB2ZXJzaW9uIHRoYXQgcmV0dXJucyBhIHByb21pc2UuXG4gKiBAZXhhbXBsZVxuICogUS5uZmJpbmQoRlMucmVhZEZpbGUsIF9fZmlsZW5hbWUpKFwidXRmLThcIilcbiAqIC50aGVuKGNvbnNvbGUubG9nKVxuICogLmRvbmUoKVxuICovXG5RLm5mYmluZCA9XG5RLmRlbm9kZWlmeSA9IGZ1bmN0aW9uIChjYWxsYmFjayAvKi4uLmFyZ3MqLykge1xuICAgIHZhciBiYXNlQXJncyA9IGFycmF5X3NsaWNlKGFyZ3VtZW50cywgMSk7XG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIG5vZGVBcmdzID0gYmFzZUFyZ3MuY29uY2F0KGFycmF5X3NsaWNlKGFyZ3VtZW50cykpO1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSBkZWZlcigpO1xuICAgICAgICBub2RlQXJncy5wdXNoKGRlZmVycmVkLm1ha2VOb2RlUmVzb2x2ZXIoKSk7XG4gICAgICAgIFEoY2FsbGJhY2spLmZhcHBseShub2RlQXJncykuZmFpbChkZWZlcnJlZC5yZWplY3QpO1xuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9O1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUubmZiaW5kID1cblByb21pc2UucHJvdG90eXBlLmRlbm9kZWlmeSA9IGZ1bmN0aW9uICgvKi4uLmFyZ3MqLykge1xuICAgIHZhciBhcmdzID0gYXJyYXlfc2xpY2UoYXJndW1lbnRzKTtcbiAgICBhcmdzLnVuc2hpZnQodGhpcyk7XG4gICAgcmV0dXJuIFEuZGVub2RlaWZ5LmFwcGx5KHZvaWQgMCwgYXJncyk7XG59O1xuXG5RLm5iaW5kID0gZnVuY3Rpb24gKGNhbGxiYWNrLCB0aGlzcCAvKi4uLmFyZ3MqLykge1xuICAgIHZhciBiYXNlQXJncyA9IGFycmF5X3NsaWNlKGFyZ3VtZW50cywgMik7XG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIG5vZGVBcmdzID0gYmFzZUFyZ3MuY29uY2F0KGFycmF5X3NsaWNlKGFyZ3VtZW50cykpO1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSBkZWZlcigpO1xuICAgICAgICBub2RlQXJncy5wdXNoKGRlZmVycmVkLm1ha2VOb2RlUmVzb2x2ZXIoKSk7XG4gICAgICAgIGZ1bmN0aW9uIGJvdW5kKCkge1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrLmFwcGx5KHRoaXNwLCBhcmd1bWVudHMpO1xuICAgICAgICB9XG4gICAgICAgIFEoYm91bmQpLmZhcHBseShub2RlQXJncykuZmFpbChkZWZlcnJlZC5yZWplY3QpO1xuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9O1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUubmJpbmQgPSBmdW5jdGlvbiAoLyp0aGlzcCwgLi4uYXJncyovKSB7XG4gICAgdmFyIGFyZ3MgPSBhcnJheV9zbGljZShhcmd1bWVudHMsIDApO1xuICAgIGFyZ3MudW5zaGlmdCh0aGlzKTtcbiAgICByZXR1cm4gUS5uYmluZC5hcHBseSh2b2lkIDAsIGFyZ3MpO1xufTtcblxuLyoqXG4gKiBDYWxscyBhIG1ldGhvZCBvZiBhIE5vZGUtc3R5bGUgb2JqZWN0IHRoYXQgYWNjZXB0cyBhIE5vZGUtc3R5bGVcbiAqIGNhbGxiYWNrIHdpdGggYSBnaXZlbiBhcnJheSBvZiBhcmd1bWVudHMsIHBsdXMgYSBwcm92aWRlZCBjYWxsYmFjay5cbiAqIEBwYXJhbSBvYmplY3QgYW4gb2JqZWN0IHRoYXQgaGFzIHRoZSBuYW1lZCBtZXRob2RcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIG5hbWUgb2YgdGhlIG1ldGhvZCBvZiBvYmplY3RcbiAqIEBwYXJhbSB7QXJyYXl9IGFyZ3MgYXJndW1lbnRzIHRvIHBhc3MgdG8gdGhlIG1ldGhvZDsgdGhlIGNhbGxiYWNrXG4gKiB3aWxsIGJlIHByb3ZpZGVkIGJ5IFEgYW5kIGFwcGVuZGVkIHRvIHRoZXNlIGFyZ3VtZW50cy5cbiAqIEByZXR1cm5zIGEgcHJvbWlzZSBmb3IgdGhlIHZhbHVlIG9yIGVycm9yXG4gKi9cblEubm1hcHBseSA9IC8vIFhYWCBBcyBwcm9wb3NlZCBieSBcIlJlZHNhbmRyb1wiXG5RLm5wb3N0ID0gZnVuY3Rpb24gKG9iamVjdCwgbmFtZSwgYXJncykge1xuICAgIHJldHVybiBRKG9iamVjdCkubnBvc3QobmFtZSwgYXJncyk7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5ubWFwcGx5ID0gLy8gWFhYIEFzIHByb3Bvc2VkIGJ5IFwiUmVkc2FuZHJvXCJcblByb21pc2UucHJvdG90eXBlLm5wb3N0ID0gZnVuY3Rpb24gKG5hbWUsIGFyZ3MpIHtcbiAgICB2YXIgbm9kZUFyZ3MgPSBhcnJheV9zbGljZShhcmdzIHx8IFtdKTtcbiAgICB2YXIgZGVmZXJyZWQgPSBkZWZlcigpO1xuICAgIG5vZGVBcmdzLnB1c2goZGVmZXJyZWQubWFrZU5vZGVSZXNvbHZlcigpKTtcbiAgICB0aGlzLmRpc3BhdGNoKFwicG9zdFwiLCBbbmFtZSwgbm9kZUFyZ3NdKS5mYWlsKGRlZmVycmVkLnJlamVjdCk7XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59O1xuXG4vKipcbiAqIENhbGxzIGEgbWV0aG9kIG9mIGEgTm9kZS1zdHlsZSBvYmplY3QgdGhhdCBhY2NlcHRzIGEgTm9kZS1zdHlsZVxuICogY2FsbGJhY2ssIGZvcndhcmRpbmcgdGhlIGdpdmVuIHZhcmlhZGljIGFyZ3VtZW50cywgcGx1cyBhIHByb3ZpZGVkXG4gKiBjYWxsYmFjayBhcmd1bWVudC5cbiAqIEBwYXJhbSBvYmplY3QgYW4gb2JqZWN0IHRoYXQgaGFzIHRoZSBuYW1lZCBtZXRob2RcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIG5hbWUgb2YgdGhlIG1ldGhvZCBvZiBvYmplY3RcbiAqIEBwYXJhbSAuLi5hcmdzIGFyZ3VtZW50cyB0byBwYXNzIHRvIHRoZSBtZXRob2Q7IHRoZSBjYWxsYmFjayB3aWxsXG4gKiBiZSBwcm92aWRlZCBieSBRIGFuZCBhcHBlbmRlZCB0byB0aGVzZSBhcmd1bWVudHMuXG4gKiBAcmV0dXJucyBhIHByb21pc2UgZm9yIHRoZSB2YWx1ZSBvciBlcnJvclxuICovXG5RLm5zZW5kID0gLy8gWFhYIEJhc2VkIG9uIE1hcmsgTWlsbGVyJ3MgcHJvcG9zZWQgXCJzZW5kXCJcblEubm1jYWxsID0gLy8gWFhYIEJhc2VkIG9uIFwiUmVkc2FuZHJvJ3NcIiBwcm9wb3NhbFxuUS5uaW52b2tlID0gZnVuY3Rpb24gKG9iamVjdCwgbmFtZSAvKi4uLmFyZ3MqLykge1xuICAgIHZhciBub2RlQXJncyA9IGFycmF5X3NsaWNlKGFyZ3VtZW50cywgMik7XG4gICAgdmFyIGRlZmVycmVkID0gZGVmZXIoKTtcbiAgICBub2RlQXJncy5wdXNoKGRlZmVycmVkLm1ha2VOb2RlUmVzb2x2ZXIoKSk7XG4gICAgUShvYmplY3QpLmRpc3BhdGNoKFwicG9zdFwiLCBbbmFtZSwgbm9kZUFyZ3NdKS5mYWlsKGRlZmVycmVkLnJlamVjdCk7XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5uc2VuZCA9IC8vIFhYWCBCYXNlZCBvbiBNYXJrIE1pbGxlcidzIHByb3Bvc2VkIFwic2VuZFwiXG5Qcm9taXNlLnByb3RvdHlwZS5ubWNhbGwgPSAvLyBYWFggQmFzZWQgb24gXCJSZWRzYW5kcm8nc1wiIHByb3Bvc2FsXG5Qcm9taXNlLnByb3RvdHlwZS5uaW52b2tlID0gZnVuY3Rpb24gKG5hbWUgLyouLi5hcmdzKi8pIHtcbiAgICB2YXIgbm9kZUFyZ3MgPSBhcnJheV9zbGljZShhcmd1bWVudHMsIDEpO1xuICAgIHZhciBkZWZlcnJlZCA9IGRlZmVyKCk7XG4gICAgbm9kZUFyZ3MucHVzaChkZWZlcnJlZC5tYWtlTm9kZVJlc29sdmVyKCkpO1xuICAgIHRoaXMuZGlzcGF0Y2goXCJwb3N0XCIsIFtuYW1lLCBub2RlQXJnc10pLmZhaWwoZGVmZXJyZWQucmVqZWN0KTtcbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn07XG5cbi8qKlxuICogSWYgYSBmdW5jdGlvbiB3b3VsZCBsaWtlIHRvIHN1cHBvcnQgYm90aCBOb2RlIGNvbnRpbnVhdGlvbi1wYXNzaW5nLXN0eWxlIGFuZFxuICogcHJvbWlzZS1yZXR1cm5pbmctc3R5bGUsIGl0IGNhbiBlbmQgaXRzIGludGVybmFsIHByb21pc2UgY2hhaW4gd2l0aFxuICogYG5vZGVpZnkobm9kZWJhY2spYCwgZm9yd2FyZGluZyB0aGUgb3B0aW9uYWwgbm9kZWJhY2sgYXJndW1lbnQuICBJZiB0aGUgdXNlclxuICogZWxlY3RzIHRvIHVzZSBhIG5vZGViYWNrLCB0aGUgcmVzdWx0IHdpbGwgYmUgc2VudCB0aGVyZS4gIElmIHRoZXkgZG8gbm90XG4gKiBwYXNzIGEgbm9kZWJhY2ssIHRoZXkgd2lsbCByZWNlaXZlIHRoZSByZXN1bHQgcHJvbWlzZS5cbiAqIEBwYXJhbSBvYmplY3QgYSByZXN1bHQgKG9yIGEgcHJvbWlzZSBmb3IgYSByZXN1bHQpXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBub2RlYmFjayBhIE5vZGUuanMtc3R5bGUgY2FsbGJhY2tcbiAqIEByZXR1cm5zIGVpdGhlciB0aGUgcHJvbWlzZSBvciBub3RoaW5nXG4gKi9cblEubm9kZWlmeSA9IG5vZGVpZnk7XG5mdW5jdGlvbiBub2RlaWZ5KG9iamVjdCwgbm9kZWJhY2spIHtcbiAgICByZXR1cm4gUShvYmplY3QpLm5vZGVpZnkobm9kZWJhY2spO1xufVxuXG5Qcm9taXNlLnByb3RvdHlwZS5ub2RlaWZ5ID0gZnVuY3Rpb24gKG5vZGViYWNrKSB7XG4gICAgaWYgKG5vZGViYWNrKSB7XG4gICAgICAgIHRoaXMudGhlbihmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBub2RlYmFjayhudWxsLCB2YWx1ZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICAgICAgICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgbm9kZWJhY2soZXJyb3IpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbn07XG5cbi8vIEFsbCBjb2RlIGJlZm9yZSB0aGlzIHBvaW50IHdpbGwgYmUgZmlsdGVyZWQgZnJvbSBzdGFjayB0cmFjZXMuXG52YXIgcUVuZGluZ0xpbmUgPSBjYXB0dXJlTGluZSgpO1xuXG5yZXR1cm4gUTtcblxufSk7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKCdfcHJvY2VzcycpKSIsInZhciBsb2cgPSByZXF1aXJlKCcuLi92ZW5kb3Ivb3BlcmF0aW9ucy5qcy9zcmMvbG9nJyk7XG52YXIgTG9jYWxDYWNoZUxvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnTG9jYWxDYWNoZScpO1xuTG9jYWxDYWNoZUxvZ2dlci5zZXRMZXZlbChsb2cuTGV2ZWwud2Fybik7XG52YXIgUmVtb3RlQ2FjaGVMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ1JlbW90ZUNhY2hlJyk7XG5SZW1vdGVDYWNoZUxvZ2dlci5zZXRMZXZlbChsb2cuTGV2ZWwud2Fybik7XG52YXIgUmVzdEVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLlJlc3RFcnJvcjtcbnZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XG5cbi8qKlxuICogQ2FjaGUgYnkgcG91Y2ggX2lkLlxuICogQHR5cGUge3t9fVxuICovXG52YXIgbG9jYWxDYWNoZUJ5SWQgPSB7fTtcbnZhciBsb2NhbENhY2hlID0ge307XG5cbi8qKlxuICogQ2FjaGUgYnkgdHlwZSBhbmQgd2hhdGV2ZXIgaWQgd2FzIHNwZWNpZmllZCBpbiB0aGUgbWFwcGluZy5cbiAqIEB0eXBlIHt7fX1cbiAqL1xudmFyIHJlbW90ZUNhY2hlID0ge307XG5cbmZ1bmN0aW9uIHJlc2V0KCkge1xuICAgIHJlbW90ZUNhY2hlID0ge307XG4gICAgbG9jYWxDYWNoZUJ5SWQgPSB7fTtcbiAgICBsb2NhbENhY2hlID0ge307XG59XG5cbnJlc2V0KCk7XG5cbmZ1bmN0aW9uIGdldFZpYUxvY2FsSWQobG9jYWxJZCkge1xuICAgIHZhciBvYmogPSBsb2NhbENhY2hlQnlJZFtsb2NhbElkXTtcbiAgICBpZiAob2JqKSB7XG4gICAgICAgIGlmIChMb2NhbENhY2hlTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvY2FsQ2FjaGVMb2dnZXIuZGVidWcoJ0xvY2FsIGNhY2hlIGhpdDogJyArIG9iai5fZHVtcCh0cnVlKSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBpZiAoTG9jYWxDYWNoZUxvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2NhbENhY2hlTG9nZ2VyLmRlYnVnKCdMb2NhbCBjYWNoZSBtaXNzOiAnICsgbG9jYWxJZCk7XG4gICAgfVxuICAgIHJldHVybiAgb2JqO1xufVxuXG5mdW5jdGlvbiBnZXRTaW5nbGV0b24obWFwcGluZykge1xuICAgIHZhciBtYXBwaW5nTmFtZSA9IG1hcHBpbmcudHlwZTtcbiAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBtYXBwaW5nLmNvbGxlY3Rpb247XG4gICAgY29uc29sZS5lcnJvcignZ2V0U2luZ2xldG9uJywgbG9jYWxDYWNoZSk7XG4gICAgdmFyIGNvbGxlY3Rpb25DYWNoZSA9IGxvY2FsQ2FjaGVbY29sbGVjdGlvbk5hbWVdO1xuICAgIGlmIChjb2xsZWN0aW9uQ2FjaGUpIHtcbiAgICAgICAgdmFyIHR5cGVDYWNoZSA9IGNvbGxlY3Rpb25DYWNoZVttYXBwaW5nTmFtZV07XG4gICAgICAgIGlmICh0eXBlQ2FjaGUpIHtcbiAgICAgICAgICAgIHZhciBvYmpzID0gW107XG4gICAgICAgICAgICBmb3IgKHZhciBwcm9wIGluIHR5cGVDYWNoZSkge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlQ2FjaGUuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgICAgICAgICAgICAgb2Jqcy5wdXNoKHR5cGVDYWNoZVtwcm9wXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG9ianMubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IoJ0Egc2luZ2xldG9uIG1hcHBpbmcgaGFzIG1vcmUgdGhhbiAxIG9iamVjdCBpbiB0aGUgY2FjaGUhIFRoaXMgaXMgYSBzZXJpb3VzIGVycm9yLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ0VpdGhlciBhIG1hcHBpbmcgaGFzIGJlZW4gbW9kaWZpZWQgYWZ0ZXIgb2JqZWN0cyBoYXZlIGFscmVhZHkgYmVlbiBjcmVhdGVkLCBvciBzb21ldGhpbmcgaGFzIGdvbmUnICtcbiAgICAgICAgICAgICAgICAgICAgJ3Zlcnkgd3JvbmcuIFBsZWFzZSBmaWxlIGEgYnVnIHJlcG9ydCBpZiB0aGUgbGF0dGVyLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAob2Jqcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gb2Jqc1swXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gZ2V0VmlhUmVtb3RlSWQocmVtb3RlSWQsIG9wdHMpIHtcbiAgICB2YXIgdHlwZSA9IG9wdHMubWFwcGluZy50eXBlO1xuICAgIHZhciBjb2xsZWN0aW9uID0gb3B0cy5tYXBwaW5nLmNvbGxlY3Rpb247XG4gICAgdmFyIGNvbGxlY3Rpb25DYWNoZSA9IHJlbW90ZUNhY2hlW2NvbGxlY3Rpb25dO1xuICAgIGlmIChjb2xsZWN0aW9uQ2FjaGUpIHtcbiAgICAgICAgdmFyIHR5cGVDYWNoZSA9IHJlbW90ZUNhY2hlW2NvbGxlY3Rpb25dW3R5cGVdO1xuICAgICAgICBpZiAodHlwZUNhY2hlKSB7XG4gICAgICAgICAgICB2YXIgb2JqID0gdHlwZUNhY2hlW3JlbW90ZUlkXTtcbiAgICAgICAgICAgIGlmIChvYmopIHtcbiAgICAgICAgICAgICAgICBpZiAoUmVtb3RlQ2FjaGVMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICBSZW1vdGVDYWNoZUxvZ2dlci5kZWJ1ZygnUmVtb3RlIGNhY2hlIGhpdDogJyArIG9iai5fZHVtcCh0cnVlKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoUmVtb3RlQ2FjaGVMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICBSZW1vdGVDYWNoZUxvZ2dlci5kZWJ1ZygnUmVtb3RlIGNhY2hlIG1pc3M6ICcgKyByZW1vdGVJZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gIG9iajtcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAoUmVtb3RlQ2FjaGVMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICBSZW1vdGVDYWNoZUxvZ2dlci5kZWJ1ZygnUmVtb3RlIGNhY2hlIG1pc3M6ICcgKyByZW1vdGVJZCk7XG4gICAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIHJlbW90ZUluc2VydChvYmosIHJlbW90ZUlkLCBwcmV2aW91c1JlbW90ZUlkKSB7XG4gICAgaWYgKG9iaikge1xuICAgICAgICB2YXIgY29sbGVjdGlvbiA9IG9iai5tYXBwaW5nLmNvbGxlY3Rpb247XG4gICAgICAgIGlmIChjb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICBpZiAoIXJlbW90ZUNhY2hlW2NvbGxlY3Rpb25dKSB7XG4gICAgICAgICAgICAgICAgcmVtb3RlQ2FjaGVbY29sbGVjdGlvbl0gPSB7fTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciB0eXBlID0gb2JqLm1hcHBpbmcudHlwZTtcbiAgICAgICAgICAgIGlmICh0eXBlKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFyZW1vdGVDYWNoZVtjb2xsZWN0aW9uXVt0eXBlXSkge1xuICAgICAgICAgICAgICAgICAgICByZW1vdGVDYWNoZVtjb2xsZWN0aW9uXVt0eXBlXSA9IHt9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAocHJldmlvdXNSZW1vdGVJZCkge1xuICAgICAgICAgICAgICAgICAgICByZW1vdGVDYWNoZVtjb2xsZWN0aW9uXVt0eXBlXVtwcmV2aW91c1JlbW90ZUlkXSA9IG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHZhciBjYWNoZWRPYmplY3QgPSByZW1vdGVDYWNoZVtjb2xsZWN0aW9uXVt0eXBlXVtyZW1vdGVJZF07XG4gICAgICAgICAgICAgICAgaWYgKCFjYWNoZWRPYmplY3QpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3RlQ2FjaGVbY29sbGVjdGlvbl1bdHlwZV1bcmVtb3RlSWRdID0gb2JqO1xuICAgICAgICAgICAgICAgICAgICBpZiAoUmVtb3RlQ2FjaGVMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgUmVtb3RlQ2FjaGVMb2dnZXIuZGVidWcoJ1JlbW90ZSBjYWNoZSBpbnNlcnQ6ICcgKyBvYmouX2R1bXAodHJ1ZSkpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoUmVtb3RlQ2FjaGVMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgUmVtb3RlQ2FjaGVMb2dnZXIudHJhY2UoJ1JlbW90ZSBjYWNoZSBub3cgbG9va3MgbGlrZTogJyArIHJlbW90ZUR1bXAodHJ1ZSkpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBTb21ldGhpbmcgaGFzIGdvbmUgcmVhbGx5IHdyb25nLiBPbmx5IG9uZSBvYmplY3QgZm9yIGEgcGFydGljdWxhciBjb2xsZWN0aW9uL3R5cGUvcmVtb3RlaWQgY29tYm9cbiAgICAgICAgICAgICAgICAgICAgLy8gc2hvdWxkIGV2ZXIgZXhpc3QuXG4gICAgICAgICAgICAgICAgICAgIGlmIChvYmogIT0gY2FjaGVkT2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbWVzc2FnZSA9ICdPYmplY3QgJyArIGNvbGxlY3Rpb24udG9TdHJpbmcoKSArICc6JyArIHR5cGUudG9TdHJpbmcoKSArICdbJyArIG9iai5tYXBwaW5nLmlkICsgJz1cIicgKyByZW1vdGVJZCArICdcIl0gYWxyZWFkeSBleGlzdHMgaW4gdGhlIGNhY2hlLicgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICcgVGhpcyBpcyBhIHNlcmlvdXMgZXJyb3IsIHBsZWFzZSBmaWxlIGEgYnVnIHJlcG9ydCBpZiB5b3UgYXJlIGV4cGVyaWVuY2luZyB0aGlzIG91dCBpbiB0aGUgd2lsZCc7XG4gICAgICAgICAgICAgICAgICAgICAgICBSZW1vdGVDYWNoZUxvZ2dlci5lcnJvcihtZXNzYWdlLCB7b2JqOiBvYmosIGNhY2hlZE9iamVjdDogY2FjaGVkT2JqZWN0fSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB1dGlsLnByaW50U3RhY2tUcmFjZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFJlc3RFcnJvcihtZXNzYWdlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChSZW1vdGVDYWNoZUxvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgUmVtb3RlQ2FjaGVMb2dnZXIuZGVidWcoJ09iamVjdCBoYXMgYWxyZWFkeSBiZWVuIGluc2VydGVkOiAnICsgb2JqLl9kdW1wKHRydWUpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFJlc3RFcnJvcignTWFwcGluZyBoYXMgbm8gdHlwZScsIHttYXBwaW5nOiBvYmoubWFwcGluZywgb2JqOiBvYmp9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IoJ01hcHBpbmcgaGFzIG5vIGNvbGxlY3Rpb24nLCB7bWFwcGluZzogb2JqLm1hcHBpbmcsIG9iajogb2JqfSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHZhciBtc2cgPSAnTXVzdCBwYXNzIGFuIG9iamVjdCB3aGVuIGluc2VydGluZyB0byBjYWNoZSc7XG4gICAgICAgIFJlbW90ZUNhY2hlTG9nZ2VyLmVycm9yKG1zZyk7XG4gICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IobXNnKTtcbiAgICB9XG5cbn1cblxuZnVuY3Rpb24gcmVtb3RlRHVtcChhc0pzb24pIHtcbiAgICB2YXIgZHVtcGVkUmVzdENhY2hlID0ge307XG4gICAgZm9yICh2YXIgY29sbCBpbiByZW1vdGVDYWNoZSkge1xuICAgICAgICBpZiAocmVtb3RlQ2FjaGUuaGFzT3duUHJvcGVydHkoY29sbCkpIHtcbiAgICAgICAgICAgIHZhciBkdW1wZWRDb2xsQ2FjaGUgPSB7fTtcbiAgICAgICAgICAgIGR1bXBlZFJlc3RDYWNoZVtjb2xsXSA9IGR1bXBlZENvbGxDYWNoZTtcbiAgICAgICAgICAgIHZhciBjb2xsQ2FjaGUgPSByZW1vdGVDYWNoZVtjb2xsXTtcbiAgICAgICAgICAgIGZvciAodmFyIG1hcHBpbmcgaW4gY29sbENhY2hlKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNvbGxDYWNoZS5oYXNPd25Qcm9wZXJ0eShtYXBwaW5nKSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZHVtcGVkTWFwcGluZ0NhY2hlID0ge307XG4gICAgICAgICAgICAgICAgICAgIGR1bXBlZENvbGxDYWNoZVttYXBwaW5nXSA9IGR1bXBlZE1hcHBpbmdDYWNoZTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG1hcHBpbmdDYWNoZSA9IGNvbGxDYWNoZVttYXBwaW5nXTtcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgcmVtb3RlSWQgaW4gbWFwcGluZ0NhY2hlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobWFwcGluZ0NhY2hlLmhhc093blByb3BlcnR5KHJlbW90ZUlkKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChtYXBwaW5nQ2FjaGVbcmVtb3RlSWRdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGR1bXBlZE1hcHBpbmdDYWNoZVtyZW1vdGVJZF0gPSBtYXBwaW5nQ2FjaGVbcmVtb3RlSWRdLl9kdW1wKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBhc0pzb24gPyBKU09OLnN0cmluZ2lmeShkdW1wZWRSZXN0Q2FjaGUsIG51bGwsIDQpIDogZHVtcGVkUmVzdENhY2hlO1xuXG59XG5cbmZ1bmN0aW9uIGxvY2FsRHVtcChhc0pzb24pIHtcbiAgICB2YXIgZHVtcGVkSWRDYWNoZSA9IHt9O1xuICAgIGZvciAodmFyIGlkIGluIGxvY2FsQ2FjaGVCeUlkKSB7XG4gICAgICAgIGlmIChsb2NhbENhY2hlQnlJZC5oYXNPd25Qcm9wZXJ0eShpZCkpIHtcbiAgICAgICAgICAgIGR1bXBlZElkQ2FjaGVbaWRdID0gbG9jYWxDYWNoZUJ5SWRbaWRdLl9kdW1wKClcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gYXNKc29uID8gSlNPTi5zdHJpbmdpZnkoZHVtcGVkSWRDYWNoZSwgbnVsbCwgNCkgOiBkdW1wZWRJZENhY2hlO1xufVxuXG5mdW5jdGlvbiBkdW1wKGFzSnNvbikge1xuICAgIHZhciBkdW1wZWQgPSB7XG4gICAgICAgIGxvY2FsQ2FjaGU6IGxvY2FsRHVtcCgpLFxuICAgICAgICByZW1vdGVDYWNoZTogcmVtb3RlRHVtcCgpXG4gICAgfTtcbiAgICByZXR1cm4gYXNKc29uID8gSlNPTi5zdHJpbmdpZnkoZHVtcGVkLCBudWxsLCA0KSA6IGR1bXBlZDtcbn1cblxuZnVuY3Rpb24gX3JlbW90ZUNhY2hlKCkge1xuICAgIHJldHVybiByZW1vdGVDYWNoZVxufVxuXG5mdW5jdGlvbiBfbG9jYWxDYWNoZSgpIHtcbiAgICByZXR1cm4gbG9jYWxDYWNoZUJ5SWQ7XG59XG5cbmZ1bmN0aW9uIGdldChvcHRzKSB7XG4gICAgaWYgKExvY2FsQ2FjaGVMb2dnZXIuZGVidWcuaXNFbmFibGVkKSBMb2NhbENhY2hlTG9nZ2VyLmRlYnVnKCdnZXQnLCBvcHRzKTtcbiAgICB2YXIgb2JqLCBpZEZpZWxkLCByZW1vdGVJZDtcbiAgICB2YXIgbG9jYWxJZCA9IG9wdHMuX2lkO1xuICAgIGlmIChsb2NhbElkKSB7XG4gICAgICAgIG9iaiA9IGdldFZpYUxvY2FsSWQobG9jYWxJZCk7XG4gICAgICAgIGlmIChvYmopIHtcbiAgICAgICAgICAgIHJldHVybiBvYmo7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBpZiAob3B0cy5tYXBwaW5nKSB7XG4gICAgICAgICAgICAgICAgaWRGaWVsZCA9IG9wdHMubWFwcGluZy5pZDtcbiAgICAgICAgICAgICAgICByZW1vdGVJZCA9IG9wdHNbaWRGaWVsZF07XG4gICAgICAgICAgICAgICAgaWYgKExvY2FsQ2FjaGVMb2dnZXIuZGVidWcuaXNFbmFibGVkKSBMb2NhbENhY2hlTG9nZ2VyLmRlYnVnKGlkRmllbGQgKyAnPScgKyByZW1vdGVJZCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGdldFZpYVJlbW90ZUlkKHJlbW90ZUlkLCBvcHRzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIGVsc2UgaWYgKG9wdHMubWFwcGluZykge1xuICAgICAgICBpZEZpZWxkID0gb3B0cy5tYXBwaW5nLmlkO1xuICAgICAgICByZW1vdGVJZCA9IG9wdHNbaWRGaWVsZF07XG4gICAgICAgIGlmIChyZW1vdGVJZCkge1xuICAgICAgICAgICAgcmV0dXJuIGdldFZpYVJlbW90ZUlkKHJlbW90ZUlkLCBvcHRzKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChvcHRzLm1hcHBpbmcuc2luZ2xldG9uKSB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0U2luZ2xldG9uKG9wdHMubWFwcGluZyk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIExvY2FsQ2FjaGVMb2dnZXIud2FybignSW52YWxpZCBvcHRzIHRvIGNhY2hlJywge29wdHM6IG9wdHN9KTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG59XG5cbi8vIFRPRE86IFJFTU9WRSBUSElTLiBPTkxZIEZPUiBERUJVR0dJTkcuXG5mdW5jdGlvbiB2YWxpZGF0ZSgpIHtcbiAgICB2YXIgaWRlbnRzID0gT2JqZWN0LmtleXMobG9jYWxDYWNoZUJ5SWQpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgaWRlbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBpZGVudCA9IGlkZW50c1tpXTtcbiAgICAgICAgdmFyIG9iaiA9IGxvY2FsQ2FjaGVCeUlkW2lkZW50XTtcbiAgICAgICAgaWYgKGlkZW50ICE9IG9iai5faWQpIHtcbiAgICAgICAgICAgIHV0aWwucHJpbnRTdGFja1RyYWNlKCk7XG4gICAgICAgICAgICB0aHJvdyBuZXcgUmVzdEVycm9yKCd3dGY/Jyk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIGluc2VydChvYmopIHtcbiAgICB2YXIgbG9jYWxJZCA9IG9iai5faWQ7XG4gICAgaWYgKGxvY2FsSWQpIHtcbiAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gb2JqLm1hcHBpbmcuY29sbGVjdGlvbjtcbiAgICAgICAgdmFyIG1hcHBpbmdOYW1lID0gb2JqLm1hcHBpbmcudHlwZTtcbiAgICAgICAgaWYgKCFsb2NhbENhY2hlQnlJZFtsb2NhbElkXSkge1xuICAgICAgICAgICAgaWYgKExvY2FsQ2FjaGVMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgIExvY2FsQ2FjaGVMb2dnZXIuZGVidWcoJ0xvY2FsIGNhY2hlIGluc2VydDogJyArIG9iai5fZHVtcCh0cnVlKSk7XG4gICAgICAgICAgICBsb2NhbENhY2hlQnlJZFtsb2NhbElkXSA9IG9iajtcbiAgICAgICAgICAgIGlmIChMb2NhbENhY2hlTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICBMb2NhbENhY2hlTG9nZ2VyLnRyYWNlKCdMb2NhbCBjYWNoZSBub3cgbG9va3MgbGlrZTogJyArIGxvY2FsRHVtcCh0cnVlKSk7XG4gICAgICAgICAgICBpZiAoIWxvY2FsQ2FjaGVbY29sbGVjdGlvbk5hbWVdKSBsb2NhbENhY2hlW2NvbGxlY3Rpb25OYW1lXSA9IHt9O1xuICAgICAgICAgICAgaWYgKCFsb2NhbENhY2hlW2NvbGxlY3Rpb25OYW1lXVsgbWFwcGluZ05hbWVdKSBsb2NhbENhY2hlW2NvbGxlY3Rpb25OYW1lXVttYXBwaW5nTmFtZV0gPSB7fTtcbiAgICAgICAgICAgIGxvY2FsQ2FjaGVbY29sbGVjdGlvbk5hbWVdW29iai50eXBlXVtsb2NhbElkXSA9IG9iajtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIC8vIFNvbWV0aGluZyBoYXMgZ29uZSBiYWRseSB3cm9uZyBoZXJlLiBUd28gb2JqZWN0cyBzaG91bGQgbmV2ZXIgZXhpc3Qgd2l0aCB0aGUgc2FtZSBfaWRcbiAgICAgICAgICAgIGlmIChsb2NhbENhY2hlQnlJZFtsb2NhbElkXSAhPSBvYmopIHtcbiAgICAgICAgICAgICAgICB2YXIgbWVzc2FnZSA9ICdPYmplY3Qgd2l0aCBfaWQ9XCInICsgbG9jYWxJZC50b1N0cmluZygpICsgJ1wiIGlzIGFscmVhZHkgaW4gdGhlIGNhY2hlLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1RoaXMgaXMgYSBzZXJpb3VzIGVycm9yLiBQbGVhc2UgZmlsZSBhIGJ1ZyByZXBvcnQgaWYgeW91IGFyZSBleHBlcmllbmNpbmcgdGhpcyBvdXQgaW4gdGhlIHdpbGQnO1xuICAgICAgICAgICAgICAgIExvY2FsQ2FjaGVMb2dnZXIuZXJyb3IobWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFJlc3RFcnJvcihtZXNzYWdlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICB2YXIgaWRGaWVsZCA9IG9iai5pZEZpZWxkO1xuICAgIHZhciByZW1vdGVJZCA9IG9ialtpZEZpZWxkXTtcbiAgICBpZiAocmVtb3RlSWQpIHtcbiAgICAgICAgcmVtb3RlSW5zZXJ0KG9iaiwgcmVtb3RlSWQpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgaWYgKFJlbW90ZUNhY2hlTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgIFJlbW90ZUNhY2hlTG9nZ2VyLmRlYnVnKCdObyByZW1vdGUgaWQgKFwiJyArIGlkRmllbGQgKyAnXCIpIHNvIHdvbnQgYmUgcGxhY2luZyBpbiB0aGUgcmVtb3RlIGNhY2hlJywgb2JqKTtcbiAgICB9XG4gICAgdmFsaWRhdGUoKTtcbn1cblxuXG5mdW5jdGlvbiBkdW1wKGFzSnNvbikge1xuICAgIHZhciBkdW1wZWQgPSB7XG4gICAgICAgIGxvY2FsQ2FjaGU6IGxvY2FsRHVtcCgpLFxuICAgICAgICByZW1vdGVDYWNoZTogcmVtb3RlRHVtcCgpXG4gICAgfTtcbiAgICByZXR1cm4gYXNKc29uID8gSlNPTi5zdHJpbmdpZnkoZHVtcGVkLCBudWxsLCA0KSA6IGR1bXBlZDtcbn1cblxuXG5leHBvcnRzLl9yZW1vdGVDYWNoZSA9IF9yZW1vdGVDYWNoZTtcbmV4cG9ydHMuX2xvY2FsQ2FjaGUgPSBfbG9jYWxDYWNoZTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX2xvY2FsQ2FjaGVCeVR5cGUnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBsb2NhbENhY2hlO1xuICAgIH1cbn0pO1xuZXhwb3J0cy5nZXQgPSBnZXQ7XG5leHBvcnRzLmluc2VydCA9IGluc2VydDtcbmV4cG9ydHMucmVtb3RlSW5zZXJ0ID0gcmVtb3RlSW5zZXJ0O1xuZXhwb3J0cy5yZXNldCA9IHJlc2V0O1xuZXhwb3J0cy5fZHVtcCA9IGR1bXA7XG5cblxuXG5cblxuXG5cblxuXG5cbiIsInZhciBkZWZpbmVTdWJQcm9wZXJ0eSA9IHJlcXVpcmUoJy4vbWlzYycpLmRlZmluZVN1YlByb3BlcnR5O1xudmFyIG5vdGlmaWNhdGlvbkNlbnRyZSA9IHJlcXVpcmUoJy4vbm90aWZpY2F0aW9uQ2VudHJlJykubm90aWZpY2F0aW9uQ2VudHJlO1xudmFyIFJlc3RFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5SZXN0RXJyb3I7XG52YXIgbG9nID0gcmVxdWlyZSgnLi4vdmVuZG9yL29wZXJhdGlvbnMuanMvc3JjL2xvZycpO1xuXG52YXIgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKCdjaGFuZ2VzJyk7XG5Mb2dnZXIuc2V0TGV2ZWwobG9nLkxldmVsLndhcm4pO1xuXG52YXIgQ2hhbmdlVHlwZSA9IHtcbiAgICBTZXQ6ICdTZXQnLFxuICAgIFNwbGljZTogJ1NwbGljZScsXG4gICAgUmVtb3ZlOiAnUmVtb3ZlJ1xufTtcblxuLyoqXG4gKiBSZXByZXNlbnRzIGFuIGluZGl2aWR1YWwgY2hhbmdlLlxuICogQHBhcmFtIG9wdHNcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBDaGFuZ2Uob3B0cykge1xuICAgIHRoaXMuX29wdHMgPSBvcHRzO1xuICAgIGlmICghdGhpcy5fb3B0cykge1xuICAgICAgICB0aGlzLl9vcHRzID0ge307XG4gICAgfVxuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ2NvbGxlY3Rpb24nLCB0aGlzLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdtYXBwaW5nJywgdGhpcy5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnX2lkJywgdGhpcy5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnZmllbGQnLCB0aGlzLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICd0eXBlJywgdGhpcy5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnaW5kZXgnLCB0aGlzLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdhZGRlZCcsIHRoaXMuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ2FkZGVkSWQnLCB0aGlzLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdyZW1vdmVkJywgdGhpcy5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAncmVtb3ZlZElkJywgdGhpcy5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnbmV3JywgdGhpcy5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnbmV3SWQnLCB0aGlzLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdvbGQnLCB0aGlzLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdvbGRJZCcsIHRoaXMuX29wdHMpO1xufVxuXG5DaGFuZ2UucHJvdG90eXBlLl9kdW1wID0gZnVuY3Rpb24gKGpzb24pIHtcbiAgICB2YXIgZHVtcGVkID0ge307XG4gICAgZHVtcGVkLmNvbGxlY3Rpb24gPSAodHlwZW9mIHRoaXMuY29sbGVjdGlvbikgPT0gJ3N0cmluZycgPyB0aGlzLmNvbGxlY3Rpb24gOiB0aGlzLmNvbGxlY3Rpb24uX2R1bXAoKTtcbiAgICBkdW1wZWQubWFwcGluZyA9ICh0eXBlb2YgdGhpcy5tYXBwaW5nKSA9PSAnc3RyaW5nJyA/IHRoaXMubWFwcGluZyA6IHRoaXMubWFwcGluZy50eXBlO1xuICAgIGR1bXBlZC5faWQgPSB0aGlzLl9pZDtcbiAgICBkdW1wZWQuZmllbGQgPSB0aGlzLmZpZWxkO1xuICAgIGR1bXBlZC50eXBlID0gdGhpcy50eXBlO1xuICAgIGlmICh0aGlzLmluZGV4KSBkdW1wZWQuaW5kZXggPSB0aGlzLmluZGV4O1xuICAgIGlmICh0aGlzLmFkZGVkKSBkdW1wZWQuYWRkZWQgPSBfLm1hcCh0aGlzLmFkZGVkLCBmdW5jdGlvbiAoeCkge3JldHVybiB4Ll9kdW1wKCl9KTtcbiAgICBpZiAodGhpcy5yZW1vdmVkKSBkdW1wZWQucmVtb3ZlZCA9IF8ubWFwKHRoaXMucmVtb3ZlZCwgZnVuY3Rpb24gKHgpIHtyZXR1cm4geC5fZHVtcCgpfSk7XG4gICAgaWYgKHRoaXMub2xkKSBkdW1wZWQub2xkID0gdGhpcy5vbGQ7XG4gICAgaWYgKHRoaXMubmV3KSBkdW1wZWQubmV3ID0gdGhpcy5uZXc7XG4gICAgcmV0dXJuIGpzb24gPyBKU09OLnN0cmluZ2lmeShkdW1wZWQsIG51bGwsIDQpIDogZHVtcGVkO1xufTtcblxuZnVuY3Rpb24gYnJvYWRjYXN0KGNvbGxlY3Rpb24sIG1hcHBpbmcsIGMpIHtcbiAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZCkgTG9nZ2VyLnRyYWNlKCdTZW5kaW5nIG5vdGlmaWNhdGlvbiBcIicgKyBjb2xsZWN0aW9uICsgJ1wiJyk7XG4gICAgbm90aWZpY2F0aW9uQ2VudHJlLmVtaXQoY29sbGVjdGlvbiwgYyk7XG4gICAgdmFyIG1hcHBpbmdOb3RpZiA9IGNvbGxlY3Rpb24gKyAnOicgKyBtYXBwaW5nO1xuICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSBMb2dnZXIudHJhY2UoJ1NlbmRpbmcgbm90aWZpY2F0aW9uIFwiJyArIG1hcHBpbmdOb3RpZiArICdcIicpO1xuICAgIG5vdGlmaWNhdGlvbkNlbnRyZS5lbWl0KG1hcHBpbmdOb3RpZiwgYyk7XG4gICAgdmFyIGdlbmVyaWNOb3RpZiA9ICdTaWVzdGEnO1xuICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSBMb2dnZXIudHJhY2UoJ1NlbmRpbmcgbm90aWZpY2F0aW9uIFwiJyArIGdlbmVyaWNOb3RpZiArICdcIicpO1xuICAgIG5vdGlmaWNhdGlvbkNlbnRyZS5lbWl0KGdlbmVyaWNOb3RpZiwgYyk7XG59XG5cbi8qKlxuICogVGhyb3cgYW4gZXJyb3IgaWYgdGhlIGNoYW5nZSBpcyBpbmNvcnJlY3QuXG4gKiBAcGFyYW0gY2hhbmdlT3B0c1xuICovXG5mdW5jdGlvbiB2YWxpZGF0ZUNoYW5nZShjaGFuZ2VPcHRzKSB7XG4gICAgaWYgKCFjaGFuZ2VPcHRzLm1hcHBpbmcpIHRocm93IG5ldyBSZXN0RXJyb3IoJ011c3QgcGFzcyBhIG1hcHBpbmcnKTtcbiAgICBpZiAoIWNoYW5nZU9wdHMuY29sbGVjdGlvbikgdGhyb3cgbmV3IFJlc3RFcnJvcignTXVzdCBwYXNzIGEgY29sbGVjdGlvbicpO1xuICAgIGlmICghY2hhbmdlT3B0cy5faWQpIHRocm93IG5ldyBSZXN0RXJyb3IoJ011c3QgcGFzcyBhIGxvY2FsIGlkZW50aWZpZXInKTtcbn1cblxuXG4vKipcbiAqIFJlZ2lzdGVyIHRoYXQgYSBjaGFuZ2UgaGFzIGJlZW4gbWFkZS5cbiAqIEBwYXJhbSBvcHRzXG4gKi9cbmZ1bmN0aW9uIHJlZ2lzdGVyQ2hhbmdlKG9wdHMpIHtcbiAgICB2YWxpZGF0ZUNoYW5nZShvcHRzKTtcbiAgICB2YXIgY29sbGVjdGlvbiA9IG9wdHMuY29sbGVjdGlvbjtcbiAgICB2YXIgbWFwcGluZyA9IG9wdHMubWFwcGluZztcbiAgICB2YXIgYyA9IG5ldyBDaGFuZ2Uob3B0cyk7XG4gICAgYnJvYWRjYXN0KGNvbGxlY3Rpb24sIG1hcHBpbmcsIGMpO1xuICAgIHJldHVybiBjO1xufVxuXG5leHBvcnRzLkNoYW5nZSA9IENoYW5nZTtcbmV4cG9ydHMucmVnaXN0ZXJDaGFuZ2UgPSByZWdpc3RlckNoYW5nZTtcbmV4cG9ydHMudmFsaWRhdGVDaGFuZ2UgPSB2YWxpZGF0ZUNoYW5nZTtcbmV4cG9ydHMuQ2hhbmdlVHlwZSA9IENoYW5nZVR5cGU7IiwidmFyIGxvZyA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vcGVyYXRpb25zLmpzL3NyYy9sb2cnKTtcbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ0NvbGxlY3Rpb24nKTtcbkxvZ2dlci5zZXRMZXZlbChsb2cuTGV2ZWwud2Fybik7XG5cbnZhciBDb2xsZWN0aW9uUmVnaXN0cnkgPSByZXF1aXJlKCcuL2NvbGxlY3Rpb25SZWdpc3RyeScpLkNvbGxlY3Rpb25SZWdpc3RyeTtcbnZhciBPcGVyYXRpb24gPSByZXF1aXJlKCcuLi92ZW5kb3Ivb3BlcmF0aW9ucy5qcy9zcmMvb3BlcmF0aW9uJykuT3BlcmF0aW9uO1xudmFyIFJlc3RFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5SZXN0RXJyb3I7XG52YXIgTWFwcGluZyA9IHJlcXVpcmUoJy4vbWFwcGluZycpLk1hcHBpbmc7XG52YXIgZXh0ZW5kID0gcmVxdWlyZSgnZXh0ZW5kJyk7XG52YXIgb2JzZXJ2ZSA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuUGxhdGZvcm07XG5cbi8vdmFyICQgPSByZXF1aXJlKCcuLi92ZW5kb3IvemVwdG8nKS4kO1xudmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcbnZhciBfID0gdXRpbC5fO1xuXG52YXIgcSA9IHJlcXVpcmUoJ3EnKTtcblxudmFyIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpO1xuLyoqXG4gKiBBIGNvbGxlY3Rpb24gZGVzY3JpYmVzIGEgc2V0IG9mIG1vZGVscyBhbmQgb3B0aW9uYWxseSBhIFJFU1QgQVBJIHdoaWNoIHdlIHdvdWxkXG4gKiBsaWtlIHRvIG1vZGVsLlxuICpcbiAqIEBwYXJhbSBuYW1lXG4gKiBAY29uc3RydWN0b3JcbiAqXG4gKiBAZXhhbXBsZVxuICogYGBganNcbiAqIHZhciBHaXRIdWIgPSBuZXcgQ29sbGVjdGlvbignR2l0SHViJylcbiAqIC8vIC4uLiBjb25maWd1cmUgbWFwcGluZ3MsIGRlc2NyaXB0b3JzIGV0YyAuLi5cbiAqIEdpdEh1Yi5pbnN0YWxsKGZ1bmN0aW9uICgpIHtcbiAqICAgICAvLyAuLi4gY2Fycnkgb24uXG4gKiB9KTtcbiAqIGBgYFxuICovXG5mdW5jdGlvbiBDb2xsZWN0aW9uKG5hbWUpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKCF0aGlzKSByZXR1cm4gbmV3IENvbGxlY3Rpb24obmFtZSk7XG4gICAgaWYgKCFuYW1lKSB0aHJvdyBuZXcgUmVzdEVycm9yKCdDb2xsZWN0aW9uIG11c3QgaGF2ZSBhIG5hbWUnKTtcbiAgICB0aGlzLl9uYW1lID0gbmFtZTtcbiAgICB0aGlzLl9kb2NJZCA9ICdDb2xsZWN0aW9uXycgKyB0aGlzLl9uYW1lO1xuICAgIHRoaXMuX3Jhd01hcHBpbmdzID0ge307XG4gICAgdGhpcy5fbWFwcGluZ3MgPSB7fTtcbiAgICAvKipcbiAgICAgKiBUaGUgVVJMIG9mIHRoZSBBUEkgZS5nLiBodHRwOi8vYXBpLmdpdGh1Yi5jb21cbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIHRoaXMuYmFzZVVSTCA9ICcnO1xuXG4gICAgLyoqXG4gICAgICogU2V0IHRvIHRydWUgaWYgaW5zdGFsbGF0aW9uIGhhcyBzdWNjZWVkZWQuIFlvdSBjYW5ub3QgdXNlIHRoZSBjb2xsZWN0aW9cbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICB0aGlzLmluc3RhbGxlZCA9IGZhbHNlO1xuICAgIENvbGxlY3Rpb25SZWdpc3RyeS5yZWdpc3Rlcih0aGlzKTtcblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ25hbWUnLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHNlbGYuX25hbWU7XG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxuLyoqXG4gKiBFbnN1cmUgbWFwcGluZ3MgYXJlIGluc3RhbGxlZC5cbiAqIEBwYXJhbSBjYWxsYmFja1xuICovXG5Db2xsZWN0aW9uLnByb3RvdHlwZS5pbnN0YWxsID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgdmFyIGRlZmVycmVkID0gcS5kZWZlcigpO1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoIXRoaXMuaW5zdGFsbGVkKSB7XG4gICAgICAgIHZhciBtYXBwaW5nc1RvSW5zdGFsbCA9IFtdO1xuICAgICAgICBmb3IgKHZhciBuYW1lIGluIHRoaXMuX21hcHBpbmdzKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fbWFwcGluZ3MuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgICAgICAgICB2YXIgbWFwcGluZyA9IHRoaXMuX21hcHBpbmdzW25hbWVdO1xuICAgICAgICAgICAgICAgIG1hcHBpbmdzVG9JbnN0YWxsLnB1c2gobWFwcGluZyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKExvZ2dlci5pbmZvLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci5pbmZvKCdUaGVyZSBhcmUgJyArIG1hcHBpbmdzVG9JbnN0YWxsLmxlbmd0aC50b1N0cmluZygpICsgJyBtYXBwaW5ncyB0byBpbnN0YWxsJyk7XG4gICAgICAgIGlmIChtYXBwaW5nc1RvSW5zdGFsbC5sZW5ndGgpIHtcbiAgICAgICAgICAgIHZhciBvcGVyYXRpb25zID0gXy5tYXAobWFwcGluZ3NUb0luc3RhbGwsIGZ1bmN0aW9uIChtKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBPcGVyYXRpb24oJ0luc3RhbGwgTWFwcGluZycsIF8uYmluZChtLmluc3RhbGwsIG0pKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdmFyIG9wID0gbmV3IE9wZXJhdGlvbignSW5zdGFsbCBNYXBwaW5ncycsIG9wZXJhdGlvbnMpO1xuICAgICAgICAgICAgb3AuY29tcGxldGlvbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBpZiAob3AuZmFpbGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIExvZ2dlci5lcnJvcignRmFpbGVkIHRvIGluc3RhbGwgY29sbGVjdGlvbicsIG9wLmVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5fZmluYWxpc2VJbnN0YWxsYXRpb24ob3AuZXJyb3IsIGNhbGxiYWNrKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuaW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGVycm9ycyA9IFtdO1xuICAgICAgICAgICAgICAgICAgICBfLmVhY2gobWFwcGluZ3NUb0luc3RhbGwsIGZ1bmN0aW9uIChtKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLmluZm8uaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIExvZ2dlci5pbmZvKCdJbnN0YWxsaW5nIHJlbGF0aW9uc2hpcHMgZm9yIG1hcHBpbmcgd2l0aCBuYW1lIFwiJyArIG0udHlwZSArICdcIicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtLmluc3RhbGxSZWxhdGlvbnNoaXBzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVyciBpbnN0YW5jZW9mIFJlc3RFcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnJvcnMucHVzaChlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgXy5lYWNoKG1hcHBpbmdzVG9JbnN0YWxsLCBmdW5jdGlvbiAobSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChMb2dnZXIuaW5mby5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIExvZ2dlci5pbmZvKCdJbnN0YWxsaW5nIHJldmVyc2UgcmVsYXRpb25zaGlwcyBmb3IgbWFwcGluZyB3aXRoIG5hbWUgXCInICsgbS50eXBlICsgJ1wiJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbS5pbnN0YWxsUmV2ZXJzZVJlbGF0aW9uc2hpcHMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyIGluc3RhbmNlb2YgUmVzdEVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnJvcnMucHVzaChlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgdmFyIGVycjtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycm9ycy5sZW5ndGggPT0gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXJyID0gZXJyb3JzWzBdO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKGVycm9ycy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVyciA9IGVycm9ycztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBzZWxmLl9maW5hbGlzZUluc3RhbGxhdGlvbihlcnIsIGNhbGxiYWNrKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgb3Auc3RhcnQoKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHNlbGYuX2ZpbmFsaXNlSW5zdGFsbGF0aW9uKG51bGwsIGNhbGxiYWNrKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdmFyIGVyciA9IG5ldyBSZXN0RXJyb3IoJ0NvbGxlY3Rpb24gXCInICsgdGhpcy5fbmFtZSArICdcIiBoYXMgYWxyZWFkeSBiZWVuIGluc3RhbGxlZCcpO1xuICAgICAgICBzZWxmLl9maW5hbGlzZUluc3RhbGxhdGlvbihlcnIsIGNhbGxiYWNrKTtcbiAgICB9XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59O1xuQ29sbGVjdGlvbi5wcm90b3R5cGUuX2ZpbmFsaXNlSW5zdGFsbGF0aW9uID0gZnVuY3Rpb24gKGVyciwgY2FsbGJhY2spIHtcbiAgICBpZiAoIWVycikge1xuICAgICAgICB0aGlzLmluc3RhbGxlZCA9IHRydWU7XG4gICAgICAgIHZhciBpbmRleCA9IHJlcXVpcmUoJy4uL2luZGV4Jyk7XG4gICAgICAgIGluZGV4W3RoaXMuX25hbWVdID0gdGhpcztcbiAgICB9XG4gICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIpO1xufTtcbkNvbGxlY3Rpb24ucHJvdG90eXBlLl9tYXBwaW5nID0gZnVuY3Rpb24gKG5hbWUsIG1hcHBpbmcpIHtcbiAgICBpZiAobmFtZSkge1xuICAgICAgICB0aGlzLl9yYXdNYXBwaW5nc1tuYW1lXSA9IG1hcHBpbmc7XG4gICAgICAgIHZhciBvcHRzID0gZXh0ZW5kKHRydWUsIHt9LCBtYXBwaW5nKTtcbiAgICAgICAgb3B0cy50eXBlID0gbmFtZTtcbiAgICAgICAgb3B0cy5jb2xsZWN0aW9uID0gdGhpcy5fbmFtZTtcbiAgICAgICAgdmFyIG1hcHBpbmdPYmplY3QgPSBuZXcgTWFwcGluZyhvcHRzKTtcbiAgICAgICAgdGhpcy5fbWFwcGluZ3NbbmFtZV0gPSBtYXBwaW5nT2JqZWN0O1xuICAgICAgICB0aGlzW25hbWVdID0gbWFwcGluZ09iamVjdDtcbiAgICAgICAgcmV0dXJuIG1hcHBpbmdPYmplY3Q7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgUmVzdEVycm9yKCdObyBuYW1lIHNwZWNpZmllZCB3aGVuIGNyZWF0aW5nIG1hcHBpbmcnKTtcbiAgICB9XG59O1xuQ29sbGVjdGlvbi5wcm90b3R5cGUubWFwcGluZyA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT0gMSkge1xuICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheShhcmd1bWVudHNbMF0pKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIF8ubWFwKGFyZ3VtZW50c1swXSwgZnVuY3Rpb24gKG0pIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHNlbGYuX21hcHBpbmcobS5uYW1lLCBtKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9tYXBwaW5nKGFyZ3VtZW50c1swXS5uYW1lLCBhcmd1bWVudHNbMF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBhcmd1bWVudHNbMF0gPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fbWFwcGluZyhhcmd1bWVudHNbMF0sIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gXy5tYXAoYXJndW1lbnRzLCBmdW5jdGlvbiAobSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gc2VsZi5fbWFwcGluZyhtLm5hbWUsIG0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xufTtcblxuZnVuY3Rpb24gcmVxdWVzdERlc2NyaXB0b3Iob3B0cykge1xuICAgIHZhciByZXF1ZXN0RGVzY3JpcHRvciA9IG5ldyBzaWVzdGEuZXh0Lmh0dHAuUmVxdWVzdERlc2NyaXB0b3Iob3B0cyk7XG4gICAgc2llc3RhLmV4dC5odHRwLkRlc2NyaXB0b3JSZWdpc3RyeS5yZWdpc3RlclJlcXVlc3REZXNjcmlwdG9yKHJlcXVlc3REZXNjcmlwdG9yKTtcbiAgICByZXR1cm4gcmVxdWVzdERlc2NyaXB0b3I7XG59XG5cbmZ1bmN0aW9uIHJlc3BvbnNlRGVzY3JpcHRvcihvcHRzKSB7XG4gICAgdmFyIHJlc3BvbnNlRGVzY3JpcHRvciA9IG5ldyBzaWVzdGEuZXh0Lmh0dHAuUmVzcG9uc2VEZXNjcmlwdG9yKG9wdHMpO1xuICAgIHNpZXN0YS5leHQuaHR0cC5EZXNjcmlwdG9yUmVnaXN0cnkucmVnaXN0ZXJSZXNwb25zZURlc2NyaXB0b3IocmVzcG9uc2VEZXNjcmlwdG9yKTtcbiAgICByZXR1cm4gcmVzcG9uc2VEZXNjcmlwdG9yO1xufVxuXG5Db2xsZWN0aW9uLnByb3RvdHlwZS5fZGVzY3JpcHRvciA9IGZ1bmN0aW9uIChyZWdpc3RyYXRpb25GdW5jKSB7XG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIGlmIChhcmdzLmxlbmd0aCkge1xuICAgICAgICBpZiAoYXJncy5sZW5ndGggPT0gMSkge1xuICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheShhcmdzWzBdKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBfLm1hcChhcmdzWzBdLCBmdW5jdGlvbiAoZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVnaXN0cmF0aW9uRnVuYyhkKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiByZWdpc3RyYXRpb25GdW5jKGFyZ3NbMF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIF8ubWFwKGFyZ3MsIGZ1bmN0aW9uIChkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlZ2lzdHJhdGlvbkZ1bmMoZCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbn07XG5Db2xsZWN0aW9uLnByb3RvdHlwZS5yZXF1ZXN0RGVzY3JpcHRvciA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKHRoaXMuX2Rlc2NyaXB0b3IsIHJlcXVlc3REZXNjcmlwdG9yKS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufTtcbkNvbGxlY3Rpb24ucHJvdG90eXBlLnJlc3BvbnNlRGVzY3JpcHRvciA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKHRoaXMuX2Rlc2NyaXB0b3IsIHJlc3BvbnNlRGVzY3JpcHRvcikuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn07XG5Db2xsZWN0aW9uLnByb3RvdHlwZS5fZHVtcCA9IGZ1bmN0aW9uIChhc0pzb24pIHtcbiAgICB2YXIgb2JqID0ge307XG4gICAgb2JqLmluc3RhbGxlZCA9IHRoaXMuaW5zdGFsbGVkO1xuICAgIG9iai5kb2NJZCA9IHRoaXMuX2RvY0lkO1xuICAgIG9iai5uYW1lID0gdGhpcy5fbmFtZTtcbiAgICBvYmouYmFzZVVSTCA9IHRoaXMuYmFzZVVSTDtcbiAgICByZXR1cm4gYXNKc29uID8gSlNPTi5zdHJpbmdpZnkob2JqLCBudWxsLCA0KSA6IG9iajtcbn07XG5cblxuLyoqXG4gKiBQZXJzaXN0IGFsbCBjaGFuZ2VzIHRvIFBvdWNoREIuXG4gKiBOb3RlOiBTdG9yYWdlIGV4dGVuc2lvbiBtdXN0IGJlIGluc3RhbGxlZC5cbiAqIEBwYXJhbSBjYWxsYmFja1xuICogQHJldHVybnMge1Byb21pc2V9XG4gKi9cbkNvbGxlY3Rpb24ucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICB2YXIgZGVmZXJyZWQgPSBxLmRlZmVyKCk7XG4gICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICBpZiAoc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCkge1xuICAgICAgICB1dGlsLm5leHQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIG1lcmdlQ2hhbmdlcyA9IHNpZXN0YS5leHQuc3RvcmFnZS5jaGFuZ2VzLm1lcmdlQ2hhbmdlcztcbiAgICAgICAgICAgIG1lcmdlQ2hhbmdlcyhjYWxsYmFjayk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgY2FsbGJhY2soJ1N0b3JhZ2UgbW9kdWxlIG5vdCBpbnN0YWxsZWQnKTtcbiAgICB9XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59O1xuXG5cbi8qKlxuICogU2VuZCBhIEhUVFAgcmVxdWVzdCB1c2luZyB0aGUgZ2l2ZW4gbWV0aG9kXG4gKiBAcGFyYW0gcmVxdWVzdCBEb2VzIHRoZSByZXF1ZXN0IGNvbnRhaW4gZGF0YT8gZS5nLiBQT1NUL1BBVENIL1BVVCB3aWxsIGJlIHRydWUsIEdFVCB3aWxsIGZhbHNlXG4gKiBAcGFyYW0gbWV0aG9kXG4gKiBAcmV0dXJucyB7Kn1cbiAqL1xuQ29sbGVjdGlvbi5wcm90b3R5cGUuSFRUUF9NRVRIT0QgPSBmdW5jdGlvbiAocmVxdWVzdCwgbWV0aG9kKSB7XG4gICAgaWYgKHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQpIHtcbiAgICAgICAgcmV0dXJuIF8ucGFydGlhbChyZXF1ZXN0ID8gdGhpcy5faHR0cFJlcXVlc3QgOiB0aGlzLl9odHRwUmVzcG9uc2UsIG1ldGhvZCkuYXBwbHkodGhpcywgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICB0aHJvdyBFcnJvcignU3RvcmFnZSBleHRlbnNpb24gbm90IGluc3RhbGxlZC4nKTtcbiAgICB9XG59O1xuXG4vKipcbiAqIFNlbmQgYSBHRVQgcmVxdWVzdFxuICogQHJldHVybnMgeyp9XG4gKi9cbkNvbGxlY3Rpb24ucHJvdG90eXBlLkdFVCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKHRoaXMuSFRUUF9NRVRIT0QsIGZhbHNlLCAnR0VUJykuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn07XG5cbi8qKlxuICogU2VuZCBhIE9QVElPTlMgcmVxdWVzdFxuICogQHJldHVybnMgeyp9XG4gKi9cbkNvbGxlY3Rpb24ucHJvdG90eXBlLk9QVElPTlMgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIF8ucGFydGlhbCh0aGlzLkhUVFBfTUVUSE9ELCBmYWxzZSwgJ09QVElPTlMnKS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufTtcblxuLyoqXG4gKiBTZW5kIGEgVFJBQ0UgcmVxdWVzdFxuICogQHJldHVybnMgeyp9XG4gKi9cbkNvbGxlY3Rpb24ucHJvdG90eXBlLlRSQUNFID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBfLnBhcnRpYWwodGhpcy5IVFRQX01FVEhPRCwgZmFsc2UsICdUUkFDRScpLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG59O1xuXG4vKipcbiAqIFNlbmQgYSBIRUFEIHJlcXVlc3RcbiAqIEByZXR1cm5zIHsqfVxuICovXG5Db2xsZWN0aW9uLnByb3RvdHlwZS5IRUFEID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBfLnBhcnRpYWwodGhpcy5IVFRQX01FVEhPRCwgZmFsc2UsICdIRUFEJykuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn07XG5cbi8qKlxuICogU2VuZCBhIFBPU1QgcmVxdWVzdFxuICogQHJldHVybnMgeyp9XG4gKi9cbkNvbGxlY3Rpb24ucHJvdG90eXBlLlBPU1QgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIF8ucGFydGlhbCh0aGlzLkhUVFBfTUVUSE9ELCB0cnVlLCAnUE9TVCcpLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG59O1xuXG4vKipcbiAqIFNlbmQgYSBQVVQgcmVxdWVzdFxuICogQHJldHVybnMgeyp9XG4gKi9cbkNvbGxlY3Rpb24ucHJvdG90eXBlLlBVVCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKHRoaXMuSFRUUF9NRVRIT0QsIHRydWUsICdQVVQnKS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufTtcblxuLyoqXG4gKiBTZW5kIGEgUEFUQ0ggcmVxdWVzdFxuICogQHJldHVybnMgeyp9XG4gKi9cbkNvbGxlY3Rpb24ucHJvdG90eXBlLlBBVENIID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBfLnBhcnRpYWwodGhpcy5IVFRQX01FVEhPRCwgdHJ1ZSwgJ1BBVENIJykuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn07XG5cblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBudW1iZXIgb2Ygb2JqZWN0cyBpbiB0aGlzIGNvbGxlY3Rpb24uXG4gKlxuICogQHBhcmFtIGNhbGxiYWNrXG4gKiBAcmV0dXJucyBQcm9taXNlXG4gKi9cbkNvbGxlY3Rpb24ucHJvdG90eXBlLmNvdW50ID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgdmFyIGRlZmVycmVkID0gcS5kZWZlcigpO1xuICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgdmFyIHRhc2tzID0gXy5tYXAodGhpcy5fbWFwcGluZ3MsIGZ1bmN0aW9uIChtKSB7XG4gICAgICAgIHJldHVybiBfLmJpbmQobS5jb3VudCwgbSk7XG4gICAgfSk7XG4gICAgdXRpbC5wYXJhbGxlbCh0YXNrcywgZnVuY3Rpb24gKGVyciwgbnMpIHtcbiAgICAgICAgdmFyIG47XG4gICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICBuID0gXy5yZWR1Y2UobnMsIGZ1bmN0aW9uIChtLCByKSB7cmV0dXJuIG0gKyByfSwgMCk7XG4gICAgICAgIH1cbiAgICAgICAgY2FsbGJhY2soZXJyLCBuKTtcbiAgICB9KTtcbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn07XG5cbmV4cG9ydHMuQ29sbGVjdGlvbiA9IENvbGxlY3Rpb247XG4iLCJ2YXIgXyA9IHJlcXVpcmUoJy4vdXRpbCcpLl87XG5cbmZ1bmN0aW9uIENvbGxlY3Rpb25SZWdpc3RyeSgpIHtcbiAgICBpZiAoIXRoaXMpIHJldHVybiBuZXcgQ29sbGVjdGlvblJlZ2lzdHJ5KCk7XG4gICAgdGhpcy5jb2xsZWN0aW9uTmFtZXMgPSBbXTtcbn1cblxuQ29sbGVjdGlvblJlZ2lzdHJ5LnByb3RvdHlwZS5yZWdpc3RlciA9IGZ1bmN0aW9uIChjb2xsZWN0aW9uKSB7XG4gICAgdmFyIG5hbWUgPSBjb2xsZWN0aW9uLl9uYW1lO1xuICAgIHRoaXNbbmFtZV0gPSBjb2xsZWN0aW9uO1xuICAgIHRoaXMuY29sbGVjdGlvbk5hbWVzLnB1c2gobmFtZSk7XG59O1xuXG5Db2xsZWN0aW9uUmVnaXN0cnkucHJvdG90eXBlLnJlc2V0ID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBfLmVhY2godGhpcy5jb2xsZWN0aW9uTmFtZXMsIGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICAgIGRlbGV0ZSBzZWxmW25hbWVdO1xuICAgIH0pO1xuICAgIHRoaXMuY29sbGVjdGlvbk5hbWVzID0gW107XG59O1xuXG5leHBvcnRzLkNvbGxlY3Rpb25SZWdpc3RyeSA9IG5ldyBDb2xsZWN0aW9uUmVnaXN0cnkoKTsiLCJmdW5jdGlvbiBSZXN0RXJyb3IobWVzc2FnZSwgY29udGV4dCwgc3NmKSB7XG4gICAgaWYgKCF0aGlzKSB7XG4gICAgICAgIHJldHVybiBuZXcgUmVzdEVycm9yKG1lc3NhZ2UsIGNvbnRleHQpO1xuICAgIH1cblxuICAgIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG5cbiAgICB0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xuICAgIC8vIGNhcHR1cmUgc3RhY2sgdHJhY2VcbiAgICBzc2YgPSBzc2YgfHwgYXJndW1lbnRzLmNhbGxlZTtcbiAgICBpZiAoc3NmICYmIEVycm9yLmNhcHR1cmVTdGFja1RyYWNlKSB7XG4gICAgICAgIEVycm9yLmNhcHR1cmVTdGFja1RyYWNlKHRoaXMsIHNzZik7XG4gICAgfVxufVxuXG5SZXN0RXJyb3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShFcnJvci5wcm90b3R5cGUpO1xuUmVzdEVycm9yLnByb3RvdHlwZS5uYW1lID0gJ1Jlc3RFcnJvcic7XG5SZXN0RXJyb3IucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gUmVzdEVycm9yO1xuXG5leHBvcnRzLlJlc3RFcnJvciA9IFJlc3RFcnJvcjsiLCJ2YXIgcHJveHkgPSByZXF1aXJlKCcuL3Byb3h5JylcbiAgICAsIE5ld09iamVjdFByb3h5ID0gcHJveHkuTmV3T2JqZWN0UHJveHlcbiAgICAsIFN0b3JlID0gcmVxdWlyZSgnLi9zdG9yZScpXG4gICAgLCB1dGlsID0gcmVxdWlyZSgnLi91dGlsJylcbiAgICAsIF8gPSB1dGlsLl9cbiAgICAsIFJlc3RFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5SZXN0RXJyb3JcbiAgICAsIGNvcmVDaGFuZ2VzID0gcmVxdWlyZSgnLi9jaGFuZ2VzJylcbiAgICAsIG5vdGlmaWNhdGlvbkNlbnRyZSA9IHJlcXVpcmUoJy4vbm90aWZpY2F0aW9uQ2VudHJlJylcbiAgICAsIHdyYXBBcnJheUZvckF0dHJpYnV0ZXMgPSBub3RpZmljYXRpb25DZW50cmUud3JhcEFycmF5XG4gICAgLCBTaWVzdGFNb2RlbCA9IHJlcXVpcmUoJy4vb2JqZWN0JykuU2llc3RhTW9kZWxcbiAgICAsIEFycmF5T2JzZXJ2ZXIgPSByZXF1aXJlKCcuLi92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZScpLkFycmF5T2JzZXJ2ZXJcbiAgICAsIENoYW5nZVR5cGUgPSByZXF1aXJlKCcuL2NoYW5nZXMnKS5DaGFuZ2VUeXBlXG4gICAgLCBxID0gcmVxdWlyZSgncScpXG47XG5cblxuZnVuY3Rpb24gTWFueVRvTWFueVByb3h5KG9wdHMpIHtcbiAgICBOZXdPYmplY3RQcm94eS5jYWxsKHRoaXMsIG9wdHMpO1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ2lzRmF1bHQnLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKHNlbGYuX2lkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICFzZWxmLnJlbGF0ZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgaWYgKHYpIHtcbiAgICAgICAgICAgICAgICBzZWxmLl9pZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICBzZWxmLnJlbGF0ZWQgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKCFzZWxmLl9pZCkge1xuICAgICAgICAgICAgICAgICAgICBzZWxmLl9pZCA9IFtdO1xuICAgICAgICAgICAgICAgICAgICBzZWxmLnJlbGF0ZWQgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgd3JhcEFycmF5LmNhbGwoc2VsZiwgc2VsZi5yZWxhdGVkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLl9yZXZlcnNlSXNBcnJheSA9IHRydWU7XG59XG5cblxuZnVuY3Rpb24gY2xlYXJSZXZlcnNlKHJlbW92ZWQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgXy5lYWNoKHJlbW92ZWQsIGZ1bmN0aW9uIChyZW1vdmVkT2JqZWN0KSB7XG4gICAgICAgIHZhciByZXZlcnNlUHJveHkgPSBwcm94eS5nZXRSZXZlcnNlUHJveHlGb3JPYmplY3QuY2FsbChzZWxmLCByZW1vdmVkT2JqZWN0KTtcbiAgICAgICAgdmFyIGlkeCA9IHJldmVyc2VQcm94eS5faWQuaW5kZXhPZihzZWxmLm9iamVjdC5faWQpO1xuICAgICAgICBwcm94eS5tYWtlQ2hhbmdlc1RvUmVsYXRlZFdpdGhvdXRPYnNlcnZhdGlvbnMuY2FsbChyZXZlcnNlUHJveHksIGZ1bmN0aW9uICgpe1xuICAgICAgICAgICAgcHJveHkuc3BsaWNlLmNhbGwocmV2ZXJzZVByb3h5LCBpZHgsIDEpO1xuICAgICAgICB9KTtcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gc2V0UmV2ZXJzZShhZGRlZCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBfLmVhY2goYWRkZWQsIGZ1bmN0aW9uIChhZGRlZE9iamVjdCkge1xuICAgICAgICB2YXIgcmV2ZXJzZVByb3h5ID0gcHJveHkuZ2V0UmV2ZXJzZVByb3h5Rm9yT2JqZWN0LmNhbGwoc2VsZiwgYWRkZWRPYmplY3QpO1xuICAgICAgICBwcm94eS5tYWtlQ2hhbmdlc1RvUmVsYXRlZFdpdGhvdXRPYnNlcnZhdGlvbnMuY2FsbChyZXZlcnNlUHJveHksIGZ1bmN0aW9uICgpe1xuICAgICAgICAgICAgcHJveHkuc3BsaWNlLmNhbGwocmV2ZXJzZVByb3h5LCAwLCAwLCBzZWxmLm9iamVjdCk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xufVxuXG5mdW5jdGlvbiB3cmFwQXJyYXkoYXJyKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHdyYXBBcnJheUZvckF0dHJpYnV0ZXMoYXJyLCB0aGlzLnJldmVyc2VOYW1lLCB0aGlzLm9iamVjdCk7XG4gICAgaWYgKCFhcnIub25lVG9NYW55T2JzZXJ2ZXIpIHtcbiAgICAgICAgYXJyLm9uZVRvTWFueU9ic2VydmVyID0gbmV3IEFycmF5T2JzZXJ2ZXIoYXJyKTtcbiAgICAgICAgdmFyIG9ic2VydmVyRnVuY3Rpb24gPSBmdW5jdGlvbiAoc3BsaWNlcykge1xuICAgICAgICAgICAgc3BsaWNlcy5mb3JFYWNoKGZ1bmN0aW9uIChzcGxpY2UpIHtcbiAgICAgICAgICAgICAgICB2YXIgYWRkZWQgPSBzcGxpY2UuYWRkZWRDb3VudCA/IGFyci5zbGljZShzcGxpY2UuaW5kZXgsIHNwbGljZS5pbmRleCArIHNwbGljZS5hZGRlZENvdW50KSA6IFtdO1xuICAgICAgICAgICAgICAgIHZhciByZW1vdmVkID0gc3BsaWNlLnJlbW92ZWQ7XG4gICAgICAgICAgICAgICAgY2xlYXJSZXZlcnNlLmNhbGwoc2VsZiwgcmVtb3ZlZCk7XG4gICAgICAgICAgICAgICAgc2V0UmV2ZXJzZS5jYWxsKHNlbGYsIGFkZGVkKTtcbiAgICAgICAgICAgICAgICB2YXIgbWFwcGluZyA9IHByb3h5LmdldEZvcndhcmRNYXBwaW5nLmNhbGwoc2VsZik7XG4gICAgICAgICAgICAgICAgY29yZUNoYW5nZXMucmVnaXN0ZXJDaGFuZ2Uoe1xuICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBtYXBwaW5nLmNvbGxlY3Rpb24sXG4gICAgICAgICAgICAgICAgICAgIG1hcHBpbmc6IG1hcHBpbmcsXG4gICAgICAgICAgICAgICAgICAgIF9pZDogc2VsZi5vYmplY3QuX2lkLFxuICAgICAgICAgICAgICAgICAgICBmaWVsZDogcHJveHkuZ2V0Rm9yd2FyZE5hbWUuY2FsbChzZWxmKSxcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlZDogcmVtb3ZlZCxcbiAgICAgICAgICAgICAgICAgICAgYWRkZWQ6IGFkZGVkLFxuICAgICAgICAgICAgICAgICAgICByZW1vdmVkSWQ6IF8ucGx1Y2socmVtb3ZlZCwgJ19pZCcpLFxuICAgICAgICAgICAgICAgICAgICBhZGRlZElkOiBfLnBsdWNrKGFkZGVkLCAnX2lkJyksXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IENoYW5nZVR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgICAgICAgICBpbmRleDogc3BsaWNlLmluZGV4XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICAgICAgYXJyLm9uZVRvTWFueU9ic2VydmVyLm9wZW4ob2JzZXJ2ZXJGdW5jdGlvbik7XG4gICAgfVxufVxuXG5NYW55VG9NYW55UHJveHkucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShOZXdPYmplY3RQcm94eS5wcm90b3R5cGUpO1xuXG5NYW55VG9NYW55UHJveHkucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIHZhciBkZWZlcnJlZCA9IHEuZGVmZXIoKTtcbiAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAodGhpcy5pc0ZhdWx0KSB7XG4gICAgICAgIFN0b3JlLmdldCh7X2lkOiB0aGlzLl9pZH0sIGZ1bmN0aW9uIChlcnIsIHN0b3JlZCkge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHNlbGYucmVsYXRlZCA9IHN0b3JlZDtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKG51bGwsIHN0b3JlZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKG51bGwsIHRoaXMucmVsYXRlZCk7XG4gICAgfVxuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufTtcblxuZnVuY3Rpb24gdmFsaWRhdGUob2JqKSB7XG4gICAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopICE9ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICAgICAgICAgIHJldHVybiAnQ2Fubm90IGFzc2lnbiBzY2FsYXIgdG8gbWFueSB0byBtYW55JztcbiAgICAgICAgfVxuICAgIHJldHVybiBudWxsO1xufVxuXG5NYW55VG9NYW55UHJveHkucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICBwcm94eS5jaGVja0luc3RhbGxlZC5jYWxsKHRoaXMpO1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAob2JqKSB7XG4gICAgICAgIHZhciBlcnJvck1lc3NhZ2U7XG4gICAgICAgIGlmIChlcnJvck1lc3NhZ2UgPSB2YWxpZGF0ZS5jYWxsKHRoaXMsIG9iaikpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IoZXJyb3JNZXNzYWdlKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHByb3h5LmNsZWFyUmV2ZXJzZVJlbGF0ZWQuY2FsbCh0aGlzKTtcbiAgICAgICAgICAgIHByb3h5LnNldC5jYWxsKHNlbGYsIG9iaik7XG4gICAgICAgICAgICB3cmFwQXJyYXkuY2FsbChzZWxmLCBvYmopO1xuICAgICAgICAgICAgcHJveHkuc2V0UmV2ZXJzZS5jYWxsKHNlbGYsIG9iaik7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHByb3h5LmNsZWFyUmV2ZXJzZVJlbGF0ZWQuY2FsbCh0aGlzKTtcbiAgICAgICAgcHJveHkuc2V0LmNhbGwoc2VsZiwgb2JqKTtcbiAgICB9XG59O1xuXG5NYW55VG9NYW55UHJveHkucHJvdG90eXBlLmluc3RhbGwgPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgTmV3T2JqZWN0UHJveHkucHJvdG90eXBlLmluc3RhbGwuY2FsbCh0aGlzLCBvYmopO1xuICAgIG9ialsgKCdzcGxpY2UnICsgdXRpbC5jYXBpdGFsaXNlRmlyc3RMZXR0ZXIodGhpcy5yZXZlcnNlTmFtZSkpXSA9IF8uYmluZChwcm94eS5zcGxpY2UsIHRoaXMpO1xufTtcblxuZXhwb3J0cy5NYW55VG9NYW55UHJveHkgPSBNYW55VG9NYW55UHJveHk7IiwidmFyIGxvZyA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vcGVyYXRpb25zLmpzL3NyYy9sb2cnKTtcbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ01hcHBpbmcnKTtcbkxvZ2dlci5zZXRMZXZlbChsb2cuTGV2ZWwuZGVidWcpO1xuXG52YXIgZGVmaW5lU3ViUHJvcGVydHkgPSByZXF1aXJlKCcuL21pc2MnKS5kZWZpbmVTdWJQcm9wZXJ0eTtcbnZhciBDb2xsZWN0aW9uUmVnaXN0cnkgPSByZXF1aXJlKCcuL2NvbGxlY3Rpb25SZWdpc3RyeScpLkNvbGxlY3Rpb25SZWdpc3RyeTtcbnZhciBSZXN0RXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuUmVzdEVycm9yO1xudmFyIHJlbGF0aW9uc2hpcCA9IHJlcXVpcmUoJy4vcmVsYXRpb25zaGlwJyk7XG52YXIgUmVsYXRpb25zaGlwVHlwZSA9IHJlbGF0aW9uc2hpcC5SZWxhdGlvbnNoaXBUeXBlO1xudmFyIFF1ZXJ5ID0gcmVxdWlyZSgnLi9xdWVyeScpLlF1ZXJ5O1xudmFyIE9wZXJhdGlvbiA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vcGVyYXRpb25zLmpzL3NyYy9vcGVyYXRpb24nKS5PcGVyYXRpb247XG52YXIgQnVsa01hcHBpbmdPcGVyYXRpb24gPSByZXF1aXJlKCcuL21hcHBpbmdPcGVyYXRpb24nKS5CdWxrTWFwcGluZ09wZXJhdGlvbjtcbnZhciBTaWVzdGFNb2RlbCA9IHJlcXVpcmUoJy4vb2JqZWN0JykuU2llc3RhTW9kZWw7XG52YXIgZ3VpZCA9IHJlcXVpcmUoJy4vbWlzYycpLmd1aWQ7XG52YXIgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyk7XG52YXIgc3RvcmUgPSByZXF1aXJlKCcuL3N0b3JlJyk7XG52YXIgZXh0ZW5kID0gcmVxdWlyZSgnZXh0ZW5kJyk7XG5cblxudmFyIGNvcmVDaGFuZ2VzID0gcmVxdWlyZSgnLi9jaGFuZ2VzJyk7XG52YXIgQ2hhbmdlVHlwZSA9IGNvcmVDaGFuZ2VzLkNoYW5nZVR5cGU7XG52YXIgd3JhcEFycmF5ID0gcmVxdWlyZSgnLi9ub3RpZmljYXRpb25DZW50cmUnKS53cmFwQXJyYXk7XG5cbnZhciBPbmVUb01hbnlQcm94eSA9IHJlcXVpcmUoJy4vb25lVG9NYW55UHJveHknKS5PbmVUb01hbnlQcm94eTtcbnZhciBPbmVUb09uZVByb3h5ID0gcmVxdWlyZSgnLi9vbmVUb09uZVByb3h5JykuT25lVG9PbmVQcm94eTtcbnZhciBNYW55VG9NYW55UHJveHkgPSByZXF1aXJlKCcuL21hbnlUb01hbnlQcm94eScpLk1hbnlUb01hbnlQcm94eTtcblxudmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcbnZhciBfID0gdXRpbC5fO1xudmFyIHEgPSByZXF1aXJlKCdxJyk7XG5cblxuZnVuY3Rpb24gTWFwcGluZyhvcHRzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHRoaXMuX29wdHMgPSBvcHRzO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdfZmllbGRzJywge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBmaWVsZHMgPSBbXTtcbiAgICAgICAgICAgIGlmIChzZWxmLl9vcHRzLmlkKSB7XG4gICAgICAgICAgICAgICAgZmllbGRzLnB1c2goc2VsZi5fb3B0cy5pZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc2VsZi5fb3B0cy5hdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICAgICAgXy5lYWNoKHNlbGYuX29wdHMuYXR0cmlidXRlcywgZnVuY3Rpb24gKHgpIHtmaWVsZHMucHVzaCh4KX0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGZpZWxkcztcbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSk7XG5cbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICd0eXBlJywgc2VsZi5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnaWQnLCBzZWxmLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdjb2xsZWN0aW9uJywgc2VsZi5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnYXR0cmlidXRlcycsIHNlbGYuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ3JlbGF0aW9uc2hpcHMnLCBzZWxmLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdpbmRleGVzJywgc2VsZi5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnc3ViY2xhc3MnLCBzZWxmLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdzaW5nbGV0b24nLCBzZWxmLl9vcHRzKTtcblxuICAgIGlmICghdGhpcy5yZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgIHRoaXMucmVsYXRpb25zaGlwcyA9IFtdO1xuICAgIH1cblxuICAgIGlmICghdGhpcy5pbmRleGVzKSB7XG4gICAgICAgIHRoaXMuaW5kZXhlcyA9IFtdO1xuICAgIH1cblxuICAgIHRoaXMuX3ZhbGlkYXRlU3ViY2xhc3MoKTtcblxuICAgIHRoaXMuX2luc3RhbGxlZCA9IGZhbHNlO1xuICAgIHRoaXMuX3JlbGF0aW9uc2hpcHNJbnN0YWxsZWQgPSBmYWxzZTtcbiAgICB0aGlzLl9yZXZlcnNlUmVsYXRpb25zaGlwc0luc3RhbGxlZCA9IGZhbHNlO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdpbnN0YWxsZWQnLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHNlbGYuX2luc3RhbGxlZCAmJiBzZWxmLl9yZWxhdGlvbnNoaXBzSW5zdGFsbGVkICYmIHNlbGYuX3JldmVyc2VSZWxhdGlvbnNoaXBzSW5zdGFsbGVkO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcblxufVxuXG4vKipcbiAqIEVuc3VyZSB0aGF0IGFueSBzdWJjbGFzc2VzIHBhc3NlZCB0byB0aGUgbWFwcGluZyBhcmUgdmFsaWQgYW5kIHdvcmtpbmcgY29ycmVjdGx5LlxuICogQHByaXZhdGVcbiAqL1xuTWFwcGluZy5wcm90b3R5cGUuX3ZhbGlkYXRlU3ViY2xhc3MgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMuc3ViY2xhc3MgJiYgdGhpcy5zdWJjbGFzcyAhPT0gU2llc3RhTW9kZWwpIHtcbiAgICAgICAgdmFyIG9iaiA9IG5ldyB0aGlzLnN1YmNsYXNzKHRoaXMpO1xuICAgICAgICBpZiAoIW9iai5tYXBwaW5nKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgUmVzdEVycm9yKCdTdWJjbGFzcyBmb3IgbWFwcGluZyBcIicgKyB0aGlzLnR5cGUgKyAnXCIgaGFzIG5vdCBiZWVuIGNvbmZpZ3VyZWQgY29ycmVjdGx5LiAnICtcbiAgICAgICAgICAgICAgICAnRGlkIHlvdSBjYWxsIHN1cGVyPycpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLnN1YmNsYXNzLnByb3RvdHlwZSA9PSBTaWVzdGFNb2RlbC5wcm90b3R5cGUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IoJ1N1YmNsYXNzIGZvciBtYXBwaW5nIFwiJyArIHRoaXMudHlwZSArICdcIiBoYXMgbm90IGJlZW4gY29uZmlndXJlZCBjb3JyZWN0bHkuICcgK1xuICAgICAgICAgICAgICAgICdZb3Ugc2hvdWxkIHVzZSBPYmplY3QuY3JlYXRlIG9uIFNpZXN0YU1vZGVsIHByb3RvdHlwZS4nKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cblxuTWFwcGluZy5wcm90b3R5cGUuaW5zdGFsbFJlbGF0aW9uc2hpcHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKCF0aGlzLl9yZWxhdGlvbnNoaXBzSW5zdGFsbGVkKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgc2VsZi5fcmVsYXRpb25zaGlwcyA9IFtdO1xuICAgICAgICBpZiAoc2VsZi5fb3B0cy5yZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBuYW1lIGluIHNlbGYuX29wdHMucmVsYXRpb25zaGlwcykge1xuICAgICAgICAgICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICBMb2dnZXIuZGVidWcoc2VsZi50eXBlICsgJzogY29uZmlndXJpbmcgcmVsYXRpb25zaGlwICcgKyBuYW1lKTtcbiAgICAgICAgICAgICAgICBpZiAoc2VsZi5fb3B0cy5yZWxhdGlvbnNoaXBzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciByZWxhdGlvbnNoaXAgPSBzZWxmLl9vcHRzLnJlbGF0aW9uc2hpcHNbbmFtZV07XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWxhdGlvbnNoaXAudHlwZSA9PSBSZWxhdGlvbnNoaXBUeXBlLk9uZVRvTWFueSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwLnR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5PbmVUb09uZSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwLnR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5NYW55VG9NYW55KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbWFwcGluZ05hbWUgPSByZWxhdGlvbnNoaXAubWFwcGluZztcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygncmV2ZXJzZU1hcHBpbmdOYW1lJywgbWFwcGluZ05hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFzZWxmLmNvbGxlY3Rpb24pIHRocm93IG5ldyBSZXN0RXJyb3IoJ01hcHBpbmcgbXVzdCBoYXZlIGNvbGxlY3Rpb24nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjb2xsZWN0aW9uID0gQ29sbGVjdGlvblJlZ2lzdHJ5W3NlbGYuY29sbGVjdGlvbl07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUmVzdEVycm9yKCdDb2xsZWN0aW9uICcgKyBzZWxmLmNvbGxlY3Rpb24gKyAnIG5vdCByZWdpc3RlcmVkJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcmV2ZXJzZU1hcHBpbmcgPSBjb2xsZWN0aW9uW21hcHBpbmdOYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghcmV2ZXJzZU1hcHBpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgYXJyID0gbWFwcGluZ05hbWUuc3BsaXQoJy4nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoYXJyLmxlbmd0aCA9PSAyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IGFyclswXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWFwcGluZ05hbWUgPSBhcnJbMV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBvdGhlckNvbGxlY3Rpb24gPSBDb2xsZWN0aW9uUmVnaXN0cnlbY29sbGVjdGlvbk5hbWVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIW90aGVyQ29sbGVjdGlvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFJlc3RFcnJvcignQ29sbGVjdGlvbiB3aXRoIG5hbWUgXCInICsgY29sbGVjdGlvbk5hbWUgKyAnXCIgZG9lcyBub3QgZXhpc3QuJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV2ZXJzZU1hcHBpbmcgPSBvdGhlckNvbGxlY3Rpb25bbWFwcGluZ05hbWVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygncmV2ZXJzZU1hcHBpbmcnLCByZXZlcnNlTWFwcGluZyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocmV2ZXJzZU1hcHBpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXAucmV2ZXJzZU1hcHBpbmcgPSByZXZlcnNlTWFwcGluZztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXAuZm9yd2FyZE1hcHBpbmcgPSB0aGlzO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcC5mb3J3YXJkTmFtZSA9IG5hbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwLnJldmVyc2VOYW1lID0gcmVsYXRpb25zaGlwLnJldmVyc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUmVzdEVycm9yKCdNYXBwaW5nIHdpdGggbmFtZSBcIicgKyBtYXBwaW5nTmFtZS50b1N0cmluZygpICsgJ1wiIGRvZXMgbm90IGV4aXN0Jyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUmVzdEVycm9yKCdSZWxhdGlvbnNoaXAgdHlwZSAnICsgcmVsYXRpb25zaGlwLnR5cGUgKyAnIGRvZXMgbm90IGV4aXN0Jyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fcmVsYXRpb25zaGlwc0luc3RhbGxlZCA9IHRydWU7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgUmVzdEVycm9yKCdSZWxhdGlvbnNoaXBzIGZvciBcIicgKyB0aGlzLnR5cGUgKyAnXCIgaGF2ZSBhbHJlYWR5IGJlZW4gaW5zdGFsbGVkJyk7XG4gICAgfVxufTtcblxuTWFwcGluZy5wcm90b3R5cGUuaW5zdGFsbFJldmVyc2VSZWxhdGlvbnNoaXBzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgXG4gICAgaWYgKCF0aGlzLl9yZXZlcnNlUmVsYXRpb25zaGlwc0luc3RhbGxlZCkge1xuICAgICAgICBmb3IgKHZhciBmb3J3YXJkTmFtZSBpbiB0aGlzLnJlbGF0aW9uc2hpcHMpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnJlbGF0aW9uc2hpcHMuaGFzT3duUHJvcGVydHkoZm9yd2FyZE5hbWUpKSB7XG4gICAgICAgICAgICAgICAgdmFyIHJlbGF0aW9uc2hpcCA9IHRoaXMucmVsYXRpb25zaGlwc1tmb3J3YXJkTmFtZV07XG4gICAgICAgICAgICAgICAgdmFyIHJldmVyc2VNYXBwaW5nID0gcmVsYXRpb25zaGlwLnJldmVyc2VNYXBwaW5nO1xuICAgICAgICAgICAgICAgIHZhciByZXZlcnNlTmFtZSA9IHJlbGF0aW9uc2hpcC5yZXZlcnNlTmFtZTtcbiAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKHNlbGYudHlwZSArICc6IGNvbmZpZ3VyaW5nICByZXZlcnNlIHJlbGF0aW9uc2hpcCAnICsgbmFtZSk7XG4gICAgICAgICAgICAgICAgcmV2ZXJzZU1hcHBpbmcucmVsYXRpb25zaGlwc1tyZXZlcnNlTmFtZV0gPSByZWxhdGlvbnNoaXA7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fcmV2ZXJzZVJlbGF0aW9uc2hpcHNJbnN0YWxsZWQgPSB0cnVlO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IFJlc3RFcnJvcignUmV2ZXJzZSByZWxhdGlvbnNoaXBzIGZvciBcIicgKyB0aGlzLnR5cGUgKyAnXCIgaGF2ZSBhbHJlYWR5IGJlZW4gaW5zdGFsbGVkLicpO1xuICAgIH1cbn07XG5cbk1hcHBpbmcucHJvdG90eXBlLnF1ZXJ5ID0gZnVuY3Rpb24gKHF1ZXJ5LCBjYWxsYmFjaykge1xuICAgIHZhciBkZWZlcnJlZCA9IHEuZGVmZXIoKTtcbiAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgIHZhciBfcXVlcnkgPSBuZXcgUXVlcnkodGhpcywgcXVlcnkpO1xuICAgIF9xdWVyeS5leGVjdXRlKGNhbGxiYWNrKTtcbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn07XG5cbk1hcHBpbmcucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChpZE9yQ2FsbGJhY2ssIGNhbGxiYWNrKSB7XG4gICAgdmFyIGRlZmVycmVkID0gcS5kZWZlcigpO1xuICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgZnVuY3Rpb24gZmluaXNoKGVyciwgcmVzKSB7XG4gICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXJyLCByZXMpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnNpbmdsZXRvbikge1xuICAgICAgICBpZiAodHlwZW9mIGlkT3JDYWxsYmFjayA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWxsYmFjayA9IGlkT3JDYWxsYmFjaztcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmFsbChmdW5jdGlvbiAoZXJyLCBvYmpzKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSBmaW5pc2goZXJyKTtcbiAgICAgICAgICAgIGlmIChvYmpzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUmVzdEVycm9yKCdTb21laG93IG1vcmUgdGhhbiBvbmUgb2JqZWN0IGhhcyBiZWVuIGNyZWF0ZWQgZm9yIGEgc2luZ2xldG9uIG1hcHBpbmchICcgK1xuICAgICAgICAgICAgICAgICAgICAnVGhpcyBpcyBhIHNlcmlvdXMgZXJyb3IsIHBsZWFzZSBmaWxlIGEgYnVnIHJlcG9ydC4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKG9ianMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgZmluaXNoKG51bGwsIG9ianNbMF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgZmluaXNoKG51bGwsIG9ianNbMF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHZhciBvcHRzID0ge307XG4gICAgICAgIG9wdHNbdGhpcy5pZF0gPSBpZE9yQ2FsbGJhY2s7XG4gICAgICAgIG9wdHMubWFwcGluZyA9IHRoaXM7XG4gICAgICAgIHZhciBvYmogPSBjYWNoZS5nZXQob3B0cyk7XG4gICAgICAgIGlmIChvYmopIHtcbiAgICAgICAgICAgIGZpbmlzaChudWxsLCBvYmopO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgZGVsZXRlIG9wdHMubWFwcGluZztcbiAgICAgICAgICAgIHZhciBxdWVyeSA9IG5ldyBRdWVyeSh0aGlzLCBvcHRzKTtcbiAgICAgICAgICAgIHF1ZXJ5LmV4ZWN1dGUoZnVuY3Rpb24gKGVyciwgcm93cykge1xuICAgICAgICAgICAgICAgIHZhciBvYmogPSBudWxsO1xuICAgICAgICAgICAgICAgIGlmICghZXJyICYmIHJvd3MubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyb3dzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVyciA9ICdNb3JlIHRoYW4gb25lIG9iamVjdCB3aXRoIGlkPScgKyBpZE9yQ2FsbGJhY2sudG9TdHJpbmcoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9iaiA9IHJvd3NbMF07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZmluaXNoKGVyciwgb2JqKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICB9XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59O1xuXG5NYXBwaW5nLnByb3RvdHlwZS5hbGwgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICB2YXIgZGVmZXJyZWQgPSBxLmRlZmVyKCk7XG4gICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICB2YXIgcXVlcnkgPSBuZXcgUXVlcnkodGhpcywge30pO1xuICAgIHF1ZXJ5LmV4ZWN1dGUoY2FsbGJhY2spO1xuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufTtcblxuTWFwcGluZy5wcm90b3R5cGUuaW5zdGFsbCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIGlmIChMb2dnZXIuaW5mby5pc0VuYWJsZWQpIExvZ2dlci5pbmZvKCdJbnN0YWxsaW5nIG1hcHBpbmcgJyArIHRoaXMudHlwZSk7XG4gICAgdmFyIGRlZmVycmVkID0gcS5kZWZlcigpO1xuICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgaWYgKCF0aGlzLl9pbnN0YWxsZWQpIHtcbiAgICAgICAgdmFyIGVycm9ycyA9IHRoaXMuX3ZhbGlkYXRlKCk7XG4gICAgICAgIHRoaXMuX2luc3RhbGxlZCA9IHRydWU7XG4gICAgICAgIGlmIChMb2dnZXIuaW5mby5pc0VuYWJsZWQpIHtcbiAgICAgICAgICAgIGlmIChlcnJvcnMubGVuZ3RoKSBMb2dnZXIuZXJyb3IoJ0Vycm9ycyBpbnN0YWxsaW5nIG1hcHBpbmcgJyArIHRoaXMudHlwZSArICc6ICcgKyBlcnJvcnMpO1xuICAgICAgICAgICAgZWxzZSBMb2dnZXIuaW5mbygnSW5zdGFsbGVkIG1hcHBpbmcgJyArIHRoaXMudHlwZSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnJvcnMubGVuZ3RoID8gZXJyb3JzIDogbnVsbCk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgUmVzdEVycm9yKCdNYXBwaW5nIFwiJyArIHRoaXMudHlwZSArICdcIiBoYXMgYWxyZWFkeSBiZWVuIGluc3RhbGxlZCcpO1xuICAgIH1cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn07XG5cbk1hcHBpbmcucHJvdG90eXBlLl92YWxpZGF0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgZXJyb3JzID0gW107XG4gICAgaWYgKCF0aGlzLnR5cGUpIHtcbiAgICAgICAgZXJyb3JzLnB1c2goJ011c3Qgc3BlY2lmeSBhIHR5cGUnKTtcbiAgICB9XG4gICAgaWYgKCF0aGlzLmNvbGxlY3Rpb24pIHtcbiAgICAgICAgZXJyb3JzLnB1c2goJ0EgbWFwcGluZyBtdXN0IGJlbG9uZyB0byBhbiBjb2xsZWN0aW9uJyk7XG4gICAgfVxuICAgIHJldHVybiBlcnJvcnM7XG59O1xuXG5cbi8qKlxuICogTWFwIGRhdGEgaW50byBTaWVzdGEuXG4gKlxuICogQHBhcmFtIGRhdGEgUmF3IGRhdGEgcmVjZWl2ZWQgcmVtb3RlbHkgb3Igb3RoZXJ3aXNlXG4gKiBAcGFyYW0gY2FsbGJhY2sgQ2FsbGVkIG9uY2UgcG91Y2ggcGVyc2lzdGVuY2UgcmV0dXJucy5cbiAqIEBwYXJhbSBvdmVycmlkZSBGb3JjZSBtYXBwaW5nIHRvIHRoaXMgb2JqZWN0XG4gKi9cbk1hcHBpbmcucHJvdG90eXBlLm1hcCA9IGZ1bmN0aW9uIChkYXRhLCBjYWxsYmFjaywgb3ZlcnJpZGUpIHtcbiAgICB2YXIgZGVmZXJyZWQgPSBxLmRlZmVyKCk7XG4gICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICBpZiAodGhpcy5pbnN0YWxsZWQpIHtcbiAgICAgICAgaWYgKHV0aWwuaXNBcnJheShkYXRhKSkge1xuICAgICAgICAgICAgdGhpcy5fbWFwQnVsayhkYXRhLCBjYWxsYmFjaywgb3ZlcnJpZGUpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fbWFwQnVsayhbZGF0YV0sIGZ1bmN0aW9uIChlcnIsIG9iamVjdHMpIHtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG9iajtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9iamVjdHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvYmplY3RzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iaiA9IG9iamVjdHNbMF07XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyID8gZXJyWzBdIDogbnVsbCwgb2JqKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LCBvdmVycmlkZSA/IFtvdmVycmlkZV0gOiB1bmRlZmluZWQpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgUmVzdEVycm9yKCdNYXBwaW5nIG11c3QgYmUgZnVsbHkgaW5zdGFsbGVkIGJlZm9yZSBjcmVhdGluZyBhbnkgbW9kZWxzJyk7XG4gICAgfVxuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufTtcblxuTWFwcGluZy5wcm90b3R5cGUuX21hcEJ1bGsgPSBmdW5jdGlvbiAoZGF0YSwgY2FsbGJhY2ssIG92ZXJyaWRlKSB7XG4gICAgdmFyIGRlZmVycmVkID0gcS5kZWZlcigpO1xuICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgdmFyIG9wdHMgPSB7bWFwcGluZzogdGhpcywgZGF0YTogZGF0YX07XG4gICAgaWYgKG92ZXJyaWRlKSBvcHRzLm9iamVjdHMgPSBvdmVycmlkZTtcbiAgICB2YXIgb3AgPSBuZXcgQnVsa01hcHBpbmdPcGVyYXRpb24ob3B0cyk7XG4gICAgb3Aub25Db21wbGV0aW9uKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ29wISEhISEnLCBvcCk7XG4gICAgICAgIHZhciBlcnIgPSBvcC5lcnJvcjtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdmFyIG9iamVjdHMgPSBvcC5yZXN1bHQ7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCBvYmplY3RzKTtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIG9wLnN0YXJ0KCk7XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59O1xuXG5mdW5jdGlvbiBfY291bnRDYWNoZSgpIHtcbiAgICB2YXIgY29sbENhY2hlID0gY2FjaGUuX2xvY2FsQ2FjaGVCeVR5cGVbdGhpcy5jb2xsZWN0aW9uXSB8fCB7fTtcbiAgICB2YXIgbWFwcGluZ0NhY2hlID0gY29sbENhY2hlW3RoaXMudHlwZV0gfHwge307XG4gICAgcmV0dXJuIF8ucmVkdWNlKE9iamVjdC5rZXlzKG1hcHBpbmdDYWNoZSksIGZ1bmN0aW9uIChtLCBfaWQpIHtcbiAgICAgICAgbVtfaWRdID0ge307XG4gICAgICAgIHJldHVybiBtO1xuICAgIH0sIHt9KTtcbn1cblxuTWFwcGluZy5wcm90b3R5cGUuY291bnQgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICB2YXIgZGVmZXJyZWQgPSBxLmRlZmVyKCk7XG4gICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICB2YXIgaGFzaCA9IF9jb3VudENhY2hlLmNhbGwodGhpcyk7XG4gICAgaWYgKHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQpIHtcbiAgICAgICAgdmFyIHBvdWNoID0gc2llc3RhLmV4dC5zdG9yYWdlLlBvdWNoLmdldFBvdWNoKCk7XG4gICAgICAgIHZhciBpbmRleE5hbWUgPSAobmV3IHNpZXN0YS5leHQuc3RvcmFnZS5JbmRleCh0aGlzLmNvbGxlY3Rpb24sIHRoaXMudHlwZSkpLl9nZXROYW1lKCkgKyAnXyc7XG4gICAgICAgIHBvdWNoLnF1ZXJ5KGluZGV4TmFtZSwge2luY2x1ZGVfZG9jczogZmFsc2V9LCBmdW5jdGlvbiAoZXJyLCByZXNwKSB7XG4gICAgICAgICAgICB2YXIgbjtcbiAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgXy5lYWNoKF8ucGx1Y2socmVzcC5yb3dzLCAnaWQnKSwgZnVuY3Rpb24gKGlkKSB7XG4gICAgICAgICAgICAgICAgICAgIGhhc2hbaWRdID0ge307XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgbiA9IE9iamVjdC5rZXlzKGhhc2gpLmxlbmd0aDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgbik7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgT2JqZWN0LmtleXMoaGFzaCkubGVuZ3RoKVxuICAgIH1cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn07XG5cbi8qKlxuICogQ29udmVydCByYXcgZGF0YSBpbnRvIGEgU2llc3RhTW9kZWxcbiAqIEByZXR1cm5zIHtTaWVzdGFNb2RlbH1cbiAqIEBwcml2YXRlXG4gKi9cbk1hcHBpbmcucHJvdG90eXBlLl9uZXcgPSBmdW5jdGlvbiAoZGF0YSkge1xuICAgIGlmICh0aGlzLmluc3RhbGxlZCkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHZhciBfaWQ7XG4gICAgICAgIGlmIChkYXRhKSB7XG4gICAgICAgICAgICBfaWQgPSBkYXRhLl9pZCA/IGRhdGEuX2lkIDogZ3VpZCgpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgX2lkID0gZ3VpZCgpO1xuICAgICAgICB9XG4gICAgICAgIHZhciBuZXdNb2RlbDtcbiAgICAgICAgaWYgKHRoaXMuc3ViY2xhc3MpIHtcbiAgICAgICAgICAgIG5ld01vZGVsID0gbmV3IHRoaXMuc3ViY2xhc3ModGhpcyk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBuZXdNb2RlbCA9IG5ldyBTaWVzdGFNb2RlbCh0aGlzKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoTG9nZ2VyLmluZm8uaXNFbmFibGVkKVxuICAgICAgICAgICAgTG9nZ2VyLmluZm8oJ05ldyBvYmplY3QgY3JlYXRlZCBfaWQ9XCInICsgX2lkLnRvU3RyaW5nKCkgKyAnXCIsIHR5cGU9JyArIHRoaXMudHlwZSwgZGF0YSk7XG4gICAgICAgIG5ld01vZGVsLl9pZCA9IF9pZDtcbiAgICAgICAgLy8gUGxhY2UgYXR0cmlidXRlcyBvbiB0aGUgb2JqZWN0LlxuICAgICAgICBuZXdNb2RlbC5fX3ZhbHVlcyA9IGRhdGEgfHwge307XG4gICAgICAgIHZhciBmaWVsZHMgPSB0aGlzLl9maWVsZHM7XG4gICAgICAgIHZhciBpZHggPSBmaWVsZHMuaW5kZXhPZih0aGlzLmlkKTtcbiAgICAgICAgaWYgKGlkeCA+IC0xKSB7XG4gICAgICAgICAgICBmaWVsZHMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgIH1cbiAgICAgICAgXy5lYWNoKGZpZWxkcywgZnVuY3Rpb24gKGZpZWxkKSB7XG4gICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobmV3TW9kZWwsIGZpZWxkLCB7XG4gICAgICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXdNb2RlbC5fX3ZhbHVlc1tmaWVsZF0gfHwgbnVsbDtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHNldDogZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG9sZCA9IG5ld01vZGVsLl9fdmFsdWVzW2ZpZWxkXTtcbiAgICAgICAgICAgICAgICAgICAgbmV3TW9kZWwuX192YWx1ZXNbZmllbGRdID0gdjtcbiAgICAgICAgICAgICAgICAgICAgY29yZUNoYW5nZXMucmVnaXN0ZXJDaGFuZ2Uoe1xuICAgICAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbjogc2VsZi5jb2xsZWN0aW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWFwcGluZzogc2VsZi50eXBlLFxuICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiBuZXdNb2RlbC5faWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBuZXc6IHYsXG4gICAgICAgICAgICAgICAgICAgICAgICBvbGQ6IG9sZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IENoYW5nZVR5cGUuU2V0LFxuICAgICAgICAgICAgICAgICAgICAgICAgZmllbGQ6IGZpZWxkXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KHYpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB3cmFwQXJyYXkodiwgZmllbGQsIG5ld01vZGVsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobmV3TW9kZWwsIHRoaXMuaWQsIHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXdNb2RlbC5fX3ZhbHVlc1tzZWxmLmlkXSB8fCBudWxsO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNldDogZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgICAgICAgICB2YXIgb2xkID0gbmV3TW9kZWxbc2VsZi5pZF07XG4gICAgICAgICAgICAgICAgbmV3TW9kZWwuX192YWx1ZXNbc2VsZi5pZF0gPSB2O1xuICAgICAgICAgICAgICAgIGNvcmVDaGFuZ2VzLnJlZ2lzdGVyQ2hhbmdlKHtcbiAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbjogc2VsZi5jb2xsZWN0aW9uLFxuICAgICAgICAgICAgICAgICAgICBtYXBwaW5nOiBzZWxmLnR5cGUsXG4gICAgICAgICAgICAgICAgICAgIF9pZDogbmV3TW9kZWwuX2lkLFxuICAgICAgICAgICAgICAgICAgICBuZXc6IHYsXG4gICAgICAgICAgICAgICAgICAgIG9sZDogb2xkLFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiBDaGFuZ2VUeXBlLlNldCxcbiAgICAgICAgICAgICAgICAgICAgZmllbGQ6IHNlbGYuaWRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBjYWNoZS5yZW1vdGVJbnNlcnQobmV3TW9kZWwsIHYsIG9sZCk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgICB9KTtcblxuXG4gICAgICAgIGZvciAodmFyIG5hbWUgaW4gdGhpcy5yZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgICAgICB2YXIgcHJveHk7XG4gICAgICAgICAgICBpZiAodGhpcy5yZWxhdGlvbnNoaXBzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgICAgICAgICAgdmFyIHJlbGF0aW9uc2hpcCA9IHRoaXMucmVsYXRpb25zaGlwc1tuYW1lXTtcbiAgICAgICAgICAgICAgICBpZiAocmVsYXRpb25zaGlwLnR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5PbmVUb01hbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcHJveHkgPSBuZXcgT25lVG9NYW55UHJveHkocmVsYXRpb25zaGlwKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAocmVsYXRpb25zaGlwLnR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5PbmVUb09uZSkge1xuICAgICAgICAgICAgICAgICAgICBwcm94eSA9IG5ldyBPbmVUb09uZVByb3h5KHJlbGF0aW9uc2hpcCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHJlbGF0aW9uc2hpcC50eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuTWFueVRvTWFueSkge1xuICAgICAgICAgICAgICAgICAgICBwcm94eSA9IG5ldyBNYW55VG9NYW55UHJveHkocmVsYXRpb25zaGlwKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IoJ05vIHN1Y2ggcmVsYXRpb25zaGlwIHR5cGU6ICcgKyByZWxhdGlvbnNoaXAudHlwZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcHJveHkuaW5zdGFsbChuZXdNb2RlbCk7XG4gICAgICAgICAgICBwcm94eS5pc0ZhdWx0ID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgY2FjaGUuaW5zZXJ0KG5ld01vZGVsKTtcbiAgICAgICAgcmV0dXJuIG5ld01vZGVsO1xuICAgIH1cblxuICAgIGVsc2Uge1xuICAgICAgICB1dGlsLnByaW50U3RhY2tUcmFjZSgpO1xuICAgICAgICB0aHJvdyBuZXcgUmVzdEVycm9yKCdNYXBwaW5nIG11c3QgYmUgZnVsbHkgaW5zdGFsbGVkIGJlZm9yZSBjcmVhdGluZyBhbnkgbW9kZWxzJyk7XG4gICAgfVxuXG59O1xuXG5NYXBwaW5nLnByb3RvdHlwZS5fZHVtcCA9IGZ1bmN0aW9uIChhc0pTT04pIHtcbiAgICB2YXIgZHVtcGVkID0ge307XG4gICAgZHVtcGVkLm5hbWUgPSB0aGlzLnR5cGU7XG4gICAgZHVtcGVkLmF0dHJpYnV0ZXMgPSB0aGlzLmF0dHJpYnV0ZXM7XG4gICAgZHVtcGVkLmlkID0gdGhpcy5pZDtcbiAgICBkdW1wZWQuY29sbGVjdGlvbiA9IHRoaXMuY29sbGVjdGlvbjtcbiAgICBkdW1wZWQucmVsYXRpb25zaGlwcyA9IF8ubWFwKHRoaXMucmVsYXRpb25zaGlwcywgZnVuY3Rpb24gKHIpIHtcbiAgICAgICAgcmV0dXJuIHIuaXNGb3J3YXJkID8gci5mb3J3YXJkTmFtZSA6IHIucmV2ZXJzZU5hbWU7XG4gICAgfSk7XG4gICAgcmV0dXJuIGFzSlNPTiA/IEpTT04uc3RyaW5naWZ5KGR1bXBlZCwgbnVsbCwgNCkgOiBkdW1wZWQ7XG59O1xuXG5NYXBwaW5nLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gJ01hcHBpbmdbJyArIHRoaXMudHlwZSArICddJztcbn07XG5cbi8qKlxuICogQSBzdWJjbGFzcyBvZiBSZXN0RXJyb3Igc3BlY2lmY2FsbHkgZm9yIGVycm9ycyB0aGF0IG9jY3VyIGR1cmluZyBtYXBwaW5nLlxuICogQHBhcmFtIG1lc3NhZ2VcbiAqIEBwYXJhbSBjb250ZXh0XG4gKiBAcGFyYW0gc3NmXG4gKiBAcmV0dXJucyB7TWFwcGluZ0Vycm9yfVxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIE1hcHBpbmdFcnJvcihtZXNzYWdlLCBjb250ZXh0LCBzc2YpIHtcbiAgICBpZiAoIXRoaXMpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBNYXBwaW5nRXJyb3IobWVzc2FnZSwgY29udGV4dCk7XG4gICAgfVxuXG4gICAgdGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcblxuICAgIHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG4gICAgLy8gY2FwdHVyZSBzdGFjayB0cmFjZVxuICAgIHNzZiA9IHNzZiB8fCBhcmd1bWVudHMuY2FsbGVlO1xuICAgIGlmIChzc2YgJiYgUmVzdEVycm9yLmNhcHR1cmVTdGFja1RyYWNlKSB7XG4gICAgICAgIFJlc3RFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCBzc2YpO1xuICAgIH1cbn1cblxuTWFwcGluZ0Vycm9yLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoUmVzdEVycm9yLnByb3RvdHlwZSk7XG5NYXBwaW5nRXJyb3IucHJvdG90eXBlLm5hbWUgPSAnTWFwcGluZ0Vycm9yJztcbk1hcHBpbmdFcnJvci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBNYXBwaW5nRXJyb3I7XG5cbmZ1bmN0aW9uIGFycmF5QXNTdHJpbmcoYXJyKSB7XG4gICAgdmFyIGFyckNvbnRlbnRzID0gXy5yZWR1Y2UoYXJyLCBmdW5jdGlvbiAobWVtbywgZikge3JldHVybiBtZW1vICsgJ1wiJyArIGYgKyAnXCIsJ30sICcnKTtcbiAgICBhcnJDb250ZW50cyA9IGFyckNvbnRlbnRzLnN1YnN0cmluZygwLCBhcnJDb250ZW50cy5sZW5ndGggLSAxKTtcbiAgICByZXR1cm4gJ1snICsgYXJyQ29udGVudHMgKyAnXSc7XG59XG5cblxuZnVuY3Rpb24gY29uc3RydWN0TWFwRnVuY3Rpb24oY29sbGVjdGlvbiwgdHlwZSwgZmllbGRzKSB7XG4gICAgdmFyIG1hcEZ1bmM7XG4gICAgdmFyIG9ubHlFbXB0eUZpZWxkU2V0U3BlY2lmaWVkID0gKGZpZWxkcy5sZW5ndGggPT0gMSAmJiAhZmllbGRzWzBdLmxlbmd0aCk7XG4gICAgdmFyIG5vRmllbGRTZXRzU3BlY2lmaWVkID0gIWZpZWxkcy5sZW5ndGggfHwgb25seUVtcHR5RmllbGRTZXRTcGVjaWZpZWQ7XG5cbiAgICB2YXIgYXJyID0gYXJyYXlBc1N0cmluZyhmaWVsZHMpO1xuICAgIGlmIChub0ZpZWxkU2V0c1NwZWNpZmllZCkge1xuICAgICAgICBtYXBGdW5jID0gZnVuY3Rpb24gKGRvYykge1xuICAgICAgICAgICAgdmFyIHR5cGUgPSBcIiQyXCI7XG4gICAgICAgICAgICB2YXIgY29sbGVjdGlvbiA9IFwiJDNcIjtcbiAgICAgICAgICAgIGlmIChkb2MudHlwZSA9PSB0eXBlICYmIGRvYy5jb2xsZWN0aW9uID09IGNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICBlbWl0KGRvYy50eXBlLCBkb2MpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LnRvU3RyaW5nKCk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBtYXBGdW5jID0gZnVuY3Rpb24gKGRvYykge1xuICAgICAgICAgICAgdmFyIHR5cGUgPSBcIiQyXCI7XG4gICAgICAgICAgICB2YXIgY29sbGVjdGlvbiA9IFwiJDNcIjtcbiAgICAgICAgICAgIGlmIChkb2MudHlwZSA9PSB0eXBlICYmIGRvYy5jb2xsZWN0aW9uID09IGNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAvL25vaW5zcGVjdGlvbiBKU1VucmVzb2x2ZWRWYXJpYWJsZVxuICAgICAgICAgICAgICAgIHZhciBmaWVsZHMgPSAkMTtcbiAgICAgICAgICAgICAgICB2YXIgYWdnRmllbGQgPSAnJztcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpZHggaW4gZmllbGRzKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vbm9pbnNwZWN0aW9uIEpTVW5maWx0ZXJlZEZvckluTG9vcFxuICAgICAgICAgICAgICAgICAgICB2YXIgZmllbGQgPSBmaWVsZHNbaWR4XTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHZhbHVlID0gZG9jW2ZpZWxkXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHZhbHVlICE9PSBudWxsICYmIHZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFnZ0ZpZWxkICs9IHZhbHVlLnRvU3RyaW5nKCkgKyAnXyc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAodmFsdWUgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFnZ0ZpZWxkICs9ICdudWxsXyc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhZ2dGaWVsZCArPSAndW5kZWZpbmVkXyc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYWdnRmllbGQgPSBhZ2dGaWVsZC5zdWJzdHJpbmcoMCwgYWdnRmllbGQubGVuZ3RoIC0gMSk7XG4gICAgICAgICAgICAgICAgZW1pdChhZ2dGaWVsZCwgZG9jKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfS50b1N0cmluZygpO1xuICAgICAgICBtYXBGdW5jID0gbWFwRnVuYy5yZXBsYWNlKCckMScsIGFycik7XG4gICAgfVxuICAgIG1hcEZ1bmMgPSBtYXBGdW5jLnJlcGxhY2UoJyQyJywgdHlwZSk7XG4gICAgbWFwRnVuYyA9IG1hcEZ1bmMucmVwbGFjZSgnJDMnLCBjb2xsZWN0aW9uKTtcbiAgICByZXR1cm4gbWFwRnVuYztcbn1cblxuXG5mdW5jdGlvbiBjb25zdHJ1Y3RNYXBGdW5jdGlvbjIoY29sbGVjdGlvbiwgdHlwZSwgZmllbGRzKSB7XG4gICAgdmFyIG1hcEZ1bmM7XG4gICAgdmFyIG9ubHlFbXB0eUZpZWxkU2V0U3BlY2lmaWVkID0gKGZpZWxkcy5sZW5ndGggPT0gMSAmJiAhZmllbGRzWzBdLmxlbmd0aCk7XG4gICAgdmFyIG5vRmllbGRTZXRzU3BlY2lmaWVkID0gIWZpZWxkcy5sZW5ndGggfHwgb25seUVtcHR5RmllbGRTZXRTcGVjaWZpZWQ7XG5cbiAgICBpZiAobm9GaWVsZFNldHNTcGVjaWZpZWQpIHtcbiAgICAgICAgbWFwRnVuYyA9IGZ1bmN0aW9uIChkb2MpIHtcbiAgICAgICAgICAgIGlmIChkb2MudHlwZSA9PSB0eXBlICYmIGRvYy5jb2xsZWN0aW9uID09IGNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICBlbWl0KGRvYy50eXBlLCBkb2MpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgbWFwRnVuYyA9IGZ1bmN0aW9uIChkb2MpIHtcbiAgICAgICAgICAgIGlmIChkb2MudHlwZSA9PSB0eXBlICYmIGRvYy5jb2xsZWN0aW9uID09IGNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICB2YXIgYWdnRmllbGQgPSAnJztcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpZHggaW4gZmllbGRzKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vbm9pbnNwZWN0aW9uIEpTVW5maWx0ZXJlZEZvckluTG9vcFxuICAgICAgICAgICAgICAgICAgICB2YXIgZmllbGQgPSBmaWVsZHNbaWR4XTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHZhbHVlID0gZG9jW2ZpZWxkXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHZhbHVlICE9PSBudWxsICYmIHZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFnZ0ZpZWxkICs9IHZhbHVlLnRvU3RyaW5nKCkgKyAnXyc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAodmFsdWUgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFnZ0ZpZWxkICs9ICdudWxsXyc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhZ2dGaWVsZCArPSAndW5kZWZpbmVkXyc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYWdnRmllbGQgPSBhZ2dGaWVsZC5zdWJzdHJpbmcoMCwgYWdnRmllbGQubGVuZ3RoIC0gMSk7XG4gICAgICAgICAgICAgICAgZW1pdChhZ2dGaWVsZCwgZG9jKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIG1hcEZ1bmM7XG59XG5cbmV4cG9ydHMuTWFwcGluZyA9IE1hcHBpbmc7XG5leHBvcnRzLk1hcHBpbmdFcnJvciA9IE1hcHBpbmdFcnJvcjtcbmV4cG9ydHMuY29uc3RydWN0TWFwRnVuY3Rpb24yID0gY29uc3RydWN0TWFwRnVuY3Rpb24yO1xuZXhwb3J0cy5jb25zdHJ1Y3RNYXBGdW5jdGlvbiA9IGNvbnN0cnVjdE1hcEZ1bmN0aW9uOyIsInZhciBTdG9yZSA9IHJlcXVpcmUoJy4vc3RvcmUnKTtcbnZhciBTaWVzdGFNb2RlbCA9IHJlcXVpcmUoJy4vb2JqZWN0JykuU2llc3RhTW9kZWw7XG52YXIgbG9nID0gcmVxdWlyZSgnLi4vdmVuZG9yL29wZXJhdGlvbnMuanMvc3JjL2xvZycpO1xudmFyIE9wZXJhdGlvbiA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vcGVyYXRpb25zLmpzL3NyYy9vcGVyYXRpb24nKS5PcGVyYXRpb247XG52YXIgUmVzdEVycm9yID0gcmVxdWlyZSgnLi4vc3JjL2Vycm9yJykuUmVzdEVycm9yO1xudmFyIFF1ZXJ5ID0gcmVxdWlyZSgnLi9xdWVyeScpLlF1ZXJ5O1xuXG52YXIgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKCdNYXBwaW5nT3BlcmF0aW9uJyk7XG5Mb2dnZXIuc2V0TGV2ZWwobG9nLkxldmVsLndhcm4pO1xuXG52YXIgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyk7XG52YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpO1xudmFyIF8gPSB1dGlsLl87XG52YXIgZGVmaW5lU3ViUHJvcGVydHkgPSByZXF1aXJlKCcuL21pc2MnKS5kZWZpbmVTdWJQcm9wZXJ0eTtcbnZhciBDaGFuZ2VUeXBlID0gcmVxdWlyZSgnLi9jaGFuZ2VzJykuQ2hhbmdlVHlwZTtcbnZhciBxID0gcmVxdWlyZSgncScpO1xuXG5mdW5jdGlvbiBmbGF0dGVuQXJyYXkoYXJyKSB7XG4gICAgcmV0dXJuIF8ucmVkdWNlKGFyciwgZnVuY3Rpb24gKG1lbW8sIGUpIHtcbiAgICAgICAgaWYgKHV0aWwuaXNBcnJheShlKSkge1xuICAgICAgICAgICAgbWVtbyA9IG1lbW8uY29uY2F0KGUpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgbWVtby5wdXNoKGUpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtZW1vO1xuICAgIH0sIFtdKTtcbn1cblxuZnVuY3Rpb24gdW5mbGF0dGVuQXJyYXkoYXJyLCBtb2RlbEFycikge1xuICAgIHZhciBuID0gMDtcbiAgICB2YXIgdW5mbGF0dGVuZWQgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG1vZGVsQXJyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmICh1dGlsLmlzQXJyYXkobW9kZWxBcnJbaV0pKSB7XG4gICAgICAgICAgICB2YXIgbmV3QXJyID0gW107XG4gICAgICAgICAgICB1bmZsYXR0ZW5lZFtpXSA9IG5ld0FycjtcbiAgICAgICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgbW9kZWxBcnJbaV0ubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICBuZXdBcnIucHVzaChhcnJbbl0pO1xuICAgICAgICAgICAgICAgIG4rKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHVuZmxhdHRlbmVkW2ldID0gYXJyW25dO1xuICAgICAgICAgICAgbisrO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiB1bmZsYXR0ZW5lZDtcbn1cblxuZnVuY3Rpb24gQnVsa01hcHBpbmdPcGVyYXRpb24ob3B0cykge1xuICAgIE9wZXJhdGlvbi5jYWxsKHRoaXMpO1xuXG4gICAgdGhpcy5fb3B0cyA9IG9wdHM7XG5cbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdtYXBwaW5nJywgdGhpcy5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnZGF0YScsIHRoaXMuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ29iamVjdHMnLCB0aGlzLl9vcHRzKTtcbiAgICBpZiAoIXRoaXMub2JqZWN0cykgdGhpcy5vYmplY3RzID0gW107XG5cbiAgICB0aGlzLmVycm9ycyA9IFtdO1xuICAgIHRoaXMubmFtZSA9ICdNYXBwaW5nIE9wZXJhdGlvbic7XG4gICAgdGhpcy53b3JrID0gXy5iaW5kKHRoaXMuX3N0YXJ0LCB0aGlzKTtcblxuICAgIC8vIGlmICh0aGlzLmRhdGEpIHtcbiAgICAvLyAgICAgXy5lYWNoKHRoaXMuZGF0YSwgZnVuY3Rpb24gKGRhdHVtKSB7XG4gICAgLy8gICAgICAgICBpZiAoIWRhdHVtKSB7XG4gICAgLy8gICAgICAgICAgICAgTG9nZ2VyLmVycm9yKCdFZXAhIE51bGwgZGF0YSEnLCB0aGlzLmRhdGEpO1xuICAgIC8vICAgICAgICAgICAgIHRocm93ICdFZXAhIE51bGwgZGF0YSEnO1xuICAgIC8vICAgICAgICAgfVxuICAgIC8vICAgICB9KVxuICAgIC8vIH1cblxuICAgIHRoaXMuc3ViT3BzID0ge307XG59XG5cbkJ1bGtNYXBwaW5nT3BlcmF0aW9uLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoT3BlcmF0aW9uLnByb3RvdHlwZSk7XG5cbmZ1bmN0aW9uIG1hcEF0dHJpYnV0ZXMoKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGRhdHVtID0gdGhpcy5kYXRhW2ldO1xuICAgICAgICB2YXIgb2JqZWN0ID0gdGhpcy5vYmplY3RzW2ldO1xuICAgICAgICAvLyBObyBwb2ludCBtYXBwaW5nIG9iamVjdCBvbnRvIGl0c2VsZi4gVGhpcyBoYXBwZW5zIGlmIGEgU2llc3RhTW9kZWwgaXMgcGFzc2VkIGFzIGEgcmVsYXRpb25zaGlwLlxuICAgICAgICBpZiAoZGF0dW0gIT0gb2JqZWN0KSB7XG4gICAgICAgICAgICBpZiAob2JqZWN0KSB7IC8vIElmIG9iamVjdCBpcyBmYWxzeSwgdGhlbiB0aGVyZSB3YXMgYW4gZXJyb3IgbG9va2luZyB1cCB0aGF0IG9iamVjdC9jcmVhdGluZyBpdC5cbiAgICAgICAgICAgICAgICB2YXIgZmllbGRzID0gdGhpcy5tYXBwaW5nLl9maWVsZHM7XG4gICAgICAgICAgICAgICAgXy5lYWNoKGZpZWxkcywgZnVuY3Rpb24gKGYpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRhdHVtW2ZdICE9PSB1bmRlZmluZWQpIHsgLy8gbnVsbCBpcyBmaW5lXG4gICAgICAgICAgICAgICAgICAgICAgICBvYmplY3RbZl0gPSBkYXR1bVtmXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5CdWxrTWFwcGluZ09wZXJhdGlvbi5wcm90b3R5cGUuX21hcCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgbWFwQXR0cmlidXRlcy5jYWxsKHRoaXMpO1xuICAgIHZhciByZWxhdGlvbnNoaXBGaWVsZHMgPSBfLmtleXMoc2VsZi5zdWJPcHMpO1xuICAgIF8uZWFjaChyZWxhdGlvbnNoaXBGaWVsZHMsIGZ1bmN0aW9uIChmKSB7XG4gICAgICAgIHZhciBvcCA9IHNlbGYuc3ViT3BzW2ZdLm9wO1xuICAgICAgICB2YXIgaW5kZXhlcyA9IHNlbGYuc3ViT3BzW2ZdLmluZGV4ZXM7XG4gICAgICAgIHZhciByZWxhdGVkRGF0YSA9IGdldFJlbGF0ZWREYXRhLmNhbGwoc2VsZiwgZikucmVsYXRlZERhdGE7XG4gICAgICAgIHZhciB1bmZsYXR0ZW5lZE9iamVjdHMgPSB1bmZsYXR0ZW5BcnJheShvcC5vYmplY3RzLCByZWxhdGVkRGF0YSk7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdW5mbGF0dGVuZWRPYmplY3RzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgaWR4ID0gaW5kZXhlc1tpXTtcbiAgICAgICAgICAgIC8vIEVycm9ycyBhcmUgcGx1Y2tlZCBmcm9tIHRoZSBzdWJvcGVyYXRpb25zLlxuICAgICAgICAgICAgdmFyIGVycm9yID0gc2VsZi5lcnJvcnNbaWR4XTtcbiAgICAgICAgICAgIHZhciBlcnIgPSBlcnJvciA/IGVycm9yW2ZdIDogbnVsbDtcbiAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgdmFyIHJlbGF0ZWQgPSB1bmZsYXR0ZW5lZE9iamVjdHNbaV07IC8vIENhbiBiZSBhcnJheSBvciBzY2FsYXIuXG4gICAgICAgICAgICAgICAgdmFyIG9iamVjdCA9IHNlbGYub2JqZWN0c1tpZHhdO1xuICAgICAgICAgICAgICAgIGlmIChvYmplY3QpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdFtmXSA9IHJlbGF0ZWQ7XG4vLyAgICAgICAgICAgICAgICAgICAgICAgIHJlZ2lzdGVyUmVsYXRpb25zaGlwQ2hhbmdlKG9iamVjdCwgZiwgcmVsYXRlZCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVyciBpbnN0YW5jZW9mIFJlc3RFcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghc2VsZi5lcnJvcnNbaWR4XSkgc2VsZi5lcnJvcnNbaWR4XSA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuZXJyb3JzW2lkeF1bZl0gPSBlcnIubWVzc2FnZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xufTtcblxuLyoqXG4gKiBGb3IgaW5kaWNlcyB3aGVyZSBubyBvYmplY3QgaXMgcHJlc2VudCwgcGVyZm9ybSBsb29rdXBzLCBjcmVhdGluZyBhIG5ldyBvYmplY3QgaWYgbmVjZXNzYXJ5LlxuICogQHByaXZhdGVcbiAqL1xuQnVsa01hcHBpbmdPcGVyYXRpb24ucHJvdG90eXBlLl9sb29rdXAgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICB2YXIgZGVmZXJyZWQgPSBxLmRlZmVyKCk7XG4gICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHJlbW90ZUxvb2t1cHMgPSBbXTtcbiAgICB2YXIgbG9jYWxMb29rdXBzID0gW107XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKCF0aGlzLm9iamVjdHNbaV0pIHtcbiAgICAgICAgICAgIHZhciBsb29rdXA7XG4gICAgICAgICAgICB2YXIgZGF0dW0gPSB0aGlzLmRhdGFbaV07XG4gICAgICAgICAgICB2YXIgaXNTY2FsYXIgPSB0eXBlb2YgZGF0dW0gPT0gJ3N0cmluZycgfHwgdHlwZW9mIGRhdHVtID09ICdudW1iZXInIHx8IGRhdHVtIGluc3RhbmNlb2YgU3RyaW5nO1xuICAgICAgICAgICAgaWYgKGRhdHVtKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlzU2NhbGFyKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvb2t1cCA9IHtpbmRleDogaSwgZGF0dW06IHt9fTtcbiAgICAgICAgICAgICAgICAgICAgbG9va3VwLmRhdHVtW3NlbGYubWFwcGluZy5pZF0gPSBkYXR1bTtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3RlTG9va3Vwcy5wdXNoKGxvb2t1cCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKGRhdHVtIGluc3RhbmNlb2YgU2llc3RhTW9kZWwpIHsgLy8gV2Ugd29uJ3QgbmVlZCB0byBwZXJmb3JtIGFueSBtYXBwaW5nLlxuICAgICAgICAgICAgICAgICAgICB0aGlzLm9iamVjdHNbaV0gPSBkYXR1bTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoZGF0dW0uX2lkKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvY2FsTG9va3Vwcy5wdXNoKHtpbmRleDogaSwgZGF0dW06IGRhdHVtfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKGRhdHVtW3NlbGYubWFwcGluZy5pZF0pIHtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3RlTG9va3Vwcy5wdXNoKHtpbmRleDogaSwgZGF0dW06IGRhdHVtfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm9iamVjdHNbaV0gPSBzZWxmLm1hcHBpbmcuX25ldygpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMub2JqZWN0c1tpXSA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgdXRpbC5wYXJhbGxlbChbXG4gICAgICAgICAgICBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICB2YXIgbG9jYWxJZGVudGlmaWVycyA9IF8ucGx1Y2soXy5wbHVjayhsb2NhbExvb2t1cHMsICdkYXR1bScpLCAnX2lkJyk7XG4gICAgICAgICAgICAgICAgaWYgKGxvY2FsSWRlbnRpZmllcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIFN0b3JlLmdldE11bHRpcGxlTG9jYWwobG9jYWxJZGVudGlmaWVycywgZnVuY3Rpb24gKGVyciwgb2JqZWN0cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxvY2FsSWRlbnRpZmllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG9iaiA9IG9iamVjdHNbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBfaWQgPSBsb2NhbElkZW50aWZpZXJzW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbG9va3VwID0gbG9jYWxMb29rdXBzW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIW9iaikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5lcnJvcnNbbG9va3VwLmluZGV4XSA9IHtfaWQ6ICdObyBvYmplY3Qgd2l0aCBfaWQ9XCInICsgX2lkLnRvU3RyaW5nKCkgKyAnXCInfTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYub2JqZWN0c1tsb29rdXAuaW5kZXhdID0gb2JqO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICB2YXIgcmVtb3RlSWRlbnRpZmllcnMgPSBfLnBsdWNrKF8ucGx1Y2socmVtb3RlTG9va3VwcywgJ2RhdHVtJyksIHNlbGYubWFwcGluZy5pZCk7XG4gICAgICAgICAgICAgICAgaWYgKHJlbW90ZUlkZW50aWZpZXJzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZSgnTG9va2luZyB1cCByZW1vdGVJZGVudGlmaWVyczogJyArIEpTT04uc3RyaW5naWZ5KHJlbW90ZUlkZW50aWZpZXJzLCBudWxsLCA0KSk7XG4gICAgICAgICAgICAgICAgICAgIFN0b3JlLmdldE11bHRpcGxlUmVtb3RlKHJlbW90ZUlkZW50aWZpZXJzLCBzZWxmLm1hcHBpbmcsIGZ1bmN0aW9uIChlcnIsIG9iamVjdHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlc3VsdHMgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IG9iamVjdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdHNbcmVtb3RlSWRlbnRpZmllcnNbaV1dID0gb2JqZWN0c1tpXSA/IG9iamVjdHNbaV0uX2lkIDogbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBMb2dnZXIudHJhY2UoJ1Jlc3VsdHMgZm9yIHJlbW90ZUlkZW50aWZpZXJzOiAnICsgSlNPTi5zdHJpbmdpZnkocmVzdWx0cywgbnVsbCwgNCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgb2JqZWN0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgb2JqID0gb2JqZWN0c1tpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGxvb2t1cCA9IHJlbW90ZUxvb2t1cHNbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvYmopIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYub2JqZWN0c1tsb29rdXAuaW5kZXhdID0gb2JqO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGRhdGEgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciByZW1vdGVJZCA9IHJlbW90ZUlkZW50aWZpZXJzW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVtzZWxmLm1hcHBpbmcuaWRdID0gcmVtb3RlSWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgY2FjaGVRdWVyeSA9IHttYXBwaW5nOiBzZWxmLm1hcHBpbmd9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FjaGVRdWVyeVtzZWxmLm1hcHBpbmcuaWRdID0gcmVtb3RlSWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgY2FjaGVkID0gY2FjaGUuZ2V0KGNhY2hlUXVlcnkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNhY2hlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYub2JqZWN0c1tsb29rdXAuaW5kZXhdID0gY2FjaGVkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5vYmplY3RzW2xvb2t1cC5pbmRleF0gPSBzZWxmLm1hcHBpbmcuX25ldygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEl0J3MgaW1wb3J0YW50IHRoYXQgd2UgbWFwIHRoZSByZW1vdGUgaWRlbnRpZmllciBoZXJlIHRvIGVuc3VyZSB0aGF0IGl0IGVuZHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB1cCBpbiB0aGUgY2FjaGUuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5vYmplY3RzW2xvb2t1cC5pbmRleF1bc2VsZi5tYXBwaW5nLmlkXSA9IHJlbW90ZUlkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgXSxcbiAgICAgICAgY2FsbGJhY2spO1xuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufTtcblxuQnVsa01hcHBpbmdPcGVyYXRpb24ucHJvdG90eXBlLl9sb29rdXBTaW5nbGV0b24gPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICB2YXIgZGVmZXJyZWQgPSBxLmRlZmVyKCk7XG4gICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGNhY2hlZFNpbmdsZXRvbiA9IGNhY2hlLmdldCh7bWFwcGluZzogdGhpcy5tYXBwaW5nfSk7XG4gICAgaWYgKCFjYWNoZWRTaW5nbGV0b24pIHtcbiAgICAgICAgdmFyIHF1ZXJ5ID0gbmV3IFF1ZXJ5KHRoaXMubWFwcGluZyk7XG4gICAgICAgIHF1ZXJ5LmV4ZWN1dGUoZnVuY3Rpb24gKGVyciwgb2Jqcykge1xuICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICB2YXIgb2JqO1xuICAgICAgICAgICAgICAgIGlmIChvYmpzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAob2Jqcy5sZW5ndGggPT0gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgb2JqID0gb2Jqc1swXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgb2JqID0gc2VsZi5tYXBwaW5nLl9uZXcoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzZWxmLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5vYmplY3RzW2ldID0gb2JqO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzZWxmLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHNlbGYub2JqZWN0c1tpXSA9IGNhY2hlZFNpbmdsZXRvbjtcbiAgICAgICAgfVxuICAgICAgICBjYWxsYmFjaygpO1xuICAgIH1cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn07XG5cblxuXG5cbkJ1bGtNYXBwaW5nT3BlcmF0aW9uLnByb3RvdHlwZS5fc3RhcnQgPSBmdW5jdGlvbiAoZG9uZSkge1xuICAgIGlmICh0aGlzLmRhdGEubGVuZ3RoKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgdmFyIHRhc2tzID0gW107XG4gICAgICAgIHZhciBsb29rdXBGdW5jID0gdGhpcy5tYXBwaW5nLnNpbmdsZXRvbiA/IHRoaXMuX2xvb2t1cFNpbmdsZXRvbiA6IHRoaXMuX2xvb2t1cDtcbiAgICAgICAgdGFza3MucHVzaChfLmJpbmQobG9va3VwRnVuYywgdGhpcykpO1xuICAgICAgICB0YXNrcy5wdXNoKF8uYmluZCh0aGlzLl9leGVjdXRlU3ViT3BlcmF0aW9ucywgdGhpcykpO1xuICAgICAgICB1dGlsLnBhcmFsbGVsKHRhc2tzLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBzZWxmLl9tYXAoKTtcbiAgICAgICAgICAgIGRvbmUoc2VsZi5lcnJvcnMubGVuZ3RoID8gc2VsZi5lcnJvcnMgOiBudWxsLCBzZWxmLm9iamVjdHMpO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGRvbmUobnVsbCwgW10pO1xuICAgIH1cbn07XG5cbmZ1bmN0aW9uIGdldFJlbGF0ZWREYXRhKG5hbWUpIHtcbiAgICB2YXIgaW5kZXhlcyA9IFtdO1xuICAgIHZhciByZWxhdGVkRGF0YSA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5kYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBkYXR1bSA9IHRoaXMuZGF0YVtpXTtcbiAgICAgICAgaWYgKGRhdHVtKSB7XG4gICAgICAgICAgICBpZiAoZGF0dW1bbmFtZV0pIHtcbiAgICAgICAgICAgICAgICBpbmRleGVzLnB1c2goaSk7XG4gICAgICAgICAgICAgICAgcmVsYXRlZERhdGEucHVzaChkYXR1bVtuYW1lXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHtpbmRleGVzOiBpbmRleGVzLCByZWxhdGVkRGF0YTogcmVsYXRlZERhdGF9O1xufVxuXG5CdWxrTWFwcGluZ09wZXJhdGlvbi5wcm90b3R5cGUuX2NvbnN0cnVjdFN1Yk9wZXJhdGlvbnMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHN1Yk9wcyA9IHRoaXMuc3ViT3BzO1xuICAgIHZhciByZWxhdGlvbnNoaXBzID0gdGhpcy5tYXBwaW5nLnJlbGF0aW9uc2hpcHM7XG4gICAgZm9yICh2YXIgbmFtZSBpbiByZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgIGlmIChyZWxhdGlvbnNoaXBzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgICAgICB2YXIgcmVsYXRpb25zaGlwID0gcmVsYXRpb25zaGlwc1tuYW1lXTtcbiAgICAgICAgICAgIHZhciByZXZlcnNlTWFwcGluZyA9IHJlbGF0aW9uc2hpcC5mb3J3YXJkTmFtZSA9PSBuYW1lID8gcmVsYXRpb25zaGlwLnJldmVyc2VNYXBwaW5nIDogcmVsYXRpb25zaGlwLmZvcndhcmRNYXBwaW5nO1xuICAgICAgICAgICAgdmFyIF9fcmV0ID0gZ2V0UmVsYXRlZERhdGEuY2FsbCh0aGlzLCBuYW1lKTtcbiAgICAgICAgICAgIHZhciBpbmRleGVzID0gX19yZXQuaW5kZXhlcztcbiAgICAgICAgICAgIHZhciByZWxhdGVkRGF0YSA9IF9fcmV0LnJlbGF0ZWREYXRhO1xuICAgICAgICAgICAgaWYgKHJlbGF0ZWREYXRhLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHZhciBmbGF0UmVsYXRlZERhdGEgPSBmbGF0dGVuQXJyYXkocmVsYXRlZERhdGEpO1xuICAgICAgICAgICAgICAgIHZhciBvcCA9IG5ldyBCdWxrTWFwcGluZ09wZXJhdGlvbih7bWFwcGluZzogcmV2ZXJzZU1hcHBpbmcsIGRhdGE6IGZsYXRSZWxhdGVkRGF0YX0pO1xuICAgICAgICAgICAgICAgIG9wLl9fcmVsYXRpb25zaGlwTmFtZSA9IG5hbWU7XG4gICAgICAgICAgICAgICAgc3ViT3BzW25hbWVdID0ge29wOiBvcCwgaW5kZXhlczogaW5kZXhlc307XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5mdW5jdGlvbiBnYXRoZXJFcnJvcnNGcm9tU3ViT3BlcmF0aW9ucygpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHJlbGF0aW9uc2hpcE5hbWVzID0gXy5rZXlzKHRoaXMuc3ViT3BzKTtcbiAgICBfLmVhY2gocmVsYXRpb25zaGlwTmFtZXMsIGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICAgIHZhciBvcCA9IHNlbGYuc3ViT3BzW25hbWVdLm9wO1xuICAgICAgICB2YXIgaW5kZXhlcyA9IHNlbGYuc3ViT3BzW25hbWVdLmluZGV4ZXM7XG4gICAgICAgIHZhciBlcnJvcnMgPSBvcC5lcnJvcnM7XG4gICAgICAgIGlmIChlcnJvcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgcmVsYXRlZERhdGEgPSBnZXRSZWxhdGVkRGF0YS5jYWxsKHNlbGYsIG5hbWUpLnJlbGF0ZWREYXRhO1xuICAgICAgICAgICAgdmFyIHVuZmxhdHRlbmVkRXJyb3JzID0gdW5mbGF0dGVuQXJyYXkoZXJyb3JzLCByZWxhdGVkRGF0YSk7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHVuZmxhdHRlbmVkRXJyb3JzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIGlkeCA9IGluZGV4ZXNbaV07XG4gICAgICAgICAgICAgICAgdmFyIGVyciA9IHVuZmxhdHRlbmVkRXJyb3JzW2ldO1xuICAgICAgICAgICAgICAgIHZhciBpc0Vycm9yID0gZXJyO1xuICAgICAgICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkoZXJyKSkgaXNFcnJvciA9IF8ucmVkdWNlKGVyciwgZnVuY3Rpb24gKG1lbW8sIHgpIHtyZXR1cm4gbWVtbyB8fCB4fSwgZmFsc2UpO1xuICAgICAgICAgICAgICAgIGlmIChpc0Vycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghc2VsZi5lcnJvcnNbaWR4XSkgc2VsZi5lcnJvcnNbaWR4XSA9IHt9O1xuICAgICAgICAgICAgICAgICAgICBzZWxmLmVycm9yc1tpZHhdW25hbWVdID0gZXJyO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xufVxuXG5CdWxrTWFwcGluZ09wZXJhdGlvbi5wcm90b3R5cGUuX2V4ZWN1dGVTdWJPcGVyYXRpb25zID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHRoaXMuX2NvbnN0cnVjdFN1Yk9wZXJhdGlvbnMoKTtcbiAgICB2YXIgcmVsYXRpb25zaGlwTmFtZXMgPSBfLmtleXModGhpcy5zdWJPcHMpO1xuICAgIGlmIChyZWxhdGlvbnNoaXBOYW1lcy5sZW5ndGgpIHtcbiAgICAgICAgdmFyIHN1Yk9wZXJhdGlvbnMgPSBfLm1hcChyZWxhdGlvbnNoaXBOYW1lcywgZnVuY3Rpb24gKGspIHsgcmV0dXJuIHNlbGYuc3ViT3BzW2tdLm9wfSk7XG4gICAgICAgIHZhciBjb21wb3NpdGVPcGVyYXRpb24gPSBuZXcgT3BlcmF0aW9uKHN1Yk9wZXJhdGlvbnMpO1xuICAgICAgICBjb21wb3NpdGVPcGVyYXRpb24ub25Db21wbGV0aW9uKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGdhdGhlckVycm9yc0Zyb21TdWJPcGVyYXRpb25zLmNhbGwoc2VsZiwgcmVsYXRpb25zaGlwTmFtZXMpO1xuICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbXBvc2l0ZU9wZXJhdGlvbi5zdGFydCgpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgY2FsbGJhY2soKTtcbiAgICB9XG59O1xuXG5leHBvcnRzLkJ1bGtNYXBwaW5nT3BlcmF0aW9uID0gQnVsa01hcHBpbmdPcGVyYXRpb247XG5leHBvcnRzLmZsYXR0ZW5BcnJheSA9IGZsYXR0ZW5BcnJheTtcbmV4cG9ydHMudW5mbGF0dGVuQXJyYXkgPSB1bmZsYXR0ZW5BcnJheTsiLCJ2YXIgUmVzdEVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLlJlc3RFcnJvcjtcblxuZnVuY3Rpb24gYXNzZXJ0KGNvbmRpdGlvbiwgbWVzc2FnZSwgY29udGV4dCkge1xuICAgIGlmICghY29uZGl0aW9uKSB7XG4gICAgICAgIG1lc3NhZ2UgPSBtZXNzYWdlIHx8IFwiQXNzZXJ0aW9uIGZhaWxlZFwiO1xuICAgICAgICBjb250ZXh0ID0gY29udGV4dCB8fCB7fTtcbiAgICAgICAgdGhyb3cgbmV3IFJlc3RFcnJvcihtZXNzYWdlLCBjb250ZXh0KTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRlZmluZVN1YlByb3BlcnR5IChwcm9wZXJ0eSwgc3ViT2JqLCBpbm5lclByb3BlcnR5KSB7XG4gICAgcmV0dXJuIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBwcm9wZXJ0eSwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChpbm5lclByb3BlcnR5KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1Yk9ialtpbm5lclByb3BlcnR5XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBzdWJPYmpbcHJvcGVydHldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgaWYgKGlubmVyUHJvcGVydHkpIHtcbiAgICAgICAgICAgICAgICBzdWJPYmpbaW5uZXJQcm9wZXJ0eV0gPSB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHN1Yk9ialtwcm9wZXJ0eV0gPSB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSk7XG59XG5cbnZhciBndWlkID0gKGZ1bmN0aW9uICgpIHtcbiAgICBmdW5jdGlvbiBzNCgpIHtcbiAgICAgICAgcmV0dXJuIE1hdGguZmxvb3IoKDEgKyBNYXRoLnJhbmRvbSgpKSAqIDB4MTAwMDApXG4gICAgICAgICAgICAudG9TdHJpbmcoMTYpXG4gICAgICAgICAgICAuc3Vic3RyaW5nKDEpO1xuICAgIH1cblxuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBzNCgpICsgczQoKSArICctJyArIHM0KCkgKyAnLScgKyBzNCgpICsgJy0nICtcbiAgICAgICAgICAgIHM0KCkgKyAnLScgKyBzNCgpICsgczQoKSArIHM0KCk7XG4gICAgfTtcbn0pKCk7XG5cbmZ1bmN0aW9uIHdyYXBwZWRDYWxsYmFjayAoY2FsbGJhY2spIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKGVyciwgcmVzKSB7XG4gICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXJyLCByZXMpO1xuICAgIH1cbn1cblxuZXhwb3J0cy5hc3NlcnQgPSBhc3NlcnQ7XG5leHBvcnRzLmRlZmluZVN1YlByb3BlcnR5ID0gZGVmaW5lU3ViUHJvcGVydHk7XG5leHBvcnRzLmd1aWQgPSBndWlkO1xuZXhwb3J0cy53cmFwcGVkQ2FsbGJhY2sgPSB3cmFwcGVkQ2FsbGJhY2s7IiwidmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcbnZhciBub3RpZmljYXRpb25DZW50cmUgPSBuZXcgRXZlbnRFbWl0dGVyKCk7XG5ub3RpZmljYXRpb25DZW50cmUuc2V0TWF4TGlzdGVuZXJzKDEwMCk7XG52YXIgQXJyYXlPYnNlcnZlciA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuQXJyYXlPYnNlcnZlcjtcbnZhciBjb3JlQ2hhbmdlcyA9IHJlcXVpcmUoJy4vY2hhbmdlcycpO1xudmFyIENoYW5nZVR5cGUgPSBjb3JlQ2hhbmdlcy5DaGFuZ2VUeXBlO1xudmFyIGxvZyA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vcGVyYXRpb25zLmpzL3NyYy9sb2cnKTtcblxuXG4vLy8qKlxuLy8gKiBXcmFwcyB0aGUgbWV0aG9kcyBvZiBhIGphdmFzY3JpcHQgYXJyYXkgb2JqZWN0IHNvIHRoYXQgbm90aWZpY2F0aW9ucyBhcmUgc2VudFxuLy8gKiBvbiBjYWxscy5cbi8vICpcbi8vICogQHBhcmFtIGFycmF5IHRoZSBhcnJheSB3ZSBoYXZlIHdyYXBwaW5nXG4vLyAqIEBwYXJhbSBmaWVsZCBuYW1lIG9mIHRoZSBmaWVsZFxuLy8gKiBAcGFyYW0gcmVzdE9iamVjdCB0aGUgb2JqZWN0IHRvIHdoaWNoIHRoaXMgYXJyYXkgaXMgYSBwcm9wZXJ0eVxuLy8gKi9cbi8vXG5cbmZ1bmN0aW9uIHdyYXBBcnJheShhcnJheSwgZmllbGQsIHNpZXN0YU1vZGVsKSB7XG4gICAgaWYgKCFhcnJheS5vYnNlcnZlcikge1xuICAgICAgICBhcnJheS5vYnNlcnZlciA9IG5ldyBBcnJheU9ic2VydmVyKGFycmF5KTtcbiAgICAgICAgYXJyYXkub2JzZXJ2ZXIub3BlbihmdW5jdGlvbiAoc3BsaWNlcykge1xuICAgICAgICAgICAgdmFyIGZpZWxkSXNBdHRyaWJ1dGUgPSBzaWVzdGFNb2RlbC5fZmllbGRzLmluZGV4T2YoZmllbGQpID4gLTE7XG4gICAgICAgICAgICBpZiAoZmllbGRJc0F0dHJpYnV0ZSkge1xuICAgICAgICAgICAgICAgIHNwbGljZXMuZm9yRWFjaChmdW5jdGlvbiAoc3BsaWNlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvcmVDaGFuZ2VzLnJlZ2lzdGVyQ2hhbmdlKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbGxlY3Rpb246IHNpZXN0YU1vZGVsLmNvbGxlY3Rpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXBwaW5nOiBzaWVzdGFNb2RlbC5tYXBwaW5nLnR5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICBfaWQ6IHNpZXN0YU1vZGVsLl9pZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4OiBzcGxpY2UuaW5kZXgsXG4gICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVkOiBzcGxpY2UucmVtb3ZlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGFkZGVkOiBzcGxpY2UuYWRkZWRDb3VudCA/IGFycmF5LnNsaWNlKHNwbGljZS5pbmRleCwgc3BsaWNlLmluZGV4K3NwbGljZS5hZGRlZENvdW50KSA6IFtdLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogY29yZUNoYW5nZXMuQ2hhbmdlVHlwZS5TcGxpY2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWVsZDogZmllbGRcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBhcnJheS5pc0ZhdWx0ID0gZmFsc2U7XG4gICAgfVxufVxuXG5cblxuZXhwb3J0cy5ub3RpZmljYXRpb25DZW50cmUgPSBub3RpZmljYXRpb25DZW50cmU7XG5leHBvcnRzLndyYXBBcnJheSA9IHdyYXBBcnJheTtcbiIsInZhciBsb2cgPSByZXF1aXJlKCcuLi92ZW5kb3Ivb3BlcmF0aW9ucy5qcy9zcmMvbG9nJyk7XG52YXIgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKCdTaWVzdGFNb2RlbCcpO1xuTG9nZ2VyLnNldExldmVsKGxvZy5MZXZlbC53YXJuKTtcblxudmFyIGRlZmluZVN1YlByb3BlcnR5ID0gcmVxdWlyZSgnLi9taXNjJykuZGVmaW5lU3ViUHJvcGVydHk7XG4vL3ZhciBPcGVyYXRpb25RdWV1ZSA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vcGVyYXRpb25zLmpzL3NyYy9xdWV1ZScpLk9wZXJhdGlvblF1ZXVlO1xudmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcbnZhciBfID0gdXRpbC5fO1xudmFyIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpO1xudmFyIFJlc3RFcnJvciA9IGVycm9yLlJlc3RFcnJvcjtcblxudmFyIHEgPSByZXF1aXJlKCdxJyk7XG5cbi8vdmFyIHF1ZXVlcyA9IHt9O1xuXG5mdW5jdGlvbiBTaWVzdGFNb2RlbChtYXBwaW5nKSB7XG5cbiAgICBpZiAoIXRoaXMpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBTaWVzdGFNb2RlbChtYXBwaW5nKTtcbiAgICB9XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHRoaXMubWFwcGluZyA9IG1hcHBpbmc7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdpZEZpZWxkJywge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBzZWxmLm1hcHBpbmcuaWQgPyBzZWxmLm1hcHBpbmcuaWQgOiAnaWQnO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICd0eXBlJywgdGhpcy5tYXBwaW5nKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdjb2xsZWN0aW9uJywgdGhpcy5tYXBwaW5nKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdfZmllbGRzJywgdGhpcy5tYXBwaW5nKTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ19yZWxhdGlvbnNoaXBGaWVsZHMnLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIF8ubWFwKHNlbGYuX3Byb3hpZXMsIGZ1bmN0aW9uIChwKSB7XG4gICAgICAgICAgICAgICAgaWYgKHAuaXNGb3J3YXJkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBwLmZvcndhcmROYW1lO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHAucmV2ZXJzZU5hbWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pO1xuXG5cbiAgICB0aGlzLmlzRmF1bHQgPSBmYWxzZTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnaXNTYXZlZCcsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gISFzZWxmLl9yZXY7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pO1xuXG4gICAgdGhpcy5fcmV2ID0gbnVsbDtcblxufVxuXG4vKipcbiAqIEh1bWFuIHJlYWRhYmxlIGR1bXAgb2YgdGhpcyBvYmplY3RcbiAqIEByZXR1cm5zIHsqfVxuICogQHByaXZhdGVcbiAqL1xuU2llc3RhTW9kZWwucHJvdG90eXBlLl9kdW1wID0gZnVuY3Rpb24gKGFzSnNvbikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgY2xlYW5PYmogPSB7fTtcbiAgICBjbGVhbk9iai5tYXBwaW5nID0gdGhpcy5tYXBwaW5nLnR5cGU7XG4gICAgY2xlYW5PYmouY29sbGVjdGlvbiA9IHRoaXMuY29sbGVjdGlvbjtcbiAgICBjbGVhbk9iai5faWQgPSB0aGlzLl9pZDtcbiAgICBjbGVhbk9iaiA9IF8ucmVkdWNlKHRoaXMuX2ZpZWxkcywgZnVuY3Rpb24gKG1lbW8sIGYpIHtcbiAgICAgICAgaWYgKHNlbGZbZl0pIHtcbiAgICAgICAgICAgIG1lbW9bZl0gPSBzZWxmW2ZdO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtZW1vO1xuICAgIH0sIGNsZWFuT2JqKTtcbiAgICBjbGVhbk9iaiA9IF8ucmVkdWNlKHRoaXMuX3JlbGF0aW9uc2hpcEZpZWxkcywgZnVuY3Rpb24gKG1lbW8sIGYpIHtcbiAgICAgICAgaWYgKHNlbGZbZiArICdQcm94eSddKSB7XG4gICAgICAgICAgICBpZiAoc2VsZltmICsgJ1Byb3h5J10uaGFzT3duUHJvcGVydHkoJ19pZCcpKSB7XG4gICAgICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheShzZWxmW2YgKyAnUHJveHknXS5faWQpKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzZWxmW2ZdLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1tmXSA9IHNlbGZbZiArICdQcm94eSddLl9pZDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChzZWxmW2YgKyAnUHJveHknXS5faWQpIHtcbiAgICAgICAgICAgICAgICAgICAgbWVtb1tmXSA9IHNlbGZbZiArICdQcm94eSddLl9pZDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBtZW1vW2ZdID0gc2VsZltmXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWVtbztcbiAgICB9LCBjbGVhbk9iaik7XG5cbiAgICByZXR1cm4gYXNKc29uID8gSlNPTi5zdHJpbmdpZnkoY2xlYW5PYmosIG51bGwsIDQpIDogY2xlYW5PYmo7XG59O1xuXG5cblNpZXN0YU1vZGVsLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICB2YXIgZGVmZXJyZWQgPSBxLmRlZmVyKCk7XG4gICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKG51bGwsIHRoaXMpO1xuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufTtcblxuZXhwb3J0cy5TaWVzdGFNb2RlbCA9IFNpZXN0YU1vZGVsO1xuZXhwb3J0cy5kdW1wU2F2ZVF1ZXVlcyA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgZHVtcGVkID0ge307XG4gICAgZm9yICh2YXIgaWQgaW4gcXVldWVzKSB7XG4gICAgICAgIGlmIChxdWV1ZXMuaGFzT3duUHJvcGVydHkoaWQpKSB7XG4gICAgICAgICAgICB2YXIgcXVldWUgPSBxdWV1ZXNbaWRdO1xuICAgICAgICAgICAgZHVtcGVkW2lkXSA9IHtcbiAgICAgICAgICAgICAgICBudW1SdW5uaW5nOiBxdWV1ZS5udW1SdW5uaW5nT3BlcmF0aW9ucyxcbiAgICAgICAgICAgICAgICBxdWV1ZWQ6IHF1ZXVlLl9xdWV1ZWRPcGVyYXRpb25zLmxlbmd0aFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZHVtcGVkO1xufTsiLCJ2YXIgcHJveHkgPSByZXF1aXJlKCcuL3Byb3h5JylcbiAgICAsIE5ld09iamVjdFByb3h5ID0gcHJveHkuTmV3T2JqZWN0UHJveHlcbiAgICAsIFN0b3JlID0gcmVxdWlyZSgnLi9zdG9yZScpXG4gICAgLCB1dGlsID0gcmVxdWlyZSgnLi91dGlsJylcbiAgICAsIF8gPSB1dGlsLl9cbiAgICAsIFJlc3RFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5SZXN0RXJyb3JcbiAgICAsIGNvcmVDaGFuZ2VzID0gcmVxdWlyZSgnLi9jaGFuZ2VzJylcbiAgICAsIFNpZXN0YU1vZGVsID0gcmVxdWlyZSgnLi9vYmplY3QnKS5TaWVzdGFNb2RlbFxuICAgICwgbm90aWZpY2F0aW9uQ2VudHJlID0gcmVxdWlyZSgnLi9ub3RpZmljYXRpb25DZW50cmUnKVxuICAgICwgd3JhcEFycmF5Rm9yQXR0cmlidXRlcyA9IG5vdGlmaWNhdGlvbkNlbnRyZS53cmFwQXJyYXlcbiAgICAsIEFycmF5T2JzZXJ2ZXIgPSByZXF1aXJlKCcuLi92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZScpLkFycmF5T2JzZXJ2ZXJcbiAgICAsIENoYW5nZVR5cGUgPSByZXF1aXJlKCcuL2NoYW5nZXMnKS5DaGFuZ2VUeXBlXG4gICAgLCBxID0gcmVxdWlyZSgncScpXG4gICAgO1xuXG5cbmZ1bmN0aW9uIE9uZVRvTWFueVByb3h5KG9wdHMpIHtcbiAgICBOZXdPYmplY3RQcm94eS5jYWxsKHRoaXMsIG9wdHMpO1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnaXNGYXVsdCcsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoc2VsZi5pc0ZvcndhcmQpIHtcbiAgICAgICAgICAgICAgICBpZiAoc2VsZi5faWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICFzZWxmLnJlbGF0ZWQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHNlbGYuX2lkID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoc2VsZi5faWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNlbGYucmVsYXRlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNlbGYuX2lkLmxlbmd0aCAhPSBzZWxmLnJlbGF0ZWQubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdGVSZWxhdGVkLmNhbGwodGhpcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgICBpZiAodikge1xuICAgICAgICAgICAgICAgIHNlbGYuX2lkID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIHNlbGYucmVsYXRlZCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoIXNlbGYuX2lkKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzZWxmLmlzRm9yd2FyZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5faWQgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5faWQgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYucmVsYXRlZCA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgd3JhcEFycmF5LmNhbGwoc2VsZiwgc2VsZi5yZWxhdGVkKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIHRoaXMuX3JldmVyc2VJc0FycmF5ID0gdHJ1ZTtcbiAgICB0aGlzLl9mb3J3YXJkSXNBcnJheSA9IGZhbHNlO1xufVxuXG5PbmVUb01hbnlQcm94eS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKE5ld09iamVjdFByb3h5LnByb3RvdHlwZSk7XG5cblxuZnVuY3Rpb24gY2xlYXJSZXZlcnNlKHJlbW92ZWQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgXy5lYWNoKHJlbW92ZWQsIGZ1bmN0aW9uIChyZW1vdmVkT2JqZWN0KSB7XG4gICAgICAgIHZhciByZXZlcnNlUHJveHkgPSBwcm94eS5nZXRSZXZlcnNlUHJveHlGb3JPYmplY3QuY2FsbChzZWxmLCByZW1vdmVkT2JqZWN0KTtcbiAgICAgICAgcHJveHkuc2V0LmNhbGwocmV2ZXJzZVByb3h5LCBudWxsKTtcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gc2V0UmV2ZXJzZShhZGRlZCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBfLmVhY2goYWRkZWQsIGZ1bmN0aW9uIChhZGRlZCkge1xuICAgICAgICB2YXIgZm9yd2FyZFByb3h5ID0gcHJveHkuZ2V0UmV2ZXJzZVByb3h5Rm9yT2JqZWN0LmNhbGwoc2VsZiwgYWRkZWQpO1xuICAgICAgICBwcm94eS5zZXQuY2FsbChmb3J3YXJkUHJveHksIHNlbGYub2JqZWN0KTtcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gd3JhcEFycmF5KGFycikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzKGFyciwgdGhpcy5yZXZlcnNlTmFtZSwgdGhpcy5vYmplY3QpO1xuICAgIGlmICghYXJyLm9uZVRvTWFueU9ic2VydmVyKSB7XG4gICAgICAgIGFyci5vbmVUb01hbnlPYnNlcnZlciA9IG5ldyBBcnJheU9ic2VydmVyKGFycik7XG4gICAgICAgIHZhciBvYnNlcnZlckZ1bmN0aW9uID0gZnVuY3Rpb24gKHNwbGljZXMpIHtcbiAgICAgICAgICAgIHNwbGljZXMuZm9yRWFjaChmdW5jdGlvbiAoc3BsaWNlKSB7XG4gICAgICAgICAgICAgICAgdmFyIGFkZGVkID0gc3BsaWNlLmFkZGVkQ291bnQgPyBhcnIuc2xpY2Uoc3BsaWNlLmluZGV4LCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCkgOiBbXTtcbiAgICAgICAgICAgICAgICB2YXIgcmVtb3ZlZCA9IHNwbGljZS5yZW1vdmVkO1xuICAgICAgICAgICAgICAgIGNsZWFyUmV2ZXJzZS5jYWxsKHNlbGYsIHJlbW92ZWQpO1xuICAgICAgICAgICAgICAgIHNldFJldmVyc2UuY2FsbChzZWxmLCBhZGRlZCk7XG4gICAgICAgICAgICAgICAgdmFyIG1hcHBpbmcgPSBwcm94eS5nZXRGb3J3YXJkTWFwcGluZy5jYWxsKHNlbGYpO1xuICAgICAgICAgICAgICAgIGNvcmVDaGFuZ2VzLnJlZ2lzdGVyQ2hhbmdlKHtcbiAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbjogbWFwcGluZy5jb2xsZWN0aW9uLFxuICAgICAgICAgICAgICAgICAgICBtYXBwaW5nOiBtYXBwaW5nLFxuICAgICAgICAgICAgICAgICAgICBfaWQ6IHNlbGYub2JqZWN0Ll9pZCxcbiAgICAgICAgICAgICAgICAgICAgZmllbGQ6IHByb3h5LmdldEZvcndhcmROYW1lLmNhbGwoc2VsZiksXG4gICAgICAgICAgICAgICAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgICAgICAgICAgICAgICAgIGFkZGVkOiBhZGRlZCxcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlZElkOiBfLnBsdWNrKHJlbW92ZWQsICdfaWQnKSxcbiAgICAgICAgICAgICAgICAgICAgYWRkZWRJZDogXy5wbHVjayhhZGRlZCwgJ19pZCcpLFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiBDaGFuZ2VUeXBlLlNwbGljZSxcbiAgICAgICAgICAgICAgICAgICAgaW5kZXg6IHNwbGljZS5pbmRleFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgICAgIGFyci5vbmVUb01hbnlPYnNlcnZlci5vcGVuKG9ic2VydmVyRnVuY3Rpb24pO1xuICAgIH1cbn1cblxuXG5PbmVUb01hbnlQcm94eS5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgdmFyIGRlZmVycmVkID0gcS5kZWZlcigpO1xuICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICh0aGlzLmlzRmF1bHQpIHtcbiAgICAgICAgaWYgKHRoaXMuX2lkLmxlbmd0aCkge1xuICAgICAgICAgICAgdmFyIHN0b3JlT3B0cyA9IHtfaWQ6IHRoaXMuX2lkfTtcbiAgICAgICAgICAgIFN0b3JlLmdldChzdG9yZU9wdHMsIGZ1bmN0aW9uIChlcnIsIHN0b3JlZCkge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5yZWxhdGVkID0gc3RvcmVkO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKG51bGwsIHN0b3JlZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHRoaXMucmVsYXRlZCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobnVsbCwgdGhpcy5yZWxhdGVkKTtcbiAgICB9XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59O1xuXG4vKipcbiAqIFZhbGlkYXRlIHRoZSBvYmplY3QgdGhhdCB3ZSdyZSBzZXR0aW5nXG4gKiBAcGFyYW0gb2JqXG4gKiBAcmV0dXJucyB7c3RyaW5nfG51bGx9IEFuIGVycm9yIG1lc3NhZ2Ugb3IgbnVsbFxuICovXG5mdW5jdGlvbiB2YWxpZGF0ZShvYmopIHtcbiAgICB2YXIgc3RyID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaik7XG4gICAgaWYgKHRoaXMuaXNGb3J3YXJkKSB7XG4gICAgICAgIGlmIChzdHIgPT0gJ1tvYmplY3QgQXJyYXldJykge1xuICAgICAgICAgICAgcmV0dXJuICdDYW5ub3QgYXNzaWduIGFycmF5IGZvcndhcmQgb25lVG9NYW55ICgnICsgc3RyICsgJyk6ICcgKyB0aGlzLmZvcndhcmROYW1lO1xuICAgICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBpZiAoc3RyICE9ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICAgICAgICAgIHJldHVybiAnQ2Fubm90IHNjYWxhciB0byByZXZlcnNlIG9uZVRvTWFueSAoJyArIHN0ciArICcpOiAnICsgdGhpcy5yZXZlcnNlTmFtZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gdmFsaWRhdGVSZWxhdGVkKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoc2VsZi5faWQpIHtcbiAgICAgICAgaWYgKHNlbGYucmVsYXRlZCkge1xuICAgICAgICAgICAgaWYgKHNlbGYuX2lkLmxlbmd0aCAhPSBzZWxmLnJlbGF0ZWQubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgaWYgKHNlbGYucmVsYXRlZC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IoJ19pZCBhbmQgcmVsYXRlZCBhcmUgc29tZWhvdyBvdXQgb2Ygc3luYycpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuT25lVG9NYW55UHJveHkucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICBwcm94eS5jaGVja0luc3RhbGxlZC5jYWxsKHRoaXMpO1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAob2JqKSB7XG4gICAgICAgIHZhciBlcnJvck1lc3NhZ2U7XG4gICAgICAgIGlmIChlcnJvck1lc3NhZ2UgPSB2YWxpZGF0ZS5jYWxsKHRoaXMsIG9iaikpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IoZXJyb3JNZXNzYWdlKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHByb3h5LmNsZWFyUmV2ZXJzZVJlbGF0ZWQuY2FsbCh0aGlzKTtcbiAgICAgICAgICAgIHByb3h5LnNldC5jYWxsKHNlbGYsIG9iaik7XG4gICAgICAgICAgICBpZiAoc2VsZi5pc1JldmVyc2UpIHtcbiAgICAgICAgICAgICAgICB3cmFwQXJyYXkuY2FsbCh0aGlzLCBzZWxmLnJlbGF0ZWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcHJveHkuc2V0UmV2ZXJzZS5jYWxsKHNlbGYsIG9iaik7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHByb3h5LmNsZWFyUmV2ZXJzZVJlbGF0ZWQuY2FsbCh0aGlzKTtcbiAgICAgICAgcHJveHkuc2V0LmNhbGwoc2VsZiwgb2JqKTtcbiAgICB9XG59O1xuXG5PbmVUb01hbnlQcm94eS5wcm90b3R5cGUuaW5zdGFsbCA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICBOZXdPYmplY3RQcm94eS5wcm90b3R5cGUuaW5zdGFsbC5jYWxsKHRoaXMsIG9iaik7XG4gICAgaWYgKHRoaXMuaXNSZXZlcnNlKSB7XG4gICAgICAgIG9ialsgKCdzcGxpY2UnICsgdXRpbC5jYXBpdGFsaXNlRmlyc3RMZXR0ZXIodGhpcy5yZXZlcnNlTmFtZSkpXSA9IF8uYmluZChwcm94eS5zcGxpY2UsIHRoaXMpO1xuICAgIH1cbn07XG5cblxuZXhwb3J0cy5PbmVUb01hbnlQcm94eSA9IE9uZVRvTWFueVByb3h5OyIsInZhciBwcm94eSA9IHJlcXVpcmUoJy4vcHJveHknKVxuICAgICwgTmV3T2JqZWN0UHJveHkgPSBwcm94eS5OZXdPYmplY3RQcm94eVxuICAgICwgU3RvcmUgPSByZXF1aXJlKCcuL3N0b3JlJylcbiAgICAsIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKVxuICAgICwgUmVzdEVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLlJlc3RFcnJvclxuICAgICwgcSA9IHJlcXVpcmUoJ3EnKVxuICAgICwgU2llc3RhTW9kZWwgPSByZXF1aXJlKCcuL29iamVjdCcpLlNpZXN0YU1vZGVsO1xuXG5cblxuZnVuY3Rpb24gT25lVG9PbmVQcm94eShvcHRzKSB7XG4gICAgTmV3T2JqZWN0UHJveHkuY2FsbCh0aGlzLCBvcHRzKTtcbiAgICB0aGlzLl9yZXZlcnNlSXNBcnJheSA9IGZhbHNlO1xuICAgIHRoaXMuX2ZvcndhcmRJc0FycmF5ID0gZmFsc2U7XG59XG5cbk9uZVRvT25lUHJveHkucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShOZXdPYmplY3RQcm94eS5wcm90b3R5cGUpO1xuXG4vKipcbiAqIFZhbGlkYXRlIHRoZSBvYmplY3QgdGhhdCB3ZSdyZSBzZXR0aW5nXG4gKiBAcGFyYW0gb2JqXG4gKiBAcmV0dXJucyB7c3RyaW5nfG51bGx9IEFuIGVycm9yIG1lc3NhZ2Ugb3IgbnVsbFxuICovXG5mdW5jdGlvbiB2YWxpZGF0ZShvYmopIHtcbiAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaikgPT0gJ1tvYmplY3QgQXJyYXldJykge1xuICAgICAgICByZXR1cm4gJ0Nhbm5vdCBhc3NpZ24gYXJyYXkgdG8gb25lIHRvIG9uZSByZWxhdGlvbnNoaXAnO1xuICAgIH1cbiAgICBlbHNlIGlmICgoIW9iaiBpbnN0YW5jZW9mIFNpZXN0YU1vZGVsKSkge1xuXG4gICAgfVxuICAgIHJldHVybiBudWxsO1xufVxuXG5PbmVUb09uZVByb3h5LnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgcHJveHkuY2hlY2tJbnN0YWxsZWQuY2FsbCh0aGlzKTtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKG9iaikge1xuICAgICAgICB2YXIgZXJyb3JNZXNzYWdlO1xuICAgICAgICBpZiAoZXJyb3JNZXNzYWdlID0gdmFsaWRhdGUob2JqKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFJlc3RFcnJvcihlcnJvck1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcHJveHkuY2xlYXJSZXZlcnNlUmVsYXRlZC5jYWxsKHRoaXMpO1xuICAgICAgICAgICAgcHJveHkuc2V0LmNhbGwoc2VsZiwgb2JqKTtcbiAgICAgICAgICAgIHByb3h5LnNldFJldmVyc2UuY2FsbChzZWxmLCBvYmopO1xuICAgICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBwcm94eS5jbGVhclJldmVyc2VSZWxhdGVkLmNhbGwodGhpcyk7XG4gICAgICAgIHByb3h5LnNldC5jYWxsKHNlbGYsIG9iaik7XG4gICAgfVxufTtcblxuT25lVG9PbmVQcm94eS5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgdmFyIGRlZmVycmVkID0gcS5kZWZlcigpO1xuICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICh0aGlzLl9pZCkge1xuICAgICAgICBTdG9yZS5nZXQoe19pZDogdGhpcy5faWR9LCBmdW5jdGlvbiAoZXJyLCBzdG9yZWQpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBzZWxmLnJlbGF0ZWQgPSBzdG9yZWQ7XG4gICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhudWxsLCBzdG9yZWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgIH1cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn07XG5cbmV4cG9ydHMuT25lVG9PbmVQcm94eSA9IE9uZVRvT25lUHJveHk7IiwidmFyIFJlc3RFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5SZXN0RXJyb3JcbiAgICAsIFN0b3JlID0gcmVxdWlyZSgnLi9zdG9yZScpXG4gICAgLCBkZWZpbmVTdWJQcm9wZXJ0eSA9IHJlcXVpcmUoJy4vbWlzYycpLmRlZmluZVN1YlByb3BlcnR5XG4gICAgLCBPcGVyYXRpb24gPSByZXF1aXJlKCcuLi92ZW5kb3Ivb3BlcmF0aW9ucy5qcy9zcmMvb3BlcmF0aW9uJykuT3BlcmF0aW9uXG4gICAgLCB1dGlsID0gcmVxdWlyZSgnLi91dGlsJylcbiAgICAsIF8gPSB1dGlsLl9cbiAgICAsIFF1ZXJ5ID0gcmVxdWlyZSgnLi9xdWVyeScpLlF1ZXJ5XG4gICAgLCBsb2cgPSByZXF1aXJlKCcuLi92ZW5kb3Ivb3BlcmF0aW9ucy5qcy9zcmMvbG9nJylcbiAgICAsIG5vdGlmaWNhdGlvbkNlbnRyZSA9IHJlcXVpcmUoJy4vbm90aWZpY2F0aW9uQ2VudHJlJylcbiAgICAsIHdyYXBBcnJheUZvckF0dHJpYnV0ZXMgPSBub3RpZmljYXRpb25DZW50cmUud3JhcEFycmF5XG4gICAgLCBBcnJheU9ic2VydmVyID0gcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKS5BcnJheU9ic2VydmVyXG4gICAgLCBjb3JlQ2hhbmdlcyA9IHJlcXVpcmUoJy4vY2hhbmdlcycpXG4gICAgLCBDaGFuZ2VUeXBlID0gY29yZUNoYW5nZXMuQ2hhbmdlVHlwZTtcblxuZnVuY3Rpb24gRmF1bHQocHJveHkpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdGhpcy5wcm94eSA9IHByb3h5O1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnaXNGYXVsdCcsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gc2VsZi5wcm94eS5pc0ZhdWx0O1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcbn1cblxuRmF1bHQucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLnByb3h5LmdldC5hcHBseSh0aGlzLnByb3h5LCBhcmd1bWVudHMpO1xufTtcblxuRmF1bHQucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLnByb3h5LnNldC5hcHBseSh0aGlzLnByb3h5LCBhcmd1bWVudHMpO1xufTtcblxuZnVuY3Rpb24gTmV3T2JqZWN0UHJveHkob3B0cykge1xuICAgIHRoaXMuX29wdHMgPSBvcHRzO1xuICAgIGlmICghdGhpcykgcmV0dXJuIG5ldyBOZXdPYmplY3RQcm94eShvcHRzKTtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdGhpcy5mYXVsdCA9IG5ldyBGYXVsdCh0aGlzKTtcbiAgICB0aGlzLm9iamVjdCA9IG51bGw7XG4gICAgdGhpcy5faWQgPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5yZWxhdGVkID0gbnVsbDtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ2lzRmF1bHQnLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKHNlbGYuX2lkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICFzZWxmLnJlbGF0ZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChzZWxmLl9pZCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgICBpZiAodikge1xuICAgICAgICAgICAgICAgIHNlbGYuX2lkID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIHNlbGYucmVsYXRlZCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoIXNlbGYuX2lkKSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuX2lkID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ3JldmVyc2VNYXBwaW5nJywgdGhpcy5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnZm9yd2FyZE1hcHBpbmcnLCB0aGlzLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdmb3J3YXJkTmFtZScsIHRoaXMuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ3JldmVyc2VOYW1lJywgdGhpcy5fb3B0cyk7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdpc1JldmVyc2UnLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKHNlbGYub2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNlbGYub2JqZWN0Lm1hcHBpbmcgPT0gc2VsZi5yZXZlcnNlTWFwcGluZztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IoJ0Nhbm5vdCB1c2UgcHJveHkgdW50aWwgaW5zdGFsbGVkJylcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSk7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdpc0ZvcndhcmQnLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKHNlbGYub2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNlbGYub2JqZWN0Lm1hcHBpbmcgPT0gc2VsZi5mb3J3YXJkTWFwcGluZztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IoJ0Nhbm5vdCB1c2UgcHJveHkgdW50aWwgaW5zdGFsbGVkJylcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSk7XG59XG5cbk5ld09iamVjdFByb3h5LnByb3RvdHlwZS5fZHVtcCA9IGZ1bmN0aW9uIChhc0pzb24pIHtcbiAgICB2YXIgZHVtcGVkID0ge307XG59O1xuXG5OZXdPYmplY3RQcm94eS5wcm90b3R5cGUuaW5zdGFsbCA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICBpZiAob2JqKSB7XG4gICAgICAgIGlmICghdGhpcy5vYmplY3QpIHtcbiAgICAgICAgICAgIHRoaXMub2JqZWN0ID0gb2JqO1xuICAgICAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAgICAgdmFyIG5hbWUgPSBnZXRGb3J3YXJkTmFtZS5jYWxsKHRoaXMpO1xuICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgbmFtZSwge1xuICAgICAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2VsZi5pc0ZhdWx0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gc2VsZi5mYXVsdDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzZWxmLnJlbGF0ZWQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHNldDogZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5zZXQodik7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBvYmpbICgnZ2V0JyArIHV0aWwuY2FwaXRhbGlzZUZpcnN0TGV0dGVyKG5hbWUpKV0gPSBfLmJpbmQodGhpcy5nZXQsIHRoaXMpO1xuICAgICAgICAgICAgb2JqWyAoJ3NldCcgKyB1dGlsLmNhcGl0YWxpc2VGaXJzdExldHRlcihuYW1lKSldID0gXy5iaW5kKHRoaXMuc2V0LCB0aGlzKTtcbiAgICAgICAgICAgIG9ialtuYW1lICsgJ1Byb3h5J10gPSB0aGlzO1xuICAgICAgICAgICAgaWYgKCFvYmouX3Byb3hpZXMpIHtcbiAgICAgICAgICAgICAgICBvYmouX3Byb3hpZXMgPSBbXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG9iai5fcHJveGllcy5wdXNoKHRoaXMpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFJlc3RFcnJvcignQWxyZWFkeSBpbnN0YWxsZWQuJyk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IoJ05vIG9iamVjdCBwYXNzZWQgdG8gcmVsYXRpb25zaGlwIGluc3RhbGwnKTtcbiAgICB9XG59O1xuXG5OZXdPYmplY3RQcm94eS5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24gKG9iaikge1xuICAgIHRocm93IG5ldyBSZXN0RXJyb3IoJ011c3Qgc3ViY2xhc3MgTmV3T2JqZWN0UHJveHknKTtcbn07XG5cbk5ld09iamVjdFByb3h5LnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICB0aHJvdyBuZXcgUmVzdEVycm9yKCdNdXN0IHN1YmNsYXNzIE5ld09iamVjdFByb3h5Jyk7XG59O1xuXG4vLyBUT0RPOiBTaGFyZSBjb2RlIGJldHdlZW4gZ2V0UmV2ZXJzZVByb3h5Rm9yT2JqZWN0IGFuZCBnZXRGb3J3YXJkUHJveHlGb3JPYmplY3RcblxuZnVuY3Rpb24gZ2V0UmV2ZXJzZVByb3h5Rm9yT2JqZWN0KG9iaikge1xuICAgIHZhciByZXZlcnNlTmFtZSA9IGdldFJldmVyc2VOYW1lLmNhbGwodGhpcyk7XG4gICAgdmFyIHByb3h5TmFtZSA9IChyZXZlcnNlTmFtZSArICdQcm94eScpO1xuICAgIHZhciByZXZlcnNlTWFwcGluZyA9IHRoaXMucmV2ZXJzZU1hcHBpbmc7XG4gICAgICAgIC8vIFRoaXMgc2hvdWxkIG5ldmVyIGhhcHBlbi4gU2hvdWxkIGcgICBldCBjYXVnaHQgaW4gdGhlIG1hcHBpbmcgb3BlcmF0aW9uP1xuICAgIGlmIChvYmoubWFwcGluZyAhPSByZXZlcnNlTWFwcGluZykge1xuICAgICAgICB2YXIgZXJyID0gJ01hcHBpbmcgZG9lcyBub3QgbWF0Y2guJztcbiAgICAgICAgY29uc29sZS5lcnJvcihlcnIsIHtvYmplY3Q6IG9iaiwgbWFwcGluZzogcmV2ZXJzZU1hcHBpbmd9KTtcbiAgICAgICAgdGhyb3cgbmV3IFJlc3RFcnJvcihlcnIpO1xuICAgIH1cbiAgICBpZiAodXRpbC5pc0FycmF5KG9iaikpIHtcbiAgICAgICAgcmV0dXJuIF8ucGx1Y2sob2JqLCBwcm94eU5hbWUpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdmFyIHByb3h5ID0gb2JqW3Byb3h5TmFtZV07IFxuICAgICAgICBpZiAoIXByb3h5KSB7XG4gICAgICAgICAgICB2YXIgZXJyID0gJ05vIHByb3h5IHdpdGggbmFtZSBcIicgKyBwcm94eU5hbWUgKyAnXCIgb24gbWFwcGluZyAnICsgcmV2ZXJzZU1hcHBpbmcudHlwZTtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyLCBvYmopO1xuICAgICAgICAgICAgdGhyb3cgbmV3IFJlc3RFcnJvcihlcnIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwcm94eTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGdldEZvcndhcmRQcm94eUZvck9iamVjdChvYmopIHtcbiAgICB2YXIgZm9yd2FyZE5hbWUgPSBnZXRGb3J3YXJkTmFtZS5jYWxsKHRoaXMpO1xuICAgIHZhciBwcm94eU5hbWUgPSBmb3J3YXJkTmFtZSArICdQcm94eSc7XG4gICAgdmFyIGZvcndhcmRNYXBwaW5nID0gdGhpcy5mb3J3YXJkTWFwcGluZztcbiAgICAvLyBUaGlzIHNob3VsZCBuZXZlciBoYXBwZW4uIFNob3VsZCBnZXQgY2F1Z2h0IGluIHRoZSBtYXBwaW5nIG9wZXJhdGlvbj9cbiAgICBpZiAob2JqLm1hcHBpbmcgIT0gZm9yd2FyZE1hcHBpbmcpIHtcbiAgICAgICAgdmFyIGVyciA9ICdNYXBwaW5nIGRvZXMgbm90IG1hdGNoLic7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyLCB7b2JqZWN0OiBvYmosIG1hcHBpbmc6IHJldmVyc2VNYXBwaW5nfSk7XG4gICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IoZXJyKTtcbiAgICB9XG4gICAgaWYgKHV0aWwuaXNBcnJheShvYmopKSB7XG4gICAgICAgIHJldHVybiBfLnBsdWNrKG9iaiwgcHJveHlOYW1lKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHZhciBwcm94eSA9IG9ialtwcm94eU5hbWVdO1xuICAgICAgICBpZiAoIXByb3h5KSB7XG4gICAgICAgICAgICB2YXIgZXJyID0gJ05vIHByb3h5IHdpdGggbmFtZSBcIicgKyBwcm94eU5hbWUgKyAnXCIgb24gbWFwcGluZyAnICsgZm9yd2FyZE1hcHBpbmcudHlwZTtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyLCBvYmopO1xuICAgICAgICAgICAgdGhyb3cgbmV3IFJlc3RFcnJvcihlcnIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwcm94eTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGdldFJldmVyc2VOYW1lKCkge1xuICAgIHJldHVybiB0aGlzLmlzRm9yd2FyZCA/IHRoaXMucmV2ZXJzZU5hbWUgOiB0aGlzLmZvcndhcmROYW1lO1xufVxuXG5mdW5jdGlvbiBnZXRGb3J3YXJkTmFtZSgpIHtcbiAgICByZXR1cm4gdGhpcy5pc0ZvcndhcmQgPyB0aGlzLmZvcndhcmROYW1lIDogdGhpcy5yZXZlcnNlTmFtZTtcbn1cblxuZnVuY3Rpb24gZ2V0UmV2ZXJzZU1hcHBpbmcoKSB7XG4gICAgcmV0dXJuIHRoaXMuaXNGb3J3YXJkID8gdGhpcy5yZXZlcnNlTWFwcGluZyA6IHRoaXMuZm9yd2FyZE1hcHBpbmc7XG59XG5cbmZ1bmN0aW9uIGdldEZvcndhcmRNYXBwaW5nKCkge1xuICAgIHJldHVybiB0aGlzLmlzRm9yd2FyZCA/IHRoaXMuZm9yd2FyZE1hcHBpbmcgOiB0aGlzLnJldmVyc2VNYXBwaW5nO1xufVxuXG5mdW5jdGlvbiBjaGVja0luc3RhbGxlZCgpIHtcbiAgICBpZiAoIXRoaXMub2JqZWN0KSB7XG4gICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IoJ1Byb3h5IG11c3QgYmUgaW5zdGFsbGVkIG9uIGFuIG9iamVjdCBiZWZvcmUgY2FuIHVzZSBpdC4nKTtcbiAgICB9XG59XG5cbi8qKlxuICogQ29uZmlndXJlIF9pZCBhbmQgcmVsYXRlZCB3aXRoIHRoZSBuZXcgcmVsYXRlZCBvYmplY3QuXG4gKiBAcGFyYW0gb2JqXG4gKi9cbmZ1bmN0aW9uIHNldChvYmopIHtcbiAgICByZWdpc3RlclNldENoYW5nZS5jYWxsKHRoaXMsIG9iaik7XG4gICAgaWYgKG9iaikge1xuICAgICAgICBpZiAodXRpbC5pc0FycmF5KG9iaikpIHtcbiAgICAgICAgICAgIHRoaXMuX2lkID0gXy5wbHVjayhvYmosICdfaWQnKTtcbiAgICAgICAgICAgIHRoaXMucmVsYXRlZCA9IG9iajtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2lkID0gb2JqLl9pZDtcbiAgICAgICAgICAgIHRoaXMucmVsYXRlZCA9IG9iajtcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdGhpcy5faWQgPSBudWxsO1xuICAgICAgICB0aGlzLnJlbGF0ZWQgPSBudWxsO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gc3BsaWNlKGlkeCwgbnVtUmVtb3ZlKSB7XG4gICAgcmVnaXN0ZXJTcGxpY2VDaGFuZ2UuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB2YXIgYWRkID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICB2YXIgcmV0dXJuVmFsdWUgPSBfLnBhcnRpYWwodGhpcy5faWQuc3BsaWNlLCBpZHgsIG51bVJlbW92ZSkuYXBwbHkodGhpcy5faWQsIF8ucGx1Y2soYWRkLCAnX2lkJykpO1xuICAgIGlmICh0aGlzLnJlbGF0ZWQpIHtcbiAgICAgICAgXy5wYXJ0aWFsKHRoaXMucmVsYXRlZC5zcGxpY2UsIGlkeCwgbnVtUmVtb3ZlKS5hcHBseSh0aGlzLnJlbGF0ZWQsIGFkZCk7XG4gICAgfVxuICAgIHJldHVybiByZXR1cm5WYWx1ZTtcbn1cblxuZnVuY3Rpb24gb2JqQXNTdHJpbmcob2JqKSB7XG4gICAgZnVuY3Rpb24gX29iakFzU3RyaW5nKG9iaikge1xuICAgICAgICBpZiAob2JqKSB7XG4gICAgICAgICAgICB2YXIgbWFwcGluZyA9IG9iai5tYXBwaW5nO1xuICAgICAgICAgICAgdmFyIG1hcHBpbmdOYW1lID0gbWFwcGluZy50eXBlO1xuICAgICAgICAgICAgdmFyIGlkZW50ID0gb2JqLl9pZDtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgaWRlbnQgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICBpZGVudCA9ICdcIicgKyBpZGVudCArICdcIic7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbWFwcGluZ05hbWUgKyAnW19pZD0nICsgaWRlbnQgKyAnXSc7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAob2JqID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybiAndW5kZWZpbmVkJztcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChvYmogPT09IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybiAnbnVsbCc7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodXRpbC5pc0FycmF5KG9iaikpIHJldHVybiBfLm1hcChfb2JqQXNTdHJpbmcsIG9iaikuam9pbignLCAnKTtcbiAgICByZXR1cm4gX29iakFzU3RyaW5nKG9iaik7XG59XG5cbmZ1bmN0aW9uIGNsZWFyUmV2ZXJzZVJlbGF0ZWQoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICghc2VsZi5pc0ZhdWx0KSB7XG4gICAgICAgIGlmICh0aGlzLnJlbGF0ZWQpIHtcbiAgICAgICAgICAgIHZhciByZXZlcnNlUHJveHkgPSBnZXRSZXZlcnNlUHJveHlGb3JPYmplY3QuY2FsbCh0aGlzLCB0aGlzLnJlbGF0ZWQpO1xuICAgICAgICAgICAgdmFyIHJldmVyc2VQcm94aWVzID0gdXRpbC5pc0FycmF5KHJldmVyc2VQcm94eSkgPyByZXZlcnNlUHJveHkgOiBbcmV2ZXJzZVByb3h5XTtcbiAgICAgICAgICAgIF8uZWFjaChyZXZlcnNlUHJveGllcywgZnVuY3Rpb24gKHApIHtcbiAgICAgICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KHAuX2lkKSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgaWR4ID0gcC5faWQuaW5kZXhPZihzZWxmLm9iamVjdC5faWQpO1xuICAgICAgICAgICAgICAgICAgICBtYWtlQ2hhbmdlc1RvUmVsYXRlZFdpdGhvdXRPYnNlcnZhdGlvbnMuY2FsbChwLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzcGxpY2UuY2FsbChwLCBpZHgsIDEpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHNldC5jYWxsKHAsIG51bGwpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBpZiAoc2VsZi5faWQpIHtcbiAgICAgICAgICAgIHZhciByZXZlcnNlTmFtZSA9IGdldFJldmVyc2VOYW1lLmNhbGwodGhpcyk7XG4gICAgICAgICAgICB2YXIgcmV2ZXJzZU1hcHBpbmcgPSBnZXRSZXZlcnNlTWFwcGluZy5jYWxsKHRoaXMpO1xuICAgICAgICAgICAgdmFyIGlkZW50aWZpZXJzID0gdXRpbC5pc0FycmF5KHNlbGYuX2lkKSA/IHNlbGYuX2lkIDogW3NlbGYuX2lkXTtcbiAgICAgICAgICAgIGlmICh0aGlzLl9yZXZlcnNlSXNBcnJheSkge1xuICAgICAgICAgICAgICAgIF8uZWFjaChpZGVudGlmaWVycywgZnVuY3Rpb24gKF9pZCkge1xuICAgICAgICAgICAgICAgICAgICBjb3JlQ2hhbmdlcy5yZWdpc3RlckNoYW5nZSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiByZXZlcnNlTWFwcGluZy5jb2xsZWN0aW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWFwcGluZzogcmV2ZXJzZU1hcHBpbmcudHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIF9pZDogX2lkLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmllbGQ6IHJldmVyc2VOYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlZElkOiBbc2VsZi5vYmplY3QuX2lkXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZWQ6IFtzZWxmLm9iamVjdF0sXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBDaGFuZ2VUeXBlLlJlbW92ZVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIF8uZWFjaChpZGVudGlmaWVycywgZnVuY3Rpb24gKF9pZCkge1xuICAgICAgICAgICAgICAgICAgICBjb3JlQ2hhbmdlcy5yZWdpc3RlckNoYW5nZSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiByZXZlcnNlTWFwcGluZy5jb2xsZWN0aW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWFwcGluZzogcmV2ZXJzZU1hcHBpbmcudHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIF9pZDogX2lkLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmllbGQ6IHJldmVyc2VOYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgbmV3OiBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgbmV3SWQ6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBvbGRJZDogc2VsZi5vYmplY3QuX2lkLFxuICAgICAgICAgICAgICAgICAgICAgICAgb2xkOiBzZWxmLm9iamVjdCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IENoYW5nZVR5cGUuU2V0XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoZ2V0Rm9yd2FyZE5hbWUuY2FsbCh0aGlzKSArICcgaGFzIG5vIF9pZCcpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiBtYWtlQ2hhbmdlc1RvUmVsYXRlZFdpdGhvdXRPYnNlcnZhdGlvbnMoZikge1xuICAgIGlmICh0aGlzLnJlbGF0ZWQpIHtcbiAgICAgICAgdGhpcy5yZWxhdGVkLm9uZVRvTWFueU9ic2VydmVyLmNsb3NlKCk7XG4gICAgICAgIHRoaXMucmVsYXRlZC5vbmVUb01hbnlPYnNlcnZlciA9IG51bGw7XG4gICAgICAgIGYoKTtcbiAgICAgICAgd3JhcEFycmF5LmNhbGwodGhpcywgdGhpcy5yZWxhdGVkKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIC8vIElmIHRoZXJlJ3MgYSBmYXVsdCB3ZSBjYW4gbWFrZSBjaGFuZ2VzIGFueXdheS5cbiAgICAgICAgZigpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gc2V0UmV2ZXJzZShvYmopIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHJldmVyc2VQcm94eSA9IGdldFJldmVyc2VQcm94eUZvck9iamVjdC5jYWxsKHRoaXMsIG9iaik7XG4gICAgdmFyIHJldmVyc2VQcm94aWVzID0gdXRpbC5pc0FycmF5KHJldmVyc2VQcm94eSkgPyByZXZlcnNlUHJveHkgOiBbcmV2ZXJzZVByb3h5XTtcbiAgICBfLmVhY2gocmV2ZXJzZVByb3hpZXMsIGZ1bmN0aW9uIChwKSB7XG4gICAgICAgIGlmICh1dGlsLmlzQXJyYXkocC5faWQpKSB7XG4gICAgICAgICAgICBtYWtlQ2hhbmdlc1RvUmVsYXRlZFdpdGhvdXRPYnNlcnZhdGlvbnMuY2FsbChwLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgc3BsaWNlLmNhbGwocCwgcC5faWQubGVuZ3RoLCAwLCBzZWxmLm9iamVjdCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNsZWFyUmV2ZXJzZVJlbGF0ZWQuY2FsbChwKTtcbiAgICAgICAgICAgIHNldC5jYWxsKHAsIHNlbGYub2JqZWN0KTtcbiAgICAgICAgfVxuICAgIH0pO1xufVxuXG5mdW5jdGlvbiByZWdpc3RlclNldENoYW5nZShvYmopIHtcbiAgICB2YXIgcHJveHlPYmplY3QgPSB0aGlzLm9iamVjdDtcbiAgICBpZiAoIXByb3h5T2JqZWN0KSB0aHJvdyBuZXcgUmVzdEVycm9yKCdQcm94eSBtdXN0IGhhdmUgYW4gb2JqZWN0IGFzc29jaWF0ZWQnKTtcbiAgICB2YXIgbWFwcGluZyA9IHByb3h5T2JqZWN0Lm1hcHBpbmcudHlwZTtcbiAgICB2YXIgY29sbCA9IHByb3h5T2JqZWN0LmNvbGxlY3Rpb247XG4gICAgdmFyIG5ld0lkO1xuICAgIGlmICh1dGlsLmlzQXJyYXkob2JqKSkge1xuICAgICAgICBuZXdJZCA9IF8ucGx1Y2sob2JqLCAnX2lkJyk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBuZXdJZCA9IG9iaiA/IG9iai5faWQgOiBvYmo7XG4gICAgfVxuICAgIC8vIFdlIHRha2UgW10gPT0gbnVsbCA9PSB1bmRlZmluZWQgaW4gdGhlIGNhc2Ugb2YgcmVsYXRpb25zaGlwcy5cbiAgICB2YXIgb2xkSWQgPSB0aGlzLl9pZDtcbiAgICBpZiAodXRpbC5pc0FycmF5KG9sZElkKSAmJiAhb2xkSWQubGVuZ3RoKSB7XG4gICAgICAgIG9sZElkID0gbnVsbDtcbiAgICB9XG4gICAgdmFyIG9sZCA9IHRoaXMucmVsYXRlZDtcbiAgICBpZiAodXRpbC5pc0FycmF5KG9sZCkgJiYgIW9sZC5sZW5ndGgpIHtcbiAgICAgICAgb2xkID0gbnVsbDtcbiAgICB9XG4gICAgY29yZUNoYW5nZXMucmVnaXN0ZXJDaGFuZ2Uoe1xuICAgICAgICBjb2xsZWN0aW9uOiBjb2xsLFxuICAgICAgICBtYXBwaW5nOiBtYXBwaW5nLFxuICAgICAgICBfaWQ6IHByb3h5T2JqZWN0Ll9pZCxcbiAgICAgICAgZmllbGQ6IGdldEZvcndhcmROYW1lLmNhbGwodGhpcyksXG4gICAgICAgIG5ld0lkOiBuZXdJZCxcbiAgICAgICAgb2xkSWQ6IG9sZElkLFxuICAgICAgICBvbGQ6IG9sZCxcbiAgICAgICAgbmV3OiBvYmosXG4gICAgICAgIHR5cGU6IENoYW5nZVR5cGUuU2V0XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIHJlZ2lzdGVyU3BsaWNlQ2hhbmdlKGlkeCwgbnVtUmVtb3ZlKSB7XG4gICAgdmFyIGFkZCA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgdmFyIG1hcHBpbmcgPSB0aGlzLm9iamVjdC5tYXBwaW5nLnR5cGU7XG4gICAgdmFyIGNvbGwgPSB0aGlzLm9iamVjdC5jb2xsZWN0aW9uO1xuICAgIGNvcmVDaGFuZ2VzLnJlZ2lzdGVyQ2hhbmdlKHtcbiAgICAgICAgY29sbGVjdGlvbjogY29sbCxcbiAgICAgICAgbWFwcGluZzogbWFwcGluZyxcbiAgICAgICAgX2lkOiB0aGlzLm9iamVjdC5faWQsXG4gICAgICAgIGZpZWxkOiBnZXRGb3J3YXJkTmFtZS5jYWxsKHRoaXMpLFxuICAgICAgICBpbmRleDogaWR4LFxuICAgICAgICByZW1vdmVkSWQ6IHRoaXMuX2lkLnNsaWNlKGlkeCwgaWR4ICsgbnVtUmVtb3ZlKSxcbiAgICAgICAgcmVtb3ZlZDogdGhpcy5yZWxhdGVkID8gdGhpcy5yZWxhdGVkLnNsaWNlKGlkeCwgaWR4ICsgbnVtUmVtb3ZlKSA6IG51bGwsXG4gICAgICAgIGFkZGVkSWQ6IGFkZC5sZW5ndGggPyBfLnBsdWNrKGFkZCwgJ19pZCcpIDogW10sXG4gICAgICAgIGFkZGVkOiBhZGQubGVuZ3RoID8gYWRkIDogW10sXG4gICAgICAgIHR5cGU6IENoYW5nZVR5cGUuU3BsaWNlXG4gICAgfSk7XG59XG5cblxuZnVuY3Rpb24gd3JhcEFycmF5KGFycikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzKGFyciwgdGhpcy5yZXZlcnNlTmFtZSwgdGhpcy5vYmplY3QpO1xuICAgIGlmICghYXJyLm9uZVRvTWFueU9ic2VydmVyKSB7XG4gICAgICAgIGFyci5vbmVUb01hbnlPYnNlcnZlciA9IG5ldyBBcnJheU9ic2VydmVyKGFycik7XG4gICAgICAgIHZhciBvYnNlcnZlckZ1bmN0aW9uID0gZnVuY3Rpb24gKHNwbGljZXMpIHtcbiAgICAgICAgICAgIHNwbGljZXMuZm9yRWFjaChmdW5jdGlvbiAoc3BsaWNlKSB7XG4gICAgICAgICAgICAgICAgdmFyIGFkZGVkID0gc3BsaWNlLmFkZGVkQ291bnQgPyBhcnIuc2xpY2Uoc3BsaWNlLmluZGV4LCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCkgOiBbXTtcbiAgICAgICAgICAgICAgICB2YXIgbWFwcGluZyA9IGdldEZvcndhcmRNYXBwaW5nLmNhbGwoc2VsZik7XG4gICAgICAgICAgICAgICAgY29yZUNoYW5nZXMucmVnaXN0ZXJDaGFuZ2Uoe1xuICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBtYXBwaW5nLmNvbGxlY3Rpb24sXG4gICAgICAgICAgICAgICAgICAgIG1hcHBpbmc6IG1hcHBpbmcsXG4gICAgICAgICAgICAgICAgICAgIF9pZDogc2VsZi5vYmplY3QuX2lkLFxuICAgICAgICAgICAgICAgICAgICBmaWVsZDogZ2V0Rm9yd2FyZE5hbWUuY2FsbChzZWxmKSxcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlZDogc3BsaWNlLnJlbW92ZWQsXG4gICAgICAgICAgICAgICAgICAgIGFkZGVkOiBhZGRlZCxcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlZElkOiBfLnBsdWNrKHNwbGljZS5yZW1vdmVkLCAnX2lkJyksXG4gICAgICAgICAgICAgICAgICAgIGFkZGVkSWQ6IF8ucGx1Y2soc3BsaWNlLmFkZGVkLCAnX2lkJyksXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IENoYW5nZVR5cGUuU3BsaWNlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICAgICAgYXJyLm9uZVRvTWFueU9ic2VydmVyLm9wZW4ob2JzZXJ2ZXJGdW5jdGlvbik7XG4gICAgfVxufVxuXG5leHBvcnRzLk5ld09iamVjdFByb3h5ID0gTmV3T2JqZWN0UHJveHk7XG5leHBvcnRzLkZhdWx0ID0gRmF1bHQ7XG5leHBvcnRzLmdldFJldmVyc2VQcm94eUZvck9iamVjdCA9IGdldFJldmVyc2VQcm94eUZvck9iamVjdDtcbmV4cG9ydHMuZ2V0Rm9yd2FyZFByb3h5Rm9yT2JqZWN0ID0gZ2V0Rm9yd2FyZFByb3h5Rm9yT2JqZWN0O1xuZXhwb3J0cy5nZXRSZXZlcnNlTmFtZSA9IGdldFJldmVyc2VOYW1lO1xuZXhwb3J0cy5nZXRGb3J3YXJkTmFtZSA9IGdldEZvcndhcmROYW1lO1xuZXhwb3J0cy5nZXRSZXZlcnNlTWFwcGluZyA9IGdldFJldmVyc2VNYXBwaW5nO1xuZXhwb3J0cy5nZXRGb3J3YXJkTWFwcGluZyA9IGdldEZvcndhcmRNYXBwaW5nO1xuZXhwb3J0cy5jaGVja0luc3RhbGxlZCA9IGNoZWNrSW5zdGFsbGVkO1xuZXhwb3J0cy5zZXQgPSBzZXQ7XG5leHBvcnRzLnJlZ2lzdGVyU2V0Q2hhbmdlID0gcmVnaXN0ZXJTZXRDaGFuZ2U7XG5leHBvcnRzLnNwbGljZSA9IHNwbGljZTtcbmV4cG9ydHMuY2xlYXJSZXZlcnNlUmVsYXRlZCA9IGNsZWFyUmV2ZXJzZVJlbGF0ZWQ7XG5leHBvcnRzLnNldFJldmVyc2UgPSBzZXRSZXZlcnNlO1xuZXhwb3J0cy5vYmpBc1N0cmluZyA9IG9iakFzU3RyaW5nO1xuZXhwb3J0cy53cmFwQXJyYXkgPSB3cmFwQXJyYXk7XG5leHBvcnRzLnJlZ2lzdGVyU3BsaWNlQ2hhbmdlID0gcmVnaXN0ZXJTcGxpY2VDaGFuZ2U7XG5leHBvcnRzLm1ha2VDaGFuZ2VzVG9SZWxhdGVkV2l0aG91dE9ic2VydmF0aW9ucyA9IG1ha2VDaGFuZ2VzVG9SZWxhdGVkV2l0aG91dE9ic2VydmF0aW9uczsiLCJ2YXIgbG9nID0gcmVxdWlyZSgnLi4vdmVuZG9yL29wZXJhdGlvbnMuanMvc3JjL2xvZycpO1xudmFyIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpO1xudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnUXVlcnknKTtcbnZhciBxID0gcmVxdWlyZSgncScpO1xudmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcbkxvZ2dlci5zZXRMZXZlbChsb2cuTGV2ZWwud2Fybik7XG5cbmZ1bmN0aW9uIFF1ZXJ5KG1hcHBpbmcsIHF1ZXJ5KSB7XG4gICAgdGhpcy5tYXBwaW5nID0gbWFwcGluZztcbiAgICB0aGlzLnF1ZXJ5ID0gcXVlcnk7XG59XG5cbi8qKlxuICogSWYgdGhlIHN0b3JhZ2UgZXh0ZW5zaW9uIGlzIGVuYWJsZWQsIG9iamVjdHMgbWF5IGJlIGZhdWx0ZWQgYW5kIHNvIHdlIG5lZWQgdG8gcXVlcnkgdmlhIFBvdWNoREIuIFRoZSBzdG9yYWdlXG4gKiBleHRlbnNpb24gcHJvdmlkZXMgdGhlIFJhd1F1ZXJ5IGNsYXNzIHRvIGVuYWJsZSB0aGlzLlxuICogQHBhcmFtIGNhbGxiYWNrXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfZXhlY3V0ZVVzaW5nU3RvcmFnZUV4dGVuc2lvbihjYWxsYmFjaykge1xuICAgIHZhciBkZWZlcnJlZCA9IHEuZGVmZXIoKTtcbiAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgIHZhciBzdG9yYWdlRXh0ZW5zaW9uID0gc2llc3RhLmV4dC5zdG9yYWdlO1xuICAgIHZhciBSYXdRdWVyeSA9IHN0b3JhZ2VFeHRlbnNpb24uUmF3UXVlcnk7XG4gICAgdmFyIFBvdWNoID0gc3RvcmFnZUV4dGVuc2lvbi5Qb3VjaDtcbiAgICB2YXIgcmF3UXVlcnkgPSBuZXcgUmF3UXVlcnkodGhpcy5tYXBwaW5nLmNvbGxlY3Rpb24sIHRoaXMubWFwcGluZy50eXBlLCB0aGlzLnF1ZXJ5KTtcbiAgICByYXdRdWVyeS5leGVjdXRlKGZ1bmN0aW9uIChlcnIsIHJlc3VsdHMpIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnZ290IHJlc3VsdHMnLCByZXN1bHRzKTtcbiAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobnVsbCwgUG91Y2gudG9TaWVzdGEocmVzdWx0cykpO1xuICAgICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59XG5cbi8qKlxuICogUmV0dXJucyB0cnVlIGlmIHRoZSBnaXZlbiBvYmplY3QgbWF0Y2hlcyB0aGUgcXVlcnkuXG4gKiBAcGFyYW0ge1NpZXN0YU1vZGVsfSBvYmpcbiAqIEByZXR1cm5zIHtib29sZWFufVxuICovXG5mdW5jdGlvbiBvYmplY3RNYXRjaGVzUXVlcnkob2JqKSB7XG4gICAgdmFyIGZpZWxkcyA9IE9iamVjdC5rZXlzKHRoaXMucXVlcnkpO1xuICAgIGZvciAodmFyIGk9MDsgaTxmaWVsZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGZpZWxkID0gZmllbGRzW2ldO1xuICAgICAgIGlmIChvYmpbZmllbGRdICE9IHRoaXMucXVlcnlbZmllbGRdKSB7XG4gICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xufVxuXG4vKipcbiAqIElmIHRoZSBzdG9yYWdlIGV4dGVuc2lvbiBpcyBub3QgZW5hYmxlZCwgd2Ugc2ltcGx5IGN5Y2xlIHRocm91Z2ggYWxsIG9iamVjdHMgb2YgdGhlIHR5cGUgcmVxdWVzdGVkIGluIG1lbW9yeS5cbiAqIEBwYXJhbSBjYWxsYmFja1xuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX2V4ZWN1dGVJbk1lbW9yeShjYWxsYmFjaykge1xuICAgIHZhciBkZWZlcnJlZCA9IHEuZGVmZXIoKTtcbiAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgIHZhciBjYWNoZUJ5VHlwZSA9IGNhY2hlLl9sb2NhbENhY2hlQnlUeXBlO1xuICAgIHZhciBtYXBwaW5nTmFtZSA9IHRoaXMubWFwcGluZy50eXBlO1xuICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IHRoaXMubWFwcGluZy5jb2xsZWN0aW9uO1xuICAgIHZhciBjYWNoZUJ5TWFwcGluZyA9IGNhY2hlQnlUeXBlW2NvbGxlY3Rpb25OYW1lXTtcbiAgICB2YXIgY2FjaGVCeUxvY2FsSWQ7XG4gICAgaWYgKGNhY2hlQnlNYXBwaW5nKSB7XG4gICAgICAgIGNhY2hlQnlMb2NhbElkID0gY2FjaGVCeU1hcHBpbmdbbWFwcGluZ05hbWVdO1xuICAgIH1cbiAgICBpZiAoY2FjaGVCeUxvY2FsSWQpIHtcbiAgICAgICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhjYWNoZUJ5TG9jYWxJZCk7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgdmFyIG1hdGNoZXMgPSBfLnJlZHVjZShrZXlzLCBmdW5jdGlvbiAobWVtbywgaykge1xuICAgICAgICAgICAgdmFyIG9iaiA9IGNhY2hlQnlMb2NhbElkW2tdO1xuICAgICAgICAgICAgaWYgKG9iamVjdE1hdGNoZXNRdWVyeS5jYWxsKHNlbGYsIG9iaikpIG1lbW8ucHVzaChvYmopO1xuICAgICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgIH0sIFtdKTtcbiAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhudWxsLCBtYXRjaGVzKTtcbiAgICB9XG4gICAgZWxzZSBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgW10pO1xuICAgIH1cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn1cblxuUXVlcnkucHJvdG90eXBlLmV4ZWN1dGUgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICB2YXIgZGVmZXJyZWQgPSBxLmRlZmVyKCk7XG4gICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICBpZiAoc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCkge1xuICAgICAgICBfZXhlY3V0ZVVzaW5nU3RvcmFnZUV4dGVuc2lvbi5jYWxsKHRoaXMsIGNhbGxiYWNrKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIF9leGVjdXRlSW5NZW1vcnkuY2FsbCh0aGlzLCBjYWxsYmFjayk7XG4gICAgfVxuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufTtcblxuUXVlcnkucHJvdG90eXBlLl9kdW1wID0gZnVuY3Rpb24gKGFzSnNvbikge1xuICAgIC8vIFRPRE9cbiAgICByZXR1cm4gYXNKc29uID8gJ3t9JyA6IHt9O1xufTtcblxuZXhwb3J0cy5RdWVyeSA9IFF1ZXJ5O1xuXG5cbiIsInZhciBSZXN0RXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuUmVzdEVycm9yO1xudmFyIFN0b3JlID0gcmVxdWlyZSgnLi9zdG9yZScpO1xudmFyIHEgPSByZXF1aXJlKCdxJyk7XG5cblxuUmVsYXRpb25zaGlwVHlwZSA9IHtcbiAgICBPbmVUb01hbnk6ICdPbmVUb01hbnknLFxuICAgIE9uZVRvT25lOiAnT25lVG9PbmUnLFxuICAgIE1hbnlUb01hbnk6ICdNYW55VG9NYW55J1xufTtcblxuZnVuY3Rpb24gUmVsYXRlZE9iamVjdFByb3h5KHJlbGF0aW9uc2hpcCwgb2JqZWN0KSB7XG4gICAgdGhpcy5yZWxhdGlvbnNoaXAgPSByZWxhdGlvbnNoaXA7XG4gICAgdGhpcy5vYmplY3QgPSBvYmplY3Q7XG4gICAgdGhpcy5faWQgPSBudWxsO1xuICAgIHRoaXMucmVsYXRlZE9iamVjdCA9IG51bGw7XG59XG5cblJlbGF0ZWRPYmplY3RQcm94eS5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgdmFyIGRlZmVycmVkID0gcS5kZWZlcigpO1xuICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHRoaXMucmVsYXRpb25zaGlwLmdldFJlbGF0ZWQodGhpcy5vYmplY3QsIGZ1bmN0aW9uIChlcnIsIHJlbGF0ZWQpIHtcbiAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgIHNlbGYucmVsYXRlZE9iamVjdCA9IHJlbGF0ZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIsIHJlbGF0ZWQpO1xuICAgIH0pO1xuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufTtcblxuUmVsYXRlZE9iamVjdFByb3h5LnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiAob2JqLCBjYWxsYmFjaykge1xuICAgIHZhciBkZWZlcnJlZCA9IHEuZGVmZXIoKTtcbiAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgIHRoaXMucmVsYXRpb25zaGlwLnNldFJlbGF0ZWQodGhpcy5vYmplY3QsIG9iaiwgY2FsbGJhY2spO1xuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufTtcblxuUmVsYXRlZE9iamVjdFByb3h5LnByb3RvdHlwZS5yZW1vdmUgPSBmdW5jdGlvbiAob2JqLCBjYWxsYmFjaykge1xuICAgIHZhciBkZWZlcnJlZCA9IHEuZGVmZXIoKTtcbiAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgIHRoaXMucmVsYXRpb25zaGlwLnJlbW92ZVJlbGF0ZWQodGhpcy5vYmplY3QsIG9iaiwgY2FsbGJhY2spO1xuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufTtcblxuUmVsYXRlZE9iamVjdFByb3h5LnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiAob2JqLCBjYWxsYmFjaykge1xuICAgIHZhciBkZWZlcnJlZCA9IHEuZGVmZXIoKTtcbiAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgIHRoaXMucmVsYXRpb25zaGlwLmFkZFJlbGF0ZWQodGhpcy5vYmplY3QsIG9iaiwgY2FsbGJhY2spO1xuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufTtcblxuUmVsYXRlZE9iamVjdFByb3h5LnByb3RvdHlwZS5pc0ZhdWx0ID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLl9pZCkge1xuICAgICAgICByZXR1cm4gIXRoaXMucmVsYXRlZE9iamVjdDtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlOyAvLyBJZiBubyBvYmplY3QgaXMgcmVsYXRlZCB0aGVuIGltcGxpY2l0bHkgdGhpcyBpcyBub3QgYSBmYXVsdC5cbn07XG5cblxuZnVuY3Rpb24gUmVsYXRpb25zaGlwKG5hbWUsIHJldmVyc2VOYW1lLCBtYXBwaW5nLCByZXZlcnNlTWFwcGluZykge1xuICAgIGlmICghdGhpcykge1xuICAgICAgICByZXR1cm4gbmV3IFJlbGF0aW9uc2hpcChuYW1lLCByZXZlcnNlTmFtZSwgbWFwcGluZywgcmV2ZXJzZU1hcHBpbmcpO1xuICAgIH1cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdGhpcy5tYXBwaW5nID0gbWFwcGluZztcbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgIHRoaXMuX3JldmVyc2VOYW1lID0gcmV2ZXJzZU5hbWU7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdyZXZlcnNlTmFtZScsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoc2VsZi5fcmV2ZXJzZU5hbWUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc2VsZi5fcmV2ZXJzZU5hbWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJ3JldmVyc2VfJyArIHNlbGYubmFtZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIHRoaXMucmV2ZXJzZU1hcHBpbmcgPSByZXZlcnNlTWFwcGluZztcbn1cblxuLy9ub2luc3BlY3Rpb24gSlNVbnVzZWRMb2NhbFN5bWJvbHNcblJlbGF0aW9uc2hpcC5wcm90b3R5cGUuZ2V0UmVsYXRlZCA9IGZ1bmN0aW9uIChvYmosIGNhbGxiYWNrKSB7XG4gICAgdGhyb3cgRXJyb3IoJ1JlbGF0aW9uc2hpcC5nZXRSZWxhdGVkIG11c3QgYmUgb3ZlcnJpZGRlbicpO1xufTtcblxuLy9ub2luc3BlY3Rpb24gSlNVbnVzZWRMb2NhbFN5bWJvbHNcblJlbGF0aW9uc2hpcC5wcm90b3R5cGUuc2V0UmVsYXRlZCA9IGZ1bmN0aW9uIChvYmosIHJlbGF0ZWQsIGNhbGxiYWNrKSB7XG4gICAgdGhyb3cgRXJyb3IoJ1JlbGF0aW9uc2hpcC5zZXRSZWxhdGVkIG11c3QgYmUgb3ZlcnJpZGRlbicpO1xufTtcblxuUmVsYXRpb25zaGlwLnByb3RvdHlwZS5pc0ZvcndhcmQgPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgcmV0dXJuIG9iai5tYXBwaW5nID09PSB0aGlzLm1hcHBpbmc7XG59O1xuXG5SZWxhdGlvbnNoaXAucHJvdG90eXBlLmlzUmV2ZXJzZSA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICByZXR1cm4gb2JqLm1hcHBpbmcgPT09IHRoaXMucmV2ZXJzZU1hcHBpbmc7XG59O1xuXG5SZWxhdGlvbnNoaXAucHJvdG90eXBlLmNvbnRyaWJ1dGVUb1NpZXN0YU1vZGVsID0gZnVuY3Rpb24gKG9iaikge1xuICAgIGlmICh0aGlzLmlzRm9yd2FyZChvYmopKSB7XG4gICAgICAgIG9ialt0aGlzLm5hbWVdID0gbmV3IFJlbGF0ZWRPYmplY3RQcm94eSh0aGlzLCBvYmopO1xuICAgIH1cbiAgICBlbHNlIGlmICh0aGlzLmlzUmV2ZXJzZShvYmopKSB7XG4gICAgICAgIG9ialt0aGlzLnJldmVyc2VOYW1lXSA9IG5ldyBSZWxhdGVkT2JqZWN0UHJveHkodGhpcywgb2JqKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IoJ0Nhbm5vdCBjb250cmlidXRlIHRvIG9iamVjdCBhcyB0aGlzIHJlbGF0aW9uc2hpcCBoYXMgbmVpdGhlciBhIGZvcndhcmQgb3IgcmV2ZXJzZSBtYXBwaW5nIHRoYXQgbWF0Y2hlcycsIHtyZWxhdGlvbnNoaXA6IHRoaXMsIG9iajogb2JqfSk7XG4gICAgfVxufTtcblxuUmVsYXRpb25zaGlwLnByb3RvdHlwZS5zZXRSZWxhdGVkQnlJZCA9IGZ1bmN0aW9uIChvYmosIHJlbGF0ZWRJZCwgY2FsbGJhY2spIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGRlZmVycmVkID0gcS5kZWZlcigpO1xuICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgU3RvcmUuZ2V0KHtfaWQ6IHJlbGF0ZWRJZH0sIGZ1bmN0aW9uIChlcnIsIHJlbGF0ZWQpIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHNlbGYuc2V0UmVsYXRlZChvYmosIHJlbGF0ZWQsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufTtcblxuUmVsYXRpb25zaGlwLnByb3RvdHlwZS5fZHVtcCA9IGZ1bmN0aW9uIChhc0pTT04pIHtcbiAgICB2YXIgb2JqID0ge307XG4gICAgb2JqLmZvcndhcmQgPSB7XG4gICAgICAgIG5hbWU6IHRoaXMubmFtZSxcbiAgICAgICAgbWFwcGluZzogdGhpcy5tYXBwaW5nLnR5cGVcbiAgICB9O1xuICAgIG9iai5yZXZlcnNlID0ge1xuICAgICAgICBuYW1lOiB0aGlzLnJldmVyc2VOYW1lLFxuICAgICAgICBtYXBwaW5nOiB0aGlzLnJldmVyc2VNYXBwaW5nLnR5cGVcbiAgICB9O1xuICAgIHJldHVybiBhc0pTT04gPyBKU09OLnN0cmluZ2lmeShvYmosIG51bGwsIDQpIDogb2JqO1xufTtcblxuXG5leHBvcnRzLlJlbGF0aW9uc2hpcCA9IFJlbGF0aW9uc2hpcDtcbmV4cG9ydHMuUmVsYXRlZE9iamVjdFByb3h5ID0gUmVsYXRlZE9iamVjdFByb3h5O1xuZXhwb3J0cy5SZWxhdGlvbnNoaXBUeXBlID0gUmVsYXRpb25zaGlwVHlwZTsiLCJ2YXIgd3JhcHBlZENhbGxiYWNrID0gcmVxdWlyZSgnLi9taXNjJykud3JhcHBlZENhbGxiYWNrO1xudmFyIFJlc3RFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5SZXN0RXJyb3I7XG52YXIgbG9nID0gcmVxdWlyZSgnLi4vdmVuZG9yL29wZXJhdGlvbnMuanMvc3JjL2xvZycpO1xudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnU3RvcmUnKTtcbkxvZ2dlci5zZXRMZXZlbChsb2cuTGV2ZWwud2Fybik7XG5cbnZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XG52YXIgXyA9IHV0aWwuXztcbnZhciBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKTtcbnZhciBxID0gcmVxdWlyZSgncScpO1xuXG5cbmZ1bmN0aW9uIGdldChvcHRzLCBjYWxsYmFjaykge1xuICAgIHZhciBkZWZlcnJlZCA9IHEuZGVmZXIoKTtcbiAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICBMb2dnZXIuZGVidWcoJ2dldCcsIG9wdHMpO1xuICAgIHZhciBzaWVzdGFNb2RlbDtcbiAgICBpZiAob3B0cy5faWQpIHtcbiAgICAgICAgaWYgKHV0aWwuaXNBcnJheShvcHRzLl9pZCkpIHtcbiAgICAgICAgICAgIC8vIFByb3h5IG9udG8gZ2V0TXVsdGlwbGUgaW5zdGVhZC5cbiAgICAgICAgICAgIGdldE11bHRpcGxlKF8ubWFwKG9wdHMuX2lkLCBmdW5jdGlvbiAoaWQpIHtyZXR1cm4ge19pZDogaWR9fSksIGNhbGxiYWNrKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHNpZXN0YU1vZGVsID0gY2FjaGUuZ2V0KG9wdHMpO1xuICAgICAgICAgICAgaWYgKHNpZXN0YU1vZGVsKSB7XG4gICAgICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnSGFkIGNhY2hlZCBvYmplY3QnLCB7b3B0czogb3B0cywgb2JqOiBzaWVzdGFNb2RlbH0pO1xuICAgICAgICAgICAgICAgIHdyYXBwZWRDYWxsYmFjayhjYWxsYmFjaykobnVsbCwgc2llc3RhTW9kZWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheShvcHRzLl9pZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gUHJveHkgb250byBnZXRNdWx0aXBsZSBpbnN0ZWFkLlxuICAgICAgICAgICAgICAgICAgICBnZXRNdWx0aXBsZShfLm1hcChvcHRzLl9pZCwgZnVuY3Rpb24gKGlkKSB7cmV0dXJuIHtfaWQ6IGlkfX0pLCBjYWxsYmFjayk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzdG9yYWdlID0gc2llc3RhLmV4dC5zdG9yYWdlO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc3RvcmFnZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RvcmFnZS5zdG9yZS5nZXRGcm9tUG91Y2gob3B0cywgY2FsbGJhY2spO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgJ1N0b3JhZ2UgbW9kdWxlIG5vdCBpbnN0YWxsZWQnXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSBpZiAob3B0cy5tYXBwaW5nKSB7XG4gICAgICAgIGlmICh1dGlsLmlzQXJyYXkob3B0c1tvcHRzLm1hcHBpbmcuaWRdKSkge1xuICAgICAgICAgICAgLy8gUHJveHkgb250byBnZXRNdWx0aXBsZSBpbnN0ZWFkLlxuICAgICAgICAgICAgZ2V0TXVsdGlwbGUoXy5tYXAob3B0c1tvcHRzLm1hcHBpbmcuaWRdLCBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgICAgICAgICB2YXIgbyA9IHt9O1xuICAgICAgICAgICAgICAgIG9bb3B0cy5tYXBwaW5nLmlkXSA9IGlkO1xuICAgICAgICAgICAgICAgIG8ubWFwcGluZyA9IG9wdHMubWFwcGluZztcbiAgICAgICAgICAgICAgICByZXR1cm4gb1xuICAgICAgICAgICAgfSksIGNhbGxiYWNrKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHNpZXN0YU1vZGVsID0gY2FjaGUuZ2V0KG9wdHMpO1xuICAgICAgICAgICAgaWYgKHNpZXN0YU1vZGVsKSB7XG4gICAgICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnSGFkIGNhY2hlZCBvYmplY3QnLCB7b3B0czogb3B0cywgb2JqOiBzaWVzdGFNb2RlbH0pO1xuICAgICAgICAgICAgICAgIHdyYXBwZWRDYWxsYmFjayhjYWxsYmFjaykobnVsbCwgc2llc3RhTW9kZWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIG1hcHBpbmcgPSBvcHRzLm1hcHBpbmc7XG4gICAgICAgICAgICAgICAgaWYgKG1hcHBpbmcuc2luZ2xldG9uKSB7XG4gICAgICAgICAgICAgICAgICAgIG1hcHBpbmcuZ2V0KGNhbGxiYWNrKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBpZEZpZWxkID0gbWFwcGluZy5pZDtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGlkID0gb3B0c1tpZEZpZWxkXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtYXBwaW5nLmdldChpZCwgZnVuY3Rpb24gKGVyciwgb2JqKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9iaikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgb2JqKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIG51bGwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgd3JhcHBlZENhbGxiYWNrKGNhbGxiYWNrKShuZXcgUmVzdEVycm9yKCdJbnZhbGlkIG9wdGlvbnMgZ2l2ZW4gdG8gc3RvcmUuIE1pc3NpbmcgXCInICsgaWRGaWVsZC50b1N0cmluZygpICsgJy5cIicsIHtvcHRzOiBvcHRzfSkpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIC8vIE5vIHdheSBpbiB3aGljaCB0byBmaW5kIGFuIG9iamVjdCBsb2NhbGx5LlxuICAgICAgICB2YXIgY29udGV4dCA9IHtvcHRzOiBvcHRzfTtcbiAgICAgICAgdmFyIG1zZyA9ICdJbnZhbGlkIG9wdGlvbnMgZ2l2ZW4gdG8gc3RvcmUnO1xuICAgICAgICBMb2dnZXIuZXJyb3IobXNnLCBjb250ZXh0KTtcbiAgICAgICAgd3JhcHBlZENhbGxiYWNrKGNhbGxiYWNrKShuZXcgUmVzdEVycm9yKG1zZywgY29udGV4dCkpO1xuICAgIH1cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn1cblxuZnVuY3Rpb24gZ2V0TXVsdGlwbGUob3B0c0FycmF5LCBjYWxsYmFjaykge1xuICAgIHZhciBkZWZlcnJlZCA9IHEuZGVmZXIoKTtcbiAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgIHZhciBkb2NzID0gW107XG4gICAgdmFyIGVycm9ycyA9IFtdO1xuICAgIF8uZWFjaChvcHRzQXJyYXksIGZ1bmN0aW9uIChvcHRzKSB7XG4gICAgICAgIGdldChvcHRzLCBmdW5jdGlvbiAoZXJyLCBkb2MpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBlcnJvcnMucHVzaChlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgZG9jcy5wdXNoKGRvYyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZG9jcy5sZW5ndGggKyBlcnJvcnMubGVuZ3RoID09IG9wdHNBcnJheS5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycm9ycy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycm9ycyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCBkb2NzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59XG4vKipcbiAqIFVzZXMgcG91Y2ggYnVsayBmZXRjaCBBUEkuIE11Y2ggZmFzdGVyIHRoYW4gZ2V0TXVsdGlwbGUuXG4gKiBAcGFyYW0gbG9jYWxJZGVudGlmaWVyc1xuICogQHBhcmFtIGNhbGxiYWNrXG4gKi9cbmZ1bmN0aW9uIGdldE11bHRpcGxlTG9jYWwgKGxvY2FsSWRlbnRpZmllcnMsIGNhbGxiYWNrKSB7XG4gICAgdmFyIGRlZmVycmVkID0gcS5kZWZlcigpO1xuICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgdmFyIHJlc3VsdHMgPSBfLnJlZHVjZShsb2NhbElkZW50aWZpZXJzLCBmdW5jdGlvbiAobWVtbywgX2lkKSB7XG4gICAgICAgIHZhciBvYmogPSBjYWNoZS5nZXQoe19pZDogX2lkfSk7XG4gICAgICAgIGlmIChvYmopIHtcbiAgICAgICAgICAgIG1lbW8uY2FjaGVkW19pZF0gPSBvYmo7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBtZW1vLm5vdENhY2hlZC5wdXNoKF9pZCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgfSwge2NhY2hlZDoge30sIG5vdENhY2hlZDogW119KTtcblxuICAgIGZ1bmN0aW9uIGZpbmlzaChlcnIpIHtcbiAgICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIF8ubWFwKGxvY2FsSWRlbnRpZmllcnMsIGZ1bmN0aW9uIChfaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdHMuY2FjaGVkW19pZF07XG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHJlc3VsdHMubm90Q2FjaGVkLmxlbmd0aCkge1xuICAgICAgICBzaWVzdGEuZXh0LnN0b3JhZ2Uuc3RvcmUuZ2V0TXVsdGlwbGVMb2NhbEZyb21Db3VjaChyZXN1bHRzLCBmaW5pc2gpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgZmluaXNoKCk7XG4gICAgfVxuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufVxuXG5mdW5jdGlvbiBnZXRNdWx0aXBsZVJlbW90ZSAocmVtb3RlSWRlbnRpZmllcnMsIG1hcHBpbmcsIGNhbGxiYWNrKSB7XG4gICAgdmFyIGRlZmVycmVkID0gcS5kZWZlcigpO1xuICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgdmFyIHJlc3VsdHMgPSBfLnJlZHVjZShyZW1vdGVJZGVudGlmaWVycywgZnVuY3Rpb24gKG1lbW8sIGlkKSB7XG4gICAgICAgIHZhciBjYWNoZVF1ZXJ5ID0ge21hcHBpbmc6IG1hcHBpbmd9O1xuICAgICAgICBjYWNoZVF1ZXJ5W21hcHBpbmcuaWRdID0gaWQ7XG4gICAgICAgIHZhciBvYmogPSBjYWNoZS5nZXQoY2FjaGVRdWVyeSk7XG4gICAgICAgIGlmIChvYmopIHtcbiAgICAgICAgICAgIG1lbW8uY2FjaGVkW2lkXSA9IG9iajtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIG1lbW8ubm90Q2FjaGVkLnB1c2goaWQpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtZW1vO1xuICAgIH0sIHtjYWNoZWQ6IHt9LCBub3RDYWNoZWQ6IFtdfSk7XG5cbiAgICBmdW5jdGlvbiBmaW5pc2goZXJyKSB7XG4gICAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCBfLm1hcChyZW1vdGVJZGVudGlmaWVycywgZnVuY3Rpb24gKGlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHRzLmNhY2hlZFtpZF07XG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHJlc3VsdHMubm90Q2FjaGVkLmxlbmd0aCkge1xuICAgICAgICBzaWVzdGEuZXh0LnN0b3JhZ2Uuc3RvcmUuZ2V0TXVsdGlwbGVSZW1vdGVGcm9tcG91Y2gobWFwcGluZywgcmVtb3RlSWRlbnRpZmllcnMsIHJlc3VsdHMsIGZpbmlzaCk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBmaW5pc2goKTtcbiAgICB9XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59XG5cbmV4cG9ydHMuZ2V0ID0gZ2V0O1xuZXhwb3J0cy5nZXRNdWx0aXBsZSA9IGdldE11bHRpcGxlO1xuZXhwb3J0cy5nZXRNdWx0aXBsZUxvY2FsID0gZ2V0TXVsdGlwbGVMb2NhbDtcbmV4cG9ydHMuZ2V0TXVsdGlwbGVSZW1vdGUgPSBnZXRNdWx0aXBsZVJlbW90ZTsiLCIvKiB1dGlsLmpzXG4gKiA9PT09PT09XG4gKlxuICogVGhpcyBpcyBhIGNvbGxlY3Rpb24gb2YgdXRpbGl0aWVzIHRha2VuIGZyb20gbGlicmFyaWVzIHN1Y2ggYXMgYXN5bmMuanMsIHVuZGVyc2NvcmUuanMgZXRjLlxuICogVGhpcyBpcyB0byBhdm9pZCBibG9hdGluZyBzaWVzdGEuanMuXG4gKi9cblxuZnVuY3Rpb24gcHJpbnRTdGFja1RyYWNlKCkge1xuICAgIHZhciBlID0gbmV3IEVycm9yKCdwcmludFN0YWNrVHJhY2UnKTtcbiAgICB2YXIgc3RhY2sgPSBlLnN0YWNrO1xuICAgIGNvbnNvbGUubG9nKHN0YWNrKTtcbn1cblxuZnVuY3Rpb24gY2FwaXRhbGlzZUZpcnN0TGV0dGVyKHN0cmluZykge1xuICAgIHJldHVybiBzdHJpbmcuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBzdHJpbmcuc2xpY2UoMSk7XG59XG5cbmV4cG9ydHMucHJpbnRTdGFja1RyYWNlID0gcHJpbnRTdGFja1RyYWNlO1xuZXhwb3J0cy5jYXBpdGFsaXNlRmlyc3RMZXR0ZXIgPSBjYXBpdGFsaXNlRmlyc3RMZXR0ZXI7XG5cbnZhciByb290ID0ge307XG4vLyBTVEFSVCBhc3luYy5qcyAvL1xuXG52YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKG9iaikge1xuICAgIHJldHVybiBfdG9TdHJpbmcuY2FsbChvYmopID09PSAnW29iamVjdCBBcnJheV0nO1xufTtcblxuZnVuY3Rpb24gZG9QYXJhbGxlbChmbikge1xuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgICAgcmV0dXJuIGZuLmFwcGx5KG51bGwsIFtlYWNoXS5jb25jYXQoYXJncykpO1xuICAgIH07XG59XG5cbnZhciBtYXAgPSBkb1BhcmFsbGVsKF9hc3luY01hcCk7XG5cbmZ1bmN0aW9uIF9tYXAoYXJyLCBpdGVyYXRvcikge1xuICAgIGlmIChhcnIubWFwKSB7XG4gICAgICAgIHJldHVybiBhcnIubWFwKGl0ZXJhdG9yKTtcbiAgICB9XG4gICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICBlYWNoKGFyciwgZnVuY3Rpb24gKHgsIGksIGEpIHtcbiAgICAgICAgcmVzdWx0cy5wdXNoKGl0ZXJhdG9yKHgsIGksIGEpKTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0cztcbn1cblxuZnVuY3Rpb24gX2FzeW5jTWFwKGVhY2hmbiwgYXJyLCBpdGVyYXRvciwgY2FsbGJhY2spIHtcbiAgICBhcnIgPSBfbWFwKGFyciwgZnVuY3Rpb24gKHgsIGkpIHtcbiAgICAgICAgcmV0dXJuIHtpbmRleDogaSwgdmFsdWU6IHh9O1xuICAgIH0pO1xuICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgZWFjaGZuKGFyciwgZnVuY3Rpb24gKHgsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBpdGVyYXRvcih4LnZhbHVlLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgICAgICBlYWNoZm4oYXJyLCBmdW5jdGlvbiAoeCwgY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGl0ZXJhdG9yKHgudmFsdWUsIGZ1bmN0aW9uIChlcnIsIHYpIHtcbiAgICAgICAgICAgICAgICByZXN1bHRzW3guaW5kZXhdID0gdjtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgcmVzdWx0cyk7XG4gICAgICAgIH0pO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gX2VhY2goYXJyLCBpdGVyYXRvcikge1xuICAgIGlmIChhcnIuZm9yRWFjaCkge1xuICAgICAgICByZXR1cm4gYXJyLmZvckVhY2goaXRlcmF0b3IpO1xuICAgIH1cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICBpdGVyYXRvcihhcnJbaV0sIGksIGFycik7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBlYWNoKGFyciwgaXRlcmF0b3IsIGNhbGxiYWNrKSB7XG4gICAgY2FsbGJhY2sgPSBjYWxsYmFjayB8fCBmdW5jdGlvbiAoKSB7fTtcbiAgICBpZiAoIWFyci5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKCk7XG4gICAgfVxuICAgIHZhciBjb21wbGV0ZWQgPSAwO1xuICAgIF9lYWNoKGFyciwgZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgaXRlcmF0b3IoeCwgb25seV9vbmNlKGRvbmUpKTtcbiAgICB9KTtcbiAgICBmdW5jdGlvbiBkb25lKGVycikge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgY2FsbGJhY2sgPSBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNvbXBsZXRlZCArPSAxO1xuICAgICAgICAgICAgaWYgKGNvbXBsZXRlZCA+PSBhcnIubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24ga2V5cyhvYmopIHtcbiAgICBpZiAoT2JqZWN0LmtleXMpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKG9iaik7XG4gICAgfVxuICAgIHZhciBrZXlzID0gW107XG4gICAgZm9yICh2YXIgayBpbiBvYmopIHtcbiAgICAgICAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShrKSkge1xuICAgICAgICAgICAga2V5cy5wdXNoKGspO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBrZXlzO1xufVxuXG5cbnZhciBfcGFyYWxsZWwgPSBmdW5jdGlvbiAoZWFjaGZuLCB0YXNrcywgY2FsbGJhY2spIHtcbiAgICBjYWxsYmFjayA9IGNhbGxiYWNrIHx8IGZ1bmN0aW9uICgpIHt9O1xuICAgIGlmIChpc0FycmF5KHRhc2tzKSkge1xuICAgICAgICBlYWNoZm4ubWFwKHRhc2tzLCBmdW5jdGlvbiAoZm4sIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBpZiAoZm4pIHtcbiAgICAgICAgICAgICAgICBmbihmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoIDw9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3MgPSBhcmdzWzBdO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrLmNhbGwobnVsbCwgZXJyLCBhcmdzKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgY2FsbGJhY2spO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdmFyIHJlc3VsdHMgPSB7fTtcbiAgICAgICAgZWFjaGZuLmVhY2goa2V5cyh0YXNrcyksIGZ1bmN0aW9uIChrLCBjYWxsYmFjaykge1xuICAgICAgICAgICAgdGFza3Nba10oZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICAgICAgICBpZiAoYXJncy5sZW5ndGggPD0gMSkge1xuICAgICAgICAgICAgICAgICAgICBhcmdzID0gYXJnc1swXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVzdWx0c1trXSA9IGFyZ3M7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhlcnIsIHJlc3VsdHMpO1xuICAgICAgICB9KTtcbiAgICB9XG59O1xuXG5cbmZ1bmN0aW9uIG9ubHlfb25jZShmbikge1xuICAgIHZhciBjYWxsZWQgPSBmYWxzZTtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoY2FsbGVkKSB0aHJvdyBuZXcgRXJyb3IoXCJDYWxsYmFjayB3YXMgYWxyZWFkeSBjYWxsZWQuXCIpO1xuICAgICAgICBjYWxsZWQgPSB0cnVlO1xuICAgICAgICBmbi5hcHBseShyb290LCBhcmd1bWVudHMpO1xuICAgIH1cbn1cblxuZXhwb3J0cy5wYXJhbGxlbCA9IGZ1bmN0aW9uICh0YXNrcywgY2FsbGJhY2spIHtcbiAgICBfcGFyYWxsZWwoeyBtYXA6IG1hcCwgZWFjaDogZWFjaCB9LCB0YXNrcywgY2FsbGJhY2spO1xufTtcblxuZXhwb3J0cy5pc0FycmF5ID0gaXNBcnJheTtcblxuLy8gRU5EIGFzeW5jLmpzIC8vXG5cbi8vIFNUQVJUIHVuZGVyc2NvcmUuanMgLy9cblxudmFyIF8gPSB7fTtcbnZhciBBcnJheVByb3RvID0gQXJyYXkucHJvdG90eXBlO1xudmFyIEZ1bmNQcm90byA9IEZ1bmN0aW9uLnByb3RvdHlwZTtcblxudmFyIG5hdGl2ZUZvckVhY2ggPSBBcnJheVByb3RvLmZvckVhY2g7XG52YXIgbmF0aXZlTWFwID0gQXJyYXlQcm90by5tYXA7XG52YXIgbmF0aXZlUmVkdWNlID0gQXJyYXlQcm90by5yZWR1Y2U7XG52YXIgbmF0aXZlQmluZCA9IEZ1bmNQcm90by5iaW5kO1xudmFyIHNsaWNlID0gQXJyYXlQcm90by5zbGljZTtcbnZhciBicmVha2VyID0ge307XG5cbl8ua2V5cyA9IGtleXM7XG5cbl8uZWFjaCA9IF8uZm9yRWFjaCA9IGZ1bmN0aW9uIChvYmosIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gb2JqO1xuICAgIGlmIChuYXRpdmVGb3JFYWNoICYmIG9iai5mb3JFYWNoID09PSBuYXRpdmVGb3JFYWNoKSB7XG4gICAgICAgIG9iai5mb3JFYWNoKGl0ZXJhdG9yLCBjb250ZXh0KTtcbiAgICB9IGVsc2UgaWYgKG9iai5sZW5ndGggPT09ICtvYmoubGVuZ3RoKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBvYmoubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChpdGVyYXRvci5jYWxsKGNvbnRleHQsIG9ialtpXSwgaSwgb2JqKSA9PT0gYnJlYWtlcikgcmV0dXJuO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGtleXMgPSBfLmtleXMob2JqKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGtleXMubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChpdGVyYXRvci5jYWxsKGNvbnRleHQsIG9ialtrZXlzW2ldXSwga2V5c1tpXSwgb2JqKSA9PT0gYnJlYWtlcikgcmV0dXJuO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBvYmo7XG59O1xuXG4vLyBSZXR1cm4gdGhlIHJlc3VsdHMgb2YgYXBwbHlpbmcgdGhlIGl0ZXJhdG9yIHRvIGVhY2ggZWxlbWVudC5cbi8vIERlbGVnYXRlcyB0byAqKkVDTUFTY3JpcHQgNSoqJ3MgbmF0aXZlIGBtYXBgIGlmIGF2YWlsYWJsZS5cbl8ubWFwID0gXy5jb2xsZWN0ID0gZnVuY3Rpb24gKG9iaiwgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIHJlc3VsdHM7XG4gICAgaWYgKG5hdGl2ZU1hcCAmJiBvYmoubWFwID09PSBuYXRpdmVNYXApIHJldHVybiBvYmoubWFwKGl0ZXJhdG9yLCBjb250ZXh0KTtcbiAgICBfLmVhY2gob2JqLCBmdW5jdGlvbiAodmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICAgIHJlc3VsdHMucHVzaChpdGVyYXRvci5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgbGlzdCkpO1xuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHRzO1xufTtcblxuLy8gUGFydGlhbGx5IGFwcGx5IGEgZnVuY3Rpb24gYnkgY3JlYXRpbmcgYSB2ZXJzaW9uIHRoYXQgaGFzIGhhZCBzb21lIG9mIGl0c1xuLy8gYXJndW1lbnRzIHByZS1maWxsZWQsIHdpdGhvdXQgY2hhbmdpbmcgaXRzIGR5bmFtaWMgYHRoaXNgIGNvbnRleHQuIF8gYWN0c1xuLy8gYXMgYSBwbGFjZWhvbGRlciwgYWxsb3dpbmcgYW55IGNvbWJpbmF0aW9uIG9mIGFyZ3VtZW50cyB0byBiZSBwcmUtZmlsbGVkLlxuXy5wYXJ0aWFsID0gZnVuY3Rpb24gKGZ1bmMpIHtcbiAgICB2YXIgYm91bmRBcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBwb3NpdGlvbiA9IDA7XG4gICAgICAgIHZhciBhcmdzID0gYm91bmRBcmdzLnNsaWNlKCk7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBhcmdzLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoYXJnc1tpXSA9PT0gXykgYXJnc1tpXSA9IGFyZ3VtZW50c1twb3NpdGlvbisrXTtcbiAgICAgICAgfVxuICAgICAgICB3aGlsZSAocG9zaXRpb24gPCBhcmd1bWVudHMubGVuZ3RoKSBhcmdzLnB1c2goYXJndW1lbnRzW3Bvc2l0aW9uKytdKTtcbiAgICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfTtcbn07XG5cbi8vIENvbnZlbmllbmNlIHZlcnNpb24gb2YgYSBjb21tb24gdXNlIGNhc2Ugb2YgYG1hcGA6IGZldGNoaW5nIGEgcHJvcGVydHkuXG5fLnBsdWNrID0gZnVuY3Rpb24gKG9iaiwga2V5KSB7XG4gICAgcmV0dXJuIF8ubWFwKG9iaiwgXy5wcm9wZXJ0eShrZXkpKTtcbn07XG5cbnZhciByZWR1Y2VFcnJvciA9ICdSZWR1Y2Ugb2YgZW1wdHkgYXJyYXkgd2l0aCBubyBpbml0aWFsIHZhbHVlJztcblxuLy8gKipSZWR1Y2UqKiBidWlsZHMgdXAgYSBzaW5nbGUgcmVzdWx0IGZyb20gYSBsaXN0IG9mIHZhbHVlcywgYWthIGBpbmplY3RgLFxuLy8gb3IgYGZvbGRsYC4gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYHJlZHVjZWAgaWYgYXZhaWxhYmxlLlxuXy5yZWR1Y2UgPSBfLmZvbGRsID0gXy5pbmplY3QgPSBmdW5jdGlvbiAob2JqLCBpdGVyYXRvciwgbWVtbywgY29udGV4dCkge1xuICAgIHZhciBpbml0aWFsID0gYXJndW1lbnRzLmxlbmd0aCA+IDI7XG4gICAgaWYgKG9iaiA9PSBudWxsKSBvYmogPSBbXTtcbiAgICBpZiAobmF0aXZlUmVkdWNlICYmIG9iai5yZWR1Y2UgPT09IG5hdGl2ZVJlZHVjZSkge1xuICAgICAgICBpZiAoY29udGV4dCkgaXRlcmF0b3IgPSBfLmJpbmQoaXRlcmF0b3IsIGNvbnRleHQpO1xuICAgICAgICByZXR1cm4gaW5pdGlhbCA/IG9iai5yZWR1Y2UoaXRlcmF0b3IsIG1lbW8pIDogb2JqLnJlZHVjZShpdGVyYXRvcik7XG4gICAgfVxuICAgIF8uZWFjaChvYmosIGZ1bmN0aW9uICh2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgICAgaWYgKCFpbml0aWFsKSB7XG4gICAgICAgICAgICBtZW1vID0gdmFsdWU7XG4gICAgICAgICAgICBpbml0aWFsID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG1lbW8gPSBpdGVyYXRvci5jYWxsKGNvbnRleHQsIG1lbW8sIHZhbHVlLCBpbmRleCwgbGlzdCk7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBpZiAoIWluaXRpYWwpIHRocm93IG5ldyBUeXBlRXJyb3IocmVkdWNlRXJyb3IpO1xuICAgIHJldHVybiBtZW1vO1xufTtcblxuXy5wcm9wZXJ0eSA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKG9iaikge1xuICAgICAgICByZXR1cm4gb2JqW2tleV07XG4gICAgfTtcbn07XG5cbi8vIE9wdGltaXplIGBpc0Z1bmN0aW9uYCBpZiBhcHByb3ByaWF0ZS5cbmlmICh0eXBlb2YgKC8uLykgIT09ICdmdW5jdGlvbicpIHtcbiAgICBfLmlzRnVuY3Rpb24gPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIHJldHVybiB0eXBlb2Ygb2JqID09PSAnZnVuY3Rpb24nO1xuICAgIH07XG59XG5cbi8vIEFuIGludGVybmFsIGZ1bmN0aW9uIHRvIGdlbmVyYXRlIGxvb2t1cCBpdGVyYXRvcnMuXG52YXIgbG9va3VwSXRlcmF0b3IgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICBpZiAodmFsdWUgPT0gbnVsbCkgcmV0dXJuIF8uaWRlbnRpdHk7XG4gICAgaWYgKF8uaXNGdW5jdGlvbih2YWx1ZSkpIHJldHVybiB2YWx1ZTtcbiAgICByZXR1cm4gXy5wcm9wZXJ0eSh2YWx1ZSk7XG59O1xuXG4vLyBTb3J0IHRoZSBvYmplY3QncyB2YWx1ZXMgYnkgYSBjcml0ZXJpb24gcHJvZHVjZWQgYnkgYW4gaXRlcmF0b3IuXG5fLnNvcnRCeSA9IGZ1bmN0aW9uIChvYmosIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgaXRlcmF0b3IgPSBsb29rdXBJdGVyYXRvcihpdGVyYXRvcik7XG4gICAgcmV0dXJuIF8ucGx1Y2soXy5tYXAob2JqLCBmdW5jdGlvbiAodmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB2YWx1ZTogdmFsdWUsXG4gICAgICAgICAgICBpbmRleDogaW5kZXgsXG4gICAgICAgICAgICBjcml0ZXJpYTogaXRlcmF0b3IuY2FsbChjb250ZXh0LCB2YWx1ZSwgaW5kZXgsIGxpc3QpXG4gICAgICAgIH07XG4gICAgfSkuc29ydChmdW5jdGlvbiAobGVmdCwgcmlnaHQpIHtcbiAgICAgICAgdmFyIGEgPSBsZWZ0LmNyaXRlcmlhO1xuICAgICAgICB2YXIgYiA9IHJpZ2h0LmNyaXRlcmlhO1xuICAgICAgICBpZiAoYSAhPT0gYikge1xuICAgICAgICAgICAgaWYgKGEgPiBiIHx8IGEgPT09IHZvaWQgMCkgcmV0dXJuIDE7XG4gICAgICAgICAgICBpZiAoYSA8IGIgfHwgYiA9PT0gdm9pZCAwKSByZXR1cm4gLTE7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGxlZnQuaW5kZXggLSByaWdodC5pbmRleDtcbiAgICB9KSwgJ3ZhbHVlJyk7XG59O1xuXG52YXIgY3RvciA9IGZ1bmN0aW9uKCl7fTtcblxuLy8gQ3JlYXRlIGEgZnVuY3Rpb24gYm91bmQgdG8gYSBnaXZlbiBvYmplY3QgKGFzc2lnbmluZyBgdGhpc2AsIGFuZCBhcmd1bWVudHMsXG4vLyBvcHRpb25hbGx5KS4gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYEZ1bmN0aW9uLmJpbmRgIGlmXG4vLyBhdmFpbGFibGUuXG5fLmJpbmQgPSBmdW5jdGlvbiAoZnVuYywgY29udGV4dCkge1xuICAgIHZhciBhcmdzLCBib3VuZDtcbiAgICBpZiAobmF0aXZlQmluZCAmJiBmdW5jLmJpbmQgPT09IG5hdGl2ZUJpbmQpIHJldHVybiBuYXRpdmVCaW5kLmFwcGx5KGZ1bmMsIHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSk7XG4gICAgaWYgKCFfLmlzRnVuY3Rpb24oZnVuYykpIHRocm93IG5ldyBUeXBlRXJyb3I7XG4gICAgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICByZXR1cm4gYm91bmQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBib3VuZCkpIHJldHVybiBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MuY29uY2F0KHNsaWNlLmNhbGwoYXJndW1lbnRzKSkpO1xuICAgICAgICBjdG9yLnByb3RvdHlwZSA9IGZ1bmMucHJvdG90eXBlO1xuICAgICAgICB2YXIgc2VsZiA9IG5ldyBjdG9yO1xuICAgICAgICBjdG9yLnByb3RvdHlwZSA9IG51bGw7XG4gICAgICAgIHZhciByZXN1bHQgPSBmdW5jLmFwcGx5KHNlbGYsIGFyZ3MuY29uY2F0KHNsaWNlLmNhbGwoYXJndW1lbnRzKSkpO1xuICAgICAgICBpZiAoT2JqZWN0KHJlc3VsdCkgPT09IHJlc3VsdCkgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgcmV0dXJuIHNlbGY7XG4gICAgfTtcbn07XG5cblxuLy8gRU5EIHVuZGVyc2NvcmUuanMgLy9cblxuZXhwb3J0cy5fID0gXztcblxuXG52YXIgb2JzZXJ2ZSA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuUGxhdGZvcm07XG5cbi8qKlxuICogUGVyZm9ybXMgZGlydHkgY2hlY2svT2JqZWN0Lm9ic2VydmUgY2FsbGJhY2tzIGRlcGVuZGluZyBvbiB0aGUgYnJvd3Nlci5cbiAqXG4gKiBJZiBPYmplY3Qub2JzZXJ2ZSBpcyBwcmVzZW50LFxuICogQHBhcmFtIGNhbGxiYWNrXG4gKi9cbmV4cG9ydHMubmV4dCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIG9ic2VydmUucGVyZm9ybU1pY3JvdGFza0NoZWNrcG9pbnQoKTtcbiAgICBzZXRUaW1lb3V0KGNhbGxiYWNrKTtcbn07XG5cbi8qKlxuICogUmV0dXJucyBhIGhhbmRsZXIgdGhhdCBhY3RzIHVwb24gYSBjYWxsYmFjayBvciBhIHByb21pc2UgZGVwZW5kaW5nIG9uIHRoZSByZXN1bHQgb2YgYSBkaWZmZXJlbnQgY2FsbGJhY2suXG4gKiBAcGFyYW0gY2FsbGJhY2tcbiAqIEBwYXJhbSBbcHJvbWlzZV1cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn1cbiAqL1xuZXhwb3J0cy5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyID0gZnVuY3Rpb24gKGNhbGxiYWNrLCBwcm9taXNlKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjay5hcHBseShjYWxsYmFjaywgYXJndW1lbnRzKTtcbiAgICAgICAgaWYgKHByb21pc2UpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHByb21pc2UucmVqZWN0KGVycik7XG4gICAgICAgICAgICBlbHNlIHByb21pc2UucmVzb2x2ZS5hcHBseShwcm9taXNlLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcbiAgICAgICAgfVxuICAgIH07XG59OyIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbi8qXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQgVGhlIFBvbHltZXIgUHJvamVjdCBBdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogVGhpcyBjb2RlIG1heSBvbmx5IGJlIHVzZWQgdW5kZXIgdGhlIEJTRCBzdHlsZSBsaWNlbnNlIGZvdW5kIGF0IGh0dHA6Ly9wb2x5bWVyLmdpdGh1Yi5pby9MSUNFTlNFLnR4dFxuICogVGhlIGNvbXBsZXRlIHNldCBvZiBhdXRob3JzIG1heSBiZSBmb3VuZCBhdCBodHRwOi8vcG9seW1lci5naXRodWIuaW8vQVVUSE9SUy50eHRcbiAqIFRoZSBjb21wbGV0ZSBzZXQgb2YgY29udHJpYnV0b3JzIG1heSBiZSBmb3VuZCBhdCBodHRwOi8vcG9seW1lci5naXRodWIuaW8vQ09OVFJJQlVUT1JTLnR4dFxuICogQ29kZSBkaXN0cmlidXRlZCBieSBHb29nbGUgYXMgcGFydCBvZiB0aGUgcG9seW1lciBwcm9qZWN0IGlzIGFsc29cbiAqIHN1YmplY3QgdG8gYW4gYWRkaXRpb25hbCBJUCByaWdodHMgZ3JhbnQgZm91bmQgYXQgaHR0cDovL3BvbHltZXIuZ2l0aHViLmlvL1BBVEVOVFMudHh0XG4gKi9cblxuKGZ1bmN0aW9uKGdsb2JhbCkge1xuICAndXNlIHN0cmljdCc7XG5cbiAgdmFyIHRlc3RpbmdFeHBvc2VDeWNsZUNvdW50ID0gZ2xvYmFsLnRlc3RpbmdFeHBvc2VDeWNsZUNvdW50O1xuXG4gIC8vIERldGVjdCBhbmQgZG8gYmFzaWMgc2FuaXR5IGNoZWNraW5nIG9uIE9iamVjdC9BcnJheS5vYnNlcnZlLlxuICBmdW5jdGlvbiBkZXRlY3RPYmplY3RPYnNlcnZlKCkge1xuICAgIGlmICh0eXBlb2YgT2JqZWN0Lm9ic2VydmUgIT09ICdmdW5jdGlvbicgfHxcbiAgICAgICAgdHlwZW9mIEFycmF5Lm9ic2VydmUgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB2YXIgcmVjb3JkcyA9IFtdO1xuXG4gICAgZnVuY3Rpb24gY2FsbGJhY2socmVjcykge1xuICAgICAgcmVjb3JkcyA9IHJlY3M7XG4gICAgfVxuXG4gICAgdmFyIHRlc3QgPSB7fTtcbiAgICB2YXIgYXJyID0gW107XG4gICAgT2JqZWN0Lm9ic2VydmUodGVzdCwgY2FsbGJhY2spO1xuICAgIEFycmF5Lm9ic2VydmUoYXJyLCBjYWxsYmFjayk7XG4gICAgdGVzdC5pZCA9IDE7XG4gICAgdGVzdC5pZCA9IDI7XG4gICAgZGVsZXRlIHRlc3QuaWQ7XG4gICAgYXJyLnB1c2goMSwgMik7XG4gICAgYXJyLmxlbmd0aCA9IDA7XG5cbiAgICBPYmplY3QuZGVsaXZlckNoYW5nZVJlY29yZHMoY2FsbGJhY2spO1xuICAgIGlmIChyZWNvcmRzLmxlbmd0aCAhPT0gNSlcbiAgICAgIHJldHVybiBmYWxzZTtcblxuICAgIGlmIChyZWNvcmRzWzBdLnR5cGUgIT0gJ2FkZCcgfHxcbiAgICAgICAgcmVjb3Jkc1sxXS50eXBlICE9ICd1cGRhdGUnIHx8XG4gICAgICAgIHJlY29yZHNbMl0udHlwZSAhPSAnZGVsZXRlJyB8fFxuICAgICAgICByZWNvcmRzWzNdLnR5cGUgIT0gJ3NwbGljZScgfHxcbiAgICAgICAgcmVjb3Jkc1s0XS50eXBlICE9ICdzcGxpY2UnKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgT2JqZWN0LnVub2JzZXJ2ZSh0ZXN0LCBjYWxsYmFjayk7XG4gICAgQXJyYXkudW5vYnNlcnZlKGFyciwgY2FsbGJhY2spO1xuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICB2YXIgaGFzT2JzZXJ2ZSA9IGRldGVjdE9iamVjdE9ic2VydmUoKTtcblxuICBmdW5jdGlvbiBkZXRlY3RFdmFsKCkge1xuICAgIC8vIERvbid0IHRlc3QgZm9yIGV2YWwgaWYgd2UncmUgcnVubmluZyBpbiBhIENocm9tZSBBcHAgZW52aXJvbm1lbnQuXG4gICAgLy8gV2UgY2hlY2sgZm9yIEFQSXMgc2V0IHRoYXQgb25seSBleGlzdCBpbiBhIENocm9tZSBBcHAgY29udGV4dC5cbiAgICBpZiAodHlwZW9mIGNocm9tZSAhPT0gJ3VuZGVmaW5lZCcgJiYgY2hyb21lLmFwcCAmJiBjaHJvbWUuYXBwLnJ1bnRpbWUpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBGaXJlZm94IE9TIEFwcHMgZG8gbm90IGFsbG93IGV2YWwuIFRoaXMgZmVhdHVyZSBkZXRlY3Rpb24gaXMgdmVyeSBoYWNreVxuICAgIC8vIGJ1dCBldmVuIGlmIHNvbWUgb3RoZXIgcGxhdGZvcm0gYWRkcyBzdXBwb3J0IGZvciB0aGlzIGZ1bmN0aW9uIHRoaXMgY29kZVxuICAgIC8vIHdpbGwgY29udGludWUgdG8gd29yay5cbiAgICBpZiAobmF2aWdhdG9yLmdldERldmljZVN0b3JhZ2UpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgdmFyIGYgPSBuZXcgRnVuY3Rpb24oJycsICdyZXR1cm4gdHJ1ZTsnKTtcbiAgICAgIHJldHVybiBmKCk7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICB2YXIgaGFzRXZhbCA9IGRldGVjdEV2YWwoKTtcblxuICBmdW5jdGlvbiBpc0luZGV4KHMpIHtcbiAgICByZXR1cm4gK3MgPT09IHMgPj4+IDAgJiYgcyAhPT0gJyc7XG4gIH1cblxuICBmdW5jdGlvbiB0b051bWJlcihzKSB7XG4gICAgcmV0dXJuICtzO1xuICB9XG5cbiAgZnVuY3Rpb24gaXNPYmplY3Qob2JqKSB7XG4gICAgcmV0dXJuIG9iaiA9PT0gT2JqZWN0KG9iaik7XG4gIH1cblxuICB2YXIgbnVtYmVySXNOYU4gPSBnbG9iYWwuTnVtYmVyLmlzTmFOIHx8IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgJiYgZ2xvYmFsLmlzTmFOKHZhbHVlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFyZVNhbWVWYWx1ZShsZWZ0LCByaWdodCkge1xuICAgIGlmIChsZWZ0ID09PSByaWdodClcbiAgICAgIHJldHVybiBsZWZ0ICE9PSAwIHx8IDEgLyBsZWZ0ID09PSAxIC8gcmlnaHQ7XG4gICAgaWYgKG51bWJlcklzTmFOKGxlZnQpICYmIG51bWJlcklzTmFOKHJpZ2h0KSlcbiAgICAgIHJldHVybiB0cnVlO1xuXG4gICAgcmV0dXJuIGxlZnQgIT09IGxlZnQgJiYgcmlnaHQgIT09IHJpZ2h0O1xuICB9XG5cbiAgdmFyIGNyZWF0ZU9iamVjdCA9ICgnX19wcm90b19fJyBpbiB7fSkgP1xuICAgIGZ1bmN0aW9uKG9iaikgeyByZXR1cm4gb2JqOyB9IDpcbiAgICBmdW5jdGlvbihvYmopIHtcbiAgICAgIHZhciBwcm90byA9IG9iai5fX3Byb3RvX187XG4gICAgICBpZiAoIXByb3RvKVxuICAgICAgICByZXR1cm4gb2JqO1xuICAgICAgdmFyIG5ld09iamVjdCA9IE9iamVjdC5jcmVhdGUocHJvdG8pO1xuICAgICAgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMob2JqKS5mb3JFYWNoKGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG5ld09iamVjdCwgbmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihvYmosIG5hbWUpKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIG5ld09iamVjdDtcbiAgICB9O1xuXG4gIHZhciBpZGVudFN0YXJ0ID0gJ1tcXCRfYS16QS1aXSc7XG4gIHZhciBpZGVudFBhcnQgPSAnW1xcJF9hLXpBLVowLTldJztcbiAgdmFyIGlkZW50UmVnRXhwID0gbmV3IFJlZ0V4cCgnXicgKyBpZGVudFN0YXJ0ICsgJysnICsgaWRlbnRQYXJ0ICsgJyonICsgJyQnKTtcblxuICBmdW5jdGlvbiBnZXRQYXRoQ2hhclR5cGUoY2hhcikge1xuICAgIGlmIChjaGFyID09PSB1bmRlZmluZWQpXG4gICAgICByZXR1cm4gJ2VvZic7XG5cbiAgICB2YXIgY29kZSA9IGNoYXIuY2hhckNvZGVBdCgwKTtcblxuICAgIHN3aXRjaChjb2RlKSB7XG4gICAgICBjYXNlIDB4NUI6IC8vIFtcbiAgICAgIGNhc2UgMHg1RDogLy8gXVxuICAgICAgY2FzZSAweDJFOiAvLyAuXG4gICAgICBjYXNlIDB4MjI6IC8vIFwiXG4gICAgICBjYXNlIDB4Mjc6IC8vICdcbiAgICAgIGNhc2UgMHgzMDogLy8gMFxuICAgICAgICByZXR1cm4gY2hhcjtcblxuICAgICAgY2FzZSAweDVGOiAvLyBfXG4gICAgICBjYXNlIDB4MjQ6IC8vICRcbiAgICAgICAgcmV0dXJuICdpZGVudCc7XG5cbiAgICAgIGNhc2UgMHgyMDogLy8gU3BhY2VcbiAgICAgIGNhc2UgMHgwOTogLy8gVGFiXG4gICAgICBjYXNlIDB4MEE6IC8vIE5ld2xpbmVcbiAgICAgIGNhc2UgMHgwRDogLy8gUmV0dXJuXG4gICAgICBjYXNlIDB4QTA6ICAvLyBOby1icmVhayBzcGFjZVxuICAgICAgY2FzZSAweEZFRkY6ICAvLyBCeXRlIE9yZGVyIE1hcmtcbiAgICAgIGNhc2UgMHgyMDI4OiAgLy8gTGluZSBTZXBhcmF0b3JcbiAgICAgIGNhc2UgMHgyMDI5OiAgLy8gUGFyYWdyYXBoIFNlcGFyYXRvclxuICAgICAgICByZXR1cm4gJ3dzJztcbiAgICB9XG5cbiAgICAvLyBhLXosIEEtWlxuICAgIGlmICgoMHg2MSA8PSBjb2RlICYmIGNvZGUgPD0gMHg3QSkgfHwgKDB4NDEgPD0gY29kZSAmJiBjb2RlIDw9IDB4NUEpKVxuICAgICAgcmV0dXJuICdpZGVudCc7XG5cbiAgICAvLyAxLTlcbiAgICBpZiAoMHgzMSA8PSBjb2RlICYmIGNvZGUgPD0gMHgzOSlcbiAgICAgIHJldHVybiAnbnVtYmVyJztcblxuICAgIHJldHVybiAnZWxzZSc7XG4gIH1cblxuICB2YXIgcGF0aFN0YXRlTWFjaGluZSA9IHtcbiAgICAnYmVmb3JlUGF0aCc6IHtcbiAgICAgICd3cyc6IFsnYmVmb3JlUGF0aCddLFxuICAgICAgJ2lkZW50JzogWydpbklkZW50JywgJ2FwcGVuZCddLFxuICAgICAgJ1snOiBbJ2JlZm9yZUVsZW1lbnQnXSxcbiAgICAgICdlb2YnOiBbJ2FmdGVyUGF0aCddXG4gICAgfSxcblxuICAgICdpblBhdGgnOiB7XG4gICAgICAnd3MnOiBbJ2luUGF0aCddLFxuICAgICAgJy4nOiBbJ2JlZm9yZUlkZW50J10sXG4gICAgICAnWyc6IFsnYmVmb3JlRWxlbWVudCddLFxuICAgICAgJ2VvZic6IFsnYWZ0ZXJQYXRoJ11cbiAgICB9LFxuXG4gICAgJ2JlZm9yZUlkZW50Jzoge1xuICAgICAgJ3dzJzogWydiZWZvcmVJZGVudCddLFxuICAgICAgJ2lkZW50JzogWydpbklkZW50JywgJ2FwcGVuZCddXG4gICAgfSxcblxuICAgICdpbklkZW50Jzoge1xuICAgICAgJ2lkZW50JzogWydpbklkZW50JywgJ2FwcGVuZCddLFxuICAgICAgJzAnOiBbJ2luSWRlbnQnLCAnYXBwZW5kJ10sXG4gICAgICAnbnVtYmVyJzogWydpbklkZW50JywgJ2FwcGVuZCddLFxuICAgICAgJ3dzJzogWydpblBhdGgnLCAncHVzaCddLFxuICAgICAgJy4nOiBbJ2JlZm9yZUlkZW50JywgJ3B1c2gnXSxcbiAgICAgICdbJzogWydiZWZvcmVFbGVtZW50JywgJ3B1c2gnXSxcbiAgICAgICdlb2YnOiBbJ2FmdGVyUGF0aCcsICdwdXNoJ11cbiAgICB9LFxuXG4gICAgJ2JlZm9yZUVsZW1lbnQnOiB7XG4gICAgICAnd3MnOiBbJ2JlZm9yZUVsZW1lbnQnXSxcbiAgICAgICcwJzogWydhZnRlclplcm8nLCAnYXBwZW5kJ10sXG4gICAgICAnbnVtYmVyJzogWydpbkluZGV4JywgJ2FwcGVuZCddLFxuICAgICAgXCInXCI6IFsnaW5TaW5nbGVRdW90ZScsICdhcHBlbmQnLCAnJ10sXG4gICAgICAnXCInOiBbJ2luRG91YmxlUXVvdGUnLCAnYXBwZW5kJywgJyddXG4gICAgfSxcblxuICAgICdhZnRlclplcm8nOiB7XG4gICAgICAnd3MnOiBbJ2FmdGVyRWxlbWVudCcsICdwdXNoJ10sXG4gICAgICAnXSc6IFsnaW5QYXRoJywgJ3B1c2gnXVxuICAgIH0sXG5cbiAgICAnaW5JbmRleCc6IHtcbiAgICAgICcwJzogWydpbkluZGV4JywgJ2FwcGVuZCddLFxuICAgICAgJ251bWJlcic6IFsnaW5JbmRleCcsICdhcHBlbmQnXSxcbiAgICAgICd3cyc6IFsnYWZ0ZXJFbGVtZW50J10sXG4gICAgICAnXSc6IFsnaW5QYXRoJywgJ3B1c2gnXVxuICAgIH0sXG5cbiAgICAnaW5TaW5nbGVRdW90ZSc6IHtcbiAgICAgIFwiJ1wiOiBbJ2FmdGVyRWxlbWVudCddLFxuICAgICAgJ2VvZic6IFsnZXJyb3InXSxcbiAgICAgICdlbHNlJzogWydpblNpbmdsZVF1b3RlJywgJ2FwcGVuZCddXG4gICAgfSxcblxuICAgICdpbkRvdWJsZVF1b3RlJzoge1xuICAgICAgJ1wiJzogWydhZnRlckVsZW1lbnQnXSxcbiAgICAgICdlb2YnOiBbJ2Vycm9yJ10sXG4gICAgICAnZWxzZSc6IFsnaW5Eb3VibGVRdW90ZScsICdhcHBlbmQnXVxuICAgIH0sXG5cbiAgICAnYWZ0ZXJFbGVtZW50Jzoge1xuICAgICAgJ3dzJzogWydhZnRlckVsZW1lbnQnXSxcbiAgICAgICddJzogWydpblBhdGgnLCAncHVzaCddXG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gbm9vcCgpIHt9XG5cbiAgZnVuY3Rpb24gcGFyc2VQYXRoKHBhdGgpIHtcbiAgICB2YXIga2V5cyA9IFtdO1xuICAgIHZhciBpbmRleCA9IC0xO1xuICAgIHZhciBjLCBuZXdDaGFyLCBrZXksIHR5cGUsIHRyYW5zaXRpb24sIGFjdGlvbiwgdHlwZU1hcCwgbW9kZSA9ICdiZWZvcmVQYXRoJztcblxuICAgIHZhciBhY3Rpb25zID0ge1xuICAgICAgcHVzaDogZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmIChrZXkgPT09IHVuZGVmaW5lZClcbiAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAga2V5cy5wdXNoKGtleSk7XG4gICAgICAgIGtleSA9IHVuZGVmaW5lZDtcbiAgICAgIH0sXG5cbiAgICAgIGFwcGVuZDogZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmIChrZXkgPT09IHVuZGVmaW5lZClcbiAgICAgICAgICBrZXkgPSBuZXdDaGFyXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBrZXkgKz0gbmV3Q2hhcjtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gbWF5YmVVbmVzY2FwZVF1b3RlKCkge1xuICAgICAgaWYgKGluZGV4ID49IHBhdGgubGVuZ3RoKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIHZhciBuZXh0Q2hhciA9IHBhdGhbaW5kZXggKyAxXTtcbiAgICAgIGlmICgobW9kZSA9PSAnaW5TaW5nbGVRdW90ZScgJiYgbmV4dENoYXIgPT0gXCInXCIpIHx8XG4gICAgICAgICAgKG1vZGUgPT0gJ2luRG91YmxlUXVvdGUnICYmIG5leHRDaGFyID09ICdcIicpKSB7XG4gICAgICAgIGluZGV4Kys7XG4gICAgICAgIG5ld0NoYXIgPSBuZXh0Q2hhcjtcbiAgICAgICAgYWN0aW9ucy5hcHBlbmQoKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgd2hpbGUgKG1vZGUpIHtcbiAgICAgIGluZGV4Kys7XG4gICAgICBjID0gcGF0aFtpbmRleF07XG5cbiAgICAgIGlmIChjID09ICdcXFxcJyAmJiBtYXliZVVuZXNjYXBlUXVvdGUobW9kZSkpXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICB0eXBlID0gZ2V0UGF0aENoYXJUeXBlKGMpO1xuICAgICAgdHlwZU1hcCA9IHBhdGhTdGF0ZU1hY2hpbmVbbW9kZV07XG4gICAgICB0cmFuc2l0aW9uID0gdHlwZU1hcFt0eXBlXSB8fCB0eXBlTWFwWydlbHNlJ10gfHwgJ2Vycm9yJztcblxuICAgICAgaWYgKHRyYW5zaXRpb24gPT0gJ2Vycm9yJylcbiAgICAgICAgcmV0dXJuOyAvLyBwYXJzZSBlcnJvcjtcblxuICAgICAgbW9kZSA9IHRyYW5zaXRpb25bMF07XG4gICAgICBhY3Rpb24gPSBhY3Rpb25zW3RyYW5zaXRpb25bMV1dIHx8IG5vb3A7XG4gICAgICBuZXdDaGFyID0gdHJhbnNpdGlvblsyXSA9PT0gdW5kZWZpbmVkID8gYyA6IHRyYW5zaXRpb25bMl07XG4gICAgICBhY3Rpb24oKTtcblxuICAgICAgaWYgKG1vZGUgPT09ICdhZnRlclBhdGgnKSB7XG4gICAgICAgIHJldHVybiBrZXlzO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybjsgLy8gcGFyc2UgZXJyb3JcbiAgfVxuXG4gIGZ1bmN0aW9uIGlzSWRlbnQocykge1xuICAgIHJldHVybiBpZGVudFJlZ0V4cC50ZXN0KHMpO1xuICB9XG5cbiAgdmFyIGNvbnN0cnVjdG9ySXNQcml2YXRlID0ge307XG5cbiAgZnVuY3Rpb24gUGF0aChwYXJ0cywgcHJpdmF0ZVRva2VuKSB7XG4gICAgaWYgKHByaXZhdGVUb2tlbiAhPT0gY29uc3RydWN0b3JJc1ByaXZhdGUpXG4gICAgICB0aHJvdyBFcnJvcignVXNlIFBhdGguZ2V0IHRvIHJldHJpZXZlIHBhdGggb2JqZWN0cycpO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwYXJ0cy5sZW5ndGg7IGkrKykge1xuICAgICAgdGhpcy5wdXNoKFN0cmluZyhwYXJ0c1tpXSkpO1xuICAgIH1cblxuICAgIGlmIChoYXNFdmFsICYmIHRoaXMubGVuZ3RoKSB7XG4gICAgICB0aGlzLmdldFZhbHVlRnJvbSA9IHRoaXMuY29tcGlsZWRHZXRWYWx1ZUZyb21GbigpO1xuICAgIH1cbiAgfVxuXG4gIC8vIFRPRE8ocmFmYWVsdyk6IE1ha2Ugc2ltcGxlIExSVSBjYWNoZVxuICB2YXIgcGF0aENhY2hlID0ge307XG5cbiAgZnVuY3Rpb24gZ2V0UGF0aChwYXRoU3RyaW5nKSB7XG4gICAgaWYgKHBhdGhTdHJpbmcgaW5zdGFuY2VvZiBQYXRoKVxuICAgICAgcmV0dXJuIHBhdGhTdHJpbmc7XG5cbiAgICBpZiAocGF0aFN0cmluZyA9PSBudWxsIHx8IHBhdGhTdHJpbmcubGVuZ3RoID09IDApXG4gICAgICBwYXRoU3RyaW5nID0gJyc7XG5cbiAgICBpZiAodHlwZW9mIHBhdGhTdHJpbmcgIT0gJ3N0cmluZycpIHtcbiAgICAgIGlmIChpc0luZGV4KHBhdGhTdHJpbmcubGVuZ3RoKSkge1xuICAgICAgICAvLyBDb25zdHJ1Y3RlZCB3aXRoIGFycmF5LWxpa2UgKHByZS1wYXJzZWQpIGtleXNcbiAgICAgICAgcmV0dXJuIG5ldyBQYXRoKHBhdGhTdHJpbmcsIGNvbnN0cnVjdG9ySXNQcml2YXRlKTtcbiAgICAgIH1cblxuICAgICAgcGF0aFN0cmluZyA9IFN0cmluZyhwYXRoU3RyaW5nKTtcbiAgICB9XG5cbiAgICB2YXIgcGF0aCA9IHBhdGhDYWNoZVtwYXRoU3RyaW5nXTtcbiAgICBpZiAocGF0aClcbiAgICAgIHJldHVybiBwYXRoO1xuXG4gICAgdmFyIHBhcnRzID0gcGFyc2VQYXRoKHBhdGhTdHJpbmcpO1xuICAgIGlmICghcGFydHMpXG4gICAgICByZXR1cm4gaW52YWxpZFBhdGg7XG5cbiAgICB2YXIgcGF0aCA9IG5ldyBQYXRoKHBhcnRzLCBjb25zdHJ1Y3RvcklzUHJpdmF0ZSk7XG4gICAgcGF0aENhY2hlW3BhdGhTdHJpbmddID0gcGF0aDtcbiAgICByZXR1cm4gcGF0aDtcbiAgfVxuXG4gIFBhdGguZ2V0ID0gZ2V0UGF0aDtcblxuICBmdW5jdGlvbiBmb3JtYXRBY2Nlc3NvcihrZXkpIHtcbiAgICBpZiAoaXNJbmRleChrZXkpKSB7XG4gICAgICByZXR1cm4gJ1snICsga2V5ICsgJ10nO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gJ1tcIicgKyBrZXkucmVwbGFjZSgvXCIvZywgJ1xcXFxcIicpICsgJ1wiXSc7XG4gICAgfVxuICB9XG5cbiAgUGF0aC5wcm90b3R5cGUgPSBjcmVhdGVPYmplY3Qoe1xuICAgIF9fcHJvdG9fXzogW10sXG4gICAgdmFsaWQ6IHRydWUsXG5cbiAgICB0b1N0cmluZzogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgcGF0aFN0cmluZyA9ICcnO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBrZXkgPSB0aGlzW2ldO1xuICAgICAgICBpZiAoaXNJZGVudChrZXkpKSB7XG4gICAgICAgICAgcGF0aFN0cmluZyArPSBpID8gJy4nICsga2V5IDoga2V5O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBhdGhTdHJpbmcgKz0gZm9ybWF0QWNjZXNzb3Ioa2V5KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gcGF0aFN0cmluZztcbiAgICB9LFxuXG4gICAgZ2V0VmFsdWVGcm9tOiBmdW5jdGlvbihvYmosIGRpcmVjdE9ic2VydmVyKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKG9iaiA9PSBudWxsKVxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgb2JqID0gb2JqW3RoaXNbaV1dO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG9iajtcbiAgICB9LFxuXG4gICAgaXRlcmF0ZU9iamVjdHM6IGZ1bmN0aW9uKG9iaiwgb2JzZXJ2ZSkge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChpKVxuICAgICAgICAgIG9iaiA9IG9ialt0aGlzW2kgLSAxXV07XG4gICAgICAgIGlmICghaXNPYmplY3Qob2JqKSlcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIG9ic2VydmUob2JqLCB0aGlzWzBdKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgY29tcGlsZWRHZXRWYWx1ZUZyb21GbjogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgc3RyID0gJyc7XG4gICAgICB2YXIgcGF0aFN0cmluZyA9ICdvYmonO1xuICAgICAgc3RyICs9ICdpZiAob2JqICE9IG51bGwnO1xuICAgICAgdmFyIGkgPSAwO1xuICAgICAgdmFyIGtleTtcbiAgICAgIGZvciAoOyBpIDwgKHRoaXMubGVuZ3RoIC0gMSk7IGkrKykge1xuICAgICAgICBrZXkgPSB0aGlzW2ldO1xuICAgICAgICBwYXRoU3RyaW5nICs9IGlzSWRlbnQoa2V5KSA/ICcuJyArIGtleSA6IGZvcm1hdEFjY2Vzc29yKGtleSk7XG4gICAgICAgIHN0ciArPSAnICYmXFxuICAgICAnICsgcGF0aFN0cmluZyArICcgIT0gbnVsbCc7XG4gICAgICB9XG4gICAgICBzdHIgKz0gJylcXG4nO1xuXG4gICAgICB2YXIga2V5ID0gdGhpc1tpXTtcbiAgICAgIHBhdGhTdHJpbmcgKz0gaXNJZGVudChrZXkpID8gJy4nICsga2V5IDogZm9ybWF0QWNjZXNzb3Ioa2V5KTtcblxuICAgICAgc3RyICs9ICcgIHJldHVybiAnICsgcGF0aFN0cmluZyArICc7XFxuZWxzZVxcbiAgcmV0dXJuIHVuZGVmaW5lZDsnO1xuICAgICAgcmV0dXJuIG5ldyBGdW5jdGlvbignb2JqJywgc3RyKTtcbiAgICB9LFxuXG4gICAgc2V0VmFsdWVGcm9tOiBmdW5jdGlvbihvYmosIHZhbHVlKSB7XG4gICAgICBpZiAoIXRoaXMubGVuZ3RoKVxuICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgICAgaWYgKCFpc09iamVjdChvYmopKVxuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgb2JqID0gb2JqW3RoaXNbaV1dO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWlzT2JqZWN0KG9iaikpXG4gICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgb2JqW3RoaXNbaV1dID0gdmFsdWU7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH0pO1xuXG4gIHZhciBpbnZhbGlkUGF0aCA9IG5ldyBQYXRoKCcnLCBjb25zdHJ1Y3RvcklzUHJpdmF0ZSk7XG4gIGludmFsaWRQYXRoLnZhbGlkID0gZmFsc2U7XG4gIGludmFsaWRQYXRoLmdldFZhbHVlRnJvbSA9IGludmFsaWRQYXRoLnNldFZhbHVlRnJvbSA9IGZ1bmN0aW9uKCkge307XG5cbiAgdmFyIE1BWF9ESVJUWV9DSEVDS19DWUNMRVMgPSAxMDAwO1xuXG4gIGZ1bmN0aW9uIGRpcnR5Q2hlY2sob2JzZXJ2ZXIpIHtcbiAgICB2YXIgY3ljbGVzID0gMDtcbiAgICB3aGlsZSAoY3ljbGVzIDwgTUFYX0RJUlRZX0NIRUNLX0NZQ0xFUyAmJiBvYnNlcnZlci5jaGVja18oKSkge1xuICAgICAgY3ljbGVzKys7XG4gICAgfVxuICAgIGlmICh0ZXN0aW5nRXhwb3NlQ3ljbGVDb3VudClcbiAgICAgIGdsb2JhbC5kaXJ0eUNoZWNrQ3ljbGVDb3VudCA9IGN5Y2xlcztcblxuICAgIHJldHVybiBjeWNsZXMgPiAwO1xuICB9XG5cbiAgZnVuY3Rpb24gb2JqZWN0SXNFbXB0eShvYmplY3QpIHtcbiAgICBmb3IgKHZhciBwcm9wIGluIG9iamVjdClcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRpZmZJc0VtcHR5KGRpZmYpIHtcbiAgICByZXR1cm4gb2JqZWN0SXNFbXB0eShkaWZmLmFkZGVkKSAmJlxuICAgICAgICAgICBvYmplY3RJc0VtcHR5KGRpZmYucmVtb3ZlZCkgJiZcbiAgICAgICAgICAgb2JqZWN0SXNFbXB0eShkaWZmLmNoYW5nZWQpO1xuICB9XG5cbiAgZnVuY3Rpb24gZGlmZk9iamVjdEZyb21PbGRPYmplY3Qob2JqZWN0LCBvbGRPYmplY3QpIHtcbiAgICB2YXIgYWRkZWQgPSB7fTtcbiAgICB2YXIgcmVtb3ZlZCA9IHt9O1xuICAgIHZhciBjaGFuZ2VkID0ge307XG5cbiAgICBmb3IgKHZhciBwcm9wIGluIG9sZE9iamVjdCkge1xuICAgICAgdmFyIG5ld1ZhbHVlID0gb2JqZWN0W3Byb3BdO1xuXG4gICAgICBpZiAobmV3VmFsdWUgIT09IHVuZGVmaW5lZCAmJiBuZXdWYWx1ZSA9PT0gb2xkT2JqZWN0W3Byb3BdKVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgaWYgKCEocHJvcCBpbiBvYmplY3QpKSB7XG4gICAgICAgIHJlbW92ZWRbcHJvcF0gPSB1bmRlZmluZWQ7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAobmV3VmFsdWUgIT09IG9sZE9iamVjdFtwcm9wXSlcbiAgICAgICAgY2hhbmdlZFtwcm9wXSA9IG5ld1ZhbHVlO1xuICAgIH1cblxuICAgIGZvciAodmFyIHByb3AgaW4gb2JqZWN0KSB7XG4gICAgICBpZiAocHJvcCBpbiBvbGRPYmplY3QpXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICBhZGRlZFtwcm9wXSA9IG9iamVjdFtwcm9wXTtcbiAgICB9XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShvYmplY3QpICYmIG9iamVjdC5sZW5ndGggIT09IG9sZE9iamVjdC5sZW5ndGgpXG4gICAgICBjaGFuZ2VkLmxlbmd0aCA9IG9iamVjdC5sZW5ndGg7XG5cbiAgICByZXR1cm4ge1xuICAgICAgYWRkZWQ6IGFkZGVkLFxuICAgICAgcmVtb3ZlZDogcmVtb3ZlZCxcbiAgICAgIGNoYW5nZWQ6IGNoYW5nZWRcbiAgICB9O1xuICB9XG5cbiAgdmFyIGVvbVRhc2tzID0gW107XG4gIGZ1bmN0aW9uIHJ1bkVPTVRhc2tzKCkge1xuICAgIGlmICghZW9tVGFza3MubGVuZ3RoKVxuICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBlb21UYXNrcy5sZW5ndGg7IGkrKykge1xuICAgICAgZW9tVGFza3NbaV0oKTtcbiAgICB9XG4gICAgZW9tVGFza3MubGVuZ3RoID0gMDtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHZhciBydW5FT00gPSBoYXNPYnNlcnZlID8gKGZ1bmN0aW9uKCl7XG4gICAgdmFyIGVvbU9iaiA9IHsgcGluZ1Bvbmc6IHRydWUgfTtcbiAgICB2YXIgZW9tUnVuU2NoZWR1bGVkID0gZmFsc2U7XG5cbiAgICBPYmplY3Qub2JzZXJ2ZShlb21PYmosIGZ1bmN0aW9uKCkge1xuICAgICAgcnVuRU9NVGFza3MoKTtcbiAgICAgIGVvbVJ1blNjaGVkdWxlZCA9IGZhbHNlO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uKGZuKSB7XG4gICAgICBlb21UYXNrcy5wdXNoKGZuKTtcbiAgICAgIGlmICghZW9tUnVuU2NoZWR1bGVkKSB7XG4gICAgICAgIGVvbVJ1blNjaGVkdWxlZCA9IHRydWU7XG4gICAgICAgIGVvbU9iai5waW5nUG9uZyA9ICFlb21PYmoucGluZ1Bvbmc7XG4gICAgICB9XG4gICAgfTtcbiAgfSkoKSA6XG4gIChmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oZm4pIHtcbiAgICAgIGVvbVRhc2tzLnB1c2goZm4pO1xuICAgIH07XG4gIH0pKCk7XG5cbiAgdmFyIG9ic2VydmVkT2JqZWN0Q2FjaGUgPSBbXTtcblxuICBmdW5jdGlvbiBuZXdPYnNlcnZlZE9iamVjdCgpIHtcbiAgICB2YXIgb2JzZXJ2ZXI7XG4gICAgdmFyIG9iamVjdDtcbiAgICB2YXIgZGlzY2FyZFJlY29yZHMgPSBmYWxzZTtcbiAgICB2YXIgZmlyc3QgPSB0cnVlO1xuXG4gICAgZnVuY3Rpb24gY2FsbGJhY2socmVjb3Jkcykge1xuICAgICAgaWYgKG9ic2VydmVyICYmIG9ic2VydmVyLnN0YXRlXyA9PT0gT1BFTkVEICYmICFkaXNjYXJkUmVjb3JkcylcbiAgICAgICAgb2JzZXJ2ZXIuY2hlY2tfKHJlY29yZHMpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBvcGVuOiBmdW5jdGlvbihvYnMpIHtcbiAgICAgICAgaWYgKG9ic2VydmVyKVxuICAgICAgICAgIHRocm93IEVycm9yKCdPYnNlcnZlZE9iamVjdCBpbiB1c2UnKTtcblxuICAgICAgICBpZiAoIWZpcnN0KVxuICAgICAgICAgIE9iamVjdC5kZWxpdmVyQ2hhbmdlUmVjb3JkcyhjYWxsYmFjayk7XG5cbiAgICAgICAgb2JzZXJ2ZXIgPSBvYnM7XG4gICAgICAgIGZpcnN0ID0gZmFsc2U7XG4gICAgICB9LFxuICAgICAgb2JzZXJ2ZTogZnVuY3Rpb24ob2JqLCBhcnJheU9ic2VydmUpIHtcbiAgICAgICAgb2JqZWN0ID0gb2JqO1xuICAgICAgICBpZiAoYXJyYXlPYnNlcnZlKVxuICAgICAgICAgIEFycmF5Lm9ic2VydmUob2JqZWN0LCBjYWxsYmFjayk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICBPYmplY3Qub2JzZXJ2ZShvYmplY3QsIGNhbGxiYWNrKTtcbiAgICAgIH0sXG4gICAgICBkZWxpdmVyOiBmdW5jdGlvbihkaXNjYXJkKSB7XG4gICAgICAgIGRpc2NhcmRSZWNvcmRzID0gZGlzY2FyZDtcbiAgICAgICAgT2JqZWN0LmRlbGl2ZXJDaGFuZ2VSZWNvcmRzKGNhbGxiYWNrKTtcbiAgICAgICAgZGlzY2FyZFJlY29yZHMgPSBmYWxzZTtcbiAgICAgIH0sXG4gICAgICBjbG9zZTogZnVuY3Rpb24oKSB7XG4gICAgICAgIG9ic2VydmVyID0gdW5kZWZpbmVkO1xuICAgICAgICBPYmplY3QudW5vYnNlcnZlKG9iamVjdCwgY2FsbGJhY2spO1xuICAgICAgICBvYnNlcnZlZE9iamVjdENhY2hlLnB1c2godGhpcyk7XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIC8qXG4gICAqIFRoZSBvYnNlcnZlZFNldCBhYnN0cmFjdGlvbiBpcyBhIHBlcmYgb3B0aW1pemF0aW9uIHdoaWNoIHJlZHVjZXMgdGhlIHRvdGFsXG4gICAqIG51bWJlciBvZiBPYmplY3Qub2JzZXJ2ZSBvYnNlcnZhdGlvbnMgb2YgYSBzZXQgb2Ygb2JqZWN0cy4gVGhlIGlkZWEgaXMgdGhhdFxuICAgKiBncm91cHMgb2YgT2JzZXJ2ZXJzIHdpbGwgaGF2ZSBzb21lIG9iamVjdCBkZXBlbmRlbmNpZXMgaW4gY29tbW9uIGFuZCB0aGlzXG4gICAqIG9ic2VydmVkIHNldCBlbnN1cmVzIHRoYXQgZWFjaCBvYmplY3QgaW4gdGhlIHRyYW5zaXRpdmUgY2xvc3VyZSBvZlxuICAgKiBkZXBlbmRlbmNpZXMgaXMgb25seSBvYnNlcnZlZCBvbmNlLiBUaGUgb2JzZXJ2ZWRTZXQgYWN0cyBhcyBhIHdyaXRlIGJhcnJpZXJcbiAgICogc3VjaCB0aGF0IHdoZW5ldmVyIGFueSBjaGFuZ2UgY29tZXMgdGhyb3VnaCwgYWxsIE9ic2VydmVycyBhcmUgY2hlY2tlZCBmb3JcbiAgICogY2hhbmdlZCB2YWx1ZXMuXG4gICAqXG4gICAqIE5vdGUgdGhhdCB0aGlzIG9wdGltaXphdGlvbiBpcyBleHBsaWNpdGx5IG1vdmluZyB3b3JrIGZyb20gc2V0dXAtdGltZSB0b1xuICAgKiBjaGFuZ2UtdGltZS5cbiAgICpcbiAgICogVE9ETyhyYWZhZWx3KTogSW1wbGVtZW50IFwiZ2FyYmFnZSBjb2xsZWN0aW9uXCIuIEluIG9yZGVyIHRvIG1vdmUgd29yayBvZmZcbiAgICogdGhlIGNyaXRpY2FsIHBhdGgsIHdoZW4gT2JzZXJ2ZXJzIGFyZSBjbG9zZWQsIHRoZWlyIG9ic2VydmVkIG9iamVjdHMgYXJlXG4gICAqIG5vdCBPYmplY3QudW5vYnNlcnZlKGQpLiBBcyBhIHJlc3VsdCwgaXQnc2llc3RhIHBvc3NpYmxlIHRoYXQgaWYgdGhlIG9ic2VydmVkU2V0XG4gICAqIGlzIGtlcHQgb3BlbiwgYnV0IHNvbWUgT2JzZXJ2ZXJzIGhhdmUgYmVlbiBjbG9zZWQsIGl0IGNvdWxkIGNhdXNlIFwibGVha3NcIlxuICAgKiAocHJldmVudCBvdGhlcndpc2UgY29sbGVjdGFibGUgb2JqZWN0cyBmcm9tIGJlaW5nIGNvbGxlY3RlZCkuIEF0IHNvbWVcbiAgICogcG9pbnQsIHdlIHNob3VsZCBpbXBsZW1lbnQgaW5jcmVtZW50YWwgXCJnY1wiIHdoaWNoIGtlZXBzIGEgbGlzdCBvZlxuICAgKiBvYnNlcnZlZFNldHMgd2hpY2ggbWF5IG5lZWQgY2xlYW4tdXAgYW5kIGRvZXMgc21hbGwgYW1vdW50cyBvZiBjbGVhbnVwIG9uIGFcbiAgICogdGltZW91dCB1bnRpbCBhbGwgaXMgY2xlYW4uXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGdldE9ic2VydmVkT2JqZWN0KG9ic2VydmVyLCBvYmplY3QsIGFycmF5T2JzZXJ2ZSkge1xuICAgIHZhciBkaXIgPSBvYnNlcnZlZE9iamVjdENhY2hlLnBvcCgpIHx8IG5ld09ic2VydmVkT2JqZWN0KCk7XG4gICAgZGlyLm9wZW4ob2JzZXJ2ZXIpO1xuICAgIGRpci5vYnNlcnZlKG9iamVjdCwgYXJyYXlPYnNlcnZlKTtcbiAgICByZXR1cm4gZGlyO1xuICB9XG5cbiAgdmFyIG9ic2VydmVkU2V0Q2FjaGUgPSBbXTtcblxuICBmdW5jdGlvbiBuZXdPYnNlcnZlZFNldCgpIHtcbiAgICB2YXIgb2JzZXJ2ZXJDb3VudCA9IDA7XG4gICAgdmFyIG9ic2VydmVycyA9IFtdO1xuICAgIHZhciBvYmplY3RzID0gW107XG4gICAgdmFyIHJvb3RPYmo7XG4gICAgdmFyIHJvb3RPYmpQcm9wcztcblxuICAgIGZ1bmN0aW9uIG9ic2VydmUob2JqLCBwcm9wKSB7XG4gICAgICBpZiAoIW9iailcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICBpZiAob2JqID09PSByb290T2JqKVxuICAgICAgICByb290T2JqUHJvcHNbcHJvcF0gPSB0cnVlO1xuXG4gICAgICBpZiAob2JqZWN0cy5pbmRleE9mKG9iaikgPCAwKSB7XG4gICAgICAgIG9iamVjdHMucHVzaChvYmopO1xuICAgICAgICBPYmplY3Qub2JzZXJ2ZShvYmosIGNhbGxiYWNrKTtcbiAgICAgIH1cblxuICAgICAgb2JzZXJ2ZShPYmplY3QuZ2V0UHJvdG90eXBlT2Yob2JqKSwgcHJvcCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWxsUm9vdE9iak5vbk9ic2VydmVkUHJvcHMocmVjcykge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZWNzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciByZWMgPSByZWNzW2ldO1xuICAgICAgICBpZiAocmVjLm9iamVjdCAhPT0gcm9vdE9iaiB8fFxuICAgICAgICAgICAgcm9vdE9ialByb3BzW3JlYy5uYW1lXSB8fFxuICAgICAgICAgICAgcmVjLnR5cGUgPT09ICdzZXRQcm90b3R5cGUnKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjYWxsYmFjayhyZWNzKSB7XG4gICAgICBpZiAoYWxsUm9vdE9iak5vbk9ic2VydmVkUHJvcHMocmVjcykpXG4gICAgICAgIHJldHVybjtcblxuICAgICAgdmFyIG9ic2VydmVyO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvYnNlcnZlcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgb2JzZXJ2ZXIgPSBvYnNlcnZlcnNbaV07XG4gICAgICAgIGlmIChvYnNlcnZlci5zdGF0ZV8gPT0gT1BFTkVEKSB7XG4gICAgICAgICAgb2JzZXJ2ZXIuaXRlcmF0ZU9iamVjdHNfKG9ic2VydmUpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb2JzZXJ2ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIG9ic2VydmVyID0gb2JzZXJ2ZXJzW2ldO1xuICAgICAgICBpZiAob2JzZXJ2ZXIuc3RhdGVfID09IE9QRU5FRCkge1xuICAgICAgICAgIG9ic2VydmVyLmNoZWNrXygpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIHJlY29yZCA9IHtcbiAgICAgIG9iamVjdDogdW5kZWZpbmVkLFxuICAgICAgb2JqZWN0czogb2JqZWN0cyxcbiAgICAgIG9wZW46IGZ1bmN0aW9uKG9icywgb2JqZWN0KSB7XG4gICAgICAgIGlmICghcm9vdE9iaikge1xuICAgICAgICAgIHJvb3RPYmogPSBvYmplY3Q7XG4gICAgICAgICAgcm9vdE9ialByb3BzID0ge307XG4gICAgICAgIH1cblxuICAgICAgICBvYnNlcnZlcnMucHVzaChvYnMpO1xuICAgICAgICBvYnNlcnZlckNvdW50Kys7XG4gICAgICAgIG9icy5pdGVyYXRlT2JqZWN0c18ob2JzZXJ2ZSk7XG4gICAgICB9LFxuICAgICAgY2xvc2U6IGZ1bmN0aW9uKG9icykge1xuICAgICAgICBvYnNlcnZlckNvdW50LS07XG4gICAgICAgIGlmIChvYnNlcnZlckNvdW50ID4gMCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb2JqZWN0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIE9iamVjdC51bm9ic2VydmUob2JqZWN0c1tpXSwgY2FsbGJhY2spO1xuICAgICAgICAgIE9ic2VydmVyLnVub2JzZXJ2ZWRDb3VudCsrO1xuICAgICAgICB9XG5cbiAgICAgICAgb2JzZXJ2ZXJzLmxlbmd0aCA9IDA7XG4gICAgICAgIG9iamVjdHMubGVuZ3RoID0gMDtcbiAgICAgICAgcm9vdE9iaiA9IHVuZGVmaW5lZDtcbiAgICAgICAgcm9vdE9ialByb3BzID0gdW5kZWZpbmVkO1xuICAgICAgICBvYnNlcnZlZFNldENhY2hlLnB1c2godGhpcyk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiByZWNvcmQ7XG4gIH1cblxuICB2YXIgbGFzdE9ic2VydmVkU2V0O1xuXG4gIGZ1bmN0aW9uIGdldE9ic2VydmVkU2V0KG9ic2VydmVyLCBvYmopIHtcbiAgICBpZiAoIWxhc3RPYnNlcnZlZFNldCB8fCBsYXN0T2JzZXJ2ZWRTZXQub2JqZWN0ICE9PSBvYmopIHtcbiAgICAgIGxhc3RPYnNlcnZlZFNldCA9IG9ic2VydmVkU2V0Q2FjaGUucG9wKCkgfHwgbmV3T2JzZXJ2ZWRTZXQoKTtcbiAgICAgIGxhc3RPYnNlcnZlZFNldC5vYmplY3QgPSBvYmo7XG4gICAgfVxuICAgIGxhc3RPYnNlcnZlZFNldC5vcGVuKG9ic2VydmVyLCBvYmopO1xuICAgIHJldHVybiBsYXN0T2JzZXJ2ZWRTZXQ7XG4gIH1cblxuICB2YXIgVU5PUEVORUQgPSAwO1xuICB2YXIgT1BFTkVEID0gMTtcbiAgdmFyIENMT1NFRCA9IDI7XG4gIHZhciBSRVNFVFRJTkcgPSAzO1xuXG4gIHZhciBuZXh0T2JzZXJ2ZXJJZCA9IDE7XG5cbiAgZnVuY3Rpb24gT2JzZXJ2ZXIoKSB7XG4gICAgdGhpcy5zdGF0ZV8gPSBVTk9QRU5FRDtcbiAgICB0aGlzLmNhbGxiYWNrXyA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLnRhcmdldF8gPSB1bmRlZmluZWQ7IC8vIFRPRE8ocmFmYWVsdyk6IFNob3VsZCBiZSBXZWFrUmVmXG4gICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8gPSB1bmRlZmluZWQ7XG4gICAgdGhpcy52YWx1ZV8gPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5pZF8gPSBuZXh0T2JzZXJ2ZXJJZCsrO1xuICB9XG5cbiAgT2JzZXJ2ZXIucHJvdG90eXBlID0ge1xuICAgIG9wZW46IGZ1bmN0aW9uKGNhbGxiYWNrLCB0YXJnZXQpIHtcbiAgICAgIGlmICh0aGlzLnN0YXRlXyAhPSBVTk9QRU5FRClcbiAgICAgICAgdGhyb3cgRXJyb3IoJ09ic2VydmVyIGhhcyBhbHJlYWR5IGJlZW4gb3BlbmVkLicpO1xuXG4gICAgICBhZGRUb0FsbCh0aGlzKTtcbiAgICAgIHRoaXMuY2FsbGJhY2tfID0gY2FsbGJhY2s7XG4gICAgICB0aGlzLnRhcmdldF8gPSB0YXJnZXQ7XG4gICAgICB0aGlzLmNvbm5lY3RfKCk7XG4gICAgICB0aGlzLnN0YXRlXyA9IE9QRU5FRDtcbiAgICAgIHJldHVybiB0aGlzLnZhbHVlXztcbiAgICB9LFxuXG4gICAgY2xvc2U6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuc3RhdGVfICE9IE9QRU5FRClcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICByZW1vdmVGcm9tQWxsKHRoaXMpO1xuICAgICAgdGhpcy5kaXNjb25uZWN0XygpO1xuICAgICAgdGhpcy52YWx1ZV8gPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLmNhbGxiYWNrXyA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMudGFyZ2V0XyA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMuc3RhdGVfID0gQ0xPU0VEO1xuICAgIH0sXG5cbiAgICBkZWxpdmVyOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLnN0YXRlXyAhPSBPUEVORUQpXG4gICAgICAgIHJldHVybjtcblxuICAgICAgZGlydHlDaGVjayh0aGlzKTtcbiAgICB9LFxuXG4gICAgcmVwb3J0XzogZnVuY3Rpb24oY2hhbmdlcykge1xuICAgICAgdHJ5IHtcbiAgICAgICAgdGhpcy5jYWxsYmFja18uYXBwbHkodGhpcy50YXJnZXRfLCBjaGFuZ2VzKTtcbiAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgIE9ic2VydmVyLl9lcnJvclRocm93bkR1cmluZ0NhbGxiYWNrID0gdHJ1ZTtcbiAgICAgICAgY29uc29sZS5lcnJvcignRXhjZXB0aW9uIGNhdWdodCBkdXJpbmcgb2JzZXJ2ZXIgY2FsbGJhY2s6ICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAoZXguc3RhY2sgfHwgZXgpKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgZGlzY2FyZENoYW5nZXM6IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5jaGVja18odW5kZWZpbmVkLCB0cnVlKTtcbiAgICAgIHJldHVybiB0aGlzLnZhbHVlXztcbiAgICB9XG4gIH1cblxuICB2YXIgY29sbGVjdE9ic2VydmVycyA9ICFoYXNPYnNlcnZlO1xuICB2YXIgYWxsT2JzZXJ2ZXJzO1xuICBPYnNlcnZlci5fYWxsT2JzZXJ2ZXJzQ291bnQgPSAwO1xuXG4gIGlmIChjb2xsZWN0T2JzZXJ2ZXJzKSB7XG4gICAgYWxsT2JzZXJ2ZXJzID0gW107XG4gIH1cblxuICBmdW5jdGlvbiBhZGRUb0FsbChvYnNlcnZlcikge1xuICAgIE9ic2VydmVyLl9hbGxPYnNlcnZlcnNDb3VudCsrO1xuICAgIGlmICghY29sbGVjdE9ic2VydmVycylcbiAgICAgIHJldHVybjtcblxuICAgIGFsbE9ic2VydmVycy5wdXNoKG9ic2VydmVyKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbW92ZUZyb21BbGwob2JzZXJ2ZXIpIHtcbiAgICBPYnNlcnZlci5fYWxsT2JzZXJ2ZXJzQ291bnQtLTtcbiAgfVxuXG4gIHZhciBydW5uaW5nTWljcm90YXNrQ2hlY2twb2ludCA9IGZhbHNlO1xuXG4gIHZhciBoYXNEZWJ1Z0ZvcmNlRnVsbERlbGl2ZXJ5ID0gaGFzT2JzZXJ2ZSAmJiBoYXNFdmFsICYmIChmdW5jdGlvbigpIHtcbiAgICB0cnkge1xuICAgICAgZXZhbCgnJVJ1bk1pY3JvdGFza3MoKScpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH0pKCk7XG5cbiAgZ2xvYmFsLlBsYXRmb3JtID0gZ2xvYmFsLlBsYXRmb3JtIHx8IHt9O1xuXG4gIGdsb2JhbC5QbGF0Zm9ybS5wZXJmb3JtTWljcm90YXNrQ2hlY2twb2ludCA9IGZ1bmN0aW9uKCkge1xuICAgIGlmIChydW5uaW5nTWljcm90YXNrQ2hlY2twb2ludClcbiAgICAgIHJldHVybjtcblxuICAgIGlmIChoYXNEZWJ1Z0ZvcmNlRnVsbERlbGl2ZXJ5KSB7XG4gICAgICBldmFsKCclUnVuTWljcm90YXNrcygpJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKCFjb2xsZWN0T2JzZXJ2ZXJzKVxuICAgICAgcmV0dXJuO1xuXG4gICAgcnVubmluZ01pY3JvdGFza0NoZWNrcG9pbnQgPSB0cnVlO1xuXG4gICAgdmFyIGN5Y2xlcyA9IDA7XG4gICAgdmFyIGFueUNoYW5nZWQsIHRvQ2hlY2s7XG5cbiAgICBkbyB7XG4gICAgICBjeWNsZXMrKztcbiAgICAgIHRvQ2hlY2sgPSBhbGxPYnNlcnZlcnM7XG4gICAgICBhbGxPYnNlcnZlcnMgPSBbXTtcbiAgICAgIGFueUNoYW5nZWQgPSBmYWxzZTtcblxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0b0NoZWNrLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBvYnNlcnZlciA9IHRvQ2hlY2tbaV07XG4gICAgICAgIGlmIChvYnNlcnZlci5zdGF0ZV8gIT0gT1BFTkVEKVxuICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgIGlmIChvYnNlcnZlci5jaGVja18oKSlcbiAgICAgICAgICBhbnlDaGFuZ2VkID0gdHJ1ZTtcblxuICAgICAgICBhbGxPYnNlcnZlcnMucHVzaChvYnNlcnZlcik7XG4gICAgICB9XG4gICAgICBpZiAocnVuRU9NVGFza3MoKSlcbiAgICAgICAgYW55Q2hhbmdlZCA9IHRydWU7XG4gICAgfSB3aGlsZSAoY3ljbGVzIDwgTUFYX0RJUlRZX0NIRUNLX0NZQ0xFUyAmJiBhbnlDaGFuZ2VkKTtcblxuICAgIGlmICh0ZXN0aW5nRXhwb3NlQ3ljbGVDb3VudClcbiAgICAgIGdsb2JhbC5kaXJ0eUNoZWNrQ3ljbGVDb3VudCA9IGN5Y2xlcztcblxuICAgIHJ1bm5pbmdNaWNyb3Rhc2tDaGVja3BvaW50ID0gZmFsc2U7XG4gIH07XG5cbiAgaWYgKGNvbGxlY3RPYnNlcnZlcnMpIHtcbiAgICBnbG9iYWwuUGxhdGZvcm0uY2xlYXJPYnNlcnZlcnMgPSBmdW5jdGlvbigpIHtcbiAgICAgIGFsbE9ic2VydmVycyA9IFtdO1xuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBPYmplY3RPYnNlcnZlcihvYmplY3QpIHtcbiAgICBPYnNlcnZlci5jYWxsKHRoaXMpO1xuICAgIHRoaXMudmFsdWVfID0gb2JqZWN0O1xuICAgIHRoaXMub2xkT2JqZWN0XyA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIE9iamVjdE9ic2VydmVyLnByb3RvdHlwZSA9IGNyZWF0ZU9iamVjdCh7XG4gICAgX19wcm90b19fOiBPYnNlcnZlci5wcm90b3R5cGUsXG5cbiAgICBhcnJheU9ic2VydmU6IGZhbHNlLFxuXG4gICAgY29ubmVjdF86IGZ1bmN0aW9uKGNhbGxiYWNrLCB0YXJnZXQpIHtcbiAgICAgIGlmIChoYXNPYnNlcnZlKSB7XG4gICAgICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfID0gZ2V0T2JzZXJ2ZWRPYmplY3QodGhpcywgdGhpcy52YWx1ZV8sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hcnJheU9ic2VydmUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5vbGRPYmplY3RfID0gdGhpcy5jb3B5T2JqZWN0KHRoaXMudmFsdWVfKTtcbiAgICAgIH1cblxuICAgIH0sXG5cbiAgICBjb3B5T2JqZWN0OiBmdW5jdGlvbihvYmplY3QpIHtcbiAgICAgIHZhciBjb3B5ID0gQXJyYXkuaXNBcnJheShvYmplY3QpID8gW10gOiB7fTtcbiAgICAgIGZvciAodmFyIHByb3AgaW4gb2JqZWN0KSB7XG4gICAgICAgIGNvcHlbcHJvcF0gPSBvYmplY3RbcHJvcF07XG4gICAgICB9O1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkob2JqZWN0KSlcbiAgICAgICAgY29weS5sZW5ndGggPSBvYmplY3QubGVuZ3RoO1xuICAgICAgcmV0dXJuIGNvcHk7XG4gICAgfSxcblxuICAgIGNoZWNrXzogZnVuY3Rpb24oY2hhbmdlUmVjb3Jkcywgc2tpcENoYW5nZXMpIHtcbiAgICAgIHZhciBkaWZmO1xuICAgICAgdmFyIG9sZFZhbHVlcztcbiAgICAgIGlmIChoYXNPYnNlcnZlKSB7XG4gICAgICAgIGlmICghY2hhbmdlUmVjb3JkcylcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgb2xkVmFsdWVzID0ge307XG4gICAgICAgIGRpZmYgPSBkaWZmT2JqZWN0RnJvbUNoYW5nZVJlY29yZHModGhpcy52YWx1ZV8sIGNoYW5nZVJlY29yZHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkVmFsdWVzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9sZFZhbHVlcyA9IHRoaXMub2xkT2JqZWN0XztcbiAgICAgICAgZGlmZiA9IGRpZmZPYmplY3RGcm9tT2xkT2JqZWN0KHRoaXMudmFsdWVfLCB0aGlzLm9sZE9iamVjdF8pO1xuICAgICAgfVxuXG4gICAgICBpZiAoZGlmZklzRW1wdHkoZGlmZikpXG4gICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgaWYgKCFoYXNPYnNlcnZlKVxuICAgICAgICB0aGlzLm9sZE9iamVjdF8gPSB0aGlzLmNvcHlPYmplY3QodGhpcy52YWx1ZV8pO1xuXG4gICAgICB0aGlzLnJlcG9ydF8oW1xuICAgICAgICBkaWZmLmFkZGVkIHx8IHt9LFxuICAgICAgICBkaWZmLnJlbW92ZWQgfHwge30sXG4gICAgICAgIGRpZmYuY2hhbmdlZCB8fCB7fSxcbiAgICAgICAgZnVuY3Rpb24ocHJvcGVydHkpIHtcbiAgICAgICAgICByZXR1cm4gb2xkVmFsdWVzW3Byb3BlcnR5XTtcbiAgICAgICAgfVxuICAgICAgXSk7XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0sXG5cbiAgICBkaXNjb25uZWN0XzogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoaGFzT2JzZXJ2ZSkge1xuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXy5jbG9zZSgpO1xuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXyA9IHVuZGVmaW5lZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMub2xkT2JqZWN0XyA9IHVuZGVmaW5lZDtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgZGVsaXZlcjogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5zdGF0ZV8gIT0gT1BFTkVEKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIGlmIChoYXNPYnNlcnZlKVxuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXy5kZWxpdmVyKGZhbHNlKTtcbiAgICAgIGVsc2VcbiAgICAgICAgZGlydHlDaGVjayh0aGlzKTtcbiAgICB9LFxuXG4gICAgZGlzY2FyZENoYW5nZXM6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuZGlyZWN0T2JzZXJ2ZXJfKVxuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXy5kZWxpdmVyKHRydWUpO1xuICAgICAgZWxzZVxuICAgICAgICB0aGlzLm9sZE9iamVjdF8gPSB0aGlzLmNvcHlPYmplY3QodGhpcy52YWx1ZV8pO1xuXG4gICAgICByZXR1cm4gdGhpcy52YWx1ZV87XG4gICAgfVxuICB9KTtcblxuICBmdW5jdGlvbiBBcnJheU9ic2VydmVyKGFycmF5KSB7XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGFycmF5KSlcbiAgICAgIHRocm93IEVycm9yKCdQcm92aWRlZCBvYmplY3QgaXMgbm90IGFuIEFycmF5Jyk7XG4gICAgT2JqZWN0T2JzZXJ2ZXIuY2FsbCh0aGlzLCBhcnJheSk7XG4gIH1cblxuICBBcnJheU9ic2VydmVyLnByb3RvdHlwZSA9IGNyZWF0ZU9iamVjdCh7XG5cbiAgICBfX3Byb3RvX186IE9iamVjdE9ic2VydmVyLnByb3RvdHlwZSxcblxuICAgIGFycmF5T2JzZXJ2ZTogdHJ1ZSxcblxuICAgIGNvcHlPYmplY3Q6IGZ1bmN0aW9uKGFycikge1xuICAgICAgcmV0dXJuIGFyci5zbGljZSgpO1xuICAgIH0sXG5cbiAgICBjaGVja186IGZ1bmN0aW9uKGNoYW5nZVJlY29yZHMpIHtcbiAgICAgIHZhciBzcGxpY2VzO1xuICAgICAgaWYgKGhhc09ic2VydmUpIHtcbiAgICAgICAgaWYgKCFjaGFuZ2VSZWNvcmRzKVxuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgc3BsaWNlcyA9IHByb2plY3RBcnJheVNwbGljZXModGhpcy52YWx1ZV8sIGNoYW5nZVJlY29yZHMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3BsaWNlcyA9IGNhbGNTcGxpY2VzKHRoaXMudmFsdWVfLCAwLCB0aGlzLnZhbHVlXy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm9sZE9iamVjdF8sIDAsIHRoaXMub2xkT2JqZWN0Xy5sZW5ndGgpO1xuICAgICAgfVxuXG4gICAgICBpZiAoIXNwbGljZXMgfHwgIXNwbGljZXMubGVuZ3RoKVxuICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgIGlmICghaGFzT2JzZXJ2ZSlcbiAgICAgICAgdGhpcy5vbGRPYmplY3RfID0gdGhpcy5jb3B5T2JqZWN0KHRoaXMudmFsdWVfKTtcblxuICAgICAgdGhpcy5yZXBvcnRfKFtzcGxpY2VzXSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH0pO1xuXG4gIEFycmF5T2JzZXJ2ZXIuYXBwbHlTcGxpY2VzID0gZnVuY3Rpb24ocHJldmlvdXMsIGN1cnJlbnQsIHNwbGljZXMpIHtcbiAgICBzcGxpY2VzLmZvckVhY2goZnVuY3Rpb24oc3BsaWNlKSB7XG4gICAgICB2YXIgc3BsaWNlQXJncyA9IFtzcGxpY2UuaW5kZXgsIHNwbGljZS5yZW1vdmVkLmxlbmd0aF07XG4gICAgICB2YXIgYWRkSW5kZXggPSBzcGxpY2UuaW5kZXg7XG4gICAgICB3aGlsZSAoYWRkSW5kZXggPCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCkge1xuICAgICAgICBzcGxpY2VBcmdzLnB1c2goY3VycmVudFthZGRJbmRleF0pO1xuICAgICAgICBhZGRJbmRleCsrO1xuICAgICAgfVxuXG4gICAgICBBcnJheS5wcm90b3R5cGUuc3BsaWNlLmFwcGx5KHByZXZpb3VzLCBzcGxpY2VBcmdzKTtcbiAgICB9KTtcbiAgfTtcblxuICBmdW5jdGlvbiBQYXRoT2JzZXJ2ZXIob2JqZWN0LCBwYXRoKSB7XG4gICAgT2JzZXJ2ZXIuY2FsbCh0aGlzKTtcblxuICAgIHRoaXMub2JqZWN0XyA9IG9iamVjdDtcbiAgICB0aGlzLnBhdGhfID0gZ2V0UGF0aChwYXRoKTtcbiAgICB0aGlzLmRpcmVjdE9ic2VydmVyXyA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIFBhdGhPYnNlcnZlci5wcm90b3R5cGUgPSBjcmVhdGVPYmplY3Qoe1xuICAgIF9fcHJvdG9fXzogT2JzZXJ2ZXIucHJvdG90eXBlLFxuXG4gICAgZ2V0IHBhdGgoKSB7XG4gICAgICByZXR1cm4gdGhpcy5wYXRoXztcbiAgICB9LFxuXG4gICAgY29ubmVjdF86IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKGhhc09ic2VydmUpXG4gICAgICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfID0gZ2V0T2JzZXJ2ZWRTZXQodGhpcywgdGhpcy5vYmplY3RfKTtcblxuICAgICAgdGhpcy5jaGVja18odW5kZWZpbmVkLCB0cnVlKTtcbiAgICB9LFxuXG4gICAgZGlzY29ubmVjdF86IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy52YWx1ZV8gPSB1bmRlZmluZWQ7XG5cbiAgICAgIGlmICh0aGlzLmRpcmVjdE9ic2VydmVyXykge1xuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXy5jbG9zZSh0aGlzKTtcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8gPSB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgfSxcblxuICAgIGl0ZXJhdGVPYmplY3RzXzogZnVuY3Rpb24ob2JzZXJ2ZSkge1xuICAgICAgdGhpcy5wYXRoXy5pdGVyYXRlT2JqZWN0cyh0aGlzLm9iamVjdF8sIG9ic2VydmUpO1xuICAgIH0sXG5cbiAgICBjaGVja186IGZ1bmN0aW9uKGNoYW5nZVJlY29yZHMsIHNraXBDaGFuZ2VzKSB7XG4gICAgICB2YXIgb2xkVmFsdWUgPSB0aGlzLnZhbHVlXztcbiAgICAgIHRoaXMudmFsdWVfID0gdGhpcy5wYXRoXy5nZXRWYWx1ZUZyb20odGhpcy5vYmplY3RfKTtcbiAgICAgIGlmIChza2lwQ2hhbmdlcyB8fCBhcmVTYW1lVmFsdWUodGhpcy52YWx1ZV8sIG9sZFZhbHVlKSlcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICB0aGlzLnJlcG9ydF8oW3RoaXMudmFsdWVfLCBvbGRWYWx1ZSwgdGhpc10pO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSxcblxuICAgIHNldFZhbHVlOiBmdW5jdGlvbihuZXdWYWx1ZSkge1xuICAgICAgaWYgKHRoaXMucGF0aF8pXG4gICAgICAgIHRoaXMucGF0aF8uc2V0VmFsdWVGcm9tKHRoaXMub2JqZWN0XywgbmV3VmFsdWUpO1xuICAgIH1cbiAgfSk7XG5cbiAgZnVuY3Rpb24gQ29tcG91bmRPYnNlcnZlcihyZXBvcnRDaGFuZ2VzT25PcGVuKSB7XG4gICAgT2JzZXJ2ZXIuY2FsbCh0aGlzKTtcblxuICAgIHRoaXMucmVwb3J0Q2hhbmdlc09uT3Blbl8gPSByZXBvcnRDaGFuZ2VzT25PcGVuO1xuICAgIHRoaXMudmFsdWVfID0gW107XG4gICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8gPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5vYnNlcnZlZF8gPSBbXTtcbiAgfVxuXG4gIHZhciBvYnNlcnZlclNlbnRpbmVsID0ge307XG5cbiAgQ29tcG91bmRPYnNlcnZlci5wcm90b3R5cGUgPSBjcmVhdGVPYmplY3Qoe1xuICAgIF9fcHJvdG9fXzogT2JzZXJ2ZXIucHJvdG90eXBlLFxuXG4gICAgY29ubmVjdF86IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKGhhc09ic2VydmUpIHtcbiAgICAgICAgdmFyIG9iamVjdDtcbiAgICAgICAgdmFyIG5lZWRzRGlyZWN0T2JzZXJ2ZXIgPSBmYWxzZTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLm9ic2VydmVkXy5sZW5ndGg7IGkgKz0gMikge1xuICAgICAgICAgIG9iamVjdCA9IHRoaXMub2JzZXJ2ZWRfW2ldXG4gICAgICAgICAgaWYgKG9iamVjdCAhPT0gb2JzZXJ2ZXJTZW50aW5lbCkge1xuICAgICAgICAgICAgbmVlZHNEaXJlY3RPYnNlcnZlciA9IHRydWU7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobmVlZHNEaXJlY3RPYnNlcnZlcilcbiAgICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXyA9IGdldE9ic2VydmVkU2V0KHRoaXMsIG9iamVjdCk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuY2hlY2tfKHVuZGVmaW5lZCwgIXRoaXMucmVwb3J0Q2hhbmdlc09uT3Blbl8pO1xuICAgIH0sXG5cbiAgICBkaXNjb25uZWN0XzogZnVuY3Rpb24oKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMub2JzZXJ2ZWRfLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgICAgIGlmICh0aGlzLm9ic2VydmVkX1tpXSA9PT0gb2JzZXJ2ZXJTZW50aW5lbClcbiAgICAgICAgICB0aGlzLm9ic2VydmVkX1tpICsgMV0uY2xvc2UoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMub2JzZXJ2ZWRfLmxlbmd0aCA9IDA7XG4gICAgICB0aGlzLnZhbHVlXy5sZW5ndGggPSAwO1xuXG4gICAgICBpZiAodGhpcy5kaXJlY3RPYnNlcnZlcl8pIHtcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8uY2xvc2UodGhpcyk7XG4gICAgICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfID0gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICBhZGRQYXRoOiBmdW5jdGlvbihvYmplY3QsIHBhdGgpIHtcbiAgICAgIGlmICh0aGlzLnN0YXRlXyAhPSBVTk9QRU5FRCAmJiB0aGlzLnN0YXRlXyAhPSBSRVNFVFRJTkcpXG4gICAgICAgIHRocm93IEVycm9yKCdDYW5ub3QgYWRkIHBhdGhzIG9uY2Ugc3RhcnRlZC4nKTtcblxuICAgICAgdmFyIHBhdGggPSBnZXRQYXRoKHBhdGgpO1xuICAgICAgdGhpcy5vYnNlcnZlZF8ucHVzaChvYmplY3QsIHBhdGgpO1xuICAgICAgaWYgKCF0aGlzLnJlcG9ydENoYW5nZXNPbk9wZW5fKVxuICAgICAgICByZXR1cm47XG4gICAgICB2YXIgaW5kZXggPSB0aGlzLm9ic2VydmVkXy5sZW5ndGggLyAyIC0gMTtcbiAgICAgIHRoaXMudmFsdWVfW2luZGV4XSA9IHBhdGguZ2V0VmFsdWVGcm9tKG9iamVjdCk7XG4gICAgfSxcblxuICAgIGFkZE9ic2VydmVyOiBmdW5jdGlvbihvYnNlcnZlcikge1xuICAgICAgaWYgKHRoaXMuc3RhdGVfICE9IFVOT1BFTkVEICYmIHRoaXMuc3RhdGVfICE9IFJFU0VUVElORylcbiAgICAgICAgdGhyb3cgRXJyb3IoJ0Nhbm5vdCBhZGQgb2JzZXJ2ZXJzIG9uY2Ugc3RhcnRlZC4nKTtcblxuICAgICAgdGhpcy5vYnNlcnZlZF8ucHVzaChvYnNlcnZlclNlbnRpbmVsLCBvYnNlcnZlcik7XG4gICAgICBpZiAoIXRoaXMucmVwb3J0Q2hhbmdlc09uT3Blbl8pXG4gICAgICAgIHJldHVybjtcbiAgICAgIHZhciBpbmRleCA9IHRoaXMub2JzZXJ2ZWRfLmxlbmd0aCAvIDIgLSAxO1xuICAgICAgdGhpcy52YWx1ZV9baW5kZXhdID0gb2JzZXJ2ZXIub3Blbih0aGlzLmRlbGl2ZXIsIHRoaXMpO1xuICAgIH0sXG5cbiAgICBzdGFydFJlc2V0OiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLnN0YXRlXyAhPSBPUEVORUQpXG4gICAgICAgIHRocm93IEVycm9yKCdDYW4gb25seSByZXNldCB3aGlsZSBvcGVuJyk7XG5cbiAgICAgIHRoaXMuc3RhdGVfID0gUkVTRVRUSU5HO1xuICAgICAgdGhpcy5kaXNjb25uZWN0XygpO1xuICAgIH0sXG5cbiAgICBmaW5pc2hSZXNldDogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5zdGF0ZV8gIT0gUkVTRVRUSU5HKVxuICAgICAgICB0aHJvdyBFcnJvcignQ2FuIG9ubHkgZmluaXNoUmVzZXQgYWZ0ZXIgc3RhcnRSZXNldCcpO1xuICAgICAgdGhpcy5zdGF0ZV8gPSBPUEVORUQ7XG4gICAgICB0aGlzLmNvbm5lY3RfKCk7XG5cbiAgICAgIHJldHVybiB0aGlzLnZhbHVlXztcbiAgICB9LFxuXG4gICAgaXRlcmF0ZU9iamVjdHNfOiBmdW5jdGlvbihvYnNlcnZlKSB7XG4gICAgICB2YXIgb2JqZWN0O1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLm9ic2VydmVkXy5sZW5ndGg7IGkgKz0gMikge1xuICAgICAgICBvYmplY3QgPSB0aGlzLm9ic2VydmVkX1tpXVxuICAgICAgICBpZiAob2JqZWN0ICE9PSBvYnNlcnZlclNlbnRpbmVsKVxuICAgICAgICAgIHRoaXMub2JzZXJ2ZWRfW2kgKyAxXS5pdGVyYXRlT2JqZWN0cyhvYmplY3QsIG9ic2VydmUpXG4gICAgICB9XG4gICAgfSxcblxuICAgIGNoZWNrXzogZnVuY3Rpb24oY2hhbmdlUmVjb3Jkcywgc2tpcENoYW5nZXMpIHtcbiAgICAgIHZhciBvbGRWYWx1ZXM7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMub2JzZXJ2ZWRfLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgICAgIHZhciBvYmplY3QgPSB0aGlzLm9ic2VydmVkX1tpXTtcbiAgICAgICAgdmFyIHBhdGggPSB0aGlzLm9ic2VydmVkX1tpKzFdO1xuICAgICAgICB2YXIgdmFsdWU7XG4gICAgICAgIGlmIChvYmplY3QgPT09IG9ic2VydmVyU2VudGluZWwpIHtcbiAgICAgICAgICB2YXIgb2JzZXJ2YWJsZSA9IHBhdGg7XG4gICAgICAgICAgdmFsdWUgPSB0aGlzLnN0YXRlXyA9PT0gVU5PUEVORUQgP1xuICAgICAgICAgICAgICBvYnNlcnZhYmxlLm9wZW4odGhpcy5kZWxpdmVyLCB0aGlzKSA6XG4gICAgICAgICAgICAgIG9ic2VydmFibGUuZGlzY2FyZENoYW5nZXMoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YWx1ZSA9IHBhdGguZ2V0VmFsdWVGcm9tKG9iamVjdCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc2tpcENoYW5nZXMpIHtcbiAgICAgICAgICB0aGlzLnZhbHVlX1tpIC8gMl0gPSB2YWx1ZTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhcmVTYW1lVmFsdWUodmFsdWUsIHRoaXMudmFsdWVfW2kgLyAyXSkpXG4gICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgb2xkVmFsdWVzID0gb2xkVmFsdWVzIHx8IFtdO1xuICAgICAgICBvbGRWYWx1ZXNbaSAvIDJdID0gdGhpcy52YWx1ZV9baSAvIDJdO1xuICAgICAgICB0aGlzLnZhbHVlX1tpIC8gMl0gPSB2YWx1ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFvbGRWYWx1ZXMpXG4gICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgLy8gVE9ETyhyYWZhZWx3KTogSGF2aW5nIG9ic2VydmVkXyBhcyB0aGUgdGhpcmQgY2FsbGJhY2sgYXJnIGhlcmUgaXNcbiAgICAgIC8vIHByZXR0eSBsYW1lIEFQSS4gRml4LlxuICAgICAgdGhpcy5yZXBvcnRfKFt0aGlzLnZhbHVlXywgb2xkVmFsdWVzLCB0aGlzLm9ic2VydmVkX10pO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9KTtcblxuICBmdW5jdGlvbiBpZGVudEZuKHZhbHVlKSB7IHJldHVybiB2YWx1ZTsgfVxuXG4gIGZ1bmN0aW9uIE9ic2VydmVyVHJhbnNmb3JtKG9ic2VydmFibGUsIGdldFZhbHVlRm4sIHNldFZhbHVlRm4sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRvbnRQYXNzVGhyb3VnaFNldCkge1xuICAgIHRoaXMuY2FsbGJhY2tfID0gdW5kZWZpbmVkO1xuICAgIHRoaXMudGFyZ2V0XyA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLnZhbHVlXyA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLm9ic2VydmFibGVfID0gb2JzZXJ2YWJsZTtcbiAgICB0aGlzLmdldFZhbHVlRm5fID0gZ2V0VmFsdWVGbiB8fCBpZGVudEZuO1xuICAgIHRoaXMuc2V0VmFsdWVGbl8gPSBzZXRWYWx1ZUZuIHx8IGlkZW50Rm47XG4gICAgLy8gVE9ETyhyYWZhZWx3KTogVGhpcyBpcyBhIHRlbXBvcmFyeSBoYWNrLiBQb2x5bWVyRXhwcmVzc2lvbnMgbmVlZHMgdGhpc1xuICAgIC8vIGF0IHRoZSBtb21lbnQgYmVjYXVzZSBvZiBhIGJ1ZyBpbiBpdCdzaWVzdGEgZGVwZW5kZW5jeSB0cmFja2luZy5cbiAgICB0aGlzLmRvbnRQYXNzVGhyb3VnaFNldF8gPSBkb250UGFzc1Rocm91Z2hTZXQ7XG4gIH1cblxuICBPYnNlcnZlclRyYW5zZm9ybS5wcm90b3R5cGUgPSB7XG4gICAgb3BlbjogZnVuY3Rpb24oY2FsbGJhY2ssIHRhcmdldCkge1xuICAgICAgdGhpcy5jYWxsYmFja18gPSBjYWxsYmFjaztcbiAgICAgIHRoaXMudGFyZ2V0XyA9IHRhcmdldDtcbiAgICAgIHRoaXMudmFsdWVfID1cbiAgICAgICAgICB0aGlzLmdldFZhbHVlRm5fKHRoaXMub2JzZXJ2YWJsZV8ub3Blbih0aGlzLm9ic2VydmVkQ2FsbGJhY2tfLCB0aGlzKSk7XG4gICAgICByZXR1cm4gdGhpcy52YWx1ZV87XG4gICAgfSxcblxuICAgIG9ic2VydmVkQ2FsbGJhY2tfOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgdmFsdWUgPSB0aGlzLmdldFZhbHVlRm5fKHZhbHVlKTtcbiAgICAgIGlmIChhcmVTYW1lVmFsdWUodmFsdWUsIHRoaXMudmFsdWVfKSlcbiAgICAgICAgcmV0dXJuO1xuICAgICAgdmFyIG9sZFZhbHVlID0gdGhpcy52YWx1ZV87XG4gICAgICB0aGlzLnZhbHVlXyA9IHZhbHVlO1xuICAgICAgdGhpcy5jYWxsYmFja18uY2FsbCh0aGlzLnRhcmdldF8sIHRoaXMudmFsdWVfLCBvbGRWYWx1ZSk7XG4gICAgfSxcblxuICAgIGRpc2NhcmRDaGFuZ2VzOiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMudmFsdWVfID0gdGhpcy5nZXRWYWx1ZUZuXyh0aGlzLm9ic2VydmFibGVfLmRpc2NhcmRDaGFuZ2VzKCkpO1xuICAgICAgcmV0dXJuIHRoaXMudmFsdWVfO1xuICAgIH0sXG5cbiAgICBkZWxpdmVyOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLm9ic2VydmFibGVfLmRlbGl2ZXIoKTtcbiAgICB9LFxuXG4gICAgc2V0VmFsdWU6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICB2YWx1ZSA9IHRoaXMuc2V0VmFsdWVGbl8odmFsdWUpO1xuICAgICAgaWYgKCF0aGlzLmRvbnRQYXNzVGhyb3VnaFNldF8gJiYgdGhpcy5vYnNlcnZhYmxlXy5zZXRWYWx1ZSlcbiAgICAgICAgcmV0dXJuIHRoaXMub2JzZXJ2YWJsZV8uc2V0VmFsdWUodmFsdWUpO1xuICAgIH0sXG5cbiAgICBjbG9zZTogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5vYnNlcnZhYmxlXylcbiAgICAgICAgdGhpcy5vYnNlcnZhYmxlXy5jbG9zZSgpO1xuICAgICAgdGhpcy5jYWxsYmFja18gPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLnRhcmdldF8gPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLm9ic2VydmFibGVfID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy52YWx1ZV8gPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLmdldFZhbHVlRm5fID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy5zZXRWYWx1ZUZuXyA9IHVuZGVmaW5lZDtcbiAgICB9XG4gIH1cblxuICB2YXIgZXhwZWN0ZWRSZWNvcmRUeXBlcyA9IHtcbiAgICBhZGQ6IHRydWUsXG4gICAgdXBkYXRlOiB0cnVlLFxuICAgIGRlbGV0ZTogdHJ1ZVxuICB9O1xuXG4gIGZ1bmN0aW9uIGRpZmZPYmplY3RGcm9tQ2hhbmdlUmVjb3JkcyhvYmplY3QsIGNoYW5nZVJlY29yZHMsIG9sZFZhbHVlcykge1xuICAgIHZhciBhZGRlZCA9IHt9O1xuICAgIHZhciByZW1vdmVkID0ge307XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoYW5nZVJlY29yZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciByZWNvcmQgPSBjaGFuZ2VSZWNvcmRzW2ldO1xuICAgICAgaWYgKCFleHBlY3RlZFJlY29yZFR5cGVzW3JlY29yZC50eXBlXSkge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdVbmtub3duIGNoYW5nZVJlY29yZCB0eXBlOiAnICsgcmVjb3JkLnR5cGUpO1xuICAgICAgICBjb25zb2xlLmVycm9yKHJlY29yZCk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoIShyZWNvcmQubmFtZSBpbiBvbGRWYWx1ZXMpKVxuICAgICAgICBvbGRWYWx1ZXNbcmVjb3JkLm5hbWVdID0gcmVjb3JkLm9sZFZhbHVlO1xuXG4gICAgICBpZiAocmVjb3JkLnR5cGUgPT0gJ3VwZGF0ZScpXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICBpZiAocmVjb3JkLnR5cGUgPT0gJ2FkZCcpIHtcbiAgICAgICAgaWYgKHJlY29yZC5uYW1lIGluIHJlbW92ZWQpXG4gICAgICAgICAgZGVsZXRlIHJlbW92ZWRbcmVjb3JkLm5hbWVdO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgYWRkZWRbcmVjb3JkLm5hbWVdID0gdHJ1ZTtcblxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gdHlwZSA9ICdkZWxldGUnXG4gICAgICBpZiAocmVjb3JkLm5hbWUgaW4gYWRkZWQpIHtcbiAgICAgICAgZGVsZXRlIGFkZGVkW3JlY29yZC5uYW1lXTtcbiAgICAgICAgZGVsZXRlIG9sZFZhbHVlc1tyZWNvcmQubmFtZV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZW1vdmVkW3JlY29yZC5uYW1lXSA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yICh2YXIgcHJvcCBpbiBhZGRlZClcbiAgICAgIGFkZGVkW3Byb3BdID0gb2JqZWN0W3Byb3BdO1xuXG4gICAgZm9yICh2YXIgcHJvcCBpbiByZW1vdmVkKVxuICAgICAgcmVtb3ZlZFtwcm9wXSA9IHVuZGVmaW5lZDtcblxuICAgIHZhciBjaGFuZ2VkID0ge307XG4gICAgZm9yICh2YXIgcHJvcCBpbiBvbGRWYWx1ZXMpIHtcbiAgICAgIGlmIChwcm9wIGluIGFkZGVkIHx8IHByb3AgaW4gcmVtb3ZlZClcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIHZhciBuZXdWYWx1ZSA9IG9iamVjdFtwcm9wXTtcbiAgICAgIGlmIChvbGRWYWx1ZXNbcHJvcF0gIT09IG5ld1ZhbHVlKVxuICAgICAgICBjaGFuZ2VkW3Byb3BdID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGFkZGVkOiBhZGRlZCxcbiAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgICBjaGFuZ2VkOiBjaGFuZ2VkXG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG5ld1NwbGljZShpbmRleCwgcmVtb3ZlZCwgYWRkZWRDb3VudCkge1xuICAgIHJldHVybiB7XG4gICAgICBpbmRleDogaW5kZXgsXG4gICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgICAgYWRkZWRDb3VudDogYWRkZWRDb3VudFxuICAgIH07XG4gIH1cblxuICB2YXIgRURJVF9MRUFWRSA9IDA7XG4gIHZhciBFRElUX1VQREFURSA9IDE7XG4gIHZhciBFRElUX0FERCA9IDI7XG4gIHZhciBFRElUX0RFTEVURSA9IDM7XG5cbiAgZnVuY3Rpb24gQXJyYXlTcGxpY2UoKSB7fVxuXG4gIEFycmF5U3BsaWNlLnByb3RvdHlwZSA9IHtcblxuICAgIC8vIE5vdGU6IFRoaXMgZnVuY3Rpb24gaXMgKmJhc2VkKiBvbiB0aGUgY29tcHV0YXRpb24gb2YgdGhlIExldmVuc2h0ZWluXG4gICAgLy8gXCJlZGl0XCIgZGlzdGFuY2UuIFRoZSBvbmUgY2hhbmdlIGlzIHRoYXQgXCJ1cGRhdGVzXCIgYXJlIHRyZWF0ZWQgYXMgdHdvXG4gICAgLy8gZWRpdHMgLSBub3Qgb25lLiBXaXRoIEFycmF5IHNwbGljZXMsIGFuIHVwZGF0ZSBpcyByZWFsbHkgYSBkZWxldGVcbiAgICAvLyBmb2xsb3dlZCBieSBhbiBhZGQuIEJ5IHJldGFpbmluZyB0aGlzLCB3ZSBvcHRpbWl6ZSBmb3IgXCJrZWVwaW5nXCIgdGhlXG4gICAgLy8gbWF4aW11bSBhcnJheSBpdGVtcyBpbiB0aGUgb3JpZ2luYWwgYXJyYXkuIEZvciBleGFtcGxlOlxuICAgIC8vXG4gICAgLy8gICAneHh4eDEyMycgLT4gJzEyM3l5eXknXG4gICAgLy9cbiAgICAvLyBXaXRoIDEtZWRpdCB1cGRhdGVzLCB0aGUgc2hvcnRlc3QgcGF0aCB3b3VsZCBiZSBqdXN0IHRvIHVwZGF0ZSBhbGwgc2V2ZW5cbiAgICAvLyBjaGFyYWN0ZXJzLiBXaXRoIDItZWRpdCB1cGRhdGVzLCB3ZSBkZWxldGUgNCwgbGVhdmUgMywgYW5kIGFkZCA0LiBUaGlzXG4gICAgLy8gbGVhdmVzIHRoZSBzdWJzdHJpbmcgJzEyMycgaW50YWN0LlxuICAgIGNhbGNFZGl0RGlzdGFuY2VzOiBmdW5jdGlvbihjdXJyZW50LCBjdXJyZW50U3RhcnQsIGN1cnJlbnRFbmQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZCwgb2xkU3RhcnQsIG9sZEVuZCkge1xuICAgICAgLy8gXCJEZWxldGlvblwiIGNvbHVtbnNcbiAgICAgIHZhciByb3dDb3VudCA9IG9sZEVuZCAtIG9sZFN0YXJ0ICsgMTtcbiAgICAgIHZhciBjb2x1bW5Db3VudCA9IGN1cnJlbnRFbmQgLSBjdXJyZW50U3RhcnQgKyAxO1xuICAgICAgdmFyIGRpc3RhbmNlcyA9IG5ldyBBcnJheShyb3dDb3VudCk7XG5cbiAgICAgIC8vIFwiQWRkaXRpb25cIiByb3dzLiBJbml0aWFsaXplIG51bGwgY29sdW1uLlxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByb3dDb3VudDsgaSsrKSB7XG4gICAgICAgIGRpc3RhbmNlc1tpXSA9IG5ldyBBcnJheShjb2x1bW5Db3VudCk7XG4gICAgICAgIGRpc3RhbmNlc1tpXVswXSA9IGk7XG4gICAgICB9XG5cbiAgICAgIC8vIEluaXRpYWxpemUgbnVsbCByb3dcbiAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgY29sdW1uQ291bnQ7IGorKylcbiAgICAgICAgZGlzdGFuY2VzWzBdW2pdID0gajtcblxuICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCByb3dDb3VudDsgaSsrKSB7XG4gICAgICAgIGZvciAodmFyIGogPSAxOyBqIDwgY29sdW1uQ291bnQ7IGorKykge1xuICAgICAgICAgIGlmICh0aGlzLmVxdWFscyhjdXJyZW50W2N1cnJlbnRTdGFydCArIGogLSAxXSwgb2xkW29sZFN0YXJ0ICsgaSAtIDFdKSlcbiAgICAgICAgICAgIGRpc3RhbmNlc1tpXVtqXSA9IGRpc3RhbmNlc1tpIC0gMV1baiAtIDFdO1xuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdmFyIG5vcnRoID0gZGlzdGFuY2VzW2kgLSAxXVtqXSArIDE7XG4gICAgICAgICAgICB2YXIgd2VzdCA9IGRpc3RhbmNlc1tpXVtqIC0gMV0gKyAxO1xuICAgICAgICAgICAgZGlzdGFuY2VzW2ldW2pdID0gbm9ydGggPCB3ZXN0ID8gbm9ydGggOiB3ZXN0O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gZGlzdGFuY2VzO1xuICAgIH0sXG5cbiAgICAvLyBUaGlzIHN0YXJ0cyBhdCB0aGUgZmluYWwgd2VpZ2h0LCBhbmQgd2Fsa3MgXCJiYWNrd2FyZFwiIGJ5IGZpbmRpbmdcbiAgICAvLyB0aGUgbWluaW11bSBwcmV2aW91cyB3ZWlnaHQgcmVjdXJzaXZlbHkgdW50aWwgdGhlIG9yaWdpbiBvZiB0aGUgd2VpZ2h0XG4gICAgLy8gbWF0cml4LlxuICAgIHNwbGljZU9wZXJhdGlvbnNGcm9tRWRpdERpc3RhbmNlczogZnVuY3Rpb24oZGlzdGFuY2VzKSB7XG4gICAgICB2YXIgaSA9IGRpc3RhbmNlcy5sZW5ndGggLSAxO1xuICAgICAgdmFyIGogPSBkaXN0YW5jZXNbMF0ubGVuZ3RoIC0gMTtcbiAgICAgIHZhciBjdXJyZW50ID0gZGlzdGFuY2VzW2ldW2pdO1xuICAgICAgdmFyIGVkaXRzID0gW107XG4gICAgICB3aGlsZSAoaSA+IDAgfHwgaiA+IDApIHtcbiAgICAgICAgaWYgKGkgPT0gMCkge1xuICAgICAgICAgIGVkaXRzLnB1c2goRURJVF9BREQpO1xuICAgICAgICAgIGotLTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaiA9PSAwKSB7XG4gICAgICAgICAgZWRpdHMucHVzaChFRElUX0RFTEVURSk7XG4gICAgICAgICAgaS0tO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIHZhciBub3J0aFdlc3QgPSBkaXN0YW5jZXNbaSAtIDFdW2ogLSAxXTtcbiAgICAgICAgdmFyIHdlc3QgPSBkaXN0YW5jZXNbaSAtIDFdW2pdO1xuICAgICAgICB2YXIgbm9ydGggPSBkaXN0YW5jZXNbaV1baiAtIDFdO1xuXG4gICAgICAgIHZhciBtaW47XG4gICAgICAgIGlmICh3ZXN0IDwgbm9ydGgpXG4gICAgICAgICAgbWluID0gd2VzdCA8IG5vcnRoV2VzdCA/IHdlc3QgOiBub3J0aFdlc3Q7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICBtaW4gPSBub3J0aCA8IG5vcnRoV2VzdCA/IG5vcnRoIDogbm9ydGhXZXN0O1xuXG4gICAgICAgIGlmIChtaW4gPT0gbm9ydGhXZXN0KSB7XG4gICAgICAgICAgaWYgKG5vcnRoV2VzdCA9PSBjdXJyZW50KSB7XG4gICAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfTEVBVkUpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfVVBEQVRFKTtcbiAgICAgICAgICAgIGN1cnJlbnQgPSBub3J0aFdlc3Q7XG4gICAgICAgICAgfVxuICAgICAgICAgIGktLTtcbiAgICAgICAgICBqLS07XG4gICAgICAgIH0gZWxzZSBpZiAobWluID09IHdlc3QpIHtcbiAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfREVMRVRFKTtcbiAgICAgICAgICBpLS07XG4gICAgICAgICAgY3VycmVudCA9IHdlc3Q7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZWRpdHMucHVzaChFRElUX0FERCk7XG4gICAgICAgICAgai0tO1xuICAgICAgICAgIGN1cnJlbnQgPSBub3J0aDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBlZGl0cy5yZXZlcnNlKCk7XG4gICAgICByZXR1cm4gZWRpdHM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFNwbGljZSBQcm9qZWN0aW9uIGZ1bmN0aW9uczpcbiAgICAgKlxuICAgICAqIEEgc3BsaWNlIG1hcCBpcyBhIHJlcHJlc2VudGF0aW9uIG9mIGhvdyBhIHByZXZpb3VzIGFycmF5IG9mIGl0ZW1zXG4gICAgICogd2FzIHRyYW5zZm9ybWVkIGludG8gYSBuZXcgYXJyYXkgb2YgaXRlbXMuIENvbmNlcHR1YWxseSBpdCBpcyBhIGxpc3Qgb2ZcbiAgICAgKiB0dXBsZXMgb2ZcbiAgICAgKlxuICAgICAqICAgPGluZGV4LCByZW1vdmVkLCBhZGRlZENvdW50PlxuICAgICAqXG4gICAgICogd2hpY2ggYXJlIGtlcHQgaW4gYXNjZW5kaW5nIGluZGV4IG9yZGVyIG9mLiBUaGUgdHVwbGUgcmVwcmVzZW50cyB0aGF0IGF0XG4gICAgICogdGhlIHxpbmRleHwsIHxyZW1vdmVkfCBzZXF1ZW5jZSBvZiBpdGVtcyB3ZXJlIHJlbW92ZWQsIGFuZCBjb3VudGluZyBmb3J3YXJkXG4gICAgICogZnJvbSB8aW5kZXh8LCB8YWRkZWRDb3VudHwgaXRlbXMgd2VyZSBhZGRlZC5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIExhY2tpbmcgaW5kaXZpZHVhbCBzcGxpY2UgbXV0YXRpb24gaW5mb3JtYXRpb24sIHRoZSBtaW5pbWFsIHNldCBvZlxuICAgICAqIHNwbGljZXMgY2FuIGJlIHN5bnRoZXNpemVkIGdpdmVuIHRoZSBwcmV2aW91cyBzdGF0ZSBhbmQgZmluYWwgc3RhdGUgb2YgYW5cbiAgICAgKiBhcnJheS4gVGhlIGJhc2ljIGFwcHJvYWNoIGlzIHRvIGNhbGN1bGF0ZSB0aGUgZWRpdCBkaXN0YW5jZSBtYXRyaXggYW5kXG4gICAgICogY2hvb3NlIHRoZSBzaG9ydGVzdCBwYXRoIHRocm91Z2ggaXQuXG4gICAgICpcbiAgICAgKiBDb21wbGV4aXR5OiBPKGwgKiBwKVxuICAgICAqICAgbDogVGhlIGxlbmd0aCBvZiB0aGUgY3VycmVudCBhcnJheVxuICAgICAqICAgcDogVGhlIGxlbmd0aCBvZiB0aGUgb2xkIGFycmF5XG4gICAgICovXG4gICAgY2FsY1NwbGljZXM6IGZ1bmN0aW9uKGN1cnJlbnQsIGN1cnJlbnRTdGFydCwgY3VycmVudEVuZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkLCBvbGRTdGFydCwgb2xkRW5kKSB7XG4gICAgICB2YXIgcHJlZml4Q291bnQgPSAwO1xuICAgICAgdmFyIHN1ZmZpeENvdW50ID0gMDtcblxuICAgICAgdmFyIG1pbkxlbmd0aCA9IE1hdGgubWluKGN1cnJlbnRFbmQgLSBjdXJyZW50U3RhcnQsIG9sZEVuZCAtIG9sZFN0YXJ0KTtcbiAgICAgIGlmIChjdXJyZW50U3RhcnQgPT0gMCAmJiBvbGRTdGFydCA9PSAwKVxuICAgICAgICBwcmVmaXhDb3VudCA9IHRoaXMuc2hhcmVkUHJlZml4KGN1cnJlbnQsIG9sZCwgbWluTGVuZ3RoKTtcblxuICAgICAgaWYgKGN1cnJlbnRFbmQgPT0gY3VycmVudC5sZW5ndGggJiYgb2xkRW5kID09IG9sZC5sZW5ndGgpXG4gICAgICAgIHN1ZmZpeENvdW50ID0gdGhpcy5zaGFyZWRTdWZmaXgoY3VycmVudCwgb2xkLCBtaW5MZW5ndGggLSBwcmVmaXhDb3VudCk7XG5cbiAgICAgIGN1cnJlbnRTdGFydCArPSBwcmVmaXhDb3VudDtcbiAgICAgIG9sZFN0YXJ0ICs9IHByZWZpeENvdW50O1xuICAgICAgY3VycmVudEVuZCAtPSBzdWZmaXhDb3VudDtcbiAgICAgIG9sZEVuZCAtPSBzdWZmaXhDb3VudDtcblxuICAgICAgaWYgKGN1cnJlbnRFbmQgLSBjdXJyZW50U3RhcnQgPT0gMCAmJiBvbGRFbmQgLSBvbGRTdGFydCA9PSAwKVxuICAgICAgICByZXR1cm4gW107XG5cbiAgICAgIGlmIChjdXJyZW50U3RhcnQgPT0gY3VycmVudEVuZCkge1xuICAgICAgICB2YXIgc3BsaWNlID0gbmV3U3BsaWNlKGN1cnJlbnRTdGFydCwgW10sIDApO1xuICAgICAgICB3aGlsZSAob2xkU3RhcnQgPCBvbGRFbmQpXG4gICAgICAgICAgc3BsaWNlLnJlbW92ZWQucHVzaChvbGRbb2xkU3RhcnQrK10pO1xuXG4gICAgICAgIHJldHVybiBbIHNwbGljZSBdO1xuICAgICAgfSBlbHNlIGlmIChvbGRTdGFydCA9PSBvbGRFbmQpXG4gICAgICAgIHJldHVybiBbIG5ld1NwbGljZShjdXJyZW50U3RhcnQsIFtdLCBjdXJyZW50RW5kIC0gY3VycmVudFN0YXJ0KSBdO1xuXG4gICAgICB2YXIgb3BzID0gdGhpcy5zcGxpY2VPcGVyYXRpb25zRnJvbUVkaXREaXN0YW5jZXMoXG4gICAgICAgICAgdGhpcy5jYWxjRWRpdERpc3RhbmNlcyhjdXJyZW50LCBjdXJyZW50U3RhcnQsIGN1cnJlbnRFbmQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGQsIG9sZFN0YXJ0LCBvbGRFbmQpKTtcblxuICAgICAgdmFyIHNwbGljZSA9IHVuZGVmaW5lZDtcbiAgICAgIHZhciBzcGxpY2VzID0gW107XG4gICAgICB2YXIgaW5kZXggPSBjdXJyZW50U3RhcnQ7XG4gICAgICB2YXIgb2xkSW5kZXggPSBvbGRTdGFydDtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHN3aXRjaChvcHNbaV0pIHtcbiAgICAgICAgICBjYXNlIEVESVRfTEVBVkU6XG4gICAgICAgICAgICBpZiAoc3BsaWNlKSB7XG4gICAgICAgICAgICAgIHNwbGljZXMucHVzaChzcGxpY2UpO1xuICAgICAgICAgICAgICBzcGxpY2UgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGluZGV4Kys7XG4gICAgICAgICAgICBvbGRJbmRleCsrO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSBFRElUX1VQREFURTpcbiAgICAgICAgICAgIGlmICghc3BsaWNlKVxuICAgICAgICAgICAgICBzcGxpY2UgPSBuZXdTcGxpY2UoaW5kZXgsIFtdLCAwKTtcblxuICAgICAgICAgICAgc3BsaWNlLmFkZGVkQ291bnQrKztcbiAgICAgICAgICAgIGluZGV4Kys7XG5cbiAgICAgICAgICAgIHNwbGljZS5yZW1vdmVkLnB1c2gob2xkW29sZEluZGV4XSk7XG4gICAgICAgICAgICBvbGRJbmRleCsrO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSBFRElUX0FERDpcbiAgICAgICAgICAgIGlmICghc3BsaWNlKVxuICAgICAgICAgICAgICBzcGxpY2UgPSBuZXdTcGxpY2UoaW5kZXgsIFtdLCAwKTtcblxuICAgICAgICAgICAgc3BsaWNlLmFkZGVkQ291bnQrKztcbiAgICAgICAgICAgIGluZGV4Kys7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIEVESVRfREVMRVRFOlxuICAgICAgICAgICAgaWYgKCFzcGxpY2UpXG4gICAgICAgICAgICAgIHNwbGljZSA9IG5ld1NwbGljZShpbmRleCwgW10sIDApO1xuXG4gICAgICAgICAgICBzcGxpY2UucmVtb3ZlZC5wdXNoKG9sZFtvbGRJbmRleF0pO1xuICAgICAgICAgICAgb2xkSW5kZXgrKztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChzcGxpY2UpIHtcbiAgICAgICAgc3BsaWNlcy5wdXNoKHNwbGljZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gc3BsaWNlcztcbiAgICB9LFxuXG4gICAgc2hhcmVkUHJlZml4OiBmdW5jdGlvbihjdXJyZW50LCBvbGQsIHNlYXJjaExlbmd0aCkge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzZWFyY2hMZW5ndGg7IGkrKylcbiAgICAgICAgaWYgKCF0aGlzLmVxdWFscyhjdXJyZW50W2ldLCBvbGRbaV0pKVxuICAgICAgICAgIHJldHVybiBpO1xuICAgICAgcmV0dXJuIHNlYXJjaExlbmd0aDtcbiAgICB9LFxuXG4gICAgc2hhcmVkU3VmZml4OiBmdW5jdGlvbihjdXJyZW50LCBvbGQsIHNlYXJjaExlbmd0aCkge1xuICAgICAgdmFyIGluZGV4MSA9IGN1cnJlbnQubGVuZ3RoO1xuICAgICAgdmFyIGluZGV4MiA9IG9sZC5sZW5ndGg7XG4gICAgICB2YXIgY291bnQgPSAwO1xuICAgICAgd2hpbGUgKGNvdW50IDwgc2VhcmNoTGVuZ3RoICYmIHRoaXMuZXF1YWxzKGN1cnJlbnRbLS1pbmRleDFdLCBvbGRbLS1pbmRleDJdKSlcbiAgICAgICAgY291bnQrKztcblxuICAgICAgcmV0dXJuIGNvdW50O1xuICAgIH0sXG5cbiAgICBjYWxjdWxhdGVTcGxpY2VzOiBmdW5jdGlvbihjdXJyZW50LCBwcmV2aW91cykge1xuICAgICAgcmV0dXJuIHRoaXMuY2FsY1NwbGljZXMoY3VycmVudCwgMCwgY3VycmVudC5sZW5ndGgsIHByZXZpb3VzLCAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJldmlvdXMubGVuZ3RoKTtcbiAgICB9LFxuXG4gICAgZXF1YWxzOiBmdW5jdGlvbihjdXJyZW50VmFsdWUsIHByZXZpb3VzVmFsdWUpIHtcbiAgICAgIHJldHVybiBjdXJyZW50VmFsdWUgPT09IHByZXZpb3VzVmFsdWU7XG4gICAgfVxuICB9O1xuXG4gIHZhciBhcnJheVNwbGljZSA9IG5ldyBBcnJheVNwbGljZSgpO1xuXG4gIGZ1bmN0aW9uIGNhbGNTcGxpY2VzKGN1cnJlbnQsIGN1cnJlbnRTdGFydCwgY3VycmVudEVuZCxcbiAgICAgICAgICAgICAgICAgICAgICAgb2xkLCBvbGRTdGFydCwgb2xkRW5kKSB7XG4gICAgcmV0dXJuIGFycmF5U3BsaWNlLmNhbGNTcGxpY2VzKGN1cnJlbnQsIGN1cnJlbnRTdGFydCwgY3VycmVudEVuZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkLCBvbGRTdGFydCwgb2xkRW5kKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGludGVyc2VjdChzdGFydDEsIGVuZDEsIHN0YXJ0MiwgZW5kMikge1xuICAgIC8vIERpc2pvaW50XG4gICAgaWYgKGVuZDEgPCBzdGFydDIgfHwgZW5kMiA8IHN0YXJ0MSlcbiAgICAgIHJldHVybiAtMTtcblxuICAgIC8vIEFkamFjZW50XG4gICAgaWYgKGVuZDEgPT0gc3RhcnQyIHx8IGVuZDIgPT0gc3RhcnQxKVxuICAgICAgcmV0dXJuIDA7XG5cbiAgICAvLyBOb24temVybyBpbnRlcnNlY3QsIHNwYW4xIGZpcnN0XG4gICAgaWYgKHN0YXJ0MSA8IHN0YXJ0Mikge1xuICAgICAgaWYgKGVuZDEgPCBlbmQyKVxuICAgICAgICByZXR1cm4gZW5kMSAtIHN0YXJ0MjsgLy8gT3ZlcmxhcFxuICAgICAgZWxzZVxuICAgICAgICByZXR1cm4gZW5kMiAtIHN0YXJ0MjsgLy8gQ29udGFpbmVkXG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIE5vbi16ZXJvIGludGVyc2VjdCwgc3BhbjIgZmlyc3RcbiAgICAgIGlmIChlbmQyIDwgZW5kMSlcbiAgICAgICAgcmV0dXJuIGVuZDIgLSBzdGFydDE7IC8vIE92ZXJsYXBcbiAgICAgIGVsc2VcbiAgICAgICAgcmV0dXJuIGVuZDEgLSBzdGFydDE7IC8vIENvbnRhaW5lZFxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG1lcmdlU3BsaWNlKHNwbGljZXMsIGluZGV4LCByZW1vdmVkLCBhZGRlZENvdW50KSB7XG5cbiAgICB2YXIgc3BsaWNlID0gbmV3U3BsaWNlKGluZGV4LCByZW1vdmVkLCBhZGRlZENvdW50KTtcblxuICAgIHZhciBpbnNlcnRlZCA9IGZhbHNlO1xuICAgIHZhciBpbnNlcnRpb25PZmZzZXQgPSAwO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzcGxpY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgY3VycmVudCA9IHNwbGljZXNbaV07XG4gICAgICBjdXJyZW50LmluZGV4ICs9IGluc2VydGlvbk9mZnNldDtcblxuICAgICAgaWYgKGluc2VydGVkKVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgdmFyIGludGVyc2VjdENvdW50ID0gaW50ZXJzZWN0KHNwbGljZS5pbmRleCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcGxpY2UuaW5kZXggKyBzcGxpY2UucmVtb3ZlZC5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudC5pbmRleCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50LmluZGV4ICsgY3VycmVudC5hZGRlZENvdW50KTtcblxuICAgICAgaWYgKGludGVyc2VjdENvdW50ID49IDApIHtcbiAgICAgICAgLy8gTWVyZ2UgdGhlIHR3byBzcGxpY2VzXG5cbiAgICAgICAgc3BsaWNlcy5zcGxpY2UoaSwgMSk7XG4gICAgICAgIGktLTtcblxuICAgICAgICBpbnNlcnRpb25PZmZzZXQgLT0gY3VycmVudC5hZGRlZENvdW50IC0gY3VycmVudC5yZW1vdmVkLmxlbmd0aDtcblxuICAgICAgICBzcGxpY2UuYWRkZWRDb3VudCArPSBjdXJyZW50LmFkZGVkQ291bnQgLSBpbnRlcnNlY3RDb3VudDtcbiAgICAgICAgdmFyIGRlbGV0ZUNvdW50ID0gc3BsaWNlLnJlbW92ZWQubGVuZ3RoICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudC5yZW1vdmVkLmxlbmd0aCAtIGludGVyc2VjdENvdW50O1xuXG4gICAgICAgIGlmICghc3BsaWNlLmFkZGVkQ291bnQgJiYgIWRlbGV0ZUNvdW50KSB7XG4gICAgICAgICAgLy8gbWVyZ2VkIHNwbGljZSBpcyBhIG5vb3AuIGRpc2NhcmQuXG4gICAgICAgICAgaW5zZXJ0ZWQgPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhciByZW1vdmVkID0gY3VycmVudC5yZW1vdmVkO1xuXG4gICAgICAgICAgaWYgKHNwbGljZS5pbmRleCA8IGN1cnJlbnQuaW5kZXgpIHtcbiAgICAgICAgICAgIC8vIHNvbWUgcHJlZml4IG9mIHNwbGljZS5yZW1vdmVkIGlzIHByZXBlbmRlZCB0byBjdXJyZW50LnJlbW92ZWQuXG4gICAgICAgICAgICB2YXIgcHJlcGVuZCA9IHNwbGljZS5yZW1vdmVkLnNsaWNlKDAsIGN1cnJlbnQuaW5kZXggLSBzcGxpY2UuaW5kZXgpO1xuICAgICAgICAgICAgQXJyYXkucHJvdG90eXBlLnB1c2guYXBwbHkocHJlcGVuZCwgcmVtb3ZlZCk7XG4gICAgICAgICAgICByZW1vdmVkID0gcHJlcGVuZDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoc3BsaWNlLmluZGV4ICsgc3BsaWNlLnJlbW92ZWQubGVuZ3RoID4gY3VycmVudC5pbmRleCArIGN1cnJlbnQuYWRkZWRDb3VudCkge1xuICAgICAgICAgICAgLy8gc29tZSBzdWZmaXggb2Ygc3BsaWNlLnJlbW92ZWQgaXMgYXBwZW5kZWQgdG8gY3VycmVudC5yZW1vdmVkLlxuICAgICAgICAgICAgdmFyIGFwcGVuZCA9IHNwbGljZS5yZW1vdmVkLnNsaWNlKGN1cnJlbnQuaW5kZXggKyBjdXJyZW50LmFkZGVkQ291bnQgLSBzcGxpY2UuaW5kZXgpO1xuICAgICAgICAgICAgQXJyYXkucHJvdG90eXBlLnB1c2guYXBwbHkocmVtb3ZlZCwgYXBwZW5kKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBzcGxpY2UucmVtb3ZlZCA9IHJlbW92ZWQ7XG4gICAgICAgICAgaWYgKGN1cnJlbnQuaW5kZXggPCBzcGxpY2UuaW5kZXgpIHtcbiAgICAgICAgICAgIHNwbGljZS5pbmRleCA9IGN1cnJlbnQuaW5kZXg7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHNwbGljZS5pbmRleCA8IGN1cnJlbnQuaW5kZXgpIHtcbiAgICAgICAgLy8gSW5zZXJ0IHNwbGljZSBoZXJlLlxuXG4gICAgICAgIGluc2VydGVkID0gdHJ1ZTtcblxuICAgICAgICBzcGxpY2VzLnNwbGljZShpLCAwLCBzcGxpY2UpO1xuICAgICAgICBpKys7XG5cbiAgICAgICAgdmFyIG9mZnNldCA9IHNwbGljZS5hZGRlZENvdW50IC0gc3BsaWNlLnJlbW92ZWQubGVuZ3RoXG4gICAgICAgIGN1cnJlbnQuaW5kZXggKz0gb2Zmc2V0O1xuICAgICAgICBpbnNlcnRpb25PZmZzZXQgKz0gb2Zmc2V0O1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghaW5zZXJ0ZWQpXG4gICAgICBzcGxpY2VzLnB1c2goc3BsaWNlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZUluaXRpYWxTcGxpY2VzKGFycmF5LCBjaGFuZ2VSZWNvcmRzKSB7XG4gICAgdmFyIHNwbGljZXMgPSBbXTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hhbmdlUmVjb3Jkcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHJlY29yZCA9IGNoYW5nZVJlY29yZHNbaV07XG4gICAgICBzd2l0Y2gocmVjb3JkLnR5cGUpIHtcbiAgICAgICAgY2FzZSAnc3BsaWNlJzpcbiAgICAgICAgICBtZXJnZVNwbGljZShzcGxpY2VzLCByZWNvcmQuaW5kZXgsIHJlY29yZC5yZW1vdmVkLnNsaWNlKCksIHJlY29yZC5hZGRlZENvdW50KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnYWRkJzpcbiAgICAgICAgY2FzZSAndXBkYXRlJzpcbiAgICAgICAgY2FzZSAnZGVsZXRlJzpcbiAgICAgICAgICBpZiAoIWlzSW5kZXgocmVjb3JkLm5hbWUpKVxuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgdmFyIGluZGV4ID0gdG9OdW1iZXIocmVjb3JkLm5hbWUpO1xuICAgICAgICAgIGlmIChpbmRleCA8IDApXG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICBtZXJnZVNwbGljZShzcGxpY2VzLCBpbmRleCwgW3JlY29yZC5vbGRWYWx1ZV0sIDEpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1VuZXhwZWN0ZWQgcmVjb3JkIHR5cGU6ICcgKyBKU09OLnN0cmluZ2lmeShyZWNvcmQpKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gc3BsaWNlcztcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb2plY3RBcnJheVNwbGljZXMoYXJyYXksIGNoYW5nZVJlY29yZHMpIHtcbiAgICB2YXIgc3BsaWNlcyA9IFtdO1xuXG4gICAgY3JlYXRlSW5pdGlhbFNwbGljZXMoYXJyYXksIGNoYW5nZVJlY29yZHMpLmZvckVhY2goZnVuY3Rpb24oc3BsaWNlKSB7XG4gICAgICBpZiAoc3BsaWNlLmFkZGVkQ291bnQgPT0gMSAmJiBzcGxpY2UucmVtb3ZlZC5sZW5ndGggPT0gMSkge1xuICAgICAgICBpZiAoc3BsaWNlLnJlbW92ZWRbMF0gIT09IGFycmF5W3NwbGljZS5pbmRleF0pXG4gICAgICAgICAgc3BsaWNlcy5wdXNoKHNwbGljZSk7XG5cbiAgICAgICAgcmV0dXJuXG4gICAgICB9O1xuXG4gICAgICBzcGxpY2VzID0gc3BsaWNlcy5jb25jYXQoY2FsY1NwbGljZXMoYXJyYXksIHNwbGljZS5pbmRleCwgc3BsaWNlLmluZGV4ICsgc3BsaWNlLmFkZGVkQ291bnQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3BsaWNlLnJlbW92ZWQsIDAsIHNwbGljZS5yZW1vdmVkLmxlbmd0aCkpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHNwbGljZXM7XG4gIH1cblxuIC8vIEV4cG9ydCB0aGUgb2JzZXJ2ZS1qcyBvYmplY3QgZm9yICoqTm9kZS5qcyoqLCB3aXRoXG4vLyBiYWNrd2FyZHMtY29tcGF0aWJpbGl0eSBmb3IgdGhlIG9sZCBgcmVxdWlyZSgpYCBBUEkuIElmIHdlJ3JlIGluXG4vLyB0aGUgYnJvd3NlciwgZXhwb3J0IGFzIGEgZ2xvYmFsIG9iamVjdC5cbnZhciBleHBvc2UgPSBnbG9iYWw7XG5pZiAodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcbmV4cG9zZSA9IGV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cztcbn1cbmV4cG9zZSA9IGV4cG9ydHM7XG59XG5leHBvc2UuT2JzZXJ2ZXIgPSBPYnNlcnZlcjtcbmV4cG9zZS5PYnNlcnZlci5ydW5FT01fID0gcnVuRU9NO1xuZXhwb3NlLk9ic2VydmVyLm9ic2VydmVyU2VudGluZWxfID0gb2JzZXJ2ZXJTZW50aW5lbDsgLy8gZm9yIHRlc3RpbmcuXG5leHBvc2UuT2JzZXJ2ZXIuaGFzT2JqZWN0T2JzZXJ2ZSA9IGhhc09ic2VydmU7XG5leHBvc2UuQXJyYXlPYnNlcnZlciA9IEFycmF5T2JzZXJ2ZXI7XG5leHBvc2UuQXJyYXlPYnNlcnZlci5jYWxjdWxhdGVTcGxpY2VzID0gZnVuY3Rpb24oY3VycmVudCwgcHJldmlvdXMpIHtcbnJldHVybiBhcnJheVNwbGljZS5jYWxjdWxhdGVTcGxpY2VzKGN1cnJlbnQsIHByZXZpb3VzKTtcbn07XG5leHBvc2UuUGxhdGZvcm0gPSBnbG9iYWwuUGxhdGZvcm07XG5leHBvc2UuQXJyYXlTcGxpY2UgPSBBcnJheVNwbGljZTtcbmV4cG9zZS5PYmplY3RPYnNlcnZlciA9IE9iamVjdE9ic2VydmVyO1xuZXhwb3NlLlBhdGhPYnNlcnZlciA9IFBhdGhPYnNlcnZlcjtcbmV4cG9zZS5Db21wb3VuZE9ic2VydmVyID0gQ29tcG91bmRPYnNlcnZlcjtcbmV4cG9zZS5QYXRoID0gUGF0aDtcbmV4cG9zZS5PYnNlcnZlclRyYW5zZm9ybSA9IE9ic2VydmVyVHJhbnNmb3JtO1xufSkodHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcgJiYgZ2xvYmFsICYmIHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZSA/IGdsb2JhbCA6IHRoaXMgfHwgd2luZG93KTtcblxufSkuY2FsbCh0aGlzLHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pIiwiZnVuY3Rpb24gTG9nZ2VyIChuYW1lKSB7XG4gICAgaWYgKCF0aGlzKSByZXR1cm4gbmV3IExvZ2dlcihuYW1lKTtcbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xuXG4gICAgdGhpcy50cmFjZSA9IGNvbnN0cnVjdFBlcmZvcm1lcih0aGlzLCBfLmJpbmQoY29uc29sZS5kZWJ1ZyA/IGNvbnNvbGUuZGVidWcgOiBjb25zb2xlLmxvZywgY29uc29sZSksIExvZ2dlci5MZXZlbC50cmFjZSk7XG4gICAgdGhpcy5kZWJ1ZyA9IGNvbnN0cnVjdFBlcmZvcm1lcih0aGlzLCBfLmJpbmQoY29uc29sZS5kZWJ1ZyA/IGNvbnNvbGUuZGVidWcgIDogY29uc29sZS5sb2csIGNvbnNvbGUpLCBMb2dnZXIuTGV2ZWwuZGVidWcpO1xuICAgIHRoaXMuaW5mbyA9IGNvbnN0cnVjdFBlcmZvcm1lcih0aGlzLCBfLmJpbmQoY29uc29sZS5pbmZvID8gY29uc29sZS5pbmZvIDogY29uc29sZS5sb2csIGNvbnNvbGUpLCBMb2dnZXIuTGV2ZWwuaW5mbyk7XG4gICAgdGhpcy5sb2cgPSBjb25zdHJ1Y3RQZXJmb3JtZXIodGhpcywgXy5iaW5kKGNvbnNvbGUubG9nID8gY29uc29sZS5sb2cgOiBjb25zb2xlLmxvZywgY29uc29sZSksIExvZ2dlci5MZXZlbC5pbmZvKTtcbiAgICB0aGlzLndhcm4gPSBjb25zdHJ1Y3RQZXJmb3JtZXIodGhpcywgXy5iaW5kKGNvbnNvbGUud2FybiA/IGNvbnNvbGUud2FybiA6IGNvbnNvbGUubG9nLCBjb25zb2xlKSwgTG9nZ2VyLkxldmVsLndhcm5pbmcpO1xuICAgIHRoaXMuZXJyb3IgPSBjb25zdHJ1Y3RQZXJmb3JtZXIodGhpcywgXy5iaW5kKGNvbnNvbGUuZXJyb3IgPyBjb25zb2xlLmVycm9yIDogY29uc29sZS5sb2csIGNvbnNvbGUpLCBMb2dnZXIuTGV2ZWwuZXJyb3IpO1xuICAgIHRoaXMuZmF0YWwgPSBjb25zdHJ1Y3RQZXJmb3JtZXIodGhpcywgXy5iaW5kKGNvbnNvbGUuZXJyb3IgPyBjb25zb2xlLmVycm9yIDogY29uc29sZS5sb2csIGNvbnNvbGUpLCBMb2dnZXIuTGV2ZWwuZmF0YWwpO1xuXG59XG5cbnZhciBsb2dMZXZlbHMgPSB7fTtcblxuZnVuY3Rpb24gY29uc3RydWN0UGVyZm9ybWVyIChsb2dnZXIsIGYsIGxldmVsKSB7XG4gICAgdmFyIHBlcmZvcm1lciA9IGZ1bmN0aW9uIChtZXNzYWdlKSB7XG4gICAgICAgIGxvZ2dlci5wZXJmb3JtTG9nKGYsIGxldmVsLCBtZXNzYWdlLCBhcmd1bWVudHMpO1xuICAgIH07XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHBlcmZvcm1lciwgJ2lzRW5hYmxlZCcsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgY3VycmVudExldmVsID0gbG9nZ2VyLmN1cnJlbnRMZXZlbCgpO1xuICAgICAgICAgICAgcmV0dXJuIGxldmVsID49IGN1cnJlbnRMZXZlbDtcbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSk7XG4gICAgcGVyZm9ybWVyLmYgPSBmO1xuICAgIHBlcmZvcm1lci5sb2dnZXIgPSBsb2dnZXI7XG4gICAgcGVyZm9ybWVyLmxldmVsID0gbGV2ZWw7XG4gICAgcmV0dXJuIHBlcmZvcm1lcjtcbn1cblxuTG9nZ2VyLkxldmVsID0ge1xuICAgIHRyYWNlOiAwLFxuICAgIGRlYnVnOiAxLFxuICAgIGluZm86IDIsXG4gICAgd2FybmluZzogMyxcbiAgICB3YXJuOiAzLFxuICAgIGVycm9yOiA0LFxuICAgIGZhdGFsOiA1XG59O1xuXG5Mb2dnZXIuTGV2ZWxUZXh0ID0ge307XG5Mb2dnZXIuTGV2ZWxUZXh0IFtMb2dnZXIuTGV2ZWwudHJhY2VdID0gJ1RSQUNFJztcbkxvZ2dlci5MZXZlbFRleHQgW0xvZ2dlci5MZXZlbC5kZWJ1Z10gPSAnREVCVUcnO1xuTG9nZ2VyLkxldmVsVGV4dCBbTG9nZ2VyLkxldmVsLmluZm9dID0gJ0lORk8gJztcbkxvZ2dlci5MZXZlbFRleHQgW0xvZ2dlci5MZXZlbC53YXJuaW5nXSA9ICdXQVJOICc7XG5Mb2dnZXIuTGV2ZWxUZXh0IFtMb2dnZXIuTGV2ZWwuZXJyb3JdID0gJ0VSUk9SJztcblxuTG9nZ2VyLmxldmVsQXNUZXh0ID0gZnVuY3Rpb24gKGxldmVsKSB7XG4gICAgcmV0dXJuIHRoaXMuTGV2ZWxUZXh0W2xldmVsXTtcbn07XG5cbkxvZ2dlci5sb2dnZXJXaXRoTmFtZSA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBMb2dnZXIobmFtZSk7XG59O1xuXG5Mb2dnZXIucHJvdG90eXBlLmN1cnJlbnRMZXZlbCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgbG9nTGV2ZWwgPSBsb2dMZXZlbHNbdGhpcy5uYW1lXTtcbiAgICByZXR1cm4gIGxvZ0xldmVsID8gbG9nTGV2ZWwgOiBMb2dnZXIuTGV2ZWwudHJhY2U7XG59O1xuXG5Mb2dnZXIucHJvdG90eXBlLnNldExldmVsID0gZnVuY3Rpb24gKGxldmVsKSB7XG4gICAgbG9nTGV2ZWxzW3RoaXMubmFtZV0gPSBsZXZlbDtcbn07XG5cbkxvZ2dlci5wcm90b3R5cGUub3ZlcnJpZGUgPSBmdW5jdGlvbiAobGV2ZWwsIG92ZXJyaWRlLCBtZXNzYWdlKSB7XG4gICAgdmFyIGxldmVsQXNUZXh0ID0gTG9nZ2VyLmxldmVsQXNUZXh0KGxldmVsKTtcbiAgICB2YXIgcGVyZm9ybWVyID0gdGhpc1tsZXZlbEFzVGV4dC50cmltKCkudG9Mb3dlckNhc2UoKV07XG4gICAgdmFyIGYgPSBwZXJmb3JtZXIuZjtcbiAgICB2YXIgb3RoZXJBcmd1bWVudHMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDMsIGFyZ3VtZW50cy5sZW5ndGgpO1xuICAgIHRoaXMucGVyZm9ybUxvZyhmLCBsZXZlbCwgbWVzc2FnZSwgb3RoZXJBcmd1bWVudHMsIG92ZXJyaWRlKTtcbn07XG5cbkxvZ2dlci5wcm90b3R5cGUucGVyZm9ybUxvZyA9IGZ1bmN0aW9uIChsb2dGdW5jLCBsZXZlbCwgbWVzc2FnZSwgb3RoZXJBcmd1bWVudHMsIG92ZXJyaWRlKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBjdXJyZW50TGV2ZWwgPSBvdmVycmlkZSAhPT0gdW5kZWZpbmVkID8gb3ZlcnJpZGUgOiB0aGlzLmN1cnJlbnRMZXZlbCgpO1xuICAgIGlmIChjdXJyZW50TGV2ZWwgPD0gbGV2ZWwpIHtcbiAgICAgICAgbG9nRnVuYyA9IF8ucGFydGlhbChsb2dGdW5jLCBMb2dnZXIubGV2ZWxBc1RleHQobGV2ZWwpICsgJyBbJyArIHNlbGYubmFtZSArICddOiAnICsgbWVzc2FnZSk7XG4gICAgICAgIHZhciBhcmdzID0gW107XG4gICAgICAgIGZvciAodmFyIGk9MDsgaTxvdGhlckFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpXSA9IG90aGVyQXJndW1lbnRzW2ldO1xuICAgICAgICB9XG4gICAgICAgIGFyZ3Muc3BsaWNlKDAsIDEpO1xuICAgICAgICBsb2dGdW5jLmFwcGx5KGxvZ0Z1bmMsIGFyZ3MpO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gTG9nZ2VyO1xuIiwidmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJyk7XG52YXIgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKCdPcGVyYXRpb24nKTtcblxuZnVuY3Rpb24gT3BlcmF0aW9uKCkge1xuICAgIGlmICghdGhpcykge1xuICAgICAgICByZXR1cm4gbmV3IChGdW5jdGlvbi5wcm90b3R5cGUuYmluZC5hcHBseShPcGVyYXRpb24sIGFyZ3VtZW50cykpO1xuICAgIH1cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgaWYgKHR5cGVvZihhcmd1bWVudHNbMF0pID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICB0aGlzLm5hbWUgPSBhcmd1bWVudHNbMF07XG4gICAgICAgICAgICB0aGlzLndvcmsgPSBhcmd1bWVudHNbMV07XG4gICAgICAgICAgICB0aGlzLmNvbXBsZXRpb24gPSBhcmd1bWVudHNbMl07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodHlwZW9mKGFyZ3VtZW50c1swXSkgPT0gJ2Z1bmN0aW9uJyB8fFxuICAgICAgICAgICAgT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGFyZ3VtZW50c1swXSkgPT09ICdbb2JqZWN0IEFycmF5XScgfHxcbiAgICAgICAgICAgIGFyZ3VtZW50c1swXSBpbnN0YW5jZW9mIE9wZXJhdGlvbikge1xuICAgICAgICAgICAgdGhpcy53b3JrID0gYXJndW1lbnRzWzBdO1xuICAgICAgICAgICAgdGhpcy5jb21wbGV0aW9uID0gYXJndW1lbnRzWzFdO1xuICAgICAgICB9XG4gICAgfVxuICAgIHRoaXMuZXJyb3IgPSBudWxsO1xuICAgIHRoaXMuY29tcGxldGVkID0gZmFsc2U7XG4gICAgdGhpcy5yZXN1bHQgPSBudWxsO1xuICAgIHRoaXMucnVubmluZyA9IGZhbHNlO1xuICAgIHRoaXMuY2FuY2VsbGVkID0gZmFsc2U7XG4gICAgdGhpcy5kZXBlbmRlbmNpZXMgPSBbXTtcbiAgICB0aGlzLl9tdXN0U3VjY2VlZCA9IFtdO1xuICAgIHRoaXMuX29uQ29tcGxldGlvbiA9IFtdO1xuICAgIHRoaXMubG9nTGV2ZWwgPSBudWxsOyAvLyBPdmVycmlkZS5cblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnZmFpbGVkJywge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiAgISFzZWxmLmVycm9yIHx8IHNlbGYuZmFpbGVkRHVlVG9EZXBlbmRlbmN5O1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnY29tcG9zaXRlJywge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBzZWxmLndvcmsgaW5zdGFuY2VvZiBPcGVyYXRpb24gfHxcbiAgICAgICAgICAgICAgICBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoc2VsZi53b3JrKSA9PT0gJ1tvYmplY3QgQXJyYXldJ1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnbnVtT3BlcmF0aW9uc1JlbWFpbmluZycsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoc2VsZi53b3JrIGluc3RhbmNlb2YgT3BlcmF0aW9uKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNlbGYud29yay5jb21wbGV0ZWQgPyAwIDogMVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHNlbGYud29yaykgPT09ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gXy5yZWR1Y2Uoc2VsZi53b3JrLCBmdW5jdGlvbiAobWVtbywgb3ApIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFvcC5jb21wbGV0ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBtZW1vICsgMTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgICAgICAgICB9LCAwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnY2FuUnVuJywge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChzZWxmLmRlcGVuZGVuY2llcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gXy5yZWR1Y2Uoc2VsZi5kZXBlbmRlbmNpZXMsIGZ1bmN0aW9uIChtZW1vLCBkZXApIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG11c3RTdWNjZWVkID0gc2VsZi5fbXVzdFN1Y2NlZWQuaW5kZXhPZihkZXApID4gLTE7XG4gICAgICAgICAgICAgICAgICAgIHZhciBjYW5SdW4gPSBtZW1vICYmIGRlcC5jb21wbGV0ZWQ7XG4gICAgICAgICAgICAgICAgICAgIGlmIChtdXN0U3VjY2VlZCAmJiBjYW5SdW4pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhblJ1biA9IGNhblJ1biAmJiAhKGRlcC5mYWlsZWQgfHwgZGVwLmNhbmNlbGxlZCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNhblJ1bjtcbiAgICAgICAgICAgICAgICB9LCB0cnVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnZmFpbGVkRHVlVG9EZXBlbmRlbmN5Jywge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChzZWxmLmRlcGVuZGVuY2llcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB2YXIgZmFpbGVkRGVwcyA9IF8ucmVkdWNlKHNlbGYuZGVwZW5kZW5jaWVzLCBmdW5jdGlvbiAobWVtbywgZGVwKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBtdXN0U3VjY2VlZCA9IHNlbGYuX211c3RTdWNjZWVkLmluZGV4T2YoZGVwKSA+IC0xO1xuICAgICAgICAgICAgICAgICAgICB2YXIgZmFpbGVkID0gKChkZXAuZmFpbGVkIHx8IGRlcC5jYW5jZWxsZWQpICYmIG11c3RTdWNjZWVkKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZhaWxlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVtby5wdXNoKGRlcCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgICAgICAgICAgfSwgW10pO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWlsZWREZXBzLmxlbmd0aCA/IGZhaWxlZERlcHMgOiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSk7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ2ZhaWxlZER1ZVRvQ2FuY2VsbGF0aW9uT2ZEZXBlbmRlbmN5Jywge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChzZWxmLmRlcGVuZGVuY2llcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB2YXIgY2FuY2VsbGVkID0gXy5yZWR1Y2Uoc2VsZi5kZXBlbmRlbmNpZXMsIGZ1bmN0aW9uIChtZW1vLCBkZXApIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG11c3RTdWNjZWVkID0gc2VsZi5fbXVzdFN1Y2NlZWQuaW5kZXhPZihkZXApID4gLTE7XG4gICAgICAgICAgICAgICAgICAgIGlmIChtdXN0U3VjY2VlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRlcC5jYW5jZWxsZWQpIG1lbW8ucHVzaChkZXApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICAgICAgICAgIH0sIFtdKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gY2FuY2VsbGVkLmxlbmd0aCA/IGNhbmNlbGxlZCA6IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnbG9nZ2luZ092ZXJpZGRlbicsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoc2VsZi5sb2dMZXZlbCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzZWxmLmxvZ0xldmVsIDw9IGxvZy5MZXZlbC5pbmZvO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KVxuXG5cbn1cblxuT3BlcmF0aW9uLnJ1bm5pbmcgPSBbXTtcblxuT3BlcmF0aW9uLnByb3RvdHlwZS5fc3RhcnRTaW5nbGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHRoaXMud29yayhmdW5jdGlvbiAoZXJyLCBwYXlsb2FkKSB7XG4gICAgICAgIHNlbGYucmVzdWx0ID0gcGF5bG9hZDtcbiAgICAgICAgc2VsZi5lcnJvciA9IGVycjtcbiAgICAgICAgc2VsZi5jb21wbGV0ZWQgPSB0cnVlO1xuICAgICAgICBzZWxmLnJ1bm5pbmcgPSBmYWxzZTtcbiAgICAgICAgc2VsZi5fY29tcGxldGUoKTtcbiAgICB9KTtcbn07XG5cbk9wZXJhdGlvbi5wcm90b3R5cGUuX3N0YXJ0Q29tcG9zaXRlID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgb3BlcmF0aW9ucyA9IHNlbGYud29yayBpbnN0YW5jZW9mIE9wZXJhdGlvbiA/IFtzZWxmLndvcmtdIDogc2VsZi53b3JrO1xuICAgIF8uZWFjaChvcGVyYXRpb25zLCBmdW5jdGlvbiAob3ApIHtcbiAgICAgICAgb3Aub25Db21wbGV0aW9uKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBudW1PcGVyYXRpb25zUmVtYWluaW5nID0gc2VsZi5udW1PcGVyYXRpb25zUmVtYWluaW5nO1xuICAgICAgICAgICAgdmFyIG5hbWUgPSBzZWxmLm5hbWUgfHwgJ1VubmFtZWQnO1xuICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKG5hbWUgKyAnIGhhcyAnICsgbnVtT3BlcmF0aW9uc1JlbWFpbmluZy50b1N0cmluZygpICsgJyBvcGVyYXRpb25zIHJlbWFpbmluZycpO1xuICAgICAgICAgICAgaWYgKCFudW1PcGVyYXRpb25zUmVtYWluaW5nKSB7XG4gICAgICAgICAgICAgICAgdmFyIGVycm9ycyA9IF8ucGx1Y2sob3BlcmF0aW9ucywgJ2Vycm9yJyk7XG4gICAgICAgICAgICAgICAgdmFyIHJlc3VsdHMgPSBfLnBsdWNrKG9wZXJhdGlvbnMsICdyZXN1bHQnKTtcbiAgICAgICAgICAgICAgICBzZWxmLnJlc3VsdCA9IF8uc29tZShyZXN1bHRzKSA/IHJlc3VsdHMgOiBudWxsO1xuICAgICAgICAgICAgICAgIHNlbGYuZXJyb3IgPSBfLnNvbWUoZXJyb3JzKSA/IGVycm9ycyA6IG51bGw7XG4gICAgICAgICAgICAgICAgc2VsZi5jb21wbGV0ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHNlbGYucnVubmluZyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHNlbGYuX2NvbXBsZXRlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBvcC5zdGFydCgpO1xuICAgIH0pO1xufTtcblxuT3BlcmF0aW9uLnByb3RvdHlwZS5fbG9nQ29tcGxldGlvbiA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgbG9nRnVuYyA9IHRoaXMuX2dldExvZ0Z1bmMoKTtcbiAgICBpZiAoTG9nZ2VyLmluZm8uaXNFbmFibGVkIHx8IHRoaXMubG9nZ2luZ092ZXJpZGRlbikge1xuICAgICAgICB2YXIgbmFtZSA9IHRoaXMubmFtZSB8fCAnVW5uYW1lZCc7XG4gICAgICAgIHZhciBmYWlsZWREZXBlbmRlbmNpZXMgPSB0aGlzLmZhaWxlZER1ZVRvRGVwZW5kZW5jeTtcbiAgICAgICAgaWYgKGZhaWxlZERlcGVuZGVuY2llcykge1xuICAgICAgICAgICAgbG9nRnVuYygnXCInICsgbmFtZSArICdcIiBmYWlsZWQgZHVlIHRvIGZhaWx1cmUvY2FuY2VsbGF0aW9uIG9mIGRlcGVuZGVuY2llczogJyArIF8ucGx1Y2soZmFpbGVkRGVwZW5kZW5jaWVzLCAnbmFtZScpLmpvaW4oJywgJykpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHRoaXMuZmFpbGVkKSB7XG4gICAgICAgICAgICB2YXIgZXJyID0gdGhpcy5lcnJvcjtcbiAgICAgICAgICAgIC8vIFJlbW92ZSBudWxsIGVycm9ycy5cbiAgICAgICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoZXJyKSA9PT0gJ1tvYmplY3QgQXJyYXldJykge1xuICAgICAgICAgICAgICAgIGVyciA9IF8uZmlsdGVyKGVyciwgZnVuY3Rpb24gKGUpIHtyZXR1cm4gZSB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGVyciA9IFt0aGlzLmVycm9yXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxvZ0Z1bmMoJ1wiJyArIG5hbWUgKyAnXCIgZmFpbGVkIGR1ZSB0byBlcnJvcnM6JywgZXJyKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh0aGlzLmNhbmNlbGxlZCkge1xuICAgICAgICAgICAgbG9nRnVuYygnXCInICsgbmFtZSArICdcIiBoYXMgYmVlbiBjYW5jZWxsZWQuJyk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBsb2dGdW5jKCdcIicgKyBuYW1lICsgJ1wiIGhhcyBzdWNjZWVkZWQuJyk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5PcGVyYXRpb24ucHJvdG90eXBlLl9nZXRMb2dGdW5jID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLmxvZ0xldmVsKSB7XG4gICAgICAgIHJldHVybiBfLmJpbmQoTG9nZ2VyLm92ZXJyaWRlLCBMb2dnZXIsIGxvZy5MZXZlbC5pbmZvLCB0aGlzLmxvZ0xldmVsKTtcbiAgICB9XG4gICAgcmV0dXJuIExvZ2dlci5pbmZvO1xufTtcblxuT3BlcmF0aW9uLnByb3RvdHlwZS5fbG9nU3RhcnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKExvZ2dlci5pbmZvLmlzRW5hYmxlZCB8fCB0aGlzLmxvZ2dpbmdPdmVyaWRkZW4pIHtcbiAgICAgICAgdmFyIG5hbWUgPSB0aGlzLm5hbWUgfHwgJ1VubmFtZWQnO1xuICAgICAgICB2YXIgbG9nRnVuYyA9IHRoaXMuX2dldExvZ0Z1bmMoKTtcbiAgICAgICAgbG9nRnVuYygnXCInICsgbmFtZSArICdcIiBoYXMgc3RhcnRlZC4nKTtcbiAgICB9XG59O1xuXG5cbk9wZXJhdGlvbi5wcm90b3R5cGUuX2NvbXBsZXRlID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB0aGlzLmNvbXBsZXRlZCA9IHRydWU7XG4gICAgdmFyIGlkeCA9IE9wZXJhdGlvbi5ydW5uaW5nLmluZGV4T2YodGhpcyk7XG4gICAgT3BlcmF0aW9uLnJ1bm5pbmcuc3BsaWNlKGlkeCwgMSk7XG4gICAgaWYgKHRoaXMuY29tcGxldGlvbikge1xuICAgICAgICBfLmJpbmQodGhpcy5jb21wbGV0aW9uLCB0aGlzKSgpO1xuICAgIH1cbiAgICB0aGlzLl9sb2dDb21wbGV0aW9uKCk7XG4gICAgXy5lYWNoKHRoaXMuX29uQ29tcGxldGlvbiwgZnVuY3Rpb24gKG8pIHtcbiAgICAgICAgXy5iaW5kKG8sIHNlbGYpKCk7XG4gICAgfSk7XG59O1xuXG5PcGVyYXRpb24ucHJvdG90eXBlLl9fc3RhcnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5fbG9nU3RhcnQoKTtcbiAgICBpZiAodGhpcy53b3JrKSB7XG4gICAgICAgIGlmICh0aGlzLmNvbXBvc2l0ZSkge1xuICAgICAgICAgICAgdGhpcy5fc3RhcnRDb21wb3NpdGUoKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3N0YXJ0U2luZ2xlKCk7XG4gICAgICAgIH1cbiAgICAgICAgT3BlcmF0aW9uLnJ1bm5pbmcucHVzaCh0aGlzKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHRoaXMucmVzdWx0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5lcnJvciA9IG51bGw7XG4gICAgICAgIHRoaXMucnVubmluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9jb21wbGV0ZSgpO1xuICAgIH1cbn07XG5cbk9wZXJhdGlvbi5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBuZXZlclN0YXJ0ZWQgPSAhdGhpcy5ydW5uaW5nICYmICF0aGlzLmNvbXBsZXRlZDtcbiAgICB2YXIgbmV2ZXJTdGFydGVkQW5kRmFpbGVkID0gbmV2ZXJTdGFydGVkICYmIHRoaXMuZmFpbGVkO1xuICAgIC8vIEEgZGVwZW5kZW5jeSBmYWlsZWQgb3Igd2FzIGNhbmNlbGxlZCBiZWZvcmUgdGhpcyBvcGVyYXRpb24gc3RhcnRlZC5cbiAgICBpZiAobmV2ZXJTdGFydGVkQW5kRmFpbGVkKSB7XG4gICAgICAgIHRoaXMuX2NvbXBsZXRlKCk7XG4gICAgfVxuICAgIGVsc2UgaWYgKG5ldmVyU3RhcnRlZCkge1xuICAgICAgICB0aGlzLnJ1bm5pbmcgPSB0cnVlO1xuICAgICAgICBpZiAodGhpcy5jYW5SdW4pIHtcbiAgICAgICAgICAgIHRoaXMuX19zdGFydCgpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgXy5lYWNoKHRoaXMuZGVwZW5kZW5jaWVzLCBmdW5jdGlvbiAoZGVwKSB7XG4gICAgICAgICAgICAgICAgZGVwLm9uQ29tcGxldGlvbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzZWxmLmNhblJ1bikge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5fX3N0YXJ0KCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5cbk9wZXJhdGlvbi5wcm90b3R5cGUuYWRkRGVwZW5kZW5jeSA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT0gMSkge1xuICAgICAgICB0aGlzLmRlcGVuZGVuY2llcy5wdXNoKGFyZ3VtZW50c1swXSk7XG4gICAgfVxuICAgIGVsc2UgaWYgKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgICAgIHZhciBsYXN0QXJnID0gYXJnc1thcmdzLmxlbmd0aCAtIDFdO1xuICAgICAgICB2YXIgbXVzdFN1Y2NlZWQgPSBmYWxzZTtcbiAgICAgICAgaWYgKHR5cGVvZihsYXN0QXJnKSA9PSAnYm9vbGVhbicpIHtcbiAgICAgICAgICAgIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmdzLCAwLCBhcmdzLmxlbmd0aCAtIDEpO1xuICAgICAgICAgICAgbXVzdFN1Y2NlZWQgPSBsYXN0QXJnO1xuICAgICAgICB9XG4gICAgICAgIF8uZWFjaChhcmdzLCBmdW5jdGlvbiAoYXJnKSB7XG4gICAgICAgICAgICBzZWxmLmRlcGVuZGVuY2llcy5wdXNoKGFyZyk7XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAobXVzdFN1Y2NlZWQpIHtcbiAgICAgICAgICAgIF8uZWFjaChhcmdzLCBmdW5jdGlvbiAoYXJnKSB7XG4gICAgICAgICAgICAgICAgc2VsZi5fbXVzdFN1Y2NlZWQucHVzaChhcmcpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbk9wZXJhdGlvbi5wcm90b3R5cGUub25Db21wbGV0aW9uID0gZnVuY3Rpb24gKG8pIHtcbiAgICBpZiAoIXRoaXMuY29tcGxldGVkKSB7XG4gICAgICAgIHRoaXMuX29uQ29tcGxldGlvbi5wdXNoKG8pO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgXy5iaW5kKG8sIHRoaXMpKCk7XG4gICAgfVxufTtcblxuT3BlcmF0aW9uLnByb3RvdHlwZS5jYW5jZWwgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICBpZiAoIXRoaXMuY2FuY2VsbGVkKSB7XG4gICAgICAgIHRoaXMuY2FuY2VsbGVkID0gdHJ1ZTtcbiAgICAgICAgTG9nZ2VyLmRlYnVnKCdDYW5jZWxsaW5nICcgKyB0aGlzLm5hbWUsIHRoaXMpO1xuICAgICAgICBpZiAodGhpcy5jb21wb3NpdGUpIHtcbiAgICAgICAgICAgIF8uZWFjaCh0aGlzLndvcmssIGZ1bmN0aW9uIChzdWJvcCkge1xuICAgICAgICAgICAgICAgIHN1Ym9wLmNhbmNlbCgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5vbkNvbXBsZXRpb24oZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy5ydW5uaW5nID0gZmFsc2U7XG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKCk7XG4gICAgICAgIH0pO1xuICAgIH1cbn07XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShPcGVyYXRpb24sICdsb2dMZXZlbCcsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIExvZ2dlci5jdXJyZW50TGV2ZWwoKTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgTG9nZ2VyLnNldExldmVsKHYpO1xuICAgIH0sXG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIGVudW1lcmFibGU6IHRydWVcbn0pO1xuXG5tb2R1bGUuZXhwb3J0cy5PcGVyYXRpb24gPSBPcGVyYXRpb247XG4iLCJcbnZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpO1xudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnT3BlcmF0aW9uUXVldWUnKTtcblxuXG5mdW5jdGlvbiBPcGVyYXRpb25RdWV1ZSgpIHtcblxuICAgIGlmICghdGhpcykge1xuICAgICAgICByZXR1cm4gbmV3IChGdW5jdGlvbi5wcm90b3R5cGUuYmluZC5hcHBseShPcGVyYXRpb25RdWV1ZSwgYXJndW1lbnRzKSk7XG4gICAgfVxuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAgIGlmICh0eXBlb2YoYXJndW1lbnRzWzBdKSA9PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgdGhpcy5tYXhDb25jdXJyZW50T3BlcmF0aW9ucyA9IGFyZ3VtZW50c1swXTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMubmFtZSA9IGFyZ3VtZW50c1swXTtcbiAgICAgICAgICAgIHRoaXMubWF4Q29uY3VycmVudE9wZXJhdGlvbnMgPSBhcmd1bWVudHNbMV07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLl9xdWV1ZWRPcGVyYXRpb25zID0gW107XG4gICAgdGhpcy5fcnVubmluZ09wZXJhdGlvbnMgPSBbXTtcbiAgICB0aGlzLl9ydW5uaW5nID0gZmFsc2U7XG4gICAgdGhpcy5fb25TdGFydCA9IFtdO1xuICAgIHRoaXMuX29uU3RvcCA9IFtdO1xuICAgIHRoaXMubG9nTGV2ZWwgPSBudWxsO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdudW1SdW5uaW5nT3BlcmF0aW9ucycsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gc2VsZi5fcnVubmluZ09wZXJhdGlvbnMubGVuZ3RoO1xuICAgICAgICB9LFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnbG9nZ2luZ092ZXJpZGRlbicsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoc2VsZi5sb2dMZXZlbCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzZWxmLmxvZ0xldmVsIDw9IGxvZy5MZXZlbC5pbmZvO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KVxufVxuXG5PcGVyYXRpb25RdWV1ZS5wcm90b3R5cGUuX25leHRPcGVyYXRpb25zID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB3aGlsZSAoKHNlbGYuX3J1bm5pbmdPcGVyYXRpb25zLmxlbmd0aCA8IHNlbGYubWF4Q29uY3VycmVudE9wZXJhdGlvbnMpICYmIHNlbGYuX3F1ZXVlZE9wZXJhdGlvbnMubGVuZ3RoKSB7XG4gICAgICAgIHZhciBvcCA9IHNlbGYuX3F1ZXVlZE9wZXJhdGlvbnNbMF07XG4gICAgICAgIHNlbGYuX3F1ZXVlZE9wZXJhdGlvbnMuc3BsaWNlKDAsIDEpO1xuICAgICAgICBzZWxmLl9ydW5PcGVyYXRpb24ob3ApO1xuICAgIH1cbn07XG5cblxuT3BlcmF0aW9uUXVldWUucHJvdG90eXBlLl9ydW5PcGVyYXRpb24gPSBmdW5jdGlvbiAob3ApIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLl9xdWV1ZWRPcGVyYXRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmICh0aGlzLl9xdWV1ZWRPcGVyYXRpb25zW2ldID09IG9wKSB7XG4gICAgICAgICAgICB0aGlzLl9xdWV1ZWRPcGVyYXRpb25zLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuICAgIHRoaXMuX3J1bm5pbmdPcGVyYXRpb25zLnB1c2gob3ApO1xuICAgIG9wLmNvbXBsZXRpb24gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBpZHggPSBzZWxmLl9ydW5uaW5nT3BlcmF0aW9ucy5pbmRleE9mKG9wKTtcbiAgICAgICAgc2VsZi5fcnVubmluZ09wZXJhdGlvbnMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgIGlmIChzZWxmLl9ydW5uaW5nKSB7XG4gICAgICAgICAgICBzZWxmLl9uZXh0T3BlcmF0aW9ucygpO1xuICAgICAgICB9XG4gICAgICAgIHNlbGYuX2xvZ1N0YXR1cygpO1xuICAgIH07XG4gICAgb3Auc3RhcnQoKTtcbiAgICB0aGlzLl9sb2dTdGF0dXMoKTtcbn07XG5cbk9wZXJhdGlvblF1ZXVlLnByb3RvdHlwZS5fbG9nU3RhdHVzID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBsb2dGdW5jID0gdGhpcy5fZ2V0TG9nRnVuYygpO1xuICAgIGlmIChMb2dnZXIuaW5mby5pc0VuYWJsZWQgfHwgdGhpcy5sb2dnaW5nT3ZlcmlkZGVuKSB7XG4gICAgICAgIHZhciBudW1SdW5uaW5nID0gdGhpcy5udW1SdW5uaW5nT3BlcmF0aW9ucztcbiAgICAgICAgdmFyIG51bVF1ZXVlZCA9IHRoaXMuX3F1ZXVlZE9wZXJhdGlvbnMubGVuZ3RoO1xuICAgICAgICB2YXIgbmFtZSA9IHRoaXMubmFtZSB8fCBcIlVubmFtZWQgUXVldWVcIjtcbiAgICAgICAgaWYgKG51bVJ1bm5pbmcgJiYgbnVtUXVldWVkKSB7XG4gICAgICAgICAgICBsb2dGdW5jKCdcIicgKyBuYW1lICsgJ1wiIG5vdyBoYXMgJyArIG51bVJ1bm5pbmcudG9TdHJpbmcoKSArICcgb3BlcmF0aW9ucyBydW5uaW5nIGFuZCAnICsgbnVtUXVldWVkLnRvU3RyaW5nKCkgKyAnIG9wZXJhdGlvbnMgcXVldWVkJyk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAobnVtUnVubmluZykge1xuICAgICAgICAgICAgbG9nRnVuYygnXCInICsgbmFtZSArICdcIiBub3cgaGFzICcgKyBudW1SdW5uaW5nLnRvU3RyaW5nKCkgKyAnIG9wZXJhdGlvbnMgcnVubmluZycpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKG51bVF1ZXVlZCkge1xuICAgICAgICAgICAgbG9nRnVuYygnXCInICsgbmFtZSArICdcIiBub3cgaGFzICcgKyBudW1RdWV1ZWQudG9TdHJpbmcoKSArICcgb3BlcmF0aW9ucyBxdWV1ZWQnKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGxvZ0Z1bmMoJ1wiJyArIG5hbWUgKyAnXCIgaGFzIG5vIG9wZXJhdGlvbnMgcnVubmluZyBvciBxdWV1ZWQnKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbk9wZXJhdGlvblF1ZXVlLnByb3RvdHlwZS5fbG9nU3RhcnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGxvZ0Z1bmMgPSB0aGlzLl9nZXRMb2dGdW5jKCk7XG4gICAgaWYgKExvZ2dlci5pbmZvLmlzRW5hYmxlZCB8fCB0aGlzLmxvZ2dpbmdPdmVyaWRkZW4pIHtcbiAgICAgICAgdmFyIG5hbWUgPSB0aGlzLm5hbWUgfHwgXCJVbm5hbWVkIFF1ZXVlXCI7XG4gICAgICAgIGxvZ0Z1bmMoJ1wiJyArIG5hbWUgKyAnXCIgaXMgbm93IHJ1bm5pbmcnKTtcbiAgICB9XG59O1xuXG5PcGVyYXRpb25RdWV1ZS5wcm90b3R5cGUuX2dldExvZ0Z1bmMgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMubG9nTGV2ZWwpIHtcbiAgICAgICAgcmV0dXJuIF8uYmluZChMb2dnZXIub3ZlcnJpZGUsIExvZ2dlciwgbG9nLkxldmVsLmluZm8sIHRoaXMubG9nTGV2ZWwpO1xuICAgIH1cbiAgICByZXR1cm4gTG9nZ2VyLmluZm87XG59O1xuXG5cbk9wZXJhdGlvblF1ZXVlLnByb3RvdHlwZS5fbG9nU3RvcCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgbG9nRnVuYyA9IHRoaXMuX2dldExvZ0Z1bmMoKTtcbiAgICBpZiAoTG9nZ2VyLmluZm8uaXNFbmFibGVkIHx8IHRoaXMubG9nZ2luZ092ZXJpZGRlbikge1xuICAgICAgICB2YXIgbmFtZSA9IHRoaXMubmFtZSB8fCBcIlVubmFtZWQgUXVldWVcIjtcbiAgICAgICAgbG9nRnVuYygnXCInICsgbmFtZSArICdcIiBpcyBubyBsb25nZXIgcnVubmluZycpO1xuICAgIH1cbn07XG5cbk9wZXJhdGlvblF1ZXVlLnByb3RvdHlwZS5fYWRkT3BlcmF0aW9uID0gZnVuY3Rpb24gKG9wKSB7XG4gICAgaWYgKHRoaXMubnVtUnVubmluZ09wZXJhdGlvbnMgPCB0aGlzLm1heENvbmN1cnJlbnRPcGVyYXRpb25zICYmIHRoaXMuX3J1bm5pbmcpIHtcbiAgICAgICAgdGhpcy5fcnVuT3BlcmF0aW9uKG9wKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHRoaXMuX3F1ZXVlZE9wZXJhdGlvbnMucHVzaChvcCk7XG4gICAgfVxuICAgIHRoaXMuX2xvZ1N0YXR1cygpO1xufTtcblxuT3BlcmF0aW9uUXVldWUucHJvdG90eXBlLmFkZE9wZXJhdGlvbiA9IGZ1bmN0aW9uIChvcGVyYXRpb25Pck9wZXJhdGlvbnMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvcGVyYXRpb25Pck9wZXJhdGlvbnMpID09PSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICAgIF8uZWFjaChvcGVyYXRpb25Pck9wZXJhdGlvbnMsIGZ1bmN0aW9uIChvcCkge3NlbGYuX2FkZE9wZXJhdGlvbihvcCl9KTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHRoaXMuX2FkZE9wZXJhdGlvbihvcGVyYXRpb25Pck9wZXJhdGlvbnMpO1xuICAgIH1cbn07XG5cbk9wZXJhdGlvblF1ZXVlLnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHdhc1J1bm5pbmcgPSB0aGlzLl9ydW5uaW5nO1xuICAgIHRoaXMuX3J1bm5pbmcgPSB0cnVlO1xuICAgIGlmICghd2FzUnVubmluZykge1xuICAgICAgICBfLmVhY2goc2VsZi5fb25TdGFydCwgZnVuY3Rpb24gKGMpIHtcbiAgICAgICAgICAgIF8uYmluZChjLCBzZWxmKSgpO1xuICAgICAgICB9KTtcbiAgICAgICAgc2VsZi5fbmV4dE9wZXJhdGlvbnMoKTtcbiAgICAgICAgc2VsZi5fbG9nU3RhcnQoKTtcbiAgICB9XG59O1xuXG5PcGVyYXRpb25RdWV1ZS5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uIChjYW5jZWwpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHdhc1J1bm5pbmcgPSB0aGlzLl9ydW5uaW5nO1xuICAgIHRoaXMuX3J1bm5pbmcgPSBmYWxzZTtcbiAgICBpZiAod2FzUnVubmluZykge1xuICAgICAgICBpZiAoY2FuY2VsKSB7XG4gICAgICAgICAgICB2YXIgb3BlcmF0aW9ucyA9IHRoaXMuX3J1bm5pbmdPcGVyYXRpb25zLnNsaWNlKDApOyAvLyBDbG9uZSBzbyBub3QgZmlnaHRpbmcgY2FsbGJhY2tzLlxuICAgICAgICAgICAgXy5lYWNoKG9wZXJhdGlvbnMsIGZ1bmN0aW9uIChvKSB7XG4gICAgICAgICAgICAgICAgby5jYW5jZWwoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHNlbGYuX2xvZ1N0b3AoKTtcbiAgICAgICAgXy5lYWNoKHNlbGYuX29uU3RvcCwgZnVuY3Rpb24gKGMpIHtcbiAgICAgICAgICAgIF8uYmluZChjLCBzZWxmKSgpO1xuICAgICAgICB9KTtcbiAgICB9XG59O1xuXG5PcGVyYXRpb25RdWV1ZS5wcm90b3R5cGUub25TdGFydCA9IGZ1bmN0aW9uIChvKSB7XG4gICAgdGhpcy5fb25TdGFydC5wdXNoKG8pO1xufTtcbk9wZXJhdGlvblF1ZXVlLnByb3RvdHlwZS5vblN0b3AgPSBmdW5jdGlvbiAobykge1xuICAgIHRoaXMuX29uU3RvcC5wdXNoKG8pO1xufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KE9wZXJhdGlvblF1ZXVlLCAnbG9nTGV2ZWwnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBMb2dnZXIuY3VycmVudExldmVsKCk7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uICh2KSB7XG4gICAgICAgIExvZ2dlci5zZXRMZXZlbCh2KTtcbiAgICB9LFxuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICBlbnVtZXJhYmxlOiB0cnVlXG59KTtcblxuXG5tb2R1bGUuZXhwb3J0cy5PcGVyYXRpb25RdWV1ZSA9IE9wZXJhdGlvblF1ZXVlO1xuIl19
