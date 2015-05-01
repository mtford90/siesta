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

	var util = __webpack_require__(1),
	  ReactiveFilter = __webpack_require__(2),
	  Context = __webpack_require__(3),
	  modelEvents = __webpack_require__(4),
	  log = __webpack_require__(5);
	
	util._patchBind();
	
	var siesta = {
	  createApp: function(name, opts) {
	    opts = opts || {};
	    opts.name = name;
	    return new Context(opts);
	  },
	  log: __webpack_require__(27),
	  lib: {
	    log: log,
	    Condition: __webpack_require__(6),
	    Model: __webpack_require__(7),
	    error: __webpack_require__(8),
	    ModelEventType: modelEvents.ModelEventType,
	    ModelInstance: __webpack_require__(9),
	    extend: __webpack_require__(22),
	    MappingOperation: __webpack_require__(10),
	    events: __webpack_require__(11),
	    ProxyEventEmitter: __webpack_require__(12),
	    modelEvents: modelEvents,
	    Collection: __webpack_require__(13),
	    ReactiveFilter: ReactiveFilter,
	    utils: util,
	    util: util,
	    filterSet: __webpack_require__(14),
	    observe: __webpack_require__(23),
	    Filter: __webpack_require__(15),
	    ManyToManyProxy: __webpack_require__(16),
	    OneToManyProxy:  __webpack_require__(17),
	    OneToOneProxy: __webpack_require__(18),
	    RelationshipProxy: __webpack_require__(19),
	    Storage: __webpack_require__(21),
	    Context: Context
	  },
	  constants: {
	    Deletion: {
	      Cascade: 'cascade',
	      Nullify: 'nullify'
	    }
	  },
	  isArray: util.isArray,
	  isString: util.isString,
	  RelationshipType: __webpack_require__(20),
	  ModelEventType: modelEvents.ModelEventType,
	  InsertionPolicy: ReactiveFilter.InsertionPolicy
	};
	
	
	if (typeof window != 'undefined') window['siesta'] = siesta;


/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	var observe = __webpack_require__(23).Platform,
	  Promise = __webpack_require__(24),
	  argsarray = __webpack_require__(31),
	  InternalSiestaError = __webpack_require__(8).InternalSiestaError;
	
	var extend = function(left, right) {
	  for (var prop in right) {
	    if (right.hasOwnProperty(prop)) {
	      left[prop] = right[prop];
	    }
	  }
	  return left;
	};
	
	var isArray = Array.isArray,
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
	          reject(err);
	        }
	        else {
	          resolve(rest[0]);
	        }
	        var bound = cb['__siesta_bound_object'] || cb; // Preserve bound object.
	        cb.apply(bound, args);
	      });
	      fn(_cb);
	    })
	  },
	  defer: function() {
	    var resolve, reject;
	    var p = new Promise(function(_resolve, _reject) {
	      resolve = _resolve;
	      reject = _reject;
	    });
	    //noinspection JSUnusedAssignment
	    p.resolve = resolve;
	    //noinspection JSUnusedAssignment
	    p.reject = reject;
	    return p;
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
	  }
	});
	
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
	  }
	});


/***/ },
/* 2 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * For those familiar with Apple's Cocoa library, reactive queries roughly map onto NSFetchedResultsController.
	 *
	 * They present a query set that 'reacts' to changes in the underlying data.
	 * @module reactiveQuery
	 */
	
	var log = __webpack_require__(5)('filter:reactive'),
	  Filter = __webpack_require__(15),
	  EventEmitter = __webpack_require__(32).EventEmitter,
	  Chain = __webpack_require__(25),
	  modelEvents = __webpack_require__(4),
	  InternalSiestaError = __webpack_require__(8).InternalSiestaError,
	  constructFilterSet = __webpack_require__(14),
	  util = __webpack_require__(1);
	
	/**
	 *
	 * @param {Filter} filter - The underlying query
	 * @constructor
	 */
	function ReactiveFilter(filter) {
	  var self = this;
	  EventEmitter.call(this);
	  Chain.call(this);
	  util.extend(this, {
	    insertionPolicy: ReactiveFilter.InsertionPolicy.Back,
	    initialised: false
	  });
	
	  Object.defineProperty(this, 'filter', {
	    get: function() {
	      return this._filter
	    },
	    set: function(v) {
	      if (v) {
	        this._filter = v;
	        this.results = constructFilterSet([], v.model);
	      }
	      else {
	        this._filter = null;
	        this.results = null;
	      }
	    },
	    configurable: false,
	    enumerable: true
	  });
	
	  if (filter) {
	    util.extend(this, {
	      _filter: filter,
	      results: constructFilterSet([], filter.model)
	    })
	  }
	
	  Object.defineProperties(this, {
	    initialized: {
	      get: function() {
	        return this.initialised
	      }
	    },
	    model: {
	      get: function() {
	        var filter = self._filter;
	        if (filter) {
	          return filter.model
	        }
	      }
	    },
	    collection: {
	      get: function() {
	        return self.model.collectionName
	      }
	    }
	  });
	
	
	}
	
	ReactiveFilter.prototype = Object.create(EventEmitter.prototype);
	util.extend(ReactiveFilter.prototype, Chain.prototype);
	
	util.extend(ReactiveFilter, {
	  InsertionPolicy: {
	    Front: 'Front',
	    Back: 'Back'
	  }
	});
	
	util.extend(ReactiveFilter.prototype, {
	  /**
	   *
	   * @param cb
	   * @param {bool} _ignoreInit - execute query again, initialised or not.
	   * @returns {*}
	   */
	  init: function(cb, _ignoreInit) {
	    if (this._filter) {
	      var name = this._constructNotificationName();
	      var handler = function(n) {
	        this._handleNotif(n);
	      }.bind(this);
	      this.handler = handler;
	      this.model.context.events.on(name, handler);
	      return util.promise(cb, function(cb) {
	        if ((!this.initialised) || _ignoreInit) {
	          this._filter.execute(function(err, results) {
	            if (!err) {
	              cb(null, this._applyResults(results));
	            }
	            else {
	              cb(err);
	            }
	          }.bind(this));
	        }
	        else {
	          cb(null, this.results);
	        }
	      }.bind(this));
	    }
	    else throw new InternalSiestaError('No _filter defined');
	  },
	  _applyResults: function(results) {
	    this.results = results;
	    this.initialised = true;
	    return this.results;
	  },
	  insert: function(newObj) {
	    var results = this.results.mutableCopy();
	    if (this.insertionPolicy == ReactiveFilter.InsertionPolicy.Back) var idx = results.push(newObj);
	    else idx = results.unshift(newObj);
	    this.results = results.asModelFilterSet(this.model);
	    return idx;
	  },
	  /**
	   * Execute the underlying query again.
	   * @param cb
	   */
	  update: function(cb) {
	    return this.init(cb, true)
	  },
	  _handleNotif: function(n) {
	    if (n.type == modelEvents.ModelEventType.New) {
	      var newObj = n.new;
	      if (this._filter.objectMatchesFilter(newObj)) {
	        log('New object matches', newObj);
	        var idx = this.insert(newObj);
	        this.emit(modelEvents.ModelEventType.Splice, {
	          index: idx,
	          added: [newObj],
	          type: modelEvents.ModelEventType.Splice,
	          obj: this
	        });
	      }
	      else {
	        log('New object does not match', newObj);
	      }
	    }
	    else if (n.type == modelEvents.ModelEventType.Set) {
	      newObj = n.obj;
	      var index = this.results.indexOf(newObj),
	        alreadyContains = index > -1,
	        matches = this._filter.objectMatchesFilter(newObj);
	      if (matches && !alreadyContains) {
	        log('Updated object now matches!', newObj);
	        idx = this.insert(newObj);
	        this.emit(modelEvents.ModelEventType.Splice, {
	          index: idx,
	          added: [newObj],
	          type: modelEvents.ModelEventType.Splice,
	          obj: this
	        });
	      }
	      else if (!matches && alreadyContains) {
	        log('Updated object no longer matches!', newObj);
	        results = this.results.mutableCopy();
	        var removed = results.splice(index, 1);
	        this.results = results.asModelFilterSet(this.model);
	        this.emit(modelEvents.ModelEventType.Splice, {
	          index: index,
	          obj: this,
	          new: newObj,
	          type: modelEvents.ModelEventType.Splice,
	          removed: removed
	        });
	      }
	      else if (!matches && !alreadyContains) {
	        log('Does not contain, but doesnt match so not inserting', newObj);
	      }
	      else if (matches && alreadyContains) {
	        log('Matches but already contains', newObj);
	        // Send the notification over.
	        this.emit(n.type, n);
	      }
	    }
	    else if (n.type == modelEvents.ModelEventType.Remove) {
	      newObj = n.obj;
	      var results = this.results.mutableCopy();
	      index = results.indexOf(newObj);
	      if (index > -1) {
	        log('Removing object', newObj);
	        removed = results.splice(index, 1);
	        this.results = constructFilterSet(results, this.model);
	        this.emit(modelEvents.ModelEventType.Splice, {
	          index: index,
	          obj: this,
	          type: modelEvents.ModelEventType.Splice,
	          removed: removed
	        });
	      }
	      else {
	        log('No modelEvents neccessary.', newObj);
	      }
	    }
	    else {
	      throw new InternalSiestaError('Unknown change type "' + n.type.toString() + '"')
	    }
	    this.results = constructFilterSet(this._filter._sortResults(this.results), this.model);
	  },
	  _constructNotificationName: function() {
	    return this.model.collectionName + ':' + this.model.name;
	  },
	  terminate: function() {
	    if (this.handler) {
	      this.model.context.events.removeListener(this._constructNotificationName(), this.handler);
	    }
	    this.results = null;
	    this.handler = null;
	  },
	  _registerEventHandler: function(on, name, fn) {
	    var removeListener = EventEmitter.prototype.removeListener;
	    if (name.trim() == '*') {
	      Object.keys(modelEvents.ModelEventType).forEach(function(k) {
	        on.call(this, modelEvents.ModelEventType[k], fn);
	      }.bind(this));
	    }
	    else {
	      on.call(this, name, fn);
	    }
	    return this._link({
	        on: this.on.bind(this),
	        once: this.once.bind(this),
	        update: this.update.bind(this),
	        insert: this.insert.bind(this)
	      },
	      function() {
	        if (name.trim() == '*') {
	          Object.keys(modelEvents.ModelEventType).forEach(function(k) {
	            removeListener.call(this, modelEvents.ModelEventType[k], fn);
	          }.bind(this));
	        }
	        else {
	          removeListener.call(this, name, fn);
	        }
	      })
	  },
	  on: function(name, fn) {
	    return this._registerEventHandler(EventEmitter.prototype.on, name, fn);
	  },
	  once: function(name, fn) {
	    return this._registerEventHandler(EventEmitter.prototype.once, name, fn);
	  }
	});
	
	module.exports = ReactiveFilter;


/***/ },
/* 3 */
/***/ function(module, exports, __webpack_require__) {

	var events = __webpack_require__(11),
	  modelEvents = __webpack_require__(4),
	  Cache = __webpack_require__(26),
	  util = __webpack_require__(1),
	  Model = __webpack_require__(7),
	  error = __webpack_require__(8),
	  Storage = __webpack_require__(21),
	  Filter = __webpack_require__(15),
	  Collection = __webpack_require__(13);
	
	function configureStorage(opts) {
	  this._storage = new Storage(this, opts);
	}
	
	function Context(opts) {
	  this.collections = {};
	  this.cache = new Cache();
	
	  opts = opts || {};
	  this.name = opts.name;
	
	  if (opts.storage) {
	    configureStorage.call(this, opts.storage);
	  }
	
	  if (!this.name) throw new Error('Must provide name to context');
	
	  this.events = events();
	  var off = this.events.removeListener.bind(this.events);
	
	  util.extend(this, {
	    on: this.events.on.bind(this.events),
	    off: off,
	    removeListener: off,
	    once: this.events.once.bind(this.events),
	    removeAllListeners: this.events.removeAllListeners.bind(this.events),
	    notify: util.next,
	    digest: util.next,
	    emit: util.next,
	    registerComparator: Filter.registerComparator.bind(Filter),
	    save: function(cb) {
	      return util.promise(cb, function(cb) {
	        if (this._storage) {
	          this._storage.save(cb);
	        }
	        else cb();
	      }.bind(this));
	    }
	  });
	
	  var interval, saving, autosaveInterval = 500;
	
	  Object.defineProperties(this, {
	    storage: {
	      get: function() {
	        return !!this._storage;
	      },
	      set: function(v) {
	        if (!v) {
	          delete this._storage;
	        }
	        else {
	          this._storage = new Storage(this);
	        }
	      }
	    },
	    dirty: {
	      get: function() {
	        var storage = this._storage;
	        if (storage) {
	          var unsavedObjectsByCollection = storage._unsavedObjectsByCollection;
	          return !!Object.keys(storage.unsavedObjectsByCollection).length;
	        }
	        return false;
	      },
	      enumerable: true
	    },
	    autosaveInterval: {
	      get: function() {
	        return autosaveInterval;
	      },
	      set: function(_autosaveInterval) {
	        autosaveInterval = _autosaveInterval;
	        if (interval) {
	          // Reset interval
	          this.autosave = false;
	          this.autosave = true;
	        }
	      }
	    },
	    autosave: {
	      get: function() {
	        return !!interval;
	      },
	      set: function(autosave) {
	        if (autosave) {
	          if (!interval) {
	            interval = setInterval(function() {
	              // Cheeky way of avoiding multiple saves happening...
	              if (!saving) {
	                saving = true;
	                this._storage.save(function(err) {
	                  if (!err) {
	                    this.events.emit('saved');
	                  }
	                  saving = false;
	                }.bind(this));
	              }
	            }.bind(this), this.autosaveInterval);
	          }
	        }
	        else {
	          if (interval) {
	            clearInterval(interval);
	            interval = null;
	          }
	        }
	      }
	    },
	    collectionNames: {
	      get: function() {
	        return Object.keys(this.collections);
	      }
	    }
	  });
	
	  this.autosave = opts.autosave;
	  if (opts.autosaveInterval) {
	    this.autosaveInterval = opts.autosaveInterval;
	  }
	}
	
	Context.prototype = {
	  collection: function(name, opts) {
	    opts = opts || {};
	    opts.context = this;
	    var collection = new Collection(name, opts);
	    if (!this[name]) {
	      this[name] = collection;
	    }
	    else {
	      var errMsg = 'A collection with name "' + name + '" already exists, or that name is not allowed';
	      console.error(errMsg, this[name]);
	      throw Error(errMsg);
	    }
	    return collection;
	  },
	  broadcast: function(opts) {
	    modelEvents.emit(this, opts);
	  },
	  graph: function(data, opts, cb) {
	    if (typeof opts == 'function') cb = opts;
	    opts = opts || {};
	    return util.promise(cb, function(cb) {
	      var tasks = [], err;
	      for (var collectionName in data) {
	        if (data.hasOwnProperty(collectionName)) {
	          var collection = this.collections[collectionName];
	          if (collection) {
	            (function(collection, data) {
	              tasks.push(function(done) {
	                collection.graph(data, function(err, res) {
	                  if (!err) {
	                    var results = {};
	                    results[collection.name] = res;
	                  }
	                  done(err, results);
	                });
	              });
	            })(collection, data[collectionName]);
	          }
	          else {
	            err = 'No such collection "' + collectionName + '"';
	          }
	        }
	      }
	      if (!err) {
	        util.series(tasks, function(err, results) {
	          if (!err) {
	            results = results.reduce(function(memo, res) {
	              return util.extend(memo, res);
	            }, {})
	          } else results = null;
	          cb(err, results);
	        });
	      }
	      else cb(error(err, {data: data, invalidCollectionName: collectionName}));
	    }.bind(this));
	  },
	  count: function() {
	    return this.cache.count();
	  },
	  get: function(id, cb) {
	    return util.promise(cb, function(cb) {
	      cb(null, this.cache._localCache()[id]);
	    }.bind(this));
	  },
	  removeAll: function(cb) {
	    return util.promise(cb, function(cb) {
	      util.Promise.all(
	        this.collectionNames.map(function(collectionName) {
	          var collection = this.collections[collectionName];
	          return collection.removeAll();
	        }.bind(this))
	      ).then(function() {
	          cb(null);
	        }).catch(cb)
	    }.bind(this));
	  },
	  _ensureInstalled: function(cb) {
	    cb = cb || function() {};
	    var allModels = this.collectionNames.reduce(function(memo, collectionName) {
	      var collection = this.collections[collectionName];
	      memo = memo.concat(collection.models);
	      return memo;
	    }.bind(this), []);
	    console.log('installing models', allModels);
	    Model.install(allModels, cb);
	  },
	  _pushTask: function(task) {
	    if (!this.queuedTasks) {
	      this.queuedTasks = new function Queue() {
	        this.tasks = [];
	        this.execute = function() {
	          this.tasks.forEach(function(f) {
	            f()
	          });
	          this.tasks = [];
	        }.bind(this);
	      };
	    }
	    this.queuedTasks.tasks.push(task);
	  },
	  reset: function(cb, resetStorage) {
	    delete this.queuedTasks;
	    this.cache.reset();
	    var collectionNames = this.collectionNames;
	    collectionNames.forEach(function(collectionName) {
	      this[collectionName] = undefined;
	    }.bind(this));
	    this.removeAllListeners();
	    if (this._storage) {
	      resetStorage = resetStorage === undefined ? true : resetStorage;
	      if (resetStorage) {
	        this._storage._reset(cb, new PouchDB('siesta', {auto_compaction: true, adapter: 'memory'}));
	      }
	      else {
	        cb();
	      }
	    }
	    else {
	      cb();
	    }
	  },
	  /**
	   *
	   * @param opts
	   * @param opts.name - Name of the context.
	   */
	  context: function(opts) {
	    var context = new Context(opts),
	      collectionNames = this.collectionNames,
	      collections = {};
	    collectionNames.forEach(function(collectionName) {
	      var newCollection = context.collection(collectionName),
	        existingCollection = this.collections[collectionName];
	      collections[collectionName] = newCollection;
	
	      var rawModels = existingCollection._rawModels;
	      Object.keys(rawModels).forEach(function(modelName) {
	        var rawModel = util.extend({}, rawModels[modelName]);
	        rawModel.name = modelName;
	        var relationships = rawModel.relationships;
	        if (relationships) {
	          Object.keys(relationships).forEach(function(relName) {
	            var rel = util.extend({}, relationships[relName]);
	            if (rel.model) {
	              if (rel.model instanceof Model) {
	                // The raw models cannot refer to Models that exist in different contexts.
	                rel.model = rel.model.name;
	              }
	            }
	            relationships[relName] = rel;
	          });
	        }
	        newCollection.model(rawModel);
	      });
	    }.bind(this));
	
	    return context;
	  }
	};
	
	module.exports = Context;


/***/ },
/* 4 */
/***/ function(module, exports, __webpack_require__) {

	var InternalSiestaError = __webpack_require__(8).InternalSiestaError,
	  log = __webpack_require__(5)('events'),
	  ArrayObserver = __webpack_require__(23).ArrayObserver,
	  extend = __webpack_require__(1).extend;
	
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
	  Object.keys(opts).forEach(function(k) {
	    this[k] = opts[k];
	  }.bind(this));
	}
	
	ModelEvent.prototype._dump = function(pretty) {
	  var dumped = {};
	  dumped.collection = (typeof this.collection) == 'string' ? this.collection : this.collection._dump();
	  dumped.model = (typeof this.model) == 'string' ? this.model : this.model.name;
	  dumped.localId = this.localId;
	  dumped.field = this.field;
	  dumped.type = this.type;
	  if (this.index) dumped.index = this.index;
	  if (this.added) dumped.added = this.added.map(function(x) {return x._dump()});
	  if (this.removed) dumped.removed = this.removed.map(function(x) {return x._dump()});
	  if (this.old) dumped.old = this.old;
	  if (this.new) dumped.new = this.new;
	  return pretty ? util.prettyPrint(dumped) : dumped;
	};
	
	function broadcastEvent(context, collectionName, modelName, opts) {
	  var genericEvent = 'Siesta',
	    collection = context.collections[collectionName],
	    model = collection[modelName];
	  if (!collection) throw new InternalSiestaError('No such collection "' + collectionName + '"');
	  if (!model) throw new InternalSiestaError('No such model "' + modelName + '"');
	  var shouldEmit = opts.obj._emitEvents;
	  // Don't emit pointless events.
	  if (shouldEmit && 'new' in opts && 'old' in opts) {
	    if (opts.new instanceof Date && opts.old instanceof Date) {
	      shouldEmit = opts.new.getTime() != opts.old.getTime();
	    }
	    else {
	      shouldEmit = opts.new != opts.old;
	    }
	  }
	  if (shouldEmit) {
	    context.events.emit(genericEvent, opts);
	    var modelEvent = collectionName + ':' + modelName,
	      localIdEvent = opts.localId;
	    context.events.emit(collectionName, opts);
	    context.events.emit(modelEvent, opts);
	    context.events.emit(localIdEvent, opts);
	    if (model.id && opts.obj[model.id]) context.events.emit(collectionName + ':' + modelName + ':' + opts.obj[model.id], opts);
	  }
	}
	
	function validateEventOpts(opts) {
	  if (!opts.model) throw new InternalSiestaError('Must pass a model');
	  if (!opts.collection) throw new InternalSiestaError('Must pass a collection');
	  if (!opts.localId) throw new InternalSiestaError('Must pass a local identifier');
	  if (!opts.obj) throw new InternalSiestaError('Must pass the object');
	}
	
	function emit(app, opts) {
	  validateEventOpts(opts);
	  var collection = opts.collection;
	  var model = opts.model;
	  var c = new ModelEvent(opts);
	  broadcastEvent(app, collection, model, c);
	  return c;
	}
	
	extend(exports, {
	  ModelEvent: ModelEvent,
	  emit: emit,
	  validateEventOpts: validateEventOpts,
	  ModelEventType: ModelEventType,
	  wrapArray: function(array, field, modelInstance) {
	    if (!array.observer) {
	      array.observer = new ArrayObserver(array);
	      array.observer.open(function(splices) {
	        var fieldIsAttribute = modelInstance._attributeNames.indexOf(field) > -1;
	        if (fieldIsAttribute) {
	          splices.forEach(function(splice) {
	            emit(modelInstance.context, {
	              collection: modelInstance.collectionName,
	              model: modelInstance.model.name,
	              localId: modelInstance.localId,
	              index: splice.index,
	              removed: splice.removed,
	              added: splice.addedCount ? array.slice(splice.index, splice.index + splice.addedCount) : [],
	              type: ModelEventType.Splice,
	              field: field,
	              obj: modelInstance
	            });
	          });
	        }
	      });
	    }
	  }
	});


/***/ },
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * Dead simple logging service based on visionmedia/debug
	 * @module log
	 */
	
	var debug = __webpack_require__(27),
	  argsarray = __webpack_require__(31);
	
	module.exports = function(name) {
	  var log = debug('siesta:' + name);
	  var fn = argsarray(function(args) {
	    log.call(log, args);
	  });
	  Object.defineProperty(fn, 'enabled', {
	    get: function() {
	      return debug.enabled(name);
	    }
	  });
	  return fn;
	};

/***/ },
/* 6 */
/***/ function(module, exports, __webpack_require__) {

	var util = __webpack_require__(1),
	  Promise = __webpack_require__(24),
	  argsarray = __webpack_require__(31);
	
	function Condition(fn, lazy) {
	  if (lazy === undefined || lazy === null) {
	    this.lazy = true;
	  }
	  this._fn = fn || function(done) {
	    done();
	  };
	  this.reset();
	}
	
	Condition.all = argsarray(function(args) {
	  return new Condition(args);
	});
	
	Condition.prototype = {
	  _execute: function() {
	    if (!this.executed) {
	      var dependents = util.pluck(this.dependent, '_promise');
	      Promise
	        .all(dependents)
	        .then(this.fn)
	        .catch(this.reject.bind(this));
	      this.dependent.forEach(function(d) {
	        d._execute();
	      });
	    }
	  },
	  then: function(success, fail) {
	    this._execute();
	    this._promise.then(success, fail);
	    return this;
	  },
	  catch: function(fail) {
	    this._execute();
	    this._promise.catch(fail);
	    return this;
	  },
	  resolve: function(res) {
	    this.executed = true;
	    this._promise.resolve(res);
	  },
	  reject: function(err) {
	    this.executed = true;
	    this._promise.reject(err);
	  },
	  dependentOn: function(cond) {
	    this.dependent.push(cond);
	  },
	  reset: function() {
	    this._promise = new Promise(function(resolve, reject) {
	      this.reject = reject;
	      this.resolve = resolve;
	      this.fn = function() {
	        this.executed = true;
	        var numComplete = 0;
	        var results = [];
	        var errors = [];
	        if (util.isArray(this._fn)) {
	          var checkComplete = function() {
	            if (numComplete == this._fn.length) {
	              if (errors.length) {
	                reject(errors);
	              }
	              else {
	                resolve(results);
	              }
	            }
	          }.bind(this);
	          this
	            ._fn
	            .forEach(function(cond, idx) {
	              cond
	                .then(function(res) {
	                  results[idx] = res;
	                  numComplete++;
	                  checkComplete();
	                }.bind(this))
	                .catch(function(err) {
	                  errors[idx] = err;
	                  numComplete++;
	                  checkComplete();
	                }.bind(this));
	            });
	        }
	        else {
	          this._fn(function(err, res) {
	            if (err) reject(err);
	            else resolve(res);
	          }.bind(this))
	        }
	      }.bind(this)
	    }.bind(this));
	
	    if (!this.lazy) this._execute();
	    this.executed = false;
	    this.dependent = [];
	  }
	};
	
	module.exports = Condition;


/***/ },
/* 7 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(setImmediate) {var log = __webpack_require__(5)('model'),
	  InternalSiestaError = __webpack_require__(8).InternalSiestaError,
	  RelationshipType = __webpack_require__(20),
	  Filter = __webpack_require__(15),
	  MappingOperation = __webpack_require__(10),
	  ModelInstance = __webpack_require__(9),
	  util = __webpack_require__(1),
	  argsarray = __webpack_require__(31),
	  error = __webpack_require__(8),
	  extend = __webpack_require__(22),
	  modelEvents = __webpack_require__(4),
	  Condition = __webpack_require__(6),
	  ProxyEventEmitter = __webpack_require__(12),
	  Promise = util.Promise,
	  SiestaPromise = __webpack_require__(24),
	  Placeholder = __webpack_require__(28),
	  ReactiveFilter = __webpack_require__(2),
	  InstanceFactory = __webpack_require__(29);
	
	/**
	 *
	 * @param {Object} opts
	 */
	function Model(opts) {
	  var self = this;
	
	  // Used when creating new contexts when must clone all the models/collections over to the new one
	  this._rawOpts = util.extend({}, opts || {});
	  this._opts = opts ? util.extend({}, opts) : {};
	
	  util.extendFromOpts(this, opts, {
	    methods: {},
	    attributes: [],
	    collection: null,
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
	    this.parseAttribute = function(attrName, value) {
	      return value;
	    }
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
	      get: function() {
	        return Object.keys(self.relationships);
	      },
	      enumerable: true
	    },
	    _attributeNames: {
	      get: function() {
	        var names = [];
	        if (self.id) {
	          names.push(self.id);
	        }
	        self.attributes.forEach(function(x) {
	          names.push(x.name)
	        });
	        return names;
	      },
	      enumerable: true,
	      configurable: true
	    },
	    installed: {
	      get: function() {
	        return self._relationshipsInstalled && self._reverseRelationshipsInstalled;
	      },
	      enumerable: true,
	      configurable: true
	    },
	    descendants: {
	      get: function() {
	        return self.children.reduce(function(memo, descendant) {
	          return Array.prototype.concat.call(memo, descendant.descendants);
	        }.bind(self), util.extend([], self.children));
	      },
	      enumerable: true
	    },
	    dirty: {
	      get: function() {
	        if (this.context.storage) {
	          var unsavedObjectsByCollection = this.context._storage._unsavedObjectsByCollection,
	            hash = (unsavedObjectsByCollection[this.collectionName] || {})[this.name] || {};
	          return !!Object.keys(hash).length;
	        }
	        else return undefined;
	      },
	      enumerable: true
	    },
	    collectionName: {
	      get: function() {
	        return this.collection.name;
	      },
	      enumerable: true
	    },
	    context: {
	      get: function() {
	        return this.collection.context;
	      }
	    }
	  });
	  var globalEventName = this.collectionName + ':' + this.name,
	    proxied = {
	      filter: this.filter.bind(this)
	    };
	
	  ProxyEventEmitter.call(this, this.context, globalEventName, proxied);
	
	  this.installRelationships();
	  this.installReverseRelationships();
	
	  this._indexIsInstalled = new Condition(function(done) {
	    if (this.context.storage) {
	      this.context._storage.ensureIndexInstalled(this, function(err) {
	        done(err);
	      });
	    }
	    else done();
	  }.bind(this));
	
	  this._modelLoadedFromStorage = new Condition(function(done) {
	    var storage = this.context.storage;
	    if (storage) {
	      this.context._storage.loadModel({model: this}, function(err) {
	        done(err);
	      });
	    }
	    else done();
	  }.bind(this));
	
	  this._storageEnabled = new Condition([this._indexIsInstalled, this._modelLoadedFromStorage]);
	}
	
	util.extend(Model, {
	  /**
	   * Normalise attributes passed via the options dictionary.
	   * @param attributes
	   * @returns {Array}
	   * @private
	   */
	  _processAttributes: function(attributes) {
	    return attributes.reduce(function(m, a) {
	      if (typeof a == 'string') {
	        m.push({
	          name: a
	        });
	      }
	      else {
	        m.push(a);
	      }
	      return m;
	    }, [])
	  },
	  install: function(models, cb) {
	    cb = cb || function() {};
	    return new SiestaPromise(function(resolve, reject) {
	      var storageConditions = models.map(function(x) {return x._storageEnabled});
	      Condition
	        .all
	        .apply(Condition, storageConditions)
	        .then(function() {
	          models.forEach(function(m) {
	            m._installReversePlaceholders();
	          });
	          cb();
	          resolve();
	        })
	        .catch(function(err) {
	          reject(err);
	        });
	    });
	  }
	
	});
	
	Model.prototype = Object.create(ProxyEventEmitter.prototype);
	
	util.extend(Model.prototype, {
	  installStatics: function(statics) {
	    if (statics) {
	      Object.keys(statics).forEach(function(staticName) {
	        if (this[staticName]) {
	          log('Static method with name "' + staticName + '" already exists. Ignoring it.');
	        }
	        else {
	          this[staticName] = statics[staticName].bind(this);
	        }
	      }.bind(this));
	    }
	    return statics;
	  },
	  _validateRelationshipType: function(relationship) {
	    if (!relationship.type) {
	      if (this.singleton) relationship.type = RelationshipType.OneToOne;
	      else relationship.type = RelationshipType.OneToMany;
	    }
	    if (this.singleton && relationship.type == RelationshipType.ManyToMany)
	      throw new Error('Singleton model cannot use ManyToMany relationship.');
	    if (Object.keys(RelationshipType).indexOf(relationship.type) < 0)
	      throw new Error('Relationship type ' + relationship.type + ' does not exist');
	  },
	  _getReverseModel: function(reverseName) {
	    var reverseModel;
	    if (reverseName instanceof Model) reverseModel = reverseName;
	    else reverseModel = this.collection[reverseName];
	    if (!reverseModel) { // May have used Collection.Model format.
	      var arr = reverseName.split('.');
	      if (arr.length == 2) {
	        var collectionName = arr[0];
	        reverseName = arr[1];
	        var otherCollection = this.context.collections[collectionName];
	        if (otherCollection)
	          reverseModel = otherCollection[reverseName];
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
	  _getReverseModelOrPlaceholder: function(forwardName, reverseName) {
	    var reverseModel = this._getReverseModel(reverseName);
	    return reverseModel || new Placeholder({name: reverseName, ref: this, forwardName: forwardName});
	  },
	  /**
	   * Install relationships. Returns error in form of string if fails.
	   * @return {String|null}
	   */
	  installRelationships: function() {
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
	
	              }
	              else return 'Must pass model';
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
	  _installReverse: function(relationship) {
	    var reverseRelationship = util.extend({}, relationship);
	    reverseRelationship.isReverse = true;
	    var reverseModel = reverseRelationship.reverseModel;
	    var isPlaceholder = reverseModel.isPlaceholder;
	    if (isPlaceholder) {
	      var modelName = reverseRelationship.reverseModel.name;
	      reverseModel = this._getReverseModel(modelName);
	      if (reverseModel) {
	        reverseRelationship.reverseModel = reverseModel;
	        relationship.reverseModel = reverseModel;
	      }
	    }
	
	
	    if (reverseModel) {
	
	      var reverseName = reverseRelationship.reverseName,
	        forwardModel = reverseRelationship.forwardModel;
	
	      if (reverseModel != this || reverseModel == forwardModel) {
	        if (reverseModel.singleton) {
	          if (reverseRelationship.type == RelationshipType.ManyToMany) throw new Error('Singleton model cannot be related via reverse ManyToMany');
	          if (reverseRelationship.type == RelationshipType.OneToMany) throw new Error('Singleton model cannot be related via reverse OneToMany');
	        }
	        if (reverseModel.relationships[reverseName]) {
	          // We are ok to redefine reverse relationships whereby the models are in the same hierarchy
	          var isAncestorModel = reverseModel.relationships[reverseName].forwardModel.isAncestorOf(this);
	          var isDescendentModel = reverseModel.relationships[reverseName].forwardModel.isDescendantOf(this);
	          if (!isAncestorModel && !isDescendentModel && !isPlaceholder) {
	            throw new Error('Reverse relationship "' + reverseName + '" already exists on model "' + reverseModel.name + '"');
	          }
	        }
	        reverseModel.relationships[reverseName] = reverseRelationship;
	      }
	
	      var existingReverseInstances = (this.context.cache._localCacheByType[reverseModel.collectionName] || {})[reverseModel.name] || {};
	      Object.keys(existingReverseInstances).forEach(function(localId) {
	        var instancce = existingReverseInstances[localId];
	        this._factory._installRelationship(reverseRelationship, instancce);
	      }.bind(this));
	
	    }
	  },
	  /**
	   * Cycle through relationships and replace any placeholders with the actual models where possible.
	   */
	  _installReversePlaceholders: function() {
	    for (var forwardName in this.relationships) {
	      if (this.relationships.hasOwnProperty(forwardName)) {
	        var relationship = this.relationships[forwardName];
	        if (relationship.reverseModel.isPlaceholder) {
	          this._installReverse(relationship);
	        }
	      }
	    }
	  },
	  installReverseRelationships: function() {
	    if (!this._reverseRelationshipsInstalled) {
	      for (var forwardName in this.relationships) {
	        if (this.relationships.hasOwnProperty(forwardName)) {
	          this._installReverse(this.relationships[forwardName]);
	        }
	      }
	      this._reverseRelationshipsInstalled = true;
	    }
	    else {
	      throw new InternalSiestaError('Reverse relationships for "' + this.name + '" have already been installed.');
	    }
	  },
	  _filter: function(filter) {
	    return new Filter(this, filter || {});
	  },
	  filter: function(filter, cb) {
	    var filterInstance;
	    var promise = util.promise(cb, function(cb) {
	      this.context._ensureInstalled(function() {
	        if (!this.singleton) {
	          filterInstance = this._filter(filter);
	          return filterInstance.execute(cb);
	        }
	        else {
	          filterInstance = this._filter({__ignoreInstalled: true});
	          filterInstance.execute(function(err, objs) {
	            if (err) cb(err);
	            else {
	              // Cache a new singleton and then reexecute the filter
	              filter = util.extend({}, filter);
	              filter.__ignoreInstalled = true;
	              if (!objs.length) {
	                this.graph({}, function(err) {
	                  if (!err) {
	                    filterInstance = this._filter(filter);
	                    filterInstance.execute(cb);
	                  }
	                  else {
	                    cb(err);
	                  }
	                }.bind(this));
	              }
	              else {
	                filterInstance = this._filter(filter);
	                filterInstance.execute(cb);
	              }
	            }
	          }.bind(this));
	        }
	      }.bind(this));
	    }.bind(this));
	
	    // By wrapping the promise in another promise we can push the invocations to the bottom of the event loop so that
	    // any event handlers added to the chain are honoured straight away.
	    var linkPromise = new util.Promise(function(resolve, reject) {
	      promise.then(argsarray(function(args) {
	        setImmediate(function() {
	          resolve.apply(null, args);
	        });
	      }), argsarray(function(args) {
	        setImmediate(function() {
	          reject.apply(null, args);
	        })
	      }));
	    });
	
	    return this._link({
	      then: linkPromise.then.bind(linkPromise),
	      catch: linkPromise.catch.bind(linkPromise),
	      on: argsarray(function(args) {
	        var rq = new ReactiveFilter(this._filter(filter));
	        rq.init();
	        rq.on.apply(rq, args);
	      }.bind(this))
	    });
	  },
	  /**
	   * Only used in testing at the moment.
	   * @param filter
	   * @returns {ReactiveFilter}
	   */
	  _reactiveFilter: function(filter) {
	    return new ReactiveFilter(new Filter(this, filter || {}));
	  },
	  one: function(opts, cb) {
	    if (typeof opts == 'function') {
	      cb = opts;
	      opts = {};
	    }
	    return util.promise(cb, function(cb) {
	      this.filter(opts, function(err, res) {
	        if (err) cb(err);
	        else {
	          if (res.length > 1) {
	            cb(error('More than one instance returned when executing get filter!'));
	          }
	          else {
	            res = res.length ? res[0] : null;
	            cb(null, res);
	          }
	        }
	      });
	    }.bind(this));
	  },
	  all: function(f, cb) {
	    if (typeof f == 'function') {
	      cb = f;
	      f = {};
	    }
	    f = f || {};
	    var filter = {};
	    if (f.__order) filter.__order = f.__order;
	    return this.filter(f, cb);
	  },
	  _attributeDefinitionWithName: function(name) {
	    for (var i = 0; i < this.attributes.length; i++) {
	      var attributeDefinition = this.attributes[i];
	      if (attributeDefinition.name == name) return attributeDefinition;
	    }
	  },
	  _graph: function(data, opts, cb) {
	    var _map = function() {
	      var overrides = opts.override;
	      if (overrides) {
	        if (util.isArray(overrides)) opts.objects = overrides;
	        else opts.objects = [overrides];
	      }
	      delete opts.override;
	      if (util.isArray(data)) {
	        this._mapBulk(data, opts, cb);
	      } else {
	        this._mapBulk([data], opts, function(err, objects) {
	          var obj;
	          if (objects) {
	            if (objects.length) {
	              obj = objects[0];
	            }
	          }
	          err = err ? (util.isArray(data) ? err : (util.isArray(err) ? err[0] : err)) : null;
	          cb(err, obj);
	        });
	      }
	    }.bind(this);
	    _map();
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
	  graph: function(data, opts, cb) {
	    if (typeof opts == 'function') cb = opts;
	    opts = opts || {};
	    return util.promise(cb, function(cb) {
	      this
	        .context
	        ._ensureInstalled(function(err) {
	          if (!err) {
	            this._graph(data, opts, cb);
	          }
	          else {
	            cb(err);
	          }
	        }.bind(this));
	    }.bind(this));
	  },
	  _mapBulk: function(data, opts, callback) {
	    util.extend(opts, {model: this, data: data});
	    var op = new MappingOperation(opts);
	    op.start(function(err, objects) {
	      if (err) {
	        if (callback) callback(err);
	      } else {
	        callback(null, objects || []);
	      }
	    });
	  },
	  _countCache: function() {
	    var collCache = this.context.cache._localCacheByType[this.collectionName] || {};
	    var modelCache = collCache[this.name] || {};
	    return Object.keys(modelCache).reduce(function(m, localId) {
	      m[localId] = {};
	      return m;
	    }, {});
	  },
	  count: function(cb) {
	    return util.promise(cb, function(cb) {
	      this.context._ensureInstalled(function() {
	        cb(null, Object.keys(this._countCache()).length);
	      }.bind(this));
	    }.bind(this));
	  },
	  _dump: function(asJSON) {
	    var dumped = {};
	    dumped.name = this.name;
	    dumped.attributes = this.attributes;
	    dumped.id = this.id;
	    dumped.collection = this.collectionName;
	    dumped.relationships = this.relationships.map(function(r) {
	      return r.isForward ? r.forwardName : r.reverseName;
	    });
	    return asJSON ? util.prettyPrint(dumped) : dumped;
	  },
	  toString: function() {
	    return 'Model[' + this.name + ']';
	  },
	  removeAll: function(cb) {
	    return util.promise(cb, function(cb) {
	      this.all()
	        .then(function(instances) {
	          instances.remove();
	          cb();
	        })
	        .catch(cb);
	    }.bind(this));
	  }
	
	});
	
	// Subclassing
	util.extend(Model.prototype, {
	  child: function(nameOrOpts, opts) {
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
	  isChildOf: function(parent) {
	    return this.parent == parent;
	  },
	  isParentOf: function(child) {
	    return this.children.indexOf(child) > -1;
	  },
	  isDescendantOf: function(ancestor) {
	    var parent = this.parent;
	    while (parent) {
	      if (parent == ancestor) return true;
	      parent = parent.parent;
	    }
	    return false;
	  },
	  isAncestorOf: function(descendant) {
	    return this.descendants.indexOf(descendant) > -1;
	  },
	  hasAttributeNamed: function(attributeName) {
	    return this._attributeNames.indexOf(attributeName) > -1;
	  }
	});
	
	
	module.exports = Model;
	
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(33).setImmediate))

/***/ },
/* 8 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * Users should never see these thrown. A bug report should be filed if so as it means some assertion has failed.
	 * @param message
	 * @param context
	 * @param ssf
	 * @constructor
	 */
	function InternalSiestaError(message, context, ssf) {
	  Error.call(this, message, context, ssf);
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
	  if (typeof err == 'object') {
	    return 'error' in err && 'ok' in err && 'reason' in err;
	  }
	  return false;
	}
	
	module.exports = function(errMessage, extra) {
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
	  err.toString = function() {
	    return JSON.stringify(this);
	  };
	  return err;
	};
	
	module.exports.InternalSiestaError = InternalSiestaError;


/***/ },
/* 9 */
/***/ function(module, exports, __webpack_require__) {

	var log = __webpack_require__(5),
	  util = __webpack_require__(1),
	  error = __webpack_require__(8),
	  modelEvents = __webpack_require__(4),
	  ModelEventType = modelEvents.ModelEventType,
	  ProxyEventEmitter = __webpack_require__(12);
	
	
	function ModelInstance(model) {
	  if (!model) throw new Error('wtf');
	  var self = this;
	  this.model = model;
	
	  ProxyEventEmitter.call(this, model.context);
	
	  this.__proxies = {};
	  this._proxies = [];
	
	  util.subProperties(this, this.model, [
	    'collection',
	    'collectionName',
	    '_attributeNames',
	    {
	      name: 'idField',
	      property: 'id'
	    },
	    {
	      name: 'modelName',
	      property: 'name'
	    }
	  ]);
	
	
	  Object.defineProperties(this, {
	    _relationshipNames: {
	      get: function() {
	        var proxies = Object.keys(self.__proxies || {}).map(function(x) {
	          return self.__proxies[x]
	        });
	        return proxies.map(function(p) {
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
	    dirty: {
	      get: function() {
	        if (this.context.storage) {
	          return self.localId in this.context._storage._unsavedObjectsHash;
	        }
	        else return undefined;
	      },
	      enumerable: true
	    },
	    // This is for ProxyEventEmitter.
	    event: {
	      get: function() {
	        return this.localId
	      }
	    },
	    context: {
	      get: function() {
	        return this.model.context;
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
	
	ModelInstance.prototype = Object.create(ProxyEventEmitter.prototype);
	
	util.extend(ModelInstance.prototype, {
	  get: function(cb) {
	    return util.promise(cb, function(cb) {
	      cb(null, this);
	    }.bind(this));
	  },
	  emit: function(type, opts) {
	    if (typeof type == 'object') opts = type;
	    else opts.type = type;
	    opts = opts || {};
	    util.extend(opts, {
	      collection: this.collectionName,
	      model: this.model.name,
	      localId: this.localId,
	      obj: this
	    });
	    this.context.broadcast(opts);
	  },
	  remove: function(cb, notification) {
	    _.each(this._relationshipNames, function(name) {
	      if (util.isArray(this[name])) {
	        this[name] = [];
	      }
	      else {
	        this[name] = null;
	      }
	    }.bind(this));
	    notification = notification == null ? true : notification;
	    return util.promise(cb, function(cb) {
	      this.context.cache.remove(this);
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
	          remove.call(this, function(err) {
	            cb(err, self);
	          });
	        }
	        else {
	          remove.call(this);
	          cb(null, this);
	        }
	      }
	      else {
	        cb(null, this);
	      }
	    }.bind(this));
	  },
	  restore: function(cb) {
	    return util.promise(cb, function(cb) {
	      var _finish = function(err) {
	        if (!err) {
	          this.emit(modelEvents.ModelEventType.New, {
	            new: this
	          });
	        }
	        cb(err, this);
	      }.bind(this);
	      if (this.removed) {
	        this.context.cache.insert(this);
	        this.removed = false;
	        var init = this.model.init;
	        if (init) {
	          var paramNames = util.paramNames(init);
	          var fromStorage = true;
	          if (paramNames.length > 1) {
	            init.call(this, fromStorage, _finish);
	          }
	          else {
	            init.call(this, fromStorage);
	            _finish();
	          }
	        }
	        else {
	          _finish();
	        }
	      }
	    }.bind(this));
	  }
	});
	
	// Inspection
	util.extend(ModelInstance.prototype, {
	  getAttributes: function() {
	    return util.extend({}, this.__values);
	  },
	  isInstanceOf: function(model) {
	    return this.model == model;
	  },
	  isA: function(model) {
	    return this.model == model || this.model.isDescendantOf(model);
	  }
	});
	
	// Dump
	util.extend(ModelInstance.prototype, {
	  _dumpString: function(reverseRelationships) {
	    return JSON.stringify(this._dump(reverseRelationships, null, 4));
	  },
	  _dump: function(reverseRelationships) {
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
	  _defaultSerialise: function(opts) {
	    var serialised = {};
	    var includeNullAttributes = opts.includeNullAttributes !== undefined ? opts.includeNullAttributes : true,
	      includeNullRelationships = opts.includeNullRelationships !== undefined ? opts.includeNullRelationships : true;
	    var serialisableFields = this.model.serialisableFields ||
	      this._attributeNames.concat.apply(this._attributeNames, this._relationshipNames).concat(this.id);
	    this._attributeNames.forEach(function(attrName) {
	      if (serialisableFields.indexOf(attrName) > -1) {
	        var attrDefinition = this.model._attributeDefinitionWithName(attrName) || {};
	        var serialiser;
	        if (attrDefinition.serialise) serialiser = attrDefinition.serialise.bind(this);
	        else {
	          var serialiseField = this.model.serialiseField || defaultSerialiser;
	          serialiser = serialiseField.bind(this, attrName);
	        }
	        var val = this[attrName];
	        if (val === null) {
	          if (includeNullAttributes) {
	            serialised[attrName] = serialiser(val);
	          }
	        }
	        else if (val !== undefined) {
	          serialised[attrName] = serialiser(val);
	        }
	      }
	    }.bind(this));
	    this._relationshipNames.forEach(function(relName) {
	      if (serialisableFields.indexOf(relName) > -1) {
	        var val = this[relName],
	          rel = this.model.relationships[relName];
	
	        if (rel && !rel.isReverse) {
	          var serialiser;
	          if (rel.serialise) {
	            serialiser = rel.serialise.bind(this);
	          }
	          else {
	            var serialiseField = this.model.serialiseField;
	            if (!serialiseField) {
	              if (util.isArray(val)) val = util.pluck(val, this.model.id);
	              else if (val) val = val[this.model.id];
	            }
	            serialiseField = serialiseField || defaultSerialiser;
	            serialiser = serialiseField.bind(this, relName);
	          }
	          if (val === null) {
	            if (includeNullRelationships) {
	              serialised[relName] = serialiser(val);
	            }
	          }
	          else if (util.isArray(val)) {
	            if ((includeNullRelationships && !val.length) || val.length) {
	              serialised[relName] = serialiser(val);
	            }
	          }
	          else if (val !== undefined) {
	            serialised[relName] = serialiser(val);
	          }
	        }
	      }
	    }.bind(this));
	    return serialised;
	  },
	  serialise: function(opts) {
	    opts = opts || {};
	    if (!this.model.serialise) return this._defaultSerialise(opts);
	    else return this.model.serialise(this, opts);
	  }
	});
	
	util.extend(ModelInstance.prototype, {
	  serialize: ModelInstance.prototype.serialise
	});
	
	util.extend(ModelInstance.prototype, {
	  /**
	   * Emit an event indicating that this instance has just been created.
	   * @private
	   */
	  _emitNew: function() {
	    this.context.broadcast({
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
/* 10 */
/***/ function(module, exports, __webpack_require__) {

	var ModelInstance = __webpack_require__(9),
	  log = __webpack_require__(5)('graph'),
	  util = __webpack_require__(1);
	
	function SiestaError(opts) {
	  this.opts = opts;
	}
	
	SiestaError.prototype.toString = function() {
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
	    _ignoreInstalled: false,
	    fromStorage: false
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
	  mapAttributes: function() {
	    for (var i = 0; i < this.data.length; i++) {
	      var datum = this.data[i],
	        object = this.objects[i];
	      // No point mapping object onto itself. This happens if a ModelInstance is passed as a relationship.
	      if (datum != object) {
	        if (object) { // If object is falsy, then there was an error looking up that object/creating it.
	          var fields = this.model._attributeNames;
	          fields.forEach(function(f) {
	            if (datum[f] !== undefined) { // null is fine
	              // If events are disabled we update __values object directly. This avoids triggering
	              // events which are built into the set function of the property.
	              if (this.disableevents) {
	                object.__values[f] = datum[f];
	              }
	              else {
	                try {
	                  object[f] = datum[f];
	                }
	                catch (e) {
	                  this.errors[i] = e;
	                }
	              }
	            }
	          }.bind(this));
	          // PouchDB revision (if using storage module).
	          // TODO: Can this be pulled out of core?
	          if (datum._rev) object._rev = datum._rev;
	        }
	      }
	    }
	  },
	  _map: function() {
	    var self = this;
	    var err;
	    this.mapAttributes();
	    var relationshipFields = Object.keys(self.subTaskResults);
	    relationshipFields.forEach(function(f) {
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
	            err = object.__proxies[f].set(related, {
	              disableevents: self.disableevents
	            });
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
	  _sortLookups: function() {
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
	          } else if (datum instanceof ModelInstance) { // We won't need to perform any mapping.
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
	    return {remoteLookups: remoteLookups, localLookups: localLookups};
	  },
	  _performLocalLookups: function(localLookups) {
	    var cache = this.model.context.cache;
	    var localIdentifiers = util.pluck(util.pluck(localLookups, 'datum'), 'localId'),
	      localObjects = cache.getViaLocalId(localIdentifiers);
	    for (var i = 0; i < localIdentifiers.length; i++) {
	      var obj = localObjects[i];
	      var localId = localIdentifiers[i];
	      var lookup = localLookups[i];
	      if (!obj) {
	        // If there are multiple mapping operations going on, there may be
	        obj = cache.get({localId: localId});
	        if (!obj) obj = this._instance({localId: localId}, !this.disableevents);
	        this.objects[lookup.index] = obj;
	      } else {
	        this.objects[lookup.index] = obj;
	      }
	    }
	
	  },
	  _performRemoteLookups: function(remoteLookups) {
	    var cache = this.model.context.cache;
	    var remoteIdentifiers = util.pluck(util.pluck(remoteLookups, 'datum'), this.model.id),
	      remoteObjects = cache.getViaRemoteId(remoteIdentifiers, {model: this.model});
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
	  _lookup: function() {
	    if (this.model.singleton) {
	      this._lookupSingleton();
	    }
	    else {
	      var lookups = this._sortLookups(),
	        remoteLookups = lookups.remoteLookups,
	        localLookups = lookups.localLookups;
	      this._performLocalLookups(localLookups);
	      this._performRemoteLookups(remoteLookups);
	    }
	  },
	  _lookupSingleton: function() {
	    // Pick a random localId from the array of data being mapped onto the singleton object. Note that they should
	    // always be the same. This is just a precaution.
	    var localIdentifiers = util.pluck(this.data, 'localId'), localId;
	    for (i = 0; i < localIdentifiers.length; i++) {
	      if (localIdentifiers[i]) {
	        localId = {localId: localIdentifiers[i]};
	        break;
	      }
	    }
	    // The mapping operation is responsible for creating singleton instances if they do not already exist.
	    var singleton = this.model.context.cache.getSingleton(this.model) || this._instance(localId);
	    for (var i = 0; i < this.data.length; i++) {
	      this.objects[i] = singleton;
	    }
	  },
	  _instance: function() {
	    var model = this.model,
	      modelInstance = model._instance.apply(model, arguments);
	    this._newObjects.push(modelInstance);
	    return modelInstance;
	  },
	
	  preprocessData: function() {
	    var data = util.extend([], this.data);
	    return data.map(function(datum) {
	      if (datum) {
	        if (!util.isString(datum)) {
	          var keys = Object.keys(datum);
	          keys.forEach(function(k) {
	            var isRelationship = this.model._relationshipNames.indexOf(k) > -1;
	
	            if (isRelationship) {
	              var val = datum[k];
	              if (val instanceof ModelInstance) {
	                datum[k] = {localId: val.localId};
	              }
	
	            }
	          }.bind(this));
	        }
	      }
	      return datum;
	    }.bind(this));
	  },
	  start: function(done) {
	    var data = this.data;
	    if (data.length) {
	      var self = this;
	      var tasks = [];
	      this._lookup();
	      tasks.push(this._executeSubOperations.bind(this));
	      util.parallel(tasks, function(err) {
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
	        var fromStorage = this.fromStorage;
	        var initTasks = self._newObjects.reduce(function(memo, o) {
	          var init = o.model.init;
	          if (init) {
	            var paramNames = util.paramNames(init);
	            if (paramNames.length > 1) {
	              memo.push(init.bind(o, fromStorage, done));
	            }
	            else {
	              init.call(o, fromStorage);
	            }
	          }
	          o._emitEvents = true;
	          o._emitNew();
	          return memo;
	        }, []);
	        util.parallel(initTasks, function() {
	          done(self.errors.length ? self.errors : null, self.objects);
	        });
	      }.bind(this));
	    } else {
	      done(null, []);
	    }
	
	  },
	  getRelatedData: function(name) {
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
	  processErrorsFromTask: function(relationshipName, errors, indexes) {
	    if (errors.length) {
	      var relatedData = this.getRelatedData(relationshipName).relatedData;
	      var unflattenedErrors = util.unflattenArray(errors, relatedData);
	      for (var i = 0; i < unflattenedErrors.length; i++) {
	        var idx = indexes[i];
	        var err = unflattenedErrors[i];
	        var isError = err;
	        if (util.isArray(err)) isError = err.reduce(function(memo, x) {
	          return memo || x
	        }, false);
	        if (isError) {
	          if (!this.errors[idx]) this.errors[idx] = {};
	          this.errors[idx][relationshipName] = err;
	        }
	      }
	    }
	  },
	  _executeSubOperations: function(callback) {
	    var self = this,
	      relationshipNames = Object.keys(this.model.relationships);
	    if (relationshipNames.length) {
	      var tasks = relationshipNames.reduce(function(m, relationshipName) {
	        var relationship = self.model.relationships[relationshipName];
	        var reverseModel = relationship.forwardName == relationshipName ? relationship.reverseModel : relationship.forwardModel;
	        // Mock any missing singleton data to ensure that all singleton instances are created.
	        if (reverseModel.singleton && !relationship.isReverse) {
	          this.data.forEach(function(datum) {
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
	            _ignoreInstalled: self._ignoreInstalled,
	            fromStorage: this.fromStorage
	          });
	        }
	
	        if (op) {
	          var task;
	          task = function(done) {
	            op.start(function(errors, objects) {
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
	      util.parallel(tasks, function(err) {
	        callback(err);
	      });
	    } else {
	      callback();
	    }
	  }
	})
	;
	
	module.exports = MappingOperation;


/***/ },
/* 11 */
/***/ function(module, exports, __webpack_require__) {

	var EventEmitter = __webpack_require__(32).EventEmitter,
	  util = __webpack_require__(1),
	  argsarray = __webpack_require__(31),
	  modelEvents = __webpack_require__(4),
	  Chain = __webpack_require__(25);
	
	
	var eventEmitterfactory = function() {
	  var eventEmitter = new EventEmitter();
	  eventEmitter.setMaxListeners(100);
	
	
	  var oldEmit = eventEmitter.emit;
	
	  // Ensure that errors in event handlers do not stall Siesta.
	  eventEmitter.emit = function(event, payload) {
	    try {
	      oldEmit.call(eventEmitter, event, payload);
	    }
	    catch (e) {
	      console.error(e);
	    }
	  };
	  return eventEmitter;
	};
	
	module.exports = eventEmitterfactory;


/***/ },
/* 12 */
/***/ function(module, exports, __webpack_require__) {

	var ArrayObserver = __webpack_require__(23).ArrayObserver,
	  util = __webpack_require__(1),
	  argsarray = __webpack_require__(31),
	  modelEvents = __webpack_require__(4),
	  Chain = __webpack_require__(25);
	
	
	/**
	 * Listen to a particular event from the Siesta global EventEmitter.
	 * Manages its own set of listeners.
	 * @constructor
	 */
	function ProxyEventEmitter(context, event, chainOpts) {
	  if (!context) throw new Error('wtf');
	  util.extend(this, {
	    event: event,
	    context: context,
	    listeners: {}
	  });
	  var defaultChainOpts = {};
	
	  defaultChainOpts.on = this.on.bind(this);
	  defaultChainOpts.once = this.once.bind(this);
	
	  Chain.call(this, util.extend(defaultChainOpts, chainOpts || {}));
	}
	
	ProxyEventEmitter.prototype = Object.create(Chain.prototype);
	
	util.extend(ProxyEventEmitter.prototype, {
	  on: function(type, fn) {
	    if (typeof type == 'function') {
	      fn = type;
	      type = null;
	    }
	    else {
	      if (type.trim() == '*') type = null;
	      var _fn = fn;
	      fn = function(e) {
	        e = e || {};
	        if (type) {
	          if (e.type == type) {
	            _fn(e);
	          }
	        }
	        else {
	          _fn(e);
	        }
	      };
	      var listeners = this.listeners;
	      if (type) {
	        if (!listeners[type]) listeners[type] = [];
	        listeners[type].push(fn);
	      }
	    }
	    this.context.events.on(this.event, fn);
	    return this._handlerLink({
	      fn: fn,
	      type: type,
	      extend: this.proxyChainOpts
	    });
	  },
	  once: function(type, fn) {
	    var event = this.event;
	    if (typeof type == 'function') {
	      fn = type;
	      type = null;
	    }
	    else {
	      if (type.trim() == '*') type = null;
	      var _fn = fn;
	      fn = function(e) {
	        e = e || {};
	        if (type) {
	          if (e.type == type) {
	            this.context.events.removeListener(event, fn);
	            _fn(e);
	          }
	        }
	        else {
	          _fn(e);
	        }
	      }.bind(this)
	    }
	    if (type) return this.context.events.on(event, fn);
	    else return this.context.events.once(event, fn);
	  },
	  _removeListener: function(fn, type) {
	    if (type) {
	      var listeners = this.listeners[type],
	        idx = listeners.indexOf(fn);
	      listeners.splice(idx, 1);
	    }
	    return this.context.events.removeListener(this.event, fn);
	  },
	  emit: function(type, payload) {
	    if (typeof type == 'object') {
	      payload = type;
	      type = null;
	    }
	    else {
	      payload = payload || {};
	      payload.type = type;
	    }
	    this.context.events.emit.call(this.context.events, this.event, payload);
	  },
	  _removeAllListeners: function(type) {
	    (this.listeners[type] || []).forEach(function(fn) {
	      this.context.events.removeListener(this.event, fn);
	    }.bind(this));
	    this.listeners[type] = [];
	  },
	  removeAllListeners: function(type) {
	    if (type) {
	      this._removeAllListeners(type);
	    }
	    else {
	      for (type in this.listeners) {
	        if (this.listeners.hasOwnProperty(type)) {
	          this._removeAllListeners(type);
	        }
	      }
	    }
	  }
	});
	
	module.exports = ProxyEventEmitter;


/***/ },
/* 13 */
/***/ function(module, exports, __webpack_require__) {

	var log = __webpack_require__(5)('collection'),
	  InternalSiestaError = __webpack_require__(8).InternalSiestaError,
	  Model = __webpack_require__(7),
	  extend = __webpack_require__(22),
	  ProxyEventEmitter = __webpack_require__(12),
	  util = __webpack_require__(1),
	  error = __webpack_require__(8),
	  argsarray = __webpack_require__(31),
	  Condition = __webpack_require__(30);
	
	
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
	  util.extendFromOpts(this, opts, {
	    context: null
	  });
	
	  util.extend(this, {
	    name: name,
	    _rawModels: {},
	    _models: {},
	    _opts: opts,
	    installed: false
	  });
	
	  Object.defineProperties(this, {
	    dirty: {
	      get: function() {
	        if (this.context.storage) {
	          var unsavedObjectsByCollection = this.context._storage._unsavedObjectsByCollection,
	            hash = unsavedObjectsByCollection[self.name] || {};
	          return !!Object.keys(hash).length;
	        }
	        else return undefined;
	      },
	      enumerable: true
	    },
	    models: {
	      get: function() {
	        return Object.keys(this._models).map(function(modelName) {
	          return this._models[modelName];
	        }.bind(this));
	      }
	    }
	  });
	
	  this.context.collections[this.name] = this;
	  ProxyEventEmitter.call(this, this.context, this.name);
	
	}
	
	Collection.prototype = Object.create(ProxyEventEmitter.prototype);
	
	util.extend(Collection.prototype, {
	  _model: function(name, opts) {
	    if (name) {
	      this._rawModels[name] = opts;
	      opts = extend(true, {}, opts);
	      opts.name = name;
	      opts.collection = this;
	      var model = new Model(opts);
	      this._models[name] = model;
	      this[name] = model;
	      return model;
	    }
	    else {
	      throw new Error('No name specified when creating mapping');
	    }
	  },
	
	  /**
	   * Registers a model with this collection.
	   */
	  model: argsarray(function(args) {
	    if (args.length) {
	      if (args.length == 1) {
	        if (util.isArray(args[0])) {
	          return args[0].map(function(m) {
	            return this._model(m.name, m);
	          }.bind(this));
	        } else {
	          var name, opts;
	          if (util.isString(args[0])) {
	            name = args[0];
	            opts = {};
	          }
	          else {
	            opts = args[0];
	            name = opts.name;
	          }
	          return this._model(name, opts);
	        }
	      } else {
	        if (typeof args[0] == 'string') {
	          return this._model(args[0], args[1]);
	        } else {
	          return args.map(function(m) {
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
	  _dump: function(asJson) {
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
	  count: function(cb) {
	    return util.promise(cb, function(cb) {
	      var tasks = Object.keys(this._models).map(function(modelName) {
	        var m = this._models[modelName];
	        return m.count.bind(m);
	      }.bind(this));
	      util.parallel(tasks, function(err, ns) {
	        var n;
	        if (!err) {
	          n = ns.reduce(function(m, r) {
	            return m + r
	          }, 0);
	        }
	        cb(err, n);
	      });
	    }.bind(this));
	  },
	
	  graph: function(data, opts, cb) {
	    if (typeof opts == 'function') cb = opts;
	    opts = opts || {};
	    return util.promise(cb, function(cb) {
	      var tasks = [], err;
	      for (var modelName in data) {
	        if (data.hasOwnProperty(modelName)) {
	          var model = this._models[modelName];
	          if (model) {
	            (function(model, data) {
	              tasks.push(function(done) {
	                model.graph(data, function(err, models) {
	                  if (!err) {
	                    var results = {};
	                    results[model.name] = models;
	                  }
	                  done(err, results);
	                });
	              });
	            })(model, data[modelName]);
	          }
	          else {
	            err = 'No such model "' + modelName + '"';
	          }
	        }
	      }
	      if (!err) {
	        util.series(tasks, function(err, results) {
	          if (!err) {
	            results = results.reduce(function(memo, res) {
	              return util.extend(memo, res || {});
	            }, {})
	          } else results = null;
	          cb(err, results);
	        });
	      }
	      else cb(error(err, {data: data, invalidModelName: modelName}));
	    }.bind(this));
	  },
	
	  removeAll: function(cb) {
	    return util.promise(cb, function(cb) {
	      util.Promise.all(
	        Object.keys(this._models).map(function(modelName) {
	          var model = this._models[modelName];
	          return model.removeAll();
	        }.bind(this))
	      ).then(function() {
	          cb(null);
	        })
	        .catch(cb)
	    }.bind(this));
	  }
	});
	
	module.exports = Collection;


/***/ },
/* 14 */
/***/ function(module, exports, __webpack_require__) {

	var util = __webpack_require__(1),
	  Promise = util.Promise,
	  error = __webpack_require__(8),
	  ModelInstance = __webpack_require__(9);
	
	/*
	 TODO: Use ES6 Proxy instead.
	 Eventually filter sets should use ES6 Proxies which will be much more natural and robust. E.g. no need for the below
	 */
	var ARRAY_METHODS = ['push', 'sort', 'reverse', 'splice', 'shift', 'unshift'],
	  NUMBER_METHODS = ['toString', 'toExponential', 'toFixed', 'toPrecision', 'valueOf'],
	  NUMBER_PROPERTIES = ['MAX_VALUE', 'MIN_VALUE', 'NEGATIVE_INFINITY', 'NaN', 'POSITIVE_INFINITY'],
	  STRING_METHODS = ['charAt', 'charCodeAt', 'concat', 'fromCharCode', 'indexOf', 'lastIndexOf', 'localeCompare',
	    'match', 'replace', 'search', 'slice', 'split', 'substr', 'substring', 'toLocaleLowerCase', 'toLocaleUpperCase',
	    'toLowerCase', 'toString', 'toUpperCase', 'trim', 'valueOf'],
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
	  }
	  else if (typeof object == 'number' || object instanceof Number) {
	    propertyNames = NUMBER_METHODS.concat(NUMBER_PROPERTIES);
	  }
	  else {
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
	  if (!(prop in arr)) { // e.g. we cannot redefine .length
	    Object.defineProperty(arr, prop, {
	      get: function() {
	        return filterSet(util.pluck(arr, prop));
	      },
	      set: function(v) {
	        if (util.isArray(v)) {
	          if (this.length != v.length) throw error({message: 'Must be same length'});
	          for (var i = 0; i < v.length; i++) {
	            this[i][prop] = v[i];
	          }
	        }
	        else {
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
	  if (!(prop in arr)) { // e.g. we don't want to redefine toString
	    arr[prop] = function() {
	      var args = arguments,
	        res = this.map(function(p) {
	          return p[prop].apply(p, args);
	        });
	      var arePromises = false;
	      if (res.length) arePromises = isPromise(res[0]);
	      return arePromises ? Promise.all(res) : filterSet(res);
	    };
	  }
	}
	
	/**
	 * Transform the array into a filter set.
	 * Renders the array immutable.
	 * @param arr
	 * @param model - The model with which to proxy to
	 */
	function modelFilterSet(arr, model) {
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
	 * Transform the array into a filter set, based on whatever is in it.
	 * Note that all objects must be of the same type. This function will take the first object and decide how to proxy
	 * based on that.
	 * @param arr
	 */
	function filterSet(arr) {
	  if (arr.length) {
	    var referenceObject = arr[0],
	      propertyNames = getPropertyNames(referenceObject);
	    propertyNames.forEach(function(prop) {
	      if (typeof referenceObject[prop] == 'function') defineMethod(arr, prop, arguments);
	      else defineAttribute(arr, prop);
	    });
	  }
	  return renderImmutable(arr);
	}
	
	function throwImmutableError() {
	  throw new Error('Cannot modify a filter set');
	}
	
	/**
	 * Render an array immutable by replacing any functions that can mutate it.
	 * @param arr
	 */
	function renderImmutable(arr) {
	  ARRAY_METHODS.forEach(function(p) {
	    arr[p] = throwImmutableError;
	  });
	  arr.immutable = true;
	  arr.mutableCopy = arr.asArray = function() {
	    var mutableArr = this.map(function(x) {return x});
	    mutableArr.asFilterSet = function() {
	      return filterSet(this);
	    };
	    mutableArr.asModelFilterSet = function(model) {
	      return modelFilterSet(this, model);
	    };
	    return mutableArr;
	  };
	  return arr;
	}
	
	module.exports = modelFilterSet;


/***/ },
/* 15 */
/***/ function(module, exports, __webpack_require__) {

	var log = __webpack_require__(5)('filter'),
	  util = __webpack_require__(1),
	  error = __webpack_require__(8),
	  ModelInstance = __webpack_require__(9),
	  constructFilterSet = __webpack_require__(14);
	
	/**
	 * @class
	 * @param {Model} model
	 * @param {Object} filter
	 */
	function Filter(model, filter) {
	  var opts = {};
	  for (var prop in filter) {
	    if (filter.hasOwnProperty(prop)) {
	      if (prop.slice(0, 2) == '__') {
	        opts[prop.slice(2)] = filter[prop];
	        delete filter[prop];
	      }
	    }
	  }
	  util.extend(this, {
	    model: model,
	    filter: filter,
	    opts: opts
	  });
	  opts.order = opts.order || [];
	  if (!util.isArray(opts.order)) opts.order = [opts.order];
	}
	
	function valueAsString(fieldValue) {
	  var fieldAsString;
	  if (fieldValue === null) fieldAsString = 'null';
	  else if (fieldValue === undefined) fieldAsString = 'undefined';
	  else if (fieldValue instanceof ModelInstance) fieldAsString = fieldValue.localId;
	  else fieldAsString = fieldValue.toString();
	  return fieldAsString;
	}
	
	function contains(opts) {
	  if (!opts.invalid) {
	    var obj = opts.object;
	    if (util.isArray(obj)) {
	      arr = util.pluck(obj, opts.field);
	    }
	    else
	      var arr = obj[opts.field];
	    if (util.isArray(arr) || util.isString(arr)) {
	      return arr.indexOf(opts.value) > -1;
	    }
	  }
	  return false;
	}
	
	var comparators = {
	  e: function(opts) {
	    return opts.object[opts.field] == opts.value;
	  },
	  ne: function(opts) {
	    return opts.object[opts.field] != opts.value;
	  },
	  lt: function(opts) {
	    if (!opts.invalid) return opts.object[opts.field] < opts.value;
	    return false;
	  },
	  gt: function(opts) {
	    if (!opts.invalid) return opts.object[opts.field] > opts.value;
	    return false;
	  },
	  lte: function(opts) {
	    if (!opts.invalid) return opts.object[opts.field] <= opts.value;
	    return false;
	  },
	  gte: function(opts) {
	    if (!opts.invalid) return opts.object[opts.field] >= opts.value;
	    return false;
	  },
	  contains: contains,
	  in: contains
	};
	
	util.extend(Filter, {
	  comparators: comparators,
	  registerComparator: function(symbol, fn) {
	    if (!comparators[symbol]) {
	      comparators[symbol] = fn;
	    }
	  }
	});
	
	function cacheForModel(model) {
	  var cacheByType = model.context.cache._localCacheByType;
	  var modelName = model.name;
	  var collectionName = model.collectionName;
	  var cacheByModel = cacheByType[collectionName];
	  var cacheByLocalId;
	  if (cacheByModel) {
	    cacheByLocalId = cacheByModel[modelName] || {};
	  }
	  return cacheByLocalId;
	}
	
	util.extend(Filter.prototype, {
	  execute: function(cb) {
	    return util.promise(cb, function(cb) {
	      this._executeInMemory(cb);
	    }.bind(this));
	  },
	  _dump: function(asJson) {
	    return asJson ? '{}' : {};
	  },
	  sortFunc: function(fields) {
	    var sortFunc = function(ascending, field) {
	      return function(v1, v2) {
	        var d1 = v1[field],
	          d2 = v2[field],
	          res;
	        if (typeof d1 == 'string' || d1 instanceof String &&
	          typeof d2 == 'string' || d2 instanceof String) {
	          res = ascending ? d1.localeCompare(d2) : d2.localeCompare(d1);
	        }
	        else {
	          if (d1 instanceof Date) d1 = d1.getTime();
	          if (d2 instanceof Date) d2 = d2.getTime();
	          if (ascending) res = d1 - d2;
	          else res = d2 - d1;
	        }
	        return res;
	      }
	    };
	    var s = util;
	    for (var i = 0; i < fields.length; i++) {
	      var field = fields[i];
	      s = s.thenBy(sortFunc(field.ascending, field.field));
	    }
	    return s == util ? null : s;
	  },
	  _sortResults: function(res) {
	    var order = this.opts.order;
	    if (res && order) {
	      var fields = order.map(function(ordering) {
	        var splt = ordering.split('-'),
	          ascending = true,
	          field = null;
	        if (splt.length > 1) {
	          field = splt[1];
	          ascending = false;
	        }
	        else {
	          field = splt[0];
	        }
	        return {field: field, ascending: ascending};
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
	  _getCacheByLocalId: function() {
	    return this.model.descendants.reduce(function(memo, childModel) {
	      return util.extend(memo, cacheForModel(childModel));
	    }, util.extend({}, cacheForModel(this.model)));
	  },
	  _executeInMemory: function(callback) {
	    var cacheByLocalId = this._getCacheByLocalId();
	    var keys = Object.keys(cacheByLocalId);
	    var self = this;
	    var res = [];
	    var err;
	    for (var i = 0; i < keys.length; i++) {
	      var k = keys[i];
	      var obj = cacheByLocalId[k];
	      var matches = self.objectMatchesFilter(obj);
	      if (typeof(matches) == 'string') {
	        err = error(matches);
	        break;
	      } else {
	        if (matches) res.push(obj);
	      }
	    }
	    res = this._sortResults(res);
	    callback(err, err ? null : constructFilterSet(res, this.model));
	  },
	  clearOrdering: function() {
	    this.opts.order = null;
	  },
	  objectMatchesOrFilter: function(obj, orFilter) {
	    for (var idx in orFilter) {
	      if (orFilter.hasOwnProperty(idx)) {
	        var filter = orFilter[idx];
	        if (this.objectMatchesBaseFilter(obj, filter)) {
	          return true;
	        }
	      }
	    }
	    return false;
	  },
	  objectMatchesAndFilter: function(obj, andFilter) {
	    for (var idx in andFilter) {
	      if (andFilter.hasOwnProperty(idx)) {
	        var filter = andFilter[idx];
	        if (!this.objectMatchesBaseFilter(obj, filter)) {
	          return false;
	        }
	      }
	    }
	    return true;
	  },
	  splitMatches: function(obj, unprocessedField, value) {
	    var op = 'e';
	    var fields = unprocessedField.split('.');
	    var splt = fields[fields.length - 1].split('__');
	    if (splt.length == 2) {
	      var field = splt[0];
	      op = splt[1];
	    }
	    else {
	      field = splt[0];
	    }
	    fields[fields.length - 1] = field;
	    fields.slice(0, fields.length - 1).forEach(function(f) {
	      if (util.isArray(obj)) {
	        obj = util.pluck(obj, f);
	      }
	      else {
	        obj = obj[f];
	      }
	    });
	    // If we get to the point where we're about to index null or undefined we stop - obviously this object does
	    // not match the filter.
	    var notNullOrUndefined = obj != undefined;
	    if (notNullOrUndefined) {
	      if (util.isArray(obj)) {
	      }
	      else {
	        var val = obj[field];
	        var invalid = util.isArray(val) ? false : val === null || val === undefined;
	      }
	      var comparator = Filter.comparators[op],
	        opts = {object: obj, field: field, value: value, invalid: invalid};
	      if (!comparator) {
	        return 'No comparator registered for filter operation "' + op + '"';
	      }
	      return comparator(opts);
	    }
	    return false;
	  },
	  objectMatches: function(obj, unprocessedField, value, filter) {
	    if (unprocessedField == '$or') {
	      var $or = filter['$or'];
	      if (!util.isArray($or)) {
	        $or = Object.keys($or).map(function(k) {
	          var normalised = {};
	          normalised[k] = $or[k];
	          return normalised;
	        });
	      }
	      if (!this.objectMatchesOrFilter(obj, $or)) return false;
	    }
	    else if (unprocessedField == '$and') {
	      if (!this.objectMatchesAndFilter(obj, filter['$and'])) return false;
	    }
	    else {
	      var matches = this.splitMatches(obj, unprocessedField, value);
	      if (typeof matches != 'boolean') return matches;
	      if (!matches) return false;
	    }
	    return true;
	  },
	  objectMatchesBaseFilter: function(obj, filter) {
	    var fields = Object.keys(filter);
	    for (var i = 0; i < fields.length; i++) {
	      var unprocessedField = fields[i],
	        value = filter[unprocessedField];
	      var rt = this.objectMatches(obj, unprocessedField, value, filter);
	      if (typeof rt != 'boolean') return rt;
	      if (!rt) return false;
	    }
	    return true;
	  },
	  objectMatchesFilter: function(obj) {
	    return this.objectMatchesBaseFilter(obj, this.filter);
	  }
	});
	
	module.exports = Filter;


/***/ },
/* 16 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * @module relationships
	 */
	
	var RelationshipProxy = __webpack_require__(19),
	  util = __webpack_require__(1),
	  modelEvents = __webpack_require__(4),
	  wrapArrayForAttributes = modelEvents.wrapArray,
	  ArrayObserver = __webpack_require__(23).ArrayObserver,
	  ModelEventType = modelEvents.ModelEventType;
	
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
	  clearReverse: function(removed) {
	    var self = this;
	    removed.forEach(function(removedObject) {
	      var reverseProxy = self.reverseProxyForInstance(removedObject);
	      var idx = reverseProxy.related.indexOf(self.object);
	      reverseProxy.makeChangesToRelatedWithoutObservations(function() {
	        reverseProxy.splice(idx, 1);
	      });
	    });
	  },
	  setReverseOfAdded: function(added) {
	    var self = this;
	    added.forEach(function(addedObject) {
	      var reverseProxy = self.reverseProxyForInstance(addedObject);
	      reverseProxy.makeChangesToRelatedWithoutObservations(function() {
	        reverseProxy.splice(0, 0, self.object);
	      });
	    });
	  },
	  wrapArray: function(arr) {
	    var self = this;
	    wrapArrayForAttributes(arr, this.reverseName, this.object);
	    if (!arr.arrayObserver) {
	      arr.arrayObserver = new ArrayObserver(arr);
	      var observerFunction = function(splices) {
	        splices.forEach(function(splice) {
	          var added = splice.addedCount ? arr.slice(splice.index, splice.index + splice.addedCount) : [];
	          var removed = splice.removed;
	          self.clearReverse(removed);
	          self.setReverseOfAdded(added);
	          var model = self.getForwardModel();
	          model.context.broadcast({
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
	  get: function(cb) {
	    return util.promise(cb, function(cb) {
	      cb(null, this.related);
	    }.bind(this));
	  },
	  validate: function(obj) {
	    if (Object.prototype.toString.call(obj) != '[object Array]') {
	      return 'Cannot assign scalar to many to many';
	    }
	    return null;
	  },
	  set: function(obj, opts) {
	    this.checkInstalled();
	    var self = this;
	    if (obj) {
	      var errorMessage;
	      if (errorMessage = this.validate(obj)) {
	        return errorMessage;
	      }
	      else {
	        this.clearReverseRelated(opts);
	        self.setIdAndRelated(obj, opts);
	        this.wrapArray(obj);
	        self.setIdAndRelatedReverse(obj, opts);
	      }
	    }
	    else {
	      this.clearReverseRelated(opts);
	      self.setIdAndRelated(obj, opts);
	    }
	  },
	  install: function(obj) {
	    RelationshipProxy.prototype.install.call(this, obj);
	    this.wrapArray(this.related);
	    obj[('splice' + util.capitaliseFirstLetter(this.reverseName))] = this.splice.bind(this);
	  },
	  registerRemovalListener: function(obj) {
	    this.relatedCancelListeners[obj.localId] = obj.on('*', function(e) {
	
	    }.bind(this));
	  }
	});
	
	module.exports = ManyToManyProxy;


/***/ },
/* 17 */
/***/ function(module, exports, __webpack_require__) {

	var RelationshipProxy = __webpack_require__(19),
	  util = __webpack_require__(1),
	  modelEvents = __webpack_require__(4),
	  wrapArrayForAttributes = modelEvents.wrapArray,
	  ArrayObserver = __webpack_require__(23).ArrayObserver,
	  ModelEventType = modelEvents.ModelEventType;
	
	/**
	 * @class  [OneToManyProxy description]
	 * @constructor
	 * @param {[type]} opts
	 */
	function OneToManyProxy(opts) {
	  RelationshipProxy.call(this, opts);
	  if (this.isReverse) {
	    this.related = [];
	  }
	}
	
	OneToManyProxy.prototype = Object.create(RelationshipProxy.prototype);
	
	util.extend(OneToManyProxy.prototype, {
	  clearReverse: function(removed) {
	    var self = this;
	    removed.forEach(function(removedObject) {
	      var reverseProxy = self.reverseProxyForInstance(removedObject);
	      reverseProxy.setIdAndRelated(null);
	    });
	  },
	  setReverseOfAdded: function(added) {
	    var self = this;
	    added.forEach(function(added) {
	      var forwardProxy = self.reverseProxyForInstance(added);
	      forwardProxy.setIdAndRelated(self.object);
	    });
	  },
	  wrapArray: function(arr) {
	    var self = this;
	    wrapArrayForAttributes(arr, this.reverseName, this.object);
	    if (!arr.arrayObserver) {
	      arr.arrayObserver = new ArrayObserver(arr);
	      var observerFunction = function(splices) {
	        splices.forEach(function(splice) {
	          var added = splice.addedCount ? arr.slice(splice.index, splice.index + splice.addedCount) : [];
	          var removed = splice.removed;
	          self.clearReverse(removed);
	          self.setReverseOfAdded(added);
	          var model = self.getForwardModel();
	          model.context.broadcast({
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
	  get: function(cb) {
	    return util.promise(cb, function(cb) {
	      cb(null, this.related);
	    }.bind(this));
	  },
	  /**
	   * Validate the object that we're setting
	   * @param obj
	   * @returns {string|null} An error message or null
	   * @class OneToManyProxy
	   */
	  validate: function(obj) {
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
	  },
	  set: function(obj, opts) {
	    this.checkInstalled();
	    var self = this;
	    if (obj) {
	      var errorMessage;
	      if (errorMessage = this.validate(obj)) {
	        return errorMessage;
	      }
	      else {
	        this.clearReverseRelated(opts);
	        self.setIdAndRelated(obj, opts);
	        if (self.isReverse) {
	          this.wrapArray(self.related);
	        }
	        self.setIdAndRelatedReverse(obj, opts);
	      }
	    }
	    else {
	      this.clearReverseRelated(opts);
	      self.setIdAndRelated(obj, opts);
	    }
	  },
	  install: function(obj) {
	    RelationshipProxy.prototype.install.call(this, obj);
	
	    if (this.isReverse) {
	      obj[('splice' + util.capitaliseFirstLetter(this.reverseName))] = this.splice.bind(this);
	      this.wrapArray(this.related);
	    }
	
	  }
	});
	
	module.exports = OneToManyProxy;


/***/ },
/* 18 */
/***/ function(module, exports, __webpack_require__) {

	var RelationshipProxy = __webpack_require__(19),
	  util = __webpack_require__(1),
	  SiestaModel = __webpack_require__(9);
	
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
	  validate: function(obj) {
	    if (Object.prototype.toString.call(obj) == '[object Array]') {
	      return 'Cannot assign array to one to one relationship';
	    }
	    else if ((!obj instanceof SiestaModel)) {
	
	    }
	    return null;
	  },
	  set: function(obj, opts) {
	    this.checkInstalled();
	    if (obj) {
	      var errorMessage;
	      if (errorMessage = this.validate(obj)) {
	        return errorMessage;
	      }
	      else {
	        this.clearReverseRelated(opts);
	        this.setIdAndRelated(obj, opts);
	        this.setIdAndRelatedReverse(obj, opts);
	      }
	    }
	    else {
	      this.clearReverseRelated(opts);
	      this.setIdAndRelated(obj, opts);
	    }
	  },
	  get: function(cb) {
	    return util.promise(cb, function(cb) {
	      cb(null, this.related);
	    }.bind(this));
	  }
	});
	
	module.exports = OneToOneProxy;

/***/ },
/* 19 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * Base functionality for relationships.
	 * @module relationships
	 */
	var InternalSiestaError = __webpack_require__(8).InternalSiestaError,
	  util = __webpack_require__(1),
	  Query = __webpack_require__(15),
	  log = __webpack_require__(5),
	  modelEvents = __webpack_require__(4),
	  wrapArrayForAttributes = modelEvents.wrapArray,
	  ArrayObserver = __webpack_require__(23).ArrayObserver,
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
	      get: function() {
	        return !self.isReverse;
	      },
	      set: function(v) {
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
	  install: function(modelInstance) {
	    if (modelInstance) {
	      if (!this.object) {
	        this.object = modelInstance;
	        var self = this;
	        var name = this.getForwardName();
	
	        // If it's a subclass, a proxy will already exist. Therefore no need to install.
	        if (!modelInstance.__proxies[name]) {
	          Object.defineProperty(modelInstance, name, {
	            get: function() {
	              return self.related;
	            },
	            set: function(v) {
	              self.set(v);
	            },
	            configurable: true,
	            enumerable: true
	          });
	
	          modelInstance.__proxies[name] = this;
	          modelInstance._proxies.push(this);
	        }
	
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
	  set: function(obj, opts) {
	    throw new InternalSiestaError('Must subclass RelationshipProxy');
	  },
	  get: function(callback) {
	    throw new InternalSiestaError('Must subclass RelationshipProxy');
	  }
	});
	
	util.extend(RelationshipProxy.prototype, {
	  proxyForInstance: function(modelInstance, reverse) {
	    var name = reverse ? this.getReverseName() : this.getForwardName(),
	      model = reverse ? this.reverseModel : this.forwardModel;
	    var ret;
	    // This should never happen. Should g   et caught in the mapping operation?
	    if (util.isArray(modelInstance)) {
	      ret = modelInstance.map(function(o) {
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
	  reverseProxyForInstance: function(modelInstance) {
	    return this.proxyForInstance(modelInstance, true);
	  },
	  getReverseName: function() {
	    return this.isForward ? this.reverseName : this.forwardName;
	  },
	  getForwardName: function() {
	    return this.isForward ? this.forwardName : this.reverseName;
	  },
	  getForwardModel: function() {
	    return this.isForward ? this.forwardModel : this.reverseModel;
	  },
	  /**
	   * Configure _id and related with the new related object.
	   * @param obj
	   * @param {object} [opts]
	   * @param {boolean} [opts.disableNotifications]
	   * @returns {String|undefined} - Error message or undefined
	   */
	  setIdAndRelated: function(obj, opts) {
	    opts = opts || {};
	    if (!opts.disableevents) var oldValue = this._getOldValueForSetChangeEvent();
	    if (obj) {
	      if (util.isArray(obj)) {
	        this.related = obj;
	      } else {
	        this.related = obj;
	      }
	    }
	    else {
	      this.related = null;
	    }
	    if (!opts.disableevents) this.registerSetChange(obj, oldValue);
	  },
	  checkInstalled: function() {
	    if (!this.object) {
	      throw new InternalSiestaError('Proxy must be installed on an object before can use it.');
	    }
	  },
	  splicer: function(opts) {
	    opts = opts || {};
	    return function(idx, numRemove) {
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
	  clearReverseRelated: function(opts) {
	    opts = opts || {};
	    var self = this;
	    if (this.related) {
	      var reverseProxy = this.reverseProxyForInstance(this.related);
	      var reverseProxies = util.isArray(reverseProxy) ? reverseProxy : [reverseProxy];
	      reverseProxies.forEach(function(p) {
	        if (util.isArray(p.related)) {
	          var idx = p.related.indexOf(self.object);
	          p.makeChangesToRelatedWithoutObservations(function() {
	            p.splicer(opts)(idx, 1);
	          });
	        } else {
	          p.setIdAndRelated(null, opts);
	        }
	      });
	    }
	  },
	  setIdAndRelatedReverse: function(obj, opts) {
	    var self = this;
	    var reverseProxy = this.reverseProxyForInstance(obj);
	    var reverseProxies = util.isArray(reverseProxy) ? reverseProxy : [reverseProxy];
	    reverseProxies.forEach(function(p) {
	      if (util.isArray(p.related)) {
	        p.makeChangesToRelatedWithoutObservations(function() {
	          p.splicer(opts)(p.related.length, 0, self.object);
	        });
	      } else {
	        p.clearReverseRelated(opts);
	        p.setIdAndRelated(self.object, opts);
	      }
	    });
	  },
	  makeChangesToRelatedWithoutObservations: function(f) {
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
	  _getOldValueForSetChangeEvent: function() {
	    var oldValue = this.related;
	    if (util.isArray(oldValue) && !oldValue.length) {
	      oldValue = null;
	    }
	    return oldValue;g
	  },
	  registerSetChange: function(newValue, oldValue) {
	    var proxyObject = this.object;
	    if (!proxyObject) throw new InternalSiestaError('Proxy must have an object associated');
	    var model = proxyObject.model;
	    var modelName = model.name;
	    var collectionName = proxyObject.collectionName;
	    // We take [] == null == undefined in the case of relationships.
	    model.context.broadcast({
	      collection: collectionName,
	      model: modelName,
	      localId: proxyObject.localId,
	      field: this.getForwardName(),
	      old: oldValue,
	      new: newValue,
	      type: ModelEventType.Set,
	      obj: proxyObject
	    });
	  },
	
	  _getRemovedForSpliceChangeEvent: function(idx, numRemove) {
	    return this.related ? this.related.slice(idx, idx + numRemove) : null;
	  },
	
	  _getAddedForSpliceChangeEvent: function(args) {
	    var add = Array.prototype.slice.call(args, 2);
	    return add.length ? add : [];
	  },
	
	  registerSpliceChange: function(idx, added, removed) {
	    var model = this.object.model,
	      modelName = model.name,
	      coll = this.object.collectionName;
	    model.context.broadcast({
	      collection: coll,
	      model: modelName,
	      localId: this.object.localId,
	      field: this.getForwardName(),
	      index: idx,
	      removed: removed,
	      added: added,
	      type: ModelEventType.Splice,
	      obj: this.object
	    });
	  },
	  wrapArray: function(arr) {
	    var self = this;
	    wrapArrayForAttributes(arr, this.reverseName, this.object);
	    if (!arr.arrayObserver) {
	      arr.arrayObserver = new ArrayObserver(arr);
	      var observerFunction = function(splices) {
	        splices.forEach(function(splice) {
	          var added = splice.addedCount ? arr.slice(splice.index, splice.index + splice.addedCount) : [];
	          var model = self.getForwardModel();
	          model.context.broadcast({
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
	  splice: function() {
	    this.splicer({}).apply(this, arguments);
	  }
	
	});
	
	module.exports = RelationshipProxy;


/***/ },
/* 20 */
/***/ function(module, exports, __webpack_require__) {

	module.exports = {
	  OneToMany: 'OneToMany',
	  OneToOne: 'OneToOne',
	  ManyToMany: 'ManyToMany'
	};

/***/ },
/* 21 */
/***/ function(module, exports, __webpack_require__) {

	var util = __webpack_require__(1),
	  error = __webpack_require__(8),
	  log = __webpack_require__(5)('storage');
	
	// Variables beginning with underscore are treated as special by PouchDB/CouchDB so when serialising we need to
	// replace with something else.
	var UNDERSCORE = /_/g,
	  UNDERSCORE_REPLACEMENT = /@/g;
	
	/**
	 *
	 * @param context
	 * @constructor
	 * @param opts
	 */
	function Storage(context, opts) {
	  if (!window.PouchDB) throw new Error('Cannot enable storage for app "' + name + '" as PouchDB is not present.');
	
	  opts = opts || {};
	  var name = context.name;
	
	  this.context = context;
	  this.unsavedObjects = [];
	  this.unsavedObjectsHash = {};
	  this.unsavedObjectsByCollection = {};
	
	  Object.defineProperties(this, {
	    _unsavedObjects: {
	      get: function() {
	        return this.unsavedObjects
	      }
	    },
	    _unsavedObjectsHash: {
	      get: function() {
	        return this.unsavedObjectsHash
	      }
	    },
	    _unsavedObjectsByCollection: {
	      get: function() {
	        return this.unsavedObjectsByCollection
	      }
	    },
	    _pouch: {
	      get: function() {
	        return this.pouch
	      }
	    }
	  });
	
	  this.pouch = opts.pouch || (new PouchDB(name, {auto_compaction: true}));
	}
	
	Storage.prototype = {
	  /**
	   * Save all modelEvents down to PouchDB.
	   */
	  save: function(cb) {
	    return util.promise(cb, function(cb) {
	      this.context._ensureInstalled(function(err) {
	        if (!err) {
	          var instances = this.unsavedObjects;
	          this.unsavedObjects = [];
	          this.unsavedObjectsHash = {};
	          this.unsavedObjectsByCollection = {};
	          this.saveToPouch(instances, cb);
	        }
	        else {
	          cb(err);
	        }
	      }.bind(this));
	    }.bind(this));
	  },
	  saveToPouch: function(objects, cb) {
	    var conflicts = [];
	    var serialisedDocs = objects.map(this._serialise.bind(this));
	    this.pouch.bulkDocs(serialisedDocs).then(function(resp) {
	      for (var i = 0; i < resp.length; i++) {
	        var response = resp[i];
	        var obj = objects[i];
	        if (response.ok) {
	          obj._rev = response.rev;
	        }
	        else if (response.status == 409) {
	          conflicts.push(obj);
	        }
	        else {
	          log('Error saving object with localId="' + obj.localId + '"', response);
	        }
	      }
	      if (conflicts.length) {
	        this.saveConflicts(conflicts, cb);
	      }
	      else {
	        cb();
	      }
	    }, function(err) {
	      cb(err);
	    });
	  },
	  saveConflicts: function(objects, cb) {
	    this
	      .pouch
	      .allDocs({keys: util.pluck(objects, 'localId')})
	      .then(function(resp) {
	        for (var i = 0; i < resp.rows.length; i++) {
	          objects[i]._rev = resp.rows[i].value.rev;
	        }
	        this.saveToPouch(objects, cb);
	      })
	      .catch(function(err) {
	        cb(err);
	      })
	  },
	  /**
	   * Ensure that the PouchDB index for the given model exists, creating it if not.
	   * @param model
	   * @param cb
	   */
	  ensureIndexInstalled: function(model, cb) {
	    function fn(resp) {
	      var err;
	      if (!resp.ok) {
	        if (resp.status == 409) {
	          err = null;
	          model.indexInstalled = true;
	        }
	      }
	      cb(err);
	    }
	
	    this
	      .pouch
	      .put(this.constructIndexDesignDoc(model.collectionName, model.name))
	      .then(fn)
	      .catch(fn);
	  },
	  /**
	   *
	   * @param opts
	   * @param [opts.collectionName]
	   * @param [opts.modelName]
	   * @param [opts.model]
	   * @param cb
	   * @private
	   */
	  loadModel: function(opts, cb) {
	    var loaded = {};
	    var collectionName = opts.collectionName,
	      modelName = opts.modelName,
	      model = opts.model;
	    if (model) {
	      collectionName = model.collectionName;
	      modelName = model.name;
	    }
	
	    var fullyQualifiedName = this.fullyQualifiedModelName(collectionName, modelName);
	    var Model = this.context.collections[collectionName][modelName];
	
	    if (!Model) {
	      cb('No such model with name "' + modelName + '" in context.');
	      return;
	    }
	
	    this
	      .pouch
	      .query(fullyQualifiedName)
	      .then(function(resp) {
	        var rows = resp.rows;
	        var data = util.pluck(rows, 'value').map(function(datum) {
	          return this._prepareDatum(datum, Model);
	        }.bind(this));
	
	        data.map(function(datum) {
	          var remoteId = datum[Model.id];
	          if (remoteId) {
	            if (loaded[remoteId]) {
	              console.error('Duplicates detected in storage. You have encountered a serious bug. Please report this.');
	            }
	            else {
	              loaded[remoteId] = datum;
	            }
	          }
	        });
	
	        Model._graph(data, {
	          _ignoreInstalled: true,
	          disableevents: true,
	          fromStorage: true
	        }, function(err, instances) {
	          if (!err) {
	            console.log('binding listener');
	            this._listener = this.listener.bind(this);
	            model.on('*', this._listener);
	          }
	          else {
	            console.error('Error loading models', err);
	          }
	          cb(err, instances);
	        }.bind(this));
	      }.bind(this))
	      .catch(function(err) {
	        cb(err);
	      });
	
	  },
	  _prepareDatum: function(rawDatum, model) {
	    this._processMeta(rawDatum);
	    delete rawDatum.collection;
	    delete rawDatum.model;
	    rawDatum.localId = rawDatum._id;
	    delete rawDatum._id;
	    var datum = {};
	    Object.keys(rawDatum).forEach(function(k) {
	      datum[k.replace(UNDERSCORE_REPLACEMENT, '_')] = rawDatum[k];
	    });
	
	    var relationshipNames = model._relationshipNames;
	    relationshipNames.forEach(function(r) {
	      var localId = datum[r];
	      if (localId) {
	        if (siesta.isArray(localId)) {
	          datum[r] = localId.map(function(x) {
	            return {localId: x}
	          });
	        }
	        else {
	          datum[r] = {localId: localId};
	        }
	      }
	
	    });
	    return datum;
	  },
	  _processMeta: function(datum) {
	    var meta = datum.siesta_meta || this._initMeta();
	    meta.dateFields.forEach(function(dateField) {
	      var value = datum[dateField];
	      if (!(value instanceof Date)) {
	        datum[dateField] = new Date(value);
	      }
	    });
	    delete datum.siesta_meta;
	  },
	
	  _initMeta: function() {
	    return {dateFields: []};
	  },
	
	  /**
	   * Sometimes siesta needs to store some extra information about the model instance.
	   * @param serialised
	   */
	  _addMeta: function(serialised) {
	    serialised.siesta_meta = this._initMeta();
	    for (var prop in serialised) {
	      if (serialised.hasOwnProperty(prop)) {
	        if (serialised[prop] instanceof Date) {
	          serialised.siesta_meta.dateFields.push(prop);
	          serialised[prop] = serialised[prop].getTime();
	        }
	      }
	    }
	  },
	
	  listener: function(n) {
	    var changedObject = n.obj,
	      ident = changedObject.localId;
	    if (!changedObject) {
	      throw new Error('No obj field in notification received by storage extension');
	    }
	    if (!(ident in this.unsavedObjectsHash)) {
	      this.unsavedObjectsHash[ident] = changedObject;
	      this.unsavedObjects.push(changedObject);
	      var collectionName = changedObject.collectionName;
	      if (!this.unsavedObjectsByCollection[collectionName]) {
	        this.unsavedObjectsByCollection[collectionName] = {};
	      }
	      var modelName = changedObject.model.name;
	      if (!this.unsavedObjectsByCollection[collectionName][modelName]) {
	        this.unsavedObjectsByCollection[collectionName][modelName] = {};
	      }
	      this.unsavedObjectsByCollection[collectionName][modelName][ident] = changedObject;
	    }
	  },
	  _reset: function(cb, pdb) {
	    if (this._listener) this.context.removeListener('Siesta', this._listener);
	    this.unsavedObjects = [];
	    this.unsavedObjectsHash = {};
	
	    var pouch = this.pouch;
	    pouch
	      .allDocs()
	      .then(function(results) {
	        var docs = results.rows.map(function(r) {
	          return {_id: r.id, _rev: r.value.rev, _deleted: true};
	        });
	
	        this.pouch
	          .bulkDocs(docs)
	          .then(function() {
	            if (pdb) this.pouch = pdb;
	            cb();
	          }.bind(this))
	          .catch(cb);
	      }.bind(this))
	      .catch(cb);
	  },
	  /**
	   * Serialise a model into a format that PouchDB bulkDocs API can process
	   * @param {ModelInstance} modelInstance
	   */
	  _serialise: function(modelInstance) {
	    var serialised = {};
	    var __values = modelInstance.__values;
	    serialised = util.extend(serialised, __values);
	    Object.keys(serialised).forEach(function(k) {
	      serialised[k.replace(UNDERSCORE, '@')] = __values[k];
	    });
	    this._addMeta(serialised);
	    serialised['collection'] = modelInstance.collectionName;
	    serialised['model'] = modelInstance.modelName;
	    serialised['_id'] = modelInstance.localId;
	    if (modelInstance.removed) serialised['_deleted'] = true;
	    var rev = modelInstance._rev;
	    if (rev) serialised['_rev'] = rev;
	    serialised = modelInstance._relationshipNames.reduce(function(memo, n) {
	      var val = modelInstance[n];
	      if (siesta.isArray(val)) {
	        memo[n] = util.pluck(val, 'localId');
	      }
	      else if (val) {
	        memo[n] = val.localId;
	      }
	      return memo;
	    }, serialised);
	    return serialised;
	  },
	  constructIndexDesignDoc: function(collectionName, modelName) {
	    var fullyQualifiedName = this.fullyQualifiedModelName(collectionName, modelName);
	    var views = {};
	    views[fullyQualifiedName] = {
	      map: function(doc) {
	        if (doc.collection == '$1' && doc.model == '$2') emit(doc.collection + '.' + doc.model, doc);
	      }.toString().replace('$1', collectionName).replace('$2', modelName)
	    };
	    return {
	      _id: '_design/' + fullyQualifiedName,
	      views: views
	    };
	  },
	  fullyQualifiedModelName: function(collectionName, modelName) {
	    return collectionName + '.' + modelName;
	  }
	};
	
	module.exports = Storage;


/***/ },
/* 22 */
/***/ function(module, exports, __webpack_require__) {

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
	


/***/ },
/* 23 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global, module) {/*
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
	
	  var numberIsNaN = global.Number.isNaN || function(value) {
	    return typeof value === 'number' && global.isNaN(value);
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
	
	  var UNOPENED = 0;
	  var OPENED = 1;
	  var CLOSED = 2;
	
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
	
	  var observerSentinel = {};
	
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
	expose.ArrayObserver.calculateSplices = function(current, previous) {
	return arraySplice.calculateSplices(current, previous);
	};
	expose.Platform = global.Platform;
	expose.ArraySplice = ArraySplice;
	expose.ObjectObserver = ObjectObserver;
	})(typeof global !== 'undefined' && global && typeof module !== 'undefined' && module ? global : this || window);
	
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }()), __webpack_require__(35)(module)))

/***/ },
/* 24 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * A dead simple implementation of ES6 promise, that does not swallow errors.
	 * @param fn
	 * @constructor
	 */
	
	function Promise(fn) {
	  this.okCallbacks = [];
	  this.errorCallbacks = [];
	
	  this.resolved = null;
	  this.rejected = null;
	  this.isResolved = false;
	  this.isRejected = false;
	
	
	  var resolve = function(payload) {
	    if (!(this.resolved || this.rejected)) {
	      this.resolved = payload;
	      this.isResolved = true;
	      for (var i = 0; i < this.okCallbacks.length; i++) {
	        var cb = this.okCallbacks[i];
	        cb(payload);
	      }
	    }
	  }.bind(this);
	
	  var reject = function(err) {
	    if (!(this.resolved || this.rejected)) {
	      this.rejected = err;
	      this.isRejected = true;
	      for (var i = 0; i < this.errorCallbacks.length; i++) {
	        var cb = this.errorCallbacks[i];
	        cb(err);
	      }
	    }
	  }.bind(this);
	
	  if (fn) fn(resolve, reject);
	}
	
	Promise.all = function(promises) {
	  return new Promise(function(resolve, reject) {
	    var n = promises.length;
	    if (n) {
	      var numResolve = 0;
	      var numReject = 0;
	      var resolveValues = [];
	      var rejectValues = [];
	
	      promises.forEach(function(promise, idx) {
	        promise.then(function(payload) {
	          resolveValues[idx] = payload;
	          numResolve++;
	          check();
	        }, function(err) {
	          rejectValues[idx] = err;
	          numReject++;
	          check();
	        });
	      });
	
	      function check() {
	        if ((numResolve + numReject) == n) {
	          if (numReject) reject(rejectValues);
	          else resolve(resolveValues);
	        }
	      }
	    }
	    else resolve([]);
	  });
	};
	
	Promise.prototype = {
	  then: function(ok, err) {
	    if (this.isResolved) {
	      if (ok) {
	        ok(this.resolved);
	      }
	    }
	    else if (this.isRejected) {
	      if (err) {
	        err(this.rejected);
	      }
	    }
	    else {
	      if (ok) {
	        this.okCallbacks.push(ok);
	      }
	      if (err) {
	        this.errorCallbacks.push(err);
	      }
	    }
	    return this;
	  },
	  catch: function(err) {
	    if (this.isRejected) {
	      if (err) {
	        err(this.rejected);
	      }
	    }
	    else {
	      if (err) {
	        this.errorCallbacks.push(err);
	      }
	    }
	    return this;
	  }
	};
	
	module.exports = Promise;


/***/ },
/* 25 */
/***/ function(module, exports, __webpack_require__) {

	var argsarray = __webpack_require__(31);
	
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
	  _handlerLink: function(opts) {
	    var firstLink;
	    firstLink = function() {
	      var typ = opts.type;
	      if (opts.fn)
	        this._removeListener(opts.fn, typ);
	      if (firstLink._parentLink) firstLink._parentLink(); // Cancel listeners all the way up the chain.
	    }.bind(this);
	    Object.keys(this.opts).forEach(function(prop) {
	      var func = this.opts[prop];
	      firstLink[prop] = argsarray(function(args) {
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
	  _link: function(opts, clean) {
	    var chain = this;
	    clean = clean || function() {};
	    var link;
	    link = function() {
	      clean();
	      if (link._parentLink) link._parentLink(); // Cancel listeners all the way up the chain.
	    }.bind(this);
	    link.__siesta_isLink = true;
	    link.opts = opts;
	    link.clean = clean;
	    Object.keys(opts).forEach(function(prop) {
	      var func = opts[prop];
	      link[prop] = argsarray(function(args) {
	        var possibleLink = func.apply(func.__siesta_bound_object, args);
	        if (!possibleLink || !possibleLink.__siesta_isLink) { // Patch in a link in the chain to avoid it being broken, basing off the current link
	          nextLink = chain._link(link.opts);
	          for (var prop in possibleLink) {
	            //noinspection JSUnfilteredForInLoop
	            if (possibleLink[prop] instanceof Function) {
	              //noinspection JSUnfilteredForInLoop
	              nextLink[prop] = possibleLink[prop];
	            }
	          }
	        }
	        else {
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

	/**
	 * This is an in-memory cache for models. Models are cached by local id (_id) and remote id (defined by the mapping).
	 * Lookups are performed against the cache when mapping.
	 * @module cache
	 */
	var log = __webpack_require__(5)('cache'),
	  InternalSiestaError = __webpack_require__(8).InternalSiestaError,
	  util = __webpack_require__(1);
	
	
	function Cache() {
	  this.reset();
	  Object.defineProperty(this, '_localCacheByType', {
	    get: function() {
	      return this.local;
	    }
	  });
	}
	
	Cache.prototype = {
	  reset: function() {
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
	    if (util.isArray(localId)) return localId.map(function(x) {return this.localById[x]}.bind(this));
	    else return this.localById[localId];
	  },
	  /**
	   * Given a remote identifier and an options object that describes mapping/collection,
	   * return the model if cached.
	   * @param  {String|Array} remoteId
	   * @param  {Object} opts
	   * @param  {Object} opts.model
	   * @return {ModelInstance}
	   */
	  getViaRemoteId: function(remoteId, opts) {
	    var c = (this.remote[opts.model.collectionName] || {})[opts.model.name] || {};
	    return util.isArray(remoteId) ? remoteId.map(function(x) {return c[x]}) : c[remoteId];
	  },
	  /**
	   * Return the singleton object given a singleton model.
	   * @param  {Model} model
	   * @return {ModelInstance}
	   */
	  getSingleton: function(model) {
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
	          var errStr = 'A singleton model has more than 1 object in the cache! This is a serious error. ' +
	            'Either a model has been modified after objects have already been created, or something has gone' +
	            'very wrong. Please file a bug report if the latter.';
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
	  remoteInsert: function(obj, remoteId, previousRemoteId) {
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
	              var message = 'Object ' + collectionName.toString() + ':' + type.toString() + '[' + obj.model.id + '="' + remoteId + '"] already exists in the cache.' +
	                ' This is a serious error, please file a bug report if you are experiencing this out in the wild';
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
	  get: function(opts) {
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
	  _remoteCache: function() {
	    return this.remote
	  },
	  _localCache: function() {
	    return this.localById;
	  },
	  /**
	   * Insert an object into the cache.
	   * @param  {ModelInstance} obj
	   * @throws {InternalSiestaError} An object with _id/remoteId already exists. Not thrown if same obhect.
	   */
	  insert: function(obj) {
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
	          var message = 'Object with localId="' + localId.toString() + '" is already in the cache. ' +
	            'This is a serious error. Please file a bug report if you are experiencing this out in the wild';
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
	  contains: function(obj) {
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
	  remove: function(obj) {
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
	
	  count: function() {
	    return Object.keys(this.localById).length;
	  }
	};
	
	module.exports = Cache;


/***/ },
/* 27 */
/***/ function(module, exports, __webpack_require__) {

	
	/**
	 * This is the web browser implementation of `debug()`.
	 *
	 * Expose `debug()` as the module.
	 */
	
	exports = module.exports = __webpack_require__(34);
	exports.log = log;
	exports.formatArgs = formatArgs;
	exports.save = save;
	exports.load = load;
	exports.useColors = useColors;
	
	/**
	 * Use chrome.storage.local if we are in an app
	 */
	
	var storage;
	
	if (typeof chrome !== 'undefined' && typeof chrome.storage !== 'undefined')
	  storage = chrome.storage.local;
	else
	  storage = window.localStorage;
	
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
	      storage.removeItem('debug');
	    } else {
	      storage.debug = namespaces;
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
	    r = storage.debug;
	  } catch(e) {}
	  return r;
	}
	
	/**
	 * Enable namespaces listed in `localStorage.debug` initially.
	 */
	
	exports.enable(load());


/***/ },
/* 28 */
/***/ function(module, exports, __webpack_require__) {

	var util = __webpack_require__(1);
	
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
/* 29 */
/***/ function(module, exports, __webpack_require__) {

	var log = __webpack_require__(5)('model'),
	  InternalSiestaError = __webpack_require__(8).InternalSiestaError,
	  RelationshipType = __webpack_require__(20),
	  Query = __webpack_require__(15),
	  ModelInstance = __webpack_require__(9),
	  util = __webpack_require__(1),
	  guid = util.guid,
	  extend = __webpack_require__(22),
	  modelEvents = __webpack_require__(4),
	  wrapArray = modelEvents.wrapArray,
	  OneToManyProxy = __webpack_require__(17),
	  OneToOneProxy = __webpack_require__(18),
	  ManyToManyProxy = __webpack_require__(16),
	  ReactiveQuery = __webpack_require__(2),
	  ModelEventType = modelEvents.ModelEventType;
	
	function ModelInstanceFactory(model) {
	  this.model = model;
	}
	
	ModelInstanceFactory.prototype = {
	  _getLocalId: function(data) {
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
	
	  _installAttributes: function(modelInstance, data) {
	    var Model = this.model,
	      attributeNames = Model._attributeNames,
	      idx = attributeNames.indexOf(Model.id);
	    util.extend(modelInstance, {
	      __values: util.extend(Model.attributes.reduce(function(m, a) {
	        if (a.default !== undefined) m[a.name] = a.default;
	        return m;
	      }, {}), data || {})
	    });
	    if (idx > -1) attributeNames.splice(idx, 1);
	
	    attributeNames.forEach(function(attributeName) {
	      var attributeDefinition = Model._attributeDefinitionWithName(attributeName);
	      Object.defineProperty(modelInstance, attributeName, {
	        get: function() {
	          var value = modelInstance.__values[attributeName];
	          return value === undefined ? null : value;
	        },
	        set: function(v) {
	          if (attributeDefinition.parse) {
	            v = attributeDefinition.parse.call(modelInstance, v);
	          }
	          if (Model.parseAttribute) {
	            v = Model.parseAttribute.call(modelInstance, attributeName, v);
	          }
	          var old = modelInstance.__values[attributeName];
	          var propertyDependencies = this._propertyDependencies[attributeName] || [];
	          propertyDependencies = propertyDependencies.map(function(dependant) {
	            try {
	              var oldPropertyValue = this[dependant];
	            }
	            catch (e) {
	              console.error('Uncaught error during property access for model "' + modelInstance.model.name + '"', e);
	              throw e;
	            }
	            return {
	              prop: dependant,
	              old: oldPropertyValue
	            }
	          }.bind(this));
	
	          modelInstance.__values[attributeName] = v;
	          propertyDependencies.forEach(function(dep) {
	            var propertyName = dep.prop;
	            var new_ = this[propertyName];
	            Model.context.broadcast({
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
	          Model.context.broadcast(e);
	          if (util.isArray(v)) {
	            wrapArray(v, attributeName, modelInstance);
	          }
	        },
	        enumerable: true,
	        configurable: true
	      });
	    });
	  },
	  _installMethods: function(modelInstance) {
	    var Model = this.model;
	    Object.keys(Model.methods).forEach(function(methodName) {
	      if (modelInstance[methodName] === undefined) {
	        modelInstance[methodName] = Model.methods[methodName].bind(modelInstance);
	      }
	      else {
	        log('A method with name "' + methodName + '" already exists. Ignoring it.');
	      }
	    }.bind(this));
	  },
	  _installProperties: function(modelInstance) {
	    var _propertyNames = Object.keys(this.model.properties),
	      _propertyDependencies = {};
	    _propertyNames.forEach(function(propName) {
	      var propDef = this.model.properties[propName];
	      var dependencies = propDef.dependencies || [];
	      dependencies.forEach(function(attr) {
	        if (!_propertyDependencies[attr]) _propertyDependencies[attr] = [];
	        _propertyDependencies[attr].push(propName);
	      });
	      delete propDef.dependencies;
	      if (modelInstance[propName] === undefined) {
	        Object.defineProperty(modelInstance, propName, propDef);
	      }
	      else {
	        log('A property/method with name "' + propName + '" already exists. Ignoring it.');
	      }
	    }.bind(this));
	
	    modelInstance._propertyDependencies = _propertyDependencies;
	  },
	  _installRemoteId: function(modelInstance) {
	    var Model = this.model;
	    var cache = Model.context.cache;
	    var idField = Model.id;
	    Object.defineProperty(modelInstance, idField, {
	      get: function() {
	        return modelInstance.__values[Model.id] || null;
	      },
	      set: function(v) {
	        var old = modelInstance[Model.id];
	        modelInstance.__values[Model.id] = v;
	        Model.context.broadcast({
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
	  _installRelationship: function(definition, modelInstance) {
	    var proxy;
	    var type = definition.type;
	    if (type == RelationshipType.OneToMany) {
	      proxy = new OneToManyProxy(definition);
	    }
	    else if (type == RelationshipType.OneToOne) {
	      proxy = new OneToOneProxy(definition);
	    }
	    else if (type == RelationshipType.ManyToMany) {
	      proxy = new ManyToManyProxy(definition);
	    }
	    else {
	      throw new InternalSiestaError('No such relationship type: ' + type);
	    }
	    proxy.install(modelInstance);
	  },
	  _installRelationshipProxies: function(modelInstance) {
	    var model = this.model;
	    for (var name in model.relationships) {
	      if (model.relationships.hasOwnProperty(name)) {
	        var definition = util.extend({}, model.relationships[name]);
	        this._installRelationship(definition, modelInstance);
	      }
	    }
	  },
	  _registerInstance: function(modelInstance, shouldRegisterChange) {
	    var cache = this.model.context.cache;
	    cache.insert(modelInstance);
	    shouldRegisterChange = shouldRegisterChange === undefined ? true : shouldRegisterChange;
	    if (shouldRegisterChange) modelInstance._emitNew();
	  },
	  _installLocalId: function(modelInstance, data) {
	    modelInstance.localId = this._getLocalId(data);
	  },
	  /**
	   * Convert raw data into a ModelInstance
	   * @returns {ModelInstance}
	   */
	  _instance: function(data, shouldRegisterChange) {
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
/* 30 */
/***/ function(module, exports, __webpack_require__) {

	var util = __webpack_require__(1),
	  Promise = __webpack_require__(24),
	  argsarray = __webpack_require__(31);
	
	function Condition(fn, lazy) {
	  if (lazy === undefined || lazy === null) {
	    this.lazy = true;
	  }
	  this._fn = fn || function(done) {
	    done();
	  };
	  this.reset();
	}
	
	Condition.all = argsarray(function(args) {
	  return new Condition(args);
	});
	
	Condition.prototype = {
	  _execute: function() {
	    if (!this.executed) {
	      var dependents = util.pluck(this.dependent, '_promise');
	      Promise
	        .all(dependents)
	        .then(this.fn)
	        .catch(this.reject.bind(this));
	      this.dependent.forEach(function(d) {
	        d._execute();
	      });
	    }
	  },
	  then: function(success, fail) {
	    this._execute();
	    this._promise.then(success, fail);
	    return this;
	  },
	  catch: function(fail) {
	    this._execute();
	    this._promise.catch(fail);
	    return this;
	  },
	  resolve: function(res) {
	    this.executed = true;
	    this._promise.resolve(res);
	  },
	  reject: function(err) {
	    this.executed = true;
	    this._promise.reject(err);
	  },
	  dependentOn: function(cond) {
	    this.dependent.push(cond);
	  },
	  reset: function() {
	    this._promise = new Promise(function(resolve, reject) {
	      this.reject = reject;
	      this.resolve = resolve;
	      this.fn = function() {
	        this.executed = true;
	        var numComplete = 0;
	        var results = [];
	        var errors = [];
	        if (util.isArray(this._fn)) {
	          var checkComplete = function() {
	            if (numComplete == this._fn.length) {
	              if (errors.length) {
	                reject(errors);
	              }
	              else {
	                resolve(results);
	              }
	            }
	          }.bind(this);
	          this
	            ._fn
	            .forEach(function(cond, idx) {
	              cond
	                .then(function(res) {
	                  results[idx] = res;
	                  numComplete++;
	                  checkComplete();
	                }.bind(this))
	                .catch(function(err) {
	                  errors[idx] = err;
	                  numComplete++;
	                  checkComplete();
	                }.bind(this));
	            });
	        }
	        else {
	          this._fn(function(err, res) {
	            if (err) reject(err);
	            else resolve(res);
	          }.bind(this))
	        }
	      }.bind(this)
	    }.bind(this));
	
	    if (!this.lazy) this._execute();
	    this.executed = false;
	    this.dependent = [];
	  }
	};
	
	module.exports = Condition;


/***/ },
/* 31 */
/***/ function(module, exports, __webpack_require__) {

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
/* 32 */
/***/ function(module, exports, __webpack_require__) {

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
/* 33 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(setImmediate, clearImmediate) {var nextTick = __webpack_require__(36).nextTick;
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
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(33).setImmediate, __webpack_require__(33).clearImmediate))

/***/ },
/* 34 */
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
	exports.humanize = __webpack_require__(37);
	
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
/* 35 */
/***/ function(module, exports, __webpack_require__) {

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
/* 36 */
/***/ function(module, exports, __webpack_require__) {

	// shim for using process in browser
	
	var process = module.exports = {};
	var queue = [];
	var draining = false;
	
	function drainQueue() {
	    if (draining) {
	        return;
	    }
	    draining = true;
	    var currentQueue;
	    var len = queue.length;
	    while(len) {
	        currentQueue = queue;
	        queue = [];
	        var i = -1;
	        while (++i < len) {
	            currentQueue[i]();
	        }
	        len = queue.length;
	    }
	    draining = false;
	}
	process.nextTick = function (fun) {
	    queue.push(fun);
	    if (!draining) {
	        setTimeout(drainQueue, 0);
	    }
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
	
	// TODO(shtylman)
	process.cwd = function () { return '/' };
	process.chdir = function (dir) {
	    throw new Error('process.chdir is not supported');
	};
	process.umask = function() { return 0; };


/***/ },
/* 37 */
/***/ function(module, exports, __webpack_require__) {

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
	  var match = /^((?:\d+)?\.?\d+) *(ms|seconds?|s|minutes?|m|hours?|h|days?|d|years?|y)?$/i.exec(str);
	  if (!match) return;
	  var n = parseFloat(match[1]);
	  var type = (match[2] || 'ms').toLowerCase();
	  switch (type) {
	    case 'years':
	    case 'year':
	    case 'y':
	      return n * y;
	    case 'days':
	    case 'day':
	    case 'd':
	      return n * d;
	    case 'hours':
	    case 'hour':
	    case 'h':
	      return n * h;
	    case 'minutes':
	    case 'minute':
	    case 'm':
	      return n * m;
	    case 'seconds':
	    case 'second':
	    case 's':
	      return n * s;
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


/***/ }
/******/ ]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vd2VicGFjay9ib290c3RyYXAgOTE5YTk0MTZkOTY5YzQ3MTA3YjQiLCJ3ZWJwYWNrOi8vLy4vY29yZS9pbmRleC5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL3V0aWwuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9SZWFjdGl2ZUZpbHRlci5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL0NvbnRleHQuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9tb2RlbEV2ZW50cy5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL2xvZy5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL0NvbmRpdGlvbi5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL21vZGVsLmpzIiwid2VicGFjazovLy8uL2NvcmUvZXJyb3IuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9Nb2RlbEluc3RhbmNlLmpzIiwid2VicGFjazovLy8uL2NvcmUvbWFwcGluZ09wZXJhdGlvbi5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL2V2ZW50cy5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL1Byb3h5RXZlbnRFbWl0dGVyLmpzIiwid2VicGFjazovLy8uL2NvcmUvY29sbGVjdGlvbi5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL0ZpbHRlclNldC5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL0ZpbHRlci5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL01hbnlUb01hbnlQcm94eS5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL09uZVRvTWFueVByb3h5LmpzIiwid2VicGFjazovLy8uL2NvcmUvT25lVG9PbmVQcm94eS5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL1JlbGF0aW9uc2hpcFByb3h5LmpzIiwid2VicGFjazovLy8uL2NvcmUvUmVsYXRpb25zaGlwVHlwZS5qcyIsIndlYnBhY2s6Ly8vLi9zdG9yYWdlL2luZGV4LmpzIiwid2VicGFjazovLy8uL34vZXh0ZW5kL2luZGV4LmpzIiwid2VicGFjazovLy8uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlLmpzIiwid2VicGFjazovLy8uL2NvcmUvUHJvbWlzZS5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL0NoYWluLmpzIiwid2VicGFjazovLy8uL2NvcmUvY2FjaGUuanMiLCJ3ZWJwYWNrOi8vLy4vfi9kZWJ1Zy9icm93c2VyLmpzIiwid2VicGFjazovLy8uL2NvcmUvUGxhY2Vob2xkZXIuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9pbnN0YW5jZUZhY3RvcnkuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9jb25kaXRpb24uanMiLCJ3ZWJwYWNrOi8vLy4vfi9hcmdzYXJyYXkvaW5kZXguanMiLCJ3ZWJwYWNrOi8vLyh3ZWJwYWNrKS9+L25vZGUtbGlicy1icm93c2VyL34vZXZlbnRzL2V2ZW50cy5qcyIsIndlYnBhY2s6Ly8vKHdlYnBhY2spL34vbm9kZS1saWJzLWJyb3dzZXIvfi90aW1lcnMtYnJvd3NlcmlmeS9tYWluLmpzIiwid2VicGFjazovLy8uL34vZGVidWcvZGVidWcuanMiLCJ3ZWJwYWNrOi8vLyh3ZWJwYWNrKS9idWlsZGluL21vZHVsZS5qcyIsIndlYnBhY2s6Ly8vKHdlYnBhY2spL34vbm9kZS1saWJzLWJyb3dzZXIvfi9wcm9jZXNzL2Jyb3dzZXIuanMiLCJ3ZWJwYWNrOi8vLy4vfi9kZWJ1Zy9+L21zL2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSx1QkFBZTtBQUNmO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOzs7QUFHQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBLHdDOzs7Ozs7O0FDdENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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O0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsVUFBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQU87QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1A7QUFDQTtBQUNBO0FBQ0E7QUFDQSxZQUFXO0FBQ1g7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1AsSUFBRztBQUNIO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0EsRUFBQzs7QUFFRDs7Ozs7OztBQ3hRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNB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Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsY0FBYTtBQUNiLFlBQVc7QUFDWDtBQUNBLFFBQU87QUFDUDtBQUNBO0FBQ0EsRUFBQzs7Ozs7OztBQ3ZIRDtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0EsRzs7Ozs7O0FDbkJBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLEVBQUM7O0FBRUQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1A7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsWUFBVztBQUNYO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNB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QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsY0FBYTtBQUNiO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQO0FBQ0E7QUFDQSxRQUFPO0FBQ1AsTUFBSztBQUNMO0FBQ0E7QUFDQTtBQUNBLEVBQUM7QUFDRDs7QUFFQTs7Ozs7OztBQzdZQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUFHQTtBQUNBO0FBQ0E7OztBQUdBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7Ozs7Ozs7QUMxQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FBR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDs7QUFFQTtBQUNBOztBQUVBLGlFQUFnRTtBQUNoRTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTCxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQU87QUFDUDtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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QTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQSw0Q0FBMkMsU0FBUztBQUNwRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7Ozs7OztBQ3ZKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSxZQUFXLE1BQU07QUFDakIsWUFBVyxPQUFPO0FBQ2xCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxFQUFDOztBQUVEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0wsSUFBRztBQUNIO0FBQ0Esd0JBQXVCO0FBQ3ZCLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esb0JBQW1CLG1CQUFtQjtBQUN0QztBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsaUJBQWdCO0FBQ2hCLFFBQU87QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSyxnQkFBZ0I7QUFDckIsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG9CQUFtQixpQkFBaUI7QUFDcEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsaUJBQWdCO0FBQ2hCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsVUFBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0Esb0JBQW1CLG1CQUFtQjtBQUN0QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQSxFQUFDOztBQUVEOzs7Ozs7O0FDbFNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLFlBQVcsT0FBTztBQUNsQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsWUFBVztBQUNYO0FBQ0EsUUFBTztBQUNQO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQU87QUFDUCxNQUFLO0FBQ0wsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQU87QUFDUCxNQUFLO0FBQ0wsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsWUFBVztBQUNYLFVBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNI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O0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVM7O0FBRVQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFTOztBQUVUO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsVUFBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVM7QUFDVCxRQUFPO0FBQ1A7QUFDQTtBQUNBLFFBQU87O0FBRVAsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7O0FBRUw7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EscUJBQW9CO0FBQ3BCLFlBQVc7QUFDWDtBQUNBO0FBQ0EsdUJBQXNCO0FBQ3RCO0FBQ0E7O0FBRUEsTUFBSztBQUNMO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0EsSUFBRzs7QUFFSDtBQUNBLGFBQVk7QUFDWixJQUFHOztBQUVIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHOztBQUVIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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OztBQUVBO0FBQ0EsTUFBSzs7QUFFTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLFlBQVc7QUFDWDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsVUFBUztBQUNUO0FBQ0E7QUFDQTtBQUNBLFVBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSxNQUFLOztBQUVMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBLFFBQU87QUFDUDs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxzQkFBcUIsZ0JBQWdCO0FBQ3JDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFLOztBQUVMO0FBQ0Esc0JBQXFCLGtCQUFrQjtBQUN2QztBQUNBO0FBQ0E7QUFDQSxNQUFLOztBQUVMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBLE1BQUs7O0FBRUw7QUFDQTtBQUNBO0FBQ0EsTUFBSzs7QUFFTDtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSw4QkFBNkI7QUFDN0I7QUFDQSw4QkFBNkI7QUFDN0IsTUFBSztBQUNMO0FBQ0E7QUFDQSw4QkFBNkI7QUFDN0I7QUFDQSw4QkFBNkI7QUFDN0I7QUFDQTs7QUFFQTs7QUFFQTs7QUFFQTtBQUNBOztBQUVBLG9CQUFtQixvQkFBb0I7QUFDdkM7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsVUFBUztBQUNUOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1A7O0FBRUE7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBLG9CQUFtQiwwQkFBMEI7QUFDN0M7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsTUFBSzs7QUFFTDtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHNEQUFxRDtBQUNyRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsRUFBQzs7Ozs7Ozs7QUM1bkNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtB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QTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHOztBQUVIO0FBQ0E7QUFDQTtBQUNBOztBQUVBOzs7Ozs7OztBQ3JRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7OztBQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRzs7QUFFSDtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLFlBQVcsT0FBTztBQUNsQjtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsYUFBWSxPQUFPO0FBQ25CO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7Ozs7Ozs7QUM3SkE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsK0JBQThCO0FBQzlC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QTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLElBQUc7QUFDSCxxQkFBb0IsU0FBUztBQUM3QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0w7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7Ozs7Ozs7QUM1U0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLDRDQUEyQyxpQkFBaUI7O0FBRTVEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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QTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsWUFBVyxPQUFPO0FBQ2xCLGFBQVk7QUFDWjtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLFlBQVcsT0FBTztBQUNsQixhQUFZO0FBQ1o7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXNDb250ZW50IjpbIiBcdC8vIFRoZSBtb2R1bGUgY2FjaGVcbiBcdHZhciBpbnN0YWxsZWRNb2R1bGVzID0ge307XG5cbiBcdC8vIFRoZSByZXF1aXJlIGZ1bmN0aW9uXG4gXHRmdW5jdGlvbiBfX3dlYnBhY2tfcmVxdWlyZV9fKG1vZHVsZUlkKSB7XG5cbiBcdFx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG4gXHRcdGlmKGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdKVxuIFx0XHRcdHJldHVybiBpbnN0YWxsZWRNb2R1bGVzW21vZHVsZUlkXS5leHBvcnRzO1xuXG4gXHRcdC8vIENyZWF0ZSBhIG5ldyBtb2R1bGUgKGFuZCBwdXQgaXQgaW50byB0aGUgY2FjaGUpXG4gXHRcdHZhciBtb2R1bGUgPSBpbnN0YWxsZWRNb2R1bGVzW21vZHVsZUlkXSA9IHtcbiBcdFx0XHRleHBvcnRzOiB7fSxcbiBcdFx0XHRpZDogbW9kdWxlSWQsXG4gXHRcdFx0bG9hZGVkOiBmYWxzZVxuIFx0XHR9O1xuXG4gXHRcdC8vIEV4ZWN1dGUgdGhlIG1vZHVsZSBmdW5jdGlvblxuIFx0XHRtb2R1bGVzW21vZHVsZUlkXS5jYWxsKG1vZHVsZS5leHBvcnRzLCBtb2R1bGUsIG1vZHVsZS5leHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKTtcblxuIFx0XHQvLyBGbGFnIHRoZSBtb2R1bGUgYXMgbG9hZGVkXG4gXHRcdG1vZHVsZS5sb2FkZWQgPSB0cnVlO1xuXG4gXHRcdC8vIFJldHVybiB0aGUgZXhwb3J0cyBvZiB0aGUgbW9kdWxlXG4gXHRcdHJldHVybiBtb2R1bGUuZXhwb3J0cztcbiBcdH1cblxuXG4gXHQvLyBleHBvc2UgdGhlIG1vZHVsZXMgb2JqZWN0IChfX3dlYnBhY2tfbW9kdWxlc19fKVxuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5tID0gbW9kdWxlcztcblxuIFx0Ly8gZXhwb3NlIHRoZSBtb2R1bGUgY2FjaGVcbiBcdF9fd2VicGFja19yZXF1aXJlX18uYyA9IGluc3RhbGxlZE1vZHVsZXM7XG5cbiBcdC8vIF9fd2VicGFja19wdWJsaWNfcGF0aF9fXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLnAgPSBcIlwiO1xuXG4gXHQvLyBMb2FkIGVudHJ5IG1vZHVsZSBhbmQgcmV0dXJuIGV4cG9ydHNcbiBcdHJldHVybiBfX3dlYnBhY2tfcmVxdWlyZV9fKDApO1xuXG5cbi8qKiBXRUJQQUNLIEZPT1RFUiAqKlxuICoqIHdlYnBhY2svYm9vdHN0cmFwIDkxOWE5NDE2ZDk2OWM0NzEwN2I0XG4gKiovIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgUmVhY3RpdmVGaWx0ZXIgPSByZXF1aXJlKCcuL1JlYWN0aXZlRmlsdGVyJyksXG4gIENvbnRleHQgPSByZXF1aXJlKCcuL0NvbnRleHQnKSxcbiAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gIGxvZyA9IHJlcXVpcmUoJy4vbG9nJyk7XG5cbnV0aWwuX3BhdGNoQmluZCgpO1xuXG52YXIgc2llc3RhID0ge1xuICBjcmVhdGVBcHA6IGZ1bmN0aW9uKG5hbWUsIG9wdHMpIHtcbiAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICBvcHRzLm5hbWUgPSBuYW1lO1xuICAgIHJldHVybiBuZXcgQ29udGV4dChvcHRzKTtcbiAgfSxcbiAgbG9nOiByZXF1aXJlKCdkZWJ1ZycpLFxuICBsaWI6IHtcbiAgICBsb2c6IGxvZyxcbiAgICBDb25kaXRpb246IHJlcXVpcmUoJy4vQ29uZGl0aW9uJyksXG4gICAgTW9kZWw6IHJlcXVpcmUoJy4vbW9kZWwnKSxcbiAgICBlcnJvcjogcmVxdWlyZSgnLi9lcnJvcicpLFxuICAgIE1vZGVsRXZlbnRUeXBlOiBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZSxcbiAgICBNb2RlbEluc3RhbmNlOiByZXF1aXJlKCcuL01vZGVsSW5zdGFuY2UnKSxcbiAgICBleHRlbmQ6IHJlcXVpcmUoJ2V4dGVuZCcpLFxuICAgIE1hcHBpbmdPcGVyYXRpb246IHJlcXVpcmUoJy4vbWFwcGluZ09wZXJhdGlvbicpLFxuICAgIGV2ZW50czogcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgICBQcm94eUV2ZW50RW1pdHRlcjogcmVxdWlyZSgnLi9Qcm94eUV2ZW50RW1pdHRlcicpLFxuICAgIG1vZGVsRXZlbnRzOiBtb2RlbEV2ZW50cyxcbiAgICBDb2xsZWN0aW9uOiByZXF1aXJlKCcuL2NvbGxlY3Rpb24nKSxcbiAgICBSZWFjdGl2ZUZpbHRlcjogUmVhY3RpdmVGaWx0ZXIsXG4gICAgdXRpbHM6IHV0aWwsXG4gICAgdXRpbDogdXRpbCxcbiAgICBmaWx0ZXJTZXQ6IHJlcXVpcmUoJy4vRmlsdGVyU2V0JyksXG4gICAgb2JzZXJ2ZTogcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKSxcbiAgICBGaWx0ZXI6IHJlcXVpcmUoJy4vRmlsdGVyJyksXG4gICAgTWFueVRvTWFueVByb3h5OiByZXF1aXJlKCcuL01hbnlUb01hbnlQcm94eScpLFxuICAgIE9uZVRvTWFueVByb3h5OiAgcmVxdWlyZSgnLi9PbmVUb01hbnlQcm94eScpLFxuICAgIE9uZVRvT25lUHJveHk6IHJlcXVpcmUoJy4vT25lVG9PbmVQcm94eScpLFxuICAgIFJlbGF0aW9uc2hpcFByb3h5OiByZXF1aXJlKCcuL1JlbGF0aW9uc2hpcFByb3h5JyksXG4gICAgU3RvcmFnZTogcmVxdWlyZSgnLi4vc3RvcmFnZScpLFxuICAgIENvbnRleHQ6IENvbnRleHRcbiAgfSxcbiAgY29uc3RhbnRzOiB7XG4gICAgRGVsZXRpb246IHtcbiAgICAgIENhc2NhZGU6ICdjYXNjYWRlJyxcbiAgICAgIE51bGxpZnk6ICdudWxsaWZ5J1xuICAgIH1cbiAgfSxcbiAgaXNBcnJheTogdXRpbC5pc0FycmF5LFxuICBpc1N0cmluZzogdXRpbC5pc1N0cmluZyxcbiAgUmVsYXRpb25zaGlwVHlwZTogcmVxdWlyZSgnLi9SZWxhdGlvbnNoaXBUeXBlJyksXG4gIE1vZGVsRXZlbnRUeXBlOiBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZSxcbiAgSW5zZXJ0aW9uUG9saWN5OiBSZWFjdGl2ZUZpbHRlci5JbnNlcnRpb25Qb2xpY3lcbn07XG5cblxuaWYgKHR5cGVvZiB3aW5kb3cgIT0gJ3VuZGVmaW5lZCcpIHdpbmRvd1snc2llc3RhJ10gPSBzaWVzdGE7XG5cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vY29yZS9pbmRleC5qc1xuICoqIG1vZHVsZSBpZCA9IDBcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsInZhciBvYnNlcnZlID0gcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKS5QbGF0Zm9ybSxcbiAgUHJvbWlzZSA9IHJlcXVpcmUoJy4vUHJvbWlzZScpLFxuICBhcmdzYXJyYXkgPSByZXF1aXJlKCdhcmdzYXJyYXknKSxcbiAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yO1xuXG52YXIgZXh0ZW5kID0gZnVuY3Rpb24obGVmdCwgcmlnaHQpIHtcbiAgZm9yICh2YXIgcHJvcCBpbiByaWdodCkge1xuICAgIGlmIChyaWdodC5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgbGVmdFtwcm9wXSA9IHJpZ2h0W3Byb3BdO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbGVmdDtcbn07XG5cbnZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSxcbiAgaXNTdHJpbmcgPSBmdW5jdGlvbihvKSB7XG4gICAgcmV0dXJuIHR5cGVvZiBvID09ICdzdHJpbmcnIHx8IG8gaW5zdGFuY2VvZiBTdHJpbmdcbiAgfTtcblxuZXh0ZW5kKG1vZHVsZS5leHBvcnRzLCB7XG4gIGFyZ3NhcnJheTogYXJnc2FycmF5LFxuICAvKipcbiAgICogUGVyZm9ybXMgZGlydHkgY2hlY2svT2JqZWN0Lm9ic2VydmUgY2FsbGJhY2tzIGRlcGVuZGluZyBvbiB0aGUgYnJvd3Nlci5cbiAgICpcbiAgICogSWYgT2JqZWN0Lm9ic2VydmUgaXMgcHJlc2VudCxcbiAgICogQHBhcmFtIGNhbGxiYWNrXG4gICAqL1xuICBuZXh0OiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgIG9ic2VydmUucGVyZm9ybU1pY3JvdGFza0NoZWNrcG9pbnQoKTtcbiAgICBzZXRUaW1lb3V0KGNhbGxiYWNrKTtcbiAgfSxcbiAgZXh0ZW5kOiBleHRlbmQsXG4gIGd1aWQ6IChmdW5jdGlvbigpIHtcbiAgICBmdW5jdGlvbiBzNCgpIHtcbiAgICAgIHJldHVybiBNYXRoLmZsb29yKCgxICsgTWF0aC5yYW5kb20oKSkgKiAweDEwMDAwKVxuICAgICAgICAudG9TdHJpbmcoMTYpXG4gICAgICAgIC5zdWJzdHJpbmcoMSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHM0KCkgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArIHM0KCkgKyAnLScgK1xuICAgICAgICBzNCgpICsgJy0nICsgczQoKSArIHM0KCkgKyBzNCgpO1xuICAgIH07XG4gIH0pKCksXG4gIGFzc2VydDogZnVuY3Rpb24oY29uZGl0aW9uLCBtZXNzYWdlLCBjb250ZXh0KSB7XG4gICAgaWYgKCFjb25kaXRpb24pIHtcbiAgICAgIG1lc3NhZ2UgPSBtZXNzYWdlIHx8IFwiQXNzZXJ0aW9uIGZhaWxlZFwiO1xuICAgICAgY29udGV4dCA9IGNvbnRleHQgfHwge307XG4gICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihtZXNzYWdlLCBjb250ZXh0KTtcbiAgICB9XG4gIH0sXG4gIHBsdWNrOiBmdW5jdGlvbihjb2xsLCBrZXkpIHtcbiAgICByZXR1cm4gY29sbC5tYXAoZnVuY3Rpb24obykge3JldHVybiBvW2tleV19KTtcbiAgfSxcbiAgdGhlbkJ5OiAoZnVuY3Rpb24oKSB7XG4gICAgLyogbWl4aW4gZm9yIHRoZSBgdGhlbkJ5YCBwcm9wZXJ0eSAqL1xuICAgIGZ1bmN0aW9uIGV4dGVuZChmKSB7XG4gICAgICBmLnRoZW5CeSA9IHRiO1xuICAgICAgcmV0dXJuIGY7XG4gICAgfVxuXG4gICAgLyogYWRkcyBhIHNlY29uZGFyeSBjb21wYXJlIGZ1bmN0aW9uIHRvIHRoZSB0YXJnZXQgZnVuY3Rpb24gKGB0aGlzYCBjb250ZXh0KVxuICAgICB3aGljaCBpcyBhcHBsaWVkIGluIGNhc2UgdGhlIGZpcnN0IG9uZSByZXR1cm5zIDAgKGVxdWFsKVxuICAgICByZXR1cm5zIGEgbmV3IGNvbXBhcmUgZnVuY3Rpb24sIHdoaWNoIGhhcyBhIGB0aGVuQnlgIG1ldGhvZCBhcyB3ZWxsICovXG4gICAgZnVuY3Rpb24gdGIoeSkge1xuICAgICAgdmFyIHggPSB0aGlzO1xuICAgICAgcmV0dXJuIGV4dGVuZChmdW5jdGlvbihhLCBiKSB7XG4gICAgICAgIHJldHVybiB4KGEsIGIpIHx8IHkoYSwgYik7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gZXh0ZW5kO1xuICB9KSgpLFxuICAvKipcbiAgICogVE9ETzogVGhpcyBpcyBibG9vZHkgdWdseS5cbiAgICogUHJldHR5IGRhbW4gdXNlZnVsIHRvIGJlIGFibGUgdG8gYWNjZXNzIHRoZSBib3VuZCBvYmplY3Qgb24gYSBmdW5jdGlvbiB0aG8uXG4gICAqIFNlZTogaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8xNDMwNzI2NC93aGF0LW9iamVjdC1qYXZhc2NyaXB0LWZ1bmN0aW9uLWlzLWJvdW5kLXRvLXdoYXQtaXMtaXRzLXRoaXNcbiAgICovXG4gIF9wYXRjaEJpbmQ6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBfYmluZCA9IEZ1bmN0aW9uLnByb3RvdHlwZS5hcHBseS5iaW5kKEZ1bmN0aW9uLnByb3RvdHlwZS5iaW5kKTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoRnVuY3Rpb24ucHJvdG90eXBlLCAnYmluZCcsIHtcbiAgICAgIHZhbHVlOiBmdW5jdGlvbihvYmopIHtcbiAgICAgICAgdmFyIGJvdW5kRnVuY3Rpb24gPSBfYmluZCh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoYm91bmRGdW5jdGlvbiwgJ19fc2llc3RhX2JvdW5kX29iamVjdCcsIHtcbiAgICAgICAgICB2YWx1ZTogb2JqLFxuICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGJvdW5kRnVuY3Rpb247XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG4gIFByb21pc2U6IFByb21pc2UsXG4gIHByb21pc2U6IGZ1bmN0aW9uKGNiLCBmbikge1xuICAgIGNiID0gY2IgfHwgZnVuY3Rpb24oKSB7fTtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICB2YXIgX2NiID0gYXJnc2FycmF5KGZ1bmN0aW9uKGFyZ3MpIHtcbiAgICAgICAgdmFyIGVyciA9IGFyZ3NbMF0sXG4gICAgICAgICAgcmVzdCA9IGFyZ3Muc2xpY2UoMSk7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICByZXNvbHZlKHJlc3RbMF0pO1xuICAgICAgICB9XG4gICAgICAgIHZhciBib3VuZCA9IGNiWydfX3NpZXN0YV9ib3VuZF9vYmplY3QnXSB8fCBjYjsgLy8gUHJlc2VydmUgYm91bmQgb2JqZWN0LlxuICAgICAgICBjYi5hcHBseShib3VuZCwgYXJncyk7XG4gICAgICB9KTtcbiAgICAgIGZuKF9jYik7XG4gICAgfSlcbiAgfSxcbiAgZGVmZXI6IGZ1bmN0aW9uKCkge1xuICAgIHZhciByZXNvbHZlLCByZWplY3Q7XG4gICAgdmFyIHAgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihfcmVzb2x2ZSwgX3JlamVjdCkge1xuICAgICAgcmVzb2x2ZSA9IF9yZXNvbHZlO1xuICAgICAgcmVqZWN0ID0gX3JlamVjdDtcbiAgICB9KTtcbiAgICAvL25vaW5zcGVjdGlvbiBKU1VudXNlZEFzc2lnbm1lbnRcbiAgICBwLnJlc29sdmUgPSByZXNvbHZlO1xuICAgIC8vbm9pbnNwZWN0aW9uIEpTVW51c2VkQXNzaWdubWVudFxuICAgIHAucmVqZWN0ID0gcmVqZWN0O1xuICAgIHJldHVybiBwO1xuICB9LFxuICBzdWJQcm9wZXJ0aWVzOiBmdW5jdGlvbihvYmosIHN1Yk9iaiwgcHJvcGVydGllcykge1xuICAgIGlmICghaXNBcnJheShwcm9wZXJ0aWVzKSkge1xuICAgICAgcHJvcGVydGllcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgfVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcHJvcGVydGllcy5sZW5ndGg7IGkrKykge1xuICAgICAgKGZ1bmN0aW9uKHByb3BlcnR5KSB7XG4gICAgICAgIHZhciBvcHRzID0ge1xuICAgICAgICAgIHNldDogZmFsc2UsXG4gICAgICAgICAgbmFtZTogcHJvcGVydHksXG4gICAgICAgICAgcHJvcGVydHk6IHByb3BlcnR5XG4gICAgICAgIH07XG4gICAgICAgIGlmICghaXNTdHJpbmcocHJvcGVydHkpKSB7XG4gICAgICAgICAgZXh0ZW5kKG9wdHMsIHByb3BlcnR5KTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgZGVzYyA9IHtcbiAgICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIHN1Yk9ialtvcHRzLnByb3BlcnR5XTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICAgIH07XG4gICAgICAgIGlmIChvcHRzLnNldCkge1xuICAgICAgICAgIGRlc2Muc2V0ID0gZnVuY3Rpb24odikge1xuICAgICAgICAgICAgc3ViT2JqW29wdHMucHJvcGVydHldID0gdjtcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIG9wdHMubmFtZSwgZGVzYyk7XG4gICAgICB9KShwcm9wZXJ0aWVzW2ldKTtcbiAgICB9XG4gIH0sXG4gIGNhcGl0YWxpc2VGaXJzdExldHRlcjogZnVuY3Rpb24oc3RyaW5nKSB7XG4gICAgcmV0dXJuIHN0cmluZy5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHN0cmluZy5zbGljZSgxKTtcbiAgfSxcbiAgZXh0ZW5kRnJvbU9wdHM6IGZ1bmN0aW9uKG9iaiwgb3B0cywgZGVmYXVsdHMsIGVycm9yT25Vbmtub3duKSB7XG4gICAgZXJyb3JPblVua25vd24gPSBlcnJvck9uVW5rbm93biA9PSB1bmRlZmluZWQgPyB0cnVlIDogZXJyb3JPblVua25vd247XG4gICAgaWYgKGVycm9yT25Vbmtub3duKSB7XG4gICAgICB2YXIgZGVmYXVsdEtleXMgPSBPYmplY3Qua2V5cyhkZWZhdWx0cyksXG4gICAgICAgIG9wdHNLZXlzID0gT2JqZWN0LmtleXMob3B0cyk7XG4gICAgICB2YXIgdW5rbm93bktleXMgPSBvcHRzS2V5cy5maWx0ZXIoZnVuY3Rpb24obikge1xuICAgICAgICByZXR1cm4gZGVmYXVsdEtleXMuaW5kZXhPZihuKSA9PSAtMVxuICAgICAgfSk7XG4gICAgICBpZiAodW5rbm93bktleXMubGVuZ3RoKSB0aHJvdyBFcnJvcignVW5rbm93biBvcHRpb25zOiAnICsgdW5rbm93bktleXMudG9TdHJpbmcoKSk7XG4gICAgfVxuICAgIC8vIEFwcGx5IGFueSBmdW5jdGlvbnMgc3BlY2lmaWVkIGluIHRoZSBkZWZhdWx0cy5cbiAgICBPYmplY3Qua2V5cyhkZWZhdWx0cykuZm9yRWFjaChmdW5jdGlvbihrKSB7XG4gICAgICB2YXIgZCA9IGRlZmF1bHRzW2tdO1xuICAgICAgaWYgKHR5cGVvZiBkID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgZGVmYXVsdHNba10gPSBkKG9wdHNba10pO1xuICAgICAgICBkZWxldGUgb3B0c1trXTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBleHRlbmQoZGVmYXVsdHMsIG9wdHMpO1xuICAgIGV4dGVuZChvYmosIGRlZmF1bHRzKTtcbiAgfSxcbiAgaXNTdHJpbmc6IGlzU3RyaW5nLFxuICBpc0FycmF5OiBpc0FycmF5LFxuICBwcmV0dHlQcmludDogZnVuY3Rpb24obykge1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShvLCBudWxsLCA0KTtcbiAgfSxcbiAgZmxhdHRlbkFycmF5OiBmdW5jdGlvbihhcnIpIHtcbiAgICByZXR1cm4gYXJyLnJlZHVjZShmdW5jdGlvbihtZW1vLCBlKSB7XG4gICAgICBpZiAoaXNBcnJheShlKSkge1xuICAgICAgICBtZW1vID0gbWVtby5jb25jYXQoZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBtZW1vLnB1c2goZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbWVtbztcbiAgICB9LCBbXSk7XG4gIH0sXG4gIHVuZmxhdHRlbkFycmF5OiBmdW5jdGlvbihhcnIsIG1vZGVsQXJyKSB7XG4gICAgdmFyIG4gPSAwO1xuICAgIHZhciB1bmZsYXR0ZW5lZCA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbW9kZWxBcnIubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChpc0FycmF5KG1vZGVsQXJyW2ldKSkge1xuICAgICAgICB2YXIgbmV3QXJyID0gW107XG4gICAgICAgIHVuZmxhdHRlbmVkW2ldID0gbmV3QXJyO1xuICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IG1vZGVsQXJyW2ldLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgbmV3QXJyLnB1c2goYXJyW25dKTtcbiAgICAgICAgICBuKys7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHVuZmxhdHRlbmVkW2ldID0gYXJyW25dO1xuICAgICAgICBuKys7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB1bmZsYXR0ZW5lZDtcbiAgfVxufSk7XG5cbi8qKlxuICogQ29tcGFjdCBhIHNwYXJzZSBhcnJheVxuICogQHBhcmFtIGFyclxuICogQHJldHVybnMge0FycmF5fVxuICovXG5mdW5jdGlvbiBjb21wYWN0KGFycikge1xuICBhcnIgPSBhcnIgfHwgW107XG4gIHJldHVybiBhcnIuZmlsdGVyKGZ1bmN0aW9uKHgpIHtyZXR1cm4geH0pO1xufVxuXG4vKipcbiAqIEV4ZWN1dGUgdGFza3MgaW4gcGFyYWxsZWxcbiAqIEBwYXJhbSB0YXNrc1xuICogQHBhcmFtIGNiXG4gKi9cbmZ1bmN0aW9uIHBhcmFsbGVsKHRhc2tzLCBjYikge1xuICBjYiA9IGNiIHx8IGZ1bmN0aW9uKCkge307XG4gIGlmICh0YXNrcyAmJiB0YXNrcy5sZW5ndGgpIHtcbiAgICB2YXIgcmVzdWx0cyA9IFtdLCBlcnJvcnMgPSBbXSwgbnVtRmluaXNoZWQgPSAwO1xuICAgIHRhc2tzLmZvckVhY2goZnVuY3Rpb24oZm4sIGlkeCkge1xuICAgICAgcmVzdWx0c1tpZHhdID0gZmFsc2U7XG4gICAgICBmbihmdW5jdGlvbihlcnIsIHJlcykge1xuICAgICAgICBudW1GaW5pc2hlZCsrO1xuICAgICAgICBpZiAoZXJyKSBlcnJvcnNbaWR4XSA9IGVycjtcbiAgICAgICAgcmVzdWx0c1tpZHhdID0gcmVzO1xuICAgICAgICBpZiAobnVtRmluaXNoZWQgPT0gdGFza3MubGVuZ3RoKSB7XG4gICAgICAgICAgY2IoXG4gICAgICAgICAgICBlcnJvcnMubGVuZ3RoID8gY29tcGFjdChlcnJvcnMpIDogbnVsbCxcbiAgICAgICAgICAgIGNvbXBhY3QocmVzdWx0cyksXG4gICAgICAgICAgICB7cmVzdWx0czogcmVzdWx0cywgZXJyb3JzOiBlcnJvcnN9XG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH0gZWxzZSBjYigpO1xufVxuXG4vKipcbiAqIEV4ZWN1dGUgdGFza3Mgb25lIGFmdGVyIGFub3RoZXJcbiAqIEBwYXJhbSB0YXNrc1xuICogQHBhcmFtIGNiXG4gKi9cbmZ1bmN0aW9uIHNlcmllcyh0YXNrcywgY2IpIHtcbiAgY2IgPSBjYiB8fCBmdW5jdGlvbigpIHt9O1xuICBpZiAodGFza3MgJiYgdGFza3MubGVuZ3RoKSB7XG4gICAgdmFyIHJlc3VsdHMgPSBbXSwgZXJyb3JzID0gW10sIGlkeCA9IDA7XG5cbiAgICBmdW5jdGlvbiBleGVjdXRlVGFzayh0YXNrKSB7XG4gICAgICB0YXNrKGZ1bmN0aW9uKGVyciwgcmVzKSB7XG4gICAgICAgIGlmIChlcnIpIGVycm9yc1tpZHhdID0gZXJyO1xuICAgICAgICByZXN1bHRzW2lkeF0gPSByZXM7XG4gICAgICAgIGlmICghdGFza3MubGVuZ3RoKSB7XG4gICAgICAgICAgY2IoXG4gICAgICAgICAgICBlcnJvcnMubGVuZ3RoID8gY29tcGFjdChlcnJvcnMpIDogbnVsbCxcbiAgICAgICAgICAgIGNvbXBhY3QocmVzdWx0cyksXG4gICAgICAgICAgICB7cmVzdWx0czogcmVzdWx0cywgZXJyb3JzOiBlcnJvcnN9XG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBpZHgrKztcbiAgICAgICAgICBuZXh0VGFzaygpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBuZXh0VGFzaygpIHtcbiAgICAgIHZhciBuZXh0VGFzayA9IHRhc2tzLnNoaWZ0KCk7XG4gICAgICBleGVjdXRlVGFzayhuZXh0VGFzayk7XG4gICAgfVxuXG4gICAgbmV4dFRhc2soKTtcblxuICB9IGVsc2UgY2IoKTtcbn1cblxuXG5leHRlbmQobW9kdWxlLmV4cG9ydHMsIHtcbiAgY29tcGFjdDogY29tcGFjdCxcbiAgcGFyYWxsZWw6IHBhcmFsbGVsLFxuICBzZXJpZXM6IHNlcmllc1xufSk7XG5cbnZhciBGTl9BUkdTID0gL15mdW5jdGlvblxccypbXlxcKF0qXFwoXFxzKihbXlxcKV0qKVxcKS9tLFxuICBGTl9BUkdfU1BMSVQgPSAvLC8sXG4gIEZOX0FSRyA9IC9eXFxzKihfPykoLis/KVxcMVxccyokLyxcbiAgU1RSSVBfQ09NTUVOVFMgPSAvKChcXC9cXC8uKiQpfChcXC9cXCpbXFxzXFxTXSo/XFwqXFwvKSkvbWc7XG5cbmV4dGVuZChtb2R1bGUuZXhwb3J0cywge1xuICAvKipcbiAgICogUmV0dXJuIHRoZSBwYXJhbWV0ZXIgbmFtZXMgb2YgYSBmdW5jdGlvbi5cbiAgICogTm90ZTogYWRhcHRlZCBmcm9tIEFuZ3VsYXJKUyBkZXBlbmRlbmN5IGluamVjdGlvbiA6KVxuICAgKiBAcGFyYW0gZm5cbiAgICovXG4gIHBhcmFtTmFtZXM6IGZ1bmN0aW9uKGZuKSB7XG4gICAgLy8gVE9ETzogSXMgdGhlcmUgYSBtb3JlIHJvYnVzdCB3YXkgb2YgZG9pbmcgdGhpcz9cbiAgICB2YXIgcGFyYW1zID0gW10sXG4gICAgICBmblRleHQsXG4gICAgICBhcmdEZWNsO1xuICAgIGZuVGV4dCA9IGZuLnRvU3RyaW5nKCkucmVwbGFjZShTVFJJUF9DT01NRU5UUywgJycpO1xuICAgIGFyZ0RlY2wgPSBmblRleHQubWF0Y2goRk5fQVJHUyk7XG5cbiAgICBhcmdEZWNsWzFdLnNwbGl0KEZOX0FSR19TUExJVCkuZm9yRWFjaChmdW5jdGlvbihhcmcpIHtcbiAgICAgIGFyZy5yZXBsYWNlKEZOX0FSRywgZnVuY3Rpb24oYWxsLCB1bmRlcnNjb3JlLCBuYW1lKSB7XG4gICAgICAgIHBhcmFtcy5wdXNoKG5hbWUpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHBhcmFtcztcbiAgfVxufSk7XG5cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vY29yZS91dGlsLmpzXG4gKiogbW9kdWxlIGlkID0gMVxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwiLyoqXG4gKiBGb3IgdGhvc2UgZmFtaWxpYXIgd2l0aCBBcHBsZSdzIENvY29hIGxpYnJhcnksIHJlYWN0aXZlIHF1ZXJpZXMgcm91Z2hseSBtYXAgb250byBOU0ZldGNoZWRSZXN1bHRzQ29udHJvbGxlci5cbiAqXG4gKiBUaGV5IHByZXNlbnQgYSBxdWVyeSBzZXQgdGhhdCAncmVhY3RzJyB0byBjaGFuZ2VzIGluIHRoZSB1bmRlcmx5aW5nIGRhdGEuXG4gKiBAbW9kdWxlIHJlYWN0aXZlUXVlcnlcbiAqL1xuXG52YXIgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSgnZmlsdGVyOnJlYWN0aXZlJyksXG4gIEZpbHRlciA9IHJlcXVpcmUoJy4vRmlsdGVyJyksXG4gIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcixcbiAgQ2hhaW4gPSByZXF1aXJlKCcuL0NoYWluJyksXG4gIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gIGNvbnN0cnVjdEZpbHRlclNldCA9IHJlcXVpcmUoJy4vRmlsdGVyU2V0JyksXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcblxuLyoqXG4gKlxuICogQHBhcmFtIHtGaWx0ZXJ9IGZpbHRlciAtIFRoZSB1bmRlcmx5aW5nIHF1ZXJ5XG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gUmVhY3RpdmVGaWx0ZXIoZmlsdGVyKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgRXZlbnRFbWl0dGVyLmNhbGwodGhpcyk7XG4gIENoYWluLmNhbGwodGhpcyk7XG4gIHV0aWwuZXh0ZW5kKHRoaXMsIHtcbiAgICBpbnNlcnRpb25Qb2xpY3k6IFJlYWN0aXZlRmlsdGVyLkluc2VydGlvblBvbGljeS5CYWNrLFxuICAgIGluaXRpYWxpc2VkOiBmYWxzZVxuICB9KTtcblxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ2ZpbHRlcicsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2ZpbHRlclxuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbih2KSB7XG4gICAgICBpZiAodikge1xuICAgICAgICB0aGlzLl9maWx0ZXIgPSB2O1xuICAgICAgICB0aGlzLnJlc3VsdHMgPSBjb25zdHJ1Y3RGaWx0ZXJTZXQoW10sIHYubW9kZWwpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHRoaXMuX2ZpbHRlciA9IG51bGw7XG4gICAgICAgIHRoaXMucmVzdWx0cyA9IG51bGw7XG4gICAgICB9XG4gICAgfSxcbiAgICBjb25maWd1cmFibGU6IGZhbHNlLFxuICAgIGVudW1lcmFibGU6IHRydWVcbiAgfSk7XG5cbiAgaWYgKGZpbHRlcikge1xuICAgIHV0aWwuZXh0ZW5kKHRoaXMsIHtcbiAgICAgIF9maWx0ZXI6IGZpbHRlcixcbiAgICAgIHJlc3VsdHM6IGNvbnN0cnVjdEZpbHRlclNldChbXSwgZmlsdGVyLm1vZGVsKVxuICAgIH0pXG4gIH1cblxuICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyh0aGlzLCB7XG4gICAgaW5pdGlhbGl6ZWQ6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmluaXRpYWxpc2VkXG4gICAgICB9XG4gICAgfSxcbiAgICBtb2RlbDoge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGZpbHRlciA9IHNlbGYuX2ZpbHRlcjtcbiAgICAgICAgaWYgKGZpbHRlcikge1xuICAgICAgICAgIHJldHVybiBmaWx0ZXIubW9kZWxcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG4gICAgY29sbGVjdGlvbjoge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHNlbGYubW9kZWwuY29sbGVjdGlvbk5hbWVcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuXG5cbn1cblxuUmVhY3RpdmVGaWx0ZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShFdmVudEVtaXR0ZXIucHJvdG90eXBlKTtcbnV0aWwuZXh0ZW5kKFJlYWN0aXZlRmlsdGVyLnByb3RvdHlwZSwgQ2hhaW4ucHJvdG90eXBlKTtcblxudXRpbC5leHRlbmQoUmVhY3RpdmVGaWx0ZXIsIHtcbiAgSW5zZXJ0aW9uUG9saWN5OiB7XG4gICAgRnJvbnQ6ICdGcm9udCcsXG4gICAgQmFjazogJ0JhY2snXG4gIH1cbn0pO1xuXG51dGlsLmV4dGVuZChSZWFjdGl2ZUZpbHRlci5wcm90b3R5cGUsIHtcbiAgLyoqXG4gICAqXG4gICAqIEBwYXJhbSBjYlxuICAgKiBAcGFyYW0ge2Jvb2x9IF9pZ25vcmVJbml0IC0gZXhlY3V0ZSBxdWVyeSBhZ2FpbiwgaW5pdGlhbGlzZWQgb3Igbm90LlxuICAgKiBAcmV0dXJucyB7Kn1cbiAgICovXG4gIGluaXQ6IGZ1bmN0aW9uKGNiLCBfaWdub3JlSW5pdCkge1xuICAgIGlmICh0aGlzLl9maWx0ZXIpIHtcbiAgICAgIHZhciBuYW1lID0gdGhpcy5fY29uc3RydWN0Tm90aWZpY2F0aW9uTmFtZSgpO1xuICAgICAgdmFyIGhhbmRsZXIgPSBmdW5jdGlvbihuKSB7XG4gICAgICAgIHRoaXMuX2hhbmRsZU5vdGlmKG4pO1xuICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgdGhpcy5oYW5kbGVyID0gaGFuZGxlcjtcbiAgICAgIHRoaXMubW9kZWwuY29udGV4dC5ldmVudHMub24obmFtZSwgaGFuZGxlcik7XG4gICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgICBpZiAoKCF0aGlzLmluaXRpYWxpc2VkKSB8fCBfaWdub3JlSW5pdCkge1xuICAgICAgICAgIHRoaXMuX2ZpbHRlci5leGVjdXRlKGZ1bmN0aW9uKGVyciwgcmVzdWx0cykge1xuICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgY2IobnVsbCwgdGhpcy5fYXBwbHlSZXN1bHRzKHJlc3VsdHMpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICBjYihlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgY2IobnVsbCwgdGhpcy5yZXN1bHRzKTtcbiAgICAgICAgfVxuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG4gICAgZWxzZSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gX2ZpbHRlciBkZWZpbmVkJyk7XG4gIH0sXG4gIF9hcHBseVJlc3VsdHM6IGZ1bmN0aW9uKHJlc3VsdHMpIHtcbiAgICB0aGlzLnJlc3VsdHMgPSByZXN1bHRzO1xuICAgIHRoaXMuaW5pdGlhbGlzZWQgPSB0cnVlO1xuICAgIHJldHVybiB0aGlzLnJlc3VsdHM7XG4gIH0sXG4gIGluc2VydDogZnVuY3Rpb24obmV3T2JqKSB7XG4gICAgdmFyIHJlc3VsdHMgPSB0aGlzLnJlc3VsdHMubXV0YWJsZUNvcHkoKTtcbiAgICBpZiAodGhpcy5pbnNlcnRpb25Qb2xpY3kgPT0gUmVhY3RpdmVGaWx0ZXIuSW5zZXJ0aW9uUG9saWN5LkJhY2spIHZhciBpZHggPSByZXN1bHRzLnB1c2gobmV3T2JqKTtcbiAgICBlbHNlIGlkeCA9IHJlc3VsdHMudW5zaGlmdChuZXdPYmopO1xuICAgIHRoaXMucmVzdWx0cyA9IHJlc3VsdHMuYXNNb2RlbEZpbHRlclNldCh0aGlzLm1vZGVsKTtcbiAgICByZXR1cm4gaWR4O1xuICB9LFxuICAvKipcbiAgICogRXhlY3V0ZSB0aGUgdW5kZXJseWluZyBxdWVyeSBhZ2Fpbi5cbiAgICogQHBhcmFtIGNiXG4gICAqL1xuICB1cGRhdGU6IGZ1bmN0aW9uKGNiKSB7XG4gICAgcmV0dXJuIHRoaXMuaW5pdChjYiwgdHJ1ZSlcbiAgfSxcbiAgX2hhbmRsZU5vdGlmOiBmdW5jdGlvbihuKSB7XG4gICAgaWYgKG4udHlwZSA9PSBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5OZXcpIHtcbiAgICAgIHZhciBuZXdPYmogPSBuLm5ldztcbiAgICAgIGlmICh0aGlzLl9maWx0ZXIub2JqZWN0TWF0Y2hlc0ZpbHRlcihuZXdPYmopKSB7XG4gICAgICAgIGxvZygnTmV3IG9iamVjdCBtYXRjaGVzJywgbmV3T2JqKTtcbiAgICAgICAgdmFyIGlkeCA9IHRoaXMuaW5zZXJ0KG5ld09iaik7XG4gICAgICAgIHRoaXMuZW1pdChtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5TcGxpY2UsIHtcbiAgICAgICAgICBpbmRleDogaWR4LFxuICAgICAgICAgIGFkZGVkOiBbbmV3T2JqXSxcbiAgICAgICAgICB0eXBlOiBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgICAgICAgb2JqOiB0aGlzXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGxvZygnTmV3IG9iamVjdCBkb2VzIG5vdCBtYXRjaCcsIG5ld09iaik7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2UgaWYgKG4udHlwZSA9PSBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5TZXQpIHtcbiAgICAgIG5ld09iaiA9IG4ub2JqO1xuICAgICAgdmFyIGluZGV4ID0gdGhpcy5yZXN1bHRzLmluZGV4T2YobmV3T2JqKSxcbiAgICAgICAgYWxyZWFkeUNvbnRhaW5zID0gaW5kZXggPiAtMSxcbiAgICAgICAgbWF0Y2hlcyA9IHRoaXMuX2ZpbHRlci5vYmplY3RNYXRjaGVzRmlsdGVyKG5ld09iaik7XG4gICAgICBpZiAobWF0Y2hlcyAmJiAhYWxyZWFkeUNvbnRhaW5zKSB7XG4gICAgICAgIGxvZygnVXBkYXRlZCBvYmplY3Qgbm93IG1hdGNoZXMhJywgbmV3T2JqKTtcbiAgICAgICAgaWR4ID0gdGhpcy5pbnNlcnQobmV3T2JqKTtcbiAgICAgICAgdGhpcy5lbWl0KG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSwge1xuICAgICAgICAgIGluZGV4OiBpZHgsXG4gICAgICAgICAgYWRkZWQ6IFtuZXdPYmpdLFxuICAgICAgICAgIHR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICBvYmo6IHRoaXNcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBlbHNlIGlmICghbWF0Y2hlcyAmJiBhbHJlYWR5Q29udGFpbnMpIHtcbiAgICAgICAgbG9nKCdVcGRhdGVkIG9iamVjdCBubyBsb25nZXIgbWF0Y2hlcyEnLCBuZXdPYmopO1xuICAgICAgICByZXN1bHRzID0gdGhpcy5yZXN1bHRzLm11dGFibGVDb3B5KCk7XG4gICAgICAgIHZhciByZW1vdmVkID0gcmVzdWx0cy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICB0aGlzLnJlc3VsdHMgPSByZXN1bHRzLmFzTW9kZWxGaWx0ZXJTZXQodGhpcy5tb2RlbCk7XG4gICAgICAgIHRoaXMuZW1pdChtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5TcGxpY2UsIHtcbiAgICAgICAgICBpbmRleDogaW5kZXgsXG4gICAgICAgICAgb2JqOiB0aGlzLFxuICAgICAgICAgIG5ldzogbmV3T2JqLFxuICAgICAgICAgIHR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICByZW1vdmVkOiByZW1vdmVkXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgZWxzZSBpZiAoIW1hdGNoZXMgJiYgIWFscmVhZHlDb250YWlucykge1xuICAgICAgICBsb2coJ0RvZXMgbm90IGNvbnRhaW4sIGJ1dCBkb2VzbnQgbWF0Y2ggc28gbm90IGluc2VydGluZycsIG5ld09iaik7XG4gICAgICB9XG4gICAgICBlbHNlIGlmIChtYXRjaGVzICYmIGFscmVhZHlDb250YWlucykge1xuICAgICAgICBsb2coJ01hdGNoZXMgYnV0IGFscmVhZHkgY29udGFpbnMnLCBuZXdPYmopO1xuICAgICAgICAvLyBTZW5kIHRoZSBub3RpZmljYXRpb24gb3Zlci5cbiAgICAgICAgdGhpcy5lbWl0KG4udHlwZSwgbik7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2UgaWYgKG4udHlwZSA9PSBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5SZW1vdmUpIHtcbiAgICAgIG5ld09iaiA9IG4ub2JqO1xuICAgICAgdmFyIHJlc3VsdHMgPSB0aGlzLnJlc3VsdHMubXV0YWJsZUNvcHkoKTtcbiAgICAgIGluZGV4ID0gcmVzdWx0cy5pbmRleE9mKG5ld09iaik7XG4gICAgICBpZiAoaW5kZXggPiAtMSkge1xuICAgICAgICBsb2coJ1JlbW92aW5nIG9iamVjdCcsIG5ld09iaik7XG4gICAgICAgIHJlbW92ZWQgPSByZXN1bHRzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIHRoaXMucmVzdWx0cyA9IGNvbnN0cnVjdEZpbHRlclNldChyZXN1bHRzLCB0aGlzLm1vZGVsKTtcbiAgICAgICAgdGhpcy5lbWl0KG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSwge1xuICAgICAgICAgIGluZGV4OiBpbmRleCxcbiAgICAgICAgICBvYmo6IHRoaXMsXG4gICAgICAgICAgdHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgIHJlbW92ZWQ6IHJlbW92ZWRcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgbG9nKCdObyBtb2RlbEV2ZW50cyBuZWNjZXNzYXJ5LicsIG5ld09iaik7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ1Vua25vd24gY2hhbmdlIHR5cGUgXCInICsgbi50eXBlLnRvU3RyaW5nKCkgKyAnXCInKVxuICAgIH1cbiAgICB0aGlzLnJlc3VsdHMgPSBjb25zdHJ1Y3RGaWx0ZXJTZXQodGhpcy5fZmlsdGVyLl9zb3J0UmVzdWx0cyh0aGlzLnJlc3VsdHMpLCB0aGlzLm1vZGVsKTtcbiAgfSxcbiAgX2NvbnN0cnVjdE5vdGlmaWNhdGlvbk5hbWU6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNvbGxlY3Rpb25OYW1lICsgJzonICsgdGhpcy5tb2RlbC5uYW1lO1xuICB9LFxuICB0ZXJtaW5hdGU6IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLmhhbmRsZXIpIHtcbiAgICAgIHRoaXMubW9kZWwuY29udGV4dC5ldmVudHMucmVtb3ZlTGlzdGVuZXIodGhpcy5fY29uc3RydWN0Tm90aWZpY2F0aW9uTmFtZSgpLCB0aGlzLmhhbmRsZXIpO1xuICAgIH1cbiAgICB0aGlzLnJlc3VsdHMgPSBudWxsO1xuICAgIHRoaXMuaGFuZGxlciA9IG51bGw7XG4gIH0sXG4gIF9yZWdpc3RlckV2ZW50SGFuZGxlcjogZnVuY3Rpb24ob24sIG5hbWUsIGZuKSB7XG4gICAgdmFyIHJlbW92ZUxpc3RlbmVyID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lcjtcbiAgICBpZiAobmFtZS50cmltKCkgPT0gJyonKSB7XG4gICAgICBPYmplY3Qua2V5cyhtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZSkuZm9yRWFjaChmdW5jdGlvbihrKSB7XG4gICAgICAgIG9uLmNhbGwodGhpcywgbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGVba10sIGZuKTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgb24uY2FsbCh0aGlzLCBuYW1lLCBmbik7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9saW5rKHtcbiAgICAgICAgb246IHRoaXMub24uYmluZCh0aGlzKSxcbiAgICAgICAgb25jZTogdGhpcy5vbmNlLmJpbmQodGhpcyksXG4gICAgICAgIHVwZGF0ZTogdGhpcy51cGRhdGUuYmluZCh0aGlzKSxcbiAgICAgICAgaW5zZXJ0OiB0aGlzLmluc2VydC5iaW5kKHRoaXMpXG4gICAgICB9LFxuICAgICAgZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmIChuYW1lLnRyaW0oKSA9PSAnKicpIHtcbiAgICAgICAgICBPYmplY3Qua2V5cyhtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZSkuZm9yRWFjaChmdW5jdGlvbihrKSB7XG4gICAgICAgICAgICByZW1vdmVMaXN0ZW5lci5jYWxsKHRoaXMsIG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlW2tdLCBmbik7XG4gICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICByZW1vdmVMaXN0ZW5lci5jYWxsKHRoaXMsIG5hbWUsIGZuKTtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgfSxcbiAgb246IGZ1bmN0aW9uKG5hbWUsIGZuKSB7XG4gICAgcmV0dXJuIHRoaXMuX3JlZ2lzdGVyRXZlbnRIYW5kbGVyKEV2ZW50RW1pdHRlci5wcm90b3R5cGUub24sIG5hbWUsIGZuKTtcbiAgfSxcbiAgb25jZTogZnVuY3Rpb24obmFtZSwgZm4pIHtcbiAgICByZXR1cm4gdGhpcy5fcmVnaXN0ZXJFdmVudEhhbmRsZXIoRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlLCBuYW1lLCBmbik7XG4gIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFJlYWN0aXZlRmlsdGVyO1xuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvUmVhY3RpdmVGaWx0ZXIuanNcbiAqKiBtb2R1bGUgaWQgPSAyXG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJ2YXIgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gIENhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpLFxuICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gIE1vZGVsID0gcmVxdWlyZSgnLi9tb2RlbCcpLFxuICBlcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKSxcbiAgU3RvcmFnZSA9IHJlcXVpcmUoJy4uL3N0b3JhZ2UnKSxcbiAgRmlsdGVyID0gcmVxdWlyZSgnLi9GaWx0ZXInKSxcbiAgQ29sbGVjdGlvbiA9IHJlcXVpcmUoJy4vY29sbGVjdGlvbicpO1xuXG5mdW5jdGlvbiBjb25maWd1cmVTdG9yYWdlKG9wdHMpIHtcbiAgdGhpcy5fc3RvcmFnZSA9IG5ldyBTdG9yYWdlKHRoaXMsIG9wdHMpO1xufVxuXG5mdW5jdGlvbiBDb250ZXh0KG9wdHMpIHtcbiAgdGhpcy5jb2xsZWN0aW9ucyA9IHt9O1xuICB0aGlzLmNhY2hlID0gbmV3IENhY2hlKCk7XG5cbiAgb3B0cyA9IG9wdHMgfHwge307XG4gIHRoaXMubmFtZSA9IG9wdHMubmFtZTtcblxuICBpZiAob3B0cy5zdG9yYWdlKSB7XG4gICAgY29uZmlndXJlU3RvcmFnZS5jYWxsKHRoaXMsIG9wdHMuc3RvcmFnZSk7XG4gIH1cblxuICBpZiAoIXRoaXMubmFtZSkgdGhyb3cgbmV3IEVycm9yKCdNdXN0IHByb3ZpZGUgbmFtZSB0byBjb250ZXh0Jyk7XG5cbiAgdGhpcy5ldmVudHMgPSBldmVudHMoKTtcbiAgdmFyIG9mZiA9IHRoaXMuZXZlbnRzLnJlbW92ZUxpc3RlbmVyLmJpbmQodGhpcy5ldmVudHMpO1xuXG4gIHV0aWwuZXh0ZW5kKHRoaXMsIHtcbiAgICBvbjogdGhpcy5ldmVudHMub24uYmluZCh0aGlzLmV2ZW50cyksXG4gICAgb2ZmOiBvZmYsXG4gICAgcmVtb3ZlTGlzdGVuZXI6IG9mZixcbiAgICBvbmNlOiB0aGlzLmV2ZW50cy5vbmNlLmJpbmQodGhpcy5ldmVudHMpLFxuICAgIHJlbW92ZUFsbExpc3RlbmVyczogdGhpcy5ldmVudHMucmVtb3ZlQWxsTGlzdGVuZXJzLmJpbmQodGhpcy5ldmVudHMpLFxuICAgIG5vdGlmeTogdXRpbC5uZXh0LFxuICAgIGRpZ2VzdDogdXRpbC5uZXh0LFxuICAgIGVtaXQ6IHV0aWwubmV4dCxcbiAgICByZWdpc3RlckNvbXBhcmF0b3I6IEZpbHRlci5yZWdpc3RlckNvbXBhcmF0b3IuYmluZChGaWx0ZXIpLFxuICAgIHNhdmU6IGZ1bmN0aW9uKGNiKSB7XG4gICAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgICBpZiAodGhpcy5fc3RvcmFnZSkge1xuICAgICAgICAgIHRoaXMuX3N0b3JhZ2Uuc2F2ZShjYik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBjYigpO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG4gIH0pO1xuXG4gIHZhciBpbnRlcnZhbCwgc2F2aW5nLCBhdXRvc2F2ZUludGVydmFsID0gNTAwO1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHRoaXMsIHtcbiAgICBzdG9yYWdlOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gISF0aGlzLl9zdG9yYWdlO1xuICAgICAgfSxcbiAgICAgIHNldDogZnVuY3Rpb24odikge1xuICAgICAgICBpZiAoIXYpIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5fc3RvcmFnZTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICB0aGlzLl9zdG9yYWdlID0gbmV3IFN0b3JhZ2UodGhpcyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIGRpcnR5OiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc3RvcmFnZSA9IHRoaXMuX3N0b3JhZ2U7XG4gICAgICAgIGlmIChzdG9yYWdlKSB7XG4gICAgICAgICAgdmFyIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uID0gc3RvcmFnZS5fdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb247XG4gICAgICAgICAgcmV0dXJuICEhT2JqZWN0LmtleXMoc3RvcmFnZS51bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbikubGVuZ3RoO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0sXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfSxcbiAgICBhdXRvc2F2ZUludGVydmFsOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gYXV0b3NhdmVJbnRlcnZhbDtcbiAgICAgIH0sXG4gICAgICBzZXQ6IGZ1bmN0aW9uKF9hdXRvc2F2ZUludGVydmFsKSB7XG4gICAgICAgIGF1dG9zYXZlSW50ZXJ2YWwgPSBfYXV0b3NhdmVJbnRlcnZhbDtcbiAgICAgICAgaWYgKGludGVydmFsKSB7XG4gICAgICAgICAgLy8gUmVzZXQgaW50ZXJ2YWxcbiAgICAgICAgICB0aGlzLmF1dG9zYXZlID0gZmFsc2U7XG4gICAgICAgICAgdGhpcy5hdXRvc2F2ZSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIGF1dG9zYXZlOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gISFpbnRlcnZhbDtcbiAgICAgIH0sXG4gICAgICBzZXQ6IGZ1bmN0aW9uKGF1dG9zYXZlKSB7XG4gICAgICAgIGlmIChhdXRvc2F2ZSkge1xuICAgICAgICAgIGlmICghaW50ZXJ2YWwpIHtcbiAgICAgICAgICAgIGludGVydmFsID0gc2V0SW50ZXJ2YWwoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgIC8vIENoZWVreSB3YXkgb2YgYXZvaWRpbmcgbXVsdGlwbGUgc2F2ZXMgaGFwcGVuaW5nLi4uXG4gICAgICAgICAgICAgIGlmICghc2F2aW5nKSB7XG4gICAgICAgICAgICAgICAgc2F2aW5nID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLl9zdG9yYWdlLnNhdmUoZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmV2ZW50cy5lbWl0KCdzYXZlZCcpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgc2F2aW5nID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfS5iaW5kKHRoaXMpLCB0aGlzLmF1dG9zYXZlSW50ZXJ2YWwpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBpZiAoaW50ZXJ2YWwpIHtcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwoaW50ZXJ2YWwpO1xuICAgICAgICAgICAgaW50ZXJ2YWwgPSBudWxsO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG4gICAgY29sbGVjdGlvbk5hbWVzOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5jb2xsZWN0aW9ucyk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICB0aGlzLmF1dG9zYXZlID0gb3B0cy5hdXRvc2F2ZTtcbiAgaWYgKG9wdHMuYXV0b3NhdmVJbnRlcnZhbCkge1xuICAgIHRoaXMuYXV0b3NhdmVJbnRlcnZhbCA9IG9wdHMuYXV0b3NhdmVJbnRlcnZhbDtcbiAgfVxufVxuXG5Db250ZXh0LnByb3RvdHlwZSA9IHtcbiAgY29sbGVjdGlvbjogZnVuY3Rpb24obmFtZSwgb3B0cykge1xuICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgIG9wdHMuY29udGV4dCA9IHRoaXM7XG4gICAgdmFyIGNvbGxlY3Rpb24gPSBuZXcgQ29sbGVjdGlvbihuYW1lLCBvcHRzKTtcbiAgICBpZiAoIXRoaXNbbmFtZV0pIHtcbiAgICAgIHRoaXNbbmFtZV0gPSBjb2xsZWN0aW9uO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHZhciBlcnJNc2cgPSAnQSBjb2xsZWN0aW9uIHdpdGggbmFtZSBcIicgKyBuYW1lICsgJ1wiIGFscmVhZHkgZXhpc3RzLCBvciB0aGF0IG5hbWUgaXMgbm90IGFsbG93ZWQnO1xuICAgICAgY29uc29sZS5lcnJvcihlcnJNc2csIHRoaXNbbmFtZV0pO1xuICAgICAgdGhyb3cgRXJyb3IoZXJyTXNnKTtcbiAgICB9XG4gICAgcmV0dXJuIGNvbGxlY3Rpb247XG4gIH0sXG4gIGJyb2FkY2FzdDogZnVuY3Rpb24ob3B0cykge1xuICAgIG1vZGVsRXZlbnRzLmVtaXQodGhpcywgb3B0cyk7XG4gIH0sXG4gIGdyYXBoOiBmdW5jdGlvbihkYXRhLCBvcHRzLCBjYikge1xuICAgIGlmICh0eXBlb2Ygb3B0cyA9PSAnZnVuY3Rpb24nKSBjYiA9IG9wdHM7XG4gICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgIHZhciB0YXNrcyA9IFtdLCBlcnI7XG4gICAgICBmb3IgKHZhciBjb2xsZWN0aW9uTmFtZSBpbiBkYXRhKSB7XG4gICAgICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KGNvbGxlY3Rpb25OYW1lKSkge1xuICAgICAgICAgIHZhciBjb2xsZWN0aW9uID0gdGhpcy5jb2xsZWN0aW9uc1tjb2xsZWN0aW9uTmFtZV07XG4gICAgICAgICAgaWYgKGNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgIChmdW5jdGlvbihjb2xsZWN0aW9uLCBkYXRhKSB7XG4gICAgICAgICAgICAgIHRhc2tzLnB1c2goZnVuY3Rpb24oZG9uZSkge1xuICAgICAgICAgICAgICAgIGNvbGxlY3Rpb24uZ3JhcGgoZGF0YSwgZnVuY3Rpb24oZXJyLCByZXMpIHtcbiAgICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciByZXN1bHRzID0ge307XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdHNbY29sbGVjdGlvbi5uYW1lXSA9IHJlcztcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGRvbmUoZXJyLCByZXN1bHRzKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KShjb2xsZWN0aW9uLCBkYXRhW2NvbGxlY3Rpb25OYW1lXSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgZXJyID0gJ05vIHN1Y2ggY29sbGVjdGlvbiBcIicgKyBjb2xsZWN0aW9uTmFtZSArICdcIic7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoIWVycikge1xuICAgICAgICB1dGlsLnNlcmllcyh0YXNrcywgZnVuY3Rpb24oZXJyLCByZXN1bHRzKSB7XG4gICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgIHJlc3VsdHMgPSByZXN1bHRzLnJlZHVjZShmdW5jdGlvbihtZW1vLCByZXMpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHV0aWwuZXh0ZW5kKG1lbW8sIHJlcyk7XG4gICAgICAgICAgICB9LCB7fSlcbiAgICAgICAgICB9IGVsc2UgcmVzdWx0cyA9IG51bGw7XG4gICAgICAgICAgY2IoZXJyLCByZXN1bHRzKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBlbHNlIGNiKGVycm9yKGVyciwge2RhdGE6IGRhdGEsIGludmFsaWRDb2xsZWN0aW9uTmFtZTogY29sbGVjdGlvbk5hbWV9KSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcbiAgY291bnQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmNhY2hlLmNvdW50KCk7XG4gIH0sXG4gIGdldDogZnVuY3Rpb24oaWQsIGNiKSB7XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgIGNiKG51bGwsIHRoaXMuY2FjaGUuX2xvY2FsQ2FjaGUoKVtpZF0pO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gIH0sXG4gIHJlbW92ZUFsbDogZnVuY3Rpb24oY2IpIHtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgdXRpbC5Qcm9taXNlLmFsbChcbiAgICAgICAgdGhpcy5jb2xsZWN0aW9uTmFtZXMubWFwKGZ1bmN0aW9uKGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgICAgICAgdmFyIGNvbGxlY3Rpb24gPSB0aGlzLmNvbGxlY3Rpb25zW2NvbGxlY3Rpb25OYW1lXTtcbiAgICAgICAgICByZXR1cm4gY29sbGVjdGlvbi5yZW1vdmVBbGwoKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKVxuICAgICAgKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGNiKG51bGwpO1xuICAgICAgICB9KS5jYXRjaChjYilcbiAgICB9LmJpbmQodGhpcykpO1xuICB9LFxuICBfZW5zdXJlSW5zdGFsbGVkOiBmdW5jdGlvbihjYikge1xuICAgIGNiID0gY2IgfHwgZnVuY3Rpb24oKSB7fTtcbiAgICB2YXIgYWxsTW9kZWxzID0gdGhpcy5jb2xsZWN0aW9uTmFtZXMucmVkdWNlKGZ1bmN0aW9uKG1lbW8sIGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgICB2YXIgY29sbGVjdGlvbiA9IHRoaXMuY29sbGVjdGlvbnNbY29sbGVjdGlvbk5hbWVdO1xuICAgICAgbWVtbyA9IG1lbW8uY29uY2F0KGNvbGxlY3Rpb24ubW9kZWxzKTtcbiAgICAgIHJldHVybiBtZW1vO1xuICAgIH0uYmluZCh0aGlzKSwgW10pO1xuICAgIGNvbnNvbGUubG9nKCdpbnN0YWxsaW5nIG1vZGVscycsIGFsbE1vZGVscyk7XG4gICAgTW9kZWwuaW5zdGFsbChhbGxNb2RlbHMsIGNiKTtcbiAgfSxcbiAgX3B1c2hUYXNrOiBmdW5jdGlvbih0YXNrKSB7XG4gICAgaWYgKCF0aGlzLnF1ZXVlZFRhc2tzKSB7XG4gICAgICB0aGlzLnF1ZXVlZFRhc2tzID0gbmV3IGZ1bmN0aW9uIFF1ZXVlKCkge1xuICAgICAgICB0aGlzLnRhc2tzID0gW107XG4gICAgICAgIHRoaXMuZXhlY3V0ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHRoaXMudGFza3MuZm9yRWFjaChmdW5jdGlvbihmKSB7XG4gICAgICAgICAgICBmKClcbiAgICAgICAgICB9KTtcbiAgICAgICAgICB0aGlzLnRhc2tzID0gW107XG4gICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICAgIH07XG4gICAgfVxuICAgIHRoaXMucXVldWVkVGFza3MudGFza3MucHVzaCh0YXNrKTtcbiAgfSxcbiAgcmVzZXQ6IGZ1bmN0aW9uKGNiLCByZXNldFN0b3JhZ2UpIHtcbiAgICBkZWxldGUgdGhpcy5xdWV1ZWRUYXNrcztcbiAgICB0aGlzLmNhY2hlLnJlc2V0KCk7XG4gICAgdmFyIGNvbGxlY3Rpb25OYW1lcyA9IHRoaXMuY29sbGVjdGlvbk5hbWVzO1xuICAgIGNvbGxlY3Rpb25OYW1lcy5mb3JFYWNoKGZ1bmN0aW9uKGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgICB0aGlzW2NvbGxlY3Rpb25OYW1lXSA9IHVuZGVmaW5lZDtcbiAgICB9LmJpbmQodGhpcykpO1xuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XG4gICAgaWYgKHRoaXMuX3N0b3JhZ2UpIHtcbiAgICAgIHJlc2V0U3RvcmFnZSA9IHJlc2V0U3RvcmFnZSA9PT0gdW5kZWZpbmVkID8gdHJ1ZSA6IHJlc2V0U3RvcmFnZTtcbiAgICAgIGlmIChyZXNldFN0b3JhZ2UpIHtcbiAgICAgICAgdGhpcy5fc3RvcmFnZS5fcmVzZXQoY2IsIG5ldyBQb3VjaERCKCdzaWVzdGEnLCB7YXV0b19jb21wYWN0aW9uOiB0cnVlLCBhZGFwdGVyOiAnbWVtb3J5J30pKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBjYigpO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGNiKCk7XG4gICAgfVxuICB9LFxuICAvKipcbiAgICpcbiAgICogQHBhcmFtIG9wdHNcbiAgICogQHBhcmFtIG9wdHMubmFtZSAtIE5hbWUgb2YgdGhlIGNvbnRleHQuXG4gICAqL1xuICBjb250ZXh0OiBmdW5jdGlvbihvcHRzKSB7XG4gICAgdmFyIGNvbnRleHQgPSBuZXcgQ29udGV4dChvcHRzKSxcbiAgICAgIGNvbGxlY3Rpb25OYW1lcyA9IHRoaXMuY29sbGVjdGlvbk5hbWVzLFxuICAgICAgY29sbGVjdGlvbnMgPSB7fTtcbiAgICBjb2xsZWN0aW9uTmFtZXMuZm9yRWFjaChmdW5jdGlvbihjb2xsZWN0aW9uTmFtZSkge1xuICAgICAgdmFyIG5ld0NvbGxlY3Rpb24gPSBjb250ZXh0LmNvbGxlY3Rpb24oY29sbGVjdGlvbk5hbWUpLFxuICAgICAgICBleGlzdGluZ0NvbGxlY3Rpb24gPSB0aGlzLmNvbGxlY3Rpb25zW2NvbGxlY3Rpb25OYW1lXTtcbiAgICAgIGNvbGxlY3Rpb25zW2NvbGxlY3Rpb25OYW1lXSA9IG5ld0NvbGxlY3Rpb247XG5cbiAgICAgIHZhciByYXdNb2RlbHMgPSBleGlzdGluZ0NvbGxlY3Rpb24uX3Jhd01vZGVscztcbiAgICAgIE9iamVjdC5rZXlzKHJhd01vZGVscykuZm9yRWFjaChmdW5jdGlvbihtb2RlbE5hbWUpIHtcbiAgICAgICAgdmFyIHJhd01vZGVsID0gdXRpbC5leHRlbmQoe30sIHJhd01vZGVsc1ttb2RlbE5hbWVdKTtcbiAgICAgICAgcmF3TW9kZWwubmFtZSA9IG1vZGVsTmFtZTtcbiAgICAgICAgdmFyIHJlbGF0aW9uc2hpcHMgPSByYXdNb2RlbC5yZWxhdGlvbnNoaXBzO1xuICAgICAgICBpZiAocmVsYXRpb25zaGlwcykge1xuICAgICAgICAgIE9iamVjdC5rZXlzKHJlbGF0aW9uc2hpcHMpLmZvckVhY2goZnVuY3Rpb24ocmVsTmFtZSkge1xuICAgICAgICAgICAgdmFyIHJlbCA9IHV0aWwuZXh0ZW5kKHt9LCByZWxhdGlvbnNoaXBzW3JlbE5hbWVdKTtcbiAgICAgICAgICAgIGlmIChyZWwubW9kZWwpIHtcbiAgICAgICAgICAgICAgaWYgKHJlbC5tb2RlbCBpbnN0YW5jZW9mIE1vZGVsKSB7XG4gICAgICAgICAgICAgICAgLy8gVGhlIHJhdyBtb2RlbHMgY2Fubm90IHJlZmVyIHRvIE1vZGVscyB0aGF0IGV4aXN0IGluIGRpZmZlcmVudCBjb250ZXh0cy5cbiAgICAgICAgICAgICAgICByZWwubW9kZWwgPSByZWwubW9kZWwubmFtZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVsYXRpb25zaGlwc1tyZWxOYW1lXSA9IHJlbDtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBuZXdDb2xsZWN0aW9uLm1vZGVsKHJhd01vZGVsKTtcbiAgICAgIH0pO1xuICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICByZXR1cm4gY29udGV4dDtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDb250ZXh0O1xuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvQ29udGV4dC5qc1xuICoqIG1vZHVsZSBpZCA9IDNcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsInZhciBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gIGxvZyA9IHJlcXVpcmUoJy4vbG9nJykoJ2V2ZW50cycpLFxuICBBcnJheU9ic2VydmVyID0gcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKS5BcnJheU9ic2VydmVyLFxuICBleHRlbmQgPSByZXF1aXJlKCcuL3V0aWwnKS5leHRlbmQ7XG5cbi8qKlxuICogQ29uc3RhbnRzIHRoYXQgZGVzY3JpYmUgY2hhbmdlIGV2ZW50cy5cbiAqIFNldCA9PiBBIG5ldyB2YWx1ZSBpcyBhc3NpZ25lZCB0byBhbiBhdHRyaWJ1dGUvcmVsYXRpb25zaGlwXG4gKiBTcGxpY2UgPT4gQWxsIGphdmFzY3JpcHQgYXJyYXkgb3BlcmF0aW9ucyBhcmUgZGVzY3JpYmVkIGFzIHNwbGljZXMuXG4gKiBEZWxldGUgPT4gVXNlZCBpbiB0aGUgY2FzZSB3aGVyZSBvYmplY3RzIGFyZSByZW1vdmVkIGZyb20gYW4gYXJyYXksIGJ1dCBhcnJheSBvcmRlciBpcyBub3Qga25vd24gaW4gYWR2YW5jZS5cbiAqIFJlbW92ZSA9PiBPYmplY3QgZGVsZXRpb24gZXZlbnRzXG4gKiBOZXcgPT4gT2JqZWN0IGNyZWF0aW9uIGV2ZW50c1xuICogQHR5cGUge09iamVjdH1cbiAqL1xudmFyIE1vZGVsRXZlbnRUeXBlID0ge1xuICBTZXQ6ICdzZXQnLFxuICBTcGxpY2U6ICdzcGxpY2UnLFxuICBOZXc6ICduZXcnLFxuICBSZW1vdmU6ICdyZW1vdmUnXG59O1xuXG4vKipcbiAqIFJlcHJlc2VudHMgYW4gaW5kaXZpZHVhbCBjaGFuZ2UuXG4gKiBAcGFyYW0gb3B0c1xuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIE1vZGVsRXZlbnQob3B0cykge1xuICB0aGlzLl9vcHRzID0gb3B0cyB8fCB7fTtcbiAgT2JqZWN0LmtleXMob3B0cykuZm9yRWFjaChmdW5jdGlvbihrKSB7XG4gICAgdGhpc1trXSA9IG9wdHNba107XG4gIH0uYmluZCh0aGlzKSk7XG59XG5cbk1vZGVsRXZlbnQucHJvdG90eXBlLl9kdW1wID0gZnVuY3Rpb24ocHJldHR5KSB7XG4gIHZhciBkdW1wZWQgPSB7fTtcbiAgZHVtcGVkLmNvbGxlY3Rpb24gPSAodHlwZW9mIHRoaXMuY29sbGVjdGlvbikgPT0gJ3N0cmluZycgPyB0aGlzLmNvbGxlY3Rpb24gOiB0aGlzLmNvbGxlY3Rpb24uX2R1bXAoKTtcbiAgZHVtcGVkLm1vZGVsID0gKHR5cGVvZiB0aGlzLm1vZGVsKSA9PSAnc3RyaW5nJyA/IHRoaXMubW9kZWwgOiB0aGlzLm1vZGVsLm5hbWU7XG4gIGR1bXBlZC5sb2NhbElkID0gdGhpcy5sb2NhbElkO1xuICBkdW1wZWQuZmllbGQgPSB0aGlzLmZpZWxkO1xuICBkdW1wZWQudHlwZSA9IHRoaXMudHlwZTtcbiAgaWYgKHRoaXMuaW5kZXgpIGR1bXBlZC5pbmRleCA9IHRoaXMuaW5kZXg7XG4gIGlmICh0aGlzLmFkZGVkKSBkdW1wZWQuYWRkZWQgPSB0aGlzLmFkZGVkLm1hcChmdW5jdGlvbih4KSB7cmV0dXJuIHguX2R1bXAoKX0pO1xuICBpZiAodGhpcy5yZW1vdmVkKSBkdW1wZWQucmVtb3ZlZCA9IHRoaXMucmVtb3ZlZC5tYXAoZnVuY3Rpb24oeCkge3JldHVybiB4Ll9kdW1wKCl9KTtcbiAgaWYgKHRoaXMub2xkKSBkdW1wZWQub2xkID0gdGhpcy5vbGQ7XG4gIGlmICh0aGlzLm5ldykgZHVtcGVkLm5ldyA9IHRoaXMubmV3O1xuICByZXR1cm4gcHJldHR5ID8gdXRpbC5wcmV0dHlQcmludChkdW1wZWQpIDogZHVtcGVkO1xufTtcblxuZnVuY3Rpb24gYnJvYWRjYXN0RXZlbnQoY29udGV4dCwgY29sbGVjdGlvbk5hbWUsIG1vZGVsTmFtZSwgb3B0cykge1xuICB2YXIgZ2VuZXJpY0V2ZW50ID0gJ1NpZXN0YScsXG4gICAgY29sbGVjdGlvbiA9IGNvbnRleHQuY29sbGVjdGlvbnNbY29sbGVjdGlvbk5hbWVdLFxuICAgIG1vZGVsID0gY29sbGVjdGlvblttb2RlbE5hbWVdO1xuICBpZiAoIWNvbGxlY3Rpb24pIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdObyBzdWNoIGNvbGxlY3Rpb24gXCInICsgY29sbGVjdGlvbk5hbWUgKyAnXCInKTtcbiAgaWYgKCFtb2RlbCkgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ05vIHN1Y2ggbW9kZWwgXCInICsgbW9kZWxOYW1lICsgJ1wiJyk7XG4gIHZhciBzaG91bGRFbWl0ID0gb3B0cy5vYmouX2VtaXRFdmVudHM7XG4gIC8vIERvbid0IGVtaXQgcG9pbnRsZXNzIGV2ZW50cy5cbiAgaWYgKHNob3VsZEVtaXQgJiYgJ25ldycgaW4gb3B0cyAmJiAnb2xkJyBpbiBvcHRzKSB7XG4gICAgaWYgKG9wdHMubmV3IGluc3RhbmNlb2YgRGF0ZSAmJiBvcHRzLm9sZCBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgIHNob3VsZEVtaXQgPSBvcHRzLm5ldy5nZXRUaW1lKCkgIT0gb3B0cy5vbGQuZ2V0VGltZSgpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHNob3VsZEVtaXQgPSBvcHRzLm5ldyAhPSBvcHRzLm9sZDtcbiAgICB9XG4gIH1cbiAgaWYgKHNob3VsZEVtaXQpIHtcbiAgICBjb250ZXh0LmV2ZW50cy5lbWl0KGdlbmVyaWNFdmVudCwgb3B0cyk7XG4gICAgdmFyIG1vZGVsRXZlbnQgPSBjb2xsZWN0aW9uTmFtZSArICc6JyArIG1vZGVsTmFtZSxcbiAgICAgIGxvY2FsSWRFdmVudCA9IG9wdHMubG9jYWxJZDtcbiAgICBjb250ZXh0LmV2ZW50cy5lbWl0KGNvbGxlY3Rpb25OYW1lLCBvcHRzKTtcbiAgICBjb250ZXh0LmV2ZW50cy5lbWl0KG1vZGVsRXZlbnQsIG9wdHMpO1xuICAgIGNvbnRleHQuZXZlbnRzLmVtaXQobG9jYWxJZEV2ZW50LCBvcHRzKTtcbiAgICBpZiAobW9kZWwuaWQgJiYgb3B0cy5vYmpbbW9kZWwuaWRdKSBjb250ZXh0LmV2ZW50cy5lbWl0KGNvbGxlY3Rpb25OYW1lICsgJzonICsgbW9kZWxOYW1lICsgJzonICsgb3B0cy5vYmpbbW9kZWwuaWRdLCBvcHRzKTtcbiAgfVxufVxuXG5mdW5jdGlvbiB2YWxpZGF0ZUV2ZW50T3B0cyhvcHRzKSB7XG4gIGlmICghb3B0cy5tb2RlbCkgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ011c3QgcGFzcyBhIG1vZGVsJyk7XG4gIGlmICghb3B0cy5jb2xsZWN0aW9uKSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTXVzdCBwYXNzIGEgY29sbGVjdGlvbicpO1xuICBpZiAoIW9wdHMubG9jYWxJZCkgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ011c3QgcGFzcyBhIGxvY2FsIGlkZW50aWZpZXInKTtcbiAgaWYgKCFvcHRzLm9iaikgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ011c3QgcGFzcyB0aGUgb2JqZWN0Jyk7XG59XG5cbmZ1bmN0aW9uIGVtaXQoYXBwLCBvcHRzKSB7XG4gIHZhbGlkYXRlRXZlbnRPcHRzKG9wdHMpO1xuICB2YXIgY29sbGVjdGlvbiA9IG9wdHMuY29sbGVjdGlvbjtcbiAgdmFyIG1vZGVsID0gb3B0cy5tb2RlbDtcbiAgdmFyIGMgPSBuZXcgTW9kZWxFdmVudChvcHRzKTtcbiAgYnJvYWRjYXN0RXZlbnQoYXBwLCBjb2xsZWN0aW9uLCBtb2RlbCwgYyk7XG4gIHJldHVybiBjO1xufVxuXG5leHRlbmQoZXhwb3J0cywge1xuICBNb2RlbEV2ZW50OiBNb2RlbEV2ZW50LFxuICBlbWl0OiBlbWl0LFxuICB2YWxpZGF0ZUV2ZW50T3B0czogdmFsaWRhdGVFdmVudE9wdHMsXG4gIE1vZGVsRXZlbnRUeXBlOiBNb2RlbEV2ZW50VHlwZSxcbiAgd3JhcEFycmF5OiBmdW5jdGlvbihhcnJheSwgZmllbGQsIG1vZGVsSW5zdGFuY2UpIHtcbiAgICBpZiAoIWFycmF5Lm9ic2VydmVyKSB7XG4gICAgICBhcnJheS5vYnNlcnZlciA9IG5ldyBBcnJheU9ic2VydmVyKGFycmF5KTtcbiAgICAgIGFycmF5Lm9ic2VydmVyLm9wZW4oZnVuY3Rpb24oc3BsaWNlcykge1xuICAgICAgICB2YXIgZmllbGRJc0F0dHJpYnV0ZSA9IG1vZGVsSW5zdGFuY2UuX2F0dHJpYnV0ZU5hbWVzLmluZGV4T2YoZmllbGQpID4gLTE7XG4gICAgICAgIGlmIChmaWVsZElzQXR0cmlidXRlKSB7XG4gICAgICAgICAgc3BsaWNlcy5mb3JFYWNoKGZ1bmN0aW9uKHNwbGljZSkge1xuICAgICAgICAgICAgZW1pdChtb2RlbEluc3RhbmNlLmNvbnRleHQsIHtcbiAgICAgICAgICAgICAgY29sbGVjdGlvbjogbW9kZWxJbnN0YW5jZS5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgbW9kZWw6IG1vZGVsSW5zdGFuY2UubW9kZWwubmFtZSxcbiAgICAgICAgICAgICAgbG9jYWxJZDogbW9kZWxJbnN0YW5jZS5sb2NhbElkLFxuICAgICAgICAgICAgICBpbmRleDogc3BsaWNlLmluZGV4LFxuICAgICAgICAgICAgICByZW1vdmVkOiBzcGxpY2UucmVtb3ZlZCxcbiAgICAgICAgICAgICAgYWRkZWQ6IHNwbGljZS5hZGRlZENvdW50ID8gYXJyYXkuc2xpY2Uoc3BsaWNlLmluZGV4LCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCkgOiBbXSxcbiAgICAgICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgICBmaWVsZDogZmllbGQsXG4gICAgICAgICAgICAgIG9iajogbW9kZWxJbnN0YW5jZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufSk7XG5cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vY29yZS9tb2RlbEV2ZW50cy5qc1xuICoqIG1vZHVsZSBpZCA9IDRcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsIi8qKlxuICogRGVhZCBzaW1wbGUgbG9nZ2luZyBzZXJ2aWNlIGJhc2VkIG9uIHZpc2lvbm1lZGlhL2RlYnVnXG4gKiBAbW9kdWxlIGxvZ1xuICovXG5cbnZhciBkZWJ1ZyA9IHJlcXVpcmUoJ2RlYnVnJyksXG4gIGFyZ3NhcnJheSA9IHJlcXVpcmUoJ2FyZ3NhcnJheScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgdmFyIGxvZyA9IGRlYnVnKCdzaWVzdGE6JyArIG5hbWUpO1xuICB2YXIgZm4gPSBhcmdzYXJyYXkoZnVuY3Rpb24oYXJncykge1xuICAgIGxvZy5jYWxsKGxvZywgYXJncyk7XG4gIH0pO1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZm4sICdlbmFibGVkJywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gZGVidWcuZW5hYmxlZChuYW1lKTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gZm47XG59O1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL2xvZy5qc1xuICoqIG1vZHVsZSBpZCA9IDVcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsInZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gIFByb21pc2UgPSByZXF1aXJlKCcuL1Byb21pc2UnKSxcbiAgYXJnc2FycmF5ID0gcmVxdWlyZSgnYXJnc2FycmF5Jyk7XG5cbmZ1bmN0aW9uIENvbmRpdGlvbihmbiwgbGF6eSkge1xuICBpZiAobGF6eSA9PT0gdW5kZWZpbmVkIHx8IGxhenkgPT09IG51bGwpIHtcbiAgICB0aGlzLmxhenkgPSB0cnVlO1xuICB9XG4gIHRoaXMuX2ZuID0gZm4gfHwgZnVuY3Rpb24oZG9uZSkge1xuICAgIGRvbmUoKTtcbiAgfTtcbiAgdGhpcy5yZXNldCgpO1xufVxuXG5Db25kaXRpb24uYWxsID0gYXJnc2FycmF5KGZ1bmN0aW9uKGFyZ3MpIHtcbiAgcmV0dXJuIG5ldyBDb25kaXRpb24oYXJncyk7XG59KTtcblxuQ29uZGl0aW9uLnByb3RvdHlwZSA9IHtcbiAgX2V4ZWN1dGU6IGZ1bmN0aW9uKCkge1xuICAgIGlmICghdGhpcy5leGVjdXRlZCkge1xuICAgICAgdmFyIGRlcGVuZGVudHMgPSB1dGlsLnBsdWNrKHRoaXMuZGVwZW5kZW50LCAnX3Byb21pc2UnKTtcbiAgICAgIFByb21pc2VcbiAgICAgICAgLmFsbChkZXBlbmRlbnRzKVxuICAgICAgICAudGhlbih0aGlzLmZuKVxuICAgICAgICAuY2F0Y2godGhpcy5yZWplY3QuYmluZCh0aGlzKSk7XG4gICAgICB0aGlzLmRlcGVuZGVudC5mb3JFYWNoKGZ1bmN0aW9uKGQpIHtcbiAgICAgICAgZC5fZXhlY3V0ZSgpO1xuICAgICAgfSk7XG4gICAgfVxuICB9LFxuICB0aGVuOiBmdW5jdGlvbihzdWNjZXNzLCBmYWlsKSB7XG4gICAgdGhpcy5fZXhlY3V0ZSgpO1xuICAgIHRoaXMuX3Byb21pc2UudGhlbihzdWNjZXNzLCBmYWlsKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcbiAgY2F0Y2g6IGZ1bmN0aW9uKGZhaWwpIHtcbiAgICB0aGlzLl9leGVjdXRlKCk7XG4gICAgdGhpcy5fcHJvbWlzZS5jYXRjaChmYWlsKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcbiAgcmVzb2x2ZTogZnVuY3Rpb24ocmVzKSB7XG4gICAgdGhpcy5leGVjdXRlZCA9IHRydWU7XG4gICAgdGhpcy5fcHJvbWlzZS5yZXNvbHZlKHJlcyk7XG4gIH0sXG4gIHJlamVjdDogZnVuY3Rpb24oZXJyKSB7XG4gICAgdGhpcy5leGVjdXRlZCA9IHRydWU7XG4gICAgdGhpcy5fcHJvbWlzZS5yZWplY3QoZXJyKTtcbiAgfSxcbiAgZGVwZW5kZW50T246IGZ1bmN0aW9uKGNvbmQpIHtcbiAgICB0aGlzLmRlcGVuZGVudC5wdXNoKGNvbmQpO1xuICB9LFxuICByZXNldDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5fcHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgdGhpcy5yZWplY3QgPSByZWplY3Q7XG4gICAgICB0aGlzLnJlc29sdmUgPSByZXNvbHZlO1xuICAgICAgdGhpcy5mbiA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmV4ZWN1dGVkID0gdHJ1ZTtcbiAgICAgICAgdmFyIG51bUNvbXBsZXRlID0gMDtcbiAgICAgICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICAgICAgdmFyIGVycm9ycyA9IFtdO1xuICAgICAgICBpZiAodXRpbC5pc0FycmF5KHRoaXMuX2ZuKSkge1xuICAgICAgICAgIHZhciBjaGVja0NvbXBsZXRlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBpZiAobnVtQ29tcGxldGUgPT0gdGhpcy5fZm4ubGVuZ3RoKSB7XG4gICAgICAgICAgICAgIGlmIChlcnJvcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KGVycm9ycyk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShyZXN1bHRzKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICAgICAgICB0aGlzXG4gICAgICAgICAgICAuX2ZuXG4gICAgICAgICAgICAuZm9yRWFjaChmdW5jdGlvbihjb25kLCBpZHgpIHtcbiAgICAgICAgICAgICAgY29uZFxuICAgICAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uKHJlcykge1xuICAgICAgICAgICAgICAgICAgcmVzdWx0c1tpZHhdID0gcmVzO1xuICAgICAgICAgICAgICAgICAgbnVtQ29tcGxldGUrKztcbiAgICAgICAgICAgICAgICAgIGNoZWNrQ29tcGxldGUoKTtcbiAgICAgICAgICAgICAgICB9LmJpbmQodGhpcykpXG4gICAgICAgICAgICAgICAgLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgICAgZXJyb3JzW2lkeF0gPSBlcnI7XG4gICAgICAgICAgICAgICAgICBudW1Db21wbGV0ZSsrO1xuICAgICAgICAgICAgICAgICAgY2hlY2tDb21wbGV0ZSgpO1xuICAgICAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICB0aGlzLl9mbihmdW5jdGlvbihlcnIsIHJlcykge1xuICAgICAgICAgICAgaWYgKGVycikgcmVqZWN0KGVycik7XG4gICAgICAgICAgICBlbHNlIHJlc29sdmUocmVzKTtcbiAgICAgICAgICB9LmJpbmQodGhpcykpXG4gICAgICAgIH1cbiAgICAgIH0uYmluZCh0aGlzKVxuICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICBpZiAoIXRoaXMubGF6eSkgdGhpcy5fZXhlY3V0ZSgpO1xuICAgIHRoaXMuZXhlY3V0ZWQgPSBmYWxzZTtcbiAgICB0aGlzLmRlcGVuZGVudCA9IFtdO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IENvbmRpdGlvbjtcblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL0NvbmRpdGlvbi5qc1xuICoqIG1vZHVsZSBpZCA9IDZcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsInZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpKCdtb2RlbCcpLFxuICBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gIFJlbGF0aW9uc2hpcFR5cGUgPSByZXF1aXJlKCcuL1JlbGF0aW9uc2hpcFR5cGUnKSxcbiAgRmlsdGVyID0gcmVxdWlyZSgnLi9GaWx0ZXInKSxcbiAgTWFwcGluZ09wZXJhdGlvbiA9IHJlcXVpcmUoJy4vbWFwcGluZ09wZXJhdGlvbicpLFxuICBNb2RlbEluc3RhbmNlID0gcmVxdWlyZSgnLi9Nb2RlbEluc3RhbmNlJyksXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgYXJnc2FycmF5ID0gcmVxdWlyZSgnYXJnc2FycmF5JyksXG4gIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLFxuICBleHRlbmQgPSByZXF1aXJlKCdleHRlbmQnKSxcbiAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gIENvbmRpdGlvbiA9IHJlcXVpcmUoJy4vQ29uZGl0aW9uJyksXG4gIFByb3h5RXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnLi9Qcm94eUV2ZW50RW1pdHRlcicpLFxuICBQcm9taXNlID0gdXRpbC5Qcm9taXNlLFxuICBTaWVzdGFQcm9taXNlID0gcmVxdWlyZSgnLi9Qcm9taXNlJyksXG4gIFBsYWNlaG9sZGVyID0gcmVxdWlyZSgnLi9QbGFjZWhvbGRlcicpLFxuICBSZWFjdGl2ZUZpbHRlciA9IHJlcXVpcmUoJy4vUmVhY3RpdmVGaWx0ZXInKSxcbiAgSW5zdGFuY2VGYWN0b3J5ID0gcmVxdWlyZSgnLi9pbnN0YW5jZUZhY3RvcnknKTtcblxuLyoqXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9wdHNcbiAqL1xuZnVuY3Rpb24gTW9kZWwob3B0cykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgLy8gVXNlZCB3aGVuIGNyZWF0aW5nIG5ldyBjb250ZXh0cyB3aGVuIG11c3QgY2xvbmUgYWxsIHRoZSBtb2RlbHMvY29sbGVjdGlvbnMgb3ZlciB0byB0aGUgbmV3IG9uZVxuICB0aGlzLl9yYXdPcHRzID0gdXRpbC5leHRlbmQoe30sIG9wdHMgfHwge30pO1xuICB0aGlzLl9vcHRzID0gb3B0cyA/IHV0aWwuZXh0ZW5kKHt9LCBvcHRzKSA6IHt9O1xuXG4gIHV0aWwuZXh0ZW5kRnJvbU9wdHModGhpcywgb3B0cywge1xuICAgIG1ldGhvZHM6IHt9LFxuICAgIGF0dHJpYnV0ZXM6IFtdLFxuICAgIGNvbGxlY3Rpb246IG51bGwsXG4gICAgaWQ6ICdpZCcsXG4gICAgcmVsYXRpb25zaGlwczogW10sXG4gICAgbmFtZTogbnVsbCxcbiAgICBpbmRleGVzOiBbXSxcbiAgICBzaW5nbGV0b246IGZhbHNlLFxuICAgIHN0YXRpY3M6IHRoaXMuaW5zdGFsbFN0YXRpY3MuYmluZCh0aGlzKSxcbiAgICBwcm9wZXJ0aWVzOiB7fSxcbiAgICBpbml0OiBudWxsLFxuICAgIHNlcmlhbGlzZTogbnVsbCxcbiAgICBzZXJpYWxpc2VGaWVsZDogbnVsbCxcbiAgICBzZXJpYWxpc2FibGVGaWVsZHM6IG51bGwsXG4gICAgcmVtb3ZlOiBudWxsLFxuICAgIHBhcnNlQXR0cmlidXRlOiBudWxsXG4gIH0sIGZhbHNlKTtcblxuICBpZiAoIXRoaXMucGFyc2VBdHRyaWJ1dGUpIHtcbiAgICB0aGlzLnBhcnNlQXR0cmlidXRlID0gZnVuY3Rpb24oYXR0ck5hbWUsIHZhbHVlKSB7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuICB9XG5cbiAgdGhpcy5hdHRyaWJ1dGVzID0gTW9kZWwuX3Byb2Nlc3NBdHRyaWJ1dGVzKHRoaXMuYXR0cmlidXRlcyk7XG5cbiAgdGhpcy5fZmFjdG9yeSA9IG5ldyBJbnN0YW5jZUZhY3RvcnkodGhpcyk7XG4gIHRoaXMuX2luc3RhbmNlID0gdGhpcy5fZmFjdG9yeS5faW5zdGFuY2UuYmluZCh0aGlzLl9mYWN0b3J5KTtcblxuICB1dGlsLmV4dGVuZCh0aGlzLCB7XG4gICAgX3JlbGF0aW9uc2hpcHNJbnN0YWxsZWQ6IGZhbHNlLFxuICAgIF9yZXZlcnNlUmVsYXRpb25zaGlwc0luc3RhbGxlZDogZmFsc2UsXG4gICAgY2hpbGRyZW46IFtdXG4gIH0pO1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHRoaXMsIHtcbiAgICBfcmVsYXRpb25zaGlwTmFtZXM6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBPYmplY3Qua2V5cyhzZWxmLnJlbGF0aW9uc2hpcHMpO1xuICAgICAgfSxcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9LFxuICAgIF9hdHRyaWJ1dGVOYW1lczoge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIG5hbWVzID0gW107XG4gICAgICAgIGlmIChzZWxmLmlkKSB7XG4gICAgICAgICAgbmFtZXMucHVzaChzZWxmLmlkKTtcbiAgICAgICAgfVxuICAgICAgICBzZWxmLmF0dHJpYnV0ZXMuZm9yRWFjaChmdW5jdGlvbih4KSB7XG4gICAgICAgICAgbmFtZXMucHVzaCh4Lm5hbWUpXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gbmFtZXM7XG4gICAgICB9LFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0sXG4gICAgaW5zdGFsbGVkOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gc2VsZi5fcmVsYXRpb25zaGlwc0luc3RhbGxlZCAmJiBzZWxmLl9yZXZlcnNlUmVsYXRpb25zaGlwc0luc3RhbGxlZDtcbiAgICAgIH0sXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSxcbiAgICBkZXNjZW5kYW50czoge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHNlbGYuY2hpbGRyZW4ucmVkdWNlKGZ1bmN0aW9uKG1lbW8sIGRlc2NlbmRhbnQpIHtcbiAgICAgICAgICByZXR1cm4gQXJyYXkucHJvdG90eXBlLmNvbmNhdC5jYWxsKG1lbW8sIGRlc2NlbmRhbnQuZGVzY2VuZGFudHMpO1xuICAgICAgICB9LmJpbmQoc2VsZiksIHV0aWwuZXh0ZW5kKFtdLCBzZWxmLmNoaWxkcmVuKSk7XG4gICAgICB9LFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH0sXG4gICAgZGlydHk6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICh0aGlzLmNvbnRleHQuc3RvcmFnZSkge1xuICAgICAgICAgIHZhciB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbiA9IHRoaXMuY29udGV4dC5fc3RvcmFnZS5fdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb24sXG4gICAgICAgICAgICBoYXNoID0gKHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uW3RoaXMuY29sbGVjdGlvbk5hbWVdIHx8IHt9KVt0aGlzLm5hbWVdIHx8IHt9O1xuICAgICAgICAgIHJldHVybiAhIU9iamVjdC5rZXlzKGhhc2gpLmxlbmd0aDtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICB9LFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH0sXG4gICAgY29sbGVjdGlvbk5hbWU6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNvbGxlY3Rpb24ubmFtZTtcbiAgICAgIH0sXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfSxcbiAgICBjb250ZXh0OiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jb2xsZWN0aW9uLmNvbnRleHQ7XG4gICAgICB9XG4gICAgfVxuICB9KTtcbiAgdmFyIGdsb2JhbEV2ZW50TmFtZSA9IHRoaXMuY29sbGVjdGlvbk5hbWUgKyAnOicgKyB0aGlzLm5hbWUsXG4gICAgcHJveGllZCA9IHtcbiAgICAgIGZpbHRlcjogdGhpcy5maWx0ZXIuYmluZCh0aGlzKVxuICAgIH07XG5cbiAgUHJveHlFdmVudEVtaXR0ZXIuY2FsbCh0aGlzLCB0aGlzLmNvbnRleHQsIGdsb2JhbEV2ZW50TmFtZSwgcHJveGllZCk7XG5cbiAgdGhpcy5pbnN0YWxsUmVsYXRpb25zaGlwcygpO1xuICB0aGlzLmluc3RhbGxSZXZlcnNlUmVsYXRpb25zaGlwcygpO1xuXG4gIHRoaXMuX2luZGV4SXNJbnN0YWxsZWQgPSBuZXcgQ29uZGl0aW9uKGZ1bmN0aW9uKGRvbmUpIHtcbiAgICBpZiAodGhpcy5jb250ZXh0LnN0b3JhZ2UpIHtcbiAgICAgIHRoaXMuY29udGV4dC5fc3RvcmFnZS5lbnN1cmVJbmRleEluc3RhbGxlZCh0aGlzLCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgZG9uZShlcnIpO1xuICAgICAgfSk7XG4gICAgfVxuICAgIGVsc2UgZG9uZSgpO1xuICB9LmJpbmQodGhpcykpO1xuXG4gIHRoaXMuX21vZGVsTG9hZGVkRnJvbVN0b3JhZ2UgPSBuZXcgQ29uZGl0aW9uKGZ1bmN0aW9uKGRvbmUpIHtcbiAgICB2YXIgc3RvcmFnZSA9IHRoaXMuY29udGV4dC5zdG9yYWdlO1xuICAgIGlmIChzdG9yYWdlKSB7XG4gICAgICB0aGlzLmNvbnRleHQuX3N0b3JhZ2UubG9hZE1vZGVsKHttb2RlbDogdGhpc30sIGZ1bmN0aW9uKGVycikge1xuICAgICAgICBkb25lKGVycik7XG4gICAgICB9KTtcbiAgICB9XG4gICAgZWxzZSBkb25lKCk7XG4gIH0uYmluZCh0aGlzKSk7XG5cbiAgdGhpcy5fc3RvcmFnZUVuYWJsZWQgPSBuZXcgQ29uZGl0aW9uKFt0aGlzLl9pbmRleElzSW5zdGFsbGVkLCB0aGlzLl9tb2RlbExvYWRlZEZyb21TdG9yYWdlXSk7XG59XG5cbnV0aWwuZXh0ZW5kKE1vZGVsLCB7XG4gIC8qKlxuICAgKiBOb3JtYWxpc2UgYXR0cmlidXRlcyBwYXNzZWQgdmlhIHRoZSBvcHRpb25zIGRpY3Rpb25hcnkuXG4gICAqIEBwYXJhbSBhdHRyaWJ1dGVzXG4gICAqIEByZXR1cm5zIHtBcnJheX1cbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9wcm9jZXNzQXR0cmlidXRlczogZnVuY3Rpb24oYXR0cmlidXRlcykge1xuICAgIHJldHVybiBhdHRyaWJ1dGVzLnJlZHVjZShmdW5jdGlvbihtLCBhKSB7XG4gICAgICBpZiAodHlwZW9mIGEgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgbS5wdXNoKHtcbiAgICAgICAgICBuYW1lOiBhXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIG0ucHVzaChhKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtO1xuICAgIH0sIFtdKVxuICB9LFxuICBpbnN0YWxsOiBmdW5jdGlvbihtb2RlbHMsIGNiKSB7XG4gICAgY2IgPSBjYiB8fCBmdW5jdGlvbigpIHt9O1xuICAgIHJldHVybiBuZXcgU2llc3RhUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgIHZhciBzdG9yYWdlQ29uZGl0aW9ucyA9IG1vZGVscy5tYXAoZnVuY3Rpb24oeCkge3JldHVybiB4Ll9zdG9yYWdlRW5hYmxlZH0pO1xuICAgICAgQ29uZGl0aW9uXG4gICAgICAgIC5hbGxcbiAgICAgICAgLmFwcGx5KENvbmRpdGlvbiwgc3RvcmFnZUNvbmRpdGlvbnMpXG4gICAgICAgIC50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIG1vZGVscy5mb3JFYWNoKGZ1bmN0aW9uKG0pIHtcbiAgICAgICAgICAgIG0uX2luc3RhbGxSZXZlcnNlUGxhY2Vob2xkZXJzKCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgY2IoKTtcbiAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxufSk7XG5cbk1vZGVsLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoUHJveHlFdmVudEVtaXR0ZXIucHJvdG90eXBlKTtcblxudXRpbC5leHRlbmQoTW9kZWwucHJvdG90eXBlLCB7XG4gIGluc3RhbGxTdGF0aWNzOiBmdW5jdGlvbihzdGF0aWNzKSB7XG4gICAgaWYgKHN0YXRpY3MpIHtcbiAgICAgIE9iamVjdC5rZXlzKHN0YXRpY3MpLmZvckVhY2goZnVuY3Rpb24oc3RhdGljTmFtZSkge1xuICAgICAgICBpZiAodGhpc1tzdGF0aWNOYW1lXSkge1xuICAgICAgICAgIGxvZygnU3RhdGljIG1ldGhvZCB3aXRoIG5hbWUgXCInICsgc3RhdGljTmFtZSArICdcIiBhbHJlYWR5IGV4aXN0cy4gSWdub3JpbmcgaXQuJyk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgdGhpc1tzdGF0aWNOYW1lXSA9IHN0YXRpY3Nbc3RhdGljTmFtZV0uYmluZCh0aGlzKTtcbiAgICAgICAgfVxuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG4gICAgcmV0dXJuIHN0YXRpY3M7XG4gIH0sXG4gIF92YWxpZGF0ZVJlbGF0aW9uc2hpcFR5cGU6IGZ1bmN0aW9uKHJlbGF0aW9uc2hpcCkge1xuICAgIGlmICghcmVsYXRpb25zaGlwLnR5cGUpIHtcbiAgICAgIGlmICh0aGlzLnNpbmdsZXRvbikgcmVsYXRpb25zaGlwLnR5cGUgPSBSZWxhdGlvbnNoaXBUeXBlLk9uZVRvT25lO1xuICAgICAgZWxzZSByZWxhdGlvbnNoaXAudHlwZSA9IFJlbGF0aW9uc2hpcFR5cGUuT25lVG9NYW55O1xuICAgIH1cbiAgICBpZiAodGhpcy5zaW5nbGV0b24gJiYgcmVsYXRpb25zaGlwLnR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5NYW55VG9NYW55KVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdTaW5nbGV0b24gbW9kZWwgY2Fubm90IHVzZSBNYW55VG9NYW55IHJlbGF0aW9uc2hpcC4nKTtcbiAgICBpZiAoT2JqZWN0LmtleXMoUmVsYXRpb25zaGlwVHlwZSkuaW5kZXhPZihyZWxhdGlvbnNoaXAudHlwZSkgPCAwKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdSZWxhdGlvbnNoaXAgdHlwZSAnICsgcmVsYXRpb25zaGlwLnR5cGUgKyAnIGRvZXMgbm90IGV4aXN0Jyk7XG4gIH0sXG4gIF9nZXRSZXZlcnNlTW9kZWw6IGZ1bmN0aW9uKHJldmVyc2VOYW1lKSB7XG4gICAgdmFyIHJldmVyc2VNb2RlbDtcbiAgICBpZiAocmV2ZXJzZU5hbWUgaW5zdGFuY2VvZiBNb2RlbCkgcmV2ZXJzZU1vZGVsID0gcmV2ZXJzZU5hbWU7XG4gICAgZWxzZSByZXZlcnNlTW9kZWwgPSB0aGlzLmNvbGxlY3Rpb25bcmV2ZXJzZU5hbWVdO1xuICAgIGlmICghcmV2ZXJzZU1vZGVsKSB7IC8vIE1heSBoYXZlIHVzZWQgQ29sbGVjdGlvbi5Nb2RlbCBmb3JtYXQuXG4gICAgICB2YXIgYXJyID0gcmV2ZXJzZU5hbWUuc3BsaXQoJy4nKTtcbiAgICAgIGlmIChhcnIubGVuZ3RoID09IDIpIHtcbiAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gYXJyWzBdO1xuICAgICAgICByZXZlcnNlTmFtZSA9IGFyclsxXTtcbiAgICAgICAgdmFyIG90aGVyQ29sbGVjdGlvbiA9IHRoaXMuY29udGV4dC5jb2xsZWN0aW9uc1tjb2xsZWN0aW9uTmFtZV07XG4gICAgICAgIGlmIChvdGhlckNvbGxlY3Rpb24pXG4gICAgICAgICAgcmV2ZXJzZU1vZGVsID0gb3RoZXJDb2xsZWN0aW9uW3JldmVyc2VOYW1lXTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJldmVyc2VNb2RlbDtcbiAgfSxcbiAgLyoqXG4gICAqIFJldHVybiB0aGUgcmV2ZXJzZSBtb2RlbCBvciBhIHBsYWNlaG9sZGVyIHRoYXQgd2lsbCBiZSByZXNvbHZlZCBsYXRlci5cbiAgICogQHBhcmFtIGZvcndhcmROYW1lXG4gICAqIEBwYXJhbSByZXZlcnNlTmFtZVxuICAgKiBAcmV0dXJucyB7Kn1cbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9nZXRSZXZlcnNlTW9kZWxPclBsYWNlaG9sZGVyOiBmdW5jdGlvbihmb3J3YXJkTmFtZSwgcmV2ZXJzZU5hbWUpIHtcbiAgICB2YXIgcmV2ZXJzZU1vZGVsID0gdGhpcy5fZ2V0UmV2ZXJzZU1vZGVsKHJldmVyc2VOYW1lKTtcbiAgICByZXR1cm4gcmV2ZXJzZU1vZGVsIHx8IG5ldyBQbGFjZWhvbGRlcih7bmFtZTogcmV2ZXJzZU5hbWUsIHJlZjogdGhpcywgZm9yd2FyZE5hbWU6IGZvcndhcmROYW1lfSk7XG4gIH0sXG4gIC8qKlxuICAgKiBJbnN0YWxsIHJlbGF0aW9uc2hpcHMuIFJldHVybnMgZXJyb3IgaW4gZm9ybSBvZiBzdHJpbmcgaWYgZmFpbHMuXG4gICAqIEByZXR1cm4ge1N0cmluZ3xudWxsfVxuICAgKi9cbiAgaW5zdGFsbFJlbGF0aW9uc2hpcHM6IGZ1bmN0aW9uKCkge1xuICAgIGlmICghdGhpcy5fcmVsYXRpb25zaGlwc0luc3RhbGxlZCkge1xuICAgICAgdmFyIGVyciA9IG51bGw7XG4gICAgICBmb3IgKHZhciBuYW1lIGluIHRoaXMuX29wdHMucmVsYXRpb25zaGlwcykge1xuICAgICAgICBpZiAodGhpcy5fb3B0cy5yZWxhdGlvbnNoaXBzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgICAgdmFyIHJlbGF0aW9uc2hpcCA9IHRoaXMuX29wdHMucmVsYXRpb25zaGlwc1tuYW1lXTtcbiAgICAgICAgICAvLyBJZiBhIHJldmVyc2UgcmVsYXRpb25zaGlwIGlzIGluc3RhbGxlZCBiZWZvcmVoYW5kLCB3ZSBkbyBub3Qgd2FudCB0byBwcm9jZXNzIHRoZW0uXG4gICAgICAgICAgdmFyIGlzRm9yd2FyZCA9ICFyZWxhdGlvbnNoaXAuaXNSZXZlcnNlO1xuICAgICAgICAgIGlmIChpc0ZvcndhcmQpIHtcbiAgICAgICAgICAgIGxvZyh0aGlzLm5hbWUgKyAnOiBjb25maWd1cmluZyByZWxhdGlvbnNoaXAgJyArIG5hbWUsIHJlbGF0aW9uc2hpcCk7XG4gICAgICAgICAgICBpZiAoIShlcnIgPSB0aGlzLl92YWxpZGF0ZVJlbGF0aW9uc2hpcFR5cGUocmVsYXRpb25zaGlwKSkpIHtcbiAgICAgICAgICAgICAgdmFyIHJldmVyc2VNb2RlbE5hbWUgPSByZWxhdGlvbnNoaXAubW9kZWw7XG4gICAgICAgICAgICAgIGlmIChyZXZlcnNlTW9kZWxOYW1lKSB7XG4gICAgICAgICAgICAgICAgdmFyIHJldmVyc2VNb2RlbCA9IHRoaXMuX2dldFJldmVyc2VNb2RlbE9yUGxhY2Vob2xkZXIobmFtZSwgcmV2ZXJzZU1vZGVsTmFtZSk7XG4gICAgICAgICAgICAgICAgdXRpbC5leHRlbmQocmVsYXRpb25zaGlwLCB7XG4gICAgICAgICAgICAgICAgICByZXZlcnNlTW9kZWw6IHJldmVyc2VNb2RlbCxcbiAgICAgICAgICAgICAgICAgIGZvcndhcmRNb2RlbDogdGhpcyxcbiAgICAgICAgICAgICAgICAgIGZvcndhcmROYW1lOiBuYW1lLFxuICAgICAgICAgICAgICAgICAgcmV2ZXJzZU5hbWU6IHJlbGF0aW9uc2hpcC5yZXZlcnNlIHx8ICdyZXZlcnNlXycgKyBuYW1lLFxuICAgICAgICAgICAgICAgICAgaXNSZXZlcnNlOiBmYWxzZVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGRlbGV0ZSByZWxhdGlvbnNoaXAubW9kZWw7XG4gICAgICAgICAgICAgICAgZGVsZXRlIHJlbGF0aW9uc2hpcC5yZXZlcnNlO1xuXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZWxzZSByZXR1cm4gJ011c3QgcGFzcyBtb2RlbCc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdSZWxhdGlvbnNoaXBzIGZvciBcIicgKyB0aGlzLm5hbWUgKyAnXCIgaGF2ZSBhbHJlYWR5IGJlZW4gaW5zdGFsbGVkJyk7XG4gICAgfVxuICAgIGlmICghZXJyKSB0aGlzLl9yZWxhdGlvbnNoaXBzSW5zdGFsbGVkID0gdHJ1ZTtcbiAgICByZXR1cm4gZXJyO1xuICB9LFxuICBfaW5zdGFsbFJldmVyc2U6IGZ1bmN0aW9uKHJlbGF0aW9uc2hpcCkge1xuICAgIHZhciByZXZlcnNlUmVsYXRpb25zaGlwID0gdXRpbC5leHRlbmQoe30sIHJlbGF0aW9uc2hpcCk7XG4gICAgcmV2ZXJzZVJlbGF0aW9uc2hpcC5pc1JldmVyc2UgPSB0cnVlO1xuICAgIHZhciByZXZlcnNlTW9kZWwgPSByZXZlcnNlUmVsYXRpb25zaGlwLnJldmVyc2VNb2RlbDtcbiAgICB2YXIgaXNQbGFjZWhvbGRlciA9IHJldmVyc2VNb2RlbC5pc1BsYWNlaG9sZGVyO1xuICAgIGlmIChpc1BsYWNlaG9sZGVyKSB7XG4gICAgICB2YXIgbW9kZWxOYW1lID0gcmV2ZXJzZVJlbGF0aW9uc2hpcC5yZXZlcnNlTW9kZWwubmFtZTtcbiAgICAgIHJldmVyc2VNb2RlbCA9IHRoaXMuX2dldFJldmVyc2VNb2RlbChtb2RlbE5hbWUpO1xuICAgICAgaWYgKHJldmVyc2VNb2RlbCkge1xuICAgICAgICByZXZlcnNlUmVsYXRpb25zaGlwLnJldmVyc2VNb2RlbCA9IHJldmVyc2VNb2RlbDtcbiAgICAgICAgcmVsYXRpb25zaGlwLnJldmVyc2VNb2RlbCA9IHJldmVyc2VNb2RlbDtcbiAgICAgIH1cbiAgICB9XG5cblxuICAgIGlmIChyZXZlcnNlTW9kZWwpIHtcblxuICAgICAgdmFyIHJldmVyc2VOYW1lID0gcmV2ZXJzZVJlbGF0aW9uc2hpcC5yZXZlcnNlTmFtZSxcbiAgICAgICAgZm9yd2FyZE1vZGVsID0gcmV2ZXJzZVJlbGF0aW9uc2hpcC5mb3J3YXJkTW9kZWw7XG5cbiAgICAgIGlmIChyZXZlcnNlTW9kZWwgIT0gdGhpcyB8fCByZXZlcnNlTW9kZWwgPT0gZm9yd2FyZE1vZGVsKSB7XG4gICAgICAgIGlmIChyZXZlcnNlTW9kZWwuc2luZ2xldG9uKSB7XG4gICAgICAgICAgaWYgKHJldmVyc2VSZWxhdGlvbnNoaXAudHlwZSA9PSBSZWxhdGlvbnNoaXBUeXBlLk1hbnlUb01hbnkpIHRocm93IG5ldyBFcnJvcignU2luZ2xldG9uIG1vZGVsIGNhbm5vdCBiZSByZWxhdGVkIHZpYSByZXZlcnNlIE1hbnlUb01hbnknKTtcbiAgICAgICAgICBpZiAocmV2ZXJzZVJlbGF0aW9uc2hpcC50eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuT25lVG9NYW55KSB0aHJvdyBuZXcgRXJyb3IoJ1NpbmdsZXRvbiBtb2RlbCBjYW5ub3QgYmUgcmVsYXRlZCB2aWEgcmV2ZXJzZSBPbmVUb01hbnknKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocmV2ZXJzZU1vZGVsLnJlbGF0aW9uc2hpcHNbcmV2ZXJzZU5hbWVdKSB7XG4gICAgICAgICAgLy8gV2UgYXJlIG9rIHRvIHJlZGVmaW5lIHJldmVyc2UgcmVsYXRpb25zaGlwcyB3aGVyZWJ5IHRoZSBtb2RlbHMgYXJlIGluIHRoZSBzYW1lIGhpZXJhcmNoeVxuICAgICAgICAgIHZhciBpc0FuY2VzdG9yTW9kZWwgPSByZXZlcnNlTW9kZWwucmVsYXRpb25zaGlwc1tyZXZlcnNlTmFtZV0uZm9yd2FyZE1vZGVsLmlzQW5jZXN0b3JPZih0aGlzKTtcbiAgICAgICAgICB2YXIgaXNEZXNjZW5kZW50TW9kZWwgPSByZXZlcnNlTW9kZWwucmVsYXRpb25zaGlwc1tyZXZlcnNlTmFtZV0uZm9yd2FyZE1vZGVsLmlzRGVzY2VuZGFudE9mKHRoaXMpO1xuICAgICAgICAgIGlmICghaXNBbmNlc3Rvck1vZGVsICYmICFpc0Rlc2NlbmRlbnRNb2RlbCAmJiAhaXNQbGFjZWhvbGRlcikge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdSZXZlcnNlIHJlbGF0aW9uc2hpcCBcIicgKyByZXZlcnNlTmFtZSArICdcIiBhbHJlYWR5IGV4aXN0cyBvbiBtb2RlbCBcIicgKyByZXZlcnNlTW9kZWwubmFtZSArICdcIicpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXZlcnNlTW9kZWwucmVsYXRpb25zaGlwc1tyZXZlcnNlTmFtZV0gPSByZXZlcnNlUmVsYXRpb25zaGlwO1xuICAgICAgfVxuXG4gICAgICB2YXIgZXhpc3RpbmdSZXZlcnNlSW5zdGFuY2VzID0gKHRoaXMuY29udGV4dC5jYWNoZS5fbG9jYWxDYWNoZUJ5VHlwZVtyZXZlcnNlTW9kZWwuY29sbGVjdGlvbk5hbWVdIHx8IHt9KVtyZXZlcnNlTW9kZWwubmFtZV0gfHwge307XG4gICAgICBPYmplY3Qua2V5cyhleGlzdGluZ1JldmVyc2VJbnN0YW5jZXMpLmZvckVhY2goZnVuY3Rpb24obG9jYWxJZCkge1xuICAgICAgICB2YXIgaW5zdGFuY2NlID0gZXhpc3RpbmdSZXZlcnNlSW5zdGFuY2VzW2xvY2FsSWRdO1xuICAgICAgICB0aGlzLl9mYWN0b3J5Ll9pbnN0YWxsUmVsYXRpb25zaGlwKHJldmVyc2VSZWxhdGlvbnNoaXAsIGluc3RhbmNjZSk7XG4gICAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgfVxuICB9LFxuICAvKipcbiAgICogQ3ljbGUgdGhyb3VnaCByZWxhdGlvbnNoaXBzIGFuZCByZXBsYWNlIGFueSBwbGFjZWhvbGRlcnMgd2l0aCB0aGUgYWN0dWFsIG1vZGVscyB3aGVyZSBwb3NzaWJsZS5cbiAgICovXG4gIF9pbnN0YWxsUmV2ZXJzZVBsYWNlaG9sZGVyczogZnVuY3Rpb24oKSB7XG4gICAgZm9yICh2YXIgZm9yd2FyZE5hbWUgaW4gdGhpcy5yZWxhdGlvbnNoaXBzKSB7XG4gICAgICBpZiAodGhpcy5yZWxhdGlvbnNoaXBzLmhhc093blByb3BlcnR5KGZvcndhcmROYW1lKSkge1xuICAgICAgICB2YXIgcmVsYXRpb25zaGlwID0gdGhpcy5yZWxhdGlvbnNoaXBzW2ZvcndhcmROYW1lXTtcbiAgICAgICAgaWYgKHJlbGF0aW9uc2hpcC5yZXZlcnNlTW9kZWwuaXNQbGFjZWhvbGRlcikge1xuICAgICAgICAgIHRoaXMuX2luc3RhbGxSZXZlcnNlKHJlbGF0aW9uc2hpcCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gIGluc3RhbGxSZXZlcnNlUmVsYXRpb25zaGlwczogZnVuY3Rpb24oKSB7XG4gICAgaWYgKCF0aGlzLl9yZXZlcnNlUmVsYXRpb25zaGlwc0luc3RhbGxlZCkge1xuICAgICAgZm9yICh2YXIgZm9yd2FyZE5hbWUgaW4gdGhpcy5yZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgIGlmICh0aGlzLnJlbGF0aW9uc2hpcHMuaGFzT3duUHJvcGVydHkoZm9yd2FyZE5hbWUpKSB7XG4gICAgICAgICAgdGhpcy5faW5zdGFsbFJldmVyc2UodGhpcy5yZWxhdGlvbnNoaXBzW2ZvcndhcmROYW1lXSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuX3JldmVyc2VSZWxhdGlvbnNoaXBzSW5zdGFsbGVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignUmV2ZXJzZSByZWxhdGlvbnNoaXBzIGZvciBcIicgKyB0aGlzLm5hbWUgKyAnXCIgaGF2ZSBhbHJlYWR5IGJlZW4gaW5zdGFsbGVkLicpO1xuICAgIH1cbiAgfSxcbiAgX2ZpbHRlcjogZnVuY3Rpb24oZmlsdGVyKSB7XG4gICAgcmV0dXJuIG5ldyBGaWx0ZXIodGhpcywgZmlsdGVyIHx8IHt9KTtcbiAgfSxcbiAgZmlsdGVyOiBmdW5jdGlvbihmaWx0ZXIsIGNiKSB7XG4gICAgdmFyIGZpbHRlckluc3RhbmNlO1xuICAgIHZhciBwcm9taXNlID0gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgdGhpcy5jb250ZXh0Ll9lbnN1cmVJbnN0YWxsZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICghdGhpcy5zaW5nbGV0b24pIHtcbiAgICAgICAgICBmaWx0ZXJJbnN0YW5jZSA9IHRoaXMuX2ZpbHRlcihmaWx0ZXIpO1xuICAgICAgICAgIHJldHVybiBmaWx0ZXJJbnN0YW5jZS5leGVjdXRlKGNiKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBmaWx0ZXJJbnN0YW5jZSA9IHRoaXMuX2ZpbHRlcih7X19pZ25vcmVJbnN0YWxsZWQ6IHRydWV9KTtcbiAgICAgICAgICBmaWx0ZXJJbnN0YW5jZS5leGVjdXRlKGZ1bmN0aW9uKGVyciwgb2Jqcykge1xuICAgICAgICAgICAgaWYgKGVycikgY2IoZXJyKTtcbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAvLyBDYWNoZSBhIG5ldyBzaW5nbGV0b24gYW5kIHRoZW4gcmVleGVjdXRlIHRoZSBmaWx0ZXJcbiAgICAgICAgICAgICAgZmlsdGVyID0gdXRpbC5leHRlbmQoe30sIGZpbHRlcik7XG4gICAgICAgICAgICAgIGZpbHRlci5fX2lnbm9yZUluc3RhbGxlZCA9IHRydWU7XG4gICAgICAgICAgICAgIGlmICghb2Jqcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmdyYXBoKHt9LCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGZpbHRlckluc3RhbmNlID0gdGhpcy5fZmlsdGVyKGZpbHRlcik7XG4gICAgICAgICAgICAgICAgICAgIGZpbHRlckluc3RhbmNlLmV4ZWN1dGUoY2IpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNiKGVycik7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBmaWx0ZXJJbnN0YW5jZSA9IHRoaXMuX2ZpbHRlcihmaWx0ZXIpO1xuICAgICAgICAgICAgICAgIGZpbHRlckluc3RhbmNlLmV4ZWN1dGUoY2IpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfVxuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgLy8gQnkgd3JhcHBpbmcgdGhlIHByb21pc2UgaW4gYW5vdGhlciBwcm9taXNlIHdlIGNhbiBwdXNoIHRoZSBpbnZvY2F0aW9ucyB0byB0aGUgYm90dG9tIG9mIHRoZSBldmVudCBsb29wIHNvIHRoYXRcbiAgICAvLyBhbnkgZXZlbnQgaGFuZGxlcnMgYWRkZWQgdG8gdGhlIGNoYWluIGFyZSBob25vdXJlZCBzdHJhaWdodCBhd2F5LlxuICAgIHZhciBsaW5rUHJvbWlzZSA9IG5ldyB1dGlsLlByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICBwcm9taXNlLnRoZW4oYXJnc2FycmF5KGZ1bmN0aW9uKGFyZ3MpIHtcbiAgICAgICAgc2V0SW1tZWRpYXRlKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJlc29sdmUuYXBwbHkobnVsbCwgYXJncyk7XG4gICAgICAgIH0pO1xuICAgICAgfSksIGFyZ3NhcnJheShmdW5jdGlvbihhcmdzKSB7XG4gICAgICAgIHNldEltbWVkaWF0ZShmdW5jdGlvbigpIHtcbiAgICAgICAgICByZWplY3QuYXBwbHkobnVsbCwgYXJncyk7XG4gICAgICAgIH0pXG4gICAgICB9KSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdGhpcy5fbGluayh7XG4gICAgICB0aGVuOiBsaW5rUHJvbWlzZS50aGVuLmJpbmQobGlua1Byb21pc2UpLFxuICAgICAgY2F0Y2g6IGxpbmtQcm9taXNlLmNhdGNoLmJpbmQobGlua1Byb21pc2UpLFxuICAgICAgb246IGFyZ3NhcnJheShmdW5jdGlvbihhcmdzKSB7XG4gICAgICAgIHZhciBycSA9IG5ldyBSZWFjdGl2ZUZpbHRlcih0aGlzLl9maWx0ZXIoZmlsdGVyKSk7XG4gICAgICAgIHJxLmluaXQoKTtcbiAgICAgICAgcnEub24uYXBwbHkocnEsIGFyZ3MpO1xuICAgICAgfS5iaW5kKHRoaXMpKVxuICAgIH0pO1xuICB9LFxuICAvKipcbiAgICogT25seSB1c2VkIGluIHRlc3RpbmcgYXQgdGhlIG1vbWVudC5cbiAgICogQHBhcmFtIGZpbHRlclxuICAgKiBAcmV0dXJucyB7UmVhY3RpdmVGaWx0ZXJ9XG4gICAqL1xuICBfcmVhY3RpdmVGaWx0ZXI6IGZ1bmN0aW9uKGZpbHRlcikge1xuICAgIHJldHVybiBuZXcgUmVhY3RpdmVGaWx0ZXIobmV3IEZpbHRlcih0aGlzLCBmaWx0ZXIgfHwge30pKTtcbiAgfSxcbiAgb25lOiBmdW5jdGlvbihvcHRzLCBjYikge1xuICAgIGlmICh0eXBlb2Ygb3B0cyA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICBjYiA9IG9wdHM7XG4gICAgICBvcHRzID0ge307XG4gICAgfVxuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICB0aGlzLmZpbHRlcihvcHRzLCBmdW5jdGlvbihlcnIsIHJlcykge1xuICAgICAgICBpZiAoZXJyKSBjYihlcnIpO1xuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBpZiAocmVzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgIGNiKGVycm9yKCdNb3JlIHRoYW4gb25lIGluc3RhbmNlIHJldHVybmVkIHdoZW4gZXhlY3V0aW5nIGdldCBmaWx0ZXIhJykpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJlcyA9IHJlcy5sZW5ndGggPyByZXNbMF0gOiBudWxsO1xuICAgICAgICAgICAgY2IobnVsbCwgcmVzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gIH0sXG4gIGFsbDogZnVuY3Rpb24oZiwgY2IpIHtcbiAgICBpZiAodHlwZW9mIGYgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY2IgPSBmO1xuICAgICAgZiA9IHt9O1xuICAgIH1cbiAgICBmID0gZiB8fCB7fTtcbiAgICB2YXIgZmlsdGVyID0ge307XG4gICAgaWYgKGYuX19vcmRlcikgZmlsdGVyLl9fb3JkZXIgPSBmLl9fb3JkZXI7XG4gICAgcmV0dXJuIHRoaXMuZmlsdGVyKGYsIGNiKTtcbiAgfSxcbiAgX2F0dHJpYnV0ZURlZmluaXRpb25XaXRoTmFtZTogZnVuY3Rpb24obmFtZSkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5hdHRyaWJ1dGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgYXR0cmlidXRlRGVmaW5pdGlvbiA9IHRoaXMuYXR0cmlidXRlc1tpXTtcbiAgICAgIGlmIChhdHRyaWJ1dGVEZWZpbml0aW9uLm5hbWUgPT0gbmFtZSkgcmV0dXJuIGF0dHJpYnV0ZURlZmluaXRpb247XG4gICAgfVxuICB9LFxuICBfZ3JhcGg6IGZ1bmN0aW9uKGRhdGEsIG9wdHMsIGNiKSB7XG4gICAgdmFyIF9tYXAgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBvdmVycmlkZXMgPSBvcHRzLm92ZXJyaWRlO1xuICAgICAgaWYgKG92ZXJyaWRlcykge1xuICAgICAgICBpZiAodXRpbC5pc0FycmF5KG92ZXJyaWRlcykpIG9wdHMub2JqZWN0cyA9IG92ZXJyaWRlcztcbiAgICAgICAgZWxzZSBvcHRzLm9iamVjdHMgPSBbb3ZlcnJpZGVzXTtcbiAgICAgIH1cbiAgICAgIGRlbGV0ZSBvcHRzLm92ZXJyaWRlO1xuICAgICAgaWYgKHV0aWwuaXNBcnJheShkYXRhKSkge1xuICAgICAgICB0aGlzLl9tYXBCdWxrKGRhdGEsIG9wdHMsIGNiKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX21hcEJ1bGsoW2RhdGFdLCBvcHRzLCBmdW5jdGlvbihlcnIsIG9iamVjdHMpIHtcbiAgICAgICAgICB2YXIgb2JqO1xuICAgICAgICAgIGlmIChvYmplY3RzKSB7XG4gICAgICAgICAgICBpZiAob2JqZWN0cy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgb2JqID0gb2JqZWN0c1swXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZXJyID0gZXJyID8gKHV0aWwuaXNBcnJheShkYXRhKSA/IGVyciA6ICh1dGlsLmlzQXJyYXkoZXJyKSA/IGVyclswXSA6IGVycikpIDogbnVsbDtcbiAgICAgICAgICBjYihlcnIsIG9iaik7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0uYmluZCh0aGlzKTtcbiAgICBfbWFwKCk7XG4gIH0sXG4gIC8qKlxuICAgKiBNYXAgZGF0YSBpbnRvIFNpZXN0YS5cbiAgICpcbiAgICogQHBhcmFtIGRhdGEgUmF3IGRhdGEgcmVjZWl2ZWQgcmVtb3RlbHkgb3Igb3RoZXJ3aXNlXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb258b2JqZWN0fSBbb3B0c11cbiAgICogQHBhcmFtIHtib29sZWFufSBvcHRzLm92ZXJyaWRlXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gb3B0cy5faWdub3JlSW5zdGFsbGVkIC0gQSBoYWNrIHRoYXQgYWxsb3dzIG1hcHBpbmcgb250byBNb2RlbHMgZXZlbiBpZiBpbnN0YWxsIHByb2Nlc3MgaGFzIG5vdCBmaW5pc2hlZC5cbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gW2NiXSBDYWxsZWQgb25jZSBwb3VjaCBwZXJzaXN0ZW5jZSByZXR1cm5zLlxuICAgKi9cbiAgZ3JhcGg6IGZ1bmN0aW9uKGRhdGEsIG9wdHMsIGNiKSB7XG4gICAgaWYgKHR5cGVvZiBvcHRzID09ICdmdW5jdGlvbicpIGNiID0gb3B0cztcbiAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgdGhpc1xuICAgICAgICAuY29udGV4dFxuICAgICAgICAuX2Vuc3VyZUluc3RhbGxlZChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgdGhpcy5fZ3JhcGgoZGF0YSwgb3B0cywgY2IpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNiKGVycik7XG4gICAgICAgICAgfVxuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gIH0sXG4gIF9tYXBCdWxrOiBmdW5jdGlvbihkYXRhLCBvcHRzLCBjYWxsYmFjaykge1xuICAgIHV0aWwuZXh0ZW5kKG9wdHMsIHttb2RlbDogdGhpcywgZGF0YTogZGF0YX0pO1xuICAgIHZhciBvcCA9IG5ldyBNYXBwaW5nT3BlcmF0aW9uKG9wdHMpO1xuICAgIG9wLnN0YXJ0KGZ1bmN0aW9uKGVyciwgb2JqZWN0cykge1xuICAgICAgaWYgKGVycikge1xuICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGVycik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjYWxsYmFjayhudWxsLCBvYmplY3RzIHx8IFtdKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSxcbiAgX2NvdW50Q2FjaGU6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBjb2xsQ2FjaGUgPSB0aGlzLmNvbnRleHQuY2FjaGUuX2xvY2FsQ2FjaGVCeVR5cGVbdGhpcy5jb2xsZWN0aW9uTmFtZV0gfHwge307XG4gICAgdmFyIG1vZGVsQ2FjaGUgPSBjb2xsQ2FjaGVbdGhpcy5uYW1lXSB8fCB7fTtcbiAgICByZXR1cm4gT2JqZWN0LmtleXMobW9kZWxDYWNoZSkucmVkdWNlKGZ1bmN0aW9uKG0sIGxvY2FsSWQpIHtcbiAgICAgIG1bbG9jYWxJZF0gPSB7fTtcbiAgICAgIHJldHVybiBtO1xuICAgIH0sIHt9KTtcbiAgfSxcbiAgY291bnQ6IGZ1bmN0aW9uKGNiKSB7XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgIHRoaXMuY29udGV4dC5fZW5zdXJlSW5zdGFsbGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICBjYihudWxsLCBPYmplY3Qua2V5cyh0aGlzLl9jb3VudENhY2hlKCkpLmxlbmd0aCk7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gIH0sXG4gIF9kdW1wOiBmdW5jdGlvbihhc0pTT04pIHtcbiAgICB2YXIgZHVtcGVkID0ge307XG4gICAgZHVtcGVkLm5hbWUgPSB0aGlzLm5hbWU7XG4gICAgZHVtcGVkLmF0dHJpYnV0ZXMgPSB0aGlzLmF0dHJpYnV0ZXM7XG4gICAgZHVtcGVkLmlkID0gdGhpcy5pZDtcbiAgICBkdW1wZWQuY29sbGVjdGlvbiA9IHRoaXMuY29sbGVjdGlvbk5hbWU7XG4gICAgZHVtcGVkLnJlbGF0aW9uc2hpcHMgPSB0aGlzLnJlbGF0aW9uc2hpcHMubWFwKGZ1bmN0aW9uKHIpIHtcbiAgICAgIHJldHVybiByLmlzRm9yd2FyZCA/IHIuZm9yd2FyZE5hbWUgOiByLnJldmVyc2VOYW1lO1xuICAgIH0pO1xuICAgIHJldHVybiBhc0pTT04gPyB1dGlsLnByZXR0eVByaW50KGR1bXBlZCkgOiBkdW1wZWQ7XG4gIH0sXG4gIHRvU3RyaW5nOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gJ01vZGVsWycgKyB0aGlzLm5hbWUgKyAnXSc7XG4gIH0sXG4gIHJlbW92ZUFsbDogZnVuY3Rpb24oY2IpIHtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgdGhpcy5hbGwoKVxuICAgICAgICAudGhlbihmdW5jdGlvbihpbnN0YW5jZXMpIHtcbiAgICAgICAgICBpbnN0YW5jZXMucmVtb3ZlKCk7XG4gICAgICAgICAgY2IoKTtcbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKGNiKTtcbiAgICB9LmJpbmQodGhpcykpO1xuICB9XG5cbn0pO1xuXG4vLyBTdWJjbGFzc2luZ1xudXRpbC5leHRlbmQoTW9kZWwucHJvdG90eXBlLCB7XG4gIGNoaWxkOiBmdW5jdGlvbihuYW1lT3JPcHRzLCBvcHRzKSB7XG4gICAgaWYgKHR5cGVvZiBuYW1lT3JPcHRzID09ICdzdHJpbmcnKSB7XG4gICAgICBvcHRzLm5hbWUgPSBuYW1lT3JPcHRzO1xuICAgIH0gZWxzZSB7XG4gICAgICBvcHRzID0gbmFtZTtcbiAgICB9XG4gICAgdXRpbC5leHRlbmQob3B0cywge1xuICAgICAgYXR0cmlidXRlczogQXJyYXkucHJvdG90eXBlLmNvbmNhdC5jYWxsKG9wdHMuYXR0cmlidXRlcyB8fCBbXSwgdGhpcy5fb3B0cy5hdHRyaWJ1dGVzKSxcbiAgICAgIHJlbGF0aW9uc2hpcHM6IHV0aWwuZXh0ZW5kKG9wdHMucmVsYXRpb25zaGlwcyB8fCB7fSwgdGhpcy5fb3B0cy5yZWxhdGlvbnNoaXBzKSxcbiAgICAgIG1ldGhvZHM6IHV0aWwuZXh0ZW5kKHV0aWwuZXh0ZW5kKHt9LCB0aGlzLl9vcHRzLm1ldGhvZHMpIHx8IHt9LCBvcHRzLm1ldGhvZHMpLFxuICAgICAgc3RhdGljczogdXRpbC5leHRlbmQodXRpbC5leHRlbmQoe30sIHRoaXMuX29wdHMuc3RhdGljcykgfHwge30sIG9wdHMuc3RhdGljcyksXG4gICAgICBwcm9wZXJ0aWVzOiB1dGlsLmV4dGVuZCh1dGlsLmV4dGVuZCh7fSwgdGhpcy5fb3B0cy5wcm9wZXJ0aWVzKSB8fCB7fSwgb3B0cy5wcm9wZXJ0aWVzKSxcbiAgICAgIGlkOiBvcHRzLmlkIHx8IHRoaXMuX29wdHMuaWQsXG4gICAgICBpbml0OiBvcHRzLmluaXQgfHwgdGhpcy5fb3B0cy5pbml0LFxuICAgICAgcmVtb3ZlOiBvcHRzLnJlbW92ZSB8fCB0aGlzLl9vcHRzLnJlbW92ZSxcbiAgICAgIHNlcmlhbGlzZTogb3B0cy5zZXJpYWxpc2UgfHwgdGhpcy5fb3B0cy5zZXJpYWxpc2UsXG4gICAgICBzZXJpYWxpc2VGaWVsZDogb3B0cy5zZXJpYWxpc2VGaWVsZCB8fCB0aGlzLl9vcHRzLnNlcmlhbGlzZUZpZWxkLFxuICAgICAgcGFyc2VBdHRyaWJ1dGU6IG9wdHMucGFyc2VBdHRyaWJ1dGUgfHwgdGhpcy5fb3B0cy5wYXJzZUF0dHJpYnV0ZVxuICAgIH0pO1xuXG4gICAgaWYgKHRoaXMuX29wdHMuc2VyaWFsaXNhYmxlRmllbGRzKSB7XG4gICAgICBvcHRzLnNlcmlhbGlzYWJsZUZpZWxkcyA9IEFycmF5LnByb3RvdHlwZS5jb25jYXQuYXBwbHkob3B0cy5zZXJpYWxpc2FibGVGaWVsZHMgfHwgW10sIHRoaXMuX29wdHMuc2VyaWFsaXNhYmxlRmllbGRzKTtcbiAgICB9XG5cbiAgICB2YXIgbW9kZWwgPSB0aGlzLmNvbGxlY3Rpb24ubW9kZWwob3B0cy5uYW1lLCBvcHRzKTtcbiAgICBtb2RlbC5wYXJlbnQgPSB0aGlzO1xuICAgIHRoaXMuY2hpbGRyZW4ucHVzaChtb2RlbCk7XG4gICAgcmV0dXJuIG1vZGVsO1xuICB9LFxuICBpc0NoaWxkT2Y6IGZ1bmN0aW9uKHBhcmVudCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudCA9PSBwYXJlbnQ7XG4gIH0sXG4gIGlzUGFyZW50T2Y6IGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgcmV0dXJuIHRoaXMuY2hpbGRyZW4uaW5kZXhPZihjaGlsZCkgPiAtMTtcbiAgfSxcbiAgaXNEZXNjZW5kYW50T2Y6IGZ1bmN0aW9uKGFuY2VzdG9yKSB7XG4gICAgdmFyIHBhcmVudCA9IHRoaXMucGFyZW50O1xuICAgIHdoaWxlIChwYXJlbnQpIHtcbiAgICAgIGlmIChwYXJlbnQgPT0gYW5jZXN0b3IpIHJldHVybiB0cnVlO1xuICAgICAgcGFyZW50ID0gcGFyZW50LnBhcmVudDtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9LFxuICBpc0FuY2VzdG9yT2Y6IGZ1bmN0aW9uKGRlc2NlbmRhbnQpIHtcbiAgICByZXR1cm4gdGhpcy5kZXNjZW5kYW50cy5pbmRleE9mKGRlc2NlbmRhbnQpID4gLTE7XG4gIH0sXG4gIGhhc0F0dHJpYnV0ZU5hbWVkOiBmdW5jdGlvbihhdHRyaWJ1dGVOYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMuX2F0dHJpYnV0ZU5hbWVzLmluZGV4T2YoYXR0cmlidXRlTmFtZSkgPiAtMTtcbiAgfVxufSk7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBNb2RlbDtcblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL21vZGVsLmpzXG4gKiogbW9kdWxlIGlkID0gN1xuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwiLyoqXG4gKiBVc2VycyBzaG91bGQgbmV2ZXIgc2VlIHRoZXNlIHRocm93bi4gQSBidWcgcmVwb3J0IHNob3VsZCBiZSBmaWxlZCBpZiBzbyBhcyBpdCBtZWFucyBzb21lIGFzc2VydGlvbiBoYXMgZmFpbGVkLlxuICogQHBhcmFtIG1lc3NhZ2VcbiAqIEBwYXJhbSBjb250ZXh0XG4gKiBAcGFyYW0gc3NmXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gSW50ZXJuYWxTaWVzdGFFcnJvcihtZXNzYWdlLCBjb250ZXh0LCBzc2YpIHtcbiAgRXJyb3IuY2FsbCh0aGlzLCBtZXNzYWdlLCBjb250ZXh0LCBzc2YpO1xuICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xuICB0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xuICAvLyBjYXB0dXJlIHN0YWNrIHRyYWNlXG4gIGlmIChzc2YgJiYgRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UpIHtcbiAgICBFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCBzc2YpO1xuICB9XG59XG5cbkludGVybmFsU2llc3RhRXJyb3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShFcnJvci5wcm90b3R5cGUpO1xuSW50ZXJuYWxTaWVzdGFFcnJvci5wcm90b3R5cGUubmFtZSA9ICdJbnRlcm5hbFNpZXN0YUVycm9yJztcbkludGVybmFsU2llc3RhRXJyb3IucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gSW50ZXJuYWxTaWVzdGFFcnJvcjtcblxuZnVuY3Rpb24gaXNTaWVzdGFFcnJvcihlcnIpIHtcbiAgaWYgKHR5cGVvZiBlcnIgPT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm4gJ2Vycm9yJyBpbiBlcnIgJiYgJ29rJyBpbiBlcnIgJiYgJ3JlYXNvbicgaW4gZXJyO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihlcnJNZXNzYWdlLCBleHRyYSkge1xuICBpZiAoaXNTaWVzdGFFcnJvcihlcnJNZXNzYWdlKSkge1xuICAgIHJldHVybiBlcnJNZXNzYWdlO1xuICB9XG4gIHZhciBlcnIgPSB7XG4gICAgcmVhc29uOiBlcnJNZXNzYWdlLFxuICAgIGVycm9yOiB0cnVlLFxuICAgIG9rOiBmYWxzZVxuICB9O1xuICBmb3IgKHZhciBwcm9wIGluIGV4dHJhIHx8IHt9KSB7XG4gICAgaWYgKGV4dHJhLmhhc093blByb3BlcnR5KHByb3ApKSBlcnJbcHJvcF0gPSBleHRyYVtwcm9wXTtcbiAgfVxuICBlcnIudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodGhpcyk7XG4gIH07XG4gIHJldHVybiBlcnI7XG59O1xuXG5tb2R1bGUuZXhwb3J0cy5JbnRlcm5hbFNpZXN0YUVycm9yID0gSW50ZXJuYWxTaWVzdGFFcnJvcjtcblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL2Vycm9yLmpzXG4gKiogbW9kdWxlIGlkID0gOFxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwidmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJyksXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgZXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJyksXG4gIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICBNb2RlbEV2ZW50VHlwZSA9IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLFxuICBQcm94eUV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJy4vUHJveHlFdmVudEVtaXR0ZXInKTtcblxuXG5mdW5jdGlvbiBNb2RlbEluc3RhbmNlKG1vZGVsKSB7XG4gIGlmICghbW9kZWwpIHRocm93IG5ldyBFcnJvcignd3RmJyk7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdGhpcy5tb2RlbCA9IG1vZGVsO1xuXG4gIFByb3h5RXZlbnRFbWl0dGVyLmNhbGwodGhpcywgbW9kZWwuY29udGV4dCk7XG5cbiAgdGhpcy5fX3Byb3hpZXMgPSB7fTtcbiAgdGhpcy5fcHJveGllcyA9IFtdO1xuXG4gIHV0aWwuc3ViUHJvcGVydGllcyh0aGlzLCB0aGlzLm1vZGVsLCBbXG4gICAgJ2NvbGxlY3Rpb24nLFxuICAgICdjb2xsZWN0aW9uTmFtZScsXG4gICAgJ19hdHRyaWJ1dGVOYW1lcycsXG4gICAge1xuICAgICAgbmFtZTogJ2lkRmllbGQnLFxuICAgICAgcHJvcGVydHk6ICdpZCdcbiAgICB9LFxuICAgIHtcbiAgICAgIG5hbWU6ICdtb2RlbE5hbWUnLFxuICAgICAgcHJvcGVydHk6ICduYW1lJ1xuICAgIH1cbiAgXSk7XG5cblxuICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyh0aGlzLCB7XG4gICAgX3JlbGF0aW9uc2hpcE5hbWVzOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgcHJveGllcyA9IE9iamVjdC5rZXlzKHNlbGYuX19wcm94aWVzIHx8IHt9KS5tYXAoZnVuY3Rpb24oeCkge1xuICAgICAgICAgIHJldHVybiBzZWxmLl9fcHJveGllc1t4XVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHByb3hpZXMubWFwKGZ1bmN0aW9uKHApIHtcbiAgICAgICAgICBpZiAocC5pc0ZvcndhcmQpIHtcbiAgICAgICAgICAgIHJldHVybiBwLmZvcndhcmROYW1lO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gcC5yZXZlcnNlTmFtZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9LFxuICAgIGRpcnR5OiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAodGhpcy5jb250ZXh0LnN0b3JhZ2UpIHtcbiAgICAgICAgICByZXR1cm4gc2VsZi5sb2NhbElkIGluIHRoaXMuY29udGV4dC5fc3RvcmFnZS5fdW5zYXZlZE9iamVjdHNIYXNoO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgIH0sXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfSxcbiAgICAvLyBUaGlzIGlzIGZvciBQcm94eUV2ZW50RW1pdHRlci5cbiAgICBldmVudDoge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubG9jYWxJZFxuICAgICAgfVxuICAgIH0sXG4gICAgY29udGV4dDoge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubW9kZWwuY29udGV4dDtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuXG4gIHRoaXMucmVtb3ZlZCA9IGZhbHNlO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIG9yIG5vdCBldmVudHMgKHNldCwgcmVtb3ZlIGV0YykgYXJlIGVtaXR0ZWQgZm9yIHRoaXMgbW9kZWwgaW5zdGFuY2UuXG4gICAqXG4gICAqIFRoaXMgaXMgdXNlZCBhcyBhIHdheSBvZiBjb250cm9sbGluZyB3aGF0IGV2ZW50cyBhcmUgZW1pdHRlZCB3aGVuIHRoZSBtb2RlbCBpbnN0YW5jZSBpcyBjcmVhdGVkLiBFLmcuIHdlIGRvbid0XG4gICAqIHdhbnQgdG8gc2VuZCBhIG1ldHJpYyBzaGl0IHRvbiBvZiAnc2V0JyBldmVudHMgaWYgd2UncmUgbmV3bHkgY3JlYXRpbmcgYW4gaW5zdGFuY2UuIFdlIG9ubHkgd2FudCB0byBzZW5kIHRoZVxuICAgKiAnbmV3JyBldmVudCBvbmNlIGNvbnN0cnVjdGVkLlxuICAgKlxuICAgKiBUaGlzIGlzIHByb2JhYmx5IGEgYml0IG9mIGEgaGFjayBhbmQgc2hvdWxkIGJlIHJlbW92ZWQgZXZlbnR1YWxseS5cbiAgICogQHR5cGUge2Jvb2xlYW59XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICB0aGlzLl9lbWl0RXZlbnRzID0gZmFsc2U7XG59XG5cbk1vZGVsSW5zdGFuY2UucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShQcm94eUV2ZW50RW1pdHRlci5wcm90b3R5cGUpO1xuXG51dGlsLmV4dGVuZChNb2RlbEluc3RhbmNlLnByb3RvdHlwZSwge1xuICBnZXQ6IGZ1bmN0aW9uKGNiKSB7XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgIGNiKG51bGwsIHRoaXMpO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gIH0sXG4gIGVtaXQ6IGZ1bmN0aW9uKHR5cGUsIG9wdHMpIHtcbiAgICBpZiAodHlwZW9mIHR5cGUgPT0gJ29iamVjdCcpIG9wdHMgPSB0eXBlO1xuICAgIGVsc2Ugb3B0cy50eXBlID0gdHlwZTtcbiAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICB1dGlsLmV4dGVuZChvcHRzLCB7XG4gICAgICBjb2xsZWN0aW9uOiB0aGlzLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgbW9kZWw6IHRoaXMubW9kZWwubmFtZSxcbiAgICAgIGxvY2FsSWQ6IHRoaXMubG9jYWxJZCxcbiAgICAgIG9iajogdGhpc1xuICAgIH0pO1xuICAgIHRoaXMuY29udGV4dC5icm9hZGNhc3Qob3B0cyk7XG4gIH0sXG4gIHJlbW92ZTogZnVuY3Rpb24oY2IsIG5vdGlmaWNhdGlvbikge1xuICAgIF8uZWFjaCh0aGlzLl9yZWxhdGlvbnNoaXBOYW1lcywgZnVuY3Rpb24obmFtZSkge1xuICAgICAgaWYgKHV0aWwuaXNBcnJheSh0aGlzW25hbWVdKSkge1xuICAgICAgICB0aGlzW25hbWVdID0gW107XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgdGhpc1tuYW1lXSA9IG51bGw7XG4gICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgICBub3RpZmljYXRpb24gPSBub3RpZmljYXRpb24gPT0gbnVsbCA/IHRydWUgOiBub3RpZmljYXRpb247XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgIHRoaXMuY29udGV4dC5jYWNoZS5yZW1vdmUodGhpcyk7XG4gICAgICB0aGlzLnJlbW92ZWQgPSB0cnVlO1xuICAgICAgaWYgKG5vdGlmaWNhdGlvbikge1xuICAgICAgICB0aGlzLmVtaXQobW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuUmVtb3ZlLCB7XG4gICAgICAgICAgb2xkOiB0aGlzXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgdmFyIHJlbW92ZSA9IHRoaXMubW9kZWwucmVtb3ZlO1xuICAgICAgaWYgKHJlbW92ZSkge1xuICAgICAgICB2YXIgcGFyYW1OYW1lcyA9IHV0aWwucGFyYW1OYW1lcyhyZW1vdmUpO1xuICAgICAgICBpZiAocGFyYW1OYW1lcy5sZW5ndGgpIHtcbiAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgcmVtb3ZlLmNhbGwodGhpcywgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICBjYihlcnIsIHNlbGYpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIHJlbW92ZS5jYWxsKHRoaXMpO1xuICAgICAgICAgIGNiKG51bGwsIHRoaXMpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY2IobnVsbCwgdGhpcyk7XG4gICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcbiAgcmVzdG9yZTogZnVuY3Rpb24oY2IpIHtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgdmFyIF9maW5pc2ggPSBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICB0aGlzLmVtaXQobW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuTmV3LCB7XG4gICAgICAgICAgICBuZXc6IHRoaXNcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBjYihlcnIsIHRoaXMpO1xuICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgaWYgKHRoaXMucmVtb3ZlZCkge1xuICAgICAgICB0aGlzLmNvbnRleHQuY2FjaGUuaW5zZXJ0KHRoaXMpO1xuICAgICAgICB0aGlzLnJlbW92ZWQgPSBmYWxzZTtcbiAgICAgICAgdmFyIGluaXQgPSB0aGlzLm1vZGVsLmluaXQ7XG4gICAgICAgIGlmIChpbml0KSB7XG4gICAgICAgICAgdmFyIHBhcmFtTmFtZXMgPSB1dGlsLnBhcmFtTmFtZXMoaW5pdCk7XG4gICAgICAgICAgdmFyIGZyb21TdG9yYWdlID0gdHJ1ZTtcbiAgICAgICAgICBpZiAocGFyYW1OYW1lcy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICBpbml0LmNhbGwodGhpcywgZnJvbVN0b3JhZ2UsIF9maW5pc2gpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGluaXQuY2FsbCh0aGlzLCBmcm9tU3RvcmFnZSk7XG4gICAgICAgICAgICBfZmluaXNoKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIF9maW5pc2goKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0uYmluZCh0aGlzKSk7XG4gIH1cbn0pO1xuXG4vLyBJbnNwZWN0aW9uXG51dGlsLmV4dGVuZChNb2RlbEluc3RhbmNlLnByb3RvdHlwZSwge1xuICBnZXRBdHRyaWJ1dGVzOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdXRpbC5leHRlbmQoe30sIHRoaXMuX192YWx1ZXMpO1xuICB9LFxuICBpc0luc3RhbmNlT2Y6IGZ1bmN0aW9uKG1vZGVsKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwgPT0gbW9kZWw7XG4gIH0sXG4gIGlzQTogZnVuY3Rpb24obW9kZWwpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbCA9PSBtb2RlbCB8fCB0aGlzLm1vZGVsLmlzRGVzY2VuZGFudE9mKG1vZGVsKTtcbiAgfVxufSk7XG5cbi8vIER1bXBcbnV0aWwuZXh0ZW5kKE1vZGVsSW5zdGFuY2UucHJvdG90eXBlLCB7XG4gIF9kdW1wU3RyaW5nOiBmdW5jdGlvbihyZXZlcnNlUmVsYXRpb25zaGlwcykge1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh0aGlzLl9kdW1wKHJldmVyc2VSZWxhdGlvbnNoaXBzLCBudWxsLCA0KSk7XG4gIH0sXG4gIF9kdW1wOiBmdW5jdGlvbihyZXZlcnNlUmVsYXRpb25zaGlwcykge1xuICAgIHZhciBkdW1wZWQgPSB1dGlsLmV4dGVuZCh7fSwgdGhpcy5fX3ZhbHVlcyk7XG4gICAgZHVtcGVkLl9yZXYgPSB0aGlzLl9yZXY7XG4gICAgZHVtcGVkLmxvY2FsSWQgPSB0aGlzLmxvY2FsSWQ7XG4gICAgcmV0dXJuIGR1bXBlZDtcbiAgfVxufSk7XG5cbmZ1bmN0aW9uIGRlZmF1bHRTZXJpYWxpc2VyKGF0dHJOYW1lLCB2YWx1ZSkge1xuICByZXR1cm4gdmFsdWU7XG59XG5cbi8vIFNlcmlhbGlzYXRpb25cbnV0aWwuZXh0ZW5kKE1vZGVsSW5zdGFuY2UucHJvdG90eXBlLCB7XG4gIF9kZWZhdWx0U2VyaWFsaXNlOiBmdW5jdGlvbihvcHRzKSB7XG4gICAgdmFyIHNlcmlhbGlzZWQgPSB7fTtcbiAgICB2YXIgaW5jbHVkZU51bGxBdHRyaWJ1dGVzID0gb3B0cy5pbmNsdWRlTnVsbEF0dHJpYnV0ZXMgIT09IHVuZGVmaW5lZCA/IG9wdHMuaW5jbHVkZU51bGxBdHRyaWJ1dGVzIDogdHJ1ZSxcbiAgICAgIGluY2x1ZGVOdWxsUmVsYXRpb25zaGlwcyA9IG9wdHMuaW5jbHVkZU51bGxSZWxhdGlvbnNoaXBzICE9PSB1bmRlZmluZWQgPyBvcHRzLmluY2x1ZGVOdWxsUmVsYXRpb25zaGlwcyA6IHRydWU7XG4gICAgdmFyIHNlcmlhbGlzYWJsZUZpZWxkcyA9IHRoaXMubW9kZWwuc2VyaWFsaXNhYmxlRmllbGRzIHx8XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVOYW1lcy5jb25jYXQuYXBwbHkodGhpcy5fYXR0cmlidXRlTmFtZXMsIHRoaXMuX3JlbGF0aW9uc2hpcE5hbWVzKS5jb25jYXQodGhpcy5pZCk7XG4gICAgdGhpcy5fYXR0cmlidXRlTmFtZXMuZm9yRWFjaChmdW5jdGlvbihhdHRyTmFtZSkge1xuICAgICAgaWYgKHNlcmlhbGlzYWJsZUZpZWxkcy5pbmRleE9mKGF0dHJOYW1lKSA+IC0xKSB7XG4gICAgICAgIHZhciBhdHRyRGVmaW5pdGlvbiA9IHRoaXMubW9kZWwuX2F0dHJpYnV0ZURlZmluaXRpb25XaXRoTmFtZShhdHRyTmFtZSkgfHwge307XG4gICAgICAgIHZhciBzZXJpYWxpc2VyO1xuICAgICAgICBpZiAoYXR0ckRlZmluaXRpb24uc2VyaWFsaXNlKSBzZXJpYWxpc2VyID0gYXR0ckRlZmluaXRpb24uc2VyaWFsaXNlLmJpbmQodGhpcyk7XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIHZhciBzZXJpYWxpc2VGaWVsZCA9IHRoaXMubW9kZWwuc2VyaWFsaXNlRmllbGQgfHwgZGVmYXVsdFNlcmlhbGlzZXI7XG4gICAgICAgICAgc2VyaWFsaXNlciA9IHNlcmlhbGlzZUZpZWxkLmJpbmQodGhpcywgYXR0ck5hbWUpO1xuICAgICAgICB9XG4gICAgICAgIHZhciB2YWwgPSB0aGlzW2F0dHJOYW1lXTtcbiAgICAgICAgaWYgKHZhbCA9PT0gbnVsbCkge1xuICAgICAgICAgIGlmIChpbmNsdWRlTnVsbEF0dHJpYnV0ZXMpIHtcbiAgICAgICAgICAgIHNlcmlhbGlzZWRbYXR0ck5hbWVdID0gc2VyaWFsaXNlcih2YWwpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh2YWwgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHNlcmlhbGlzZWRbYXR0ck5hbWVdID0gc2VyaWFsaXNlcih2YWwpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgICB0aGlzLl9yZWxhdGlvbnNoaXBOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uKHJlbE5hbWUpIHtcbiAgICAgIGlmIChzZXJpYWxpc2FibGVGaWVsZHMuaW5kZXhPZihyZWxOYW1lKSA+IC0xKSB7XG4gICAgICAgIHZhciB2YWwgPSB0aGlzW3JlbE5hbWVdLFxuICAgICAgICAgIHJlbCA9IHRoaXMubW9kZWwucmVsYXRpb25zaGlwc1tyZWxOYW1lXTtcblxuICAgICAgICBpZiAocmVsICYmICFyZWwuaXNSZXZlcnNlKSB7XG4gICAgICAgICAgdmFyIHNlcmlhbGlzZXI7XG4gICAgICAgICAgaWYgKHJlbC5zZXJpYWxpc2UpIHtcbiAgICAgICAgICAgIHNlcmlhbGlzZXIgPSByZWwuc2VyaWFsaXNlLmJpbmQodGhpcyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdmFyIHNlcmlhbGlzZUZpZWxkID0gdGhpcy5tb2RlbC5zZXJpYWxpc2VGaWVsZDtcbiAgICAgICAgICAgIGlmICghc2VyaWFsaXNlRmllbGQpIHtcbiAgICAgICAgICAgICAgaWYgKHV0aWwuaXNBcnJheSh2YWwpKSB2YWwgPSB1dGlsLnBsdWNrKHZhbCwgdGhpcy5tb2RlbC5pZCk7XG4gICAgICAgICAgICAgIGVsc2UgaWYgKHZhbCkgdmFsID0gdmFsW3RoaXMubW9kZWwuaWRdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc2VyaWFsaXNlRmllbGQgPSBzZXJpYWxpc2VGaWVsZCB8fCBkZWZhdWx0U2VyaWFsaXNlcjtcbiAgICAgICAgICAgIHNlcmlhbGlzZXIgPSBzZXJpYWxpc2VGaWVsZC5iaW5kKHRoaXMsIHJlbE5hbWUpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAodmFsID09PSBudWxsKSB7XG4gICAgICAgICAgICBpZiAoaW5jbHVkZU51bGxSZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgICAgICAgIHNlcmlhbGlzZWRbcmVsTmFtZV0gPSBzZXJpYWxpc2VyKHZhbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2UgaWYgKHV0aWwuaXNBcnJheSh2YWwpKSB7XG4gICAgICAgICAgICBpZiAoKGluY2x1ZGVOdWxsUmVsYXRpb25zaGlwcyAmJiAhdmFsLmxlbmd0aCkgfHwgdmFsLmxlbmd0aCkge1xuICAgICAgICAgICAgICBzZXJpYWxpc2VkW3JlbE5hbWVdID0gc2VyaWFsaXNlcih2YWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIGlmICh2YWwgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgc2VyaWFsaXNlZFtyZWxOYW1lXSA9IHNlcmlhbGlzZXIodmFsKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LmJpbmQodGhpcykpO1xuICAgIHJldHVybiBzZXJpYWxpc2VkO1xuICB9LFxuICBzZXJpYWxpc2U6IGZ1bmN0aW9uKG9wdHMpIHtcbiAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICBpZiAoIXRoaXMubW9kZWwuc2VyaWFsaXNlKSByZXR1cm4gdGhpcy5fZGVmYXVsdFNlcmlhbGlzZShvcHRzKTtcbiAgICBlbHNlIHJldHVybiB0aGlzLm1vZGVsLnNlcmlhbGlzZSh0aGlzLCBvcHRzKTtcbiAgfVxufSk7XG5cbnV0aWwuZXh0ZW5kKE1vZGVsSW5zdGFuY2UucHJvdG90eXBlLCB7XG4gIHNlcmlhbGl6ZTogTW9kZWxJbnN0YW5jZS5wcm90b3R5cGUuc2VyaWFsaXNlXG59KTtcblxudXRpbC5leHRlbmQoTW9kZWxJbnN0YW5jZS5wcm90b3R5cGUsIHtcbiAgLyoqXG4gICAqIEVtaXQgYW4gZXZlbnQgaW5kaWNhdGluZyB0aGF0IHRoaXMgaW5zdGFuY2UgaGFzIGp1c3QgYmVlbiBjcmVhdGVkLlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2VtaXROZXc6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuY29udGV4dC5icm9hZGNhc3Qoe1xuICAgICAgY29sbGVjdGlvbjogdGhpcy5tb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAgIG1vZGVsOiB0aGlzLm1vZGVsLm5hbWUsXG4gICAgICBsb2NhbElkOiB0aGlzLmxvY2FsSWQsXG4gICAgICBuZXc6IHRoaXMsXG4gICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5OZXcsXG4gICAgICBvYmo6IHRoaXNcbiAgICB9KTtcbiAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gTW9kZWxJbnN0YW5jZTtcblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL01vZGVsSW5zdGFuY2UuanNcbiAqKiBtb2R1bGUgaWQgPSA5XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJ2YXIgTW9kZWxJbnN0YW5jZSA9IHJlcXVpcmUoJy4vTW9kZWxJbnN0YW5jZScpLFxuICBsb2cgPSByZXF1aXJlKCcuL2xvZycpKCdncmFwaCcpLFxuICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XG5cbmZ1bmN0aW9uIFNpZXN0YUVycm9yKG9wdHMpIHtcbiAgdGhpcy5vcHRzID0gb3B0cztcbn1cblxuU2llc3RhRXJyb3IucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBKU09OLnN0cmluZ2lmeSh0aGlzLm9wdHMsIG51bGwsIDQpO1xufTtcblxuLyoqXG4gKiBFbmNhcHN1bGF0ZXMgdGhlIGlkZWEgb2YgbWFwcGluZyBhcnJheXMgb2YgZGF0YSBvbnRvIHRoZSBvYmplY3QgZ3JhcGggb3IgYXJyYXlzIG9mIG9iamVjdHMuXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICogQHBhcmFtIG9wdHMubW9kZWxcbiAqIEBwYXJhbSBvcHRzLmRhdGFcbiAqIEBwYXJhbSBvcHRzLm9iamVjdHNcbiAqIEBwYXJhbSBvcHRzLmRpc2FibGVOb3RpZmljYXRpb25zXG4gKi9cbmZ1bmN0aW9uIE1hcHBpbmdPcGVyYXRpb24ob3B0cykge1xuICB0aGlzLl9vcHRzID0gb3B0cztcblxuICB1dGlsLmV4dGVuZEZyb21PcHRzKHRoaXMsIG9wdHMsIHtcbiAgICBtb2RlbDogbnVsbCxcbiAgICBkYXRhOiBudWxsLFxuICAgIG9iamVjdHM6IFtdLFxuICAgIGRpc2FibGVldmVudHM6IGZhbHNlLFxuICAgIF9pZ25vcmVJbnN0YWxsZWQ6IGZhbHNlLFxuICAgIGZyb21TdG9yYWdlOiBmYWxzZVxuICB9KTtcblxuICB1dGlsLmV4dGVuZCh0aGlzLCB7XG4gICAgZXJyb3JzOiBbXSxcbiAgICBzdWJUYXNrUmVzdWx0czoge30sXG4gICAgX25ld09iamVjdHM6IFtdXG4gIH0pO1xuXG4gIHRoaXMubW9kZWwuX2luc3RhbGxSZXZlcnNlUGxhY2Vob2xkZXJzKCk7XG4gIHRoaXMuZGF0YSA9IHRoaXMucHJlcHJvY2Vzc0RhdGEoKTtcbn1cblxudXRpbC5leHRlbmQoTWFwcGluZ09wZXJhdGlvbi5wcm90b3R5cGUsIHtcbiAgbWFwQXR0cmlidXRlczogZnVuY3Rpb24oKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBkYXR1bSA9IHRoaXMuZGF0YVtpXSxcbiAgICAgICAgb2JqZWN0ID0gdGhpcy5vYmplY3RzW2ldO1xuICAgICAgLy8gTm8gcG9pbnQgbWFwcGluZyBvYmplY3Qgb250byBpdHNlbGYuIFRoaXMgaGFwcGVucyBpZiBhIE1vZGVsSW5zdGFuY2UgaXMgcGFzc2VkIGFzIGEgcmVsYXRpb25zaGlwLlxuICAgICAgaWYgKGRhdHVtICE9IG9iamVjdCkge1xuICAgICAgICBpZiAob2JqZWN0KSB7IC8vIElmIG9iamVjdCBpcyBmYWxzeSwgdGhlbiB0aGVyZSB3YXMgYW4gZXJyb3IgbG9va2luZyB1cCB0aGF0IG9iamVjdC9jcmVhdGluZyBpdC5cbiAgICAgICAgICB2YXIgZmllbGRzID0gdGhpcy5tb2RlbC5fYXR0cmlidXRlTmFtZXM7XG4gICAgICAgICAgZmllbGRzLmZvckVhY2goZnVuY3Rpb24oZikge1xuICAgICAgICAgICAgaWYgKGRhdHVtW2ZdICE9PSB1bmRlZmluZWQpIHsgLy8gbnVsbCBpcyBmaW5lXG4gICAgICAgICAgICAgIC8vIElmIGV2ZW50cyBhcmUgZGlzYWJsZWQgd2UgdXBkYXRlIF9fdmFsdWVzIG9iamVjdCBkaXJlY3RseS4gVGhpcyBhdm9pZHMgdHJpZ2dlcmluZ1xuICAgICAgICAgICAgICAvLyBldmVudHMgd2hpY2ggYXJlIGJ1aWx0IGludG8gdGhlIHNldCBmdW5jdGlvbiBvZiB0aGUgcHJvcGVydHkuXG4gICAgICAgICAgICAgIGlmICh0aGlzLmRpc2FibGVldmVudHMpIHtcbiAgICAgICAgICAgICAgICBvYmplY3QuX192YWx1ZXNbZl0gPSBkYXR1bVtmXTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgb2JqZWN0W2ZdID0gZGF0dW1bZl07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICB0aGlzLmVycm9yc1tpXSA9IGU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAvLyBQb3VjaERCIHJldmlzaW9uIChpZiB1c2luZyBzdG9yYWdlIG1vZHVsZSkuXG4gICAgICAgICAgLy8gVE9ETzogQ2FuIHRoaXMgYmUgcHVsbGVkIG91dCBvZiBjb3JlP1xuICAgICAgICAgIGlmIChkYXR1bS5fcmV2KSBvYmplY3QuX3JldiA9IGRhdHVtLl9yZXY7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gIF9tYXA6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgZXJyO1xuICAgIHRoaXMubWFwQXR0cmlidXRlcygpO1xuICAgIHZhciByZWxhdGlvbnNoaXBGaWVsZHMgPSBPYmplY3Qua2V5cyhzZWxmLnN1YlRhc2tSZXN1bHRzKTtcbiAgICByZWxhdGlvbnNoaXBGaWVsZHMuZm9yRWFjaChmdW5jdGlvbihmKSB7XG4gICAgICB2YXIgcmVzID0gc2VsZi5zdWJUYXNrUmVzdWx0c1tmXTtcbiAgICAgIHZhciBpbmRleGVzID0gcmVzLmluZGV4ZXMsXG4gICAgICAgIG9iamVjdHMgPSByZXMub2JqZWN0cztcbiAgICAgIHZhciByZWxhdGVkRGF0YSA9IHNlbGYuZ2V0UmVsYXRlZERhdGEoZikucmVsYXRlZERhdGE7XG4gICAgICB2YXIgdW5mbGF0dGVuZWRPYmplY3RzID0gdXRpbC51bmZsYXR0ZW5BcnJheShvYmplY3RzLCByZWxhdGVkRGF0YSk7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHVuZmxhdHRlbmVkT2JqZWN0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgaWR4ID0gaW5kZXhlc1tpXTtcbiAgICAgICAgLy8gRXJyb3JzIGFyZSBwbHVja2VkIGZyb20gdGhlIHN1Ym9wZXJhdGlvbnMuXG4gICAgICAgIHZhciBlcnJvciA9IHNlbGYuZXJyb3JzW2lkeF07XG4gICAgICAgIGVyciA9IGVycm9yID8gZXJyb3JbZl0gOiBudWxsO1xuICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgIHZhciByZWxhdGVkID0gdW5mbGF0dGVuZWRPYmplY3RzW2ldOyAvLyBDYW4gYmUgYXJyYXkgb3Igc2NhbGFyLlxuICAgICAgICAgIHZhciBvYmplY3QgPSBzZWxmLm9iamVjdHNbaWR4XTtcbiAgICAgICAgICBpZiAob2JqZWN0KSB7XG4gICAgICAgICAgICBlcnIgPSBvYmplY3QuX19wcm94aWVzW2ZdLnNldChyZWxhdGVkLCB7XG4gICAgICAgICAgICAgIGRpc2FibGVldmVudHM6IHNlbGYuZGlzYWJsZWV2ZW50c1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgIGlmICghc2VsZi5lcnJvcnNbaWR4XSkgc2VsZi5lcnJvcnNbaWR4XSA9IHt9O1xuICAgICAgICAgICAgICBzZWxmLmVycm9yc1tpZHhdW2ZdID0gZXJyO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICB9LFxuICAvKipcbiAgICogRmlndXJlIG91dCB3aGljaCBkYXRhIGl0ZW1zIHJlcXVpcmUgYSBjYWNoZSBsb29rdXAuXG4gICAqIEByZXR1cm5zIHt7cmVtb3RlTG9va3VwczogQXJyYXksIGxvY2FsTG9va3VwczogQXJyYXl9fVxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3NvcnRMb29rdXBzOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgcmVtb3RlTG9va3VwcyA9IFtdO1xuICAgIHZhciBsb2NhbExvb2t1cHMgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKCF0aGlzLm9iamVjdHNbaV0pIHtcbiAgICAgICAgdmFyIGxvb2t1cDtcbiAgICAgICAgdmFyIGRhdHVtID0gdGhpcy5kYXRhW2ldO1xuICAgICAgICB2YXIgaXNTY2FsYXIgPSB0eXBlb2YgZGF0dW0gPT0gJ3N0cmluZycgfHwgdHlwZW9mIGRhdHVtID09ICdudW1iZXInIHx8IGRhdHVtIGluc3RhbmNlb2YgU3RyaW5nO1xuICAgICAgICBpZiAoZGF0dW0pIHtcbiAgICAgICAgICBpZiAoaXNTY2FsYXIpIHtcbiAgICAgICAgICAgIGxvb2t1cCA9IHtcbiAgICAgICAgICAgICAgaW5kZXg6IGksXG4gICAgICAgICAgICAgIGRhdHVtOiB7fVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGxvb2t1cC5kYXR1bVt0aGlzLm1vZGVsLmlkXSA9IGRhdHVtO1xuICAgICAgICAgICAgcmVtb3RlTG9va3Vwcy5wdXNoKGxvb2t1cCk7XG4gICAgICAgICAgfSBlbHNlIGlmIChkYXR1bSBpbnN0YW5jZW9mIE1vZGVsSW5zdGFuY2UpIHsgLy8gV2Ugd29uJ3QgbmVlZCB0byBwZXJmb3JtIGFueSBtYXBwaW5nLlxuICAgICAgICAgICAgdGhpcy5vYmplY3RzW2ldID0gZGF0dW07XG4gICAgICAgICAgfSBlbHNlIGlmIChkYXR1bS5sb2NhbElkKSB7XG4gICAgICAgICAgICBsb2NhbExvb2t1cHMucHVzaCh7XG4gICAgICAgICAgICAgIGluZGV4OiBpLFxuICAgICAgICAgICAgICBkYXR1bTogZGF0dW1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0gZWxzZSBpZiAoZGF0dW1bdGhpcy5tb2RlbC5pZF0pIHtcbiAgICAgICAgICAgIHJlbW90ZUxvb2t1cHMucHVzaCh7XG4gICAgICAgICAgICAgIGluZGV4OiBpLFxuICAgICAgICAgICAgICBkYXR1bTogZGF0dW1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLm9iamVjdHNbaV0gPSB0aGlzLl9pbnN0YW5jZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLm9iamVjdHNbaV0gPSBudWxsO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7cmVtb3RlTG9va3VwczogcmVtb3RlTG9va3VwcywgbG9jYWxMb29rdXBzOiBsb2NhbExvb2t1cHN9O1xuICB9LFxuICBfcGVyZm9ybUxvY2FsTG9va3VwczogZnVuY3Rpb24obG9jYWxMb29rdXBzKSB7XG4gICAgdmFyIGNhY2hlID0gdGhpcy5tb2RlbC5jb250ZXh0LmNhY2hlO1xuICAgIHZhciBsb2NhbElkZW50aWZpZXJzID0gdXRpbC5wbHVjayh1dGlsLnBsdWNrKGxvY2FsTG9va3VwcywgJ2RhdHVtJyksICdsb2NhbElkJyksXG4gICAgICBsb2NhbE9iamVjdHMgPSBjYWNoZS5nZXRWaWFMb2NhbElkKGxvY2FsSWRlbnRpZmllcnMpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbG9jYWxJZGVudGlmaWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIG9iaiA9IGxvY2FsT2JqZWN0c1tpXTtcbiAgICAgIHZhciBsb2NhbElkID0gbG9jYWxJZGVudGlmaWVyc1tpXTtcbiAgICAgIHZhciBsb29rdXAgPSBsb2NhbExvb2t1cHNbaV07XG4gICAgICBpZiAoIW9iaikge1xuICAgICAgICAvLyBJZiB0aGVyZSBhcmUgbXVsdGlwbGUgbWFwcGluZyBvcGVyYXRpb25zIGdvaW5nIG9uLCB0aGVyZSBtYXkgYmVcbiAgICAgICAgb2JqID0gY2FjaGUuZ2V0KHtsb2NhbElkOiBsb2NhbElkfSk7XG4gICAgICAgIGlmICghb2JqKSBvYmogPSB0aGlzLl9pbnN0YW5jZSh7bG9jYWxJZDogbG9jYWxJZH0sICF0aGlzLmRpc2FibGVldmVudHMpO1xuICAgICAgICB0aGlzLm9iamVjdHNbbG9va3VwLmluZGV4XSA9IG9iajtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMub2JqZWN0c1tsb29rdXAuaW5kZXhdID0gb2JqO1xuICAgICAgfVxuICAgIH1cblxuICB9LFxuICBfcGVyZm9ybVJlbW90ZUxvb2t1cHM6IGZ1bmN0aW9uKHJlbW90ZUxvb2t1cHMpIHtcbiAgICB2YXIgY2FjaGUgPSB0aGlzLm1vZGVsLmNvbnRleHQuY2FjaGU7XG4gICAgdmFyIHJlbW90ZUlkZW50aWZpZXJzID0gdXRpbC5wbHVjayh1dGlsLnBsdWNrKHJlbW90ZUxvb2t1cHMsICdkYXR1bScpLCB0aGlzLm1vZGVsLmlkKSxcbiAgICAgIHJlbW90ZU9iamVjdHMgPSBjYWNoZS5nZXRWaWFSZW1vdGVJZChyZW1vdGVJZGVudGlmaWVycywge21vZGVsOiB0aGlzLm1vZGVsfSk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZW1vdGVPYmplY3RzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgb2JqID0gcmVtb3RlT2JqZWN0c1tpXSxcbiAgICAgICAgbG9va3VwID0gcmVtb3RlTG9va3Vwc1tpXTtcbiAgICAgIGlmIChvYmopIHtcbiAgICAgICAgdGhpcy5vYmplY3RzW2xvb2t1cC5pbmRleF0gPSBvYmo7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgZGF0YSA9IHt9O1xuICAgICAgICB2YXIgcmVtb3RlSWQgPSByZW1vdGVJZGVudGlmaWVyc1tpXTtcbiAgICAgICAgZGF0YVt0aGlzLm1vZGVsLmlkXSA9IHJlbW90ZUlkO1xuICAgICAgICB2YXIgY2FjaGVRdWVyeSA9IHtcbiAgICAgICAgICBtb2RlbDogdGhpcy5tb2RlbFxuICAgICAgICB9O1xuICAgICAgICBjYWNoZVF1ZXJ5W3RoaXMubW9kZWwuaWRdID0gcmVtb3RlSWQ7XG4gICAgICAgIHZhciBjYWNoZWQgPSBjYWNoZS5nZXQoY2FjaGVRdWVyeSk7XG4gICAgICAgIGlmIChjYWNoZWQpIHtcbiAgICAgICAgICB0aGlzLm9iamVjdHNbbG9va3VwLmluZGV4XSA9IGNhY2hlZDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLm9iamVjdHNbbG9va3VwLmluZGV4XSA9IHRoaXMuX2luc3RhbmNlKCk7XG4gICAgICAgICAgLy8gSXQncyBpbXBvcnRhbnQgdGhhdCB3ZSBtYXAgdGhlIHJlbW90ZSBpZGVudGlmaWVyIGhlcmUgdG8gZW5zdXJlIHRoYXQgaXQgZW5kc1xuICAgICAgICAgIC8vIHVwIGluIHRoZSBjYWNoZS5cbiAgICAgICAgICB0aGlzLm9iamVjdHNbbG9va3VwLmluZGV4XVt0aGlzLm1vZGVsLmlkXSA9IHJlbW90ZUlkO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAvKipcbiAgICogRm9yIGluZGljZXMgd2hlcmUgbm8gb2JqZWN0IGlzIHByZXNlbnQsIHBlcmZvcm0gY2FjaGUgbG9va3VwcywgY3JlYXRpbmcgYSBuZXcgb2JqZWN0IGlmIG5lY2Vzc2FyeS5cbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9sb29rdXA6IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLm1vZGVsLnNpbmdsZXRvbikge1xuICAgICAgdGhpcy5fbG9va3VwU2luZ2xldG9uKCk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdmFyIGxvb2t1cHMgPSB0aGlzLl9zb3J0TG9va3VwcygpLFxuICAgICAgICByZW1vdGVMb29rdXBzID0gbG9va3Vwcy5yZW1vdGVMb29rdXBzLFxuICAgICAgICBsb2NhbExvb2t1cHMgPSBsb29rdXBzLmxvY2FsTG9va3VwcztcbiAgICAgIHRoaXMuX3BlcmZvcm1Mb2NhbExvb2t1cHMobG9jYWxMb29rdXBzKTtcbiAgICAgIHRoaXMuX3BlcmZvcm1SZW1vdGVMb29rdXBzKHJlbW90ZUxvb2t1cHMpO1xuICAgIH1cbiAgfSxcbiAgX2xvb2t1cFNpbmdsZXRvbjogZnVuY3Rpb24oKSB7XG4gICAgLy8gUGljayBhIHJhbmRvbSBsb2NhbElkIGZyb20gdGhlIGFycmF5IG9mIGRhdGEgYmVpbmcgbWFwcGVkIG9udG8gdGhlIHNpbmdsZXRvbiBvYmplY3QuIE5vdGUgdGhhdCB0aGV5IHNob3VsZFxuICAgIC8vIGFsd2F5cyBiZSB0aGUgc2FtZS4gVGhpcyBpcyBqdXN0IGEgcHJlY2F1dGlvbi5cbiAgICB2YXIgbG9jYWxJZGVudGlmaWVycyA9IHV0aWwucGx1Y2sodGhpcy5kYXRhLCAnbG9jYWxJZCcpLCBsb2NhbElkO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsb2NhbElkZW50aWZpZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAobG9jYWxJZGVudGlmaWVyc1tpXSkge1xuICAgICAgICBsb2NhbElkID0ge2xvY2FsSWQ6IGxvY2FsSWRlbnRpZmllcnNbaV19O1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gVGhlIG1hcHBpbmcgb3BlcmF0aW9uIGlzIHJlc3BvbnNpYmxlIGZvciBjcmVhdGluZyBzaW5nbGV0b24gaW5zdGFuY2VzIGlmIHRoZXkgZG8gbm90IGFscmVhZHkgZXhpc3QuXG4gICAgdmFyIHNpbmdsZXRvbiA9IHRoaXMubW9kZWwuY29udGV4dC5jYWNoZS5nZXRTaW5nbGV0b24odGhpcy5tb2RlbCkgfHwgdGhpcy5faW5zdGFuY2UobG9jYWxJZCk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgIHRoaXMub2JqZWN0c1tpXSA9IHNpbmdsZXRvbjtcbiAgICB9XG4gIH0sXG4gIF9pbnN0YW5jZTogZnVuY3Rpb24oKSB7XG4gICAgdmFyIG1vZGVsID0gdGhpcy5tb2RlbCxcbiAgICAgIG1vZGVsSW5zdGFuY2UgPSBtb2RlbC5faW5zdGFuY2UuYXBwbHkobW9kZWwsIGFyZ3VtZW50cyk7XG4gICAgdGhpcy5fbmV3T2JqZWN0cy5wdXNoKG1vZGVsSW5zdGFuY2UpO1xuICAgIHJldHVybiBtb2RlbEluc3RhbmNlO1xuICB9LFxuXG4gIHByZXByb2Nlc3NEYXRhOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgZGF0YSA9IHV0aWwuZXh0ZW5kKFtdLCB0aGlzLmRhdGEpO1xuICAgIHJldHVybiBkYXRhLm1hcChmdW5jdGlvbihkYXR1bSkge1xuICAgICAgaWYgKGRhdHVtKSB7XG4gICAgICAgIGlmICghdXRpbC5pc1N0cmluZyhkYXR1bSkpIHtcbiAgICAgICAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKGRhdHVtKTtcbiAgICAgICAgICBrZXlzLmZvckVhY2goZnVuY3Rpb24oaykge1xuICAgICAgICAgICAgdmFyIGlzUmVsYXRpb25zaGlwID0gdGhpcy5tb2RlbC5fcmVsYXRpb25zaGlwTmFtZXMuaW5kZXhPZihrKSA+IC0xO1xuXG4gICAgICAgICAgICBpZiAoaXNSZWxhdGlvbnNoaXApIHtcbiAgICAgICAgICAgICAgdmFyIHZhbCA9IGRhdHVtW2tdO1xuICAgICAgICAgICAgICBpZiAodmFsIGluc3RhbmNlb2YgTW9kZWxJbnN0YW5jZSkge1xuICAgICAgICAgICAgICAgIGRhdHVtW2tdID0ge2xvY2FsSWQ6IHZhbC5sb2NhbElkfTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIGRhdHVtO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gIH0sXG4gIHN0YXJ0OiBmdW5jdGlvbihkb25lKSB7XG4gICAgdmFyIGRhdGEgPSB0aGlzLmRhdGE7XG4gICAgaWYgKGRhdGEubGVuZ3RoKSB7XG4gICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICB2YXIgdGFza3MgPSBbXTtcbiAgICAgIHRoaXMuX2xvb2t1cCgpO1xuICAgICAgdGFza3MucHVzaCh0aGlzLl9leGVjdXRlU3ViT3BlcmF0aW9ucy5iaW5kKHRoaXMpKTtcbiAgICAgIHV0aWwucGFyYWxsZWwodGFza3MsIGZ1bmN0aW9uKGVycikge1xuICAgICAgICBpZiAoZXJyKSBjb25zb2xlLmVycm9yKGVycik7XG5cbiAgICAgICAgc2VsZi5fbWFwKCk7XG4gICAgICAgIC8vIFVzZXJzIGFyZSBhbGxvd2VkIHRvIGFkZCBhIGN1c3RvbSBpbml0IG1ldGhvZCB0byB0aGUgbWV0aG9kcyBvYmplY3Qgd2hlbiBkZWZpbmluZyBhIE1vZGVsLCBvZiB0aGUgZm9ybTpcbiAgICAgICAgLy9cbiAgICAgICAgLy9cbiAgICAgICAgLy8gaW5pdDogZnVuY3Rpb24gKFtkb25lXSkge1xuICAgICAgICAvLyAgICAgLy8gLi4uXG4gICAgICAgIC8vICB9XG4gICAgICAgIC8vXG4gICAgICAgIC8vXG4gICAgICAgIC8vIElmIGRvbmUgaXMgcGFzc2VkLCB0aGVuIF9faW5pdCBtdXN0IGJlIGV4ZWN1dGVkIGFzeW5jaHJvbm91c2x5LCBhbmQgdGhlIG1hcHBpbmcgb3BlcmF0aW9uIHdpbGwgbm90XG4gICAgICAgIC8vIGZpbmlzaCB1bnRpbCBhbGwgaW5pdHMgaGF2ZSBleGVjdXRlZC5cbiAgICAgICAgLy9cbiAgICAgICAgLy8gSGVyZSB3ZSBlbnN1cmUgdGhlIGV4ZWN1dGlvbiBvZiBhbGwgb2YgdGhlbVxuICAgICAgICB2YXIgZnJvbVN0b3JhZ2UgPSB0aGlzLmZyb21TdG9yYWdlO1xuICAgICAgICB2YXIgaW5pdFRhc2tzID0gc2VsZi5fbmV3T2JqZWN0cy5yZWR1Y2UoZnVuY3Rpb24obWVtbywgbykge1xuICAgICAgICAgIHZhciBpbml0ID0gby5tb2RlbC5pbml0O1xuICAgICAgICAgIGlmIChpbml0KSB7XG4gICAgICAgICAgICB2YXIgcGFyYW1OYW1lcyA9IHV0aWwucGFyYW1OYW1lcyhpbml0KTtcbiAgICAgICAgICAgIGlmIChwYXJhbU5hbWVzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgbWVtby5wdXNoKGluaXQuYmluZChvLCBmcm9tU3RvcmFnZSwgZG9uZSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIGluaXQuY2FsbChvLCBmcm9tU3RvcmFnZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIG8uX2VtaXRFdmVudHMgPSB0cnVlO1xuICAgICAgICAgIG8uX2VtaXROZXcoKTtcbiAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgfSwgW10pO1xuICAgICAgICB1dGlsLnBhcmFsbGVsKGluaXRUYXNrcywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgZG9uZShzZWxmLmVycm9ycy5sZW5ndGggPyBzZWxmLmVycm9ycyA6IG51bGwsIHNlbGYub2JqZWN0cyk7XG4gICAgICAgIH0pO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZG9uZShudWxsLCBbXSk7XG4gICAgfVxuXG4gIH0sXG4gIGdldFJlbGF0ZWREYXRhOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIGluZGV4ZXMgPSBbXTtcbiAgICB2YXIgcmVsYXRlZERhdGEgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGRhdHVtID0gdGhpcy5kYXRhW2ldO1xuICAgICAgaWYgKGRhdHVtKSB7XG4gICAgICAgIHZhciB2YWwgPSBkYXR1bVtuYW1lXTtcbiAgICAgICAgaWYgKHZhbCkge1xuICAgICAgICAgIGluZGV4ZXMucHVzaChpKTtcbiAgICAgICAgICByZWxhdGVkRGF0YS5wdXNoKHZhbCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIGluZGV4ZXM6IGluZGV4ZXMsXG4gICAgICByZWxhdGVkRGF0YTogcmVsYXRlZERhdGFcbiAgICB9O1xuICB9LFxuICBwcm9jZXNzRXJyb3JzRnJvbVRhc2s6IGZ1bmN0aW9uKHJlbGF0aW9uc2hpcE5hbWUsIGVycm9ycywgaW5kZXhlcykge1xuICAgIGlmIChlcnJvcnMubGVuZ3RoKSB7XG4gICAgICB2YXIgcmVsYXRlZERhdGEgPSB0aGlzLmdldFJlbGF0ZWREYXRhKHJlbGF0aW9uc2hpcE5hbWUpLnJlbGF0ZWREYXRhO1xuICAgICAgdmFyIHVuZmxhdHRlbmVkRXJyb3JzID0gdXRpbC51bmZsYXR0ZW5BcnJheShlcnJvcnMsIHJlbGF0ZWREYXRhKTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdW5mbGF0dGVuZWRFcnJvcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGlkeCA9IGluZGV4ZXNbaV07XG4gICAgICAgIHZhciBlcnIgPSB1bmZsYXR0ZW5lZEVycm9yc1tpXTtcbiAgICAgICAgdmFyIGlzRXJyb3IgPSBlcnI7XG4gICAgICAgIGlmICh1dGlsLmlzQXJyYXkoZXJyKSkgaXNFcnJvciA9IGVyci5yZWR1Y2UoZnVuY3Rpb24obWVtbywgeCkge1xuICAgICAgICAgIHJldHVybiBtZW1vIHx8IHhcbiAgICAgICAgfSwgZmFsc2UpO1xuICAgICAgICBpZiAoaXNFcnJvcikge1xuICAgICAgICAgIGlmICghdGhpcy5lcnJvcnNbaWR4XSkgdGhpcy5lcnJvcnNbaWR4XSA9IHt9O1xuICAgICAgICAgIHRoaXMuZXJyb3JzW2lkeF1bcmVsYXRpb25zaGlwTmFtZV0gPSBlcnI7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gIF9leGVjdXRlU3ViT3BlcmF0aW9uczogZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICB2YXIgc2VsZiA9IHRoaXMsXG4gICAgICByZWxhdGlvbnNoaXBOYW1lcyA9IE9iamVjdC5rZXlzKHRoaXMubW9kZWwucmVsYXRpb25zaGlwcyk7XG4gICAgaWYgKHJlbGF0aW9uc2hpcE5hbWVzLmxlbmd0aCkge1xuICAgICAgdmFyIHRhc2tzID0gcmVsYXRpb25zaGlwTmFtZXMucmVkdWNlKGZ1bmN0aW9uKG0sIHJlbGF0aW9uc2hpcE5hbWUpIHtcbiAgICAgICAgdmFyIHJlbGF0aW9uc2hpcCA9IHNlbGYubW9kZWwucmVsYXRpb25zaGlwc1tyZWxhdGlvbnNoaXBOYW1lXTtcbiAgICAgICAgdmFyIHJldmVyc2VNb2RlbCA9IHJlbGF0aW9uc2hpcC5mb3J3YXJkTmFtZSA9PSByZWxhdGlvbnNoaXBOYW1lID8gcmVsYXRpb25zaGlwLnJldmVyc2VNb2RlbCA6IHJlbGF0aW9uc2hpcC5mb3J3YXJkTW9kZWw7XG4gICAgICAgIC8vIE1vY2sgYW55IG1pc3Npbmcgc2luZ2xldG9uIGRhdGEgdG8gZW5zdXJlIHRoYXQgYWxsIHNpbmdsZXRvbiBpbnN0YW5jZXMgYXJlIGNyZWF0ZWQuXG4gICAgICAgIGlmIChyZXZlcnNlTW9kZWwuc2luZ2xldG9uICYmICFyZWxhdGlvbnNoaXAuaXNSZXZlcnNlKSB7XG4gICAgICAgICAgdGhpcy5kYXRhLmZvckVhY2goZnVuY3Rpb24oZGF0dW0pIHtcbiAgICAgICAgICAgIGlmICghZGF0dW1bcmVsYXRpb25zaGlwTmFtZV0pIGRhdHVtW3JlbGF0aW9uc2hpcE5hbWVdID0ge307XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIF9fcmV0ID0gdGhpcy5nZXRSZWxhdGVkRGF0YShyZWxhdGlvbnNoaXBOYW1lKSxcbiAgICAgICAgICBpbmRleGVzID0gX19yZXQuaW5kZXhlcyxcbiAgICAgICAgICByZWxhdGVkRGF0YSA9IF9fcmV0LnJlbGF0ZWREYXRhO1xuICAgICAgICBpZiAocmVsYXRlZERhdGEubGVuZ3RoKSB7XG4gICAgICAgICAgdmFyIGZsYXRSZWxhdGVkRGF0YSA9IHV0aWwuZmxhdHRlbkFycmF5KHJlbGF0ZWREYXRhKTtcbiAgICAgICAgICB2YXIgb3AgPSBuZXcgTWFwcGluZ09wZXJhdGlvbih7XG4gICAgICAgICAgICBtb2RlbDogcmV2ZXJzZU1vZGVsLFxuICAgICAgICAgICAgZGF0YTogZmxhdFJlbGF0ZWREYXRhLFxuICAgICAgICAgICAgZGlzYWJsZWV2ZW50czogc2VsZi5kaXNhYmxlZXZlbnRzLFxuICAgICAgICAgICAgX2lnbm9yZUluc3RhbGxlZDogc2VsZi5faWdub3JlSW5zdGFsbGVkLFxuICAgICAgICAgICAgZnJvbVN0b3JhZ2U6IHRoaXMuZnJvbVN0b3JhZ2VcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcCkge1xuICAgICAgICAgIHZhciB0YXNrO1xuICAgICAgICAgIHRhc2sgPSBmdW5jdGlvbihkb25lKSB7XG4gICAgICAgICAgICBvcC5zdGFydChmdW5jdGlvbihlcnJvcnMsIG9iamVjdHMpIHtcbiAgICAgICAgICAgICAgc2VsZi5zdWJUYXNrUmVzdWx0c1tyZWxhdGlvbnNoaXBOYW1lXSA9IHtcbiAgICAgICAgICAgICAgICBlcnJvcnM6IGVycm9ycyxcbiAgICAgICAgICAgICAgICBvYmplY3RzOiBvYmplY3RzLFxuICAgICAgICAgICAgICAgIGluZGV4ZXM6IGluZGV4ZXNcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgc2VsZi5wcm9jZXNzRXJyb3JzRnJvbVRhc2socmVsYXRpb25zaGlwTmFtZSwgb3AuZXJyb3JzLCBpbmRleGVzKTtcbiAgICAgICAgICAgICAgZG9uZSgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfTtcbiAgICAgICAgICBtLnB1c2godGFzayk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG07XG4gICAgICB9LmJpbmQodGhpcyksIFtdKTtcbiAgICAgIHV0aWwucGFyYWxsZWwodGFza3MsIGZ1bmN0aW9uKGVycikge1xuICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNhbGxiYWNrKCk7XG4gICAgfVxuICB9XG59KVxuO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE1hcHBpbmdPcGVyYXRpb247XG5cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vY29yZS9tYXBwaW5nT3BlcmF0aW9uLmpzXG4gKiogbW9kdWxlIGlkID0gMTBcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsInZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXIsXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgYXJnc2FycmF5ID0gcmVxdWlyZSgnYXJnc2FycmF5JyksXG4gIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICBDaGFpbiA9IHJlcXVpcmUoJy4vQ2hhaW4nKTtcblxuXG52YXIgZXZlbnRFbWl0dGVyZmFjdG9yeSA9IGZ1bmN0aW9uKCkge1xuICB2YXIgZXZlbnRFbWl0dGVyID0gbmV3IEV2ZW50RW1pdHRlcigpO1xuICBldmVudEVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKDEwMCk7XG5cblxuICB2YXIgb2xkRW1pdCA9IGV2ZW50RW1pdHRlci5lbWl0O1xuXG4gIC8vIEVuc3VyZSB0aGF0IGVycm9ycyBpbiBldmVudCBoYW5kbGVycyBkbyBub3Qgc3RhbGwgU2llc3RhLlxuICBldmVudEVtaXR0ZXIuZW1pdCA9IGZ1bmN0aW9uKGV2ZW50LCBwYXlsb2FkKSB7XG4gICAgdHJ5IHtcbiAgICAgIG9sZEVtaXQuY2FsbChldmVudEVtaXR0ZXIsIGV2ZW50LCBwYXlsb2FkKTtcbiAgICB9XG4gICAgY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgfVxuICB9O1xuICByZXR1cm4gZXZlbnRFbWl0dGVyO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBldmVudEVtaXR0ZXJmYWN0b3J5O1xuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvZXZlbnRzLmpzXG4gKiogbW9kdWxlIGlkID0gMTFcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsInZhciBBcnJheU9ic2VydmVyID0gcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKS5BcnJheU9ic2VydmVyLFxuICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gIGFyZ3NhcnJheSA9IHJlcXVpcmUoJ2FyZ3NhcnJheScpLFxuICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgQ2hhaW4gPSByZXF1aXJlKCcuL0NoYWluJyk7XG5cblxuLyoqXG4gKiBMaXN0ZW4gdG8gYSBwYXJ0aWN1bGFyIGV2ZW50IGZyb20gdGhlIFNpZXN0YSBnbG9iYWwgRXZlbnRFbWl0dGVyLlxuICogTWFuYWdlcyBpdHMgb3duIHNldCBvZiBsaXN0ZW5lcnMuXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gUHJveHlFdmVudEVtaXR0ZXIoY29udGV4dCwgZXZlbnQsIGNoYWluT3B0cykge1xuICBpZiAoIWNvbnRleHQpIHRocm93IG5ldyBFcnJvcignd3RmJyk7XG4gIHV0aWwuZXh0ZW5kKHRoaXMsIHtcbiAgICBldmVudDogZXZlbnQsXG4gICAgY29udGV4dDogY29udGV4dCxcbiAgICBsaXN0ZW5lcnM6IHt9XG4gIH0pO1xuICB2YXIgZGVmYXVsdENoYWluT3B0cyA9IHt9O1xuXG4gIGRlZmF1bHRDaGFpbk9wdHMub24gPSB0aGlzLm9uLmJpbmQodGhpcyk7XG4gIGRlZmF1bHRDaGFpbk9wdHMub25jZSA9IHRoaXMub25jZS5iaW5kKHRoaXMpO1xuXG4gIENoYWluLmNhbGwodGhpcywgdXRpbC5leHRlbmQoZGVmYXVsdENoYWluT3B0cywgY2hhaW5PcHRzIHx8IHt9KSk7XG59XG5cblByb3h5RXZlbnRFbWl0dGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoQ2hhaW4ucHJvdG90eXBlKTtcblxudXRpbC5leHRlbmQoUHJveHlFdmVudEVtaXR0ZXIucHJvdG90eXBlLCB7XG4gIG9uOiBmdW5jdGlvbih0eXBlLCBmbikge1xuICAgIGlmICh0eXBlb2YgdHlwZSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICBmbiA9IHR5cGU7XG4gICAgICB0eXBlID0gbnVsbDtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBpZiAodHlwZS50cmltKCkgPT0gJyonKSB0eXBlID0gbnVsbDtcbiAgICAgIHZhciBfZm4gPSBmbjtcbiAgICAgIGZuID0gZnVuY3Rpb24oZSkge1xuICAgICAgICBlID0gZSB8fCB7fTtcbiAgICAgICAgaWYgKHR5cGUpIHtcbiAgICAgICAgICBpZiAoZS50eXBlID09IHR5cGUpIHtcbiAgICAgICAgICAgIF9mbihlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgX2ZuKGUpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgdmFyIGxpc3RlbmVycyA9IHRoaXMubGlzdGVuZXJzO1xuICAgICAgaWYgKHR5cGUpIHtcbiAgICAgICAgaWYgKCFsaXN0ZW5lcnNbdHlwZV0pIGxpc3RlbmVyc1t0eXBlXSA9IFtdO1xuICAgICAgICBsaXN0ZW5lcnNbdHlwZV0ucHVzaChmbik7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuY29udGV4dC5ldmVudHMub24odGhpcy5ldmVudCwgZm4pO1xuICAgIHJldHVybiB0aGlzLl9oYW5kbGVyTGluayh7XG4gICAgICBmbjogZm4sXG4gICAgICB0eXBlOiB0eXBlLFxuICAgICAgZXh0ZW5kOiB0aGlzLnByb3h5Q2hhaW5PcHRzXG4gICAgfSk7XG4gIH0sXG4gIG9uY2U6IGZ1bmN0aW9uKHR5cGUsIGZuKSB7XG4gICAgdmFyIGV2ZW50ID0gdGhpcy5ldmVudDtcbiAgICBpZiAodHlwZW9mIHR5cGUgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgZm4gPSB0eXBlO1xuICAgICAgdHlwZSA9IG51bGw7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgaWYgKHR5cGUudHJpbSgpID09ICcqJykgdHlwZSA9IG51bGw7XG4gICAgICB2YXIgX2ZuID0gZm47XG4gICAgICBmbiA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgZSA9IGUgfHwge307XG4gICAgICAgIGlmICh0eXBlKSB7XG4gICAgICAgICAgaWYgKGUudHlwZSA9PSB0eXBlKSB7XG4gICAgICAgICAgICB0aGlzLmNvbnRleHQuZXZlbnRzLnJlbW92ZUxpc3RlbmVyKGV2ZW50LCBmbik7XG4gICAgICAgICAgICBfZm4oZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIF9mbihlKTtcbiAgICAgICAgfVxuICAgICAgfS5iaW5kKHRoaXMpXG4gICAgfVxuICAgIGlmICh0eXBlKSByZXR1cm4gdGhpcy5jb250ZXh0LmV2ZW50cy5vbihldmVudCwgZm4pO1xuICAgIGVsc2UgcmV0dXJuIHRoaXMuY29udGV4dC5ldmVudHMub25jZShldmVudCwgZm4pO1xuICB9LFxuICBfcmVtb3ZlTGlzdGVuZXI6IGZ1bmN0aW9uKGZuLCB0eXBlKSB7XG4gICAgaWYgKHR5cGUpIHtcbiAgICAgIHZhciBsaXN0ZW5lcnMgPSB0aGlzLmxpc3RlbmVyc1t0eXBlXSxcbiAgICAgICAgaWR4ID0gbGlzdGVuZXJzLmluZGV4T2YoZm4pO1xuICAgICAgbGlzdGVuZXJzLnNwbGljZShpZHgsIDEpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5jb250ZXh0LmV2ZW50cy5yZW1vdmVMaXN0ZW5lcih0aGlzLmV2ZW50LCBmbik7XG4gIH0sXG4gIGVtaXQ6IGZ1bmN0aW9uKHR5cGUsIHBheWxvYWQpIHtcbiAgICBpZiAodHlwZW9mIHR5cGUgPT0gJ29iamVjdCcpIHtcbiAgICAgIHBheWxvYWQgPSB0eXBlO1xuICAgICAgdHlwZSA9IG51bGw7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgcGF5bG9hZCA9IHBheWxvYWQgfHwge307XG4gICAgICBwYXlsb2FkLnR5cGUgPSB0eXBlO1xuICAgIH1cbiAgICB0aGlzLmNvbnRleHQuZXZlbnRzLmVtaXQuY2FsbCh0aGlzLmNvbnRleHQuZXZlbnRzLCB0aGlzLmV2ZW50LCBwYXlsb2FkKTtcbiAgfSxcbiAgX3JlbW92ZUFsbExpc3RlbmVyczogZnVuY3Rpb24odHlwZSkge1xuICAgICh0aGlzLmxpc3RlbmVyc1t0eXBlXSB8fCBbXSkuZm9yRWFjaChmdW5jdGlvbihmbikge1xuICAgICAgdGhpcy5jb250ZXh0LmV2ZW50cy5yZW1vdmVMaXN0ZW5lcih0aGlzLmV2ZW50LCBmbik7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgICB0aGlzLmxpc3RlbmVyc1t0eXBlXSA9IFtdO1xuICB9LFxuICByZW1vdmVBbGxMaXN0ZW5lcnM6IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICBpZiAodHlwZSkge1xuICAgICAgdGhpcy5fcmVtb3ZlQWxsTGlzdGVuZXJzKHR5cGUpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGZvciAodHlwZSBpbiB0aGlzLmxpc3RlbmVycykge1xuICAgICAgICBpZiAodGhpcy5saXN0ZW5lcnMuaGFzT3duUHJvcGVydHkodHlwZSkpIHtcbiAgICAgICAgICB0aGlzLl9yZW1vdmVBbGxMaXN0ZW5lcnModHlwZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFByb3h5RXZlbnRFbWl0dGVyO1xuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvUHJveHlFdmVudEVtaXR0ZXIuanNcbiAqKiBtb2R1bGUgaWQgPSAxMlxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwidmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJykoJ2NvbGxlY3Rpb24nKSxcbiAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICBNb2RlbCA9IHJlcXVpcmUoJy4vbW9kZWwnKSxcbiAgZXh0ZW5kID0gcmVxdWlyZSgnZXh0ZW5kJyksXG4gIFByb3h5RXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnLi9Qcm94eUV2ZW50RW1pdHRlcicpLFxuICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLFxuICBhcmdzYXJyYXkgPSByZXF1aXJlKCdhcmdzYXJyYXknKSxcbiAgQ29uZGl0aW9uID0gcmVxdWlyZSgnLi9jb25kaXRpb24nKTtcblxuXG4vKipcbiAqIEEgY29sbGVjdGlvbiBkZXNjcmliZXMgYSBzZXQgb2YgbW9kZWxzIGFuZCBvcHRpb25hbGx5IGEgUkVTVCBBUEkgd2hpY2ggd2Ugd291bGRcbiAqIGxpa2UgdG8gbW9kZWwuXG4gKlxuICogQHBhcmFtIG5hbWVcbiAqIEBwYXJhbSBvcHRzXG4gKiBAY29uc3RydWN0b3JcbiAqXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYGpzXG4gKiB2YXIgR2l0SHViID0gbmV3IHNpZXN0YSgnR2l0SHViJylcbiAqIC8vIC4uLiBjb25maWd1cmUgbWFwcGluZ3MsIGRlc2NyaXB0b3JzIGV0YyAuLi5cbiAqIEdpdEh1Yi5pbnN0YWxsKGZ1bmN0aW9uICgpIHtcbiAgICAgKiAgICAgLy8gLi4uIGNhcnJ5IG9uLlxuICAgICAqIH0pO1xuICogYGBgXG4gKi9cbmZ1bmN0aW9uIENvbGxlY3Rpb24obmFtZSwgb3B0cykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIGlmICghbmFtZSkgdGhyb3cgbmV3IEVycm9yKCdDb2xsZWN0aW9uIG11c3QgaGF2ZSBhIG5hbWUnKTtcblxuICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgdXRpbC5leHRlbmRGcm9tT3B0cyh0aGlzLCBvcHRzLCB7XG4gICAgY29udGV4dDogbnVsbFxuICB9KTtcblxuICB1dGlsLmV4dGVuZCh0aGlzLCB7XG4gICAgbmFtZTogbmFtZSxcbiAgICBfcmF3TW9kZWxzOiB7fSxcbiAgICBfbW9kZWxzOiB7fSxcbiAgICBfb3B0czogb3B0cyxcbiAgICBpbnN0YWxsZWQ6IGZhbHNlXG4gIH0pO1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHRoaXMsIHtcbiAgICBkaXJ0eToge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHRoaXMuY29udGV4dC5zdG9yYWdlKSB7XG4gICAgICAgICAgdmFyIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uID0gdGhpcy5jb250ZXh0Ll9zdG9yYWdlLl91bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbixcbiAgICAgICAgICAgIGhhc2ggPSB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbltzZWxmLm5hbWVdIHx8IHt9O1xuICAgICAgICAgIHJldHVybiAhIU9iamVjdC5rZXlzKGhhc2gpLmxlbmd0aDtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICB9LFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH0sXG4gICAgbW9kZWxzOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fbW9kZWxzKS5tYXAoZnVuY3Rpb24obW9kZWxOYW1lKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuX21vZGVsc1ttb2RlbE5hbWVdO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgfVxuICAgIH1cbiAgfSk7XG5cbiAgdGhpcy5jb250ZXh0LmNvbGxlY3Rpb25zW3RoaXMubmFtZV0gPSB0aGlzO1xuICBQcm94eUV2ZW50RW1pdHRlci5jYWxsKHRoaXMsIHRoaXMuY29udGV4dCwgdGhpcy5uYW1lKTtcblxufVxuXG5Db2xsZWN0aW9uLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoUHJveHlFdmVudEVtaXR0ZXIucHJvdG90eXBlKTtcblxudXRpbC5leHRlbmQoQ29sbGVjdGlvbi5wcm90b3R5cGUsIHtcbiAgX21vZGVsOiBmdW5jdGlvbihuYW1lLCBvcHRzKSB7XG4gICAgaWYgKG5hbWUpIHtcbiAgICAgIHRoaXMuX3Jhd01vZGVsc1tuYW1lXSA9IG9wdHM7XG4gICAgICBvcHRzID0gZXh0ZW5kKHRydWUsIHt9LCBvcHRzKTtcbiAgICAgIG9wdHMubmFtZSA9IG5hbWU7XG4gICAgICBvcHRzLmNvbGxlY3Rpb24gPSB0aGlzO1xuICAgICAgdmFyIG1vZGVsID0gbmV3IE1vZGVsKG9wdHMpO1xuICAgICAgdGhpcy5fbW9kZWxzW25hbWVdID0gbW9kZWw7XG4gICAgICB0aGlzW25hbWVdID0gbW9kZWw7XG4gICAgICByZXR1cm4gbW9kZWw7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBuYW1lIHNwZWNpZmllZCB3aGVuIGNyZWF0aW5nIG1hcHBpbmcnKTtcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVycyBhIG1vZGVsIHdpdGggdGhpcyBjb2xsZWN0aW9uLlxuICAgKi9cbiAgbW9kZWw6IGFyZ3NhcnJheShmdW5jdGlvbihhcmdzKSB7XG4gICAgaWYgKGFyZ3MubGVuZ3RoKSB7XG4gICAgICBpZiAoYXJncy5sZW5ndGggPT0gMSkge1xuICAgICAgICBpZiAodXRpbC5pc0FycmF5KGFyZ3NbMF0pKSB7XG4gICAgICAgICAgcmV0dXJuIGFyZ3NbMF0ubWFwKGZ1bmN0aW9uKG0pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9tb2RlbChtLm5hbWUsIG0pO1xuICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyIG5hbWUsIG9wdHM7XG4gICAgICAgICAgaWYgKHV0aWwuaXNTdHJpbmcoYXJnc1swXSkpIHtcbiAgICAgICAgICAgIG5hbWUgPSBhcmdzWzBdO1xuICAgICAgICAgICAgb3B0cyA9IHt9O1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIG9wdHMgPSBhcmdzWzBdO1xuICAgICAgICAgICAgbmFtZSA9IG9wdHMubmFtZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHRoaXMuX21vZGVsKG5hbWUsIG9wdHMpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAodHlwZW9mIGFyZ3NbMF0gPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5fbW9kZWwoYXJnc1swXSwgYXJnc1sxXSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIGFyZ3MubWFwKGZ1bmN0aW9uKG0pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9tb2RlbChtLm5hbWUsIG0pO1xuICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbiAgfSksXG5cbiAgLyoqXG4gICAqIER1bXAgdGhpcyBjb2xsZWN0aW9uIGFzIEpTT05cbiAgICogQHBhcmFtICB7Qm9vbGVhbn0gYXNKc29uIFdoZXRoZXIgb3Igbm90IHRvIGFwcGx5IEpTT04uc3RyaW5naWZ5XG4gICAqIEByZXR1cm4ge1N0cmluZ3xPYmplY3R9XG4gICAqIEBjbGFzcyBDb2xsZWN0aW9uXG4gICAqL1xuICBfZHVtcDogZnVuY3Rpb24oYXNKc29uKSB7XG4gICAgdmFyIG9iaiA9IHt9O1xuICAgIG9iai5pbnN0YWxsZWQgPSB0aGlzLmluc3RhbGxlZDtcbiAgICBvYmouZG9jSWQgPSB0aGlzLl9kb2NJZDtcbiAgICBvYmoubmFtZSA9IHRoaXMubmFtZTtcbiAgICByZXR1cm4gYXNKc29uID8gdXRpbC5wcmV0dHlQcmludChvYmopIDogb2JqO1xuICB9LFxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBudW1iZXIgb2Ygb2JqZWN0cyBpbiB0aGlzIGNvbGxlY3Rpb24uXG4gICAqXG4gICAqIEBwYXJhbSBjYlxuICAgKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAgICovXG4gIGNvdW50OiBmdW5jdGlvbihjYikge1xuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICB2YXIgdGFza3MgPSBPYmplY3Qua2V5cyh0aGlzLl9tb2RlbHMpLm1hcChmdW5jdGlvbihtb2RlbE5hbWUpIHtcbiAgICAgICAgdmFyIG0gPSB0aGlzLl9tb2RlbHNbbW9kZWxOYW1lXTtcbiAgICAgICAgcmV0dXJuIG0uY291bnQuYmluZChtKTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICB1dGlsLnBhcmFsbGVsKHRhc2tzLCBmdW5jdGlvbihlcnIsIG5zKSB7XG4gICAgICAgIHZhciBuO1xuICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgIG4gPSBucy5yZWR1Y2UoZnVuY3Rpb24obSwgcikge1xuICAgICAgICAgICAgcmV0dXJuIG0gKyByXG4gICAgICAgICAgfSwgMCk7XG4gICAgICAgIH1cbiAgICAgICAgY2IoZXJyLCBuKTtcbiAgICAgIH0pO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gIH0sXG5cbiAgZ3JhcGg6IGZ1bmN0aW9uKGRhdGEsIG9wdHMsIGNiKSB7XG4gICAgaWYgKHR5cGVvZiBvcHRzID09ICdmdW5jdGlvbicpIGNiID0gb3B0cztcbiAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgdmFyIHRhc2tzID0gW10sIGVycjtcbiAgICAgIGZvciAodmFyIG1vZGVsTmFtZSBpbiBkYXRhKSB7XG4gICAgICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KG1vZGVsTmFtZSkpIHtcbiAgICAgICAgICB2YXIgbW9kZWwgPSB0aGlzLl9tb2RlbHNbbW9kZWxOYW1lXTtcbiAgICAgICAgICBpZiAobW9kZWwpIHtcbiAgICAgICAgICAgIChmdW5jdGlvbihtb2RlbCwgZGF0YSkge1xuICAgICAgICAgICAgICB0YXNrcy5wdXNoKGZ1bmN0aW9uKGRvbmUpIHtcbiAgICAgICAgICAgICAgICBtb2RlbC5ncmFwaChkYXRhLCBmdW5jdGlvbihlcnIsIG1vZGVscykge1xuICAgICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlc3VsdHMgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0c1ttb2RlbC5uYW1lXSA9IG1vZGVscztcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGRvbmUoZXJyLCByZXN1bHRzKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KShtb2RlbCwgZGF0YVttb2RlbE5hbWVdKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBlcnIgPSAnTm8gc3VjaCBtb2RlbCBcIicgKyBtb2RlbE5hbWUgKyAnXCInO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgdXRpbC5zZXJpZXModGFza3MsIGZ1bmN0aW9uKGVyciwgcmVzdWx0cykge1xuICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICByZXN1bHRzID0gcmVzdWx0cy5yZWR1Y2UoZnVuY3Rpb24obWVtbywgcmVzKSB7XG4gICAgICAgICAgICAgIHJldHVybiB1dGlsLmV4dGVuZChtZW1vLCByZXMgfHwge30pO1xuICAgICAgICAgICAgfSwge30pXG4gICAgICAgICAgfSBlbHNlIHJlc3VsdHMgPSBudWxsO1xuICAgICAgICAgIGNiKGVyciwgcmVzdWx0cyk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgZWxzZSBjYihlcnJvcihlcnIsIHtkYXRhOiBkYXRhLCBpbnZhbGlkTW9kZWxOYW1lOiBtb2RlbE5hbWV9KSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcblxuICByZW1vdmVBbGw6IGZ1bmN0aW9uKGNiKSB7XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgIHV0aWwuUHJvbWlzZS5hbGwoXG4gICAgICAgIE9iamVjdC5rZXlzKHRoaXMuX21vZGVscykubWFwKGZ1bmN0aW9uKG1vZGVsTmFtZSkge1xuICAgICAgICAgIHZhciBtb2RlbCA9IHRoaXMuX21vZGVsc1ttb2RlbE5hbWVdO1xuICAgICAgICAgIHJldHVybiBtb2RlbC5yZW1vdmVBbGwoKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKVxuICAgICAgKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGNiKG51bGwpO1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goY2IpXG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gQ29sbGVjdGlvbjtcblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL2NvbGxlY3Rpb24uanNcbiAqKiBtb2R1bGUgaWQgPSAxM1xuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgUHJvbWlzZSA9IHV0aWwuUHJvbWlzZSxcbiAgZXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJyksXG4gIE1vZGVsSW5zdGFuY2UgPSByZXF1aXJlKCcuL01vZGVsSW5zdGFuY2UnKTtcblxuLypcbiBUT0RPOiBVc2UgRVM2IFByb3h5IGluc3RlYWQuXG4gRXZlbnR1YWxseSBmaWx0ZXIgc2V0cyBzaG91bGQgdXNlIEVTNiBQcm94aWVzIHdoaWNoIHdpbGwgYmUgbXVjaCBtb3JlIG5hdHVyYWwgYW5kIHJvYnVzdC4gRS5nLiBubyBuZWVkIGZvciB0aGUgYmVsb3dcbiAqL1xudmFyIEFSUkFZX01FVEhPRFMgPSBbJ3B1c2gnLCAnc29ydCcsICdyZXZlcnNlJywgJ3NwbGljZScsICdzaGlmdCcsICd1bnNoaWZ0J10sXG4gIE5VTUJFUl9NRVRIT0RTID0gWyd0b1N0cmluZycsICd0b0V4cG9uZW50aWFsJywgJ3RvRml4ZWQnLCAndG9QcmVjaXNpb24nLCAndmFsdWVPZiddLFxuICBOVU1CRVJfUFJPUEVSVElFUyA9IFsnTUFYX1ZBTFVFJywgJ01JTl9WQUxVRScsICdORUdBVElWRV9JTkZJTklUWScsICdOYU4nLCAnUE9TSVRJVkVfSU5GSU5JVFknXSxcbiAgU1RSSU5HX01FVEhPRFMgPSBbJ2NoYXJBdCcsICdjaGFyQ29kZUF0JywgJ2NvbmNhdCcsICdmcm9tQ2hhckNvZGUnLCAnaW5kZXhPZicsICdsYXN0SW5kZXhPZicsICdsb2NhbGVDb21wYXJlJyxcbiAgICAnbWF0Y2gnLCAncmVwbGFjZScsICdzZWFyY2gnLCAnc2xpY2UnLCAnc3BsaXQnLCAnc3Vic3RyJywgJ3N1YnN0cmluZycsICd0b0xvY2FsZUxvd2VyQ2FzZScsICd0b0xvY2FsZVVwcGVyQ2FzZScsXG4gICAgJ3RvTG93ZXJDYXNlJywgJ3RvU3RyaW5nJywgJ3RvVXBwZXJDYXNlJywgJ3RyaW0nLCAndmFsdWVPZiddLFxuICBTVFJJTkdfUFJPUEVSVElFUyA9IFsnbGVuZ3RoJ107XG5cbi8qKlxuICogUmV0dXJuIHRoZSBwcm9wZXJ0eSBuYW1lcyBmb3IgYSBnaXZlbiBvYmplY3QuIEhhbmRsZXMgc3BlY2lhbCBjYXNlcyBzdWNoIGFzIHN0cmluZ3MgYW5kIG51bWJlcnMgdGhhdCBkbyBub3QgaGF2ZVxuICogdGhlIGdldE93blByb3BlcnR5TmFtZXMgZnVuY3Rpb24uXG4gKiBUaGUgc3BlY2lhbCBjYXNlcyBhcmUgdmVyeSBtdWNoIGhhY2tzLiBUaGlzIGhhY2sgY2FuIGJlIHJlbW92ZWQgb25jZSB0aGUgUHJveHkgb2JqZWN0IGlzIG1vcmUgd2lkZWx5IGFkb3B0ZWQuXG4gKiBAcGFyYW0gb2JqZWN0XG4gKiBAcmV0dXJucyB7QXJyYXl9XG4gKi9cbmZ1bmN0aW9uIGdldFByb3BlcnR5TmFtZXMob2JqZWN0KSB7XG4gIHZhciBwcm9wZXJ0eU5hbWVzO1xuICBpZiAodHlwZW9mIG9iamVjdCA9PSAnc3RyaW5nJyB8fCBvYmplY3QgaW5zdGFuY2VvZiBTdHJpbmcpIHtcbiAgICBwcm9wZXJ0eU5hbWVzID0gU1RSSU5HX01FVEhPRFMuY29uY2F0KFNUUklOR19QUk9QRVJUSUVTKTtcbiAgfVxuICBlbHNlIGlmICh0eXBlb2Ygb2JqZWN0ID09ICdudW1iZXInIHx8IG9iamVjdCBpbnN0YW5jZW9mIE51bWJlcikge1xuICAgIHByb3BlcnR5TmFtZXMgPSBOVU1CRVJfTUVUSE9EUy5jb25jYXQoTlVNQkVSX1BST1BFUlRJRVMpO1xuICB9XG4gIGVsc2Uge1xuICAgIHByb3BlcnR5TmFtZXMgPSBvYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcygpO1xuICB9XG4gIHJldHVybiBwcm9wZXJ0eU5hbWVzO1xufVxuXG4vKipcbiAqIERlZmluZSBhIHByb3h5IHByb3BlcnR5IHRvIGF0dHJpYnV0ZXMgb24gb2JqZWN0cyBpbiB0aGUgYXJyYXlcbiAqIEBwYXJhbSBhcnJcbiAqIEBwYXJhbSBwcm9wXG4gKi9cbmZ1bmN0aW9uIGRlZmluZUF0dHJpYnV0ZShhcnIsIHByb3ApIHtcbiAgaWYgKCEocHJvcCBpbiBhcnIpKSB7IC8vIGUuZy4gd2UgY2Fubm90IHJlZGVmaW5lIC5sZW5ndGhcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoYXJyLCBwcm9wLCB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gZmlsdGVyU2V0KHV0aWwucGx1Y2soYXJyLCBwcm9wKSk7XG4gICAgICB9LFxuICAgICAgc2V0OiBmdW5jdGlvbih2KSB7XG4gICAgICAgIGlmICh1dGlsLmlzQXJyYXkodikpIHtcbiAgICAgICAgICBpZiAodGhpcy5sZW5ndGggIT0gdi5sZW5ndGgpIHRocm93IGVycm9yKHttZXNzYWdlOiAnTXVzdCBiZSBzYW1lIGxlbmd0aCd9KTtcbiAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHYubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXNbaV1bcHJvcF0gPSB2W2ldO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpc1tpXVtwcm9wXSA9IHY7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNQcm9taXNlKG9iaikge1xuICAvLyBUT0RPOiBEb24ndCB0aGluayB0aGlzIGlzIHZlcnkgcm9idXN0LlxuICByZXR1cm4gb2JqLnRoZW4gJiYgb2JqLmNhdGNoO1xufVxuXG4vKipcbiAqIERlZmluZSBhIHByb3h5IG1ldGhvZCBvbiB0aGUgYXJyYXkgaWYgbm90IGFscmVhZHkgaW4gZXhpc3RlbmNlLlxuICogQHBhcmFtIGFyclxuICogQHBhcmFtIHByb3BcbiAqL1xuZnVuY3Rpb24gZGVmaW5lTWV0aG9kKGFyciwgcHJvcCkge1xuICBpZiAoIShwcm9wIGluIGFycikpIHsgLy8gZS5nLiB3ZSBkb24ndCB3YW50IHRvIHJlZGVmaW5lIHRvU3RyaW5nXG4gICAgYXJyW3Byb3BdID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgYXJncyA9IGFyZ3VtZW50cyxcbiAgICAgICAgcmVzID0gdGhpcy5tYXAoZnVuY3Rpb24ocCkge1xuICAgICAgICAgIHJldHVybiBwW3Byb3BdLmFwcGx5KHAsIGFyZ3MpO1xuICAgICAgICB9KTtcbiAgICAgIHZhciBhcmVQcm9taXNlcyA9IGZhbHNlO1xuICAgICAgaWYgKHJlcy5sZW5ndGgpIGFyZVByb21pc2VzID0gaXNQcm9taXNlKHJlc1swXSk7XG4gICAgICByZXR1cm4gYXJlUHJvbWlzZXMgPyBQcm9taXNlLmFsbChyZXMpIDogZmlsdGVyU2V0KHJlcyk7XG4gICAgfTtcbiAgfVxufVxuXG4vKipcbiAqIFRyYW5zZm9ybSB0aGUgYXJyYXkgaW50byBhIGZpbHRlciBzZXQuXG4gKiBSZW5kZXJzIHRoZSBhcnJheSBpbW11dGFibGUuXG4gKiBAcGFyYW0gYXJyXG4gKiBAcGFyYW0gbW9kZWwgLSBUaGUgbW9kZWwgd2l0aCB3aGljaCB0byBwcm94eSB0b1xuICovXG5mdW5jdGlvbiBtb2RlbEZpbHRlclNldChhcnIsIG1vZGVsKSB7XG4gIGFyciA9IHV0aWwuZXh0ZW5kKFtdLCBhcnIpO1xuICB2YXIgYXR0cmlidXRlTmFtZXMgPSBtb2RlbC5fYXR0cmlidXRlTmFtZXMsXG4gICAgcmVsYXRpb25zaGlwTmFtZXMgPSBtb2RlbC5fcmVsYXRpb25zaGlwTmFtZXMsXG4gICAgbmFtZXMgPSBhdHRyaWJ1dGVOYW1lcy5jb25jYXQocmVsYXRpb25zaGlwTmFtZXMpLmNvbmNhdChpbnN0YW5jZU1ldGhvZHMpO1xuICBuYW1lcy5mb3JFYWNoKGRlZmluZUF0dHJpYnV0ZS5iaW5kKGRlZmluZUF0dHJpYnV0ZSwgYXJyKSk7XG4gIHZhciBpbnN0YW5jZU1ldGhvZHMgPSBPYmplY3Qua2V5cyhNb2RlbEluc3RhbmNlLnByb3RvdHlwZSk7XG4gIGluc3RhbmNlTWV0aG9kcy5mb3JFYWNoKGRlZmluZU1ldGhvZC5iaW5kKGRlZmluZU1ldGhvZCwgYXJyKSk7XG4gIHJldHVybiByZW5kZXJJbW11dGFibGUoYXJyKTtcbn1cblxuLyoqXG4gKiBUcmFuc2Zvcm0gdGhlIGFycmF5IGludG8gYSBmaWx0ZXIgc2V0LCBiYXNlZCBvbiB3aGF0ZXZlciBpcyBpbiBpdC5cbiAqIE5vdGUgdGhhdCBhbGwgb2JqZWN0cyBtdXN0IGJlIG9mIHRoZSBzYW1lIHR5cGUuIFRoaXMgZnVuY3Rpb24gd2lsbCB0YWtlIHRoZSBmaXJzdCBvYmplY3QgYW5kIGRlY2lkZSBob3cgdG8gcHJveHlcbiAqIGJhc2VkIG9uIHRoYXQuXG4gKiBAcGFyYW0gYXJyXG4gKi9cbmZ1bmN0aW9uIGZpbHRlclNldChhcnIpIHtcbiAgaWYgKGFyci5sZW5ndGgpIHtcbiAgICB2YXIgcmVmZXJlbmNlT2JqZWN0ID0gYXJyWzBdLFxuICAgICAgcHJvcGVydHlOYW1lcyA9IGdldFByb3BlcnR5TmFtZXMocmVmZXJlbmNlT2JqZWN0KTtcbiAgICBwcm9wZXJ0eU5hbWVzLmZvckVhY2goZnVuY3Rpb24ocHJvcCkge1xuICAgICAgaWYgKHR5cGVvZiByZWZlcmVuY2VPYmplY3RbcHJvcF0gPT0gJ2Z1bmN0aW9uJykgZGVmaW5lTWV0aG9kKGFyciwgcHJvcCwgYXJndW1lbnRzKTtcbiAgICAgIGVsc2UgZGVmaW5lQXR0cmlidXRlKGFyciwgcHJvcCk7XG4gICAgfSk7XG4gIH1cbiAgcmV0dXJuIHJlbmRlckltbXV0YWJsZShhcnIpO1xufVxuXG5mdW5jdGlvbiB0aHJvd0ltbXV0YWJsZUVycm9yKCkge1xuICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBtb2RpZnkgYSBmaWx0ZXIgc2V0Jyk7XG59XG5cbi8qKlxuICogUmVuZGVyIGFuIGFycmF5IGltbXV0YWJsZSBieSByZXBsYWNpbmcgYW55IGZ1bmN0aW9ucyB0aGF0IGNhbiBtdXRhdGUgaXQuXG4gKiBAcGFyYW0gYXJyXG4gKi9cbmZ1bmN0aW9uIHJlbmRlckltbXV0YWJsZShhcnIpIHtcbiAgQVJSQVlfTUVUSE9EUy5mb3JFYWNoKGZ1bmN0aW9uKHApIHtcbiAgICBhcnJbcF0gPSB0aHJvd0ltbXV0YWJsZUVycm9yO1xuICB9KTtcbiAgYXJyLmltbXV0YWJsZSA9IHRydWU7XG4gIGFyci5tdXRhYmxlQ29weSA9IGFyci5hc0FycmF5ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIG11dGFibGVBcnIgPSB0aGlzLm1hcChmdW5jdGlvbih4KSB7cmV0dXJuIHh9KTtcbiAgICBtdXRhYmxlQXJyLmFzRmlsdGVyU2V0ID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gZmlsdGVyU2V0KHRoaXMpO1xuICAgIH07XG4gICAgbXV0YWJsZUFyci5hc01vZGVsRmlsdGVyU2V0ID0gZnVuY3Rpb24obW9kZWwpIHtcbiAgICAgIHJldHVybiBtb2RlbEZpbHRlclNldCh0aGlzLCBtb2RlbCk7XG4gICAgfTtcbiAgICByZXR1cm4gbXV0YWJsZUFycjtcbiAgfTtcbiAgcmV0dXJuIGFycjtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBtb2RlbEZpbHRlclNldDtcblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL0ZpbHRlclNldC5qc1xuICoqIG1vZHVsZSBpZCA9IDE0XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJ2YXIgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSgnZmlsdGVyJyksXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgZXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJyksXG4gIE1vZGVsSW5zdGFuY2UgPSByZXF1aXJlKCcuL01vZGVsSW5zdGFuY2UnKSxcbiAgY29uc3RydWN0RmlsdGVyU2V0ID0gcmVxdWlyZSgnLi9GaWx0ZXJTZXQnKTtcblxuLyoqXG4gKiBAY2xhc3NcbiAqIEBwYXJhbSB7TW9kZWx9IG1vZGVsXG4gKiBAcGFyYW0ge09iamVjdH0gZmlsdGVyXG4gKi9cbmZ1bmN0aW9uIEZpbHRlcihtb2RlbCwgZmlsdGVyKSB7XG4gIHZhciBvcHRzID0ge307XG4gIGZvciAodmFyIHByb3AgaW4gZmlsdGVyKSB7XG4gICAgaWYgKGZpbHRlci5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgaWYgKHByb3Auc2xpY2UoMCwgMikgPT0gJ19fJykge1xuICAgICAgICBvcHRzW3Byb3Auc2xpY2UoMildID0gZmlsdGVyW3Byb3BdO1xuICAgICAgICBkZWxldGUgZmlsdGVyW3Byb3BdO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICB1dGlsLmV4dGVuZCh0aGlzLCB7XG4gICAgbW9kZWw6IG1vZGVsLFxuICAgIGZpbHRlcjogZmlsdGVyLFxuICAgIG9wdHM6IG9wdHNcbiAgfSk7XG4gIG9wdHMub3JkZXIgPSBvcHRzLm9yZGVyIHx8IFtdO1xuICBpZiAoIXV0aWwuaXNBcnJheShvcHRzLm9yZGVyKSkgb3B0cy5vcmRlciA9IFtvcHRzLm9yZGVyXTtcbn1cblxuZnVuY3Rpb24gdmFsdWVBc1N0cmluZyhmaWVsZFZhbHVlKSB7XG4gIHZhciBmaWVsZEFzU3RyaW5nO1xuICBpZiAoZmllbGRWYWx1ZSA9PT0gbnVsbCkgZmllbGRBc1N0cmluZyA9ICdudWxsJztcbiAgZWxzZSBpZiAoZmllbGRWYWx1ZSA9PT0gdW5kZWZpbmVkKSBmaWVsZEFzU3RyaW5nID0gJ3VuZGVmaW5lZCc7XG4gIGVsc2UgaWYgKGZpZWxkVmFsdWUgaW5zdGFuY2VvZiBNb2RlbEluc3RhbmNlKSBmaWVsZEFzU3RyaW5nID0gZmllbGRWYWx1ZS5sb2NhbElkO1xuICBlbHNlIGZpZWxkQXNTdHJpbmcgPSBmaWVsZFZhbHVlLnRvU3RyaW5nKCk7XG4gIHJldHVybiBmaWVsZEFzU3RyaW5nO1xufVxuXG5mdW5jdGlvbiBjb250YWlucyhvcHRzKSB7XG4gIGlmICghb3B0cy5pbnZhbGlkKSB7XG4gICAgdmFyIG9iaiA9IG9wdHMub2JqZWN0O1xuICAgIGlmICh1dGlsLmlzQXJyYXkob2JqKSkge1xuICAgICAgYXJyID0gdXRpbC5wbHVjayhvYmosIG9wdHMuZmllbGQpO1xuICAgIH1cbiAgICBlbHNlXG4gICAgICB2YXIgYXJyID0gb2JqW29wdHMuZmllbGRdO1xuICAgIGlmICh1dGlsLmlzQXJyYXkoYXJyKSB8fCB1dGlsLmlzU3RyaW5nKGFycikpIHtcbiAgICAgIHJldHVybiBhcnIuaW5kZXhPZihvcHRzLnZhbHVlKSA+IC0xO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbnZhciBjb21wYXJhdG9ycyA9IHtcbiAgZTogZnVuY3Rpb24ob3B0cykge1xuICAgIHJldHVybiBvcHRzLm9iamVjdFtvcHRzLmZpZWxkXSA9PSBvcHRzLnZhbHVlO1xuICB9LFxuICBuZTogZnVuY3Rpb24ob3B0cykge1xuICAgIHJldHVybiBvcHRzLm9iamVjdFtvcHRzLmZpZWxkXSAhPSBvcHRzLnZhbHVlO1xuICB9LFxuICBsdDogZnVuY3Rpb24ob3B0cykge1xuICAgIGlmICghb3B0cy5pbnZhbGlkKSByZXR1cm4gb3B0cy5vYmplY3Rbb3B0cy5maWVsZF0gPCBvcHRzLnZhbHVlO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfSxcbiAgZ3Q6IGZ1bmN0aW9uKG9wdHMpIHtcbiAgICBpZiAoIW9wdHMuaW52YWxpZCkgcmV0dXJuIG9wdHMub2JqZWN0W29wdHMuZmllbGRdID4gb3B0cy52YWx1ZTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH0sXG4gIGx0ZTogZnVuY3Rpb24ob3B0cykge1xuICAgIGlmICghb3B0cy5pbnZhbGlkKSByZXR1cm4gb3B0cy5vYmplY3Rbb3B0cy5maWVsZF0gPD0gb3B0cy52YWx1ZTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH0sXG4gIGd0ZTogZnVuY3Rpb24ob3B0cykge1xuICAgIGlmICghb3B0cy5pbnZhbGlkKSByZXR1cm4gb3B0cy5vYmplY3Rbb3B0cy5maWVsZF0gPj0gb3B0cy52YWx1ZTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH0sXG4gIGNvbnRhaW5zOiBjb250YWlucyxcbiAgaW46IGNvbnRhaW5zXG59O1xuXG51dGlsLmV4dGVuZChGaWx0ZXIsIHtcbiAgY29tcGFyYXRvcnM6IGNvbXBhcmF0b3JzLFxuICByZWdpc3RlckNvbXBhcmF0b3I6IGZ1bmN0aW9uKHN5bWJvbCwgZm4pIHtcbiAgICBpZiAoIWNvbXBhcmF0b3JzW3N5bWJvbF0pIHtcbiAgICAgIGNvbXBhcmF0b3JzW3N5bWJvbF0gPSBmbjtcbiAgICB9XG4gIH1cbn0pO1xuXG5mdW5jdGlvbiBjYWNoZUZvck1vZGVsKG1vZGVsKSB7XG4gIHZhciBjYWNoZUJ5VHlwZSA9IG1vZGVsLmNvbnRleHQuY2FjaGUuX2xvY2FsQ2FjaGVCeVR5cGU7XG4gIHZhciBtb2RlbE5hbWUgPSBtb2RlbC5uYW1lO1xuICB2YXIgY29sbGVjdGlvbk5hbWUgPSBtb2RlbC5jb2xsZWN0aW9uTmFtZTtcbiAgdmFyIGNhY2hlQnlNb2RlbCA9IGNhY2hlQnlUeXBlW2NvbGxlY3Rpb25OYW1lXTtcbiAgdmFyIGNhY2hlQnlMb2NhbElkO1xuICBpZiAoY2FjaGVCeU1vZGVsKSB7XG4gICAgY2FjaGVCeUxvY2FsSWQgPSBjYWNoZUJ5TW9kZWxbbW9kZWxOYW1lXSB8fCB7fTtcbiAgfVxuICByZXR1cm4gY2FjaGVCeUxvY2FsSWQ7XG59XG5cbnV0aWwuZXh0ZW5kKEZpbHRlci5wcm90b3R5cGUsIHtcbiAgZXhlY3V0ZTogZnVuY3Rpb24oY2IpIHtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgdGhpcy5fZXhlY3V0ZUluTWVtb3J5KGNiKTtcbiAgICB9LmJpbmQodGhpcykpO1xuICB9LFxuICBfZHVtcDogZnVuY3Rpb24oYXNKc29uKSB7XG4gICAgcmV0dXJuIGFzSnNvbiA/ICd7fScgOiB7fTtcbiAgfSxcbiAgc29ydEZ1bmM6IGZ1bmN0aW9uKGZpZWxkcykge1xuICAgIHZhciBzb3J0RnVuYyA9IGZ1bmN0aW9uKGFzY2VuZGluZywgZmllbGQpIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbih2MSwgdjIpIHtcbiAgICAgICAgdmFyIGQxID0gdjFbZmllbGRdLFxuICAgICAgICAgIGQyID0gdjJbZmllbGRdLFxuICAgICAgICAgIHJlcztcbiAgICAgICAgaWYgKHR5cGVvZiBkMSA9PSAnc3RyaW5nJyB8fCBkMSBpbnN0YW5jZW9mIFN0cmluZyAmJlxuICAgICAgICAgIHR5cGVvZiBkMiA9PSAnc3RyaW5nJyB8fCBkMiBpbnN0YW5jZW9mIFN0cmluZykge1xuICAgICAgICAgIHJlcyA9IGFzY2VuZGluZyA/IGQxLmxvY2FsZUNvbXBhcmUoZDIpIDogZDIubG9jYWxlQ29tcGFyZShkMSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgaWYgKGQxIGluc3RhbmNlb2YgRGF0ZSkgZDEgPSBkMS5nZXRUaW1lKCk7XG4gICAgICAgICAgaWYgKGQyIGluc3RhbmNlb2YgRGF0ZSkgZDIgPSBkMi5nZXRUaW1lKCk7XG4gICAgICAgICAgaWYgKGFzY2VuZGluZykgcmVzID0gZDEgLSBkMjtcbiAgICAgICAgICBlbHNlIHJlcyA9IGQyIC0gZDE7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICAgIH1cbiAgICB9O1xuICAgIHZhciBzID0gdXRpbDtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGZpZWxkcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGZpZWxkID0gZmllbGRzW2ldO1xuICAgICAgcyA9IHMudGhlbkJ5KHNvcnRGdW5jKGZpZWxkLmFzY2VuZGluZywgZmllbGQuZmllbGQpKTtcbiAgICB9XG4gICAgcmV0dXJuIHMgPT0gdXRpbCA/IG51bGwgOiBzO1xuICB9LFxuICBfc29ydFJlc3VsdHM6IGZ1bmN0aW9uKHJlcykge1xuICAgIHZhciBvcmRlciA9IHRoaXMub3B0cy5vcmRlcjtcbiAgICBpZiAocmVzICYmIG9yZGVyKSB7XG4gICAgICB2YXIgZmllbGRzID0gb3JkZXIubWFwKGZ1bmN0aW9uKG9yZGVyaW5nKSB7XG4gICAgICAgIHZhciBzcGx0ID0gb3JkZXJpbmcuc3BsaXQoJy0nKSxcbiAgICAgICAgICBhc2NlbmRpbmcgPSB0cnVlLFxuICAgICAgICAgIGZpZWxkID0gbnVsbDtcbiAgICAgICAgaWYgKHNwbHQubGVuZ3RoID4gMSkge1xuICAgICAgICAgIGZpZWxkID0gc3BsdFsxXTtcbiAgICAgICAgICBhc2NlbmRpbmcgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBmaWVsZCA9IHNwbHRbMF07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHtmaWVsZDogZmllbGQsIGFzY2VuZGluZzogYXNjZW5kaW5nfTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICB2YXIgc29ydEZ1bmMgPSB0aGlzLnNvcnRGdW5jKGZpZWxkcyk7XG4gICAgICBpZiAocmVzLmltbXV0YWJsZSkgcmVzID0gcmVzLm11dGFibGVDb3B5KCk7XG4gICAgICBpZiAoc29ydEZ1bmMpIHJlcy5zb3J0KHNvcnRGdW5jKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlcztcbiAgfSxcbiAgLyoqXG4gICAqIFJldHVybiBhbGwgbW9kZWwgaW5zdGFuY2VzIGluIHRoZSBjYWNoZS5cbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9nZXRDYWNoZUJ5TG9jYWxJZDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuZGVzY2VuZGFudHMucmVkdWNlKGZ1bmN0aW9uKG1lbW8sIGNoaWxkTW9kZWwpIHtcbiAgICAgIHJldHVybiB1dGlsLmV4dGVuZChtZW1vLCBjYWNoZUZvck1vZGVsKGNoaWxkTW9kZWwpKTtcbiAgICB9LCB1dGlsLmV4dGVuZCh7fSwgY2FjaGVGb3JNb2RlbCh0aGlzLm1vZGVsKSkpO1xuICB9LFxuICBfZXhlY3V0ZUluTWVtb3J5OiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgIHZhciBjYWNoZUJ5TG9jYWxJZCA9IHRoaXMuX2dldENhY2hlQnlMb2NhbElkKCk7XG4gICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhjYWNoZUJ5TG9jYWxJZCk7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciByZXMgPSBbXTtcbiAgICB2YXIgZXJyO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGsgPSBrZXlzW2ldO1xuICAgICAgdmFyIG9iaiA9IGNhY2hlQnlMb2NhbElkW2tdO1xuICAgICAgdmFyIG1hdGNoZXMgPSBzZWxmLm9iamVjdE1hdGNoZXNGaWx0ZXIob2JqKTtcbiAgICAgIGlmICh0eXBlb2YobWF0Y2hlcykgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgZXJyID0gZXJyb3IobWF0Y2hlcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKG1hdGNoZXMpIHJlcy5wdXNoKG9iaik7XG4gICAgICB9XG4gICAgfVxuICAgIHJlcyA9IHRoaXMuX3NvcnRSZXN1bHRzKHJlcyk7XG4gICAgY2FsbGJhY2soZXJyLCBlcnIgPyBudWxsIDogY29uc3RydWN0RmlsdGVyU2V0KHJlcywgdGhpcy5tb2RlbCkpO1xuICB9LFxuICBjbGVhck9yZGVyaW5nOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLm9wdHMub3JkZXIgPSBudWxsO1xuICB9LFxuICBvYmplY3RNYXRjaGVzT3JGaWx0ZXI6IGZ1bmN0aW9uKG9iaiwgb3JGaWx0ZXIpIHtcbiAgICBmb3IgKHZhciBpZHggaW4gb3JGaWx0ZXIpIHtcbiAgICAgIGlmIChvckZpbHRlci5oYXNPd25Qcm9wZXJ0eShpZHgpKSB7XG4gICAgICAgIHZhciBmaWx0ZXIgPSBvckZpbHRlcltpZHhdO1xuICAgICAgICBpZiAodGhpcy5vYmplY3RNYXRjaGVzQmFzZUZpbHRlcihvYmosIGZpbHRlcikpIHtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH0sXG4gIG9iamVjdE1hdGNoZXNBbmRGaWx0ZXI6IGZ1bmN0aW9uKG9iaiwgYW5kRmlsdGVyKSB7XG4gICAgZm9yICh2YXIgaWR4IGluIGFuZEZpbHRlcikge1xuICAgICAgaWYgKGFuZEZpbHRlci5oYXNPd25Qcm9wZXJ0eShpZHgpKSB7XG4gICAgICAgIHZhciBmaWx0ZXIgPSBhbmRGaWx0ZXJbaWR4XTtcbiAgICAgICAgaWYgKCF0aGlzLm9iamVjdE1hdGNoZXNCYXNlRmlsdGVyKG9iaiwgZmlsdGVyKSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSxcbiAgc3BsaXRNYXRjaGVzOiBmdW5jdGlvbihvYmosIHVucHJvY2Vzc2VkRmllbGQsIHZhbHVlKSB7XG4gICAgdmFyIG9wID0gJ2UnO1xuICAgIHZhciBmaWVsZHMgPSB1bnByb2Nlc3NlZEZpZWxkLnNwbGl0KCcuJyk7XG4gICAgdmFyIHNwbHQgPSBmaWVsZHNbZmllbGRzLmxlbmd0aCAtIDFdLnNwbGl0KCdfXycpO1xuICAgIGlmIChzcGx0Lmxlbmd0aCA9PSAyKSB7XG4gICAgICB2YXIgZmllbGQgPSBzcGx0WzBdO1xuICAgICAgb3AgPSBzcGx0WzFdO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGZpZWxkID0gc3BsdFswXTtcbiAgICB9XG4gICAgZmllbGRzW2ZpZWxkcy5sZW5ndGggLSAxXSA9IGZpZWxkO1xuICAgIGZpZWxkcy5zbGljZSgwLCBmaWVsZHMubGVuZ3RoIC0gMSkuZm9yRWFjaChmdW5jdGlvbihmKSB7XG4gICAgICBpZiAodXRpbC5pc0FycmF5KG9iaikpIHtcbiAgICAgICAgb2JqID0gdXRpbC5wbHVjayhvYmosIGYpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIG9iaiA9IG9ialtmXTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICAvLyBJZiB3ZSBnZXQgdG8gdGhlIHBvaW50IHdoZXJlIHdlJ3JlIGFib3V0IHRvIGluZGV4IG51bGwgb3IgdW5kZWZpbmVkIHdlIHN0b3AgLSBvYnZpb3VzbHkgdGhpcyBvYmplY3QgZG9lc1xuICAgIC8vIG5vdCBtYXRjaCB0aGUgZmlsdGVyLlxuICAgIHZhciBub3ROdWxsT3JVbmRlZmluZWQgPSBvYmogIT0gdW5kZWZpbmVkO1xuICAgIGlmIChub3ROdWxsT3JVbmRlZmluZWQpIHtcbiAgICAgIGlmICh1dGlsLmlzQXJyYXkob2JqKSkge1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHZhciB2YWwgPSBvYmpbZmllbGRdO1xuICAgICAgICB2YXIgaW52YWxpZCA9IHV0aWwuaXNBcnJheSh2YWwpID8gZmFsc2UgOiB2YWwgPT09IG51bGwgfHwgdmFsID09PSB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgICB2YXIgY29tcGFyYXRvciA9IEZpbHRlci5jb21wYXJhdG9yc1tvcF0sXG4gICAgICAgIG9wdHMgPSB7b2JqZWN0OiBvYmosIGZpZWxkOiBmaWVsZCwgdmFsdWU6IHZhbHVlLCBpbnZhbGlkOiBpbnZhbGlkfTtcbiAgICAgIGlmICghY29tcGFyYXRvcikge1xuICAgICAgICByZXR1cm4gJ05vIGNvbXBhcmF0b3IgcmVnaXN0ZXJlZCBmb3IgZmlsdGVyIG9wZXJhdGlvbiBcIicgKyBvcCArICdcIic7XG4gICAgICB9XG4gICAgICByZXR1cm4gY29tcGFyYXRvcihvcHRzKTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9LFxuICBvYmplY3RNYXRjaGVzOiBmdW5jdGlvbihvYmosIHVucHJvY2Vzc2VkRmllbGQsIHZhbHVlLCBmaWx0ZXIpIHtcbiAgICBpZiAodW5wcm9jZXNzZWRGaWVsZCA9PSAnJG9yJykge1xuICAgICAgdmFyICRvciA9IGZpbHRlclsnJG9yJ107XG4gICAgICBpZiAoIXV0aWwuaXNBcnJheSgkb3IpKSB7XG4gICAgICAgICRvciA9IE9iamVjdC5rZXlzKCRvcikubWFwKGZ1bmN0aW9uKGspIHtcbiAgICAgICAgICB2YXIgbm9ybWFsaXNlZCA9IHt9O1xuICAgICAgICAgIG5vcm1hbGlzZWRba10gPSAkb3Jba107XG4gICAgICAgICAgcmV0dXJuIG5vcm1hbGlzZWQ7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgaWYgKCF0aGlzLm9iamVjdE1hdGNoZXNPckZpbHRlcihvYmosICRvcikpIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgZWxzZSBpZiAodW5wcm9jZXNzZWRGaWVsZCA9PSAnJGFuZCcpIHtcbiAgICAgIGlmICghdGhpcy5vYmplY3RNYXRjaGVzQW5kRmlsdGVyKG9iaiwgZmlsdGVyWyckYW5kJ10pKSByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdmFyIG1hdGNoZXMgPSB0aGlzLnNwbGl0TWF0Y2hlcyhvYmosIHVucHJvY2Vzc2VkRmllbGQsIHZhbHVlKTtcbiAgICAgIGlmICh0eXBlb2YgbWF0Y2hlcyAhPSAnYm9vbGVhbicpIHJldHVybiBtYXRjaGVzO1xuICAgICAgaWYgKCFtYXRjaGVzKSByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9LFxuICBvYmplY3RNYXRjaGVzQmFzZUZpbHRlcjogZnVuY3Rpb24ob2JqLCBmaWx0ZXIpIHtcbiAgICB2YXIgZmllbGRzID0gT2JqZWN0LmtleXMoZmlsdGVyKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGZpZWxkcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHVucHJvY2Vzc2VkRmllbGQgPSBmaWVsZHNbaV0sXG4gICAgICAgIHZhbHVlID0gZmlsdGVyW3VucHJvY2Vzc2VkRmllbGRdO1xuICAgICAgdmFyIHJ0ID0gdGhpcy5vYmplY3RNYXRjaGVzKG9iaiwgdW5wcm9jZXNzZWRGaWVsZCwgdmFsdWUsIGZpbHRlcik7XG4gICAgICBpZiAodHlwZW9mIHJ0ICE9ICdib29sZWFuJykgcmV0dXJuIHJ0O1xuICAgICAgaWYgKCFydCkgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSxcbiAgb2JqZWN0TWF0Y2hlc0ZpbHRlcjogZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIHRoaXMub2JqZWN0TWF0Y2hlc0Jhc2VGaWx0ZXIob2JqLCB0aGlzLmZpbHRlcik7XG4gIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEZpbHRlcjtcblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL0ZpbHRlci5qc1xuICoqIG1vZHVsZSBpZCA9IDE1XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCIvKipcbiAqIEBtb2R1bGUgcmVsYXRpb25zaGlwc1xuICovXG5cbnZhciBSZWxhdGlvbnNoaXBQcm94eSA9IHJlcXVpcmUoJy4vUmVsYXRpb25zaGlwUHJveHknKSxcbiAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgd3JhcEFycmF5Rm9yQXR0cmlidXRlcyA9IG1vZGVsRXZlbnRzLndyYXBBcnJheSxcbiAgQXJyYXlPYnNlcnZlciA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuQXJyYXlPYnNlcnZlcixcbiAgTW9kZWxFdmVudFR5cGUgPSBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZTtcblxuLyoqXG4gKiBbTWFueVRvTWFueVByb3h5IGRlc2NyaXB0aW9uXVxuICogQHBhcmFtIHtPYmplY3R9IG9wdHNcbiAqL1xuZnVuY3Rpb24gTWFueVRvTWFueVByb3h5KG9wdHMpIHtcbiAgUmVsYXRpb25zaGlwUHJveHkuY2FsbCh0aGlzLCBvcHRzKTtcbiAgdGhpcy5yZWxhdGVkID0gW107XG4gIHRoaXMucmVsYXRlZENhbmNlbExpc3RlbmVycyA9IHt9O1xuICBpZiAodGhpcy5pc1JldmVyc2UpIHtcbiAgICB0aGlzLnJlbGF0ZWQgPSBbXTtcbiAgICAvL3RoaXMuZm9yd2FyZE1vZGVsLm9uKG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlJlbW92ZSwgZnVuY3Rpb24oZSkge1xuICAgIC8vICBpZiAoZS5maWVsZCA9PSBlLmZvcndhcmROYW1lKSB7XG4gICAgLy8gICAgdmFyIGlkeCA9IHRoaXMucmVsYXRlZC5pbmRleE9mKGUub2JqKTtcbiAgICAvLyAgICBpZiAoaWR4ID4gLTEpIHtcbiAgICAvLyAgICAgIHZhciByZW1vdmVkID0gdGhpcy5yZWxhdGVkLnNwbGljZShpZHgsIDEpO1xuICAgIC8vICAgIH1cbiAgICAvLyAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAvLyAgICAgIGNvbGxlY3Rpb246IHRoaXMucmV2ZXJzZU1vZGVsLmNvbGxlY3Rpb25OYW1lLFxuICAgIC8vICAgICAgbW9kZWw6IHRoaXMucmV2ZXJzZU1vZGVsLm5hbWUsXG4gICAgLy8gICAgICBsb2NhbElkOiB0aGlzLm9iamVjdC5sb2NhbElkLFxuICAgIC8vICAgICAgZmllbGQ6IHRoaXMucmV2ZXJzZU5hbWUsXG4gICAgLy8gICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgIC8vICAgICAgYWRkZWQ6IFtdLFxuICAgIC8vICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgIC8vICAgICAgaW5kZXg6IGlkeCxcbiAgICAvLyAgICAgIG9iajogdGhpcy5vYmplY3RcbiAgICAvLyAgICB9KTtcbiAgICAvLyAgfVxuICAgIC8vfS5iaW5kKHRoaXMpKTtcbiAgfVxufVxuXG5NYW55VG9NYW55UHJveHkucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUpO1xuXG51dGlsLmV4dGVuZChNYW55VG9NYW55UHJveHkucHJvdG90eXBlLCB7XG4gIGNsZWFyUmV2ZXJzZTogZnVuY3Rpb24ocmVtb3ZlZCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICByZW1vdmVkLmZvckVhY2goZnVuY3Rpb24ocmVtb3ZlZE9iamVjdCkge1xuICAgICAgdmFyIHJldmVyc2VQcm94eSA9IHNlbGYucmV2ZXJzZVByb3h5Rm9ySW5zdGFuY2UocmVtb3ZlZE9iamVjdCk7XG4gICAgICB2YXIgaWR4ID0gcmV2ZXJzZVByb3h5LnJlbGF0ZWQuaW5kZXhPZihzZWxmLm9iamVjdCk7XG4gICAgICByZXZlcnNlUHJveHkubWFrZUNoYW5nZXNUb1JlbGF0ZWRXaXRob3V0T2JzZXJ2YXRpb25zKGZ1bmN0aW9uKCkge1xuICAgICAgICByZXZlcnNlUHJveHkuc3BsaWNlKGlkeCwgMSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSxcbiAgc2V0UmV2ZXJzZU9mQWRkZWQ6IGZ1bmN0aW9uKGFkZGVkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGFkZGVkLmZvckVhY2goZnVuY3Rpb24oYWRkZWRPYmplY3QpIHtcbiAgICAgIHZhciByZXZlcnNlUHJveHkgPSBzZWxmLnJldmVyc2VQcm94eUZvckluc3RhbmNlKGFkZGVkT2JqZWN0KTtcbiAgICAgIHJldmVyc2VQcm94eS5tYWtlQ2hhbmdlc1RvUmVsYXRlZFdpdGhvdXRPYnNlcnZhdGlvbnMoZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldmVyc2VQcm94eS5zcGxpY2UoMCwgMCwgc2VsZi5vYmplY3QpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0sXG4gIHdyYXBBcnJheTogZnVuY3Rpb24oYXJyKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHdyYXBBcnJheUZvckF0dHJpYnV0ZXMoYXJyLCB0aGlzLnJldmVyc2VOYW1lLCB0aGlzLm9iamVjdCk7XG4gICAgaWYgKCFhcnIuYXJyYXlPYnNlcnZlcikge1xuICAgICAgYXJyLmFycmF5T2JzZXJ2ZXIgPSBuZXcgQXJyYXlPYnNlcnZlcihhcnIpO1xuICAgICAgdmFyIG9ic2VydmVyRnVuY3Rpb24gPSBmdW5jdGlvbihzcGxpY2VzKSB7XG4gICAgICAgIHNwbGljZXMuZm9yRWFjaChmdW5jdGlvbihzcGxpY2UpIHtcbiAgICAgICAgICB2YXIgYWRkZWQgPSBzcGxpY2UuYWRkZWRDb3VudCA/IGFyci5zbGljZShzcGxpY2UuaW5kZXgsIHNwbGljZS5pbmRleCArIHNwbGljZS5hZGRlZENvdW50KSA6IFtdO1xuICAgICAgICAgIHZhciByZW1vdmVkID0gc3BsaWNlLnJlbW92ZWQ7XG4gICAgICAgICAgc2VsZi5jbGVhclJldmVyc2UocmVtb3ZlZCk7XG4gICAgICAgICAgc2VsZi5zZXRSZXZlcnNlT2ZBZGRlZChhZGRlZCk7XG4gICAgICAgICAgdmFyIG1vZGVsID0gc2VsZi5nZXRGb3J3YXJkTW9kZWwoKTtcbiAgICAgICAgICBtb2RlbC5jb250ZXh0LmJyb2FkY2FzdCh7XG4gICAgICAgICAgICBjb2xsZWN0aW9uOiBtb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgIG1vZGVsOiBtb2RlbC5uYW1lLFxuICAgICAgICAgICAgbG9jYWxJZDogc2VsZi5vYmplY3QubG9jYWxJZCxcbiAgICAgICAgICAgIGZpZWxkOiBzZWxmLmdldEZvcndhcmROYW1lKCksXG4gICAgICAgICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgICAgICAgICAgYWRkZWQ6IGFkZGVkLFxuICAgICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgaW5kZXg6IHNwbGljZS5pbmRleCxcbiAgICAgICAgICAgIG9iajogc2VsZi5vYmplY3RcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgICAgYXJyLmFycmF5T2JzZXJ2ZXIub3BlbihvYnNlcnZlckZ1bmN0aW9uKTtcbiAgICB9XG4gIH0sXG4gIGdldDogZnVuY3Rpb24oY2IpIHtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgY2IobnVsbCwgdGhpcy5yZWxhdGVkKTtcbiAgICB9LmJpbmQodGhpcykpO1xuICB9LFxuICB2YWxpZGF0ZTogZnVuY3Rpb24ob2JqKSB7XG4gICAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopICE9ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICAgIHJldHVybiAnQ2Fubm90IGFzc2lnbiBzY2FsYXIgdG8gbWFueSB0byBtYW55JztcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH0sXG4gIHNldDogZnVuY3Rpb24ob2JqLCBvcHRzKSB7XG4gICAgdGhpcy5jaGVja0luc3RhbGxlZCgpO1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAob2JqKSB7XG4gICAgICB2YXIgZXJyb3JNZXNzYWdlO1xuICAgICAgaWYgKGVycm9yTWVzc2FnZSA9IHRoaXMudmFsaWRhdGUob2JqKSkge1xuICAgICAgICByZXR1cm4gZXJyb3JNZXNzYWdlO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHRoaXMuY2xlYXJSZXZlcnNlUmVsYXRlZChvcHRzKTtcbiAgICAgICAgc2VsZi5zZXRJZEFuZFJlbGF0ZWQob2JqLCBvcHRzKTtcbiAgICAgICAgdGhpcy53cmFwQXJyYXkob2JqKTtcbiAgICAgICAgc2VsZi5zZXRJZEFuZFJlbGF0ZWRSZXZlcnNlKG9iaiwgb3B0cyk7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhpcy5jbGVhclJldmVyc2VSZWxhdGVkKG9wdHMpO1xuICAgICAgc2VsZi5zZXRJZEFuZFJlbGF0ZWQob2JqLCBvcHRzKTtcbiAgICB9XG4gIH0sXG4gIGluc3RhbGw6IGZ1bmN0aW9uKG9iaikge1xuICAgIFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZS5pbnN0YWxsLmNhbGwodGhpcywgb2JqKTtcbiAgICB0aGlzLndyYXBBcnJheSh0aGlzLnJlbGF0ZWQpO1xuICAgIG9ialsoJ3NwbGljZScgKyB1dGlsLmNhcGl0YWxpc2VGaXJzdExldHRlcih0aGlzLnJldmVyc2VOYW1lKSldID0gdGhpcy5zcGxpY2UuYmluZCh0aGlzKTtcbiAgfSxcbiAgcmVnaXN0ZXJSZW1vdmFsTGlzdGVuZXI6IGZ1bmN0aW9uKG9iaikge1xuICAgIHRoaXMucmVsYXRlZENhbmNlbExpc3RlbmVyc1tvYmoubG9jYWxJZF0gPSBvYmoub24oJyonLCBmdW5jdGlvbihlKSB7XG5cbiAgICB9LmJpbmQodGhpcykpO1xuICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBNYW55VG9NYW55UHJveHk7XG5cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vY29yZS9NYW55VG9NYW55UHJveHkuanNcbiAqKiBtb2R1bGUgaWQgPSAxNlxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwidmFyIFJlbGF0aW9uc2hpcFByb3h5ID0gcmVxdWlyZSgnLi9SZWxhdGlvbnNoaXBQcm94eScpLFxuICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzID0gbW9kZWxFdmVudHMud3JhcEFycmF5LFxuICBBcnJheU9ic2VydmVyID0gcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKS5BcnJheU9ic2VydmVyLFxuICBNb2RlbEV2ZW50VHlwZSA9IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlO1xuXG4vKipcbiAqIEBjbGFzcyAgW09uZVRvTWFueVByb3h5IGRlc2NyaXB0aW9uXVxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0ge1t0eXBlXX0gb3B0c1xuICovXG5mdW5jdGlvbiBPbmVUb01hbnlQcm94eShvcHRzKSB7XG4gIFJlbGF0aW9uc2hpcFByb3h5LmNhbGwodGhpcywgb3B0cyk7XG4gIGlmICh0aGlzLmlzUmV2ZXJzZSkge1xuICAgIHRoaXMucmVsYXRlZCA9IFtdO1xuICB9XG59XG5cbk9uZVRvTWFueVByb3h5LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoUmVsYXRpb25zaGlwUHJveHkucHJvdG90eXBlKTtcblxudXRpbC5leHRlbmQoT25lVG9NYW55UHJveHkucHJvdG90eXBlLCB7XG4gIGNsZWFyUmV2ZXJzZTogZnVuY3Rpb24ocmVtb3ZlZCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICByZW1vdmVkLmZvckVhY2goZnVuY3Rpb24ocmVtb3ZlZE9iamVjdCkge1xuICAgICAgdmFyIHJldmVyc2VQcm94eSA9IHNlbGYucmV2ZXJzZVByb3h5Rm9ySW5zdGFuY2UocmVtb3ZlZE9iamVjdCk7XG4gICAgICByZXZlcnNlUHJveHkuc2V0SWRBbmRSZWxhdGVkKG51bGwpO1xuICAgIH0pO1xuICB9LFxuICBzZXRSZXZlcnNlT2ZBZGRlZDogZnVuY3Rpb24oYWRkZWQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgYWRkZWQuZm9yRWFjaChmdW5jdGlvbihhZGRlZCkge1xuICAgICAgdmFyIGZvcndhcmRQcm94eSA9IHNlbGYucmV2ZXJzZVByb3h5Rm9ySW5zdGFuY2UoYWRkZWQpO1xuICAgICAgZm9yd2FyZFByb3h5LnNldElkQW5kUmVsYXRlZChzZWxmLm9iamVjdCk7XG4gICAgfSk7XG4gIH0sXG4gIHdyYXBBcnJheTogZnVuY3Rpb24oYXJyKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHdyYXBBcnJheUZvckF0dHJpYnV0ZXMoYXJyLCB0aGlzLnJldmVyc2VOYW1lLCB0aGlzLm9iamVjdCk7XG4gICAgaWYgKCFhcnIuYXJyYXlPYnNlcnZlcikge1xuICAgICAgYXJyLmFycmF5T2JzZXJ2ZXIgPSBuZXcgQXJyYXlPYnNlcnZlcihhcnIpO1xuICAgICAgdmFyIG9ic2VydmVyRnVuY3Rpb24gPSBmdW5jdGlvbihzcGxpY2VzKSB7XG4gICAgICAgIHNwbGljZXMuZm9yRWFjaChmdW5jdGlvbihzcGxpY2UpIHtcbiAgICAgICAgICB2YXIgYWRkZWQgPSBzcGxpY2UuYWRkZWRDb3VudCA/IGFyci5zbGljZShzcGxpY2UuaW5kZXgsIHNwbGljZS5pbmRleCArIHNwbGljZS5hZGRlZENvdW50KSA6IFtdO1xuICAgICAgICAgIHZhciByZW1vdmVkID0gc3BsaWNlLnJlbW92ZWQ7XG4gICAgICAgICAgc2VsZi5jbGVhclJldmVyc2UocmVtb3ZlZCk7XG4gICAgICAgICAgc2VsZi5zZXRSZXZlcnNlT2ZBZGRlZChhZGRlZCk7XG4gICAgICAgICAgdmFyIG1vZGVsID0gc2VsZi5nZXRGb3J3YXJkTW9kZWwoKTtcbiAgICAgICAgICBtb2RlbC5jb250ZXh0LmJyb2FkY2FzdCh7XG4gICAgICAgICAgICBjb2xsZWN0aW9uOiBtb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgIG1vZGVsOiBtb2RlbC5uYW1lLFxuICAgICAgICAgICAgbG9jYWxJZDogc2VsZi5vYmplY3QubG9jYWxJZCxcbiAgICAgICAgICAgIGZpZWxkOiBzZWxmLmdldEZvcndhcmROYW1lKCksXG4gICAgICAgICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgICAgICAgICAgYWRkZWQ6IGFkZGVkLFxuICAgICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgaW5kZXg6IHNwbGljZS5pbmRleCxcbiAgICAgICAgICAgIG9iajogc2VsZi5vYmplY3RcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgICAgYXJyLmFycmF5T2JzZXJ2ZXIub3BlbihvYnNlcnZlckZ1bmN0aW9uKTtcbiAgICB9XG4gIH0sXG4gIGdldDogZnVuY3Rpb24oY2IpIHtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgY2IobnVsbCwgdGhpcy5yZWxhdGVkKTtcbiAgICB9LmJpbmQodGhpcykpO1xuICB9LFxuICAvKipcbiAgICogVmFsaWRhdGUgdGhlIG9iamVjdCB0aGF0IHdlJ3JlIHNldHRpbmdcbiAgICogQHBhcmFtIG9ialxuICAgKiBAcmV0dXJucyB7c3RyaW5nfG51bGx9IEFuIGVycm9yIG1lc3NhZ2Ugb3IgbnVsbFxuICAgKiBAY2xhc3MgT25lVG9NYW55UHJveHlcbiAgICovXG4gIHZhbGlkYXRlOiBmdW5jdGlvbihvYmopIHtcbiAgICB2YXIgc3RyID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaik7XG4gICAgaWYgKHRoaXMuaXNGb3J3YXJkKSB7XG4gICAgICBpZiAoc3RyID09ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICAgICAgcmV0dXJuICdDYW5ub3QgYXNzaWduIGFycmF5IGZvcndhcmQgb25lVG9NYW55ICgnICsgc3RyICsgJyk6ICcgKyB0aGlzLmZvcndhcmROYW1lO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGlmIChzdHIgIT0gJ1tvYmplY3QgQXJyYXldJykge1xuICAgICAgICByZXR1cm4gJ0Nhbm5vdCBzY2FsYXIgdG8gcmV2ZXJzZSBvbmVUb01hbnkgKCcgKyBzdHIgKyAnKTogJyArIHRoaXMucmV2ZXJzZU5hbWU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9LFxuICBzZXQ6IGZ1bmN0aW9uKG9iaiwgb3B0cykge1xuICAgIHRoaXMuY2hlY2tJbnN0YWxsZWQoKTtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKG9iaikge1xuICAgICAgdmFyIGVycm9yTWVzc2FnZTtcbiAgICAgIGlmIChlcnJvck1lc3NhZ2UgPSB0aGlzLnZhbGlkYXRlKG9iaikpIHtcbiAgICAgICAgcmV0dXJuIGVycm9yTWVzc2FnZTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICB0aGlzLmNsZWFyUmV2ZXJzZVJlbGF0ZWQob3B0cyk7XG4gICAgICAgIHNlbGYuc2V0SWRBbmRSZWxhdGVkKG9iaiwgb3B0cyk7XG4gICAgICAgIGlmIChzZWxmLmlzUmV2ZXJzZSkge1xuICAgICAgICAgIHRoaXMud3JhcEFycmF5KHNlbGYucmVsYXRlZCk7XG4gICAgICAgIH1cbiAgICAgICAgc2VsZi5zZXRJZEFuZFJlbGF0ZWRSZXZlcnNlKG9iaiwgb3B0cyk7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhpcy5jbGVhclJldmVyc2VSZWxhdGVkKG9wdHMpO1xuICAgICAgc2VsZi5zZXRJZEFuZFJlbGF0ZWQob2JqLCBvcHRzKTtcbiAgICB9XG4gIH0sXG4gIGluc3RhbGw6IGZ1bmN0aW9uKG9iaikge1xuICAgIFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZS5pbnN0YWxsLmNhbGwodGhpcywgb2JqKTtcblxuICAgIGlmICh0aGlzLmlzUmV2ZXJzZSkge1xuICAgICAgb2JqWygnc3BsaWNlJyArIHV0aWwuY2FwaXRhbGlzZUZpcnN0TGV0dGVyKHRoaXMucmV2ZXJzZU5hbWUpKV0gPSB0aGlzLnNwbGljZS5iaW5kKHRoaXMpO1xuICAgICAgdGhpcy53cmFwQXJyYXkodGhpcy5yZWxhdGVkKTtcbiAgICB9XG5cbiAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gT25lVG9NYW55UHJveHk7XG5cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vY29yZS9PbmVUb01hbnlQcm94eS5qc1xuICoqIG1vZHVsZSBpZCA9IDE3XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJ2YXIgUmVsYXRpb25zaGlwUHJveHkgPSByZXF1aXJlKCcuL1JlbGF0aW9uc2hpcFByb3h5JyksXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgU2llc3RhTW9kZWwgPSByZXF1aXJlKCcuL01vZGVsSW5zdGFuY2UnKTtcblxuLyoqXG4gKiBbT25lVG9PbmVQcm94eSBkZXNjcmlwdGlvbl1cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gKi9cbmZ1bmN0aW9uIE9uZVRvT25lUHJveHkob3B0cykge1xuICBSZWxhdGlvbnNoaXBQcm94eS5jYWxsKHRoaXMsIG9wdHMpO1xufVxuXG5cbk9uZVRvT25lUHJveHkucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUpO1xuXG51dGlsLmV4dGVuZChPbmVUb09uZVByb3h5LnByb3RvdHlwZSwge1xuICAvKipcbiAgICogVmFsaWRhdGUgdGhlIG9iamVjdCB0aGF0IHdlJ3JlIHNldHRpbmdcbiAgICogQHBhcmFtIG9ialxuICAgKiBAcmV0dXJucyB7c3RyaW5nfG51bGx9IEFuIGVycm9yIG1lc3NhZ2Ugb3IgbnVsbFxuICAgKi9cbiAgdmFsaWRhdGU6IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSA9PSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICByZXR1cm4gJ0Nhbm5vdCBhc3NpZ24gYXJyYXkgdG8gb25lIHRvIG9uZSByZWxhdGlvbnNoaXAnO1xuICAgIH1cbiAgICBlbHNlIGlmICgoIW9iaiBpbnN0YW5jZW9mIFNpZXN0YU1vZGVsKSkge1xuXG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9LFxuICBzZXQ6IGZ1bmN0aW9uKG9iaiwgb3B0cykge1xuICAgIHRoaXMuY2hlY2tJbnN0YWxsZWQoKTtcbiAgICBpZiAob2JqKSB7XG4gICAgICB2YXIgZXJyb3JNZXNzYWdlO1xuICAgICAgaWYgKGVycm9yTWVzc2FnZSA9IHRoaXMudmFsaWRhdGUob2JqKSkge1xuICAgICAgICByZXR1cm4gZXJyb3JNZXNzYWdlO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHRoaXMuY2xlYXJSZXZlcnNlUmVsYXRlZChvcHRzKTtcbiAgICAgICAgdGhpcy5zZXRJZEFuZFJlbGF0ZWQob2JqLCBvcHRzKTtcbiAgICAgICAgdGhpcy5zZXRJZEFuZFJlbGF0ZWRSZXZlcnNlKG9iaiwgb3B0cyk7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhpcy5jbGVhclJldmVyc2VSZWxhdGVkKG9wdHMpO1xuICAgICAgdGhpcy5zZXRJZEFuZFJlbGF0ZWQob2JqLCBvcHRzKTtcbiAgICB9XG4gIH0sXG4gIGdldDogZnVuY3Rpb24oY2IpIHtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgY2IobnVsbCwgdGhpcy5yZWxhdGVkKTtcbiAgICB9LmJpbmQodGhpcykpO1xuICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBPbmVUb09uZVByb3h5O1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL09uZVRvT25lUHJveHkuanNcbiAqKiBtb2R1bGUgaWQgPSAxOFxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwiLyoqXG4gKiBCYXNlIGZ1bmN0aW9uYWxpdHkgZm9yIHJlbGF0aW9uc2hpcHMuXG4gKiBAbW9kdWxlIHJlbGF0aW9uc2hpcHNcbiAqL1xudmFyIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICBRdWVyeSA9IHJlcXVpcmUoJy4vRmlsdGVyJyksXG4gIGxvZyA9IHJlcXVpcmUoJy4vbG9nJyksXG4gIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzID0gbW9kZWxFdmVudHMud3JhcEFycmF5LFxuICBBcnJheU9ic2VydmVyID0gcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKS5BcnJheU9ic2VydmVyLFxuICBNb2RlbEV2ZW50VHlwZSA9IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlO1xuXG4vKipcbiAqIEBjbGFzcyAgW1JlbGF0aW9uc2hpcFByb3h5IGRlc2NyaXB0aW9uXVxuICogQHBhcmFtIHtPYmplY3R9IG9wdHNcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBSZWxhdGlvbnNoaXBQcm94eShvcHRzKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgb3B0cyA9IG9wdHMgfHwge307XG5cbiAgdXRpbC5leHRlbmQodGhpcywge1xuICAgIG9iamVjdDogbnVsbCxcbiAgICByZWxhdGVkOiBudWxsXG4gIH0pO1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHRoaXMsIHtcbiAgICBpc0ZvcndhcmQ6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAhc2VsZi5pc1JldmVyc2U7XG4gICAgICB9LFxuICAgICAgc2V0OiBmdW5jdGlvbih2KSB7XG4gICAgICAgIHNlbGYuaXNSZXZlcnNlID0gIXY7XG4gICAgICB9LFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH1cbiAgfSk7XG5cbiAgdXRpbC5leHRlbmRGcm9tT3B0cyh0aGlzLCBvcHRzLCB7XG4gICAgcmV2ZXJzZU1vZGVsOiBudWxsLFxuICAgIGZvcndhcmRNb2RlbDogbnVsbCxcbiAgICBmb3J3YXJkTmFtZTogbnVsbCxcbiAgICByZXZlcnNlTmFtZTogbnVsbCxcbiAgICBpc1JldmVyc2U6IG51bGwsXG4gICAgc2VyaWFsaXNlOiBudWxsXG4gIH0sIGZhbHNlKTtcblxuICB0aGlzLmNhbmNlbExpc3RlbnMgPSB7fTtcbn1cblxudXRpbC5leHRlbmQoUmVsYXRpb25zaGlwUHJveHksIHt9KTtcblxudXRpbC5leHRlbmQoUmVsYXRpb25zaGlwUHJveHkucHJvdG90eXBlLCB7XG4gIC8qKlxuICAgKiBJbnN0YWxsIHRoaXMgcHJveHkgb24gdGhlIGdpdmVuIGluc3RhbmNlXG4gICAqIEBwYXJhbSB7TW9kZWxJbnN0YW5jZX0gbW9kZWxJbnN0YW5jZVxuICAgKi9cbiAgaW5zdGFsbDogZnVuY3Rpb24obW9kZWxJbnN0YW5jZSkge1xuICAgIGlmIChtb2RlbEluc3RhbmNlKSB7XG4gICAgICBpZiAoIXRoaXMub2JqZWN0KSB7XG4gICAgICAgIHRoaXMub2JqZWN0ID0gbW9kZWxJbnN0YW5jZTtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICB2YXIgbmFtZSA9IHRoaXMuZ2V0Rm9yd2FyZE5hbWUoKTtcblxuICAgICAgICAvLyBJZiBpdCdzIGEgc3ViY2xhc3MsIGEgcHJveHkgd2lsbCBhbHJlYWR5IGV4aXN0LiBUaGVyZWZvcmUgbm8gbmVlZCB0byBpbnN0YWxsLlxuICAgICAgICBpZiAoIW1vZGVsSW5zdGFuY2UuX19wcm94aWVzW25hbWVdKSB7XG4gICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG1vZGVsSW5zdGFuY2UsIG5hbWUsIHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgIHJldHVybiBzZWxmLnJlbGF0ZWQ7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2V0OiBmdW5jdGlvbih2KSB7XG4gICAgICAgICAgICAgIHNlbGYuc2V0KHYpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIG1vZGVsSW5zdGFuY2UuX19wcm94aWVzW25hbWVdID0gdGhpcztcbiAgICAgICAgICBtb2RlbEluc3RhbmNlLl9wcm94aWVzLnB1c2godGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ0FscmVhZHkgaW5zdGFsbGVkLicpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gb2JqZWN0IHBhc3NlZCB0byByZWxhdGlvbnNoaXAgaW5zdGFsbCcpO1xuICAgIH1cbiAgfVxuXG59KTtcblxuLy9ub2luc3BlY3Rpb24gSlNVbnVzZWRMb2NhbFN5bWJvbHNcbnV0aWwuZXh0ZW5kKFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZSwge1xuICBzZXQ6IGZ1bmN0aW9uKG9iaiwgb3B0cykge1xuICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNdXN0IHN1YmNsYXNzIFJlbGF0aW9uc2hpcFByb3h5Jyk7XG4gIH0sXG4gIGdldDogZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTXVzdCBzdWJjbGFzcyBSZWxhdGlvbnNoaXBQcm94eScpO1xuICB9XG59KTtcblxudXRpbC5leHRlbmQoUmVsYXRpb25zaGlwUHJveHkucHJvdG90eXBlLCB7XG4gIHByb3h5Rm9ySW5zdGFuY2U6IGZ1bmN0aW9uKG1vZGVsSW5zdGFuY2UsIHJldmVyc2UpIHtcbiAgICB2YXIgbmFtZSA9IHJldmVyc2UgPyB0aGlzLmdldFJldmVyc2VOYW1lKCkgOiB0aGlzLmdldEZvcndhcmROYW1lKCksXG4gICAgICBtb2RlbCA9IHJldmVyc2UgPyB0aGlzLnJldmVyc2VNb2RlbCA6IHRoaXMuZm9yd2FyZE1vZGVsO1xuICAgIHZhciByZXQ7XG4gICAgLy8gVGhpcyBzaG91bGQgbmV2ZXIgaGFwcGVuLiBTaG91bGQgZyAgIGV0IGNhdWdodCBpbiB0aGUgbWFwcGluZyBvcGVyYXRpb24/XG4gICAgaWYgKHV0aWwuaXNBcnJheShtb2RlbEluc3RhbmNlKSkge1xuICAgICAgcmV0ID0gbW9kZWxJbnN0YW5jZS5tYXAoZnVuY3Rpb24obykge1xuICAgICAgICByZXR1cm4gby5fX3Byb3hpZXNbbmFtZV07XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIHByb3hpZXMgPSBtb2RlbEluc3RhbmNlLl9fcHJveGllcztcbiAgICAgIHZhciBwcm94eSA9IHByb3hpZXNbbmFtZV07XG4gICAgICBpZiAoIXByb3h5KSB7XG4gICAgICAgIHZhciBlcnIgPSAnTm8gcHJveHkgd2l0aCBuYW1lIFwiJyArIG5hbWUgKyAnXCIgb24gbWFwcGluZyAnICsgbW9kZWwubmFtZTtcbiAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoZXJyKTtcbiAgICAgIH1cbiAgICAgIHJldCA9IHByb3h5O1xuICAgIH1cbiAgICByZXR1cm4gcmV0O1xuICB9LFxuICByZXZlcnNlUHJveHlGb3JJbnN0YW5jZTogZnVuY3Rpb24obW9kZWxJbnN0YW5jZSkge1xuICAgIHJldHVybiB0aGlzLnByb3h5Rm9ySW5zdGFuY2UobW9kZWxJbnN0YW5jZSwgdHJ1ZSk7XG4gIH0sXG4gIGdldFJldmVyc2VOYW1lOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5pc0ZvcndhcmQgPyB0aGlzLnJldmVyc2VOYW1lIDogdGhpcy5mb3J3YXJkTmFtZTtcbiAgfSxcbiAgZ2V0Rm9yd2FyZE5hbWU6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmlzRm9yd2FyZCA/IHRoaXMuZm9yd2FyZE5hbWUgOiB0aGlzLnJldmVyc2VOYW1lO1xuICB9LFxuICBnZXRGb3J3YXJkTW9kZWw6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmlzRm9yd2FyZCA/IHRoaXMuZm9yd2FyZE1vZGVsIDogdGhpcy5yZXZlcnNlTW9kZWw7XG4gIH0sXG4gIC8qKlxuICAgKiBDb25maWd1cmUgX2lkIGFuZCByZWxhdGVkIHdpdGggdGhlIG5ldyByZWxhdGVkIG9iamVjdC5cbiAgICogQHBhcmFtIG9ialxuICAgKiBAcGFyYW0ge29iamVjdH0gW29wdHNdXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdHMuZGlzYWJsZU5vdGlmaWNhdGlvbnNdXG4gICAqIEByZXR1cm5zIHtTdHJpbmd8dW5kZWZpbmVkfSAtIEVycm9yIG1lc3NhZ2Ugb3IgdW5kZWZpbmVkXG4gICAqL1xuICBzZXRJZEFuZFJlbGF0ZWQ6IGZ1bmN0aW9uKG9iaiwgb3B0cykge1xuICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgIGlmICghb3B0cy5kaXNhYmxlZXZlbnRzKSB2YXIgb2xkVmFsdWUgPSB0aGlzLl9nZXRPbGRWYWx1ZUZvclNldENoYW5nZUV2ZW50KCk7XG4gICAgaWYgKG9iaikge1xuICAgICAgaWYgKHV0aWwuaXNBcnJheShvYmopKSB7XG4gICAgICAgIHRoaXMucmVsYXRlZCA9IG9iajtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMucmVsYXRlZCA9IG9iajtcbiAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICB0aGlzLnJlbGF0ZWQgPSBudWxsO1xuICAgIH1cbiAgICBpZiAoIW9wdHMuZGlzYWJsZWV2ZW50cykgdGhpcy5yZWdpc3RlclNldENoYW5nZShvYmosIG9sZFZhbHVlKTtcbiAgfSxcbiAgY2hlY2tJbnN0YWxsZWQ6IGZ1bmN0aW9uKCkge1xuICAgIGlmICghdGhpcy5vYmplY3QpIHtcbiAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdQcm94eSBtdXN0IGJlIGluc3RhbGxlZCBvbiBhbiBvYmplY3QgYmVmb3JlIGNhbiB1c2UgaXQuJyk7XG4gICAgfVxuICB9LFxuICBzcGxpY2VyOiBmdW5jdGlvbihvcHRzKSB7XG4gICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgcmV0dXJuIGZ1bmN0aW9uKGlkeCwgbnVtUmVtb3ZlKSB7XG4gICAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICAgIGlmICghb3B0cy5kaXNhYmxlZXZlbnRzKSB7XG4gICAgICAgIHZhciBhZGRlZCA9IHRoaXMuX2dldEFkZGVkRm9yU3BsaWNlQ2hhbmdlRXZlbnQoYXJndW1lbnRzKSxcbiAgICAgICAgICByZW1vdmVkID0gdGhpcy5fZ2V0UmVtb3ZlZEZvclNwbGljZUNoYW5nZUV2ZW50KGlkeCwgbnVtUmVtb3ZlKTtcbiAgICAgIH1cbiAgICAgIHZhciBhZGQgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgICAgdmFyIHJlcyA9IHRoaXMucmVsYXRlZC5zcGxpY2UuYmluZCh0aGlzLnJlbGF0ZWQsIGlkeCwgbnVtUmVtb3ZlKS5hcHBseSh0aGlzLnJlbGF0ZWQsIGFkZCk7XG4gICAgICBpZiAoIW9wdHMuZGlzYWJsZWV2ZW50cykgdGhpcy5yZWdpc3RlclNwbGljZUNoYW5nZShpZHgsIGFkZGVkLCByZW1vdmVkKTtcbiAgICAgIHJldHVybiByZXM7XG4gICAgfS5iaW5kKHRoaXMpO1xuICB9LFxuICBjbGVhclJldmVyc2VSZWxhdGVkOiBmdW5jdGlvbihvcHRzKSB7XG4gICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICh0aGlzLnJlbGF0ZWQpIHtcbiAgICAgIHZhciByZXZlcnNlUHJveHkgPSB0aGlzLnJldmVyc2VQcm94eUZvckluc3RhbmNlKHRoaXMucmVsYXRlZCk7XG4gICAgICB2YXIgcmV2ZXJzZVByb3hpZXMgPSB1dGlsLmlzQXJyYXkocmV2ZXJzZVByb3h5KSA/IHJldmVyc2VQcm94eSA6IFtyZXZlcnNlUHJveHldO1xuICAgICAgcmV2ZXJzZVByb3hpZXMuZm9yRWFjaChmdW5jdGlvbihwKSB7XG4gICAgICAgIGlmICh1dGlsLmlzQXJyYXkocC5yZWxhdGVkKSkge1xuICAgICAgICAgIHZhciBpZHggPSBwLnJlbGF0ZWQuaW5kZXhPZihzZWxmLm9iamVjdCk7XG4gICAgICAgICAgcC5tYWtlQ2hhbmdlc1RvUmVsYXRlZFdpdGhvdXRPYnNlcnZhdGlvbnMoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBwLnNwbGljZXIob3B0cykoaWR4LCAxKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwLnNldElkQW5kUmVsYXRlZChudWxsLCBvcHRzKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9LFxuICBzZXRJZEFuZFJlbGF0ZWRSZXZlcnNlOiBmdW5jdGlvbihvYmosIG9wdHMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHJldmVyc2VQcm94eSA9IHRoaXMucmV2ZXJzZVByb3h5Rm9ySW5zdGFuY2Uob2JqKTtcbiAgICB2YXIgcmV2ZXJzZVByb3hpZXMgPSB1dGlsLmlzQXJyYXkocmV2ZXJzZVByb3h5KSA/IHJldmVyc2VQcm94eSA6IFtyZXZlcnNlUHJveHldO1xuICAgIHJldmVyc2VQcm94aWVzLmZvckVhY2goZnVuY3Rpb24ocCkge1xuICAgICAgaWYgKHV0aWwuaXNBcnJheShwLnJlbGF0ZWQpKSB7XG4gICAgICAgIHAubWFrZUNoYW5nZXNUb1JlbGF0ZWRXaXRob3V0T2JzZXJ2YXRpb25zKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHAuc3BsaWNlcihvcHRzKShwLnJlbGF0ZWQubGVuZ3RoLCAwLCBzZWxmLm9iamVjdCk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcC5jbGVhclJldmVyc2VSZWxhdGVkKG9wdHMpO1xuICAgICAgICBwLnNldElkQW5kUmVsYXRlZChzZWxmLm9iamVjdCwgb3B0cyk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG4gIG1ha2VDaGFuZ2VzVG9SZWxhdGVkV2l0aG91dE9ic2VydmF0aW9uczogZnVuY3Rpb24oZikge1xuICAgIGlmICh0aGlzLnJlbGF0ZWQpIHtcbiAgICAgIHRoaXMucmVsYXRlZC5hcnJheU9ic2VydmVyLmNsb3NlKCk7XG4gICAgICB0aGlzLnJlbGF0ZWQuYXJyYXlPYnNlcnZlciA9IG51bGw7XG4gICAgICBmKCk7XG4gICAgICB0aGlzLndyYXBBcnJheSh0aGlzLnJlbGF0ZWQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBmKCk7XG4gICAgfVxuICB9LFxuICAvKipcbiAgICogR2V0IG9sZCB2YWx1ZSB0aGF0IGlzIHNlbnQgb3V0IGluIGVtaXNzaW9ucy5cbiAgICogQHJldHVybnMgeyp9XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfZ2V0T2xkVmFsdWVGb3JTZXRDaGFuZ2VFdmVudDogZnVuY3Rpb24oKSB7XG4gICAgdmFyIG9sZFZhbHVlID0gdGhpcy5yZWxhdGVkO1xuICAgIGlmICh1dGlsLmlzQXJyYXkob2xkVmFsdWUpICYmICFvbGRWYWx1ZS5sZW5ndGgpIHtcbiAgICAgIG9sZFZhbHVlID0gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIG9sZFZhbHVlO2dcbiAgfSxcbiAgcmVnaXN0ZXJTZXRDaGFuZ2U6IGZ1bmN0aW9uKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgIHZhciBwcm94eU9iamVjdCA9IHRoaXMub2JqZWN0O1xuICAgIGlmICghcHJveHlPYmplY3QpIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdQcm94eSBtdXN0IGhhdmUgYW4gb2JqZWN0IGFzc29jaWF0ZWQnKTtcbiAgICB2YXIgbW9kZWwgPSBwcm94eU9iamVjdC5tb2RlbDtcbiAgICB2YXIgbW9kZWxOYW1lID0gbW9kZWwubmFtZTtcbiAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBwcm94eU9iamVjdC5jb2xsZWN0aW9uTmFtZTtcbiAgICAvLyBXZSB0YWtlIFtdID09IG51bGwgPT0gdW5kZWZpbmVkIGluIHRoZSBjYXNlIG9mIHJlbGF0aW9uc2hpcHMuXG4gICAgbW9kZWwuY29udGV4dC5icm9hZGNhc3Qoe1xuICAgICAgY29sbGVjdGlvbjogY29sbGVjdGlvbk5hbWUsXG4gICAgICBtb2RlbDogbW9kZWxOYW1lLFxuICAgICAgbG9jYWxJZDogcHJveHlPYmplY3QubG9jYWxJZCxcbiAgICAgIGZpZWxkOiB0aGlzLmdldEZvcndhcmROYW1lKCksXG4gICAgICBvbGQ6IG9sZFZhbHVlLFxuICAgICAgbmV3OiBuZXdWYWx1ZSxcbiAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNldCxcbiAgICAgIG9iajogcHJveHlPYmplY3RcbiAgICB9KTtcbiAgfSxcblxuICBfZ2V0UmVtb3ZlZEZvclNwbGljZUNoYW5nZUV2ZW50OiBmdW5jdGlvbihpZHgsIG51bVJlbW92ZSkge1xuICAgIHJldHVybiB0aGlzLnJlbGF0ZWQgPyB0aGlzLnJlbGF0ZWQuc2xpY2UoaWR4LCBpZHggKyBudW1SZW1vdmUpIDogbnVsbDtcbiAgfSxcblxuICBfZ2V0QWRkZWRGb3JTcGxpY2VDaGFuZ2VFdmVudDogZnVuY3Rpb24oYXJncykge1xuICAgIHZhciBhZGQgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmdzLCAyKTtcbiAgICByZXR1cm4gYWRkLmxlbmd0aCA/IGFkZCA6IFtdO1xuICB9LFxuXG4gIHJlZ2lzdGVyU3BsaWNlQ2hhbmdlOiBmdW5jdGlvbihpZHgsIGFkZGVkLCByZW1vdmVkKSB7XG4gICAgdmFyIG1vZGVsID0gdGhpcy5vYmplY3QubW9kZWwsXG4gICAgICBtb2RlbE5hbWUgPSBtb2RlbC5uYW1lLFxuICAgICAgY29sbCA9IHRoaXMub2JqZWN0LmNvbGxlY3Rpb25OYW1lO1xuICAgIG1vZGVsLmNvbnRleHQuYnJvYWRjYXN0KHtcbiAgICAgIGNvbGxlY3Rpb246IGNvbGwsXG4gICAgICBtb2RlbDogbW9kZWxOYW1lLFxuICAgICAgbG9jYWxJZDogdGhpcy5vYmplY3QubG9jYWxJZCxcbiAgICAgIGZpZWxkOiB0aGlzLmdldEZvcndhcmROYW1lKCksXG4gICAgICBpbmRleDogaWR4LFxuICAgICAgcmVtb3ZlZDogcmVtb3ZlZCxcbiAgICAgIGFkZGVkOiBhZGRlZCxcbiAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgIG9iajogdGhpcy5vYmplY3RcbiAgICB9KTtcbiAgfSxcbiAgd3JhcEFycmF5OiBmdW5jdGlvbihhcnIpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgd3JhcEFycmF5Rm9yQXR0cmlidXRlcyhhcnIsIHRoaXMucmV2ZXJzZU5hbWUsIHRoaXMub2JqZWN0KTtcbiAgICBpZiAoIWFyci5hcnJheU9ic2VydmVyKSB7XG4gICAgICBhcnIuYXJyYXlPYnNlcnZlciA9IG5ldyBBcnJheU9ic2VydmVyKGFycik7XG4gICAgICB2YXIgb2JzZXJ2ZXJGdW5jdGlvbiA9IGZ1bmN0aW9uKHNwbGljZXMpIHtcbiAgICAgICAgc3BsaWNlcy5mb3JFYWNoKGZ1bmN0aW9uKHNwbGljZSkge1xuICAgICAgICAgIHZhciBhZGRlZCA9IHNwbGljZS5hZGRlZENvdW50ID8gYXJyLnNsaWNlKHNwbGljZS5pbmRleCwgc3BsaWNlLmluZGV4ICsgc3BsaWNlLmFkZGVkQ291bnQpIDogW107XG4gICAgICAgICAgdmFyIG1vZGVsID0gc2VsZi5nZXRGb3J3YXJkTW9kZWwoKTtcbiAgICAgICAgICBtb2RlbC5jb250ZXh0LmJyb2FkY2FzdCh7XG4gICAgICAgICAgICBjb2xsZWN0aW9uOiBtb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgIG1vZGVsOiBtb2RlbC5uYW1lLFxuICAgICAgICAgICAgbG9jYWxJZDogc2VsZi5vYmplY3QubG9jYWxJZCxcbiAgICAgICAgICAgIGZpZWxkOiBzZWxmLmdldEZvcndhcmROYW1lKCksXG4gICAgICAgICAgICByZW1vdmVkOiBzcGxpY2UucmVtb3ZlZCxcbiAgICAgICAgICAgIGFkZGVkOiBhZGRlZCxcbiAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgIG9iajogc2VsZi5vYmplY3RcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgICAgYXJyLmFycmF5T2JzZXJ2ZXIub3BlbihvYnNlcnZlckZ1bmN0aW9uKTtcbiAgICB9XG4gIH0sXG4gIHNwbGljZTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5zcGxpY2VyKHt9KS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICB9XG5cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFJlbGF0aW9uc2hpcFByb3h5O1xuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvUmVsYXRpb25zaGlwUHJveHkuanNcbiAqKiBtb2R1bGUgaWQgPSAxOVxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gIE9uZVRvTWFueTogJ09uZVRvTWFueScsXG4gIE9uZVRvT25lOiAnT25lVG9PbmUnLFxuICBNYW55VG9NYW55OiAnTWFueVRvTWFueSdcbn07XG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvUmVsYXRpb25zaGlwVHlwZS5qc1xuICoqIG1vZHVsZSBpZCA9IDIwXG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4uL2NvcmUvdXRpbCcpLFxuICBlcnJvciA9IHJlcXVpcmUoJy4uL2NvcmUvZXJyb3InKSxcbiAgbG9nID0gcmVxdWlyZSgnLi4vY29yZS9sb2cnKSgnc3RvcmFnZScpO1xuXG4vLyBWYXJpYWJsZXMgYmVnaW5uaW5nIHdpdGggdW5kZXJzY29yZSBhcmUgdHJlYXRlZCBhcyBzcGVjaWFsIGJ5IFBvdWNoREIvQ291Y2hEQiBzbyB3aGVuIHNlcmlhbGlzaW5nIHdlIG5lZWQgdG9cbi8vIHJlcGxhY2Ugd2l0aCBzb21ldGhpbmcgZWxzZS5cbnZhciBVTkRFUlNDT1JFID0gL18vZyxcbiAgVU5ERVJTQ09SRV9SRVBMQUNFTUVOVCA9IC9AL2c7XG5cbi8qKlxuICpcbiAqIEBwYXJhbSBjb250ZXh0XG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSBvcHRzXG4gKi9cbmZ1bmN0aW9uIFN0b3JhZ2UoY29udGV4dCwgb3B0cykge1xuICBpZiAoIXdpbmRvdy5Qb3VjaERCKSB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBlbmFibGUgc3RvcmFnZSBmb3IgYXBwIFwiJyArIG5hbWUgKyAnXCIgYXMgUG91Y2hEQiBpcyBub3QgcHJlc2VudC4nKTtcblxuICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgdmFyIG5hbWUgPSBjb250ZXh0Lm5hbWU7XG5cbiAgdGhpcy5jb250ZXh0ID0gY29udGV4dDtcbiAgdGhpcy51bnNhdmVkT2JqZWN0cyA9IFtdO1xuICB0aGlzLnVuc2F2ZWRPYmplY3RzSGFzaCA9IHt9O1xuICB0aGlzLnVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uID0ge307XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXModGhpcywge1xuICAgIF91bnNhdmVkT2JqZWN0czoge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudW5zYXZlZE9iamVjdHNcbiAgICAgIH1cbiAgICB9LFxuICAgIF91bnNhdmVkT2JqZWN0c0hhc2g6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnVuc2F2ZWRPYmplY3RzSGFzaFxuICAgICAgfVxuICAgIH0sXG4gICAgX3Vuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy51bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvblxuICAgICAgfVxuICAgIH0sXG4gICAgX3BvdWNoOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5wb3VjaFxuICAgICAgfVxuICAgIH1cbiAgfSk7XG5cbiAgdGhpcy5wb3VjaCA9IG9wdHMucG91Y2ggfHwgKG5ldyBQb3VjaERCKG5hbWUsIHthdXRvX2NvbXBhY3Rpb246IHRydWV9KSk7XG59XG5cblN0b3JhZ2UucHJvdG90eXBlID0ge1xuICAvKipcbiAgICogU2F2ZSBhbGwgbW9kZWxFdmVudHMgZG93biB0byBQb3VjaERCLlxuICAgKi9cbiAgc2F2ZTogZnVuY3Rpb24oY2IpIHtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgdGhpcy5jb250ZXh0Ll9lbnN1cmVJbnN0YWxsZWQoZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgdmFyIGluc3RhbmNlcyA9IHRoaXMudW5zYXZlZE9iamVjdHM7XG4gICAgICAgICAgdGhpcy51bnNhdmVkT2JqZWN0cyA9IFtdO1xuICAgICAgICAgIHRoaXMudW5zYXZlZE9iamVjdHNIYXNoID0ge307XG4gICAgICAgICAgdGhpcy51bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbiA9IHt9O1xuICAgICAgICAgIHRoaXMuc2F2ZVRvUG91Y2goaW5zdGFuY2VzLCBjYik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgY2IoZXJyKTtcbiAgICAgICAgfVxuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9LmJpbmQodGhpcykpO1xuICB9LFxuICBzYXZlVG9Qb3VjaDogZnVuY3Rpb24ob2JqZWN0cywgY2IpIHtcbiAgICB2YXIgY29uZmxpY3RzID0gW107XG4gICAgdmFyIHNlcmlhbGlzZWREb2NzID0gb2JqZWN0cy5tYXAodGhpcy5fc2VyaWFsaXNlLmJpbmQodGhpcykpO1xuICAgIHRoaXMucG91Y2guYnVsa0RvY3Moc2VyaWFsaXNlZERvY3MpLnRoZW4oZnVuY3Rpb24ocmVzcCkge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXNwLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciByZXNwb25zZSA9IHJlc3BbaV07XG4gICAgICAgIHZhciBvYmogPSBvYmplY3RzW2ldO1xuICAgICAgICBpZiAocmVzcG9uc2Uub2spIHtcbiAgICAgICAgICBvYmouX3JldiA9IHJlc3BvbnNlLnJldjtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChyZXNwb25zZS5zdGF0dXMgPT0gNDA5KSB7XG4gICAgICAgICAgY29uZmxpY3RzLnB1c2gob2JqKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBsb2coJ0Vycm9yIHNhdmluZyBvYmplY3Qgd2l0aCBsb2NhbElkPVwiJyArIG9iai5sb2NhbElkICsgJ1wiJywgcmVzcG9uc2UpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoY29uZmxpY3RzLmxlbmd0aCkge1xuICAgICAgICB0aGlzLnNhdmVDb25mbGljdHMoY29uZmxpY3RzLCBjYik7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY2IoKTtcbiAgICAgIH1cbiAgICB9LCBmdW5jdGlvbihlcnIpIHtcbiAgICAgIGNiKGVycik7XG4gICAgfSk7XG4gIH0sXG4gIHNhdmVDb25mbGljdHM6IGZ1bmN0aW9uKG9iamVjdHMsIGNiKSB7XG4gICAgdGhpc1xuICAgICAgLnBvdWNoXG4gICAgICAuYWxsRG9jcyh7a2V5czogdXRpbC5wbHVjayhvYmplY3RzLCAnbG9jYWxJZCcpfSlcbiAgICAgIC50aGVuKGZ1bmN0aW9uKHJlc3ApIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXNwLnJvd3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBvYmplY3RzW2ldLl9yZXYgPSByZXNwLnJvd3NbaV0udmFsdWUucmV2O1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc2F2ZVRvUG91Y2gob2JqZWN0cywgY2IpO1xuICAgICAgfSlcbiAgICAgIC5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgY2IoZXJyKTtcbiAgICAgIH0pXG4gIH0sXG4gIC8qKlxuICAgKiBFbnN1cmUgdGhhdCB0aGUgUG91Y2hEQiBpbmRleCBmb3IgdGhlIGdpdmVuIG1vZGVsIGV4aXN0cywgY3JlYXRpbmcgaXQgaWYgbm90LlxuICAgKiBAcGFyYW0gbW9kZWxcbiAgICogQHBhcmFtIGNiXG4gICAqL1xuICBlbnN1cmVJbmRleEluc3RhbGxlZDogZnVuY3Rpb24obW9kZWwsIGNiKSB7XG4gICAgZnVuY3Rpb24gZm4ocmVzcCkge1xuICAgICAgdmFyIGVycjtcbiAgICAgIGlmICghcmVzcC5vaykge1xuICAgICAgICBpZiAocmVzcC5zdGF0dXMgPT0gNDA5KSB7XG4gICAgICAgICAgZXJyID0gbnVsbDtcbiAgICAgICAgICBtb2RlbC5pbmRleEluc3RhbGxlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGNiKGVycik7XG4gICAgfVxuXG4gICAgdGhpc1xuICAgICAgLnBvdWNoXG4gICAgICAucHV0KHRoaXMuY29uc3RydWN0SW5kZXhEZXNpZ25Eb2MobW9kZWwuY29sbGVjdGlvbk5hbWUsIG1vZGVsLm5hbWUpKVxuICAgICAgLnRoZW4oZm4pXG4gICAgICAuY2F0Y2goZm4pO1xuICB9LFxuICAvKipcbiAgICpcbiAgICogQHBhcmFtIG9wdHNcbiAgICogQHBhcmFtIFtvcHRzLmNvbGxlY3Rpb25OYW1lXVxuICAgKiBAcGFyYW0gW29wdHMubW9kZWxOYW1lXVxuICAgKiBAcGFyYW0gW29wdHMubW9kZWxdXG4gICAqIEBwYXJhbSBjYlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgbG9hZE1vZGVsOiBmdW5jdGlvbihvcHRzLCBjYikge1xuICAgIHZhciBsb2FkZWQgPSB7fTtcbiAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBvcHRzLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgbW9kZWxOYW1lID0gb3B0cy5tb2RlbE5hbWUsXG4gICAgICBtb2RlbCA9IG9wdHMubW9kZWw7XG4gICAgaWYgKG1vZGVsKSB7XG4gICAgICBjb2xsZWN0aW9uTmFtZSA9IG1vZGVsLmNvbGxlY3Rpb25OYW1lO1xuICAgICAgbW9kZWxOYW1lID0gbW9kZWwubmFtZTtcbiAgICB9XG5cbiAgICB2YXIgZnVsbHlRdWFsaWZpZWROYW1lID0gdGhpcy5mdWxseVF1YWxpZmllZE1vZGVsTmFtZShjb2xsZWN0aW9uTmFtZSwgbW9kZWxOYW1lKTtcbiAgICB2YXIgTW9kZWwgPSB0aGlzLmNvbnRleHQuY29sbGVjdGlvbnNbY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV07XG5cbiAgICBpZiAoIU1vZGVsKSB7XG4gICAgICBjYignTm8gc3VjaCBtb2RlbCB3aXRoIG5hbWUgXCInICsgbW9kZWxOYW1lICsgJ1wiIGluIGNvbnRleHQuJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpc1xuICAgICAgLnBvdWNoXG4gICAgICAucXVlcnkoZnVsbHlRdWFsaWZpZWROYW1lKVxuICAgICAgLnRoZW4oZnVuY3Rpb24ocmVzcCkge1xuICAgICAgICB2YXIgcm93cyA9IHJlc3Aucm93cztcbiAgICAgICAgdmFyIGRhdGEgPSB1dGlsLnBsdWNrKHJvd3MsICd2YWx1ZScpLm1hcChmdW5jdGlvbihkYXR1bSkge1xuICAgICAgICAgIHJldHVybiB0aGlzLl9wcmVwYXJlRGF0dW0oZGF0dW0sIE1vZGVsKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcblxuICAgICAgICBkYXRhLm1hcChmdW5jdGlvbihkYXR1bSkge1xuICAgICAgICAgIHZhciByZW1vdGVJZCA9IGRhdHVtW01vZGVsLmlkXTtcbiAgICAgICAgICBpZiAocmVtb3RlSWQpIHtcbiAgICAgICAgICAgIGlmIChsb2FkZWRbcmVtb3RlSWRdKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0R1cGxpY2F0ZXMgZGV0ZWN0ZWQgaW4gc3RvcmFnZS4gWW91IGhhdmUgZW5jb3VudGVyZWQgYSBzZXJpb3VzIGJ1Zy4gUGxlYXNlIHJlcG9ydCB0aGlzLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIGxvYWRlZFtyZW1vdGVJZF0gPSBkYXR1bTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIE1vZGVsLl9ncmFwaChkYXRhLCB7XG4gICAgICAgICAgX2lnbm9yZUluc3RhbGxlZDogdHJ1ZSxcbiAgICAgICAgICBkaXNhYmxlZXZlbnRzOiB0cnVlLFxuICAgICAgICAgIGZyb21TdG9yYWdlOiB0cnVlXG4gICAgICAgIH0sIGZ1bmN0aW9uKGVyciwgaW5zdGFuY2VzKSB7XG4gICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdiaW5kaW5nIGxpc3RlbmVyJyk7XG4gICAgICAgICAgICB0aGlzLl9saXN0ZW5lciA9IHRoaXMubGlzdGVuZXIuYmluZCh0aGlzKTtcbiAgICAgICAgICAgIG1vZGVsLm9uKCcqJywgdGhpcy5fbGlzdGVuZXIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGxvYWRpbmcgbW9kZWxzJywgZXJyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY2IoZXJyLCBpbnN0YW5jZXMpO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgfS5iaW5kKHRoaXMpKVxuICAgICAgLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICBjYihlcnIpO1xuICAgICAgfSk7XG5cbiAgfSxcbiAgX3ByZXBhcmVEYXR1bTogZnVuY3Rpb24ocmF3RGF0dW0sIG1vZGVsKSB7XG4gICAgdGhpcy5fcHJvY2Vzc01ldGEocmF3RGF0dW0pO1xuICAgIGRlbGV0ZSByYXdEYXR1bS5jb2xsZWN0aW9uO1xuICAgIGRlbGV0ZSByYXdEYXR1bS5tb2RlbDtcbiAgICByYXdEYXR1bS5sb2NhbElkID0gcmF3RGF0dW0uX2lkO1xuICAgIGRlbGV0ZSByYXdEYXR1bS5faWQ7XG4gICAgdmFyIGRhdHVtID0ge307XG4gICAgT2JqZWN0LmtleXMocmF3RGF0dW0pLmZvckVhY2goZnVuY3Rpb24oaykge1xuICAgICAgZGF0dW1bay5yZXBsYWNlKFVOREVSU0NPUkVfUkVQTEFDRU1FTlQsICdfJyldID0gcmF3RGF0dW1ba107XG4gICAgfSk7XG5cbiAgICB2YXIgcmVsYXRpb25zaGlwTmFtZXMgPSBtb2RlbC5fcmVsYXRpb25zaGlwTmFtZXM7XG4gICAgcmVsYXRpb25zaGlwTmFtZXMuZm9yRWFjaChmdW5jdGlvbihyKSB7XG4gICAgICB2YXIgbG9jYWxJZCA9IGRhdHVtW3JdO1xuICAgICAgaWYgKGxvY2FsSWQpIHtcbiAgICAgICAgaWYgKHNpZXN0YS5pc0FycmF5KGxvY2FsSWQpKSB7XG4gICAgICAgICAgZGF0dW1bcl0gPSBsb2NhbElkLm1hcChmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICByZXR1cm4ge2xvY2FsSWQ6IHh9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgZGF0dW1bcl0gPSB7bG9jYWxJZDogbG9jYWxJZH07XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgIH0pO1xuICAgIHJldHVybiBkYXR1bTtcbiAgfSxcbiAgX3Byb2Nlc3NNZXRhOiBmdW5jdGlvbihkYXR1bSkge1xuICAgIHZhciBtZXRhID0gZGF0dW0uc2llc3RhX21ldGEgfHwgdGhpcy5faW5pdE1ldGEoKTtcbiAgICBtZXRhLmRhdGVGaWVsZHMuZm9yRWFjaChmdW5jdGlvbihkYXRlRmllbGQpIHtcbiAgICAgIHZhciB2YWx1ZSA9IGRhdHVtW2RhdGVGaWVsZF07XG4gICAgICBpZiAoISh2YWx1ZSBpbnN0YW5jZW9mIERhdGUpKSB7XG4gICAgICAgIGRhdHVtW2RhdGVGaWVsZF0gPSBuZXcgRGF0ZSh2YWx1ZSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgZGVsZXRlIGRhdHVtLnNpZXN0YV9tZXRhO1xuICB9LFxuXG4gIF9pbml0TWV0YTogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHtkYXRlRmllbGRzOiBbXX07XG4gIH0sXG5cbiAgLyoqXG4gICAqIFNvbWV0aW1lcyBzaWVzdGEgbmVlZHMgdG8gc3RvcmUgc29tZSBleHRyYSBpbmZvcm1hdGlvbiBhYm91dCB0aGUgbW9kZWwgaW5zdGFuY2UuXG4gICAqIEBwYXJhbSBzZXJpYWxpc2VkXG4gICAqL1xuICBfYWRkTWV0YTogZnVuY3Rpb24oc2VyaWFsaXNlZCkge1xuICAgIHNlcmlhbGlzZWQuc2llc3RhX21ldGEgPSB0aGlzLl9pbml0TWV0YSgpO1xuICAgIGZvciAodmFyIHByb3AgaW4gc2VyaWFsaXNlZCkge1xuICAgICAgaWYgKHNlcmlhbGlzZWQuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgaWYgKHNlcmlhbGlzZWRbcHJvcF0gaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgICAgICAgc2VyaWFsaXNlZC5zaWVzdGFfbWV0YS5kYXRlRmllbGRzLnB1c2gocHJvcCk7XG4gICAgICAgICAgc2VyaWFsaXNlZFtwcm9wXSA9IHNlcmlhbGlzZWRbcHJvcF0uZ2V0VGltZSgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIGxpc3RlbmVyOiBmdW5jdGlvbihuKSB7XG4gICAgdmFyIGNoYW5nZWRPYmplY3QgPSBuLm9iaixcbiAgICAgIGlkZW50ID0gY2hhbmdlZE9iamVjdC5sb2NhbElkO1xuICAgIGlmICghY2hhbmdlZE9iamVjdCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBvYmogZmllbGQgaW4gbm90aWZpY2F0aW9uIHJlY2VpdmVkIGJ5IHN0b3JhZ2UgZXh0ZW5zaW9uJyk7XG4gICAgfVxuICAgIGlmICghKGlkZW50IGluIHRoaXMudW5zYXZlZE9iamVjdHNIYXNoKSkge1xuICAgICAgdGhpcy51bnNhdmVkT2JqZWN0c0hhc2hbaWRlbnRdID0gY2hhbmdlZE9iamVjdDtcbiAgICAgIHRoaXMudW5zYXZlZE9iamVjdHMucHVzaChjaGFuZ2VkT2JqZWN0KTtcbiAgICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IGNoYW5nZWRPYmplY3QuY29sbGVjdGlvbk5hbWU7XG4gICAgICBpZiAoIXRoaXMudW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbk5hbWVdKSB7XG4gICAgICAgIHRoaXMudW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbk5hbWVdID0ge307XG4gICAgICB9XG4gICAgICB2YXIgbW9kZWxOYW1lID0gY2hhbmdlZE9iamVjdC5tb2RlbC5uYW1lO1xuICAgICAgaWYgKCF0aGlzLnVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uW2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdKSB7XG4gICAgICAgIHRoaXMudW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV0gPSB7fTtcbiAgICAgIH1cbiAgICAgIHRoaXMudW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV1baWRlbnRdID0gY2hhbmdlZE9iamVjdDtcbiAgICB9XG4gIH0sXG4gIF9yZXNldDogZnVuY3Rpb24oY2IsIHBkYikge1xuICAgIGlmICh0aGlzLl9saXN0ZW5lcikgdGhpcy5jb250ZXh0LnJlbW92ZUxpc3RlbmVyKCdTaWVzdGEnLCB0aGlzLl9saXN0ZW5lcik7XG4gICAgdGhpcy51bnNhdmVkT2JqZWN0cyA9IFtdO1xuICAgIHRoaXMudW5zYXZlZE9iamVjdHNIYXNoID0ge307XG5cbiAgICB2YXIgcG91Y2ggPSB0aGlzLnBvdWNoO1xuICAgIHBvdWNoXG4gICAgICAuYWxsRG9jcygpXG4gICAgICAudGhlbihmdW5jdGlvbihyZXN1bHRzKSB7XG4gICAgICAgIHZhciBkb2NzID0gcmVzdWx0cy5yb3dzLm1hcChmdW5jdGlvbihyKSB7XG4gICAgICAgICAgcmV0dXJuIHtfaWQ6IHIuaWQsIF9yZXY6IHIudmFsdWUucmV2LCBfZGVsZXRlZDogdHJ1ZX07XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMucG91Y2hcbiAgICAgICAgICAuYnVsa0RvY3MoZG9jcylcbiAgICAgICAgICAudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGlmIChwZGIpIHRoaXMucG91Y2ggPSBwZGI7XG4gICAgICAgICAgICBjYigpO1xuICAgICAgICAgIH0uYmluZCh0aGlzKSlcbiAgICAgICAgICAuY2F0Y2goY2IpO1xuICAgICAgfS5iaW5kKHRoaXMpKVxuICAgICAgLmNhdGNoKGNiKTtcbiAgfSxcbiAgLyoqXG4gICAqIFNlcmlhbGlzZSBhIG1vZGVsIGludG8gYSBmb3JtYXQgdGhhdCBQb3VjaERCIGJ1bGtEb2NzIEFQSSBjYW4gcHJvY2Vzc1xuICAgKiBAcGFyYW0ge01vZGVsSW5zdGFuY2V9IG1vZGVsSW5zdGFuY2VcbiAgICovXG4gIF9zZXJpYWxpc2U6IGZ1bmN0aW9uKG1vZGVsSW5zdGFuY2UpIHtcbiAgICB2YXIgc2VyaWFsaXNlZCA9IHt9O1xuICAgIHZhciBfX3ZhbHVlcyA9IG1vZGVsSW5zdGFuY2UuX192YWx1ZXM7XG4gICAgc2VyaWFsaXNlZCA9IHV0aWwuZXh0ZW5kKHNlcmlhbGlzZWQsIF9fdmFsdWVzKTtcbiAgICBPYmplY3Qua2V5cyhzZXJpYWxpc2VkKS5mb3JFYWNoKGZ1bmN0aW9uKGspIHtcbiAgICAgIHNlcmlhbGlzZWRbay5yZXBsYWNlKFVOREVSU0NPUkUsICdAJyldID0gX192YWx1ZXNba107XG4gICAgfSk7XG4gICAgdGhpcy5fYWRkTWV0YShzZXJpYWxpc2VkKTtcbiAgICBzZXJpYWxpc2VkWydjb2xsZWN0aW9uJ10gPSBtb2RlbEluc3RhbmNlLmNvbGxlY3Rpb25OYW1lO1xuICAgIHNlcmlhbGlzZWRbJ21vZGVsJ10gPSBtb2RlbEluc3RhbmNlLm1vZGVsTmFtZTtcbiAgICBzZXJpYWxpc2VkWydfaWQnXSA9IG1vZGVsSW5zdGFuY2UubG9jYWxJZDtcbiAgICBpZiAobW9kZWxJbnN0YW5jZS5yZW1vdmVkKSBzZXJpYWxpc2VkWydfZGVsZXRlZCddID0gdHJ1ZTtcbiAgICB2YXIgcmV2ID0gbW9kZWxJbnN0YW5jZS5fcmV2O1xuICAgIGlmIChyZXYpIHNlcmlhbGlzZWRbJ19yZXYnXSA9IHJldjtcbiAgICBzZXJpYWxpc2VkID0gbW9kZWxJbnN0YW5jZS5fcmVsYXRpb25zaGlwTmFtZXMucmVkdWNlKGZ1bmN0aW9uKG1lbW8sIG4pIHtcbiAgICAgIHZhciB2YWwgPSBtb2RlbEluc3RhbmNlW25dO1xuICAgICAgaWYgKHNpZXN0YS5pc0FycmF5KHZhbCkpIHtcbiAgICAgICAgbWVtb1tuXSA9IHV0aWwucGx1Y2sodmFsLCAnbG9jYWxJZCcpO1xuICAgICAgfVxuICAgICAgZWxzZSBpZiAodmFsKSB7XG4gICAgICAgIG1lbW9bbl0gPSB2YWwubG9jYWxJZDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtZW1vO1xuICAgIH0sIHNlcmlhbGlzZWQpO1xuICAgIHJldHVybiBzZXJpYWxpc2VkO1xuICB9LFxuICBjb25zdHJ1Y3RJbmRleERlc2lnbkRvYzogZnVuY3Rpb24oY29sbGVjdGlvbk5hbWUsIG1vZGVsTmFtZSkge1xuICAgIHZhciBmdWxseVF1YWxpZmllZE5hbWUgPSB0aGlzLmZ1bGx5UXVhbGlmaWVkTW9kZWxOYW1lKGNvbGxlY3Rpb25OYW1lLCBtb2RlbE5hbWUpO1xuICAgIHZhciB2aWV3cyA9IHt9O1xuICAgIHZpZXdzW2Z1bGx5UXVhbGlmaWVkTmFtZV0gPSB7XG4gICAgICBtYXA6IGZ1bmN0aW9uKGRvYykge1xuICAgICAgICBpZiAoZG9jLmNvbGxlY3Rpb24gPT0gJyQxJyAmJiBkb2MubW9kZWwgPT0gJyQyJykgZW1pdChkb2MuY29sbGVjdGlvbiArICcuJyArIGRvYy5tb2RlbCwgZG9jKTtcbiAgICAgIH0udG9TdHJpbmcoKS5yZXBsYWNlKCckMScsIGNvbGxlY3Rpb25OYW1lKS5yZXBsYWNlKCckMicsIG1vZGVsTmFtZSlcbiAgICB9O1xuICAgIHJldHVybiB7XG4gICAgICBfaWQ6ICdfZGVzaWduLycgKyBmdWxseVF1YWxpZmllZE5hbWUsXG4gICAgICB2aWV3czogdmlld3NcbiAgICB9O1xuICB9LFxuICBmdWxseVF1YWxpZmllZE1vZGVsTmFtZTogZnVuY3Rpb24oY29sbGVjdGlvbk5hbWUsIG1vZGVsTmFtZSkge1xuICAgIHJldHVybiBjb2xsZWN0aW9uTmFtZSArICcuJyArIG1vZGVsTmFtZTtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBTdG9yYWdlO1xuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL3N0b3JhZ2UvaW5kZXguanNcbiAqKiBtb2R1bGUgaWQgPSAyMVxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwidmFyIGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG52YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xudmFyIHVuZGVmaW5lZDtcblxudmFyIGlzUGxhaW5PYmplY3QgPSBmdW5jdGlvbiBpc1BsYWluT2JqZWN0KG9iaikge1xuICAgIFwidXNlIHN0cmljdFwiO1xuICAgIGlmICghb2JqIHx8IHRvU3RyaW5nLmNhbGwob2JqKSAhPT0gJ1tvYmplY3QgT2JqZWN0XScgfHwgb2JqLm5vZGVUeXBlIHx8IG9iai5zZXRJbnRlcnZhbCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdmFyIGhhc19vd25fY29uc3RydWN0b3IgPSBoYXNPd24uY2FsbChvYmosICdjb25zdHJ1Y3RvcicpO1xuICAgIHZhciBoYXNfaXNfcHJvcGVydHlfb2ZfbWV0aG9kID0gb2JqLmNvbnN0cnVjdG9yICYmIG9iai5jb25zdHJ1Y3Rvci5wcm90b3R5cGUgJiYgaGFzT3duLmNhbGwob2JqLmNvbnN0cnVjdG9yLnByb3RvdHlwZSwgJ2lzUHJvdG90eXBlT2YnKTtcbiAgICAvLyBOb3Qgb3duIGNvbnN0cnVjdG9yIHByb3BlcnR5IG11c3QgYmUgT2JqZWN0XG4gICAgaWYgKG9iai5jb25zdHJ1Y3RvciAmJiAhaGFzX293bl9jb25zdHJ1Y3RvciAmJiAhaGFzX2lzX3Byb3BlcnR5X29mX21ldGhvZCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gT3duIHByb3BlcnRpZXMgYXJlIGVudW1lcmF0ZWQgZmlyc3RseSwgc28gdG8gc3BlZWQgdXAsXG4gICAgLy8gaWYgbGFzdCBvbmUgaXMgb3duLCB0aGVuIGFsbCBwcm9wZXJ0aWVzIGFyZSBvd24uXG4gICAgdmFyIGtleTtcbiAgICBmb3IgKGtleSBpbiBvYmopIHt9XG5cbiAgICByZXR1cm4ga2V5ID09PSB1bmRlZmluZWQgfHwgaGFzT3duLmNhbGwob2JqLCBrZXkpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBleHRlbmQoKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG4gICAgdmFyIG9wdGlvbnMsIG5hbWUsIHNyYywgY29weSwgY29weUlzQXJyYXksIGNsb25lLFxuICAgICAgICB0YXJnZXQgPSBhcmd1bWVudHNbMF0sXG4gICAgICAgIGkgPSAxLFxuICAgICAgICBsZW5ndGggPSBhcmd1bWVudHMubGVuZ3RoLFxuICAgICAgICBkZWVwID0gZmFsc2U7XG5cbiAgICAvLyBIYW5kbGUgYSBkZWVwIGNvcHkgc2l0dWF0aW9uXG4gICAgaWYgKHR5cGVvZiB0YXJnZXQgPT09IFwiYm9vbGVhblwiKSB7XG4gICAgICAgIGRlZXAgPSB0YXJnZXQ7XG4gICAgICAgIHRhcmdldCA9IGFyZ3VtZW50c1sxXSB8fCB7fTtcbiAgICAgICAgLy8gc2tpcCB0aGUgYm9vbGVhbiBhbmQgdGhlIHRhcmdldFxuICAgICAgICBpID0gMjtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiB0YXJnZXQgIT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHRhcmdldCAhPT0gXCJmdW5jdGlvblwiIHx8IHRhcmdldCA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGFyZ2V0ID0ge307XG4gICAgfVxuXG4gICAgZm9yICg7IGkgPCBsZW5ndGg7ICsraSkge1xuICAgICAgICAvLyBPbmx5IGRlYWwgd2l0aCBub24tbnVsbC91bmRlZmluZWQgdmFsdWVzXG4gICAgICAgIGlmICgob3B0aW9ucyA9IGFyZ3VtZW50c1tpXSkgIT0gbnVsbCkge1xuICAgICAgICAgICAgLy8gRXh0ZW5kIHRoZSBiYXNlIG9iamVjdFxuICAgICAgICAgICAgZm9yIChuYW1lIGluIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICBzcmMgPSB0YXJnZXRbbmFtZV07XG4gICAgICAgICAgICAgICAgY29weSA9IG9wdGlvbnNbbmFtZV07XG5cbiAgICAgICAgICAgICAgICAvLyBQcmV2ZW50IG5ldmVyLWVuZGluZyBsb29wXG4gICAgICAgICAgICAgICAgaWYgKHRhcmdldCA9PT0gY29weSkge1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBSZWN1cnNlIGlmIHdlJ3JlIG1lcmdpbmcgcGxhaW4gb2JqZWN0cyBvciBhcnJheXNcbiAgICAgICAgICAgICAgICBpZiAoZGVlcCAmJiBjb3B5ICYmIChpc1BsYWluT2JqZWN0KGNvcHkpIHx8IChjb3B5SXNBcnJheSA9IEFycmF5LmlzQXJyYXkoY29weSkpKSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoY29weUlzQXJyYXkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvcHlJc0FycmF5ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICBjbG9uZSA9IHNyYyAmJiBBcnJheS5pc0FycmF5KHNyYykgPyBzcmMgOiBbXTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsb25lID0gc3JjICYmIGlzUGxhaW5PYmplY3Qoc3JjKSA/IHNyYyA6IHt9O1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gTmV2ZXIgbW92ZSBvcmlnaW5hbCBvYmplY3RzLCBjbG9uZSB0aGVtXG4gICAgICAgICAgICAgICAgICAgIHRhcmdldFtuYW1lXSA9IGV4dGVuZChkZWVwLCBjbG9uZSwgY29weSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gRG9uJ3QgYnJpbmcgaW4gdW5kZWZpbmVkIHZhbHVlc1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY29weSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldFtuYW1lXSA9IGNvcHk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gUmV0dXJuIHRoZSBtb2RpZmllZCBvYmplY3RcbiAgICByZXR1cm4gdGFyZ2V0O1xufTtcblxuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL34vZXh0ZW5kL2luZGV4LmpzXG4gKiogbW9kdWxlIGlkID0gMjJcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsIi8qXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQgVGhlIFBvbHltZXIgUHJvamVjdCBBdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogVGhpcyBjb2RlIG1heSBvbmx5IGJlIHVzZWQgdW5kZXIgdGhlIEJTRCBzdHlsZSBsaWNlbnNlIGZvdW5kIGF0IGh0dHA6Ly9wb2x5bWVyLmdpdGh1Yi5pby9MSUNFTlNFLnR4dFxuICogVGhlIGNvbXBsZXRlIHNldCBvZiBhdXRob3JzIG1heSBiZSBmb3VuZCBhdCBodHRwOi8vcG9seW1lci5naXRodWIuaW8vQVVUSE9SUy50eHRcbiAqIFRoZSBjb21wbGV0ZSBzZXQgb2YgY29udHJpYnV0b3JzIG1heSBiZSBmb3VuZCBhdCBodHRwOi8vcG9seW1lci5naXRodWIuaW8vQ09OVFJJQlVUT1JTLnR4dFxuICogQ29kZSBkaXN0cmlidXRlZCBieSBHb29nbGUgYXMgcGFydCBvZiB0aGUgcG9seW1lciBwcm9qZWN0IGlzIGFsc29cbiAqIHN1YmplY3QgdG8gYW4gYWRkaXRpb25hbCBJUCByaWdodHMgZ3JhbnQgZm91bmQgYXQgaHR0cDovL3BvbHltZXIuZ2l0aHViLmlvL1BBVEVOVFMudHh0XG4gKi9cblxuKGZ1bmN0aW9uKGdsb2JhbCkge1xuICAndXNlIHN0cmljdCc7XG5cbiAgdmFyIHRlc3RpbmdFeHBvc2VDeWNsZUNvdW50ID0gZ2xvYmFsLnRlc3RpbmdFeHBvc2VDeWNsZUNvdW50O1xuXG4gIC8vIERldGVjdCBhbmQgZG8gYmFzaWMgc2FuaXR5IGNoZWNraW5nIG9uIE9iamVjdC9BcnJheS5vYnNlcnZlLlxuICBmdW5jdGlvbiBkZXRlY3RPYmplY3RPYnNlcnZlKCkge1xuICAgIGlmICh0eXBlb2YgT2JqZWN0Lm9ic2VydmUgIT09ICdmdW5jdGlvbicgfHxcbiAgICAgICAgdHlwZW9mIEFycmF5Lm9ic2VydmUgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB2YXIgcmVjb3JkcyA9IFtdO1xuXG4gICAgZnVuY3Rpb24gY2FsbGJhY2socmVjcykge1xuICAgICAgcmVjb3JkcyA9IHJlY3M7XG4gICAgfVxuXG4gICAgdmFyIHRlc3QgPSB7fTtcbiAgICB2YXIgYXJyID0gW107XG4gICAgT2JqZWN0Lm9ic2VydmUodGVzdCwgY2FsbGJhY2spO1xuICAgIEFycmF5Lm9ic2VydmUoYXJyLCBjYWxsYmFjayk7XG4gICAgdGVzdC5pZCA9IDE7XG4gICAgdGVzdC5pZCA9IDI7XG4gICAgZGVsZXRlIHRlc3QuaWQ7XG4gICAgYXJyLnB1c2goMSwgMik7XG4gICAgYXJyLmxlbmd0aCA9IDA7XG5cbiAgICBPYmplY3QuZGVsaXZlckNoYW5nZVJlY29yZHMoY2FsbGJhY2spO1xuICAgIGlmIChyZWNvcmRzLmxlbmd0aCAhPT0gNSlcbiAgICAgIHJldHVybiBmYWxzZTtcblxuICAgIGlmIChyZWNvcmRzWzBdLnR5cGUgIT0gJ2FkZCcgfHxcbiAgICAgICAgcmVjb3Jkc1sxXS50eXBlICE9ICd1cGRhdGUnIHx8XG4gICAgICAgIHJlY29yZHNbMl0udHlwZSAhPSAnZGVsZXRlJyB8fFxuICAgICAgICByZWNvcmRzWzNdLnR5cGUgIT0gJ3NwbGljZScgfHxcbiAgICAgICAgcmVjb3Jkc1s0XS50eXBlICE9ICdzcGxpY2UnKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgT2JqZWN0LnVub2JzZXJ2ZSh0ZXN0LCBjYWxsYmFjayk7XG4gICAgQXJyYXkudW5vYnNlcnZlKGFyciwgY2FsbGJhY2spO1xuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICB2YXIgaGFzT2JzZXJ2ZSA9IGRldGVjdE9iamVjdE9ic2VydmUoKTtcblxuICBmdW5jdGlvbiBkZXRlY3RFdmFsKCkge1xuICAgIC8vIERvbid0IHRlc3QgZm9yIGV2YWwgaWYgd2UncmUgcnVubmluZyBpbiBhIENocm9tZSBBcHAgZW52aXJvbm1lbnQuXG4gICAgLy8gV2UgY2hlY2sgZm9yIEFQSXMgc2V0IHRoYXQgb25seSBleGlzdCBpbiBhIENocm9tZSBBcHAgY29udGV4dC5cbiAgICBpZiAodHlwZW9mIGNocm9tZSAhPT0gJ3VuZGVmaW5lZCcgJiYgY2hyb21lLmFwcCAmJiBjaHJvbWUuYXBwLnJ1bnRpbWUpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBGaXJlZm94IE9TIEFwcHMgZG8gbm90IGFsbG93IGV2YWwuIFRoaXMgZmVhdHVyZSBkZXRlY3Rpb24gaXMgdmVyeSBoYWNreVxuICAgIC8vIGJ1dCBldmVuIGlmIHNvbWUgb3RoZXIgcGxhdGZvcm0gYWRkcyBzdXBwb3J0IGZvciB0aGlzIGZ1bmN0aW9uIHRoaXMgY29kZVxuICAgIC8vIHdpbGwgY29udGludWUgdG8gd29yay5cbiAgICBpZiAobmF2aWdhdG9yLmdldERldmljZVN0b3JhZ2UpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgdmFyIGYgPSBuZXcgRnVuY3Rpb24oJycsICdyZXR1cm4gdHJ1ZTsnKTtcbiAgICAgIHJldHVybiBmKCk7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICB2YXIgaGFzRXZhbCA9IGRldGVjdEV2YWwoKTtcblxuICBmdW5jdGlvbiBpc0luZGV4KHMpIHtcbiAgICByZXR1cm4gK3MgPT09IHMgPj4+IDAgJiYgcyAhPT0gJyc7XG4gIH1cblxuICBmdW5jdGlvbiB0b051bWJlcihzKSB7XG4gICAgcmV0dXJuICtzO1xuICB9XG5cbiAgdmFyIG51bWJlcklzTmFOID0gZ2xvYmFsLk51bWJlci5pc05hTiB8fCBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInICYmIGdsb2JhbC5pc05hTih2YWx1ZSk7XG4gIH1cblxuXG4gIHZhciBjcmVhdGVPYmplY3QgPSAoJ19fcHJvdG9fXycgaW4ge30pID9cbiAgICBmdW5jdGlvbihvYmopIHsgcmV0dXJuIG9iajsgfSA6XG4gICAgZnVuY3Rpb24ob2JqKSB7XG4gICAgICB2YXIgcHJvdG8gPSBvYmouX19wcm90b19fO1xuICAgICAgaWYgKCFwcm90bylcbiAgICAgICAgcmV0dXJuIG9iajtcbiAgICAgIHZhciBuZXdPYmplY3QgPSBPYmplY3QuY3JlYXRlKHByb3RvKTtcbiAgICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKG9iaikuZm9yRWFjaChmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShuZXdPYmplY3QsIG5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3Iob2JqLCBuYW1lKSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBuZXdPYmplY3Q7XG4gICAgfTtcblxuICB2YXIgaWRlbnRTdGFydCA9ICdbXFwkX2EtekEtWl0nO1xuICB2YXIgaWRlbnRQYXJ0ID0gJ1tcXCRfYS16QS1aMC05XSc7XG5cblxuICB2YXIgTUFYX0RJUlRZX0NIRUNLX0NZQ0xFUyA9IDEwMDA7XG5cbiAgZnVuY3Rpb24gZGlydHlDaGVjayhvYnNlcnZlcikge1xuICAgIHZhciBjeWNsZXMgPSAwO1xuICAgIHdoaWxlIChjeWNsZXMgPCBNQVhfRElSVFlfQ0hFQ0tfQ1lDTEVTICYmIG9ic2VydmVyLmNoZWNrXygpKSB7XG4gICAgICBjeWNsZXMrKztcbiAgICB9XG4gICAgaWYgKHRlc3RpbmdFeHBvc2VDeWNsZUNvdW50KVxuICAgICAgZ2xvYmFsLmRpcnR5Q2hlY2tDeWNsZUNvdW50ID0gY3ljbGVzO1xuXG4gICAgcmV0dXJuIGN5Y2xlcyA+IDA7XG4gIH1cblxuICBmdW5jdGlvbiBvYmplY3RJc0VtcHR5KG9iamVjdCkge1xuICAgIGZvciAodmFyIHByb3AgaW4gb2JqZWN0KVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgZnVuY3Rpb24gZGlmZklzRW1wdHkoZGlmZikge1xuICAgIHJldHVybiBvYmplY3RJc0VtcHR5KGRpZmYuYWRkZWQpICYmXG4gICAgICAgICAgIG9iamVjdElzRW1wdHkoZGlmZi5yZW1vdmVkKSAmJlxuICAgICAgICAgICBvYmplY3RJc0VtcHR5KGRpZmYuY2hhbmdlZCk7XG4gIH1cblxuICBmdW5jdGlvbiBkaWZmT2JqZWN0RnJvbU9sZE9iamVjdChvYmplY3QsIG9sZE9iamVjdCkge1xuICAgIHZhciBhZGRlZCA9IHt9O1xuICAgIHZhciByZW1vdmVkID0ge307XG4gICAgdmFyIGNoYW5nZWQgPSB7fTtcblxuICAgIGZvciAodmFyIHByb3AgaW4gb2xkT2JqZWN0KSB7XG4gICAgICB2YXIgbmV3VmFsdWUgPSBvYmplY3RbcHJvcF07XG5cbiAgICAgIGlmIChuZXdWYWx1ZSAhPT0gdW5kZWZpbmVkICYmIG5ld1ZhbHVlID09PSBvbGRPYmplY3RbcHJvcF0pXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICBpZiAoIShwcm9wIGluIG9iamVjdCkpIHtcbiAgICAgICAgcmVtb3ZlZFtwcm9wXSA9IHVuZGVmaW5lZDtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChuZXdWYWx1ZSAhPT0gb2xkT2JqZWN0W3Byb3BdKVxuICAgICAgICBjaGFuZ2VkW3Byb3BdID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgcHJvcCBpbiBvYmplY3QpIHtcbiAgICAgIGlmIChwcm9wIGluIG9sZE9iamVjdClcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIGFkZGVkW3Byb3BdID0gb2JqZWN0W3Byb3BdO1xuICAgIH1cblxuICAgIGlmIChBcnJheS5pc0FycmF5KG9iamVjdCkgJiYgb2JqZWN0Lmxlbmd0aCAhPT0gb2xkT2JqZWN0Lmxlbmd0aClcbiAgICAgIGNoYW5nZWQubGVuZ3RoID0gb2JqZWN0Lmxlbmd0aDtcblxuICAgIHJldHVybiB7XG4gICAgICBhZGRlZDogYWRkZWQsXG4gICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgICAgY2hhbmdlZDogY2hhbmdlZFxuICAgIH07XG4gIH1cblxuICB2YXIgZW9tVGFza3MgPSBbXTtcbiAgZnVuY3Rpb24gcnVuRU9NVGFza3MoKSB7XG4gICAgaWYgKCFlb21UYXNrcy5sZW5ndGgpXG4gICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGVvbVRhc2tzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBlb21UYXNrc1tpXSgpO1xuICAgIH1cbiAgICBlb21UYXNrcy5sZW5ndGggPSAwO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgdmFyIHJ1bkVPTSA9IGhhc09ic2VydmUgPyAoZnVuY3Rpb24oKXtcbiAgICB2YXIgZW9tT2JqID0geyBwaW5nUG9uZzogdHJ1ZSB9O1xuICAgIHZhciBlb21SdW5TY2hlZHVsZWQgPSBmYWxzZTtcblxuICAgIE9iamVjdC5vYnNlcnZlKGVvbU9iaiwgZnVuY3Rpb24oKSB7XG4gICAgICBydW5FT01UYXNrcygpO1xuICAgICAgZW9tUnVuU2NoZWR1bGVkID0gZmFsc2U7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gZnVuY3Rpb24oZm4pIHtcbiAgICAgIGVvbVRhc2tzLnB1c2goZm4pO1xuICAgICAgaWYgKCFlb21SdW5TY2hlZHVsZWQpIHtcbiAgICAgICAgZW9tUnVuU2NoZWR1bGVkID0gdHJ1ZTtcbiAgICAgICAgZW9tT2JqLnBpbmdQb25nID0gIWVvbU9iai5waW5nUG9uZztcbiAgICAgIH1cbiAgICB9O1xuICB9KSgpIDpcbiAgKGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBmdW5jdGlvbihmbikge1xuICAgICAgZW9tVGFza3MucHVzaChmbik7XG4gICAgfTtcbiAgfSkoKTtcblxuICB2YXIgb2JzZXJ2ZWRPYmplY3RDYWNoZSA9IFtdO1xuXG4gIGZ1bmN0aW9uIG5ld09ic2VydmVkT2JqZWN0KCkge1xuICAgIHZhciBvYnNlcnZlcjtcbiAgICB2YXIgb2JqZWN0O1xuICAgIHZhciBkaXNjYXJkUmVjb3JkcyA9IGZhbHNlO1xuICAgIHZhciBmaXJzdCA9IHRydWU7XG5cbiAgICBmdW5jdGlvbiBjYWxsYmFjayhyZWNvcmRzKSB7XG4gICAgICBpZiAob2JzZXJ2ZXIgJiYgb2JzZXJ2ZXIuc3RhdGVfID09PSBPUEVORUQgJiYgIWRpc2NhcmRSZWNvcmRzKVxuICAgICAgICBvYnNlcnZlci5jaGVja18ocmVjb3Jkcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIG9wZW46IGZ1bmN0aW9uKG9icykge1xuICAgICAgICBpZiAob2JzZXJ2ZXIpXG4gICAgICAgICAgdGhyb3cgRXJyb3IoJ09ic2VydmVkT2JqZWN0IGluIHVzZScpO1xuXG4gICAgICAgIGlmICghZmlyc3QpXG4gICAgICAgICAgT2JqZWN0LmRlbGl2ZXJDaGFuZ2VSZWNvcmRzKGNhbGxiYWNrKTtcblxuICAgICAgICBvYnNlcnZlciA9IG9icztcbiAgICAgICAgZmlyc3QgPSBmYWxzZTtcbiAgICAgIH0sXG4gICAgICBvYnNlcnZlOiBmdW5jdGlvbihvYmosIGFycmF5T2JzZXJ2ZSkge1xuICAgICAgICBvYmplY3QgPSBvYmo7XG4gICAgICAgIGlmIChhcnJheU9ic2VydmUpXG4gICAgICAgICAgQXJyYXkub2JzZXJ2ZShvYmplY3QsIGNhbGxiYWNrKTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgIE9iamVjdC5vYnNlcnZlKG9iamVjdCwgY2FsbGJhY2spO1xuICAgICAgfSxcbiAgICAgIGRlbGl2ZXI6IGZ1bmN0aW9uKGRpc2NhcmQpIHtcbiAgICAgICAgZGlzY2FyZFJlY29yZHMgPSBkaXNjYXJkO1xuICAgICAgICBPYmplY3QuZGVsaXZlckNoYW5nZVJlY29yZHMoY2FsbGJhY2spO1xuICAgICAgICBkaXNjYXJkUmVjb3JkcyA9IGZhbHNlO1xuICAgICAgfSxcbiAgICAgIGNsb3NlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgb2JzZXJ2ZXIgPSB1bmRlZmluZWQ7XG4gICAgICAgIE9iamVjdC51bm9ic2VydmUob2JqZWN0LCBjYWxsYmFjayk7XG4gICAgICAgIG9ic2VydmVkT2JqZWN0Q2FjaGUucHVzaCh0aGlzKTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgLypcbiAgICogVGhlIG9ic2VydmVkU2V0IGFic3RyYWN0aW9uIGlzIGEgcGVyZiBvcHRpbWl6YXRpb24gd2hpY2ggcmVkdWNlcyB0aGUgdG90YWxcbiAgICogbnVtYmVyIG9mIE9iamVjdC5vYnNlcnZlIG9ic2VydmF0aW9ucyBvZiBhIHNldCBvZiBvYmplY3RzLiBUaGUgaWRlYSBpcyB0aGF0XG4gICAqIGdyb3VwcyBvZiBPYnNlcnZlcnMgd2lsbCBoYXZlIHNvbWUgb2JqZWN0IGRlcGVuZGVuY2llcyBpbiBjb21tb24gYW5kIHRoaXNcbiAgICogb2JzZXJ2ZWQgc2V0IGVuc3VyZXMgdGhhdCBlYWNoIG9iamVjdCBpbiB0aGUgdHJhbnNpdGl2ZSBjbG9zdXJlIG9mXG4gICAqIGRlcGVuZGVuY2llcyBpcyBvbmx5IG9ic2VydmVkIG9uY2UuIFRoZSBvYnNlcnZlZFNldCBhY3RzIGFzIGEgd3JpdGUgYmFycmllclxuICAgKiBzdWNoIHRoYXQgd2hlbmV2ZXIgYW55IGNoYW5nZSBjb21lcyB0aHJvdWdoLCBhbGwgT2JzZXJ2ZXJzIGFyZSBjaGVja2VkIGZvclxuICAgKiBjaGFuZ2VkIHZhbHVlcy5cbiAgICpcbiAgICogTm90ZSB0aGF0IHRoaXMgb3B0aW1pemF0aW9uIGlzIGV4cGxpY2l0bHkgbW92aW5nIHdvcmsgZnJvbSBzZXR1cC10aW1lIHRvXG4gICAqIGNoYW5nZS10aW1lLlxuICAgKlxuICAgKiBUT0RPKHJhZmFlbHcpOiBJbXBsZW1lbnQgXCJnYXJiYWdlIGNvbGxlY3Rpb25cIi4gSW4gb3JkZXIgdG8gbW92ZSB3b3JrIG9mZlxuICAgKiB0aGUgY3JpdGljYWwgcGF0aCwgd2hlbiBPYnNlcnZlcnMgYXJlIGNsb3NlZCwgdGhlaXIgb2JzZXJ2ZWQgb2JqZWN0cyBhcmVcbiAgICogbm90IE9iamVjdC51bm9ic2VydmUoZCkuIEFzIGEgcmVzdWx0LCBpdCdzaWVzdGEgcG9zc2libGUgdGhhdCBpZiB0aGUgb2JzZXJ2ZWRTZXRcbiAgICogaXMga2VwdCBvcGVuLCBidXQgc29tZSBPYnNlcnZlcnMgaGF2ZSBiZWVuIGNsb3NlZCwgaXQgY291bGQgY2F1c2UgXCJsZWFrc1wiXG4gICAqIChwcmV2ZW50IG90aGVyd2lzZSBjb2xsZWN0YWJsZSBvYmplY3RzIGZyb20gYmVpbmcgY29sbGVjdGVkKS4gQXQgc29tZVxuICAgKiBwb2ludCwgd2Ugc2hvdWxkIGltcGxlbWVudCBpbmNyZW1lbnRhbCBcImdjXCIgd2hpY2gga2VlcHMgYSBsaXN0IG9mXG4gICAqIG9ic2VydmVkU2V0cyB3aGljaCBtYXkgbmVlZCBjbGVhbi11cCBhbmQgZG9lcyBzbWFsbCBhbW91bnRzIG9mIGNsZWFudXAgb24gYVxuICAgKiB0aW1lb3V0IHVudGlsIGFsbCBpcyBjbGVhbi5cbiAgICovXG5cbiAgZnVuY3Rpb24gZ2V0T2JzZXJ2ZWRPYmplY3Qob2JzZXJ2ZXIsIG9iamVjdCwgYXJyYXlPYnNlcnZlKSB7XG4gICAgdmFyIGRpciA9IG9ic2VydmVkT2JqZWN0Q2FjaGUucG9wKCkgfHwgbmV3T2JzZXJ2ZWRPYmplY3QoKTtcbiAgICBkaXIub3BlbihvYnNlcnZlcik7XG4gICAgZGlyLm9ic2VydmUob2JqZWN0LCBhcnJheU9ic2VydmUpO1xuICAgIHJldHVybiBkaXI7XG4gIH1cblxuICB2YXIgb2JzZXJ2ZWRTZXRDYWNoZSA9IFtdO1xuXG4gIGZ1bmN0aW9uIG5ld09ic2VydmVkU2V0KCkge1xuICAgIHZhciBvYnNlcnZlckNvdW50ID0gMDtcbiAgICB2YXIgb2JzZXJ2ZXJzID0gW107XG4gICAgdmFyIG9iamVjdHMgPSBbXTtcbiAgICB2YXIgcm9vdE9iajtcbiAgICB2YXIgcm9vdE9ialByb3BzO1xuXG4gICAgZnVuY3Rpb24gb2JzZXJ2ZShvYmosIHByb3ApIHtcbiAgICAgIGlmICghb2JqKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIGlmIChvYmogPT09IHJvb3RPYmopXG4gICAgICAgIHJvb3RPYmpQcm9wc1twcm9wXSA9IHRydWU7XG5cbiAgICAgIGlmIChvYmplY3RzLmluZGV4T2Yob2JqKSA8IDApIHtcbiAgICAgICAgb2JqZWN0cy5wdXNoKG9iaik7XG4gICAgICAgIE9iamVjdC5vYnNlcnZlKG9iaiwgY2FsbGJhY2spO1xuICAgICAgfVxuXG4gICAgICBvYnNlcnZlKE9iamVjdC5nZXRQcm90b3R5cGVPZihvYmopLCBwcm9wKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhbGxSb290T2JqTm9uT2JzZXJ2ZWRQcm9wcyhyZWNzKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlY3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIHJlYyA9IHJlY3NbaV07XG4gICAgICAgIGlmIChyZWMub2JqZWN0ICE9PSByb290T2JqIHx8XG4gICAgICAgICAgICByb290T2JqUHJvcHNbcmVjLm5hbWVdIHx8XG4gICAgICAgICAgICByZWMudHlwZSA9PT0gJ3NldFByb3RvdHlwZScpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNhbGxiYWNrKHJlY3MpIHtcbiAgICAgIGlmIChhbGxSb290T2JqTm9uT2JzZXJ2ZWRQcm9wcyhyZWNzKSlcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICB2YXIgb2JzZXJ2ZXI7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9ic2VydmVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICBvYnNlcnZlciA9IG9ic2VydmVyc1tpXTtcbiAgICAgICAgaWYgKG9ic2VydmVyLnN0YXRlXyA9PSBPUEVORUQpIHtcbiAgICAgICAgICBvYnNlcnZlci5pdGVyYXRlT2JqZWN0c18ob2JzZXJ2ZSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvYnNlcnZlcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgb2JzZXJ2ZXIgPSBvYnNlcnZlcnNbaV07XG4gICAgICAgIGlmIChvYnNlcnZlci5zdGF0ZV8gPT0gT1BFTkVEKSB7XG4gICAgICAgICAgb2JzZXJ2ZXIuY2hlY2tfKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgcmVjb3JkID0ge1xuICAgICAgb2JqZWN0OiB1bmRlZmluZWQsXG4gICAgICBvYmplY3RzOiBvYmplY3RzLFxuICAgICAgb3BlbjogZnVuY3Rpb24ob2JzLCBvYmplY3QpIHtcbiAgICAgICAgaWYgKCFyb290T2JqKSB7XG4gICAgICAgICAgcm9vdE9iaiA9IG9iamVjdDtcbiAgICAgICAgICByb290T2JqUHJvcHMgPSB7fTtcbiAgICAgICAgfVxuXG4gICAgICAgIG9ic2VydmVycy5wdXNoKG9icyk7XG4gICAgICAgIG9ic2VydmVyQ291bnQrKztcbiAgICAgICAgb2JzLml0ZXJhdGVPYmplY3RzXyhvYnNlcnZlKTtcbiAgICAgIH0sXG4gICAgICBjbG9zZTogZnVuY3Rpb24ob2JzKSB7XG4gICAgICAgIG9ic2VydmVyQ291bnQtLTtcbiAgICAgICAgaWYgKG9ic2VydmVyQ291bnQgPiAwKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvYmplY3RzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgT2JqZWN0LnVub2JzZXJ2ZShvYmplY3RzW2ldLCBjYWxsYmFjayk7XG4gICAgICAgICAgT2JzZXJ2ZXIudW5vYnNlcnZlZENvdW50Kys7XG4gICAgICAgIH1cblxuICAgICAgICBvYnNlcnZlcnMubGVuZ3RoID0gMDtcbiAgICAgICAgb2JqZWN0cy5sZW5ndGggPSAwO1xuICAgICAgICByb290T2JqID0gdW5kZWZpbmVkO1xuICAgICAgICByb290T2JqUHJvcHMgPSB1bmRlZmluZWQ7XG4gICAgICAgIG9ic2VydmVkU2V0Q2FjaGUucHVzaCh0aGlzKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgcmV0dXJuIHJlY29yZDtcbiAgfVxuXG4gIHZhciBsYXN0T2JzZXJ2ZWRTZXQ7XG5cbiAgdmFyIFVOT1BFTkVEID0gMDtcbiAgdmFyIE9QRU5FRCA9IDE7XG4gIHZhciBDTE9TRUQgPSAyO1xuXG4gIHZhciBuZXh0T2JzZXJ2ZXJJZCA9IDE7XG5cbiAgZnVuY3Rpb24gT2JzZXJ2ZXIoKSB7XG4gICAgdGhpcy5zdGF0ZV8gPSBVTk9QRU5FRDtcbiAgICB0aGlzLmNhbGxiYWNrXyA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLnRhcmdldF8gPSB1bmRlZmluZWQ7IC8vIFRPRE8ocmFmYWVsdyk6IFNob3VsZCBiZSBXZWFrUmVmXG4gICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8gPSB1bmRlZmluZWQ7XG4gICAgdGhpcy52YWx1ZV8gPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5pZF8gPSBuZXh0T2JzZXJ2ZXJJZCsrO1xuICB9XG5cbiAgT2JzZXJ2ZXIucHJvdG90eXBlID0ge1xuICAgIG9wZW46IGZ1bmN0aW9uKGNhbGxiYWNrLCB0YXJnZXQpIHtcbiAgICAgIGlmICh0aGlzLnN0YXRlXyAhPSBVTk9QRU5FRClcbiAgICAgICAgdGhyb3cgRXJyb3IoJ09ic2VydmVyIGhhcyBhbHJlYWR5IGJlZW4gb3BlbmVkLicpO1xuXG4gICAgICBhZGRUb0FsbCh0aGlzKTtcbiAgICAgIHRoaXMuY2FsbGJhY2tfID0gY2FsbGJhY2s7XG4gICAgICB0aGlzLnRhcmdldF8gPSB0YXJnZXQ7XG4gICAgICB0aGlzLmNvbm5lY3RfKCk7XG4gICAgICB0aGlzLnN0YXRlXyA9IE9QRU5FRDtcbiAgICAgIHJldHVybiB0aGlzLnZhbHVlXztcbiAgICB9LFxuXG4gICAgY2xvc2U6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuc3RhdGVfICE9IE9QRU5FRClcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICByZW1vdmVGcm9tQWxsKHRoaXMpO1xuICAgICAgdGhpcy5kaXNjb25uZWN0XygpO1xuICAgICAgdGhpcy52YWx1ZV8gPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLmNhbGxiYWNrXyA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMudGFyZ2V0XyA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMuc3RhdGVfID0gQ0xPU0VEO1xuICAgIH0sXG5cbiAgICBkZWxpdmVyOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLnN0YXRlXyAhPSBPUEVORUQpXG4gICAgICAgIHJldHVybjtcblxuICAgICAgZGlydHlDaGVjayh0aGlzKTtcbiAgICB9LFxuXG4gICAgcmVwb3J0XzogZnVuY3Rpb24oY2hhbmdlcykge1xuICAgICAgdHJ5IHtcbiAgICAgICAgdGhpcy5jYWxsYmFja18uYXBwbHkodGhpcy50YXJnZXRfLCBjaGFuZ2VzKTtcbiAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgIE9ic2VydmVyLl9lcnJvclRocm93bkR1cmluZ0NhbGxiYWNrID0gdHJ1ZTtcbiAgICAgICAgY29uc29sZS5lcnJvcignRXhjZXB0aW9uIGNhdWdodCBkdXJpbmcgb2JzZXJ2ZXIgY2FsbGJhY2s6ICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAoZXguc3RhY2sgfHwgZXgpKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgZGlzY2FyZENoYW5nZXM6IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5jaGVja18odW5kZWZpbmVkLCB0cnVlKTtcbiAgICAgIHJldHVybiB0aGlzLnZhbHVlXztcbiAgICB9XG4gIH1cblxuICB2YXIgY29sbGVjdE9ic2VydmVycyA9ICFoYXNPYnNlcnZlO1xuICB2YXIgYWxsT2JzZXJ2ZXJzO1xuICBPYnNlcnZlci5fYWxsT2JzZXJ2ZXJzQ291bnQgPSAwO1xuXG4gIGlmIChjb2xsZWN0T2JzZXJ2ZXJzKSB7XG4gICAgYWxsT2JzZXJ2ZXJzID0gW107XG4gIH1cblxuICBmdW5jdGlvbiBhZGRUb0FsbChvYnNlcnZlcikge1xuICAgIE9ic2VydmVyLl9hbGxPYnNlcnZlcnNDb3VudCsrO1xuICAgIGlmICghY29sbGVjdE9ic2VydmVycylcbiAgICAgIHJldHVybjtcblxuICAgIGFsbE9ic2VydmVycy5wdXNoKG9ic2VydmVyKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbW92ZUZyb21BbGwob2JzZXJ2ZXIpIHtcbiAgICBPYnNlcnZlci5fYWxsT2JzZXJ2ZXJzQ291bnQtLTtcbiAgfVxuXG4gIHZhciBydW5uaW5nTWljcm90YXNrQ2hlY2twb2ludCA9IGZhbHNlO1xuXG4gIHZhciBoYXNEZWJ1Z0ZvcmNlRnVsbERlbGl2ZXJ5ID0gaGFzT2JzZXJ2ZSAmJiBoYXNFdmFsICYmIChmdW5jdGlvbigpIHtcbiAgICB0cnkge1xuICAgICAgZXZhbCgnJVJ1bk1pY3JvdGFza3MoKScpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH0pKCk7XG5cbiAgZ2xvYmFsLlBsYXRmb3JtID0gZ2xvYmFsLlBsYXRmb3JtIHx8IHt9O1xuXG4gIGdsb2JhbC5QbGF0Zm9ybS5wZXJmb3JtTWljcm90YXNrQ2hlY2twb2ludCA9IGZ1bmN0aW9uKCkge1xuICAgIGlmIChydW5uaW5nTWljcm90YXNrQ2hlY2twb2ludClcbiAgICAgIHJldHVybjtcblxuICAgIGlmIChoYXNEZWJ1Z0ZvcmNlRnVsbERlbGl2ZXJ5KSB7XG4gICAgICBldmFsKCclUnVuTWljcm90YXNrcygpJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKCFjb2xsZWN0T2JzZXJ2ZXJzKVxuICAgICAgcmV0dXJuO1xuXG4gICAgcnVubmluZ01pY3JvdGFza0NoZWNrcG9pbnQgPSB0cnVlO1xuXG4gICAgdmFyIGN5Y2xlcyA9IDA7XG4gICAgdmFyIGFueUNoYW5nZWQsIHRvQ2hlY2s7XG5cbiAgICBkbyB7XG4gICAgICBjeWNsZXMrKztcbiAgICAgIHRvQ2hlY2sgPSBhbGxPYnNlcnZlcnM7XG4gICAgICBhbGxPYnNlcnZlcnMgPSBbXTtcbiAgICAgIGFueUNoYW5nZWQgPSBmYWxzZTtcblxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0b0NoZWNrLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBvYnNlcnZlciA9IHRvQ2hlY2tbaV07XG4gICAgICAgIGlmIChvYnNlcnZlci5zdGF0ZV8gIT0gT1BFTkVEKVxuICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgIGlmIChvYnNlcnZlci5jaGVja18oKSlcbiAgICAgICAgICBhbnlDaGFuZ2VkID0gdHJ1ZTtcblxuICAgICAgICBhbGxPYnNlcnZlcnMucHVzaChvYnNlcnZlcik7XG4gICAgICB9XG4gICAgICBpZiAocnVuRU9NVGFza3MoKSlcbiAgICAgICAgYW55Q2hhbmdlZCA9IHRydWU7XG4gICAgfSB3aGlsZSAoY3ljbGVzIDwgTUFYX0RJUlRZX0NIRUNLX0NZQ0xFUyAmJiBhbnlDaGFuZ2VkKTtcblxuICAgIGlmICh0ZXN0aW5nRXhwb3NlQ3ljbGVDb3VudClcbiAgICAgIGdsb2JhbC5kaXJ0eUNoZWNrQ3ljbGVDb3VudCA9IGN5Y2xlcztcblxuICAgIHJ1bm5pbmdNaWNyb3Rhc2tDaGVja3BvaW50ID0gZmFsc2U7XG4gIH07XG5cbiAgaWYgKGNvbGxlY3RPYnNlcnZlcnMpIHtcbiAgICBnbG9iYWwuUGxhdGZvcm0uY2xlYXJPYnNlcnZlcnMgPSBmdW5jdGlvbigpIHtcbiAgICAgIGFsbE9ic2VydmVycyA9IFtdO1xuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBPYmplY3RPYnNlcnZlcihvYmplY3QpIHtcbiAgICBPYnNlcnZlci5jYWxsKHRoaXMpO1xuICAgIHRoaXMudmFsdWVfID0gb2JqZWN0O1xuICAgIHRoaXMub2xkT2JqZWN0XyA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIE9iamVjdE9ic2VydmVyLnByb3RvdHlwZSA9IGNyZWF0ZU9iamVjdCh7XG4gICAgX19wcm90b19fOiBPYnNlcnZlci5wcm90b3R5cGUsXG5cbiAgICBhcnJheU9ic2VydmU6IGZhbHNlLFxuXG4gICAgY29ubmVjdF86IGZ1bmN0aW9uKGNhbGxiYWNrLCB0YXJnZXQpIHtcbiAgICAgIGlmIChoYXNPYnNlcnZlKSB7XG4gICAgICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfID0gZ2V0T2JzZXJ2ZWRPYmplY3QodGhpcywgdGhpcy52YWx1ZV8sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hcnJheU9ic2VydmUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5vbGRPYmplY3RfID0gdGhpcy5jb3B5T2JqZWN0KHRoaXMudmFsdWVfKTtcbiAgICAgIH1cblxuICAgIH0sXG5cbiAgICBjb3B5T2JqZWN0OiBmdW5jdGlvbihvYmplY3QpIHtcbiAgICAgIHZhciBjb3B5ID0gQXJyYXkuaXNBcnJheShvYmplY3QpID8gW10gOiB7fTtcbiAgICAgIGZvciAodmFyIHByb3AgaW4gb2JqZWN0KSB7XG4gICAgICAgIGNvcHlbcHJvcF0gPSBvYmplY3RbcHJvcF07XG4gICAgICB9O1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkob2JqZWN0KSlcbiAgICAgICAgY29weS5sZW5ndGggPSBvYmplY3QubGVuZ3RoO1xuICAgICAgcmV0dXJuIGNvcHk7XG4gICAgfSxcblxuICAgIGNoZWNrXzogZnVuY3Rpb24oY2hhbmdlUmVjb3Jkcywgc2tpcENoYW5nZXMpIHtcbiAgICAgIHZhciBkaWZmO1xuICAgICAgdmFyIG9sZFZhbHVlcztcbiAgICAgIGlmIChoYXNPYnNlcnZlKSB7XG4gICAgICAgIGlmICghY2hhbmdlUmVjb3JkcylcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgb2xkVmFsdWVzID0ge307XG4gICAgICAgIGRpZmYgPSBkaWZmT2JqZWN0RnJvbUNoYW5nZVJlY29yZHModGhpcy52YWx1ZV8sIGNoYW5nZVJlY29yZHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkVmFsdWVzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9sZFZhbHVlcyA9IHRoaXMub2xkT2JqZWN0XztcbiAgICAgICAgZGlmZiA9IGRpZmZPYmplY3RGcm9tT2xkT2JqZWN0KHRoaXMudmFsdWVfLCB0aGlzLm9sZE9iamVjdF8pO1xuICAgICAgfVxuXG4gICAgICBpZiAoZGlmZklzRW1wdHkoZGlmZikpXG4gICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgaWYgKCFoYXNPYnNlcnZlKVxuICAgICAgICB0aGlzLm9sZE9iamVjdF8gPSB0aGlzLmNvcHlPYmplY3QodGhpcy52YWx1ZV8pO1xuXG4gICAgICB0aGlzLnJlcG9ydF8oW1xuICAgICAgICBkaWZmLmFkZGVkIHx8IHt9LFxuICAgICAgICBkaWZmLnJlbW92ZWQgfHwge30sXG4gICAgICAgIGRpZmYuY2hhbmdlZCB8fCB7fSxcbiAgICAgICAgZnVuY3Rpb24ocHJvcGVydHkpIHtcbiAgICAgICAgICByZXR1cm4gb2xkVmFsdWVzW3Byb3BlcnR5XTtcbiAgICAgICAgfVxuICAgICAgXSk7XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0sXG5cbiAgICBkaXNjb25uZWN0XzogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoaGFzT2JzZXJ2ZSkge1xuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXy5jbG9zZSgpO1xuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXyA9IHVuZGVmaW5lZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMub2xkT2JqZWN0XyA9IHVuZGVmaW5lZDtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgZGVsaXZlcjogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5zdGF0ZV8gIT0gT1BFTkVEKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIGlmIChoYXNPYnNlcnZlKVxuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXy5kZWxpdmVyKGZhbHNlKTtcbiAgICAgIGVsc2VcbiAgICAgICAgZGlydHlDaGVjayh0aGlzKTtcbiAgICB9LFxuXG4gICAgZGlzY2FyZENoYW5nZXM6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuZGlyZWN0T2JzZXJ2ZXJfKVxuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXy5kZWxpdmVyKHRydWUpO1xuICAgICAgZWxzZVxuICAgICAgICB0aGlzLm9sZE9iamVjdF8gPSB0aGlzLmNvcHlPYmplY3QodGhpcy52YWx1ZV8pO1xuXG4gICAgICByZXR1cm4gdGhpcy52YWx1ZV87XG4gICAgfVxuICB9KTtcblxuICBmdW5jdGlvbiBBcnJheU9ic2VydmVyKGFycmF5KSB7XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGFycmF5KSlcbiAgICAgIHRocm93IEVycm9yKCdQcm92aWRlZCBvYmplY3QgaXMgbm90IGFuIEFycmF5Jyk7XG4gICAgT2JqZWN0T2JzZXJ2ZXIuY2FsbCh0aGlzLCBhcnJheSk7XG4gIH1cblxuICBBcnJheU9ic2VydmVyLnByb3RvdHlwZSA9IGNyZWF0ZU9iamVjdCh7XG5cbiAgICBfX3Byb3RvX186IE9iamVjdE9ic2VydmVyLnByb3RvdHlwZSxcblxuICAgIGFycmF5T2JzZXJ2ZTogdHJ1ZSxcblxuICAgIGNvcHlPYmplY3Q6IGZ1bmN0aW9uKGFycikge1xuICAgICAgcmV0dXJuIGFyci5zbGljZSgpO1xuICAgIH0sXG5cbiAgICBjaGVja186IGZ1bmN0aW9uKGNoYW5nZVJlY29yZHMpIHtcbiAgICAgIHZhciBzcGxpY2VzO1xuICAgICAgaWYgKGhhc09ic2VydmUpIHtcbiAgICAgICAgaWYgKCFjaGFuZ2VSZWNvcmRzKVxuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgc3BsaWNlcyA9IHByb2plY3RBcnJheVNwbGljZXModGhpcy52YWx1ZV8sIGNoYW5nZVJlY29yZHMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3BsaWNlcyA9IGNhbGNTcGxpY2VzKHRoaXMudmFsdWVfLCAwLCB0aGlzLnZhbHVlXy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm9sZE9iamVjdF8sIDAsIHRoaXMub2xkT2JqZWN0Xy5sZW5ndGgpO1xuICAgICAgfVxuXG4gICAgICBpZiAoIXNwbGljZXMgfHwgIXNwbGljZXMubGVuZ3RoKVxuICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgIGlmICghaGFzT2JzZXJ2ZSlcbiAgICAgICAgdGhpcy5vbGRPYmplY3RfID0gdGhpcy5jb3B5T2JqZWN0KHRoaXMudmFsdWVfKTtcblxuICAgICAgdGhpcy5yZXBvcnRfKFtzcGxpY2VzXSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH0pO1xuXG4gIEFycmF5T2JzZXJ2ZXIuYXBwbHlTcGxpY2VzID0gZnVuY3Rpb24ocHJldmlvdXMsIGN1cnJlbnQsIHNwbGljZXMpIHtcbiAgICBzcGxpY2VzLmZvckVhY2goZnVuY3Rpb24oc3BsaWNlKSB7XG4gICAgICB2YXIgc3BsaWNlQXJncyA9IFtzcGxpY2UuaW5kZXgsIHNwbGljZS5yZW1vdmVkLmxlbmd0aF07XG4gICAgICB2YXIgYWRkSW5kZXggPSBzcGxpY2UuaW5kZXg7XG4gICAgICB3aGlsZSAoYWRkSW5kZXggPCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCkge1xuICAgICAgICBzcGxpY2VBcmdzLnB1c2goY3VycmVudFthZGRJbmRleF0pO1xuICAgICAgICBhZGRJbmRleCsrO1xuICAgICAgfVxuXG4gICAgICBBcnJheS5wcm90b3R5cGUuc3BsaWNlLmFwcGx5KHByZXZpb3VzLCBzcGxpY2VBcmdzKTtcbiAgICB9KTtcbiAgfTtcblxuICB2YXIgb2JzZXJ2ZXJTZW50aW5lbCA9IHt9O1xuXG4gIHZhciBleHBlY3RlZFJlY29yZFR5cGVzID0ge1xuICAgIGFkZDogdHJ1ZSxcbiAgICB1cGRhdGU6IHRydWUsXG4gICAgZGVsZXRlOiB0cnVlXG4gIH07XG5cbiAgZnVuY3Rpb24gZGlmZk9iamVjdEZyb21DaGFuZ2VSZWNvcmRzKG9iamVjdCwgY2hhbmdlUmVjb3Jkcywgb2xkVmFsdWVzKSB7XG4gICAgdmFyIGFkZGVkID0ge307XG4gICAgdmFyIHJlbW92ZWQgPSB7fTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hhbmdlUmVjb3Jkcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHJlY29yZCA9IGNoYW5nZVJlY29yZHNbaV07XG4gICAgICBpZiAoIWV4cGVjdGVkUmVjb3JkVHlwZXNbcmVjb3JkLnR5cGVdKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1Vua25vd24gY2hhbmdlUmVjb3JkIHR5cGU6ICcgKyByZWNvcmQudHlwZSk7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IocmVjb3JkKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmICghKHJlY29yZC5uYW1lIGluIG9sZFZhbHVlcykpXG4gICAgICAgIG9sZFZhbHVlc1tyZWNvcmQubmFtZV0gPSByZWNvcmQub2xkVmFsdWU7XG5cbiAgICAgIGlmIChyZWNvcmQudHlwZSA9PSAndXBkYXRlJylcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIGlmIChyZWNvcmQudHlwZSA9PSAnYWRkJykge1xuICAgICAgICBpZiAocmVjb3JkLm5hbWUgaW4gcmVtb3ZlZClcbiAgICAgICAgICBkZWxldGUgcmVtb3ZlZFtyZWNvcmQubmFtZV07XG4gICAgICAgIGVsc2VcbiAgICAgICAgICBhZGRlZFtyZWNvcmQubmFtZV0gPSB0cnVlO1xuXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyB0eXBlID0gJ2RlbGV0ZSdcbiAgICAgIGlmIChyZWNvcmQubmFtZSBpbiBhZGRlZCkge1xuICAgICAgICBkZWxldGUgYWRkZWRbcmVjb3JkLm5hbWVdO1xuICAgICAgICBkZWxldGUgb2xkVmFsdWVzW3JlY29yZC5uYW1lXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlbW92ZWRbcmVjb3JkLm5hbWVdID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKHZhciBwcm9wIGluIGFkZGVkKVxuICAgICAgYWRkZWRbcHJvcF0gPSBvYmplY3RbcHJvcF07XG5cbiAgICBmb3IgKHZhciBwcm9wIGluIHJlbW92ZWQpXG4gICAgICByZW1vdmVkW3Byb3BdID0gdW5kZWZpbmVkO1xuXG4gICAgdmFyIGNoYW5nZWQgPSB7fTtcbiAgICBmb3IgKHZhciBwcm9wIGluIG9sZFZhbHVlcykge1xuICAgICAgaWYgKHByb3AgaW4gYWRkZWQgfHwgcHJvcCBpbiByZW1vdmVkKVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgdmFyIG5ld1ZhbHVlID0gb2JqZWN0W3Byb3BdO1xuICAgICAgaWYgKG9sZFZhbHVlc1twcm9wXSAhPT0gbmV3VmFsdWUpXG4gICAgICAgIGNoYW5nZWRbcHJvcF0gPSBuZXdWYWx1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgYWRkZWQ6IGFkZGVkLFxuICAgICAgcmVtb3ZlZDogcmVtb3ZlZCxcbiAgICAgIGNoYW5nZWQ6IGNoYW5nZWRcbiAgICB9O1xuICB9XG5cbiAgZnVuY3Rpb24gbmV3U3BsaWNlKGluZGV4LCByZW1vdmVkLCBhZGRlZENvdW50KSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGluZGV4OiBpbmRleCxcbiAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgICBhZGRlZENvdW50OiBhZGRlZENvdW50XG4gICAgfTtcbiAgfVxuXG4gIHZhciBFRElUX0xFQVZFID0gMDtcbiAgdmFyIEVESVRfVVBEQVRFID0gMTtcbiAgdmFyIEVESVRfQUREID0gMjtcbiAgdmFyIEVESVRfREVMRVRFID0gMztcblxuICBmdW5jdGlvbiBBcnJheVNwbGljZSgpIHt9XG5cbiAgQXJyYXlTcGxpY2UucHJvdG90eXBlID0ge1xuXG4gICAgLy8gTm90ZTogVGhpcyBmdW5jdGlvbiBpcyAqYmFzZWQqIG9uIHRoZSBjb21wdXRhdGlvbiBvZiB0aGUgTGV2ZW5zaHRlaW5cbiAgICAvLyBcImVkaXRcIiBkaXN0YW5jZS4gVGhlIG9uZSBjaGFuZ2UgaXMgdGhhdCBcInVwZGF0ZXNcIiBhcmUgdHJlYXRlZCBhcyB0d29cbiAgICAvLyBlZGl0cyAtIG5vdCBvbmUuIFdpdGggQXJyYXkgc3BsaWNlcywgYW4gdXBkYXRlIGlzIHJlYWxseSBhIGRlbGV0ZVxuICAgIC8vIGZvbGxvd2VkIGJ5IGFuIGFkZC4gQnkgcmV0YWluaW5nIHRoaXMsIHdlIG9wdGltaXplIGZvciBcImtlZXBpbmdcIiB0aGVcbiAgICAvLyBtYXhpbXVtIGFycmF5IGl0ZW1zIGluIHRoZSBvcmlnaW5hbCBhcnJheS4gRm9yIGV4YW1wbGU6XG4gICAgLy9cbiAgICAvLyAgICd4eHh4MTIzJyAtPiAnMTIzeXl5eSdcbiAgICAvL1xuICAgIC8vIFdpdGggMS1lZGl0IHVwZGF0ZXMsIHRoZSBzaG9ydGVzdCBwYXRoIHdvdWxkIGJlIGp1c3QgdG8gdXBkYXRlIGFsbCBzZXZlblxuICAgIC8vIGNoYXJhY3RlcnMuIFdpdGggMi1lZGl0IHVwZGF0ZXMsIHdlIGRlbGV0ZSA0LCBsZWF2ZSAzLCBhbmQgYWRkIDQuIFRoaXNcbiAgICAvLyBsZWF2ZXMgdGhlIHN1YnN0cmluZyAnMTIzJyBpbnRhY3QuXG4gICAgY2FsY0VkaXREaXN0YW5jZXM6IGZ1bmN0aW9uKGN1cnJlbnQsIGN1cnJlbnRTdGFydCwgY3VycmVudEVuZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkLCBvbGRTdGFydCwgb2xkRW5kKSB7XG4gICAgICAvLyBcIkRlbGV0aW9uXCIgY29sdW1uc1xuICAgICAgdmFyIHJvd0NvdW50ID0gb2xkRW5kIC0gb2xkU3RhcnQgKyAxO1xuICAgICAgdmFyIGNvbHVtbkNvdW50ID0gY3VycmVudEVuZCAtIGN1cnJlbnRTdGFydCArIDE7XG4gICAgICB2YXIgZGlzdGFuY2VzID0gbmV3IEFycmF5KHJvd0NvdW50KTtcblxuICAgICAgLy8gXCJBZGRpdGlvblwiIHJvd3MuIEluaXRpYWxpemUgbnVsbCBjb2x1bW4uXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJvd0NvdW50OyBpKyspIHtcbiAgICAgICAgZGlzdGFuY2VzW2ldID0gbmV3IEFycmF5KGNvbHVtbkNvdW50KTtcbiAgICAgICAgZGlzdGFuY2VzW2ldWzBdID0gaTtcbiAgICAgIH1cblxuICAgICAgLy8gSW5pdGlhbGl6ZSBudWxsIHJvd1xuICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBjb2x1bW5Db3VudDsgaisrKVxuICAgICAgICBkaXN0YW5jZXNbMF1bal0gPSBqO1xuXG4gICAgICBmb3IgKHZhciBpID0gMTsgaSA8IHJvd0NvdW50OyBpKyspIHtcbiAgICAgICAgZm9yICh2YXIgaiA9IDE7IGogPCBjb2x1bW5Db3VudDsgaisrKSB7XG4gICAgICAgICAgaWYgKHRoaXMuZXF1YWxzKGN1cnJlbnRbY3VycmVudFN0YXJ0ICsgaiAtIDFdLCBvbGRbb2xkU3RhcnQgKyBpIC0gMV0pKVxuICAgICAgICAgICAgZGlzdGFuY2VzW2ldW2pdID0gZGlzdGFuY2VzW2kgLSAxXVtqIC0gMV07XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB2YXIgbm9ydGggPSBkaXN0YW5jZXNbaSAtIDFdW2pdICsgMTtcbiAgICAgICAgICAgIHZhciB3ZXN0ID0gZGlzdGFuY2VzW2ldW2ogLSAxXSArIDE7XG4gICAgICAgICAgICBkaXN0YW5jZXNbaV1bal0gPSBub3J0aCA8IHdlc3QgPyBub3J0aCA6IHdlc3Q7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBkaXN0YW5jZXM7XG4gICAgfSxcblxuICAgIC8vIFRoaXMgc3RhcnRzIGF0IHRoZSBmaW5hbCB3ZWlnaHQsIGFuZCB3YWxrcyBcImJhY2t3YXJkXCIgYnkgZmluZGluZ1xuICAgIC8vIHRoZSBtaW5pbXVtIHByZXZpb3VzIHdlaWdodCByZWN1cnNpdmVseSB1bnRpbCB0aGUgb3JpZ2luIG9mIHRoZSB3ZWlnaHRcbiAgICAvLyBtYXRyaXguXG4gICAgc3BsaWNlT3BlcmF0aW9uc0Zyb21FZGl0RGlzdGFuY2VzOiBmdW5jdGlvbihkaXN0YW5jZXMpIHtcbiAgICAgIHZhciBpID0gZGlzdGFuY2VzLmxlbmd0aCAtIDE7XG4gICAgICB2YXIgaiA9IGRpc3RhbmNlc1swXS5sZW5ndGggLSAxO1xuICAgICAgdmFyIGN1cnJlbnQgPSBkaXN0YW5jZXNbaV1bal07XG4gICAgICB2YXIgZWRpdHMgPSBbXTtcbiAgICAgIHdoaWxlIChpID4gMCB8fCBqID4gMCkge1xuICAgICAgICBpZiAoaSA9PSAwKSB7XG4gICAgICAgICAgZWRpdHMucHVzaChFRElUX0FERCk7XG4gICAgICAgICAgai0tO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChqID09IDApIHtcbiAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfREVMRVRFKTtcbiAgICAgICAgICBpLS07XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIG5vcnRoV2VzdCA9IGRpc3RhbmNlc1tpIC0gMV1baiAtIDFdO1xuICAgICAgICB2YXIgd2VzdCA9IGRpc3RhbmNlc1tpIC0gMV1bal07XG4gICAgICAgIHZhciBub3J0aCA9IGRpc3RhbmNlc1tpXVtqIC0gMV07XG5cbiAgICAgICAgdmFyIG1pbjtcbiAgICAgICAgaWYgKHdlc3QgPCBub3J0aClcbiAgICAgICAgICBtaW4gPSB3ZXN0IDwgbm9ydGhXZXN0ID8gd2VzdCA6IG5vcnRoV2VzdDtcbiAgICAgICAgZWxzZVxuICAgICAgICAgIG1pbiA9IG5vcnRoIDwgbm9ydGhXZXN0ID8gbm9ydGggOiBub3J0aFdlc3Q7XG5cbiAgICAgICAgaWYgKG1pbiA9PSBub3J0aFdlc3QpIHtcbiAgICAgICAgICBpZiAobm9ydGhXZXN0ID09IGN1cnJlbnQpIHtcbiAgICAgICAgICAgIGVkaXRzLnB1c2goRURJVF9MRUFWRSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGVkaXRzLnB1c2goRURJVF9VUERBVEUpO1xuICAgICAgICAgICAgY3VycmVudCA9IG5vcnRoV2VzdDtcbiAgICAgICAgICB9XG4gICAgICAgICAgaS0tO1xuICAgICAgICAgIGotLTtcbiAgICAgICAgfSBlbHNlIGlmIChtaW4gPT0gd2VzdCkge1xuICAgICAgICAgIGVkaXRzLnB1c2goRURJVF9ERUxFVEUpO1xuICAgICAgICAgIGktLTtcbiAgICAgICAgICBjdXJyZW50ID0gd2VzdDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfQUREKTtcbiAgICAgICAgICBqLS07XG4gICAgICAgICAgY3VycmVudCA9IG5vcnRoO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGVkaXRzLnJldmVyc2UoKTtcbiAgICAgIHJldHVybiBlZGl0cztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3BsaWNlIFByb2plY3Rpb24gZnVuY3Rpb25zOlxuICAgICAqXG4gICAgICogQSBzcGxpY2UgbWFwIGlzIGEgcmVwcmVzZW50YXRpb24gb2YgaG93IGEgcHJldmlvdXMgYXJyYXkgb2YgaXRlbXNcbiAgICAgKiB3YXMgdHJhbnNmb3JtZWQgaW50byBhIG5ldyBhcnJheSBvZiBpdGVtcy4gQ29uY2VwdHVhbGx5IGl0IGlzIGEgbGlzdCBvZlxuICAgICAqIHR1cGxlcyBvZlxuICAgICAqXG4gICAgICogICA8aW5kZXgsIHJlbW92ZWQsIGFkZGVkQ291bnQ+XG4gICAgICpcbiAgICAgKiB3aGljaCBhcmUga2VwdCBpbiBhc2NlbmRpbmcgaW5kZXggb3JkZXIgb2YuIFRoZSB0dXBsZSByZXByZXNlbnRzIHRoYXQgYXRcbiAgICAgKiB0aGUgfGluZGV4fCwgfHJlbW92ZWR8IHNlcXVlbmNlIG9mIGl0ZW1zIHdlcmUgcmVtb3ZlZCwgYW5kIGNvdW50aW5nIGZvcndhcmRcbiAgICAgKiBmcm9tIHxpbmRleHwsIHxhZGRlZENvdW50fCBpdGVtcyB3ZXJlIGFkZGVkLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogTGFja2luZyBpbmRpdmlkdWFsIHNwbGljZSBtdXRhdGlvbiBpbmZvcm1hdGlvbiwgdGhlIG1pbmltYWwgc2V0IG9mXG4gICAgICogc3BsaWNlcyBjYW4gYmUgc3ludGhlc2l6ZWQgZ2l2ZW4gdGhlIHByZXZpb3VzIHN0YXRlIGFuZCBmaW5hbCBzdGF0ZSBvZiBhblxuICAgICAqIGFycmF5LiBUaGUgYmFzaWMgYXBwcm9hY2ggaXMgdG8gY2FsY3VsYXRlIHRoZSBlZGl0IGRpc3RhbmNlIG1hdHJpeCBhbmRcbiAgICAgKiBjaG9vc2UgdGhlIHNob3J0ZXN0IHBhdGggdGhyb3VnaCBpdC5cbiAgICAgKlxuICAgICAqIENvbXBsZXhpdHk6IE8obCAqIHApXG4gICAgICogICBsOiBUaGUgbGVuZ3RoIG9mIHRoZSBjdXJyZW50IGFycmF5XG4gICAgICogICBwOiBUaGUgbGVuZ3RoIG9mIHRoZSBvbGQgYXJyYXlcbiAgICAgKi9cbiAgICBjYWxjU3BsaWNlczogZnVuY3Rpb24oY3VycmVudCwgY3VycmVudFN0YXJ0LCBjdXJyZW50RW5kLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBvbGQsIG9sZFN0YXJ0LCBvbGRFbmQpIHtcbiAgICAgIHZhciBwcmVmaXhDb3VudCA9IDA7XG4gICAgICB2YXIgc3VmZml4Q291bnQgPSAwO1xuXG4gICAgICB2YXIgbWluTGVuZ3RoID0gTWF0aC5taW4oY3VycmVudEVuZCAtIGN1cnJlbnRTdGFydCwgb2xkRW5kIC0gb2xkU3RhcnQpO1xuICAgICAgaWYgKGN1cnJlbnRTdGFydCA9PSAwICYmIG9sZFN0YXJ0ID09IDApXG4gICAgICAgIHByZWZpeENvdW50ID0gdGhpcy5zaGFyZWRQcmVmaXgoY3VycmVudCwgb2xkLCBtaW5MZW5ndGgpO1xuXG4gICAgICBpZiAoY3VycmVudEVuZCA9PSBjdXJyZW50Lmxlbmd0aCAmJiBvbGRFbmQgPT0gb2xkLmxlbmd0aClcbiAgICAgICAgc3VmZml4Q291bnQgPSB0aGlzLnNoYXJlZFN1ZmZpeChjdXJyZW50LCBvbGQsIG1pbkxlbmd0aCAtIHByZWZpeENvdW50KTtcblxuICAgICAgY3VycmVudFN0YXJ0ICs9IHByZWZpeENvdW50O1xuICAgICAgb2xkU3RhcnQgKz0gcHJlZml4Q291bnQ7XG4gICAgICBjdXJyZW50RW5kIC09IHN1ZmZpeENvdW50O1xuICAgICAgb2xkRW5kIC09IHN1ZmZpeENvdW50O1xuXG4gICAgICBpZiAoY3VycmVudEVuZCAtIGN1cnJlbnRTdGFydCA9PSAwICYmIG9sZEVuZCAtIG9sZFN0YXJ0ID09IDApXG4gICAgICAgIHJldHVybiBbXTtcblxuICAgICAgaWYgKGN1cnJlbnRTdGFydCA9PSBjdXJyZW50RW5kKSB7XG4gICAgICAgIHZhciBzcGxpY2UgPSBuZXdTcGxpY2UoY3VycmVudFN0YXJ0LCBbXSwgMCk7XG4gICAgICAgIHdoaWxlIChvbGRTdGFydCA8IG9sZEVuZClcbiAgICAgICAgICBzcGxpY2UucmVtb3ZlZC5wdXNoKG9sZFtvbGRTdGFydCsrXSk7XG5cbiAgICAgICAgcmV0dXJuIFsgc3BsaWNlIF07XG4gICAgICB9IGVsc2UgaWYgKG9sZFN0YXJ0ID09IG9sZEVuZClcbiAgICAgICAgcmV0dXJuIFsgbmV3U3BsaWNlKGN1cnJlbnRTdGFydCwgW10sIGN1cnJlbnRFbmQgLSBjdXJyZW50U3RhcnQpIF07XG5cbiAgICAgIHZhciBvcHMgPSB0aGlzLnNwbGljZU9wZXJhdGlvbnNGcm9tRWRpdERpc3RhbmNlcyhcbiAgICAgICAgICB0aGlzLmNhbGNFZGl0RGlzdGFuY2VzKGN1cnJlbnQsIGN1cnJlbnRTdGFydCwgY3VycmVudEVuZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZCwgb2xkU3RhcnQsIG9sZEVuZCkpO1xuXG4gICAgICB2YXIgc3BsaWNlID0gdW5kZWZpbmVkO1xuICAgICAgdmFyIHNwbGljZXMgPSBbXTtcbiAgICAgIHZhciBpbmRleCA9IGN1cnJlbnRTdGFydDtcbiAgICAgIHZhciBvbGRJbmRleCA9IG9sZFN0YXJ0O1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgc3dpdGNoKG9wc1tpXSkge1xuICAgICAgICAgIGNhc2UgRURJVF9MRUFWRTpcbiAgICAgICAgICAgIGlmIChzcGxpY2UpIHtcbiAgICAgICAgICAgICAgc3BsaWNlcy5wdXNoKHNwbGljZSk7XG4gICAgICAgICAgICAgIHNwbGljZSA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaW5kZXgrKztcbiAgICAgICAgICAgIG9sZEluZGV4Kys7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIEVESVRfVVBEQVRFOlxuICAgICAgICAgICAgaWYgKCFzcGxpY2UpXG4gICAgICAgICAgICAgIHNwbGljZSA9IG5ld1NwbGljZShpbmRleCwgW10sIDApO1xuXG4gICAgICAgICAgICBzcGxpY2UuYWRkZWRDb3VudCsrO1xuICAgICAgICAgICAgaW5kZXgrKztcblxuICAgICAgICAgICAgc3BsaWNlLnJlbW92ZWQucHVzaChvbGRbb2xkSW5kZXhdKTtcbiAgICAgICAgICAgIG9sZEluZGV4Kys7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIEVESVRfQUREOlxuICAgICAgICAgICAgaWYgKCFzcGxpY2UpXG4gICAgICAgICAgICAgIHNwbGljZSA9IG5ld1NwbGljZShpbmRleCwgW10sIDApO1xuXG4gICAgICAgICAgICBzcGxpY2UuYWRkZWRDb3VudCsrO1xuICAgICAgICAgICAgaW5kZXgrKztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgRURJVF9ERUxFVEU6XG4gICAgICAgICAgICBpZiAoIXNwbGljZSlcbiAgICAgICAgICAgICAgc3BsaWNlID0gbmV3U3BsaWNlKGluZGV4LCBbXSwgMCk7XG5cbiAgICAgICAgICAgIHNwbGljZS5yZW1vdmVkLnB1c2gob2xkW29sZEluZGV4XSk7XG4gICAgICAgICAgICBvbGRJbmRleCsrO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHNwbGljZSkge1xuICAgICAgICBzcGxpY2VzLnB1c2goc3BsaWNlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzcGxpY2VzO1xuICAgIH0sXG5cbiAgICBzaGFyZWRQcmVmaXg6IGZ1bmN0aW9uKGN1cnJlbnQsIG9sZCwgc2VhcmNoTGVuZ3RoKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNlYXJjaExlbmd0aDsgaSsrKVxuICAgICAgICBpZiAoIXRoaXMuZXF1YWxzKGN1cnJlbnRbaV0sIG9sZFtpXSkpXG4gICAgICAgICAgcmV0dXJuIGk7XG4gICAgICByZXR1cm4gc2VhcmNoTGVuZ3RoO1xuICAgIH0sXG5cbiAgICBzaGFyZWRTdWZmaXg6IGZ1bmN0aW9uKGN1cnJlbnQsIG9sZCwgc2VhcmNoTGVuZ3RoKSB7XG4gICAgICB2YXIgaW5kZXgxID0gY3VycmVudC5sZW5ndGg7XG4gICAgICB2YXIgaW5kZXgyID0gb2xkLmxlbmd0aDtcbiAgICAgIHZhciBjb3VudCA9IDA7XG4gICAgICB3aGlsZSAoY291bnQgPCBzZWFyY2hMZW5ndGggJiYgdGhpcy5lcXVhbHMoY3VycmVudFstLWluZGV4MV0sIG9sZFstLWluZGV4Ml0pKVxuICAgICAgICBjb3VudCsrO1xuXG4gICAgICByZXR1cm4gY291bnQ7XG4gICAgfSxcblxuICAgIGNhbGN1bGF0ZVNwbGljZXM6IGZ1bmN0aW9uKGN1cnJlbnQsIHByZXZpb3VzKSB7XG4gICAgICByZXR1cm4gdGhpcy5jYWxjU3BsaWNlcyhjdXJyZW50LCAwLCBjdXJyZW50Lmxlbmd0aCwgcHJldmlvdXMsIDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcmV2aW91cy5sZW5ndGgpO1xuICAgIH0sXG5cbiAgICBlcXVhbHM6IGZ1bmN0aW9uKGN1cnJlbnRWYWx1ZSwgcHJldmlvdXNWYWx1ZSkge1xuICAgICAgcmV0dXJuIGN1cnJlbnRWYWx1ZSA9PT0gcHJldmlvdXNWYWx1ZTtcbiAgICB9XG4gIH07XG5cbiAgdmFyIGFycmF5U3BsaWNlID0gbmV3IEFycmF5U3BsaWNlKCk7XG5cbiAgZnVuY3Rpb24gY2FsY1NwbGljZXMoY3VycmVudCwgY3VycmVudFN0YXJ0LCBjdXJyZW50RW5kLFxuICAgICAgICAgICAgICAgICAgICAgICBvbGQsIG9sZFN0YXJ0LCBvbGRFbmQpIHtcbiAgICByZXR1cm4gYXJyYXlTcGxpY2UuY2FsY1NwbGljZXMoY3VycmVudCwgY3VycmVudFN0YXJ0LCBjdXJyZW50RW5kLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGQsIG9sZFN0YXJ0LCBvbGRFbmQpO1xuICB9XG5cbiAgZnVuY3Rpb24gaW50ZXJzZWN0KHN0YXJ0MSwgZW5kMSwgc3RhcnQyLCBlbmQyKSB7XG4gICAgLy8gRGlzam9pbnRcbiAgICBpZiAoZW5kMSA8IHN0YXJ0MiB8fCBlbmQyIDwgc3RhcnQxKVxuICAgICAgcmV0dXJuIC0xO1xuXG4gICAgLy8gQWRqYWNlbnRcbiAgICBpZiAoZW5kMSA9PSBzdGFydDIgfHwgZW5kMiA9PSBzdGFydDEpXG4gICAgICByZXR1cm4gMDtcblxuICAgIC8vIE5vbi16ZXJvIGludGVyc2VjdCwgc3BhbjEgZmlyc3RcbiAgICBpZiAoc3RhcnQxIDwgc3RhcnQyKSB7XG4gICAgICBpZiAoZW5kMSA8IGVuZDIpXG4gICAgICAgIHJldHVybiBlbmQxIC0gc3RhcnQyOyAvLyBPdmVybGFwXG4gICAgICBlbHNlXG4gICAgICAgIHJldHVybiBlbmQyIC0gc3RhcnQyOyAvLyBDb250YWluZWRcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gTm9uLXplcm8gaW50ZXJzZWN0LCBzcGFuMiBmaXJzdFxuICAgICAgaWYgKGVuZDIgPCBlbmQxKVxuICAgICAgICByZXR1cm4gZW5kMiAtIHN0YXJ0MTsgLy8gT3ZlcmxhcFxuICAgICAgZWxzZVxuICAgICAgICByZXR1cm4gZW5kMSAtIHN0YXJ0MTsgLy8gQ29udGFpbmVkXG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gbWVyZ2VTcGxpY2Uoc3BsaWNlcywgaW5kZXgsIHJlbW92ZWQsIGFkZGVkQ291bnQpIHtcblxuICAgIHZhciBzcGxpY2UgPSBuZXdTcGxpY2UoaW5kZXgsIHJlbW92ZWQsIGFkZGVkQ291bnQpO1xuXG4gICAgdmFyIGluc2VydGVkID0gZmFsc2U7XG4gICAgdmFyIGluc2VydGlvbk9mZnNldCA9IDA7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNwbGljZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBjdXJyZW50ID0gc3BsaWNlc1tpXTtcbiAgICAgIGN1cnJlbnQuaW5kZXggKz0gaW5zZXJ0aW9uT2Zmc2V0O1xuXG4gICAgICBpZiAoaW5zZXJ0ZWQpXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICB2YXIgaW50ZXJzZWN0Q291bnQgPSBpbnRlcnNlY3Qoc3BsaWNlLmluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNwbGljZS5pbmRleCArIHNwbGljZS5yZW1vdmVkLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50LmluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnQuaW5kZXggKyBjdXJyZW50LmFkZGVkQ291bnQpO1xuXG4gICAgICBpZiAoaW50ZXJzZWN0Q291bnQgPj0gMCkge1xuICAgICAgICAvLyBNZXJnZSB0aGUgdHdvIHNwbGljZXNcblxuICAgICAgICBzcGxpY2VzLnNwbGljZShpLCAxKTtcbiAgICAgICAgaS0tO1xuXG4gICAgICAgIGluc2VydGlvbk9mZnNldCAtPSBjdXJyZW50LmFkZGVkQ291bnQgLSBjdXJyZW50LnJlbW92ZWQubGVuZ3RoO1xuXG4gICAgICAgIHNwbGljZS5hZGRlZENvdW50ICs9IGN1cnJlbnQuYWRkZWRDb3VudCAtIGludGVyc2VjdENvdW50O1xuICAgICAgICB2YXIgZGVsZXRlQ291bnQgPSBzcGxpY2UucmVtb3ZlZC5sZW5ndGggK1xuICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50LnJlbW92ZWQubGVuZ3RoIC0gaW50ZXJzZWN0Q291bnQ7XG5cbiAgICAgICAgaWYgKCFzcGxpY2UuYWRkZWRDb3VudCAmJiAhZGVsZXRlQ291bnQpIHtcbiAgICAgICAgICAvLyBtZXJnZWQgc3BsaWNlIGlzIGEgbm9vcC4gZGlzY2FyZC5cbiAgICAgICAgICBpbnNlcnRlZCA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyIHJlbW92ZWQgPSBjdXJyZW50LnJlbW92ZWQ7XG5cbiAgICAgICAgICBpZiAoc3BsaWNlLmluZGV4IDwgY3VycmVudC5pbmRleCkge1xuICAgICAgICAgICAgLy8gc29tZSBwcmVmaXggb2Ygc3BsaWNlLnJlbW92ZWQgaXMgcHJlcGVuZGVkIHRvIGN1cnJlbnQucmVtb3ZlZC5cbiAgICAgICAgICAgIHZhciBwcmVwZW5kID0gc3BsaWNlLnJlbW92ZWQuc2xpY2UoMCwgY3VycmVudC5pbmRleCAtIHNwbGljZS5pbmRleCk7XG4gICAgICAgICAgICBBcnJheS5wcm90b3R5cGUucHVzaC5hcHBseShwcmVwZW5kLCByZW1vdmVkKTtcbiAgICAgICAgICAgIHJlbW92ZWQgPSBwcmVwZW5kO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChzcGxpY2UuaW5kZXggKyBzcGxpY2UucmVtb3ZlZC5sZW5ndGggPiBjdXJyZW50LmluZGV4ICsgY3VycmVudC5hZGRlZENvdW50KSB7XG4gICAgICAgICAgICAvLyBzb21lIHN1ZmZpeCBvZiBzcGxpY2UucmVtb3ZlZCBpcyBhcHBlbmRlZCB0byBjdXJyZW50LnJlbW92ZWQuXG4gICAgICAgICAgICB2YXIgYXBwZW5kID0gc3BsaWNlLnJlbW92ZWQuc2xpY2UoY3VycmVudC5pbmRleCArIGN1cnJlbnQuYWRkZWRDb3VudCAtIHNwbGljZS5pbmRleCk7XG4gICAgICAgICAgICBBcnJheS5wcm90b3R5cGUucHVzaC5hcHBseShyZW1vdmVkLCBhcHBlbmQpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHNwbGljZS5yZW1vdmVkID0gcmVtb3ZlZDtcbiAgICAgICAgICBpZiAoY3VycmVudC5pbmRleCA8IHNwbGljZS5pbmRleCkge1xuICAgICAgICAgICAgc3BsaWNlLmluZGV4ID0gY3VycmVudC5pbmRleDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoc3BsaWNlLmluZGV4IDwgY3VycmVudC5pbmRleCkge1xuICAgICAgICAvLyBJbnNlcnQgc3BsaWNlIGhlcmUuXG5cbiAgICAgICAgaW5zZXJ0ZWQgPSB0cnVlO1xuXG4gICAgICAgIHNwbGljZXMuc3BsaWNlKGksIDAsIHNwbGljZSk7XG4gICAgICAgIGkrKztcblxuICAgICAgICB2YXIgb2Zmc2V0ID0gc3BsaWNlLmFkZGVkQ291bnQgLSBzcGxpY2UucmVtb3ZlZC5sZW5ndGhcbiAgICAgICAgY3VycmVudC5pbmRleCArPSBvZmZzZXQ7XG4gICAgICAgIGluc2VydGlvbk9mZnNldCArPSBvZmZzZXQ7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFpbnNlcnRlZClcbiAgICAgIHNwbGljZXMucHVzaChzcGxpY2UpO1xuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlSW5pdGlhbFNwbGljZXMoYXJyYXksIGNoYW5nZVJlY29yZHMpIHtcbiAgICB2YXIgc3BsaWNlcyA9IFtdO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGFuZ2VSZWNvcmRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgcmVjb3JkID0gY2hhbmdlUmVjb3Jkc1tpXTtcbiAgICAgIHN3aXRjaChyZWNvcmQudHlwZSkge1xuICAgICAgICBjYXNlICdzcGxpY2UnOlxuICAgICAgICAgIG1lcmdlU3BsaWNlKHNwbGljZXMsIHJlY29yZC5pbmRleCwgcmVjb3JkLnJlbW92ZWQuc2xpY2UoKSwgcmVjb3JkLmFkZGVkQ291bnQpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdhZGQnOlxuICAgICAgICBjYXNlICd1cGRhdGUnOlxuICAgICAgICBjYXNlICdkZWxldGUnOlxuICAgICAgICAgIGlmICghaXNJbmRleChyZWNvcmQubmFtZSkpXG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB2YXIgaW5kZXggPSB0b051bWJlcihyZWNvcmQubmFtZSk7XG4gICAgICAgICAgaWYgKGluZGV4IDwgMClcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIG1lcmdlU3BsaWNlKHNwbGljZXMsIGluZGV4LCBbcmVjb3JkLm9sZFZhbHVlXSwgMSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgY29uc29sZS5lcnJvcignVW5leHBlY3RlZCByZWNvcmQgdHlwZTogJyArIEpTT04uc3RyaW5naWZ5KHJlY29yZCkpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBzcGxpY2VzO1xuICB9XG5cbiAgZnVuY3Rpb24gcHJvamVjdEFycmF5U3BsaWNlcyhhcnJheSwgY2hhbmdlUmVjb3Jkcykge1xuICAgIHZhciBzcGxpY2VzID0gW107XG5cbiAgICBjcmVhdGVJbml0aWFsU3BsaWNlcyhhcnJheSwgY2hhbmdlUmVjb3JkcykuZm9yRWFjaChmdW5jdGlvbihzcGxpY2UpIHtcbiAgICAgIGlmIChzcGxpY2UuYWRkZWRDb3VudCA9PSAxICYmIHNwbGljZS5yZW1vdmVkLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgIGlmIChzcGxpY2UucmVtb3ZlZFswXSAhPT0gYXJyYXlbc3BsaWNlLmluZGV4XSlcbiAgICAgICAgICBzcGxpY2VzLnB1c2goc3BsaWNlKTtcblxuICAgICAgICByZXR1cm5cbiAgICAgIH07XG5cbiAgICAgIHNwbGljZXMgPSBzcGxpY2VzLmNvbmNhdChjYWxjU3BsaWNlcyhhcnJheSwgc3BsaWNlLmluZGV4LCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcGxpY2UucmVtb3ZlZCwgMCwgc3BsaWNlLnJlbW92ZWQubGVuZ3RoKSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gc3BsaWNlcztcbiAgfVxuXG4gLy8gRXhwb3J0IHRoZSBvYnNlcnZlLWpzIG9iamVjdCBmb3IgKipOb2RlLmpzKiosIHdpdGhcbi8vIGJhY2t3YXJkcy1jb21wYXRpYmlsaXR5IGZvciB0aGUgb2xkIGByZXF1aXJlKClgIEFQSS4gSWYgd2UncmUgaW5cbi8vIHRoZSBicm93c2VyLCBleHBvcnQgYXMgYSBnbG9iYWwgb2JqZWN0LlxudmFyIGV4cG9zZSA9IGdsb2JhbDtcbmlmICh0eXBlb2YgZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcbmlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cykge1xuZXhwb3NlID0gZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzO1xufVxuZXhwb3NlID0gZXhwb3J0cztcbn1cbmV4cG9zZS5PYnNlcnZlciA9IE9ic2VydmVyO1xuZXhwb3NlLk9ic2VydmVyLnJ1bkVPTV8gPSBydW5FT007XG5leHBvc2UuT2JzZXJ2ZXIub2JzZXJ2ZXJTZW50aW5lbF8gPSBvYnNlcnZlclNlbnRpbmVsOyAvLyBmb3IgdGVzdGluZy5cbmV4cG9zZS5PYnNlcnZlci5oYXNPYmplY3RPYnNlcnZlID0gaGFzT2JzZXJ2ZTtcbmV4cG9zZS5BcnJheU9ic2VydmVyID0gQXJyYXlPYnNlcnZlcjtcbmV4cG9zZS5BcnJheU9ic2VydmVyLmNhbGN1bGF0ZVNwbGljZXMgPSBmdW5jdGlvbihjdXJyZW50LCBwcmV2aW91cykge1xucmV0dXJuIGFycmF5U3BsaWNlLmNhbGN1bGF0ZVNwbGljZXMoY3VycmVudCwgcHJldmlvdXMpO1xufTtcbmV4cG9zZS5QbGF0Zm9ybSA9IGdsb2JhbC5QbGF0Zm9ybTtcbmV4cG9zZS5BcnJheVNwbGljZSA9IEFycmF5U3BsaWNlO1xuZXhwb3NlLk9iamVjdE9ic2VydmVyID0gT2JqZWN0T2JzZXJ2ZXI7XG59KSh0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJyAmJiBnbG9iYWwgJiYgdHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlID8gZ2xvYmFsIDogdGhpcyB8fCB3aW5kb3cpO1xuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlLmpzXG4gKiogbW9kdWxlIGlkID0gMjNcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsIi8qKlxuICogQSBkZWFkIHNpbXBsZSBpbXBsZW1lbnRhdGlvbiBvZiBFUzYgcHJvbWlzZSwgdGhhdCBkb2VzIG5vdCBzd2FsbG93IGVycm9ycy5cbiAqIEBwYXJhbSBmblxuICogQGNvbnN0cnVjdG9yXG4gKi9cblxuZnVuY3Rpb24gUHJvbWlzZShmbikge1xuICB0aGlzLm9rQ2FsbGJhY2tzID0gW107XG4gIHRoaXMuZXJyb3JDYWxsYmFja3MgPSBbXTtcblxuICB0aGlzLnJlc29sdmVkID0gbnVsbDtcbiAgdGhpcy5yZWplY3RlZCA9IG51bGw7XG4gIHRoaXMuaXNSZXNvbHZlZCA9IGZhbHNlO1xuICB0aGlzLmlzUmVqZWN0ZWQgPSBmYWxzZTtcblxuXG4gIHZhciByZXNvbHZlID0gZnVuY3Rpb24ocGF5bG9hZCkge1xuICAgIGlmICghKHRoaXMucmVzb2x2ZWQgfHwgdGhpcy5yZWplY3RlZCkpIHtcbiAgICAgIHRoaXMucmVzb2x2ZWQgPSBwYXlsb2FkO1xuICAgICAgdGhpcy5pc1Jlc29sdmVkID0gdHJ1ZTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5va0NhbGxiYWNrcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgY2IgPSB0aGlzLm9rQ2FsbGJhY2tzW2ldO1xuICAgICAgICBjYihwYXlsb2FkKTtcbiAgICAgIH1cbiAgICB9XG4gIH0uYmluZCh0aGlzKTtcblxuICB2YXIgcmVqZWN0ID0gZnVuY3Rpb24oZXJyKSB7XG4gICAgaWYgKCEodGhpcy5yZXNvbHZlZCB8fCB0aGlzLnJlamVjdGVkKSkge1xuICAgICAgdGhpcy5yZWplY3RlZCA9IGVycjtcbiAgICAgIHRoaXMuaXNSZWplY3RlZCA9IHRydWU7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuZXJyb3JDYWxsYmFja3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGNiID0gdGhpcy5lcnJvckNhbGxiYWNrc1tpXTtcbiAgICAgICAgY2IoZXJyKTtcbiAgICAgIH1cbiAgICB9XG4gIH0uYmluZCh0aGlzKTtcblxuICBpZiAoZm4pIGZuKHJlc29sdmUsIHJlamVjdCk7XG59XG5cblByb21pc2UuYWxsID0gZnVuY3Rpb24ocHJvbWlzZXMpIHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgIHZhciBuID0gcHJvbWlzZXMubGVuZ3RoO1xuICAgIGlmIChuKSB7XG4gICAgICB2YXIgbnVtUmVzb2x2ZSA9IDA7XG4gICAgICB2YXIgbnVtUmVqZWN0ID0gMDtcbiAgICAgIHZhciByZXNvbHZlVmFsdWVzID0gW107XG4gICAgICB2YXIgcmVqZWN0VmFsdWVzID0gW107XG5cbiAgICAgIHByb21pc2VzLmZvckVhY2goZnVuY3Rpb24ocHJvbWlzZSwgaWR4KSB7XG4gICAgICAgIHByb21pc2UudGhlbihmdW5jdGlvbihwYXlsb2FkKSB7XG4gICAgICAgICAgcmVzb2x2ZVZhbHVlc1tpZHhdID0gcGF5bG9hZDtcbiAgICAgICAgICBudW1SZXNvbHZlKys7XG4gICAgICAgICAgY2hlY2soKTtcbiAgICAgICAgfSwgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgcmVqZWN0VmFsdWVzW2lkeF0gPSBlcnI7XG4gICAgICAgICAgbnVtUmVqZWN0Kys7XG4gICAgICAgICAgY2hlY2soKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgICAgZnVuY3Rpb24gY2hlY2soKSB7XG4gICAgICAgIGlmICgobnVtUmVzb2x2ZSArIG51bVJlamVjdCkgPT0gbikge1xuICAgICAgICAgIGlmIChudW1SZWplY3QpIHJlamVjdChyZWplY3RWYWx1ZXMpO1xuICAgICAgICAgIGVsc2UgcmVzb2x2ZShyZXNvbHZlVmFsdWVzKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHJlc29sdmUoW10pO1xuICB9KTtcbn07XG5cblByb21pc2UucHJvdG90eXBlID0ge1xuICB0aGVuOiBmdW5jdGlvbihvaywgZXJyKSB7XG4gICAgaWYgKHRoaXMuaXNSZXNvbHZlZCkge1xuICAgICAgaWYgKG9rKSB7XG4gICAgICAgIG9rKHRoaXMucmVzb2x2ZWQpO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIGlmICh0aGlzLmlzUmVqZWN0ZWQpIHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgZXJyKHRoaXMucmVqZWN0ZWQpO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGlmIChvaykge1xuICAgICAgICB0aGlzLm9rQ2FsbGJhY2tzLnB1c2gob2spO1xuICAgICAgfVxuICAgICAgaWYgKGVycikge1xuICAgICAgICB0aGlzLmVycm9yQ2FsbGJhY2tzLnB1c2goZXJyKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG4gIGNhdGNoOiBmdW5jdGlvbihlcnIpIHtcbiAgICBpZiAodGhpcy5pc1JlamVjdGVkKSB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIGVycih0aGlzLnJlamVjdGVkKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIHRoaXMuZXJyb3JDYWxsYmFja3MucHVzaChlcnIpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBQcm9taXNlO1xuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvUHJvbWlzZS5qc1xuICoqIG1vZHVsZSBpZCA9IDI0XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJ2YXIgYXJnc2FycmF5ID0gcmVxdWlyZSgnYXJnc2FycmF5Jyk7XG5cbi8qKlxuICogQ2xhc3MgZm9yIGZhY2lsaXRhdGluZyBcImNoYWluZWRcIiBiZWhhdmlvdXIgZS5nOlxuICpcbiAqIHZhciBjYW5jZWwgPSBVc2Vyc1xuICogIC5vbignbmV3JywgZnVuY3Rpb24gKHVzZXIpIHtcbiAgICogICAgIC8vIC4uLlxuICAgKiAgIH0pXG4gKiAgLnF1ZXJ5KHskb3I6IHthZ2VfX2d0ZTogMjAsIGFnZV9fbHRlOiAzMH19KVxuICogIC5vbignKicsIGZ1bmN0aW9uIChjaGFuZ2UpIHtcbiAgICogICAgIC8vIC4uXG4gICAqICAgfSk7XG4gKlxuICogQHBhcmFtIG9wdHNcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBDaGFpbihvcHRzKSB7XG4gIHRoaXMub3B0cyA9IG9wdHM7XG59XG5cbkNoYWluLnByb3RvdHlwZSA9IHtcbiAgLyoqXG4gICAqIENvbnN0cnVjdCBhIGxpbmsgaW4gdGhlIGNoYWluIG9mIGNhbGxzLlxuICAgKiBAcGFyYW0gb3B0c1xuICAgKiBAcGFyYW0gb3B0cy5mblxuICAgKiBAcGFyYW0gb3B0cy50eXBlXG4gICAqL1xuICBfaGFuZGxlckxpbms6IGZ1bmN0aW9uKG9wdHMpIHtcbiAgICB2YXIgZmlyc3RMaW5rO1xuICAgIGZpcnN0TGluayA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHR5cCA9IG9wdHMudHlwZTtcbiAgICAgIGlmIChvcHRzLmZuKVxuICAgICAgICB0aGlzLl9yZW1vdmVMaXN0ZW5lcihvcHRzLmZuLCB0eXApO1xuICAgICAgaWYgKGZpcnN0TGluay5fcGFyZW50TGluaykgZmlyc3RMaW5rLl9wYXJlbnRMaW5rKCk7IC8vIENhbmNlbCBsaXN0ZW5lcnMgYWxsIHRoZSB3YXkgdXAgdGhlIGNoYWluLlxuICAgIH0uYmluZCh0aGlzKTtcbiAgICBPYmplY3Qua2V5cyh0aGlzLm9wdHMpLmZvckVhY2goZnVuY3Rpb24ocHJvcCkge1xuICAgICAgdmFyIGZ1bmMgPSB0aGlzLm9wdHNbcHJvcF07XG4gICAgICBmaXJzdExpbmtbcHJvcF0gPSBhcmdzYXJyYXkoZnVuY3Rpb24oYXJncykge1xuICAgICAgICB2YXIgbGluayA9IGZ1bmMuYXBwbHkoZnVuYy5fX3NpZXN0YV9ib3VuZF9vYmplY3QsIGFyZ3MpO1xuICAgICAgICBsaW5rLl9wYXJlbnRMaW5rID0gZmlyc3RMaW5rO1xuICAgICAgICByZXR1cm4gbGluaztcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgICBmaXJzdExpbmsuX3BhcmVudExpbmsgPSBudWxsO1xuICAgIHJldHVybiBmaXJzdExpbms7XG4gIH0sXG4gIC8qKlxuICAgKiBDb25zdHJ1Y3QgYSBsaW5rIGluIHRoZSBjaGFpbiBvZiBjYWxscy5cbiAgICogQHBhcmFtIG9wdHNcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NsZWFuXVxuICAgKi9cbiAgX2xpbms6IGZ1bmN0aW9uKG9wdHMsIGNsZWFuKSB7XG4gICAgdmFyIGNoYWluID0gdGhpcztcbiAgICBjbGVhbiA9IGNsZWFuIHx8IGZ1bmN0aW9uKCkge307XG4gICAgdmFyIGxpbms7XG4gICAgbGluayA9IGZ1bmN0aW9uKCkge1xuICAgICAgY2xlYW4oKTtcbiAgICAgIGlmIChsaW5rLl9wYXJlbnRMaW5rKSBsaW5rLl9wYXJlbnRMaW5rKCk7IC8vIENhbmNlbCBsaXN0ZW5lcnMgYWxsIHRoZSB3YXkgdXAgdGhlIGNoYWluLlxuICAgIH0uYmluZCh0aGlzKTtcbiAgICBsaW5rLl9fc2llc3RhX2lzTGluayA9IHRydWU7XG4gICAgbGluay5vcHRzID0gb3B0cztcbiAgICBsaW5rLmNsZWFuID0gY2xlYW47XG4gICAgT2JqZWN0LmtleXMob3B0cykuZm9yRWFjaChmdW5jdGlvbihwcm9wKSB7XG4gICAgICB2YXIgZnVuYyA9IG9wdHNbcHJvcF07XG4gICAgICBsaW5rW3Byb3BdID0gYXJnc2FycmF5KGZ1bmN0aW9uKGFyZ3MpIHtcbiAgICAgICAgdmFyIHBvc3NpYmxlTGluayA9IGZ1bmMuYXBwbHkoZnVuYy5fX3NpZXN0YV9ib3VuZF9vYmplY3QsIGFyZ3MpO1xuICAgICAgICBpZiAoIXBvc3NpYmxlTGluayB8fCAhcG9zc2libGVMaW5rLl9fc2llc3RhX2lzTGluaykgeyAvLyBQYXRjaCBpbiBhIGxpbmsgaW4gdGhlIGNoYWluIHRvIGF2b2lkIGl0IGJlaW5nIGJyb2tlbiwgYmFzaW5nIG9mZiB0aGUgY3VycmVudCBsaW5rXG4gICAgICAgICAgbmV4dExpbmsgPSBjaGFpbi5fbGluayhsaW5rLm9wdHMpO1xuICAgICAgICAgIGZvciAodmFyIHByb3AgaW4gcG9zc2libGVMaW5rKSB7XG4gICAgICAgICAgICAvL25vaW5zcGVjdGlvbiBKU1VuZmlsdGVyZWRGb3JJbkxvb3BcbiAgICAgICAgICAgIGlmIChwb3NzaWJsZUxpbmtbcHJvcF0gaW5zdGFuY2VvZiBGdW5jdGlvbikge1xuICAgICAgICAgICAgICAvL25vaW5zcGVjdGlvbiBKU1VuZmlsdGVyZWRGb3JJbkxvb3BcbiAgICAgICAgICAgICAgbmV4dExpbmtbcHJvcF0gPSBwb3NzaWJsZUxpbmtbcHJvcF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIHZhciBuZXh0TGluayA9IHBvc3NpYmxlTGluaztcbiAgICAgICAgfVxuICAgICAgICBuZXh0TGluay5fcGFyZW50TGluayA9IGxpbms7XG4gICAgICAgIC8vIEluaGVyaXQgbWV0aG9kcyBmcm9tIHRoZSBwYXJlbnQgbGluayBpZiB0aG9zZSBtZXRob2RzIGRvbid0IGFscmVhZHkgZXhpc3QuXG4gICAgICAgIGZvciAocHJvcCBpbiBsaW5rKSB7XG4gICAgICAgICAgaWYgKGxpbmtbcHJvcF0gaW5zdGFuY2VvZiBGdW5jdGlvbikge1xuICAgICAgICAgICAgbmV4dExpbmtbcHJvcF0gPSBsaW5rW3Byb3BdLmJpbmQobGluayk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXh0TGluaztcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgICBsaW5rLl9wYXJlbnRMaW5rID0gbnVsbDtcbiAgICByZXR1cm4gbGluaztcbiAgfVxufTtcbm1vZHVsZS5leHBvcnRzID0gQ2hhaW47XG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvQ2hhaW4uanNcbiAqKiBtb2R1bGUgaWQgPSAyNVxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwiLyoqXG4gKiBUaGlzIGlzIGFuIGluLW1lbW9yeSBjYWNoZSBmb3IgbW9kZWxzLiBNb2RlbHMgYXJlIGNhY2hlZCBieSBsb2NhbCBpZCAoX2lkKSBhbmQgcmVtb3RlIGlkIChkZWZpbmVkIGJ5IHRoZSBtYXBwaW5nKS5cbiAqIExvb2t1cHMgYXJlIHBlcmZvcm1lZCBhZ2FpbnN0IHRoZSBjYWNoZSB3aGVuIG1hcHBpbmcuXG4gKiBAbW9kdWxlIGNhY2hlXG4gKi9cbnZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpKCdjYWNoZScpLFxuICBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcblxuXG5mdW5jdGlvbiBDYWNoZSgpIHtcbiAgdGhpcy5yZXNldCgpO1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ19sb2NhbENhY2hlQnlUeXBlJywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5sb2NhbDtcbiAgICB9XG4gIH0pO1xufVxuXG5DYWNoZS5wcm90b3R5cGUgPSB7XG4gIHJlc2V0OiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnJlbW90ZSA9IHt9O1xuICAgIHRoaXMubG9jYWxCeUlkID0ge307XG4gICAgdGhpcy5sb2NhbCA9IHt9O1xuICB9LFxuICAvKipcbiAgICogUmV0dXJuIHRoZSBvYmplY3QgaW4gdGhlIGNhY2hlIGdpdmVuIGEgbG9jYWwgaWQgKF9pZClcbiAgICogQHBhcmFtICB7U3RyaW5nfEFycmF5fSBsb2NhbElkXG4gICAqIEByZXR1cm4ge01vZGVsSW5zdGFuY2V9XG4gICAqL1xuICBnZXRWaWFMb2NhbElkOiBmdW5jdGlvbiBnZXRWaWFMb2NhbElkKGxvY2FsSWQpIHtcbiAgICBpZiAodXRpbC5pc0FycmF5KGxvY2FsSWQpKSByZXR1cm4gbG9jYWxJZC5tYXAoZnVuY3Rpb24oeCkge3JldHVybiB0aGlzLmxvY2FsQnlJZFt4XX0uYmluZCh0aGlzKSk7XG4gICAgZWxzZSByZXR1cm4gdGhpcy5sb2NhbEJ5SWRbbG9jYWxJZF07XG4gIH0sXG4gIC8qKlxuICAgKiBHaXZlbiBhIHJlbW90ZSBpZGVudGlmaWVyIGFuZCBhbiBvcHRpb25zIG9iamVjdCB0aGF0IGRlc2NyaWJlcyBtYXBwaW5nL2NvbGxlY3Rpb24sXG4gICAqIHJldHVybiB0aGUgbW9kZWwgaWYgY2FjaGVkLlxuICAgKiBAcGFyYW0gIHtTdHJpbmd8QXJyYXl9IHJlbW90ZUlkXG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0c1xuICAgKiBAcGFyYW0gIHtPYmplY3R9IG9wdHMubW9kZWxcbiAgICogQHJldHVybiB7TW9kZWxJbnN0YW5jZX1cbiAgICovXG4gIGdldFZpYVJlbW90ZUlkOiBmdW5jdGlvbihyZW1vdGVJZCwgb3B0cykge1xuICAgIHZhciBjID0gKHRoaXMucmVtb3RlW29wdHMubW9kZWwuY29sbGVjdGlvbk5hbWVdIHx8IHt9KVtvcHRzLm1vZGVsLm5hbWVdIHx8IHt9O1xuICAgIHJldHVybiB1dGlsLmlzQXJyYXkocmVtb3RlSWQpID8gcmVtb3RlSWQubWFwKGZ1bmN0aW9uKHgpIHtyZXR1cm4gY1t4XX0pIDogY1tyZW1vdGVJZF07XG4gIH0sXG4gIC8qKlxuICAgKiBSZXR1cm4gdGhlIHNpbmdsZXRvbiBvYmplY3QgZ2l2ZW4gYSBzaW5nbGV0b24gbW9kZWwuXG4gICAqIEBwYXJhbSAge01vZGVsfSBtb2RlbFxuICAgKiBAcmV0dXJuIHtNb2RlbEluc3RhbmNlfVxuICAgKi9cbiAgZ2V0U2luZ2xldG9uOiBmdW5jdGlvbihtb2RlbCkge1xuICAgIHZhciBtb2RlbE5hbWUgPSBtb2RlbC5uYW1lO1xuICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IG1vZGVsLmNvbGxlY3Rpb25OYW1lO1xuICAgIHZhciBjb2xsZWN0aW9uQ2FjaGUgPSB0aGlzLmxvY2FsW2NvbGxlY3Rpb25OYW1lXTtcbiAgICBpZiAoY29sbGVjdGlvbkNhY2hlKSB7XG4gICAgICB2YXIgdHlwZUNhY2hlID0gY29sbGVjdGlvbkNhY2hlW21vZGVsTmFtZV07XG4gICAgICBpZiAodHlwZUNhY2hlKSB7XG4gICAgICAgIHZhciBvYmpzID0gW107XG4gICAgICAgIGZvciAodmFyIHByb3AgaW4gdHlwZUNhY2hlKSB7XG4gICAgICAgICAgaWYgKHR5cGVDYWNoZS5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgICAgb2Jqcy5wdXNoKHR5cGVDYWNoZVtwcm9wXSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChvYmpzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICB2YXIgZXJyU3RyID0gJ0Egc2luZ2xldG9uIG1vZGVsIGhhcyBtb3JlIHRoYW4gMSBvYmplY3QgaW4gdGhlIGNhY2hlISBUaGlzIGlzIGEgc2VyaW91cyBlcnJvci4gJyArXG4gICAgICAgICAgICAnRWl0aGVyIGEgbW9kZWwgaGFzIGJlZW4gbW9kaWZpZWQgYWZ0ZXIgb2JqZWN0cyBoYXZlIGFscmVhZHkgYmVlbiBjcmVhdGVkLCBvciBzb21ldGhpbmcgaGFzIGdvbmUnICtcbiAgICAgICAgICAgICd2ZXJ5IHdyb25nLiBQbGVhc2UgZmlsZSBhIGJ1ZyByZXBvcnQgaWYgdGhlIGxhdHRlci4nO1xuICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKGVyclN0cik7XG4gICAgICAgIH0gZWxzZSBpZiAob2Jqcy5sZW5ndGgpIHtcbiAgICAgICAgICByZXR1cm4gb2Jqc1swXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcbiAgLyoqXG4gICAqIEluc2VydCBhbiBvYmplY3QgaW50byB0aGUgY2FjaGUgdXNpbmcgYSByZW1vdGUgaWRlbnRpZmllciBkZWZpbmVkIGJ5IHRoZSBtYXBwaW5nLlxuICAgKiBAcGFyYW0gIHtNb2RlbEluc3RhbmNlfSBvYmpcbiAgICogQHBhcmFtICB7U3RyaW5nfSByZW1vdGVJZFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IFtwcmV2aW91c1JlbW90ZUlkXSBJZiByZW1vdGUgaWQgaGFzIGJlZW4gY2hhbmdlZCwgdGhpcyBpcyB0aGUgb2xkIHJlbW90ZSBpZGVudGlmaWVyXG4gICAqL1xuICByZW1vdGVJbnNlcnQ6IGZ1bmN0aW9uKG9iaiwgcmVtb3RlSWQsIHByZXZpb3VzUmVtb3RlSWQpIHtcbiAgICBpZiAob2JqKSB7XG4gICAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBvYmoubW9kZWwuY29sbGVjdGlvbk5hbWU7XG4gICAgICBpZiAoY29sbGVjdGlvbk5hbWUpIHtcbiAgICAgICAgaWYgKCF0aGlzLnJlbW90ZVtjb2xsZWN0aW9uTmFtZV0pIHtcbiAgICAgICAgICB0aGlzLnJlbW90ZVtjb2xsZWN0aW9uTmFtZV0gPSB7fTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgdHlwZSA9IG9iai5tb2RlbC5uYW1lO1xuICAgICAgICBpZiAodHlwZSkge1xuICAgICAgICAgIGlmICghdGhpcy5yZW1vdGVbY29sbGVjdGlvbk5hbWVdW3R5cGVdKSB7XG4gICAgICAgICAgICB0aGlzLnJlbW90ZVtjb2xsZWN0aW9uTmFtZV1bdHlwZV0gPSB7fTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHByZXZpb3VzUmVtb3RlSWQpIHtcbiAgICAgICAgICAgIHRoaXMucmVtb3RlW2NvbGxlY3Rpb25OYW1lXVt0eXBlXVtwcmV2aW91c1JlbW90ZUlkXSA9IG51bGw7XG4gICAgICAgICAgfVxuICAgICAgICAgIHZhciBjYWNoZWRPYmplY3QgPSB0aGlzLnJlbW90ZVtjb2xsZWN0aW9uTmFtZV1bdHlwZV1bcmVtb3RlSWRdO1xuICAgICAgICAgIGlmICghY2FjaGVkT2JqZWN0KSB7XG4gICAgICAgICAgICB0aGlzLnJlbW90ZVtjb2xsZWN0aW9uTmFtZV1bdHlwZV1bcmVtb3RlSWRdID0gb2JqO1xuICAgICAgICAgICAgbG9nKCdSZW1vdGUgY2FjaGUgaW5zZXJ0OiAnICsgb2JqLl9kdW1wKHRydWUpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gU29tZXRoaW5nIGhhcyBnb25lIHJlYWxseSB3cm9uZy4gT25seSBvbmUgb2JqZWN0IGZvciBhIHBhcnRpY3VsYXIgY29sbGVjdGlvbi90eXBlL3JlbW90ZWlkIGNvbWJvXG4gICAgICAgICAgICAvLyBzaG91bGQgZXZlciBleGlzdC5cbiAgICAgICAgICAgIGlmIChvYmogIT0gY2FjaGVkT2JqZWN0KSB7XG4gICAgICAgICAgICAgIHZhciBtZXNzYWdlID0gJ09iamVjdCAnICsgY29sbGVjdGlvbk5hbWUudG9TdHJpbmcoKSArICc6JyArIHR5cGUudG9TdHJpbmcoKSArICdbJyArIG9iai5tb2RlbC5pZCArICc9XCInICsgcmVtb3RlSWQgKyAnXCJdIGFscmVhZHkgZXhpc3RzIGluIHRoZSBjYWNoZS4nICtcbiAgICAgICAgICAgICAgICAnIFRoaXMgaXMgYSBzZXJpb3VzIGVycm9yLCBwbGVhc2UgZmlsZSBhIGJ1ZyByZXBvcnQgaWYgeW91IGFyZSBleHBlcmllbmNpbmcgdGhpcyBvdXQgaW4gdGhlIHdpbGQnO1xuICAgICAgICAgICAgICBsb2cobWVzc2FnZSwge1xuICAgICAgICAgICAgICAgIG9iajogb2JqLFxuICAgICAgICAgICAgICAgIGNhY2hlZE9iamVjdDogY2FjaGVkT2JqZWN0XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihtZXNzYWdlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ01vZGVsIGhhcyBubyB0eXBlJywge1xuICAgICAgICAgICAgbW9kZWw6IG9iai5tb2RlbCxcbiAgICAgICAgICAgIG9iajogb2JqXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNb2RlbCBoYXMgbm8gY29sbGVjdGlvbicsIHtcbiAgICAgICAgICBtb2RlbDogb2JqLm1vZGVsLFxuICAgICAgICAgIG9iajogb2JqXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgbXNnID0gJ011c3QgcGFzcyBhbiBvYmplY3Qgd2hlbiBpbnNlcnRpbmcgdG8gY2FjaGUnO1xuICAgICAgbG9nKG1zZyk7XG4gICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihtc2cpO1xuICAgIH1cbiAgfSxcbiAgLyoqXG4gICAqIFF1ZXJ5IHRoZSBjYWNoZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IG9wdHMgT2JqZWN0IGRlc2NyaWJpbmcgdGhlIHF1ZXJ5XG4gICAqIEByZXR1cm4ge01vZGVsSW5zdGFuY2V9XG4gICAqIEBleGFtcGxlXG4gICAqIGBgYGpzXG4gICAqIGNhY2hlLmdldCh7X2lkOiAnNSd9KTsgLy8gUXVlcnkgYnkgbG9jYWwgaWRcbiAgICogY2FjaGUuZ2V0KHtyZW1vdGVJZDogJzUnLCBtYXBwaW5nOiBteU1hcHBpbmd9KTsgLy8gUXVlcnkgYnkgcmVtb3RlIGlkXG4gICAqIGBgYFxuICAgKi9cbiAgZ2V0OiBmdW5jdGlvbihvcHRzKSB7XG4gICAgbG9nKCdnZXQnLCBvcHRzKTtcbiAgICB2YXIgb2JqLCBpZEZpZWxkLCByZW1vdGVJZDtcbiAgICB2YXIgbG9jYWxJZCA9IG9wdHMubG9jYWxJZDtcbiAgICBpZiAobG9jYWxJZCkge1xuICAgICAgb2JqID0gdGhpcy5nZXRWaWFMb2NhbElkKGxvY2FsSWQpO1xuICAgICAgaWYgKG9iaikge1xuICAgICAgICByZXR1cm4gb2JqO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKG9wdHMubW9kZWwpIHtcbiAgICAgICAgICBpZEZpZWxkID0gb3B0cy5tb2RlbC5pZDtcbiAgICAgICAgICByZW1vdGVJZCA9IG9wdHNbaWRGaWVsZF07XG4gICAgICAgICAgbG9nKGlkRmllbGQgKyAnPScgKyByZW1vdGVJZCk7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuZ2V0VmlhUmVtb3RlSWQocmVtb3RlSWQsIG9wdHMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChvcHRzLm1vZGVsKSB7XG4gICAgICBpZEZpZWxkID0gb3B0cy5tb2RlbC5pZDtcbiAgICAgIHJlbW90ZUlkID0gb3B0c1tpZEZpZWxkXTtcbiAgICAgIGlmIChyZW1vdGVJZCkge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRWaWFSZW1vdGVJZChyZW1vdGVJZCwgb3B0cyk7XG4gICAgICB9IGVsc2UgaWYgKG9wdHMubW9kZWwuc2luZ2xldG9uKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldFNpbmdsZXRvbihvcHRzLm1vZGVsKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbG9nKCdJbnZhbGlkIG9wdHMgdG8gY2FjaGUnLCB7XG4gICAgICAgIG9wdHM6IG9wdHNcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcbiAgX3JlbW90ZUNhY2hlOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5yZW1vdGVcbiAgfSxcbiAgX2xvY2FsQ2FjaGU6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmxvY2FsQnlJZDtcbiAgfSxcbiAgLyoqXG4gICAqIEluc2VydCBhbiBvYmplY3QgaW50byB0aGUgY2FjaGUuXG4gICAqIEBwYXJhbSAge01vZGVsSW5zdGFuY2V9IG9ialxuICAgKiBAdGhyb3dzIHtJbnRlcm5hbFNpZXN0YUVycm9yfSBBbiBvYmplY3Qgd2l0aCBfaWQvcmVtb3RlSWQgYWxyZWFkeSBleGlzdHMuIE5vdCB0aHJvd24gaWYgc2FtZSBvYmhlY3QuXG4gICAqL1xuICBpbnNlcnQ6IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBsb2NhbElkID0gb2JqLmxvY2FsSWQ7XG4gICAgaWYgKGxvY2FsSWQpIHtcbiAgICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IG9iai5tb2RlbC5jb2xsZWN0aW9uTmFtZTtcbiAgICAgIHZhciBtb2RlbE5hbWUgPSBvYmoubW9kZWwubmFtZTtcbiAgICAgIGlmICghdGhpcy5sb2NhbEJ5SWRbbG9jYWxJZF0pIHtcbiAgICAgICAgdGhpcy5sb2NhbEJ5SWRbbG9jYWxJZF0gPSBvYmo7XG4gICAgICAgIGlmICghdGhpcy5sb2NhbFtjb2xsZWN0aW9uTmFtZV0pIHRoaXMubG9jYWxbY29sbGVjdGlvbk5hbWVdID0ge307XG4gICAgICAgIGlmICghdGhpcy5sb2NhbFtjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXSkgdGhpcy5sb2NhbFtjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXSA9IHt9O1xuICAgICAgICB0aGlzLmxvY2FsW2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdW2xvY2FsSWRdID0gb2JqO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gU29tZXRoaW5nIGhhcyBnb25lIGJhZGx5IHdyb25nIGhlcmUuIFR3byBvYmplY3RzIHNob3VsZCBuZXZlciBleGlzdCB3aXRoIHRoZSBzYW1lIF9pZFxuICAgICAgICBpZiAodGhpcy5sb2NhbEJ5SWRbbG9jYWxJZF0gIT0gb2JqKSB7XG4gICAgICAgICAgdmFyIG1lc3NhZ2UgPSAnT2JqZWN0IHdpdGggbG9jYWxJZD1cIicgKyBsb2NhbElkLnRvU3RyaW5nKCkgKyAnXCIgaXMgYWxyZWFkeSBpbiB0aGUgY2FjaGUuICcgK1xuICAgICAgICAgICAgJ1RoaXMgaXMgYSBzZXJpb3VzIGVycm9yLiBQbGVhc2UgZmlsZSBhIGJ1ZyByZXBvcnQgaWYgeW91IGFyZSBleHBlcmllbmNpbmcgdGhpcyBvdXQgaW4gdGhlIHdpbGQnO1xuICAgICAgICAgIGxvZyhtZXNzYWdlKTtcbiAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihtZXNzYWdlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB2YXIgaWRGaWVsZCA9IG9iai5pZEZpZWxkO1xuICAgIHZhciByZW1vdGVJZCA9IG9ialtpZEZpZWxkXTtcbiAgICBpZiAocmVtb3RlSWQpIHtcbiAgICAgIHRoaXMucmVtb3RlSW5zZXJ0KG9iaiwgcmVtb3RlSWQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2coJ05vIHJlbW90ZSBpZCAoXCInICsgaWRGaWVsZCArICdcIikgc28gd29udCBiZSBwbGFjaW5nIGluIHRoZSByZW1vdGUgY2FjaGUnLCBvYmopO1xuICAgIH1cbiAgfSxcbiAgLyoqXG4gICAqIFJldHVybnMgdHJ1ZSBpZiBvYmplY3QgaXMgaW4gdGhlIGNhY2hlXG4gICAqIEBwYXJhbSAge01vZGVsSW5zdGFuY2V9IG9ialxuICAgKiBAcmV0dXJuIHtib29sZWFufVxuICAgKi9cbiAgY29udGFpbnM6IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBxID0ge1xuICAgICAgbG9jYWxJZDogb2JqLmxvY2FsSWRcbiAgICB9O1xuICAgIHZhciBtb2RlbCA9IG9iai5tb2RlbDtcbiAgICBpZiAobW9kZWwuaWQpIHtcbiAgICAgIGlmIChvYmpbbW9kZWwuaWRdKSB7XG4gICAgICAgIHEubW9kZWwgPSBtb2RlbDtcbiAgICAgICAgcVttb2RlbC5pZF0gPSBvYmpbbW9kZWwuaWRdO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gISF0aGlzLmdldChxKTtcbiAgfSxcblxuICAvKipcbiAgICogUmVtb3ZlcyB0aGUgb2JqZWN0IGZyb20gdGhlIGNhY2hlIChpZiBpdCdzIGFjdHVhbGx5IGluIHRoZSBjYWNoZSkgb3RoZXJ3aXNlcyB0aHJvd3MgYW4gZXJyb3IuXG4gICAqIEBwYXJhbSAge01vZGVsSW5zdGFuY2V9IG9ialxuICAgKiBAdGhyb3dzIHtJbnRlcm5hbFNpZXN0YUVycm9yfSBJZiBvYmplY3QgYWxyZWFkeSBpbiB0aGUgY2FjaGUuXG4gICAqL1xuICByZW1vdmU6IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmICh0aGlzLmNvbnRhaW5zKG9iaikpIHtcbiAgICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IG9iai5tb2RlbC5jb2xsZWN0aW9uTmFtZTtcbiAgICAgIHZhciBtb2RlbE5hbWUgPSBvYmoubW9kZWwubmFtZTtcbiAgICAgIHZhciBsb2NhbElkID0gb2JqLmxvY2FsSWQ7XG4gICAgICBpZiAoIW1vZGVsTmFtZSkgdGhyb3cgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gbWFwcGluZyBuYW1lJyk7XG4gICAgICBpZiAoIWNvbGxlY3Rpb25OYW1lKSB0aHJvdyBJbnRlcm5hbFNpZXN0YUVycm9yKCdObyBjb2xsZWN0aW9uIG5hbWUnKTtcbiAgICAgIGlmICghbG9jYWxJZCkgdGhyb3cgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gbG9jYWxJZCcpO1xuICAgICAgZGVsZXRlIHRoaXMubG9jYWxbY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV1bbG9jYWxJZF07XG4gICAgICBkZWxldGUgdGhpcy5sb2NhbEJ5SWRbbG9jYWxJZF07XG4gICAgICBpZiAob2JqLm1vZGVsLmlkKSB7XG4gICAgICAgIHZhciByZW1vdGVJZCA9IG9ialtvYmoubW9kZWwuaWRdO1xuICAgICAgICBpZiAocmVtb3RlSWQpIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5yZW1vdGVbY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV1bcmVtb3RlSWRdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIGNvdW50OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5sb2NhbEJ5SWQpLmxlbmd0aDtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDYWNoZTtcblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL2NhY2hlLmpzXG4gKiogbW9kdWxlIGlkID0gMjZcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsIlxuLyoqXG4gKiBUaGlzIGlzIHRoZSB3ZWIgYnJvd3NlciBpbXBsZW1lbnRhdGlvbiBvZiBgZGVidWcoKWAuXG4gKlxuICogRXhwb3NlIGBkZWJ1ZygpYCBhcyB0aGUgbW9kdWxlLlxuICovXG5cbmV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vZGVidWcnKTtcbmV4cG9ydHMubG9nID0gbG9nO1xuZXhwb3J0cy5mb3JtYXRBcmdzID0gZm9ybWF0QXJncztcbmV4cG9ydHMuc2F2ZSA9IHNhdmU7XG5leHBvcnRzLmxvYWQgPSBsb2FkO1xuZXhwb3J0cy51c2VDb2xvcnMgPSB1c2VDb2xvcnM7XG5cbi8qKlxuICogVXNlIGNocm9tZS5zdG9yYWdlLmxvY2FsIGlmIHdlIGFyZSBpbiBhbiBhcHBcbiAqL1xuXG52YXIgc3RvcmFnZTtcblxuaWYgKHR5cGVvZiBjaHJvbWUgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBjaHJvbWUuc3RvcmFnZSAhPT0gJ3VuZGVmaW5lZCcpXG4gIHN0b3JhZ2UgPSBjaHJvbWUuc3RvcmFnZS5sb2NhbDtcbmVsc2VcbiAgc3RvcmFnZSA9IHdpbmRvdy5sb2NhbFN0b3JhZ2U7XG5cbi8qKlxuICogQ29sb3JzLlxuICovXG5cbmV4cG9ydHMuY29sb3JzID0gW1xuICAnbGlnaHRzZWFncmVlbicsXG4gICdmb3Jlc3RncmVlbicsXG4gICdnb2xkZW5yb2QnLFxuICAnZG9kZ2VyYmx1ZScsXG4gICdkYXJrb3JjaGlkJyxcbiAgJ2NyaW1zb24nXG5dO1xuXG4vKipcbiAqIEN1cnJlbnRseSBvbmx5IFdlYktpdC1iYXNlZCBXZWIgSW5zcGVjdG9ycywgRmlyZWZveCA+PSB2MzEsXG4gKiBhbmQgdGhlIEZpcmVidWcgZXh0ZW5zaW9uIChhbnkgRmlyZWZveCB2ZXJzaW9uKSBhcmUga25vd25cbiAqIHRvIHN1cHBvcnQgXCIlY1wiIENTUyBjdXN0b21pemF0aW9ucy5cbiAqXG4gKiBUT0RPOiBhZGQgYSBgbG9jYWxTdG9yYWdlYCB2YXJpYWJsZSB0byBleHBsaWNpdGx5IGVuYWJsZS9kaXNhYmxlIGNvbG9yc1xuICovXG5cbmZ1bmN0aW9uIHVzZUNvbG9ycygpIHtcbiAgLy8gaXMgd2Via2l0PyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8xNjQ1OTYwNi8zNzY3NzNcbiAgcmV0dXJuICgnV2Via2l0QXBwZWFyYW5jZScgaW4gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlKSB8fFxuICAgIC8vIGlzIGZpcmVidWc/IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzM5ODEyMC8zNzY3NzNcbiAgICAod2luZG93LmNvbnNvbGUgJiYgKGNvbnNvbGUuZmlyZWJ1ZyB8fCAoY29uc29sZS5leGNlcHRpb24gJiYgY29uc29sZS50YWJsZSkpKSB8fFxuICAgIC8vIGlzIGZpcmVmb3ggPj0gdjMxP1xuICAgIC8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvVG9vbHMvV2ViX0NvbnNvbGUjU3R5bGluZ19tZXNzYWdlc1xuICAgIChuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkubWF0Y2goL2ZpcmVmb3hcXC8oXFxkKykvKSAmJiBwYXJzZUludChSZWdFeHAuJDEsIDEwKSA+PSAzMSk7XG59XG5cbi8qKlxuICogTWFwICVqIHRvIGBKU09OLnN0cmluZ2lmeSgpYCwgc2luY2Ugbm8gV2ViIEluc3BlY3RvcnMgZG8gdGhhdCBieSBkZWZhdWx0LlxuICovXG5cbmV4cG9ydHMuZm9ybWF0dGVycy5qID0gZnVuY3Rpb24odikge1xuICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodik7XG59O1xuXG5cbi8qKlxuICogQ29sb3JpemUgbG9nIGFyZ3VtZW50cyBpZiBlbmFibGVkLlxuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZm9ybWF0QXJncygpIHtcbiAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7XG4gIHZhciB1c2VDb2xvcnMgPSB0aGlzLnVzZUNvbG9ycztcblxuICBhcmdzWzBdID0gKHVzZUNvbG9ycyA/ICclYycgOiAnJylcbiAgICArIHRoaXMubmFtZXNwYWNlXG4gICAgKyAodXNlQ29sb3JzID8gJyAlYycgOiAnICcpXG4gICAgKyBhcmdzWzBdXG4gICAgKyAodXNlQ29sb3JzID8gJyVjICcgOiAnICcpXG4gICAgKyAnKycgKyBleHBvcnRzLmh1bWFuaXplKHRoaXMuZGlmZik7XG5cbiAgaWYgKCF1c2VDb2xvcnMpIHJldHVybiBhcmdzO1xuXG4gIHZhciBjID0gJ2NvbG9yOiAnICsgdGhpcy5jb2xvcjtcbiAgYXJncyA9IFthcmdzWzBdLCBjLCAnY29sb3I6IGluaGVyaXQnXS5jb25jYXQoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJncywgMSkpO1xuXG4gIC8vIHRoZSBmaW5hbCBcIiVjXCIgaXMgc29tZXdoYXQgdHJpY2t5LCBiZWNhdXNlIHRoZXJlIGNvdWxkIGJlIG90aGVyXG4gIC8vIGFyZ3VtZW50cyBwYXNzZWQgZWl0aGVyIGJlZm9yZSBvciBhZnRlciB0aGUgJWMsIHNvIHdlIG5lZWQgdG9cbiAgLy8gZmlndXJlIG91dCB0aGUgY29ycmVjdCBpbmRleCB0byBpbnNlcnQgdGhlIENTUyBpbnRvXG4gIHZhciBpbmRleCA9IDA7XG4gIHZhciBsYXN0QyA9IDA7XG4gIGFyZ3NbMF0ucmVwbGFjZSgvJVthLXolXS9nLCBmdW5jdGlvbihtYXRjaCkge1xuICAgIGlmICgnJSUnID09PSBtYXRjaCkgcmV0dXJuO1xuICAgIGluZGV4Kys7XG4gICAgaWYgKCclYycgPT09IG1hdGNoKSB7XG4gICAgICAvLyB3ZSBvbmx5IGFyZSBpbnRlcmVzdGVkIGluIHRoZSAqbGFzdCogJWNcbiAgICAgIC8vICh0aGUgdXNlciBtYXkgaGF2ZSBwcm92aWRlZCB0aGVpciBvd24pXG4gICAgICBsYXN0QyA9IGluZGV4O1xuICAgIH1cbiAgfSk7XG5cbiAgYXJncy5zcGxpY2UobGFzdEMsIDAsIGMpO1xuICByZXR1cm4gYXJncztcbn1cblxuLyoqXG4gKiBJbnZva2VzIGBjb25zb2xlLmxvZygpYCB3aGVuIGF2YWlsYWJsZS5cbiAqIE5vLW9wIHdoZW4gYGNvbnNvbGUubG9nYCBpcyBub3QgYSBcImZ1bmN0aW9uXCIuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBsb2coKSB7XG4gIC8vIHRoaXMgaGFja2VyeSBpcyByZXF1aXJlZCBmb3IgSUU4LzksIHdoZXJlXG4gIC8vIHRoZSBgY29uc29sZS5sb2dgIGZ1bmN0aW9uIGRvZXNuJ3QgaGF2ZSAnYXBwbHknXG4gIHJldHVybiAnb2JqZWN0JyA9PT0gdHlwZW9mIGNvbnNvbGVcbiAgICAmJiBjb25zb2xlLmxvZ1xuICAgICYmIEZ1bmN0aW9uLnByb3RvdHlwZS5hcHBseS5jYWxsKGNvbnNvbGUubG9nLCBjb25zb2xlLCBhcmd1bWVudHMpO1xufVxuXG4vKipcbiAqIFNhdmUgYG5hbWVzcGFjZXNgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2VzXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBzYXZlKG5hbWVzcGFjZXMpIHtcbiAgdHJ5IHtcbiAgICBpZiAobnVsbCA9PSBuYW1lc3BhY2VzKSB7XG4gICAgICBzdG9yYWdlLnJlbW92ZUl0ZW0oJ2RlYnVnJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0b3JhZ2UuZGVidWcgPSBuYW1lc3BhY2VzO1xuICAgIH1cbiAgfSBjYXRjaChlKSB7fVxufVxuXG4vKipcbiAqIExvYWQgYG5hbWVzcGFjZXNgLlxuICpcbiAqIEByZXR1cm4ge1N0cmluZ30gcmV0dXJucyB0aGUgcHJldmlvdXNseSBwZXJzaXN0ZWQgZGVidWcgbW9kZXNcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGxvYWQoKSB7XG4gIHZhciByO1xuICB0cnkge1xuICAgIHIgPSBzdG9yYWdlLmRlYnVnO1xuICB9IGNhdGNoKGUpIHt9XG4gIHJldHVybiByO1xufVxuXG4vKipcbiAqIEVuYWJsZSBuYW1lc3BhY2VzIGxpc3RlZCBpbiBgbG9jYWxTdG9yYWdlLmRlYnVnYCBpbml0aWFsbHkuXG4gKi9cblxuZXhwb3J0cy5lbmFibGUobG9hZCgpKTtcblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9+L2RlYnVnL2Jyb3dzZXIuanNcbiAqKiBtb2R1bGUgaWQgPSAyN1xuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcblxuLyoqXG4gKiBBY3RzIGFzIGEgcGxhY2Vob2xkZXIgZm9yIHZhcmlvdXMgb2JqZWN0cyBlLmcuIGxhenkgcmVnaXN0cmF0aW9uIG9mIG1vZGVscy5cbiAqIEBwYXJhbSBbb3B0c11cbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBQbGFjZWhvbGRlcihvcHRzKSB7XG4gIHV0aWwuZXh0ZW5kKHRoaXMsIG9wdHMgfHwge30pO1xuICB0aGlzLmlzUGxhY2Vob2xkZXIgPSB0cnVlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFBsYWNlaG9sZGVyO1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL1BsYWNlaG9sZGVyLmpzXG4gKiogbW9kdWxlIGlkID0gMjhcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsInZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpKCdtb2RlbCcpLFxuICBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gIFJlbGF0aW9uc2hpcFR5cGUgPSByZXF1aXJlKCcuL1JlbGF0aW9uc2hpcFR5cGUnKSxcbiAgUXVlcnkgPSByZXF1aXJlKCcuL0ZpbHRlcicpLFxuICBNb2RlbEluc3RhbmNlID0gcmVxdWlyZSgnLi9Nb2RlbEluc3RhbmNlJyksXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgZ3VpZCA9IHV0aWwuZ3VpZCxcbiAgZXh0ZW5kID0gcmVxdWlyZSgnZXh0ZW5kJyksXG4gIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICB3cmFwQXJyYXkgPSBtb2RlbEV2ZW50cy53cmFwQXJyYXksXG4gIE9uZVRvTWFueVByb3h5ID0gcmVxdWlyZSgnLi9PbmVUb01hbnlQcm94eScpLFxuICBPbmVUb09uZVByb3h5ID0gcmVxdWlyZSgnLi9PbmVUb09uZVByb3h5JyksXG4gIE1hbnlUb01hbnlQcm94eSA9IHJlcXVpcmUoJy4vTWFueVRvTWFueVByb3h5JyksXG4gIFJlYWN0aXZlUXVlcnkgPSByZXF1aXJlKCcuL1JlYWN0aXZlRmlsdGVyJyksXG4gIE1vZGVsRXZlbnRUeXBlID0gbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGU7XG5cbmZ1bmN0aW9uIE1vZGVsSW5zdGFuY2VGYWN0b3J5KG1vZGVsKSB7XG4gIHRoaXMubW9kZWwgPSBtb2RlbDtcbn1cblxuTW9kZWxJbnN0YW5jZUZhY3RvcnkucHJvdG90eXBlID0ge1xuICBfZ2V0TG9jYWxJZDogZnVuY3Rpb24oZGF0YSkge1xuICAgIHZhciBsb2NhbElkO1xuICAgIGlmIChkYXRhKSB7XG4gICAgICBsb2NhbElkID0gZGF0YS5sb2NhbElkID8gZGF0YS5sb2NhbElkIDogZ3VpZCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2NhbElkID0gZ3VpZCgpO1xuICAgIH1cbiAgICByZXR1cm4gbG9jYWxJZDtcbiAgfSxcbiAgLyoqXG4gICAqIENvbmZpZ3VyZSBhdHRyaWJ1dGVzXG4gICAqIEBwYXJhbSBtb2RlbEluc3RhbmNlXG4gICAqIEBwYXJhbSBkYXRhXG4gICAqIEBwcml2YXRlXG4gICAqL1xuXG4gIF9pbnN0YWxsQXR0cmlidXRlczogZnVuY3Rpb24obW9kZWxJbnN0YW5jZSwgZGF0YSkge1xuICAgIHZhciBNb2RlbCA9IHRoaXMubW9kZWwsXG4gICAgICBhdHRyaWJ1dGVOYW1lcyA9IE1vZGVsLl9hdHRyaWJ1dGVOYW1lcyxcbiAgICAgIGlkeCA9IGF0dHJpYnV0ZU5hbWVzLmluZGV4T2YoTW9kZWwuaWQpO1xuICAgIHV0aWwuZXh0ZW5kKG1vZGVsSW5zdGFuY2UsIHtcbiAgICAgIF9fdmFsdWVzOiB1dGlsLmV4dGVuZChNb2RlbC5hdHRyaWJ1dGVzLnJlZHVjZShmdW5jdGlvbihtLCBhKSB7XG4gICAgICAgIGlmIChhLmRlZmF1bHQgIT09IHVuZGVmaW5lZCkgbVthLm5hbWVdID0gYS5kZWZhdWx0O1xuICAgICAgICByZXR1cm4gbTtcbiAgICAgIH0sIHt9KSwgZGF0YSB8fCB7fSlcbiAgICB9KTtcbiAgICBpZiAoaWR4ID4gLTEpIGF0dHJpYnV0ZU5hbWVzLnNwbGljZShpZHgsIDEpO1xuXG4gICAgYXR0cmlidXRlTmFtZXMuZm9yRWFjaChmdW5jdGlvbihhdHRyaWJ1dGVOYW1lKSB7XG4gICAgICB2YXIgYXR0cmlidXRlRGVmaW5pdGlvbiA9IE1vZGVsLl9hdHRyaWJ1dGVEZWZpbml0aW9uV2l0aE5hbWUoYXR0cmlidXRlTmFtZSk7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobW9kZWxJbnN0YW5jZSwgYXR0cmlidXRlTmFtZSwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciB2YWx1ZSA9IG1vZGVsSW5zdGFuY2UuX192YWx1ZXNbYXR0cmlidXRlTmFtZV07XG4gICAgICAgICAgcmV0dXJuIHZhbHVlID09PSB1bmRlZmluZWQgPyBudWxsIDogdmFsdWU7XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24odikge1xuICAgICAgICAgIGlmIChhdHRyaWJ1dGVEZWZpbml0aW9uLnBhcnNlKSB7XG4gICAgICAgICAgICB2ID0gYXR0cmlidXRlRGVmaW5pdGlvbi5wYXJzZS5jYWxsKG1vZGVsSW5zdGFuY2UsIHYpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoTW9kZWwucGFyc2VBdHRyaWJ1dGUpIHtcbiAgICAgICAgICAgIHYgPSBNb2RlbC5wYXJzZUF0dHJpYnV0ZS5jYWxsKG1vZGVsSW5zdGFuY2UsIGF0dHJpYnV0ZU5hbWUsIHYpO1xuICAgICAgICAgIH1cbiAgICAgICAgICB2YXIgb2xkID0gbW9kZWxJbnN0YW5jZS5fX3ZhbHVlc1thdHRyaWJ1dGVOYW1lXTtcbiAgICAgICAgICB2YXIgcHJvcGVydHlEZXBlbmRlbmNpZXMgPSB0aGlzLl9wcm9wZXJ0eURlcGVuZGVuY2llc1thdHRyaWJ1dGVOYW1lXSB8fCBbXTtcbiAgICAgICAgICBwcm9wZXJ0eURlcGVuZGVuY2llcyA9IHByb3BlcnR5RGVwZW5kZW5jaWVzLm1hcChmdW5jdGlvbihkZXBlbmRhbnQpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIHZhciBvbGRQcm9wZXJ0eVZhbHVlID0gdGhpc1tkZXBlbmRhbnRdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignVW5jYXVnaHQgZXJyb3IgZHVyaW5nIHByb3BlcnR5IGFjY2VzcyBmb3IgbW9kZWwgXCInICsgbW9kZWxJbnN0YW5jZS5tb2RlbC5uYW1lICsgJ1wiJywgZSk7XG4gICAgICAgICAgICAgIHRocm93IGU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBwcm9wOiBkZXBlbmRhbnQsXG4gICAgICAgICAgICAgIG9sZDogb2xkUHJvcGVydHlWYWx1ZVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICAgICAgICBtb2RlbEluc3RhbmNlLl9fdmFsdWVzW2F0dHJpYnV0ZU5hbWVdID0gdjtcbiAgICAgICAgICBwcm9wZXJ0eURlcGVuZGVuY2llcy5mb3JFYWNoKGZ1bmN0aW9uKGRlcCkge1xuICAgICAgICAgICAgdmFyIHByb3BlcnR5TmFtZSA9IGRlcC5wcm9wO1xuICAgICAgICAgICAgdmFyIG5ld18gPSB0aGlzW3Byb3BlcnR5TmFtZV07XG4gICAgICAgICAgICBNb2RlbC5jb250ZXh0LmJyb2FkY2FzdCh7XG4gICAgICAgICAgICAgIGNvbGxlY3Rpb246IE1vZGVsLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgICBtb2RlbDogTW9kZWwubmFtZSxcbiAgICAgICAgICAgICAgbG9jYWxJZDogbW9kZWxJbnN0YW5jZS5sb2NhbElkLFxuICAgICAgICAgICAgICBuZXc6IG5ld18sXG4gICAgICAgICAgICAgIG9sZDogZGVwLm9sZCxcbiAgICAgICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU2V0LFxuICAgICAgICAgICAgICBmaWVsZDogcHJvcGVydHlOYW1lLFxuICAgICAgICAgICAgICBvYmo6IG1vZGVsSW5zdGFuY2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgICAgdmFyIGUgPSB7XG4gICAgICAgICAgICBjb2xsZWN0aW9uOiBNb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgIG1vZGVsOiBNb2RlbC5uYW1lLFxuICAgICAgICAgICAgbG9jYWxJZDogbW9kZWxJbnN0YW5jZS5sb2NhbElkLFxuICAgICAgICAgICAgbmV3OiB2LFxuICAgICAgICAgICAgb2xkOiBvbGQsXG4gICAgICAgICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5TZXQsXG4gICAgICAgICAgICBmaWVsZDogYXR0cmlidXRlTmFtZSxcbiAgICAgICAgICAgIG9iajogbW9kZWxJbnN0YW5jZVxuICAgICAgICAgIH07XG4gICAgICAgICAgd2luZG93Lmxhc3RFbWlzc2lvbiA9IGU7XG4gICAgICAgICAgTW9kZWwuY29udGV4dC5icm9hZGNhc3QoZSk7XG4gICAgICAgICAgaWYgKHV0aWwuaXNBcnJheSh2KSkge1xuICAgICAgICAgICAgd3JhcEFycmF5KHYsIGF0dHJpYnV0ZU5hbWUsIG1vZGVsSW5zdGFuY2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSxcbiAgX2luc3RhbGxNZXRob2RzOiBmdW5jdGlvbihtb2RlbEluc3RhbmNlKSB7XG4gICAgdmFyIE1vZGVsID0gdGhpcy5tb2RlbDtcbiAgICBPYmplY3Qua2V5cyhNb2RlbC5tZXRob2RzKS5mb3JFYWNoKGZ1bmN0aW9uKG1ldGhvZE5hbWUpIHtcbiAgICAgIGlmIChtb2RlbEluc3RhbmNlW21ldGhvZE5hbWVdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgbW9kZWxJbnN0YW5jZVttZXRob2ROYW1lXSA9IE1vZGVsLm1ldGhvZHNbbWV0aG9kTmFtZV0uYmluZChtb2RlbEluc3RhbmNlKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBsb2coJ0EgbWV0aG9kIHdpdGggbmFtZSBcIicgKyBtZXRob2ROYW1lICsgJ1wiIGFscmVhZHkgZXhpc3RzLiBJZ25vcmluZyBpdC4nKTtcbiAgICAgIH1cbiAgICB9LmJpbmQodGhpcykpO1xuICB9LFxuICBfaW5zdGFsbFByb3BlcnRpZXM6IGZ1bmN0aW9uKG1vZGVsSW5zdGFuY2UpIHtcbiAgICB2YXIgX3Byb3BlcnR5TmFtZXMgPSBPYmplY3Qua2V5cyh0aGlzLm1vZGVsLnByb3BlcnRpZXMpLFxuICAgICAgX3Byb3BlcnR5RGVwZW5kZW5jaWVzID0ge307XG4gICAgX3Byb3BlcnR5TmFtZXMuZm9yRWFjaChmdW5jdGlvbihwcm9wTmFtZSkge1xuICAgICAgdmFyIHByb3BEZWYgPSB0aGlzLm1vZGVsLnByb3BlcnRpZXNbcHJvcE5hbWVdO1xuICAgICAgdmFyIGRlcGVuZGVuY2llcyA9IHByb3BEZWYuZGVwZW5kZW5jaWVzIHx8IFtdO1xuICAgICAgZGVwZW5kZW5jaWVzLmZvckVhY2goZnVuY3Rpb24oYXR0cikge1xuICAgICAgICBpZiAoIV9wcm9wZXJ0eURlcGVuZGVuY2llc1thdHRyXSkgX3Byb3BlcnR5RGVwZW5kZW5jaWVzW2F0dHJdID0gW107XG4gICAgICAgIF9wcm9wZXJ0eURlcGVuZGVuY2llc1thdHRyXS5wdXNoKHByb3BOYW1lKTtcbiAgICAgIH0pO1xuICAgICAgZGVsZXRlIHByb3BEZWYuZGVwZW5kZW5jaWVzO1xuICAgICAgaWYgKG1vZGVsSW5zdGFuY2VbcHJvcE5hbWVdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG1vZGVsSW5zdGFuY2UsIHByb3BOYW1lLCBwcm9wRGVmKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBsb2coJ0EgcHJvcGVydHkvbWV0aG9kIHdpdGggbmFtZSBcIicgKyBwcm9wTmFtZSArICdcIiBhbHJlYWR5IGV4aXN0cy4gSWdub3JpbmcgaXQuJyk7XG4gICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcblxuICAgIG1vZGVsSW5zdGFuY2UuX3Byb3BlcnR5RGVwZW5kZW5jaWVzID0gX3Byb3BlcnR5RGVwZW5kZW5jaWVzO1xuICB9LFxuICBfaW5zdGFsbFJlbW90ZUlkOiBmdW5jdGlvbihtb2RlbEluc3RhbmNlKSB7XG4gICAgdmFyIE1vZGVsID0gdGhpcy5tb2RlbDtcbiAgICB2YXIgY2FjaGUgPSBNb2RlbC5jb250ZXh0LmNhY2hlO1xuICAgIHZhciBpZEZpZWxkID0gTW9kZWwuaWQ7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG1vZGVsSW5zdGFuY2UsIGlkRmllbGQsIHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBtb2RlbEluc3RhbmNlLl9fdmFsdWVzW01vZGVsLmlkXSB8fCBudWxsO1xuICAgICAgfSxcbiAgICAgIHNldDogZnVuY3Rpb24odikge1xuICAgICAgICB2YXIgb2xkID0gbW9kZWxJbnN0YW5jZVtNb2RlbC5pZF07XG4gICAgICAgIG1vZGVsSW5zdGFuY2UuX192YWx1ZXNbTW9kZWwuaWRdID0gdjtcbiAgICAgICAgTW9kZWwuY29udGV4dC5icm9hZGNhc3Qoe1xuICAgICAgICAgIGNvbGxlY3Rpb246IE1vZGVsLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgIG1vZGVsOiBNb2RlbC5uYW1lLFxuICAgICAgICAgIGxvY2FsSWQ6IG1vZGVsSW5zdGFuY2UubG9jYWxJZCxcbiAgICAgICAgICBuZXc6IHYsXG4gICAgICAgICAgb2xkOiBvbGQsXG4gICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU2V0LFxuICAgICAgICAgIGZpZWxkOiBNb2RlbC5pZCxcbiAgICAgICAgICBvYmo6IG1vZGVsSW5zdGFuY2VcbiAgICAgICAgfSk7XG4gICAgICAgIGNhY2hlLnJlbW90ZUluc2VydChtb2RlbEluc3RhbmNlLCB2LCBvbGQpO1xuICAgICAgfSxcbiAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcbiAgfSxcbiAgLyoqXG4gICAqIEBwYXJhbSBkZWZpbml0aW9uIC0gRGVmaW5pdGlvbiBvZiBhIHJlbGF0aW9uc2hpcFxuICAgKiBAcGFyYW0gbW9kZWxJbnN0YW5jZSAtIEluc3RhbmNlIG9mIHdoaWNoIHRvIGluc3RhbGwgdGhlIHJlbGF0aW9uc2hpcC5cbiAgICovXG4gIF9pbnN0YWxsUmVsYXRpb25zaGlwOiBmdW5jdGlvbihkZWZpbml0aW9uLCBtb2RlbEluc3RhbmNlKSB7XG4gICAgdmFyIHByb3h5O1xuICAgIHZhciB0eXBlID0gZGVmaW5pdGlvbi50eXBlO1xuICAgIGlmICh0eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuT25lVG9NYW55KSB7XG4gICAgICBwcm94eSA9IG5ldyBPbmVUb01hbnlQcm94eShkZWZpbml0aW9uKTtcbiAgICB9XG4gICAgZWxzZSBpZiAodHlwZSA9PSBSZWxhdGlvbnNoaXBUeXBlLk9uZVRvT25lKSB7XG4gICAgICBwcm94eSA9IG5ldyBPbmVUb09uZVByb3h5KGRlZmluaXRpb24pO1xuICAgIH1cbiAgICBlbHNlIGlmICh0eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuTWFueVRvTWFueSkge1xuICAgICAgcHJveHkgPSBuZXcgTWFueVRvTWFueVByb3h5KGRlZmluaXRpb24pO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdObyBzdWNoIHJlbGF0aW9uc2hpcCB0eXBlOiAnICsgdHlwZSk7XG4gICAgfVxuICAgIHByb3h5Lmluc3RhbGwobW9kZWxJbnN0YW5jZSk7XG4gIH0sXG4gIF9pbnN0YWxsUmVsYXRpb25zaGlwUHJveGllczogZnVuY3Rpb24obW9kZWxJbnN0YW5jZSkge1xuICAgIHZhciBtb2RlbCA9IHRoaXMubW9kZWw7XG4gICAgZm9yICh2YXIgbmFtZSBpbiBtb2RlbC5yZWxhdGlvbnNoaXBzKSB7XG4gICAgICBpZiAobW9kZWwucmVsYXRpb25zaGlwcy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICB2YXIgZGVmaW5pdGlvbiA9IHV0aWwuZXh0ZW5kKHt9LCBtb2RlbC5yZWxhdGlvbnNoaXBzW25hbWVdKTtcbiAgICAgICAgdGhpcy5faW5zdGFsbFJlbGF0aW9uc2hpcChkZWZpbml0aW9uLCBtb2RlbEluc3RhbmNlKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gIF9yZWdpc3Rlckluc3RhbmNlOiBmdW5jdGlvbihtb2RlbEluc3RhbmNlLCBzaG91bGRSZWdpc3RlckNoYW5nZSkge1xuICAgIHZhciBjYWNoZSA9IHRoaXMubW9kZWwuY29udGV4dC5jYWNoZTtcbiAgICBjYWNoZS5pbnNlcnQobW9kZWxJbnN0YW5jZSk7XG4gICAgc2hvdWxkUmVnaXN0ZXJDaGFuZ2UgPSBzaG91bGRSZWdpc3RlckNoYW5nZSA9PT0gdW5kZWZpbmVkID8gdHJ1ZSA6IHNob3VsZFJlZ2lzdGVyQ2hhbmdlO1xuICAgIGlmIChzaG91bGRSZWdpc3RlckNoYW5nZSkgbW9kZWxJbnN0YW5jZS5fZW1pdE5ldygpO1xuICB9LFxuICBfaW5zdGFsbExvY2FsSWQ6IGZ1bmN0aW9uKG1vZGVsSW5zdGFuY2UsIGRhdGEpIHtcbiAgICBtb2RlbEluc3RhbmNlLmxvY2FsSWQgPSB0aGlzLl9nZXRMb2NhbElkKGRhdGEpO1xuICB9LFxuICAvKipcbiAgICogQ29udmVydCByYXcgZGF0YSBpbnRvIGEgTW9kZWxJbnN0YW5jZVxuICAgKiBAcmV0dXJucyB7TW9kZWxJbnN0YW5jZX1cbiAgICovXG4gIF9pbnN0YW5jZTogZnVuY3Rpb24oZGF0YSwgc2hvdWxkUmVnaXN0ZXJDaGFuZ2UpIHtcbiAgICB2YXIgbW9kZWxJbnN0YW5jZSA9IG5ldyBNb2RlbEluc3RhbmNlKHRoaXMubW9kZWwpO1xuICAgIHRoaXMuX2luc3RhbGxMb2NhbElkKG1vZGVsSW5zdGFuY2UsIGRhdGEpO1xuICAgIHRoaXMuX2luc3RhbGxBdHRyaWJ1dGVzKG1vZGVsSW5zdGFuY2UsIGRhdGEpO1xuICAgIHRoaXMuX2luc3RhbGxNZXRob2RzKG1vZGVsSW5zdGFuY2UpO1xuICAgIHRoaXMuX2luc3RhbGxQcm9wZXJ0aWVzKG1vZGVsSW5zdGFuY2UpO1xuICAgIHRoaXMuX2luc3RhbGxSZW1vdGVJZChtb2RlbEluc3RhbmNlKTtcbiAgICB0aGlzLl9pbnN0YWxsUmVsYXRpb25zaGlwUHJveGllcyhtb2RlbEluc3RhbmNlKTtcbiAgICB0aGlzLl9yZWdpc3Rlckluc3RhbmNlKG1vZGVsSW5zdGFuY2UsIHNob3VsZFJlZ2lzdGVyQ2hhbmdlKTtcbiAgICByZXR1cm4gbW9kZWxJbnN0YW5jZTtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBNb2RlbEluc3RhbmNlRmFjdG9yeTtcblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL2luc3RhbmNlRmFjdG9yeS5qc1xuICoqIG1vZHVsZSBpZCA9IDI5XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICBQcm9taXNlID0gcmVxdWlyZSgnLi9Qcm9taXNlJyksXG4gIGFyZ3NhcnJheSA9IHJlcXVpcmUoJ2FyZ3NhcnJheScpO1xuXG5mdW5jdGlvbiBDb25kaXRpb24oZm4sIGxhenkpIHtcbiAgaWYgKGxhenkgPT09IHVuZGVmaW5lZCB8fCBsYXp5ID09PSBudWxsKSB7XG4gICAgdGhpcy5sYXp5ID0gdHJ1ZTtcbiAgfVxuICB0aGlzLl9mbiA9IGZuIHx8IGZ1bmN0aW9uKGRvbmUpIHtcbiAgICBkb25lKCk7XG4gIH07XG4gIHRoaXMucmVzZXQoKTtcbn1cblxuQ29uZGl0aW9uLmFsbCA9IGFyZ3NhcnJheShmdW5jdGlvbihhcmdzKSB7XG4gIHJldHVybiBuZXcgQ29uZGl0aW9uKGFyZ3MpO1xufSk7XG5cbkNvbmRpdGlvbi5wcm90b3R5cGUgPSB7XG4gIF9leGVjdXRlOiBmdW5jdGlvbigpIHtcbiAgICBpZiAoIXRoaXMuZXhlY3V0ZWQpIHtcbiAgICAgIHZhciBkZXBlbmRlbnRzID0gdXRpbC5wbHVjayh0aGlzLmRlcGVuZGVudCwgJ19wcm9taXNlJyk7XG4gICAgICBQcm9taXNlXG4gICAgICAgIC5hbGwoZGVwZW5kZW50cylcbiAgICAgICAgLnRoZW4odGhpcy5mbilcbiAgICAgICAgLmNhdGNoKHRoaXMucmVqZWN0LmJpbmQodGhpcykpO1xuICAgICAgdGhpcy5kZXBlbmRlbnQuZm9yRWFjaChmdW5jdGlvbihkKSB7XG4gICAgICAgIGQuX2V4ZWN1dGUoKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfSxcbiAgdGhlbjogZnVuY3Rpb24oc3VjY2VzcywgZmFpbCkge1xuICAgIHRoaXMuX2V4ZWN1dGUoKTtcbiAgICB0aGlzLl9wcm9taXNlLnRoZW4oc3VjY2VzcywgZmFpbCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG4gIGNhdGNoOiBmdW5jdGlvbihmYWlsKSB7XG4gICAgdGhpcy5fZXhlY3V0ZSgpO1xuICAgIHRoaXMuX3Byb21pc2UuY2F0Y2goZmFpbCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG4gIHJlc29sdmU6IGZ1bmN0aW9uKHJlcykge1xuICAgIHRoaXMuZXhlY3V0ZWQgPSB0cnVlO1xuICAgIHRoaXMuX3Byb21pc2UucmVzb2x2ZShyZXMpO1xuICB9LFxuICByZWplY3Q6IGZ1bmN0aW9uKGVycikge1xuICAgIHRoaXMuZXhlY3V0ZWQgPSB0cnVlO1xuICAgIHRoaXMuX3Byb21pc2UucmVqZWN0KGVycik7XG4gIH0sXG4gIGRlcGVuZGVudE9uOiBmdW5jdGlvbihjb25kKSB7XG4gICAgdGhpcy5kZXBlbmRlbnQucHVzaChjb25kKTtcbiAgfSxcbiAgcmVzZXQ6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuX3Byb21pc2UgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgIHRoaXMucmVqZWN0ID0gcmVqZWN0O1xuICAgICAgdGhpcy5yZXNvbHZlID0gcmVzb2x2ZTtcbiAgICAgIHRoaXMuZm4gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5leGVjdXRlZCA9IHRydWU7XG4gICAgICAgIHZhciBudW1Db21wbGV0ZSA9IDA7XG4gICAgICAgIHZhciByZXN1bHRzID0gW107XG4gICAgICAgIHZhciBlcnJvcnMgPSBbXTtcbiAgICAgICAgaWYgKHV0aWwuaXNBcnJheSh0aGlzLl9mbikpIHtcbiAgICAgICAgICB2YXIgY2hlY2tDb21wbGV0ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgaWYgKG51bUNvbXBsZXRlID09IHRoaXMuX2ZuLmxlbmd0aCkge1xuICAgICAgICAgICAgICBpZiAoZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHJlamVjdChlcnJvcnMpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlc29sdmUocmVzdWx0cyk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgICAgICAgdGhpc1xuICAgICAgICAgICAgLl9mblxuICAgICAgICAgICAgLmZvckVhY2goZnVuY3Rpb24oY29uZCwgaWR4KSB7XG4gICAgICAgICAgICAgIGNvbmRcbiAgICAgICAgICAgICAgICAudGhlbihmdW5jdGlvbihyZXMpIHtcbiAgICAgICAgICAgICAgICAgIHJlc3VsdHNbaWR4XSA9IHJlcztcbiAgICAgICAgICAgICAgICAgIG51bUNvbXBsZXRlKys7XG4gICAgICAgICAgICAgICAgICBjaGVja0NvbXBsZXRlKCk7XG4gICAgICAgICAgICAgICAgfS5iaW5kKHRoaXMpKVxuICAgICAgICAgICAgICAgIC5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICAgIGVycm9yc1tpZHhdID0gZXJyO1xuICAgICAgICAgICAgICAgICAgbnVtQ29tcGxldGUrKztcbiAgICAgICAgICAgICAgICAgIGNoZWNrQ29tcGxldGUoKTtcbiAgICAgICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgdGhpcy5fZm4oZnVuY3Rpb24oZXJyLCByZXMpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgZWxzZSByZXNvbHZlKHJlcyk7XG4gICAgICAgICAgfS5iaW5kKHRoaXMpKVxuICAgICAgICB9XG4gICAgICB9LmJpbmQodGhpcylcbiAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgaWYgKCF0aGlzLmxhenkpIHRoaXMuX2V4ZWN1dGUoKTtcbiAgICB0aGlzLmV4ZWN1dGVkID0gZmFsc2U7XG4gICAgdGhpcy5kZXBlbmRlbnQgPSBbXTtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDb25kaXRpb247XG5cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vY29yZS9jb25kaXRpb24uanNcbiAqKiBtb2R1bGUgaWQgPSAzMFxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGFyZ3NBcnJheTtcblxuZnVuY3Rpb24gYXJnc0FycmF5KGZ1bikge1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHZhciBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGlmIChsZW4pIHtcbiAgICAgIHZhciBhcmdzID0gW107XG4gICAgICB2YXIgaSA9IC0xO1xuICAgICAgd2hpbGUgKCsraSA8IGxlbikge1xuICAgICAgICBhcmdzW2ldID0gYXJndW1lbnRzW2ldO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZ1bi5jYWxsKHRoaXMsIGFyZ3MpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gZnVuLmNhbGwodGhpcywgW10pO1xuICAgIH1cbiAgfTtcbn1cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vfi9hcmdzYXJyYXkvaW5kZXguanNcbiAqKiBtb2R1bGUgaWQgPSAzMVxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH1cbiAgICAgIHRocm93IFR5cGVFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4nKTtcbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICAgICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcblxuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIHZhciBtO1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgaWYgKHR5cGVvZiBjb25zb2xlLnRyYWNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgaW4gSUUgMTBcbiAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghZW1pdHRlci5fZXZlbnRzIHx8ICFlbWl0dGVyLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gMDtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbihlbWl0dGVyLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IDE7XG4gIGVsc2VcbiAgICByZXQgPSBlbWl0dGVyLl9ldmVudHNbdHlwZV0ubGVuZ3RoO1xuICByZXR1cm4gcmV0O1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAod2VicGFjaykvfi9ub2RlLWxpYnMtYnJvd3Nlci9+L2V2ZW50cy9ldmVudHMuanNcbiAqKiBtb2R1bGUgaWQgPSAzMlxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwidmFyIG5leHRUaWNrID0gcmVxdWlyZSgncHJvY2Vzcy9icm93c2VyLmpzJykubmV4dFRpY2s7XG52YXIgYXBwbHkgPSBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHk7XG52YXIgc2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2U7XG52YXIgaW1tZWRpYXRlSWRzID0ge307XG52YXIgbmV4dEltbWVkaWF0ZUlkID0gMDtcblxuLy8gRE9NIEFQSXMsIGZvciBjb21wbGV0ZW5lc3NcblxuZXhwb3J0cy5zZXRUaW1lb3V0ID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBuZXcgVGltZW91dChhcHBseS5jYWxsKHNldFRpbWVvdXQsIHdpbmRvdywgYXJndW1lbnRzKSwgY2xlYXJUaW1lb3V0KTtcbn07XG5leHBvcnRzLnNldEludGVydmFsID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBuZXcgVGltZW91dChhcHBseS5jYWxsKHNldEludGVydmFsLCB3aW5kb3csIGFyZ3VtZW50cyksIGNsZWFySW50ZXJ2YWwpO1xufTtcbmV4cG9ydHMuY2xlYXJUaW1lb3V0ID1cbmV4cG9ydHMuY2xlYXJJbnRlcnZhbCA9IGZ1bmN0aW9uKHRpbWVvdXQpIHsgdGltZW91dC5jbG9zZSgpOyB9O1xuXG5mdW5jdGlvbiBUaW1lb3V0KGlkLCBjbGVhckZuKSB7XG4gIHRoaXMuX2lkID0gaWQ7XG4gIHRoaXMuX2NsZWFyRm4gPSBjbGVhckZuO1xufVxuVGltZW91dC5wcm90b3R5cGUudW5yZWYgPSBUaW1lb3V0LnByb3RvdHlwZS5yZWYgPSBmdW5jdGlvbigpIHt9O1xuVGltZW91dC5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5fY2xlYXJGbi5jYWxsKHdpbmRvdywgdGhpcy5faWQpO1xufTtcblxuLy8gRG9lcyBub3Qgc3RhcnQgdGhlIHRpbWUsIGp1c3Qgc2V0cyB1cCB0aGUgbWVtYmVycyBuZWVkZWQuXG5leHBvcnRzLmVucm9sbCA9IGZ1bmN0aW9uKGl0ZW0sIG1zZWNzKSB7XG4gIGNsZWFyVGltZW91dChpdGVtLl9pZGxlVGltZW91dElkKTtcbiAgaXRlbS5faWRsZVRpbWVvdXQgPSBtc2Vjcztcbn07XG5cbmV4cG9ydHMudW5lbnJvbGwgPSBmdW5jdGlvbihpdGVtKSB7XG4gIGNsZWFyVGltZW91dChpdGVtLl9pZGxlVGltZW91dElkKTtcbiAgaXRlbS5faWRsZVRpbWVvdXQgPSAtMTtcbn07XG5cbmV4cG9ydHMuX3VucmVmQWN0aXZlID0gZXhwb3J0cy5hY3RpdmUgPSBmdW5jdGlvbihpdGVtKSB7XG4gIGNsZWFyVGltZW91dChpdGVtLl9pZGxlVGltZW91dElkKTtcblxuICB2YXIgbXNlY3MgPSBpdGVtLl9pZGxlVGltZW91dDtcbiAgaWYgKG1zZWNzID49IDApIHtcbiAgICBpdGVtLl9pZGxlVGltZW91dElkID0gc2V0VGltZW91dChmdW5jdGlvbiBvblRpbWVvdXQoKSB7XG4gICAgICBpZiAoaXRlbS5fb25UaW1lb3V0KVxuICAgICAgICBpdGVtLl9vblRpbWVvdXQoKTtcbiAgICB9LCBtc2Vjcyk7XG4gIH1cbn07XG5cbi8vIFRoYXQncyBub3QgaG93IG5vZGUuanMgaW1wbGVtZW50cyBpdCBidXQgdGhlIGV4cG9zZWQgYXBpIGlzIHRoZSBzYW1lLlxuZXhwb3J0cy5zZXRJbW1lZGlhdGUgPSB0eXBlb2Ygc2V0SW1tZWRpYXRlID09PSBcImZ1bmN0aW9uXCIgPyBzZXRJbW1lZGlhdGUgOiBmdW5jdGlvbihmbikge1xuICB2YXIgaWQgPSBuZXh0SW1tZWRpYXRlSWQrKztcbiAgdmFyIGFyZ3MgPSBhcmd1bWVudHMubGVuZ3RoIDwgMiA/IGZhbHNlIDogc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuXG4gIGltbWVkaWF0ZUlkc1tpZF0gPSB0cnVlO1xuXG4gIG5leHRUaWNrKGZ1bmN0aW9uIG9uTmV4dFRpY2soKSB7XG4gICAgaWYgKGltbWVkaWF0ZUlkc1tpZF0pIHtcbiAgICAgIC8vIGZuLmNhbGwoKSBpcyBmYXN0ZXIgc28gd2Ugb3B0aW1pemUgZm9yIHRoZSBjb21tb24gdXNlLWNhc2VcbiAgICAgIC8vIEBzZWUgaHR0cDovL2pzcGVyZi5jb20vY2FsbC1hcHBseS1zZWd1XG4gICAgICBpZiAoYXJncykge1xuICAgICAgICBmbi5hcHBseShudWxsLCBhcmdzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZuLmNhbGwobnVsbCk7XG4gICAgICB9XG4gICAgICAvLyBQcmV2ZW50IGlkcyBmcm9tIGxlYWtpbmdcbiAgICAgIGV4cG9ydHMuY2xlYXJJbW1lZGlhdGUoaWQpO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGlkO1xufTtcblxuZXhwb3J0cy5jbGVhckltbWVkaWF0ZSA9IHR5cGVvZiBjbGVhckltbWVkaWF0ZSA9PT0gXCJmdW5jdGlvblwiID8gY2xlYXJJbW1lZGlhdGUgOiBmdW5jdGlvbihpZCkge1xuICBkZWxldGUgaW1tZWRpYXRlSWRzW2lkXTtcbn07XG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAod2VicGFjaykvfi9ub2RlLWxpYnMtYnJvd3Nlci9+L3RpbWVycy1icm93c2VyaWZ5L21haW4uanNcbiAqKiBtb2R1bGUgaWQgPSAzM1xuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwiXG4vKipcbiAqIFRoaXMgaXMgdGhlIGNvbW1vbiBsb2dpYyBmb3IgYm90aCB0aGUgTm9kZS5qcyBhbmQgd2ViIGJyb3dzZXJcbiAqIGltcGxlbWVudGF0aW9ucyBvZiBgZGVidWcoKWAuXG4gKlxuICogRXhwb3NlIGBkZWJ1ZygpYCBhcyB0aGUgbW9kdWxlLlxuICovXG5cbmV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IGRlYnVnO1xuZXhwb3J0cy5jb2VyY2UgPSBjb2VyY2U7XG5leHBvcnRzLmRpc2FibGUgPSBkaXNhYmxlO1xuZXhwb3J0cy5lbmFibGUgPSBlbmFibGU7XG5leHBvcnRzLmVuYWJsZWQgPSBlbmFibGVkO1xuZXhwb3J0cy5odW1hbml6ZSA9IHJlcXVpcmUoJ21zJyk7XG5cbi8qKlxuICogVGhlIGN1cnJlbnRseSBhY3RpdmUgZGVidWcgbW9kZSBuYW1lcywgYW5kIG5hbWVzIHRvIHNraXAuXG4gKi9cblxuZXhwb3J0cy5uYW1lcyA9IFtdO1xuZXhwb3J0cy5za2lwcyA9IFtdO1xuXG4vKipcbiAqIE1hcCBvZiBzcGVjaWFsIFwiJW5cIiBoYW5kbGluZyBmdW5jdGlvbnMsIGZvciB0aGUgZGVidWcgXCJmb3JtYXRcIiBhcmd1bWVudC5cbiAqXG4gKiBWYWxpZCBrZXkgbmFtZXMgYXJlIGEgc2luZ2xlLCBsb3dlcmNhc2VkIGxldHRlciwgaS5lLiBcIm5cIi5cbiAqL1xuXG5leHBvcnRzLmZvcm1hdHRlcnMgPSB7fTtcblxuLyoqXG4gKiBQcmV2aW91c2x5IGFzc2lnbmVkIGNvbG9yLlxuICovXG5cbnZhciBwcmV2Q29sb3IgPSAwO1xuXG4vKipcbiAqIFByZXZpb3VzIGxvZyB0aW1lc3RhbXAuXG4gKi9cblxudmFyIHByZXZUaW1lO1xuXG4vKipcbiAqIFNlbGVjdCBhIGNvbG9yLlxuICpcbiAqIEByZXR1cm4ge051bWJlcn1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHNlbGVjdENvbG9yKCkge1xuICByZXR1cm4gZXhwb3J0cy5jb2xvcnNbcHJldkNvbG9yKysgJSBleHBvcnRzLmNvbG9ycy5sZW5ndGhdO1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIGRlYnVnZ2VyIHdpdGggdGhlIGdpdmVuIGBuYW1lc3BhY2VgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2VcbiAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBkZWJ1ZyhuYW1lc3BhY2UpIHtcblxuICAvLyBkZWZpbmUgdGhlIGBkaXNhYmxlZGAgdmVyc2lvblxuICBmdW5jdGlvbiBkaXNhYmxlZCgpIHtcbiAgfVxuICBkaXNhYmxlZC5lbmFibGVkID0gZmFsc2U7XG5cbiAgLy8gZGVmaW5lIHRoZSBgZW5hYmxlZGAgdmVyc2lvblxuICBmdW5jdGlvbiBlbmFibGVkKCkge1xuXG4gICAgdmFyIHNlbGYgPSBlbmFibGVkO1xuXG4gICAgLy8gc2V0IGBkaWZmYCB0aW1lc3RhbXBcbiAgICB2YXIgY3VyciA9ICtuZXcgRGF0ZSgpO1xuICAgIHZhciBtcyA9IGN1cnIgLSAocHJldlRpbWUgfHwgY3Vycik7XG4gICAgc2VsZi5kaWZmID0gbXM7XG4gICAgc2VsZi5wcmV2ID0gcHJldlRpbWU7XG4gICAgc2VsZi5jdXJyID0gY3VycjtcbiAgICBwcmV2VGltZSA9IGN1cnI7XG5cbiAgICAvLyBhZGQgdGhlIGBjb2xvcmAgaWYgbm90IHNldFxuICAgIGlmIChudWxsID09IHNlbGYudXNlQ29sb3JzKSBzZWxmLnVzZUNvbG9ycyA9IGV4cG9ydHMudXNlQ29sb3JzKCk7XG4gICAgaWYgKG51bGwgPT0gc2VsZi5jb2xvciAmJiBzZWxmLnVzZUNvbG9ycykgc2VsZi5jb2xvciA9IHNlbGVjdENvbG9yKCk7XG5cbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG5cbiAgICBhcmdzWzBdID0gZXhwb3J0cy5jb2VyY2UoYXJnc1swXSk7XG5cbiAgICBpZiAoJ3N0cmluZycgIT09IHR5cGVvZiBhcmdzWzBdKSB7XG4gICAgICAvLyBhbnl0aGluZyBlbHNlIGxldCdzIGluc3BlY3Qgd2l0aCAlb1xuICAgICAgYXJncyA9IFsnJW8nXS5jb25jYXQoYXJncyk7XG4gICAgfVxuXG4gICAgLy8gYXBwbHkgYW55IGBmb3JtYXR0ZXJzYCB0cmFuc2Zvcm1hdGlvbnNcbiAgICB2YXIgaW5kZXggPSAwO1xuICAgIGFyZ3NbMF0gPSBhcmdzWzBdLnJlcGxhY2UoLyUoW2EteiVdKS9nLCBmdW5jdGlvbihtYXRjaCwgZm9ybWF0KSB7XG4gICAgICAvLyBpZiB3ZSBlbmNvdW50ZXIgYW4gZXNjYXBlZCAlIHRoZW4gZG9uJ3QgaW5jcmVhc2UgdGhlIGFycmF5IGluZGV4XG4gICAgICBpZiAobWF0Y2ggPT09ICclJScpIHJldHVybiBtYXRjaDtcbiAgICAgIGluZGV4Kys7XG4gICAgICB2YXIgZm9ybWF0dGVyID0gZXhwb3J0cy5mb3JtYXR0ZXJzW2Zvcm1hdF07XG4gICAgICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGZvcm1hdHRlcikge1xuICAgICAgICB2YXIgdmFsID0gYXJnc1tpbmRleF07XG4gICAgICAgIG1hdGNoID0gZm9ybWF0dGVyLmNhbGwoc2VsZiwgdmFsKTtcblxuICAgICAgICAvLyBub3cgd2UgbmVlZCB0byByZW1vdmUgYGFyZ3NbaW5kZXhdYCBzaW5jZSBpdCdzIGlubGluZWQgaW4gdGhlIGBmb3JtYXRgXG4gICAgICAgIGFyZ3Muc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgaW5kZXgtLTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtYXRjaDtcbiAgICB9KTtcblxuICAgIGlmICgnZnVuY3Rpb24nID09PSB0eXBlb2YgZXhwb3J0cy5mb3JtYXRBcmdzKSB7XG4gICAgICBhcmdzID0gZXhwb3J0cy5mb3JtYXRBcmdzLmFwcGx5KHNlbGYsIGFyZ3MpO1xuICAgIH1cbiAgICB2YXIgbG9nRm4gPSBlbmFibGVkLmxvZyB8fCBleHBvcnRzLmxvZyB8fCBjb25zb2xlLmxvZy5iaW5kKGNvbnNvbGUpO1xuICAgIGxvZ0ZuLmFwcGx5KHNlbGYsIGFyZ3MpO1xuICB9XG4gIGVuYWJsZWQuZW5hYmxlZCA9IHRydWU7XG5cbiAgdmFyIGZuID0gZXhwb3J0cy5lbmFibGVkKG5hbWVzcGFjZSkgPyBlbmFibGVkIDogZGlzYWJsZWQ7XG5cbiAgZm4ubmFtZXNwYWNlID0gbmFtZXNwYWNlO1xuXG4gIHJldHVybiBmbjtcbn1cblxuLyoqXG4gKiBFbmFibGVzIGEgZGVidWcgbW9kZSBieSBuYW1lc3BhY2VzLiBUaGlzIGNhbiBpbmNsdWRlIG1vZGVzXG4gKiBzZXBhcmF0ZWQgYnkgYSBjb2xvbiBhbmQgd2lsZGNhcmRzLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2VzXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGVuYWJsZShuYW1lc3BhY2VzKSB7XG4gIGV4cG9ydHMuc2F2ZShuYW1lc3BhY2VzKTtcblxuICB2YXIgc3BsaXQgPSAobmFtZXNwYWNlcyB8fCAnJykuc3BsaXQoL1tcXHMsXSsvKTtcbiAgdmFyIGxlbiA9IHNwbGl0Lmxlbmd0aDtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKCFzcGxpdFtpXSkgY29udGludWU7IC8vIGlnbm9yZSBlbXB0eSBzdHJpbmdzXG4gICAgbmFtZXNwYWNlcyA9IHNwbGl0W2ldLnJlcGxhY2UoL1xcKi9nLCAnLio/Jyk7XG4gICAgaWYgKG5hbWVzcGFjZXNbMF0gPT09ICctJykge1xuICAgICAgZXhwb3J0cy5za2lwcy5wdXNoKG5ldyBSZWdFeHAoJ14nICsgbmFtZXNwYWNlcy5zdWJzdHIoMSkgKyAnJCcpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZXhwb3J0cy5uYW1lcy5wdXNoKG5ldyBSZWdFeHAoJ14nICsgbmFtZXNwYWNlcyArICckJykpO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIERpc2FibGUgZGVidWcgb3V0cHV0LlxuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZGlzYWJsZSgpIHtcbiAgZXhwb3J0cy5lbmFibGUoJycpO1xufVxuXG4vKipcbiAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgZ2l2ZW4gbW9kZSBuYW1lIGlzIGVuYWJsZWQsIGZhbHNlIG90aGVyd2lzZS5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZW5hYmxlZChuYW1lKSB7XG4gIHZhciBpLCBsZW47XG4gIGZvciAoaSA9IDAsIGxlbiA9IGV4cG9ydHMuc2tpcHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBpZiAoZXhwb3J0cy5za2lwc1tpXS50ZXN0KG5hbWUpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIGZvciAoaSA9IDAsIGxlbiA9IGV4cG9ydHMubmFtZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBpZiAoZXhwb3J0cy5uYW1lc1tpXS50ZXN0KG5hbWUpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vKipcbiAqIENvZXJjZSBgdmFsYC5cbiAqXG4gKiBAcGFyYW0ge01peGVkfSB2YWxcbiAqIEByZXR1cm4ge01peGVkfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gY29lcmNlKHZhbCkge1xuICBpZiAodmFsIGluc3RhbmNlb2YgRXJyb3IpIHJldHVybiB2YWwuc3RhY2sgfHwgdmFsLm1lc3NhZ2U7XG4gIHJldHVybiB2YWw7XG59XG5cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vfi9kZWJ1Zy9kZWJ1Zy5qc1xuICoqIG1vZHVsZSBpZCA9IDM0XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG1vZHVsZSkge1xyXG5cdGlmKCFtb2R1bGUud2VicGFja1BvbHlmaWxsKSB7XHJcblx0XHRtb2R1bGUuZGVwcmVjYXRlID0gZnVuY3Rpb24oKSB7fTtcclxuXHRcdG1vZHVsZS5wYXRocyA9IFtdO1xyXG5cdFx0Ly8gbW9kdWxlLnBhcmVudCA9IHVuZGVmaW5lZCBieSBkZWZhdWx0XHJcblx0XHRtb2R1bGUuY2hpbGRyZW4gPSBbXTtcclxuXHRcdG1vZHVsZS53ZWJwYWNrUG9seWZpbGwgPSAxO1xyXG5cdH1cclxuXHRyZXR1cm4gbW9kdWxlO1xyXG59XHJcblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogKHdlYnBhY2spL2J1aWxkaW4vbW9kdWxlLmpzXG4gKiogbW9kdWxlIGlkID0gMzVcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGRyYWluaW5nID0gdHJ1ZTtcbiAgICB2YXIgY3VycmVudFF1ZXVlO1xuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB2YXIgaSA9IC0xO1xuICAgICAgICB3aGlsZSAoKytpIDwgbGVuKSB7XG4gICAgICAgICAgICBjdXJyZW50UXVldWVbaV0oKTtcbiAgICAgICAgfVxuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGRyYWluaW5nID0gZmFsc2U7XG59XG5wcm9jZXNzLm5leHRUaWNrID0gZnVuY3Rpb24gKGZ1bikge1xuICAgIHF1ZXVlLnB1c2goZnVuKTtcbiAgICBpZiAoIWRyYWluaW5nKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZHJhaW5RdWV1ZSwgMCk7XG4gICAgfVxufTtcblxucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5wcm9jZXNzLnZlcnNpb24gPSAnJzsgLy8gZW1wdHkgc3RyaW5nIHRvIGF2b2lkIHJlZ2V4cCBpc3N1ZXNcbnByb2Nlc3MudmVyc2lvbnMgPSB7fTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5cbi8vIFRPRE8oc2h0eWxtYW4pXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG5cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqICh3ZWJwYWNrKS9+L25vZGUtbGlicy1icm93c2VyL34vcHJvY2Vzcy9icm93c2VyLmpzXG4gKiogbW9kdWxlIGlkID0gMzZcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsIi8qKlxuICogSGVscGVycy5cbiAqL1xuXG52YXIgcyA9IDEwMDA7XG52YXIgbSA9IHMgKiA2MDtcbnZhciBoID0gbSAqIDYwO1xudmFyIGQgPSBoICogMjQ7XG52YXIgeSA9IGQgKiAzNjUuMjU7XG5cbi8qKlxuICogUGFyc2Ugb3IgZm9ybWF0IHRoZSBnaXZlbiBgdmFsYC5cbiAqXG4gKiBPcHRpb25zOlxuICpcbiAqICAtIGBsb25nYCB2ZXJib3NlIGZvcm1hdHRpbmcgW2ZhbHNlXVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfE51bWJlcn0gdmFsXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQHJldHVybiB7U3RyaW5nfE51bWJlcn1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih2YWwsIG9wdGlvbnMpe1xuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgaWYgKCdzdHJpbmcnID09IHR5cGVvZiB2YWwpIHJldHVybiBwYXJzZSh2YWwpO1xuICByZXR1cm4gb3B0aW9ucy5sb25nXG4gICAgPyBsb25nKHZhbClcbiAgICA6IHNob3J0KHZhbCk7XG59O1xuXG4vKipcbiAqIFBhcnNlIHRoZSBnaXZlbiBgc3RyYCBhbmQgcmV0dXJuIG1pbGxpc2Vjb25kcy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyXG4gKiBAcmV0dXJuIHtOdW1iZXJ9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBwYXJzZShzdHIpIHtcbiAgdmFyIG1hdGNoID0gL14oKD86XFxkKyk/XFwuP1xcZCspICoobXN8c2Vjb25kcz98c3xtaW51dGVzP3xtfGhvdXJzP3xofGRheXM/fGR8eWVhcnM/fHkpPyQvaS5leGVjKHN0cik7XG4gIGlmICghbWF0Y2gpIHJldHVybjtcbiAgdmFyIG4gPSBwYXJzZUZsb2F0KG1hdGNoWzFdKTtcbiAgdmFyIHR5cGUgPSAobWF0Y2hbMl0gfHwgJ21zJykudG9Mb3dlckNhc2UoKTtcbiAgc3dpdGNoICh0eXBlKSB7XG4gICAgY2FzZSAneWVhcnMnOlxuICAgIGNhc2UgJ3llYXInOlxuICAgIGNhc2UgJ3knOlxuICAgICAgcmV0dXJuIG4gKiB5O1xuICAgIGNhc2UgJ2RheXMnOlxuICAgIGNhc2UgJ2RheSc6XG4gICAgY2FzZSAnZCc6XG4gICAgICByZXR1cm4gbiAqIGQ7XG4gICAgY2FzZSAnaG91cnMnOlxuICAgIGNhc2UgJ2hvdXInOlxuICAgIGNhc2UgJ2gnOlxuICAgICAgcmV0dXJuIG4gKiBoO1xuICAgIGNhc2UgJ21pbnV0ZXMnOlxuICAgIGNhc2UgJ21pbnV0ZSc6XG4gICAgY2FzZSAnbSc6XG4gICAgICByZXR1cm4gbiAqIG07XG4gICAgY2FzZSAnc2Vjb25kcyc6XG4gICAgY2FzZSAnc2Vjb25kJzpcbiAgICBjYXNlICdzJzpcbiAgICAgIHJldHVybiBuICogcztcbiAgICBjYXNlICdtcyc6XG4gICAgICByZXR1cm4gbjtcbiAgfVxufVxuXG4vKipcbiAqIFNob3J0IGZvcm1hdCBmb3IgYG1zYC5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gbXNcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHNob3J0KG1zKSB7XG4gIGlmIChtcyA+PSBkKSByZXR1cm4gTWF0aC5yb3VuZChtcyAvIGQpICsgJ2QnO1xuICBpZiAobXMgPj0gaCkgcmV0dXJuIE1hdGgucm91bmQobXMgLyBoKSArICdoJztcbiAgaWYgKG1zID49IG0pIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gbSkgKyAnbSc7XG4gIGlmIChtcyA+PSBzKSByZXR1cm4gTWF0aC5yb3VuZChtcyAvIHMpICsgJ3MnO1xuICByZXR1cm4gbXMgKyAnbXMnO1xufVxuXG4vKipcbiAqIExvbmcgZm9ybWF0IGZvciBgbXNgLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBtc1xuICogQHJldHVybiB7U3RyaW5nfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gbG9uZyhtcykge1xuICByZXR1cm4gcGx1cmFsKG1zLCBkLCAnZGF5JylcbiAgICB8fCBwbHVyYWwobXMsIGgsICdob3VyJylcbiAgICB8fCBwbHVyYWwobXMsIG0sICdtaW51dGUnKVxuICAgIHx8IHBsdXJhbChtcywgcywgJ3NlY29uZCcpXG4gICAgfHwgbXMgKyAnIG1zJztcbn1cblxuLyoqXG4gKiBQbHVyYWxpemF0aW9uIGhlbHBlci5cbiAqL1xuXG5mdW5jdGlvbiBwbHVyYWwobXMsIG4sIG5hbWUpIHtcbiAgaWYgKG1zIDwgbikgcmV0dXJuO1xuICBpZiAobXMgPCBuICogMS41KSByZXR1cm4gTWF0aC5mbG9vcihtcyAvIG4pICsgJyAnICsgbmFtZTtcbiAgcmV0dXJuIE1hdGguY2VpbChtcyAvIG4pICsgJyAnICsgbmFtZSArICdzJztcbn1cblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9+L2RlYnVnL34vbXMvaW5kZXguanNcbiAqKiBtb2R1bGUgaWQgPSAzN1xuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIl0sInNvdXJjZVJvb3QiOiIiLCJmaWxlIjoiOTE5YTk0MTZkOTY5YzQ3MTA3YjQuanMifQ==