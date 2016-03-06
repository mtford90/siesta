/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;
/******/
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	__webpack_require__(1);
	module.exports = __webpack_require__(3);


/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global, process) {/**
	 * Copyright (c) 2014, Facebook, Inc.
	 * All rights reserved.
	 *
	 * This source code is licensed under the BSD-style license found in the
	 * https://raw.github.com/facebook/regenerator/master/LICENSE file. An
	 * additional grant of patent rights can be found in the PATENTS file in
	 * the same directory.
	 */
	
	!(function(global) {
	  "use strict";
	
	  var hasOwn = Object.prototype.hasOwnProperty;
	  var undefined; // More compressible than void 0.
	  var iteratorSymbol =
	    typeof Symbol === "function" && Symbol.iterator || "@@iterator";
	
	  var inModule = typeof module === "object";
	  var runtime = global.regeneratorRuntime;
	  if (runtime) {
	    if (inModule) {
	      // If regeneratorRuntime is defined globally and we're in a module,
	      // make the exports object identical to regeneratorRuntime.
	      module.exports = runtime;
	    }
	    // Don't bother evaluating the rest of this file if the runtime was
	    // already defined globally.
	    return;
	  }
	
	  // Define the runtime globally (as expected by generated code) as either
	  // module.exports (if we're in a module) or a new, empty object.
	  runtime = global.regeneratorRuntime = inModule ? module.exports : {};
	
	  function wrap(innerFn, outerFn, self, tryLocsList) {
	    // If outerFn provided, then outerFn.prototype instanceof Generator.
	    var generator = Object.create((outerFn || Generator).prototype);
	    var context = new Context(tryLocsList || []);
	
	    // The ._invoke method unifies the implementations of the .next,
	    // .throw, and .return methods.
	    generator._invoke = makeInvokeMethod(innerFn, self, context);
	
	    return generator;
	  }
	  runtime.wrap = wrap;
	
	  // Try/catch helper to minimize deoptimizations. Returns a completion
	  // record like context.tryEntries[i].completion. This interface could
	  // have been (and was previously) designed to take a closure to be
	  // invoked without arguments, but in all the cases we care about we
	  // already have an existing method we want to call, so there's no need
	  // to create a new function object. We can even get away with assuming
	  // the method takes exactly one argument, since that happens to be true
	  // in every case, so we don't have to touch the arguments object. The
	  // only additional allocation required is the completion record, which
	  // has a stable shape and so hopefully should be cheap to allocate.
	  function tryCatch(fn, obj, arg) {
	    try {
	      return { type: "normal", arg: fn.call(obj, arg) };
	    } catch (err) {
	      return { type: "throw", arg: err };
	    }
	  }
	
	  var GenStateSuspendedStart = "suspendedStart";
	  var GenStateSuspendedYield = "suspendedYield";
	  var GenStateExecuting = "executing";
	  var GenStateCompleted = "completed";
	
	  // Returning this object from the innerFn has the same effect as
	  // breaking out of the dispatch switch statement.
	  var ContinueSentinel = {};
	
	  // Dummy constructor functions that we use as the .constructor and
	  // .constructor.prototype properties for functions that return Generator
	  // objects. For full spec compliance, you may wish to configure your
	  // minifier not to mangle the names of these two functions.
	  function Generator() {}
	  function GeneratorFunction() {}
	  function GeneratorFunctionPrototype() {}
	
	  var Gp = GeneratorFunctionPrototype.prototype = Generator.prototype;
	  GeneratorFunction.prototype = Gp.constructor = GeneratorFunctionPrototype;
	  GeneratorFunctionPrototype.constructor = GeneratorFunction;
	  GeneratorFunction.displayName = "GeneratorFunction";
	
	  // Helper for defining the .next, .throw, and .return methods of the
	  // Iterator interface in terms of a single ._invoke method.
	  function defineIteratorMethods(prototype) {
	    ["next", "throw", "return"].forEach(function(method) {
	      prototype[method] = function(arg) {
	        return this._invoke(method, arg);
	      };
	    });
	  }
	
	  runtime.isGeneratorFunction = function(genFun) {
	    var ctor = typeof genFun === "function" && genFun.constructor;
	    return ctor
	      ? ctor === GeneratorFunction ||
	        // For the native GeneratorFunction constructor, the best we can
	        // do is to check its .name property.
	        (ctor.displayName || ctor.name) === "GeneratorFunction"
	      : false;
	  };
	
	  runtime.mark = function(genFun) {
	    if (Object.setPrototypeOf) {
	      Object.setPrototypeOf(genFun, GeneratorFunctionPrototype);
	    } else {
	      genFun.__proto__ = GeneratorFunctionPrototype;
	    }
	    genFun.prototype = Object.create(Gp);
	    return genFun;
	  };
	
	  // Within the body of any async function, `await x` is transformed to
	  // `yield regeneratorRuntime.awrap(x)`, so that the runtime can test
	  // `value instanceof AwaitArgument` to determine if the yielded value is
	  // meant to be awaited. Some may consider the name of this method too
	  // cutesy, but they are curmudgeons.
	  runtime.awrap = function(arg) {
	    return new AwaitArgument(arg);
	  };
	
	  function AwaitArgument(arg) {
	    this.arg = arg;
	  }
	
	  function AsyncIterator(generator) {
	    // This invoke function is written in a style that assumes some
	    // calling function (or Promise) will handle exceptions.
	    function invoke(method, arg) {
	      var result = generator[method](arg);
	      var value = result.value;
	      return value instanceof AwaitArgument
	        ? Promise.resolve(value.arg).then(invokeNext, invokeThrow)
	        : Promise.resolve(value).then(function(unwrapped) {
	            // When a yielded Promise is resolved, its final value becomes
	            // the .value of the Promise<{value,done}> result for the
	            // current iteration. If the Promise is rejected, however, the
	            // result for this iteration will be rejected with the same
	            // reason. Note that rejections of yielded Promises are not
	            // thrown back into the generator function, as is the case
	            // when an awaited Promise is rejected. This difference in
	            // behavior between yield and await is important, because it
	            // allows the consumer to decide what to do with the yielded
	            // rejection (swallow it and continue, manually .throw it back
	            // into the generator, abandon iteration, whatever). With
	            // await, by contrast, there is no opportunity to examine the
	            // rejection reason outside the generator function, so the
	            // only option is to throw it from the await expression, and
	            // let the generator function handle the exception.
	            result.value = unwrapped;
	            return result;
	          });
	    }
	
	    if (typeof process === "object" && process.domain) {
	      invoke = process.domain.bind(invoke);
	    }
	
	    var invokeNext = invoke.bind(generator, "next");
	    var invokeThrow = invoke.bind(generator, "throw");
	    var invokeReturn = invoke.bind(generator, "return");
	    var previousPromise;
	
	    function enqueue(method, arg) {
	      function callInvokeWithMethodAndArg() {
	        return invoke(method, arg);
	      }
	
	      return previousPromise =
	        // If enqueue has been called before, then we want to wait until
	        // all previous Promises have been resolved before calling invoke,
	        // so that results are always delivered in the correct order. If
	        // enqueue has not been called before, then it is important to
	        // call invoke immediately, without waiting on a callback to fire,
	        // so that the async generator function has the opportunity to do
	        // any necessary setup in a predictable way. This predictability
	        // is why the Promise constructor synchronously invokes its
	        // executor callback, and why async functions synchronously
	        // execute code before the first await. Since we implement simple
	        // async functions in terms of async generators, it is especially
	        // important to get this right, even though it requires care.
	        previousPromise ? previousPromise.then(
	          callInvokeWithMethodAndArg,
	          // Avoid propagating failures to Promises returned by later
	          // invocations of the iterator.
	          callInvokeWithMethodAndArg
	        ) : new Promise(function (resolve) {
	          resolve(callInvokeWithMethodAndArg());
	        });
	    }
	
	    // Define the unified helper method that is used to implement .next,
	    // .throw, and .return (see defineIteratorMethods).
	    this._invoke = enqueue;
	  }
	
	  defineIteratorMethods(AsyncIterator.prototype);
	
	  // Note that simple async functions are implemented on top of
	  // AsyncIterator objects; they just return a Promise for the value of
	  // the final result produced by the iterator.
	  runtime.async = function(innerFn, outerFn, self, tryLocsList) {
	    var iter = new AsyncIterator(
	      wrap(innerFn, outerFn, self, tryLocsList)
	    );
	
	    return runtime.isGeneratorFunction(outerFn)
	      ? iter // If outerFn is a generator, return the full iterator.
	      : iter.next().then(function(result) {
	          return result.done ? result.value : iter.next();
	        });
	  };
	
	  function makeInvokeMethod(innerFn, self, context) {
	    var state = GenStateSuspendedStart;
	
	    return function invoke(method, arg) {
	      if (state === GenStateExecuting) {
	        throw new Error("Generator is already running");
	      }
	
	      if (state === GenStateCompleted) {
	        if (method === "throw") {
	          throw arg;
	        }
	
	        // Be forgiving, per 25.3.3.3.3 of the spec:
	        // https://people.mozilla.org/~jorendorff/es6-draft.html#sec-generatorresume
	        return doneResult();
	      }
	
	      while (true) {
	        var delegate = context.delegate;
	        if (delegate) {
	          if (method === "return" ||
	              (method === "throw" && delegate.iterator[method] === undefined)) {
	            // A return or throw (when the delegate iterator has no throw
	            // method) always terminates the yield* loop.
	            context.delegate = null;
	
	            // If the delegate iterator has a return method, give it a
	            // chance to clean up.
	            var returnMethod = delegate.iterator["return"];
	            if (returnMethod) {
	              var record = tryCatch(returnMethod, delegate.iterator, arg);
	              if (record.type === "throw") {
	                // If the return method threw an exception, let that
	                // exception prevail over the original return or throw.
	                method = "throw";
	                arg = record.arg;
	                continue;
	              }
	            }
	
	            if (method === "return") {
	              // Continue with the outer return, now that the delegate
	              // iterator has been terminated.
	              continue;
	            }
	          }
	
	          var record = tryCatch(
	            delegate.iterator[method],
	            delegate.iterator,
	            arg
	          );
	
	          if (record.type === "throw") {
	            context.delegate = null;
	
	            // Like returning generator.throw(uncaught), but without the
	            // overhead of an extra function call.
	            method = "throw";
	            arg = record.arg;
	            continue;
	          }
	
	          // Delegate generator ran and handled its own exceptions so
	          // regardless of what the method was, we continue as if it is
	          // "next" with an undefined arg.
	          method = "next";
	          arg = undefined;
	
	          var info = record.arg;
	          if (info.done) {
	            context[delegate.resultName] = info.value;
	            context.next = delegate.nextLoc;
	          } else {
	            state = GenStateSuspendedYield;
	            return info;
	          }
	
	          context.delegate = null;
	        }
	
	        if (method === "next") {
	          context._sent = arg;
	
	          if (state === GenStateSuspendedYield) {
	            context.sent = arg;
	          } else {
	            context.sent = undefined;
	          }
	        } else if (method === "throw") {
	          if (state === GenStateSuspendedStart) {
	            state = GenStateCompleted;
	            throw arg;
	          }
	
	          if (context.dispatchException(arg)) {
	            // If the dispatched exception was caught by a catch block,
	            // then let that catch block handle the exception normally.
	            method = "next";
	            arg = undefined;
	          }
	
	        } else if (method === "return") {
	          context.abrupt("return", arg);
	        }
	
	        state = GenStateExecuting;
	
	        var record = tryCatch(innerFn, self, context);
	        if (record.type === "normal") {
	          // If an exception is thrown from innerFn, we leave state ===
	          // GenStateExecuting and loop back for another invocation.
	          state = context.done
	            ? GenStateCompleted
	            : GenStateSuspendedYield;
	
	          var info = {
	            value: record.arg,
	            done: context.done
	          };
	
	          if (record.arg === ContinueSentinel) {
	            if (context.delegate && method === "next") {
	              // Deliberately forget the last sent value so that we don't
	              // accidentally pass it on to the delegate.
	              arg = undefined;
	            }
	          } else {
	            return info;
	          }
	
	        } else if (record.type === "throw") {
	          state = GenStateCompleted;
	          // Dispatch the exception by looping back around to the
	          // context.dispatchException(arg) call above.
	          method = "throw";
	          arg = record.arg;
	        }
	      }
	    };
	  }
	
	  // Define Generator.prototype.{next,throw,return} in terms of the
	  // unified ._invoke helper method.
	  defineIteratorMethods(Gp);
	
	  Gp[iteratorSymbol] = function() {
	    return this;
	  };
	
	  Gp.toString = function() {
	    return "[object Generator]";
	  };
	
	  function pushTryEntry(locs) {
	    var entry = { tryLoc: locs[0] };
	
	    if (1 in locs) {
	      entry.catchLoc = locs[1];
	    }
	
	    if (2 in locs) {
	      entry.finallyLoc = locs[2];
	      entry.afterLoc = locs[3];
	    }
	
	    this.tryEntries.push(entry);
	  }
	
	  function resetTryEntry(entry) {
	    var record = entry.completion || {};
	    record.type = "normal";
	    delete record.arg;
	    entry.completion = record;
	  }
	
	  function Context(tryLocsList) {
	    // The root entry object (effectively a try statement without a catch
	    // or a finally block) gives us a place to store values thrown from
	    // locations where there is no enclosing try statement.
	    this.tryEntries = [{ tryLoc: "root" }];
	    tryLocsList.forEach(pushTryEntry, this);
	    this.reset(true);
	  }
	
	  runtime.keys = function(object) {
	    var keys = [];
	    for (var key in object) {
	      keys.push(key);
	    }
	    keys.reverse();
	
	    // Rather than returning an object with a next method, we keep
	    // things simple and return the next function itself.
	    return function next() {
	      while (keys.length) {
	        var key = keys.pop();
	        if (key in object) {
	          next.value = key;
	          next.done = false;
	          return next;
	        }
	      }
	
	      // To avoid creating an additional object, we just hang the .value
	      // and .done properties off the next function object itself. This
	      // also ensures that the minifier will not anonymize the function.
	      next.done = true;
	      return next;
	    };
	  };
	
	  function values(iterable) {
	    if (iterable) {
	      var iteratorMethod = iterable[iteratorSymbol];
	      if (iteratorMethod) {
	        return iteratorMethod.call(iterable);
	      }
	
	      if (typeof iterable.next === "function") {
	        return iterable;
	      }
	
	      if (!isNaN(iterable.length)) {
	        var i = -1, next = function next() {
	          while (++i < iterable.length) {
	            if (hasOwn.call(iterable, i)) {
	              next.value = iterable[i];
	              next.done = false;
	              return next;
	            }
	          }
	
	          next.value = undefined;
	          next.done = true;
	
	          return next;
	        };
	
	        return next.next = next;
	      }
	    }
	
	    // Return an iterator with no values.
	    return { next: doneResult };
	  }
	  runtime.values = values;
	
	  function doneResult() {
	    return { value: undefined, done: true };
	  }
	
	  Context.prototype = {
	    constructor: Context,
	
	    reset: function(skipTempReset) {
	      this.prev = 0;
	      this.next = 0;
	      this.sent = undefined;
	      this.done = false;
	      this.delegate = null;
	
	      this.tryEntries.forEach(resetTryEntry);
	
	      if (!skipTempReset) {
	        for (var name in this) {
	          // Not sure about the optimal order of these conditions:
	          if (name.charAt(0) === "t" &&
	              hasOwn.call(this, name) &&
	              !isNaN(+name.slice(1))) {
	            this[name] = undefined;
	          }
	        }
	      }
	    },
	
	    stop: function() {
	      this.done = true;
	
	      var rootEntry = this.tryEntries[0];
	      var rootRecord = rootEntry.completion;
	      if (rootRecord.type === "throw") {
	        throw rootRecord.arg;
	      }
	
	      return this.rval;
	    },
	
	    dispatchException: function(exception) {
	      if (this.done) {
	        throw exception;
	      }
	
	      var context = this;
	      function handle(loc, caught) {
	        record.type = "throw";
	        record.arg = exception;
	        context.next = loc;
	        return !!caught;
	      }
	
	      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
	        var entry = this.tryEntries[i];
	        var record = entry.completion;
	
	        if (entry.tryLoc === "root") {
	          // Exception thrown outside of any try block that could handle
	          // it, so set the completion value of the entire function to
	          // throw the exception.
	          return handle("end");
	        }
	
	        if (entry.tryLoc <= this.prev) {
	          var hasCatch = hasOwn.call(entry, "catchLoc");
	          var hasFinally = hasOwn.call(entry, "finallyLoc");
	
	          if (hasCatch && hasFinally) {
	            if (this.prev < entry.catchLoc) {
	              return handle(entry.catchLoc, true);
	            } else if (this.prev < entry.finallyLoc) {
	              return handle(entry.finallyLoc);
	            }
	
	          } else if (hasCatch) {
	            if (this.prev < entry.catchLoc) {
	              return handle(entry.catchLoc, true);
	            }
	
	          } else if (hasFinally) {
	            if (this.prev < entry.finallyLoc) {
	              return handle(entry.finallyLoc);
	            }
	
	          } else {
	            throw new Error("try statement without catch or finally");
	          }
	        }
	      }
	    },
	
	    abrupt: function(type, arg) {
	      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
	        var entry = this.tryEntries[i];
	        if (entry.tryLoc <= this.prev &&
	            hasOwn.call(entry, "finallyLoc") &&
	            this.prev < entry.finallyLoc) {
	          var finallyEntry = entry;
	          break;
	        }
	      }
	
	      if (finallyEntry &&
	          (type === "break" ||
	           type === "continue") &&
	          finallyEntry.tryLoc <= arg &&
	          arg <= finallyEntry.finallyLoc) {
	        // Ignore the finally entry if control is not jumping to a
	        // location outside the try/catch block.
	        finallyEntry = null;
	      }
	
	      var record = finallyEntry ? finallyEntry.completion : {};
	      record.type = type;
	      record.arg = arg;
	
	      if (finallyEntry) {
	        this.next = finallyEntry.finallyLoc;
	      } else {
	        this.complete(record);
	      }
	
	      return ContinueSentinel;
	    },
	
	    complete: function(record, afterLoc) {
	      if (record.type === "throw") {
	        throw record.arg;
	      }
	
	      if (record.type === "break" ||
	          record.type === "continue") {
	        this.next = record.arg;
	      } else if (record.type === "return") {
	        this.rval = record.arg;
	        this.next = "end";
	      } else if (record.type === "normal" && afterLoc) {
	        this.next = afterLoc;
	      }
	    },
	
	    finish: function(finallyLoc) {
	      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
	        var entry = this.tryEntries[i];
	        if (entry.finallyLoc === finallyLoc) {
	          this.complete(entry.completion, entry.afterLoc);
	          resetTryEntry(entry);
	          return ContinueSentinel;
	        }
	      }
	    },
	
	    "catch": function(tryLoc) {
	      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
	        var entry = this.tryEntries[i];
	        if (entry.tryLoc === tryLoc) {
	          var record = entry.completion;
	          if (record.type === "throw") {
	            var thrown = record.arg;
	            resetTryEntry(entry);
	          }
	          return thrown;
	        }
	      }
	
	      // The context.catch method must only be called with a location
	      // argument that corresponds to a known catch block.
	      throw new Error("illegal catch attempt");
	    },
	
	    delegateYield: function(iterable, resultName, nextLoc) {
	      this.delegate = {
	        iterator: values(iterable),
	        resultName: resultName,
	        nextLoc: nextLoc
	      };
	
	      return ContinueSentinel;
	    }
	  };
	})(
	  // Among the various tricks for obtaining a reference to the global
	  // object, this seems to be the most reliable technique that does not
	  // use indirect eval (which violates Content Security Policy).
	  typeof global === "object" ? global :
	  typeof window === "object" ? window :
	  typeof self === "object" ? self : this
	);
	
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }()), __webpack_require__(2)))

/***/ },
/* 2 */
/***/ function(module, exports) {

	// shim for using process in browser
	
	var process = module.exports = {};
	var queue = [];
	var draining = false;
	var currentQueue;
	var queueIndex = -1;
	
	function cleanUpNextTick() {
	    draining = false;
	    if (currentQueue.length) {
	        queue = currentQueue.concat(queue);
	    } else {
	        queueIndex = -1;
	    }
	    if (queue.length) {
	        drainQueue();
	    }
	}
	
	function drainQueue() {
	    if (draining) {
	        return;
	    }
	    var timeout = setTimeout(cleanUpNextTick);
	    draining = true;
	
	    var len = queue.length;
	    while(len) {
	        currentQueue = queue;
	        queue = [];
	        while (++queueIndex < len) {
	            if (currentQueue) {
	                currentQueue[queueIndex].run();
	            }
	        }
	        queueIndex = -1;
	        len = queue.length;
	    }
	    currentQueue = null;
	    draining = false;
	    clearTimeout(timeout);
	}
	
	process.nextTick = function (fun) {
	    var args = new Array(arguments.length - 1);
	    if (arguments.length > 1) {
	        for (var i = 1; i < arguments.length; i++) {
	            args[i - 1] = arguments[i];
	        }
	    }
	    queue.push(new Item(fun, args));
	    if (queue.length === 1 && !draining) {
	        setTimeout(drainQueue, 0);
	    }
	};
	
	// v8 likes predictible objects
	function Item(fun, array) {
	    this.fun = fun;
	    this.array = array;
	}
	Item.prototype.run = function () {
	    this.fun.apply(null, this.array);
	};
	process.title = 'browser';
	process.browser = true;
	process.env = {};
	process.argv = [];
	process.version = ''; // empty string to avoid regexp issues
	process.versions = {};
	
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
	};
	
	process.cwd = function () { return '/' };
	process.chdir = function (dir) {
	    throw new Error('process.chdir is not supported');
	};
	process.umask = function() { return 0; };


/***/ },
/* 3 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	var util = __webpack_require__(4),
	    CollectionRegistry = __webpack_require__(9).CollectionRegistry,
	    Collection = __webpack_require__(10),
	    cache = __webpack_require__(20),
	    Model = __webpack_require__(15),
	    error = __webpack_require__(8),
	    events = __webpack_require__(23),
	    RelationshipType = __webpack_require__(18),
	    ReactiveQuery = __webpack_require__(31),
	    ManyToManyProxy = __webpack_require__(36),
	    OneToOneProxy = __webpack_require__(35),
	    OneToManyProxy = __webpack_require__(33),
	    RelationshipProxy = __webpack_require__(34),
	    modelEvents = __webpack_require__(22),
	    Query = __webpack_require__(19),
	    querySet = __webpack_require__(26),
	    log = __webpack_require__(11);
	
	util._patchBind();
	
	// Initialise siesta object. Strange format facilities using submodules with requireJS (eventually)
	var siesta = function siesta(ext) {
	  if (!siesta.ext) siesta.ext = {};
	  util.extend(siesta.ext, ext || {});
	  return siesta;
	};
	
	// Notifications
	util.extend(siesta, {
	  on: events.on.bind(events),
	  off: events.removeListener.bind(events),
	  once: events.once.bind(events),
	  removeAllListeners: events.removeAllListeners.bind(events)
	});
	util.extend(siesta, {
	  removeListener: siesta.off,
	  addListener: siesta.on
	});
	
	// Expose some stuff for usage by extensions and/or users
	util.extend(siesta, {
	  RelationshipType: RelationshipType,
	  ModelEventType: modelEvents.ModelEventType,
	  log: log.Level,
	  InsertionPolicy: ReactiveQuery.InsertionPolicy,
	  _internal: {
	    log: log,
	    Model: Model,
	    error: error,
	    ModelEventType: modelEvents.ModelEventType,
	    ModelInstance: __webpack_require__(21),
	    extend: __webpack_require__(28),
	    MappingOperation: __webpack_require__(27),
	    events: events,
	    ProxyEventEmitter: events.ProxyEventEmitter,
	    cache: __webpack_require__(20),
	    modelEvents: modelEvents,
	    CollectionRegistry: __webpack_require__(9).CollectionRegistry,
	    Collection: Collection,
	    utils: util,
	    util: util,
	    querySet: querySet,
	    observe: __webpack_require__(5),
	    Query: Query,
	    ManyToManyProxy: ManyToManyProxy,
	    OneToManyProxy: OneToManyProxy,
	    OneToOneProxy: OneToOneProxy,
	    RelationshipProxy: RelationshipProxy
	  },
	  isArray: util.isArray,
	  isString: util.isString
	});
	
	siesta.ext = {};
	
	var installed = false,
	    installing = false;
	
	util.extend(siesta, {
	  /**
	   * Wipe everything. Used during test generally.
	   */
	  reset: function reset(cb) {
	    installed = false;
	    installing = false;
	    delete this.queuedTasks;
	    cache.reset();
	    CollectionRegistry.reset();
	    events.removeAllListeners();
	    cb();
	  },
	  /**
	   * Creates and registers a new Collection.
	   * @param  {String} name
	   * @param  {Object} [opts]
	   * @return {Collection}
	   */
	  collection: function collection(name, opts) {
	    var c = new Collection(name, opts);
	    if (installed) c.installed = true; // TODO: Remove
	    return c;
	  },
	  /**
	   * Install all collections.
	   * @param {Function} [cb]
	   * @returns {q.Promise}
	   */
	  install: function install(cb) {
	    if (!installing && !installed) {
	      return util.promise(cb, function (cb) {
	        installing = true;
	        var collectionNames = CollectionRegistry.collectionNames,
	            tasks = collectionNames.map(function (n) {
	          var collection = CollectionRegistry[n];
	          return collection.install.bind(collection);
	        });
	        tasks.push(function (done) {
	          installed = true;
	          if (this.queuedTasks) this.queuedTasks.execute();
	          done();
	        }.bind(this));
	        util.series(tasks, cb);
	      }.bind(this));
	    } else cb(error('already installing'));
	  },
	  _pushTask: function _pushTask(task) {
	    if (!this.queuedTasks) {
	      this.queuedTasks = new function Queue() {
	        this.tasks = [];
	        this.execute = function () {
	          this.tasks.forEach(function (f) {
	            f();
	          });
	          this.tasks = [];
	        }.bind(this);
	      }();
	    }
	    this.queuedTasks.tasks.push(task);
	  },
	  _afterInstall: function _afterInstall(task) {
	    if (!installed) {
	      if (!installing) {
	        this.install(function (err) {
	          if (err) {
	            console.error('Error setting up siesta', err);
	          }
	          delete this.queuedTasks;
	        }.bind(this));
	      }
	      if (!installed) this._pushTask(task);else task();
	    } else {
	      task();
	    }
	  },
	  setLogLevel: function setLogLevel(loggerName, level) {
	    var Logger = log.loggerWithName(loggerName);
	    Logger.setLevel(level);
	  },
	  graph: function graph(data, opts, cb) {
	    if (typeof opts == 'function') cb = opts;
	    opts = opts || {};
	    return util.promise(cb, function (cb) {
	      var tasks = [],
	          err;
	      for (var collectionName in data) {
	        if (data.hasOwnProperty(collectionName)) {
	          var collection = CollectionRegistry[collectionName];
	          if (collection) {
	            (function (collection, data) {
	              tasks.push(function (done) {
	                collection.graph(data, function (err, res) {
	                  if (!err) {
	                    var results = {};
	                    results[collection.name] = res;
	                  }
	                  done(err, results);
	                });
	              });
	            })(collection, data[collectionName]);
	          } else {
	            err = 'No such collection "' + collectionName + '"';
	          }
	        }
	      }
	      if (!err) {
	        util.series(tasks, function (err, results) {
	          if (!err) {
	            results = results.reduce(function (memo, res) {
	              return util.extend(memo, res);
	            }, {});
	          } else results = null;
	          cb(err, results);
	        });
	      } else cb(error(err, { data: data, invalidCollectionName: collectionName }));
	    }.bind(this));
	  },
	  notify: util.next,
	  registerComparator: Query.registerComparator.bind(Query),
	  count: function count() {
	    return cache.count();
	  },
	  get: function get(id, cb) {
	    return util.promise(cb, function (cb) {
	      this._afterInstall(function () {
	        cb(null, cache._localCache()[id]);
	      });
	    }.bind(this));
	  },
	  removeAll: function removeAll(cb) {
	    return util.promise(cb, function (cb) {
	      util.Promise.all(CollectionRegistry.collectionNames.map(function (collectionName) {
	        return CollectionRegistry[collectionName].removeAll();
	      }.bind(this))).then(function () {
	        cb(null);
	      }).catch(cb);
	    }.bind(this));
	  }
	});
	
	Object.defineProperties(siesta, {
	  _canChange: {
	    get: function get() {
	      return !(installing || installed);
	    }
	  },
	  installed: {
	    get: function get() {
	      return installed;
	    }
	  }
	});
	
	if (typeof window != 'undefined') {
	  window['siesta'] = siesta;
	}
	
	siesta.log = __webpack_require__(12);
	
	module.exports = siesta;
	
	(function loadExtensions() {})();

/***/ },
/* 4 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	var observe = __webpack_require__(5).Platform,
	    argsarray = __webpack_require__(7),
	    InternalSiestaError = __webpack_require__(8).InternalSiestaError;
	
	var extend = function extend(left, right) {
	  for (var prop in right) {
	    if (right.hasOwnProperty(prop)) {
	      left[prop] = right[prop];
	    }
	  }
	  return left;
	};
	
	var isArray = Array.isArray,
	    isString = function isString(o) {
	  return typeof o == 'string' || o instanceof String;
	};
	
	extend(module.exports, {
	  argsarray: argsarray,
	  /**
	   * Performs dirty check/Object.observe callbacks depending on the browser.
	   *
	   * If Object.observe is present,
	   * @param callback
	   */
	  next: function next(callback) {
	    observe.performMicrotaskCheckpoint();
	    setTimeout(callback);
	  },
	  extend: extend,
	  guid: function () {
	    function s4() {
	      return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
	    }
	
	    return function () {
	      return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
	    };
	  }(),
	  assert: function assert(condition, message, context) {
	    if (!condition) {
	      message = message || "Assertion failed";
	      context = context || {};
	      throw new InternalSiestaError(message, context);
	    }
	  },
	  pluck: function pluck(coll, key) {
	    return coll.map(function (o) {
	      return o[key];
	    });
	  },
	  thenBy: function () {
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
	  }(),
	  /**
	   * TODO: This is bloody ugly.
	   * Pretty damn useful to be able to access the bound object on a function tho.
	   * See: http://stackoverflow.com/questions/14307264/what-object-javascript-function-is-bound-to-what-is-its-this
	   */
	  _patchBind: function _patchBind() {
	    var _bind = Function.prototype.apply.bind(Function.prototype.bind);
	    Object.defineProperty(Function.prototype, 'bind', {
	      value: function value(obj) {
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
	  promise: function promise(cb, fn) {
	    cb = cb || function () {};
	    return new Promise(function (resolve, reject) {
	      var _cb = argsarray(function (args) {
	        var err = args[0],
	            rest = args.slice(1);
	        if (err) {
	          try {
	            reject(err);
	          } catch (e) {
	            console.error('Uncaught error during promise rejection', e);
	          }
	        } else {
	          try {
	            resolve(rest[0]);
	          } catch (e) {
	            try {
	              reject(e);
	            } catch (e) {
	              console.error('Uncaught error during promise rejection', e);
	            }
	          }
	        }
	        var bound = cb['__siesta_bound_object'] || cb; // Preserve bound object.
	        cb.apply(bound, args);
	      });
	      fn(_cb);
	    });
	  },
	  defer: function defer() {
	    var resolve, reject;
	    var p = new Promise(function (_resolve, _reject) {
	      resolve = _resolve;
	      reject = _reject;
	    });
	    //noinspection JSUnusedAssignment
	    p.resolve = resolve;
	    //noinspection JSUnusedAssignment
	    p.reject = reject;
	    return p;
	  },
	  subProperties: function subProperties(obj, subObj, properties) {
	    if (!isArray(properties)) {
	      properties = Array.prototype.slice.call(arguments, 2);
	    }
	    for (var i = 0; i < properties.length; i++) {
	      (function (property) {
	        var opts = {
	          set: false,
	          name: property,
	          property: property
	        };
	        if (!isString(property)) {
	          extend(opts, property);
	        }
	        var desc = {
	          get: function get() {
	            return subObj[opts.property];
	          },
	          enumerable: true,
	          configurable: true
	        };
	        if (opts.set) {
	          desc.set = function (v) {
	            subObj[opts.property] = v;
	          };
	        }
	        Object.defineProperty(obj, opts.name, desc);
	      })(properties[i]);
	    }
	  },
	  capitaliseFirstLetter: function capitaliseFirstLetter(string) {
	    return string.charAt(0).toUpperCase() + string.slice(1);
	  },
	  extendFromOpts: function extendFromOpts(obj, opts, defaults, errorOnUnknown) {
	    errorOnUnknown = errorOnUnknown == undefined ? true : errorOnUnknown;
	    if (errorOnUnknown) {
	      var defaultKeys = Object.keys(defaults),
	          optsKeys = Object.keys(opts);
	      var unknownKeys = optsKeys.filter(function (n) {
	        return defaultKeys.indexOf(n) == -1;
	      });
	      if (unknownKeys.length) throw Error('Unknown options: ' + unknownKeys.toString());
	    }
	    // Apply any functions specified in the defaults.
	    Object.keys(defaults).forEach(function (k) {
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
	  prettyPrint: function prettyPrint(o) {
	    return JSON.stringify(o, null, 4);
	  },
	  flattenArray: function flattenArray(arr) {
	    return arr.reduce(function (memo, e) {
	      if (isArray(e)) {
	        memo = memo.concat(e);
	      } else {
	        memo.push(e);
	      }
	      return memo;
	    }, []);
	  },
	  unflattenArray: function unflattenArray(arr, modelArr) {
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
	  }
	});
	
	/**
	 * Compact a sparse array
	 * @param arr
	 * @returns {Array}
	 */
	function compact(arr) {
	  arr = arr || [];
	  return arr.filter(function (x) {
	    return x;
	  });
	}
	
	/**
	 * Execute tasks in parallel
	 * @param tasks
	 * @param cb
	 */
	function parallel(tasks, cb) {
	  cb = cb || function () {};
	  if (tasks && tasks.length) {
	    var results = [],
	        errors = [],
	        numFinished = 0;
	    tasks.forEach(function (fn, idx) {
	      results[idx] = false;
	      fn(function (err, res) {
	        numFinished++;
	        if (err) errors[idx] = err;
	        results[idx] = res;
	        if (numFinished == tasks.length) {
	          cb(errors.length ? compact(errors) : null, compact(results), { results: results, errors: errors });
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
	  cb = cb || function () {};
	  if (tasks && tasks.length) {
	    var results, errors, idx;
	
	    (function () {
	      var executeTask = function executeTask(task) {
	        task(function (err, res) {
	          if (err) errors[idx] = err;
	          results[idx] = res;
	          if (!tasks.length) {
	            cb(errors.length ? compact(errors) : null, compact(results), { results: results, errors: errors });
	          } else {
	            idx++;
	            nextTask();
	          }
	        });
	      };
	
	      var nextTask = function nextTask() {
	        var nextTask = tasks.shift();
	        executeTask(nextTask);
	      };
	
	      results = [];
	      errors = [];
	      idx = 0;
	
	
	      nextTask();
	    })();
	  } else cb();
	}
	
	extend(module.exports, {
	  compact: compact,
	  parallel: parallel,
	  series: series
	});
	
	var FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m,
	    FN_ARG_SPLIT = /,/,
	    FN_ARG = /^\s*(_?)(.+?)\1\s*$/,
	    STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
	
	extend(module.exports, {
	  /**
	   * Return the parameter names of a function.
	   * Note: adapted from AngularJS dependency injection :)
	   * @param fn
	   */
	  paramNames: function paramNames(fn) {
	    // TODO: Is there a more robust way of doing this?
	    var params = [],
	        fnText,
	        argDecl;
	    fnText = fn.toString().replace(STRIP_COMMENTS, '');
	    argDecl = fnText.match(FN_ARGS);
	
	    argDecl[1].split(FN_ARG_SPLIT).forEach(function (arg) {
	      arg.replace(FN_ARG, function (all, underscore, name) {
	        params.push(name);
	      });
	    });
	    return params;
	  }
	});

/***/ },
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global, module) {'use strict';
	
	/*
	 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
	 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
	 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
	 * Code distributed by Google as part of the polymer project is also
	 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
	 */
	
	(function (global) {
	  'use strict';
	
	  var testingExposeCycleCount = global.testingExposeCycleCount;
	
	  // Detect and do basic sanity checking on Object/Array.observe.
	  function detectObjectObserve() {
	    if (typeof Object.observe !== 'function' || typeof Array.observe !== 'function') {
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
	    if (records.length !== 5) return false;
	
	    if (records[0].type != 'add' || records[1].type != 'update' || records[2].type != 'delete' || records[3].type != 'splice' || records[4].type != 'splice') {
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
	
	  var numberIsNaN = global.Number.isNaN || function (value) {
	    return typeof value === 'number' && global.isNaN(value);
	  };
	
	  function areSameValue(left, right) {
	    if (left === right) return left !== 0 || 1 / left === 1 / right;
	    if (numberIsNaN(left) && numberIsNaN(right)) return true;
	
	    return left !== left && right !== right;
	  }
	
	  var createObject = '__proto__' in {} ? function (obj) {
	    return obj;
	  } : function (obj) {
	    var proto = obj.__proto__;
	    if (!proto) return obj;
	    var newObject = Object.create(proto);
	    Object.getOwnPropertyNames(obj).forEach(function (name) {
	      Object.defineProperty(newObject, name, Object.getOwnPropertyDescriptor(obj, name));
	    });
	    return newObject;
	  };
	
	  var identStart = '[\$_a-zA-Z]';
	  var identPart = '[\$_a-zA-Z0-9]';
	  var identRegExp = new RegExp('^' + identStart + '+' + identPart + '*' + '$');
	
	  function getPathCharType(char) {
	    if (char === undefined) return 'eof';
	
	    var code = char.charCodeAt(0);
	
	    switch (code) {
	      case 0x5B: // [
	      case 0x5D: // ]
	      case 0x2E: // .
	      case 0x22: // "
	      case 0x27: // '
	      case 0x30:
	        // 0
	        return char;
	
	      case 0x5F: // _
	      case 0x24:
	        // $
	        return 'ident';
	
	      case 0x20: // Space
	      case 0x09: // Tab
	      case 0x0A: // Newline
	      case 0x0D: // Return
	      case 0xA0: // No-break space
	      case 0xFEFF: // Byte Order Mark
	      case 0x2028: // Line Separator
	      case 0x2029:
	        // Paragraph Separator
	        return 'ws';
	    }
	
	    // a-z, A-Z
	    if (0x61 <= code && code <= 0x7A || 0x41 <= code && code <= 0x5A) return 'ident';
	
	    // 1-9
	    if (0x31 <= code && code <= 0x39) return 'number';
	
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
	  };
	
	  function noop() {}
	
	  function parsePath(path) {
	    var keys = [];
	    var index = -1;
	    var c,
	        newChar,
	        key,
	        type,
	        transition,
	        action,
	        typeMap,
	        mode = 'beforePath';
	
	    var actions = {
	      push: function push() {
	        if (key === undefined) return;
	
	        keys.push(key);
	        key = undefined;
	      },
	
	      append: function append() {
	        if (key === undefined) key = newChar;else key += newChar;
	      }
	    };
	
	    function maybeUnescapeQuote() {
	      if (index >= path.length) return;
	
	      var nextChar = path[index + 1];
	      if (mode == 'inSingleQuote' && nextChar == "'" || mode == 'inDoubleQuote' && nextChar == '"') {
	        index++;
	        newChar = nextChar;
	        actions.append();
	        return true;
	      }
	    }
	
	    while (mode) {
	      index++;
	      c = path[index];
	
	      if (c == '\\' && maybeUnescapeQuote(mode)) continue;
	
	      type = getPathCharType(c);
	      typeMap = pathStateMachine[mode];
	      transition = typeMap[type] || typeMap['else'] || 'error';
	
	      if (transition == 'error') return; // parse error;
	
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
	    if (privateToken !== constructorIsPrivate) throw Error('Use Path.get to retrieve path objects');
	
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
	    if (pathString instanceof Path) return pathString;
	
	    if (pathString == null || pathString.length == 0) pathString = '';
	
	    if (typeof pathString != 'string') {
	      if (isIndex(pathString.length)) {
	        // Constructed with array-like (pre-parsed) keys
	        return new Path(pathString, constructorIsPrivate);
	      }
	
	      pathString = String(pathString);
	    }
	
	    var path = pathCache[pathString];
	    if (path) return path;
	
	    var parts = parsePath(pathString);
	    if (!parts) return invalidPath;
	
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
	
	    toString: function toString() {
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
	
	    getValueFrom: function getValueFrom(obj, directObserver) {
	      for (var i = 0; i < this.length; i++) {
	        if (obj == null) return;
	        obj = obj[this[i]];
	      }
	      return obj;
	    },
	
	    iterateObjects: function iterateObjects(obj, observe) {
	      for (var i = 0; i < this.length; i++) {
	        if (i) obj = obj[this[i - 1]];
	        if (!isObject(obj)) return;
	        observe(obj, this[0]);
	      }
	    },
	
	    compiledGetValueFromFn: function compiledGetValueFromFn() {
	      var str = '';
	      var pathString = 'obj';
	      str += 'if (obj != null';
	      var i = 0;
	      var key;
	      for (; i < this.length - 1; i++) {
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
	
	    setValueFrom: function setValueFrom(obj, value) {
	      if (!this.length) return false;
	
	      for (var i = 0; i < this.length - 1; i++) {
	        if (!isObject(obj)) return false;
	        obj = obj[this[i]];
	      }
	
	      if (!isObject(obj)) return false;
	
	      obj[this[i]] = value;
	      return true;
	    }
	  });
	
	  var invalidPath = new Path('', constructorIsPrivate);
	  invalidPath.valid = false;
	  invalidPath.getValueFrom = invalidPath.setValueFrom = function () {};
	
	  var MAX_DIRTY_CHECK_CYCLES = 1000;
	
	  function dirtyCheck(observer) {
	    var cycles = 0;
	    while (cycles < MAX_DIRTY_CHECK_CYCLES && observer.check_()) {
	      cycles++;
	    }
	    if (testingExposeCycleCount) global.dirtyCheckCycleCount = cycles;
	
	    return cycles > 0;
	  }
	
	  function objectIsEmpty(object) {
	    for (var prop in object) {
	      return false;
	    }return true;
	  }
	
	  function diffIsEmpty(diff) {
	    return objectIsEmpty(diff.added) && objectIsEmpty(diff.removed) && objectIsEmpty(diff.changed);
	  }
	
	  function diffObjectFromOldObject(object, oldObject) {
	    var added = {};
	    var removed = {};
	    var changed = {};
	
	    for (var prop in oldObject) {
	      var newValue = object[prop];
	
	      if (newValue !== undefined && newValue === oldObject[prop]) continue;
	
	      if (!(prop in object)) {
	        removed[prop] = undefined;
	        continue;
	      }
	
	      if (newValue !== oldObject[prop]) changed[prop] = newValue;
	    }
	
	    for (var prop in object) {
	      if (prop in oldObject) continue;
	
	      added[prop] = object[prop];
	    }
	
	    if (Array.isArray(object) && object.length !== oldObject.length) changed.length = object.length;
	
	    return {
	      added: added,
	      removed: removed,
	      changed: changed
	    };
	  }
	
	  var eomTasks = [];
	  function runEOMTasks() {
	    if (!eomTasks.length) return false;
	
	    for (var i = 0; i < eomTasks.length; i++) {
	      eomTasks[i]();
	    }
	    eomTasks.length = 0;
	    return true;
	  }
	
	  var runEOM = hasObserve ? function () {
	    var eomObj = { pingPong: true };
	    var eomRunScheduled = false;
	
	    Object.observe(eomObj, function () {
	      runEOMTasks();
	      eomRunScheduled = false;
	    });
	
	    return function (fn) {
	      eomTasks.push(fn);
	      if (!eomRunScheduled) {
	        eomRunScheduled = true;
	        eomObj.pingPong = !eomObj.pingPong;
	      }
	    };
	  }() : function () {
	    return function (fn) {
	      eomTasks.push(fn);
	    };
	  }();
	
	  var observedObjectCache = [];
	
	  function newObservedObject() {
	    var observer;
	    var object;
	    var discardRecords = false;
	    var first = true;
	
	    function callback(records) {
	      if (observer && observer.state_ === OPENED && !discardRecords) observer.check_(records);
	    }
	
	    return {
	      open: function open(obs) {
	        if (observer) throw Error('ObservedObject in use');
	
	        if (!first) Object.deliverChangeRecords(callback);
	
	        observer = obs;
	        first = false;
	      },
	      observe: function observe(obj, arrayObserve) {
	        object = obj;
	        if (arrayObserve) Array.observe(object, callback);else Object.observe(object, callback);
	      },
	      deliver: function deliver(discard) {
	        discardRecords = discard;
	        Object.deliverChangeRecords(callback);
	        discardRecords = false;
	      },
	      close: function close() {
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
	      if (!obj) return;
	
	      if (obj === rootObj) rootObjProps[prop] = true;
	
	      if (objects.indexOf(obj) < 0) {
	        objects.push(obj);
	        Object.observe(obj, callback);
	      }
	
	      observe(Object.getPrototypeOf(obj), prop);
	    }
	
	    function allRootObjNonObservedProps(recs) {
	      for (var i = 0; i < recs.length; i++) {
	        var rec = recs[i];
	        if (rec.object !== rootObj || rootObjProps[rec.name] || rec.type === 'setPrototype') {
	          return false;
	        }
	      }
	      return true;
	    }
	
	    function callback(recs) {
	      if (allRootObjNonObservedProps(recs)) return;
	
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
	      open: function open(obs, object) {
	        if (!rootObj) {
	          rootObj = object;
	          rootObjProps = {};
	        }
	
	        observers.push(obs);
	        observerCount++;
	        obs.iterateObjects_(observe);
	      },
	      close: function close(obs) {
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
	    open: function open(callback, target) {
	      if (this.state_ != UNOPENED) throw Error('Observer has already been opened.');
	
	      addToAll(this);
	      this.callback_ = callback;
	      this.target_ = target;
	      this.connect_();
	      this.state_ = OPENED;
	      return this.value_;
	    },
	
	    close: function close() {
	      if (this.state_ != OPENED) return;
	
	      removeFromAll(this);
	      this.disconnect_();
	      this.value_ = undefined;
	      this.callback_ = undefined;
	      this.target_ = undefined;
	      this.state_ = CLOSED;
	    },
	
	    deliver: function deliver() {
	      if (this.state_ != OPENED) return;
	
	      dirtyCheck(this);
	    },
	
	    report_: function report_(changes) {
	      try {
	        this.callback_.apply(this.target_, changes);
	      } catch (ex) {
	        Observer._errorThrownDuringCallback = true;
	        console.error('Exception caught during observer callback: ' + (ex.stack || ex));
	      }
	    },
	
	    discardChanges: function discardChanges() {
	      this.check_(undefined, true);
	      return this.value_;
	    }
	  };
	
	  var collectObservers = !hasObserve;
	  var allObservers;
	  Observer._allObserversCount = 0;
	
	  if (collectObservers) {
	    allObservers = [];
	  }
	
	  function addToAll(observer) {
	    Observer._allObserversCount++;
	    if (!collectObservers) return;
	
	    allObservers.push(observer);
	  }
	
	  function removeFromAll(observer) {
	    Observer._allObserversCount--;
	  }
	
	  var runningMicrotaskCheckpoint = false;
	
	  var hasDebugForceFullDelivery = hasObserve && hasEval && function () {
	    try {
	      eval('%RunMicrotasks()');
	      return true;
	    } catch (ex) {
	      return false;
	    }
	  }();
	
	  global.Platform = global.Platform || {};
	
	  global.Platform.performMicrotaskCheckpoint = function () {
	    if (runningMicrotaskCheckpoint) return;
	
	    if (hasDebugForceFullDelivery) {
	      eval('%RunMicrotasks()');
	      return;
	    }
	
	    if (!collectObservers) return;
	
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
	        if (observer.state_ != OPENED) continue;
	
	        if (observer.check_()) anyChanged = true;
	
	        allObservers.push(observer);
	      }
	      if (runEOMTasks()) anyChanged = true;
	    } while (cycles < MAX_DIRTY_CHECK_CYCLES && anyChanged);
	
	    if (testingExposeCycleCount) global.dirtyCheckCycleCount = cycles;
	
	    runningMicrotaskCheckpoint = false;
	  };
	
	  if (collectObservers) {
	    global.Platform.clearObservers = function () {
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
	
	    connect_: function connect_(callback, target) {
	      if (hasObserve) {
	        this.directObserver_ = getObservedObject(this, this.value_, this.arrayObserve);
	      } else {
	        this.oldObject_ = this.copyObject(this.value_);
	      }
	    },
	
	    copyObject: function copyObject(object) {
	      var copy = Array.isArray(object) ? [] : {};
	      for (var prop in object) {
	        copy[prop] = object[prop];
	      };
	      if (Array.isArray(object)) copy.length = object.length;
	      return copy;
	    },
	
	    check_: function check_(changeRecords, skipChanges) {
	      var diff;
	      var oldValues;
	      if (hasObserve) {
	        if (!changeRecords) return false;
	
	        oldValues = {};
	        diff = diffObjectFromChangeRecords(this.value_, changeRecords, oldValues);
	      } else {
	        oldValues = this.oldObject_;
	        diff = diffObjectFromOldObject(this.value_, this.oldObject_);
	      }
	
	      if (diffIsEmpty(diff)) return false;
	
	      if (!hasObserve) this.oldObject_ = this.copyObject(this.value_);
	
	      this.report_([diff.added || {}, diff.removed || {}, diff.changed || {}, function (property) {
	        return oldValues[property];
	      }]);
	
	      return true;
	    },
	
	    disconnect_: function disconnect_() {
	      if (hasObserve) {
	        this.directObserver_.close();
	        this.directObserver_ = undefined;
	      } else {
	        this.oldObject_ = undefined;
	      }
	    },
	
	    deliver: function deliver() {
	      if (this.state_ != OPENED) return;
	
	      if (hasObserve) this.directObserver_.deliver(false);else dirtyCheck(this);
	    },
	
	    discardChanges: function discardChanges() {
	      if (this.directObserver_) this.directObserver_.deliver(true);else this.oldObject_ = this.copyObject(this.value_);
	
	      return this.value_;
	    }
	  });
	
	  function ArrayObserver(array) {
	    if (!Array.isArray(array)) throw Error('Provided object is not an Array');
	    ObjectObserver.call(this, array);
	  }
	
	  ArrayObserver.prototype = createObject({
	
	    __proto__: ObjectObserver.prototype,
	
	    arrayObserve: true,
	
	    copyObject: function copyObject(arr) {
	      return arr.slice();
	    },
	
	    check_: function check_(changeRecords) {
	      var splices;
	      if (hasObserve) {
	        if (!changeRecords) return false;
	        splices = projectArraySplices(this.value_, changeRecords);
	      } else {
	        splices = calcSplices(this.value_, 0, this.value_.length, this.oldObject_, 0, this.oldObject_.length);
	      }
	
	      if (!splices || !splices.length) return false;
	
	      if (!hasObserve) this.oldObject_ = this.copyObject(this.value_);
	
	      this.report_([splices]);
	      return true;
	    }
	  });
	
	  ArrayObserver.applySplices = function (previous, current, splices) {
	    splices.forEach(function (splice) {
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
	
	    connect_: function connect_() {
	      if (hasObserve) this.directObserver_ = getObservedSet(this, this.object_);
	
	      this.check_(undefined, true);
	    },
	
	    disconnect_: function disconnect_() {
	      this.value_ = undefined;
	
	      if (this.directObserver_) {
	        this.directObserver_.close(this);
	        this.directObserver_ = undefined;
	      }
	    },
	
	    iterateObjects_: function iterateObjects_(observe) {
	      this.path_.iterateObjects(this.object_, observe);
	    },
	
	    check_: function check_(changeRecords, skipChanges) {
	      var oldValue = this.value_;
	      this.value_ = this.path_.getValueFrom(this.object_);
	      if (skipChanges || areSameValue(this.value_, oldValue)) return false;
	
	      this.report_([this.value_, oldValue, this]);
	      return true;
	    },
	
	    setValue: function setValue(newValue) {
	      if (this.path_) this.path_.setValueFrom(this.object_, newValue);
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
	
	    connect_: function connect_() {
	      if (hasObserve) {
	        var object;
	        var needsDirectObserver = false;
	        for (var i = 0; i < this.observed_.length; i += 2) {
	          object = this.observed_[i];
	          if (object !== observerSentinel) {
	            needsDirectObserver = true;
	            break;
	          }
	        }
	
	        if (needsDirectObserver) this.directObserver_ = getObservedSet(this, object);
	      }
	
	      this.check_(undefined, !this.reportChangesOnOpen_);
	    },
	
	    disconnect_: function disconnect_() {
	      for (var i = 0; i < this.observed_.length; i += 2) {
	        if (this.observed_[i] === observerSentinel) this.observed_[i + 1].close();
	      }
	      this.observed_.length = 0;
	      this.value_.length = 0;
	
	      if (this.directObserver_) {
	        this.directObserver_.close(this);
	        this.directObserver_ = undefined;
	      }
	    },
	
	    addPath: function addPath(object, path) {
	      if (this.state_ != UNOPENED && this.state_ != RESETTING) throw Error('Cannot add paths once started.');
	
	      var path = getPath(path);
	      this.observed_.push(object, path);
	      if (!this.reportChangesOnOpen_) return;
	      var index = this.observed_.length / 2 - 1;
	      this.value_[index] = path.getValueFrom(object);
	    },
	
	    addObserver: function addObserver(observer) {
	      if (this.state_ != UNOPENED && this.state_ != RESETTING) throw Error('Cannot add observers once started.');
	
	      this.observed_.push(observerSentinel, observer);
	      if (!this.reportChangesOnOpen_) return;
	      var index = this.observed_.length / 2 - 1;
	      this.value_[index] = observer.open(this.deliver, this);
	    },
	
	    startReset: function startReset() {
	      if (this.state_ != OPENED) throw Error('Can only reset while open');
	
	      this.state_ = RESETTING;
	      this.disconnect_();
	    },
	
	    finishReset: function finishReset() {
	      if (this.state_ != RESETTING) throw Error('Can only finishReset after startReset');
	      this.state_ = OPENED;
	      this.connect_();
	
	      return this.value_;
	    },
	
	    iterateObjects_: function iterateObjects_(observe) {
	      var object;
	      for (var i = 0; i < this.observed_.length; i += 2) {
	        object = this.observed_[i];
	        if (object !== observerSentinel) this.observed_[i + 1].iterateObjects(object, observe);
	      }
	    },
	
	    check_: function check_(changeRecords, skipChanges) {
	      var oldValues;
	      for (var i = 0; i < this.observed_.length; i += 2) {
	        var object = this.observed_[i];
	        var path = this.observed_[i + 1];
	        var value;
	        if (object === observerSentinel) {
	          var observable = path;
	          value = this.state_ === UNOPENED ? observable.open(this.deliver, this) : observable.discardChanges();
	        } else {
	          value = path.getValueFrom(object);
	        }
	
	        if (skipChanges) {
	          this.value_[i / 2] = value;
	          continue;
	        }
	
	        if (areSameValue(value, this.value_[i / 2])) continue;
	
	        oldValues = oldValues || [];
	        oldValues[i / 2] = this.value_[i / 2];
	        this.value_[i / 2] = value;
	      }
	
	      if (!oldValues) return false;
	
	      // TODO(rafaelw): Having observed_ as the third callback arg here is
	      // pretty lame API. Fix.
	      this.report_([this.value_, oldValues, this.observed_]);
	      return true;
	    }
	  });
	
	  function identFn(value) {
	    return value;
	  }
	
	  function ObserverTransform(observable, getValueFn, setValueFn, dontPassThroughSet) {
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
	    open: function open(callback, target) {
	      this.callback_ = callback;
	      this.target_ = target;
	      this.value_ = this.getValueFn_(this.observable_.open(this.observedCallback_, this));
	      return this.value_;
	    },
	
	    observedCallback_: function observedCallback_(value) {
	      value = this.getValueFn_(value);
	      if (areSameValue(value, this.value_)) return;
	      var oldValue = this.value_;
	      this.value_ = value;
	      this.callback_.call(this.target_, this.value_, oldValue);
	    },
	
	    discardChanges: function discardChanges() {
	      this.value_ = this.getValueFn_(this.observable_.discardChanges());
	      return this.value_;
	    },
	
	    deliver: function deliver() {
	      return this.observable_.deliver();
	    },
	
	    setValue: function setValue(value) {
	      value = this.setValueFn_(value);
	      if (!this.dontPassThroughSet_ && this.observable_.setValue) return this.observable_.setValue(value);
	    },
	
	    close: function close() {
	      if (this.observable_) this.observable_.close();
	      this.callback_ = undefined;
	      this.target_ = undefined;
	      this.observable_ = undefined;
	      this.value_ = undefined;
	      this.getValueFn_ = undefined;
	      this.setValueFn_ = undefined;
	    }
	  };
	
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
	
	      if (!(record.name in oldValues)) oldValues[record.name] = record.oldValue;
	
	      if (record.type == 'update') continue;
	
	      if (record.type == 'add') {
	        if (record.name in removed) delete removed[record.name];else added[record.name] = true;
	
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
	
	    for (var prop in added) {
	      added[prop] = object[prop];
	    }for (var prop in removed) {
	      removed[prop] = undefined;
	    }var changed = {};
	    for (var prop in oldValues) {
	      if (prop in added || prop in removed) continue;
	
	      var newValue = object[prop];
	      if (oldValues[prop] !== newValue) changed[prop] = newValue;
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
	    calcEditDistances: function calcEditDistances(current, currentStart, currentEnd, old, oldStart, oldEnd) {
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
	      for (var j = 0; j < columnCount; j++) {
	        distances[0][j] = j;
	      }for (var i = 1; i < rowCount; i++) {
	        for (var j = 1; j < columnCount; j++) {
	          if (this.equals(current[currentStart + j - 1], old[oldStart + i - 1])) distances[i][j] = distances[i - 1][j - 1];else {
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
	    spliceOperationsFromEditDistances: function spliceOperationsFromEditDistances(distances) {
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
	        if (west < north) min = west < northWest ? west : northWest;else min = north < northWest ? north : northWest;
	
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
	    calcSplices: function calcSplices(current, currentStart, currentEnd, old, oldStart, oldEnd) {
	      var prefixCount = 0;
	      var suffixCount = 0;
	
	      var minLength = Math.min(currentEnd - currentStart, oldEnd - oldStart);
	      if (currentStart == 0 && oldStart == 0) prefixCount = this.sharedPrefix(current, old, minLength);
	
	      if (currentEnd == current.length && oldEnd == old.length) suffixCount = this.sharedSuffix(current, old, minLength - prefixCount);
	
	      currentStart += prefixCount;
	      oldStart += prefixCount;
	      currentEnd -= suffixCount;
	      oldEnd -= suffixCount;
	
	      if (currentEnd - currentStart == 0 && oldEnd - oldStart == 0) return [];
	
	      if (currentStart == currentEnd) {
	        var splice = newSplice(currentStart, [], 0);
	        while (oldStart < oldEnd) {
	          splice.removed.push(old[oldStart++]);
	        }return [splice];
	      } else if (oldStart == oldEnd) return [newSplice(currentStart, [], currentEnd - currentStart)];
	
	      var ops = this.spliceOperationsFromEditDistances(this.calcEditDistances(current, currentStart, currentEnd, old, oldStart, oldEnd));
	
	      var splice = undefined;
	      var splices = [];
	      var index = currentStart;
	      var oldIndex = oldStart;
	      for (var i = 0; i < ops.length; i++) {
	        switch (ops[i]) {
	          case EDIT_LEAVE:
	            if (splice) {
	              splices.push(splice);
	              splice = undefined;
	            }
	
	            index++;
	            oldIndex++;
	            break;
	          case EDIT_UPDATE:
	            if (!splice) splice = newSplice(index, [], 0);
	
	            splice.addedCount++;
	            index++;
	
	            splice.removed.push(old[oldIndex]);
	            oldIndex++;
	            break;
	          case EDIT_ADD:
	            if (!splice) splice = newSplice(index, [], 0);
	
	            splice.addedCount++;
	            index++;
	            break;
	          case EDIT_DELETE:
	            if (!splice) splice = newSplice(index, [], 0);
	
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
	
	    sharedPrefix: function sharedPrefix(current, old, searchLength) {
	      for (var i = 0; i < searchLength; i++) {
	        if (!this.equals(current[i], old[i])) return i;
	      }return searchLength;
	    },
	
	    sharedSuffix: function sharedSuffix(current, old, searchLength) {
	      var index1 = current.length;
	      var index2 = old.length;
	      var count = 0;
	      while (count < searchLength && this.equals(current[--index1], old[--index2])) {
	        count++;
	      }return count;
	    },
	
	    calculateSplices: function calculateSplices(current, previous) {
	      return this.calcSplices(current, 0, current.length, previous, 0, previous.length);
	    },
	
	    equals: function equals(currentValue, previousValue) {
	      return currentValue === previousValue;
	    }
	  };
	
	  var arraySplice = new ArraySplice();
	
	  function calcSplices(current, currentStart, currentEnd, old, oldStart, oldEnd) {
	    return arraySplice.calcSplices(current, currentStart, currentEnd, old, oldStart, oldEnd);
	  }
	
	  function intersect(start1, end1, start2, end2) {
	    // Disjoint
	    if (end1 < start2 || end2 < start1) return -1;
	
	    // Adjacent
	    if (end1 == start2 || end2 == start1) return 0;
	
	    // Non-zero intersect, span1 first
	    if (start1 < start2) {
	      if (end1 < end2) return end1 - start2; // Overlap
	      else return end2 - start2; // Contained
	    } else {
	        // Non-zero intersect, span2 first
	        if (end2 < end1) return end2 - start1; // Overlap
	        else return end1 - start1; // Contained
	      }
	  }
	
	  function mergeSplice(splices, index, removed, addedCount) {
	
	    var splice = newSplice(index, removed, addedCount);
	
	    var inserted = false;
	    var insertionOffset = 0;
	
	    for (var i = 0; i < splices.length; i++) {
	      var current = splices[i];
	      current.index += insertionOffset;
	
	      if (inserted) continue;
	
	      var intersectCount = intersect(splice.index, splice.index + splice.removed.length, current.index, current.index + current.addedCount);
	
	      if (intersectCount >= 0) {
	        // Merge the two splices
	
	        splices.splice(i, 1);
	        i--;
	
	        insertionOffset -= current.addedCount - current.removed.length;
	
	        splice.addedCount += current.addedCount - intersectCount;
	        var deleteCount = splice.removed.length + current.removed.length - intersectCount;
	
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
	
	        var offset = splice.addedCount - splice.removed.length;
	        current.index += offset;
	        insertionOffset += offset;
	      }
	    }
	
	    if (!inserted) splices.push(splice);
	  }
	
	  function createInitialSplices(array, changeRecords) {
	    var splices = [];
	
	    for (var i = 0; i < changeRecords.length; i++) {
	      var record = changeRecords[i];
	      switch (record.type) {
	        case 'splice':
	          mergeSplice(splices, record.index, record.removed.slice(), record.addedCount);
	          break;
	        case 'add':
	        case 'update':
	        case 'delete':
	          if (!isIndex(record.name)) continue;
	          var index = toNumber(record.name);
	          if (index < 0) continue;
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
	
	    createInitialSplices(array, changeRecords).forEach(function (splice) {
	      if (splice.addedCount == 1 && splice.removed.length == 1) {
	        if (splice.removed[0] !== array[splice.index]) splices.push(splice);
	
	        return;
	      };
	
	      splices = splices.concat(calcSplices(array, splice.index, splice.index + splice.addedCount, splice.removed, 0, splice.removed.length));
	    });
	
	    return splices;
	  }
	
	  // Export the observe-js object for **Node.js**, with
	  // backwards-compatibility for the old `require()` API. If we're in
	  // the browser, export as a global object.
	  var expose = global;
	  if (true) {
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
	  expose.ArrayObserver.calculateSplices = function (current, previous) {
	    return arraySplice.calculateSplices(current, previous);
	  };
	  expose.Platform = global.Platform;
	  expose.ArraySplice = ArraySplice;
	  expose.ObjectObserver = ObjectObserver;
	  expose.PathObserver = PathObserver;
	  expose.CompoundObserver = CompoundObserver;
	  expose.Path = Path;
	  expose.ObserverTransform = ObserverTransform;
	})(typeof global !== 'undefined' && global && typeof module !== 'undefined' && module ? global : undefined || window);
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }()), __webpack_require__(6)(module)))

/***/ },
/* 6 */
/***/ function(module, exports) {

	module.exports = function(module) {
		if(!module.webpackPolyfill) {
			module.deprecate = function() {};
			module.paths = [];
			// module.parent = undefined by default
			module.children = [];
			module.webpackPolyfill = 1;
		}
		return module;
	}


/***/ },
/* 7 */
/***/ function(module, exports) {

	'use strict';
	
	module.exports = argsArray;
	
	function argsArray(fun) {
	  return function () {
	    var len = arguments.length;
	    if (len) {
	      var args = [];
	      var i = -1;
	      while (++i < len) {
	        args[i] = arguments[i];
	      }
	      return fun.call(this, args);
	    } else {
	      return fun.call(this, []);
	    }
	  };
	}

/***/ },
/* 8 */
/***/ function(module, exports) {

	'use strict';
	
	var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };
	
	/**
	 * Users should never see these thrown. A bug report should be filed if so as it means some assertion has failed.
	 * @param message
	 * @param context
	 * @param ssf
	 * @constructor
	 */
	function InternalSiestaError(message, context, ssf) {
	  this.message = message;
	  this.context = context;
	  // capture stack trace
	  if (ssf && Error.captureStackTrace) {
	    Error.captureStackTrace(this, ssf);
	  }
	}
	
	InternalSiestaError.prototype = Object.create(Error.prototype);
	InternalSiestaError.prototype.name = 'InternalSiestaError';
	InternalSiestaError.prototype.constructor = InternalSiestaError;
	
	function isSiestaError(err) {
	  if ((typeof err === 'undefined' ? 'undefined' : _typeof(err)) == 'object') {
	    return 'error' in err && 'ok' in err && 'reason' in err;
	  }
	  return false;
	}
	
	module.exports = function (errMessage, extra) {
	  if (isSiestaError(errMessage)) {
	    return errMessage;
	  }
	  var err = {
	    reason: errMessage,
	    error: true,
	    ok: false
	  };
	  for (var prop in extra || {}) {
	    if (extra.hasOwnProperty(prop)) err[prop] = extra[prop];
	  }
	  err.toString = function () {
	    return JSON.stringify(this);
	  };
	  return err;
	};
	
	module.exports.InternalSiestaError = InternalSiestaError;

/***/ },
/* 9 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	var util = __webpack_require__(4);
	
	function CollectionRegistry() {
	  if (!this) return new CollectionRegistry();
	  this.collectionNames = [];
	}
	
	util.extend(CollectionRegistry.prototype, {
	  register: function register(collection) {
	    var name = collection.name;
	    this[name] = collection;
	    this.collectionNames.push(name);
	  },
	  reset: function reset() {
	    var self = this;
	    this.collectionNames.forEach(function (name) {
	      delete self[name];
	    });
	    this.collectionNames = [];
	  }
	});
	
	exports.CollectionRegistry = new CollectionRegistry();

/***/ },
/* 10 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	var log = __webpack_require__(11)('collection'),
	    CollectionRegistry = __webpack_require__(9).CollectionRegistry,
	    InternalSiestaError = __webpack_require__(8).InternalSiestaError,
	    Model = __webpack_require__(15),
	    extend = __webpack_require__(28),
	    observe = __webpack_require__(5).Platform,
	    events = __webpack_require__(23),
	    util = __webpack_require__(4),
	    error = __webpack_require__(8),
	    argsarray = __webpack_require__(7),
	    cache = __webpack_require__(20);
	
	/**
	 * A collection describes a set of models and optionally a REST API which we would
	 * like to model.
	 *
	 * @param name
	 * @param opts
	 * @constructor
	 *
	 *
	 * @example
	 * ```js
	 * var GitHub = new siesta('GitHub')
	 * // ... configure mappings, descriptors etc ...
	 * GitHub.install(function () {
	     *     // ... carry on.
	     * });
	 * ```
	 */
	function Collection(name, opts) {
	  var self = this;
	  if (!name) throw new Error('Collection must have a name');
	
	  opts = opts || {};
	  util.extendFromOpts(this, opts, {});
	
	  util.extend(this, {
	    name: name,
	    _rawModels: {},
	    _models: {},
	    _opts: opts,
	    installed: false
	  });
	
	  CollectionRegistry.register(this);
	  this._makeAvailableOnRoot();
	  events.ProxyEventEmitter.call(this, this.name);
	}
	
	Collection.prototype = Object.create(events.ProxyEventEmitter.prototype);
	
	util.extend(Collection.prototype, {
	  _getModelsToInstall: function _getModelsToInstall() {
	    var modelsToInstall = [];
	    for (var name in this._models) {
	      if (this._models.hasOwnProperty(name)) {
	        var model = this._models[name];
	        modelsToInstall.push(model);
	      }
	    }
	    log('There are ' + modelsToInstall.length.toString() + ' mappings to install');
	    return modelsToInstall;
	  },
	  /**
	   * Means that we can access the collection on the siesta object.
	   * @private
	   */
	  _makeAvailableOnRoot: function _makeAvailableOnRoot() {
	    siesta[this.name] = this;
	  },
	  /**
	   * Ensure mappings are installed.
	   * @param [cb]
	   * @class Collection
	   */
	  install: function install(cb) {
	    var modelsToInstall = this._getModelsToInstall();
	    return util.promise(cb, function (cb) {
	      if (!this.installed) {
	        this.installed = true;
	        var errors = [];
	        modelsToInstall.forEach(function (m) {
	          log('Installing relationships for mapping with name "' + m.name + '"');
	          var err = m.installRelationships();
	          if (err) errors.push(err);
	        });
	        if (!errors.length) {
	          modelsToInstall.forEach(function (m) {
	            log('Installing reverse relationships for mapping with name "' + m.name + '"');
	            var err = m.installReverseRelationships();
	            if (err) errors.push(err);
	          });
	          if (!errors.length) {
	            this.installed = true;
	            this._makeAvailableOnRoot();
	          }
	        }
	        cb(errors.length ? error('Errors were encountered whilst setting up the collection', { errors: errors }) : null);
	      } else {
	        throw new InternalSiestaError('Collection "' + this.name + '" has already been installed');
	      }
	    }.bind(this));
	  },
	
	  _model: function _model(name, opts) {
	    if (name) {
	      this._rawModels[name] = opts;
	      opts = extend(true, {}, opts);
	      opts.name = name;
	      opts.collection = this;
	      var model = new Model(opts);
	      this._models[name] = model;
	      this[name] = model;
	      if (this.installed) {
	        var error = model.installRelationships();
	        if (!error) error = model.installReverseRelationships();
	        if (error) throw error;
	      }
	      return model;
	    } else {
	      throw new Error('No name specified when creating mapping');
	    }
	  },
	
	  /**
	   * Registers a model with this collection.
	   */
	  model: argsarray(function (args) {
	    if (args.length) {
	      if (args.length == 1) {
	        if (util.isArray(args[0])) {
	          return args[0].map(function (m) {
	            return this._model(m.name, m);
	          }.bind(this));
	        } else {
	          var name, opts;
	          if (util.isString(args[0])) {
	            name = args[0];
	            opts = {};
	          } else {
	            opts = args[0];
	            name = opts.name;
	          }
	          return this._model(name, opts);
	        }
	      } else {
	        if (typeof args[0] == 'string') {
	          return this._model(args[0], args[1]);
	        } else {
	          return args.map(function (m) {
	            return this._model(m.name, m);
	          }.bind(this));
	        }
	      }
	    }
	
	    return null;
	  }),
	
	  /**
	   * Dump this collection as JSON
	   * @param  {Boolean} asJson Whether or not to apply JSON.stringify
	   * @return {String|Object}
	   * @class Collection
	   */
	  _dump: function _dump(asJson) {
	    var obj = {};
	    obj.installed = this.installed;
	    obj.docId = this._docId;
	    obj.name = this.name;
	    return asJson ? util.prettyPrint(obj) : obj;
	  },
	
	  /**
	   * Returns the number of objects in this collection.
	   *
	   * @param cb
	   * @returns {Promise}
	   */
	  count: function count(cb) {
	    return util.promise(cb, function (cb) {
	      var tasks = Object.keys(this._models).map(function (modelName) {
	        var m = this._models[modelName];
	        return m.count.bind(m);
	      }.bind(this));
	      util.parallel(tasks, function (err, ns) {
	        var n;
	        if (!err) {
	          n = ns.reduce(function (m, r) {
	            return m + r;
	          }, 0);
	        }
	        cb(err, n);
	      });
	    }.bind(this));
	  },
	
	  graph: function graph(data, opts, cb) {
	    if (typeof opts == 'function') cb = opts;
	    opts = opts || {};
	    return util.promise(cb, function (cb) {
	      var tasks = [],
	          err;
	      for (var modelName in data) {
	        if (data.hasOwnProperty(modelName)) {
	          var model = this._models[modelName];
	          if (model) {
	            (function (model, data) {
	              tasks.push(function (done) {
	                model.graph(data, function (err, models) {
	                  if (!err) {
	                    var results = {};
	                    results[model.name] = models;
	                  }
	                  done(err, results);
	                });
	              });
	            })(model, data[modelName]);
	          } else {
	            err = 'No such model "' + modelName + '"';
	          }
	        }
	      }
	      if (!err) {
	        util.series(tasks, function (err, results) {
	          if (!err) {
	            results = results.reduce(function (memo, res) {
	              return util.extend(memo, res || {});
	            }, {});
	          } else results = null;
	          cb(err, results);
	        });
	      } else cb(error(err, { data: data, invalidModelName: modelName }));
	    }.bind(this));
	  },
	
	  removeAll: function removeAll(cb) {
	    return util.promise(cb, function (cb) {
	      util.Promise.all(Object.keys(this._models).map(function (modelName) {
	        var model = this._models[modelName];
	        return model.removeAll();
	      }.bind(this))).then(function () {
	        cb(null);
	      }).catch(cb);
	    }.bind(this));
	  }
	});
	
	module.exports = Collection;

/***/ },
/* 11 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	/**
	 * Dead simple logging service based on visionmedia/debug
	 * @module log
	 */
	
	var debug = __webpack_require__(12),
	    argsarray = __webpack_require__(7);
	
	module.exports = function (name) {
	  var log = debug('siesta:' + name);
	  var fn = argsarray(function (args) {
	    log.call(log, args);
	  });
	  Object.defineProperty(fn, 'enabled', {
	    get: function get() {
	      return debug.enabled(name);
	    }
	  });
	  return fn;
	};

/***/ },
/* 12 */
/***/ function(module, exports, __webpack_require__) {

	
	/**
	 * This is the web browser implementation of `debug()`.
	 *
	 * Expose `debug()` as the module.
	 */
	
	exports = module.exports = __webpack_require__(13);
	exports.log = log;
	exports.formatArgs = formatArgs;
	exports.save = save;
	exports.load = load;
	exports.useColors = useColors;
	exports.storage = 'undefined' != typeof chrome
	               && 'undefined' != typeof chrome.storage
	                  ? chrome.storage.local
	                  : localstorage();
	
	/**
	 * Colors.
	 */
	
	exports.colors = [
	  'lightseagreen',
	  'forestgreen',
	  'goldenrod',
	  'dodgerblue',
	  'darkorchid',
	  'crimson'
	];
	
	/**
	 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
	 * and the Firebug extension (any Firefox version) are known
	 * to support "%c" CSS customizations.
	 *
	 * TODO: add a `localStorage` variable to explicitly enable/disable colors
	 */
	
	function useColors() {
	  // is webkit? http://stackoverflow.com/a/16459606/376773
	  return ('WebkitAppearance' in document.documentElement.style) ||
	    // is firebug? http://stackoverflow.com/a/398120/376773
	    (window.console && (console.firebug || (console.exception && console.table))) ||
	    // is firefox >= v31?
	    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
	    (navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31);
	}
	
	/**
	 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
	 */
	
	exports.formatters.j = function(v) {
	  return JSON.stringify(v);
	};
	
	
	/**
	 * Colorize log arguments if enabled.
	 *
	 * @api public
	 */
	
	function formatArgs() {
	  var args = arguments;
	  var useColors = this.useColors;
	
	  args[0] = (useColors ? '%c' : '')
	    + this.namespace
	    + (useColors ? ' %c' : ' ')
	    + args[0]
	    + (useColors ? '%c ' : ' ')
	    + '+' + exports.humanize(this.diff);
	
	  if (!useColors) return args;
	
	  var c = 'color: ' + this.color;
	  args = [args[0], c, 'color: inherit'].concat(Array.prototype.slice.call(args, 1));
	
	  // the final "%c" is somewhat tricky, because there could be other
	  // arguments passed either before or after the %c, so we need to
	  // figure out the correct index to insert the CSS into
	  var index = 0;
	  var lastC = 0;
	  args[0].replace(/%[a-z%]/g, function(match) {
	    if ('%%' === match) return;
	    index++;
	    if ('%c' === match) {
	      // we only are interested in the *last* %c
	      // (the user may have provided their own)
	      lastC = index;
	    }
	  });
	
	  args.splice(lastC, 0, c);
	  return args;
	}
	
	/**
	 * Invokes `console.log()` when available.
	 * No-op when `console.log` is not a "function".
	 *
	 * @api public
	 */
	
	function log() {
	  // this hackery is required for IE8/9, where
	  // the `console.log` function doesn't have 'apply'
	  return 'object' === typeof console
	    && console.log
	    && Function.prototype.apply.call(console.log, console, arguments);
	}
	
	/**
	 * Save `namespaces`.
	 *
	 * @param {String} namespaces
	 * @api private
	 */
	
	function save(namespaces) {
	  try {
	    if (null == namespaces) {
	      exports.storage.removeItem('debug');
	    } else {
	      exports.storage.debug = namespaces;
	    }
	  } catch(e) {}
	}
	
	/**
	 * Load `namespaces`.
	 *
	 * @return {String} returns the previously persisted debug modes
	 * @api private
	 */
	
	function load() {
	  var r;
	  try {
	    r = exports.storage.debug;
	  } catch(e) {}
	  return r;
	}
	
	/**
	 * Enable namespaces listed in `localStorage.debug` initially.
	 */
	
	exports.enable(load());
	
	/**
	 * Localstorage attempts to return the localstorage.
	 *
	 * This is necessary because safari throws
	 * when a user disables cookies/localstorage
	 * and you attempt to access it.
	 *
	 * @return {LocalStorage}
	 * @api private
	 */
	
	function localstorage(){
	  try {
	    return window.localStorage;
	  } catch (e) {}
	}


/***/ },
/* 13 */
/***/ function(module, exports, __webpack_require__) {

	
	/**
	 * This is the common logic for both the Node.js and web browser
	 * implementations of `debug()`.
	 *
	 * Expose `debug()` as the module.
	 */
	
	exports = module.exports = debug;
	exports.coerce = coerce;
	exports.disable = disable;
	exports.enable = enable;
	exports.enabled = enabled;
	exports.humanize = __webpack_require__(14);
	
	/**
	 * The currently active debug mode names, and names to skip.
	 */
	
	exports.names = [];
	exports.skips = [];
	
	/**
	 * Map of special "%n" handling functions, for the debug "format" argument.
	 *
	 * Valid key names are a single, lowercased letter, i.e. "n".
	 */
	
	exports.formatters = {};
	
	/**
	 * Previously assigned color.
	 */
	
	var prevColor = 0;
	
	/**
	 * Previous log timestamp.
	 */
	
	var prevTime;
	
	/**
	 * Select a color.
	 *
	 * @return {Number}
	 * @api private
	 */
	
	function selectColor() {
	  return exports.colors[prevColor++ % exports.colors.length];
	}
	
	/**
	 * Create a debugger with the given `namespace`.
	 *
	 * @param {String} namespace
	 * @return {Function}
	 * @api public
	 */
	
	function debug(namespace) {
	
	  // define the `disabled` version
	  function disabled() {
	  }
	  disabled.enabled = false;
	
	  // define the `enabled` version
	  function enabled() {
	
	    var self = enabled;
	
	    // set `diff` timestamp
	    var curr = +new Date();
	    var ms = curr - (prevTime || curr);
	    self.diff = ms;
	    self.prev = prevTime;
	    self.curr = curr;
	    prevTime = curr;
	
	    // add the `color` if not set
	    if (null == self.useColors) self.useColors = exports.useColors();
	    if (null == self.color && self.useColors) self.color = selectColor();
	
	    var args = Array.prototype.slice.call(arguments);
	
	    args[0] = exports.coerce(args[0]);
	
	    if ('string' !== typeof args[0]) {
	      // anything else let's inspect with %o
	      args = ['%o'].concat(args);
	    }
	
	    // apply any `formatters` transformations
	    var index = 0;
	    args[0] = args[0].replace(/%([a-z%])/g, function(match, format) {
	      // if we encounter an escaped % then don't increase the array index
	      if (match === '%%') return match;
	      index++;
	      var formatter = exports.formatters[format];
	      if ('function' === typeof formatter) {
	        var val = args[index];
	        match = formatter.call(self, val);
	
	        // now we need to remove `args[index]` since it's inlined in the `format`
	        args.splice(index, 1);
	        index--;
	      }
	      return match;
	    });
	
	    if ('function' === typeof exports.formatArgs) {
	      args = exports.formatArgs.apply(self, args);
	    }
	    var logFn = enabled.log || exports.log || console.log.bind(console);
	    logFn.apply(self, args);
	  }
	  enabled.enabled = true;
	
	  var fn = exports.enabled(namespace) ? enabled : disabled;
	
	  fn.namespace = namespace;
	
	  return fn;
	}
	
	/**
	 * Enables a debug mode by namespaces. This can include modes
	 * separated by a colon and wildcards.
	 *
	 * @param {String} namespaces
	 * @api public
	 */
	
	function enable(namespaces) {
	  exports.save(namespaces);
	
	  var split = (namespaces || '').split(/[\s,]+/);
	  var len = split.length;
	
	  for (var i = 0; i < len; i++) {
	    if (!split[i]) continue; // ignore empty strings
	    namespaces = split[i].replace(/\*/g, '.*?');
	    if (namespaces[0] === '-') {
	      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
	    } else {
	      exports.names.push(new RegExp('^' + namespaces + '$'));
	    }
	  }
	}
	
	/**
	 * Disable debug output.
	 *
	 * @api public
	 */
	
	function disable() {
	  exports.enable('');
	}
	
	/**
	 * Returns true if the given mode name is enabled, false otherwise.
	 *
	 * @param {String} name
	 * @return {Boolean}
	 * @api public
	 */
	
	function enabled(name) {
	  var i, len;
	  for (i = 0, len = exports.skips.length; i < len; i++) {
	    if (exports.skips[i].test(name)) {
	      return false;
	    }
	  }
	  for (i = 0, len = exports.names.length; i < len; i++) {
	    if (exports.names[i].test(name)) {
	      return true;
	    }
	  }
	  return false;
	}
	
	/**
	 * Coerce `val`.
	 *
	 * @param {Mixed} val
	 * @return {Mixed}
	 * @api private
	 */
	
	function coerce(val) {
	  if (val instanceof Error) return val.stack || val.message;
	  return val;
	}


/***/ },
/* 14 */
/***/ function(module, exports) {

	/**
	 * Helpers.
	 */
	
	var s = 1000;
	var m = s * 60;
	var h = m * 60;
	var d = h * 24;
	var y = d * 365.25;
	
	/**
	 * Parse or format the given `val`.
	 *
	 * Options:
	 *
	 *  - `long` verbose formatting [false]
	 *
	 * @param {String|Number} val
	 * @param {Object} options
	 * @return {String|Number}
	 * @api public
	 */
	
	module.exports = function(val, options){
	  options = options || {};
	  if ('string' == typeof val) return parse(val);
	  return options.long
	    ? long(val)
	    : short(val);
	};
	
	/**
	 * Parse the given `str` and return milliseconds.
	 *
	 * @param {String} str
	 * @return {Number}
	 * @api private
	 */
	
	function parse(str) {
	  str = '' + str;
	  if (str.length > 10000) return;
	  var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(str);
	  if (!match) return;
	  var n = parseFloat(match[1]);
	  var type = (match[2] || 'ms').toLowerCase();
	  switch (type) {
	    case 'years':
	    case 'year':
	    case 'yrs':
	    case 'yr':
	    case 'y':
	      return n * y;
	    case 'days':
	    case 'day':
	    case 'd':
	      return n * d;
	    case 'hours':
	    case 'hour':
	    case 'hrs':
	    case 'hr':
	    case 'h':
	      return n * h;
	    case 'minutes':
	    case 'minute':
	    case 'mins':
	    case 'min':
	    case 'm':
	      return n * m;
	    case 'seconds':
	    case 'second':
	    case 'secs':
	    case 'sec':
	    case 's':
	      return n * s;
	    case 'milliseconds':
	    case 'millisecond':
	    case 'msecs':
	    case 'msec':
	    case 'ms':
	      return n;
	  }
	}
	
	/**
	 * Short format for `ms`.
	 *
	 * @param {Number} ms
	 * @return {String}
	 * @api private
	 */
	
	function short(ms) {
	  if (ms >= d) return Math.round(ms / d) + 'd';
	  if (ms >= h) return Math.round(ms / h) + 'h';
	  if (ms >= m) return Math.round(ms / m) + 'm';
	  if (ms >= s) return Math.round(ms / s) + 's';
	  return ms + 'ms';
	}
	
	/**
	 * Long format for `ms`.
	 *
	 * @param {Number} ms
	 * @return {String}
	 * @api private
	 */
	
	function long(ms) {
	  return plural(ms, d, 'day')
	    || plural(ms, h, 'hour')
	    || plural(ms, m, 'minute')
	    || plural(ms, s, 'second')
	    || ms + ' ms';
	}
	
	/**
	 * Pluralization helper.
	 */
	
	function plural(ms, n, name) {
	  if (ms < n) return;
	  if (ms < n * 1.5) return Math.floor(ms / n) + ' ' + name;
	  return Math.ceil(ms / n) + ' ' + name + 's';
	}


/***/ },
/* 15 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(setImmediate) {'use strict';
	
	var log = __webpack_require__(11)('model'),
	    CollectionRegistry = __webpack_require__(9).CollectionRegistry,
	    InternalSiestaError = __webpack_require__(8).InternalSiestaError,
	    RelationshipType = __webpack_require__(18),
	    Query = __webpack_require__(19),
	    MappingOperation = __webpack_require__(27),
	    ModelInstance = __webpack_require__(21),
	    util = __webpack_require__(4),
	    cache = __webpack_require__(20),
	    argsarray = __webpack_require__(7),
	    error = __webpack_require__(8),
	    extend = __webpack_require__(28),
	    modelEvents = __webpack_require__(22),
	    Condition = __webpack_require__(29),
	    events = __webpack_require__(23),
	    Placeholder = __webpack_require__(30),
	    ReactiveQuery = __webpack_require__(31),
	    InstanceFactory = __webpack_require__(32);
	
	/**
	 *
	 * @param {Object} opts
	 */
	function Model(opts) {
	  var self = this;
	  this._opts = opts ? util.extend({}, opts) : {};
	
	  util.extendFromOpts(this, opts, {
	    methods: {},
	    attributes: [],
	    collection: function collection(c) {
	      if (util.isString(c)) {
	        c = CollectionRegistry[c];
	      }
	      return c;
	    },
	    id: 'id',
	    relationships: [],
	    name: null,
	    indexes: [],
	    singleton: false,
	    statics: this.installStatics.bind(this),
	    properties: {},
	    init: null,
	    serialise: null,
	    serialiseField: null,
	    serialisableFields: null,
	    remove: null,
	    parseAttribute: null
	  }, false);
	
	  if (!this.parseAttribute) {
	    this.parseAttribute = function (attrName, value) {
	      return value;
	    };
	  }
	
	  this.attributes = Model._processAttributes(this.attributes);
	
	  this._factory = new InstanceFactory(this);
	  this._instance = this._factory._instance.bind(this._factory);
	
	  util.extend(this, {
	    _relationshipsInstalled: false,
	    _reverseRelationshipsInstalled: false,
	    children: []
	  });
	
	  Object.defineProperties(this, {
	    _relationshipNames: {
	      get: function get() {
	        return Object.keys(self.relationships);
	      },
	      enumerable: true
	    },
	    _attributeNames: {
	      get: function get() {
	        var names = [];
	        if (self.id) {
	          names.push(self.id);
	        }
	        self.attributes.forEach(function (x) {
	          names.push(x.name);
	        });
	        return names;
	      },
	      enumerable: true,
	      configurable: true
	    },
	    installed: {
	      get: function get() {
	        return self._relationshipsInstalled && self._reverseRelationshipsInstalled;
	      },
	      enumerable: true,
	      configurable: true
	    },
	    descendants: {
	      get: function get() {
	        return self.children.reduce(function (memo, descendant) {
	          return Array.prototype.concat.call(memo, descendant.descendants);
	        }.bind(self), util.extend([], self.children));
	      },
	      enumerable: true
	    },
	    collectionName: {
	      get: function get() {
	        return this.collection.name;
	      },
	      enumerable: true
	    }
	  });
	  var globalEventName = this.collectionName + ':' + this.name,
	      proxied = {
	    query: this.query.bind(this)
	  };
	
	  events.ProxyEventEmitter.call(this, globalEventName, proxied);
	
	  this._indexIsInstalled = new Condition(function (done) {
	    done();
	  }.bind(this));
	}
	
	util.extend(Model, {
	  /**
	   * Normalise attributes passed via the options dictionary.
	   * @param attributes
	   * @returns {Array}
	   * @private
	   */
	  _processAttributes: function _processAttributes(attributes) {
	    return attributes.reduce(function (m, a) {
	      if (typeof a == 'string') {
	        m.push({
	          name: a
	        });
	      } else {
	        m.push(a);
	      }
	      return m;
	    }, []);
	  }
	
	});
	
	Model.prototype = Object.create(events.ProxyEventEmitter.prototype);
	
	util.extend(Model.prototype, {
	  installStatics: function installStatics(statics) {
	    if (statics) {
	      Object.keys(statics).forEach(function (staticName) {
	        if (this[staticName]) {
	          log('Static method with name "' + staticName + '" already exists. Ignoring it.');
	        } else {
	          this[staticName] = statics[staticName].bind(this);
	        }
	      }.bind(this));
	    }
	    return statics;
	  },
	  _validateRelationshipType: function _validateRelationshipType(relationship) {
	    if (!relationship.type) {
	      if (this.singleton) relationship.type = RelationshipType.OneToOne;else relationship.type = RelationshipType.OneToMany;
	    }
	    if (this.singleton && relationship.type == RelationshipType.ManyToMany) {
	      return 'Singleton model cannot use ManyToMany relationship.';
	    }
	    if (Object.keys(RelationshipType).indexOf(relationship.type) < 0) return 'Relationship type ' + relationship.type + ' does not exist';
	    return null;
	  },
	  _getReverseModel: function _getReverseModel(reverseName) {
	    var reverseModel;
	    if (reverseName instanceof Model) reverseModel = reverseName;else reverseModel = this.collection[reverseName];
	    if (!reverseModel) {
	      // May have used Collection.Model format.
	      var arr = reverseName.split('.');
	      if (arr.length == 2) {
	        var collectionName = arr[0];
	        reverseName = arr[1];
	        var otherCollection = CollectionRegistry[collectionName];
	        if (otherCollection) reverseModel = otherCollection[reverseName];
	      }
	    }
	    return reverseModel;
	  },
	  /**
	   * Return the reverse model or a placeholder that will be resolved later.
	   * @param forwardName
	   * @param reverseName
	   * @returns {*}
	   * @private
	   */
	  _getReverseModelOrPlaceholder: function _getReverseModelOrPlaceholder(forwardName, reverseName) {
	    var reverseModel = this._getReverseModel(reverseName);
	    return reverseModel || new Placeholder({ name: reverseName, ref: this, forwardName: forwardName });
	  },
	  /**
	   * Install relationships. Returns error in form of string if fails.
	   * @return {String|null}
	   */
	  installRelationships: function installRelationships() {
	    if (!this._relationshipsInstalled) {
	      var err = null;
	      for (var name in this._opts.relationships) {
	        if (this._opts.relationships.hasOwnProperty(name)) {
	          var relationship = this._opts.relationships[name];
	          // If a reverse relationship is installed beforehand, we do not want to process them.
	          var isForward = !relationship.isReverse;
	          if (isForward) {
	            log(this.name + ': configuring relationship ' + name, relationship);
	            if (!(err = this._validateRelationshipType(relationship))) {
	              var reverseModelName = relationship.model;
	              if (reverseModelName) {
	                var reverseModel = this._getReverseModelOrPlaceholder(name, reverseModelName);
	                util.extend(relationship, {
	                  reverseModel: reverseModel,
	                  forwardModel: this,
	                  forwardName: name,
	                  reverseName: relationship.reverse || 'reverse_' + name,
	                  isReverse: false
	                });
	                delete relationship.model;
	                delete relationship.reverse;
	              } else return 'Must pass model';
	            }
	          }
	        }
	      }
	    } else {
	      throw new InternalSiestaError('Relationships for "' + this.name + '" have already been installed');
	    }
	    if (!err) this._relationshipsInstalled = true;
	    return err;
	  },
	  _installReverse: function _installReverse(relationship) {
	    var reverseModel = relationship.reverseModel;
	    var isPlaceholder = reverseModel.isPlaceholder;
	    if (isPlaceholder) {
	      var modelName = relationship.reverseModel.name;
	      reverseModel = this._getReverseModel(modelName);
	      if (reverseModel) {
	        relationship.reverseModel = reverseModel;
	      }
	    }
	    if (reverseModel) {
	      var err;
	      var reverseName = relationship.reverseName,
	          forwardModel = relationship.forwardModel;
	
	      if (reverseModel != this || reverseModel == forwardModel) {
	        if (reverseModel.singleton) {
	          if (relationship.type == RelationshipType.ManyToMany) err = 'Singleton model cannot be related via reverse ManyToMany';
	          if (relationship.type == RelationshipType.OneToMany) err = 'Singleton model cannot be related via reverse OneToMany';
	        }
	        if (!err) {
	          log(this.name + ': configuring  reverse relationship ' + reverseName);
	          if (reverseModel.relationships[reverseName]) {
	            // We are ok to redefine reverse relationships whereby the models are in the same hierarchy
	            var isAncestorModel = reverseModel.relationships[reverseName].forwardModel.isAncestorOf(this);
	            var isDescendentModel = reverseModel.relationships[reverseName].forwardModel.isDescendantOf(this);
	            if (!isAncestorModel && !isDescendentModel) {
	              err = 'Reverse relationship "' + reverseName + '" already exists on model "' + reverseModel.name + '"';
	            }
	          }
	          if (!err) {
	            reverseModel.relationships[reverseName] = relationship;
	          }
	        }
	      }
	      if (isPlaceholder) {
	        var existingReverseInstances = (cache._localCacheByType[reverseModel.collectionName] || {})[reverseModel.name] || {};
	        Object.keys(existingReverseInstances).forEach(function (localId) {
	          var instancce = existingReverseInstances[localId];
	          var r = util.extend({}, relationship);
	          r.isReverse = true;
	          this._factory._installRelationship(r, instancce);
	        }.bind(this));
	      }
	    }
	    return err;
	  },
	  /**
	   * Cycle through relationships and replace any placeholders with the actual models where possible.
	   */
	  _installReversePlaceholders: function _installReversePlaceholders() {
	    for (var forwardName in this.relationships) {
	      if (this.relationships.hasOwnProperty(forwardName)) {
	        var relationship = this.relationships[forwardName];
	        if (relationship.reverseModel.isPlaceholder) this._installReverse(relationship);
	      }
	    }
	  },
	  installReverseRelationships: function installReverseRelationships() {
	    if (!this._reverseRelationshipsInstalled) {
	      for (var forwardName in this.relationships) {
	        if (this.relationships.hasOwnProperty(forwardName)) {
	          var relationship = this.relationships[forwardName];
	          relationship = extend(true, {}, relationship);
	          relationship.isReverse = true;
	          var err = this._installReverse(relationship);
	        }
	      }
	      this._reverseRelationshipsInstalled = true;
	    } else {
	      throw new InternalSiestaError('Reverse relationships for "' + this.name + '" have already been installed.');
	    }
	    return err;
	  },
	  _query: function _query(query) {
	    return new Query(this, query || {});
	  },
	  query: function query(_query2, cb) {
	    var queryInstance;
	    var promise = util.promise(cb, function (cb) {
	      if (!this.singleton) {
	        queryInstance = this._query(_query2);
	        return queryInstance.execute(cb);
	      } else {
	        queryInstance = this._query({ __ignoreInstalled: true });
	        queryInstance.execute(function (err, objs) {
	          if (err) cb(err);else {
	            // Cache a new singleton and then reexecute the query
	            _query2 = util.extend({}, _query2);
	            _query2.__ignoreInstalled = true;
	            if (!objs.length) {
	              this.graph({}, function (err) {
	                if (!err) {
	                  queryInstance = this._query(_query2);
	                  queryInstance.execute(cb);
	                } else {
	                  cb(err);
	                }
	              }.bind(this));
	            } else {
	              queryInstance = this._query(_query2);
	              queryInstance.execute(cb);
	            }
	          }
	        }.bind(this));
	      }
	    }.bind(this));
	
	    // By wrapping the promise in another promise we can push the invocations to the bottom of the event loop so that
	    // any event handlers added to the chain are honoured straight away.
	    var linkPromise = new util.Promise(function (resolve, reject) {
	      promise.then(argsarray(function (args) {
	        setImmediate(function () {
	          resolve.apply(null, args);
	        });
	      }), argsarray(function (args) {
	        setImmediate(function () {
	          reject.apply(null, args);
	        });
	      }));
	    });
	
	    return this._link({
	      then: linkPromise.then.bind(linkPromise),
	      catch: linkPromise.catch.bind(linkPromise),
	      on: argsarray(function (args) {
	        var rq = new ReactiveQuery(this._query(_query2));
	        rq.init();
	        rq.on.apply(rq, args);
	      }.bind(this))
	    });
	  },
	  /**
	   * Only used in testing at the moment.
	   * @param query
	   * @returns {ReactiveQuery}
	   */
	  _reactiveQuery: function _reactiveQuery(query) {
	    return new ReactiveQuery(new Query(this, query || {}));
	  },
	  one: function one(opts, cb) {
	    if (typeof opts == 'function') {
	      cb = opts;
	      opts = {};
	    }
	    return util.promise(cb, function (cb) {
	      this.query(opts, function (err, res) {
	        if (err) cb(err);else {
	          if (res.length > 1) {
	            cb(error('More than one instance returned when executing get query!'));
	          } else {
	            res = res.length ? res[0] : null;
	            cb(null, res);
	          }
	        }
	      });
	    }.bind(this));
	  },
	  all: function all(q, cb) {
	    if (typeof q == 'function') {
	      cb = q;
	      q = {};
	    }
	    q = q || {};
	    var query = {};
	    if (q.__order) query.__order = q.__order;
	    return this.query(q, cb);
	  },
	  _attributeDefinitionWithName: function _attributeDefinitionWithName(name) {
	    for (var i = 0; i < this.attributes.length; i++) {
	      var attributeDefinition = this.attributes[i];
	      if (attributeDefinition.name == name) return attributeDefinition;
	    }
	  },
	  /**
	   * Map data into Siesta.
	   *
	   * @param data Raw data received remotely or otherwise
	   * @param {function|object} [opts]
	   * @param {boolean} opts.override
	   * @param {boolean} opts._ignoreInstalled - A hack that allows mapping onto Models even if install process has not finished.
	   * @param {function} [cb] Called once pouch persistence returns.
	   */
	  graph: function graph(data, opts, cb) {
	    if (typeof opts == 'function') cb = opts;
	    opts = opts || {};
	    return util.promise(cb, function (cb) {
	      var _map = function () {
	        var overrides = opts.override;
	        if (overrides) {
	          if (util.isArray(overrides)) opts.objects = overrides;else opts.objects = [overrides];
	        }
	        delete opts.override;
	        if (util.isArray(data)) {
	          this._mapBulk(data, opts, cb);
	        } else {
	          this._mapBulk([data], opts, function (err, objects) {
	            var obj;
	            if (objects) {
	              if (objects.length) {
	                obj = objects[0];
	              }
	            }
	            err = err ? util.isArray(data) ? err : util.isArray(err) ? err[0] : err : null;
	            cb(err, obj);
	          });
	        }
	      }.bind(this);
	      if (opts._ignoreInstalled) {
	        _map();
	      } else siesta._afterInstall(_map);
	    }.bind(this));
	  },
	  _mapBulk: function _mapBulk(data, opts, callback) {
	    util.extend(opts, { model: this, data: data });
	    var op = new MappingOperation(opts);
	    op.start(function (err, objects) {
	      if (err) {
	        if (callback) callback(err);
	      } else {
	        callback(null, objects || []);
	      }
	    });
	  },
	  _countCache: function _countCache() {
	    var collCache = cache._localCacheByType[this.collectionName] || {};
	    var modelCache = collCache[this.name] || {};
	    return Object.keys(modelCache).reduce(function (m, localId) {
	      m[localId] = {};
	      return m;
	    }, {});
	  },
	  count: function count(cb) {
	    return util.promise(cb, function (cb) {
	      cb(null, Object.keys(this._countCache()).length);
	    }.bind(this));
	  },
	  _dump: function _dump(asJSON) {
	    var dumped = {};
	    dumped.name = this.name;
	    dumped.attributes = this.attributes;
	    dumped.id = this.id;
	    dumped.collection = this.collectionName;
	    dumped.relationships = this.relationships.map(function (r) {
	      return r.isForward ? r.forwardName : r.reverseName;
	    });
	    return asJSON ? util.prettyPrint(dumped) : dumped;
	  },
	  toString: function toString() {
	    return 'Model[' + this.name + ']';
	  },
	  removeAll: function removeAll(cb) {
	    return util.promise(cb, function (cb) {
	      this.all().then(function (instances) {
	        instances.remove();
	        cb();
	      }).catch(cb);
	    }.bind(this));
	  }
	
	});
	
	// Subclassing
	util.extend(Model.prototype, {
	  child: function child(nameOrOpts, opts) {
	    if (typeof nameOrOpts == 'string') {
	      opts.name = nameOrOpts;
	    } else {
	      opts = name;
	    }
	    util.extend(opts, {
	      attributes: Array.prototype.concat.call(opts.attributes || [], this._opts.attributes),
	      relationships: util.extend(opts.relationships || {}, this._opts.relationships),
	      methods: util.extend(util.extend({}, this._opts.methods) || {}, opts.methods),
	      statics: util.extend(util.extend({}, this._opts.statics) || {}, opts.statics),
	      properties: util.extend(util.extend({}, this._opts.properties) || {}, opts.properties),
	      id: opts.id || this._opts.id,
	      init: opts.init || this._opts.init,
	      remove: opts.remove || this._opts.remove,
	      serialise: opts.serialise || this._opts.serialise,
	      serialiseField: opts.serialiseField || this._opts.serialiseField,
	      parseAttribute: opts.parseAttribute || this._opts.parseAttribute
	    });
	
	    if (this._opts.serialisableFields) {
	      opts.serialisableFields = Array.prototype.concat.apply(opts.serialisableFields || [], this._opts.serialisableFields);
	    }
	
	    var model = this.collection.model(opts.name, opts);
	    model.parent = this;
	    this.children.push(model);
	    return model;
	  },
	  isChildOf: function isChildOf(parent) {
	    return this.parent == parent;
	  },
	  isParentOf: function isParentOf(child) {
	    return this.children.indexOf(child) > -1;
	  },
	  isDescendantOf: function isDescendantOf(ancestor) {
	    var parent = this.parent;
	    while (parent) {
	      if (parent == ancestor) return true;
	      parent = parent.parent;
	    }
	    return false;
	  },
	  isAncestorOf: function isAncestorOf(descendant) {
	    return this.descendants.indexOf(descendant) > -1;
	  },
	  hasAttributeNamed: function hasAttributeNamed(attributeName) {
	    return this._attributeNames.indexOf(attributeName) > -1;
	  }
	});
	
	module.exports = Model;
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(16).setImmediate))

/***/ },
/* 16 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(setImmediate, clearImmediate) {var nextTick = __webpack_require__(17).nextTick;
	var apply = Function.prototype.apply;
	var slice = Array.prototype.slice;
	var immediateIds = {};
	var nextImmediateId = 0;
	
	// DOM APIs, for completeness
	
	exports.setTimeout = function() {
	  return new Timeout(apply.call(setTimeout, window, arguments), clearTimeout);
	};
	exports.setInterval = function() {
	  return new Timeout(apply.call(setInterval, window, arguments), clearInterval);
	};
	exports.clearTimeout =
	exports.clearInterval = function(timeout) { timeout.close(); };
	
	function Timeout(id, clearFn) {
	  this._id = id;
	  this._clearFn = clearFn;
	}
	Timeout.prototype.unref = Timeout.prototype.ref = function() {};
	Timeout.prototype.close = function() {
	  this._clearFn.call(window, this._id);
	};
	
	// Does not start the time, just sets up the members needed.
	exports.enroll = function(item, msecs) {
	  clearTimeout(item._idleTimeoutId);
	  item._idleTimeout = msecs;
	};
	
	exports.unenroll = function(item) {
	  clearTimeout(item._idleTimeoutId);
	  item._idleTimeout = -1;
	};
	
	exports._unrefActive = exports.active = function(item) {
	  clearTimeout(item._idleTimeoutId);
	
	  var msecs = item._idleTimeout;
	  if (msecs >= 0) {
	    item._idleTimeoutId = setTimeout(function onTimeout() {
	      if (item._onTimeout)
	        item._onTimeout();
	    }, msecs);
	  }
	};
	
	// That's not how node.js implements it but the exposed api is the same.
	exports.setImmediate = typeof setImmediate === "function" ? setImmediate : function(fn) {
	  var id = nextImmediateId++;
	  var args = arguments.length < 2 ? false : slice.call(arguments, 1);
	
	  immediateIds[id] = true;
	
	  nextTick(function onNextTick() {
	    if (immediateIds[id]) {
	      // fn.call() is faster so we optimize for the common use-case
	      // @see http://jsperf.com/call-apply-segu
	      if (args) {
	        fn.apply(null, args);
	      } else {
	        fn.call(null);
	      }
	      // Prevent ids from leaking
	      exports.clearImmediate(id);
	    }
	  });
	
	  return id;
	};
	
	exports.clearImmediate = typeof clearImmediate === "function" ? clearImmediate : function(id) {
	  delete immediateIds[id];
	};
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(16).setImmediate, __webpack_require__(16).clearImmediate))

/***/ },
/* 17 */
/***/ function(module, exports) {

	// shim for using process in browser
	
	var process = module.exports = {};
	var queue = [];
	var draining = false;
	var currentQueue;
	var queueIndex = -1;
	
	function cleanUpNextTick() {
	    draining = false;
	    if (currentQueue.length) {
	        queue = currentQueue.concat(queue);
	    } else {
	        queueIndex = -1;
	    }
	    if (queue.length) {
	        drainQueue();
	    }
	}
	
	function drainQueue() {
	    if (draining) {
	        return;
	    }
	    var timeout = setTimeout(cleanUpNextTick);
	    draining = true;
	
	    var len = queue.length;
	    while(len) {
	        currentQueue = queue;
	        queue = [];
	        while (++queueIndex < len) {
	            if (currentQueue) {
	                currentQueue[queueIndex].run();
	            }
	        }
	        queueIndex = -1;
	        len = queue.length;
	    }
	    currentQueue = null;
	    draining = false;
	    clearTimeout(timeout);
	}
	
	process.nextTick = function (fun) {
	    var args = new Array(arguments.length - 1);
	    if (arguments.length > 1) {
	        for (var i = 1; i < arguments.length; i++) {
	            args[i - 1] = arguments[i];
	        }
	    }
	    queue.push(new Item(fun, args));
	    if (queue.length === 1 && !draining) {
	        setTimeout(drainQueue, 0);
	    }
	};
	
	// v8 likes predictible objects
	function Item(fun, array) {
	    this.fun = fun;
	    this.array = array;
	}
	Item.prototype.run = function () {
	    this.fun.apply(null, this.array);
	};
	process.title = 'browser';
	process.browser = true;
	process.env = {};
	process.argv = [];
	process.version = ''; // empty string to avoid regexp issues
	process.versions = {};
	
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
	};
	
	process.cwd = function () { return '/' };
	process.chdir = function (dir) {
	    throw new Error('process.chdir is not supported');
	};
	process.umask = function() { return 0; };


/***/ },
/* 18 */
/***/ function(module, exports) {

	'use strict';
	
	module.exports = {
	  OneToMany: 'OneToMany',
	  OneToOne: 'OneToOne',
	  ManyToMany: 'ManyToMany'
	};

/***/ },
/* 19 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	var log = __webpack_require__(11)('query'),
	    cache = __webpack_require__(20),
	    util = __webpack_require__(4),
	    error = __webpack_require__(8),
	    ModelInstance = __webpack_require__(21),
	    constructQuerySet = __webpack_require__(26);
	
	/**
	 * @class [Query description]
	 * @param {Model} model
	 * @param {Object} query
	 */
	function Query(model, query) {
	  var opts = {};
	  for (var prop in query) {
	    if (query.hasOwnProperty(prop)) {
	      if (prop.slice(0, 2) == '__') {
	        opts[prop.slice(2)] = query[prop];
	        delete query[prop];
	      }
	    }
	  }
	  util.extend(this, {
	    model: model,
	    query: query,
	    opts: opts
	  });
	  opts.order = opts.order || [];
	  if (!util.isArray(opts.order)) opts.order = [opts.order];
	}
	
	function valueAsString(fieldValue) {
	  var fieldAsString;
	  if (fieldValue === null) fieldAsString = 'null';else if (fieldValue === undefined) fieldAsString = 'undefined';else if (fieldValue instanceof ModelInstance) fieldAsString = fieldValue.localId;else fieldAsString = fieldValue.toString();
	  return fieldAsString;
	}
	
	function contains(opts) {
	  if (!opts.invalid) {
	    var obj = opts.object;
	    if (util.isArray(obj)) {
	      arr = util.pluck(obj, opts.field);
	    } else var arr = obj[opts.field];
	    if (util.isArray(arr) || util.isString(arr)) {
	      return arr.indexOf(opts.value) > -1;
	    }
	  }
	  return false;
	}
	
	var comparators = {
	  e: function e(opts) {
	    var fieldValue = opts.object[opts.field];
	    if (log.enabled) {
	      log(opts.field + ': ' + valueAsString(fieldValue) + ' == ' + valueAsString(opts.value), { opts: opts });
	    }
	    return fieldValue == opts.value;
	  },
	  lt: function lt(opts) {
	    if (!opts.invalid) return opts.object[opts.field] < opts.value;
	    return false;
	  },
	  gt: function gt(opts) {
	    if (!opts.invalid) return opts.object[opts.field] > opts.value;
	    return false;
	  },
	  lte: function lte(opts) {
	    if (!opts.invalid) return opts.object[opts.field] <= opts.value;
	    return false;
	  },
	  gte: function gte(opts) {
	    if (!opts.invalid) return opts.object[opts.field] >= opts.value;
	    return false;
	  },
	  contains: contains,
	  in: contains
	};
	
	util.extend(Query, {
	  comparators: comparators,
	  registerComparator: function registerComparator(symbol, fn) {
	    if (!comparators[symbol]) {
	      comparators[symbol] = fn;
	    }
	  }
	});
	
	function cacheForModel(model) {
	  var cacheByType = cache._localCacheByType;
	  var modelName = model.name;
	  var collectionName = model.collectionName;
	  var cacheByModel = cacheByType[collectionName];
	  var cacheByLocalId;
	  if (cacheByModel) {
	    cacheByLocalId = cacheByModel[modelName] || {};
	  }
	  return cacheByLocalId;
	}
	
	util.extend(Query.prototype, {
	  execute: function execute(cb) {
	    return util.promise(cb, function (cb) {
	      this._executeInMemory(cb);
	    }.bind(this));
	  },
	  _dump: function _dump(asJson) {
	    return asJson ? '{}' : {};
	  },
	  sortFunc: function sortFunc(fields) {
	    var sortFunc = function sortFunc(ascending, field) {
	      return function (v1, v2) {
	        var d1 = v1[field],
	            d2 = v2[field],
	            res;
	        if (typeof d1 == 'string' || d1 instanceof String && typeof d2 == 'string' || d2 instanceof String) {
	          res = ascending ? d1.localeCompare(d2) : d2.localeCompare(d1);
	        } else {
	          if (d1 instanceof Date) d1 = d1.getTime();
	          if (d2 instanceof Date) d2 = d2.getTime();
	          if (ascending) res = d1 - d2;else res = d2 - d1;
	        }
	        return res;
	      };
	    };
	    var s = util;
	    for (var i = 0; i < fields.length; i++) {
	      var field = fields[i];
	      s = s.thenBy(sortFunc(field.ascending, field.field));
	    }
	    return s == util ? null : s;
	  },
	  _sortResults: function _sortResults(res) {
	    var order = this.opts.order;
	    if (res && order) {
	      var fields = order.map(function (ordering) {
	        var splt = ordering.split('-'),
	            ascending = true,
	            field = null;
	        if (splt.length > 1) {
	          field = splt[1];
	          ascending = false;
	        } else {
	          field = splt[0];
	        }
	        return { field: field, ascending: ascending };
	      }.bind(this));
	      var sortFunc = this.sortFunc(fields);
	      if (res.immutable) res = res.mutableCopy();
	      if (sortFunc) res.sort(sortFunc);
	    }
	    return res;
	  },
	  /**
	   * Return all model instances in the cache.
	   * @private
	   */
	  _getCacheByLocalId: function _getCacheByLocalId() {
	    return this.model.descendants.reduce(function (memo, childModel) {
	      return util.extend(memo, cacheForModel(childModel));
	    }, util.extend({}, cacheForModel(this.model)));
	  },
	  _executeInMemory: function _executeInMemory(callback) {
	    var _executeInMemory = function () {
	      this.model._indexIsInstalled.then(function () {
	        var cacheByLocalId = this._getCacheByLocalId();
	        var keys = Object.keys(cacheByLocalId);
	        var self = this;
	        var res = [];
	        var err;
	        for (var i = 0; i < keys.length; i++) {
	          var k = keys[i];
	          var obj = cacheByLocalId[k];
	          var matches = self.objectMatchesQuery(obj);
	          if (typeof matches == 'string') {
	            err = error(matches);
	            break;
	          } else {
	            if (matches) res.push(obj);
	          }
	        }
	        res = this._sortResults(res);
	        if (err) log('Error executing query', err);
	        callback(err, err ? null : constructQuerySet(res, this.model));
	      }.bind(this)).catch(function (err) {
	        var _err = 'Unable to execute query due to failed index installation on Model "' + this.model.name + '"';
	        console.error(_err, err);
	        callback(_err);
	      }.bind(this));
	    }.bind(this);
	    if (this.opts.ignoreInstalled) {
	      _executeInMemory();
	    } else {
	      siesta._afterInstall(_executeInMemory);
	    }
	  },
	  clearOrdering: function clearOrdering() {
	    this.opts.order = null;
	  },
	  objectMatchesOrQuery: function objectMatchesOrQuery(obj, orQuery) {
	    for (var idx in orQuery) {
	      if (orQuery.hasOwnProperty(idx)) {
	        var query = orQuery[idx];
	        if (this.objectMatchesBaseQuery(obj, query)) {
	          return true;
	        }
	      }
	    }
	    return false;
	  },
	  objectMatchesAndQuery: function objectMatchesAndQuery(obj, andQuery) {
	    for (var idx in andQuery) {
	      if (andQuery.hasOwnProperty(idx)) {
	        var query = andQuery[idx];
	        if (!this.objectMatchesBaseQuery(obj, query)) {
	          return false;
	        }
	      }
	    }
	    return true;
	  },
	  splitMatches: function splitMatches(obj, unprocessedField, value) {
	    var op = 'e';
	    var fields = unprocessedField.split('.');
	    var splt = fields[fields.length - 1].split('__');
	    if (splt.length == 2) {
	      var field = splt[0];
	      op = splt[1];
	    } else {
	      field = splt[0];
	    }
	    fields[fields.length - 1] = field;
	    fields.slice(0, fields.length - 1).forEach(function (f) {
	      if (util.isArray(obj)) {
	        obj = util.pluck(obj, f);
	      } else {
	        obj = obj[f];
	      }
	    });
	    // If we get to the point where we're about to index null or undefined we stop - obviously this object does
	    // not match the query.
	    var notNullOrUndefined = obj != undefined;
	    if (notNullOrUndefined) {
	      if (util.isArray(obj)) {} else {
	        var val = obj[field];
	        var invalid = util.isArray(val) ? false : val === null || val === undefined;
	      }
	      var comparator = Query.comparators[op],
	          opts = { object: obj, field: field, value: value, invalid: invalid };
	      if (!comparator) {
	        return 'No comparator registered for query operation "' + op + '"';
	      }
	      return comparator(opts);
	    }
	    return false;
	  },
	  objectMatches: function objectMatches(obj, unprocessedField, value, query) {
	    if (unprocessedField == '$or') {
	      var $or = query['$or'];
	      if (!util.isArray($or)) {
	        $or = Object.keys($or).map(function (k) {
	          var normalised = {};
	          normalised[k] = $or[k];
	          return normalised;
	        });
	      }
	      if (!this.objectMatchesOrQuery(obj, $or)) return false;
	    } else if (unprocessedField == '$and') {
	      if (!this.objectMatchesAndQuery(obj, query['$and'])) return false;
	    } else {
	      var matches = this.splitMatches(obj, unprocessedField, value);
	      if (typeof matches != 'boolean') return matches;
	      if (!matches) return false;
	    }
	    return true;
	  },
	  objectMatchesBaseQuery: function objectMatchesBaseQuery(obj, query) {
	    var fields = Object.keys(query);
	    for (var i = 0; i < fields.length; i++) {
	      var unprocessedField = fields[i],
	          value = query[unprocessedField];
	      var rt = this.objectMatches(obj, unprocessedField, value, query);
	      if (typeof rt != 'boolean') return rt;
	      if (!rt) return false;
	    }
	    return true;
	  },
	  objectMatchesQuery: function objectMatchesQuery(obj) {
	    return this.objectMatchesBaseQuery(obj, this.query);
	  }
	});
	
	module.exports = Query;

/***/ },
/* 20 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	/**
	 * This is an in-memory cache for models. Models are cached by local id (_id) and remote id (defined by the mapping).
	 * Lookups are performed against the cache when mapping.
	 * @module cache
	 */
	var log = __webpack_require__(11)('cache'),
	    InternalSiestaError = __webpack_require__(8).InternalSiestaError,
	    util = __webpack_require__(4);
	
	function Cache() {
	  this.reset();
	  Object.defineProperty(this, '_localCacheByType', {
	    get: function get() {
	      return this.local;
	    }
	  });
	}
	
	Cache.prototype = {
	  reset: function reset() {
	    this.remote = {};
	    this.localById = {};
	    this.local = {};
	  },
	  /**
	   * Return the object in the cache given a local id (_id)
	   * @param  {String|Array} localId
	   * @return {ModelInstance}
	   */
	  getViaLocalId: function getViaLocalId(localId) {
	    if (util.isArray(localId)) return localId.map(function (x) {
	      return this.localById[x];
	    }.bind(this));else return this.localById[localId];
	  },
	  /**
	   * Given a remote identifier and an options object that describes mapping/collection,
	   * return the model if cached.
	   * @param  {String|Array} remoteId
	   * @param  {Object} opts
	   * @param  {Object} opts.model
	   * @return {ModelInstance}
	   */
	  getViaRemoteId: function getViaRemoteId(remoteId, opts) {
	    var c = (this.remote[opts.model.collectionName] || {})[opts.model.name] || {};
	    return util.isArray(remoteId) ? remoteId.map(function (x) {
	      return c[x];
	    }) : c[remoteId];
	  },
	  /**
	   * Return the singleton object given a singleton model.
	   * @param  {Model} model
	   * @return {ModelInstance}
	   */
	  getSingleton: function getSingleton(model) {
	    var modelName = model.name;
	    var collectionName = model.collectionName;
	    var collectionCache = this.local[collectionName];
	    if (collectionCache) {
	      var typeCache = collectionCache[modelName];
	      if (typeCache) {
	        var objs = [];
	        for (var prop in typeCache) {
	          if (typeCache.hasOwnProperty(prop)) {
	            objs.push(typeCache[prop]);
	          }
	        }
	        if (objs.length > 1) {
	          var errStr = 'A singleton model has more than 1 object in the cache! This is a serious error. ' + 'Either a model has been modified after objects have already been created, or something has gone' + 'very wrong. Please file a bug report if the latter.';
	          throw new InternalSiestaError(errStr);
	        } else if (objs.length) {
	          return objs[0];
	        }
	      }
	    }
	    return null;
	  },
	  /**
	   * Insert an object into the cache using a remote identifier defined by the mapping.
	   * @param  {ModelInstance} obj
	   * @param  {String} remoteId
	   * @param  {String} [previousRemoteId] If remote id has been changed, this is the old remote identifier
	   */
	  remoteInsert: function remoteInsert(obj, remoteId, previousRemoteId) {
	    if (obj) {
	      var collectionName = obj.model.collectionName;
	      if (collectionName) {
	        if (!this.remote[collectionName]) {
	          this.remote[collectionName] = {};
	        }
	        var type = obj.model.name;
	        if (type) {
	          if (!this.remote[collectionName][type]) {
	            this.remote[collectionName][type] = {};
	          }
	          if (previousRemoteId) {
	            this.remote[collectionName][type][previousRemoteId] = null;
	          }
	          var cachedObject = this.remote[collectionName][type][remoteId];
	          if (!cachedObject) {
	            this.remote[collectionName][type][remoteId] = obj;
	            log('Remote cache insert: ' + obj._dump(true));
	          } else {
	            // Something has gone really wrong. Only one object for a particular collection/type/remoteid combo
	            // should ever exist.
	            if (obj != cachedObject) {
	              var message = 'Object ' + collectionName.toString() + ':' + type.toString() + '[' + obj.model.id + '="' + remoteId + '"] already exists in the cache.' + ' This is a serious error, please file a bug report if you are experiencing this out in the wild';
	              log(message, {
	                obj: obj,
	                cachedObject: cachedObject
	              });
	              throw new InternalSiestaError(message);
	            }
	          }
	        } else {
	          throw new InternalSiestaError('Model has no type', {
	            model: obj.model,
	            obj: obj
	          });
	        }
	      } else {
	        throw new InternalSiestaError('Model has no collection', {
	          model: obj.model,
	          obj: obj
	        });
	      }
	    } else {
	      var msg = 'Must pass an object when inserting to cache';
	      log(msg);
	      throw new InternalSiestaError(msg);
	    }
	  },
	  /**
	   * Query the cache
	   * @param  {Object} opts Object describing the query
	   * @return {ModelInstance}
	   * @example
	   * ```js
	   * cache.get({_id: '5'}); // Query by local id
	   * cache.get({remoteId: '5', mapping: myMapping}); // Query by remote id
	   * ```
	   */
	  get: function get(opts) {
	    log('get', opts);
	    var obj, idField, remoteId;
	    var localId = opts.localId;
	    if (localId) {
	      obj = this.getViaLocalId(localId);
	      if (obj) {
	        return obj;
	      } else {
	        if (opts.model) {
	          idField = opts.model.id;
	          remoteId = opts[idField];
	          log(idField + '=' + remoteId);
	          return this.getViaRemoteId(remoteId, opts);
	        } else {
	          return null;
	        }
	      }
	    } else if (opts.model) {
	      idField = opts.model.id;
	      remoteId = opts[idField];
	      if (remoteId) {
	        return this.getViaRemoteId(remoteId, opts);
	      } else if (opts.model.singleton) {
	        return this.getSingleton(opts.model);
	      }
	    } else {
	      log('Invalid opts to cache', {
	        opts: opts
	      });
	    }
	    return null;
	  },
	  _remoteCache: function _remoteCache() {
	    return this.remote;
	  },
	  _localCache: function _localCache() {
	    return this.localById;
	  },
	  /**
	   * Insert an object into the cache.
	   * @param  {ModelInstance} obj
	   * @throws {InternalSiestaError} An object with _id/remoteId already exists. Not thrown if same obhect.
	   */
	  insert: function insert(obj) {
	    var localId = obj.localId;
	    if (localId) {
	      var collectionName = obj.model.collectionName;
	      var modelName = obj.model.name;
	      if (!this.localById[localId]) {
	        this.localById[localId] = obj;
	        if (!this.local[collectionName]) this.local[collectionName] = {};
	        if (!this.local[collectionName][modelName]) this.local[collectionName][modelName] = {};
	        this.local[collectionName][modelName][localId] = obj;
	      } else {
	        // Something has gone badly wrong here. Two objects should never exist with the same _id
	        if (this.localById[localId] != obj) {
	          var message = 'Object with localId="' + localId.toString() + '" is already in the cache. ' + 'This is a serious error. Please file a bug report if you are experiencing this out in the wild';
	          log(message);
	          throw new InternalSiestaError(message);
	        }
	      }
	    }
	    var idField = obj.idField;
	    var remoteId = obj[idField];
	    if (remoteId) {
	      this.remoteInsert(obj, remoteId);
	    } else {
	      log('No remote id ("' + idField + '") so wont be placing in the remote cache', obj);
	    }
	  },
	  /**
	   * Returns true if object is in the cache
	   * @param  {ModelInstance} obj
	   * @return {boolean}
	   */
	  contains: function contains(obj) {
	    var q = {
	      localId: obj.localId
	    };
	    var model = obj.model;
	    if (model.id) {
	      if (obj[model.id]) {
	        q.model = model;
	        q[model.id] = obj[model.id];
	      }
	    }
	    return !!this.get(q);
	  },
	
	  /**
	   * Removes the object from the cache (if it's actually in the cache) otherwises throws an error.
	   * @param  {ModelInstance} obj
	   * @throws {InternalSiestaError} If object already in the cache.
	   */
	  remove: function remove(obj) {
	    if (this.contains(obj)) {
	      var collectionName = obj.model.collectionName;
	      var modelName = obj.model.name;
	      var localId = obj.localId;
	      if (!modelName) throw InternalSiestaError('No mapping name');
	      if (!collectionName) throw InternalSiestaError('No collection name');
	      if (!localId) throw InternalSiestaError('No localId');
	      delete this.local[collectionName][modelName][localId];
	      delete this.localById[localId];
	      if (obj.model.id) {
	        var remoteId = obj[obj.model.id];
	        if (remoteId) {
	          delete this.remote[collectionName][modelName][remoteId];
	        }
	      }
	    }
	  },
	
	  count: function count() {
	    return Object.keys(this.localById).length;
	  }
	};
	
	module.exports = new Cache();

/***/ },
/* 21 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };
	
	var log = __webpack_require__(11),
	    util = __webpack_require__(4),
	    error = __webpack_require__(8),
	    modelEvents = __webpack_require__(22),
	    ModelEventType = modelEvents.ModelEventType,
	    events = __webpack_require__(23),
	    cache = __webpack_require__(20);
	
	function ModelInstance(model) {
	  var self = this;
	  this.model = model;
	
	  util.subProperties(this, this.model, ['collection', 'collectionName', '_attributeNames', {
	    name: 'idField',
	    property: 'id'
	  }, {
	    name: 'modelName',
	    property: 'name'
	  }]);
	
	  events.ProxyEventEmitter.call(this);
	
	  Object.defineProperties(this, {
	    _relationshipNames: {
	      get: function get() {
	        var proxies = Object.keys(self.__proxies || {}).map(function (x) {
	          return self.__proxies[x];
	        });
	        return proxies.map(function (p) {
	          if (p.isForward) {
	            return p.forwardName;
	          } else {
	            return p.reverseName;
	          }
	        });
	      },
	      enumerable: true,
	      configurable: true
	    },
	    // This is for ProxyEventEmitter.
	    event: {
	      get: function get() {
	        return this.localId;
	      }
	    }
	  });
	
	  this.removed = false;
	
	  /**
	   * Whether or not events (set, remove etc) are emitted for this model instance.
	   *
	   * This is used as a way of controlling what events are emitted when the model instance is created. E.g. we don't
	   * want to send a metric shit ton of 'set' events if we're newly creating an instance. We only want to send the
	   * 'new' event once constructed.
	   *
	   * This is probably a bit of a hack and should be removed eventually.
	   * @type {boolean}
	   * @private
	   */
	  this._emitEvents = false;
	}
	
	ModelInstance.prototype = Object.create(events.ProxyEventEmitter.prototype);
	
	util.extend(ModelInstance.prototype, {
	  get: function get(cb) {
	    return util.promise(cb, function (cb) {
	      cb(null, this);
	    }.bind(this));
	  },
	  emit: function emit(type, opts) {
	    if ((typeof type === 'undefined' ? 'undefined' : _typeof(type)) == 'object') opts = type;else opts.type = type;
	    opts = opts || {};
	    util.extend(opts, {
	      collection: this.collectionName,
	      model: this.model.name,
	      localId: this.localId,
	      obj: this
	    });
	    modelEvents.emit(opts);
	  },
	  remove: function remove(cb, notification) {
	    _.each(this._relationshipNames, function (name) {
	      if (util.isArray(this[name])) {
	        this[name] = [];
	      } else {
	        this[name] = null;
	      }
	    }.bind(this));
	    notification = notification == null ? true : notification;
	    return util.promise(cb, function (cb) {
	      cache.remove(this);
	      this.removed = true;
	      if (notification) {
	        this.emit(modelEvents.ModelEventType.Remove, {
	          old: this
	        });
	      }
	      var remove = this.model.remove;
	      if (remove) {
	        var paramNames = util.paramNames(remove);
	        if (paramNames.length) {
	          var self = this;
	          remove.call(this, function (err) {
	            cb(err, self);
	          });
	        } else {
	          remove.call(this);
	          cb(null, this);
	        }
	      } else {
	        cb(null, this);
	      }
	    }.bind(this));
	  }
	});
	
	// Inspection
	util.extend(ModelInstance.prototype, {
	  getAttributes: function getAttributes() {
	    return util.extend({}, this.__values);
	  },
	  isInstanceOf: function isInstanceOf(model) {
	    return this.model == model;
	  },
	  isA: function isA(model) {
	    return this.model == model || this.model.isDescendantOf(model);
	  }
	});
	
	// Dump
	util.extend(ModelInstance.prototype, {
	  _dumpString: function _dumpString(reverseRelationships) {
	    return JSON.stringify(this._dump(reverseRelationships, null, 4));
	  },
	  _dump: function _dump(reverseRelationships) {
	    var dumped = util.extend({}, this.__values);
	    dumped._rev = this._rev;
	    dumped.localId = this.localId;
	    return dumped;
	  }
	});
	
	function defaultSerialiser(attrName, value) {
	  return value;
	}
	
	// Serialisation
	util.extend(ModelInstance.prototype, {
	  _defaultSerialise: function _defaultSerialise(opts) {
	    var serialised = {};
	    var includeNullAttributes = opts.includeNullAttributes !== undefined ? opts.includeNullAttributes : true,
	        includeNullRelationships = opts.includeNullRelationships !== undefined ? opts.includeNullRelationships : true;
	    var serialisableFields = this.model.serialisableFields || this._attributeNames.concat.apply(this._attributeNames, this._relationshipNames).concat(this.id);
	    this._attributeNames.forEach(function (attrName) {
	      if (serialisableFields.indexOf(attrName) > -1) {
	        var attrDefinition = this.model._attributeDefinitionWithName(attrName) || {};
	        var serialiser;
	        if (attrDefinition.serialise) serialiser = attrDefinition.serialise.bind(this);else {
	          var serialiseField = this.model.serialiseField || defaultSerialiser;
	          serialiser = serialiseField.bind(this, attrName);
	        }
	        var val = this[attrName];
	        if (val === null) {
	          if (includeNullAttributes) {
	            serialised[attrName] = serialiser(val);
	          }
	        } else if (val !== undefined) {
	          serialised[attrName] = serialiser(val);
	        }
	      }
	    }.bind(this));
	    this._relationshipNames.forEach(function (relName) {
	      if (serialisableFields.indexOf(relName) > -1) {
	        var val = this[relName],
	            rel = this.model.relationships[relName];
	
	        if (rel && !rel.isReverse) {
	          var serialiser;
	          if (rel.serialise) {
	            serialiser = rel.serialise.bind(this);
	          } else {
	            var serialiseField = this.model.serialiseField;
	            if (!serialiseField) {
	              if (util.isArray(val)) val = util.pluck(val, this.model.id);else if (val) val = val[this.model.id];
	            }
	            serialiseField = serialiseField || defaultSerialiser;
	            serialiser = serialiseField.bind(this, relName);
	          }
	          if (val === null) {
	            if (includeNullRelationships) {
	              serialised[relName] = serialiser(val);
	            }
	          } else if (util.isArray(val)) {
	            if (includeNullRelationships && !val.length || val.length) {
	              serialised[relName] = serialiser(val);
	            }
	          } else if (val !== undefined) {
	            serialised[relName] = serialiser(val);
	          }
	        }
	      }
	    }.bind(this));
	    return serialised;
	  },
	  serialise: function serialise(opts) {
	    opts = opts || {};
	    if (!this.model.serialise) return this._defaultSerialise(opts);else return this.model.serialise(this, opts);
	  }
	});
	
	util.extend(ModelInstance.prototype, {
	  /**
	   * Emit an event indicating that this instance has just been created.
	   * @private
	   */
	  _emitNew: function _emitNew() {
	    modelEvents.emit({
	      collection: this.model.collectionName,
	      model: this.model.name,
	      localId: this.localId,
	      new: this,
	      type: ModelEventType.New,
	      obj: this
	    });
	  }
	});
	
	module.exports = ModelInstance;

/***/ },
/* 22 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	var events = __webpack_require__(23),
	    InternalSiestaError = __webpack_require__(8).InternalSiestaError,
	    log = __webpack_require__(11)('events'),
	    extend = __webpack_require__(4).extend,
	    collectionRegistry = __webpack_require__(9).CollectionRegistry;
	
	/**
	 * Constants that describe change events.
	 * Set => A new value is assigned to an attribute/relationship
	 * Splice => All javascript array operations are described as splices.
	 * Delete => Used in the case where objects are removed from an array, but array order is not known in advance.
	 * Remove => Object deletion events
	 * New => Object creation events
	 * @type {Object}
	 */
	var ModelEventType = {
	  Set: 'set',
	  Splice: 'splice',
	  New: 'new',
	  Remove: 'remove'
	};
	
	/**
	 * Represents an individual change.
	 * @param opts
	 * @constructor
	 */
	function ModelEvent(opts) {
	  this._opts = opts || {};
	  Object.keys(opts).forEach(function (k) {
	    this[k] = opts[k];
	  }.bind(this));
	}
	
	ModelEvent.prototype._dump = function (pretty) {
	  var dumped = {};
	  dumped.collection = typeof this.collection == 'string' ? this.collection : this.collection._dump();
	  dumped.model = typeof this.model == 'string' ? this.model : this.model.name;
	  dumped.localId = this.localId;
	  dumped.field = this.field;
	  dumped.type = this.type;
	  if (this.index) dumped.index = this.index;
	  if (this.added) dumped.added = this.added.map(function (x) {
	    return x._dump();
	  });
	  if (this.removed) dumped.removed = this.removed.map(function (x) {
	    return x._dump();
	  });
	  if (this.old) dumped.old = this.old;
	  if (this.new) dumped.new = this.new;
	  return pretty ? util.prettyPrint(dumped) : dumped;
	};
	
	function broadcastEvent(collectionName, modelName, opts) {
	  var genericEvent = 'Siesta',
	      collection = collectionRegistry[collectionName],
	      model = collection[modelName];
	  if (!collection) throw new InternalSiestaError('No such collection "' + collectionName + '"');
	  if (!model) throw new InternalSiestaError('No such model "' + modelName + '"');
	  var shouldEmit = opts.obj._emitEvents;
	  // Don't emit pointless events.
	  if (shouldEmit && 'new' in opts && 'old' in opts) {
	    if (opts.new instanceof Date && opts.old instanceof Date) {
	      shouldEmit = opts.new.getTime() != opts.old.getTime();
	    } else {
	      shouldEmit = opts.new != opts.old;
	    }
	  }
	  if (shouldEmit) {
	    events.emit(genericEvent, opts);
	    if (siesta.installed) {
	      var modelEvent = collectionName + ':' + modelName,
	          localIdEvent = opts.localId;
	      events.emit(collectionName, opts);
	      events.emit(modelEvent, opts);
	      events.emit(localIdEvent, opts);
	    }
	    if (model.id && opts.obj[model.id]) events.emit(collectionName + ':' + modelName + ':' + opts.obj[model.id], opts);
	  }
	}
	
	function validateEventOpts(opts) {
	  if (!opts.model) throw new InternalSiestaError('Must pass a model');
	  if (!opts.collection) throw new InternalSiestaError('Must pass a collection');
	  if (!opts.localId) throw new InternalSiestaError('Must pass a local identifier');
	  if (!opts.obj) throw new InternalSiestaError('Must pass the object');
	}
	
	function emit(opts) {
	  validateEventOpts(opts);
	  var collection = opts.collection;
	  var model = opts.model;
	  var c = new ModelEvent(opts);
	  broadcastEvent(collection, model, c);
	  return c;
	}
	
	extend(exports, {
	  ModelEvent: ModelEvent,
	  emit: emit,
	  validateEventOpts: validateEventOpts,
	  ModelEventType: ModelEventType
	});

/***/ },
/* 23 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };
	
	var EventEmitter = __webpack_require__(24).EventEmitter,
	    ArrayObserver = __webpack_require__(5).ArrayObserver,
	    util = __webpack_require__(4),
	    argsarray = __webpack_require__(7),
	    modelEvents = __webpack_require__(22),
	    Chain = __webpack_require__(25);
	
	var eventEmitter = new EventEmitter();
	eventEmitter.setMaxListeners(100);
	
	/**
	 * Listen to a particular event from the Siesta global EventEmitter.
	 * Manages its own set of listeners.
	 * @constructor
	 */
	function ProxyEventEmitter(event, chainOpts) {
	  util.extend(this, {
	    event: event,
	    listeners: {}
	  });
	  var defaultChainOpts = {};
	
	  defaultChainOpts.on = this.on.bind(this);
	  defaultChainOpts.once = this.once.bind(this);
	
	  Chain.call(this, util.extend(defaultChainOpts, chainOpts || {}));
	}
	
	ProxyEventEmitter.prototype = Object.create(Chain.prototype);
	
	util.extend(ProxyEventEmitter.prototype, {
	  on: function on(type, fn) {
	    if (typeof type == 'function') {
	      fn = type;
	      type = null;
	    } else {
	      if (type.trim() == '*') type = null;
	      var _fn = fn;
	      fn = function fn(e) {
	        e = e || {};
	        if (type) {
	          if (e.type == type) {
	            _fn(e);
	          }
	        } else {
	          _fn(e);
	        }
	      };
	      var listeners = this.listeners;
	      if (type) {
	        if (!listeners[type]) listeners[type] = [];
	        listeners[type].push(fn);
	      }
	    }
	    eventEmitter.on(this.event, fn);
	    return this._handlerLink({
	      fn: fn,
	      type: type,
	      extend: this.proxyChainOpts
	    });
	  },
	  once: function once(type, _fn2) {
	    var event = this.event;
	    if (typeof type == 'function') {
	      _fn2 = type;
	      type = null;
	    } else {
	      if (type.trim() == '*') type = null;
	      var _fn = _fn2;
	      _fn2 = function fn(e) {
	        e = e || {};
	        if (type) {
	          if (e.type == type) {
	            eventEmitter.removeListener(event, _fn2);
	            _fn(e);
	          }
	        } else {
	          _fn(e);
	        }
	      };
	    }
	    if (type) return eventEmitter.on(event, _fn2);else return eventEmitter.once(event, _fn2);
	  },
	  _removeListener: function _removeListener(fn, type) {
	    if (type) {
	      var listeners = this.listeners[type],
	          idx = listeners.indexOf(fn);
	      listeners.splice(idx, 1);
	    }
	    return eventEmitter.removeListener(this.event, fn);
	  },
	  emit: function emit(type, payload) {
	    if ((typeof type === 'undefined' ? 'undefined' : _typeof(type)) == 'object') {
	      payload = type;
	      type = null;
	    } else {
	      payload = payload || {};
	      payload.type = type;
	    }
	    eventEmitter.emit.call(eventEmitter, this.event, payload);
	  },
	  _removeAllListeners: function _removeAllListeners(type) {
	    (this.listeners[type] || []).forEach(function (fn) {
	      eventEmitter.removeListener(this.event, fn);
	    }.bind(this));
	    this.listeners[type] = [];
	  },
	  removeAllListeners: function removeAllListeners(type) {
	    if (type) {
	      this._removeAllListeners(type);
	    } else {
	      for (type in this.listeners) {
	        if (this.listeners.hasOwnProperty(type)) {
	          this._removeAllListeners(type);
	        }
	      }
	    }
	  }
	});
	
	util.extend(eventEmitter, {
	  ProxyEventEmitter: ProxyEventEmitter,
	  wrapArray: function wrapArray(array, field, modelInstance) {
	    if (!array.observer) {
	      array.observer = new ArrayObserver(array);
	      array.observer.open(function (splices) {
	        var fieldIsAttribute = modelInstance._attributeNames.indexOf(field) > -1;
	        if (fieldIsAttribute) {
	          splices.forEach(function (splice) {
	            modelEvents.emit({
	              collection: modelInstance.collectionName,
	              model: modelInstance.model.name,
	              localId: modelInstance.localId,
	              index: splice.index,
	              removed: splice.removed,
	              added: splice.addedCount ? array.slice(splice.index, splice.index + splice.addedCount) : [],
	              type: modelEvents.ModelEventType.Splice,
	              field: field,
	              obj: modelInstance
	            });
	          });
	        }
	      });
	    }
	  }
	});
	
	var oldEmit = eventEmitter.emit;
	
	// Ensure that errors in event handlers do not stall Siesta.
	eventEmitter.emit = function (event, payload) {
	  try {
	    oldEmit.call(eventEmitter, event, payload);
	  } catch (e) {
	    console.error(e);
	  }
	};
	
	module.exports = eventEmitter;

/***/ },
/* 24 */
/***/ function(module, exports) {

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


/***/ },
/* 25 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	var argsarray = __webpack_require__(7);
	
	/**
	 * Class for facilitating "chained" behaviour e.g:
	 *
	 * var cancel = Users
	 *  .on('new', function (user) {
	   *     // ...
	   *   })
	 *  .query({$or: {age__gte: 20, age__lte: 30}})
	 *  .on('*', function (change) {
	   *     // ..
	   *   });
	 *
	 * @param opts
	 * @constructor
	 */
	function Chain(opts) {
	  this.opts = opts;
	}
	
	Chain.prototype = {
	  /**
	   * Construct a link in the chain of calls.
	   * @param opts
	   * @param opts.fn
	   * @param opts.type
	   */
	  _handlerLink: function _handlerLink(opts) {
	    var firstLink;
	    firstLink = function () {
	      var typ = opts.type;
	      if (opts.fn) this._removeListener(opts.fn, typ);
	      if (firstLink._parentLink) firstLink._parentLink(); // Cancel listeners all the way up the chain.
	    }.bind(this);
	    Object.keys(this.opts).forEach(function (prop) {
	      var func = this.opts[prop];
	      firstLink[prop] = argsarray(function (args) {
	        var link = func.apply(func.__siesta_bound_object, args);
	        link._parentLink = firstLink;
	        return link;
	      }.bind(this));
	    }.bind(this));
	    firstLink._parentLink = null;
	    return firstLink;
	  },
	  /**
	   * Construct a link in the chain of calls.
	   * @param opts
	   * @param {Function} [clean]
	   */
	  _link: function _link(opts, clean) {
	    var chain = this;
	    clean = clean || function () {};
	    var link;
	    link = function () {
	      clean();
	      if (link._parentLink) link._parentLink(); // Cancel listeners all the way up the chain.
	    }.bind(this);
	    link.__siesta_isLink = true;
	    link.opts = opts;
	    link.clean = clean;
	    Object.keys(opts).forEach(function (prop) {
	      var func = opts[prop];
	      link[prop] = argsarray(function (args) {
	        var possibleLink = func.apply(func.__siesta_bound_object, args);
	        if (!possibleLink || !possibleLink.__siesta_isLink) {
	          // Patch in a link in the chain to avoid it being broken, basing off the current link
	          nextLink = chain._link(link.opts);
	          for (var prop in possibleLink) {
	            //noinspection JSUnfilteredForInLoop
	            if (possibleLink[prop] instanceof Function) {
	              //noinspection JSUnfilteredForInLoop
	              nextLink[prop] = possibleLink[prop];
	            }
	          }
	        } else {
	          var nextLink = possibleLink;
	        }
	        nextLink._parentLink = link;
	        // Inherit methods from the parent link if those methods don't already exist.
	        for (prop in link) {
	          if (link[prop] instanceof Function) {
	            nextLink[prop] = link[prop].bind(link);
	          }
	        }
	        return nextLink;
	      }.bind(this));
	    }.bind(this));
	    link._parentLink = null;
	    return link;
	  }
	};
	module.exports = Chain;

/***/ },
/* 26 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	var util = __webpack_require__(4),
	    Promise = util.Promise,
	    error = __webpack_require__(8),
	    ModelInstance = __webpack_require__(21);
	
	/*
	 TODO: Use ES6 Proxy instead.
	 Eventually query sets should use ES6 Proxies which will be much more natural and robust. E.g. no need for the below
	 */
	var ARRAY_METHODS = ['push', 'sort', 'reverse', 'splice', 'shift', 'unshift'],
	    NUMBER_METHODS = ['toString', 'toExponential', 'toFixed', 'toPrecision', 'valueOf'],
	    NUMBER_PROPERTIES = ['MAX_VALUE', 'MIN_VALUE', 'NEGATIVE_INFINITY', 'NaN', 'POSITIVE_INFINITY'],
	    STRING_METHODS = ['charAt', 'charCodeAt', 'concat', 'fromCharCode', 'indexOf', 'lastIndexOf', 'localeCompare', 'match', 'replace', 'search', 'slice', 'split', 'substr', 'substring', 'toLocaleLowerCase', 'toLocaleUpperCase', 'toLowerCase', 'toString', 'toUpperCase', 'trim', 'valueOf'],
	    STRING_PROPERTIES = ['length'];
	
	/**
	 * Return the property names for a given object. Handles special cases such as strings and numbers that do not have
	 * the getOwnPropertyNames function.
	 * The special cases are very much hacks. This hack can be removed once the Proxy object is more widely adopted.
	 * @param object
	 * @returns {Array}
	 */
	function getPropertyNames(object) {
	  var propertyNames;
	  if (typeof object == 'string' || object instanceof String) {
	    propertyNames = STRING_METHODS.concat(STRING_PROPERTIES);
	  } else if (typeof object == 'number' || object instanceof Number) {
	    propertyNames = NUMBER_METHODS.concat(NUMBER_PROPERTIES);
	  } else {
	    propertyNames = object.getOwnPropertyNames();
	  }
	  return propertyNames;
	}
	
	/**
	 * Define a proxy property to attributes on objects in the array
	 * @param arr
	 * @param prop
	 */
	function defineAttribute(arr, prop) {
	  if (!(prop in arr)) {
	    // e.g. we cannot redefine .length
	    Object.defineProperty(arr, prop, {
	      get: function get() {
	        return querySet(util.pluck(arr, prop));
	      },
	      set: function set(v) {
	        if (util.isArray(v)) {
	          if (this.length != v.length) throw error({ message: 'Must be same length' });
	          for (var i = 0; i < v.length; i++) {
	            this[i][prop] = v[i];
	          }
	        } else {
	          for (i = 0; i < this.length; i++) {
	            this[i][prop] = v;
	          }
	        }
	      }
	    });
	  }
	}
	
	function isPromise(obj) {
	  // TODO: Don't think this is very robust.
	  return obj.then && obj.catch;
	}
	
	/**
	 * Define a proxy method on the array if not already in existence.
	 * @param arr
	 * @param prop
	 */
	function defineMethod(arr, prop) {
	  if (!(prop in arr)) {
	    // e.g. we don't want to redefine toString
	    arr[prop] = function () {
	      var args = arguments,
	          res = this.map(function (p) {
	        return p[prop].apply(p, args);
	      });
	      var arePromises = false;
	      if (res.length) arePromises = isPromise(res[0]);
	      return arePromises ? Promise.all(res) : querySet(res);
	    };
	  }
	}
	
	/**
	 * Transform the array into a query set.
	 * Renders the array immutable.
	 * @param arr
	 * @param model - The model with which to proxy to
	 */
	function modelQuerySet(arr, model) {
	  arr = util.extend([], arr);
	  var attributeNames = model._attributeNames,
	      relationshipNames = model._relationshipNames,
	      names = attributeNames.concat(relationshipNames).concat(instanceMethods);
	  names.forEach(defineAttribute.bind(defineAttribute, arr));
	  var instanceMethods = Object.keys(ModelInstance.prototype);
	  instanceMethods.forEach(defineMethod.bind(defineMethod, arr));
	  return renderImmutable(arr);
	}
	
	/**
	 * Transform the array into a query set, based on whatever is in it.
	 * Note that all objects must be of the same type. This function will take the first object and decide how to proxy
	 * based on that.
	 * @param arr
	 */
	function querySet(arr) {
	  if (arr.length) {
	    var referenceObject = arr[0],
	        propertyNames = getPropertyNames(referenceObject);
	    propertyNames.forEach(function (prop) {
	      if (typeof referenceObject[prop] == 'function') defineMethod(arr, prop, arguments);else defineAttribute(arr, prop);
	    });
	  }
	  return renderImmutable(arr);
	}
	
	function throwImmutableError() {
	  throw new Error('Cannot modify a query set');
	}
	
	/**
	 * Render an array immutable by replacing any functions that can mutate it.
	 * @param arr
	 */
	function renderImmutable(arr) {
	  ARRAY_METHODS.forEach(function (p) {
	    arr[p] = throwImmutableError;
	  });
	  arr.immutable = true;
	  arr.mutableCopy = arr.asArray = function () {
	    var mutableArr = this.map(function (x) {
	      return x;
	    });
	    mutableArr.asQuerySet = function () {
	      return querySet(this);
	    };
	    mutableArr.asModelQuerySet = function (model) {
	      return modelQuerySet(this, model);
	    };
	    return mutableArr;
	  };
	  return arr;
	}
	
	module.exports = modelQuerySet;

/***/ },
/* 27 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	var ModelInstance = __webpack_require__(21),
	    log = __webpack_require__(11)('graph'),
	    cache = __webpack_require__(20),
	    util = __webpack_require__(4);
	
	function SiestaError(opts) {
	  this.opts = opts;
	}
	
	SiestaError.prototype.toString = function () {
	  return JSON.stringify(this.opts, null, 4);
	};
	
	/**
	 * Encapsulates the idea of mapping arrays of data onto the object graph or arrays of objects.
	 * @param {Object} opts
	 * @param opts.model
	 * @param opts.data
	 * @param opts.objects
	 * @param opts.disableNotifications
	 */
	function MappingOperation(opts) {
	  this._opts = opts;
	
	  util.extendFromOpts(this, opts, {
	    model: null,
	    data: null,
	    objects: [],
	    disableevents: false,
	    _ignoreInstalled: false
	  });
	
	  util.extend(this, {
	    errors: [],
	    subTaskResults: {},
	    _newObjects: []
	  });
	
	  this.model._installReversePlaceholders();
	  this.data = this.preprocessData();
	}
	
	util.extend(MappingOperation.prototype, {
	  mapAttributes: function mapAttributes() {
	    for (var i = 0; i < this.data.length; i++) {
	      var datum = this.data[i],
	          object = this.objects[i];
	      // No point mapping object onto itself. This happens if a ModelInstance is passed as a relationship.
	      if (datum != object) {
	        if (object) {
	          // If object is falsy, then there was an error looking up that object/creating it.
	          var fields = this.model._attributeNames;
	          fields.forEach(function (f) {
	            if (datum[f] !== undefined) {
	              // null is fine
	              // If events are disabled we update __values object directly. This avoids triggering
	              // events which are built into the set function of the property.
	              if (this.disableevents) {
	                object.__values[f] = datum[f];
	              } else {
	                object[f] = datum[f];
	              }
	            }
	          }.bind(this));
	          if (datum._rev) object._rev = datum._rev;
	        }
	      }
	    }
	  },
	  _map: function _map() {
	    var self = this;
	    var err;
	    this.mapAttributes();
	    var relationshipFields = Object.keys(self.subTaskResults);
	    relationshipFields.forEach(function (f) {
	      var res = self.subTaskResults[f];
	      var indexes = res.indexes,
	          objects = res.objects;
	      var relatedData = self.getRelatedData(f).relatedData;
	      var unflattenedObjects = util.unflattenArray(objects, relatedData);
	      for (var i = 0; i < unflattenedObjects.length; i++) {
	        var idx = indexes[i];
	        // Errors are plucked from the suboperations.
	        var error = self.errors[idx];
	        err = error ? error[f] : null;
	        if (!err) {
	          var related = unflattenedObjects[i]; // Can be array or scalar.
	          var object = self.objects[idx];
	          if (object) {
	            err = object.__proxies[f].set(related, { disableevents: self.disableevents });
	            if (err) {
	              if (!self.errors[idx]) self.errors[idx] = {};
	              self.errors[idx][f] = err;
	            }
	          }
	        }
	      }
	    });
	  },
	  /**
	   * Figure out which data items require a cache lookup.
	   * @returns {{remoteLookups: Array, localLookups: Array}}
	   * @private
	   */
	  _sortLookups: function _sortLookups() {
	    var remoteLookups = [];
	    var localLookups = [];
	    for (var i = 0; i < this.data.length; i++) {
	      if (!this.objects[i]) {
	        var lookup;
	        var datum = this.data[i];
	        var isScalar = typeof datum == 'string' || typeof datum == 'number' || datum instanceof String;
	        if (datum) {
	          if (isScalar) {
	            lookup = {
	              index: i,
	              datum: {}
	            };
	            lookup.datum[this.model.id] = datum;
	            remoteLookups.push(lookup);
	          } else if (datum instanceof ModelInstance) {
	            // We won't need to perform any mapping.
	            this.objects[i] = datum;
	          } else if (datum.localId) {
	            localLookups.push({
	              index: i,
	              datum: datum
	            });
	          } else if (datum[this.model.id]) {
	            remoteLookups.push({
	              index: i,
	              datum: datum
	            });
	          } else {
	            this.objects[i] = this._instance();
	          }
	        } else {
	          this.objects[i] = null;
	        }
	      }
	    }
	    return { remoteLookups: remoteLookups, localLookups: localLookups };
	  },
	  _performLocalLookups: function _performLocalLookups(localLookups) {
	    var localIdentifiers = util.pluck(util.pluck(localLookups, 'datum'), 'localId'),
	        localObjects = cache.getViaLocalId(localIdentifiers);
	    for (var i = 0; i < localIdentifiers.length; i++) {
	      var obj = localObjects[i];
	      var localId = localIdentifiers[i];
	      var lookup = localLookups[i];
	      if (!obj) {
	        // If there are multiple mapping operations going on, there may be
	        obj = cache.get({ localId: localId });
	        if (!obj) obj = this._instance({ localId: localId }, !this.disableevents);
	        this.objects[lookup.index] = obj;
	      } else {
	        this.objects[lookup.index] = obj;
	      }
	    }
	  },
	  _performRemoteLookups: function _performRemoteLookups(remoteLookups) {
	    var remoteIdentifiers = util.pluck(util.pluck(remoteLookups, 'datum'), this.model.id),
	        remoteObjects = cache.getViaRemoteId(remoteIdentifiers, { model: this.model });
	    for (var i = 0; i < remoteObjects.length; i++) {
	      var obj = remoteObjects[i],
	          lookup = remoteLookups[i];
	      if (obj) {
	        this.objects[lookup.index] = obj;
	      } else {
	        var data = {};
	        var remoteId = remoteIdentifiers[i];
	        data[this.model.id] = remoteId;
	        var cacheQuery = {
	          model: this.model
	        };
	        cacheQuery[this.model.id] = remoteId;
	        var cached = cache.get(cacheQuery);
	        if (cached) {
	          this.objects[lookup.index] = cached;
	        } else {
	          this.objects[lookup.index] = this._instance();
	          // It's important that we map the remote identifier here to ensure that it ends
	          // up in the cache.
	          this.objects[lookup.index][this.model.id] = remoteId;
	        }
	      }
	    }
	  },
	  /**
	   * For indices where no object is present, perform cache lookups, creating a new object if necessary.
	   * @private
	   */
	  _lookup: function _lookup() {
	    if (this.model.singleton) {
	      this._lookupSingleton();
	    } else {
	      var lookups = this._sortLookups(),
	          remoteLookups = lookups.remoteLookups,
	          localLookups = lookups.localLookups;
	      this._performLocalLookups(localLookups);
	      this._performRemoteLookups(remoteLookups);
	    }
	  },
	  _lookupSingleton: function _lookupSingleton() {
	    // Pick a random localId from the array of data being mapped onto the singleton object. Note that they should
	    // always be the same. This is just a precaution.
	    var localIdentifiers = util.pluck(this.data, 'localId'),
	        localId;
	    for (i = 0; i < localIdentifiers.length; i++) {
	      if (localIdentifiers[i]) {
	        localId = { localId: localIdentifiers[i] };
	        break;
	      }
	    }
	    // The mapping operation is responsible for creating singleton instances if they do not already exist.
	    var singleton = cache.getSingleton(this.model) || this._instance(localId);
	    for (var i = 0; i < this.data.length; i++) {
	      this.objects[i] = singleton;
	    }
	  },
	  _instance: function _instance() {
	    var model = this.model,
	        modelInstance = model._instance.apply(model, arguments);
	    this._newObjects.push(modelInstance);
	    return modelInstance;
	  },
	
	  preprocessData: function preprocessData() {
	    var data = util.extend([], this.data);
	    return data.map(function (datum) {
	      if (datum) {
	        if (!util.isString(datum)) {
	          var keys = Object.keys(datum);
	          keys.forEach(function (k) {
	            var isRelationship = this.model._relationshipNames.indexOf(k) > -1;
	
	            if (isRelationship) {
	              var val = datum[k];
	              if (val instanceof ModelInstance) {
	                datum[k] = { localId: val.localId };
	              }
	            }
	          }.bind(this));
	        }
	      }
	      return datum;
	    }.bind(this));
	  },
	  start: function start(done) {
	    var data = this.data;
	    if (data.length) {
	      var self = this;
	      var tasks = [];
	      this._lookup();
	      tasks.push(this._executeSubOperations.bind(this));
	      util.parallel(tasks, function (err) {
	        if (err) console.error(err);
	        self._map();
	        // Users are allowed to add a custom init method to the methods object when defining a Model, of the form:
	        //
	        //
	        // init: function ([done]) {
	        //     // ...
	        //  }
	        //
	        //
	        // If done is passed, then __init must be executed asynchronously, and the mapping operation will not
	        // finish until all inits have executed.
	        //
	        // Here we ensure the execution of all of them
	        var initTasks = self._newObjects.reduce(function (memo, o) {
	          var init = o.model.init;
	          if (init) {
	            var paramNames = util.paramNames(init);
	            if (paramNames.length == 1) {
	              memo.push(init.bind(o, done));
	            } else {
	              init.call(o);
	            }
	          }
	          o._emitEvents = true;
	          o._emitNew();
	          return memo;
	        }, []);
	        util.parallel(initTasks, function () {
	          done(self.errors.length ? self.errors : null, self.objects);
	        });
	      }.bind(this));
	    } else {
	      done(null, []);
	    }
	  },
	  getRelatedData: function getRelatedData(name) {
	    var indexes = [];
	    var relatedData = [];
	    for (var i = 0; i < this.data.length; i++) {
	      var datum = this.data[i];
	      if (datum) {
	        var val = datum[name];
	        if (val) {
	          indexes.push(i);
	          relatedData.push(val);
	        }
	      }
	    }
	    return {
	      indexes: indexes,
	      relatedData: relatedData
	    };
	  },
	
	  processErrorsFromTask: function processErrorsFromTask(relationshipName, errors, indexes) {
	    if (errors.length) {
	      var relatedData = this.getRelatedData(relationshipName).relatedData;
	      var unflattenedErrors = util.unflattenArray(errors, relatedData);
	      for (var i = 0; i < unflattenedErrors.length; i++) {
	        var idx = indexes[i];
	        var err = unflattenedErrors[i];
	        var isError = err;
	        if (util.isArray(err)) isError = err.reduce(function (memo, x) {
	          return memo || x;
	        }, false);
	        if (isError) {
	          if (!this.errors[idx]) this.errors[idx] = {};
	          this.errors[idx][relationshipName] = err;
	        }
	      }
	    }
	  },
	  _executeSubOperations: function _executeSubOperations(callback) {
	    var self = this,
	        relationshipNames = Object.keys(this.model.relationships);
	    if (relationshipNames.length) {
	      var tasks = relationshipNames.reduce(function (m, relationshipName) {
	        var relationship = self.model.relationships[relationshipName];
	        var reverseModel = relationship.forwardName == relationshipName ? relationship.reverseModel : relationship.forwardModel;
	        // Mock any missing singleton data to ensure that all singleton instances are created.
	        if (reverseModel.singleton && !relationship.isReverse) {
	          this.data.forEach(function (datum) {
	            if (!datum[relationshipName]) datum[relationshipName] = {};
	          });
	        }
	        var __ret = this.getRelatedData(relationshipName),
	            indexes = __ret.indexes,
	            relatedData = __ret.relatedData;
	        if (relatedData.length) {
	          var flatRelatedData = util.flattenArray(relatedData);
	          var op = new MappingOperation({
	            model: reverseModel,
	            data: flatRelatedData,
	            disableevents: self.disableevents,
	            _ignoreInstalled: self._ignoreInstalled
	          });
	        }
	
	        if (op) {
	          var task;
	          task = function task(done) {
	            op.start(function (errors, objects) {
	              self.subTaskResults[relationshipName] = {
	                errors: errors,
	                objects: objects,
	                indexes: indexes
	              };
	              self.processErrorsFromTask(relationshipName, op.errors, indexes);
	              done();
	            });
	          };
	          m.push(task);
	        }
	        return m;
	      }.bind(this), []);
	      util.parallel(tasks, function (err) {
	        callback(err);
	      });
	    } else {
	      callback();
	    }
	  }
	});
	
	module.exports = MappingOperation;

/***/ },
/* 28 */
/***/ function(module, exports) {

	'use strict';
	
	var hasOwn = Object.prototype.hasOwnProperty;
	var toStr = Object.prototype.toString;
	
	var isArray = function isArray(arr) {
		if (typeof Array.isArray === 'function') {
			return Array.isArray(arr);
		}
	
		return toStr.call(arr) === '[object Array]';
	};
	
	var isPlainObject = function isPlainObject(obj) {
		if (!obj || toStr.call(obj) !== '[object Object]') {
			return false;
		}
	
		var hasOwnConstructor = hasOwn.call(obj, 'constructor');
		var hasIsPrototypeOf = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
		// Not own constructor property must be Object
		if (obj.constructor && !hasOwnConstructor && !hasIsPrototypeOf) {
			return false;
		}
	
		// Own properties are enumerated firstly, so to speed up,
		// if last one is own, then all properties are own.
		var key;
		for (key in obj) {/**/}
	
		return typeof key === 'undefined' || hasOwn.call(obj, key);
	};
	
	module.exports = function extend() {
		var options, name, src, copy, copyIsArray, clone,
			target = arguments[0],
			i = 1,
			length = arguments.length,
			deep = false;
	
		// Handle a deep copy situation
		if (typeof target === 'boolean') {
			deep = target;
			target = arguments[1] || {};
			// skip the boolean and the target
			i = 2;
		} else if ((typeof target !== 'object' && typeof target !== 'function') || target == null) {
			target = {};
		}
	
		for (; i < length; ++i) {
			options = arguments[i];
			// Only deal with non-null/undefined values
			if (options != null) {
				// Extend the base object
				for (name in options) {
					src = target[name];
					copy = options[name];
	
					// Prevent never-ending loop
					if (target !== copy) {
						// Recurse if we're merging plain objects or arrays
						if (deep && copy && (isPlainObject(copy) || (copyIsArray = isArray(copy)))) {
							if (copyIsArray) {
								copyIsArray = false;
								clone = src && isArray(src) ? src : [];
							} else {
								clone = src && isPlainObject(src) ? src : {};
							}
	
							// Never move original objects, clone them
							target[name] = extend(deep, clone, copy);
	
						// Don't bring in undefined values
						} else if (typeof copy !== 'undefined') {
							target[name] = copy;
						}
					}
				}
			}
		}
	
		// Return the modified object
		return target;
	};
	


/***/ },
/* 29 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	var util = __webpack_require__(4);
	
	function Condition(fn, lazy) {
	  if (lazy === undefined || lazy === null) {
	    lazy = true;
	  }
	  fn = fn || function (done) {
	    done();
	  };
	
	  this._promise = new util.Promise(function (resolve, reject) {
	    this.fn = function () {
	      this.executed = true;
	      var numComplete = 0;
	      var results = [];
	      var errors = [];
	      if (util.isArray(fn)) {
	        var checkComplete = function () {
	          if (numComplete.length == fn.length) {
	            if (errors.length) this._promise.reject(errors);else this._promise.resolve(null, results);
	          }
	        }.bind(this);
	
	        fn.forEach(function (cond, idx) {
	          cond.then(function (res) {
	            results[idx] = res;
	            numComplete++;
	            checkComplete();
	          }).catch(function (err) {
	            errors[idx] = err;
	            numComplete++;
	          });
	        });
	      } else {
	        fn(function (err, res) {
	          if (err) reject(err);else resolve(res);
	        }.bind(this));
	      }
	    };
	  }.bind(this));
	
	  if (!lazy) this._execute();
	  this.executed = false;
	}
	
	Condition.prototype = {
	  _execute: function _execute() {
	    if (!this.executed) this.fn();
	  },
	  then: function then(success, fail) {
	    this._execute();
	    return this._promise.then(success, fail);
	  },
	  catch: function _catch(fail) {
	    this._execute();
	    return this._promise.catch(fail);
	  },
	  resolve: function resolve(res) {
	    this.executed = true;
	    this._promise.resolve(res);
	  },
	  reject: function reject(err) {
	    this.executed = true;
	    this._promise.reject(err);
	  }
	};
	
	module.exports = Condition;

/***/ },
/* 30 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	var util = __webpack_require__(4);
	
	/**
	 * Acts as a placeholder for various objects e.g. lazy registration of models.
	 * @param [opts]
	 * @constructor
	 */
	function Placeholder(opts) {
	  util.extend(this, opts || {});
	  this.isPlaceholder = true;
	}
	
	module.exports = Placeholder;

/***/ },
/* 31 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	/**
	 * For those familiar with Apple's Cocoa library, reactive queries roughly map onto NSFetchedResultsController.
	 *
	 * They present a query set that 'reacts' to changes in the underlying data.
	 * @module reactiveQuery
	 */
	
	var log = __webpack_require__(11)('query:reactive'),
	    Query = __webpack_require__(19),
	    EventEmitter = __webpack_require__(24).EventEmitter,
	    events = __webpack_require__(23),
	    Chain = __webpack_require__(25),
	    modelEvents = __webpack_require__(22),
	    InternalSiestaError = __webpack_require__(8).InternalSiestaError,
	    constructQuerySet = __webpack_require__(26),
	    util = __webpack_require__(4);
	
	/**
	 *
	 * @param {Query} query - The underlying query
	 * @constructor
	 */
	function ReactiveQuery(query) {
	  var self = this;
	  EventEmitter.call(this);
	  Chain.call(this);
	  util.extend(this, {
	    insertionPolicy: ReactiveQuery.InsertionPolicy.Back,
	    initialised: false
	  });
	
	  Object.defineProperty(this, 'query', {
	    get: function get() {
	      return this._query;
	    },
	    set: function set(v) {
	      if (v) {
	        this._query = v;
	        this.results = constructQuerySet([], v.model);
	      } else {
	        this._query = null;
	        this.results = null;
	      }
	    },
	    configurable: false,
	    enumerable: true
	  });
	
	  if (query) {
	    util.extend(this, {
	      _query: query,
	      results: constructQuerySet([], query.model)
	    });
	  }
	
	  Object.defineProperties(this, {
	    initialized: {
	      get: function get() {
	        return this.initialised;
	      }
	    },
	    model: {
	      get: function get() {
	        var query = self._query;
	        if (query) {
	          return query.model;
	        }
	      }
	    },
	    collection: {
	      get: function get() {
	        return self.model.collectionName;
	      }
	    }
	  });
	}
	
	ReactiveQuery.prototype = Object.create(EventEmitter.prototype);
	util.extend(ReactiveQuery.prototype, Chain.prototype);
	
	util.extend(ReactiveQuery, {
	  InsertionPolicy: {
	    Front: 'Front',
	    Back: 'Back'
	  }
	});
	
	util.extend(ReactiveQuery.prototype, {
	  /**
	   *
	   * @param cb
	   * @param {bool} _ignoreInit - execute query again, initialised or not.
	   * @returns {*}
	   */
	  init: function init(cb, _ignoreInit) {
	    if (this._query) {
	      var name = this._constructNotificationName();
	      var handler = function (n) {
	        this._handleNotif(n);
	      }.bind(this);
	      this.handler = handler;
	      events.on(name, handler);
	      return util.promise(cb, function (cb) {
	        if (!this.initialised || _ignoreInit) {
	          this._query.execute(function (err, results) {
	            if (!err) {
	              cb(null, this._applyResults(results));
	            } else {
	              cb(err);
	            }
	          }.bind(this));
	        } else {
	          cb(null, this.results);
	        }
	      }.bind(this));
	    } else throw new InternalSiestaError('No _query defined');
	  },
	  _applyResults: function _applyResults(results) {
	    this.results = results;
	    this.initialised = true;
	    return this.results;
	  },
	  insert: function insert(newObj) {
	    var results = this.results.mutableCopy();
	    if (this.insertionPolicy == ReactiveQuery.InsertionPolicy.Back) var idx = results.push(newObj);else idx = results.unshift(newObj);
	    this.results = results.asModelQuerySet(this.model);
	    return idx;
	  },
	  /**
	   * Execute the underlying query again.
	   * @param cb
	   */
	  update: function update(cb) {
	    return this.init(cb, true);
	  },
	  _handleNotif: function _handleNotif(n) {
	    if (n.type == modelEvents.ModelEventType.New) {
	      var newObj = n.new;
	      if (this._query.objectMatchesQuery(newObj)) {
	        log('New object matches', newObj);
	        var idx = this.insert(newObj);
	        this.emit(modelEvents.ModelEventType.Splice, {
	          index: idx,
	          added: [newObj],
	          type: modelEvents.ModelEventType.Splice,
	          obj: this
	        });
	      } else {
	        log('New object does not match', newObj);
	      }
	    } else if (n.type == modelEvents.ModelEventType.Set) {
	      newObj = n.obj;
	      var index = this.results.indexOf(newObj),
	          alreadyContains = index > -1,
	          matches = this._query.objectMatchesQuery(newObj);
	      if (matches && !alreadyContains) {
	        log('Updated object now matches!', newObj);
	        idx = this.insert(newObj);
	        this.emit(modelEvents.ModelEventType.Splice, {
	          index: idx,
	          added: [newObj],
	          type: modelEvents.ModelEventType.Splice,
	          obj: this
	        });
	      } else if (!matches && alreadyContains) {
	        log('Updated object no longer matches!', newObj);
	        results = this.results.mutableCopy();
	        var removed = results.splice(index, 1);
	        this.results = results.asModelQuerySet(this.model);
	        this.emit(modelEvents.ModelEventType.Splice, {
	          index: index,
	          obj: this,
	          new: newObj,
	          type: modelEvents.ModelEventType.Splice,
	          removed: removed
	        });
	      } else if (!matches && !alreadyContains) {
	        log('Does not contain, but doesnt match so not inserting', newObj);
	      } else if (matches && alreadyContains) {
	        log('Matches but already contains', newObj);
	        // Send the notification over.
	        this.emit(n.type, n);
	      }
	    } else if (n.type == modelEvents.ModelEventType.Remove) {
	      newObj = n.obj;
	      var results = this.results.mutableCopy();
	      index = results.indexOf(newObj);
	      if (index > -1) {
	        log('Removing object', newObj);
	        removed = results.splice(index, 1);
	        this.results = constructQuerySet(results, this.model);
	        this.emit(modelEvents.ModelEventType.Splice, {
	          index: index,
	          obj: this,
	          type: modelEvents.ModelEventType.Splice,
	          removed: removed
	        });
	      } else {
	        log('No modelEvents neccessary.', newObj);
	      }
	    } else {
	      throw new InternalSiestaError('Unknown change type "' + n.type.toString() + '"');
	    }
	    this.results = constructQuerySet(this._query._sortResults(this.results), this.model);
	  },
	  _constructNotificationName: function _constructNotificationName() {
	    return this.model.collectionName + ':' + this.model.name;
	  },
	  terminate: function terminate() {
	    if (this.handler) {
	      events.removeListener(this._constructNotificationName(), this.handler);
	    }
	    this.results = null;
	    this.handler = null;
	  },
	  _registerEventHandler: function _registerEventHandler(on, name, fn) {
	    var removeListener = EventEmitter.prototype.removeListener;
	    if (name.trim() == '*') {
	      Object.keys(modelEvents.ModelEventType).forEach(function (k) {
	        on.call(this, modelEvents.ModelEventType[k], fn);
	      }.bind(this));
	    } else {
	      on.call(this, name, fn);
	    }
	    return this._link({
	      on: this.on.bind(this),
	      once: this.once.bind(this),
	      update: this.update.bind(this),
	      insert: this.insert.bind(this)
	    }, function () {
	      if (name.trim() == '*') {
	        Object.keys(modelEvents.ModelEventType).forEach(function (k) {
	          removeListener.call(this, modelEvents.ModelEventType[k], fn);
	        }.bind(this));
	      } else {
	        removeListener.call(this, name, fn);
	      }
	    });
	  },
	  on: function on(name, fn) {
	    return this._registerEventHandler(EventEmitter.prototype.on, name, fn);
	  },
	  once: function once(name, fn) {
	    return this._registerEventHandler(EventEmitter.prototype.once, name, fn);
	  }
	});
	
	module.exports = ReactiveQuery;

/***/ },
/* 32 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	var log = __webpack_require__(11)('model'),
	    InternalSiestaError = __webpack_require__(8).InternalSiestaError,
	    RelationshipType = __webpack_require__(18),
	    Query = __webpack_require__(19),
	    ModelInstance = __webpack_require__(21),
	    util = __webpack_require__(4),
	    guid = util.guid,
	    cache = __webpack_require__(20),
	    extend = __webpack_require__(28),
	    modelEvents = __webpack_require__(22),
	    wrapArray = __webpack_require__(23).wrapArray,
	    OneToManyProxy = __webpack_require__(33),
	    OneToOneProxy = __webpack_require__(35),
	    ManyToManyProxy = __webpack_require__(36),
	    ReactiveQuery = __webpack_require__(31),
	    ModelEventType = modelEvents.ModelEventType;
	
	function ModelInstanceFactory(model) {
	  this.model = model;
	}
	
	ModelInstanceFactory.prototype = {
	  _getLocalId: function _getLocalId(data) {
	    var localId;
	    if (data) {
	      localId = data.localId ? data.localId : guid();
	    } else {
	      localId = guid();
	    }
	    return localId;
	  },
	  /**
	   * Configure attributes
	   * @param modelInstance
	   * @param data
	   * @private
	   */
	
	  _installAttributes: function _installAttributes(modelInstance, data) {
	    var Model = this.model,
	        attributeNames = Model._attributeNames,
	        idx = attributeNames.indexOf(Model.id);
	    util.extend(modelInstance, {
	      __values: util.extend(Model.attributes.reduce(function (m, a) {
	        if (a.default !== undefined) m[a.name] = a.default;
	        return m;
	      }, {}), data || {})
	    });
	    if (idx > -1) attributeNames.splice(idx, 1);
	    attributeNames.forEach(function (attributeName) {
	      var attributeDefinition = Model._attributeDefinitionWithName(attributeName);
	      Object.defineProperty(modelInstance, attributeName, {
	        get: function get() {
	          var value = modelInstance.__values[attributeName];
	          return value === undefined ? null : value;
	        },
	        set: function set(v) {
	          if (attributeDefinition.parse) {
	            v = attributeDefinition.parse.call(modelInstance, v);
	          }
	          if (Model.parseAttribute) {
	            v = Model.parseAttribute.call(modelInstance, attributeName, v);
	          }
	          var old = modelInstance.__values[attributeName];
	          var propertyDependencies = this._propertyDependencies[attributeName] || [];
	          propertyDependencies = propertyDependencies.map(function (dependant) {
	            return {
	              prop: dependant,
	              old: this[dependant]
	            };
	          }.bind(this));
	
	          modelInstance.__values[attributeName] = v;
	          propertyDependencies.forEach(function (dep) {
	            var propertyName = dep.prop;
	            var new_ = this[propertyName];
	            modelEvents.emit({
	              collection: Model.collectionName,
	              model: Model.name,
	              localId: modelInstance.localId,
	              new: new_,
	              old: dep.old,
	              type: ModelEventType.Set,
	              field: propertyName,
	              obj: modelInstance
	            });
	          }.bind(this));
	          var e = {
	            collection: Model.collectionName,
	            model: Model.name,
	            localId: modelInstance.localId,
	            new: v,
	            old: old,
	            type: ModelEventType.Set,
	            field: attributeName,
	            obj: modelInstance
	          };
	          window.lastEmission = e;
	          modelEvents.emit(e);
	          if (util.isArray(v)) {
	            wrapArray(v, attributeName, modelInstance);
	          }
	        },
	        enumerable: true,
	        configurable: true
	      });
	    });
	  },
	  _installMethods: function _installMethods(modelInstance) {
	    var Model = this.model;
	    Object.keys(Model.methods).forEach(function (methodName) {
	      if (modelInstance[methodName] === undefined) {
	        modelInstance[methodName] = Model.methods[methodName].bind(modelInstance);
	      } else {
	        log('A method with name "' + methodName + '" already exists. Ignoring it.');
	      }
	    }.bind(this));
	  },
	  _installProperties: function _installProperties(modelInstance) {
	    var _propertyNames = Object.keys(this.model.properties),
	        _propertyDependencies = {};
	    _propertyNames.forEach(function (propName) {
	      var propDef = this.model.properties[propName];
	      var dependencies = propDef.dependencies || [];
	      dependencies.forEach(function (attr) {
	        if (!_propertyDependencies[attr]) _propertyDependencies[attr] = [];
	        _propertyDependencies[attr].push(propName);
	      });
	      delete propDef.dependencies;
	      if (modelInstance[propName] === undefined) {
	        Object.defineProperty(modelInstance, propName, propDef);
	      } else {
	        log('A property/method with name "' + propName + '" already exists. Ignoring it.');
	      }
	    }.bind(this));
	
	    modelInstance._propertyDependencies = _propertyDependencies;
	  },
	  _installRemoteId: function _installRemoteId(modelInstance) {
	    var Model = this.model;
	    var idField = Model.id;
	    Object.defineProperty(modelInstance, idField, {
	      get: function get() {
	        return modelInstance.__values[Model.id] || null;
	      },
	      set: function set(v) {
	        var old = modelInstance[Model.id];
	        modelInstance.__values[Model.id] = v;
	        modelEvents.emit({
	          collection: Model.collectionName,
	          model: Model.name,
	          localId: modelInstance.localId,
	          new: v,
	          old: old,
	          type: ModelEventType.Set,
	          field: Model.id,
	          obj: modelInstance
	        });
	        cache.remoteInsert(modelInstance, v, old);
	      },
	      enumerable: true,
	      configurable: true
	    });
	  },
	  /**
	   * @param definition - Definition of a relationship
	   * @param modelInstance - Instance of which to install the relationship.
	   */
	  _installRelationship: function _installRelationship(definition, modelInstance) {
	    var proxy;
	    var type = definition.type;
	    if (type == RelationshipType.OneToMany) {
	      proxy = new OneToManyProxy(definition);
	    } else if (type == RelationshipType.OneToOne) {
	      proxy = new OneToOneProxy(definition);
	    } else if (type == RelationshipType.ManyToMany) {
	      proxy = new ManyToManyProxy(definition);
	    } else {
	      throw new InternalSiestaError('No such relationship type: ' + type);
	    }
	    proxy.install(modelInstance);
	  },
	  _installRelationshipProxies: function _installRelationshipProxies(modelInstance) {
	    var model = this.model;
	    for (var name in model.relationships) {
	      if (model.relationships.hasOwnProperty(name)) {
	        var definition = util.extend({}, model.relationships[name]);
	        this._installRelationship(definition, modelInstance);
	      }
	    }
	  },
	  _registerInstance: function _registerInstance(modelInstance, shouldRegisterChange) {
	    cache.insert(modelInstance);
	    shouldRegisterChange = shouldRegisterChange === undefined ? true : shouldRegisterChange;
	    if (shouldRegisterChange) modelInstance._emitNew();
	  },
	  _installLocalId: function _installLocalId(modelInstance, data) {
	    modelInstance.localId = this._getLocalId(data);
	  },
	  /**
	   * Convert raw data into a ModelInstance
	   * @returns {ModelInstance}
	   */
	  _instance: function _instance(data, shouldRegisterChange) {
	    if (!this.model._relationshipsInstalled || !this.model._reverseRelationshipsInstalled) {
	      throw new InternalSiestaError('Model must be fully installed before creating any models');
	    }
	    var modelInstance = new ModelInstance(this.model);
	    this._installLocalId(modelInstance, data);
	    this._installAttributes(modelInstance, data);
	    this._installMethods(modelInstance);
	    this._installProperties(modelInstance);
	    this._installRemoteId(modelInstance);
	    this._installRelationshipProxies(modelInstance);
	    this._registerInstance(modelInstance, shouldRegisterChange);
	    return modelInstance;
	  }
	};
	
	module.exports = ModelInstanceFactory;

/***/ },
/* 33 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	var RelationshipProxy = __webpack_require__(34),
	    util = __webpack_require__(4),
	    modelEvents = __webpack_require__(22),
	    events = __webpack_require__(23),
	    wrapArrayForAttributes = events.wrapArray,
	    ArrayObserver = __webpack_require__(5).ArrayObserver,
	    ModelEventType = __webpack_require__(22).ModelEventType;
	
	/**
	 * @class  [OneToManyProxy description]
	 * @constructor
	 * @param {[type]} opts
	 */
	function OneToManyProxy(opts) {
	  RelationshipProxy.call(this, opts);
	  if (this.isReverse) {
	    this.related = [];
	    //this.forwardModel.on(modelEvents.ModelEventType.Remove, function(e) {
	    //  if (e.field == e.forwardName) {
	    //    var idx = this.related.indexOf(e.obj);
	    //    if (idx > -1) {
	    //      var removed = this.related.splice(idx, 1);
	    //    }
	    //    modelEvents.emit({
	    //      collection: this.reverseModel.collectionName,
	    //      model: this.reverseModel.name,
	    //      localId: this.object.localId,
	    //      field: this.reverseName,
	    //      removed: removed,
	    //      added: [],
	    //      type: ModelEventType.Splice,
	    //      index: idx,
	    //      obj: this.object
	    //    });
	    //  }
	    //}.bind(this));
	  }
	}
	
	OneToManyProxy.prototype = Object.create(RelationshipProxy.prototype);
	
	util.extend(OneToManyProxy.prototype, {
	  clearReverse: function clearReverse(removed) {
	    var self = this;
	    removed.forEach(function (removedObject) {
	      var reverseProxy = self.reverseProxyForInstance(removedObject);
	      reverseProxy.setIdAndRelated(null);
	    });
	  },
	  setReverseOfAdded: function setReverseOfAdded(added) {
	    var self = this;
	    added.forEach(function (added) {
	      var forwardProxy = self.reverseProxyForInstance(added);
	      forwardProxy.setIdAndRelated(self.object);
	    });
	  },
	  wrapArray: function wrapArray(arr) {
	    var self = this;
	    wrapArrayForAttributes(arr, this.reverseName, this.object);
	    if (!arr.arrayObserver) {
	      arr.arrayObserver = new ArrayObserver(arr);
	      var observerFunction = function observerFunction(splices) {
	        splices.forEach(function (splice) {
	          var added = splice.addedCount ? arr.slice(splice.index, splice.index + splice.addedCount) : [];
	          var removed = splice.removed;
	          self.clearReverse(removed);
	          self.setReverseOfAdded(added);
	          var model = self.getForwardModel();
	          modelEvents.emit({
	            collection: model.collectionName,
	            model: model.name,
	            localId: self.object.localId,
	            field: self.getForwardName(),
	            removed: removed,
	            added: added,
	            type: ModelEventType.Splice,
	            index: splice.index,
	            obj: self.object
	          });
	        });
	      };
	      arr.arrayObserver.open(observerFunction);
	    }
	  },
	  get: function get(cb) {
	    return util.promise(cb, function (cb) {
	      cb(null, this.related);
	    }.bind(this));
	  },
	  /**
	   * Validate the object that we're setting
	   * @param obj
	   * @returns {string|null} An error message or null
	   * @class OneToManyProxy
	   */
	  validate: function validate(obj) {
	    var str = Object.prototype.toString.call(obj);
	    if (this.isForward) {
	      if (str == '[object Array]') {
	        return 'Cannot assign array forward oneToMany (' + str + '): ' + this.forwardName;
	      }
	    } else {
	      if (str != '[object Array]') {
	        return 'Cannot scalar to reverse oneToMany (' + str + '): ' + this.reverseName;
	      }
	    }
	    return null;
	  },
	  set: function set(obj, opts) {
	    this.checkInstalled();
	    var self = this;
	    if (obj) {
	      var errorMessage;
	      if (errorMessage = this.validate(obj)) {
	        return errorMessage;
	      } else {
	        this.clearReverseRelated(opts);
	        self.setIdAndRelated(obj, opts);
	        if (self.isReverse) {
	          this.wrapArray(self.related);
	        }
	        self.setIdAndRelatedReverse(obj, opts);
	      }
	    } else {
	      this.clearReverseRelated(opts);
	      self.setIdAndRelated(obj, opts);
	    }
	  },
	  install: function install(obj) {
	    RelationshipProxy.prototype.install.call(this, obj);
	
	    if (this.isReverse) {
	      obj['splice' + util.capitaliseFirstLetter(this.reverseName)] = this.splice.bind(this);
	      this.wrapArray(this.related);
	    }
	  }
	});
	
	module.exports = OneToManyProxy;

/***/ },
/* 34 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	/**
	 * Base functionality for relationships.
	 * @module relationships
	 */
	var InternalSiestaError = __webpack_require__(8).InternalSiestaError,
	    util = __webpack_require__(4),
	    Query = __webpack_require__(19),
	    log = __webpack_require__(11),
	    cache = __webpack_require__(20),
	    events = __webpack_require__(23),
	    wrapArrayForAttributes = events.wrapArray,
	    ArrayObserver = __webpack_require__(5).ArrayObserver,
	    modelEvents = __webpack_require__(22),
	    ModelEventType = modelEvents.ModelEventType;
	
	/**
	 * @class  [RelationshipProxy description]
	 * @param {Object} opts
	 * @constructor
	 */
	function RelationshipProxy(opts) {
	  var self = this;
	  opts = opts || {};
	
	  util.extend(this, {
	    object: null,
	    related: null
	  });
	
	  Object.defineProperties(this, {
	    isForward: {
	      get: function get() {
	        return !self.isReverse;
	      },
	      set: function set(v) {
	        self.isReverse = !v;
	      },
	      enumerable: true
	    }
	  });
	
	  util.extendFromOpts(this, opts, {
	    reverseModel: null,
	    forwardModel: null,
	    forwardName: null,
	    reverseName: null,
	    isReverse: null,
	    serialise: null
	  }, false);
	
	  this.cancelListens = {};
	}
	
	util.extend(RelationshipProxy, {});
	
	util.extend(RelationshipProxy.prototype, {
	  /**
	   * Install this proxy on the given instance
	   * @param {ModelInstance} modelInstance
	   */
	  install: function install(modelInstance) {
	    if (modelInstance) {
	      if (!this.object) {
	        this.object = modelInstance;
	        var self = this;
	        var name = this.getForwardName();
	        Object.defineProperty(modelInstance, name, {
	          get: function get() {
	            return self.related;
	          },
	          set: function set(v) {
	            self.set(v);
	          },
	          configurable: true,
	          enumerable: true
	        });
	        if (!modelInstance.__proxies) modelInstance.__proxies = {};
	        modelInstance.__proxies[name] = this;
	        if (!modelInstance._proxies) {
	          modelInstance._proxies = [];
	        }
	        modelInstance._proxies.push(this);
	      } else {
	        throw new InternalSiestaError('Already installed.');
	      }
	    } else {
	      throw new InternalSiestaError('No object passed to relationship install');
	    }
	  }
	
	});
	
	//noinspection JSUnusedLocalSymbols
	util.extend(RelationshipProxy.prototype, {
	  set: function set(obj, opts) {
	    throw new InternalSiestaError('Must subclass RelationshipProxy');
	  },
	  get: function get(callback) {
	    throw new InternalSiestaError('Must subclass RelationshipProxy');
	  }
	});
	
	util.extend(RelationshipProxy.prototype, {
	  proxyForInstance: function proxyForInstance(modelInstance, reverse) {
	    var name = reverse ? this.getReverseName() : this.getForwardName(),
	        model = reverse ? this.reverseModel : this.forwardModel;
	    var ret;
	    // This should never happen. Should g   et caught in the mapping operation?
	    if (util.isArray(modelInstance)) {
	      ret = modelInstance.map(function (o) {
	        return o.__proxies[name];
	      });
	    } else {
	      var proxies = modelInstance.__proxies;
	      var proxy = proxies[name];
	      if (!proxy) {
	        var err = 'No proxy with name "' + name + '" on mapping ' + model.name;
	        throw new InternalSiestaError(err);
	      }
	      ret = proxy;
	    }
	    return ret;
	  },
	  reverseProxyForInstance: function reverseProxyForInstance(modelInstance) {
	    return this.proxyForInstance(modelInstance, true);
	  },
	  getReverseName: function getReverseName() {
	    return this.isForward ? this.reverseName : this.forwardName;
	  },
	  getForwardName: function getForwardName() {
	    return this.isForward ? this.forwardName : this.reverseName;
	  },
	  getForwardModel: function getForwardModel() {
	    return this.isForward ? this.forwardModel : this.reverseModel;
	  },
	  /**
	   * Configure _id and related with the new related object.
	   * @param obj
	   * @param {object} [opts]
	   * @param {boolean} [opts.disableNotifications]
	   * @returns {String|undefined} - Error message or undefined
	   */
	  setIdAndRelated: function setIdAndRelated(obj, opts) {
	    opts = opts || {};
	    if (!opts.disableevents) var oldValue = this._getOldValueForSetChangeEvent();
	    if (obj) {
	      if (util.isArray(obj)) {
	        this.related = obj;
	      } else {
	        this.related = obj;
	      }
	    } else {
	      this.related = null;
	    }
	    if (!opts.disableevents) this.registerSetChange(obj, oldValue);
	  },
	  checkInstalled: function checkInstalled() {
	    if (!this.object) {
	      throw new InternalSiestaError('Proxy must be installed on an object before can use it.');
	    }
	  },
	  splicer: function splicer(opts) {
	    opts = opts || {};
	    return function (idx, numRemove) {
	      opts = opts || {};
	      if (!opts.disableevents) {
	        var added = this._getAddedForSpliceChangeEvent(arguments),
	            removed = this._getRemovedForSpliceChangeEvent(idx, numRemove);
	      }
	      var add = Array.prototype.slice.call(arguments, 2);
	      var res = this.related.splice.bind(this.related, idx, numRemove).apply(this.related, add);
	      if (!opts.disableevents) this.registerSpliceChange(idx, added, removed);
	      return res;
	    }.bind(this);
	  },
	  clearReverseRelated: function clearReverseRelated(opts) {
	    opts = opts || {};
	    var self = this;
	    if (this.related) {
	      var reverseProxy = this.reverseProxyForInstance(this.related);
	      var reverseProxies = util.isArray(reverseProxy) ? reverseProxy : [reverseProxy];
	      reverseProxies.forEach(function (p) {
	        if (util.isArray(p.related)) {
	          var idx = p.related.indexOf(self.object);
	          p.makeChangesToRelatedWithoutObservations(function () {
	            p.splicer(opts)(idx, 1);
	          });
	        } else {
	          p.setIdAndRelated(null, opts);
	        }
	      });
	    }
	  },
	  setIdAndRelatedReverse: function setIdAndRelatedReverse(obj, opts) {
	    var self = this;
	    var reverseProxy = this.reverseProxyForInstance(obj);
	    var reverseProxies = util.isArray(reverseProxy) ? reverseProxy : [reverseProxy];
	    reverseProxies.forEach(function (p) {
	      if (util.isArray(p.related)) {
	        p.makeChangesToRelatedWithoutObservations(function () {
	          p.splicer(opts)(p.related.length, 0, self.object);
	        });
	      } else {
	        p.clearReverseRelated(opts);
	        p.setIdAndRelated(self.object, opts);
	      }
	    });
	  },
	  makeChangesToRelatedWithoutObservations: function makeChangesToRelatedWithoutObservations(f) {
	    if (this.related) {
	      this.related.arrayObserver.close();
	      this.related.arrayObserver = null;
	      f();
	      this.wrapArray(this.related);
	    } else {
	      f();
	    }
	  },
	  /**
	   * Get old value that is sent out in emissions.
	   * @returns {*}
	   * @private
	   */
	  _getOldValueForSetChangeEvent: function _getOldValueForSetChangeEvent() {
	    var oldValue = this.related;
	    if (util.isArray(oldValue) && !oldValue.length) {
	      oldValue = null;
	    }
	    return oldValue;
	  },
	  registerSetChange: function registerSetChange(newValue, oldValue) {
	    var proxyObject = this.object;
	    if (!proxyObject) throw new InternalSiestaError('Proxy must have an object associated');
	    var model = proxyObject.model.name;
	    var collectionName = proxyObject.collectionName;
	    // We take [] == null == undefined in the case of relationships.
	    modelEvents.emit({
	      collection: collectionName,
	      model: model,
	      localId: proxyObject.localId,
	      field: this.getForwardName(),
	      old: oldValue,
	      new: newValue,
	      type: ModelEventType.Set,
	      obj: proxyObject
	    });
	  },
	
	  _getRemovedForSpliceChangeEvent: function _getRemovedForSpliceChangeEvent(idx, numRemove) {
	    var removed = this.related ? this.related.slice(idx, idx + numRemove) : null;
	    return removed;
	  },
	
	  _getAddedForSpliceChangeEvent: function _getAddedForSpliceChangeEvent(args) {
	    var add = Array.prototype.slice.call(args, 2),
	        added = add.length ? add : [];
	    return added;
	  },
	
	  registerSpliceChange: function registerSpliceChange(idx, added, removed) {
	    var model = this.object.model.name,
	        coll = this.object.collectionName;
	    modelEvents.emit({
	      collection: coll,
	      model: model,
	      localId: this.object.localId,
	      field: this.getForwardName(),
	      index: idx,
	      removed: removed,
	      added: added,
	      type: ModelEventType.Splice,
	      obj: this.object
	    });
	  },
	  wrapArray: function wrapArray(arr) {
	    var self = this;
	    wrapArrayForAttributes(arr, this.reverseName, this.object);
	    if (!arr.arrayObserver) {
	      arr.arrayObserver = new ArrayObserver(arr);
	      var observerFunction = function observerFunction(splices) {
	        splices.forEach(function (splice) {
	          var added = splice.addedCount ? arr.slice(splice.index, splice.index + splice.addedCount) : [];
	          var model = self.getForwardModel();
	          modelEvents.emit({
	            collection: model.collectionName,
	            model: model.name,
	            localId: self.object.localId,
	            field: self.getForwardName(),
	            removed: splice.removed,
	            added: added,
	            type: ModelEventType.Splice,
	            obj: self.object
	          });
	        });
	      };
	      arr.arrayObserver.open(observerFunction);
	    }
	  },
	  splice: function splice() {
	    this.splicer({}).apply(this, arguments);
	  }
	
	});
	
	module.exports = RelationshipProxy;

/***/ },
/* 35 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	var RelationshipProxy = __webpack_require__(34),
	    util = __webpack_require__(4),
	    SiestaModel = __webpack_require__(21);
	
	/**
	 * [OneToOneProxy description]
	 * @param {Object} opts
	 */
	function OneToOneProxy(opts) {
	  RelationshipProxy.call(this, opts);
	}
	
	OneToOneProxy.prototype = Object.create(RelationshipProxy.prototype);
	
	util.extend(OneToOneProxy.prototype, {
	  /**
	   * Validate the object that we're setting
	   * @param obj
	   * @returns {string|null} An error message or null
	   */
	  validate: function validate(obj) {
	    if (Object.prototype.toString.call(obj) == '[object Array]') {
	      return 'Cannot assign array to one to one relationship';
	    } else if (!obj instanceof SiestaModel) {}
	    return null;
	  },
	  set: function set(obj, opts) {
	    this.checkInstalled();
	    if (obj) {
	      var errorMessage;
	      if (errorMessage = this.validate(obj)) {
	        return errorMessage;
	      } else {
	        this.clearReverseRelated(opts);
	        this.setIdAndRelated(obj, opts);
	        this.setIdAndRelatedReverse(obj, opts);
	      }
	    } else {
	      this.clearReverseRelated(opts);
	      this.setIdAndRelated(obj, opts);
	    }
	  },
	  get: function get(cb) {
	    return util.promise(cb, function (cb) {
	      cb(null, this.related);
	    }.bind(this));
	  }
	});
	
	module.exports = OneToOneProxy;

/***/ },
/* 36 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	/**
	 * @module relationships
	 */
	
	var RelationshipProxy = __webpack_require__(34),
	    util = __webpack_require__(4),
	    modelEvents = __webpack_require__(22),
	    events = __webpack_require__(23),
	    wrapArrayForAttributes = events.wrapArray,
	    ArrayObserver = __webpack_require__(5).ArrayObserver,
	    ModelEventType = __webpack_require__(22).ModelEventType;
	
	/**
	 * [ManyToManyProxy description]
	 * @param {Object} opts
	 */
	function ManyToManyProxy(opts) {
	  RelationshipProxy.call(this, opts);
	  this.related = [];
	  this.relatedCancelListeners = {};
	  if (this.isReverse) {
	    this.related = [];
	    //this.forwardModel.on(modelEvents.ModelEventType.Remove, function(e) {
	    //  if (e.field == e.forwardName) {
	    //    var idx = this.related.indexOf(e.obj);
	    //    if (idx > -1) {
	    //      var removed = this.related.splice(idx, 1);
	    //    }
	    //    modelEvents.emit({
	    //      collection: this.reverseModel.collectionName,
	    //      model: this.reverseModel.name,
	    //      localId: this.object.localId,
	    //      field: this.reverseName,
	    //      removed: removed,
	    //      added: [],
	    //      type: ModelEventType.Splice,
	    //      index: idx,
	    //      obj: this.object
	    //    });
	    //  }
	    //}.bind(this));
	  }
	}
	
	ManyToManyProxy.prototype = Object.create(RelationshipProxy.prototype);
	
	util.extend(ManyToManyProxy.prototype, {
	  clearReverse: function clearReverse(removed) {
	    var self = this;
	    removed.forEach(function (removedObject) {
	      var reverseProxy = self.reverseProxyForInstance(removedObject);
	      var idx = reverseProxy.related.indexOf(self.object);
	      reverseProxy.makeChangesToRelatedWithoutObservations(function () {
	        reverseProxy.splice(idx, 1);
	      });
	    });
	  },
	  setReverseOfAdded: function setReverseOfAdded(added) {
	    var self = this;
	    added.forEach(function (addedObject) {
	      var reverseProxy = self.reverseProxyForInstance(addedObject);
	      reverseProxy.makeChangesToRelatedWithoutObservations(function () {
	        reverseProxy.splice(0, 0, self.object);
	      });
	    });
	  },
	  wrapArray: function wrapArray(arr) {
	    var self = this;
	    wrapArrayForAttributes(arr, this.reverseName, this.object);
	    if (!arr.arrayObserver) {
	      arr.arrayObserver = new ArrayObserver(arr);
	      var observerFunction = function observerFunction(splices) {
	        splices.forEach(function (splice) {
	          var added = splice.addedCount ? arr.slice(splice.index, splice.index + splice.addedCount) : [];
	          var removed = splice.removed;
	          self.clearReverse(removed);
	          self.setReverseOfAdded(added);
	          var model = self.getForwardModel();
	          modelEvents.emit({
	            collection: model.collectionName,
	            model: model.name,
	            localId: self.object.localId,
	            field: self.getForwardName(),
	            removed: removed,
	            added: added,
	            type: ModelEventType.Splice,
	            index: splice.index,
	            obj: self.object
	          });
	        });
	      };
	      arr.arrayObserver.open(observerFunction);
	    }
	  },
	  get: function get(cb) {
	    return util.promise(cb, function (cb) {
	      cb(null, this.related);
	    }.bind(this));
	  },
	  validate: function validate(obj) {
	    if (Object.prototype.toString.call(obj) != '[object Array]') {
	      return 'Cannot assign scalar to many to many';
	    }
	    return null;
	  },
	  set: function set(obj, opts) {
	    this.checkInstalled();
	    var self = this;
	    if (obj) {
	      var errorMessage;
	      if (errorMessage = this.validate(obj)) {
	        return errorMessage;
	      } else {
	        this.clearReverseRelated(opts);
	        self.setIdAndRelated(obj, opts);
	        this.wrapArray(obj);
	        self.setIdAndRelatedReverse(obj, opts);
	      }
	    } else {
	      this.clearReverseRelated(opts);
	      self.setIdAndRelated(obj, opts);
	    }
	  },
	  install: function install(obj) {
	    RelationshipProxy.prototype.install.call(this, obj);
	    this.wrapArray(this.related);
	    obj['splice' + util.capitaliseFirstLetter(this.reverseName)] = this.splice.bind(this);
	  },
	  registerRemovalListener: function registerRemovalListener(obj) {
	    this.relatedCancelListeners[obj.localId] = obj.on('*', function (e) {}.bind(this));
	  }
	});
	
	module.exports = ManyToManyProxy;

/***/ }
/******/ ]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vd2VicGFjay9ib290c3RyYXAgODFjNjdkYmE2MDY1OTNlYTEyZDEiLCJ3ZWJwYWNrOi8vLy4vfi9iYWJlbC1yZWdlbmVyYXRvci1ydW50aW1lL3J1bnRpbWUuanMiLCJ3ZWJwYWNrOi8vLy4vfi9ub2RlLWxpYnMtYnJvd3Nlci9+L3Byb2Nlc3MvYnJvd3Nlci5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL2luZGV4LmpzIiwid2VicGFjazovLy8uL2NvcmUvdXRpbC5qcyIsIndlYnBhY2s6Ly8vLi92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZS5qcyIsIndlYnBhY2s6Ly8vKHdlYnBhY2spL2J1aWxkaW4vbW9kdWxlLmpzIiwid2VicGFjazovLy8uL34vYXJnc2FycmF5L2luZGV4LmpzIiwid2VicGFjazovLy8uL2NvcmUvZXJyb3IuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9jb2xsZWN0aW9uUmVnaXN0cnkuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9jb2xsZWN0aW9uLmpzIiwid2VicGFjazovLy8uL2NvcmUvbG9nLmpzIiwid2VicGFjazovLy8uL34vZGVidWcvYnJvd3Nlci5qcyIsIndlYnBhY2s6Ly8vLi9+L2RlYnVnL2RlYnVnLmpzIiwid2VicGFjazovLy8uL34vbXMvaW5kZXguanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9tb2RlbC5qcyIsIndlYnBhY2s6Ly8vLi9+L3RpbWVycy1icm93c2VyaWZ5L21haW4uanMiLCJ3ZWJwYWNrOi8vLy4vfi90aW1lcnMtYnJvd3NlcmlmeS9+L3Byb2Nlc3MvYnJvd3Nlci5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL1JlbGF0aW9uc2hpcFR5cGUuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9RdWVyeS5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL2NhY2hlLmpzIiwid2VicGFjazovLy8uL2NvcmUvTW9kZWxJbnN0YW5jZS5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL21vZGVsRXZlbnRzLmpzIiwid2VicGFjazovLy8uL2NvcmUvZXZlbnRzLmpzIiwid2VicGFjazovLy8uL34vZXZlbnRzL2V2ZW50cy5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL0NoYWluLmpzIiwid2VicGFjazovLy8uL2NvcmUvUXVlcnlTZXQuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9tYXBwaW5nT3BlcmF0aW9uLmpzIiwid2VicGFjazovLy8uL34vZXh0ZW5kL2luZGV4LmpzIiwid2VicGFjazovLy8uL2NvcmUvQ29uZGl0aW9uLmpzIiwid2VicGFjazovLy8uL2NvcmUvUGxhY2Vob2xkZXIuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9SZWFjdGl2ZVF1ZXJ5LmpzIiwid2VicGFjazovLy8uL2NvcmUvaW5zdGFuY2VGYWN0b3J5LmpzIiwid2VicGFjazovLy8uL2NvcmUvT25lVG9NYW55UHJveHkuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9SZWxhdGlvbnNoaXBQcm94eS5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL09uZVRvT25lUHJveHkuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9NYW55VG9NYW55UHJveHkuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLHVCQUFlO0FBQ2Y7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7OztBQUdBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7Ozs7Ozs7Ozs7Ozs7OztBQ3RDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBLGlCQUFnQjtBQUNoQjtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxlQUFjO0FBQ2QsTUFBSztBQUNMLGVBQWM7QUFDZDtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSwyQ0FBMEMsV0FBVztBQUNyRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxZQUFXO0FBQ1g7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFTO0FBQ1Q7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQSw0QkFBMkI7QUFDM0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVM7QUFDVDs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVB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QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUEsSUFBRztBQUNILHFCQUFvQixTQUFTO0FBQzdCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7Ozs7Ozs7O0FDNVNBLEtBQUksWUFBWSxvQkFBUSxDQUFSLENBQVo7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBaUJKLFVBQVMsS0FBVCxDQUFlLElBQWYsRUFBcUI7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S0FBSyxRQUFMLENBQWMsR0FBZCxDQUFmLEVBQW1DO0FBQ3JDLGdCQUFPLFlBQVAsQ0FEcUM7UUFBdkMsTUFHSztBQUNILGNBQUssbUJBQUwsQ0FBeUIsSUFBekIsRUFERztBQUVILGNBQUssZUFBTCxDQUFxQixHQUFyQixFQUEwQixJQUExQixFQUZHO0FBR0gsY0FBSyxTQUFMLENBQWUsR0FBZixFQUhHO0FBSUgsY0FBSyxzQkFBTCxDQUE0QixHQUE1QixFQUFpQyxJQUFqQyxFQUpHO1FBSEw7TUFGRixNQVlLO0FBQ0gsWUFBSyxtQkFBTCxDQUF5QixJQUF6QixFQURHO0FBRUgsWUFBSyxlQUFMLENBQXFCLEdBQXJCLEVBQTBCLElBQTFCLEVBRkc7TUFaTDtJQUhHO0FBb0JMLFlBQVMsaUJBQVMsR0FBVCxFQUFjO0FBQ3JCLHVCQUFrQixTQUFsQixDQUE0QixPQUE1QixDQUFvQyxJQUFwQyxDQUF5QyxJQUF6QyxFQUErQyxHQUEvQyxFQURxQjtBQUVyQixVQUFLLFNBQUwsQ0FBZSxLQUFLLE9BQUwsQ0FBZixDQUZxQjtBQUdyQixTQUFLLFdBQVcsS0FBSyxxQkFBTCxDQUEyQixLQUFLLFdBQUwsQ0FBdEMsQ0FBTCxHQUFpRSxLQUFLLE1BQUwsQ0FBWSxJQUFaLENBQWlCLElBQWpCLENBQWpFLENBSHFCO0lBQWQ7QUFLVCw0QkFBeUIsaUNBQVMsR0FBVCxFQUFjO0FBQ3JDLFVBQUssc0JBQUwsQ0FBNEIsSUFBSSxPQUFKLENBQTVCLEdBQTJDLElBQUksRUFBSixDQUFPLEdBQVAsRUFBWSxVQUFTLENBQVQsRUFBWSxFQUFaLENBRXJELElBRnFELENBRWhELElBRmdELENBQVosQ0FBM0MsQ0FEcUM7SUFBZDtFQXBGM0I7O0FBMkZBLFFBQU8sT0FBUCxHQUFpQixlQUFqQixDIiwiZmlsZSI6InNpZXN0YS5qcyIsInNvdXJjZXNDb250ZW50IjpbIiBcdC8vIFRoZSBtb2R1bGUgY2FjaGVcbiBcdHZhciBpbnN0YWxsZWRNb2R1bGVzID0ge307XG5cbiBcdC8vIFRoZSByZXF1aXJlIGZ1bmN0aW9uXG4gXHRmdW5jdGlvbiBfX3dlYnBhY2tfcmVxdWlyZV9fKG1vZHVsZUlkKSB7XG5cbiBcdFx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG4gXHRcdGlmKGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdKVxuIFx0XHRcdHJldHVybiBpbnN0YWxsZWRNb2R1bGVzW21vZHVsZUlkXS5leHBvcnRzO1xuXG4gXHRcdC8vIENyZWF0ZSBhIG5ldyBtb2R1bGUgKGFuZCBwdXQgaXQgaW50byB0aGUgY2FjaGUpXG4gXHRcdHZhciBtb2R1bGUgPSBpbnN0YWxsZWRNb2R1bGVzW21vZHVsZUlkXSA9IHtcbiBcdFx0XHRleHBvcnRzOiB7fSxcbiBcdFx0XHRpZDogbW9kdWxlSWQsXG4gXHRcdFx0bG9hZGVkOiBmYWxzZVxuIFx0XHR9O1xuXG4gXHRcdC8vIEV4ZWN1dGUgdGhlIG1vZHVsZSBmdW5jdGlvblxuIFx0XHRtb2R1bGVzW21vZHVsZUlkXS5jYWxsKG1vZHVsZS5leHBvcnRzLCBtb2R1bGUsIG1vZHVsZS5leHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKTtcblxuIFx0XHQvLyBGbGFnIHRoZSBtb2R1bGUgYXMgbG9hZGVkXG4gXHRcdG1vZHVsZS5sb2FkZWQgPSB0cnVlO1xuXG4gXHRcdC8vIFJldHVybiB0aGUgZXhwb3J0cyBvZiB0aGUgbW9kdWxlXG4gXHRcdHJldHVybiBtb2R1bGUuZXhwb3J0cztcbiBcdH1cblxuXG4gXHQvLyBleHBvc2UgdGhlIG1vZHVsZXMgb2JqZWN0IChfX3dlYnBhY2tfbW9kdWxlc19fKVxuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5tID0gbW9kdWxlcztcblxuIFx0Ly8gZXhwb3NlIHRoZSBtb2R1bGUgY2FjaGVcbiBcdF9fd2VicGFja19yZXF1aXJlX18uYyA9IGluc3RhbGxlZE1vZHVsZXM7XG5cbiBcdC8vIF9fd2VicGFja19wdWJsaWNfcGF0aF9fXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLnAgPSBcIlwiO1xuXG4gXHQvLyBMb2FkIGVudHJ5IG1vZHVsZSBhbmQgcmV0dXJuIGV4cG9ydHNcbiBcdHJldHVybiBfX3dlYnBhY2tfcmVxdWlyZV9fKDApO1xuXG5cblxuLyoqIFdFQlBBQ0sgRk9PVEVSICoqXG4gKiogd2VicGFjay9ib290c3RyYXAgODFjNjdkYmE2MDY1OTNlYTEyZDFcbiAqKi8iLCIvKipcbiAqIENvcHlyaWdodCAoYykgMjAxNCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBodHRwczovL3Jhdy5naXRodWIuY29tL2ZhY2Vib29rL3JlZ2VuZXJhdG9yL21hc3Rlci9MSUNFTlNFIGZpbGUuIEFuXG4gKiBhZGRpdGlvbmFsIGdyYW50IG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW5cbiAqIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqL1xuXG4hKGZ1bmN0aW9uKGdsb2JhbCkge1xuICBcInVzZSBzdHJpY3RcIjtcblxuICB2YXIgaGFzT3duID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcbiAgdmFyIHVuZGVmaW5lZDsgLy8gTW9yZSBjb21wcmVzc2libGUgdGhhbiB2b2lkIDAuXG4gIHZhciBpdGVyYXRvclN5bWJvbCA9XG4gICAgdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIFN5bWJvbC5pdGVyYXRvciB8fCBcIkBAaXRlcmF0b3JcIjtcblxuICB2YXIgaW5Nb2R1bGUgPSB0eXBlb2YgbW9kdWxlID09PSBcIm9iamVjdFwiO1xuICB2YXIgcnVudGltZSA9IGdsb2JhbC5yZWdlbmVyYXRvclJ1bnRpbWU7XG4gIGlmIChydW50aW1lKSB7XG4gICAgaWYgKGluTW9kdWxlKSB7XG4gICAgICAvLyBJZiByZWdlbmVyYXRvclJ1bnRpbWUgaXMgZGVmaW5lZCBnbG9iYWxseSBhbmQgd2UncmUgaW4gYSBtb2R1bGUsXG4gICAgICAvLyBtYWtlIHRoZSBleHBvcnRzIG9iamVjdCBpZGVudGljYWwgdG8gcmVnZW5lcmF0b3JSdW50aW1lLlxuICAgICAgbW9kdWxlLmV4cG9ydHMgPSBydW50aW1lO1xuICAgIH1cbiAgICAvLyBEb24ndCBib3RoZXIgZXZhbHVhdGluZyB0aGUgcmVzdCBvZiB0aGlzIGZpbGUgaWYgdGhlIHJ1bnRpbWUgd2FzXG4gICAgLy8gYWxyZWFkeSBkZWZpbmVkIGdsb2JhbGx5LlxuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIERlZmluZSB0aGUgcnVudGltZSBnbG9iYWxseSAoYXMgZXhwZWN0ZWQgYnkgZ2VuZXJhdGVkIGNvZGUpIGFzIGVpdGhlclxuICAvLyBtb2R1bGUuZXhwb3J0cyAoaWYgd2UncmUgaW4gYSBtb2R1bGUpIG9yIGEgbmV3LCBlbXB0eSBvYmplY3QuXG4gIHJ1bnRpbWUgPSBnbG9iYWwucmVnZW5lcmF0b3JSdW50aW1lID0gaW5Nb2R1bGUgPyBtb2R1bGUuZXhwb3J0cyA6IHt9O1xuXG4gIGZ1bmN0aW9uIHdyYXAoaW5uZXJGbiwgb3V0ZXJGbiwgc2VsZiwgdHJ5TG9jc0xpc3QpIHtcbiAgICAvLyBJZiBvdXRlckZuIHByb3ZpZGVkLCB0aGVuIG91dGVyRm4ucHJvdG90eXBlIGluc3RhbmNlb2YgR2VuZXJhdG9yLlxuICAgIHZhciBnZW5lcmF0b3IgPSBPYmplY3QuY3JlYXRlKChvdXRlckZuIHx8IEdlbmVyYXRvcikucHJvdG90eXBlKTtcbiAgICB2YXIgY29udGV4dCA9IG5ldyBDb250ZXh0KHRyeUxvY3NMaXN0IHx8IFtdKTtcblxuICAgIC8vIFRoZSAuX2ludm9rZSBtZXRob2QgdW5pZmllcyB0aGUgaW1wbGVtZW50YXRpb25zIG9mIHRoZSAubmV4dCxcbiAgICAvLyAudGhyb3csIGFuZCAucmV0dXJuIG1ldGhvZHMuXG4gICAgZ2VuZXJhdG9yLl9pbnZva2UgPSBtYWtlSW52b2tlTWV0aG9kKGlubmVyRm4sIHNlbGYsIGNvbnRleHQpO1xuXG4gICAgcmV0dXJuIGdlbmVyYXRvcjtcbiAgfVxuICBydW50aW1lLndyYXAgPSB3cmFwO1xuXG4gIC8vIFRyeS9jYXRjaCBoZWxwZXIgdG8gbWluaW1pemUgZGVvcHRpbWl6YXRpb25zLiBSZXR1cm5zIGEgY29tcGxldGlvblxuICAvLyByZWNvcmQgbGlrZSBjb250ZXh0LnRyeUVudHJpZXNbaV0uY29tcGxldGlvbi4gVGhpcyBpbnRlcmZhY2UgY291bGRcbiAgLy8gaGF2ZSBiZWVuIChhbmQgd2FzIHByZXZpb3VzbHkpIGRlc2lnbmVkIHRvIHRha2UgYSBjbG9zdXJlIHRvIGJlXG4gIC8vIGludm9rZWQgd2l0aG91dCBhcmd1bWVudHMsIGJ1dCBpbiBhbGwgdGhlIGNhc2VzIHdlIGNhcmUgYWJvdXQgd2VcbiAgLy8gYWxyZWFkeSBoYXZlIGFuIGV4aXN0aW5nIG1ldGhvZCB3ZSB3YW50IHRvIGNhbGwsIHNvIHRoZXJlJ3Mgbm8gbmVlZFxuICAvLyB0byBjcmVhdGUgYSBuZXcgZnVuY3Rpb24gb2JqZWN0LiBXZSBjYW4gZXZlbiBnZXQgYXdheSB3aXRoIGFzc3VtaW5nXG4gIC8vIHRoZSBtZXRob2QgdGFrZXMgZXhhY3RseSBvbmUgYXJndW1lbnQsIHNpbmNlIHRoYXQgaGFwcGVucyB0byBiZSB0cnVlXG4gIC8vIGluIGV2ZXJ5IGNhc2UsIHNvIHdlIGRvbid0IGhhdmUgdG8gdG91Y2ggdGhlIGFyZ3VtZW50cyBvYmplY3QuIFRoZVxuICAvLyBvbmx5IGFkZGl0aW9uYWwgYWxsb2NhdGlvbiByZXF1aXJlZCBpcyB0aGUgY29tcGxldGlvbiByZWNvcmQsIHdoaWNoXG4gIC8vIGhhcyBhIHN0YWJsZSBzaGFwZSBhbmQgc28gaG9wZWZ1bGx5IHNob3VsZCBiZSBjaGVhcCB0byBhbGxvY2F0ZS5cbiAgZnVuY3Rpb24gdHJ5Q2F0Y2goZm4sIG9iaiwgYXJnKSB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiB7IHR5cGU6IFwibm9ybWFsXCIsIGFyZzogZm4uY2FsbChvYmosIGFyZykgfTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHJldHVybiB7IHR5cGU6IFwidGhyb3dcIiwgYXJnOiBlcnIgfTtcbiAgICB9XG4gIH1cblxuICB2YXIgR2VuU3RhdGVTdXNwZW5kZWRTdGFydCA9IFwic3VzcGVuZGVkU3RhcnRcIjtcbiAgdmFyIEdlblN0YXRlU3VzcGVuZGVkWWllbGQgPSBcInN1c3BlbmRlZFlpZWxkXCI7XG4gIHZhciBHZW5TdGF0ZUV4ZWN1dGluZyA9IFwiZXhlY3V0aW5nXCI7XG4gIHZhciBHZW5TdGF0ZUNvbXBsZXRlZCA9IFwiY29tcGxldGVkXCI7XG5cbiAgLy8gUmV0dXJuaW5nIHRoaXMgb2JqZWN0IGZyb20gdGhlIGlubmVyRm4gaGFzIHRoZSBzYW1lIGVmZmVjdCBhc1xuICAvLyBicmVha2luZyBvdXQgb2YgdGhlIGRpc3BhdGNoIHN3aXRjaCBzdGF0ZW1lbnQuXG4gIHZhciBDb250aW51ZVNlbnRpbmVsID0ge307XG5cbiAgLy8gRHVtbXkgY29uc3RydWN0b3IgZnVuY3Rpb25zIHRoYXQgd2UgdXNlIGFzIHRoZSAuY29uc3RydWN0b3IgYW5kXG4gIC8vIC5jb25zdHJ1Y3Rvci5wcm90b3R5cGUgcHJvcGVydGllcyBmb3IgZnVuY3Rpb25zIHRoYXQgcmV0dXJuIEdlbmVyYXRvclxuICAvLyBvYmplY3RzLiBGb3IgZnVsbCBzcGVjIGNvbXBsaWFuY2UsIHlvdSBtYXkgd2lzaCB0byBjb25maWd1cmUgeW91clxuICAvLyBtaW5pZmllciBub3QgdG8gbWFuZ2xlIHRoZSBuYW1lcyBvZiB0aGVzZSB0d28gZnVuY3Rpb25zLlxuICBmdW5jdGlvbiBHZW5lcmF0b3IoKSB7fVxuICBmdW5jdGlvbiBHZW5lcmF0b3JGdW5jdGlvbigpIHt9XG4gIGZ1bmN0aW9uIEdlbmVyYXRvckZ1bmN0aW9uUHJvdG90eXBlKCkge31cblxuICB2YXIgR3AgPSBHZW5lcmF0b3JGdW5jdGlvblByb3RvdHlwZS5wcm90b3R5cGUgPSBHZW5lcmF0b3IucHJvdG90eXBlO1xuICBHZW5lcmF0b3JGdW5jdGlvbi5wcm90b3R5cGUgPSBHcC5jb25zdHJ1Y3RvciA9IEdlbmVyYXRvckZ1bmN0aW9uUHJvdG90eXBlO1xuICBHZW5lcmF0b3JGdW5jdGlvblByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IEdlbmVyYXRvckZ1bmN0aW9uO1xuICBHZW5lcmF0b3JGdW5jdGlvbi5kaXNwbGF5TmFtZSA9IFwiR2VuZXJhdG9yRnVuY3Rpb25cIjtcblxuICAvLyBIZWxwZXIgZm9yIGRlZmluaW5nIHRoZSAubmV4dCwgLnRocm93LCBhbmQgLnJldHVybiBtZXRob2RzIG9mIHRoZVxuICAvLyBJdGVyYXRvciBpbnRlcmZhY2UgaW4gdGVybXMgb2YgYSBzaW5nbGUgLl9pbnZva2UgbWV0aG9kLlxuICBmdW5jdGlvbiBkZWZpbmVJdGVyYXRvck1ldGhvZHMocHJvdG90eXBlKSB7XG4gICAgW1wibmV4dFwiLCBcInRocm93XCIsIFwicmV0dXJuXCJdLmZvckVhY2goZnVuY3Rpb24obWV0aG9kKSB7XG4gICAgICBwcm90b3R5cGVbbWV0aG9kXSA9IGZ1bmN0aW9uKGFyZykge1xuICAgICAgICByZXR1cm4gdGhpcy5faW52b2tlKG1ldGhvZCwgYXJnKTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBydW50aW1lLmlzR2VuZXJhdG9yRnVuY3Rpb24gPSBmdW5jdGlvbihnZW5GdW4pIHtcbiAgICB2YXIgY3RvciA9IHR5cGVvZiBnZW5GdW4gPT09IFwiZnVuY3Rpb25cIiAmJiBnZW5GdW4uY29uc3RydWN0b3I7XG4gICAgcmV0dXJuIGN0b3JcbiAgICAgID8gY3RvciA9PT0gR2VuZXJhdG9yRnVuY3Rpb24gfHxcbiAgICAgICAgLy8gRm9yIHRoZSBuYXRpdmUgR2VuZXJhdG9yRnVuY3Rpb24gY29uc3RydWN0b3IsIHRoZSBiZXN0IHdlIGNhblxuICAgICAgICAvLyBkbyBpcyB0byBjaGVjayBpdHMgLm5hbWUgcHJvcGVydHkuXG4gICAgICAgIChjdG9yLmRpc3BsYXlOYW1lIHx8IGN0b3IubmFtZSkgPT09IFwiR2VuZXJhdG9yRnVuY3Rpb25cIlxuICAgICAgOiBmYWxzZTtcbiAgfTtcblxuICBydW50aW1lLm1hcmsgPSBmdW5jdGlvbihnZW5GdW4pIHtcbiAgICBpZiAoT2JqZWN0LnNldFByb3RvdHlwZU9mKSB7XG4gICAgICBPYmplY3Quc2V0UHJvdG90eXBlT2YoZ2VuRnVuLCBHZW5lcmF0b3JGdW5jdGlvblByb3RvdHlwZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGdlbkZ1bi5fX3Byb3RvX18gPSBHZW5lcmF0b3JGdW5jdGlvblByb3RvdHlwZTtcbiAgICB9XG4gICAgZ2VuRnVuLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoR3ApO1xuICAgIHJldHVybiBnZW5GdW47XG4gIH07XG5cbiAgLy8gV2l0aGluIHRoZSBib2R5IG9mIGFueSBhc3luYyBmdW5jdGlvbiwgYGF3YWl0IHhgIGlzIHRyYW5zZm9ybWVkIHRvXG4gIC8vIGB5aWVsZCByZWdlbmVyYXRvclJ1bnRpbWUuYXdyYXAoeClgLCBzbyB0aGF0IHRoZSBydW50aW1lIGNhbiB0ZXN0XG4gIC8vIGB2YWx1ZSBpbnN0YW5jZW9mIEF3YWl0QXJndW1lbnRgIHRvIGRldGVybWluZSBpZiB0aGUgeWllbGRlZCB2YWx1ZSBpc1xuICAvLyBtZWFudCB0byBiZSBhd2FpdGVkLiBTb21lIG1heSBjb25zaWRlciB0aGUgbmFtZSBvZiB0aGlzIG1ldGhvZCB0b29cbiAgLy8gY3V0ZXN5LCBidXQgdGhleSBhcmUgY3VybXVkZ2VvbnMuXG4gIHJ1bnRpbWUuYXdyYXAgPSBmdW5jdGlvbihhcmcpIHtcbiAgICByZXR1cm4gbmV3IEF3YWl0QXJndW1lbnQoYXJnKTtcbiAgfTtcblxuICBmdW5jdGlvbiBBd2FpdEFyZ3VtZW50KGFyZykge1xuICAgIHRoaXMuYXJnID0gYXJnO1xuICB9XG5cbiAgZnVuY3Rpb24gQXN5bmNJdGVyYXRvcihnZW5lcmF0b3IpIHtcbiAgICAvLyBUaGlzIGludm9rZSBmdW5jdGlvbiBpcyB3cml0dGVuIGluIGEgc3R5bGUgdGhhdCBhc3N1bWVzIHNvbWVcbiAgICAvLyBjYWxsaW5nIGZ1bmN0aW9uIChvciBQcm9taXNlKSB3aWxsIGhhbmRsZSBleGNlcHRpb25zLlxuICAgIGZ1bmN0aW9uIGludm9rZShtZXRob2QsIGFyZykge1xuICAgICAgdmFyIHJlc3VsdCA9IGdlbmVyYXRvclttZXRob2RdKGFyZyk7XG4gICAgICB2YXIgdmFsdWUgPSByZXN1bHQudmFsdWU7XG4gICAgICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBBd2FpdEFyZ3VtZW50XG4gICAgICAgID8gUHJvbWlzZS5yZXNvbHZlKHZhbHVlLmFyZykudGhlbihpbnZva2VOZXh0LCBpbnZva2VUaHJvdylcbiAgICAgICAgOiBQcm9taXNlLnJlc29sdmUodmFsdWUpLnRoZW4oZnVuY3Rpb24odW53cmFwcGVkKSB7XG4gICAgICAgICAgICAvLyBXaGVuIGEgeWllbGRlZCBQcm9taXNlIGlzIHJlc29sdmVkLCBpdHMgZmluYWwgdmFsdWUgYmVjb21lc1xuICAgICAgICAgICAgLy8gdGhlIC52YWx1ZSBvZiB0aGUgUHJvbWlzZTx7dmFsdWUsZG9uZX0+IHJlc3VsdCBmb3IgdGhlXG4gICAgICAgICAgICAvLyBjdXJyZW50IGl0ZXJhdGlvbi4gSWYgdGhlIFByb21pc2UgaXMgcmVqZWN0ZWQsIGhvd2V2ZXIsIHRoZVxuICAgICAgICAgICAgLy8gcmVzdWx0IGZvciB0aGlzIGl0ZXJhdGlvbiB3aWxsIGJlIHJlamVjdGVkIHdpdGggdGhlIHNhbWVcbiAgICAgICAgICAgIC8vIHJlYXNvbi4gTm90ZSB0aGF0IHJlamVjdGlvbnMgb2YgeWllbGRlZCBQcm9taXNlcyBhcmUgbm90XG4gICAgICAgICAgICAvLyB0aHJvd24gYmFjayBpbnRvIHRoZSBnZW5lcmF0b3IgZnVuY3Rpb24sIGFzIGlzIHRoZSBjYXNlXG4gICAgICAgICAgICAvLyB3aGVuIGFuIGF3YWl0ZWQgUHJvbWlzZSBpcyByZWplY3RlZC4gVGhpcyBkaWZmZXJlbmNlIGluXG4gICAgICAgICAgICAvLyBiZWhhdmlvciBiZXR3ZWVuIHlpZWxkIGFuZCBhd2FpdCBpcyBpbXBvcnRhbnQsIGJlY2F1c2UgaXRcbiAgICAgICAgICAgIC8vIGFsbG93cyB0aGUgY29uc3VtZXIgdG8gZGVjaWRlIHdoYXQgdG8gZG8gd2l0aCB0aGUgeWllbGRlZFxuICAgICAgICAgICAgLy8gcmVqZWN0aW9uIChzd2FsbG93IGl0IGFuZCBjb250aW51ZSwgbWFudWFsbHkgLnRocm93IGl0IGJhY2tcbiAgICAgICAgICAgIC8vIGludG8gdGhlIGdlbmVyYXRvciwgYWJhbmRvbiBpdGVyYXRpb24sIHdoYXRldmVyKS4gV2l0aFxuICAgICAgICAgICAgLy8gYXdhaXQsIGJ5IGNvbnRyYXN0LCB0aGVyZSBpcyBubyBvcHBvcnR1bml0eSB0byBleGFtaW5lIHRoZVxuICAgICAgICAgICAgLy8gcmVqZWN0aW9uIHJlYXNvbiBvdXRzaWRlIHRoZSBnZW5lcmF0b3IgZnVuY3Rpb24sIHNvIHRoZVxuICAgICAgICAgICAgLy8gb25seSBvcHRpb24gaXMgdG8gdGhyb3cgaXQgZnJvbSB0aGUgYXdhaXQgZXhwcmVzc2lvbiwgYW5kXG4gICAgICAgICAgICAvLyBsZXQgdGhlIGdlbmVyYXRvciBmdW5jdGlvbiBoYW5kbGUgdGhlIGV4Y2VwdGlvbi5cbiAgICAgICAgICAgIHJlc3VsdC52YWx1ZSA9IHVud3JhcHBlZDtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBwcm9jZXNzID09PSBcIm9iamVjdFwiICYmIHByb2Nlc3MuZG9tYWluKSB7XG4gICAgICBpbnZva2UgPSBwcm9jZXNzLmRvbWFpbi5iaW5kKGludm9rZSk7XG4gICAgfVxuXG4gICAgdmFyIGludm9rZU5leHQgPSBpbnZva2UuYmluZChnZW5lcmF0b3IsIFwibmV4dFwiKTtcbiAgICB2YXIgaW52b2tlVGhyb3cgPSBpbnZva2UuYmluZChnZW5lcmF0b3IsIFwidGhyb3dcIik7XG4gICAgdmFyIGludm9rZVJldHVybiA9IGludm9rZS5iaW5kKGdlbmVyYXRvciwgXCJyZXR1cm5cIik7XG4gICAgdmFyIHByZXZpb3VzUHJvbWlzZTtcblxuICAgIGZ1bmN0aW9uIGVucXVldWUobWV0aG9kLCBhcmcpIHtcbiAgICAgIGZ1bmN0aW9uIGNhbGxJbnZva2VXaXRoTWV0aG9kQW5kQXJnKCkge1xuICAgICAgICByZXR1cm4gaW52b2tlKG1ldGhvZCwgYXJnKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHByZXZpb3VzUHJvbWlzZSA9XG4gICAgICAgIC8vIElmIGVucXVldWUgaGFzIGJlZW4gY2FsbGVkIGJlZm9yZSwgdGhlbiB3ZSB3YW50IHRvIHdhaXQgdW50aWxcbiAgICAgICAgLy8gYWxsIHByZXZpb3VzIFByb21pc2VzIGhhdmUgYmVlbiByZXNvbHZlZCBiZWZvcmUgY2FsbGluZyBpbnZva2UsXG4gICAgICAgIC8vIHNvIHRoYXQgcmVzdWx0cyBhcmUgYWx3YXlzIGRlbGl2ZXJlZCBpbiB0aGUgY29ycmVjdCBvcmRlci4gSWZcbiAgICAgICAgLy8gZW5xdWV1ZSBoYXMgbm90IGJlZW4gY2FsbGVkIGJlZm9yZSwgdGhlbiBpdCBpcyBpbXBvcnRhbnQgdG9cbiAgICAgICAgLy8gY2FsbCBpbnZva2UgaW1tZWRpYXRlbHksIHdpdGhvdXQgd2FpdGluZyBvbiBhIGNhbGxiYWNrIHRvIGZpcmUsXG4gICAgICAgIC8vIHNvIHRoYXQgdGhlIGFzeW5jIGdlbmVyYXRvciBmdW5jdGlvbiBoYXMgdGhlIG9wcG9ydHVuaXR5IHRvIGRvXG4gICAgICAgIC8vIGFueSBuZWNlc3Nhcnkgc2V0dXAgaW4gYSBwcmVkaWN0YWJsZSB3YXkuIFRoaXMgcHJlZGljdGFiaWxpdHlcbiAgICAgICAgLy8gaXMgd2h5IHRoZSBQcm9taXNlIGNvbnN0cnVjdG9yIHN5bmNocm9ub3VzbHkgaW52b2tlcyBpdHNcbiAgICAgICAgLy8gZXhlY3V0b3IgY2FsbGJhY2ssIGFuZCB3aHkgYXN5bmMgZnVuY3Rpb25zIHN5bmNocm9ub3VzbHlcbiAgICAgICAgLy8gZXhlY3V0ZSBjb2RlIGJlZm9yZSB0aGUgZmlyc3QgYXdhaXQuIFNpbmNlIHdlIGltcGxlbWVudCBzaW1wbGVcbiAgICAgICAgLy8gYXN5bmMgZnVuY3Rpb25zIGluIHRlcm1zIG9mIGFzeW5jIGdlbmVyYXRvcnMsIGl0IGlzIGVzcGVjaWFsbHlcbiAgICAgICAgLy8gaW1wb3J0YW50IHRvIGdldCB0aGlzIHJpZ2h0LCBldmVuIHRob3VnaCBpdCByZXF1aXJlcyBjYXJlLlxuICAgICAgICBwcmV2aW91c1Byb21pc2UgPyBwcmV2aW91c1Byb21pc2UudGhlbihcbiAgICAgICAgICBjYWxsSW52b2tlV2l0aE1ldGhvZEFuZEFyZyxcbiAgICAgICAgICAvLyBBdm9pZCBwcm9wYWdhdGluZyBmYWlsdXJlcyB0byBQcm9taXNlcyByZXR1cm5lZCBieSBsYXRlclxuICAgICAgICAgIC8vIGludm9jYXRpb25zIG9mIHRoZSBpdGVyYXRvci5cbiAgICAgICAgICBjYWxsSW52b2tlV2l0aE1ldGhvZEFuZEFyZ1xuICAgICAgICApIDogbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUpIHtcbiAgICAgICAgICByZXNvbHZlKGNhbGxJbnZva2VXaXRoTWV0aG9kQW5kQXJnKCkpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBEZWZpbmUgdGhlIHVuaWZpZWQgaGVscGVyIG1ldGhvZCB0aGF0IGlzIHVzZWQgdG8gaW1wbGVtZW50IC5uZXh0LFxuICAgIC8vIC50aHJvdywgYW5kIC5yZXR1cm4gKHNlZSBkZWZpbmVJdGVyYXRvck1ldGhvZHMpLlxuICAgIHRoaXMuX2ludm9rZSA9IGVucXVldWU7XG4gIH1cblxuICBkZWZpbmVJdGVyYXRvck1ldGhvZHMoQXN5bmNJdGVyYXRvci5wcm90b3R5cGUpO1xuXG4gIC8vIE5vdGUgdGhhdCBzaW1wbGUgYXN5bmMgZnVuY3Rpb25zIGFyZSBpbXBsZW1lbnRlZCBvbiB0b3Agb2ZcbiAgLy8gQXN5bmNJdGVyYXRvciBvYmplY3RzOyB0aGV5IGp1c3QgcmV0dXJuIGEgUHJvbWlzZSBmb3IgdGhlIHZhbHVlIG9mXG4gIC8vIHRoZSBmaW5hbCByZXN1bHQgcHJvZHVjZWQgYnkgdGhlIGl0ZXJhdG9yLlxuICBydW50aW1lLmFzeW5jID0gZnVuY3Rpb24oaW5uZXJGbiwgb3V0ZXJGbiwgc2VsZiwgdHJ5TG9jc0xpc3QpIHtcbiAgICB2YXIgaXRlciA9IG5ldyBBc3luY0l0ZXJhdG9yKFxuICAgICAgd3JhcChpbm5lckZuLCBvdXRlckZuLCBzZWxmLCB0cnlMb2NzTGlzdClcbiAgICApO1xuXG4gICAgcmV0dXJuIHJ1bnRpbWUuaXNHZW5lcmF0b3JGdW5jdGlvbihvdXRlckZuKVxuICAgICAgPyBpdGVyIC8vIElmIG91dGVyRm4gaXMgYSBnZW5lcmF0b3IsIHJldHVybiB0aGUgZnVsbCBpdGVyYXRvci5cbiAgICAgIDogaXRlci5uZXh0KCkudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgICByZXR1cm4gcmVzdWx0LmRvbmUgPyByZXN1bHQudmFsdWUgOiBpdGVyLm5leHQoKTtcbiAgICAgICAgfSk7XG4gIH07XG5cbiAgZnVuY3Rpb24gbWFrZUludm9rZU1ldGhvZChpbm5lckZuLCBzZWxmLCBjb250ZXh0KSB7XG4gICAgdmFyIHN0YXRlID0gR2VuU3RhdGVTdXNwZW5kZWRTdGFydDtcblxuICAgIHJldHVybiBmdW5jdGlvbiBpbnZva2UobWV0aG9kLCBhcmcpIHtcbiAgICAgIGlmIChzdGF0ZSA9PT0gR2VuU3RhdGVFeGVjdXRpbmcpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiR2VuZXJhdG9yIGlzIGFscmVhZHkgcnVubmluZ1wiKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHN0YXRlID09PSBHZW5TdGF0ZUNvbXBsZXRlZCkge1xuICAgICAgICBpZiAobWV0aG9kID09PSBcInRocm93XCIpIHtcbiAgICAgICAgICB0aHJvdyBhcmc7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBCZSBmb3JnaXZpbmcsIHBlciAyNS4zLjMuMy4zIG9mIHRoZSBzcGVjOlxuICAgICAgICAvLyBodHRwczovL3Blb3BsZS5tb3ppbGxhLm9yZy9+am9yZW5kb3JmZi9lczYtZHJhZnQuaHRtbCNzZWMtZ2VuZXJhdG9ycmVzdW1lXG4gICAgICAgIHJldHVybiBkb25lUmVzdWx0KCk7XG4gICAgICB9XG5cbiAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgIHZhciBkZWxlZ2F0ZSA9IGNvbnRleHQuZGVsZWdhdGU7XG4gICAgICAgIGlmIChkZWxlZ2F0ZSkge1xuICAgICAgICAgIGlmIChtZXRob2QgPT09IFwicmV0dXJuXCIgfHxcbiAgICAgICAgICAgICAgKG1ldGhvZCA9PT0gXCJ0aHJvd1wiICYmIGRlbGVnYXRlLml0ZXJhdG9yW21ldGhvZF0gPT09IHVuZGVmaW5lZCkpIHtcbiAgICAgICAgICAgIC8vIEEgcmV0dXJuIG9yIHRocm93ICh3aGVuIHRoZSBkZWxlZ2F0ZSBpdGVyYXRvciBoYXMgbm8gdGhyb3dcbiAgICAgICAgICAgIC8vIG1ldGhvZCkgYWx3YXlzIHRlcm1pbmF0ZXMgdGhlIHlpZWxkKiBsb29wLlxuICAgICAgICAgICAgY29udGV4dC5kZWxlZ2F0ZSA9IG51bGw7XG5cbiAgICAgICAgICAgIC8vIElmIHRoZSBkZWxlZ2F0ZSBpdGVyYXRvciBoYXMgYSByZXR1cm4gbWV0aG9kLCBnaXZlIGl0IGFcbiAgICAgICAgICAgIC8vIGNoYW5jZSB0byBjbGVhbiB1cC5cbiAgICAgICAgICAgIHZhciByZXR1cm5NZXRob2QgPSBkZWxlZ2F0ZS5pdGVyYXRvcltcInJldHVyblwiXTtcbiAgICAgICAgICAgIGlmIChyZXR1cm5NZXRob2QpIHtcbiAgICAgICAgICAgICAgdmFyIHJlY29yZCA9IHRyeUNhdGNoKHJldHVybk1ldGhvZCwgZGVsZWdhdGUuaXRlcmF0b3IsIGFyZyk7XG4gICAgICAgICAgICAgIGlmIChyZWNvcmQudHlwZSA9PT0gXCJ0aHJvd1wiKSB7XG4gICAgICAgICAgICAgICAgLy8gSWYgdGhlIHJldHVybiBtZXRob2QgdGhyZXcgYW4gZXhjZXB0aW9uLCBsZXQgdGhhdFxuICAgICAgICAgICAgICAgIC8vIGV4Y2VwdGlvbiBwcmV2YWlsIG92ZXIgdGhlIG9yaWdpbmFsIHJldHVybiBvciB0aHJvdy5cbiAgICAgICAgICAgICAgICBtZXRob2QgPSBcInRocm93XCI7XG4gICAgICAgICAgICAgICAgYXJnID0gcmVjb3JkLmFyZztcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAobWV0aG9kID09PSBcInJldHVyblwiKSB7XG4gICAgICAgICAgICAgIC8vIENvbnRpbnVlIHdpdGggdGhlIG91dGVyIHJldHVybiwgbm93IHRoYXQgdGhlIGRlbGVnYXRlXG4gICAgICAgICAgICAgIC8vIGl0ZXJhdG9yIGhhcyBiZWVuIHRlcm1pbmF0ZWQuXG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIHZhciByZWNvcmQgPSB0cnlDYXRjaChcbiAgICAgICAgICAgIGRlbGVnYXRlLml0ZXJhdG9yW21ldGhvZF0sXG4gICAgICAgICAgICBkZWxlZ2F0ZS5pdGVyYXRvcixcbiAgICAgICAgICAgIGFyZ1xuICAgICAgICAgICk7XG5cbiAgICAgICAgICBpZiAocmVjb3JkLnR5cGUgPT09IFwidGhyb3dcIikge1xuICAgICAgICAgICAgY29udGV4dC5kZWxlZ2F0ZSA9IG51bGw7XG5cbiAgICAgICAgICAgIC8vIExpa2UgcmV0dXJuaW5nIGdlbmVyYXRvci50aHJvdyh1bmNhdWdodCksIGJ1dCB3aXRob3V0IHRoZVxuICAgICAgICAgICAgLy8gb3ZlcmhlYWQgb2YgYW4gZXh0cmEgZnVuY3Rpb24gY2FsbC5cbiAgICAgICAgICAgIG1ldGhvZCA9IFwidGhyb3dcIjtcbiAgICAgICAgICAgIGFyZyA9IHJlY29yZC5hcmc7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBEZWxlZ2F0ZSBnZW5lcmF0b3IgcmFuIGFuZCBoYW5kbGVkIGl0cyBvd24gZXhjZXB0aW9ucyBzb1xuICAgICAgICAgIC8vIHJlZ2FyZGxlc3Mgb2Ygd2hhdCB0aGUgbWV0aG9kIHdhcywgd2UgY29udGludWUgYXMgaWYgaXQgaXNcbiAgICAgICAgICAvLyBcIm5leHRcIiB3aXRoIGFuIHVuZGVmaW5lZCBhcmcuXG4gICAgICAgICAgbWV0aG9kID0gXCJuZXh0XCI7XG4gICAgICAgICAgYXJnID0gdW5kZWZpbmVkO1xuXG4gICAgICAgICAgdmFyIGluZm8gPSByZWNvcmQuYXJnO1xuICAgICAgICAgIGlmIChpbmZvLmRvbmUpIHtcbiAgICAgICAgICAgIGNvbnRleHRbZGVsZWdhdGUucmVzdWx0TmFtZV0gPSBpbmZvLnZhbHVlO1xuICAgICAgICAgICAgY29udGV4dC5uZXh0ID0gZGVsZWdhdGUubmV4dExvYztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3RhdGUgPSBHZW5TdGF0ZVN1c3BlbmRlZFlpZWxkO1xuICAgICAgICAgICAgcmV0dXJuIGluZm87XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29udGV4dC5kZWxlZ2F0ZSA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobWV0aG9kID09PSBcIm5leHRcIikge1xuICAgICAgICAgIGNvbnRleHQuX3NlbnQgPSBhcmc7XG5cbiAgICAgICAgICBpZiAoc3RhdGUgPT09IEdlblN0YXRlU3VzcGVuZGVkWWllbGQpIHtcbiAgICAgICAgICAgIGNvbnRleHQuc2VudCA9IGFyZztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29udGV4dC5zZW50ID0gdW5kZWZpbmVkO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChtZXRob2QgPT09IFwidGhyb3dcIikge1xuICAgICAgICAgIGlmIChzdGF0ZSA9PT0gR2VuU3RhdGVTdXNwZW5kZWRTdGFydCkge1xuICAgICAgICAgICAgc3RhdGUgPSBHZW5TdGF0ZUNvbXBsZXRlZDtcbiAgICAgICAgICAgIHRocm93IGFyZztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY29udGV4dC5kaXNwYXRjaEV4Y2VwdGlvbihhcmcpKSB7XG4gICAgICAgICAgICAvLyBJZiB0aGUgZGlzcGF0Y2hlZCBleGNlcHRpb24gd2FzIGNhdWdodCBieSBhIGNhdGNoIGJsb2NrLFxuICAgICAgICAgICAgLy8gdGhlbiBsZXQgdGhhdCBjYXRjaCBibG9jayBoYW5kbGUgdGhlIGV4Y2VwdGlvbiBub3JtYWxseS5cbiAgICAgICAgICAgIG1ldGhvZCA9IFwibmV4dFwiO1xuICAgICAgICAgICAgYXJnID0gdW5kZWZpbmVkO1xuICAgICAgICAgIH1cblxuICAgICAgICB9IGVsc2UgaWYgKG1ldGhvZCA9PT0gXCJyZXR1cm5cIikge1xuICAgICAgICAgIGNvbnRleHQuYWJydXB0KFwicmV0dXJuXCIsIGFyZyk7XG4gICAgICAgIH1cblxuICAgICAgICBzdGF0ZSA9IEdlblN0YXRlRXhlY3V0aW5nO1xuXG4gICAgICAgIHZhciByZWNvcmQgPSB0cnlDYXRjaChpbm5lckZuLCBzZWxmLCBjb250ZXh0KTtcbiAgICAgICAgaWYgKHJlY29yZC50eXBlID09PSBcIm5vcm1hbFwiKSB7XG4gICAgICAgICAgLy8gSWYgYW4gZXhjZXB0aW9uIGlzIHRocm93biBmcm9tIGlubmVyRm4sIHdlIGxlYXZlIHN0YXRlID09PVxuICAgICAgICAgIC8vIEdlblN0YXRlRXhlY3V0aW5nIGFuZCBsb29wIGJhY2sgZm9yIGFub3RoZXIgaW52b2NhdGlvbi5cbiAgICAgICAgICBzdGF0ZSA9IGNvbnRleHQuZG9uZVxuICAgICAgICAgICAgPyBHZW5TdGF0ZUNvbXBsZXRlZFxuICAgICAgICAgICAgOiBHZW5TdGF0ZVN1c3BlbmRlZFlpZWxkO1xuXG4gICAgICAgICAgdmFyIGluZm8gPSB7XG4gICAgICAgICAgICB2YWx1ZTogcmVjb3JkLmFyZyxcbiAgICAgICAgICAgIGRvbmU6IGNvbnRleHQuZG9uZVxuICAgICAgICAgIH07XG5cbiAgICAgICAgICBpZiAocmVjb3JkLmFyZyA9PT0gQ29udGludWVTZW50aW5lbCkge1xuICAgICAgICAgICAgaWYgKGNvbnRleHQuZGVsZWdhdGUgJiYgbWV0aG9kID09PSBcIm5leHRcIikge1xuICAgICAgICAgICAgICAvLyBEZWxpYmVyYXRlbHkgZm9yZ2V0IHRoZSBsYXN0IHNlbnQgdmFsdWUgc28gdGhhdCB3ZSBkb24ndFxuICAgICAgICAgICAgICAvLyBhY2NpZGVudGFsbHkgcGFzcyBpdCBvbiB0byB0aGUgZGVsZWdhdGUuXG4gICAgICAgICAgICAgIGFyZyA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGluZm87XG4gICAgICAgICAgfVxuXG4gICAgICAgIH0gZWxzZSBpZiAocmVjb3JkLnR5cGUgPT09IFwidGhyb3dcIikge1xuICAgICAgICAgIHN0YXRlID0gR2VuU3RhdGVDb21wbGV0ZWQ7XG4gICAgICAgICAgLy8gRGlzcGF0Y2ggdGhlIGV4Y2VwdGlvbiBieSBsb29waW5nIGJhY2sgYXJvdW5kIHRvIHRoZVxuICAgICAgICAgIC8vIGNvbnRleHQuZGlzcGF0Y2hFeGNlcHRpb24oYXJnKSBjYWxsIGFib3ZlLlxuICAgICAgICAgIG1ldGhvZCA9IFwidGhyb3dcIjtcbiAgICAgICAgICBhcmcgPSByZWNvcmQuYXJnO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIC8vIERlZmluZSBHZW5lcmF0b3IucHJvdG90eXBlLntuZXh0LHRocm93LHJldHVybn0gaW4gdGVybXMgb2YgdGhlXG4gIC8vIHVuaWZpZWQgLl9pbnZva2UgaGVscGVyIG1ldGhvZC5cbiAgZGVmaW5lSXRlcmF0b3JNZXRob2RzKEdwKTtcblxuICBHcFtpdGVyYXRvclN5bWJvbF0gPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICBHcC50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBcIltvYmplY3QgR2VuZXJhdG9yXVwiO1xuICB9O1xuXG4gIGZ1bmN0aW9uIHB1c2hUcnlFbnRyeShsb2NzKSB7XG4gICAgdmFyIGVudHJ5ID0geyB0cnlMb2M6IGxvY3NbMF0gfTtcblxuICAgIGlmICgxIGluIGxvY3MpIHtcbiAgICAgIGVudHJ5LmNhdGNoTG9jID0gbG9jc1sxXTtcbiAgICB9XG5cbiAgICBpZiAoMiBpbiBsb2NzKSB7XG4gICAgICBlbnRyeS5maW5hbGx5TG9jID0gbG9jc1syXTtcbiAgICAgIGVudHJ5LmFmdGVyTG9jID0gbG9jc1szXTtcbiAgICB9XG5cbiAgICB0aGlzLnRyeUVudHJpZXMucHVzaChlbnRyeSk7XG4gIH1cblxuICBmdW5jdGlvbiByZXNldFRyeUVudHJ5KGVudHJ5KSB7XG4gICAgdmFyIHJlY29yZCA9IGVudHJ5LmNvbXBsZXRpb24gfHwge307XG4gICAgcmVjb3JkLnR5cGUgPSBcIm5vcm1hbFwiO1xuICAgIGRlbGV0ZSByZWNvcmQuYXJnO1xuICAgIGVudHJ5LmNvbXBsZXRpb24gPSByZWNvcmQ7XG4gIH1cblxuICBmdW5jdGlvbiBDb250ZXh0KHRyeUxvY3NMaXN0KSB7XG4gICAgLy8gVGhlIHJvb3QgZW50cnkgb2JqZWN0IChlZmZlY3RpdmVseSBhIHRyeSBzdGF0ZW1lbnQgd2l0aG91dCBhIGNhdGNoXG4gICAgLy8gb3IgYSBmaW5hbGx5IGJsb2NrKSBnaXZlcyB1cyBhIHBsYWNlIHRvIHN0b3JlIHZhbHVlcyB0aHJvd24gZnJvbVxuICAgIC8vIGxvY2F0aW9ucyB3aGVyZSB0aGVyZSBpcyBubyBlbmNsb3NpbmcgdHJ5IHN0YXRlbWVudC5cbiAgICB0aGlzLnRyeUVudHJpZXMgPSBbeyB0cnlMb2M6IFwicm9vdFwiIH1dO1xuICAgIHRyeUxvY3NMaXN0LmZvckVhY2gocHVzaFRyeUVudHJ5LCB0aGlzKTtcbiAgICB0aGlzLnJlc2V0KHRydWUpO1xuICB9XG5cbiAgcnVudGltZS5rZXlzID0gZnVuY3Rpb24ob2JqZWN0KSB7XG4gICAgdmFyIGtleXMgPSBbXTtcbiAgICBmb3IgKHZhciBrZXkgaW4gb2JqZWN0KSB7XG4gICAgICBrZXlzLnB1c2goa2V5KTtcbiAgICB9XG4gICAga2V5cy5yZXZlcnNlKCk7XG5cbiAgICAvLyBSYXRoZXIgdGhhbiByZXR1cm5pbmcgYW4gb2JqZWN0IHdpdGggYSBuZXh0IG1ldGhvZCwgd2Uga2VlcFxuICAgIC8vIHRoaW5ncyBzaW1wbGUgYW5kIHJldHVybiB0aGUgbmV4dCBmdW5jdGlvbiBpdHNlbGYuXG4gICAgcmV0dXJuIGZ1bmN0aW9uIG5leHQoKSB7XG4gICAgICB3aGlsZSAoa2V5cy5sZW5ndGgpIHtcbiAgICAgICAgdmFyIGtleSA9IGtleXMucG9wKCk7XG4gICAgICAgIGlmIChrZXkgaW4gb2JqZWN0KSB7XG4gICAgICAgICAgbmV4dC52YWx1ZSA9IGtleTtcbiAgICAgICAgICBuZXh0LmRvbmUgPSBmYWxzZTtcbiAgICAgICAgICByZXR1cm4gbmV4dDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBUbyBhdm9pZCBjcmVhdGluZyBhbiBhZGRpdGlvbmFsIG9iamVjdCwgd2UganVzdCBoYW5nIHRoZSAudmFsdWVcbiAgICAgIC8vIGFuZCAuZG9uZSBwcm9wZXJ0aWVzIG9mZiB0aGUgbmV4dCBmdW5jdGlvbiBvYmplY3QgaXRzZWxmLiBUaGlzXG4gICAgICAvLyBhbHNvIGVuc3VyZXMgdGhhdCB0aGUgbWluaWZpZXIgd2lsbCBub3QgYW5vbnltaXplIHRoZSBmdW5jdGlvbi5cbiAgICAgIG5leHQuZG9uZSA9IHRydWU7XG4gICAgICByZXR1cm4gbmV4dDtcbiAgICB9O1xuICB9O1xuXG4gIGZ1bmN0aW9uIHZhbHVlcyhpdGVyYWJsZSkge1xuICAgIGlmIChpdGVyYWJsZSkge1xuICAgICAgdmFyIGl0ZXJhdG9yTWV0aG9kID0gaXRlcmFibGVbaXRlcmF0b3JTeW1ib2xdO1xuICAgICAgaWYgKGl0ZXJhdG9yTWV0aG9kKSB7XG4gICAgICAgIHJldHVybiBpdGVyYXRvck1ldGhvZC5jYWxsKGl0ZXJhYmxlKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHR5cGVvZiBpdGVyYWJsZS5uZXh0ID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgcmV0dXJuIGl0ZXJhYmxlO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWlzTmFOKGl0ZXJhYmxlLmxlbmd0aCkpIHtcbiAgICAgICAgdmFyIGkgPSAtMSwgbmV4dCA9IGZ1bmN0aW9uIG5leHQoKSB7XG4gICAgICAgICAgd2hpbGUgKCsraSA8IGl0ZXJhYmxlLmxlbmd0aCkge1xuICAgICAgICAgICAgaWYgKGhhc093bi5jYWxsKGl0ZXJhYmxlLCBpKSkge1xuICAgICAgICAgICAgICBuZXh0LnZhbHVlID0gaXRlcmFibGVbaV07XG4gICAgICAgICAgICAgIG5leHQuZG9uZSA9IGZhbHNlO1xuICAgICAgICAgICAgICByZXR1cm4gbmV4dDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBuZXh0LnZhbHVlID0gdW5kZWZpbmVkO1xuICAgICAgICAgIG5leHQuZG9uZSA9IHRydWU7XG5cbiAgICAgICAgICByZXR1cm4gbmV4dDtcbiAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4gbmV4dC5uZXh0ID0gbmV4dDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBSZXR1cm4gYW4gaXRlcmF0b3Igd2l0aCBubyB2YWx1ZXMuXG4gICAgcmV0dXJuIHsgbmV4dDogZG9uZVJlc3VsdCB9O1xuICB9XG4gIHJ1bnRpbWUudmFsdWVzID0gdmFsdWVzO1xuXG4gIGZ1bmN0aW9uIGRvbmVSZXN1bHQoKSB7XG4gICAgcmV0dXJuIHsgdmFsdWU6IHVuZGVmaW5lZCwgZG9uZTogdHJ1ZSB9O1xuICB9XG5cbiAgQ29udGV4dC5wcm90b3R5cGUgPSB7XG4gICAgY29uc3RydWN0b3I6IENvbnRleHQsXG5cbiAgICByZXNldDogZnVuY3Rpb24oc2tpcFRlbXBSZXNldCkge1xuICAgICAgdGhpcy5wcmV2ID0gMDtcbiAgICAgIHRoaXMubmV4dCA9IDA7XG4gICAgICB0aGlzLnNlbnQgPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLmRvbmUgPSBmYWxzZTtcbiAgICAgIHRoaXMuZGVsZWdhdGUgPSBudWxsO1xuXG4gICAgICB0aGlzLnRyeUVudHJpZXMuZm9yRWFjaChyZXNldFRyeUVudHJ5KTtcblxuICAgICAgaWYgKCFza2lwVGVtcFJlc2V0KSB7XG4gICAgICAgIGZvciAodmFyIG5hbWUgaW4gdGhpcykge1xuICAgICAgICAgIC8vIE5vdCBzdXJlIGFib3V0IHRoZSBvcHRpbWFsIG9yZGVyIG9mIHRoZXNlIGNvbmRpdGlvbnM6XG4gICAgICAgICAgaWYgKG5hbWUuY2hhckF0KDApID09PSBcInRcIiAmJlxuICAgICAgICAgICAgICBoYXNPd24uY2FsbCh0aGlzLCBuYW1lKSAmJlxuICAgICAgICAgICAgICAhaXNOYU4oK25hbWUuc2xpY2UoMSkpKSB7XG4gICAgICAgICAgICB0aGlzW25hbWVdID0gdW5kZWZpbmVkO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG5cbiAgICBzdG9wOiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuZG9uZSA9IHRydWU7XG5cbiAgICAgIHZhciByb290RW50cnkgPSB0aGlzLnRyeUVudHJpZXNbMF07XG4gICAgICB2YXIgcm9vdFJlY29yZCA9IHJvb3RFbnRyeS5jb21wbGV0aW9uO1xuICAgICAgaWYgKHJvb3RSZWNvcmQudHlwZSA9PT0gXCJ0aHJvd1wiKSB7XG4gICAgICAgIHRocm93IHJvb3RSZWNvcmQuYXJnO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGhpcy5ydmFsO1xuICAgIH0sXG5cbiAgICBkaXNwYXRjaEV4Y2VwdGlvbjogZnVuY3Rpb24oZXhjZXB0aW9uKSB7XG4gICAgICBpZiAodGhpcy5kb25lKSB7XG4gICAgICAgIHRocm93IGV4Y2VwdGlvbjtcbiAgICAgIH1cblxuICAgICAgdmFyIGNvbnRleHQgPSB0aGlzO1xuICAgICAgZnVuY3Rpb24gaGFuZGxlKGxvYywgY2F1Z2h0KSB7XG4gICAgICAgIHJlY29yZC50eXBlID0gXCJ0aHJvd1wiO1xuICAgICAgICByZWNvcmQuYXJnID0gZXhjZXB0aW9uO1xuICAgICAgICBjb250ZXh0Lm5leHQgPSBsb2M7XG4gICAgICAgIHJldHVybiAhIWNhdWdodDtcbiAgICAgIH1cblxuICAgICAgZm9yICh2YXIgaSA9IHRoaXMudHJ5RW50cmllcy5sZW5ndGggLSAxOyBpID49IDA7IC0taSkge1xuICAgICAgICB2YXIgZW50cnkgPSB0aGlzLnRyeUVudHJpZXNbaV07XG4gICAgICAgIHZhciByZWNvcmQgPSBlbnRyeS5jb21wbGV0aW9uO1xuXG4gICAgICAgIGlmIChlbnRyeS50cnlMb2MgPT09IFwicm9vdFwiKSB7XG4gICAgICAgICAgLy8gRXhjZXB0aW9uIHRocm93biBvdXRzaWRlIG9mIGFueSB0cnkgYmxvY2sgdGhhdCBjb3VsZCBoYW5kbGVcbiAgICAgICAgICAvLyBpdCwgc28gc2V0IHRoZSBjb21wbGV0aW9uIHZhbHVlIG9mIHRoZSBlbnRpcmUgZnVuY3Rpb24gdG9cbiAgICAgICAgICAvLyB0aHJvdyB0aGUgZXhjZXB0aW9uLlxuICAgICAgICAgIHJldHVybiBoYW5kbGUoXCJlbmRcIik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZW50cnkudHJ5TG9jIDw9IHRoaXMucHJldikge1xuICAgICAgICAgIHZhciBoYXNDYXRjaCA9IGhhc093bi5jYWxsKGVudHJ5LCBcImNhdGNoTG9jXCIpO1xuICAgICAgICAgIHZhciBoYXNGaW5hbGx5ID0gaGFzT3duLmNhbGwoZW50cnksIFwiZmluYWxseUxvY1wiKTtcblxuICAgICAgICAgIGlmIChoYXNDYXRjaCAmJiBoYXNGaW5hbGx5KSB7XG4gICAgICAgICAgICBpZiAodGhpcy5wcmV2IDwgZW50cnkuY2F0Y2hMb2MpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGhhbmRsZShlbnRyeS5jYXRjaExvYywgdHJ1ZSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMucHJldiA8IGVudHJ5LmZpbmFsbHlMb2MpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGhhbmRsZShlbnRyeS5maW5hbGx5TG9jKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgIH0gZWxzZSBpZiAoaGFzQ2F0Y2gpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnByZXYgPCBlbnRyeS5jYXRjaExvYykge1xuICAgICAgICAgICAgICByZXR1cm4gaGFuZGxlKGVudHJ5LmNhdGNoTG9jLCB0cnVlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgIH0gZWxzZSBpZiAoaGFzRmluYWxseSkge1xuICAgICAgICAgICAgaWYgKHRoaXMucHJldiA8IGVudHJ5LmZpbmFsbHlMb2MpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGhhbmRsZShlbnRyeS5maW5hbGx5TG9jKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJ0cnkgc3RhdGVtZW50IHdpdGhvdXQgY2F0Y2ggb3IgZmluYWxseVwiKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuXG4gICAgYWJydXB0OiBmdW5jdGlvbih0eXBlLCBhcmcpIHtcbiAgICAgIGZvciAodmFyIGkgPSB0aGlzLnRyeUVudHJpZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyAtLWkpIHtcbiAgICAgICAgdmFyIGVudHJ5ID0gdGhpcy50cnlFbnRyaWVzW2ldO1xuICAgICAgICBpZiAoZW50cnkudHJ5TG9jIDw9IHRoaXMucHJldiAmJlxuICAgICAgICAgICAgaGFzT3duLmNhbGwoZW50cnksIFwiZmluYWxseUxvY1wiKSAmJlxuICAgICAgICAgICAgdGhpcy5wcmV2IDwgZW50cnkuZmluYWxseUxvYykge1xuICAgICAgICAgIHZhciBmaW5hbGx5RW50cnkgPSBlbnRyeTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoZmluYWxseUVudHJ5ICYmXG4gICAgICAgICAgKHR5cGUgPT09IFwiYnJlYWtcIiB8fFxuICAgICAgICAgICB0eXBlID09PSBcImNvbnRpbnVlXCIpICYmXG4gICAgICAgICAgZmluYWxseUVudHJ5LnRyeUxvYyA8PSBhcmcgJiZcbiAgICAgICAgICBhcmcgPD0gZmluYWxseUVudHJ5LmZpbmFsbHlMb2MpIHtcbiAgICAgICAgLy8gSWdub3JlIHRoZSBmaW5hbGx5IGVudHJ5IGlmIGNvbnRyb2wgaXMgbm90IGp1bXBpbmcgdG8gYVxuICAgICAgICAvLyBsb2NhdGlvbiBvdXRzaWRlIHRoZSB0cnkvY2F0Y2ggYmxvY2suXG4gICAgICAgIGZpbmFsbHlFbnRyeSA9IG51bGw7XG4gICAgICB9XG5cbiAgICAgIHZhciByZWNvcmQgPSBmaW5hbGx5RW50cnkgPyBmaW5hbGx5RW50cnkuY29tcGxldGlvbiA6IHt9O1xuICAgICAgcmVjb3JkLnR5cGUgPSB0eXBlO1xuICAgICAgcmVjb3JkLmFyZyA9IGFyZztcblxuICAgICAgaWYgKGZpbmFsbHlFbnRyeSkge1xuICAgICAgICB0aGlzLm5leHQgPSBmaW5hbGx5RW50cnkuZmluYWxseUxvYztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuY29tcGxldGUocmVjb3JkKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIENvbnRpbnVlU2VudGluZWw7XG4gICAgfSxcblxuICAgIGNvbXBsZXRlOiBmdW5jdGlvbihyZWNvcmQsIGFmdGVyTG9jKSB7XG4gICAgICBpZiAocmVjb3JkLnR5cGUgPT09IFwidGhyb3dcIikge1xuICAgICAgICB0aHJvdyByZWNvcmQuYXJnO1xuICAgICAgfVxuXG4gICAgICBpZiAocmVjb3JkLnR5cGUgPT09IFwiYnJlYWtcIiB8fFxuICAgICAgICAgIHJlY29yZC50eXBlID09PSBcImNvbnRpbnVlXCIpIHtcbiAgICAgICAgdGhpcy5uZXh0ID0gcmVjb3JkLmFyZztcbiAgICAgIH0gZWxzZSBpZiAocmVjb3JkLnR5cGUgPT09IFwicmV0dXJuXCIpIHtcbiAgICAgICAgdGhpcy5ydmFsID0gcmVjb3JkLmFyZztcbiAgICAgICAgdGhpcy5uZXh0ID0gXCJlbmRcIjtcbiAgICAgIH0gZWxzZSBpZiAocmVjb3JkLnR5cGUgPT09IFwibm9ybWFsXCIgJiYgYWZ0ZXJMb2MpIHtcbiAgICAgICAgdGhpcy5uZXh0ID0gYWZ0ZXJMb2M7XG4gICAgICB9XG4gICAgfSxcblxuICAgIGZpbmlzaDogZnVuY3Rpb24oZmluYWxseUxvYykge1xuICAgICAgZm9yICh2YXIgaSA9IHRoaXMudHJ5RW50cmllcy5sZW5ndGggLSAxOyBpID49IDA7IC0taSkge1xuICAgICAgICB2YXIgZW50cnkgPSB0aGlzLnRyeUVudHJpZXNbaV07XG4gICAgICAgIGlmIChlbnRyeS5maW5hbGx5TG9jID09PSBmaW5hbGx5TG9jKSB7XG4gICAgICAgICAgdGhpcy5jb21wbGV0ZShlbnRyeS5jb21wbGV0aW9uLCBlbnRyeS5hZnRlckxvYyk7XG4gICAgICAgICAgcmVzZXRUcnlFbnRyeShlbnRyeSk7XG4gICAgICAgICAgcmV0dXJuIENvbnRpbnVlU2VudGluZWw7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuXG4gICAgXCJjYXRjaFwiOiBmdW5jdGlvbih0cnlMb2MpIHtcbiAgICAgIGZvciAodmFyIGkgPSB0aGlzLnRyeUVudHJpZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyAtLWkpIHtcbiAgICAgICAgdmFyIGVudHJ5ID0gdGhpcy50cnlFbnRyaWVzW2ldO1xuICAgICAgICBpZiAoZW50cnkudHJ5TG9jID09PSB0cnlMb2MpIHtcbiAgICAgICAgICB2YXIgcmVjb3JkID0gZW50cnkuY29tcGxldGlvbjtcbiAgICAgICAgICBpZiAocmVjb3JkLnR5cGUgPT09IFwidGhyb3dcIikge1xuICAgICAgICAgICAgdmFyIHRocm93biA9IHJlY29yZC5hcmc7XG4gICAgICAgICAgICByZXNldFRyeUVudHJ5KGVudHJ5KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHRocm93bjtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBUaGUgY29udGV4dC5jYXRjaCBtZXRob2QgbXVzdCBvbmx5IGJlIGNhbGxlZCB3aXRoIGEgbG9jYXRpb25cbiAgICAgIC8vIGFyZ3VtZW50IHRoYXQgY29ycmVzcG9uZHMgdG8gYSBrbm93biBjYXRjaCBibG9jay5cbiAgICAgIHRocm93IG5ldyBFcnJvcihcImlsbGVnYWwgY2F0Y2ggYXR0ZW1wdFwiKTtcbiAgICB9LFxuXG4gICAgZGVsZWdhdGVZaWVsZDogZnVuY3Rpb24oaXRlcmFibGUsIHJlc3VsdE5hbWUsIG5leHRMb2MpIHtcbiAgICAgIHRoaXMuZGVsZWdhdGUgPSB7XG4gICAgICAgIGl0ZXJhdG9yOiB2YWx1ZXMoaXRlcmFibGUpLFxuICAgICAgICByZXN1bHROYW1lOiByZXN1bHROYW1lLFxuICAgICAgICBuZXh0TG9jOiBuZXh0TG9jXG4gICAgICB9O1xuXG4gICAgICByZXR1cm4gQ29udGludWVTZW50aW5lbDtcbiAgICB9XG4gIH07XG59KShcbiAgLy8gQW1vbmcgdGhlIHZhcmlvdXMgdHJpY2tzIGZvciBvYnRhaW5pbmcgYSByZWZlcmVuY2UgdG8gdGhlIGdsb2JhbFxuICAvLyBvYmplY3QsIHRoaXMgc2VlbXMgdG8gYmUgdGhlIG1vc3QgcmVsaWFibGUgdGVjaG5pcXVlIHRoYXQgZG9lcyBub3RcbiAgLy8gdXNlIGluZGlyZWN0IGV2YWwgKHdoaWNoIHZpb2xhdGVzIENvbnRlbnQgU2VjdXJpdHkgUG9saWN5KS5cbiAgdHlwZW9mIGdsb2JhbCA9PT0gXCJvYmplY3RcIiA/IGdsb2JhbCA6XG4gIHR5cGVvZiB3aW5kb3cgPT09IFwib2JqZWN0XCIgPyB3aW5kb3cgOlxuICB0eXBlb2Ygc2VsZiA9PT0gXCJvYmplY3RcIiA/IHNlbGYgOiB0aGlzXG4pO1xuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL34vYmFiZWwtcmVnZW5lcmF0b3ItcnVudGltZS9ydW50aW1lLmpzXG4gKiogbW9kdWxlIGlkID0gMVxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG5cbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHNldFRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZHJhaW5RdWV1ZSwgMCk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG5cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vfi9ub2RlLWxpYnMtYnJvd3Nlci9+L3Byb2Nlc3MvYnJvd3Nlci5qc1xuICoqIG1vZHVsZSBpZCA9IDJcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsInZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gIENvbGxlY3Rpb25SZWdpc3RyeSA9IHJlcXVpcmUoJy4vY29sbGVjdGlvblJlZ2lzdHJ5JykuQ29sbGVjdGlvblJlZ2lzdHJ5LFxuICBDb2xsZWN0aW9uID0gcmVxdWlyZSgnLi9jb2xsZWN0aW9uJyksXG4gIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpLFxuICBNb2RlbCA9IHJlcXVpcmUoJy4vbW9kZWwnKSxcbiAgZXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJyksXG4gIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gIFJlbGF0aW9uc2hpcFR5cGUgPSByZXF1aXJlKCcuL1JlbGF0aW9uc2hpcFR5cGUnKSxcbiAgUmVhY3RpdmVRdWVyeSA9IHJlcXVpcmUoJy4vUmVhY3RpdmVRdWVyeScpLFxuICBNYW55VG9NYW55UHJveHkgPSByZXF1aXJlKCcuL01hbnlUb01hbnlQcm94eScpLFxuICBPbmVUb09uZVByb3h5ID0gcmVxdWlyZSgnLi9PbmVUb09uZVByb3h5JyksXG4gIE9uZVRvTWFueVByb3h5ID0gcmVxdWlyZSgnLi9PbmVUb01hbnlQcm94eScpLFxuICBSZWxhdGlvbnNoaXBQcm94eSA9IHJlcXVpcmUoJy4vUmVsYXRpb25zaGlwUHJveHknKSxcbiAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gIFF1ZXJ5ID0gcmVxdWlyZSgnLi9RdWVyeScpLFxuICBxdWVyeVNldCA9IHJlcXVpcmUoJy4vUXVlcnlTZXQnKSxcbiAgbG9nID0gcmVxdWlyZSgnLi9sb2cnKTtcblxudXRpbC5fcGF0Y2hCaW5kKCk7XG5cbi8vIEluaXRpYWxpc2Ugc2llc3RhIG9iamVjdC4gU3RyYW5nZSBmb3JtYXQgZmFjaWxpdGllcyB1c2luZyBzdWJtb2R1bGVzIHdpdGggcmVxdWlyZUpTIChldmVudHVhbGx5KVxudmFyIHNpZXN0YSA9IGZ1bmN0aW9uIChleHQpIHtcbiAgaWYgKCFzaWVzdGEuZXh0KSBzaWVzdGEuZXh0ID0ge307XG4gIHV0aWwuZXh0ZW5kKHNpZXN0YS5leHQsIGV4dCB8fCB7fSk7XG4gIHJldHVybiBzaWVzdGE7XG59O1xuXG4vLyBOb3RpZmljYXRpb25zXG51dGlsLmV4dGVuZChzaWVzdGEsIHtcbiAgb246IGV2ZW50cy5vbi5iaW5kKGV2ZW50cyksXG4gIG9mZjogZXZlbnRzLnJlbW92ZUxpc3RlbmVyLmJpbmQoZXZlbnRzKSxcbiAgb25jZTogZXZlbnRzLm9uY2UuYmluZChldmVudHMpLFxuICByZW1vdmVBbGxMaXN0ZW5lcnM6IGV2ZW50cy5yZW1vdmVBbGxMaXN0ZW5lcnMuYmluZChldmVudHMpXG59KTtcbnV0aWwuZXh0ZW5kKHNpZXN0YSwge1xuICByZW1vdmVMaXN0ZW5lcjogc2llc3RhLm9mZixcbiAgYWRkTGlzdGVuZXI6IHNpZXN0YS5vblxufSk7XG5cbi8vIEV4cG9zZSBzb21lIHN0dWZmIGZvciB1c2FnZSBieSBleHRlbnNpb25zIGFuZC9vciB1c2Vyc1xudXRpbC5leHRlbmQoc2llc3RhLCB7XG4gIFJlbGF0aW9uc2hpcFR5cGU6IFJlbGF0aW9uc2hpcFR5cGUsXG4gIE1vZGVsRXZlbnRUeXBlOiBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZSxcbiAgbG9nOiBsb2cuTGV2ZWwsXG4gIEluc2VydGlvblBvbGljeTogUmVhY3RpdmVRdWVyeS5JbnNlcnRpb25Qb2xpY3ksXG4gIF9pbnRlcm5hbDoge1xuICAgIGxvZzogbG9nLFxuICAgIE1vZGVsOiBNb2RlbCxcbiAgICBlcnJvcjogZXJyb3IsXG4gICAgTW9kZWxFdmVudFR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLFxuICAgIE1vZGVsSW5zdGFuY2U6IHJlcXVpcmUoJy4vTW9kZWxJbnN0YW5jZScpLFxuICAgIGV4dGVuZDogcmVxdWlyZSgnZXh0ZW5kJyksXG4gICAgTWFwcGluZ09wZXJhdGlvbjogcmVxdWlyZSgnLi9tYXBwaW5nT3BlcmF0aW9uJyksXG4gICAgZXZlbnRzOiBldmVudHMsXG4gICAgUHJveHlFdmVudEVtaXR0ZXI6IGV2ZW50cy5Qcm94eUV2ZW50RW1pdHRlcixcbiAgICBjYWNoZTogcmVxdWlyZSgnLi9jYWNoZScpLFxuICAgIG1vZGVsRXZlbnRzOiBtb2RlbEV2ZW50cyxcbiAgICBDb2xsZWN0aW9uUmVnaXN0cnk6IHJlcXVpcmUoJy4vY29sbGVjdGlvblJlZ2lzdHJ5JykuQ29sbGVjdGlvblJlZ2lzdHJ5LFxuICAgIENvbGxlY3Rpb246IENvbGxlY3Rpb24sXG4gICAgdXRpbHM6IHV0aWwsXG4gICAgdXRpbDogdXRpbCxcbiAgICBxdWVyeVNldDogcXVlcnlTZXQsXG4gICAgb2JzZXJ2ZTogcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKSxcbiAgICBRdWVyeTogUXVlcnksXG4gICAgTWFueVRvTWFueVByb3h5OiBNYW55VG9NYW55UHJveHksXG4gICAgT25lVG9NYW55UHJveHk6IE9uZVRvTWFueVByb3h5LFxuICAgIE9uZVRvT25lUHJveHk6IE9uZVRvT25lUHJveHksXG4gICAgUmVsYXRpb25zaGlwUHJveHk6IFJlbGF0aW9uc2hpcFByb3h5XG4gIH0sXG4gIGlzQXJyYXk6IHV0aWwuaXNBcnJheSxcbiAgaXNTdHJpbmc6IHV0aWwuaXNTdHJpbmdcbn0pO1xuXG5zaWVzdGEuZXh0ID0ge307XG5cbnZhciBpbnN0YWxsZWQgPSBmYWxzZSxcbiAgaW5zdGFsbGluZyA9IGZhbHNlO1xuXG5cbnV0aWwuZXh0ZW5kKHNpZXN0YSwge1xuICAvKipcbiAgICogV2lwZSBldmVyeXRoaW5nLiBVc2VkIGR1cmluZyB0ZXN0IGdlbmVyYWxseS5cbiAgICovXG4gIHJlc2V0OiBmdW5jdGlvbiAoY2IpIHtcbiAgICBpbnN0YWxsZWQgPSBmYWxzZTtcbiAgICBpbnN0YWxsaW5nID0gZmFsc2U7XG4gICAgZGVsZXRlIHRoaXMucXVldWVkVGFza3M7XG4gICAgY2FjaGUucmVzZXQoKTtcbiAgICBDb2xsZWN0aW9uUmVnaXN0cnkucmVzZXQoKTtcbiAgICBldmVudHMucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XG4gICAgY2IoKTtcbiAgfSxcbiAgLyoqXG4gICAqIENyZWF0ZXMgYW5kIHJlZ2lzdGVycyBhIG5ldyBDb2xsZWN0aW9uLlxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWVcbiAgICogQHBhcmFtICB7T2JqZWN0fSBbb3B0c11cbiAgICogQHJldHVybiB7Q29sbGVjdGlvbn1cbiAgICovXG4gIGNvbGxlY3Rpb246IGZ1bmN0aW9uIChuYW1lLCBvcHRzKSB7XG4gICAgdmFyIGMgPSBuZXcgQ29sbGVjdGlvbihuYW1lLCBvcHRzKTtcbiAgICBpZiAoaW5zdGFsbGVkKSBjLmluc3RhbGxlZCA9IHRydWU7IC8vIFRPRE86IFJlbW92ZVxuICAgIHJldHVybiBjO1xuICB9LFxuICAvKipcbiAgICogSW5zdGFsbCBhbGwgY29sbGVjdGlvbnMuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYl1cbiAgICogQHJldHVybnMge3EuUHJvbWlzZX1cbiAgICovXG4gIGluc3RhbGw6IGZ1bmN0aW9uIChjYikge1xuICAgIGlmICghaW5zdGFsbGluZyAmJiAhaW5zdGFsbGVkKSB7XG4gICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgaW5zdGFsbGluZyA9IHRydWU7XG4gICAgICAgIHZhciBjb2xsZWN0aW9uTmFtZXMgPSBDb2xsZWN0aW9uUmVnaXN0cnkuY29sbGVjdGlvbk5hbWVzLFxuICAgICAgICAgIHRhc2tzID0gY29sbGVjdGlvbk5hbWVzLm1hcChmdW5jdGlvbiAobikge1xuICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb24gPSBDb2xsZWN0aW9uUmVnaXN0cnlbbl07XG4gICAgICAgICAgICByZXR1cm4gY29sbGVjdGlvbi5pbnN0YWxsLmJpbmQoY29sbGVjdGlvbik7XG4gICAgICAgICAgfSk7XG4gICAgICAgIHRhc2tzLnB1c2goZnVuY3Rpb24gKGRvbmUpIHtcbiAgICAgICAgICBpbnN0YWxsZWQgPSB0cnVlO1xuICAgICAgICAgIGlmICh0aGlzLnF1ZXVlZFRhc2tzKSB0aGlzLnF1ZXVlZFRhc2tzLmV4ZWN1dGUoKTtcbiAgICAgICAgICBkb25lKCk7XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIHV0aWwuc2VyaWVzKHRhc2tzLCBjYik7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH1cbiAgICBlbHNlIGNiKGVycm9yKCdhbHJlYWR5IGluc3RhbGxpbmcnKSk7XG4gIH0sXG4gIF9wdXNoVGFzazogZnVuY3Rpb24gKHRhc2spIHtcbiAgICBpZiAoIXRoaXMucXVldWVkVGFza3MpIHtcbiAgICAgIHRoaXMucXVldWVkVGFza3MgPSBuZXcgZnVuY3Rpb24gUXVldWUoKSB7XG4gICAgICAgIHRoaXMudGFza3MgPSBbXTtcbiAgICAgICAgdGhpcy5leGVjdXRlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHRoaXMudGFza3MuZm9yRWFjaChmdW5jdGlvbiAoZikge1xuICAgICAgICAgICAgZigpXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgdGhpcy50YXNrcyA9IFtdO1xuICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgICB9O1xuICAgIH1cbiAgICB0aGlzLnF1ZXVlZFRhc2tzLnRhc2tzLnB1c2godGFzayk7XG4gIH0sXG4gIF9hZnRlckluc3RhbGw6IGZ1bmN0aW9uICh0YXNrKSB7XG4gICAgaWYgKCFpbnN0YWxsZWQpIHtcbiAgICAgIGlmICghaW5zdGFsbGluZykge1xuICAgICAgICB0aGlzLmluc3RhbGwoZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHNldHRpbmcgdXAgc2llc3RhJywgZXJyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZGVsZXRlIHRoaXMucXVldWVkVGFza3M7XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICB9XG4gICAgICBpZiAoIWluc3RhbGxlZCkgdGhpcy5fcHVzaFRhc2sodGFzayk7XG4gICAgICBlbHNlIHRhc2soKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICB0YXNrKCk7XG4gICAgfVxuICB9LFxuICBzZXRMb2dMZXZlbDogZnVuY3Rpb24gKGxvZ2dlck5hbWUsIGxldmVsKSB7XG4gICAgdmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZShsb2dnZXJOYW1lKTtcbiAgICBMb2dnZXIuc2V0TGV2ZWwobGV2ZWwpO1xuICB9LFxuICBncmFwaDogZnVuY3Rpb24gKGRhdGEsIG9wdHMsIGNiKSB7XG4gICAgaWYgKHR5cGVvZiBvcHRzID09ICdmdW5jdGlvbicpIGNiID0gb3B0cztcbiAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbiAoY2IpIHtcbiAgICAgIHZhciB0YXNrcyA9IFtdLCBlcnI7XG4gICAgICBmb3IgKHZhciBjb2xsZWN0aW9uTmFtZSBpbiBkYXRhKSB7XG4gICAgICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KGNvbGxlY3Rpb25OYW1lKSkge1xuICAgICAgICAgIHZhciBjb2xsZWN0aW9uID0gQ29sbGVjdGlvblJlZ2lzdHJ5W2NvbGxlY3Rpb25OYW1lXTtcbiAgICAgICAgICBpZiAoY29sbGVjdGlvbikge1xuICAgICAgICAgICAgKGZ1bmN0aW9uIChjb2xsZWN0aW9uLCBkYXRhKSB7XG4gICAgICAgICAgICAgIHRhc2tzLnB1c2goZnVuY3Rpb24gKGRvbmUpIHtcbiAgICAgICAgICAgICAgICBjb2xsZWN0aW9uLmdyYXBoKGRhdGEsIGZ1bmN0aW9uIChlcnIsIHJlcykge1xuICAgICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlc3VsdHMgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0c1tjb2xsZWN0aW9uLm5hbWVdID0gcmVzO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgZG9uZShlcnIsIHJlc3VsdHMpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pKGNvbGxlY3Rpb24sIGRhdGFbY29sbGVjdGlvbk5hbWVdKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBlcnIgPSAnTm8gc3VjaCBjb2xsZWN0aW9uIFwiJyArIGNvbGxlY3Rpb25OYW1lICsgJ1wiJztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICghZXJyKSB7XG4gICAgICAgIHV0aWwuc2VyaWVzKHRhc2tzLCBmdW5jdGlvbiAoZXJyLCByZXN1bHRzKSB7XG4gICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgIHJlc3VsdHMgPSByZXN1bHRzLnJlZHVjZShmdW5jdGlvbiAobWVtbywgcmVzKSB7XG4gICAgICAgICAgICAgIHJldHVybiB1dGlsLmV4dGVuZChtZW1vLCByZXMpO1xuICAgICAgICAgICAgfSwge30pXG4gICAgICAgICAgfSBlbHNlIHJlc3VsdHMgPSBudWxsO1xuICAgICAgICAgIGNiKGVyciwgcmVzdWx0cyk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgZWxzZSBjYihlcnJvcihlcnIsIHtkYXRhOiBkYXRhLCBpbnZhbGlkQ29sbGVjdGlvbk5hbWU6IGNvbGxlY3Rpb25OYW1lfSkpO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gIH0sXG4gIG5vdGlmeTogdXRpbC5uZXh0LFxuICByZWdpc3RlckNvbXBhcmF0b3I6IFF1ZXJ5LnJlZ2lzdGVyQ29tcGFyYXRvci5iaW5kKFF1ZXJ5KSxcbiAgY291bnQ6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gY2FjaGUuY291bnQoKTtcbiAgfSxcbiAgZ2V0OiBmdW5jdGlvbiAoaWQsIGNiKSB7XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24gKGNiKSB7XG4gICAgICB0aGlzLl9hZnRlckluc3RhbGwoZnVuY3Rpb24gKCkge1xuICAgICAgICBjYihudWxsLCBjYWNoZS5fbG9jYWxDYWNoZSgpW2lkXSk7XG4gICAgICB9KTtcbiAgICB9LmJpbmQodGhpcykpO1xuICB9LFxuICByZW1vdmVBbGw6IGZ1bmN0aW9uIChjYikge1xuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uIChjYikge1xuICAgICAgdXRpbC5Qcm9taXNlLmFsbChcbiAgICAgICAgQ29sbGVjdGlvblJlZ2lzdHJ5LmNvbGxlY3Rpb25OYW1lcy5tYXAoZnVuY3Rpb24gKGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgICAgICAgcmV0dXJuIENvbGxlY3Rpb25SZWdpc3RyeVtjb2xsZWN0aW9uTmFtZV0ucmVtb3ZlQWxsKCk7XG4gICAgICAgIH0uYmluZCh0aGlzKSlcbiAgICAgICkudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNiKG51bGwpO1xuICAgICAgfSkuY2F0Y2goY2IpXG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfVxufSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHNpZXN0YSwge1xuICBfY2FuQ2hhbmdlOiB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gIShpbnN0YWxsaW5nIHx8IGluc3RhbGxlZCk7XG4gICAgfVxuICB9LFxuICBpbnN0YWxsZWQ6IHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBpbnN0YWxsZWQ7XG4gICAgfVxuICB9XG59KTtcblxuaWYgKHR5cGVvZiB3aW5kb3cgIT0gJ3VuZGVmaW5lZCcpIHtcbiAgd2luZG93WydzaWVzdGEnXSA9IHNpZXN0YTtcbn1cblxuc2llc3RhLmxvZyA9IHJlcXVpcmUoJ2RlYnVnJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gc2llc3RhO1xuXG4oZnVuY3Rpb24gbG9hZEV4dGVuc2lvbnMoKSB7XG59KSgpO1xuXG5cbi8qKiBXRUJQQUNLIEZPT1RFUiAqKlxuICoqIC4vY29yZS9pbmRleC5qc1xuICoqLyIsInZhciBvYnNlcnZlID0gcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKS5QbGF0Zm9ybSxcbiAgYXJnc2FycmF5ID0gcmVxdWlyZSgnYXJnc2FycmF5JyksXG4gIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcjtcblxudmFyIGV4dGVuZCA9IGZ1bmN0aW9uKGxlZnQsIHJpZ2h0KSB7XG4gIGZvciAodmFyIHByb3AgaW4gcmlnaHQpIHtcbiAgICBpZiAocmlnaHQuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgIGxlZnRbcHJvcF0gPSByaWdodFtwcm9wXTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGxlZnQ7XG59O1xuXG52YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXksXG4gIGlzU3RyaW5nID0gZnVuY3Rpb24obykge1xuICAgIHJldHVybiB0eXBlb2YgbyA9PSAnc3RyaW5nJyB8fCBvIGluc3RhbmNlb2YgU3RyaW5nXG4gIH07XG5cbmV4dGVuZChtb2R1bGUuZXhwb3J0cywge1xuICBhcmdzYXJyYXk6IGFyZ3NhcnJheSxcbiAgLyoqXG4gICAqIFBlcmZvcm1zIGRpcnR5IGNoZWNrL09iamVjdC5vYnNlcnZlIGNhbGxiYWNrcyBkZXBlbmRpbmcgb24gdGhlIGJyb3dzZXIuXG4gICAqXG4gICAqIElmIE9iamVjdC5vYnNlcnZlIGlzIHByZXNlbnQsXG4gICAqIEBwYXJhbSBjYWxsYmFja1xuICAgKi9cbiAgbmV4dDogZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICBvYnNlcnZlLnBlcmZvcm1NaWNyb3Rhc2tDaGVja3BvaW50KCk7XG4gICAgc2V0VGltZW91dChjYWxsYmFjayk7XG4gIH0sXG4gIGV4dGVuZDogZXh0ZW5kLFxuICBndWlkOiAoZnVuY3Rpb24oKSB7XG4gICAgZnVuY3Rpb24gczQoKSB7XG4gICAgICByZXR1cm4gTWF0aC5mbG9vcigoMSArIE1hdGgucmFuZG9tKCkpICogMHgxMDAwMClcbiAgICAgICAgLnRvU3RyaW5nKDE2KVxuICAgICAgICAuc3Vic3RyaW5nKDEpO1xuICAgIH1cblxuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBzNCgpICsgczQoKSArICctJyArIHM0KCkgKyAnLScgKyBzNCgpICsgJy0nICtcbiAgICAgICAgczQoKSArICctJyArIHM0KCkgKyBzNCgpICsgczQoKTtcbiAgICB9O1xuICB9KSgpLFxuICBhc3NlcnQ6IGZ1bmN0aW9uKGNvbmRpdGlvbiwgbWVzc2FnZSwgY29udGV4dCkge1xuICAgIGlmICghY29uZGl0aW9uKSB7XG4gICAgICBtZXNzYWdlID0gbWVzc2FnZSB8fCBcIkFzc2VydGlvbiBmYWlsZWRcIjtcbiAgICAgIGNvbnRleHQgPSBjb250ZXh0IHx8IHt9O1xuICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IobWVzc2FnZSwgY29udGV4dCk7XG4gICAgfVxuICB9LFxuICBwbHVjazogZnVuY3Rpb24oY29sbCwga2V5KSB7XG4gICAgcmV0dXJuIGNvbGwubWFwKGZ1bmN0aW9uKG8pIHtyZXR1cm4gb1trZXldfSk7XG4gIH0sXG4gIHRoZW5CeTogKGZ1bmN0aW9uKCkge1xuICAgIC8qIG1peGluIGZvciB0aGUgYHRoZW5CeWAgcHJvcGVydHkgKi9cbiAgICBmdW5jdGlvbiBleHRlbmQoZikge1xuICAgICAgZi50aGVuQnkgPSB0YjtcbiAgICAgIHJldHVybiBmO1xuICAgIH1cblxuICAgIC8qIGFkZHMgYSBzZWNvbmRhcnkgY29tcGFyZSBmdW5jdGlvbiB0byB0aGUgdGFyZ2V0IGZ1bmN0aW9uIChgdGhpc2AgY29udGV4dClcbiAgICAgd2hpY2ggaXMgYXBwbGllZCBpbiBjYXNlIHRoZSBmaXJzdCBvbmUgcmV0dXJucyAwIChlcXVhbClcbiAgICAgcmV0dXJucyBhIG5ldyBjb21wYXJlIGZ1bmN0aW9uLCB3aGljaCBoYXMgYSBgdGhlbkJ5YCBtZXRob2QgYXMgd2VsbCAqL1xuICAgIGZ1bmN0aW9uIHRiKHkpIHtcbiAgICAgIHZhciB4ID0gdGhpcztcbiAgICAgIHJldHVybiBleHRlbmQoZnVuY3Rpb24oYSwgYikge1xuICAgICAgICByZXR1cm4geChhLCBiKSB8fCB5KGEsIGIpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGV4dGVuZDtcbiAgfSkoKSxcbiAgLyoqXG4gICAqIFRPRE86IFRoaXMgaXMgYmxvb2R5IHVnbHkuXG4gICAqIFByZXR0eSBkYW1uIHVzZWZ1bCB0byBiZSBhYmxlIHRvIGFjY2VzcyB0aGUgYm91bmQgb2JqZWN0IG9uIGEgZnVuY3Rpb24gdGhvLlxuICAgKiBTZWU6IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMTQzMDcyNjQvd2hhdC1vYmplY3QtamF2YXNjcmlwdC1mdW5jdGlvbi1pcy1ib3VuZC10by13aGF0LWlzLWl0cy10aGlzXG4gICAqL1xuICBfcGF0Y2hCaW5kOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgX2JpbmQgPSBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHkuYmluZChGdW5jdGlvbi5wcm90b3R5cGUuYmluZCk7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KEZ1bmN0aW9uLnByb3RvdHlwZSwgJ2JpbmQnLCB7XG4gICAgICB2YWx1ZTogZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgIHZhciBib3VuZEZ1bmN0aW9uID0gX2JpbmQodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGJvdW5kRnVuY3Rpb24sICdfX3NpZXN0YV9ib3VuZF9vYmplY3QnLCB7XG4gICAgICAgICAgdmFsdWU6IG9iaixcbiAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgZW51bWVyYWJsZTogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBib3VuZEZ1bmN0aW9uO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxuICBQcm9taXNlOiBQcm9taXNlLFxuICBwcm9taXNlOiBmdW5jdGlvbihjYiwgZm4pIHtcbiAgICBjYiA9IGNiIHx8IGZ1bmN0aW9uKCkge307XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgdmFyIF9jYiA9IGFyZ3NhcnJheShmdW5jdGlvbihhcmdzKSB7XG4gICAgICAgIHZhciBlcnIgPSBhcmdzWzBdLFxuICAgICAgICAgIHJlc3QgPSBhcmdzLnNsaWNlKDEpO1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignVW5jYXVnaHQgZXJyb3IgZHVyaW5nIHByb21pc2UgcmVqZWN0aW9uJywgZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXNvbHZlKHJlc3RbMF0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgcmVqZWN0KGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignVW5jYXVnaHQgZXJyb3IgZHVyaW5nIHByb21pc2UgcmVqZWN0aW9uJywgZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHZhciBib3VuZCA9IGNiWydfX3NpZXN0YV9ib3VuZF9vYmplY3QnXSB8fCBjYjsgLy8gUHJlc2VydmUgYm91bmQgb2JqZWN0LlxuICAgICAgICBjYi5hcHBseShib3VuZCwgYXJncyk7XG4gICAgICB9KTtcbiAgICAgIGZuKF9jYik7XG4gICAgfSlcbiAgfSxcbiAgZGVmZXI6IGZ1bmN0aW9uKCkge1xuICAgIHZhciByZXNvbHZlLCByZWplY3Q7XG4gICAgdmFyIHAgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihfcmVzb2x2ZSwgX3JlamVjdCkge1xuICAgICAgcmVzb2x2ZSA9IF9yZXNvbHZlO1xuICAgICAgcmVqZWN0ID0gX3JlamVjdDtcbiAgICB9KTtcbiAgICAvL25vaW5zcGVjdGlvbiBKU1VudXNlZEFzc2lnbm1lbnRcbiAgICBwLnJlc29sdmUgPSByZXNvbHZlO1xuICAgIC8vbm9pbnNwZWN0aW9uIEpTVW51c2VkQXNzaWdubWVudFxuICAgIHAucmVqZWN0ID0gcmVqZWN0O1xuICAgIHJldHVybiBwO1xuICB9LFxuICBzdWJQcm9wZXJ0aWVzOiBmdW5jdGlvbihvYmosIHN1Yk9iaiwgcHJvcGVydGllcykge1xuICAgIGlmICghaXNBcnJheShwcm9wZXJ0aWVzKSkge1xuICAgICAgcHJvcGVydGllcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgfVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcHJvcGVydGllcy5sZW5ndGg7IGkrKykge1xuICAgICAgKGZ1bmN0aW9uKHByb3BlcnR5KSB7XG4gICAgICAgIHZhciBvcHRzID0ge1xuICAgICAgICAgIHNldDogZmFsc2UsXG4gICAgICAgICAgbmFtZTogcHJvcGVydHksXG4gICAgICAgICAgcHJvcGVydHk6IHByb3BlcnR5XG4gICAgICAgIH07XG4gICAgICAgIGlmICghaXNTdHJpbmcocHJvcGVydHkpKSB7XG4gICAgICAgICAgZXh0ZW5kKG9wdHMsIHByb3BlcnR5KTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgZGVzYyA9IHtcbiAgICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIHN1Yk9ialtvcHRzLnByb3BlcnR5XTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICAgIH07XG4gICAgICAgIGlmIChvcHRzLnNldCkge1xuICAgICAgICAgIGRlc2Muc2V0ID0gZnVuY3Rpb24odikge1xuICAgICAgICAgICAgc3ViT2JqW29wdHMucHJvcGVydHldID0gdjtcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIG9wdHMubmFtZSwgZGVzYyk7XG4gICAgICB9KShwcm9wZXJ0aWVzW2ldKTtcbiAgICB9XG4gIH0sXG4gIGNhcGl0YWxpc2VGaXJzdExldHRlcjogZnVuY3Rpb24oc3RyaW5nKSB7XG4gICAgcmV0dXJuIHN0cmluZy5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHN0cmluZy5zbGljZSgxKTtcbiAgfSxcbiAgZXh0ZW5kRnJvbU9wdHM6IGZ1bmN0aW9uKG9iaiwgb3B0cywgZGVmYXVsdHMsIGVycm9yT25Vbmtub3duKSB7XG4gICAgZXJyb3JPblVua25vd24gPSBlcnJvck9uVW5rbm93biA9PSB1bmRlZmluZWQgPyB0cnVlIDogZXJyb3JPblVua25vd247XG4gICAgaWYgKGVycm9yT25Vbmtub3duKSB7XG4gICAgICB2YXIgZGVmYXVsdEtleXMgPSBPYmplY3Qua2V5cyhkZWZhdWx0cyksXG4gICAgICAgIG9wdHNLZXlzID0gT2JqZWN0LmtleXMob3B0cyk7XG4gICAgICB2YXIgdW5rbm93bktleXMgPSBvcHRzS2V5cy5maWx0ZXIoZnVuY3Rpb24obikge1xuICAgICAgICByZXR1cm4gZGVmYXVsdEtleXMuaW5kZXhPZihuKSA9PSAtMVxuICAgICAgfSk7XG4gICAgICBpZiAodW5rbm93bktleXMubGVuZ3RoKSB0aHJvdyBFcnJvcignVW5rbm93biBvcHRpb25zOiAnICsgdW5rbm93bktleXMudG9TdHJpbmcoKSk7XG4gICAgfVxuICAgIC8vIEFwcGx5IGFueSBmdW5jdGlvbnMgc3BlY2lmaWVkIGluIHRoZSBkZWZhdWx0cy5cbiAgICBPYmplY3Qua2V5cyhkZWZhdWx0cykuZm9yRWFjaChmdW5jdGlvbihrKSB7XG4gICAgICB2YXIgZCA9IGRlZmF1bHRzW2tdO1xuICAgICAgaWYgKHR5cGVvZiBkID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgZGVmYXVsdHNba10gPSBkKG9wdHNba10pO1xuICAgICAgICBkZWxldGUgb3B0c1trXTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBleHRlbmQoZGVmYXVsdHMsIG9wdHMpO1xuICAgIGV4dGVuZChvYmosIGRlZmF1bHRzKTtcbiAgfSxcbiAgaXNTdHJpbmc6IGlzU3RyaW5nLFxuICBpc0FycmF5OiBpc0FycmF5LFxuICBwcmV0dHlQcmludDogZnVuY3Rpb24obykge1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShvLCBudWxsLCA0KTtcbiAgfSxcbiAgZmxhdHRlbkFycmF5OiBmdW5jdGlvbihhcnIpIHtcbiAgICByZXR1cm4gYXJyLnJlZHVjZShmdW5jdGlvbihtZW1vLCBlKSB7XG4gICAgICBpZiAoaXNBcnJheShlKSkge1xuICAgICAgICBtZW1vID0gbWVtby5jb25jYXQoZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBtZW1vLnB1c2goZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbWVtbztcbiAgICB9LCBbXSk7XG4gIH0sXG4gIHVuZmxhdHRlbkFycmF5OiBmdW5jdGlvbihhcnIsIG1vZGVsQXJyKSB7XG4gICAgdmFyIG4gPSAwO1xuICAgIHZhciB1bmZsYXR0ZW5lZCA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbW9kZWxBcnIubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChpc0FycmF5KG1vZGVsQXJyW2ldKSkge1xuICAgICAgICB2YXIgbmV3QXJyID0gW107XG4gICAgICAgIHVuZmxhdHRlbmVkW2ldID0gbmV3QXJyO1xuICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IG1vZGVsQXJyW2ldLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgbmV3QXJyLnB1c2goYXJyW25dKTtcbiAgICAgICAgICBuKys7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHVuZmxhdHRlbmVkW2ldID0gYXJyW25dO1xuICAgICAgICBuKys7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB1bmZsYXR0ZW5lZDtcbiAgfVxufSk7XG5cbi8qKlxuICogQ29tcGFjdCBhIHNwYXJzZSBhcnJheVxuICogQHBhcmFtIGFyclxuICogQHJldHVybnMge0FycmF5fVxuICovXG5mdW5jdGlvbiBjb21wYWN0KGFycikge1xuICBhcnIgPSBhcnIgfHwgW107XG4gIHJldHVybiBhcnIuZmlsdGVyKGZ1bmN0aW9uKHgpIHtyZXR1cm4geH0pO1xufVxuXG4vKipcbiAqIEV4ZWN1dGUgdGFza3MgaW4gcGFyYWxsZWxcbiAqIEBwYXJhbSB0YXNrc1xuICogQHBhcmFtIGNiXG4gKi9cbmZ1bmN0aW9uIHBhcmFsbGVsKHRhc2tzLCBjYikge1xuICBjYiA9IGNiIHx8IGZ1bmN0aW9uKCkge307XG4gIGlmICh0YXNrcyAmJiB0YXNrcy5sZW5ndGgpIHtcbiAgICB2YXIgcmVzdWx0cyA9IFtdLCBlcnJvcnMgPSBbXSwgbnVtRmluaXNoZWQgPSAwO1xuICAgIHRhc2tzLmZvckVhY2goZnVuY3Rpb24oZm4sIGlkeCkge1xuICAgICAgcmVzdWx0c1tpZHhdID0gZmFsc2U7XG4gICAgICBmbihmdW5jdGlvbihlcnIsIHJlcykge1xuICAgICAgICBudW1GaW5pc2hlZCsrO1xuICAgICAgICBpZiAoZXJyKSBlcnJvcnNbaWR4XSA9IGVycjtcbiAgICAgICAgcmVzdWx0c1tpZHhdID0gcmVzO1xuICAgICAgICBpZiAobnVtRmluaXNoZWQgPT0gdGFza3MubGVuZ3RoKSB7XG4gICAgICAgICAgY2IoXG4gICAgICAgICAgICBlcnJvcnMubGVuZ3RoID8gY29tcGFjdChlcnJvcnMpIDogbnVsbCxcbiAgICAgICAgICAgIGNvbXBhY3QocmVzdWx0cyksXG4gICAgICAgICAgICB7cmVzdWx0czogcmVzdWx0cywgZXJyb3JzOiBlcnJvcnN9XG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH0gZWxzZSBjYigpO1xufVxuXG4vKipcbiAqIEV4ZWN1dGUgdGFza3Mgb25lIGFmdGVyIGFub3RoZXJcbiAqIEBwYXJhbSB0YXNrc1xuICogQHBhcmFtIGNiXG4gKi9cbmZ1bmN0aW9uIHNlcmllcyh0YXNrcywgY2IpIHtcbiAgY2IgPSBjYiB8fCBmdW5jdGlvbigpIHt9O1xuICBpZiAodGFza3MgJiYgdGFza3MubGVuZ3RoKSB7XG4gICAgdmFyIHJlc3VsdHMgPSBbXSwgZXJyb3JzID0gW10sIGlkeCA9IDA7XG5cbiAgICBmdW5jdGlvbiBleGVjdXRlVGFzayh0YXNrKSB7XG4gICAgICB0YXNrKGZ1bmN0aW9uKGVyciwgcmVzKSB7XG4gICAgICAgIGlmIChlcnIpIGVycm9yc1tpZHhdID0gZXJyO1xuICAgICAgICByZXN1bHRzW2lkeF0gPSByZXM7XG4gICAgICAgIGlmICghdGFza3MubGVuZ3RoKSB7XG4gICAgICAgICAgY2IoXG4gICAgICAgICAgICBlcnJvcnMubGVuZ3RoID8gY29tcGFjdChlcnJvcnMpIDogbnVsbCxcbiAgICAgICAgICAgIGNvbXBhY3QocmVzdWx0cyksXG4gICAgICAgICAgICB7cmVzdWx0czogcmVzdWx0cywgZXJyb3JzOiBlcnJvcnN9XG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBpZHgrKztcbiAgICAgICAgICBuZXh0VGFzaygpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBuZXh0VGFzaygpIHtcbiAgICAgIHZhciBuZXh0VGFzayA9IHRhc2tzLnNoaWZ0KCk7XG4gICAgICBleGVjdXRlVGFzayhuZXh0VGFzayk7XG4gICAgfVxuXG4gICAgbmV4dFRhc2soKTtcblxuICB9IGVsc2UgY2IoKTtcbn1cblxuXG5leHRlbmQobW9kdWxlLmV4cG9ydHMsIHtcbiAgY29tcGFjdDogY29tcGFjdCxcbiAgcGFyYWxsZWw6IHBhcmFsbGVsLFxuICBzZXJpZXM6IHNlcmllc1xufSk7XG5cbnZhciBGTl9BUkdTID0gL15mdW5jdGlvblxccypbXlxcKF0qXFwoXFxzKihbXlxcKV0qKVxcKS9tLFxuICBGTl9BUkdfU1BMSVQgPSAvLC8sXG4gIEZOX0FSRyA9IC9eXFxzKihfPykoLis/KVxcMVxccyokLyxcbiAgU1RSSVBfQ09NTUVOVFMgPSAvKChcXC9cXC8uKiQpfChcXC9cXCpbXFxzXFxTXSo/XFwqXFwvKSkvbWc7XG5cbmV4dGVuZChtb2R1bGUuZXhwb3J0cywge1xuICAvKipcbiAgICogUmV0dXJuIHRoZSBwYXJhbWV0ZXIgbmFtZXMgb2YgYSBmdW5jdGlvbi5cbiAgICogTm90ZTogYWRhcHRlZCBmcm9tIEFuZ3VsYXJKUyBkZXBlbmRlbmN5IGluamVjdGlvbiA6KVxuICAgKiBAcGFyYW0gZm5cbiAgICovXG4gIHBhcmFtTmFtZXM6IGZ1bmN0aW9uKGZuKSB7XG4gICAgLy8gVE9ETzogSXMgdGhlcmUgYSBtb3JlIHJvYnVzdCB3YXkgb2YgZG9pbmcgdGhpcz9cbiAgICB2YXIgcGFyYW1zID0gW10sXG4gICAgICBmblRleHQsXG4gICAgICBhcmdEZWNsO1xuICAgIGZuVGV4dCA9IGZuLnRvU3RyaW5nKCkucmVwbGFjZShTVFJJUF9DT01NRU5UUywgJycpO1xuICAgIGFyZ0RlY2wgPSBmblRleHQubWF0Y2goRk5fQVJHUyk7XG5cbiAgICBhcmdEZWNsWzFdLnNwbGl0KEZOX0FSR19TUExJVCkuZm9yRWFjaChmdW5jdGlvbihhcmcpIHtcbiAgICAgIGFyZy5yZXBsYWNlKEZOX0FSRywgZnVuY3Rpb24oYWxsLCB1bmRlcnNjb3JlLCBuYW1lKSB7XG4gICAgICAgIHBhcmFtcy5wdXNoKG5hbWUpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHBhcmFtcztcbiAgfVxufSk7XG5cblxuLyoqIFdFQlBBQ0sgRk9PVEVSICoqXG4gKiogLi9jb3JlL3V0aWwuanNcbiAqKi8iLCIvKlxuICogQ29weXJpZ2h0IChjKSAyMDE0IFRoZSBQb2x5bWVyIFByb2plY3QgQXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqIFRoaXMgY29kZSBtYXkgb25seSBiZSB1c2VkIHVuZGVyIHRoZSBCU0Qgc3R5bGUgbGljZW5zZSBmb3VuZCBhdCBodHRwOi8vcG9seW1lci5naXRodWIuaW8vTElDRU5TRS50eHRcbiAqIFRoZSBjb21wbGV0ZSBzZXQgb2YgYXV0aG9ycyBtYXkgYmUgZm91bmQgYXQgaHR0cDovL3BvbHltZXIuZ2l0aHViLmlvL0FVVEhPUlMudHh0XG4gKiBUaGUgY29tcGxldGUgc2V0IG9mIGNvbnRyaWJ1dG9ycyBtYXkgYmUgZm91bmQgYXQgaHR0cDovL3BvbHltZXIuZ2l0aHViLmlvL0NPTlRSSUJVVE9SUy50eHRcbiAqIENvZGUgZGlzdHJpYnV0ZWQgYnkgR29vZ2xlIGFzIHBhcnQgb2YgdGhlIHBvbHltZXIgcHJvamVjdCBpcyBhbHNvXG4gKiBzdWJqZWN0IHRvIGFuIGFkZGl0aW9uYWwgSVAgcmlnaHRzIGdyYW50IGZvdW5kIGF0IGh0dHA6Ly9wb2x5bWVyLmdpdGh1Yi5pby9QQVRFTlRTLnR4dFxuICovXG5cbihmdW5jdGlvbihnbG9iYWwpIHtcbiAgJ3VzZSBzdHJpY3QnO1xuXG4gIHZhciB0ZXN0aW5nRXhwb3NlQ3ljbGVDb3VudCA9IGdsb2JhbC50ZXN0aW5nRXhwb3NlQ3ljbGVDb3VudDtcblxuICAvLyBEZXRlY3QgYW5kIGRvIGJhc2ljIHNhbml0eSBjaGVja2luZyBvbiBPYmplY3QvQXJyYXkub2JzZXJ2ZS5cbiAgZnVuY3Rpb24gZGV0ZWN0T2JqZWN0T2JzZXJ2ZSgpIHtcbiAgICBpZiAodHlwZW9mIE9iamVjdC5vYnNlcnZlICE9PSAnZnVuY3Rpb24nIHx8XG4gICAgICAgIHR5cGVvZiBBcnJheS5vYnNlcnZlICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdmFyIHJlY29yZHMgPSBbXTtcblxuICAgIGZ1bmN0aW9uIGNhbGxiYWNrKHJlY3MpIHtcbiAgICAgIHJlY29yZHMgPSByZWNzO1xuICAgIH1cblxuICAgIHZhciB0ZXN0ID0ge307XG4gICAgdmFyIGFyciA9IFtdO1xuICAgIE9iamVjdC5vYnNlcnZlKHRlc3QsIGNhbGxiYWNrKTtcbiAgICBBcnJheS5vYnNlcnZlKGFyciwgY2FsbGJhY2spO1xuICAgIHRlc3QuaWQgPSAxO1xuICAgIHRlc3QuaWQgPSAyO1xuICAgIGRlbGV0ZSB0ZXN0LmlkO1xuICAgIGFyci5wdXNoKDEsIDIpO1xuICAgIGFyci5sZW5ndGggPSAwO1xuXG4gICAgT2JqZWN0LmRlbGl2ZXJDaGFuZ2VSZWNvcmRzKGNhbGxiYWNrKTtcbiAgICBpZiAocmVjb3Jkcy5sZW5ndGggIT09IDUpXG4gICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICBpZiAocmVjb3Jkc1swXS50eXBlICE9ICdhZGQnIHx8XG4gICAgICAgIHJlY29yZHNbMV0udHlwZSAhPSAndXBkYXRlJyB8fFxuICAgICAgICByZWNvcmRzWzJdLnR5cGUgIT0gJ2RlbGV0ZScgfHxcbiAgICAgICAgcmVjb3Jkc1szXS50eXBlICE9ICdzcGxpY2UnIHx8XG4gICAgICAgIHJlY29yZHNbNF0udHlwZSAhPSAnc3BsaWNlJykge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIE9iamVjdC51bm9ic2VydmUodGVzdCwgY2FsbGJhY2spO1xuICAgIEFycmF5LnVub2JzZXJ2ZShhcnIsIGNhbGxiYWNrKTtcblxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgdmFyIGhhc09ic2VydmUgPSBkZXRlY3RPYmplY3RPYnNlcnZlKCk7XG5cbiAgZnVuY3Rpb24gZGV0ZWN0RXZhbCgpIHtcbiAgICAvLyBEb24ndCB0ZXN0IGZvciBldmFsIGlmIHdlJ3JlIHJ1bm5pbmcgaW4gYSBDaHJvbWUgQXBwIGVudmlyb25tZW50LlxuICAgIC8vIFdlIGNoZWNrIGZvciBBUElzIHNldCB0aGF0IG9ubHkgZXhpc3QgaW4gYSBDaHJvbWUgQXBwIGNvbnRleHQuXG4gICAgaWYgKHR5cGVvZiBjaHJvbWUgIT09ICd1bmRlZmluZWQnICYmIGNocm9tZS5hcHAgJiYgY2hyb21lLmFwcC5ydW50aW1lKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gRmlyZWZveCBPUyBBcHBzIGRvIG5vdCBhbGxvdyBldmFsLiBUaGlzIGZlYXR1cmUgZGV0ZWN0aW9uIGlzIHZlcnkgaGFja3lcbiAgICAvLyBidXQgZXZlbiBpZiBzb21lIG90aGVyIHBsYXRmb3JtIGFkZHMgc3VwcG9ydCBmb3IgdGhpcyBmdW5jdGlvbiB0aGlzIGNvZGVcbiAgICAvLyB3aWxsIGNvbnRpbnVlIHRvIHdvcmsuXG4gICAgaWYgKG5hdmlnYXRvci5nZXREZXZpY2VTdG9yYWdlKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIHZhciBmID0gbmV3IEZ1bmN0aW9uKCcnLCAncmV0dXJuIHRydWU7Jyk7XG4gICAgICByZXR1cm4gZigpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgdmFyIGhhc0V2YWwgPSBkZXRlY3RFdmFsKCk7XG5cbiAgZnVuY3Rpb24gaXNJbmRleChzKSB7XG4gICAgcmV0dXJuICtzID09PSBzID4+PiAwICYmIHMgIT09ICcnO1xuICB9XG5cbiAgZnVuY3Rpb24gdG9OdW1iZXIocykge1xuICAgIHJldHVybiArcztcbiAgfVxuXG4gIGZ1bmN0aW9uIGlzT2JqZWN0KG9iaikge1xuICAgIHJldHVybiBvYmogPT09IE9iamVjdChvYmopO1xuICB9XG5cbiAgdmFyIG51bWJlcklzTmFOID0gZ2xvYmFsLk51bWJlci5pc05hTiB8fCBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInICYmIGdsb2JhbC5pc05hTih2YWx1ZSk7XG4gIH1cblxuICBmdW5jdGlvbiBhcmVTYW1lVmFsdWUobGVmdCwgcmlnaHQpIHtcbiAgICBpZiAobGVmdCA9PT0gcmlnaHQpXG4gICAgICByZXR1cm4gbGVmdCAhPT0gMCB8fCAxIC8gbGVmdCA9PT0gMSAvIHJpZ2h0O1xuICAgIGlmIChudW1iZXJJc05hTihsZWZ0KSAmJiBudW1iZXJJc05hTihyaWdodCkpXG4gICAgICByZXR1cm4gdHJ1ZTtcblxuICAgIHJldHVybiBsZWZ0ICE9PSBsZWZ0ICYmIHJpZ2h0ICE9PSByaWdodDtcbiAgfVxuXG4gIHZhciBjcmVhdGVPYmplY3QgPSAoJ19fcHJvdG9fXycgaW4ge30pID9cbiAgICBmdW5jdGlvbihvYmopIHsgcmV0dXJuIG9iajsgfSA6XG4gICAgZnVuY3Rpb24ob2JqKSB7XG4gICAgICB2YXIgcHJvdG8gPSBvYmouX19wcm90b19fO1xuICAgICAgaWYgKCFwcm90bylcbiAgICAgICAgcmV0dXJuIG9iajtcbiAgICAgIHZhciBuZXdPYmplY3QgPSBPYmplY3QuY3JlYXRlKHByb3RvKTtcbiAgICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKG9iaikuZm9yRWFjaChmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShuZXdPYmplY3QsIG5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3Iob2JqLCBuYW1lKSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBuZXdPYmplY3Q7XG4gICAgfTtcblxuICB2YXIgaWRlbnRTdGFydCA9ICdbXFwkX2EtekEtWl0nO1xuICB2YXIgaWRlbnRQYXJ0ID0gJ1tcXCRfYS16QS1aMC05XSc7XG4gIHZhciBpZGVudFJlZ0V4cCA9IG5ldyBSZWdFeHAoJ14nICsgaWRlbnRTdGFydCArICcrJyArIGlkZW50UGFydCArICcqJyArICckJyk7XG5cbiAgZnVuY3Rpb24gZ2V0UGF0aENoYXJUeXBlKGNoYXIpIHtcbiAgICBpZiAoY2hhciA9PT0gdW5kZWZpbmVkKVxuICAgICAgcmV0dXJuICdlb2YnO1xuXG4gICAgdmFyIGNvZGUgPSBjaGFyLmNoYXJDb2RlQXQoMCk7XG5cbiAgICBzd2l0Y2goY29kZSkge1xuICAgICAgY2FzZSAweDVCOiAvLyBbXG4gICAgICBjYXNlIDB4NUQ6IC8vIF1cbiAgICAgIGNhc2UgMHgyRTogLy8gLlxuICAgICAgY2FzZSAweDIyOiAvLyBcIlxuICAgICAgY2FzZSAweDI3OiAvLyAnXG4gICAgICBjYXNlIDB4MzA6IC8vIDBcbiAgICAgICAgcmV0dXJuIGNoYXI7XG5cbiAgICAgIGNhc2UgMHg1RjogLy8gX1xuICAgICAgY2FzZSAweDI0OiAvLyAkXG4gICAgICAgIHJldHVybiAnaWRlbnQnO1xuXG4gICAgICBjYXNlIDB4MjA6IC8vIFNwYWNlXG4gICAgICBjYXNlIDB4MDk6IC8vIFRhYlxuICAgICAgY2FzZSAweDBBOiAvLyBOZXdsaW5lXG4gICAgICBjYXNlIDB4MEQ6IC8vIFJldHVyblxuICAgICAgY2FzZSAweEEwOiAgLy8gTm8tYnJlYWsgc3BhY2VcbiAgICAgIGNhc2UgMHhGRUZGOiAgLy8gQnl0ZSBPcmRlciBNYXJrXG4gICAgICBjYXNlIDB4MjAyODogIC8vIExpbmUgU2VwYXJhdG9yXG4gICAgICBjYXNlIDB4MjAyOTogIC8vIFBhcmFncmFwaCBTZXBhcmF0b3JcbiAgICAgICAgcmV0dXJuICd3cyc7XG4gICAgfVxuXG4gICAgLy8gYS16LCBBLVpcbiAgICBpZiAoKDB4NjEgPD0gY29kZSAmJiBjb2RlIDw9IDB4N0EpIHx8ICgweDQxIDw9IGNvZGUgJiYgY29kZSA8PSAweDVBKSlcbiAgICAgIHJldHVybiAnaWRlbnQnO1xuXG4gICAgLy8gMS05XG4gICAgaWYgKDB4MzEgPD0gY29kZSAmJiBjb2RlIDw9IDB4MzkpXG4gICAgICByZXR1cm4gJ251bWJlcic7XG5cbiAgICByZXR1cm4gJ2Vsc2UnO1xuICB9XG5cbiAgdmFyIHBhdGhTdGF0ZU1hY2hpbmUgPSB7XG4gICAgJ2JlZm9yZVBhdGgnOiB7XG4gICAgICAnd3MnOiBbJ2JlZm9yZVBhdGgnXSxcbiAgICAgICdpZGVudCc6IFsnaW5JZGVudCcsICdhcHBlbmQnXSxcbiAgICAgICdbJzogWydiZWZvcmVFbGVtZW50J10sXG4gICAgICAnZW9mJzogWydhZnRlclBhdGgnXVxuICAgIH0sXG5cbiAgICAnaW5QYXRoJzoge1xuICAgICAgJ3dzJzogWydpblBhdGgnXSxcbiAgICAgICcuJzogWydiZWZvcmVJZGVudCddLFxuICAgICAgJ1snOiBbJ2JlZm9yZUVsZW1lbnQnXSxcbiAgICAgICdlb2YnOiBbJ2FmdGVyUGF0aCddXG4gICAgfSxcblxuICAgICdiZWZvcmVJZGVudCc6IHtcbiAgICAgICd3cyc6IFsnYmVmb3JlSWRlbnQnXSxcbiAgICAgICdpZGVudCc6IFsnaW5JZGVudCcsICdhcHBlbmQnXVxuICAgIH0sXG5cbiAgICAnaW5JZGVudCc6IHtcbiAgICAgICdpZGVudCc6IFsnaW5JZGVudCcsICdhcHBlbmQnXSxcbiAgICAgICcwJzogWydpbklkZW50JywgJ2FwcGVuZCddLFxuICAgICAgJ251bWJlcic6IFsnaW5JZGVudCcsICdhcHBlbmQnXSxcbiAgICAgICd3cyc6IFsnaW5QYXRoJywgJ3B1c2gnXSxcbiAgICAgICcuJzogWydiZWZvcmVJZGVudCcsICdwdXNoJ10sXG4gICAgICAnWyc6IFsnYmVmb3JlRWxlbWVudCcsICdwdXNoJ10sXG4gICAgICAnZW9mJzogWydhZnRlclBhdGgnLCAncHVzaCddXG4gICAgfSxcblxuICAgICdiZWZvcmVFbGVtZW50Jzoge1xuICAgICAgJ3dzJzogWydiZWZvcmVFbGVtZW50J10sXG4gICAgICAnMCc6IFsnYWZ0ZXJaZXJvJywgJ2FwcGVuZCddLFxuICAgICAgJ251bWJlcic6IFsnaW5JbmRleCcsICdhcHBlbmQnXSxcbiAgICAgIFwiJ1wiOiBbJ2luU2luZ2xlUXVvdGUnLCAnYXBwZW5kJywgJyddLFxuICAgICAgJ1wiJzogWydpbkRvdWJsZVF1b3RlJywgJ2FwcGVuZCcsICcnXVxuICAgIH0sXG5cbiAgICAnYWZ0ZXJaZXJvJzoge1xuICAgICAgJ3dzJzogWydhZnRlckVsZW1lbnQnLCAncHVzaCddLFxuICAgICAgJ10nOiBbJ2luUGF0aCcsICdwdXNoJ11cbiAgICB9LFxuXG4gICAgJ2luSW5kZXgnOiB7XG4gICAgICAnMCc6IFsnaW5JbmRleCcsICdhcHBlbmQnXSxcbiAgICAgICdudW1iZXInOiBbJ2luSW5kZXgnLCAnYXBwZW5kJ10sXG4gICAgICAnd3MnOiBbJ2FmdGVyRWxlbWVudCddLFxuICAgICAgJ10nOiBbJ2luUGF0aCcsICdwdXNoJ11cbiAgICB9LFxuXG4gICAgJ2luU2luZ2xlUXVvdGUnOiB7XG4gICAgICBcIidcIjogWydhZnRlckVsZW1lbnQnXSxcbiAgICAgICdlb2YnOiBbJ2Vycm9yJ10sXG4gICAgICAnZWxzZSc6IFsnaW5TaW5nbGVRdW90ZScsICdhcHBlbmQnXVxuICAgIH0sXG5cbiAgICAnaW5Eb3VibGVRdW90ZSc6IHtcbiAgICAgICdcIic6IFsnYWZ0ZXJFbGVtZW50J10sXG4gICAgICAnZW9mJzogWydlcnJvciddLFxuICAgICAgJ2Vsc2UnOiBbJ2luRG91YmxlUXVvdGUnLCAnYXBwZW5kJ11cbiAgICB9LFxuXG4gICAgJ2FmdGVyRWxlbWVudCc6IHtcbiAgICAgICd3cyc6IFsnYWZ0ZXJFbGVtZW50J10sXG4gICAgICAnXSc6IFsnaW5QYXRoJywgJ3B1c2gnXVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG5vb3AoKSB7fVxuXG4gIGZ1bmN0aW9uIHBhcnNlUGF0aChwYXRoKSB7XG4gICAgdmFyIGtleXMgPSBbXTtcbiAgICB2YXIgaW5kZXggPSAtMTtcbiAgICB2YXIgYywgbmV3Q2hhciwga2V5LCB0eXBlLCB0cmFuc2l0aW9uLCBhY3Rpb24sIHR5cGVNYXAsIG1vZGUgPSAnYmVmb3JlUGF0aCc7XG5cbiAgICB2YXIgYWN0aW9ucyA9IHtcbiAgICAgIHB1c2g6IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoa2V5ID09PSB1bmRlZmluZWQpXG4gICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGtleXMucHVzaChrZXkpO1xuICAgICAgICBrZXkgPSB1bmRlZmluZWQ7XG4gICAgICB9LFxuXG4gICAgICBhcHBlbmQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoa2V5ID09PSB1bmRlZmluZWQpXG4gICAgICAgICAga2V5ID0gbmV3Q2hhclxuICAgICAgICBlbHNlXG4gICAgICAgICAga2V5ICs9IG5ld0NoYXI7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIG1heWJlVW5lc2NhcGVRdW90ZSgpIHtcbiAgICAgIGlmIChpbmRleCA+PSBwYXRoLmxlbmd0aClcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICB2YXIgbmV4dENoYXIgPSBwYXRoW2luZGV4ICsgMV07XG4gICAgICBpZiAoKG1vZGUgPT0gJ2luU2luZ2xlUXVvdGUnICYmIG5leHRDaGFyID09IFwiJ1wiKSB8fFxuICAgICAgICAgIChtb2RlID09ICdpbkRvdWJsZVF1b3RlJyAmJiBuZXh0Q2hhciA9PSAnXCInKSkge1xuICAgICAgICBpbmRleCsrO1xuICAgICAgICBuZXdDaGFyID0gbmV4dENoYXI7XG4gICAgICAgIGFjdGlvbnMuYXBwZW5kKCk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHdoaWxlIChtb2RlKSB7XG4gICAgICBpbmRleCsrO1xuICAgICAgYyA9IHBhdGhbaW5kZXhdO1xuXG4gICAgICBpZiAoYyA9PSAnXFxcXCcgJiYgbWF5YmVVbmVzY2FwZVF1b3RlKG1vZGUpKVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgdHlwZSA9IGdldFBhdGhDaGFyVHlwZShjKTtcbiAgICAgIHR5cGVNYXAgPSBwYXRoU3RhdGVNYWNoaW5lW21vZGVdO1xuICAgICAgdHJhbnNpdGlvbiA9IHR5cGVNYXBbdHlwZV0gfHwgdHlwZU1hcFsnZWxzZSddIHx8ICdlcnJvcic7XG5cbiAgICAgIGlmICh0cmFuc2l0aW9uID09ICdlcnJvcicpXG4gICAgICAgIHJldHVybjsgLy8gcGFyc2UgZXJyb3I7XG5cbiAgICAgIG1vZGUgPSB0cmFuc2l0aW9uWzBdO1xuICAgICAgYWN0aW9uID0gYWN0aW9uc1t0cmFuc2l0aW9uWzFdXSB8fCBub29wO1xuICAgICAgbmV3Q2hhciA9IHRyYW5zaXRpb25bMl0gPT09IHVuZGVmaW5lZCA/IGMgOiB0cmFuc2l0aW9uWzJdO1xuICAgICAgYWN0aW9uKCk7XG5cbiAgICAgIGlmIChtb2RlID09PSAnYWZ0ZXJQYXRoJykge1xuICAgICAgICByZXR1cm4ga2V5cztcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm47IC8vIHBhcnNlIGVycm9yXG4gIH1cblxuICBmdW5jdGlvbiBpc0lkZW50KHMpIHtcbiAgICByZXR1cm4gaWRlbnRSZWdFeHAudGVzdChzKTtcbiAgfVxuXG4gIHZhciBjb25zdHJ1Y3RvcklzUHJpdmF0ZSA9IHt9O1xuXG4gIGZ1bmN0aW9uIFBhdGgocGFydHMsIHByaXZhdGVUb2tlbikge1xuICAgIGlmIChwcml2YXRlVG9rZW4gIT09IGNvbnN0cnVjdG9ySXNQcml2YXRlKVxuICAgICAgdGhyb3cgRXJyb3IoJ1VzZSBQYXRoLmdldCB0byByZXRyaWV2ZSBwYXRoIG9iamVjdHMnKTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcGFydHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHRoaXMucHVzaChTdHJpbmcocGFydHNbaV0pKTtcbiAgICB9XG5cbiAgICBpZiAoaGFzRXZhbCAmJiB0aGlzLmxlbmd0aCkge1xuICAgICAgdGhpcy5nZXRWYWx1ZUZyb20gPSB0aGlzLmNvbXBpbGVkR2V0VmFsdWVGcm9tRm4oKTtcbiAgICB9XG4gIH1cblxuICAvLyBUT0RPKHJhZmFlbHcpOiBNYWtlIHNpbXBsZSBMUlUgY2FjaGVcbiAgdmFyIHBhdGhDYWNoZSA9IHt9O1xuXG4gIGZ1bmN0aW9uIGdldFBhdGgocGF0aFN0cmluZykge1xuICAgIGlmIChwYXRoU3RyaW5nIGluc3RhbmNlb2YgUGF0aClcbiAgICAgIHJldHVybiBwYXRoU3RyaW5nO1xuXG4gICAgaWYgKHBhdGhTdHJpbmcgPT0gbnVsbCB8fCBwYXRoU3RyaW5nLmxlbmd0aCA9PSAwKVxuICAgICAgcGF0aFN0cmluZyA9ICcnO1xuXG4gICAgaWYgKHR5cGVvZiBwYXRoU3RyaW5nICE9ICdzdHJpbmcnKSB7XG4gICAgICBpZiAoaXNJbmRleChwYXRoU3RyaW5nLmxlbmd0aCkpIHtcbiAgICAgICAgLy8gQ29uc3RydWN0ZWQgd2l0aCBhcnJheS1saWtlIChwcmUtcGFyc2VkKSBrZXlzXG4gICAgICAgIHJldHVybiBuZXcgUGF0aChwYXRoU3RyaW5nLCBjb25zdHJ1Y3RvcklzUHJpdmF0ZSk7XG4gICAgICB9XG5cbiAgICAgIHBhdGhTdHJpbmcgPSBTdHJpbmcocGF0aFN0cmluZyk7XG4gICAgfVxuXG4gICAgdmFyIHBhdGggPSBwYXRoQ2FjaGVbcGF0aFN0cmluZ107XG4gICAgaWYgKHBhdGgpXG4gICAgICByZXR1cm4gcGF0aDtcblxuICAgIHZhciBwYXJ0cyA9IHBhcnNlUGF0aChwYXRoU3RyaW5nKTtcbiAgICBpZiAoIXBhcnRzKVxuICAgICAgcmV0dXJuIGludmFsaWRQYXRoO1xuXG4gICAgdmFyIHBhdGggPSBuZXcgUGF0aChwYXJ0cywgY29uc3RydWN0b3JJc1ByaXZhdGUpO1xuICAgIHBhdGhDYWNoZVtwYXRoU3RyaW5nXSA9IHBhdGg7XG4gICAgcmV0dXJuIHBhdGg7XG4gIH1cblxuICBQYXRoLmdldCA9IGdldFBhdGg7XG5cbiAgZnVuY3Rpb24gZm9ybWF0QWNjZXNzb3Ioa2V5KSB7XG4gICAgaWYgKGlzSW5kZXgoa2V5KSkge1xuICAgICAgcmV0dXJuICdbJyArIGtleSArICddJztcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuICdbXCInICsga2V5LnJlcGxhY2UoL1wiL2csICdcXFxcXCInKSArICdcIl0nO1xuICAgIH1cbiAgfVxuXG4gIFBhdGgucHJvdG90eXBlID0gY3JlYXRlT2JqZWN0KHtcbiAgICBfX3Byb3RvX186IFtdLFxuICAgIHZhbGlkOiB0cnVlLFxuXG4gICAgdG9TdHJpbmc6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHBhdGhTdHJpbmcgPSAnJztcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIga2V5ID0gdGhpc1tpXTtcbiAgICAgICAgaWYgKGlzSWRlbnQoa2V5KSkge1xuICAgICAgICAgIHBhdGhTdHJpbmcgKz0gaSA/ICcuJyArIGtleSA6IGtleTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwYXRoU3RyaW5nICs9IGZvcm1hdEFjY2Vzc29yKGtleSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHBhdGhTdHJpbmc7XG4gICAgfSxcblxuICAgIGdldFZhbHVlRnJvbTogZnVuY3Rpb24ob2JqLCBkaXJlY3RPYnNlcnZlcikge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChvYmogPT0gbnVsbClcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIG9iaiA9IG9ialt0aGlzW2ldXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBvYmo7XG4gICAgfSxcblxuICAgIGl0ZXJhdGVPYmplY3RzOiBmdW5jdGlvbihvYmosIG9ic2VydmUpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoaSlcbiAgICAgICAgICBvYmogPSBvYmpbdGhpc1tpIC0gMV1dO1xuICAgICAgICBpZiAoIWlzT2JqZWN0KG9iaikpXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICBvYnNlcnZlKG9iaiwgdGhpc1swXSk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIGNvbXBpbGVkR2V0VmFsdWVGcm9tRm46IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHN0ciA9ICcnO1xuICAgICAgdmFyIHBhdGhTdHJpbmcgPSAnb2JqJztcbiAgICAgIHN0ciArPSAnaWYgKG9iaiAhPSBudWxsJztcbiAgICAgIHZhciBpID0gMDtcbiAgICAgIHZhciBrZXk7XG4gICAgICBmb3IgKDsgaSA8ICh0aGlzLmxlbmd0aCAtIDEpOyBpKyspIHtcbiAgICAgICAga2V5ID0gdGhpc1tpXTtcbiAgICAgICAgcGF0aFN0cmluZyArPSBpc0lkZW50KGtleSkgPyAnLicgKyBrZXkgOiBmb3JtYXRBY2Nlc3NvcihrZXkpO1xuICAgICAgICBzdHIgKz0gJyAmJlxcbiAgICAgJyArIHBhdGhTdHJpbmcgKyAnICE9IG51bGwnO1xuICAgICAgfVxuICAgICAgc3RyICs9ICcpXFxuJztcblxuICAgICAgdmFyIGtleSA9IHRoaXNbaV07XG4gICAgICBwYXRoU3RyaW5nICs9IGlzSWRlbnQoa2V5KSA/ICcuJyArIGtleSA6IGZvcm1hdEFjY2Vzc29yKGtleSk7XG5cbiAgICAgIHN0ciArPSAnICByZXR1cm4gJyArIHBhdGhTdHJpbmcgKyAnO1xcbmVsc2VcXG4gIHJldHVybiB1bmRlZmluZWQ7JztcbiAgICAgIHJldHVybiBuZXcgRnVuY3Rpb24oJ29iaicsIHN0cik7XG4gICAgfSxcblxuICAgIHNldFZhbHVlRnJvbTogZnVuY3Rpb24ob2JqLCB2YWx1ZSkge1xuICAgICAgaWYgKCF0aGlzLmxlbmd0aClcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICAgIGlmICghaXNPYmplY3Qob2JqKSlcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIG9iaiA9IG9ialt0aGlzW2ldXTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFpc09iamVjdChvYmopKVxuICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgIG9ialt0aGlzW2ldXSA9IHZhbHVlO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9KTtcblxuICB2YXIgaW52YWxpZFBhdGggPSBuZXcgUGF0aCgnJywgY29uc3RydWN0b3JJc1ByaXZhdGUpO1xuICBpbnZhbGlkUGF0aC52YWxpZCA9IGZhbHNlO1xuICBpbnZhbGlkUGF0aC5nZXRWYWx1ZUZyb20gPSBpbnZhbGlkUGF0aC5zZXRWYWx1ZUZyb20gPSBmdW5jdGlvbigpIHt9O1xuXG4gIHZhciBNQVhfRElSVFlfQ0hFQ0tfQ1lDTEVTID0gMTAwMDtcblxuICBmdW5jdGlvbiBkaXJ0eUNoZWNrKG9ic2VydmVyKSB7XG4gICAgdmFyIGN5Y2xlcyA9IDA7XG4gICAgd2hpbGUgKGN5Y2xlcyA8IE1BWF9ESVJUWV9DSEVDS19DWUNMRVMgJiYgb2JzZXJ2ZXIuY2hlY2tfKCkpIHtcbiAgICAgIGN5Y2xlcysrO1xuICAgIH1cbiAgICBpZiAodGVzdGluZ0V4cG9zZUN5Y2xlQ291bnQpXG4gICAgICBnbG9iYWwuZGlydHlDaGVja0N5Y2xlQ291bnQgPSBjeWNsZXM7XG5cbiAgICByZXR1cm4gY3ljbGVzID4gMDtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9iamVjdElzRW1wdHkob2JqZWN0KSB7XG4gICAgZm9yICh2YXIgcHJvcCBpbiBvYmplY3QpXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBmdW5jdGlvbiBkaWZmSXNFbXB0eShkaWZmKSB7XG4gICAgcmV0dXJuIG9iamVjdElzRW1wdHkoZGlmZi5hZGRlZCkgJiZcbiAgICAgICAgICAgb2JqZWN0SXNFbXB0eShkaWZmLnJlbW92ZWQpICYmXG4gICAgICAgICAgIG9iamVjdElzRW1wdHkoZGlmZi5jaGFuZ2VkKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRpZmZPYmplY3RGcm9tT2xkT2JqZWN0KG9iamVjdCwgb2xkT2JqZWN0KSB7XG4gICAgdmFyIGFkZGVkID0ge307XG4gICAgdmFyIHJlbW92ZWQgPSB7fTtcbiAgICB2YXIgY2hhbmdlZCA9IHt9O1xuXG4gICAgZm9yICh2YXIgcHJvcCBpbiBvbGRPYmplY3QpIHtcbiAgICAgIHZhciBuZXdWYWx1ZSA9IG9iamVjdFtwcm9wXTtcblxuICAgICAgaWYgKG5ld1ZhbHVlICE9PSB1bmRlZmluZWQgJiYgbmV3VmFsdWUgPT09IG9sZE9iamVjdFtwcm9wXSlcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIGlmICghKHByb3AgaW4gb2JqZWN0KSkge1xuICAgICAgICByZW1vdmVkW3Byb3BdID0gdW5kZWZpbmVkO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKG5ld1ZhbHVlICE9PSBvbGRPYmplY3RbcHJvcF0pXG4gICAgICAgIGNoYW5nZWRbcHJvcF0gPSBuZXdWYWx1ZTtcbiAgICB9XG5cbiAgICBmb3IgKHZhciBwcm9wIGluIG9iamVjdCkge1xuICAgICAgaWYgKHByb3AgaW4gb2xkT2JqZWN0KVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgYWRkZWRbcHJvcF0gPSBvYmplY3RbcHJvcF07XG4gICAgfVxuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkob2JqZWN0KSAmJiBvYmplY3QubGVuZ3RoICE9PSBvbGRPYmplY3QubGVuZ3RoKVxuICAgICAgY2hhbmdlZC5sZW5ndGggPSBvYmplY3QubGVuZ3RoO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGFkZGVkOiBhZGRlZCxcbiAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgICBjaGFuZ2VkOiBjaGFuZ2VkXG4gICAgfTtcbiAgfVxuXG4gIHZhciBlb21UYXNrcyA9IFtdO1xuICBmdW5jdGlvbiBydW5FT01UYXNrcygpIHtcbiAgICBpZiAoIWVvbVRhc2tzLmxlbmd0aClcbiAgICAgIHJldHVybiBmYWxzZTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZW9tVGFza3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIGVvbVRhc2tzW2ldKCk7XG4gICAgfVxuICAgIGVvbVRhc2tzLmxlbmd0aCA9IDA7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICB2YXIgcnVuRU9NID0gaGFzT2JzZXJ2ZSA/IChmdW5jdGlvbigpe1xuICAgIHZhciBlb21PYmogPSB7IHBpbmdQb25nOiB0cnVlIH07XG4gICAgdmFyIGVvbVJ1blNjaGVkdWxlZCA9IGZhbHNlO1xuXG4gICAgT2JqZWN0Lm9ic2VydmUoZW9tT2JqLCBmdW5jdGlvbigpIHtcbiAgICAgIHJ1bkVPTVRhc2tzKCk7XG4gICAgICBlb21SdW5TY2hlZHVsZWQgPSBmYWxzZTtcbiAgICB9KTtcblxuICAgIHJldHVybiBmdW5jdGlvbihmbikge1xuICAgICAgZW9tVGFza3MucHVzaChmbik7XG4gICAgICBpZiAoIWVvbVJ1blNjaGVkdWxlZCkge1xuICAgICAgICBlb21SdW5TY2hlZHVsZWQgPSB0cnVlO1xuICAgICAgICBlb21PYmoucGluZ1BvbmcgPSAhZW9tT2JqLnBpbmdQb25nO1xuICAgICAgfVxuICAgIH07XG4gIH0pKCkgOlxuICAoZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKGZuKSB7XG4gICAgICBlb21UYXNrcy5wdXNoKGZuKTtcbiAgICB9O1xuICB9KSgpO1xuXG4gIHZhciBvYnNlcnZlZE9iamVjdENhY2hlID0gW107XG5cbiAgZnVuY3Rpb24gbmV3T2JzZXJ2ZWRPYmplY3QoKSB7XG4gICAgdmFyIG9ic2VydmVyO1xuICAgIHZhciBvYmplY3Q7XG4gICAgdmFyIGRpc2NhcmRSZWNvcmRzID0gZmFsc2U7XG4gICAgdmFyIGZpcnN0ID0gdHJ1ZTtcblxuICAgIGZ1bmN0aW9uIGNhbGxiYWNrKHJlY29yZHMpIHtcbiAgICAgIGlmIChvYnNlcnZlciAmJiBvYnNlcnZlci5zdGF0ZV8gPT09IE9QRU5FRCAmJiAhZGlzY2FyZFJlY29yZHMpXG4gICAgICAgIG9ic2VydmVyLmNoZWNrXyhyZWNvcmRzKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgb3BlbjogZnVuY3Rpb24ob2JzKSB7XG4gICAgICAgIGlmIChvYnNlcnZlcilcbiAgICAgICAgICB0aHJvdyBFcnJvcignT2JzZXJ2ZWRPYmplY3QgaW4gdXNlJyk7XG5cbiAgICAgICAgaWYgKCFmaXJzdClcbiAgICAgICAgICBPYmplY3QuZGVsaXZlckNoYW5nZVJlY29yZHMoY2FsbGJhY2spO1xuXG4gICAgICAgIG9ic2VydmVyID0gb2JzO1xuICAgICAgICBmaXJzdCA9IGZhbHNlO1xuICAgICAgfSxcbiAgICAgIG9ic2VydmU6IGZ1bmN0aW9uKG9iaiwgYXJyYXlPYnNlcnZlKSB7XG4gICAgICAgIG9iamVjdCA9IG9iajtcbiAgICAgICAgaWYgKGFycmF5T2JzZXJ2ZSlcbiAgICAgICAgICBBcnJheS5vYnNlcnZlKG9iamVjdCwgY2FsbGJhY2spO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgT2JqZWN0Lm9ic2VydmUob2JqZWN0LCBjYWxsYmFjayk7XG4gICAgICB9LFxuICAgICAgZGVsaXZlcjogZnVuY3Rpb24oZGlzY2FyZCkge1xuICAgICAgICBkaXNjYXJkUmVjb3JkcyA9IGRpc2NhcmQ7XG4gICAgICAgIE9iamVjdC5kZWxpdmVyQ2hhbmdlUmVjb3JkcyhjYWxsYmFjayk7XG4gICAgICAgIGRpc2NhcmRSZWNvcmRzID0gZmFsc2U7XG4gICAgICB9LFxuICAgICAgY2xvc2U6IGZ1bmN0aW9uKCkge1xuICAgICAgICBvYnNlcnZlciA9IHVuZGVmaW5lZDtcbiAgICAgICAgT2JqZWN0LnVub2JzZXJ2ZShvYmplY3QsIGNhbGxiYWNrKTtcbiAgICAgICAgb2JzZXJ2ZWRPYmplY3RDYWNoZS5wdXNoKHRoaXMpO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICAvKlxuICAgKiBUaGUgb2JzZXJ2ZWRTZXQgYWJzdHJhY3Rpb24gaXMgYSBwZXJmIG9wdGltaXphdGlvbiB3aGljaCByZWR1Y2VzIHRoZSB0b3RhbFxuICAgKiBudW1iZXIgb2YgT2JqZWN0Lm9ic2VydmUgb2JzZXJ2YXRpb25zIG9mIGEgc2V0IG9mIG9iamVjdHMuIFRoZSBpZGVhIGlzIHRoYXRcbiAgICogZ3JvdXBzIG9mIE9ic2VydmVycyB3aWxsIGhhdmUgc29tZSBvYmplY3QgZGVwZW5kZW5jaWVzIGluIGNvbW1vbiBhbmQgdGhpc1xuICAgKiBvYnNlcnZlZCBzZXQgZW5zdXJlcyB0aGF0IGVhY2ggb2JqZWN0IGluIHRoZSB0cmFuc2l0aXZlIGNsb3N1cmUgb2ZcbiAgICogZGVwZW5kZW5jaWVzIGlzIG9ubHkgb2JzZXJ2ZWQgb25jZS4gVGhlIG9ic2VydmVkU2V0IGFjdHMgYXMgYSB3cml0ZSBiYXJyaWVyXG4gICAqIHN1Y2ggdGhhdCB3aGVuZXZlciBhbnkgY2hhbmdlIGNvbWVzIHRocm91Z2gsIGFsbCBPYnNlcnZlcnMgYXJlIGNoZWNrZWQgZm9yXG4gICAqIGNoYW5nZWQgdmFsdWVzLlxuICAgKlxuICAgKiBOb3RlIHRoYXQgdGhpcyBvcHRpbWl6YXRpb24gaXMgZXhwbGljaXRseSBtb3Zpbmcgd29yayBmcm9tIHNldHVwLXRpbWUgdG9cbiAgICogY2hhbmdlLXRpbWUuXG4gICAqXG4gICAqIFRPRE8ocmFmYWVsdyk6IEltcGxlbWVudCBcImdhcmJhZ2UgY29sbGVjdGlvblwiLiBJbiBvcmRlciB0byBtb3ZlIHdvcmsgb2ZmXG4gICAqIHRoZSBjcml0aWNhbCBwYXRoLCB3aGVuIE9ic2VydmVycyBhcmUgY2xvc2VkLCB0aGVpciBvYnNlcnZlZCBvYmplY3RzIGFyZVxuICAgKiBub3QgT2JqZWN0LnVub2JzZXJ2ZShkKS4gQXMgYSByZXN1bHQsIGl0J3NpZXN0YSBwb3NzaWJsZSB0aGF0IGlmIHRoZSBvYnNlcnZlZFNldFxuICAgKiBpcyBrZXB0IG9wZW4sIGJ1dCBzb21lIE9ic2VydmVycyBoYXZlIGJlZW4gY2xvc2VkLCBpdCBjb3VsZCBjYXVzZSBcImxlYWtzXCJcbiAgICogKHByZXZlbnQgb3RoZXJ3aXNlIGNvbGxlY3RhYmxlIG9iamVjdHMgZnJvbSBiZWluZyBjb2xsZWN0ZWQpLiBBdCBzb21lXG4gICAqIHBvaW50LCB3ZSBzaG91bGQgaW1wbGVtZW50IGluY3JlbWVudGFsIFwiZ2NcIiB3aGljaCBrZWVwcyBhIGxpc3Qgb2ZcbiAgICogb2JzZXJ2ZWRTZXRzIHdoaWNoIG1heSBuZWVkIGNsZWFuLXVwIGFuZCBkb2VzIHNtYWxsIGFtb3VudHMgb2YgY2xlYW51cCBvbiBhXG4gICAqIHRpbWVvdXQgdW50aWwgYWxsIGlzIGNsZWFuLlxuICAgKi9cblxuICBmdW5jdGlvbiBnZXRPYnNlcnZlZE9iamVjdChvYnNlcnZlciwgb2JqZWN0LCBhcnJheU9ic2VydmUpIHtcbiAgICB2YXIgZGlyID0gb2JzZXJ2ZWRPYmplY3RDYWNoZS5wb3AoKSB8fCBuZXdPYnNlcnZlZE9iamVjdCgpO1xuICAgIGRpci5vcGVuKG9ic2VydmVyKTtcbiAgICBkaXIub2JzZXJ2ZShvYmplY3QsIGFycmF5T2JzZXJ2ZSk7XG4gICAgcmV0dXJuIGRpcjtcbiAgfVxuXG4gIHZhciBvYnNlcnZlZFNldENhY2hlID0gW107XG5cbiAgZnVuY3Rpb24gbmV3T2JzZXJ2ZWRTZXQoKSB7XG4gICAgdmFyIG9ic2VydmVyQ291bnQgPSAwO1xuICAgIHZhciBvYnNlcnZlcnMgPSBbXTtcbiAgICB2YXIgb2JqZWN0cyA9IFtdO1xuICAgIHZhciByb290T2JqO1xuICAgIHZhciByb290T2JqUHJvcHM7XG5cbiAgICBmdW5jdGlvbiBvYnNlcnZlKG9iaiwgcHJvcCkge1xuICAgICAgaWYgKCFvYmopXG4gICAgICAgIHJldHVybjtcblxuICAgICAgaWYgKG9iaiA9PT0gcm9vdE9iailcbiAgICAgICAgcm9vdE9ialByb3BzW3Byb3BdID0gdHJ1ZTtcblxuICAgICAgaWYgKG9iamVjdHMuaW5kZXhPZihvYmopIDwgMCkge1xuICAgICAgICBvYmplY3RzLnB1c2gob2JqKTtcbiAgICAgICAgT2JqZWN0Lm9ic2VydmUob2JqLCBjYWxsYmFjayk7XG4gICAgICB9XG5cbiAgICAgIG9ic2VydmUoT2JqZWN0LmdldFByb3RvdHlwZU9mKG9iaiksIHByb3ApO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFsbFJvb3RPYmpOb25PYnNlcnZlZFByb3BzKHJlY3MpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVjcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgcmVjID0gcmVjc1tpXTtcbiAgICAgICAgaWYgKHJlYy5vYmplY3QgIT09IHJvb3RPYmogfHxcbiAgICAgICAgICAgIHJvb3RPYmpQcm9wc1tyZWMubmFtZV0gfHxcbiAgICAgICAgICAgIHJlYy50eXBlID09PSAnc2V0UHJvdG90eXBlJykge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY2FsbGJhY2socmVjcykge1xuICAgICAgaWYgKGFsbFJvb3RPYmpOb25PYnNlcnZlZFByb3BzKHJlY3MpKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIHZhciBvYnNlcnZlcjtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb2JzZXJ2ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIG9ic2VydmVyID0gb2JzZXJ2ZXJzW2ldO1xuICAgICAgICBpZiAob2JzZXJ2ZXIuc3RhdGVfID09IE9QRU5FRCkge1xuICAgICAgICAgIG9ic2VydmVyLml0ZXJhdGVPYmplY3RzXyhvYnNlcnZlKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9ic2VydmVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICBvYnNlcnZlciA9IG9ic2VydmVyc1tpXTtcbiAgICAgICAgaWYgKG9ic2VydmVyLnN0YXRlXyA9PSBPUEVORUQpIHtcbiAgICAgICAgICBvYnNlcnZlci5jaGVja18oKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHZhciByZWNvcmQgPSB7XG4gICAgICBvYmplY3Q6IHVuZGVmaW5lZCxcbiAgICAgIG9iamVjdHM6IG9iamVjdHMsXG4gICAgICBvcGVuOiBmdW5jdGlvbihvYnMsIG9iamVjdCkge1xuICAgICAgICBpZiAoIXJvb3RPYmopIHtcbiAgICAgICAgICByb290T2JqID0gb2JqZWN0O1xuICAgICAgICAgIHJvb3RPYmpQcm9wcyA9IHt9O1xuICAgICAgICB9XG5cbiAgICAgICAgb2JzZXJ2ZXJzLnB1c2gob2JzKTtcbiAgICAgICAgb2JzZXJ2ZXJDb3VudCsrO1xuICAgICAgICBvYnMuaXRlcmF0ZU9iamVjdHNfKG9ic2VydmUpO1xuICAgICAgfSxcbiAgICAgIGNsb3NlOiBmdW5jdGlvbihvYnMpIHtcbiAgICAgICAgb2JzZXJ2ZXJDb3VudC0tO1xuICAgICAgICBpZiAob2JzZXJ2ZXJDb3VudCA+IDApIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9iamVjdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBPYmplY3QudW5vYnNlcnZlKG9iamVjdHNbaV0sIGNhbGxiYWNrKTtcbiAgICAgICAgICBPYnNlcnZlci51bm9ic2VydmVkQ291bnQrKztcbiAgICAgICAgfVxuXG4gICAgICAgIG9ic2VydmVycy5sZW5ndGggPSAwO1xuICAgICAgICBvYmplY3RzLmxlbmd0aCA9IDA7XG4gICAgICAgIHJvb3RPYmogPSB1bmRlZmluZWQ7XG4gICAgICAgIHJvb3RPYmpQcm9wcyA9IHVuZGVmaW5lZDtcbiAgICAgICAgb2JzZXJ2ZWRTZXRDYWNoZS5wdXNoKHRoaXMpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICByZXR1cm4gcmVjb3JkO1xuICB9XG5cbiAgdmFyIGxhc3RPYnNlcnZlZFNldDtcblxuICBmdW5jdGlvbiBnZXRPYnNlcnZlZFNldChvYnNlcnZlciwgb2JqKSB7XG4gICAgaWYgKCFsYXN0T2JzZXJ2ZWRTZXQgfHwgbGFzdE9ic2VydmVkU2V0Lm9iamVjdCAhPT0gb2JqKSB7XG4gICAgICBsYXN0T2JzZXJ2ZWRTZXQgPSBvYnNlcnZlZFNldENhY2hlLnBvcCgpIHx8IG5ld09ic2VydmVkU2V0KCk7XG4gICAgICBsYXN0T2JzZXJ2ZWRTZXQub2JqZWN0ID0gb2JqO1xuICAgIH1cbiAgICBsYXN0T2JzZXJ2ZWRTZXQub3BlbihvYnNlcnZlciwgb2JqKTtcbiAgICByZXR1cm4gbGFzdE9ic2VydmVkU2V0O1xuICB9XG5cbiAgdmFyIFVOT1BFTkVEID0gMDtcbiAgdmFyIE9QRU5FRCA9IDE7XG4gIHZhciBDTE9TRUQgPSAyO1xuICB2YXIgUkVTRVRUSU5HID0gMztcblxuICB2YXIgbmV4dE9ic2VydmVySWQgPSAxO1xuXG4gIGZ1bmN0aW9uIE9ic2VydmVyKCkge1xuICAgIHRoaXMuc3RhdGVfID0gVU5PUEVORUQ7XG4gICAgdGhpcy5jYWxsYmFja18gPSB1bmRlZmluZWQ7XG4gICAgdGhpcy50YXJnZXRfID0gdW5kZWZpbmVkOyAvLyBUT0RPKHJhZmFlbHcpOiBTaG91bGQgYmUgV2Vha1JlZlxuICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfID0gdW5kZWZpbmVkO1xuICAgIHRoaXMudmFsdWVfID0gdW5kZWZpbmVkO1xuICAgIHRoaXMuaWRfID0gbmV4dE9ic2VydmVySWQrKztcbiAgfVxuXG4gIE9ic2VydmVyLnByb3RvdHlwZSA9IHtcbiAgICBvcGVuOiBmdW5jdGlvbihjYWxsYmFjaywgdGFyZ2V0KSB7XG4gICAgICBpZiAodGhpcy5zdGF0ZV8gIT0gVU5PUEVORUQpXG4gICAgICAgIHRocm93IEVycm9yKCdPYnNlcnZlciBoYXMgYWxyZWFkeSBiZWVuIG9wZW5lZC4nKTtcblxuICAgICAgYWRkVG9BbGwodGhpcyk7XG4gICAgICB0aGlzLmNhbGxiYWNrXyA9IGNhbGxiYWNrO1xuICAgICAgdGhpcy50YXJnZXRfID0gdGFyZ2V0O1xuICAgICAgdGhpcy5jb25uZWN0XygpO1xuICAgICAgdGhpcy5zdGF0ZV8gPSBPUEVORUQ7XG4gICAgICByZXR1cm4gdGhpcy52YWx1ZV87XG4gICAgfSxcblxuICAgIGNsb3NlOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLnN0YXRlXyAhPSBPUEVORUQpXG4gICAgICAgIHJldHVybjtcblxuICAgICAgcmVtb3ZlRnJvbUFsbCh0aGlzKTtcbiAgICAgIHRoaXMuZGlzY29ubmVjdF8oKTtcbiAgICAgIHRoaXMudmFsdWVfID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy5jYWxsYmFja18gPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLnRhcmdldF8gPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLnN0YXRlXyA9IENMT1NFRDtcbiAgICB9LFxuXG4gICAgZGVsaXZlcjogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5zdGF0ZV8gIT0gT1BFTkVEKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIGRpcnR5Q2hlY2sodGhpcyk7XG4gICAgfSxcblxuICAgIHJlcG9ydF86IGZ1bmN0aW9uKGNoYW5nZXMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHRoaXMuY2FsbGJhY2tfLmFwcGx5KHRoaXMudGFyZ2V0XywgY2hhbmdlcyk7XG4gICAgICB9IGNhdGNoIChleCkge1xuICAgICAgICBPYnNlcnZlci5fZXJyb3JUaHJvd25EdXJpbmdDYWxsYmFjayA9IHRydWU7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0V4Y2VwdGlvbiBjYXVnaHQgZHVyaW5nIG9ic2VydmVyIGNhbGxiYWNrOiAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgKGV4LnN0YWNrIHx8IGV4KSk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIGRpc2NhcmRDaGFuZ2VzOiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuY2hlY2tfKHVuZGVmaW5lZCwgdHJ1ZSk7XG4gICAgICByZXR1cm4gdGhpcy52YWx1ZV87XG4gICAgfVxuICB9XG5cbiAgdmFyIGNvbGxlY3RPYnNlcnZlcnMgPSAhaGFzT2JzZXJ2ZTtcbiAgdmFyIGFsbE9ic2VydmVycztcbiAgT2JzZXJ2ZXIuX2FsbE9ic2VydmVyc0NvdW50ID0gMDtcblxuICBpZiAoY29sbGVjdE9ic2VydmVycykge1xuICAgIGFsbE9ic2VydmVycyA9IFtdO1xuICB9XG5cbiAgZnVuY3Rpb24gYWRkVG9BbGwob2JzZXJ2ZXIpIHtcbiAgICBPYnNlcnZlci5fYWxsT2JzZXJ2ZXJzQ291bnQrKztcbiAgICBpZiAoIWNvbGxlY3RPYnNlcnZlcnMpXG4gICAgICByZXR1cm47XG5cbiAgICBhbGxPYnNlcnZlcnMucHVzaChvYnNlcnZlcik7XG4gIH1cblxuICBmdW5jdGlvbiByZW1vdmVGcm9tQWxsKG9ic2VydmVyKSB7XG4gICAgT2JzZXJ2ZXIuX2FsbE9ic2VydmVyc0NvdW50LS07XG4gIH1cblxuICB2YXIgcnVubmluZ01pY3JvdGFza0NoZWNrcG9pbnQgPSBmYWxzZTtcblxuICB2YXIgaGFzRGVidWdGb3JjZUZ1bGxEZWxpdmVyeSA9IGhhc09ic2VydmUgJiYgaGFzRXZhbCAmJiAoZnVuY3Rpb24oKSB7XG4gICAgdHJ5IHtcbiAgICAgIGV2YWwoJyVSdW5NaWNyb3Rhc2tzKCknKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9KSgpO1xuXG4gIGdsb2JhbC5QbGF0Zm9ybSA9IGdsb2JhbC5QbGF0Zm9ybSB8fCB7fTtcblxuICBnbG9iYWwuUGxhdGZvcm0ucGVyZm9ybU1pY3JvdGFza0NoZWNrcG9pbnQgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAocnVubmluZ01pY3JvdGFza0NoZWNrcG9pbnQpXG4gICAgICByZXR1cm47XG5cbiAgICBpZiAoaGFzRGVidWdGb3JjZUZ1bGxEZWxpdmVyeSkge1xuICAgICAgZXZhbCgnJVJ1bk1pY3JvdGFza3MoKScpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICghY29sbGVjdE9ic2VydmVycylcbiAgICAgIHJldHVybjtcblxuICAgIHJ1bm5pbmdNaWNyb3Rhc2tDaGVja3BvaW50ID0gdHJ1ZTtcblxuICAgIHZhciBjeWNsZXMgPSAwO1xuICAgIHZhciBhbnlDaGFuZ2VkLCB0b0NoZWNrO1xuXG4gICAgZG8ge1xuICAgICAgY3ljbGVzKys7XG4gICAgICB0b0NoZWNrID0gYWxsT2JzZXJ2ZXJzO1xuICAgICAgYWxsT2JzZXJ2ZXJzID0gW107XG4gICAgICBhbnlDaGFuZ2VkID0gZmFsc2U7XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdG9DaGVjay5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgb2JzZXJ2ZXIgPSB0b0NoZWNrW2ldO1xuICAgICAgICBpZiAob2JzZXJ2ZXIuc3RhdGVfICE9IE9QRU5FRClcbiAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICBpZiAob2JzZXJ2ZXIuY2hlY2tfKCkpXG4gICAgICAgICAgYW55Q2hhbmdlZCA9IHRydWU7XG5cbiAgICAgICAgYWxsT2JzZXJ2ZXJzLnB1c2gob2JzZXJ2ZXIpO1xuICAgICAgfVxuICAgICAgaWYgKHJ1bkVPTVRhc2tzKCkpXG4gICAgICAgIGFueUNoYW5nZWQgPSB0cnVlO1xuICAgIH0gd2hpbGUgKGN5Y2xlcyA8IE1BWF9ESVJUWV9DSEVDS19DWUNMRVMgJiYgYW55Q2hhbmdlZCk7XG5cbiAgICBpZiAodGVzdGluZ0V4cG9zZUN5Y2xlQ291bnQpXG4gICAgICBnbG9iYWwuZGlydHlDaGVja0N5Y2xlQ291bnQgPSBjeWNsZXM7XG5cbiAgICBydW5uaW5nTWljcm90YXNrQ2hlY2twb2ludCA9IGZhbHNlO1xuICB9O1xuXG4gIGlmIChjb2xsZWN0T2JzZXJ2ZXJzKSB7XG4gICAgZ2xvYmFsLlBsYXRmb3JtLmNsZWFyT2JzZXJ2ZXJzID0gZnVuY3Rpb24oKSB7XG4gICAgICBhbGxPYnNlcnZlcnMgPSBbXTtcbiAgICB9O1xuICB9XG5cbiAgZnVuY3Rpb24gT2JqZWN0T2JzZXJ2ZXIob2JqZWN0KSB7XG4gICAgT2JzZXJ2ZXIuY2FsbCh0aGlzKTtcbiAgICB0aGlzLnZhbHVlXyA9IG9iamVjdDtcbiAgICB0aGlzLm9sZE9iamVjdF8gPSB1bmRlZmluZWQ7XG4gIH1cblxuICBPYmplY3RPYnNlcnZlci5wcm90b3R5cGUgPSBjcmVhdGVPYmplY3Qoe1xuICAgIF9fcHJvdG9fXzogT2JzZXJ2ZXIucHJvdG90eXBlLFxuXG4gICAgYXJyYXlPYnNlcnZlOiBmYWxzZSxcblxuICAgIGNvbm5lY3RfOiBmdW5jdGlvbihjYWxsYmFjaywgdGFyZ2V0KSB7XG4gICAgICBpZiAoaGFzT2JzZXJ2ZSkge1xuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXyA9IGdldE9ic2VydmVkT2JqZWN0KHRoaXMsIHRoaXMudmFsdWVfLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYXJyYXlPYnNlcnZlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMub2xkT2JqZWN0XyA9IHRoaXMuY29weU9iamVjdCh0aGlzLnZhbHVlXyk7XG4gICAgICB9XG5cbiAgICB9LFxuXG4gICAgY29weU9iamVjdDogZnVuY3Rpb24ob2JqZWN0KSB7XG4gICAgICB2YXIgY29weSA9IEFycmF5LmlzQXJyYXkob2JqZWN0KSA/IFtdIDoge307XG4gICAgICBmb3IgKHZhciBwcm9wIGluIG9iamVjdCkge1xuICAgICAgICBjb3B5W3Byb3BdID0gb2JqZWN0W3Byb3BdO1xuICAgICAgfTtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KG9iamVjdCkpXG4gICAgICAgIGNvcHkubGVuZ3RoID0gb2JqZWN0Lmxlbmd0aDtcbiAgICAgIHJldHVybiBjb3B5O1xuICAgIH0sXG5cbiAgICBjaGVja186IGZ1bmN0aW9uKGNoYW5nZVJlY29yZHMsIHNraXBDaGFuZ2VzKSB7XG4gICAgICB2YXIgZGlmZjtcbiAgICAgIHZhciBvbGRWYWx1ZXM7XG4gICAgICBpZiAoaGFzT2JzZXJ2ZSkge1xuICAgICAgICBpZiAoIWNoYW5nZVJlY29yZHMpXG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIG9sZFZhbHVlcyA9IHt9O1xuICAgICAgICBkaWZmID0gZGlmZk9iamVjdEZyb21DaGFuZ2VSZWNvcmRzKHRoaXMudmFsdWVfLCBjaGFuZ2VSZWNvcmRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZFZhbHVlcyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvbGRWYWx1ZXMgPSB0aGlzLm9sZE9iamVjdF87XG4gICAgICAgIGRpZmYgPSBkaWZmT2JqZWN0RnJvbU9sZE9iamVjdCh0aGlzLnZhbHVlXywgdGhpcy5vbGRPYmplY3RfKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGRpZmZJc0VtcHR5KGRpZmYpKVxuICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgIGlmICghaGFzT2JzZXJ2ZSlcbiAgICAgICAgdGhpcy5vbGRPYmplY3RfID0gdGhpcy5jb3B5T2JqZWN0KHRoaXMudmFsdWVfKTtcblxuICAgICAgdGhpcy5yZXBvcnRfKFtcbiAgICAgICAgZGlmZi5hZGRlZCB8fCB7fSxcbiAgICAgICAgZGlmZi5yZW1vdmVkIHx8IHt9LFxuICAgICAgICBkaWZmLmNoYW5nZWQgfHwge30sXG4gICAgICAgIGZ1bmN0aW9uKHByb3BlcnR5KSB7XG4gICAgICAgICAgcmV0dXJuIG9sZFZhbHVlc1twcm9wZXJ0eV07XG4gICAgICAgIH1cbiAgICAgIF0pO1xuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9LFxuXG4gICAgZGlzY29ubmVjdF86IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKGhhc09ic2VydmUpIHtcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8uY2xvc2UoKTtcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8gPSB1bmRlZmluZWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm9sZE9iamVjdF8gPSB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgfSxcblxuICAgIGRlbGl2ZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuc3RhdGVfICE9IE9QRU5FRClcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICBpZiAoaGFzT2JzZXJ2ZSlcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8uZGVsaXZlcihmYWxzZSk7XG4gICAgICBlbHNlXG4gICAgICAgIGRpcnR5Q2hlY2sodGhpcyk7XG4gICAgfSxcblxuICAgIGRpc2NhcmRDaGFuZ2VzOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLmRpcmVjdE9ic2VydmVyXylcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8uZGVsaXZlcih0cnVlKTtcbiAgICAgIGVsc2VcbiAgICAgICAgdGhpcy5vbGRPYmplY3RfID0gdGhpcy5jb3B5T2JqZWN0KHRoaXMudmFsdWVfKTtcblxuICAgICAgcmV0dXJuIHRoaXMudmFsdWVfO1xuICAgIH1cbiAgfSk7XG5cbiAgZnVuY3Rpb24gQXJyYXlPYnNlcnZlcihhcnJheSkge1xuICAgIGlmICghQXJyYXkuaXNBcnJheShhcnJheSkpXG4gICAgICB0aHJvdyBFcnJvcignUHJvdmlkZWQgb2JqZWN0IGlzIG5vdCBhbiBBcnJheScpO1xuICAgIE9iamVjdE9ic2VydmVyLmNhbGwodGhpcywgYXJyYXkpO1xuICB9XG5cbiAgQXJyYXlPYnNlcnZlci5wcm90b3R5cGUgPSBjcmVhdGVPYmplY3Qoe1xuXG4gICAgX19wcm90b19fOiBPYmplY3RPYnNlcnZlci5wcm90b3R5cGUsXG5cbiAgICBhcnJheU9ic2VydmU6IHRydWUsXG5cbiAgICBjb3B5T2JqZWN0OiBmdW5jdGlvbihhcnIpIHtcbiAgICAgIHJldHVybiBhcnIuc2xpY2UoKTtcbiAgICB9LFxuXG4gICAgY2hlY2tfOiBmdW5jdGlvbihjaGFuZ2VSZWNvcmRzKSB7XG4gICAgICB2YXIgc3BsaWNlcztcbiAgICAgIGlmIChoYXNPYnNlcnZlKSB7XG4gICAgICAgIGlmICghY2hhbmdlUmVjb3JkcylcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIHNwbGljZXMgPSBwcm9qZWN0QXJyYXlTcGxpY2VzKHRoaXMudmFsdWVfLCBjaGFuZ2VSZWNvcmRzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNwbGljZXMgPSBjYWxjU3BsaWNlcyh0aGlzLnZhbHVlXywgMCwgdGhpcy52YWx1ZV8ubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5vbGRPYmplY3RfLCAwLCB0aGlzLm9sZE9iamVjdF8ubGVuZ3RoKTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFzcGxpY2VzIHx8ICFzcGxpY2VzLmxlbmd0aClcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICBpZiAoIWhhc09ic2VydmUpXG4gICAgICAgIHRoaXMub2xkT2JqZWN0XyA9IHRoaXMuY29weU9iamVjdCh0aGlzLnZhbHVlXyk7XG5cbiAgICAgIHRoaXMucmVwb3J0Xyhbc3BsaWNlc10pO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9KTtcblxuICBBcnJheU9ic2VydmVyLmFwcGx5U3BsaWNlcyA9IGZ1bmN0aW9uKHByZXZpb3VzLCBjdXJyZW50LCBzcGxpY2VzKSB7XG4gICAgc3BsaWNlcy5mb3JFYWNoKGZ1bmN0aW9uKHNwbGljZSkge1xuICAgICAgdmFyIHNwbGljZUFyZ3MgPSBbc3BsaWNlLmluZGV4LCBzcGxpY2UucmVtb3ZlZC5sZW5ndGhdO1xuICAgICAgdmFyIGFkZEluZGV4ID0gc3BsaWNlLmluZGV4O1xuICAgICAgd2hpbGUgKGFkZEluZGV4IDwgc3BsaWNlLmluZGV4ICsgc3BsaWNlLmFkZGVkQ291bnQpIHtcbiAgICAgICAgc3BsaWNlQXJncy5wdXNoKGN1cnJlbnRbYWRkSW5kZXhdKTtcbiAgICAgICAgYWRkSW5kZXgrKztcbiAgICAgIH1cblxuICAgICAgQXJyYXkucHJvdG90eXBlLnNwbGljZS5hcHBseShwcmV2aW91cywgc3BsaWNlQXJncyk7XG4gICAgfSk7XG4gIH07XG5cbiAgZnVuY3Rpb24gUGF0aE9ic2VydmVyKG9iamVjdCwgcGF0aCkge1xuICAgIE9ic2VydmVyLmNhbGwodGhpcyk7XG5cbiAgICB0aGlzLm9iamVjdF8gPSBvYmplY3Q7XG4gICAgdGhpcy5wYXRoXyA9IGdldFBhdGgocGF0aCk7XG4gICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8gPSB1bmRlZmluZWQ7XG4gIH1cblxuICBQYXRoT2JzZXJ2ZXIucHJvdG90eXBlID0gY3JlYXRlT2JqZWN0KHtcbiAgICBfX3Byb3RvX186IE9ic2VydmVyLnByb3RvdHlwZSxcblxuICAgIGdldCBwYXRoKCkge1xuICAgICAgcmV0dXJuIHRoaXMucGF0aF87XG4gICAgfSxcblxuICAgIGNvbm5lY3RfOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmIChoYXNPYnNlcnZlKVxuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXyA9IGdldE9ic2VydmVkU2V0KHRoaXMsIHRoaXMub2JqZWN0Xyk7XG5cbiAgICAgIHRoaXMuY2hlY2tfKHVuZGVmaW5lZCwgdHJ1ZSk7XG4gICAgfSxcblxuICAgIGRpc2Nvbm5lY3RfOiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMudmFsdWVfID0gdW5kZWZpbmVkO1xuXG4gICAgICBpZiAodGhpcy5kaXJlY3RPYnNlcnZlcl8pIHtcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8uY2xvc2UodGhpcyk7XG4gICAgICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfID0gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICBpdGVyYXRlT2JqZWN0c186IGZ1bmN0aW9uKG9ic2VydmUpIHtcbiAgICAgIHRoaXMucGF0aF8uaXRlcmF0ZU9iamVjdHModGhpcy5vYmplY3RfLCBvYnNlcnZlKTtcbiAgICB9LFxuXG4gICAgY2hlY2tfOiBmdW5jdGlvbihjaGFuZ2VSZWNvcmRzLCBza2lwQ2hhbmdlcykge1xuICAgICAgdmFyIG9sZFZhbHVlID0gdGhpcy52YWx1ZV87XG4gICAgICB0aGlzLnZhbHVlXyA9IHRoaXMucGF0aF8uZ2V0VmFsdWVGcm9tKHRoaXMub2JqZWN0Xyk7XG4gICAgICBpZiAoc2tpcENoYW5nZXMgfHwgYXJlU2FtZVZhbHVlKHRoaXMudmFsdWVfLCBvbGRWYWx1ZSkpXG4gICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgdGhpcy5yZXBvcnRfKFt0aGlzLnZhbHVlXywgb2xkVmFsdWUsIHRoaXNdKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0sXG5cbiAgICBzZXRWYWx1ZTogZnVuY3Rpb24obmV3VmFsdWUpIHtcbiAgICAgIGlmICh0aGlzLnBhdGhfKVxuICAgICAgICB0aGlzLnBhdGhfLnNldFZhbHVlRnJvbSh0aGlzLm9iamVjdF8sIG5ld1ZhbHVlKTtcbiAgICB9XG4gIH0pO1xuXG4gIGZ1bmN0aW9uIENvbXBvdW5kT2JzZXJ2ZXIocmVwb3J0Q2hhbmdlc09uT3Blbikge1xuICAgIE9ic2VydmVyLmNhbGwodGhpcyk7XG5cbiAgICB0aGlzLnJlcG9ydENoYW5nZXNPbk9wZW5fID0gcmVwb3J0Q2hhbmdlc09uT3BlbjtcbiAgICB0aGlzLnZhbHVlXyA9IFtdO1xuICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfID0gdW5kZWZpbmVkO1xuICAgIHRoaXMub2JzZXJ2ZWRfID0gW107XG4gIH1cblxuICB2YXIgb2JzZXJ2ZXJTZW50aW5lbCA9IHt9O1xuXG4gIENvbXBvdW5kT2JzZXJ2ZXIucHJvdG90eXBlID0gY3JlYXRlT2JqZWN0KHtcbiAgICBfX3Byb3RvX186IE9ic2VydmVyLnByb3RvdHlwZSxcblxuICAgIGNvbm5lY3RfOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmIChoYXNPYnNlcnZlKSB7XG4gICAgICAgIHZhciBvYmplY3Q7XG4gICAgICAgIHZhciBuZWVkc0RpcmVjdE9ic2VydmVyID0gZmFsc2U7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5vYnNlcnZlZF8ubGVuZ3RoOyBpICs9IDIpIHtcbiAgICAgICAgICBvYmplY3QgPSB0aGlzLm9ic2VydmVkX1tpXVxuICAgICAgICAgIGlmIChvYmplY3QgIT09IG9ic2VydmVyU2VudGluZWwpIHtcbiAgICAgICAgICAgIG5lZWRzRGlyZWN0T2JzZXJ2ZXIgPSB0cnVlO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5lZWRzRGlyZWN0T2JzZXJ2ZXIpXG4gICAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8gPSBnZXRPYnNlcnZlZFNldCh0aGlzLCBvYmplY3QpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmNoZWNrXyh1bmRlZmluZWQsICF0aGlzLnJlcG9ydENoYW5nZXNPbk9wZW5fKTtcbiAgICB9LFxuXG4gICAgZGlzY29ubmVjdF86IGZ1bmN0aW9uKCkge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLm9ic2VydmVkXy5sZW5ndGg7IGkgKz0gMikge1xuICAgICAgICBpZiAodGhpcy5vYnNlcnZlZF9baV0gPT09IG9ic2VydmVyU2VudGluZWwpXG4gICAgICAgICAgdGhpcy5vYnNlcnZlZF9baSArIDFdLmNsb3NlKCk7XG4gICAgICB9XG4gICAgICB0aGlzLm9ic2VydmVkXy5sZW5ndGggPSAwO1xuICAgICAgdGhpcy52YWx1ZV8ubGVuZ3RoID0gMDtcblxuICAgICAgaWYgKHRoaXMuZGlyZWN0T2JzZXJ2ZXJfKSB7XG4gICAgICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfLmNsb3NlKHRoaXMpO1xuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXyA9IHVuZGVmaW5lZDtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgYWRkUGF0aDogZnVuY3Rpb24ob2JqZWN0LCBwYXRoKSB7XG4gICAgICBpZiAodGhpcy5zdGF0ZV8gIT0gVU5PUEVORUQgJiYgdGhpcy5zdGF0ZV8gIT0gUkVTRVRUSU5HKVxuICAgICAgICB0aHJvdyBFcnJvcignQ2Fubm90IGFkZCBwYXRocyBvbmNlIHN0YXJ0ZWQuJyk7XG5cbiAgICAgIHZhciBwYXRoID0gZ2V0UGF0aChwYXRoKTtcbiAgICAgIHRoaXMub2JzZXJ2ZWRfLnB1c2gob2JqZWN0LCBwYXRoKTtcbiAgICAgIGlmICghdGhpcy5yZXBvcnRDaGFuZ2VzT25PcGVuXylcbiAgICAgICAgcmV0dXJuO1xuICAgICAgdmFyIGluZGV4ID0gdGhpcy5vYnNlcnZlZF8ubGVuZ3RoIC8gMiAtIDE7XG4gICAgICB0aGlzLnZhbHVlX1tpbmRleF0gPSBwYXRoLmdldFZhbHVlRnJvbShvYmplY3QpO1xuICAgIH0sXG5cbiAgICBhZGRPYnNlcnZlcjogZnVuY3Rpb24ob2JzZXJ2ZXIpIHtcbiAgICAgIGlmICh0aGlzLnN0YXRlXyAhPSBVTk9QRU5FRCAmJiB0aGlzLnN0YXRlXyAhPSBSRVNFVFRJTkcpXG4gICAgICAgIHRocm93IEVycm9yKCdDYW5ub3QgYWRkIG9ic2VydmVycyBvbmNlIHN0YXJ0ZWQuJyk7XG5cbiAgICAgIHRoaXMub2JzZXJ2ZWRfLnB1c2gob2JzZXJ2ZXJTZW50aW5lbCwgb2JzZXJ2ZXIpO1xuICAgICAgaWYgKCF0aGlzLnJlcG9ydENoYW5nZXNPbk9wZW5fKVxuICAgICAgICByZXR1cm47XG4gICAgICB2YXIgaW5kZXggPSB0aGlzLm9ic2VydmVkXy5sZW5ndGggLyAyIC0gMTtcbiAgICAgIHRoaXMudmFsdWVfW2luZGV4XSA9IG9ic2VydmVyLm9wZW4odGhpcy5kZWxpdmVyLCB0aGlzKTtcbiAgICB9LFxuXG4gICAgc3RhcnRSZXNldDogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5zdGF0ZV8gIT0gT1BFTkVEKVxuICAgICAgICB0aHJvdyBFcnJvcignQ2FuIG9ubHkgcmVzZXQgd2hpbGUgb3BlbicpO1xuXG4gICAgICB0aGlzLnN0YXRlXyA9IFJFU0VUVElORztcbiAgICAgIHRoaXMuZGlzY29ubmVjdF8oKTtcbiAgICB9LFxuXG4gICAgZmluaXNoUmVzZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuc3RhdGVfICE9IFJFU0VUVElORylcbiAgICAgICAgdGhyb3cgRXJyb3IoJ0NhbiBvbmx5IGZpbmlzaFJlc2V0IGFmdGVyIHN0YXJ0UmVzZXQnKTtcbiAgICAgIHRoaXMuc3RhdGVfID0gT1BFTkVEO1xuICAgICAgdGhpcy5jb25uZWN0XygpO1xuXG4gICAgICByZXR1cm4gdGhpcy52YWx1ZV87XG4gICAgfSxcblxuICAgIGl0ZXJhdGVPYmplY3RzXzogZnVuY3Rpb24ob2JzZXJ2ZSkge1xuICAgICAgdmFyIG9iamVjdDtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5vYnNlcnZlZF8ubGVuZ3RoOyBpICs9IDIpIHtcbiAgICAgICAgb2JqZWN0ID0gdGhpcy5vYnNlcnZlZF9baV1cbiAgICAgICAgaWYgKG9iamVjdCAhPT0gb2JzZXJ2ZXJTZW50aW5lbClcbiAgICAgICAgICB0aGlzLm9ic2VydmVkX1tpICsgMV0uaXRlcmF0ZU9iamVjdHMob2JqZWN0LCBvYnNlcnZlKVxuICAgICAgfVxuICAgIH0sXG5cbiAgICBjaGVja186IGZ1bmN0aW9uKGNoYW5nZVJlY29yZHMsIHNraXBDaGFuZ2VzKSB7XG4gICAgICB2YXIgb2xkVmFsdWVzO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLm9ic2VydmVkXy5sZW5ndGg7IGkgKz0gMikge1xuICAgICAgICB2YXIgb2JqZWN0ID0gdGhpcy5vYnNlcnZlZF9baV07XG4gICAgICAgIHZhciBwYXRoID0gdGhpcy5vYnNlcnZlZF9baSsxXTtcbiAgICAgICAgdmFyIHZhbHVlO1xuICAgICAgICBpZiAob2JqZWN0ID09PSBvYnNlcnZlclNlbnRpbmVsKSB7XG4gICAgICAgICAgdmFyIG9ic2VydmFibGUgPSBwYXRoO1xuICAgICAgICAgIHZhbHVlID0gdGhpcy5zdGF0ZV8gPT09IFVOT1BFTkVEID9cbiAgICAgICAgICAgICAgb2JzZXJ2YWJsZS5vcGVuKHRoaXMuZGVsaXZlciwgdGhpcykgOlxuICAgICAgICAgICAgICBvYnNlcnZhYmxlLmRpc2NhcmRDaGFuZ2VzKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFsdWUgPSBwYXRoLmdldFZhbHVlRnJvbShvYmplY3QpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHNraXBDaGFuZ2VzKSB7XG4gICAgICAgICAgdGhpcy52YWx1ZV9baSAvIDJdID0gdmFsdWU7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYXJlU2FtZVZhbHVlKHZhbHVlLCB0aGlzLnZhbHVlX1tpIC8gMl0pKVxuICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgIG9sZFZhbHVlcyA9IG9sZFZhbHVlcyB8fCBbXTtcbiAgICAgICAgb2xkVmFsdWVzW2kgLyAyXSA9IHRoaXMudmFsdWVfW2kgLyAyXTtcbiAgICAgICAgdGhpcy52YWx1ZV9baSAvIDJdID0gdmFsdWU7XG4gICAgICB9XG5cbiAgICAgIGlmICghb2xkVmFsdWVzKVxuICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgIC8vIFRPRE8ocmFmYWVsdyk6IEhhdmluZyBvYnNlcnZlZF8gYXMgdGhlIHRoaXJkIGNhbGxiYWNrIGFyZyBoZXJlIGlzXG4gICAgICAvLyBwcmV0dHkgbGFtZSBBUEkuIEZpeC5cbiAgICAgIHRoaXMucmVwb3J0XyhbdGhpcy52YWx1ZV8sIG9sZFZhbHVlcywgdGhpcy5vYnNlcnZlZF9dKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfSk7XG5cbiAgZnVuY3Rpb24gaWRlbnRGbih2YWx1ZSkgeyByZXR1cm4gdmFsdWU7IH1cblxuICBmdW5jdGlvbiBPYnNlcnZlclRyYW5zZm9ybShvYnNlcnZhYmxlLCBnZXRWYWx1ZUZuLCBzZXRWYWx1ZUZuLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkb250UGFzc1Rocm91Z2hTZXQpIHtcbiAgICB0aGlzLmNhbGxiYWNrXyA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLnRhcmdldF8gPSB1bmRlZmluZWQ7XG4gICAgdGhpcy52YWx1ZV8gPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5vYnNlcnZhYmxlXyA9IG9ic2VydmFibGU7XG4gICAgdGhpcy5nZXRWYWx1ZUZuXyA9IGdldFZhbHVlRm4gfHwgaWRlbnRGbjtcbiAgICB0aGlzLnNldFZhbHVlRm5fID0gc2V0VmFsdWVGbiB8fCBpZGVudEZuO1xuICAgIC8vIFRPRE8ocmFmYWVsdyk6IFRoaXMgaXMgYSB0ZW1wb3JhcnkgaGFjay4gUG9seW1lckV4cHJlc3Npb25zIG5lZWRzIHRoaXNcbiAgICAvLyBhdCB0aGUgbW9tZW50IGJlY2F1c2Ugb2YgYSBidWcgaW4gaXQnc2llc3RhIGRlcGVuZGVuY3kgdHJhY2tpbmcuXG4gICAgdGhpcy5kb250UGFzc1Rocm91Z2hTZXRfID0gZG9udFBhc3NUaHJvdWdoU2V0O1xuICB9XG5cbiAgT2JzZXJ2ZXJUcmFuc2Zvcm0ucHJvdG90eXBlID0ge1xuICAgIG9wZW46IGZ1bmN0aW9uKGNhbGxiYWNrLCB0YXJnZXQpIHtcbiAgICAgIHRoaXMuY2FsbGJhY2tfID0gY2FsbGJhY2s7XG4gICAgICB0aGlzLnRhcmdldF8gPSB0YXJnZXQ7XG4gICAgICB0aGlzLnZhbHVlXyA9XG4gICAgICAgICAgdGhpcy5nZXRWYWx1ZUZuXyh0aGlzLm9ic2VydmFibGVfLm9wZW4odGhpcy5vYnNlcnZlZENhbGxiYWNrXywgdGhpcykpO1xuICAgICAgcmV0dXJuIHRoaXMudmFsdWVfO1xuICAgIH0sXG5cbiAgICBvYnNlcnZlZENhbGxiYWNrXzogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIHZhbHVlID0gdGhpcy5nZXRWYWx1ZUZuXyh2YWx1ZSk7XG4gICAgICBpZiAoYXJlU2FtZVZhbHVlKHZhbHVlLCB0aGlzLnZhbHVlXykpXG4gICAgICAgIHJldHVybjtcbiAgICAgIHZhciBvbGRWYWx1ZSA9IHRoaXMudmFsdWVfO1xuICAgICAgdGhpcy52YWx1ZV8gPSB2YWx1ZTtcbiAgICAgIHRoaXMuY2FsbGJhY2tfLmNhbGwodGhpcy50YXJnZXRfLCB0aGlzLnZhbHVlXywgb2xkVmFsdWUpO1xuICAgIH0sXG5cbiAgICBkaXNjYXJkQ2hhbmdlczogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLnZhbHVlXyA9IHRoaXMuZ2V0VmFsdWVGbl8odGhpcy5vYnNlcnZhYmxlXy5kaXNjYXJkQ2hhbmdlcygpKTtcbiAgICAgIHJldHVybiB0aGlzLnZhbHVlXztcbiAgICB9LFxuXG4gICAgZGVsaXZlcjogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5vYnNlcnZhYmxlXy5kZWxpdmVyKCk7XG4gICAgfSxcblxuICAgIHNldFZhbHVlOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgdmFsdWUgPSB0aGlzLnNldFZhbHVlRm5fKHZhbHVlKTtcbiAgICAgIGlmICghdGhpcy5kb250UGFzc1Rocm91Z2hTZXRfICYmIHRoaXMub2JzZXJ2YWJsZV8uc2V0VmFsdWUpXG4gICAgICAgIHJldHVybiB0aGlzLm9ic2VydmFibGVfLnNldFZhbHVlKHZhbHVlKTtcbiAgICB9LFxuXG4gICAgY2xvc2U6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMub2JzZXJ2YWJsZV8pXG4gICAgICAgIHRoaXMub2JzZXJ2YWJsZV8uY2xvc2UoKTtcbiAgICAgIHRoaXMuY2FsbGJhY2tfID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy50YXJnZXRfID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy5vYnNlcnZhYmxlXyA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMudmFsdWVfID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy5nZXRWYWx1ZUZuXyA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMuc2V0VmFsdWVGbl8gPSB1bmRlZmluZWQ7XG4gICAgfVxuICB9XG5cbiAgdmFyIGV4cGVjdGVkUmVjb3JkVHlwZXMgPSB7XG4gICAgYWRkOiB0cnVlLFxuICAgIHVwZGF0ZTogdHJ1ZSxcbiAgICBkZWxldGU6IHRydWVcbiAgfTtcblxuICBmdW5jdGlvbiBkaWZmT2JqZWN0RnJvbUNoYW5nZVJlY29yZHMob2JqZWN0LCBjaGFuZ2VSZWNvcmRzLCBvbGRWYWx1ZXMpIHtcbiAgICB2YXIgYWRkZWQgPSB7fTtcbiAgICB2YXIgcmVtb3ZlZCA9IHt9O1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGFuZ2VSZWNvcmRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgcmVjb3JkID0gY2hhbmdlUmVjb3Jkc1tpXTtcbiAgICAgIGlmICghZXhwZWN0ZWRSZWNvcmRUeXBlc1tyZWNvcmQudHlwZV0pIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignVW5rbm93biBjaGFuZ2VSZWNvcmQgdHlwZTogJyArIHJlY29yZC50eXBlKTtcbiAgICAgICAgY29uc29sZS5lcnJvcihyZWNvcmQpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKCEocmVjb3JkLm5hbWUgaW4gb2xkVmFsdWVzKSlcbiAgICAgICAgb2xkVmFsdWVzW3JlY29yZC5uYW1lXSA9IHJlY29yZC5vbGRWYWx1ZTtcblxuICAgICAgaWYgKHJlY29yZC50eXBlID09ICd1cGRhdGUnKVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgaWYgKHJlY29yZC50eXBlID09ICdhZGQnKSB7XG4gICAgICAgIGlmIChyZWNvcmQubmFtZSBpbiByZW1vdmVkKVxuICAgICAgICAgIGRlbGV0ZSByZW1vdmVkW3JlY29yZC5uYW1lXTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGFkZGVkW3JlY29yZC5uYW1lXSA9IHRydWU7XG5cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIHR5cGUgPSAnZGVsZXRlJ1xuICAgICAgaWYgKHJlY29yZC5uYW1lIGluIGFkZGVkKSB7XG4gICAgICAgIGRlbGV0ZSBhZGRlZFtyZWNvcmQubmFtZV07XG4gICAgICAgIGRlbGV0ZSBvbGRWYWx1ZXNbcmVjb3JkLm5hbWVdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVtb3ZlZFtyZWNvcmQubmFtZV0gPSB0cnVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvciAodmFyIHByb3AgaW4gYWRkZWQpXG4gICAgICBhZGRlZFtwcm9wXSA9IG9iamVjdFtwcm9wXTtcblxuICAgIGZvciAodmFyIHByb3AgaW4gcmVtb3ZlZClcbiAgICAgIHJlbW92ZWRbcHJvcF0gPSB1bmRlZmluZWQ7XG5cbiAgICB2YXIgY2hhbmdlZCA9IHt9O1xuICAgIGZvciAodmFyIHByb3AgaW4gb2xkVmFsdWVzKSB7XG4gICAgICBpZiAocHJvcCBpbiBhZGRlZCB8fCBwcm9wIGluIHJlbW92ZWQpXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICB2YXIgbmV3VmFsdWUgPSBvYmplY3RbcHJvcF07XG4gICAgICBpZiAob2xkVmFsdWVzW3Byb3BdICE9PSBuZXdWYWx1ZSlcbiAgICAgICAgY2hhbmdlZFtwcm9wXSA9IG5ld1ZhbHVlO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBhZGRlZDogYWRkZWQsXG4gICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgICAgY2hhbmdlZDogY2hhbmdlZFxuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBuZXdTcGxpY2UoaW5kZXgsIHJlbW92ZWQsIGFkZGVkQ291bnQpIHtcbiAgICByZXR1cm4ge1xuICAgICAgaW5kZXg6IGluZGV4LFxuICAgICAgcmVtb3ZlZDogcmVtb3ZlZCxcbiAgICAgIGFkZGVkQ291bnQ6IGFkZGVkQ291bnRcbiAgICB9O1xuICB9XG5cbiAgdmFyIEVESVRfTEVBVkUgPSAwO1xuICB2YXIgRURJVF9VUERBVEUgPSAxO1xuICB2YXIgRURJVF9BREQgPSAyO1xuICB2YXIgRURJVF9ERUxFVEUgPSAzO1xuXG4gIGZ1bmN0aW9uIEFycmF5U3BsaWNlKCkge31cblxuICBBcnJheVNwbGljZS5wcm90b3R5cGUgPSB7XG5cbiAgICAvLyBOb3RlOiBUaGlzIGZ1bmN0aW9uIGlzICpiYXNlZCogb24gdGhlIGNvbXB1dGF0aW9uIG9mIHRoZSBMZXZlbnNodGVpblxuICAgIC8vIFwiZWRpdFwiIGRpc3RhbmNlLiBUaGUgb25lIGNoYW5nZSBpcyB0aGF0IFwidXBkYXRlc1wiIGFyZSB0cmVhdGVkIGFzIHR3b1xuICAgIC8vIGVkaXRzIC0gbm90IG9uZS4gV2l0aCBBcnJheSBzcGxpY2VzLCBhbiB1cGRhdGUgaXMgcmVhbGx5IGEgZGVsZXRlXG4gICAgLy8gZm9sbG93ZWQgYnkgYW4gYWRkLiBCeSByZXRhaW5pbmcgdGhpcywgd2Ugb3B0aW1pemUgZm9yIFwia2VlcGluZ1wiIHRoZVxuICAgIC8vIG1heGltdW0gYXJyYXkgaXRlbXMgaW4gdGhlIG9yaWdpbmFsIGFycmF5LiBGb3IgZXhhbXBsZTpcbiAgICAvL1xuICAgIC8vICAgJ3h4eHgxMjMnIC0+ICcxMjN5eXl5J1xuICAgIC8vXG4gICAgLy8gV2l0aCAxLWVkaXQgdXBkYXRlcywgdGhlIHNob3J0ZXN0IHBhdGggd291bGQgYmUganVzdCB0byB1cGRhdGUgYWxsIHNldmVuXG4gICAgLy8gY2hhcmFjdGVycy4gV2l0aCAyLWVkaXQgdXBkYXRlcywgd2UgZGVsZXRlIDQsIGxlYXZlIDMsIGFuZCBhZGQgNC4gVGhpc1xuICAgIC8vIGxlYXZlcyB0aGUgc3Vic3RyaW5nICcxMjMnIGludGFjdC5cbiAgICBjYWxjRWRpdERpc3RhbmNlczogZnVuY3Rpb24oY3VycmVudCwgY3VycmVudFN0YXJ0LCBjdXJyZW50RW5kLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGQsIG9sZFN0YXJ0LCBvbGRFbmQpIHtcbiAgICAgIC8vIFwiRGVsZXRpb25cIiBjb2x1bW5zXG4gICAgICB2YXIgcm93Q291bnQgPSBvbGRFbmQgLSBvbGRTdGFydCArIDE7XG4gICAgICB2YXIgY29sdW1uQ291bnQgPSBjdXJyZW50RW5kIC0gY3VycmVudFN0YXJ0ICsgMTtcbiAgICAgIHZhciBkaXN0YW5jZXMgPSBuZXcgQXJyYXkocm93Q291bnQpO1xuXG4gICAgICAvLyBcIkFkZGl0aW9uXCIgcm93cy4gSW5pdGlhbGl6ZSBudWxsIGNvbHVtbi5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcm93Q291bnQ7IGkrKykge1xuICAgICAgICBkaXN0YW5jZXNbaV0gPSBuZXcgQXJyYXkoY29sdW1uQ291bnQpO1xuICAgICAgICBkaXN0YW5jZXNbaV1bMF0gPSBpO1xuICAgICAgfVxuXG4gICAgICAvLyBJbml0aWFsaXplIG51bGwgcm93XG4gICAgICBmb3IgKHZhciBqID0gMDsgaiA8IGNvbHVtbkNvdW50OyBqKyspXG4gICAgICAgIGRpc3RhbmNlc1swXVtqXSA9IGo7XG5cbiAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgcm93Q291bnQ7IGkrKykge1xuICAgICAgICBmb3IgKHZhciBqID0gMTsgaiA8IGNvbHVtbkNvdW50OyBqKyspIHtcbiAgICAgICAgICBpZiAodGhpcy5lcXVhbHMoY3VycmVudFtjdXJyZW50U3RhcnQgKyBqIC0gMV0sIG9sZFtvbGRTdGFydCArIGkgLSAxXSkpXG4gICAgICAgICAgICBkaXN0YW5jZXNbaV1bal0gPSBkaXN0YW5jZXNbaSAtIDFdW2ogLSAxXTtcbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHZhciBub3J0aCA9IGRpc3RhbmNlc1tpIC0gMV1bal0gKyAxO1xuICAgICAgICAgICAgdmFyIHdlc3QgPSBkaXN0YW5jZXNbaV1baiAtIDFdICsgMTtcbiAgICAgICAgICAgIGRpc3RhbmNlc1tpXVtqXSA9IG5vcnRoIDwgd2VzdCA/IG5vcnRoIDogd2VzdDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGRpc3RhbmNlcztcbiAgICB9LFxuXG4gICAgLy8gVGhpcyBzdGFydHMgYXQgdGhlIGZpbmFsIHdlaWdodCwgYW5kIHdhbGtzIFwiYmFja3dhcmRcIiBieSBmaW5kaW5nXG4gICAgLy8gdGhlIG1pbmltdW0gcHJldmlvdXMgd2VpZ2h0IHJlY3Vyc2l2ZWx5IHVudGlsIHRoZSBvcmlnaW4gb2YgdGhlIHdlaWdodFxuICAgIC8vIG1hdHJpeC5cbiAgICBzcGxpY2VPcGVyYXRpb25zRnJvbUVkaXREaXN0YW5jZXM6IGZ1bmN0aW9uKGRpc3RhbmNlcykge1xuICAgICAgdmFyIGkgPSBkaXN0YW5jZXMubGVuZ3RoIC0gMTtcbiAgICAgIHZhciBqID0gZGlzdGFuY2VzWzBdLmxlbmd0aCAtIDE7XG4gICAgICB2YXIgY3VycmVudCA9IGRpc3RhbmNlc1tpXVtqXTtcbiAgICAgIHZhciBlZGl0cyA9IFtdO1xuICAgICAgd2hpbGUgKGkgPiAwIHx8IGogPiAwKSB7XG4gICAgICAgIGlmIChpID09IDApIHtcbiAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfQUREKTtcbiAgICAgICAgICBqLS07XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGogPT0gMCkge1xuICAgICAgICAgIGVkaXRzLnB1c2goRURJVF9ERUxFVEUpO1xuICAgICAgICAgIGktLTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgbm9ydGhXZXN0ID0gZGlzdGFuY2VzW2kgLSAxXVtqIC0gMV07XG4gICAgICAgIHZhciB3ZXN0ID0gZGlzdGFuY2VzW2kgLSAxXVtqXTtcbiAgICAgICAgdmFyIG5vcnRoID0gZGlzdGFuY2VzW2ldW2ogLSAxXTtcblxuICAgICAgICB2YXIgbWluO1xuICAgICAgICBpZiAod2VzdCA8IG5vcnRoKVxuICAgICAgICAgIG1pbiA9IHdlc3QgPCBub3J0aFdlc3QgPyB3ZXN0IDogbm9ydGhXZXN0O1xuICAgICAgICBlbHNlXG4gICAgICAgICAgbWluID0gbm9ydGggPCBub3J0aFdlc3QgPyBub3J0aCA6IG5vcnRoV2VzdDtcblxuICAgICAgICBpZiAobWluID09IG5vcnRoV2VzdCkge1xuICAgICAgICAgIGlmIChub3J0aFdlc3QgPT0gY3VycmVudCkge1xuICAgICAgICAgICAgZWRpdHMucHVzaChFRElUX0xFQVZFKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZWRpdHMucHVzaChFRElUX1VQREFURSk7XG4gICAgICAgICAgICBjdXJyZW50ID0gbm9ydGhXZXN0O1xuICAgICAgICAgIH1cbiAgICAgICAgICBpLS07XG4gICAgICAgICAgai0tO1xuICAgICAgICB9IGVsc2UgaWYgKG1pbiA9PSB3ZXN0KSB7XG4gICAgICAgICAgZWRpdHMucHVzaChFRElUX0RFTEVURSk7XG4gICAgICAgICAgaS0tO1xuICAgICAgICAgIGN1cnJlbnQgPSB3ZXN0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGVkaXRzLnB1c2goRURJVF9BREQpO1xuICAgICAgICAgIGotLTtcbiAgICAgICAgICBjdXJyZW50ID0gbm9ydGg7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZWRpdHMucmV2ZXJzZSgpO1xuICAgICAgcmV0dXJuIGVkaXRzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTcGxpY2UgUHJvamVjdGlvbiBmdW5jdGlvbnM6XG4gICAgICpcbiAgICAgKiBBIHNwbGljZSBtYXAgaXMgYSByZXByZXNlbnRhdGlvbiBvZiBob3cgYSBwcmV2aW91cyBhcnJheSBvZiBpdGVtc1xuICAgICAqIHdhcyB0cmFuc2Zvcm1lZCBpbnRvIGEgbmV3IGFycmF5IG9mIGl0ZW1zLiBDb25jZXB0dWFsbHkgaXQgaXMgYSBsaXN0IG9mXG4gICAgICogdHVwbGVzIG9mXG4gICAgICpcbiAgICAgKiAgIDxpbmRleCwgcmVtb3ZlZCwgYWRkZWRDb3VudD5cbiAgICAgKlxuICAgICAqIHdoaWNoIGFyZSBrZXB0IGluIGFzY2VuZGluZyBpbmRleCBvcmRlciBvZi4gVGhlIHR1cGxlIHJlcHJlc2VudHMgdGhhdCBhdFxuICAgICAqIHRoZSB8aW5kZXh8LCB8cmVtb3ZlZHwgc2VxdWVuY2Ugb2YgaXRlbXMgd2VyZSByZW1vdmVkLCBhbmQgY291bnRpbmcgZm9yd2FyZFxuICAgICAqIGZyb20gfGluZGV4fCwgfGFkZGVkQ291bnR8IGl0ZW1zIHdlcmUgYWRkZWQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBMYWNraW5nIGluZGl2aWR1YWwgc3BsaWNlIG11dGF0aW9uIGluZm9ybWF0aW9uLCB0aGUgbWluaW1hbCBzZXQgb2ZcbiAgICAgKiBzcGxpY2VzIGNhbiBiZSBzeW50aGVzaXplZCBnaXZlbiB0aGUgcHJldmlvdXMgc3RhdGUgYW5kIGZpbmFsIHN0YXRlIG9mIGFuXG4gICAgICogYXJyYXkuIFRoZSBiYXNpYyBhcHByb2FjaCBpcyB0byBjYWxjdWxhdGUgdGhlIGVkaXQgZGlzdGFuY2UgbWF0cml4IGFuZFxuICAgICAqIGNob29zZSB0aGUgc2hvcnRlc3QgcGF0aCB0aHJvdWdoIGl0LlxuICAgICAqXG4gICAgICogQ29tcGxleGl0eTogTyhsICogcClcbiAgICAgKiAgIGw6IFRoZSBsZW5ndGggb2YgdGhlIGN1cnJlbnQgYXJyYXlcbiAgICAgKiAgIHA6IFRoZSBsZW5ndGggb2YgdGhlIG9sZCBhcnJheVxuICAgICAqL1xuICAgIGNhbGNTcGxpY2VzOiBmdW5jdGlvbihjdXJyZW50LCBjdXJyZW50U3RhcnQsIGN1cnJlbnRFbmQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIG9sZCwgb2xkU3RhcnQsIG9sZEVuZCkge1xuICAgICAgdmFyIHByZWZpeENvdW50ID0gMDtcbiAgICAgIHZhciBzdWZmaXhDb3VudCA9IDA7XG5cbiAgICAgIHZhciBtaW5MZW5ndGggPSBNYXRoLm1pbihjdXJyZW50RW5kIC0gY3VycmVudFN0YXJ0LCBvbGRFbmQgLSBvbGRTdGFydCk7XG4gICAgICBpZiAoY3VycmVudFN0YXJ0ID09IDAgJiYgb2xkU3RhcnQgPT0gMClcbiAgICAgICAgcHJlZml4Q291bnQgPSB0aGlzLnNoYXJlZFByZWZpeChjdXJyZW50LCBvbGQsIG1pbkxlbmd0aCk7XG5cbiAgICAgIGlmIChjdXJyZW50RW5kID09IGN1cnJlbnQubGVuZ3RoICYmIG9sZEVuZCA9PSBvbGQubGVuZ3RoKVxuICAgICAgICBzdWZmaXhDb3VudCA9IHRoaXMuc2hhcmVkU3VmZml4KGN1cnJlbnQsIG9sZCwgbWluTGVuZ3RoIC0gcHJlZml4Q291bnQpO1xuXG4gICAgICBjdXJyZW50U3RhcnQgKz0gcHJlZml4Q291bnQ7XG4gICAgICBvbGRTdGFydCArPSBwcmVmaXhDb3VudDtcbiAgICAgIGN1cnJlbnRFbmQgLT0gc3VmZml4Q291bnQ7XG4gICAgICBvbGRFbmQgLT0gc3VmZml4Q291bnQ7XG5cbiAgICAgIGlmIChjdXJyZW50RW5kIC0gY3VycmVudFN0YXJ0ID09IDAgJiYgb2xkRW5kIC0gb2xkU3RhcnQgPT0gMClcbiAgICAgICAgcmV0dXJuIFtdO1xuXG4gICAgICBpZiAoY3VycmVudFN0YXJ0ID09IGN1cnJlbnRFbmQpIHtcbiAgICAgICAgdmFyIHNwbGljZSA9IG5ld1NwbGljZShjdXJyZW50U3RhcnQsIFtdLCAwKTtcbiAgICAgICAgd2hpbGUgKG9sZFN0YXJ0IDwgb2xkRW5kKVxuICAgICAgICAgIHNwbGljZS5yZW1vdmVkLnB1c2gob2xkW29sZFN0YXJ0KytdKTtcblxuICAgICAgICByZXR1cm4gWyBzcGxpY2UgXTtcbiAgICAgIH0gZWxzZSBpZiAob2xkU3RhcnQgPT0gb2xkRW5kKVxuICAgICAgICByZXR1cm4gWyBuZXdTcGxpY2UoY3VycmVudFN0YXJ0LCBbXSwgY3VycmVudEVuZCAtIGN1cnJlbnRTdGFydCkgXTtcblxuICAgICAgdmFyIG9wcyA9IHRoaXMuc3BsaWNlT3BlcmF0aW9uc0Zyb21FZGl0RGlzdGFuY2VzKFxuICAgICAgICAgIHRoaXMuY2FsY0VkaXREaXN0YW5jZXMoY3VycmVudCwgY3VycmVudFN0YXJ0LCBjdXJyZW50RW5kLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkLCBvbGRTdGFydCwgb2xkRW5kKSk7XG5cbiAgICAgIHZhciBzcGxpY2UgPSB1bmRlZmluZWQ7XG4gICAgICB2YXIgc3BsaWNlcyA9IFtdO1xuICAgICAgdmFyIGluZGV4ID0gY3VycmVudFN0YXJ0O1xuICAgICAgdmFyIG9sZEluZGV4ID0gb2xkU3RhcnQ7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9wcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBzd2l0Y2gob3BzW2ldKSB7XG4gICAgICAgICAgY2FzZSBFRElUX0xFQVZFOlxuICAgICAgICAgICAgaWYgKHNwbGljZSkge1xuICAgICAgICAgICAgICBzcGxpY2VzLnB1c2goc3BsaWNlKTtcbiAgICAgICAgICAgICAgc3BsaWNlID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpbmRleCsrO1xuICAgICAgICAgICAgb2xkSW5kZXgrKztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgRURJVF9VUERBVEU6XG4gICAgICAgICAgICBpZiAoIXNwbGljZSlcbiAgICAgICAgICAgICAgc3BsaWNlID0gbmV3U3BsaWNlKGluZGV4LCBbXSwgMCk7XG5cbiAgICAgICAgICAgIHNwbGljZS5hZGRlZENvdW50Kys7XG4gICAgICAgICAgICBpbmRleCsrO1xuXG4gICAgICAgICAgICBzcGxpY2UucmVtb3ZlZC5wdXNoKG9sZFtvbGRJbmRleF0pO1xuICAgICAgICAgICAgb2xkSW5kZXgrKztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgRURJVF9BREQ6XG4gICAgICAgICAgICBpZiAoIXNwbGljZSlcbiAgICAgICAgICAgICAgc3BsaWNlID0gbmV3U3BsaWNlKGluZGV4LCBbXSwgMCk7XG5cbiAgICAgICAgICAgIHNwbGljZS5hZGRlZENvdW50Kys7XG4gICAgICAgICAgICBpbmRleCsrO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSBFRElUX0RFTEVURTpcbiAgICAgICAgICAgIGlmICghc3BsaWNlKVxuICAgICAgICAgICAgICBzcGxpY2UgPSBuZXdTcGxpY2UoaW5kZXgsIFtdLCAwKTtcblxuICAgICAgICAgICAgc3BsaWNlLnJlbW92ZWQucHVzaChvbGRbb2xkSW5kZXhdKTtcbiAgICAgICAgICAgIG9sZEluZGV4Kys7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoc3BsaWNlKSB7XG4gICAgICAgIHNwbGljZXMucHVzaChzcGxpY2UpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHNwbGljZXM7XG4gICAgfSxcblxuICAgIHNoYXJlZFByZWZpeDogZnVuY3Rpb24oY3VycmVudCwgb2xkLCBzZWFyY2hMZW5ndGgpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2VhcmNoTGVuZ3RoOyBpKyspXG4gICAgICAgIGlmICghdGhpcy5lcXVhbHMoY3VycmVudFtpXSwgb2xkW2ldKSlcbiAgICAgICAgICByZXR1cm4gaTtcbiAgICAgIHJldHVybiBzZWFyY2hMZW5ndGg7XG4gICAgfSxcblxuICAgIHNoYXJlZFN1ZmZpeDogZnVuY3Rpb24oY3VycmVudCwgb2xkLCBzZWFyY2hMZW5ndGgpIHtcbiAgICAgIHZhciBpbmRleDEgPSBjdXJyZW50Lmxlbmd0aDtcbiAgICAgIHZhciBpbmRleDIgPSBvbGQubGVuZ3RoO1xuICAgICAgdmFyIGNvdW50ID0gMDtcbiAgICAgIHdoaWxlIChjb3VudCA8IHNlYXJjaExlbmd0aCAmJiB0aGlzLmVxdWFscyhjdXJyZW50Wy0taW5kZXgxXSwgb2xkWy0taW5kZXgyXSkpXG4gICAgICAgIGNvdW50Kys7XG5cbiAgICAgIHJldHVybiBjb3VudDtcbiAgICB9LFxuXG4gICAgY2FsY3VsYXRlU3BsaWNlczogZnVuY3Rpb24oY3VycmVudCwgcHJldmlvdXMpIHtcbiAgICAgIHJldHVybiB0aGlzLmNhbGNTcGxpY2VzKGN1cnJlbnQsIDAsIGN1cnJlbnQubGVuZ3RoLCBwcmV2aW91cywgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByZXZpb3VzLmxlbmd0aCk7XG4gICAgfSxcblxuICAgIGVxdWFsczogZnVuY3Rpb24oY3VycmVudFZhbHVlLCBwcmV2aW91c1ZhbHVlKSB7XG4gICAgICByZXR1cm4gY3VycmVudFZhbHVlID09PSBwcmV2aW91c1ZhbHVlO1xuICAgIH1cbiAgfTtcblxuICB2YXIgYXJyYXlTcGxpY2UgPSBuZXcgQXJyYXlTcGxpY2UoKTtcblxuICBmdW5jdGlvbiBjYWxjU3BsaWNlcyhjdXJyZW50LCBjdXJyZW50U3RhcnQsIGN1cnJlbnRFbmQsXG4gICAgICAgICAgICAgICAgICAgICAgIG9sZCwgb2xkU3RhcnQsIG9sZEVuZCkge1xuICAgIHJldHVybiBhcnJheVNwbGljZS5jYWxjU3BsaWNlcyhjdXJyZW50LCBjdXJyZW50U3RhcnQsIGN1cnJlbnRFbmQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZCwgb2xkU3RhcnQsIG9sZEVuZCk7XG4gIH1cblxuICBmdW5jdGlvbiBpbnRlcnNlY3Qoc3RhcnQxLCBlbmQxLCBzdGFydDIsIGVuZDIpIHtcbiAgICAvLyBEaXNqb2ludFxuICAgIGlmIChlbmQxIDwgc3RhcnQyIHx8IGVuZDIgPCBzdGFydDEpXG4gICAgICByZXR1cm4gLTE7XG5cbiAgICAvLyBBZGphY2VudFxuICAgIGlmIChlbmQxID09IHN0YXJ0MiB8fCBlbmQyID09IHN0YXJ0MSlcbiAgICAgIHJldHVybiAwO1xuXG4gICAgLy8gTm9uLXplcm8gaW50ZXJzZWN0LCBzcGFuMSBmaXJzdFxuICAgIGlmIChzdGFydDEgPCBzdGFydDIpIHtcbiAgICAgIGlmIChlbmQxIDwgZW5kMilcbiAgICAgICAgcmV0dXJuIGVuZDEgLSBzdGFydDI7IC8vIE92ZXJsYXBcbiAgICAgIGVsc2VcbiAgICAgICAgcmV0dXJuIGVuZDIgLSBzdGFydDI7IC8vIENvbnRhaW5lZFxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBOb24temVybyBpbnRlcnNlY3QsIHNwYW4yIGZpcnN0XG4gICAgICBpZiAoZW5kMiA8IGVuZDEpXG4gICAgICAgIHJldHVybiBlbmQyIC0gc3RhcnQxOyAvLyBPdmVybGFwXG4gICAgICBlbHNlXG4gICAgICAgIHJldHVybiBlbmQxIC0gc3RhcnQxOyAvLyBDb250YWluZWRcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBtZXJnZVNwbGljZShzcGxpY2VzLCBpbmRleCwgcmVtb3ZlZCwgYWRkZWRDb3VudCkge1xuXG4gICAgdmFyIHNwbGljZSA9IG5ld1NwbGljZShpbmRleCwgcmVtb3ZlZCwgYWRkZWRDb3VudCk7XG5cbiAgICB2YXIgaW5zZXJ0ZWQgPSBmYWxzZTtcbiAgICB2YXIgaW5zZXJ0aW9uT2Zmc2V0ID0gMDtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc3BsaWNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGN1cnJlbnQgPSBzcGxpY2VzW2ldO1xuICAgICAgY3VycmVudC5pbmRleCArPSBpbnNlcnRpb25PZmZzZXQ7XG5cbiAgICAgIGlmIChpbnNlcnRlZClcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIHZhciBpbnRlcnNlY3RDb3VudCA9IGludGVyc2VjdChzcGxpY2UuaW5kZXgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3BsaWNlLmluZGV4ICsgc3BsaWNlLnJlbW92ZWQubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnQuaW5kZXgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudC5pbmRleCArIGN1cnJlbnQuYWRkZWRDb3VudCk7XG5cbiAgICAgIGlmIChpbnRlcnNlY3RDb3VudCA+PSAwKSB7XG4gICAgICAgIC8vIE1lcmdlIHRoZSB0d28gc3BsaWNlc1xuXG4gICAgICAgIHNwbGljZXMuc3BsaWNlKGksIDEpO1xuICAgICAgICBpLS07XG5cbiAgICAgICAgaW5zZXJ0aW9uT2Zmc2V0IC09IGN1cnJlbnQuYWRkZWRDb3VudCAtIGN1cnJlbnQucmVtb3ZlZC5sZW5ndGg7XG5cbiAgICAgICAgc3BsaWNlLmFkZGVkQ291bnQgKz0gY3VycmVudC5hZGRlZENvdW50IC0gaW50ZXJzZWN0Q291bnQ7XG4gICAgICAgIHZhciBkZWxldGVDb3VudCA9IHNwbGljZS5yZW1vdmVkLmxlbmd0aCArXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnQucmVtb3ZlZC5sZW5ndGggLSBpbnRlcnNlY3RDb3VudDtcblxuICAgICAgICBpZiAoIXNwbGljZS5hZGRlZENvdW50ICYmICFkZWxldGVDb3VudCkge1xuICAgICAgICAgIC8vIG1lcmdlZCBzcGxpY2UgaXMgYSBub29wLiBkaXNjYXJkLlxuICAgICAgICAgIGluc2VydGVkID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YXIgcmVtb3ZlZCA9IGN1cnJlbnQucmVtb3ZlZDtcblxuICAgICAgICAgIGlmIChzcGxpY2UuaW5kZXggPCBjdXJyZW50LmluZGV4KSB7XG4gICAgICAgICAgICAvLyBzb21lIHByZWZpeCBvZiBzcGxpY2UucmVtb3ZlZCBpcyBwcmVwZW5kZWQgdG8gY3VycmVudC5yZW1vdmVkLlxuICAgICAgICAgICAgdmFyIHByZXBlbmQgPSBzcGxpY2UucmVtb3ZlZC5zbGljZSgwLCBjdXJyZW50LmluZGV4IC0gc3BsaWNlLmluZGV4KTtcbiAgICAgICAgICAgIEFycmF5LnByb3RvdHlwZS5wdXNoLmFwcGx5KHByZXBlbmQsIHJlbW92ZWQpO1xuICAgICAgICAgICAgcmVtb3ZlZCA9IHByZXBlbmQ7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHNwbGljZS5pbmRleCArIHNwbGljZS5yZW1vdmVkLmxlbmd0aCA+IGN1cnJlbnQuaW5kZXggKyBjdXJyZW50LmFkZGVkQ291bnQpIHtcbiAgICAgICAgICAgIC8vIHNvbWUgc3VmZml4IG9mIHNwbGljZS5yZW1vdmVkIGlzIGFwcGVuZGVkIHRvIGN1cnJlbnQucmVtb3ZlZC5cbiAgICAgICAgICAgIHZhciBhcHBlbmQgPSBzcGxpY2UucmVtb3ZlZC5zbGljZShjdXJyZW50LmluZGV4ICsgY3VycmVudC5hZGRlZENvdW50IC0gc3BsaWNlLmluZGV4KTtcbiAgICAgICAgICAgIEFycmF5LnByb3RvdHlwZS5wdXNoLmFwcGx5KHJlbW92ZWQsIGFwcGVuZCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgc3BsaWNlLnJlbW92ZWQgPSByZW1vdmVkO1xuICAgICAgICAgIGlmIChjdXJyZW50LmluZGV4IDwgc3BsaWNlLmluZGV4KSB7XG4gICAgICAgICAgICBzcGxpY2UuaW5kZXggPSBjdXJyZW50LmluZGV4O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChzcGxpY2UuaW5kZXggPCBjdXJyZW50LmluZGV4KSB7XG4gICAgICAgIC8vIEluc2VydCBzcGxpY2UgaGVyZS5cblxuICAgICAgICBpbnNlcnRlZCA9IHRydWU7XG5cbiAgICAgICAgc3BsaWNlcy5zcGxpY2UoaSwgMCwgc3BsaWNlKTtcbiAgICAgICAgaSsrO1xuXG4gICAgICAgIHZhciBvZmZzZXQgPSBzcGxpY2UuYWRkZWRDb3VudCAtIHNwbGljZS5yZW1vdmVkLmxlbmd0aFxuICAgICAgICBjdXJyZW50LmluZGV4ICs9IG9mZnNldDtcbiAgICAgICAgaW5zZXJ0aW9uT2Zmc2V0ICs9IG9mZnNldDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIWluc2VydGVkKVxuICAgICAgc3BsaWNlcy5wdXNoKHNwbGljZSk7XG4gIH1cblxuICBmdW5jdGlvbiBjcmVhdGVJbml0aWFsU3BsaWNlcyhhcnJheSwgY2hhbmdlUmVjb3Jkcykge1xuICAgIHZhciBzcGxpY2VzID0gW107XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoYW5nZVJlY29yZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciByZWNvcmQgPSBjaGFuZ2VSZWNvcmRzW2ldO1xuICAgICAgc3dpdGNoKHJlY29yZC50eXBlKSB7XG4gICAgICAgIGNhc2UgJ3NwbGljZSc6XG4gICAgICAgICAgbWVyZ2VTcGxpY2Uoc3BsaWNlcywgcmVjb3JkLmluZGV4LCByZWNvcmQucmVtb3ZlZC5zbGljZSgpLCByZWNvcmQuYWRkZWRDb3VudCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2FkZCc6XG4gICAgICAgIGNhc2UgJ3VwZGF0ZSc6XG4gICAgICAgIGNhc2UgJ2RlbGV0ZSc6XG4gICAgICAgICAgaWYgKCFpc0luZGV4KHJlY29yZC5uYW1lKSlcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIHZhciBpbmRleCA9IHRvTnVtYmVyKHJlY29yZC5uYW1lKTtcbiAgICAgICAgICBpZiAoaW5kZXggPCAwKVxuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgbWVyZ2VTcGxpY2Uoc3BsaWNlcywgaW5kZXgsIFtyZWNvcmQub2xkVmFsdWVdLCAxKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBjb25zb2xlLmVycm9yKCdVbmV4cGVjdGVkIHJlY29yZCB0eXBlOiAnICsgSlNPTi5zdHJpbmdpZnkocmVjb3JkKSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHNwbGljZXM7XG4gIH1cblxuICBmdW5jdGlvbiBwcm9qZWN0QXJyYXlTcGxpY2VzKGFycmF5LCBjaGFuZ2VSZWNvcmRzKSB7XG4gICAgdmFyIHNwbGljZXMgPSBbXTtcblxuICAgIGNyZWF0ZUluaXRpYWxTcGxpY2VzKGFycmF5LCBjaGFuZ2VSZWNvcmRzKS5mb3JFYWNoKGZ1bmN0aW9uKHNwbGljZSkge1xuICAgICAgaWYgKHNwbGljZS5hZGRlZENvdW50ID09IDEgJiYgc3BsaWNlLnJlbW92ZWQubGVuZ3RoID09IDEpIHtcbiAgICAgICAgaWYgKHNwbGljZS5yZW1vdmVkWzBdICE9PSBhcnJheVtzcGxpY2UuaW5kZXhdKVxuICAgICAgICAgIHNwbGljZXMucHVzaChzcGxpY2UpO1xuXG4gICAgICAgIHJldHVyblxuICAgICAgfTtcblxuICAgICAgc3BsaWNlcyA9IHNwbGljZXMuY29uY2F0KGNhbGNTcGxpY2VzKGFycmF5LCBzcGxpY2UuaW5kZXgsIHNwbGljZS5pbmRleCArIHNwbGljZS5hZGRlZENvdW50LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNwbGljZS5yZW1vdmVkLCAwLCBzcGxpY2UucmVtb3ZlZC5sZW5ndGgpKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBzcGxpY2VzO1xuICB9XG5cbiAvLyBFeHBvcnQgdGhlIG9ic2VydmUtanMgb2JqZWN0IGZvciAqKk5vZGUuanMqKiwgd2l0aFxuLy8gYmFja3dhcmRzLWNvbXBhdGliaWxpdHkgZm9yIHRoZSBvbGQgYHJlcXVpcmUoKWAgQVBJLiBJZiB3ZSdyZSBpblxuLy8gdGhlIGJyb3dzZXIsIGV4cG9ydCBhcyBhIGdsb2JhbCBvYmplY3QuXG52YXIgZXhwb3NlID0gZ2xvYmFsO1xuaWYgKHR5cGVvZiBleHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7XG5leHBvc2UgPSBleHBvcnRzID0gbW9kdWxlLmV4cG9ydHM7XG59XG5leHBvc2UgPSBleHBvcnRzO1xufVxuZXhwb3NlLk9ic2VydmVyID0gT2JzZXJ2ZXI7XG5leHBvc2UuT2JzZXJ2ZXIucnVuRU9NXyA9IHJ1bkVPTTtcbmV4cG9zZS5PYnNlcnZlci5vYnNlcnZlclNlbnRpbmVsXyA9IG9ic2VydmVyU2VudGluZWw7IC8vIGZvciB0ZXN0aW5nLlxuZXhwb3NlLk9ic2VydmVyLmhhc09iamVjdE9ic2VydmUgPSBoYXNPYnNlcnZlO1xuZXhwb3NlLkFycmF5T2JzZXJ2ZXIgPSBBcnJheU9ic2VydmVyO1xuZXhwb3NlLkFycmF5T2JzZXJ2ZXIuY2FsY3VsYXRlU3BsaWNlcyA9IGZ1bmN0aW9uKGN1cnJlbnQsIHByZXZpb3VzKSB7XG5yZXR1cm4gYXJyYXlTcGxpY2UuY2FsY3VsYXRlU3BsaWNlcyhjdXJyZW50LCBwcmV2aW91cyk7XG59O1xuZXhwb3NlLlBsYXRmb3JtID0gZ2xvYmFsLlBsYXRmb3JtO1xuZXhwb3NlLkFycmF5U3BsaWNlID0gQXJyYXlTcGxpY2U7XG5leHBvc2UuT2JqZWN0T2JzZXJ2ZXIgPSBPYmplY3RPYnNlcnZlcjtcbmV4cG9zZS5QYXRoT2JzZXJ2ZXIgPSBQYXRoT2JzZXJ2ZXI7XG5leHBvc2UuQ29tcG91bmRPYnNlcnZlciA9IENvbXBvdW5kT2JzZXJ2ZXI7XG5leHBvc2UuUGF0aCA9IFBhdGg7XG5leHBvc2UuT2JzZXJ2ZXJUcmFuc2Zvcm0gPSBPYnNlcnZlclRyYW5zZm9ybTtcbn0pKHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnICYmIGdsb2JhbCAmJiB0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUgPyBnbG9iYWwgOiB0aGlzIHx8IHdpbmRvdyk7XG5cblxuXG4vKiogV0VCUEFDSyBGT09URVIgKipcbiAqKiAuL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlLmpzXG4gKiovIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihtb2R1bGUpIHtcclxuXHRpZighbW9kdWxlLndlYnBhY2tQb2x5ZmlsbCkge1xyXG5cdFx0bW9kdWxlLmRlcHJlY2F0ZSA9IGZ1bmN0aW9uKCkge307XHJcblx0XHRtb2R1bGUucGF0aHMgPSBbXTtcclxuXHRcdC8vIG1vZHVsZS5wYXJlbnQgPSB1bmRlZmluZWQgYnkgZGVmYXVsdFxyXG5cdFx0bW9kdWxlLmNoaWxkcmVuID0gW107XHJcblx0XHRtb2R1bGUud2VicGFja1BvbHlmaWxsID0gMTtcclxuXHR9XHJcblx0cmV0dXJuIG1vZHVsZTtcclxufVxyXG5cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqICh3ZWJwYWNrKS9idWlsZGluL21vZHVsZS5qc1xuICoqIG1vZHVsZSBpZCA9IDZcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBhcmdzQXJyYXk7XG5cbmZ1bmN0aW9uIGFyZ3NBcnJheShmdW4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBpZiAobGVuKSB7XG4gICAgICB2YXIgYXJncyA9IFtdO1xuICAgICAgdmFyIGkgPSAtMTtcbiAgICAgIHdoaWxlICgrK2kgPCBsZW4pIHtcbiAgICAgICAgYXJnc1tpXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmdW4uY2FsbCh0aGlzLCBhcmdzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGZ1bi5jYWxsKHRoaXMsIFtdKTtcbiAgICB9XG4gIH07XG59XG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL34vYXJnc2FycmF5L2luZGV4LmpzXG4gKiogbW9kdWxlIGlkID0gN1xuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwiLyoqXG4gKiBVc2VycyBzaG91bGQgbmV2ZXIgc2VlIHRoZXNlIHRocm93bi4gQSBidWcgcmVwb3J0IHNob3VsZCBiZSBmaWxlZCBpZiBzbyBhcyBpdCBtZWFucyBzb21lIGFzc2VydGlvbiBoYXMgZmFpbGVkLlxuICogQHBhcmFtIG1lc3NhZ2VcbiAqIEBwYXJhbSBjb250ZXh0XG4gKiBAcGFyYW0gc3NmXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gSW50ZXJuYWxTaWVzdGFFcnJvcihtZXNzYWdlLCBjb250ZXh0LCBzc2YpIHtcbiAgdGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcbiAgdGhpcy5jb250ZXh0ID0gY29udGV4dDtcbiAgLy8gY2FwdHVyZSBzdGFjayB0cmFjZVxuICBpZiAoc3NmICYmIEVycm9yLmNhcHR1cmVTdGFja1RyYWNlKSB7XG4gICAgRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UodGhpcywgc3NmKTtcbiAgfVxufVxuXG5JbnRlcm5hbFNpZXN0YUVycm9yLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRXJyb3IucHJvdG90eXBlKTtcbkludGVybmFsU2llc3RhRXJyb3IucHJvdG90eXBlLm5hbWUgPSAnSW50ZXJuYWxTaWVzdGFFcnJvcic7XG5JbnRlcm5hbFNpZXN0YUVycm9yLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IEludGVybmFsU2llc3RhRXJyb3I7XG5cbmZ1bmN0aW9uIGlzU2llc3RhRXJyb3IoZXJyKSB7XG4gIGlmICh0eXBlb2YgZXJyID09ICdvYmplY3QnKSB7XG4gICAgcmV0dXJuICdlcnJvcicgaW4gZXJyICYmICdvaycgaW4gZXJyICYmICdyZWFzb24nIGluIGVycjtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZXJyTWVzc2FnZSwgZXh0cmEpIHtcbiAgaWYgKGlzU2llc3RhRXJyb3IoZXJyTWVzc2FnZSkpIHtcbiAgICByZXR1cm4gZXJyTWVzc2FnZTtcbiAgfVxuICB2YXIgZXJyID0ge1xuICAgIHJlYXNvbjogZXJyTWVzc2FnZSxcbiAgICBlcnJvcjogdHJ1ZSxcbiAgICBvazogZmFsc2VcbiAgfTtcbiAgZm9yICh2YXIgcHJvcCBpbiBleHRyYSB8fCB7fSkge1xuICAgIGlmIChleHRyYS5oYXNPd25Qcm9wZXJ0eShwcm9wKSkgZXJyW3Byb3BdID0gZXh0cmFbcHJvcF07XG4gIH1cbiAgZXJyLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHRoaXMpO1xuICB9O1xuICByZXR1cm4gZXJyO1xufTtcblxubW9kdWxlLmV4cG9ydHMuSW50ZXJuYWxTaWVzdGFFcnJvciA9IEludGVybmFsU2llc3RhRXJyb3I7XG5cblxuLyoqIFdFQlBBQ0sgRk9PVEVSICoqXG4gKiogLi9jb3JlL2Vycm9yLmpzXG4gKiovIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcblxuZnVuY3Rpb24gQ29sbGVjdGlvblJlZ2lzdHJ5KCkge1xuICBpZiAoIXRoaXMpIHJldHVybiBuZXcgQ29sbGVjdGlvblJlZ2lzdHJ5KCk7XG4gIHRoaXMuY29sbGVjdGlvbk5hbWVzID0gW107XG59XG5cbnV0aWwuZXh0ZW5kKENvbGxlY3Rpb25SZWdpc3RyeS5wcm90b3R5cGUsIHtcbiAgcmVnaXN0ZXI6IGZ1bmN0aW9uKGNvbGxlY3Rpb24pIHtcbiAgICB2YXIgbmFtZSA9IGNvbGxlY3Rpb24ubmFtZTtcbiAgICB0aGlzW25hbWVdID0gY29sbGVjdGlvbjtcbiAgICB0aGlzLmNvbGxlY3Rpb25OYW1lcy5wdXNoKG5hbWUpO1xuICB9LFxuICByZXNldDogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHRoaXMuY29sbGVjdGlvbk5hbWVzLmZvckVhY2goZnVuY3Rpb24obmFtZSkge1xuICAgICAgZGVsZXRlIHNlbGZbbmFtZV07XG4gICAgfSk7XG4gICAgdGhpcy5jb2xsZWN0aW9uTmFtZXMgPSBbXTtcbiAgfVxufSk7XG5cbmV4cG9ydHMuQ29sbGVjdGlvblJlZ2lzdHJ5ID0gbmV3IENvbGxlY3Rpb25SZWdpc3RyeSgpO1xuXG5cbi8qKiBXRUJQQUNLIEZPT1RFUiAqKlxuICoqIC4vY29yZS9jb2xsZWN0aW9uUmVnaXN0cnkuanNcbiAqKi8iLCJ2YXIgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSgnY29sbGVjdGlvbicpLFxuICBDb2xsZWN0aW9uUmVnaXN0cnkgPSByZXF1aXJlKCcuL2NvbGxlY3Rpb25SZWdpc3RyeScpLkNvbGxlY3Rpb25SZWdpc3RyeSxcbiAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICBNb2RlbCA9IHJlcXVpcmUoJy4vbW9kZWwnKSxcbiAgZXh0ZW5kID0gcmVxdWlyZSgnZXh0ZW5kJyksXG4gIG9ic2VydmUgPSByZXF1aXJlKCcuLi92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZScpLlBsYXRmb3JtLFxuICBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLFxuICBhcmdzYXJyYXkgPSByZXF1aXJlKCdhcmdzYXJyYXknKSxcbiAgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyk7XG5cblxuLyoqXG4gKiBBIGNvbGxlY3Rpb24gZGVzY3JpYmVzIGEgc2V0IG9mIG1vZGVscyBhbmQgb3B0aW9uYWxseSBhIFJFU1QgQVBJIHdoaWNoIHdlIHdvdWxkXG4gKiBsaWtlIHRvIG1vZGVsLlxuICpcbiAqIEBwYXJhbSBuYW1lXG4gKiBAcGFyYW0gb3B0c1xuICogQGNvbnN0cnVjdG9yXG4gKlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGBqc1xuICogdmFyIEdpdEh1YiA9IG5ldyBzaWVzdGEoJ0dpdEh1YicpXG4gKiAvLyAuLi4gY29uZmlndXJlIG1hcHBpbmdzLCBkZXNjcmlwdG9ycyBldGMgLi4uXG4gKiBHaXRIdWIuaW5zdGFsbChmdW5jdGlvbiAoKSB7XG4gICAgICogICAgIC8vIC4uLiBjYXJyeSBvbi5cbiAgICAgKiB9KTtcbiAqIGBgYFxuICovXG5mdW5jdGlvbiBDb2xsZWN0aW9uKG5hbWUsIG9wdHMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBpZiAoIW5hbWUpIHRocm93IG5ldyBFcnJvcignQ29sbGVjdGlvbiBtdXN0IGhhdmUgYSBuYW1lJyk7XG5cbiAgb3B0cyA9IG9wdHMgfHwge307XG4gIHV0aWwuZXh0ZW5kRnJvbU9wdHModGhpcywgb3B0cywge30pO1xuXG4gIHV0aWwuZXh0ZW5kKHRoaXMsIHtcbiAgICBuYW1lOiBuYW1lLFxuICAgIF9yYXdNb2RlbHM6IHt9LFxuICAgIF9tb2RlbHM6IHt9LFxuICAgIF9vcHRzOiBvcHRzLFxuICAgIGluc3RhbGxlZDogZmFsc2VcbiAgfSk7XG5cbiAgQ29sbGVjdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyKHRoaXMpO1xuICB0aGlzLl9tYWtlQXZhaWxhYmxlT25Sb290KCk7XG4gIGV2ZW50cy5Qcm94eUV2ZW50RW1pdHRlci5jYWxsKHRoaXMsIHRoaXMubmFtZSk7XG59XG5cbkNvbGxlY3Rpb24ucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShldmVudHMuUHJveHlFdmVudEVtaXR0ZXIucHJvdG90eXBlKTtcblxudXRpbC5leHRlbmQoQ29sbGVjdGlvbi5wcm90b3R5cGUsIHtcbiAgX2dldE1vZGVsc1RvSW5zdGFsbDogZnVuY3Rpb24oKSB7XG4gICAgdmFyIG1vZGVsc1RvSW5zdGFsbCA9IFtdO1xuICAgIGZvciAodmFyIG5hbWUgaW4gdGhpcy5fbW9kZWxzKSB7XG4gICAgICBpZiAodGhpcy5fbW9kZWxzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgIHZhciBtb2RlbCA9IHRoaXMuX21vZGVsc1tuYW1lXTtcbiAgICAgICAgbW9kZWxzVG9JbnN0YWxsLnB1c2gobW9kZWwpO1xuICAgICAgfVxuICAgIH1cbiAgICBsb2coJ1RoZXJlIGFyZSAnICsgbW9kZWxzVG9JbnN0YWxsLmxlbmd0aC50b1N0cmluZygpICsgJyBtYXBwaW5ncyB0byBpbnN0YWxsJyk7XG4gICAgcmV0dXJuIG1vZGVsc1RvSW5zdGFsbDtcbiAgfSxcbiAgLyoqXG4gICAqIE1lYW5zIHRoYXQgd2UgY2FuIGFjY2VzcyB0aGUgY29sbGVjdGlvbiBvbiB0aGUgc2llc3RhIG9iamVjdC5cbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9tYWtlQXZhaWxhYmxlT25Sb290OiBmdW5jdGlvbigpIHtcbiAgICBzaWVzdGFbdGhpcy5uYW1lXSA9IHRoaXM7XG4gIH0sXG4gIC8qKlxuICAgKiBFbnN1cmUgbWFwcGluZ3MgYXJlIGluc3RhbGxlZC5cbiAgICogQHBhcmFtIFtjYl1cbiAgICogQGNsYXNzIENvbGxlY3Rpb25cbiAgICovXG4gIGluc3RhbGw6IGZ1bmN0aW9uKGNiKSB7XG4gICAgdmFyIG1vZGVsc1RvSW5zdGFsbCA9IHRoaXMuX2dldE1vZGVsc1RvSW5zdGFsbCgpO1xuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICBpZiAoIXRoaXMuaW5zdGFsbGVkKSB7XG4gICAgICAgIHRoaXMuaW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgdmFyIGVycm9ycyA9IFtdO1xuICAgICAgICBtb2RlbHNUb0luc3RhbGwuZm9yRWFjaChmdW5jdGlvbihtKSB7XG4gICAgICAgICAgbG9nKCdJbnN0YWxsaW5nIHJlbGF0aW9uc2hpcHMgZm9yIG1hcHBpbmcgd2l0aCBuYW1lIFwiJyArIG0ubmFtZSArICdcIicpO1xuICAgICAgICAgIHZhciBlcnIgPSBtLmluc3RhbGxSZWxhdGlvbnNoaXBzKCk7XG4gICAgICAgICAgaWYgKGVycikgZXJyb3JzLnB1c2goZXJyKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGlmICghZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgIG1vZGVsc1RvSW5zdGFsbC5mb3JFYWNoKGZ1bmN0aW9uKG0pIHtcbiAgICAgICAgICAgIGxvZygnSW5zdGFsbGluZyByZXZlcnNlIHJlbGF0aW9uc2hpcHMgZm9yIG1hcHBpbmcgd2l0aCBuYW1lIFwiJyArIG0ubmFtZSArICdcIicpO1xuICAgICAgICAgICAgdmFyIGVyciA9IG0uaW5zdGFsbFJldmVyc2VSZWxhdGlvbnNoaXBzKCk7XG4gICAgICAgICAgICBpZiAoZXJyKSBlcnJvcnMucHVzaChlcnIpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIGlmICghZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgdGhpcy5pbnN0YWxsZWQgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5fbWFrZUF2YWlsYWJsZU9uUm9vdCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjYihlcnJvcnMubGVuZ3RoID8gZXJyb3IoJ0Vycm9ycyB3ZXJlIGVuY291bnRlcmVkIHdoaWxzdCBzZXR0aW5nIHVwIHRoZSBjb2xsZWN0aW9uJywge2Vycm9yczogZXJyb3JzfSkgOiBudWxsKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdDb2xsZWN0aW9uIFwiJyArIHRoaXMubmFtZSArICdcIiBoYXMgYWxyZWFkeSBiZWVuIGluc3RhbGxlZCcpO1xuICAgICAgfVxuICAgIH0uYmluZCh0aGlzKSk7XG4gIH0sXG5cbiAgX21vZGVsOiBmdW5jdGlvbihuYW1lLCBvcHRzKSB7XG4gICAgaWYgKG5hbWUpIHtcbiAgICAgIHRoaXMuX3Jhd01vZGVsc1tuYW1lXSA9IG9wdHM7XG4gICAgICBvcHRzID0gZXh0ZW5kKHRydWUsIHt9LCBvcHRzKTtcbiAgICAgIG9wdHMubmFtZSA9IG5hbWU7XG4gICAgICBvcHRzLmNvbGxlY3Rpb24gPSB0aGlzO1xuICAgICAgdmFyIG1vZGVsID0gbmV3IE1vZGVsKG9wdHMpO1xuICAgICAgdGhpcy5fbW9kZWxzW25hbWVdID0gbW9kZWw7XG4gICAgICB0aGlzW25hbWVdID0gbW9kZWw7XG4gICAgICBpZiAodGhpcy5pbnN0YWxsZWQpIHtcbiAgICAgICAgdmFyIGVycm9yID0gbW9kZWwuaW5zdGFsbFJlbGF0aW9uc2hpcHMoKTtcbiAgICAgICAgaWYgKCFlcnJvcikgZXJyb3IgPSBtb2RlbC5pbnN0YWxsUmV2ZXJzZVJlbGF0aW9uc2hpcHMoKTtcbiAgICAgICAgaWYgKGVycm9yKSAgdGhyb3cgZXJyb3I7XG4gICAgICB9XG4gICAgICByZXR1cm4gbW9kZWw7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBuYW1lIHNwZWNpZmllZCB3aGVuIGNyZWF0aW5nIG1hcHBpbmcnKTtcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVycyBhIG1vZGVsIHdpdGggdGhpcyBjb2xsZWN0aW9uLlxuICAgKi9cbiAgbW9kZWw6IGFyZ3NhcnJheShmdW5jdGlvbihhcmdzKSB7XG4gICAgaWYgKGFyZ3MubGVuZ3RoKSB7XG4gICAgICBpZiAoYXJncy5sZW5ndGggPT0gMSkge1xuICAgICAgICBpZiAodXRpbC5pc0FycmF5KGFyZ3NbMF0pKSB7XG4gICAgICAgICAgcmV0dXJuIGFyZ3NbMF0ubWFwKGZ1bmN0aW9uKG0pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9tb2RlbChtLm5hbWUsIG0pO1xuICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyIG5hbWUsIG9wdHM7XG4gICAgICAgICAgaWYgKHV0aWwuaXNTdHJpbmcoYXJnc1swXSkpIHtcbiAgICAgICAgICAgIG5hbWUgPSBhcmdzWzBdO1xuICAgICAgICAgICAgb3B0cyA9IHt9O1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIG9wdHMgPSBhcmdzWzBdO1xuICAgICAgICAgICAgbmFtZSA9IG9wdHMubmFtZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHRoaXMuX21vZGVsKG5hbWUsIG9wdHMpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAodHlwZW9mIGFyZ3NbMF0gPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5fbW9kZWwoYXJnc1swXSwgYXJnc1sxXSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIGFyZ3MubWFwKGZ1bmN0aW9uKG0pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9tb2RlbChtLm5hbWUsIG0pO1xuICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbiAgfSksXG5cbiAgLyoqXG4gICAqIER1bXAgdGhpcyBjb2xsZWN0aW9uIGFzIEpTT05cbiAgICogQHBhcmFtICB7Qm9vbGVhbn0gYXNKc29uIFdoZXRoZXIgb3Igbm90IHRvIGFwcGx5IEpTT04uc3RyaW5naWZ5XG4gICAqIEByZXR1cm4ge1N0cmluZ3xPYmplY3R9XG4gICAqIEBjbGFzcyBDb2xsZWN0aW9uXG4gICAqL1xuICBfZHVtcDogZnVuY3Rpb24oYXNKc29uKSB7XG4gICAgdmFyIG9iaiA9IHt9O1xuICAgIG9iai5pbnN0YWxsZWQgPSB0aGlzLmluc3RhbGxlZDtcbiAgICBvYmouZG9jSWQgPSB0aGlzLl9kb2NJZDtcbiAgICBvYmoubmFtZSA9IHRoaXMubmFtZTtcbiAgICByZXR1cm4gYXNKc29uID8gdXRpbC5wcmV0dHlQcmludChvYmopIDogb2JqO1xuICB9LFxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBudW1iZXIgb2Ygb2JqZWN0cyBpbiB0aGlzIGNvbGxlY3Rpb24uXG4gICAqXG4gICAqIEBwYXJhbSBjYlxuICAgKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAgICovXG4gIGNvdW50OiBmdW5jdGlvbihjYikge1xuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICB2YXIgdGFza3MgPSBPYmplY3Qua2V5cyh0aGlzLl9tb2RlbHMpLm1hcChmdW5jdGlvbihtb2RlbE5hbWUpIHtcbiAgICAgICAgdmFyIG0gPSB0aGlzLl9tb2RlbHNbbW9kZWxOYW1lXTtcbiAgICAgICAgcmV0dXJuIG0uY291bnQuYmluZChtKTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICB1dGlsLnBhcmFsbGVsKHRhc2tzLCBmdW5jdGlvbihlcnIsIG5zKSB7XG4gICAgICAgIHZhciBuO1xuICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgIG4gPSBucy5yZWR1Y2UoZnVuY3Rpb24obSwgcikge1xuICAgICAgICAgICAgcmV0dXJuIG0gKyByXG4gICAgICAgICAgfSwgMCk7XG4gICAgICAgIH1cbiAgICAgICAgY2IoZXJyLCBuKTtcbiAgICAgIH0pO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gIH0sXG5cbiAgZ3JhcGg6IGZ1bmN0aW9uKGRhdGEsIG9wdHMsIGNiKSB7XG4gICAgaWYgKHR5cGVvZiBvcHRzID09ICdmdW5jdGlvbicpIGNiID0gb3B0cztcbiAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgdmFyIHRhc2tzID0gW10sIGVycjtcbiAgICAgIGZvciAodmFyIG1vZGVsTmFtZSBpbiBkYXRhKSB7XG4gICAgICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KG1vZGVsTmFtZSkpIHtcbiAgICAgICAgICB2YXIgbW9kZWwgPSB0aGlzLl9tb2RlbHNbbW9kZWxOYW1lXTtcbiAgICAgICAgICBpZiAobW9kZWwpIHtcbiAgICAgICAgICAgIChmdW5jdGlvbihtb2RlbCwgZGF0YSkge1xuICAgICAgICAgICAgICB0YXNrcy5wdXNoKGZ1bmN0aW9uKGRvbmUpIHtcbiAgICAgICAgICAgICAgICBtb2RlbC5ncmFwaChkYXRhLCBmdW5jdGlvbihlcnIsIG1vZGVscykge1xuICAgICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlc3VsdHMgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0c1ttb2RlbC5uYW1lXSA9IG1vZGVscztcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGRvbmUoZXJyLCByZXN1bHRzKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KShtb2RlbCwgZGF0YVttb2RlbE5hbWVdKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBlcnIgPSAnTm8gc3VjaCBtb2RlbCBcIicgKyBtb2RlbE5hbWUgKyAnXCInO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgdXRpbC5zZXJpZXModGFza3MsIGZ1bmN0aW9uKGVyciwgcmVzdWx0cykge1xuICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICByZXN1bHRzID0gcmVzdWx0cy5yZWR1Y2UoZnVuY3Rpb24obWVtbywgcmVzKSB7XG4gICAgICAgICAgICAgIHJldHVybiB1dGlsLmV4dGVuZChtZW1vLCByZXMgfHwge30pO1xuICAgICAgICAgICAgfSwge30pXG4gICAgICAgICAgfSBlbHNlIHJlc3VsdHMgPSBudWxsO1xuICAgICAgICAgIGNiKGVyciwgcmVzdWx0cyk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgZWxzZSBjYihlcnJvcihlcnIsIHtkYXRhOiBkYXRhLCBpbnZhbGlkTW9kZWxOYW1lOiBtb2RlbE5hbWV9KSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcblxuICByZW1vdmVBbGw6IGZ1bmN0aW9uKGNiKSB7XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgIHV0aWwuUHJvbWlzZS5hbGwoXG4gICAgICAgIE9iamVjdC5rZXlzKHRoaXMuX21vZGVscykubWFwKGZ1bmN0aW9uKG1vZGVsTmFtZSkge1xuICAgICAgICAgIHZhciBtb2RlbCA9IHRoaXMuX21vZGVsc1ttb2RlbE5hbWVdO1xuICAgICAgICAgIHJldHVybiBtb2RlbC5yZW1vdmVBbGwoKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKVxuICAgICAgKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGNiKG51bGwpO1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goY2IpXG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gQ29sbGVjdGlvbjtcblxuXG4vKiogV0VCUEFDSyBGT09URVIgKipcbiAqKiAuL2NvcmUvY29sbGVjdGlvbi5qc1xuICoqLyIsIi8qKlxuICogRGVhZCBzaW1wbGUgbG9nZ2luZyBzZXJ2aWNlIGJhc2VkIG9uIHZpc2lvbm1lZGlhL2RlYnVnXG4gKiBAbW9kdWxlIGxvZ1xuICovXG5cbnZhciBkZWJ1ZyA9IHJlcXVpcmUoJ2RlYnVnJyksXG4gIGFyZ3NhcnJheSA9IHJlcXVpcmUoJ2FyZ3NhcnJheScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgdmFyIGxvZyA9IGRlYnVnKCdzaWVzdGE6JyArIG5hbWUpO1xuICB2YXIgZm4gPSBhcmdzYXJyYXkoZnVuY3Rpb24oYXJncykge1xuICAgIGxvZy5jYWxsKGxvZywgYXJncyk7XG4gIH0pO1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZm4sICdlbmFibGVkJywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gZGVidWcuZW5hYmxlZChuYW1lKTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gZm47XG59O1xuXG5cbi8qKiBXRUJQQUNLIEZPT1RFUiAqKlxuICoqIC4vY29yZS9sb2cuanNcbiAqKi8iLCJcbi8qKlxuICogVGhpcyBpcyB0aGUgd2ViIGJyb3dzZXIgaW1wbGVtZW50YXRpb24gb2YgYGRlYnVnKClgLlxuICpcbiAqIEV4cG9zZSBgZGVidWcoKWAgYXMgdGhlIG1vZHVsZS5cbiAqL1xuXG5leHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2RlYnVnJyk7XG5leHBvcnRzLmxvZyA9IGxvZztcbmV4cG9ydHMuZm9ybWF0QXJncyA9IGZvcm1hdEFyZ3M7XG5leHBvcnRzLnNhdmUgPSBzYXZlO1xuZXhwb3J0cy5sb2FkID0gbG9hZDtcbmV4cG9ydHMudXNlQ29sb3JzID0gdXNlQ29sb3JzO1xuZXhwb3J0cy5zdG9yYWdlID0gJ3VuZGVmaW5lZCcgIT0gdHlwZW9mIGNocm9tZVxuICAgICAgICAgICAgICAgJiYgJ3VuZGVmaW5lZCcgIT0gdHlwZW9mIGNocm9tZS5zdG9yYWdlXG4gICAgICAgICAgICAgICAgICA/IGNocm9tZS5zdG9yYWdlLmxvY2FsXG4gICAgICAgICAgICAgICAgICA6IGxvY2Fsc3RvcmFnZSgpO1xuXG4vKipcbiAqIENvbG9ycy5cbiAqL1xuXG5leHBvcnRzLmNvbG9ycyA9IFtcbiAgJ2xpZ2h0c2VhZ3JlZW4nLFxuICAnZm9yZXN0Z3JlZW4nLFxuICAnZ29sZGVucm9kJyxcbiAgJ2RvZGdlcmJsdWUnLFxuICAnZGFya29yY2hpZCcsXG4gICdjcmltc29uJ1xuXTtcblxuLyoqXG4gKiBDdXJyZW50bHkgb25seSBXZWJLaXQtYmFzZWQgV2ViIEluc3BlY3RvcnMsIEZpcmVmb3ggPj0gdjMxLFxuICogYW5kIHRoZSBGaXJlYnVnIGV4dGVuc2lvbiAoYW55IEZpcmVmb3ggdmVyc2lvbikgYXJlIGtub3duXG4gKiB0byBzdXBwb3J0IFwiJWNcIiBDU1MgY3VzdG9taXphdGlvbnMuXG4gKlxuICogVE9ETzogYWRkIGEgYGxvY2FsU3RvcmFnZWAgdmFyaWFibGUgdG8gZXhwbGljaXRseSBlbmFibGUvZGlzYWJsZSBjb2xvcnNcbiAqL1xuXG5mdW5jdGlvbiB1c2VDb2xvcnMoKSB7XG4gIC8vIGlzIHdlYmtpdD8gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMTY0NTk2MDYvMzc2NzczXG4gIHJldHVybiAoJ1dlYmtpdEFwcGVhcmFuY2UnIGluIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zdHlsZSkgfHxcbiAgICAvLyBpcyBmaXJlYnVnPyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8zOTgxMjAvMzc2NzczXG4gICAgKHdpbmRvdy5jb25zb2xlICYmIChjb25zb2xlLmZpcmVidWcgfHwgKGNvbnNvbGUuZXhjZXB0aW9uICYmIGNvbnNvbGUudGFibGUpKSkgfHxcbiAgICAvLyBpcyBmaXJlZm94ID49IHYzMT9cbiAgICAvLyBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1Rvb2xzL1dlYl9Db25zb2xlI1N0eWxpbmdfbWVzc2FnZXNcbiAgICAobmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLm1hdGNoKC9maXJlZm94XFwvKFxcZCspLykgJiYgcGFyc2VJbnQoUmVnRXhwLiQxLCAxMCkgPj0gMzEpO1xufVxuXG4vKipcbiAqIE1hcCAlaiB0byBgSlNPTi5zdHJpbmdpZnkoKWAsIHNpbmNlIG5vIFdlYiBJbnNwZWN0b3JzIGRvIHRoYXQgYnkgZGVmYXVsdC5cbiAqL1xuXG5leHBvcnRzLmZvcm1hdHRlcnMuaiA9IGZ1bmN0aW9uKHYpIHtcbiAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHYpO1xufTtcblxuXG4vKipcbiAqIENvbG9yaXplIGxvZyBhcmd1bWVudHMgaWYgZW5hYmxlZC5cbiAqXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGZvcm1hdEFyZ3MoKSB7XG4gIHZhciBhcmdzID0gYXJndW1lbnRzO1xuICB2YXIgdXNlQ29sb3JzID0gdGhpcy51c2VDb2xvcnM7XG5cbiAgYXJnc1swXSA9ICh1c2VDb2xvcnMgPyAnJWMnIDogJycpXG4gICAgKyB0aGlzLm5hbWVzcGFjZVxuICAgICsgKHVzZUNvbG9ycyA/ICcgJWMnIDogJyAnKVxuICAgICsgYXJnc1swXVxuICAgICsgKHVzZUNvbG9ycyA/ICclYyAnIDogJyAnKVxuICAgICsgJysnICsgZXhwb3J0cy5odW1hbml6ZSh0aGlzLmRpZmYpO1xuXG4gIGlmICghdXNlQ29sb3JzKSByZXR1cm4gYXJncztcblxuICB2YXIgYyA9ICdjb2xvcjogJyArIHRoaXMuY29sb3I7XG4gIGFyZ3MgPSBbYXJnc1swXSwgYywgJ2NvbG9yOiBpbmhlcml0J10uY29uY2F0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3MsIDEpKTtcblxuICAvLyB0aGUgZmluYWwgXCIlY1wiIGlzIHNvbWV3aGF0IHRyaWNreSwgYmVjYXVzZSB0aGVyZSBjb3VsZCBiZSBvdGhlclxuICAvLyBhcmd1bWVudHMgcGFzc2VkIGVpdGhlciBiZWZvcmUgb3IgYWZ0ZXIgdGhlICVjLCBzbyB3ZSBuZWVkIHRvXG4gIC8vIGZpZ3VyZSBvdXQgdGhlIGNvcnJlY3QgaW5kZXggdG8gaW5zZXJ0IHRoZSBDU1MgaW50b1xuICB2YXIgaW5kZXggPSAwO1xuICB2YXIgbGFzdEMgPSAwO1xuICBhcmdzWzBdLnJlcGxhY2UoLyVbYS16JV0vZywgZnVuY3Rpb24obWF0Y2gpIHtcbiAgICBpZiAoJyUlJyA9PT0gbWF0Y2gpIHJldHVybjtcbiAgICBpbmRleCsrO1xuICAgIGlmICgnJWMnID09PSBtYXRjaCkge1xuICAgICAgLy8gd2Ugb25seSBhcmUgaW50ZXJlc3RlZCBpbiB0aGUgKmxhc3QqICVjXG4gICAgICAvLyAodGhlIHVzZXIgbWF5IGhhdmUgcHJvdmlkZWQgdGhlaXIgb3duKVxuICAgICAgbGFzdEMgPSBpbmRleDtcbiAgICB9XG4gIH0pO1xuXG4gIGFyZ3Muc3BsaWNlKGxhc3RDLCAwLCBjKTtcbiAgcmV0dXJuIGFyZ3M7XG59XG5cbi8qKlxuICogSW52b2tlcyBgY29uc29sZS5sb2coKWAgd2hlbiBhdmFpbGFibGUuXG4gKiBOby1vcCB3aGVuIGBjb25zb2xlLmxvZ2AgaXMgbm90IGEgXCJmdW5jdGlvblwiLlxuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gbG9nKCkge1xuICAvLyB0aGlzIGhhY2tlcnkgaXMgcmVxdWlyZWQgZm9yIElFOC85LCB3aGVyZVxuICAvLyB0aGUgYGNvbnNvbGUubG9nYCBmdW5jdGlvbiBkb2Vzbid0IGhhdmUgJ2FwcGx5J1xuICByZXR1cm4gJ29iamVjdCcgPT09IHR5cGVvZiBjb25zb2xlXG4gICAgJiYgY29uc29sZS5sb2dcbiAgICAmJiBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHkuY2FsbChjb25zb2xlLmxvZywgY29uc29sZSwgYXJndW1lbnRzKTtcbn1cblxuLyoqXG4gKiBTYXZlIGBuYW1lc3BhY2VzYC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlc1xuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gc2F2ZShuYW1lc3BhY2VzKSB7XG4gIHRyeSB7XG4gICAgaWYgKG51bGwgPT0gbmFtZXNwYWNlcykge1xuICAgICAgZXhwb3J0cy5zdG9yYWdlLnJlbW92ZUl0ZW0oJ2RlYnVnJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGV4cG9ydHMuc3RvcmFnZS5kZWJ1ZyA9IG5hbWVzcGFjZXM7XG4gICAgfVxuICB9IGNhdGNoKGUpIHt9XG59XG5cbi8qKlxuICogTG9hZCBgbmFtZXNwYWNlc2AuXG4gKlxuICogQHJldHVybiB7U3RyaW5nfSByZXR1cm5zIHRoZSBwcmV2aW91c2x5IHBlcnNpc3RlZCBkZWJ1ZyBtb2Rlc1xuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gbG9hZCgpIHtcbiAgdmFyIHI7XG4gIHRyeSB7XG4gICAgciA9IGV4cG9ydHMuc3RvcmFnZS5kZWJ1ZztcbiAgfSBjYXRjaChlKSB7fVxuICByZXR1cm4gcjtcbn1cblxuLyoqXG4gKiBFbmFibGUgbmFtZXNwYWNlcyBsaXN0ZWQgaW4gYGxvY2FsU3RvcmFnZS5kZWJ1Z2AgaW5pdGlhbGx5LlxuICovXG5cbmV4cG9ydHMuZW5hYmxlKGxvYWQoKSk7XG5cbi8qKlxuICogTG9jYWxzdG9yYWdlIGF0dGVtcHRzIHRvIHJldHVybiB0aGUgbG9jYWxzdG9yYWdlLlxuICpcbiAqIFRoaXMgaXMgbmVjZXNzYXJ5IGJlY2F1c2Ugc2FmYXJpIHRocm93c1xuICogd2hlbiBhIHVzZXIgZGlzYWJsZXMgY29va2llcy9sb2NhbHN0b3JhZ2VcbiAqIGFuZCB5b3UgYXR0ZW1wdCB0byBhY2Nlc3MgaXQuXG4gKlxuICogQHJldHVybiB7TG9jYWxTdG9yYWdlfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gbG9jYWxzdG9yYWdlKCl7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHdpbmRvdy5sb2NhbFN0b3JhZ2U7XG4gIH0gY2F0Y2ggKGUpIHt9XG59XG5cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vfi9kZWJ1Zy9icm93c2VyLmpzXG4gKiogbW9kdWxlIGlkID0gMTJcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsIlxuLyoqXG4gKiBUaGlzIGlzIHRoZSBjb21tb24gbG9naWMgZm9yIGJvdGggdGhlIE5vZGUuanMgYW5kIHdlYiBicm93c2VyXG4gKiBpbXBsZW1lbnRhdGlvbnMgb2YgYGRlYnVnKClgLlxuICpcbiAqIEV4cG9zZSBgZGVidWcoKWAgYXMgdGhlIG1vZHVsZS5cbiAqL1xuXG5leHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBkZWJ1ZztcbmV4cG9ydHMuY29lcmNlID0gY29lcmNlO1xuZXhwb3J0cy5kaXNhYmxlID0gZGlzYWJsZTtcbmV4cG9ydHMuZW5hYmxlID0gZW5hYmxlO1xuZXhwb3J0cy5lbmFibGVkID0gZW5hYmxlZDtcbmV4cG9ydHMuaHVtYW5pemUgPSByZXF1aXJlKCdtcycpO1xuXG4vKipcbiAqIFRoZSBjdXJyZW50bHkgYWN0aXZlIGRlYnVnIG1vZGUgbmFtZXMsIGFuZCBuYW1lcyB0byBza2lwLlxuICovXG5cbmV4cG9ydHMubmFtZXMgPSBbXTtcbmV4cG9ydHMuc2tpcHMgPSBbXTtcblxuLyoqXG4gKiBNYXAgb2Ygc3BlY2lhbCBcIiVuXCIgaGFuZGxpbmcgZnVuY3Rpb25zLCBmb3IgdGhlIGRlYnVnIFwiZm9ybWF0XCIgYXJndW1lbnQuXG4gKlxuICogVmFsaWQga2V5IG5hbWVzIGFyZSBhIHNpbmdsZSwgbG93ZXJjYXNlZCBsZXR0ZXIsIGkuZS4gXCJuXCIuXG4gKi9cblxuZXhwb3J0cy5mb3JtYXR0ZXJzID0ge307XG5cbi8qKlxuICogUHJldmlvdXNseSBhc3NpZ25lZCBjb2xvci5cbiAqL1xuXG52YXIgcHJldkNvbG9yID0gMDtcblxuLyoqXG4gKiBQcmV2aW91cyBsb2cgdGltZXN0YW1wLlxuICovXG5cbnZhciBwcmV2VGltZTtcblxuLyoqXG4gKiBTZWxlY3QgYSBjb2xvci5cbiAqXG4gKiBAcmV0dXJuIHtOdW1iZXJ9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBzZWxlY3RDb2xvcigpIHtcbiAgcmV0dXJuIGV4cG9ydHMuY29sb3JzW3ByZXZDb2xvcisrICUgZXhwb3J0cy5jb2xvcnMubGVuZ3RoXTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBkZWJ1Z2dlciB3aXRoIHRoZSBnaXZlbiBgbmFtZXNwYWNlYC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZGVidWcobmFtZXNwYWNlKSB7XG5cbiAgLy8gZGVmaW5lIHRoZSBgZGlzYWJsZWRgIHZlcnNpb25cbiAgZnVuY3Rpb24gZGlzYWJsZWQoKSB7XG4gIH1cbiAgZGlzYWJsZWQuZW5hYmxlZCA9IGZhbHNlO1xuXG4gIC8vIGRlZmluZSB0aGUgYGVuYWJsZWRgIHZlcnNpb25cbiAgZnVuY3Rpb24gZW5hYmxlZCgpIHtcblxuICAgIHZhciBzZWxmID0gZW5hYmxlZDtcblxuICAgIC8vIHNldCBgZGlmZmAgdGltZXN0YW1wXG4gICAgdmFyIGN1cnIgPSArbmV3IERhdGUoKTtcbiAgICB2YXIgbXMgPSBjdXJyIC0gKHByZXZUaW1lIHx8IGN1cnIpO1xuICAgIHNlbGYuZGlmZiA9IG1zO1xuICAgIHNlbGYucHJldiA9IHByZXZUaW1lO1xuICAgIHNlbGYuY3VyciA9IGN1cnI7XG4gICAgcHJldlRpbWUgPSBjdXJyO1xuXG4gICAgLy8gYWRkIHRoZSBgY29sb3JgIGlmIG5vdCBzZXRcbiAgICBpZiAobnVsbCA9PSBzZWxmLnVzZUNvbG9ycykgc2VsZi51c2VDb2xvcnMgPSBleHBvcnRzLnVzZUNvbG9ycygpO1xuICAgIGlmIChudWxsID09IHNlbGYuY29sb3IgJiYgc2VsZi51c2VDb2xvcnMpIHNlbGYuY29sb3IgPSBzZWxlY3RDb2xvcigpO1xuXG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuXG4gICAgYXJnc1swXSA9IGV4cG9ydHMuY29lcmNlKGFyZ3NbMF0pO1xuXG4gICAgaWYgKCdzdHJpbmcnICE9PSB0eXBlb2YgYXJnc1swXSkge1xuICAgICAgLy8gYW55dGhpbmcgZWxzZSBsZXQncyBpbnNwZWN0IHdpdGggJW9cbiAgICAgIGFyZ3MgPSBbJyVvJ10uY29uY2F0KGFyZ3MpO1xuICAgIH1cblxuICAgIC8vIGFwcGx5IGFueSBgZm9ybWF0dGVyc2AgdHJhbnNmb3JtYXRpb25zXG4gICAgdmFyIGluZGV4ID0gMDtcbiAgICBhcmdzWzBdID0gYXJnc1swXS5yZXBsYWNlKC8lKFthLXolXSkvZywgZnVuY3Rpb24obWF0Y2gsIGZvcm1hdCkge1xuICAgICAgLy8gaWYgd2UgZW5jb3VudGVyIGFuIGVzY2FwZWQgJSB0aGVuIGRvbid0IGluY3JlYXNlIHRoZSBhcnJheSBpbmRleFxuICAgICAgaWYgKG1hdGNoID09PSAnJSUnKSByZXR1cm4gbWF0Y2g7XG4gICAgICBpbmRleCsrO1xuICAgICAgdmFyIGZvcm1hdHRlciA9IGV4cG9ydHMuZm9ybWF0dGVyc1tmb3JtYXRdO1xuICAgICAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiBmb3JtYXR0ZXIpIHtcbiAgICAgICAgdmFyIHZhbCA9IGFyZ3NbaW5kZXhdO1xuICAgICAgICBtYXRjaCA9IGZvcm1hdHRlci5jYWxsKHNlbGYsIHZhbCk7XG5cbiAgICAgICAgLy8gbm93IHdlIG5lZWQgdG8gcmVtb3ZlIGBhcmdzW2luZGV4XWAgc2luY2UgaXQncyBpbmxpbmVkIGluIHRoZSBgZm9ybWF0YFxuICAgICAgICBhcmdzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIGluZGV4LS07XG4gICAgICB9XG4gICAgICByZXR1cm4gbWF0Y2g7XG4gICAgfSk7XG5cbiAgICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGV4cG9ydHMuZm9ybWF0QXJncykge1xuICAgICAgYXJncyA9IGV4cG9ydHMuZm9ybWF0QXJncy5hcHBseShzZWxmLCBhcmdzKTtcbiAgICB9XG4gICAgdmFyIGxvZ0ZuID0gZW5hYmxlZC5sb2cgfHwgZXhwb3J0cy5sb2cgfHwgY29uc29sZS5sb2cuYmluZChjb25zb2xlKTtcbiAgICBsb2dGbi5hcHBseShzZWxmLCBhcmdzKTtcbiAgfVxuICBlbmFibGVkLmVuYWJsZWQgPSB0cnVlO1xuXG4gIHZhciBmbiA9IGV4cG9ydHMuZW5hYmxlZChuYW1lc3BhY2UpID8gZW5hYmxlZCA6IGRpc2FibGVkO1xuXG4gIGZuLm5hbWVzcGFjZSA9IG5hbWVzcGFjZTtcblxuICByZXR1cm4gZm47XG59XG5cbi8qKlxuICogRW5hYmxlcyBhIGRlYnVnIG1vZGUgYnkgbmFtZXNwYWNlcy4gVGhpcyBjYW4gaW5jbHVkZSBtb2Rlc1xuICogc2VwYXJhdGVkIGJ5IGEgY29sb24gYW5kIHdpbGRjYXJkcy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlc1xuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBlbmFibGUobmFtZXNwYWNlcykge1xuICBleHBvcnRzLnNhdmUobmFtZXNwYWNlcyk7XG5cbiAgdmFyIHNwbGl0ID0gKG5hbWVzcGFjZXMgfHwgJycpLnNwbGl0KC9bXFxzLF0rLyk7XG4gIHZhciBsZW4gPSBzcGxpdC5sZW5ndGg7XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgIGlmICghc3BsaXRbaV0pIGNvbnRpbnVlOyAvLyBpZ25vcmUgZW1wdHkgc3RyaW5nc1xuICAgIG5hbWVzcGFjZXMgPSBzcGxpdFtpXS5yZXBsYWNlKC9cXCovZywgJy4qPycpO1xuICAgIGlmIChuYW1lc3BhY2VzWzBdID09PSAnLScpIHtcbiAgICAgIGV4cG9ydHMuc2tpcHMucHVzaChuZXcgUmVnRXhwKCdeJyArIG5hbWVzcGFjZXMuc3Vic3RyKDEpICsgJyQnKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGV4cG9ydHMubmFtZXMucHVzaChuZXcgUmVnRXhwKCdeJyArIG5hbWVzcGFjZXMgKyAnJCcpKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBEaXNhYmxlIGRlYnVnIG91dHB1dC5cbiAqXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGRpc2FibGUoKSB7XG4gIGV4cG9ydHMuZW5hYmxlKCcnKTtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgdGhlIGdpdmVuIG1vZGUgbmFtZSBpcyBlbmFibGVkLCBmYWxzZSBvdGhlcndpc2UuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGVuYWJsZWQobmFtZSkge1xuICB2YXIgaSwgbGVuO1xuICBmb3IgKGkgPSAwLCBsZW4gPSBleHBvcnRzLnNraXBzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKGV4cG9ydHMuc2tpcHNbaV0udGVzdChuYW1lKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuICBmb3IgKGkgPSAwLCBsZW4gPSBleHBvcnRzLm5hbWVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKGV4cG9ydHMubmFtZXNbaV0udGVzdChuYW1lKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuLyoqXG4gKiBDb2VyY2UgYHZhbGAuXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gdmFsXG4gKiBAcmV0dXJuIHtNaXhlZH1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGNvZXJjZSh2YWwpIHtcbiAgaWYgKHZhbCBpbnN0YW5jZW9mIEVycm9yKSByZXR1cm4gdmFsLnN0YWNrIHx8IHZhbC5tZXNzYWdlO1xuICByZXR1cm4gdmFsO1xufVxuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL34vZGVidWcvZGVidWcuanNcbiAqKiBtb2R1bGUgaWQgPSAxM1xuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwiLyoqXG4gKiBIZWxwZXJzLlxuICovXG5cbnZhciBzID0gMTAwMDtcbnZhciBtID0gcyAqIDYwO1xudmFyIGggPSBtICogNjA7XG52YXIgZCA9IGggKiAyNDtcbnZhciB5ID0gZCAqIDM2NS4yNTtcblxuLyoqXG4gKiBQYXJzZSBvciBmb3JtYXQgdGhlIGdpdmVuIGB2YWxgLlxuICpcbiAqIE9wdGlvbnM6XG4gKlxuICogIC0gYGxvbmdgIHZlcmJvc2UgZm9ybWF0dGluZyBbZmFsc2VdXG4gKlxuICogQHBhcmFtIHtTdHJpbmd8TnVtYmVyfSB2YWxcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcmV0dXJuIHtTdHJpbmd8TnVtYmVyfVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHZhbCwgb3B0aW9ucyl7XG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICBpZiAoJ3N0cmluZycgPT0gdHlwZW9mIHZhbCkgcmV0dXJuIHBhcnNlKHZhbCk7XG4gIHJldHVybiBvcHRpb25zLmxvbmdcbiAgICA/IGxvbmcodmFsKVxuICAgIDogc2hvcnQodmFsKTtcbn07XG5cbi8qKlxuICogUGFyc2UgdGhlIGdpdmVuIGBzdHJgIGFuZCByZXR1cm4gbWlsbGlzZWNvbmRzLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHJcbiAqIEByZXR1cm4ge051bWJlcn1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHBhcnNlKHN0cikge1xuICBzdHIgPSAnJyArIHN0cjtcbiAgaWYgKHN0ci5sZW5ndGggPiAxMDAwMCkgcmV0dXJuO1xuICB2YXIgbWF0Y2ggPSAvXigoPzpcXGQrKT9cXC4/XFxkKykgKihtaWxsaXNlY29uZHM/fG1zZWNzP3xtc3xzZWNvbmRzP3xzZWNzP3xzfG1pbnV0ZXM/fG1pbnM/fG18aG91cnM/fGhycz98aHxkYXlzP3xkfHllYXJzP3x5cnM/fHkpPyQvaS5leGVjKHN0cik7XG4gIGlmICghbWF0Y2gpIHJldHVybjtcbiAgdmFyIG4gPSBwYXJzZUZsb2F0KG1hdGNoWzFdKTtcbiAgdmFyIHR5cGUgPSAobWF0Y2hbMl0gfHwgJ21zJykudG9Mb3dlckNhc2UoKTtcbiAgc3dpdGNoICh0eXBlKSB7XG4gICAgY2FzZSAneWVhcnMnOlxuICAgIGNhc2UgJ3llYXInOlxuICAgIGNhc2UgJ3lycyc6XG4gICAgY2FzZSAneXInOlxuICAgIGNhc2UgJ3knOlxuICAgICAgcmV0dXJuIG4gKiB5O1xuICAgIGNhc2UgJ2RheXMnOlxuICAgIGNhc2UgJ2RheSc6XG4gICAgY2FzZSAnZCc6XG4gICAgICByZXR1cm4gbiAqIGQ7XG4gICAgY2FzZSAnaG91cnMnOlxuICAgIGNhc2UgJ2hvdXInOlxuICAgIGNhc2UgJ2hycyc6XG4gICAgY2FzZSAnaHInOlxuICAgIGNhc2UgJ2gnOlxuICAgICAgcmV0dXJuIG4gKiBoO1xuICAgIGNhc2UgJ21pbnV0ZXMnOlxuICAgIGNhc2UgJ21pbnV0ZSc6XG4gICAgY2FzZSAnbWlucyc6XG4gICAgY2FzZSAnbWluJzpcbiAgICBjYXNlICdtJzpcbiAgICAgIHJldHVybiBuICogbTtcbiAgICBjYXNlICdzZWNvbmRzJzpcbiAgICBjYXNlICdzZWNvbmQnOlxuICAgIGNhc2UgJ3NlY3MnOlxuICAgIGNhc2UgJ3NlYyc6XG4gICAgY2FzZSAncyc6XG4gICAgICByZXR1cm4gbiAqIHM7XG4gICAgY2FzZSAnbWlsbGlzZWNvbmRzJzpcbiAgICBjYXNlICdtaWxsaXNlY29uZCc6XG4gICAgY2FzZSAnbXNlY3MnOlxuICAgIGNhc2UgJ21zZWMnOlxuICAgIGNhc2UgJ21zJzpcbiAgICAgIHJldHVybiBuO1xuICB9XG59XG5cbi8qKlxuICogU2hvcnQgZm9ybWF0IGZvciBgbXNgLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBtc1xuICogQHJldHVybiB7U3RyaW5nfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gc2hvcnQobXMpIHtcbiAgaWYgKG1zID49IGQpIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gZCkgKyAnZCc7XG4gIGlmIChtcyA+PSBoKSByZXR1cm4gTWF0aC5yb3VuZChtcyAvIGgpICsgJ2gnO1xuICBpZiAobXMgPj0gbSkgcmV0dXJuIE1hdGgucm91bmQobXMgLyBtKSArICdtJztcbiAgaWYgKG1zID49IHMpIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gcykgKyAncyc7XG4gIHJldHVybiBtcyArICdtcyc7XG59XG5cbi8qKlxuICogTG9uZyBmb3JtYXQgZm9yIGBtc2AuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1zXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBsb25nKG1zKSB7XG4gIHJldHVybiBwbHVyYWwobXMsIGQsICdkYXknKVxuICAgIHx8IHBsdXJhbChtcywgaCwgJ2hvdXInKVxuICAgIHx8IHBsdXJhbChtcywgbSwgJ21pbnV0ZScpXG4gICAgfHwgcGx1cmFsKG1zLCBzLCAnc2Vjb25kJylcbiAgICB8fCBtcyArICcgbXMnO1xufVxuXG4vKipcbiAqIFBsdXJhbGl6YXRpb24gaGVscGVyLlxuICovXG5cbmZ1bmN0aW9uIHBsdXJhbChtcywgbiwgbmFtZSkge1xuICBpZiAobXMgPCBuKSByZXR1cm47XG4gIGlmIChtcyA8IG4gKiAxLjUpIHJldHVybiBNYXRoLmZsb29yKG1zIC8gbikgKyAnICcgKyBuYW1lO1xuICByZXR1cm4gTWF0aC5jZWlsKG1zIC8gbikgKyAnICcgKyBuYW1lICsgJ3MnO1xufVxuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL34vbXMvaW5kZXguanNcbiAqKiBtb2R1bGUgaWQgPSAxNFxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwidmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJykoJ21vZGVsJyksXG4gIENvbGxlY3Rpb25SZWdpc3RyeSA9IHJlcXVpcmUoJy4vY29sbGVjdGlvblJlZ2lzdHJ5JykuQ29sbGVjdGlvblJlZ2lzdHJ5LFxuICBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gIFJlbGF0aW9uc2hpcFR5cGUgPSByZXF1aXJlKCcuL1JlbGF0aW9uc2hpcFR5cGUnKSxcbiAgUXVlcnkgPSByZXF1aXJlKCcuL1F1ZXJ5JyksXG4gIE1hcHBpbmdPcGVyYXRpb24gPSByZXF1aXJlKCcuL21hcHBpbmdPcGVyYXRpb24nKSxcbiAgTW9kZWxJbnN0YW5jZSA9IHJlcXVpcmUoJy4vTW9kZWxJbnN0YW5jZScpLFxuICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpLFxuICBhcmdzYXJyYXkgPSByZXF1aXJlKCdhcmdzYXJyYXknKSxcbiAgZXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJyksXG4gIGV4dGVuZCA9IHJlcXVpcmUoJ2V4dGVuZCcpLFxuICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgQ29uZGl0aW9uID0gcmVxdWlyZSgnLi9Db25kaXRpb24nKSxcbiAgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgUGxhY2Vob2xkZXIgPSByZXF1aXJlKCcuL1BsYWNlaG9sZGVyJyksXG4gIFJlYWN0aXZlUXVlcnkgPSByZXF1aXJlKCcuL1JlYWN0aXZlUXVlcnknKSxcbiAgSW5zdGFuY2VGYWN0b3J5ID0gcmVxdWlyZSgnLi9pbnN0YW5jZUZhY3RvcnknKTtcblxuLyoqXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9wdHNcbiAqL1xuZnVuY3Rpb24gTW9kZWwob3B0cykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHRoaXMuX29wdHMgPSBvcHRzID8gdXRpbC5leHRlbmQoe30sIG9wdHMpIDoge307XG5cbiAgdXRpbC5leHRlbmRGcm9tT3B0cyh0aGlzLCBvcHRzLCB7XG4gICAgbWV0aG9kczoge30sXG4gICAgYXR0cmlidXRlczogW10sXG4gICAgY29sbGVjdGlvbjogZnVuY3Rpb24oYykge1xuICAgICAgaWYgKHV0aWwuaXNTdHJpbmcoYykpIHtcbiAgICAgICAgYyA9IENvbGxlY3Rpb25SZWdpc3RyeVtjXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBjO1xuICAgIH0sXG4gICAgaWQ6ICdpZCcsXG4gICAgcmVsYXRpb25zaGlwczogW10sXG4gICAgbmFtZTogbnVsbCxcbiAgICBpbmRleGVzOiBbXSxcbiAgICBzaW5nbGV0b246IGZhbHNlLFxuICAgIHN0YXRpY3M6IHRoaXMuaW5zdGFsbFN0YXRpY3MuYmluZCh0aGlzKSxcbiAgICBwcm9wZXJ0aWVzOiB7fSxcbiAgICBpbml0OiBudWxsLFxuICAgIHNlcmlhbGlzZTogbnVsbCxcbiAgICBzZXJpYWxpc2VGaWVsZDogbnVsbCxcbiAgICBzZXJpYWxpc2FibGVGaWVsZHM6IG51bGwsXG4gICAgcmVtb3ZlOiBudWxsLFxuICAgIHBhcnNlQXR0cmlidXRlOiBudWxsXG4gIH0sIGZhbHNlKTtcblxuICBpZiAoIXRoaXMucGFyc2VBdHRyaWJ1dGUpIHtcbiAgICB0aGlzLnBhcnNlQXR0cmlidXRlID0gZnVuY3Rpb24oYXR0ck5hbWUsIHZhbHVlKSB7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuICB9XG5cbiAgdGhpcy5hdHRyaWJ1dGVzID0gTW9kZWwuX3Byb2Nlc3NBdHRyaWJ1dGVzKHRoaXMuYXR0cmlidXRlcyk7XG5cbiAgdGhpcy5fZmFjdG9yeSA9IG5ldyBJbnN0YW5jZUZhY3RvcnkodGhpcyk7XG4gIHRoaXMuX2luc3RhbmNlID0gdGhpcy5fZmFjdG9yeS5faW5zdGFuY2UuYmluZCh0aGlzLl9mYWN0b3J5KTtcblxuICB1dGlsLmV4dGVuZCh0aGlzLCB7XG4gICAgX3JlbGF0aW9uc2hpcHNJbnN0YWxsZWQ6IGZhbHNlLFxuICAgIF9yZXZlcnNlUmVsYXRpb25zaGlwc0luc3RhbGxlZDogZmFsc2UsXG4gICAgY2hpbGRyZW46IFtdXG4gIH0pO1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHRoaXMsIHtcbiAgICBfcmVsYXRpb25zaGlwTmFtZXM6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBPYmplY3Qua2V5cyhzZWxmLnJlbGF0aW9uc2hpcHMpO1xuICAgICAgfSxcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9LFxuICAgIF9hdHRyaWJ1dGVOYW1lczoge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIG5hbWVzID0gW107XG4gICAgICAgIGlmIChzZWxmLmlkKSB7XG4gICAgICAgICAgbmFtZXMucHVzaChzZWxmLmlkKTtcbiAgICAgICAgfVxuICAgICAgICBzZWxmLmF0dHJpYnV0ZXMuZm9yRWFjaChmdW5jdGlvbih4KSB7XG4gICAgICAgICAgbmFtZXMucHVzaCh4Lm5hbWUpXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gbmFtZXM7XG4gICAgICB9LFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0sXG4gICAgaW5zdGFsbGVkOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gc2VsZi5fcmVsYXRpb25zaGlwc0luc3RhbGxlZCAmJiBzZWxmLl9yZXZlcnNlUmVsYXRpb25zaGlwc0luc3RhbGxlZDtcbiAgICAgIH0sXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSxcbiAgICBkZXNjZW5kYW50czoge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHNlbGYuY2hpbGRyZW4ucmVkdWNlKGZ1bmN0aW9uKG1lbW8sIGRlc2NlbmRhbnQpIHtcbiAgICAgICAgICByZXR1cm4gQXJyYXkucHJvdG90eXBlLmNvbmNhdC5jYWxsKG1lbW8sIGRlc2NlbmRhbnQuZGVzY2VuZGFudHMpO1xuICAgICAgICB9LmJpbmQoc2VsZiksIHV0aWwuZXh0ZW5kKFtdLCBzZWxmLmNoaWxkcmVuKSk7XG4gICAgICB9LFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH0sXG4gICAgY29sbGVjdGlvbk5hbWU6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNvbGxlY3Rpb24ubmFtZTtcbiAgICAgIH0sXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfVxuICB9KTtcbiAgdmFyIGdsb2JhbEV2ZW50TmFtZSA9IHRoaXMuY29sbGVjdGlvbk5hbWUgKyAnOicgKyB0aGlzLm5hbWUsXG4gICAgcHJveGllZCA9IHtcbiAgICAgIHF1ZXJ5OiB0aGlzLnF1ZXJ5LmJpbmQodGhpcylcbiAgICB9O1xuXG4gIGV2ZW50cy5Qcm94eUV2ZW50RW1pdHRlci5jYWxsKHRoaXMsIGdsb2JhbEV2ZW50TmFtZSwgcHJveGllZCk7XG5cbiAgdGhpcy5faW5kZXhJc0luc3RhbGxlZCA9IG5ldyBDb25kaXRpb24oZnVuY3Rpb24oZG9uZSkge1xuICAgICBkb25lKCk7XG4gIH0uYmluZCh0aGlzKSk7XG59XG5cbnV0aWwuZXh0ZW5kKE1vZGVsLCB7XG4gIC8qKlxuICAgKiBOb3JtYWxpc2UgYXR0cmlidXRlcyBwYXNzZWQgdmlhIHRoZSBvcHRpb25zIGRpY3Rpb25hcnkuXG4gICAqIEBwYXJhbSBhdHRyaWJ1dGVzXG4gICAqIEByZXR1cm5zIHtBcnJheX1cbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9wcm9jZXNzQXR0cmlidXRlczogZnVuY3Rpb24oYXR0cmlidXRlcykge1xuICAgIHJldHVybiBhdHRyaWJ1dGVzLnJlZHVjZShmdW5jdGlvbihtLCBhKSB7XG4gICAgICBpZiAodHlwZW9mIGEgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgbS5wdXNoKHtcbiAgICAgICAgICBuYW1lOiBhXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIG0ucHVzaChhKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtO1xuICAgIH0sIFtdKVxuICB9XG5cbn0pO1xuXG5Nb2RlbC5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKGV2ZW50cy5Qcm94eUV2ZW50RW1pdHRlci5wcm90b3R5cGUpO1xuXG51dGlsLmV4dGVuZChNb2RlbC5wcm90b3R5cGUsIHtcbiAgaW5zdGFsbFN0YXRpY3M6IGZ1bmN0aW9uKHN0YXRpY3MpIHtcbiAgICBpZiAoc3RhdGljcykge1xuICAgICAgT2JqZWN0LmtleXMoc3RhdGljcykuZm9yRWFjaChmdW5jdGlvbihzdGF0aWNOYW1lKSB7XG4gICAgICAgIGlmICh0aGlzW3N0YXRpY05hbWVdKSB7XG4gICAgICAgICAgbG9nKCdTdGF0aWMgbWV0aG9kIHdpdGggbmFtZSBcIicgKyBzdGF0aWNOYW1lICsgJ1wiIGFscmVhZHkgZXhpc3RzLiBJZ25vcmluZyBpdC4nKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICB0aGlzW3N0YXRpY05hbWVdID0gc3RhdGljc1tzdGF0aWNOYW1lXS5iaW5kKHRoaXMpO1xuICAgICAgICB9XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH1cbiAgICByZXR1cm4gc3RhdGljcztcbiAgfSxcbiAgX3ZhbGlkYXRlUmVsYXRpb25zaGlwVHlwZTogZnVuY3Rpb24ocmVsYXRpb25zaGlwKSB7XG4gICAgaWYgKCFyZWxhdGlvbnNoaXAudHlwZSkge1xuICAgICAgaWYgKHRoaXMuc2luZ2xldG9uKSByZWxhdGlvbnNoaXAudHlwZSA9IFJlbGF0aW9uc2hpcFR5cGUuT25lVG9PbmU7XG4gICAgICBlbHNlIHJlbGF0aW9uc2hpcC50eXBlID0gUmVsYXRpb25zaGlwVHlwZS5PbmVUb01hbnk7XG4gICAgfVxuICAgIGlmICh0aGlzLnNpbmdsZXRvbiAmJiByZWxhdGlvbnNoaXAudHlwZSA9PSBSZWxhdGlvbnNoaXBUeXBlLk1hbnlUb01hbnkpIHtcbiAgICAgIHJldHVybiAnU2luZ2xldG9uIG1vZGVsIGNhbm5vdCB1c2UgTWFueVRvTWFueSByZWxhdGlvbnNoaXAuJztcbiAgICB9XG4gICAgaWYgKE9iamVjdC5rZXlzKFJlbGF0aW9uc2hpcFR5cGUpLmluZGV4T2YocmVsYXRpb25zaGlwLnR5cGUpIDwgMClcbiAgICAgIHJldHVybiAnUmVsYXRpb25zaGlwIHR5cGUgJyArIHJlbGF0aW9uc2hpcC50eXBlICsgJyBkb2VzIG5vdCBleGlzdCc7XG4gICAgcmV0dXJuIG51bGw7XG4gIH0sXG4gIF9nZXRSZXZlcnNlTW9kZWw6IGZ1bmN0aW9uKHJldmVyc2VOYW1lKSB7XG4gICAgdmFyIHJldmVyc2VNb2RlbDtcbiAgICBpZiAocmV2ZXJzZU5hbWUgaW5zdGFuY2VvZiBNb2RlbCkgcmV2ZXJzZU1vZGVsID0gcmV2ZXJzZU5hbWU7XG4gICAgZWxzZSByZXZlcnNlTW9kZWwgPSB0aGlzLmNvbGxlY3Rpb25bcmV2ZXJzZU5hbWVdO1xuICAgIGlmICghcmV2ZXJzZU1vZGVsKSB7IC8vIE1heSBoYXZlIHVzZWQgQ29sbGVjdGlvbi5Nb2RlbCBmb3JtYXQuXG4gICAgICB2YXIgYXJyID0gcmV2ZXJzZU5hbWUuc3BsaXQoJy4nKTtcbiAgICAgIGlmIChhcnIubGVuZ3RoID09IDIpIHtcbiAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gYXJyWzBdO1xuICAgICAgICByZXZlcnNlTmFtZSA9IGFyclsxXTtcbiAgICAgICAgdmFyIG90aGVyQ29sbGVjdGlvbiA9IENvbGxlY3Rpb25SZWdpc3RyeVtjb2xsZWN0aW9uTmFtZV07XG4gICAgICAgIGlmIChvdGhlckNvbGxlY3Rpb24pXG4gICAgICAgICAgcmV2ZXJzZU1vZGVsID0gb3RoZXJDb2xsZWN0aW9uW3JldmVyc2VOYW1lXTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJldmVyc2VNb2RlbDtcbiAgfSxcbiAgLyoqXG4gICAqIFJldHVybiB0aGUgcmV2ZXJzZSBtb2RlbCBvciBhIHBsYWNlaG9sZGVyIHRoYXQgd2lsbCBiZSByZXNvbHZlZCBsYXRlci5cbiAgICogQHBhcmFtIGZvcndhcmROYW1lXG4gICAqIEBwYXJhbSByZXZlcnNlTmFtZVxuICAgKiBAcmV0dXJucyB7Kn1cbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9nZXRSZXZlcnNlTW9kZWxPclBsYWNlaG9sZGVyOiBmdW5jdGlvbihmb3J3YXJkTmFtZSwgcmV2ZXJzZU5hbWUpIHtcbiAgICB2YXIgcmV2ZXJzZU1vZGVsID0gdGhpcy5fZ2V0UmV2ZXJzZU1vZGVsKHJldmVyc2VOYW1lKTtcbiAgICByZXR1cm4gcmV2ZXJzZU1vZGVsIHx8IG5ldyBQbGFjZWhvbGRlcih7bmFtZTogcmV2ZXJzZU5hbWUsIHJlZjogdGhpcywgZm9yd2FyZE5hbWU6IGZvcndhcmROYW1lfSk7XG4gIH0sXG4gIC8qKlxuICAgKiBJbnN0YWxsIHJlbGF0aW9uc2hpcHMuIFJldHVybnMgZXJyb3IgaW4gZm9ybSBvZiBzdHJpbmcgaWYgZmFpbHMuXG4gICAqIEByZXR1cm4ge1N0cmluZ3xudWxsfVxuICAgKi9cbiAgaW5zdGFsbFJlbGF0aW9uc2hpcHM6IGZ1bmN0aW9uKCkge1xuICAgIGlmICghdGhpcy5fcmVsYXRpb25zaGlwc0luc3RhbGxlZCkge1xuICAgICAgdmFyIGVyciA9IG51bGw7XG4gICAgICBmb3IgKHZhciBuYW1lIGluIHRoaXMuX29wdHMucmVsYXRpb25zaGlwcykge1xuICAgICAgICBpZiAodGhpcy5fb3B0cy5yZWxhdGlvbnNoaXBzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgICAgdmFyIHJlbGF0aW9uc2hpcCA9IHRoaXMuX29wdHMucmVsYXRpb25zaGlwc1tuYW1lXTtcbiAgICAgICAgICAvLyBJZiBhIHJldmVyc2UgcmVsYXRpb25zaGlwIGlzIGluc3RhbGxlZCBiZWZvcmVoYW5kLCB3ZSBkbyBub3Qgd2FudCB0byBwcm9jZXNzIHRoZW0uXG4gICAgICAgICAgdmFyIGlzRm9yd2FyZCA9ICFyZWxhdGlvbnNoaXAuaXNSZXZlcnNlO1xuICAgICAgICAgIGlmIChpc0ZvcndhcmQpIHtcbiAgICAgICAgICAgIGxvZyh0aGlzLm5hbWUgKyAnOiBjb25maWd1cmluZyByZWxhdGlvbnNoaXAgJyArIG5hbWUsIHJlbGF0aW9uc2hpcCk7XG4gICAgICAgICAgICBpZiAoIShlcnIgPSB0aGlzLl92YWxpZGF0ZVJlbGF0aW9uc2hpcFR5cGUocmVsYXRpb25zaGlwKSkpIHtcbiAgICAgICAgICAgICAgdmFyIHJldmVyc2VNb2RlbE5hbWUgPSByZWxhdGlvbnNoaXAubW9kZWw7XG4gICAgICAgICAgICAgIGlmIChyZXZlcnNlTW9kZWxOYW1lKSB7XG4gICAgICAgICAgICAgICAgdmFyIHJldmVyc2VNb2RlbCA9IHRoaXMuX2dldFJldmVyc2VNb2RlbE9yUGxhY2Vob2xkZXIobmFtZSwgcmV2ZXJzZU1vZGVsTmFtZSk7XG4gICAgICAgICAgICAgICAgdXRpbC5leHRlbmQocmVsYXRpb25zaGlwLCB7XG4gICAgICAgICAgICAgICAgICByZXZlcnNlTW9kZWw6IHJldmVyc2VNb2RlbCxcbiAgICAgICAgICAgICAgICAgIGZvcndhcmRNb2RlbDogdGhpcyxcbiAgICAgICAgICAgICAgICAgIGZvcndhcmROYW1lOiBuYW1lLFxuICAgICAgICAgICAgICAgICAgcmV2ZXJzZU5hbWU6IHJlbGF0aW9uc2hpcC5yZXZlcnNlIHx8ICdyZXZlcnNlXycgKyBuYW1lLFxuICAgICAgICAgICAgICAgICAgaXNSZXZlcnNlOiBmYWxzZVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGRlbGV0ZSByZWxhdGlvbnNoaXAubW9kZWw7XG4gICAgICAgICAgICAgICAgZGVsZXRlIHJlbGF0aW9uc2hpcC5yZXZlcnNlO1xuXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZWxzZSByZXR1cm4gJ011c3QgcGFzcyBtb2RlbCc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdSZWxhdGlvbnNoaXBzIGZvciBcIicgKyB0aGlzLm5hbWUgKyAnXCIgaGF2ZSBhbHJlYWR5IGJlZW4gaW5zdGFsbGVkJyk7XG4gICAgfVxuICAgIGlmICghZXJyKSB0aGlzLl9yZWxhdGlvbnNoaXBzSW5zdGFsbGVkID0gdHJ1ZTtcbiAgICByZXR1cm4gZXJyO1xuICB9LFxuICBfaW5zdGFsbFJldmVyc2U6IGZ1bmN0aW9uKHJlbGF0aW9uc2hpcCkge1xuICAgIHZhciByZXZlcnNlTW9kZWwgPSByZWxhdGlvbnNoaXAucmV2ZXJzZU1vZGVsO1xuICAgIHZhciBpc1BsYWNlaG9sZGVyID0gcmV2ZXJzZU1vZGVsLmlzUGxhY2Vob2xkZXI7XG4gICAgaWYgKGlzUGxhY2Vob2xkZXIpIHtcbiAgICAgIHZhciBtb2RlbE5hbWUgPSByZWxhdGlvbnNoaXAucmV2ZXJzZU1vZGVsLm5hbWU7XG4gICAgICByZXZlcnNlTW9kZWwgPSB0aGlzLl9nZXRSZXZlcnNlTW9kZWwobW9kZWxOYW1lKTtcbiAgICAgIGlmIChyZXZlcnNlTW9kZWwpIHtcbiAgICAgICAgcmVsYXRpb25zaGlwLnJldmVyc2VNb2RlbCA9IHJldmVyc2VNb2RlbDtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHJldmVyc2VNb2RlbCkge1xuICAgICAgdmFyIGVycjtcbiAgICAgIHZhciByZXZlcnNlTmFtZSA9IHJlbGF0aW9uc2hpcC5yZXZlcnNlTmFtZSxcbiAgICAgICAgZm9yd2FyZE1vZGVsID0gcmVsYXRpb25zaGlwLmZvcndhcmRNb2RlbDtcblxuICAgICAgaWYgKHJldmVyc2VNb2RlbCAhPSB0aGlzIHx8IHJldmVyc2VNb2RlbCA9PSBmb3J3YXJkTW9kZWwpIHtcbiAgICAgICAgaWYgKHJldmVyc2VNb2RlbC5zaW5nbGV0b24pIHtcbiAgICAgICAgICBpZiAocmVsYXRpb25zaGlwLnR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5NYW55VG9NYW55KSBlcnIgPSAnU2luZ2xldG9uIG1vZGVsIGNhbm5vdCBiZSByZWxhdGVkIHZpYSByZXZlcnNlIE1hbnlUb01hbnknO1xuICAgICAgICAgIGlmIChyZWxhdGlvbnNoaXAudHlwZSA9PSBSZWxhdGlvbnNoaXBUeXBlLk9uZVRvTWFueSkgZXJyID0gJ1NpbmdsZXRvbiBtb2RlbCBjYW5ub3QgYmUgcmVsYXRlZCB2aWEgcmV2ZXJzZSBPbmVUb01hbnknO1xuICAgICAgICB9XG4gICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgbG9nKHRoaXMubmFtZSArICc6IGNvbmZpZ3VyaW5nICByZXZlcnNlIHJlbGF0aW9uc2hpcCAnICsgcmV2ZXJzZU5hbWUpO1xuICAgICAgICAgIGlmIChyZXZlcnNlTW9kZWwucmVsYXRpb25zaGlwc1tyZXZlcnNlTmFtZV0pIHtcbiAgICAgICAgICAgIC8vIFdlIGFyZSBvayB0byByZWRlZmluZSByZXZlcnNlIHJlbGF0aW9uc2hpcHMgd2hlcmVieSB0aGUgbW9kZWxzIGFyZSBpbiB0aGUgc2FtZSBoaWVyYXJjaHlcbiAgICAgICAgICAgIHZhciBpc0FuY2VzdG9yTW9kZWwgPSByZXZlcnNlTW9kZWwucmVsYXRpb25zaGlwc1tyZXZlcnNlTmFtZV0uZm9yd2FyZE1vZGVsLmlzQW5jZXN0b3JPZih0aGlzKTtcbiAgICAgICAgICAgIHZhciBpc0Rlc2NlbmRlbnRNb2RlbCA9IHJldmVyc2VNb2RlbC5yZWxhdGlvbnNoaXBzW3JldmVyc2VOYW1lXS5mb3J3YXJkTW9kZWwuaXNEZXNjZW5kYW50T2YodGhpcyk7XG4gICAgICAgICAgICBpZiAoIWlzQW5jZXN0b3JNb2RlbCAmJiAhaXNEZXNjZW5kZW50TW9kZWwpIHtcbiAgICAgICAgICAgICAgZXJyID0gJ1JldmVyc2UgcmVsYXRpb25zaGlwIFwiJyArIHJldmVyc2VOYW1lICsgJ1wiIGFscmVhZHkgZXhpc3RzIG9uIG1vZGVsIFwiJyArIHJldmVyc2VNb2RlbC5uYW1lICsgJ1wiJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgIHJldmVyc2VNb2RlbC5yZWxhdGlvbnNoaXBzW3JldmVyc2VOYW1lXSA9IHJlbGF0aW9uc2hpcDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChpc1BsYWNlaG9sZGVyKSB7XG4gICAgICAgIHZhciBleGlzdGluZ1JldmVyc2VJbnN0YW5jZXMgPSAoY2FjaGUuX2xvY2FsQ2FjaGVCeVR5cGVbcmV2ZXJzZU1vZGVsLmNvbGxlY3Rpb25OYW1lXSB8fCB7fSlbcmV2ZXJzZU1vZGVsLm5hbWVdIHx8IHt9O1xuICAgICAgICBPYmplY3Qua2V5cyhleGlzdGluZ1JldmVyc2VJbnN0YW5jZXMpLmZvckVhY2goZnVuY3Rpb24obG9jYWxJZCkge1xuICAgICAgICAgIHZhciBpbnN0YW5jY2UgPSBleGlzdGluZ1JldmVyc2VJbnN0YW5jZXNbbG9jYWxJZF07XG4gICAgICAgICAgdmFyIHIgPSB1dGlsLmV4dGVuZCh7fSwgcmVsYXRpb25zaGlwKTtcbiAgICAgICAgICByLmlzUmV2ZXJzZSA9IHRydWU7XG4gICAgICAgICAgdGhpcy5fZmFjdG9yeS5faW5zdGFsbFJlbGF0aW9uc2hpcChyLCBpbnN0YW5jY2UpO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZXJyO1xuICB9LFxuICAvKipcbiAgICogQ3ljbGUgdGhyb3VnaCByZWxhdGlvbnNoaXBzIGFuZCByZXBsYWNlIGFueSBwbGFjZWhvbGRlcnMgd2l0aCB0aGUgYWN0dWFsIG1vZGVscyB3aGVyZSBwb3NzaWJsZS5cbiAgICovXG4gIF9pbnN0YWxsUmV2ZXJzZVBsYWNlaG9sZGVyczogZnVuY3Rpb24oKSB7XG4gICAgZm9yICh2YXIgZm9yd2FyZE5hbWUgaW4gdGhpcy5yZWxhdGlvbnNoaXBzKSB7XG4gICAgICBpZiAodGhpcy5yZWxhdGlvbnNoaXBzLmhhc093blByb3BlcnR5KGZvcndhcmROYW1lKSkge1xuICAgICAgICB2YXIgcmVsYXRpb25zaGlwID0gdGhpcy5yZWxhdGlvbnNoaXBzW2ZvcndhcmROYW1lXTtcbiAgICAgICAgaWYgKHJlbGF0aW9uc2hpcC5yZXZlcnNlTW9kZWwuaXNQbGFjZWhvbGRlcikgdGhpcy5faW5zdGFsbFJldmVyc2UocmVsYXRpb25zaGlwKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gIGluc3RhbGxSZXZlcnNlUmVsYXRpb25zaGlwczogZnVuY3Rpb24oKSB7XG4gICAgaWYgKCF0aGlzLl9yZXZlcnNlUmVsYXRpb25zaGlwc0luc3RhbGxlZCkge1xuICAgICAgZm9yICh2YXIgZm9yd2FyZE5hbWUgaW4gdGhpcy5yZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgIGlmICh0aGlzLnJlbGF0aW9uc2hpcHMuaGFzT3duUHJvcGVydHkoZm9yd2FyZE5hbWUpKSB7XG4gICAgICAgICAgdmFyIHJlbGF0aW9uc2hpcCA9IHRoaXMucmVsYXRpb25zaGlwc1tmb3J3YXJkTmFtZV07XG4gICAgICAgICAgcmVsYXRpb25zaGlwID0gZXh0ZW5kKHRydWUsIHt9LCByZWxhdGlvbnNoaXApO1xuICAgICAgICAgIHJlbGF0aW9uc2hpcC5pc1JldmVyc2UgPSB0cnVlO1xuICAgICAgICAgIHZhciBlcnIgPSB0aGlzLl9pbnN0YWxsUmV2ZXJzZShyZWxhdGlvbnNoaXApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLl9yZXZlcnNlUmVsYXRpb25zaGlwc0luc3RhbGxlZCA9IHRydWU7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ1JldmVyc2UgcmVsYXRpb25zaGlwcyBmb3IgXCInICsgdGhpcy5uYW1lICsgJ1wiIGhhdmUgYWxyZWFkeSBiZWVuIGluc3RhbGxlZC4nKTtcbiAgICB9XG4gICAgcmV0dXJuIGVycjtcbiAgfSxcbiAgX3F1ZXJ5OiBmdW5jdGlvbihxdWVyeSkge1xuICAgIHJldHVybiBuZXcgUXVlcnkodGhpcywgcXVlcnkgfHwge30pO1xuICB9LFxuICBxdWVyeTogZnVuY3Rpb24ocXVlcnksIGNiKSB7XG4gICAgdmFyIHF1ZXJ5SW5zdGFuY2U7XG4gICAgdmFyIHByb21pc2UgPSB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICBpZiAoIXRoaXMuc2luZ2xldG9uKSB7XG4gICAgICAgIHF1ZXJ5SW5zdGFuY2UgPSB0aGlzLl9xdWVyeShxdWVyeSk7XG4gICAgICAgIHJldHVybiBxdWVyeUluc3RhbmNlLmV4ZWN1dGUoY2IpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHF1ZXJ5SW5zdGFuY2UgPSB0aGlzLl9xdWVyeSh7X19pZ25vcmVJbnN0YWxsZWQ6IHRydWV9KTtcbiAgICAgICAgcXVlcnlJbnN0YW5jZS5leGVjdXRlKGZ1bmN0aW9uKGVyciwgb2Jqcykge1xuICAgICAgICAgIGlmIChlcnIpIGNiKGVycik7XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAvLyBDYWNoZSBhIG5ldyBzaW5nbGV0b24gYW5kIHRoZW4gcmVleGVjdXRlIHRoZSBxdWVyeVxuICAgICAgICAgICAgcXVlcnkgPSB1dGlsLmV4dGVuZCh7fSwgcXVlcnkpO1xuICAgICAgICAgICAgcXVlcnkuX19pZ25vcmVJbnN0YWxsZWQgPSB0cnVlO1xuICAgICAgICAgICAgaWYgKCFvYmpzLmxlbmd0aCkge1xuICAgICAgICAgICAgICB0aGlzLmdyYXBoKHt9LCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgcXVlcnlJbnN0YW5jZSA9IHRoaXMuX3F1ZXJ5KHF1ZXJ5KTtcbiAgICAgICAgICAgICAgICAgIHF1ZXJ5SW5zdGFuY2UuZXhlY3V0ZShjYik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgY2IoZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgcXVlcnlJbnN0YW5jZSA9IHRoaXMuX3F1ZXJ5KHF1ZXJ5KTtcbiAgICAgICAgICAgICAgcXVlcnlJbnN0YW5jZS5leGVjdXRlKGNiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcblxuICAgIC8vIEJ5IHdyYXBwaW5nIHRoZSBwcm9taXNlIGluIGFub3RoZXIgcHJvbWlzZSB3ZSBjYW4gcHVzaCB0aGUgaW52b2NhdGlvbnMgdG8gdGhlIGJvdHRvbSBvZiB0aGUgZXZlbnQgbG9vcCBzbyB0aGF0XG4gICAgLy8gYW55IGV2ZW50IGhhbmRsZXJzIGFkZGVkIHRvIHRoZSBjaGFpbiBhcmUgaG9ub3VyZWQgc3RyYWlnaHQgYXdheS5cbiAgICB2YXIgbGlua1Byb21pc2UgPSBuZXcgdXRpbC5Qcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgcHJvbWlzZS50aGVuKGFyZ3NhcnJheShmdW5jdGlvbihhcmdzKSB7XG4gICAgICAgIHNldEltbWVkaWF0ZShmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXNvbHZlLmFwcGx5KG51bGwsIGFyZ3MpO1xuICAgICAgICB9KTtcbiAgICAgIH0pLCBhcmdzYXJyYXkoZnVuY3Rpb24oYXJncykge1xuICAgICAgICBzZXRJbW1lZGlhdGUoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmVqZWN0LmFwcGx5KG51bGwsIGFyZ3MpO1xuICAgICAgICB9KVxuICAgICAgfSkpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHRoaXMuX2xpbmsoe1xuICAgICAgdGhlbjogbGlua1Byb21pc2UudGhlbi5iaW5kKGxpbmtQcm9taXNlKSxcbiAgICAgIGNhdGNoOiBsaW5rUHJvbWlzZS5jYXRjaC5iaW5kKGxpbmtQcm9taXNlKSxcbiAgICAgIG9uOiBhcmdzYXJyYXkoZnVuY3Rpb24oYXJncykge1xuICAgICAgICB2YXIgcnEgPSBuZXcgUmVhY3RpdmVRdWVyeSh0aGlzLl9xdWVyeShxdWVyeSkpO1xuICAgICAgICBycS5pbml0KCk7XG4gICAgICAgIHJxLm9uLmFwcGx5KHJxLCBhcmdzKTtcbiAgICAgIH0uYmluZCh0aGlzKSlcbiAgICB9KTtcbiAgfSxcbiAgLyoqXG4gICAqIE9ubHkgdXNlZCBpbiB0ZXN0aW5nIGF0IHRoZSBtb21lbnQuXG4gICAqIEBwYXJhbSBxdWVyeVxuICAgKiBAcmV0dXJucyB7UmVhY3RpdmVRdWVyeX1cbiAgICovXG4gIF9yZWFjdGl2ZVF1ZXJ5OiBmdW5jdGlvbihxdWVyeSkge1xuICAgIHJldHVybiBuZXcgUmVhY3RpdmVRdWVyeShuZXcgUXVlcnkodGhpcywgcXVlcnkgfHwge30pKTtcbiAgfSxcbiAgb25lOiBmdW5jdGlvbihvcHRzLCBjYikge1xuICAgIGlmICh0eXBlb2Ygb3B0cyA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICBjYiA9IG9wdHM7XG4gICAgICBvcHRzID0ge307XG4gICAgfVxuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICB0aGlzLnF1ZXJ5KG9wdHMsIGZ1bmN0aW9uKGVyciwgcmVzKSB7XG4gICAgICAgIGlmIChlcnIpIGNiKGVycik7XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGlmIChyZXMubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgY2IoZXJyb3IoJ01vcmUgdGhhbiBvbmUgaW5zdGFuY2UgcmV0dXJuZWQgd2hlbiBleGVjdXRpbmcgZ2V0IHF1ZXJ5IScpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXMgPSByZXMubGVuZ3RoID8gcmVzWzBdIDogbnVsbDtcbiAgICAgICAgICAgIGNiKG51bGwsIHJlcyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9LmJpbmQodGhpcykpO1xuICB9LFxuICBhbGw6IGZ1bmN0aW9uKHEsIGNiKSB7XG4gICAgaWYgKHR5cGVvZiBxID09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNiID0gcTtcbiAgICAgIHEgPSB7fTtcbiAgICB9XG4gICAgcSA9IHEgfHwge307XG4gICAgdmFyIHF1ZXJ5ID0ge307XG4gICAgaWYgKHEuX19vcmRlcikgcXVlcnkuX19vcmRlciA9IHEuX19vcmRlcjtcbiAgICByZXR1cm4gdGhpcy5xdWVyeShxLCBjYik7XG4gIH0sXG4gIF9hdHRyaWJ1dGVEZWZpbml0aW9uV2l0aE5hbWU6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuYXR0cmlidXRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGF0dHJpYnV0ZURlZmluaXRpb24gPSB0aGlzLmF0dHJpYnV0ZXNbaV07XG4gICAgICBpZiAoYXR0cmlidXRlRGVmaW5pdGlvbi5uYW1lID09IG5hbWUpIHJldHVybiBhdHRyaWJ1dGVEZWZpbml0aW9uO1xuICAgIH1cbiAgfSxcbiAgLyoqXG4gICAqIE1hcCBkYXRhIGludG8gU2llc3RhLlxuICAgKlxuICAgKiBAcGFyYW0gZGF0YSBSYXcgZGF0YSByZWNlaXZlZCByZW1vdGVseSBvciBvdGhlcndpc2VcbiAgICogQHBhcmFtIHtmdW5jdGlvbnxvYmplY3R9IFtvcHRzXVxuICAgKiBAcGFyYW0ge2Jvb2xlYW59IG9wdHMub3ZlcnJpZGVcbiAgICogQHBhcmFtIHtib29sZWFufSBvcHRzLl9pZ25vcmVJbnN0YWxsZWQgLSBBIGhhY2sgdGhhdCBhbGxvd3MgbWFwcGluZyBvbnRvIE1vZGVscyBldmVuIGlmIGluc3RhbGwgcHJvY2VzcyBoYXMgbm90IGZpbmlzaGVkLlxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBbY2JdIENhbGxlZCBvbmNlIHBvdWNoIHBlcnNpc3RlbmNlIHJldHVybnMuXG4gICAqL1xuICBncmFwaDogZnVuY3Rpb24oZGF0YSwgb3B0cywgY2IpIHtcbiAgICBpZiAodHlwZW9mIG9wdHMgPT0gJ2Z1bmN0aW9uJykgY2IgPSBvcHRzO1xuICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICB2YXIgX21hcCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgb3ZlcnJpZGVzID0gb3B0cy5vdmVycmlkZTtcbiAgICAgICAgaWYgKG92ZXJyaWRlcykge1xuICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkob3ZlcnJpZGVzKSkgb3B0cy5vYmplY3RzID0gb3ZlcnJpZGVzO1xuICAgICAgICAgIGVsc2Ugb3B0cy5vYmplY3RzID0gW292ZXJyaWRlc107XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlIG9wdHMub3ZlcnJpZGU7XG4gICAgICAgIGlmICh1dGlsLmlzQXJyYXkoZGF0YSkpIHtcbiAgICAgICAgICB0aGlzLl9tYXBCdWxrKGRhdGEsIG9wdHMsIGNiKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLl9tYXBCdWxrKFtkYXRhXSwgb3B0cywgZnVuY3Rpb24oZXJyLCBvYmplY3RzKSB7XG4gICAgICAgICAgICB2YXIgb2JqO1xuICAgICAgICAgICAgaWYgKG9iamVjdHMpIHtcbiAgICAgICAgICAgICAgaWYgKG9iamVjdHMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgb2JqID0gb2JqZWN0c1swXTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZXJyID0gZXJyID8gKHV0aWwuaXNBcnJheShkYXRhKSA/IGVyciA6ICh1dGlsLmlzQXJyYXkoZXJyKSA/IGVyclswXSA6IGVycikpIDogbnVsbDtcbiAgICAgICAgICAgIGNiKGVyciwgb2JqKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgaWYgKG9wdHMuX2lnbm9yZUluc3RhbGxlZCkge1xuICAgICAgICBfbWFwKCk7XG4gICAgICB9XG4gICAgICBlbHNlIHNpZXN0YS5fYWZ0ZXJJbnN0YWxsKF9tYXApO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gIH0sXG4gIF9tYXBCdWxrOiBmdW5jdGlvbihkYXRhLCBvcHRzLCBjYWxsYmFjaykge1xuICAgIHV0aWwuZXh0ZW5kKG9wdHMsIHttb2RlbDogdGhpcywgZGF0YTogZGF0YX0pO1xuICAgIHZhciBvcCA9IG5ldyBNYXBwaW5nT3BlcmF0aW9uKG9wdHMpO1xuICAgIG9wLnN0YXJ0KGZ1bmN0aW9uKGVyciwgb2JqZWN0cykge1xuICAgICAgaWYgKGVycikge1xuICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGVycik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjYWxsYmFjayhudWxsLCBvYmplY3RzIHx8IFtdKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSxcbiAgX2NvdW50Q2FjaGU6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBjb2xsQ2FjaGUgPSBjYWNoZS5fbG9jYWxDYWNoZUJ5VHlwZVt0aGlzLmNvbGxlY3Rpb25OYW1lXSB8fCB7fTtcbiAgICB2YXIgbW9kZWxDYWNoZSA9IGNvbGxDYWNoZVt0aGlzLm5hbWVdIHx8IHt9O1xuICAgIHJldHVybiBPYmplY3Qua2V5cyhtb2RlbENhY2hlKS5yZWR1Y2UoZnVuY3Rpb24obSwgbG9jYWxJZCkge1xuICAgICAgbVtsb2NhbElkXSA9IHt9O1xuICAgICAgcmV0dXJuIG07XG4gICAgfSwge30pO1xuICB9LFxuICBjb3VudDogZnVuY3Rpb24oY2IpIHtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgY2IobnVsbCwgT2JqZWN0LmtleXModGhpcy5fY291bnRDYWNoZSgpKS5sZW5ndGgpO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gIH0sXG4gIF9kdW1wOiBmdW5jdGlvbihhc0pTT04pIHtcbiAgICB2YXIgZHVtcGVkID0ge307XG4gICAgZHVtcGVkLm5hbWUgPSB0aGlzLm5hbWU7XG4gICAgZHVtcGVkLmF0dHJpYnV0ZXMgPSB0aGlzLmF0dHJpYnV0ZXM7XG4gICAgZHVtcGVkLmlkID0gdGhpcy5pZDtcbiAgICBkdW1wZWQuY29sbGVjdGlvbiA9IHRoaXMuY29sbGVjdGlvbk5hbWU7XG4gICAgZHVtcGVkLnJlbGF0aW9uc2hpcHMgPSB0aGlzLnJlbGF0aW9uc2hpcHMubWFwKGZ1bmN0aW9uKHIpIHtcbiAgICAgIHJldHVybiByLmlzRm9yd2FyZCA/IHIuZm9yd2FyZE5hbWUgOiByLnJldmVyc2VOYW1lO1xuICAgIH0pO1xuICAgIHJldHVybiBhc0pTT04gPyB1dGlsLnByZXR0eVByaW50KGR1bXBlZCkgOiBkdW1wZWQ7XG4gIH0sXG4gIHRvU3RyaW5nOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gJ01vZGVsWycgKyB0aGlzLm5hbWUgKyAnXSc7XG4gIH0sXG4gIHJlbW92ZUFsbDogZnVuY3Rpb24oY2IpIHtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgdGhpcy5hbGwoKVxuICAgICAgICAudGhlbihmdW5jdGlvbihpbnN0YW5jZXMpIHtcbiAgICAgICAgICBpbnN0YW5jZXMucmVtb3ZlKCk7XG4gICAgICAgICAgY2IoKTtcbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKGNiKTtcbiAgICB9LmJpbmQodGhpcykpO1xuICB9XG5cbn0pO1xuXG4vLyBTdWJjbGFzc2luZ1xudXRpbC5leHRlbmQoTW9kZWwucHJvdG90eXBlLCB7XG4gIGNoaWxkOiBmdW5jdGlvbihuYW1lT3JPcHRzLCBvcHRzKSB7XG4gICAgaWYgKHR5cGVvZiBuYW1lT3JPcHRzID09ICdzdHJpbmcnKSB7XG4gICAgICBvcHRzLm5hbWUgPSBuYW1lT3JPcHRzO1xuICAgIH0gZWxzZSB7XG4gICAgICBvcHRzID0gbmFtZTtcbiAgICB9XG4gICAgdXRpbC5leHRlbmQob3B0cywge1xuICAgICAgYXR0cmlidXRlczogQXJyYXkucHJvdG90eXBlLmNvbmNhdC5jYWxsKG9wdHMuYXR0cmlidXRlcyB8fCBbXSwgdGhpcy5fb3B0cy5hdHRyaWJ1dGVzKSxcbiAgICAgIHJlbGF0aW9uc2hpcHM6IHV0aWwuZXh0ZW5kKG9wdHMucmVsYXRpb25zaGlwcyB8fCB7fSwgdGhpcy5fb3B0cy5yZWxhdGlvbnNoaXBzKSxcbiAgICAgIG1ldGhvZHM6IHV0aWwuZXh0ZW5kKHV0aWwuZXh0ZW5kKHt9LCB0aGlzLl9vcHRzLm1ldGhvZHMpIHx8IHt9LCBvcHRzLm1ldGhvZHMpLFxuICAgICAgc3RhdGljczogdXRpbC5leHRlbmQodXRpbC5leHRlbmQoe30sIHRoaXMuX29wdHMuc3RhdGljcykgfHwge30sIG9wdHMuc3RhdGljcyksXG4gICAgICBwcm9wZXJ0aWVzOiB1dGlsLmV4dGVuZCh1dGlsLmV4dGVuZCh7fSwgdGhpcy5fb3B0cy5wcm9wZXJ0aWVzKSB8fCB7fSwgb3B0cy5wcm9wZXJ0aWVzKSxcbiAgICAgIGlkOiBvcHRzLmlkIHx8IHRoaXMuX29wdHMuaWQsXG4gICAgICBpbml0OiBvcHRzLmluaXQgfHwgdGhpcy5fb3B0cy5pbml0LFxuICAgICAgcmVtb3ZlOiBvcHRzLnJlbW92ZSB8fCB0aGlzLl9vcHRzLnJlbW92ZSxcbiAgICAgIHNlcmlhbGlzZTogb3B0cy5zZXJpYWxpc2UgfHwgdGhpcy5fb3B0cy5zZXJpYWxpc2UsXG4gICAgICBzZXJpYWxpc2VGaWVsZDogb3B0cy5zZXJpYWxpc2VGaWVsZCB8fCB0aGlzLl9vcHRzLnNlcmlhbGlzZUZpZWxkLFxuICAgICAgcGFyc2VBdHRyaWJ1dGU6IG9wdHMucGFyc2VBdHRyaWJ1dGUgfHwgdGhpcy5fb3B0cy5wYXJzZUF0dHJpYnV0ZVxuICAgIH0pO1xuXG4gICAgaWYgKHRoaXMuX29wdHMuc2VyaWFsaXNhYmxlRmllbGRzKSB7XG4gICAgICBvcHRzLnNlcmlhbGlzYWJsZUZpZWxkcyA9IEFycmF5LnByb3RvdHlwZS5jb25jYXQuYXBwbHkob3B0cy5zZXJpYWxpc2FibGVGaWVsZHMgfHwgW10sIHRoaXMuX29wdHMuc2VyaWFsaXNhYmxlRmllbGRzKTtcbiAgICB9XG5cbiAgICB2YXIgbW9kZWwgPSB0aGlzLmNvbGxlY3Rpb24ubW9kZWwob3B0cy5uYW1lLCBvcHRzKTtcbiAgICBtb2RlbC5wYXJlbnQgPSB0aGlzO1xuICAgIHRoaXMuY2hpbGRyZW4ucHVzaChtb2RlbCk7XG4gICAgcmV0dXJuIG1vZGVsO1xuICB9LFxuICBpc0NoaWxkT2Y6IGZ1bmN0aW9uKHBhcmVudCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudCA9PSBwYXJlbnQ7XG4gIH0sXG4gIGlzUGFyZW50T2Y6IGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgcmV0dXJuIHRoaXMuY2hpbGRyZW4uaW5kZXhPZihjaGlsZCkgPiAtMTtcbiAgfSxcbiAgaXNEZXNjZW5kYW50T2Y6IGZ1bmN0aW9uKGFuY2VzdG9yKSB7XG4gICAgdmFyIHBhcmVudCA9IHRoaXMucGFyZW50O1xuICAgIHdoaWxlIChwYXJlbnQpIHtcbiAgICAgIGlmIChwYXJlbnQgPT0gYW5jZXN0b3IpIHJldHVybiB0cnVlO1xuICAgICAgcGFyZW50ID0gcGFyZW50LnBhcmVudDtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9LFxuICBpc0FuY2VzdG9yT2Y6IGZ1bmN0aW9uKGRlc2NlbmRhbnQpIHtcbiAgICByZXR1cm4gdGhpcy5kZXNjZW5kYW50cy5pbmRleE9mKGRlc2NlbmRhbnQpID4gLTE7XG4gIH0sXG4gIGhhc0F0dHJpYnV0ZU5hbWVkOiBmdW5jdGlvbihhdHRyaWJ1dGVOYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMuX2F0dHJpYnV0ZU5hbWVzLmluZGV4T2YoYXR0cmlidXRlTmFtZSkgPiAtMTtcbiAgfVxufSk7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBNb2RlbDtcblxuXG5cbi8qKiBXRUJQQUNLIEZPT1RFUiAqKlxuICoqIC4vY29yZS9tb2RlbC5qc1xuICoqLyIsInZhciBuZXh0VGljayA9IHJlcXVpcmUoJ3Byb2Nlc3MvYnJvd3Nlci5qcycpLm5leHRUaWNrO1xudmFyIGFwcGx5ID0gRnVuY3Rpb24ucHJvdG90eXBlLmFwcGx5O1xudmFyIHNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlO1xudmFyIGltbWVkaWF0ZUlkcyA9IHt9O1xudmFyIG5leHRJbW1lZGlhdGVJZCA9IDA7XG5cbi8vIERPTSBBUElzLCBmb3IgY29tcGxldGVuZXNzXG5cbmV4cG9ydHMuc2V0VGltZW91dCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gbmV3IFRpbWVvdXQoYXBwbHkuY2FsbChzZXRUaW1lb3V0LCB3aW5kb3csIGFyZ3VtZW50cyksIGNsZWFyVGltZW91dCk7XG59O1xuZXhwb3J0cy5zZXRJbnRlcnZhbCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gbmV3IFRpbWVvdXQoYXBwbHkuY2FsbChzZXRJbnRlcnZhbCwgd2luZG93LCBhcmd1bWVudHMpLCBjbGVhckludGVydmFsKTtcbn07XG5leHBvcnRzLmNsZWFyVGltZW91dCA9XG5leHBvcnRzLmNsZWFySW50ZXJ2YWwgPSBmdW5jdGlvbih0aW1lb3V0KSB7IHRpbWVvdXQuY2xvc2UoKTsgfTtcblxuZnVuY3Rpb24gVGltZW91dChpZCwgY2xlYXJGbikge1xuICB0aGlzLl9pZCA9IGlkO1xuICB0aGlzLl9jbGVhckZuID0gY2xlYXJGbjtcbn1cblRpbWVvdXQucHJvdG90eXBlLnVucmVmID0gVGltZW91dC5wcm90b3R5cGUucmVmID0gZnVuY3Rpb24oKSB7fTtcblRpbWVvdXQucHJvdG90eXBlLmNsb3NlID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuX2NsZWFyRm4uY2FsbCh3aW5kb3csIHRoaXMuX2lkKTtcbn07XG5cbi8vIERvZXMgbm90IHN0YXJ0IHRoZSB0aW1lLCBqdXN0IHNldHMgdXAgdGhlIG1lbWJlcnMgbmVlZGVkLlxuZXhwb3J0cy5lbnJvbGwgPSBmdW5jdGlvbihpdGVtLCBtc2Vjcykge1xuICBjbGVhclRpbWVvdXQoaXRlbS5faWRsZVRpbWVvdXRJZCk7XG4gIGl0ZW0uX2lkbGVUaW1lb3V0ID0gbXNlY3M7XG59O1xuXG5leHBvcnRzLnVuZW5yb2xsID0gZnVuY3Rpb24oaXRlbSkge1xuICBjbGVhclRpbWVvdXQoaXRlbS5faWRsZVRpbWVvdXRJZCk7XG4gIGl0ZW0uX2lkbGVUaW1lb3V0ID0gLTE7XG59O1xuXG5leHBvcnRzLl91bnJlZkFjdGl2ZSA9IGV4cG9ydHMuYWN0aXZlID0gZnVuY3Rpb24oaXRlbSkge1xuICBjbGVhclRpbWVvdXQoaXRlbS5faWRsZVRpbWVvdXRJZCk7XG5cbiAgdmFyIG1zZWNzID0gaXRlbS5faWRsZVRpbWVvdXQ7XG4gIGlmIChtc2VjcyA+PSAwKSB7XG4gICAgaXRlbS5faWRsZVRpbWVvdXRJZCA9IHNldFRpbWVvdXQoZnVuY3Rpb24gb25UaW1lb3V0KCkge1xuICAgICAgaWYgKGl0ZW0uX29uVGltZW91dClcbiAgICAgICAgaXRlbS5fb25UaW1lb3V0KCk7XG4gICAgfSwgbXNlY3MpO1xuICB9XG59O1xuXG4vLyBUaGF0J3Mgbm90IGhvdyBub2RlLmpzIGltcGxlbWVudHMgaXQgYnV0IHRoZSBleHBvc2VkIGFwaSBpcyB0aGUgc2FtZS5cbmV4cG9ydHMuc2V0SW1tZWRpYXRlID0gdHlwZW9mIHNldEltbWVkaWF0ZSA9PT0gXCJmdW5jdGlvblwiID8gc2V0SW1tZWRpYXRlIDogZnVuY3Rpb24oZm4pIHtcbiAgdmFyIGlkID0gbmV4dEltbWVkaWF0ZUlkKys7XG4gIHZhciBhcmdzID0gYXJndW1lbnRzLmxlbmd0aCA8IDIgPyBmYWxzZSA6IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcblxuICBpbW1lZGlhdGVJZHNbaWRdID0gdHJ1ZTtcblxuICBuZXh0VGljayhmdW5jdGlvbiBvbk5leHRUaWNrKCkge1xuICAgIGlmIChpbW1lZGlhdGVJZHNbaWRdKSB7XG4gICAgICAvLyBmbi5jYWxsKCkgaXMgZmFzdGVyIHNvIHdlIG9wdGltaXplIGZvciB0aGUgY29tbW9uIHVzZS1jYXNlXG4gICAgICAvLyBAc2VlIGh0dHA6Ly9qc3BlcmYuY29tL2NhbGwtYXBwbHktc2VndVxuICAgICAgaWYgKGFyZ3MpIHtcbiAgICAgICAgZm4uYXBwbHkobnVsbCwgYXJncyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmbi5jYWxsKG51bGwpO1xuICAgICAgfVxuICAgICAgLy8gUHJldmVudCBpZHMgZnJvbSBsZWFraW5nXG4gICAgICBleHBvcnRzLmNsZWFySW1tZWRpYXRlKGlkKTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBpZDtcbn07XG5cbmV4cG9ydHMuY2xlYXJJbW1lZGlhdGUgPSB0eXBlb2YgY2xlYXJJbW1lZGlhdGUgPT09IFwiZnVuY3Rpb25cIiA/IGNsZWFySW1tZWRpYXRlIDogZnVuY3Rpb24oaWQpIHtcbiAgZGVsZXRlIGltbWVkaWF0ZUlkc1tpZF07XG59O1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9+L3RpbWVycy1icm93c2VyaWZ5L21haW4uanNcbiAqKiBtb2R1bGUgaWQgPSAxNlxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG5cbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHNldFRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZHJhaW5RdWV1ZSwgMCk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG5cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vfi90aW1lcnMtYnJvd3NlcmlmeS9+L3Byb2Nlc3MvYnJvd3Nlci5qc1xuICoqIG1vZHVsZSBpZCA9IDE3XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJtb2R1bGUuZXhwb3J0cyA9IHtcbiAgT25lVG9NYW55OiAnT25lVG9NYW55JyxcbiAgT25lVG9PbmU6ICdPbmVUb09uZScsXG4gIE1hbnlUb01hbnk6ICdNYW55VG9NYW55J1xufTtcblxuXG4vKiogV0VCUEFDSyBGT09URVIgKipcbiAqKiAuL2NvcmUvUmVsYXRpb25zaGlwVHlwZS5qc1xuICoqLyIsInZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpKCdxdWVyeScpLFxuICBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKSxcbiAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICBlcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKSxcbiAgTW9kZWxJbnN0YW5jZSA9IHJlcXVpcmUoJy4vTW9kZWxJbnN0YW5jZScpLFxuICBjb25zdHJ1Y3RRdWVyeVNldCA9IHJlcXVpcmUoJy4vUXVlcnlTZXQnKTtcblxuLyoqXG4gKiBAY2xhc3MgW1F1ZXJ5IGRlc2NyaXB0aW9uXVxuICogQHBhcmFtIHtNb2RlbH0gbW9kZWxcbiAqIEBwYXJhbSB7T2JqZWN0fSBxdWVyeVxuICovXG5mdW5jdGlvbiBRdWVyeShtb2RlbCwgcXVlcnkpIHtcbiAgdmFyIG9wdHMgPSB7fTtcbiAgZm9yICh2YXIgcHJvcCBpbiBxdWVyeSkge1xuICAgIGlmIChxdWVyeS5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgaWYgKHByb3Auc2xpY2UoMCwgMikgPT0gJ19fJykge1xuICAgICAgICBvcHRzW3Byb3Auc2xpY2UoMildID0gcXVlcnlbcHJvcF07XG4gICAgICAgIGRlbGV0ZSBxdWVyeVtwcm9wXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgdXRpbC5leHRlbmQodGhpcywge1xuICAgIG1vZGVsOiBtb2RlbCxcbiAgICBxdWVyeTogcXVlcnksXG4gICAgb3B0czogb3B0c1xuICB9KTtcbiAgb3B0cy5vcmRlciA9IG9wdHMub3JkZXIgfHwgW107XG4gIGlmICghdXRpbC5pc0FycmF5KG9wdHMub3JkZXIpKSBvcHRzLm9yZGVyID0gW29wdHMub3JkZXJdO1xufVxuXG5mdW5jdGlvbiB2YWx1ZUFzU3RyaW5nKGZpZWxkVmFsdWUpIHtcbiAgdmFyIGZpZWxkQXNTdHJpbmc7XG4gIGlmIChmaWVsZFZhbHVlID09PSBudWxsKSBmaWVsZEFzU3RyaW5nID0gJ251bGwnO1xuICBlbHNlIGlmIChmaWVsZFZhbHVlID09PSB1bmRlZmluZWQpIGZpZWxkQXNTdHJpbmcgPSAndW5kZWZpbmVkJztcbiAgZWxzZSBpZiAoZmllbGRWYWx1ZSBpbnN0YW5jZW9mIE1vZGVsSW5zdGFuY2UpIGZpZWxkQXNTdHJpbmcgPSBmaWVsZFZhbHVlLmxvY2FsSWQ7XG4gIGVsc2UgZmllbGRBc1N0cmluZyA9IGZpZWxkVmFsdWUudG9TdHJpbmcoKTtcbiAgcmV0dXJuIGZpZWxkQXNTdHJpbmc7XG59XG5cbmZ1bmN0aW9uIGNvbnRhaW5zKG9wdHMpIHtcbiAgaWYgKCFvcHRzLmludmFsaWQpIHtcbiAgICB2YXIgb2JqID0gb3B0cy5vYmplY3Q7XG4gICAgaWYgKHV0aWwuaXNBcnJheShvYmopKSB7XG4gICAgICBhcnIgPSB1dGlsLnBsdWNrKG9iaiwgb3B0cy5maWVsZCk7XG4gICAgfVxuICAgIGVsc2VcbiAgICAgIHZhciBhcnIgPSBvYmpbb3B0cy5maWVsZF07XG4gICAgaWYgKHV0aWwuaXNBcnJheShhcnIpIHx8IHV0aWwuaXNTdHJpbmcoYXJyKSkge1xuICAgICAgcmV0dXJuIGFyci5pbmRleE9mKG9wdHMudmFsdWUpID4gLTE7XG4gICAgfVxuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxudmFyIGNvbXBhcmF0b3JzID0ge1xuICBlOiBmdW5jdGlvbihvcHRzKSB7XG4gICAgdmFyIGZpZWxkVmFsdWUgPSBvcHRzLm9iamVjdFtvcHRzLmZpZWxkXTtcbiAgICBpZiAobG9nLmVuYWJsZWQpIHtcbiAgICAgIGxvZyhvcHRzLmZpZWxkICsgJzogJyArIHZhbHVlQXNTdHJpbmcoZmllbGRWYWx1ZSkgKyAnID09ICcgKyB2YWx1ZUFzU3RyaW5nKG9wdHMudmFsdWUpLCB7b3B0czogb3B0c30pO1xuICAgIH1cbiAgICByZXR1cm4gZmllbGRWYWx1ZSA9PSBvcHRzLnZhbHVlO1xuICB9LFxuICBsdDogZnVuY3Rpb24ob3B0cykge1xuICAgIGlmICghb3B0cy5pbnZhbGlkKSByZXR1cm4gb3B0cy5vYmplY3Rbb3B0cy5maWVsZF0gPCBvcHRzLnZhbHVlO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfSxcbiAgZ3Q6IGZ1bmN0aW9uKG9wdHMpIHtcbiAgICBpZiAoIW9wdHMuaW52YWxpZCkgcmV0dXJuIG9wdHMub2JqZWN0W29wdHMuZmllbGRdID4gb3B0cy52YWx1ZTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH0sXG4gIGx0ZTogZnVuY3Rpb24ob3B0cykge1xuICAgIGlmICghb3B0cy5pbnZhbGlkKSByZXR1cm4gb3B0cy5vYmplY3Rbb3B0cy5maWVsZF0gPD0gb3B0cy52YWx1ZTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH0sXG4gIGd0ZTogZnVuY3Rpb24ob3B0cykge1xuICAgIGlmICghb3B0cy5pbnZhbGlkKSByZXR1cm4gb3B0cy5vYmplY3Rbb3B0cy5maWVsZF0gPj0gb3B0cy52YWx1ZTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH0sXG4gIGNvbnRhaW5zOiBjb250YWlucyxcbiAgaW46IGNvbnRhaW5zXG59O1xuXG51dGlsLmV4dGVuZChRdWVyeSwge1xuICBjb21wYXJhdG9yczogY29tcGFyYXRvcnMsXG4gIHJlZ2lzdGVyQ29tcGFyYXRvcjogZnVuY3Rpb24oc3ltYm9sLCBmbikge1xuICAgIGlmICghY29tcGFyYXRvcnNbc3ltYm9sXSkge1xuICAgICAgY29tcGFyYXRvcnNbc3ltYm9sXSA9IGZuO1xuICAgIH1cbiAgfVxufSk7XG5cbmZ1bmN0aW9uIGNhY2hlRm9yTW9kZWwobW9kZWwpIHtcbiAgdmFyIGNhY2hlQnlUeXBlID0gY2FjaGUuX2xvY2FsQ2FjaGVCeVR5cGU7XG4gIHZhciBtb2RlbE5hbWUgPSBtb2RlbC5uYW1lO1xuICB2YXIgY29sbGVjdGlvbk5hbWUgPSBtb2RlbC5jb2xsZWN0aW9uTmFtZTtcbiAgdmFyIGNhY2hlQnlNb2RlbCA9IGNhY2hlQnlUeXBlW2NvbGxlY3Rpb25OYW1lXTtcbiAgdmFyIGNhY2hlQnlMb2NhbElkO1xuICBpZiAoY2FjaGVCeU1vZGVsKSB7XG4gICAgY2FjaGVCeUxvY2FsSWQgPSBjYWNoZUJ5TW9kZWxbbW9kZWxOYW1lXSB8fCB7fTtcbiAgfVxuICByZXR1cm4gY2FjaGVCeUxvY2FsSWQ7XG59XG5cbnV0aWwuZXh0ZW5kKFF1ZXJ5LnByb3RvdHlwZSwge1xuICBleGVjdXRlOiBmdW5jdGlvbihjYikge1xuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICB0aGlzLl9leGVjdXRlSW5NZW1vcnkoY2IpO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gIH0sXG4gIF9kdW1wOiBmdW5jdGlvbihhc0pzb24pIHtcbiAgICByZXR1cm4gYXNKc29uID8gJ3t9JyA6IHt9O1xuICB9LFxuICBzb3J0RnVuYzogZnVuY3Rpb24oZmllbGRzKSB7XG4gICAgdmFyIHNvcnRGdW5jID0gZnVuY3Rpb24oYXNjZW5kaW5nLCBmaWVsZCkge1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uKHYxLCB2Mikge1xuICAgICAgICB2YXIgZDEgPSB2MVtmaWVsZF0sXG4gICAgICAgICAgZDIgPSB2MltmaWVsZF0sXG4gICAgICAgICAgcmVzO1xuICAgICAgICBpZiAodHlwZW9mIGQxID09ICdzdHJpbmcnIHx8IGQxIGluc3RhbmNlb2YgU3RyaW5nICYmXG4gICAgICAgICAgdHlwZW9mIGQyID09ICdzdHJpbmcnIHx8IGQyIGluc3RhbmNlb2YgU3RyaW5nKSB7XG4gICAgICAgICAgcmVzID0gYXNjZW5kaW5nID8gZDEubG9jYWxlQ29tcGFyZShkMikgOiBkMi5sb2NhbGVDb21wYXJlKGQxKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBpZiAoZDEgaW5zdGFuY2VvZiBEYXRlKSBkMSA9IGQxLmdldFRpbWUoKTtcbiAgICAgICAgICBpZiAoZDIgaW5zdGFuY2VvZiBEYXRlKSBkMiA9IGQyLmdldFRpbWUoKTtcbiAgICAgICAgICBpZiAoYXNjZW5kaW5nKSByZXMgPSBkMSAtIGQyO1xuICAgICAgICAgIGVsc2UgcmVzID0gZDIgLSBkMTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzO1xuICAgICAgfVxuICAgIH07XG4gICAgdmFyIHMgPSB1dGlsO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZmllbGRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgZmllbGQgPSBmaWVsZHNbaV07XG4gICAgICBzID0gcy50aGVuQnkoc29ydEZ1bmMoZmllbGQuYXNjZW5kaW5nLCBmaWVsZC5maWVsZCkpO1xuICAgIH1cbiAgICByZXR1cm4gcyA9PSB1dGlsID8gbnVsbCA6IHM7XG4gIH0sXG4gIF9zb3J0UmVzdWx0czogZnVuY3Rpb24ocmVzKSB7XG4gICAgdmFyIG9yZGVyID0gdGhpcy5vcHRzLm9yZGVyO1xuICAgIGlmIChyZXMgJiYgb3JkZXIpIHtcbiAgICAgIHZhciBmaWVsZHMgPSBvcmRlci5tYXAoZnVuY3Rpb24ob3JkZXJpbmcpIHtcbiAgICAgICAgdmFyIHNwbHQgPSBvcmRlcmluZy5zcGxpdCgnLScpLFxuICAgICAgICAgIGFzY2VuZGluZyA9IHRydWUsXG4gICAgICAgICAgZmllbGQgPSBudWxsO1xuICAgICAgICBpZiAoc3BsdC5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgZmllbGQgPSBzcGx0WzFdO1xuICAgICAgICAgIGFzY2VuZGluZyA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGZpZWxkID0gc3BsdFswXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4ge2ZpZWxkOiBmaWVsZCwgYXNjZW5kaW5nOiBhc2NlbmRpbmd9O1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgIHZhciBzb3J0RnVuYyA9IHRoaXMuc29ydEZ1bmMoZmllbGRzKTtcbiAgICAgIGlmIChyZXMuaW1tdXRhYmxlKSByZXMgPSByZXMubXV0YWJsZUNvcHkoKTtcbiAgICAgIGlmIChzb3J0RnVuYykgcmVzLnNvcnQoc29ydEZ1bmMpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzO1xuICB9LFxuICAvKipcbiAgICogUmV0dXJuIGFsbCBtb2RlbCBpbnN0YW5jZXMgaW4gdGhlIGNhY2hlLlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2dldENhY2hlQnlMb2NhbElkOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5kZXNjZW5kYW50cy5yZWR1Y2UoZnVuY3Rpb24obWVtbywgY2hpbGRNb2RlbCkge1xuICAgICAgcmV0dXJuIHV0aWwuZXh0ZW5kKG1lbW8sIGNhY2hlRm9yTW9kZWwoY2hpbGRNb2RlbCkpO1xuICAgIH0sIHV0aWwuZXh0ZW5kKHt9LCBjYWNoZUZvck1vZGVsKHRoaXMubW9kZWwpKSk7XG4gIH0sXG4gIF9leGVjdXRlSW5NZW1vcnk6IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgdmFyIF9leGVjdXRlSW5NZW1vcnkgPSBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMubW9kZWxcbiAgICAgICAgLl9pbmRleElzSW5zdGFsbGVkXG4gICAgICAgIC50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBjYWNoZUJ5TG9jYWxJZCA9IHRoaXMuX2dldENhY2hlQnlMb2NhbElkKCk7XG4gICAgICAgICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhjYWNoZUJ5TG9jYWxJZCk7XG4gICAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAgIHZhciByZXMgPSBbXTtcbiAgICAgICAgICB2YXIgZXJyO1xuICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIGsgPSBrZXlzW2ldO1xuICAgICAgICAgICAgdmFyIG9iaiA9IGNhY2hlQnlMb2NhbElkW2tdO1xuICAgICAgICAgICAgdmFyIG1hdGNoZXMgPSBzZWxmLm9iamVjdE1hdGNoZXNRdWVyeShvYmopO1xuICAgICAgICAgICAgaWYgKHR5cGVvZihtYXRjaGVzKSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICBlcnIgPSBlcnJvcihtYXRjaGVzKTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBpZiAobWF0Y2hlcykgcmVzLnB1c2gob2JqKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgcmVzID0gdGhpcy5fc29ydFJlc3VsdHMocmVzKTtcbiAgICAgICAgICBpZiAoZXJyKSBsb2coJ0Vycm9yIGV4ZWN1dGluZyBxdWVyeScsIGVycik7XG4gICAgICAgICAgY2FsbGJhY2soZXJyLCBlcnIgPyBudWxsIDogY29uc3RydWN0UXVlcnlTZXQocmVzLCB0aGlzLm1vZGVsKSk7XG4gICAgICAgIH0uYmluZCh0aGlzKSlcbiAgICAgICAgLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgIHZhciBfZXJyID0gJ1VuYWJsZSB0byBleGVjdXRlIHF1ZXJ5IGR1ZSB0byBmYWlsZWQgaW5kZXggaW5zdGFsbGF0aW9uIG9uIE1vZGVsIFwiJyArXG4gICAgICAgICAgICB0aGlzLm1vZGVsLm5hbWUgKyAnXCInO1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoX2VyciwgZXJyKTtcbiAgICAgICAgICBjYWxsYmFjayhfZXJyKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9LmJpbmQodGhpcyk7XG4gICAgaWYgKHRoaXMub3B0cy5pZ25vcmVJbnN0YWxsZWQpIHtcbiAgICAgIF9leGVjdXRlSW5NZW1vcnkoKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBzaWVzdGEuX2FmdGVySW5zdGFsbChfZXhlY3V0ZUluTWVtb3J5KTtcbiAgICB9XG4gIH0sXG4gIGNsZWFyT3JkZXJpbmc6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMub3B0cy5vcmRlciA9IG51bGw7XG4gIH0sXG4gIG9iamVjdE1hdGNoZXNPclF1ZXJ5OiBmdW5jdGlvbihvYmosIG9yUXVlcnkpIHtcbiAgICBmb3IgKHZhciBpZHggaW4gb3JRdWVyeSkge1xuICAgICAgaWYgKG9yUXVlcnkuaGFzT3duUHJvcGVydHkoaWR4KSkge1xuICAgICAgICB2YXIgcXVlcnkgPSBvclF1ZXJ5W2lkeF07XG4gICAgICAgIGlmICh0aGlzLm9iamVjdE1hdGNoZXNCYXNlUXVlcnkob2JqLCBxdWVyeSkpIHtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH0sXG4gIG9iamVjdE1hdGNoZXNBbmRRdWVyeTogZnVuY3Rpb24ob2JqLCBhbmRRdWVyeSkge1xuICAgIGZvciAodmFyIGlkeCBpbiBhbmRRdWVyeSkge1xuICAgICAgaWYgKGFuZFF1ZXJ5Lmhhc093blByb3BlcnR5KGlkeCkpIHtcbiAgICAgICAgdmFyIHF1ZXJ5ID0gYW5kUXVlcnlbaWR4XTtcbiAgICAgICAgaWYgKCF0aGlzLm9iamVjdE1hdGNoZXNCYXNlUXVlcnkob2JqLCBxdWVyeSkpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH0sXG4gIHNwbGl0TWF0Y2hlczogZnVuY3Rpb24ob2JqLCB1bnByb2Nlc3NlZEZpZWxkLCB2YWx1ZSkge1xuICAgIHZhciBvcCA9ICdlJztcbiAgICB2YXIgZmllbGRzID0gdW5wcm9jZXNzZWRGaWVsZC5zcGxpdCgnLicpO1xuICAgIHZhciBzcGx0ID0gZmllbGRzW2ZpZWxkcy5sZW5ndGggLSAxXS5zcGxpdCgnX18nKTtcbiAgICBpZiAoc3BsdC5sZW5ndGggPT0gMikge1xuICAgICAgdmFyIGZpZWxkID0gc3BsdFswXTtcbiAgICAgIG9wID0gc3BsdFsxXTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBmaWVsZCA9IHNwbHRbMF07XG4gICAgfVxuICAgIGZpZWxkc1tmaWVsZHMubGVuZ3RoIC0gMV0gPSBmaWVsZDtcbiAgICBmaWVsZHMuc2xpY2UoMCwgZmllbGRzLmxlbmd0aCAtIDEpLmZvckVhY2goZnVuY3Rpb24oZikge1xuICAgICAgaWYgKHV0aWwuaXNBcnJheShvYmopKSB7XG4gICAgICAgIG9iaiA9IHV0aWwucGx1Y2sob2JqLCBmKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBvYmogPSBvYmpbZl07XG4gICAgICB9XG4gICAgfSk7XG4gICAgLy8gSWYgd2UgZ2V0IHRvIHRoZSBwb2ludCB3aGVyZSB3ZSdyZSBhYm91dCB0byBpbmRleCBudWxsIG9yIHVuZGVmaW5lZCB3ZSBzdG9wIC0gb2J2aW91c2x5IHRoaXMgb2JqZWN0IGRvZXNcbiAgICAvLyBub3QgbWF0Y2ggdGhlIHF1ZXJ5LlxuICAgIHZhciBub3ROdWxsT3JVbmRlZmluZWQgPSBvYmogIT0gdW5kZWZpbmVkO1xuICAgIGlmIChub3ROdWxsT3JVbmRlZmluZWQpIHtcbiAgICAgIGlmICh1dGlsLmlzQXJyYXkob2JqKSkge1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHZhciB2YWwgPSBvYmpbZmllbGRdO1xuICAgICAgICB2YXIgaW52YWxpZCA9IHV0aWwuaXNBcnJheSh2YWwpID8gZmFsc2UgOiB2YWwgPT09IG51bGwgfHwgdmFsID09PSB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgICB2YXIgY29tcGFyYXRvciA9IFF1ZXJ5LmNvbXBhcmF0b3JzW29wXSxcbiAgICAgICAgb3B0cyA9IHtvYmplY3Q6IG9iaiwgZmllbGQ6IGZpZWxkLCB2YWx1ZTogdmFsdWUsIGludmFsaWQ6IGludmFsaWR9O1xuICAgICAgaWYgKCFjb21wYXJhdG9yKSB7XG4gICAgICAgIHJldHVybiAnTm8gY29tcGFyYXRvciByZWdpc3RlcmVkIGZvciBxdWVyeSBvcGVyYXRpb24gXCInICsgb3AgKyAnXCInO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGNvbXBhcmF0b3Iob3B0cyk7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfSxcbiAgb2JqZWN0TWF0Y2hlczogZnVuY3Rpb24ob2JqLCB1bnByb2Nlc3NlZEZpZWxkLCB2YWx1ZSwgcXVlcnkpIHtcbiAgICBpZiAodW5wcm9jZXNzZWRGaWVsZCA9PSAnJG9yJykge1xuICAgICAgdmFyICRvciA9IHF1ZXJ5Wyckb3InXTtcbiAgICAgIGlmICghdXRpbC5pc0FycmF5KCRvcikpIHtcbiAgICAgICAgJG9yID0gT2JqZWN0LmtleXMoJG9yKS5tYXAoZnVuY3Rpb24oaykge1xuICAgICAgICAgIHZhciBub3JtYWxpc2VkID0ge307XG4gICAgICAgICAgbm9ybWFsaXNlZFtrXSA9ICRvcltrXTtcbiAgICAgICAgICByZXR1cm4gbm9ybWFsaXNlZDtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBpZiAoIXRoaXMub2JqZWN0TWF0Y2hlc09yUXVlcnkob2JqLCAkb3IpKSByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGVsc2UgaWYgKHVucHJvY2Vzc2VkRmllbGQgPT0gJyRhbmQnKSB7XG4gICAgICBpZiAoIXRoaXMub2JqZWN0TWF0Y2hlc0FuZFF1ZXJ5KG9iaiwgcXVlcnlbJyRhbmQnXSkpIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICB2YXIgbWF0Y2hlcyA9IHRoaXMuc3BsaXRNYXRjaGVzKG9iaiwgdW5wcm9jZXNzZWRGaWVsZCwgdmFsdWUpO1xuICAgICAgaWYgKHR5cGVvZiBtYXRjaGVzICE9ICdib29sZWFuJykgcmV0dXJuIG1hdGNoZXM7XG4gICAgICBpZiAoIW1hdGNoZXMpIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH0sXG4gIG9iamVjdE1hdGNoZXNCYXNlUXVlcnk6IGZ1bmN0aW9uKG9iaiwgcXVlcnkpIHtcbiAgICB2YXIgZmllbGRzID0gT2JqZWN0LmtleXMocXVlcnkpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZmllbGRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgdW5wcm9jZXNzZWRGaWVsZCA9IGZpZWxkc1tpXSxcbiAgICAgICAgdmFsdWUgPSBxdWVyeVt1bnByb2Nlc3NlZEZpZWxkXTtcbiAgICAgIHZhciBydCA9IHRoaXMub2JqZWN0TWF0Y2hlcyhvYmosIHVucHJvY2Vzc2VkRmllbGQsIHZhbHVlLCBxdWVyeSk7XG4gICAgICBpZiAodHlwZW9mIHJ0ICE9ICdib29sZWFuJykgcmV0dXJuIHJ0O1xuICAgICAgaWYgKCFydCkgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSxcbiAgb2JqZWN0TWF0Y2hlc1F1ZXJ5OiBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gdGhpcy5vYmplY3RNYXRjaGVzQmFzZVF1ZXJ5KG9iaiwgdGhpcy5xdWVyeSk7XG4gIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFF1ZXJ5O1xuXG5cbi8qKiBXRUJQQUNLIEZPT1RFUiAqKlxuICoqIC4vY29yZS9RdWVyeS5qc1xuICoqLyIsIi8qKlxuICogVGhpcyBpcyBhbiBpbi1tZW1vcnkgY2FjaGUgZm9yIG1vZGVscy4gTW9kZWxzIGFyZSBjYWNoZWQgYnkgbG9jYWwgaWQgKF9pZCkgYW5kIHJlbW90ZSBpZCAoZGVmaW5lZCBieSB0aGUgbWFwcGluZykuXG4gKiBMb29rdXBzIGFyZSBwZXJmb3JtZWQgYWdhaW5zdCB0aGUgY2FjaGUgd2hlbiBtYXBwaW5nLlxuICogQG1vZHVsZSBjYWNoZVxuICovXG52YXIgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSgnY2FjaGUnKSxcbiAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XG5cblxuZnVuY3Rpb24gQ2FjaGUoKSB7XG4gIHRoaXMucmVzZXQoKTtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdfbG9jYWxDYWNoZUJ5VHlwZScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMubG9jYWw7XG4gICAgfVxuICB9KTtcbn1cblxuQ2FjaGUucHJvdG90eXBlID0ge1xuICByZXNldDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5yZW1vdGUgPSB7fTtcbiAgICB0aGlzLmxvY2FsQnlJZCA9IHt9O1xuICAgIHRoaXMubG9jYWwgPSB7fTtcbiAgfSxcbiAgLyoqXG4gICAqIFJldHVybiB0aGUgb2JqZWN0IGluIHRoZSBjYWNoZSBnaXZlbiBhIGxvY2FsIGlkIChfaWQpXG4gICAqIEBwYXJhbSAge1N0cmluZ3xBcnJheX0gbG9jYWxJZFxuICAgKiBAcmV0dXJuIHtNb2RlbEluc3RhbmNlfVxuICAgKi9cbiAgZ2V0VmlhTG9jYWxJZDogZnVuY3Rpb24gZ2V0VmlhTG9jYWxJZChsb2NhbElkKSB7XG4gICAgaWYgKHV0aWwuaXNBcnJheShsb2NhbElkKSkgcmV0dXJuIGxvY2FsSWQubWFwKGZ1bmN0aW9uKHgpIHtyZXR1cm4gdGhpcy5sb2NhbEJ5SWRbeF19LmJpbmQodGhpcykpO1xuICAgIGVsc2UgcmV0dXJuIHRoaXMubG9jYWxCeUlkW2xvY2FsSWRdO1xuICB9LFxuICAvKipcbiAgICogR2l2ZW4gYSByZW1vdGUgaWRlbnRpZmllciBhbmQgYW4gb3B0aW9ucyBvYmplY3QgdGhhdCBkZXNjcmliZXMgbWFwcGluZy9jb2xsZWN0aW9uLFxuICAgKiByZXR1cm4gdGhlIG1vZGVsIGlmIGNhY2hlZC5cbiAgICogQHBhcmFtICB7U3RyaW5nfEFycmF5fSByZW1vdGVJZFxuICAgKiBAcGFyYW0gIHtPYmplY3R9IG9wdHNcbiAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRzLm1vZGVsXG4gICAqIEByZXR1cm4ge01vZGVsSW5zdGFuY2V9XG4gICAqL1xuICBnZXRWaWFSZW1vdGVJZDogZnVuY3Rpb24ocmVtb3RlSWQsIG9wdHMpIHtcbiAgICB2YXIgYyA9ICh0aGlzLnJlbW90ZVtvcHRzLm1vZGVsLmNvbGxlY3Rpb25OYW1lXSB8fCB7fSlbb3B0cy5tb2RlbC5uYW1lXSB8fCB7fTtcbiAgICByZXR1cm4gdXRpbC5pc0FycmF5KHJlbW90ZUlkKSA/IHJlbW90ZUlkLm1hcChmdW5jdGlvbih4KSB7cmV0dXJuIGNbeF19KSA6IGNbcmVtb3RlSWRdO1xuICB9LFxuICAvKipcbiAgICogUmV0dXJuIHRoZSBzaW5nbGV0b24gb2JqZWN0IGdpdmVuIGEgc2luZ2xldG9uIG1vZGVsLlxuICAgKiBAcGFyYW0gIHtNb2RlbH0gbW9kZWxcbiAgICogQHJldHVybiB7TW9kZWxJbnN0YW5jZX1cbiAgICovXG4gIGdldFNpbmdsZXRvbjogZnVuY3Rpb24obW9kZWwpIHtcbiAgICB2YXIgbW9kZWxOYW1lID0gbW9kZWwubmFtZTtcbiAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBtb2RlbC5jb2xsZWN0aW9uTmFtZTtcbiAgICB2YXIgY29sbGVjdGlvbkNhY2hlID0gdGhpcy5sb2NhbFtjb2xsZWN0aW9uTmFtZV07XG4gICAgaWYgKGNvbGxlY3Rpb25DYWNoZSkge1xuICAgICAgdmFyIHR5cGVDYWNoZSA9IGNvbGxlY3Rpb25DYWNoZVttb2RlbE5hbWVdO1xuICAgICAgaWYgKHR5cGVDYWNoZSkge1xuICAgICAgICB2YXIgb2JqcyA9IFtdO1xuICAgICAgICBmb3IgKHZhciBwcm9wIGluIHR5cGVDYWNoZSkge1xuICAgICAgICAgIGlmICh0eXBlQ2FjaGUuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgICAgIG9ianMucHVzaCh0eXBlQ2FjaGVbcHJvcF0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAob2Jqcy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgdmFyIGVyclN0ciA9ICdBIHNpbmdsZXRvbiBtb2RlbCBoYXMgbW9yZSB0aGFuIDEgb2JqZWN0IGluIHRoZSBjYWNoZSEgVGhpcyBpcyBhIHNlcmlvdXMgZXJyb3IuICcgK1xuICAgICAgICAgICAgJ0VpdGhlciBhIG1vZGVsIGhhcyBiZWVuIG1vZGlmaWVkIGFmdGVyIG9iamVjdHMgaGF2ZSBhbHJlYWR5IGJlZW4gY3JlYXRlZCwgb3Igc29tZXRoaW5nIGhhcyBnb25lJyArXG4gICAgICAgICAgICAndmVyeSB3cm9uZy4gUGxlYXNlIGZpbGUgYSBidWcgcmVwb3J0IGlmIHRoZSBsYXR0ZXIuJztcbiAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihlcnJTdHIpO1xuICAgICAgICB9IGVsc2UgaWYgKG9ianMubGVuZ3RoKSB7XG4gICAgICAgICAgcmV0dXJuIG9ianNbMF07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH0sXG4gIC8qKlxuICAgKiBJbnNlcnQgYW4gb2JqZWN0IGludG8gdGhlIGNhY2hlIHVzaW5nIGEgcmVtb3RlIGlkZW50aWZpZXIgZGVmaW5lZCBieSB0aGUgbWFwcGluZy5cbiAgICogQHBhcmFtICB7TW9kZWxJbnN0YW5jZX0gb2JqXG4gICAqIEBwYXJhbSAge1N0cmluZ30gcmVtb3RlSWRcbiAgICogQHBhcmFtICB7U3RyaW5nfSBbcHJldmlvdXNSZW1vdGVJZF0gSWYgcmVtb3RlIGlkIGhhcyBiZWVuIGNoYW5nZWQsIHRoaXMgaXMgdGhlIG9sZCByZW1vdGUgaWRlbnRpZmllclxuICAgKi9cbiAgcmVtb3RlSW5zZXJ0OiBmdW5jdGlvbihvYmosIHJlbW90ZUlkLCBwcmV2aW91c1JlbW90ZUlkKSB7XG4gICAgaWYgKG9iaikge1xuICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gb2JqLm1vZGVsLmNvbGxlY3Rpb25OYW1lO1xuICAgICAgaWYgKGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgICAgIGlmICghdGhpcy5yZW1vdGVbY29sbGVjdGlvbk5hbWVdKSB7XG4gICAgICAgICAgdGhpcy5yZW1vdGVbY29sbGVjdGlvbk5hbWVdID0ge307XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHR5cGUgPSBvYmoubW9kZWwubmFtZTtcbiAgICAgICAgaWYgKHR5cGUpIHtcbiAgICAgICAgICBpZiAoIXRoaXMucmVtb3RlW2NvbGxlY3Rpb25OYW1lXVt0eXBlXSkge1xuICAgICAgICAgICAgdGhpcy5yZW1vdGVbY29sbGVjdGlvbk5hbWVdW3R5cGVdID0ge307XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChwcmV2aW91c1JlbW90ZUlkKSB7XG4gICAgICAgICAgICB0aGlzLnJlbW90ZVtjb2xsZWN0aW9uTmFtZV1bdHlwZV1bcHJldmlvdXNSZW1vdGVJZF0gPSBudWxsO1xuICAgICAgICAgIH1cbiAgICAgICAgICB2YXIgY2FjaGVkT2JqZWN0ID0gdGhpcy5yZW1vdGVbY29sbGVjdGlvbk5hbWVdW3R5cGVdW3JlbW90ZUlkXTtcbiAgICAgICAgICBpZiAoIWNhY2hlZE9iamVjdCkge1xuICAgICAgICAgICAgdGhpcy5yZW1vdGVbY29sbGVjdGlvbk5hbWVdW3R5cGVdW3JlbW90ZUlkXSA9IG9iajtcbiAgICAgICAgICAgIGxvZygnUmVtb3RlIGNhY2hlIGluc2VydDogJyArIG9iai5fZHVtcCh0cnVlKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFNvbWV0aGluZyBoYXMgZ29uZSByZWFsbHkgd3JvbmcuIE9ubHkgb25lIG9iamVjdCBmb3IgYSBwYXJ0aWN1bGFyIGNvbGxlY3Rpb24vdHlwZS9yZW1vdGVpZCBjb21ib1xuICAgICAgICAgICAgLy8gc2hvdWxkIGV2ZXIgZXhpc3QuXG4gICAgICAgICAgICBpZiAob2JqICE9IGNhY2hlZE9iamVjdCkge1xuICAgICAgICAgICAgICB2YXIgbWVzc2FnZSA9ICdPYmplY3QgJyArIGNvbGxlY3Rpb25OYW1lLnRvU3RyaW5nKCkgKyAnOicgKyB0eXBlLnRvU3RyaW5nKCkgKyAnWycgKyBvYmoubW9kZWwuaWQgKyAnPVwiJyArIHJlbW90ZUlkICsgJ1wiXSBhbHJlYWR5IGV4aXN0cyBpbiB0aGUgY2FjaGUuJyArXG4gICAgICAgICAgICAgICAgJyBUaGlzIGlzIGEgc2VyaW91cyBlcnJvciwgcGxlYXNlIGZpbGUgYSBidWcgcmVwb3J0IGlmIHlvdSBhcmUgZXhwZXJpZW5jaW5nIHRoaXMgb3V0IGluIHRoZSB3aWxkJztcbiAgICAgICAgICAgICAgbG9nKG1lc3NhZ2UsIHtcbiAgICAgICAgICAgICAgICBvYmo6IG9iaixcbiAgICAgICAgICAgICAgICBjYWNoZWRPYmplY3Q6IGNhY2hlZE9iamVjdFxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IobWVzc2FnZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNb2RlbCBoYXMgbm8gdHlwZScsIHtcbiAgICAgICAgICAgIG1vZGVsOiBvYmoubW9kZWwsXG4gICAgICAgICAgICBvYmo6IG9ialxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTW9kZWwgaGFzIG5vIGNvbGxlY3Rpb24nLCB7XG4gICAgICAgICAgbW9kZWw6IG9iai5tb2RlbCxcbiAgICAgICAgICBvYmo6IG9ialxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIG1zZyA9ICdNdXN0IHBhc3MgYW4gb2JqZWN0IHdoZW4gaW5zZXJ0aW5nIHRvIGNhY2hlJztcbiAgICAgIGxvZyhtc2cpO1xuICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IobXNnKTtcbiAgICB9XG4gIH0sXG4gIC8qKlxuICAgKiBRdWVyeSB0aGUgY2FjaGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRzIE9iamVjdCBkZXNjcmliaW5nIHRoZSBxdWVyeVxuICAgKiBAcmV0dXJuIHtNb2RlbEluc3RhbmNlfVxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBqc1xuICAgKiBjYWNoZS5nZXQoe19pZDogJzUnfSk7IC8vIFF1ZXJ5IGJ5IGxvY2FsIGlkXG4gICAqIGNhY2hlLmdldCh7cmVtb3RlSWQ6ICc1JywgbWFwcGluZzogbXlNYXBwaW5nfSk7IC8vIFF1ZXJ5IGJ5IHJlbW90ZSBpZFxuICAgKiBgYGBcbiAgICovXG4gIGdldDogZnVuY3Rpb24ob3B0cykge1xuICAgIGxvZygnZ2V0Jywgb3B0cyk7XG4gICAgdmFyIG9iaiwgaWRGaWVsZCwgcmVtb3RlSWQ7XG4gICAgdmFyIGxvY2FsSWQgPSBvcHRzLmxvY2FsSWQ7XG4gICAgaWYgKGxvY2FsSWQpIHtcbiAgICAgIG9iaiA9IHRoaXMuZ2V0VmlhTG9jYWxJZChsb2NhbElkKTtcbiAgICAgIGlmIChvYmopIHtcbiAgICAgICAgcmV0dXJuIG9iajtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChvcHRzLm1vZGVsKSB7XG4gICAgICAgICAgaWRGaWVsZCA9IG9wdHMubW9kZWwuaWQ7XG4gICAgICAgICAgcmVtb3RlSWQgPSBvcHRzW2lkRmllbGRdO1xuICAgICAgICAgIGxvZyhpZEZpZWxkICsgJz0nICsgcmVtb3RlSWQpO1xuICAgICAgICAgIHJldHVybiB0aGlzLmdldFZpYVJlbW90ZUlkKHJlbW90ZUlkLCBvcHRzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAob3B0cy5tb2RlbCkge1xuICAgICAgaWRGaWVsZCA9IG9wdHMubW9kZWwuaWQ7XG4gICAgICByZW1vdGVJZCA9IG9wdHNbaWRGaWVsZF07XG4gICAgICBpZiAocmVtb3RlSWQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0VmlhUmVtb3RlSWQocmVtb3RlSWQsIG9wdHMpO1xuICAgICAgfSBlbHNlIGlmIChvcHRzLm1vZGVsLnNpbmdsZXRvbikge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRTaW5nbGV0b24ob3B0cy5tb2RlbCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvZygnSW52YWxpZCBvcHRzIHRvIGNhY2hlJywge1xuICAgICAgICBvcHRzOiBvcHRzXG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH0sXG4gIF9yZW1vdGVDYWNoZTogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMucmVtb3RlXG4gIH0sXG4gIF9sb2NhbENhY2hlOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5sb2NhbEJ5SWQ7XG4gIH0sXG4gIC8qKlxuICAgKiBJbnNlcnQgYW4gb2JqZWN0IGludG8gdGhlIGNhY2hlLlxuICAgKiBAcGFyYW0gIHtNb2RlbEluc3RhbmNlfSBvYmpcbiAgICogQHRocm93cyB7SW50ZXJuYWxTaWVzdGFFcnJvcn0gQW4gb2JqZWN0IHdpdGggX2lkL3JlbW90ZUlkIGFscmVhZHkgZXhpc3RzLiBOb3QgdGhyb3duIGlmIHNhbWUgb2JoZWN0LlxuICAgKi9cbiAgaW5zZXJ0OiBmdW5jdGlvbihvYmopIHtcbiAgICB2YXIgbG9jYWxJZCA9IG9iai5sb2NhbElkO1xuICAgIGlmIChsb2NhbElkKSB7XG4gICAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBvYmoubW9kZWwuY29sbGVjdGlvbk5hbWU7XG4gICAgICB2YXIgbW9kZWxOYW1lID0gb2JqLm1vZGVsLm5hbWU7XG4gICAgICBpZiAoIXRoaXMubG9jYWxCeUlkW2xvY2FsSWRdKSB7XG4gICAgICAgIHRoaXMubG9jYWxCeUlkW2xvY2FsSWRdID0gb2JqO1xuICAgICAgICBpZiAoIXRoaXMubG9jYWxbY29sbGVjdGlvbk5hbWVdKSB0aGlzLmxvY2FsW2NvbGxlY3Rpb25OYW1lXSA9IHt9O1xuICAgICAgICBpZiAoIXRoaXMubG9jYWxbY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV0pIHRoaXMubG9jYWxbY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV0gPSB7fTtcbiAgICAgICAgdGhpcy5sb2NhbFtjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXVtsb2NhbElkXSA9IG9iajtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFNvbWV0aGluZyBoYXMgZ29uZSBiYWRseSB3cm9uZyBoZXJlLiBUd28gb2JqZWN0cyBzaG91bGQgbmV2ZXIgZXhpc3Qgd2l0aCB0aGUgc2FtZSBfaWRcbiAgICAgICAgaWYgKHRoaXMubG9jYWxCeUlkW2xvY2FsSWRdICE9IG9iaikge1xuICAgICAgICAgIHZhciBtZXNzYWdlID0gJ09iamVjdCB3aXRoIGxvY2FsSWQ9XCInICsgbG9jYWxJZC50b1N0cmluZygpICsgJ1wiIGlzIGFscmVhZHkgaW4gdGhlIGNhY2hlLiAnICtcbiAgICAgICAgICAgICdUaGlzIGlzIGEgc2VyaW91cyBlcnJvci4gUGxlYXNlIGZpbGUgYSBidWcgcmVwb3J0IGlmIHlvdSBhcmUgZXhwZXJpZW5jaW5nIHRoaXMgb3V0IGluIHRoZSB3aWxkJztcbiAgICAgICAgICBsb2cobWVzc2FnZSk7XG4gICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IobWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdmFyIGlkRmllbGQgPSBvYmouaWRGaWVsZDtcbiAgICB2YXIgcmVtb3RlSWQgPSBvYmpbaWRGaWVsZF07XG4gICAgaWYgKHJlbW90ZUlkKSB7XG4gICAgICB0aGlzLnJlbW90ZUluc2VydChvYmosIHJlbW90ZUlkKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbG9nKCdObyByZW1vdGUgaWQgKFwiJyArIGlkRmllbGQgKyAnXCIpIHNvIHdvbnQgYmUgcGxhY2luZyBpbiB0aGUgcmVtb3RlIGNhY2hlJywgb2JqKTtcbiAgICB9XG4gIH0sXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRydWUgaWYgb2JqZWN0IGlzIGluIHRoZSBjYWNoZVxuICAgKiBAcGFyYW0gIHtNb2RlbEluc3RhbmNlfSBvYmpcbiAgICogQHJldHVybiB7Ym9vbGVhbn1cbiAgICovXG4gIGNvbnRhaW5zOiBmdW5jdGlvbihvYmopIHtcbiAgICB2YXIgcSA9IHtcbiAgICAgIGxvY2FsSWQ6IG9iai5sb2NhbElkXG4gICAgfTtcbiAgICB2YXIgbW9kZWwgPSBvYmoubW9kZWw7XG4gICAgaWYgKG1vZGVsLmlkKSB7XG4gICAgICBpZiAob2JqW21vZGVsLmlkXSkge1xuICAgICAgICBxLm1vZGVsID0gbW9kZWw7XG4gICAgICAgIHFbbW9kZWwuaWRdID0gb2JqW21vZGVsLmlkXTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuICEhdGhpcy5nZXQocSk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFJlbW92ZXMgdGhlIG9iamVjdCBmcm9tIHRoZSBjYWNoZSAoaWYgaXQncyBhY3R1YWxseSBpbiB0aGUgY2FjaGUpIG90aGVyd2lzZXMgdGhyb3dzIGFuIGVycm9yLlxuICAgKiBAcGFyYW0gIHtNb2RlbEluc3RhbmNlfSBvYmpcbiAgICogQHRocm93cyB7SW50ZXJuYWxTaWVzdGFFcnJvcn0gSWYgb2JqZWN0IGFscmVhZHkgaW4gdGhlIGNhY2hlLlxuICAgKi9cbiAgcmVtb3ZlOiBmdW5jdGlvbihvYmopIHtcbiAgICBpZiAodGhpcy5jb250YWlucyhvYmopKSB7XG4gICAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBvYmoubW9kZWwuY29sbGVjdGlvbk5hbWU7XG4gICAgICB2YXIgbW9kZWxOYW1lID0gb2JqLm1vZGVsLm5hbWU7XG4gICAgICB2YXIgbG9jYWxJZCA9IG9iai5sb2NhbElkO1xuICAgICAgaWYgKCFtb2RlbE5hbWUpIHRocm93IEludGVybmFsU2llc3RhRXJyb3IoJ05vIG1hcHBpbmcgbmFtZScpO1xuICAgICAgaWYgKCFjb2xsZWN0aW9uTmFtZSkgdGhyb3cgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gY29sbGVjdGlvbiBuYW1lJyk7XG4gICAgICBpZiAoIWxvY2FsSWQpIHRocm93IEludGVybmFsU2llc3RhRXJyb3IoJ05vIGxvY2FsSWQnKTtcbiAgICAgIGRlbGV0ZSB0aGlzLmxvY2FsW2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdW2xvY2FsSWRdO1xuICAgICAgZGVsZXRlIHRoaXMubG9jYWxCeUlkW2xvY2FsSWRdO1xuICAgICAgaWYgKG9iai5tb2RlbC5pZCkge1xuICAgICAgICB2YXIgcmVtb3RlSWQgPSBvYmpbb2JqLm1vZGVsLmlkXTtcbiAgICAgICAgaWYgKHJlbW90ZUlkKSB7XG4gICAgICAgICAgZGVsZXRlIHRoaXMucmVtb3RlW2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdW3JlbW90ZUlkXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICBjb3VudDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMubG9jYWxCeUlkKS5sZW5ndGg7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gbmV3IENhY2hlKCk7XG5cblxuLyoqIFdFQlBBQ0sgRk9PVEVSICoqXG4gKiogLi9jb3JlL2NhY2hlLmpzXG4gKiovIiwidmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJyksXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgZXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJyksXG4gIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICBNb2RlbEV2ZW50VHlwZSA9IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLFxuICBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKTtcblxuZnVuY3Rpb24gTW9kZWxJbnN0YW5jZShtb2RlbCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHRoaXMubW9kZWwgPSBtb2RlbDtcblxuICB1dGlsLnN1YlByb3BlcnRpZXModGhpcywgdGhpcy5tb2RlbCwgW1xuICAgICdjb2xsZWN0aW9uJyxcbiAgICAnY29sbGVjdGlvbk5hbWUnLFxuICAgICdfYXR0cmlidXRlTmFtZXMnLFxuICAgIHtcbiAgICAgIG5hbWU6ICdpZEZpZWxkJyxcbiAgICAgIHByb3BlcnR5OiAnaWQnXG4gICAgfSxcbiAgICB7XG4gICAgICBuYW1lOiAnbW9kZWxOYW1lJyxcbiAgICAgIHByb3BlcnR5OiAnbmFtZSdcbiAgICB9XG4gIF0pO1xuXG4gIGV2ZW50cy5Qcm94eUV2ZW50RW1pdHRlci5jYWxsKHRoaXMpO1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHRoaXMsIHtcbiAgICBfcmVsYXRpb25zaGlwTmFtZXM6IHtcbiAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgcHJveGllcyA9IE9iamVjdC5rZXlzKHNlbGYuX19wcm94aWVzIHx8IHt9KS5tYXAoZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgICByZXR1cm4gc2VsZi5fX3Byb3hpZXNbeF1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBwcm94aWVzLm1hcChmdW5jdGlvbiAocCkge1xuICAgICAgICAgIGlmIChwLmlzRm9yd2FyZCkge1xuICAgICAgICAgICAgcmV0dXJuIHAuZm9yd2FyZE5hbWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBwLnJldmVyc2VOYW1lO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9LFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0sXG4gICAgLy8gVGhpcyBpcyBmb3IgUHJveHlFdmVudEVtaXR0ZXIuXG4gICAgZXZlbnQ6IHtcbiAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5sb2NhbElkXG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICB0aGlzLnJlbW92ZWQgPSBmYWxzZTtcblxuICAvKipcbiAgICogV2hldGhlciBvciBub3QgZXZlbnRzIChzZXQsIHJlbW92ZSBldGMpIGFyZSBlbWl0dGVkIGZvciB0aGlzIG1vZGVsIGluc3RhbmNlLlxuICAgKlxuICAgKiBUaGlzIGlzIHVzZWQgYXMgYSB3YXkgb2YgY29udHJvbGxpbmcgd2hhdCBldmVudHMgYXJlIGVtaXR0ZWQgd2hlbiB0aGUgbW9kZWwgaW5zdGFuY2UgaXMgY3JlYXRlZC4gRS5nLiB3ZSBkb24ndFxuICAgKiB3YW50IHRvIHNlbmQgYSBtZXRyaWMgc2hpdCB0b24gb2YgJ3NldCcgZXZlbnRzIGlmIHdlJ3JlIG5ld2x5IGNyZWF0aW5nIGFuIGluc3RhbmNlLiBXZSBvbmx5IHdhbnQgdG8gc2VuZCB0aGVcbiAgICogJ25ldycgZXZlbnQgb25jZSBjb25zdHJ1Y3RlZC5cbiAgICpcbiAgICogVGhpcyBpcyBwcm9iYWJseSBhIGJpdCBvZiBhIGhhY2sgYW5kIHNob3VsZCBiZSByZW1vdmVkIGV2ZW50dWFsbHkuXG4gICAqIEB0eXBlIHtib29sZWFufVxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgdGhpcy5fZW1pdEV2ZW50cyA9IGZhbHNlO1xufVxuXG5Nb2RlbEluc3RhbmNlLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoZXZlbnRzLlByb3h5RXZlbnRFbWl0dGVyLnByb3RvdHlwZSk7XG5cbnV0aWwuZXh0ZW5kKE1vZGVsSW5zdGFuY2UucHJvdG90eXBlLCB7XG4gIGdldDogZnVuY3Rpb24gKGNiKSB7XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24gKGNiKSB7XG4gICAgICBjYihudWxsLCB0aGlzKTtcbiAgICB9LmJpbmQodGhpcykpO1xuICB9LFxuICBlbWl0OiBmdW5jdGlvbiAodHlwZSwgb3B0cykge1xuICAgIGlmICh0eXBlb2YgdHlwZSA9PSAnb2JqZWN0Jykgb3B0cyA9IHR5cGU7XG4gICAgZWxzZSBvcHRzLnR5cGUgPSB0eXBlO1xuICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgIHV0aWwuZXh0ZW5kKG9wdHMsIHtcbiAgICAgIGNvbGxlY3Rpb246IHRoaXMuY29sbGVjdGlvbk5hbWUsXG4gICAgICBtb2RlbDogdGhpcy5tb2RlbC5uYW1lLFxuICAgICAgbG9jYWxJZDogdGhpcy5sb2NhbElkLFxuICAgICAgb2JqOiB0aGlzXG4gICAgfSk7XG4gICAgbW9kZWxFdmVudHMuZW1pdChvcHRzKTtcbiAgfSxcbiAgcmVtb3ZlOiBmdW5jdGlvbiAoY2IsIG5vdGlmaWNhdGlvbikge1xuICAgIF8uZWFjaCh0aGlzLl9yZWxhdGlvbnNoaXBOYW1lcywgZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgIGlmICh1dGlsLmlzQXJyYXkodGhpc1tuYW1lXSkpIHtcbiAgICAgICAgdGhpc1tuYW1lXSA9IFtdO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHRoaXNbbmFtZV0gPSBudWxsO1xuICAgICAgfVxuICAgIH0uYmluZCh0aGlzKSk7XG4gICAgbm90aWZpY2F0aW9uID0gbm90aWZpY2F0aW9uID09IG51bGwgPyB0cnVlIDogbm90aWZpY2F0aW9uO1xuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uIChjYikge1xuICAgICAgY2FjaGUucmVtb3ZlKHRoaXMpO1xuICAgICAgdGhpcy5yZW1vdmVkID0gdHJ1ZTtcbiAgICAgIGlmIChub3RpZmljYXRpb24pIHtcbiAgICAgICAgdGhpcy5lbWl0KG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlJlbW92ZSwge1xuICAgICAgICAgIG9sZDogdGhpc1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIHZhciByZW1vdmUgPSB0aGlzLm1vZGVsLnJlbW92ZTtcbiAgICAgIGlmIChyZW1vdmUpIHtcbiAgICAgICAgdmFyIHBhcmFtTmFtZXMgPSB1dGlsLnBhcmFtTmFtZXMocmVtb3ZlKTtcbiAgICAgICAgaWYgKHBhcmFtTmFtZXMubGVuZ3RoKSB7XG4gICAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAgIHJlbW92ZS5jYWxsKHRoaXMsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGNiKGVyciwgc2VsZik7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgcmVtb3ZlLmNhbGwodGhpcyk7XG4gICAgICAgICAgY2IobnVsbCwgdGhpcyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBjYihudWxsLCB0aGlzKTtcbiAgICAgIH1cbiAgICB9LmJpbmQodGhpcykpO1xuICB9LFxufSk7XG5cbi8vIEluc3BlY3Rpb25cbnV0aWwuZXh0ZW5kKE1vZGVsSW5zdGFuY2UucHJvdG90eXBlLCB7XG4gIGdldEF0dHJpYnV0ZXM6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdXRpbC5leHRlbmQoe30sIHRoaXMuX192YWx1ZXMpO1xuICB9LFxuICBpc0luc3RhbmNlT2Y6IGZ1bmN0aW9uIChtb2RlbCkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsID09IG1vZGVsO1xuICB9LFxuICBpc0E6IGZ1bmN0aW9uIChtb2RlbCkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsID09IG1vZGVsIHx8IHRoaXMubW9kZWwuaXNEZXNjZW5kYW50T2YobW9kZWwpO1xuICB9XG59KTtcblxuLy8gRHVtcFxudXRpbC5leHRlbmQoTW9kZWxJbnN0YW5jZS5wcm90b3R5cGUsIHtcbiAgX2R1bXBTdHJpbmc6IGZ1bmN0aW9uIChyZXZlcnNlUmVsYXRpb25zaGlwcykge1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh0aGlzLl9kdW1wKHJldmVyc2VSZWxhdGlvbnNoaXBzLCBudWxsLCA0KSk7XG4gIH0sXG4gIF9kdW1wOiBmdW5jdGlvbiAocmV2ZXJzZVJlbGF0aW9uc2hpcHMpIHtcbiAgICB2YXIgZHVtcGVkID0gdXRpbC5leHRlbmQoe30sIHRoaXMuX192YWx1ZXMpO1xuICAgIGR1bXBlZC5fcmV2ID0gdGhpcy5fcmV2O1xuICAgIGR1bXBlZC5sb2NhbElkID0gdGhpcy5sb2NhbElkO1xuICAgIHJldHVybiBkdW1wZWQ7XG4gIH1cbn0pO1xuXG5mdW5jdGlvbiBkZWZhdWx0U2VyaWFsaXNlcihhdHRyTmFtZSwgdmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlO1xufVxuXG4vLyBTZXJpYWxpc2F0aW9uXG51dGlsLmV4dGVuZChNb2RlbEluc3RhbmNlLnByb3RvdHlwZSwge1xuICBfZGVmYXVsdFNlcmlhbGlzZTogZnVuY3Rpb24gKG9wdHMpIHtcbiAgICB2YXIgc2VyaWFsaXNlZCA9IHt9O1xuICAgIHZhciBpbmNsdWRlTnVsbEF0dHJpYnV0ZXMgPSBvcHRzLmluY2x1ZGVOdWxsQXR0cmlidXRlcyAhPT0gdW5kZWZpbmVkID8gb3B0cy5pbmNsdWRlTnVsbEF0dHJpYnV0ZXMgOiB0cnVlLFxuICAgICAgaW5jbHVkZU51bGxSZWxhdGlvbnNoaXBzID0gb3B0cy5pbmNsdWRlTnVsbFJlbGF0aW9uc2hpcHMgIT09IHVuZGVmaW5lZCA/IG9wdHMuaW5jbHVkZU51bGxSZWxhdGlvbnNoaXBzIDogdHJ1ZTtcbiAgICB2YXIgc2VyaWFsaXNhYmxlRmllbGRzID0gdGhpcy5tb2RlbC5zZXJpYWxpc2FibGVGaWVsZHMgfHxcbiAgICAgIHRoaXMuX2F0dHJpYnV0ZU5hbWVzLmNvbmNhdC5hcHBseSh0aGlzLl9hdHRyaWJ1dGVOYW1lcywgdGhpcy5fcmVsYXRpb25zaGlwTmFtZXMpLmNvbmNhdCh0aGlzLmlkKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGVOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uIChhdHRyTmFtZSkge1xuICAgICAgaWYgKHNlcmlhbGlzYWJsZUZpZWxkcy5pbmRleE9mKGF0dHJOYW1lKSA+IC0xKSB7XG4gICAgICAgIHZhciBhdHRyRGVmaW5pdGlvbiA9IHRoaXMubW9kZWwuX2F0dHJpYnV0ZURlZmluaXRpb25XaXRoTmFtZShhdHRyTmFtZSkgfHwge307XG4gICAgICAgIHZhciBzZXJpYWxpc2VyO1xuICAgICAgICBpZiAoYXR0ckRlZmluaXRpb24uc2VyaWFsaXNlKSBzZXJpYWxpc2VyID0gYXR0ckRlZmluaXRpb24uc2VyaWFsaXNlLmJpbmQodGhpcyk7XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIHZhciBzZXJpYWxpc2VGaWVsZCA9IHRoaXMubW9kZWwuc2VyaWFsaXNlRmllbGQgfHwgZGVmYXVsdFNlcmlhbGlzZXI7XG4gICAgICAgICAgc2VyaWFsaXNlciA9IHNlcmlhbGlzZUZpZWxkLmJpbmQodGhpcywgYXR0ck5hbWUpO1xuICAgICAgICB9XG4gICAgICAgIHZhciB2YWwgPSB0aGlzW2F0dHJOYW1lXTtcbiAgICAgICAgaWYgKHZhbCA9PT0gbnVsbCkge1xuICAgICAgICAgIGlmIChpbmNsdWRlTnVsbEF0dHJpYnV0ZXMpIHtcbiAgICAgICAgICAgIHNlcmlhbGlzZWRbYXR0ck5hbWVdID0gc2VyaWFsaXNlcih2YWwpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh2YWwgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHNlcmlhbGlzZWRbYXR0ck5hbWVdID0gc2VyaWFsaXNlcih2YWwpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgICB0aGlzLl9yZWxhdGlvbnNoaXBOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uIChyZWxOYW1lKSB7XG4gICAgICBpZiAoc2VyaWFsaXNhYmxlRmllbGRzLmluZGV4T2YocmVsTmFtZSkgPiAtMSkge1xuICAgICAgICB2YXIgdmFsID0gdGhpc1tyZWxOYW1lXSxcbiAgICAgICAgICByZWwgPSB0aGlzLm1vZGVsLnJlbGF0aW9uc2hpcHNbcmVsTmFtZV07XG5cbiAgICAgICAgaWYgKHJlbCAmJiAhcmVsLmlzUmV2ZXJzZSkge1xuICAgICAgICAgIHZhciBzZXJpYWxpc2VyO1xuICAgICAgICAgIGlmIChyZWwuc2VyaWFsaXNlKSB7XG4gICAgICAgICAgICBzZXJpYWxpc2VyID0gcmVsLnNlcmlhbGlzZS5iaW5kKHRoaXMpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHZhciBzZXJpYWxpc2VGaWVsZCA9IHRoaXMubW9kZWwuc2VyaWFsaXNlRmllbGQ7XG4gICAgICAgICAgICBpZiAoIXNlcmlhbGlzZUZpZWxkKSB7XG4gICAgICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkodmFsKSkgdmFsID0gdXRpbC5wbHVjayh2YWwsIHRoaXMubW9kZWwuaWQpO1xuICAgICAgICAgICAgICBlbHNlIGlmICh2YWwpIHZhbCA9IHZhbFt0aGlzLm1vZGVsLmlkXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHNlcmlhbGlzZUZpZWxkID0gc2VyaWFsaXNlRmllbGQgfHwgZGVmYXVsdFNlcmlhbGlzZXI7XG4gICAgICAgICAgICBzZXJpYWxpc2VyID0gc2VyaWFsaXNlRmllbGQuYmluZCh0aGlzLCByZWxOYW1lKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHZhbCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgaWYgKGluY2x1ZGVOdWxsUmVsYXRpb25zaGlwcykge1xuICAgICAgICAgICAgICBzZXJpYWxpc2VkW3JlbE5hbWVdID0gc2VyaWFsaXNlcih2YWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIGlmICh1dGlsLmlzQXJyYXkodmFsKSkge1xuICAgICAgICAgICAgaWYgKChpbmNsdWRlTnVsbFJlbGF0aW9uc2hpcHMgJiYgIXZhbC5sZW5ndGgpIHx8IHZhbC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgc2VyaWFsaXNlZFtyZWxOYW1lXSA9IHNlcmlhbGlzZXIodmFsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSBpZiAodmFsICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHNlcmlhbGlzZWRbcmVsTmFtZV0gPSBzZXJpYWxpc2VyKHZhbCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgICByZXR1cm4gc2VyaWFsaXNlZDtcbiAgfSxcbiAgc2VyaWFsaXNlOiBmdW5jdGlvbiAob3B0cykge1xuICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgIGlmICghdGhpcy5tb2RlbC5zZXJpYWxpc2UpIHJldHVybiB0aGlzLl9kZWZhdWx0U2VyaWFsaXNlKG9wdHMpO1xuICAgIGVsc2UgcmV0dXJuIHRoaXMubW9kZWwuc2VyaWFsaXNlKHRoaXMsIG9wdHMpO1xuICB9XG59KTtcblxudXRpbC5leHRlbmQoTW9kZWxJbnN0YW5jZS5wcm90b3R5cGUsIHtcbiAgLyoqXG4gICAqIEVtaXQgYW4gZXZlbnQgaW5kaWNhdGluZyB0aGF0IHRoaXMgaW5zdGFuY2UgaGFzIGp1c3QgYmVlbiBjcmVhdGVkLlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2VtaXROZXc6IGZ1bmN0aW9uICgpIHtcbiAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgIGNvbGxlY3Rpb246IHRoaXMubW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgICBtb2RlbDogdGhpcy5tb2RlbC5uYW1lLFxuICAgICAgbG9jYWxJZDogdGhpcy5sb2NhbElkLFxuICAgICAgbmV3OiB0aGlzLFxuICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuTmV3LFxuICAgICAgb2JqOiB0aGlzXG4gICAgfSk7XG4gIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE1vZGVsSW5zdGFuY2U7XG5cblxuXG4vKiogV0VCUEFDSyBGT09URVIgKipcbiAqKiAuL2NvcmUvTW9kZWxJbnN0YW5jZS5qc1xuICoqLyIsInZhciBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gIGxvZyA9IHJlcXVpcmUoJy4vbG9nJykoJ2V2ZW50cycpLFxuICBleHRlbmQgPSByZXF1aXJlKCcuL3V0aWwnKS5leHRlbmQsXG4gIGNvbGxlY3Rpb25SZWdpc3RyeSA9IHJlcXVpcmUoJy4vY29sbGVjdGlvblJlZ2lzdHJ5JykuQ29sbGVjdGlvblJlZ2lzdHJ5O1xuXG5cbi8qKlxuICogQ29uc3RhbnRzIHRoYXQgZGVzY3JpYmUgY2hhbmdlIGV2ZW50cy5cbiAqIFNldCA9PiBBIG5ldyB2YWx1ZSBpcyBhc3NpZ25lZCB0byBhbiBhdHRyaWJ1dGUvcmVsYXRpb25zaGlwXG4gKiBTcGxpY2UgPT4gQWxsIGphdmFzY3JpcHQgYXJyYXkgb3BlcmF0aW9ucyBhcmUgZGVzY3JpYmVkIGFzIHNwbGljZXMuXG4gKiBEZWxldGUgPT4gVXNlZCBpbiB0aGUgY2FzZSB3aGVyZSBvYmplY3RzIGFyZSByZW1vdmVkIGZyb20gYW4gYXJyYXksIGJ1dCBhcnJheSBvcmRlciBpcyBub3Qga25vd24gaW4gYWR2YW5jZS5cbiAqIFJlbW92ZSA9PiBPYmplY3QgZGVsZXRpb24gZXZlbnRzXG4gKiBOZXcgPT4gT2JqZWN0IGNyZWF0aW9uIGV2ZW50c1xuICogQHR5cGUge09iamVjdH1cbiAqL1xudmFyIE1vZGVsRXZlbnRUeXBlID0ge1xuICBTZXQ6ICdzZXQnLFxuICBTcGxpY2U6ICdzcGxpY2UnLFxuICBOZXc6ICduZXcnLFxuICBSZW1vdmU6ICdyZW1vdmUnXG59O1xuXG4vKipcbiAqIFJlcHJlc2VudHMgYW4gaW5kaXZpZHVhbCBjaGFuZ2UuXG4gKiBAcGFyYW0gb3B0c1xuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIE1vZGVsRXZlbnQob3B0cykge1xuICB0aGlzLl9vcHRzID0gb3B0cyB8fCB7fTtcbiAgT2JqZWN0LmtleXMob3B0cykuZm9yRWFjaChmdW5jdGlvbihrKSB7XG4gICAgdGhpc1trXSA9IG9wdHNba107XG4gIH0uYmluZCh0aGlzKSk7XG59XG5cbk1vZGVsRXZlbnQucHJvdG90eXBlLl9kdW1wID0gZnVuY3Rpb24ocHJldHR5KSB7XG4gIHZhciBkdW1wZWQgPSB7fTtcbiAgZHVtcGVkLmNvbGxlY3Rpb24gPSAodHlwZW9mIHRoaXMuY29sbGVjdGlvbikgPT0gJ3N0cmluZycgPyB0aGlzLmNvbGxlY3Rpb24gOiB0aGlzLmNvbGxlY3Rpb24uX2R1bXAoKTtcbiAgZHVtcGVkLm1vZGVsID0gKHR5cGVvZiB0aGlzLm1vZGVsKSA9PSAnc3RyaW5nJyA/IHRoaXMubW9kZWwgOiB0aGlzLm1vZGVsLm5hbWU7XG4gIGR1bXBlZC5sb2NhbElkID0gdGhpcy5sb2NhbElkO1xuICBkdW1wZWQuZmllbGQgPSB0aGlzLmZpZWxkO1xuICBkdW1wZWQudHlwZSA9IHRoaXMudHlwZTtcbiAgaWYgKHRoaXMuaW5kZXgpIGR1bXBlZC5pbmRleCA9IHRoaXMuaW5kZXg7XG4gIGlmICh0aGlzLmFkZGVkKSBkdW1wZWQuYWRkZWQgPSB0aGlzLmFkZGVkLm1hcChmdW5jdGlvbih4KSB7cmV0dXJuIHguX2R1bXAoKX0pO1xuICBpZiAodGhpcy5yZW1vdmVkKSBkdW1wZWQucmVtb3ZlZCA9IHRoaXMucmVtb3ZlZC5tYXAoZnVuY3Rpb24oeCkge3JldHVybiB4Ll9kdW1wKCl9KTtcbiAgaWYgKHRoaXMub2xkKSBkdW1wZWQub2xkID0gdGhpcy5vbGQ7XG4gIGlmICh0aGlzLm5ldykgZHVtcGVkLm5ldyA9IHRoaXMubmV3O1xuICByZXR1cm4gcHJldHR5ID8gdXRpbC5wcmV0dHlQcmludChkdW1wZWQpIDogZHVtcGVkO1xufTtcblxuZnVuY3Rpb24gYnJvYWRjYXN0RXZlbnQoY29sbGVjdGlvbk5hbWUsIG1vZGVsTmFtZSwgb3B0cykge1xuICB2YXIgZ2VuZXJpY0V2ZW50ID0gJ1NpZXN0YScsXG4gICAgY29sbGVjdGlvbiA9IGNvbGxlY3Rpb25SZWdpc3RyeVtjb2xsZWN0aW9uTmFtZV0sXG4gICAgbW9kZWwgPSBjb2xsZWN0aW9uW21vZGVsTmFtZV07XG4gIGlmICghY29sbGVjdGlvbikgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ05vIHN1Y2ggY29sbGVjdGlvbiBcIicgKyBjb2xsZWN0aW9uTmFtZSArICdcIicpO1xuICBpZiAoIW1vZGVsKSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gc3VjaCBtb2RlbCBcIicgKyBtb2RlbE5hbWUgKyAnXCInKTtcbiAgdmFyIHNob3VsZEVtaXQgPSBvcHRzLm9iai5fZW1pdEV2ZW50cztcbiAgLy8gRG9uJ3QgZW1pdCBwb2ludGxlc3MgZXZlbnRzLlxuICBpZiAoc2hvdWxkRW1pdCAmJiAnbmV3JyBpbiBvcHRzICYmICdvbGQnIGluIG9wdHMpIHtcbiAgICBpZiAob3B0cy5uZXcgaW5zdGFuY2VvZiBEYXRlICYmIG9wdHMub2xkIGluc3RhbmNlb2YgRGF0ZSkge1xuICAgICAgc2hvdWxkRW1pdCA9IG9wdHMubmV3LmdldFRpbWUoKSAhPSBvcHRzLm9sZC5nZXRUaW1lKCk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgc2hvdWxkRW1pdCA9IG9wdHMubmV3ICE9IG9wdHMub2xkO1xuICAgIH1cbiAgfVxuICBpZiAoc2hvdWxkRW1pdCkge1xuICAgIGV2ZW50cy5lbWl0KGdlbmVyaWNFdmVudCwgb3B0cyk7XG4gICAgaWYgKHNpZXN0YS5pbnN0YWxsZWQpIHtcbiAgICAgIHZhciBtb2RlbEV2ZW50ID0gY29sbGVjdGlvbk5hbWUgKyAnOicgKyBtb2RlbE5hbWUsXG4gICAgICAgIGxvY2FsSWRFdmVudCA9IG9wdHMubG9jYWxJZDtcbiAgICAgIGV2ZW50cy5lbWl0KGNvbGxlY3Rpb25OYW1lLCBvcHRzKTtcbiAgICAgIGV2ZW50cy5lbWl0KG1vZGVsRXZlbnQsIG9wdHMpO1xuICAgICAgZXZlbnRzLmVtaXQobG9jYWxJZEV2ZW50LCBvcHRzKTtcbiAgICB9XG4gICAgaWYgKG1vZGVsLmlkICYmIG9wdHMub2JqW21vZGVsLmlkXSkgZXZlbnRzLmVtaXQoY29sbGVjdGlvbk5hbWUgKyAnOicgKyBtb2RlbE5hbWUgKyAnOicgKyBvcHRzLm9ialttb2RlbC5pZF0sIG9wdHMpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHZhbGlkYXRlRXZlbnRPcHRzKG9wdHMpIHtcbiAgaWYgKCFvcHRzLm1vZGVsKSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTXVzdCBwYXNzIGEgbW9kZWwnKTtcbiAgaWYgKCFvcHRzLmNvbGxlY3Rpb24pIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNdXN0IHBhc3MgYSBjb2xsZWN0aW9uJyk7XG4gIGlmICghb3B0cy5sb2NhbElkKSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTXVzdCBwYXNzIGEgbG9jYWwgaWRlbnRpZmllcicpO1xuICBpZiAoIW9wdHMub2JqKSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTXVzdCBwYXNzIHRoZSBvYmplY3QnKTtcbn1cblxuZnVuY3Rpb24gZW1pdChvcHRzKSB7XG4gIHZhbGlkYXRlRXZlbnRPcHRzKG9wdHMpO1xuICB2YXIgY29sbGVjdGlvbiA9IG9wdHMuY29sbGVjdGlvbjtcbiAgdmFyIG1vZGVsID0gb3B0cy5tb2RlbDtcbiAgdmFyIGMgPSBuZXcgTW9kZWxFdmVudChvcHRzKTtcbiAgYnJvYWRjYXN0RXZlbnQoY29sbGVjdGlvbiwgbW9kZWwsIGMpO1xuICByZXR1cm4gYztcbn1cblxuZXh0ZW5kKGV4cG9ydHMsIHtcbiAgTW9kZWxFdmVudDogTW9kZWxFdmVudCxcbiAgZW1pdDogZW1pdCxcbiAgdmFsaWRhdGVFdmVudE9wdHM6IHZhbGlkYXRlRXZlbnRPcHRzLFxuICBNb2RlbEV2ZW50VHlwZTogTW9kZWxFdmVudFR5cGVcbn0pO1xuXG5cbi8qKiBXRUJQQUNLIEZPT1RFUiAqKlxuICoqIC4vY29yZS9tb2RlbEV2ZW50cy5qc1xuICoqLyIsInZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXIsXG4gIEFycmF5T2JzZXJ2ZXIgPSByZXF1aXJlKCcuLi92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZScpLkFycmF5T2JzZXJ2ZXIsXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgYXJnc2FycmF5ID0gcmVxdWlyZSgnYXJnc2FycmF5JyksXG4gIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICBDaGFpbiA9IHJlcXVpcmUoJy4vQ2hhaW4nKTtcblxudmFyIGV2ZW50RW1pdHRlciA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcbmV2ZW50RW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoMTAwKTtcblxuLyoqXG4gKiBMaXN0ZW4gdG8gYSBwYXJ0aWN1bGFyIGV2ZW50IGZyb20gdGhlIFNpZXN0YSBnbG9iYWwgRXZlbnRFbWl0dGVyLlxuICogTWFuYWdlcyBpdHMgb3duIHNldCBvZiBsaXN0ZW5lcnMuXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gUHJveHlFdmVudEVtaXR0ZXIoZXZlbnQsIGNoYWluT3B0cykge1xuICB1dGlsLmV4dGVuZCh0aGlzLCB7XG4gICAgZXZlbnQ6IGV2ZW50LFxuICAgIGxpc3RlbmVyczoge31cbiAgfSk7XG4gIHZhciBkZWZhdWx0Q2hhaW5PcHRzID0ge307XG5cbiAgZGVmYXVsdENoYWluT3B0cy5vbiA9IHRoaXMub24uYmluZCh0aGlzKTtcbiAgZGVmYXVsdENoYWluT3B0cy5vbmNlID0gdGhpcy5vbmNlLmJpbmQodGhpcyk7XG5cbiAgQ2hhaW4uY2FsbCh0aGlzLCB1dGlsLmV4dGVuZChkZWZhdWx0Q2hhaW5PcHRzLCBjaGFpbk9wdHMgfHwge30pKTtcbn1cblxuUHJveHlFdmVudEVtaXR0ZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShDaGFpbi5wcm90b3R5cGUpO1xuXG51dGlsLmV4dGVuZChQcm94eUV2ZW50RW1pdHRlci5wcm90b3R5cGUsIHtcbiAgb246IGZ1bmN0aW9uKHR5cGUsIGZuKSB7XG4gICAgaWYgKHR5cGVvZiB0eXBlID09ICdmdW5jdGlvbicpIHtcbiAgICAgIGZuID0gdHlwZTtcbiAgICAgIHR5cGUgPSBudWxsO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGlmICh0eXBlLnRyaW0oKSA9PSAnKicpIHR5cGUgPSBudWxsO1xuICAgICAgdmFyIF9mbiA9IGZuO1xuICAgICAgZm4gPSBmdW5jdGlvbihlKSB7XG4gICAgICAgIGUgPSBlIHx8IHt9O1xuICAgICAgICBpZiAodHlwZSkge1xuICAgICAgICAgIGlmIChlLnR5cGUgPT0gdHlwZSkge1xuICAgICAgICAgICAgX2ZuKGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBfZm4oZSk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICB2YXIgbGlzdGVuZXJzID0gdGhpcy5saXN0ZW5lcnM7XG4gICAgICBpZiAodHlwZSkge1xuICAgICAgICBpZiAoIWxpc3RlbmVyc1t0eXBlXSkgbGlzdGVuZXJzW3R5cGVdID0gW107XG4gICAgICAgIGxpc3RlbmVyc1t0eXBlXS5wdXNoKGZuKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZXZlbnRFbWl0dGVyLm9uKHRoaXMuZXZlbnQsIGZuKTtcbiAgICByZXR1cm4gdGhpcy5faGFuZGxlckxpbmsoe1xuICAgICAgZm46IGZuLFxuICAgICAgdHlwZTogdHlwZSxcbiAgICAgIGV4dGVuZDogdGhpcy5wcm94eUNoYWluT3B0c1xuICAgIH0pO1xuICB9LFxuICBvbmNlOiBmdW5jdGlvbih0eXBlLCBmbikge1xuICAgIHZhciBldmVudCA9IHRoaXMuZXZlbnQ7XG4gICAgaWYgKHR5cGVvZiB0eXBlID09ICdmdW5jdGlvbicpIHtcbiAgICAgIGZuID0gdHlwZTtcbiAgICAgIHR5cGUgPSBudWxsO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGlmICh0eXBlLnRyaW0oKSA9PSAnKicpIHR5cGUgPSBudWxsO1xuICAgICAgdmFyIF9mbiA9IGZuO1xuICAgICAgZm4gPSBmdW5jdGlvbihlKSB7XG4gICAgICAgIGUgPSBlIHx8IHt9O1xuICAgICAgICBpZiAodHlwZSkge1xuICAgICAgICAgIGlmIChlLnR5cGUgPT0gdHlwZSkge1xuICAgICAgICAgICAgZXZlbnRFbWl0dGVyLnJlbW92ZUxpc3RlbmVyKGV2ZW50LCBmbik7XG4gICAgICAgICAgICBfZm4oZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIF9mbihlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAodHlwZSkgcmV0dXJuIGV2ZW50RW1pdHRlci5vbihldmVudCwgZm4pO1xuICAgIGVsc2UgcmV0dXJuIGV2ZW50RW1pdHRlci5vbmNlKGV2ZW50LCBmbik7XG4gIH0sXG4gIF9yZW1vdmVMaXN0ZW5lcjogZnVuY3Rpb24oZm4sIHR5cGUpIHtcbiAgICBpZiAodHlwZSkge1xuICAgICAgdmFyIGxpc3RlbmVycyA9IHRoaXMubGlzdGVuZXJzW3R5cGVdLFxuICAgICAgICBpZHggPSBsaXN0ZW5lcnMuaW5kZXhPZihmbik7XG4gICAgICBsaXN0ZW5lcnMuc3BsaWNlKGlkeCwgMSk7XG4gICAgfVxuICAgIHJldHVybiBldmVudEVtaXR0ZXIucmVtb3ZlTGlzdGVuZXIodGhpcy5ldmVudCwgZm4pO1xuICB9LFxuICBlbWl0OiBmdW5jdGlvbih0eXBlLCBwYXlsb2FkKSB7XG4gICAgaWYgKHR5cGVvZiB0eXBlID09ICdvYmplY3QnKSB7XG4gICAgICBwYXlsb2FkID0gdHlwZTtcbiAgICAgIHR5cGUgPSBudWxsO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHBheWxvYWQgPSBwYXlsb2FkIHx8IHt9O1xuICAgICAgcGF5bG9hZC50eXBlID0gdHlwZTtcbiAgICB9XG4gICAgZXZlbnRFbWl0dGVyLmVtaXQuY2FsbChldmVudEVtaXR0ZXIsIHRoaXMuZXZlbnQsIHBheWxvYWQpO1xuICB9LFxuICBfcmVtb3ZlQWxsTGlzdGVuZXJzOiBmdW5jdGlvbih0eXBlKSB7XG4gICAgKHRoaXMubGlzdGVuZXJzW3R5cGVdIHx8IFtdKS5mb3JFYWNoKGZ1bmN0aW9uKGZuKSB7XG4gICAgICBldmVudEVtaXR0ZXIucmVtb3ZlTGlzdGVuZXIodGhpcy5ldmVudCwgZm4pO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gICAgdGhpcy5saXN0ZW5lcnNbdHlwZV0gPSBbXTtcbiAgfSxcbiAgcmVtb3ZlQWxsTGlzdGVuZXJzOiBmdW5jdGlvbih0eXBlKSB7XG4gICAgaWYgKHR5cGUpIHtcbiAgICAgIHRoaXMuX3JlbW92ZUFsbExpc3RlbmVycyh0eXBlKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBmb3IgKHR5cGUgaW4gdGhpcy5saXN0ZW5lcnMpIHtcbiAgICAgICAgaWYgKHRoaXMubGlzdGVuZXJzLmhhc093blByb3BlcnR5KHR5cGUpKSB7XG4gICAgICAgICAgdGhpcy5fcmVtb3ZlQWxsTGlzdGVuZXJzKHR5cGUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59KTtcblxudXRpbC5leHRlbmQoZXZlbnRFbWl0dGVyLCB7XG4gIFByb3h5RXZlbnRFbWl0dGVyOiBQcm94eUV2ZW50RW1pdHRlcixcbiAgd3JhcEFycmF5OiBmdW5jdGlvbihhcnJheSwgZmllbGQsIG1vZGVsSW5zdGFuY2UpIHtcbiAgICBpZiAoIWFycmF5Lm9ic2VydmVyKSB7XG4gICAgICBhcnJheS5vYnNlcnZlciA9IG5ldyBBcnJheU9ic2VydmVyKGFycmF5KTtcbiAgICAgIGFycmF5Lm9ic2VydmVyLm9wZW4oZnVuY3Rpb24oc3BsaWNlcykge1xuICAgICAgICB2YXIgZmllbGRJc0F0dHJpYnV0ZSA9IG1vZGVsSW5zdGFuY2UuX2F0dHJpYnV0ZU5hbWVzLmluZGV4T2YoZmllbGQpID4gLTE7XG4gICAgICAgIGlmIChmaWVsZElzQXR0cmlidXRlKSB7XG4gICAgICAgICAgc3BsaWNlcy5mb3JFYWNoKGZ1bmN0aW9uKHNwbGljZSkge1xuICAgICAgICAgICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgICAgICAgICAgIGNvbGxlY3Rpb246IG1vZGVsSW5zdGFuY2UuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgIG1vZGVsOiBtb2RlbEluc3RhbmNlLm1vZGVsLm5hbWUsXG4gICAgICAgICAgICAgIGxvY2FsSWQ6IG1vZGVsSW5zdGFuY2UubG9jYWxJZCxcbiAgICAgICAgICAgICAgaW5kZXg6IHNwbGljZS5pbmRleCxcbiAgICAgICAgICAgICAgcmVtb3ZlZDogc3BsaWNlLnJlbW92ZWQsXG4gICAgICAgICAgICAgIGFkZGVkOiBzcGxpY2UuYWRkZWRDb3VudCA/IGFycmF5LnNsaWNlKHNwbGljZS5pbmRleCwgc3BsaWNlLmluZGV4ICsgc3BsaWNlLmFkZGVkQ291bnQpIDogW10sXG4gICAgICAgICAgICAgIHR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgICAgZmllbGQ6IGZpZWxkLFxuICAgICAgICAgICAgICBvYmo6IG1vZGVsSW5zdGFuY2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn0pO1xuXG52YXIgb2xkRW1pdCA9IGV2ZW50RW1pdHRlci5lbWl0O1xuXG4vLyBFbnN1cmUgdGhhdCBlcnJvcnMgaW4gZXZlbnQgaGFuZGxlcnMgZG8gbm90IHN0YWxsIFNpZXN0YS5cbmV2ZW50RW1pdHRlci5lbWl0ID0gZnVuY3Rpb24oZXZlbnQsIHBheWxvYWQpIHtcbiAgdHJ5IHtcbiAgICBvbGRFbWl0LmNhbGwoZXZlbnRFbWl0dGVyLCBldmVudCwgcGF5bG9hZCk7XG4gIH1cbiAgY2F0Y2ggKGUpIHtcbiAgICBjb25zb2xlLmVycm9yKGUpO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGV2ZW50RW1pdHRlcjtcblxuXG4vKiogV0VCUEFDSyBGT09URVIgKipcbiAqKiAuL2NvcmUvZXZlbnRzLmpzXG4gKiovIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH1cbiAgICAgIHRocm93IFR5cGVFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4nKTtcbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICAgICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcblxuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIHZhciBtO1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgaWYgKHR5cGVvZiBjb25zb2xlLnRyYWNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgaW4gSUUgMTBcbiAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghZW1pdHRlci5fZXZlbnRzIHx8ICFlbWl0dGVyLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gMDtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbihlbWl0dGVyLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IDE7XG4gIGVsc2VcbiAgICByZXQgPSBlbWl0dGVyLl9ldmVudHNbdHlwZV0ubGVuZ3RoO1xuICByZXR1cm4gcmV0O1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL34vZXZlbnRzL2V2ZW50cy5qc1xuICoqIG1vZHVsZSBpZCA9IDI0XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJ2YXIgYXJnc2FycmF5ID0gcmVxdWlyZSgnYXJnc2FycmF5Jyk7XG5cbi8qKlxuICogQ2xhc3MgZm9yIGZhY2lsaXRhdGluZyBcImNoYWluZWRcIiBiZWhhdmlvdXIgZS5nOlxuICpcbiAqIHZhciBjYW5jZWwgPSBVc2Vyc1xuICogIC5vbignbmV3JywgZnVuY3Rpb24gKHVzZXIpIHtcbiAgICogICAgIC8vIC4uLlxuICAgKiAgIH0pXG4gKiAgLnF1ZXJ5KHskb3I6IHthZ2VfX2d0ZTogMjAsIGFnZV9fbHRlOiAzMH19KVxuICogIC5vbignKicsIGZ1bmN0aW9uIChjaGFuZ2UpIHtcbiAgICogICAgIC8vIC4uXG4gICAqICAgfSk7XG4gKlxuICogQHBhcmFtIG9wdHNcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBDaGFpbihvcHRzKSB7XG4gIHRoaXMub3B0cyA9IG9wdHM7XG59XG5cbkNoYWluLnByb3RvdHlwZSA9IHtcbiAgLyoqXG4gICAqIENvbnN0cnVjdCBhIGxpbmsgaW4gdGhlIGNoYWluIG9mIGNhbGxzLlxuICAgKiBAcGFyYW0gb3B0c1xuICAgKiBAcGFyYW0gb3B0cy5mblxuICAgKiBAcGFyYW0gb3B0cy50eXBlXG4gICAqL1xuICBfaGFuZGxlckxpbms6IGZ1bmN0aW9uKG9wdHMpIHtcbiAgICB2YXIgZmlyc3RMaW5rO1xuICAgIGZpcnN0TGluayA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHR5cCA9IG9wdHMudHlwZTtcbiAgICAgIGlmIChvcHRzLmZuKVxuICAgICAgICB0aGlzLl9yZW1vdmVMaXN0ZW5lcihvcHRzLmZuLCB0eXApO1xuICAgICAgaWYgKGZpcnN0TGluay5fcGFyZW50TGluaykgZmlyc3RMaW5rLl9wYXJlbnRMaW5rKCk7IC8vIENhbmNlbCBsaXN0ZW5lcnMgYWxsIHRoZSB3YXkgdXAgdGhlIGNoYWluLlxuICAgIH0uYmluZCh0aGlzKTtcbiAgICBPYmplY3Qua2V5cyh0aGlzLm9wdHMpLmZvckVhY2goZnVuY3Rpb24ocHJvcCkge1xuICAgICAgdmFyIGZ1bmMgPSB0aGlzLm9wdHNbcHJvcF07XG4gICAgICBmaXJzdExpbmtbcHJvcF0gPSBhcmdzYXJyYXkoZnVuY3Rpb24oYXJncykge1xuICAgICAgICB2YXIgbGluayA9IGZ1bmMuYXBwbHkoZnVuYy5fX3NpZXN0YV9ib3VuZF9vYmplY3QsIGFyZ3MpO1xuICAgICAgICBsaW5rLl9wYXJlbnRMaW5rID0gZmlyc3RMaW5rO1xuICAgICAgICByZXR1cm4gbGluaztcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgICBmaXJzdExpbmsuX3BhcmVudExpbmsgPSBudWxsO1xuICAgIHJldHVybiBmaXJzdExpbms7XG4gIH0sXG4gIC8qKlxuICAgKiBDb25zdHJ1Y3QgYSBsaW5rIGluIHRoZSBjaGFpbiBvZiBjYWxscy5cbiAgICogQHBhcmFtIG9wdHNcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NsZWFuXVxuICAgKi9cbiAgX2xpbms6IGZ1bmN0aW9uKG9wdHMsIGNsZWFuKSB7XG4gICAgdmFyIGNoYWluID0gdGhpcztcbiAgICBjbGVhbiA9IGNsZWFuIHx8IGZ1bmN0aW9uKCkge307XG4gICAgdmFyIGxpbms7XG4gICAgbGluayA9IGZ1bmN0aW9uKCkge1xuICAgICAgY2xlYW4oKTtcbiAgICAgIGlmIChsaW5rLl9wYXJlbnRMaW5rKSBsaW5rLl9wYXJlbnRMaW5rKCk7IC8vIENhbmNlbCBsaXN0ZW5lcnMgYWxsIHRoZSB3YXkgdXAgdGhlIGNoYWluLlxuICAgIH0uYmluZCh0aGlzKTtcbiAgICBsaW5rLl9fc2llc3RhX2lzTGluayA9IHRydWU7XG4gICAgbGluay5vcHRzID0gb3B0cztcbiAgICBsaW5rLmNsZWFuID0gY2xlYW47XG4gICAgT2JqZWN0LmtleXMob3B0cykuZm9yRWFjaChmdW5jdGlvbihwcm9wKSB7XG4gICAgICB2YXIgZnVuYyA9IG9wdHNbcHJvcF07XG4gICAgICBsaW5rW3Byb3BdID0gYXJnc2FycmF5KGZ1bmN0aW9uKGFyZ3MpIHtcbiAgICAgICAgdmFyIHBvc3NpYmxlTGluayA9IGZ1bmMuYXBwbHkoZnVuYy5fX3NpZXN0YV9ib3VuZF9vYmplY3QsIGFyZ3MpO1xuICAgICAgICBpZiAoIXBvc3NpYmxlTGluayB8fCAhcG9zc2libGVMaW5rLl9fc2llc3RhX2lzTGluaykgeyAvLyBQYXRjaCBpbiBhIGxpbmsgaW4gdGhlIGNoYWluIHRvIGF2b2lkIGl0IGJlaW5nIGJyb2tlbiwgYmFzaW5nIG9mZiB0aGUgY3VycmVudCBsaW5rXG4gICAgICAgICAgbmV4dExpbmsgPSBjaGFpbi5fbGluayhsaW5rLm9wdHMpO1xuICAgICAgICAgIGZvciAodmFyIHByb3AgaW4gcG9zc2libGVMaW5rKSB7XG4gICAgICAgICAgICAvL25vaW5zcGVjdGlvbiBKU1VuZmlsdGVyZWRGb3JJbkxvb3BcbiAgICAgICAgICAgIGlmIChwb3NzaWJsZUxpbmtbcHJvcF0gaW5zdGFuY2VvZiBGdW5jdGlvbikge1xuICAgICAgICAgICAgICAvL25vaW5zcGVjdGlvbiBKU1VuZmlsdGVyZWRGb3JJbkxvb3BcbiAgICAgICAgICAgICAgbmV4dExpbmtbcHJvcF0gPSBwb3NzaWJsZUxpbmtbcHJvcF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIHZhciBuZXh0TGluayA9IHBvc3NpYmxlTGluaztcbiAgICAgICAgfVxuICAgICAgICBuZXh0TGluay5fcGFyZW50TGluayA9IGxpbms7XG4gICAgICAgIC8vIEluaGVyaXQgbWV0aG9kcyBmcm9tIHRoZSBwYXJlbnQgbGluayBpZiB0aG9zZSBtZXRob2RzIGRvbid0IGFscmVhZHkgZXhpc3QuXG4gICAgICAgIGZvciAocHJvcCBpbiBsaW5rKSB7XG4gICAgICAgICAgaWYgKGxpbmtbcHJvcF0gaW5zdGFuY2VvZiBGdW5jdGlvbikge1xuICAgICAgICAgICAgbmV4dExpbmtbcHJvcF0gPSBsaW5rW3Byb3BdLmJpbmQobGluayk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXh0TGluaztcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgICBsaW5rLl9wYXJlbnRMaW5rID0gbnVsbDtcbiAgICByZXR1cm4gbGluaztcbiAgfVxufTtcbm1vZHVsZS5leHBvcnRzID0gQ2hhaW47XG5cblxuLyoqIFdFQlBBQ0sgRk9PVEVSICoqXG4gKiogLi9jb3JlL0NoYWluLmpzXG4gKiovIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgUHJvbWlzZSA9IHV0aWwuUHJvbWlzZSxcbiAgZXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJyksXG4gIE1vZGVsSW5zdGFuY2UgPSByZXF1aXJlKCcuL01vZGVsSW5zdGFuY2UnKTtcblxuLypcbiBUT0RPOiBVc2UgRVM2IFByb3h5IGluc3RlYWQuXG4gRXZlbnR1YWxseSBxdWVyeSBzZXRzIHNob3VsZCB1c2UgRVM2IFByb3hpZXMgd2hpY2ggd2lsbCBiZSBtdWNoIG1vcmUgbmF0dXJhbCBhbmQgcm9idXN0LiBFLmcuIG5vIG5lZWQgZm9yIHRoZSBiZWxvd1xuICovXG52YXIgQVJSQVlfTUVUSE9EUyA9IFsncHVzaCcsICdzb3J0JywgJ3JldmVyc2UnLCAnc3BsaWNlJywgJ3NoaWZ0JywgJ3Vuc2hpZnQnXSxcbiAgTlVNQkVSX01FVEhPRFMgPSBbJ3RvU3RyaW5nJywgJ3RvRXhwb25lbnRpYWwnLCAndG9GaXhlZCcsICd0b1ByZWNpc2lvbicsICd2YWx1ZU9mJ10sXG4gIE5VTUJFUl9QUk9QRVJUSUVTID0gWydNQVhfVkFMVUUnLCAnTUlOX1ZBTFVFJywgJ05FR0FUSVZFX0lORklOSVRZJywgJ05hTicsICdQT1NJVElWRV9JTkZJTklUWSddLFxuICBTVFJJTkdfTUVUSE9EUyA9IFsnY2hhckF0JywgJ2NoYXJDb2RlQXQnLCAnY29uY2F0JywgJ2Zyb21DaGFyQ29kZScsICdpbmRleE9mJywgJ2xhc3RJbmRleE9mJywgJ2xvY2FsZUNvbXBhcmUnLFxuICAgICdtYXRjaCcsICdyZXBsYWNlJywgJ3NlYXJjaCcsICdzbGljZScsICdzcGxpdCcsICdzdWJzdHInLCAnc3Vic3RyaW5nJywgJ3RvTG9jYWxlTG93ZXJDYXNlJywgJ3RvTG9jYWxlVXBwZXJDYXNlJyxcbiAgICAndG9Mb3dlckNhc2UnLCAndG9TdHJpbmcnLCAndG9VcHBlckNhc2UnLCAndHJpbScsICd2YWx1ZU9mJ10sXG4gIFNUUklOR19QUk9QRVJUSUVTID0gWydsZW5ndGgnXTtcblxuLyoqXG4gKiBSZXR1cm4gdGhlIHByb3BlcnR5IG5hbWVzIGZvciBhIGdpdmVuIG9iamVjdC4gSGFuZGxlcyBzcGVjaWFsIGNhc2VzIHN1Y2ggYXMgc3RyaW5ncyBhbmQgbnVtYmVycyB0aGF0IGRvIG5vdCBoYXZlXG4gKiB0aGUgZ2V0T3duUHJvcGVydHlOYW1lcyBmdW5jdGlvbi5cbiAqIFRoZSBzcGVjaWFsIGNhc2VzIGFyZSB2ZXJ5IG11Y2ggaGFja3MuIFRoaXMgaGFjayBjYW4gYmUgcmVtb3ZlZCBvbmNlIHRoZSBQcm94eSBvYmplY3QgaXMgbW9yZSB3aWRlbHkgYWRvcHRlZC5cbiAqIEBwYXJhbSBvYmplY3RcbiAqIEByZXR1cm5zIHtBcnJheX1cbiAqL1xuZnVuY3Rpb24gZ2V0UHJvcGVydHlOYW1lcyhvYmplY3QpIHtcbiAgdmFyIHByb3BlcnR5TmFtZXM7XG4gIGlmICh0eXBlb2Ygb2JqZWN0ID09ICdzdHJpbmcnIHx8IG9iamVjdCBpbnN0YW5jZW9mIFN0cmluZykge1xuICAgIHByb3BlcnR5TmFtZXMgPSBTVFJJTkdfTUVUSE9EUy5jb25jYXQoU1RSSU5HX1BST1BFUlRJRVMpO1xuICB9XG4gIGVsc2UgaWYgKHR5cGVvZiBvYmplY3QgPT0gJ251bWJlcicgfHwgb2JqZWN0IGluc3RhbmNlb2YgTnVtYmVyKSB7XG4gICAgcHJvcGVydHlOYW1lcyA9IE5VTUJFUl9NRVRIT0RTLmNvbmNhdChOVU1CRVJfUFJPUEVSVElFUyk7XG4gIH1cbiAgZWxzZSB7XG4gICAgcHJvcGVydHlOYW1lcyA9IG9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKCk7XG4gIH1cbiAgcmV0dXJuIHByb3BlcnR5TmFtZXM7XG59XG5cbi8qKlxuICogRGVmaW5lIGEgcHJveHkgcHJvcGVydHkgdG8gYXR0cmlidXRlcyBvbiBvYmplY3RzIGluIHRoZSBhcnJheVxuICogQHBhcmFtIGFyclxuICogQHBhcmFtIHByb3BcbiAqL1xuZnVuY3Rpb24gZGVmaW5lQXR0cmlidXRlKGFyciwgcHJvcCkge1xuICBpZiAoIShwcm9wIGluIGFycikpIHsgLy8gZS5nLiB3ZSBjYW5ub3QgcmVkZWZpbmUgLmxlbmd0aFxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShhcnIsIHByb3AsIHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBxdWVyeVNldCh1dGlsLnBsdWNrKGFyciwgcHJvcCkpO1xuICAgICAgfSxcbiAgICAgIHNldDogZnVuY3Rpb24odikge1xuICAgICAgICBpZiAodXRpbC5pc0FycmF5KHYpKSB7XG4gICAgICAgICAgaWYgKHRoaXMubGVuZ3RoICE9IHYubGVuZ3RoKSB0aHJvdyBlcnJvcih7bWVzc2FnZTogJ011c3QgYmUgc2FtZSBsZW5ndGgnfSk7XG4gICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB2Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzW2ldW3Byb3BdID0gdltpXTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgZm9yIChpID0gMDsgaSA8IHRoaXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXNbaV1bcHJvcF0gPSB2O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzUHJvbWlzZShvYmopIHtcbiAgLy8gVE9ETzogRG9uJ3QgdGhpbmsgdGhpcyBpcyB2ZXJ5IHJvYnVzdC5cbiAgcmV0dXJuIG9iai50aGVuICYmIG9iai5jYXRjaDtcbn1cblxuLyoqXG4gKiBEZWZpbmUgYSBwcm94eSBtZXRob2Qgb24gdGhlIGFycmF5IGlmIG5vdCBhbHJlYWR5IGluIGV4aXN0ZW5jZS5cbiAqIEBwYXJhbSBhcnJcbiAqIEBwYXJhbSBwcm9wXG4gKi9cbmZ1bmN0aW9uIGRlZmluZU1ldGhvZChhcnIsIHByb3ApIHtcbiAgaWYgKCEocHJvcCBpbiBhcnIpKSB7IC8vIGUuZy4gd2UgZG9uJ3Qgd2FudCB0byByZWRlZmluZSB0b1N0cmluZ1xuICAgIGFycltwcm9wXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGFyZ3MgPSBhcmd1bWVudHMsXG4gICAgICAgIHJlcyA9IHRoaXMubWFwKGZ1bmN0aW9uKHApIHtcbiAgICAgICAgICByZXR1cm4gcFtwcm9wXS5hcHBseShwLCBhcmdzKTtcbiAgICAgICAgfSk7XG4gICAgICB2YXIgYXJlUHJvbWlzZXMgPSBmYWxzZTtcbiAgICAgIGlmIChyZXMubGVuZ3RoKSBhcmVQcm9taXNlcyA9IGlzUHJvbWlzZShyZXNbMF0pO1xuICAgICAgcmV0dXJuIGFyZVByb21pc2VzID8gUHJvbWlzZS5hbGwocmVzKSA6IHF1ZXJ5U2V0KHJlcyk7XG4gICAgfTtcbiAgfVxufVxuXG4vKipcbiAqIFRyYW5zZm9ybSB0aGUgYXJyYXkgaW50byBhIHF1ZXJ5IHNldC5cbiAqIFJlbmRlcnMgdGhlIGFycmF5IGltbXV0YWJsZS5cbiAqIEBwYXJhbSBhcnJcbiAqIEBwYXJhbSBtb2RlbCAtIFRoZSBtb2RlbCB3aXRoIHdoaWNoIHRvIHByb3h5IHRvXG4gKi9cbmZ1bmN0aW9uIG1vZGVsUXVlcnlTZXQoYXJyLCBtb2RlbCkge1xuICBhcnIgPSB1dGlsLmV4dGVuZChbXSwgYXJyKTtcbiAgdmFyIGF0dHJpYnV0ZU5hbWVzID0gbW9kZWwuX2F0dHJpYnV0ZU5hbWVzLFxuICAgIHJlbGF0aW9uc2hpcE5hbWVzID0gbW9kZWwuX3JlbGF0aW9uc2hpcE5hbWVzLFxuICAgIG5hbWVzID0gYXR0cmlidXRlTmFtZXMuY29uY2F0KHJlbGF0aW9uc2hpcE5hbWVzKS5jb25jYXQoaW5zdGFuY2VNZXRob2RzKTtcbiAgbmFtZXMuZm9yRWFjaChkZWZpbmVBdHRyaWJ1dGUuYmluZChkZWZpbmVBdHRyaWJ1dGUsIGFycikpO1xuICB2YXIgaW5zdGFuY2VNZXRob2RzID0gT2JqZWN0LmtleXMoTW9kZWxJbnN0YW5jZS5wcm90b3R5cGUpO1xuICBpbnN0YW5jZU1ldGhvZHMuZm9yRWFjaChkZWZpbmVNZXRob2QuYmluZChkZWZpbmVNZXRob2QsIGFycikpO1xuICByZXR1cm4gcmVuZGVySW1tdXRhYmxlKGFycik7XG59XG5cbi8qKlxuICogVHJhbnNmb3JtIHRoZSBhcnJheSBpbnRvIGEgcXVlcnkgc2V0LCBiYXNlZCBvbiB3aGF0ZXZlciBpcyBpbiBpdC5cbiAqIE5vdGUgdGhhdCBhbGwgb2JqZWN0cyBtdXN0IGJlIG9mIHRoZSBzYW1lIHR5cGUuIFRoaXMgZnVuY3Rpb24gd2lsbCB0YWtlIHRoZSBmaXJzdCBvYmplY3QgYW5kIGRlY2lkZSBob3cgdG8gcHJveHlcbiAqIGJhc2VkIG9uIHRoYXQuXG4gKiBAcGFyYW0gYXJyXG4gKi9cbmZ1bmN0aW9uIHF1ZXJ5U2V0KGFycikge1xuICBpZiAoYXJyLmxlbmd0aCkge1xuICAgIHZhciByZWZlcmVuY2VPYmplY3QgPSBhcnJbMF0sXG4gICAgICBwcm9wZXJ0eU5hbWVzID0gZ2V0UHJvcGVydHlOYW1lcyhyZWZlcmVuY2VPYmplY3QpO1xuICAgIHByb3BlcnR5TmFtZXMuZm9yRWFjaChmdW5jdGlvbihwcm9wKSB7XG4gICAgICBpZiAodHlwZW9mIHJlZmVyZW5jZU9iamVjdFtwcm9wXSA9PSAnZnVuY3Rpb24nKSBkZWZpbmVNZXRob2QoYXJyLCBwcm9wLCBhcmd1bWVudHMpO1xuICAgICAgZWxzZSBkZWZpbmVBdHRyaWJ1dGUoYXJyLCBwcm9wKTtcbiAgICB9KTtcbiAgfVxuICByZXR1cm4gcmVuZGVySW1tdXRhYmxlKGFycik7XG59XG5cbmZ1bmN0aW9uIHRocm93SW1tdXRhYmxlRXJyb3IoKSB7XG4gIHRocm93IG5ldyBFcnJvcignQ2Fubm90IG1vZGlmeSBhIHF1ZXJ5IHNldCcpO1xufVxuXG4vKipcbiAqIFJlbmRlciBhbiBhcnJheSBpbW11dGFibGUgYnkgcmVwbGFjaW5nIGFueSBmdW5jdGlvbnMgdGhhdCBjYW4gbXV0YXRlIGl0LlxuICogQHBhcmFtIGFyclxuICovXG5mdW5jdGlvbiByZW5kZXJJbW11dGFibGUoYXJyKSB7XG4gIEFSUkFZX01FVEhPRFMuZm9yRWFjaChmdW5jdGlvbihwKSB7XG4gICAgYXJyW3BdID0gdGhyb3dJbW11dGFibGVFcnJvcjtcbiAgfSk7XG4gIGFyci5pbW11dGFibGUgPSB0cnVlO1xuICBhcnIubXV0YWJsZUNvcHkgPSBhcnIuYXNBcnJheSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBtdXRhYmxlQXJyID0gdGhpcy5tYXAoZnVuY3Rpb24oeCkge3JldHVybiB4fSk7XG4gICAgbXV0YWJsZUFyci5hc1F1ZXJ5U2V0ID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gcXVlcnlTZXQodGhpcyk7XG4gICAgfTtcbiAgICBtdXRhYmxlQXJyLmFzTW9kZWxRdWVyeVNldCA9IGZ1bmN0aW9uKG1vZGVsKSB7XG4gICAgICByZXR1cm4gbW9kZWxRdWVyeVNldCh0aGlzLCBtb2RlbCk7XG4gICAgfTtcbiAgICByZXR1cm4gbXV0YWJsZUFycjtcbiAgfTtcbiAgcmV0dXJuIGFycjtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBtb2RlbFF1ZXJ5U2V0O1xuXG5cbi8qKiBXRUJQQUNLIEZPT1RFUiAqKlxuICoqIC4vY29yZS9RdWVyeVNldC5qc1xuICoqLyIsInZhciBNb2RlbEluc3RhbmNlID0gcmVxdWlyZSgnLi9Nb2RlbEluc3RhbmNlJyksXG4gIGxvZyA9IHJlcXVpcmUoJy4vbG9nJykoJ2dyYXBoJyksXG4gIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpLFxuICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XG5cbmZ1bmN0aW9uIFNpZXN0YUVycm9yKG9wdHMpIHtcbiAgdGhpcy5vcHRzID0gb3B0cztcbn1cblxuXG5TaWVzdGFFcnJvci5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHRoaXMub3B0cywgbnVsbCwgNCk7XG59O1xuXG4vKipcbiAqIEVuY2Fwc3VsYXRlcyB0aGUgaWRlYSBvZiBtYXBwaW5nIGFycmF5cyBvZiBkYXRhIG9udG8gdGhlIG9iamVjdCBncmFwaCBvciBhcnJheXMgb2Ygb2JqZWN0cy5cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gKiBAcGFyYW0gb3B0cy5tb2RlbFxuICogQHBhcmFtIG9wdHMuZGF0YVxuICogQHBhcmFtIG9wdHMub2JqZWN0c1xuICogQHBhcmFtIG9wdHMuZGlzYWJsZU5vdGlmaWNhdGlvbnNcbiAqL1xuZnVuY3Rpb24gTWFwcGluZ09wZXJhdGlvbihvcHRzKSB7XG4gIHRoaXMuX29wdHMgPSBvcHRzO1xuXG4gIHV0aWwuZXh0ZW5kRnJvbU9wdHModGhpcywgb3B0cywge1xuICAgIG1vZGVsOiBudWxsLFxuICAgIGRhdGE6IG51bGwsXG4gICAgb2JqZWN0czogW10sXG4gICAgZGlzYWJsZWV2ZW50czogZmFsc2UsXG4gICAgX2lnbm9yZUluc3RhbGxlZDogZmFsc2VcbiAgfSk7XG5cbiAgdXRpbC5leHRlbmQodGhpcywge1xuICAgIGVycm9yczogW10sXG4gICAgc3ViVGFza1Jlc3VsdHM6IHt9LFxuICAgIF9uZXdPYmplY3RzOiBbXVxuICB9KTtcblxuXG4gIHRoaXMubW9kZWwuX2luc3RhbGxSZXZlcnNlUGxhY2Vob2xkZXJzKCk7XG4gIHRoaXMuZGF0YSA9IHRoaXMucHJlcHJvY2Vzc0RhdGEoKTtcbn1cblxudXRpbC5leHRlbmQoTWFwcGluZ09wZXJhdGlvbi5wcm90b3R5cGUsIHtcbiAgbWFwQXR0cmlidXRlczogZnVuY3Rpb24oKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBkYXR1bSA9IHRoaXMuZGF0YVtpXSxcbiAgICAgICAgb2JqZWN0ID0gdGhpcy5vYmplY3RzW2ldO1xuICAgICAgLy8gTm8gcG9pbnQgbWFwcGluZyBvYmplY3Qgb250byBpdHNlbGYuIFRoaXMgaGFwcGVucyBpZiBhIE1vZGVsSW5zdGFuY2UgaXMgcGFzc2VkIGFzIGEgcmVsYXRpb25zaGlwLlxuICAgICAgaWYgKGRhdHVtICE9IG9iamVjdCkge1xuICAgICAgICBpZiAob2JqZWN0KSB7IC8vIElmIG9iamVjdCBpcyBmYWxzeSwgdGhlbiB0aGVyZSB3YXMgYW4gZXJyb3IgbG9va2luZyB1cCB0aGF0IG9iamVjdC9jcmVhdGluZyBpdC5cbiAgICAgICAgICB2YXIgZmllbGRzID0gdGhpcy5tb2RlbC5fYXR0cmlidXRlTmFtZXM7XG4gICAgICAgICAgZmllbGRzLmZvckVhY2goZnVuY3Rpb24oZikge1xuICAgICAgICAgICAgaWYgKGRhdHVtW2ZdICE9PSB1bmRlZmluZWQpIHsgLy8gbnVsbCBpcyBmaW5lXG4gICAgICAgICAgICAgIC8vIElmIGV2ZW50cyBhcmUgZGlzYWJsZWQgd2UgdXBkYXRlIF9fdmFsdWVzIG9iamVjdCBkaXJlY3RseS4gVGhpcyBhdm9pZHMgdHJpZ2dlcmluZ1xuICAgICAgICAgICAgICAvLyBldmVudHMgd2hpY2ggYXJlIGJ1aWx0IGludG8gdGhlIHNldCBmdW5jdGlvbiBvZiB0aGUgcHJvcGVydHkuXG4gICAgICAgICAgICAgIGlmICh0aGlzLmRpc2FibGVldmVudHMpIHtcbiAgICAgICAgICAgICAgICBvYmplY3QuX192YWx1ZXNbZl0gPSBkYXR1bVtmXTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBvYmplY3RbZl0gPSBkYXR1bVtmXTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgICAgaWYgKGRhdHVtLl9yZXYpIG9iamVjdC5fcmV2ID0gZGF0dW0uX3JldjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgX21hcDogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBlcnI7XG4gICAgdGhpcy5tYXBBdHRyaWJ1dGVzKCk7XG4gICAgdmFyIHJlbGF0aW9uc2hpcEZpZWxkcyA9IE9iamVjdC5rZXlzKHNlbGYuc3ViVGFza1Jlc3VsdHMpO1xuICAgIHJlbGF0aW9uc2hpcEZpZWxkcy5mb3JFYWNoKGZ1bmN0aW9uKGYpIHtcbiAgICAgIHZhciByZXMgPSBzZWxmLnN1YlRhc2tSZXN1bHRzW2ZdO1xuICAgICAgdmFyIGluZGV4ZXMgPSByZXMuaW5kZXhlcyxcbiAgICAgICAgb2JqZWN0cyA9IHJlcy5vYmplY3RzO1xuICAgICAgdmFyIHJlbGF0ZWREYXRhID0gc2VsZi5nZXRSZWxhdGVkRGF0YShmKS5yZWxhdGVkRGF0YTtcbiAgICAgIHZhciB1bmZsYXR0ZW5lZE9iamVjdHMgPSB1dGlsLnVuZmxhdHRlbkFycmF5KG9iamVjdHMsIHJlbGF0ZWREYXRhKTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdW5mbGF0dGVuZWRPYmplY3RzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBpZHggPSBpbmRleGVzW2ldO1xuICAgICAgICAvLyBFcnJvcnMgYXJlIHBsdWNrZWQgZnJvbSB0aGUgc3Vib3BlcmF0aW9ucy5cbiAgICAgICAgdmFyIGVycm9yID0gc2VsZi5lcnJvcnNbaWR4XTtcbiAgICAgICAgZXJyID0gZXJyb3IgPyBlcnJvcltmXSA6IG51bGw7XG4gICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgdmFyIHJlbGF0ZWQgPSB1bmZsYXR0ZW5lZE9iamVjdHNbaV07IC8vIENhbiBiZSBhcnJheSBvciBzY2FsYXIuXG4gICAgICAgICAgdmFyIG9iamVjdCA9IHNlbGYub2JqZWN0c1tpZHhdO1xuICAgICAgICAgIGlmIChvYmplY3QpIHtcbiAgICAgICAgICAgIGVyciA9IG9iamVjdC5fX3Byb3hpZXNbZl0uc2V0KHJlbGF0ZWQsIHtkaXNhYmxlZXZlbnRzOiBzZWxmLmRpc2FibGVldmVudHN9KTtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgaWYgKCFzZWxmLmVycm9yc1tpZHhdKSBzZWxmLmVycm9yc1tpZHhdID0ge307XG4gICAgICAgICAgICAgIHNlbGYuZXJyb3JzW2lkeF1bZl0gPSBlcnI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG4gIC8qKlxuICAgKiBGaWd1cmUgb3V0IHdoaWNoIGRhdGEgaXRlbXMgcmVxdWlyZSBhIGNhY2hlIGxvb2t1cC5cbiAgICogQHJldHVybnMge3tyZW1vdGVMb29rdXBzOiBBcnJheSwgbG9jYWxMb29rdXBzOiBBcnJheX19XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfc29ydExvb2t1cHM6IGZ1bmN0aW9uKCkge1xuICAgIHZhciByZW1vdGVMb29rdXBzID0gW107XG4gICAgdmFyIGxvY2FsTG9va3VwcyA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5kYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoIXRoaXMub2JqZWN0c1tpXSkge1xuICAgICAgICB2YXIgbG9va3VwO1xuICAgICAgICB2YXIgZGF0dW0gPSB0aGlzLmRhdGFbaV07XG4gICAgICAgIHZhciBpc1NjYWxhciA9IHR5cGVvZiBkYXR1bSA9PSAnc3RyaW5nJyB8fCB0eXBlb2YgZGF0dW0gPT0gJ251bWJlcicgfHwgZGF0dW0gaW5zdGFuY2VvZiBTdHJpbmc7XG4gICAgICAgIGlmIChkYXR1bSkge1xuICAgICAgICAgIGlmIChpc1NjYWxhcikge1xuICAgICAgICAgICAgbG9va3VwID0ge1xuICAgICAgICAgICAgICBpbmRleDogaSxcbiAgICAgICAgICAgICAgZGF0dW06IHt9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgbG9va3VwLmRhdHVtW3RoaXMubW9kZWwuaWRdID0gZGF0dW07XG4gICAgICAgICAgICByZW1vdGVMb29rdXBzLnB1c2gobG9va3VwKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGRhdHVtIGluc3RhbmNlb2YgTW9kZWxJbnN0YW5jZSkgeyAvLyBXZSB3b24ndCBuZWVkIHRvIHBlcmZvcm0gYW55IG1hcHBpbmcuXG4gICAgICAgICAgICB0aGlzLm9iamVjdHNbaV0gPSBkYXR1bTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGRhdHVtLmxvY2FsSWQpIHtcbiAgICAgICAgICAgIGxvY2FsTG9va3Vwcy5wdXNoKHtcbiAgICAgICAgICAgICAgaW5kZXg6IGksXG4gICAgICAgICAgICAgIGRhdHVtOiBkYXR1bVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSBlbHNlIGlmIChkYXR1bVt0aGlzLm1vZGVsLmlkXSkge1xuICAgICAgICAgICAgcmVtb3RlTG9va3Vwcy5wdXNoKHtcbiAgICAgICAgICAgICAgaW5kZXg6IGksXG4gICAgICAgICAgICAgIGRhdHVtOiBkYXR1bVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMub2JqZWN0c1tpXSA9IHRoaXMuX2luc3RhbmNlKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMub2JqZWN0c1tpXSA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHtyZW1vdGVMb29rdXBzOiByZW1vdGVMb29rdXBzLCBsb2NhbExvb2t1cHM6IGxvY2FsTG9va3Vwc307XG4gIH0sXG4gIF9wZXJmb3JtTG9jYWxMb29rdXBzOiBmdW5jdGlvbihsb2NhbExvb2t1cHMpIHtcbiAgICB2YXIgbG9jYWxJZGVudGlmaWVycyA9IHV0aWwucGx1Y2sodXRpbC5wbHVjayhsb2NhbExvb2t1cHMsICdkYXR1bScpLCAnbG9jYWxJZCcpLFxuICAgICAgbG9jYWxPYmplY3RzID0gY2FjaGUuZ2V0VmlhTG9jYWxJZChsb2NhbElkZW50aWZpZXJzKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxvY2FsSWRlbnRpZmllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBvYmogPSBsb2NhbE9iamVjdHNbaV07XG4gICAgICB2YXIgbG9jYWxJZCA9IGxvY2FsSWRlbnRpZmllcnNbaV07XG4gICAgICB2YXIgbG9va3VwID0gbG9jYWxMb29rdXBzW2ldO1xuICAgICAgaWYgKCFvYmopIHtcbiAgICAgICAgLy8gSWYgdGhlcmUgYXJlIG11bHRpcGxlIG1hcHBpbmcgb3BlcmF0aW9ucyBnb2luZyBvbiwgdGhlcmUgbWF5IGJlXG4gICAgICAgIG9iaiA9IGNhY2hlLmdldCh7bG9jYWxJZDogbG9jYWxJZH0pO1xuICAgICAgICBpZiAoIW9iaikgb2JqID0gdGhpcy5faW5zdGFuY2Uoe2xvY2FsSWQ6IGxvY2FsSWR9LCAhdGhpcy5kaXNhYmxlZXZlbnRzKTtcbiAgICAgICAgdGhpcy5vYmplY3RzW2xvb2t1cC5pbmRleF0gPSBvYmo7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm9iamVjdHNbbG9va3VwLmluZGV4XSA9IG9iajtcbiAgICAgIH1cbiAgICB9XG5cbiAgfSxcbiAgX3BlcmZvcm1SZW1vdGVMb29rdXBzOiBmdW5jdGlvbihyZW1vdGVMb29rdXBzKSB7XG4gICAgdmFyIHJlbW90ZUlkZW50aWZpZXJzID0gdXRpbC5wbHVjayh1dGlsLnBsdWNrKHJlbW90ZUxvb2t1cHMsICdkYXR1bScpLCB0aGlzLm1vZGVsLmlkKSxcbiAgICAgIHJlbW90ZU9iamVjdHMgPSBjYWNoZS5nZXRWaWFSZW1vdGVJZChyZW1vdGVJZGVudGlmaWVycywge21vZGVsOiB0aGlzLm1vZGVsfSk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZW1vdGVPYmplY3RzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgb2JqID0gcmVtb3RlT2JqZWN0c1tpXSxcbiAgICAgICAgbG9va3VwID0gcmVtb3RlTG9va3Vwc1tpXTtcbiAgICAgIGlmIChvYmopIHtcbiAgICAgICAgdGhpcy5vYmplY3RzW2xvb2t1cC5pbmRleF0gPSBvYmo7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgZGF0YSA9IHt9O1xuICAgICAgICB2YXIgcmVtb3RlSWQgPSByZW1vdGVJZGVudGlmaWVyc1tpXTtcbiAgICAgICAgZGF0YVt0aGlzLm1vZGVsLmlkXSA9IHJlbW90ZUlkO1xuICAgICAgICB2YXIgY2FjaGVRdWVyeSA9IHtcbiAgICAgICAgICBtb2RlbDogdGhpcy5tb2RlbFxuICAgICAgICB9O1xuICAgICAgICBjYWNoZVF1ZXJ5W3RoaXMubW9kZWwuaWRdID0gcmVtb3RlSWQ7XG4gICAgICAgIHZhciBjYWNoZWQgPSBjYWNoZS5nZXQoY2FjaGVRdWVyeSk7XG4gICAgICAgIGlmIChjYWNoZWQpIHtcbiAgICAgICAgICB0aGlzLm9iamVjdHNbbG9va3VwLmluZGV4XSA9IGNhY2hlZDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLm9iamVjdHNbbG9va3VwLmluZGV4XSA9IHRoaXMuX2luc3RhbmNlKCk7XG4gICAgICAgICAgLy8gSXQncyBpbXBvcnRhbnQgdGhhdCB3ZSBtYXAgdGhlIHJlbW90ZSBpZGVudGlmaWVyIGhlcmUgdG8gZW5zdXJlIHRoYXQgaXQgZW5kc1xuICAgICAgICAgIC8vIHVwIGluIHRoZSBjYWNoZS5cbiAgICAgICAgICB0aGlzLm9iamVjdHNbbG9va3VwLmluZGV4XVt0aGlzLm1vZGVsLmlkXSA9IHJlbW90ZUlkO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAvKipcbiAgICogRm9yIGluZGljZXMgd2hlcmUgbm8gb2JqZWN0IGlzIHByZXNlbnQsIHBlcmZvcm0gY2FjaGUgbG9va3VwcywgY3JlYXRpbmcgYSBuZXcgb2JqZWN0IGlmIG5lY2Vzc2FyeS5cbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9sb29rdXA6IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLm1vZGVsLnNpbmdsZXRvbikge1xuICAgICAgdGhpcy5fbG9va3VwU2luZ2xldG9uKCk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdmFyIGxvb2t1cHMgPSB0aGlzLl9zb3J0TG9va3VwcygpLFxuICAgICAgICByZW1vdGVMb29rdXBzID0gbG9va3Vwcy5yZW1vdGVMb29rdXBzLFxuICAgICAgICBsb2NhbExvb2t1cHMgPSBsb29rdXBzLmxvY2FsTG9va3VwcztcbiAgICAgIHRoaXMuX3BlcmZvcm1Mb2NhbExvb2t1cHMobG9jYWxMb29rdXBzKTtcbiAgICAgIHRoaXMuX3BlcmZvcm1SZW1vdGVMb29rdXBzKHJlbW90ZUxvb2t1cHMpO1xuICAgIH1cbiAgfSxcbiAgX2xvb2t1cFNpbmdsZXRvbjogZnVuY3Rpb24oKSB7XG4gICAgLy8gUGljayBhIHJhbmRvbSBsb2NhbElkIGZyb20gdGhlIGFycmF5IG9mIGRhdGEgYmVpbmcgbWFwcGVkIG9udG8gdGhlIHNpbmdsZXRvbiBvYmplY3QuIE5vdGUgdGhhdCB0aGV5IHNob3VsZFxuICAgIC8vIGFsd2F5cyBiZSB0aGUgc2FtZS4gVGhpcyBpcyBqdXN0IGEgcHJlY2F1dGlvbi5cbiAgICB2YXIgbG9jYWxJZGVudGlmaWVycyA9IHV0aWwucGx1Y2sodGhpcy5kYXRhLCAnbG9jYWxJZCcpLCBsb2NhbElkO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsb2NhbElkZW50aWZpZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAobG9jYWxJZGVudGlmaWVyc1tpXSkge1xuICAgICAgICBsb2NhbElkID0ge2xvY2FsSWQ6IGxvY2FsSWRlbnRpZmllcnNbaV19O1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gVGhlIG1hcHBpbmcgb3BlcmF0aW9uIGlzIHJlc3BvbnNpYmxlIGZvciBjcmVhdGluZyBzaW5nbGV0b24gaW5zdGFuY2VzIGlmIHRoZXkgZG8gbm90IGFscmVhZHkgZXhpc3QuXG4gICAgdmFyIHNpbmdsZXRvbiA9IGNhY2hlLmdldFNpbmdsZXRvbih0aGlzLm1vZGVsKSB8fCB0aGlzLl9pbnN0YW5jZShsb2NhbElkKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgdGhpcy5vYmplY3RzW2ldID0gc2luZ2xldG9uO1xuICAgIH1cbiAgfSxcbiAgX2luc3RhbmNlOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgbW9kZWwgPSB0aGlzLm1vZGVsLFxuICAgICAgbW9kZWxJbnN0YW5jZSA9IG1vZGVsLl9pbnN0YW5jZS5hcHBseShtb2RlbCwgYXJndW1lbnRzKTtcbiAgICB0aGlzLl9uZXdPYmplY3RzLnB1c2gobW9kZWxJbnN0YW5jZSk7XG4gICAgcmV0dXJuIG1vZGVsSW5zdGFuY2U7XG4gIH0sXG5cbiAgcHJlcHJvY2Vzc0RhdGE6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBkYXRhID0gdXRpbC5leHRlbmQoW10sIHRoaXMuZGF0YSk7XG4gICAgcmV0dXJuIGRhdGEubWFwKGZ1bmN0aW9uKGRhdHVtKSB7XG4gICAgICBpZiAoZGF0dW0pIHtcbiAgICAgICAgaWYgKCF1dGlsLmlzU3RyaW5nKGRhdHVtKSkge1xuICAgICAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMoZGF0dW0pO1xuICAgICAgICAgIGtleXMuZm9yRWFjaChmdW5jdGlvbihrKSB7XG4gICAgICAgICAgICB2YXIgaXNSZWxhdGlvbnNoaXAgPSB0aGlzLm1vZGVsLl9yZWxhdGlvbnNoaXBOYW1lcy5pbmRleE9mKGspID4gLTE7XG5cbiAgICAgICAgICAgIGlmIChpc1JlbGF0aW9uc2hpcCkge1xuICAgICAgICAgICAgICB2YXIgdmFsID0gZGF0dW1ba107XG4gICAgICAgICAgICAgIGlmICh2YWwgaW5zdGFuY2VvZiBNb2RlbEluc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgZGF0dW1ba10gPSB7bG9jYWxJZDogdmFsLmxvY2FsSWR9O1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gZGF0dW07XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcbiAgc3RhcnQ6IGZ1bmN0aW9uKGRvbmUpIHtcbiAgICB2YXIgZGF0YSA9IHRoaXMuZGF0YTtcbiAgICBpZiAoZGF0YS5sZW5ndGgpIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgIHZhciB0YXNrcyA9IFtdO1xuICAgICAgdGhpcy5fbG9va3VwKCk7XG4gICAgICB0YXNrcy5wdXNoKHRoaXMuX2V4ZWN1dGVTdWJPcGVyYXRpb25zLmJpbmQodGhpcykpO1xuICAgICAgdXRpbC5wYXJhbGxlbCh0YXNrcywgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgIGlmIChlcnIpIGNvbnNvbGUuZXJyb3IoZXJyKTtcbiAgICAgICAgc2VsZi5fbWFwKCk7XG4gICAgICAgIC8vIFVzZXJzIGFyZSBhbGxvd2VkIHRvIGFkZCBhIGN1c3RvbSBpbml0IG1ldGhvZCB0byB0aGUgbWV0aG9kcyBvYmplY3Qgd2hlbiBkZWZpbmluZyBhIE1vZGVsLCBvZiB0aGUgZm9ybTpcbiAgICAgICAgLy9cbiAgICAgICAgLy9cbiAgICAgICAgLy8gaW5pdDogZnVuY3Rpb24gKFtkb25lXSkge1xuICAgICAgICAvLyAgICAgLy8gLi4uXG4gICAgICAgIC8vICB9XG4gICAgICAgIC8vXG4gICAgICAgIC8vXG4gICAgICAgIC8vIElmIGRvbmUgaXMgcGFzc2VkLCB0aGVuIF9faW5pdCBtdXN0IGJlIGV4ZWN1dGVkIGFzeW5jaHJvbm91c2x5LCBhbmQgdGhlIG1hcHBpbmcgb3BlcmF0aW9uIHdpbGwgbm90XG4gICAgICAgIC8vIGZpbmlzaCB1bnRpbCBhbGwgaW5pdHMgaGF2ZSBleGVjdXRlZC5cbiAgICAgICAgLy9cbiAgICAgICAgLy8gSGVyZSB3ZSBlbnN1cmUgdGhlIGV4ZWN1dGlvbiBvZiBhbGwgb2YgdGhlbVxuICAgICAgICB2YXIgaW5pdFRhc2tzID0gc2VsZi5fbmV3T2JqZWN0cy5yZWR1Y2UoZnVuY3Rpb24obWVtbywgbykge1xuICAgICAgICAgIHZhciBpbml0ID0gby5tb2RlbC5pbml0O1xuICAgICAgICAgIGlmIChpbml0KSB7XG4gICAgICAgICAgICB2YXIgcGFyYW1OYW1lcyA9IHV0aWwucGFyYW1OYW1lcyhpbml0KTtcbiAgICAgICAgICAgIGlmIChwYXJhbU5hbWVzLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgICAgICAgIG1lbW8ucHVzaChpbml0LmJpbmQobywgZG9uZSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIGluaXQuY2FsbChvKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgby5fZW1pdEV2ZW50cyA9IHRydWU7XG4gICAgICAgICAgby5fZW1pdE5ldygpO1xuICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICB9LCBbXSk7XG4gICAgICAgIHV0aWwucGFyYWxsZWwoaW5pdFRhc2tzLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICBkb25lKHNlbGYuZXJyb3JzLmxlbmd0aCA/IHNlbGYuZXJyb3JzIDogbnVsbCwgc2VsZi5vYmplY3RzKTtcbiAgICAgICAgfSk7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH0gZWxzZSB7XG4gICAgICBkb25lKG51bGwsIFtdKTtcbiAgICB9XG4gIH0sXG4gIGdldFJlbGF0ZWREYXRhOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIGluZGV4ZXMgPSBbXTtcbiAgICB2YXIgcmVsYXRlZERhdGEgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGRhdHVtID0gdGhpcy5kYXRhW2ldO1xuICAgICAgaWYgKGRhdHVtKSB7XG4gICAgICAgIHZhciB2YWwgPSBkYXR1bVtuYW1lXTtcbiAgICAgICAgaWYgKHZhbCkge1xuICAgICAgICAgIGluZGV4ZXMucHVzaChpKTtcbiAgICAgICAgICByZWxhdGVkRGF0YS5wdXNoKHZhbCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIGluZGV4ZXM6IGluZGV4ZXMsXG4gICAgICByZWxhdGVkRGF0YTogcmVsYXRlZERhdGFcbiAgICB9O1xuICB9XG4gICxcbiAgcHJvY2Vzc0Vycm9yc0Zyb21UYXNrOiBmdW5jdGlvbihyZWxhdGlvbnNoaXBOYW1lLCBlcnJvcnMsIGluZGV4ZXMpIHtcbiAgICBpZiAoZXJyb3JzLmxlbmd0aCkge1xuICAgICAgdmFyIHJlbGF0ZWREYXRhID0gdGhpcy5nZXRSZWxhdGVkRGF0YShyZWxhdGlvbnNoaXBOYW1lKS5yZWxhdGVkRGF0YTtcbiAgICAgIHZhciB1bmZsYXR0ZW5lZEVycm9ycyA9IHV0aWwudW5mbGF0dGVuQXJyYXkoZXJyb3JzLCByZWxhdGVkRGF0YSk7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHVuZmxhdHRlbmVkRXJyb3JzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBpZHggPSBpbmRleGVzW2ldO1xuICAgICAgICB2YXIgZXJyID0gdW5mbGF0dGVuZWRFcnJvcnNbaV07XG4gICAgICAgIHZhciBpc0Vycm9yID0gZXJyO1xuICAgICAgICBpZiAodXRpbC5pc0FycmF5KGVycikpIGlzRXJyb3IgPSBlcnIucmVkdWNlKGZ1bmN0aW9uKG1lbW8sIHgpIHtcbiAgICAgICAgICByZXR1cm4gbWVtbyB8fCB4XG4gICAgICAgIH0sIGZhbHNlKTtcbiAgICAgICAgaWYgKGlzRXJyb3IpIHtcbiAgICAgICAgICBpZiAoIXRoaXMuZXJyb3JzW2lkeF0pIHRoaXMuZXJyb3JzW2lkeF0gPSB7fTtcbiAgICAgICAgICB0aGlzLmVycm9yc1tpZHhdW3JlbGF0aW9uc2hpcE5hbWVdID0gZXJyO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuICBfZXhlY3V0ZVN1Yk9wZXJhdGlvbnM6IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzLFxuICAgICAgcmVsYXRpb25zaGlwTmFtZXMgPSBPYmplY3Qua2V5cyh0aGlzLm1vZGVsLnJlbGF0aW9uc2hpcHMpO1xuICAgIGlmIChyZWxhdGlvbnNoaXBOYW1lcy5sZW5ndGgpIHtcbiAgICAgIHZhciB0YXNrcyA9IHJlbGF0aW9uc2hpcE5hbWVzLnJlZHVjZShmdW5jdGlvbihtLCByZWxhdGlvbnNoaXBOYW1lKSB7XG4gICAgICAgIHZhciByZWxhdGlvbnNoaXAgPSBzZWxmLm1vZGVsLnJlbGF0aW9uc2hpcHNbcmVsYXRpb25zaGlwTmFtZV07XG4gICAgICAgIHZhciByZXZlcnNlTW9kZWwgPSByZWxhdGlvbnNoaXAuZm9yd2FyZE5hbWUgPT0gcmVsYXRpb25zaGlwTmFtZSA/IHJlbGF0aW9uc2hpcC5yZXZlcnNlTW9kZWwgOiByZWxhdGlvbnNoaXAuZm9yd2FyZE1vZGVsO1xuICAgICAgICAvLyBNb2NrIGFueSBtaXNzaW5nIHNpbmdsZXRvbiBkYXRhIHRvIGVuc3VyZSB0aGF0IGFsbCBzaW5nbGV0b24gaW5zdGFuY2VzIGFyZSBjcmVhdGVkLlxuICAgICAgICBpZiAocmV2ZXJzZU1vZGVsLnNpbmdsZXRvbiAmJiAhcmVsYXRpb25zaGlwLmlzUmV2ZXJzZSkge1xuICAgICAgICAgIHRoaXMuZGF0YS5mb3JFYWNoKGZ1bmN0aW9uKGRhdHVtKSB7XG4gICAgICAgICAgICBpZiAoIWRhdHVtW3JlbGF0aW9uc2hpcE5hbWVdKSBkYXR1bVtyZWxhdGlvbnNoaXBOYW1lXSA9IHt9O1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHZhciBfX3JldCA9IHRoaXMuZ2V0UmVsYXRlZERhdGEocmVsYXRpb25zaGlwTmFtZSksXG4gICAgICAgICAgaW5kZXhlcyA9IF9fcmV0LmluZGV4ZXMsXG4gICAgICAgICAgcmVsYXRlZERhdGEgPSBfX3JldC5yZWxhdGVkRGF0YTtcbiAgICAgICAgaWYgKHJlbGF0ZWREYXRhLmxlbmd0aCkge1xuICAgICAgICAgIHZhciBmbGF0UmVsYXRlZERhdGEgPSB1dGlsLmZsYXR0ZW5BcnJheShyZWxhdGVkRGF0YSk7XG4gICAgICAgICAgdmFyIG9wID0gbmV3IE1hcHBpbmdPcGVyYXRpb24oe1xuICAgICAgICAgICAgbW9kZWw6IHJldmVyc2VNb2RlbCxcbiAgICAgICAgICAgIGRhdGE6IGZsYXRSZWxhdGVkRGF0YSxcbiAgICAgICAgICAgIGRpc2FibGVldmVudHM6IHNlbGYuZGlzYWJsZWV2ZW50cyxcbiAgICAgICAgICAgIF9pZ25vcmVJbnN0YWxsZWQ6IHNlbGYuX2lnbm9yZUluc3RhbGxlZFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wKSB7XG4gICAgICAgICAgdmFyIHRhc2s7XG4gICAgICAgICAgdGFzayA9IGZ1bmN0aW9uKGRvbmUpIHtcbiAgICAgICAgICAgIG9wLnN0YXJ0KGZ1bmN0aW9uKGVycm9ycywgb2JqZWN0cykge1xuICAgICAgICAgICAgICBzZWxmLnN1YlRhc2tSZXN1bHRzW3JlbGF0aW9uc2hpcE5hbWVdID0ge1xuICAgICAgICAgICAgICAgIGVycm9yczogZXJyb3JzLFxuICAgICAgICAgICAgICAgIG9iamVjdHM6IG9iamVjdHMsXG4gICAgICAgICAgICAgICAgaW5kZXhlczogaW5kZXhlc1xuICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICBzZWxmLnByb2Nlc3NFcnJvcnNGcm9tVGFzayhyZWxhdGlvbnNoaXBOYW1lLCBvcC5lcnJvcnMsIGluZGV4ZXMpO1xuICAgICAgICAgICAgICBkb25lKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9O1xuICAgICAgICAgIG0ucHVzaCh0YXNrKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbTtcbiAgICAgIH0uYmluZCh0aGlzKSwgW10pO1xuICAgICAgdXRpbC5wYXJhbGxlbCh0YXNrcywgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgY2FsbGJhY2soKTtcbiAgICB9XG4gIH1cbn0pXG47XG5cbm1vZHVsZS5leHBvcnRzID0gTWFwcGluZ09wZXJhdGlvbjtcblxuXG4vKiogV0VCUEFDSyBGT09URVIgKipcbiAqKiAuL2NvcmUvbWFwcGluZ09wZXJhdGlvbi5qc1xuICoqLyIsIid1c2Ugc3RyaWN0JztcblxudmFyIGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG52YXIgdG9TdHIgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXG52YXIgaXNBcnJheSA9IGZ1bmN0aW9uIGlzQXJyYXkoYXJyKSB7XG5cdGlmICh0eXBlb2YgQXJyYXkuaXNBcnJheSA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdHJldHVybiBBcnJheS5pc0FycmF5KGFycik7XG5cdH1cblxuXHRyZXR1cm4gdG9TdHIuY2FsbChhcnIpID09PSAnW29iamVjdCBBcnJheV0nO1xufTtcblxudmFyIGlzUGxhaW5PYmplY3QgPSBmdW5jdGlvbiBpc1BsYWluT2JqZWN0KG9iaikge1xuXHRpZiAoIW9iaiB8fCB0b1N0ci5jYWxsKG9iaikgIT09ICdbb2JqZWN0IE9iamVjdF0nKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0dmFyIGhhc093bkNvbnN0cnVjdG9yID0gaGFzT3duLmNhbGwob2JqLCAnY29uc3RydWN0b3InKTtcblx0dmFyIGhhc0lzUHJvdG90eXBlT2YgPSBvYmouY29uc3RydWN0b3IgJiYgb2JqLmNvbnN0cnVjdG9yLnByb3RvdHlwZSAmJiBoYXNPd24uY2FsbChvYmouY29uc3RydWN0b3IucHJvdG90eXBlLCAnaXNQcm90b3R5cGVPZicpO1xuXHQvLyBOb3Qgb3duIGNvbnN0cnVjdG9yIHByb3BlcnR5IG11c3QgYmUgT2JqZWN0XG5cdGlmIChvYmouY29uc3RydWN0b3IgJiYgIWhhc093bkNvbnN0cnVjdG9yICYmICFoYXNJc1Byb3RvdHlwZU9mKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0Ly8gT3duIHByb3BlcnRpZXMgYXJlIGVudW1lcmF0ZWQgZmlyc3RseSwgc28gdG8gc3BlZWQgdXAsXG5cdC8vIGlmIGxhc3Qgb25lIGlzIG93biwgdGhlbiBhbGwgcHJvcGVydGllcyBhcmUgb3duLlxuXHR2YXIga2V5O1xuXHRmb3IgKGtleSBpbiBvYmopIHsvKiovfVxuXG5cdHJldHVybiB0eXBlb2Yga2V5ID09PSAndW5kZWZpbmVkJyB8fCBoYXNPd24uY2FsbChvYmosIGtleSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGV4dGVuZCgpIHtcblx0dmFyIG9wdGlvbnMsIG5hbWUsIHNyYywgY29weSwgY29weUlzQXJyYXksIGNsb25lLFxuXHRcdHRhcmdldCA9IGFyZ3VtZW50c1swXSxcblx0XHRpID0gMSxcblx0XHRsZW5ndGggPSBhcmd1bWVudHMubGVuZ3RoLFxuXHRcdGRlZXAgPSBmYWxzZTtcblxuXHQvLyBIYW5kbGUgYSBkZWVwIGNvcHkgc2l0dWF0aW9uXG5cdGlmICh0eXBlb2YgdGFyZ2V0ID09PSAnYm9vbGVhbicpIHtcblx0XHRkZWVwID0gdGFyZ2V0O1xuXHRcdHRhcmdldCA9IGFyZ3VtZW50c1sxXSB8fCB7fTtcblx0XHQvLyBza2lwIHRoZSBib29sZWFuIGFuZCB0aGUgdGFyZ2V0XG5cdFx0aSA9IDI7XG5cdH0gZWxzZSBpZiAoKHR5cGVvZiB0YXJnZXQgIT09ICdvYmplY3QnICYmIHR5cGVvZiB0YXJnZXQgIT09ICdmdW5jdGlvbicpIHx8IHRhcmdldCA9PSBudWxsKSB7XG5cdFx0dGFyZ2V0ID0ge307XG5cdH1cblxuXHRmb3IgKDsgaSA8IGxlbmd0aDsgKytpKSB7XG5cdFx0b3B0aW9ucyA9IGFyZ3VtZW50c1tpXTtcblx0XHQvLyBPbmx5IGRlYWwgd2l0aCBub24tbnVsbC91bmRlZmluZWQgdmFsdWVzXG5cdFx0aWYgKG9wdGlvbnMgIT0gbnVsbCkge1xuXHRcdFx0Ly8gRXh0ZW5kIHRoZSBiYXNlIG9iamVjdFxuXHRcdFx0Zm9yIChuYW1lIGluIG9wdGlvbnMpIHtcblx0XHRcdFx0c3JjID0gdGFyZ2V0W25hbWVdO1xuXHRcdFx0XHRjb3B5ID0gb3B0aW9uc1tuYW1lXTtcblxuXHRcdFx0XHQvLyBQcmV2ZW50IG5ldmVyLWVuZGluZyBsb29wXG5cdFx0XHRcdGlmICh0YXJnZXQgIT09IGNvcHkpIHtcblx0XHRcdFx0XHQvLyBSZWN1cnNlIGlmIHdlJ3JlIG1lcmdpbmcgcGxhaW4gb2JqZWN0cyBvciBhcnJheXNcblx0XHRcdFx0XHRpZiAoZGVlcCAmJiBjb3B5ICYmIChpc1BsYWluT2JqZWN0KGNvcHkpIHx8IChjb3B5SXNBcnJheSA9IGlzQXJyYXkoY29weSkpKSkge1xuXHRcdFx0XHRcdFx0aWYgKGNvcHlJc0FycmF5KSB7XG5cdFx0XHRcdFx0XHRcdGNvcHlJc0FycmF5ID0gZmFsc2U7XG5cdFx0XHRcdFx0XHRcdGNsb25lID0gc3JjICYmIGlzQXJyYXkoc3JjKSA/IHNyYyA6IFtdO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0Y2xvbmUgPSBzcmMgJiYgaXNQbGFpbk9iamVjdChzcmMpID8gc3JjIDoge307XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdC8vIE5ldmVyIG1vdmUgb3JpZ2luYWwgb2JqZWN0cywgY2xvbmUgdGhlbVxuXHRcdFx0XHRcdFx0dGFyZ2V0W25hbWVdID0gZXh0ZW5kKGRlZXAsIGNsb25lLCBjb3B5KTtcblxuXHRcdFx0XHRcdC8vIERvbid0IGJyaW5nIGluIHVuZGVmaW5lZCB2YWx1ZXNcblx0XHRcdFx0XHR9IGVsc2UgaWYgKHR5cGVvZiBjb3B5ICE9PSAndW5kZWZpbmVkJykge1xuXHRcdFx0XHRcdFx0dGFyZ2V0W25hbWVdID0gY29weTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvLyBSZXR1cm4gdGhlIG1vZGlmaWVkIG9iamVjdFxuXHRyZXR1cm4gdGFyZ2V0O1xufTtcblxuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL34vZXh0ZW5kL2luZGV4LmpzXG4gKiogbW9kdWxlIGlkID0gMjhcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsInZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XG5cbmZ1bmN0aW9uIENvbmRpdGlvbihmbiwgbGF6eSkge1xuICBpZiAobGF6eSA9PT0gdW5kZWZpbmVkIHx8IGxhenkgPT09IG51bGwpIHtcbiAgICBsYXp5ID0gdHJ1ZTtcbiAgfVxuICBmbiA9IGZuIHx8IGZ1bmN0aW9uKGRvbmUpIHtcbiAgICBkb25lKCk7XG4gIH07XG5cbiAgdGhpcy5fcHJvbWlzZSA9IG5ldyB1dGlsLlByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgdGhpcy5mbiA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5leGVjdXRlZCA9IHRydWU7XG4gICAgICB2YXIgbnVtQ29tcGxldGUgPSAwO1xuICAgICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICAgIHZhciBlcnJvcnMgPSBbXTtcbiAgICAgIGlmICh1dGlsLmlzQXJyYXkoZm4pKSB7XG4gICAgICAgIHZhciBjaGVja0NvbXBsZXRlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgaWYgKG51bUNvbXBsZXRlLmxlbmd0aCA9PSBmbi5sZW5ndGgpIHtcbiAgICAgICAgICAgIGlmIChlcnJvcnMubGVuZ3RoKSB0aGlzLl9wcm9taXNlLnJlamVjdChlcnJvcnMpO1xuICAgICAgICAgICAgZWxzZSB0aGlzLl9wcm9taXNlLnJlc29sdmUobnVsbCwgcmVzdWx0cyk7XG4gICAgICAgICAgfVxuICAgICAgICB9LmJpbmQodGhpcyk7XG5cbiAgICAgICAgZm4uZm9yRWFjaChmdW5jdGlvbihjb25kLCBpZHgpIHtcbiAgICAgICAgICBjb25kLnRoZW4oZnVuY3Rpb24ocmVzKSB7XG4gICAgICAgICAgICByZXN1bHRzW2lkeF0gPSByZXM7XG4gICAgICAgICAgICBudW1Db21wbGV0ZSsrO1xuICAgICAgICAgICAgY2hlY2tDb21wbGV0ZSgpO1xuICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgZXJyb3JzW2lkeF0gPSBlcnI7XG4gICAgICAgICAgICBudW1Db21wbGV0ZSsrO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBmbihmdW5jdGlvbihlcnIsIHJlcykge1xuICAgICAgICAgIGlmIChlcnIpIHJlamVjdChlcnIpO1xuICAgICAgICAgIGVsc2UgcmVzb2x2ZShyZXMpO1xuICAgICAgICB9LmJpbmQodGhpcykpXG4gICAgICB9XG4gICAgfVxuICB9LmJpbmQodGhpcykpO1xuXG4gIGlmICghbGF6eSkgdGhpcy5fZXhlY3V0ZSgpO1xuICB0aGlzLmV4ZWN1dGVkID0gZmFsc2U7XG59XG5cbkNvbmRpdGlvbi5wcm90b3R5cGUgPSB7XG4gIF9leGVjdXRlOiBmdW5jdGlvbigpIHtcbiAgICBpZiAoIXRoaXMuZXhlY3V0ZWQpIHRoaXMuZm4oKTtcbiAgfSxcbiAgdGhlbjogZnVuY3Rpb24oc3VjY2VzcywgZmFpbCkge1xuICAgIHRoaXMuX2V4ZWN1dGUoKTtcbiAgICByZXR1cm4gdGhpcy5fcHJvbWlzZS50aGVuKHN1Y2Nlc3MsIGZhaWwpO1xuICB9LFxuICBjYXRjaDogZnVuY3Rpb24oZmFpbCkge1xuICAgIHRoaXMuX2V4ZWN1dGUoKTtcbiAgICByZXR1cm4gdGhpcy5fcHJvbWlzZS5jYXRjaChmYWlsKTtcbiAgfSxcbiAgcmVzb2x2ZTogZnVuY3Rpb24gKHJlcykge1xuICAgIHRoaXMuZXhlY3V0ZWQgPSB0cnVlO1xuICAgIHRoaXMuX3Byb21pc2UucmVzb2x2ZShyZXMpO1xuICB9LFxuICByZWplY3Q6IGZ1bmN0aW9uIChlcnIpIHtcbiAgICB0aGlzLmV4ZWN1dGVkID0gdHJ1ZTtcbiAgICB0aGlzLl9wcm9taXNlLnJlamVjdChlcnIpO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IENvbmRpdGlvbjtcblxuXG4vKiogV0VCUEFDSyBGT09URVIgKipcbiAqKiAuL2NvcmUvQ29uZGl0aW9uLmpzXG4gKiovIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcblxuLyoqXG4gKiBBY3RzIGFzIGEgcGxhY2Vob2xkZXIgZm9yIHZhcmlvdXMgb2JqZWN0cyBlLmcuIGxhenkgcmVnaXN0cmF0aW9uIG9mIG1vZGVscy5cbiAqIEBwYXJhbSBbb3B0c11cbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBQbGFjZWhvbGRlcihvcHRzKSB7XG4gIHV0aWwuZXh0ZW5kKHRoaXMsIG9wdHMgfHwge30pO1xuICB0aGlzLmlzUGxhY2Vob2xkZXIgPSB0cnVlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFBsYWNlaG9sZGVyO1xuXG5cbi8qKiBXRUJQQUNLIEZPT1RFUiAqKlxuICoqIC4vY29yZS9QbGFjZWhvbGRlci5qc1xuICoqLyIsIi8qKlxuICogRm9yIHRob3NlIGZhbWlsaWFyIHdpdGggQXBwbGUncyBDb2NvYSBsaWJyYXJ5LCByZWFjdGl2ZSBxdWVyaWVzIHJvdWdobHkgbWFwIG9udG8gTlNGZXRjaGVkUmVzdWx0c0NvbnRyb2xsZXIuXG4gKlxuICogVGhleSBwcmVzZW50IGEgcXVlcnkgc2V0IHRoYXQgJ3JlYWN0cycgdG8gY2hhbmdlcyBpbiB0aGUgdW5kZXJseWluZyBkYXRhLlxuICogQG1vZHVsZSByZWFjdGl2ZVF1ZXJ5XG4gKi9cblxudmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJykoJ3F1ZXJ5OnJlYWN0aXZlJyksXG4gIFF1ZXJ5ID0gcmVxdWlyZSgnLi9RdWVyeScpLFxuICBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXIsXG4gIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gIENoYWluID0gcmVxdWlyZSgnLi9DaGFpbicpLFxuICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICBjb25zdHJ1Y3RRdWVyeVNldCA9IHJlcXVpcmUoJy4vUXVlcnlTZXQnKSxcbiAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpO1xuXG4vKipcbiAqXG4gKiBAcGFyYW0ge1F1ZXJ5fSBxdWVyeSAtIFRoZSB1bmRlcmx5aW5nIHF1ZXJ5XG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gUmVhY3RpdmVRdWVyeShxdWVyeSkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIEV2ZW50RW1pdHRlci5jYWxsKHRoaXMpO1xuICBDaGFpbi5jYWxsKHRoaXMpO1xuICB1dGlsLmV4dGVuZCh0aGlzLCB7XG4gICAgaW5zZXJ0aW9uUG9saWN5OiBSZWFjdGl2ZVF1ZXJ5Lkluc2VydGlvblBvbGljeS5CYWNrLFxuICAgIGluaXRpYWxpc2VkOiBmYWxzZVxuICB9KTtcblxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ3F1ZXJ5Jywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5fcXVlcnlcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odikge1xuICAgICAgaWYgKHYpIHtcbiAgICAgICAgdGhpcy5fcXVlcnkgPSB2O1xuICAgICAgICB0aGlzLnJlc3VsdHMgPSBjb25zdHJ1Y3RRdWVyeVNldChbXSwgdi5tb2RlbCk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgdGhpcy5fcXVlcnkgPSBudWxsO1xuICAgICAgICB0aGlzLnJlc3VsdHMgPSBudWxsO1xuICAgICAgfVxuICAgIH0sXG4gICAgY29uZmlndXJhYmxlOiBmYWxzZSxcbiAgICBlbnVtZXJhYmxlOiB0cnVlXG4gIH0pO1xuXG4gIGlmIChxdWVyeSkge1xuICAgIHV0aWwuZXh0ZW5kKHRoaXMsIHtcbiAgICAgIF9xdWVyeTogcXVlcnksXG4gICAgICByZXN1bHRzOiBjb25zdHJ1Y3RRdWVyeVNldChbXSwgcXVlcnkubW9kZWwpXG4gICAgfSlcbiAgfVxuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHRoaXMsIHtcbiAgICBpbml0aWFsaXplZDoge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaW5pdGlhbGlzZWRcbiAgICAgIH1cbiAgICB9LFxuICAgIG1vZGVsOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgcXVlcnkgPSBzZWxmLl9xdWVyeTtcbiAgICAgICAgaWYgKHF1ZXJ5KSB7XG4gICAgICAgICAgcmV0dXJuIHF1ZXJ5Lm1vZGVsXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIGNvbGxlY3Rpb246IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBzZWxmLm1vZGVsLmNvbGxlY3Rpb25OYW1lXG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuXG59XG5cblJlYWN0aXZlUXVlcnkucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShFdmVudEVtaXR0ZXIucHJvdG90eXBlKTtcbnV0aWwuZXh0ZW5kKFJlYWN0aXZlUXVlcnkucHJvdG90eXBlLCBDaGFpbi5wcm90b3R5cGUpO1xuXG51dGlsLmV4dGVuZChSZWFjdGl2ZVF1ZXJ5LCB7XG4gIEluc2VydGlvblBvbGljeToge1xuICAgIEZyb250OiAnRnJvbnQnLFxuICAgIEJhY2s6ICdCYWNrJ1xuICB9XG59KTtcblxudXRpbC5leHRlbmQoUmVhY3RpdmVRdWVyeS5wcm90b3R5cGUsIHtcbiAgLyoqXG4gICAqXG4gICAqIEBwYXJhbSBjYlxuICAgKiBAcGFyYW0ge2Jvb2x9IF9pZ25vcmVJbml0IC0gZXhlY3V0ZSBxdWVyeSBhZ2FpbiwgaW5pdGlhbGlzZWQgb3Igbm90LlxuICAgKiBAcmV0dXJucyB7Kn1cbiAgICovXG4gIGluaXQ6IGZ1bmN0aW9uKGNiLCBfaWdub3JlSW5pdCkge1xuICAgIGlmICh0aGlzLl9xdWVyeSkge1xuICAgICAgdmFyIG5hbWUgPSB0aGlzLl9jb25zdHJ1Y3ROb3RpZmljYXRpb25OYW1lKCk7XG4gICAgICB2YXIgaGFuZGxlciA9IGZ1bmN0aW9uKG4pIHtcbiAgICAgICAgdGhpcy5faGFuZGxlTm90aWYobik7XG4gICAgICB9LmJpbmQodGhpcyk7XG4gICAgICB0aGlzLmhhbmRsZXIgPSBoYW5kbGVyO1xuICAgICAgZXZlbnRzLm9uKG5hbWUsIGhhbmRsZXIpO1xuICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgICAgaWYgKCghdGhpcy5pbml0aWFsaXNlZCkgfHwgX2lnbm9yZUluaXQpIHtcbiAgICAgICAgICB0aGlzLl9xdWVyeS5leGVjdXRlKGZ1bmN0aW9uKGVyciwgcmVzdWx0cykge1xuICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgY2IobnVsbCwgdGhpcy5fYXBwbHlSZXN1bHRzKHJlc3VsdHMpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICBjYihlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgY2IobnVsbCwgdGhpcy5yZXN1bHRzKTtcbiAgICAgICAgfVxuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG4gICAgZWxzZSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gX3F1ZXJ5IGRlZmluZWQnKTtcbiAgfSxcbiAgX2FwcGx5UmVzdWx0czogZnVuY3Rpb24ocmVzdWx0cykge1xuICAgIHRoaXMucmVzdWx0cyA9IHJlc3VsdHM7XG4gICAgdGhpcy5pbml0aWFsaXNlZCA9IHRydWU7XG4gICAgcmV0dXJuIHRoaXMucmVzdWx0cztcbiAgfSxcbiAgaW5zZXJ0OiBmdW5jdGlvbihuZXdPYmopIHtcbiAgICB2YXIgcmVzdWx0cyA9IHRoaXMucmVzdWx0cy5tdXRhYmxlQ29weSgpO1xuICAgIGlmICh0aGlzLmluc2VydGlvblBvbGljeSA9PSBSZWFjdGl2ZVF1ZXJ5Lkluc2VydGlvblBvbGljeS5CYWNrKSB2YXIgaWR4ID0gcmVzdWx0cy5wdXNoKG5ld09iaik7XG4gICAgZWxzZSBpZHggPSByZXN1bHRzLnVuc2hpZnQobmV3T2JqKTtcbiAgICB0aGlzLnJlc3VsdHMgPSByZXN1bHRzLmFzTW9kZWxRdWVyeVNldCh0aGlzLm1vZGVsKTtcbiAgICByZXR1cm4gaWR4O1xuICB9LFxuICAvKipcbiAgICogRXhlY3V0ZSB0aGUgdW5kZXJseWluZyBxdWVyeSBhZ2Fpbi5cbiAgICogQHBhcmFtIGNiXG4gICAqL1xuICB1cGRhdGU6IGZ1bmN0aW9uKGNiKSB7XG4gICAgcmV0dXJuIHRoaXMuaW5pdChjYiwgdHJ1ZSlcbiAgfSxcbiAgX2hhbmRsZU5vdGlmOiBmdW5jdGlvbihuKSB7XG4gICAgaWYgKG4udHlwZSA9PSBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5OZXcpIHtcbiAgICAgIHZhciBuZXdPYmogPSBuLm5ldztcbiAgICAgIGlmICh0aGlzLl9xdWVyeS5vYmplY3RNYXRjaGVzUXVlcnkobmV3T2JqKSkge1xuICAgICAgICBsb2coJ05ldyBvYmplY3QgbWF0Y2hlcycsIG5ld09iaik7XG4gICAgICAgIHZhciBpZHggPSB0aGlzLmluc2VydChuZXdPYmopO1xuICAgICAgICB0aGlzLmVtaXQobW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLCB7XG4gICAgICAgICAgaW5kZXg6IGlkeCxcbiAgICAgICAgICBhZGRlZDogW25ld09ial0sXG4gICAgICAgICAgdHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgIG9iajogdGhpc1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBsb2coJ05ldyBvYmplY3QgZG9lcyBub3QgbWF0Y2gnLCBuZXdPYmopO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIGlmIChuLnR5cGUgPT0gbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU2V0KSB7XG4gICAgICBuZXdPYmogPSBuLm9iajtcbiAgICAgIHZhciBpbmRleCA9IHRoaXMucmVzdWx0cy5pbmRleE9mKG5ld09iaiksXG4gICAgICAgIGFscmVhZHlDb250YWlucyA9IGluZGV4ID4gLTEsXG4gICAgICAgIG1hdGNoZXMgPSB0aGlzLl9xdWVyeS5vYmplY3RNYXRjaGVzUXVlcnkobmV3T2JqKTtcbiAgICAgIGlmIChtYXRjaGVzICYmICFhbHJlYWR5Q29udGFpbnMpIHtcbiAgICAgICAgbG9nKCdVcGRhdGVkIG9iamVjdCBub3cgbWF0Y2hlcyEnLCBuZXdPYmopO1xuICAgICAgICBpZHggPSB0aGlzLmluc2VydChuZXdPYmopO1xuICAgICAgICB0aGlzLmVtaXQobW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLCB7XG4gICAgICAgICAgaW5kZXg6IGlkeCxcbiAgICAgICAgICBhZGRlZDogW25ld09ial0sXG4gICAgICAgICAgdHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgIG9iajogdGhpc1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKCFtYXRjaGVzICYmIGFscmVhZHlDb250YWlucykge1xuICAgICAgICBsb2coJ1VwZGF0ZWQgb2JqZWN0IG5vIGxvbmdlciBtYXRjaGVzIScsIG5ld09iaik7XG4gICAgICAgIHJlc3VsdHMgPSB0aGlzLnJlc3VsdHMubXV0YWJsZUNvcHkoKTtcbiAgICAgICAgdmFyIHJlbW92ZWQgPSByZXN1bHRzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIHRoaXMucmVzdWx0cyA9IHJlc3VsdHMuYXNNb2RlbFF1ZXJ5U2V0KHRoaXMubW9kZWwpO1xuICAgICAgICB0aGlzLmVtaXQobW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLCB7XG4gICAgICAgICAgaW5kZXg6IGluZGV4LFxuICAgICAgICAgIG9iajogdGhpcyxcbiAgICAgICAgICBuZXc6IG5ld09iaixcbiAgICAgICAgICB0eXBlOiBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgICAgICAgcmVtb3ZlZDogcmVtb3ZlZFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKCFtYXRjaGVzICYmICFhbHJlYWR5Q29udGFpbnMpIHtcbiAgICAgICAgbG9nKCdEb2VzIG5vdCBjb250YWluLCBidXQgZG9lc250IG1hdGNoIHNvIG5vdCBpbnNlcnRpbmcnLCBuZXdPYmopO1xuICAgICAgfVxuICAgICAgZWxzZSBpZiAobWF0Y2hlcyAmJiBhbHJlYWR5Q29udGFpbnMpIHtcbiAgICAgICAgbG9nKCdNYXRjaGVzIGJ1dCBhbHJlYWR5IGNvbnRhaW5zJywgbmV3T2JqKTtcbiAgICAgICAgLy8gU2VuZCB0aGUgbm90aWZpY2F0aW9uIG92ZXIuXG4gICAgICAgIHRoaXMuZW1pdChuLnR5cGUsIG4pO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIGlmIChuLnR5cGUgPT0gbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuUmVtb3ZlKSB7XG4gICAgICBuZXdPYmogPSBuLm9iajtcbiAgICAgIHZhciByZXN1bHRzID0gdGhpcy5yZXN1bHRzLm11dGFibGVDb3B5KCk7XG4gICAgICBpbmRleCA9IHJlc3VsdHMuaW5kZXhPZihuZXdPYmopO1xuICAgICAgaWYgKGluZGV4ID4gLTEpIHtcbiAgICAgICAgbG9nKCdSZW1vdmluZyBvYmplY3QnLCBuZXdPYmopO1xuICAgICAgICByZW1vdmVkID0gcmVzdWx0cy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICB0aGlzLnJlc3VsdHMgPSBjb25zdHJ1Y3RRdWVyeVNldChyZXN1bHRzLCB0aGlzLm1vZGVsKTtcbiAgICAgICAgdGhpcy5lbWl0KG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSwge1xuICAgICAgICAgIGluZGV4OiBpbmRleCxcbiAgICAgICAgICBvYmo6IHRoaXMsXG4gICAgICAgICAgdHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgIHJlbW92ZWQ6IHJlbW92ZWRcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgbG9nKCdObyBtb2RlbEV2ZW50cyBuZWNjZXNzYXJ5LicsIG5ld09iaik7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ1Vua25vd24gY2hhbmdlIHR5cGUgXCInICsgbi50eXBlLnRvU3RyaW5nKCkgKyAnXCInKVxuICAgIH1cbiAgICB0aGlzLnJlc3VsdHMgPSBjb25zdHJ1Y3RRdWVyeVNldCh0aGlzLl9xdWVyeS5fc29ydFJlc3VsdHModGhpcy5yZXN1bHRzKSwgdGhpcy5tb2RlbCk7XG4gIH0sXG4gIF9jb25zdHJ1Y3ROb3RpZmljYXRpb25OYW1lOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jb2xsZWN0aW9uTmFtZSArICc6JyArIHRoaXMubW9kZWwubmFtZTtcbiAgfSxcbiAgdGVybWluYXRlOiBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5oYW5kbGVyKSB7XG4gICAgICBldmVudHMucmVtb3ZlTGlzdGVuZXIodGhpcy5fY29uc3RydWN0Tm90aWZpY2F0aW9uTmFtZSgpLCB0aGlzLmhhbmRsZXIpO1xuICAgIH1cbiAgICB0aGlzLnJlc3VsdHMgPSBudWxsO1xuICAgIHRoaXMuaGFuZGxlciA9IG51bGw7XG4gIH0sXG4gIF9yZWdpc3RlckV2ZW50SGFuZGxlcjogZnVuY3Rpb24ob24sIG5hbWUsIGZuKSB7XG4gICAgdmFyIHJlbW92ZUxpc3RlbmVyID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lcjtcbiAgICBpZiAobmFtZS50cmltKCkgPT0gJyonKSB7XG4gICAgICBPYmplY3Qua2V5cyhtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZSkuZm9yRWFjaChmdW5jdGlvbihrKSB7XG4gICAgICAgIG9uLmNhbGwodGhpcywgbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGVba10sIGZuKTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgb24uY2FsbCh0aGlzLCBuYW1lLCBmbik7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9saW5rKHtcbiAgICAgICAgb246IHRoaXMub24uYmluZCh0aGlzKSxcbiAgICAgICAgb25jZTogdGhpcy5vbmNlLmJpbmQodGhpcyksXG4gICAgICAgIHVwZGF0ZTogdGhpcy51cGRhdGUuYmluZCh0aGlzKSxcbiAgICAgICAgaW5zZXJ0OiB0aGlzLmluc2VydC5iaW5kKHRoaXMpXG4gICAgICB9LFxuICAgICAgZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmIChuYW1lLnRyaW0oKSA9PSAnKicpIHtcbiAgICAgICAgICBPYmplY3Qua2V5cyhtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZSkuZm9yRWFjaChmdW5jdGlvbihrKSB7XG4gICAgICAgICAgICByZW1vdmVMaXN0ZW5lci5jYWxsKHRoaXMsIG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlW2tdLCBmbik7XG4gICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICByZW1vdmVMaXN0ZW5lci5jYWxsKHRoaXMsIG5hbWUsIGZuKTtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgfSxcbiAgb246IGZ1bmN0aW9uKG5hbWUsIGZuKSB7XG4gICAgcmV0dXJuIHRoaXMuX3JlZ2lzdGVyRXZlbnRIYW5kbGVyKEV2ZW50RW1pdHRlci5wcm90b3R5cGUub24sIG5hbWUsIGZuKTtcbiAgfSxcbiAgb25jZTogZnVuY3Rpb24obmFtZSwgZm4pIHtcbiAgICByZXR1cm4gdGhpcy5fcmVnaXN0ZXJFdmVudEhhbmRsZXIoRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlLCBuYW1lLCBmbik7XG4gIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFJlYWN0aXZlUXVlcnk7XG5cblxuLyoqIFdFQlBBQ0sgRk9PVEVSICoqXG4gKiogLi9jb3JlL1JlYWN0aXZlUXVlcnkuanNcbiAqKi8iLCJ2YXIgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSgnbW9kZWwnKSxcbiAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICBSZWxhdGlvbnNoaXBUeXBlID0gcmVxdWlyZSgnLi9SZWxhdGlvbnNoaXBUeXBlJyksXG4gIFF1ZXJ5ID0gcmVxdWlyZSgnLi9RdWVyeScpLFxuICBNb2RlbEluc3RhbmNlID0gcmVxdWlyZSgnLi9Nb2RlbEluc3RhbmNlJyksXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgZ3VpZCA9IHV0aWwuZ3VpZCxcbiAgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyksXG4gIGV4dGVuZCA9IHJlcXVpcmUoJ2V4dGVuZCcpLFxuICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgd3JhcEFycmF5ID0gcmVxdWlyZSgnLi9ldmVudHMnKS53cmFwQXJyYXksXG4gIE9uZVRvTWFueVByb3h5ID0gcmVxdWlyZSgnLi9PbmVUb01hbnlQcm94eScpLFxuICBPbmVUb09uZVByb3h5ID0gcmVxdWlyZSgnLi9PbmVUb09uZVByb3h5JyksXG4gIE1hbnlUb01hbnlQcm94eSA9IHJlcXVpcmUoJy4vTWFueVRvTWFueVByb3h5JyksXG4gIFJlYWN0aXZlUXVlcnkgPSByZXF1aXJlKCcuL1JlYWN0aXZlUXVlcnknKSxcbiAgTW9kZWxFdmVudFR5cGUgPSBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZTtcblxuZnVuY3Rpb24gTW9kZWxJbnN0YW5jZUZhY3RvcnkobW9kZWwpIHtcbiAgdGhpcy5tb2RlbCA9IG1vZGVsO1xufVxuXG5Nb2RlbEluc3RhbmNlRmFjdG9yeS5wcm90b3R5cGUgPSB7XG4gIF9nZXRMb2NhbElkOiBmdW5jdGlvbihkYXRhKSB7XG4gICAgdmFyIGxvY2FsSWQ7XG4gICAgaWYgKGRhdGEpIHtcbiAgICAgIGxvY2FsSWQgPSBkYXRhLmxvY2FsSWQgPyBkYXRhLmxvY2FsSWQgOiBndWlkKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvY2FsSWQgPSBndWlkKCk7XG4gICAgfVxuICAgIHJldHVybiBsb2NhbElkO1xuICB9LFxuICAvKipcbiAgICogQ29uZmlndXJlIGF0dHJpYnV0ZXNcbiAgICogQHBhcmFtIG1vZGVsSW5zdGFuY2VcbiAgICogQHBhcmFtIGRhdGFcbiAgICogQHByaXZhdGVcbiAgICovXG5cbiAgX2luc3RhbGxBdHRyaWJ1dGVzOiBmdW5jdGlvbihtb2RlbEluc3RhbmNlLCBkYXRhKSB7XG4gICAgdmFyIE1vZGVsID0gdGhpcy5tb2RlbCxcbiAgICAgIGF0dHJpYnV0ZU5hbWVzID0gTW9kZWwuX2F0dHJpYnV0ZU5hbWVzLFxuICAgICAgaWR4ID0gYXR0cmlidXRlTmFtZXMuaW5kZXhPZihNb2RlbC5pZCk7XG4gICAgdXRpbC5leHRlbmQobW9kZWxJbnN0YW5jZSwge1xuICAgICAgX192YWx1ZXM6IHV0aWwuZXh0ZW5kKE1vZGVsLmF0dHJpYnV0ZXMucmVkdWNlKGZ1bmN0aW9uKG0sIGEpIHtcbiAgICAgICAgaWYgKGEuZGVmYXVsdCAhPT0gdW5kZWZpbmVkKSBtW2EubmFtZV0gPSBhLmRlZmF1bHQ7XG4gICAgICAgIHJldHVybiBtO1xuICAgICAgfSwge30pLCBkYXRhIHx8IHt9KVxuICAgIH0pO1xuICAgIGlmIChpZHggPiAtMSkgYXR0cmlidXRlTmFtZXMuc3BsaWNlKGlkeCwgMSk7XG4gICAgYXR0cmlidXRlTmFtZXMuZm9yRWFjaChmdW5jdGlvbihhdHRyaWJ1dGVOYW1lKSB7XG4gICAgICB2YXIgYXR0cmlidXRlRGVmaW5pdGlvbiA9IE1vZGVsLl9hdHRyaWJ1dGVEZWZpbml0aW9uV2l0aE5hbWUoYXR0cmlidXRlTmFtZSk7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobW9kZWxJbnN0YW5jZSwgYXR0cmlidXRlTmFtZSwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciB2YWx1ZSA9IG1vZGVsSW5zdGFuY2UuX192YWx1ZXNbYXR0cmlidXRlTmFtZV07XG4gICAgICAgICAgcmV0dXJuIHZhbHVlID09PSB1bmRlZmluZWQgPyBudWxsIDogdmFsdWU7XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24odikge1xuICAgICAgICAgIGlmIChhdHRyaWJ1dGVEZWZpbml0aW9uLnBhcnNlKSB7XG4gICAgICAgICAgICB2ID0gYXR0cmlidXRlRGVmaW5pdGlvbi5wYXJzZS5jYWxsKG1vZGVsSW5zdGFuY2UsIHYpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoTW9kZWwucGFyc2VBdHRyaWJ1dGUpIHtcbiAgICAgICAgICAgIHYgPSBNb2RlbC5wYXJzZUF0dHJpYnV0ZS5jYWxsKG1vZGVsSW5zdGFuY2UsIGF0dHJpYnV0ZU5hbWUsIHYpO1xuICAgICAgICAgIH1cbiAgICAgICAgICB2YXIgb2xkID0gbW9kZWxJbnN0YW5jZS5fX3ZhbHVlc1thdHRyaWJ1dGVOYW1lXTtcbiAgICAgICAgICB2YXIgcHJvcGVydHlEZXBlbmRlbmNpZXMgPSB0aGlzLl9wcm9wZXJ0eURlcGVuZGVuY2llc1thdHRyaWJ1dGVOYW1lXSB8fCBbXTtcbiAgICAgICAgICBwcm9wZXJ0eURlcGVuZGVuY2llcyA9IHByb3BlcnR5RGVwZW5kZW5jaWVzLm1hcChmdW5jdGlvbihkZXBlbmRhbnQpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIHByb3A6IGRlcGVuZGFudCxcbiAgICAgICAgICAgICAgb2xkOiB0aGlzW2RlcGVuZGFudF1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgICAgICAgbW9kZWxJbnN0YW5jZS5fX3ZhbHVlc1thdHRyaWJ1dGVOYW1lXSA9IHY7XG4gICAgICAgICAgcHJvcGVydHlEZXBlbmRlbmNpZXMuZm9yRWFjaChmdW5jdGlvbihkZXApIHtcbiAgICAgICAgICAgIHZhciBwcm9wZXJ0eU5hbWUgPSBkZXAucHJvcDtcbiAgICAgICAgICAgIHZhciBuZXdfID0gdGhpc1twcm9wZXJ0eU5hbWVdO1xuICAgICAgICAgICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgICAgICAgICAgIGNvbGxlY3Rpb246IE1vZGVsLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgICBtb2RlbDogTW9kZWwubmFtZSxcbiAgICAgICAgICAgICAgbG9jYWxJZDogbW9kZWxJbnN0YW5jZS5sb2NhbElkLFxuICAgICAgICAgICAgICBuZXc6IG5ld18sXG4gICAgICAgICAgICAgIG9sZDogZGVwLm9sZCxcbiAgICAgICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU2V0LFxuICAgICAgICAgICAgICBmaWVsZDogcHJvcGVydHlOYW1lLFxuICAgICAgICAgICAgICBvYmo6IG1vZGVsSW5zdGFuY2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgICAgdmFyIGUgPSB7XG4gICAgICAgICAgICBjb2xsZWN0aW9uOiBNb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgIG1vZGVsOiBNb2RlbC5uYW1lLFxuICAgICAgICAgICAgbG9jYWxJZDogbW9kZWxJbnN0YW5jZS5sb2NhbElkLFxuICAgICAgICAgICAgbmV3OiB2LFxuICAgICAgICAgICAgb2xkOiBvbGQsXG4gICAgICAgICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5TZXQsXG4gICAgICAgICAgICBmaWVsZDogYXR0cmlidXRlTmFtZSxcbiAgICAgICAgICAgIG9iajogbW9kZWxJbnN0YW5jZVxuICAgICAgICAgIH07XG4gICAgICAgICAgd2luZG93Lmxhc3RFbWlzc2lvbiA9IGU7XG4gICAgICAgICAgbW9kZWxFdmVudHMuZW1pdChlKTtcbiAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KHYpKSB7XG4gICAgICAgICAgICB3cmFwQXJyYXkodiwgYXR0cmlidXRlTmFtZSwgbW9kZWxJbnN0YW5jZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9LFxuICBfaW5zdGFsbE1ldGhvZHM6IGZ1bmN0aW9uKG1vZGVsSW5zdGFuY2UpIHtcbiAgICB2YXIgTW9kZWwgPSB0aGlzLm1vZGVsO1xuICAgIE9iamVjdC5rZXlzKE1vZGVsLm1ldGhvZHMpLmZvckVhY2goZnVuY3Rpb24obWV0aG9kTmFtZSkge1xuICAgICAgaWYgKG1vZGVsSW5zdGFuY2VbbWV0aG9kTmFtZV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBtb2RlbEluc3RhbmNlW21ldGhvZE5hbWVdID0gTW9kZWwubWV0aG9kc1ttZXRob2ROYW1lXS5iaW5kKG1vZGVsSW5zdGFuY2UpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGxvZygnQSBtZXRob2Qgd2l0aCBuYW1lIFwiJyArIG1ldGhvZE5hbWUgKyAnXCIgYWxyZWFkeSBleGlzdHMuIElnbm9yaW5nIGl0LicpO1xuICAgICAgfVxuICAgIH0uYmluZCh0aGlzKSk7XG4gIH0sXG4gIF9pbnN0YWxsUHJvcGVydGllczogZnVuY3Rpb24obW9kZWxJbnN0YW5jZSkge1xuICAgIHZhciBfcHJvcGVydHlOYW1lcyA9IE9iamVjdC5rZXlzKHRoaXMubW9kZWwucHJvcGVydGllcyksXG4gICAgICBfcHJvcGVydHlEZXBlbmRlbmNpZXMgPSB7fTtcbiAgICBfcHJvcGVydHlOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uKHByb3BOYW1lKSB7XG4gICAgICB2YXIgcHJvcERlZiA9IHRoaXMubW9kZWwucHJvcGVydGllc1twcm9wTmFtZV07XG4gICAgICB2YXIgZGVwZW5kZW5jaWVzID0gcHJvcERlZi5kZXBlbmRlbmNpZXMgfHwgW107XG4gICAgICBkZXBlbmRlbmNpZXMuZm9yRWFjaChmdW5jdGlvbihhdHRyKSB7XG4gICAgICAgIGlmICghX3Byb3BlcnR5RGVwZW5kZW5jaWVzW2F0dHJdKSBfcHJvcGVydHlEZXBlbmRlbmNpZXNbYXR0cl0gPSBbXTtcbiAgICAgICAgX3Byb3BlcnR5RGVwZW5kZW5jaWVzW2F0dHJdLnB1c2gocHJvcE5hbWUpO1xuICAgICAgfSk7XG4gICAgICBkZWxldGUgcHJvcERlZi5kZXBlbmRlbmNpZXM7XG4gICAgICBpZiAobW9kZWxJbnN0YW5jZVtwcm9wTmFtZV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobW9kZWxJbnN0YW5jZSwgcHJvcE5hbWUsIHByb3BEZWYpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGxvZygnQSBwcm9wZXJ0eS9tZXRob2Qgd2l0aCBuYW1lIFwiJyArIHByb3BOYW1lICsgJ1wiIGFscmVhZHkgZXhpc3RzLiBJZ25vcmluZyBpdC4nKTtcbiAgICAgIH1cbiAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgbW9kZWxJbnN0YW5jZS5fcHJvcGVydHlEZXBlbmRlbmNpZXMgPSBfcHJvcGVydHlEZXBlbmRlbmNpZXM7XG4gIH0sXG4gIF9pbnN0YWxsUmVtb3RlSWQ6IGZ1bmN0aW9uKG1vZGVsSW5zdGFuY2UpIHtcbiAgICB2YXIgTW9kZWwgPSB0aGlzLm1vZGVsO1xuICAgIHZhciBpZEZpZWxkID0gTW9kZWwuaWQ7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG1vZGVsSW5zdGFuY2UsIGlkRmllbGQsIHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBtb2RlbEluc3RhbmNlLl9fdmFsdWVzW01vZGVsLmlkXSB8fCBudWxsO1xuICAgICAgfSxcbiAgICAgIHNldDogZnVuY3Rpb24odikge1xuICAgICAgICB2YXIgb2xkID0gbW9kZWxJbnN0YW5jZVtNb2RlbC5pZF07XG4gICAgICAgIG1vZGVsSW5zdGFuY2UuX192YWx1ZXNbTW9kZWwuaWRdID0gdjtcbiAgICAgICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgICAgICAgY29sbGVjdGlvbjogTW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgbW9kZWw6IE1vZGVsLm5hbWUsXG4gICAgICAgICAgbG9jYWxJZDogbW9kZWxJbnN0YW5jZS5sb2NhbElkLFxuICAgICAgICAgIG5ldzogdixcbiAgICAgICAgICBvbGQ6IG9sZCxcbiAgICAgICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5TZXQsXG4gICAgICAgICAgZmllbGQ6IE1vZGVsLmlkLFxuICAgICAgICAgIG9iajogbW9kZWxJbnN0YW5jZVxuICAgICAgICB9KTtcbiAgICAgICAgY2FjaGUucmVtb3RlSW5zZXJ0KG1vZGVsSW5zdGFuY2UsIHYsIG9sZCk7XG4gICAgICB9LFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pO1xuICB9LFxuICAvKipcbiAgICogQHBhcmFtIGRlZmluaXRpb24gLSBEZWZpbml0aW9uIG9mIGEgcmVsYXRpb25zaGlwXG4gICAqIEBwYXJhbSBtb2RlbEluc3RhbmNlIC0gSW5zdGFuY2Ugb2Ygd2hpY2ggdG8gaW5zdGFsbCB0aGUgcmVsYXRpb25zaGlwLlxuICAgKi9cbiAgX2luc3RhbGxSZWxhdGlvbnNoaXA6IGZ1bmN0aW9uKGRlZmluaXRpb24sIG1vZGVsSW5zdGFuY2UpIHtcbiAgICB2YXIgcHJveHk7XG4gICAgdmFyIHR5cGUgPSBkZWZpbml0aW9uLnR5cGU7XG4gICAgaWYgKHR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5PbmVUb01hbnkpIHtcbiAgICAgIHByb3h5ID0gbmV3IE9uZVRvTWFueVByb3h5KGRlZmluaXRpb24pO1xuICAgIH1cbiAgICBlbHNlIGlmICh0eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuT25lVG9PbmUpIHtcbiAgICAgIHByb3h5ID0gbmV3IE9uZVRvT25lUHJveHkoZGVmaW5pdGlvbik7XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5NYW55VG9NYW55KSB7XG4gICAgICBwcm94eSA9IG5ldyBNYW55VG9NYW55UHJveHkoZGVmaW5pdGlvbik7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ05vIHN1Y2ggcmVsYXRpb25zaGlwIHR5cGU6ICcgKyB0eXBlKTtcbiAgICB9XG4gICAgcHJveHkuaW5zdGFsbChtb2RlbEluc3RhbmNlKTtcbiAgfSxcbiAgX2luc3RhbGxSZWxhdGlvbnNoaXBQcm94aWVzOiBmdW5jdGlvbihtb2RlbEluc3RhbmNlKSB7XG4gICAgdmFyIG1vZGVsID0gdGhpcy5tb2RlbDtcbiAgICBmb3IgKHZhciBuYW1lIGluIG1vZGVsLnJlbGF0aW9uc2hpcHMpIHtcbiAgICAgIGlmIChtb2RlbC5yZWxhdGlvbnNoaXBzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgIHZhciBkZWZpbml0aW9uID0gdXRpbC5leHRlbmQoe30sIG1vZGVsLnJlbGF0aW9uc2hpcHNbbmFtZV0pO1xuICAgICAgICB0aGlzLl9pbnN0YWxsUmVsYXRpb25zaGlwKGRlZmluaXRpb24sIG1vZGVsSW5zdGFuY2UpO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgX3JlZ2lzdGVySW5zdGFuY2U6IGZ1bmN0aW9uKG1vZGVsSW5zdGFuY2UsIHNob3VsZFJlZ2lzdGVyQ2hhbmdlKSB7XG4gICAgY2FjaGUuaW5zZXJ0KG1vZGVsSW5zdGFuY2UpO1xuICAgIHNob3VsZFJlZ2lzdGVyQ2hhbmdlID0gc2hvdWxkUmVnaXN0ZXJDaGFuZ2UgPT09IHVuZGVmaW5lZCA/IHRydWUgOiBzaG91bGRSZWdpc3RlckNoYW5nZTtcbiAgICBpZiAoc2hvdWxkUmVnaXN0ZXJDaGFuZ2UpIG1vZGVsSW5zdGFuY2UuX2VtaXROZXcoKTtcbiAgfSxcbiAgX2luc3RhbGxMb2NhbElkOiBmdW5jdGlvbihtb2RlbEluc3RhbmNlLCBkYXRhKSB7XG4gICAgbW9kZWxJbnN0YW5jZS5sb2NhbElkID0gdGhpcy5fZ2V0TG9jYWxJZChkYXRhKTtcbiAgfSxcbiAgLyoqXG4gICAqIENvbnZlcnQgcmF3IGRhdGEgaW50byBhIE1vZGVsSW5zdGFuY2VcbiAgICogQHJldHVybnMge01vZGVsSW5zdGFuY2V9XG4gICAqL1xuICBfaW5zdGFuY2U6IGZ1bmN0aW9uKGRhdGEsIHNob3VsZFJlZ2lzdGVyQ2hhbmdlKSB7XG4gICAgaWYgKCF0aGlzLm1vZGVsLl9yZWxhdGlvbnNoaXBzSW5zdGFsbGVkIHx8ICF0aGlzLm1vZGVsLl9yZXZlcnNlUmVsYXRpb25zaGlwc0luc3RhbGxlZCkge1xuICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ01vZGVsIG11c3QgYmUgZnVsbHkgaW5zdGFsbGVkIGJlZm9yZSBjcmVhdGluZyBhbnkgbW9kZWxzJyk7XG4gICAgfVxuICAgIHZhciBtb2RlbEluc3RhbmNlID0gbmV3IE1vZGVsSW5zdGFuY2UodGhpcy5tb2RlbCk7XG4gICAgdGhpcy5faW5zdGFsbExvY2FsSWQobW9kZWxJbnN0YW5jZSwgZGF0YSk7XG4gICAgdGhpcy5faW5zdGFsbEF0dHJpYnV0ZXMobW9kZWxJbnN0YW5jZSwgZGF0YSk7XG4gICAgdGhpcy5faW5zdGFsbE1ldGhvZHMobW9kZWxJbnN0YW5jZSk7XG4gICAgdGhpcy5faW5zdGFsbFByb3BlcnRpZXMobW9kZWxJbnN0YW5jZSk7XG4gICAgdGhpcy5faW5zdGFsbFJlbW90ZUlkKG1vZGVsSW5zdGFuY2UpO1xuICAgIHRoaXMuX2luc3RhbGxSZWxhdGlvbnNoaXBQcm94aWVzKG1vZGVsSW5zdGFuY2UpO1xuICAgIHRoaXMuX3JlZ2lzdGVySW5zdGFuY2UobW9kZWxJbnN0YW5jZSwgc2hvdWxkUmVnaXN0ZXJDaGFuZ2UpO1xuICAgIHJldHVybiBtb2RlbEluc3RhbmNlO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IE1vZGVsSW5zdGFuY2VGYWN0b3J5O1xuXG5cbi8qKiBXRUJQQUNLIEZPT1RFUiAqKlxuICoqIC4vY29yZS9pbnN0YW5jZUZhY3RvcnkuanNcbiAqKi8iLCJ2YXIgUmVsYXRpb25zaGlwUHJveHkgPSByZXF1aXJlKCcuL1JlbGF0aW9uc2hpcFByb3h5JyksXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gIHdyYXBBcnJheUZvckF0dHJpYnV0ZXMgPSBldmVudHMud3JhcEFycmF5LFxuICBBcnJheU9ic2VydmVyID0gcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKS5BcnJheU9ic2VydmVyLFxuICBNb2RlbEV2ZW50VHlwZSA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKS5Nb2RlbEV2ZW50VHlwZTtcblxuLyoqXG4gKiBAY2xhc3MgIFtPbmVUb01hbnlQcm94eSBkZXNjcmlwdGlvbl1cbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHtbdHlwZV19IG9wdHNcbiAqL1xuZnVuY3Rpb24gT25lVG9NYW55UHJveHkob3B0cykge1xuICBSZWxhdGlvbnNoaXBQcm94eS5jYWxsKHRoaXMsIG9wdHMpO1xuICBpZiAodGhpcy5pc1JldmVyc2UpIHtcbiAgICB0aGlzLnJlbGF0ZWQgPSBbXTtcbiAgICAvL3RoaXMuZm9yd2FyZE1vZGVsLm9uKG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlJlbW92ZSwgZnVuY3Rpb24oZSkge1xuICAgIC8vICBpZiAoZS5maWVsZCA9PSBlLmZvcndhcmROYW1lKSB7XG4gICAgLy8gICAgdmFyIGlkeCA9IHRoaXMucmVsYXRlZC5pbmRleE9mKGUub2JqKTtcbiAgICAvLyAgICBpZiAoaWR4ID4gLTEpIHtcbiAgICAvLyAgICAgIHZhciByZW1vdmVkID0gdGhpcy5yZWxhdGVkLnNwbGljZShpZHgsIDEpO1xuICAgIC8vICAgIH1cbiAgICAvLyAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAvLyAgICAgIGNvbGxlY3Rpb246IHRoaXMucmV2ZXJzZU1vZGVsLmNvbGxlY3Rpb25OYW1lLFxuICAgIC8vICAgICAgbW9kZWw6IHRoaXMucmV2ZXJzZU1vZGVsLm5hbWUsXG4gICAgLy8gICAgICBsb2NhbElkOiB0aGlzLm9iamVjdC5sb2NhbElkLFxuICAgIC8vICAgICAgZmllbGQ6IHRoaXMucmV2ZXJzZU5hbWUsXG4gICAgLy8gICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgIC8vICAgICAgYWRkZWQ6IFtdLFxuICAgIC8vICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgIC8vICAgICAgaW5kZXg6IGlkeCxcbiAgICAvLyAgICAgIG9iajogdGhpcy5vYmplY3RcbiAgICAvLyAgICB9KTtcbiAgICAvLyAgfVxuICAgIC8vfS5iaW5kKHRoaXMpKTtcbiAgfVxufVxuXG5PbmVUb01hbnlQcm94eS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZSk7XG5cbnV0aWwuZXh0ZW5kKE9uZVRvTWFueVByb3h5LnByb3RvdHlwZSwge1xuICBjbGVhclJldmVyc2U6IGZ1bmN0aW9uKHJlbW92ZWQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgcmVtb3ZlZC5mb3JFYWNoKGZ1bmN0aW9uKHJlbW92ZWRPYmplY3QpIHtcbiAgICAgIHZhciByZXZlcnNlUHJveHkgPSBzZWxmLnJldmVyc2VQcm94eUZvckluc3RhbmNlKHJlbW92ZWRPYmplY3QpO1xuICAgICAgcmV2ZXJzZVByb3h5LnNldElkQW5kUmVsYXRlZChudWxsKTtcbiAgICB9KTtcbiAgfSxcbiAgc2V0UmV2ZXJzZU9mQWRkZWQ6IGZ1bmN0aW9uKGFkZGVkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGFkZGVkLmZvckVhY2goZnVuY3Rpb24oYWRkZWQpIHtcbiAgICAgIHZhciBmb3J3YXJkUHJveHkgPSBzZWxmLnJldmVyc2VQcm94eUZvckluc3RhbmNlKGFkZGVkKTtcbiAgICAgIGZvcndhcmRQcm94eS5zZXRJZEFuZFJlbGF0ZWQoc2VsZi5vYmplY3QpO1xuICAgIH0pO1xuICB9LFxuICB3cmFwQXJyYXk6IGZ1bmN0aW9uKGFycikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzKGFyciwgdGhpcy5yZXZlcnNlTmFtZSwgdGhpcy5vYmplY3QpO1xuICAgIGlmICghYXJyLmFycmF5T2JzZXJ2ZXIpIHtcbiAgICAgIGFyci5hcnJheU9ic2VydmVyID0gbmV3IEFycmF5T2JzZXJ2ZXIoYXJyKTtcbiAgICAgIHZhciBvYnNlcnZlckZ1bmN0aW9uID0gZnVuY3Rpb24oc3BsaWNlcykge1xuICAgICAgICBzcGxpY2VzLmZvckVhY2goZnVuY3Rpb24oc3BsaWNlKSB7XG4gICAgICAgICAgdmFyIGFkZGVkID0gc3BsaWNlLmFkZGVkQ291bnQgPyBhcnIuc2xpY2Uoc3BsaWNlLmluZGV4LCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCkgOiBbXTtcbiAgICAgICAgICB2YXIgcmVtb3ZlZCA9IHNwbGljZS5yZW1vdmVkO1xuICAgICAgICAgIHNlbGYuY2xlYXJSZXZlcnNlKHJlbW92ZWQpO1xuICAgICAgICAgIHNlbGYuc2V0UmV2ZXJzZU9mQWRkZWQoYWRkZWQpO1xuICAgICAgICAgIHZhciBtb2RlbCA9IHNlbGYuZ2V0Rm9yd2FyZE1vZGVsKCk7XG4gICAgICAgICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgICAgICAgICBjb2xsZWN0aW9uOiBtb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgIG1vZGVsOiBtb2RlbC5uYW1lLFxuICAgICAgICAgICAgbG9jYWxJZDogc2VsZi5vYmplY3QubG9jYWxJZCxcbiAgICAgICAgICAgIGZpZWxkOiBzZWxmLmdldEZvcndhcmROYW1lKCksXG4gICAgICAgICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgICAgICAgICAgYWRkZWQ6IGFkZGVkLFxuICAgICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgaW5kZXg6IHNwbGljZS5pbmRleCxcbiAgICAgICAgICAgIG9iajogc2VsZi5vYmplY3RcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgICAgYXJyLmFycmF5T2JzZXJ2ZXIub3BlbihvYnNlcnZlckZ1bmN0aW9uKTtcbiAgICB9XG4gIH0sXG4gIGdldDogZnVuY3Rpb24oY2IpIHtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgY2IobnVsbCwgdGhpcy5yZWxhdGVkKTtcbiAgICB9LmJpbmQodGhpcykpO1xuICB9LFxuICAvKipcbiAgICogVmFsaWRhdGUgdGhlIG9iamVjdCB0aGF0IHdlJ3JlIHNldHRpbmdcbiAgICogQHBhcmFtIG9ialxuICAgKiBAcmV0dXJucyB7c3RyaW5nfG51bGx9IEFuIGVycm9yIG1lc3NhZ2Ugb3IgbnVsbFxuICAgKiBAY2xhc3MgT25lVG9NYW55UHJveHlcbiAgICovXG4gIHZhbGlkYXRlOiBmdW5jdGlvbihvYmopIHtcbiAgICB2YXIgc3RyID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaik7XG4gICAgaWYgKHRoaXMuaXNGb3J3YXJkKSB7XG4gICAgICBpZiAoc3RyID09ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICAgICAgcmV0dXJuICdDYW5ub3QgYXNzaWduIGFycmF5IGZvcndhcmQgb25lVG9NYW55ICgnICsgc3RyICsgJyk6ICcgKyB0aGlzLmZvcndhcmROYW1lO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGlmIChzdHIgIT0gJ1tvYmplY3QgQXJyYXldJykge1xuICAgICAgICByZXR1cm4gJ0Nhbm5vdCBzY2FsYXIgdG8gcmV2ZXJzZSBvbmVUb01hbnkgKCcgKyBzdHIgKyAnKTogJyArIHRoaXMucmV2ZXJzZU5hbWU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9LFxuICBzZXQ6IGZ1bmN0aW9uKG9iaiwgb3B0cykge1xuICAgIHRoaXMuY2hlY2tJbnN0YWxsZWQoKTtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKG9iaikge1xuICAgICAgdmFyIGVycm9yTWVzc2FnZTtcbiAgICAgIGlmIChlcnJvck1lc3NhZ2UgPSB0aGlzLnZhbGlkYXRlKG9iaikpIHtcbiAgICAgICAgcmV0dXJuIGVycm9yTWVzc2FnZTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICB0aGlzLmNsZWFyUmV2ZXJzZVJlbGF0ZWQob3B0cyk7XG4gICAgICAgIHNlbGYuc2V0SWRBbmRSZWxhdGVkKG9iaiwgb3B0cyk7XG4gICAgICAgIGlmIChzZWxmLmlzUmV2ZXJzZSkge1xuICAgICAgICAgIHRoaXMud3JhcEFycmF5KHNlbGYucmVsYXRlZCk7XG4gICAgICAgIH1cbiAgICAgICAgc2VsZi5zZXRJZEFuZFJlbGF0ZWRSZXZlcnNlKG9iaiwgb3B0cyk7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhpcy5jbGVhclJldmVyc2VSZWxhdGVkKG9wdHMpO1xuICAgICAgc2VsZi5zZXRJZEFuZFJlbGF0ZWQob2JqLCBvcHRzKTtcbiAgICB9XG4gIH0sXG4gIGluc3RhbGw6IGZ1bmN0aW9uKG9iaikge1xuICAgIFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZS5pbnN0YWxsLmNhbGwodGhpcywgb2JqKTtcblxuICAgIGlmICh0aGlzLmlzUmV2ZXJzZSkge1xuICAgICAgb2JqWygnc3BsaWNlJyArIHV0aWwuY2FwaXRhbGlzZUZpcnN0TGV0dGVyKHRoaXMucmV2ZXJzZU5hbWUpKV0gPSB0aGlzLnNwbGljZS5iaW5kKHRoaXMpO1xuICAgICAgdGhpcy53cmFwQXJyYXkodGhpcy5yZWxhdGVkKTtcbiAgICB9XG5cbiAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gT25lVG9NYW55UHJveHk7XG5cblxuLyoqIFdFQlBBQ0sgRk9PVEVSICoqXG4gKiogLi9jb3JlL09uZVRvTWFueVByb3h5LmpzXG4gKiovIiwiLyoqXG4gKiBCYXNlIGZ1bmN0aW9uYWxpdHkgZm9yIHJlbGF0aW9uc2hpcHMuXG4gKiBAbW9kdWxlIHJlbGF0aW9uc2hpcHNcbiAqL1xudmFyIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICBRdWVyeSA9IHJlcXVpcmUoJy4vUXVlcnknKSxcbiAgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSxcbiAgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyksXG4gIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gIHdyYXBBcnJheUZvckF0dHJpYnV0ZXMgPSBldmVudHMud3JhcEFycmF5LFxuICBBcnJheU9ic2VydmVyID0gcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKS5BcnJheU9ic2VydmVyLFxuICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgTW9kZWxFdmVudFR5cGUgPSBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZTtcblxuLyoqXG4gKiBAY2xhc3MgIFtSZWxhdGlvbnNoaXBQcm94eSBkZXNjcmlwdGlvbl1cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gUmVsYXRpb25zaGlwUHJveHkob3B0cykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIG9wdHMgPSBvcHRzIHx8IHt9O1xuXG4gIHV0aWwuZXh0ZW5kKHRoaXMsIHtcbiAgICBvYmplY3Q6IG51bGwsXG4gICAgcmVsYXRlZDogbnVsbFxuICB9KTtcblxuICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyh0aGlzLCB7XG4gICAgaXNGb3J3YXJkOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gIXNlbGYuaXNSZXZlcnNlO1xuICAgICAgfSxcbiAgICAgIHNldDogZnVuY3Rpb24odikge1xuICAgICAgICBzZWxmLmlzUmV2ZXJzZSA9ICF2O1xuICAgICAgfSxcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9XG4gIH0pO1xuXG4gIHV0aWwuZXh0ZW5kRnJvbU9wdHModGhpcywgb3B0cywge1xuICAgIHJldmVyc2VNb2RlbDogbnVsbCxcbiAgICBmb3J3YXJkTW9kZWw6IG51bGwsXG4gICAgZm9yd2FyZE5hbWU6IG51bGwsXG4gICAgcmV2ZXJzZU5hbWU6IG51bGwsXG4gICAgaXNSZXZlcnNlOiBudWxsLFxuICAgIHNlcmlhbGlzZTogbnVsbFxuICB9LCBmYWxzZSk7XG5cbiAgdGhpcy5jYW5jZWxMaXN0ZW5zID0ge307XG59XG5cbnV0aWwuZXh0ZW5kKFJlbGF0aW9uc2hpcFByb3h5LCB7fSk7XG5cbnV0aWwuZXh0ZW5kKFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZSwge1xuICAvKipcbiAgICogSW5zdGFsbCB0aGlzIHByb3h5IG9uIHRoZSBnaXZlbiBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge01vZGVsSW5zdGFuY2V9IG1vZGVsSW5zdGFuY2VcbiAgICovXG4gIGluc3RhbGw6IGZ1bmN0aW9uKG1vZGVsSW5zdGFuY2UpIHtcbiAgICBpZiAobW9kZWxJbnN0YW5jZSkge1xuICAgICAgaWYgKCF0aGlzLm9iamVjdCkge1xuICAgICAgICB0aGlzLm9iamVjdCA9IG1vZGVsSW5zdGFuY2U7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgdmFyIG5hbWUgPSB0aGlzLmdldEZvcndhcmROYW1lKCk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShtb2RlbEluc3RhbmNlLCBuYW1lLCB7XG4gICAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiBzZWxmLnJlbGF0ZWQ7XG4gICAgICAgICAgfSxcbiAgICAgICAgICBzZXQ6IGZ1bmN0aW9uKHYpIHtcbiAgICAgICAgICAgIHNlbGYuc2V0KHYpO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIGlmICghbW9kZWxJbnN0YW5jZS5fX3Byb3hpZXMpIG1vZGVsSW5zdGFuY2UuX19wcm94aWVzID0ge307XG4gICAgICAgIG1vZGVsSW5zdGFuY2UuX19wcm94aWVzW25hbWVdID0gdGhpcztcbiAgICAgICAgaWYgKCFtb2RlbEluc3RhbmNlLl9wcm94aWVzKSB7XG4gICAgICAgICAgbW9kZWxJbnN0YW5jZS5fcHJveGllcyA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIG1vZGVsSW5zdGFuY2UuX3Byb3hpZXMucHVzaCh0aGlzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdBbHJlYWR5IGluc3RhbGxlZC4nKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ05vIG9iamVjdCBwYXNzZWQgdG8gcmVsYXRpb25zaGlwIGluc3RhbGwnKTtcbiAgICB9XG4gIH1cblxufSk7XG5cbi8vbm9pbnNwZWN0aW9uIEpTVW51c2VkTG9jYWxTeW1ib2xzXG51dGlsLmV4dGVuZChSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUsIHtcbiAgc2V0OiBmdW5jdGlvbihvYmosIG9wdHMpIHtcbiAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTXVzdCBzdWJjbGFzcyBSZWxhdGlvbnNoaXBQcm94eScpO1xuICB9LFxuICBnZXQ6IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ011c3Qgc3ViY2xhc3MgUmVsYXRpb25zaGlwUHJveHknKTtcbiAgfVxufSk7XG5cbnV0aWwuZXh0ZW5kKFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZSwge1xuICBwcm94eUZvckluc3RhbmNlOiBmdW5jdGlvbihtb2RlbEluc3RhbmNlLCByZXZlcnNlKSB7XG4gICAgdmFyIG5hbWUgPSByZXZlcnNlID8gdGhpcy5nZXRSZXZlcnNlTmFtZSgpIDogdGhpcy5nZXRGb3J3YXJkTmFtZSgpLFxuICAgICAgbW9kZWwgPSByZXZlcnNlID8gdGhpcy5yZXZlcnNlTW9kZWwgOiB0aGlzLmZvcndhcmRNb2RlbDtcbiAgICB2YXIgcmV0O1xuICAgIC8vIFRoaXMgc2hvdWxkIG5ldmVyIGhhcHBlbi4gU2hvdWxkIGcgICBldCBjYXVnaHQgaW4gdGhlIG1hcHBpbmcgb3BlcmF0aW9uP1xuICAgIGlmICh1dGlsLmlzQXJyYXkobW9kZWxJbnN0YW5jZSkpIHtcbiAgICAgIHJldCA9IG1vZGVsSW5zdGFuY2UubWFwKGZ1bmN0aW9uKG8pIHtcbiAgICAgICAgcmV0dXJuIG8uX19wcm94aWVzW25hbWVdO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBwcm94aWVzID0gbW9kZWxJbnN0YW5jZS5fX3Byb3hpZXM7XG4gICAgICB2YXIgcHJveHkgPSBwcm94aWVzW25hbWVdO1xuICAgICAgaWYgKCFwcm94eSkge1xuICAgICAgICB2YXIgZXJyID0gJ05vIHByb3h5IHdpdGggbmFtZSBcIicgKyBuYW1lICsgJ1wiIG9uIG1hcHBpbmcgJyArIG1vZGVsLm5hbWU7XG4gICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKGVycik7XG4gICAgICB9XG4gICAgICByZXQgPSBwcm94eTtcbiAgICB9XG4gICAgcmV0dXJuIHJldDtcbiAgfSxcbiAgcmV2ZXJzZVByb3h5Rm9ySW5zdGFuY2U6IGZ1bmN0aW9uKG1vZGVsSW5zdGFuY2UpIHtcbiAgICByZXR1cm4gdGhpcy5wcm94eUZvckluc3RhbmNlKG1vZGVsSW5zdGFuY2UsIHRydWUpO1xuICB9LFxuICBnZXRSZXZlcnNlTmFtZTogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuaXNGb3J3YXJkID8gdGhpcy5yZXZlcnNlTmFtZSA6IHRoaXMuZm9yd2FyZE5hbWU7XG4gIH0sXG4gIGdldEZvcndhcmROYW1lOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5pc0ZvcndhcmQgPyB0aGlzLmZvcndhcmROYW1lIDogdGhpcy5yZXZlcnNlTmFtZTtcbiAgfSxcbiAgZ2V0Rm9yd2FyZE1vZGVsOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5pc0ZvcndhcmQgPyB0aGlzLmZvcndhcmRNb2RlbCA6IHRoaXMucmV2ZXJzZU1vZGVsO1xuICB9LFxuICAvKipcbiAgICogQ29uZmlndXJlIF9pZCBhbmQgcmVsYXRlZCB3aXRoIHRoZSBuZXcgcmVsYXRlZCBvYmplY3QuXG4gICAqIEBwYXJhbSBvYmpcbiAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRzXVxuICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRzLmRpc2FibGVOb3RpZmljYXRpb25zXVxuICAgKiBAcmV0dXJucyB7U3RyaW5nfHVuZGVmaW5lZH0gLSBFcnJvciBtZXNzYWdlIG9yIHVuZGVmaW5lZFxuICAgKi9cbiAgc2V0SWRBbmRSZWxhdGVkOiBmdW5jdGlvbihvYmosIG9wdHMpIHtcbiAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICBpZiAoIW9wdHMuZGlzYWJsZWV2ZW50cykgdmFyIG9sZFZhbHVlID0gdGhpcy5fZ2V0T2xkVmFsdWVGb3JTZXRDaGFuZ2VFdmVudCgpO1xuICAgIGlmIChvYmopIHtcbiAgICAgIGlmICh1dGlsLmlzQXJyYXkob2JqKSkge1xuICAgICAgICB0aGlzLnJlbGF0ZWQgPSBvYmo7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnJlbGF0ZWQgPSBvYmo7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhpcy5yZWxhdGVkID0gbnVsbDtcbiAgICB9XG4gICAgaWYgKCFvcHRzLmRpc2FibGVldmVudHMpIHRoaXMucmVnaXN0ZXJTZXRDaGFuZ2Uob2JqLCBvbGRWYWx1ZSk7XG4gIH0sXG4gIGNoZWNrSW5zdGFsbGVkOiBmdW5jdGlvbigpIHtcbiAgICBpZiAoIXRoaXMub2JqZWN0KSB7XG4gICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignUHJveHkgbXVzdCBiZSBpbnN0YWxsZWQgb24gYW4gb2JqZWN0IGJlZm9yZSBjYW4gdXNlIGl0LicpO1xuICAgIH1cbiAgfSxcbiAgc3BsaWNlcjogZnVuY3Rpb24ob3B0cykge1xuICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgIHJldHVybiBmdW5jdGlvbihpZHgsIG51bVJlbW92ZSkge1xuICAgICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgICBpZiAoIW9wdHMuZGlzYWJsZWV2ZW50cykge1xuICAgICAgICB2YXIgYWRkZWQgPSB0aGlzLl9nZXRBZGRlZEZvclNwbGljZUNoYW5nZUV2ZW50KGFyZ3VtZW50cyksXG4gICAgICAgICAgcmVtb3ZlZCA9IHRoaXMuX2dldFJlbW92ZWRGb3JTcGxpY2VDaGFuZ2VFdmVudChpZHgsIG51bVJlbW92ZSk7XG4gICAgICB9XG4gICAgICB2YXIgYWRkID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICAgIHZhciByZXMgPSB0aGlzLnJlbGF0ZWQuc3BsaWNlLmJpbmQodGhpcy5yZWxhdGVkLCBpZHgsIG51bVJlbW92ZSkuYXBwbHkodGhpcy5yZWxhdGVkLCBhZGQpO1xuICAgICAgaWYgKCFvcHRzLmRpc2FibGVldmVudHMpIHRoaXMucmVnaXN0ZXJTcGxpY2VDaGFuZ2UoaWR4LCBhZGRlZCwgcmVtb3ZlZCk7XG4gICAgICByZXR1cm4gcmVzO1xuICAgIH0uYmluZCh0aGlzKTtcbiAgfSxcbiAgY2xlYXJSZXZlcnNlUmVsYXRlZDogZnVuY3Rpb24ob3B0cykge1xuICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAodGhpcy5yZWxhdGVkKSB7XG4gICAgICB2YXIgcmV2ZXJzZVByb3h5ID0gdGhpcy5yZXZlcnNlUHJveHlGb3JJbnN0YW5jZSh0aGlzLnJlbGF0ZWQpO1xuICAgICAgdmFyIHJldmVyc2VQcm94aWVzID0gdXRpbC5pc0FycmF5KHJldmVyc2VQcm94eSkgPyByZXZlcnNlUHJveHkgOiBbcmV2ZXJzZVByb3h5XTtcbiAgICAgIHJldmVyc2VQcm94aWVzLmZvckVhY2goZnVuY3Rpb24ocCkge1xuICAgICAgICBpZiAodXRpbC5pc0FycmF5KHAucmVsYXRlZCkpIHtcbiAgICAgICAgICB2YXIgaWR4ID0gcC5yZWxhdGVkLmluZGV4T2Yoc2VsZi5vYmplY3QpO1xuICAgICAgICAgIHAubWFrZUNoYW5nZXNUb1JlbGF0ZWRXaXRob3V0T2JzZXJ2YXRpb25zKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcC5zcGxpY2VyKG9wdHMpKGlkeCwgMSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcC5zZXRJZEFuZFJlbGF0ZWQobnVsbCwgb3B0cyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfSxcbiAgc2V0SWRBbmRSZWxhdGVkUmV2ZXJzZTogZnVuY3Rpb24ob2JqLCBvcHRzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciByZXZlcnNlUHJveHkgPSB0aGlzLnJldmVyc2VQcm94eUZvckluc3RhbmNlKG9iaik7XG4gICAgdmFyIHJldmVyc2VQcm94aWVzID0gdXRpbC5pc0FycmF5KHJldmVyc2VQcm94eSkgPyByZXZlcnNlUHJveHkgOiBbcmV2ZXJzZVByb3h5XTtcbiAgICByZXZlcnNlUHJveGllcy5mb3JFYWNoKGZ1bmN0aW9uKHApIHtcbiAgICAgIGlmICh1dGlsLmlzQXJyYXkocC5yZWxhdGVkKSkge1xuICAgICAgICBwLm1ha2VDaGFuZ2VzVG9SZWxhdGVkV2l0aG91dE9ic2VydmF0aW9ucyhmdW5jdGlvbigpIHtcbiAgICAgICAgICBwLnNwbGljZXIob3B0cykocC5yZWxhdGVkLmxlbmd0aCwgMCwgc2VsZi5vYmplY3QpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHAuY2xlYXJSZXZlcnNlUmVsYXRlZChvcHRzKTtcbiAgICAgICAgcC5zZXRJZEFuZFJlbGF0ZWQoc2VsZi5vYmplY3QsIG9wdHMpO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxuICBtYWtlQ2hhbmdlc1RvUmVsYXRlZFdpdGhvdXRPYnNlcnZhdGlvbnM6IGZ1bmN0aW9uKGYpIHtcbiAgICBpZiAodGhpcy5yZWxhdGVkKSB7XG4gICAgICB0aGlzLnJlbGF0ZWQuYXJyYXlPYnNlcnZlci5jbG9zZSgpO1xuICAgICAgdGhpcy5yZWxhdGVkLmFycmF5T2JzZXJ2ZXIgPSBudWxsO1xuICAgICAgZigpO1xuICAgICAgdGhpcy53cmFwQXJyYXkodGhpcy5yZWxhdGVkKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZigpO1xuICAgIH1cbiAgfSxcbiAgLyoqXG4gICAqIEdldCBvbGQgdmFsdWUgdGhhdCBpcyBzZW50IG91dCBpbiBlbWlzc2lvbnMuXG4gICAqIEByZXR1cm5zIHsqfVxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2dldE9sZFZhbHVlRm9yU2V0Q2hhbmdlRXZlbnQ6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBvbGRWYWx1ZSA9IHRoaXMucmVsYXRlZDtcbiAgICBpZiAodXRpbC5pc0FycmF5KG9sZFZhbHVlKSAmJiAhb2xkVmFsdWUubGVuZ3RoKSB7XG4gICAgICBvbGRWYWx1ZSA9IG51bGw7XG4gICAgfVxuICAgIHJldHVybiBvbGRWYWx1ZTtcbiAgfSxcbiAgcmVnaXN0ZXJTZXRDaGFuZ2U6IGZ1bmN0aW9uKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgIHZhciBwcm94eU9iamVjdCA9IHRoaXMub2JqZWN0O1xuICAgIGlmICghcHJveHlPYmplY3QpIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdQcm94eSBtdXN0IGhhdmUgYW4gb2JqZWN0IGFzc29jaWF0ZWQnKTtcbiAgICB2YXIgbW9kZWwgPSBwcm94eU9iamVjdC5tb2RlbC5uYW1lO1xuICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IHByb3h5T2JqZWN0LmNvbGxlY3Rpb25OYW1lO1xuICAgIC8vIFdlIHRha2UgW10gPT0gbnVsbCA9PSB1bmRlZmluZWQgaW4gdGhlIGNhc2Ugb2YgcmVsYXRpb25zaGlwcy5cbiAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgIGNvbGxlY3Rpb246IGNvbGxlY3Rpb25OYW1lLFxuICAgICAgbW9kZWw6IG1vZGVsLFxuICAgICAgbG9jYWxJZDogcHJveHlPYmplY3QubG9jYWxJZCxcbiAgICAgIGZpZWxkOiB0aGlzLmdldEZvcndhcmROYW1lKCksXG4gICAgICBvbGQ6IG9sZFZhbHVlLFxuICAgICAgbmV3OiBuZXdWYWx1ZSxcbiAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNldCxcbiAgICAgIG9iajogcHJveHlPYmplY3RcbiAgICB9KTtcbiAgfSxcblxuICBfZ2V0UmVtb3ZlZEZvclNwbGljZUNoYW5nZUV2ZW50OiBmdW5jdGlvbihpZHgsIG51bVJlbW92ZSkge1xuICAgIHZhciByZW1vdmVkID0gdGhpcy5yZWxhdGVkID8gdGhpcy5yZWxhdGVkLnNsaWNlKGlkeCwgaWR4ICsgbnVtUmVtb3ZlKSA6IG51bGw7XG4gICAgcmV0dXJuIHJlbW92ZWQ7XG4gIH0sXG5cbiAgX2dldEFkZGVkRm9yU3BsaWNlQ2hhbmdlRXZlbnQ6IGZ1bmN0aW9uKGFyZ3MpIHtcbiAgICB2YXIgYWRkID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJncywgMiksXG4gICAgICBhZGRlZCA9IGFkZC5sZW5ndGggPyBhZGQgOiBbXTtcbiAgICByZXR1cm4gYWRkZWQ7XG4gIH0sXG5cbiAgcmVnaXN0ZXJTcGxpY2VDaGFuZ2U6IGZ1bmN0aW9uKGlkeCwgYWRkZWQsIHJlbW92ZWQpIHtcbiAgICB2YXIgbW9kZWwgPSB0aGlzLm9iamVjdC5tb2RlbC5uYW1lLFxuICAgICAgY29sbCA9IHRoaXMub2JqZWN0LmNvbGxlY3Rpb25OYW1lO1xuICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgICAgY29sbGVjdGlvbjogY29sbCxcbiAgICAgIG1vZGVsOiBtb2RlbCxcbiAgICAgIGxvY2FsSWQ6IHRoaXMub2JqZWN0LmxvY2FsSWQsXG4gICAgICBmaWVsZDogdGhpcy5nZXRGb3J3YXJkTmFtZSgpLFxuICAgICAgaW5kZXg6IGlkeCxcbiAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgICBhZGRlZDogYWRkZWQsXG4gICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgICBvYmo6IHRoaXMub2JqZWN0XG4gICAgfSk7XG4gIH0sXG4gIHdyYXBBcnJheTogZnVuY3Rpb24oYXJyKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHdyYXBBcnJheUZvckF0dHJpYnV0ZXMoYXJyLCB0aGlzLnJldmVyc2VOYW1lLCB0aGlzLm9iamVjdCk7XG4gICAgaWYgKCFhcnIuYXJyYXlPYnNlcnZlcikge1xuICAgICAgYXJyLmFycmF5T2JzZXJ2ZXIgPSBuZXcgQXJyYXlPYnNlcnZlcihhcnIpO1xuICAgICAgdmFyIG9ic2VydmVyRnVuY3Rpb24gPSBmdW5jdGlvbihzcGxpY2VzKSB7XG4gICAgICAgIHNwbGljZXMuZm9yRWFjaChmdW5jdGlvbihzcGxpY2UpIHtcbiAgICAgICAgICB2YXIgYWRkZWQgPSBzcGxpY2UuYWRkZWRDb3VudCA/IGFyci5zbGljZShzcGxpY2UuaW5kZXgsIHNwbGljZS5pbmRleCArIHNwbGljZS5hZGRlZENvdW50KSA6IFtdO1xuICAgICAgICAgIHZhciBtb2RlbCA9IHNlbGYuZ2V0Rm9yd2FyZE1vZGVsKCk7XG4gICAgICAgICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgICAgICAgICBjb2xsZWN0aW9uOiBtb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgIG1vZGVsOiBtb2RlbC5uYW1lLFxuICAgICAgICAgICAgbG9jYWxJZDogc2VsZi5vYmplY3QubG9jYWxJZCxcbiAgICAgICAgICAgIGZpZWxkOiBzZWxmLmdldEZvcndhcmROYW1lKCksXG4gICAgICAgICAgICByZW1vdmVkOiBzcGxpY2UucmVtb3ZlZCxcbiAgICAgICAgICAgIGFkZGVkOiBhZGRlZCxcbiAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgIG9iajogc2VsZi5vYmplY3RcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgICAgYXJyLmFycmF5T2JzZXJ2ZXIub3BlbihvYnNlcnZlckZ1bmN0aW9uKTtcbiAgICB9XG4gIH0sXG4gIHNwbGljZTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5zcGxpY2VyKHt9KS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICB9XG5cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFJlbGF0aW9uc2hpcFByb3h5O1xuXG5cbi8qKiBXRUJQQUNLIEZPT1RFUiAqKlxuICoqIC4vY29yZS9SZWxhdGlvbnNoaXBQcm94eS5qc1xuICoqLyIsInZhciBSZWxhdGlvbnNoaXBQcm94eSA9IHJlcXVpcmUoJy4vUmVsYXRpb25zaGlwUHJveHknKSxcbiAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICBTaWVzdGFNb2RlbCA9IHJlcXVpcmUoJy4vTW9kZWxJbnN0YW5jZScpO1xuXG4vKipcbiAqIFtPbmVUb09uZVByb3h5IGRlc2NyaXB0aW9uXVxuICogQHBhcmFtIHtPYmplY3R9IG9wdHNcbiAqL1xuZnVuY3Rpb24gT25lVG9PbmVQcm94eShvcHRzKSB7XG4gIFJlbGF0aW9uc2hpcFByb3h5LmNhbGwodGhpcywgb3B0cyk7XG59XG5cblxuT25lVG9PbmVQcm94eS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZSk7XG5cbnV0aWwuZXh0ZW5kKE9uZVRvT25lUHJveHkucHJvdG90eXBlLCB7XG4gIC8qKlxuICAgKiBWYWxpZGF0ZSB0aGUgb2JqZWN0IHRoYXQgd2UncmUgc2V0dGluZ1xuICAgKiBAcGFyYW0gb2JqXG4gICAqIEByZXR1cm5zIHtzdHJpbmd8bnVsbH0gQW4gZXJyb3IgbWVzc2FnZSBvciBudWxsXG4gICAqL1xuICB2YWxpZGF0ZTogZnVuY3Rpb24ob2JqKSB7XG4gICAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopID09ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICAgIHJldHVybiAnQ2Fubm90IGFzc2lnbiBhcnJheSB0byBvbmUgdG8gb25lIHJlbGF0aW9uc2hpcCc7XG4gICAgfVxuICAgIGVsc2UgaWYgKCghb2JqIGluc3RhbmNlb2YgU2llc3RhTW9kZWwpKSB7XG5cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH0sXG4gIHNldDogZnVuY3Rpb24ob2JqLCBvcHRzKSB7XG4gICAgdGhpcy5jaGVja0luc3RhbGxlZCgpO1xuICAgIGlmIChvYmopIHtcbiAgICAgIHZhciBlcnJvck1lc3NhZ2U7XG4gICAgICBpZiAoZXJyb3JNZXNzYWdlID0gdGhpcy52YWxpZGF0ZShvYmopKSB7XG4gICAgICAgIHJldHVybiBlcnJvck1lc3NhZ2U7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgdGhpcy5jbGVhclJldmVyc2VSZWxhdGVkKG9wdHMpO1xuICAgICAgICB0aGlzLnNldElkQW5kUmVsYXRlZChvYmosIG9wdHMpO1xuICAgICAgICB0aGlzLnNldElkQW5kUmVsYXRlZFJldmVyc2Uob2JqLCBvcHRzKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICB0aGlzLmNsZWFyUmV2ZXJzZVJlbGF0ZWQob3B0cyk7XG4gICAgICB0aGlzLnNldElkQW5kUmVsYXRlZChvYmosIG9wdHMpO1xuICAgIH1cbiAgfSxcbiAgZ2V0OiBmdW5jdGlvbihjYikge1xuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICBjYihudWxsLCB0aGlzLnJlbGF0ZWQpO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE9uZVRvT25lUHJveHk7XG5cblxuLyoqIFdFQlBBQ0sgRk9PVEVSICoqXG4gKiogLi9jb3JlL09uZVRvT25lUHJveHkuanNcbiAqKi8iLCIvKipcbiAqIEBtb2R1bGUgcmVsYXRpb25zaGlwc1xuICovXG5cbnZhciBSZWxhdGlvbnNoaXBQcm94eSA9IHJlcXVpcmUoJy4vUmVsYXRpb25zaGlwUHJveHknKSxcbiAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgd3JhcEFycmF5Rm9yQXR0cmlidXRlcyA9IGV2ZW50cy53cmFwQXJyYXksXG4gIEFycmF5T2JzZXJ2ZXIgPSByZXF1aXJlKCcuLi92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZScpLkFycmF5T2JzZXJ2ZXIsXG4gIE1vZGVsRXZlbnRUeXBlID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLk1vZGVsRXZlbnRUeXBlO1xuXG4vKipcbiAqIFtNYW55VG9NYW55UHJveHkgZGVzY3JpcHRpb25dXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICovXG5mdW5jdGlvbiBNYW55VG9NYW55UHJveHkob3B0cykge1xuICBSZWxhdGlvbnNoaXBQcm94eS5jYWxsKHRoaXMsIG9wdHMpO1xuICB0aGlzLnJlbGF0ZWQgPSBbXTtcbiAgdGhpcy5yZWxhdGVkQ2FuY2VsTGlzdGVuZXJzID0ge307XG4gIGlmICh0aGlzLmlzUmV2ZXJzZSkge1xuICAgIHRoaXMucmVsYXRlZCA9IFtdO1xuICAgIC8vdGhpcy5mb3J3YXJkTW9kZWwub24obW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuUmVtb3ZlLCBmdW5jdGlvbihlKSB7XG4gICAgLy8gIGlmIChlLmZpZWxkID09IGUuZm9yd2FyZE5hbWUpIHtcbiAgICAvLyAgICB2YXIgaWR4ID0gdGhpcy5yZWxhdGVkLmluZGV4T2YoZS5vYmopO1xuICAgIC8vICAgIGlmIChpZHggPiAtMSkge1xuICAgIC8vICAgICAgdmFyIHJlbW92ZWQgPSB0aGlzLnJlbGF0ZWQuc3BsaWNlKGlkeCwgMSk7XG4gICAgLy8gICAgfVxuICAgIC8vICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgIC8vICAgICAgY29sbGVjdGlvbjogdGhpcy5yZXZlcnNlTW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgLy8gICAgICBtb2RlbDogdGhpcy5yZXZlcnNlTW9kZWwubmFtZSxcbiAgICAvLyAgICAgIGxvY2FsSWQ6IHRoaXMub2JqZWN0LmxvY2FsSWQsXG4gICAgLy8gICAgICBmaWVsZDogdGhpcy5yZXZlcnNlTmFtZSxcbiAgICAvLyAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgLy8gICAgICBhZGRlZDogW10sXG4gICAgLy8gICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgLy8gICAgICBpbmRleDogaWR4LFxuICAgIC8vICAgICAgb2JqOiB0aGlzLm9iamVjdFxuICAgIC8vICAgIH0pO1xuICAgIC8vICB9XG4gICAgLy99LmJpbmQodGhpcykpO1xuICB9XG59XG5cbk1hbnlUb01hbnlQcm94eS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZSk7XG5cbnV0aWwuZXh0ZW5kKE1hbnlUb01hbnlQcm94eS5wcm90b3R5cGUsIHtcbiAgY2xlYXJSZXZlcnNlOiBmdW5jdGlvbihyZW1vdmVkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJlbW92ZWQuZm9yRWFjaChmdW5jdGlvbihyZW1vdmVkT2JqZWN0KSB7XG4gICAgICB2YXIgcmV2ZXJzZVByb3h5ID0gc2VsZi5yZXZlcnNlUHJveHlGb3JJbnN0YW5jZShyZW1vdmVkT2JqZWN0KTtcbiAgICAgIHZhciBpZHggPSByZXZlcnNlUHJveHkucmVsYXRlZC5pbmRleE9mKHNlbGYub2JqZWN0KTtcbiAgICAgIHJldmVyc2VQcm94eS5tYWtlQ2hhbmdlc1RvUmVsYXRlZFdpdGhvdXRPYnNlcnZhdGlvbnMoZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldmVyc2VQcm94eS5zcGxpY2UoaWR4LCAxKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9LFxuICBzZXRSZXZlcnNlT2ZBZGRlZDogZnVuY3Rpb24oYWRkZWQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgYWRkZWQuZm9yRWFjaChmdW5jdGlvbihhZGRlZE9iamVjdCkge1xuICAgICAgdmFyIHJldmVyc2VQcm94eSA9IHNlbGYucmV2ZXJzZVByb3h5Rm9ySW5zdGFuY2UoYWRkZWRPYmplY3QpO1xuICAgICAgcmV2ZXJzZVByb3h5Lm1ha2VDaGFuZ2VzVG9SZWxhdGVkV2l0aG91dE9ic2VydmF0aW9ucyhmdW5jdGlvbigpIHtcbiAgICAgICAgcmV2ZXJzZVByb3h5LnNwbGljZSgwLCAwLCBzZWxmLm9iamVjdCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSxcbiAgd3JhcEFycmF5OiBmdW5jdGlvbihhcnIpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgd3JhcEFycmF5Rm9yQXR0cmlidXRlcyhhcnIsIHRoaXMucmV2ZXJzZU5hbWUsIHRoaXMub2JqZWN0KTtcbiAgICBpZiAoIWFyci5hcnJheU9ic2VydmVyKSB7XG4gICAgICBhcnIuYXJyYXlPYnNlcnZlciA9IG5ldyBBcnJheU9ic2VydmVyKGFycik7XG4gICAgICB2YXIgb2JzZXJ2ZXJGdW5jdGlvbiA9IGZ1bmN0aW9uKHNwbGljZXMpIHtcbiAgICAgICAgc3BsaWNlcy5mb3JFYWNoKGZ1bmN0aW9uKHNwbGljZSkge1xuICAgICAgICAgIHZhciBhZGRlZCA9IHNwbGljZS5hZGRlZENvdW50ID8gYXJyLnNsaWNlKHNwbGljZS5pbmRleCwgc3BsaWNlLmluZGV4ICsgc3BsaWNlLmFkZGVkQ291bnQpIDogW107XG4gICAgICAgICAgdmFyIHJlbW92ZWQgPSBzcGxpY2UucmVtb3ZlZDtcbiAgICAgICAgICBzZWxmLmNsZWFyUmV2ZXJzZShyZW1vdmVkKTtcbiAgICAgICAgICBzZWxmLnNldFJldmVyc2VPZkFkZGVkKGFkZGVkKTtcbiAgICAgICAgICB2YXIgbW9kZWwgPSBzZWxmLmdldEZvcndhcmRNb2RlbCgpO1xuICAgICAgICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgICAgICAgICAgY29sbGVjdGlvbjogbW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICBtb2RlbDogbW9kZWwubmFtZSxcbiAgICAgICAgICAgIGxvY2FsSWQ6IHNlbGYub2JqZWN0LmxvY2FsSWQsXG4gICAgICAgICAgICBmaWVsZDogc2VsZi5nZXRGb3J3YXJkTmFtZSgpLFxuICAgICAgICAgICAgcmVtb3ZlZDogcmVtb3ZlZCxcbiAgICAgICAgICAgIGFkZGVkOiBhZGRlZCxcbiAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgIGluZGV4OiBzcGxpY2UuaW5kZXgsXG4gICAgICAgICAgICBvYmo6IHNlbGYub2JqZWN0XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfTtcbiAgICAgIGFyci5hcnJheU9ic2VydmVyLm9wZW4ob2JzZXJ2ZXJGdW5jdGlvbik7XG4gICAgfVxuICB9LFxuICBnZXQ6IGZ1bmN0aW9uKGNiKSB7XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgIGNiKG51bGwsIHRoaXMucmVsYXRlZCk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcbiAgdmFsaWRhdGU6IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSAhPSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICByZXR1cm4gJ0Nhbm5vdCBhc3NpZ24gc2NhbGFyIHRvIG1hbnkgdG8gbWFueSc7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9LFxuICBzZXQ6IGZ1bmN0aW9uKG9iaiwgb3B0cykge1xuICAgIHRoaXMuY2hlY2tJbnN0YWxsZWQoKTtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKG9iaikge1xuICAgICAgdmFyIGVycm9yTWVzc2FnZTtcbiAgICAgIGlmIChlcnJvck1lc3NhZ2UgPSB0aGlzLnZhbGlkYXRlKG9iaikpIHtcbiAgICAgICAgcmV0dXJuIGVycm9yTWVzc2FnZTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICB0aGlzLmNsZWFyUmV2ZXJzZVJlbGF0ZWQob3B0cyk7XG4gICAgICAgIHNlbGYuc2V0SWRBbmRSZWxhdGVkKG9iaiwgb3B0cyk7XG4gICAgICAgIHRoaXMud3JhcEFycmF5KG9iaik7XG4gICAgICAgIHNlbGYuc2V0SWRBbmRSZWxhdGVkUmV2ZXJzZShvYmosIG9wdHMpO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHRoaXMuY2xlYXJSZXZlcnNlUmVsYXRlZChvcHRzKTtcbiAgICAgIHNlbGYuc2V0SWRBbmRSZWxhdGVkKG9iaiwgb3B0cyk7XG4gICAgfVxuICB9LFxuICBpbnN0YWxsOiBmdW5jdGlvbihvYmopIHtcbiAgICBSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUuaW5zdGFsbC5jYWxsKHRoaXMsIG9iaik7XG4gICAgdGhpcy53cmFwQXJyYXkodGhpcy5yZWxhdGVkKTtcbiAgICBvYmpbKCdzcGxpY2UnICsgdXRpbC5jYXBpdGFsaXNlRmlyc3RMZXR0ZXIodGhpcy5yZXZlcnNlTmFtZSkpXSA9IHRoaXMuc3BsaWNlLmJpbmQodGhpcyk7XG4gIH0sXG4gIHJlZ2lzdGVyUmVtb3ZhbExpc3RlbmVyOiBmdW5jdGlvbihvYmopIHtcbiAgICB0aGlzLnJlbGF0ZWRDYW5jZWxMaXN0ZW5lcnNbb2JqLmxvY2FsSWRdID0gb2JqLm9uKCcqJywgZnVuY3Rpb24oZSkge1xuXG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gTWFueVRvTWFueVByb3h5O1xuXG5cbi8qKiBXRUJQQUNLIEZPT1RFUiAqKlxuICoqIC4vY29yZS9NYW55VG9NYW55UHJveHkuanNcbiAqKi8iXSwic291cmNlUm9vdCI6IiJ9