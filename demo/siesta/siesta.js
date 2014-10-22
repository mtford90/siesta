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
                throw RestError('A singleton mapping has more than 1 object in the cache! This is a serious error. ' +
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
    if (!name) throw RestError('Collection must have a name');
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
Logger.setLevel(log.Level.trace);

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
                reverseMapping.relationships[relationship.reverseName] = relationship;
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
            Logger.info('New object created _id="' + _id.toString() + '"', data);
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
Logger.setLevel(log.Level.trace);


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
        if (datum[name]) {
            indexes.push(i);
            relatedData.push(datum[name]);
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

function getReverseProxyForObject(obj) {
    var reverseName = getReverseName.call(this);
    var proxyName = (reverseName + 'Proxy');
    if (util.isArray(obj)) {
        return _.pluck(obj, proxyName);
    }
    else {
        return obj[proxyName];
    }
}

function getForwardProxyForObject(obj) {
    var forwardName = getForwardName.call(this);
    var proxyName = forwardName + 'Proxy';
    if (util.isArray(obj)) {
        return _.pluck(obj, proxyName);
    }
    else {
        return obj[proxyName];
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
    if (!proxyObject) throw RestError('Proxy must have an object associated');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9pbmRleC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L25vZGVfbW9kdWxlcy9leHRlbmQvaW5kZXguanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9ub2RlX21vZHVsZXMvcS9xLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvc3JjL2NhY2hlLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvc3JjL2NoYW5nZXMuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9zcmMvY29sbGVjdGlvbi5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L3NyYy9jb2xsZWN0aW9uUmVnaXN0cnkuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9zcmMvZXJyb3IuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9zcmMvbWFueVRvTWFueVByb3h5LmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvc3JjL21hcHBpbmcuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9zcmMvbWFwcGluZ09wZXJhdGlvbi5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L3NyYy9taXNjLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3Qvc3JjL25vdGlmaWNhdGlvbkNlbnRyZS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L3NyYy9vYmplY3QuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9zcmMvb25lVG9NYW55UHJveHkuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9zcmMvb25lVG9PbmVQcm94eS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L3NyYy9wcm94eS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L3NyYy9xdWVyeS5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L3NyYy9yZWxhdGlvbnNoaXAuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9zcmMvc3RvcmUuanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC9zcmMvdXRpbC5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlLmpzIiwiL1VzZXJzL210Zm9yZC9QbGF5Z3JvdW5kL3Jlc3QvdmVuZG9yL29wZXJhdGlvbnMuanMvc3JjL2xvZy5qcyIsIi9Vc2Vycy9tdGZvcmQvUGxheWdyb3VuZC9yZXN0L3ZlbmRvci9vcGVyYXRpb25zLmpzL3NyYy9vcGVyYXRpb24uanMiLCIvVXNlcnMvbXRmb3JkL1BsYXlncm91bmQvcmVzdC92ZW5kb3Ivb3BlcmF0aW9ucy5qcy9zcmMvcXVldWUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3U0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsM0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pVQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOVdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxbUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL1dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25OQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvYUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdE5BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0c0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDalZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIGNvbGxlY3Rpb24gPSByZXF1aXJlKCcuL3NyYy9jb2xsZWN0aW9uJyk7XG52YXIgdXRpbCA9IHJlcXVpcmUoJy4vc3JjL3V0aWwnKTtcblxudmFyIENvbGxlY3Rpb25SZWdpc3RyeSA9IHJlcXVpcmUoJy4vc3JjL2NvbGxlY3Rpb25SZWdpc3RyeScpLkNvbGxlY3Rpb25SZWdpc3RyeVxuICAgICwgQ29sbGVjdGlvbiA9IGNvbGxlY3Rpb24uQ29sbGVjdGlvblxuICAgICwgY2FjaGUgPSByZXF1aXJlKCcuL3NyYy9jYWNoZScpXG4gICAgLCBNYXBwaW5nID0gcmVxdWlyZSgnLi9zcmMvbWFwcGluZycpLk1hcHBpbmdcbiAgICAsIG5vdGlmaWNhdGlvbkNlbnRyZSA9IHJlcXVpcmUoJy4vc3JjL25vdGlmaWNhdGlvbkNlbnRyZScpLm5vdGlmaWNhdGlvbkNlbnRyZVxuICAgICwgT3BlcmF0aW9uID0gcmVxdWlyZSgnLi92ZW5kb3Ivb3BlcmF0aW9ucy5qcy9zcmMvb3BlcmF0aW9uJykuT3BlcmF0aW9uXG4gICAgLCBPcGVyYXRpb25RdWV1ZSA9IHJlcXVpcmUoJy4vdmVuZG9yL29wZXJhdGlvbnMuanMvc3JjL3F1ZXVlJykuT3BlcmF0aW9uUXVldWVcbiAgICAsIFJlbGF0aW9uc2hpcFR5cGUgPSByZXF1aXJlKCcuL3NyYy9yZWxhdGlvbnNoaXAnKS5SZWxhdGlvbnNoaXBUeXBlXG4gICAgLCBsb2cgPSByZXF1aXJlKCcuL3ZlbmRvci9vcGVyYXRpb25zLmpzL3NyYy9sb2cnKVxuICAgICwgcSA9IHJlcXVpcmUoJ3EnKVxuICAgICwgXyA9IHV0aWwuXztcblxuXG5PcGVyYXRpb24ubG9nTGV2ZWwgPSBsb2cuTGV2ZWwud2Fybjtcbk9wZXJhdGlvblF1ZXVlLmxvZ0xldmVsID0gbG9nLkxldmVsLndhcm47XG5cblxudmFyIHNpZXN0YTtcbmlmICh0eXBlb2YgbW9kdWxlICE9ICd1bmRlZmluZWQnKSB7XG4gICAgc2llc3RhID0gbW9kdWxlLmV4cG9ydHM7XG59XG5lbHNlIHtcbiAgICBzaWVzdGEgPSB7fTtcbn1cblxuc2llc3RhLnNhdmUgPSBmdW5jdGlvbiBzYXZlKGNhbGxiYWNrKSB7XG4gICAgdmFyIGRlZmVycmVkID0gcS5kZWZlcigpO1xuICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgaWYgKHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQpIHtcbiAgICAgICAgdXRpbC5uZXh0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBtZXJnZUNoYW5nZXMgPSBzaWVzdGEuZXh0LnN0b3JhZ2UuY2hhbmdlcy5tZXJnZUNoYW5nZXM7XG4gICAgICAgICAgICBtZXJnZUNoYW5nZXMoY2FsbGJhY2spO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGNhbGxiYWNrKCdTdG9yYWdlIG1vZHVsZSBub3QgaW5zdGFsbGVkJyk7XG4gICAgfVxuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufTtcblxuc2llc3RhLnJlc2V0ID0gZnVuY3Rpb24gKCkge1xuICAgIGNhY2hlLnJlc2V0KCk7XG4gICAgQ29sbGVjdGlvblJlZ2lzdHJ5LnJlc2V0KCk7XG4gICAgc2llc3RhLmV4dC5odHRwLkRlc2NyaXB0b3JSZWdpc3RyeS5yZXNldCgpO1xuICAgIC8vbm9pbnNwZWN0aW9uIEpTQWNjZXNzaWJpbGl0eUNoZWNrXG59O1xuXG5cbnNpZXN0YS5vbiA9IF8uYmluZChub3RpZmljYXRpb25DZW50cmUub24sIG5vdGlmaWNhdGlvbkNlbnRyZSk7XG5zaWVzdGEuYWRkTGlzdGVuZXIgPSBfLmJpbmQobm90aWZpY2F0aW9uQ2VudHJlLmFkZExpc3RlbmVyLCBub3RpZmljYXRpb25DZW50cmUpO1xuc2llc3RhLnJlbW92ZUxpc3RlbmVyID0gXy5iaW5kKG5vdGlmaWNhdGlvbkNlbnRyZS5yZW1vdmVMaXN0ZW5lciwgbm90aWZpY2F0aW9uQ2VudHJlKTtcbnNpZXN0YS5vbmNlID0gXy5iaW5kKG5vdGlmaWNhdGlvbkNlbnRyZS5vbmNlLCBub3RpZmljYXRpb25DZW50cmUpO1xuXG5zaWVzdGEuQ29sbGVjdGlvbiA9IENvbGxlY3Rpb247XG5zaWVzdGEuUmVsYXRpb25zaGlwVHlwZSA9IFJlbGF0aW9uc2hpcFR5cGU7XG5cbi8vIFVzZWQgYnkgbW9kdWxlcy5cbnZhciBjb3JlQ2hhbmdlcyA9IHJlcXVpcmUoJy4vc3JjL2NoYW5nZXMnKTtcblxuLy8gTWFrZSBhdmFpbGFibGUgbW9kdWxlcyB0byBleHRlbnNpb25zLlxuc2llc3RhLl9pbnRlcm5hbCA9IHtcbiAgICBsb2c6IGxvZyxcbiAgICBNYXBwaW5nOiBNYXBwaW5nLFxuICAgIG1hcHBpbmc6IHJlcXVpcmUoJy4vc3JjL21hcHBpbmcnKSxcbiAgICBlcnJvcjogcmVxdWlyZSgnLi9zcmMvZXJyb3InKSxcbiAgICBDaGFuZ2VUeXBlOiBjb3JlQ2hhbmdlcy5DaGFuZ2VUeXBlLFxuICAgIG9iamVjdDogcmVxdWlyZSgnLi9zcmMvb2JqZWN0JyksXG4gICAgZXh0ZW5kOiByZXF1aXJlKCdleHRlbmQnKSxcbiAgICBub3RpZmljYXRpb25DZW50cmU6IHJlcXVpcmUoJy4vc3JjL25vdGlmaWNhdGlvbkNlbnRyZScpLFxuICAgIGNhY2hlOiByZXF1aXJlKCcuL3NyYy9jYWNoZScpLFxuICAgIG1pc2M6IHJlcXVpcmUoJy4vc3JjL21pc2MnKSxcbiAgICBPcGVyYXRpb246IE9wZXJhdGlvbixcbiAgICBPcGVyYXRpb25RdWV1ZTogT3BlcmF0aW9uUXVldWUsXG4gICAgY29yZUNoYW5nZXM6IGNvcmVDaGFuZ2VzLFxuICAgIENvbGxlY3Rpb25SZWdpc3RyeTogcmVxdWlyZSgnLi9zcmMvY29sbGVjdGlvblJlZ2lzdHJ5JykuQ29sbGVjdGlvblJlZ2lzdHJ5LFxuICAgIENvbGxlY3Rpb246IGNvbGxlY3Rpb24uQ29sbGVjdGlvbixcbiAgICBjb2xsZWN0aW9uOiBjb2xsZWN0aW9uLFxuICAgIHV0aWxzOiB1dGlsLFxuICAgIHV0aWw6IHV0aWwsXG4gICAgXzogdXRpbC5fLFxuICAgIHF1ZXJ5OiByZXF1aXJlKCcuL3NyYy9xdWVyeScpLFxuICAgIHN0b3JlOiByZXF1aXJlKCcuL3NyYy9zdG9yZScpLFxuICAgIHE6IHJlcXVpcmUoJ3EnKVxufTtcblxuc2llc3RhLnBlcmZvcm1hbmNlTW9uaXRvcmluZ0VuYWJsZWQgPSBmYWxzZTtcbnNpZXN0YS5odHRwRW5hYmxlZCA9IGZhbHNlO1xuc2llc3RhLnN0b3JhZ2VFbmFibGVkID0gZmFsc2U7XG5cbnNpZXN0YS5leHQgPSB7fTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KHNpZXN0YSwgJ3NldFBvdWNoJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCkge1xuICAgICAgICAgICAgcmV0dXJuIHNpZXN0YS5leHQuc3RvcmFnZS5wb3VjaC5zZXRQb3VjaDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KHNpZXN0YS5leHQsICdzdG9yYWdlRW5hYmxlZCcsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKHNpZXN0YS5leHQuX3N0b3JhZ2VFbmFibGVkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBzaWVzdGEuZXh0Ll9zdG9yYWdlRW5hYmxlZDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gISFzaWVzdGEuZXh0LnN0b3JhZ2U7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uICh2KSB7XG4gICAgICAgIHNpZXN0YS5leHQuX3N0b3JhZ2VFbmFibGVkID0gdjtcbiAgICB9XG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KHNpZXN0YS5leHQsICdodHRwRW5hYmxlZCcsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKHNpZXN0YS5leHQuX2h0dHBFbmFibGVkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBzaWVzdGEuZXh0Ll9odHRwRW5hYmxlZDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gISFzaWVzdGEuZXh0Lmh0dHA7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uICh2KSB7XG4gICAgICAgIHNpZXN0YS5leHQuX2h0dHBFbmFibGVkID0gdjtcbiAgICB9XG59KTtcblxuc2llc3RhLmNvbGxlY3Rpb24gPSBmdW5jdGlvbiAobmFtZSwgb3B0cykge1xuICAgIHJldHVybiBuZXcgQ29sbGVjdGlvbihuYW1lLCBvcHRzKTtcbn07XG5cblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KHNpZXN0YSwgJ2lzRGlydHknLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBDb2xsZWN0aW9uLmlzRGlydHlcbiAgICB9LFxuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICBlbnVtZXJhYmxlOiB0cnVlXG59KTtcblxuXG5cblxuaWYgKHR5cGVvZiB3aW5kb3cgIT0gJ3VuZGVmaW5lZCcpIHtcbiAgICB3aW5kb3cuc2llc3RhID0gc2llc3RhO1xufVxuXG5leHBvcnRzLnNpZXN0YSA9IHNpZXN0YTsiLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgICAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuXG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgdmFyIG07XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCFlbWl0dGVyLl9ldmVudHMgfHwgIWVtaXR0ZXIuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSAwO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKGVtaXR0ZXIuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gMTtcbiAgZWxzZVxuICAgIHJldCA9IGVtaXR0ZXIuX2V2ZW50c1t0eXBlXS5sZW5ndGg7XG4gIHJldHVybiByZXQ7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcblxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG5wcm9jZXNzLm5leHRUaWNrID0gKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgY2FuU2V0SW1tZWRpYXRlID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCdcbiAgICAmJiB3aW5kb3cuc2V0SW1tZWRpYXRlO1xuICAgIHZhciBjYW5Qb3N0ID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCdcbiAgICAmJiB3aW5kb3cucG9zdE1lc3NhZ2UgJiYgd2luZG93LmFkZEV2ZW50TGlzdGVuZXJcbiAgICA7XG5cbiAgICBpZiAoY2FuU2V0SW1tZWRpYXRlKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoZikgeyByZXR1cm4gd2luZG93LnNldEltbWVkaWF0ZShmKSB9O1xuICAgIH1cblxuICAgIGlmIChjYW5Qb3N0KSB7XG4gICAgICAgIHZhciBxdWV1ZSA9IFtdO1xuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uIChldikge1xuICAgICAgICAgICAgdmFyIHNvdXJjZSA9IGV2LnNvdXJjZTtcbiAgICAgICAgICAgIGlmICgoc291cmNlID09PSB3aW5kb3cgfHwgc291cmNlID09PSBudWxsKSAmJiBldi5kYXRhID09PSAncHJvY2Vzcy10aWNrJykge1xuICAgICAgICAgICAgICAgIGV2LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICAgIGlmIChxdWV1ZS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBmbiA9IHF1ZXVlLnNoaWZ0KCk7XG4gICAgICAgICAgICAgICAgICAgIGZuKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LCB0cnVlKTtcblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gbmV4dFRpY2soZm4pIHtcbiAgICAgICAgICAgIHF1ZXVlLnB1c2goZm4pO1xuICAgICAgICAgICAgd2luZG93LnBvc3RNZXNzYWdlKCdwcm9jZXNzLXRpY2snLCAnKicpO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBmdW5jdGlvbiBuZXh0VGljayhmbikge1xuICAgICAgICBzZXRUaW1lb3V0KGZuLCAwKTtcbiAgICB9O1xufSkoKTtcblxucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59XG5cbi8vIFRPRE8oc2h0eWxtYW4pXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbiIsInZhciBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xudmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcbnZhciB1bmRlZmluZWQ7XG5cbnZhciBpc1BsYWluT2JqZWN0ID0gZnVuY3Rpb24gaXNQbGFpbk9iamVjdChvYmopIHtcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cdGlmICghb2JqIHx8IHRvU3RyaW5nLmNhbGwob2JqKSAhPT0gJ1tvYmplY3QgT2JqZWN0XScgfHwgb2JqLm5vZGVUeXBlIHx8IG9iai5zZXRJbnRlcnZhbCkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHZhciBoYXNfb3duX2NvbnN0cnVjdG9yID0gaGFzT3duLmNhbGwob2JqLCAnY29uc3RydWN0b3InKTtcblx0dmFyIGhhc19pc19wcm9wZXJ0eV9vZl9tZXRob2QgPSBvYmouY29uc3RydWN0b3IgJiYgb2JqLmNvbnN0cnVjdG9yLnByb3RvdHlwZSAmJiBoYXNPd24uY2FsbChvYmouY29uc3RydWN0b3IucHJvdG90eXBlLCAnaXNQcm90b3R5cGVPZicpO1xuXHQvLyBOb3Qgb3duIGNvbnN0cnVjdG9yIHByb3BlcnR5IG11c3QgYmUgT2JqZWN0XG5cdGlmIChvYmouY29uc3RydWN0b3IgJiYgIWhhc19vd25fY29uc3RydWN0b3IgJiYgIWhhc19pc19wcm9wZXJ0eV9vZl9tZXRob2QpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHQvLyBPd24gcHJvcGVydGllcyBhcmUgZW51bWVyYXRlZCBmaXJzdGx5LCBzbyB0byBzcGVlZCB1cCxcblx0Ly8gaWYgbGFzdCBvbmUgaXMgb3duLCB0aGVuIGFsbCBwcm9wZXJ0aWVzIGFyZSBvd24uXG5cdHZhciBrZXk7XG5cdGZvciAoa2V5IGluIG9iaikge31cblxuXHRyZXR1cm4ga2V5ID09PSB1bmRlZmluZWQgfHwgaGFzT3duLmNhbGwob2JqLCBrZXkpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBleHRlbmQoKSB7XG5cdFwidXNlIHN0cmljdFwiO1xuXHR2YXIgb3B0aW9ucywgbmFtZSwgc3JjLCBjb3B5LCBjb3B5SXNBcnJheSwgY2xvbmUsXG5cdFx0dGFyZ2V0ID0gYXJndW1lbnRzWzBdLFxuXHRcdGkgPSAxLFxuXHRcdGxlbmd0aCA9IGFyZ3VtZW50cy5sZW5ndGgsXG5cdFx0ZGVlcCA9IGZhbHNlO1xuXG5cdC8vIEhhbmRsZSBhIGRlZXAgY29weSBzaXR1YXRpb25cblx0aWYgKHR5cGVvZiB0YXJnZXQgPT09IFwiYm9vbGVhblwiKSB7XG5cdFx0ZGVlcCA9IHRhcmdldDtcblx0XHR0YXJnZXQgPSBhcmd1bWVudHNbMV0gfHwge307XG5cdFx0Ly8gc2tpcCB0aGUgYm9vbGVhbiBhbmQgdGhlIHRhcmdldFxuXHRcdGkgPSAyO1xuXHR9IGVsc2UgaWYgKHR5cGVvZiB0YXJnZXQgIT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHRhcmdldCAhPT0gXCJmdW5jdGlvblwiIHx8IHRhcmdldCA9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRhcmdldCA9IHt9O1xuXHR9XG5cblx0Zm9yICg7IGkgPCBsZW5ndGg7ICsraSkge1xuXHRcdC8vIE9ubHkgZGVhbCB3aXRoIG5vbi1udWxsL3VuZGVmaW5lZCB2YWx1ZXNcblx0XHRpZiAoKG9wdGlvbnMgPSBhcmd1bWVudHNbaV0pICE9IG51bGwpIHtcblx0XHRcdC8vIEV4dGVuZCB0aGUgYmFzZSBvYmplY3Rcblx0XHRcdGZvciAobmFtZSBpbiBvcHRpb25zKSB7XG5cdFx0XHRcdHNyYyA9IHRhcmdldFtuYW1lXTtcblx0XHRcdFx0Y29weSA9IG9wdGlvbnNbbmFtZV07XG5cblx0XHRcdFx0Ly8gUHJldmVudCBuZXZlci1lbmRpbmcgbG9vcFxuXHRcdFx0XHRpZiAodGFyZ2V0ID09PSBjb3B5KSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBSZWN1cnNlIGlmIHdlJ3JlIG1lcmdpbmcgcGxhaW4gb2JqZWN0cyBvciBhcnJheXNcblx0XHRcdFx0aWYgKGRlZXAgJiYgY29weSAmJiAoaXNQbGFpbk9iamVjdChjb3B5KSB8fCAoY29weUlzQXJyYXkgPSBBcnJheS5pc0FycmF5KGNvcHkpKSkpIHtcblx0XHRcdFx0XHRpZiAoY29weUlzQXJyYXkpIHtcblx0XHRcdFx0XHRcdGNvcHlJc0FycmF5ID0gZmFsc2U7XG5cdFx0XHRcdFx0XHRjbG9uZSA9IHNyYyAmJiBBcnJheS5pc0FycmF5KHNyYykgPyBzcmMgOiBbXTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Y2xvbmUgPSBzcmMgJiYgaXNQbGFpbk9iamVjdChzcmMpID8gc3JjIDoge307XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly8gTmV2ZXIgbW92ZSBvcmlnaW5hbCBvYmplY3RzLCBjbG9uZSB0aGVtXG5cdFx0XHRcdFx0dGFyZ2V0W25hbWVdID0gZXh0ZW5kKGRlZXAsIGNsb25lLCBjb3B5KTtcblxuXHRcdFx0XHQvLyBEb24ndCBicmluZyBpbiB1bmRlZmluZWQgdmFsdWVzXG5cdFx0XHRcdH0gZWxzZSBpZiAoY29weSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0dGFyZ2V0W25hbWVdID0gY29weTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8vIFJldHVybiB0aGUgbW9kaWZpZWQgb2JqZWN0XG5cdHJldHVybiB0YXJnZXQ7XG59O1xuXG4iLCIoZnVuY3Rpb24gKHByb2Nlc3Mpe1xuLy8gdmltOnRzPTQ6c3RzPTQ6c3c9NDpcbi8qIVxuICpcbiAqIENvcHlyaWdodCAyMDA5LTIwMTIgS3JpcyBLb3dhbCB1bmRlciB0aGUgdGVybXMgb2YgdGhlIE1JVFxuICogbGljZW5zZSBmb3VuZCBhdCBodHRwOi8vZ2l0aHViLmNvbS9rcmlza293YWwvcS9yYXcvbWFzdGVyL0xJQ0VOU0VcbiAqXG4gKiBXaXRoIHBhcnRzIGJ5IFR5bGVyIENsb3NlXG4gKiBDb3B5cmlnaHQgMjAwNy0yMDA5IFR5bGVyIENsb3NlIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgTUlUIFggbGljZW5zZSBmb3VuZFxuICogYXQgaHR0cDovL3d3dy5vcGVuc291cmNlLm9yZy9saWNlbnNlcy9taXQtbGljZW5zZS5odG1sXG4gKiBGb3JrZWQgYXQgcmVmX3NlbmQuanMgdmVyc2lvbjogMjAwOS0wNS0xMVxuICpcbiAqIFdpdGggcGFydHMgYnkgTWFyayBNaWxsZXJcbiAqIENvcHlyaWdodCAoQykgMjAxMSBHb29nbGUgSW5jLlxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICpcbiAqL1xuXG4oZnVuY3Rpb24gKGRlZmluaXRpb24pIHtcbiAgICAvLyBUdXJuIG9mZiBzdHJpY3QgbW9kZSBmb3IgdGhpcyBmdW5jdGlvbiBzbyB3ZSBjYW4gYXNzaWduIHRvIGdsb2JhbC5RXG4gICAgLyoganNoaW50IHN0cmljdDogZmFsc2UgKi9cblxuICAgIC8vIFRoaXMgZmlsZSB3aWxsIGZ1bmN0aW9uIHByb3Blcmx5IGFzIGEgPHNjcmlwdD4gdGFnLCBvciBhIG1vZHVsZVxuICAgIC8vIHVzaW5nIENvbW1vbkpTIGFuZCBOb2RlSlMgb3IgUmVxdWlyZUpTIG1vZHVsZSBmb3JtYXRzLiAgSW5cbiAgICAvLyBDb21tb24vTm9kZS9SZXF1aXJlSlMsIHRoZSBtb2R1bGUgZXhwb3J0cyB0aGUgUSBBUEkgYW5kIHdoZW5cbiAgICAvLyBleGVjdXRlZCBhcyBhIHNpbXBsZSA8c2NyaXB0PiwgaXQgY3JlYXRlcyBhIFEgZ2xvYmFsIGluc3RlYWQuXG5cbiAgICAvLyBNb250YWdlIFJlcXVpcmVcbiAgICBpZiAodHlwZW9mIGJvb3RzdHJhcCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIGJvb3RzdHJhcChcInByb21pc2VcIiwgZGVmaW5pdGlvbik7XG5cbiAgICAvLyBDb21tb25KU1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGV4cG9ydHMgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBkZWZpbml0aW9uKCk7XG5cbiAgICAvLyBSZXF1aXJlSlNcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBkZWZpbmUgPT09IFwiZnVuY3Rpb25cIiAmJiBkZWZpbmUuYW1kKSB7XG4gICAgICAgIGRlZmluZShkZWZpbml0aW9uKTtcblxuICAgIC8vIFNFUyAoU2VjdXJlIEVjbWFTY3JpcHQpXG4gICAgfSBlbHNlIGlmICh0eXBlb2Ygc2VzICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgIGlmICghc2VzLm9rKCkpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNlcy5tYWtlUSA9IGRlZmluaXRpb247XG4gICAgICAgIH1cblxuICAgIC8vIDxzY3JpcHQ+XG4gICAgfSBlbHNlIHtcbiAgICAgICAgUSA9IGRlZmluaXRpb24oKTtcbiAgICB9XG5cbn0pKGZ1bmN0aW9uICgpIHtcblwidXNlIHN0cmljdFwiO1xuXG52YXIgaGFzU3RhY2tzID0gZmFsc2U7XG50cnkge1xuICAgIHRocm93IG5ldyBFcnJvcigpO1xufSBjYXRjaCAoZSkge1xuICAgIGhhc1N0YWNrcyA9ICEhZS5zdGFjaztcbn1cblxuLy8gQWxsIGNvZGUgYWZ0ZXIgdGhpcyBwb2ludCB3aWxsIGJlIGZpbHRlcmVkIGZyb20gc3RhY2sgdHJhY2VzIHJlcG9ydGVkXG4vLyBieSBRLlxudmFyIHFTdGFydGluZ0xpbmUgPSBjYXB0dXJlTGluZSgpO1xudmFyIHFGaWxlTmFtZTtcblxuLy8gc2hpbXNcblxuLy8gdXNlZCBmb3IgZmFsbGJhY2sgaW4gXCJhbGxSZXNvbHZlZFwiXG52YXIgbm9vcCA9IGZ1bmN0aW9uICgpIHt9O1xuXG4vLyBVc2UgdGhlIGZhc3Rlc3QgcG9zc2libGUgbWVhbnMgdG8gZXhlY3V0ZSBhIHRhc2sgaW4gYSBmdXR1cmUgdHVyblxuLy8gb2YgdGhlIGV2ZW50IGxvb3AuXG52YXIgbmV4dFRpY2sgPShmdW5jdGlvbiAoKSB7XG4gICAgLy8gbGlua2VkIGxpc3Qgb2YgdGFza3MgKHNpbmdsZSwgd2l0aCBoZWFkIG5vZGUpXG4gICAgdmFyIGhlYWQgPSB7dGFzazogdm9pZCAwLCBuZXh0OiBudWxsfTtcbiAgICB2YXIgdGFpbCA9IGhlYWQ7XG4gICAgdmFyIGZsdXNoaW5nID0gZmFsc2U7XG4gICAgdmFyIHJlcXVlc3RUaWNrID0gdm9pZCAwO1xuICAgIHZhciBpc05vZGVKUyA9IGZhbHNlO1xuXG4gICAgZnVuY3Rpb24gZmx1c2goKSB7XG4gICAgICAgIC8qIGpzaGludCBsb29wZnVuYzogdHJ1ZSAqL1xuXG4gICAgICAgIHdoaWxlIChoZWFkLm5leHQpIHtcbiAgICAgICAgICAgIGhlYWQgPSBoZWFkLm5leHQ7XG4gICAgICAgICAgICB2YXIgdGFzayA9IGhlYWQudGFzaztcbiAgICAgICAgICAgIGhlYWQudGFzayA9IHZvaWQgMDtcbiAgICAgICAgICAgIHZhciBkb21haW4gPSBoZWFkLmRvbWFpbjtcblxuICAgICAgICAgICAgaWYgKGRvbWFpbikge1xuICAgICAgICAgICAgICAgIGhlYWQuZG9tYWluID0gdm9pZCAwO1xuICAgICAgICAgICAgICAgIGRvbWFpbi5lbnRlcigpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHRhc2soKTtcblxuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIGlmIChpc05vZGVKUykge1xuICAgICAgICAgICAgICAgICAgICAvLyBJbiBub2RlLCB1bmNhdWdodCBleGNlcHRpb25zIGFyZSBjb25zaWRlcmVkIGZhdGFsIGVycm9ycy5cbiAgICAgICAgICAgICAgICAgICAgLy8gUmUtdGhyb3cgdGhlbSBzeW5jaHJvbm91c2x5IHRvIGludGVycnVwdCBmbHVzaGluZyFcblxuICAgICAgICAgICAgICAgICAgICAvLyBFbnN1cmUgY29udGludWF0aW9uIGlmIHRoZSB1bmNhdWdodCBleGNlcHRpb24gaXMgc3VwcHJlc3NlZFxuICAgICAgICAgICAgICAgICAgICAvLyBsaXN0ZW5pbmcgXCJ1bmNhdWdodEV4Y2VwdGlvblwiIGV2ZW50cyAoYXMgZG9tYWlucyBkb2VzKS5cbiAgICAgICAgICAgICAgICAgICAgLy8gQ29udGludWUgaW4gbmV4dCBldmVudCB0byBhdm9pZCB0aWNrIHJlY3Vyc2lvbi5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGRvbWFpbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgZG9tYWluLmV4aXQoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGZsdXNoLCAwKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRvbWFpbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgZG9tYWluLmVudGVyKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBlO1xuXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gSW4gYnJvd3NlcnMsIHVuY2F1Z2h0IGV4Y2VwdGlvbnMgYXJlIG5vdCBmYXRhbC5cbiAgICAgICAgICAgICAgICAgICAgLy8gUmUtdGhyb3cgdGhlbSBhc3luY2hyb25vdXNseSB0byBhdm9pZCBzbG93LWRvd25zLlxuICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICAgICAgICAgICAgICB9LCAwKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChkb21haW4pIHtcbiAgICAgICAgICAgICAgICBkb21haW4uZXhpdCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZmx1c2hpbmcgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBuZXh0VGljayA9IGZ1bmN0aW9uICh0YXNrKSB7XG4gICAgICAgIHRhaWwgPSB0YWlsLm5leHQgPSB7XG4gICAgICAgICAgICB0YXNrOiB0YXNrLFxuICAgICAgICAgICAgZG9tYWluOiBpc05vZGVKUyAmJiBwcm9jZXNzLmRvbWFpbixcbiAgICAgICAgICAgIG5leHQ6IG51bGxcbiAgICAgICAgfTtcblxuICAgICAgICBpZiAoIWZsdXNoaW5nKSB7XG4gICAgICAgICAgICBmbHVzaGluZyA9IHRydWU7XG4gICAgICAgICAgICByZXF1ZXN0VGljaygpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGlmICh0eXBlb2YgcHJvY2VzcyAhPT0gXCJ1bmRlZmluZWRcIiAmJiBwcm9jZXNzLm5leHRUaWNrKSB7XG4gICAgICAgIC8vIE5vZGUuanMgYmVmb3JlIDAuOS4gTm90ZSB0aGF0IHNvbWUgZmFrZS1Ob2RlIGVudmlyb25tZW50cywgbGlrZSB0aGVcbiAgICAgICAgLy8gTW9jaGEgdGVzdCBydW5uZXIsIGludHJvZHVjZSBhIGBwcm9jZXNzYCBnbG9iYWwgd2l0aG91dCBhIGBuZXh0VGlja2AuXG4gICAgICAgIGlzTm9kZUpTID0gdHJ1ZTtcblxuICAgICAgICByZXF1ZXN0VGljayA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHByb2Nlc3MubmV4dFRpY2soZmx1c2gpO1xuICAgICAgICB9O1xuXG4gICAgfSBlbHNlIGlmICh0eXBlb2Ygc2V0SW1tZWRpYXRlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgLy8gSW4gSUUxMCwgTm9kZS5qcyAwLjkrLCBvciBodHRwczovL2dpdGh1Yi5jb20vTm9ibGVKUy9zZXRJbW1lZGlhdGVcbiAgICAgICAgaWYgKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgICAgIHJlcXVlc3RUaWNrID0gc2V0SW1tZWRpYXRlLmJpbmQod2luZG93LCBmbHVzaCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXF1ZXN0VGljayA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBzZXRJbW1lZGlhdGUoZmx1c2gpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgfSBlbHNlIGlmICh0eXBlb2YgTWVzc2FnZUNoYW5uZWwgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgLy8gbW9kZXJuIGJyb3dzZXJzXG4gICAgICAgIC8vIGh0dHA6Ly93d3cubm9uYmxvY2tpbmcuaW8vMjAxMS8wNi93aW5kb3duZXh0dGljay5odG1sXG4gICAgICAgIHZhciBjaGFubmVsID0gbmV3IE1lc3NhZ2VDaGFubmVsKCk7XG4gICAgICAgIC8vIEF0IGxlYXN0IFNhZmFyaSBWZXJzaW9uIDYuMC41ICg4NTM2LjMwLjEpIGludGVybWl0dGVudGx5IGNhbm5vdCBjcmVhdGVcbiAgICAgICAgLy8gd29ya2luZyBtZXNzYWdlIHBvcnRzIHRoZSBmaXJzdCB0aW1lIGEgcGFnZSBsb2Fkcy5cbiAgICAgICAgY2hhbm5lbC5wb3J0MS5vbm1lc3NhZ2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXF1ZXN0VGljayA9IHJlcXVlc3RQb3J0VGljaztcbiAgICAgICAgICAgIGNoYW5uZWwucG9ydDEub25tZXNzYWdlID0gZmx1c2g7XG4gICAgICAgICAgICBmbHVzaCgpO1xuICAgICAgICB9O1xuICAgICAgICB2YXIgcmVxdWVzdFBvcnRUaWNrID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgLy8gT3BlcmEgcmVxdWlyZXMgdXMgdG8gcHJvdmlkZSBhIG1lc3NhZ2UgcGF5bG9hZCwgcmVnYXJkbGVzcyBvZlxuICAgICAgICAgICAgLy8gd2hldGhlciB3ZSB1c2UgaXQuXG4gICAgICAgICAgICBjaGFubmVsLnBvcnQyLnBvc3RNZXNzYWdlKDApO1xuICAgICAgICB9O1xuICAgICAgICByZXF1ZXN0VGljayA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHNldFRpbWVvdXQoZmx1c2gsIDApO1xuICAgICAgICAgICAgcmVxdWVzdFBvcnRUaWNrKCk7XG4gICAgICAgIH07XG5cbiAgICB9IGVsc2Uge1xuICAgICAgICAvLyBvbGQgYnJvd3NlcnNcbiAgICAgICAgcmVxdWVzdFRpY2sgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBzZXRUaW1lb3V0KGZsdXNoLCAwKTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV4dFRpY2s7XG59KSgpO1xuXG4vLyBBdHRlbXB0IHRvIG1ha2UgZ2VuZXJpY3Mgc2FmZSBpbiB0aGUgZmFjZSBvZiBkb3duc3RyZWFtXG4vLyBtb2RpZmljYXRpb25zLlxuLy8gVGhlcmUgaXMgbm8gc2l0dWF0aW9uIHdoZXJlIHRoaXMgaXMgbmVjZXNzYXJ5LlxuLy8gSWYgeW91IG5lZWQgYSBzZWN1cml0eSBndWFyYW50ZWUsIHRoZXNlIHByaW1vcmRpYWxzIG5lZWQgdG8gYmVcbi8vIGRlZXBseSBmcm96ZW4gYW55d2F5LCBhbmQgaWYgeW91IGRvbuKAmXQgbmVlZCBhIHNlY3VyaXR5IGd1YXJhbnRlZSxcbi8vIHRoaXMgaXMganVzdCBwbGFpbiBwYXJhbm9pZC5cbi8vIEhvd2V2ZXIsIHRoaXMgKiptaWdodCoqIGhhdmUgdGhlIG5pY2Ugc2lkZS1lZmZlY3Qgb2YgcmVkdWNpbmcgdGhlIHNpemUgb2Zcbi8vIHRoZSBtaW5pZmllZCBjb2RlIGJ5IHJlZHVjaW5nIHguY2FsbCgpIHRvIG1lcmVseSB4KClcbi8vIFNlZSBNYXJrIE1pbGxlcuKAmXMgZXhwbGFuYXRpb24gb2Ygd2hhdCB0aGlzIGRvZXMuXG4vLyBodHRwOi8vd2lraS5lY21hc2NyaXB0Lm9yZy9kb2t1LnBocD9pZD1jb252ZW50aW9uczpzYWZlX21ldGFfcHJvZ3JhbW1pbmdcbnZhciBjYWxsID0gRnVuY3Rpb24uY2FsbDtcbmZ1bmN0aW9uIHVuY3VycnlUaGlzKGYpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gY2FsbC5hcHBseShmLCBhcmd1bWVudHMpO1xuICAgIH07XG59XG4vLyBUaGlzIGlzIGVxdWl2YWxlbnQsIGJ1dCBzbG93ZXI6XG4vLyB1bmN1cnJ5VGhpcyA9IEZ1bmN0aW9uX2JpbmQuYmluZChGdW5jdGlvbl9iaW5kLmNhbGwpO1xuLy8gaHR0cDovL2pzcGVyZi5jb20vdW5jdXJyeXRoaXNcblxudmFyIGFycmF5X3NsaWNlID0gdW5jdXJyeVRoaXMoQXJyYXkucHJvdG90eXBlLnNsaWNlKTtcblxudmFyIGFycmF5X3JlZHVjZSA9IHVuY3VycnlUaGlzKFxuICAgIEFycmF5LnByb3RvdHlwZS5yZWR1Y2UgfHwgZnVuY3Rpb24gKGNhbGxiYWNrLCBiYXNpcykge1xuICAgICAgICB2YXIgaW5kZXggPSAwLFxuICAgICAgICAgICAgbGVuZ3RoID0gdGhpcy5sZW5ndGg7XG4gICAgICAgIC8vIGNvbmNlcm5pbmcgdGhlIGluaXRpYWwgdmFsdWUsIGlmIG9uZSBpcyBub3QgcHJvdmlkZWRcbiAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgIC8vIHNlZWsgdG8gdGhlIGZpcnN0IHZhbHVlIGluIHRoZSBhcnJheSwgYWNjb3VudGluZ1xuICAgICAgICAgICAgLy8gZm9yIHRoZSBwb3NzaWJpbGl0eSB0aGF0IGlzIGlzIGEgc3BhcnNlIGFycmF5XG4gICAgICAgICAgICBkbyB7XG4gICAgICAgICAgICAgICAgaWYgKGluZGV4IGluIHRoaXMpIHtcbiAgICAgICAgICAgICAgICAgICAgYmFzaXMgPSB0aGlzW2luZGV4KytdO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCsraW5kZXggPj0gbGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IHdoaWxlICgxKTtcbiAgICAgICAgfVxuICAgICAgICAvLyByZWR1Y2VcbiAgICAgICAgZm9yICg7IGluZGV4IDwgbGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgICAgICAvLyBhY2NvdW50IGZvciB0aGUgcG9zc2liaWxpdHkgdGhhdCB0aGUgYXJyYXkgaXMgc3BhcnNlXG4gICAgICAgICAgICBpZiAoaW5kZXggaW4gdGhpcykge1xuICAgICAgICAgICAgICAgIGJhc2lzID0gY2FsbGJhY2soYmFzaXMsIHRoaXNbaW5kZXhdLCBpbmRleCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGJhc2lzO1xuICAgIH1cbik7XG5cbnZhciBhcnJheV9pbmRleE9mID0gdW5jdXJyeVRoaXMoXG4gICAgQXJyYXkucHJvdG90eXBlLmluZGV4T2YgfHwgZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIC8vIG5vdCBhIHZlcnkgZ29vZCBzaGltLCBidXQgZ29vZCBlbm91Z2ggZm9yIG91ciBvbmUgdXNlIG9mIGl0XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKHRoaXNbaV0gPT09IHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIC0xO1xuICAgIH1cbik7XG5cbnZhciBhcnJheV9tYXAgPSB1bmN1cnJ5VGhpcyhcbiAgICBBcnJheS5wcm90b3R5cGUubWFwIHx8IGZ1bmN0aW9uIChjYWxsYmFjaywgdGhpc3ApIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICB2YXIgY29sbGVjdCA9IFtdO1xuICAgICAgICBhcnJheV9yZWR1Y2Uoc2VsZiwgZnVuY3Rpb24gKHVuZGVmaW5lZCwgdmFsdWUsIGluZGV4KSB7XG4gICAgICAgICAgICBjb2xsZWN0LnB1c2goY2FsbGJhY2suY2FsbCh0aGlzcCwgdmFsdWUsIGluZGV4LCBzZWxmKSk7XG4gICAgICAgIH0sIHZvaWQgMCk7XG4gICAgICAgIHJldHVybiBjb2xsZWN0O1xuICAgIH1cbik7XG5cbnZhciBvYmplY3RfY3JlYXRlID0gT2JqZWN0LmNyZWF0ZSB8fCBmdW5jdGlvbiAocHJvdG90eXBlKSB7XG4gICAgZnVuY3Rpb24gVHlwZSgpIHsgfVxuICAgIFR5cGUucHJvdG90eXBlID0gcHJvdG90eXBlO1xuICAgIHJldHVybiBuZXcgVHlwZSgpO1xufTtcblxudmFyIG9iamVjdF9oYXNPd25Qcm9wZXJ0eSA9IHVuY3VycnlUaGlzKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkpO1xuXG52YXIgb2JqZWN0X2tleXMgPSBPYmplY3Qua2V5cyB8fCBmdW5jdGlvbiAob2JqZWN0KSB7XG4gICAgdmFyIGtleXMgPSBbXTtcbiAgICBmb3IgKHZhciBrZXkgaW4gb2JqZWN0KSB7XG4gICAgICAgIGlmIChvYmplY3RfaGFzT3duUHJvcGVydHkob2JqZWN0LCBrZXkpKSB7XG4gICAgICAgICAgICBrZXlzLnB1c2goa2V5KTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4ga2V5cztcbn07XG5cbnZhciBvYmplY3RfdG9TdHJpbmcgPSB1bmN1cnJ5VGhpcyhPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nKTtcblxuZnVuY3Rpb24gaXNPYmplY3QodmFsdWUpIHtcbiAgICByZXR1cm4gdmFsdWUgPT09IE9iamVjdCh2YWx1ZSk7XG59XG5cbi8vIGdlbmVyYXRvciByZWxhdGVkIHNoaW1zXG5cbi8vIEZJWE1FOiBSZW1vdmUgdGhpcyBmdW5jdGlvbiBvbmNlIEVTNiBnZW5lcmF0b3JzIGFyZSBpbiBTcGlkZXJNb25rZXkuXG5mdW5jdGlvbiBpc1N0b3BJdGVyYXRpb24oZXhjZXB0aW9uKSB7XG4gICAgcmV0dXJuIChcbiAgICAgICAgb2JqZWN0X3RvU3RyaW5nKGV4Y2VwdGlvbikgPT09IFwiW29iamVjdCBTdG9wSXRlcmF0aW9uXVwiIHx8XG4gICAgICAgIGV4Y2VwdGlvbiBpbnN0YW5jZW9mIFFSZXR1cm5WYWx1ZVxuICAgICk7XG59XG5cbi8vIEZJWE1FOiBSZW1vdmUgdGhpcyBoZWxwZXIgYW5kIFEucmV0dXJuIG9uY2UgRVM2IGdlbmVyYXRvcnMgYXJlIGluXG4vLyBTcGlkZXJNb25rZXkuXG52YXIgUVJldHVyblZhbHVlO1xuaWYgKHR5cGVvZiBSZXR1cm5WYWx1ZSAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgIFFSZXR1cm5WYWx1ZSA9IFJldHVyblZhbHVlO1xufSBlbHNlIHtcbiAgICBRUmV0dXJuVmFsdWUgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICAgIH07XG59XG5cbi8vIGxvbmcgc3RhY2sgdHJhY2VzXG5cbnZhciBTVEFDS19KVU1QX1NFUEFSQVRPUiA9IFwiRnJvbSBwcmV2aW91cyBldmVudDpcIjtcblxuZnVuY3Rpb24gbWFrZVN0YWNrVHJhY2VMb25nKGVycm9yLCBwcm9taXNlKSB7XG4gICAgLy8gSWYgcG9zc2libGUsIHRyYW5zZm9ybSB0aGUgZXJyb3Igc3RhY2sgdHJhY2UgYnkgcmVtb3ZpbmcgTm9kZSBhbmQgUVxuICAgIC8vIGNydWZ0LCB0aGVuIGNvbmNhdGVuYXRpbmcgd2l0aCB0aGUgc3RhY2sgdHJhY2Ugb2YgYHByb21pc2VgLiBTZWUgIzU3LlxuICAgIGlmIChoYXNTdGFja3MgJiZcbiAgICAgICAgcHJvbWlzZS5zdGFjayAmJlxuICAgICAgICB0eXBlb2YgZXJyb3IgPT09IFwib2JqZWN0XCIgJiZcbiAgICAgICAgZXJyb3IgIT09IG51bGwgJiZcbiAgICAgICAgZXJyb3Iuc3RhY2sgJiZcbiAgICAgICAgZXJyb3Iuc3RhY2suaW5kZXhPZihTVEFDS19KVU1QX1NFUEFSQVRPUikgPT09IC0xXG4gICAgKSB7XG4gICAgICAgIHZhciBzdGFja3MgPSBbXTtcbiAgICAgICAgZm9yICh2YXIgcCA9IHByb21pc2U7ICEhcDsgcCA9IHAuc291cmNlKSB7XG4gICAgICAgICAgICBpZiAocC5zdGFjaykge1xuICAgICAgICAgICAgICAgIHN0YWNrcy51bnNoaWZ0KHAuc3RhY2spO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHN0YWNrcy51bnNoaWZ0KGVycm9yLnN0YWNrKTtcblxuICAgICAgICB2YXIgY29uY2F0ZWRTdGFja3MgPSBzdGFja3Muam9pbihcIlxcblwiICsgU1RBQ0tfSlVNUF9TRVBBUkFUT1IgKyBcIlxcblwiKTtcbiAgICAgICAgZXJyb3Iuc3RhY2sgPSBmaWx0ZXJTdGFja1N0cmluZyhjb25jYXRlZFN0YWNrcyk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBmaWx0ZXJTdGFja1N0cmluZyhzdGFja1N0cmluZykge1xuICAgIHZhciBsaW5lcyA9IHN0YWNrU3RyaW5nLnNwbGl0KFwiXFxuXCIpO1xuICAgIHZhciBkZXNpcmVkTGluZXMgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxpbmVzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIHZhciBsaW5lID0gbGluZXNbaV07XG5cbiAgICAgICAgaWYgKCFpc0ludGVybmFsRnJhbWUobGluZSkgJiYgIWlzTm9kZUZyYW1lKGxpbmUpICYmIGxpbmUpIHtcbiAgICAgICAgICAgIGRlc2lyZWRMaW5lcy5wdXNoKGxpbmUpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBkZXNpcmVkTGluZXMuam9pbihcIlxcblwiKTtcbn1cblxuZnVuY3Rpb24gaXNOb2RlRnJhbWUoc3RhY2tMaW5lKSB7XG4gICAgcmV0dXJuIHN0YWNrTGluZS5pbmRleE9mKFwiKG1vZHVsZS5qczpcIikgIT09IC0xIHx8XG4gICAgICAgICAgIHN0YWNrTGluZS5pbmRleE9mKFwiKG5vZGUuanM6XCIpICE9PSAtMTtcbn1cblxuZnVuY3Rpb24gZ2V0RmlsZU5hbWVBbmRMaW5lTnVtYmVyKHN0YWNrTGluZSkge1xuICAgIC8vIE5hbWVkIGZ1bmN0aW9uczogXCJhdCBmdW5jdGlvbk5hbWUgKGZpbGVuYW1lOmxpbmVOdW1iZXI6Y29sdW1uTnVtYmVyKVwiXG4gICAgLy8gSW4gSUUxMCBmdW5jdGlvbiBuYW1lIGNhbiBoYXZlIHNwYWNlcyAoXCJBbm9ueW1vdXMgZnVuY3Rpb25cIikgT19vXG4gICAgdmFyIGF0dGVtcHQxID0gL2F0IC4rIFxcKCguKyk6KFxcZCspOig/OlxcZCspXFwpJC8uZXhlYyhzdGFja0xpbmUpO1xuICAgIGlmIChhdHRlbXB0MSkge1xuICAgICAgICByZXR1cm4gW2F0dGVtcHQxWzFdLCBOdW1iZXIoYXR0ZW1wdDFbMl0pXTtcbiAgICB9XG5cbiAgICAvLyBBbm9ueW1vdXMgZnVuY3Rpb25zOiBcImF0IGZpbGVuYW1lOmxpbmVOdW1iZXI6Y29sdW1uTnVtYmVyXCJcbiAgICB2YXIgYXR0ZW1wdDIgPSAvYXQgKFteIF0rKTooXFxkKyk6KD86XFxkKykkLy5leGVjKHN0YWNrTGluZSk7XG4gICAgaWYgKGF0dGVtcHQyKSB7XG4gICAgICAgIHJldHVybiBbYXR0ZW1wdDJbMV0sIE51bWJlcihhdHRlbXB0MlsyXSldO1xuICAgIH1cblxuICAgIC8vIEZpcmVmb3ggc3R5bGU6IFwiZnVuY3Rpb25AZmlsZW5hbWU6bGluZU51bWJlciBvciBAZmlsZW5hbWU6bGluZU51bWJlclwiXG4gICAgdmFyIGF0dGVtcHQzID0gLy4qQCguKyk6KFxcZCspJC8uZXhlYyhzdGFja0xpbmUpO1xuICAgIGlmIChhdHRlbXB0Mykge1xuICAgICAgICByZXR1cm4gW2F0dGVtcHQzWzFdLCBOdW1iZXIoYXR0ZW1wdDNbMl0pXTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGlzSW50ZXJuYWxGcmFtZShzdGFja0xpbmUpIHtcbiAgICB2YXIgZmlsZU5hbWVBbmRMaW5lTnVtYmVyID0gZ2V0RmlsZU5hbWVBbmRMaW5lTnVtYmVyKHN0YWNrTGluZSk7XG5cbiAgICBpZiAoIWZpbGVOYW1lQW5kTGluZU51bWJlcikge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdmFyIGZpbGVOYW1lID0gZmlsZU5hbWVBbmRMaW5lTnVtYmVyWzBdO1xuICAgIHZhciBsaW5lTnVtYmVyID0gZmlsZU5hbWVBbmRMaW5lTnVtYmVyWzFdO1xuXG4gICAgcmV0dXJuIGZpbGVOYW1lID09PSBxRmlsZU5hbWUgJiZcbiAgICAgICAgbGluZU51bWJlciA+PSBxU3RhcnRpbmdMaW5lICYmXG4gICAgICAgIGxpbmVOdW1iZXIgPD0gcUVuZGluZ0xpbmU7XG59XG5cbi8vIGRpc2NvdmVyIG93biBmaWxlIG5hbWUgYW5kIGxpbmUgbnVtYmVyIHJhbmdlIGZvciBmaWx0ZXJpbmcgc3RhY2tcbi8vIHRyYWNlc1xuZnVuY3Rpb24gY2FwdHVyZUxpbmUoKSB7XG4gICAgaWYgKCFoYXNTdGFja3MpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcigpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgdmFyIGxpbmVzID0gZS5zdGFjay5zcGxpdChcIlxcblwiKTtcbiAgICAgICAgdmFyIGZpcnN0TGluZSA9IGxpbmVzWzBdLmluZGV4T2YoXCJAXCIpID4gMCA/IGxpbmVzWzFdIDogbGluZXNbMl07XG4gICAgICAgIHZhciBmaWxlTmFtZUFuZExpbmVOdW1iZXIgPSBnZXRGaWxlTmFtZUFuZExpbmVOdW1iZXIoZmlyc3RMaW5lKTtcbiAgICAgICAgaWYgKCFmaWxlTmFtZUFuZExpbmVOdW1iZXIpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHFGaWxlTmFtZSA9IGZpbGVOYW1lQW5kTGluZU51bWJlclswXTtcbiAgICAgICAgcmV0dXJuIGZpbGVOYW1lQW5kTGluZU51bWJlclsxXTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRlcHJlY2F0ZShjYWxsYmFjaywgbmFtZSwgYWx0ZXJuYXRpdmUpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAodHlwZW9mIGNvbnNvbGUgIT09IFwidW5kZWZpbmVkXCIgJiZcbiAgICAgICAgICAgIHR5cGVvZiBjb25zb2xlLndhcm4gPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKG5hbWUgKyBcIiBpcyBkZXByZWNhdGVkLCB1c2UgXCIgKyBhbHRlcm5hdGl2ZSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgXCIgaW5zdGVhZC5cIiwgbmV3IEVycm9yKFwiXCIpLnN0YWNrKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY2FsbGJhY2suYXBwbHkoY2FsbGJhY2ssIGFyZ3VtZW50cyk7XG4gICAgfTtcbn1cblxuLy8gZW5kIG9mIHNoaW1zXG4vLyBiZWdpbm5pbmcgb2YgcmVhbCB3b3JrXG5cbi8qKlxuICogQ29uc3RydWN0cyBhIHByb21pc2UgZm9yIGFuIGltbWVkaWF0ZSByZWZlcmVuY2UsIHBhc3NlcyBwcm9taXNlcyB0aHJvdWdoLCBvclxuICogY29lcmNlcyBwcm9taXNlcyBmcm9tIGRpZmZlcmVudCBzeXN0ZW1zLlxuICogQHBhcmFtIHZhbHVlIGltbWVkaWF0ZSByZWZlcmVuY2Ugb3IgcHJvbWlzZVxuICovXG5mdW5jdGlvbiBRKHZhbHVlKSB7XG4gICAgLy8gSWYgdGhlIG9iamVjdCBpcyBhbHJlYWR5IGEgUHJvbWlzZSwgcmV0dXJuIGl0IGRpcmVjdGx5LiAgVGhpcyBlbmFibGVzXG4gICAgLy8gdGhlIHJlc29sdmUgZnVuY3Rpb24gdG8gYm90aCBiZSB1c2VkIHRvIGNyZWF0ZWQgcmVmZXJlbmNlcyBmcm9tIG9iamVjdHMsXG4gICAgLy8gYnV0IHRvIHRvbGVyYWJseSBjb2VyY2Ugbm9uLXByb21pc2VzIHRvIHByb21pc2VzLlxuICAgIGlmIChpc1Byb21pc2UodmFsdWUpKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG5cbiAgICAvLyBhc3NpbWlsYXRlIHRoZW5hYmxlc1xuICAgIGlmIChpc1Byb21pc2VBbGlrZSh2YWx1ZSkpIHtcbiAgICAgICAgcmV0dXJuIGNvZXJjZSh2YWx1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGZ1bGZpbGwodmFsdWUpO1xuICAgIH1cbn1cblEucmVzb2x2ZSA9IFE7XG5cbi8qKlxuICogUGVyZm9ybXMgYSB0YXNrIGluIGEgZnV0dXJlIHR1cm4gb2YgdGhlIGV2ZW50IGxvb3AuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSB0YXNrXG4gKi9cblEubmV4dFRpY2sgPSBuZXh0VGljaztcblxuLyoqXG4gKiBDb250cm9scyB3aGV0aGVyIG9yIG5vdCBsb25nIHN0YWNrIHRyYWNlcyB3aWxsIGJlIG9uXG4gKi9cblEubG9uZ1N0YWNrU3VwcG9ydCA9IGZhbHNlO1xuXG4vKipcbiAqIENvbnN0cnVjdHMgYSB7cHJvbWlzZSwgcmVzb2x2ZSwgcmVqZWN0fSBvYmplY3QuXG4gKlxuICogYHJlc29sdmVgIGlzIGEgY2FsbGJhY2sgdG8gaW52b2tlIHdpdGggYSBtb3JlIHJlc29sdmVkIHZhbHVlIGZvciB0aGVcbiAqIHByb21pc2UuIFRvIGZ1bGZpbGwgdGhlIHByb21pc2UsIGludm9rZSBgcmVzb2x2ZWAgd2l0aCBhbnkgdmFsdWUgdGhhdCBpc1xuICogbm90IGEgdGhlbmFibGUuIFRvIHJlamVjdCB0aGUgcHJvbWlzZSwgaW52b2tlIGByZXNvbHZlYCB3aXRoIGEgcmVqZWN0ZWRcbiAqIHRoZW5hYmxlLCBvciBpbnZva2UgYHJlamVjdGAgd2l0aCB0aGUgcmVhc29uIGRpcmVjdGx5LiBUbyByZXNvbHZlIHRoZVxuICogcHJvbWlzZSB0byBhbm90aGVyIHRoZW5hYmxlLCB0aHVzIHB1dHRpbmcgaXQgaW4gdGhlIHNhbWUgc3RhdGUsIGludm9rZVxuICogYHJlc29sdmVgIHdpdGggdGhhdCBvdGhlciB0aGVuYWJsZS5cbiAqL1xuUS5kZWZlciA9IGRlZmVyO1xuZnVuY3Rpb24gZGVmZXIoKSB7XG4gICAgLy8gaWYgXCJtZXNzYWdlc1wiIGlzIGFuIFwiQXJyYXlcIiwgdGhhdCBpbmRpY2F0ZXMgdGhhdCB0aGUgcHJvbWlzZSBoYXMgbm90IHlldFxuICAgIC8vIGJlZW4gcmVzb2x2ZWQuICBJZiBpdCBpcyBcInVuZGVmaW5lZFwiLCBpdCBoYXMgYmVlbiByZXNvbHZlZC4gIEVhY2hcbiAgICAvLyBlbGVtZW50IG9mIHRoZSBtZXNzYWdlcyBhcnJheSBpcyBpdHNlbGYgYW4gYXJyYXkgb2YgY29tcGxldGUgYXJndW1lbnRzIHRvXG4gICAgLy8gZm9yd2FyZCB0byB0aGUgcmVzb2x2ZWQgcHJvbWlzZS4gIFdlIGNvZXJjZSB0aGUgcmVzb2x1dGlvbiB2YWx1ZSB0byBhXG4gICAgLy8gcHJvbWlzZSB1c2luZyB0aGUgYHJlc29sdmVgIGZ1bmN0aW9uIGJlY2F1c2UgaXQgaGFuZGxlcyBib3RoIGZ1bGx5XG4gICAgLy8gbm9uLXRoZW5hYmxlIHZhbHVlcyBhbmQgb3RoZXIgdGhlbmFibGVzIGdyYWNlZnVsbHkuXG4gICAgdmFyIG1lc3NhZ2VzID0gW10sIHByb2dyZXNzTGlzdGVuZXJzID0gW10sIHJlc29sdmVkUHJvbWlzZTtcblxuICAgIHZhciBkZWZlcnJlZCA9IG9iamVjdF9jcmVhdGUoZGVmZXIucHJvdG90eXBlKTtcbiAgICB2YXIgcHJvbWlzZSA9IG9iamVjdF9jcmVhdGUoUHJvbWlzZS5wcm90b3R5cGUpO1xuXG4gICAgcHJvbWlzZS5wcm9taXNlRGlzcGF0Y2ggPSBmdW5jdGlvbiAocmVzb2x2ZSwgb3AsIG9wZXJhbmRzKSB7XG4gICAgICAgIHZhciBhcmdzID0gYXJyYXlfc2xpY2UoYXJndW1lbnRzKTtcbiAgICAgICAgaWYgKG1lc3NhZ2VzKSB7XG4gICAgICAgICAgICBtZXNzYWdlcy5wdXNoKGFyZ3MpO1xuICAgICAgICAgICAgaWYgKG9wID09PSBcIndoZW5cIiAmJiBvcGVyYW5kc1sxXSkgeyAvLyBwcm9ncmVzcyBvcGVyYW5kXG4gICAgICAgICAgICAgICAgcHJvZ3Jlc3NMaXN0ZW5lcnMucHVzaChvcGVyYW5kc1sxXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZWRQcm9taXNlLnByb21pc2VEaXNwYXRjaC5hcHBseShyZXNvbHZlZFByb21pc2UsIGFyZ3MpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gWFhYIGRlcHJlY2F0ZWRcbiAgICBwcm9taXNlLnZhbHVlT2YgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmIChtZXNzYWdlcykge1xuICAgICAgICAgICAgcmV0dXJuIHByb21pc2U7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIG5lYXJlclZhbHVlID0gbmVhcmVyKHJlc29sdmVkUHJvbWlzZSk7XG4gICAgICAgIGlmIChpc1Byb21pc2UobmVhcmVyVmFsdWUpKSB7XG4gICAgICAgICAgICByZXNvbHZlZFByb21pc2UgPSBuZWFyZXJWYWx1ZTsgLy8gc2hvcnRlbiBjaGFpblxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZWFyZXJWYWx1ZTtcbiAgICB9O1xuXG4gICAgcHJvbWlzZS5pbnNwZWN0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoIXJlc29sdmVkUHJvbWlzZSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3RhdGU6IFwicGVuZGluZ1wiIH07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc29sdmVkUHJvbWlzZS5pbnNwZWN0KCk7XG4gICAgfTtcblxuICAgIGlmIChRLmxvbmdTdGFja1N1cHBvcnQgJiYgaGFzU3RhY2tzKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgLy8gTk9URTogZG9uJ3QgdHJ5IHRvIHVzZSBgRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2VgIG9yIHRyYW5zZmVyIHRoZVxuICAgICAgICAgICAgLy8gYWNjZXNzb3IgYXJvdW5kOyB0aGF0IGNhdXNlcyBtZW1vcnkgbGVha3MgYXMgcGVyIEdILTExMS4gSnVzdFxuICAgICAgICAgICAgLy8gcmVpZnkgdGhlIHN0YWNrIHRyYWNlIGFzIGEgc3RyaW5nIEFTQVAuXG4gICAgICAgICAgICAvL1xuICAgICAgICAgICAgLy8gQXQgdGhlIHNhbWUgdGltZSwgY3V0IG9mZiB0aGUgZmlyc3QgbGluZTsgaXQncyBhbHdheXMganVzdFxuICAgICAgICAgICAgLy8gXCJbb2JqZWN0IFByb21pc2VdXFxuXCIsIGFzIHBlciB0aGUgYHRvU3RyaW5nYC5cbiAgICAgICAgICAgIHByb21pc2Uuc3RhY2sgPSBlLnN0YWNrLnN1YnN0cmluZyhlLnN0YWNrLmluZGV4T2YoXCJcXG5cIikgKyAxKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIE5PVEU6IHdlIGRvIHRoZSBjaGVja3MgZm9yIGByZXNvbHZlZFByb21pc2VgIGluIGVhY2ggbWV0aG9kLCBpbnN0ZWFkIG9mXG4gICAgLy8gY29uc29saWRhdGluZyB0aGVtIGludG8gYGJlY29tZWAsIHNpbmNlIG90aGVyd2lzZSB3ZSdkIGNyZWF0ZSBuZXdcbiAgICAvLyBwcm9taXNlcyB3aXRoIHRoZSBsaW5lcyBgYmVjb21lKHdoYXRldmVyKHZhbHVlKSlgLiBTZWUgZS5nLiBHSC0yNTIuXG5cbiAgICBmdW5jdGlvbiBiZWNvbWUobmV3UHJvbWlzZSkge1xuICAgICAgICByZXNvbHZlZFByb21pc2UgPSBuZXdQcm9taXNlO1xuICAgICAgICBwcm9taXNlLnNvdXJjZSA9IG5ld1Byb21pc2U7XG5cbiAgICAgICAgYXJyYXlfcmVkdWNlKG1lc3NhZ2VzLCBmdW5jdGlvbiAodW5kZWZpbmVkLCBtZXNzYWdlKSB7XG4gICAgICAgICAgICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgbmV3UHJvbWlzZS5wcm9taXNlRGlzcGF0Y2guYXBwbHkobmV3UHJvbWlzZSwgbWVzc2FnZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSwgdm9pZCAwKTtcblxuICAgICAgICBtZXNzYWdlcyA9IHZvaWQgMDtcbiAgICAgICAgcHJvZ3Jlc3NMaXN0ZW5lcnMgPSB2b2lkIDA7XG4gICAgfVxuXG4gICAgZGVmZXJyZWQucHJvbWlzZSA9IHByb21pc2U7XG4gICAgZGVmZXJyZWQucmVzb2x2ZSA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICBpZiAocmVzb2x2ZWRQcm9taXNlKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBiZWNvbWUoUSh2YWx1ZSkpO1xuICAgIH07XG5cbiAgICBkZWZlcnJlZC5mdWxmaWxsID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIGlmIChyZXNvbHZlZFByb21pc2UpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGJlY29tZShmdWxmaWxsKHZhbHVlKSk7XG4gICAgfTtcbiAgICBkZWZlcnJlZC5yZWplY3QgPSBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgICAgIGlmIChyZXNvbHZlZFByb21pc2UpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGJlY29tZShyZWplY3QocmVhc29uKSk7XG4gICAgfTtcbiAgICBkZWZlcnJlZC5ub3RpZnkgPSBmdW5jdGlvbiAocHJvZ3Jlc3MpIHtcbiAgICAgICAgaWYgKHJlc29sdmVkUHJvbWlzZSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgYXJyYXlfcmVkdWNlKHByb2dyZXNzTGlzdGVuZXJzLCBmdW5jdGlvbiAodW5kZWZpbmVkLCBwcm9ncmVzc0xpc3RlbmVyKSB7XG4gICAgICAgICAgICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcHJvZ3Jlc3NMaXN0ZW5lcihwcm9ncmVzcyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSwgdm9pZCAwKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIGRlZmVycmVkO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBOb2RlLXN0eWxlIGNhbGxiYWNrIHRoYXQgd2lsbCByZXNvbHZlIG9yIHJlamVjdCB0aGUgZGVmZXJyZWRcbiAqIHByb21pc2UuXG4gKiBAcmV0dXJucyBhIG5vZGViYWNrXG4gKi9cbmRlZmVyLnByb3RvdHlwZS5tYWtlTm9kZVJlc29sdmVyID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICByZXR1cm4gZnVuY3Rpb24gKGVycm9yLCB2YWx1ZSkge1xuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgIHNlbGYucmVqZWN0KGVycm9yKTtcbiAgICAgICAgfSBlbHNlIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMikge1xuICAgICAgICAgICAgc2VsZi5yZXNvbHZlKGFycmF5X3NsaWNlKGFyZ3VtZW50cywgMSkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2VsZi5yZXNvbHZlKHZhbHVlKTtcbiAgICAgICAgfVxuICAgIH07XG59O1xuXG4vKipcbiAqIEBwYXJhbSByZXNvbHZlciB7RnVuY3Rpb259IGEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIG5vdGhpbmcgYW5kIGFjY2VwdHNcbiAqIHRoZSByZXNvbHZlLCByZWplY3QsIGFuZCBub3RpZnkgZnVuY3Rpb25zIGZvciBhIGRlZmVycmVkLlxuICogQHJldHVybnMgYSBwcm9taXNlIHRoYXQgbWF5IGJlIHJlc29sdmVkIHdpdGggdGhlIGdpdmVuIHJlc29sdmUgYW5kIHJlamVjdFxuICogZnVuY3Rpb25zLCBvciByZWplY3RlZCBieSBhIHRocm93biBleGNlcHRpb24gaW4gcmVzb2x2ZXJcbiAqL1xuUS5Qcm9taXNlID0gcHJvbWlzZTsgLy8gRVM2XG5RLnByb21pc2UgPSBwcm9taXNlO1xuZnVuY3Rpb24gcHJvbWlzZShyZXNvbHZlcikge1xuICAgIGlmICh0eXBlb2YgcmVzb2x2ZXIgIT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwicmVzb2x2ZXIgbXVzdCBiZSBhIGZ1bmN0aW9uLlwiKTtcbiAgICB9XG4gICAgdmFyIGRlZmVycmVkID0gZGVmZXIoKTtcbiAgICB0cnkge1xuICAgICAgICByZXNvbHZlcihkZWZlcnJlZC5yZXNvbHZlLCBkZWZlcnJlZC5yZWplY3QsIGRlZmVycmVkLm5vdGlmeSk7XG4gICAgfSBjYXRjaCAocmVhc29uKSB7XG4gICAgICAgIGRlZmVycmVkLnJlamVjdChyZWFzb24pO1xuICAgIH1cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn1cblxucHJvbWlzZS5yYWNlID0gcmFjZTsgLy8gRVM2XG5wcm9taXNlLmFsbCA9IGFsbDsgLy8gRVM2XG5wcm9taXNlLnJlamVjdCA9IHJlamVjdDsgLy8gRVM2XG5wcm9taXNlLnJlc29sdmUgPSBROyAvLyBFUzZcblxuLy8gWFhYIGV4cGVyaW1lbnRhbC4gIFRoaXMgbWV0aG9kIGlzIGEgd2F5IHRvIGRlbm90ZSB0aGF0IGEgbG9jYWwgdmFsdWUgaXNcbi8vIHNlcmlhbGl6YWJsZSBhbmQgc2hvdWxkIGJlIGltbWVkaWF0ZWx5IGRpc3BhdGNoZWQgdG8gYSByZW1vdGUgdXBvbiByZXF1ZXN0LFxuLy8gaW5zdGVhZCBvZiBwYXNzaW5nIGEgcmVmZXJlbmNlLlxuUS5wYXNzQnlDb3B5ID0gZnVuY3Rpb24gKG9iamVjdCkge1xuICAgIC8vZnJlZXplKG9iamVjdCk7XG4gICAgLy9wYXNzQnlDb3BpZXMuc2V0KG9iamVjdCwgdHJ1ZSk7XG4gICAgcmV0dXJuIG9iamVjdDtcbn07XG5cblByb21pc2UucHJvdG90eXBlLnBhc3NCeUNvcHkgPSBmdW5jdGlvbiAoKSB7XG4gICAgLy9mcmVlemUob2JqZWN0KTtcbiAgICAvL3Bhc3NCeUNvcGllcy5zZXQob2JqZWN0LCB0cnVlKTtcbiAgICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogSWYgdHdvIHByb21pc2VzIGV2ZW50dWFsbHkgZnVsZmlsbCB0byB0aGUgc2FtZSB2YWx1ZSwgcHJvbWlzZXMgdGhhdCB2YWx1ZSxcbiAqIGJ1dCBvdGhlcndpc2UgcmVqZWN0cy5cbiAqIEBwYXJhbSB4IHtBbnkqfVxuICogQHBhcmFtIHkge0FueSp9XG4gKiBAcmV0dXJucyB7QW55Kn0gYSBwcm9taXNlIGZvciB4IGFuZCB5IGlmIHRoZXkgYXJlIHRoZSBzYW1lLCBidXQgYSByZWplY3Rpb25cbiAqIG90aGVyd2lzZS5cbiAqXG4gKi9cblEuam9pbiA9IGZ1bmN0aW9uICh4LCB5KSB7XG4gICAgcmV0dXJuIFEoeCkuam9pbih5KTtcbn07XG5cblByb21pc2UucHJvdG90eXBlLmpvaW4gPSBmdW5jdGlvbiAodGhhdCkge1xuICAgIHJldHVybiBRKFt0aGlzLCB0aGF0XSkuc3ByZWFkKGZ1bmN0aW9uICh4LCB5KSB7XG4gICAgICAgIGlmICh4ID09PSB5KSB7XG4gICAgICAgICAgICAvLyBUT0RPOiBcIj09PVwiIHNob3VsZCBiZSBPYmplY3QuaXMgb3IgZXF1aXZcbiAgICAgICAgICAgIHJldHVybiB4O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FuJ3Qgam9pbjogbm90IHRoZSBzYW1lOiBcIiArIHggKyBcIiBcIiArIHkpO1xuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG4vKipcbiAqIFJldHVybnMgYSBwcm9taXNlIGZvciB0aGUgZmlyc3Qgb2YgYW4gYXJyYXkgb2YgcHJvbWlzZXMgdG8gYmVjb21lIGZ1bGZpbGxlZC5cbiAqIEBwYXJhbSBhbnN3ZXJzIHtBcnJheVtBbnkqXX0gcHJvbWlzZXMgdG8gcmFjZVxuICogQHJldHVybnMge0FueSp9IHRoZSBmaXJzdCBwcm9taXNlIHRvIGJlIGZ1bGZpbGxlZFxuICovXG5RLnJhY2UgPSByYWNlO1xuZnVuY3Rpb24gcmFjZShhbnN3ZXJQcykge1xuICAgIHJldHVybiBwcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAvLyBTd2l0Y2ggdG8gdGhpcyBvbmNlIHdlIGNhbiBhc3N1bWUgYXQgbGVhc3QgRVM1XG4gICAgICAgIC8vIGFuc3dlclBzLmZvckVhY2goZnVuY3Rpb24oYW5zd2VyUCkge1xuICAgICAgICAvLyAgICAgUShhbnN3ZXJQKS50aGVuKHJlc29sdmUsIHJlamVjdCk7XG4gICAgICAgIC8vIH0pO1xuICAgICAgICAvLyBVc2UgdGhpcyBpbiB0aGUgbWVhbnRpbWVcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGFuc3dlclBzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBRKGFuc3dlclBzW2ldKS50aGVuKHJlc29sdmUsIHJlamVjdCk7XG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxuUHJvbWlzZS5wcm90b3R5cGUucmFjZSA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy50aGVuKFEucmFjZSk7XG59O1xuXG4vKipcbiAqIENvbnN0cnVjdHMgYSBQcm9taXNlIHdpdGggYSBwcm9taXNlIGRlc2NyaXB0b3Igb2JqZWN0IGFuZCBvcHRpb25hbCBmYWxsYmFja1xuICogZnVuY3Rpb24uICBUaGUgZGVzY3JpcHRvciBjb250YWlucyBtZXRob2RzIGxpa2Ugd2hlbihyZWplY3RlZCksIGdldChuYW1lKSxcbiAqIHNldChuYW1lLCB2YWx1ZSksIHBvc3QobmFtZSwgYXJncyksIGFuZCBkZWxldGUobmFtZSksIHdoaWNoIGFsbFxuICogcmV0dXJuIGVpdGhlciBhIHZhbHVlLCBhIHByb21pc2UgZm9yIGEgdmFsdWUsIG9yIGEgcmVqZWN0aW9uLiAgVGhlIGZhbGxiYWNrXG4gKiBhY2NlcHRzIHRoZSBvcGVyYXRpb24gbmFtZSwgYSByZXNvbHZlciwgYW5kIGFueSBmdXJ0aGVyIGFyZ3VtZW50cyB0aGF0IHdvdWxkXG4gKiBoYXZlIGJlZW4gZm9yd2FyZGVkIHRvIHRoZSBhcHByb3ByaWF0ZSBtZXRob2QgYWJvdmUgaGFkIGEgbWV0aG9kIGJlZW5cbiAqIHByb3ZpZGVkIHdpdGggdGhlIHByb3BlciBuYW1lLiAgVGhlIEFQSSBtYWtlcyBubyBndWFyYW50ZWVzIGFib3V0IHRoZSBuYXR1cmVcbiAqIG9mIHRoZSByZXR1cm5lZCBvYmplY3QsIGFwYXJ0IGZyb20gdGhhdCBpdCBpcyB1c2FibGUgd2hlcmVldmVyIHByb21pc2VzIGFyZVxuICogYm91Z2h0IGFuZCBzb2xkLlxuICovXG5RLm1ha2VQcm9taXNlID0gUHJvbWlzZTtcbmZ1bmN0aW9uIFByb21pc2UoZGVzY3JpcHRvciwgZmFsbGJhY2ssIGluc3BlY3QpIHtcbiAgICBpZiAoZmFsbGJhY2sgPT09IHZvaWQgMCkge1xuICAgICAgICBmYWxsYmFjayA9IGZ1bmN0aW9uIChvcCkge1xuICAgICAgICAgICAgcmV0dXJuIHJlamVjdChuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgXCJQcm9taXNlIGRvZXMgbm90IHN1cHBvcnQgb3BlcmF0aW9uOiBcIiArIG9wXG4gICAgICAgICAgICApKTtcbiAgICAgICAgfTtcbiAgICB9XG4gICAgaWYgKGluc3BlY3QgPT09IHZvaWQgMCkge1xuICAgICAgICBpbnNwZWN0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHtzdGF0ZTogXCJ1bmtub3duXCJ9O1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHZhciBwcm9taXNlID0gb2JqZWN0X2NyZWF0ZShQcm9taXNlLnByb3RvdHlwZSk7XG5cbiAgICBwcm9taXNlLnByb21pc2VEaXNwYXRjaCA9IGZ1bmN0aW9uIChyZXNvbHZlLCBvcCwgYXJncykge1xuICAgICAgICB2YXIgcmVzdWx0O1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaWYgKGRlc2NyaXB0b3Jbb3BdKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gZGVzY3JpcHRvcltvcF0uYXBwbHkocHJvbWlzZSwgYXJncyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlc3VsdCA9IGZhbGxiYWNrLmNhbGwocHJvbWlzZSwgb3AsIGFyZ3MpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChleGNlcHRpb24pIHtcbiAgICAgICAgICAgIHJlc3VsdCA9IHJlamVjdChleGNlcHRpb24pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChyZXNvbHZlKSB7XG4gICAgICAgICAgICByZXNvbHZlKHJlc3VsdCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgcHJvbWlzZS5pbnNwZWN0ID0gaW5zcGVjdDtcblxuICAgIC8vIFhYWCBkZXByZWNhdGVkIGB2YWx1ZU9mYCBhbmQgYGV4Y2VwdGlvbmAgc3VwcG9ydFxuICAgIGlmIChpbnNwZWN0KSB7XG4gICAgICAgIHZhciBpbnNwZWN0ZWQgPSBpbnNwZWN0KCk7XG4gICAgICAgIGlmIChpbnNwZWN0ZWQuc3RhdGUgPT09IFwicmVqZWN0ZWRcIikge1xuICAgICAgICAgICAgcHJvbWlzZS5leGNlcHRpb24gPSBpbnNwZWN0ZWQucmVhc29uO1xuICAgICAgICB9XG5cbiAgICAgICAgcHJvbWlzZS52YWx1ZU9mID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGluc3BlY3RlZCA9IGluc3BlY3QoKTtcbiAgICAgICAgICAgIGlmIChpbnNwZWN0ZWQuc3RhdGUgPT09IFwicGVuZGluZ1wiIHx8XG4gICAgICAgICAgICAgICAgaW5zcGVjdGVkLnN0YXRlID09PSBcInJlamVjdGVkXCIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBpbnNwZWN0ZWQudmFsdWU7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIHByb21pc2U7XG59XG5cblByb21pc2UucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBcIltvYmplY3QgUHJvbWlzZV1cIjtcbn07XG5cblByb21pc2UucHJvdG90eXBlLnRoZW4gPSBmdW5jdGlvbiAoZnVsZmlsbGVkLCByZWplY3RlZCwgcHJvZ3Jlc3NlZCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgZGVmZXJyZWQgPSBkZWZlcigpO1xuICAgIHZhciBkb25lID0gZmFsc2U7ICAgLy8gZW5zdXJlIHRoZSB1bnRydXN0ZWQgcHJvbWlzZSBtYWtlcyBhdCBtb3N0IGFcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNpbmdsZSBjYWxsIHRvIG9uZSBvZiB0aGUgY2FsbGJhY2tzXG5cbiAgICBmdW5jdGlvbiBfZnVsZmlsbGVkKHZhbHVlKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXR1cm4gdHlwZW9mIGZ1bGZpbGxlZCA9PT0gXCJmdW5jdGlvblwiID8gZnVsZmlsbGVkKHZhbHVlKSA6IHZhbHVlO1xuICAgICAgICB9IGNhdGNoIChleGNlcHRpb24pIHtcbiAgICAgICAgICAgIHJldHVybiByZWplY3QoZXhjZXB0aW9uKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9yZWplY3RlZChleGNlcHRpb24pIHtcbiAgICAgICAgaWYgKHR5cGVvZiByZWplY3RlZCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICBtYWtlU3RhY2tUcmFjZUxvbmcoZXhjZXB0aW9uLCBzZWxmKTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlamVjdGVkKGV4Y2VwdGlvbik7XG4gICAgICAgICAgICB9IGNhdGNoIChuZXdFeGNlcHRpb24pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVqZWN0KG5ld0V4Y2VwdGlvbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlamVjdChleGNlcHRpb24pO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9wcm9ncmVzc2VkKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB0eXBlb2YgcHJvZ3Jlc3NlZCA9PT0gXCJmdW5jdGlvblwiID8gcHJvZ3Jlc3NlZCh2YWx1ZSkgOiB2YWx1ZTtcbiAgICB9XG5cbiAgICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICAgIHNlbGYucHJvbWlzZURpc3BhdGNoKGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgaWYgKGRvbmUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkb25lID0gdHJ1ZTtcblxuICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZShfZnVsZmlsbGVkKHZhbHVlKSk7XG4gICAgICAgIH0sIFwid2hlblwiLCBbZnVuY3Rpb24gKGV4Y2VwdGlvbikge1xuICAgICAgICAgICAgaWYgKGRvbmUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkb25lID0gdHJ1ZTtcblxuICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZShfcmVqZWN0ZWQoZXhjZXB0aW9uKSk7XG4gICAgICAgIH1dKTtcbiAgICB9KTtcblxuICAgIC8vIFByb2dyZXNzIHByb3BhZ2F0b3IgbmVlZCB0byBiZSBhdHRhY2hlZCBpbiB0aGUgY3VycmVudCB0aWNrLlxuICAgIHNlbGYucHJvbWlzZURpc3BhdGNoKHZvaWQgMCwgXCJ3aGVuXCIsIFt2b2lkIDAsIGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICB2YXIgbmV3VmFsdWU7XG4gICAgICAgIHZhciB0aHJldyA9IGZhbHNlO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbmV3VmFsdWUgPSBfcHJvZ3Jlc3NlZCh2YWx1ZSk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHRocmV3ID0gdHJ1ZTtcbiAgICAgICAgICAgIGlmIChRLm9uZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBRLm9uZXJyb3IoZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IGU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRocmV3KSB7XG4gICAgICAgICAgICBkZWZlcnJlZC5ub3RpZnkobmV3VmFsdWUpO1xuICAgICAgICB9XG4gICAgfV0pO1xuXG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59O1xuXG4vKipcbiAqIFJlZ2lzdGVycyBhbiBvYnNlcnZlciBvbiBhIHByb21pc2UuXG4gKlxuICogR3VhcmFudGVlczpcbiAqXG4gKiAxLiB0aGF0IGZ1bGZpbGxlZCBhbmQgcmVqZWN0ZWQgd2lsbCBiZSBjYWxsZWQgb25seSBvbmNlLlxuICogMi4gdGhhdCBlaXRoZXIgdGhlIGZ1bGZpbGxlZCBjYWxsYmFjayBvciB0aGUgcmVqZWN0ZWQgY2FsbGJhY2sgd2lsbCBiZVxuICogICAgY2FsbGVkLCBidXQgbm90IGJvdGguXG4gKiAzLiB0aGF0IGZ1bGZpbGxlZCBhbmQgcmVqZWN0ZWQgd2lsbCBub3QgYmUgY2FsbGVkIGluIHRoaXMgdHVybi5cbiAqXG4gKiBAcGFyYW0gdmFsdWUgICAgICBwcm9taXNlIG9yIGltbWVkaWF0ZSByZWZlcmVuY2UgdG8gb2JzZXJ2ZVxuICogQHBhcmFtIGZ1bGZpbGxlZCAgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIHdpdGggdGhlIGZ1bGZpbGxlZCB2YWx1ZVxuICogQHBhcmFtIHJlamVjdGVkICAgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIHdpdGggdGhlIHJlamVjdGlvbiBleGNlcHRpb25cbiAqIEBwYXJhbSBwcm9ncmVzc2VkIGZ1bmN0aW9uIHRvIGJlIGNhbGxlZCBvbiBhbnkgcHJvZ3Jlc3Mgbm90aWZpY2F0aW9uc1xuICogQHJldHVybiBwcm9taXNlIGZvciB0aGUgcmV0dXJuIHZhbHVlIGZyb20gdGhlIGludm9rZWQgY2FsbGJhY2tcbiAqL1xuUS53aGVuID0gd2hlbjtcbmZ1bmN0aW9uIHdoZW4odmFsdWUsIGZ1bGZpbGxlZCwgcmVqZWN0ZWQsIHByb2dyZXNzZWQpIHtcbiAgICByZXR1cm4gUSh2YWx1ZSkudGhlbihmdWxmaWxsZWQsIHJlamVjdGVkLCBwcm9ncmVzc2VkKTtcbn1cblxuUHJvbWlzZS5wcm90b3R5cGUudGhlblJlc29sdmUgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICByZXR1cm4gdGhpcy50aGVuKGZ1bmN0aW9uICgpIHsgcmV0dXJuIHZhbHVlOyB9KTtcbn07XG5cblEudGhlblJlc29sdmUgPSBmdW5jdGlvbiAocHJvbWlzZSwgdmFsdWUpIHtcbiAgICByZXR1cm4gUShwcm9taXNlKS50aGVuUmVzb2x2ZSh2YWx1ZSk7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS50aGVuUmVqZWN0ID0gZnVuY3Rpb24gKHJlYXNvbikge1xuICAgIHJldHVybiB0aGlzLnRoZW4oZnVuY3Rpb24gKCkgeyB0aHJvdyByZWFzb247IH0pO1xufTtcblxuUS50aGVuUmVqZWN0ID0gZnVuY3Rpb24gKHByb21pc2UsIHJlYXNvbikge1xuICAgIHJldHVybiBRKHByb21pc2UpLnRoZW5SZWplY3QocmVhc29uKTtcbn07XG5cbi8qKlxuICogSWYgYW4gb2JqZWN0IGlzIG5vdCBhIHByb21pc2UsIGl0IGlzIGFzIFwibmVhclwiIGFzIHBvc3NpYmxlLlxuICogSWYgYSBwcm9taXNlIGlzIHJlamVjdGVkLCBpdCBpcyBhcyBcIm5lYXJcIiBhcyBwb3NzaWJsZSB0b28uXG4gKiBJZiBpdOKAmXMgYSBmdWxmaWxsZWQgcHJvbWlzZSwgdGhlIGZ1bGZpbGxtZW50IHZhbHVlIGlzIG5lYXJlci5cbiAqIElmIGl04oCZcyBhIGRlZmVycmVkIHByb21pc2UgYW5kIHRoZSBkZWZlcnJlZCBoYXMgYmVlbiByZXNvbHZlZCwgdGhlXG4gKiByZXNvbHV0aW9uIGlzIFwibmVhcmVyXCIuXG4gKiBAcGFyYW0gb2JqZWN0XG4gKiBAcmV0dXJucyBtb3N0IHJlc29sdmVkIChuZWFyZXN0KSBmb3JtIG9mIHRoZSBvYmplY3RcbiAqL1xuXG4vLyBYWFggc2hvdWxkIHdlIHJlLWRvIHRoaXM/XG5RLm5lYXJlciA9IG5lYXJlcjtcbmZ1bmN0aW9uIG5lYXJlcih2YWx1ZSkge1xuICAgIGlmIChpc1Byb21pc2UodmFsdWUpKSB7XG4gICAgICAgIHZhciBpbnNwZWN0ZWQgPSB2YWx1ZS5pbnNwZWN0KCk7XG4gICAgICAgIGlmIChpbnNwZWN0ZWQuc3RhdGUgPT09IFwiZnVsZmlsbGVkXCIpIHtcbiAgICAgICAgICAgIHJldHVybiBpbnNwZWN0ZWQudmFsdWU7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlO1xufVxuXG4vKipcbiAqIEByZXR1cm5zIHdoZXRoZXIgdGhlIGdpdmVuIG9iamVjdCBpcyBhIHByb21pc2UuXG4gKiBPdGhlcndpc2UgaXQgaXMgYSBmdWxmaWxsZWQgdmFsdWUuXG4gKi9cblEuaXNQcm9taXNlID0gaXNQcm9taXNlO1xuZnVuY3Rpb24gaXNQcm9taXNlKG9iamVjdCkge1xuICAgIHJldHVybiBpc09iamVjdChvYmplY3QpICYmXG4gICAgICAgIHR5cGVvZiBvYmplY3QucHJvbWlzZURpc3BhdGNoID09PSBcImZ1bmN0aW9uXCIgJiZcbiAgICAgICAgdHlwZW9mIG9iamVjdC5pbnNwZWN0ID09PSBcImZ1bmN0aW9uXCI7XG59XG5cblEuaXNQcm9taXNlQWxpa2UgPSBpc1Byb21pc2VBbGlrZTtcbmZ1bmN0aW9uIGlzUHJvbWlzZUFsaWtlKG9iamVjdCkge1xuICAgIHJldHVybiBpc09iamVjdChvYmplY3QpICYmIHR5cGVvZiBvYmplY3QudGhlbiA9PT0gXCJmdW5jdGlvblwiO1xufVxuXG4vKipcbiAqIEByZXR1cm5zIHdoZXRoZXIgdGhlIGdpdmVuIG9iamVjdCBpcyBhIHBlbmRpbmcgcHJvbWlzZSwgbWVhbmluZyBub3RcbiAqIGZ1bGZpbGxlZCBvciByZWplY3RlZC5cbiAqL1xuUS5pc1BlbmRpbmcgPSBpc1BlbmRpbmc7XG5mdW5jdGlvbiBpc1BlbmRpbmcob2JqZWN0KSB7XG4gICAgcmV0dXJuIGlzUHJvbWlzZShvYmplY3QpICYmIG9iamVjdC5pbnNwZWN0KCkuc3RhdGUgPT09IFwicGVuZGluZ1wiO1xufVxuXG5Qcm9taXNlLnByb3RvdHlwZS5pc1BlbmRpbmcgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuaW5zcGVjdCgpLnN0YXRlID09PSBcInBlbmRpbmdcIjtcbn07XG5cbi8qKlxuICogQHJldHVybnMgd2hldGhlciB0aGUgZ2l2ZW4gb2JqZWN0IGlzIGEgdmFsdWUgb3IgZnVsZmlsbGVkXG4gKiBwcm9taXNlLlxuICovXG5RLmlzRnVsZmlsbGVkID0gaXNGdWxmaWxsZWQ7XG5mdW5jdGlvbiBpc0Z1bGZpbGxlZChvYmplY3QpIHtcbiAgICByZXR1cm4gIWlzUHJvbWlzZShvYmplY3QpIHx8IG9iamVjdC5pbnNwZWN0KCkuc3RhdGUgPT09IFwiZnVsZmlsbGVkXCI7XG59XG5cblByb21pc2UucHJvdG90eXBlLmlzRnVsZmlsbGVkID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmluc3BlY3QoKS5zdGF0ZSA9PT0gXCJmdWxmaWxsZWRcIjtcbn07XG5cbi8qKlxuICogQHJldHVybnMgd2hldGhlciB0aGUgZ2l2ZW4gb2JqZWN0IGlzIGEgcmVqZWN0ZWQgcHJvbWlzZS5cbiAqL1xuUS5pc1JlamVjdGVkID0gaXNSZWplY3RlZDtcbmZ1bmN0aW9uIGlzUmVqZWN0ZWQob2JqZWN0KSB7XG4gICAgcmV0dXJuIGlzUHJvbWlzZShvYmplY3QpICYmIG9iamVjdC5pbnNwZWN0KCkuc3RhdGUgPT09IFwicmVqZWN0ZWRcIjtcbn1cblxuUHJvbWlzZS5wcm90b3R5cGUuaXNSZWplY3RlZCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5pbnNwZWN0KCkuc3RhdGUgPT09IFwicmVqZWN0ZWRcIjtcbn07XG5cbi8vLy8gQkVHSU4gVU5IQU5ETEVEIFJFSkVDVElPTiBUUkFDS0lOR1xuXG4vLyBUaGlzIHByb21pc2UgbGlicmFyeSBjb25zdW1lcyBleGNlcHRpb25zIHRocm93biBpbiBoYW5kbGVycyBzbyB0aGV5IGNhbiBiZVxuLy8gaGFuZGxlZCBieSBhIHN1YnNlcXVlbnQgcHJvbWlzZS4gIFRoZSBleGNlcHRpb25zIGdldCBhZGRlZCB0byB0aGlzIGFycmF5IHdoZW5cbi8vIHRoZXkgYXJlIGNyZWF0ZWQsIGFuZCByZW1vdmVkIHdoZW4gdGhleSBhcmUgaGFuZGxlZC4gIE5vdGUgdGhhdCBpbiBFUzYgb3Jcbi8vIHNoaW1tZWQgZW52aXJvbm1lbnRzLCB0aGlzIHdvdWxkIG5hdHVyYWxseSBiZSBhIGBTZXRgLlxudmFyIHVuaGFuZGxlZFJlYXNvbnMgPSBbXTtcbnZhciB1bmhhbmRsZWRSZWplY3Rpb25zID0gW107XG52YXIgdHJhY2tVbmhhbmRsZWRSZWplY3Rpb25zID0gdHJ1ZTtcblxuZnVuY3Rpb24gcmVzZXRVbmhhbmRsZWRSZWplY3Rpb25zKCkge1xuICAgIHVuaGFuZGxlZFJlYXNvbnMubGVuZ3RoID0gMDtcbiAgICB1bmhhbmRsZWRSZWplY3Rpb25zLmxlbmd0aCA9IDA7XG5cbiAgICBpZiAoIXRyYWNrVW5oYW5kbGVkUmVqZWN0aW9ucykge1xuICAgICAgICB0cmFja1VuaGFuZGxlZFJlamVjdGlvbnMgPSB0cnVlO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gdHJhY2tSZWplY3Rpb24ocHJvbWlzZSwgcmVhc29uKSB7XG4gICAgaWYgKCF0cmFja1VuaGFuZGxlZFJlamVjdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHVuaGFuZGxlZFJlamVjdGlvbnMucHVzaChwcm9taXNlKTtcbiAgICBpZiAocmVhc29uICYmIHR5cGVvZiByZWFzb24uc3RhY2sgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgdW5oYW5kbGVkUmVhc29ucy5wdXNoKHJlYXNvbi5zdGFjayk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdW5oYW5kbGVkUmVhc29ucy5wdXNoKFwiKG5vIHN0YWNrKSBcIiArIHJlYXNvbik7XG4gICAgfVxufVxuXG5mdW5jdGlvbiB1bnRyYWNrUmVqZWN0aW9uKHByb21pc2UpIHtcbiAgICBpZiAoIXRyYWNrVW5oYW5kbGVkUmVqZWN0aW9ucykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGF0ID0gYXJyYXlfaW5kZXhPZih1bmhhbmRsZWRSZWplY3Rpb25zLCBwcm9taXNlKTtcbiAgICBpZiAoYXQgIT09IC0xKSB7XG4gICAgICAgIHVuaGFuZGxlZFJlamVjdGlvbnMuc3BsaWNlKGF0LCAxKTtcbiAgICAgICAgdW5oYW5kbGVkUmVhc29ucy5zcGxpY2UoYXQsIDEpO1xuICAgIH1cbn1cblxuUS5yZXNldFVuaGFuZGxlZFJlamVjdGlvbnMgPSByZXNldFVuaGFuZGxlZFJlamVjdGlvbnM7XG5cblEuZ2V0VW5oYW5kbGVkUmVhc29ucyA9IGZ1bmN0aW9uICgpIHtcbiAgICAvLyBNYWtlIGEgY29weSBzbyB0aGF0IGNvbnN1bWVycyBjYW4ndCBpbnRlcmZlcmUgd2l0aCBvdXIgaW50ZXJuYWwgc3RhdGUuXG4gICAgcmV0dXJuIHVuaGFuZGxlZFJlYXNvbnMuc2xpY2UoKTtcbn07XG5cblEuc3RvcFVuaGFuZGxlZFJlamVjdGlvblRyYWNraW5nID0gZnVuY3Rpb24gKCkge1xuICAgIHJlc2V0VW5oYW5kbGVkUmVqZWN0aW9ucygpO1xuICAgIHRyYWNrVW5oYW5kbGVkUmVqZWN0aW9ucyA9IGZhbHNlO1xufTtcblxucmVzZXRVbmhhbmRsZWRSZWplY3Rpb25zKCk7XG5cbi8vLy8gRU5EIFVOSEFORExFRCBSRUpFQ1RJT04gVFJBQ0tJTkdcblxuLyoqXG4gKiBDb25zdHJ1Y3RzIGEgcmVqZWN0ZWQgcHJvbWlzZS5cbiAqIEBwYXJhbSByZWFzb24gdmFsdWUgZGVzY3JpYmluZyB0aGUgZmFpbHVyZVxuICovXG5RLnJlamVjdCA9IHJlamVjdDtcbmZ1bmN0aW9uIHJlamVjdChyZWFzb24pIHtcbiAgICB2YXIgcmVqZWN0aW9uID0gUHJvbWlzZSh7XG4gICAgICAgIFwid2hlblwiOiBmdW5jdGlvbiAocmVqZWN0ZWQpIHtcbiAgICAgICAgICAgIC8vIG5vdGUgdGhhdCB0aGUgZXJyb3IgaGFzIGJlZW4gaGFuZGxlZFxuICAgICAgICAgICAgaWYgKHJlamVjdGVkKSB7XG4gICAgICAgICAgICAgICAgdW50cmFja1JlamVjdGlvbih0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZWplY3RlZCA/IHJlamVjdGVkKHJlYXNvbikgOiB0aGlzO1xuICAgICAgICB9XG4gICAgfSwgZnVuY3Rpb24gZmFsbGJhY2soKSB7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sIGZ1bmN0aW9uIGluc3BlY3QoKSB7XG4gICAgICAgIHJldHVybiB7IHN0YXRlOiBcInJlamVjdGVkXCIsIHJlYXNvbjogcmVhc29uIH07XG4gICAgfSk7XG5cbiAgICAvLyBOb3RlIHRoYXQgdGhlIHJlYXNvbiBoYXMgbm90IGJlZW4gaGFuZGxlZC5cbiAgICB0cmFja1JlamVjdGlvbihyZWplY3Rpb24sIHJlYXNvbik7XG5cbiAgICByZXR1cm4gcmVqZWN0aW9uO1xufVxuXG4vKipcbiAqIENvbnN0cnVjdHMgYSBmdWxmaWxsZWQgcHJvbWlzZSBmb3IgYW4gaW1tZWRpYXRlIHJlZmVyZW5jZS5cbiAqIEBwYXJhbSB2YWx1ZSBpbW1lZGlhdGUgcmVmZXJlbmNlXG4gKi9cblEuZnVsZmlsbCA9IGZ1bGZpbGw7XG5mdW5jdGlvbiBmdWxmaWxsKHZhbHVlKSB7XG4gICAgcmV0dXJuIFByb21pc2Uoe1xuICAgICAgICBcIndoZW5cIjogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgICB9LFxuICAgICAgICBcImdldFwiOiBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgICAgICAgcmV0dXJuIHZhbHVlW25hbWVdO1xuICAgICAgICB9LFxuICAgICAgICBcInNldFwiOiBmdW5jdGlvbiAobmFtZSwgcmhzKSB7XG4gICAgICAgICAgICB2YWx1ZVtuYW1lXSA9IHJocztcbiAgICAgICAgfSxcbiAgICAgICAgXCJkZWxldGVcIjogZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgICAgICAgIGRlbGV0ZSB2YWx1ZVtuYW1lXTtcbiAgICAgICAgfSxcbiAgICAgICAgXCJwb3N0XCI6IGZ1bmN0aW9uIChuYW1lLCBhcmdzKSB7XG4gICAgICAgICAgICAvLyBNYXJrIE1pbGxlciBwcm9wb3NlcyB0aGF0IHBvc3Qgd2l0aCBubyBuYW1lIHNob3VsZCBhcHBseSBhXG4gICAgICAgICAgICAvLyBwcm9taXNlZCBmdW5jdGlvbi5cbiAgICAgICAgICAgIGlmIChuYW1lID09PSBudWxsIHx8IG5hbWUgPT09IHZvaWQgMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZS5hcHBseSh2b2lkIDAsIGFyZ3MpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWVbbmFtZV0uYXBwbHkodmFsdWUsIGFyZ3MpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBcImFwcGx5XCI6IGZ1bmN0aW9uICh0aGlzcCwgYXJncykge1xuICAgICAgICAgICAgcmV0dXJuIHZhbHVlLmFwcGx5KHRoaXNwLCBhcmdzKTtcbiAgICAgICAgfSxcbiAgICAgICAgXCJrZXlzXCI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBvYmplY3Rfa2V5cyh2YWx1ZSk7XG4gICAgICAgIH1cbiAgICB9LCB2b2lkIDAsIGZ1bmN0aW9uIGluc3BlY3QoKSB7XG4gICAgICAgIHJldHVybiB7IHN0YXRlOiBcImZ1bGZpbGxlZFwiLCB2YWx1ZTogdmFsdWUgfTtcbiAgICB9KTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0cyB0aGVuYWJsZXMgdG8gUSBwcm9taXNlcy5cbiAqIEBwYXJhbSBwcm9taXNlIHRoZW5hYmxlIHByb21pc2VcbiAqIEByZXR1cm5zIGEgUSBwcm9taXNlXG4gKi9cbmZ1bmN0aW9uIGNvZXJjZShwcm9taXNlKSB7XG4gICAgdmFyIGRlZmVycmVkID0gZGVmZXIoKTtcbiAgICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBwcm9taXNlLnRoZW4oZGVmZXJyZWQucmVzb2x2ZSwgZGVmZXJyZWQucmVqZWN0LCBkZWZlcnJlZC5ub3RpZnkpO1xuICAgICAgICB9IGNhdGNoIChleGNlcHRpb24pIHtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChleGNlcHRpb24pO1xuICAgICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59XG5cbi8qKlxuICogQW5ub3RhdGVzIGFuIG9iamVjdCBzdWNoIHRoYXQgaXQgd2lsbCBuZXZlciBiZVxuICogdHJhbnNmZXJyZWQgYXdheSBmcm9tIHRoaXMgcHJvY2VzcyBvdmVyIGFueSBwcm9taXNlXG4gKiBjb21tdW5pY2F0aW9uIGNoYW5uZWwuXG4gKiBAcGFyYW0gb2JqZWN0XG4gKiBAcmV0dXJucyBwcm9taXNlIGEgd3JhcHBpbmcgb2YgdGhhdCBvYmplY3QgdGhhdFxuICogYWRkaXRpb25hbGx5IHJlc3BvbmRzIHRvIHRoZSBcImlzRGVmXCIgbWVzc2FnZVxuICogd2l0aG91dCBhIHJlamVjdGlvbi5cbiAqL1xuUS5tYXN0ZXIgPSBtYXN0ZXI7XG5mdW5jdGlvbiBtYXN0ZXIob2JqZWN0KSB7XG4gICAgcmV0dXJuIFByb21pc2Uoe1xuICAgICAgICBcImlzRGVmXCI6IGZ1bmN0aW9uICgpIHt9XG4gICAgfSwgZnVuY3Rpb24gZmFsbGJhY2sob3AsIGFyZ3MpIHtcbiAgICAgICAgcmV0dXJuIGRpc3BhdGNoKG9iamVjdCwgb3AsIGFyZ3MpO1xuICAgIH0sIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIFEob2JqZWN0KS5pbnNwZWN0KCk7XG4gICAgfSk7XG59XG5cbi8qKlxuICogU3ByZWFkcyB0aGUgdmFsdWVzIG9mIGEgcHJvbWlzZWQgYXJyYXkgb2YgYXJndW1lbnRzIGludG8gdGhlXG4gKiBmdWxmaWxsbWVudCBjYWxsYmFjay5cbiAqIEBwYXJhbSBmdWxmaWxsZWQgY2FsbGJhY2sgdGhhdCByZWNlaXZlcyB2YXJpYWRpYyBhcmd1bWVudHMgZnJvbSB0aGVcbiAqIHByb21pc2VkIGFycmF5XG4gKiBAcGFyYW0gcmVqZWN0ZWQgY2FsbGJhY2sgdGhhdCByZWNlaXZlcyB0aGUgZXhjZXB0aW9uIGlmIHRoZSBwcm9taXNlXG4gKiBpcyByZWplY3RlZC5cbiAqIEByZXR1cm5zIGEgcHJvbWlzZSBmb3IgdGhlIHJldHVybiB2YWx1ZSBvciB0aHJvd24gZXhjZXB0aW9uIG9mXG4gKiBlaXRoZXIgY2FsbGJhY2suXG4gKi9cblEuc3ByZWFkID0gc3ByZWFkO1xuZnVuY3Rpb24gc3ByZWFkKHZhbHVlLCBmdWxmaWxsZWQsIHJlamVjdGVkKSB7XG4gICAgcmV0dXJuIFEodmFsdWUpLnNwcmVhZChmdWxmaWxsZWQsIHJlamVjdGVkKTtcbn1cblxuUHJvbWlzZS5wcm90b3R5cGUuc3ByZWFkID0gZnVuY3Rpb24gKGZ1bGZpbGxlZCwgcmVqZWN0ZWQpIHtcbiAgICByZXR1cm4gdGhpcy5hbGwoKS50aGVuKGZ1bmN0aW9uIChhcnJheSkge1xuICAgICAgICByZXR1cm4gZnVsZmlsbGVkLmFwcGx5KHZvaWQgMCwgYXJyYXkpO1xuICAgIH0sIHJlamVjdGVkKTtcbn07XG5cbi8qKlxuICogVGhlIGFzeW5jIGZ1bmN0aW9uIGlzIGEgZGVjb3JhdG9yIGZvciBnZW5lcmF0b3IgZnVuY3Rpb25zLCB0dXJuaW5nXG4gKiB0aGVtIGludG8gYXN5bmNocm9ub3VzIGdlbmVyYXRvcnMuICBBbHRob3VnaCBnZW5lcmF0b3JzIGFyZSBvbmx5IHBhcnRcbiAqIG9mIHRoZSBuZXdlc3QgRUNNQVNjcmlwdCA2IGRyYWZ0cywgdGhpcyBjb2RlIGRvZXMgbm90IGNhdXNlIHN5bnRheFxuICogZXJyb3JzIGluIG9sZGVyIGVuZ2luZXMuICBUaGlzIGNvZGUgc2hvdWxkIGNvbnRpbnVlIHRvIHdvcmsgYW5kIHdpbGxcbiAqIGluIGZhY3QgaW1wcm92ZSBvdmVyIHRpbWUgYXMgdGhlIGxhbmd1YWdlIGltcHJvdmVzLlxuICpcbiAqIEVTNiBnZW5lcmF0b3JzIGFyZSBjdXJyZW50bHkgcGFydCBvZiBWOCB2ZXJzaW9uIDMuMTkgd2l0aCB0aGVcbiAqIC0taGFybW9ueS1nZW5lcmF0b3JzIHJ1bnRpbWUgZmxhZyBlbmFibGVkLiAgU3BpZGVyTW9ua2V5IGhhcyBoYWQgdGhlbVxuICogZm9yIGxvbmdlciwgYnV0IHVuZGVyIGFuIG9sZGVyIFB5dGhvbi1pbnNwaXJlZCBmb3JtLiAgVGhpcyBmdW5jdGlvblxuICogd29ya3Mgb24gYm90aCBraW5kcyBvZiBnZW5lcmF0b3JzLlxuICpcbiAqIERlY29yYXRlcyBhIGdlbmVyYXRvciBmdW5jdGlvbiBzdWNoIHRoYXQ6XG4gKiAgLSBpdCBtYXkgeWllbGQgcHJvbWlzZXNcbiAqICAtIGV4ZWN1dGlvbiB3aWxsIGNvbnRpbnVlIHdoZW4gdGhhdCBwcm9taXNlIGlzIGZ1bGZpbGxlZFxuICogIC0gdGhlIHZhbHVlIG9mIHRoZSB5aWVsZCBleHByZXNzaW9uIHdpbGwgYmUgdGhlIGZ1bGZpbGxlZCB2YWx1ZVxuICogIC0gaXQgcmV0dXJucyBhIHByb21pc2UgZm9yIHRoZSByZXR1cm4gdmFsdWUgKHdoZW4gdGhlIGdlbmVyYXRvclxuICogICAgc3RvcHMgaXRlcmF0aW5nKVxuICogIC0gdGhlIGRlY29yYXRlZCBmdW5jdGlvbiByZXR1cm5zIGEgcHJvbWlzZSBmb3IgdGhlIHJldHVybiB2YWx1ZVxuICogICAgb2YgdGhlIGdlbmVyYXRvciBvciB0aGUgZmlyc3QgcmVqZWN0ZWQgcHJvbWlzZSBhbW9uZyB0aG9zZVxuICogICAgeWllbGRlZC5cbiAqICAtIGlmIGFuIGVycm9yIGlzIHRocm93biBpbiB0aGUgZ2VuZXJhdG9yLCBpdCBwcm9wYWdhdGVzIHRocm91Z2hcbiAqICAgIGV2ZXJ5IGZvbGxvd2luZyB5aWVsZCB1bnRpbCBpdCBpcyBjYXVnaHQsIG9yIHVudGlsIGl0IGVzY2FwZXNcbiAqICAgIHRoZSBnZW5lcmF0b3IgZnVuY3Rpb24gYWx0b2dldGhlciwgYW5kIGlzIHRyYW5zbGF0ZWQgaW50byBhXG4gKiAgICByZWplY3Rpb24gZm9yIHRoZSBwcm9taXNlIHJldHVybmVkIGJ5IHRoZSBkZWNvcmF0ZWQgZ2VuZXJhdG9yLlxuICovXG5RLmFzeW5jID0gYXN5bmM7XG5mdW5jdGlvbiBhc3luYyhtYWtlR2VuZXJhdG9yKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy8gd2hlbiB2ZXJiIGlzIFwic2VuZFwiLCBhcmcgaXMgYSB2YWx1ZVxuICAgICAgICAvLyB3aGVuIHZlcmIgaXMgXCJ0aHJvd1wiLCBhcmcgaXMgYW4gZXhjZXB0aW9uXG4gICAgICAgIGZ1bmN0aW9uIGNvbnRpbnVlcih2ZXJiLCBhcmcpIHtcbiAgICAgICAgICAgIHZhciByZXN1bHQ7XG5cbiAgICAgICAgICAgIC8vIFVudGlsIFY4IDMuMTkgLyBDaHJvbWl1bSAyOSBpcyByZWxlYXNlZCwgU3BpZGVyTW9ua2V5IGlzIHRoZSBvbmx5XG4gICAgICAgICAgICAvLyBlbmdpbmUgdGhhdCBoYXMgYSBkZXBsb3llZCBiYXNlIG9mIGJyb3dzZXJzIHRoYXQgc3VwcG9ydCBnZW5lcmF0b3JzLlxuICAgICAgICAgICAgLy8gSG93ZXZlciwgU00ncyBnZW5lcmF0b3JzIHVzZSB0aGUgUHl0aG9uLWluc3BpcmVkIHNlbWFudGljcyBvZlxuICAgICAgICAgICAgLy8gb3V0ZGF0ZWQgRVM2IGRyYWZ0cy4gIFdlIHdvdWxkIGxpa2UgdG8gc3VwcG9ydCBFUzYsIGJ1dCB3ZSdkIGFsc29cbiAgICAgICAgICAgIC8vIGxpa2UgdG8gbWFrZSBpdCBwb3NzaWJsZSB0byB1c2UgZ2VuZXJhdG9ycyBpbiBkZXBsb3llZCBicm93c2Vycywgc29cbiAgICAgICAgICAgIC8vIHdlIGFsc28gc3VwcG9ydCBQeXRob24tc3R5bGUgZ2VuZXJhdG9ycy4gIEF0IHNvbWUgcG9pbnQgd2UgY2FuIHJlbW92ZVxuICAgICAgICAgICAgLy8gdGhpcyBibG9jay5cblxuICAgICAgICAgICAgaWYgKHR5cGVvZiBTdG9wSXRlcmF0aW9uID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgICAgICAgICAgLy8gRVM2IEdlbmVyYXRvcnNcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSBnZW5lcmF0b3JbdmVyYl0oYXJnKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChleGNlcHRpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlamVjdChleGNlcHRpb24pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0LmRvbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdC52YWx1ZTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gd2hlbihyZXN1bHQudmFsdWUsIGNhbGxiYWNrLCBlcnJiYWNrKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIFNwaWRlck1vbmtleSBHZW5lcmF0b3JzXG4gICAgICAgICAgICAgICAgLy8gRklYTUU6IFJlbW92ZSB0aGlzIGNhc2Ugd2hlbiBTTSBkb2VzIEVTNiBnZW5lcmF0b3JzLlxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IGdlbmVyYXRvclt2ZXJiXShhcmcpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGV4Y2VwdGlvbikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoaXNTdG9wSXRlcmF0aW9uKGV4Y2VwdGlvbikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBleGNlcHRpb24udmFsdWU7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVqZWN0KGV4Y2VwdGlvbik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHdoZW4ocmVzdWx0LCBjYWxsYmFjaywgZXJyYmFjayk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGdlbmVyYXRvciA9IG1ha2VHZW5lcmF0b3IuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgdmFyIGNhbGxiYWNrID0gY29udGludWVyLmJpbmQoY29udGludWVyLCBcIm5leHRcIik7XG4gICAgICAgIHZhciBlcnJiYWNrID0gY29udGludWVyLmJpbmQoY29udGludWVyLCBcInRocm93XCIpO1xuICAgICAgICByZXR1cm4gY2FsbGJhY2soKTtcbiAgICB9O1xufVxuXG4vKipcbiAqIFRoZSBzcGF3biBmdW5jdGlvbiBpcyBhIHNtYWxsIHdyYXBwZXIgYXJvdW5kIGFzeW5jIHRoYXQgaW1tZWRpYXRlbHlcbiAqIGNhbGxzIHRoZSBnZW5lcmF0b3IgYW5kIGFsc28gZW5kcyB0aGUgcHJvbWlzZSBjaGFpbiwgc28gdGhhdCBhbnlcbiAqIHVuaGFuZGxlZCBlcnJvcnMgYXJlIHRocm93biBpbnN0ZWFkIG9mIGZvcndhcmRlZCB0byB0aGUgZXJyb3JcbiAqIGhhbmRsZXIuIFRoaXMgaXMgdXNlZnVsIGJlY2F1c2UgaXQncyBleHRyZW1lbHkgY29tbW9uIHRvIHJ1blxuICogZ2VuZXJhdG9ycyBhdCB0aGUgdG9wLWxldmVsIHRvIHdvcmsgd2l0aCBsaWJyYXJpZXMuXG4gKi9cblEuc3Bhd24gPSBzcGF3bjtcbmZ1bmN0aW9uIHNwYXduKG1ha2VHZW5lcmF0b3IpIHtcbiAgICBRLmRvbmUoUS5hc3luYyhtYWtlR2VuZXJhdG9yKSgpKTtcbn1cblxuLy8gRklYTUU6IFJlbW92ZSB0aGlzIGludGVyZmFjZSBvbmNlIEVTNiBnZW5lcmF0b3JzIGFyZSBpbiBTcGlkZXJNb25rZXkuXG4vKipcbiAqIFRocm93cyBhIFJldHVyblZhbHVlIGV4Y2VwdGlvbiB0byBzdG9wIGFuIGFzeW5jaHJvbm91cyBnZW5lcmF0b3IuXG4gKlxuICogVGhpcyBpbnRlcmZhY2UgaXMgYSBzdG9wLWdhcCBtZWFzdXJlIHRvIHN1cHBvcnQgZ2VuZXJhdG9yIHJldHVyblxuICogdmFsdWVzIGluIG9sZGVyIEZpcmVmb3gvU3BpZGVyTW9ua2V5LiAgSW4gYnJvd3NlcnMgdGhhdCBzdXBwb3J0IEVTNlxuICogZ2VuZXJhdG9ycyBsaWtlIENocm9taXVtIDI5LCBqdXN0IHVzZSBcInJldHVyblwiIGluIHlvdXIgZ2VuZXJhdG9yXG4gKiBmdW5jdGlvbnMuXG4gKlxuICogQHBhcmFtIHZhbHVlIHRoZSByZXR1cm4gdmFsdWUgZm9yIHRoZSBzdXJyb3VuZGluZyBnZW5lcmF0b3JcbiAqIEB0aHJvd3MgUmV0dXJuVmFsdWUgZXhjZXB0aW9uIHdpdGggdGhlIHZhbHVlLlxuICogQGV4YW1wbGVcbiAqIC8vIEVTNiBzdHlsZVxuICogUS5hc3luYyhmdW5jdGlvbiogKCkge1xuICogICAgICB2YXIgZm9vID0geWllbGQgZ2V0Rm9vUHJvbWlzZSgpO1xuICogICAgICB2YXIgYmFyID0geWllbGQgZ2V0QmFyUHJvbWlzZSgpO1xuICogICAgICByZXR1cm4gZm9vICsgYmFyO1xuICogfSlcbiAqIC8vIE9sZGVyIFNwaWRlck1vbmtleSBzdHlsZVxuICogUS5hc3luYyhmdW5jdGlvbiAoKSB7XG4gKiAgICAgIHZhciBmb28gPSB5aWVsZCBnZXRGb29Qcm9taXNlKCk7XG4gKiAgICAgIHZhciBiYXIgPSB5aWVsZCBnZXRCYXJQcm9taXNlKCk7XG4gKiAgICAgIFEucmV0dXJuKGZvbyArIGJhcik7XG4gKiB9KVxuICovXG5RW1wicmV0dXJuXCJdID0gX3JldHVybjtcbmZ1bmN0aW9uIF9yZXR1cm4odmFsdWUpIHtcbiAgICB0aHJvdyBuZXcgUVJldHVyblZhbHVlKHZhbHVlKTtcbn1cblxuLyoqXG4gKiBUaGUgcHJvbWlzZWQgZnVuY3Rpb24gZGVjb3JhdG9yIGVuc3VyZXMgdGhhdCBhbnkgcHJvbWlzZSBhcmd1bWVudHNcbiAqIGFyZSBzZXR0bGVkIGFuZCBwYXNzZWQgYXMgdmFsdWVzIChgdGhpc2AgaXMgYWxzbyBzZXR0bGVkIGFuZCBwYXNzZWRcbiAqIGFzIGEgdmFsdWUpLiAgSXQgd2lsbCBhbHNvIGVuc3VyZSB0aGF0IHRoZSByZXN1bHQgb2YgYSBmdW5jdGlvbiBpc1xuICogYWx3YXlzIGEgcHJvbWlzZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogdmFyIGFkZCA9IFEucHJvbWlzZWQoZnVuY3Rpb24gKGEsIGIpIHtcbiAqICAgICByZXR1cm4gYSArIGI7XG4gKiB9KTtcbiAqIGFkZChRKGEpLCBRKEIpKTtcbiAqXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgZnVuY3Rpb24gdG8gZGVjb3JhdGVcbiAqIEByZXR1cm5zIHtmdW5jdGlvbn0gYSBmdW5jdGlvbiB0aGF0IGhhcyBiZWVuIGRlY29yYXRlZC5cbiAqL1xuUS5wcm9taXNlZCA9IHByb21pc2VkO1xuZnVuY3Rpb24gcHJvbWlzZWQoY2FsbGJhY2spIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gc3ByZWFkKFt0aGlzLCBhbGwoYXJndW1lbnRzKV0sIGZ1bmN0aW9uIChzZWxmLCBhcmdzKSB7XG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2suYXBwbHkoc2VsZiwgYXJncyk7XG4gICAgICAgIH0pO1xuICAgIH07XG59XG5cbi8qKlxuICogc2VuZHMgYSBtZXNzYWdlIHRvIGEgdmFsdWUgaW4gYSBmdXR1cmUgdHVyblxuICogQHBhcmFtIG9iamVjdCogdGhlIHJlY2lwaWVudFxuICogQHBhcmFtIG9wIHRoZSBuYW1lIG9mIHRoZSBtZXNzYWdlIG9wZXJhdGlvbiwgZS5nLiwgXCJ3aGVuXCIsXG4gKiBAcGFyYW0gYXJncyBmdXJ0aGVyIGFyZ3VtZW50cyB0byBiZSBmb3J3YXJkZWQgdG8gdGhlIG9wZXJhdGlvblxuICogQHJldHVybnMgcmVzdWx0IHtQcm9taXNlfSBhIHByb21pc2UgZm9yIHRoZSByZXN1bHQgb2YgdGhlIG9wZXJhdGlvblxuICovXG5RLmRpc3BhdGNoID0gZGlzcGF0Y2g7XG5mdW5jdGlvbiBkaXNwYXRjaChvYmplY3QsIG9wLCBhcmdzKSB7XG4gICAgcmV0dXJuIFEob2JqZWN0KS5kaXNwYXRjaChvcCwgYXJncyk7XG59XG5cblByb21pc2UucHJvdG90eXBlLmRpc3BhdGNoID0gZnVuY3Rpb24gKG9wLCBhcmdzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBkZWZlcnJlZCA9IGRlZmVyKCk7XG4gICAgbmV4dFRpY2soZnVuY3Rpb24gKCkge1xuICAgICAgICBzZWxmLnByb21pc2VEaXNwYXRjaChkZWZlcnJlZC5yZXNvbHZlLCBvcCwgYXJncyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59O1xuXG4vKipcbiAqIEdldHMgdGhlIHZhbHVlIG9mIGEgcHJvcGVydHkgaW4gYSBmdXR1cmUgdHVybi5cbiAqIEBwYXJhbSBvYmplY3QgICAgcHJvbWlzZSBvciBpbW1lZGlhdGUgcmVmZXJlbmNlIGZvciB0YXJnZXQgb2JqZWN0XG4gKiBAcGFyYW0gbmFtZSAgICAgIG5hbWUgb2YgcHJvcGVydHkgdG8gZ2V0XG4gKiBAcmV0dXJuIHByb21pc2UgZm9yIHRoZSBwcm9wZXJ0eSB2YWx1ZVxuICovXG5RLmdldCA9IGZ1bmN0aW9uIChvYmplY3QsIGtleSkge1xuICAgIHJldHVybiBRKG9iamVjdCkuZGlzcGF0Y2goXCJnZXRcIiwgW2tleV0pO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKGtleSkge1xuICAgIHJldHVybiB0aGlzLmRpc3BhdGNoKFwiZ2V0XCIsIFtrZXldKTtcbn07XG5cbi8qKlxuICogU2V0cyB0aGUgdmFsdWUgb2YgYSBwcm9wZXJ0eSBpbiBhIGZ1dHVyZSB0dXJuLlxuICogQHBhcmFtIG9iamVjdCAgICBwcm9taXNlIG9yIGltbWVkaWF0ZSByZWZlcmVuY2UgZm9yIG9iamVjdCBvYmplY3RcbiAqIEBwYXJhbSBuYW1lICAgICAgbmFtZSBvZiBwcm9wZXJ0eSB0byBzZXRcbiAqIEBwYXJhbSB2YWx1ZSAgICAgbmV3IHZhbHVlIG9mIHByb3BlcnR5XG4gKiBAcmV0dXJuIHByb21pc2UgZm9yIHRoZSByZXR1cm4gdmFsdWVcbiAqL1xuUS5zZXQgPSBmdW5jdGlvbiAob2JqZWN0LCBrZXksIHZhbHVlKSB7XG4gICAgcmV0dXJuIFEob2JqZWN0KS5kaXNwYXRjaChcInNldFwiLCBba2V5LCB2YWx1ZV0pO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24gKGtleSwgdmFsdWUpIHtcbiAgICByZXR1cm4gdGhpcy5kaXNwYXRjaChcInNldFwiLCBba2V5LCB2YWx1ZV0pO1xufTtcblxuLyoqXG4gKiBEZWxldGVzIGEgcHJvcGVydHkgaW4gYSBmdXR1cmUgdHVybi5cbiAqIEBwYXJhbSBvYmplY3QgICAgcHJvbWlzZSBvciBpbW1lZGlhdGUgcmVmZXJlbmNlIGZvciB0YXJnZXQgb2JqZWN0XG4gKiBAcGFyYW0gbmFtZSAgICAgIG5hbWUgb2YgcHJvcGVydHkgdG8gZGVsZXRlXG4gKiBAcmV0dXJuIHByb21pc2UgZm9yIHRoZSByZXR1cm4gdmFsdWVcbiAqL1xuUS5kZWwgPSAvLyBYWFggbGVnYWN5XG5RW1wiZGVsZXRlXCJdID0gZnVuY3Rpb24gKG9iamVjdCwga2V5KSB7XG4gICAgcmV0dXJuIFEob2JqZWN0KS5kaXNwYXRjaChcImRlbGV0ZVwiLCBba2V5XSk7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5kZWwgPSAvLyBYWFggbGVnYWN5XG5Qcm9taXNlLnByb3RvdHlwZVtcImRlbGV0ZVwiXSA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICByZXR1cm4gdGhpcy5kaXNwYXRjaChcImRlbGV0ZVwiLCBba2V5XSk7XG59O1xuXG4vKipcbiAqIEludm9rZXMgYSBtZXRob2QgaW4gYSBmdXR1cmUgdHVybi5cbiAqIEBwYXJhbSBvYmplY3QgICAgcHJvbWlzZSBvciBpbW1lZGlhdGUgcmVmZXJlbmNlIGZvciB0YXJnZXQgb2JqZWN0XG4gKiBAcGFyYW0gbmFtZSAgICAgIG5hbWUgb2YgbWV0aG9kIHRvIGludm9rZVxuICogQHBhcmFtIHZhbHVlICAgICBhIHZhbHVlIHRvIHBvc3QsIHR5cGljYWxseSBhbiBhcnJheSBvZlxuICogICAgICAgICAgICAgICAgICBpbnZvY2F0aW9uIGFyZ3VtZW50cyBmb3IgcHJvbWlzZXMgdGhhdFxuICogICAgICAgICAgICAgICAgICBhcmUgdWx0aW1hdGVseSBiYWNrZWQgd2l0aCBgcmVzb2x2ZWAgdmFsdWVzLFxuICogICAgICAgICAgICAgICAgICBhcyBvcHBvc2VkIHRvIHRob3NlIGJhY2tlZCB3aXRoIFVSTHNcbiAqICAgICAgICAgICAgICAgICAgd2hlcmVpbiB0aGUgcG9zdGVkIHZhbHVlIGNhbiBiZSBhbnlcbiAqICAgICAgICAgICAgICAgICAgSlNPTiBzZXJpYWxpemFibGUgb2JqZWN0LlxuICogQHJldHVybiBwcm9taXNlIGZvciB0aGUgcmV0dXJuIHZhbHVlXG4gKi9cbi8vIGJvdW5kIGxvY2FsbHkgYmVjYXVzZSBpdCBpcyB1c2VkIGJ5IG90aGVyIG1ldGhvZHNcblEubWFwcGx5ID0gLy8gWFhYIEFzIHByb3Bvc2VkIGJ5IFwiUmVkc2FuZHJvXCJcblEucG9zdCA9IGZ1bmN0aW9uIChvYmplY3QsIG5hbWUsIGFyZ3MpIHtcbiAgICByZXR1cm4gUShvYmplY3QpLmRpc3BhdGNoKFwicG9zdFwiLCBbbmFtZSwgYXJnc10pO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUubWFwcGx5ID0gLy8gWFhYIEFzIHByb3Bvc2VkIGJ5IFwiUmVkc2FuZHJvXCJcblByb21pc2UucHJvdG90eXBlLnBvc3QgPSBmdW5jdGlvbiAobmFtZSwgYXJncykge1xuICAgIHJldHVybiB0aGlzLmRpc3BhdGNoKFwicG9zdFwiLCBbbmFtZSwgYXJnc10pO1xufTtcblxuLyoqXG4gKiBJbnZva2VzIGEgbWV0aG9kIGluIGEgZnV0dXJlIHR1cm4uXG4gKiBAcGFyYW0gb2JqZWN0ICAgIHByb21pc2Ugb3IgaW1tZWRpYXRlIHJlZmVyZW5jZSBmb3IgdGFyZ2V0IG9iamVjdFxuICogQHBhcmFtIG5hbWUgICAgICBuYW1lIG9mIG1ldGhvZCB0byBpbnZva2VcbiAqIEBwYXJhbSAuLi5hcmdzICAgYXJyYXkgb2YgaW52b2NhdGlvbiBhcmd1bWVudHNcbiAqIEByZXR1cm4gcHJvbWlzZSBmb3IgdGhlIHJldHVybiB2YWx1ZVxuICovXG5RLnNlbmQgPSAvLyBYWFggTWFyayBNaWxsZXIncyBwcm9wb3NlZCBwYXJsYW5jZVxuUS5tY2FsbCA9IC8vIFhYWCBBcyBwcm9wb3NlZCBieSBcIlJlZHNhbmRyb1wiXG5RLmludm9rZSA9IGZ1bmN0aW9uIChvYmplY3QsIG5hbWUgLyouLi5hcmdzKi8pIHtcbiAgICByZXR1cm4gUShvYmplY3QpLmRpc3BhdGNoKFwicG9zdFwiLCBbbmFtZSwgYXJyYXlfc2xpY2UoYXJndW1lbnRzLCAyKV0pO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuc2VuZCA9IC8vIFhYWCBNYXJrIE1pbGxlcidzIHByb3Bvc2VkIHBhcmxhbmNlXG5Qcm9taXNlLnByb3RvdHlwZS5tY2FsbCA9IC8vIFhYWCBBcyBwcm9wb3NlZCBieSBcIlJlZHNhbmRyb1wiXG5Qcm9taXNlLnByb3RvdHlwZS5pbnZva2UgPSBmdW5jdGlvbiAobmFtZSAvKi4uLmFyZ3MqLykge1xuICAgIHJldHVybiB0aGlzLmRpc3BhdGNoKFwicG9zdFwiLCBbbmFtZSwgYXJyYXlfc2xpY2UoYXJndW1lbnRzLCAxKV0pO1xufTtcblxuLyoqXG4gKiBBcHBsaWVzIHRoZSBwcm9taXNlZCBmdW5jdGlvbiBpbiBhIGZ1dHVyZSB0dXJuLlxuICogQHBhcmFtIG9iamVjdCAgICBwcm9taXNlIG9yIGltbWVkaWF0ZSByZWZlcmVuY2UgZm9yIHRhcmdldCBmdW5jdGlvblxuICogQHBhcmFtIGFyZ3MgICAgICBhcnJheSBvZiBhcHBsaWNhdGlvbiBhcmd1bWVudHNcbiAqL1xuUS5mYXBwbHkgPSBmdW5jdGlvbiAob2JqZWN0LCBhcmdzKSB7XG4gICAgcmV0dXJuIFEob2JqZWN0KS5kaXNwYXRjaChcImFwcGx5XCIsIFt2b2lkIDAsIGFyZ3NdKTtcbn07XG5cblByb21pc2UucHJvdG90eXBlLmZhcHBseSA9IGZ1bmN0aW9uIChhcmdzKSB7XG4gICAgcmV0dXJuIHRoaXMuZGlzcGF0Y2goXCJhcHBseVwiLCBbdm9pZCAwLCBhcmdzXSk7XG59O1xuXG4vKipcbiAqIENhbGxzIHRoZSBwcm9taXNlZCBmdW5jdGlvbiBpbiBhIGZ1dHVyZSB0dXJuLlxuICogQHBhcmFtIG9iamVjdCAgICBwcm9taXNlIG9yIGltbWVkaWF0ZSByZWZlcmVuY2UgZm9yIHRhcmdldCBmdW5jdGlvblxuICogQHBhcmFtIC4uLmFyZ3MgICBhcnJheSBvZiBhcHBsaWNhdGlvbiBhcmd1bWVudHNcbiAqL1xuUVtcInRyeVwiXSA9XG5RLmZjYWxsID0gZnVuY3Rpb24gKG9iamVjdCAvKiAuLi5hcmdzKi8pIHtcbiAgICByZXR1cm4gUShvYmplY3QpLmRpc3BhdGNoKFwiYXBwbHlcIiwgW3ZvaWQgMCwgYXJyYXlfc2xpY2UoYXJndW1lbnRzLCAxKV0pO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuZmNhbGwgPSBmdW5jdGlvbiAoLyouLi5hcmdzKi8pIHtcbiAgICByZXR1cm4gdGhpcy5kaXNwYXRjaChcImFwcGx5XCIsIFt2b2lkIDAsIGFycmF5X3NsaWNlKGFyZ3VtZW50cyldKTtcbn07XG5cbi8qKlxuICogQmluZHMgdGhlIHByb21pc2VkIGZ1bmN0aW9uLCB0cmFuc2Zvcm1pbmcgcmV0dXJuIHZhbHVlcyBpbnRvIGEgZnVsZmlsbGVkXG4gKiBwcm9taXNlIGFuZCB0aHJvd24gZXJyb3JzIGludG8gYSByZWplY3RlZCBvbmUuXG4gKiBAcGFyYW0gb2JqZWN0ICAgIHByb21pc2Ugb3IgaW1tZWRpYXRlIHJlZmVyZW5jZSBmb3IgdGFyZ2V0IGZ1bmN0aW9uXG4gKiBAcGFyYW0gLi4uYXJncyAgIGFycmF5IG9mIGFwcGxpY2F0aW9uIGFyZ3VtZW50c1xuICovXG5RLmZiaW5kID0gZnVuY3Rpb24gKG9iamVjdCAvKi4uLmFyZ3MqLykge1xuICAgIHZhciBwcm9taXNlID0gUShvYmplY3QpO1xuICAgIHZhciBhcmdzID0gYXJyYXlfc2xpY2UoYXJndW1lbnRzLCAxKTtcbiAgICByZXR1cm4gZnVuY3Rpb24gZmJvdW5kKCkge1xuICAgICAgICByZXR1cm4gcHJvbWlzZS5kaXNwYXRjaChcImFwcGx5XCIsIFtcbiAgICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgICBhcmdzLmNvbmNhdChhcnJheV9zbGljZShhcmd1bWVudHMpKVxuICAgICAgICBdKTtcbiAgICB9O1xufTtcblByb21pc2UucHJvdG90eXBlLmZiaW5kID0gZnVuY3Rpb24gKC8qLi4uYXJncyovKSB7XG4gICAgdmFyIHByb21pc2UgPSB0aGlzO1xuICAgIHZhciBhcmdzID0gYXJyYXlfc2xpY2UoYXJndW1lbnRzKTtcbiAgICByZXR1cm4gZnVuY3Rpb24gZmJvdW5kKCkge1xuICAgICAgICByZXR1cm4gcHJvbWlzZS5kaXNwYXRjaChcImFwcGx5XCIsIFtcbiAgICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgICBhcmdzLmNvbmNhdChhcnJheV9zbGljZShhcmd1bWVudHMpKVxuICAgICAgICBdKTtcbiAgICB9O1xufTtcblxuLyoqXG4gKiBSZXF1ZXN0cyB0aGUgbmFtZXMgb2YgdGhlIG93bmVkIHByb3BlcnRpZXMgb2YgYSBwcm9taXNlZFxuICogb2JqZWN0IGluIGEgZnV0dXJlIHR1cm4uXG4gKiBAcGFyYW0gb2JqZWN0ICAgIHByb21pc2Ugb3IgaW1tZWRpYXRlIHJlZmVyZW5jZSBmb3IgdGFyZ2V0IG9iamVjdFxuICogQHJldHVybiBwcm9taXNlIGZvciB0aGUga2V5cyBvZiB0aGUgZXZlbnR1YWxseSBzZXR0bGVkIG9iamVjdFxuICovXG5RLmtleXMgPSBmdW5jdGlvbiAob2JqZWN0KSB7XG4gICAgcmV0dXJuIFEob2JqZWN0KS5kaXNwYXRjaChcImtleXNcIiwgW10pO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUua2V5cyA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5kaXNwYXRjaChcImtleXNcIiwgW10pO1xufTtcblxuLyoqXG4gKiBUdXJucyBhbiBhcnJheSBvZiBwcm9taXNlcyBpbnRvIGEgcHJvbWlzZSBmb3IgYW4gYXJyYXkuICBJZiBhbnkgb2ZcbiAqIHRoZSBwcm9taXNlcyBnZXRzIHJlamVjdGVkLCB0aGUgd2hvbGUgYXJyYXkgaXMgcmVqZWN0ZWQgaW1tZWRpYXRlbHkuXG4gKiBAcGFyYW0ge0FycmF5Kn0gYW4gYXJyYXkgKG9yIHByb21pc2UgZm9yIGFuIGFycmF5KSBvZiB2YWx1ZXMgKG9yXG4gKiBwcm9taXNlcyBmb3IgdmFsdWVzKVxuICogQHJldHVybnMgYSBwcm9taXNlIGZvciBhbiBhcnJheSBvZiB0aGUgY29ycmVzcG9uZGluZyB2YWx1ZXNcbiAqL1xuLy8gQnkgTWFyayBNaWxsZXJcbi8vIGh0dHA6Ly93aWtpLmVjbWFzY3JpcHQub3JnL2Rva3UucGhwP2lkPXN0cmF3bWFuOmNvbmN1cnJlbmN5JnJldj0xMzA4Nzc2NTIxI2FsbGZ1bGZpbGxlZFxuUS5hbGwgPSBhbGw7XG5mdW5jdGlvbiBhbGwocHJvbWlzZXMpIHtcbiAgICByZXR1cm4gd2hlbihwcm9taXNlcywgZnVuY3Rpb24gKHByb21pc2VzKSB7XG4gICAgICAgIHZhciBjb3VudERvd24gPSAwO1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSBkZWZlcigpO1xuICAgICAgICBhcnJheV9yZWR1Y2UocHJvbWlzZXMsIGZ1bmN0aW9uICh1bmRlZmluZWQsIHByb21pc2UsIGluZGV4KSB7XG4gICAgICAgICAgICB2YXIgc25hcHNob3Q7XG4gICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgaXNQcm9taXNlKHByb21pc2UpICYmXG4gICAgICAgICAgICAgICAgKHNuYXBzaG90ID0gcHJvbWlzZS5pbnNwZWN0KCkpLnN0YXRlID09PSBcImZ1bGZpbGxlZFwiXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICBwcm9taXNlc1tpbmRleF0gPSBzbmFwc2hvdC52YWx1ZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgKytjb3VudERvd247XG4gICAgICAgICAgICAgICAgd2hlbihcbiAgICAgICAgICAgICAgICAgICAgcHJvbWlzZSxcbiAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9taXNlc1tpbmRleF0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICgtLWNvdW50RG93biA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUocHJvbWlzZXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QsXG4gICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uIChwcm9ncmVzcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVmZXJyZWQubm90aWZ5KHsgaW5kZXg6IGluZGV4LCB2YWx1ZTogcHJvZ3Jlc3MgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LCB2b2lkIDApO1xuICAgICAgICBpZiAoY291bnREb3duID09PSAwKSB7XG4gICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHByb21pc2VzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9KTtcbn1cblxuUHJvbWlzZS5wcm90b3R5cGUuYWxsID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBhbGwodGhpcyk7XG59O1xuXG4vKipcbiAqIFdhaXRzIGZvciBhbGwgcHJvbWlzZXMgdG8gYmUgc2V0dGxlZCwgZWl0aGVyIGZ1bGZpbGxlZCBvclxuICogcmVqZWN0ZWQuICBUaGlzIGlzIGRpc3RpbmN0IGZyb20gYGFsbGAgc2luY2UgdGhhdCB3b3VsZCBzdG9wXG4gKiB3YWl0aW5nIGF0IHRoZSBmaXJzdCByZWplY3Rpb24uICBUaGUgcHJvbWlzZSByZXR1cm5lZCBieVxuICogYGFsbFJlc29sdmVkYCB3aWxsIG5ldmVyIGJlIHJlamVjdGVkLlxuICogQHBhcmFtIHByb21pc2VzIGEgcHJvbWlzZSBmb3IgYW4gYXJyYXkgKG9yIGFuIGFycmF5KSBvZiBwcm9taXNlc1xuICogKG9yIHZhbHVlcylcbiAqIEByZXR1cm4gYSBwcm9taXNlIGZvciBhbiBhcnJheSBvZiBwcm9taXNlc1xuICovXG5RLmFsbFJlc29sdmVkID0gZGVwcmVjYXRlKGFsbFJlc29sdmVkLCBcImFsbFJlc29sdmVkXCIsIFwiYWxsU2V0dGxlZFwiKTtcbmZ1bmN0aW9uIGFsbFJlc29sdmVkKHByb21pc2VzKSB7XG4gICAgcmV0dXJuIHdoZW4ocHJvbWlzZXMsIGZ1bmN0aW9uIChwcm9taXNlcykge1xuICAgICAgICBwcm9taXNlcyA9IGFycmF5X21hcChwcm9taXNlcywgUSk7XG4gICAgICAgIHJldHVybiB3aGVuKGFsbChhcnJheV9tYXAocHJvbWlzZXMsIGZ1bmN0aW9uIChwcm9taXNlKSB7XG4gICAgICAgICAgICByZXR1cm4gd2hlbihwcm9taXNlLCBub29wLCBub29wKTtcbiAgICAgICAgfSkpLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gcHJvbWlzZXM7XG4gICAgICAgIH0pO1xuICAgIH0pO1xufVxuXG5Qcm9taXNlLnByb3RvdHlwZS5hbGxSZXNvbHZlZCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gYWxsUmVzb2x2ZWQodGhpcyk7XG59O1xuXG4vKipcbiAqIEBzZWUgUHJvbWlzZSNhbGxTZXR0bGVkXG4gKi9cblEuYWxsU2V0dGxlZCA9IGFsbFNldHRsZWQ7XG5mdW5jdGlvbiBhbGxTZXR0bGVkKHByb21pc2VzKSB7XG4gICAgcmV0dXJuIFEocHJvbWlzZXMpLmFsbFNldHRsZWQoKTtcbn1cblxuLyoqXG4gKiBUdXJucyBhbiBhcnJheSBvZiBwcm9taXNlcyBpbnRvIGEgcHJvbWlzZSBmb3IgYW4gYXJyYXkgb2YgdGhlaXIgc3RhdGVzIChhc1xuICogcmV0dXJuZWQgYnkgYGluc3BlY3RgKSB3aGVuIHRoZXkgaGF2ZSBhbGwgc2V0dGxlZC5cbiAqIEBwYXJhbSB7QXJyYXlbQW55Kl19IHZhbHVlcyBhbiBhcnJheSAob3IgcHJvbWlzZSBmb3IgYW4gYXJyYXkpIG9mIHZhbHVlcyAob3JcbiAqIHByb21pc2VzIGZvciB2YWx1ZXMpXG4gKiBAcmV0dXJucyB7QXJyYXlbU3RhdGVdfSBhbiBhcnJheSBvZiBzdGF0ZXMgZm9yIHRoZSByZXNwZWN0aXZlIHZhbHVlcy5cbiAqL1xuUHJvbWlzZS5wcm90b3R5cGUuYWxsU2V0dGxlZCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy50aGVuKGZ1bmN0aW9uIChwcm9taXNlcykge1xuICAgICAgICByZXR1cm4gYWxsKGFycmF5X21hcChwcm9taXNlcywgZnVuY3Rpb24gKHByb21pc2UpIHtcbiAgICAgICAgICAgIHByb21pc2UgPSBRKHByb21pc2UpO1xuICAgICAgICAgICAgZnVuY3Rpb24gcmVnYXJkbGVzcygpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcHJvbWlzZS5pbnNwZWN0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcHJvbWlzZS50aGVuKHJlZ2FyZGxlc3MsIHJlZ2FyZGxlc3MpO1xuICAgICAgICB9KSk7XG4gICAgfSk7XG59O1xuXG4vKipcbiAqIENhcHR1cmVzIHRoZSBmYWlsdXJlIG9mIGEgcHJvbWlzZSwgZ2l2aW5nIGFuIG9wb3J0dW5pdHkgdG8gcmVjb3ZlclxuICogd2l0aCBhIGNhbGxiYWNrLiAgSWYgdGhlIGdpdmVuIHByb21pc2UgaXMgZnVsZmlsbGVkLCB0aGUgcmV0dXJuZWRcbiAqIHByb21pc2UgaXMgZnVsZmlsbGVkLlxuICogQHBhcmFtIHtBbnkqfSBwcm9taXNlIGZvciBzb21ldGhpbmdcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIHRvIGZ1bGZpbGwgdGhlIHJldHVybmVkIHByb21pc2UgaWYgdGhlXG4gKiBnaXZlbiBwcm9taXNlIGlzIHJlamVjdGVkXG4gKiBAcmV0dXJucyBhIHByb21pc2UgZm9yIHRoZSByZXR1cm4gdmFsdWUgb2YgdGhlIGNhbGxiYWNrXG4gKi9cblEuZmFpbCA9IC8vIFhYWCBsZWdhY3lcblFbXCJjYXRjaFwiXSA9IGZ1bmN0aW9uIChvYmplY3QsIHJlamVjdGVkKSB7XG4gICAgcmV0dXJuIFEob2JqZWN0KS50aGVuKHZvaWQgMCwgcmVqZWN0ZWQpO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuZmFpbCA9IC8vIFhYWCBsZWdhY3lcblByb21pc2UucHJvdG90eXBlW1wiY2F0Y2hcIl0gPSBmdW5jdGlvbiAocmVqZWN0ZWQpIHtcbiAgICByZXR1cm4gdGhpcy50aGVuKHZvaWQgMCwgcmVqZWN0ZWQpO1xufTtcblxuLyoqXG4gKiBBdHRhY2hlcyBhIGxpc3RlbmVyIHRoYXQgY2FuIHJlc3BvbmQgdG8gcHJvZ3Jlc3Mgbm90aWZpY2F0aW9ucyBmcm9tIGFcbiAqIHByb21pc2UncyBvcmlnaW5hdGluZyBkZWZlcnJlZC4gVGhpcyBsaXN0ZW5lciByZWNlaXZlcyB0aGUgZXhhY3QgYXJndW1lbnRzXG4gKiBwYXNzZWQgdG8gYGBkZWZlcnJlZC5ub3RpZnlgYC5cbiAqIEBwYXJhbSB7QW55Kn0gcHJvbWlzZSBmb3Igc29tZXRoaW5nXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayB0byByZWNlaXZlIGFueSBwcm9ncmVzcyBub3RpZmljYXRpb25zXG4gKiBAcmV0dXJucyB0aGUgZ2l2ZW4gcHJvbWlzZSwgdW5jaGFuZ2VkXG4gKi9cblEucHJvZ3Jlc3MgPSBwcm9ncmVzcztcbmZ1bmN0aW9uIHByb2dyZXNzKG9iamVjdCwgcHJvZ3Jlc3NlZCkge1xuICAgIHJldHVybiBRKG9iamVjdCkudGhlbih2b2lkIDAsIHZvaWQgMCwgcHJvZ3Jlc3NlZCk7XG59XG5cblByb21pc2UucHJvdG90eXBlLnByb2dyZXNzID0gZnVuY3Rpb24gKHByb2dyZXNzZWQpIHtcbiAgICByZXR1cm4gdGhpcy50aGVuKHZvaWQgMCwgdm9pZCAwLCBwcm9ncmVzc2VkKTtcbn07XG5cbi8qKlxuICogUHJvdmlkZXMgYW4gb3Bwb3J0dW5pdHkgdG8gb2JzZXJ2ZSB0aGUgc2V0dGxpbmcgb2YgYSBwcm9taXNlLFxuICogcmVnYXJkbGVzcyBvZiB3aGV0aGVyIHRoZSBwcm9taXNlIGlzIGZ1bGZpbGxlZCBvciByZWplY3RlZC4gIEZvcndhcmRzXG4gKiB0aGUgcmVzb2x1dGlvbiB0byB0aGUgcmV0dXJuZWQgcHJvbWlzZSB3aGVuIHRoZSBjYWxsYmFjayBpcyBkb25lLlxuICogVGhlIGNhbGxiYWNrIGNhbiByZXR1cm4gYSBwcm9taXNlIHRvIGRlZmVyIGNvbXBsZXRpb24uXG4gKiBAcGFyYW0ge0FueSp9IHByb21pc2VcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIHRvIG9ic2VydmUgdGhlIHJlc29sdXRpb24gb2YgdGhlIGdpdmVuXG4gKiBwcm9taXNlLCB0YWtlcyBubyBhcmd1bWVudHMuXG4gKiBAcmV0dXJucyBhIHByb21pc2UgZm9yIHRoZSByZXNvbHV0aW9uIG9mIHRoZSBnaXZlbiBwcm9taXNlIHdoZW5cbiAqIGBgZmluYGAgaXMgZG9uZS5cbiAqL1xuUS5maW4gPSAvLyBYWFggbGVnYWN5XG5RW1wiZmluYWxseVwiXSA9IGZ1bmN0aW9uIChvYmplY3QsIGNhbGxiYWNrKSB7XG4gICAgcmV0dXJuIFEob2JqZWN0KVtcImZpbmFsbHlcIl0oY2FsbGJhY2spO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuZmluID0gLy8gWFhYIGxlZ2FjeVxuUHJvbWlzZS5wcm90b3R5cGVbXCJmaW5hbGx5XCJdID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgY2FsbGJhY2sgPSBRKGNhbGxiYWNrKTtcbiAgICByZXR1cm4gdGhpcy50aGVuKGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICByZXR1cm4gY2FsbGJhY2suZmNhbGwoKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgICAgfSk7XG4gICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgICAvLyBUT0RPIGF0dGVtcHQgdG8gcmVjeWNsZSB0aGUgcmVqZWN0aW9uIHdpdGggXCJ0aGlzXCIuXG4gICAgICAgIHJldHVybiBjYWxsYmFjay5mY2FsbCgpLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhyb3cgcmVhc29uO1xuICAgICAgICB9KTtcbiAgICB9KTtcbn07XG5cbi8qKlxuICogVGVybWluYXRlcyBhIGNoYWluIG9mIHByb21pc2VzLCBmb3JjaW5nIHJlamVjdGlvbnMgdG8gYmVcbiAqIHRocm93biBhcyBleGNlcHRpb25zLlxuICogQHBhcmFtIHtBbnkqfSBwcm9taXNlIGF0IHRoZSBlbmQgb2YgYSBjaGFpbiBvZiBwcm9taXNlc1xuICogQHJldHVybnMgbm90aGluZ1xuICovXG5RLmRvbmUgPSBmdW5jdGlvbiAob2JqZWN0LCBmdWxmaWxsZWQsIHJlamVjdGVkLCBwcm9ncmVzcykge1xuICAgIHJldHVybiBRKG9iamVjdCkuZG9uZShmdWxmaWxsZWQsIHJlamVjdGVkLCBwcm9ncmVzcyk7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5kb25lID0gZnVuY3Rpb24gKGZ1bGZpbGxlZCwgcmVqZWN0ZWQsIHByb2dyZXNzKSB7XG4gICAgdmFyIG9uVW5oYW5kbGVkRXJyb3IgPSBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgLy8gZm9yd2FyZCB0byBhIGZ1dHVyZSB0dXJuIHNvIHRoYXQgYGB3aGVuYGBcbiAgICAgICAgLy8gZG9lcyBub3QgY2F0Y2ggaXQgYW5kIHR1cm4gaXQgaW50byBhIHJlamVjdGlvbi5cbiAgICAgICAgbmV4dFRpY2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgbWFrZVN0YWNrVHJhY2VMb25nKGVycm9yLCBwcm9taXNlKTtcbiAgICAgICAgICAgIGlmIChRLm9uZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBRLm9uZXJyb3IoZXJyb3IpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIC8vIEF2b2lkIHVubmVjZXNzYXJ5IGBuZXh0VGlja2BpbmcgdmlhIGFuIHVubmVjZXNzYXJ5IGB3aGVuYC5cbiAgICB2YXIgcHJvbWlzZSA9IGZ1bGZpbGxlZCB8fCByZWplY3RlZCB8fCBwcm9ncmVzcyA/XG4gICAgICAgIHRoaXMudGhlbihmdWxmaWxsZWQsIHJlamVjdGVkLCBwcm9ncmVzcykgOlxuICAgICAgICB0aGlzO1xuXG4gICAgaWYgKHR5cGVvZiBwcm9jZXNzID09PSBcIm9iamVjdFwiICYmIHByb2Nlc3MgJiYgcHJvY2Vzcy5kb21haW4pIHtcbiAgICAgICAgb25VbmhhbmRsZWRFcnJvciA9IHByb2Nlc3MuZG9tYWluLmJpbmQob25VbmhhbmRsZWRFcnJvcik7XG4gICAgfVxuXG4gICAgcHJvbWlzZS50aGVuKHZvaWQgMCwgb25VbmhhbmRsZWRFcnJvcik7XG59O1xuXG4vKipcbiAqIENhdXNlcyBhIHByb21pc2UgdG8gYmUgcmVqZWN0ZWQgaWYgaXQgZG9lcyBub3QgZ2V0IGZ1bGZpbGxlZCBiZWZvcmVcbiAqIHNvbWUgbWlsbGlzZWNvbmRzIHRpbWUgb3V0LlxuICogQHBhcmFtIHtBbnkqfSBwcm9taXNlXG4gKiBAcGFyYW0ge051bWJlcn0gbWlsbGlzZWNvbmRzIHRpbWVvdXRcbiAqIEBwYXJhbSB7U3RyaW5nfSBjdXN0b20gZXJyb3IgbWVzc2FnZSAob3B0aW9uYWwpXG4gKiBAcmV0dXJucyBhIHByb21pc2UgZm9yIHRoZSByZXNvbHV0aW9uIG9mIHRoZSBnaXZlbiBwcm9taXNlIGlmIGl0IGlzXG4gKiBmdWxmaWxsZWQgYmVmb3JlIHRoZSB0aW1lb3V0LCBvdGhlcndpc2UgcmVqZWN0ZWQuXG4gKi9cblEudGltZW91dCA9IGZ1bmN0aW9uIChvYmplY3QsIG1zLCBtZXNzYWdlKSB7XG4gICAgcmV0dXJuIFEob2JqZWN0KS50aW1lb3V0KG1zLCBtZXNzYWdlKTtcbn07XG5cblByb21pc2UucHJvdG90eXBlLnRpbWVvdXQgPSBmdW5jdGlvbiAobXMsIG1lc3NhZ2UpIHtcbiAgICB2YXIgZGVmZXJyZWQgPSBkZWZlcigpO1xuICAgIHZhciB0aW1lb3V0SWQgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZGVmZXJyZWQucmVqZWN0KG5ldyBFcnJvcihtZXNzYWdlIHx8IFwiVGltZWQgb3V0IGFmdGVyIFwiICsgbXMgKyBcIiBtc1wiKSk7XG4gICAgfSwgbXMpO1xuXG4gICAgdGhpcy50aGVuKGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dElkKTtcbiAgICAgICAgZGVmZXJyZWQucmVzb2x2ZSh2YWx1ZSk7XG4gICAgfSwgZnVuY3Rpb24gKGV4Y2VwdGlvbikge1xuICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dElkKTtcbiAgICAgICAgZGVmZXJyZWQucmVqZWN0KGV4Y2VwdGlvbik7XG4gICAgfSwgZGVmZXJyZWQubm90aWZ5KTtcblxuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIGEgcHJvbWlzZSBmb3IgdGhlIGdpdmVuIHZhbHVlIChvciBwcm9taXNlZCB2YWx1ZSksIHNvbWVcbiAqIG1pbGxpc2Vjb25kcyBhZnRlciBpdCByZXNvbHZlZC4gUGFzc2VzIHJlamVjdGlvbnMgaW1tZWRpYXRlbHkuXG4gKiBAcGFyYW0ge0FueSp9IHByb21pc2VcbiAqIEBwYXJhbSB7TnVtYmVyfSBtaWxsaXNlY29uZHNcbiAqIEByZXR1cm5zIGEgcHJvbWlzZSBmb3IgdGhlIHJlc29sdXRpb24gb2YgdGhlIGdpdmVuIHByb21pc2UgYWZ0ZXIgbWlsbGlzZWNvbmRzXG4gKiB0aW1lIGhhcyBlbGFwc2VkIHNpbmNlIHRoZSByZXNvbHV0aW9uIG9mIHRoZSBnaXZlbiBwcm9taXNlLlxuICogSWYgdGhlIGdpdmVuIHByb21pc2UgcmVqZWN0cywgdGhhdCBpcyBwYXNzZWQgaW1tZWRpYXRlbHkuXG4gKi9cblEuZGVsYXkgPSBmdW5jdGlvbiAob2JqZWN0LCB0aW1lb3V0KSB7XG4gICAgaWYgKHRpbWVvdXQgPT09IHZvaWQgMCkge1xuICAgICAgICB0aW1lb3V0ID0gb2JqZWN0O1xuICAgICAgICBvYmplY3QgPSB2b2lkIDA7XG4gICAgfVxuICAgIHJldHVybiBRKG9iamVjdCkuZGVsYXkodGltZW91dCk7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5kZWxheSA9IGZ1bmN0aW9uICh0aW1lb3V0KSB7XG4gICAgcmV0dXJuIHRoaXMudGhlbihmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gZGVmZXIoKTtcbiAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHZhbHVlKTtcbiAgICAgICAgfSwgdGltZW91dCk7XG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH0pO1xufTtcblxuLyoqXG4gKiBQYXNzZXMgYSBjb250aW51YXRpb24gdG8gYSBOb2RlIGZ1bmN0aW9uLCB3aGljaCBpcyBjYWxsZWQgd2l0aCB0aGUgZ2l2ZW5cbiAqIGFyZ3VtZW50cyBwcm92aWRlZCBhcyBhbiBhcnJheSwgYW5kIHJldHVybnMgYSBwcm9taXNlLlxuICpcbiAqICAgICAgUS5uZmFwcGx5KEZTLnJlYWRGaWxlLCBbX19maWxlbmFtZV0pXG4gKiAgICAgIC50aGVuKGZ1bmN0aW9uIChjb250ZW50KSB7XG4gKiAgICAgIH0pXG4gKlxuICovXG5RLm5mYXBwbHkgPSBmdW5jdGlvbiAoY2FsbGJhY2ssIGFyZ3MpIHtcbiAgICByZXR1cm4gUShjYWxsYmFjaykubmZhcHBseShhcmdzKTtcbn07XG5cblByb21pc2UucHJvdG90eXBlLm5mYXBwbHkgPSBmdW5jdGlvbiAoYXJncykge1xuICAgIHZhciBkZWZlcnJlZCA9IGRlZmVyKCk7XG4gICAgdmFyIG5vZGVBcmdzID0gYXJyYXlfc2xpY2UoYXJncyk7XG4gICAgbm9kZUFyZ3MucHVzaChkZWZlcnJlZC5tYWtlTm9kZVJlc29sdmVyKCkpO1xuICAgIHRoaXMuZmFwcGx5KG5vZGVBcmdzKS5mYWlsKGRlZmVycmVkLnJlamVjdCk7XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59O1xuXG4vKipcbiAqIFBhc3NlcyBhIGNvbnRpbnVhdGlvbiB0byBhIE5vZGUgZnVuY3Rpb24sIHdoaWNoIGlzIGNhbGxlZCB3aXRoIHRoZSBnaXZlblxuICogYXJndW1lbnRzIHByb3ZpZGVkIGluZGl2aWR1YWxseSwgYW5kIHJldHVybnMgYSBwcm9taXNlLlxuICogQGV4YW1wbGVcbiAqIFEubmZjYWxsKEZTLnJlYWRGaWxlLCBfX2ZpbGVuYW1lKVxuICogLnRoZW4oZnVuY3Rpb24gKGNvbnRlbnQpIHtcbiAqIH0pXG4gKlxuICovXG5RLm5mY2FsbCA9IGZ1bmN0aW9uIChjYWxsYmFjayAvKi4uLmFyZ3MqLykge1xuICAgIHZhciBhcmdzID0gYXJyYXlfc2xpY2UoYXJndW1lbnRzLCAxKTtcbiAgICByZXR1cm4gUShjYWxsYmFjaykubmZhcHBseShhcmdzKTtcbn07XG5cblByb21pc2UucHJvdG90eXBlLm5mY2FsbCA9IGZ1bmN0aW9uICgvKi4uLmFyZ3MqLykge1xuICAgIHZhciBub2RlQXJncyA9IGFycmF5X3NsaWNlKGFyZ3VtZW50cyk7XG4gICAgdmFyIGRlZmVycmVkID0gZGVmZXIoKTtcbiAgICBub2RlQXJncy5wdXNoKGRlZmVycmVkLm1ha2VOb2RlUmVzb2x2ZXIoKSk7XG4gICAgdGhpcy5mYXBwbHkobm9kZUFyZ3MpLmZhaWwoZGVmZXJyZWQucmVqZWN0KTtcbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn07XG5cbi8qKlxuICogV3JhcHMgYSBOb2RlSlMgY29udGludWF0aW9uIHBhc3NpbmcgZnVuY3Rpb24gYW5kIHJldHVybnMgYW4gZXF1aXZhbGVudFxuICogdmVyc2lvbiB0aGF0IHJldHVybnMgYSBwcm9taXNlLlxuICogQGV4YW1wbGVcbiAqIFEubmZiaW5kKEZTLnJlYWRGaWxlLCBfX2ZpbGVuYW1lKShcInV0Zi04XCIpXG4gKiAudGhlbihjb25zb2xlLmxvZylcbiAqIC5kb25lKClcbiAqL1xuUS5uZmJpbmQgPVxuUS5kZW5vZGVpZnkgPSBmdW5jdGlvbiAoY2FsbGJhY2sgLyouLi5hcmdzKi8pIHtcbiAgICB2YXIgYmFzZUFyZ3MgPSBhcnJheV9zbGljZShhcmd1bWVudHMsIDEpO1xuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBub2RlQXJncyA9IGJhc2VBcmdzLmNvbmNhdChhcnJheV9zbGljZShhcmd1bWVudHMpKTtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gZGVmZXIoKTtcbiAgICAgICAgbm9kZUFyZ3MucHVzaChkZWZlcnJlZC5tYWtlTm9kZVJlc29sdmVyKCkpO1xuICAgICAgICBRKGNhbGxiYWNrKS5mYXBwbHkobm9kZUFyZ3MpLmZhaWwoZGVmZXJyZWQucmVqZWN0KTtcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfTtcbn07XG5cblByb21pc2UucHJvdG90eXBlLm5mYmluZCA9XG5Qcm9taXNlLnByb3RvdHlwZS5kZW5vZGVpZnkgPSBmdW5jdGlvbiAoLyouLi5hcmdzKi8pIHtcbiAgICB2YXIgYXJncyA9IGFycmF5X3NsaWNlKGFyZ3VtZW50cyk7XG4gICAgYXJncy51bnNoaWZ0KHRoaXMpO1xuICAgIHJldHVybiBRLmRlbm9kZWlmeS5hcHBseSh2b2lkIDAsIGFyZ3MpO1xufTtcblxuUS5uYmluZCA9IGZ1bmN0aW9uIChjYWxsYmFjaywgdGhpc3AgLyouLi5hcmdzKi8pIHtcbiAgICB2YXIgYmFzZUFyZ3MgPSBhcnJheV9zbGljZShhcmd1bWVudHMsIDIpO1xuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBub2RlQXJncyA9IGJhc2VBcmdzLmNvbmNhdChhcnJheV9zbGljZShhcmd1bWVudHMpKTtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gZGVmZXIoKTtcbiAgICAgICAgbm9kZUFyZ3MucHVzaChkZWZlcnJlZC5tYWtlTm9kZVJlc29sdmVyKCkpO1xuICAgICAgICBmdW5jdGlvbiBib3VuZCgpIHtcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjay5hcHBseSh0aGlzcCwgYXJndW1lbnRzKTtcbiAgICAgICAgfVxuICAgICAgICBRKGJvdW5kKS5mYXBwbHkobm9kZUFyZ3MpLmZhaWwoZGVmZXJyZWQucmVqZWN0KTtcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfTtcbn07XG5cblByb21pc2UucHJvdG90eXBlLm5iaW5kID0gZnVuY3Rpb24gKC8qdGhpc3AsIC4uLmFyZ3MqLykge1xuICAgIHZhciBhcmdzID0gYXJyYXlfc2xpY2UoYXJndW1lbnRzLCAwKTtcbiAgICBhcmdzLnVuc2hpZnQodGhpcyk7XG4gICAgcmV0dXJuIFEubmJpbmQuYXBwbHkodm9pZCAwLCBhcmdzKTtcbn07XG5cbi8qKlxuICogQ2FsbHMgYSBtZXRob2Qgb2YgYSBOb2RlLXN0eWxlIG9iamVjdCB0aGF0IGFjY2VwdHMgYSBOb2RlLXN0eWxlXG4gKiBjYWxsYmFjayB3aXRoIGEgZ2l2ZW4gYXJyYXkgb2YgYXJndW1lbnRzLCBwbHVzIGEgcHJvdmlkZWQgY2FsbGJhY2suXG4gKiBAcGFyYW0gb2JqZWN0IGFuIG9iamVjdCB0aGF0IGhhcyB0aGUgbmFtZWQgbWV0aG9kXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBuYW1lIG9mIHRoZSBtZXRob2Qgb2Ygb2JqZWN0XG4gKiBAcGFyYW0ge0FycmF5fSBhcmdzIGFyZ3VtZW50cyB0byBwYXNzIHRvIHRoZSBtZXRob2Q7IHRoZSBjYWxsYmFja1xuICogd2lsbCBiZSBwcm92aWRlZCBieSBRIGFuZCBhcHBlbmRlZCB0byB0aGVzZSBhcmd1bWVudHMuXG4gKiBAcmV0dXJucyBhIHByb21pc2UgZm9yIHRoZSB2YWx1ZSBvciBlcnJvclxuICovXG5RLm5tYXBwbHkgPSAvLyBYWFggQXMgcHJvcG9zZWQgYnkgXCJSZWRzYW5kcm9cIlxuUS5ucG9zdCA9IGZ1bmN0aW9uIChvYmplY3QsIG5hbWUsIGFyZ3MpIHtcbiAgICByZXR1cm4gUShvYmplY3QpLm5wb3N0KG5hbWUsIGFyZ3MpO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUubm1hcHBseSA9IC8vIFhYWCBBcyBwcm9wb3NlZCBieSBcIlJlZHNhbmRyb1wiXG5Qcm9taXNlLnByb3RvdHlwZS5ucG9zdCA9IGZ1bmN0aW9uIChuYW1lLCBhcmdzKSB7XG4gICAgdmFyIG5vZGVBcmdzID0gYXJyYXlfc2xpY2UoYXJncyB8fCBbXSk7XG4gICAgdmFyIGRlZmVycmVkID0gZGVmZXIoKTtcbiAgICBub2RlQXJncy5wdXNoKGRlZmVycmVkLm1ha2VOb2RlUmVzb2x2ZXIoKSk7XG4gICAgdGhpcy5kaXNwYXRjaChcInBvc3RcIiwgW25hbWUsIG5vZGVBcmdzXSkuZmFpbChkZWZlcnJlZC5yZWplY3QpO1xuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufTtcblxuLyoqXG4gKiBDYWxscyBhIG1ldGhvZCBvZiBhIE5vZGUtc3R5bGUgb2JqZWN0IHRoYXQgYWNjZXB0cyBhIE5vZGUtc3R5bGVcbiAqIGNhbGxiYWNrLCBmb3J3YXJkaW5nIHRoZSBnaXZlbiB2YXJpYWRpYyBhcmd1bWVudHMsIHBsdXMgYSBwcm92aWRlZFxuICogY2FsbGJhY2sgYXJndW1lbnQuXG4gKiBAcGFyYW0gb2JqZWN0IGFuIG9iamVjdCB0aGF0IGhhcyB0aGUgbmFtZWQgbWV0aG9kXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBuYW1lIG9mIHRoZSBtZXRob2Qgb2Ygb2JqZWN0XG4gKiBAcGFyYW0gLi4uYXJncyBhcmd1bWVudHMgdG8gcGFzcyB0byB0aGUgbWV0aG9kOyB0aGUgY2FsbGJhY2sgd2lsbFxuICogYmUgcHJvdmlkZWQgYnkgUSBhbmQgYXBwZW5kZWQgdG8gdGhlc2UgYXJndW1lbnRzLlxuICogQHJldHVybnMgYSBwcm9taXNlIGZvciB0aGUgdmFsdWUgb3IgZXJyb3JcbiAqL1xuUS5uc2VuZCA9IC8vIFhYWCBCYXNlZCBvbiBNYXJrIE1pbGxlcidzIHByb3Bvc2VkIFwic2VuZFwiXG5RLm5tY2FsbCA9IC8vIFhYWCBCYXNlZCBvbiBcIlJlZHNhbmRybydzXCIgcHJvcG9zYWxcblEubmludm9rZSA9IGZ1bmN0aW9uIChvYmplY3QsIG5hbWUgLyouLi5hcmdzKi8pIHtcbiAgICB2YXIgbm9kZUFyZ3MgPSBhcnJheV9zbGljZShhcmd1bWVudHMsIDIpO1xuICAgIHZhciBkZWZlcnJlZCA9IGRlZmVyKCk7XG4gICAgbm9kZUFyZ3MucHVzaChkZWZlcnJlZC5tYWtlTm9kZVJlc29sdmVyKCkpO1xuICAgIFEob2JqZWN0KS5kaXNwYXRjaChcInBvc3RcIiwgW25hbWUsIG5vZGVBcmdzXSkuZmFpbChkZWZlcnJlZC5yZWplY3QpO1xuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUubnNlbmQgPSAvLyBYWFggQmFzZWQgb24gTWFyayBNaWxsZXIncyBwcm9wb3NlZCBcInNlbmRcIlxuUHJvbWlzZS5wcm90b3R5cGUubm1jYWxsID0gLy8gWFhYIEJhc2VkIG9uIFwiUmVkc2FuZHJvJ3NcIiBwcm9wb3NhbFxuUHJvbWlzZS5wcm90b3R5cGUubmludm9rZSA9IGZ1bmN0aW9uIChuYW1lIC8qLi4uYXJncyovKSB7XG4gICAgdmFyIG5vZGVBcmdzID0gYXJyYXlfc2xpY2UoYXJndW1lbnRzLCAxKTtcbiAgICB2YXIgZGVmZXJyZWQgPSBkZWZlcigpO1xuICAgIG5vZGVBcmdzLnB1c2goZGVmZXJyZWQubWFrZU5vZGVSZXNvbHZlcigpKTtcbiAgICB0aGlzLmRpc3BhdGNoKFwicG9zdFwiLCBbbmFtZSwgbm9kZUFyZ3NdKS5mYWlsKGRlZmVycmVkLnJlamVjdCk7XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59O1xuXG4vKipcbiAqIElmIGEgZnVuY3Rpb24gd291bGQgbGlrZSB0byBzdXBwb3J0IGJvdGggTm9kZSBjb250aW51YXRpb24tcGFzc2luZy1zdHlsZSBhbmRcbiAqIHByb21pc2UtcmV0dXJuaW5nLXN0eWxlLCBpdCBjYW4gZW5kIGl0cyBpbnRlcm5hbCBwcm9taXNlIGNoYWluIHdpdGhcbiAqIGBub2RlaWZ5KG5vZGViYWNrKWAsIGZvcndhcmRpbmcgdGhlIG9wdGlvbmFsIG5vZGViYWNrIGFyZ3VtZW50LiAgSWYgdGhlIHVzZXJcbiAqIGVsZWN0cyB0byB1c2UgYSBub2RlYmFjaywgdGhlIHJlc3VsdCB3aWxsIGJlIHNlbnQgdGhlcmUuICBJZiB0aGV5IGRvIG5vdFxuICogcGFzcyBhIG5vZGViYWNrLCB0aGV5IHdpbGwgcmVjZWl2ZSB0aGUgcmVzdWx0IHByb21pc2UuXG4gKiBAcGFyYW0gb2JqZWN0IGEgcmVzdWx0IChvciBhIHByb21pc2UgZm9yIGEgcmVzdWx0KVxuICogQHBhcmFtIHtGdW5jdGlvbn0gbm9kZWJhY2sgYSBOb2RlLmpzLXN0eWxlIGNhbGxiYWNrXG4gKiBAcmV0dXJucyBlaXRoZXIgdGhlIHByb21pc2Ugb3Igbm90aGluZ1xuICovXG5RLm5vZGVpZnkgPSBub2RlaWZ5O1xuZnVuY3Rpb24gbm9kZWlmeShvYmplY3QsIG5vZGViYWNrKSB7XG4gICAgcmV0dXJuIFEob2JqZWN0KS5ub2RlaWZ5KG5vZGViYWNrKTtcbn1cblxuUHJvbWlzZS5wcm90b3R5cGUubm9kZWlmeSA9IGZ1bmN0aW9uIChub2RlYmFjaykge1xuICAgIGlmIChub2RlYmFjaykge1xuICAgICAgICB0aGlzLnRoZW4oZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgbm9kZWJhY2sobnVsbCwgdmFsdWUpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICAgICAgbmV4dFRpY2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIG5vZGViYWNrKGVycm9yKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG59O1xuXG4vLyBBbGwgY29kZSBiZWZvcmUgdGhpcyBwb2ludCB3aWxsIGJlIGZpbHRlcmVkIGZyb20gc3RhY2sgdHJhY2VzLlxudmFyIHFFbmRpbmdMaW5lID0gY2FwdHVyZUxpbmUoKTtcblxucmV0dXJuIFE7XG5cbn0pO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZSgnX3Byb2Nlc3MnKSkiLCJ2YXIgbG9nID0gcmVxdWlyZSgnLi4vdmVuZG9yL29wZXJhdGlvbnMuanMvc3JjL2xvZycpO1xudmFyIExvY2FsQ2FjaGVMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ0xvY2FsQ2FjaGUnKTtcbkxvY2FsQ2FjaGVMb2dnZXIuc2V0TGV2ZWwobG9nLkxldmVsLndhcm4pO1xudmFyIFJlbW90ZUNhY2hlTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKCdSZW1vdGVDYWNoZScpO1xuUmVtb3RlQ2FjaGVMb2dnZXIuc2V0TGV2ZWwobG9nLkxldmVsLndhcm4pO1xudmFyIFJlc3RFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5SZXN0RXJyb3I7XG52YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpO1xuXG4vKipcbiAqIENhY2hlIGJ5IHBvdWNoIF9pZC5cbiAqIEB0eXBlIHt7fX1cbiAqL1xudmFyIGxvY2FsQ2FjaGVCeUlkID0ge307XG52YXIgbG9jYWxDYWNoZSA9IHt9O1xuXG4vKipcbiAqIENhY2hlIGJ5IHR5cGUgYW5kIHdoYXRldmVyIGlkIHdhcyBzcGVjaWZpZWQgaW4gdGhlIG1hcHBpbmcuXG4gKiBAdHlwZSB7e319XG4gKi9cbnZhciByZW1vdGVDYWNoZSA9IHt9O1xuXG5mdW5jdGlvbiByZXNldCgpIHtcbiAgICByZW1vdGVDYWNoZSA9IHt9O1xuICAgIGxvY2FsQ2FjaGVCeUlkID0ge307XG4gICAgbG9jYWxDYWNoZSA9IHt9O1xufVxuXG5yZXNldCgpO1xuXG5mdW5jdGlvbiBnZXRWaWFMb2NhbElkKGxvY2FsSWQpIHtcbiAgICB2YXIgb2JqID0gbG9jYWxDYWNoZUJ5SWRbbG9jYWxJZF07XG4gICAgaWYgKG9iaikge1xuICAgICAgICBpZiAoTG9jYWxDYWNoZUxvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICBMb2NhbENhY2hlTG9nZ2VyLmRlYnVnKCdMb2NhbCBjYWNoZSBoaXQ6ICcgKyBvYmouX2R1bXAodHJ1ZSkpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgaWYgKExvY2FsQ2FjaGVMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgTG9jYWxDYWNoZUxvZ2dlci5kZWJ1ZygnTG9jYWwgY2FjaGUgbWlzczogJyArIGxvY2FsSWQpO1xuICAgIH1cbiAgICByZXR1cm4gIG9iajtcbn1cblxuZnVuY3Rpb24gZ2V0U2luZ2xldG9uKG1hcHBpbmcpIHtcbiAgICB2YXIgbWFwcGluZ05hbWUgPSBtYXBwaW5nLnR5cGU7XG4gICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gbWFwcGluZy5jb2xsZWN0aW9uO1xuICAgIGNvbnNvbGUuZXJyb3IoJ2dldFNpbmdsZXRvbicsIGxvY2FsQ2FjaGUpO1xuICAgIHZhciBjb2xsZWN0aW9uQ2FjaGUgPSBsb2NhbENhY2hlW2NvbGxlY3Rpb25OYW1lXTtcbiAgICBpZiAoY29sbGVjdGlvbkNhY2hlKSB7XG4gICAgICAgIHZhciB0eXBlQ2FjaGUgPSBjb2xsZWN0aW9uQ2FjaGVbbWFwcGluZ05hbWVdO1xuICAgICAgICBpZiAodHlwZUNhY2hlKSB7XG4gICAgICAgICAgICB2YXIgb2JqcyA9IFtdO1xuICAgICAgICAgICAgZm9yICh2YXIgcHJvcCBpbiB0eXBlQ2FjaGUpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZUNhY2hlLmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgICAgICAgICAgICAgIG9ianMucHVzaCh0eXBlQ2FjaGVbcHJvcF0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChvYmpzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBSZXN0RXJyb3IoJ0Egc2luZ2xldG9uIG1hcHBpbmcgaGFzIG1vcmUgdGhhbiAxIG9iamVjdCBpbiB0aGUgY2FjaGUhIFRoaXMgaXMgYSBzZXJpb3VzIGVycm9yLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ0VpdGhlciBhIG1hcHBpbmcgaGFzIGJlZW4gbW9kaWZpZWQgYWZ0ZXIgb2JqZWN0cyBoYXZlIGFscmVhZHkgYmVlbiBjcmVhdGVkLCBvciBzb21ldGhpbmcgaGFzIGdvbmUnICtcbiAgICAgICAgICAgICAgICAgICAgJ3Zlcnkgd3JvbmcuIFBsZWFzZSBmaWxlIGEgYnVnIHJlcG9ydCBpZiB0aGUgbGF0dGVyLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAob2Jqcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gb2Jqc1swXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gZ2V0VmlhUmVtb3RlSWQocmVtb3RlSWQsIG9wdHMpIHtcbiAgICB2YXIgdHlwZSA9IG9wdHMubWFwcGluZy50eXBlO1xuICAgIHZhciBjb2xsZWN0aW9uID0gb3B0cy5tYXBwaW5nLmNvbGxlY3Rpb247XG4gICAgdmFyIGNvbGxlY3Rpb25DYWNoZSA9IHJlbW90ZUNhY2hlW2NvbGxlY3Rpb25dO1xuICAgIGlmIChjb2xsZWN0aW9uQ2FjaGUpIHtcbiAgICAgICAgdmFyIHR5cGVDYWNoZSA9IHJlbW90ZUNhY2hlW2NvbGxlY3Rpb25dW3R5cGVdO1xuICAgICAgICBpZiAodHlwZUNhY2hlKSB7XG4gICAgICAgICAgICB2YXIgb2JqID0gdHlwZUNhY2hlW3JlbW90ZUlkXTtcbiAgICAgICAgICAgIGlmIChvYmopIHtcbiAgICAgICAgICAgICAgICBpZiAoUmVtb3RlQ2FjaGVMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICBSZW1vdGVDYWNoZUxvZ2dlci5kZWJ1ZygnUmVtb3RlIGNhY2hlIGhpdDogJyArIG9iai5fZHVtcCh0cnVlKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoUmVtb3RlQ2FjaGVMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICBSZW1vdGVDYWNoZUxvZ2dlci5kZWJ1ZygnUmVtb3RlIGNhY2hlIG1pc3M6ICcgKyByZW1vdGVJZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gIG9iajtcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAoUmVtb3RlQ2FjaGVMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICBSZW1vdGVDYWNoZUxvZ2dlci5kZWJ1ZygnUmVtb3RlIGNhY2hlIG1pc3M6ICcgKyByZW1vdGVJZCk7XG4gICAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIHJlbW90ZUluc2VydChvYmosIHJlbW90ZUlkLCBwcmV2aW91c1JlbW90ZUlkKSB7XG4gICAgaWYgKG9iaikge1xuICAgICAgICB2YXIgY29sbGVjdGlvbiA9IG9iai5tYXBwaW5nLmNvbGxlY3Rpb247XG4gICAgICAgIGlmIChjb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICBpZiAoIXJlbW90ZUNhY2hlW2NvbGxlY3Rpb25dKSB7XG4gICAgICAgICAgICAgICAgcmVtb3RlQ2FjaGVbY29sbGVjdGlvbl0gPSB7fTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciB0eXBlID0gb2JqLm1hcHBpbmcudHlwZTtcbiAgICAgICAgICAgIGlmICh0eXBlKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFyZW1vdGVDYWNoZVtjb2xsZWN0aW9uXVt0eXBlXSkge1xuICAgICAgICAgICAgICAgICAgICByZW1vdGVDYWNoZVtjb2xsZWN0aW9uXVt0eXBlXSA9IHt9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAocHJldmlvdXNSZW1vdGVJZCkge1xuICAgICAgICAgICAgICAgICAgICByZW1vdGVDYWNoZVtjb2xsZWN0aW9uXVt0eXBlXVtwcmV2aW91c1JlbW90ZUlkXSA9IG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHZhciBjYWNoZWRPYmplY3QgPSByZW1vdGVDYWNoZVtjb2xsZWN0aW9uXVt0eXBlXVtyZW1vdGVJZF07XG4gICAgICAgICAgICAgICAgaWYgKCFjYWNoZWRPYmplY3QpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3RlQ2FjaGVbY29sbGVjdGlvbl1bdHlwZV1bcmVtb3RlSWRdID0gb2JqO1xuICAgICAgICAgICAgICAgICAgICBpZiAoUmVtb3RlQ2FjaGVMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgUmVtb3RlQ2FjaGVMb2dnZXIuZGVidWcoJ1JlbW90ZSBjYWNoZSBpbnNlcnQ6ICcgKyBvYmouX2R1bXAodHJ1ZSkpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoUmVtb3RlQ2FjaGVMb2dnZXIudHJhY2UuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgUmVtb3RlQ2FjaGVMb2dnZXIudHJhY2UoJ1JlbW90ZSBjYWNoZSBub3cgbG9va3MgbGlrZTogJyArIHJlbW90ZUR1bXAodHJ1ZSkpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBTb21ldGhpbmcgaGFzIGdvbmUgcmVhbGx5IHdyb25nLiBPbmx5IG9uZSBvYmplY3QgZm9yIGEgcGFydGljdWxhciBjb2xsZWN0aW9uL3R5cGUvcmVtb3RlaWQgY29tYm9cbiAgICAgICAgICAgICAgICAgICAgLy8gc2hvdWxkIGV2ZXIgZXhpc3QuXG4gICAgICAgICAgICAgICAgICAgIGlmIChvYmogIT0gY2FjaGVkT2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbWVzc2FnZSA9ICdPYmplY3QgJyArIGNvbGxlY3Rpb24udG9TdHJpbmcoKSArICc6JyArIHR5cGUudG9TdHJpbmcoKSArICdbJyArIG9iai5tYXBwaW5nLmlkICsgJz1cIicgKyByZW1vdGVJZCArICdcIl0gYWxyZWFkeSBleGlzdHMgaW4gdGhlIGNhY2hlLicgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICcgVGhpcyBpcyBhIHNlcmlvdXMgZXJyb3IsIHBsZWFzZSBmaWxlIGEgYnVnIHJlcG9ydCBpZiB5b3UgYXJlIGV4cGVyaWVuY2luZyB0aGlzIG91dCBpbiB0aGUgd2lsZCc7XG4gICAgICAgICAgICAgICAgICAgICAgICBSZW1vdGVDYWNoZUxvZ2dlci5lcnJvcihtZXNzYWdlLCB7b2JqOiBvYmosIGNhY2hlZE9iamVjdDogY2FjaGVkT2JqZWN0fSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB1dGlsLnByaW50U3RhY2tUcmFjZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFJlc3RFcnJvcihtZXNzYWdlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChSZW1vdGVDYWNoZUxvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgUmVtb3RlQ2FjaGVMb2dnZXIuZGVidWcoJ09iamVjdCBoYXMgYWxyZWFkeSBiZWVuIGluc2VydGVkOiAnICsgb2JqLl9kdW1wKHRydWUpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFJlc3RFcnJvcignTWFwcGluZyBoYXMgbm8gdHlwZScsIHttYXBwaW5nOiBvYmoubWFwcGluZywgb2JqOiBvYmp9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IoJ01hcHBpbmcgaGFzIG5vIGNvbGxlY3Rpb24nLCB7bWFwcGluZzogb2JqLm1hcHBpbmcsIG9iajogb2JqfSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHZhciBtc2cgPSAnTXVzdCBwYXNzIGFuIG9iamVjdCB3aGVuIGluc2VydGluZyB0byBjYWNoZSc7XG4gICAgICAgIFJlbW90ZUNhY2hlTG9nZ2VyLmVycm9yKG1zZyk7XG4gICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IobXNnKTtcbiAgICB9XG5cbn1cblxuZnVuY3Rpb24gcmVtb3RlRHVtcChhc0pzb24pIHtcbiAgICB2YXIgZHVtcGVkUmVzdENhY2hlID0ge307XG4gICAgZm9yICh2YXIgY29sbCBpbiByZW1vdGVDYWNoZSkge1xuICAgICAgICBpZiAocmVtb3RlQ2FjaGUuaGFzT3duUHJvcGVydHkoY29sbCkpIHtcbiAgICAgICAgICAgIHZhciBkdW1wZWRDb2xsQ2FjaGUgPSB7fTtcbiAgICAgICAgICAgIGR1bXBlZFJlc3RDYWNoZVtjb2xsXSA9IGR1bXBlZENvbGxDYWNoZTtcbiAgICAgICAgICAgIHZhciBjb2xsQ2FjaGUgPSByZW1vdGVDYWNoZVtjb2xsXTtcbiAgICAgICAgICAgIGZvciAodmFyIG1hcHBpbmcgaW4gY29sbENhY2hlKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNvbGxDYWNoZS5oYXNPd25Qcm9wZXJ0eShtYXBwaW5nKSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZHVtcGVkTWFwcGluZ0NhY2hlID0ge307XG4gICAgICAgICAgICAgICAgICAgIGR1bXBlZENvbGxDYWNoZVttYXBwaW5nXSA9IGR1bXBlZE1hcHBpbmdDYWNoZTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG1hcHBpbmdDYWNoZSA9IGNvbGxDYWNoZVttYXBwaW5nXTtcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgcmVtb3RlSWQgaW4gbWFwcGluZ0NhY2hlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobWFwcGluZ0NhY2hlLmhhc093blByb3BlcnR5KHJlbW90ZUlkKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChtYXBwaW5nQ2FjaGVbcmVtb3RlSWRdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGR1bXBlZE1hcHBpbmdDYWNoZVtyZW1vdGVJZF0gPSBtYXBwaW5nQ2FjaGVbcmVtb3RlSWRdLl9kdW1wKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBhc0pzb24gPyBKU09OLnN0cmluZ2lmeShkdW1wZWRSZXN0Q2FjaGUsIG51bGwsIDQpIDogZHVtcGVkUmVzdENhY2hlO1xuXG59XG5cbmZ1bmN0aW9uIGxvY2FsRHVtcChhc0pzb24pIHtcbiAgICB2YXIgZHVtcGVkSWRDYWNoZSA9IHt9O1xuICAgIGZvciAodmFyIGlkIGluIGxvY2FsQ2FjaGVCeUlkKSB7XG4gICAgICAgIGlmIChsb2NhbENhY2hlQnlJZC5oYXNPd25Qcm9wZXJ0eShpZCkpIHtcbiAgICAgICAgICAgIGR1bXBlZElkQ2FjaGVbaWRdID0gbG9jYWxDYWNoZUJ5SWRbaWRdLl9kdW1wKClcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gYXNKc29uID8gSlNPTi5zdHJpbmdpZnkoZHVtcGVkSWRDYWNoZSwgbnVsbCwgNCkgOiBkdW1wZWRJZENhY2hlO1xufVxuXG5mdW5jdGlvbiBkdW1wKGFzSnNvbikge1xuICAgIHZhciBkdW1wZWQgPSB7XG4gICAgICAgIGxvY2FsQ2FjaGU6IGxvY2FsRHVtcCgpLFxuICAgICAgICByZW1vdGVDYWNoZTogcmVtb3RlRHVtcCgpXG4gICAgfTtcbiAgICByZXR1cm4gYXNKc29uID8gSlNPTi5zdHJpbmdpZnkoZHVtcGVkLCBudWxsLCA0KSA6IGR1bXBlZDtcbn1cblxuZnVuY3Rpb24gX3JlbW90ZUNhY2hlKCkge1xuICAgIHJldHVybiByZW1vdGVDYWNoZVxufVxuXG5mdW5jdGlvbiBfbG9jYWxDYWNoZSgpIHtcbiAgICByZXR1cm4gbG9jYWxDYWNoZUJ5SWQ7XG59XG5cbmZ1bmN0aW9uIGdldChvcHRzKSB7XG4gICAgaWYgKExvY2FsQ2FjaGVMb2dnZXIuZGVidWcuaXNFbmFibGVkKSBMb2NhbENhY2hlTG9nZ2VyLmRlYnVnKCdnZXQnLCBvcHRzKTtcbiAgICB2YXIgb2JqLCBpZEZpZWxkLCByZW1vdGVJZDtcbiAgICB2YXIgbG9jYWxJZCA9IG9wdHMuX2lkO1xuICAgIGlmIChsb2NhbElkKSB7XG4gICAgICAgIG9iaiA9IGdldFZpYUxvY2FsSWQobG9jYWxJZCk7XG4gICAgICAgIGlmIChvYmopIHtcbiAgICAgICAgICAgIHJldHVybiBvYmo7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBpZiAob3B0cy5tYXBwaW5nKSB7XG4gICAgICAgICAgICAgICAgaWRGaWVsZCA9IG9wdHMubWFwcGluZy5pZDtcbiAgICAgICAgICAgICAgICByZW1vdGVJZCA9IG9wdHNbaWRGaWVsZF07XG4gICAgICAgICAgICAgICAgaWYgKExvY2FsQ2FjaGVMb2dnZXIuZGVidWcuaXNFbmFibGVkKSBMb2NhbENhY2hlTG9nZ2VyLmRlYnVnKGlkRmllbGQgKyAnPScgKyByZW1vdGVJZCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGdldFZpYVJlbW90ZUlkKHJlbW90ZUlkLCBvcHRzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIGVsc2UgaWYgKG9wdHMubWFwcGluZykge1xuICAgICAgICBpZEZpZWxkID0gb3B0cy5tYXBwaW5nLmlkO1xuICAgICAgICByZW1vdGVJZCA9IG9wdHNbaWRGaWVsZF07XG4gICAgICAgIGlmIChyZW1vdGVJZCkge1xuICAgICAgICAgICAgcmV0dXJuIGdldFZpYVJlbW90ZUlkKHJlbW90ZUlkLCBvcHRzKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChvcHRzLm1hcHBpbmcuc2luZ2xldG9uKSB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0U2luZ2xldG9uKG9wdHMubWFwcGluZyk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIExvY2FsQ2FjaGVMb2dnZXIud2FybignSW52YWxpZCBvcHRzIHRvIGNhY2hlJywge29wdHM6IG9wdHN9KTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG59XG5cbi8vIFRPRE86IFJFTU9WRSBUSElTLiBPTkxZIEZPUiBERUJVR0dJTkcuXG5mdW5jdGlvbiB2YWxpZGF0ZSgpIHtcbiAgICB2YXIgaWRlbnRzID0gT2JqZWN0LmtleXMobG9jYWxDYWNoZUJ5SWQpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgaWRlbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBpZGVudCA9IGlkZW50c1tpXTtcbiAgICAgICAgdmFyIG9iaiA9IGxvY2FsQ2FjaGVCeUlkW2lkZW50XTtcbiAgICAgICAgaWYgKGlkZW50ICE9IG9iai5faWQpIHtcbiAgICAgICAgICAgIHV0aWwucHJpbnRTdGFja1RyYWNlKCk7XG4gICAgICAgICAgICB0aHJvdyBuZXcgUmVzdEVycm9yKCd3dGY/Jyk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIGluc2VydChvYmopIHtcbiAgICB2YXIgbG9jYWxJZCA9IG9iai5faWQ7XG4gICAgaWYgKGxvY2FsSWQpIHtcbiAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gb2JqLm1hcHBpbmcuY29sbGVjdGlvbjtcbiAgICAgICAgdmFyIG1hcHBpbmdOYW1lID0gb2JqLm1hcHBpbmcudHlwZTtcbiAgICAgICAgaWYgKCFsb2NhbENhY2hlQnlJZFtsb2NhbElkXSkge1xuICAgICAgICAgICAgaWYgKExvY2FsQ2FjaGVMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgIExvY2FsQ2FjaGVMb2dnZXIuZGVidWcoJ0xvY2FsIGNhY2hlIGluc2VydDogJyArIG9iai5fZHVtcCh0cnVlKSk7XG4gICAgICAgICAgICBsb2NhbENhY2hlQnlJZFtsb2NhbElkXSA9IG9iajtcbiAgICAgICAgICAgIGlmIChMb2NhbENhY2hlTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICBMb2NhbENhY2hlTG9nZ2VyLnRyYWNlKCdMb2NhbCBjYWNoZSBub3cgbG9va3MgbGlrZTogJyArIGxvY2FsRHVtcCh0cnVlKSk7XG4gICAgICAgICAgICBpZiAoIWxvY2FsQ2FjaGVbY29sbGVjdGlvbk5hbWVdKSBsb2NhbENhY2hlW2NvbGxlY3Rpb25OYW1lXSA9IHt9O1xuICAgICAgICAgICAgaWYgKCFsb2NhbENhY2hlW2NvbGxlY3Rpb25OYW1lXVsgbWFwcGluZ05hbWVdKSBsb2NhbENhY2hlW2NvbGxlY3Rpb25OYW1lXVttYXBwaW5nTmFtZV0gPSB7fTtcbiAgICAgICAgICAgIGxvY2FsQ2FjaGVbY29sbGVjdGlvbk5hbWVdW29iai50eXBlXVtsb2NhbElkXSA9IG9iajtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIC8vIFNvbWV0aGluZyBoYXMgZ29uZSBiYWRseSB3cm9uZyBoZXJlLiBUd28gb2JqZWN0cyBzaG91bGQgbmV2ZXIgZXhpc3Qgd2l0aCB0aGUgc2FtZSBfaWRcbiAgICAgICAgICAgIGlmIChsb2NhbENhY2hlQnlJZFtsb2NhbElkXSAhPSBvYmopIHtcbiAgICAgICAgICAgICAgICB2YXIgbWVzc2FnZSA9ICdPYmplY3Qgd2l0aCBfaWQ9XCInICsgbG9jYWxJZC50b1N0cmluZygpICsgJ1wiIGlzIGFscmVhZHkgaW4gdGhlIGNhY2hlLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1RoaXMgaXMgYSBzZXJpb3VzIGVycm9yLiBQbGVhc2UgZmlsZSBhIGJ1ZyByZXBvcnQgaWYgeW91IGFyZSBleHBlcmllbmNpbmcgdGhpcyBvdXQgaW4gdGhlIHdpbGQnO1xuICAgICAgICAgICAgICAgIExvY2FsQ2FjaGVMb2dnZXIuZXJyb3IobWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFJlc3RFcnJvcihtZXNzYWdlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICB2YXIgaWRGaWVsZCA9IG9iai5pZEZpZWxkO1xuICAgIHZhciByZW1vdGVJZCA9IG9ialtpZEZpZWxkXTtcbiAgICBpZiAocmVtb3RlSWQpIHtcbiAgICAgICAgcmVtb3RlSW5zZXJ0KG9iaiwgcmVtb3RlSWQpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgaWYgKFJlbW90ZUNhY2hlTG9nZ2VyLmRlYnVnLmlzRW5hYmxlZClcbiAgICAgICAgICAgIFJlbW90ZUNhY2hlTG9nZ2VyLmRlYnVnKCdObyByZW1vdGUgaWQgKFwiJyArIGlkRmllbGQgKyAnXCIpIHNvIHdvbnQgYmUgcGxhY2luZyBpbiB0aGUgcmVtb3RlIGNhY2hlJywgb2JqKTtcbiAgICB9XG4gICAgdmFsaWRhdGUoKTtcbn1cblxuXG5mdW5jdGlvbiBkdW1wKGFzSnNvbikge1xuICAgIHZhciBkdW1wZWQgPSB7XG4gICAgICAgIGxvY2FsQ2FjaGU6IGxvY2FsRHVtcCgpLFxuICAgICAgICByZW1vdGVDYWNoZTogcmVtb3RlRHVtcCgpXG4gICAgfTtcbiAgICByZXR1cm4gYXNKc29uID8gSlNPTi5zdHJpbmdpZnkoZHVtcGVkLCBudWxsLCA0KSA6IGR1bXBlZDtcbn1cblxuXG5leHBvcnRzLl9yZW1vdGVDYWNoZSA9IF9yZW1vdGVDYWNoZTtcbmV4cG9ydHMuX2xvY2FsQ2FjaGUgPSBfbG9jYWxDYWNoZTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX2xvY2FsQ2FjaGVCeVR5cGUnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBsb2NhbENhY2hlO1xuICAgIH1cbn0pO1xuZXhwb3J0cy5nZXQgPSBnZXQ7XG5leHBvcnRzLmluc2VydCA9IGluc2VydDtcbmV4cG9ydHMucmVtb3RlSW5zZXJ0ID0gcmVtb3RlSW5zZXJ0O1xuZXhwb3J0cy5yZXNldCA9IHJlc2V0O1xuZXhwb3J0cy5fZHVtcCA9IGR1bXA7XG5cblxuXG5cblxuXG5cblxuXG5cbiIsInZhciBkZWZpbmVTdWJQcm9wZXJ0eSA9IHJlcXVpcmUoJy4vbWlzYycpLmRlZmluZVN1YlByb3BlcnR5O1xudmFyIG5vdGlmaWNhdGlvbkNlbnRyZSA9IHJlcXVpcmUoJy4vbm90aWZpY2F0aW9uQ2VudHJlJykubm90aWZpY2F0aW9uQ2VudHJlO1xudmFyIFJlc3RFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5SZXN0RXJyb3I7XG52YXIgbG9nID0gcmVxdWlyZSgnLi4vdmVuZG9yL29wZXJhdGlvbnMuanMvc3JjL2xvZycpO1xuXG52YXIgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKCdjaGFuZ2VzJyk7XG5Mb2dnZXIuc2V0TGV2ZWwobG9nLkxldmVsLndhcm4pO1xuXG52YXIgQ2hhbmdlVHlwZSA9IHtcbiAgICBTZXQ6ICdTZXQnLFxuICAgIFNwbGljZTogJ1NwbGljZScsXG4gICAgUmVtb3ZlOiAnUmVtb3ZlJ1xufTtcblxuLyoqXG4gKiBSZXByZXNlbnRzIGFuIGluZGl2aWR1YWwgY2hhbmdlLlxuICogQHBhcmFtIG9wdHNcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBDaGFuZ2Uob3B0cykge1xuICAgIHRoaXMuX29wdHMgPSBvcHRzO1xuICAgIGlmICghdGhpcy5fb3B0cykge1xuICAgICAgICB0aGlzLl9vcHRzID0ge307XG4gICAgfVxuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ2NvbGxlY3Rpb24nLCB0aGlzLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdtYXBwaW5nJywgdGhpcy5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnX2lkJywgdGhpcy5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnZmllbGQnLCB0aGlzLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICd0eXBlJywgdGhpcy5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnaW5kZXgnLCB0aGlzLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdhZGRlZCcsIHRoaXMuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ2FkZGVkSWQnLCB0aGlzLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdyZW1vdmVkJywgdGhpcy5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAncmVtb3ZlZElkJywgdGhpcy5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnbmV3JywgdGhpcy5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnbmV3SWQnLCB0aGlzLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdvbGQnLCB0aGlzLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdvbGRJZCcsIHRoaXMuX29wdHMpO1xufVxuXG5DaGFuZ2UucHJvdG90eXBlLl9kdW1wID0gZnVuY3Rpb24gKGpzb24pIHtcbiAgICB2YXIgZHVtcGVkID0ge307XG4gICAgZHVtcGVkLmNvbGxlY3Rpb24gPSAodHlwZW9mIHRoaXMuY29sbGVjdGlvbikgPT0gJ3N0cmluZycgPyB0aGlzLmNvbGxlY3Rpb24gOiB0aGlzLmNvbGxlY3Rpb24uX2R1bXAoKTtcbiAgICBkdW1wZWQubWFwcGluZyA9ICh0eXBlb2YgdGhpcy5tYXBwaW5nKSA9PSAnc3RyaW5nJyA/IHRoaXMubWFwcGluZyA6IHRoaXMubWFwcGluZy50eXBlO1xuICAgIGR1bXBlZC5faWQgPSB0aGlzLl9pZDtcbiAgICBkdW1wZWQuZmllbGQgPSB0aGlzLmZpZWxkO1xuICAgIGR1bXBlZC50eXBlID0gdGhpcy50eXBlO1xuICAgIGlmICh0aGlzLmluZGV4KSBkdW1wZWQuaW5kZXggPSB0aGlzLmluZGV4O1xuICAgIGlmICh0aGlzLmFkZGVkKSBkdW1wZWQuYWRkZWQgPSBfLm1hcCh0aGlzLmFkZGVkLCBmdW5jdGlvbiAoeCkge3JldHVybiB4Ll9kdW1wKCl9KTtcbiAgICBpZiAodGhpcy5yZW1vdmVkKSBkdW1wZWQucmVtb3ZlZCA9IF8ubWFwKHRoaXMucmVtb3ZlZCwgZnVuY3Rpb24gKHgpIHtyZXR1cm4geC5fZHVtcCgpfSk7XG4gICAgaWYgKHRoaXMub2xkKSBkdW1wZWQub2xkID0gdGhpcy5vbGQ7XG4gICAgaWYgKHRoaXMubmV3KSBkdW1wZWQubmV3ID0gdGhpcy5uZXc7XG4gICAgcmV0dXJuIGpzb24gPyBKU09OLnN0cmluZ2lmeShkdW1wZWQsIG51bGwsIDQpIDogZHVtcGVkO1xufTtcblxuZnVuY3Rpb24gYnJvYWRjYXN0KGNvbGxlY3Rpb24sIG1hcHBpbmcsIGMpIHtcbiAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZCkgTG9nZ2VyLnRyYWNlKCdTZW5kaW5nIG5vdGlmaWNhdGlvbiBcIicgKyBjb2xsZWN0aW9uICsgJ1wiJyk7XG4gICAgbm90aWZpY2F0aW9uQ2VudHJlLmVtaXQoY29sbGVjdGlvbiwgYyk7XG4gICAgdmFyIG1hcHBpbmdOb3RpZiA9IGNvbGxlY3Rpb24gKyAnOicgKyBtYXBwaW5nO1xuICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSBMb2dnZXIudHJhY2UoJ1NlbmRpbmcgbm90aWZpY2F0aW9uIFwiJyArIG1hcHBpbmdOb3RpZiArICdcIicpO1xuICAgIG5vdGlmaWNhdGlvbkNlbnRyZS5lbWl0KG1hcHBpbmdOb3RpZiwgYyk7XG4gICAgdmFyIGdlbmVyaWNOb3RpZiA9ICdTaWVzdGEnO1xuICAgIGlmIChMb2dnZXIudHJhY2UuaXNFbmFibGVkKSBMb2dnZXIudHJhY2UoJ1NlbmRpbmcgbm90aWZpY2F0aW9uIFwiJyArIGdlbmVyaWNOb3RpZiArICdcIicpO1xuICAgIG5vdGlmaWNhdGlvbkNlbnRyZS5lbWl0KGdlbmVyaWNOb3RpZiwgYyk7XG59XG5cbi8qKlxuICogVGhyb3cgYW4gZXJyb3IgaWYgdGhlIGNoYW5nZSBpcyBpbmNvcnJlY3QuXG4gKiBAcGFyYW0gY2hhbmdlT3B0c1xuICovXG5mdW5jdGlvbiB2YWxpZGF0ZUNoYW5nZShjaGFuZ2VPcHRzKSB7XG4gICAgaWYgKCFjaGFuZ2VPcHRzLm1hcHBpbmcpIHRocm93IG5ldyBSZXN0RXJyb3IoJ011c3QgcGFzcyBhIG1hcHBpbmcnKTtcbiAgICBpZiAoIWNoYW5nZU9wdHMuY29sbGVjdGlvbikgdGhyb3cgbmV3IFJlc3RFcnJvcignTXVzdCBwYXNzIGEgY29sbGVjdGlvbicpO1xuICAgIGlmICghY2hhbmdlT3B0cy5faWQpIHRocm93IG5ldyBSZXN0RXJyb3IoJ011c3QgcGFzcyBhIGxvY2FsIGlkZW50aWZpZXInKTtcbn1cblxuXG4vKipcbiAqIFJlZ2lzdGVyIHRoYXQgYSBjaGFuZ2UgaGFzIGJlZW4gbWFkZS5cbiAqIEBwYXJhbSBvcHRzXG4gKi9cbmZ1bmN0aW9uIHJlZ2lzdGVyQ2hhbmdlKG9wdHMpIHtcbiAgICB2YWxpZGF0ZUNoYW5nZShvcHRzKTtcbiAgICB2YXIgY29sbGVjdGlvbiA9IG9wdHMuY29sbGVjdGlvbjtcbiAgICB2YXIgbWFwcGluZyA9IG9wdHMubWFwcGluZztcbiAgICB2YXIgYyA9IG5ldyBDaGFuZ2Uob3B0cyk7XG4gICAgYnJvYWRjYXN0KGNvbGxlY3Rpb24sIG1hcHBpbmcsIGMpO1xuICAgIHJldHVybiBjO1xufVxuXG5leHBvcnRzLkNoYW5nZSA9IENoYW5nZTtcbmV4cG9ydHMucmVnaXN0ZXJDaGFuZ2UgPSByZWdpc3RlckNoYW5nZTtcbmV4cG9ydHMudmFsaWRhdGVDaGFuZ2UgPSB2YWxpZGF0ZUNoYW5nZTtcbmV4cG9ydHMuQ2hhbmdlVHlwZSA9IENoYW5nZVR5cGU7IiwidmFyIGxvZyA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vcGVyYXRpb25zLmpzL3NyYy9sb2cnKTtcbnZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUoJ0NvbGxlY3Rpb24nKTtcbkxvZ2dlci5zZXRMZXZlbChsb2cuTGV2ZWwud2Fybik7XG5cbnZhciBDb2xsZWN0aW9uUmVnaXN0cnkgPSByZXF1aXJlKCcuL2NvbGxlY3Rpb25SZWdpc3RyeScpLkNvbGxlY3Rpb25SZWdpc3RyeTtcbnZhciBPcGVyYXRpb24gPSByZXF1aXJlKCcuLi92ZW5kb3Ivb3BlcmF0aW9ucy5qcy9zcmMvb3BlcmF0aW9uJykuT3BlcmF0aW9uO1xudmFyIFJlc3RFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5SZXN0RXJyb3I7XG52YXIgTWFwcGluZyA9IHJlcXVpcmUoJy4vbWFwcGluZycpLk1hcHBpbmc7XG52YXIgZXh0ZW5kID0gcmVxdWlyZSgnZXh0ZW5kJyk7XG52YXIgb2JzZXJ2ZSA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuUGxhdGZvcm07XG5cbi8vdmFyICQgPSByZXF1aXJlKCcuLi92ZW5kb3IvemVwdG8nKS4kO1xudmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcbnZhciBfID0gdXRpbC5fO1xuXG52YXIgcSA9IHJlcXVpcmUoJ3EnKTtcblxudmFyIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpO1xuLyoqXG4gKiBBIGNvbGxlY3Rpb24gZGVzY3JpYmVzIGEgc2V0IG9mIG1vZGVscyBhbmQgb3B0aW9uYWxseSBhIFJFU1QgQVBJIHdoaWNoIHdlIHdvdWxkXG4gKiBsaWtlIHRvIG1vZGVsLlxuICpcbiAqIEBwYXJhbSBuYW1lXG4gKiBAY29uc3RydWN0b3JcbiAqXG4gKiBAZXhhbXBsZVxuICogYGBganNcbiAqIHZhciBHaXRIdWIgPSBuZXcgQ29sbGVjdGlvbignR2l0SHViJylcbiAqIC8vIC4uLiBjb25maWd1cmUgbWFwcGluZ3MsIGRlc2NyaXB0b3JzIGV0YyAuLi5cbiAqIEdpdEh1Yi5pbnN0YWxsKGZ1bmN0aW9uICgpIHtcbiAqICAgICAvLyAuLi4gY2Fycnkgb24uXG4gKiB9KTtcbiAqIGBgYFxuICovXG5mdW5jdGlvbiBDb2xsZWN0aW9uKG5hbWUpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKCF0aGlzKSByZXR1cm4gbmV3IENvbGxlY3Rpb24obmFtZSk7XG4gICAgaWYgKCFuYW1lKSB0aHJvdyBSZXN0RXJyb3IoJ0NvbGxlY3Rpb24gbXVzdCBoYXZlIGEgbmFtZScpO1xuICAgIHRoaXMuX25hbWUgPSBuYW1lO1xuICAgIHRoaXMuX2RvY0lkID0gJ0NvbGxlY3Rpb25fJyArIHRoaXMuX25hbWU7XG4gICAgdGhpcy5fcmF3TWFwcGluZ3MgPSB7fTtcbiAgICB0aGlzLl9tYXBwaW5ncyA9IHt9O1xuICAgIC8qKlxuICAgICAqIFRoZSBVUkwgb2YgdGhlIEFQSSBlLmcuIGh0dHA6Ly9hcGkuZ2l0aHViLmNvbVxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgdGhpcy5iYXNlVVJMID0gJyc7XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdG8gdHJ1ZSBpZiBpbnN0YWxsYXRpb24gaGFzIHN1Y2NlZWRlZC4gWW91IGNhbm5vdCB1c2UgdGhlIGNvbGxlY3Rpb1xuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHRoaXMuaW5zdGFsbGVkID0gZmFsc2U7XG4gICAgQ29sbGVjdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyKHRoaXMpO1xuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnbmFtZScsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gc2VsZi5fbmFtZTtcbiAgICAgICAgfVxuICAgIH0pO1xufVxuXG4vKipcbiAqIEVuc3VyZSBtYXBwaW5ncyBhcmUgaW5zdGFsbGVkLlxuICogQHBhcmFtIGNhbGxiYWNrXG4gKi9cbkNvbGxlY3Rpb24ucHJvdG90eXBlLmluc3RhbGwgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICB2YXIgZGVmZXJyZWQgPSBxLmRlZmVyKCk7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICghdGhpcy5pbnN0YWxsZWQpIHtcbiAgICAgICAgdmFyIG1hcHBpbmdzVG9JbnN0YWxsID0gW107XG4gICAgICAgIGZvciAodmFyIG5hbWUgaW4gdGhpcy5fbWFwcGluZ3MpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9tYXBwaW5ncy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICAgICAgICAgIHZhciBtYXBwaW5nID0gdGhpcy5fbWFwcGluZ3NbbmFtZV07XG4gICAgICAgICAgICAgICAgbWFwcGluZ3NUb0luc3RhbGwucHVzaChtYXBwaW5nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoTG9nZ2VyLmluZm8uaXNFbmFibGVkKVxuICAgICAgICAgICAgTG9nZ2VyLmluZm8oJ1RoZXJlIGFyZSAnICsgbWFwcGluZ3NUb0luc3RhbGwubGVuZ3RoLnRvU3RyaW5nKCkgKyAnIG1hcHBpbmdzIHRvIGluc3RhbGwnKTtcbiAgICAgICAgaWYgKG1hcHBpbmdzVG9JbnN0YWxsLmxlbmd0aCkge1xuICAgICAgICAgICAgdmFyIG9wZXJhdGlvbnMgPSBfLm1hcChtYXBwaW5nc1RvSW5zdGFsbCwgZnVuY3Rpb24gKG0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IE9wZXJhdGlvbignSW5zdGFsbCBNYXBwaW5nJywgXy5iaW5kKG0uaW5zdGFsbCwgbSkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB2YXIgb3AgPSBuZXcgT3BlcmF0aW9uKCdJbnN0YWxsIE1hcHBpbmdzJywgb3BlcmF0aW9ucyk7XG4gICAgICAgICAgICBvcC5jb21wbGV0aW9uID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIGlmIChvcC5mYWlsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmVycm9yKCdGYWlsZWQgdG8gaW5zdGFsbCBjb2xsZWN0aW9uJywgb3AuZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICBzZWxmLl9maW5hbGlzZUluc3RhbGxhdGlvbihvcC5lcnJvciwgY2FsbGJhY2spO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5pbnN0YWxsZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB2YXIgZXJyb3JzID0gW107XG4gICAgICAgICAgICAgICAgICAgIF8uZWFjaChtYXBwaW5nc1RvSW5zdGFsbCwgZnVuY3Rpb24gKG0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChMb2dnZXIuaW5mby5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmluZm8oJ0luc3RhbGxpbmcgcmVsYXRpb25zaGlwcyBmb3IgbWFwcGluZyB3aXRoIG5hbWUgXCInICsgbS50eXBlICsgJ1wiJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG0uaW5zdGFsbFJlbGF0aW9uc2hpcHMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyIGluc3RhbmNlb2YgUmVzdEVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVycm9ycy5wdXNoKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnJvcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBfLmVhY2gobWFwcGluZ3NUb0luc3RhbGwsIGZ1bmN0aW9uIChtKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKExvZ2dlci5pbmZvLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmluZm8oJ0luc3RhbGxpbmcgcmV2ZXJzZSByZWxhdGlvbnNoaXBzIGZvciBtYXBwaW5nIHdpdGggbmFtZSBcIicgKyBtLnR5cGUgKyAnXCInKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtLmluc3RhbGxSZXZlcnNlUmVsYXRpb25zaGlwcygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIgaW5zdGFuY2VvZiBSZXN0RXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVycm9ycy5wdXNoKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB2YXIgZXJyO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyb3JzLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlcnIgPSBlcnJvcnNbMF07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAoZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXJyID0gZXJyb3JzO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuX2ZpbmFsaXNlSW5zdGFsbGF0aW9uKGVyciwgY2FsbGJhY2spO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBvcC5zdGFydCgpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgc2VsZi5fZmluYWxpc2VJbnN0YWxsYXRpb24obnVsbCwgY2FsbGJhY2spO1xuICAgICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICB2YXIgZXJyID0gbmV3IFJlc3RFcnJvcignQ29sbGVjdGlvbiBcIicgKyB0aGlzLl9uYW1lICsgJ1wiIGhhcyBhbHJlYWR5IGJlZW4gaW5zdGFsbGVkJyk7XG4gICAgICAgIHNlbGYuX2ZpbmFsaXNlSW5zdGFsbGF0aW9uKGVyciwgY2FsbGJhY2spO1xuICAgIH1cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn07XG5Db2xsZWN0aW9uLnByb3RvdHlwZS5fZmluYWxpc2VJbnN0YWxsYXRpb24gPSBmdW5jdGlvbiAoZXJyLCBjYWxsYmFjaykge1xuICAgIGlmICghZXJyKSB7XG4gICAgICAgIHRoaXMuaW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgdmFyIGluZGV4ID0gcmVxdWlyZSgnLi4vaW5kZXgnKTtcbiAgICAgICAgaW5kZXhbdGhpcy5fbmFtZV0gPSB0aGlzO1xuICAgIH1cbiAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGVycik7XG59O1xuQ29sbGVjdGlvbi5wcm90b3R5cGUuX21hcHBpbmcgPSBmdW5jdGlvbiAobmFtZSwgbWFwcGluZykge1xuICAgIGlmIChuYW1lKSB7XG4gICAgICAgIHRoaXMuX3Jhd01hcHBpbmdzW25hbWVdID0gbWFwcGluZztcbiAgICAgICAgdmFyIG9wdHMgPSBleHRlbmQodHJ1ZSwge30sIG1hcHBpbmcpO1xuICAgICAgICBvcHRzLnR5cGUgPSBuYW1lO1xuICAgICAgICBvcHRzLmNvbGxlY3Rpb24gPSB0aGlzLl9uYW1lO1xuICAgICAgICB2YXIgbWFwcGluZ09iamVjdCA9IG5ldyBNYXBwaW5nKG9wdHMpO1xuICAgICAgICB0aGlzLl9tYXBwaW5nc1tuYW1lXSA9IG1hcHBpbmdPYmplY3Q7XG4gICAgICAgIHRoaXNbbmFtZV0gPSBtYXBwaW5nT2JqZWN0O1xuICAgICAgICByZXR1cm4gbWFwcGluZ09iamVjdDtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IoJ05vIG5hbWUgc3BlY2lmaWVkIHdoZW4gY3JlYXRpbmcgbWFwcGluZycpO1xuICAgIH1cbn07XG5Db2xsZWN0aW9uLnByb3RvdHlwZS5tYXBwaW5nID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KGFyZ3VtZW50c1swXSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gXy5tYXAoYXJndW1lbnRzWzBdLCBmdW5jdGlvbiAobSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gc2VsZi5fbWFwcGluZyhtLm5hbWUsIG0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX21hcHBpbmcoYXJndW1lbnRzWzBdLm5hbWUsIGFyZ3VtZW50c1swXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGFyZ3VtZW50c1swXSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9tYXBwaW5nKGFyZ3VtZW50c1swXSwgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBfLm1hcChhcmd1bWVudHMsIGZ1bmN0aW9uIChtKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzZWxmLl9tYXBwaW5nKG0ubmFtZSwgbSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG59O1xuXG5mdW5jdGlvbiByZXF1ZXN0RGVzY3JpcHRvcihvcHRzKSB7XG4gICAgdmFyIHJlcXVlc3REZXNjcmlwdG9yID0gbmV3IHNpZXN0YS5leHQuaHR0cC5SZXF1ZXN0RGVzY3JpcHRvcihvcHRzKTtcbiAgICBzaWVzdGEuZXh0Lmh0dHAuRGVzY3JpcHRvclJlZ2lzdHJ5LnJlZ2lzdGVyUmVxdWVzdERlc2NyaXB0b3IocmVxdWVzdERlc2NyaXB0b3IpO1xuICAgIHJldHVybiByZXF1ZXN0RGVzY3JpcHRvcjtcbn1cblxuZnVuY3Rpb24gcmVzcG9uc2VEZXNjcmlwdG9yKG9wdHMpIHtcbiAgICB2YXIgcmVzcG9uc2VEZXNjcmlwdG9yID0gbmV3IHNpZXN0YS5leHQuaHR0cC5SZXNwb25zZURlc2NyaXB0b3Iob3B0cyk7XG4gICAgc2llc3RhLmV4dC5odHRwLkRlc2NyaXB0b3JSZWdpc3RyeS5yZWdpc3RlclJlc3BvbnNlRGVzY3JpcHRvcihyZXNwb25zZURlc2NyaXB0b3IpO1xuICAgIHJldHVybiByZXNwb25zZURlc2NyaXB0b3I7XG59XG5cbkNvbGxlY3Rpb24ucHJvdG90eXBlLl9kZXNjcmlwdG9yID0gZnVuY3Rpb24gKHJlZ2lzdHJhdGlvbkZ1bmMpIHtcbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgaWYgKGFyZ3MubGVuZ3RoKSB7XG4gICAgICAgIGlmIChhcmdzLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KGFyZ3NbMF0pKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIF8ubWFwKGFyZ3NbMF0sIGZ1bmN0aW9uIChkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZWdpc3RyYXRpb25GdW5jKGQpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlZ2lzdHJhdGlvbkZ1bmMoYXJnc1swXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gXy5tYXAoYXJncywgZnVuY3Rpb24gKGQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVnaXN0cmF0aW9uRnVuYyhkKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xufTtcbkNvbGxlY3Rpb24ucHJvdG90eXBlLnJlcXVlc3REZXNjcmlwdG9yID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBfLnBhcnRpYWwodGhpcy5fZGVzY3JpcHRvciwgcmVxdWVzdERlc2NyaXB0b3IpLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG59O1xuQ29sbGVjdGlvbi5wcm90b3R5cGUucmVzcG9uc2VEZXNjcmlwdG9yID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBfLnBhcnRpYWwodGhpcy5fZGVzY3JpcHRvciwgcmVzcG9uc2VEZXNjcmlwdG9yKS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufTtcbkNvbGxlY3Rpb24ucHJvdG90eXBlLl9kdW1wID0gZnVuY3Rpb24gKGFzSnNvbikge1xuICAgIHZhciBvYmogPSB7fTtcbiAgICBvYmouaW5zdGFsbGVkID0gdGhpcy5pbnN0YWxsZWQ7XG4gICAgb2JqLmRvY0lkID0gdGhpcy5fZG9jSWQ7XG4gICAgb2JqLm5hbWUgPSB0aGlzLl9uYW1lO1xuICAgIG9iai5iYXNlVVJMID0gdGhpcy5iYXNlVVJMO1xuICAgIHJldHVybiBhc0pzb24gPyBKU09OLnN0cmluZ2lmeShvYmosIG51bGwsIDQpIDogb2JqO1xufTtcblxuXG4vKipcbiAqIFBlcnNpc3QgYWxsIGNoYW5nZXMgdG8gUG91Y2hEQi5cbiAqIE5vdGU6IFN0b3JhZ2UgZXh0ZW5zaW9uIG11c3QgYmUgaW5zdGFsbGVkLlxuICogQHBhcmFtIGNhbGxiYWNrXG4gKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAqL1xuQ29sbGVjdGlvbi5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIHZhciBkZWZlcnJlZCA9IHEuZGVmZXIoKTtcbiAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgIGlmIChzaWVzdGEuZXh0LnN0b3JhZ2VFbmFibGVkKSB7XG4gICAgICAgIHV0aWwubmV4dChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgbWVyZ2VDaGFuZ2VzID0gc2llc3RhLmV4dC5zdG9yYWdlLmNoYW5nZXMubWVyZ2VDaGFuZ2VzO1xuICAgICAgICAgICAgbWVyZ2VDaGFuZ2VzKGNhbGxiYWNrKTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBjYWxsYmFjaygnU3RvcmFnZSBtb2R1bGUgbm90IGluc3RhbGxlZCcpO1xuICAgIH1cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn07XG5cblxuLyoqXG4gKiBTZW5kIGEgSFRUUCByZXF1ZXN0IHVzaW5nIHRoZSBnaXZlbiBtZXRob2RcbiAqIEBwYXJhbSByZXF1ZXN0IERvZXMgdGhlIHJlcXVlc3QgY29udGFpbiBkYXRhPyBlLmcuIFBPU1QvUEFUQ0gvUFVUIHdpbGwgYmUgdHJ1ZSwgR0VUIHdpbGwgZmFsc2VcbiAqIEBwYXJhbSBtZXRob2RcbiAqIEByZXR1cm5zIHsqfVxuICovXG5Db2xsZWN0aW9uLnByb3RvdHlwZS5IVFRQX01FVEhPRCA9IGZ1bmN0aW9uIChyZXF1ZXN0LCBtZXRob2QpIHtcbiAgICBpZiAoc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCkge1xuICAgICAgICByZXR1cm4gXy5wYXJ0aWFsKHJlcXVlc3QgPyB0aGlzLl9odHRwUmVxdWVzdCA6IHRoaXMuX2h0dHBSZXNwb25zZSwgbWV0aG9kKS5hcHBseSh0aGlzLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHRocm93IEVycm9yKCdTdG9yYWdlIGV4dGVuc2lvbiBub3QgaW5zdGFsbGVkLicpO1xuICAgIH1cbn07XG5cbi8qKlxuICogU2VuZCBhIEdFVCByZXF1ZXN0XG4gKiBAcmV0dXJucyB7Kn1cbiAqL1xuQ29sbGVjdGlvbi5wcm90b3R5cGUuR0VUID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBfLnBhcnRpYWwodGhpcy5IVFRQX01FVEhPRCwgZmFsc2UsICdHRVQnKS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufTtcblxuLyoqXG4gKiBTZW5kIGEgT1BUSU9OUyByZXF1ZXN0XG4gKiBAcmV0dXJucyB7Kn1cbiAqL1xuQ29sbGVjdGlvbi5wcm90b3R5cGUuT1BUSU9OUyA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKHRoaXMuSFRUUF9NRVRIT0QsIGZhbHNlLCAnT1BUSU9OUycpLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG59O1xuXG4vKipcbiAqIFNlbmQgYSBUUkFDRSByZXF1ZXN0XG4gKiBAcmV0dXJucyB7Kn1cbiAqL1xuQ29sbGVjdGlvbi5wcm90b3R5cGUuVFJBQ0UgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIF8ucGFydGlhbCh0aGlzLkhUVFBfTUVUSE9ELCBmYWxzZSwgJ1RSQUNFJykuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn07XG5cbi8qKlxuICogU2VuZCBhIEhFQUQgcmVxdWVzdFxuICogQHJldHVybnMgeyp9XG4gKi9cbkNvbGxlY3Rpb24ucHJvdG90eXBlLkhFQUQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIF8ucGFydGlhbCh0aGlzLkhUVFBfTUVUSE9ELCBmYWxzZSwgJ0hFQUQnKS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufTtcblxuLyoqXG4gKiBTZW5kIGEgUE9TVCByZXF1ZXN0XG4gKiBAcmV0dXJucyB7Kn1cbiAqL1xuQ29sbGVjdGlvbi5wcm90b3R5cGUuUE9TVCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKHRoaXMuSFRUUF9NRVRIT0QsIHRydWUsICdQT1NUJykuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn07XG5cbi8qKlxuICogU2VuZCBhIFBVVCByZXF1ZXN0XG4gKiBAcmV0dXJucyB7Kn1cbiAqL1xuQ29sbGVjdGlvbi5wcm90b3R5cGUuUFVUID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBfLnBhcnRpYWwodGhpcy5IVFRQX01FVEhPRCwgdHJ1ZSwgJ1BVVCcpLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG59O1xuXG4vKipcbiAqIFNlbmQgYSBQQVRDSCByZXF1ZXN0XG4gKiBAcmV0dXJucyB7Kn1cbiAqL1xuQ29sbGVjdGlvbi5wcm90b3R5cGUuUEFUQ0ggPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIF8ucGFydGlhbCh0aGlzLkhUVFBfTUVUSE9ELCB0cnVlLCAnUEFUQ0gnKS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufTtcblxuXG4vKipcbiAqIFJldHVybnMgdGhlIG51bWJlciBvZiBvYmplY3RzIGluIHRoaXMgY29sbGVjdGlvbi5cbiAqXG4gKiBAcGFyYW0gY2FsbGJhY2tcbiAqIEByZXR1cm5zIFByb21pc2VcbiAqL1xuQ29sbGVjdGlvbi5wcm90b3R5cGUuY291bnQgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICB2YXIgZGVmZXJyZWQgPSBxLmRlZmVyKCk7XG4gICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICB2YXIgdGFza3MgPSBfLm1hcCh0aGlzLl9tYXBwaW5ncywgZnVuY3Rpb24gKG0pIHtcbiAgICAgICAgcmV0dXJuIF8uYmluZChtLmNvdW50LCBtKTtcbiAgICB9KTtcbiAgICB1dGlsLnBhcmFsbGVsKHRhc2tzLCBmdW5jdGlvbiAoZXJyLCBucykge1xuICAgICAgICB2YXIgbjtcbiAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgIG4gPSBfLnJlZHVjZShucywgZnVuY3Rpb24gKG0sIHIpIHtyZXR1cm4gbSArIHJ9LCAwKTtcbiAgICAgICAgfVxuICAgICAgICBjYWxsYmFjayhlcnIsIG4pO1xuICAgIH0pO1xuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufTtcblxuZXhwb3J0cy5Db2xsZWN0aW9uID0gQ29sbGVjdGlvbjtcbiIsInZhciBfID0gcmVxdWlyZSgnLi91dGlsJykuXztcblxuZnVuY3Rpb24gQ29sbGVjdGlvblJlZ2lzdHJ5KCkge1xuICAgIGlmICghdGhpcykgcmV0dXJuIG5ldyBDb2xsZWN0aW9uUmVnaXN0cnkoKTtcbiAgICB0aGlzLmNvbGxlY3Rpb25OYW1lcyA9IFtdO1xufVxuXG5Db2xsZWN0aW9uUmVnaXN0cnkucHJvdG90eXBlLnJlZ2lzdGVyID0gZnVuY3Rpb24gKGNvbGxlY3Rpb24pIHtcbiAgICB2YXIgbmFtZSA9IGNvbGxlY3Rpb24uX25hbWU7XG4gICAgdGhpc1tuYW1lXSA9IGNvbGxlY3Rpb247XG4gICAgdGhpcy5jb2xsZWN0aW9uTmFtZXMucHVzaChuYW1lKTtcbn07XG5cbkNvbGxlY3Rpb25SZWdpc3RyeS5wcm90b3R5cGUucmVzZXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIF8uZWFjaCh0aGlzLmNvbGxlY3Rpb25OYW1lcywgZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgICAgZGVsZXRlIHNlbGZbbmFtZV07XG4gICAgfSk7XG4gICAgdGhpcy5jb2xsZWN0aW9uTmFtZXMgPSBbXTtcbn07XG5cbmV4cG9ydHMuQ29sbGVjdGlvblJlZ2lzdHJ5ID0gbmV3IENvbGxlY3Rpb25SZWdpc3RyeSgpOyIsImZ1bmN0aW9uIFJlc3RFcnJvcihtZXNzYWdlLCBjb250ZXh0LCBzc2YpIHtcbiAgICBpZiAoIXRoaXMpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBSZXN0RXJyb3IobWVzc2FnZSwgY29udGV4dCk7XG4gICAgfVxuXG4gICAgdGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcblxuICAgIHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG4gICAgLy8gY2FwdHVyZSBzdGFjayB0cmFjZVxuICAgIHNzZiA9IHNzZiB8fCBhcmd1bWVudHMuY2FsbGVlO1xuICAgIGlmIChzc2YgJiYgRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UpIHtcbiAgICAgICAgRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UodGhpcywgc3NmKTtcbiAgICB9XG59XG5cblJlc3RFcnJvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEVycm9yLnByb3RvdHlwZSk7XG5SZXN0RXJyb3IucHJvdG90eXBlLm5hbWUgPSAnUmVzdEVycm9yJztcblJlc3RFcnJvci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBSZXN0RXJyb3I7XG5cbmV4cG9ydHMuUmVzdEVycm9yID0gUmVzdEVycm9yOyIsInZhciBwcm94eSA9IHJlcXVpcmUoJy4vcHJveHknKVxuICAgICwgTmV3T2JqZWN0UHJveHkgPSBwcm94eS5OZXdPYmplY3RQcm94eVxuICAgICwgU3RvcmUgPSByZXF1aXJlKCcuL3N0b3JlJylcbiAgICAsIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKVxuICAgICwgXyA9IHV0aWwuX1xuICAgICwgUmVzdEVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLlJlc3RFcnJvclxuICAgICwgY29yZUNoYW5nZXMgPSByZXF1aXJlKCcuL2NoYW5nZXMnKVxuICAgICwgbm90aWZpY2F0aW9uQ2VudHJlID0gcmVxdWlyZSgnLi9ub3RpZmljYXRpb25DZW50cmUnKVxuICAgICwgd3JhcEFycmF5Rm9yQXR0cmlidXRlcyA9IG5vdGlmaWNhdGlvbkNlbnRyZS53cmFwQXJyYXlcbiAgICAsIFNpZXN0YU1vZGVsID0gcmVxdWlyZSgnLi9vYmplY3QnKS5TaWVzdGFNb2RlbFxuICAgICwgQXJyYXlPYnNlcnZlciA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuQXJyYXlPYnNlcnZlclxuICAgICwgQ2hhbmdlVHlwZSA9IHJlcXVpcmUoJy4vY2hhbmdlcycpLkNoYW5nZVR5cGVcbiAgICAsIHEgPSByZXF1aXJlKCdxJylcbjtcblxuXG5mdW5jdGlvbiBNYW55VG9NYW55UHJveHkob3B0cykge1xuICAgIE5ld09iamVjdFByb3h5LmNhbGwodGhpcywgb3B0cyk7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnaXNGYXVsdCcsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoc2VsZi5faWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gIXNlbGYucmVsYXRlZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgICBpZiAodikge1xuICAgICAgICAgICAgICAgIHNlbGYuX2lkID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIHNlbGYucmVsYXRlZCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoIXNlbGYuX2lkKSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuX2lkID0gW107XG4gICAgICAgICAgICAgICAgICAgIHNlbGYucmVsYXRlZCA9IFtdO1xuICAgICAgICAgICAgICAgICAgICB3cmFwQXJyYXkuY2FsbChzZWxmLCBzZWxmLnJlbGF0ZWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIHRoaXMuX3JldmVyc2VJc0FycmF5ID0gdHJ1ZTtcbn1cblxuXG5mdW5jdGlvbiBjbGVhclJldmVyc2UocmVtb3ZlZCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBfLmVhY2gocmVtb3ZlZCwgZnVuY3Rpb24gKHJlbW92ZWRPYmplY3QpIHtcbiAgICAgICAgdmFyIHJldmVyc2VQcm94eSA9IHByb3h5LmdldFJldmVyc2VQcm94eUZvck9iamVjdC5jYWxsKHNlbGYsIHJlbW92ZWRPYmplY3QpO1xuICAgICAgICB2YXIgaWR4ID0gcmV2ZXJzZVByb3h5Ll9pZC5pbmRleE9mKHNlbGYub2JqZWN0Ll9pZCk7XG4gICAgICAgIHByb3h5Lm1ha2VDaGFuZ2VzVG9SZWxhdGVkV2l0aG91dE9ic2VydmF0aW9ucy5jYWxsKHJldmVyc2VQcm94eSwgZnVuY3Rpb24gKCl7XG4gICAgICAgICAgICBwcm94eS5zcGxpY2UuY2FsbChyZXZlcnNlUHJveHksIGlkeCwgMSk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBzZXRSZXZlcnNlKGFkZGVkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIF8uZWFjaChhZGRlZCwgZnVuY3Rpb24gKGFkZGVkT2JqZWN0KSB7XG4gICAgICAgIHZhciByZXZlcnNlUHJveHkgPSBwcm94eS5nZXRSZXZlcnNlUHJveHlGb3JPYmplY3QuY2FsbChzZWxmLCBhZGRlZE9iamVjdCk7XG4gICAgICAgIHByb3h5Lm1ha2VDaGFuZ2VzVG9SZWxhdGVkV2l0aG91dE9ic2VydmF0aW9ucy5jYWxsKHJldmVyc2VQcm94eSwgZnVuY3Rpb24gKCl7XG4gICAgICAgICAgICBwcm94eS5zcGxpY2UuY2FsbChyZXZlcnNlUHJveHksIDAsIDAsIHNlbGYub2JqZWN0KTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIHdyYXBBcnJheShhcnIpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgd3JhcEFycmF5Rm9yQXR0cmlidXRlcyhhcnIsIHRoaXMucmV2ZXJzZU5hbWUsIHRoaXMub2JqZWN0KTtcbiAgICBpZiAoIWFyci5vbmVUb01hbnlPYnNlcnZlcikge1xuICAgICAgICBhcnIub25lVG9NYW55T2JzZXJ2ZXIgPSBuZXcgQXJyYXlPYnNlcnZlcihhcnIpO1xuICAgICAgICB2YXIgb2JzZXJ2ZXJGdW5jdGlvbiA9IGZ1bmN0aW9uIChzcGxpY2VzKSB7XG4gICAgICAgICAgICBzcGxpY2VzLmZvckVhY2goZnVuY3Rpb24gKHNwbGljZSkge1xuICAgICAgICAgICAgICAgIHZhciBhZGRlZCA9IHNwbGljZS5hZGRlZENvdW50ID8gYXJyLnNsaWNlKHNwbGljZS5pbmRleCwgc3BsaWNlLmluZGV4ICsgc3BsaWNlLmFkZGVkQ291bnQpIDogW107XG4gICAgICAgICAgICAgICAgdmFyIHJlbW92ZWQgPSBzcGxpY2UucmVtb3ZlZDtcbiAgICAgICAgICAgICAgICBjbGVhclJldmVyc2UuY2FsbChzZWxmLCByZW1vdmVkKTtcbiAgICAgICAgICAgICAgICBzZXRSZXZlcnNlLmNhbGwoc2VsZiwgYWRkZWQpO1xuICAgICAgICAgICAgICAgIHZhciBtYXBwaW5nID0gcHJveHkuZ2V0Rm9yd2FyZE1hcHBpbmcuY2FsbChzZWxmKTtcbiAgICAgICAgICAgICAgICBjb3JlQ2hhbmdlcy5yZWdpc3RlckNoYW5nZSh7XG4gICAgICAgICAgICAgICAgICAgIGNvbGxlY3Rpb246IG1hcHBpbmcuY29sbGVjdGlvbixcbiAgICAgICAgICAgICAgICAgICAgbWFwcGluZzogbWFwcGluZyxcbiAgICAgICAgICAgICAgICAgICAgX2lkOiBzZWxmLm9iamVjdC5faWQsXG4gICAgICAgICAgICAgICAgICAgIGZpZWxkOiBwcm94eS5nZXRGb3J3YXJkTmFtZS5jYWxsKHNlbGYpLFxuICAgICAgICAgICAgICAgICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgICAgICAgICAgICAgICAgICBhZGRlZDogYWRkZWQsXG4gICAgICAgICAgICAgICAgICAgIHJlbW92ZWRJZDogXy5wbHVjayhyZW1vdmVkLCAnX2lkJyksXG4gICAgICAgICAgICAgICAgICAgIGFkZGVkSWQ6IF8ucGx1Y2soYWRkZWQsICdfaWQnKSxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogQ2hhbmdlVHlwZS5TcGxpY2UsXG4gICAgICAgICAgICAgICAgICAgIGluZGV4OiBzcGxpY2UuaW5kZXhcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgICAgICBhcnIub25lVG9NYW55T2JzZXJ2ZXIub3BlbihvYnNlcnZlckZ1bmN0aW9uKTtcbiAgICB9XG59XG5cbk1hbnlUb01hbnlQcm94eS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKE5ld09iamVjdFByb3h5LnByb3RvdHlwZSk7XG5cbk1hbnlUb01hbnlQcm94eS5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgdmFyIGRlZmVycmVkID0gcS5kZWZlcigpO1xuICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICh0aGlzLmlzRmF1bHQpIHtcbiAgICAgICAgU3RvcmUuZ2V0KHtfaWQ6IHRoaXMuX2lkfSwgZnVuY3Rpb24gKGVyciwgc3RvcmVkKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgc2VsZi5yZWxhdGVkID0gc3RvcmVkO1xuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobnVsbCwgc3RvcmVkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobnVsbCwgdGhpcy5yZWxhdGVkKTtcbiAgICB9XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59O1xuXG5mdW5jdGlvbiB2YWxpZGF0ZShvYmopIHtcbiAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaikgIT0gJ1tvYmplY3QgQXJyYXldJykge1xuICAgICAgICAgICAgcmV0dXJuICdDYW5ub3QgYXNzaWduIHNjYWxhciB0byBtYW55IHRvIG1hbnknO1xuICAgICAgICB9XG4gICAgcmV0dXJuIG51bGw7XG59XG5cbk1hbnlUb01hbnlQcm94eS5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24gKG9iaikge1xuICAgIHByb3h5LmNoZWNrSW5zdGFsbGVkLmNhbGwodGhpcyk7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChvYmopIHtcbiAgICAgICAgdmFyIGVycm9yTWVzc2FnZTtcbiAgICAgICAgaWYgKGVycm9yTWVzc2FnZSA9IHZhbGlkYXRlLmNhbGwodGhpcywgb2JqKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFJlc3RFcnJvcihlcnJvck1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcHJveHkuY2xlYXJSZXZlcnNlUmVsYXRlZC5jYWxsKHRoaXMpO1xuICAgICAgICAgICAgcHJveHkuc2V0LmNhbGwoc2VsZiwgb2JqKTtcbiAgICAgICAgICAgIHdyYXBBcnJheS5jYWxsKHNlbGYsIG9iaik7XG4gICAgICAgICAgICBwcm94eS5zZXRSZXZlcnNlLmNhbGwoc2VsZiwgb2JqKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgcHJveHkuY2xlYXJSZXZlcnNlUmVsYXRlZC5jYWxsKHRoaXMpO1xuICAgICAgICBwcm94eS5zZXQuY2FsbChzZWxmLCBvYmopO1xuICAgIH1cbn07XG5cbk1hbnlUb01hbnlQcm94eS5wcm90b3R5cGUuaW5zdGFsbCA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICBOZXdPYmplY3RQcm94eS5wcm90b3R5cGUuaW5zdGFsbC5jYWxsKHRoaXMsIG9iaik7XG4gICAgb2JqWyAoJ3NwbGljZScgKyB1dGlsLmNhcGl0YWxpc2VGaXJzdExldHRlcih0aGlzLnJldmVyc2VOYW1lKSldID0gXy5iaW5kKHByb3h5LnNwbGljZSwgdGhpcyk7XG59O1xuXG5leHBvcnRzLk1hbnlUb01hbnlQcm94eSA9IE1hbnlUb01hbnlQcm94eTsiLCJ2YXIgbG9nID0gcmVxdWlyZSgnLi4vdmVuZG9yL29wZXJhdGlvbnMuanMvc3JjL2xvZycpO1xudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnTWFwcGluZycpO1xuTG9nZ2VyLnNldExldmVsKGxvZy5MZXZlbC50cmFjZSk7XG5cbnZhciBkZWZpbmVTdWJQcm9wZXJ0eSA9IHJlcXVpcmUoJy4vbWlzYycpLmRlZmluZVN1YlByb3BlcnR5O1xudmFyIENvbGxlY3Rpb25SZWdpc3RyeSA9IHJlcXVpcmUoJy4vY29sbGVjdGlvblJlZ2lzdHJ5JykuQ29sbGVjdGlvblJlZ2lzdHJ5O1xudmFyIFJlc3RFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5SZXN0RXJyb3I7XG52YXIgcmVsYXRpb25zaGlwID0gcmVxdWlyZSgnLi9yZWxhdGlvbnNoaXAnKTtcbnZhciBSZWxhdGlvbnNoaXBUeXBlID0gcmVsYXRpb25zaGlwLlJlbGF0aW9uc2hpcFR5cGU7XG52YXIgUXVlcnkgPSByZXF1aXJlKCcuL3F1ZXJ5JykuUXVlcnk7XG52YXIgT3BlcmF0aW9uID0gcmVxdWlyZSgnLi4vdmVuZG9yL29wZXJhdGlvbnMuanMvc3JjL29wZXJhdGlvbicpLk9wZXJhdGlvbjtcbnZhciBCdWxrTWFwcGluZ09wZXJhdGlvbiA9IHJlcXVpcmUoJy4vbWFwcGluZ09wZXJhdGlvbicpLkJ1bGtNYXBwaW5nT3BlcmF0aW9uO1xudmFyIFNpZXN0YU1vZGVsID0gcmVxdWlyZSgnLi9vYmplY3QnKS5TaWVzdGFNb2RlbDtcbnZhciBndWlkID0gcmVxdWlyZSgnLi9taXNjJykuZ3VpZDtcbnZhciBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKTtcbnZhciBzdG9yZSA9IHJlcXVpcmUoJy4vc3RvcmUnKTtcbnZhciBleHRlbmQgPSByZXF1aXJlKCdleHRlbmQnKTtcblxuXG52YXIgY29yZUNoYW5nZXMgPSByZXF1aXJlKCcuL2NoYW5nZXMnKTtcbnZhciBDaGFuZ2VUeXBlID0gY29yZUNoYW5nZXMuQ2hhbmdlVHlwZTtcbnZhciB3cmFwQXJyYXkgPSByZXF1aXJlKCcuL25vdGlmaWNhdGlvbkNlbnRyZScpLndyYXBBcnJheTtcblxudmFyIE9uZVRvTWFueVByb3h5ID0gcmVxdWlyZSgnLi9vbmVUb01hbnlQcm94eScpLk9uZVRvTWFueVByb3h5O1xudmFyIE9uZVRvT25lUHJveHkgPSByZXF1aXJlKCcuL29uZVRvT25lUHJveHknKS5PbmVUb09uZVByb3h5O1xudmFyIE1hbnlUb01hbnlQcm94eSA9IHJlcXVpcmUoJy4vbWFueVRvTWFueVByb3h5JykuTWFueVRvTWFueVByb3h5O1xuXG52YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpO1xudmFyIF8gPSB1dGlsLl87XG52YXIgcSA9IHJlcXVpcmUoJ3EnKTtcblxuXG5mdW5jdGlvbiBNYXBwaW5nKG9wdHMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdGhpcy5fb3B0cyA9IG9wdHM7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ19maWVsZHMnLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGZpZWxkcyA9IFtdO1xuICAgICAgICAgICAgaWYgKHNlbGYuX29wdHMuaWQpIHtcbiAgICAgICAgICAgICAgICBmaWVsZHMucHVzaChzZWxmLl9vcHRzLmlkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzZWxmLl9vcHRzLmF0dHJpYnV0ZXMpIHtcbiAgICAgICAgICAgICAgICBfLmVhY2goc2VsZi5fb3B0cy5hdHRyaWJ1dGVzLCBmdW5jdGlvbiAoeCkge2ZpZWxkcy5wdXNoKHgpfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZmllbGRzO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcblxuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ3R5cGUnLCBzZWxmLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdpZCcsIHNlbGYuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ2NvbGxlY3Rpb24nLCBzZWxmLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdhdHRyaWJ1dGVzJywgc2VsZi5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAncmVsYXRpb25zaGlwcycsIHNlbGYuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ2luZGV4ZXMnLCBzZWxmLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdzdWJjbGFzcycsIHNlbGYuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ3NpbmdsZXRvbicsIHNlbGYuX29wdHMpO1xuXG4gICAgaWYgKCF0aGlzLnJlbGF0aW9uc2hpcHMpIHtcbiAgICAgICAgdGhpcy5yZWxhdGlvbnNoaXBzID0gW107XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLmluZGV4ZXMpIHtcbiAgICAgICAgdGhpcy5pbmRleGVzID0gW107XG4gICAgfVxuXG4gICAgdGhpcy5fdmFsaWRhdGVTdWJjbGFzcygpO1xuXG4gICAgdGhpcy5faW5zdGFsbGVkID0gZmFsc2U7XG4gICAgdGhpcy5fcmVsYXRpb25zaGlwc0luc3RhbGxlZCA9IGZhbHNlO1xuICAgIHRoaXMuX3JldmVyc2VSZWxhdGlvbnNoaXBzSW5zdGFsbGVkID0gZmFsc2U7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ2luc3RhbGxlZCcsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gc2VsZi5faW5zdGFsbGVkICYmIHNlbGYuX3JlbGF0aW9uc2hpcHNJbnN0YWxsZWQgJiYgc2VsZi5fcmV2ZXJzZVJlbGF0aW9uc2hpcHNJbnN0YWxsZWQ7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pO1xuXG59XG5cbi8qKlxuICogRW5zdXJlIHRoYXQgYW55IHN1YmNsYXNzZXMgcGFzc2VkIHRvIHRoZSBtYXBwaW5nIGFyZSB2YWxpZCBhbmQgd29ya2luZyBjb3JyZWN0bHkuXG4gKiBAcHJpdmF0ZVxuICovXG5NYXBwaW5nLnByb3RvdHlwZS5fdmFsaWRhdGVTdWJjbGFzcyA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5zdWJjbGFzcyAmJiB0aGlzLnN1YmNsYXNzICE9PSBTaWVzdGFNb2RlbCkge1xuICAgICAgICB2YXIgb2JqID0gbmV3IHRoaXMuc3ViY2xhc3ModGhpcyk7XG4gICAgICAgIGlmICghb2JqLm1hcHBpbmcpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IoJ1N1YmNsYXNzIGZvciBtYXBwaW5nIFwiJyArIHRoaXMudHlwZSArICdcIiBoYXMgbm90IGJlZW4gY29uZmlndXJlZCBjb3JyZWN0bHkuICcgK1xuICAgICAgICAgICAgICAgICdEaWQgeW91IGNhbGwgc3VwZXI/Jyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuc3ViY2xhc3MucHJvdG90eXBlID09IFNpZXN0YU1vZGVsLnByb3RvdHlwZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFJlc3RFcnJvcignU3ViY2xhc3MgZm9yIG1hcHBpbmcgXCInICsgdGhpcy50eXBlICsgJ1wiIGhhcyBub3QgYmVlbiBjb25maWd1cmVkIGNvcnJlY3RseS4gJyArXG4gICAgICAgICAgICAgICAgJ1lvdSBzaG91bGQgdXNlIE9iamVjdC5jcmVhdGUgb24gU2llc3RhTW9kZWwgcHJvdG90eXBlLicpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuXG5NYXBwaW5nLnByb3RvdHlwZS5pbnN0YWxsUmVsYXRpb25zaGlwcyA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoIXRoaXMuX3JlbGF0aW9uc2hpcHNJbnN0YWxsZWQpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICBzZWxmLl9yZWxhdGlvbnNoaXBzID0gW107XG4gICAgICAgIGlmIChzZWxmLl9vcHRzLnJlbGF0aW9uc2hpcHMpIHtcbiAgICAgICAgICAgIGZvciAodmFyIG5hbWUgaW4gc2VsZi5fb3B0cy5yZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1ZyhzZWxmLnR5cGUgKyAnOiBjb25maWd1cmluZyByZWxhdGlvbnNoaXAgJyArIG5hbWUpO1xuICAgICAgICAgICAgICAgIGlmIChzZWxmLl9vcHRzLnJlbGF0aW9uc2hpcHMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlbGF0aW9uc2hpcCA9IHNlbGYuX29wdHMucmVsYXRpb25zaGlwc1tuYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlbGF0aW9uc2hpcC50eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuT25lVG9NYW55IHx8XG4gICAgICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXAudHlwZSA9PSBSZWxhdGlvbnNoaXBUeXBlLk9uZVRvT25lIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXAudHlwZSA9PSBSZWxhdGlvbnNoaXBUeXBlLk1hbnlUb01hbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBtYXBwaW5nTmFtZSA9IHJlbGF0aW9uc2hpcC5tYXBwaW5nO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKCdyZXZlcnNlTWFwcGluZ05hbWUnLCBtYXBwaW5nTmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXNlbGYuY29sbGVjdGlvbikgdGhyb3cgbmV3IFJlc3RFcnJvcignTWFwcGluZyBtdXN0IGhhdmUgY29sbGVjdGlvbicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb24gPSBDb2xsZWN0aW9uUmVnaXN0cnlbc2VsZi5jb2xsZWN0aW9uXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghY29sbGVjdGlvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IoJ0NvbGxlY3Rpb24gJyArIHNlbGYuY29sbGVjdGlvbiArICcgbm90IHJlZ2lzdGVyZWQnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciByZXZlcnNlTWFwcGluZyA9IGNvbGxlY3Rpb25bbWFwcGluZ05hbWVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFyZXZlcnNlTWFwcGluZykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBhcnIgPSBtYXBwaW5nTmFtZS5zcGxpdCgnLicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhcnIubGVuZ3RoID09IDIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gYXJyWzBdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXBwaW5nTmFtZSA9IGFyclsxXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG90aGVyQ29sbGVjdGlvbiA9IENvbGxlY3Rpb25SZWdpc3RyeVtjb2xsZWN0aW9uTmFtZV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghb3RoZXJDb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUmVzdEVycm9yKCdDb2xsZWN0aW9uIHdpdGggbmFtZSBcIicgKyBjb2xsZWN0aW9uTmFtZSArICdcIiBkb2VzIG5vdCBleGlzdC4nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXZlcnNlTWFwcGluZyA9IG90aGVyQ29sbGVjdGlvblttYXBwaW5nTmFtZV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKCdyZXZlcnNlTWFwcGluZycsIHJldmVyc2VNYXBwaW5nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZXZlcnNlTWFwcGluZykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcC5yZXZlcnNlTWFwcGluZyA9IHJldmVyc2VNYXBwaW5nO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcC5mb3J3YXJkTWFwcGluZyA9IHRoaXM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwLmZvcndhcmROYW1lID0gbmFtZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXAucmV2ZXJzZU5hbWUgPSByZWxhdGlvbnNoaXAucmV2ZXJzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IoJ01hcHBpbmcgd2l0aCBuYW1lIFwiJyArIG1hcHBpbmdOYW1lLnRvU3RyaW5nKCkgKyAnXCIgZG9lcyBub3QgZXhpc3QnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IoJ1JlbGF0aW9uc2hpcCB0eXBlICcgKyByZWxhdGlvbnNoaXAudHlwZSArICcgZG9lcyBub3QgZXhpc3QnKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9yZWxhdGlvbnNoaXBzSW5zdGFsbGVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IoJ1JlbGF0aW9uc2hpcHMgZm9yIFwiJyArIHRoaXMudHlwZSArICdcIiBoYXZlIGFscmVhZHkgYmVlbiBpbnN0YWxsZWQnKTtcbiAgICB9XG59O1xuXG5NYXBwaW5nLnByb3RvdHlwZS5pbnN0YWxsUmV2ZXJzZVJlbGF0aW9uc2hpcHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKCF0aGlzLl9yZXZlcnNlUmVsYXRpb25zaGlwc0luc3RhbGxlZCkge1xuICAgICAgICBmb3IgKHZhciBmb3J3YXJkTmFtZSBpbiB0aGlzLnJlbGF0aW9uc2hpcHMpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnJlbGF0aW9uc2hpcHMuaGFzT3duUHJvcGVydHkoZm9yd2FyZE5hbWUpKSB7XG4gICAgICAgICAgICAgICAgdmFyIHJlbGF0aW9uc2hpcCA9IHRoaXMucmVsYXRpb25zaGlwc1tmb3J3YXJkTmFtZV07XG4gICAgICAgICAgICAgICAgdmFyIHJldmVyc2VNYXBwaW5nID0gcmVsYXRpb25zaGlwLnJldmVyc2VNYXBwaW5nO1xuICAgICAgICAgICAgICAgIHJldmVyc2VNYXBwaW5nLnJlbGF0aW9uc2hpcHNbcmVsYXRpb25zaGlwLnJldmVyc2VOYW1lXSA9IHJlbGF0aW9uc2hpcDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9yZXZlcnNlUmVsYXRpb25zaGlwc0luc3RhbGxlZCA9IHRydWU7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgUmVzdEVycm9yKCdSZXZlcnNlIHJlbGF0aW9uc2hpcHMgZm9yIFwiJyArIHRoaXMudHlwZSArICdcIiBoYXZlIGFscmVhZHkgYmVlbiBpbnN0YWxsZWQuJyk7XG4gICAgfVxufTtcblxuTWFwcGluZy5wcm90b3R5cGUucXVlcnkgPSBmdW5jdGlvbiAocXVlcnksIGNhbGxiYWNrKSB7XG4gICAgdmFyIGRlZmVycmVkID0gcS5kZWZlcigpO1xuICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgdmFyIF9xdWVyeSA9IG5ldyBRdWVyeSh0aGlzLCBxdWVyeSk7XG4gICAgX3F1ZXJ5LmV4ZWN1dGUoY2FsbGJhY2spO1xuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufTtcblxuTWFwcGluZy5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKGlkT3JDYWxsYmFjaywgY2FsbGJhY2spIHtcbiAgICB2YXIgZGVmZXJyZWQgPSBxLmRlZmVyKCk7XG4gICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICBmdW5jdGlvbiBmaW5pc2goZXJyLCByZXMpIHtcbiAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIsIHJlcyk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuc2luZ2xldG9uKSB7XG4gICAgICAgIGlmICh0eXBlb2YgaWRPckNhbGxiYWNrID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrID0gaWRPckNhbGxiYWNrO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuYWxsKGZ1bmN0aW9uIChlcnIsIG9ianMpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIGZpbmlzaChlcnIpO1xuICAgICAgICAgICAgaWYgKG9ianMubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IoJ1NvbWVob3cgbW9yZSB0aGFuIG9uZSBvYmplY3QgaGFzIGJlZW4gY3JlYXRlZCBmb3IgYSBzaW5nbGV0b24gbWFwcGluZyEgJyArXG4gICAgICAgICAgICAgICAgICAgICdUaGlzIGlzIGEgc2VyaW91cyBlcnJvciwgcGxlYXNlIGZpbGUgYSBidWcgcmVwb3J0LicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAob2Jqcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBmaW5pc2gobnVsbCwgb2Jqc1swXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBmaW5pc2gobnVsbCwgb2Jqc1swXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdmFyIG9wdHMgPSB7fTtcbiAgICAgICAgb3B0c1t0aGlzLmlkXSA9IGlkT3JDYWxsYmFjaztcbiAgICAgICAgb3B0cy5tYXBwaW5nID0gdGhpcztcbiAgICAgICAgdmFyIG9iaiA9IGNhY2hlLmdldChvcHRzKTtcbiAgICAgICAgaWYgKG9iaikge1xuICAgICAgICAgICAgZmluaXNoKG51bGwsIG9iaik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBkZWxldGUgb3B0cy5tYXBwaW5nO1xuICAgICAgICAgICAgdmFyIHF1ZXJ5ID0gbmV3IFF1ZXJ5KHRoaXMsIG9wdHMpO1xuICAgICAgICAgICAgcXVlcnkuZXhlY3V0ZShmdW5jdGlvbiAoZXJyLCByb3dzKSB7XG4gICAgICAgICAgICAgICAgdmFyIG9iaiA9IG51bGw7XG4gICAgICAgICAgICAgICAgaWYgKCFlcnIgJiYgcm93cy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJvd3MubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXJyID0gJ01vcmUgdGhhbiBvbmUgb2JqZWN0IHdpdGggaWQ9JyArIGlkT3JDYWxsYmFjay50b1N0cmluZygpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgb2JqID0gcm93c1swXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBmaW5pc2goZXJyLCBvYmopO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgIH1cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn07XG5cbk1hcHBpbmcucHJvdG90eXBlLmFsbCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIHZhciBkZWZlcnJlZCA9IHEuZGVmZXIoKTtcbiAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgIHZhciBxdWVyeSA9IG5ldyBRdWVyeSh0aGlzLCB7fSk7XG4gICAgcXVlcnkuZXhlY3V0ZShjYWxsYmFjayk7XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59O1xuXG5NYXBwaW5nLnByb3RvdHlwZS5pbnN0YWxsID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgaWYgKExvZ2dlci5pbmZvLmlzRW5hYmxlZCkgTG9nZ2VyLmluZm8oJ0luc3RhbGxpbmcgbWFwcGluZyAnICsgdGhpcy50eXBlKTtcbiAgICB2YXIgZGVmZXJyZWQgPSBxLmRlZmVyKCk7XG4gICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICBpZiAoIXRoaXMuX2luc3RhbGxlZCkge1xuICAgICAgICB2YXIgZXJyb3JzID0gdGhpcy5fdmFsaWRhdGUoKTtcbiAgICAgICAgdGhpcy5faW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgaWYgKExvZ2dlci5pbmZvLmlzRW5hYmxlZCkge1xuICAgICAgICAgICAgaWYgKGVycm9ycy5sZW5ndGgpIExvZ2dlci5lcnJvcignRXJyb3JzIGluc3RhbGxpbmcgbWFwcGluZyAnICsgdGhpcy50eXBlICsgJzogJyArIGVycm9ycyk7XG4gICAgICAgICAgICBlbHNlIExvZ2dlci5pbmZvKCdJbnN0YWxsZWQgbWFwcGluZyAnICsgdGhpcy50eXBlKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGVycm9ycy5sZW5ndGggPyBlcnJvcnMgOiBudWxsKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IoJ01hcHBpbmcgXCInICsgdGhpcy50eXBlICsgJ1wiIGhhcyBhbHJlYWR5IGJlZW4gaW5zdGFsbGVkJyk7XG4gICAgfVxuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufTtcblxuTWFwcGluZy5wcm90b3R5cGUuX3ZhbGlkYXRlID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBlcnJvcnMgPSBbXTtcbiAgICBpZiAoIXRoaXMudHlwZSkge1xuICAgICAgICBlcnJvcnMucHVzaCgnTXVzdCBzcGVjaWZ5IGEgdHlwZScpO1xuICAgIH1cbiAgICBpZiAoIXRoaXMuY29sbGVjdGlvbikge1xuICAgICAgICBlcnJvcnMucHVzaCgnQSBtYXBwaW5nIG11c3QgYmVsb25nIHRvIGFuIGNvbGxlY3Rpb24nKTtcbiAgICB9XG4gICAgcmV0dXJuIGVycm9ycztcbn07XG5cblxuLyoqXG4gKiBNYXAgZGF0YSBpbnRvIFNpZXN0YS5cbiAqXG4gKiBAcGFyYW0gZGF0YSBSYXcgZGF0YSByZWNlaXZlZCByZW1vdGVseSBvciBvdGhlcndpc2VcbiAqIEBwYXJhbSBjYWxsYmFjayBDYWxsZWQgb25jZSBwb3VjaCBwZXJzaXN0ZW5jZSByZXR1cm5zLlxuICogQHBhcmFtIG92ZXJyaWRlIEZvcmNlIG1hcHBpbmcgdG8gdGhpcyBvYmplY3RcbiAqL1xuTWFwcGluZy5wcm90b3R5cGUubWFwID0gZnVuY3Rpb24gKGRhdGEsIGNhbGxiYWNrLCBvdmVycmlkZSkge1xuICAgIHZhciBkZWZlcnJlZCA9IHEuZGVmZXIoKTtcbiAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgIGlmICh0aGlzLmluc3RhbGxlZCkge1xuICAgICAgICBpZiAodXRpbC5pc0FycmF5KGRhdGEpKSB7XG4gICAgICAgICAgICB0aGlzLl9tYXBCdWxrKGRhdGEsIGNhbGxiYWNrLCBvdmVycmlkZSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9tYXBCdWxrKFtkYXRhXSwgZnVuY3Rpb24gKGVyciwgb2JqZWN0cykge1xuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgICAgICB2YXIgb2JqO1xuICAgICAgICAgICAgICAgICAgICBpZiAob2JqZWN0cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9iamVjdHMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqID0gb2JqZWN0c1swXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIgPyBlcnJbMF0gOiBudWxsLCBvYmopO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sIG92ZXJyaWRlID8gW292ZXJyaWRlXSA6IHVuZGVmaW5lZCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IoJ01hcHBpbmcgbXVzdCBiZSBmdWxseSBpbnN0YWxsZWQgYmVmb3JlIGNyZWF0aW5nIGFueSBtb2RlbHMnKTtcbiAgICB9XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59O1xuXG5NYXBwaW5nLnByb3RvdHlwZS5fbWFwQnVsayA9IGZ1bmN0aW9uIChkYXRhLCBjYWxsYmFjaywgb3ZlcnJpZGUpIHtcbiAgICB2YXIgZGVmZXJyZWQgPSBxLmRlZmVyKCk7XG4gICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICB2YXIgb3B0cyA9IHttYXBwaW5nOiB0aGlzLCBkYXRhOiBkYXRhfTtcbiAgICBpZiAob3ZlcnJpZGUpIG9wdHMub2JqZWN0cyA9IG92ZXJyaWRlO1xuICAgIHZhciBvcCA9IG5ldyBCdWxrTWFwcGluZ09wZXJhdGlvbihvcHRzKTtcbiAgICBvcC5vbkNvbXBsZXRpb24oZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgZXJyID0gb3AuZXJyb3I7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHZhciBvYmplY3RzID0gb3AucmVzdWx0O1xuICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgb2JqZWN0cyk7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBvcC5zdGFydCgpO1xuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufTtcblxuZnVuY3Rpb24gX2NvdW50Q2FjaGUoKSB7XG4gICAgdmFyIGNvbGxDYWNoZSA9IGNhY2hlLl9sb2NhbENhY2hlQnlUeXBlW3RoaXMuY29sbGVjdGlvbl0gfHwge307XG4gICAgdmFyIG1hcHBpbmdDYWNoZSA9IGNvbGxDYWNoZVt0aGlzLnR5cGVdIHx8IHt9O1xuICAgIHJldHVybiBfLnJlZHVjZShPYmplY3Qua2V5cyhtYXBwaW5nQ2FjaGUpLCBmdW5jdGlvbiAobSwgX2lkKSB7XG4gICAgICAgIG1bX2lkXSA9IHt9O1xuICAgICAgICByZXR1cm4gbTtcbiAgICB9LCB7fSk7XG59XG5cbk1hcHBpbmcucHJvdG90eXBlLmNvdW50ID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgdmFyIGRlZmVycmVkID0gcS5kZWZlcigpO1xuICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgdmFyIGhhc2ggPSBfY291bnRDYWNoZS5jYWxsKHRoaXMpO1xuICAgIGlmIChzaWVzdGEuZXh0LnN0b3JhZ2VFbmFibGVkKSB7XG4gICAgICAgIHZhciBwb3VjaCA9IHNpZXN0YS5leHQuc3RvcmFnZS5Qb3VjaC5nZXRQb3VjaCgpO1xuICAgICAgICB2YXIgaW5kZXhOYW1lID0gKG5ldyBzaWVzdGEuZXh0LnN0b3JhZ2UuSW5kZXgodGhpcy5jb2xsZWN0aW9uLCB0aGlzLnR5cGUpKS5fZ2V0TmFtZSgpICsgJ18nO1xuICAgICAgICBwb3VjaC5xdWVyeShpbmRleE5hbWUsIHtpbmNsdWRlX2RvY3M6IGZhbHNlfSwgZnVuY3Rpb24gKGVyciwgcmVzcCkge1xuICAgICAgICAgICAgdmFyIG47XG4gICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgIF8uZWFjaChfLnBsdWNrKHJlc3Aucm93cywgJ2lkJyksIGZ1bmN0aW9uIChpZCkge1xuICAgICAgICAgICAgICAgICAgICBoYXNoW2lkXSA9IHt9O1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIG4gPSBPYmplY3Qua2V5cyhoYXNoKS5sZW5ndGg7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYWxsYmFjayhlcnIsIG4pO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIE9iamVjdC5rZXlzKGhhc2gpLmxlbmd0aClcbiAgICB9XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59O1xuXG4vKipcbiAqIENvbnZlcnQgcmF3IGRhdGEgaW50byBhIFNpZXN0YU1vZGVsXG4gKiBAcmV0dXJucyB7U2llc3RhTW9kZWx9XG4gKiBAcHJpdmF0ZVxuICovXG5NYXBwaW5nLnByb3RvdHlwZS5fbmV3ID0gZnVuY3Rpb24gKGRhdGEpIHtcbiAgICBpZiAodGhpcy5pbnN0YWxsZWQpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICB2YXIgX2lkO1xuICAgICAgICBpZiAoZGF0YSkge1xuICAgICAgICAgICAgX2lkID0gZGF0YS5faWQgPyBkYXRhLl9pZCA6IGd1aWQoKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIF9pZCA9IGd1aWQoKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgbmV3TW9kZWw7XG4gICAgICAgIGlmICh0aGlzLnN1YmNsYXNzKSB7XG4gICAgICAgICAgICBuZXdNb2RlbCA9IG5ldyB0aGlzLnN1YmNsYXNzKHRoaXMpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgbmV3TW9kZWwgPSBuZXcgU2llc3RhTW9kZWwodGhpcyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKExvZ2dlci5pbmZvLmlzRW5hYmxlZClcbiAgICAgICAgICAgIExvZ2dlci5pbmZvKCdOZXcgb2JqZWN0IGNyZWF0ZWQgX2lkPVwiJyArIF9pZC50b1N0cmluZygpICsgJ1wiJywgZGF0YSk7XG4gICAgICAgIG5ld01vZGVsLl9pZCA9IF9pZDtcbiAgICAgICAgLy8gUGxhY2UgYXR0cmlidXRlcyBvbiB0aGUgb2JqZWN0LlxuICAgICAgICBuZXdNb2RlbC5fX3ZhbHVlcyA9IGRhdGEgfHwge307XG4gICAgICAgIHZhciBmaWVsZHMgPSB0aGlzLl9maWVsZHM7XG4gICAgICAgIHZhciBpZHggPSBmaWVsZHMuaW5kZXhPZih0aGlzLmlkKTtcbiAgICAgICAgaWYgKGlkeCA+IC0xKSB7XG4gICAgICAgICAgICBmaWVsZHMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgIH1cbiAgICAgICAgXy5lYWNoKGZpZWxkcywgZnVuY3Rpb24gKGZpZWxkKSB7XG4gICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobmV3TW9kZWwsIGZpZWxkLCB7XG4gICAgICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXdNb2RlbC5fX3ZhbHVlc1tmaWVsZF0gfHwgbnVsbDtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHNldDogZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG9sZCA9IG5ld01vZGVsLl9fdmFsdWVzW2ZpZWxkXTtcbiAgICAgICAgICAgICAgICAgICAgbmV3TW9kZWwuX192YWx1ZXNbZmllbGRdID0gdjtcbiAgICAgICAgICAgICAgICAgICAgY29yZUNoYW5nZXMucmVnaXN0ZXJDaGFuZ2Uoe1xuICAgICAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbjogc2VsZi5jb2xsZWN0aW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWFwcGluZzogc2VsZi50eXBlLFxuICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiBuZXdNb2RlbC5faWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBuZXc6IHYsXG4gICAgICAgICAgICAgICAgICAgICAgICBvbGQ6IG9sZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IENoYW5nZVR5cGUuU2V0LFxuICAgICAgICAgICAgICAgICAgICAgICAgZmllbGQ6IGZpZWxkXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KHYpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB3cmFwQXJyYXkodiwgZmllbGQsIG5ld01vZGVsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobmV3TW9kZWwsIHRoaXMuaWQsIHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXdNb2RlbC5fX3ZhbHVlc1tzZWxmLmlkXSB8fCBudWxsO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNldDogZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgICAgICAgICB2YXIgb2xkID0gbmV3TW9kZWxbc2VsZi5pZF07XG4gICAgICAgICAgICAgICAgbmV3TW9kZWwuX192YWx1ZXNbc2VsZi5pZF0gPSB2O1xuICAgICAgICAgICAgICAgIGNvcmVDaGFuZ2VzLnJlZ2lzdGVyQ2hhbmdlKHtcbiAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbjogc2VsZi5jb2xsZWN0aW9uLFxuICAgICAgICAgICAgICAgICAgICBtYXBwaW5nOiBzZWxmLnR5cGUsXG4gICAgICAgICAgICAgICAgICAgIF9pZDogbmV3TW9kZWwuX2lkLFxuICAgICAgICAgICAgICAgICAgICBuZXc6IHYsXG4gICAgICAgICAgICAgICAgICAgIG9sZDogb2xkLFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiBDaGFuZ2VUeXBlLlNldCxcbiAgICAgICAgICAgICAgICAgICAgZmllbGQ6IHNlbGYuaWRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBjYWNoZS5yZW1vdGVJbnNlcnQobmV3TW9kZWwsIHYsIG9sZCk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgICB9KTtcblxuXG4gICAgICAgIGZvciAodmFyIG5hbWUgaW4gdGhpcy5yZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgICAgICB2YXIgcHJveHk7XG4gICAgICAgICAgICBpZiAodGhpcy5yZWxhdGlvbnNoaXBzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgICAgICAgICAgdmFyIHJlbGF0aW9uc2hpcCA9IHRoaXMucmVsYXRpb25zaGlwc1tuYW1lXTtcbiAgICAgICAgICAgICAgICBpZiAocmVsYXRpb25zaGlwLnR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5PbmVUb01hbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcHJveHkgPSBuZXcgT25lVG9NYW55UHJveHkocmVsYXRpb25zaGlwKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAocmVsYXRpb25zaGlwLnR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5PbmVUb09uZSkge1xuICAgICAgICAgICAgICAgICAgICBwcm94eSA9IG5ldyBPbmVUb09uZVByb3h5KHJlbGF0aW9uc2hpcCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHJlbGF0aW9uc2hpcC50eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuTWFueVRvTWFueSkge1xuICAgICAgICAgICAgICAgICAgICBwcm94eSA9IG5ldyBNYW55VG9NYW55UHJveHkocmVsYXRpb25zaGlwKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IoJ05vIHN1Y2ggcmVsYXRpb25zaGlwIHR5cGU6ICcgKyByZWxhdGlvbnNoaXAudHlwZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcHJveHkuaW5zdGFsbChuZXdNb2RlbCk7XG4gICAgICAgICAgICBwcm94eS5pc0ZhdWx0ID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgY2FjaGUuaW5zZXJ0KG5ld01vZGVsKTtcbiAgICAgICAgcmV0dXJuIG5ld01vZGVsO1xuICAgIH1cblxuICAgIGVsc2Uge1xuICAgICAgICB1dGlsLnByaW50U3RhY2tUcmFjZSgpO1xuICAgICAgICB0aHJvdyBuZXcgUmVzdEVycm9yKCdNYXBwaW5nIG11c3QgYmUgZnVsbHkgaW5zdGFsbGVkIGJlZm9yZSBjcmVhdGluZyBhbnkgbW9kZWxzJyk7XG4gICAgfVxuXG59O1xuXG5NYXBwaW5nLnByb3RvdHlwZS5fZHVtcCA9IGZ1bmN0aW9uIChhc0pTT04pIHtcbiAgICB2YXIgZHVtcGVkID0ge307XG4gICAgZHVtcGVkLm5hbWUgPSB0aGlzLnR5cGU7XG4gICAgZHVtcGVkLmF0dHJpYnV0ZXMgPSB0aGlzLmF0dHJpYnV0ZXM7XG4gICAgZHVtcGVkLmlkID0gdGhpcy5pZDtcbiAgICBkdW1wZWQuY29sbGVjdGlvbiA9IHRoaXMuY29sbGVjdGlvbjtcbiAgICBkdW1wZWQucmVsYXRpb25zaGlwcyA9IF8ubWFwKHRoaXMucmVsYXRpb25zaGlwcywgZnVuY3Rpb24gKHIpIHtcbiAgICAgICAgcmV0dXJuIHIuaXNGb3J3YXJkID8gci5mb3J3YXJkTmFtZSA6IHIucmV2ZXJzZU5hbWU7XG4gICAgfSk7XG4gICAgcmV0dXJuIGFzSlNPTiA/IEpTT04uc3RyaW5naWZ5KGR1bXBlZCwgbnVsbCwgNCkgOiBkdW1wZWQ7XG59O1xuXG5NYXBwaW5nLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gJ01hcHBpbmdbJyArIHRoaXMudHlwZSArICddJztcbn07XG5cbi8qKlxuICogQSBzdWJjbGFzcyBvZiBSZXN0RXJyb3Igc3BlY2lmY2FsbHkgZm9yIGVycm9ycyB0aGF0IG9jY3VyIGR1cmluZyBtYXBwaW5nLlxuICogQHBhcmFtIG1lc3NhZ2VcbiAqIEBwYXJhbSBjb250ZXh0XG4gKiBAcGFyYW0gc3NmXG4gKiBAcmV0dXJucyB7TWFwcGluZ0Vycm9yfVxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIE1hcHBpbmdFcnJvcihtZXNzYWdlLCBjb250ZXh0LCBzc2YpIHtcbiAgICBpZiAoIXRoaXMpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBNYXBwaW5nRXJyb3IobWVzc2FnZSwgY29udGV4dCk7XG4gICAgfVxuXG4gICAgdGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcblxuICAgIHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG4gICAgLy8gY2FwdHVyZSBzdGFjayB0cmFjZVxuICAgIHNzZiA9IHNzZiB8fCBhcmd1bWVudHMuY2FsbGVlO1xuICAgIGlmIChzc2YgJiYgUmVzdEVycm9yLmNhcHR1cmVTdGFja1RyYWNlKSB7XG4gICAgICAgIFJlc3RFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCBzc2YpO1xuICAgIH1cbn1cblxuTWFwcGluZ0Vycm9yLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoUmVzdEVycm9yLnByb3RvdHlwZSk7XG5NYXBwaW5nRXJyb3IucHJvdG90eXBlLm5hbWUgPSAnTWFwcGluZ0Vycm9yJztcbk1hcHBpbmdFcnJvci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBNYXBwaW5nRXJyb3I7XG5cbmZ1bmN0aW9uIGFycmF5QXNTdHJpbmcoYXJyKSB7XG4gICAgdmFyIGFyckNvbnRlbnRzID0gXy5yZWR1Y2UoYXJyLCBmdW5jdGlvbiAobWVtbywgZikge3JldHVybiBtZW1vICsgJ1wiJyArIGYgKyAnXCIsJ30sICcnKTtcbiAgICBhcnJDb250ZW50cyA9IGFyckNvbnRlbnRzLnN1YnN0cmluZygwLCBhcnJDb250ZW50cy5sZW5ndGggLSAxKTtcbiAgICByZXR1cm4gJ1snICsgYXJyQ29udGVudHMgKyAnXSc7XG59XG5cblxuZnVuY3Rpb24gY29uc3RydWN0TWFwRnVuY3Rpb24oY29sbGVjdGlvbiwgdHlwZSwgZmllbGRzKSB7XG4gICAgdmFyIG1hcEZ1bmM7XG4gICAgdmFyIG9ubHlFbXB0eUZpZWxkU2V0U3BlY2lmaWVkID0gKGZpZWxkcy5sZW5ndGggPT0gMSAmJiAhZmllbGRzWzBdLmxlbmd0aCk7XG4gICAgdmFyIG5vRmllbGRTZXRzU3BlY2lmaWVkID0gIWZpZWxkcy5sZW5ndGggfHwgb25seUVtcHR5RmllbGRTZXRTcGVjaWZpZWQ7XG5cbiAgICB2YXIgYXJyID0gYXJyYXlBc1N0cmluZyhmaWVsZHMpO1xuICAgIGlmIChub0ZpZWxkU2V0c1NwZWNpZmllZCkge1xuICAgICAgICBtYXBGdW5jID0gZnVuY3Rpb24gKGRvYykge1xuICAgICAgICAgICAgdmFyIHR5cGUgPSBcIiQyXCI7XG4gICAgICAgICAgICB2YXIgY29sbGVjdGlvbiA9IFwiJDNcIjtcbiAgICAgICAgICAgIGlmIChkb2MudHlwZSA9PSB0eXBlICYmIGRvYy5jb2xsZWN0aW9uID09IGNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICBlbWl0KGRvYy50eXBlLCBkb2MpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LnRvU3RyaW5nKCk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBtYXBGdW5jID0gZnVuY3Rpb24gKGRvYykge1xuICAgICAgICAgICAgdmFyIHR5cGUgPSBcIiQyXCI7XG4gICAgICAgICAgICB2YXIgY29sbGVjdGlvbiA9IFwiJDNcIjtcbiAgICAgICAgICAgIGlmIChkb2MudHlwZSA9PSB0eXBlICYmIGRvYy5jb2xsZWN0aW9uID09IGNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAvL25vaW5zcGVjdGlvbiBKU1VucmVzb2x2ZWRWYXJpYWJsZVxuICAgICAgICAgICAgICAgIHZhciBmaWVsZHMgPSAkMTtcbiAgICAgICAgICAgICAgICB2YXIgYWdnRmllbGQgPSAnJztcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpZHggaW4gZmllbGRzKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vbm9pbnNwZWN0aW9uIEpTVW5maWx0ZXJlZEZvckluTG9vcFxuICAgICAgICAgICAgICAgICAgICB2YXIgZmllbGQgPSBmaWVsZHNbaWR4XTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHZhbHVlID0gZG9jW2ZpZWxkXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHZhbHVlICE9PSBudWxsICYmIHZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFnZ0ZpZWxkICs9IHZhbHVlLnRvU3RyaW5nKCkgKyAnXyc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAodmFsdWUgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFnZ0ZpZWxkICs9ICdudWxsXyc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhZ2dGaWVsZCArPSAndW5kZWZpbmVkXyc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYWdnRmllbGQgPSBhZ2dGaWVsZC5zdWJzdHJpbmcoMCwgYWdnRmllbGQubGVuZ3RoIC0gMSk7XG4gICAgICAgICAgICAgICAgZW1pdChhZ2dGaWVsZCwgZG9jKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfS50b1N0cmluZygpO1xuICAgICAgICBtYXBGdW5jID0gbWFwRnVuYy5yZXBsYWNlKCckMScsIGFycik7XG4gICAgfVxuICAgIG1hcEZ1bmMgPSBtYXBGdW5jLnJlcGxhY2UoJyQyJywgdHlwZSk7XG4gICAgbWFwRnVuYyA9IG1hcEZ1bmMucmVwbGFjZSgnJDMnLCBjb2xsZWN0aW9uKTtcbiAgICByZXR1cm4gbWFwRnVuYztcbn1cblxuXG5mdW5jdGlvbiBjb25zdHJ1Y3RNYXBGdW5jdGlvbjIoY29sbGVjdGlvbiwgdHlwZSwgZmllbGRzKSB7XG4gICAgdmFyIG1hcEZ1bmM7XG4gICAgdmFyIG9ubHlFbXB0eUZpZWxkU2V0U3BlY2lmaWVkID0gKGZpZWxkcy5sZW5ndGggPT0gMSAmJiAhZmllbGRzWzBdLmxlbmd0aCk7XG4gICAgdmFyIG5vRmllbGRTZXRzU3BlY2lmaWVkID0gIWZpZWxkcy5sZW5ndGggfHwgb25seUVtcHR5RmllbGRTZXRTcGVjaWZpZWQ7XG5cbiAgICBpZiAobm9GaWVsZFNldHNTcGVjaWZpZWQpIHtcbiAgICAgICAgbWFwRnVuYyA9IGZ1bmN0aW9uIChkb2MpIHtcbiAgICAgICAgICAgIGlmIChkb2MudHlwZSA9PSB0eXBlICYmIGRvYy5jb2xsZWN0aW9uID09IGNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICBlbWl0KGRvYy50eXBlLCBkb2MpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgbWFwRnVuYyA9IGZ1bmN0aW9uIChkb2MpIHtcbiAgICAgICAgICAgIGlmIChkb2MudHlwZSA9PSB0eXBlICYmIGRvYy5jb2xsZWN0aW9uID09IGNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICB2YXIgYWdnRmllbGQgPSAnJztcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpZHggaW4gZmllbGRzKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vbm9pbnNwZWN0aW9uIEpTVW5maWx0ZXJlZEZvckluTG9vcFxuICAgICAgICAgICAgICAgICAgICB2YXIgZmllbGQgPSBmaWVsZHNbaWR4XTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHZhbHVlID0gZG9jW2ZpZWxkXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHZhbHVlICE9PSBudWxsICYmIHZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFnZ0ZpZWxkICs9IHZhbHVlLnRvU3RyaW5nKCkgKyAnXyc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAodmFsdWUgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFnZ0ZpZWxkICs9ICdudWxsXyc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhZ2dGaWVsZCArPSAndW5kZWZpbmVkXyc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYWdnRmllbGQgPSBhZ2dGaWVsZC5zdWJzdHJpbmcoMCwgYWdnRmllbGQubGVuZ3RoIC0gMSk7XG4gICAgICAgICAgICAgICAgZW1pdChhZ2dGaWVsZCwgZG9jKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIG1hcEZ1bmM7XG59XG5cbmV4cG9ydHMuTWFwcGluZyA9IE1hcHBpbmc7XG5leHBvcnRzLk1hcHBpbmdFcnJvciA9IE1hcHBpbmdFcnJvcjtcbmV4cG9ydHMuY29uc3RydWN0TWFwRnVuY3Rpb24yID0gY29uc3RydWN0TWFwRnVuY3Rpb24yO1xuZXhwb3J0cy5jb25zdHJ1Y3RNYXBGdW5jdGlvbiA9IGNvbnN0cnVjdE1hcEZ1bmN0aW9uOyIsInZhciBTdG9yZSA9IHJlcXVpcmUoJy4vc3RvcmUnKTtcbnZhciBTaWVzdGFNb2RlbCA9IHJlcXVpcmUoJy4vb2JqZWN0JykuU2llc3RhTW9kZWw7XG52YXIgbG9nID0gcmVxdWlyZSgnLi4vdmVuZG9yL29wZXJhdGlvbnMuanMvc3JjL2xvZycpO1xudmFyIE9wZXJhdGlvbiA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vcGVyYXRpb25zLmpzL3NyYy9vcGVyYXRpb24nKS5PcGVyYXRpb247XG52YXIgUmVzdEVycm9yID0gcmVxdWlyZSgnLi4vc3JjL2Vycm9yJykuUmVzdEVycm9yO1xudmFyIFF1ZXJ5ID0gcmVxdWlyZSgnLi9xdWVyeScpLlF1ZXJ5O1xuXG52YXIgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKCdNYXBwaW5nT3BlcmF0aW9uJyk7XG5Mb2dnZXIuc2V0TGV2ZWwobG9nLkxldmVsLnRyYWNlKTtcblxuXG52YXIgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyk7XG52YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpO1xudmFyIF8gPSB1dGlsLl87XG52YXIgZGVmaW5lU3ViUHJvcGVydHkgPSByZXF1aXJlKCcuL21pc2MnKS5kZWZpbmVTdWJQcm9wZXJ0eTtcbnZhciBDaGFuZ2VUeXBlID0gcmVxdWlyZSgnLi9jaGFuZ2VzJykuQ2hhbmdlVHlwZTtcbnZhciBxID0gcmVxdWlyZSgncScpO1xuXG5mdW5jdGlvbiBmbGF0dGVuQXJyYXkoYXJyKSB7XG4gICAgcmV0dXJuIF8ucmVkdWNlKGFyciwgZnVuY3Rpb24gKG1lbW8sIGUpIHtcbiAgICAgICAgaWYgKHV0aWwuaXNBcnJheShlKSkge1xuICAgICAgICAgICAgbWVtbyA9IG1lbW8uY29uY2F0KGUpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgbWVtby5wdXNoKGUpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtZW1vO1xuICAgIH0sIFtdKTtcbn1cblxuZnVuY3Rpb24gdW5mbGF0dGVuQXJyYXkoYXJyLCBtb2RlbEFycikge1xuICAgIHZhciBuID0gMDtcbiAgICB2YXIgdW5mbGF0dGVuZWQgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG1vZGVsQXJyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmICh1dGlsLmlzQXJyYXkobW9kZWxBcnJbaV0pKSB7XG4gICAgICAgICAgICB2YXIgbmV3QXJyID0gW107XG4gICAgICAgICAgICB1bmZsYXR0ZW5lZFtpXSA9IG5ld0FycjtcbiAgICAgICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgbW9kZWxBcnJbaV0ubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICBuZXdBcnIucHVzaChhcnJbbl0pO1xuICAgICAgICAgICAgICAgIG4rKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHVuZmxhdHRlbmVkW2ldID0gYXJyW25dO1xuICAgICAgICAgICAgbisrO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiB1bmZsYXR0ZW5lZDtcbn1cblxuZnVuY3Rpb24gQnVsa01hcHBpbmdPcGVyYXRpb24ob3B0cykge1xuICAgIE9wZXJhdGlvbi5jYWxsKHRoaXMpO1xuXG4gICAgdGhpcy5fb3B0cyA9IG9wdHM7XG5cbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdtYXBwaW5nJywgdGhpcy5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnZGF0YScsIHRoaXMuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ29iamVjdHMnLCB0aGlzLl9vcHRzKTtcbiAgICBpZiAoIXRoaXMub2JqZWN0cykgdGhpcy5vYmplY3RzID0gW107XG5cbiAgICB0aGlzLmVycm9ycyA9IFtdO1xuICAgIHRoaXMubmFtZSA9ICdNYXBwaW5nIE9wZXJhdGlvbic7XG4gICAgdGhpcy53b3JrID0gXy5iaW5kKHRoaXMuX3N0YXJ0LCB0aGlzKTtcblxuICAgIHRoaXMuc3ViT3BzID0ge307XG59XG5cbkJ1bGtNYXBwaW5nT3BlcmF0aW9uLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoT3BlcmF0aW9uLnByb3RvdHlwZSk7XG5cbmZ1bmN0aW9uIG1hcEF0dHJpYnV0ZXMoKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGRhdHVtID0gdGhpcy5kYXRhW2ldO1xuICAgICAgICB2YXIgb2JqZWN0ID0gdGhpcy5vYmplY3RzW2ldO1xuICAgICAgICAvLyBObyBwb2ludCBtYXBwaW5nIG9iamVjdCBvbnRvIGl0c2VsZi4gVGhpcyBoYXBwZW5zIGlmIGEgU2llc3RhTW9kZWwgaXMgcGFzc2VkIGFzIGEgcmVsYXRpb25zaGlwLlxuICAgICAgICBpZiAoZGF0dW0gIT0gb2JqZWN0KSB7XG4gICAgICAgICAgICBpZiAob2JqZWN0KSB7IC8vIElmIG9iamVjdCBpcyBmYWxzeSwgdGhlbiB0aGVyZSB3YXMgYW4gZXJyb3IgbG9va2luZyB1cCB0aGF0IG9iamVjdC9jcmVhdGluZyBpdC5cbiAgICAgICAgICAgICAgICB2YXIgZmllbGRzID0gdGhpcy5tYXBwaW5nLl9maWVsZHM7XG4gICAgICAgICAgICAgICAgXy5lYWNoKGZpZWxkcywgZnVuY3Rpb24gKGYpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRhdHVtW2ZdICE9PSB1bmRlZmluZWQpIHsgLy8gbnVsbCBpcyBmaW5lXG4gICAgICAgICAgICAgICAgICAgICAgICBvYmplY3RbZl0gPSBkYXR1bVtmXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5cbkJ1bGtNYXBwaW5nT3BlcmF0aW9uLnByb3RvdHlwZS5fbWFwID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBtYXBBdHRyaWJ1dGVzLmNhbGwodGhpcyk7XG4gICAgdmFyIHJlbGF0aW9uc2hpcEZpZWxkcyA9IF8ua2V5cyhzZWxmLnN1Yk9wcyk7XG4gICAgXy5lYWNoKHJlbGF0aW9uc2hpcEZpZWxkcywgZnVuY3Rpb24gKGYpIHtcbiAgICAgICAgdmFyIG9wID0gc2VsZi5zdWJPcHNbZl0ub3A7XG4gICAgICAgIHZhciBpbmRleGVzID0gc2VsZi5zdWJPcHNbZl0uaW5kZXhlcztcbiAgICAgICAgdmFyIHJlbGF0ZWREYXRhID0gZ2V0UmVsYXRlZERhdGEuY2FsbChzZWxmLCBmKS5yZWxhdGVkRGF0YTtcbiAgICAgICAgdmFyIHVuZmxhdHRlbmVkT2JqZWN0cyA9IHVuZmxhdHRlbkFycmF5KG9wLm9iamVjdHMsIHJlbGF0ZWREYXRhKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB1bmZsYXR0ZW5lZE9iamVjdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBpZHggPSBpbmRleGVzW2ldO1xuICAgICAgICAgICAgLy8gRXJyb3JzIGFyZSBwbHVja2VkIGZyb20gdGhlIHN1Ym9wZXJhdGlvbnMuXG4gICAgICAgICAgICB2YXIgZXJyb3IgPSBzZWxmLmVycm9yc1tpZHhdO1xuICAgICAgICAgICAgdmFyIGVyciA9IGVycm9yID8gZXJyb3JbZl0gOiBudWxsO1xuICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICB2YXIgcmVsYXRlZCA9IHVuZmxhdHRlbmVkT2JqZWN0c1tpXTsgLy8gQ2FuIGJlIGFycmF5IG9yIHNjYWxhci5cbiAgICAgICAgICAgICAgICB2YXIgb2JqZWN0ID0gc2VsZi5vYmplY3RzW2lkeF07XG4gICAgICAgICAgICAgICAgaWYgKG9iamVjdCkge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0W2ZdID0gcmVsYXRlZDtcbi8vICAgICAgICAgICAgICAgICAgICAgICAgcmVnaXN0ZXJSZWxhdGlvbnNoaXBDaGFuZ2Uob2JqZWN0LCBmLCByZWxhdGVkKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyIGluc3RhbmNlb2YgUmVzdEVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFzZWxmLmVycm9yc1tpZHhdKSBzZWxmLmVycm9yc1tpZHhdID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5lcnJvcnNbaWR4XVtmXSA9IGVyci5tZXNzYWdlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG4vKipcbiAqIEZvciBpbmRpY2VzIHdoZXJlIG5vIG9iamVjdCBpcyBwcmVzZW50LCBwZXJmb3JtIGxvb2t1cHMsIGNyZWF0aW5nIGEgbmV3IG9iamVjdCBpZiBuZWNlc3NhcnkuXG4gKiBAcHJpdmF0ZVxuICovXG5CdWxrTWFwcGluZ09wZXJhdGlvbi5wcm90b3R5cGUuX2xvb2t1cCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIHZhciBkZWZlcnJlZCA9IHEuZGVmZXIoKTtcbiAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgcmVtb3RlTG9va3VwcyA9IFtdO1xuICAgIHZhciBsb2NhbExvb2t1cHMgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoIXRoaXMub2JqZWN0c1tpXSkge1xuICAgICAgICAgICAgdmFyIGxvb2t1cDtcbiAgICAgICAgICAgIHZhciBkYXR1bSA9IHRoaXMuZGF0YVtpXTtcbiAgICAgICAgICAgIHZhciBpc1NjYWxhciA9IHR5cGVvZiBkYXR1bSA9PSAnc3RyaW5nJyB8fCB0eXBlb2YgZGF0dW0gPT0gJ251bWJlcicgfHwgZGF0dW0gaW5zdGFuY2VvZiBTdHJpbmc7XG4gICAgICAgICAgICBpZiAoaXNTY2FsYXIpIHtcbiAgICAgICAgICAgICAgICBsb29rdXAgPSB7aW5kZXg6IGksIGRhdHVtOiB7fX07XG4gICAgICAgICAgICAgICAgbG9va3VwLmRhdHVtW3NlbGYubWFwcGluZy5pZF0gPSBkYXR1bTtcbiAgICAgICAgICAgICAgICByZW1vdGVMb29rdXBzLnB1c2gobG9va3VwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRhdHVtIGluc3RhbmNlb2YgU2llc3RhTW9kZWwpIHsgLy8gV2Ugd29uJ3QgbmVlZCB0byBwZXJmb3JtIGFueSBtYXBwaW5nLlxuICAgICAgICAgICAgICAgIHRoaXMub2JqZWN0c1tpXSA9IGRhdHVtO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZGF0dW0uX2lkKSB7XG4gICAgICAgICAgICAgICAgbG9jYWxMb29rdXBzLnB1c2goe2luZGV4OiBpLCBkYXR1bTogZGF0dW19KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRhdHVtW3NlbGYubWFwcGluZy5pZF0pIHtcbiAgICAgICAgICAgICAgICByZW1vdGVMb29rdXBzLnB1c2goe2luZGV4OiBpLCBkYXR1bTogZGF0dW19KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMub2JqZWN0c1tpXSA9IHNlbGYubWFwcGluZy5fbmV3KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgdXRpbC5wYXJhbGxlbChbXG4gICAgICAgICAgICBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICB2YXIgbG9jYWxJZGVudGlmaWVycyA9IF8ucGx1Y2soXy5wbHVjayhsb2NhbExvb2t1cHMsICdkYXR1bScpLCAnX2lkJyk7XG4gICAgICAgICAgICAgICAgaWYgKGxvY2FsSWRlbnRpZmllcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIFN0b3JlLmdldE11bHRpcGxlTG9jYWwobG9jYWxJZGVudGlmaWVycywgZnVuY3Rpb24gKGVyciwgb2JqZWN0cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxvY2FsSWRlbnRpZmllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG9iaiA9IG9iamVjdHNbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBfaWQgPSBsb2NhbElkZW50aWZpZXJzW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbG9va3VwID0gbG9jYWxMb29rdXBzW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIW9iaikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5lcnJvcnNbbG9va3VwLmluZGV4XSA9IHtfaWQ6ICdObyBvYmplY3Qgd2l0aCBfaWQ9XCInICsgX2lkLnRvU3RyaW5nKCkgKyAnXCInfTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYub2JqZWN0c1tsb29rdXAuaW5kZXhdID0gb2JqO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICB2YXIgcmVtb3RlSWRlbnRpZmllcnMgPSBfLnBsdWNrKF8ucGx1Y2socmVtb3RlTG9va3VwcywgJ2RhdHVtJyksIHNlbGYubWFwcGluZy5pZCk7XG4gICAgICAgICAgICAgICAgaWYgKHJlbW90ZUlkZW50aWZpZXJzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoTG9nZ2VyLnRyYWNlLmlzRW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgICAgIExvZ2dlci50cmFjZSgnTG9va2luZyB1cCByZW1vdGVJZGVudGlmaWVyczogJyArIEpTT04uc3RyaW5naWZ5KHJlbW90ZUlkZW50aWZpZXJzLCBudWxsLCA0KSk7XG4gICAgICAgICAgICAgICAgICAgIFN0b3JlLmdldE11bHRpcGxlUmVtb3RlKHJlbW90ZUlkZW50aWZpZXJzLCBzZWxmLm1hcHBpbmcsIGZ1bmN0aW9uIChlcnIsIG9iamVjdHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKExvZ2dlci50cmFjZS5pc0VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlc3VsdHMgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IG9iamVjdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdHNbcmVtb3RlSWRlbnRpZmllcnNbaV1dID0gb2JqZWN0c1tpXSA/IG9iamVjdHNbaV0uX2lkIDogbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBMb2dnZXIudHJhY2UoJ1Jlc3VsdHMgZm9yIHJlbW90ZUlkZW50aWZpZXJzOiAnICsgSlNPTi5zdHJpbmdpZnkocmVzdWx0cywgbnVsbCwgNCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgb2JqZWN0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgb2JqID0gb2JqZWN0c1tpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGxvb2t1cCA9IHJlbW90ZUxvb2t1cHNbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvYmopIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYub2JqZWN0c1tsb29rdXAuaW5kZXhdID0gb2JqO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGRhdGEgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciByZW1vdGVJZCA9IHJlbW90ZUlkZW50aWZpZXJzW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVtzZWxmLm1hcHBpbmcuaWRdID0gcmVtb3RlSWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgY2FjaGVRdWVyeSA9IHttYXBwaW5nOiBzZWxmLm1hcHBpbmd9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FjaGVRdWVyeVtzZWxmLm1hcHBpbmcuaWRdID0gcmVtb3RlSWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgY2FjaGVkID0gY2FjaGUuZ2V0KGNhY2hlUXVlcnkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNhY2hlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYub2JqZWN0c1tsb29rdXAuaW5kZXhdID0gY2FjaGVkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5vYmplY3RzW2xvb2t1cC5pbmRleF0gPSBzZWxmLm1hcHBpbmcuX25ldygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEl0J3MgaW1wb3J0YW50IHRoYXQgd2UgbWFwIHRoZSByZW1vdGUgaWRlbnRpZmllciBoZXJlIHRvIGVuc3VyZSB0aGF0IGl0IGVuZHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB1cCBpbiB0aGUgY2FjaGUuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5vYmplY3RzW2xvb2t1cC5pbmRleF1bc2VsZi5tYXBwaW5nLmlkXSA9IHJlbW90ZUlkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgXSxcbiAgICAgICAgY2FsbGJhY2spO1xuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufTtcblxuQnVsa01hcHBpbmdPcGVyYXRpb24ucHJvdG90eXBlLl9sb29rdXBTaW5nbGV0b24gPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICB2YXIgZGVmZXJyZWQgPSBxLmRlZmVyKCk7XG4gICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGNhY2hlZFNpbmdsZXRvbiA9IGNhY2hlLmdldCh7bWFwcGluZzogdGhpcy5tYXBwaW5nfSk7XG4gICAgaWYgKCFjYWNoZWRTaW5nbGV0b24pIHtcbiAgICAgICAgdmFyIHF1ZXJ5ID0gbmV3IFF1ZXJ5KHRoaXMubWFwcGluZyk7XG4gICAgICAgIHF1ZXJ5LmV4ZWN1dGUoZnVuY3Rpb24gKGVyciwgb2Jqcykge1xuICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICB2YXIgb2JqO1xuICAgICAgICAgICAgICAgIGlmIChvYmpzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAob2Jqcy5sZW5ndGggPT0gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgb2JqID0gb2Jqc1swXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgb2JqID0gc2VsZi5tYXBwaW5nLl9uZXcoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzZWxmLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5vYmplY3RzW2ldID0gb2JqO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzZWxmLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHNlbGYub2JqZWN0c1tpXSA9IGNhY2hlZFNpbmdsZXRvbjtcbiAgICAgICAgfVxuICAgICAgICBjYWxsYmFjaygpO1xuICAgIH1cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn07XG5cblxuQnVsa01hcHBpbmdPcGVyYXRpb24ucHJvdG90eXBlLl9zdGFydCA9IGZ1bmN0aW9uIChkb25lKSB7XG4gICAgaWYgKHRoaXMuZGF0YS5sZW5ndGgpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICB2YXIgdGFza3MgPSBbXTtcbiAgICAgICAgdmFyIGxvb2t1cEZ1bmMgPSB0aGlzLm1hcHBpbmcuc2luZ2xldG9uID8gdGhpcy5fbG9va3VwU2luZ2xldG9uIDogdGhpcy5fbG9va3VwO1xuICAgICAgICB0YXNrcy5wdXNoKF8uYmluZChsb29rdXBGdW5jLCB0aGlzKSk7XG4gICAgICAgIHRhc2tzLnB1c2goXy5iaW5kKHRoaXMuX2V4ZWN1dGVTdWJPcGVyYXRpb25zLCB0aGlzKSk7XG4gICAgICAgIHV0aWwucGFyYWxsZWwodGFza3MsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHNlbGYuX21hcCgpO1xuICAgICAgICAgICAgZG9uZShzZWxmLmVycm9ycy5sZW5ndGggPyBzZWxmLmVycm9ycyA6IG51bGwsIHNlbGYub2JqZWN0cyk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgZG9uZShudWxsLCBbXSk7XG4gICAgfVxufTtcblxuZnVuY3Rpb24gZ2V0UmVsYXRlZERhdGEobmFtZSkge1xuICAgIHZhciBpbmRleGVzID0gW107XG4gICAgdmFyIHJlbGF0ZWREYXRhID0gW107XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGRhdHVtID0gdGhpcy5kYXRhW2ldO1xuICAgICAgICBpZiAoZGF0dW1bbmFtZV0pIHtcbiAgICAgICAgICAgIGluZGV4ZXMucHVzaChpKTtcbiAgICAgICAgICAgIHJlbGF0ZWREYXRhLnB1c2goZGF0dW1bbmFtZV0pO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7aW5kZXhlczogaW5kZXhlcywgcmVsYXRlZERhdGE6IHJlbGF0ZWREYXRhfTtcbn1cblxuQnVsa01hcHBpbmdPcGVyYXRpb24ucHJvdG90eXBlLl9jb25zdHJ1Y3RTdWJPcGVyYXRpb25zID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBzdWJPcHMgPSB0aGlzLnN1Yk9wcztcbiAgICB2YXIgcmVsYXRpb25zaGlwcyA9IHRoaXMubWFwcGluZy5yZWxhdGlvbnNoaXBzO1xuICAgIGZvciAodmFyIG5hbWUgaW4gcmVsYXRpb25zaGlwcykge1xuICAgICAgICBpZiAocmVsYXRpb25zaGlwcy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICAgICAgdmFyIHJlbGF0aW9uc2hpcCA9IHJlbGF0aW9uc2hpcHNbbmFtZV07XG4gICAgICAgICAgICB2YXIgcmV2ZXJzZU1hcHBpbmcgPSByZWxhdGlvbnNoaXAuZm9yd2FyZE5hbWUgPT0gbmFtZSA/IHJlbGF0aW9uc2hpcC5yZXZlcnNlTWFwcGluZyA6IHJlbGF0aW9uc2hpcC5mb3J3YXJkTWFwcGluZztcbiAgICAgICAgICAgIHZhciBfX3JldCA9IGdldFJlbGF0ZWREYXRhLmNhbGwodGhpcywgbmFtZSk7XG4gICAgICAgICAgICB2YXIgaW5kZXhlcyA9IF9fcmV0LmluZGV4ZXM7XG4gICAgICAgICAgICB2YXIgcmVsYXRlZERhdGEgPSBfX3JldC5yZWxhdGVkRGF0YTtcbiAgICAgICAgICAgIGlmIChyZWxhdGVkRGF0YS5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB2YXIgZmxhdFJlbGF0ZWREYXRhID0gZmxhdHRlbkFycmF5KHJlbGF0ZWREYXRhKTtcbiAgICAgICAgICAgICAgICB2YXIgb3AgPSBuZXcgQnVsa01hcHBpbmdPcGVyYXRpb24oe21hcHBpbmc6IHJldmVyc2VNYXBwaW5nLCBkYXRhOiBmbGF0UmVsYXRlZERhdGF9KTtcbiAgICAgICAgICAgICAgICBvcC5fX3JlbGF0aW9uc2hpcE5hbWUgPSBuYW1lO1xuICAgICAgICAgICAgICAgIHN1Yk9wc1tuYW1lXSA9IHtvcDogb3AsIGluZGV4ZXM6IGluZGV4ZXN9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufTtcblxuZnVuY3Rpb24gZ2F0aGVyRXJyb3JzRnJvbVN1Yk9wZXJhdGlvbnMoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciByZWxhdGlvbnNoaXBOYW1lcyA9IF8ua2V5cyh0aGlzLnN1Yk9wcyk7XG4gICAgXy5lYWNoKHJlbGF0aW9uc2hpcE5hbWVzLCBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgICB2YXIgb3AgPSBzZWxmLnN1Yk9wc1tuYW1lXS5vcDtcbiAgICAgICAgdmFyIGluZGV4ZXMgPSBzZWxmLnN1Yk9wc1tuYW1lXS5pbmRleGVzO1xuICAgICAgICB2YXIgZXJyb3JzID0gb3AuZXJyb3JzO1xuICAgICAgICBpZiAoZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgdmFyIHJlbGF0ZWREYXRhID0gZ2V0UmVsYXRlZERhdGEuY2FsbChzZWxmLCBuYW1lKS5yZWxhdGVkRGF0YTtcbiAgICAgICAgICAgIHZhciB1bmZsYXR0ZW5lZEVycm9ycyA9IHVuZmxhdHRlbkFycmF5KGVycm9ycywgcmVsYXRlZERhdGEpO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB1bmZsYXR0ZW5lZEVycm9ycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBpZHggPSBpbmRleGVzW2ldO1xuICAgICAgICAgICAgICAgIHZhciBlcnIgPSB1bmZsYXR0ZW5lZEVycm9yc1tpXTtcbiAgICAgICAgICAgICAgICB2YXIgaXNFcnJvciA9IGVycjtcbiAgICAgICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KGVycikpIGlzRXJyb3IgPSBfLnJlZHVjZShlcnIsIGZ1bmN0aW9uIChtZW1vLCB4KSB7cmV0dXJuIG1lbW8gfHwgeH0sIGZhbHNlKTtcbiAgICAgICAgICAgICAgICBpZiAoaXNFcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXNlbGYuZXJyb3JzW2lkeF0pIHNlbGYuZXJyb3JzW2lkeF0gPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5lcnJvcnNbaWR4XVtuYW1lXSA9IGVycjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxuQnVsa01hcHBpbmdPcGVyYXRpb24ucHJvdG90eXBlLl9leGVjdXRlU3ViT3BlcmF0aW9ucyA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB0aGlzLl9jb25zdHJ1Y3RTdWJPcGVyYXRpb25zKCk7XG4gICAgdmFyIHJlbGF0aW9uc2hpcE5hbWVzID0gXy5rZXlzKHRoaXMuc3ViT3BzKTtcbiAgICBpZiAocmVsYXRpb25zaGlwTmFtZXMubGVuZ3RoKSB7XG4gICAgICAgIHZhciBzdWJPcGVyYXRpb25zID0gXy5tYXAocmVsYXRpb25zaGlwTmFtZXMsIGZ1bmN0aW9uIChrKSB7IHJldHVybiBzZWxmLnN1Yk9wc1trXS5vcH0pO1xuICAgICAgICB2YXIgY29tcG9zaXRlT3BlcmF0aW9uID0gbmV3IE9wZXJhdGlvbihzdWJPcGVyYXRpb25zKTtcbiAgICAgICAgY29tcG9zaXRlT3BlcmF0aW9uLm9uQ29tcGxldGlvbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBnYXRoZXJFcnJvcnNGcm9tU3ViT3BlcmF0aW9ucy5jYWxsKHNlbGYsIHJlbGF0aW9uc2hpcE5hbWVzKTtcbiAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgIH0pO1xuICAgICAgICBjb21wb3NpdGVPcGVyYXRpb24uc3RhcnQoKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGNhbGxiYWNrKCk7XG4gICAgfVxufTtcblxuZXhwb3J0cy5CdWxrTWFwcGluZ09wZXJhdGlvbiA9IEJ1bGtNYXBwaW5nT3BlcmF0aW9uO1xuZXhwb3J0cy5mbGF0dGVuQXJyYXkgPSBmbGF0dGVuQXJyYXk7XG5leHBvcnRzLnVuZmxhdHRlbkFycmF5ID0gdW5mbGF0dGVuQXJyYXk7IiwidmFyIFJlc3RFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5SZXN0RXJyb3I7XG5cbmZ1bmN0aW9uIGFzc2VydChjb25kaXRpb24sIG1lc3NhZ2UsIGNvbnRleHQpIHtcbiAgICBpZiAoIWNvbmRpdGlvbikge1xuICAgICAgICBtZXNzYWdlID0gbWVzc2FnZSB8fCBcIkFzc2VydGlvbiBmYWlsZWRcIjtcbiAgICAgICAgY29udGV4dCA9IGNvbnRleHQgfHwge307XG4gICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IobWVzc2FnZSwgY29udGV4dCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkZWZpbmVTdWJQcm9wZXJ0eSAocHJvcGVydHksIHN1Yk9iaiwgaW5uZXJQcm9wZXJ0eSkge1xuICAgIHJldHVybiBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgcHJvcGVydHksIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoaW5uZXJQcm9wZXJ0eSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzdWJPYmpbaW5uZXJQcm9wZXJ0eV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3ViT2JqW3Byb3BlcnR5XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgIGlmIChpbm5lclByb3BlcnR5KSB7XG4gICAgICAgICAgICAgICAgc3ViT2JqW2lubmVyUHJvcGVydHldID0gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBzdWJPYmpbcHJvcGVydHldID0gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pO1xufVxuXG52YXIgZ3VpZCA9IChmdW5jdGlvbiAoKSB7XG4gICAgZnVuY3Rpb24gczQoKSB7XG4gICAgICAgIHJldHVybiBNYXRoLmZsb29yKCgxICsgTWF0aC5yYW5kb20oKSkgKiAweDEwMDAwKVxuICAgICAgICAgICAgLnRvU3RyaW5nKDE2KVxuICAgICAgICAgICAgLnN1YnN0cmluZygxKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gczQoKSArIHM0KCkgKyAnLScgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArXG4gICAgICAgICAgICBzNCgpICsgJy0nICsgczQoKSArIHM0KCkgKyBzNCgpO1xuICAgIH07XG59KSgpO1xuXG5mdW5jdGlvbiB3cmFwcGVkQ2FsbGJhY2sgKGNhbGxiYWNrKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIChlcnIsIHJlcykge1xuICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGVyciwgcmVzKTtcbiAgICB9XG59XG5cbmV4cG9ydHMuYXNzZXJ0ID0gYXNzZXJ0O1xuZXhwb3J0cy5kZWZpbmVTdWJQcm9wZXJ0eSA9IGRlZmluZVN1YlByb3BlcnR5O1xuZXhwb3J0cy5ndWlkID0gZ3VpZDtcbmV4cG9ydHMud3JhcHBlZENhbGxiYWNrID0gd3JhcHBlZENhbGxiYWNrOyIsInZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG52YXIgbm90aWZpY2F0aW9uQ2VudHJlID0gbmV3IEV2ZW50RW1pdHRlcigpO1xubm90aWZpY2F0aW9uQ2VudHJlLnNldE1heExpc3RlbmVycygxMDApO1xudmFyIEFycmF5T2JzZXJ2ZXIgPSByZXF1aXJlKCcuLi92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZScpLkFycmF5T2JzZXJ2ZXI7XG52YXIgY29yZUNoYW5nZXMgPSByZXF1aXJlKCcuL2NoYW5nZXMnKTtcbnZhciBDaGFuZ2VUeXBlID0gY29yZUNoYW5nZXMuQ2hhbmdlVHlwZTtcbnZhciBsb2cgPSByZXF1aXJlKCcuLi92ZW5kb3Ivb3BlcmF0aW9ucy5qcy9zcmMvbG9nJyk7XG5cblxuLy8vKipcbi8vICogV3JhcHMgdGhlIG1ldGhvZHMgb2YgYSBqYXZhc2NyaXB0IGFycmF5IG9iamVjdCBzbyB0aGF0IG5vdGlmaWNhdGlvbnMgYXJlIHNlbnRcbi8vICogb24gY2FsbHMuXG4vLyAqXG4vLyAqIEBwYXJhbSBhcnJheSB0aGUgYXJyYXkgd2UgaGF2ZSB3cmFwcGluZ1xuLy8gKiBAcGFyYW0gZmllbGQgbmFtZSBvZiB0aGUgZmllbGRcbi8vICogQHBhcmFtIHJlc3RPYmplY3QgdGhlIG9iamVjdCB0byB3aGljaCB0aGlzIGFycmF5IGlzIGEgcHJvcGVydHlcbi8vICovXG4vL1xuXG5mdW5jdGlvbiB3cmFwQXJyYXkoYXJyYXksIGZpZWxkLCBzaWVzdGFNb2RlbCkge1xuICAgIGlmICghYXJyYXkub2JzZXJ2ZXIpIHtcbiAgICAgICAgYXJyYXkub2JzZXJ2ZXIgPSBuZXcgQXJyYXlPYnNlcnZlcihhcnJheSk7XG4gICAgICAgIGFycmF5Lm9ic2VydmVyLm9wZW4oZnVuY3Rpb24gKHNwbGljZXMpIHtcbiAgICAgICAgICAgIHZhciBmaWVsZElzQXR0cmlidXRlID0gc2llc3RhTW9kZWwuX2ZpZWxkcy5pbmRleE9mKGZpZWxkKSA+IC0xO1xuICAgICAgICAgICAgaWYgKGZpZWxkSXNBdHRyaWJ1dGUpIHtcbiAgICAgICAgICAgICAgICBzcGxpY2VzLmZvckVhY2goZnVuY3Rpb24gKHNwbGljZSkge1xuICAgICAgICAgICAgICAgICAgICBjb3JlQ2hhbmdlcy5yZWdpc3RlckNoYW5nZSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBzaWVzdGFNb2RlbC5jb2xsZWN0aW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWFwcGluZzogc2llc3RhTW9kZWwubWFwcGluZy50eXBlLFxuICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiBzaWVzdGFNb2RlbC5faWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBpbmRleDogc3BsaWNlLmluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlZDogc3BsaWNlLnJlbW92ZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBhZGRlZDogc3BsaWNlLmFkZGVkQ291bnQgPyBhcnJheS5zbGljZShzcGxpY2UuaW5kZXgsIHNwbGljZS5pbmRleCtzcGxpY2UuYWRkZWRDb3VudCkgOiBbXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IGNvcmVDaGFuZ2VzLkNoYW5nZVR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmllbGQ6IGZpZWxkXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgYXJyYXkuaXNGYXVsdCA9IGZhbHNlO1xuICAgIH1cbn1cblxuXG5cbmV4cG9ydHMubm90aWZpY2F0aW9uQ2VudHJlID0gbm90aWZpY2F0aW9uQ2VudHJlO1xuZXhwb3J0cy53cmFwQXJyYXkgPSB3cmFwQXJyYXk7XG4iLCJ2YXIgbG9nID0gcmVxdWlyZSgnLi4vdmVuZG9yL29wZXJhdGlvbnMuanMvc3JjL2xvZycpO1xudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnU2llc3RhTW9kZWwnKTtcbkxvZ2dlci5zZXRMZXZlbChsb2cuTGV2ZWwud2Fybik7XG5cbnZhciBkZWZpbmVTdWJQcm9wZXJ0eSA9IHJlcXVpcmUoJy4vbWlzYycpLmRlZmluZVN1YlByb3BlcnR5O1xuLy92YXIgT3BlcmF0aW9uUXVldWUgPSByZXF1aXJlKCcuLi92ZW5kb3Ivb3BlcmF0aW9ucy5qcy9zcmMvcXVldWUnKS5PcGVyYXRpb25RdWV1ZTtcbnZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XG52YXIgXyA9IHV0aWwuXztcbnZhciBlcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKTtcbnZhciBSZXN0RXJyb3IgPSBlcnJvci5SZXN0RXJyb3I7XG5cbnZhciBxID0gcmVxdWlyZSgncScpO1xuXG4vL3ZhciBxdWV1ZXMgPSB7fTtcblxuZnVuY3Rpb24gU2llc3RhTW9kZWwobWFwcGluZykge1xuXG4gICAgaWYgKCF0aGlzKSB7XG4gICAgICAgIHJldHVybiBuZXcgU2llc3RhTW9kZWwobWFwcGluZyk7XG4gICAgfVxuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB0aGlzLm1hcHBpbmcgPSBtYXBwaW5nO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnaWRGaWVsZCcsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gc2VsZi5tYXBwaW5nLmlkID8gc2VsZi5tYXBwaW5nLmlkIDogJ2lkJztcbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAndHlwZScsIHRoaXMubWFwcGluZyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnY29sbGVjdGlvbicsIHRoaXMubWFwcGluZyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnX2ZpZWxkcycsIHRoaXMubWFwcGluZyk7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdfcmVsYXRpb25zaGlwRmllbGRzJywge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBfLm1hcChzZWxmLl9wcm94aWVzLCBmdW5jdGlvbiAocCkge1xuICAgICAgICAgICAgICAgIGlmIChwLmlzRm9yd2FyZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcC5mb3J3YXJkTmFtZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBwLnJldmVyc2VOYW1lO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcblxuXG4gICAgdGhpcy5pc0ZhdWx0ID0gZmFsc2U7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ2lzU2F2ZWQnLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICEhc2VsZi5fcmV2O1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcblxuICAgIHRoaXMuX3JldiA9IG51bGw7XG5cbn1cblxuLyoqXG4gKiBIdW1hbiByZWFkYWJsZSBkdW1wIG9mIHRoaXMgb2JqZWN0XG4gKiBAcmV0dXJucyB7Kn1cbiAqIEBwcml2YXRlXG4gKi9cblNpZXN0YU1vZGVsLnByb3RvdHlwZS5fZHVtcCA9IGZ1bmN0aW9uIChhc0pzb24pIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGNsZWFuT2JqID0ge307XG4gICAgY2xlYW5PYmoubWFwcGluZyA9IHRoaXMubWFwcGluZy50eXBlO1xuICAgIGNsZWFuT2JqLmNvbGxlY3Rpb24gPSB0aGlzLmNvbGxlY3Rpb247XG4gICAgY2xlYW5PYmouX2lkID0gdGhpcy5faWQ7XG4gICAgY2xlYW5PYmogPSBfLnJlZHVjZSh0aGlzLl9maWVsZHMsIGZ1bmN0aW9uIChtZW1vLCBmKSB7XG4gICAgICAgIGlmIChzZWxmW2ZdKSB7XG4gICAgICAgICAgICBtZW1vW2ZdID0gc2VsZltmXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWVtbztcbiAgICB9LCBjbGVhbk9iaik7XG4gICAgY2xlYW5PYmogPSBfLnJlZHVjZSh0aGlzLl9yZWxhdGlvbnNoaXBGaWVsZHMsIGZ1bmN0aW9uIChtZW1vLCBmKSB7XG4gICAgICAgIGlmIChzZWxmW2YgKyAnUHJveHknXSkge1xuICAgICAgICAgICAgaWYgKHNlbGZbZiArICdQcm94eSddLmhhc093blByb3BlcnR5KCdfaWQnKSkge1xuICAgICAgICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkoc2VsZltmICsgJ1Byb3h5J10uX2lkKSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2VsZltmXS5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lbW9bZl0gPSBzZWxmW2YgKyAnUHJveHknXS5faWQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoc2VsZltmICsgJ1Byb3h5J10uX2lkKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lbW9bZl0gPSBzZWxmW2YgKyAnUHJveHknXS5faWQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgbWVtb1tmXSA9IHNlbGZbZl07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgfSwgY2xlYW5PYmopO1xuXG4gICAgcmV0dXJuIGFzSnNvbiA/IEpTT04uc3RyaW5naWZ5KGNsZWFuT2JqLCBudWxsLCA0KSA6IGNsZWFuT2JqO1xufTtcblxuXG5TaWVzdGFNb2RlbC5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgdmFyIGRlZmVycmVkID0gcS5kZWZlcigpO1xuICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhudWxsLCB0aGlzKTtcbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn07XG5cbmV4cG9ydHMuU2llc3RhTW9kZWwgPSBTaWVzdGFNb2RlbDtcbmV4cG9ydHMuZHVtcFNhdmVRdWV1ZXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGR1bXBlZCA9IHt9O1xuICAgIGZvciAodmFyIGlkIGluIHF1ZXVlcykge1xuICAgICAgICBpZiAocXVldWVzLmhhc093blByb3BlcnR5KGlkKSkge1xuICAgICAgICAgICAgdmFyIHF1ZXVlID0gcXVldWVzW2lkXTtcbiAgICAgICAgICAgIGR1bXBlZFtpZF0gPSB7XG4gICAgICAgICAgICAgICAgbnVtUnVubmluZzogcXVldWUubnVtUnVubmluZ09wZXJhdGlvbnMsXG4gICAgICAgICAgICAgICAgcXVldWVkOiBxdWV1ZS5fcXVldWVkT3BlcmF0aW9ucy5sZW5ndGhcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGR1bXBlZDtcbn07IiwidmFyIHByb3h5ID0gcmVxdWlyZSgnLi9wcm94eScpXG4gICAgLCBOZXdPYmplY3RQcm94eSA9IHByb3h5Lk5ld09iamVjdFByb3h5XG4gICAgLCBTdG9yZSA9IHJlcXVpcmUoJy4vc3RvcmUnKVxuICAgICwgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpXG4gICAgLCBfID0gdXRpbC5fXG4gICAgLCBSZXN0RXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuUmVzdEVycm9yXG4gICAgLCBjb3JlQ2hhbmdlcyA9IHJlcXVpcmUoJy4vY2hhbmdlcycpXG4gICAgLCBTaWVzdGFNb2RlbCA9IHJlcXVpcmUoJy4vb2JqZWN0JykuU2llc3RhTW9kZWxcbiAgICAsIG5vdGlmaWNhdGlvbkNlbnRyZSA9IHJlcXVpcmUoJy4vbm90aWZpY2F0aW9uQ2VudHJlJylcbiAgICAsIHdyYXBBcnJheUZvckF0dHJpYnV0ZXMgPSBub3RpZmljYXRpb25DZW50cmUud3JhcEFycmF5XG4gICAgLCBBcnJheU9ic2VydmVyID0gcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKS5BcnJheU9ic2VydmVyXG4gICAgLCBDaGFuZ2VUeXBlID0gcmVxdWlyZSgnLi9jaGFuZ2VzJykuQ2hhbmdlVHlwZVxuICAgICwgcSA9IHJlcXVpcmUoJ3EnKVxuICAgIDtcblxuXG5mdW5jdGlvbiBPbmVUb01hbnlQcm94eShvcHRzKSB7XG4gICAgTmV3T2JqZWN0UHJveHkuY2FsbCh0aGlzLCBvcHRzKTtcblxuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ2lzRmF1bHQnLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKHNlbGYuaXNGb3J3YXJkKSB7XG4gICAgICAgICAgICAgICAgaWYgKHNlbGYuX2lkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAhc2VsZi5yZWxhdGVkO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChzZWxmLl9pZCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKHNlbGYuX2lkKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzZWxmLnJlbGF0ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzZWxmLl9pZC5sZW5ndGggIT0gc2VsZi5yZWxhdGVkLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbGlkYXRlUmVsYXRlZC5jYWxsKHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgaWYgKHYpIHtcbiAgICAgICAgICAgICAgICBzZWxmLl9pZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICBzZWxmLnJlbGF0ZWQgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKCFzZWxmLl9pZCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2VsZi5pc0ZvcndhcmQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuX2lkID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuX2lkID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLnJlbGF0ZWQgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdyYXBBcnJheS5jYWxsKHNlbGYsIHNlbGYucmVsYXRlZCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLl9yZXZlcnNlSXNBcnJheSA9IHRydWU7XG4gICAgdGhpcy5fZm9yd2FyZElzQXJyYXkgPSBmYWxzZTtcbn1cblxuT25lVG9NYW55UHJveHkucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShOZXdPYmplY3RQcm94eS5wcm90b3R5cGUpO1xuXG5cbmZ1bmN0aW9uIGNsZWFyUmV2ZXJzZShyZW1vdmVkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIF8uZWFjaChyZW1vdmVkLCBmdW5jdGlvbiAocmVtb3ZlZE9iamVjdCkge1xuICAgICAgICB2YXIgcmV2ZXJzZVByb3h5ID0gcHJveHkuZ2V0UmV2ZXJzZVByb3h5Rm9yT2JqZWN0LmNhbGwoc2VsZiwgcmVtb3ZlZE9iamVjdCk7XG4gICAgICAgIHByb3h5LnNldC5jYWxsKHJldmVyc2VQcm94eSwgbnVsbCk7XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIHNldFJldmVyc2UoYWRkZWQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgXy5lYWNoKGFkZGVkLCBmdW5jdGlvbiAoYWRkZWQpIHtcbiAgICAgICAgdmFyIGZvcndhcmRQcm94eSA9IHByb3h5LmdldFJldmVyc2VQcm94eUZvck9iamVjdC5jYWxsKHNlbGYsIGFkZGVkKTtcbiAgICAgICAgcHJveHkuc2V0LmNhbGwoZm9yd2FyZFByb3h5LCBzZWxmLm9iamVjdCk7XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIHdyYXBBcnJheShhcnIpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgd3JhcEFycmF5Rm9yQXR0cmlidXRlcyhhcnIsIHRoaXMucmV2ZXJzZU5hbWUsIHRoaXMub2JqZWN0KTtcbiAgICBpZiAoIWFyci5vbmVUb01hbnlPYnNlcnZlcikge1xuICAgICAgICBhcnIub25lVG9NYW55T2JzZXJ2ZXIgPSBuZXcgQXJyYXlPYnNlcnZlcihhcnIpO1xuICAgICAgICB2YXIgb2JzZXJ2ZXJGdW5jdGlvbiA9IGZ1bmN0aW9uIChzcGxpY2VzKSB7XG4gICAgICAgICAgICBzcGxpY2VzLmZvckVhY2goZnVuY3Rpb24gKHNwbGljZSkge1xuICAgICAgICAgICAgICAgIHZhciBhZGRlZCA9IHNwbGljZS5hZGRlZENvdW50ID8gYXJyLnNsaWNlKHNwbGljZS5pbmRleCwgc3BsaWNlLmluZGV4ICsgc3BsaWNlLmFkZGVkQ291bnQpIDogW107XG4gICAgICAgICAgICAgICAgdmFyIHJlbW92ZWQgPSBzcGxpY2UucmVtb3ZlZDtcbiAgICAgICAgICAgICAgICBjbGVhclJldmVyc2UuY2FsbChzZWxmLCByZW1vdmVkKTtcbiAgICAgICAgICAgICAgICBzZXRSZXZlcnNlLmNhbGwoc2VsZiwgYWRkZWQpO1xuICAgICAgICAgICAgICAgIHZhciBtYXBwaW5nID0gcHJveHkuZ2V0Rm9yd2FyZE1hcHBpbmcuY2FsbChzZWxmKTtcbiAgICAgICAgICAgICAgICBjb3JlQ2hhbmdlcy5yZWdpc3RlckNoYW5nZSh7XG4gICAgICAgICAgICAgICAgICAgIGNvbGxlY3Rpb246IG1hcHBpbmcuY29sbGVjdGlvbixcbiAgICAgICAgICAgICAgICAgICAgbWFwcGluZzogbWFwcGluZyxcbiAgICAgICAgICAgICAgICAgICAgX2lkOiBzZWxmLm9iamVjdC5faWQsXG4gICAgICAgICAgICAgICAgICAgIGZpZWxkOiBwcm94eS5nZXRGb3J3YXJkTmFtZS5jYWxsKHNlbGYpLFxuICAgICAgICAgICAgICAgICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgICAgICAgICAgICAgICAgICBhZGRlZDogYWRkZWQsXG4gICAgICAgICAgICAgICAgICAgIHJlbW92ZWRJZDogXy5wbHVjayhyZW1vdmVkLCAnX2lkJyksXG4gICAgICAgICAgICAgICAgICAgIGFkZGVkSWQ6IF8ucGx1Y2soYWRkZWQsICdfaWQnKSxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogQ2hhbmdlVHlwZS5TcGxpY2UsXG4gICAgICAgICAgICAgICAgICAgIGluZGV4OiBzcGxpY2UuaW5kZXhcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgICAgICBhcnIub25lVG9NYW55T2JzZXJ2ZXIub3BlbihvYnNlcnZlckZ1bmN0aW9uKTtcbiAgICB9XG59XG5cblxuT25lVG9NYW55UHJveHkucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIHZhciBkZWZlcnJlZCA9IHEuZGVmZXIoKTtcbiAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAodGhpcy5pc0ZhdWx0KSB7XG4gICAgICAgIGlmICh0aGlzLl9pZC5sZW5ndGgpIHtcbiAgICAgICAgICAgIHZhciBzdG9yZU9wdHMgPSB7X2lkOiB0aGlzLl9pZH07XG4gICAgICAgICAgICBTdG9yZS5nZXQoc3RvcmVPcHRzLCBmdW5jdGlvbiAoZXJyLCBzdG9yZWQpIHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYucmVsYXRlZCA9IHN0b3JlZDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhudWxsLCBzdG9yZWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCB0aGlzLnJlbGF0ZWQpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKG51bGwsIHRoaXMucmVsYXRlZCk7XG4gICAgfVxuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufTtcblxuLyoqXG4gKiBWYWxpZGF0ZSB0aGUgb2JqZWN0IHRoYXQgd2UncmUgc2V0dGluZ1xuICogQHBhcmFtIG9ialxuICogQHJldHVybnMge3N0cmluZ3xudWxsfSBBbiBlcnJvciBtZXNzYWdlIG9yIG51bGxcbiAqL1xuZnVuY3Rpb24gdmFsaWRhdGUob2JqKSB7XG4gICAgdmFyIHN0ciA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopO1xuICAgIGlmICh0aGlzLmlzRm9yd2FyZCkge1xuICAgICAgICBpZiAoc3RyID09ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICAgICAgICAgIHJldHVybiAnQ2Fubm90IGFzc2lnbiBhcnJheSBmb3J3YXJkIG9uZVRvTWFueSAoJyArIHN0ciArICcpOiAnICsgdGhpcy5mb3J3YXJkTmFtZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgaWYgKHN0ciAhPSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICAgICAgICByZXR1cm4gJ0Nhbm5vdCBzY2FsYXIgdG8gcmV2ZXJzZSBvbmVUb01hbnkgKCcgKyBzdHIgKyAnKTogJyArIHRoaXMucmV2ZXJzZU5hbWU7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIHZhbGlkYXRlUmVsYXRlZCgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX2lkKSB7XG4gICAgICAgIGlmIChzZWxmLnJlbGF0ZWQpIHtcbiAgICAgICAgICAgIGlmIChzZWxmLl9pZC5sZW5ndGggIT0gc2VsZi5yZWxhdGVkLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGlmIChzZWxmLnJlbGF0ZWQubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUmVzdEVycm9yKCdfaWQgYW5kIHJlbGF0ZWQgYXJlIHNvbWVob3cgb3V0IG9mIHN5bmMnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbk9uZVRvTWFueVByb3h5LnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgcHJveHkuY2hlY2tJbnN0YWxsZWQuY2FsbCh0aGlzKTtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKG9iaikge1xuICAgICAgICB2YXIgZXJyb3JNZXNzYWdlO1xuICAgICAgICBpZiAoZXJyb3JNZXNzYWdlID0gdmFsaWRhdGUuY2FsbCh0aGlzLCBvYmopKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgUmVzdEVycm9yKGVycm9yTWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBwcm94eS5jbGVhclJldmVyc2VSZWxhdGVkLmNhbGwodGhpcyk7XG4gICAgICAgICAgICBwcm94eS5zZXQuY2FsbChzZWxmLCBvYmopO1xuICAgICAgICAgICAgaWYgKHNlbGYuaXNSZXZlcnNlKSB7XG4gICAgICAgICAgICAgICAgd3JhcEFycmF5LmNhbGwodGhpcywgc2VsZi5yZWxhdGVkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHByb3h5LnNldFJldmVyc2UuY2FsbChzZWxmLCBvYmopO1xuICAgICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBwcm94eS5jbGVhclJldmVyc2VSZWxhdGVkLmNhbGwodGhpcyk7XG4gICAgICAgIHByb3h5LnNldC5jYWxsKHNlbGYsIG9iaik7XG4gICAgfVxufTtcblxuT25lVG9NYW55UHJveHkucHJvdG90eXBlLmluc3RhbGwgPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgTmV3T2JqZWN0UHJveHkucHJvdG90eXBlLmluc3RhbGwuY2FsbCh0aGlzLCBvYmopO1xuICAgIGlmICh0aGlzLmlzUmV2ZXJzZSkge1xuICAgICAgICBvYmpbICgnc3BsaWNlJyArIHV0aWwuY2FwaXRhbGlzZUZpcnN0TGV0dGVyKHRoaXMucmV2ZXJzZU5hbWUpKV0gPSBfLmJpbmQocHJveHkuc3BsaWNlLCB0aGlzKTtcbiAgICB9XG59O1xuXG5cbmV4cG9ydHMuT25lVG9NYW55UHJveHkgPSBPbmVUb01hbnlQcm94eTsiLCJ2YXIgcHJveHkgPSByZXF1aXJlKCcuL3Byb3h5JylcbiAgICAsIE5ld09iamVjdFByb3h5ID0gcHJveHkuTmV3T2JqZWN0UHJveHlcbiAgICAsIFN0b3JlID0gcmVxdWlyZSgnLi9zdG9yZScpXG4gICAgLCB1dGlsID0gcmVxdWlyZSgnLi91dGlsJylcbiAgICAsIFJlc3RFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5SZXN0RXJyb3JcbiAgICAsIHEgPSByZXF1aXJlKCdxJylcbiAgICAsIFNpZXN0YU1vZGVsID0gcmVxdWlyZSgnLi9vYmplY3QnKS5TaWVzdGFNb2RlbDtcblxuXG5cbmZ1bmN0aW9uIE9uZVRvT25lUHJveHkob3B0cykge1xuICAgIE5ld09iamVjdFByb3h5LmNhbGwodGhpcywgb3B0cyk7XG4gICAgdGhpcy5fcmV2ZXJzZUlzQXJyYXkgPSBmYWxzZTtcbiAgICB0aGlzLl9mb3J3YXJkSXNBcnJheSA9IGZhbHNlO1xufVxuXG5PbmVUb09uZVByb3h5LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoTmV3T2JqZWN0UHJveHkucHJvdG90eXBlKTtcblxuLyoqXG4gKiBWYWxpZGF0ZSB0aGUgb2JqZWN0IHRoYXQgd2UncmUgc2V0dGluZ1xuICogQHBhcmFtIG9ialxuICogQHJldHVybnMge3N0cmluZ3xudWxsfSBBbiBlcnJvciBtZXNzYWdlIG9yIG51bGxcbiAqL1xuZnVuY3Rpb24gdmFsaWRhdGUob2JqKSB7XG4gICAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopID09ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICAgICAgcmV0dXJuICdDYW5ub3QgYXNzaWduIGFycmF5IHRvIG9uZSB0byBvbmUgcmVsYXRpb25zaGlwJztcbiAgICB9XG4gICAgZWxzZSBpZiAoKCFvYmogaW5zdGFuY2VvZiBTaWVzdGFNb2RlbCkpIHtcblxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbn1cblxuT25lVG9PbmVQcm94eS5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24gKG9iaikge1xuICAgIHByb3h5LmNoZWNrSW5zdGFsbGVkLmNhbGwodGhpcyk7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChvYmopIHtcbiAgICAgICAgdmFyIGVycm9yTWVzc2FnZTtcbiAgICAgICAgaWYgKGVycm9yTWVzc2FnZSA9IHZhbGlkYXRlKG9iaikpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IoZXJyb3JNZXNzYWdlKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHByb3h5LmNsZWFyUmV2ZXJzZVJlbGF0ZWQuY2FsbCh0aGlzKTtcbiAgICAgICAgICAgIHByb3h5LnNldC5jYWxsKHNlbGYsIG9iaik7XG4gICAgICAgICAgICBwcm94eS5zZXRSZXZlcnNlLmNhbGwoc2VsZiwgb2JqKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgcHJveHkuY2xlYXJSZXZlcnNlUmVsYXRlZC5jYWxsKHRoaXMpO1xuICAgICAgICBwcm94eS5zZXQuY2FsbChzZWxmLCBvYmopO1xuICAgIH1cbn07XG5cbk9uZVRvT25lUHJveHkucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIHZhciBkZWZlcnJlZCA9IHEuZGVmZXIoKTtcbiAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAodGhpcy5faWQpIHtcbiAgICAgICAgU3RvcmUuZ2V0KHtfaWQ6IHRoaXMuX2lkfSwgZnVuY3Rpb24gKGVyciwgc3RvcmVkKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgc2VsZi5yZWxhdGVkID0gc3RvcmVkO1xuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobnVsbCwgc3RvcmVkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICB9XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59O1xuXG5leHBvcnRzLk9uZVRvT25lUHJveHkgPSBPbmVUb09uZVByb3h5OyIsInZhciBSZXN0RXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuUmVzdEVycm9yXG4gICAgLCBTdG9yZSA9IHJlcXVpcmUoJy4vc3RvcmUnKVxuICAgICwgZGVmaW5lU3ViUHJvcGVydHkgPSByZXF1aXJlKCcuL21pc2MnKS5kZWZpbmVTdWJQcm9wZXJ0eVxuICAgICwgT3BlcmF0aW9uID0gcmVxdWlyZSgnLi4vdmVuZG9yL29wZXJhdGlvbnMuanMvc3JjL29wZXJhdGlvbicpLk9wZXJhdGlvblxuICAgICwgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpXG4gICAgLCBfID0gdXRpbC5fXG4gICAgLCBRdWVyeSA9IHJlcXVpcmUoJy4vcXVlcnknKS5RdWVyeVxuICAgICwgbG9nID0gcmVxdWlyZSgnLi4vdmVuZG9yL29wZXJhdGlvbnMuanMvc3JjL2xvZycpXG4gICAgLCBub3RpZmljYXRpb25DZW50cmUgPSByZXF1aXJlKCcuL25vdGlmaWNhdGlvbkNlbnRyZScpXG4gICAgLCB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzID0gbm90aWZpY2F0aW9uQ2VudHJlLndyYXBBcnJheVxuICAgICwgQXJyYXlPYnNlcnZlciA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuQXJyYXlPYnNlcnZlclxuICAgICwgY29yZUNoYW5nZXMgPSByZXF1aXJlKCcuL2NoYW5nZXMnKVxuICAgICwgQ2hhbmdlVHlwZSA9IGNvcmVDaGFuZ2VzLkNoYW5nZVR5cGU7XG5cbmZ1bmN0aW9uIEZhdWx0KHByb3h5KSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHRoaXMucHJveHkgPSBwcm94eTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ2lzRmF1bHQnLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHNlbGYucHJveHkuaXNGYXVsdDtcbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSk7XG59XG5cbkZhdWx0LnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5wcm94eS5nZXQuYXBwbHkodGhpcy5wcm94eSwgYXJndW1lbnRzKTtcbn07XG5cbkZhdWx0LnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5wcm94eS5zZXQuYXBwbHkodGhpcy5wcm94eSwgYXJndW1lbnRzKTtcbn07XG5cbmZ1bmN0aW9uIE5ld09iamVjdFByb3h5KG9wdHMpIHtcbiAgICB0aGlzLl9vcHRzID0gb3B0cztcbiAgICBpZiAoIXRoaXMpIHJldHVybiBuZXcgTmV3T2JqZWN0UHJveHkob3B0cyk7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHRoaXMuZmF1bHQgPSBuZXcgRmF1bHQodGhpcyk7XG4gICAgdGhpcy5vYmplY3QgPSBudWxsO1xuICAgIHRoaXMuX2lkID0gdW5kZWZpbmVkO1xuICAgIHRoaXMucmVsYXRlZCA9IG51bGw7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdpc0ZhdWx0Jywge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChzZWxmLl9pZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiAhc2VsZi5yZWxhdGVkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoc2VsZi5faWQgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgaWYgKHYpIHtcbiAgICAgICAgICAgICAgICBzZWxmLl9pZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICBzZWxmLnJlbGF0ZWQgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKCFzZWxmLl9pZCkge1xuICAgICAgICAgICAgICAgICAgICBzZWxmLl9pZCA9IG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdyZXZlcnNlTWFwcGluZycsIHRoaXMuX29wdHMpO1xuICAgIGRlZmluZVN1YlByb3BlcnR5LmNhbGwodGhpcywgJ2ZvcndhcmRNYXBwaW5nJywgdGhpcy5fb3B0cyk7XG4gICAgZGVmaW5lU3ViUHJvcGVydHkuY2FsbCh0aGlzLCAnZm9yd2FyZE5hbWUnLCB0aGlzLl9vcHRzKTtcbiAgICBkZWZpbmVTdWJQcm9wZXJ0eS5jYWxsKHRoaXMsICdyZXZlcnNlTmFtZScsIHRoaXMuX29wdHMpO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnaXNSZXZlcnNlJywge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChzZWxmLm9iamVjdCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzZWxmLm9iamVjdC5tYXBwaW5nID09IHNlbGYucmV2ZXJzZU1hcHBpbmc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUmVzdEVycm9yKCdDYW5ub3QgdXNlIHByb3h5IHVudGlsIGluc3RhbGxlZCcpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnaXNGb3J3YXJkJywge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChzZWxmLm9iamVjdCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzZWxmLm9iamVjdC5tYXBwaW5nID09IHNlbGYuZm9yd2FyZE1hcHBpbmc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUmVzdEVycm9yKCdDYW5ub3QgdXNlIHByb3h5IHVudGlsIGluc3RhbGxlZCcpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pO1xufVxuXG5OZXdPYmplY3RQcm94eS5wcm90b3R5cGUuX2R1bXAgPSBmdW5jdGlvbiAoYXNKc29uKSB7XG4gICAgdmFyIGR1bXBlZCA9IHt9O1xufTtcblxuTmV3T2JqZWN0UHJveHkucHJvdG90eXBlLmluc3RhbGwgPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgaWYgKG9iaikge1xuICAgICAgICBpZiAoIXRoaXMub2JqZWN0KSB7XG4gICAgICAgICAgICB0aGlzLm9iamVjdCA9IG9iajtcbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIHZhciBuYW1lID0gZ2V0Rm9yd2FyZE5hbWUuY2FsbCh0aGlzKTtcbiAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIG5hbWUsIHtcbiAgICAgICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNlbGYuaXNGYXVsdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHNlbGYuZmF1bHQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gc2VsZi5yZWxhdGVkO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuc2V0KHYpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgb2JqWyAoJ2dldCcgKyB1dGlsLmNhcGl0YWxpc2VGaXJzdExldHRlcihuYW1lKSldID0gXy5iaW5kKHRoaXMuZ2V0LCB0aGlzKTtcbiAgICAgICAgICAgIG9ialsgKCdzZXQnICsgdXRpbC5jYXBpdGFsaXNlRmlyc3RMZXR0ZXIobmFtZSkpXSA9IF8uYmluZCh0aGlzLnNldCwgdGhpcyk7XG4gICAgICAgICAgICBvYmpbbmFtZSArICdQcm94eSddID0gdGhpcztcbiAgICAgICAgICAgIGlmICghb2JqLl9wcm94aWVzKSB7XG4gICAgICAgICAgICAgICAgb2JqLl9wcm94aWVzID0gW107XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBvYmouX3Byb3hpZXMucHVzaCh0aGlzKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IoJ0FscmVhZHkgaW5zdGFsbGVkLicpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgUmVzdEVycm9yKCdObyBvYmplY3QgcGFzc2VkIHRvIHJlbGF0aW9uc2hpcCBpbnN0YWxsJyk7XG4gICAgfVxufTtcblxuTmV3T2JqZWN0UHJveHkucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICB0aHJvdyBuZXcgUmVzdEVycm9yKCdNdXN0IHN1YmNsYXNzIE5ld09iamVjdFByb3h5Jyk7XG59O1xuXG5OZXdPYmplY3RQcm94eS5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgdGhyb3cgbmV3IFJlc3RFcnJvcignTXVzdCBzdWJjbGFzcyBOZXdPYmplY3RQcm94eScpO1xufTtcblxuZnVuY3Rpb24gZ2V0UmV2ZXJzZVByb3h5Rm9yT2JqZWN0KG9iaikge1xuICAgIHZhciByZXZlcnNlTmFtZSA9IGdldFJldmVyc2VOYW1lLmNhbGwodGhpcyk7XG4gICAgdmFyIHByb3h5TmFtZSA9IChyZXZlcnNlTmFtZSArICdQcm94eScpO1xuICAgIGlmICh1dGlsLmlzQXJyYXkob2JqKSkge1xuICAgICAgICByZXR1cm4gXy5wbHVjayhvYmosIHByb3h5TmFtZSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICByZXR1cm4gb2JqW3Byb3h5TmFtZV07XG4gICAgfVxufVxuXG5mdW5jdGlvbiBnZXRGb3J3YXJkUHJveHlGb3JPYmplY3Qob2JqKSB7XG4gICAgdmFyIGZvcndhcmROYW1lID0gZ2V0Rm9yd2FyZE5hbWUuY2FsbCh0aGlzKTtcbiAgICB2YXIgcHJveHlOYW1lID0gZm9yd2FyZE5hbWUgKyAnUHJveHknO1xuICAgIGlmICh1dGlsLmlzQXJyYXkob2JqKSkge1xuICAgICAgICByZXR1cm4gXy5wbHVjayhvYmosIHByb3h5TmFtZSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICByZXR1cm4gb2JqW3Byb3h5TmFtZV07XG4gICAgfVxufVxuXG5mdW5jdGlvbiBnZXRSZXZlcnNlTmFtZSgpIHtcbiAgICByZXR1cm4gdGhpcy5pc0ZvcndhcmQgPyB0aGlzLnJldmVyc2VOYW1lIDogdGhpcy5mb3J3YXJkTmFtZTtcbn1cblxuZnVuY3Rpb24gZ2V0Rm9yd2FyZE5hbWUoKSB7XG4gICAgcmV0dXJuIHRoaXMuaXNGb3J3YXJkID8gdGhpcy5mb3J3YXJkTmFtZSA6IHRoaXMucmV2ZXJzZU5hbWU7XG59XG5cbmZ1bmN0aW9uIGdldFJldmVyc2VNYXBwaW5nKCkge1xuICAgIHJldHVybiB0aGlzLmlzRm9yd2FyZCA/IHRoaXMucmV2ZXJzZU1hcHBpbmcgOiB0aGlzLmZvcndhcmRNYXBwaW5nO1xufVxuXG5mdW5jdGlvbiBnZXRGb3J3YXJkTWFwcGluZygpIHtcbiAgICByZXR1cm4gdGhpcy5pc0ZvcndhcmQgPyB0aGlzLmZvcndhcmRNYXBwaW5nIDogdGhpcy5yZXZlcnNlTWFwcGluZztcbn1cblxuZnVuY3Rpb24gY2hlY2tJbnN0YWxsZWQoKSB7XG4gICAgaWYgKCF0aGlzLm9iamVjdCkge1xuICAgICAgICB0aHJvdyBuZXcgUmVzdEVycm9yKCdQcm94eSBtdXN0IGJlIGluc3RhbGxlZCBvbiBhbiBvYmplY3QgYmVmb3JlIGNhbiB1c2UgaXQuJyk7XG4gICAgfVxufVxuXG4vKipcbiAqIENvbmZpZ3VyZSBfaWQgYW5kIHJlbGF0ZWQgd2l0aCB0aGUgbmV3IHJlbGF0ZWQgb2JqZWN0LlxuICogQHBhcmFtIG9ialxuICovXG5mdW5jdGlvbiBzZXQob2JqKSB7XG4gICAgcmVnaXN0ZXJTZXRDaGFuZ2UuY2FsbCh0aGlzLCBvYmopO1xuICAgIGlmIChvYmopIHtcbiAgICAgICAgaWYgKHV0aWwuaXNBcnJheShvYmopKSB7XG4gICAgICAgICAgICB0aGlzLl9pZCA9IF8ucGx1Y2sob2JqLCAnX2lkJyk7XG4gICAgICAgICAgICB0aGlzLnJlbGF0ZWQgPSBvYmo7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9pZCA9IG9iai5faWQ7XG4gICAgICAgICAgICB0aGlzLnJlbGF0ZWQgPSBvYmo7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHRoaXMuX2lkID0gbnVsbDtcbiAgICAgICAgdGhpcy5yZWxhdGVkID0gbnVsbDtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHNwbGljZShpZHgsIG51bVJlbW92ZSkge1xuICAgIHJlZ2lzdGVyU3BsaWNlQ2hhbmdlLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgdmFyIGFkZCA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgdmFyIHJldHVyblZhbHVlID0gXy5wYXJ0aWFsKHRoaXMuX2lkLnNwbGljZSwgaWR4LCBudW1SZW1vdmUpLmFwcGx5KHRoaXMuX2lkLCBfLnBsdWNrKGFkZCwgJ19pZCcpKTtcbiAgICBpZiAodGhpcy5yZWxhdGVkKSB7XG4gICAgICAgIF8ucGFydGlhbCh0aGlzLnJlbGF0ZWQuc3BsaWNlLCBpZHgsIG51bVJlbW92ZSkuYXBwbHkodGhpcy5yZWxhdGVkLCBhZGQpO1xuICAgIH1cbiAgICByZXR1cm4gcmV0dXJuVmFsdWU7XG59XG5cbmZ1bmN0aW9uIG9iakFzU3RyaW5nKG9iaikge1xuICAgIGZ1bmN0aW9uIF9vYmpBc1N0cmluZyhvYmopIHtcbiAgICAgICAgaWYgKG9iaikge1xuICAgICAgICAgICAgdmFyIG1hcHBpbmcgPSBvYmoubWFwcGluZztcbiAgICAgICAgICAgIHZhciBtYXBwaW5nTmFtZSA9IG1hcHBpbmcudHlwZTtcbiAgICAgICAgICAgIHZhciBpZGVudCA9IG9iai5faWQ7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGlkZW50ID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgaWRlbnQgPSAnXCInICsgaWRlbnQgKyAnXCInO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG1hcHBpbmdOYW1lICsgJ1tfaWQ9JyArIGlkZW50ICsgJ10nO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKG9iaiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm4gJ3VuZGVmaW5lZCc7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAob2JqID09PSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gJ251bGwnO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHV0aWwuaXNBcnJheShvYmopKSByZXR1cm4gXy5tYXAoX29iakFzU3RyaW5nLCBvYmopLmpvaW4oJywgJyk7XG4gICAgcmV0dXJuIF9vYmpBc1N0cmluZyhvYmopO1xufVxuXG5mdW5jdGlvbiBjbGVhclJldmVyc2VSZWxhdGVkKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoIXNlbGYuaXNGYXVsdCkge1xuICAgICAgICBpZiAodGhpcy5yZWxhdGVkKSB7XG4gICAgICAgICAgICB2YXIgcmV2ZXJzZVByb3h5ID0gZ2V0UmV2ZXJzZVByb3h5Rm9yT2JqZWN0LmNhbGwodGhpcywgdGhpcy5yZWxhdGVkKTtcbiAgICAgICAgICAgIHZhciByZXZlcnNlUHJveGllcyA9IHV0aWwuaXNBcnJheShyZXZlcnNlUHJveHkpID8gcmV2ZXJzZVByb3h5IDogW3JldmVyc2VQcm94eV07XG4gICAgICAgICAgICBfLmVhY2gocmV2ZXJzZVByb3hpZXMsIGZ1bmN0aW9uIChwKSB7XG4gICAgICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheShwLl9pZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGlkeCA9IHAuX2lkLmluZGV4T2Yoc2VsZi5vYmplY3QuX2lkKTtcbiAgICAgICAgICAgICAgICAgICAgbWFrZUNoYW5nZXNUb1JlbGF0ZWRXaXRob3V0T2JzZXJ2YXRpb25zLmNhbGwocCwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3BsaWNlLmNhbGwocCwgaWR4LCAxKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzZXQuY2FsbChwLCBudWxsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgaWYgKHNlbGYuX2lkKSB7XG4gICAgICAgICAgICB2YXIgcmV2ZXJzZU5hbWUgPSBnZXRSZXZlcnNlTmFtZS5jYWxsKHRoaXMpO1xuICAgICAgICAgICAgdmFyIHJldmVyc2VNYXBwaW5nID0gZ2V0UmV2ZXJzZU1hcHBpbmcuY2FsbCh0aGlzKTtcbiAgICAgICAgICAgIHZhciBpZGVudGlmaWVycyA9IHV0aWwuaXNBcnJheShzZWxmLl9pZCkgPyBzZWxmLl9pZCA6IFtzZWxmLl9pZF07XG4gICAgICAgICAgICBpZiAodGhpcy5fcmV2ZXJzZUlzQXJyYXkpIHtcbiAgICAgICAgICAgICAgICBfLmVhY2goaWRlbnRpZmllcnMsIGZ1bmN0aW9uIChfaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29yZUNoYW5nZXMucmVnaXN0ZXJDaGFuZ2Uoe1xuICAgICAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbjogcmV2ZXJzZU1hcHBpbmcuY29sbGVjdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hcHBpbmc6IHJldmVyc2VNYXBwaW5nLnR5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICBfaWQ6IF9pZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpZWxkOiByZXZlcnNlTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZWRJZDogW3NlbGYub2JqZWN0Ll9pZF0sXG4gICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVkOiBbc2VsZi5vYmplY3RdLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogQ2hhbmdlVHlwZS5SZW1vdmVcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBfLmVhY2goaWRlbnRpZmllcnMsIGZ1bmN0aW9uIChfaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29yZUNoYW5nZXMucmVnaXN0ZXJDaGFuZ2Uoe1xuICAgICAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbjogcmV2ZXJzZU1hcHBpbmcuY29sbGVjdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hcHBpbmc6IHJldmVyc2VNYXBwaW5nLnR5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICBfaWQ6IF9pZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpZWxkOiByZXZlcnNlTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ldzogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld0lkOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgb2xkSWQ6IHNlbGYub2JqZWN0Ll9pZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG9sZDogc2VsZi5vYmplY3QsXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBDaGFuZ2VUeXBlLlNldFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGdldEZvcndhcmROYW1lLmNhbGwodGhpcykgKyAnIGhhcyBubyBfaWQnKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gbWFrZUNoYW5nZXNUb1JlbGF0ZWRXaXRob3V0T2JzZXJ2YXRpb25zKGYpIHtcbiAgICBpZiAodGhpcy5yZWxhdGVkKSB7XG4gICAgICAgIHRoaXMucmVsYXRlZC5vbmVUb01hbnlPYnNlcnZlci5jbG9zZSgpO1xuICAgICAgICB0aGlzLnJlbGF0ZWQub25lVG9NYW55T2JzZXJ2ZXIgPSBudWxsO1xuICAgICAgICBmKCk7XG4gICAgICAgIHdyYXBBcnJheS5jYWxsKHRoaXMsIHRoaXMucmVsYXRlZCk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICAvLyBJZiB0aGVyZSdzIGEgZmF1bHQgd2UgY2FuIG1ha2UgY2hhbmdlcyBhbnl3YXkuXG4gICAgICAgIGYoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHNldFJldmVyc2Uob2JqKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciByZXZlcnNlUHJveHkgPSBnZXRSZXZlcnNlUHJveHlGb3JPYmplY3QuY2FsbCh0aGlzLCBvYmopO1xuICAgIHZhciByZXZlcnNlUHJveGllcyA9IHV0aWwuaXNBcnJheShyZXZlcnNlUHJveHkpID8gcmV2ZXJzZVByb3h5IDogW3JldmVyc2VQcm94eV07XG4gICAgXy5lYWNoKHJldmVyc2VQcm94aWVzLCBmdW5jdGlvbiAocCkge1xuICAgICAgICBpZiAodXRpbC5pc0FycmF5KHAuX2lkKSkge1xuICAgICAgICAgICAgbWFrZUNoYW5nZXNUb1JlbGF0ZWRXaXRob3V0T2JzZXJ2YXRpb25zLmNhbGwocCwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHNwbGljZS5jYWxsKHAsIHAuX2lkLmxlbmd0aCwgMCwgc2VsZi5vYmplY3QpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjbGVhclJldmVyc2VSZWxhdGVkLmNhbGwocCk7XG4gICAgICAgICAgICBzZXQuY2FsbChwLCBzZWxmLm9iamVjdCk7XG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gcmVnaXN0ZXJTZXRDaGFuZ2Uob2JqKSB7XG4gICAgdmFyIHByb3h5T2JqZWN0ID0gdGhpcy5vYmplY3Q7XG4gICAgaWYgKCFwcm94eU9iamVjdCkgdGhyb3cgUmVzdEVycm9yKCdQcm94eSBtdXN0IGhhdmUgYW4gb2JqZWN0IGFzc29jaWF0ZWQnKTtcbiAgICB2YXIgbWFwcGluZyA9IHByb3h5T2JqZWN0Lm1hcHBpbmcudHlwZTtcbiAgICB2YXIgY29sbCA9IHByb3h5T2JqZWN0LmNvbGxlY3Rpb247XG4gICAgdmFyIG5ld0lkO1xuICAgIGlmICh1dGlsLmlzQXJyYXkob2JqKSkge1xuICAgICAgICBuZXdJZCA9IF8ucGx1Y2sob2JqLCAnX2lkJyk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBuZXdJZCA9IG9iaiA/IG9iai5faWQgOiBvYmo7XG4gICAgfVxuICAgIC8vIFdlIHRha2UgW10gPT0gbnVsbCA9PSB1bmRlZmluZWQgaW4gdGhlIGNhc2Ugb2YgcmVsYXRpb25zaGlwcy5cbiAgICB2YXIgb2xkSWQgPSB0aGlzLl9pZDtcbiAgICBpZiAodXRpbC5pc0FycmF5KG9sZElkKSAmJiAhb2xkSWQubGVuZ3RoKSB7XG4gICAgICAgIG9sZElkID0gbnVsbDtcbiAgICB9XG4gICAgdmFyIG9sZCA9IHRoaXMucmVsYXRlZDtcbiAgICBpZiAodXRpbC5pc0FycmF5KG9sZCkgJiYgIW9sZC5sZW5ndGgpIHtcbiAgICAgICAgb2xkID0gbnVsbDtcbiAgICB9XG4gICAgY29yZUNoYW5nZXMucmVnaXN0ZXJDaGFuZ2Uoe1xuICAgICAgICBjb2xsZWN0aW9uOiBjb2xsLFxuICAgICAgICBtYXBwaW5nOiBtYXBwaW5nLFxuICAgICAgICBfaWQ6IHByb3h5T2JqZWN0Ll9pZCxcbiAgICAgICAgZmllbGQ6IGdldEZvcndhcmROYW1lLmNhbGwodGhpcyksXG4gICAgICAgIG5ld0lkOiBuZXdJZCxcbiAgICAgICAgb2xkSWQ6IG9sZElkLFxuICAgICAgICBvbGQ6IG9sZCxcbiAgICAgICAgbmV3OiBvYmosXG4gICAgICAgIHR5cGU6IENoYW5nZVR5cGUuU2V0XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIHJlZ2lzdGVyU3BsaWNlQ2hhbmdlKGlkeCwgbnVtUmVtb3ZlKSB7XG4gICAgdmFyIGFkZCA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgdmFyIG1hcHBpbmcgPSB0aGlzLm9iamVjdC5tYXBwaW5nLnR5cGU7XG4gICAgdmFyIGNvbGwgPSB0aGlzLm9iamVjdC5jb2xsZWN0aW9uO1xuICAgIGNvcmVDaGFuZ2VzLnJlZ2lzdGVyQ2hhbmdlKHtcbiAgICAgICAgY29sbGVjdGlvbjogY29sbCxcbiAgICAgICAgbWFwcGluZzogbWFwcGluZyxcbiAgICAgICAgX2lkOiB0aGlzLm9iamVjdC5faWQsXG4gICAgICAgIGZpZWxkOiBnZXRGb3J3YXJkTmFtZS5jYWxsKHRoaXMpLFxuICAgICAgICBpbmRleDogaWR4LFxuICAgICAgICByZW1vdmVkSWQ6IHRoaXMuX2lkLnNsaWNlKGlkeCwgaWR4ICsgbnVtUmVtb3ZlKSxcbiAgICAgICAgcmVtb3ZlZDogdGhpcy5yZWxhdGVkID8gdGhpcy5yZWxhdGVkLnNsaWNlKGlkeCwgaWR4ICsgbnVtUmVtb3ZlKSA6IG51bGwsXG4gICAgICAgIGFkZGVkSWQ6IGFkZC5sZW5ndGggPyBfLnBsdWNrKGFkZCwgJ19pZCcpIDogW10sXG4gICAgICAgIGFkZGVkOiBhZGQubGVuZ3RoID8gYWRkIDogW10sXG4gICAgICAgIHR5cGU6IENoYW5nZVR5cGUuU3BsaWNlXG4gICAgfSk7XG59XG5cblxuZnVuY3Rpb24gd3JhcEFycmF5KGFycikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzKGFyciwgdGhpcy5yZXZlcnNlTmFtZSwgdGhpcy5vYmplY3QpO1xuICAgIGlmICghYXJyLm9uZVRvTWFueU9ic2VydmVyKSB7XG4gICAgICAgIGFyci5vbmVUb01hbnlPYnNlcnZlciA9IG5ldyBBcnJheU9ic2VydmVyKGFycik7XG4gICAgICAgIHZhciBvYnNlcnZlckZ1bmN0aW9uID0gZnVuY3Rpb24gKHNwbGljZXMpIHtcbiAgICAgICAgICAgIHNwbGljZXMuZm9yRWFjaChmdW5jdGlvbiAoc3BsaWNlKSB7XG4gICAgICAgICAgICAgICAgdmFyIGFkZGVkID0gc3BsaWNlLmFkZGVkQ291bnQgPyBhcnIuc2xpY2Uoc3BsaWNlLmluZGV4LCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCkgOiBbXTtcbiAgICAgICAgICAgICAgICB2YXIgbWFwcGluZyA9IGdldEZvcndhcmRNYXBwaW5nLmNhbGwoc2VsZik7XG4gICAgICAgICAgICAgICAgY29yZUNoYW5nZXMucmVnaXN0ZXJDaGFuZ2Uoe1xuICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBtYXBwaW5nLmNvbGxlY3Rpb24sXG4gICAgICAgICAgICAgICAgICAgIG1hcHBpbmc6IG1hcHBpbmcsXG4gICAgICAgICAgICAgICAgICAgIF9pZDogc2VsZi5vYmplY3QuX2lkLFxuICAgICAgICAgICAgICAgICAgICBmaWVsZDogZ2V0Rm9yd2FyZE5hbWUuY2FsbChzZWxmKSxcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlZDogc3BsaWNlLnJlbW92ZWQsXG4gICAgICAgICAgICAgICAgICAgIGFkZGVkOiBhZGRlZCxcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlZElkOiBfLnBsdWNrKHNwbGljZS5yZW1vdmVkLCAnX2lkJyksXG4gICAgICAgICAgICAgICAgICAgIGFkZGVkSWQ6IF8ucGx1Y2soc3BsaWNlLmFkZGVkLCAnX2lkJyksXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IENoYW5nZVR5cGUuU3BsaWNlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICAgICAgYXJyLm9uZVRvTWFueU9ic2VydmVyLm9wZW4ob2JzZXJ2ZXJGdW5jdGlvbik7XG4gICAgfVxufVxuXG5leHBvcnRzLk5ld09iamVjdFByb3h5ID0gTmV3T2JqZWN0UHJveHk7XG5leHBvcnRzLkZhdWx0ID0gRmF1bHQ7XG5leHBvcnRzLmdldFJldmVyc2VQcm94eUZvck9iamVjdCA9IGdldFJldmVyc2VQcm94eUZvck9iamVjdDtcbmV4cG9ydHMuZ2V0Rm9yd2FyZFByb3h5Rm9yT2JqZWN0ID0gZ2V0Rm9yd2FyZFByb3h5Rm9yT2JqZWN0O1xuZXhwb3J0cy5nZXRSZXZlcnNlTmFtZSA9IGdldFJldmVyc2VOYW1lO1xuZXhwb3J0cy5nZXRGb3J3YXJkTmFtZSA9IGdldEZvcndhcmROYW1lO1xuZXhwb3J0cy5nZXRSZXZlcnNlTWFwcGluZyA9IGdldFJldmVyc2VNYXBwaW5nO1xuZXhwb3J0cy5nZXRGb3J3YXJkTWFwcGluZyA9IGdldEZvcndhcmRNYXBwaW5nO1xuZXhwb3J0cy5jaGVja0luc3RhbGxlZCA9IGNoZWNrSW5zdGFsbGVkO1xuZXhwb3J0cy5zZXQgPSBzZXQ7XG5leHBvcnRzLnJlZ2lzdGVyU2V0Q2hhbmdlID0gcmVnaXN0ZXJTZXRDaGFuZ2U7XG5leHBvcnRzLnNwbGljZSA9IHNwbGljZTtcbmV4cG9ydHMuY2xlYXJSZXZlcnNlUmVsYXRlZCA9IGNsZWFyUmV2ZXJzZVJlbGF0ZWQ7XG5leHBvcnRzLnNldFJldmVyc2UgPSBzZXRSZXZlcnNlO1xuZXhwb3J0cy5vYmpBc1N0cmluZyA9IG9iakFzU3RyaW5nO1xuZXhwb3J0cy53cmFwQXJyYXkgPSB3cmFwQXJyYXk7XG5leHBvcnRzLnJlZ2lzdGVyU3BsaWNlQ2hhbmdlID0gcmVnaXN0ZXJTcGxpY2VDaGFuZ2U7XG5leHBvcnRzLm1ha2VDaGFuZ2VzVG9SZWxhdGVkV2l0aG91dE9ic2VydmF0aW9ucyA9IG1ha2VDaGFuZ2VzVG9SZWxhdGVkV2l0aG91dE9ic2VydmF0aW9uczsiLCJ2YXIgbG9nID0gcmVxdWlyZSgnLi4vdmVuZG9yL29wZXJhdGlvbnMuanMvc3JjL2xvZycpO1xudmFyIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpO1xudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnUXVlcnknKTtcbnZhciBxID0gcmVxdWlyZSgncScpO1xudmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcbkxvZ2dlci5zZXRMZXZlbChsb2cuTGV2ZWwud2Fybik7XG5cbmZ1bmN0aW9uIFF1ZXJ5KG1hcHBpbmcsIHF1ZXJ5KSB7XG4gICAgdGhpcy5tYXBwaW5nID0gbWFwcGluZztcbiAgICB0aGlzLnF1ZXJ5ID0gcXVlcnk7XG59XG5cbi8qKlxuICogSWYgdGhlIHN0b3JhZ2UgZXh0ZW5zaW9uIGlzIGVuYWJsZWQsIG9iamVjdHMgbWF5IGJlIGZhdWx0ZWQgYW5kIHNvIHdlIG5lZWQgdG8gcXVlcnkgdmlhIFBvdWNoREIuIFRoZSBzdG9yYWdlXG4gKiBleHRlbnNpb24gcHJvdmlkZXMgdGhlIFJhd1F1ZXJ5IGNsYXNzIHRvIGVuYWJsZSB0aGlzLlxuICogQHBhcmFtIGNhbGxiYWNrXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfZXhlY3V0ZVVzaW5nU3RvcmFnZUV4dGVuc2lvbihjYWxsYmFjaykge1xuICAgIHZhciBkZWZlcnJlZCA9IHEuZGVmZXIoKTtcbiAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgIHZhciBzdG9yYWdlRXh0ZW5zaW9uID0gc2llc3RhLmV4dC5zdG9yYWdlO1xuICAgIHZhciBSYXdRdWVyeSA9IHN0b3JhZ2VFeHRlbnNpb24uUmF3UXVlcnk7XG4gICAgdmFyIFBvdWNoID0gc3RvcmFnZUV4dGVuc2lvbi5Qb3VjaDtcbiAgICB2YXIgcmF3UXVlcnkgPSBuZXcgUmF3UXVlcnkodGhpcy5tYXBwaW5nLmNvbGxlY3Rpb24sIHRoaXMubWFwcGluZy50eXBlLCB0aGlzLnF1ZXJ5KTtcbiAgICByYXdRdWVyeS5leGVjdXRlKGZ1bmN0aW9uIChlcnIsIHJlc3VsdHMpIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnZ290IHJlc3VsdHMnLCByZXN1bHRzKTtcbiAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobnVsbCwgUG91Y2gudG9TaWVzdGEocmVzdWx0cykpO1xuICAgICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59XG5cbi8qKlxuICogUmV0dXJucyB0cnVlIGlmIHRoZSBnaXZlbiBvYmplY3QgbWF0Y2hlcyB0aGUgcXVlcnkuXG4gKiBAcGFyYW0ge1NpZXN0YU1vZGVsfSBvYmpcbiAqIEByZXR1cm5zIHtib29sZWFufVxuICovXG5mdW5jdGlvbiBvYmplY3RNYXRjaGVzUXVlcnkob2JqKSB7XG4gICAgdmFyIGZpZWxkcyA9IE9iamVjdC5rZXlzKHRoaXMucXVlcnkpO1xuICAgIGZvciAodmFyIGk9MDsgaTxmaWVsZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGZpZWxkID0gZmllbGRzW2ldO1xuICAgICAgIGlmIChvYmpbZmllbGRdICE9IHRoaXMucXVlcnlbZmllbGRdKSB7XG4gICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xufVxuXG4vKipcbiAqIElmIHRoZSBzdG9yYWdlIGV4dGVuc2lvbiBpcyBub3QgZW5hYmxlZCwgd2Ugc2ltcGx5IGN5Y2xlIHRocm91Z2ggYWxsIG9iamVjdHMgb2YgdGhlIHR5cGUgcmVxdWVzdGVkIGluIG1lbW9yeS5cbiAqIEBwYXJhbSBjYWxsYmFja1xuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX2V4ZWN1dGVJbk1lbW9yeShjYWxsYmFjaykge1xuICAgIHZhciBkZWZlcnJlZCA9IHEuZGVmZXIoKTtcbiAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgIHZhciBjYWNoZUJ5VHlwZSA9IGNhY2hlLl9sb2NhbENhY2hlQnlUeXBlO1xuICAgIHZhciBtYXBwaW5nTmFtZSA9IHRoaXMubWFwcGluZy50eXBlO1xuICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IHRoaXMubWFwcGluZy5jb2xsZWN0aW9uO1xuICAgIHZhciBjYWNoZUJ5TWFwcGluZyA9IGNhY2hlQnlUeXBlW2NvbGxlY3Rpb25OYW1lXTtcbiAgICB2YXIgY2FjaGVCeUxvY2FsSWQ7XG4gICAgaWYgKGNhY2hlQnlNYXBwaW5nKSB7XG4gICAgICAgIGNhY2hlQnlMb2NhbElkID0gY2FjaGVCeU1hcHBpbmdbbWFwcGluZ05hbWVdO1xuICAgIH1cbiAgICBpZiAoY2FjaGVCeUxvY2FsSWQpIHtcbiAgICAgICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhjYWNoZUJ5TG9jYWxJZCk7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgdmFyIG1hdGNoZXMgPSBfLnJlZHVjZShrZXlzLCBmdW5jdGlvbiAobWVtbywgaykge1xuICAgICAgICAgICAgdmFyIG9iaiA9IGNhY2hlQnlMb2NhbElkW2tdO1xuICAgICAgICAgICAgaWYgKG9iamVjdE1hdGNoZXNRdWVyeS5jYWxsKHNlbGYsIG9iaikpIG1lbW8ucHVzaChvYmopO1xuICAgICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgIH0sIFtdKTtcbiAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhudWxsLCBtYXRjaGVzKTtcbiAgICB9XG4gICAgZWxzZSBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgW10pO1xuICAgIH1cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn1cblxuUXVlcnkucHJvdG90eXBlLmV4ZWN1dGUgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICB2YXIgZGVmZXJyZWQgPSBxLmRlZmVyKCk7XG4gICAgY2FsbGJhY2sgPSB1dGlsLmNvbnN0cnVjdENhbGxiYWNrQW5kUHJvbWlzZUhhbmRsZXIoY2FsbGJhY2ssIGRlZmVycmVkKTtcbiAgICBpZiAoc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCkge1xuICAgICAgICBfZXhlY3V0ZVVzaW5nU3RvcmFnZUV4dGVuc2lvbi5jYWxsKHRoaXMsIGNhbGxiYWNrKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIF9leGVjdXRlSW5NZW1vcnkuY2FsbCh0aGlzLCBjYWxsYmFjayk7XG4gICAgfVxuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufTtcblxuUXVlcnkucHJvdG90eXBlLl9kdW1wID0gZnVuY3Rpb24gKGFzSnNvbikge1xuICAgIC8vIFRPRE9cbiAgICByZXR1cm4gYXNKc29uID8gJ3t9JyA6IHt9O1xufTtcblxuZXhwb3J0cy5RdWVyeSA9IFF1ZXJ5O1xuXG5cbiIsInZhciBSZXN0RXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuUmVzdEVycm9yO1xudmFyIFN0b3JlID0gcmVxdWlyZSgnLi9zdG9yZScpO1xudmFyIHEgPSByZXF1aXJlKCdxJyk7XG5cblxuUmVsYXRpb25zaGlwVHlwZSA9IHtcbiAgICBPbmVUb01hbnk6ICdPbmVUb01hbnknLFxuICAgIE9uZVRvT25lOiAnT25lVG9PbmUnLFxuICAgIE1hbnlUb01hbnk6ICdNYW55VG9NYW55J1xufTtcblxuZnVuY3Rpb24gUmVsYXRlZE9iamVjdFByb3h5KHJlbGF0aW9uc2hpcCwgb2JqZWN0KSB7XG4gICAgdGhpcy5yZWxhdGlvbnNoaXAgPSByZWxhdGlvbnNoaXA7XG4gICAgdGhpcy5vYmplY3QgPSBvYmplY3Q7XG4gICAgdGhpcy5faWQgPSBudWxsO1xuICAgIHRoaXMucmVsYXRlZE9iamVjdCA9IG51bGw7XG59XG5cblJlbGF0ZWRPYmplY3RQcm94eS5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgdmFyIGRlZmVycmVkID0gcS5kZWZlcigpO1xuICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHRoaXMucmVsYXRpb25zaGlwLmdldFJlbGF0ZWQodGhpcy5vYmplY3QsIGZ1bmN0aW9uIChlcnIsIHJlbGF0ZWQpIHtcbiAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgIHNlbGYucmVsYXRlZE9iamVjdCA9IHJlbGF0ZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIsIHJlbGF0ZWQpO1xuICAgIH0pO1xuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufTtcblxuUmVsYXRlZE9iamVjdFByb3h5LnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiAob2JqLCBjYWxsYmFjaykge1xuICAgIHZhciBkZWZlcnJlZCA9IHEuZGVmZXIoKTtcbiAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgIHRoaXMucmVsYXRpb25zaGlwLnNldFJlbGF0ZWQodGhpcy5vYmplY3QsIG9iaiwgY2FsbGJhY2spO1xuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufTtcblxuUmVsYXRlZE9iamVjdFByb3h5LnByb3RvdHlwZS5yZW1vdmUgPSBmdW5jdGlvbiAob2JqLCBjYWxsYmFjaykge1xuICAgIHZhciBkZWZlcnJlZCA9IHEuZGVmZXIoKTtcbiAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgIHRoaXMucmVsYXRpb25zaGlwLnJlbW92ZVJlbGF0ZWQodGhpcy5vYmplY3QsIG9iaiwgY2FsbGJhY2spO1xuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufTtcblxuUmVsYXRlZE9iamVjdFByb3h5LnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiAob2JqLCBjYWxsYmFjaykge1xuICAgIHZhciBkZWZlcnJlZCA9IHEuZGVmZXIoKTtcbiAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgIHRoaXMucmVsYXRpb25zaGlwLmFkZFJlbGF0ZWQodGhpcy5vYmplY3QsIG9iaiwgY2FsbGJhY2spO1xuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufTtcblxuUmVsYXRlZE9iamVjdFByb3h5LnByb3RvdHlwZS5pc0ZhdWx0ID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLl9pZCkge1xuICAgICAgICByZXR1cm4gIXRoaXMucmVsYXRlZE9iamVjdDtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlOyAvLyBJZiBubyBvYmplY3QgaXMgcmVsYXRlZCB0aGVuIGltcGxpY2l0bHkgdGhpcyBpcyBub3QgYSBmYXVsdC5cbn07XG5cblxuZnVuY3Rpb24gUmVsYXRpb25zaGlwKG5hbWUsIHJldmVyc2VOYW1lLCBtYXBwaW5nLCByZXZlcnNlTWFwcGluZykge1xuICAgIGlmICghdGhpcykge1xuICAgICAgICByZXR1cm4gbmV3IFJlbGF0aW9uc2hpcChuYW1lLCByZXZlcnNlTmFtZSwgbWFwcGluZywgcmV2ZXJzZU1hcHBpbmcpO1xuICAgIH1cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdGhpcy5tYXBwaW5nID0gbWFwcGluZztcbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgIHRoaXMuX3JldmVyc2VOYW1lID0gcmV2ZXJzZU5hbWU7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdyZXZlcnNlTmFtZScsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoc2VsZi5fcmV2ZXJzZU5hbWUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc2VsZi5fcmV2ZXJzZU5hbWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJ3JldmVyc2VfJyArIHNlbGYubmFtZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIHRoaXMucmV2ZXJzZU1hcHBpbmcgPSByZXZlcnNlTWFwcGluZztcbn1cblxuLy9ub2luc3BlY3Rpb24gSlNVbnVzZWRMb2NhbFN5bWJvbHNcblJlbGF0aW9uc2hpcC5wcm90b3R5cGUuZ2V0UmVsYXRlZCA9IGZ1bmN0aW9uIChvYmosIGNhbGxiYWNrKSB7XG4gICAgdGhyb3cgRXJyb3IoJ1JlbGF0aW9uc2hpcC5nZXRSZWxhdGVkIG11c3QgYmUgb3ZlcnJpZGRlbicpO1xufTtcblxuLy9ub2luc3BlY3Rpb24gSlNVbnVzZWRMb2NhbFN5bWJvbHNcblJlbGF0aW9uc2hpcC5wcm90b3R5cGUuc2V0UmVsYXRlZCA9IGZ1bmN0aW9uIChvYmosIHJlbGF0ZWQsIGNhbGxiYWNrKSB7XG4gICAgdGhyb3cgRXJyb3IoJ1JlbGF0aW9uc2hpcC5zZXRSZWxhdGVkIG11c3QgYmUgb3ZlcnJpZGRlbicpO1xufTtcblxuUmVsYXRpb25zaGlwLnByb3RvdHlwZS5pc0ZvcndhcmQgPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgcmV0dXJuIG9iai5tYXBwaW5nID09PSB0aGlzLm1hcHBpbmc7XG59O1xuXG5SZWxhdGlvbnNoaXAucHJvdG90eXBlLmlzUmV2ZXJzZSA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICByZXR1cm4gb2JqLm1hcHBpbmcgPT09IHRoaXMucmV2ZXJzZU1hcHBpbmc7XG59O1xuXG5SZWxhdGlvbnNoaXAucHJvdG90eXBlLmNvbnRyaWJ1dGVUb1NpZXN0YU1vZGVsID0gZnVuY3Rpb24gKG9iaikge1xuICAgIGlmICh0aGlzLmlzRm9yd2FyZChvYmopKSB7XG4gICAgICAgIG9ialt0aGlzLm5hbWVdID0gbmV3IFJlbGF0ZWRPYmplY3RQcm94eSh0aGlzLCBvYmopO1xuICAgIH1cbiAgICBlbHNlIGlmICh0aGlzLmlzUmV2ZXJzZShvYmopKSB7XG4gICAgICAgIG9ialt0aGlzLnJldmVyc2VOYW1lXSA9IG5ldyBSZWxhdGVkT2JqZWN0UHJveHkodGhpcywgb2JqKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBSZXN0RXJyb3IoJ0Nhbm5vdCBjb250cmlidXRlIHRvIG9iamVjdCBhcyB0aGlzIHJlbGF0aW9uc2hpcCBoYXMgbmVpdGhlciBhIGZvcndhcmQgb3IgcmV2ZXJzZSBtYXBwaW5nIHRoYXQgbWF0Y2hlcycsIHtyZWxhdGlvbnNoaXA6IHRoaXMsIG9iajogb2JqfSk7XG4gICAgfVxufTtcblxuUmVsYXRpb25zaGlwLnByb3RvdHlwZS5zZXRSZWxhdGVkQnlJZCA9IGZ1bmN0aW9uIChvYmosIHJlbGF0ZWRJZCwgY2FsbGJhY2spIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGRlZmVycmVkID0gcS5kZWZlcigpO1xuICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgU3RvcmUuZ2V0KHtfaWQ6IHJlbGF0ZWRJZH0sIGZ1bmN0aW9uIChlcnIsIHJlbGF0ZWQpIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHNlbGYuc2V0UmVsYXRlZChvYmosIHJlbGF0ZWQsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufTtcblxuUmVsYXRpb25zaGlwLnByb3RvdHlwZS5fZHVtcCA9IGZ1bmN0aW9uIChhc0pTT04pIHtcbiAgICB2YXIgb2JqID0ge307XG4gICAgb2JqLmZvcndhcmQgPSB7XG4gICAgICAgIG5hbWU6IHRoaXMubmFtZSxcbiAgICAgICAgbWFwcGluZzogdGhpcy5tYXBwaW5nLnR5cGVcbiAgICB9O1xuICAgIG9iai5yZXZlcnNlID0ge1xuICAgICAgICBuYW1lOiB0aGlzLnJldmVyc2VOYW1lLFxuICAgICAgICBtYXBwaW5nOiB0aGlzLnJldmVyc2VNYXBwaW5nLnR5cGVcbiAgICB9O1xuICAgIHJldHVybiBhc0pTT04gPyBKU09OLnN0cmluZ2lmeShvYmosIG51bGwsIDQpIDogb2JqO1xufTtcblxuXG5leHBvcnRzLlJlbGF0aW9uc2hpcCA9IFJlbGF0aW9uc2hpcDtcbmV4cG9ydHMuUmVsYXRlZE9iamVjdFByb3h5ID0gUmVsYXRlZE9iamVjdFByb3h5O1xuZXhwb3J0cy5SZWxhdGlvbnNoaXBUeXBlID0gUmVsYXRpb25zaGlwVHlwZTsiLCJ2YXIgd3JhcHBlZENhbGxiYWNrID0gcmVxdWlyZSgnLi9taXNjJykud3JhcHBlZENhbGxiYWNrO1xudmFyIFJlc3RFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5SZXN0RXJyb3I7XG52YXIgbG9nID0gcmVxdWlyZSgnLi4vdmVuZG9yL29wZXJhdGlvbnMuanMvc3JjL2xvZycpO1xudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnU3RvcmUnKTtcbkxvZ2dlci5zZXRMZXZlbChsb2cuTGV2ZWwud2Fybik7XG5cbnZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XG52YXIgXyA9IHV0aWwuXztcbnZhciBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKTtcbnZhciBxID0gcmVxdWlyZSgncScpO1xuXG5cbmZ1bmN0aW9uIGdldChvcHRzLCBjYWxsYmFjaykge1xuICAgIHZhciBkZWZlcnJlZCA9IHEuZGVmZXIoKTtcbiAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgIGlmIChMb2dnZXIuZGVidWcuaXNFbmFibGVkKVxuICAgICAgICBMb2dnZXIuZGVidWcoJ2dldCcsIG9wdHMpO1xuICAgIHZhciBzaWVzdGFNb2RlbDtcbiAgICBpZiAob3B0cy5faWQpIHtcbiAgICAgICAgaWYgKHV0aWwuaXNBcnJheShvcHRzLl9pZCkpIHtcbiAgICAgICAgICAgIC8vIFByb3h5IG9udG8gZ2V0TXVsdGlwbGUgaW5zdGVhZC5cbiAgICAgICAgICAgIGdldE11bHRpcGxlKF8ubWFwKG9wdHMuX2lkLCBmdW5jdGlvbiAoaWQpIHtyZXR1cm4ge19pZDogaWR9fSksIGNhbGxiYWNrKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHNpZXN0YU1vZGVsID0gY2FjaGUuZ2V0KG9wdHMpO1xuICAgICAgICAgICAgaWYgKHNpZXN0YU1vZGVsKSB7XG4gICAgICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnSGFkIGNhY2hlZCBvYmplY3QnLCB7b3B0czogb3B0cywgb2JqOiBzaWVzdGFNb2RlbH0pO1xuICAgICAgICAgICAgICAgIHdyYXBwZWRDYWxsYmFjayhjYWxsYmFjaykobnVsbCwgc2llc3RhTW9kZWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheShvcHRzLl9pZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gUHJveHkgb250byBnZXRNdWx0aXBsZSBpbnN0ZWFkLlxuICAgICAgICAgICAgICAgICAgICBnZXRNdWx0aXBsZShfLm1hcChvcHRzLl9pZCwgZnVuY3Rpb24gKGlkKSB7cmV0dXJuIHtfaWQ6IGlkfX0pLCBjYWxsYmFjayk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzdG9yYWdlID0gc2llc3RhLmV4dC5zdG9yYWdlO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc3RvcmFnZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RvcmFnZS5zdG9yZS5nZXRGcm9tUG91Y2gob3B0cywgY2FsbGJhY2spO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgJ1N0b3JhZ2UgbW9kdWxlIG5vdCBpbnN0YWxsZWQnXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSBpZiAob3B0cy5tYXBwaW5nKSB7XG4gICAgICAgIGlmICh1dGlsLmlzQXJyYXkob3B0c1tvcHRzLm1hcHBpbmcuaWRdKSkge1xuICAgICAgICAgICAgLy8gUHJveHkgb250byBnZXRNdWx0aXBsZSBpbnN0ZWFkLlxuICAgICAgICAgICAgZ2V0TXVsdGlwbGUoXy5tYXAob3B0c1tvcHRzLm1hcHBpbmcuaWRdLCBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgICAgICAgICB2YXIgbyA9IHt9O1xuICAgICAgICAgICAgICAgIG9bb3B0cy5tYXBwaW5nLmlkXSA9IGlkO1xuICAgICAgICAgICAgICAgIG8ubWFwcGluZyA9IG9wdHMubWFwcGluZztcbiAgICAgICAgICAgICAgICByZXR1cm4gb1xuICAgICAgICAgICAgfSksIGNhbGxiYWNrKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHNpZXN0YU1vZGVsID0gY2FjaGUuZ2V0KG9wdHMpO1xuICAgICAgICAgICAgaWYgKHNpZXN0YU1vZGVsKSB7XG4gICAgICAgICAgICAgICAgaWYgKExvZ2dlci5kZWJ1Zy5pc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgIExvZ2dlci5kZWJ1ZygnSGFkIGNhY2hlZCBvYmplY3QnLCB7b3B0czogb3B0cywgb2JqOiBzaWVzdGFNb2RlbH0pO1xuICAgICAgICAgICAgICAgIHdyYXBwZWRDYWxsYmFjayhjYWxsYmFjaykobnVsbCwgc2llc3RhTW9kZWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIG1hcHBpbmcgPSBvcHRzLm1hcHBpbmc7XG4gICAgICAgICAgICAgICAgaWYgKG1hcHBpbmcuc2luZ2xldG9uKSB7XG4gICAgICAgICAgICAgICAgICAgIG1hcHBpbmcuZ2V0KGNhbGxiYWNrKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBpZEZpZWxkID0gbWFwcGluZy5pZDtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGlkID0gb3B0c1tpZEZpZWxkXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtYXBwaW5nLmdldChpZCwgZnVuY3Rpb24gKGVyciwgb2JqKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9iaikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgb2JqKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIG51bGwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgd3JhcHBlZENhbGxiYWNrKGNhbGxiYWNrKShuZXcgUmVzdEVycm9yKCdJbnZhbGlkIG9wdGlvbnMgZ2l2ZW4gdG8gc3RvcmUuIE1pc3NpbmcgXCInICsgaWRGaWVsZC50b1N0cmluZygpICsgJy5cIicsIHtvcHRzOiBvcHRzfSkpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIC8vIE5vIHdheSBpbiB3aGljaCB0byBmaW5kIGFuIG9iamVjdCBsb2NhbGx5LlxuICAgICAgICB2YXIgY29udGV4dCA9IHtvcHRzOiBvcHRzfTtcbiAgICAgICAgdmFyIG1zZyA9ICdJbnZhbGlkIG9wdGlvbnMgZ2l2ZW4gdG8gc3RvcmUnO1xuICAgICAgICBMb2dnZXIuZXJyb3IobXNnLCBjb250ZXh0KTtcbiAgICAgICAgd3JhcHBlZENhbGxiYWNrKGNhbGxiYWNrKShuZXcgUmVzdEVycm9yKG1zZywgY29udGV4dCkpO1xuICAgIH1cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn1cblxuZnVuY3Rpb24gZ2V0TXVsdGlwbGUob3B0c0FycmF5LCBjYWxsYmFjaykge1xuICAgIHZhciBkZWZlcnJlZCA9IHEuZGVmZXIoKTtcbiAgICBjYWxsYmFjayA9IHV0aWwuY29uc3RydWN0Q2FsbGJhY2tBbmRQcm9taXNlSGFuZGxlcihjYWxsYmFjaywgZGVmZXJyZWQpO1xuICAgIHZhciBkb2NzID0gW107XG4gICAgdmFyIGVycm9ycyA9IFtdO1xuICAgIF8uZWFjaChvcHRzQXJyYXksIGZ1bmN0aW9uIChvcHRzKSB7XG4gICAgICAgIGdldChvcHRzLCBmdW5jdGlvbiAoZXJyLCBkb2MpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBlcnJvcnMucHVzaChlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgZG9jcy5wdXNoKGRvYyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZG9jcy5sZW5ndGggKyBlcnJvcnMubGVuZ3RoID09IG9wdHNBcnJheS5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycm9ycy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycm9ycyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCBkb2NzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59XG4vKipcbiAqIFVzZXMgcG91Y2ggYnVsayBmZXRjaCBBUEkuIE11Y2ggZmFzdGVyIHRoYW4gZ2V0TXVsdGlwbGUuXG4gKiBAcGFyYW0gbG9jYWxJZGVudGlmaWVyc1xuICogQHBhcmFtIGNhbGxiYWNrXG4gKi9cbmZ1bmN0aW9uIGdldE11bHRpcGxlTG9jYWwgKGxvY2FsSWRlbnRpZmllcnMsIGNhbGxiYWNrKSB7XG4gICAgdmFyIGRlZmVycmVkID0gcS5kZWZlcigpO1xuICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgdmFyIHJlc3VsdHMgPSBfLnJlZHVjZShsb2NhbElkZW50aWZpZXJzLCBmdW5jdGlvbiAobWVtbywgX2lkKSB7XG4gICAgICAgIHZhciBvYmogPSBjYWNoZS5nZXQoe19pZDogX2lkfSk7XG4gICAgICAgIGlmIChvYmopIHtcbiAgICAgICAgICAgIG1lbW8uY2FjaGVkW19pZF0gPSBvYmo7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBtZW1vLm5vdENhY2hlZC5wdXNoKF9pZCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgfSwge2NhY2hlZDoge30sIG5vdENhY2hlZDogW119KTtcblxuICAgIGZ1bmN0aW9uIGZpbmlzaChlcnIpIHtcbiAgICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIF8ubWFwKGxvY2FsSWRlbnRpZmllcnMsIGZ1bmN0aW9uIChfaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdHMuY2FjaGVkW19pZF07XG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHJlc3VsdHMubm90Q2FjaGVkLmxlbmd0aCkge1xuICAgICAgICBzaWVzdGEuZXh0LnN0b3JhZ2Uuc3RvcmUuZ2V0TXVsdGlwbGVMb2NhbEZyb21Db3VjaChyZXN1bHRzLCBmaW5pc2gpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgZmluaXNoKCk7XG4gICAgfVxuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufVxuXG5mdW5jdGlvbiBnZXRNdWx0aXBsZVJlbW90ZSAocmVtb3RlSWRlbnRpZmllcnMsIG1hcHBpbmcsIGNhbGxiYWNrKSB7XG4gICAgdmFyIGRlZmVycmVkID0gcS5kZWZlcigpO1xuICAgIGNhbGxiYWNrID0gdXRpbC5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyKGNhbGxiYWNrLCBkZWZlcnJlZCk7XG4gICAgdmFyIHJlc3VsdHMgPSBfLnJlZHVjZShyZW1vdGVJZGVudGlmaWVycywgZnVuY3Rpb24gKG1lbW8sIGlkKSB7XG4gICAgICAgIHZhciBjYWNoZVF1ZXJ5ID0ge21hcHBpbmc6IG1hcHBpbmd9O1xuICAgICAgICBjYWNoZVF1ZXJ5W21hcHBpbmcuaWRdID0gaWQ7XG4gICAgICAgIHZhciBvYmogPSBjYWNoZS5nZXQoY2FjaGVRdWVyeSk7XG4gICAgICAgIGlmIChvYmopIHtcbiAgICAgICAgICAgIG1lbW8uY2FjaGVkW2lkXSA9IG9iajtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIG1lbW8ubm90Q2FjaGVkLnB1c2goaWQpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtZW1vO1xuICAgIH0sIHtjYWNoZWQ6IHt9LCBub3RDYWNoZWQ6IFtdfSk7XG5cbiAgICBmdW5jdGlvbiBmaW5pc2goZXJyKSB7XG4gICAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCBfLm1hcChyZW1vdGVJZGVudGlmaWVycywgZnVuY3Rpb24gKGlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHRzLmNhY2hlZFtpZF07XG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHJlc3VsdHMubm90Q2FjaGVkLmxlbmd0aCkge1xuICAgICAgICBzaWVzdGEuZXh0LnN0b3JhZ2Uuc3RvcmUuZ2V0TXVsdGlwbGVSZW1vdGVGcm9tcG91Y2gobWFwcGluZywgcmVtb3RlSWRlbnRpZmllcnMsIHJlc3VsdHMsIGZpbmlzaCk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBmaW5pc2goKTtcbiAgICB9XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59XG5cbmV4cG9ydHMuZ2V0ID0gZ2V0O1xuZXhwb3J0cy5nZXRNdWx0aXBsZSA9IGdldE11bHRpcGxlO1xuZXhwb3J0cy5nZXRNdWx0aXBsZUxvY2FsID0gZ2V0TXVsdGlwbGVMb2NhbDtcbmV4cG9ydHMuZ2V0TXVsdGlwbGVSZW1vdGUgPSBnZXRNdWx0aXBsZVJlbW90ZTsiLCIvKiB1dGlsLmpzXG4gKiA9PT09PT09XG4gKlxuICogVGhpcyBpcyBhIGNvbGxlY3Rpb24gb2YgdXRpbGl0aWVzIHRha2VuIGZyb20gbGlicmFyaWVzIHN1Y2ggYXMgYXN5bmMuanMsIHVuZGVyc2NvcmUuanMgZXRjLlxuICogVGhpcyBpcyB0byBhdm9pZCBibG9hdGluZyBzaWVzdGEuanMuXG4gKi9cblxuZnVuY3Rpb24gcHJpbnRTdGFja1RyYWNlKCkge1xuICAgIHZhciBlID0gbmV3IEVycm9yKCdwcmludFN0YWNrVHJhY2UnKTtcbiAgICB2YXIgc3RhY2sgPSBlLnN0YWNrO1xuICAgIGNvbnNvbGUubG9nKHN0YWNrKTtcbn1cblxuZnVuY3Rpb24gY2FwaXRhbGlzZUZpcnN0TGV0dGVyKHN0cmluZykge1xuICAgIHJldHVybiBzdHJpbmcuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBzdHJpbmcuc2xpY2UoMSk7XG59XG5cbmV4cG9ydHMucHJpbnRTdGFja1RyYWNlID0gcHJpbnRTdGFja1RyYWNlO1xuZXhwb3J0cy5jYXBpdGFsaXNlRmlyc3RMZXR0ZXIgPSBjYXBpdGFsaXNlRmlyc3RMZXR0ZXI7XG5cbnZhciByb290ID0ge307XG4vLyBTVEFSVCBhc3luYy5qcyAvL1xuXG52YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKG9iaikge1xuICAgIHJldHVybiBfdG9TdHJpbmcuY2FsbChvYmopID09PSAnW29iamVjdCBBcnJheV0nO1xufTtcblxuZnVuY3Rpb24gZG9QYXJhbGxlbChmbikge1xuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgICAgcmV0dXJuIGZuLmFwcGx5KG51bGwsIFtlYWNoXS5jb25jYXQoYXJncykpO1xuICAgIH07XG59XG5cbnZhciBtYXAgPSBkb1BhcmFsbGVsKF9hc3luY01hcCk7XG5cbmZ1bmN0aW9uIF9tYXAoYXJyLCBpdGVyYXRvcikge1xuICAgIGlmIChhcnIubWFwKSB7XG4gICAgICAgIHJldHVybiBhcnIubWFwKGl0ZXJhdG9yKTtcbiAgICB9XG4gICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICBlYWNoKGFyciwgZnVuY3Rpb24gKHgsIGksIGEpIHtcbiAgICAgICAgcmVzdWx0cy5wdXNoKGl0ZXJhdG9yKHgsIGksIGEpKTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0cztcbn1cblxuZnVuY3Rpb24gX2FzeW5jTWFwKGVhY2hmbiwgYXJyLCBpdGVyYXRvciwgY2FsbGJhY2spIHtcbiAgICBhcnIgPSBfbWFwKGFyciwgZnVuY3Rpb24gKHgsIGkpIHtcbiAgICAgICAgcmV0dXJuIHtpbmRleDogaSwgdmFsdWU6IHh9O1xuICAgIH0pO1xuICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgZWFjaGZuKGFyciwgZnVuY3Rpb24gKHgsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBpdGVyYXRvcih4LnZhbHVlLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgICAgICBlYWNoZm4oYXJyLCBmdW5jdGlvbiAoeCwgY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGl0ZXJhdG9yKHgudmFsdWUsIGZ1bmN0aW9uIChlcnIsIHYpIHtcbiAgICAgICAgICAgICAgICByZXN1bHRzW3guaW5kZXhdID0gdjtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgcmVzdWx0cyk7XG4gICAgICAgIH0pO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gX2VhY2goYXJyLCBpdGVyYXRvcikge1xuICAgIGlmIChhcnIuZm9yRWFjaCkge1xuICAgICAgICByZXR1cm4gYXJyLmZvckVhY2goaXRlcmF0b3IpO1xuICAgIH1cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICBpdGVyYXRvcihhcnJbaV0sIGksIGFycik7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBlYWNoKGFyciwgaXRlcmF0b3IsIGNhbGxiYWNrKSB7XG4gICAgY2FsbGJhY2sgPSBjYWxsYmFjayB8fCBmdW5jdGlvbiAoKSB7fTtcbiAgICBpZiAoIWFyci5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKCk7XG4gICAgfVxuICAgIHZhciBjb21wbGV0ZWQgPSAwO1xuICAgIF9lYWNoKGFyciwgZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgaXRlcmF0b3IoeCwgb25seV9vbmNlKGRvbmUpKTtcbiAgICB9KTtcbiAgICBmdW5jdGlvbiBkb25lKGVycikge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgY2FsbGJhY2sgPSBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNvbXBsZXRlZCArPSAxO1xuICAgICAgICAgICAgaWYgKGNvbXBsZXRlZCA+PSBhcnIubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24ga2V5cyhvYmopIHtcbiAgICBpZiAoT2JqZWN0LmtleXMpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKG9iaik7XG4gICAgfVxuICAgIHZhciBrZXlzID0gW107XG4gICAgZm9yICh2YXIgayBpbiBvYmopIHtcbiAgICAgICAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShrKSkge1xuICAgICAgICAgICAga2V5cy5wdXNoKGspO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBrZXlzO1xufVxuXG5cbnZhciBfcGFyYWxsZWwgPSBmdW5jdGlvbiAoZWFjaGZuLCB0YXNrcywgY2FsbGJhY2spIHtcbiAgICBjYWxsYmFjayA9IGNhbGxiYWNrIHx8IGZ1bmN0aW9uICgpIHt9O1xuICAgIGlmIChpc0FycmF5KHRhc2tzKSkge1xuICAgICAgICBlYWNoZm4ubWFwKHRhc2tzLCBmdW5jdGlvbiAoZm4sIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBpZiAoZm4pIHtcbiAgICAgICAgICAgICAgICBmbihmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoIDw9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3MgPSBhcmdzWzBdO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrLmNhbGwobnVsbCwgZXJyLCBhcmdzKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgY2FsbGJhY2spO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdmFyIHJlc3VsdHMgPSB7fTtcbiAgICAgICAgZWFjaGZuLmVhY2goa2V5cyh0YXNrcyksIGZ1bmN0aW9uIChrLCBjYWxsYmFjaykge1xuICAgICAgICAgICAgdGFza3Nba10oZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICAgICAgICBpZiAoYXJncy5sZW5ndGggPD0gMSkge1xuICAgICAgICAgICAgICAgICAgICBhcmdzID0gYXJnc1swXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVzdWx0c1trXSA9IGFyZ3M7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhlcnIsIHJlc3VsdHMpO1xuICAgICAgICB9KTtcbiAgICB9XG59O1xuXG5cbmZ1bmN0aW9uIG9ubHlfb25jZShmbikge1xuICAgIHZhciBjYWxsZWQgPSBmYWxzZTtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoY2FsbGVkKSB0aHJvdyBuZXcgRXJyb3IoXCJDYWxsYmFjayB3YXMgYWxyZWFkeSBjYWxsZWQuXCIpO1xuICAgICAgICBjYWxsZWQgPSB0cnVlO1xuICAgICAgICBmbi5hcHBseShyb290LCBhcmd1bWVudHMpO1xuICAgIH1cbn1cblxuZXhwb3J0cy5wYXJhbGxlbCA9IGZ1bmN0aW9uICh0YXNrcywgY2FsbGJhY2spIHtcbiAgICBfcGFyYWxsZWwoeyBtYXA6IG1hcCwgZWFjaDogZWFjaCB9LCB0YXNrcywgY2FsbGJhY2spO1xufTtcblxuZXhwb3J0cy5pc0FycmF5ID0gaXNBcnJheTtcblxuLy8gRU5EIGFzeW5jLmpzIC8vXG5cbi8vIFNUQVJUIHVuZGVyc2NvcmUuanMgLy9cblxudmFyIF8gPSB7fTtcbnZhciBBcnJheVByb3RvID0gQXJyYXkucHJvdG90eXBlO1xudmFyIEZ1bmNQcm90byA9IEZ1bmN0aW9uLnByb3RvdHlwZTtcblxudmFyIG5hdGl2ZUZvckVhY2ggPSBBcnJheVByb3RvLmZvckVhY2g7XG52YXIgbmF0aXZlTWFwID0gQXJyYXlQcm90by5tYXA7XG52YXIgbmF0aXZlUmVkdWNlID0gQXJyYXlQcm90by5yZWR1Y2U7XG52YXIgbmF0aXZlQmluZCA9IEZ1bmNQcm90by5iaW5kO1xudmFyIHNsaWNlID0gQXJyYXlQcm90by5zbGljZTtcbnZhciBicmVha2VyID0ge307XG5cbl8ua2V5cyA9IGtleXM7XG5cbl8uZWFjaCA9IF8uZm9yRWFjaCA9IGZ1bmN0aW9uIChvYmosIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gb2JqO1xuICAgIGlmIChuYXRpdmVGb3JFYWNoICYmIG9iai5mb3JFYWNoID09PSBuYXRpdmVGb3JFYWNoKSB7XG4gICAgICAgIG9iai5mb3JFYWNoKGl0ZXJhdG9yLCBjb250ZXh0KTtcbiAgICB9IGVsc2UgaWYgKG9iai5sZW5ndGggPT09ICtvYmoubGVuZ3RoKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBvYmoubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChpdGVyYXRvci5jYWxsKGNvbnRleHQsIG9ialtpXSwgaSwgb2JqKSA9PT0gYnJlYWtlcikgcmV0dXJuO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGtleXMgPSBfLmtleXMob2JqKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGtleXMubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChpdGVyYXRvci5jYWxsKGNvbnRleHQsIG9ialtrZXlzW2ldXSwga2V5c1tpXSwgb2JqKSA9PT0gYnJlYWtlcikgcmV0dXJuO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBvYmo7XG59O1xuXG4vLyBSZXR1cm4gdGhlIHJlc3VsdHMgb2YgYXBwbHlpbmcgdGhlIGl0ZXJhdG9yIHRvIGVhY2ggZWxlbWVudC5cbi8vIERlbGVnYXRlcyB0byAqKkVDTUFTY3JpcHQgNSoqJ3MgbmF0aXZlIGBtYXBgIGlmIGF2YWlsYWJsZS5cbl8ubWFwID0gXy5jb2xsZWN0ID0gZnVuY3Rpb24gKG9iaiwgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIHJlc3VsdHM7XG4gICAgaWYgKG5hdGl2ZU1hcCAmJiBvYmoubWFwID09PSBuYXRpdmVNYXApIHJldHVybiBvYmoubWFwKGl0ZXJhdG9yLCBjb250ZXh0KTtcbiAgICBfLmVhY2gob2JqLCBmdW5jdGlvbiAodmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICAgIHJlc3VsdHMucHVzaChpdGVyYXRvci5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgbGlzdCkpO1xuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHRzO1xufTtcblxuLy8gUGFydGlhbGx5IGFwcGx5IGEgZnVuY3Rpb24gYnkgY3JlYXRpbmcgYSB2ZXJzaW9uIHRoYXQgaGFzIGhhZCBzb21lIG9mIGl0c1xuLy8gYXJndW1lbnRzIHByZS1maWxsZWQsIHdpdGhvdXQgY2hhbmdpbmcgaXRzIGR5bmFtaWMgYHRoaXNgIGNvbnRleHQuIF8gYWN0c1xuLy8gYXMgYSBwbGFjZWhvbGRlciwgYWxsb3dpbmcgYW55IGNvbWJpbmF0aW9uIG9mIGFyZ3VtZW50cyB0byBiZSBwcmUtZmlsbGVkLlxuXy5wYXJ0aWFsID0gZnVuY3Rpb24gKGZ1bmMpIHtcbiAgICB2YXIgYm91bmRBcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBwb3NpdGlvbiA9IDA7XG4gICAgICAgIHZhciBhcmdzID0gYm91bmRBcmdzLnNsaWNlKCk7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBhcmdzLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoYXJnc1tpXSA9PT0gXykgYXJnc1tpXSA9IGFyZ3VtZW50c1twb3NpdGlvbisrXTtcbiAgICAgICAgfVxuICAgICAgICB3aGlsZSAocG9zaXRpb24gPCBhcmd1bWVudHMubGVuZ3RoKSBhcmdzLnB1c2goYXJndW1lbnRzW3Bvc2l0aW9uKytdKTtcbiAgICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfTtcbn07XG5cbi8vIENvbnZlbmllbmNlIHZlcnNpb24gb2YgYSBjb21tb24gdXNlIGNhc2Ugb2YgYG1hcGA6IGZldGNoaW5nIGEgcHJvcGVydHkuXG5fLnBsdWNrID0gZnVuY3Rpb24gKG9iaiwga2V5KSB7XG4gICAgcmV0dXJuIF8ubWFwKG9iaiwgXy5wcm9wZXJ0eShrZXkpKTtcbn07XG5cbnZhciByZWR1Y2VFcnJvciA9ICdSZWR1Y2Ugb2YgZW1wdHkgYXJyYXkgd2l0aCBubyBpbml0aWFsIHZhbHVlJztcblxuLy8gKipSZWR1Y2UqKiBidWlsZHMgdXAgYSBzaW5nbGUgcmVzdWx0IGZyb20gYSBsaXN0IG9mIHZhbHVlcywgYWthIGBpbmplY3RgLFxuLy8gb3IgYGZvbGRsYC4gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYHJlZHVjZWAgaWYgYXZhaWxhYmxlLlxuXy5yZWR1Y2UgPSBfLmZvbGRsID0gXy5pbmplY3QgPSBmdW5jdGlvbiAob2JqLCBpdGVyYXRvciwgbWVtbywgY29udGV4dCkge1xuICAgIHZhciBpbml0aWFsID0gYXJndW1lbnRzLmxlbmd0aCA+IDI7XG4gICAgaWYgKG9iaiA9PSBudWxsKSBvYmogPSBbXTtcbiAgICBpZiAobmF0aXZlUmVkdWNlICYmIG9iai5yZWR1Y2UgPT09IG5hdGl2ZVJlZHVjZSkge1xuICAgICAgICBpZiAoY29udGV4dCkgaXRlcmF0b3IgPSBfLmJpbmQoaXRlcmF0b3IsIGNvbnRleHQpO1xuICAgICAgICByZXR1cm4gaW5pdGlhbCA/IG9iai5yZWR1Y2UoaXRlcmF0b3IsIG1lbW8pIDogb2JqLnJlZHVjZShpdGVyYXRvcik7XG4gICAgfVxuICAgIF8uZWFjaChvYmosIGZ1bmN0aW9uICh2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgICAgaWYgKCFpbml0aWFsKSB7XG4gICAgICAgICAgICBtZW1vID0gdmFsdWU7XG4gICAgICAgICAgICBpbml0aWFsID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG1lbW8gPSBpdGVyYXRvci5jYWxsKGNvbnRleHQsIG1lbW8sIHZhbHVlLCBpbmRleCwgbGlzdCk7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBpZiAoIWluaXRpYWwpIHRocm93IG5ldyBUeXBlRXJyb3IocmVkdWNlRXJyb3IpO1xuICAgIHJldHVybiBtZW1vO1xufTtcblxuXy5wcm9wZXJ0eSA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKG9iaikge1xuICAgICAgICByZXR1cm4gb2JqW2tleV07XG4gICAgfTtcbn07XG5cbi8vIE9wdGltaXplIGBpc0Z1bmN0aW9uYCBpZiBhcHByb3ByaWF0ZS5cbmlmICh0eXBlb2YgKC8uLykgIT09ICdmdW5jdGlvbicpIHtcbiAgICBfLmlzRnVuY3Rpb24gPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIHJldHVybiB0eXBlb2Ygb2JqID09PSAnZnVuY3Rpb24nO1xuICAgIH07XG59XG5cbi8vIEFuIGludGVybmFsIGZ1bmN0aW9uIHRvIGdlbmVyYXRlIGxvb2t1cCBpdGVyYXRvcnMuXG52YXIgbG9va3VwSXRlcmF0b3IgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICBpZiAodmFsdWUgPT0gbnVsbCkgcmV0dXJuIF8uaWRlbnRpdHk7XG4gICAgaWYgKF8uaXNGdW5jdGlvbih2YWx1ZSkpIHJldHVybiB2YWx1ZTtcbiAgICByZXR1cm4gXy5wcm9wZXJ0eSh2YWx1ZSk7XG59O1xuXG4vLyBTb3J0IHRoZSBvYmplY3QncyB2YWx1ZXMgYnkgYSBjcml0ZXJpb24gcHJvZHVjZWQgYnkgYW4gaXRlcmF0b3IuXG5fLnNvcnRCeSA9IGZ1bmN0aW9uIChvYmosIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgaXRlcmF0b3IgPSBsb29rdXBJdGVyYXRvcihpdGVyYXRvcik7XG4gICAgcmV0dXJuIF8ucGx1Y2soXy5tYXAob2JqLCBmdW5jdGlvbiAodmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB2YWx1ZTogdmFsdWUsXG4gICAgICAgICAgICBpbmRleDogaW5kZXgsXG4gICAgICAgICAgICBjcml0ZXJpYTogaXRlcmF0b3IuY2FsbChjb250ZXh0LCB2YWx1ZSwgaW5kZXgsIGxpc3QpXG4gICAgICAgIH07XG4gICAgfSkuc29ydChmdW5jdGlvbiAobGVmdCwgcmlnaHQpIHtcbiAgICAgICAgdmFyIGEgPSBsZWZ0LmNyaXRlcmlhO1xuICAgICAgICB2YXIgYiA9IHJpZ2h0LmNyaXRlcmlhO1xuICAgICAgICBpZiAoYSAhPT0gYikge1xuICAgICAgICAgICAgaWYgKGEgPiBiIHx8IGEgPT09IHZvaWQgMCkgcmV0dXJuIDE7XG4gICAgICAgICAgICBpZiAoYSA8IGIgfHwgYiA9PT0gdm9pZCAwKSByZXR1cm4gLTE7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGxlZnQuaW5kZXggLSByaWdodC5pbmRleDtcbiAgICB9KSwgJ3ZhbHVlJyk7XG59O1xuXG52YXIgY3RvciA9IGZ1bmN0aW9uKCl7fTtcblxuLy8gQ3JlYXRlIGEgZnVuY3Rpb24gYm91bmQgdG8gYSBnaXZlbiBvYmplY3QgKGFzc2lnbmluZyBgdGhpc2AsIGFuZCBhcmd1bWVudHMsXG4vLyBvcHRpb25hbGx5KS4gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYEZ1bmN0aW9uLmJpbmRgIGlmXG4vLyBhdmFpbGFibGUuXG5fLmJpbmQgPSBmdW5jdGlvbiAoZnVuYywgY29udGV4dCkge1xuICAgIHZhciBhcmdzLCBib3VuZDtcbiAgICBpZiAobmF0aXZlQmluZCAmJiBmdW5jLmJpbmQgPT09IG5hdGl2ZUJpbmQpIHJldHVybiBuYXRpdmVCaW5kLmFwcGx5KGZ1bmMsIHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSk7XG4gICAgaWYgKCFfLmlzRnVuY3Rpb24oZnVuYykpIHRocm93IG5ldyBUeXBlRXJyb3I7XG4gICAgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICByZXR1cm4gYm91bmQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBib3VuZCkpIHJldHVybiBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MuY29uY2F0KHNsaWNlLmNhbGwoYXJndW1lbnRzKSkpO1xuICAgICAgICBjdG9yLnByb3RvdHlwZSA9IGZ1bmMucHJvdG90eXBlO1xuICAgICAgICB2YXIgc2VsZiA9IG5ldyBjdG9yO1xuICAgICAgICBjdG9yLnByb3RvdHlwZSA9IG51bGw7XG4gICAgICAgIHZhciByZXN1bHQgPSBmdW5jLmFwcGx5KHNlbGYsIGFyZ3MuY29uY2F0KHNsaWNlLmNhbGwoYXJndW1lbnRzKSkpO1xuICAgICAgICBpZiAoT2JqZWN0KHJlc3VsdCkgPT09IHJlc3VsdCkgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgcmV0dXJuIHNlbGY7XG4gICAgfTtcbn07XG5cblxuLy8gRU5EIHVuZGVyc2NvcmUuanMgLy9cblxuZXhwb3J0cy5fID0gXztcblxuXG52YXIgb2JzZXJ2ZSA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuUGxhdGZvcm07XG5cbi8qKlxuICogUGVyZm9ybXMgZGlydHkgY2hlY2svT2JqZWN0Lm9ic2VydmUgY2FsbGJhY2tzIGRlcGVuZGluZyBvbiB0aGUgYnJvd3Nlci5cbiAqXG4gKiBJZiBPYmplY3Qub2JzZXJ2ZSBpcyBwcmVzZW50LFxuICogQHBhcmFtIGNhbGxiYWNrXG4gKi9cbmV4cG9ydHMubmV4dCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIG9ic2VydmUucGVyZm9ybU1pY3JvdGFza0NoZWNrcG9pbnQoKTtcbiAgICBzZXRUaW1lb3V0KGNhbGxiYWNrKTtcbn07XG5cbi8qKlxuICogUmV0dXJucyBhIGhhbmRsZXIgdGhhdCBhY3RzIHVwb24gYSBjYWxsYmFjayBvciBhIHByb21pc2UgZGVwZW5kaW5nIG9uIHRoZSByZXN1bHQgb2YgYSBkaWZmZXJlbnQgY2FsbGJhY2suXG4gKiBAcGFyYW0gY2FsbGJhY2tcbiAqIEBwYXJhbSBbcHJvbWlzZV1cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn1cbiAqL1xuZXhwb3J0cy5jb25zdHJ1Y3RDYWxsYmFja0FuZFByb21pc2VIYW5kbGVyID0gZnVuY3Rpb24gKGNhbGxiYWNrLCBwcm9taXNlKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjay5hcHBseShjYWxsYmFjaywgYXJndW1lbnRzKTtcbiAgICAgICAgaWYgKHByb21pc2UpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHByb21pc2UucmVqZWN0KGVycik7XG4gICAgICAgICAgICBlbHNlIHByb21pc2UucmVzb2x2ZS5hcHBseShwcm9taXNlLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcbiAgICAgICAgfVxuICAgIH07XG59OyIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbi8qXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQgVGhlIFBvbHltZXIgUHJvamVjdCBBdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogVGhpcyBjb2RlIG1heSBvbmx5IGJlIHVzZWQgdW5kZXIgdGhlIEJTRCBzdHlsZSBsaWNlbnNlIGZvdW5kIGF0IGh0dHA6Ly9wb2x5bWVyLmdpdGh1Yi5pby9MSUNFTlNFLnR4dFxuICogVGhlIGNvbXBsZXRlIHNldCBvZiBhdXRob3JzIG1heSBiZSBmb3VuZCBhdCBodHRwOi8vcG9seW1lci5naXRodWIuaW8vQVVUSE9SUy50eHRcbiAqIFRoZSBjb21wbGV0ZSBzZXQgb2YgY29udHJpYnV0b3JzIG1heSBiZSBmb3VuZCBhdCBodHRwOi8vcG9seW1lci5naXRodWIuaW8vQ09OVFJJQlVUT1JTLnR4dFxuICogQ29kZSBkaXN0cmlidXRlZCBieSBHb29nbGUgYXMgcGFydCBvZiB0aGUgcG9seW1lciBwcm9qZWN0IGlzIGFsc29cbiAqIHN1YmplY3QgdG8gYW4gYWRkaXRpb25hbCBJUCByaWdodHMgZ3JhbnQgZm91bmQgYXQgaHR0cDovL3BvbHltZXIuZ2l0aHViLmlvL1BBVEVOVFMudHh0XG4gKi9cblxuKGZ1bmN0aW9uKGdsb2JhbCkge1xuICAndXNlIHN0cmljdCc7XG5cbiAgdmFyIHRlc3RpbmdFeHBvc2VDeWNsZUNvdW50ID0gZ2xvYmFsLnRlc3RpbmdFeHBvc2VDeWNsZUNvdW50O1xuXG4gIC8vIERldGVjdCBhbmQgZG8gYmFzaWMgc2FuaXR5IGNoZWNraW5nIG9uIE9iamVjdC9BcnJheS5vYnNlcnZlLlxuICBmdW5jdGlvbiBkZXRlY3RPYmplY3RPYnNlcnZlKCkge1xuICAgIGlmICh0eXBlb2YgT2JqZWN0Lm9ic2VydmUgIT09ICdmdW5jdGlvbicgfHxcbiAgICAgICAgdHlwZW9mIEFycmF5Lm9ic2VydmUgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB2YXIgcmVjb3JkcyA9IFtdO1xuXG4gICAgZnVuY3Rpb24gY2FsbGJhY2socmVjcykge1xuICAgICAgcmVjb3JkcyA9IHJlY3M7XG4gICAgfVxuXG4gICAgdmFyIHRlc3QgPSB7fTtcbiAgICB2YXIgYXJyID0gW107XG4gICAgT2JqZWN0Lm9ic2VydmUodGVzdCwgY2FsbGJhY2spO1xuICAgIEFycmF5Lm9ic2VydmUoYXJyLCBjYWxsYmFjayk7XG4gICAgdGVzdC5pZCA9IDE7XG4gICAgdGVzdC5pZCA9IDI7XG4gICAgZGVsZXRlIHRlc3QuaWQ7XG4gICAgYXJyLnB1c2goMSwgMik7XG4gICAgYXJyLmxlbmd0aCA9IDA7XG5cbiAgICBPYmplY3QuZGVsaXZlckNoYW5nZVJlY29yZHMoY2FsbGJhY2spO1xuICAgIGlmIChyZWNvcmRzLmxlbmd0aCAhPT0gNSlcbiAgICAgIHJldHVybiBmYWxzZTtcblxuICAgIGlmIChyZWNvcmRzWzBdLnR5cGUgIT0gJ2FkZCcgfHxcbiAgICAgICAgcmVjb3Jkc1sxXS50eXBlICE9ICd1cGRhdGUnIHx8XG4gICAgICAgIHJlY29yZHNbMl0udHlwZSAhPSAnZGVsZXRlJyB8fFxuICAgICAgICByZWNvcmRzWzNdLnR5cGUgIT0gJ3NwbGljZScgfHxcbiAgICAgICAgcmVjb3Jkc1s0XS50eXBlICE9ICdzcGxpY2UnKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgT2JqZWN0LnVub2JzZXJ2ZSh0ZXN0LCBjYWxsYmFjayk7XG4gICAgQXJyYXkudW5vYnNlcnZlKGFyciwgY2FsbGJhY2spO1xuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICB2YXIgaGFzT2JzZXJ2ZSA9IGRldGVjdE9iamVjdE9ic2VydmUoKTtcblxuICBmdW5jdGlvbiBkZXRlY3RFdmFsKCkge1xuICAgIC8vIERvbid0IHRlc3QgZm9yIGV2YWwgaWYgd2UncmUgcnVubmluZyBpbiBhIENocm9tZSBBcHAgZW52aXJvbm1lbnQuXG4gICAgLy8gV2UgY2hlY2sgZm9yIEFQSXMgc2V0IHRoYXQgb25seSBleGlzdCBpbiBhIENocm9tZSBBcHAgY29udGV4dC5cbiAgICBpZiAodHlwZW9mIGNocm9tZSAhPT0gJ3VuZGVmaW5lZCcgJiYgY2hyb21lLmFwcCAmJiBjaHJvbWUuYXBwLnJ1bnRpbWUpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBGaXJlZm94IE9TIEFwcHMgZG8gbm90IGFsbG93IGV2YWwuIFRoaXMgZmVhdHVyZSBkZXRlY3Rpb24gaXMgdmVyeSBoYWNreVxuICAgIC8vIGJ1dCBldmVuIGlmIHNvbWUgb3RoZXIgcGxhdGZvcm0gYWRkcyBzdXBwb3J0IGZvciB0aGlzIGZ1bmN0aW9uIHRoaXMgY29kZVxuICAgIC8vIHdpbGwgY29udGludWUgdG8gd29yay5cbiAgICBpZiAobmF2aWdhdG9yLmdldERldmljZVN0b3JhZ2UpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgdmFyIGYgPSBuZXcgRnVuY3Rpb24oJycsICdyZXR1cm4gdHJ1ZTsnKTtcbiAgICAgIHJldHVybiBmKCk7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICB2YXIgaGFzRXZhbCA9IGRldGVjdEV2YWwoKTtcblxuICBmdW5jdGlvbiBpc0luZGV4KHMpIHtcbiAgICByZXR1cm4gK3MgPT09IHMgPj4+IDAgJiYgcyAhPT0gJyc7XG4gIH1cblxuICBmdW5jdGlvbiB0b051bWJlcihzKSB7XG4gICAgcmV0dXJuICtzO1xuICB9XG5cbiAgZnVuY3Rpb24gaXNPYmplY3Qob2JqKSB7XG4gICAgcmV0dXJuIG9iaiA9PT0gT2JqZWN0KG9iaik7XG4gIH1cblxuICB2YXIgbnVtYmVySXNOYU4gPSBnbG9iYWwuTnVtYmVyLmlzTmFOIHx8IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgJiYgZ2xvYmFsLmlzTmFOKHZhbHVlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFyZVNhbWVWYWx1ZShsZWZ0LCByaWdodCkge1xuICAgIGlmIChsZWZ0ID09PSByaWdodClcbiAgICAgIHJldHVybiBsZWZ0ICE9PSAwIHx8IDEgLyBsZWZ0ID09PSAxIC8gcmlnaHQ7XG4gICAgaWYgKG51bWJlcklzTmFOKGxlZnQpICYmIG51bWJlcklzTmFOKHJpZ2h0KSlcbiAgICAgIHJldHVybiB0cnVlO1xuXG4gICAgcmV0dXJuIGxlZnQgIT09IGxlZnQgJiYgcmlnaHQgIT09IHJpZ2h0O1xuICB9XG5cbiAgdmFyIGNyZWF0ZU9iamVjdCA9ICgnX19wcm90b19fJyBpbiB7fSkgP1xuICAgIGZ1bmN0aW9uKG9iaikgeyByZXR1cm4gb2JqOyB9IDpcbiAgICBmdW5jdGlvbihvYmopIHtcbiAgICAgIHZhciBwcm90byA9IG9iai5fX3Byb3RvX187XG4gICAgICBpZiAoIXByb3RvKVxuICAgICAgICByZXR1cm4gb2JqO1xuICAgICAgdmFyIG5ld09iamVjdCA9IE9iamVjdC5jcmVhdGUocHJvdG8pO1xuICAgICAgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMob2JqKS5mb3JFYWNoKGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG5ld09iamVjdCwgbmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihvYmosIG5hbWUpKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIG5ld09iamVjdDtcbiAgICB9O1xuXG4gIHZhciBpZGVudFN0YXJ0ID0gJ1tcXCRfYS16QS1aXSc7XG4gIHZhciBpZGVudFBhcnQgPSAnW1xcJF9hLXpBLVowLTldJztcbiAgdmFyIGlkZW50UmVnRXhwID0gbmV3IFJlZ0V4cCgnXicgKyBpZGVudFN0YXJ0ICsgJysnICsgaWRlbnRQYXJ0ICsgJyonICsgJyQnKTtcblxuICBmdW5jdGlvbiBnZXRQYXRoQ2hhclR5cGUoY2hhcikge1xuICAgIGlmIChjaGFyID09PSB1bmRlZmluZWQpXG4gICAgICByZXR1cm4gJ2VvZic7XG5cbiAgICB2YXIgY29kZSA9IGNoYXIuY2hhckNvZGVBdCgwKTtcblxuICAgIHN3aXRjaChjb2RlKSB7XG4gICAgICBjYXNlIDB4NUI6IC8vIFtcbiAgICAgIGNhc2UgMHg1RDogLy8gXVxuICAgICAgY2FzZSAweDJFOiAvLyAuXG4gICAgICBjYXNlIDB4MjI6IC8vIFwiXG4gICAgICBjYXNlIDB4Mjc6IC8vICdcbiAgICAgIGNhc2UgMHgzMDogLy8gMFxuICAgICAgICByZXR1cm4gY2hhcjtcblxuICAgICAgY2FzZSAweDVGOiAvLyBfXG4gICAgICBjYXNlIDB4MjQ6IC8vICRcbiAgICAgICAgcmV0dXJuICdpZGVudCc7XG5cbiAgICAgIGNhc2UgMHgyMDogLy8gU3BhY2VcbiAgICAgIGNhc2UgMHgwOTogLy8gVGFiXG4gICAgICBjYXNlIDB4MEE6IC8vIE5ld2xpbmVcbiAgICAgIGNhc2UgMHgwRDogLy8gUmV0dXJuXG4gICAgICBjYXNlIDB4QTA6ICAvLyBOby1icmVhayBzcGFjZVxuICAgICAgY2FzZSAweEZFRkY6ICAvLyBCeXRlIE9yZGVyIE1hcmtcbiAgICAgIGNhc2UgMHgyMDI4OiAgLy8gTGluZSBTZXBhcmF0b3JcbiAgICAgIGNhc2UgMHgyMDI5OiAgLy8gUGFyYWdyYXBoIFNlcGFyYXRvclxuICAgICAgICByZXR1cm4gJ3dzJztcbiAgICB9XG5cbiAgICAvLyBhLXosIEEtWlxuICAgIGlmICgoMHg2MSA8PSBjb2RlICYmIGNvZGUgPD0gMHg3QSkgfHwgKDB4NDEgPD0gY29kZSAmJiBjb2RlIDw9IDB4NUEpKVxuICAgICAgcmV0dXJuICdpZGVudCc7XG5cbiAgICAvLyAxLTlcbiAgICBpZiAoMHgzMSA8PSBjb2RlICYmIGNvZGUgPD0gMHgzOSlcbiAgICAgIHJldHVybiAnbnVtYmVyJztcblxuICAgIHJldHVybiAnZWxzZSc7XG4gIH1cblxuICB2YXIgcGF0aFN0YXRlTWFjaGluZSA9IHtcbiAgICAnYmVmb3JlUGF0aCc6IHtcbiAgICAgICd3cyc6IFsnYmVmb3JlUGF0aCddLFxuICAgICAgJ2lkZW50JzogWydpbklkZW50JywgJ2FwcGVuZCddLFxuICAgICAgJ1snOiBbJ2JlZm9yZUVsZW1lbnQnXSxcbiAgICAgICdlb2YnOiBbJ2FmdGVyUGF0aCddXG4gICAgfSxcblxuICAgICdpblBhdGgnOiB7XG4gICAgICAnd3MnOiBbJ2luUGF0aCddLFxuICAgICAgJy4nOiBbJ2JlZm9yZUlkZW50J10sXG4gICAgICAnWyc6IFsnYmVmb3JlRWxlbWVudCddLFxuICAgICAgJ2VvZic6IFsnYWZ0ZXJQYXRoJ11cbiAgICB9LFxuXG4gICAgJ2JlZm9yZUlkZW50Jzoge1xuICAgICAgJ3dzJzogWydiZWZvcmVJZGVudCddLFxuICAgICAgJ2lkZW50JzogWydpbklkZW50JywgJ2FwcGVuZCddXG4gICAgfSxcblxuICAgICdpbklkZW50Jzoge1xuICAgICAgJ2lkZW50JzogWydpbklkZW50JywgJ2FwcGVuZCddLFxuICAgICAgJzAnOiBbJ2luSWRlbnQnLCAnYXBwZW5kJ10sXG4gICAgICAnbnVtYmVyJzogWydpbklkZW50JywgJ2FwcGVuZCddLFxuICAgICAgJ3dzJzogWydpblBhdGgnLCAncHVzaCddLFxuICAgICAgJy4nOiBbJ2JlZm9yZUlkZW50JywgJ3B1c2gnXSxcbiAgICAgICdbJzogWydiZWZvcmVFbGVtZW50JywgJ3B1c2gnXSxcbiAgICAgICdlb2YnOiBbJ2FmdGVyUGF0aCcsICdwdXNoJ11cbiAgICB9LFxuXG4gICAgJ2JlZm9yZUVsZW1lbnQnOiB7XG4gICAgICAnd3MnOiBbJ2JlZm9yZUVsZW1lbnQnXSxcbiAgICAgICcwJzogWydhZnRlclplcm8nLCAnYXBwZW5kJ10sXG4gICAgICAnbnVtYmVyJzogWydpbkluZGV4JywgJ2FwcGVuZCddLFxuICAgICAgXCInXCI6IFsnaW5TaW5nbGVRdW90ZScsICdhcHBlbmQnLCAnJ10sXG4gICAgICAnXCInOiBbJ2luRG91YmxlUXVvdGUnLCAnYXBwZW5kJywgJyddXG4gICAgfSxcblxuICAgICdhZnRlclplcm8nOiB7XG4gICAgICAnd3MnOiBbJ2FmdGVyRWxlbWVudCcsICdwdXNoJ10sXG4gICAgICAnXSc6IFsnaW5QYXRoJywgJ3B1c2gnXVxuICAgIH0sXG5cbiAgICAnaW5JbmRleCc6IHtcbiAgICAgICcwJzogWydpbkluZGV4JywgJ2FwcGVuZCddLFxuICAgICAgJ251bWJlcic6IFsnaW5JbmRleCcsICdhcHBlbmQnXSxcbiAgICAgICd3cyc6IFsnYWZ0ZXJFbGVtZW50J10sXG4gICAgICAnXSc6IFsnaW5QYXRoJywgJ3B1c2gnXVxuICAgIH0sXG5cbiAgICAnaW5TaW5nbGVRdW90ZSc6IHtcbiAgICAgIFwiJ1wiOiBbJ2FmdGVyRWxlbWVudCddLFxuICAgICAgJ2VvZic6IFsnZXJyb3InXSxcbiAgICAgICdlbHNlJzogWydpblNpbmdsZVF1b3RlJywgJ2FwcGVuZCddXG4gICAgfSxcblxuICAgICdpbkRvdWJsZVF1b3RlJzoge1xuICAgICAgJ1wiJzogWydhZnRlckVsZW1lbnQnXSxcbiAgICAgICdlb2YnOiBbJ2Vycm9yJ10sXG4gICAgICAnZWxzZSc6IFsnaW5Eb3VibGVRdW90ZScsICdhcHBlbmQnXVxuICAgIH0sXG5cbiAgICAnYWZ0ZXJFbGVtZW50Jzoge1xuICAgICAgJ3dzJzogWydhZnRlckVsZW1lbnQnXSxcbiAgICAgICddJzogWydpblBhdGgnLCAncHVzaCddXG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gbm9vcCgpIHt9XG5cbiAgZnVuY3Rpb24gcGFyc2VQYXRoKHBhdGgpIHtcbiAgICB2YXIga2V5cyA9IFtdO1xuICAgIHZhciBpbmRleCA9IC0xO1xuICAgIHZhciBjLCBuZXdDaGFyLCBrZXksIHR5cGUsIHRyYW5zaXRpb24sIGFjdGlvbiwgdHlwZU1hcCwgbW9kZSA9ICdiZWZvcmVQYXRoJztcblxuICAgIHZhciBhY3Rpb25zID0ge1xuICAgICAgcHVzaDogZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmIChrZXkgPT09IHVuZGVmaW5lZClcbiAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAga2V5cy5wdXNoKGtleSk7XG4gICAgICAgIGtleSA9IHVuZGVmaW5lZDtcbiAgICAgIH0sXG5cbiAgICAgIGFwcGVuZDogZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmIChrZXkgPT09IHVuZGVmaW5lZClcbiAgICAgICAgICBrZXkgPSBuZXdDaGFyXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBrZXkgKz0gbmV3Q2hhcjtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gbWF5YmVVbmVzY2FwZVF1b3RlKCkge1xuICAgICAgaWYgKGluZGV4ID49IHBhdGgubGVuZ3RoKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIHZhciBuZXh0Q2hhciA9IHBhdGhbaW5kZXggKyAxXTtcbiAgICAgIGlmICgobW9kZSA9PSAnaW5TaW5nbGVRdW90ZScgJiYgbmV4dENoYXIgPT0gXCInXCIpIHx8XG4gICAgICAgICAgKG1vZGUgPT0gJ2luRG91YmxlUXVvdGUnICYmIG5leHRDaGFyID09ICdcIicpKSB7XG4gICAgICAgIGluZGV4Kys7XG4gICAgICAgIG5ld0NoYXIgPSBuZXh0Q2hhcjtcbiAgICAgICAgYWN0aW9ucy5hcHBlbmQoKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgd2hpbGUgKG1vZGUpIHtcbiAgICAgIGluZGV4Kys7XG4gICAgICBjID0gcGF0aFtpbmRleF07XG5cbiAgICAgIGlmIChjID09ICdcXFxcJyAmJiBtYXliZVVuZXNjYXBlUXVvdGUobW9kZSkpXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICB0eXBlID0gZ2V0UGF0aENoYXJUeXBlKGMpO1xuICAgICAgdHlwZU1hcCA9IHBhdGhTdGF0ZU1hY2hpbmVbbW9kZV07XG4gICAgICB0cmFuc2l0aW9uID0gdHlwZU1hcFt0eXBlXSB8fCB0eXBlTWFwWydlbHNlJ10gfHwgJ2Vycm9yJztcblxuICAgICAgaWYgKHRyYW5zaXRpb24gPT0gJ2Vycm9yJylcbiAgICAgICAgcmV0dXJuOyAvLyBwYXJzZSBlcnJvcjtcblxuICAgICAgbW9kZSA9IHRyYW5zaXRpb25bMF07XG4gICAgICBhY3Rpb24gPSBhY3Rpb25zW3RyYW5zaXRpb25bMV1dIHx8IG5vb3A7XG4gICAgICBuZXdDaGFyID0gdHJhbnNpdGlvblsyXSA9PT0gdW5kZWZpbmVkID8gYyA6IHRyYW5zaXRpb25bMl07XG4gICAgICBhY3Rpb24oKTtcblxuICAgICAgaWYgKG1vZGUgPT09ICdhZnRlclBhdGgnKSB7XG4gICAgICAgIHJldHVybiBrZXlzO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybjsgLy8gcGFyc2UgZXJyb3JcbiAgfVxuXG4gIGZ1bmN0aW9uIGlzSWRlbnQocykge1xuICAgIHJldHVybiBpZGVudFJlZ0V4cC50ZXN0KHMpO1xuICB9XG5cbiAgdmFyIGNvbnN0cnVjdG9ySXNQcml2YXRlID0ge307XG5cbiAgZnVuY3Rpb24gUGF0aChwYXJ0cywgcHJpdmF0ZVRva2VuKSB7XG4gICAgaWYgKHByaXZhdGVUb2tlbiAhPT0gY29uc3RydWN0b3JJc1ByaXZhdGUpXG4gICAgICB0aHJvdyBFcnJvcignVXNlIFBhdGguZ2V0IHRvIHJldHJpZXZlIHBhdGggb2JqZWN0cycpO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwYXJ0cy5sZW5ndGg7IGkrKykge1xuICAgICAgdGhpcy5wdXNoKFN0cmluZyhwYXJ0c1tpXSkpO1xuICAgIH1cblxuICAgIGlmIChoYXNFdmFsICYmIHRoaXMubGVuZ3RoKSB7XG4gICAgICB0aGlzLmdldFZhbHVlRnJvbSA9IHRoaXMuY29tcGlsZWRHZXRWYWx1ZUZyb21GbigpO1xuICAgIH1cbiAgfVxuXG4gIC8vIFRPRE8ocmFmYWVsdyk6IE1ha2Ugc2ltcGxlIExSVSBjYWNoZVxuICB2YXIgcGF0aENhY2hlID0ge307XG5cbiAgZnVuY3Rpb24gZ2V0UGF0aChwYXRoU3RyaW5nKSB7XG4gICAgaWYgKHBhdGhTdHJpbmcgaW5zdGFuY2VvZiBQYXRoKVxuICAgICAgcmV0dXJuIHBhdGhTdHJpbmc7XG5cbiAgICBpZiAocGF0aFN0cmluZyA9PSBudWxsIHx8IHBhdGhTdHJpbmcubGVuZ3RoID09IDApXG4gICAgICBwYXRoU3RyaW5nID0gJyc7XG5cbiAgICBpZiAodHlwZW9mIHBhdGhTdHJpbmcgIT0gJ3N0cmluZycpIHtcbiAgICAgIGlmIChpc0luZGV4KHBhdGhTdHJpbmcubGVuZ3RoKSkge1xuICAgICAgICAvLyBDb25zdHJ1Y3RlZCB3aXRoIGFycmF5LWxpa2UgKHByZS1wYXJzZWQpIGtleXNcbiAgICAgICAgcmV0dXJuIG5ldyBQYXRoKHBhdGhTdHJpbmcsIGNvbnN0cnVjdG9ySXNQcml2YXRlKTtcbiAgICAgIH1cblxuICAgICAgcGF0aFN0cmluZyA9IFN0cmluZyhwYXRoU3RyaW5nKTtcbiAgICB9XG5cbiAgICB2YXIgcGF0aCA9IHBhdGhDYWNoZVtwYXRoU3RyaW5nXTtcbiAgICBpZiAocGF0aClcbiAgICAgIHJldHVybiBwYXRoO1xuXG4gICAgdmFyIHBhcnRzID0gcGFyc2VQYXRoKHBhdGhTdHJpbmcpO1xuICAgIGlmICghcGFydHMpXG4gICAgICByZXR1cm4gaW52YWxpZFBhdGg7XG5cbiAgICB2YXIgcGF0aCA9IG5ldyBQYXRoKHBhcnRzLCBjb25zdHJ1Y3RvcklzUHJpdmF0ZSk7XG4gICAgcGF0aENhY2hlW3BhdGhTdHJpbmddID0gcGF0aDtcbiAgICByZXR1cm4gcGF0aDtcbiAgfVxuXG4gIFBhdGguZ2V0ID0gZ2V0UGF0aDtcblxuICBmdW5jdGlvbiBmb3JtYXRBY2Nlc3NvcihrZXkpIHtcbiAgICBpZiAoaXNJbmRleChrZXkpKSB7XG4gICAgICByZXR1cm4gJ1snICsga2V5ICsgJ10nO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gJ1tcIicgKyBrZXkucmVwbGFjZSgvXCIvZywgJ1xcXFxcIicpICsgJ1wiXSc7XG4gICAgfVxuICB9XG5cbiAgUGF0aC5wcm90b3R5cGUgPSBjcmVhdGVPYmplY3Qoe1xuICAgIF9fcHJvdG9fXzogW10sXG4gICAgdmFsaWQ6IHRydWUsXG5cbiAgICB0b1N0cmluZzogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgcGF0aFN0cmluZyA9ICcnO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBrZXkgPSB0aGlzW2ldO1xuICAgICAgICBpZiAoaXNJZGVudChrZXkpKSB7XG4gICAgICAgICAgcGF0aFN0cmluZyArPSBpID8gJy4nICsga2V5IDoga2V5O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBhdGhTdHJpbmcgKz0gZm9ybWF0QWNjZXNzb3Ioa2V5KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gcGF0aFN0cmluZztcbiAgICB9LFxuXG4gICAgZ2V0VmFsdWVGcm9tOiBmdW5jdGlvbihvYmosIGRpcmVjdE9ic2VydmVyKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKG9iaiA9PSBudWxsKVxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgb2JqID0gb2JqW3RoaXNbaV1dO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG9iajtcbiAgICB9LFxuXG4gICAgaXRlcmF0ZU9iamVjdHM6IGZ1bmN0aW9uKG9iaiwgb2JzZXJ2ZSkge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChpKVxuICAgICAgICAgIG9iaiA9IG9ialt0aGlzW2kgLSAxXV07XG4gICAgICAgIGlmICghaXNPYmplY3Qob2JqKSlcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIG9ic2VydmUob2JqLCB0aGlzWzBdKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgY29tcGlsZWRHZXRWYWx1ZUZyb21GbjogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgc3RyID0gJyc7XG4gICAgICB2YXIgcGF0aFN0cmluZyA9ICdvYmonO1xuICAgICAgc3RyICs9ICdpZiAob2JqICE9IG51bGwnO1xuICAgICAgdmFyIGkgPSAwO1xuICAgICAgdmFyIGtleTtcbiAgICAgIGZvciAoOyBpIDwgKHRoaXMubGVuZ3RoIC0gMSk7IGkrKykge1xuICAgICAgICBrZXkgPSB0aGlzW2ldO1xuICAgICAgICBwYXRoU3RyaW5nICs9IGlzSWRlbnQoa2V5KSA/ICcuJyArIGtleSA6IGZvcm1hdEFjY2Vzc29yKGtleSk7XG4gICAgICAgIHN0ciArPSAnICYmXFxuICAgICAnICsgcGF0aFN0cmluZyArICcgIT0gbnVsbCc7XG4gICAgICB9XG4gICAgICBzdHIgKz0gJylcXG4nO1xuXG4gICAgICB2YXIga2V5ID0gdGhpc1tpXTtcbiAgICAgIHBhdGhTdHJpbmcgKz0gaXNJZGVudChrZXkpID8gJy4nICsga2V5IDogZm9ybWF0QWNjZXNzb3Ioa2V5KTtcblxuICAgICAgc3RyICs9ICcgIHJldHVybiAnICsgcGF0aFN0cmluZyArICc7XFxuZWxzZVxcbiAgcmV0dXJuIHVuZGVmaW5lZDsnO1xuICAgICAgcmV0dXJuIG5ldyBGdW5jdGlvbignb2JqJywgc3RyKTtcbiAgICB9LFxuXG4gICAgc2V0VmFsdWVGcm9tOiBmdW5jdGlvbihvYmosIHZhbHVlKSB7XG4gICAgICBpZiAoIXRoaXMubGVuZ3RoKVxuICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgICAgaWYgKCFpc09iamVjdChvYmopKVxuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgb2JqID0gb2JqW3RoaXNbaV1dO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWlzT2JqZWN0KG9iaikpXG4gICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgb2JqW3RoaXNbaV1dID0gdmFsdWU7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH0pO1xuXG4gIHZhciBpbnZhbGlkUGF0aCA9IG5ldyBQYXRoKCcnLCBjb25zdHJ1Y3RvcklzUHJpdmF0ZSk7XG4gIGludmFsaWRQYXRoLnZhbGlkID0gZmFsc2U7XG4gIGludmFsaWRQYXRoLmdldFZhbHVlRnJvbSA9IGludmFsaWRQYXRoLnNldFZhbHVlRnJvbSA9IGZ1bmN0aW9uKCkge307XG5cbiAgdmFyIE1BWF9ESVJUWV9DSEVDS19DWUNMRVMgPSAxMDAwO1xuXG4gIGZ1bmN0aW9uIGRpcnR5Q2hlY2sob2JzZXJ2ZXIpIHtcbiAgICB2YXIgY3ljbGVzID0gMDtcbiAgICB3aGlsZSAoY3ljbGVzIDwgTUFYX0RJUlRZX0NIRUNLX0NZQ0xFUyAmJiBvYnNlcnZlci5jaGVja18oKSkge1xuICAgICAgY3ljbGVzKys7XG4gICAgfVxuICAgIGlmICh0ZXN0aW5nRXhwb3NlQ3ljbGVDb3VudClcbiAgICAgIGdsb2JhbC5kaXJ0eUNoZWNrQ3ljbGVDb3VudCA9IGN5Y2xlcztcblxuICAgIHJldHVybiBjeWNsZXMgPiAwO1xuICB9XG5cbiAgZnVuY3Rpb24gb2JqZWN0SXNFbXB0eShvYmplY3QpIHtcbiAgICBmb3IgKHZhciBwcm9wIGluIG9iamVjdClcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRpZmZJc0VtcHR5KGRpZmYpIHtcbiAgICByZXR1cm4gb2JqZWN0SXNFbXB0eShkaWZmLmFkZGVkKSAmJlxuICAgICAgICAgICBvYmplY3RJc0VtcHR5KGRpZmYucmVtb3ZlZCkgJiZcbiAgICAgICAgICAgb2JqZWN0SXNFbXB0eShkaWZmLmNoYW5nZWQpO1xuICB9XG5cbiAgZnVuY3Rpb24gZGlmZk9iamVjdEZyb21PbGRPYmplY3Qob2JqZWN0LCBvbGRPYmplY3QpIHtcbiAgICB2YXIgYWRkZWQgPSB7fTtcbiAgICB2YXIgcmVtb3ZlZCA9IHt9O1xuICAgIHZhciBjaGFuZ2VkID0ge307XG5cbiAgICBmb3IgKHZhciBwcm9wIGluIG9sZE9iamVjdCkge1xuICAgICAgdmFyIG5ld1ZhbHVlID0gb2JqZWN0W3Byb3BdO1xuXG4gICAgICBpZiAobmV3VmFsdWUgIT09IHVuZGVmaW5lZCAmJiBuZXdWYWx1ZSA9PT0gb2xkT2JqZWN0W3Byb3BdKVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgaWYgKCEocHJvcCBpbiBvYmplY3QpKSB7XG4gICAgICAgIHJlbW92ZWRbcHJvcF0gPSB1bmRlZmluZWQ7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAobmV3VmFsdWUgIT09IG9sZE9iamVjdFtwcm9wXSlcbiAgICAgICAgY2hhbmdlZFtwcm9wXSA9IG5ld1ZhbHVlO1xuICAgIH1cblxuICAgIGZvciAodmFyIHByb3AgaW4gb2JqZWN0KSB7XG4gICAgICBpZiAocHJvcCBpbiBvbGRPYmplY3QpXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICBhZGRlZFtwcm9wXSA9IG9iamVjdFtwcm9wXTtcbiAgICB9XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShvYmplY3QpICYmIG9iamVjdC5sZW5ndGggIT09IG9sZE9iamVjdC5sZW5ndGgpXG4gICAgICBjaGFuZ2VkLmxlbmd0aCA9IG9iamVjdC5sZW5ndGg7XG5cbiAgICByZXR1cm4ge1xuICAgICAgYWRkZWQ6IGFkZGVkLFxuICAgICAgcmVtb3ZlZDogcmVtb3ZlZCxcbiAgICAgIGNoYW5nZWQ6IGNoYW5nZWRcbiAgICB9O1xuICB9XG5cbiAgdmFyIGVvbVRhc2tzID0gW107XG4gIGZ1bmN0aW9uIHJ1bkVPTVRhc2tzKCkge1xuICAgIGlmICghZW9tVGFza3MubGVuZ3RoKVxuICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBlb21UYXNrcy5sZW5ndGg7IGkrKykge1xuICAgICAgZW9tVGFza3NbaV0oKTtcbiAgICB9XG4gICAgZW9tVGFza3MubGVuZ3RoID0gMDtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHZhciBydW5FT00gPSBoYXNPYnNlcnZlID8gKGZ1bmN0aW9uKCl7XG4gICAgdmFyIGVvbU9iaiA9IHsgcGluZ1Bvbmc6IHRydWUgfTtcbiAgICB2YXIgZW9tUnVuU2NoZWR1bGVkID0gZmFsc2U7XG5cbiAgICBPYmplY3Qub2JzZXJ2ZShlb21PYmosIGZ1bmN0aW9uKCkge1xuICAgICAgcnVuRU9NVGFza3MoKTtcbiAgICAgIGVvbVJ1blNjaGVkdWxlZCA9IGZhbHNlO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uKGZuKSB7XG4gICAgICBlb21UYXNrcy5wdXNoKGZuKTtcbiAgICAgIGlmICghZW9tUnVuU2NoZWR1bGVkKSB7XG4gICAgICAgIGVvbVJ1blNjaGVkdWxlZCA9IHRydWU7XG4gICAgICAgIGVvbU9iai5waW5nUG9uZyA9ICFlb21PYmoucGluZ1Bvbmc7XG4gICAgICB9XG4gICAgfTtcbiAgfSkoKSA6XG4gIChmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oZm4pIHtcbiAgICAgIGVvbVRhc2tzLnB1c2goZm4pO1xuICAgIH07XG4gIH0pKCk7XG5cbiAgdmFyIG9ic2VydmVkT2JqZWN0Q2FjaGUgPSBbXTtcblxuICBmdW5jdGlvbiBuZXdPYnNlcnZlZE9iamVjdCgpIHtcbiAgICB2YXIgb2JzZXJ2ZXI7XG4gICAgdmFyIG9iamVjdDtcbiAgICB2YXIgZGlzY2FyZFJlY29yZHMgPSBmYWxzZTtcbiAgICB2YXIgZmlyc3QgPSB0cnVlO1xuXG4gICAgZnVuY3Rpb24gY2FsbGJhY2socmVjb3Jkcykge1xuICAgICAgaWYgKG9ic2VydmVyICYmIG9ic2VydmVyLnN0YXRlXyA9PT0gT1BFTkVEICYmICFkaXNjYXJkUmVjb3JkcylcbiAgICAgICAgb2JzZXJ2ZXIuY2hlY2tfKHJlY29yZHMpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBvcGVuOiBmdW5jdGlvbihvYnMpIHtcbiAgICAgICAgaWYgKG9ic2VydmVyKVxuICAgICAgICAgIHRocm93IEVycm9yKCdPYnNlcnZlZE9iamVjdCBpbiB1c2UnKTtcblxuICAgICAgICBpZiAoIWZpcnN0KVxuICAgICAgICAgIE9iamVjdC5kZWxpdmVyQ2hhbmdlUmVjb3JkcyhjYWxsYmFjayk7XG5cbiAgICAgICAgb2JzZXJ2ZXIgPSBvYnM7XG4gICAgICAgIGZpcnN0ID0gZmFsc2U7XG4gICAgICB9LFxuICAgICAgb2JzZXJ2ZTogZnVuY3Rpb24ob2JqLCBhcnJheU9ic2VydmUpIHtcbiAgICAgICAgb2JqZWN0ID0gb2JqO1xuICAgICAgICBpZiAoYXJyYXlPYnNlcnZlKVxuICAgICAgICAgIEFycmF5Lm9ic2VydmUob2JqZWN0LCBjYWxsYmFjayk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICBPYmplY3Qub2JzZXJ2ZShvYmplY3QsIGNhbGxiYWNrKTtcbiAgICAgIH0sXG4gICAgICBkZWxpdmVyOiBmdW5jdGlvbihkaXNjYXJkKSB7XG4gICAgICAgIGRpc2NhcmRSZWNvcmRzID0gZGlzY2FyZDtcbiAgICAgICAgT2JqZWN0LmRlbGl2ZXJDaGFuZ2VSZWNvcmRzKGNhbGxiYWNrKTtcbiAgICAgICAgZGlzY2FyZFJlY29yZHMgPSBmYWxzZTtcbiAgICAgIH0sXG4gICAgICBjbG9zZTogZnVuY3Rpb24oKSB7XG4gICAgICAgIG9ic2VydmVyID0gdW5kZWZpbmVkO1xuICAgICAgICBPYmplY3QudW5vYnNlcnZlKG9iamVjdCwgY2FsbGJhY2spO1xuICAgICAgICBvYnNlcnZlZE9iamVjdENhY2hlLnB1c2godGhpcyk7XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIC8qXG4gICAqIFRoZSBvYnNlcnZlZFNldCBhYnN0cmFjdGlvbiBpcyBhIHBlcmYgb3B0aW1pemF0aW9uIHdoaWNoIHJlZHVjZXMgdGhlIHRvdGFsXG4gICAqIG51bWJlciBvZiBPYmplY3Qub2JzZXJ2ZSBvYnNlcnZhdGlvbnMgb2YgYSBzZXQgb2Ygb2JqZWN0cy4gVGhlIGlkZWEgaXMgdGhhdFxuICAgKiBncm91cHMgb2YgT2JzZXJ2ZXJzIHdpbGwgaGF2ZSBzb21lIG9iamVjdCBkZXBlbmRlbmNpZXMgaW4gY29tbW9uIGFuZCB0aGlzXG4gICAqIG9ic2VydmVkIHNldCBlbnN1cmVzIHRoYXQgZWFjaCBvYmplY3QgaW4gdGhlIHRyYW5zaXRpdmUgY2xvc3VyZSBvZlxuICAgKiBkZXBlbmRlbmNpZXMgaXMgb25seSBvYnNlcnZlZCBvbmNlLiBUaGUgb2JzZXJ2ZWRTZXQgYWN0cyBhcyBhIHdyaXRlIGJhcnJpZXJcbiAgICogc3VjaCB0aGF0IHdoZW5ldmVyIGFueSBjaGFuZ2UgY29tZXMgdGhyb3VnaCwgYWxsIE9ic2VydmVycyBhcmUgY2hlY2tlZCBmb3JcbiAgICogY2hhbmdlZCB2YWx1ZXMuXG4gICAqXG4gICAqIE5vdGUgdGhhdCB0aGlzIG9wdGltaXphdGlvbiBpcyBleHBsaWNpdGx5IG1vdmluZyB3b3JrIGZyb20gc2V0dXAtdGltZSB0b1xuICAgKiBjaGFuZ2UtdGltZS5cbiAgICpcbiAgICogVE9ETyhyYWZhZWx3KTogSW1wbGVtZW50IFwiZ2FyYmFnZSBjb2xsZWN0aW9uXCIuIEluIG9yZGVyIHRvIG1vdmUgd29yayBvZmZcbiAgICogdGhlIGNyaXRpY2FsIHBhdGgsIHdoZW4gT2JzZXJ2ZXJzIGFyZSBjbG9zZWQsIHRoZWlyIG9ic2VydmVkIG9iamVjdHMgYXJlXG4gICAqIG5vdCBPYmplY3QudW5vYnNlcnZlKGQpLiBBcyBhIHJlc3VsdCwgaXQnc2llc3RhIHBvc3NpYmxlIHRoYXQgaWYgdGhlIG9ic2VydmVkU2V0XG4gICAqIGlzIGtlcHQgb3BlbiwgYnV0IHNvbWUgT2JzZXJ2ZXJzIGhhdmUgYmVlbiBjbG9zZWQsIGl0IGNvdWxkIGNhdXNlIFwibGVha3NcIlxuICAgKiAocHJldmVudCBvdGhlcndpc2UgY29sbGVjdGFibGUgb2JqZWN0cyBmcm9tIGJlaW5nIGNvbGxlY3RlZCkuIEF0IHNvbWVcbiAgICogcG9pbnQsIHdlIHNob3VsZCBpbXBsZW1lbnQgaW5jcmVtZW50YWwgXCJnY1wiIHdoaWNoIGtlZXBzIGEgbGlzdCBvZlxuICAgKiBvYnNlcnZlZFNldHMgd2hpY2ggbWF5IG5lZWQgY2xlYW4tdXAgYW5kIGRvZXMgc21hbGwgYW1vdW50cyBvZiBjbGVhbnVwIG9uIGFcbiAgICogdGltZW91dCB1bnRpbCBhbGwgaXMgY2xlYW4uXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGdldE9ic2VydmVkT2JqZWN0KG9ic2VydmVyLCBvYmplY3QsIGFycmF5T2JzZXJ2ZSkge1xuICAgIHZhciBkaXIgPSBvYnNlcnZlZE9iamVjdENhY2hlLnBvcCgpIHx8IG5ld09ic2VydmVkT2JqZWN0KCk7XG4gICAgZGlyLm9wZW4ob2JzZXJ2ZXIpO1xuICAgIGRpci5vYnNlcnZlKG9iamVjdCwgYXJyYXlPYnNlcnZlKTtcbiAgICByZXR1cm4gZGlyO1xuICB9XG5cbiAgdmFyIG9ic2VydmVkU2V0Q2FjaGUgPSBbXTtcblxuICBmdW5jdGlvbiBuZXdPYnNlcnZlZFNldCgpIHtcbiAgICB2YXIgb2JzZXJ2ZXJDb3VudCA9IDA7XG4gICAgdmFyIG9ic2VydmVycyA9IFtdO1xuICAgIHZhciBvYmplY3RzID0gW107XG4gICAgdmFyIHJvb3RPYmo7XG4gICAgdmFyIHJvb3RPYmpQcm9wcztcblxuICAgIGZ1bmN0aW9uIG9ic2VydmUob2JqLCBwcm9wKSB7XG4gICAgICBpZiAoIW9iailcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICBpZiAob2JqID09PSByb290T2JqKVxuICAgICAgICByb290T2JqUHJvcHNbcHJvcF0gPSB0cnVlO1xuXG4gICAgICBpZiAob2JqZWN0cy5pbmRleE9mKG9iaikgPCAwKSB7XG4gICAgICAgIG9iamVjdHMucHVzaChvYmopO1xuICAgICAgICBPYmplY3Qub2JzZXJ2ZShvYmosIGNhbGxiYWNrKTtcbiAgICAgIH1cblxuICAgICAgb2JzZXJ2ZShPYmplY3QuZ2V0UHJvdG90eXBlT2Yob2JqKSwgcHJvcCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWxsUm9vdE9iak5vbk9ic2VydmVkUHJvcHMocmVjcykge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZWNzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciByZWMgPSByZWNzW2ldO1xuICAgICAgICBpZiAocmVjLm9iamVjdCAhPT0gcm9vdE9iaiB8fFxuICAgICAgICAgICAgcm9vdE9ialByb3BzW3JlYy5uYW1lXSB8fFxuICAgICAgICAgICAgcmVjLnR5cGUgPT09ICdzZXRQcm90b3R5cGUnKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjYWxsYmFjayhyZWNzKSB7XG4gICAgICBpZiAoYWxsUm9vdE9iak5vbk9ic2VydmVkUHJvcHMocmVjcykpXG4gICAgICAgIHJldHVybjtcblxuICAgICAgdmFyIG9ic2VydmVyO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvYnNlcnZlcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgb2JzZXJ2ZXIgPSBvYnNlcnZlcnNbaV07XG4gICAgICAgIGlmIChvYnNlcnZlci5zdGF0ZV8gPT0gT1BFTkVEKSB7XG4gICAgICAgICAgb2JzZXJ2ZXIuaXRlcmF0ZU9iamVjdHNfKG9ic2VydmUpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb2JzZXJ2ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIG9ic2VydmVyID0gb2JzZXJ2ZXJzW2ldO1xuICAgICAgICBpZiAob2JzZXJ2ZXIuc3RhdGVfID09IE9QRU5FRCkge1xuICAgICAgICAgIG9ic2VydmVyLmNoZWNrXygpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIHJlY29yZCA9IHtcbiAgICAgIG9iamVjdDogdW5kZWZpbmVkLFxuICAgICAgb2JqZWN0czogb2JqZWN0cyxcbiAgICAgIG9wZW46IGZ1bmN0aW9uKG9icywgb2JqZWN0KSB7XG4gICAgICAgIGlmICghcm9vdE9iaikge1xuICAgICAgICAgIHJvb3RPYmogPSBvYmplY3Q7XG4gICAgICAgICAgcm9vdE9ialByb3BzID0ge307XG4gICAgICAgIH1cblxuICAgICAgICBvYnNlcnZlcnMucHVzaChvYnMpO1xuICAgICAgICBvYnNlcnZlckNvdW50Kys7XG4gICAgICAgIG9icy5pdGVyYXRlT2JqZWN0c18ob2JzZXJ2ZSk7XG4gICAgICB9LFxuICAgICAgY2xvc2U6IGZ1bmN0aW9uKG9icykge1xuICAgICAgICBvYnNlcnZlckNvdW50LS07XG4gICAgICAgIGlmIChvYnNlcnZlckNvdW50ID4gMCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb2JqZWN0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIE9iamVjdC51bm9ic2VydmUob2JqZWN0c1tpXSwgY2FsbGJhY2spO1xuICAgICAgICAgIE9ic2VydmVyLnVub2JzZXJ2ZWRDb3VudCsrO1xuICAgICAgICB9XG5cbiAgICAgICAgb2JzZXJ2ZXJzLmxlbmd0aCA9IDA7XG4gICAgICAgIG9iamVjdHMubGVuZ3RoID0gMDtcbiAgICAgICAgcm9vdE9iaiA9IHVuZGVmaW5lZDtcbiAgICAgICAgcm9vdE9ialByb3BzID0gdW5kZWZpbmVkO1xuICAgICAgICBvYnNlcnZlZFNldENhY2hlLnB1c2godGhpcyk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiByZWNvcmQ7XG4gIH1cblxuICB2YXIgbGFzdE9ic2VydmVkU2V0O1xuXG4gIGZ1bmN0aW9uIGdldE9ic2VydmVkU2V0KG9ic2VydmVyLCBvYmopIHtcbiAgICBpZiAoIWxhc3RPYnNlcnZlZFNldCB8fCBsYXN0T2JzZXJ2ZWRTZXQub2JqZWN0ICE9PSBvYmopIHtcbiAgICAgIGxhc3RPYnNlcnZlZFNldCA9IG9ic2VydmVkU2V0Q2FjaGUucG9wKCkgfHwgbmV3T2JzZXJ2ZWRTZXQoKTtcbiAgICAgIGxhc3RPYnNlcnZlZFNldC5vYmplY3QgPSBvYmo7XG4gICAgfVxuICAgIGxhc3RPYnNlcnZlZFNldC5vcGVuKG9ic2VydmVyLCBvYmopO1xuICAgIHJldHVybiBsYXN0T2JzZXJ2ZWRTZXQ7XG4gIH1cblxuICB2YXIgVU5PUEVORUQgPSAwO1xuICB2YXIgT1BFTkVEID0gMTtcbiAgdmFyIENMT1NFRCA9IDI7XG4gIHZhciBSRVNFVFRJTkcgPSAzO1xuXG4gIHZhciBuZXh0T2JzZXJ2ZXJJZCA9IDE7XG5cbiAgZnVuY3Rpb24gT2JzZXJ2ZXIoKSB7XG4gICAgdGhpcy5zdGF0ZV8gPSBVTk9QRU5FRDtcbiAgICB0aGlzLmNhbGxiYWNrXyA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLnRhcmdldF8gPSB1bmRlZmluZWQ7IC8vIFRPRE8ocmFmYWVsdyk6IFNob3VsZCBiZSBXZWFrUmVmXG4gICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8gPSB1bmRlZmluZWQ7XG4gICAgdGhpcy52YWx1ZV8gPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5pZF8gPSBuZXh0T2JzZXJ2ZXJJZCsrO1xuICB9XG5cbiAgT2JzZXJ2ZXIucHJvdG90eXBlID0ge1xuICAgIG9wZW46IGZ1bmN0aW9uKGNhbGxiYWNrLCB0YXJnZXQpIHtcbiAgICAgIGlmICh0aGlzLnN0YXRlXyAhPSBVTk9QRU5FRClcbiAgICAgICAgdGhyb3cgRXJyb3IoJ09ic2VydmVyIGhhcyBhbHJlYWR5IGJlZW4gb3BlbmVkLicpO1xuXG4gICAgICBhZGRUb0FsbCh0aGlzKTtcbiAgICAgIHRoaXMuY2FsbGJhY2tfID0gY2FsbGJhY2s7XG4gICAgICB0aGlzLnRhcmdldF8gPSB0YXJnZXQ7XG4gICAgICB0aGlzLmNvbm5lY3RfKCk7XG4gICAgICB0aGlzLnN0YXRlXyA9IE9QRU5FRDtcbiAgICAgIHJldHVybiB0aGlzLnZhbHVlXztcbiAgICB9LFxuXG4gICAgY2xvc2U6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuc3RhdGVfICE9IE9QRU5FRClcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICByZW1vdmVGcm9tQWxsKHRoaXMpO1xuICAgICAgdGhpcy5kaXNjb25uZWN0XygpO1xuICAgICAgdGhpcy52YWx1ZV8gPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLmNhbGxiYWNrXyA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMudGFyZ2V0XyA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMuc3RhdGVfID0gQ0xPU0VEO1xuICAgIH0sXG5cbiAgICBkZWxpdmVyOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLnN0YXRlXyAhPSBPUEVORUQpXG4gICAgICAgIHJldHVybjtcblxuICAgICAgZGlydHlDaGVjayh0aGlzKTtcbiAgICB9LFxuXG4gICAgcmVwb3J0XzogZnVuY3Rpb24oY2hhbmdlcykge1xuICAgICAgdHJ5IHtcbiAgICAgICAgdGhpcy5jYWxsYmFja18uYXBwbHkodGhpcy50YXJnZXRfLCBjaGFuZ2VzKTtcbiAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgIE9ic2VydmVyLl9lcnJvclRocm93bkR1cmluZ0NhbGxiYWNrID0gdHJ1ZTtcbiAgICAgICAgY29uc29sZS5lcnJvcignRXhjZXB0aW9uIGNhdWdodCBkdXJpbmcgb2JzZXJ2ZXIgY2FsbGJhY2s6ICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAoZXguc3RhY2sgfHwgZXgpKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgZGlzY2FyZENoYW5nZXM6IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5jaGVja18odW5kZWZpbmVkLCB0cnVlKTtcbiAgICAgIHJldHVybiB0aGlzLnZhbHVlXztcbiAgICB9XG4gIH1cblxuICB2YXIgY29sbGVjdE9ic2VydmVycyA9ICFoYXNPYnNlcnZlO1xuICB2YXIgYWxsT2JzZXJ2ZXJzO1xuICBPYnNlcnZlci5fYWxsT2JzZXJ2ZXJzQ291bnQgPSAwO1xuXG4gIGlmIChjb2xsZWN0T2JzZXJ2ZXJzKSB7XG4gICAgYWxsT2JzZXJ2ZXJzID0gW107XG4gIH1cblxuICBmdW5jdGlvbiBhZGRUb0FsbChvYnNlcnZlcikge1xuICAgIE9ic2VydmVyLl9hbGxPYnNlcnZlcnNDb3VudCsrO1xuICAgIGlmICghY29sbGVjdE9ic2VydmVycylcbiAgICAgIHJldHVybjtcblxuICAgIGFsbE9ic2VydmVycy5wdXNoKG9ic2VydmVyKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbW92ZUZyb21BbGwob2JzZXJ2ZXIpIHtcbiAgICBPYnNlcnZlci5fYWxsT2JzZXJ2ZXJzQ291bnQtLTtcbiAgfVxuXG4gIHZhciBydW5uaW5nTWljcm90YXNrQ2hlY2twb2ludCA9IGZhbHNlO1xuXG4gIHZhciBoYXNEZWJ1Z0ZvcmNlRnVsbERlbGl2ZXJ5ID0gaGFzT2JzZXJ2ZSAmJiBoYXNFdmFsICYmIChmdW5jdGlvbigpIHtcbiAgICB0cnkge1xuICAgICAgZXZhbCgnJVJ1bk1pY3JvdGFza3MoKScpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH0pKCk7XG5cbiAgZ2xvYmFsLlBsYXRmb3JtID0gZ2xvYmFsLlBsYXRmb3JtIHx8IHt9O1xuXG4gIGdsb2JhbC5QbGF0Zm9ybS5wZXJmb3JtTWljcm90YXNrQ2hlY2twb2ludCA9IGZ1bmN0aW9uKCkge1xuICAgIGlmIChydW5uaW5nTWljcm90YXNrQ2hlY2twb2ludClcbiAgICAgIHJldHVybjtcblxuICAgIGlmIChoYXNEZWJ1Z0ZvcmNlRnVsbERlbGl2ZXJ5KSB7XG4gICAgICBldmFsKCclUnVuTWljcm90YXNrcygpJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKCFjb2xsZWN0T2JzZXJ2ZXJzKVxuICAgICAgcmV0dXJuO1xuXG4gICAgcnVubmluZ01pY3JvdGFza0NoZWNrcG9pbnQgPSB0cnVlO1xuXG4gICAgdmFyIGN5Y2xlcyA9IDA7XG4gICAgdmFyIGFueUNoYW5nZWQsIHRvQ2hlY2s7XG5cbiAgICBkbyB7XG4gICAgICBjeWNsZXMrKztcbiAgICAgIHRvQ2hlY2sgPSBhbGxPYnNlcnZlcnM7XG4gICAgICBhbGxPYnNlcnZlcnMgPSBbXTtcbiAgICAgIGFueUNoYW5nZWQgPSBmYWxzZTtcblxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0b0NoZWNrLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBvYnNlcnZlciA9IHRvQ2hlY2tbaV07XG4gICAgICAgIGlmIChvYnNlcnZlci5zdGF0ZV8gIT0gT1BFTkVEKVxuICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgIGlmIChvYnNlcnZlci5jaGVja18oKSlcbiAgICAgICAgICBhbnlDaGFuZ2VkID0gdHJ1ZTtcblxuICAgICAgICBhbGxPYnNlcnZlcnMucHVzaChvYnNlcnZlcik7XG4gICAgICB9XG4gICAgICBpZiAocnVuRU9NVGFza3MoKSlcbiAgICAgICAgYW55Q2hhbmdlZCA9IHRydWU7XG4gICAgfSB3aGlsZSAoY3ljbGVzIDwgTUFYX0RJUlRZX0NIRUNLX0NZQ0xFUyAmJiBhbnlDaGFuZ2VkKTtcblxuICAgIGlmICh0ZXN0aW5nRXhwb3NlQ3ljbGVDb3VudClcbiAgICAgIGdsb2JhbC5kaXJ0eUNoZWNrQ3ljbGVDb3VudCA9IGN5Y2xlcztcblxuICAgIHJ1bm5pbmdNaWNyb3Rhc2tDaGVja3BvaW50ID0gZmFsc2U7XG4gIH07XG5cbiAgaWYgKGNvbGxlY3RPYnNlcnZlcnMpIHtcbiAgICBnbG9iYWwuUGxhdGZvcm0uY2xlYXJPYnNlcnZlcnMgPSBmdW5jdGlvbigpIHtcbiAgICAgIGFsbE9ic2VydmVycyA9IFtdO1xuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBPYmplY3RPYnNlcnZlcihvYmplY3QpIHtcbiAgICBPYnNlcnZlci5jYWxsKHRoaXMpO1xuICAgIHRoaXMudmFsdWVfID0gb2JqZWN0O1xuICAgIHRoaXMub2xkT2JqZWN0XyA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIE9iamVjdE9ic2VydmVyLnByb3RvdHlwZSA9IGNyZWF0ZU9iamVjdCh7XG4gICAgX19wcm90b19fOiBPYnNlcnZlci5wcm90b3R5cGUsXG5cbiAgICBhcnJheU9ic2VydmU6IGZhbHNlLFxuXG4gICAgY29ubmVjdF86IGZ1bmN0aW9uKGNhbGxiYWNrLCB0YXJnZXQpIHtcbiAgICAgIGlmIChoYXNPYnNlcnZlKSB7XG4gICAgICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfID0gZ2V0T2JzZXJ2ZWRPYmplY3QodGhpcywgdGhpcy52YWx1ZV8sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hcnJheU9ic2VydmUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5vbGRPYmplY3RfID0gdGhpcy5jb3B5T2JqZWN0KHRoaXMudmFsdWVfKTtcbiAgICAgIH1cblxuICAgIH0sXG5cbiAgICBjb3B5T2JqZWN0OiBmdW5jdGlvbihvYmplY3QpIHtcbiAgICAgIHZhciBjb3B5ID0gQXJyYXkuaXNBcnJheShvYmplY3QpID8gW10gOiB7fTtcbiAgICAgIGZvciAodmFyIHByb3AgaW4gb2JqZWN0KSB7XG4gICAgICAgIGNvcHlbcHJvcF0gPSBvYmplY3RbcHJvcF07XG4gICAgICB9O1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkob2JqZWN0KSlcbiAgICAgICAgY29weS5sZW5ndGggPSBvYmplY3QubGVuZ3RoO1xuICAgICAgcmV0dXJuIGNvcHk7XG4gICAgfSxcblxuICAgIGNoZWNrXzogZnVuY3Rpb24oY2hhbmdlUmVjb3Jkcywgc2tpcENoYW5nZXMpIHtcbiAgICAgIHZhciBkaWZmO1xuICAgICAgdmFyIG9sZFZhbHVlcztcbiAgICAgIGlmIChoYXNPYnNlcnZlKSB7XG4gICAgICAgIGlmICghY2hhbmdlUmVjb3JkcylcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgb2xkVmFsdWVzID0ge307XG4gICAgICAgIGRpZmYgPSBkaWZmT2JqZWN0RnJvbUNoYW5nZVJlY29yZHModGhpcy52YWx1ZV8sIGNoYW5nZVJlY29yZHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkVmFsdWVzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9sZFZhbHVlcyA9IHRoaXMub2xkT2JqZWN0XztcbiAgICAgICAgZGlmZiA9IGRpZmZPYmplY3RGcm9tT2xkT2JqZWN0KHRoaXMudmFsdWVfLCB0aGlzLm9sZE9iamVjdF8pO1xuICAgICAgfVxuXG4gICAgICBpZiAoZGlmZklzRW1wdHkoZGlmZikpXG4gICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgaWYgKCFoYXNPYnNlcnZlKVxuICAgICAgICB0aGlzLm9sZE9iamVjdF8gPSB0aGlzLmNvcHlPYmplY3QodGhpcy52YWx1ZV8pO1xuXG4gICAgICB0aGlzLnJlcG9ydF8oW1xuICAgICAgICBkaWZmLmFkZGVkIHx8IHt9LFxuICAgICAgICBkaWZmLnJlbW92ZWQgfHwge30sXG4gICAgICAgIGRpZmYuY2hhbmdlZCB8fCB7fSxcbiAgICAgICAgZnVuY3Rpb24ocHJvcGVydHkpIHtcbiAgICAgICAgICByZXR1cm4gb2xkVmFsdWVzW3Byb3BlcnR5XTtcbiAgICAgICAgfVxuICAgICAgXSk7XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0sXG5cbiAgICBkaXNjb25uZWN0XzogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoaGFzT2JzZXJ2ZSkge1xuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXy5jbG9zZSgpO1xuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXyA9IHVuZGVmaW5lZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMub2xkT2JqZWN0XyA9IHVuZGVmaW5lZDtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgZGVsaXZlcjogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5zdGF0ZV8gIT0gT1BFTkVEKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIGlmIChoYXNPYnNlcnZlKVxuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXy5kZWxpdmVyKGZhbHNlKTtcbiAgICAgIGVsc2VcbiAgICAgICAgZGlydHlDaGVjayh0aGlzKTtcbiAgICB9LFxuXG4gICAgZGlzY2FyZENoYW5nZXM6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuZGlyZWN0T2JzZXJ2ZXJfKVxuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXy5kZWxpdmVyKHRydWUpO1xuICAgICAgZWxzZVxuICAgICAgICB0aGlzLm9sZE9iamVjdF8gPSB0aGlzLmNvcHlPYmplY3QodGhpcy52YWx1ZV8pO1xuXG4gICAgICByZXR1cm4gdGhpcy52YWx1ZV87XG4gICAgfVxuICB9KTtcblxuICBmdW5jdGlvbiBBcnJheU9ic2VydmVyKGFycmF5KSB7XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGFycmF5KSlcbiAgICAgIHRocm93IEVycm9yKCdQcm92aWRlZCBvYmplY3QgaXMgbm90IGFuIEFycmF5Jyk7XG4gICAgT2JqZWN0T2JzZXJ2ZXIuY2FsbCh0aGlzLCBhcnJheSk7XG4gIH1cblxuICBBcnJheU9ic2VydmVyLnByb3RvdHlwZSA9IGNyZWF0ZU9iamVjdCh7XG5cbiAgICBfX3Byb3RvX186IE9iamVjdE9ic2VydmVyLnByb3RvdHlwZSxcblxuICAgIGFycmF5T2JzZXJ2ZTogdHJ1ZSxcblxuICAgIGNvcHlPYmplY3Q6IGZ1bmN0aW9uKGFycikge1xuICAgICAgcmV0dXJuIGFyci5zbGljZSgpO1xuICAgIH0sXG5cbiAgICBjaGVja186IGZ1bmN0aW9uKGNoYW5nZVJlY29yZHMpIHtcbiAgICAgIHZhciBzcGxpY2VzO1xuICAgICAgaWYgKGhhc09ic2VydmUpIHtcbiAgICAgICAgaWYgKCFjaGFuZ2VSZWNvcmRzKVxuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgc3BsaWNlcyA9IHByb2plY3RBcnJheVNwbGljZXModGhpcy52YWx1ZV8sIGNoYW5nZVJlY29yZHMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3BsaWNlcyA9IGNhbGNTcGxpY2VzKHRoaXMudmFsdWVfLCAwLCB0aGlzLnZhbHVlXy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm9sZE9iamVjdF8sIDAsIHRoaXMub2xkT2JqZWN0Xy5sZW5ndGgpO1xuICAgICAgfVxuXG4gICAgICBpZiAoIXNwbGljZXMgfHwgIXNwbGljZXMubGVuZ3RoKVxuICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgIGlmICghaGFzT2JzZXJ2ZSlcbiAgICAgICAgdGhpcy5vbGRPYmplY3RfID0gdGhpcy5jb3B5T2JqZWN0KHRoaXMudmFsdWVfKTtcblxuICAgICAgdGhpcy5yZXBvcnRfKFtzcGxpY2VzXSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH0pO1xuXG4gIEFycmF5T2JzZXJ2ZXIuYXBwbHlTcGxpY2VzID0gZnVuY3Rpb24ocHJldmlvdXMsIGN1cnJlbnQsIHNwbGljZXMpIHtcbiAgICBzcGxpY2VzLmZvckVhY2goZnVuY3Rpb24oc3BsaWNlKSB7XG4gICAgICB2YXIgc3BsaWNlQXJncyA9IFtzcGxpY2UuaW5kZXgsIHNwbGljZS5yZW1vdmVkLmxlbmd0aF07XG4gICAgICB2YXIgYWRkSW5kZXggPSBzcGxpY2UuaW5kZXg7XG4gICAgICB3aGlsZSAoYWRkSW5kZXggPCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCkge1xuICAgICAgICBzcGxpY2VBcmdzLnB1c2goY3VycmVudFthZGRJbmRleF0pO1xuICAgICAgICBhZGRJbmRleCsrO1xuICAgICAgfVxuXG4gICAgICBBcnJheS5wcm90b3R5cGUuc3BsaWNlLmFwcGx5KHByZXZpb3VzLCBzcGxpY2VBcmdzKTtcbiAgICB9KTtcbiAgfTtcblxuICBmdW5jdGlvbiBQYXRoT2JzZXJ2ZXIob2JqZWN0LCBwYXRoKSB7XG4gICAgT2JzZXJ2ZXIuY2FsbCh0aGlzKTtcblxuICAgIHRoaXMub2JqZWN0XyA9IG9iamVjdDtcbiAgICB0aGlzLnBhdGhfID0gZ2V0UGF0aChwYXRoKTtcbiAgICB0aGlzLmRpcmVjdE9ic2VydmVyXyA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIFBhdGhPYnNlcnZlci5wcm90b3R5cGUgPSBjcmVhdGVPYmplY3Qoe1xuICAgIF9fcHJvdG9fXzogT2JzZXJ2ZXIucHJvdG90eXBlLFxuXG4gICAgZ2V0IHBhdGgoKSB7XG4gICAgICByZXR1cm4gdGhpcy5wYXRoXztcbiAgICB9LFxuXG4gICAgY29ubmVjdF86IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKGhhc09ic2VydmUpXG4gICAgICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfID0gZ2V0T2JzZXJ2ZWRTZXQodGhpcywgdGhpcy5vYmplY3RfKTtcblxuICAgICAgdGhpcy5jaGVja18odW5kZWZpbmVkLCB0cnVlKTtcbiAgICB9LFxuXG4gICAgZGlzY29ubmVjdF86IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy52YWx1ZV8gPSB1bmRlZmluZWQ7XG5cbiAgICAgIGlmICh0aGlzLmRpcmVjdE9ic2VydmVyXykge1xuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXy5jbG9zZSh0aGlzKTtcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8gPSB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgfSxcblxuICAgIGl0ZXJhdGVPYmplY3RzXzogZnVuY3Rpb24ob2JzZXJ2ZSkge1xuICAgICAgdGhpcy5wYXRoXy5pdGVyYXRlT2JqZWN0cyh0aGlzLm9iamVjdF8sIG9ic2VydmUpO1xuICAgIH0sXG5cbiAgICBjaGVja186IGZ1bmN0aW9uKGNoYW5nZVJlY29yZHMsIHNraXBDaGFuZ2VzKSB7XG4gICAgICB2YXIgb2xkVmFsdWUgPSB0aGlzLnZhbHVlXztcbiAgICAgIHRoaXMudmFsdWVfID0gdGhpcy5wYXRoXy5nZXRWYWx1ZUZyb20odGhpcy5vYmplY3RfKTtcbiAgICAgIGlmIChza2lwQ2hhbmdlcyB8fCBhcmVTYW1lVmFsdWUodGhpcy52YWx1ZV8sIG9sZFZhbHVlKSlcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICB0aGlzLnJlcG9ydF8oW3RoaXMudmFsdWVfLCBvbGRWYWx1ZSwgdGhpc10pO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSxcblxuICAgIHNldFZhbHVlOiBmdW5jdGlvbihuZXdWYWx1ZSkge1xuICAgICAgaWYgKHRoaXMucGF0aF8pXG4gICAgICAgIHRoaXMucGF0aF8uc2V0VmFsdWVGcm9tKHRoaXMub2JqZWN0XywgbmV3VmFsdWUpO1xuICAgIH1cbiAgfSk7XG5cbiAgZnVuY3Rpb24gQ29tcG91bmRPYnNlcnZlcihyZXBvcnRDaGFuZ2VzT25PcGVuKSB7XG4gICAgT2JzZXJ2ZXIuY2FsbCh0aGlzKTtcblxuICAgIHRoaXMucmVwb3J0Q2hhbmdlc09uT3Blbl8gPSByZXBvcnRDaGFuZ2VzT25PcGVuO1xuICAgIHRoaXMudmFsdWVfID0gW107XG4gICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8gPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5vYnNlcnZlZF8gPSBbXTtcbiAgfVxuXG4gIHZhciBvYnNlcnZlclNlbnRpbmVsID0ge307XG5cbiAgQ29tcG91bmRPYnNlcnZlci5wcm90b3R5cGUgPSBjcmVhdGVPYmplY3Qoe1xuICAgIF9fcHJvdG9fXzogT2JzZXJ2ZXIucHJvdG90eXBlLFxuXG4gICAgY29ubmVjdF86IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKGhhc09ic2VydmUpIHtcbiAgICAgICAgdmFyIG9iamVjdDtcbiAgICAgICAgdmFyIG5lZWRzRGlyZWN0T2JzZXJ2ZXIgPSBmYWxzZTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLm9ic2VydmVkXy5sZW5ndGg7IGkgKz0gMikge1xuICAgICAgICAgIG9iamVjdCA9IHRoaXMub2JzZXJ2ZWRfW2ldXG4gICAgICAgICAgaWYgKG9iamVjdCAhPT0gb2JzZXJ2ZXJTZW50aW5lbCkge1xuICAgICAgICAgICAgbmVlZHNEaXJlY3RPYnNlcnZlciA9IHRydWU7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobmVlZHNEaXJlY3RPYnNlcnZlcilcbiAgICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXyA9IGdldE9ic2VydmVkU2V0KHRoaXMsIG9iamVjdCk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuY2hlY2tfKHVuZGVmaW5lZCwgIXRoaXMucmVwb3J0Q2hhbmdlc09uT3Blbl8pO1xuICAgIH0sXG5cbiAgICBkaXNjb25uZWN0XzogZnVuY3Rpb24oKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMub2JzZXJ2ZWRfLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgICAgIGlmICh0aGlzLm9ic2VydmVkX1tpXSA9PT0gb2JzZXJ2ZXJTZW50aW5lbClcbiAgICAgICAgICB0aGlzLm9ic2VydmVkX1tpICsgMV0uY2xvc2UoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMub2JzZXJ2ZWRfLmxlbmd0aCA9IDA7XG4gICAgICB0aGlzLnZhbHVlXy5sZW5ndGggPSAwO1xuXG4gICAgICBpZiAodGhpcy5kaXJlY3RPYnNlcnZlcl8pIHtcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8uY2xvc2UodGhpcyk7XG4gICAgICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfID0gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICBhZGRQYXRoOiBmdW5jdGlvbihvYmplY3QsIHBhdGgpIHtcbiAgICAgIGlmICh0aGlzLnN0YXRlXyAhPSBVTk9QRU5FRCAmJiB0aGlzLnN0YXRlXyAhPSBSRVNFVFRJTkcpXG4gICAgICAgIHRocm93IEVycm9yKCdDYW5ub3QgYWRkIHBhdGhzIG9uY2Ugc3RhcnRlZC4nKTtcblxuICAgICAgdmFyIHBhdGggPSBnZXRQYXRoKHBhdGgpO1xuICAgICAgdGhpcy5vYnNlcnZlZF8ucHVzaChvYmplY3QsIHBhdGgpO1xuICAgICAgaWYgKCF0aGlzLnJlcG9ydENoYW5nZXNPbk9wZW5fKVxuICAgICAgICByZXR1cm47XG4gICAgICB2YXIgaW5kZXggPSB0aGlzLm9ic2VydmVkXy5sZW5ndGggLyAyIC0gMTtcbiAgICAgIHRoaXMudmFsdWVfW2luZGV4XSA9IHBhdGguZ2V0VmFsdWVGcm9tKG9iamVjdCk7XG4gICAgfSxcblxuICAgIGFkZE9ic2VydmVyOiBmdW5jdGlvbihvYnNlcnZlcikge1xuICAgICAgaWYgKHRoaXMuc3RhdGVfICE9IFVOT1BFTkVEICYmIHRoaXMuc3RhdGVfICE9IFJFU0VUVElORylcbiAgICAgICAgdGhyb3cgRXJyb3IoJ0Nhbm5vdCBhZGQgb2JzZXJ2ZXJzIG9uY2Ugc3RhcnRlZC4nKTtcblxuICAgICAgdGhpcy5vYnNlcnZlZF8ucHVzaChvYnNlcnZlclNlbnRpbmVsLCBvYnNlcnZlcik7XG4gICAgICBpZiAoIXRoaXMucmVwb3J0Q2hhbmdlc09uT3Blbl8pXG4gICAgICAgIHJldHVybjtcbiAgICAgIHZhciBpbmRleCA9IHRoaXMub2JzZXJ2ZWRfLmxlbmd0aCAvIDIgLSAxO1xuICAgICAgdGhpcy52YWx1ZV9baW5kZXhdID0gb2JzZXJ2ZXIub3Blbih0aGlzLmRlbGl2ZXIsIHRoaXMpO1xuICAgIH0sXG5cbiAgICBzdGFydFJlc2V0OiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLnN0YXRlXyAhPSBPUEVORUQpXG4gICAgICAgIHRocm93IEVycm9yKCdDYW4gb25seSByZXNldCB3aGlsZSBvcGVuJyk7XG5cbiAgICAgIHRoaXMuc3RhdGVfID0gUkVTRVRUSU5HO1xuICAgICAgdGhpcy5kaXNjb25uZWN0XygpO1xuICAgIH0sXG5cbiAgICBmaW5pc2hSZXNldDogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5zdGF0ZV8gIT0gUkVTRVRUSU5HKVxuICAgICAgICB0aHJvdyBFcnJvcignQ2FuIG9ubHkgZmluaXNoUmVzZXQgYWZ0ZXIgc3RhcnRSZXNldCcpO1xuICAgICAgdGhpcy5zdGF0ZV8gPSBPUEVORUQ7XG4gICAgICB0aGlzLmNvbm5lY3RfKCk7XG5cbiAgICAgIHJldHVybiB0aGlzLnZhbHVlXztcbiAgICB9LFxuXG4gICAgaXRlcmF0ZU9iamVjdHNfOiBmdW5jdGlvbihvYnNlcnZlKSB7XG4gICAgICB2YXIgb2JqZWN0O1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLm9ic2VydmVkXy5sZW5ndGg7IGkgKz0gMikge1xuICAgICAgICBvYmplY3QgPSB0aGlzLm9ic2VydmVkX1tpXVxuICAgICAgICBpZiAob2JqZWN0ICE9PSBvYnNlcnZlclNlbnRpbmVsKVxuICAgICAgICAgIHRoaXMub2JzZXJ2ZWRfW2kgKyAxXS5pdGVyYXRlT2JqZWN0cyhvYmplY3QsIG9ic2VydmUpXG4gICAgICB9XG4gICAgfSxcblxuICAgIGNoZWNrXzogZnVuY3Rpb24oY2hhbmdlUmVjb3Jkcywgc2tpcENoYW5nZXMpIHtcbiAgICAgIHZhciBvbGRWYWx1ZXM7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMub2JzZXJ2ZWRfLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgICAgIHZhciBvYmplY3QgPSB0aGlzLm9ic2VydmVkX1tpXTtcbiAgICAgICAgdmFyIHBhdGggPSB0aGlzLm9ic2VydmVkX1tpKzFdO1xuICAgICAgICB2YXIgdmFsdWU7XG4gICAgICAgIGlmIChvYmplY3QgPT09IG9ic2VydmVyU2VudGluZWwpIHtcbiAgICAgICAgICB2YXIgb2JzZXJ2YWJsZSA9IHBhdGg7XG4gICAgICAgICAgdmFsdWUgPSB0aGlzLnN0YXRlXyA9PT0gVU5PUEVORUQgP1xuICAgICAgICAgICAgICBvYnNlcnZhYmxlLm9wZW4odGhpcy5kZWxpdmVyLCB0aGlzKSA6XG4gICAgICAgICAgICAgIG9ic2VydmFibGUuZGlzY2FyZENoYW5nZXMoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YWx1ZSA9IHBhdGguZ2V0VmFsdWVGcm9tKG9iamVjdCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc2tpcENoYW5nZXMpIHtcbiAgICAgICAgICB0aGlzLnZhbHVlX1tpIC8gMl0gPSB2YWx1ZTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhcmVTYW1lVmFsdWUodmFsdWUsIHRoaXMudmFsdWVfW2kgLyAyXSkpXG4gICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgb2xkVmFsdWVzID0gb2xkVmFsdWVzIHx8IFtdO1xuICAgICAgICBvbGRWYWx1ZXNbaSAvIDJdID0gdGhpcy52YWx1ZV9baSAvIDJdO1xuICAgICAgICB0aGlzLnZhbHVlX1tpIC8gMl0gPSB2YWx1ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFvbGRWYWx1ZXMpXG4gICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgLy8gVE9ETyhyYWZhZWx3KTogSGF2aW5nIG9ic2VydmVkXyBhcyB0aGUgdGhpcmQgY2FsbGJhY2sgYXJnIGhlcmUgaXNcbiAgICAgIC8vIHByZXR0eSBsYW1lIEFQSS4gRml4LlxuICAgICAgdGhpcy5yZXBvcnRfKFt0aGlzLnZhbHVlXywgb2xkVmFsdWVzLCB0aGlzLm9ic2VydmVkX10pO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9KTtcblxuICBmdW5jdGlvbiBpZGVudEZuKHZhbHVlKSB7IHJldHVybiB2YWx1ZTsgfVxuXG4gIGZ1bmN0aW9uIE9ic2VydmVyVHJhbnNmb3JtKG9ic2VydmFibGUsIGdldFZhbHVlRm4sIHNldFZhbHVlRm4sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRvbnRQYXNzVGhyb3VnaFNldCkge1xuICAgIHRoaXMuY2FsbGJhY2tfID0gdW5kZWZpbmVkO1xuICAgIHRoaXMudGFyZ2V0XyA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLnZhbHVlXyA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLm9ic2VydmFibGVfID0gb2JzZXJ2YWJsZTtcbiAgICB0aGlzLmdldFZhbHVlRm5fID0gZ2V0VmFsdWVGbiB8fCBpZGVudEZuO1xuICAgIHRoaXMuc2V0VmFsdWVGbl8gPSBzZXRWYWx1ZUZuIHx8IGlkZW50Rm47XG4gICAgLy8gVE9ETyhyYWZhZWx3KTogVGhpcyBpcyBhIHRlbXBvcmFyeSBoYWNrLiBQb2x5bWVyRXhwcmVzc2lvbnMgbmVlZHMgdGhpc1xuICAgIC8vIGF0IHRoZSBtb21lbnQgYmVjYXVzZSBvZiBhIGJ1ZyBpbiBpdCdzaWVzdGEgZGVwZW5kZW5jeSB0cmFja2luZy5cbiAgICB0aGlzLmRvbnRQYXNzVGhyb3VnaFNldF8gPSBkb250UGFzc1Rocm91Z2hTZXQ7XG4gIH1cblxuICBPYnNlcnZlclRyYW5zZm9ybS5wcm90b3R5cGUgPSB7XG4gICAgb3BlbjogZnVuY3Rpb24oY2FsbGJhY2ssIHRhcmdldCkge1xuICAgICAgdGhpcy5jYWxsYmFja18gPSBjYWxsYmFjaztcbiAgICAgIHRoaXMudGFyZ2V0XyA9IHRhcmdldDtcbiAgICAgIHRoaXMudmFsdWVfID1cbiAgICAgICAgICB0aGlzLmdldFZhbHVlRm5fKHRoaXMub2JzZXJ2YWJsZV8ub3Blbih0aGlzLm9ic2VydmVkQ2FsbGJhY2tfLCB0aGlzKSk7XG4gICAgICByZXR1cm4gdGhpcy52YWx1ZV87XG4gICAgfSxcblxuICAgIG9ic2VydmVkQ2FsbGJhY2tfOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgdmFsdWUgPSB0aGlzLmdldFZhbHVlRm5fKHZhbHVlKTtcbiAgICAgIGlmIChhcmVTYW1lVmFsdWUodmFsdWUsIHRoaXMudmFsdWVfKSlcbiAgICAgICAgcmV0dXJuO1xuICAgICAgdmFyIG9sZFZhbHVlID0gdGhpcy52YWx1ZV87XG4gICAgICB0aGlzLnZhbHVlXyA9IHZhbHVlO1xuICAgICAgdGhpcy5jYWxsYmFja18uY2FsbCh0aGlzLnRhcmdldF8sIHRoaXMudmFsdWVfLCBvbGRWYWx1ZSk7XG4gICAgfSxcblxuICAgIGRpc2NhcmRDaGFuZ2VzOiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMudmFsdWVfID0gdGhpcy5nZXRWYWx1ZUZuXyh0aGlzLm9ic2VydmFibGVfLmRpc2NhcmRDaGFuZ2VzKCkpO1xuICAgICAgcmV0dXJuIHRoaXMudmFsdWVfO1xuICAgIH0sXG5cbiAgICBkZWxpdmVyOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLm9ic2VydmFibGVfLmRlbGl2ZXIoKTtcbiAgICB9LFxuXG4gICAgc2V0VmFsdWU6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICB2YWx1ZSA9IHRoaXMuc2V0VmFsdWVGbl8odmFsdWUpO1xuICAgICAgaWYgKCF0aGlzLmRvbnRQYXNzVGhyb3VnaFNldF8gJiYgdGhpcy5vYnNlcnZhYmxlXy5zZXRWYWx1ZSlcbiAgICAgICAgcmV0dXJuIHRoaXMub2JzZXJ2YWJsZV8uc2V0VmFsdWUodmFsdWUpO1xuICAgIH0sXG5cbiAgICBjbG9zZTogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5vYnNlcnZhYmxlXylcbiAgICAgICAgdGhpcy5vYnNlcnZhYmxlXy5jbG9zZSgpO1xuICAgICAgdGhpcy5jYWxsYmFja18gPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLnRhcmdldF8gPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLm9ic2VydmFibGVfID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy52YWx1ZV8gPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLmdldFZhbHVlRm5fID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy5zZXRWYWx1ZUZuXyA9IHVuZGVmaW5lZDtcbiAgICB9XG4gIH1cblxuICB2YXIgZXhwZWN0ZWRSZWNvcmRUeXBlcyA9IHtcbiAgICBhZGQ6IHRydWUsXG4gICAgdXBkYXRlOiB0cnVlLFxuICAgIGRlbGV0ZTogdHJ1ZVxuICB9O1xuXG4gIGZ1bmN0aW9uIGRpZmZPYmplY3RGcm9tQ2hhbmdlUmVjb3JkcyhvYmplY3QsIGNoYW5nZVJlY29yZHMsIG9sZFZhbHVlcykge1xuICAgIHZhciBhZGRlZCA9IHt9O1xuICAgIHZhciByZW1vdmVkID0ge307XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoYW5nZVJlY29yZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciByZWNvcmQgPSBjaGFuZ2VSZWNvcmRzW2ldO1xuICAgICAgaWYgKCFleHBlY3RlZFJlY29yZFR5cGVzW3JlY29yZC50eXBlXSkge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdVbmtub3duIGNoYW5nZVJlY29yZCB0eXBlOiAnICsgcmVjb3JkLnR5cGUpO1xuICAgICAgICBjb25zb2xlLmVycm9yKHJlY29yZCk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoIShyZWNvcmQubmFtZSBpbiBvbGRWYWx1ZXMpKVxuICAgICAgICBvbGRWYWx1ZXNbcmVjb3JkLm5hbWVdID0gcmVjb3JkLm9sZFZhbHVlO1xuXG4gICAgICBpZiAocmVjb3JkLnR5cGUgPT0gJ3VwZGF0ZScpXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICBpZiAocmVjb3JkLnR5cGUgPT0gJ2FkZCcpIHtcbiAgICAgICAgaWYgKHJlY29yZC5uYW1lIGluIHJlbW92ZWQpXG4gICAgICAgICAgZGVsZXRlIHJlbW92ZWRbcmVjb3JkLm5hbWVdO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgYWRkZWRbcmVjb3JkLm5hbWVdID0gdHJ1ZTtcblxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gdHlwZSA9ICdkZWxldGUnXG4gICAgICBpZiAocmVjb3JkLm5hbWUgaW4gYWRkZWQpIHtcbiAgICAgICAgZGVsZXRlIGFkZGVkW3JlY29yZC5uYW1lXTtcbiAgICAgICAgZGVsZXRlIG9sZFZhbHVlc1tyZWNvcmQubmFtZV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZW1vdmVkW3JlY29yZC5uYW1lXSA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yICh2YXIgcHJvcCBpbiBhZGRlZClcbiAgICAgIGFkZGVkW3Byb3BdID0gb2JqZWN0W3Byb3BdO1xuXG4gICAgZm9yICh2YXIgcHJvcCBpbiByZW1vdmVkKVxuICAgICAgcmVtb3ZlZFtwcm9wXSA9IHVuZGVmaW5lZDtcblxuICAgIHZhciBjaGFuZ2VkID0ge307XG4gICAgZm9yICh2YXIgcHJvcCBpbiBvbGRWYWx1ZXMpIHtcbiAgICAgIGlmIChwcm9wIGluIGFkZGVkIHx8IHByb3AgaW4gcmVtb3ZlZClcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIHZhciBuZXdWYWx1ZSA9IG9iamVjdFtwcm9wXTtcbiAgICAgIGlmIChvbGRWYWx1ZXNbcHJvcF0gIT09IG5ld1ZhbHVlKVxuICAgICAgICBjaGFuZ2VkW3Byb3BdID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGFkZGVkOiBhZGRlZCxcbiAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgICBjaGFuZ2VkOiBjaGFuZ2VkXG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG5ld1NwbGljZShpbmRleCwgcmVtb3ZlZCwgYWRkZWRDb3VudCkge1xuICAgIHJldHVybiB7XG4gICAgICBpbmRleDogaW5kZXgsXG4gICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgICAgYWRkZWRDb3VudDogYWRkZWRDb3VudFxuICAgIH07XG4gIH1cblxuICB2YXIgRURJVF9MRUFWRSA9IDA7XG4gIHZhciBFRElUX1VQREFURSA9IDE7XG4gIHZhciBFRElUX0FERCA9IDI7XG4gIHZhciBFRElUX0RFTEVURSA9IDM7XG5cbiAgZnVuY3Rpb24gQXJyYXlTcGxpY2UoKSB7fVxuXG4gIEFycmF5U3BsaWNlLnByb3RvdHlwZSA9IHtcblxuICAgIC8vIE5vdGU6IFRoaXMgZnVuY3Rpb24gaXMgKmJhc2VkKiBvbiB0aGUgY29tcHV0YXRpb24gb2YgdGhlIExldmVuc2h0ZWluXG4gICAgLy8gXCJlZGl0XCIgZGlzdGFuY2UuIFRoZSBvbmUgY2hhbmdlIGlzIHRoYXQgXCJ1cGRhdGVzXCIgYXJlIHRyZWF0ZWQgYXMgdHdvXG4gICAgLy8gZWRpdHMgLSBub3Qgb25lLiBXaXRoIEFycmF5IHNwbGljZXMsIGFuIHVwZGF0ZSBpcyByZWFsbHkgYSBkZWxldGVcbiAgICAvLyBmb2xsb3dlZCBieSBhbiBhZGQuIEJ5IHJldGFpbmluZyB0aGlzLCB3ZSBvcHRpbWl6ZSBmb3IgXCJrZWVwaW5nXCIgdGhlXG4gICAgLy8gbWF4aW11bSBhcnJheSBpdGVtcyBpbiB0aGUgb3JpZ2luYWwgYXJyYXkuIEZvciBleGFtcGxlOlxuICAgIC8vXG4gICAgLy8gICAneHh4eDEyMycgLT4gJzEyM3l5eXknXG4gICAgLy9cbiAgICAvLyBXaXRoIDEtZWRpdCB1cGRhdGVzLCB0aGUgc2hvcnRlc3QgcGF0aCB3b3VsZCBiZSBqdXN0IHRvIHVwZGF0ZSBhbGwgc2V2ZW5cbiAgICAvLyBjaGFyYWN0ZXJzLiBXaXRoIDItZWRpdCB1cGRhdGVzLCB3ZSBkZWxldGUgNCwgbGVhdmUgMywgYW5kIGFkZCA0LiBUaGlzXG4gICAgLy8gbGVhdmVzIHRoZSBzdWJzdHJpbmcgJzEyMycgaW50YWN0LlxuICAgIGNhbGNFZGl0RGlzdGFuY2VzOiBmdW5jdGlvbihjdXJyZW50LCBjdXJyZW50U3RhcnQsIGN1cnJlbnRFbmQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZCwgb2xkU3RhcnQsIG9sZEVuZCkge1xuICAgICAgLy8gXCJEZWxldGlvblwiIGNvbHVtbnNcbiAgICAgIHZhciByb3dDb3VudCA9IG9sZEVuZCAtIG9sZFN0YXJ0ICsgMTtcbiAgICAgIHZhciBjb2x1bW5Db3VudCA9IGN1cnJlbnRFbmQgLSBjdXJyZW50U3RhcnQgKyAxO1xuICAgICAgdmFyIGRpc3RhbmNlcyA9IG5ldyBBcnJheShyb3dDb3VudCk7XG5cbiAgICAgIC8vIFwiQWRkaXRpb25cIiByb3dzLiBJbml0aWFsaXplIG51bGwgY29sdW1uLlxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByb3dDb3VudDsgaSsrKSB7XG4gICAgICAgIGRpc3RhbmNlc1tpXSA9IG5ldyBBcnJheShjb2x1bW5Db3VudCk7XG4gICAgICAgIGRpc3RhbmNlc1tpXVswXSA9IGk7XG4gICAgICB9XG5cbiAgICAgIC8vIEluaXRpYWxpemUgbnVsbCByb3dcbiAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgY29sdW1uQ291bnQ7IGorKylcbiAgICAgICAgZGlzdGFuY2VzWzBdW2pdID0gajtcblxuICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCByb3dDb3VudDsgaSsrKSB7XG4gICAgICAgIGZvciAodmFyIGogPSAxOyBqIDwgY29sdW1uQ291bnQ7IGorKykge1xuICAgICAgICAgIGlmICh0aGlzLmVxdWFscyhjdXJyZW50W2N1cnJlbnRTdGFydCArIGogLSAxXSwgb2xkW29sZFN0YXJ0ICsgaSAtIDFdKSlcbiAgICAgICAgICAgIGRpc3RhbmNlc1tpXVtqXSA9IGRpc3RhbmNlc1tpIC0gMV1baiAtIDFdO1xuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdmFyIG5vcnRoID0gZGlzdGFuY2VzW2kgLSAxXVtqXSArIDE7XG4gICAgICAgICAgICB2YXIgd2VzdCA9IGRpc3RhbmNlc1tpXVtqIC0gMV0gKyAxO1xuICAgICAgICAgICAgZGlzdGFuY2VzW2ldW2pdID0gbm9ydGggPCB3ZXN0ID8gbm9ydGggOiB3ZXN0O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gZGlzdGFuY2VzO1xuICAgIH0sXG5cbiAgICAvLyBUaGlzIHN0YXJ0cyBhdCB0aGUgZmluYWwgd2VpZ2h0LCBhbmQgd2Fsa3MgXCJiYWNrd2FyZFwiIGJ5IGZpbmRpbmdcbiAgICAvLyB0aGUgbWluaW11bSBwcmV2aW91cyB3ZWlnaHQgcmVjdXJzaXZlbHkgdW50aWwgdGhlIG9yaWdpbiBvZiB0aGUgd2VpZ2h0XG4gICAgLy8gbWF0cml4LlxuICAgIHNwbGljZU9wZXJhdGlvbnNGcm9tRWRpdERpc3RhbmNlczogZnVuY3Rpb24oZGlzdGFuY2VzKSB7XG4gICAgICB2YXIgaSA9IGRpc3RhbmNlcy5sZW5ndGggLSAxO1xuICAgICAgdmFyIGogPSBkaXN0YW5jZXNbMF0ubGVuZ3RoIC0gMTtcbiAgICAgIHZhciBjdXJyZW50ID0gZGlzdGFuY2VzW2ldW2pdO1xuICAgICAgdmFyIGVkaXRzID0gW107XG4gICAgICB3aGlsZSAoaSA+IDAgfHwgaiA+IDApIHtcbiAgICAgICAgaWYgKGkgPT0gMCkge1xuICAgICAgICAgIGVkaXRzLnB1c2goRURJVF9BREQpO1xuICAgICAgICAgIGotLTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaiA9PSAwKSB7XG4gICAgICAgICAgZWRpdHMucHVzaChFRElUX0RFTEVURSk7XG4gICAgICAgICAgaS0tO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIHZhciBub3J0aFdlc3QgPSBkaXN0YW5jZXNbaSAtIDFdW2ogLSAxXTtcbiAgICAgICAgdmFyIHdlc3QgPSBkaXN0YW5jZXNbaSAtIDFdW2pdO1xuICAgICAgICB2YXIgbm9ydGggPSBkaXN0YW5jZXNbaV1baiAtIDFdO1xuXG4gICAgICAgIHZhciBtaW47XG4gICAgICAgIGlmICh3ZXN0IDwgbm9ydGgpXG4gICAgICAgICAgbWluID0gd2VzdCA8IG5vcnRoV2VzdCA/IHdlc3QgOiBub3J0aFdlc3Q7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICBtaW4gPSBub3J0aCA8IG5vcnRoV2VzdCA/IG5vcnRoIDogbm9ydGhXZXN0O1xuXG4gICAgICAgIGlmIChtaW4gPT0gbm9ydGhXZXN0KSB7XG4gICAgICAgICAgaWYgKG5vcnRoV2VzdCA9PSBjdXJyZW50KSB7XG4gICAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfTEVBVkUpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfVVBEQVRFKTtcbiAgICAgICAgICAgIGN1cnJlbnQgPSBub3J0aFdlc3Q7XG4gICAgICAgICAgfVxuICAgICAgICAgIGktLTtcbiAgICAgICAgICBqLS07XG4gICAgICAgIH0gZWxzZSBpZiAobWluID09IHdlc3QpIHtcbiAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfREVMRVRFKTtcbiAgICAgICAgICBpLS07XG4gICAgICAgICAgY3VycmVudCA9IHdlc3Q7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZWRpdHMucHVzaChFRElUX0FERCk7XG4gICAgICAgICAgai0tO1xuICAgICAgICAgIGN1cnJlbnQgPSBub3J0aDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBlZGl0cy5yZXZlcnNlKCk7XG4gICAgICByZXR1cm4gZWRpdHM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFNwbGljZSBQcm9qZWN0aW9uIGZ1bmN0aW9uczpcbiAgICAgKlxuICAgICAqIEEgc3BsaWNlIG1hcCBpcyBhIHJlcHJlc2VudGF0aW9uIG9mIGhvdyBhIHByZXZpb3VzIGFycmF5IG9mIGl0ZW1zXG4gICAgICogd2FzIHRyYW5zZm9ybWVkIGludG8gYSBuZXcgYXJyYXkgb2YgaXRlbXMuIENvbmNlcHR1YWxseSBpdCBpcyBhIGxpc3Qgb2ZcbiAgICAgKiB0dXBsZXMgb2ZcbiAgICAgKlxuICAgICAqICAgPGluZGV4LCByZW1vdmVkLCBhZGRlZENvdW50PlxuICAgICAqXG4gICAgICogd2hpY2ggYXJlIGtlcHQgaW4gYXNjZW5kaW5nIGluZGV4IG9yZGVyIG9mLiBUaGUgdHVwbGUgcmVwcmVzZW50cyB0aGF0IGF0XG4gICAgICogdGhlIHxpbmRleHwsIHxyZW1vdmVkfCBzZXF1ZW5jZSBvZiBpdGVtcyB3ZXJlIHJlbW92ZWQsIGFuZCBjb3VudGluZyBmb3J3YXJkXG4gICAgICogZnJvbSB8aW5kZXh8LCB8YWRkZWRDb3VudHwgaXRlbXMgd2VyZSBhZGRlZC5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIExhY2tpbmcgaW5kaXZpZHVhbCBzcGxpY2UgbXV0YXRpb24gaW5mb3JtYXRpb24sIHRoZSBtaW5pbWFsIHNldCBvZlxuICAgICAqIHNwbGljZXMgY2FuIGJlIHN5bnRoZXNpemVkIGdpdmVuIHRoZSBwcmV2aW91cyBzdGF0ZSBhbmQgZmluYWwgc3RhdGUgb2YgYW5cbiAgICAgKiBhcnJheS4gVGhlIGJhc2ljIGFwcHJvYWNoIGlzIHRvIGNhbGN1bGF0ZSB0aGUgZWRpdCBkaXN0YW5jZSBtYXRyaXggYW5kXG4gICAgICogY2hvb3NlIHRoZSBzaG9ydGVzdCBwYXRoIHRocm91Z2ggaXQuXG4gICAgICpcbiAgICAgKiBDb21wbGV4aXR5OiBPKGwgKiBwKVxuICAgICAqICAgbDogVGhlIGxlbmd0aCBvZiB0aGUgY3VycmVudCBhcnJheVxuICAgICAqICAgcDogVGhlIGxlbmd0aCBvZiB0aGUgb2xkIGFycmF5XG4gICAgICovXG4gICAgY2FsY1NwbGljZXM6IGZ1bmN0aW9uKGN1cnJlbnQsIGN1cnJlbnRTdGFydCwgY3VycmVudEVuZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkLCBvbGRTdGFydCwgb2xkRW5kKSB7XG4gICAgICB2YXIgcHJlZml4Q291bnQgPSAwO1xuICAgICAgdmFyIHN1ZmZpeENvdW50ID0gMDtcblxuICAgICAgdmFyIG1pbkxlbmd0aCA9IE1hdGgubWluKGN1cnJlbnRFbmQgLSBjdXJyZW50U3RhcnQsIG9sZEVuZCAtIG9sZFN0YXJ0KTtcbiAgICAgIGlmIChjdXJyZW50U3RhcnQgPT0gMCAmJiBvbGRTdGFydCA9PSAwKVxuICAgICAgICBwcmVmaXhDb3VudCA9IHRoaXMuc2hhcmVkUHJlZml4KGN1cnJlbnQsIG9sZCwgbWluTGVuZ3RoKTtcblxuICAgICAgaWYgKGN1cnJlbnRFbmQgPT0gY3VycmVudC5sZW5ndGggJiYgb2xkRW5kID09IG9sZC5sZW5ndGgpXG4gICAgICAgIHN1ZmZpeENvdW50ID0gdGhpcy5zaGFyZWRTdWZmaXgoY3VycmVudCwgb2xkLCBtaW5MZW5ndGggLSBwcmVmaXhDb3VudCk7XG5cbiAgICAgIGN1cnJlbnRTdGFydCArPSBwcmVmaXhDb3VudDtcbiAgICAgIG9sZFN0YXJ0ICs9IHByZWZpeENvdW50O1xuICAgICAgY3VycmVudEVuZCAtPSBzdWZmaXhDb3VudDtcbiAgICAgIG9sZEVuZCAtPSBzdWZmaXhDb3VudDtcblxuICAgICAgaWYgKGN1cnJlbnRFbmQgLSBjdXJyZW50U3RhcnQgPT0gMCAmJiBvbGRFbmQgLSBvbGRTdGFydCA9PSAwKVxuICAgICAgICByZXR1cm4gW107XG5cbiAgICAgIGlmIChjdXJyZW50U3RhcnQgPT0gY3VycmVudEVuZCkge1xuICAgICAgICB2YXIgc3BsaWNlID0gbmV3U3BsaWNlKGN1cnJlbnRTdGFydCwgW10sIDApO1xuICAgICAgICB3aGlsZSAob2xkU3RhcnQgPCBvbGRFbmQpXG4gICAgICAgICAgc3BsaWNlLnJlbW92ZWQucHVzaChvbGRbb2xkU3RhcnQrK10pO1xuXG4gICAgICAgIHJldHVybiBbIHNwbGljZSBdO1xuICAgICAgfSBlbHNlIGlmIChvbGRTdGFydCA9PSBvbGRFbmQpXG4gICAgICAgIHJldHVybiBbIG5ld1NwbGljZShjdXJyZW50U3RhcnQsIFtdLCBjdXJyZW50RW5kIC0gY3VycmVudFN0YXJ0KSBdO1xuXG4gICAgICB2YXIgb3BzID0gdGhpcy5zcGxpY2VPcGVyYXRpb25zRnJvbUVkaXREaXN0YW5jZXMoXG4gICAgICAgICAgdGhpcy5jYWxjRWRpdERpc3RhbmNlcyhjdXJyZW50LCBjdXJyZW50U3RhcnQsIGN1cnJlbnRFbmQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGQsIG9sZFN0YXJ0LCBvbGRFbmQpKTtcblxuICAgICAgdmFyIHNwbGljZSA9IHVuZGVmaW5lZDtcbiAgICAgIHZhciBzcGxpY2VzID0gW107XG4gICAgICB2YXIgaW5kZXggPSBjdXJyZW50U3RhcnQ7XG4gICAgICB2YXIgb2xkSW5kZXggPSBvbGRTdGFydDtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHN3aXRjaChvcHNbaV0pIHtcbiAgICAgICAgICBjYXNlIEVESVRfTEVBVkU6XG4gICAgICAgICAgICBpZiAoc3BsaWNlKSB7XG4gICAgICAgICAgICAgIHNwbGljZXMucHVzaChzcGxpY2UpO1xuICAgICAgICAgICAgICBzcGxpY2UgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGluZGV4Kys7XG4gICAgICAgICAgICBvbGRJbmRleCsrO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSBFRElUX1VQREFURTpcbiAgICAgICAgICAgIGlmICghc3BsaWNlKVxuICAgICAgICAgICAgICBzcGxpY2UgPSBuZXdTcGxpY2UoaW5kZXgsIFtdLCAwKTtcblxuICAgICAgICAgICAgc3BsaWNlLmFkZGVkQ291bnQrKztcbiAgICAgICAgICAgIGluZGV4Kys7XG5cbiAgICAgICAgICAgIHNwbGljZS5yZW1vdmVkLnB1c2gob2xkW29sZEluZGV4XSk7XG4gICAgICAgICAgICBvbGRJbmRleCsrO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSBFRElUX0FERDpcbiAgICAgICAgICAgIGlmICghc3BsaWNlKVxuICAgICAgICAgICAgICBzcGxpY2UgPSBuZXdTcGxpY2UoaW5kZXgsIFtdLCAwKTtcblxuICAgICAgICAgICAgc3BsaWNlLmFkZGVkQ291bnQrKztcbiAgICAgICAgICAgIGluZGV4Kys7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIEVESVRfREVMRVRFOlxuICAgICAgICAgICAgaWYgKCFzcGxpY2UpXG4gICAgICAgICAgICAgIHNwbGljZSA9IG5ld1NwbGljZShpbmRleCwgW10sIDApO1xuXG4gICAgICAgICAgICBzcGxpY2UucmVtb3ZlZC5wdXNoKG9sZFtvbGRJbmRleF0pO1xuICAgICAgICAgICAgb2xkSW5kZXgrKztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChzcGxpY2UpIHtcbiAgICAgICAgc3BsaWNlcy5wdXNoKHNwbGljZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gc3BsaWNlcztcbiAgICB9LFxuXG4gICAgc2hhcmVkUHJlZml4OiBmdW5jdGlvbihjdXJyZW50LCBvbGQsIHNlYXJjaExlbmd0aCkge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzZWFyY2hMZW5ndGg7IGkrKylcbiAgICAgICAgaWYgKCF0aGlzLmVxdWFscyhjdXJyZW50W2ldLCBvbGRbaV0pKVxuICAgICAgICAgIHJldHVybiBpO1xuICAgICAgcmV0dXJuIHNlYXJjaExlbmd0aDtcbiAgICB9LFxuXG4gICAgc2hhcmVkU3VmZml4OiBmdW5jdGlvbihjdXJyZW50LCBvbGQsIHNlYXJjaExlbmd0aCkge1xuICAgICAgdmFyIGluZGV4MSA9IGN1cnJlbnQubGVuZ3RoO1xuICAgICAgdmFyIGluZGV4MiA9IG9sZC5sZW5ndGg7XG4gICAgICB2YXIgY291bnQgPSAwO1xuICAgICAgd2hpbGUgKGNvdW50IDwgc2VhcmNoTGVuZ3RoICYmIHRoaXMuZXF1YWxzKGN1cnJlbnRbLS1pbmRleDFdLCBvbGRbLS1pbmRleDJdKSlcbiAgICAgICAgY291bnQrKztcblxuICAgICAgcmV0dXJuIGNvdW50O1xuICAgIH0sXG5cbiAgICBjYWxjdWxhdGVTcGxpY2VzOiBmdW5jdGlvbihjdXJyZW50LCBwcmV2aW91cykge1xuICAgICAgcmV0dXJuIHRoaXMuY2FsY1NwbGljZXMoY3VycmVudCwgMCwgY3VycmVudC5sZW5ndGgsIHByZXZpb3VzLCAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJldmlvdXMubGVuZ3RoKTtcbiAgICB9LFxuXG4gICAgZXF1YWxzOiBmdW5jdGlvbihjdXJyZW50VmFsdWUsIHByZXZpb3VzVmFsdWUpIHtcbiAgICAgIHJldHVybiBjdXJyZW50VmFsdWUgPT09IHByZXZpb3VzVmFsdWU7XG4gICAgfVxuICB9O1xuXG4gIHZhciBhcnJheVNwbGljZSA9IG5ldyBBcnJheVNwbGljZSgpO1xuXG4gIGZ1bmN0aW9uIGNhbGNTcGxpY2VzKGN1cnJlbnQsIGN1cnJlbnRTdGFydCwgY3VycmVudEVuZCxcbiAgICAgICAgICAgICAgICAgICAgICAgb2xkLCBvbGRTdGFydCwgb2xkRW5kKSB7XG4gICAgcmV0dXJuIGFycmF5U3BsaWNlLmNhbGNTcGxpY2VzKGN1cnJlbnQsIGN1cnJlbnRTdGFydCwgY3VycmVudEVuZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkLCBvbGRTdGFydCwgb2xkRW5kKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGludGVyc2VjdChzdGFydDEsIGVuZDEsIHN0YXJ0MiwgZW5kMikge1xuICAgIC8vIERpc2pvaW50XG4gICAgaWYgKGVuZDEgPCBzdGFydDIgfHwgZW5kMiA8IHN0YXJ0MSlcbiAgICAgIHJldHVybiAtMTtcblxuICAgIC8vIEFkamFjZW50XG4gICAgaWYgKGVuZDEgPT0gc3RhcnQyIHx8IGVuZDIgPT0gc3RhcnQxKVxuICAgICAgcmV0dXJuIDA7XG5cbiAgICAvLyBOb24temVybyBpbnRlcnNlY3QsIHNwYW4xIGZpcnN0XG4gICAgaWYgKHN0YXJ0MSA8IHN0YXJ0Mikge1xuICAgICAgaWYgKGVuZDEgPCBlbmQyKVxuICAgICAgICByZXR1cm4gZW5kMSAtIHN0YXJ0MjsgLy8gT3ZlcmxhcFxuICAgICAgZWxzZVxuICAgICAgICByZXR1cm4gZW5kMiAtIHN0YXJ0MjsgLy8gQ29udGFpbmVkXG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIE5vbi16ZXJvIGludGVyc2VjdCwgc3BhbjIgZmlyc3RcbiAgICAgIGlmIChlbmQyIDwgZW5kMSlcbiAgICAgICAgcmV0dXJuIGVuZDIgLSBzdGFydDE7IC8vIE92ZXJsYXBcbiAgICAgIGVsc2VcbiAgICAgICAgcmV0dXJuIGVuZDEgLSBzdGFydDE7IC8vIENvbnRhaW5lZFxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG1lcmdlU3BsaWNlKHNwbGljZXMsIGluZGV4LCByZW1vdmVkLCBhZGRlZENvdW50KSB7XG5cbiAgICB2YXIgc3BsaWNlID0gbmV3U3BsaWNlKGluZGV4LCByZW1vdmVkLCBhZGRlZENvdW50KTtcblxuICAgIHZhciBpbnNlcnRlZCA9IGZhbHNlO1xuICAgIHZhciBpbnNlcnRpb25PZmZzZXQgPSAwO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzcGxpY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgY3VycmVudCA9IHNwbGljZXNbaV07XG4gICAgICBjdXJyZW50LmluZGV4ICs9IGluc2VydGlvbk9mZnNldDtcblxuICAgICAgaWYgKGluc2VydGVkKVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgdmFyIGludGVyc2VjdENvdW50ID0gaW50ZXJzZWN0KHNwbGljZS5pbmRleCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcGxpY2UuaW5kZXggKyBzcGxpY2UucmVtb3ZlZC5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudC5pbmRleCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50LmluZGV4ICsgY3VycmVudC5hZGRlZENvdW50KTtcblxuICAgICAgaWYgKGludGVyc2VjdENvdW50ID49IDApIHtcbiAgICAgICAgLy8gTWVyZ2UgdGhlIHR3byBzcGxpY2VzXG5cbiAgICAgICAgc3BsaWNlcy5zcGxpY2UoaSwgMSk7XG4gICAgICAgIGktLTtcblxuICAgICAgICBpbnNlcnRpb25PZmZzZXQgLT0gY3VycmVudC5hZGRlZENvdW50IC0gY3VycmVudC5yZW1vdmVkLmxlbmd0aDtcblxuICAgICAgICBzcGxpY2UuYWRkZWRDb3VudCArPSBjdXJyZW50LmFkZGVkQ291bnQgLSBpbnRlcnNlY3RDb3VudDtcbiAgICAgICAgdmFyIGRlbGV0ZUNvdW50ID0gc3BsaWNlLnJlbW92ZWQubGVuZ3RoICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudC5yZW1vdmVkLmxlbmd0aCAtIGludGVyc2VjdENvdW50O1xuXG4gICAgICAgIGlmICghc3BsaWNlLmFkZGVkQ291bnQgJiYgIWRlbGV0ZUNvdW50KSB7XG4gICAgICAgICAgLy8gbWVyZ2VkIHNwbGljZSBpcyBhIG5vb3AuIGRpc2NhcmQuXG4gICAgICAgICAgaW5zZXJ0ZWQgPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhciByZW1vdmVkID0gY3VycmVudC5yZW1vdmVkO1xuXG4gICAgICAgICAgaWYgKHNwbGljZS5pbmRleCA8IGN1cnJlbnQuaW5kZXgpIHtcbiAgICAgICAgICAgIC8vIHNvbWUgcHJlZml4IG9mIHNwbGljZS5yZW1vdmVkIGlzIHByZXBlbmRlZCB0byBjdXJyZW50LnJlbW92ZWQuXG4gICAgICAgICAgICB2YXIgcHJlcGVuZCA9IHNwbGljZS5yZW1vdmVkLnNsaWNlKDAsIGN1cnJlbnQuaW5kZXggLSBzcGxpY2UuaW5kZXgpO1xuICAgICAgICAgICAgQXJyYXkucHJvdG90eXBlLnB1c2guYXBwbHkocHJlcGVuZCwgcmVtb3ZlZCk7XG4gICAgICAgICAgICByZW1vdmVkID0gcHJlcGVuZDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoc3BsaWNlLmluZGV4ICsgc3BsaWNlLnJlbW92ZWQubGVuZ3RoID4gY3VycmVudC5pbmRleCArIGN1cnJlbnQuYWRkZWRDb3VudCkge1xuICAgICAgICAgICAgLy8gc29tZSBzdWZmaXggb2Ygc3BsaWNlLnJlbW92ZWQgaXMgYXBwZW5kZWQgdG8gY3VycmVudC5yZW1vdmVkLlxuICAgICAgICAgICAgdmFyIGFwcGVuZCA9IHNwbGljZS5yZW1vdmVkLnNsaWNlKGN1cnJlbnQuaW5kZXggKyBjdXJyZW50LmFkZGVkQ291bnQgLSBzcGxpY2UuaW5kZXgpO1xuICAgICAgICAgICAgQXJyYXkucHJvdG90eXBlLnB1c2guYXBwbHkocmVtb3ZlZCwgYXBwZW5kKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBzcGxpY2UucmVtb3ZlZCA9IHJlbW92ZWQ7XG4gICAgICAgICAgaWYgKGN1cnJlbnQuaW5kZXggPCBzcGxpY2UuaW5kZXgpIHtcbiAgICAgICAgICAgIHNwbGljZS5pbmRleCA9IGN1cnJlbnQuaW5kZXg7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHNwbGljZS5pbmRleCA8IGN1cnJlbnQuaW5kZXgpIHtcbiAgICAgICAgLy8gSW5zZXJ0IHNwbGljZSBoZXJlLlxuXG4gICAgICAgIGluc2VydGVkID0gdHJ1ZTtcblxuICAgICAgICBzcGxpY2VzLnNwbGljZShpLCAwLCBzcGxpY2UpO1xuICAgICAgICBpKys7XG5cbiAgICAgICAgdmFyIG9mZnNldCA9IHNwbGljZS5hZGRlZENvdW50IC0gc3BsaWNlLnJlbW92ZWQubGVuZ3RoXG4gICAgICAgIGN1cnJlbnQuaW5kZXggKz0gb2Zmc2V0O1xuICAgICAgICBpbnNlcnRpb25PZmZzZXQgKz0gb2Zmc2V0O1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghaW5zZXJ0ZWQpXG4gICAgICBzcGxpY2VzLnB1c2goc3BsaWNlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZUluaXRpYWxTcGxpY2VzKGFycmF5LCBjaGFuZ2VSZWNvcmRzKSB7XG4gICAgdmFyIHNwbGljZXMgPSBbXTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hhbmdlUmVjb3Jkcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHJlY29yZCA9IGNoYW5nZVJlY29yZHNbaV07XG4gICAgICBzd2l0Y2gocmVjb3JkLnR5cGUpIHtcbiAgICAgICAgY2FzZSAnc3BsaWNlJzpcbiAgICAgICAgICBtZXJnZVNwbGljZShzcGxpY2VzLCByZWNvcmQuaW5kZXgsIHJlY29yZC5yZW1vdmVkLnNsaWNlKCksIHJlY29yZC5hZGRlZENvdW50KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnYWRkJzpcbiAgICAgICAgY2FzZSAndXBkYXRlJzpcbiAgICAgICAgY2FzZSAnZGVsZXRlJzpcbiAgICAgICAgICBpZiAoIWlzSW5kZXgocmVjb3JkLm5hbWUpKVxuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgdmFyIGluZGV4ID0gdG9OdW1iZXIocmVjb3JkLm5hbWUpO1xuICAgICAgICAgIGlmIChpbmRleCA8IDApXG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICBtZXJnZVNwbGljZShzcGxpY2VzLCBpbmRleCwgW3JlY29yZC5vbGRWYWx1ZV0sIDEpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1VuZXhwZWN0ZWQgcmVjb3JkIHR5cGU6ICcgKyBKU09OLnN0cmluZ2lmeShyZWNvcmQpKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gc3BsaWNlcztcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb2plY3RBcnJheVNwbGljZXMoYXJyYXksIGNoYW5nZVJlY29yZHMpIHtcbiAgICB2YXIgc3BsaWNlcyA9IFtdO1xuXG4gICAgY3JlYXRlSW5pdGlhbFNwbGljZXMoYXJyYXksIGNoYW5nZVJlY29yZHMpLmZvckVhY2goZnVuY3Rpb24oc3BsaWNlKSB7XG4gICAgICBpZiAoc3BsaWNlLmFkZGVkQ291bnQgPT0gMSAmJiBzcGxpY2UucmVtb3ZlZC5sZW5ndGggPT0gMSkge1xuICAgICAgICBpZiAoc3BsaWNlLnJlbW92ZWRbMF0gIT09IGFycmF5W3NwbGljZS5pbmRleF0pXG4gICAgICAgICAgc3BsaWNlcy5wdXNoKHNwbGljZSk7XG5cbiAgICAgICAgcmV0dXJuXG4gICAgICB9O1xuXG4gICAgICBzcGxpY2VzID0gc3BsaWNlcy5jb25jYXQoY2FsY1NwbGljZXMoYXJyYXksIHNwbGljZS5pbmRleCwgc3BsaWNlLmluZGV4ICsgc3BsaWNlLmFkZGVkQ291bnQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3BsaWNlLnJlbW92ZWQsIDAsIHNwbGljZS5yZW1vdmVkLmxlbmd0aCkpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHNwbGljZXM7XG4gIH1cblxuIC8vIEV4cG9ydCB0aGUgb2JzZXJ2ZS1qcyBvYmplY3QgZm9yICoqTm9kZS5qcyoqLCB3aXRoXG4vLyBiYWNrd2FyZHMtY29tcGF0aWJpbGl0eSBmb3IgdGhlIG9sZCBgcmVxdWlyZSgpYCBBUEkuIElmIHdlJ3JlIGluXG4vLyB0aGUgYnJvd3NlciwgZXhwb3J0IGFzIGEgZ2xvYmFsIG9iamVjdC5cbnZhciBleHBvc2UgPSBnbG9iYWw7XG5pZiAodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcbmV4cG9zZSA9IGV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cztcbn1cbmV4cG9zZSA9IGV4cG9ydHM7XG59XG5leHBvc2UuT2JzZXJ2ZXIgPSBPYnNlcnZlcjtcbmV4cG9zZS5PYnNlcnZlci5ydW5FT01fID0gcnVuRU9NO1xuZXhwb3NlLk9ic2VydmVyLm9ic2VydmVyU2VudGluZWxfID0gb2JzZXJ2ZXJTZW50aW5lbDsgLy8gZm9yIHRlc3RpbmcuXG5leHBvc2UuT2JzZXJ2ZXIuaGFzT2JqZWN0T2JzZXJ2ZSA9IGhhc09ic2VydmU7XG5leHBvc2UuQXJyYXlPYnNlcnZlciA9IEFycmF5T2JzZXJ2ZXI7XG5leHBvc2UuQXJyYXlPYnNlcnZlci5jYWxjdWxhdGVTcGxpY2VzID0gZnVuY3Rpb24oY3VycmVudCwgcHJldmlvdXMpIHtcbnJldHVybiBhcnJheVNwbGljZS5jYWxjdWxhdGVTcGxpY2VzKGN1cnJlbnQsIHByZXZpb3VzKTtcbn07XG5leHBvc2UuUGxhdGZvcm0gPSBnbG9iYWwuUGxhdGZvcm07XG5leHBvc2UuQXJyYXlTcGxpY2UgPSBBcnJheVNwbGljZTtcbmV4cG9zZS5PYmplY3RPYnNlcnZlciA9IE9iamVjdE9ic2VydmVyO1xuZXhwb3NlLlBhdGhPYnNlcnZlciA9IFBhdGhPYnNlcnZlcjtcbmV4cG9zZS5Db21wb3VuZE9ic2VydmVyID0gQ29tcG91bmRPYnNlcnZlcjtcbmV4cG9zZS5QYXRoID0gUGF0aDtcbmV4cG9zZS5PYnNlcnZlclRyYW5zZm9ybSA9IE9ic2VydmVyVHJhbnNmb3JtO1xufSkodHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcgJiYgZ2xvYmFsICYmIHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZSA/IGdsb2JhbCA6IHRoaXMgfHwgd2luZG93KTtcblxufSkuY2FsbCh0aGlzLHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pIiwiZnVuY3Rpb24gTG9nZ2VyIChuYW1lKSB7XG4gICAgaWYgKCF0aGlzKSByZXR1cm4gbmV3IExvZ2dlcihuYW1lKTtcbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xuXG4gICAgdGhpcy50cmFjZSA9IGNvbnN0cnVjdFBlcmZvcm1lcih0aGlzLCBfLmJpbmQoY29uc29sZS5kZWJ1ZyA/IGNvbnNvbGUuZGVidWcgOiBjb25zb2xlLmxvZywgY29uc29sZSksIExvZ2dlci5MZXZlbC50cmFjZSk7XG4gICAgdGhpcy5kZWJ1ZyA9IGNvbnN0cnVjdFBlcmZvcm1lcih0aGlzLCBfLmJpbmQoY29uc29sZS5kZWJ1ZyA/IGNvbnNvbGUuZGVidWcgIDogY29uc29sZS5sb2csIGNvbnNvbGUpLCBMb2dnZXIuTGV2ZWwuZGVidWcpO1xuICAgIHRoaXMuaW5mbyA9IGNvbnN0cnVjdFBlcmZvcm1lcih0aGlzLCBfLmJpbmQoY29uc29sZS5pbmZvID8gY29uc29sZS5pbmZvIDogY29uc29sZS5sb2csIGNvbnNvbGUpLCBMb2dnZXIuTGV2ZWwuaW5mbyk7XG4gICAgdGhpcy5sb2cgPSBjb25zdHJ1Y3RQZXJmb3JtZXIodGhpcywgXy5iaW5kKGNvbnNvbGUubG9nID8gY29uc29sZS5sb2cgOiBjb25zb2xlLmxvZywgY29uc29sZSksIExvZ2dlci5MZXZlbC5pbmZvKTtcbiAgICB0aGlzLndhcm4gPSBjb25zdHJ1Y3RQZXJmb3JtZXIodGhpcywgXy5iaW5kKGNvbnNvbGUud2FybiA/IGNvbnNvbGUud2FybiA6IGNvbnNvbGUubG9nLCBjb25zb2xlKSwgTG9nZ2VyLkxldmVsLndhcm5pbmcpO1xuICAgIHRoaXMuZXJyb3IgPSBjb25zdHJ1Y3RQZXJmb3JtZXIodGhpcywgXy5iaW5kKGNvbnNvbGUuZXJyb3IgPyBjb25zb2xlLmVycm9yIDogY29uc29sZS5sb2csIGNvbnNvbGUpLCBMb2dnZXIuTGV2ZWwuZXJyb3IpO1xuICAgIHRoaXMuZmF0YWwgPSBjb25zdHJ1Y3RQZXJmb3JtZXIodGhpcywgXy5iaW5kKGNvbnNvbGUuZXJyb3IgPyBjb25zb2xlLmVycm9yIDogY29uc29sZS5sb2csIGNvbnNvbGUpLCBMb2dnZXIuTGV2ZWwuZmF0YWwpO1xuXG59XG5cbnZhciBsb2dMZXZlbHMgPSB7fTtcblxuZnVuY3Rpb24gY29uc3RydWN0UGVyZm9ybWVyIChsb2dnZXIsIGYsIGxldmVsKSB7XG4gICAgdmFyIHBlcmZvcm1lciA9IGZ1bmN0aW9uIChtZXNzYWdlKSB7XG4gICAgICAgIGxvZ2dlci5wZXJmb3JtTG9nKGYsIGxldmVsLCBtZXNzYWdlLCBhcmd1bWVudHMpO1xuICAgIH07XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHBlcmZvcm1lciwgJ2lzRW5hYmxlZCcsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgY3VycmVudExldmVsID0gbG9nZ2VyLmN1cnJlbnRMZXZlbCgpO1xuICAgICAgICAgICAgcmV0dXJuIGxldmVsID49IGN1cnJlbnRMZXZlbDtcbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSk7XG4gICAgcGVyZm9ybWVyLmYgPSBmO1xuICAgIHBlcmZvcm1lci5sb2dnZXIgPSBsb2dnZXI7XG4gICAgcGVyZm9ybWVyLmxldmVsID0gbGV2ZWw7XG4gICAgcmV0dXJuIHBlcmZvcm1lcjtcbn1cblxuTG9nZ2VyLkxldmVsID0ge1xuICAgIHRyYWNlOiAwLFxuICAgIGRlYnVnOiAxLFxuICAgIGluZm86IDIsXG4gICAgd2FybmluZzogMyxcbiAgICB3YXJuOiAzLFxuICAgIGVycm9yOiA0LFxuICAgIGZhdGFsOiA1XG59O1xuXG5Mb2dnZXIuTGV2ZWxUZXh0ID0ge307XG5Mb2dnZXIuTGV2ZWxUZXh0IFtMb2dnZXIuTGV2ZWwudHJhY2VdID0gJ1RSQUNFJztcbkxvZ2dlci5MZXZlbFRleHQgW0xvZ2dlci5MZXZlbC5kZWJ1Z10gPSAnREVCVUcnO1xuTG9nZ2VyLkxldmVsVGV4dCBbTG9nZ2VyLkxldmVsLmluZm9dID0gJ0lORk8gJztcbkxvZ2dlci5MZXZlbFRleHQgW0xvZ2dlci5MZXZlbC53YXJuaW5nXSA9ICdXQVJOICc7XG5Mb2dnZXIuTGV2ZWxUZXh0IFtMb2dnZXIuTGV2ZWwuZXJyb3JdID0gJ0VSUk9SJztcblxuTG9nZ2VyLmxldmVsQXNUZXh0ID0gZnVuY3Rpb24gKGxldmVsKSB7XG4gICAgcmV0dXJuIHRoaXMuTGV2ZWxUZXh0W2xldmVsXTtcbn07XG5cbkxvZ2dlci5sb2dnZXJXaXRoTmFtZSA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBMb2dnZXIobmFtZSk7XG59O1xuXG5Mb2dnZXIucHJvdG90eXBlLmN1cnJlbnRMZXZlbCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgbG9nTGV2ZWwgPSBsb2dMZXZlbHNbdGhpcy5uYW1lXTtcbiAgICByZXR1cm4gIGxvZ0xldmVsID8gbG9nTGV2ZWwgOiBMb2dnZXIuTGV2ZWwudHJhY2U7XG59O1xuXG5Mb2dnZXIucHJvdG90eXBlLnNldExldmVsID0gZnVuY3Rpb24gKGxldmVsKSB7XG4gICAgbG9nTGV2ZWxzW3RoaXMubmFtZV0gPSBsZXZlbDtcbn07XG5cbkxvZ2dlci5wcm90b3R5cGUub3ZlcnJpZGUgPSBmdW5jdGlvbiAobGV2ZWwsIG92ZXJyaWRlLCBtZXNzYWdlKSB7XG4gICAgdmFyIGxldmVsQXNUZXh0ID0gTG9nZ2VyLmxldmVsQXNUZXh0KGxldmVsKTtcbiAgICB2YXIgcGVyZm9ybWVyID0gdGhpc1tsZXZlbEFzVGV4dC50cmltKCkudG9Mb3dlckNhc2UoKV07XG4gICAgdmFyIGYgPSBwZXJmb3JtZXIuZjtcbiAgICB2YXIgb3RoZXJBcmd1bWVudHMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDMsIGFyZ3VtZW50cy5sZW5ndGgpO1xuICAgIHRoaXMucGVyZm9ybUxvZyhmLCBsZXZlbCwgbWVzc2FnZSwgb3RoZXJBcmd1bWVudHMsIG92ZXJyaWRlKTtcbn07XG5cbkxvZ2dlci5wcm90b3R5cGUucGVyZm9ybUxvZyA9IGZ1bmN0aW9uIChsb2dGdW5jLCBsZXZlbCwgbWVzc2FnZSwgb3RoZXJBcmd1bWVudHMsIG92ZXJyaWRlKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBjdXJyZW50TGV2ZWwgPSBvdmVycmlkZSAhPT0gdW5kZWZpbmVkID8gb3ZlcnJpZGUgOiB0aGlzLmN1cnJlbnRMZXZlbCgpO1xuICAgIGlmIChjdXJyZW50TGV2ZWwgPD0gbGV2ZWwpIHtcbiAgICAgICAgbG9nRnVuYyA9IF8ucGFydGlhbChsb2dGdW5jLCBMb2dnZXIubGV2ZWxBc1RleHQobGV2ZWwpICsgJyBbJyArIHNlbGYubmFtZSArICddOiAnICsgbWVzc2FnZSk7XG4gICAgICAgIHZhciBhcmdzID0gW107XG4gICAgICAgIGZvciAodmFyIGk9MDsgaTxvdGhlckFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpXSA9IG90aGVyQXJndW1lbnRzW2ldO1xuICAgICAgICB9XG4gICAgICAgIGFyZ3Muc3BsaWNlKDAsIDEpO1xuICAgICAgICBsb2dGdW5jLmFwcGx5KGxvZ0Z1bmMsIGFyZ3MpO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gTG9nZ2VyO1xuIiwidmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJyk7XG52YXIgTG9nZ2VyID0gbG9nLmxvZ2dlcldpdGhOYW1lKCdPcGVyYXRpb24nKTtcblxuZnVuY3Rpb24gT3BlcmF0aW9uKCkge1xuICAgIGlmICghdGhpcykge1xuICAgICAgICByZXR1cm4gbmV3IChGdW5jdGlvbi5wcm90b3R5cGUuYmluZC5hcHBseShPcGVyYXRpb24sIGFyZ3VtZW50cykpO1xuICAgIH1cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgaWYgKHR5cGVvZihhcmd1bWVudHNbMF0pID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICB0aGlzLm5hbWUgPSBhcmd1bWVudHNbMF07XG4gICAgICAgICAgICB0aGlzLndvcmsgPSBhcmd1bWVudHNbMV07XG4gICAgICAgICAgICB0aGlzLmNvbXBsZXRpb24gPSBhcmd1bWVudHNbMl07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodHlwZW9mKGFyZ3VtZW50c1swXSkgPT0gJ2Z1bmN0aW9uJyB8fFxuICAgICAgICAgICAgT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGFyZ3VtZW50c1swXSkgPT09ICdbb2JqZWN0IEFycmF5XScgfHxcbiAgICAgICAgICAgIGFyZ3VtZW50c1swXSBpbnN0YW5jZW9mIE9wZXJhdGlvbikge1xuICAgICAgICAgICAgdGhpcy53b3JrID0gYXJndW1lbnRzWzBdO1xuICAgICAgICAgICAgdGhpcy5jb21wbGV0aW9uID0gYXJndW1lbnRzWzFdO1xuICAgICAgICB9XG4gICAgfVxuICAgIHRoaXMuZXJyb3IgPSBudWxsO1xuICAgIHRoaXMuY29tcGxldGVkID0gZmFsc2U7XG4gICAgdGhpcy5yZXN1bHQgPSBudWxsO1xuICAgIHRoaXMucnVubmluZyA9IGZhbHNlO1xuICAgIHRoaXMuY2FuY2VsbGVkID0gZmFsc2U7XG4gICAgdGhpcy5kZXBlbmRlbmNpZXMgPSBbXTtcbiAgICB0aGlzLl9tdXN0U3VjY2VlZCA9IFtdO1xuICAgIHRoaXMuX29uQ29tcGxldGlvbiA9IFtdO1xuICAgIHRoaXMubG9nTGV2ZWwgPSBudWxsOyAvLyBPdmVycmlkZS5cblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnZmFpbGVkJywge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiAgISFzZWxmLmVycm9yIHx8IHNlbGYuZmFpbGVkRHVlVG9EZXBlbmRlbmN5O1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnY29tcG9zaXRlJywge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBzZWxmLndvcmsgaW5zdGFuY2VvZiBPcGVyYXRpb24gfHxcbiAgICAgICAgICAgICAgICBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoc2VsZi53b3JrKSA9PT0gJ1tvYmplY3QgQXJyYXldJ1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnbnVtT3BlcmF0aW9uc1JlbWFpbmluZycsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoc2VsZi53b3JrIGluc3RhbmNlb2YgT3BlcmF0aW9uKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNlbGYud29yay5jb21wbGV0ZWQgPyAwIDogMVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHNlbGYud29yaykgPT09ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gXy5yZWR1Y2Uoc2VsZi53b3JrLCBmdW5jdGlvbiAobWVtbywgb3ApIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFvcC5jb21wbGV0ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBtZW1vICsgMTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgICAgICAgICB9LCAwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnY2FuUnVuJywge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChzZWxmLmRlcGVuZGVuY2llcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gXy5yZWR1Y2Uoc2VsZi5kZXBlbmRlbmNpZXMsIGZ1bmN0aW9uIChtZW1vLCBkZXApIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG11c3RTdWNjZWVkID0gc2VsZi5fbXVzdFN1Y2NlZWQuaW5kZXhPZihkZXApID4gLTE7XG4gICAgICAgICAgICAgICAgICAgIHZhciBjYW5SdW4gPSBtZW1vICYmIGRlcC5jb21wbGV0ZWQ7XG4gICAgICAgICAgICAgICAgICAgIGlmIChtdXN0U3VjY2VlZCAmJiBjYW5SdW4pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhblJ1biA9IGNhblJ1biAmJiAhKGRlcC5mYWlsZWQgfHwgZGVwLmNhbmNlbGxlZCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNhblJ1bjtcbiAgICAgICAgICAgICAgICB9LCB0cnVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnZmFpbGVkRHVlVG9EZXBlbmRlbmN5Jywge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChzZWxmLmRlcGVuZGVuY2llcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB2YXIgZmFpbGVkRGVwcyA9IF8ucmVkdWNlKHNlbGYuZGVwZW5kZW5jaWVzLCBmdW5jdGlvbiAobWVtbywgZGVwKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBtdXN0U3VjY2VlZCA9IHNlbGYuX211c3RTdWNjZWVkLmluZGV4T2YoZGVwKSA+IC0xO1xuICAgICAgICAgICAgICAgICAgICB2YXIgZmFpbGVkID0gKChkZXAuZmFpbGVkIHx8IGRlcC5jYW5jZWxsZWQpICYmIG11c3RTdWNjZWVkKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZhaWxlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVtby5wdXNoKGRlcCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgICAgICAgICAgfSwgW10pO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWlsZWREZXBzLmxlbmd0aCA/IGZhaWxlZERlcHMgOiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSk7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ2ZhaWxlZER1ZVRvQ2FuY2VsbGF0aW9uT2ZEZXBlbmRlbmN5Jywge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChzZWxmLmRlcGVuZGVuY2llcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB2YXIgY2FuY2VsbGVkID0gXy5yZWR1Y2Uoc2VsZi5kZXBlbmRlbmNpZXMsIGZ1bmN0aW9uIChtZW1vLCBkZXApIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG11c3RTdWNjZWVkID0gc2VsZi5fbXVzdFN1Y2NlZWQuaW5kZXhPZihkZXApID4gLTE7XG4gICAgICAgICAgICAgICAgICAgIGlmIChtdXN0U3VjY2VlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRlcC5jYW5jZWxsZWQpIG1lbW8ucHVzaChkZXApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICAgICAgICAgIH0sIFtdKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gY2FuY2VsbGVkLmxlbmd0aCA/IGNhbmNlbGxlZCA6IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnbG9nZ2luZ092ZXJpZGRlbicsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoc2VsZi5sb2dMZXZlbCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzZWxmLmxvZ0xldmVsIDw9IGxvZy5MZXZlbC5pbmZvO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KVxuXG5cbn1cblxuT3BlcmF0aW9uLnJ1bm5pbmcgPSBbXTtcblxuT3BlcmF0aW9uLnByb3RvdHlwZS5fc3RhcnRTaW5nbGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHRoaXMud29yayhmdW5jdGlvbiAoZXJyLCBwYXlsb2FkKSB7XG4gICAgICAgIHNlbGYucmVzdWx0ID0gcGF5bG9hZDtcbiAgICAgICAgc2VsZi5lcnJvciA9IGVycjtcbiAgICAgICAgc2VsZi5jb21wbGV0ZWQgPSB0cnVlO1xuICAgICAgICBzZWxmLnJ1bm5pbmcgPSBmYWxzZTtcbiAgICAgICAgc2VsZi5fY29tcGxldGUoKTtcbiAgICB9KTtcbn07XG5cbk9wZXJhdGlvbi5wcm90b3R5cGUuX3N0YXJ0Q29tcG9zaXRlID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgb3BlcmF0aW9ucyA9IHNlbGYud29yayBpbnN0YW5jZW9mIE9wZXJhdGlvbiA/IFtzZWxmLndvcmtdIDogc2VsZi53b3JrO1xuICAgIF8uZWFjaChvcGVyYXRpb25zLCBmdW5jdGlvbiAob3ApIHtcbiAgICAgICAgb3Aub25Db21wbGV0aW9uKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBudW1PcGVyYXRpb25zUmVtYWluaW5nID0gc2VsZi5udW1PcGVyYXRpb25zUmVtYWluaW5nO1xuICAgICAgICAgICAgdmFyIG5hbWUgPSBzZWxmLm5hbWUgfHwgJ1VubmFtZWQnO1xuICAgICAgICAgICAgTG9nZ2VyLmRlYnVnKG5hbWUgKyAnIGhhcyAnICsgbnVtT3BlcmF0aW9uc1JlbWFpbmluZy50b1N0cmluZygpICsgJyBvcGVyYXRpb25zIHJlbWFpbmluZycpO1xuICAgICAgICAgICAgaWYgKCFudW1PcGVyYXRpb25zUmVtYWluaW5nKSB7XG4gICAgICAgICAgICAgICAgdmFyIGVycm9ycyA9IF8ucGx1Y2sob3BlcmF0aW9ucywgJ2Vycm9yJyk7XG4gICAgICAgICAgICAgICAgdmFyIHJlc3VsdHMgPSBfLnBsdWNrKG9wZXJhdGlvbnMsICdyZXN1bHQnKTtcbiAgICAgICAgICAgICAgICBzZWxmLnJlc3VsdCA9IF8uc29tZShyZXN1bHRzKSA/IHJlc3VsdHMgOiBudWxsO1xuICAgICAgICAgICAgICAgIHNlbGYuZXJyb3IgPSBfLnNvbWUoZXJyb3JzKSA/IGVycm9ycyA6IG51bGw7XG4gICAgICAgICAgICAgICAgc2VsZi5jb21wbGV0ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHNlbGYucnVubmluZyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHNlbGYuX2NvbXBsZXRlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBvcC5zdGFydCgpO1xuICAgIH0pO1xufTtcblxuT3BlcmF0aW9uLnByb3RvdHlwZS5fbG9nQ29tcGxldGlvbiA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgbG9nRnVuYyA9IHRoaXMuX2dldExvZ0Z1bmMoKTtcbiAgICBpZiAoTG9nZ2VyLmluZm8uaXNFbmFibGVkIHx8IHRoaXMubG9nZ2luZ092ZXJpZGRlbikge1xuICAgICAgICB2YXIgbmFtZSA9IHRoaXMubmFtZSB8fCAnVW5uYW1lZCc7XG4gICAgICAgIHZhciBmYWlsZWREZXBlbmRlbmNpZXMgPSB0aGlzLmZhaWxlZER1ZVRvRGVwZW5kZW5jeTtcbiAgICAgICAgaWYgKGZhaWxlZERlcGVuZGVuY2llcykge1xuICAgICAgICAgICAgbG9nRnVuYygnXCInICsgbmFtZSArICdcIiBmYWlsZWQgZHVlIHRvIGZhaWx1cmUvY2FuY2VsbGF0aW9uIG9mIGRlcGVuZGVuY2llczogJyArIF8ucGx1Y2soZmFpbGVkRGVwZW5kZW5jaWVzLCAnbmFtZScpLmpvaW4oJywgJykpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHRoaXMuZmFpbGVkKSB7XG4gICAgICAgICAgICB2YXIgZXJyID0gdGhpcy5lcnJvcjtcbiAgICAgICAgICAgIC8vIFJlbW92ZSBudWxsIGVycm9ycy5cbiAgICAgICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoZXJyKSA9PT0gJ1tvYmplY3QgQXJyYXldJykge1xuICAgICAgICAgICAgICAgIGVyciA9IF8uZmlsdGVyKGVyciwgZnVuY3Rpb24gKGUpIHtyZXR1cm4gZSB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGVyciA9IFt0aGlzLmVycm9yXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxvZ0Z1bmMoJ1wiJyArIG5hbWUgKyAnXCIgZmFpbGVkIGR1ZSB0byBlcnJvcnM6JywgZXJyKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh0aGlzLmNhbmNlbGxlZCkge1xuICAgICAgICAgICAgbG9nRnVuYygnXCInICsgbmFtZSArICdcIiBoYXMgYmVlbiBjYW5jZWxsZWQuJyk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBsb2dGdW5jKCdcIicgKyBuYW1lICsgJ1wiIGhhcyBzdWNjZWVkZWQuJyk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5PcGVyYXRpb24ucHJvdG90eXBlLl9nZXRMb2dGdW5jID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLmxvZ0xldmVsKSB7XG4gICAgICAgIHJldHVybiBfLmJpbmQoTG9nZ2VyLm92ZXJyaWRlLCBMb2dnZXIsIGxvZy5MZXZlbC5pbmZvLCB0aGlzLmxvZ0xldmVsKTtcbiAgICB9XG4gICAgcmV0dXJuIExvZ2dlci5pbmZvO1xufTtcblxuT3BlcmF0aW9uLnByb3RvdHlwZS5fbG9nU3RhcnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKExvZ2dlci5pbmZvLmlzRW5hYmxlZCB8fCB0aGlzLmxvZ2dpbmdPdmVyaWRkZW4pIHtcbiAgICAgICAgdmFyIG5hbWUgPSB0aGlzLm5hbWUgfHwgJ1VubmFtZWQnO1xuICAgICAgICB2YXIgbG9nRnVuYyA9IHRoaXMuX2dldExvZ0Z1bmMoKTtcbiAgICAgICAgbG9nRnVuYygnXCInICsgbmFtZSArICdcIiBoYXMgc3RhcnRlZC4nKTtcbiAgICB9XG59O1xuXG5cbk9wZXJhdGlvbi5wcm90b3R5cGUuX2NvbXBsZXRlID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB0aGlzLmNvbXBsZXRlZCA9IHRydWU7XG4gICAgdmFyIGlkeCA9IE9wZXJhdGlvbi5ydW5uaW5nLmluZGV4T2YodGhpcyk7XG4gICAgT3BlcmF0aW9uLnJ1bm5pbmcuc3BsaWNlKGlkeCwgMSk7XG4gICAgaWYgKHRoaXMuY29tcGxldGlvbikge1xuICAgICAgICBfLmJpbmQodGhpcy5jb21wbGV0aW9uLCB0aGlzKSgpO1xuICAgIH1cbiAgICB0aGlzLl9sb2dDb21wbGV0aW9uKCk7XG4gICAgXy5lYWNoKHRoaXMuX29uQ29tcGxldGlvbiwgZnVuY3Rpb24gKG8pIHtcbiAgICAgICAgXy5iaW5kKG8sIHNlbGYpKCk7XG4gICAgfSk7XG59O1xuXG5PcGVyYXRpb24ucHJvdG90eXBlLl9fc3RhcnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5fbG9nU3RhcnQoKTtcbiAgICBpZiAodGhpcy53b3JrKSB7XG4gICAgICAgIGlmICh0aGlzLmNvbXBvc2l0ZSkge1xuICAgICAgICAgICAgdGhpcy5fc3RhcnRDb21wb3NpdGUoKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3N0YXJ0U2luZ2xlKCk7XG4gICAgICAgIH1cbiAgICAgICAgT3BlcmF0aW9uLnJ1bm5pbmcucHVzaCh0aGlzKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHRoaXMucmVzdWx0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5lcnJvciA9IG51bGw7XG4gICAgICAgIHRoaXMucnVubmluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9jb21wbGV0ZSgpO1xuICAgIH1cbn07XG5cbk9wZXJhdGlvbi5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBuZXZlclN0YXJ0ZWQgPSAhdGhpcy5ydW5uaW5nICYmICF0aGlzLmNvbXBsZXRlZDtcbiAgICB2YXIgbmV2ZXJTdGFydGVkQW5kRmFpbGVkID0gbmV2ZXJTdGFydGVkICYmIHRoaXMuZmFpbGVkO1xuICAgIC8vIEEgZGVwZW5kZW5jeSBmYWlsZWQgb3Igd2FzIGNhbmNlbGxlZCBiZWZvcmUgdGhpcyBvcGVyYXRpb24gc3RhcnRlZC5cbiAgICBpZiAobmV2ZXJTdGFydGVkQW5kRmFpbGVkKSB7XG4gICAgICAgIHRoaXMuX2NvbXBsZXRlKCk7XG4gICAgfVxuICAgIGVsc2UgaWYgKG5ldmVyU3RhcnRlZCkge1xuICAgICAgICB0aGlzLnJ1bm5pbmcgPSB0cnVlO1xuICAgICAgICBpZiAodGhpcy5jYW5SdW4pIHtcbiAgICAgICAgICAgIHRoaXMuX19zdGFydCgpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgXy5lYWNoKHRoaXMuZGVwZW5kZW5jaWVzLCBmdW5jdGlvbiAoZGVwKSB7XG4gICAgICAgICAgICAgICAgZGVwLm9uQ29tcGxldGlvbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzZWxmLmNhblJ1bikge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5fX3N0YXJ0KCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5cbk9wZXJhdGlvbi5wcm90b3R5cGUuYWRkRGVwZW5kZW5jeSA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT0gMSkge1xuICAgICAgICB0aGlzLmRlcGVuZGVuY2llcy5wdXNoKGFyZ3VtZW50c1swXSk7XG4gICAgfVxuICAgIGVsc2UgaWYgKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgICAgIHZhciBsYXN0QXJnID0gYXJnc1thcmdzLmxlbmd0aCAtIDFdO1xuICAgICAgICB2YXIgbXVzdFN1Y2NlZWQgPSBmYWxzZTtcbiAgICAgICAgaWYgKHR5cGVvZihsYXN0QXJnKSA9PSAnYm9vbGVhbicpIHtcbiAgICAgICAgICAgIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmdzLCAwLCBhcmdzLmxlbmd0aCAtIDEpO1xuICAgICAgICAgICAgbXVzdFN1Y2NlZWQgPSBsYXN0QXJnO1xuICAgICAgICB9XG4gICAgICAgIF8uZWFjaChhcmdzLCBmdW5jdGlvbiAoYXJnKSB7XG4gICAgICAgICAgICBzZWxmLmRlcGVuZGVuY2llcy5wdXNoKGFyZyk7XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAobXVzdFN1Y2NlZWQpIHtcbiAgICAgICAgICAgIF8uZWFjaChhcmdzLCBmdW5jdGlvbiAoYXJnKSB7XG4gICAgICAgICAgICAgICAgc2VsZi5fbXVzdFN1Y2NlZWQucHVzaChhcmcpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbk9wZXJhdGlvbi5wcm90b3R5cGUub25Db21wbGV0aW9uID0gZnVuY3Rpb24gKG8pIHtcbiAgICBpZiAoIXRoaXMuY29tcGxldGVkKSB7XG4gICAgICAgIHRoaXMuX29uQ29tcGxldGlvbi5wdXNoKG8pO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgXy5iaW5kKG8sIHRoaXMpKCk7XG4gICAgfVxufTtcblxuT3BlcmF0aW9uLnByb3RvdHlwZS5jYW5jZWwgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICBpZiAoIXRoaXMuY2FuY2VsbGVkKSB7XG4gICAgICAgIHRoaXMuY2FuY2VsbGVkID0gdHJ1ZTtcbiAgICAgICAgTG9nZ2VyLmRlYnVnKCdDYW5jZWxsaW5nICcgKyB0aGlzLm5hbWUsIHRoaXMpO1xuICAgICAgICBpZiAodGhpcy5jb21wb3NpdGUpIHtcbiAgICAgICAgICAgIF8uZWFjaCh0aGlzLndvcmssIGZ1bmN0aW9uIChzdWJvcCkge1xuICAgICAgICAgICAgICAgIHN1Ym9wLmNhbmNlbCgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5vbkNvbXBsZXRpb24oZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy5ydW5uaW5nID0gZmFsc2U7XG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKCk7XG4gICAgICAgIH0pO1xuICAgIH1cbn07XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShPcGVyYXRpb24sICdsb2dMZXZlbCcsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIExvZ2dlci5jdXJyZW50TGV2ZWwoKTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgTG9nZ2VyLnNldExldmVsKHYpO1xuICAgIH0sXG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIGVudW1lcmFibGU6IHRydWVcbn0pO1xuXG5tb2R1bGUuZXhwb3J0cy5PcGVyYXRpb24gPSBPcGVyYXRpb247XG4iLCJcbnZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpO1xudmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZSgnT3BlcmF0aW9uUXVldWUnKTtcblxuXG5mdW5jdGlvbiBPcGVyYXRpb25RdWV1ZSgpIHtcblxuICAgIGlmICghdGhpcykge1xuICAgICAgICByZXR1cm4gbmV3IChGdW5jdGlvbi5wcm90b3R5cGUuYmluZC5hcHBseShPcGVyYXRpb25RdWV1ZSwgYXJndW1lbnRzKSk7XG4gICAgfVxuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAgIGlmICh0eXBlb2YoYXJndW1lbnRzWzBdKSA9PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgdGhpcy5tYXhDb25jdXJyZW50T3BlcmF0aW9ucyA9IGFyZ3VtZW50c1swXTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMubmFtZSA9IGFyZ3VtZW50c1swXTtcbiAgICAgICAgICAgIHRoaXMubWF4Q29uY3VycmVudE9wZXJhdGlvbnMgPSBhcmd1bWVudHNbMV07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLl9xdWV1ZWRPcGVyYXRpb25zID0gW107XG4gICAgdGhpcy5fcnVubmluZ09wZXJhdGlvbnMgPSBbXTtcbiAgICB0aGlzLl9ydW5uaW5nID0gZmFsc2U7XG4gICAgdGhpcy5fb25TdGFydCA9IFtdO1xuICAgIHRoaXMuX29uU3RvcCA9IFtdO1xuICAgIHRoaXMubG9nTGV2ZWwgPSBudWxsO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdudW1SdW5uaW5nT3BlcmF0aW9ucycsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gc2VsZi5fcnVubmluZ09wZXJhdGlvbnMubGVuZ3RoO1xuICAgICAgICB9LFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnbG9nZ2luZ092ZXJpZGRlbicsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoc2VsZi5sb2dMZXZlbCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzZWxmLmxvZ0xldmVsIDw9IGxvZy5MZXZlbC5pbmZvO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KVxufVxuXG5PcGVyYXRpb25RdWV1ZS5wcm90b3R5cGUuX25leHRPcGVyYXRpb25zID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB3aGlsZSAoKHNlbGYuX3J1bm5pbmdPcGVyYXRpb25zLmxlbmd0aCA8IHNlbGYubWF4Q29uY3VycmVudE9wZXJhdGlvbnMpICYmIHNlbGYuX3F1ZXVlZE9wZXJhdGlvbnMubGVuZ3RoKSB7XG4gICAgICAgIHZhciBvcCA9IHNlbGYuX3F1ZXVlZE9wZXJhdGlvbnNbMF07XG4gICAgICAgIHNlbGYuX3F1ZXVlZE9wZXJhdGlvbnMuc3BsaWNlKDAsIDEpO1xuICAgICAgICBzZWxmLl9ydW5PcGVyYXRpb24ob3ApO1xuICAgIH1cbn07XG5cblxuT3BlcmF0aW9uUXVldWUucHJvdG90eXBlLl9ydW5PcGVyYXRpb24gPSBmdW5jdGlvbiAob3ApIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLl9xdWV1ZWRPcGVyYXRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmICh0aGlzLl9xdWV1ZWRPcGVyYXRpb25zW2ldID09IG9wKSB7XG4gICAgICAgICAgICB0aGlzLl9xdWV1ZWRPcGVyYXRpb25zLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuICAgIHRoaXMuX3J1bm5pbmdPcGVyYXRpb25zLnB1c2gob3ApO1xuICAgIG9wLmNvbXBsZXRpb24gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBpZHggPSBzZWxmLl9ydW5uaW5nT3BlcmF0aW9ucy5pbmRleE9mKG9wKTtcbiAgICAgICAgc2VsZi5fcnVubmluZ09wZXJhdGlvbnMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgIGlmIChzZWxmLl9ydW5uaW5nKSB7XG4gICAgICAgICAgICBzZWxmLl9uZXh0T3BlcmF0aW9ucygpO1xuICAgICAgICB9XG4gICAgICAgIHNlbGYuX2xvZ1N0YXR1cygpO1xuICAgIH07XG4gICAgb3Auc3RhcnQoKTtcbiAgICB0aGlzLl9sb2dTdGF0dXMoKTtcbn07XG5cbk9wZXJhdGlvblF1ZXVlLnByb3RvdHlwZS5fbG9nU3RhdHVzID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBsb2dGdW5jID0gdGhpcy5fZ2V0TG9nRnVuYygpO1xuICAgIGlmIChMb2dnZXIuaW5mby5pc0VuYWJsZWQgfHwgdGhpcy5sb2dnaW5nT3ZlcmlkZGVuKSB7XG4gICAgICAgIHZhciBudW1SdW5uaW5nID0gdGhpcy5udW1SdW5uaW5nT3BlcmF0aW9ucztcbiAgICAgICAgdmFyIG51bVF1ZXVlZCA9IHRoaXMuX3F1ZXVlZE9wZXJhdGlvbnMubGVuZ3RoO1xuICAgICAgICB2YXIgbmFtZSA9IHRoaXMubmFtZSB8fCBcIlVubmFtZWQgUXVldWVcIjtcbiAgICAgICAgaWYgKG51bVJ1bm5pbmcgJiYgbnVtUXVldWVkKSB7XG4gICAgICAgICAgICBsb2dGdW5jKCdcIicgKyBuYW1lICsgJ1wiIG5vdyBoYXMgJyArIG51bVJ1bm5pbmcudG9TdHJpbmcoKSArICcgb3BlcmF0aW9ucyBydW5uaW5nIGFuZCAnICsgbnVtUXVldWVkLnRvU3RyaW5nKCkgKyAnIG9wZXJhdGlvbnMgcXVldWVkJyk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAobnVtUnVubmluZykge1xuICAgICAgICAgICAgbG9nRnVuYygnXCInICsgbmFtZSArICdcIiBub3cgaGFzICcgKyBudW1SdW5uaW5nLnRvU3RyaW5nKCkgKyAnIG9wZXJhdGlvbnMgcnVubmluZycpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKG51bVF1ZXVlZCkge1xuICAgICAgICAgICAgbG9nRnVuYygnXCInICsgbmFtZSArICdcIiBub3cgaGFzICcgKyBudW1RdWV1ZWQudG9TdHJpbmcoKSArICcgb3BlcmF0aW9ucyBxdWV1ZWQnKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGxvZ0Z1bmMoJ1wiJyArIG5hbWUgKyAnXCIgaGFzIG5vIG9wZXJhdGlvbnMgcnVubmluZyBvciBxdWV1ZWQnKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbk9wZXJhdGlvblF1ZXVlLnByb3RvdHlwZS5fbG9nU3RhcnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGxvZ0Z1bmMgPSB0aGlzLl9nZXRMb2dGdW5jKCk7XG4gICAgaWYgKExvZ2dlci5pbmZvLmlzRW5hYmxlZCB8fCB0aGlzLmxvZ2dpbmdPdmVyaWRkZW4pIHtcbiAgICAgICAgdmFyIG5hbWUgPSB0aGlzLm5hbWUgfHwgXCJVbm5hbWVkIFF1ZXVlXCI7XG4gICAgICAgIGxvZ0Z1bmMoJ1wiJyArIG5hbWUgKyAnXCIgaXMgbm93IHJ1bm5pbmcnKTtcbiAgICB9XG59O1xuXG5PcGVyYXRpb25RdWV1ZS5wcm90b3R5cGUuX2dldExvZ0Z1bmMgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMubG9nTGV2ZWwpIHtcbiAgICAgICAgcmV0dXJuIF8uYmluZChMb2dnZXIub3ZlcnJpZGUsIExvZ2dlciwgbG9nLkxldmVsLmluZm8sIHRoaXMubG9nTGV2ZWwpO1xuICAgIH1cbiAgICByZXR1cm4gTG9nZ2VyLmluZm87XG59O1xuXG5cbk9wZXJhdGlvblF1ZXVlLnByb3RvdHlwZS5fbG9nU3RvcCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgbG9nRnVuYyA9IHRoaXMuX2dldExvZ0Z1bmMoKTtcbiAgICBpZiAoTG9nZ2VyLmluZm8uaXNFbmFibGVkIHx8IHRoaXMubG9nZ2luZ092ZXJpZGRlbikge1xuICAgICAgICB2YXIgbmFtZSA9IHRoaXMubmFtZSB8fCBcIlVubmFtZWQgUXVldWVcIjtcbiAgICAgICAgbG9nRnVuYygnXCInICsgbmFtZSArICdcIiBpcyBubyBsb25nZXIgcnVubmluZycpO1xuICAgIH1cbn07XG5cbk9wZXJhdGlvblF1ZXVlLnByb3RvdHlwZS5fYWRkT3BlcmF0aW9uID0gZnVuY3Rpb24gKG9wKSB7XG4gICAgaWYgKHRoaXMubnVtUnVubmluZ09wZXJhdGlvbnMgPCB0aGlzLm1heENvbmN1cnJlbnRPcGVyYXRpb25zICYmIHRoaXMuX3J1bm5pbmcpIHtcbiAgICAgICAgdGhpcy5fcnVuT3BlcmF0aW9uKG9wKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHRoaXMuX3F1ZXVlZE9wZXJhdGlvbnMucHVzaChvcCk7XG4gICAgfVxuICAgIHRoaXMuX2xvZ1N0YXR1cygpO1xufTtcblxuT3BlcmF0aW9uUXVldWUucHJvdG90eXBlLmFkZE9wZXJhdGlvbiA9IGZ1bmN0aW9uIChvcGVyYXRpb25Pck9wZXJhdGlvbnMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvcGVyYXRpb25Pck9wZXJhdGlvbnMpID09PSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICAgIF8uZWFjaChvcGVyYXRpb25Pck9wZXJhdGlvbnMsIGZ1bmN0aW9uIChvcCkge3NlbGYuX2FkZE9wZXJhdGlvbihvcCl9KTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHRoaXMuX2FkZE9wZXJhdGlvbihvcGVyYXRpb25Pck9wZXJhdGlvbnMpO1xuICAgIH1cbn07XG5cbk9wZXJhdGlvblF1ZXVlLnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHdhc1J1bm5pbmcgPSB0aGlzLl9ydW5uaW5nO1xuICAgIHRoaXMuX3J1bm5pbmcgPSB0cnVlO1xuICAgIGlmICghd2FzUnVubmluZykge1xuICAgICAgICBfLmVhY2goc2VsZi5fb25TdGFydCwgZnVuY3Rpb24gKGMpIHtcbiAgICAgICAgICAgIF8uYmluZChjLCBzZWxmKSgpO1xuICAgICAgICB9KTtcbiAgICAgICAgc2VsZi5fbmV4dE9wZXJhdGlvbnMoKTtcbiAgICAgICAgc2VsZi5fbG9nU3RhcnQoKTtcbiAgICB9XG59O1xuXG5PcGVyYXRpb25RdWV1ZS5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uIChjYW5jZWwpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHdhc1J1bm5pbmcgPSB0aGlzLl9ydW5uaW5nO1xuICAgIHRoaXMuX3J1bm5pbmcgPSBmYWxzZTtcbiAgICBpZiAod2FzUnVubmluZykge1xuICAgICAgICBpZiAoY2FuY2VsKSB7XG4gICAgICAgICAgICB2YXIgb3BlcmF0aW9ucyA9IHRoaXMuX3J1bm5pbmdPcGVyYXRpb25zLnNsaWNlKDApOyAvLyBDbG9uZSBzbyBub3QgZmlnaHRpbmcgY2FsbGJhY2tzLlxuICAgICAgICAgICAgXy5lYWNoKG9wZXJhdGlvbnMsIGZ1bmN0aW9uIChvKSB7XG4gICAgICAgICAgICAgICAgby5jYW5jZWwoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHNlbGYuX2xvZ1N0b3AoKTtcbiAgICAgICAgXy5lYWNoKHNlbGYuX29uU3RvcCwgZnVuY3Rpb24gKGMpIHtcbiAgICAgICAgICAgIF8uYmluZChjLCBzZWxmKSgpO1xuICAgICAgICB9KTtcbiAgICB9XG59O1xuXG5PcGVyYXRpb25RdWV1ZS5wcm90b3R5cGUub25TdGFydCA9IGZ1bmN0aW9uIChvKSB7XG4gICAgdGhpcy5fb25TdGFydC5wdXNoKG8pO1xufTtcbk9wZXJhdGlvblF1ZXVlLnByb3RvdHlwZS5vblN0b3AgPSBmdW5jdGlvbiAobykge1xuICAgIHRoaXMuX29uU3RvcC5wdXNoKG8pO1xufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KE9wZXJhdGlvblF1ZXVlLCAnbG9nTGV2ZWwnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBMb2dnZXIuY3VycmVudExldmVsKCk7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uICh2KSB7XG4gICAgICAgIExvZ2dlci5zZXRMZXZlbCh2KTtcbiAgICB9LFxuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICBlbnVtZXJhYmxlOiB0cnVlXG59KTtcblxuXG5tb2R1bGUuZXhwb3J0cy5PcGVyYXRpb25RdWV1ZSA9IE9wZXJhdGlvblF1ZXVlO1xuIl19
